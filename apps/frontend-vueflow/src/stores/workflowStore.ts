import { defineStore } from "pinia";
import type { Node as VueFlowNode, Edge as VueFlowEdge } from "@vue-flow/core";
import type { TabWorkflowState, WorkflowData } from "../types/workflowTypes";
import type {
  HistoryEntry,
  // GroupInterfaceInfo,
  // WorkflowStorageObject,
  // GroupSlotInfo,
  WorkflowMetadata,
} from "@comfytavern/types";
import { useTabStore } from "./tabStore";
import { ref, watch, computed } from "vue";
import { useWorkflowManager } from "../composables/workflow/useWorkflowManager";
import { useWorkflowHistory } from "../composables/workflow/useWorkflowHistory";
import { useWorkflowViewManagement } from "../composables/workflow/useWorkflowViewManagement";
import { useWorkflowInterfaceManagement } from "../composables/workflow/useWorkflowInterfaceManagement";
import { useWorkflowGrouping } from "../composables/group/useWorkflowGrouping";
import { useWorkflowLifecycleCoordinator } from "../composables/workflow/useWorkflowLifecycleCoordinator";
// import { useWorkflowInteractionCoordinator } from "../composables/workflow/useWorkflowInteractionCoordinator"; // DEPRECATED: Logic is being moved into action modules.
import { useWorkflowPreview } from "../composables/workflow/useWorkflowPreview";
import { useMultiInputConnectionActions } from '../composables/node/useMultiInputConnectionActions';
import { useSlotDefinitionHelper } from "../composables/node/useSlotDefinitionHelper";
import { WebSocketMessageType } from "@comfytavern/types";
import { useDialogService } from '../services/DialogService';
import { getWorkflow } from '../utils/api';
import { useWebSocket } from '../composables/useWebSocket';

// 导入新的 Actions 工厂函数
import { createHistoryActions } from './workflow/actions/historyActions';
import { createLifecycleActions } from './workflow/actions/lifecycleActions';
import { createNodeActions } from './workflow/actions/nodeActions';
import { createEdgeActions } from './workflow/actions/edgeActions';
import { createCommonActions } from "./workflow/actions/common"; // 导入 common actions
import type { WorkflowStoreContext } from "./workflow/types";

export const useWorkflowStore = defineStore("workflow", () => {
  // --- 核心 State ---
  const availableWorkflows = ref<WorkflowMetadata[]>([]);
  const changedTemplateWorkflowIds = ref(new Set<string>());

  // --- 底层服务与管理器 (依赖注入) ---
  const tabStore = useTabStore();
  const dialogService = useDialogService();
  const { sendMessage } = useWebSocket();
  const workflowManager = useWorkflowManager();
  const historyManager = useWorkflowHistory();
  const workflowViewManagement = useWorkflowViewManagement();
  const workflowInterfaceManagement = useWorkflowInterfaceManagement();
  const workflowGrouping = useWorkflowGrouping();
  const workflowLifecycleCoordinator = useWorkflowLifecycleCoordinator();
  const workflowPreview = useWorkflowPreview();
  const coordinatorActiveTabIdRef = computed(() => tabStore.activeTabId);
  const multiInputActions = useMultiInputConnectionActions(coordinatorActiveTabIdRef);
  const { getSlotDefinition } = useSlotDefinitionHelper();

  // --- 创建 Actions 上下文 (Context for DI) ---
  const commonActionsFactory = createCommonActions({
    tabStore,
    workflowManager,
    historyManager,
    workflowViewManagement,
  } as any); // 临时 any

  const context: WorkflowStoreContext = {
    // 管理器和服务的引用
    tabStore,
    dialogService,
    workflowManager,
    historyManager,
    workflowViewManagement,
    workflowLifecycleCoordinator,
    workflowGrouping,
    workflowPreview,
    multiInputActions,
    workflowInterfaceManagement,
    getSlotDefinition,
    // Getters / State Refs
    currentSnapshot: computed(() => {
      const activeId = tabStore.activeTabId;
      return activeId ? workflowManager.getCurrentSnapshot(activeId) : undefined;
    }),
    elements: computed(() => context.currentSnapshot.value?.elements ?? []),
    workflowData: computed(() => context.currentSnapshot.value?.workflowData ?? null),
    // 公共方法
    ...commonActionsFactory,
    // 底层方法 (为了让 commonActions 能访问)
    recordHistory: (internalId, entry, snapshot) => {
      historyManager.recordSnapshot(internalId, entry, snapshot);
    },
    setElements: async (internalId, elements) => {
      await workflowManager.setElements(internalId, elements);
    },
    updateNodeInternals: workflowViewManagement.updateNodeInternals,
  };
  
  // 更新 context 内部对自身的引用
  Object.assign(commonActionsFactory, createCommonActions(context));


  // --- 实例化 Actions 模块 ---
  const commonActions = commonActionsFactory;

  const historyActions = createHistoryActions(context);
  const lifecycleActions = createLifecycleActions(context);
  const nodeActions = createNodeActions(context);
  const edgeActions = createEdgeActions(context);

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

  // --- Getters (计算属性) ---
  const activeHistoryIndex = computed(() => {
    const activeId = tabStore.activeTabId;
    if (!activeId) return -1;
    return historyManager.getCurrentIndex(activeId).value;
  });

  // --- 遗留或本地 Actions (待进一步迁移或作为 store 私有方法) ---

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

  // 这个函数现在可以被认为是 `commonActions` 的一部分，但因为它更具体，暂时保留在这里。
  // 或者，它可以被重构为一个更通用的 `applyAndRecord` action。
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
  
  function getTabState(internalId: string): TabWorkflowState | undefined {
    return workflowManager.getAllTabStates.value.get(internalId);
  }
  
  function updateWorkflowData(internalId: string, newData: WorkflowData, isDirty: boolean) {
    const state = workflowManager.getAllTabStates.value.get(internalId);
    if (state) {
      state.workflowData = newData;
      state.isDirty = isDirty;
    }
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

  async function fetchAvailableWorkflows() {
    const fetched = await workflowLifecycleCoordinator.fetchAvailableWorkflows();
    if (fetched) {
      availableWorkflows.value = fetched;
    } else {
      availableWorkflows.value = [];
    }
    return fetched;
  }

  async function deleteWorkflow(workflowId: string) {
    const success = await workflowLifecycleCoordinator.deleteWorkflow(workflowId);
    if (success) {
      await fetchAvailableWorkflows();
    }
    return success;
  }
  
  // --- Store Public API ---
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
    ...commonActions,
    ...historyActions,
    ...lifecycleActions,
    ...nodeActions,
    ...edgeActions,

    // Core Actions (may eventually be moved or remain as fundamental operations)
    setElements: workflowManager.setElements,
    markAsDirty: workflowManager.markAsDirty,
    removeWorkflowData: workflowManager.removeWorkflowData,
    clearWorkflowStatesForProject: workflowManager.clearWorkflowStatesForProject,
    ensureTabState: workflowManager.ensureTabState,
    setVueFlowInstance: workflowViewManagement.setVueFlowInstance,
    getVueFlowInstance: workflowViewManagement.getVueFlowInstance,
    setViewport: workflowViewManagement.setViewport,
    
    // Actions that are still part of the store directly
    loadWorkflow: workflowLifecycleCoordinator.loadWorkflow,
    saveWorkflow: workflowLifecycleCoordinator.saveWorkflow,
    fetchAvailableWorkflows,
    deleteWorkflow,
    createNewWorkflow: workflowLifecycleCoordinator.createNewWorkflowAndRecord,
    handleNodeButtonClick,
    applyElementChangesAndRecordHistory,
    markTemplateAsChanged: (templateId: string) => {
      changedTemplateWorkflowIds.value.add(templateId);
    },
    updateWorkflowData,
    fetchWorkflow,
  };
});
