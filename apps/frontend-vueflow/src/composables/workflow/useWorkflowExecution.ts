import { useWebSocket } from "@/composables/useWebSocket";
import { useExecutionStore } from "@/stores/executionStore";
import { useProjectStore } from "@/stores/projectStore";
import { useTabStore } from "@/stores/tabStore";
import { flattenWorkflow } from "@/utils/workflowFlattener";
import {
  transformVueFlowToCoreWorkflow,
  transformVueFlowToExecutionPayload,
} from "@/utils/workflowTransformer";
import {
  type WebSocketMessage,
  type WorkflowExecutionPayload,
  DataFlowType,
  ExecutionStatus,
  WebSocketMessageType,
} from "@comfytavern/types";
import type { FlowExportObject, Edge as VueFlowEdge, Node as VueFlowNode } from "@vue-flow/core"; // 新增导入
import { klona } from "klona/full"; // 新增导入
import { useDialogService } from "../../services/DialogService"; // 导入 DialogService
import { useWorkflowData } from "./useWorkflowData";
import { useWorkflowManager } from "./useWorkflowManager";

/**
 * Composable for handling workflow execution logic.
 */
export function useWorkflowExecution() {
  const workflowManager = useWorkflowManager();
  const tabStore = useTabStore();
  const projectStore = useProjectStore();
  const executionStore = useExecutionStore();
  const { sendMessage, setInitiatingTabForNextPrompt } = useWebSocket(); // 获取 setInitiatingTabForNextPrompt
  const workflowDataHandler = useWorkflowData();
  const dialogService = useDialogService(); // 获取 DialogService 实例

  /**
   * 触发当前活动工作流的完整执行。
   */
  async function executeWorkflow() {
    const internalId = tabStore.activeTabId;
    if (!internalId) {
      console.error("[WorkflowExecution:executeWorkflow] No active tab found.");
      dialogService.showError("请先选择一个标签页。"); // 与 StatusBar.vue 保持一致
      return;
    }

    const currentStatus = executionStore.getWorkflowStatus(internalId);
    if (currentStatus === ExecutionStatus.RUNNING || currentStatus === ExecutionStatus.QUEUED) {
      console.warn(
        `[WorkflowExecution:executeWorkflow] Workflow for tab ${internalId} is already ${currentStatus}. Execution request ignored.`
      );
      // TODO: Show user feedback (e.g., toast notification "Workflow is already running/queued")
      return;
    }

    console.info(
      `[WorkflowExecution:executeWorkflow] Initiating execution for tab ${internalId}...`
    );
    setInitiatingTabForNextPrompt(internalId); // 设置发起标签页

    // 1. 获取初始的当前元素
    const initialElements = workflowManager.getElements(internalId);
    if (!initialElements || initialElements.length === 0) {
      console.error(
        `[WorkflowExecution:executeWorkflow] No initial elements found for tab ${internalId}. Aborting.`
      );
      dialogService.showError("画布上没有元素可执行。");
      return;
    }

    // 2. 从初始元素派生出 VueFlow 节点和边，用于客户端脚本上下文
    const initialVueFlowNodes = initialElements.filter((el) => !("source" in el)) as VueFlowNode[];
    const initialVueFlowEdges = initialElements.filter((el) => "source" in el) as VueFlowEdge[];

    // 3. 执行客户端脚本钩子 (这些脚本会通过 workflowManager.updateNodeData 更新 store)
    const clientScriptHookName = "onWorkflowExecute";
    if (initialVueFlowNodes.length > 0) {
      console.log(
        `[WorkflowExecution] Attempting to run '${clientScriptHookName}' hook for ${initialVueFlowNodes.length} nodes.`
      );
      for (const node of initialVueFlowNodes) {
        // 迭代初始快照
        const executor = executionStore.getNodeClientScriptExecutor(node.id);
        if (executor) {
          try {
            console.debug(
              `[WorkflowExecution] Executing client script hook '${clientScriptHookName}' for node ${node.id}`
            );
            // hookContext 使用克隆的初始状态，避免脚本间意外串改传递的上下文对象本身
            const hookContext = {
              nodeId: node.id,
              workflowContext: {
                nodes: klona(initialVueFlowNodes),
                edges: klona(initialVueFlowEdges),
              },
            };
            await executor(clientScriptHookName, hookContext); // executor 内部调用 setNodeOutputValue -> workflowManager.updateNodeData
          } catch (e) {
            console.warn(
              `[WorkflowExecution] Client script hook '${clientScriptHookName}' for node ${node.id} failed:`,
              e
            );
          }
        }
      }
    }

    // 4. 在所有客户端脚本执行完毕后，从 store 重新获取最新的元素状态
    // 这是为了确保 flattenWorkflow 处理的是包含了所有脚本更新的最终状态
    const elementsAfterClientScripts = workflowManager.getElements(internalId);
    if (!elementsAfterClientScripts || elementsAfterClientScripts.length === 0) {
      console.error(
        `[WorkflowExecution:executeWorkflow] Elements became empty or invalid after client scripts for tab ${internalId}. Aborting.`
      );
      dialogService.showError("执行客户端脚本后画布状态错误。");
      return;
    }
    console.info(
      `[WorkflowExecution:executeWorkflow] Fetched ${elementsAfterClientScripts.length} elements after client scripts.`
    );

    // 5. 使用更新后的元素进行扁平化工作流
    console.info(
      `[WorkflowExecution:executeWorkflow] Flattening workflow for tab ${internalId} using elements after client scripts...`
    );
    const flattenedResult = await flattenWorkflow(
      internalId,
      elementsAfterClientScripts, // 使用执行完客户端脚本后的最新元素
      workflowDataHandler,
      projectStore,
      workflowManager
    );

    if (!flattenedResult) {
      console.error(
        `[WorkflowExecution:executeWorkflow] Failed to flatten workflow for tab ${internalId}. Aborting.`
      );
      // TODO: Show user feedback
      return;
    }
    console.info(
      `[WorkflowExecution:executeWorkflow] Workflow flattened successfully for tab ${internalId}. Nodes: ${flattenedResult.nodes.length}, Edges: ${flattenedResult.edges.length}`
    );

    // 重新引入 transformVueFlowToCoreWorkflow 步骤
    // 假设 flattenedResult.nodes 和 .edges 是 VueFlowElement 类型或者兼容的
    // （需要确保 flattenWorkflow 返回的类型与 VueFlowNode/VueFlowEdge 兼容，或者进行适配）
    const defaultViewport = { x: 0, y: 0, zoom: 1 };
    const tempFlowExport: FlowExportObject = {
      nodes: flattenedResult.nodes as VueFlowNode[], // 强制类型转换，需要验证 flattenWorkflow 的输出类型
      edges: flattenedResult.edges as VueFlowEdge[], // 强制类型转换
      viewport: defaultViewport, // 使用默认/虚拟视口
      position: [defaultViewport.x, defaultViewport.y], // 补上 position
      zoom: defaultViewport.zoom, // 补上 zoom
    };

    const coreWorkflowData = transformVueFlowToCoreWorkflow(tempFlowExport);
    if (!coreWorkflowData || !coreWorkflowData.nodes) {
      console.error(
        `[WorkflowExecution:executeWorkflow] Failed to transform flattened workflow to core data for tab ${internalId}. Aborting.`
      );
      // TODO: Show user feedback
      return;
    }
    console.info(
      `[WorkflowExecution:executeWorkflow] Workflow transformed to core data successfully for tab ${internalId}. Nodes: ${coreWorkflowData.nodes.length}, Edges: ${coreWorkflowData.edges.length}`
    );

    // 3. 使用转换后的核心数据构建执行载荷
    const payload = transformVueFlowToExecutionPayload({
      nodes: coreWorkflowData.nodes,
      edges: coreWorkflowData.edges,
    });
    if (!payload) {
      console.error(
        `[WorkflowExecution:executeWorkflow] Failed to create execution payload from core data for tab ${internalId}. Aborting.`
      );
      // TODO: Show user feedback
      return;
    }

    // 新增：构建 outputInterfaceMappings
    const outputInterfaceMappings: Record<string, { sourceNodeId: string; sourceSlotKey: string }> =
      {};
    const activeWorkflowData = workflowManager.getWorkflowData(internalId);

    if (
      activeWorkflowData &&
      activeWorkflowData.interfaceOutputs &&
      Object.keys(activeWorkflowData.interfaceOutputs).length > 0
    ) {
      // 在扁平化后的节点列表 (coreWorkflowData.nodes) 中查找 GroupOutput 节点
      // 假设 coreWorkflowData.nodes 中的节点有 id 和 type 属性
      const groupOutputNode = coreWorkflowData.nodes.find(
        (node) => node.type === "core:GroupOutput"
      );

      if (groupOutputNode) {
        for (const interfaceKey in activeWorkflowData.interfaceOutputs) {
          // 在扁平化后的边列表 (coreWorkflowData.edges) 中查找
          // 假设 coreWorkflowData.edges 中的边有 target, targetHandle, source, sourceHandle 属性
          const edgeConnectedToGroupOutputSlot = coreWorkflowData.edges.find(
            (edge) =>
              edge.target === groupOutputNode.id && // 使用扁平化图中 GroupOutput 节点的 ID
              edge.targetHandle === interfaceKey
          );

          if (
            edgeConnectedToGroupOutputSlot &&
            edgeConnectedToGroupOutputSlot.source &&
            edgeConnectedToGroupOutputSlot.sourceHandle
          ) {
            outputInterfaceMappings[interfaceKey] = {
              sourceNodeId: edgeConnectedToGroupOutputSlot.source,
              sourceSlotKey: edgeConnectedToGroupOutputSlot.sourceHandle,
            };
          } else {
            const slotInfo = activeWorkflowData.interfaceOutputs[interfaceKey];
            if (slotInfo) {
              if (slotInfo.dataFlowType !== DataFlowType.CONVERTIBLE_ANY) {
                console.debug(
                  `[WorkflowExecution:executeWorkflow] No valid edge found (in coreWorkflowData.edges) connecting to GroupOutput node's slot '${interfaceKey}' (type: ${slotInfo.dataFlowType}) for workflow ${internalId}. This interface output will not be mapped and will likely be undefined.`
                );
              }
              // 对于 CONVERTIBLE_ANY 类型，如果未连接，则不发出警告或日志
            } else {
              // 如果 slotInfo 未定义，这可能是一个潜在问题，可以保留一个警告
              console.warn(
                `[WorkflowExecution:executeWorkflow] Slot info for interfaceKey '${interfaceKey}' not found in activeWorkflowData.interfaceOutputs for workflow ${internalId}. Cannot determine if it's CONVERTIBLE_ANY.`
              );
            }
            // 不为没有有效连接的 interfaceKey 创建映射
            // outputInterfaceMappings[interfaceKey] = { sourceNodeId: '', sourceSlotKey: '' };
          }
        }
      } else {
        console.warn(
          `[WorkflowExecution:executeWorkflow] No GroupOutput node found in coreWorkflowData.nodes for workflow ${internalId} to map interfaceOutputs.`
        );
      }
    }
    // 保留这个关键日志，但改为 console.debug，如果 outputInterfaceMappings 不大，可以接受
    console.debug(
      "[WorkflowExecution:executeWorkflow] Final generated outputInterfaceMappings:",
      klona(outputInterfaceMappings)
    );
    // 结束新增

    // 4. 准备执行状态 (此步骤在原始 StatusBar.vue 中没有，但在旧版 useWorkflowExecution 中有)
    // executionStore.prepareForNewExecution(internalId); // 暂时注释，以更接近 StatusBar 的成功路径

    // 5. 构建 WebSocket 消息
    const message: WebSocketMessage<WorkflowExecutionPayload> = {
      type: WebSocketMessageType.PROMPT_REQUEST,
      payload: {
        ...payload, // 包含扁平化后的 nodes 和 edges
        ...(Object.keys(outputInterfaceMappings).length > 0 && { outputInterfaceMappings }), // 条件性添加
        // 从 activeWorkflowData 中获取 interfaceInputs 和 interfaceOutputs
        interfaceInputs: activeWorkflowData?.interfaceInputs || {},
        interfaceOutputs: activeWorkflowData?.interfaceOutputs || {}, // 保持完整性，即使后端可能主要关注 inputs
        metadata: {
          internalId: internalId,
          workflowId: activeWorkflowData?.id,
          workflowName: activeWorkflowData?.name,
          projectId: projectStore.currentProjectId,
          version: projectStore.currentProjectMetadata?.version,
        },
      },
    };
    // 6. 发送消息
    sendMessage(message);
    console.debug("[WorkflowExecution:executeWorkflow] PROMPT_REQUEST sent.", message); // Original debug, good to keep

    // 7. 设置状态为 QUEUED (与 StatusBar.vue 行为一致)
    executionStore.setWorkflowStatusManually(internalId, ExecutionStatus.QUEUED);
    // prepareForNewExecution 应该在状态更新之前或作为其一部分，以避免状态竞争
    // executionStore.prepareForNewExecution(internalId); // 确保在设置 QUEUED 之前或之后一致地调用

    // TODO: Show user feedback (e.g., "Execution started...")
  }

  return {
    executeWorkflow,
  };
}
