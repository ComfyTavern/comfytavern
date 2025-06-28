import type { FlowExportObject, Node as VueFlowNode } from "@vue-flow/core";
import {
  type WorkflowStorageObject,
  type WorkflowStorageNode,
  type WorkflowStorageEdge,
  type WorkflowViewport as SharedViewport,
  type NodeDefinition,
  type WorkflowExecutionPayload,
  WorkflowStorageNodeSchema, // +
  WorkflowStorageEdgeSchema, // +
} from "@comfytavern/types";
import { z } from 'zod'; // +
import {
  transformVueFlowToStorage,
  transformStorageToVueFlow,
  transformStorageToExecutionPayload,
  extractGroupInterface as extractGroupInterfaceFromUtils,
  type WorkflowLoader,
} from "@comfytavern/utils";
import { useNodeStore } from "@/stores/nodeStore";
import { useSlotDefinitionHelper } from "@/composables/node/useSlotDefinitionHelper";
import type { Node as VueFlowNodeType, Edge as VueFlowEdgeType } from '@vue-flow/core';
import { getEffectiveDefaultValue } from "@comfytavern/utils";
import { klona } from "klona";

// Re-export for local usage if needed, or just use the imported one directly.
export const extractGroupInterface = extractGroupInterfaceFromUtils;

// --- Frontend-specific Type Definitions ---
export const WORKFLOW_FRAGMENT_SOURCE = "ComfyTavernWorkflowFragment";
export const WORKFLOW_FRAGMENT_VERSION = "1.0";

// 用 Zod 定义剪贴板片段的数据结构，以实现更安全的解析
export const WorkflowFragmentDataSchema = z.object({
  nodes: z.array(WorkflowStorageNodeSchema),
  edges: z.array(WorkflowStorageEdgeSchema),
});
export type WorkflowFragmentData = z.infer<typeof WorkflowFragmentDataSchema>;

export const SerializedWorkflowFragmentSchema = z.object({
  source: z.literal(WORKFLOW_FRAGMENT_SOURCE),
  version: z.string(),
  data: WorkflowFragmentDataSchema,
});
export type SerializedWorkflowFragment = z.infer<typeof SerializedWorkflowFragmentSchema>;

type GetEdgeStylePropsFunc = (
  sourceType: string,
  targetType: string,
  isDark: boolean
) => {
  animated: boolean;
  style: Record<string, any>;
  markerEnd: any;
};

// --- Caching for Frontend ---
let _definitionsMapCache: Map<string, NodeDefinition> | null = null;
let _lastDefinitions: readonly NodeDefinition[] | undefined = undefined;

function getNodeDefinitionsMap(): Map<string, NodeDefinition> {
  const nodeStore = useNodeStore();
  const currentDefs = nodeStore.nodeDefinitions;
  if (!_definitionsMapCache || _lastDefinitions !== currentDefs) {
    _lastDefinitions = currentDefs;
    _definitionsMapCache = new Map<string, NodeDefinition>(
      currentDefs?.map((def) => [`${def.namespace}:${def.type}`, def]) ?? []
    );
  }
  return _definitionsMapCache;
}

/**
 * (ADAPTER) Transforms Vue Flow data to a core workflow object for saving.
 * This is a frontend-specific adapter that uses the isomorphic `transformVueFlowToStorage`.
 */
export function transformVueFlowToCoreWorkflow(flow: FlowExportObject): {
  nodes: WorkflowStorageNode[];
  edges: WorkflowStorageEdge[];
  viewport: SharedViewport;
  referencedWorkflows: string[];
} {
  const nodeDefinitionsMap = getNodeDefinitionsMap();

  // 根据用户反馈，UI节点（如分组框）也应该被持久化以保存画布布局。
  // isUiNode 标志的目的是告诉执行器跳过它，而不是在保存时丢弃它。
  // 因此，我们不再过滤掉 isUiNode 为 true 的节点。后端需要能够处理这些没有执行逻辑的节点类型。
  const { nodes, edges, referencedWorkflows } = transformVueFlowToStorage(
    flow, // 直接传递完整的 flow 对象，包含所有节点
    nodeDefinitionsMap
  );

  return {
    nodes,
    edges,
    viewport: { x: flow.viewport.x, y: flow.viewport.y, zoom: flow.viewport.zoom },
    referencedWorkflows,
  };
}

/**
 * (ADAPTER) Transforms a storage object to a Vue Flow graph.
 * This is a frontend-specific adapter that prepares dependencies for the isomorphic `transformStorageToVueFlow`.
 */
export async function transformWorkflowToVueFlow(
  workflow: WorkflowStorageObject,
  workflowLoader: WorkflowLoader,
  getEdgeStylePropsFunc: GetEdgeStylePropsFunc
): Promise<{ flowData: FlowExportObject; viewport: SharedViewport }> {
  const nodeDefinitionsMap = getNodeDefinitionsMap();
  const { getSlotDefinition } = useSlotDefinitionHelper();

  // Frontend-specific adapter for getSlotDefinition
  const getSlotDefinitionAdapter = (
    node: VueFlowNode,
    handleId: string,
    type: "source" | "target"
  ) => {
    // The 'workflow as any' is a concession to the fact that the helper might need the full frontend state.
    return getSlotDefinition(node, handleId, type, workflow as any);
  };

  // Frontend-specific adapter for getEdgeStyleProps
  const getEdgeStylePropsAdapter = (sourceType: string, targetType: string) => {
    const isDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    // Note: The original `getEdgeStylePropsFunc` from `useEdgeStyles` takes `isDark` as its third argument.
    // We adapt the call here to include it.
    return getEdgeStylePropsFunc(sourceType, targetType, isDark);
  };

  return transformStorageToVueFlow(
    workflow,
    nodeDefinitionsMap,
    workflowLoader,
    getSlotDefinitionAdapter,
    getEdgeStylePropsAdapter // Pass the adapted function
  );
}

/**
 * (ADAPTER) Transforms core workflow data to an execution payload.
 */
export function transformVueFlowToExecutionPayload(
  coreWorkflow: { nodes: WorkflowStorageNode[]; edges: WorkflowStorageEdge[] }
): WorkflowExecutionPayload {
  return transformStorageToExecutionPayload(coreWorkflow);
}

/**
 * Serializes a fragment of a workflow into a JSON string for the clipboard.
 */
export function serializeWorkflowFragment(
  nodesToSerialize: VueFlowNodeType[],
  edgesToSerialize: VueFlowEdgeType[]
): string | null {
  const nodeDefinitionsMap = getNodeDefinitionsMap();
  try {
    const { nodes, edges } = transformVueFlowToStorage(
      { nodes: nodesToSerialize, edges: edgesToSerialize },
      nodeDefinitionsMap
    );

    const fragment: SerializedWorkflowFragment = {
      source: WORKFLOW_FRAGMENT_SOURCE,
      version: WORKFLOW_FRAGMENT_VERSION,
      data: {
        nodes: nodes.map(n => WorkflowStorageNodeSchema.parse(n)),
        edges: edges.map(e => WorkflowStorageEdgeSchema.parse(e)),
      },
    };
    return JSON.stringify(fragment);
  } catch (error) {
    console.error("Error serializing workflow fragment:", error);
    return null;
  }
}

/**
 * Deserializes a JSON string from the clipboard into VueFlow nodes and edges.
 * This uses a simplified, synchronous transformation logic suitable for fragments.
 */
export function deserializeWorkflowFragment(
  jsonString: string
): { nodes: VueFlowNodeType[]; edges: VueFlowEdgeType[] } | null {
  try {
    const parsedJson = JSON.parse(jsonString);
    const validationResult = SerializedWorkflowFragmentSchema.safeParse(parsedJson);

    if (!validationResult.success) {
      console.warn("Invalid workflow fragment format in clipboard.", validationResult.error);
      return null;
    }

    const fragmentData = validationResult.data.data;
    const nodeDefinitionsMap = getNodeDefinitionsMap();

    const vueFlowNodes: VueFlowNodeType[] = fragmentData.nodes.map((storageNode) => {
        const nodeDef = nodeDefinitionsMap.get(storageNode.type);
        if (!nodeDef) {
            return { id: storageNode.id, type: 'error', position: storageNode.position, label: `Error: Unknown Type` } as VueFlowNodeType;
        }

        // Simplified, synchronous data population for fragments
        const vueFlowData: Record<string, any> = {
            ...nodeDef,
            configValues: klona(storageNode.configValues || {}),
            defaultDescription: nodeDef.description || "",
            description: storageNode.customDescription || nodeDef.description || "",
            inputs: {},
            outputs: {},
            displayName: storageNode.displayName || nodeDef.displayName,
            defaultLabel: nodeDef.displayName || storageNode.type,
        };

        if (nodeDef.inputs) {
            Object.entries(nodeDef.inputs).forEach(([inputName, inputDef]) => {
                const effectiveDefault = getEffectiveDefaultValue(inputDef);
                const storedValue = storageNode.inputValues?.[inputName];
                vueFlowData.inputs[inputName] = {
                    value: storedValue !== undefined ? klona(storedValue) : klona(effectiveDefault),
                    ...inputDef,
                };
            });
        }
        if (nodeDef.outputs) {
            Object.entries(nodeDef.outputs).forEach(([outputName, outputDef]) => {
                vueFlowData.outputs[outputName] = { ...outputDef };
            });
        }

        return {
            id: storageNode.id,
            type: storageNode.type,
            position: storageNode.position,
            data: vueFlowData,
            label: vueFlowData.displayName,
            width: storageNode.width,
            height: storageNode.height,
            parentNode: storageNode.parentNode, // +++ 确保在反序列化时也处理 parentNode
        } as VueFlowNodeType;
    });

    const vueFlowEdges: VueFlowEdgeType[] = fragmentData.edges.map((storageEdge) => ({
      id: storageEdge.id,
      source: storageEdge.source,
      target: storageEdge.target,
      sourceHandle: storageEdge.sourceHandle,
      targetHandle: storageEdge.targetHandle,
      label: storageEdge.label,
      data: {},
    } as VueFlowEdgeType));

    return { nodes: vueFlowNodes, edges: vueFlowEdges };

  } catch (error) {
    console.error("Error deserializing workflow fragment:", error);
    return null;
  }
}
