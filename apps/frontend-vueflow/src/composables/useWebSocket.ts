// apps/frontend-vueflow/src/composables/useWebSocket.ts
import { ref, computed, readonly } from "vue"; // 移除 onMounted, onUnmounted，添加 readonly
import {
  type WebSocketMessage,
  WebSocketMessageType,
  // type NodeStatusUpdatePayload, // 移除未使用的导入
  type ExecutionStatusUpdatePayload, // 使用正确的类型名称
  ExecutionStatus, // 导入 ExecutionStatus 枚举
  type PromptAcceptedResponsePayload, // 使用正确的类型名称
  type NodeExecutingPayload, // 新增
  type NodeProgressPayload, // 新增 (假设类型)
  type NodeCompletePayload, // 新增
  type NodeErrorPayload, // 新增
  type NodesReloadedPayload, // 新增：节点重载通知的载荷
} from "@comfytavern/types"; // 引入共享类型和枚举
import { useExecutionStore } from "@/stores/executionStore"; // 导入执行状态存储
import { useTabStore } from "@/stores/tabStore"; // 导入 TabStore
import { useWorkflowStore } from "@/stores/workflowStore"; // <-- 1. 导入 workflowStore
import { useNodeStore } from "@/stores/nodeStore"; // 新增：导入 nodeStore
import { getWebSocketUrl } from "@/utils/urlUtils"; // 导入新的工具函数

// 使用工具函数获取 WebSocket URL
const WS_URL = getWebSocketUrl();

// --- 单例状态 ---
const ws = ref<WebSocket | null>(null);
const isConnected = ref(false);
const error = ref<string | null>(null);
const messageQueue = ref<WebSocketMessage[]>([]); // 消息队列，用于连接成功后发送
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000; // 5 seconds
let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;

let executionStore: ReturnType<typeof useExecutionStore> | null = null; // 延迟初始化
let tabStore: ReturnType<typeof useTabStore> | null = null; // 延迟初始化
let workflowStore: ReturnType<typeof useWorkflowStore> | null = null; // <-- 声明 workflowStore
let nodeStore: ReturnType<typeof useNodeStore> | null = null; // 新增：声明 nodeStore
let activeTabId: import("vue").ComputedRef<string | null> | null = null; // 延迟初始化，显式类型

// --- 私有函数 ---

// 如果尚未初始化，则初始化存储的函数
const ensureStoresInitialized = () => {
  if (!executionStore) {
    executionStore = useExecutionStore();
  }
  if (!tabStore) {
    tabStore = useTabStore();
    // 仅初始化一次 activeTabId 计算属性
    if (tabStore) {
      // 为 tabStore 添加 null 检查
      activeTabId = computed(() => tabStore!.activeTabId);
    } else {
      console.error("[WebSocket] Failed to initialize tabStore in ensureStoresInitialized.");
      // 适当地处理错误，也许阻止连接？
    }
  }
  // <-- 2. 初始化 workflowStore
  if (!workflowStore) {
    workflowStore = useWorkflowStore();
    if (!workflowStore) {
      console.error("[WebSocket] Failed to initialize workflowStore in ensureStoresInitialized.");
    }
  }
  if (!nodeStore) { // 新增：初始化 nodeStore
    nodeStore = useNodeStore();
    if (!nodeStore) {
      console.error("[WebSocket] Failed to initialize nodeStore in ensureStoresInitialized.");
    }
  }
};

const connect = (isRetry = false) => {
  if (ws.value && ws.value.readyState === WebSocket.OPEN) {
    console.debug("[WebSocket] connect: Already connected.");
    return;
  }
  if (ws.value && ws.value.readyState === WebSocket.CONNECTING) {
    console.debug("[WebSocket] connect: Already connecting.");
    return;
  }

  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }

  if (isRetry) {
    console.info(`[WebSocket] Attempting to reconnect... (Attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
  } else {
    reconnectAttempts = 0; // Reset attempts if it's a fresh connect call
  }

  ensureStoresInitialized(); // 确保在连接前存储已准备就绪

  console.info(`Attempting to connect WebSocket to ${WS_URL}...`);
  ws.value = new WebSocket(WS_URL);

  ws.value.onopen = () => {
    console.info("WebSocket connection established.");
    isConnected.value = true;
    error.value = null;
    reconnectAttempts = 0; // Reset on successful connection
    console.info("[WebSocket] Connection established successfully.");
    // 发送队列中的消息
    while (messageQueue.value.length > 0) {
      const msg = messageQueue.value.shift();
      if (msg) {
        // 调用处理检查的公共 sendMessage 函数
        sendMessage(msg);
      }
    }
  };

  ws.value.onmessage = (event) => {
    ensureStoresInitialized();
    if (
      !executionStore ||
      !tabStore ||
      !workflowStore ||
      !nodeStore || // 新增：检查 nodeStore
      !activeTabId ||
      activeTabId.value === undefined // Check for undefined specifically
    ) {
      console.error("[WebSocket] Stores (execution, tab, workflow, node) or activeTabId not properly initialized during onmessage.");
      return;
    }

    try {
      const message = JSON.parse(event.data) as WebSocketMessage<any>;
      console.debug("WebSocket message received:", message);

      const payload = message.payload as any;
      // 尝试从 payload 中提取 internalId 或 workflowId 来确定目标 tab
      // 注意：不同消息类型可能使用不同的字段来标识目标
      const messageTabId = payload?.internalId; // 优先使用 internalId
      const messageWorkflowId = payload?.workflowId; // 备用 workflowId

      const currentActiveTabId = activeTabId.value; // 获取当前活动 tab ID

      // --- 消息过滤逻辑 ---
      // 1. 检查消息是否需要与特定 Tab 关联
      const requiresTabAssociation = [
        WebSocketMessageType.PROMPT_ACCEPTED_RESPONSE,
        WebSocketMessageType.EXECUTION_STATUS_UPDATE, // 使用正确的类型
        WebSocketMessageType.NODE_EXECUTING,
        WebSocketMessageType.NODE_PROGRESS,
        WebSocketMessageType.NODE_COMPLETE,
        WebSocketMessageType.NODE_ERROR,
        // WebSocketMessageType.NODE_STATUS_UPDATE, // 旧类型，可能被取代
      ].includes(message.type);

      let targetTabId: string | null = null;

      if (requiresTabAssociation) {
        if (messageTabId) {
          targetTabId = messageTabId;
        } else if (messageWorkflowId) {
          // 如果没有 internalId 但有 workflowId，尝试找到拥有该 workflowId 的 tab
          for (const [tabId, state] of executionStore.tabExecutionStates.entries()) {
            if (state.promptId === messageWorkflowId) { // 使用 promptId 替代 workflowId
              targetTabId = tabId;
              break;
            }
          }
          if (!targetTabId) {
            console.warn(`[WebSocket] Received message for workflow ${messageWorkflowId} but no active tab found associated with it. Type: ${message.type}`);
            // return; // 暂时不返回，允许全局消息或错误处理
          }
        } else {
           console.warn(`[WebSocket] Received message type ${message.type} that requires tab association, but lacks internalId or workflowId.`);
           // return; // 无法确定目标 tab，忽略
        }

        // 如果确定了目标 Tab，但不是当前活动 Tab，则忽略 (除非是全局错误等特殊情况)
        if (targetTabId && targetTabId !== currentActiveTabId) {
           // 允许处理非活动 tab 的完成/错误消息，以便更新状态，但不触发 UI 交互
           if (message.type !== WebSocketMessageType.NODE_COMPLETE &&
               message.type !== WebSocketMessageType.NODE_ERROR &&
               message.type !== WebSocketMessageType.EXECUTION_STATUS_UPDATE && // 使用正确的类型
               message.type !== WebSocketMessageType.ERROR) { // 允许处理全局错误
             console.debug(
               `[WebSocket] Ignoring non-final message for inactive tab ${targetTabId} (active: ${currentActiveTabId}). Type: ${message.type}`
             );
             return;
           } else {
             console.debug(`[WebSocket] Processing final state/error message for inactive tab ${targetTabId}. Type: ${message.type}`);
           }
        }
        // 如果需要关联但找不到目标 Tab ID，并且不是全局错误，则忽略
        else if (!targetTabId && message.type !== WebSocketMessageType.ERROR) {
            console.warn(`[WebSocket] Could not determine target tab for message type ${message.type}. Ignoring.`);
            return;
        }
      }
      // --- 过滤结束 ---

      // 确定最终要操作的 tabId (可能是活动的，也可能是非活动的最终状态更新)
      const effectiveTabId = targetTabId || currentActiveTabId; // 优先使用消息指定或找到的 tab，否则回退到当前活动 tab

      // 对于需要 tabId 的操作，再次检查 effectiveTabId 是否有效
      if (requiresTabAssociation && !effectiveTabId) {
          console.warn(`[WebSocket] Cannot process message type ${message.type}: No effective tab ID could be determined.`);
          return;
      }


      switch (message.type) {
        case WebSocketMessageType.PROMPT_ACCEPTED_RESPONSE: {
          if (effectiveTabId) {
            const typedPayload = payload as PromptAcceptedResponsePayload; // 使用正确的类型
            executionStore.handlePromptAccepted(effectiveTabId, typedPayload);
          }
          break;
        }
        case WebSocketMessageType.EXECUTION_STATUS_UPDATE: { // 使用正确的类型
          if (effectiveTabId) {
            const typedPayload = payload as ExecutionStatusUpdatePayload; // 使用正确的类型
            // 在调用 store 操作之前为 currentActiveTabId 添加显式检查
            // if (typedPayload.status === ExecutionStatus.RUNNING && typedPayload.promptId) { // 使用 promptId
            //   // Resetting is now handled in handlePromptAccepted or setWorkflowStatusManually
            // }
            executionStore.updateWorkflowStatus(effectiveTabId, typedPayload); // 确保 store 方法接受此类型
          }
          break;
        }
        case WebSocketMessageType.NODE_EXECUTING: {
          if (effectiveTabId) {
            const typedPayload = payload as NodeExecutingPayload;
            executionStore.updateNodeExecuting(effectiveTabId, typedPayload);
          }
          break;
        }
        case WebSocketMessageType.NODE_PROGRESS: {
          if (effectiveTabId) {
            // 假设 NodeProgressPayload 结构，如果不同需要调整
            const typedPayload = payload as NodeProgressPayload;
            executionStore.updateNodeProgress(effectiveTabId, typedPayload);
          }
          break;
        }
        case WebSocketMessageType.NODE_COMPLETE: {
          if (effectiveTabId) {
            const typedPayload = payload as NodeCompletePayload;
            executionStore.updateNodeExecutionResult(effectiveTabId, typedPayload);
          }
          break;
        }
        case WebSocketMessageType.NODE_ERROR: {
          if (effectiveTabId) {
            const typedPayload = payload as NodeErrorPayload;
            executionStore.updateNodeError(effectiveTabId, typedPayload);
          }
          break;
        }
        // case WebSocketMessageType.NODE_STATUS_UPDATE: { // 旧类型，可能不再需要，或作为通用状态更新的回退
        //   if (effectiveTabId) {
        //     const typedPayload = payload as NodeStatusUpdatePayload;
        //     // Decide how to handle this, maybe map to specific actions?
        //     console.warn(`[WebSocket] Received deprecated NODE_STATUS_UPDATE for node ${typedPayload.nodeId}. Status: ${typedPayload.status}`);
        //     // Example: Map to executing or error based on status
        //     // if (typedPayload.status === ExecutionStatus.RUNNING) {
        //     //   executionStore.updateNodeExecuting(effectiveTabId, { workflowId: typedPayload.workflowId, nodeId: typedPayload.nodeId });
        //     // } else if (typedPayload.status === ExecutionStatus.ERROR) {
        //     //   executionStore.updateNodeError(effectiveTabId, { workflowId: typedPayload.workflowId, nodeId: typedPayload.nodeId, error: typedPayload.error || 'Unknown error' });
        //     // }
        //   }
        //   break;
        // }
        case WebSocketMessageType.WORKFLOW_LIST: {
          console.info(
            "[WebSocket] Received WORKFLOW_LIST message. Refreshing workflow list in store."
          );
          if (workflowStore) {
            workflowStore.fetchAvailableWorkflows();
          } else {
            console.error("[WebSocket] workflowStore is null, cannot refresh workflow list.");
          }
          break;
        }
        case WebSocketMessageType.ERROR: { // 通用后端错误
          const errorPayload = payload as { message: string; workflowId?: string; internalId?: string; details?: any };
          console.error(`[WebSocket] Received GLOBAL ERROR message: ${errorPayload.message}`, errorPayload.details);
          const errorTabId = errorPayload.internalId || effectiveTabId; // 尝试从 payload 获取 tabId，否则用当前计算的
          if (errorTabId) {
            // 创建一个模拟的 ExecutionStatusUpdatePayload 来更新 store
            const statusPayload: ExecutionStatusUpdatePayload = { // 使用正确的类型
              promptId: errorPayload.workflowId || executionStore.getCurrentPromptId(errorTabId) || 'unknown', // 使用 getCurrentPromptId
              status: ExecutionStatus.ERROR,
              errorInfo: { message: errorPayload.message, details: errorPayload.details }, // 使用 errorInfo
            };
            executionStore.updateWorkflowStatus(errorTabId, statusPayload); // 确保 store 方法接受此类型
            // TODO: Consider a global notification
          } else {
            console.warn("[WebSocket] Received GLOBAL ERROR message but no associated tab ID found.");
            // TODO: Show a global error notification
          }
          break;
        }
        case WebSocketMessageType.NODES_RELOADED: { // 新增：处理节点重载通知
          console.info("[WebSocket] Received NODES_RELOADED message from server. Payload:", payload); // 增强日志
          if (nodeStore) {
            const typedPayload = payload as NodesReloadedPayload;
            console.log("[WebSocket] Calling nodeStore.handleNodesReloadedNotification with payload:", typedPayload); // 增强日志
            nodeStore.handleNodesReloadedNotification(typedPayload);
          } else {
            console.error("[WebSocket] nodeStore is null, cannot handle NODES_RELOADED notification.");
          }
          break;
        }
        default:
          // Check if the message type might be a custom node message
          if (message.type.startsWith('custom/')) {
             console.log(`[WebSocket] Received custom node message: ${message.type}`, payload);
             // TODO: Implement routing or handling for custom node messages if needed
             // Example: Event bus or dedicated store module
          } else {
             console.warn(`Unhandled WebSocket message type: ${message.type}`);
          }
          break;
      }
    } catch (e) {
      console.error("Failed to parse or process WebSocket message:", e);
    }
  };

  // 添加 ws.value 的 null 检查
  if (ws.value) {
    ws.value.onerror = (event) => {
      console.error("WebSocket error:", event);
      error.value = "WebSocket connection error.";
      isConnected.value = false;
      // 考虑在此处添加带退避的重新连接尝试
    };
  } else {
    console.error("[WebSocket] Cannot assign onerror handler: ws.value is null.");
    // 考虑在此处添加带退避的重新连接尝试
  }

  // 添加 ws.value 的 null 检查
  if (ws.value) {
    ws.value.onclose = (event) => {
      console.info(`[WebSocket] Connection closed. Code: ${event.code}, Reason: "${event.reason}", Was Clean: ${event.wasClean}`);
      isConnected.value = false;
      // const oldWs = ws.value; // No longer needed here as client ID cleanup is backend's concern
      ws.value = null;

      // Frontend doesn't need to manage client ID mapping directly in onclose.
      // Backend's WebSocketManager.removeClient (triggered by Elysia's ws.close hook) handles cleanup.
      
      // Attempt to reconnect if not a clean close or if it's a specific code we want to retry for
      // For now, let's try to reconnect on any close if attempts are left.
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`[WebSocket] Scheduling reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${RECONNECT_DELAY / 1000}s.`);
        if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId); // Clear previous timeout if any
        reconnectTimeoutId = setTimeout(() => connect(true), RECONNECT_DELAY);
      } else {
        console.warn(`[WebSocket] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Will not try again automatically.`);
        error.value = "WebSocket disconnected. Max reconnect attempts reached.";
      }
    };
  } else {
    console.error("[WebSocket] Cannot assign onclose handler: ws.value is null.");
    // This case should ideally not happen if ws.value was just new WebSocket()
  }
};

// Helper function to get client ID from ws instance (needed for onclose cleanup)
// Removed getClientIdByWs as it's not applicable/feasible in the frontend context
// and relies on backend-specific types (ServerWebSocket, WsContextData).
// Client ID management and mapping are primarily handled by the backend WebSocketManager.

const disconnect = () => {
  if (ws.value) {
    console.debug("Closing WebSocket connection.");
    // 在关闭之前移除监听器以防止关闭期间出现潜在问题
    ws.value.onopen = null;
    ws.value.onmessage = null;
    ws.value.onerror = null;
    ws.value.onclose = null;
    ws.value.close(1000, "Client initiated disconnect"); // Send a clean close code
    // ws.value = null; // onclose handler will set this to null
    // isConnected.value = false; // onclose handler will set this
  }
  if (reconnectTimeoutId) { // Clear any pending reconnect attempts if disconnect is called explicitly
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
    reconnectAttempts = 0; // Reset attempts on explicit disconnect
  }
};

// --- 公共 API ---

/**
 * 通过 WebSocket 连接发送消息。
 * 如果连接未打开，消息将被排队并尝试建立连接。
 * @param message 要发送的 WebSocketMessage。
 */
export const sendMessage = (message: WebSocketMessage) => {
  if (ws.value && ws.value.readyState === WebSocket.OPEN) {
    try {
      ws.value.send(JSON.stringify(message));
      console.debug("WebSocket message sent:", message);
    } catch (e) {
      console.error("Failed to send WebSocket message:", e);
    }
  } else {
    console.warn("WebSocket not connected. Queuing message:", message);
    messageQueue.value.push(message);
    // 如果尚未连接或打开，则尝试连接
    if (
      !ws.value ||
      (ws.value.readyState !== WebSocket.CONNECTING && ws.value.readyState !== WebSocket.OPEN)
    ) {
      connect();
    }
  }
};

/**
 * 初始化 WebSocket 连接。应在应用程序设置期间调用一次。
 */
export const initializeWebSocket = () => {
  console.log("Initializing WebSocket connection..."); // 保留为日志
  connect();
};

/**
 * 关闭 WebSocket 连接。如有必要，应在应用程序拆卸期间调用。
 */
export const closeWebSocket = () => {
  console.log("Closing WebSocket connection..."); // 保留为日志
  disconnect();
};

/**
 * 用于访问单例 WebSocket 状态和方法的可组合函数。
 * @returns 连接状态/错误的只读引用以及 sendMessage 函数。
 */
export function useWebSocket() {
  // Ensure stores are initialized when the composable is first used
  // 这是在 initializeWebSocket 未及早调用的情况下的后备方案
  ensureStoresInitialized();

  return {
    isConnected: readonly(isConnected), // 返回只读引用以确保安全
    error: readonly(error),
    sendMessage, // 暴露共享的 sendMessage 函数
    // 如果其他地方需要手动控制，则可以选择性地暴露 connect/disconnect
    // connect,
    // disconnect,
  };
}
