import {
  type WorkflowExecutionPayload,
  WebSocketMessageType,
  type WebSocketMessage,
  ExecutionStatus,
} from "@comfytavern/types";
import { useWorkflowManager } from "./useWorkflowManager";
import { useTabStore } from "@/stores/tabStore";
import { useExecutionStore } from "@/stores/executionStore";
import { useWebSocket } from "@/composables/useWebSocket";
import { useProjectStore } from '@/stores/projectStore';
import { useWorkflowData } from './useWorkflowData';
import { flattenWorkflow } from "@/utils/workflowFlattener";
import { transformVueFlowToExecutionPayload } from "@/utils/workflowTransformer";

/**
 * Composable for handling workflow execution logic.
 */
export function useWorkflowExecution() {
  const workflowManager = useWorkflowManager();
  const tabStore = useTabStore();
  const projectStore = useProjectStore();
  const executionStore = useExecutionStore();
  const { sendMessage } = useWebSocket();
  const workflowDataHandler = useWorkflowData();

  /**
   * 触发当前活动工作流的完整执行。
   */
  async function executeWorkflow() {
    const internalId = tabStore.activeTabId;
    if (!internalId) {
      console.error("[WorkflowExecution:executeWorkflow] No active tab found.");
      // TODO: Show user feedback (e.g., toast notification)
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
      // TODO: Show user feedback
      return;
    }

    console.info(`[WorkflowExecution:executeWorkflow] Initiating execution for tab ${internalId}...`);

    // 1. 获取当前元素
    const currentElements = workflowManager.getElements(internalId);
    if (!currentElements || currentElements.length === 0) {
        console.error(`[WorkflowExecution:executeWorkflow] No elements found for tab ${internalId}. Aborting.`);
        // TODO: Show user feedback
        return;
    }

    // 2. 扁平化工作流 (处理 NodeGroup) - 使用导入的函数
    console.info(`[WorkflowExecution:executeWorkflow] Flattening workflow for tab ${internalId}...`);
    const flattenedResult = await flattenWorkflow( // <-- Use imported function
        internalId,
        currentElements,
        workflowDataHandler, // 传递依赖
        projectStore, // 传递依赖
        workflowManager // 传递依赖
        // processedGroupIds Set is handled internally by flattenWorkflow now
    );

    if (!flattenedResult) {
        console.error(`[WorkflowExecution:executeWorkflow] Failed to flatten workflow for tab ${internalId}. Aborting.`);
        // TODO: Show user feedback
        return;
    }
    console.info(`[WorkflowExecution:executeWorkflow] Workflow flattened successfully for tab ${internalId}. Nodes: ${flattenedResult.nodes.length}, Edges: ${flattenedResult.edges.length}`);

    // 3. 转换扁平化后的状态为执行载荷
    // 使用导入的 transformer 函数
    const payload = transformVueFlowToExecutionPayload({ nodes: flattenedResult.nodes, edges: flattenedResult.edges });
    if (!payload) {
      console.error(
        `[WorkflowExecution:executeWorkflow] Failed to create execution payload from flattened state for tab ${internalId}. Aborting.`
      );
      // TODO: Show user feedback
      return;
    }

    // 4. 准备执行状态
    executionStore.prepareForNewExecution(internalId); // 重置状态但不设置 promptId

    // 5. 构建 WebSocket 消息
    // 注意：promptId 现在由后端生成并在 PROMPT_ACCEPTED_RESPONSE 中返回
    const message: WebSocketMessage<WorkflowExecutionPayload> = {
      type: WebSocketMessageType.PROMPT_REQUEST,
      payload: {
        ...payload,
        // 可选：添加 clientId 或其他元数据
        metadata: { internalId: internalId }, // 将 internalId 作为元数据发送
      },
    };

    // 6. 发送消息
    sendMessage(message);
    console.debug("[WorkflowExecution:executeWorkflow] PROMPT_REQUEST sent.", message);

    // 7. 可选：立即将状态设置为 QUEUED (或者等待 PROMPT_ACCEPTED_RESPONSE)
    // executionStore.setWorkflowStatusManually(internalId, ExecutionStatus.QUEUED);
    // 决定等待后端确认 (PROMPT_ACCEPTED_RESPONSE) 来设置 promptId 和状态

    // TODO: Show user feedback (e.g., "Execution started...")
  }

  return {
    executeWorkflow,
  };
}