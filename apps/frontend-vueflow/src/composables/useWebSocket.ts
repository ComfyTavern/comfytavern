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

// 用于记录下一个 prompt 请求是由哪个 tab 或 panel 发起的
let initiatingTabIdForNextPrompt: string | null = null;
// 存储所有活跃的面板执行 ID
const panelExecutionIds = new Set<string>();
// 核心映射：将后端的 promptId 映射到前端的 panelExecutionId
const promptIdToPanelExecutionIdMap = new Map<string, string>();

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

const handleRawMessage = (message: WebSocketMessage<any>) => {
  ensureStoresInitialized();
  if (
    !executionStore || !tabStore || !workflowStore || !nodeStore || !activeTabId
  ) {
    console.error("[WebSocketRouter] Stores not properly initialized during message handling.");
    return;
  }

  try {
    console.debug("WebSocketRouter message received:", message);

    const payload = message.payload as any;
    const internalId = payload?.internalId;
    const currentActiveTabId = activeTabId.value;

    // --- 1. 优先处理 PROMPT_ACCEPTED_RESPONSE (认领 promptId) ---
    if (message.type === WebSocketMessageType.PROMPT_ACCEPTED_RESPONSE) {
      if (initiatingTabIdForNextPrompt) {
        const targetId = initiatingTabIdForNextPrompt;
        initiatingTabIdForNextPrompt = null; // 认领后立即清除

        const acceptedPayload = payload as PromptAcceptedResponsePayload;
        // 如果是面板发起的执行，则创建 promptId 到其唯一执行ID的映射
        if (panelExecutionIds.has(targetId)) {
          promptIdToPanelExecutionIdMap.set(acceptedPayload.promptId, targetId);
        }

        console.debug(`[WebSocketRouter] Routing PROMPT_ACCEPTED_RESPONSE to initiating tab/panel: ${targetId}`);
        processExecutionMessage(message, targetId);
      } else {
        console.error("[WebSocketRouter] Received PROMPT_ACCEPTED_RESPONSE but no initiating tab/panel was recorded. Ignoring.");
      }
      return; // 处理完毕
    }

    const messagePromptId = payload?.promptId;

    // --- 2. 其次处理与已知面板PromptID相关的消息 ---
    if (messagePromptId && promptIdToPanelExecutionIdMap.has(messagePromptId)) {
      const panelExecutionId = promptIdToPanelExecutionIdMap.get(messagePromptId)!;
      console.debug(`[WebSocketRouter] Routing message with promptId ${messagePromptId} to Panel Execution: ${panelExecutionId}`);
      processExecutionMessage(message, panelExecutionId);

      // 在执行结束时清理映射和注册
      if (message.type === WebSocketMessageType.EXECUTION_STATUS_UPDATE &&
        (payload.status === ExecutionStatus.COMPLETE || payload.status === ExecutionStatus.ERROR || payload.status === ExecutionStatus.INTERRUPTED)) {
        promptIdToPanelExecutionIdMap.delete(messagePromptId);
        unregisterPanelExecution(panelExecutionId);
      }
      return; // 处理完毕
    }

    // --- 3. (回退) 处理其他面板执行消息 (依赖 internalId) ---
    if (internalId && panelExecutionIds.has(internalId)) {
      console.debug(`[WebSocketRouter] Routing message for Panel Execution (fallback by internalId): ${internalId}`);
      processExecutionMessage(message, internalId);
      if (message.type === WebSocketMessageType.EXECUTION_STATUS_UPDATE &&
        (payload.status === ExecutionStatus.COMPLETE || payload.status === ExecutionStatus.ERROR || payload.status === ExecutionStatus.INTERRUPTED)) {
        unregisterPanelExecution(internalId);
      }
      return; // 处理完毕
    }

    // --- 4. 处理全局非执行类消息 ---
    if (message.type === WebSocketMessageType.WORKFLOW_LIST) {
      workflowStore.fetchAvailableWorkflows();
      return;
    }
    if (message.type === WebSocketMessageType.NODES_RELOADED) {
      nodeStore.handleNodesReloadedNotification(payload as NodesReloadedPayload);
      return;
    }

    // --- 5. 处理与编辑器标签页相关的执行消息 ---
    let targetTabId: string | null = null;
    if (internalId) {
      targetTabId = internalId; // 编辑器执行时，internalId就是tabId
    } else if (messagePromptId) {
      // 通过 promptId 找到对应的 tab
      for (const [tabIdEntry, state] of executionStore.tabExecutionStates.entries()) {
        if (state.promptId === messagePromptId) {
          targetTabId = tabIdEntry;
          break;
        }
      }
    }

    if (!targetTabId) {
      if (message.type !== WebSocketMessageType.ERROR) {
        console.warn(`[WebSocketRouter] Could not determine target tab for message type ${message.type}. This might be normal for background tasks. Ignoring UI update.`);
      }
      return;
    }

    // 过滤非活动标签页的非最终消息
    if (currentActiveTabId && targetTabId !== currentActiveTabId) {
      const isFinalState =
        (message.type === WebSocketMessageType.EXECUTION_STATUS_UPDATE &&
          (payload.status === ExecutionStatus.COMPLETE || payload.status === ExecutionStatus.ERROR || payload.status === ExecutionStatus.INTERRUPTED)) ||
        message.type === WebSocketMessageType.ERROR;

      if (!isFinalState) {
        return;
      }
    }

    processExecutionMessage(message, targetTabId);

  } catch (e) {
    console.error("[WebSocketRouter] Failed to process message:", e);
  }
};

/**
 * 将解析后的消息派发到 executionStore
 * @param message WebSocket 消息
 * @param executionId 前端执行上下文ID (可以是 tabId 或 panelExecutionId)
 */
const processExecutionMessage = (message: WebSocketMessage<any>, executionId: string) => {
  if (!executionStore) {
    console.error("[WebSocketRouter] executionStore not initialized in processExecutionMessage.");
    return;
  }
  const payload = message.payload;
  switch (message.type) {
    case WebSocketMessageType.PROMPT_ACCEPTED_RESPONSE:
      executionStore.handlePromptAccepted(executionId, payload as PromptAcceptedResponsePayload);
      break;
    case WebSocketMessageType.EXECUTION_STATUS_UPDATE:
      executionStore.updateWorkflowStatus(executionId, payload as ExecutionStatusUpdatePayload);
      break;
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
      const errorPayload = payload as { message: string; details?: any };
      console.error(`[WebSocketRouter] Received GLOBAL ERROR message for execution ${executionId}: ${errorPayload.message}`);
      executionStore.updateWorkflowStatus(executionId, {
        promptId: payload?.promptId || executionStore.getCurrentPromptId(executionId) || 'unknown',
        status: ExecutionStatus.ERROR,
        errorInfo: {
          message: errorPayload.message,
          details: errorPayload.details
        },
      });
      break;
    }
    default:
      console.warn(`[WebSocketRouter] Unhandled execution message type for ID ${executionId}: ${message.type}`);
      break;
  }
};


// --- Public API ---

export const setInitiatingTabForNextPrompt = (tabId: string) => {
  initiatingTabIdForNextPrompt = tabId;
};

export const registerPanelExecution = (executionId: string) => {
  panelExecutionIds.add(executionId);
  console.log(`[WebSocketRouter] Registered panel execution: ${executionId}`);
  // Optional: Timeout to clean up stale IDs
  setTimeout(() => {
    if (panelExecutionIds.has(executionId)) {
      console.warn(`[WebSocketRouter] Auto-cleaning stale panel execution ID: ${executionId}`);
      unregisterPanelExecution(executionId);
    }
  }, 1000 * 60 * 5); // 5 minutes
};

export const unregisterPanelExecution = (executionId: string) => {
  if (panelExecutionIds.has(executionId)) {
    panelExecutionIds.delete(executionId);
    // 清理反向映射以防万一
    for (const [promptId, panelId] of promptIdToPanelExecutionIdMap.entries()) {
      if (panelId === executionId) {
        promptIdToPanelExecutionIdMap.delete(promptId);
        break; // 假设是一对一映射
      }
    }
    console.log(`[WebSocketRouter] Unregistered panel execution: ${executionId}`);
  }
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

    // 监听 activeTabId 变化
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
    setInitiatingTabForNextPrompt,
    registerPanelExecution,
    unregisterPanelExecution,
  };
}
