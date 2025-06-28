import { defineStore } from "pinia";
import type { Node as VueFlowNode, Edge as VueFlowEdge } from "@vue-flow/core";
import type { WorkflowStateSnapshot, TabWorkflowState, WorkflowData } from "../types/workflowTypes";
import type {
  HistoryEntry,
  GroupInterfaceInfo,
  WorkflowStorageObject,
  GroupSlotInfo
} from "@comfytavern/types";
import { useTabStore, type Tab } from "./tabStore";
import { ref, nextTick, watch, computed } from "vue";
import { useWorkflowManager } from "@/composables/workflow/useWorkflowManager";
import { useWorkflowHistory } from "@/composables/workflow/useWorkflowHistory";
import { useWorkflowData } from "@/composables/workflow/useWorkflowData";
import { useWorkflowViewManagement } from "@/composables/workflow/useWorkflowViewManagement";
import { useWorkflowInterfaceManagement } from "@/composables/workflow/useWorkflowInterfaceManagement";
import { useWorkflowGrouping } from "@/composables/group/useWorkflowGrouping";
import { useWorkflowLifecycleCoordinator } from "@/composables/workflow/useWorkflowLifecycleCoordinator";
import { useWorkflowInteractionCoordinator } from "@/composables/workflow/useWorkflowInteractionCoordinator";
import { WebSocketMessageType, DataFlowType, BuiltInSocketMatchCategory } from "@comfytavern/types";
import { getEffectiveDefaultValue } from "@comfytavern/utils";
import { klona } from "klona";
import { useDialogService } from '../services/DialogService';
import { getWorkflow } from '../utils/api';
import { useWebSocket } from '@/composables/useWebSocket';

export const useWorkflowStore = defineStore("workflow", () => {
  const availableWorkflows = ref<
    Array<{
      id: string;
      name: string;
      description?: string;
      creationMethod?: string;
      referencedWorkflows?: string[];
    }>
  >([]);

  const tabStore = useTabStore();
  const dialogService = useDialogService();
  const { sendMessage } = useWebSocket();

  const workflowManager = useWorkflowManager();
  const workflowData = useWorkflowData();
  const workflowViewManagement = useWorkflowViewManagement();
  const workflowInterfaceManagement = useWorkflowInterfaceManagement();
  const workflowGrouping = useWorkflowGrouping();
  const workflowLifecycleCoordinator = useWorkflowLifecycleCoordinator();
  const workflowInteractionCoordinator = useWorkflowInteractionCoordinator();

  const changedTemplateWorkflowIds = ref(new Set<string>());
  const historyManager = useWorkflowHistory();

  watch(
    () => tabStore.tabs,
    (newTabs, oldTabs) => {
      const closedTabIds = (oldTabs ?? [])
        .filter((oldTab) => !newTabs.some((newTab) => newTab.internalId === oldTab.internalId))
        .map((tab) => tab.internalId);

      closedTabIds.forEach((closedId) => {
        historyManager.clearHistory(closedId);
      });
    },
    { deep: true }
  );

  async function undo(steps: number = 1, internalId?: string) {
    const idToUndo = internalId ?? tabStore.activeTabId;
    if (!idToUndo) {
      console.warn("[WorkflowStore] 无法撤销，没有活动的标签页或未提供 ID。");
      return;
    }
    if (steps <= 0) {
      console.warn(`[WorkflowStore] Cannot undo ${steps} steps.`);
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
            (el): el is VueFlowNode => !("source" in el)
          );
          const edges = defaultSnapshot.elements.filter((el): el is VueFlowEdge => "source" in el);
          instance.setNodes(nodes);
          instance.setEdges(edges);
          instance.setViewport(defaultSnapshot.viewport);
        } else if (!instance) {
          console.warn(
            `[WorkflowStore] 在应用默认状态之前无法获取标签页 ${idToUndo} 的 VueFlow 实例。`
          );
        } else if (!defaultSnapshot) {
          console.warn(
            `[WorkflowStore] 撤销到初始状态后无法获取标签页 ${idToUndo} 的默认快照（post-nextTick）。实例可用。`
          );
        }
      } catch (error) {
        console.error(`[WorkflowStore] 在撤销标签页 ${idToUndo} 期间应用默认工作流时出错：`, error);
      }
      return;
    }

    const appliedCore = workflowManager.applyStateSnapshot(idToUndo, targetSnapshot);

    if (!appliedCore) {
      console.error(
        `[WorkflowStore] 在撤销标签页 ${idToUndo} 期间应用核心数据快照失败。正在中止画布更新。`
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
          `[WorkflowStore] 在撤销期间应用快照时出错（直接应用）标签页 ${idToUndo}：`,
          error
        );
      }
    } else {
      console.warn(
        `[WorkflowStore] 在撤销期间无法获取标签页 ${idToUndo} 的 VueFlow 实例。无法应用快照。`
      );
    }
  }

  async function redo(steps: number = 1, internalId?: string) {
    const idToRedo = internalId ?? tabStore.activeTabId;
    if (!idToRedo) {
      console.warn("[WorkflowStore] 无法重做，没有活动的标签页或未提供 ID。");
      return;
    }
    if (steps <= 0) {
      console.warn(`[WorkflowStore] Cannot redo ${steps} steps.`);
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
          `[WorkflowStore] historyManager.redo 在 ${actualSteps} 步后意外返回 null，标签页 ${idToRedo}。`
        );
        break;
      }
    }

    if (targetSnapshot) {
      const appliedCore = workflowManager.applyStateSnapshot(idToRedo, targetSnapshot);
      if (!appliedCore) {
        console.error(
          `[WorkflowStore] 在重做标签页 ${idToRedo} 期间应用核心数据快照失败。正在中止画布更新。`
        );
        return;
      }

      const instance = workflowViewManagement.getVueFlowInstance(idToRedo);
      if (instance) {
        try {
          const nodes = targetSnapshot.elements.filter(
            (el): el is VueFlowNode => !("source" in el)
          );
          const edges = targetSnapshot.elements.filter((el): el is VueFlowEdge => "source" in el);
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
            `[WorkflowStore] 在重做期间应用快照时出错（直接应用）标签页 ${idToRedo}：`,
            error
          );
        }
      } else {
        console.warn(
          `[WorkflowStore] 在重做期间无法获取标签页 ${idToRedo} 的 VueFlow 实例。无法应用快照。`
        );
      }
    } else if (actualSteps === 0) {
      // No steps executed
    } else {
      console.warn(
        `[WorkflowStore] 重做完成 ${actualSteps} 步，但结束时没有标签页 ${idToRedo} 的有效目标快照。`
      );
    }
  }

  function handleNodeButtonClick(internalId: string, nodeId: string, inputKey: string) {
    sendMessage({
      type: WebSocketMessageType.BUTTON_CLICK,
      payload: {
        nodeId: nodeId,
        inputKey: inputKey,
        internalId: internalId,
      },
    });
  }

  function getEdgeById(internalId: string, edgeId: string): VueFlowEdge | undefined {
    const elements = workflowManager.getElements(internalId);
    return elements.find(el => el.id === edgeId && "source" in el) as VueFlowEdge | undefined;
  }

  async function updateMultiInputConnectionsAndRecord(
    internalId: string,
    nodeId: string,
    inputKey: string,
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

    for (const change of edgeTargetHandleChanges) {
      const edgeToUpdate = nextSnapshot.elements.find(
        (el) => el.id === change.edgeId && "source" in el
      ) as VueFlowEdge | undefined;
      if (edgeToUpdate) {
        if (change.newTargetHandle !== undefined) {
          edgeToUpdate.targetHandle = change.newTargetHandle;
        }
      } else {
        console.warn(
          `[WorkflowStore:updateMultiInputConnectionsAndRecord] 在 nextSnapshot 中未找到要更新 targetHandle 的边 ${change.edgeId}。`
        );
      }
    }
    await workflowManager.setElements(internalId, nextSnapshot.elements);
    historyManager.recordSnapshot(internalId, entry, nextSnapshot);
  }

  async function applyElementChangesAndRecordHistory(
    internalId: string,
    newElements: (VueFlowNode | VueFlowEdge)[],
    entry: HistoryEntry
  ): Promise<void> {
    await workflowManager.setElements(internalId, newElements);
    const snapshotToRecord = workflowManager.getCurrentSnapshot(internalId);

    if (!snapshotToRecord) {
      console.error(
        `[WorkflowStore:applyElementChangesAndRecordHistory] 应用元素更改后无法获取标签页 ${internalId} 的快照。历史记录可能不准确。`
      );
      return;
    }
    historyManager.recordSnapshot(internalId, entry, snapshotToRecord);
  }

  const activeHistoryIndex = computed(() => {
    const activeId = tabStore.activeTabId;
    if (!activeId) return -1;
    return historyManager.getCurrentIndex(activeId).value;
  });

  function recordHistorySnapshot(entry: HistoryEntry, snapshotPayload?: WorkflowStateSnapshot) {
    const activeId = tabStore.activeTabId;
    if (!activeId) {
      console.warn("[WorkflowStore] 无法记录历史快照：没有活动的标签页。");
      return;
    }
    let snapshotToRecord: WorkflowStateSnapshot | null = null;
    if (snapshotPayload) {
      snapshotToRecord = snapshotPayload;
    } else {
      snapshotToRecord = workflowManager.getCurrentSnapshot(activeId) ?? null;
    }

    if (snapshotToRecord) {
      historyManager.recordSnapshot(activeId, entry, klona(snapshotToRecord));
    } else {
      console.warn(
        `[WorkflowStore] 无法获取或使用标签页 ${activeId} 的快照进行记录： "${entry.summary}"`
      );
    }
  }

  function formatDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  }

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

    if (newName !== null && newName.trim()) { // dialogService.showInput 在取消时返回 null
      const finalName = newName.trim();
      try {
        const success = await workflowLifecycleCoordinator.saveWorkflow(finalName);
        if (!success) {
          console.warn(`[WorkflowStore promptAndSaveWorkflow] 保存工作流 "${finalName}" 失败 (saveWorkflow 返回 false)。`);
        } else {
          console.info(`[WorkflowStore promptAndSaveWorkflow] 保存工作流 "${finalName}" 成功。`);
        }
        return success;
      } catch (error) {
        console.error(`[WorkflowStore promptAndSaveWorkflow] 调用 saveWorkflow 时捕获到错误:`, error);
        return false;
      }
    } else {
      console.log(`[WorkflowStore promptAndSaveWorkflow] 用户取消保存或名称为空 (prompt 返回: ${newName})。`);
      return false;
    }
  }

  function getTabState(internalId: string): TabWorkflowState | undefined {
    return workflowManager.getAllTabStates.value.get(internalId);
  }

  /**
   * 更新指定标签页的工作流数据和脏状态。
   * @param internalId 标签页的内部 ID
   * @param newData 新的工作流数据
   * @param isDirty 新的脏状态
   */
  function updateWorkflowData(internalId: string, newData: WorkflowData, isDirty: boolean) {
    const state = workflowManager.getAllTabStates.value.get(internalId);
    if (state) {
      state.workflowData = newData;
      state.isDirty = isDirty;
      // 可以在这里添加一些调试日志
      console.debug(`[WorkflowStore] Updated workflow data for tab ${internalId}.`);
    } else {
      console.warn(`[WorkflowStore] Could not find state for tab ${internalId} to update workflow data.`);
    }
  }

  /**
   * 将 NodeGroup 实例特定输入槽的值重置为模板默认值，并记录历史。
   * 此操作会将该输入槽的当前值更改为模板中定义的默认值。
   * @param internalId 当前标签页的内部 ID。
   * @param nodeId NodeGroup 实例的 ID。
   * @param slotKey 输入槽的 key。
   */
  async function resetNodeGroupInputToDefaultAndRecord(internalId: string, nodeId: string, slotKey: string) {
    const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(`[WorkflowStore:resetNodeGroupInputToDefaultAndRecord] 无法获取标签页 ${internalId} 的当前快照。`);
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const nodeToUpdate = nextSnapshot.elements.find(
      (el) => el.id === nodeId && !("source" in el) && el.type === "core:NodeGroup"
    ) as VueFlowNode | undefined;

    if (!nodeToUpdate || !nodeToUpdate.data) {
      console.error(`[WorkflowStore:resetNodeGroupInputToDefaultAndRecord] 未找到 NodeGroup ${nodeId} 或其数据。`);
      return;
    }

    const groupInterface = nodeToUpdate.data.groupInterface as GroupInterfaceInfo | undefined;
    const slotDefInInterface = groupInterface?.inputs?.[slotKey];

    if (!slotDefInInterface) {
      console.error(`[WorkflowStore:resetNodeGroupInputToDefaultAndRecord] 在 NodeGroup ${nodeId} 的 groupInterface 中未找到输入槽 ${slotKey} 的定义。`);
      return;
    }

    const templateDefaultValue = getEffectiveDefaultValue(slotDefInInterface);

    // 直接修改快照中的值
    if (!nodeToUpdate.data.inputs) {
      nodeToUpdate.data.inputs = {};
    }

    const oldValue = nodeToUpdate.data.inputs[slotKey]?.value; // 获取旧值前确保 inputs[slotKey] 存在

    if (!nodeToUpdate.data.inputs[slotKey]) {
      nodeToUpdate.data.inputs[slotKey] = { ...slotDefInInterface, value: klona(templateDefaultValue) };
    } else {
      nodeToUpdate.data.inputs[slotKey].value = klona(templateDefaultValue);
    }

    await workflowManager.setElements(internalId, nextSnapshot.elements);

    const finalSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (finalSnapshot) {
      const nodeLabel = nodeToUpdate.data?.displayName || (nodeToUpdate as any).label || nodeToUpdate.id;
      const historyEntry: HistoryEntry = {
        actionType: "modify",
        objectType: "nodeData",
        summary: `重置节点组 '${nodeLabel}' 输入 '${slotKey}' 为默认值`,
        details: {
          nodeId,
          path: `data.inputs.${slotKey}.value`,
          oldValue: klona(oldValue),
          newValue: klona(templateDefaultValue),
          context: 'nodeGroupInputResetToDefault'
        },
        timestamp: Date.now(),
      };
      historyManager.recordSnapshot(internalId, historyEntry, finalSnapshot);
      console.debug(`[WorkflowStore:resetNodeGroupInputToDefaultAndRecord] NodeGroup ${nodeId} input ${slotKey} 已重置为模板默认值:`, klona(templateDefaultValue));
    } else {
      console.error(`[WorkflowStore:resetNodeGroupInputToDefaultAndRecord] 应用更改后无法获取标签页 ${internalId} 的快照。历史记录未保存。`);
    }
  }

  async function synchronizeGroupNodeInterfaceAndValues(internalId: string, nodeGroupInstanceId: string, referencedWorkflowId: string) {
    const currentElements = workflowManager.getElements(internalId);
    const nodeToUpdate = currentElements.find(
      (el) => el.id === nodeGroupInstanceId && el.type === "core:NodeGroup"
    ) as VueFlowNode | undefined;

    if (!nodeToUpdate || !nodeToUpdate.data) {
      console.error(`[WorkflowStore:synchronizeGroupNodeInterfaceAndValues] 未找到 NodeGroup 实例 ${nodeGroupInstanceId} 或其数据。`);
      return;
    }

    const activeTab = tabStore.tabs.find((t: Tab) => t.internalId === internalId);
    if (!activeTab?.projectId) {
      console.error(`[WorkflowStore:synchronizeGroupNodeInterfaceAndValues] 无法获取项目 ID 用于加载模板工作流 ${referencedWorkflowId}。`);
      return;
    }
    const projectId = activeTab.projectId;

    let templateWorkflowData: WorkflowStorageObject | null = null;
    try {
      const loadResult = await workflowData.loadWorkflow(internalId, projectId, referencedWorkflowId);
      if (loadResult.success && loadResult.loadedData) {
        templateWorkflowData = loadResult.loadedData;
      } else {
        console.warn(`[WorkflowStore:synchronizeGroupNodeInterfaceAndValues] 从 workflowData.loadWorkflow 加载模板 ${referencedWorkflowId} 失败或未返回数据。`);
      }
    } catch (err) {
      console.error(`[WorkflowStore:synchronizeGroupNodeInterfaceAndValues] 加载模板工作流 ${referencedWorkflowId} 时发生错误:`, err);
    }

    if (!templateWorkflowData) {
      console.warn(`[WorkflowStore:synchronizeGroupNodeInterfaceAndValues] 无法加载模板工作流 ${referencedWorkflowId} 的数据。同步中止。`);
      return;
    }

    const snapshotBeforeSync = workflowManager.getCurrentSnapshot(internalId);
    if (!snapshotBeforeSync) {
      console.error(`[WorkflowStore:synchronizeGroupNodeInterfaceAndValues] 无法获取同步前的快照。历史记录将不准确。`);
    }

    const oldGroupInterface = klona(nodeToUpdate.data.groupInterface || { inputs: {}, outputs: {} });
    const oldInputValuesFromSnapshot: Record<string, any> = {};
    if (snapshotBeforeSync) {
      const originalNodeInSnapshot = snapshotBeforeSync.elements.find(el => el.id === nodeGroupInstanceId && el.type === "core:NodeGroup") as VueFlowNode | undefined;
      if (originalNodeInSnapshot?.data?.inputs) {
        for (const [key, inputObj] of Object.entries(originalNodeInSnapshot.data.inputs)) {
          // Ensure inputObj is an object and has a 'value' property
          if (typeof inputObj === 'object' && inputObj !== null && 'value' in inputObj) {
            oldInputValuesFromSnapshot[key] = klona((inputObj as { value: any }).value);
          }
        }
      }
    }

    const newGroupInterface: GroupInterfaceInfo = {
      inputs: klona(templateWorkflowData.interfaceInputs || {}),
      outputs: klona(templateWorkflowData.interfaceOutputs || {}),
    };

    const newInputValues: Record<string, any> = {};
    const lostInputValues: Record<string, any> = {};

    for (const [slotKey, oldValue] of Object.entries(oldInputValuesFromSnapshot)) {
      const newSlotDef = newGroupInterface.inputs?.[slotKey];
      const isNewSlotConvertible = newSlotDef &&
        (newSlotDef.dataFlowType === DataFlowType.CONVERTIBLE_ANY ||
          newSlotDef.matchCategories?.includes(BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE));

      if (newSlotDef && !isNewSlotConvertible) {
        const oldSlotDef = oldGroupInterface.inputs?.[slotKey];
        if (oldSlotDef?.dataFlowType === newSlotDef.dataFlowType) {
          newInputValues[slotKey] = oldValue;
        } else {
          lostInputValues[slotKey] = {
            value: oldValue,
            reason: 'type_incompatible_during_sync',
            oldType: oldSlotDef?.dataFlowType,
            newType: newSlotDef.dataFlowType
          };
        }
      } else {
        lostInputValues[slotKey] = {
          value: oldValue,
          reason: 'slot_deleted_or_became_convertible_in_template_during_sync'
        };
      }
    }

    const elementsToUpdate = klona(currentElements);
    const nodeInClonedElements = elementsToUpdate.find(el => el.id === nodeGroupInstanceId) as VueFlowNode | undefined;
    if (nodeInClonedElements && nodeInClonedElements.data) {
      nodeInClonedElements.data.groupInterface = newGroupInterface;

      const finalInputsForNodeData: Record<string, any> = {};
      if (newGroupInterface.inputs) {
        for (const inputKey in newGroupInterface.inputs) {
          const slotDef = newGroupInterface.inputs[inputKey];
          if (slotDef) { // Ensure slotDef is not undefined
            finalInputsForNodeData[inputKey] = {
              ...(slotDef),
              value: newInputValues[inputKey] !== undefined ? newInputValues[inputKey] : getEffectiveDefaultValue(slotDef)
            };
          }
        }
      }
      nodeInClonedElements.data.inputs = finalInputsForNodeData;
      delete nodeInClonedElements.data.inputValues;
    }

    if (snapshotBeforeSync) {
      const nodeLabel = nodeToUpdate.data?.displayName || (nodeToUpdate as any).label || nodeToUpdate.id;
      const historyEntry: HistoryEntry = {
        actionType: 'sync',
        objectType: 'nodeGroupInstance',
        summary: `同步节点组 ${nodeLabel} 的接口与实例值`,
        details: {
          nodeId: nodeGroupInstanceId,
          tabId: internalId,
          oldGroupInterface: klona(oldGroupInterface),
          newGroupInterface: klona(newGroupInterface),
          oldInputValues: klona(oldInputValuesFromSnapshot),
          newInputValues: klona(newInputValues),
          lostInputValues: klona(lostInputValues)
        },
        timestamp: Date.now(),
      };
      historyManager.recordSnapshot(internalId, historyEntry, snapshotBeforeSync);
    }

    await workflowManager.setElements(internalId, elementsToUpdate);

    changedTemplateWorkflowIds.value.delete(referencedWorkflowId);
    console.info(`[WorkflowStore:synchronizeGroupNodeInterfaceAndValues] NodeGroup ${nodeGroupInstanceId} 已与模板 ${referencedWorkflowId} 同步。`);
  }

  async function fetchWorkflow(projectId: string, workflowId: string) {
    try {
      const workflow = await getWorkflow(projectId, workflowId);
      return workflow;
    } catch (error) {
      console.error(`[WorkflowStore] fetchWorkflow failed for project ${projectId}, workflow ${workflowId}:`, error);
      return null;
    }
  }

  return {
    availableWorkflows,
    fetchWorkflow,
    changedTemplateWorkflowIds: computed(() => changedTemplateWorkflowIds.value),
    getActiveTabState: workflowManager.getActiveTabState,
    getWorkflowData: workflowManager.getWorkflowData,
    isWorkflowDirty: workflowManager.isWorkflowDirty,
    getElements: workflowManager.getElements,
    isTabLoaded: workflowManager.isTabLoaded,
    getAllTabStates: workflowManager.getAllTabStates,
    getTabState,
    setElements: workflowManager.setElements,
    markAsDirty: workflowManager.markAsDirty,
    removeWorkflowData: workflowManager.removeWorkflowData,
    clearWorkflowStatesForProject: workflowManager.clearWorkflowStatesForProject,
    ensureTabState: workflowManager.ensureTabState,
    saveWorkflowAsNew: workflowData.saveWorkflowAsNew,
    extractGroupInterface: workflowData.extractGroupInterface,
    undo,
    redo,
    canUndo: (id: string) => historyManager.canUndo(id),
    canRedo: (id: string) => historyManager.canRedo(id),
    hasUnsavedChanges: (id: string) => historyManager.hasUnsavedChanges(id),
    activeHistoryIndex,
    setVueFlowInstance: workflowViewManagement.setVueFlowInstance,
    getVueFlowInstance: workflowViewManagement.getVueFlowInstance,
    setViewport: workflowViewManagement.setViewport,
    updateEdgeStylesForTab: workflowViewManagement.updateEdgeStylesForTab,
    updateWorkflowInterface: async (
      internalId: string,
      updateFn: (
        currentInputs: Record<string, GroupSlotInfo>,
        currentOutputs: Record<string, GroupSlotInfo>
      ) => {
        inputs: Record<string, GroupSlotInfo>;
        outputs: Record<string, GroupSlotInfo>;
      },
      entry: HistoryEntry
    ) => {
      await workflowInteractionCoordinator.updateWorkflowInterfaceAndRecord(
        internalId,
        updateFn,
        entry
      );
      changedTemplateWorkflowIds.value.add(internalId);
      console.debug(`[WorkflowStore] Template ${internalId} marked as changed after interface update.`);
    },
    removeEdgesForHandle: workflowInterfaceManagement.removeEdgesForHandle,
    createGroupFromSelection: workflowGrouping.groupSelectedNodes,
    loadWorkflow: workflowLifecycleCoordinator.loadWorkflow,
    saveWorkflow: workflowLifecycleCoordinator.saveWorkflow,
    fetchAvailableWorkflows: async () => {
      const fetched = await workflowLifecycleCoordinator.fetchAvailableWorkflows();
      if (fetched) {
        availableWorkflows.value = fetched;
      } else {
        availableWorkflows.value = [];
      }
      return fetched;
    },
    deleteWorkflow: async (workflowId: string) => {
      const success = await workflowLifecycleCoordinator.deleteWorkflow(workflowId);
      if (success) {
        const refreshedList = await workflowLifecycleCoordinator.fetchAvailableWorkflows();
        if (refreshedList) {
          availableWorkflows.value = refreshedList;
        } else {
          availableWorkflows.value = [];
        }
      }
      return success;
    },
    createNewWorkflow: workflowLifecycleCoordinator.createNewWorkflowAndRecord,
    handleConnectionWithInterfaceUpdate:
      workflowInteractionCoordinator.handleConnectionWithInterfaceUpdate,
    handleNodeButtonClick,
    recordHistorySnapshot,
    promptAndSaveWorkflow,
    getEdgeById,
    updateMultiInputConnectionsAndRecord,
    applyElementChangesAndRecordHistory,
    updateNodePositionAndRecord: workflowInteractionCoordinator.updateNodePositionAndRecord,
    addNodeAndRecord: workflowInteractionCoordinator.addNodeAndRecord,
    addEdgeAndRecord: workflowInteractionCoordinator.addEdgeAndRecord,
    removeElementsAndRecord: workflowInteractionCoordinator.removeElementsAndRecord,
    updateNodeInputValueAndRecord: workflowInteractionCoordinator.updateNodeInputValueAndRecord,
    updateNodeConfigValueAndRecord: workflowInteractionCoordinator.updateNodeConfigValueAndRecord,
    changeNodeModeAndRecord: workflowInteractionCoordinator.changeNodeModeAndRecord,
    removeEdgesByHandleAndRecord: workflowInteractionCoordinator.removeEdgesByHandleAndRecord,
    updateWorkflowNameAndRecord: workflowInteractionCoordinator.updateWorkflowNameAndRecord,
    updateWorkflowDescriptionAndRecord:
      workflowInteractionCoordinator.updateWorkflowDescriptionAndRecord,
    updateNodeInputConnectionOrderAndRecord:
      workflowInteractionCoordinator.updateNodeInputConnectionOrderAndRecord,
    disconnectEdgeFromInputAndRecord:
      workflowInteractionCoordinator.disconnectEdgeFromInputAndRecord,
    connectEdgeToInputAndRecord:
      workflowInteractionCoordinator.connectEdgeToInputAndRecord,
    moveAndReconnectEdgeAndRecord:
      workflowInteractionCoordinator.moveAndReconnectEdgeAndRecord,
    markTemplateAsChanged: (templateId: string) => {
      changedTemplateWorkflowIds.value.add(templateId);
    },
    resetNodeGroupInputToDefaultAndRecord,
    synchronizeGroupNodeInterfaceAndValues,
    updateWorkflowData,
  };
});
