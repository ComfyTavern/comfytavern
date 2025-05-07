import { readonly } from 'vue';
import { debounce } from 'lodash-es';
import { storeToRefs } from 'pinia';
import { useExecutionStore } from '@/stores/executionStore';
import { useWebSocket } from '@/composables/useWebSocket';
import {
  type ExecutePreviewRequestPayload,
  WebSocketMessageType,
  type WebSocketMessage,
} from '@comfytavern/types';

/**
 * Composable for handling workflow preview execution logic.
 */
export function useWorkflowPreview() {
  const executionStore = useExecutionStore();
  const { sendMessage } = useWebSocket();
  const { isPreviewEnabled: isPreviewEnabledFromStore } = storeToRefs(executionStore);

  /**
   * 请求对变更的节点进行预览执行 (防抖处理)。
   * @param internalId 标签页 ID。
   * @param changedNodeId 发生变更的节点 ID。
   * @param inputKey 发生变更的输入/配置键。
   * @param newValue 新的值。
   */
  const requestPreviewExecution = debounce(
    (
      internalId: string,
      changedNodeId: string,
      inputKey: string,
      newValue: any
    ) => {
      // Use the state from the store
      if (!isPreviewEnabledFromStore.value) {
        // console.debug("[WorkflowPreview:requestPreviewExecution] Preview is disabled. Skipping.");
        return;
      }

      const currentPromptId = executionStore.getCurrentPromptId(internalId);
      // 预览请求可以独立于完整执行，不一定需要 promptId
      // 但如果存在，可以发送以供后端参考

      console.debug(
        `[WorkflowPreview:requestPreviewExecution] Requesting preview for tab ${internalId}, node ${changedNodeId}, key ${inputKey}. Current prompt: ${currentPromptId}`
      );

      const payload: ExecutePreviewRequestPayload = {
        // previewRequestId: nanoid(), // 可选，用于关联响应
        workflowId: currentPromptId ?? undefined, // 使用 workflowId 字段
        // internalId: internalId, // <-- Fix: Remove internalId, not part of the type
        changedNodeId: changedNodeId,
        inputKey: inputKey,
        newValue: newValue,
      };

      const message: WebSocketMessage<ExecutePreviewRequestPayload> = {
        type: WebSocketMessageType.EXECUTE_PREVIEW_REQUEST,
        payload: payload,
      };

      sendMessage(message);
      console.debug("[WorkflowPreview:requestPreviewExecution] EXECUTE_PREVIEW_REQUEST sent.", message);
    },
    500 // 防抖延迟 (例如 500ms)
  );

  return {
    requestPreviewExecution,
    // Expose the read-only state from the store
    isPreviewEnabled: readonly(isPreviewEnabledFromStore),
  };
}