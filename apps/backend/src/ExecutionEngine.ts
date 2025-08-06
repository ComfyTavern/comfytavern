import { Stream } from 'node:stream';
import { promisify } from 'node:util';

import {
  BuiltInSocketMatchCategory, ChunkPayload, DataFlowType, ExecutionEdge, ExecutionNode,
  ExecutionStatus, NanoId, NodeCompletePayload, NodeDefinition, NodeErrorPayload,
  NodeExecutingPayload, NodeExecutionResult, NodeYieldPayload, WorkflowExecutionPayload,
  WebSocketMessageType, // Corrected name for MessageType enum
  InterfaceOutputValue,
  WorkflowInterfaceYieldPayload,
  GroupSlotInfo // For typing interfaceOutputDefinitions
} from '@comfytavern/types';

import { nodeManager } from './services/NodeManager'; // 用于获取节点定义
import { parseSubHandleId } from './utils/helpers'; //  InputDefinition导入解析函数
import { WebSocketManager } from './websocket/WebSocketManager';
import { loggingService } from './services/LoggingService'; // 导入日志服务

// import { OutputManager } from './services/OutputManager'; // TODO: Import OutputManager
// import { HistoryService } from './services/HistoryService'; // TODO: Import HistoryService

const finished = promisify(Stream.finished);

// 辅助函数，用于等待流结束，比 promisify(Stream.finished) 更明确地处理不同事件
async function streamEndPromise(stream: Stream.Stream): Promise<void> {
  return new Promise((resolve, reject) => {
    let ended = false;
    const makeEnded = (fn: () => void) => {
      if (!ended) {
        ended = true;
        // 移除监听器以避免内存泄漏和重复调用
        if (stream instanceof Stream.Readable) stream.off('end', onEndOrFinish);
        if (stream instanceof Stream.Writable || stream instanceof Stream.Duplex) stream.off('finish', onEndOrFinish);
        stream.off('close', onClose);
        stream.off('error', onError);
        fn();
      }
    };

    const onEndOrFinish = () => makeEnded(resolve);
    const onClose = () => makeEnded(resolve); // 'close' 也视为正常结束的一种形式
    const onError = (err: Error) => makeEnded(() => reject(err));

    if (stream instanceof Stream.Readable) {
      stream.on('end', onEndOrFinish);
    }
    // Writable streams emit 'finish'. Duplex streams are both.
    if (stream instanceof Stream.Writable || stream instanceof Stream.Duplex) {
      stream.on('finish', onEndOrFinish);
    }
    // 'close' is emitted when the stream and any of its underlying resources have been closed.
    stream.on('close', onClose);
    stream.on('error', onError);
  });
}


class BufferOverflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BufferOverflowError';
  }
}

/**
 * 一个简单的、带容量限制的异步队列，用于在生产者和消费者之间解耦。
 * 实现了异步迭代器协议。
 */
class BoundedBuffer<T> {
  private limit: number;
  private buffer: T[] = [];
  private waitingResolvers: { resolve: (value: IteratorResult<T>) => void, reject: (reason?: any) => void }[] = [];
  private isDone = false;
  private error: any = null;

  constructor({ limit }: { limit: number }) {
    this.limit = limit;
  }

  isFull(): boolean {
    return this.buffer.length >= this.limit;
  }

  async push(chunk: T): Promise<void> {
    if (this.isDone) {
      throw new Error('Cannot push to a finished buffer.');
    }
    console.log(`[BoundedBuffer] Pushing chunk. Buffer size before: ${this.buffer.length}`);
    this.buffer.push(chunk);
    this.tryResolveWaiting();
  }

  signalEnd(): void {
    if (!this.isDone) {
      console.log('[BoundedBuffer] Signaling end.');
      this.isDone = true;
      this.tryResolveWaiting();
    }
  }

  signalError(error: any): void {
    if (!this.isDone) {
      console.error('[BoundedBuffer] Signaling error:', error.message, error.stack);
      this.isDone = true;
      this.error = error;
      // 立即 reject 所有等待者
      while (this.waitingResolvers.length > 0) {
        const resolver = this.waitingResolvers.shift()!;
        resolver.reject(this.error);
      }
    }
  }

  private tryResolveWaiting(): void {
    console.log(`[BoundedBuffer] tryResolveWaiting. Waiting: ${this.waitingResolvers.length}, Buffered: ${this.buffer.length}, Done: ${this.isDone}`);
    while (this.waitingResolvers.length > 0) {
      const callbacks = this.waitingResolvers.shift()!; // 改为 callbacks
      if (this.isDone && this.error) { // 优先处理错误
        console.log('[BoundedBuffer] Rejecting a waiting consumer with an error.');
        callbacks.reject(this.error);
        continue;
      }
      if (this.buffer.length > 0) {
        console.log('[BoundedBuffer] Resolving a waiting consumer with a chunk.');
        callbacks.resolve({ value: this.buffer.shift()!, done: false });
      } else if (this.isDone) {
        console.log('[BoundedBuffer] Resolving a waiting consumer with done=true.');
        callbacks.resolve({ value: undefined, done: true });
      } else {
        this.waitingResolvers.unshift(callbacks);
        break;
      }
    }
  }

  [Symbol.asyncIterator](): AsyncGenerator<T, void, undefined> {
    const next = (): Promise<IteratorResult<T>> => {
      return new Promise<IteratorResult<T>>((resolve, reject) => { // Modified to allow rejection
        // 首先检查是否已经有错误
        if (this.isDone && this.error) {
          reject(this.error);
          return;
        }
        
        if (this.buffer.length > 0) {
          resolve({ value: this.buffer.shift()!, done: false });
        } else if (this.isDone) {
          resolve({ value: undefined, done: true });
        } else {
          this.waitingResolvers.push({ resolve, reject }); // 存储 resolve 和 reject
        }
      });
    };

    return {
      next,
      return: async (): Promise<IteratorResult<T, void>> => {
        this.signalEnd();
        return { value: undefined, done: true as const };
      },
      throw: async (e: any): Promise<IteratorResult<T, void>> => {
        this.signalError(e);
        // Ensure the promise from next() would reject if called after this.
        this.waitingResolvers.forEach(resolver => {
          // Attempt to make pending promises reject. This is tricky.
          // A robust way is for next() to check this.error.
        });
        this.waitingResolvers = []; // Clear resolvers
        return { value: undefined, done: true as const };
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  }
}


/**
 * 负责执行单个工作流实例的引擎。
 * 每个执行请求都会创建一个新的 ExecutionEngine 实例。
 */
type AppServices = {
  [key: string]: any; // 简单定义，可以从 index.ts 导入更具体的类型
};

export class ExecutionEngine {
  private promptId: NanoId;
  private payload: WorkflowExecutionPayload;
  private wsManager: WebSocketManager;
  private services: AppServices; // 存储服务引用
  private userId: string;
  // private outputManager: OutputManager; // TODO: Inject OutputManager
  // private historyService: HistoryService; // TODO: Inject HistoryService

  private nodes: Record<NanoId, ExecutionNode> = {};
  private edges: ExecutionEdge[] = [];
  private nodeStates: Record<NanoId, ExecutionStatus> = {};
  private nodeResults: Record<NanoId, any> = {}; // 存储节点输出 { [outputKey]: value }
  private nodePseudoOutputs: Record<NanoId, any> = {}; // 存储绕过节点的伪输出
  private executionOrder: NanoId[] = [];
  private adj: Record<NanoId, NanoId[]> = {}; // 用于存储图的邻接表
  private isInterrupted: boolean = false;
  private backgroundTasks: Promise<any>[] = []; // 用于追踪所有后台任务，包括节点内部流和接口流
  private interfaceOutputDefinitions: Record<string, GroupSlotInfo> | undefined; // Corrected type
  private activeInterfaceStreamConsumers: Set<string> = new Set(); // Tracks interfaceOutputKeys

  constructor(
    promptId: NanoId,
    payload: WorkflowExecutionPayload,
    wsManager: WebSocketManager,
    services: AppServices, // 接收服务
    userId: string
    // outputManager: OutputManager, // TODO
    // historyService: HistoryService // TODO
  ) {
    this.promptId = promptId;
    this.payload = payload;
    if (payload.interfaceInputs) {
      // console.log(`[ExecutionEngine CONSTRUCTOR DEBUG] Payload for prompt ${promptId} CONTAINS interfaceInputs.`);
    } else {
      // console.log(`[ExecutionEngine CONSTRUCTOR DEBUG] Payload for prompt ${promptId} DOES NOT CONTAIN interfaceInputs.`);
    }
    this.wsManager = wsManager;
    this.services = services; // 存储服务
    this.userId = userId;
    // this.outputManager = outputManager;
    // this.historyService = historyService;

    this.nodes = payload.nodes.reduce((acc: Record<NanoId, ExecutionNode>, node: ExecutionNode) => {
      acc[node.id] = node;
      return acc;
    }, {});
    this.edges = payload.edges;
    // Correctly access interfaceOutputs directly from the payload,
    // as defined in WorkflowExecutionPayload type in @comfytavern/types/src/execution.ts
    this.interfaceOutputDefinitions = payload.interfaceOutputs;

    console.log(`[Engine-${this.promptId}] Initialized for execution.`);
    // 初始化执行日志的调用已移至 run() 方法的开头
  }

  private sanitizeObjectForLogging(obj: any, keysToSanitize: string[] = ['system_prompt', 'system_message', 'prompt'], maxLength: number = 100): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    const newObj = { ...obj };
    for (const key of keysToSanitize) {
      if (newObj.hasOwnProperty(key) && typeof newObj[key] === 'string' && newObj[key].length > maxLength) {
        newObj[key] = `${newObj[key].substring(0, maxLength)}... (omitted, original length: ${newObj[key].length})`;
      }
    }
    return newObj;
  }

  /**
   * 执行完整的工作流。
   */
  private async *normalizeToAsyncGenerator(
    executionResult: Promise<Record<string, any> | void> | AsyncGenerator<ChunkPayload, Record<string, any> | void, undefined>
  ): AsyncGenerator<ChunkPayload, Record<string, any> | void, undefined> {
    // 检查结果是否具有异步迭代器符号。这是检查 AsyncGenerator 的可靠方法。
    if (typeof (executionResult as any)[Symbol.asyncIterator] !== 'function') {
      // 这是一个 Promise。等待它，然后我们就完成了。我们不 yield任何东西。
      const batchResult = await (executionResult as Promise<Record<string, any> | void>);
      // 生成器的返回值是批处理结果。
      return batchResult;
    } else {
      // 这是一个 AsyncGenerator。我们需要 yield 其所有块，然后返回其最终结果。
      return yield* (executionResult as AsyncGenerator<ChunkPayload, Record<string, any> | void, undefined>);
    }
  }

  public async run(): Promise<{ status: ExecutionStatus.COMPLETE | ExecutionStatus.ERROR | ExecutionStatus.INTERRUPTED; error?: any }> {
    // 在控制台中显眼地打印执行开始日志
    console.log(`\n\n\n\x1b[32m[Engine-${this.promptId}]----- Starting execution | 开始执行工作流 ----\x1b[0m\n\n\n`);
    this.isInterrupted = false;
    this.backgroundTasks = []; // 重置后台任务列表

    try {
      // 初始化执行日志，确保在任何节点执行前完成
      await loggingService.initializeExecutionLog(this.promptId, this.payload);
      // console.log(`[Engine-${this.promptId}] Execution log initialized successfully.`); // 可选的确认日志

      this.executionOrder = this.topologicalSort(this.nodes, this.edges); // topologicalSort 内部会填充 this.adj
      // console.log(`[Engine-${this.promptId}] Execution order:`, this.executionOrder);

      let hasExecutionError = false; // 标记是否有节点执行失败

      for (const nodeId of this.executionOrder) {
        // console.log(`[Engine-${this.promptId}] RUN_LOOP: Processing node ${nodeId}`); // DEBUG
        if (this.isInterrupted) {
          console.log(`[Engine-${this.promptId}] Execution interrupted before node ${nodeId}.`);
          this.skipDescendants(nodeId, ExecutionStatus.INTERRUPTED); // 标记后续节点为中断
          break; // 静默退出循环，不再抛出错误
        }

        // 如果节点已经被标记为 SKIPPED 或 ERROR (例如，由于上游节点失败)，则跳过执行
        if (this.nodeStates[nodeId] === ExecutionStatus.SKIPPED || this.nodeStates[nodeId] === ExecutionStatus.ERROR || this.nodeStates[nodeId] === ExecutionStatus.INTERRUPTED) {
          console.log(`[Engine-${this.promptId}] Skipping node ${nodeId} as its state is already ${this.nodeStates[nodeId]}.`);
          continue;
        }

        const node = this.nodes[nodeId];
        try {
          if (node?.bypassed === true) {
            console.log(`[Engine-${this.promptId}] Node ${nodeId} is bypassed, handling bypass logic...`);
            const definition = nodeManager.getNode(node.fullType);
            if (!definition) {
              throw new Error(`Node type ${node.fullType} not found in registry.`);
            }
            const inputs = this.prepareNodeInputs(nodeId);
            const pseudoOutputs = this.handleBypassedNode(definition, node, inputs);
            this.nodePseudoOutputs[nodeId] = pseudoOutputs;
            this.nodeResults[nodeId] = pseudoOutputs;
            this.nodeStates[nodeId] = ExecutionStatus.SKIPPED;
            this.sendNodeBypassed(nodeId, pseudoOutputs);
            continue;
          }

          const inputs = await this.prepareNodeInputs(nodeId); // prepareNodeInputs is now async
          // console.log(`[Engine-${this.promptId}] RUN_LOOP: Inputs prepared for ${nodeId}. Executing...`); // DEBUG
          const result = await this.executeNode(nodeId, inputs); // executeNode remains async

          // console.log(`[Engine-${this.promptId}] RUN_LOOP: Node ${nodeId} executeNode returned status: ${result.status}`); // DEBUG
          if (result.status === ExecutionStatus.ERROR) {
            console.error(`[Engine-${this.promptId}] Error in node ${nodeId}. Marking as ERROR and skipping descendants.`);
            hasExecutionError = true;
            this.nodeStates[nodeId] = ExecutionStatus.ERROR; // 确保当前节点状态被正确标记
            // 注意：executeNode 内部已经发送了 NODE_ERROR，这里不需要重复发送
            this.skipDescendants(nodeId, ExecutionStatus.SKIPPED); // 下游节点标记为 SKIPPED
            // 不再直接 return，而是继续循环处理其他可能独立的分支
          } else if (result.status === ExecutionStatus.INTERRUPTED) {
            console.log(`[Engine-${this.promptId}] Node ${nodeId} execution interrupted. Marking as INTERRUPTED and skipping descendants.`);
            this.nodeStates[nodeId] = ExecutionStatus.INTERRUPTED;
            this.skipDescendants(nodeId, ExecutionStatus.INTERRUPTED);
            break; // 静默退出循环，不再抛出错误
          }
          // 对于 COMPLETE 或其他非错误/中断状态，继续执行
        } catch (error: any) {
          console.error(`[Engine-${this.promptId}] Critical error processing node ${nodeId}:`, error);
          this.nodeStates[nodeId] = ExecutionStatus.ERROR;
          this.sendNodeError(nodeId, `Critical error: ${error.message}`);
          hasExecutionError = true;
          this.skipDescendants(nodeId, ExecutionStatus.SKIPPED);
          // 同样，不直接 return，允许其他分支继续
        }
      }

      // 1. 启动接口输出流处理 (它会将接口消费者的 Promise 添加到 this.backgroundTasks)
      //    必须在等待任何 backgroundTasks 之前调用，以确保所有消费者都已启动！
      //    _processAndBroadcastFinalOutputs 内部会调用 _handleStreamInterfaceOutput,
      //    后者将 Promise 加入 this.backgroundTasks 并开始消费。
      await this._processAndBroadcastFinalOutputs();


      // 2. 等待所有后台任务 (包括所有节点的 streamLifecyclePromise 和所有接口的 _handleStreamInterfaceOutput Promise)
      const allBackgroundPromises = [...this.backgroundTasks]; // 复制
      if (allBackgroundPromises.length > 0) {
        // console.log(`[Engine-${this.promptId}] Waiting for ALL ${allBackgroundPromises.length} background tasks (node streams + interface streams) to complete...`);
        // 这里会等待所有生产者和消费者完成
        try {
          await Promise.all(allBackgroundPromises);
          // console.log(`[Engine-${this.promptId}] ALL background tasks completed successfully.`);
        } catch (backgroundError: any) {
          console.error(`[Engine-${this.promptId}] One or more background tasks failed:`, backgroundError?.message || backgroundError, backgroundError?.stack);
          // 背景任务失败视为存在执行错误
          hasExecutionError = true;
        }
      }

      // 移除原有的 阶段1 / 阶段3 的 Promise.all 和 this.backgroundTasks = []

      // 最终状态判断
      if (this.isInterrupted) {
        console.log(`[Engine-${this.promptId}] Workflow execution was interrupted.`);
        // 由于上游已经处理了日志和状态，这里直接返回即可
        return { status: ExecutionStatus.INTERRUPTED };
      }

      if (hasExecutionError) {
        console.log(`[Engine-${this.promptId}] Workflow execution finished with one or more node errors.`);
        // loggingService.logWorkflowEnd(ExecutionStatus.ERROR, "One or more nodes failed.") // 会在 catch 中处理
        // 注意：如果因为 hasExecutionError 而进入这里，外层的 catch 块可能不会被触发，
        // 除非这里也抛出一个错误。或者，我们直接返回 ERROR 状态。
        // 为了与现有结构保持一致，如果 run 方法本身没有抛出其他异常，
        // 这里的 hasExecutionError 应该导致返回 { status: ExecutionStatus.ERROR }
        return { status: ExecutionStatus.ERROR, error: "One or more nodes failed during execution." };
      }

      // 如果没有中断，也没有节点执行错误，再检查接口流
      if (this.activeInterfaceStreamConsumers.size === 0) {
        console.log(`[Engine-${this.promptId}] Workflow execution completed successfully (all nodes, internal streams, and interface streams processed).`);
        loggingService.logWorkflowEnd(ExecutionStatus.COMPLETE)
          .catch(err => console.error(`[Engine-${this.promptId}] Failed to log workflow completion:`, err));
        return { status: ExecutionStatus.COMPLETE };
      } else {
        // 这种情况理论上不应该发生，如果所有节点都完成了，接口流也应该完成或被中断处理
        const trackingErrorMsg = `Interface stream completion tracking error: ${this.activeInterfaceStreamConsumers.size} streams still active.`;
        console.error(`[Engine-${this.promptId}] ${trackingErrorMsg}`);
        // loggingService.logWorkflowEnd(ExecutionStatus.ERROR, trackingErrorMsg) // 会在 catch 中处理
        return { status: ExecutionStatus.ERROR, error: trackingErrorMsg };
      }

    } catch (error: any) {
      // 这个 catch 块现在主要处理非中断引发的意外错误，
      // 例如拓扑排序失败、或节点执行中的其他未捕获异常。
      console.error(`[Engine-${this.promptId}] Workflow execution failed with an unexpected exception:`, error);
      // 既然中断不再抛出错误，这里的 finalStatus 应该总是 ERROR
      const finalStatus = ExecutionStatus.ERROR;
      const errorMessage = error.message || String(error);
      loggingService.logWorkflowEnd(finalStatus, errorMessage)
        .catch(err => console.error(`[Engine-${this.promptId}] Failed to log workflow failure:`, err));
      return { status: finalStatus, error: errorMessage };
    }
  }

  public interrupt(): boolean {
    if (!this.isInterrupted) {
      console.log(`[Engine-${this.promptId}] Received interrupt signal.`);
      this.isInterrupted = true;
      loggingService.logInterrupt(this.promptId)
        .catch(err => console.error(`[Engine-${this.promptId}] Failed to log interrupt signal:`, err));
      return true;
    }
    return false;
  }

  public getIsInterrupted(): boolean {
    return this.isInterrupted;
  }

  private topologicalSort(nodes: Record<NanoId, ExecutionNode>, edges: ExecutionEdge[]): NanoId[] {
    const order: NanoId[] = [];
    const inDegree: Record<NanoId, number> = {};
    const adj: Record<NanoId, NanoId[]> = {};
    const queue: NanoId[] = [];
    const nodeIds = Object.keys(nodes);

    nodeIds.forEach(id => {
      inDegree[id] = 0;
      adj[id] = [];
    });
    this.adj = adj; // 保存邻接表

    edges.forEach(edge => {
      const sourceId = edge.sourceNodeId;
      const targetId = edge.targetNodeId;
      if (nodes[sourceId] && nodes[targetId]) {
        if (adj[sourceId]) {
          adj[sourceId].push(targetId);
        } else {
          console.warn(`[Engine-${this.promptId}] Adjacency list for source node ${sourceId} not initialized.`);
        }
        if (typeof inDegree[targetId] === 'number') {
          inDegree[targetId]++;
        } else {
          console.warn(`[Engine-${this.promptId}] In-degree for target node ${targetId} not initialized.`);
        }
      } else {
        console.warn(`[Engine-${this.promptId}] Edge connects non-existent node: ${sourceId} -> ${targetId}`);
      }
    });

    nodeIds.forEach(id => {
      if (inDegree[id] === 0) {
        queue.push(id);
      }
    });

    while (queue.length > 0) {
      const u = queue.shift()!;
      order.push(u);

      (adj[u] || []).forEach(v => {
        if (typeof inDegree[v] === 'number') {
          inDegree[v]--;
          if (inDegree[v] === 0) {
            queue.push(v);
          }
        } else {
          console.warn(`[Engine-${this.promptId}] In-degree for node ${v} not initialized.`);
        }
      });
    }

    if (order.length !== nodeIds.length) {
      const remainingNodes = nodeIds.filter(id => !order.includes(id));
      console.error(`[Engine-${this.promptId}] Cycle detected in the graph involving nodes:`, remainingNodes);
      throw new Error(`Workflow contains a cycle involving nodes: ${remainingNodes.join(', ')}`);
    }
    return order;
  }

  private async prepareNodeInputs(nodeId: NanoId): Promise<Record<string, any>> { // 变成 async
    const inputs: Record<string, any> = {};
    const node = this.nodes[nodeId];

    // console.log(`[Engine-${this.promptId}] prepareNodeInputs for ${nodeId}. Node config inputs: ${JSON.stringify(this.sanitizeObjectForLogging(node?.inputs))}, inputConnectionOrders: ${JSON.stringify((node as any)?.inputConnectionOrders)}`);

    if (!node) {
      console.warn(`[Engine-${this.promptId}] Node ${nodeId} not found during input preparation.`);
      return {};
    }
    const definition = nodeManager.getNode(node.fullType);
    if (!definition) {
      return {};
    }

    // --- 新增逻辑：确定当前有效的输入定义 ---
    let effectiveInputDefinitions = definition.inputs;
    const modeConfigKey = definition.modeConfigKey;
    if (modeConfigKey && node.configValues && node.configValues[modeConfigKey]) {
      const currentModeId = node.configValues[modeConfigKey] as string;
      const modeDefinition = definition.modes?.[currentModeId];
      // 如果模式存在且有自己的输入定义，则使用它
      if (modeDefinition?.inputs) {
        effectiveInputDefinitions = modeDefinition.inputs;
      }
    }
    // 如果没有有效的输入定义集，则返回空
    if (!effectiveInputDefinitions) {
      return {};
    }
    // --- 结束新增逻辑 ---


    const multiInputBuffer: Record<string, Array<{ edgeId: string, value: any }>> = {};

    // 使用 for...of 替代 forEach 以正确处理 await
    for (const edge of this.edges) {
      if (edge.targetNodeId === nodeId) {
        const sourceNodeId = edge.sourceNodeId;
        const sourceOutputKey = edge.sourceHandle;
        const rawTargetInputKey = edge.targetHandle;

        if (sourceNodeId && sourceOutputKey && rawTargetInputKey) {
          const sourceResult = this.nodeResults[sourceNodeId];
          const sourceNodeState = this.nodeStates[sourceNodeId];
          // 流式节点的状态可能是 RUNNING，但其流输出已经可用
          // 检查上游节点是否就绪的条件
          // 就绪条件：
          // 1. 节点已成功完成 (COMPLETE) 或被跳过 (SKIPPED)。
          // 2. 节点正在运行 (RUNNING)，并且其对应的输出已经存在，且该输出是以下两者之一：
          //    a) 一个可读流 (Stream.Readable)，代表这是一个流式输出。
          //    b) 一个 Promise，代表这是一个非流式节点的、将在未来完成的批处理结果。
          const isSourceReady = sourceNodeState === ExecutionStatus.COMPLETE ||
            sourceNodeState === ExecutionStatus.SKIPPED ||
            (sourceNodeState === ExecutionStatus.RUNNING && sourceResult &&
              (sourceResult[sourceOutputKey] instanceof Stream.Readable || sourceResult[sourceOutputKey] instanceof Promise));


          if (isSourceReady && sourceResult) {
            let sourceValue = sourceResult[sourceOutputKey];
            if (sourceValue instanceof Promise) { // 如果是 Promise，则 await
              try {
                sourceValue = await sourceValue;
              } catch (promiseError: any) {
                console.warn(`[Engine-${this.promptId}] Error awaiting promised input '${sourceOutputKey}' from node ${sourceNodeId} for ${nodeId}: ${promiseError.message}`);
                // 根据策略，这里可以抛出错误，或者将 sourceValue 设为 undefined/特定错误标记
                // 为了保持流程，暂时设为 undefined，下游的 required 检查可能会捕获
                sourceValue = undefined;
              }
            }
            const { originalKey: actualInputKey } = parseSubHandleId(rawTargetInputKey);
            const inputDef = effectiveInputDefinitions[actualInputKey];

            if (inputDef?.multi) {
              if (!multiInputBuffer[actualInputKey]) {
                multiInputBuffer[actualInputKey] = [];
              }
              multiInputBuffer[actualInputKey].push({ edgeId: edge.id!, value: sourceValue });
            } else {
              inputs[actualInputKey] = sourceValue;
            }
          } else {
            console.warn(`[Engine-${this.promptId}] Source node ${sourceNodeId} for edge ${edge.id} (state: ${sourceNodeState}) did not complete successfully or its output '${sourceOutputKey}' is not yet available. Setting input ${rawTargetInputKey} to undefined.`);
            const { originalKey: actualInputKey } = parseSubHandleId(rawTargetInputKey);
            const inputDef = effectiveInputDefinitions[actualInputKey];
            if (inputDef?.multi) {
              if (!multiInputBuffer[actualInputKey]) {
                multiInputBuffer[actualInputKey] = [];
              }
              multiInputBuffer[actualInputKey].push({ edgeId: edge.id!, value: undefined });
            } else {
              inputs[actualInputKey] = undefined;
            }
          }
        }
      }
    };

    // console.log(`[Engine-${this.promptId}] After collecting connected inputs for ${nodeId}:`);
    // console.log(`  multiInputBuffer: ${JSON.stringify(multiInputBuffer)}`);
    // console.log(`  inputs (from single connections): ${JSON.stringify(this.sanitizeObjectForLogging(inputs))}`);

    const currentInputConnectionOrders = (node as any).inputConnectionOrders as Record<string, string[]> | undefined;
    if (currentInputConnectionOrders) {
      for (const originalInputKey in currentInputConnectionOrders) {
        const inputDef = effectiveInputDefinitions[originalInputKey];
        if (inputDef?.multi && multiInputBuffer[originalInputKey]) {
          const orderedEdgeIds = currentInputConnectionOrders[originalInputKey] || [];
          const collectedValuesForSlot = multiInputBuffer[originalInputKey];
          inputs[originalInputKey] = orderedEdgeIds.map((edgeId: string) => {
            const foundEntry = collectedValuesForSlot.find(entry => entry.edgeId === edgeId);
            return foundEntry !== undefined ? foundEntry.value : undefined;
          });
        }
      }
    }

    // console.log(`[Engine-${this.promptId}] After processing multi-input orders for ${nodeId}:`);
    // console.log(`  inputs: ${JSON.stringify(this.sanitizeObjectForLogging(inputs))}`);

    if (node.inputs) {
      for (const inputKey in node.inputs) {
        if (inputs[inputKey] === undefined) {
          const inputDef = effectiveInputDefinitions[inputKey];
          if (inputDef?.multi) {
            if (Array.isArray(node.inputs[inputKey])) {
              inputs[inputKey] = node.inputs[inputKey];
            } else if (node.inputs[inputKey] !== undefined) {
              inputs[inputKey] = node.inputs[inputKey];
            }
          } else {
            inputs[inputKey] = node.inputs[inputKey];
          }
        }
      }
    }

    // console.log(`[Engine-${this.promptId}] After applying node preset inputs for ${nodeId}:`);
    // console.log(`  inputs: ${JSON.stringify(this.sanitizeObjectForLogging(inputs))}`);

    for (const inputKey in effectiveInputDefinitions) {
      if (inputs[inputKey] === undefined && effectiveInputDefinitions[inputKey].config?.default !== undefined) {
        const inputDef = effectiveInputDefinitions[inputKey];
        const defaultValue = inputDef.config!.default;
        if (inputDef.multi && !Array.isArray(defaultValue)) {
          inputs[inputKey] = defaultValue;
        } else {
          inputs[inputKey] = defaultValue;
        }
      }
    }

    for (const inputKey in effectiveInputDefinitions) {
      const inputDef = effectiveInputDefinitions[inputKey];
      const isRequired = typeof inputDef.required === 'function'
        ? inputDef.required(node.configValues || {})
        : inputDef.required === true;
      if (isRequired && inputs[inputKey] === undefined) {
        // 如果是流输入，且上游是流式节点但尚未完成（状态为RUNNING），则不应抛出错误
        // 检查连接到此必需输入槽的上游节点是否为流式且正在运行
        let isConnectedToRunningStream = false;
        this.edges.forEach(edge => {
          if (edge.targetNodeId === nodeId && parseSubHandleId(edge.targetHandle).originalKey === inputKey) {
            const sourceNode = this.nodes[edge.sourceNodeId];
            const sourceNodeDef = sourceNode ? nodeManager.getNode(sourceNode.fullType) : undefined;
            const sourceNodeState = this.nodeStates[edge.sourceNodeId];
            if (sourceNodeDef && Object.values(sourceNodeDef.outputs || {}).some(out => out.isStream === true) && sourceNodeState === ExecutionStatus.RUNNING) {
              isConnectedToRunningStream = true;
            }
          }
        });

        if (!isConnectedToRunningStream) {
          throw new Error(`Missing required input '${inputKey}' for node ${nodeId} (${node.fullType})`);
        } else {
          // console.log(`[Engine-${this.promptId}] Required input '${inputKey}' for node ${nodeId} is connected to a running stream, deferring strict check.`);
        }
      }
    }

    // console.log(`[Engine-${this.promptId}] Final prepared inputs for ${nodeId} (before required check): ${JSON.stringify(this.sanitizeObjectForLogging(inputs))}`);
    return inputs;
  }

  private sendNodeError(nodeId: NanoId, errorDetails: any): void {
    const payload: NodeErrorPayload = {
      promptId: this.promptId,
      nodeId,
      errorDetails: { message: String(errorDetails) },
    };
    this.wsManager.publishToScene(this.promptId, 'NODE_ERROR', payload);
  }

  private async executeNode(
    nodeId: NanoId,
    inputs: Record<string, any> // inputs 已经是 await 后的结果
  ): Promise<{ status: ExecutionStatus; error?: any }> {
    const node = this.nodes[nodeId];
    if (!node) {
      const errorMsg = `Node with ID ${nodeId} not found in engine.`;
      this.sendNodeError(nodeId, errorMsg);
      return { status: ExecutionStatus.ERROR, error: errorMsg };
    }
    const definition = nodeManager.getNode(node.fullType);

    // 移除对 definition.execute 的早期检查，因为执行函数现在是动态的
    if (!definition) {
      const errorMsg = `Node type ${node.fullType} not found or not executable.`;
      this.sendNodeError(nodeId, errorMsg);
      return { status: ExecutionStatus.ERROR, error: errorMsg };
    }

    this.nodeStates[nodeId] = ExecutionStatus.RUNNING;
    const executingPayload: NodeExecutingPayload = { promptId: this.promptId, nodeId };
    this.wsManager.publishToScene(this.promptId, 'NODE_EXECUTING', executingPayload);
    // console.log(`[Engine-${this.promptId}] Executing node ${nodeId} (${node.fullType})...`);

    const nodeStartTime = Date.now();
    loggingService.logNodeStart(nodeId, node.fullType, inputs)
      .catch(err => console.error(`[Engine-${this.promptId}] Failed to log node start for ${nodeId}:`, err));

    try {
      if (this.isInterrupted) {
        throw new Error('Execution interrupted by user.');
      }

      // 1. 确定当前模式ID
      const modeConfigKey = definition.modeConfigKey;
      const currentModeId = (modeConfigKey && node.configValues) ? (node.configValues[modeConfigKey] as string) : undefined;
      const modeDefinition = (currentModeId && definition.modes) ? definition.modes[currentModeId] : undefined;

      // 2. 选择正确的执行函数和输出定义
      const executeFn = modeDefinition?.execute || definition.execute;
      const effectiveOutputDefinitions = modeDefinition?.outputs || definition.outputs || {};

      // 3. 检查是否有可执行的函数
      if (!executeFn) {
        const errorMsg = `Node ${node.fullType} (${nodeId}) has no valid execute function for the current mode ('${currentModeId || 'default'}').`;
        throw new Error(errorMsg);
      }

      // 4. 准备执行上下文
      const context = {
        promptId: this.promptId,
        nodeId: nodeId,
        workflowInterfaceInputs: this.payload.interfaceInputs,
        workflowInterfaceOutputs: this.payload.interfaceOutputs,
        services: this.services,
        userId: this.userId,
        nodeData: {
          currentModeId: currentModeId
        }
      };

      // 5. 统一执行逻辑
      const hasStreamOutput = Object.values(effectiveOutputDefinitions).some(output => output.isStream);
      const executionResult = executeFn(inputs, context);
      const nodeGenerator = this.normalizeToAsyncGenerator(executionResult);

      if (!hasStreamOutput) {
        // --- 非流式节点的处理 ---
        const finalResult = (await nodeGenerator.next()).value as Record<string, any> | void;
        const resultForEvent = finalResult || {};

        this.nodeResults[nodeId] = resultForEvent;
        this.nodeStates[nodeId] = ExecutionStatus.COMPLETE;
        const durationMs = Date.now() - nodeStartTime;
        loggingService.logNodeComplete(nodeId, node.fullType, resultForEvent, durationMs)
          .catch(err => console.error(`[Engine-${this.promptId}] Failed to log batch node complete for ${nodeId}:`, err));
        this.sendNodeComplete(nodeId, resultForEvent);
        // 手动发送 YIELD 消息以兼容UI
        const finalPayloadContent: ChunkPayload = { type: 'finish_reason_chunk', content: 'Stream ended' };
        const finalPayload: NodeYieldPayload = {
          promptId: this.promptId,
          sourceNodeId: nodeId,
          yieldedContent: finalPayloadContent,
          isLastChunk: true,
        };
        this.wsManager.publishToScene(this.promptId, 'NODE_YIELD', finalPayload);
        return { status: ExecutionStatus.COMPLETE };
      }

      // --- 流式节点的处理 ---
      // 这里的 definition 参数是 NodeDefinition 类型，而 startStreamNodeExecution 也需要它
      const { streams, batchDataPromise } = this.startStreamNodeExecution(node, nodeGenerator, definition, context, nodeStartTime);

      const resultsForNode: Record<string, any> = { ...streams };
      // 使用之前计算好的 effectiveOutputDefinitions
      for (const outputKey in effectiveOutputDefinitions) {
        if (!effectiveOutputDefinitions[outputKey].isStream) {
          resultsForNode[outputKey] = batchDataPromise.then(batch => {
            if (batch && typeof batch === 'object' && outputKey in batch) {
              return (batch as Record<string, any>)[outputKey];
            }
            return undefined;
          }).catch(err => {
            console.error(`[Engine-${this.promptId}] Promise for ${nodeId}.${outputKey} (from batchDataPromise) rejected: ${err.message}`);
            throw err;
          });
        }
      }

      this.nodeResults[nodeId] = resultsForNode;
      this.nodeStates[nodeId] = ExecutionStatus.RUNNING;
      return { status: ExecutionStatus.RUNNING };

    } catch (error: any) {
      const durationMs = Date.now() - nodeStartTime;
      const errorMessage = error.message || String(error);
      this.nodeStates[nodeId] = this.isInterrupted ? ExecutionStatus.INTERRUPTED : ExecutionStatus.ERROR;
      loggingService.logNodeError(nodeId, node.fullType, error, durationMs)
        .catch(err => console.error(`[Engine-${this.promptId}] Failed to log node error for ${nodeId}:`, err));
      this.sendNodeError(nodeId, errorMessage);
      return { status: this.nodeStates[nodeId], error: errorMessage };
    }
  }

  /**
   * 启动流式节点的后台执行，并管理其生命周期。
   * 返回用于连接下游的流实例。
   */
  private startStreamNodeExecution(
    node: ExecutionNode,
    nodeGenerator: AsyncGenerator<ChunkPayload, Record<string, any> | void, undefined>,
    definition: NodeDefinition,
    context: { promptId: NanoId;[key: string]: any },
    nodeStartTime: number // 添加 nodeStartTime 参数
  ): { streams: Record<string, Stream.Readable>, batchDataPromise: Promise<Record<string, any> | void> } {
    const { id: nodeId, fullType } = node;
    const nodeIdentifier = `${definition.displayName || definition.type}(${nodeId})`;
    const { promptId } = context;

    // 1. 创建一个 PassThrough 流作为所有下游的源头
    const sourceStream = new Stream.PassThrough({ objectMode: true });

    const streamOutputsToReturn: Record<string, Stream.Readable> = {};
    const consumerPromises: Promise<any>[] = [];

    // 2. 设置多路广播 (Multicaster)
    // 分支 A: 事件总线
    const eventBusStream = new Stream.PassThrough({ objectMode: true });
    sourceStream.pipe(eventBusStream);
    consumerPromises.push(this.consumeForEventBus(eventBusStream, nodeId, promptId));

    // 分支 B: 连接下游节点
    for (const outputKey in definition.outputs) {
      if (definition.outputs[outputKey].isStream) {
        const downstreamConnections = this.getDownstreamStreamConnections(nodeId, outputKey);
        const isConnectedToInterface = Object.values(this.payload.outputInterfaceMappings || {}).some(
          mapping => mapping.sourceNodeId === nodeId && mapping.sourceSlotKey === outputKey
        );

        const passThroughForOutput = new Stream.PassThrough({ objectMode: true });
        sourceStream.pipe(passThroughForOutput);
        streamOutputsToReturn[outputKey] = passThroughForOutput;

        if (downstreamConnections.length === 0 && !isConnectedToInterface) {
          passThroughForOutput.resume();
          consumerPromises.push(streamEndPromise(passThroughForOutput).catch(err => {
            console.warn(`[Engine-${promptId}] Error ensuring unconsumed stream output '${outputKey}' for node ${nodeIdentifier} ended:`, err.message);
            throw err;
          }));
        }
      }
    }
    // 3. 创建并管理流生命周期 Promise
    let batchResultResolver!: (value: Record<string, any> | void | PromiseLike<Record<string, any> | void>) => void;
    let batchResultRejector!: (reason?: any) => void;
    const batchDataPromise = new Promise<Record<string, any> | void>((resolve, reject) => {
      batchResultResolver = resolve;
      batchResultRejector = reject;
    });

    const streamLifecyclePromise = (async () => {
      let batchResult: Record<string, any> | void = undefined;
      let pullerError: any = null;
      let consumerError: any = null;

      // 4. 定义并启动生产者任务 (pullerTask)
      const pullerTask = (async () => {
        try {
          // 直接从生成器迭代并将数据写入源流
          for await (const chunk of nodeGenerator) {
            if (this.isInterrupted) {
              console.warn(`[Engine-${promptId}] PULLER_TASK: Interrupted during stream pulling for ${nodeIdentifier}.`);
              break; // 静默退出循环
            }
            if (!sourceStream.writable) {
              // 如果流不再可写（例如因为下游错误），则停止拉取
              console.warn(`[Engine-${promptId}] PULLER_TASK: sourceStream for ${nodeIdentifier} is not writable. Stopping pull.`);
              break;
            }
            sourceStream.write(chunk);
            // 如果节点产出的是错误块，则将其视为执行错误并以流的方式终止
            if (chunk.type === 'error_chunk') {
              const error = new Error(typeof chunk.content === 'string' ? chunk.content : 'Node yielded an error chunk.');
              // 使用 destroy 来优雅地关闭流并传播错误，而不是抛出异常
              // 这将触发所有下游消费者的 'error' 事件
              pullerError = error; // 标记存在错误，防止 finally 块中调用 end()
              if (sourceStream.writable) {
                sourceStream.destroy(error);
              }
              // 不需要再 throw，因为 destroy 会导致 consumerPromises reject,
              // 从而触发 streamLifecyclePromise 的 catch 块。
              // 跳出循环，因为流已经销毁。
              break;
            }
          }
          // nodeGenerator.return() 会返回生成器的最终值
          batchResult = await nodeGenerator.return();
        } catch (error: any) {
          console.error(`[Engine-${promptId}] Puller task for node ${nodeIdentifier} caught error:`, error.message);
          pullerError = error;
          // 直接销毁源流，这将向下游传播错误
          if (sourceStream.writable) {
            sourceStream.destroy(error);
          }
          // 重新抛出错误，以便 streamLifecyclePromise 可以捕获它
          throw error;
        } finally {
          // console.log(`[Engine-${promptId}] PULLER_TASK_FINALLY for node ${nodeIdentifier}.`);
          // 如果没有错误，则正常结束流
          if (!pullerError && sourceStream.writable) {
            sourceStream.end();
          }
        }
      })();

      // 5. 等待所有任务完成
      try {
        try {
          await pullerTask;
        } catch (err) {
          // pullerTask 已经处理了 sourceStream.destroy()，我们只需要确保 consumer 也完成了
          // 并且重新抛出错误以触发外层的 catch
          throw err;
        }
        
        if (consumerPromises.length > 0) {
          // Promise.all 会在第一个 promise 拒绝时立即拒绝
          await Promise.all(consumerPromises);
        }

        batchResultResolver(batchResult);
        this.nodeStates[nodeId] = ExecutionStatus.COMPLETE;
        const durationMs = Date.now() - nodeStartTime;
        const resultForLoggingAndEvent = (typeof batchResult === 'object' && batchResult !== null) ? batchResult : {};
        loggingService.logNodeComplete(nodeId, fullType, resultForLoggingAndEvent, durationMs)
          .catch(err => console.error(`[Engine-${promptId}] Failed to log stream node complete for ${nodeIdentifier}:`, err));
        this.sendNodeComplete(nodeId, resultForLoggingAndEvent);
      } catch (error: any) {
        console.error(`[Engine-${promptId}] streamLifecyclePromise for ${nodeIdentifier} caught error:`, error.message);
        batchResultRejector(error);

        const durationMs = Date.now() - nodeStartTime;
        const errorMessage = error.message || String(error);
        this.nodeStates[nodeId] = this.isInterrupted ? ExecutionStatus.INTERRUPTED : ExecutionStatus.ERROR;
        loggingService.logNodeError(nodeId, fullType, error, durationMs)
          .catch(err => console.error(`[Engine-${promptId}] Failed to log stream node error for ${nodeIdentifier}:`, err));
        this.sendNodeError(nodeId, errorMessage);
        // 重新抛出错误，以确保 streamLifecyclePromise 本身失败
        throw error;
      }
    })();
    this.backgroundTasks.push(streamLifecyclePromise);
    return { streams: streamOutputsToReturn, batchDataPromise };
  }


  private async consumeForEventBus(readable: Stream.Readable, nodeId: NanoId, promptId: NanoId): Promise<void> {
    const nodeInstance = this.nodes[nodeId];
    let nodeIdentifier: string;
    if (nodeInstance) {
      const definition = nodeManager.getNode(nodeInstance.fullType);
      nodeIdentifier = definition ? `${definition.displayName || definition.type}(${nodeId})` : `${nodeInstance.fullType}(${nodeId})`;
    } else {
      nodeIdentifier = `UnknownNode(${nodeId})`;
    }
    return new Promise((resolve, reject) => {
      readable.on('error', (err) => {
        console.error(`[Engine-${promptId}] consumeForEventBus for node '${nodeIdentifier}' caught error via 'error' event:`, err.message);
        loggingService.logStreamError(promptId, nodeId, err, 'NODE_YIELD')
          .catch(logErr => console.error(`[Engine-${promptId}] Failed to log NODE_YIELD error for ${nodeIdentifier}:`, logErr));
        const finalErrorPayload: NodeYieldPayload = {
          promptId,
          sourceNodeId: nodeId,
          yieldedContent: { type: 'error_chunk', content: `Stream consumption error: ${err.message}` },
          isLastChunk: true,
        };
        this.wsManager.publishToScene(promptId, 'NODE_YIELD', finalErrorPayload);
        reject(err); // This will reject the promise that streamLifecyclePromise is waiting for
      });

      readable.on('end', () => {
        resolve();
      });

      readable.on('close', () => {
        resolve();
      });

      readable.on('data', (chunk: ChunkPayload) => {
        const isLastChunk = chunk.type === 'finish_reason_chunk' || chunk.type === 'error_chunk';
        const payload: NodeYieldPayload = {
          promptId,
          sourceNodeId: nodeId,
          yieldedContent: chunk,
          isLastChunk: isLastChunk,
        };
        this.wsManager.publishToScene(promptId, 'NODE_YIELD', payload);
        loggingService.logStreamChunk(promptId, nodeId, chunk, isLastChunk, 'NODE_YIELD')
          .catch(err => console.error(`[Engine-${promptId}] Failed to log NODE_YIELD chunk for ${nodeIdentifier}:`, err));
      });

      // Ensure the stream is in flowing mode
      if (readable.isPaused()) {
        readable.resume();
      }
    });
  }
  private sendNodeComplete(nodeId: NanoId, output: any): void {
    const payload: NodeCompletePayload = {
      promptId: this.promptId,
      nodeId,
      output,
    };
    this.wsManager.publishToScene(this.promptId, 'NODE_COMPLETE', payload);
  }

  private handleBypassedNode(
    nodeDefinition: NodeDefinition,
    executionNode: ExecutionNode,
    currentInputs: Record<string, any>
  ): Record<string, any> {
    const pseudoOutputs: Record<string, any> = {};
    const { bypassBehavior } = nodeDefinition;
    const { id: nodeId, fullType } = executionNode;

    if (bypassBehavior === 'mute') {
      // console.log(`[Engine-${this.promptId}] Node ${executionNode.id} has 'mute' bypass behavior, setting all outputs to undefined.`);
      for (const outputKey in nodeDefinition.outputs) {
        pseudoOutputs[outputKey] = undefined;
      }
      return pseudoOutputs;
    }

    if (bypassBehavior && typeof bypassBehavior === 'object') {
      if (bypassBehavior.passThrough) {
        for (const [outputKey, inputKey] of Object.entries(bypassBehavior.passThrough)) {
          if (nodeDefinition.outputs[outputKey] && inputKey in currentInputs) {
            const outputDef = nodeDefinition.outputs[outputKey];
            const inputDef = nodeDefinition.inputs[inputKey as string]; // Cast as string
            if (this.isTypeCompatible(outputDef, inputDef)) {
              pseudoOutputs[outputKey] = currentInputs[inputKey as string];
            } else {
              console.warn(`[Engine-${this.promptId}] Type incompatibility in passThrough for node ${executionNode.id}: ${inputKey}->${outputKey}`);
              pseudoOutputs[outputKey] = undefined;
            }
          }
        }
      }
      if (bypassBehavior.defaults) {
        for (const [outputKey, defaultValue] of Object.entries(bypassBehavior.defaults)) {
          if (!(outputKey in pseudoOutputs)) {
            pseudoOutputs[outputKey] = defaultValue;
          }
        }
      }
      for (const outputKey in nodeDefinition.outputs) {
        if (!(outputKey in pseudoOutputs)) {
          pseudoOutputs[outputKey] = this.getGenericEmptyValueForType(nodeDefinition.outputs[outputKey].dataFlowType);
        }
      }
      return pseudoOutputs;
    }

    // console.log(`[Engine-${this.promptId}] Node ${executionNode.id} has no explicit bypass behavior, using default strategy.`);
    const inputSlotDefs = nodeDefinition.inputs || {};
    const outputSlotDefs = nodeDefinition.outputs || {};
    const availableInputKeys = Object.keys(currentInputs);

    for (const outputKey in outputSlotDefs) {
      const outputDef = outputSlotDefs[outputKey];
      let matched = false;
      for (let i = 0; i < availableInputKeys.length; i++) {
        const inputKey = availableInputKeys[i];
        const inputDef = inputSlotDefs[inputKey];
        if (inputDef && this.isTypeCompatible(outputDef, inputDef)) {
          pseudoOutputs[outputKey] = currentInputs[inputKey];
          availableInputKeys.splice(i, 1);
          matched = true;
          break;
        }
      }
      if (!matched) {
        pseudoOutputs[outputKey] = this.getGenericEmptyValueForType(outputDef.dataFlowType);
      }
    }
    loggingService.logNodeBypassed(nodeId, fullType, pseudoOutputs)
      .catch(err => console.error(`[Engine-${this.promptId}] Failed to log node bypassed for ${nodeId}:`, err));
    return pseudoOutputs;
  }

  private isDataFlowTypeCompatible(outputType: string, inputType: string): boolean {
    if (outputType === inputType) return true;
    // WILDCARD 和 CONVERTIBLE_ANY 是特殊情况，可以匹配任何数据流类型。
    if (outputType === DataFlowType.WILDCARD || outputType === DataFlowType.CONVERTIBLE_ANY ||
      inputType === DataFlowType.WILDCARD || inputType === DataFlowType.CONVERTIBLE_ANY) {
      return true;
    }
    // 从整数到浮点数的隐式转换
    if (outputType === DataFlowType.INTEGER && inputType === DataFlowType.FLOAT) return true;
    // 到字符串的隐式转换
    if (inputType === DataFlowType.STRING &&
      (outputType === DataFlowType.INTEGER || outputType === DataFlowType.FLOAT || outputType === DataFlowType.BOOLEAN)) {
      return true;
    }
    return false;
  }

  private isTypeCompatible(
    outputDef: { dataFlowType: string; isStream?: boolean; matchCategories?: string[] },
    inputDef: { dataFlowType: string; isStream?: boolean; matchCategories?: string[] }
  ): boolean {
    // 首先，检查流的兼容性。流只能连接到流。
    if (!!outputDef.isStream !== !!inputDef.isStream) {
      return false;
    }

    // 通配符行为会覆盖所有其他检查
    if (outputDef.matchCategories?.includes(BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD) ||
      inputDef.matchCategories?.includes(BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD)) {
      return true;
    }

    // 然后，检查语义类别。这里的匹配就足够了。
    if (outputDef.matchCategories?.length && inputDef.matchCategories?.length) {
      for (const category of outputDef.matchCategories) {
        if (inputDef.matchCategories.includes(category)) {
          return true;
        }
      }
    }

    // 最后，检查数据流类型的兼容性。
    return this.isDataFlowTypeCompatible(outputDef.dataFlowType, inputDef.dataFlowType);
  }

  private getGenericEmptyValueForType(dataFlowType: string): any {
    switch (dataFlowType) {
      case DataFlowType.STRING: return '';
      case DataFlowType.INTEGER: case DataFlowType.FLOAT: return 0;
      case DataFlowType.BOOLEAN: return false;
      case DataFlowType.ARRAY: return [];
      case DataFlowType.OBJECT: return {};
      case DataFlowType.BINARY: case DataFlowType.WILDCARD: case DataFlowType.CONVERTIBLE_ANY: default: return null;
    }
  }

  private sendNodeBypassed(nodeId: NanoId, pseudoOutputs: Record<string, any>): void {
    const payload = {
      promptId: this.promptId,
      nodeId,
      pseudoOutputs,
    };
    this.wsManager.publishToScene(this.promptId, 'NODE_BYPASSED', payload);
  }

  // 新增辅助函数：获取下游流连接
  private getDownstreamStreamConnections(sourceNodeId: NanoId, sourceOutputKey: string): ExecutionEdge[] {
    return this.edges.filter(edge =>
      edge.sourceNodeId === sourceNodeId &&
      edge.sourceHandle === sourceOutputKey
    );
  }

  private _handleStreamInterfaceOutput(
    interfaceKey: string,
    stream: Stream.Readable,
    interfaceDisplayName?: string
  ): Promise<void> {
    const taskPromise = (async () => {
      this.activeInterfaceStreamConsumers.add(interfaceKey);
      try {
        // 使用 for await...of 循环来安全、健壮地消费流
        for await (const chunk of stream) {
          if (this.isInterrupted) {
            console.warn(`[Engine-${this.promptId}] Interrupting data event for interface stream ${interfaceKey}`);
            if (!stream.destroyed) {
              stream.destroy();
            }
            // 中断后退出循环，finally 块会确保清理
            break;
          }
          const payload: WorkflowInterfaceYieldPayload = {
            promptId: this.promptId,
            interfaceOutputKey: interfaceKey,
            interfaceOutputDisplayName: interfaceDisplayName,
            yieldedContent: chunk as ChunkPayload,
            isLastChunk: false,
          };
          this.wsManager.publishToScene(this.promptId, WebSocketMessageType.WORKFLOW_INTERFACE_YIELD, payload);
          loggingService.logStreamChunk(this.promptId, interfaceKey as NanoId, chunk as ChunkPayload, false, 'INTERFACE_YIELD')
            .catch(logErr => console.error(`[Engine-${this.promptId}] Failed to log INTERFACE_YIELD chunk for ${interfaceKey}:`, logErr));
        }

        // 循环结束后，流已结束。如果不是被中断的，则发送最后一条消息。
        if (!this.isInterrupted) {
          const finalChunkContent: ChunkPayload = { type: 'finish_reason_chunk', content: 'Stream ended' };
          const payload: WorkflowInterfaceYieldPayload = {
            promptId: this.promptId,
            interfaceOutputKey: interfaceKey,
            interfaceOutputDisplayName: interfaceDisplayName,
            yieldedContent: finalChunkContent,
            isLastChunk: true,
          };
          this.wsManager.publishToScene(this.promptId, WebSocketMessageType.WORKFLOW_INTERFACE_YIELD, payload);
          loggingService.logStreamChunk(this.promptId, interfaceKey as NanoId, finalChunkContent, true, 'INTERFACE_YIELD')
            .catch(logErr => console.error(`[Engine-${this.promptId}] Failed to log final INTERFACE_YIELD chunk for ${interfaceKey}:`, logErr));
        }
      } catch (err: any) {
        console.error(`[Engine-${this.promptId}] Error consuming stream for interface output ${interfaceKey}:`, err.message);
        loggingService.logStreamError(this.promptId, interfaceKey as NanoId, err, 'INTERFACE_YIELD')
          .catch(logErr => console.error(`[Engine-${this.promptId}] Failed to log INTERFACE_YIELD error for ${interfaceKey}:`, logErr));
        // 重新抛出错误，以便 Promise.all 可以捕获它，除非是可控的中断
        if (err.message !== 'Interrupted by user') {
          throw err;
        }
      } finally {
        // 无论成功、失败还是中断，最终都从活动消费者集合中移除
        this.activeInterfaceStreamConsumers.delete(interfaceKey);
      }
    })();

    this.backgroundTasks.push(taskPromise);
    return taskPromise;
  }

  private async _processAndBroadcastFinalOutputs(): Promise<void> {
    if (!this.payload.outputInterfaceMappings || Object.keys(this.payload.outputInterfaceMappings).length === 0) {
      return;
    }

    const finalWorkflowOutputs: Record<string, InterfaceOutputValue> = {};
    const batchPromisesMap: Map<string, Promise<any>> = new Map(); // 用于存储批处理Promise及其接口键

    // 阶段1: 识别流并启动它们，收集批处理Promise
    for (const interfaceOutputKey in this.payload.outputInterfaceMappings) {
      if (this.isInterrupted) {
        // console.log(`[Engine-${this.promptId}] Interrupted during interface output processing for ${interfaceOutputKey}.`);
        finalWorkflowOutputs[interfaceOutputKey] = undefined; // Or a specific interruption marker
        continue;
      }

      const mapping = this.payload.outputInterfaceMappings[interfaceOutputKey];
      if (!mapping) {
        console.warn(`[Engine-${this.promptId}] No mapping for interfaceOutputKey: ${interfaceOutputKey}.`);
        finalWorkflowOutputs[interfaceOutputKey] = undefined;
        continue;
      }

      const { sourceNodeId, sourceSlotKey } = mapping;
      const sourceNodeResult = this.nodeResults[sourceNodeId];
      const interfaceDef = this.interfaceOutputDefinitions?.[interfaceOutputKey];
      const interfaceDisplayName = interfaceDef?.displayName;

      if (sourceNodeResult && sourceSlotKey in sourceNodeResult) {
        const rawValue = sourceNodeResult[sourceSlotKey];

        if (interfaceDef?.isStream && rawValue instanceof Stream.Readable) {
          // console.log(`[Engine-${this.promptId}] Starting STREAM interface output: ${interfaceOutputKey} ('${interfaceDisplayName || ''}')`);
          this._handleStreamInterfaceOutput(interfaceOutputKey, rawValue, interfaceDisplayName);
          finalWorkflowOutputs[interfaceOutputKey] = {
            type: 'stream_placeholder',
            message: `Stream started for ${interfaceOutputKey} (${interfaceDisplayName || ''})`,
          };
        } else if (rawValue instanceof Promise) {
          // console.log(`[Engine-${this.promptId}] Identified Promise for batch interface output: ${interfaceOutputKey} ('${interfaceDisplayName || ''}')`);
          batchPromisesMap.set(interfaceOutputKey, rawValue);
          finalWorkflowOutputs[interfaceOutputKey] = undefined; // 初始占位，后续会被真实值替换
        } else {
          // console.log(`[Engine-${this.promptId}] Direct value for interface output: ${interfaceOutputKey} ('${interfaceDisplayName || ''}')`);
          finalWorkflowOutputs[interfaceOutputKey] = rawValue;
        }
      } else {
        console.warn(`[Engine-${this.promptId}] Source for interface output ${interfaceOutputKey} (node: ${sourceNodeId}, slot: ${sourceSlotKey}) not found in nodeResults.`);
        finalWorkflowOutputs[interfaceOutputKey] = undefined;
      }
    }

    // 阶段2: 等待所有收集到的批处理Promise完成
    if (batchPromisesMap.size > 0) {
      // console.log(`[Engine-${this.promptId}] Waiting for ${batchPromisesMap.size} batch interface promises...`);
      const promiseKeys = Array.from(batchPromisesMap.keys());
      const promisesToAwait = promiseKeys.map(key =>
        batchPromisesMap.get(key)!
          .then(resolvedValue => ({ key, value: resolvedValue, status: 'fulfilled' as const }))
          .catch(error => {
            console.error(`[Engine-${this.promptId}] Error resolving promise for batch interface output ${key}:`, error.message);
            return { key, value: undefined, status: 'rejected' as const, error };
          })
      );

      try {
        const settledResults = await Promise.all(promisesToAwait);
        settledResults.forEach(result => {
          if (result.status === 'fulfilled') {
            finalWorkflowOutputs[result.key] = result.value;
            // console.log(`[Engine-${this.promptId}] Batch interface output ${result.key} resolved successfully.`);
          } else {
            // 对于 rejected 的 Promise，我们已经在上面 catch 中记录了错误，这里可以决定是否用特定错误标记覆盖 finalWorkflowOutputs
            finalWorkflowOutputs[result.key] = { type: 'error_placeholder', message: `Error resolving batch output: ${result.error?.message || 'Unknown error'}` };
            // console.warn(`[Engine-${this.promptId}] Batch interface output ${result.key} failed to resolve.`);
          }
        });
      } catch (error) {
        // Promise.all 本身配置为不 fail-fast (因为我们用了 .then/.catch 包装)，所以理论上不应到这里。
        // 但以防万一，记录一个通用错误。
        console.error(`[Engine-${this.promptId}] Unexpected error in Promise.allSettled-like logic for batch outputs:`, error);
      }
      // console.log(`[Engine-${this.promptId}] All batch interface promises have been processed.`);
    }

    // 阶段3: 发送最终的接口输出（包含已解析的批处理值和流的占位符）
    if (Object.keys(finalWorkflowOutputs).length > 0 && !this.isInterrupted) {
      this.sendNodeComplete('__WORKFLOW_INTERFACE_OUTPUTS__', finalWorkflowOutputs);
      // console.log(`[Engine-${this.promptId}] Sent final aggregated workflow interface outputs:`, this.sanitizeObjectForLogging(finalWorkflowOutputs));
    } else if (this.isInterrupted) {
      // console.log(`[Engine-${this.promptId}] Final aggregated workflow interface outputs not sent due to interruption.`);
    }
  }

  /**
   * 标记指定节点的所有下游节点为特定状态（通常是 SKIPPED 或 INTERRUPTED）。
   * @param startNodeId 起始节点ID
   * @param statusToSet 要设置的状态
   */
  private skipDescendants(startNodeId: NanoId, statusToSet: ExecutionStatus.SKIPPED | ExecutionStatus.INTERRUPTED | ExecutionStatus.ERROR): void {
    const queue: NanoId[] = [startNodeId];
    const visited: Set<NanoId> = new Set([startNodeId]); // 防止在环路中无限循环（尽管拓扑排序应该避免环）

    // 注意：我们不应该改变 startNodeId 自身的状态，因为它可能已经是 ERROR 或正在被处理。
    // 这个方法主要用于处理其 *下游* 节点。
    // 因此，我们从 startNodeId 的直接子节点开始。

    const initialChildren = this.adj[startNodeId] || [];
    queue.splice(0, queue.length, ...initialChildren); // 替换队列内容为直接子节点
    initialChildren.forEach(childId => visited.add(childId));

    while (queue.length > 0) {
      const currentNodeId = queue.shift()!;

      // 只有当节点当前状态不是更严重的错误或已完成时才更新
      if (
        this.nodeStates[currentNodeId] !== ExecutionStatus.ERROR &&
        this.nodeStates[currentNodeId] !== ExecutionStatus.COMPLETE &&
        this.nodeStates[currentNodeId] !== ExecutionStatus.INTERRUPTED // 如果已经是 INTERRUPTED，则不应被 SKIPPED 覆盖
      ) {
        if (statusToSet === ExecutionStatus.INTERRUPTED || this.nodeStates[currentNodeId] !== ExecutionStatus.SKIPPED) { // INTERRUPTED 优先，或者当前不是 SKIPPED
          this.nodeStates[currentNodeId] = statusToSet;
          console.log(`[Engine-${this.promptId}] Marking descendant node ${currentNodeId} as ${statusToSet} due to upstream failure/interruption.`);
          // 根据需要，可以发送一个 NODE_SKIPPED 或类似的消息给客户端
          if (statusToSet === ExecutionStatus.SKIPPED) {
            this.sendNodeSkipped(currentNodeId, `Skipped due to upstream node failure.`);
          } else if (statusToSet === ExecutionStatus.INTERRUPTED) {
            // 通常中断消息由引擎或节点自身发出，这里主要是状态标记
          }
        }
      }

      const neighbors = this.adj[currentNodeId] || [];
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
    }
  }

  // 辅助方法，用于发送节点跳过状态 (如果需要)
  private sendNodeSkipped(nodeId: NanoId, reason: string): void {
    // 根据用户反馈，将“跳过”事件作为一种特定类型的“错误”记录到日志中。
    // 我们将构造一个 error-like 对象来传递给 logNodeError。
    const skipError = {
      name: 'NodeSkippedError', // 自定义错误名称
      message: `Node ${nodeId} was skipped. Reason: ${reason}`,
      details: {
        nodeId,
        nodeType: this.nodes[nodeId]?.fullType || 'UnknownType',
        reason,
      }
    };
    // 调用 logNodeError，durationMs 可以为 undefined 或 0
    loggingService.logNodeError(nodeId, this.nodes[nodeId]?.fullType || 'UnknownType', skipError)
      .catch((err: any) => console.error(`[Engine-${this.promptId}] Failed to log node skipped (as error) for ${nodeId}:`, err));

    // 如果未来需要明确区分 skipped 和 error 的 WebSocket 消息，可以在这里添加
    // 例如: this.wsManager.broadcast('NODE_SKIPPED', { promptId: this.promptId, nodeId, reason });
  }
}