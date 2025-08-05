import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getSystemStats, getExecutions, interruptExecution } from '@/api/executionApi';
import type { NanoId, PromptInfo, SystemQueueUpdatePayload } from '@comfytavern/types';
import { useDialogService } from '@/services/DialogService';

export const useSystemStatusStore = defineStore('systemStatus', () => {
  const runningCount = ref(0);
  const pendingCount = ref(0);

  const runningList = ref<PromptInfo[]>([]);
  const pendingList = ref<PromptInfo[]>([]);

  const dialogService = useDialogService();

  /**
   * 由 WebSocket 路由器调用，用于更新队列状态计数。
   * @param payload 包含最新计数的载荷
   */
  function updateQueueStatus(payload: SystemQueueUpdatePayload) {
    // console.log('[SystemStatusStore] Queue status updated via WebSocket:', payload);
    runningCount.value = payload.runningExecutions;
    pendingCount.value = payload.pendingExecutions;
  }

  /**
   * 通过 HTTP API 获取初始的/完整的系统状态。
   * 主要用于组件挂载时获取初始状态。
   */
  async function fetchInitialSystemStats() {
    try {
      const stats = await getSystemStats();
      runningCount.value = stats.runningExecutions;
      pendingCount.value = stats.pendingExecutions;
    } catch (error) {
      console.error('[SystemStatusStore] Failed to fetch initial system stats:', error);
    }
  }

  /**
   * 获取详细的运行和等待列表（用于弹窗）。
   */
  async function fetchExecutionLists() {
    try {
      const lists = await getExecutions();
      runningList.value = lists.running;
      pendingList.value = lists.pending;
      // 同步更新计数，确保UI一致性
      runningCount.value = lists.running.length;
      pendingCount.value = lists.pending.length;
    } catch (error) {
      console.error('[SystemStatusStore] Failed to fetch execution lists:', error);
    }
  }

  async function interrupt(promptId: NanoId) {
    try {
      const result = await interruptExecution(promptId);
      if (result.success) {
        dialogService.showSuccess(`任务 ${promptId} 已成功中断或取消。`);
        // 后端会通过 ws 推送最新状态，但为了弹窗内容能立即更新，手动拉取一次列表
        await fetchExecutionLists();
      } else {
        dialogService.showError(`中断任务 ${promptId} 失败: ${result.message}`);
      }
    } catch (error: any) {
      console.error(`[SystemStatusStore] Failed to interrupt execution ${promptId}:`, error);
      dialogService.showError(`中断任务时发生错误: ${error.message || '未知错误'}`);
    }
  }

  return {
    runningCount,
    pendingCount,
    runningList,
    pendingList,
    updateQueueStatus,
    fetchInitialSystemStats,
    fetchExecutionLists,
    interrupt,
  };
});