import type {
  WorkflowStorageObject,
  WorkflowStorageNode,
  WorkflowStorageEdge,
  NodeDefinition,
  WorkflowExecutionPayload,
  ExecutionNode,
  ExecutionEdge,
  GroupInterfaceInfo,
  WorkflowViewport,
} from "@comfytavern/types";
import { klona } from "klona";
import isEqual from "lodash-es/isEqual";
import { getEffectiveDefaultValue } from "./defaultValueUtils";

// Forward declaration for VueFlow types to avoid direct dependency
type VueFlowNode = any;
type VueFlowEdge = any;
type FlowExportObject = any;

/**
 * A function provided by the caller to load a workflow by its ID.
 * This allows the core logic to be decoupled from the data source (API, DB, etc.).
 */
export type WorkflowLoader = (
  workflowId: string
) => Promise<WorkflowStorageObject | null>;

function getNodeFullType(node: WorkflowStorageNode): string {
  return node.type;
}

// #region VueFlow <-> Storage Transformation Helpers

/**
 * Extracts the base properties from a VueFlow node to a WorkflowStorageNode.
 */
function _createBaseStorageNodeProperties(
  vueNode: VueFlowNode,
  nodeDef: NodeDefinition
): Pick<
  WorkflowStorageNode,
  | "id"
  | "type"
  | "position"
  | "configValues"
  | "width"
  | "height"
  | "displayName"
  | "customDescription"
  | "inputConnectionOrders"
> {
  const nodeType = vueNode.type as string;

  let finalDisplayName: string | undefined = undefined;
  const uiNameSource = vueNode.data?.displayName || vueNode.data?.label || vueNode.label;
  if (uiNameSource !== undefined && String(uiNameSource) !== String(nodeDef.displayName)) {
    finalDisplayName = String(uiNameSource);
  }

  let customDescription: string | undefined = undefined;
  if (vueNode.data?.description && vueNode.data.description !== (nodeDef.description || "")) {
    customDescription = vueNode.data.description;
  }

  const baseProperties: ReturnType<typeof _createBaseStorageNodeProperties> = {
    id: vueNode.id,
    type: nodeType,
    position: klona(vueNode.position),
  };

  if (vueNode.data?.configValues && Object.keys(vueNode.data.configValues).length > 0) {
    baseProperties.configValues = klona(vueNode.data.configValues);
  }
  if (vueNode.width !== undefined) {
    baseProperties.width = typeof vueNode.width === 'number' ? vueNode.width : parseFloat(vueNode.width);
  }
  if (vueNode.height !== undefined) {
    baseProperties.height = typeof vueNode.height === 'number' ? vueNode.height : parseFloat(vueNode.height);
  }
  if (finalDisplayName !== undefined) {
    baseProperties.displayName = finalDisplayName;
  }
  if (customDescription !== undefined) {
    baseProperties.customDescription = customDescription;
  }
  if (vueNode.data?.inputConnectionOrders) {
    baseProperties.inputConnectionOrders = klona(vueNode.data.inputConnectionOrders);
  }

  return baseProperties;
}

/**
 * Extracts input values from a VueFlow node for storage.
 */
function _extractInputValuesForStorage(
  vueNode: VueFlowNode,
  nodeDef: NodeDefinition
): Record<string, any> {
  const nodeType = vueNode.type as string;
  const inputValues: Record<string, any> = {};

  if (nodeType === "core:NodeGroup") {
    if (vueNode.data?.inputs) {
      Object.entries(vueNode.data.inputs).forEach(([inputName, inputData]: [string, any]) => {
        if (typeof inputData === "object" && inputData !== null && "value" in inputData) {
          inputValues[inputName] = klona(inputData.value);
        }
      });
    }
  } else if (nodeDef.inputs && vueNode.data?.inputs && nodeType !== "core:GroupInput" && nodeType !== "core:GroupOutput") {
    Object.entries(vueNode.data.inputs).forEach(([inputName, inputData]: [string, any]) => {
      const inputDef = nodeDef.inputs?.[inputName];
      if (inputDef && typeof inputData === "object" && inputData !== null && "value" in inputData) {
        const currentValue = inputData.value;
        const effectiveDefault = getEffectiveDefaultValue(inputDef);
        if (!isEqual(currentValue, effectiveDefault)) {
          inputValues[inputName] = klona(currentValue);
        }
      }
    });
  }
  return inputValues;
}

/**
 * Extracts custom slot descriptions from a VueFlow node for storage.
 */
function _extractCustomSlotDescriptionsForStorage(
  vueNode: VueFlowNode,
  nodeDef: NodeDefinition
): WorkflowStorageNode['customSlotDescriptions'] {
  const customSlotDescriptions: WorkflowStorageNode['customSlotDescriptions'] = {};

  if (nodeDef.inputs && vueNode.data?.inputs) {
    const customInputDescs: Record<string, string> = {};
    Object.entries(vueNode.data.inputs).forEach(([inputName, inputData]: [string, any]) => {
      if (typeof inputData === "object" && inputData !== null && "description" in inputData) {
        const currentDesc = inputData.description as string;
        const defaultDesc = nodeDef.inputs?.[inputName]?.description || "";
        if (currentDesc && currentDesc !== defaultDesc) {
          customInputDescs[inputName] = currentDesc;
        }
      }
    });
    if (Object.keys(customInputDescs).length > 0) {
      customSlotDescriptions.inputs = customInputDescs;
    }
  }

  if (nodeDef.outputs && vueNode.data?.outputs) {
    const customOutputDescs: Record<string, string> = {};
    Object.entries(vueNode.data.outputs).forEach(([outputName, outputData]: [string, any]) => {
      if (typeof outputData === "object" && outputData !== null && "description" in outputData) {
        const currentDesc = outputData.description as string;
        const defaultDesc = nodeDef.outputs?.[outputName]?.description || "";
        if (currentDesc && currentDesc !== defaultDesc) {
          customOutputDescs[outputName] = currentDesc;
        }
      }
    });
    if (Object.keys(customOutputDescs).length > 0) {
      customSlotDescriptions.outputs = customOutputDescs;
    }
  }

  if (Object.keys(customSlotDescriptions.inputs || {}).length > 0 || Object.keys(customSlotDescriptions.outputs || {}).length > 0) {
    return customSlotDescriptions;
  }
  return undefined;
}

/**
 * Creates the base `data` object for a VueFlow node from a storage node.
 */
function _createBaseVueFlowNodeData(
  storageNode: WorkflowStorageNode,
  nodeDef: NodeDefinition
): Record<string, any> {
  const vueFlowData: Record<string, any> = {
    ...nodeDef,
    configValues: klona(storageNode.configValues || {}),
    defaultDescription: nodeDef.description || "",
    description: storageNode.customDescription || nodeDef.description || "",
    inputs: {},
    outputs: {},
  };

  const nodeDefaultLabel = nodeDef.displayName || storageNode.type;
  vueFlowData.defaultLabel = nodeDefaultLabel;
  vueFlowData.displayName = storageNode.displayName || nodeDefaultLabel;

  if (storageNode.inputConnectionOrders) {
    vueFlowData.inputConnectionOrders = klona(storageNode.inputConnectionOrders);
  }
  return vueFlowData;
}

/**
 * Populates the `inputs` and `outputs` properties of a VueFlow node's data object.
 */
function _populateVueFlowNodeSlots(
  vueFlowData: Record<string, any>,
  storageNode: WorkflowStorageNode,
  nodeDef: NodeDefinition
): void {
  if (nodeDef.inputs) {
    Object.entries(nodeDef.inputs).forEach(([inputName, inputDef]) => {
      const effectiveDefault = getEffectiveDefaultValue(inputDef);
      const storedValue = storageNode.inputValues?.[inputName];
      const finalValue = storedValue !== undefined ? klona(storedValue) : klona(effectiveDefault);
      const defaultSlotDesc = inputDef.description || "";
      const customSlotDesc = storageNode.customSlotDescriptions?.inputs?.[inputName];
      vueFlowData.inputs[inputName] = {
        value: finalValue,
        description: customSlotDesc || defaultSlotDesc,
        defaultDescription: defaultSlotDesc,
        ...inputDef,
      };
    });
  }

  if (nodeDef.outputs) {
    Object.entries(nodeDef.outputs).forEach(([outputName, outputDef]) => {
      const defaultSlotDesc = outputDef.description || "";
      const customSlotDesc = storageNode.customSlotDescriptions?.outputs?.[outputName];
      vueFlowData.outputs[outputName] = {
        description: customSlotDesc || defaultSlotDesc,
        defaultDescription: defaultSlotDesc,
        ...outputDef,
      };
    });
  }
}

// #endregion

/**
 * Transforms a VueFlow graph into a serializable storage object.
 */
export function transformVueFlowToStorage(
  flow: { nodes: VueFlowNode[]; edges: VueFlowEdge[] },
  nodeDefinitionsMap: Map<string, NodeDefinition>
): {
  nodes: WorkflowStorageNode[];
  edges: WorkflowStorageEdge[];
  referencedWorkflows: string[];
} {
  const referencedWorkflowIds = new Set<string>();

  const nodes = flow.nodes.map((vueNode: VueFlowNode): WorkflowStorageNode => {
    const nodeType = vueNode.type;
    if (!nodeType) {
      throw new Error(`Node ID ${vueNode.id} has no type.`);
    }
    const nodeDef = nodeDefinitionsMap.get(nodeType);
    if (!nodeDef) {
      throw new Error(`No definition for type ${nodeType} (ID: ${vueNode.id}).`);
    }

    const baseProperties = _createBaseStorageNodeProperties(vueNode, nodeDef);
    const inputValues = _extractInputValuesForStorage(vueNode, nodeDef);
    const customSlotDescriptions = _extractCustomSlotDescriptionsForStorage(vueNode, nodeDef);

    const storageNode: WorkflowStorageNode = { ...baseProperties } as WorkflowStorageNode;

    if (Object.keys(inputValues).length > 0) {
      storageNode.inputValues = inputValues;
    }
    if (customSlotDescriptions) {
      storageNode.customSlotDescriptions = customSlotDescriptions;
    }

    if (nodeType === "core:NodeGroup" && vueNode.data?.configValues?.referencedWorkflowId) {
      referencedWorkflowIds.add(vueNode.data.configValues.referencedWorkflowId as string);
    }
    return storageNode;
  });

  const edges = flow.edges.map((vueEdge: VueFlowEdge): WorkflowStorageEdge => ({
    id: vueEdge.id,
    source: vueEdge.source,
    target: vueEdge.target,
    sourceHandle: vueEdge.sourceHandle ?? "",
    targetHandle: vueEdge.targetHandle ?? "",
    ...(typeof vueEdge.label === "string" && vueEdge.label && { label: vueEdge.label }),
  }));

  return {
    nodes,
    edges,
    referencedWorkflows: Array.from(referencedWorkflowIds),
  };
}

/**
 * Transforms a storage object into a VueFlow graph.
 * This is a complex function that requires frontend-specific helpers to be passed in.
 */
export async function transformStorageToVueFlow(
  workflow: { nodes: WorkflowStorageNode[], edges: WorkflowStorageEdge[], viewport?: WorkflowViewport },
  nodeDefinitionsMap: Map<string, NodeDefinition>,
  workflowLoader: WorkflowLoader,
  // Dependencies to be provided by the frontend caller
  getSlotDefinitionFunc: (node: VueFlowNode, handleId: string, type: 'source' | 'target') => any,
  getEdgeStylePropsFunc: (sourceType: string, targetType: string) => any
): Promise<{ flowData: FlowExportObject; viewport: WorkflowViewport }> {
  const workflowLoadCache = new Map<string, Promise<WorkflowStorageObject | null>>();
  const cachedLoadFunc = (wfId: string): Promise<WorkflowStorageObject | null> => {
    if (workflowLoadCache.has(wfId)) {
      return workflowLoadCache.get(wfId)!;
    }
    const promise = workflowLoader(wfId);
    workflowLoadCache.set(wfId, promise);
    return promise;
  };

  const nodes: VueFlowNode[] = await Promise.all(
    workflow.nodes.map(async (storageNode: WorkflowStorageNode): Promise<VueFlowNode> => {
      const nodeDef = nodeDefinitionsMap.get(storageNode.type);
      if (!nodeDef) {
        return {
          id: storageNode.id, type: "error", position: storageNode.position,
          label: `Error: Unknown Type ${storageNode.type}`,
        } as VueFlowNode;
      }

      const vueFlowData = _createBaseVueFlowNodeData(storageNode, nodeDef);
      if (storageNode.type !== "core:NodeGroup") {
        _populateVueFlowNodeSlots(vueFlowData, storageNode, nodeDef);
      } else {
        const referencedWorkflowId = vueFlowData.configValues?.referencedWorkflowId as string | undefined;
        if (referencedWorkflowId) {
          const referencedWorkflowData = await cachedLoadFunc(referencedWorkflowId);
          if (referencedWorkflowData) {
            const groupInterface = extractGroupInterface(referencedWorkflowData);
            vueFlowData.groupInterface = groupInterface;
            vueFlowData.inputs = {};
            vueFlowData.outputs = {};
            // Populate slots based on the loaded interface
            _populateVueFlowNodeSlots(vueFlowData, storageNode, { ...nodeDef, inputs: groupInterface.inputs || {}, outputs: groupInterface.outputs || {} });
          }
        }
      }

      return {
        id: storageNode.id, type: storageNode.type, position: storageNode.position,
        data: vueFlowData, width: storageNode.width, height: storageNode.height,
        label: vueFlowData.displayName,
      } as VueFlowNode;
    })
  );

  const vueFlowNodesMap = new Map<string, VueFlowNode>(nodes.map((n) => [n.id, n]));

  const edges: VueFlowEdge[] = workflow.edges.map((storageEdge: WorkflowStorageEdge): VueFlowEdge => {
    const sourceNode = vueFlowNodesMap.get(storageEdge.source);
    const targetNode = vueFlowNodesMap.get(storageEdge.target);
    let sourceType = "any", targetType = "any";

    if (sourceNode && storageEdge.sourceHandle) {
      const sourceSlotDef = getSlotDefinitionFunc(sourceNode, storageEdge.sourceHandle, 'source');
      if (sourceSlotDef?.dataFlowType) sourceType = sourceSlotDef.dataFlowType;
    }
    if (targetNode && storageEdge.targetHandle) {
      const targetSlotDef = getSlotDefinitionFunc(targetNode, storageEdge.targetHandle, 'target');
      if (targetSlotDef?.dataFlowType) targetType = targetSlotDef.dataFlowType;
    }

    const styleProps = getEdgeStylePropsFunc(sourceType, targetType);
    return {
      id: storageEdge.id, source: storageEdge.source, target: storageEdge.target,
      sourceHandle: storageEdge.sourceHandle, targetHandle: storageEdge.targetHandle,
      type: "default", label: storageEdge.label, data: { sourceType, targetType },
      ...styleProps,
    };
  });

  const viewport: WorkflowViewport = workflow.viewport ?? { x: 0, y: 0, zoom: 1 };

  return {
    flowData: { nodes, edges, position: [viewport.x, viewport.y], zoom: viewport.zoom, viewport },
    viewport,
  };
}

/**
 * Extracts the interface (inputs/outputs) from a workflow object, typically a group.
 */
export function extractGroupInterface(groupData: WorkflowStorageObject): GroupInterfaceInfo {
  return {
    inputs: groupData.interfaceInputs || {},
    outputs: groupData.interfaceOutputs || {},
  };
}


/**
 * Recursively flattens a workflow, expanding all NodeGroups.
 */
export async function flattenStorageWorkflow(
  initialWorkflow: { nodes: WorkflowStorageNode[], edges: WorkflowStorageEdge[] },
  workflowLoader: WorkflowLoader,
  nodeDefinitions: Map<string, NodeDefinition>,
  processedGroupIds: Set<string> = new Set()
): Promise<{ nodes: WorkflowStorageNode[]; edges: WorkflowStorageEdge[] } | null> {
  const flattenedNodes: WorkflowStorageNode[] = [];
  const flattenedEdges: WorkflowStorageEdge[] = [];
  const nodeMap = new Map<string, WorkflowStorageNode>();
  const edgeQueue: WorkflowStorageEdge[] = [...initialWorkflow.edges];

  for (const node of initialWorkflow.nodes) {
    nodeMap.set(node.id, node);
  }

  const nodesToExpand = Array.from(nodeMap.values());

  while (nodesToExpand.length > 0) {
    const node = nodesToExpand.shift();
    if (!node) continue;

    const nodeType = getNodeFullType(node);

    if (nodeType === "core:NodeGroup") {
      const referencedWorkflowId = node.configValues?.referencedWorkflowId as string | undefined;

      if (!referencedWorkflowId) {
        console.warn(`[Flatten] NodeGroup ${node.id} is missing referencedWorkflowId. Treating as a simple node.`);
        flattenedNodes.push(node);
        continue;
      }

      if (processedGroupIds.has(referencedWorkflowId)) {
        console.error(`[Flatten] Circular reference detected: Group ${referencedWorkflowId} is already being processed.`);
        continue;
      }

      const subWorkflow = await workflowLoader(referencedWorkflowId);
      if (!subWorkflow) {
        console.error(`[Flatten] Failed to load referenced workflow ${referencedWorkflowId} for NodeGroup ${node.id}.`);
        return null;
      }

      processedGroupIds.add(referencedWorkflowId);

      const flattenedSubWorkflow = await flattenStorageWorkflow(
        subWorkflow,
        workflowLoader,
        nodeDefinitions,
        new Set(processedGroupIds)
      );

      if (!flattenedSubWorkflow) {
        processedGroupIds.delete(referencedWorkflowId);
        return null;
      }

      if (node.inputValues && Object.keys(node.inputValues).length > 0) {
        const instanceInputValues = node.inputValues;
        const subNodes = flattenedSubWorkflow.nodes;
        let subEdges = flattenedSubWorkflow.edges;

        for (const subNode of subNodes) {
          if (getNodeFullType(subNode) === 'core:GroupInput') {
            const groupInputNode = subNode;
            const groupInputDef = nodeDefinitions.get('core:GroupInput');
            const outputSlotKeys = Object.keys(groupInputDef?.outputs || subWorkflow.interfaceInputs || {});

            for (const slotKey of outputSlotKeys) {
              if (instanceInputValues.hasOwnProperty(slotKey)) {
                const overrideValue = instanceInputValues[slotKey];
                const edgesToReplace = subEdges.filter(e => e.source === groupInputNode.id && e.sourceHandle === slotKey);

                subEdges = subEdges.filter(e => !(e.source === groupInputNode.id && e.sourceHandle === slotKey));

                for (const edge of edgesToReplace) {
                  const targetNode = subNodes.find(n => n.id === edge.target);
                  if (targetNode && edge.targetHandle) {
                    targetNode.inputValues = targetNode.inputValues || {};
                    targetNode.inputValues[edge.targetHandle] = klona(overrideValue);
                  }
                }
              }
            }
          }
        }
        flattenedSubWorkflow.edges = subEdges;
      }

      const internalNodesMap = new Map(flattenedSubWorkflow.nodes.map((n) => [n.id, n]));
      const internalGroupInput = flattenedSubWorkflow.nodes.find(n => getNodeFullType(n) === 'core:GroupInput');
      const internalGroupOutput = flattenedSubWorkflow.nodes.find(n => getNodeFullType(n) === 'core:GroupOutput');

      const incomingEdges = edgeQueue.filter((edge) => edge.target === node.id);
      for (const incomingEdge of incomingEdges) {
        if (!incomingEdge.targetHandle || !internalGroupInput) continue;
        const internalEdge = flattenedSubWorkflow.edges.find(
          (subEdge) => subEdge.source === internalGroupInput.id && subEdge.sourceHandle === incomingEdge.targetHandle
        );
        if (internalEdge) {
          flattenedEdges.push({
            ...incomingEdge,
            id: `${incomingEdge.id}_flat_${internalEdge.target}`,
            target: internalEdge.target,
            targetHandle: internalEdge.targetHandle,
          });
          const index = edgeQueue.findIndex((e) => e.id === incomingEdge.id);
          if (index > -1) edgeQueue.splice(index, 1);
        }
      }

      const outgoingEdges = edgeQueue.filter((edge) => edge.source === node.id);
      for (const outgoingEdge of outgoingEdges) {
        if (!outgoingEdge.sourceHandle || !internalGroupOutput) continue;
        const internalEdge = flattenedSubWorkflow.edges.find(
          (subEdge) => subEdge.target === internalGroupOutput.id && subEdge.targetHandle === outgoingEdge.sourceHandle
        );
        if (internalEdge) {
          flattenedEdges.push({
            ...outgoingEdge,
            id: `${outgoingEdge.id}_flat_${internalEdge.source}`,
            source: internalEdge.source,
            sourceHandle: internalEdge.sourceHandle,
          });
          const index = edgeQueue.findIndex((e) => e.id === outgoingEdge.id);
          if (index > -1) edgeQueue.splice(index, 1);
        }
      }

      flattenedNodes.push(
        ...flattenedSubWorkflow.nodes.filter(
          (n) => getNodeFullType(n) !== "core:GroupInput" && getNodeFullType(n) !== "core:GroupOutput"
        )
      );
      flattenedEdges.push(...flattenedSubWorkflow.edges.filter(edge => {
        const sourceNode = internalNodesMap.get(edge.source);
        const targetNode = internalNodesMap.get(edge.target);
        if (!sourceNode || !targetNode) return false;
        const sourceIsIO = getNodeFullType(sourceNode).startsWith('core:Group');
        const targetIsIO = getNodeFullType(targetNode).startsWith('core:Group');
        return !sourceIsIO && !targetIsIO;
      }));

      processedGroupIds.delete(referencedWorkflowId);
    } else {
      flattenedNodes.push(node);
    }
  }

  flattenedEdges.push(...edgeQueue);

  return { nodes: flattenedNodes, edges: flattenedEdges };
}

/**
 * Transforms a workflow from storage format to the execution payload format.
 */
export function transformStorageToExecutionPayload(workflow: {
  nodes: WorkflowStorageNode[];
  edges: WorkflowStorageEdge[];
}): WorkflowExecutionPayload {
  const executionNodes: ExecutionNode[] = workflow.nodes.map(
    (storageNode): ExecutionNode => {
      const execNode: ExecutionNode = {
        id: storageNode.id,
        fullType: storageNode.type,
      };
      if (storageNode.inputValues && Object.keys(storageNode.inputValues).length > 0) {
        execNode.inputs = storageNode.inputValues;
      }
      if (storageNode.configValues && Object.keys(storageNode.configValues).length > 0) {
        execNode.configValues = storageNode.configValues;
      }
      if (storageNode.inputConnectionOrders && Object.keys(storageNode.inputConnectionOrders).length > 0) {
        execNode.inputConnectionOrders = storageNode.inputConnectionOrders;
      }
      return execNode;
    }
  );

  const executionEdges: ExecutionEdge[] = workflow.edges.map(
    (storageEdge): ExecutionEdge => ({
      id: storageEdge.id,
      sourceNodeId: storageEdge.source,
      targetNodeId: storageEdge.target,
      sourceHandle: storageEdge.sourceHandle ?? "",
      targetHandle: storageEdge.targetHandle ?? "",
    })
  );

  return {
    nodes: executionNodes,
    edges: executionEdges,
  };
}