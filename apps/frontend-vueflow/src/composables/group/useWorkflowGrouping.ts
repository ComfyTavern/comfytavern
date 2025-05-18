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
  WorkflowNode,
  WorkflowEdge,
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
import { useWorkflowViewManagement } from "../workflow/useWorkflowViewManagement"; // ADDED: Import view management
import { nextTick, type Ref } from "vue"; // 导入 Ref 类型

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

  const isSourceConvertibleAny = isSlotConvertibleAny(sourceDft, sourceCats);
  const isTargetConvertibleAny = isSlotConvertibleAny(targetDft, targetCats);
  const isSourceWildcard = isSlotWildcard(sourceDft, sourceCats);
  const isTargetWildcard = isSlotWildcard(targetDft, targetCats);

  // Priority 1: Special Behavior Tags
  // 1.1 BEHAVIOR_WILDCARD / WILDCARD DataFlowType
  // Source WILDCARD connects to non-CONVERTIBLE_ANY Target.
  if (isSourceWildcard && !isTargetConvertibleAny) return true;
  // Target WILDCARD connects to non-CONVERTIBLE_ANY Source.
  if (isTargetWildcard && !isSourceConvertibleAny) return true;

  // 1.2 BEHAVIOR_CONVERTIBLE / CONVERTIBLE_ANY DataFlowType
  // Source CONVERTIBLE_ANY connects to non-WILDCARD AND non-CONVERTIBLE_ANY Target.
  if (isSourceConvertibleAny) {
    return !isTargetWildcard && !isTargetConvertibleAny;
  }
  // Target CONVERTIBLE_ANY connects to non-WILDCARD AND non-CONVERTIBLE_ANY Source.
  if (isTargetConvertibleAny) {
    return !isSourceWildcard && !isSourceConvertibleAny;
  }

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
  if (sourceDft === targetDft) return true;

  if (sourceDft === DataFlowType.INTEGER && targetDft === DataFlowType.FLOAT) return true;

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
    if (incompatibleEdges.length > 0) {
      const message =
        incompatibleEdges.length === 1
          ? `已断开 1 个不兼容的连接`
          : `已断开 ${incompatibleEdges.length} 个不兼容的连接`;

      alert(`节点组接口已更新。${message}。`);
    } else {
      console.debug(
        `[updateNodeGroupWorkflowReferenceLogic] All connections compatible with the new interface`
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
        const internalTargetNodeType = getNodeType(targetNode);
        const internalTargetNodeDef = nodeDefinitions.value.find(
          (def: any) => def.type === internalTargetNodeType
        );
        const internalInputDef = internalTargetNodeDef?.inputs?.[targetHandleId];
        const externalSourceNode = allNodes.find((n) => n.id === edge.source);
        const externalSourceNodeType = getNodeType(externalSourceNode);
        const externalSourceNodeDef = externalSourceNode
          ? nodeDefinitions.value.find((def: any) => def.type === externalSourceNodeType)
          : undefined;
        const externalSourceHandleId = edge.sourceHandle || "default_source";
        const externalOutputDef = externalSourceNodeDef?.outputs?.[externalSourceHandleId];

        groupInputsMap.set(groupSlotKey, {
          originalTargetNodeId: edge.target,
          originalTargetHandle: targetHandleId,
          dataFlowType: internalInputDef?.dataFlowType || DataFlowType.CONVERTIBLE_ANY, // Use dataFlowType
          name: internalInputDef?.displayName || targetHandleId,
          description: internalInputDef?.description || externalOutputDef?.description,
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
        const internalSourceNodeType = getNodeType(sourceNode);
        const internalSourceNodeDef = nodeDefinitions.value.find(
          (def: any) => def.type === internalSourceNodeType
        );
        const internalOutputDef = internalSourceNodeDef?.outputs?.[sourceHandleId];

        groupOutputsMap.set(groupSlotKey, {
          originalSourceNodeId: edge.source,
          originalSourceHandle: sourceHandleId,
          dataFlowType: internalOutputDef?.dataFlowType || DataFlowType.CONVERTIBLE_ANY, // Use dataFlowType
          name: internalOutputDef?.displayName || sourceHandleId,
          description: internalOutputDef?.description,
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

  // --- 构建新的工作流对象 ---
  const newWorkflowNodes: WorkflowNode[] = [];
  const newWorkflowEdges: WorkflowEdge[] = [];

  // 1. 创建 GroupInput 和 GroupOutput 幻影节点
  const groupInputNodeId = generateUniqueNodeId(currentTabId, "GroupInput");
  const groupOutputNodeId = generateUniqueNodeId(currentTabId, "GroupOutput");
  const groupInputNodeDef: WorkflowNode = {
    id: groupInputNodeId,
    type: "core:GroupInput", // Roo: 使用带命名空间的类型
    position: { x: groupInputPosX, y: groupIOPosY - 50 },
    data: { nodeType: "core:GroupInput", label: "组输入", outputs: {} }, // Roo: 同步更新 data.nodeType
  };
  newWorkflowNodes.push(groupInputNodeDef);

  const groupOutputNodeDef: WorkflowNode = {
    id: groupOutputNodeId,
    type: "core:GroupOutput", // Roo: 使用带命名空间的类型
    position: { x: groupOutputPosX, y: groupIOPosY - 50 },
    data: { nodeType: "core:GroupOutput", label: "组输出", inputs: {} }, // Roo: 同步更新 data.nodeType
  };
  newWorkflowNodes.push(groupOutputNodeDef);

  // 2. 添加选中的节点到新工作流（调整位置）
  nodesToGroup.forEach((originalNode) => {
    const nodeCopy = JSON.parse(JSON.stringify(originalNode)) as VueFlowNode;
    nodeCopy.position = {
      x: originalNode.position.x - selectionCenterX + groupOriginX + selectionWidth / 2,
      y: originalNode.position.y - selectionCenterY + groupOriginY + selectionHeight / 2,
    };
    nodeCopy.data = nodeCopy.data ?? {};
    const workflowNode: WorkflowNode = {
      id: nodeCopy.id,
      type: nodeCopy.type || "unknown",
      position: nodeCopy.position,
      data: nodeCopy.data,
      width: typeof nodeCopy.width === "number" ? nodeCopy.width : undefined,
      height: typeof nodeCopy.height === "number" ? nodeCopy.height : undefined,
      zIndex: nodeCopy.zIndex,
      label: typeof nodeCopy.label === "string" ? nodeCopy.label : undefined,
    };
    newWorkflowNodes.push(workflowNode);
  });

  // 3. 添加内部边到新工作流
  internalEdges.forEach((originalEdge) => {
    const edgeCopy = JSON.parse(JSON.stringify(originalEdge)) as VueFlowEdge;
    edgeCopy.data = edgeCopy.data ?? {};
    const workflowEdge: WorkflowEdge = {
      id: edgeCopy.id,
      source: edgeCopy.source,
      target: edgeCopy.target,
      sourceHandle: edgeCopy.sourceHandle,
      targetHandle: edgeCopy.targetHandle,
      type: edgeCopy.type,
      label: typeof edgeCopy.label === "string" ? edgeCopy.label : undefined,
      markerEnd: edgeCopy.markerEnd,
      data: edgeCopy.data,
    };
    newWorkflowEdges.push(workflowEdge);
  });

  // 4. Connect internal nodes to phantom IO nodes based on boundary edges
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

        newWorkflowEdges.push({
          id: uuidv4(), // Use UUID for unique ID
          source: groupInputNodeId,
          sourceHandle: groupSlotKey, // Use the derived slot key as the handle on GroupInput
          target: originalBoundaryEdge.target, // The internal node
          targetHandle: targetHandleId, // The handle on the internal node
          // type: "default", // Replaced by dynamic style
          // markerEnd: { type: MarkerType.ArrowClosed, color: "#9CA3AF" }, // Replaced by dynamic style
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
        // Determine types for styling. Internal node is the source.
        // Use the slot's dataFlowType as both source and target for styling consistency within the group.
        const edgeSourceType = outputSlotInfo.dataFlowType || DataFlowType.CONVERTIBLE_ANY; // type here is actually dataFlowType from map
        const edgeTargetType = outputSlotInfo.dataFlowType || DataFlowType.CONVERTIBLE_ANY; // type here is actually dataFlowType from map
        const styleProps = getEdgeStyleProps(edgeSourceType, edgeTargetType, isDark.value);

        newWorkflowEdges.push({
          id: uuidv4(), // Use UUID for unique ID
          source: originalBoundaryEdge.source, // The internal node
          sourceHandle: sourceHandleId, // The handle on the internal node
          target: groupOutputNodeId,
          targetHandle: groupSlotKey, // Use the derived slot key as the handle on GroupOutput
          // type: "default", // Replaced by dynamic style
          // markerEnd: { type: MarkerType.ArrowClosed, color: "#9CA3AF" }, // Replaced by dynamic style
          ...styleProps, // Apply dynamic styles
          data: { sourceType: edgeSourceType, targetType: edgeTargetType }, // Store types in data
        });
      } else {
         console.warn(`[createGroupFromSelectionLogic] Mismatch: Boundary edge ${originalBoundaryEdge.id} source ${originalBoundaryEdge.source}:${sourceHandleId} has no corresponding entry in groupOutputsMap.`);
      }
    }
  });

  // 5. 定义新工作流的接口
  const newWorkflowInterfaceInputs: Record<string, GroupSlotInfo> = {};
  groupInputsMap.forEach((info, key) => {
    newWorkflowInterfaceInputs[key] = {
      key,
      displayName: info.name,
      dataFlowType: info.dataFlowType as DataFlowTypeName, // Changed info.type to info.dataFlowType
      customDescription: info.description, // Assign original description to customDescription
    };
  });

  const newWorkflowInterfaceOutputs: Record<string, GroupSlotInfo> = {};
  groupOutputsMap.forEach((info, key) => {
    newWorkflowInterfaceOutputs[key] = {
      key,
      displayName: info.name,
      dataFlowType: info.dataFlowType as DataFlowTypeName, // Changed info.type to info.dataFlowType
      customDescription: info.description, // Assign original description to customDescription
    };
  });

  // 6. 组装最终的新工作流对象（用于保存）
  // Roo: 显式声明类型以包含新字段
  const newWorkflowObjectToSave: Omit<WorkflowObject, "id" | "createdAt" | "updatedAt" | "version" | "referencedWorkflows"> & { creationMethod?: string } = {
    name: `分组_${uuidv4().substring(0, 6)}`,
    nodes: newWorkflowNodes,
    edges: newWorkflowEdges,
    viewport: { x: 0, y: 0, zoom: 1 },
    interfaceInputs: newWorkflowInterfaceInputs,
    interfaceOutputs: newWorkflowInterfaceOutputs,
    // Roo: 添加 creationMethod 字段
    creationMethod: 'group',
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
      newWorkflowObjectToSave
    ); // 使用 workflowDataHandler 实例
    if (!savedWorkflowData || !savedWorkflowData.id) {
      throw new Error("Failed to save the new workflow file or received invalid data.");
    }
  } catch (error) {
    console.error("[createGroupFromSelectionLogic] Error saving new workflow:", error);
    alert(
      `创建节点组失败：无法保存新的工作流文件。\n${
        error instanceof Error ? error.message : String(error)
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
  const nodeGroupDef = nodeDefinitions.value.find((def: any) => def.type === 'core:NodeGroup'); // 使用 nodeDefinitions 实例
  if (!nodeGroupDef) {
    console.error("[createGroupFromSelectionLogic] NodeGroup definition not found!");
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

  const nodeGroupInstance: VueFlowNode = {
    id: nodeGroupNodeId,
    type: "core:NodeGroup", // Roo: 使用带命名空间的类型
    position: { x: selectionCenterX, y: selectionCenterY },
    data: {
      ...baseNodeData,
      nodeType: "core:NodeGroup", // Roo: 同步更新 data.nodeType
      label: savedWorkflowData.name || `分组 ${newWorkflowId}`,
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
