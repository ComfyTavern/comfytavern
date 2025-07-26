import { defineStore } from "pinia";
import type { Node as VueFlowNode, Edge as VueFlowEdge } from "@vue-flow/core";
import type { WorkflowStateSnapshot, TabWorkflowState, WorkflowData } from "../types/workflowTypes";
import type {
  HistoryEntry,
  GroupInterfaceInfo,
  WorkflowStorageObject,
  GroupSlotInfo,
  WorkflowMetadata
} from "@comfytavern/types";
import { useTabStore, type Tab } from "./tabStore";
import { ref, watch, computed } from "vue";
import { useWorkflowManager } from "../composables/workflow/useWorkflowManager";
import { useWorkflowHistory } from "../composables/workflow/useWorkflowHistory";
import { useWorkflowData } from "../composables/workflow/useWorkflowData";
import { useWorkflowViewManagement } from "../composables/workflow/useWorkflowViewManagement";
import { useWorkflowInterfaceManagement } from "../composables/workflow/useWorkflowInterfaceManagement";
import { useWorkflowGrouping } from "../composables/group/useWorkflowGrouping";
import { useWorkflowLifecycleCoordinator } from "../composables/workflow/useWorkflowLifecycleCoordinator";
import { useWorkflowInteractionCoordinator } from "../composables/workflow/useWorkflowInteractionCoordinator";
import { useWorkflowPreview } from "../composables/workflow/useWorkflowPreview";
import { useMultiInputConnectionActions } from '../composables/node/useMultiInputConnectionActions';
import { WebSocketMessageType, DataFlowType, BuiltInSocketMatchCategory } from "@comfytavern/types";
import { getEffectiveDefaultValue } from "@comfytavern/utils";
import { klona } from "klona";
import { useDialogService } from '../services/DialogService';
import { getWorkflow } from '../utils/api';
import { useWebSocket } from '../composables/useWebSocket';

// 导入新的 Actions 工厂函数
import { createHistoryActions } from './workflow/actions/historyActions';
import { createLifecycleActions } from './workflow/actions/lifecycleActions';
import { createNodeActions } from './workflow/actions/nodeActions';
import { createEdgeActions } from './workflow/actions/edgeActions';
import type { WorkflowStoreContext } from "./workflow/types";

export const useWorkflowStore = defineStore("workflow", () => {
  // --- 核心 State ---
  const availableWorkflows = ref<WorkflowMetadata[]>([]);
  const changedTemplateWorkflowIds = ref(new Set<string>());

  // --- 依赖注入 (DI Container) ---
  const tabStore = useTabStore();
  const dialogService = useDialogService();
  const { sendMessage } = useWebSocket();
  const workflowManager = useWorkflowManager();
  const workflowData = useWorkflowData();
  const workflowViewManagement = useWorkflowViewManagement();
  const workflowInterfaceManagement = useWorkflowInterfaceManagement();
  const workflowGrouping = useWorkflowGrouping();
  const workflowLifecycleCoordinator = useWorkflowLifecycleCoordinator();
  const workflowInteractionCoordinator = useWorkflowInteractionCoordinator(); // 仍然需要用于遗留函数
  const workflowPreview = useWorkflowPreview(); // +++
  const historyManager = useWorkflowHistory();
  const coordinatorActiveTabIdRef = computed(() => tabStore.activeTabId);
  const multiInputActions = useMultiInputConnectionActions(coordinatorActiveTabIdRef);

  // --- 监视器 ---
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

  // --- 创建 Actions 上下文 ---
  const context: WorkflowStoreContext = {
    // 依赖
    tabStore,
    dialogService,
    workflowManager,
    historyManager,
    workflowViewManagement,
    workflowLifecycleCoordinator,
    workflowGrouping,
    workflowPreview, // +++
    multiInputActions,
    // 核心 State (暂未完全移入)
    elements: ref([]), // Placeholder
    workflowData: ref(null), // Placeholder
    // Getters
    currentSnapshot: computed(() => {
      const activeId = tabStore.activeTabId;
      return activeId ? workflowManager.getCurrentSnapshot(activeId) : undefined;
    }),
    // 底层方法
    recordHistory: (internalId, entry, snapshot) => {
      historyManager.recordSnapshot(internalId, entry, snapshot);
    },
    setElements: async (internalId, elements) => {
      await workflowManager.setElements(internalId, elements);
    },
  };

  // --- 实例化 Actions ---
  const historyActions = createHistoryActions(context);
  const lifecycleActions = createLifecycleActions(context);
  const nodeActions = createNodeActions(context);
  const edgeActions = createEdgeActions(context);

  // --- 遗留函数 (待迁移) ---
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

  function getTabState(internalId: string): TabWorkflowState | undefined {
    return workflowManager.getAllTabStates.value.get(internalId);
  }

  function updateWorkflowData(internalId: string, newData: WorkflowData, isDirty: boolean) {
    const state = workflowManager.getAllTabStates.value.get(internalId);
    if (state) {
      state.workflowData = newData;
      state.isDirty = isDirty;
      console.debug(`[WorkflowStore] Updated workflow data for tab ${internalId}.`);
    } else {
      console.warn(`[WorkflowStore] Could not find state for tab ${internalId} to update workflow data.`);
    }
  }

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

    if (!nodeToUpdate.data.inputs) {
      nodeToUpdate.data.inputs = {};
    }

    const oldValue = nodeToUpdate.data.inputs[slotKey]?.value;

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
          if (slotDef) {
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

  // --- 最终导出的 Store ---
  return {
    // State
    availableWorkflows,
    changedTemplateWorkflowIds: computed(() => changedTemplateWorkflowIds.value),
    
    // Getters
    getActiveTabState: workflowManager.getActiveTabState,
    getWorkflowData: workflowManager.getWorkflowData,
    isWorkflowDirty: workflowManager.isWorkflowDirty,
    isWorkflowNew: workflowManager.isWorkflowNew,
    getElements: workflowManager.getElements,
    isTabLoaded: workflowManager.isTabLoaded,
    getAllTabStates: workflowManager.getAllTabStates,
    getTabState,
    canUndo: (id: string) => historyManager.canUndo(id),
    canRedo: (id: string) => historyManager.canRedo(id),
    hasUnsavedChanges: (id: string) => historyManager.hasUnsavedChanges(id),
    activeHistoryIndex,

    // Actions from Modules
    ...historyActions,
    ...lifecycleActions,
    ...nodeActions,
    ...edgeActions,

    // Legacy Actions (to be migrated)
    setElements: workflowManager.setElements,
    markAsDirty: workflowManager.markAsDirty,
    removeWorkflowData: workflowManager.removeWorkflowData,
    clearWorkflowStatesForProject: workflowManager.clearWorkflowStatesForProject,
    ensureTabState: workflowManager.ensureTabState,
    saveWorkflowAsNew: workflowData.saveWorkflowAsNew,
    extractGroupInterface: workflowData.extractGroupInterface,
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
    handleNodeButtonClick,
    recordHistorySnapshot,
    applyElementChangesAndRecordHistory,
    updateNodePositionAndRecord: workflowInteractionCoordinator.updateNodePositionAndRecord,
    updateWorkflowNameAndRecord: workflowInteractionCoordinator.updateWorkflowNameAndRecord,
    updateWorkflowDescriptionAndRecord:
      workflowInteractionCoordinator.updateWorkflowDescriptionAndRecord,
    markTemplateAsChanged: (templateId: string) => {
      changedTemplateWorkflowIds.value.add(templateId);
    },
    resetNodeGroupInputToDefaultAndRecord,
    synchronizeGroupNodeInterfaceAndValues,
    updateWorkflowData,
    fetchWorkflow,
  };
});
