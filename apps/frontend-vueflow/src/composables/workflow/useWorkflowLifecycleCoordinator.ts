import type { Node as VueFlowNode, Edge as VueFlowEdge } from "@vue-flow/core";
import type { Viewport, WorkflowData, WorkflowStateSnapshot } from "../../types/workflowTypes";
import type { HistoryEntry } from "@comfytavern/types";
import { createHistoryEntry } from "@comfytavern/utils";
import { useTabStore } from "../../stores/tabStore";
import { useProjectStore } from "../../stores/projectStore";
import { useWorkflowManager } from "./useWorkflowManager";
import { useWorkflowHistory } from "./useWorkflowHistory";
import { useWorkflowData } from "./useWorkflowData";
import { useWorkflowViewManagement } from "./useWorkflowViewManagement";

/**
 * @module composables/workflow/useWorkflowLifecycleCoordinator
 * @description
 * 协调工作流生命周期事件（加载、保存、新建、删除）的 composable。
 * 它与 `useWorkflowManager`、`useWorkflowData`、`useWorkflowHistory` 等交互，
 * 以确保在执行这些生命周期操作时，状态、数据持久化和历史记录保持一致。
 */
export function useWorkflowLifecycleCoordinator() {
  // --- 依赖注入 ---
  const tabStore = useTabStore();
  const projectStore = useProjectStore();
  const workflowManager = useWorkflowManager();
  const workflowData = useWorkflowData();
  const historyManager = useWorkflowHistory();
  const workflowViewManagement = useWorkflowViewManagement();

  // --- 内部辅助函数 ---

  /**
   * 确保为指定标签页记录历史快照。
   * 如果提供了快照，则使用提供的快照；否则，获取当前快照。
   * @param internalId - 标签页的内部 ID。
   * @param entry - 要记录的历史条目。
   * @param snapshotToRecord - 可选的预构建快照。
   * @private
   */
  function _recordHistory(
    internalId: string,
    entry: HistoryEntry,
    snapshotToRecord?: WorkflowStateSnapshot
  ) {
    const snapshot = snapshotToRecord ?? workflowManager.getCurrentSnapshot(internalId);

    if (snapshot) {
      historyManager.recordSnapshot(internalId, entry, snapshot);
      // console.debug(`[LifecycleCoordinator] Recorded snapshot for tab ${internalId}: "${entry.summary}"`);
    } else {
      console.warn(
        `[LifecycleCoordinator] Could not get or use provided snapshot for tab ${internalId} to record history: "${entry.summary}"`
      );
    }
  }

  // --- 生命周期协调函数 ---

  /**
   * 将指定 ID 的工作流加载到指定的标签页中。
   * 协调数据获取、状态应用、历史记录初始化和视图更新。
   * @param internalId - 目标标签页的内部 ID。
   * @param workflowId - 要加载的工作流的 ID。
   * @returns {Promise<boolean>} 加载操作是否成功。
   */
  async function loadWorkflow(internalId: string, workflowId: string): Promise<boolean> {
    // console.info(`[LifecycleCoordinator] Coordinating loadWorkflow for tab ${internalId}, workflow ${workflowId}`);
    // 确保标签页状态存在，但不应用默认值，加载过程会覆盖它
    workflowManager.ensureTabState(internalId, false);

    // 1. 从 useWorkflowData 获取工作流数据
    const { success, loadedData, flowToLoad } = await workflowData.loadWorkflow(
      internalId,
      projectStore.currentProjectId!,
      workflowId
    );

    if (success && loadedData && flowToLoad) {
      // console.debug(`[LifecycleCoordinator] Workflow ${workflowId} data fetched successfully. Applying...`);
      // 2. 准备要应用的数据
      const elementsToApply = [...flowToLoad.nodes, ...flowToLoad.edges];
      const viewportToApply: Viewport = {
        x: flowToLoad.position[0],
        y: flowToLoad.position[1],
        zoom: flowToLoad.zoom,
      };

      // 3. 通过 WorkflowManager 应用状态快照
      // 将加载的数据 (WorkflowStorageObject) 转换为 WorkflowData
      const workflowDataForSnapshot: WorkflowData = {
        ...loadedData,
        id: workflowId, // 添加用于加载数据的 workflowId
        name: loadedData.name || '未命名工作流', // 如果缺少名称，提供默认值
        viewport: loadedData.viewport || { x: 0, y: 0, zoom: 1 }, // 如果缺少视口，提供默认值
      };
      const initialSnapshot: WorkflowStateSnapshot = {
        elements: elementsToApply,
        viewport: viewportToApply,
        workflowData: workflowDataForSnapshot,
      };
      workflowManager.applyStateSnapshot(internalId, initialSnapshot);
      // 显式更新 WorkflowManager 内部的 elements，确保一致性
      await workflowManager.setElements(internalId, initialSnapshot.elements);


      // 4. 清除旧历史记录并记录初始加载快照
      historyManager.clearHistory(internalId);
      const loadEntry: HistoryEntry = createHistoryEntry(
        'load',
        'workflow',
        `加载工作流 ${loadedData.name}`,
        { workflowId: workflowId, workflowName: loadedData.name }
      );
      _recordHistory(internalId, loadEntry, initialSnapshot); // 使用内部辅助函数
      // console.debug(`[LifecycleCoordinator] Cleared history and recorded initial snapshot for tab ${internalId}: "${loadEntry.summary}"`);

      // 5. 更新 VueFlow 实例视图
      const instance = workflowViewManagement.getVueFlowInstance(internalId);
      if (instance) {
        const nodes = initialSnapshot.elements.filter(
          (el): el is VueFlowNode => !("source" in el)
        );
        const edges = initialSnapshot.elements.filter(
          (el): el is VueFlowEdge => "source" in el
        );
        instance.setNodes(nodes);
        instance.setEdges(edges);
        instance.setViewport(initialSnapshot.viewport);
        // console.debug(`[LifecycleCoordinator] Updated VueFlow instance for tab ${internalId} after load.`);
      } else {
        console.warn(
          `[LifecycleCoordinator] Could not get VueFlow instance for tab ${internalId} after load`
        );
      }

      // console.info(`[LifecycleCoordinator] Workflow ${workflowId} applied to tab ${internalId}.`);
      return true;
    } else {
      console.error(
        `[LifecycleCoordinator] Failed to load workflow ${workflowId} from backend.`
      );
      return false;
    }
  }

  /**
   * 保存当前活动标签页的工作流。
   * 协调状态获取、数据持久化、状态更新（清除脏标记）和历史记录。
   * @param newName - 可选的新工作流名称。如果提供，将用于“另存为”操作。
   * @returns {Promise<boolean>} 保存操作是否成功。
   */
  async function saveWorkflow(newName?: string): Promise<boolean> {
    const activeTabId = tabStore.activeTabId;
    if (!activeTabId) {
      console.warn("[LifecycleCoordinator] Cannot save workflow, no active tab.");
      return false;
    }
    // console.info(`[LifecycleCoordinator] Coordinating saveWorkflow for active tab ${activeTabId}`);

    // 1. 从 WorkflowManager 获取当前活动标签页的状态
    const activeTabState = workflowManager.getActiveTabState();
    if (!activeTabState) {
      console.error(
        `[LifecycleCoordinator] Cannot save workflow for tab ${activeTabId}, active state not found.`
      );
      return false;
    }

    // 2. 提取要保存的元素和视口
    const elementsToSave = workflowManager.getElements(activeTabId);
    const viewportToSave = activeTabState.viewport;

    // 3. 调用 useWorkflowData.saveWorkflow 进行持久化
    const savedData = await workflowData.saveWorkflow(
      activeTabId,
      elementsToSave,
      viewportToSave,
      newName
    );

    // 4. 如果保存成功，更新 WorkflowManager 中的状态和 TabStore 中的标签信息
    if (savedData) {
      const state = workflowManager.getActiveTabState(); // 重新获取以防万一
      if (state) {
        state.workflowData = savedData; // 更新工作流元数据
        state.isDirty = false; // 清除脏标记
        tabStore.updateTab(activeTabId, {
          label: savedData.name, // 更新标签页标题
          associatedId: savedData.id, // 关联工作流 ID
          isDirty: false, // 更新标签页脏状态
        });
        // console.info(`[LifecycleCoordinator] Workflow saved successfully for tab ${activeTabId}. State and tab updated.`);

        // 记录保存操作的历史快照
        const saveEntry: HistoryEntry = createHistoryEntry(
          'save',
          'workflow',
          `保存工作流 ${savedData.name}`,
          { workflowId: savedData.id, workflowName: savedData.name }
        );
        _recordHistory(activeTabId, saveEntry); // 使用内部辅助函数

        // 在记录完“保存工作流”快照之后，标记当前状态为已保存点
        // 这样 savedIndex 就会指向包含“保存工作流”操作的那个历史记录项
        historyManager.markAsSaved(activeTabId);
        return true;
      } else {
        // 这理论上不应该发生，因为我们之前检查过 activeTabState
        console.error(
          `[LifecycleCoordinator] Failed to update state for tab ${activeTabId} after saving.`
        );
        return false;
      }
    } else {
      console.error(
        `[LifecycleCoordinator] Failed to save workflow for tab ${activeTabId} via useWorkflowData.`
      );
      return false;
    }
  }

  /**
   * 获取当前项目的可用工作流列表。
   * 委托给 useWorkflowData 处理 API 调用。
   * @returns {Promise<Array<{ id: string; name: string; description?: string }> | null>}
   *          成功时返回工作流列表（包含 id, name, description），失败时返回 null。
   */
  async function fetchAvailableWorkflows(): Promise<Array<{ id: string; name: string; description?: string }> | null> {
    const projectId = projectStore.currentProjectId;
    if (!projectId) {
      console.warn("[LifecycleCoordinator] Cannot fetch workflows, no project selected.");
      return null;
    }
    // console.info(`[LifecycleCoordinator] Coordinating fetchAvailableWorkflows for project ${projectId}...`);
    // 让 useWorkflowData 处理实际的 API 调用
    const fetchedWorkflows = await workflowData.fetchAvailableWorkflows();
    // store 会监听此函数的返回值或通过其他方式触发更新其 availableWorkflows 状态
    return fetchedWorkflows;
  }

  /**
   * 删除指定 ID 的工作流。
   * 协调后端删除操作。注意：当前版本不处理受影响标签页的重置。
   * @param workflowId - 要删除的工作流的 ID。
   * @returns {Promise<boolean>} 删除操作是否成功。
   */
  async function deleteWorkflow(workflowId: string): Promise<boolean> {
    const projectId = projectStore.currentProjectId;
    if (!projectId) {
      console.error("[LifecycleCoordinator] Cannot delete workflow, no project selected.");
      return false;
    }

    // console.info(`[LifecycleCoordinator] Coordinating deleteWorkflow for workflow ${workflowId}`);
    // 1. 通过 useWorkflowData 调用后端删除接口
    // 注意：后端可能实现的是移动到回收站或直接删除
    const success = await workflowData.deleteWorkflow(workflowId);

    if (success) {
      console.info(`[LifecycleCoordinator] Workflow ${workflowId} deleted successfully. Tab reset logic removed.`);
      // 之前版本会重置打开了此工作流的标签页，现已移除该逻辑。
      // store 应在确认成功后再次调用 fetchAvailableWorkflows 来更新列表。
    } else {
      console.error(`[LifecycleCoordinator] Failed to delete workflow ${workflowId}.`);
    }
    return success;
  }

  /**
   * 在指定标签页中创建新的、空的工作流状态，并记录初始历史快照。
   * 包装了 `workflowManager.createNewWorkflow` 并添加了历史记录步骤。
   * @param internalId - 目标标签页的内部 ID。
   * @returns {Promise<WorkflowStateSnapshot | null>} 创建成功时返回初始快照，否则返回 null。
   */
  async function createNewWorkflowAndRecord(internalId: string): Promise<WorkflowStateSnapshot | null> {
    // 调用管理器创建新工作流并获取初始快照
    const initialSnapshot = await workflowManager.createNewWorkflow(internalId);

    // 如果成功获取快照，则记录初始创建历史
    if (initialSnapshot) {
      const createEntry: HistoryEntry = createHistoryEntry(
        'create',
        'workflow',
        '新建工作流',
        {} // 创建操作通常不需要特定细节
      );
      _recordHistory(internalId, createEntry, initialSnapshot); // 使用内部辅助函数
      // console.debug(`[LifecycleCoordinator] Recorded initial snapshot for new workflow in tab ${internalId}: "${createEntry.summary}"`);
    } else {
      // 如果管理器未能返回快照，记录错误并确保历史状态存在
      console.error(
        `[LifecycleCoordinator] Failed to get initial snapshot after creating new workflow for tab ${internalId}. History not recorded.`
      );
      historyManager.ensureHistoryState(internalId); // 确保至少有一个空的 history state
    }
    // 返回快照，供调用者使用
    return initialSnapshot;
  }

  // --- 导出公共接口 ---
  return {
    /** 加载工作流到标签页 */
    loadWorkflow,
    /** 保存当前活动工作流 */
    saveWorkflow,
    /** 获取可用工作流列表 */
    fetchAvailableWorkflows,
    /** 删除工作流 */
    deleteWorkflow,
    /** 创建新工作流并记录历史 */
    createNewWorkflowAndRecord,
  };
}
