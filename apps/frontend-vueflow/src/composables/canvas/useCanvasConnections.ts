import type { Ref, ComputedRef } from "vue";
import type { Connection, Edge, Node, VueFlowStore } from "@vue-flow/core";
import { getEdgeStyleProps } from "./useEdgeStyles";
import { useGroupInterfaceSync } from "../group/useGroupInterfaceSync";
import {
  type GroupSlotInfo,
  type HistoryEntry,
  type DataFlowTypeName,
  DataFlowType, // Enum-like object
  BuiltInSocketMatchCategory, // Enum-like object
  // InputDefinition and OutputDefinition removed as they are unused
} from "@comfytavern/types";
import { createHistoryEntry, getEffectiveDefaultValue } from "@comfytavern/utils";
import { useTabStore } from "@/stores/tabStore";
import { useWorkflowStore } from "@/stores/workflowStore";
import { getNodeType } from "@/utils/nodeUtils";
import { nanoid } from 'nanoid'; // <-- 导入 nanoid

interface UseCanvasConnectionsOptions {
  getNodes: ComputedRef<Node[]>;
  isDark: Ref<boolean>;
  removeEdges: VueFlowStore["removeEdges"];
  addEdges: VueFlowStore["addEdges"];
  getEdges: ComputedRef<Edge[]>;
}

/**
 * 处理 VueFlow 画布连接逻辑的 Composable 函数。
 * 实现了一对多（一个输出可以连接多个输入）
 * 支持多对一（标记了 multi: true 的输入可以有多个连接）
 * 其他类型的输入仍保持一对一（新连接替换旧连接）
 * @param options 包含节点、元素和主题信息的选项对象。
 * @returns 返回连线管理相关函数
 */
export function useCanvasConnections({
  getNodes,
  isDark,
  removeEdges,
  addEdges,
  getEdges,
}: UseCanvasConnectionsOptions) {
  const { syncInterfaceSlotFromConnection } = useGroupInterfaceSync();
  const tabStore = useTabStore();
  const workflowStore = useWorkflowStore();

  /**
   * Checks if two slot types are compatible for connection based on DataFlowType and SocketMatchCategory.
   * Follows rules defined in the new slot type system design.
   * @param sourceSlot The source slot information (GroupSlotInfo).
   * @param targetSlot The target slot information (GroupSlotInfo).
   */
  const isTypeCompatible = (sourceSlot: GroupSlotInfo, targetSlot: GroupSlotInfo): boolean => {
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
  };

  /**
   * 检查连接是否有效
   * 验证源节点和目标节点存在，以及类型是否兼容
   * @param connection 要验证的连接
   * @returns 连接是否有效
   */
  const isValidConnection = (connection: Connection): boolean => {
    const { source, target, sourceHandle, targetHandle } = connection;

    // 如果没有指定源或目标节点及其句柄，则认为无效
    if (!source || !target || !sourceHandle || !targetHandle) {
      return false;
    }

    // 获取源节点和目标节点
    const sourceNode = getNodes.value.find((node) => node.id === source);
    const targetNode = getNodes.value.find((node) => node.id === target);

    if (!sourceNode || !targetNode) {
      console.error("无法找到源节点或目标节点");
      return false;
    }

    // 检查是否为自环连接
    if (source === target) {
      console.warn("不允许将节点的输出连接到自身的输入 (自环)");
      return false;
    }

    // 获取源输出和目标输入的定义
    let sourceOutput: GroupSlotInfo | undefined;
    if (getNodeType(sourceNode) === 'core:GroupInput') {
      // Roo: Correct lookup for GroupInput source handle definition
      // The definition should be fetched from the central workflow state (interfaceInputs)
      const activeState = workflowStore.getActiveTabState();
      // console.log(`[DEBUG GroupInput Lookup] Trying to find handle: '${sourceHandle}' in workflowData.interfaceInputs:`, activeState?.workflowData?.interfaceInputs);
      sourceOutput = activeState?.workflowData?.interfaceInputs?.[sourceHandle];
    } else if (getNodeType(sourceNode) === 'core:NodeGroup') {
      sourceOutput = (sourceNode.data as any)?.groupInterface?.outputs?.[sourceHandle];
    } else {
      sourceOutput = (sourceNode.data as any)?.outputs?.[sourceHandle];
    }

    let targetInput: GroupSlotInfo | undefined;
    if (getNodeType(targetNode) === 'core:GroupOutput') {
      const activeState = workflowStore.getActiveTabState();
      targetInput = activeState?.workflowData?.interfaceOutputs?.[targetHandle];
    } else if (getNodeType(targetNode) === 'core:NodeGroup') {
      targetInput = (targetNode.data as any)?.groupInterface?.inputs?.[targetHandle];
    } else {
      targetInput = (targetNode.data as any)?.inputs?.[targetHandle];
    }

    if (!sourceOutput || !targetInput) {
      console.error(
        `无法找到源输出 (${sourceHandle}@${sourceNode.id}) 或目标输入 (${targetHandle}@${targetNode.id}) 的定义`
      );
      return false;
    }

    // Use the new isTypeCompatible function
    if (!isTypeCompatible(sourceOutput, targetInput)) {
      // console.warn(
      //   `类型不兼容: ${sourceOutput.dataFlowType} (${sourceOutput.matchCategories?.join(',')}) -> ${
      //     targetInput.dataFlowType
      //   } (${targetInput.matchCategories?.join(',')})`
      // );
      return false;
    }

    return true;
  };

  /**
   * 根据连接参数创建一条新的边。
   * @param params 连接参数。
   * @returns 返回创建的 Edge 对象，如果无法创建则返回 null。
   */
  const createEdge = (params: Connection): Edge | null => {
    // 验证连接（包括类型验证）
    if (!isValidConnection(params)) {
      return null;
    }

    // 获取源节点和目标节点（这些节点一定存在，因为已经通过了isValidConnection）
    const sourceNode = getNodes.value.find((node) => node.id === params.source)!;
    const targetNode = getNodes.value.find((node) => node.id === params.target)!;

    // 获取类型信息 (考虑 GroupInput, GroupOutput, NodeGroup)
    let sourceOutputDef: GroupSlotInfo | undefined;
    if (getNodeType(sourceNode) === 'core:GroupInput') {
      const activeState = workflowStore.getActiveTabState();
      sourceOutputDef = activeState?.workflowData?.interfaceInputs?.[params.sourceHandle!];
    } else if (getNodeType(sourceNode) === 'core:NodeGroup') {
      sourceOutputDef = (sourceNode.data as any)?.groupInterface?.outputs?.[params.sourceHandle!];
    } else {
      sourceOutputDef = (sourceNode.data as any)?.outputs?.[params.sourceHandle!];
    }

    let targetInputDef: GroupSlotInfo | undefined;
    if (getNodeType(targetNode) === 'core:GroupOutput') {
      const activeState = workflowStore.getActiveTabState();
      targetInputDef = activeState?.workflowData?.interfaceOutputs?.[params.targetHandle!];
    } else if (getNodeType(targetNode) === 'core:NodeGroup') {
      targetInputDef = (targetNode.data as any)?.groupInterface?.inputs?.[params.targetHandle!];
    } else {
      targetInputDef = (targetNode.data as any)?.inputs?.[params.targetHandle!];
    }

    const sourceDft = sourceOutputDef?.dataFlowType || DataFlowType.WILDCARD;
    const targetDft = targetInputDef?.dataFlowType || DataFlowType.WILDCARD;

    // 获取边的样式和标记
    const {
      animated: edgeAnimated,
      style: edgeStyle,
      markerEnd: edgeMarkerEnd,
    } = getEdgeStyleProps(sourceDft, targetDft, isDark.value);

    // 创建新边对象
    const edge: Edge = {
      id: nanoid(10), // <-- 使用 nanoid 生成 ID
      source: params.source,
      sourceHandle: params.sourceHandle,
      target: params.target,
      targetHandle: params.targetHandle,
      type: "default",
      animated: edgeAnimated,
      style: edgeStyle,
      markerEnd: edgeMarkerEnd,
      data: {
        sourceType: sourceDft, // Store DataFlowTypeName
        targetType: targetDft, // Store DataFlowTypeName
      },
    };

    return edge;
  };

  /**
   * 处理连接建立事件
   * 如果目标输入没有标记 multi: true，则一个输入插槽同一时刻只能有一条连接，当有新连接时会自动断开旧连接
   * 如果目标输入标记了 multi: true，则允许多条连接
   * @param params 连接参数
   * @returns 创建的边，如果创建失败则返回null
   */
  const handleConnect = (params: Connection): Edge | null => {
    const { source, target, sourceHandle, targetHandle } = params;

    // 检查边是否已存在 (防止重做时重复触发)
    const currentTabIdCheck = tabStore.activeTabId;
    if (currentTabIdCheck) {
      const currentElements = workflowStore.getElements(currentTabIdCheck); // 获取当前元素
      const existingEdge = currentElements.find(
        (el: Node | Edge) => // 使用正确的类型别名 Node
          !("position" in el) && // 确保是边
          el.source === source &&
          el.sourceHandle === sourceHandle &&
          el.target === target &&
          el.targetHandle === targetHandle
      );
      if (existingEdge) {
        console.warn(
          `[handleConnect] 检测到已存在的边 (ID: ${existingEdge.id})，可能是在重做期间触发的冗余连接事件。正在跳过处理。`
        );
        return null; // 跳过处理已存在的边
      }
    } else {
      console.warn("[handleConnect] 无法检查现有边，因为没有活动的标签页 ID。");
    }

    // 1. 首先验证连接
    if (!isValidConnection(params)) {
      console.log("连接验证失败 (isValidConnection)");
      return null;
    }

    // 2. 获取节点和插槽定义
    const sourceNode = getNodes.value.find((node) => node.id === source)!;
    const targetNode = getNodes.value.find((node) => node.id === target)!;

    // 获取源输出和目标输入的定义
    let sourceOutputDef: GroupSlotInfo | undefined;
    if (getNodeType(sourceNode) === 'core:GroupInput') {
      // Roo: Correct lookup for GroupInput source handle definition
      // The definition should be fetched from the central workflow state (interfaceInputs)
      const activeState = workflowStore.getActiveTabState();
      // console.log(`[DEBUG GroupInput Lookup in handleConnect] Trying to find handle: '${sourceHandle!}' in workflowData.interfaceInputs:`, activeState?.workflowData?.interfaceInputs);
      sourceOutputDef = activeState?.workflowData?.interfaceInputs?.[sourceHandle!];
    } else if (getNodeType(sourceNode) === 'core:NodeGroup') {
      sourceOutputDef = (sourceNode.data as any)?.groupInterface?.outputs?.[sourceHandle!];
    } else {
      sourceOutputDef = (sourceNode.data as any)?.outputs?.[sourceHandle!];
    }

    let targetInputDef: GroupSlotInfo | undefined;
    if (getNodeType(targetNode) === 'core:GroupOutput') {
      const activeState = workflowStore.getActiveTabState();
      targetInputDef = activeState?.workflowData?.interfaceOutputs?.[targetHandle!];
    } else if (getNodeType(targetNode) === 'core:NodeGroup') {
      targetInputDef = (targetNode.data as any)?.groupInterface?.inputs?.[targetHandle!];
    } else {
      targetInputDef = (targetNode.data as any)?.inputs?.[targetHandle!];
    }

    // 检查定义是否存在
    if (!sourceOutputDef || !targetInputDef) {
      console.error(
        `连接处理错误: 无法找到源或目标定义 (${sourceHandle}@${source} -> ${targetHandle}@${target})`
      );
      return null;
    }

    const originalSourceDft = sourceOutputDef.dataFlowType;
    const originalSourceCats = sourceOutputDef.matchCategories || [];
    const originalTargetDft = targetInputDef.dataFlowType;
    const originalTargetCats = targetInputDef.matchCategories || [];

    let finalSourceDft = originalSourceDft;
    let finalSourceCats = [...originalSourceCats];
    let finalTargetDft = originalTargetDft;
    let finalTargetCats = [...originalTargetCats];

    let interfaceUpdateResult: {
      inputs: Record<string, GroupSlotInfo>;
      outputs: Record<string, GroupSlotInfo>;
    } | null = null;
    // let requiresInterfaceUpdate = false; // 移除了未使用的变量
    // console.debug(`[handleConnect] Initial DFTs: Source=${originalSourceDft}, Target=${originalTargetDft}`);

    const isSourceNodeConvertible =
      originalSourceDft === DataFlowType.CONVERTIBLE_ANY ||
      originalSourceCats.includes(BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);
    const isTargetNodeConvertible =
      originalTargetDft === DataFlowType.CONVERTIBLE_ANY ||
      originalTargetCats.includes(BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);

    const isSourceNodeWildcard =
      originalSourceDft === DataFlowType.WILDCARD ||
      originalSourceCats.includes(BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD);
    const isTargetNodeWildcard =
      originalTargetDft === DataFlowType.WILDCARD ||
      originalTargetCats.includes(BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD);


    // Helper to create newSlotInfo for syncInterfaceSlotFromConnection
    const createSyncSlotInfo = (
      baseSlot: GroupSlotInfo,
      newDft: DataFlowTypeName,
      newCats: string[],
      connectedSlot: GroupSlotInfo,
      connectedNode: Node,
      connectedHandleKey: string
    ): GroupSlotInfo => {
      const connectedCurrentValue = connectedNode.data?.values?.[connectedHandleKey];
      return {
        ...baseSlot, // Keep original key, multi, allowDynamicType etc.
        dataFlowType: newDft,
        matchCategories: newCats,
        // Update display name and description from the connected slot
        displayName: connectedSlot.displayName || connectedHandleKey,
        customDescription: connectedSlot.customDescription || "",
        config: {
          ...baseSlot.config,
          default: connectedCurrentValue ?? getEffectiveDefaultValue(connectedSlot),
          min: connectedSlot.config?.min ?? baseSlot.config?.min,
          max: connectedSlot.config?.max ?? baseSlot.config?.max,
        },
        // type: newDft, // Keep the old 'type' field consistent for now if syncInterfaceSlotFromConnection relies on it
      };
    };


    if (isSourceNodeConvertible && !isTargetNodeConvertible && !isTargetNodeWildcard) {
      // Source is CONVERTIBLE_ANY, converts to Target's type
      finalSourceDft = originalTargetDft;
      finalSourceCats = originalTargetCats.filter(
        (cat) => cat !== BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE
      );
      // Update sourceOutputDef for syncInterfaceSlotFromConnection
      sourceOutputDef.dataFlowType = finalSourceDft;
      sourceOutputDef.matchCategories = finalSourceCats;
      // sourceOutputDef.type = finalSourceDft; // Keep old 'type' consistent for sync function if needed

      const sourceNodeType = getNodeType(sourceNode);
      if (sourceNodeType === 'core:GroupInput') {
        const newSlotInfo = createSyncSlotInfo(sourceOutputDef, finalSourceDft, finalSourceCats, targetInputDef, targetNode, targetHandle!);
        const currentTabId = tabStore.activeTabId;
        if (currentTabId) {
          const syncResult = syncInterfaceSlotFromConnection(currentTabId, sourceNode.id, sourceHandle!, newSlotInfo, "inputs");
          if (syncResult) { interfaceUpdateResult = syncResult; /* requiresInterfaceUpdate = true; */ }
        }
      }
    } else if (isTargetNodeConvertible && !isSourceNodeConvertible && !isSourceNodeWildcard) {
      // Target is CONVERTIBLE_ANY, converts to Source's type
      finalTargetDft = originalSourceDft;
      finalTargetCats = originalSourceCats.filter(
        (cat) => cat !== BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE
      );
      // Update targetInputDef for syncInterfaceSlotFromConnection
      targetInputDef.dataFlowType = finalTargetDft;
      targetInputDef.matchCategories = finalTargetCats;
      // targetInputDef.type = finalTargetDft; // Keep old 'type' consistent for sync function

      const targetNodeType = getNodeType(targetNode);
      if (targetNodeType === 'core:GroupInput' || targetNodeType === 'core:GroupOutput') {
        const newSlotInfo = createSyncSlotInfo(targetInputDef, finalTargetDft, finalTargetCats, sourceOutputDef, sourceNode, sourceHandle!);
        const centralDirection = targetNodeType.endsWith(':GroupOutput') ? "outputs" : "inputs";
        const currentTabId = tabStore.activeTabId;
        if (currentTabId) {
          const syncResult = syncInterfaceSlotFromConnection(currentTabId, targetNode.id, targetHandle!, newSlotInfo, centralDirection);
          if (syncResult) {
            if (!interfaceUpdateResult) interfaceUpdateResult = syncResult;
            // requiresInterfaceUpdate = true;
          }
        }
      }
    } else if (isTargetNodeWildcard && !isSourceNodeConvertible) {
      // Target is WILDCARD, adopts Source's type (if source is not CONVERTIBLE_ANY)
      finalTargetDft = originalSourceDft;
      finalTargetCats = [...originalSourceCats]; // Copy source categories
      // Potentially update targetInputDef if WILDCARD type needs to be "materialized" in the definition
      // For now, style props will use finalTargetDft. No interface sync needed for WILDCARD target type change.
    } else if (isSourceNodeWildcard && !isTargetNodeConvertible) {
      // Source is WILDCARD, adopts Target's type (if target is not CONVERTIBLE_ANY)
      // This case is less common for styling as output usually dictates.
      // finalSourceDft = originalTargetDft;
      // finalSourceCats = [...originalTargetCats];
      // No interface sync needed for WILDCARD source type change.
    }


    // 4. 处理多输入逻辑
    const isMultiInput = targetInputDef.multi === true;
    if (!isMultiInput) {
      // 如果不是多输入插槽，移除已有的连接
      const existingEdges = getEdges.value.filter(
        (el): el is Edge => el.target === target && el.targetHandle === targetHandle
      );
      if (existingEdges.length > 0) {
        removeEdges(existingEdges.map((edge) => edge.id));
      }
    }

    // 5. 创建并添加新边
    const {
      animated: edgeAnimated,
      style: edgeStyle,
      markerEnd: edgeMarkerEnd,
    } = getEdgeStyleProps(finalSourceDft, finalTargetDft, isDark.value);

    const newEdge: Edge = {
      id: nanoid(10), // <-- 使用 nanoid 生成 ID
      source: source!,
      sourceHandle: sourceHandle!,
      target: target!,
      targetHandle: targetHandle!,
      type: "default",
      animated: edgeAnimated,
      style: edgeStyle,
      markerEnd: edgeMarkerEnd,
      data: {
        sourceType: finalSourceDft, // Store final DataFlowTypeName
        targetType: finalTargetDft, // Store final DataFlowTypeName
        // Optional: store original types/cats if needed for history or debugging
        originalSourceDft,
        originalSourceCats,
        originalTargetDft,
        originalTargetCats,
      },
    };

    // --- DEBUGGING START ---
    // console.debug('[useCanvasConnections DEBUG] 准备添加边:', {
    //   id: newEdge.id,
    //   source: newEdge.source,
    //   sourceHandle: newEdge.sourceHandle,
    //   target: newEdge.target,
    //   targetHandle: newEdge.targetHandle,
    //   finalSourceDft,
    //   finalTargetDft
    // });
    // --- DEBUGGING END ---

    // 6. 添加边并处理接口更新（如果需要）
    // console.debug(`[handleConnect] Final check before adding edge: requiresInterfaceUpdate=${requiresInterfaceUpdate}, interfaceUpdateResult=`, interfaceUpdateResult);
    // Use interfaceUpdateResult directly as the condition and type guard
    // If interfaceUpdateResult is truthy (non-null), it means requiresInterfaceUpdate must have been true at some point.
    if (interfaceUpdateResult) {
      // console.debug("[handleConnect] Path chosen: handleConnectionWithInterfaceUpdate (interfaceUpdateResult is non-null)");
      const currentTabId = tabStore.activeTabId;
      if (currentTabId) {
        // 创建历史记录条目
        const sourceNodeName = sourceNode.data?.displayName || sourceNode.data?.label || source;
        const targetNodeName = targetNode.data?.displayName || targetNode.data?.label || target;
        const sourceHandleName = sourceOutputDef?.displayName || sourceHandle;
        const targetHandleName = targetInputDef?.displayName || targetHandle;
        const summary = `连接 ${sourceNodeName}::${sourceHandleName} -> ${targetNodeName}::${targetHandleName} (接口更新)`;
        const entry: HistoryEntry = createHistoryEntry("connect", "edge", summary, {
          edgeId: newEdge.id,
          sourceNodeId: source,
          sourceHandle: sourceHandle,
          targetNodeId: target,
          targetHandle: targetHandle,
          interfaceUpdated: true,
        });

        // 调用 store action 原子性地处理边和接口更新
        // console.debug(`[DEBUG Roo] Before workflowStore.handleConnectionWithInterfaceUpdate:`, {
        //   tabId: currentTabId,
        //   edgeToAdd: JSON.parse(JSON.stringify(newEdge)), // 深拷贝以便日志记录快照
        //   updatedInputs: JSON.parse(JSON.stringify(interfaceUpdateResult.inputs)),
        //   updatedOutputs: JSON.parse(JSON.stringify(interfaceUpdateResult.outputs)),
        //   sourceNodeId: sourceNode.id,
        //   targetNodeId: targetNode.id,
        //   historyEntry: JSON.parse(JSON.stringify(entry)),
        // });

        workflowStore.handleConnectionWithInterfaceUpdate(
          currentTabId,
          newEdge,
          interfaceUpdateResult.inputs,
          interfaceUpdateResult.outputs,
          sourceNode.id,
          targetNode.id,
          entry
        );
        // console.debug(`[DEBUG Roo] After workflowStore.handleConnectionWithInterfaceUpdate. Current VueFlow edges count: ${getEdges.value.length}`);
        // const edgeInVueFlow = getEdges.value.find(e => e.id === newEdge.id);
        // console.debug(`[DEBUG Roo] New edge ${newEdge.id} in VueFlow after store action:`, edgeInVueFlow ? JSON.parse(JSON.stringify(edgeInVueFlow)) : 'NOT FOUND IN VUEFLOW INSTANCE');

        // 强制 VueFlow 实例检查其元素，这有时有助于解决响应性问题
        // 这是一个尝试性的修复，可能需要更深入地了解 VueFlow 的内部机制
        // addEdges([]); // 调用一个空操作，有时会触发 VueFlow 的内部更新

      } else {
        console.error("无法处理带接口更新的连接：找不到当前活动的标签页 ID。");
        // Fallback: 只添加边
        addEdges([newEdge]);
        // console.debug(`[DEBUG Roo] Added edge ${newEdge.id} via fallback addEdges (no tab ID), current VueFlow edges count: ${getEdges.value.length}`);
        // console.debug("新连接已添加 (Fallback - 无 Tab ID):", newEdge.id);
      }
    } else {
      // console.debug("[handleConnect] Path chosen: addEdgeAndRecord (or fallback)");
      // 普通连接，调用 store action 添加边并记录历史
      const currentTabId = tabStore.activeTabId;
      if (currentTabId) {
        // 创建历史记录条目
        const sourceNodeName = sourceNode.data?.displayName || sourceNode.data?.label || source;
        const targetNodeName = targetNode.data?.displayName || targetNode.data?.label || target;
        const sourceHandleName = sourceOutputDef?.displayName || sourceHandle;
        const targetHandleName = targetInputDef?.displayName || targetHandle;
        const summary = `连接 ${sourceNodeName}::${sourceHandleName} -> ${targetNodeName}::${targetHandleName}`;
        const entry: HistoryEntry = createHistoryEntry("connect", "edge", summary, {
          edgeId: newEdge.id,
          sourceNodeId: source,
          sourceHandle: sourceHandle,
          targetNodeId: target,
          targetHandle: targetHandle,
        });
        // console.debug("[useCanvasConnections DEBUG] 添加连接 (无接口更新):", {
        //   id: newEdge.id,
        //   source: newEdge.source,
        //   sourceHandle: newEdge.sourceHandle,
        //   target: newEdge.target,
        //   targetHandle: newEdge.targetHandle
        // });
        workflowStore.addEdgeAndRecord(currentTabId, newEdge, entry);

        // 添加调试 - 验证边是否成功添加到状态
        // setTimeout(() => {
        //   const currentTabState = workflowStore.getAllTabStates.get(currentTabId);
        //   const stateEdges = currentTabState?.elements.filter((el: any) => 'source' in el) || [];
        //   // 不使用Edge类型，而是使用any类型避免类型不匹配问题
        //   const edgeExists = stateEdges.some((e: any) => e.id === newEdge.id);
        //   console.debug(`[useCanvasConnections DEBUG] 边 ${newEdge.id} 添加到状态后检查: 是否存在=${edgeExists}, 状态中边总数=${stateEdges.length}`);
        // }, 50);
      } else {
        // console.error("无法添加普通连接并记录历史：找不到当前活动的标签页 ID。");
        // Fallback: 只添加边
        addEdges([newEdge]);
        // console.log(`[DEBUG] Added edge ${newEdge.id} via fallback addEdges (no tab ID, no history)`);
        console.debug("新连接已添加 (Fallback - 无 Tab ID，无历史):", newEdge.id);
      }
    }

    return newEdge;
  };

  /**
   * 删除与节点相关的所有连线
   * @param nodeId 节点ID
   */
  const removeNodeConnections = (nodeId: string) => {
    const edgesToRemove = getEdges.value.filter(
      (edge) => edge.source === nodeId || edge.target === nodeId
    );
    if (edgesToRemove.length > 0) {
      removeEdges(edgesToRemove.map((edge) => edge.id));
    }
  };

  /**
   * 删除与特定目标输入相关的连线
   * 用于在手动设置输入值时移除对应的连线
   * @param nodeId 目标节点ID
   * @param handleId 句柄ID
   */
  const removeTargetConnections = (nodeId: string, handleId: string) => {
    const edgesToRemove = getEdges.value.filter(
      (edge) => edge.target === nodeId && edge.targetHandle === handleId
    );
    if (edgesToRemove.length > 0) {
      removeEdges(edgesToRemove.map((edge) => edge.id));
    }
  };

  return {
    createEdge,
    handleConnect,
    isValidConnection,
    removeNodeConnections,
    removeTargetConnections,
  };
}
