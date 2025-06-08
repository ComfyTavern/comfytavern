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
    this.buffer.push(chunk);
    this.tryResolveWaiting();
  }

  signalEnd(): void {
    if (!this.isDone) {
      this.isDone = true;
      this.tryResolveWaiting();
    }
  }

  signalError(error: any): void {
    if (!this.isDone) {
      this.isDone = true;
      this.error = error;
      // 立即 reject 所有等待者
      while (this.waitingResolvers.length > 0) {
        this.waitingResolvers.shift()!.reject(this.error);
      }
      // this.tryResolveWaiting(); // tryResolveWaiting 也会被其他地方调用，这里确保错误优先传播
    }
  }

  private tryResolveWaiting(): void {
    while (this.waitingResolvers.length > 0) {
      const callbacks = this.waitingResolvers.shift()!; // 改为 callbacks
      if (this.isDone && this.error) { // 优先处理错误
        callbacks.reject(this.error); // <<< 关键：调用 reject
        continue; // 处理下一个等待者
      }
      if (this.buffer.length > 0) {
        callbacks.resolve({ value: this.buffer.shift()!, done: false });
      } else if (this.isDone) {
        // 此时 this.error 必然为 null (因为上面已经处理了 error 情况)
        callbacks.resolve({ value: undefined, done: true });
      } else {
        this.waitingResolvers.unshift(callbacks); // 放回去
        break;
      }
    }
  }

  [Symbol.asyncIterator](): AsyncGenerator<T, void, undefined> {
    const next = (): Promise<IteratorResult<T>> => {
      return new Promise<IteratorResult<T>>((resolve, reject) => { // Modified to allow rejection
        if (this.buffer.length > 0) {
          resolve({ value: this.buffer.shift()!, done: false });
        } else if (this.isDone) {
          if (this.error) {
            // This will cause the for-await-of loop to throw.
            reject(this.error); // Reject the promise if there's an error
          } else {
            resolve({ value: undefined, done: true });
          }
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
export class ExecutionEngine {
  private promptId: NanoId;
  private payload: WorkflowExecutionPayload;
  private wsManager: WebSocketManager;
  // private outputManager: OutputManager; // TODO: Inject OutputManager
  // private historyService: HistoryService; // TODO: Inject HistoryService

  private nodes: Record<NanoId, ExecutionNode> = {};
  private edges: ExecutionEdge[] = [];
  private nodeStates: Record<NanoId, ExecutionStatus> = {};
  private nodeResults: Record<NanoId, any> = {}; // 存储节点输出 { [outputKey]: value }
  private nodePseudoOutputs: Record<NanoId, any> = {}; // 存储绕过节点的伪输出
  private executionOrder: NanoId[] = [];
  private isInterrupted: boolean = false;
  private backgroundTasks: Promise<any>[] = []; // 用于追踪所有后台任务，包括节点内部流和接口流
  private interfaceOutputDefinitions: Record<string, GroupSlotInfo> | undefined; // Corrected type
  private activeInterfaceStreamConsumers: Set<string> = new Set(); // Tracks interfaceOutputKeys

  constructor(
    promptId: NanoId,
    payload: WorkflowExecutionPayload,
    wsManager: WebSocketManager
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
  public async run(): Promise<{ status: ExecutionStatus.COMPLETE | ExecutionStatus.ERROR | ExecutionStatus.INTERRUPTED; error?: any }> {
    console.log(`\n\n\n\x1b[32m[Engine-${this.promptId}]----- Starting full execution | 开始执行完整工作流 ----\x1b[0m\n\n\n`);
    this.isInterrupted = false;
    this.backgroundTasks = []; // 重置后台任务列表

    try {
      this.executionOrder = this.topologicalSort(this.nodes, this.edges);
      // console.log(`[Engine-${this.promptId}] Execution order:`, this.executionOrder);

      for (const nodeId of this.executionOrder) {
        if (this.isInterrupted) {
          console.log(`[Engine-${this.promptId}] Execution interrupted before node ${nodeId}.`);
          throw new Error('Execution interrupted by user.');
        }

        const node = this.nodes[nodeId];
        if (node?.bypassed === true) {
          console.log(`[Engine-${this.promptId}] Node ${nodeId} is bypassed, handling bypass logic...`);
          try {
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
          } catch (error: any) {
            console.error(`[Engine-${this.promptId}] Error processing bypassed node ${nodeId}:`, error);
            this.sendNodeError(nodeId, `Error in bypass processing: ${error.message}`);
            return { status: ExecutionStatus.ERROR, error: error.message || String(error) };
          }
        }

        const inputs = this.prepareNodeInputs(nodeId);
        const result = await this.executeNode(nodeId, inputs); // executeNode 现在对于流式节点会立即返回

        if (result.status === ExecutionStatus.ERROR) {
          console.error(`[Engine-${this.promptId}] Workflow execution stopped due to error in node ${nodeId}`);
          return { status: ExecutionStatus.ERROR, error: result.error };
        }
        if (result.status === ExecutionStatus.INTERRUPTED) {
          console.log(`[Engine-${this.promptId}] Workflow execution interrupted during node ${nodeId}`);
          return { status: ExecutionStatus.INTERRUPTED };
        }
      }

      // 1. 启动接口输出流处理 (它会将接口消费者的 Promise 添加到 this.backgroundTasks)
      //    必须在等待任何 backgroundTasks 之前调用，以确保所有消费者都已启动！
      //    _processAndBroadcastFinalOutputs 内部会调用 _handleStreamInterfaceOutput,
      //    后者将 Promise 加入 this.backgroundTasks 并开始消费。
       console.log(`[Engine-${this.promptId}] Starting interface output processing...`);
      await this._processAndBroadcastFinalOutputs();
       console.log(`[Engine-${this.promptId}] Interface output processing started. Background tasks count: ${this.backgroundTasks.length}`);


      // 2. 等待所有后台任务 (包括所有节点的 streamLifecyclePromise 和所有接口的 _handleStreamInterfaceOutput Promise)
       const allBackgroundPromises = [...this.backgroundTasks]; // 复制
       if (allBackgroundPromises.length > 0) {
          console.log(`[Engine-${this.promptId}] Waiting for ALL ${allBackgroundPromises.length} background tasks (node streams + interface streams) to complete...`);
          // 这里会等待所有生产者和消费者完成
          await Promise.all(allBackgroundPromises);
          console.log(`[Engine-${this.promptId}] ALL background tasks completed.`);
       }
      
      // 移除原有的 阶段1 / 阶段3 的 Promise.all 和 this.backgroundTasks = []

      if (this.activeInterfaceStreamConsumers.size === 0 && this.isInterrupted === false) {
        console.log(`[Engine-${this.promptId}] Workflow execution completed successfully (all nodes, internal streams, and interface streams processed).`);
        return { status: ExecutionStatus.COMPLETE };
      } else if (this.isInterrupted) {
        console.log(`[Engine-${this.promptId}] Workflow execution was interrupted before all interface streams could complete.`);
        // Error status will be handled by the main catch block if an interruption error was thrown.
        // If interruption happened cleanly, this might be INTERRUPTED.
        // The main catch block handles the final status.
        throw new Error('Execution interrupted by user during final output streaming.');
      } else {
        // Should not happen if logic is correct, implies some interface streams didn't clear from activeInterfaceStreamConsumers
        console.error(`[Engine-${this.promptId}] Workflow completed processing, but ${this.activeInterfaceStreamConsumers.size} interface streams are still marked active. This indicates a potential issue.`);
        return { status: ExecutionStatus.ERROR, error: "Interface stream completion tracking error." };
      }

    } catch (error: any) {
      console.error(`[Engine-${this.promptId}] Workflow execution failed:`, error);
      const finalStatus = this.isInterrupted ? ExecutionStatus.INTERRUPTED : ExecutionStatus.ERROR;
      return { status: finalStatus, error: error.message || String(error) };
    }
  }

  public interrupt(): boolean {
    if (!this.isInterrupted) {
      console.log(`[Engine-${this.promptId}] Received interrupt signal.`);
      this.isInterrupted = true;
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

  private prepareNodeInputs(nodeId: NanoId): Record<string, any> {
    const inputs: Record<string, any> = {};
    const node = this.nodes[nodeId];

    // console.log(`[Engine-${this.promptId}] prepareNodeInputs for ${nodeId}. Node config inputs: ${JSON.stringify(this.sanitizeObjectForLogging(node?.inputs))}, inputConnectionOrders: ${JSON.stringify((node as any)?.inputConnectionOrders)}`);

    if (!node) {
      console.warn(`[Engine-${this.promptId}] Node ${nodeId} not found during input preparation.`);
      return {};
    }
    const definition = nodeManager.getNode(node.fullType);
    if (!definition || !definition.inputs) {
      return {};
    }

    const multiInputBuffer: Record<string, Array<{ edgeId: string, value: any }>> = {};

    this.edges.forEach(edge => {
      if (edge.targetNodeId === nodeId) {
        const sourceNodeId = edge.sourceNodeId;
        const sourceOutputKey = edge.sourceHandle;
        const rawTargetInputKey = edge.targetHandle;

        if (sourceNodeId && sourceOutputKey && rawTargetInputKey) {
          const sourceResult = this.nodeResults[sourceNodeId];
          const sourceNodeState = this.nodeStates[sourceNodeId];
          // 流式节点的状态可能是 RUNNING，但其流输出已经可用
          const isSourceReady = sourceNodeState === ExecutionStatus.COMPLETE ||
            sourceNodeState === ExecutionStatus.SKIPPED ||
            (sourceNodeState === ExecutionStatus.RUNNING && sourceResult && sourceResult[sourceOutputKey] instanceof Stream.Readable);


          if (isSourceReady && sourceResult) {
            const sourceValue = sourceResult[sourceOutputKey];
            const { originalKey: actualInputKey } = parseSubHandleId(rawTargetInputKey);
            const inputDef = definition.inputs[actualInputKey];

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
            const inputDef = definition.inputs[actualInputKey];
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
    });

    // console.log(`[Engine-${this.promptId}] After collecting connected inputs for ${nodeId}:`);
    // console.log(`  multiInputBuffer: ${JSON.stringify(multiInputBuffer)}`);
    // console.log(`  inputs (from single connections): ${JSON.stringify(this.sanitizeObjectForLogging(inputs))}`);

    const currentInputConnectionOrders = (node as any).inputConnectionOrders as Record<string, string[]> | undefined;
    if (currentInputConnectionOrders) {
      for (const originalInputKey in currentInputConnectionOrders) {
        const inputDef = definition.inputs[originalInputKey];
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
          const inputDef = definition.inputs[inputKey];
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

    for (const inputKey in definition.inputs) {
      if (inputs[inputKey] === undefined && definition.inputs[inputKey].config?.default !== undefined) {
        const inputDef = definition.inputs[inputKey];
        const defaultValue = inputDef.config!.default;
        if (inputDef.multi && !Array.isArray(defaultValue)) {
          inputs[inputKey] = defaultValue;
        } else {
          inputs[inputKey] = defaultValue;
        }
      }
    }

    for (const inputKey in definition.inputs) {
      const inputDef = definition.inputs[inputKey];
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
            if (sourceNodeDef && Object.values(sourceNodeDef.outputs || {}).some(out => out.dataFlowType === DataFlowType.STREAM) && sourceNodeState === ExecutionStatus.RUNNING) {
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
    this.wsManager.broadcast('NODE_ERROR', payload);
  }

  private async executeNode(
    nodeId: NanoId,
    inputs: Record<string, any>
  ): Promise<{ status: ExecutionStatus; error?: any }> {
    const node = this.nodes[nodeId];
    if (!node) {
      const errorMsg = `Node with ID ${nodeId} not found in engine.`;
      this.sendNodeError(nodeId, errorMsg);
      return { status: ExecutionStatus.ERROR, error: errorMsg };
    }
    const definition = nodeManager.getNode(node.fullType);

    if (!definition || !definition.execute) {
      const errorMsg = `Node type ${node.fullType} not found or not executable.`;
      this.sendNodeError(nodeId, errorMsg);
      return { status: ExecutionStatus.ERROR, error: errorMsg };
    }

    this.nodeStates[nodeId] = ExecutionStatus.RUNNING;
    const executingPayload: NodeExecutingPayload = { promptId: this.promptId, nodeId };
    this.wsManager.broadcast('NODE_EXECUTING', executingPayload);
    console.log(`[Engine-${this.promptId}] Executing node ${nodeId} (${node.fullType})...`);

    try {
      if (this.isInterrupted) {
        throw new Error('Execution interrupted by user.');
      }

      const context = {
        promptId: this.promptId,
        nodeId: nodeId, // <--- 添加 nodeId 到 context
        workflowInterfaceInputs: this.payload.interfaceInputs,
        workflowInterfaceOutputs: this.payload.interfaceOutputs,
      };

      const executeFn = definition.execute;
      const hasStreamOutput = Object.values(definition.outputs || {}).some(
        output => output.dataFlowType === DataFlowType.STREAM
      );

      if (hasStreamOutput) {
        // console.log(`[Engine-${this.promptId}] Node ${nodeId} has stream output(s). Starting stream execution in background.`);
        const nodeGenerator = executeFn(inputs, context) as AsyncGenerator<ChunkPayload, Record<string, any> | void, undefined>;

        const streamOutputs = this.startStreamNodeExecution(node, nodeGenerator, definition, context);

        // 立即存储流实例，让下游可以访问
        // 批处理结果将在流结束后由 startStreamNodeExecution 内部处理并更新到 nodeResults
        this.nodeResults[nodeId] = { ...streamOutputs };
        // 状态保持 RUNNING，直到后台任务完成并更新为 COMPLETE

        // 对于 executeNode 来说，启动流式任务已完成，可以继续主循环
        return { status: ExecutionStatus.COMPLETE }; // Or RUNNING if we want to be more precise about the node's state from executeNode's perspective

      } else {
        // console.log(`[Engine-${this.promptId}] Node ${nodeId} is a batch node. Handling with standard await.`);
        const result = await (executeFn(inputs, context) as Promise<Record<string, any>>);

        if (this.isInterrupted) {
          throw new Error('Execution interrupted by user.');
        }

        this.nodeResults[nodeId] = result || {};
        this.nodeStates[nodeId] = ExecutionStatus.COMPLETE;
        this.sendNodeComplete(nodeId, result || {});
        console.log(`[Engine-${this.promptId}] Node ${nodeId} completed.`);
        return { status: ExecutionStatus.COMPLETE };
      }

    } catch (error: any) {
      const errorMessage = error.message || String(error);
      console.error(`[Engine-${this.promptId}] Error executing node ${nodeId} (${node.fullType}):`, errorMessage, error.stack);
      this.nodeStates[nodeId] = this.isInterrupted ? ExecutionStatus.INTERRUPTED : ExecutionStatus.ERROR;
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
    context: { promptId: NanoId;[key: string]: any }
  ): Record<string, Stream.Readable> {
    const { id: nodeId, fullType } = node;
    const nodeIdentifier = `${definition.displayName || definition.type}(${nodeId})`;
    const { promptId } = context;

    const buffer = new BoundedBuffer<ChunkPayload>({ limit: 1000 }); // 可配置
    const sourceStream = Stream.Readable.from(buffer, { objectMode: true });

    const streamOutputsToReturn: Record<string, Stream.Readable> = {};
    const consumerPromises: Promise<any>[] = [];

    // DEBUG 日志
    sourceStream.on('error', (err) => { /* console.error(`[Engine-${promptId}] DEBUG_STREAM: sourceStream for ${nodeIdentifier} errored:`, err) */ });
    sourceStream.on('end', () => { /* console.log(`[Engine-${promptId}] DEBUG_STREAM: sourceStream for ${nodeIdentifier} ended.`) */ });
    sourceStream.on('close', () => { /* console.log(`[Engine-${promptId}] DEBUG_STREAM: sourceStream for ${nodeIdentifier} closed.`) */ });


    // 1. 设置多路广播 (Multicaster)
    // 分支 A: 事件总线
    const eventBusStream = new Stream.PassThrough({ objectMode: true });
    eventBusStream.on('error', (err) => { /* console.error(`[Engine-${promptId}] DEBUG_STREAM: eventBusStream for ${nodeIdentifier} errored:`, err) */ });
    eventBusStream.on('end', () => { /* console.log(`[Engine-${promptId}] DEBUG_STREAM: eventBusStream for ${nodeIdentifier} ended.`) */ });
    eventBusStream.on('close', () => { /* console.log(`[Engine-${promptId}] DEBUG_STREAM: eventBusStream for ${nodeIdentifier} closed.`) */ });
    sourceStream.pipe(eventBusStream);
    consumerPromises.push(this.consumeForEventBus(eventBusStream, nodeId, promptId)); // consumeForEventBus 将自行获取 identifier

    // 分支 B: 连接下游节点
    for (const outputKey in definition.outputs) {
      if (definition.outputs[outputKey].dataFlowType === DataFlowType.STREAM) {
        const downstreamConnections = this.getDownstreamStreamConnections(nodeId, outputKey);

        const passThroughForOutput = new Stream.PassThrough({ objectMode: true });
        passThroughForOutput.on('error', (err) => { /* console.error(`[Engine-${promptId}] DEBUG_STREAM: passThroughForOutput '${outputKey}' for ${nodeIdentifier} errored:`, err) */ });
        passThroughForOutput.on('end', () => { /* console.log(`[Engine-${promptId}] DEBUG_STREAM: passThroughForOutput '${outputKey}' for ${nodeIdentifier} ended.`) */ });
        passThroughForOutput.on('close', () => { /* console.log(`[Engine-${promptId}] DEBUG_STREAM: passThroughForOutput '${outputKey}' for ${nodeIdentifier} closed.`) */ });

        sourceStream.pipe(passThroughForOutput);
        streamOutputsToReturn[outputKey] = passThroughForOutput; // 这个流将返回给 executeNode 并存入 nodeResults

        if (downstreamConnections.length === 0) {
          // 如果流输出没有连接，确保它被消费以防止 sourceStream 阻塞
          // console.log(`[Engine-${promptId}] Stream output '${outputKey}' for node ${nodeIdentifier} has no downstream connections. Consuming to prevent stall.`);
          passThroughForOutput.resume(); // 确保数据被丢弃，防止阻塞上游
          consumerPromises.push(streamEndPromise(passThroughForOutput).catch(err => {
            console.warn(`[Engine-${promptId}] Error ensuring unconsumed stream output '${outputKey}' for node ${nodeIdentifier} ended:`, err.message);
            // 即使这里出错，也应该让 Promise resolve 或以特定方式处理，避免阻塞 Promise.all
            // 对于这个 catch，我们只是记录警告，Promise 仍然会因错误而 reject，由 streamLifecyclePromise 的 catch 处理
            throw err; // 重新抛出，让 streamLifecyclePromise 的 catch 捕获
          }));
        }
        // 如果有下游连接，下游节点会负责消费 passThroughForOutput。
        // 我们可以选择性地在这里也添加 finished(passThroughForOutput) 到 consumerPromises
        // 以确保即使下游节点消费逻辑有误，这个分支的流也能结束。
        // 但这可能导致重复的错误处理或日志。暂时让下游节点负责。
      }
    }

    // 2. 创建并管理流生命周期 Promise
    const streamLifecyclePromise = (async () => {
      let batchResult: Record<string, any> | void = undefined;
      let pullerError: any = null;

      // Puller Task: 从 nodeGenerator 拉取数据到 buffer
      const pullerTask = (async () => {
        let chunkCounter = 0;
        // console.log(`[Engine-${promptId}] PULLER_TASK_STARTED for node ${nodeIdentifier}`);
        try {
          // --- 移除掉错误的 for await...of 循环 ---
          /*
           for await (const chunk of nodeGenerator) {
                chunkCounter++;
           }
          */
          // --- 只保留手动迭代 ---

          // 直接使用 nodeGenerator
          // const manualGenerator = nodeGenerator; // 不再需要别名
          let nextResult = await nodeGenerator.next(); // 直接在原始 generator 上调用
          chunkCounter = 0; // 确保计数器从0开始

          while (!nextResult.done) { // 只有当 done 为 false 时，value 才是 yield 出来的 chunk
            chunkCounter++;
            if (this.isInterrupted) { // 增加中断检查
              throw new Error('Execution interrupted during stream pulling.');
            }
            if (buffer.isFull()) {
              console.error(`[Engine-${promptId}] Buffer overflow for node ${nodeIdentifier}.`);
              // 溢出时，不仅抛错，还要通知 buffer
              const overflowError = new BufferOverflowError(`Node ${nodeIdentifier} stream buffer overflow.`);
              buffer.signalError(overflowError);
              throw overflowError; // 抛出以便外层捕获
            }
            // ✅ 关键：将 yield 出来的值推入 buffer
            await buffer.push(nextResult.value);
            // console.log(`[Engine-${promptId}] PULLER_TASK_PUSHED_CHUNK ${chunkCounter} for node ${nodeIdentifier}`);
            nextResult = await nodeGenerator.next(); // 获取下一个
          }
          // ✅ 循环结束，nextResult.done 为 true，此时 nextResult.value 是生成器的 return 值
          batchResult = nextResult.value;

        } catch (error: any) {
          console.error(`[Engine-${promptId}] Puller task for ${nodeIdentifier} caught error: ${error.message}`, error.stack);
          pullerError = error;
          buffer.signalError(error); // 确保任何错误都通知 buffer
        } finally {
          // 确保无论如何都 signalEnd 或 signalError (signalError内部会设置isDone)
          if (!pullerError) {
            // console.log(`[Engine-${promptId}] PULLER_TASK_FINALLY for node ${nodeIdentifier}. Buffer signaled end. Processed ${chunkCounter} chunks.`);
            buffer.signalEnd();
          } else {
            // 如果已有错误，signalError 已经被调用过了
            // console.log(`[Engine-${promptId}] PULLER_TASK_FINALLY_ERROR for node ${nodeIdentifier}. Buffer signaled error. Processed ${chunkCounter} chunks before error.`);
          }
        }
      })();

      // The original for...await loop was removed.
      // Manual iteration logic is now self-contained above.

      try {
        // 首先等待 pullerTask 完成，它负责填充 buffer 并最终调用 buffer.signalEnd() 或 signalError()
        await pullerTask; // 等待生产结束

        // 调整 1: 先等待所有消费者 Promise 完成
        // 必须等消费者把 buffer/sourceStream 读完，sourceStream 才会 end
        await Promise.all(consumerPromises); // 等待消费结束

        // 调整 2: 将防御性检查移到等待消费者之后
        // pullerTask 完成后，BoundedBuffer 应该已经 signalEnd 或 signalError。
        // 并且所有 consumerPromises 也已完成。
        // 此时 sourceStream (从 BoundedBuffer 创建) 应该已经结束或出错。
        // 我们可以选择性地在这里给事件循环一个机会
        await new Promise(r => setTimeout(r, 0)); // 短暂让出控制权 (可选，但保留无妨)

        // 只有在没有 pullerError 且消费者也都完成的情况下，才检查流是否"自然"结束
        if (!pullerError && !sourceStream.readableEnded && !sourceStream.destroyed) {
          // 此时如果还没结束，才是真正的异常情况
          const forcedError = new Error(`Forced destroy of sourceStream for ${nodeIdentifier} as it did not end naturally AFTER puller and all consumers finished.`);
          console.warn(`[Engine-${promptId}] DEBUG: sourceStream for ${nodeIdentifier} did not end/destroy naturally AFTER puller and consumers. Forcing destroy. ReadableEnded: ${sourceStream.readableEnded}, Destroyed: ${sourceStream.destroyed}`);
          // 只有在没有其他错误时才用 forcedError 销毁
          if (!sourceStream.destroyed) sourceStream.destroy(forcedError);
        }
        // 如果 pullerTask 本身有错误，确保用那个错误销毁流（如果还没销毁的话）
        if (pullerError && !sourceStream.destroyed) {
          sourceStream.destroy(pullerError);
        }
        // 防御性检查结束

        if (pullerError) {
          // 如果 pullerTask 本身就有错误，即使其他消费者可能已处理，也应优先抛出 puller 的错误。
          throw pullerError;
        }

        // 只有在 pullerTask 无错，并且所有 consumerPromises 都成功解决后，才认为完全成功。
        // Promise.all(consumerPromises) 如果有 reject，这里就不会执行到。
        // console.log(`[Engine-${promptId}] All streams and puller for node ${nodeIdentifier} have finished successfully.`);

        const existingOutputs = this.nodeResults[nodeId] || {};
        let outputsToMerge = {};
        if (typeof batchResult === 'object' && batchResult !== null) {
          outputsToMerge = batchResult;
        }
        this.nodeResults[nodeId] = { ...existingOutputs, ...outputsToMerge };
        this.nodeStates[nodeId] = ExecutionStatus.COMPLETE;
        this.sendNodeComplete(nodeId, (typeof batchResult === 'object' && batchResult !== null) ? batchResult : {});
        console.log(`[Engine-${promptId}] Node ${nodeIdentifier} officially marked as COMPLETE.`);

      } catch (error: any) {
        const errorMessage = error.message || String(error);
        console.error(`[Engine-${promptId}] Error in stream lifecycle for node ${nodeIdentifier}:`, errorMessage, error.stack);
        this.nodeStates[nodeId] = this.isInterrupted ? ExecutionStatus.INTERRUPTED : ExecutionStatus.ERROR;
        this.sendNodeError(nodeId, errorMessage);
      }
    })();

    this.backgroundTasks.push(streamLifecyclePromise);
    return streamOutputsToReturn;
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
    // console.log(`[Engine-${promptId}] CONSUME_FOR_EVENT_BUS_STARTED for node ${nodeIdentifier}`);
    try {
      for await (const chunk of readable) {
        const payload: NodeYieldPayload = {
          promptId,
          sourceNodeId: nodeId, // Keep original nodeId for payload
          yieldedContent: chunk as ChunkPayload,
          isLastChunk: false,
        };
        this.wsManager.broadcast('NODE_YIELD', payload);
      }
      // 移除了 await finished(readable); 因为 for await 循环结束本身就意味着流结束。
      // 如果流未能正常结束，for await 会抛出错误，由 catch 块处理。
      // console.log(`[Engine-${promptId}] consumeForEventBus for node ${nodeIdentifier}: for-await loop completed.`);
    } catch (error: any) {
      console.error(`[Engine-${promptId}] consumeForEventBus for node ${nodeIdentifier} caught error during stream consumption:`, error); // 修改日志消息
      const finalErrorPayload: NodeYieldPayload = {
        promptId,
        sourceNodeId: nodeId, // Keep original nodeId for payload
        yieldedContent: { type: 'error_chunk', content: `Stream consumption error: ${error.message}` },
        isLastChunk: true,
      };
      this.wsManager.broadcast('NODE_YIELD', finalErrorPayload);
      // console.log(`[Engine-${promptId}] CONSUME_FOR_EVENT_BUS_ERRORED_OR_ABORTED for node ${nodeIdentifier}`);
      throw error;
    }
    const finalPayload: NodeYieldPayload = {
      promptId,
      sourceNodeId: nodeId, // Keep original nodeId for payload
      yieldedContent: { type: 'finish_reason_chunk', content: 'Stream ended' },
      isLastChunk: true,
    };
    this.wsManager.broadcast('NODE_YIELD', finalPayload);
    // console.log(`[Engine-${promptId}] CONSUME_FOR_EVENT_BUS_FINISHED for node ${nodeIdentifier}`);
  }

  private sendNodeComplete(nodeId: NanoId, output: any): void {
    const payload: NodeCompletePayload = {
      promptId: this.promptId,
      nodeId,
      output,
    };
    this.wsManager.broadcast('NODE_COMPLETE', payload);
  }

  private handleBypassedNode(
    nodeDefinition: NodeDefinition,
    executionNode: ExecutionNode,
    currentInputs: Record<string, any>
  ): Record<string, any> {
    const pseudoOutputs: Record<string, any> = {};
    const { bypassBehavior } = nodeDefinition;

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
    return pseudoOutputs;
  }

  private isTypeCompatible(
    outputDef: { dataFlowType: string; matchCategories?: string[] },
    inputDef: { dataFlowType: string; matchCategories?: string[] }
  ): boolean {
    if (outputDef.matchCategories?.includes(BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD) ||
      inputDef.matchCategories?.includes(BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD)) {
      return true;
    }
    if (outputDef.dataFlowType === DataFlowType.WILDCARD || outputDef.dataFlowType === DataFlowType.CONVERTIBLE_ANY ||
      inputDef.dataFlowType === DataFlowType.WILDCARD || inputDef.dataFlowType === DataFlowType.CONVERTIBLE_ANY) {
      return true;
    }
    if (outputDef.matchCategories?.length && inputDef.matchCategories?.length) {
      for (const category of outputDef.matchCategories) {
        if (inputDef.matchCategories.includes(category)) {
          return true;
        }
      }
    }
    if (outputDef.dataFlowType === inputDef.dataFlowType) {
      return true;
    }
    if (outputDef.dataFlowType === DataFlowType.INTEGER && inputDef.dataFlowType === DataFlowType.FLOAT) {
      return true;
    }
    if (inputDef.dataFlowType === DataFlowType.STRING &&
      (outputDef.dataFlowType === DataFlowType.INTEGER ||
        outputDef.dataFlowType === DataFlowType.FLOAT ||
        outputDef.dataFlowType === DataFlowType.BOOLEAN)) {
      return true;
    }
    return false;
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
    this.wsManager.broadcast('NODE_BYPASSED', payload);
  }

  // 新增辅助函数：获取下游流连接
  private getDownstreamStreamConnections(sourceNodeId: NanoId, sourceOutputKey: string): ExecutionEdge[] {
    return this.edges.filter(edge =>
      edge.sourceNodeId === sourceNodeId &&
      edge.sourceHandle === sourceOutputKey
    );
  }

  private async _handleStreamInterfaceOutput(
    interfaceKey: string,
    stream: Stream.Readable,
    interfaceDisplayName?: string
  ): Promise<void> {
    const taskPromise = new Promise<void>((resolve, reject) => {
      const consumerId = `InterfaceConsumer-${this.promptId}-${interfaceKey}`;
      // console.log(`[Engine-${this.promptId}] [${consumerId}] STARTING consumption for interface output: ${interfaceKey} ('${interfaceDisplayName || 'N/A'}'). Stream readable: ${stream.readable}`);
      this.activeInterfaceStreamConsumers.add(interfaceKey);
      let chunkIndex = 0;

      stream.on('data', (chunk) => {
        // console.debug(`[Engine-${this.promptId}] [${consumerId}] Received chunk. Index: ${chunkIndex}. Broadcasting... Payload: ${JSON.stringify(chunk)}`);
        if (this.isInterrupted) {
          console.warn(`[Engine-${this.promptId}] [${consumerId}] Interrupting data event for interface stream ${interfaceKey} at chunk ${chunkIndex}`);
          stream.destroy(new Error('Interrupted by user'));
          return;
        }
        const payload: WorkflowInterfaceYieldPayload = {
          promptId: this.promptId,
          interfaceOutputKey: interfaceKey,
          interfaceOutputDisplayName: interfaceDisplayName,
          yieldedContent: chunk as ChunkPayload, // Assuming chunk is ChunkPayload
          isLastChunk: false,
        };
        this.wsManager.broadcast(WebSocketMessageType.WORKFLOW_INTERFACE_YIELD, payload);
        // console.debug(`[Engine-${this.promptId}] [${consumerId}] Broadcasted chunk. Index: ${chunkIndex}.`);
        chunkIndex++;
      });

      stream.on('end', () => {
        // console.debug(`[Engine-${this.promptId}] [${consumerId}] Stream for interface output ${interfaceKey} ENDED. Processed ${chunkIndex} chunks. Broadcasting last chunk...`);
        const payload: WorkflowInterfaceYieldPayload = {
          promptId: this.promptId,
          interfaceOutputKey: interfaceKey,
          interfaceOutputDisplayName: interfaceDisplayName,
          yieldedContent: { type: 'finish_reason_chunk', content: 'Stream ended' } as ChunkPayload,
          isLastChunk: true,
        };
        this.wsManager.broadcast(WebSocketMessageType.WORKFLOW_INTERFACE_YIELD, payload);
        // console.debug(`[Engine-${this.promptId}] [${consumerId}] Broadcasted LAST chunk for ${interfaceKey}.`);
        this.activeInterfaceStreamConsumers.delete(interfaceKey);
        // console.debug(`[Engine-${this.promptId}] [${consumerId}] Resolving promise for ${interfaceKey}.`);
        resolve();
      });

      stream.on('error', (err) => {
        console.error(`[Engine-${this.promptId}] [${consumerId}] ERROR in stream for interface output ${interfaceKey} after ${chunkIndex} chunks:`, err.message, err.stack);
        this.activeInterfaceStreamConsumers.delete(interfaceKey);
        if (err.message === 'Interrupted by user') {
          console.warn(`[Engine-${this.promptId}] [${consumerId}] Stream for ${interfaceKey} interrupted by user. Resolving promise.`);
          resolve();
        } else {
          console.error(`[Engine-${this.promptId}] [${consumerId}] Stream for ${interfaceKey} errored. Rejecting promise.`);
          reject(err);
        }
      });

      // Ensure consumption if it's a PassThrough that might not have other consumers
      if (typeof (stream as any).isPaused === 'function' && (stream as any).isPaused()) {
        // console.debug(`[Engine-${this.promptId}] [${consumerId}] Stream for ${interfaceKey} was paused, resuming.`);
        stream.resume();
      }
    });
    this.backgroundTasks.push(taskPromise); // Add this stream's lifecycle to the main background tasks
    return taskPromise;
  }

  private async _processAndBroadcastFinalOutputs(): Promise<void> {
    if (!this.payload.outputInterfaceMappings || Object.keys(this.payload.outputInterfaceMappings).length === 0) {
      // console.log(`[Engine-${this.promptId}] No interface output mappings defined.`);
      return;
    }

    const finalWorkflowOutputs: Record<string, InterfaceOutputValue> = {}; // Use InterfaceOutputValue type

    // console.debug(`[Engine-${this.promptId}] [_processAndBroadcastFinalOutputs] Starting. Mappings: ${JSON.stringify(this.payload.outputInterfaceMappings)}`);

    for (const interfaceOutputKey in this.payload.outputInterfaceMappings) {
      // console.debug(`[Engine-${this.promptId}] [_processAndBroadcastFinalOutputs] Processing interfaceOutputKey: ${interfaceOutputKey}`);
      if (this.isInterrupted) {
        // console.log(`[Engine-${this.promptId}] [_processAndBroadcastFinalOutputs] Skipping processing of interface output ${interfaceOutputKey} due to interruption.`);
        continue;
      }
      const mapping = this.payload.outputInterfaceMappings[interfaceOutputKey];
      if (!mapping) {
        console.warn(`[Engine-${this.promptId}] [_processAndBroadcastFinalOutputs] No mapping found for interfaceOutputKey: ${interfaceOutputKey}. Skipping.`);
        continue;
      }

      const { sourceNodeId, sourceSlotKey } = mapping;
      // console.debug(`[Engine-${this.promptId}] [_processAndBroadcastFinalOutputs] Mapping for ${interfaceOutputKey}: sourceNodeId=${sourceNodeId}, sourceSlotKey=${sourceSlotKey}`);
      const sourceNodeResult = this.nodeResults[sourceNodeId];
      const sourceNodeState = this.nodeStates[sourceNodeId];
      let valueToOutput: any = null;

      // console.debug(`[Engine-${this.promptId}] [_processAndBroadcastFinalOutputs] sourceNodeResult for ${sourceNodeId}: ${sourceNodeResult ? 'Exists' : 'null/undefined'}, sourceNodeState: ${sourceNodeState}`);

      if (sourceNodeResult && sourceSlotKey in sourceNodeResult) {
        valueToOutput = sourceNodeResult[sourceSlotKey];
        // console.debug(`[Engine-${this.promptId}] [_processAndBroadcastFinalOutputs] valueToOutput for ${interfaceOutputKey} from nodeResults: ${typeof valueToOutput}. Is Readable: ${valueToOutput instanceof Stream.Readable}`);
      } else {
        console.warn(
          `[Engine-${this.promptId}] [_processAndBroadcastFinalOutputs] Source for interface output ${interfaceOutputKey} (node: ${sourceNodeId}, slot: ${sourceSlotKey}) not found in nodeResults.`
        );
      }

      const interfaceDef = this.interfaceOutputDefinitions?.[interfaceOutputKey];
      const interfaceType = interfaceDef?.dataFlowType;
      const interfaceDisplayName = interfaceDef?.displayName;
      // console.debug(`[Engine-${this.promptId}] [_processAndBroadcastFinalOutputs] Interface def for ${interfaceOutputKey}: type=${interfaceType}, displayName=${interfaceDisplayName}`);

      if (interfaceType === 'STREAM' && valueToOutput instanceof Stream.Readable) {
        // console.log(`[Engine-${this.promptId}] [_processAndBroadcastFinalOutputs] Handling STREAM interface output: ${interfaceOutputKey}. Stream destroyed: ${valueToOutput.destroyed}, readable: ${valueToOutput.readable}`);
        // _handleStreamInterfaceOutput now adds its promise to this.backgroundTasks
        // 移除 await, 让 _handleStreamInterfaceOutput 启动后台任务即可
        this._handleStreamInterfaceOutput(interfaceOutputKey, valueToOutput, interfaceDisplayName);
        finalWorkflowOutputs[interfaceOutputKey] = {
          type: 'stream_placeholder',
          message: `Stream started for ${interfaceOutputKey} (${interfaceDisplayName || ''})`,
        };
      } else {
        console.warn(`[Engine-${this.promptId}] [_processAndBroadcastFinalOutputs] NOT handling ${interfaceOutputKey} as STREAM. interfaceType: ${interfaceType}, valueToOutput is Readable: ${valueToOutput instanceof Stream.Readable}. Value: ${typeof valueToOutput}`);
        if (interfaceType === 'STREAM' && !(valueToOutput instanceof Stream.Readable)) {
          console.warn(
            `[Engine-${this.promptId}] [_processAndBroadcastFinalOutputs] Interface output ${interfaceOutputKey} is defined as STREAM, but actual value is not a ReadableStream. Value:`, valueToOutput
          );
        }
        finalWorkflowOutputs[interfaceOutputKey] = valueToOutput;
      }
    }

    // console.debug(`[Engine-${this.promptId}] [_processAndBroadcastFinalOutputs] Finished loop. finalWorkflowOutputs count: ${Object.keys(finalWorkflowOutputs).length}`);
    if (Object.keys(finalWorkflowOutputs).length > 0 && !this.isInterrupted) {
      this.sendNodeComplete('__WORKFLOW_INTERFACE_OUTPUTS__', finalWorkflowOutputs);
      // console.log(`[Engine-${this.promptId}] Sent aggregated workflow interface outputs (with stream placeholders):`, finalWorkflowOutputs);
    } else if (this.isInterrupted) {
      // console.log(`[Engine-${this.promptId}] Aggregated workflow interface outputs not sent due to interruption.`);
    }
  }
}