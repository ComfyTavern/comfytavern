import { ref, readonly } from 'vue';
import { getWebSocketUrl } from '@/utils/urlUtils';

type MessageHandler = (message: any) => void;

// --- Private state ---
let ws = ref<WebSocket | null>(null);
let isConnected = ref(false);
let error = ref<Event | null>(null);
const messageHandlers = new Map<string, MessageHandler>();
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let explicitlyClosed = false;

// WebSocket URL 会在 _connect() 内部动态获取

// --- Private methods ---

const _connect = () => {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (explicitlyClosed || (ws.value && ws.value.readyState === WebSocket.OPEN)) {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) isConnected.value = true;
    console.log("[WebSocketCore] Connection attempt skipped. (explicitly closed or already open)");
    return;
  }
  
  const wsUrl = getWebSocketUrl();
  console.log(`[WebSocketCore] Connecting to ${wsUrl}...`);
  ws.value = new WebSocket(wsUrl);

  ws.value.onopen = () => {
    console.log("[WebSocketCore] Connected.");
    isConnected.value = true;
    error.value = null;
    explicitlyClosed = false;
  };

  ws.value.onclose = () => {
    console.log("[WebSocketCore] Disconnected.");
    isConnected.value = false;
    ws.value = null;
    if (!explicitlyClosed) {
        console.log("[WebSocketCore] Attempting to reconnect in 5 seconds...");
        reconnectTimeout = setTimeout(_connect, 5000);
    }
  };

  ws.value.onerror = (e) => {
    console.error("[WebSocketCore] Error:", e);
    error.value = e;
    ws.value?.close(); // 触发 onclose 中的重连逻辑
  };

  ws.value.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      // 咕咕：遍历 Map 的 values
      messageHandlers.forEach(handler => handler(message));
    } catch (e) {
      console.error("[WebSocketCore] Failed to parse message:", e);
    }
  };
};

// --- Public API ---

/**
 * Initiates the WebSocket connection.
 */
export function connect() {
  explicitlyClosed = false;
  _connect();
}

/**
 * Closes the WebSocket connection permanently.
 * Reconnection attempts will be stopped.
 */
export function disconnect() {
  console.log("[WebSocketCore] Explicitly closing connection.");
  explicitlyClosed = true;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  ws.value?.close();
}

/**
 * Sends a message through the WebSocket.
 * @param message The message object to send.
 */
export function sendMessage(message: any) {
  if (ws.value && ws.value.readyState === WebSocket.OPEN) {
    ws.value.send(JSON.stringify(message));
  } else {
    console.warn("[WebSocketCore] Not connected, message not sent:", message);
  }
}

/**
 * Subscribes a handler function to incoming messages with a unique key.
 * @param key A unique key for this subscription.
 * @param handler The function to call with new messages.
 * @returns An unsubscribe function.
 */
export function subscribe(key: string, handler: MessageHandler): () => void {
  if (messageHandlers.has(key)) {
    console.warn(`[WebSocketCore] Handler with key '${key}' is already subscribed. Overwriting.`);
  }
  messageHandlers.set(key, handler);
  return () => {
    messageHandlers.delete(key);
  };
}

// --- Singleton-like composable ---

let isInitialized = false;

/**
 * Composable to access the singleton WebSocket core service.
 * It ensures that the connection logic is initialized only once.
 */
export function useWebSocketCore() {
  if (!isInitialized) {
    connect();
    isInitialized = true;
  }

  return {
    isConnected: readonly(isConnected),
    error: readonly(error),
    sendMessage,
    subscribe,
    connect,
    disconnect
  };
}