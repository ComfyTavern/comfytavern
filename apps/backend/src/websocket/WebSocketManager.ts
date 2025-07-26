// 移除 'ws' 库的导入
// import WebSocket, { WebSocketServer } from 'ws';
// 移除旧的 ElysiaWS 导入
// import { type ElysiaWS } from 'elysia';
import type { ServerWebSocket } from "bun"; // 从 bun 导入正确的类型
import { nanoid } from "nanoid";

import { NanoId, WebSocketMessageType } from "@comfytavern/types";

// 定义 WebSocket 上下文类型
// Bun 的 ServerWebSocket 通常需要一个泛型参数来定义 data 的类型
// 使用 unknown 或 any 如果不确定 data 的具体结构
type WsContextData = { clientId?: NanoId;[key: string]: any }; // 假设 data 可能包含 clientId
type WsContext = ServerWebSocket<WsContextData>;

interface ClientInfo {
  ws: WsContext; // 使用正确的 ServerWebSocket 类型
  isSending: boolean; // 标志位，防止对同一个客户端并发处理发送队列
  queue: string[]; // 待发送消息队列
}

/**
 * 管理 WebSocket 连接和消息广播，与 Elysia 集成。
 */
export class WebSocketManager {
  // 移除 wss 和 isInitialized
  // private wss: WebSocketServer | null = null;
  private clients: Map<NanoId, ClientInfo> = new Map();
  // 使用 WeakMap 来从 ws 对象快速查找 clientId，用于 close/error 事件
  private wsToClientId: WeakMap<WsContext, NanoId> = new WeakMap();

  // --- 新增数据结构 ---
  // 场景实例 ID -> 订阅该场景的客户端 ID 集合
  private sceneChannels: Map<NanoId, Set<NanoId>> = new Map();
  // 客户端 ID -> 该客户端订阅的场景实例 ID
  private clientSubscriptions: Map<NanoId, NanoId> = new Map();
  // (可选增强) 场景实例 ID -> 命名空间前缀
  private sceneNamespaces: Map<NanoId, string> = new Map();

  constructor() {
    // 构造函数简化
    console.log("[WS Manager] Instance created. Ready for Elysia integration.");
  }

  // 移除 attachServer 和 initializeWssEvents

  /**
   * 当 Elysia 建立新连接时调用。
   * 由 index.ts 中的 app.ws.open 调用。
   * @param ws Elysia 的 WebSocket 上下文对象
   * @returns 分配的 clientId
   */
  public addClient(ws: WsContext): NanoId {
    // 尝试从 ws.data 获取 clientId (如果 index.ts 中设置了)
    // 否则生成一个新的 ID
    // 注意: Elysia 的 ws 对象本身没有 id 属性，但可以通过 data 传递
    const clientId: NanoId = (ws.data as any)?.clientId || nanoid(10);

    // 检查 clientId 是否已存在 (处理重连或异常情况)
    if (this.clients.has(clientId)) {
      console.warn(`[WS Manager] Client ID ${clientId} already exists. Closing old connection.`);
      const oldClientInfo = this.clients.get(clientId);
      try {
        oldClientInfo?.ws.close(1008, "Client ID reconnected");
      } catch (e) {
        console.error(`[WS Manager] Error closing old connection for ${clientId}:`, e);
      }
      if (oldClientInfo) {
        this.wsToClientId.delete(oldClientInfo.ws);
      }
    }

    this.clients.set(clientId, { ws, isSending: false, queue: [] });
    this.wsToClientId.set(ws, clientId);
    console.log(`[WS Manager] Client connected: ${clientId}`);
    // 可以在这里将 clientId 存入 ws.data，方便后续查找
    // (ws.data as any).clientId = clientId; // 如果需要在 Elysia 的 handler 中直接访问
    return clientId;
  }

  /**
   * 当 Elysia 关闭连接时调用。
   * 由 index.ts 中的 app.ws.close 调用。
   * @param ws Elysia 的 WebSocket 上下文对象
   */
  public removeClient(ws: WsContext): void {
    const clientId = this.wsToClientId.get(ws);
    if (clientId) {
      // --- 新增逻辑：清理订阅信息 ---
      this.unsubscribeFromScene(clientId, "disconnect");

      this.clients.delete(clientId);
      this.wsToClientId.delete(ws);
      console.log(`[WS Manager] Client disconnected: ${clientId}`);
    } else {
      // 可能在 addClient 之前就关闭了，或者已经被移除
      // console.warn('[WS Manager] Attempted to remove a client that was not tracked or already removed.');
    }
  }

  /**
   * 处理来自客户端的消息（主要用于日志记录或通用预处理）。
   * 由 index.ts 中的 app.ws.message 调用。
   * @param clientId 发送消息的客户端 ID
   * @param message 收到的消息
   */
  public handleMessage(clientId: NanoId, message: any): void {
    // 可以在这里添加统一的日志记录或预处理
    console.log(
      `[WS Manager] Received message from ${clientId}:`,
      typeof message === "object" ? JSON.stringify(message) : message
    );
    // 实际的消息处理逻辑应在 index.ts 或专门的 handler 中调用 scheduler
  }

  /**
   * 处理 WebSocket 错误。
   * 由 index.ts 中的 app.ws.error 调用。
   * @param ws 发生错误的 WebSocket 上下文
   * @param error 错误对象
   */
  public handleError(ws: WsContext, error: Error): void {
    const clientId = this.wsToClientId.get(ws);
    console.error(`[WS Manager] WebSocket error for client ${clientId || "unknown"}:`, error);
    // 发生错误时也移除客户端
    this.removeClient(ws);
  }

  /**
   * 获取与给定 ws 对象关联的 clientId。
   * 由 index.ts 中的 app.ws.message/close/error 调用。
   * @param ws Elysia 的 WebSocket 上下文对象
   * @returns 客户端 ID 或 undefined
   */
  public getClientId(ws: WsContext): NanoId | undefined {
    // 优先尝试从 ws.data 获取 (如果在 addClient 中设置了)
    // return (ws.data as any)?.clientId || this.wsToClientId.get(ws);
    return this.wsToClientId.get(ws); // 使用 WeakMap 获取
  }

  // --- 新增方法：处理由 SessionManager 发起的订阅 ---
  /**
   * 将客户端订阅到指定的场景频道。此方法应由 SessionManager 调用。
   * @param clientId 客户端 ID
   * @param sceneInstanceId 场景实例 ID
   * @param sceneConfig 可选的场景配置，如 `event_bus_config`
   */
  public subscribeToScene(
    clientId: NanoId,
    sceneInstanceId: NanoId,
    sceneConfig?: { eventBusConfig?: { namespacePrefix?: string } }
  ): void {
    // 如果客户端已订阅其他场景，先取消订阅
    this.unsubscribeFromScene(clientId, "resubscribe");

    if (!this.sceneChannels.has(sceneInstanceId)) {
      this.sceneChannels.set(sceneInstanceId, new Set());
    }
    this.sceneChannels.get(sceneInstanceId)!.add(clientId);
    this.clientSubscriptions.set(clientId, sceneInstanceId);

    // (可选增强) 存储命名空间
    if (sceneConfig?.eventBusConfig?.namespacePrefix) {
      this.sceneNamespaces.set(sceneInstanceId, sceneConfig.eventBusConfig.namespacePrefix);
    }

    console.log(
      `[WS Manager] Client ${clientId} was subscribed to scene ${sceneInstanceId} by SessionManager.`
    );
  }

  // --- 新增方法：处理取消订阅 ---
  /**
   * 取消客户端对场景的订阅。此方法可由 SessionManager 调用，或在客户端断开连接时内部调用。
   * @param clientId 客户端 ID
   * @param reason 取消订阅的原因，用于日志记录
   */
  public unsubscribeFromScene(
    clientId: NanoId,
    reason: "disconnect" | "resubscribe" | "session_end"
  ): void {
    const currentSceneId = this.clientSubscriptions.get(clientId);
    if (currentSceneId) {
      const subscribers = this.sceneChannels.get(currentSceneId);
      if (subscribers) {
        subscribers.delete(clientId);
        if (subscribers.size === 0) {
          // 如果没有订阅者了，可以清理场景频道和命名空间
          this.sceneChannels.delete(currentSceneId);
          this.sceneNamespaces.delete(currentSceneId);
          console.log(
            `[WS Manager] Scene channel ${currentSceneId} is now empty and has been removed.`
          );
        }
      }
      this.clientSubscriptions.delete(clientId);
      console.log(
        `[WS Manager] Client ${clientId} unsubscribed from scene ${currentSceneId}. Reason: ${reason}.`
      );
    }
  }

  /**
   * 向特定客户端发送消息。
   * 此方法现在将消息推入队列，并触发一个非阻塞的发送过程。
   * @param clientId 目标客户端 ID
   * @param type 消息类型
   * @param payload 消息载荷
   */
  public sendMessageToClient(clientId: NanoId, type: string, payload: any): void {
    const clientInfo = this.clients.get(clientId);
    if (clientInfo) {
      let messageString: string;
      try {
        messageString = JSON.stringify({ type, payload });
      } catch (error) {
        console.error(
          `[WebSocketManager] Failed to stringify message of type "${type}" for client ${clientId}:`,
          error
        );
        try {
          messageString = JSON.stringify({
            type: WebSocketMessageType.ERROR,
            payload: {
              message: `Failed to serialize payload for message type: ${type}`,
              details: { originalType: type },
            },
          });
        } catch {
          console.error(
            `[WebSocketManager] CRITICAL: Failed to even stringify the fallback error message for client ${clientId}.`
          );
          return;
        }
      }
      clientInfo.queue.push(messageString);
      this._trySendQueue(clientId);
    } else {
      // console.warn(`[WS Manager] Client ${clientId} not found for sending message.`);
    }
  }

  /**
   * 异步处理并发送单个客户端的消息队列。
   * 这是一个健壮的实现，包含状态锁定和背压处理。
   * @param clientId 目标客户端 ID
   */
  public _trySendQueue(clientId: NanoId): void {
    const clientInfo = this.clients.get(clientId);
    if (!clientInfo || clientInfo.isSending) {
      return;
    }

    clientInfo.isSending = true;

    try {
      while (clientInfo.queue.length > 0) {
        const messageString = clientInfo.queue[0]; // Peek at message
        const result = clientInfo.ws.send(messageString);

        if (result > 0) {
          clientInfo.queue.shift(); // Sent successfully
        } else {
          // result is 0 (dropped) or -1 (backpressure)
          // 在这两种情况下，我们都应该停止发送并等待 drain 事件。
          // Bun 文档： "A value of 0 indicates the message was dropped, this can happen if the socket is closed or not ready."
          // "If backpressure is applied, send() will return -1."
          if (result === 0) {
            console.warn(
              `[WS Manager] Message dropped for client ${clientId} (send returned 0). Waiting for drain event.`
            );
          }
          break; // 停止处理此客户端的队列，等待 drain
        }
      }
    } catch (error) {
      console.error(
        `[WS Manager] Error in _trySendQueue for client ${clientId}. Removing client.`,
        error
      );
      this.removeClient(clientInfo.ws);
    } finally {
      if (clientInfo) {
        clientInfo.isSending = false;
      }
    }
  }

  /**
   * 当 WebSocket 缓冲区排空时由 Elysia 的 drain 回调调用。
   * 这表明可以继续发送数据了。
   * @param ws 排空的 WebSocket 上下文
   */
  public handleDrain(ws: WsContext): void {
    const clientId = this.getClientId(ws);
    if (clientId) {
      // console.log(`[WS Manager] Drain event for client ${clientId}. Resuming queue.`);
      this._trySendQueue(clientId);
    }
  }

  /**
   * 向所有连接的客户端广播消息。
   * 此方法通过将消息推入每个客户端的队列来实现非阻塞广播。
   * @param type 消息类型
   * @param payload 消息载荷
   */
  public broadcast(type: string, payload: any): void {
    console.log(
      `[WS Manager] Broadcasting message. Type: ${type}, To clients: ${this.clients.size}`
    );
    if (this.clients.size === 0) {
      // console.warn("[WS Manager] Broadcast called, but no clients are connected.");
      return;
    }

    this.clients.forEach((clientInfo, clientId) => {
      // 直接调用，移除 setTimeout，以避免在数据爆发时淹没事件循环。
      // sendMessageToClient 内部已经是异步且处理背压的，所以这是安全的。
      this.sendMessageToClient(clientId, type, payload);
    });
  }

  // --- 新增方法：向特定场景发布事件 ---
  /**
   * 向特定场景的所有订阅者发布事件。
   * 这是 Agent 与环境交互的主要方式。
   * @param sceneInstanceId 目标场景 ID
   * @param type 事件类型
   * @param payload 事件载荷
   */
  public publishToScene(sceneInstanceId: NanoId, type: string, payload: any): void {
    const subscribers = this.sceneChannels.get(sceneInstanceId);
    if (subscribers && subscribers.size > 0) {
      const namespace = this.sceneNamespaces.get(sceneInstanceId);
      const finalType = namespace ? `[${namespace}]${type}` : type;

      console.log(
        `[WS Manager] Publishing to scene ${sceneInstanceId} (${subscribers.size} subscribers). Event: ${finalType}`
      );

      // 咕咕：这里不再需要预先序列化，因为 sendMessageToClient 会处理。
      // 直接将 finalType 和 payload 传递下去即可。
      subscribers.forEach((clientId) => {
        this.sendMessageToClient(clientId, finalType, payload);
      });
    } else {
      console.log(
        `[WS Manager] No subscribers found for scene ${sceneInstanceId} when publishing event ${type}.`
      );
    }
  }

  // 可以添加获取所有客户端 ID 的方法等
  public getAllClientIds(): NanoId[] {
    return Array.from(this.clients.keys());
  }
}

export const webSocketManager = new WebSocketManager();
