import {
  type WorkflowExecutionPayload,
  WebSocketMessageType,
  type WebSocketMessage,
  ExecutionStatus,
} from "@comfytavern/types";
import type { Node as VueFlowNode, Edge as VueFlowEdge } from "@vue-flow/core"; // 咕咕：新增导入
import { klona } from "klona/full"; // 咕咕：新增导入
import { useWorkflowManager } from "./useWorkflowManager";
import { useTabStore } from "@/stores/tabStore";
import { useExecutionStore } from "@/stores/executionStore";
import { useWebSocket } from "@/composables/useWebSocket";
import { useProjectStore } from '@/stores/projectStore';
import { useWorkflowData } from './useWorkflowData';
import { flattenWorkflow } from "@/utils/workflowFlattener";
import {
  transformVueFlowToExecutionPayload,
  transformVueFlowToCoreWorkflow, // 咕咕：新增导入
} from "@/utils/workflowTransformer";
import type { FlowExportObject } from "@vue-flow/core"; // 咕咕：新增导入

/**
 * Composable for handling workflow execution logic.
 */
export function useWorkflowExecution() {
  const workflowManager = useWorkflowManager();
  const tabStore = useTabStore();
  const projectStore = useProjectStore();
  const executionStore = useExecutionStore();
  const { sendMessage, setInitiatingTabForNextPrompt } = useWebSocket(); // 咕咕：获取 setInitiatingTabForNextPrompt
  const workflowDataHandler = useWorkflowData();

  /**
   * 触发当前活动工作流的完整执行。
   */
  async function executeWorkflow() {
    const internalId = tabStore.activeTabId;
    if (!internalId) {
      console.error("[WorkflowExecution:executeWorkflow] No active tab found.");
      alert("请先选择一个标签页。"); // 咕咕：与 StatusBar.vue 保持一致
      return;
    }

    const currentStatus = executionStore.getWorkflowStatus(internalId);
    if (
      currentStatus === ExecutionStatus.RUNNING ||
      currentStatus === ExecutionStatus.QUEUED
    ) {
      console.warn(
        `[WorkflowExecution:executeWorkflow] Workflow for tab ${internalId} is already ${currentStatus}. Execution request ignored.`
      );
      // TODO: Show user feedback (e.g., toast notification "Workflow is already running/queued")
      return;
    }

    console.info(`[WorkflowExecution:executeWorkflow] Initiating execution for tab ${internalId}...`);
    setInitiatingTabForNextPrompt(internalId); // 咕咕：设置发起标签页

    // 1. 获取当前元素
    let currentElements = workflowManager.getElements(internalId); // 咕咕：设为 let 以便可能被修改
    if (!currentElements || currentElements.length === 0) {
        console.error(`[WorkflowExecution:executeWorkflow] No elements found for tab ${internalId}. Aborting.`);
        alert("画布上没有元素可执行。"); // 咕咕：与 StatusBar.vue 保持一致
        return;
    }

    // 咕咕：在扁平化之前，为每个节点触发客户端脚本钩子 (逻辑从 StatusBar.vue 迁移)
    const vueFlowNodes = currentElements.filter(el => !('source' in el)) as VueFlowNode[];
    const vueFlowEdges = currentElements.filter(el => 'source' in el) as VueFlowEdge[]; // 虽然未使用，但保持结构完整

    const clientScriptHookName = 'onWorkflowExecute';
    if (vueFlowNodes && vueFlowNodes.length > 0) {
      console.log(`[WorkflowExecution] Attempting to run '${clientScriptHookName}' hook for ${vueFlowNodes.length} nodes.`);
      for (const node of vueFlowNodes) {
        const executor = executionStore.getNodeClientScriptExecutor(node.id);
        if (executor) {
          try {
            console.debug(`[WorkflowExecution] Executing client script hook '${clientScriptHookName}' for node ${node.id}`);
            const hookContext = {
              nodeId: node.id,
              workflowContext: {
                nodes: klona(vueFlowNodes), // 传递整个画布的节点快照
                edges: klona(vueFlowEdges), // 传递整个画布的边快照
              },
            };
            await executor(clientScriptHookName, hookContext);
            // 假设 executor 修改了 node.data 或其他属性，这些修改会反映在 vueFlowNodes 中的对应节点上
            // 并因此反映在 currentElements 中的对应节点上，因为它们是引用相同的对象
          } catch (e) {
            console.warn(`[WorkflowExecution] Client script hook '${clientScriptHookName}' for node ${node.id} failed:`, e);
            // 决定仅记录警告并继续，与 StatusBar.vue 行为一致
          }
        }
      }
      // 客户端脚本执行后，currentElements 中的节点可能已被修改
      // 无需显式更新 currentElements，因为 vueFlowNodes 中的对象是 currentElements 中对象的引用
    }


    // 2. 扁平化工作流 (处理 NodeGroup) - 使用导入的函数
    // currentElements 可能已被客户端脚本修改
    console.info(`[WorkflowExecution:executeWorkflow] Flattening workflow for tab ${internalId}...`);
    const flattenedResult = await flattenWorkflow(
        internalId,
        currentElements, // 使用可能已被客户端脚本修改的 currentElements
        workflowDataHandler,
        projectStore,
        workflowManager
    );

    if (!flattenedResult) {
        console.error(`[WorkflowExecution:executeWorkflow] Failed to flatten workflow for tab ${internalId}. Aborting.`);
        // TODO: Show user feedback
        return;
    }
    console.info(`[WorkflowExecution:executeWorkflow] Workflow flattened successfully for tab ${internalId}. Nodes: ${flattenedResult.nodes.length}, Edges: ${flattenedResult.edges.length}`);

    // 咕咕：重新引入 transformVueFlowToCoreWorkflow 步骤
    // 假设 flattenedResult.nodes 和 .edges 是 VueFlowElement 类型或者兼容的
    // （需要确保 flattenWorkflow 返回的类型与 VueFlowNode/VueFlowEdge 兼容，或者进行适配）
    const defaultViewport = { x: 0, y: 0, zoom: 1 };
    const tempFlowExport: FlowExportObject = {
      nodes: flattenedResult.nodes as VueFlowNode[], // 强制类型转换，需要验证 flattenWorkflow 的输出类型
      edges: flattenedResult.edges as VueFlowEdge[], // 强制类型转换
      viewport: defaultViewport, // 使用默认/虚拟视口
      position: [defaultViewport.x, defaultViewport.y], // 咕咕：补上 position
      zoom: defaultViewport.zoom, // 咕咕：补上 zoom
    };

    const coreWorkflowData = transformVueFlowToCoreWorkflow(tempFlowExport);
    if (!coreWorkflowData || !coreWorkflowData.nodes) {
      console.error(
        `[WorkflowExecution:executeWorkflow] Failed to transform flattened workflow to core data for tab ${internalId}. Aborting.`
      );
      // TODO: Show user feedback
      return;
    }
    console.info(`[WorkflowExecution:executeWorkflow] Workflow transformed to core data successfully for tab ${internalId}. Nodes: ${coreWorkflowData.nodes.length}, Edges: ${coreWorkflowData.edges.length}`);

    // 3. 使用转换后的核心数据构建执行载荷
    const payload = transformVueFlowToExecutionPayload({ nodes: coreWorkflowData.nodes, edges: coreWorkflowData.edges });
    if (!payload) {
      console.error(
        `[WorkflowExecution:executeWorkflow] Failed to create execution payload from core data for tab ${internalId}. Aborting.`
      );
      // TODO: Show user feedback
      return;
    }

    // 4. 准备执行状态 (此步骤在原始 StatusBar.vue 中没有，但在旧版 useWorkflowExecution 中有)
    // executionStore.prepareForNewExecution(internalId); // 暂时注释，以更接近 StatusBar 的成功路径

    // 5. 构建 WebSocket 消息
    const message: WebSocketMessage<WorkflowExecutionPayload> = {
      type: WebSocketMessageType.PROMPT_REQUEST,
      payload: {
        ...payload,
        metadata: { internalId: internalId },
      },
    };

    // 6. 发送消息
    sendMessage(message);
    console.debug("[WorkflowExecution:executeWorkflow] PROMPT_REQUEST sent.", message);

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