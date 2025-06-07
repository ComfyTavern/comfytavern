import { t } from 'elysia';

import {
    ButtonClickPayload, ErrorPayload, NanoId, WebSocketMessage, WebSocketMessageType,
    WorkflowExecutionPayload
} from '@comfytavern/types';

import { ConcurrencyScheduler } from '../services/ConcurrencyScheduler'; // Import Scheduler
import { WebSocketManager } from './WebSocketManager'; // Import WS Manager

// 定义 WebSocket 消息体 Schema (保持不变)
export const websocketSchema = {
  body: t.Object({
    type: t.Enum(WebSocketMessageType, { error: "Invalid WebSocket message type" }),
    payload: t.Any(),
  }),
  response: t.Any(),
  error: t.Any(),
};

// 工厂函数，创建 WebSocket 处理器对象
export function createWebsocketHandler(
  scheduler: ConcurrencyScheduler,
  wsManager: WebSocketManager // 接收 wsManager 实例
) {
  return {
    open(ws: any) { // 使用 any 避免复杂的 Elysia 上下文类型
      // WebSocketManager 处理连接和 clientId 分配
      const clientId = wsManager.addClient(ws);
      // 将 clientId 存储在 ws.data 中，以便在 message/close/error 中使用
      // Elysia 的 ws 对象允许通过 data 附加自定义上下文
      if (!ws.data) {
        ws.data = {};
      }
      ws.data.clientId = clientId;
      console.log(`[Handler] WebSocket connection opened. Client ID: ${clientId} assigned to ws.data. Total clients: ${wsManager.getAllClientIds().length}`);
    },

    close(ws: any, code: number, reason: string) {
      const clientId = ws.data?.clientId; // 从 ws.data 获取 clientId
      // WebSocketManager 处理断开连接
      wsManager.removeClient(ws);
      console.log(`[Handler] WebSocket connection closed. Client ID: ${clientId || 'unknown'}. Code: ${code}. Reason: ${reason}. Total clients: ${wsManager.getAllClientIds().length}`);
    },

    error(context: any) {
      const { ws, error } = context;
      const clientId = ws?.data?.clientId; // 从 ws.data 获取 clientId
      console.error(`[Handler] WebSocket error for client ${clientId || 'unknown'}:`, error);
      // WebSocketManager 应该也处理错误时的客户端移除
      wsManager.handleError(ws, error); // 确保 wsManager 也知道错误并可能移除客户端
      console.log(`[Handler] WebSocket error processed. Total clients after error: ${wsManager.getAllClientIds().length}`);
    },

    async message(ws: any, message: WebSocketMessage<any>) {
      const clientId = ws.data?.clientId; // 从 ws.data 获取 clientId
      if (!clientId) {
        console.error('[Handler] Received message from WebSocket without a clientId in ws.data. Ignoring message.', message);
        // 可以选择关闭这个无法识别的连接
        // ws.close(1008, "Client ID not found in context");
        return;
      }
      console.log(`[Handler] Message received from client ${clientId}:`, message.type);

      try {
        switch (message.type) {
          case WebSocketMessageType.PROMPT_REQUEST: {
            // console.log(`[Handler DEBUG] Raw message.payload for PROMPT_REQUEST from ${clientId}:`, JSON.stringify(message.payload, null, 2));
            const payload = message.payload as WorkflowExecutionPayload;
            if (payload.interfaceInputs) {
              console.log(`[Handler DEBUG] PROMPT_REQUEST payload from ${clientId} CONTAINS interfaceInputs AFTER type assertion.`);
            } else {
              console.log(`[Handler DEBUG] PROMPT_REQUEST payload from ${clientId} DOES NOT CONTAIN interfaceInputs AFTER type assertion.`);
            }
            console.log(`[Handler] Received PROMPT_REQUEST from ${clientId}`);
            // 将请求提交给调度器
            scheduler.submitExecution(payload, 'websocket', clientId);
            // 调度器内部会发送 PROMPT_ACCEPTED_RESPONSE
            break;
          }



          case WebSocketMessageType.INTERRUPT_REQUEST: {
            const payload = message.payload as { promptId: NanoId };
            console.log(`[Handler] Received INTERRUPT_REQUEST from ${clientId} for prompt ${payload.promptId}`);
            const success = scheduler.interruptExecution(payload.promptId);
            if (!success) {
              console.warn(`[Handler] Failed to interrupt prompt ${payload.promptId} (not found or already finished).`);
              // 可以选择性地向客户端发送一个错误或确认信息
            }
            // 调度器会在中断成功时发送 INTERRUPTED 状态更新
            break;
          }

          // 保留其他可能的消息类型处理逻辑 (如果需要)
          case WebSocketMessageType.BUTTON_CLICK: {
            const payload = message.payload as ButtonClickPayload; // Assert type
            console.log(`[Handler] Received BUTTON_CLICK from client ${clientId}: Node ID: ${payload.nodeId}, Button: ${payload.buttonName}, Workflow ID: ${payload.workflowId || 'N/A'}, Node Type: ${payload.nodeType || 'N/A'}, Display Name: ${payload.nodeDisplayName || 'N/A'}`);
            // TODO: 实现按钮点击处理，现在可以使用 payload 中的额外上下文信息
            // 例如，如果某些按钮点击需要在后端触发特定操作，
            // scheduler.handleNodeButtonInteraction(payload);
            break;
          }

          default:
            console.warn(`[Handler] Unknown message type received from ${clientId}: ${message.type}`);
            ws.send(JSON.stringify({ // 发送错误消息对象
              type: WebSocketMessageType.ERROR,
              payload: { message: `Unknown message type: ${message.type}` } as ErrorPayload,
            }));
        }
      } catch (error) {
        console.error(`[Handler] Error processing message from ${clientId}:`, error);
        ws.send(JSON.stringify({ // 发送错误消息对象
          type: WebSocketMessageType.ERROR,
          payload: {
            message: `Error processing message: ${error instanceof Error ? error.message : String(error)}`,
          } as ErrorPayload,
        }));
      }
    },
  };
}