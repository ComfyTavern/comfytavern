import { ref, readonly, onMounted, onUnmounted, watch, type Ref, computed } from "vue";
import { useExecutionStore } from "@/stores/executionStore";
import { useTabStore } from "@/stores/tabStore";
import { useWorkflowStore } from "@/stores/workflowStore";
import { useNodeStore } from "@/stores/nodeStore";
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
const ws = ref<WebSocket | null>(null);
const isConnected = ref(false);
const error = ref<Event | null>(null);

let executionStore: ReturnType<typeof useExecutionStore> | null = null;
let tabStore: ReturnType<typeof useTabStore> | null = null;
let workflowStore: ReturnType<typeof useWorkflowStore> | null = null;
let nodeStore: ReturnType<typeof useNodeStore> | null = null;
let activeTabId: Ref<string | null> | null = null;

let initiatingTabIdForNextPrompt: string | null = null;
const panelExecutionIds = new Set<string>(); // 新增：存储所有面板执行的 ID

const ensureStoresInitialized = () => {
  if (!executionStore) executionStore = useExecutionStore();
  if (!tabStore) tabStore = useTabStore();
  if (!workflowStore) workflowStore = useWorkflowStore();
  if (!nodeStore) nodeStore = useNodeStore();
  if (!activeTabId && tabStore) {
    activeTabId = computed(() => tabStore?.activeTabId ?? null);
  }
};

const connect = () => {
  if (ws.value && ws.value.readyState === WebSocket.OPEN) {
    console.log("[WebSocket] Already connected.");
    isConnected.value = true;
    return;
  }

  // 使用 Bun 默认的 WebSocket 端口，通常是 3233
  // TODO: 从配置中获取 WebSocket URL
  ws.value = new WebSocket(`ws://localhost:3233/ws`);

  ws.value.onopen = () => {
    console.log("[WebSocket] Connected.");
    isConnected.value = true;
    error.value = null;
  };

  ws.value.onclose = () => {
    console.log("[WebSocket] Disconnected. Attempting to reconnect in 5 seconds...");
    isConnected.value = false;
    setTimeout(connect, 5000); // 5秒后尝试重连
  };

  ws.value.onerror = (e) => {
    console.error("[WebSocket] Error:", e);
    error.value = e;
    ws.value?.close(); // 遇到错误时关闭连接，触发 onclose 尝试重连
  };

  ws.value.onmessage = (event) => {
    ensureStoresInitialized();
    if (
      !executionStore || !tabStore || !workflowStore || !nodeStore || !activeTabId ||
      !activeTabId.value // Check if activeTabId.value is null or undefined
    ) {
      console.error("[WebSocket] Stores or activeTabId not properly initialized during onmessage.");
      return;
    }

    try {
      const message = JSON.parse(event.data) as WebSocketMessage<any>;
      console.debug("WebSocket message received:", message);

      const payload = message.payload as any;
      const internalId = payload?.internalId;
      const currentActiveTabId = activeTabId.value;

      // --- 优先处理面板执行 ---
      if (internalId && panelExecutionIds.has(internalId)) {
        console.debug(`[WebSocket] Routing message for Panel Execution: ${internalId}`);
        processExecutionMessage(message, internalId);
        // 如果是最终状态，从集合中移除
        if (message.type === WebSocketMessageType.EXECUTION_STATUS_UPDATE && (payload.status === ExecutionStatus.COMPLETE || payload.status === ExecutionStatus.ERROR || payload.status === ExecutionStatus.INTERRUPTED)) {
            unregisterPanelExecution(internalId);
        }
        return; // 处理完毕，不再继续往下走
      }
      
      // --- 处理全局非执行类消息 ---
      if (message.type === WebSocketMessageType.WORKFLOW_LIST) {
        workflowStore.fetchAvailableWorkflows();
        return;
      }
      if (message.type === WebSocketMessageType.NODES_RELOADED) {
        nodeStore.handleNodesReloadedNotification(payload as NodesReloadedPayload);
        return;
      }

      // --- 处理与标签页相关的执行消息 ---
      const messageWorkflowId = payload?.workflowId || payload?.promptId;
      let targetTabId: string | null = null;
      
      if (message.type === WebSocketMessageType.PROMPT_ACCEPTED_RESPONSE) {
        if (initiatingTabIdForNextPrompt) {
          targetTabId = initiatingTabIdForNextPrompt;
          initiatingTabIdForNextPrompt = null;
        } else {
          console.error("[WebSocket] Received PROMPT_ACCEPTED_RESPONSE but no initiating tab was recorded.");
        }
      } else if (internalId) {
        targetTabId = internalId;
      } else if (messageWorkflowId) {
        for (const [tabIdEntry, state] of executionStore.tabExecutionStates.entries()) {
          if (state.promptId === messageWorkflowId) {
            targetTabId = tabIdEntry;
            break;
          }
        }
      }
      
      if (!targetTabId) {
        if(message.type !== WebSocketMessageType.ERROR) { // 全局错误可能没有 targetTabId
          console.warn(`[WebSocket] Could not determine target tab for message type ${message.type}. Ignoring.`);
        }
        return;
      }
      
      // 过滤非活动标签页的非最终消息
      if (targetTabId !== currentActiveTabId) {
        const isFinalState = [
          WebSocketMessageType.EXECUTION_STATUS_UPDATE,
          WebSocketMessageType.NODE_COMPLETE,
          WebSocketMessageType.NODE_ERROR,
          WebSocketMessageType.ERROR,
        ].includes(message.type);
        // 只有当是最终状态消息，并且状态确实是完成/错误/中断时才处理
        if (!isFinalState || (payload.status !== ExecutionStatus.COMPLETE && payload.status !== ExecutionStatus.ERROR && payload.status !== ExecutionStatus.INTERRUPTED)) {
            console.debug(`[WebSocket] Ignoring non-final message for inactive tab ${targetTabId}.`);
            return;
        }
      }
      
      processExecutionMessage(message, targetTabId);

    } catch (e) {
      console.error("Failed to parse or process WebSocket message:", e);
    }
  };
};

const sendMessage = (message: WebSocketMessage<any>) => {
  if (ws.value && ws.value.readyState === WebSocket.OPEN) {
    ws.value.send(JSON.stringify(message));
  } else {
    console.warn("[WebSocket] Not connected, message not sent:", message);
  }
};

// 辅助函数：处理执行相关的 WebSocket 消息
const processExecutionMessage = (message: WebSocketMessage<any>, executionId: string) => {
  const payload = message.payload as any;
  
  // 确保 store 已初始化，尽管在 onmessage 开头已经检查过
  if (!executionStore) {
    console.error("[WebSocket] executionStore not initialized in processExecutionMessage.");
    return;
  }

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
      console.error(`[WebSocket] Received GLOBAL ERROR message for execution ${executionId}: ${errorPayload.message}`);
      executionStore.updateWorkflowStatus(executionId, {
          promptId: payload?.promptId || executionStore.getCurrentPromptId(executionId) || 'unknown',
          status: ExecutionStatus.ERROR,
          errorInfo: { message: errorPayload.message, details: errorPayload.details },
      });
      break;
    }
    default:
      console.warn(`[WebSocket] Unhandled execution message type for ID ${executionId}: ${message.type}`);
      break;
  }
};


export const setInitiatingTabForNextPrompt = (tabId: string) => {
  initiatingTabIdForNextPrompt = tabId;
};

export const registerPanelExecution = (executionId: string) => {
  panelExecutionIds.add(executionId);
  console.log(`[WebSocket] Registered panel execution: ${executionId}`);
  // 可选：添加一个清理机制，以防执行从未完成
  setTimeout(() => {
    if (panelExecutionIds.has(executionId)) {
      console.warn(`[WebSocket] Auto-cleaning stale panel execution ID: ${executionId}`);
      unregisterPanelExecution(executionId);
    }
  }, 1000 * 60 * 5); // 5 分钟后自动清理
};

export const unregisterPanelExecution = (executionId: string) => {
  if (panelExecutionIds.has(executionId)) {
    panelExecutionIds.delete(executionId);
    console.log(`[WebSocket] Unregistered panel execution: ${executionId}`);
  }
};


export function useWebSocket() {
  onMounted(() => {
    ensureStoresInitialized();
    connect();
  });

  onUnmounted(() => {
    ws.value?.close();
  });

  // 监听 activeTabId 变化，如果需要根据活动 tab 调整 WebSocket 行为
  watch(() => activeTabId?.value, (newTabId, oldTabId) => {
    if (newTabId !== oldTabId) {
      console.log(`[WebSocket] Active tab changed from ${oldTabId} to ${newTabId}`);
      // 可以在这里发送消息通知后端当前活动 tab，如果后端需要
      // 或者调整前端对消息的处理逻辑
    }
  });

  return {
    isConnected: readonly(isConnected),
    error: readonly(error),
    sendMessage,
    setInitiatingTabForNextPrompt,
    registerPanelExecution, // 暴露新的注册函数
    unregisterPanelExecution,
  };
}
