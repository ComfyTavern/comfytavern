import {
  ExecutionNode,
  ExecutionEdge,
  NodeDefinition,
  ExecutionStatus,
  NodeExecutionResult, // 可能需要调整或移除，直接用 WebSocket Payload
  WorkflowExecutionPayload,
  NanoId,
  NodeExecutingPayload,
  NodeCompletePayload,
  NodeErrorPayload,
  ExecutionType,
  ExecutePreviewRequestPayload,
} from '@comfytavern/types';
import { nodeManager } from './nodes/NodeManager'; // 用于获取节点定义
import { WebSocketManager } from './websocket/WebSocketManager';
import { DataFlowType, BuiltInSocketMatchCategory } from '@comfytavern/types';
import { parseSubHandleId } from './utils/helpers'; //  InputDefinition导入解析函数
// import { OutputManager } from './services/OutputManager'; // TODO: Import OutputManager
// import { HistoryService } from './services/HistoryService'; // TODO: Import HistoryService

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

  constructor(
    promptId: NanoId,
    payload: WorkflowExecutionPayload,
    wsManager: WebSocketManager
    // outputManager: OutputManager, // TODO
    // historyService: HistoryService // TODO
  ) {
    this.promptId = promptId;
    this.payload = payload;
    // Roo: 打印构造函数接收到的完整 payload
    // console.log(`%%%%%%% Engine Constructor: Received payload: %%%%%%%`, JSON.parse(JSON.stringify(this.payload)));
    this.wsManager = wsManager;
    // this.outputManager = outputManager;
    // this.historyService = historyService;

    // 将 payload 中的节点数组转换为 Record，并添加类型注解
    this.nodes = payload.nodes.reduce((acc: Record<NanoId, ExecutionNode>, node: ExecutionNode) => {
      acc[node.id] = node;
      return acc;
    }, {}); // 初始值 {} 会被正确推断为 Record<NanoId, ExecutionNode>
    this.edges = payload.edges;

    console.log(`[Engine-${this.promptId}] Initialized for execution.`);
  }

  /**
   * 执行完整的工作流。
   */
  public async run(): Promise<{ status: ExecutionStatus.COMPLETE | ExecutionStatus.ERROR | ExecutionStatus.INTERRUPTED; error?: any }> {
    console.log(`[Engine-${this.promptId}]----- Starting full execution | 开始执行完整工作流 ----`);
    this.isInterrupted = false; // 重置中断标志

    try {
      this.executionOrder = this.topologicalSort(this.nodes, this.edges);
      console.log(`[Engine-${this.promptId}] Execution order:`, this.executionOrder);

      for (const nodeId of this.executionOrder) {
        if (this.isInterrupted) {
          console.log(`[Engine-${this.promptId}] Execution interrupted before node ${nodeId}.`);
          throw new Error('Execution interrupted by user.');
        }

        const node = this.nodes[nodeId];
        // 检查节点是否被绕过
        if (node?.bypassed === true) {
          console.log(`[Engine-${this.promptId}] Node ${nodeId} is bypassed, handling bypass logic...`);
          try {
            const definition = nodeManager.getNode(node.fullType);
            if (!definition) {
              throw new Error(`Node type ${node.fullType} not found in registry.`);
            }

            // 准备输入以便传递给绕过处理函数
            const inputs = this.prepareNodeInputs(nodeId);

            // 处理绕过逻辑并获取伪输出
            const pseudoOutputs = this.handleBypassedNode(definition, node, inputs);

            // 存储伪输出并发送通知
            this.nodePseudoOutputs[nodeId] = pseudoOutputs;
            this.nodeResults[nodeId] = pseudoOutputs; // 同时存入nodeResults，以供下游节点使用
            this.nodeStates[nodeId] = ExecutionStatus.SKIPPED;

            // 通知前端节点被绕过
            this.sendNodeBypassed(nodeId, pseudoOutputs);

            // 继续处理下一个节点
            continue;
          } catch (error: any) {
            console.error(`[Engine-${this.promptId}] Error processing bypassed node ${nodeId}:`, error);
            // 发送错误消息并终止工作流执行
            this.sendNodeError(nodeId, `Error in bypass processing: ${error.message}`, 'full');
            return { status: ExecutionStatus.ERROR, error: error.message || String(error) };
          }
        }

        const inputs = this.prepareNodeInputs(nodeId);
        const result = await this.executeNode(nodeId, inputs, 'full');

        if (result.status === ExecutionStatus.ERROR) {
          console.error(`[Engine-${this.promptId}] Workflow execution stopped due to error in node ${nodeId}`);
          // 错误状态已在 executeNode 中发送
          return { status: ExecutionStatus.ERROR, error: result.error };
        }
        if (result.status === ExecutionStatus.INTERRUPTED) {
          console.log(`[Engine-${this.promptId}] Workflow execution interrupted during node ${nodeId}`);
          return { status: ExecutionStatus.INTERRUPTED };
        }
      }

      console.log(`[Engine-${this.promptId}] Workflow execution completed successfully.`);
      // TODO: 调用 HistoryService 记录成功
      return { status: ExecutionStatus.COMPLETE };

    } catch (error: any) {
      console.error(`[Engine-${this.promptId}] Workflow execution failed:`, error);
      // TODO: 调用 HistoryService 记录失败
      const finalStatus = this.isInterrupted ? ExecutionStatus.INTERRUPTED : ExecutionStatus.ERROR;
      // 发送最终的错误状态 (如果之前没有发送过) - Scheduler 会发送最终状态
      return { status: finalStatus, error: error.message || String(error) };
    }
  }

  /**
   * 执行工作流的实时预览部分。
   * @param previewRequest 预览请求的载荷
   */
  public async runPreview(previewRequest: ExecutePreviewRequestPayload): Promise<void> {
    console.log(`[Engine-${this.promptId}]----- Starting preview execution for node ${previewRequest.changedNodeId} | 开始执行实时预览 -----`);
    const { changedNodeId, inputKey, newValue } = previewRequest;

    // 1. 更新变更节点的输入值 (临时，只为预览计算)
    //    注意：这需要一种方式来存储或访问节点的当前（可能已预览的）输入/输出状态
    //    这部分逻辑比较复杂，暂时简化处理或跳过

    // 2. 确定需要重新计算的下游节点
    const downstreamNodes = this.getDownstreamNodes(changedNodeId);
    console.log(`[Engine-${this.promptId}] Downstream nodes for preview:`, downstreamNodes);

    // 3. 遍历下游节点并执行预览
    for (const nodeId of downstreamNodes) {
      const node = this.nodes[nodeId];
      if (!node) continue;

      const definition = nodeManager.getNode(node.fullType);
      if (definition?.isPreviewUnsafe) {
        console.log(`[Engine-${this.promptId}] Skipping preview for unsafe node ${nodeId} (${node.fullType}).`);
        // TODO: 可能需要发送一个特定消息表示预览被跳过？
        continue; // 跳过不安全的节点及其下游 (简化处理)
      }

      // 准备预览输入 (需要使用上游节点的预览输出)
      // 这需要一个更复杂的预览状态管理机制，暂时简化
      const inputs = this.prepareNodeInputs(nodeId); // 使用当前结果模拟

      // 执行预览逻辑 (如果节点有特殊预览逻辑，否则执行完整逻辑)
      // 注意：executeNode 需要调整以支持 preview 类型
      await this.executeNode(nodeId, inputs, 'preview');
      // 预览不需要处理错误中断整个流程，单个节点失败不影响其他预览
    }

    console.log(`[Engine-${this.promptId}] Preview execution finished for change on ${changedNodeId}.`);
  }

  /**
   * 中断当前执行。
   */
  public interrupt(): boolean {
    if (!this.isInterrupted) {
      console.log(`[Engine-${this.promptId}] Received interrupt signal.`);
      this.isInterrupted = true;
      return true;
    }
    return false;
  }

  /**
   * 公共 getter，用于检查引擎是否已被中断。
   */
  public getIsInterrupted(): boolean {
    return this.isInterrupted;
  }

  // --- 内部辅助方法 ---

  /**
   * 对工作流图进行拓扑排序。
   * (基本逻辑不变，适配 NanoId)
   */
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
      const sourceId = edge.sourceNodeId; // 使用 ExecutionEdge 字段
      const targetId = edge.targetNodeId; // 使用 ExecutionEdge 字段
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

  /**
   * 准备节点的输入数据。
   * (需要适配 ExecutionNode 和 ExecutionEdge)
   */
  private prepareNodeInputs(nodeId: NanoId): Record<string, any> {
    const inputs: Record<string, any> = {};
    const node = this.nodes[nodeId];

    // Roo: 添加日志 - 方法入口
    console.log(`[Engine-${this.promptId}] prepareNodeInputs for ${nodeId}. Node config inputs: ${JSON.stringify(node?.inputs)}, inputConnectionOrders: ${JSON.stringify((node as any)?.inputConnectionOrders)}`);

    if (!node) {
      console.warn(`[Engine-${this.promptId}] Node ${nodeId} not found during input preparation.`);
      return {};
    }
    const definition = nodeManager.getNode(node.fullType);
    if (!definition || !definition.inputs) {
      return {};
    }

    // 临时存储多输入的值，键是原始插槽名，值是 { edgeId: string, value: any }[]
    const multiInputBuffer: Record<string, Array<{ edgeId: string, value: any }>> = {};

    // 1. 收集所有连接的值到对应缓冲区
    this.edges.forEach(edge => {
      if (edge.targetNodeId === nodeId) {
        const sourceNodeId = edge.sourceNodeId;
        const sourceOutputKey = edge.sourceHandle;
        const rawTargetInputKey = edge.targetHandle; // e.g., 'text_inputs__0' or 'separator'

        if (sourceNodeId && sourceOutputKey && rawTargetInputKey) {
          const sourceResult = this.nodeResults[sourceNodeId];
          const sourceNodeState = this.nodeStates[sourceNodeId];

          if ((sourceNodeState === ExecutionStatus.COMPLETE || sourceNodeState === ExecutionStatus.SKIPPED) && sourceResult) {
            const sourceValue = sourceResult[sourceOutputKey];
            const { originalKey: actualInputKey } = parseSubHandleId(rawTargetInputKey);
            const inputDef = definition.inputs[actualInputKey];

            if (inputDef?.multi) {
              if (!multiInputBuffer[actualInputKey]) {
                multiInputBuffer[actualInputKey] = [];
              }
              //  InputDefinition使用 edge.id! 来处理潜在的 TS2322 (string | undefined to string)
              multiInputBuffer[actualInputKey].push({ edgeId: edge.id!, value: sourceValue });
            } else {
              inputs[actualInputKey] = sourceValue; // 单输入直接赋值
            }
          } else {
            console.warn(`[Engine-${this.promptId}] Source node ${sourceNodeId} for edge ${edge.id} did not complete successfully or has no outputs. Setting input ${rawTargetInputKey} to undefined.`);
            // 对于未成功或无输出的上游，其对应输入应为 undefined
            // 需要确定 actualInputKey 并相应设置
            const { originalKey: actualInputKey } = parseSubHandleId(rawTargetInputKey);
            const inputDef = definition.inputs[actualInputKey];
            if (inputDef?.multi) {
              // 对于多输入，如果一个连接失败，我们仍然需要一个占位符或决定如何处理
              // 暂时也将其加入 buffer，但值为 undefined，后续排序时会处理
              if (!multiInputBuffer[actualInputKey]) {
                multiInputBuffer[actualInputKey] = [];
              }
              //  InputDefinition使用 edge.id! 来处理潜在的 TS2322
              multiInputBuffer[actualInputKey].push({ edgeId: edge.id!, value: undefined });
            } else {
              inputs[actualInputKey] = undefined;
            }
          }
        }
      }
    });

    // Roo: 添加日志 - 步骤1之后
    console.log(`[Engine-${this.promptId}] After collecting connected inputs for ${nodeId}:`);
    console.log(`  multiInputBuffer: ${JSON.stringify(multiInputBuffer)}`);
    console.log(`  inputs (from single connections): ${JSON.stringify(inputs)}`);

    // 2. 根据 inputConnectionOrders 排序多输入值并放入最终的 inputs 对象
    const currentInputConnectionOrders = (node as any).inputConnectionOrders as Record<string, string[]> | undefined;
    if (currentInputConnectionOrders) {
      for (const originalInputKey in currentInputConnectionOrders) {
        const inputDef = definition.inputs[originalInputKey];
        if (inputDef?.multi && multiInputBuffer[originalInputKey]) {
          const orderedEdgeIds = currentInputConnectionOrders[originalInputKey] || [];
          const collectedValuesForSlot = multiInputBuffer[originalInputKey];

          inputs[originalInputKey] = orderedEdgeIds
            .map((edgeId: string) => { //  InputDefinition为 edgeId 添加类型
              const foundEntry = collectedValuesForSlot.find(entry => entry.edgeId === edgeId); //  InputDefinition修正属性名 originalEdgeId -> edgeId
              // 如果找不到对应的边（例如，边被删除但 order 未更新），或者值为 undefined，则保留 undefined
              return foundEntry !== undefined ? foundEntry.value : undefined;
            });
          // 注意：这里不过滤 undefined，让后续的默认值和必需检查来处理，
          // 因为一个多输入数组中可能合法地包含 undefined 值（如果上游节点就是这么输出的）
          // 或者如果一个连接失败，它在数组中对应的位置应该是 undefined。
        }
      }
    }
    // 对于那些在 multiInputBuffer 中有值，但在 inputConnectionOrders 中没有条目的多输入槽
    // (例如，如果前端允许连接到多输入槽但没有正确更新 orders，或者 orders 为空数组但有连接)
    // 这种情况理论上不应该发生，如果发生了，意味着前端状态和后端收到的工作流数据不一致。
    // 为了健壮性，如果 inputs[originalInputKey] 仍然未定义，但 multiInputBuffer[originalInputKey] 有内容，
    // 可以考虑使用 buffer 中的值（顺序不定）。但更推荐的是确保前端数据一致性。
    // 当前选择：严格依赖 inputConnectionOrders 来构建多输入数组。

    // Roo: 添加日志 - 步骤2之后
    console.log(`[Engine-${this.promptId}] After processing multi-input orders for ${nodeId}:`);
    console.log(`  inputs: ${JSON.stringify(inputs)}`);

    // 3. 处理来自节点 inputs 属性的预设值 (仅当输入未通过连接提供时)
    if (node.inputs) {
      for (const inputKey in node.inputs) {
        // 只有当该输入槽还没有从连接中获取到值时，才使用预设值
        if (inputs[inputKey] === undefined) {
          const inputDef = definition.inputs[inputKey];
          if (inputDef?.multi) {
            // 如果是多输入，预设值应该是数组
            if (Array.isArray(node.inputs[inputKey])) {
              inputs[inputKey] = node.inputs[inputKey];
            } else if (node.inputs[inputKey] !== undefined) {
              // 如果预设值不是数组但插槽是 multi，将其包装成数组
              // 这对于 MergeNode 的 text_inputs (默认是 '') 可能不直接适用，
              // 但作为通用逻辑，如果节点期望数组，这里可以做转换。
              // MergeNode 自身会处理非数组的默认值，所以这里可以保守一些。
              // inputs[inputKey] = [node.inputs[inputKey]];
              // 考虑到 MergeNode 的健壮性，如果预设值不是数组，让 MergeNode 自己处理。
              // 但如果其他多输入节点严格要求数组，这里就需要包装。
              // 暂时保持与单输入一致的逻辑：直接赋值。节点自身需要处理类型。
              inputs[inputKey] = node.inputs[inputKey];
            }
          } else {
            inputs[inputKey] = node.inputs[inputKey];
          }
        }
      }
    }

    // Roo: 添加日志 - 步骤3之后
    console.log(`[Engine-${this.promptId}] After applying node preset inputs for ${nodeId}:`);
    console.log(`  inputs: ${JSON.stringify(inputs)}`);

    // 4. 应用节点定义中的默认值 (如果输入仍未定义)
    for (const inputKey in definition.inputs) {
      if (inputs[inputKey] === undefined && definition.inputs[inputKey].config?.default !== undefined) {
        const inputDef = definition.inputs[inputKey];
        const defaultValue = inputDef.config!.default;
        if (inputDef.multi && !Array.isArray(defaultValue)) {
          // 对于多输入插槽，如果其定义的默认值不是数组，
          // MergeNode 的 execute 方法会通过 text_inputs = [] 和 Array.isArray() 来处理。
          // 其他节点可能需要在这里将默认值包装成数组，例如 inputs[inputKey] = [defaultValue];
          // 但为了与 MergeNode 的行为一致，我们让节点自己处理。
          inputs[inputKey] = defaultValue;
        } else {
          inputs[inputKey] = defaultValue;
        }
      }
    }

    // 5. 检查必需输入
    for (const inputKey in definition.inputs) {
      // 获取输入定义
      const inputDef = definition.inputs[inputKey];

      // 检查是否为必需输入
      const isRequired = typeof inputDef.required === 'function'
        ? inputDef.required(node.configValues || {})
        : inputDef.required === true;

      if (isRequired && inputs[inputKey] === undefined) {
        throw new Error(`Missing required input '${inputKey}' for node ${nodeId} (${node.fullType})`);
      }
    }

    // Roo: 添加日志 - 步骤4之后 (返回之前)
    console.log(`[Engine-${this.promptId}] Final prepared inputs for ${nodeId} (before required check): ${JSON.stringify(inputs)}`);

    return inputs;
  }


  /**
   * 执行单个节点逻辑。
   * @param nodeId 要执行的节点 ID
   * @param inputs 节点的输入值
   * @param executionType 'full' 或 'preview'
   * @returns 包含状态和错误信息（如果失败）的对象
   */
  /**
   * 发送节点错误状态。
   * @param nodeId 节点ID
   * @param errorDetails 错误详情
   * @param executionType 执行类型
   */
  private sendNodeError(nodeId: NanoId, errorDetails: any, executionType: ExecutionType): void {
    // 对于预览错误，我们可能不想广播给所有人，或者使用不同的消息类型
    // 但当前设计是统一处理
    const payload: NodeErrorPayload = {
      promptId: this.promptId,
      nodeId,
      errorDetails: { message: String(errorDetails) }, // 简化错误信息
    };
    // 注意：错误消息也需要区分 executionType 吗？设计文档未明确，暂时不加
    this.wsManager.broadcast('NODE_ERROR', payload); // 考虑是否只发给相关 client
  }

  /**
   * 执行单个节点逻辑。
   * @param nodeId 要执行的节点 ID
   * @param inputs 节点的输入值
   * @param executionType 'full' 或 'preview'
   * @returns 包含状态和错误信息（如果失败）的对象
   */
  private async executeNode(
    nodeId: NanoId,
    inputs: Record<string, any>,
    executionType: ExecutionType
  ): Promise<{ status: ExecutionStatus; error?: any }> {
    const node = this.nodes[nodeId];
    if (!node) {
      const errorMsg = `Node with ID ${nodeId} not found in engine.`;
      this.sendNodeError(nodeId, errorMsg, executionType);
      return { status: ExecutionStatus.ERROR, error: errorMsg };
    }
    const definition = nodeManager.getNode(node.fullType);

    if (!definition || !definition.execute) {
      const errorMsg = `Node type ${node.fullType} not found or not executable.`;
      this.sendNodeError(nodeId, errorMsg, executionType);
      return { status: ExecutionStatus.ERROR, error: errorMsg };
    }

    // 发送节点开始执行状态 (仅完整执行需要？预览可能不需要)
    if (executionType === 'full') {
      this.nodeStates[nodeId] = ExecutionStatus.RUNNING;
      const executingPayload: NodeExecutingPayload = { promptId: this.promptId, nodeId };
      this.wsManager.broadcast('NODE_EXECUTING', executingPayload); // 或者只发给相关 client?
      console.log(`[Engine-${this.promptId}] Executing node ${nodeId} (${node.fullType})...`);
    } else {
      console.log(`[Engine-${this.promptId}] Executing preview for node ${nodeId} (${node.fullType})...`);
    }


    try {
      // 检查中断标志
      if (this.isInterrupted && executionType === 'full') {
        throw new Error('Execution interrupted by user.');
      }

      // NodeGroup 逻辑已移至前端进行扁平化处理

      // TODO: 传递更丰富的上下文，包括 promptId, engine 实例等
      const context = { promptId: this.promptId };
      // 实际执行节点逻辑
      const outputs = await definition.execute(inputs, context);

      // 检查中断标志 (执行后)
      if (this.isInterrupted && executionType === 'full') {
        throw new Error('Execution interrupted by user.');
      }

      // 存储结果
      this.nodeResults[nodeId] = outputs;
      this.nodeStates[nodeId] = ExecutionStatus.COMPLETE;

      // TODO: 调用 OutputManager 保存输出 (仅限 full execution)
      // if (executionType === 'full') {
      //   await this.outputManager.saveOutputs(this.promptId, nodeId, outputs);
      // }

      // 发送节点完成状态
      this.sendNodeComplete(nodeId, outputs, executionType);
      if (executionType === 'full') {
        console.log(`[Engine-${this.promptId}] Node ${nodeId} completed.`);
      } else {
        console.log(`[Engine-${this.promptId}] Node ${nodeId} preview completed.`);
      }
      return { status: ExecutionStatus.COMPLETE };

    } catch (error: any) {
      const errorMessage = error.message || String(error);
      console.error(`[Engine-${this.promptId}] Error executing node ${nodeId} (${node.fullType}):`, errorMessage);
      this.nodeStates[nodeId] = this.isInterrupted ? ExecutionStatus.INTERRUPTED : ExecutionStatus.ERROR;

      // 发送节点错误状态
      this.sendNodeError(nodeId, errorMessage, executionType);
      return { status: this.nodeStates[nodeId], error: errorMessage };
    }
  }

  /**
   * 获取指定节点的所有下游节点 ID (递归)
   * @param nodeId 起始节点 ID
   * @returns 下游节点 ID 数组 (按拓扑顺序)
   */
  private getDownstreamNodes(nodeId: NanoId): NanoId[] {
    const downstream: NanoId[] = [];
    const visited: Set<NanoId> = new Set();
    const queue: NanoId[] = [nodeId]; // 从变更的节点开始

    // 重新进行一次拓扑排序以确保顺序正确
    const fullOrder = this.topologicalSort(this.nodes, this.edges);
    const startIndex = fullOrder.indexOf(nodeId);
    if (startIndex === -1) return []; // 节点不在图中

    // 使用队列进行广度优先搜索来查找所有可达的下游节点
    const reachable: Set<NanoId> = new Set();
    const searchQueue: NanoId[] = [nodeId];
    visited.add(nodeId);

    while (searchQueue.length > 0) {
      const currentId = searchQueue.shift()!;
      // 找到所有从 currentId 出发的边
      this.edges.forEach(edge => {
        if (edge.sourceNodeId === currentId) {
          const targetId = edge.targetNodeId;
          if (!visited.has(targetId)) {
            visited.add(targetId);
            reachable.add(targetId);
            searchQueue.push(targetId);
          }
        }
      });
    }

    // 从完整拓扑排序中筛选出可达的下游节点
    for (let i = startIndex + 1; i < fullOrder.length; i++) {
      const downstreamNodeId = fullOrder[i];
      if (reachable.has(downstreamNodeId)) {
        downstream.push(downstreamNodeId);
      }
    }

    return downstream;
  }


  // --- WebSocket 发送辅助方法 ---

  private sendNodeComplete(nodeId: NanoId, output: any, executionType: ExecutionType): void {
    const payload: NodeCompletePayload = {
      promptId: this.promptId,
      nodeId,
      output,
      executionType,
    };
    this.wsManager.broadcast('NODE_COMPLETE', payload); // 考虑是否只发给相关 client
  }

  /**
   * 处理被绕过的节点，生成伪输出。
   * @param nodeDefinition 节点定义
   * @param executionNode 执行节点数据
   * @param currentInputs 当前节点的输入值
   * @returns 生成的伪输出
   */
  private handleBypassedNode(
    nodeDefinition: NodeDefinition,
    executionNode: ExecutionNode,
    currentInputs: Record<string, any>
  ): Record<string, any> {
    const pseudoOutputs: Record<string, any> = {};
    const { bypassBehavior } = nodeDefinition;

    // 1. 如果 bypassBehavior === 'mute'，所有输出槽设为 undefined
    if (bypassBehavior === 'mute') {
      console.log(`[Engine-${this.promptId}] Node ${executionNode.id} has 'mute' bypass behavior, setting all outputs to undefined.`);
      for (const outputKey in nodeDefinition.outputs) {
        pseudoOutputs[outputKey] = undefined;
      }
      return pseudoOutputs;
    }

    // 2. 如果 bypassBehavior 是一个对象
    if (bypassBehavior && typeof bypassBehavior === 'object') {
      // 处理 passThrough 规则
      if (bypassBehavior.passThrough) {
        for (const [outputKey, inputKey] of Object.entries(bypassBehavior.passThrough)) {
          // 验证输入和输出键是否存在
          if (nodeDefinition.outputs[outputKey] && inputKey in currentInputs) {
            const outputDef = nodeDefinition.outputs[outputKey];
            const inputDef = nodeDefinition.inputs[inputKey];

            // 验证类型兼容性
            if (this.isTypeCompatible(outputDef, inputDef)) {
              pseudoOutputs[outputKey] = currentInputs[inputKey];
            } else {
              console.warn(`[Engine-${this.promptId}] Type incompatibility in passThrough for node ${executionNode.id}: ${inputKey}->${outputKey}`);
              pseudoOutputs[outputKey] = undefined;
            }
          }
        }
      }

      // 处理 defaults 规则
      if (bypassBehavior.defaults) {
        for (const [outputKey, defaultValue] of Object.entries(bypassBehavior.defaults)) {
          // 只在 passThrough 没有设置该输出时才应用默认值
          if (!(outputKey in pseudoOutputs)) {
            pseudoOutputs[outputKey] = defaultValue;
          }
        }
      }

      // 如果有任何输出都没有被处理，检查是否需要进一步设置
      for (const outputKey in nodeDefinition.outputs) {
        if (!(outputKey in pseudoOutputs)) {
          pseudoOutputs[outputKey] = this.getGenericEmptyValueForType(nodeDefinition.outputs[outputKey].dataFlowType);
        }
      }

      return pseudoOutputs;
    }

    // 3. 默认回退策略：智能穿透匹配
    console.log(`[Engine-${this.promptId}] Node ${executionNode.id} has no explicit bypass behavior, using default strategy.`);

    // 获取所有输入和输出的定义
    const inputSlotDefs = nodeDefinition.inputs || {};
    const outputSlotDefs = nodeDefinition.outputs || {};

    // 可用输入键列表
    const availableInputKeys = Object.keys(currentInputs);

    // 遍历所有输出槽
    for (const outputKey in outputSlotDefs) {
      const outputDef = outputSlotDefs[outputKey];
      let matched = false;

      // 尝试找到匹配的输入
      for (let i = 0; i < availableInputKeys.length; i++) {
        const inputKey = availableInputKeys[i];
        const inputDef = inputSlotDefs[inputKey];

        if (inputDef && this.isTypeCompatible(outputDef, inputDef)) {
          // 找到匹配的输入，设置伪输出并从可用列表中移除
          pseudoOutputs[outputKey] = currentInputs[inputKey];
          availableInputKeys.splice(i, 1); // 移除已使用的输入
          matched = true;
          break;
        }
      }

      // 如果没有找到匹配的输入，使用通用空值
      if (!matched) {
        pseudoOutputs[outputKey] = this.getGenericEmptyValueForType(outputDef.dataFlowType);
      }
    }

    return pseudoOutputs;
  }

  /**
   * 检查输出定义和输入定义之间的类型兼容性。
   * @param outputDef 输出槽定义
   * @param inputDef 输入槽定义
   * @returns 是否类型兼容
   */
  /**
   * 检查输出定义和输入定义之间的类型兼容性。
   * 实现了设计文档的连接兼容性规则。
   * @param outputDef 输出槽定义
   * @param inputDef 输入槽定义
   * @returns 是否类型兼容
   */
  private isTypeCompatible(
    outputDef: { dataFlowType: string; matchCategories?: string[] },
    inputDef: { dataFlowType: string; matchCategories?: string[] }
  ): boolean {
    // 1. 特殊行为标签检查 (BEHAVIOR_WILDCARD, BEHAVIOR_CONVERTIBLE)
    // 如果输出具有BEHAVIOR_WILDCARD标签，可以连接到任何输入
    if (outputDef.matchCategories?.includes(BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD)) {
      return true;
    }

    // 如果输入具有BEHAVIOR_WILDCARD标签，可以接受任何输出
    if (inputDef.matchCategories?.includes(BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD)) {
      return true;
    }

    // BEHAVIOR_CONVERTIBLE不在此处实际处理，但在连接时需要特殊处理

    // 2. 如果输出是 WILDCARD/CONVERTIBLE_ANY，可以匹配任何输入
    if (outputDef.dataFlowType === DataFlowType.WILDCARD ||
      outputDef.dataFlowType === DataFlowType.CONVERTIBLE_ANY) {
      return true;
    }

    // 3. 如果输入是 WILDCARD/CONVERTIBLE_ANY，可以接受任何输出
    if (inputDef.dataFlowType === DataFlowType.WILDCARD ||
      inputDef.dataFlowType === DataFlowType.CONVERTIBLE_ANY) {
      return true;
    }

    // 4. 基于 SocketMatchCategory 的优先匹配
    // 只有当输入和输出都有matchCategories时才进行
    if (outputDef.matchCategories?.length && inputDef.matchCategories?.length) {
      // 检查是否有至少一个相同的分类
      for (const category of outputDef.matchCategories) {
        if (inputDef.matchCategories.includes(category)) {
          return true;
        }
      }

      // 可以在此处添加更复杂的兼容性规则
      // 例如：某些matchCategories之间可能有预定义的兼容关系
    }

    // 5. 基于 DataFlowType 的保底匹配
    // 检查基本类型匹配
    if (outputDef.dataFlowType === inputDef.dataFlowType) {
      return true;
    }

    // 特殊类型转换 (例如 INTEGER 可以转换为 FLOAT)
    if (outputDef.dataFlowType === DataFlowType.INTEGER &&
      inputDef.dataFlowType === DataFlowType.FLOAT) {
      return true;
    }

    // STRING, INTEGER, FLOAT, BOOLEAN 可以连接到 STRING
    if (inputDef.dataFlowType === DataFlowType.STRING &&
      (outputDef.dataFlowType === DataFlowType.INTEGER ||
        outputDef.dataFlowType === DataFlowType.FLOAT ||
        outputDef.dataFlowType === DataFlowType.BOOLEAN)) {
      return true;
    }

    return false;
  }

  /**
   * 根据数据流类型获取通用空值。
   * @param dataFlowType 数据流类型
   * @returns 对应类型的通用空值
   */
  private getGenericEmptyValueForType(dataFlowType: string): any {
    switch (dataFlowType) {
      case DataFlowType.STRING:
        return '';
      case DataFlowType.INTEGER:
      case DataFlowType.FLOAT:
        return 0;
      case DataFlowType.BOOLEAN:
        return false;
      case DataFlowType.ARRAY:
        return [];
      case DataFlowType.OBJECT:
        return {};
      case DataFlowType.BINARY:
      case DataFlowType.WILDCARD:
      case DataFlowType.CONVERTIBLE_ANY:
      default:
        return null;
    }
  }

  /**
   * 发送节点被绕过的消息。
   * @param nodeId 节点ID
   * @param pseudoOutputs 伪输出数据
   */
  private sendNodeBypassed(nodeId: NanoId, pseudoOutputs: Record<string, any>): void {
    const payload = {
      promptId: this.promptId,
      nodeId,
      pseudoOutputs,
    };
    this.wsManager.broadcast('NODE_BYPASSED', payload);
  }
}