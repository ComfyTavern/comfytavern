// apps/frontend-vueflow/src/stores/executionStore.ts
import { defineStore } from 'pinia';
import { reactive, ref } from 'vue'; // 导入 ref
import {
  ExecutionStatus,
  // type NodeStatusUpdatePayload, // 移除旧类型
  // type WorkflowStatusUpdatePayload as OldWorkflowStatusUpdatePayload, // 移除旧类型
  type ExecutionStatusUpdatePayload, // 导入新类型
  type PromptAcceptedResponsePayload,
  type NodeExecutingPayload,
  type NodeProgressPayload,
  type NodeCompletePayload,
  type NodeErrorPayload,
  // type ExecutionType, // 移除未使用的导入
  type NanoId, // 导入 NanoId
} from '@comfytavern/types';

// 定义单个标签页的执行状态接口
interface TabExecutionState {
  promptId: NanoId | null; // 当前执行的 ID
  workflowStatus: ExecutionStatus;
  workflowError: any | null; // 可以存储更丰富的错误信息
  workflowStartTime: number | null; // 考虑是否保留，或从其他地方获取
  workflowEndTime: number | null;   // 考虑是否保留，或从其他地方获取
  nodeStates: Record<NanoId, ExecutionStatus>;
  nodeErrors: Record<NanoId, any | null>; // 存储节点错误详情
  nodeProgress: Record<NanoId, { value: number; max: number } | undefined>; // 存储节点进度
  nodeOutputs: Record<NanoId, Record<string, any> | undefined>; // 存储最终执行结果
  nodePreviewOutputs: Record<NanoId, Record<string, any> | undefined>; // 存储预览结果
}

export const useExecutionStore = defineStore('execution', () => {
  // 使用 Map 按 internalId 存储每个标签页的执行状态
  const tabExecutionStates = reactive<Map<string, TabExecutionState>>(new Map());

  // 全局预览开关状态
  const isPreviewEnabled = ref(false); // 默认为关闭

  // --- Actions ---

  // 切换预览模式
  const togglePreview = () => {
    isPreviewEnabled.value = !isPreviewEnabled.value;
    console.log(`[ExecutionStore] Preview mode toggled: ${isPreviewEnabled.value}`);
  };

  // 辅助函数：确保给定 internalId 的状态对象存在
  const ensureTabExecutionState = (internalId: string): TabExecutionState => {
    if (!tabExecutionStates.has(internalId)) {
      console.debug(`[ExecutionStore] Initializing execution state for tab ${internalId}`);
      tabExecutionStates.set(internalId, {
        promptId: null,
        workflowStatus: ExecutionStatus.IDLE,
        workflowError: null,
        workflowStartTime: null,
        workflowEndTime: null,
        nodeStates: {},
        nodeErrors: {},
        nodeProgress: {},
        nodeOutputs: {},
        nodePreviewOutputs: {},
      });
    }
    // Non-null assertion is safe here because we just ensured it exists
    return tabExecutionStates.get(internalId)!;
  };

  // 重置/准备指定标签页以进行新的执行
  const prepareForNewExecution = (internalId: string) => {
    console.log(`[ExecutionStore] Preparing tab ${internalId} for new execution.`);
    const state = ensureTabExecutionState(internalId);
    state.promptId = null; // 清除旧的 promptId
    state.workflowStatus = ExecutionStatus.IDLE;
    state.workflowError = null;
    state.workflowStartTime = null;
    state.workflowEndTime = null;
    state.nodeStates = {};
    state.nodeErrors = {};
    state.nodeProgress = {};
    state.nodeOutputs = {};
    state.nodePreviewOutputs = {}; // 清除预览输出
  };

  // 处理 Prompt 请求被接受的消息
  const handlePromptAccepted = (internalId: string, payload: PromptAcceptedResponsePayload) => {
    console.debug(`[ExecutionStore] Prompt accepted for tab ${internalId}: ${payload.promptId}`);
    const state = ensureTabExecutionState(internalId);
    // 在接受新 prompt 时重置状态
    prepareForNewExecution(internalId); // 调用重置逻辑
    state.promptId = payload.promptId; // 设置新的 promptId
    state.workflowStatus = ExecutionStatus.QUEUED; // 设置为排队状态
    state.workflowStartTime = Date.now(); // 记录开始时间（排队开始时间）
  };


  // 更新指定标签页的工作流状态 (使用新的 Payload 类型)
  const updateWorkflowStatus = (internalId: string, payload: ExecutionStatusUpdatePayload) => {
    const state = ensureTabExecutionState(internalId);

    // 检查 payload 中的 promptId 是否与当前标签页关联的 promptId 匹配
    if (payload.promptId === state.promptId) {
      console.debug(`[ExecutionStore] Updating workflow status for tab ${internalId} (prompt: ${payload.promptId}): ${payload.status}`, payload);
      state.workflowStatus = payload.status;
      state.workflowError = payload.errorInfo || null; // 使用 errorInfo

      // 如果工作流完成或出错，记录结束时间
      if (payload.status === ExecutionStatus.COMPLETE || payload.status === ExecutionStatus.ERROR || payload.status === ExecutionStatus.INTERRUPTED) {
        state.workflowEndTime = Date.now();
        // 可选：清除 promptId，表示当前执行结束？或者保留用于历史查看？暂时保留。
        // state.promptId = null;
      }
    } else {
      console.warn(`[ExecutionStore] Received status update for prompt ${payload.promptId} which does not match tab ${internalId}'s current prompt ${state.promptId}. Ignoring.`);
    }
  };

  // 更新节点为执行中状态
  const updateNodeExecuting = (internalId: string, payload: NodeExecutingPayload) => {
      const state = ensureTabExecutionState(internalId);
      if (payload.promptId === state.promptId) {
          console.debug(`[ExecutionStore] Node executing for tab ${internalId}: ${payload.nodeId}`);
          state.nodeStates[payload.nodeId] = ExecutionStatus.RUNNING;
          // 清除该节点的旧错误和进度
          delete state.nodeErrors[payload.nodeId];
          delete state.nodeProgress[payload.nodeId];
          // 可选：清除旧的预览输出？
          // delete state.nodePreviewOutputs[payload.nodeId];
      } else {
          console.warn(`[ExecutionStore] Received NODE_EXECUTING for prompt ${payload.promptId} which does not match tab ${internalId}'s current prompt ${state.promptId}. Ignoring node ${payload.nodeId}.`);
      }
  };

  // 更新节点进度
  const updateNodeProgress = (internalId: string, payload: NodeProgressPayload) => {
      const state = ensureTabExecutionState(internalId);
      if (payload.promptId === state.promptId) {
          console.debug(`[ExecutionStore] Node progress for tab ${internalId}, node ${payload.nodeId}: ${payload.value}/${payload.max}`);
          state.nodeProgress[payload.nodeId] = { value: payload.value, max: payload.max };
          // 确保状态至少是 RUNNING
          if (state.nodeStates[payload.nodeId] !== ExecutionStatus.RUNNING && state.nodeStates[payload.nodeId] !== ExecutionStatus.COMPLETE && state.nodeStates[payload.nodeId] !== ExecutionStatus.ERROR) {
             state.nodeStates[payload.nodeId] = ExecutionStatus.RUNNING;
          }
      } else {
          console.warn(`[ExecutionStore] Received NODE_PROGRESS for prompt ${payload.promptId} which does not match tab ${internalId}'s current prompt ${state.promptId}. Ignoring node ${payload.nodeId}.`);
      }
  };

  // 更新节点执行结果 (完成)
  const updateNodeExecutionResult = (internalId: string, payload: NodeCompletePayload) => {
      const state = ensureTabExecutionState(internalId);
      if (payload.promptId === state.promptId) {
          console.debug(`[ExecutionStore] Node complete for tab ${internalId}, node ${payload.nodeId}. Type: ${payload.executionType}`, payload.output);
          state.nodeStates[payload.nodeId] = ExecutionStatus.COMPLETE;
          delete state.nodeErrors[payload.nodeId]; // 清除错误
          delete state.nodeProgress[payload.nodeId]; // 清除进度

          if (payload.executionType === 'full') {
              state.nodeOutputs[payload.nodeId] = payload.output;
              // 清除该节点的预览输出，因为现在有了最终结果
              delete state.nodePreviewOutputs[payload.nodeId];
          } else if (payload.executionType === 'preview') {
              state.nodePreviewOutputs[payload.nodeId] = payload.output;
          }
      } else {
          console.warn(`[ExecutionStore] Received NODE_COMPLETE for prompt ${payload.promptId} which does not match tab ${internalId}'s current prompt ${state.promptId}. Ignoring node ${payload.nodeId}.`);
      }
  };

  // 更新节点错误状态
  const updateNodeError = (internalId: string, payload: NodeErrorPayload) => {
      const state = ensureTabExecutionState(internalId);
      if (payload.promptId === state.promptId) {
          console.error(`[ExecutionStore] Node error for tab ${internalId}, node ${payload.nodeId}:`, payload.errorDetails);
          state.nodeStates[payload.nodeId] = ExecutionStatus.ERROR;
          state.nodeErrors[payload.nodeId] = payload.errorDetails;
          delete state.nodeProgress[payload.nodeId]; // 清除进度
      } else {
          console.warn(`[ExecutionStore] Received NODE_ERROR for prompt ${payload.promptId} which does not match tab ${internalId}'s current prompt ${state.promptId}. Ignoring node ${payload.nodeId}.`);
      }
  };


  // Action to remove state for a closed tab
  const removeTabExecutionState = (internalId: string) => {
    if (tabExecutionStates.has(internalId)) {
      tabExecutionStates.delete(internalId);
      console.log(`[ExecutionStore] Removed execution state for tab ${internalId}`);
    }
  };

  // 手动设置工作流状态 (例如，在发送 PROMPT_REQUEST 后立即设置为 QUEUED)
  const setWorkflowStatusManually = (internalId: string, status: ExecutionStatus, associatedPromptId?: NanoId) => {
    const state = ensureTabExecutionState(internalId);
    console.debug(`[ExecutionStore] Manually setting workflow status for tab ${internalId} to ${status}`);
    state.workflowStatus = status;
    // 如果提供了 promptId (例如，从 PROMPT_REQUEST 发送处)，则设置它
    if (associatedPromptId) {
        state.promptId = associatedPromptId;
    }
    // 当手动设置为 QUEUED 或 RUNNING 时，清除之前的错误信息和时间戳
    if (status === ExecutionStatus.QUEUED || status === ExecutionStatus.RUNNING) {
      state.workflowError = null;
      state.workflowStartTime = Date.now(); // 重置开始时间
      state.workflowEndTime = null;
      // 可能还需要清除节点状态？取决于具体逻辑
      // state.nodeStates = {};
      // state.nodeErrors = {};
      // state.nodeProgress = {};
      // state.nodeOutputs = {};
      // state.nodePreviewOutputs = {};
    }
  };

  // --- Getters (需要 internalId) ---
  const getWorkflowStatus = (internalId: string): ExecutionStatus => {
    return tabExecutionStates.get(internalId)?.workflowStatus ?? ExecutionStatus.IDLE;
  };

  const getCurrentPromptId = (internalId: string): NanoId | null => {
    return tabExecutionStates.get(internalId)?.promptId ?? null;
  };

  const getNodeState = (internalId: string, nodeId: string): ExecutionStatus | undefined => {
    return tabExecutionStates.get(internalId)?.nodeStates[nodeId];
  };

  const getNodeError = (internalId: string, nodeId: string): any | null | undefined => {
    return tabExecutionStates.get(internalId)?.nodeErrors[nodeId];
  };

  const getNodeProgress = (internalId: string, nodeId: string): { value: number; max: number } | undefined => {
      return tabExecutionStates.get(internalId)?.nodeProgress[nodeId];
  };

  // 获取最终输出
  const getNodeOutput = (internalId: string, nodeId: string, outputKey: string): any | undefined => {
    return tabExecutionStates.get(internalId)?.nodeOutputs[nodeId]?.[outputKey];
  };

  const getAllNodeOutputs = (internalId: string, nodeId: string): Record<string, any> | undefined => {
      return tabExecutionStates.get(internalId)?.nodeOutputs[nodeId];
  };

  // 获取预览输出
  const getNodePreviewOutput = (internalId: string, nodeId: string, outputKey: string): any | undefined => {
      return tabExecutionStates.get(internalId)?.nodePreviewOutputs[nodeId]?.[outputKey];
  };

  const getAllNodePreviewOutputs = (internalId: string, nodeId: string): Record<string, any> | undefined => {
      return tabExecutionStates.get(internalId)?.nodePreviewOutputs[nodeId];
  };


  return {
    // Expose tab-specific states and actions
    tabExecutionStates, // Expose the whole map if needed, or prefer specific getters
    // Actions
    prepareForNewExecution, // Renamed from resetExecutionState
    handlePromptAccepted,
    updateWorkflowStatus,
    updateNodeExecuting,
    updateNodeProgress,
    updateNodeExecutionResult,
    updateNodeError,
    removeTabExecutionState,
    setWorkflowStatusManually,
    // Getters
    getWorkflowStatus,
    getCurrentPromptId, // Added getter for promptId
    getNodeState,
    getNodeError,
    getNodeProgress, // Added getter for progress
    getNodeOutput,
    getAllNodeOutputs,
    getNodePreviewOutput, // Added getter for preview output
    getAllNodePreviewOutputs, // Added getter for all preview outputs
    // Preview Toggle
    isPreviewEnabled, // Expose state
    togglePreview, // Expose action
  };
});