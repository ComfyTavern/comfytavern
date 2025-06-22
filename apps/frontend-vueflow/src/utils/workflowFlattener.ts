import type { Node as VueFlowNode, Edge as VueFlowEdge } from "@vue-flow/core";
import type { useWorkflowData } from '@/composables/workflow/useWorkflowData';
import type { useProjectStore } from '@/stores/projectStore';
import {
  flattenStorageWorkflow,
  transformStorageToVueFlow,
  transformVueFlowToStorage,
  type WorkflowLoader,
} from '@comfytavern/utils';
import type { NodeDefinition, WorkflowStorageObject } from "@comfytavern/types";
import { useNodeStore } from "@/stores/nodeStore";

// Frontend-specific function types that need to be passed to the isomorphic transformer
type GetSlotDefinitionFunc = (node: VueFlowNode, handleId: string, type: 'source' | 'target') => any;
type GetEdgeStylePropsFunc = (sourceType: string, targetType: string, isDark: boolean) => any;


/**
 * 适配器函数，用于在前端环境中扁平化工作流，展开所有 NodeGroup。
 * 它将 VueFlow 的数据结构转换为通用的存储格式，调用核心的同构扁平化工具，然后再将结果转换回 VueFlow 格式。
 *
 * @param internalId - 标签页 ID (用于加载子工作流)。
 * @param initialElements - 初始的顶层 VueFlow 元素。
 * @param workflowDataHandler - `useWorkflowData` 的实例，用于加载工作流数据。
 * @param projectStore - `useProjectStore` 的实例。
 * @param getSlotDefinitionFunc - 一个用于解析插槽定义的函数 (来自 useSlotDefinitionHelper)。
 * @param getEdgeStylePropsFunc - 一个用于获取边样式的函数 (来自 useEdgeStyles)。
 * @returns 包含扁平化节点和边的对象，或在错误时返回 null。
 */
export async function flattenWorkflow(
  internalId: string,
  initialElements: (VueFlowNode | VueFlowEdge)[],
  workflowDataHandler: ReturnType<typeof useWorkflowData>,
  projectStore: ReturnType<typeof useProjectStore>,
  getSlotDefinitionFunc: GetSlotDefinitionFunc,
  getEdgeStylePropsFunc: GetEdgeStylePropsFunc,
): Promise<{ nodes: VueFlowNode[], edges: VueFlowEdge[] } | null> {
  console.debug(`[Flatten Adapter START] internalId: ${internalId}, processing ${initialElements.length} elements.`);

  const nodeStore = useNodeStore();
  const nodeDefinitionsMap = new Map<string, NodeDefinition>(
    nodeStore.nodeDefinitions?.map((def) => [`${def.namespace}:${def.type}`, def]) ?? []
  );

  // 1. 将 VueFlow 元素转换为通用的存储格式
  const { nodes: storageNodes, edges: storageEdges } = transformVueFlowToStorage({
    nodes: initialElements.filter(el => !('source' in el)) as VueFlowNode[],
    edges: initialElements.filter(el => 'source' in el) as VueFlowEdge[],
  }, nodeDefinitionsMap);

  const initialStorageWorkflow = { nodes: storageNodes, edges: storageEdges };

  // 2. 实现一个符合 WorkflowLoader 接口的前端加载器
  const workflowLoader: WorkflowLoader = async (workflowId: string): Promise<WorkflowStorageObject | null> => {
    const projectId = projectStore.currentProjectId;
    if (!projectId) {
      console.error(`[WorkflowLoader] Cannot load workflow ${workflowId}: Project ID is missing.`);
      return null;
    }
    console.debug(`[WorkflowLoader] Loading workflow ${workflowId} from project ${projectId}`);
    const { success, loadedData } = await workflowDataHandler.loadWorkflow(internalId, projectId, workflowId);
    if (!success || !loadedData) {
      console.error(`[WorkflowLoader] Failed to load workflow ${workflowId}.`);
      return null;
    }
    return loadedData;
  };

  try {
    // 3. 调用核心的同构扁平化函数
    const flattenedStorageWorkflow = await flattenStorageWorkflow(
      initialStorageWorkflow,
      workflowLoader,
      nodeDefinitionsMap
    );

    if (!flattenedStorageWorkflow) {
      console.error('[Flatten Adapter] Core flattenStorageWorkflow returned null.');
      return null;
    }

    console.debug(`[Flatten Adapter] Core logic returned ${flattenedStorageWorkflow.nodes.length} nodes and ${flattenedStorageWorkflow.edges.length} edges.`);

    // 4. 将扁平化后的存储格式转换回 VueFlow 格式
    const getEdgeStylePropsAdapter = (sourceType: string, targetType: string) => {
       const isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
       return getEdgeStylePropsFunc(sourceType, targetType, isDark);
    };

    const result = await transformStorageToVueFlow(
        flattenedStorageWorkflow,
        nodeDefinitionsMap,
        workflowLoader,
        getSlotDefinitionFunc, // This function signature should be compatible
        getEdgeStylePropsAdapter
    );

    const { nodes, edges } = result.flowData;

    console.debug(`[Flatten Adapter END] Returning ${nodes.length} nodes and ${edges.length} edges.`);
    return { nodes, edges };

  } catch (error) {
    console.error('[Flatten Adapter] An error occurred during the flattening process:', error);
    return null;
  }
}