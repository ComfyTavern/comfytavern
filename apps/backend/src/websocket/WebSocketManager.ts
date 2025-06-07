// 移除 'ws' 库的导入
// import WebSocket, { WebSocketServer } from 'ws';
// 移除旧的 ElysiaWS 导入
// import { type ElysiaWS } from 'elysia';
import type { ServerWebSocket } from 'bun'; // 从 bun 导入正确的类型
import { nanoid } from 'nanoid';

import { NanoId } from '@comfytavern/types';

// 定义 WebSocket 上下文类型
// Bun 的 ServerWebSocket 通常需要一个泛型参数来定义 data 的类型
// 使用 unknown 或 any 如果不确定 data 的具体结构
type WsContextData = { clientId?: NanoId;[key: string]: any }; // 假设 data 可能包含 clientId
type WsContext = ServerWebSocket<WsContextData>;

interface ClientInfo {
  ws: WsContext; // 使用正确的 ServerWebSocket 类型
  // 可以添加更多客户端信息
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

  constructor() {
    // 构造函数简化
    console.log('[WS Manager] Instance created. Ready for Elysia integration.');
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

    this.clients.set(clientId, { ws });
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
    console.log(`[WS Manager] Received message from ${clientId}:`, typeof message === 'object' ? JSON.stringify(message) : message);
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
    console.error(`[WS Manager] WebSocket error for client ${clientId || 'unknown'}:`, error);
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


  /**
   * 向特定客户端发送消息。
   * @param clientId 目标客户端 ID
   * @param type 消息类型
   * @param payload 消息载荷
   */
  public sendMessageToClient(clientId: NanoId, type: string, payload: any): boolean {
    const clientInfo = this.clients.get(clientId);
    // 移除 readyState 检查，直接尝试发送
    if (clientInfo) {
      try {
        // 需要手动序列化为 JSON 字符串
        clientInfo.ws.send(JSON.stringify({ type, payload }));
        // console.log(`[WS Manager] Sent message type ${type} to client ${clientId}`);
        return true;
      } catch (error) {
        console.error(`[WS Manager] Failed to send message to client ${clientId}:`, error);
        // 发送失败，可能连接已关闭，移除客户端
        this.removeClient(clientInfo.ws);
        return false;
      }
    } else {
      // console.warn(`[WS Manager] Client ${clientId} not found for sending message.`);
      return false;
    }
  }

  /**
   * 向所有连接的客户端广播消息。
   * @param type 消息类型
   * @param payload 消息载荷
   */
  public broadcast(type: string, payload: any): void {
    console.log(`[WS Manager] Attempting to broadcast message. Type: ${type}, Payload: ${JSON.stringify(payload)}, Number of clients: ${this.clients.size}`); // 新增日志
    if (this.clients.size === 0) {
      console.warn('[WS Manager] Broadcast called, but no clients are connected.');
      return;
    }
    // 需要手动序列化为 JSON 字符串
    const messageString = JSON.stringify({ type, payload });
    const clientsToRemove: WsContext[] = [];

    this.clients.forEach((clientInfo, clientId) => {
      // 移除 readyState 检查
      try {
        clientInfo.ws.send(messageString); // 发送序列化后的字符串
      } catch (error) {
        console.error(`[WS Manager] Failed to broadcast message to client ${clientId}:`, error);
        clientsToRemove.push(clientInfo.ws);
      }
    });

    clientsToRemove.forEach(ws => this.removeClient(ws));
  }

  // 可以添加获取所有客户端 ID 的方法等
  public getAllClientIds(): NanoId[] {
    return Array.from(this.clients.keys());
  }
}