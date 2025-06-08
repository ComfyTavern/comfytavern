import fs from 'fs/promises';
import path from 'path';
import { Stream } from 'node:stream'; // 用于 instanceof 检查
import { NanoId, ExecutionStatus, WorkflowExecutionPayload, ChunkPayload } from '@comfytavern/types'; // 添加了 ChunkPayload
import { LOG_DIR } from '../config'; // 从 config.ts 导入日志目录

interface LogEntry {
  timestamp: string;
  promptId: NanoId;
  level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG';
  event: string; // 例如: 'WORKFLOW_EXECUTION_START', 'NODE_EXECUTION_START'
  message: string;
  details?: any;
}

class LoggingServiceController {
  private logFilePath: string | null = null;
  private currentPromptId: NanoId | null = null;
  private executionStartTime: number | null = null;

  constructor() {
    this.ensureBaseLogDir(); // 实例化时确保基础日志目录存在
  }

  private async ensureBaseLogDir(): Promise<void> {
    try {
      await fs.mkdir(LOG_DIR, { recursive: true });
      // console.log(`[LoggingService] 基础日志目录已确保: ${LOG_DIR}`);
    } catch (error) {
      console.error('[LoggingService] 创建基础日志目录失败:', LOG_DIR, error);
    }
  }

  public async initializeExecutionLog(promptId: NanoId, payload?: WorkflowExecutionPayload): Promise<void> {
    this.currentPromptId = promptId;
    this.executionStartTime = Date.now();
    const date = new Date(this.executionStartTime);
    // 格式化日期为 YYYY-MM-DD
    const dateString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    // 格式化时间为 HH-MM-SS
    const timeString = `${date.getHours().toString().padStart(2, '0')}-${date.getMinutes().toString().padStart(2, '0')}-${date.getSeconds().toString().padStart(2, '0')}`;

    const executionLogDir = path.join(LOG_DIR, dateString);
    try {
      await fs.mkdir(executionLogDir, { recursive: true });
      this.logFilePath = path.join(executionLogDir, `execution-${promptId}-${timeString}.log`);
      // console.log(`[LoggingService] Prompt ${promptId} 的日志文件已初始化: ${this.logFilePath}`);

      const initialLog: LogEntry = {
        timestamp: new Date(this.executionStartTime).toISOString(),
        promptId,
        level: 'INFO',
        event: 'WORKFLOW_EXECUTION_START',
        message: `PromptId: ${promptId} 的工作流执行开始`,
        details: payload ? {
          nodeCount: payload.nodes.length,
          edgeCount: payload.edges.length,
          hasInterfaceInputs: !!payload.interfaceInputs,
          hasInterfaceOutputs: !!payload.interfaceOutputs,
        } : {}
      };
      await this.writeLog(initialLog);
    } catch (error) {
      console.error(`[LoggingService] 初始化 Prompt ${promptId} 的执行日志失败:`, error);
      this.logFilePath = null; // 初始化失败时确保 logFilePath 为 null
    }
  }

  private async writeLog(entry: LogEntry): Promise<void> {
    if (!this.logFilePath) {
      // 如果文件路径未设置 (例如初始化失败)，则回退到控制台
      console.error('[LoggingService] 日志文件路径未初始化。日志条目 (输出到控制台):', JSON.stringify(entry));
      return;
    }
    try {
      const logString = JSON.stringify(entry) + '\n';
      await fs.appendFile(this.logFilePath, logString);
    } catch (error) {
      console.error('[LoggingService] 写入日志文件失败:', this.logFilePath, error, '条目:', JSON.stringify(entry).substring(0, 200));
    }
  }

  public async logNodeStart(nodeId: NanoId, nodeType: string, inputs: any): Promise<void> {
    if (!this.currentPromptId) return;
    await this.writeLog({
      timestamp: new Date().toISOString(),
      promptId: this.currentPromptId,
      level: 'DEBUG', // 调整为 DEBUG 级别，因为它可能很详细
      event: 'NODE_EXECUTION_START',
      message: `节点 ${nodeId} (${nodeType}) 开始执行。`,
      details: { nodeId, nodeType, inputs: this.sanitizeForLog(inputs) }
    });
  }

  public async logNodeComplete(nodeId: NanoId, nodeType: string, output: any, durationMs: number): Promise<void> {
    if (!this.currentPromptId) return;
    await this.writeLog({
      timestamp: new Date().toISOString(),
      promptId: this.currentPromptId,
      level: 'INFO',
      event: 'NODE_EXECUTION_COMPLETE',
      message: `节点 ${nodeId} (${nodeType}) 执行完成，耗时 ${durationMs}ms。`,
      details: { nodeId, nodeType, output: this.sanitizeForLog(output), durationMs }
    });
  }

  public async logNodeBypassed(nodeId: NanoId, nodeType: string, pseudoOutputs: any): Promise<void> {
    if (!this.currentPromptId) return;
    await this.writeLog({
      timestamp: new Date().toISOString(),
      promptId: this.currentPromptId,
      level: 'INFO',
      event: 'NODE_BYPASSED',
      message: `节点 ${nodeId} (${nodeType}) 被绕过。`,
      details: { nodeId, nodeType, pseudoOutputs: this.sanitizeForLog(pseudoOutputs) }
    });
  }

  public async logNodeError(nodeId: NanoId, nodeType: string, error: any, durationMs?: number): Promise<void> {
    if (!this.currentPromptId) return;
    await this.writeLog({
      timestamp: new Date().toISOString(),
      promptId: this.currentPromptId,
      level: 'ERROR',
      event: 'NODE_EXECUTION_ERROR',
      message: `节点 ${nodeId} (${nodeType}) 执行失败。${durationMs ? `耗时: ${durationMs}ms.` : ''}`,
      details: { nodeId, nodeType, error: this.sanitizeErrorForLog(error), durationMs }
    });
  }

  public async logWorkflowEnd(status: ExecutionStatus, error?: any): Promise<void> {
    if (!this.currentPromptId || !this.executionStartTime) return;
    const durationMs = Date.now() - this.executionStartTime;
    const finalLogEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      promptId: this.currentPromptId,
      level: status === ExecutionStatus.COMPLETE ? 'INFO' : (status === ExecutionStatus.INTERRUPTED ? 'WARN' : 'ERROR'),
      event: 'WORKFLOW_EXECUTION_END',
      message: `PromptId ${this.currentPromptId} 的工作流执行结束，状态: ${status}，耗时 ${durationMs}ms。`,
      details: { status, durationMs, error: error ? this.sanitizeErrorForLog(error) : undefined }
    };
    await this.writeLog(finalLogEntry);

    // console.log(`[LoggingService] Prompt ${this.currentPromptId} 的工作流日志已结束。路径: ${this.logFilePath}`);
    // 如果服务被重用 (虽然通常每个执行一个引擎实例)，则重置
    this.currentPromptId = null;
    this.logFilePath = null;
    this.executionStartTime = null;
  }

  public async logInterrupt(promptId?: NanoId): Promise<void> { // 如果 currentPromptId 尚未设置，允许传递 promptId
    const pid = promptId || this.currentPromptId;
    if (!pid) return;
    await this.writeLog({
      timestamp: new Date().toISOString(),
      promptId: pid,
      level: 'WARN',
      event: 'WORKFLOW_INTERRUPTED_SIGNAL', // 更具体的事件名称
      message: `PromptId ${pid} 的工作流执行收到中断信号。`,
      details: {}
    });
  }

  public async logStreamChunk(promptId: NanoId, sourceNodeId: NanoId, chunk: ChunkPayload, isLast: boolean, target: 'NODE_YIELD' | 'INTERFACE_YIELD'): Promise<void> {
    await this.writeLog({
      timestamp: new Date().toISOString(),
      promptId,
      level: 'DEBUG',
      event: target,
      message: `${target} from ${sourceNodeId}: ${isLast ? '最后一块数据' : '收到数据块'}。`,
      details: { sourceNodeId, chunk: this.sanitizeForLog(chunk), isLast }
    });
  }

  public async logStreamError(promptId: NanoId, sourceNodeId: NanoId, error: any, target: 'NODE_YIELD' | 'INTERFACE_YIELD'): Promise<void> {
    await this.writeLog({
      timestamp: new Date().toISOString(),
      promptId,
      level: 'ERROR',
      event: `${target}_ERROR`,
      message: `${target} stream from ${sourceNodeId} 遇到错误。`,
      details: { sourceNodeId, error: this.sanitizeErrorForLog(error) }
    });
  }

  // 基本的清理函数，可以扩展
  private sanitizeForLog(data: any, maxLength: number = 200, depth = 0, maxDepth = 5): any {
    if (depth > maxDepth) {
      return '[达到最大深度]';
    }
    if (data === undefined) return undefined;
    if (data === null) return null;

    if (typeof data === 'string') {
      return data.length > maxLength ? `${data.substring(0, maxLength)}... (长度:${data.length})` : data;
    }
    if (typeof data === 'number' || typeof data === 'boolean') {
      return data;
    }
    if (Buffer.isBuffer(data)) {
      return `Buffer (长度: ${data.length}, hex: ${data.slice(0, 10).toString('hex')}...)`;
    }
    if (data instanceof Stream.Stream) { // 更通用的 Stream 基类检查
      let readableInfo = 'N/A';
      let writableInfo = 'N/A';
      if ('readable' in data && typeof (data as any).readable === 'boolean') {
        readableInfo = String((data as any).readable);
      }
      if ('writable' in data && typeof (data as any).writable === 'boolean') {
        writableInfo = String((data as any).writable);
      }
      return `Stream (类型: ${data.constructor.name}, 可读: ${readableInfo}, 可写: ${writableInfo})`;
    }
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeForLog(item, maxLength, depth + 1, maxDepth));
    }
    if (typeof data === 'object') {
      const newObj: any = {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          // 常见的敏感键或大数据键
          if (key.toLowerCase().includes('token') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('apikey') || key.toLowerCase().includes('password')) {
            newObj[key] = '***已隐藏***';
          } else if ((key === 'system_prompt' || key === 'system_message' || key === 'prompt' || key.includes('content')) && typeof data[key] === 'string' && data[key].length > 500) {
            newObj[key] = `${(data[key] as string).substring(0, 100)}... (省略，原始长度: ${(data[key] as string).length})`;
          } else {
            newObj[key] = this.sanitizeForLog(data[key], maxLength, depth + 1, maxDepth);
          }
        }
      }
      return newObj;
    }
    return String(data); // 其他类型的回退处理
  }

  private sanitizeErrorForLog(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        // 截断堆栈信息
        stack: error.stack ? error.stack.split('\n').slice(0, 7).join('\n') + '...' : undefined,
      };
    }
    return this.sanitizeForLog(error);
  }
}

// 导出一个单例实例
export const loggingService = new LoggingServiceController();