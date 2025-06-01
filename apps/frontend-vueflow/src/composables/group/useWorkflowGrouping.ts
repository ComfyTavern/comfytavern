import {
  type Node as VueFlowNode,
  type Edge as VueFlowEdge,
  // REMOVED: useVueFlow,
} from "@vue-flow/core";
import { useWorkflowStore } from "@/stores/workflowStore";
import type { TabWorkflowState, WorkflowStateSnapshot } from "@/types/workflowTypes"; // 导入类型
import { useTabStore } from "@/stores/tabStore";
import { useNodeStore } from "@/stores/nodeStore";
import { storeToRefs } from "pinia"; // 导入 storeToRefs
import { useUniqueNodeId } from "@/composables/node/useUniqueNodeId";
import type {
  WorkflowObject,
  // WorkflowNode, // Removed as it's no longer directly used here
  // WorkflowEdge, // Removed as it's no longer directly used here
  GroupInterfaceInfo,
  GroupSlotInfo,
  HistoryEntry, // <-- Import HistoryEntry
  DataFlowTypeName, // New import
} from "@comfytavern/types";
import { DataFlowType, BuiltInSocketMatchCategory } from "@comfytavern/types"; // Import as values
// Removed: import { SocketType } from "@comfytavern/types";
import { createHistoryEntry } from "@comfytavern/utils"; // <-- Import createHistoryEntry
import { v4 as uuidv4 } from "uuid"; // 导入 uuid 用于生成唯一 ID
import { useWorkflowData } from "../workflow/useWorkflowData"; // 导入 useWorkflowData
import { useProjectStore } from "@/stores/projectStore"; // <-- 导入 Project Store
import { useThemeStore } from "@/stores/theme"; // 导入主题 Store
import { useEdgeStyles } from "../canvas/useEdgeStyles"; // 导入边样式 Composable
import { getNodeType } from "@/utils/nodeUtils"; // 导入节点类型辅助函数
import { transformVueFlowToCoreWorkflow } from "@/utils/workflowTransformer"; // <--- 导入转换函数
import { useWorkflowViewManagement } from "../workflow/useWorkflowViewManagement"; // ADDED: Import view management
import { nextTick, type Ref, toRaw } from "vue"; // 导入 Ref 类型, toRaw

// New isTypeCompatible function, logic copied from useCanvasConnections.ts
export function isTypeCompatible(sourceSlot: GroupSlotInfo, targetSlot: GroupSlotInfo): boolean { // Added export
  const sourceDft = sourceSlot.dataFlowType;
  const sourceCats = sourceSlot.matchCategories || [];
  const targetDft = targetSlot.dataFlowType;
  const targetCats = targetSlot.matchCategories || [];

  // Helper to check for BEHAVIOR_CONVERTIBLE or CONVERTIBLE_ANY DataFlowType
  const isSlotConvertibleAny = (dft: DataFlowTypeName, cats: string[]) =>
    dft === DataFlowType.CONVERTIBLE_ANY ||
    cats.includes(BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);

  // Helper to check for BEHAVIOR_WILDCARD or WILDCARD DataFlowType
  const isSlotWildcard = (dft: DataFlowTypeName, cats: string[]) =>
    dft === DataFlowType.WILDCARD || // WILDCARD is a DataFlowType
    cats.includes(BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD);

  const isSourceConvertible = isSlotConvertibleAny(sourceDft, sourceCats);
  const isTargetConvertible = isSlotConvertibleAny(targetDft, targetCats);
  const isSourceWild = isSlotWildcard(sourceDft, sourceCats);
  const isTargetWild = isSlotWildcard(targetDft, targetCats);

  // 规则 1: 通配符行为 (WILDCARD or BEHAVIOR_WILDCARD)
  // 如果一方是通配符，另一方不是可转换类型，则兼容。
  // (通配符可以变成对方类型，可转换类型会变成对方类型，两者相遇时，通配符优先保持其通配行为，让对方去适应它，除非对方也是通配符)
  if (isSourceWild && !isTargetConvertible) { return true; }
  if (isTargetWild && !isSourceConvertible) { return true; }
  if (isSourceWild && isTargetWild) { return true; } // 通配符之间互相兼容

  // 规则 2: 可转换行为 (CONVERTIBLE_ANY or BEHAVIOR_CONVERTIBLE)
  // 如果一方是可转换类型，另一方不是通配符，则兼容 (包括两个可转换类型相遇的情况)。
  if (isSourceConvertible && !isTargetWild) { return true; } // 源可转，目标不是通配符 (可以是具体类型或其他可转类型)
  if (isTargetConvertible && !isSourceWild) { return true; } // 目标可转，源不是通配符 (可以是具体类型或其他可转类型)
  // 注意：isSourceConvertible && isTargetConvertible 的情况已被上面覆盖。

  // 如果执行到这里，说明源和目标都不是行为型通配符或可转换类型，或者是它们与这些类型的组合未被上述规则覆盖。
  // 此时，我们只处理具体类型之间的匹配。

  // Priority 2: SocketMatchCategory Matching (if both have non-behavioral categories)
  const behaviorCategoryNames = [
    BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE,
    BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD,
  ];
  const actualSourceCats = sourceCats.filter((cat) => !behaviorCategoryNames.some(bhCat => bhCat === cat));
  const actualTargetCats = targetCats.filter((cat) => !behaviorCategoryNames.some(bhCat => bhCat === cat));

  if (actualSourceCats.length > 0 && actualTargetCats.length > 0) {
    for (const sCat of actualSourceCats) {
      if (actualTargetCats.includes(sCat)) {
        return true; // Direct match of non-behavioral categories
      }
    }
    // If categories are defined but no match, proceed to DataFlowType (as per design)
  }

  // Priority 3: DataFlowType Fallback Matching
  if (sourceDft === targetDft) { return true; }

  if (sourceDft === DataFlowType.INTEGER && targetDft === DataFlowType.FLOAT) { return true; }

  const stringCompatibleSourceDfts: DataFlowTypeName[] = [
    DataFlowType.INTEGER,
    DataFlowType.FLOAT,
    DataFlowType.BOOLEAN,
  ];
  if (stringCompatibleSourceDfts.includes(sourceDft) && targetDft === DataFlowType.STRING) {
    return true;
  }

  // Compatibility based on SocketMatchCategory if DataFlowTypes differ but one is STRING
  // Example: Source is STRING, Target has matchCategory CODE
  if (sourceDft === DataFlowType.STRING && targetCats.includes(BuiltInSocketMatchCategory.CODE)) {
    return true;
  }
  // Example: Source has matchCategory CODE, Target is STRING
  if (sourceCats.includes(BuiltInSocketMatchCategory.CODE) && targetDft === DataFlowType.STRING) {
    return true;
  }
  // Example: Source is STRING, Target has matchCategory COMBO_OPTION
  if (sourceDft === DataFlowType.STRING && targetCats.includes(BuiltInSocketMatchCategory.COMBO_OPTION)) {
    return true;
  }
  // Example: Source has matchCategory COMBO_OPTION, Target is STRING
  if (sourceCats.includes(BuiltInSocketMatchCategory.COMBO_OPTION) && targetDft === DataFlowType.STRING) {
    return true;
  }

  return false;
}

// --- 辅助函数：updateNodeGroupWorkflowReference ---
// 移到 useWorkflowGrouping 外部，并将依赖项作为参数传递
async function updateNodeGroupWorkflowReferenceLogic(
  nodeId: string,
  newWorkflowId: string,
  tabId: string | undefined,
  // 依赖项:
  workflowStore: ReturnType<typeof useWorkflowStore>,
  tabStore: ReturnType<typeof useTabStore>,
  workflowDataHandler: ReturnType<typeof useWorkflowData>,
  nodeDefinitions: Ref<any[]>, // 假设 nodeDefinitions 是一个 Ref
  // REMOVED: updateNodeData: (id: string, data: any) => void
): Promise<{ success: boolean; updatedNodeData?: any; edgeIdsToRemove?: string[] }> { // <-- Changed return type
  // 获取当前标签页 ID
  const currentTabId = tabId || tabStore.activeTabId;
  if (!currentTabId) {
    console.error("[updateNodeGroupWorkflowReferenceLogic] No active tab found");
    return { success: false }; // <-- Return object
  }

  // 获取标签页信息
  const tab = tabStore.tabs.find((t) => t.internalId === currentTabId);
  if (!tab) {
    console.error(`[updateNodeGroupWorkflowReferenceLogic] Tab not found: ${currentTabId}`);
    return { success: false }; // <-- Return object
  }

  // 获取标签页所属项目 ID
  const projectId = tab.projectId;
  if (!projectId) {
    console.error(
      `[updateNodeGroupWorkflowReferenceLogic] Project ID missing for tab: ${currentTabId}`
    );
    return { success: false }; // <-- Return object
  }

  // 获取当前工作流状态（等待 Promise）
  const state = await workflowStore.ensureTabState(currentTabId);
  // 这里无需检查 !state，因为 ensureTabState 总是返回一个状态对象

  // 找到目标节点
  const nodeElement = state.elements.find((el: any) => !("source" in el) && el.id === nodeId) as
    | VueFlowNode
    | undefined;
  if (!nodeElement) {
    console.error(`[updateNodeGroupWorkflowReferenceLogic] Node not found: ${nodeId}`);
    return { success: false }; // <-- Return object
  }

  // 确认是 NodeGroup 类型（检查顶层 type 属性）
  if (nodeElement.type !== 'core:NodeGroup') {
    console.error(
      `[updateNodeGroupWorkflowReferenceLogic] Node ${nodeId} type is ${nodeElement.type}, not NodeGroup`
    );
    return { success: false }; // <-- Return object
  }

  try {
    console.log(
      `[updateNodeGroupWorkflowReferenceLogic] Loading workflow ${newWorkflowId} from project ${projectId}`
    );

    // 获取新工作流的完整数据 (修正参数顺序：tabId, projectId, workflowId)
    const { success, loadedData } = await workflowDataHandler.loadWorkflow(
      currentTabId, // 第一个参数应该是 tabId
      projectId,    // 第二个参数应该是 projectId
      newWorkflowId // 第三个参数是 workflowId
    );
    if (!success || !loadedData) {
      console.error(
        `[updateNodeGroupWorkflowReferenceLogic] Failed to load workflow ${newWorkflowId}`
      );
      return { success: false }; // <-- Return object
    }

    // 提取接口信息
    const newInterface = workflowDataHandler.extractGroupInterface(loadedData);

    // 准备新的节点数据
    const clonedInterface = JSON.parse(JSON.stringify(newInterface)); // 深拷贝接口
    const newNodeData = {
      ...nodeElement.data, // 复制现有数据
      referencedWorkflowId: newWorkflowId, // 更新引用 ID
      groupInterface: clonedInterface, // 设置正确的 groupInterface
      label: loadedData.name || `分组 ${newWorkflowId}`, // 更新标签
    };
    console.debug(
      `[updateNodeGroupWorkflowReferenceLogic] Prepared new node data (using groupInterface) for ${nodeId}:`,
      JSON.parse(JSON.stringify(newNodeData))
    );

    // REMOVED: Direct call to updateNodeData
    // updateNodeData(nodeId, newNodeData);
    // console.log(
    //   `[updateNodeGroupWorkflowReferenceLogic] Updated node ${nodeId} data with new groupInterface.`
    // );

    // 处理可能不兼容的连接
    const connectedEdges = state.elements.filter(
      (el: any) =>
        "source" in el &&
        (el.source === nodeId || // 从节点出来的边
          el.target === nodeId) // 到节点的边
    ) as VueFlowEdge[];

    const incompatibleEdges: VueFlowEdge[] = [];
    const edgesToRemove: string[] = [];

    for (const edge of connectedEdges) {
      if (edge.source === nodeId) {
        // 节点的输出连接
        const slotKey = edge.sourceHandle;
        if (typeof slotKey !== "string" || !slotKey) {
          console.warn(
            `[updateNodeGroupWorkflowReferenceLogic] Invalid source handle for edge ${edge.id}:`,
            slotKey
          );
          incompatibleEdges.push(edge);
          edgesToRemove.push(edge.id);
          continue;
        }
        const outputSlot = newInterface.outputs?.[slotKey];

        if (!outputSlot) {
          console.warn(
            `[updateNodeGroupWorkflowReferenceLogic] Output slot ${slotKey} no longer exists in the new interface`
          );
          incompatibleEdges.push(edge);
          edgesToRemove.push(edge.id);
          continue;
        }

        const targetNode = state.elements.find(
          (el: any) => !("source" in el) && el.id === edge.target
        ) as VueFlowNode | undefined;
        if (!targetNode) continue;

        const targetHandleId = edge.targetHandle || "default";
        const targetNodeType = getNodeType(targetNode);
        const targetNodeDef = nodeDefinitions.value.find((def: any) => def.type === targetNodeType);

        const targetInputDefinition = targetNodeDef?.inputs?.[targetHandleId];

        if (targetInputDefinition && outputSlot) {
          const targetSlotForCompatibility: GroupSlotInfo = {
            key: targetHandleId,
            displayName: targetInputDefinition.name || targetHandleId,
            // Removed: type: targetInputDefinition.type, // For GroupSlotInfo structure
            dataFlowType: targetInputDefinition.dataFlowType,
            matchCategories: targetInputDefinition.matchCategories || [],
            // customDescription, multi, allowDynamicType, config are not strictly needed by isTypeCompatible
          };
          if (!isTypeCompatible(outputSlot, targetSlotForCompatibility)) {
            console.warn(
              `[updateNodeGroupWorkflowReferenceLogic] Output slot ${outputSlot.key} (DFT: ${outputSlot.dataFlowType}, Cats: ${outputSlot.matchCategories?.join(',')}) not compatible with target slot ${targetSlotForCompatibility.key} (DFT: ${targetSlotForCompatibility.dataFlowType}, Cats: ${targetSlotForCompatibility.matchCategories?.join(',')})`
            );
            incompatibleEdges.push(edge);
            edgesToRemove.push(edge.id);
          }
        } else if (!outputSlot) { // Should be caught earlier by `if (!outputSlot)`
          console.warn(`[updateNodeGroupWorkflowReferenceLogic] Output slot ${slotKey} is missing. Edge ${edge.id} considered incompatible.`);
          incompatibleEdges.push(edge);
          edgesToRemove.push(edge.id);
        } else { // targetInputDefinition is missing
          console.warn(
            `[updateNodeGroupWorkflowReferenceLogic] Target input definition ${targetHandleId} on node ${targetNode.id} not found. Edge ${edge.id} from output ${outputSlot.key} considered incompatible.`
          );
          incompatibleEdges.push(edge);
          edgesToRemove.push(edge.id);
        }
      } else if (edge.target === nodeId) {
        // 节点的输入连接
        const slotKey = edge.targetHandle;
        if (typeof slotKey !== "string" || !slotKey) {
          console.warn(
            `[updateNodeGroupWorkflowReferenceLogic] Invalid target handle for edge ${edge.id}:`,
            slotKey
          );
          incompatibleEdges.push(edge);
          edgesToRemove.push(edge.id);
          continue;
        }
        const inputSlot = newInterface.inputs?.[slotKey];

        if (!inputSlot) {
          console.warn(
            `[updateNodeGroupWorkflowReferenceLogic] Input slot ${slotKey} no longer exists in the new interface`
          );
          incompatibleEdges.push(edge);
          edgesToRemove.push(edge.id);
          continue;
        }

        const sourceNode = state.elements.find(
          (el: any) => !("source" in el) && el.id === edge.source
        ) as VueFlowNode | undefined;
        if (!sourceNode) continue;

        const sourceHandleId = edge.sourceHandle || "default";
        const sourceNodeType = getNodeType(sourceNode);
        const sourceNodeDef = nodeDefinitions.value.find((def: any) => def.type === sourceNodeType);

        const sourceOutputDefinition = sourceNodeDef?.outputs?.[sourceHandleId];

        if (sourceOutputDefinition && inputSlot) {
          const sourceSlotForCompatibility: GroupSlotInfo = {
            key: sourceHandleId,
            displayName: sourceOutputDefinition.name || sourceHandleId,
            // Removed: type: sourceOutputDefinition.type, // For GroupSlotInfo structure
            dataFlowType: sourceOutputDefinition.dataFlowType,
            matchCategories: sourceOutputDefinition.matchCategories || [],
          };
          if (!isTypeCompatible(sourceSlotForCompatibility, inputSlot)) {
            console.warn(
              `[updateNodeGroupWorkflowReferenceLogic] Source slot ${sourceSlotForCompatibility.key} (DFT: ${sourceSlotForCompatibility.dataFlowType}, Cats: ${sourceSlotForCompatibility.matchCategories?.join(',')}) not compatible with input slot ${inputSlot.key} (DFT: ${inputSlot.dataFlowType}, Cats: ${inputSlot.matchCategories?.join(',')})`
            );
            incompatibleEdges.push(edge);
            edgesToRemove.push(edge.id);
          }
        } else if (!inputSlot) { // Should be caught earlier by `if (!inputSlot)`
          console.warn(`[updateNodeGroupWorkflowReferenceLogic] Input slot ${slotKey} is missing. Edge ${edge.id} considered incompatible.`);
          incompatibleEdges.push(edge);
          edgesToRemove.push(edge.id);
        } else { // sourceOutputDefinition is missing
          console.warn(
            `[updateNodeGroupWorkflowReferenceLogic] Source output definition ${sourceHandleId} on node ${sourceNode.id} not found. Edge ${edge.id} to input ${inputSlot.key} considered incompatible.`
          );
          incompatibleEdges.push(edge);
          edgesToRemove.push(edge.id);
        }
      }
    }

    // REMOVED: Direct call to setElements for edge removal
    // if (edgesToRemove.length > 0) {
    //   const newElements = state.elements.filter(
    //     (el: any) => !("source" in el) || !edgesToRemove.includes(el.id)
    //   );
    //   workflowStore.setElements(currentTabId, newElements); // 使用 workflowStore 实例
    // }

    // Display alert if edges were incompatible (still useful feedback)
    const numIncompatible = incompatibleEdges.length;
    if (numIncompatible > 0) {
      const message =
        numIncompatible === 1
          ? `已断开 1 个不兼容的连接`
          : `已断开 ${numIncompatible} 个不兼容的连接`;

      // 添加日志显示断开数量
      console.info(`[updateNodeGroupWorkflowReferenceLogic] ${message}`);
      // alert(`节点组接口已更新。${message}。`); // 移除阻塞UI的alert
    } else {
      console.debug(
        `[updateNodeGroupWorkflowReferenceLogic] 所有连接均与新接口兼容` // 保持与中文环境一致
      );
    }

    // REMOVED: Direct call to markAsDirty
    // tabStore.updateTab(currentTabId, { isDirty: true }); // 使用 tabStore 实例

    // Return the calculated changes
    return {
      success: true,
      updatedNodeData: newNodeData, // Return the complete new data object
      edgeIdsToRemove: edgesToRemove, // Return the list of edge IDs to remove
    };
  } catch (error) {
    console.error(
      `[updateNodeGroupWorkflowReferenceLogic] Error updating node ${nodeId} with workflow ${newWorkflowId}:`,
      error
    );
    alert(`更新节点组引用失败: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false }; // <-- Return object
  }
}

// --- 辅助函数：createGroupFromSelectionLogic ---
// 移到 useWorkflowGrouping 外部，并将依赖项作为参数传递
async function createGroupFromSelectionLogic(
  selectedNodeIds: string[],
  currentTabId: string,
  state: TabWorkflowState, // 传递解析后的状态
  // 依赖项:
  workflowStore: ReturnType<typeof useWorkflowStore>,
  tabStore: ReturnType<typeof useTabStore>,
  nodeDefinitions: Ref<any[]>, // 假设 nodeDefinitions 是一个 Ref
  generateUniqueNodeId: (tabId: string, prefix?: string) => string,
  workflowDataHandler: ReturnType<typeof useWorkflowData>,
  projectStore: ReturnType<typeof useProjectStore>,
  getEdgeStyleProps: (sourceType: string, targetType: string, isDark: boolean) => any,
  isDark: Ref<boolean>,
  // ADDED Dependency:
  workflowViewManagement: ReturnType<typeof import('../workflow/useWorkflowViewManagement').useWorkflowViewManagement>
) {
  console.debug(`[GROUPING_LOGIC_START] Called createGroupFromSelectionLogic for tab ${currentTabId} with selected nodes:`, selectedNodeIds);
  const allNodes = state.elements.filter(
    (el: VueFlowNode | VueFlowEdge) => !("source" in el)
  ) as VueFlowNode[];
  const allEdges = state.elements.filter(
    (el: VueFlowNode | VueFlowEdge) => "source" in el
  ) as VueFlowEdge[];
  const selectedNodes = allNodes.filter((node) => selectedNodeIds.includes(node.id));

  const selectedNodeIdSet = new Set(selectedNodeIds);

  // --- 分析边界连接和内部元素 ---
  const groupInputsMap = new Map<
    string,
    {
      originalTargetNodeId: string;
      originalTargetHandle: string;
      dataFlowType: DataFlowTypeName; // Changed from type: string
      name: string;
      description?: string;
      matchCategories?: string[]; // 添加 matchCategories 类型
    }
  >();
  const groupOutputsMap = new Map<
    string,
    {
      originalSourceNodeId: string;
      originalSourceHandle: string;
      dataFlowType: DataFlowTypeName; // Changed from type: string
      name: string;
      description?: string;
      matchCategories?: string[]; // 添加 matchCategories 类型
    }
  >();
  const externalToGroupNodeConnections: {
    externalNodeId: string;
    externalHandle: string;
    groupSlotKey: string;
    isInput: boolean;
    originalEdgeId: string;
  }[] = [];
  const internalEdges: VueFlowEdge[] = [];
  const nodesToGroup: VueFlowNode[] = selectedNodes;
  const boundaryEdges: VueFlowEdge[] = [];

  // --- 分离内部和边界边 ---
  allEdges.forEach((edge) => {
    const isSourceSelected = selectedNodeIdSet.has(edge.source);
    const isTargetSelected = selectedNodeIdSet.has(edge.target);

    if (isSourceSelected && isTargetSelected) {
      internalEdges.push(edge);
    } else if (isSourceSelected || isTargetSelected) {
      boundaryEdges.push(edge);
    }
  });

  // --- 确定接口 (Inputs/Outputs) 和外部连接 ---
  boundaryEdges.forEach((edge) => {
    const isSourceSelected = selectedNodeIdSet.has(edge.source);
    if (!isSourceSelected) {
      // 外部 -> 选定（推断为组输入）
      const targetNode = nodesToGroup.find((n) => n.id === edge.target);
      const targetHandleId = edge.targetHandle || "default_target";
      const groupSlotKey = `${edge.target}_${targetHandleId}`;

      if (!groupInputsMap.has(groupSlotKey) && targetNode) {
        let slotDefinitionForGroupMap: GroupSlotInfo | undefined;
        if (targetNode.type === 'core:NodeGroup' && targetNode.data?.groupInterface?.inputs && targetNode.data.groupInterface.inputs[targetHandleId]) {
          slotDefinitionForGroupMap = targetNode.data.groupInterface.inputs[targetHandleId];
        } else {
          const fullTargetNodeType = getNodeType(targetNode);
          const targetTypeParts = fullTargetNodeType.split(':');
          let staticNodeDef;
          if (targetTypeParts.length === 2) {
            const [namespace, baseType] = targetTypeParts;
            staticNodeDef = nodeDefinitions.value.find(def => def.namespace === namespace && def.type === baseType);
          } else if (targetTypeParts.length === 1 && fullTargetNodeType.trim() !== '') {
            staticNodeDef = nodeDefinitions.value.find(def => def.namespace === 'core' && def.type === fullTargetNodeType) ||
              nodeDefinitions.value.find(def => def.type === fullTargetNodeType);
          }
          const staticInputDef = staticNodeDef?.inputs?.[targetHandleId];
          if (staticInputDef) {
            slotDefinitionForGroupMap = {
              key: targetHandleId,
              displayName: staticInputDef.displayName || staticInputDef.name || targetHandleId,
              dataFlowType: staticInputDef.dataFlowType,
              matchCategories: staticInputDef.matchCategories || [],
              customDescription: staticInputDef.description,
              required: staticInputDef.required,
              config: staticInputDef.config,
              allowDynamicType: staticInputDef.allowDynamicType,
            };
          }
        }

        // For logging external source info (remains the same)
        const externalSourceNode = allNodes.find((n) => n.id === edge.source);
        // const externalSourceNodeType = getNodeType(externalSourceNode); // Not strictly needed for log
        const externalSourceNodeDef = externalSourceNode
          ? nodeDefinitions.value.find((def: any) => def.type === getNodeType(externalSourceNode)) // getNodeType here
          : undefined;
        const externalSourceHandleId = edge.sourceHandle || "default_source";
        const externalOutputDef = externalSourceNodeDef?.outputs?.[externalSourceHandleId];

        console.debug(
          `[GROUPING_INPUT_LOG] Edge ${edge.id}: External Source (${edge.source}:${externalSourceHandleId}, DefType: ${externalOutputDef?.dataFlowType}) -> Internal Target (${edge.target}:${targetHandleId}, DefType: ${slotDefinitionForGroupMap?.dataFlowType}). Assigning to Group Input Slot ${groupSlotKey} with Type: ${slotDefinitionForGroupMap?.dataFlowType || DataFlowType.CONVERTIBLE_ANY}`
        );

        groupInputsMap.set(groupSlotKey, {
          originalTargetNodeId: edge.target,
          originalTargetHandle: targetHandleId,
          dataFlowType: slotDefinitionForGroupMap?.dataFlowType || DataFlowType.CONVERTIBLE_ANY,
          name: slotDefinitionForGroupMap?.displayName || targetHandleId,
          description: slotDefinitionForGroupMap?.customDescription, // Primarily use internal slot's description
          matchCategories: slotDefinitionForGroupMap?.matchCategories || [],
        });
      }
      externalToGroupNodeConnections.push({
        externalNodeId: edge.source,
        externalHandle: edge.sourceHandle || "default_source",
        groupSlotKey: groupSlotKey,
        isInput: true,
        originalEdgeId: edge.id,
      });
    } else {
      // 选定 -> 外部（推断为组输出）
      const sourceNode = nodesToGroup.find((n) => n.id === edge.source);
      const sourceHandleId = edge.sourceHandle || "default_source";
      const groupSlotKey = `${edge.source}_${sourceHandleId}`;

      if (!groupOutputsMap.has(groupSlotKey) && sourceNode) {
        let slotDefinitionForGroupMap: GroupSlotInfo | undefined;
        if (sourceNode.type === 'core:NodeGroup' && sourceNode.data?.groupInterface?.outputs && sourceNode.data.groupInterface.outputs[sourceHandleId]) {
          slotDefinitionForGroupMap = sourceNode.data.groupInterface.outputs[sourceHandleId];
        } else {
          const fullSourceNodeType = getNodeType(sourceNode);
          const sourceTypeParts = fullSourceNodeType.split(':');
          let staticNodeDef;
          if (sourceTypeParts.length === 2) {
            const [namespace, baseType] = sourceTypeParts;
            staticNodeDef = nodeDefinitions.value.find(def => def.namespace === namespace && def.type === baseType);
          } else if (sourceTypeParts.length === 1 && fullSourceNodeType.trim() !== '') {
            staticNodeDef = nodeDefinitions.value.find(def => def.namespace === 'core' && def.type === fullSourceNodeType) ||
              nodeDefinitions.value.find(def => def.type === fullSourceNodeType);
          }
          const staticOutputDef = staticNodeDef?.outputs?.[sourceHandleId];
          if (staticOutputDef) {
            slotDefinitionForGroupMap = {
              key: sourceHandleId,
              displayName: staticOutputDef.displayName || staticOutputDef.name || sourceHandleId,
              dataFlowType: staticOutputDef.dataFlowType,
              matchCategories: staticOutputDef.matchCategories || [],
              customDescription: staticOutputDef.description,
              required: staticOutputDef.required,
              config: staticOutputDef.config,
              allowDynamicType: staticOutputDef.allowDynamicType,
            };
          }
        }

        // For logging external target info (remains the same)
        const externalTargetNode = allNodes.find((n) => n.id === edge.target);
        // const externalTargetNodeType = getNodeType(externalTargetNode); // Not strictly needed for log
        const externalTargetNodeDef = externalTargetNode
          ? nodeDefinitions.value.find((def: any) => def.type === getNodeType(externalTargetNode)) // getNodeType here
          : undefined;
        const externalTargetHandleId = edge.targetHandle || "default_target";
        const externalTargetInputDef = externalTargetNodeDef?.inputs?.[externalTargetHandleId];

        console.debug(
          `[GROUPING_OUTPUT_LOG] Edge ${edge.id}: Internal Source (${edge.source}:${sourceHandleId}, DefType: ${slotDefinitionForGroupMap?.dataFlowType}) -> External Target (${edge.target}:${externalTargetHandleId}, DefType: ${externalTargetInputDef?.dataFlowType}). Assigning to Group Output Slot ${groupSlotKey} with Type: ${slotDefinitionForGroupMap?.dataFlowType || DataFlowType.CONVERTIBLE_ANY}`
        );

        groupOutputsMap.set(groupSlotKey, {
          originalSourceNodeId: edge.source,
          originalSourceHandle: sourceHandleId,
          dataFlowType: slotDefinitionForGroupMap?.dataFlowType || DataFlowType.CONVERTIBLE_ANY,
          name: slotDefinitionForGroupMap?.displayName || sourceHandleId,
          description: slotDefinitionForGroupMap?.customDescription, // Primarily use internal slot's description
          matchCategories: slotDefinitionForGroupMap?.matchCategories || [],
        });
      }
      externalToGroupNodeConnections.push({
        externalNodeId: edge.target,
        externalHandle: edge.targetHandle || "default_target",
        groupSlotKey: groupSlotKey,
        isInput: false,
        originalEdgeId: edge.id,
      });
    }
  });

  // --- 计算选区边界框和中心点 ---
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let sumX = 0,
    sumY = 0;
  if (nodesToGroup.length > 0) {
    nodesToGroup.forEach((n) => {
      const nodeWidth = typeof n.width === "number" ? n.width : 200;
      const nodeHeight = typeof n.height === "number" ? n.height : 100;
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + nodeWidth);
      maxY = Math.max(maxY, n.position.y + nodeHeight);
      sumX += n.position.x + nodeWidth / 2;
      sumY += n.position.y + nodeHeight / 2;
    });
  } else {
    minX = 100;
    minY = 100;
    maxX = 300;
    maxY = 200;
  }
  const selectionWidth = maxX - minX;
  const selectionHeight = maxY - minY;
  const selectionCenterX = minX + selectionWidth / 2;
  const selectionCenterY = minY + selectionHeight / 2;

  // --- 计算新工作流画布的原点和幻影节点位置 ---
  const groupOriginX = 150;
  const groupOriginY = 150;
  const phantomNodeSpacing = 60;
  const groupInputPosX = groupOriginX - phantomNodeSpacing - 150;
  const groupOutputPosX = groupOriginX + selectionWidth + phantomNodeSpacing;
  const groupIOPosY = groupOriginY + selectionHeight / 2;

  // --- 构建新的工作流对象 (运行时格式 VueFlowNode, VueFlowEdge) ---
  const tempRuntimeNodes: VueFlowNode[] = [];
  const tempRuntimeEdges: VueFlowEdge[] = [];

  // 1. 创建 GroupInput 和 GroupOutput 幻影节点 (VueFlowNode格式)
  const groupInputNodeId = generateUniqueNodeId(currentTabId, "GroupInput");
  const groupOutputNodeId = generateUniqueNodeId(currentTabId, "GroupOutput");

  const groupInputVueNode: VueFlowNode = {
    id: groupInputNodeId,
    type: "core:GroupInput",
    position: { x: groupInputPosX, y: groupIOPosY - 50 },
    data: { nodeType: "core:GroupInput", label: "组输入" }, // 保持 data 简洁
    // width, height 等可以从定义或默认值获取
  };
  tempRuntimeNodes.push(groupInputVueNode);

  const groupOutputVueNode: VueFlowNode = {
    id: groupOutputNodeId,
    type: "core:GroupOutput",
    position: { x: groupOutputPosX, y: groupIOPosY - 50 },
    data: { nodeType: "core:GroupOutput", label: "组输出" }, // 保持 data 简洁
  };
  tempRuntimeNodes.push(groupOutputVueNode);

  // 2. 添加选中的节点到新工作流（调整位置, VueFlowNode格式）
  nodesToGroup.forEach((originalNode) => {
    // --- START DIAGNOSTIC LOGS for NodeGroup data V3 ---
    // 检查 Ba-fAru2l7 或任何 core:NodeGroup 类型的节点
    // 注意：'Ba-fAru2l7' 是示例 ID，实际场景中可能是其他 ID
    if (originalNode.type === 'core:NodeGroup') {
      try {
        // 记录进入循环时 originalNode.data 的状态
        const dataSnapshot = originalNode.data ? JSON.parse(JSON.stringify(originalNode.data)) : undefined;
        console.log(`[GROUPING_LOGIC_COPY_V3] Node ${originalNode.id} (type: ${originalNode.type}) - IN LOOP START - originalNode.data (snapshot):`, dataSnapshot);
        if (originalNode.data === undefined) {
          console.warn(`[GROUPING_LOGIC_COPY_V3] Node ${originalNode.id} (type: ${originalNode.type}) - originalNode.data is ALREADY UNDEFINED upon entering forEach loop.`);
        } else if (originalNode.data && dataSnapshot.groupInterface === undefined && originalNode.data.referencedWorkflowId) {
          // 如果 data 存在，但 groupInterface 缺失，且它是一个已引用的节点组
          console.warn(`[GROUPING_LOGIC_COPY_V3] Node ${originalNode.id} (type: ${originalNode.type}) - originalNode.data exists BUT groupInterface is UNDEFINED. ReferencedWorkflowId: ${originalNode.data.referencedWorkflowId}`);
        }
      } catch (e) {
        console.error(`[GROUPING_LOGIC_COPY_V3] Error stringifying originalNode.data for ${originalNode.id} at loop start:`, e);
        console.log(`[GROUPING_LOGIC_COPY_V3] Node ${originalNode.id} (type: ${originalNode.type}) - originalNode.data (raw, at loop start):`, originalNode.data);
      }
    }
    // --- END DIAGNOSTIC LOGS V3 ---

    // 使用 toRaw 获取原始对象，避免 Vue 的响应式代理带来的问题，然后深拷贝
    const rawNode = toRaw(originalNode);
    const nodeCopy = JSON.parse(JSON.stringify(rawNode)) as VueFlowNode;

    nodeCopy.position = {
      x: originalNode.position.x - selectionCenterX + groupOriginX + selectionWidth / 2,
      y: originalNode.position.y - selectionCenterY + groupOriginY + selectionHeight / 2,
    };
    // 清理运行时状态，确保 data 是干净的，或者只包含应该传递给 transformVueFlowToCoreWorkflow 的部分
    // nodeCopy.selected = false; // Removed: VueFlowNode base type doesn't have 'selected'
    // nodeCopy.dragging = false; // Removed: VueFlowNode base type doesn't have 'dragging'
    nodeCopy.parentNode = undefined; // 组内节点不应有父节点
    // vueNode.data.inputs 结构在 transformVueFlowToCoreWorkflow 中有特殊处理
    // 确保 nodeCopy.data 结构与 transformVueFlowToCoreWorkflow 的期望一致
    // 通常，原始节点的 data 已经包含了 inputValues 等信息，可以直接传递
    tempRuntimeNodes.push(nodeCopy);
  });

  // 3. 添加内部边到新工作流 (VueFlowEdge格式)
  internalEdges.forEach((originalEdge) => {
    const rawEdge = toRaw(originalEdge);
    const edgeCopy = JSON.parse(JSON.stringify(rawEdge)) as VueFlowEdge;
    // 可以根据需要清理或调整 edgeCopy.data
    tempRuntimeEdges.push(edgeCopy);
  });

  // 4. Connect internal nodes to phantom IO nodes based on boundary edges (VueFlowEdge格式)
  boundaryEdges.forEach((originalBoundaryEdge) => {
    const isSourceSelected = selectedNodeIdSet.has(originalBoundaryEdge.source);

    if (!isSourceSelected) {
      // External -> Internal (Connect GroupInput to Internal Target)
      const targetHandleId = originalBoundaryEdge.targetHandle || "default_target"; // Use the same logic as before
      const groupSlotKey = `${originalBoundaryEdge.target}_${targetHandleId}`; // Derive the key

      // Ensure the corresponding slot exists in the map (it should, based on earlier logic)
      const inputSlotInfo = groupInputsMap.get(groupSlotKey);
      if (inputSlotInfo) {
        // Determine types for styling. GroupInput acts as the source.
        // Use the slot's dataFlowType as both source and target for styling consistency within the group.
        const edgeSourceType = inputSlotInfo.dataFlowType || DataFlowType.CONVERTIBLE_ANY; // type here is actually dataFlowType from map
        const edgeTargetType = inputSlotInfo.dataFlowType || DataFlowType.CONVERTIBLE_ANY; // type here is actually dataFlowType from map
        const styleProps = getEdgeStyleProps(edgeSourceType, edgeTargetType, isDark.value);
        tempRuntimeEdges.push({
          id: uuidv4(), // Use UUID for unique ID
          source: groupInputNodeId,
          sourceHandle: groupSlotKey, // Use the derived slot key as the handle on GroupInput
          target: originalBoundaryEdge.target, // The internal node
          targetHandle: targetHandleId, // The handle on the internal node
          ...styleProps, // Apply dynamic styles
          data: { sourceType: edgeSourceType, targetType: edgeTargetType }, // Store types in data
        });
      } else {
        console.warn(`[createGroupFromSelectionLogic] Mismatch: Boundary edge ${originalBoundaryEdge.id} target ${originalBoundaryEdge.target}:${targetHandleId} has no corresponding entry in groupInputsMap.`);
      }
    } else {
      // Internal -> External (Connect Internal Source to GroupOutput)
      const sourceHandleId = originalBoundaryEdge.sourceHandle || "default_source"; // Use the same logic as before
      const groupSlotKey = `${originalBoundaryEdge.source}_${sourceHandleId}`; // Derive the key

      // Ensure the corresponding slot exists in the map
      const outputSlotInfo = groupOutputsMap.get(groupSlotKey);
      if (outputSlotInfo) {
        const edgeSourceType = outputSlotInfo.dataFlowType || DataFlowType.CONVERTIBLE_ANY;
        const edgeTargetType = outputSlotInfo.dataFlowType || DataFlowType.CONVERTIBLE_ANY;
        const styleProps = getEdgeStyleProps(edgeSourceType, edgeTargetType, isDark.value);

        tempRuntimeEdges.push({
          id: uuidv4(), // Use UUID for unique ID
          source: originalBoundaryEdge.source, // The internal node
          sourceHandle: sourceHandleId, // The handle on the internal node
          target: groupOutputNodeId,
          targetHandle: groupSlotKey, // Use the derived slot key as the handle on GroupOutput
          ...styleProps, // Apply dynamic styles
          data: { sourceType: edgeSourceType, targetType: edgeTargetType }, // Store types in data
        });
      } else {
        console.warn(`[createGroupFromSelectionLogic] Mismatch: Boundary edge ${originalBoundaryEdge.id} source ${originalBoundaryEdge.source}:${sourceHandleId} has no corresponding entry in groupOutputsMap.`);
      }
    }
  });

  // 5. 定义新工作流的接口 (这部分逻辑不变)
  // 5. 定义新工作流的接口
  console.debug('[GROUPING_LOGIC_INTERFACE] Group Inputs Map:', JSON.parse(JSON.stringify(Object.fromEntries(groupInputsMap))));
  const newWorkflowInterfaceInputs: Record<string, GroupSlotInfo> = {};
  groupInputsMap.forEach((info, key) => {
    newWorkflowInterfaceInputs[key] = {
      key,
      displayName: info.name,
      dataFlowType: info.dataFlowType as DataFlowTypeName, // Changed info.type to info.dataFlowType
      customDescription: info.description, // Assign original description to customDescription
      matchCategories: info.matchCategories, // 确保从 info 对象中获取 matchCategories
    };
  });

  console.debug('[GROUPING_LOGIC_INTERFACE] Group Outputs Map:', JSON.parse(JSON.stringify(Object.fromEntries(groupOutputsMap))));
  const newWorkflowInterfaceOutputs: Record<string, GroupSlotInfo> = {};
  groupOutputsMap.forEach((info, key) => {
    newWorkflowInterfaceOutputs[key] = {
      key,
      displayName: info.name,
      dataFlowType: info.dataFlowType as DataFlowTypeName, // Changed info.type to info.dataFlowType
      customDescription: info.description, // Assign original description to customDescription
      matchCategories: info.matchCategories, // 确保从 info 对象中获取 matchCategories
    };
  });

  // 6. 将运行时的节点和边转换为存储格式 (WorkflowStorageObject)
  const tempFlowExportObject: import('@vue-flow/core').FlowExportObject = {
    nodes: tempRuntimeNodes,
    edges: tempRuntimeEdges,
    viewport: { // Corrected to use viewport object
      x: 0,       // Default viewport x
      y: 0,       // Default viewport y
      zoom: 1,      // Default viewport zoom
    },
    position: [0, 0], // Added to satisfy FlowExportObject type
    zoom: 1,          // Added to satisfy FlowExportObject type
  };

  // 调用转换函数，它内部会处理节点数据的差异化存储
  const coreWorkflowData = transformVueFlowToCoreWorkflow(tempFlowExportObject);

  // 7. 组装最终的 WorkflowStorageObject 用于保存
  const finalWorkflowToSave: Omit<WorkflowObject, "id" | "createdAt" | "updatedAt" | "version" | "referencedWorkflows" | "projectId"> = {
    name: `分组_${uuidv4().substring(0, 6)}`,
    nodes: coreWorkflowData.nodes, // 使用转换后的差异化节点数据
    edges: coreWorkflowData.edges, // 使用转换后的边数据
    viewport: coreWorkflowData.viewport, // 使用转换后的视口数据
    interfaceInputs: newWorkflowInterfaceInputs, // 接口定义仍然需要
    interfaceOutputs: newWorkflowInterfaceOutputs,
  };


  // --- 保存新工作流 ---
  const projectId = projectStore.currentProjectId; // 使用 projectStore 实例
  if (!projectId) {
    console.error(
      "[createGroupFromSelectionLogic] Cannot save new workflow: Project ID is missing."
    );
    alert("无法创建节点组：当前项目未设定。");
    return;
  }

  let savedWorkflowData: WorkflowObject | null = null;
  try {
    savedWorkflowData = await workflowDataHandler.saveWorkflowAsNew(
      projectId,
      finalWorkflowToSave // 保存最终处理过的对象
    ); // 使用 workflowDataHandler 实例
    if (!savedWorkflowData || !savedWorkflowData.id) {
      throw new Error("Failed to save the new workflow file or received invalid data.");
    }
  } catch (error) {
    console.error("[createGroupFromSelectionLogic] Error saving new workflow:", error);
    alert(
      `创建节点组失败：无法保存新的工作流文件。\n${error instanceof Error ? error.message : String(error)
      }`
    );
    return;
  }

  const newWorkflowId = savedWorkflowData.id;
  console.log(
    `[createGroupFromSelectionLogic] Saved new workflow file for group with ID: ${newWorkflowId}`
  );
  await workflowStore.fetchAvailableWorkflows(); // 使用 workflowStore 实例

  // --- 创建 NodeGroup 实例来替换选区 ---
  const nodeGroupNodeId = generateUniqueNodeId(currentTabId, "NodeGroup"); // 使用 generateUniqueNodeId 实例
  const nodeGroupDef = nodeDefinitions.value.find(
    (def: any) => def.namespace === 'core' && def.type === 'NodeGroup'
  ); // 使用 nodeDefinitions 实例

  if (!nodeGroupDef) {
    console.error("[createGroupFromSelectionLogic] NodeGroup definition (namespace: 'core', type: 'NodeGroup') not found in nodeDefinitions.value!");
    alert("创建节点组失败：找不到 NodeGroup 定义。");
    return;
  }

  const nodeGroupInterfaceSnapshot: GroupInterfaceInfo = {
    inputs: newWorkflowInterfaceInputs,
    outputs: newWorkflowInterfaceOutputs,
  };

  const baseNodeData = JSON.parse(JSON.stringify(nodeGroupDef));
  delete baseNodeData.inputs;
  delete baseNodeData.outputs;
  delete baseNodeData.type;

  const referencedWorkflowBaseName = savedWorkflowData.name; // savedWorkflowData.name 已经是 "分组_xxxxxx" 格式
  const groupDisplayLabel = `📦 ${referencedWorkflowBaseName}`;

  const nodeGroupInstance: VueFlowNode = {
    id: nodeGroupNodeId,
    type: "core:NodeGroup", // 使用带命名空间的类型
    label: groupDisplayLabel, // 设置顶层 label
    position: { x: selectionCenterX, y: selectionCenterY },
    data: {
      ...baseNodeData,
      nodeType: "core:NodeGroup", // 同步更新 data.nodeType
      label: groupDisplayLabel, // 同时保留 data.label
      configValues: {
        ...(baseNodeData.configValues || {}),
        groupMode: "referenced",
        referencedWorkflowId: newWorkflowId,
      },
      referencedWorkflowId: newWorkflowId,
      groupInterface: nodeGroupInterfaceSnapshot,
    },
    width: nodeGroupDef.width || 250,
  };
  console.debug(
    `[GROUPING_LOGIC_INSTANCE] Created NodeGroup instance ${nodeGroupNodeId} with interface:`,
    JSON.parse(JSON.stringify(nodeGroupInterfaceSnapshot)),
    "Full instance data:",
    JSON.parse(JSON.stringify(nodeGroupInstance))
  );

  // --- 修改主画布元素 ---
  const nodeIdsToRemove = new Set(selectedNodeIds);
  const edgeIdsToRemove = new Set<string>();
  internalEdges.forEach((e) => edgeIdsToRemove.add(e.id));
  boundaryEdges.forEach((e) => edgeIdsToRemove.add(e.id));

  const remainingElements = state.elements.filter((el: VueFlowNode | VueFlowEdge) => {
    if ("source" in el) return !edgeIdsToRemove.has(el.id);
    else return !nodeIdsToRemove.has(el.id);
  });

  remainingElements.push(nodeGroupInstance);

  externalToGroupNodeConnections.forEach((conn) => {
    const isInput = conn.isInput;
    const groupSlotKey = conn.groupSlotKey;
    if (typeof groupSlotKey !== "string" || !groupSlotKey) {
      console.warn(
        `[createGroupFromSelectionLogic] Invalid group slot key found while reconnecting external edge ${conn.originalEdgeId}. Skipping edge.`
      );
      return;
    }
    const groupSlot = isInput
      ? nodeGroupInterfaceSnapshot.inputs?.[groupSlotKey]
      : nodeGroupInterfaceSnapshot.outputs?.[groupSlotKey];

    if (!groupSlot) {
      console.warn(
        `[createGroupFromSelectionLogic] Could not find group slot for key ${groupSlotKey} while reconnecting external edge ${conn.originalEdgeId}. Skipping edge.`
      );
      return;
    }

    if (!groupSlot) {
      // 冗余检查，但能让 TS 在循环内保持正常
      console.warn(
        `[createGroupFromSelectionLogic] Internal error: groupSlot became undefined after check for edge ${conn.originalEdgeId}. Skipping.`
      );
      return;
    }
    const slotDft = groupSlot.dataFlowType || DataFlowType.CONVERTIBLE_ANY;
    const sourceType = isInput ? DataFlowType.CONVERTIBLE_ANY : slotDft;
    const targetType = isInput ? slotDft : DataFlowType.CONVERTIBLE_ANY;


    const styleProps = getEdgeStyleProps(sourceType, targetType, isDark.value); // 使用 getEdgeStyleProps 和 isDark 实例

    const newEdge: VueFlowEdge = {
      id: uuidv4(), // 使用 UUID 保证唯一性，避免重复 key 问题
      source: isInput ? conn.externalNodeId : nodeGroupInstance.id,
      sourceHandle: isInput ? conn.externalHandle : conn.groupSlotKey,
      target: isInput ? nodeGroupInstance.id : conn.externalNodeId,
      targetHandle: isInput ? conn.groupSlotKey : conn.externalHandle,
      type: "default",
      ...styleProps,
      data: { sourceType, targetType },
    };
    console.debug('[GROUPING_NEW_EDGE_INFO] Attempting to create edge:', {
      id: newEdge.id,
      source: newEdge.source,
      sourceHandle: newEdge.sourceHandle,
      target: newEdge.target,
      targetHandle: newEdge.targetHandle,
      type: newEdge.type,
      style: newEdge.style,
      markerEnd: newEdge.markerEnd,
      data: newEdge.data,
    });
    console.debug(
      `[GROUPING_LOGIC_RECONNECT] Creating edge for NodeGroup ${nodeGroupInstance.id}: `,
      `Source: ${newEdge.source} (Handle: ${newEdge.sourceHandle}, Type: ${sourceType}), `,
      `Target: ${newEdge.target} (Handle: ${newEdge.targetHandle}, Type: ${targetType}), `,
      `Original External Node: ${conn.externalNodeId}, Original External Handle: ${conn.externalHandle}, IsInputToGroup: ${isInput}`
    );
    remainingElements.push(newEdge);
  });

  // --- 更新状态和实例 (Command-based update BEFORE snapshot) ---
  const instance = workflowViewManagement.getVueFlowInstance(currentTabId);
  let finalViewport = state.viewport; // Default to state viewport

  if (instance) {
    try {
      console.debug(`[createGroupFromSelectionLogic] Applying command-based update for tab ${currentTabId}`);
      const nodes = remainingElements.filter((el): el is VueFlowNode => !("source" in el));
      const edges = remainingElements.filter((el): el is VueFlowEdge => "source" in el);
      finalViewport = instance.getViewport(); // Get current viewport BEFORE clearing

      // Clear
      instance.setNodes([]);
      instance.setEdges([]);
      await nextTick();

      // Set
      instance.setNodes(nodes);
      instance.setEdges(edges);
      instance.setViewport(finalViewport); // Restore viewport
      await nextTick();

      // Update Internals
      const nodeIds = nodes.map((n) => n.id);
      if (nodeIds.length > 0) {
        instance.updateNodeInternals(nodeIds);
      }
      await nextTick(); // Extra tick for safety
      console.debug(`[createGroupFromSelectionLogic] Command-based update applied for tab ${currentTabId}`);

    } catch (error) {
      console.error(`[createGroupFromSelectionLogic] Error during command-based update for tab ${currentTabId}:`, error);
      // Fallback or decide how to proceed if instance update fails
    }
  } else {
    console.warn(`[createGroupFromSelectionLogic] No VueFlow instance found for tab ${currentTabId}. Cannot apply command-based update.`);
    // If no instance, we still need to update the store's state directly
    workflowStore.setElements(currentTabId, remainingElements);
    // Viewport might be stale if instance wasn't available
  }

  // **Crucially, update the manager's state AFTER instance update (or if no instance)**
  // This ensures the state used for the snapshot is correct.
  workflowStore.setElements(currentTabId, remainingElements);
  // Optionally update viewport in store if needed, using finalViewport
  // workflowStore.setViewport(currentTabId, finalViewport); // Assuming setViewport exists or is handled by setElements

  // **Record history AFTER instance and store state are updated, using a constructed snapshot**
  // Get the workflow data for the snapshot
  const currentWorkflowData = workflowStore.getWorkflowData(currentTabId);
  if (!currentWorkflowData) {
    console.error(`[createGroupFromSelectionLogic] Failed to get workflow data for tab ${currentTabId} before recording snapshot.`);
    // Handle error - maybe don't record history?
  } else {
    // Construct the snapshot payload manually
    const snapshotPayload: WorkflowStateSnapshot = {
      elements: remainingElements, // Use the calculated final elements
      viewport: finalViewport,     // Use the final viewport
      workflowData: currentWorkflowData // Use the fetched workflow data
    };
    console.debug(`[createGroupFromSelectionLogic] Recording history with constructed snapshot for tab ${currentTabId}`);
    // 创建 HistoryEntry 对象
    const historyEntry: HistoryEntry = createHistoryEntry(
      'create', // actionType
      'nodeGroup', // objectType
      `创建节点组: ${nodeGroupInstance.label || nodeGroupNodeId}`, // summary
      { nodeId: nodeGroupNodeId, referencedWorkflowId: newWorkflowId } // details
    );
    workflowStore.recordHistorySnapshot(
      historyEntry, // <-- Pass HistoryEntry object
      snapshotPayload // Pass the constructed payload
    );
  }
  tabStore.updateTab(currentTabId, { isDirty: true });

  // --- 打开新工作流的标签页 ---
  tabStore.openGroupEditorTab(newWorkflowId, projectId); // 使用 tabStore 实例
}

// --- 主要 Composable 函数 ---
export function useWorkflowGrouping() {
  // 在此处获取所有必要的 store 和 composable
  const workflowStore = useWorkflowStore();
  const tabStore = useTabStore();
  const nodeStore = useNodeStore();
  const themeStore = useThemeStore();
  const projectStore = useProjectStore();
  const { nodeDefinitions } = storeToRefs(nodeStore);
  const { isDark } = storeToRefs(themeStore);
  const { generateUniqueNodeId } = useUniqueNodeId();
  const { getEdgeStyleProps } = useEdgeStyles();
  const workflowDataHandler = useWorkflowData();

  /**
   * 公开的函数，用于从外部（如快捷键）触发分组过程。
   * @param selectedNodeIds 要分组的节点 ID 列表。
   * @param currentTabId 当前活动标签页的 ID。
   */
  async function groupSelectedNodes(selectedNodeIds: string[], currentTabId: string) {
    if (!currentTabId) {
      console.error("[groupSelectedNodes] Cannot create group: No currentTabId provided.");
      return;
    }
    if (!selectedNodeIds || selectedNodeIds.length === 0) {
      console.warn("[groupSelectedNodes] No nodes selected for grouping.");
      return;
    }

    // 等待 ensureTabState 返回的状态
    const state = await workflowStore.ensureTabState(currentTabId);

    // 调用核心逻辑函数（现在是异步的），传递依赖项
    try {
      await createGroupFromSelectionLogic(
        selectedNodeIds,
        currentTabId,
        state,
        // 传递依赖项:
        workflowStore,
        tabStore,
        nodeDefinitions,
        generateUniqueNodeId,
        workflowDataHandler,
        projectStore,
        getEdgeStyleProps,
        isDark,
        // ADDED Dependency:
        useWorkflowViewManagement() // Assuming it can be instantiated here or passed down
      );
      console.log(`[groupSelectedNodes] Grouping logic executed for tab ${currentTabId}.`);
      // 历史记录在 createGroupFromSelectionLogic 内部处理
    } catch (error) {
      console.error("[groupSelectedNodes] Error executing grouping logic:", error);
      // TODO: 添加用户反馈（例如，toast 通知）
    }
  }

  // 用于导出的 updateNodeGroupWorkflowReference 的包装函数
  // 此包装器将从 composable 作用域获取必要的依赖项
  async function updateNodeGroupWorkflowReference(
    nodeId: string,
    newWorkflowId: string,
    tabId?: string
  ): Promise<{ success: boolean; updatedNodeData?: any; edgeIdsToRemove?: string[] }> { // <-- Update return type here too
    // REMOVED: updateNodeData dependency from the call
    return updateNodeGroupWorkflowReferenceLogic(
      nodeId,
      newWorkflowId,
      tabId,
      // 从 composable 作用域传递依赖项:
      workflowStore,
      tabStore,
      workflowDataHandler,
      nodeDefinitions
      // REMOVED: updateNodeData
    );
  }

  // 返回函数，以便外部可以使用它
  return {
    groupSelectedNodes, // 导出公共触发函数
    updateNodeGroupWorkflowReference, // 导出包装后的工作流引用更新函数
  };
}
