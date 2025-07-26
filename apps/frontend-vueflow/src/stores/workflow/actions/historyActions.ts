// apps/frontend-vueflow/src/stores/workflow/actions/historyActions.ts
import { nextTick } from "vue";
import { klona } from "klona";
import type { Node as VueFlowNode, Edge as VueFlowEdge } from "@vue-flow/core";
import type { WorkflowStateSnapshot } from "@/types/workflowTypes";
import type { WorkflowStoreContext } from "../types";

// 依赖项，需要通过 context 传入
// - tabStore
// - historyManager
// - workflowManager
// - workflowViewManagement

export function createHistoryActions(context: WorkflowStoreContext) {
  const { tabStore, historyManager, workflowManager, workflowViewManagement } = context;

  /**
   * 撤销指定标签页中的操作。
   * @param steps - 要撤销的步数，默认为 1。
   * @param internalId - 可选的标签页内部 ID。如果未提供，则使用当前活动的标签页。
   */
  async function undo(steps: number = 1, internalId?: string) {
    const idToUndo = internalId ?? tabStore.activeTabId;
    if (!idToUndo) {
      console.warn("[HistoryActions] 无法撤销，没有活动的标签页或未提供 ID。");
      return;
    }
    if (steps <= 0) {
      console.warn(`[HistoryActions] Cannot undo ${steps} steps.`);
      return;
    }

    historyManager.ensureHistoryState(idToUndo);
    let targetSnapshot: WorkflowStateSnapshot | null = null;
    for (let i = 0; i < steps; i++) {
      if (!historyManager.canUndo(idToUndo).value) {
        break;
      }
      targetSnapshot = historyManager.undo(idToUndo);
      if (targetSnapshot === null) {
        break;
      }
    }

    if (targetSnapshot === null) {
      try {
        const instance = workflowViewManagement.getVueFlowInstance(idToUndo);
        const defaultSnapshot = await workflowManager.applyDefaultWorkflowToTab(idToUndo);
        await nextTick();
        if (instance && defaultSnapshot) {
          const nodes = defaultSnapshot.elements.filter(
            (el: VueFlowNode | VueFlowEdge): el is VueFlowNode => !("source" in el)
          );
          const edges = defaultSnapshot.elements.filter(
            (el: VueFlowNode | VueFlowEdge): el is VueFlowEdge => "source" in el
          );
          instance.setNodes(nodes);
          instance.setEdges(edges);
          instance.setViewport(defaultSnapshot.viewport);
        } else if (!instance) {
          console.warn(
            `[HistoryActions] 在应用默认状态之前无法获取标签页 ${idToUndo} 的 VueFlow 实例。`
          );
        } else if (!defaultSnapshot) {
          console.warn(
            `[HistoryActions] 撤销到初始状态后无法获取标签页 ${idToUndo} 的默认快照（post-nextTick）。实例可用。`
          );
        }
      } catch (error) {
        console.error(
          `[HistoryActions] 在撤销标签页 ${idToUndo} 期间应用默认工作流时出错：`,
          error
        );
      }
      return;
    }

    const appliedCore = workflowManager.applyStateSnapshot(idToUndo, targetSnapshot);

    if (!appliedCore) {
      console.error(
        `[HistoryActions] 在撤销标签页 ${idToUndo} 期间应用核心数据快照失败。正在中止画布更新。`
      );
      return;
    }

    const instance = workflowViewManagement.getVueFlowInstance(idToUndo);
    if (instance) {
      try {
        const nodes = targetSnapshot.elements.filter(
          (el: VueFlowNode | VueFlowEdge): el is VueFlowNode => !("source" in el)
        );
        const edges = targetSnapshot.elements.filter(
          (el: VueFlowNode | VueFlowEdge): el is VueFlowEdge => "source" in el
        );
        const viewport = targetSnapshot.viewport;

        instance.setNodes([]);
        instance.setEdges([]);
        await nextTick();
        instance.setNodes(nodes);
        instance.setEdges(edges);
        instance.setViewport(viewport);

        const stateAfterUndo = workflowManager.getActiveTabState();
        if (stateAfterUndo) {
          stateAfterUndo.elements = klona(targetSnapshot.elements);
          stateAfterUndo.viewport = klona(targetSnapshot.viewport);
        }
      } catch (error) {
        console.error(
          `[HistoryActions] 在撤销期间应用快照时出错（直接应用）标签页 ${idToUndo}：`,
          error
        );
      }
    } else {
      console.warn(
        `[HistoryActions] 在撤销期间无法获取标签页 ${idToUndo} 的 VueFlow 实例。无法应用快照。`
      );
    }
  }

  /**
   * 重做指定标签页中的操作。
   * @param steps - 要重做的步数，默认为 1。
   * @param internalId - 可选的标签页内部 ID。如果未提供，则使用当前活动的标签页。
   */
  async function redo(steps: number = 1, internalId?: string) {
    const idToRedo = internalId ?? tabStore.activeTabId;
    if (!idToRedo) {
      console.warn("[HistoryActions] 无法重做，没有活动的标签页或未提供 ID。");
      return;
    }
    if (steps <= 0) {
      console.warn(`[HistoryActions] Cannot redo ${steps} steps.`);
      return;
    }

    historyManager.ensureHistoryState(idToRedo);
    let targetSnapshot: WorkflowStateSnapshot | null = null;
    let actualSteps = 0;
    for (let i = 0; i < steps; i++) {
      if (!historyManager.canRedo(idToRedo).value) {
        break;
      }
      targetSnapshot = historyManager.redo(idToRedo);
      actualSteps++;
      if (targetSnapshot === null) {
        console.warn(
          `[HistoryActions] historyManager.redo 在 ${actualSteps} 步后意外返回 null，标签页 ${idToRedo}。`
        );
        break;
      }
    }

    if (targetSnapshot) {
      const appliedCore = workflowManager.applyStateSnapshot(idToRedo, targetSnapshot);
      if (!appliedCore) {
        console.error(
          `[HistoryActions] 在重做标签页 ${idToRedo} 期间应用核心数据快照失败。正在中止画布更新。`
        );
        return;
      }

      const instance = workflowViewManagement.getVueFlowInstance(idToRedo);
      if (instance) {
        try {
          const nodes = targetSnapshot.elements.filter(
            (el: VueFlowNode | VueFlowEdge): el is VueFlowNode => !("source" in el)
          );
          const edges = targetSnapshot.elements.filter(
            (el: VueFlowNode | VueFlowEdge): el is VueFlowEdge => "source" in el
          );
          const viewport = targetSnapshot.viewport;

          instance.setNodes([]);
          instance.setEdges([]);
          await nextTick();
          instance.setNodes(nodes);
          instance.setEdges(edges);
          instance.setViewport(viewport);

          const stateAfterRedo = workflowManager.getActiveTabState();
          if (stateAfterRedo) {
            stateAfterRedo.elements = klona(targetSnapshot.elements);
            stateAfterRedo.viewport = klona(targetSnapshot.viewport);
          }
        } catch (error) {
          console.error(
            `[HistoryActions] 在重做期间应用快照时出错（直接应用）标签页 ${idToRedo}：`,
            error
          );
        }
      } else {
        console.warn(
          `[HistoryActions] 在重做期间无法获取标签页 ${idToRedo} 的 VueFlow 实例。无法应用快照。`
        );
      }
    } else if (actualSteps === 0) {
      // No steps executed
    } else {
      console.warn(
        `[HistoryActions] 重做完成 ${actualSteps} 步，但结束时没有标签页 ${idToRedo} 的有效目标快照。`
      );
    }
  }

  return {
    undo,
    redo,
  };
}
