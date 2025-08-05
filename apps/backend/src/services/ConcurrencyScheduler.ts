import { ExecutionStatus, ExecutionStatusUpdatePayload, NanoId, PromptAcceptedResponsePayload, PromptInfo, WorkflowExecutionPayload } from '@comfytavern/types';
import { nanoid } from 'nanoid';

import { WebSocketManager } from '../websocket/WebSocketManager';
import { MAX_CONCURRENT_WORKFLOWS } from '../config';
import { ExecutionEngine } from '../ExecutionEngine'; // 导入 ExecutionEngine


// 内部表示运行中的执行
interface RunningExecution extends PromptInfo {
  payload: WorkflowExecutionPayload;
  startTime: number;
  userId: string; // + 添加 userId
  // 添加 ExecutionEngine 实例的引用
  engineInstance?: ExecutionEngine;
}

// 内部表示等待中的执行
interface WaitingExecution extends PromptInfo {
  payload: WorkflowExecutionPayload;
  queuedTime: number;
  userId: string; // + 添加 userId
}

type AppServices = {
  [key: string]: any; // 简单定义，可以从 index.ts 导入更具体的类型
};

export class ConcurrencyScheduler {
  private maxConcurrentWorkflows: number;
  private runningExecutions: Map<NanoId, RunningExecution> = new Map();
  private waitingQueue: WaitingExecution[] = [];
  private wsManager: WebSocketManager; // 引用 WebSocket 管理器
  private services: AppServices; // 存储服务引用
  private multiUserMode: boolean; // + 添加 multiUserMode

  constructor(wsManager: WebSocketManager, services: AppServices, multiUserMode: boolean) {
    this.maxConcurrentWorkflows = MAX_CONCURRENT_WORKFLOWS;
    this.wsManager = wsManager;
    this.services = services;
    this.multiUserMode = multiUserMode; // +
    console.log(`Concurrency Scheduler initialized with max ${this.maxConcurrentWorkflows} concurrent workflows. Multi-User Mode: ${this.multiUserMode}`);
  }

  /**
   * 提交一个新的工作流执行请求。
   * @param payload 工作流执行的载荷
   * @param source 'websocket' | 'http' 请求来源
   * @param clientId 可选的客户端 ID (用于 WebSocket)
   * @returns 包含 promptId 的对象
   */
  public submitExecution(
    payload: WorkflowExecutionPayload,
    source: 'websocket' | 'http',
    clientId?: string,
    userId?: string, // + 添加 userId
  ): PromptAcceptedResponsePayload {
    const promptId = nanoid();
    const now = Date.now();

    // --- 确定用户 ID ---
    let finalUserId: string;
    if (this.multiUserMode) {
      if (!userId) {
        // 在多用户模式下，userId 是必需的
        console.error('[Scheduler] CRITICAL: Execution submitted in multi-user mode without a userId.');
        // 这里可以根据策略决定是抛出错误还是拒绝
        // 为了健壮性，暂时拒绝，但理想情况下应该有更严格的入口控制
        // 注意：直接抛出错误可能会使调用者崩溃，返回一个错误响应或记录可能更好
        // 此处暂时简单拒绝，实际应用中应有更完善的错误处理
        throw new Error("Execution in multi-user mode requires a userId.");
      }
      finalUserId = userId;
    } else {
      // 在单用户模式下，如果没提供 userId，则使用默认值
      finalUserId = userId || 'default_user';
    }
    console.log(`[Scheduler] Received execution request ${promptId} for user ${finalUserId} from ${source}${clientId ? ` (client: ${clientId})` : ''}`);

    // 发送接受确认 (主要针对 WebSocket)
    if (source === 'websocket' && clientId) {
      // 咕咕：关键修复！将客户端订阅到这个特定的执行场景，确保消息只发给它。
      this.wsManager.subscribeToScene(clientId, promptId);

      const acceptedPayload: PromptAcceptedResponsePayload = { promptId };
      this.wsManager.sendMessageToClient(clientId, 'PROMPT_ACCEPTED_RESPONSE', acceptedPayload);
    }

    if (this.runningExecutions.size < this.maxConcurrentWorkflows) {
      // 立即开始执行
      const executionInfo: RunningExecution = {
        promptId,
        status: ExecutionStatus.RUNNING,
        payload,
        startTime: now,
        userId: finalUserId, // +
        // workflowName: payload.metadata?.name // 可选
      };
      this.runningExecutions.set(promptId, executionInfo);
      console.log(`[Scheduler] Starting execution ${promptId} for user ${finalUserId} immediately. Running: ${this.runningExecutions.size}/${this.maxConcurrentWorkflows}`);
      this._startExecution(executionInfo);

      // 发送状态更新 (运行中)
      this._sendStatusUpdate(promptId, ExecutionStatus.RUNNING);

    } else {
      // 加入等待队列
      const waitingInfo: WaitingExecution = {
        promptId,
        status: ExecutionStatus.QUEUED,
        payload,
        queuedTime: now,
        userId: finalUserId, // +
        // workflowName: payload.metadata?.name // 可选
      };
      this.waitingQueue.push(waitingInfo);
      console.log(`[Scheduler] Queuing execution ${promptId}. Queue size: ${this.waitingQueue.length}. Running: ${this.runningExecutions.size}/${this.maxConcurrentWorkflows}`);

      // 发送状态更新 (排队中)
      this._sendStatusUpdate(promptId, ExecutionStatus.QUEUED);
    }

    return { promptId };
  }

  /**
   * 内部方法，启动实际的工作流执行。
   * (需要与 ExecutionEngine 集成)
   * @param executionInfo 运行中的执行信息
   */
  private async _startExecution(executionInfo: RunningExecution): Promise<void> {
    const { promptId, payload, userId } = executionInfo; // + 解构出 userId
    console.log(`[Scheduler] Starting execution logic for ${promptId} (user: ${userId})...`);

    const engine = new ExecutionEngine(promptId, payload, this.wsManager, this.services, userId); // + 传递 userId
    executionInfo.engineInstance = engine; // 保存实例引用以便中断

    try {
      console.log(`[Scheduler] Executing engine.run() for ${promptId}...`);
      const result = await engine.run(); // 调用引擎执行
      const resultStatus = result?.status;
      const resultError = result?.error;
      // console.log(`[Scheduler] Execution engine for ${promptId} completed with status: ${resultStatus}, error: ${typeof resultError === 'object' ? (resultError?.message || JSON.stringify(resultError)) : String(resultError)}`);
      // 使用引擎返回的最终状态和错误信息
      this._handleExecutionCompletion(promptId, resultStatus, resultError);

    } catch (error: any) {
      // 捕获引擎内部未处理的异常或中断错误
      console.error(`[Scheduler] Execution engine for ${promptId} threw an unexpected error:`, error);
      // 检查是否是中断导致的错误
      const finalStatus = engine.getIsInterrupted() ? ExecutionStatus.INTERRUPTED : ExecutionStatus.ERROR;
      this._handleExecutionCompletion(promptId, finalStatus, error);
    } finally {
      // 清理引擎实例引用？（可选，取决于垃圾回收）
      // executionInfo.engineInstance = undefined;
    }
  }

  /**
   * 处理工作流执行完成或出错的情况。
   * @param promptId 完成或出错的执行 ID
   * @param finalStatus 最终状态 (COMPLETE 或 ERROR)
   * @param errorInfo 错误信息 (如果出错)
   */
  private _handleExecutionCompletion(
    promptId: NanoId,
    finalStatus: ExecutionStatus.COMPLETE | ExecutionStatus.ERROR | ExecutionStatus.INTERRUPTED,
    errorInfo?: any
  ): void {
    if (!this.runningExecutions.has(promptId)) {
        console.warn(`[Scheduler] Received completion for unknown or already completed execution ${promptId}`);
        return;
    }

    this.runningExecutions.delete(promptId);

    // 发送最终状态更新
    this._sendStatusUpdate(promptId, finalStatus, errorInfo);

    // TODO: 将结果存入 HistoryService

    // 尝试从队列启动下一个任务
    this._tryDequeue();
  }

  /**
   * 尝试从等待队列中取出一个任务并开始执行。
   */
  private _tryDequeue(): void {
    if (this.waitingQueue.length > 0 && this.runningExecutions.size < this.maxConcurrentWorkflows) {
      const nextExecution = this.waitingQueue.shift();
      if (nextExecution) {
        const { promptId, payload, userId } = nextExecution; // + 解构出 userId
        const now = Date.now();
        const executionInfo: RunningExecution = {
          promptId,
          status: ExecutionStatus.RUNNING, // 状态变为 RUNNING
          payload,
          startTime: now,
          userId, // +
          // workflowName: payload.metadata?.name // 可选
        };
        this.runningExecutions.set(promptId, executionInfo);
        console.log(`[Scheduler] Dequeued and starting execution ${promptId}. Running: ${this.runningExecutions.size}/${this.maxConcurrentWorkflows}. Queue size: ${this.waitingQueue.length}`);

        // 发送状态更新 (运行中)
        this._sendStatusUpdate(promptId, ExecutionStatus.RUNNING);

        this._startExecution(executionInfo);
      }
    } else {
        console.log(`[Scheduler] Dequeue check: Queue empty (${this.waitingQueue.length}) or max concurrency reached (${this.runningExecutions.size}/${this.maxConcurrentWorkflows}).`);
    }
  }

  /**
   * 发送工作流整体状态更新到所有客户端。
   * @param promptId 执行 ID
   * @param status 新的状态
   * @param errorInfo 错误信息 (如果状态是 ERROR)
   */
  private _sendStatusUpdate(promptId: NanoId, status: ExecutionStatus, errorInfo?: any): void {
    const payload: ExecutionStatusUpdatePayload = { promptId, status };
    if (status === ExecutionStatus.ERROR && errorInfo) {
      // 确保 errorInfo 是一个对象，如果不是，则包装它
      const safeErrorInfo = (typeof errorInfo === 'object' && errorInfo !== null) ? errorInfo : { message: String(errorInfo) };
      payload.errorInfo = { message: safeErrorInfo.message, stack: safeErrorInfo.stack }; // 提取关键错误信息
    }
    // console.log(`[Scheduler] Publishing status update for ${promptId}: ${status}. Payload: ${JSON.stringify(payload)}`);
    // 咕咕：关键修复！从广播改为向特定场景发布，确保只有相关的客户端收到状态更新。
    this.wsManager.publishToScene(promptId, 'EXECUTION_STATUS_UPDATE', payload);
  }

  /**
   * 获取当前正在运行的任务列表。
   * @returns PromptInfo 数组
   */
  public getRunningExecutions(): PromptInfo[] {
    return Array.from(this.runningExecutions.values()).map(exec => ({
      promptId: exec.promptId,
      status: exec.status,
      // workflowName: exec.workflowName,
      submittedAt: exec.startTime, // 使用 startTime 作为近似提交时间
    }));
  }

  /**
   * 获取当前等待队列中的任务列表。
   * @returns PromptInfo 数组
   */
  public getWaitingQueue(): PromptInfo[] {
    return this.waitingQueue.map(exec => ({
      promptId: exec.promptId,
      status: exec.status,
      // workflowName: exec.workflowName,
      submittedAt: exec.queuedTime, // 使用 queuedTime 作为提交时间
    }));
  }

  /**
   * 获取特定执行的状态。
   * (需要扩展以检查历史记录)
   * @param promptId 执行 ID
   * @returns PromptInfo 或 null
   */
  public getExecutionStatus(promptId: NanoId): PromptInfo | null {
    const running = this.runningExecutions.get(promptId);
    if (running) {
      return {
        promptId: running.promptId,
        status: running.status,
        // workflowName: running.workflowName,
        submittedAt: running.startTime,
      };
    }
    const waiting = this.waitingQueue.find(exec => exec.promptId === promptId);
    if (waiting) {
      return {
        promptId: waiting.promptId,
        status: waiting.status,
        // workflowName: waiting.workflowName,
        submittedAt: waiting.queuedTime,
      };
    }
    // TODO: 查询 HistoryService
    console.warn(`[Scheduler] Status requested for ${promptId}, but not found in running or queue. History check needed.`);
    return null;
  }

  /**
   * 中断一个正在运行或排队的执行。
   * @param promptId 要中断的执行 ID
   * @returns boolean 是否成功找到并尝试中断
   */
  public interruptExecution(promptId: NanoId): boolean {
    console.log(`[Scheduler] Attempting to interrupt execution ${promptId}...`);
    // 检查是否在运行
    const runningExecution = this.runningExecutions.get(promptId);
    if (runningExecution) {
      console.log(`[Scheduler] Found running execution ${promptId}. Attempting interrupt via engine...`);
      // 调用 ExecutionEngine 的 interrupt 方法
      if (runningExecution.engineInstance?.interrupt()) {
        console.log(`[Scheduler] Interrupt signal sent to engine for ${promptId}.`);
        // 引擎的 run 方法会捕获中断并返回 INTERRUPTED 状态，
        // _handleExecutionCompletion 会处理后续逻辑。
        return true;
      } else {
        console.warn(`[Scheduler] Failed to send interrupt signal to engine for ${promptId} (already interrupted or engine missing?).`);
        // 即使发送失败，如果任务仍在运行列表中，最终也会被清理
        return false;
      }
    }

    // 检查是否在队列
    const queueIndex = this.waitingQueue.findIndex(exec => exec.promptId === promptId);
    if (queueIndex !== -1) {
      console.log(`[Scheduler] Found queued execution ${promptId}. Removing from queue.`);
      this.waitingQueue.splice(queueIndex, 1);
      // 发送状态更新 (中断)
      this._sendStatusUpdate(promptId, ExecutionStatus.INTERRUPTED);
      // TODO: 可能需要通知 HistoryService 记录中断的排队任务
      return true;
    }

    console.log(`[Scheduler] Execution ${promptId} not found in running or queue for interruption.`);
    return false;
  }
}