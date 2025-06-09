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
  // WorkflowObject, // 确保 WorkflowObject 已导入
} from "@comfytavern/types";
import { getEffectiveDefaultValue } from "@comfytavern/utils"; // <-- 导入默认值工具
import { useNodeStore } from "@/stores/nodeStore"; // <-- 导入 Node Store
import { useSlotDefinitionHelper } from "@/composables/node/useSlotDefinitionHelper"; // 导入插槽定义辅助函数
import isEqual from "lodash-es/isEqual"; // <-- 导入深比较函数
import type { Node as VueFlowNodeType, Edge as VueFlowEdgeType } from '@vue-flow/core'; // 确保这些类型被导入, 重命名以避免与参数名冲突
import { klona } from 'klona'; // 用于深拷贝

// --- 缓存 Node Definitions Map ---
let _definitionsMapCache: Map<string, NodeDefinition> | null = null;
let _lastDefinitions: readonly NodeDefinition[] | undefined = undefined; // 使用 readonly

function getNodeDefinitionsMap(): Map<string, NodeDefinition> {
  const nodeStore = useNodeStore();
  // 假设 nodeStore.nodeDefinitions 是响应式的或可能变化
  const currentDefs = nodeStore.nodeDefinitions;
  // 检查引用是否变化，作为简单的缓存失效策略
  if (!_definitionsMapCache || _lastDefinitions !== currentDefs) {
    console.debug("[workflowTransformer] Rebuilding Node Definitions Map Cache");
    _lastDefinitions = currentDefs;
    _definitionsMapCache = new Map<string, NodeDefinition>(
      currentDefs?.map((def) => [`${def.namespace}:${def.type}`, def]) ?? []
    );
  }
  return _definitionsMapCache;
}
// ---------------------------------
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


// --- 开始：VueFlow -> Storage 辅助函数 ---

/**
 * 内部辅助函数：提取节点的基础属性到 WorkflowStorageNode 格式。
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
  const nodeType = vueNode.type as string; // 已在调用方检查

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
    position: klona(vueNode.position), // 确保位置是深拷贝的
  };

  if (vueNode.data?.configValues && Object.keys(vueNode.data.configValues).length > 0) {
    baseProperties.configValues = klona(vueNode.data.configValues);
  }
  if (vueNode.width !== undefined) {
    if (typeof vueNode.width === 'number') {
      baseProperties.width = vueNode.width;
    } else if (typeof vueNode.width === 'string') {
      const parsedWidth = parseFloat(vueNode.width);
      if (!isNaN(parsedWidth)) {
        baseProperties.width = parsedWidth;
      } else {
        console.warn(`[_createBaseStorageNodeProperties] Node ${vueNode.id}: width "${vueNode.width}" is a string but could not be parsed to a number. Skipping width.`);
      }
    }
    // 函数类型的 width 被忽略
  }
  if (vueNode.height !== undefined) {
    if (typeof vueNode.height === 'number') {
      baseProperties.height = vueNode.height;
    } else if (typeof vueNode.height === 'string') {
      const parsedHeight = parseFloat(vueNode.height);
      if (!isNaN(parsedHeight)) {
        baseProperties.height = parsedHeight;
      } else {
        console.warn(`[_createBaseStorageNodeProperties] Node ${vueNode.id}: height "${vueNode.height}" is a string but could not be parsed to a number. Skipping height.`);
      }
    }
    // 函数类型的 height 被忽略
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
 * 内部辅助函数：提取节点的 inputValues。
 */
function _extractInputValuesForStorage(
  vueNode: VueFlowNode,
  nodeDef: NodeDefinition,
  mode: "core" | "fragment"
): Record<string, any> {
  const nodeType = vueNode.type as string;
  const inputValues: Record<string, any> = {};

  if (mode === "core") {
    if (nodeType === "core:NodeGroup") {
      if (vueNode.data?.inputs) {
        Object.entries(vueNode.data.inputs).forEach(([inputName, inputData]) => {
          if (typeof inputData === "object" && inputData !== null && "value" in inputData) {
            inputValues[inputName] = klona(inputData.value);
          } else {
            console.warn(`[_extractInputValuesForStorage:core:NodeGroup] NodeGroup ${vueNode.id}: Input '${inputName}' data structure unexpected. Skipping. Data:`, inputData);
          }
        });
      }
    } else if (
      nodeDef.inputs &&
      vueNode.data?.inputs &&
      nodeType !== "core:GroupInput" &&
      nodeType !== "core:GroupOutput"
    ) {
      Object.entries(vueNode.data.inputs).forEach(([inputName, inputData]) => {
        const inputDef = nodeDef.inputs?.[inputName];
        if (inputDef && typeof inputData === "object" && inputData !== null && "value" in inputData) {
          const currentValue = inputData.value;
          const effectiveDefault = getEffectiveDefaultValue(inputDef);
          let valueToSave = currentValue;
          let valueToCompare = currentValue;

          try {
            if (inputDef.dataFlowType === 'INTEGER') {
              const parsedInt = parseInt(String(currentValue), 10);
              if (!isNaN(parsedInt)) {
                valueToCompare = parsedInt; valueToSave = parsedInt;
              } else if (currentValue !== "" && currentValue !== null) {
                console.warn(`[_extractInputValuesForStorage:core] Node ${vueNode.id} (${nodeType}): Input '${inputName}' (INTEGER) couldn't parse:`, currentValue);
              }
            } else if (inputDef.dataFlowType === 'FLOAT') {
              const parsedFloat = parseFloat(String(currentValue));
              if (!isNaN(parsedFloat)) {
                valueToCompare = parsedFloat; valueToSave = parsedFloat;
              } else if (currentValue !== "" && currentValue !== null) {
                console.warn(`[_extractInputValuesForStorage:core] Node ${vueNode.id} (${nodeType}): Input '${inputName}' (FLOAT) couldn't parse:`, currentValue);
              }
            }
          } catch (e) {
            console.error(`[_extractInputValuesForStorage:core] Type coercion error for input '${inputName}' on node ${vueNode.id}:`, e);
          }

          if (!isEqual(valueToCompare, effectiveDefault)) {
            inputValues[inputName] = valueToSave;
          }
        } else if (!inputDef) {
          console.warn(`[_extractInputValuesForStorage:core] Node ${vueNode.id} (${nodeType}): Input '${inputName}' in data but not definition. Skipping.`);
        } else {
          console.warn(`[_extractInputValuesForStorage:core] Node ${vueNode.id} (${nodeType}): Input '${inputName}' data structure unexpected. Skipping. Data:`, inputData);
        }
      });
    }
  } else if (mode === "fragment") {
    if (
      nodeDef.inputs &&
      vueNode.data?.inputs &&
      nodeType !== "core:GroupInput" &&
      nodeType !== "core:GroupOutput" &&
      nodeType !== "core:NodeGroup" // Crucially, NodeGroup inputValues are not serialized for fragments
    ) {
      Object.entries(vueNode.data.inputs).forEach(([inputName, inputData]) => {
        const inputDef = nodeDef.inputs?.[inputName];
        if (inputDef && typeof inputData === "object" && inputData !== null && "value" in inputData) {
          const currentValue = inputData.value;
          const effectiveDefault = getEffectiveDefaultValue(inputDef);
          if (!isEqual(currentValue, effectiveDefault)) {
            inputValues[inputName] = klona(currentValue); // No type coercion for fragments
          }
        }
      });
    }
  }
  return inputValues;
}

/**
 * 内部辅助函数：提取节点的 customSlotDescriptions。
 */
function _extractCustomSlotDescriptionsForStorage(
  vueNode: VueFlowNode,
  nodeDef: NodeDefinition
): WorkflowStorageNode['customSlotDescriptions'] {
  const nodeType = vueNode.type as string;
  const customSlotDescriptions: WorkflowStorageNode['customSlotDescriptions'] = {};

  if (nodeType === "core:NodeGroup") { // NodeGroup 不应有自定义插槽描述，它们来自引用的工作流
    return undefined;
  }

  if (nodeDef.inputs && vueNode.data?.inputs) {
    const customInputDescs: Record<string, string> = {};
    Object.entries(vueNode.data.inputs).forEach(([inputName, inputData]) => {
      if (typeof inputData === "object" && inputData !== null && "description" in inputData) {
        const currentDesc = inputData.description as string; // Assume string
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
    Object.entries(vueNode.data.outputs).forEach(([outputName, outputData]) => {
      if (typeof outputData === "object" && outputData !== null && "description" in outputData) {
        const currentDesc = outputData.description as string; // Assume string
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

// --- 结束：VueFlow -> Storage 辅助函数 ---


// --- 开始：Storage -> VueFlow 辅助函数 ---

/**
 * 内部辅助函数：创建 VueFlowNode.data 的基础部分。
 */
function _createBaseVueFlowNodeData(
  storageNode: WorkflowStorageNode,
  nodeDef: NodeDefinition
): Record<string, any> {
  // ✅ 优化 1: 使用浅拷贝 ...nodeDef 代替逐属性 klona
  // 确保 nodeDef 中除了 inputs/outputs 的其他顶层属性（category, icon等）被复制
  const vueFlowData: Record<string, any> = {
    ...nodeDef, // 浅拷贝定义
    // 覆盖或添加存储的/计算的属性
    configValues: klona(storageNode.configValues || {}), // ✅ configValues 需要 klona
    defaultDescription: nodeDef.description || "",
    description: storageNode.customDescription || nodeDef.description || "",
    inputs: {}, // 显式设置为空，由 _populate 填充
    outputs: {},// 显式设置为空，由 _populate 填充
  };
  /* ❌ 移除这段低效代码
  for (const key in nodeDef) {
    if (key !== 'inputs' && key !== 'outputs' && Object.prototype.hasOwnProperty.call(nodeDef, key)) {
      vueFlowData[key] = klona((nodeDef as any)[key]); // <-- 性能杀手
    }
  }
  */

  const nodeDefaultLabel = nodeDef.displayName || storageNode.type;
  // 确保不会覆盖从 ...nodeDef 带来的 displayName
  vueFlowData.defaultLabel = nodeDefaultLabel;
  vueFlowData.displayName = storageNode.displayName || nodeDefaultLabel; // 优先使用存储的 displayName

  if (storageNode.inputConnectionOrders) {
    vueFlowData.inputConnectionOrders = klona(storageNode.inputConnectionOrders); // ✅ 需要 klona
  }
  return vueFlowData;
}


/**
 * 内部辅助函数：填充 VueFlowNode.data 的 inputs 和 outputs。
 * 此函数不处理 NodeGroup 的异步接口加载。
 */
function _populateVueFlowNodeSlots(
  vueFlowData: Record<string, any>, // 将被修改
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
      const displaySlotDesc = customSlotDesc || defaultSlotDesc;
      vueFlowData.inputs[inputName] = {
        value: finalValue,
        description: displaySlotDesc,
        defaultDescription: defaultSlotDesc,
        // ✅ 优化 2: 直接引用/浅拷贝 inputDef (definition)
        ...inputDef, // ❌ 代替 ...klona(inputDef)
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
        // ✅ 优化 3: 直接引用/浅拷贝 outputDef (definition)
        ...outputDef, // ❌ 代替 ...klona(outputDef)
      };
    });
  }
}

// --- 结束：Storage -> VueFlow 辅助函数 ---


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
  referencedWorkflows: string[];
} {
  // const nodeStore = useNodeStore(); // 移除
  const referencedWorkflowIds = new Set<string>();
  // ✅ 优化 4: 使用缓存 Map
  const nodeDefinitionsMap = getNodeDefinitionsMap();

  const nodes = flow.nodes.map((vueNode: VueFlowNode): WorkflowStorageNode => {
    const nodeType = vueNode.type;
    if (!nodeType) {
      console.error(`[transformVueFlowToCoreWorkflow] Node ID ${vueNode.id} has no type. Skipping.`);
      return { id: vueNode.id, type: "error", position: vueNode.position };
    }
    const nodeDef = nodeDefinitionsMap.get(nodeType);
    if (!nodeDef) {
      console.error(`[transformVueFlowToCoreWorkflow] No definition for type ${nodeType} (ID: ${vueNode.id}). Skipping.`);
      return { id: vueNode.id, type: "error", position: vueNode.position };
    }

    const baseProperties = _createBaseStorageNodeProperties(vueNode, nodeDef);
    const inputValues = _extractInputValuesForStorage(vueNode, nodeDef, "core");
    const customSlotDescriptions = _extractCustomSlotDescriptionsForStorage(vueNode, nodeDef);

    const storageNode: WorkflowStorageNode = { ...baseProperties } as WorkflowStorageNode; // Cast needed as base is Pick

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

  const viewport: SharedViewport = {
    x: flow.viewport.x,
    y: flow.viewport.y,
    zoom: flow.viewport.zoom,
  };

  return {
    nodes,
    edges,
    viewport,
    referencedWorkflows: Array.from(referencedWorkflowIds),
  };
}

/**
 * 将从后端加载的 WorkflowObject 转换为 Vue Flow 可以直接使用的格式。
 */
export async function transformWorkflowToVueFlow(
  workflow: WorkflowStorageObject,
  projectId: string,
  isDark: boolean,
  getEdgeStylePropsFunc: GetEdgeStylePropsFunc,
  loadWorkflowByIdFunc: (
    pId: string,
    wfId: string
  ) => Promise<WorkflowStorageObject | null>
): Promise<{ flowData: FlowExportObject; viewport: SharedViewport }> {
  // const nodeStore = useNodeStore(); // 移除
  // ✅ 优化 4: 使用缓存 Map
  const nodeDefinitionsMap = getNodeDefinitionsMap();
  // ✅ 优化 5: 缓存 NodeGroup 加载 Promise
  const workflowLoadCache = new Map<string, Promise<WorkflowStorageObject | null>>();
  const cachedLoadFunc = (pId: string, wfId: string): Promise<WorkflowStorageObject | null> => {
    const cacheKey = `${pId}:${wfId}`;
    if (workflowLoadCache.has(cacheKey)) {
      // console.debug(`[transformWorkflowToVueFlow] Cache hit for workflow ${cacheKey}`);
      return workflowLoadCache.get(cacheKey)!;
    }
    const promise = loadWorkflowByIdFunc(pId, wfId);
    workflowLoadCache.set(cacheKey, promise);
    return promise;
  }

  const nodes: VueFlowNode[] = await Promise.all(
    workflow.nodes.map(async (storageNode: WorkflowStorageNode): Promise<VueFlowNode> => {
      // ... nodeDef check
      const nodeDef = nodeDefinitionsMap.get(storageNode.type);
      if (!nodeDef) { // Preserving original error handling structure
        console.error(`[transformWorkflowToVueFlow] No definition for type ${storageNode.type} (ID: ${storageNode.id}). Skipping.`);
        return {
          id: storageNode.id,
          type: "error",
          position: storageNode.position,
          label: `Error: Unknown Type ${storageNode.type}`,
        } as VueFlowNode;
      }

      const vueFlowData = _createBaseVueFlowNodeData(storageNode, nodeDef);
      if (storageNode.type !== "core:NodeGroup") {
        _populateVueFlowNodeSlots(vueFlowData, storageNode, nodeDef);
      }

      if (storageNode.type === "core:NodeGroup") {
        const referencedWorkflowId = vueFlowData.configValues?.referencedWorkflowId as string | undefined;
        if (referencedWorkflowId) {
          try {
            // ✅ 使用缓存加载函数
            const referencedWorkflowData = await cachedLoadFunc(projectId, referencedWorkflowId);
            if (referencedWorkflowData) {
              const groupInterface = extractGroupInterface(referencedWorkflowData);
              vueFlowData.groupInterface = groupInterface;
              vueFlowData.inputs = {};
              vueFlowData.outputs = {};

              if (groupInterface.inputs) {
                Object.entries(groupInterface.inputs).forEach(
                  ([inputName, inputDefFromInterfaceUntyped]) => {
                    const inputDefFromInterface = inputDefFromInterfaceUntyped as InputDefinition;
                    // ... effectiveDefault, storedValue, finalValue, descriptions
                    const effectiveDefault = getEffectiveDefaultValue(inputDefFromInterface);
                    const storedValue = storageNode.inputValues?.[inputName];
                    // ✅ finalValue (state) 需要 klona
                    const finalValue = storedValue !== undefined ? klona(storedValue) : klona(effectiveDefault);
                    const defaultSlotDesc = inputDefFromInterface.description || "";
                    const customSlotDesc = storageNode.customSlotDescriptions?.inputs?.[inputName];
                    const displaySlotDesc = customSlotDesc || defaultSlotDesc;

                    vueFlowData.inputs[inputName] = {
                      value: finalValue,
                      description: displaySlotDesc,
                      defaultDescription: defaultSlotDesc,
                      // ✅ 优化 6: 直接引用/浅拷贝 (definition)
                      ...inputDefFromInterface, // ❌ 代替 ...klona(inputDefFromInterface)
                    };
                  }
                );
              }
              if (groupInterface.outputs) {
                Object.entries(groupInterface.outputs).forEach(
                  ([outputName, outputDefFromInterfaceUntyped]) => {
                    const outputDefFromInterface = outputDefFromInterfaceUntyped as OutputDefinition;
                    // ... descriptions
                    const defaultSlotDesc = outputDefFromInterface.description || "";
                    const customSlotDesc = storageNode.customSlotDescriptions?.outputs?.[outputName];
                    const displaySlotDesc = customSlotDesc || defaultSlotDesc;
                    vueFlowData.outputs[outputName] = {
                      description: displaySlotDesc,
                      defaultDescription: defaultSlotDesc,
                      // ✅ 优化 7: 直接引用/浅拷贝 (definition)
                      ...outputDefFromInterface, // ❌ 代替 ...klona(outputDefFromInterface)
                    };
                  }
                );
              }
            } else { // Preserving original warning structure
              console.warn(`[transformWorkflowToVueFlow] NodeGroup ${storageNode.id}: Referenced workflow ${referencedWorkflowId} not loaded. Interface empty.`);
              vueFlowData.groupInterface = { inputs: {}, outputs: {} };
              vueFlowData.inputs = {}; vueFlowData.outputs = {};
            }
          } catch (error) { // Preserving original error handling structure
            console.error(`[transformWorkflowToVueFlow] NodeGroup ${storageNode.id}: Error loading ref workflow ${referencedWorkflowId}:`, error);
            vueFlowData.groupInterface = { inputs: {}, outputs: {} };
            vueFlowData.inputs = {}; vueFlowData.outputs = {};
          }
        } else { // Preserving original warning structure
          console.warn(`[transformWorkflowToVueFlow] NodeGroup ${storageNode.id} missing referencedWorkflowId. Interface empty.`);
          vueFlowData.groupInterface = { inputs: {}, outputs: {} };
          vueFlowData.inputs = {}; vueFlowData.outputs = {};
        }
      }
      // ... return VueFlowNode
      return {
        id: storageNode.id,
        type: storageNode.type,
        position: storageNode.position, // ⚠️ 注意：这里没有 klona，VueFlow 内部可能会修改它。如果需要隔离，这里也应 klona(storageNode.position)
        data: vueFlowData,
        width: storageNode.width,
        height: storageNode.height,
        label: vueFlowData.displayName,
      } as VueFlowNode;
    })
  );


  const vueFlowNodesMap = new Map<string, VueFlowNode>(nodes.map((n) => [n.id, n]));
  const { getSlotDefinition } = useSlotDefinitionHelper();

  // 准备 workflowData 参数给 getSlotDefinition，遵循原始代码使用 as any 的方式
  // getSlotDefinition 的参数类型是 (WorkflowObject & { id: string })
  // workflow (WorkflowStorageObject) 本身不完全匹配此类型，特别是缺少 id, name 等元数据。
  // 原始代码通过 as any 绕过此类型检查。
  const workflowDataForSlotHelper = {
    // 从 workflow (WorkflowStorageObject) 获取 getSlotDefinition 主要依赖的属性
    interfaceInputs: workflow.interfaceInputs || {},
    interfaceOutputs: workflow.interfaceOutputs || {},
    // 包含 nodes 和 edges，因为它们是 WorkflowObject 的一部分，getSlotDefinition 可能会间接访问
    nodes: workflow.nodes,
    edges: workflow.edges,
    viewport: workflow.viewport || { x: 0, y: 0, zoom: 1 },
    // id, name, projectId 等元数据字段：
    // WorkflowStorageObject 没有这些。getSlotDefinition 的类型签名 (WorkflowObject & { id: string })
    // 暗示它可能期望这些。通过 as any，我们允许 getSlotDefinition 内部处理这些字段可能缺失的情况。
    // 如果 getSlotDefinition 严格需要 id 或 name，而它们在此对象中不存在，则运行时可能出错，
    // 但这是原始代码行为的一部分。
  };

  const edges: VueFlowEdge[] = workflow.edges.map(
    (storageEdge: WorkflowStorageEdge): VueFlowEdge => {
      const sourceNode = vueFlowNodesMap.get(storageEdge.source);
      const targetNode = vueFlowNodesMap.get(storageEdge.target);
      let sourceType = "any";
      let targetType = "any";

      if (sourceNode && storageEdge.sourceHandle) {
        const sourceSlotDef = getSlotDefinition(
          sourceNode,
          storageEdge.sourceHandle,
          'source',
          workflowDataForSlotHelper as any // 恢复原始的 as any 断言
        );
        if (sourceSlotDef?.dataFlowType) sourceType = sourceSlotDef.dataFlowType;
        else if (sourceSlotDef) console.warn(`[transformWorkflowToVueFlow] Edge ${storageEdge.id} source: Slot ${storageEdge.sourceHandle} on ${sourceNode.id} missing dataFlowType.`);
        else console.warn(`[transformWorkflowToVueFlow] Edge ${storageEdge.id} source: Slot ${storageEdge.sourceHandle} on ${sourceNode.id} not found.`);
      }
      if (targetNode && storageEdge.targetHandle) {
        const targetSlotDef = getSlotDefinition(
          targetNode,
          storageEdge.targetHandle,
          'target',
          workflowDataForSlotHelper as any // 恢复原始的 as any 断言
        );
        if (targetSlotDef?.dataFlowType) targetType = targetSlotDef.dataFlowType;
        else if (targetSlotDef) console.warn(`[transformWorkflowToVueFlow] Edge ${storageEdge.id} target: Slot ${storageEdge.targetHandle} on ${targetNode.id} missing dataFlowType.`);
        else console.warn(`[transformWorkflowToVueFlow] Edge ${storageEdge.id} target: Slot ${storageEdge.targetHandle} on ${targetNode.id} not found.`);
      }

      const { animated, style, markerEnd } = getEdgeStylePropsFunc(sourceType, targetType, isDark);
      return {
        id: storageEdge.id,
        source: storageEdge.source,
        target: storageEdge.target,
        sourceHandle: storageEdge.sourceHandle,
        targetHandle: storageEdge.targetHandle,
        type: "default",
        label: storageEdge.label,
        data: { sourceType, targetType },
        animated,
        style,
        markerEnd,
      };
    }
  );

  const viewport: SharedViewport = {
    x: workflow.viewport?.x ?? 0,
    y: workflow.viewport?.y ?? 0,
    zoom: workflow.viewport?.zoom ?? 1,
  };

  return {
    flowData: {
      nodes,
      edges,
      position: [viewport.x, viewport.y],
      zoom: viewport.zoom,
      viewport,
    },
    viewport,
  };
}

/**
 * 从工作流定义中提取组接口的辅助函数。
 */
export function extractGroupInterface(groupData: WorkflowStorageObject): GroupInterfaceInfo {
  const inputs = groupData.interfaceInputs || {};
  const outputs = groupData.interfaceOutputs || {};
  console.debug(`[extractGroupInterface] Extracted: Inputs:`, klona(inputs), `Outputs:`, klona(outputs));
  return { inputs, outputs };
}

/**
 * 将核心工作流数据（存储格式）转换为后端执行引擎所需的 WorkflowExecutionPayload 格式。
 * @param coreWorkflow 包含 WorkflowStorageNode 和 WorkflowStorageEdge 的对象
 * @returns 符合 WorkflowExecutionPayload 结构的对象
 */
export function transformVueFlowToExecutionPayload(
  coreWorkflow: { nodes: WorkflowStorageNode[]; edges: WorkflowStorageEdge[] }
): WorkflowExecutionPayload {
  const executionNodes: ExecutionNode[] = coreWorkflow.nodes.map((storageNode): ExecutionNode => {
    const execNode: ExecutionNode = {
      id: storageNode.id,
      fullType: storageNode.type,
    };
    // storageNode.inputValues 已经是筛选过的 (与默认值不同)
    if (storageNode.inputValues && Object.keys(storageNode.inputValues).length > 0) {
      execNode.inputs = storageNode.inputValues; // No need to klona, these are for immediate execution
    }
    if (storageNode.configValues && Object.keys(storageNode.configValues).length > 0) {
      execNode.configValues = storageNode.configValues;
    }
    if (storageNode.inputConnectionOrders && Object.keys(storageNode.inputConnectionOrders).length > 0) {
      execNode.inputConnectionOrders = storageNode.inputConnectionOrders;
    }
    return execNode;
  });

  const executionEdges: ExecutionEdge[] = coreWorkflow.edges.map((storageEdge): ExecutionEdge => ({
    id: storageEdge.id,
    sourceNodeId: storageEdge.source,
    targetNodeId: storageEdge.target,
    sourceHandle: storageEdge.sourceHandle ?? "",
    targetHandle: storageEdge.targetHandle ?? "",
  }));

  return {
    nodes: executionNodes,
    edges: executionEdges,
  };
}


/**
 * Serializes a fragment of a workflow (selected nodes and edges) into a JSON string for clipboard.
 */
export function serializeWorkflowFragment(
  nodesToSerialize: VueFlowNodeType[],
  edgesToSerialize: VueFlowEdgeType[]
): string | null {
  // const nodeStore = useNodeStore(); // 移除
  // ✅ 优化 4: 使用缓存 Map
  const nodeDefinitionsMap = getNodeDefinitionsMap();

  try {
    const storageNodes: WorkflowStorageNode[] = nodesToSerialize.map((vueNode) => {
      const nodeType = vueNode.type;
      if (!nodeType) {
        console.error(`[serializeWorkflowFragment] Node ID ${vueNode.id} has no type.`);
        throw new Error(`Node ${vueNode.id} has no type.`);
      }
      const nodeDef = nodeDefinitionsMap.get(nodeType);
      if (!nodeDef) {
        console.error(`[serializeWorkflowFragment] No definition for type ${nodeType} (ID: ${vueNode.id}).`);
        throw new Error(`Node definition not found for ${nodeType}.`);
      }

      const baseProperties = _createBaseStorageNodeProperties(vueNode, nodeDef);
      // For fragments, inputValues are extracted differently (no type coercion, NodeGroup excluded)
      const inputValues = _extractInputValuesForStorage(vueNode, nodeDef, "fragment");
      // Custom slot descriptions are generally applicable
      const customSlotDescriptions = _extractCustomSlotDescriptionsForStorage(vueNode, nodeDef);

      const sNode: WorkflowStorageNode = { ...baseProperties } as WorkflowStorageNode;

      if (Object.keys(inputValues).length > 0) {
        sNode.inputValues = inputValues;
      }
      if (customSlotDescriptions) {
        sNode.customSlotDescriptions = customSlotDescriptions;
      }
      // Note: referencedWorkflowId is not relevant for fragments in this context.
      return sNode;
    });

    const storageEdges: WorkflowStorageEdge[] = edgesToSerialize.map((vueEdge) => ({
      id: vueEdge.id,
      source: vueEdge.source,
      target: vueEdge.target,
      sourceHandle: vueEdge.sourceHandle ?? "",
      targetHandle: vueEdge.targetHandle ?? "",
      label: typeof vueEdge.label === "string" && vueEdge.label ? vueEdge.label : undefined,
    }));

    const fragment: SerializedWorkflowFragment = {
      source: WORKFLOW_FRAGMENT_SOURCE,
      version: WORKFLOW_FRAGMENT_VERSION,
      data: { nodes: storageNodes, edges: storageEdges },
    };
    return JSON.stringify(fragment);
  } catch (error) {
    console.error("Error serializing workflow fragment:", error);
    return null;
  }
}

/**
 * Deserializes a JSON string from the clipboard into VueFlow nodes and edges.
 */
export function deserializeWorkflowFragment(
  jsonString: string
): { nodes: VueFlowNodeType[]; edges: VueFlowEdgeType[] } | null {
  // const nodeStore = useNodeStore(); // 移除
  // ✅ 优化 4: 使用缓存 Map
  const nodeDefinitionsMap = getNodeDefinitionsMap();

  try {
    const parsed: any = JSON.parse(jsonString);
    if (
      !parsed || typeof parsed !== "object" || parsed.source !== WORKFLOW_FRAGMENT_SOURCE ||
      !parsed.data || !Array.isArray(parsed.data.nodes) || !Array.isArray(parsed.data.edges)
    ) {
      console.warn("Invalid workflow fragment format in clipboard.", parsed);
      return null;
    }
    if (parsed.version !== WORKFLOW_FRAGMENT_VERSION) {
      console.warn(`Fragment version mismatch. Expected ${WORKFLOW_FRAGMENT_VERSION}, got ${parsed.version}. Parsing anyway.`);
    }

    const fragmentData = parsed.data as WorkflowFragmentData;

    const vueFlowNodes: VueFlowNodeType[] = fragmentData.nodes.map((storageNode) => {
      const nodeDef = nodeDefinitionsMap.get(storageNode.type);
      if (!nodeDef) {
        console.error(`[deserializeWorkflowFragment] No definition for type ${storageNode.type} (ID: ${storageNode.id}). Skipping.`);
        return {
          id: storageNode.id,
          type: "error",
          position: storageNode.position || { x: 0, y: 0 },
          label: `Error: Unknown Type ${storageNode.type}`,
        } as VueFlowNodeType;
      }

      const vueFlowData = _createBaseVueFlowNodeData(storageNode, nodeDef);
      _populateVueFlowNodeSlots(vueFlowData, storageNode, nodeDef); // Populates inputs/outputs

      // For pasted NodeGroups, initialize groupInterface as empty.
      // It will be populated on full load/save.
      if (storageNode.type === "core:NodeGroup") {
        vueFlowData.groupInterface = { inputs: {}, outputs: {} };
        // Ensure inputs/outputs are also empty for pasted NodeGroup,
        // as _populateVueFlowNodeSlots might fill them based on NodeGroup's own (empty) definition.
        // However, _populateVueFlowNodeSlots uses nodeDef, which for NodeGroup might have generic slots.
        // It's safer to clear them here if groupInterface is the source of truth for NodeGroup slots.
        // vueFlowData.inputs = {}; // This might be too aggressive if NodeGroup def has some base slots.
        // vueFlowData.outputs = {};
      }


      return {
        id: storageNode.id,
        type: storageNode.type,
        // ✅ 确保 position 被 klona，因为粘贴后节点位置会变
        position: klona(storageNode.position),
        data: vueFlowData,
        width: storageNode.width,
        height: storageNode.height,
        label: vueFlowData.displayName,
      } as VueFlowNodeType;
    });

    const vueFlowEdges: VueFlowEdgeType[] = fragmentData.edges.map((storageEdge) => ({
      id: storageEdge.id,
      source: storageEdge.source,
      target: storageEdge.target,
      sourceHandle: storageEdge.sourceHandle,
      targetHandle: storageEdge.targetHandle,
      label: storageEdge.label,
      data: {}, // Styles/types computed later by caller
    } as VueFlowEdgeType));

    return { nodes: vueFlowNodes, edges: vueFlowEdges };
  } catch (error) {
    console.error("Error deserializing workflow fragment:", error);
    return null;
  }
}
