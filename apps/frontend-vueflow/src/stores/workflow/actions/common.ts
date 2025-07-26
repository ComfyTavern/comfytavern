// apps/frontend-vueflow/src/stores/workflow/actions/common.ts
import { nextTick } from "vue";
import type { HistoryEntry } from "@comfytavern/types";
import type { WorkflowStateSnapshot } from "@/types/workflowTypes";
import type { WorkflowStoreContext } from "../types";

/**
 * 创建可在多个 action 模块之间共享的通用辅助函数。
 * 这些函数是无状态的，通过传入的 context 对象与 store 的核心部分交互。
 * @param context - 提供对 store 核心管理器（如 workflowManager, historyManager 等）的访问。
 * @returns 一个包含通用辅助函数的对象。
 */
export function createCommonActions(context: WorkflowStoreContext) {
  const { workflowManager, historyManager, workflowViewManagement, tabStore } = context;

  /**
   * 获取当前活动标签页或指定标签页的最新状态快照。
   * @param internalId - 可选的标签页内部 ID，未提供时使用活动标签页ID。
   * @returns 工作流状态快照，找不到时返回 undefined。
   */
  function getCurrentSnapshot(internalId?: string): WorkflowStateSnapshot | undefined {
    const idToUse = internalId ?? tabStore.activeTabId;
    return idToUse ? workflowManager.getCurrentSnapshot(idToUse) : undefined;
  }

  /**
   * 验证标签页ID并获取其快照。
   * @param internalId - 标签页的内部 ID。
   * @param action - 调用此函数的动作名称，用于错误日志。
   * @returns 包含快照或错误信息的对象。
   */
  function validateAndGetSnapshot(
    internalId: string | undefined,
    action: string
  ): { snapshot?: WorkflowStateSnapshot; error?: string } {
    if (!internalId) {
      return { error: `[${action}] 无效的标签页ID` };
    }
    const snapshot = getCurrentSnapshot(internalId);
    if (!snapshot) {
      return { error: `[${action}] 无法获取标签页 ${internalId} 的快照` };
    }
    return { snapshot };
  }

  /**
   * 记录历史快照。
   * @param internalId - 标签页的内部 ID。
   * @param entry - 要记录的历史条目。
   * @param snapshotToRecord - 可选的特定快照，未提供则获取当前快照。
   */
  function recordHistory(
    internalId: string,
    entry: HistoryEntry,
    snapshotToRecord?: WorkflowStateSnapshot
  ) {
    const snapshot = snapshotToRecord ?? getCurrentSnapshot(internalId);
    if (snapshot) {
      historyManager.recordSnapshot(internalId, entry, snapshot);
    }
  }

  /**
   * 异步更新指定节点的内部状态和视图。
   * 通常在节点的连接或结构变化后调用，确保 VueFlow 正确渲染。
   * @param internalId - 标签页的内部 ID。
   * @param nodeIds - 需要更新的节点 ID 数组。
   */
  async function updateNodeInternals(internalId: string, nodeIds: string[]) {
    const instance = workflowViewManagement.getVueFlowInstance(internalId);
    if (instance) {
      // 使用多个 nextTick 确保在 DOM 更新后执行
      await nextTick();
      await nextTick();
      instance.updateNodeInternals(nodeIds);
      await nextTick();
    }
  }

  return {
    getCurrentSnapshot,
    validateAndGetSnapshot,
    recordHistory,
    updateNodeInternals,
  };
}