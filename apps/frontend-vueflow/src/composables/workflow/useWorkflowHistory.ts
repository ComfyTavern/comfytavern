import { klona } from "klona/full";
import { computed, reactive } from "vue";
// 直接从中央定义文件导入类型
import type { HistoryEntry } from "@comfytavern/types"; // <-- Import HistoryEntry
import type { WorkflowStateSnapshot } from "../../types/workflowTypes";

// --- 类型定义 ---

// 历史记录项接口 - 使用导入的 WorkflowStateSnapshot 和 HistoryEntry
export interface HistoryItem {
  entry: HistoryEntry; // <-- Change label to entry object
  payload: WorkflowStateSnapshot; // 实际存储的数据快照
}

// 每个工作流实例的历史状态接口
interface HistoryState {
  items: HistoryItem[];
  currentIndex: number;
  savedIndex: number; // 记录上次保存时的索引，-1 表示从未保存或新建未保存
}

// --- 状态管理 ---

// 使用 Map 来管理多个工作流实例的历史记录
// Key: internalId (工作流的唯一标识符)
const histories = reactive<Map<string, HistoryState>>(new Map());

export const MAX_HISTORY_LENGTH = 50; // 历史记录最大长度 - 导出常量

/**
 * Composable 函数，用于管理特定工作流的状态历史记录，支持撤销和重做。
 */
export function useWorkflowHistory() {
  /**
   * 获取指定 internalId 的历史状态对象
   */
  const getHistoryState = (internalId: string): HistoryState | undefined => {
    return histories.get(internalId);
  };

  /**
   * 确保指定 internalId 的历史状态对象存在，如果不存在则创建
   */
  const ensureHistoryState = (internalId: string): HistoryState => {
    if (!histories.has(internalId)) {
      histories.set(internalId, {
        items: [],
        currentIndex: -1, // 初始状态，还没有任何记录
        savedIndex: -1,
      });
      console.debug(`[History] Initialized history state for ${internalId}`);
    }
    return histories.get(internalId)!;
  };

  /**
   * 记录一个新的历史快照
   * @param internalId 工作流的唯一标识符
   * @param entry 结构化的历史记录条目
   * @param payload 要记录的数据状态快照 (类型来自 workflowTypes)
   */
  const recordSnapshot = (
    internalId: string,
    entry: HistoryEntry,
    payload: WorkflowStateSnapshot
  ) => {
    // <-- Change label to entry
    console.log(
      `%c[History] Attempting to record snapshot for ${internalId}: "${entry.summary}"`, // Log summary
      "color: orange; font-weight: bold;"
    );
    const state = ensureHistoryState(internalId);

    try {
      // 深拷贝 payload，防止后续修改影响历史记录
      const clonedPayload = klona(payload);

      // 如果当前索引不是最后一个（意味着执行过 undo），则丢弃后续历史
      if (state.currentIndex < state.items.length - 1) {
        state.items = state.items.slice(0, state.currentIndex + 1);
        console.log(
          `[History] Truncated future history for ${internalId} from index ${
            state.currentIndex + 1
          }`
        );
      }

      // 添加新快照
      state.items.push({
        entry, // <-- Store the entry object
        payload: clonedPayload,
      });

      // 限制历史记录长度
      if (state.items.length > MAX_HISTORY_LENGTH) {
        const removedItem = state.items.shift(); // 移除最旧的记录
        console.log(
          `[History] Limited history length for ${internalId}. Removed: "${removedItem?.entry.summary}"` // Log summary
        );
        // 如果移除了已保存的记录，需要调整 savedIndex
        if (state.savedIndex > 0) {
          state.savedIndex--;
        } else if (state.savedIndex === 0) {
          // 如果刚好移除了保存点，标记为未保存（因为无法回退到那个点了）
          state.savedIndex = -1;
          console.log(`[History] Removed saved point for ${internalId}. Marked as unsaved.`);
        }
        // 同时也要调整当前索引，因为数组长度减一了
        if (state.currentIndex > 0) {
          state.currentIndex--;
        }
      }

      // 更新当前索引到最新添加的快照
      // 无论是否达到长度限制，都将当前索引指向最新添加的快照
      state.currentIndex = state.items.length - 1;

      // console.debug(
      //   `[History] Snapshot recorded for ${internalId}. New index: ${state.currentIndex}, Total items: ${state.items.length}`
      // );
    } catch (error) {
      console.error(`[History] Error recording snapshot for ${internalId}:`, error);
    }
  };

  /**
   * 撤销操作，返回上一个状态的 payload
   * @param internalId 工作流的唯一标识符
   * @returns 上一个状态的 payload (类型来自 workflowTypes)，如果无法撤销则返回 null
   */
  const undo = (internalId: string): WorkflowStateSnapshot | null => {
    const state = getHistoryState(internalId);
    if (!state || state.currentIndex < 0) {
      console.log(`[History] Cannot undo for ${internalId}. Index: ${state?.currentIndex}`);
      return null;
    }

    const targetIndex = state.currentIndex - 1;
    state.currentIndex = targetIndex;
    console.log(`[History] Undo for ${internalId}. New index: ${state.currentIndex}`);

    if (targetIndex === -1) {
      console.log(`[History] Undid to initial state for ${internalId}.`);
      return null;
    }

    const itemToUndo = state.items[targetIndex];
    if (!itemToUndo) {
      console.error(
        `[History] Error: Item not found at index ${targetIndex} on undo for ${internalId}`
      );
      // 回滚索引更改
      state.currentIndex++;
      return null;
    }
    try {
      return klona(itemToUndo.payload);
    } catch (error) {
      console.error(
        `[History] Error cloning snapshot on undo for ${internalId} at index ${targetIndex}:`,
        error
      );
      // 回滚索引更改
      state.currentIndex++;
      return null;
    }
  };

  /**
   * 重做操作，返回下一个状态的 payload
   * @param internalId 工作流的唯一标识符
   * @returns 下一个状态的 payload (类型来自 workflowTypes)，如果无法重做则返回 null
   */
  const redo = (internalId: string): WorkflowStateSnapshot | null => {
    const state = getHistoryState(internalId);
    if (!state || state.currentIndex >= state.items.length - 1) {
      console.log(
        `[History] Cannot redo for ${internalId}. Index: ${state?.currentIndex}, Length: ${state?.items.length}`
      );
      return null;
    }

    state.currentIndex++;
    console.log(`[History] Redo for ${internalId}. New index: ${state.currentIndex}`);

    const itemToRedo = state.items[state.currentIndex];
    if (!itemToRedo) {
      console.error(
        `[History] Error: Item not found at index ${state.currentIndex} on redo for ${internalId}`
      );
      // 回滚索引更改
      state.currentIndex--;
      return null;
    }
    try {
      return klona(itemToRedo.payload);
    } catch (error) {
      console.error(
        `[History] Error cloning snapshot on redo for ${internalId} at index ${state.currentIndex}:`,
        error
      );
      // 回滚索引更改
      state.currentIndex--;
      return null;
    }
  };

  /**
   * 标记当前状态为已保存状态
   * @param internalId 工作流的唯一标识符
   */
  const markAsSaved = (internalId: string) => {
    const state = getHistoryState(internalId);
    if (state) {
      state.savedIndex = state.currentIndex;
      console.log(`[History] Marked as saved for ${internalId} at index ${state.savedIndex}`);
    } else {
      console.warn(`[History] Attempted to mark non-existent history as saved for ${internalId}`);
    }
  };

  /**
   * 清除指定工作流的历史记录
   * @param internalId 工作流的唯一标识符
   */
  const clearHistory = (internalId: string) => {
    if (histories.has(internalId)) {
      histories.delete(internalId);
      console.log(`[History] Cleared history for ${internalId}`);
    }
  };

  // --- 计算属性 ---

  /**
   * 检查指定工作流是否可以执行撤销操作
   */
  const canUndo = (internalId: string) =>
    computed(() => {
      const state = getHistoryState(internalId);
      return state ? state.currentIndex >= 0 : false;
    });

  /**
   * 检查指定工作流是否可以执行重做操作
   */
  const canRedo = (internalId: string) =>
    computed(() => {
      const state = getHistoryState(internalId);
      return state ? state.currentIndex < state.items.length - 1 : false;
    });

  /**
   * 判断指定工作流当前状态是否与上次保存的状态不同
   */
  const hasUnsavedChanges = (internalId: string) =>
    computed(() => {
      const state = getHistoryState(internalId);
      if (!state) return false;

      if (state.savedIndex === -1 && state.currentIndex >= 0) {
        return true;
      }
      if (state.savedIndex !== -1 && state.currentIndex !== state.savedIndex) {
        return true;
      }
      return false;
    });

  /**
   * 获取指定工作流用于 UI 显示的历史记录摘要列表
   */
  const getHistorySummaries = (
    internalId: string // <-- Rename function
  ) =>
    computed(() => {
      const state = getHistoryState(internalId);
      // Extract summary from the entry object
      return state ? state.items.map((item) => item.entry.summary) : []; // <-- Get entry.summary
    });

  /**
   * 获取指定工作流当前活动的历史记录索引
   */
  const getCurrentIndex = (internalId: string) =>
    computed(() => {
      const state = getHistoryState(internalId);
      return state ? state.currentIndex : -1;
    });

  // 返回所有公共方法和计算属性
  return {
    getHistoryState,
    ensureHistoryState,
    recordSnapshot,
    undo,
    redo,
    markAsSaved,
    clearHistory,
    canUndo,
    canRedo,
    hasUnsavedChanges,
    getHistorySummaries, // <-- Export renamed function
    getCurrentIndex,
  };
}
