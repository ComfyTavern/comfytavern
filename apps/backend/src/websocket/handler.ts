import { t } from 'elysia';
import {
  WebSocketMessageType,
  type WebSocketMessage,
  type WorkflowExecutionPayload, // Use the correct payload type
  type ExecutePreviewRequestPayload, // Import preview payload type
  type ButtonClickPayload, // <-- Import ButtonClickPayload
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

    close(ws: any, code: number, message: ArrayBuffer | undefined) {
      const clientId = ws.data?.clientId; // 从 ws.data 获取 clientId
      // WebSocketManager 处理断开连接
      wsManager.removeClient(ws);
      console.log(`[Handler] WebSocket connection closed. Client ID: ${clientId || 'unknown'}. Code: ${code}. Total clients: ${wsManager.getAllClientIds().length}`);
    },

    error(ws: any, error: Error) {
      const clientId = ws.data?.clientId; // 从 ws.data 获取 clientId
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