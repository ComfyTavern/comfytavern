// apps/frontend-vueflow/src/utils/workflowTransformer.ts
import type { FlowExportObject, Node as VueFlowNode, Edge as VueFlowEdge } from "@vue-flow/core";
import type {
  WorkflowStorageObject, // <-- 使用新的 Storage 类型
  WorkflowStorageNode,
  WorkflowStorageEdge,
  GroupInterfaceInfo,
  WorkflowViewport as SharedViewport,
  NodeDefinition, // <-- 导入 NodeDefinition
  // InputDefinition, // “InputDefinition”已声明，但从未使用过。
} from "@comfytavern/types";
import type {
  WorkflowExecutionPayload, // <-- 新增：执行载荷类型
  ExecutionNode, // <-- 新增：执行节点类型
  ExecutionEdge, // <-- 新增：执行边类型
} from "@comfytavern/types";
import { getEffectiveDefaultValue } from "@comfytavern/utils"; // <-- 导入默认值工具
import { useNodeStore } from "@/stores/nodeStore"; // <-- 导入 Node Store
import isEqual from "lodash-es/isEqual"; // <-- 导入深比较函数

// 辅助函数类型定义 (从 useEdgeStyles.ts 导入)
type GetEdgeStylePropsFunc = (
  sourceType: string,
  targetType: string,
  isDark: boolean
) => {
  animated: boolean;
  style: Record<string, any>;
  markerEnd: any; // 根据实际类型调整
};

/**
 * 将 Vue Flow 导出的数据转换为后端 WorkflowObject 所需的核心数据结构。
 * (不包括 ID、名称、项目 ID 和时间戳等元数据)
 * @param flow Vue Flow 导出的对象
 * @returns 包含节点、边和视口的核心工作流数据
 */
export function transformVueFlowToCoreWorkflow(flow: FlowExportObject): {
  nodes: WorkflowStorageNode[];
  edges: WorkflowStorageEdge[];
  viewport: SharedViewport;
} {
  const nodeStore = useNodeStore(); // 获取 Node Store 实例
  // 使用完整的类型标识符 (namespace:type) 作为 Map 的键
  const nodeDefinitionsMap = new Map<string, NodeDefinition>(
    nodeStore.nodeDefinitions?.map((def) => [`${def.namespace}:${def.type}`, def]) ?? []
  );

  const nodes = flow.nodes.map((vueNode: VueFlowNode): WorkflowStorageNode => {
    const nodeType = vueNode.type; // Store type for safe access

    if (!nodeType) {
      console.error(
        `[transformVueFlowToCoreWorkflow] Node with ID ${vueNode.id} has no type defined. Skipping.`
      );
      // 返回一个不包含 label 的错误节点对象
      return { id: vueNode.id, type: "error", position: vueNode.position };
    }
    const nodeDef = nodeDefinitionsMap.get(nodeType);
    if (!nodeDef) {
      console.error(
        `[transformVueFlowToCoreWorkflow] 找不到类型为 ${nodeType} (ID: ${vueNode.id}) 的节点定义，将跳过此节点。`
      );
      // 返回一个不包含 label 的错误节点对象
      return { id: vueNode.id, type: "error", position: vueNode.position };
    }

    const inputValues: Record<string, any> = {};
    // 检查 vueNode.data 和 vueNode.data.inputs 是否存在，并且不是 GroupInput 或 GroupOutput 节点 (它们的 inputs/outputs 代表接口，不存值)
    if (
      nodeDef.inputs &&
      vueNode.data?.inputs &&
      nodeType !== "core:GroupInput" &&
      nodeType !== "core:GroupOutput" &&
      nodeType !== "core:NodeGroup" // 阻止为 NodeGroup 提取 inputValues
    ) {
      Object.entries(vueNode.data.inputs).forEach(([inputName, inputData]) => {
        // inputData is now an object { value: ..., description: ..., ... }
        const inputDef = nodeDef.inputs?.[inputName];
        if (
          inputDef &&
          typeof inputData === "object" &&
          inputData !== null &&
          "value" in inputData
        ) {
          const currentValue = inputData.value; // Get the actual value from UI state
          const effectiveDefault = getEffectiveDefaultValue(inputDef);

          let valueToSave = currentValue;
          let valueToCompare = currentValue;

          // --- Attempt type coercion for comparison and saving ---
          try {
            if (inputDef.dataFlowType === 'INTEGER') {
              const parsedInt = parseInt(String(currentValue), 10);
              if (!isNaN(parsedInt)) {
                valueToCompare = parsedInt;
                valueToSave = parsedInt; // Save as number
              } else if (currentValue !== "" && currentValue !== null) {
                // Don't warn for empty strings/null converting to NaN
                console.warn(
                  `[transformVueFlowToCoreWorkflow] Node ${vueNode.id} (${vueNode.type}): Input '${inputName}' (dataFlowType INTEGER) could not be parsed as integer:`,
                  currentValue
                );
              }
            } else if (inputDef.dataFlowType === 'FLOAT') {
              const parsedFloat = parseFloat(String(currentValue));
              if (!isNaN(parsedFloat)) {
                valueToCompare = parsedFloat;
                valueToSave = parsedFloat; // Save as number
              } else if (currentValue !== "" && currentValue !== null) {
                // Don't warn for empty strings/null converting to NaN
                console.warn(
                  `[transformVueFlowToCoreWorkflow] Node ${vueNode.id} (${vueNode.type}): Input '${inputName}' (dataFlowType FLOAT) could not be parsed as float:`,
                  currentValue
                );
              }
            }
            // Add cases for BOOLEAN or other types if needed, though isEqual often handles boolean strings okay.
          } catch (e) {
            console.error(
              `[transformVueFlowToCoreWorkflow] Error during type coercion for input '${inputName}' on node ${vueNode.id}:`,
              e
            );
          }
          // --- End Type Coercion ---

          // Compare potentially coerced value with the default
          if (!isEqual(valueToCompare, effectiveDefault)) {
            inputValues[inputName] = valueToSave; // Save the potentially coerced value
          }
        } else if (!inputDef) {
          // 如果在定义中找不到输入，可能意味着数据陈旧或不一致，可以选择记录警告
          console.warn(
            `[transformVueFlowToCoreWorkflow] Node ${vueNode.id} (${vueNode.type}): Input '${inputName}' found in data but not in definition. Skipping save for this input.`
          );
        } else {
          console.warn(
            `[transformVueFlowToCoreWorkflow] Node ${vueNode.id} (${vueNode.type}): Input '${inputName}' data structure unexpected. Skipping save for this input. Data:`,
            inputData
          );
        }
      }); // End of Object.entries loop for inputs
    } // End of if (nodeDef.inputs && ...)


    // Prepare custom slot descriptions
    const customSlotDescriptions: {
      inputs?: Record<string, string>;
      outputs?: Record<string, string>;
    } = {};
    const customInputSlotDescriptions: Record<string, string> = {};
    const customOutputSlotDescriptions: Record<string, string> = {};

    // Check input slot descriptions
    if (nodeDef.inputs && vueNode.data?.inputs && nodeType !== "core:NodeGroup") { // 阻止为 NodeGroup 提取 customSlotDescriptions
      Object.entries(vueNode.data.inputs).forEach(([inputName, inputData]) => {
        // inputData now contains the description object
        if (typeof inputData === "object" && inputData !== null && "description" in inputData) {
          const currentDesc = inputData.description;
          const defaultDesc = nodeDef.inputs?.[inputName]?.description || "";
          // Ensure currentDesc is a string before assigning
          if (typeof currentDesc === "string" && currentDesc && currentDesc !== defaultDesc) {
            customInputSlotDescriptions[inputName] = currentDesc;
          }
        }
      });
      if (Object.keys(customInputSlotDescriptions).length > 0) {
        customSlotDescriptions.inputs = customInputSlotDescriptions;
      }
    }

    // Check output slot descriptions
    if (nodeDef.outputs && vueNode.data?.outputs && nodeType !== "core:NodeGroup") { // 阻止为 NodeGroup 提取 customSlotDescriptions
      Object.entries(vueNode.data.outputs).forEach(([outputName, outputData]) => {
        // outputData now contains the description object
        if (typeof outputData === "object" && outputData !== null && "description" in outputData) {
          const currentDesc = outputData.description;
          const defaultDesc = nodeDef.outputs?.[outputName]?.description || "";
          // Ensure currentDesc is a string before assigning
          if (typeof currentDesc === "string" && currentDesc && currentDesc !== defaultDesc) {
            customOutputSlotDescriptions[outputName] = currentDesc;
          }
        }
      });
      if (Object.keys(customOutputSlotDescriptions).length > 0) {
        customSlotDescriptions.outputs = customOutputSlotDescriptions;
      }
    }

    const storageNode: WorkflowStorageNode = {
      id: vueNode.id, // 确保使用 VueFlow 节点的 ID (应该是 nanoid)
      type: nodeType, // Use the safe nodeType variable
      position: vueNode.position,
      // 仅当 inputValues 不为空时才包含它
      ...(Object.keys(inputValues).length > 0 && { inputValues }),
      // 保存 configValues (如果存在且不为空)
      ...(vueNode.data?.configValues &&
        Object.keys(vueNode.data.configValues).length > 0 && {
        configValues: vueNode.data.configValues,
      }),
      // 保存 size (如果存在)
      ...(vueNode.width !== undefined &&
        vueNode.height !== undefined && { size: { width: vueNode.width, height: vueNode.height } }),
      // 保存 customLabel (如果存在且非默认)
      ...(vueNode.label &&
        vueNode.label !== (nodeDef.displayName || nodeDef.type) && { customLabel: vueNode.label }),
      // 保存 customDescription (如果存在且非默认)
      ...(vueNode.data?.description &&
        vueNode.data.description !== (nodeDef.description || "") && {
        customDescription: vueNode.data.description,
      }),
      // 保存 customSlotDescriptions (如果存在且不为空)
      ...(Object.keys(customSlotDescriptions).length > 0 && { customSlotDescriptions }),
      // zIndex is not part of WorkflowStorageNode, removed assignment
      // 旧的 label 字段不再保存
    };

    // 处理 inputConnectionOrders
    if (vueNode.data?.inputConnectionOrders) {
      storageNode.inputConnectionOrders = vueNode.data.inputConnectionOrders;
    }


    return storageNode;
  });

  const edges = flow.edges.map((vueEdge: VueFlowEdge): WorkflowStorageEdge => {
    // 边只需要核心属性
    return {
      id: vueEdge.id, // 确保使用 VueFlow 边的 ID (应该是 nanoid)
      source: vueEdge.source,
      target: vueEdge.target,
      sourceHandle: vueEdge.sourceHandle ?? "", // Ensure string
      targetHandle: vueEdge.targetHandle ?? "", // Ensure string
      // 可选：如果边有标签且为字符串，也可以保存
      ...(typeof vueEdge.label === "string" && vueEdge.label && { label: vueEdge.label }),
    };
  });

  const viewport: SharedViewport = {
    x: flow.viewport.x,
    y: flow.viewport.y,
    zoom: flow.viewport.zoom,
  };

  return {
    nodes,
    edges,
    viewport,
  };
}

/**
 * 将从后端加载的 WorkflowObject 转换为 Vue Flow 可以直接使用的格式。
 * @param workflow 从后端加载的工作流对象
 * @param projectId 当前项目的 ID
 * @param isDark 当前是否为暗黑模式
 * @param getEdgeStylePropsFunc 用于获取边样式的函数
 * @param loadWorkflowByIdFunc 一个函数，用于根据 projectId 和 workflowId 加载工作流数据
 * @returns 包含 flowData 和 viewport 的对象 Promise
 */
export async function transformWorkflowToVueFlow( // <--- 标记为 async
  workflow: WorkflowStorageObject,
  projectId: string, // <--- 新增 projectId
  isDark: boolean,
  getEdgeStylePropsFunc: GetEdgeStylePropsFunc,
  loadWorkflowByIdFunc: ( // <--- 新增加载函数参数
    pId: string,
    wfId: string
  ) => Promise<WorkflowStorageObject | null>
): Promise<{ flowData: FlowExportObject; viewport: SharedViewport }> { // <--- 返回 Promise
  const nodeStore = useNodeStore();
  const nodeDefinitionsMap = new Map<string, NodeDefinition>(
    nodeStore.nodeDefinitions?.map((def) => [`${def.namespace}:${def.type}`, def]) ?? []
  );

  // 阶段 1: 处理节点并异步加载 NodeGroup 接口
  const nodes: VueFlowNode[] = await Promise.all( // <--- await Promise.all
    workflow.nodes.map(async (storageNode: WorkflowStorageNode): Promise<VueFlowNode> => { // <--- async map callback, returns Promise<VueFlowNode>
      const nodeDef = nodeDefinitionsMap.get(storageNode.type);
      if (!nodeDef) {
        console.error(
          `[transformWorkflowToVueFlow] 找不到类型为 ${storageNode.type} (ID: ${storageNode.id}) 的节点定义，将跳过此节点。`
        );
        return {
          id: storageNode.id,
          type: "error",
          position: storageNode.position,
          label: `Error: Unknown Type ${storageNode.type}`,
        } as VueFlowNode;
      }

      const vueFlowData: Record<string, any> = {
        ...nodeDef,
        inputs: {},
        outputs: {},
        configValues: storageNode.configValues || {},
        defaultDescription: nodeDef.description || "",
        description: storageNode.customDescription || nodeDef.description || "",
      };

      if (nodeDef.inputs) {
        Object.entries(nodeDef.inputs).forEach(([inputName, inputDef]) => {
          const effectiveDefault = getEffectiveDefaultValue(inputDef);
          const storedValue = storageNode.inputValues?.[inputName];
          const finalValue = storedValue !== undefined ? storedValue : effectiveDefault;
          const defaultSlotDesc = inputDef.description || "";
          const customSlotDesc = storageNode.customSlotDescriptions?.inputs?.[inputName];
          const displaySlotDesc = customSlotDesc || defaultSlotDesc;
          vueFlowData.inputs[inputName] = {
            value: finalValue,
            description: displaySlotDesc,
            defaultDescription: defaultSlotDesc,
            ...inputDef,
          };
        });
      }

      if (nodeDef.outputs) {
        Object.entries(nodeDef.outputs).forEach(([outputName, outputDef]) => {
          const defaultSlotDesc = outputDef.description || "";
          const customSlotDesc = storageNode.customSlotDescriptions?.outputs?.[outputName];
          const displaySlotDesc = customSlotDesc || defaultSlotDesc;
          vueFlowData.outputs[outputName] = {
            description: displaySlotDesc,
            defaultDescription: defaultSlotDesc,
            ...outputDef,
          };
        });
      }

      // NodeGroup 的接口处理：异步加载并填充 groupInterface
      if (storageNode.type === "core:NodeGroup") {
        const referencedWorkflowId = vueFlowData.configValues?.referencedWorkflowId as string | undefined;
        if (referencedWorkflowId) {
          console.debug(
            `[transformWorkflowToVueFlow] NodeGroup ${storageNode.id} references workflow ${referencedWorkflowId}. Attempting to load its interface...`
          );
          try {
            const referencedWorkflowData = await loadWorkflowByIdFunc(projectId, referencedWorkflowId);
            if (referencedWorkflowData) {
              const groupInterface = extractGroupInterface(referencedWorkflowData);
              vueFlowData.groupInterface = groupInterface; // 填充 groupInterface
              console.debug(
                `[transformWorkflowToVueFlow] NodeGroup ${storageNode.id} interface loaded and applied:`,
                JSON.parse(JSON.stringify(groupInterface))
              );
            } else {
              console.warn(
                `[transformWorkflowToVueFlow] NodeGroup ${storageNode.id}: Referenced workflow ${referencedWorkflowId} could not be loaded. Interface will be empty.`
              );
              vueFlowData.groupInterface = { inputs: {}, outputs: {} }; // 设置空接口以避免后续错误
            }
          } catch (error) {
            console.error(
              `[transformWorkflowToVueFlow] NodeGroup ${storageNode.id}: Error loading referenced workflow ${referencedWorkflowId}:`,
              error
            );
            vueFlowData.groupInterface = { inputs: {}, outputs: {} }; // 设置空接口
          }
        } else {
          console.warn(
            `[transformWorkflowToVueFlow] NodeGroup ${storageNode.id} is missing referencedWorkflowId in configValues. Interface will be empty.`
          );
          vueFlowData.groupInterface = { inputs: {}, outputs: {} }; // 设置空接口
        }
      }

      const nodeDefaultLabel = nodeDef.displayName || storageNode.type;
      const nodeDisplayLabel = storageNode.customLabel || nodeDefaultLabel;
      vueFlowData.defaultLabel = nodeDefaultLabel;

      const vueFlowNodeObject: VueFlowNode = {
        id: storageNode.id,
        type: storageNode.type,
        position: storageNode.position,
        data: vueFlowData,
        width: storageNode.size?.width,
        height: storageNode.size?.height,
        label: nodeDisplayLabel,
      };

      if (storageNode.inputConnectionOrders) {
        if (!vueFlowNodeObject.data) vueFlowNodeObject.data = {};
        vueFlowNodeObject.data.inputConnectionOrders = storageNode.inputConnectionOrders;
      }

      return vueFlowNodeObject;
    })
  );

  // 阶段 2: 处理边 (此时 NodeGroup 的 groupInterface 应该已填充)
  const vueFlowNodesMap = new Map<string, VueFlowNode>(nodes.map((n) => [n.id, n]));

  const edges: VueFlowEdge[] = workflow.edges.map(
    (storageEdge: WorkflowStorageEdge): VueFlowEdge => {
      const sourceNode = vueFlowNodesMap.get(storageEdge.source);
      const targetNode = vueFlowNodesMap.get(storageEdge.target);

      let sourceType = "any";
      let targetType = "any";

      // 确定源类型
      if (sourceNode && storageEdge.sourceHandle) {
        if (sourceNode.type === "core:GroupInput") {
          const interfaceInputDef = workflow.interfaceInputs?.[storageEdge.sourceHandle];
          if (interfaceInputDef) sourceType = interfaceInputDef.dataFlowType || "any";
        } else if (sourceNode.type === "core:NodeGroup") {
          // 现在 sourceNode.data.groupInterface 应该存在了
          if (sourceNode.data?.groupInterface?.outputs) {
            const outputDef = sourceNode.data.groupInterface.outputs[storageEdge.sourceHandle];
            if (outputDef && outputDef.dataFlowType) {
              sourceType = outputDef.dataFlowType;
            } else if (outputDef) {
              console.warn(`[transformWorkflowToVueFlow] NodeGroup ${sourceNode.id} (source for edge ${storageEdge.id}) output handle '${storageEdge.sourceHandle}' found in groupInterface.outputs, but 'dataFlowType' is missing or invalid. Defaulting to 'any'. OutputDef:`, JSON.stringify(outputDef));
              sourceType = "any";
            } else {
              console.warn(`[transformWorkflowToVueFlow] NodeGroup ${sourceNode.id} (source for edge ${storageEdge.id}) has 'groupInterface.outputs', but handle '${storageEdge.sourceHandle}' not found. Available output handles: ${sourceNode.data.groupInterface.outputs ? Object.keys(sourceNode.data.groupInterface.outputs).join(', ') : 'outputs not available'}. Defaulting to 'any'.`);
              sourceType = "any";
            }
          } else {
            console.warn(`[transformWorkflowToVueFlow] NodeGroup ${sourceNode.id} (source for edge ${storageEdge.id}) is missing 'data.groupInterface.outputs' or 'data.groupInterface' itself after async load. Data:`, JSON.stringify(sourceNode.data), `. Defaulting to 'any'.`);
            sourceType = "any";
          }
        } else if (sourceNode.data?.outputs?.[storageEdge.sourceHandle]) {
          const outputData = sourceNode.data.outputs[storageEdge.sourceHandle];
          if (outputData && typeof outputData === "object" && outputData.dataFlowType) {
            sourceType = outputData.dataFlowType;
          }
        }
      }
      if (sourceType === "any" && sourceNode && storageEdge.sourceHandle) {
        console.warn(
          `[transformWorkflowToVueFlow] FINAL CHECK: Cannot determine specific source type for edge ${storageEdge.id} (source: ${storageEdge.source}::${storageEdge.sourceHandle}). Defaulting to 'any'.`
        );
      }

      // 确定目标类型
      if (targetNode && storageEdge.targetHandle) {
        if (targetNode.type === "core:GroupOutput") {
          const interfaceOutputDef = workflow.interfaceOutputs?.[storageEdge.targetHandle];
          if (interfaceOutputDef && interfaceOutputDef.dataFlowType) {
            targetType = interfaceOutputDef.dataFlowType;
          } else if (interfaceOutputDef) {
            console.warn(`[transformWorkflowToVueFlow] GroupOutput ${targetNode.id} (target for edge ${storageEdge.id}) input handle '${storageEdge.targetHandle}' found in workflow.interfaceOutputs, but 'dataFlowType' is missing or invalid. Defaulting to 'any'. InterfaceOutputDef:`, JSON.stringify(interfaceOutputDef));
            targetType = "any";
          } else {
            targetType = "any";
          }
        } else if (targetNode.type === "core:NodeGroup") {
          // 现在 targetNode.data.groupInterface 应该存在了
          if (targetNode.data?.groupInterface?.inputs) {
            const inputDef = targetNode.data.groupInterface.inputs[storageEdge.targetHandle];
            if (inputDef && inputDef.dataFlowType) {
              targetType = inputDef.dataFlowType;
            } else if (inputDef) {
              console.warn(`[transformWorkflowToVueFlow] NodeGroup ${targetNode.id} (target for edge ${storageEdge.id}) input handle '${storageEdge.targetHandle}' found in groupInterface.inputs, but 'dataFlowType' is missing or invalid. Defaulting to 'any'. InputDef:`, JSON.stringify(inputDef));
              targetType = "any";
            } else {
              console.warn(`[transformWorkflowToVueFlow] NodeGroup ${targetNode.id} (target for edge ${storageEdge.id}) has 'groupInterface.inputs', but handle '${storageEdge.targetHandle}' not found. Available input handles: ${targetNode.data.groupInterface.inputs ? Object.keys(targetNode.data.groupInterface.inputs).join(', ') : 'inputs not available'}. Defaulting to 'any'.`);
              targetType = "any";
            }
          } else {
            console.warn(`[transformWorkflowToVueFlow] NodeGroup ${targetNode.id} (target for edge ${storageEdge.id}) is missing 'data.groupInterface.inputs' or 'data.groupInterface' itself after async load. Data:`, JSON.stringify(targetNode.data), `. Defaulting to 'any'.`);
            targetType = "any";
          }
        } else if (targetNode.data?.inputs) {
          const fullTargetHandle = storageEdge.targetHandle;
          const handleParts = fullTargetHandle.split('__');
          const baseHandleName = handleParts[0];
          if (baseHandleName && Object.prototype.hasOwnProperty.call(targetNode.data.inputs, baseHandleName)) {
            const inputData = targetNode.data.inputs[baseHandleName];
            if (typeof inputData === "object" && inputData.dataFlowType) {
              targetType = inputData.dataFlowType;
            }
          }
        }
      }
      if (targetType === "any" && targetNode && storageEdge.targetHandle) {
        console.warn(
          `[transformWorkflowToVueFlow] FINAL CHECK: Cannot determine specific target type for edge ${storageEdge.id} (target: ${storageEdge.target}::${storageEdge.targetHandle}). Defaulting to 'any'. Source Type: ${sourceType}`
        );
      }

      const {
        animated: edgeAnimated,
        style: edgeStyle,
        markerEnd: finalMarkerEnd,
      } = getEdgeStylePropsFunc(sourceType, targetType, isDark);

      return {
        id: storageEdge.id,
        source: storageEdge.source,
        target: storageEdge.target,
        sourceHandle: storageEdge.sourceHandle,
        targetHandle: storageEdge.targetHandle,
        type: "default",
        label: storageEdge.label,
        data: {
          sourceType: sourceType,
          targetType: targetType,
        },
        animated: edgeAnimated,
        style: edgeStyle,
        markerEnd: finalMarkerEnd,
      };
    }
  );

  const viewport: SharedViewport = {
    x: workflow.viewport?.x ?? 0,
    y: workflow.viewport?.y ?? 0,
    zoom: workflow.viewport?.zoom ?? 1,
  };

  const flowData: FlowExportObject = {
    nodes: nodes, // nodes is now an array of resolved VueFlowNode objects
    edges: edges,
    position: [viewport.x, viewport.y],
    zoom: viewport.zoom,
    viewport: {
      x: viewport.x,
      y: viewport.y,
      zoom: viewport.zoom,
    },
  };

  return { flowData, viewport };
}

/**
 * 从工作流定义中提取组接口的辅助函数。
 * @param groupData 从后端加载的完整工作流对象 (通常是作为 Group 使用的工作流)
 * @returns 提取出的组接口信息
 */
export function extractGroupInterface(groupData: WorkflowStorageObject): GroupInterfaceInfo {
  // <-- 接收 Storage 类型
  // 直接从加载的工作流对象的顶层属性获取接口信息
  const inputs = groupData.interfaceInputs || {};
  const outputs = groupData.interfaceOutputs || {};
  console.debug(
    `[extractGroupInterface] Extracted from top-level: Inputs:`,
    JSON.parse(JSON.stringify(inputs)),
    `Outputs:`,
    JSON.parse(JSON.stringify(outputs))
  );
  const groupInterface: GroupInterfaceInfo = { inputs, outputs };
  console.debug(
    "[extractGroupInterface] Extracted Interface:",
    JSON.stringify(groupInterface, null, 2)
  );
  return groupInterface;
}
/**
 * 将当前的 Vue Flow 状态转换为后端执行引擎所需的 WorkflowExecutionPayload 格式。
 * @param flow Vue Flow 导出的对象或当前状态
 * @returns 符合 WorkflowExecutionPayload 结构的对象
 */
export function transformVueFlowToExecutionPayload(
  flow: { nodes: VueFlowNode[]; edges: VueFlowEdge[] } // 可以接收 FlowExportObject 或仅包含 nodes/edges 的对象
): WorkflowExecutionPayload {
  const nodeStore = useNodeStore(); // 获取 Node Store 实例
  // 使用完整的类型标识符 (namespace:type) 作为 Map 的键
  const nodeDefinitionsMap = new Map<string, NodeDefinition>(
    nodeStore.nodeDefinitions?.map((def) => [`${def.namespace}:${def.type}`, def]) ?? []
  );

  const executionNodes: ExecutionNode[] = flow.nodes.map((vueNode: VueFlowNode): ExecutionNode => {
    const nodeType = vueNode.type; // Store type for safe access
    if (!nodeType) {
      console.error(
        `[transformVueFlowToExecutionPayload] Node with ID ${vueNode.id} has no type defined. Skipping.`
      );
      return { id: vueNode.id, fullType: "error", inputs: {}, configValues: {} };
    }
    const nodeDef = nodeDefinitionsMap.get(nodeType); // Use safe nodeType
    if (!nodeDef) {
      // 在实际执行时，可能需要更健壮的错误处理，例如抛出错误或返回特定错误节点
      console.error(
        `[transformVueFlowToExecutionPayload] 找不到类型为 ${nodeType} (ID: ${vueNode.id}) 的节点定义，将跳过此节点。`
      ); // Use safe nodeType
      // 返回一个最小化的表示，或者根据策略抛出错误
      return { id: vueNode.id, fullType: "error", inputs: {}, configValues: {} };
    }

    const executionInputValues: Record<string, any> = {};
    // 直接从 vueNode.inputValues (即 StorageNode.inputValues) 获取输入值
    // vueNode 在这里实际上是 StorageNode 结构 (或兼容结构)
    if (nodeDef.inputs && (vueNode as any).inputValues) {
      Object.entries((vueNode as any).inputValues).forEach(([inputName, storedValue]) => {
        const inputDef = nodeDef.inputs?.[inputName];
        if (inputDef) {
          const effectiveDefault = getEffectiveDefaultValue(inputDef);
          // 仅当存储的值与有效默认值不同时才包含
          if (!isEqual(storedValue, effectiveDefault)) {
            executionInputValues[inputName] = storedValue;
          }
        } else {
          // 这个警告仍然有效，因为 inputValues 中的键可能在定义中不存在
          console.warn(
            `[transformVueFlowToExecutionPayload] Node ${vueNode.id} (${vueNode.type}): Input '${inputName}' found in inputValues but not in definition. Skipping inclusion for this input.`
          );
        }
      });
    }

    const execNode: ExecutionNode = {
      id: vueNode.id,
      fullType: nodeType,
      // 仅当 executionInputValues 不为空时才包含它
      ...(Object.keys(executionInputValues).length > 0 && { inputs: executionInputValues }),
      // 直接从 vueNode.configValues (即 StorageNode.configValues) 获取配置值
      ...((vueNode as any).configValues &&
        Object.keys((vueNode as any).configValues).length > 0 && {
        configValues: (vueNode as any).configValues,
      }),
    };

    // 直接从 vueNode.inputConnectionOrders (即 StorageNode.inputConnectionOrders) 获取
    if ((vueNode as any).inputConnectionOrders && Object.keys((vueNode as any).inputConnectionOrders).length > 0) {
      execNode.inputConnectionOrders = (vueNode as any).inputConnectionOrders;
    }

    return execNode;
  });

  const executionEdges: ExecutionEdge[] = flow.edges.map((vueEdge: VueFlowEdge): ExecutionEdge => {
    // 执行边只需要核心连接信息
    return {
      id: vueEdge.id, // 使用 VueFlow 边的 ID
      sourceNodeId: vueEdge.source,
      targetNodeId: vueEdge.target,
      sourceHandle: vueEdge.sourceHandle ?? "", // Ensure string
      targetHandle: vueEdge.targetHandle ?? "", // Ensure string
    };
  });

  return {
    nodes: executionNodes,
    edges: executionEdges,
  };
}
