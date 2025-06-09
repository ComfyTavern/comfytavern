// apps/frontend-vueflow/src/utils/workflowTransformer.ts
import type { FlowExportObject, Node as VueFlowNode, Edge as VueFlowEdge } from "@vue-flow/core";
import type {
  WorkflowStorageObject, // <-- 使用新的 Storage 类型
  WorkflowStorageNode,
  WorkflowStorageEdge,
  GroupInterfaceInfo,
  WorkflowViewport as SharedViewport,
  NodeDefinition, // <-- 导入 NodeDefinition
  InputDefinition, // <-- 确保 InputDefinition 已导入 (已在 NodeDefinition 中，但显式导入更清晰)
  OutputDefinition, // <-- 新增导入 OutputDefinition
  WorkflowExecutionPayload, // <-- 新增：执行载荷类型
  ExecutionNode, // <-- 新增：执行节点类型
  ExecutionEdge, // <-- 新增：执行边类型
} from "@comfytavern/types";
import { getEffectiveDefaultValue } from "@comfytavern/utils"; // <-- 导入默认值工具
import { useNodeStore } from "@/stores/nodeStore"; // <-- 导入 Node Store
import { useSlotDefinitionHelper } from "@/composables/node/useSlotDefinitionHelper"; // 导入插槽定义辅助函数
import isEqual from "lodash-es/isEqual"; // <-- 导入深比较函数
import type { Node as VueFlowNodeType, Edge as VueFlowEdgeType } from '@vue-flow/core'; // 确保这些类型被导入, 重命名以避免与参数名冲突
import { klona } from 'klona'; // 用于深拷贝

export const WORKFLOW_FRAGMENT_SOURCE = "ComfyTavernWorkflowFragment";
export const WORKFLOW_FRAGMENT_VERSION = "1.0";

export interface WorkflowFragmentData {
  nodes: WorkflowStorageNode[];
  edges: WorkflowStorageEdge[];
}

export interface SerializedWorkflowFragment {
  source: typeof WORKFLOW_FRAGMENT_SOURCE;
  version: string;
  data: WorkflowFragmentData;
}

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
  referencedWorkflows: string[]; // <-- 新增：引用的工作流 ID 列表
} {
  const nodeStore = useNodeStore(); // 获取 Node Store 实例
  const referencedWorkflowIds = new Set<string>(); // <-- 新增：用于收集引用的工作流 ID


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

    let inputValues: Record<string, any> = {}; // 修改为 let 以允许重新赋值
    // 根据节点类型处理输入值，特别是 NodeGroup 的覆盖值

    if (nodeType === "core:NodeGroup") {
      // 新逻辑：直接从 vueNode.data.inputs[slotKey].value 保存 NodeGroup 的输入值
      // 不再与模板默认值比较，也不依赖 vueNode.data.inputValues
      if (vueNode.data?.inputs) {
        const groupInputValues: Record<string, any> = {};
        Object.entries(vueNode.data.inputs).forEach(([inputName, inputData]) => {
          // inputData 结构是 { value: ..., description: ..., ... }
          if (typeof inputData === "object" && inputData !== null && "value" in inputData) {
            // 直接克隆并保存当前值
            groupInputValues[inputName] = klona(inputData.value);
          } else {
            console.warn(
              `[transformVueFlowToCoreWorkflow] NodeGroup ${vueNode.id}: Input '${inputName}' data structure unexpected or 'value' missing. Skipping save for this input. Data:`,
              inputData
            );
          }
        });
        if (Object.keys(groupInputValues).length > 0) {
          inputValues = groupInputValues;
        }
      }
    } else if ( // 其他普通节点的处理逻辑
      nodeDef.inputs &&
      vueNode.data?.inputs &&
      nodeType !== "core:GroupInput" && // GroupInput/Output 的 inputs/outputs 代表接口, 不直接存储值
      nodeType !== "core:GroupOutput"
      // core:NodeGroup 已在上面的 if 分支中处理，此处无需重复检查
    ) {
      // 现有通用逻辑：从 vueNode.data.inputs 提取与默认值不同的输入值
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
    } // End of if/else if block for inputValues processing


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
      // 保存 width (如果存在)
      ...(vueNode.width !== undefined && { width: vueNode.width }),
      // 保存 height (如果存在)
      ...(vueNode.height !== undefined && { height: vueNode.height }),
      // 保存 displayName (如果存在且非默认)
      // 优先使用 vueNode.data.displayName，然后是 vueNode.data.label，最后是 vueNode.label
      // 确保 displayName 存储的是字符串类型
      ...(((vueNode.data?.displayName || vueNode.data?.label || vueNode.label) &&
        String(vueNode.data?.displayName || vueNode.data?.label || vueNode.label) !== String(nodeDef.displayName)) && { displayName: String(vueNode.data?.displayName || vueNode.data?.label || vueNode.label) }),
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

    // 如果是 NodeGroup 并且有引用的工作流 ID，则收集它
    if (nodeType === "core:NodeGroup" && vueNode.data?.configValues?.referencedWorkflowId) {
      referencedWorkflowIds.add(vueNode.data.configValues.referencedWorkflowId as string);
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
    referencedWorkflows: Array.from(referencedWorkflowIds), // <-- 新增：返回收集到的 ID
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

              // --- 为 NodeGroup 基于 groupInterface 构建 inputs 和 outputs ---
              // 清空可能由通用逻辑基于 NodeGroup 自身定义（而非模板）填充的 inputs/outputs
              vueFlowData.inputs = {};
              vueFlowData.outputs = {};

              if (vueFlowData.groupInterface?.inputs) {
                Object.entries(vueFlowData.groupInterface.inputs).forEach(
                  ([inputName, inputDefFromInterfaceUntyped]) => {
                    const inputDefFromInterface = inputDefFromInterfaceUntyped as InputDefinition; // 类型断言
                    const effectiveDefault = getEffectiveDefaultValue(inputDefFromInterface);
                    // storageNode.inputValues 包含的是此 NodeGroup 实例的覆盖值
                    const storedValue = storageNode.inputValues?.[inputName];
                    const finalValue = storedValue !== undefined ? storedValue : effectiveDefault;
                    const defaultSlotDesc = inputDefFromInterface.description || "";
                    const customSlotDesc = storageNode.customSlotDescriptions?.inputs?.[inputName];
                    const displaySlotDesc = customSlotDesc || defaultSlotDesc;

                    vueFlowData.inputs[inputName] = {
                      value: finalValue,
                      description: displaySlotDesc,
                      defaultDescription: defaultSlotDesc,
                      ...(inputDefFromInterface as object), // 使用类型断言确保是对象
                    };
                  }
                );
              }

              if (vueFlowData.groupInterface?.outputs) {
                Object.entries(vueFlowData.groupInterface.outputs).forEach(
                  ([outputName, outputDefFromInterfaceUntyped]) => {
                    const outputDefFromInterface = outputDefFromInterfaceUntyped as OutputDefinition; // 类型断言
                    const defaultSlotDesc = outputDefFromInterface.description || "";
                    const customSlotDesc = storageNode.customSlotDescriptions?.outputs?.[outputName];
                    const displaySlotDesc = customSlotDesc || defaultSlotDesc;

                    vueFlowData.outputs[outputName] = {
                      description: displaySlotDesc,
                      defaultDescription: defaultSlotDesc,
                      ...(outputDefFromInterface as object), // 使用类型断言确保是对象
                    };
                  }
                );
              }
              // --- NodeGroup inputs/outputs 构建结束 ---
            } else {
              console.warn(
                `[transformWorkflowToVueFlow] NodeGroup ${storageNode.id}: Referenced workflow ${referencedWorkflowId} could not be loaded. Interface will be empty.`
              );
              vueFlowData.groupInterface = { inputs: {}, outputs: {} }; // 设置空接口以避免后续错误
              vueFlowData.inputs = {}; // 确保 inputs 也为空
              vueFlowData.outputs = {}; // 确保 outputs 也为空
            }
          } catch (error) {
            console.error(
              `[transformWorkflowToVueFlow] NodeGroup ${storageNode.id}: Error loading referenced workflow ${referencedWorkflowId}:`,
              error
            );
            vueFlowData.groupInterface = { inputs: {}, outputs: {} }; // 设置空接口
            vueFlowData.inputs = {}; // 确保 inputs 也为空
            vueFlowData.outputs = {}; // 确保 outputs 也为空
          }
        } else {
          console.warn(
            `[transformWorkflowToVueFlow] NodeGroup ${storageNode.id} is missing referencedWorkflowId in configValues. Interface will be empty.`
          );
          vueFlowData.groupInterface = { inputs: {}, outputs: {} }; // 设置空接口
          vueFlowData.inputs = {}; // 确保 inputs 也为空
          vueFlowData.outputs = {}; // 确保 outputs 也为空
        }
      } else {
        // --- 这是针对非 NodeGroup 节点的现有 inputs/outputs 构建逻辑 ---
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
        // --- 非 NodeGroup 节点逻辑结束 ---
      }

      const nodeDefaultLabel = nodeDef.displayName || storageNode.type;
      // 如果存储中有 displayName，则使用它，否则使用默认标签
      const nodeDisplayLabel = storageNode.displayName || nodeDefaultLabel;
      vueFlowData.defaultLabel = nodeDefaultLabel;
      // 同时将 displayName 设置到 data 中，以便在画布上正确显示
      vueFlowData.displayName = nodeDisplayLabel;


      const vueFlowNodeObject: VueFlowNode = {
        id: storageNode.id,
        type: storageNode.type,
        position: storageNode.position,
        data: vueFlowData,
        width: storageNode.width, // 直接从 storageNode 读取 width
        height: storageNode.height, // 直接从 storageNode 读取 height
        label: nodeDisplayLabel, // 顶层 label 使用 displayName
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
  const { getSlotDefinition } = useSlotDefinitionHelper(); // 获取辅助函数

  const edges: VueFlowEdge[] = workflow.edges.map(
    (storageEdge: WorkflowStorageEdge): VueFlowEdge => {
      const sourceNode = vueFlowNodesMap.get(storageEdge.source);
      const targetNode = vueFlowNodesMap.get(storageEdge.target);

      let sourceType = "any";
      let targetType = "any";

      // 准备 workflowData 参数给 getSlotDefinition
      // 因为 getSlotDefinition 期望的 workflowData 包含 interfaceInputs/Outputs
      // 而这里的 workflow 是 WorkflowStorageObject，它直接在顶层有这些属性
      const workflowDataForSlotHelper = {
        interfaceInputs: workflow.interfaceInputs,
        interfaceOutputs: workflow.interfaceOutputs,
        // 其他 workflowData 属性如果 getSlotDefinition 需要的话，也应添加
        // 但目前 getSlotDefinition 主要依赖 interfaceInputs/Outputs
      };

      // 确定源类型
      if (sourceNode && storageEdge.sourceHandle) {
        const sourceSlotDef = getSlotDefinition(sourceNode, storageEdge.sourceHandle, 'source', workflowDataForSlotHelper as any); // 使用 as any 临时解决类型问题
        if (sourceSlotDef?.dataFlowType) {
          sourceType = sourceSlotDef.dataFlowType;
        } else if (sourceSlotDef) {
          console.warn(`[transformWorkflowToVueFlow] Node ${sourceNode.id} (source for edge ${storageEdge.id}) output handle '${storageEdge.sourceHandle}' found, but 'dataFlowType' is missing or invalid. Defaulting to 'any'. SlotDef:`, JSON.stringify(sourceSlotDef));
        } else {
          console.warn(`[transformWorkflowToVueFlow] Node ${sourceNode.id} (source for edge ${storageEdge.id}) output handle '${storageEdge.sourceHandle}' not found. Defaulting to 'any'.`);
        }
      }

      // 确定目标类型
      if (targetNode && storageEdge.targetHandle) {
        const targetSlotDef = getSlotDefinition(targetNode, storageEdge.targetHandle, 'target', workflowDataForSlotHelper as any); // 使用 as any 临时解决类型问题
        if (targetSlotDef?.dataFlowType) {
          targetType = targetSlotDef.dataFlowType;
        } else if (targetSlotDef) {
          console.warn(`[transformWorkflowToVueFlow] Node ${targetNode.id} (target for edge ${storageEdge.id}) input handle '${storageEdge.targetHandle}' found, but 'dataFlowType' is missing or invalid. Defaulting to 'any'. SlotDef:`, JSON.stringify(targetSlotDef));
        } else {
          console.warn(`[transformWorkflowToVueFlow] Node ${targetNode.id} (target for edge ${storageEdge.id}) input handle '${storageEdge.targetHandle}' not found. Defaulting to 'any'.`);
        }
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
  // console.debug(
  //   "[extractGroupInterface] Extracted Interface:",
  //   JSON.stringify(groupInterface, null, 2)
  // );
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

/**
 * Serializes a fragment of a workflow (selected nodes and edges) into a JSON string for clipboard.
 * 将工作流片段（选定的节点和边）序列化为 JSON 字符串，用于剪贴板。
 * @param nodesToSerialize Array of VueFlowNode objects to serialize.
 * @param edgesToSerialize Array of VueFlowEdge objects to serialize.
 * @returns JSON string representing the workflow fragment.
 */
export function serializeWorkflowFragment(
  nodesToSerialize: VueFlowNodeType[],
  edgesToSerialize: VueFlowEdgeType[]
): string | null {
  const nodeStore = useNodeStore();
  const nodeDefinitionsMap = new Map<string, NodeDefinition>(
    nodeStore.nodeDefinitions?.map((def) => [`${def.namespace}:${def.type}`, def]) ?? []
  );

  try {
    const storageNodes: WorkflowStorageNode[] = nodesToSerialize.map((vueNode) => {
      const nodeType = vueNode.type;
      if (!nodeType) {
        console.error(`[serializeWorkflowFragment] Node with ID ${vueNode.id} has no type defined.`);
        throw new Error(`Node ${vueNode.id} has no type.`);
      }
      const nodeDef = nodeDefinitionsMap.get(nodeType);
      if (!nodeDef) {
        console.error(`[serializeWorkflowFragment] Node definition not found for type ${nodeType} (ID: ${vueNode.id}).`);
        throw new Error(`Node definition not found for ${nodeType}.`);
      }

      const inputValues: Record<string, any> = {};
      if (
        nodeDef.inputs &&
        vueNode.data?.inputs &&
        nodeType !== "core:GroupInput" &&
        nodeType !== "core:GroupOutput" &&
        nodeType !== "core:NodeGroup"
      ) {
        Object.entries(vueNode.data.inputs).forEach(([inputName, inputData]) => {
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

      const customSlotDescriptions: WorkflowStorageNode['customSlotDescriptions'] = {};
      if (nodeDef.inputs && vueNode.data?.inputs) {
        const currentCustomInputDescs: Record<string, string> = {};
        Object.entries(vueNode.data.inputs).forEach(([inputName, inputData]) => {
          if (typeof inputData === "object" && inputData !== null && "description" in inputData) {
            const currentDesc = inputData.description as string;
            const defaultDesc = nodeDef.inputs?.[inputName]?.description || "";
            if (currentDesc && currentDesc !== defaultDesc) {
              currentCustomInputDescs[inputName] = currentDesc;
            }
          }
        });
        if (Object.keys(currentCustomInputDescs).length > 0) {
          customSlotDescriptions.inputs = currentCustomInputDescs;
        }
      }
      if (nodeDef.outputs && vueNode.data?.outputs) {
        const currentCustomOutputDescs: Record<string, string> = {};
        Object.entries(vueNode.data.outputs).forEach(([outputName, outputData]) => {
          if (typeof outputData === "object" && outputData !== null && "description" in outputData) {
            const currentDesc = outputData.description as string;
            const defaultDesc = nodeDef.outputs?.[outputName]?.description || "";
            if (currentDesc && currentDesc !== defaultDesc) {
              currentCustomOutputDescs[outputName] = currentDesc;
            }
          }
        });
        if (Object.keys(currentCustomOutputDescs).length > 0) {
          customSlotDescriptions.outputs = currentCustomOutputDescs;
        }
      }

      const sNode: WorkflowStorageNode = {
        id: vueNode.id,
        type: nodeType,
        position: klona(vueNode.position),
        ...(Object.keys(inputValues).length > 0 && { inputValues }),
        ...(vueNode.data?.configValues && Object.keys(vueNode.data.configValues).length > 0 && { configValues: klona(vueNode.data.configValues) }),
        ...(vueNode.width !== undefined && { width: vueNode.width }),
        ...(vueNode.height !== undefined && { height: vueNode.height }),
        ...(((vueNode.data?.displayName || vueNode.label) && String(vueNode.data?.displayName || vueNode.label) !== String(nodeDef.displayName)) && { displayName: String(vueNode.data?.displayName || vueNode.label) }),
        ...(vueNode.data?.description && vueNode.data.description !== (nodeDef.description || "") && { customDescription: vueNode.data.description }),
        ...(Object.keys(customSlotDescriptions).length > 0 && { customSlotDescriptions }),
        ...(vueNode.data?.inputConnectionOrders && { inputConnectionOrders: klona(vueNode.data.inputConnectionOrders) }),
      };
      return sNode;
    });

    const storageEdges: WorkflowStorageEdge[] = edgesToSerialize.map((vueEdge) => {
      return {
        id: vueEdge.id,
        source: vueEdge.source,
        target: vueEdge.target,
        sourceHandle: vueEdge.sourceHandle ?? "",
        targetHandle: vueEdge.targetHandle ?? "",
        label: typeof vueEdge.label === "string" && vueEdge.label ? vueEdge.label : undefined,
        // WorkflowStorageEdge does not have a 'data' field.
      };
    });

    const fragment: SerializedWorkflowFragment = {
      source: WORKFLOW_FRAGMENT_SOURCE,
      version: WORKFLOW_FRAGMENT_VERSION,
      data: {
        nodes: storageNodes,
        edges: storageEdges,
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
 * 将剪贴板中的 JSON 字符串反序列化为 VueFlow 节点和边。
 * Does not handle ID conflicts or apply styles; these are responsibilities of the caller.
 * 不处理 ID 冲突或应用样式；这些是调用者的责任。
 * @param jsonString The JSON string to deserialize.
 * @returns An object containing arrays of VueFlowNode and VueFlowEdge, or null if deserialization fails.
 */
export function deserializeWorkflowFragment(
  jsonString: string
): { nodes: VueFlowNodeType[]; edges: VueFlowEdgeType[] } | null {
  const nodeStore = useNodeStore();
  const nodeDefinitionsMap = new Map<string, NodeDefinition>(
    nodeStore.nodeDefinitions?.map((def) => [`${def.namespace}:${def.type}`, def]) ?? []
  );

  try {
    const parsed: any = JSON.parse(jsonString);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.source !== WORKFLOW_FRAGMENT_SOURCE ||
      !parsed.data ||
      !Array.isArray(parsed.data.nodes) ||
      !Array.isArray(parsed.data.edges)
    ) {
      console.warn("Invalid workflow fragment format in clipboard.", parsed);
      return null;
    }

    if (parsed.version !== WORKFLOW_FRAGMENT_VERSION) {
      console.warn(`Workflow fragment version mismatch. Expected ${WORKFLOW_FRAGMENT_VERSION}, got ${parsed.version}. Attempting to parse anyway.`);
    }

    const fragmentData = parsed.data as WorkflowFragmentData;

    const vueFlowNodes: VueFlowNodeType[] = fragmentData.nodes.map((storageNode) => {
      const nodeDef = nodeDefinitionsMap.get(storageNode.type);
      if (!nodeDef) {
        console.error(`[deserializeWorkflowFragment] Node definition not found for type ${storageNode.type} (ID: ${storageNode.id}). Skipping.`);
        return {
          id: storageNode.id,
          type: "error",
          position: storageNode.position || { x: 0, y: 0 },
          label: `Error: Unknown Type ${storageNode.type}`,
        } as VueFlowNodeType;
      }

      const vueFlowData: Record<string, any> = {
        configValues: klona(storageNode.configValues || {}),
        defaultDescription: nodeDef.description || "",
        description: storageNode.customDescription || nodeDef.description || "",
        inputs: {},
        outputs: {},
      };

      if (nodeDef.inputs) {
        Object.entries(nodeDef.inputs).forEach(([inputName, inputDef]) => {
          const effectiveDefault = getEffectiveDefaultValue(inputDef);
          const storedValue = storageNode.inputValues?.[inputName];
          const finalValue = storedValue !== undefined ? klona(storedValue) : klona(effectiveDefault);
          const defaultSlotDesc = inputDef.description || "";
          const customSlotDesc = storageNode.customSlotDescriptions?.inputs?.[inputName];
          const displaySlotDesc = customSlotDesc || defaultSlotDesc;
          vueFlowData.inputs[inputName] = {
            value: finalValue,
            description: displaySlotDesc,
            defaultDescription: defaultSlotDesc,
            ...klona(inputDef),
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
            ...klona(outputDef),
          };
        });
      }

      const nodeDefaultLabel = nodeDef.displayName || storageNode.type;
      vueFlowData.defaultLabel = nodeDefaultLabel;
      vueFlowData.displayName = storageNode.displayName || nodeDefaultLabel;

      if (storageNode.inputConnectionOrders) {
        vueFlowData.inputConnectionOrders = klona(storageNode.inputConnectionOrders);
      }

      if (storageNode.type === "core:NodeGroup" && storageNode.configValues?.referencedWorkflowId) {
        vueFlowData.groupInterface = { inputs: {}, outputs: {} };
      }

      return {
        id: storageNode.id,
        type: storageNode.type,
        position: klona(storageNode.position),
        data: vueFlowData,
        width: storageNode.width,
        height: storageNode.height,
        label: vueFlowData.displayName,
      } as VueFlowNodeType;
    });

    const vueFlowEdges: VueFlowEdgeType[] = fragmentData.edges.map((storageEdge) => {
      return {
        id: storageEdge.id,
        source: storageEdge.source,
        target: storageEdge.target,
        sourceHandle: storageEdge.sourceHandle,
        targetHandle: storageEdge.targetHandle,
        label: storageEdge.label,
        data: {}, // Initialize data as empty; styles/types to be computed later
      } as VueFlowEdgeType;
    });

    return { nodes: vueFlowNodes, edges: vueFlowEdges };
  } catch (error) {
    console.error("Error deserializing workflow fragment:", error);
    return null;
  }
}
