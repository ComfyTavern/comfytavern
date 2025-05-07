import { t } from 'elysia';
import {
  WebSocketMessageType,
  type WebSocketMessage,
  type WorkflowExecutionPayload, // Use the correct payload type
  type ExecutePreviewRequestPayload, // Import preview payload type
  type ErrorPayload,
  NanoId, // Import NanoId
} from '@comfytavern/types';
import { ConcurrencyScheduler } from '../services/ConcurrencyScheduler'; // Import Scheduler
import { WebSocketManager } from './WebSocketManager'; // Import WS Manager

// 定义 WebSocket 消息体 Schema (保持不变)
export const websocketSchema = {
  body: t.Object({
    type: t.Enum(WebSocketMessageType, { error: "Invalid WebSocket message type" }),
    payload: t.Any(),
  }),
  // 添加 context decorator 来获取 clientId (Elysia v1.x 方式)
  // 这需要在 index.ts 的 .ws() 调用中配置
  // context: ws => ({ clientId: ws.data.clientId }) // 假设 clientId 在 data 中
};

// 工厂函数，创建 WebSocket 处理器对象
export function createWebsocketHandler(
  scheduler: ConcurrencyScheduler,
  wsManager: WebSocketManager // 接收 wsManager 实例
) {
  return {
    open(ws: any) { // 使用 any 避免复杂的 Elysia 上下文类型
      // Elysia v1.x 中，id 通常在 ws.data.id 或 ws.id
      // WebSocketManager 现在处理连接和 clientId 分配
      // 这里可以保留日志或移除
      // console.log('[Handler] WebSocket connection opened:', ws.id);
    },

    close(ws: any) {
      // WebSocketManager 现在处理断开连接
      // console.log('[Handler] WebSocket connection closed:', ws.id);
    },

    async message(ws: any, message: WebSocketMessage<any>) {
      // 尝试获取 clientId (需要与 WebSocketManager 中的逻辑一致)
      const clientId = ws.data?.clientId || ws.id || ws.request?.headers?.['sec-websocket-key'] || 'unknown'; // 多种方式尝试获取
      console.log(`[Handler] Message received from client ${clientId}:`, message.type);

      try {
        switch (message.type) {
          case WebSocketMessageType.PROMPT_REQUEST: {
            const payload = message.payload as WorkflowExecutionPayload;
            console.log(`[Handler] Received PROMPT_REQUEST from ${clientId}`);
            // 将请求提交给调度器
            scheduler.submitExecution(payload, 'websocket', clientId);
            // 调度器内部会发送 PROMPT_ACCEPTED_RESPONSE
            break;
          }

          case WebSocketMessageType.EXECUTE_PREVIEW_REQUEST: {
            const payload = message.payload as ExecutePreviewRequestPayload;
            console.log(`[Handler] Received EXECUTE_PREVIEW_REQUEST from ${clientId} for node ${payload.changedNodeId}`);
            // TODO: 将预览请求传递给合适的处理程序
            // 这可能需要调度器或执行引擎提供专门的预览方法
            // scheduler.submitPreview(payload, clientId); // 假设有此方法
             ws.send(JSON.stringify({
               type: WebSocketMessageType.ERROR,
               payload: { message: 'Preview execution not yet implemented.' } as ErrorPayload,
             }));
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
            console.log(`[Handler] Received BUTTON_CLICK from ${clientId}`);
            // TODO: 实现按钮点击处理
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