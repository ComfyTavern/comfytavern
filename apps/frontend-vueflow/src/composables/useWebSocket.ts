import { readonly, onMounted, onUnmounted, watch, type Ref, computed } from "vue";
import { useExecutionStore } from "@/stores/executionStore";
import { useTabStore } from "@/stores/tabStore";
import { useWorkflowStore } from "@/stores/workflowStore";
import { useNodeStore } from "@/stores/nodeStore";
import {
  useWebSocketCore
} from '@/services/WebSocketCoreService';
import type {
  WebSocketMessage,
  PromptAcceptedResponsePayload,
  ExecutionStatusUpdatePayload,
  NodeExecutingPayload,
  NodeProgressPayload,
  NodeCompletePayload,
  NodeErrorPayload,
  NodeYieldPayload,
  WorkflowInterfaceYieldPayload,
  NodesReloadedPayload,
} from "@comfytavern/types";

import {
  WebSocketMessageType,
  ExecutionStatus,
} from "@comfytavern/types";

// --- Module-level state ---
let executionStore: ReturnType<typeof useExecutionStore> | null = null;
let tabStore: ReturnType<typeof useTabStore> | null = null;
let workflowStore: ReturnType<typeof useWorkflowStore> | null = null;
let nodeStore: ReturnType<typeof useNodeStore> | null = null;
let activeTabId: Ref<string | null> | null = null;

// -- Refactored State v2 --
let initiatingExecutionId: string | null = null;
const promptIdToExecutionIdMap = new Map<string, string>();
// 缓冲区，用于处理乱序的WebSocket消息
const messageBuffer = new Map<string, WebSocketMessage<any>[]>();
// 记录已完成的执行，防止重复处理
const completedExecutionIds = new Set<string>();
// 记录待处理的清理任务
const pendingCleanups = new Map<string, ReturnType<typeof setTimeout>>();


let isRouterInitialized = false;
let unsubscribeFromCore: (() => void) | null = null;

// --- Private methods ---

const ensureStoresInitialized = () => {
  if (!executionStore) executionStore = useExecutionStore();
  if (!tabStore) tabStore = useTabStore();
  if (!workflowStore) workflowStore = useWorkflowStore();
  if (!nodeStore) nodeStore = useNodeStore();
  if (!activeTabId && tabStore) {
    activeTabId = computed(() => tabStore?.activeTabId ?? null);
  }
};

const cleanupExecution = (executionId: string) => {
  // 如果该执行ID已有待处理的清理任务，先取消它
  if (pendingCleanups.has(executionId)) {
    clearTimeout(pendingCleanups.get(executionId)!);
    pendingCleanups.delete(executionId);
  }

  console.log(`[WebSocketRouter] Scheduling cleanup for executionId: ${executionId} in 5 seconds.`);

  // 设置一个定时器，在5秒后执行清理
  const cleanupTimer = setTimeout(() => {
    console.log(`[WebSocketRouter] Executing delayed cleanup for executionId: ${executionId}`);

    // 查找并删除相关的 promptId 映射和缓冲区
    let promptIdToDelete: string | null = null;
    for (const [promptId, execId] of promptIdToExecutionIdMap.entries()) {
      if (execId === executionId) {
        promptIdToDelete = promptId;
        break;
      }
    }

    if (promptIdToDelete) {
      promptIdToExecutionIdMap.delete(promptIdToDelete);
      messageBuffer.delete(promptIdToDelete);
      console.log(`[WebSocketRouter] Cleaned up mapping and buffer for promptId: ${promptIdToDelete} (executionId: ${executionId})`);
    }

    // 从待处理列表中移除自己
    pendingCleanups.delete(executionId);
  }, 5000); // 5秒的宽限期

  // 将新的清理任务记录到待处理列表
  pendingCleanups.set(executionId, cleanupTimer);
};


const handleRawMessage = (message: WebSocketMessage<any>) => {
  ensureStoresInitialized();
  if (!executionStore || !workflowStore || !nodeStore) {
    console.error("[WebSocketRouter] Core stores not properly initialized.");
    return;
  }

  try {
    // console.debug("WebSocketRouter message received:", message);
    const payload = message.payload as any;
    const messagePromptId = payload?.promptId;

    // 1. 处理全局非执行类消息
    if (!messagePromptId && message.type !== WebSocketMessageType.PROMPT_ACCEPTED_RESPONSE) {
      if (message.type === WebSocketMessageType.WORKFLOW_LIST) {
        workflowStore.fetchAvailableWorkflows();
      } else if (message.type === WebSocketMessageType.NODES_RELOADED) {
        nodeStore.handleNodesReloadedNotification(payload as NodesReloadedPayload);
      } else if (message.type !== WebSocketMessageType.ERROR){
        console.warn(`[WebSocketRouter] Received message without promptId. Type: ${message.type}.`, payload);
      }
      return;
    }

    // 2. 核心路由逻辑
    const acceptedPromptId = (message.type === WebSocketMessageType.PROMPT_ACCEPTED_RESPONSE)
      ? (payload as PromptAcceptedResponsePayload).promptId
      : messagePromptId;

    if (!acceptedPromptId) {
      console.error("[WebSocketRouter] Message related to execution is missing promptId.", message);
      return;
    }

    // 2a. 认领阶段: PROMPT_ACCEPTED_RESPONSE 到达
    if (message.type === WebSocketMessageType.PROMPT_ACCEPTED_RESPONSE) {
      if (initiatingExecutionId) {
        promptIdToExecutionIdMap.set(acceptedPromptId, initiatingExecutionId);
        console.debug(`[WebSocketRouter] Mapped promptId ${acceptedPromptId} to executionId ${initiatingExecutionId}.`);
        
        const targetExecutionId = initiatingExecutionId;
        initiatingExecutionId = null; 

        // 优先处理当前接受消息
        processExecutionMessage(message, targetExecutionId);

        // 处理该 promptId 的所有缓冲消息
        const bufferedMessages = messageBuffer.get(acceptedPromptId);
        if (bufferedMessages) {
          console.log(`[WebSocketRouter] Processing ${bufferedMessages.length} buffered messages for promptId ${acceptedPromptId}`);
          bufferedMessages.forEach(bufferedMsg => processExecutionMessage(bufferedMsg, targetExecutionId));
          messageBuffer.delete(acceptedPromptId);
        }
      } else {
        console.error("[WebSocketRouter] Received PROMPT_ACCEPTED_RESPONSE but no initiating execution was recorded.");
      }
      return;
    }
    
    // 2b. 路由或缓冲阶段
    let targetExecutionId = promptIdToExecutionIdMap.get(acceptedPromptId);

    if (targetExecutionId) {
       // 如果执行已标记为完成，则忽略后续消息
       if (completedExecutionIds.has(targetExecutionId)) {
        console.debug(`[WebSocketRouter] Ignoring message for already completed execution ${targetExecutionId}`);
        return;
      }
      processExecutionMessage(message, targetExecutionId);
    } else {
      // 缓冲未知 promptId 的消息
      console.log(`[WebSocketRouter] Buffering message for unknown promptId ${acceptedPromptId}. Type: ${message.type}.`);
      if (!messageBuffer.has(acceptedPromptId)) {
        messageBuffer.set(acceptedPromptId, []);
      }
      messageBuffer.get(acceptedPromptId)!.push(message);
    }

  } catch (e) {
    console.error("[WebSocketRouter] Failed to process message:", e);
  }
};


/**
 * 将解析后的消息派发到 executionStore
 */
const processExecutionMessage = (message: WebSocketMessage<any>, executionId: string) => {
  if (!executionStore) {
    console.error("[WebSocketRouter] executionStore not initialized.");
    return;
  }
  const payload = message.payload;
  const currentActiveTabId = activeTabId?.value;
  
  // 对于非活动标签页，只处理最终状态消息
  const isTabExecution = executionId.startsWith('tab_');
  if (isTabExecution && currentActiveTabId && executionId !== currentActiveTabId) {
    const isFinalState =
      (message.type === WebSocketMessageType.EXECUTION_STATUS_UPDATE &&
        (payload.status === ExecutionStatus.COMPLETE || payload.status === ExecutionStatus.ERROR || payload.status === ExecutionStatus.INTERRUPTED)) ||
      message.type === WebSocketMessageType.ERROR;

    if (!isFinalState) {
      return; 
    }
  }

  // 派发消息
  switch (message.type) {
    case WebSocketMessageType.PROMPT_ACCEPTED_RESPONSE:
      executionStore.handlePromptAccepted(executionId, payload as PromptAcceptedResponsePayload);
      break;
    case WebSocketMessageType.EXECUTION_STATUS_UPDATE: {
      const statusPayload = payload as ExecutionStatusUpdatePayload;
      executionStore.updateWorkflowStatus(executionId, statusPayload);
      
      // 清理阶段
      if (statusPayload.status === ExecutionStatus.COMPLETE || statusPayload.status === ExecutionStatus.ERROR || statusPayload.status === ExecutionStatus.INTERRUPTED) {
        // 如果已经处理过这个执行的完成状态，则忽略，防止重复调度清理
        if (completedExecutionIds.has(executionId)) {
          console.debug(`[WebSocketRouter] Ignoring duplicate final status message for completed execution ${executionId}`);
          break; // 使用 break 跳出 switch case
        }
        // 立即标记为完成，以防止后续消息（包括重复的完成消息）被再次处理
        console.log(`[WebSocketRouter] Execution ${executionId} marked as completed. Final status: ${statusPayload.status}`);
        completedExecutionIds.add(executionId);

        // 安排延迟清理
        cleanupExecution(executionId);
      }
      break;
    }
    case WebSocketMessageType.NODE_EXECUTING:
      executionStore.updateNodeExecuting(executionId, payload as NodeExecutingPayload);
      break;
    case WebSocketMessageType.NODE_PROGRESS:
      executionStore.updateNodeProgress(executionId, payload as NodeProgressPayload);
      break;
    case WebSocketMessageType.NODE_COMPLETE:
      executionStore.updateNodeExecutionResult(executionId, payload as NodeCompletePayload);
      break;
    case WebSocketMessageType.NODE_ERROR:
      executionStore.updateNodeError(executionId, payload as NodeErrorPayload);
      break;
    case WebSocketMessageType.NODE_YIELD:
      executionStore.handleNodeYield(executionId, payload as NodeYieldPayload);
      break;
    case WebSocketMessageType.WORKFLOW_INTERFACE_YIELD:
      executionStore.handleWorkflowInterfaceYield(executionId, payload as WorkflowInterfaceYieldPayload);
      break;
    case WebSocketMessageType.ERROR: {
     // 检查是否已经标记为完成，以防万一
      if (completedExecutionIds.has(executionId)) {
        console.debug(`[WebSocketRouter] Ignoring global error for already completed execution ${executionId}`);
        break;
      }

      const errorPayload = payload as { message: string; details?: any };
      console.error(`[WebSocketRouter] Received GLOBAL ERROR message for execution ${executionId}: ${errorPayload.message}`);
      
      // 更新状态
      executionStore.updateWorkflowStatus(executionId, {
        promptId: payload?.promptId || executionStore.getCurrentPromptId(executionId) || 'unknown',
        status: ExecutionStatus.ERROR,
        errorInfo: { message: errorPayload.message, details: errorPayload.details },
      });

      // 立即标记为完成并安排清理
      console.log(`[WebSocketRouter] Execution ${executionId} marked as completed due to GLOBAL ERROR.`);
      completedExecutionIds.add(executionId);
      cleanupExecution(executionId);
      break;
    }
    default:
      console.warn(`[WebSocketRouter] Unhandled execution message type for ID ${executionId}: ${message.type}`);
      break;
  }
};


// --- Public API ---

export const setInitiatingExecution = (executionId: string) => {
  console.log(`[WebSocketRouter] Setting initiating execution for next prompt: ${executionId}`);

  // 1. 立即取消任何为该 executionId 安排的待处理清理任务
  if (pendingCleanups.has(executionId)) {
    console.log(`[WebSocketRouter] Cancelling pending cleanup for reused executionId: ${executionId}`);
    clearTimeout(pendingCleanups.get(executionId)!);
    pendingCleanups.delete(executionId);
  }

  // 2. 立即移除任何与此 executionId 关联的旧映射
  // 这可以防止新执行被错误地路由到已完成的旧 promptId
  let oldPromptId: string | null = null;
  for (const [promptId, execId] of promptIdToExecutionIdMap.entries()) {
    if (execId === executionId) {
      oldPromptId = promptId;
      break;
    }
  }
  if (oldPromptId) {
    console.log(`[WebSocketRouter] Immediately cleaning up old promptId ${oldPromptId} for new execution using ID ${executionId}`);
    promptIdToExecutionIdMap.delete(oldPromptId);
    messageBuffer.delete(oldPromptId);
  }

  // 3. 设置新的发起执行ID
  initiatingExecutionId = executionId;
  
  // 4. 从已完成集合中移除，允许此ID被重新执行
  completedExecutionIds.delete(executionId);
};


export function useWebSocket() {
  const wsCore = useWebSocketCore();

  const initialize = () => {
    if (isRouterInitialized) return;
    ensureStoresInitialized();
    unsubscribeFromCore = wsCore.subscribe(handleRawMessage);
    console.log('[WebSocketRouter] Initialized and subscribed to core service.');
    isRouterInitialized = true;
  };
  
  onMounted(() => {
    initialize();
    watch(() => activeTabId?.value, (newTabId, oldTabId) => {
      if (newTabId !== oldTabId) {
        console.log(`[WebSocketRouter] Active tab changed from ${oldTabId} to ${newTabId}`);
      }
    });
  });

  onUnmounted(() => {
    if (unsubscribeFromCore) {
      unsubscribeFromCore();
      console.log('[WebSocketRouter] Unsubscribed from core service.');
    }
    isRouterInitialized = false;
  });

  return {
    isConnected: readonly(wsCore.isConnected),
    error: readonly(wsCore.error),
    sendMessage: wsCore.sendMessage,
    setInitiatingExecution,
  };
}
