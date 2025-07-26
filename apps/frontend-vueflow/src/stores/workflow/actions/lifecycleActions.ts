// apps/frontend-vueflow/src/stores/workflow/actions/lifecycleActions.ts
import { DataFlowType, type GroupSlotInfo, type HistoryEntry } from "@comfytavern/types";
import type { WorkflowStoreContext } from "../types";
import { klona } from "klona";
import type { Edge as VueFlowEdge, Node as VueFlowNode } from "@vue-flow/core";

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
 * 创建与工作流生命周期相关的操作函数。
 * 包括保存、加载、更新元数据（如名称、描述）等。
 * @param context - 提供对 store 核心部分的访问。
 * @returns 一个包含生命周期管理相关操作函数的对象。
 */
export function createLifecycleActions(context: WorkflowStoreContext) {
  const {
    tabStore,
    dialogService,
    workflowManager,
    workflowLifecycleCoordinator,
    recordHistory,
    workflowInterfaceManagement,
  } = context;

  /**
   * 更新工作流的接口定义并记录历史。
   * 这是对 useWorkflowInterfaceManagement 中 updateWorkflowInterface 的封装，增加了历史记录功能。
   * @param internalId 标签页的内部 ID。
   * @param updateFn 一个函数，接收当前的输入和输出，并返回更新后的对象。
   * @param entry 描述此操作的历史记录条目。
   */
  async function updateWorkflowInterfaceAndRecord(
    internalId: string,
    updateFn: (
      currentInputs: Record<string, GroupSlotInfo>,
      currentOutputs: Record<string, GroupSlotInfo>
    ) => {
      inputs: Record<string, GroupSlotInfo>;
      outputs: Record<string, GroupSlotInfo>;
    },
    entry: HistoryEntry
  ) {
    // 记录更新前的接口键
    const stateBefore = workflowManager.getAllTabStates.value.get(internalId);
    const oldInputKeys = new Set(Object.keys(stateBefore?.workflowData?.interfaceInputs || {}));
    const oldOutputKeys = new Set(Object.keys(stateBefore?.workflowData?.interfaceOutputs || {}));

    // 调用接口管理模块更新接口
    await workflowInterfaceManagement.updateWorkflowInterface(internalId, updateFn);

    // 获取更新后的状态
    const stateAfter = workflowManager.getAllTabStates.value.get(internalId);
    if (!stateAfter) {
      console.error(
        `[lifecycleActions] 更新接口后无法获取标签页 ${internalId} 的状态。无法过滤边。`
      );
      // 尝试记录历史，但可能不包含边的更改
      if (stateBefore) {
        recordHistory(internalId, entry, stateBefore); // Fallback to stateBefore
      }
      return;
    }

    // 确定被删除的接口键
    const newInputKeys = new Set(Object.keys(stateAfter.workflowData?.interfaceInputs || {}));
    const newOutputKeys = new Set(Object.keys(stateAfter.workflowData?.interfaceOutputs || {}));
    const deletedInputKeys = new Set([...oldInputKeys].filter((k) => !newInputKeys.has(k)));
    const deletedOutputKeys = new Set([...oldOutputKeys].filter((k) => !newOutputKeys.has(k)));

    // 如果有接口被删除，则过滤掉连接到这些接口的边
    let edgesRemovedCount = 0;
    let filteredElements = stateAfter.elements || [];
    const removedEdges: VueFlowEdge[] = []; // 存储被移除的边信息以供历史记录
    const nodesMap = new Map(
      filteredElements
        .filter((el): el is VueFlowNode => !("source" in el))
        .map((node) => [node.id, node])
    );

    if (deletedInputKeys.size > 0 || deletedOutputKeys.size > 0) {
      filteredElements = filteredElements.filter((el) => {
        if (!("source" in el)) return true; // 保留节点
        const edge = el as VueFlowEdge;
        const sourceNode = nodesMap.get(edge.source);
        const targetNode = nodesMap.get(edge.target);
        let shouldRemove = false;
        // 检查边是否连接到已删除的 GroupInput 或 GroupOutput 句柄
        if (sourceNode?.type === "core:GroupInput" && deletedInputKeys.has(edge.sourceHandle ?? ""))
          shouldRemove = true;
        if (
          targetNode?.type === "core:GroupOutput" &&
          deletedOutputKeys.has(edge.targetHandle ?? "")
        )
          shouldRemove = true;

        if (shouldRemove) {
          removedEdges.push(klona(edge)); // 记录被移除的边
          edgesRemovedCount++;
          return false; // 过滤掉这条边
        }
        return true; // 保留这条边
      });

      // 如果有边被移除，则更新元素状态
      if (edgesRemovedCount > 0) {
        workflowManager.setElements(internalId, filteredElements);
      }
    }

    // 将移除的边信息添加到历史记录条目的 details 中
    if (removedEdges.length > 0) {
      const removedEdgeDetails = removedEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourceHandle,
        target: edge.target,
        targetHandle: edge.targetHandle,
      }));
      entry.details = { ...(entry.details || {}), removedEdges: removedEdgeDetails };
    }

    // 获取最终状态作为 nextSnapshot (应用了接口更新和边过滤后的状态)
    const finalSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!finalSnapshot) {
      console.error(
        `[lifecycleActions] 接口更新后无法获取标签页 ${internalId} 的最终状态。无法准确记录历史。`
      );
      // 尝试使用 stateAfter 作为回退，但不保证完全准确
      recordHistory(internalId, entry, stateAfter);
      return;
    }

    // 记录最终的历史快照
    recordHistory(internalId, entry, finalSnapshot);
  }

  /**
   * 更新工作流的名称，记录历史，并更新标签页标题。
   * @param internalId - 标签页的内部 ID。
   * @param newName - 新的工作流名称。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function updateWorkflowNameAndRecord(
    internalId: string,
    newName: string,
    entry: HistoryEntry
  ) {
    const { workflowManager, tabStore, recordHistory } = context;
    if (newName === undefined) {
      console.warn("[lifecycleActions:updateWorkflowNameAndRecord] 无效参数。");
      return;
    }
    const snapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!snapshot || !snapshot.workflowData) {
      console.error(
        `[lifecycleActions:updateWorkflowNameAndRecord] 无法获取标签页 ${internalId} 的当前快照或 workflowData。`
      );
      return;
    }

    if (snapshot.workflowData.name === newName) {
      console.debug(
        `[lifecycleActions:updateWorkflowNameAndRecord] 标签页 ${internalId} 的名称未改变。跳过。`
      );
      return;
    }

    const nextSnapshot = klona(snapshot);
    nextSnapshot.workflowData!.name = newName;

    const applied = workflowManager.applyStateSnapshot(internalId, nextSnapshot);

    if (applied) {
      recordHistory(internalId, entry, nextSnapshot);
      workflowManager.markAsDirty(internalId);
      tabStore.updateTab(internalId, { label: newName });
    } else {
      console.error(
        `[lifecycleActions:updateWorkflowNameAndRecord] 应用快照失败 for tab ${internalId}.`
      );
    }
  }

  /**
   * 更新工作流的描述并记录历史。
   * @param internalId - 标签页的内部 ID。
   * @param newDescription - 新的工作流描述。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function updateWorkflowDescriptionAndRecord(
    internalId: string,
    newDescription: string,
    entry: HistoryEntry
  ) {
    const { workflowManager, recordHistory } = context;
    if (newDescription === undefined) {
      console.warn("[lifecycleActions:updateWorkflowDescriptionAndRecord] 无效参数。");
      return;
    }
    const snapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!snapshot || !snapshot.workflowData) {
      console.error(
        `[lifecycleActions:updateWorkflowDescriptionAndRecord] 无法获取标签页 ${internalId} 的当前快照或 workflowData。`
      );
      return;
    }

    const currentDescription = snapshot.workflowData.description || "";
    if (currentDescription === newDescription) {
      console.debug(
        `[lifecycleActions:updateWorkflowDescriptionAndRecord] 标签页 ${internalId} 的描述未改变。跳过。`
      );
      return;
    }

    const nextSnapshot = klona(snapshot);
    nextSnapshot.workflowData!.description = newDescription;

    const applied = workflowManager.applyStateSnapshot(internalId, nextSnapshot);

    if (applied) {
      recordHistory(internalId, entry, nextSnapshot);
      workflowManager.markAsDirty(internalId);
    } else {
      console.error(
        `[lifecycleActions:updateWorkflowDescriptionAndRecord] 应用快照失败 for tab ${internalId}.`
      );
    }
  }

  /**
   * 提示用户输入名称并保存当前活动的工作流。
   * @param isSaveAs - 如果为 `true`，则为“另存为”模式，会提供一个默认的副本名称。默认为 `false`。
   * @returns `Promise<boolean>`，表示保存操作是否成功启动。
   */
  async function promptAndSaveWorkflow(isSaveAs: boolean = false): Promise<boolean> {
    const activeId = tabStore.activeTabId;
    if (!activeId) {
      console.error("[LifecycleActions] 无法提示保存：没有活动的标签页。");
      dialogService.showError("无法保存：请先打开一个标签页。");
      return false;
    }

    const currentData = workflowManager.getWorkflowData(activeId);
    const currentName = currentData?.name;
    let defaultName: string;

    if (isSaveAs) {
      defaultName = `${currentName || "工作流"} 副本`;
    } else {
      const timestamp = formatDateTime(new Date());
      defaultName = `新工作流 ${timestamp}`;
    }

    const title = isSaveAs ? "另存为工作流" : "保存工作流";
    const message = isSaveAs ? "请输入新的工作流名称:" : "请输入工作流名称:";

    const newName = await dialogService.showInput({
      title: title,
      message: message,
      initialValue: defaultName,
      inputPlaceholder: "工作流名称",
      confirmText: "确定",
      cancelText: "取消",
    });

    if (newName !== null && newName.trim()) {
      // dialogService.showInput 在取消时返回 null
      const finalName = newName.trim();
      try {
        const success = await workflowLifecycleCoordinator.saveWorkflow(finalName);
        if (!success) {
          console.warn(
            `[LifecycleActions] 保存工作流 "${finalName}" 失败 (saveWorkflow 返回 false)。`
          );
        } else {
          console.info(`[LifecycleActions] 保存工作流 "${finalName}" 成功。`);
        }
        return success;
      } catch (error) {
        console.error(`[LifecycleActions] 调用 saveWorkflow 时捕获到错误:`, error);
        return false;
      }
    } else {
      console.log(`[LifecycleActions] 用户取消保存或名称为空 (prompt 返回: ${newName})。`);
      return false;
    }
  }

  // 未来其他的 lifecycle actions 也可以加在这里, 比如 fetch, delete...
  /**
   * 设置或清除工作流的预览目标，并记录历史。
   * @param internalId - 标签页的内部 ID。
   * @param target - 预览目标对象 { nodeId: string, slotKey: string } 或 null 来清除。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function setPreviewTargetAndRecord(
    internalId: string,
    target: { nodeId: string; slotKey: string } | null,
    entry: HistoryEntry
  ) {
    const { workflowManager, getSlotDefinition, recordHistory } = context;
    // 如果正在尝试设置目标 (而不是清除)
    if (target) {
      const currentWorkflowState = workflowManager.getCurrentSnapshot(internalId);
      if (currentWorkflowState?.elements) {
        const targetNode = currentWorkflowState.elements.find(
          (el: VueFlowNode | VueFlowEdge) => el.id === target.nodeId && !("source" in el)
        ) as VueFlowNode | undefined;
        if (targetNode) {
          let slotType: string | undefined;
          const slotDef = getSlotDefinition(
            targetNode,
            target.slotKey,
            "source",
            currentWorkflowState.workflowData
          );
          slotType = slotDef?.dataFlowType;

          if (slotType === DataFlowType.WILDCARD || slotType === DataFlowType.CONVERTIBLE_ANY) {
            console.warn(
              `[lifecycleActions:setPreviewTargetAndRecord] 尝试将类型为 ${slotType} 的插槽 ${target.nodeId}::${target.slotKey} 设置为预览目标，已阻止。`
            );
            return; // 阻止设置
          }
        } else {
          console.warn(
            `[lifecycleActions:setPreviewTargetAndRecord] 尝试设置预览目标时未找到节点 ${target.nodeId}。`
          );
        }
      }
    }

    const snapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!snapshot || !snapshot.workflowData) {
      console.error(
        `[lifecycleActions:setPreviewTargetAndRecord] 无法获取标签页 ${internalId} 的当前快照或 workflowData。`
      );
      return;
    }

    // 检查预览目标是否真的发生了变化
    const oldTargetJson = JSON.stringify(snapshot.workflowData.previewTarget ?? null);
    const newTargetJson = JSON.stringify(target ?? null);

    if (oldTargetJson === newTargetJson) {
      console.debug(
        `[lifecycleActions:setPreviewTargetAndRecord] 标签页 ${internalId} 的预览目标未改变。跳过。`
      );
      return;
    }

    // 准备下一个状态快照
    const nextSnapshot = klona(snapshot);
    if (nextSnapshot.workflowData) {
      // Type guard
      nextSnapshot.workflowData.previewTarget = target ? klona(target) : null;
    }

    // 应用状态更新 (通过 workflowManager)
    // workflowManager.setPreviewTarget 内部会处理脏状态标记
    await workflowManager.setPreviewTarget(internalId, target);

    // 记录历史
    recordHistory(internalId, entry, nextSnapshot);

    console.debug(
      `[lifecycleActions] 已为标签页 ${internalId} 设置预览目标并记录历史: ${newTargetJson}`
    );
  }

  return {
    promptAndSaveWorkflow,
    updateWorkflowInterfaceAndRecord,
    updateWorkflowNameAndRecord,
    updateWorkflowDescriptionAndRecord,
    setPreviewTargetAndRecord,
  };
}
