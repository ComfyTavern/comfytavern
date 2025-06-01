// apps/frontend-vueflow/src/composables/useWorkflowData.ts
import type { FlowExportObject, Node as VueFlowNode, Edge as VueFlowEdge } from "@vue-flow/core";
import { type Node, type Edge } from "@vue-flow/core";
import { getEdgeStyleProps } from "../canvas/useEdgeStyles"; // 导入样式函数
import {
  saveWorkflowApi,
  loadWorkflowApi,
  listWorkflowsApi,
  deleteWorkflowApi,
} from "@/api/workflow";
import type {
  WorkflowObject,
  GroupSlotInfo,
  WorkflowViewport as SharedViewport,
  WorkflowStorageObject, // <-- Import WorkflowStorageObject
  WorkflowStorageEdge, // 导入 WorkflowStorageEdge 以便转换
} from "@comfytavern/types";
import { useThemeStore } from "@/stores/theme";
// import { useTabStore } from '@/stores/tabStore'; // 移除，不再直接更新 Tab
import { useProjectStore } from "@/stores/projectStore";
import { useWorkflowStore } from "@/stores/workflowStore"; // 仍然需要访问 ensureTabState
import type { WorkflowData } from "@/types/workflowTypes"; // 从 types 导入 WorkflowData
import {
  transformVueFlowToCoreWorkflow,
  transformWorkflowToVueFlow,
  extractGroupInterface as extractGroupInterfaceUtil,
} from "@/utils/workflowTransformer";
// import { useApi } from '@/utils/api'; // 移除，不再触发项目元数据更新
import defaultWorkflowData from '@/data/DefaultWorkflow.json'; // <-- 导入默认工作流数据

export function useWorkflowData() {
  const workflowStore = useWorkflowStore(); // 访问主 store (用于 ensureTabState 和类型)
  // const tabStore = useTabStore(); // 移除
  const projectStore = useProjectStore(); // 获取项目 store 实例
  const themeStore = useThemeStore();
  // const api = useApi(); // 移除

  // --- 类型转换函数已被移动到 utils/workflowTransformer.ts ---

  /**
   * 加载工作流并适配其边句柄类型以符合 WorkflowStorageObject。
   * @param projectId 项目 ID
   * @param workflowId 工作流 ID
   * @returns 适配后的 WorkflowStorageObject 或 null
   */
  async function loadAndAdaptWorkflowApi(
    projectId: string,
    workflowId: string
  ): Promise<WorkflowStorageObject | null> {
    const workflow = await loadWorkflowApi(projectId, workflowId);
    if (!workflow) {
      return null;
    }
    // 确保 workflow.edges 存在且是数组
    const adaptedEdges = (workflow.edges || []).map((edge) => ({
      ...edge,
      sourceHandle: edge.sourceHandle ?? "",
      targetHandle: edge.targetHandle ?? "",
    })) as WorkflowStorageEdge[]; // 类型断言为 WorkflowStorageEdge[]

    return {
      ...workflow,
      edges: adaptedEdges,
    } as WorkflowStorageObject; // 最终断言为 WorkflowStorageObject
  }

  // --- API 交互 ---
  async function saveWorkflow(
    internalId: string,
    elements: Array<VueFlowNode | VueFlowEdge>, // 接收 elements
    viewport: SharedViewport, // 接收 viewport
    newName?: string
  ): Promise<WorkflowData | null> {
    // 返回保存后的数据或 null
    const projectId = projectStore.currentProjectId;
    if (!projectId) {
      console.error(`[saveWorkflow] Cannot save workflow, project ID is missing.`);
      alert("无法保存工作流：未选择项目。");
      return null; // 返回 null 表示失败
    }
    const state = await workflowStore.ensureTabState(internalId); // 添加 await // 仍然需要获取 state 来读取 workflowData 元数据
    if (!state) {
      console.error(`[saveWorkflow] State not found for tab ${internalId} during save.`);
      alert(`无法保存标签页 ${internalId}：状态丢失。`);
      return null; // 返回 null 表示失败
    }
    if (!state.vueFlowInstance) {
      // 不再需要检查 VueFlow instance，因为 elements 和 viewport 是传入的
      console.debug(`[saveWorkflow] Saving workflow for tab ${internalId}.`);
    }

    // 使用传入的 elements
    const nodesToSave = elements.filter((el) => !("source" in el)) as VueFlowNode[];
    const edgesToSave = elements.filter((el) => "source" in el) as VueFlowEdge[];

    const flowExport: FlowExportObject = {
      nodes: nodesToSave,
      edges: edgesToSave,
      // 使用传入的 viewport
      position: [viewport.x, viewport.y], // 保持兼容性
      zoom: viewport.zoom,
      viewport: {
        x: viewport.x,
        y: viewport.y,
        zoom: viewport.zoom,
      },
    };

    console.debug(
      `[saveWorkflow] Exported flow data for save (tab ${internalId}, project ${projectId}):`,
      flowExport
    );

    // 判断是否为新工作流或另存为：ID 不存在，或者 ID 是临时的 (以 'temp-' 开头)
    const isNewOrSaveAs = !state.workflowData?.id || state.workflowData.id.startsWith("temp-");
    const currentData = state.workflowData; // 读取当前元数据

    if (isNewOrSaveAs) {
      // 调用者 (EditorView) 负责提示并提供 newName。
      // 如果 newName 在这里缺失，是调用逻辑错误，但我们继续执行，
      // 让 API 调用（如果后端 schema 需要 name）可能失败。
      // console.error(`useWorkflowData: Workflow name required for new workflow (tab ${internalId}).`); // 移除冗余检查
      // alert('请输入工作流名称。'); // 移除冗余弹窗
      // return false; // 移除冗余返回
      // 1. 使用新的转换函数获取核心数据
      const coreWorkflowData = transformVueFlowToCoreWorkflow(flowExport);
      // 2. 组合核心数据和元数据
      const workflowToSave: Omit<WorkflowObject, "id"> = {
        name: newName || state.workflowData?.name || "Untitled Workflow", // 确保有名称
        description: state.workflowData?.description || "",
        nodes: coreWorkflowData.nodes,
        edges: coreWorkflowData.edges,
        viewport: coreWorkflowData.viewport,
        interfaceInputs: state.workflowData?.interfaceInputs || {},
        interfaceOutputs: state.workflowData?.interfaceOutputs || {},
        version: import.meta.env.VITE_APP_VERSION || "unknown",
      };
      try {
        // 将 projectId 传递给 API 调用
        const savedWorkflow = (await saveWorkflowApi(projectId, workflowToSave)) as WorkflowData;
        // 不再直接更新 state 或 tabStore
        // state.workflowData = savedWorkflow;
        // state.isDirty = false;
        console.info(
          `[saveWorkflow] New workflow saved successfully (tab ${internalId}, project ${projectId}):`,
          savedWorkflow
        );

        // --- 移除触发项目元数据更新 ---
        // --- 移除刷新列表和更新标签页 ---
        // await fetchAvailableWorkflows(); // 让调用者处理
        // tabStore.updateTab(...) // 让调用者处理

        return savedWorkflow; // 返回保存后的数据
      } catch (error) {
        console.error(
          `[saveWorkflow] Failed to save new workflow (tab ${internalId}, project ${projectId}):`,
          error
        );
        alert(`保存新工作流失败: ${error instanceof Error ? error.message : String(error)}`);
        // throw error; // 不再重新抛出，返回 null 表示失败
        return null;
      }
    } else {
      // 保存现有工作流
      if (!currentData || !currentData.id) {
        // 确保 currentData 及其 ID 存在
        console.error(
          `[saveWorkflow] Cannot update workflow: current data or ID missing (tab ${internalId}, project ${projectId}).`
        );
        alert("更新工作流失败：当前工作流状态异常。");
        return null; // 返回 null 表示失败
      }
      // 如果调用者提供了 newName（例如，用户可能在保存时重命名，尽管当前 UI 不支持），则使用它，否则使用 currentData 的名称。
      const nameToUse = newName ?? currentData.name;
      // 1. 使用新的转换函数获取核心数据
      const coreWorkflowData = transformVueFlowToCoreWorkflow(flowExport);
      // 2. 组合核心数据和元数据
      const workflowToUpdate: Omit<WorkflowObject, "id"> = {
        name: nameToUse, // 使用确定的名称
        description: currentData.description || "",
        nodes: coreWorkflowData.nodes,
        edges: coreWorkflowData.edges,
        viewport: coreWorkflowData.viewport,
        interfaceInputs: currentData.interfaceInputs || {},
        interfaceOutputs: currentData.interfaceOutputs || {},
        version: import.meta.env.VITE_APP_VERSION || "unknown",
      };
      const workflowIdToUpdate = currentData.id; // 使用现有的相对 ID
      try {
        // 将 projectId 和相对 workflowId 传递给 API 调用
        const updatedWorkflow = (await saveWorkflowApi(
          projectId,
          workflowToUpdate,
          workflowIdToUpdate
        )) as WorkflowData;
        // 不再直接更新 state 或 tabStore
        // state.workflowData = updatedWorkflow;
        // state.isDirty = false;
        console.info(
          `[saveWorkflow] Workflow updated successfully (tab ${internalId}, project ${projectId}, workflow ${workflowIdToUpdate}):`,
          updatedWorkflow
        );

        // --- 移除触发项目元数据更新 ---
        // --- 移除更新标签页 ---
        // tabStore.updateTab(...) // 让调用者处理

        return updatedWorkflow; // 返回更新后的数据
      } catch (error: any) {
        // 添加类型 any 以访问 status
        console.error(
          `[saveWorkflow] Failed to update workflow (tab ${internalId}, project ${projectId}, workflow ${workflowIdToUpdate}):`,
          error
        );
        // 检查是否为 409 冲突错误
        if (error.response?.status === 409 || error.status === 409) {
          // 提取后端返回的更详细错误信息（如果存在）
          const conflictMessage =
            error.response?.data?.error ||
            error.data?.error ||
            `工作流名称 '${nameToUse}' 已存在，请使用其他名称。`;
          alert(`保存失败：${conflictMessage}`);
        } else {
          // 其他错误使用通用消息
          alert(`更新工作流失败: ${error instanceof Error ? error.message : String(error)}`);
        }
        // throw error; // 不再重新抛出，返回 null 表示失败
        return null;
      }
    }
  }

  async function loadWorkflow(
    internalId: string,
    projectId: string, // 接收 projectId
    workflowId: string
  ): Promise<{ success: boolean; loadedData?: WorkflowStorageObject; flowToLoad?: FlowExportObject }> {
    const state = await workflowStore.ensureTabState(internalId);
    const instance = state.vueFlowInstance;
    if (!instance) {
      console.warn(
        `[loadWorkflow] Instance not available for tab ${internalId} during load. Loading data only.`
      );
    }
    try {
      // 使用新的适配器函数加载工作流
      const loadedWorkflowObject = await loadAndAdaptWorkflowApi(projectId, workflowId);
      if (loadedWorkflowObject) {
        const isDark = themeStore.isDark;
        // 调用已修改的 transformWorkflowToVueFlow，并传递适配后的加载函数
        const { flowData: flowToLoad } = await transformWorkflowToVueFlow(
          loadedWorkflowObject,
          projectId, // 传递 projectId
          isDark,
          getEdgeStyleProps,
          loadAndAdaptWorkflowApi // 传递适配后的 API 函数作为加载器
        );
        console.info(
          `[loadWorkflow] Workflow loaded (tab ${internalId}, project ${projectId}, workflow ${workflowId}):`,
          loadedWorkflowObject
        );
        return { success: true, loadedData: loadedWorkflowObject, flowToLoad };
      } else {
        console.error(
          `[loadWorkflow] Load workflow API call succeeded but returned no data for project ${projectId}, workflow ${workflowId} (tab ${internalId}).`
        );
        alert(`加载工作流 '${workflowId}' 失败：未收到有效数据。`);
        return { success: false };
      }
    } catch (error) {
      console.error(
        `[loadWorkflow] Failed to load workflow (tab ${internalId}, project ${projectId}, workflow ${workflowId}):`,
        error
      );
      alert(`加载工作流错误: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false };
    }
  }

  async function fetchAvailableWorkflows(): Promise<
    Array<{ id: string; name: string; description?: string }>
  > {
    const projectId = projectStore.currentProjectId;
    if (!projectId) {
      console.warn("[fetchAvailableWorkflows] Cannot fetch workflows, project ID is missing.");
      return [];
    }
    try {
      const workflows = await listWorkflowsApi(projectId);
      console.debug(
        `[fetchAvailableWorkflows] Available workflows fetched for project ${projectId}:`,
        workflows
      );
      return workflows;
    } catch (error) {
      console.error(
        `[fetchAvailableWorkflows] Failed to fetch available workflows for project ${projectId}:`,
        error
      );
      return [];
    }
  }

  async function deleteWorkflow(workflowId: string): Promise<boolean> {
    const projectId = projectStore.currentProjectId;
    if (!projectId) {
      console.error(`[deleteWorkflow] Cannot delete workflow, project ID is missing.`);
      alert("无法删除工作流：未选择项目。");
      return false;
    }
    try {
      await deleteWorkflowApi(projectId, workflowId);
      console.info(`[deleteWorkflow] Workflow ${workflowId} deleted from project ${projectId}.`);
      return true;
    } catch (error) {
      console.error(
        `[deleteWorkflow] Failed to delete workflow ${workflowId} from project ${projectId}:`,
        error
      );
      alert(`删除工作流错误: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 将一个 WorkflowObject 保存为一个全新的工作流文件。
   * @param projectId 项目 ID
   * @param workflowObject 要保存的工作流数据 (不需要 ID)
   * @returns 保存后的 WorkflowData (包含新 ID) 或 null
   */
  async function saveWorkflowAsNew(
    projectId: string,
    workflowObject: Omit<WorkflowObject, "id">
  ): Promise<WorkflowData | null> {
    console.debug(
      `[saveWorkflowAsNew] Attempting to save new workflow in project ${projectId}:`,
      workflowObject.name
    );
    try {
      const savedWorkflow = (await saveWorkflowApi(projectId, workflowObject)) as WorkflowData;
      console.info(
        `[saveWorkflowAsNew] Successfully saved new workflow with ID: ${savedWorkflow.id}`
      );
      return savedWorkflow;
    } catch (error) {
      console.error(
        `[saveWorkflowAsNew] Failed to save new workflow in project ${projectId}:`,
        error
      );
      alert(`创建新工作流文件失败: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  // --- 默认工作流加载 ---
  async function loadDefaultWorkflow(internalId: string): Promise<{ // <-- 变为 async, 返回 Promise
    elements: Array<Node | Edge>;
    viewport: SharedViewport;
    interfaceInputs: Record<string, GroupSlotInfo>;
    interfaceOutputs: Record<string, GroupSlotInfo>;
  }> {
    console.debug(`[useWorkflowData] Attempting to load default workflow for tab ${internalId}.`);
    try {
      const defaultStorageObject = defaultWorkflowData as WorkflowStorageObject;
      const isDark = themeStore.isDark;

      // Mock loader for default workflow, as it shouldn't reference other API-loaded workflows
      const mockLoadWorkflowById = async (
        _pId: string,
        _wfId: string
      ): Promise<WorkflowStorageObject | null> => {
        console.warn(
          `[loadDefaultWorkflow] Attempted to load referenced workflow '${_wfId}' from default workflow. This is not supported for static default workflows. Returning null.`
        );
        return null;
      };

      const { flowData: defaultFlowData } = await transformWorkflowToVueFlow( // <-- await
        defaultStorageObject,
        "", // Placeholder projectId, not expected to be used for default workflow's internal refs
        isDark,
        getEdgeStyleProps,
        mockLoadWorkflowById // Pass the mock loader
      );

      const interfaceInputs = defaultStorageObject.interfaceInputs || {};
      const interfaceOutputs = defaultStorageObject.interfaceOutputs || {};

      console.info(`[useWorkflowData] Successfully loaded and transformed default workflow for tab ${internalId}.`);
      return {
        elements: [...defaultFlowData.nodes, ...defaultFlowData.edges],
        viewport: defaultFlowData.viewport,
        interfaceInputs,
        interfaceOutputs,
      };
    } catch (error) {
      console.error(`[useWorkflowData] Failed to load or transform default workflow for tab ${internalId}. Returning blank structure. Error:`, error);
      const elements: Array<Node | Edge> = [];
      const viewport: SharedViewport = { x: 0, y: 0, zoom: 1 };
      const interfaceInputs: Record<string, GroupSlotInfo> = {};
      const interfaceOutputs: Record<string, GroupSlotInfo> = {};
      return { elements, viewport, interfaceInputs, interfaceOutputs };
    }
  }

  return {
    // vueFlowToWorkflow, // 已移除
    // workflowToVueFlow, // 已移除
    extractGroupInterface: extractGroupInterfaceUtil, // 导出重命名后的工具函数
    saveWorkflow,
    loadWorkflow,
    fetchAvailableWorkflows,
    deleteWorkflow,
    loadDefaultWorkflow,
    saveWorkflowAsNew, // <-- 导出新函数
  };
}
