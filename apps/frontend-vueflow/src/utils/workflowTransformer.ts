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
  let firstNodeLoggedForInputsDebug = false; // <--- 添加这个标志

  const nodes = flow.nodes.map((vueNode: VueFlowNode): WorkflowStorageNode => {
    const nodeType = vueNode.type; // Store type for safe access

    // +++ 添加调试日志 +++
    if (
      !firstNodeLoggedForInputsDebug &&
      nodeType &&
      nodeType !== "core:GroupInput" &&
      nodeType !== "core:GroupOutput"
    ) {
      console.log(
        `[Roo Debug transformVueFlowToCoreWorkflow] Inputs for node ${vueNode.id} (${vueNode.type}):`,
        JSON.parse(JSON.stringify(vueNode.data?.inputs)) // 使用 JSON.parse(JSON.stringify(...)) 来深拷贝并避免响应式代理问题
      );
      firstNodeLoggedForInputsDebug = true;
    }
    // +++ 结束调试日志 +++
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
      nodeType !== "core:GroupOutput"
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

          // --- Roo: Attempt type coercion for comparison and saving ---
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
          // --- End Roo: Type Coercion ---

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

    // --- Roo: Add logging AFTER the loop ---
    console.log(
      `[Debug Save Final] Node: ${vueNode.id} (${vueNode.type})`,
      `| Final inputValues Object: ${JSON.stringify(inputValues)}`,
      `| Object.keys(inputValues).length > 0: ${Object.keys(inputValues).length > 0}`
    );
    // --- End Roo: Logging ---

    // Prepare custom slot descriptions
    const customSlotDescriptions: {
      inputs?: Record<string, string>;
      outputs?: Record<string, string>;
    } = {};
    const customInputSlotDescriptions: Record<string, string> = {};
    const customOutputSlotDescriptions: Record<string, string> = {};

    // Check input slot descriptions
    if (nodeDef.inputs && vueNode.data?.inputs) {
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
    if (nodeDef.outputs && vueNode.data?.outputs) {
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
 * @param isDark 当前是否为暗黑模式
 * @param getEdgeStylePropsFunc 用于获取边样式的函数
 * @returns 包含 flowData 和 viewport 的对象
 */
export function transformWorkflowToVueFlow(
  workflow: WorkflowStorageObject, // <-- 接收 Storage 类型
  isDark: boolean,
  getEdgeStylePropsFunc: GetEdgeStylePropsFunc
): { flowData: FlowExportObject; viewport: SharedViewport } {
  const nodeStore = useNodeStore(); // 获取 Node Store 实例
  // 使用完整的类型标识符 (namespace:type) 作为 Map 的键
  const nodeDefinitionsMap = new Map<string, NodeDefinition>(
    nodeStore.nodeDefinitions?.map((def) => [`${def.namespace}:${def.type}`, def]) ?? []
  );

  const nodes: VueFlowNode[] = workflow.nodes.map(
    (storageNode: WorkflowStorageNode): VueFlowNode => {
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

      // 初始化 VueFlow 节点数据，包含定义中的 inputs 和 outputs
      const vueFlowData: Record<string, any> = {
        ...nodeDef, // 复制基础定义属性 (包括默认 description)
        inputs: {}, // 初始化为空对象，稍后填充值和描述
        outputs: {}, // 初始化为空对象，稍后填充描述
        configValues: storageNode.configValues || {}, // 应用存储的配置值
        // 确定节点描述
        defaultDescription: nodeDef.description || "",
        description: storageNode.customDescription || nodeDef.description || "", // 最终显示的描述
      };

      // 填充 input 值
      if (nodeDef.inputs) {
        Object.entries(nodeDef.inputs).forEach(([inputName, inputDef]) => {
          const effectiveDefault = getEffectiveDefaultValue(inputDef);
          const storedValue = storageNode.inputValues?.[inputName];
          // 如果存储了值，则使用存储的值；否则使用有效默认值
          const finalValue = storedValue !== undefined ? storedValue : effectiveDefault;
          // 注意：这里我们直接将最终值赋给 vueFlowData.inputs[inputName]
          // Vue Flow 节点组件内部（例如 useNodeState）会处理这个 data.inputs
          // vueFlowData.inputs[inputName] = finalValue; // 旧的赋值方式
          // 创建包含值和描述的对象
          const defaultSlotDesc = inputDef.description || "";
          const customSlotDesc = storageNode.customSlotDescriptions?.inputs?.[inputName];
          const displaySlotDesc = customSlotDesc || defaultSlotDesc;
          vueFlowData.inputs[inputName] = {
            value: finalValue, // 存储最终值
            description: displaySlotDesc, // 存储最终显示的描述
            defaultDescription: defaultSlotDesc, // 存储默认描述
            // 保留原始定义中的其他属性，以便 BaseNode 访问 (如 type, config 等)
            ...inputDef,
          };
        });
      }

      // NodeGroup 的接口处理：NodeGroup 组件自身会处理接口加载和同步
      // 我们只需要确保 configValues 中的 referencedWorkflowId 被传递
      if (vueFlowData.type === "core:NodeGroup") {
        const referencedWorkflowId = vueFlowData.configValues?.referencedWorkflowId;
        if (referencedWorkflowId) {
          console.debug(
            `[transformWorkflowToVueFlow] NodeGroup ${storageNode.id} references workflow ${referencedWorkflowId}. Interface will be handled by the component.`
          );
        } else {
          console.warn(
            `[transformWorkflowToVueFlow] NodeGroup ${storageNode.id} is missing referencedWorkflowId in configValues.`
          );
        }
      }

      // 填充 output 描述 (Outputs 通常没有值，只有定义和描述)
      if (nodeDef.outputs) {
        Object.entries(nodeDef.outputs).forEach(([outputName, outputDef]) => {
          const defaultSlotDesc = outputDef.description || "";
          const customSlotDesc = storageNode.customSlotDescriptions?.outputs?.[outputName];
          const displaySlotDesc = customSlotDesc || defaultSlotDesc;
          vueFlowData.outputs[outputName] = {
            description: displaySlotDesc, // 存储最终显示的描述
            defaultDescription: defaultSlotDesc, // 存储默认描述
            // 保留原始定义中的其他属性
            ...outputDef,
          };
        });
      }

      // NodeGroup 的接口处理：NodeGroup 组件自身会处理接口加载和同步
      // 我们只需要确保 configValues 中的 referencedWorkflowId 被传递
      if (vueFlowData.type === "core:NodeGroup") {
        const referencedWorkflowId = vueFlowData.configValues?.referencedWorkflowId;
        if (referencedWorkflowId) {
          console.debug(
            `[transformWorkflowToVueFlow] NodeGroup ${storageNode.id} references workflow ${referencedWorkflowId}. Interface will be handled by the component.`
          );
        } else {
          console.warn(
            `[transformWorkflowToVueFlow] NodeGroup ${storageNode.id} is missing referencedWorkflowId in configValues.`
          );
        }
      }

      // 确定默认标签 (使用不同的变量名以避免冲突)
      const nodeDefaultLabel = nodeDef.displayName || storageNode.type;
      // 确定最终显示的标签 (优先使用自定义标签)
      const nodeDisplayLabel = storageNode.customLabel || nodeDefaultLabel;

      // 将默认标签存入 data 以便 tooltip 使用
      vueFlowData.defaultLabel = nodeDefaultLabel;

      const vueFlowNodeObject: VueFlowNode = {
        id: storageNode.id, // <-- 使用 storageNode 的 ID
        type: storageNode.type,
        position: storageNode.position,
        data: vueFlowData, // <-- 使用填充好的数据 (现在包含 defaultLabel, defaultDescription, 以及插槽的描述)
        width: storageNode.size?.width, // 应用存储的大小
        height: storageNode.size?.height,
        // zIndex is not part of WorkflowStorageNode, removed assignment
        label: nodeDisplayLabel, // 应用最终确定的显示标签
      };

      // 处理 inputConnectionOrders
      if (storageNode.inputConnectionOrders) {
        // vueFlowData 应该总是被初始化的，但为了安全起见，我们检查一下
        if (!vueFlowNodeObject.data) {
          vueFlowNodeObject.data = {};
        }
        vueFlowNodeObject.data.inputConnectionOrders = storageNode.inputConnectionOrders;
      }

      return vueFlowNodeObject;
    }
  );

  // 创建一个节点 ID 到 VueFlowNode 的映射，方便查找边连接的节点
  const vueFlowNodesMap = new Map<string, VueFlowNode>(nodes.map((n) => [n.id, n]));

  const edges: VueFlowEdge[] = workflow.edges.map(
    (storageEdge: WorkflowStorageEdge): VueFlowEdge => {
      const sourceNode = vueFlowNodesMap.get(storageEdge.source);
      const targetNode = vueFlowNodesMap.get(storageEdge.target);

      let sourceType = "any";
      let targetType = "any";

      // 确定源类型
      if (sourceNode && storageEdge.sourceHandle) {
        // 检查是否为 GroupInput (其输出定义在 workflow.interfaceInputs)
        if (sourceNode.type === "core:GroupInput") {
          const interfaceInputDef = workflow.interfaceInputs?.[storageEdge.sourceHandle];
          if (interfaceInputDef) sourceType = interfaceInputDef.dataFlowType || "any";
        }
        // 检查是否为 NodeGroup (其输出定义在 data.groupInterface.outputs)
        else if (sourceNode.type === "core:NodeGroup" && sourceNode.data?.groupInterface?.outputs) {
          const outputDef = sourceNode.data.groupInterface.outputs[storageEdge.sourceHandle];
          if (outputDef) sourceType = outputDef.dataFlowType || "any"; // <--- Roo: 修正属性名
        }
        // 检查是否为普通节点 (其输出定义在 data.outputs)
        // 注意：现在 data.outputs[handle] 存储的是包含类型的对象
        else if (sourceNode.data?.outputs?.[storageEdge.sourceHandle]) {
          const outputData = sourceNode.data.outputs[storageEdge.sourceHandle];
          // 从 outputData 对象中获取类型
          if (outputData && typeof outputData === "object" && outputData.dataFlowType) { // <--- Roo: 修正属性名
            sourceType = outputData.dataFlowType;
          }
        }
      }
      if (sourceType === "any") {
        console.warn(
          `[transformWorkflowToVueFlow] Cannot determine specific source type for edge ${storageEdge.id} (source: ${storageEdge.source}::${storageEdge.sourceHandle}). Defaulting to 'any'.`
        );
      }

      // 确定目标类型
      if (targetNode && storageEdge.targetHandle) {
        // 检查是否为 GroupOutput (其输入定义在 workflow.interfaceOutputs)
        if (targetNode.type === "core:GroupOutput") {
          const interfaceOutputDef = workflow.interfaceOutputs?.[storageEdge.targetHandle];
          if (interfaceOutputDef) targetType = interfaceOutputDef.dataFlowType || "any";
        }
        // 检查是否为 NodeGroup (其输入定义在 data.groupInterface.inputs)
        else if (targetNode.type === "core:NodeGroup" && targetNode.data?.groupInterface?.inputs) {
          const inputDef = targetNode.data.groupInterface.inputs[storageEdge.targetHandle];
          if (inputDef) targetType = inputDef.dataFlowType || "any"; // <--- Roo: 修正属性名
        }
        // 检查是否为普通节点 (其输入定义在 data.inputs)
        // 注意：现在 data.inputs[handle] 存储的是包含类型和值的对象
        else if (targetNode.data?.inputs?.[storageEdge.targetHandle]) {
          const inputData = targetNode.data.inputs[storageEdge.targetHandle];
          // 从 inputData 对象中获取类型
          if (inputData && typeof inputData === "object" && inputData.dataFlowType) { // <--- Roo: 修正属性名
            targetType = inputData.dataFlowType;
          }
          // 旧的查找方式，现在不再需要，因为类型已直接存储
          // const targetNodeType = targetNode.type;
          // if (targetNodeType) {
          //   const targetNodeDef = nodeDefinitionsMap.get(targetNodeType);
          //   const inputDef = targetNodeDef?.inputs?.[storageEdge.targetHandle ?? ''];
          //   if (inputDef) targetType = inputDef.type || 'any';
          // } else {
          //    console.warn(`[transformWorkflowToVueFlow] Target node ${targetNode.id} has no type. Cannot determine target handle type.`);
          // }
        }
      }
      if (targetType === "any") {
        console.warn(
          `[transformWorkflowToVueFlow] Cannot determine specific target type for edge ${storageEdge.id} (target: ${storageEdge.target}::${storageEdge.targetHandle}). Defaulting to 'any'.`
        );
      }

      // 使用传入的函数获取样式
      const {
        animated: edgeAnimated,
        style: edgeStyle,
        markerEnd: finalMarkerEnd,
      } = getEdgeStylePropsFunc(sourceType, targetType, isDark);

      return {
        id: storageEdge.id, // <-- 使用 storageEdge 的 ID
        source: storageEdge.source,
        target: storageEdge.target,
        sourceHandle: storageEdge.sourceHandle, // <-- 使用 storageEdge 的 handle
        targetHandle: storageEdge.targetHandle, // <-- 使用 storageEdge 的 handle
        type: "default", // 默认边类型，可以根据需要调整
        label: storageEdge.label, // 应用存储的标签
        data: {
          // 存储推断出的类型信息，可能有用
          sourceType: sourceType,
          targetType: targetType,
        },
        animated: edgeAnimated,
        style: edgeStyle,
        markerEnd: finalMarkerEnd,
      };
    }
  );

  // Add null check for viewport
  const viewport: SharedViewport = {
    x: workflow.viewport?.x ?? 0,
    y: workflow.viewport?.y ?? 0,
    zoom: workflow.viewport?.zoom ?? 1,
  };

  const flowData: FlowExportObject = {
    nodes: nodes,
    edges: edges,
    position: [viewport.x, viewport.y], // 保持兼容性
    zoom: viewport.zoom,
    viewport: {
      // 使用标准 viewport 结构
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

    const inputValues: Record<string, any> = {};
    // 检查 vueNode.data 和 vueNode.data.inputs 是否存在，并且不是 GroupOutput 节点
    if (nodeDef.inputs && vueNode.data?.inputs && nodeType !== "core:GroupOutput") {
      Object.entries(vueNode.data.inputs).forEach(([inputName, inputData]) => {
        // For execution payload, we expect inputData to be the value itself or an object containing value
        const currentValue =
          typeof inputData === "object" && inputData !== null && "value" in inputData
            ? inputData.value
            : inputData;
        const inputDef = nodeDef.inputs?.[inputName];
        if (inputDef) {
          const effectiveDefault = getEffectiveDefaultValue(inputDef);
          // 进行深比较，仅当当前值与有效默认值不同时才包含
          if (!isEqual(currentValue, effectiveDefault)) {
            inputValues[inputName] = currentValue;
          }
        } else {
          console.warn(
            `[transformVueFlowToExecutionPayload] Node ${vueNode.id} (${vueNode.type}): Input '${inputName}' found in data but not in definition. Skipping inclusion for this input.`
          );
        }
      });
    }

    const execNode: ExecutionNode = {
      id: vueNode.id, // 使用 VueFlow 节点的 ID
      fullType: nodeType, // Use the safe nodeType variable
      // 仅当 inputValues 不为空时才包含它
      ...(Object.keys(inputValues).length > 0 && { inputValues }),
      // 包含 configValues (如果存在且不为空)
      ...(vueNode.data?.configValues &&
        Object.keys(vueNode.data.configValues).length > 0 && {
          configValues: vueNode.data.configValues,
        }),
    };

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
