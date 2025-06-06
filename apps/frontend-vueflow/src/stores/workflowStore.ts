import { defineStore } from "pinia";
import type { Node as VueFlowNode, Edge as VueFlowEdge } from "@vue-flow/core";
import type { WorkflowStateSnapshot, TabWorkflowState } from "../types/workflowTypes"; // 导入 TabWorkflowState
import type { HistoryEntry } from "@comfytavern/types"; // <-- Import HistoryEntry
import { useTabStore } from "./tabStore";
import { ref, nextTick, watch, computed } from "vue";
import { useWorkflowManager } from "@/composables/workflow/useWorkflowManager"; // <-- 新增，移除了未使用的 TabWorkflowState
import { useWorkflowHistory } from "@/composables/workflow/useWorkflowHistory"; // 导入 history composable，移除了 TItem
import { useWorkflowData } from "@/composables/workflow/useWorkflowData";
import { useWorkflowViewManagement } from "@/composables/workflow/useWorkflowViewManagement";
import { useWorkflowInterfaceManagement } from "@/composables/workflow/useWorkflowInterfaceManagement";
import { useWorkflowGrouping } from "@/composables/group/useWorkflowGrouping"; // <-- 为 createGroupFromSelection 添加
import { useWorkflowLifecycleCoordinator } from "@/composables/workflow/useWorkflowLifecycleCoordinator"; // 导入生命周期协调器
import { useWorkflowInteractionCoordinator } from "@/composables/workflow/useWorkflowInteractionCoordinator"; // 导入交互协调器
import { sendMessage } from "@/composables/useWebSocket"; // 导入共享的 sendMessage
import { WebSocketMessageType } from "@comfytavern/types"; // 导入消息类型
import { klona } from "klona";
import { useDialogService } from '../services/DialogService'; // 导入 DialogService

export const useWorkflowStore = defineStore("workflow", () => {
  // --- 全局状态 ---
  // 更新类型定义以包含可选的 description, creationMethod, referencedWorkflows
  const availableWorkflows = ref<
    Array<{
      id: string;
      name: string;
      description?: string;
      creationMethod?: string; // 添加 creationMethod
      referencedWorkflows?: string[]; // 添加 referencedWorkflows
    }>
  >([]);

  // --- 获取其他 Store ---
  const tabStore = useTabStore();
  const dialogService = useDialogService(); // 获取 DialogService 实例
  // 移除了未使用的：projectStore

  // --- 实例化 Composables ---
  const workflowManager = useWorkflowManager(); // <-- 使用新的管理器
  const workflowData = useWorkflowData();
  const workflowViewManagement = useWorkflowViewManagement();
  const workflowInterfaceManagement = useWorkflowInterfaceManagement();
  // const workflowActions = useWorkflowActions(); // 已移除
  const workflowGrouping = useWorkflowGrouping(); // <-- 实例化分组 composable
  const workflowLifecycleCoordinator = useWorkflowLifecycleCoordinator(); // <-- 实例化生命周期协调器
  const workflowInteractionCoordinator = useWorkflowInteractionCoordinator(); // <-- 实例化交互协调器

  // --- 历史记录管理 ---
  // 获取历史记录管理器实例（包含操作共享历史状态的方法）
  const historyManager = useWorkflowHistory();

  // 已移除：ensureHistoryAndRecord（已移至 useWorkflowLifecycleCoordinator）

  // 监听标签页关闭事件，以清理 composable 中的实际历史数据
  watch(
    () => tabStore.tabs,
    (newTabs, oldTabs) => {
      const closedTabIds = (oldTabs ?? [])
        .filter((oldTab) => !newTabs.some((newTab) => newTab.internalId === oldTab.internalId))
        .map((tab) => tab.internalId);

      closedTabIds.forEach((closedId) => {
        // 调用管理器的 clearHistory 方法，从 composable 的内部映射中移除数据
        historyManager.clearHistory(closedId);
        // 日志消息已移至 composable 内的 clearHistory
      });
    },
    { deep: true } // 深度监听，以防标签页属性更改，尽管这里我们只关心移除
  );

  // --- 协调操作 ---

  // 已移除：loadWorkflow（已移至 useWorkflowLifecycleCoordinator）
  // 已移除：saveWorkflow（已移至 useWorkflowLifecycleCoordinator）

  /**
   * 撤销指定或活动标签页中的操作。
   * @param steps 要撤销的步数（默认为 1）。
   * @param internalId 可选的标签页 ID。默认为活动标签页。
   */
  async function undo(steps: number = 1, internalId?: string) {
    // 添加 steps 参数
    const idToUndo = internalId ?? tabStore.activeTabId;
    if (!idToUndo) {
      console.warn("[WorkflowStore] 无法撤销，没有活动的标签页或未提供 ID。");
      return;
    }
    if (steps <= 0) {
      console.warn(`[WorkflowStore] Cannot undo ${steps} steps.`);
      return;
    }

    // 1. 移动历史记录指针并获取目标快照
    historyManager.ensureHistoryState(idToUndo); // 确保状态存在
    let targetSnapshot: WorkflowStateSnapshot | null = null;
    let actualSteps = 0;
    for (let i = 0; i < steps; i++) {
      // 检查 .value
      if (!historyManager.canUndo(idToUndo).value) {
        // 改进日志，明确是无法撤销
        // console.info(`[WorkflowStore] 标签页 ${idToUndo} 在 ${i} 步后没有更多可撤销的步骤。`); // 到达撤销堆栈末尾
        break;
      }
      targetSnapshot = historyManager.undo(idToUndo); // 移动指针并获取快照
      actualSteps++;
      // 如果 undo 返回 null，表示已到达初始状态标记
      if (targetSnapshot === null) {
        break; // 停止循环
      }
    }

    // 2. 应用最终状态（目标快照或默认状态）
    if (targetSnapshot === null) {
      // 到达初始状态。将标签页重置为默认状态。
      try {
        // --- 在应用默认状态之前获取实例 ---
        const instance = workflowViewManagement.getVueFlowInstance(idToUndo);
        if (!instance) {
          console.warn(
            `[WorkflowStore] 在应用默认状态之前无法获取标签页 ${idToUndo} 的 VueFlow 实例。`
          );
          // 实例获取失败，后续更新画布会失败，但仍然尝试应用核心状态
        }

        // 通过管理器应用默认工作流状态
        const defaultSnapshot = await workflowManager.applyDefaultWorkflowToTab(idToUndo);

        // 等待下一个 tick（对于状态传播可能仍然有用）
        await nextTick();

        // 使用捕获的实例引用显式更新 VueFlow 实例
        if (instance && defaultSnapshot) {
          // 使用之前捕获的实例
          const nodes = defaultSnapshot.elements.filter(
            (el): el is VueFlowNode => !("source" in el)
          );
          const edges = defaultSnapshot.elements.filter((el): el is VueFlowEdge => "source" in el);
          instance.setNodes(nodes);
          instance.setEdges(edges);
          instance.setViewport(defaultSnapshot.viewport);
          // 添加更明确的日志
        } else if (!instance) {
          // 警告已在上面记录
        } else if (!defaultSnapshot) {
          console.warn(
            `[WorkflowStore] 撤销到初始状态后无法获取标签页 ${idToUndo} 的默认快照（post-nextTick）。实例可用。`
          );
        }
      } catch (error) {
        console.error(`[WorkflowStore] 在撤销标签页 ${idToUndo} 期间应用默认工作流时出错：`, error);
      }
      return; // 处理完初始状态重置后退出
    }

    // console.log(`[DEBUG Undo ${idToUndo}] Received targetSnapshot:`, klona(targetSnapshot)); // Log received snapshot
    // 2. 通过管理器应用核心数据状态
    // applyStateSnapshot 现在只处理非元素/视口数据
    const appliedCore = workflowManager.applyStateSnapshot(idToUndo, targetSnapshot); // 使用 targetSnapshot

    if (!appliedCore) {
      console.error(
        `[WorkflowStore] 在撤销标签页 ${idToUndo} 期间应用核心数据快照失败。正在中止画布更新。`
      );
      // 考虑回滚历史记录索引？
      // historyInstance.redo(); // 注意潜在的无限循环或意外状态
      return;
    }

    // 3. 通过清除和替换将快照应用于实例，然后同步管理器状态
    const instance = workflowViewManagement.getVueFlowInstance(idToUndo);
    if (instance) {
      try {
        // 从快照中提取节点、边、视口
        // 为 el 添加类型注释并使用 targetSnapshot
        const nodes = targetSnapshot.elements.filter(
          (el: VueFlowNode | VueFlowEdge): el is VueFlowNode => !("source" in el)
        );
        // Enhanced log to show target node dimensions
        // const targetNodeUndo = nodes.find((n) => n.id === "TestWidgets_1"); // Adjust ID if needed
        // console.log(
        //   `[DEBUG Undo ${idToUndo}] Extracted nodes before setNodes. Target Node (TestWidgets_1):`,
        //   // targetNodeUndo // Removed unused variable
        //     ? `width=${targetNodeUndo.width}, height=${
        //         targetNodeUndo.height
        //       }, style=${JSON.stringify(targetNodeUndo.style)}`
        //     : "Not Found",
        //   "Full nodes:",
        //   klona(nodes)
        // );
        // 为 el 添加类型注释并使用 targetSnapshot
        const edges = targetSnapshot.elements.filter(
          (el: VueFlowNode | VueFlowEdge): el is VueFlowEdge => "source" in el
        );
        const viewport = targetSnapshot.viewport; // 使用 targetSnapshot

        // 直接将快照应用于实例
        // console.log(`[DEBUG Undo ${idToUndo}] BEFORE instance.setNodes([])`);
        instance.setNodes([]);
        instance.setEdges([]);
        // console.log(`[DEBUG Undo ${idToUndo}] AFTER instance.setNodes([]) and BEFORE nextTick`);
        await nextTick();
        // console.log(`[DEBUG Undo ${idToUndo}] AFTER nextTick and BEFORE instance.setNodes(nodes)`);
        instance.setNodes(nodes);
        instance.setEdges(edges);
        // console.log(`[DEBUG Undo ${idToUndo}] AFTER instance.setNodes(nodes)`);
        instance.setViewport(viewport);
        // console.log(`[DEBUG Undo ${idToUndo}] AFTER instance.setEdges(edges)`);

        // console.log(`[DEBUG Undo ${idToUndo}] AFTER instance.setViewport(viewport)`);
        // Temporarily remove updateNodeInternals call to isolate the issue
        // const nodeIds = nodes.map((n) => n.id);
        // if (nodeIds.length > 0) {
        //   await nextTick(); // 等待节点基本渲染
        //   console.log(`[DEBUG Undo ${idToUndo}] BEFORE instance.updateNodeInternals`);
        //   instance.updateNodeInternals(nodeIds);
        //   console.log(`[DEBUG Undo ${idToUndo}] AFTER instance.updateNodeInternals`);
        // }

        const stateAfterUndo = workflowManager.getActiveTabState(); // 获取状态以进行潜在同步

        // 实例更新后显式同步管理器状态（作为保障措施）
        if (stateAfterUndo) {
          stateAfterUndo.elements = klona(targetSnapshot.elements); // 使用 klona 进行深拷贝
          stateAfterUndo.viewport = klona(targetSnapshot.viewport);
          // console.debug(`[WorkflowStore 撤销同步] 已同步标签页 ${idToUndo} 的管理器状态。`);
        }

        // 使用 targetSnapshot 记录最终恢复的状态并添加类型注释
      } catch (error) {
        console.error(
          `[WorkflowStore] 在撤销期间应用快照时出错（直接应用）标签页 ${idToUndo}：`,
          error
        ); // <-- 更新了日志消息
        // 此处状态可能不一致。
      }
    } else {
      console.warn(
        `[WorkflowStore] 在撤销期间无法获取标签页 ${idToUndo} 的 VueFlow 实例。无法应用快照。`
      );
    }
  }

  /**
   * 重做指定或活动标签页中的操作。
   * @param steps 要重做的步数（默认为 1）。
   * @param internalId 可选的标签页 ID。默认为活动标签页。
   */
  async function redo(steps: number = 1, internalId?: string) {
    // 添加 steps 参数
    const idToRedo = internalId ?? tabStore.activeTabId;
    if (!idToRedo) {
      console.warn("[WorkflowStore] 无法重做，没有活动的标签页或未提供 ID。");
      return;
    }
    if (steps <= 0) {
      console.warn(`[WorkflowStore] Cannot redo ${steps} steps.`);
      return;
    }

    // 1. 移动历史记录指针并获取目标快照
    historyManager.ensureHistoryState(idToRedo); // 确保状态存在
    let targetSnapshot: WorkflowStateSnapshot | null = null;
    let actualSteps = 0;
    for (let i = 0; i < steps; i++) {
      // 检查 .value
      if (!historyManager.canRedo(idToRedo).value) {
        // 改进日志，明确是无法重做
        // console.info(`[WorkflowStore] 标签页 ${idToRedo} 在 ${i} 步后没有更多可重做的步骤。`); // 到达重做堆栈末尾
        break;
      }
      targetSnapshot = historyManager.redo(idToRedo); // 移动指针并获取快照
      actualSteps++;
      // Redo 应始终返回快照，除非没有可重做的内容（由 canRedo 检查）
      if (targetSnapshot === null) {
        console.warn(
          `[WorkflowStore] historyManager.redo 在 ${actualSteps} 步后意外返回 null，标签页 ${idToRedo}。`
        ); // 改为 warn
        break; // 在遇到意外的 null 时停止循环
      }
    }

    // 2. 应用最终状态（仅当获取到有效快照时）
    if (targetSnapshot) {
      // console.log(`[DEBUG Redo ${idToRedo}] Received targetSnapshot:`, klona(targetSnapshot)); // Log received snapshot
      // console.debug(`[WorkflowStore 重做 ${idToRedo}] 正在应用快照：`, klona(targetSnapshot)); // 使用 klona 避免日志干扰
      // 2a. 通过管理器应用核心数据状态
      const appliedCore = workflowManager.applyStateSnapshot(idToRedo, targetSnapshot);

      if (!appliedCore) {
        console.error(
          `[WorkflowStore] 在重做标签页 ${idToRedo} 期间应用核心数据快照失败。正在中止画布更新。`
        );
        // 考虑回滚历史记录索引？这可能很复杂。
        // 目前，记录错误并可能保持历史记录索引不变。
        return;
      }

      // 2b. 通过清除和替换将快照应用于实例
      const instance = workflowViewManagement.getVueFlowInstance(idToRedo);
      if (instance) {
        try {
          // 从最终目标快照中提取节点、边、视口
          const nodes = targetSnapshot.elements.filter(
            (el): el is VueFlowNode => !("source" in el)
          );
          // Enhanced log to show target node dimensions
          // const targetNodeRedo = nodes.find((n) => n.id === "TestWidgets_1"); // Adjust ID if needed
          // console.log(
          //   `[DEBUG Redo ${idToRedo}] Extracted nodes before setNodes. Target Node (TestWidgets_1):`,
          //   // targetNodeRedo // Removed unused variable
          //     ? `width=${targetNodeRedo.width}, height=${
          //         targetNodeRedo.height
          //       }, style=${JSON.stringify(targetNodeRedo.style)}`
          //     : "Not Found",
          //   "Full nodes:",
          //   klona(nodes)
          // );
          const edges = targetSnapshot.elements.filter((el): el is VueFlowEdge => "source" in el);
          const viewport = targetSnapshot.viewport;

          // 直接将快照应用于实例
          // console.log(`[DEBUG Redo ${idToRedo}] BEFORE instance.setNodes([])`);
          // console.debug(`[WorkflowStore 重做 ${idToRedo}] 设置实例状态之前（简化）。`);
          // Unify redo logic with undo logic (clear -> nextTick -> set -> nextTick -> updateInternals)
          instance.setNodes([]);
          instance.setEdges([]);
          // console.log(`[DEBUG Redo ${idToRedo}] AFTER instance.setNodes([]) and BEFORE nextTick`);
          await nextTick();
          // console.log(
          //   `[DEBUG Redo ${idToRedo}] AFTER nextTick and BEFORE instance.setNodes(nodes)`
          // );
          instance.setNodes(nodes);
          instance.setEdges(edges);
          // console.log(`[DEBUG Redo ${idToRedo}] AFTER instance.setNodes(nodes)`);
          instance.setViewport(viewport);
          // console.log(`[DEBUG Redo ${idToRedo}] AFTER instance.setEdges(edges)`);
          // console.log(`[DEBUG Redo ${idToRedo}] AFTER instance.setViewport(viewport)`);

          // Temporarily remove updateNodeInternals call to isolate the issue
          // const nodeIds = nodes.map((n) => n.id);
          // if (nodeIds.length > 0) {
          //   await nextTick(); // 等待节点基本渲染
          //   console.log(`[DEBUG Redo ${idToRedo}] BEFORE instance.updateNodeInternals`);
          //   instance.updateNodeInternals(nodeIds);
          //   console.log(`[DEBUG Redo ${idToRedo}] AFTER instance.updateNodeInternals`);
          // }

          // 实例更新后显式同步管理器状态（作为保障措施）
          const stateAfterRedo = workflowManager.getActiveTabState();
          if (stateAfterRedo) {
            stateAfterRedo.elements = klona(targetSnapshot.elements); // 使用 klona 进行深拷贝
            stateAfterRedo.viewport = klona(targetSnapshot.viewport);
            // console.debug(`[WorkflowStore 重做同步] 已同步标签页 ${idToRedo} 的管理器状态。`);
          }

          // 记录最终恢复的状态并添加类型注释
        } catch (error) {
          console.error(
            `[WorkflowStore] 在重做期间应用快照时出错（直接应用）标签页 ${idToRedo}：`,
            error
          );
          // 此处状态可能不一致。
        }
      } else {
        console.warn(
          `[WorkflowStore] 在重做期间无法获取标签页 ${idToRedo} 的 VueFlow 实例。无法应用快照。`
        );
      }
    } else if (actualSteps === 0) {
      // 如果没有实际执行步骤，则不执行任何操作（例如，没有可重做的内容）
    } else {
      // 如果 canRedo 工作正常且 redo 不返回意外的 null，则理想情况下不应发生此情况
      console.warn(
        `[WorkflowStore] 重做完成 ${actualSteps} 步，但结束时没有标签页 ${idToRedo} 的有效目标快照。`
      ); // 改为 warn
    }
  }

  // 已移除：fetchAvailableWorkflows（已移至 useWorkflowLifecycleCoordinator，store 会调用它）
  // 已移除：deleteWorkflow（已移至 useWorkflowLifecycleCoordinator）

  // --- 覆盖管理器方法以记录历史 ---
  // 我们需要包装直接暴露或通过其他 composable 暴露的修改状态的方法

  // 已移除：createNewWorkflowAndRecord（已移至 useWorkflowLifecycleCoordinator）

  // 已移除：setElementsAndRecord 包装器。历史记录将由调用者显式记录。

  // 已移除 createGroupFromSelectionAndRecord 包装器，因为它缺少 selectedNodeIds 上下文。
  // 分组的历史记录需要在 useWorkflowGrouping 内部或通过不同的模式处理。

  // TODO：如果需要，包装从管理器/其他 composable 暴露的其他状态修改操作，例如：
  // - updateNodeData（如果直接暴露/使用）
  // - addNodes/removeNodes（如果管理器提供它们）
  // 当前方法侧重于 workflowStore *内部* 协调的操作。

  // --- 新增：处理节点按钮点击并发送 WS 消息的操作 ---
  function handleNodeButtonClick(internalId: string, nodeId: string, inputKey: string) {
    // console.debug(
    //   `[WorkflowStore] 处理节点 ${nodeId} 的按钮点击，输入 ${inputKey}，标签页 ${internalId}`
    // );
    sendMessage({
      type: WebSocketMessageType.BUTTON_CLICK,
      payload: {
        nodeId: nodeId,
        inputKey: inputKey,
        internalId: internalId,
      },
    });
  }

  // --- 新增：根据 ID 获取边的方法 ---
  function getEdgeById(internalId: string, edgeId: string): VueFlowEdge | undefined {
    const elements = workflowManager.getElements(internalId);
    return elements.find(el => el.id === edgeId && "source" in el) as VueFlowEdge | undefined;
  }

  // --- 新增：更新多输入连接顺序和边句柄并记录历史 ---
  async function updateMultiInputConnectionsAndRecord(
    internalId: string,
    nodeId: string,
    inputKey: string,
    // oldOrderedEdgeIds: string[], // oldOrderedEdgeIds 包含在 entry.details 中
    newOrderedEdgeIds: string[],
    edgeTargetHandleChanges: Array<{ edgeId: string; oldTargetHandle?: string | null; newTargetHandle?: string | null }>,
    entry: HistoryEntry
  ): Promise<void> {
    const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(
        `[WorkflowStore:updateMultiInputConnectionsAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot);

    // 1. 更新节点上的 inputConnectionOrders
    const nodeToUpdate = nextSnapshot.elements.find(
      (el) => el.id === nodeId && !("source" in el)
    ) as VueFlowNode | undefined;

    if (!nodeToUpdate) {
      console.error(
        `[WorkflowStore:updateMultiInputConnectionsAndRecord] 在 nextSnapshot 中未找到节点 ${nodeId}。`
      );
      return;
    }
    nodeToUpdate.data = nodeToUpdate.data || {};
    nodeToUpdate.data.inputConnectionOrders = nodeToUpdate.data.inputConnectionOrders || {};
    nodeToUpdate.data.inputConnectionOrders[inputKey] = newOrderedEdgeIds;

    // 2. 更新受影响边的 targetHandle
    for (const change of edgeTargetHandleChanges) {
      const edgeToUpdate = nextSnapshot.elements.find(
        (el) => el.id === change.edgeId && "source" in el
      ) as VueFlowEdge | undefined;
      if (edgeToUpdate) {
        if (change.newTargetHandle !== undefined) {
          edgeToUpdate.targetHandle = change.newTargetHandle;
        } else {
          // 如果 newTargetHandle 是 undefined，则可能表示移除该句柄
          // Vue Flow 通常希望 targetHandle 是字符串或 null。
          // 如果确实要移除，根据 Vue Flow 的行为，可能设置为 null 或从对象中删除该属性。
          // 此处假设为 undefined 意味着保持不变或由 Vue Flow 默认处理，
          // 但更安全的做法是明确设置为 null 如果是有效状态，或者确保调用者提供正确的句柄。
          // 鉴于我们的场景是更新 __index，它应该总是一个字符串。
          // 如果一个边从多输入移到单输入，targetHandle 应该变为该单输入的 ID (不含 __index)。
          // 如果 newTargetHandle 就是 undefined，这里保持原样或根据具体逻辑处理。
          // 对于我们的用例，newTargetHandle 应该总是有值的。
        }
      } else {
        console.warn(
          `[WorkflowStore:updateMultiInputConnectionsAndRecord] 在 nextSnapshot 中未找到要更新 targetHandle 的边 ${change.edgeId}。`
        );
      }
    }

    // 3. 应用状态更新
    await workflowManager.setElements(internalId, nextSnapshot.elements);

    // 4. 记录历史
    // entry 应该由 useMultiInputConnectionActions 准备好，包含所有必要的 details
    historyManager.recordSnapshot(internalId, entry, nextSnapshot);
    // console.debug(`[WorkflowStore:updateMultiInputConnectionsAndRecord] 已为节点 ${nodeId} 输入 ${inputKey} 更新连接并记录历史。`);
  }

  // --- 新增：应用元素更改并记录历史的通用 Action ---
  async function applyElementChangesAndRecordHistory(
    internalId: string,
    newElements: (VueFlowNode | VueFlowEdge)[],
    entry: HistoryEntry
  ): Promise<void> {
    // 1. 应用元素更改
    // 注意：setElements 内部会进行深拷贝，所以 newElements 可以直接传递
    await workflowManager.setElements(internalId, newElements);

    // 2. 获取应用更改后的当前快照以进行记录
    // （或者，如果 setElements 返回了最终状态，则可以使用它）
    // 为确保一致性，我们从管理器获取最新的完整快照
    const snapshotToRecord = workflowManager.getCurrentSnapshot(internalId);

    if (!snapshotToRecord) {
      console.error(
        `[WorkflowStore:applyElementChangesAndRecordHistory] 应用元素更改后无法获取标签页 ${internalId} 的快照。历史记录可能不准确。`
      );
      // 即使快照获取失败，更改也已应用。是否应该尝试回滚？目前，只记录错误。
      // 仍然尝试使用一个基于 newElements 的最小快照进行记录，但这可能不完整。
      // 为简单起见，如果无法获取完整快照，则不记录历史。
      return;
    }
    
    // 3. 记录历史
    // entry 应该由调用者准备好
    historyManager.recordSnapshot(internalId, entry, snapshotToRecord);
    // console.debug(`[WorkflowStore:applyElementChangesAndRecordHistory] 已应用元素更改并为标签页 ${internalId} 记录历史: "${entry.summary}"`);
  }


  // --- 新增：活动历史记录索引的 Getter ---
  const activeHistoryIndex = computed(() => {
    const activeId = tabStore.activeTabId;
    if (!activeId) return -1; // 如果没有活动标签页，则返回默认值
    // 直接使用管理器的 getter
    return historyManager.getCurrentIndex(activeId).value;
  });

  // --- 新增：手动记录历史快照的函数 ---
  /**
   * 为当前活动标签页记录历史快照。
   * 对于由 Vue Flow 直接处理的事件（如连接、元素移除）很有用，
   * 这些事件的状态更改发生在我们的处理程序之前。
   * @param entry 历史记录条目对象。
   */
  function recordHistorySnapshot(entry: HistoryEntry, snapshotPayload?: WorkflowStateSnapshot) {
    // <-- Change label to entry
    const activeId = tabStore.activeTabId;
    if (!activeId) {
      console.warn("[WorkflowStore] 无法记录历史快照：没有活动的标签页。");
      return;
    }

    // 确定要使用的快照
    let snapshotToRecord: WorkflowStateSnapshot | null = null;
    if (snapshotPayload) {
      // console.debug(`[WorkflowStore] 使用标签页 ${activeId} 的提供快照负载： "${entry.summary}"`); // <-- Use entry.summary
      snapshotToRecord = snapshotPayload; // 直接使用提供的负载
    } else {
      // console.debug(
      //   `[WorkflowStore] 从管理器获取标签页 ${activeId} 的当前快照： "${entry.summary}"`
      // ); // <-- Use entry.summary
      // 处理 getCurrentSnapshot 可能返回的 undefined
      snapshotToRecord = workflowManager.getCurrentSnapshot(activeId) ?? null;
    }

    // 使用 snapshotToRecord 继续记录
    if (snapshotToRecord) {
      // 重要提示：在传递给 historyManager *之前* 克隆快照，
      // 无论它是提供的还是获取的，以确保隔离性。
      historyManager.recordSnapshot(activeId, entry, klona(snapshotToRecord)); // <-- Pass entry object
    } else {
      console.warn(
        `[WorkflowStore] 无法获取或使用标签页 ${activeId} 的快照进行记录： "${entry.summary}"`
      ); // <-- Use entry.summary
    }
  }

  // 辅助函数，用于格式化日期时间
  function formatDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  }

  /**
   * 提示用户输入工作流名称并保存（用于新文件保存或另存为）。
   * @param isSaveAs - 如果为 true，则表示“另存为”操作。
   * @returns Promise<boolean> - 保存是否成功。
   */
  async function promptAndSaveWorkflow(isSaveAs: boolean = false): Promise<boolean> {
    const activeId = tabStore.activeTabId;
    if (!activeId) {
      console.error("[WorkflowStore] 无法提示保存：没有活动的标签页。");
      dialogService.showError("无法保存：请先打开一个标签页。");
      return false;
    }

    const currentData = workflowManager.getWorkflowData(activeId);
    const currentName = currentData?.name;

    let defaultName: string;

    if (isSaveAs) {
      // 另存为：使用 "当前名称 副本" 或 "工作流 副本"
      defaultName = `${currentName || "工作流"} 副本`;
    } else {
      // 新保存：总是生成带 YYYY-MM-DD_HH-mm-ss 时间戳的名称
      const timestamp = formatDateTime(new Date());
      defaultName = `新工作流 ${timestamp}`;
    }

    const promptMessage = isSaveAs ? "输入新的工作流名称:" : "输入工作流名称:";
    // console.debug(`[WorkflowStore promptAndSaveWorkflow] 即将为标签页 ${activeId} 显示提示框，默认名称: "${defaultName}"`); // 添加日志
    const newName = prompt(promptMessage, defaultName);
    // console.debug(`[WorkflowStore promptAndSaveWorkflow] prompt 返回:`, newName); // 添加日志

    if (newName && newName.trim()) {
      const finalName = newName.trim(); // 保存清理后的名称
      // console.debug(`[WorkflowStore promptAndSaveWorkflow] 用户提供了有效名称: "${finalName}"，正在调用 saveWorkflow...`); // 添加日志
      try {
        // 调用生命周期协调器的保存函数，传递新名称
        // 注意：saveWorkflow 内部会处理 activeTabId
        const success = await workflowLifecycleCoordinator.saveWorkflow(finalName);
        if (!success) {
          // 错误/冲突消息应该由 saveWorkflow 内部处理并 alert，这里只记录日志
          console.warn(`[WorkflowStore promptAndSaveWorkflow] 保存工作流 "${finalName}" 失败 (saveWorkflow 返回 false)。`);
        } else {
          console.info(`[WorkflowStore promptAndSaveWorkflow] 保存工作流 "${finalName}" 成功。`);
        }
        return success;
      } catch (error) {
        console.error(`[WorkflowStore promptAndSaveWorkflow] 调用 saveWorkflow 时捕获到错误:`, error);
        // alert 已在 useWorkflowData 的 saveWorkflow 中处理，这里不再重复 alert
        // alert(`保存工作流失败: ${error instanceof Error ? error.message : "未知错误"}`);
        return false;
      }
    } else {
      console.log(`[WorkflowStore promptAndSaveWorkflow] 用户取消保存或名称为空 (prompt 返回: ${newName})。`); // 改进日志
      return false; // 表示取消或无效输入
    }
  }

  // --- 新增：获取特定标签页状态的方法 ---
  function getTabState(internalId: string): TabWorkflowState | undefined {
    return workflowManager.getAllTabStates.value.get(internalId);
  }

  // --- 导出统一 API ---
  return {
    // --- 全局状态 ---
    availableWorkflows, // 直接导出 ref

    // --- 状态和 Getter（来自 useWorkflowManager）---
    getActiveTabState: workflowManager.getActiveTabState,
    getWorkflowData: workflowManager.getWorkflowData,
    isWorkflowDirty: workflowManager.isWorkflowDirty,
    getElements: workflowManager.getElements, // 返回深拷贝
    isTabLoaded: workflowManager.isTabLoaded,
    getAllTabStates: workflowManager.getAllTabStates, // 计算属性 ref
    getTabState, // <-- 导出新方法
    // getHistoryState: workflowManager.getHistoryState, // 已移除 - 如果需要，直接使用 history 实例

    // --- 状态管理（来自 useWorkflowManager 和包装器）---
    setElements: workflowManager.setElements, // 直接使用管理器的方法。历史记录由调用者记录。
    markAsDirty: workflowManager.markAsDirty, // 使用管理器的方法（不改变状态结构）
    removeWorkflowData: workflowManager.removeWorkflowData, // 使用管理器的方法
    clearWorkflowStatesForProject: workflowManager.clearWorkflowStatesForProject, // 使用管理器的方法
    ensureTabState: workflowManager.ensureTabState, // 使用管理器的方法

    // --- 数据管理（来自 useWorkflowData）---
    saveWorkflowAsNew: workflowData.saveWorkflowAsNew,
    extractGroupInterface: workflowData.extractGroupInterface,

    // --- 历史记录管理（新增 - 协调操作）---
    undo, // 使用 useWorkflowHistory 的新实现
    redo, // 使用 useWorkflowHistory 的新实现
    // histories, // 已移除 - 外部不再需要
    // 直接暴露历史记录管理器的计算属性
    canUndo: (id: string) => historyManager.canUndo(id),
    canRedo: (id: string) => historyManager.canRedo(id),
    hasUnsavedChanges: (id: string) => historyManager.hasUnsavedChanges(id),

    activeHistoryIndex, // 暴露活动历史记录索引

    // --- 视图管理（来自 useWorkflowViewManagement）---
    setVueFlowInstance: workflowViewManagement.setVueFlowInstance, // 现在是异步的
    getVueFlowInstance: workflowViewManagement.getVueFlowInstance,
    setViewport: workflowViewManagement.setViewport, // 现在是异步的
    updateEdgeStylesForTab: workflowViewManagement.updateEdgeStylesForTab,

    // --- 接口管理（来自 useWorkflowInterfaceManagement）---
    // 包装这些以确保正确记录历史
    updateWorkflowInterface: workflowInteractionCoordinator.updateWorkflowInterfaceAndRecord, // 使用协调器的函数
    removeEdgesForHandle: workflowInterfaceManagement.removeEdgesForHandle, // <-- 导出 removeEdgesForHandle

    // --- 用户操作（现在来自管理器/分组和包装器）---
    // createNewWorkflow: createNewWorkflowAndRecord, // 已包装以记录历史 // 已移至协调器
    // 指回原始分组函数。历史记录需要在其他地方集成。
    createGroupFromSelection: workflowGrouping.groupSelectedNodes,

    // --- 协调操作（现在来自生命周期协调器）---
    loadWorkflow: workflowLifecycleCoordinator.loadWorkflow,
    saveWorkflow: workflowLifecycleCoordinator.saveWorkflow,
    // fetchAvailableWorkflows 现在在需要时内部调用，但如果需要直接调用，则通过协调器暴露
    fetchAvailableWorkflows: async () => {
      // 更新本地状态的包装器
      const fetched = await workflowLifecycleCoordinator.fetchAvailableWorkflows();
      if (fetched) {
        availableWorkflows.value = fetched;
      } else {
        availableWorkflows.value = []; // 失败时清除
      }
      return fetched; // 返回结果
    },
    deleteWorkflow: async (workflowId: string) => {
      // 删除后刷新列表的包装器
      const success = await workflowLifecycleCoordinator.deleteWorkflow(workflowId);
      if (success) {
        // 成功删除后刷新 store 中的列表
        const refreshedList = await workflowLifecycleCoordinator.fetchAvailableWorkflows();
        if (refreshedList) {
          availableWorkflows.value = refreshedList;
        } else {
          availableWorkflows.value = [];
        }
      }
      return success;
    },
    createNewWorkflow: workflowLifecycleCoordinator.createNewWorkflowAndRecord, // 使用协调器的函数
    handleConnectionWithInterfaceUpdate:
      workflowInteractionCoordinator.handleConnectionWithInterfaceUpdate, // 使用协调器的函数
    handleNodeButtonClick, // 导出新操作
    recordHistorySnapshot, // 导出手动历史记录函数
    promptAndSaveWorkflow, // 导出用于提示名称的新操作
    getEdgeById, // <-- 导出新方法
    updateMultiInputConnectionsAndRecord, // <-- 导出新 action
    applyElementChangesAndRecordHistory, // <-- 导出新 action
    updateNodePositionAndRecord: workflowInteractionCoordinator.updateNodePositionAndRecord, // 使用协调器的函数
    addNodeAndRecord: workflowInteractionCoordinator.addNodeAndRecord, // 使用协调器的函数
    addEdgeAndRecord: workflowInteractionCoordinator.addEdgeAndRecord, // 导出用于添加边的新操作
    removeElementsAndRecord: workflowInteractionCoordinator.removeElementsAndRecord, // 导出用于移除元素的新操作
    updateNodeInputValueAndRecord: workflowInteractionCoordinator.updateNodeInputValueAndRecord, // 导出节点输入更新协调器
    updateNodeConfigValueAndRecord: workflowInteractionCoordinator.updateNodeConfigValueAndRecord, // 导出节点配置更新协调器
    removeEdgesByHandleAndRecord: workflowInteractionCoordinator.removeEdgesByHandleAndRecord, // <-- 导出用于按句柄删除边的新操作
    updateWorkflowNameAndRecord: workflowInteractionCoordinator.updateWorkflowNameAndRecord, // <-- 导出名称更新协调器
    updateWorkflowDescriptionAndRecord:
      workflowInteractionCoordinator.updateWorkflowDescriptionAndRecord, // <-- 导出描述更新协调器
    updateNodeInputConnectionOrderAndRecord:
      workflowInteractionCoordinator.updateNodeInputConnectionOrderAndRecord, // <-- 导出连接顺序更新协调器
    disconnectEdgeFromInputAndRecord:
      workflowInteractionCoordinator.disconnectEdgeFromInputAndRecord, // 新增
    connectEdgeToInputAndRecord:
      workflowInteractionCoordinator.connectEdgeToInputAndRecord, // 新增
    moveAndReconnectEdgeAndRecord:
      workflowInteractionCoordinator.moveAndReconnectEdgeAndRecord, // 新增
  
    // --- 内部辅助函数（为特定用例导出，如 EditorView 事件处理程序）---
    // ensureHistoryAndRecord, // 已移除：现在是协调器的内部函数
  };
});
