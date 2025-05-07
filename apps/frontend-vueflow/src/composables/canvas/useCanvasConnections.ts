import type { Ref, ComputedRef } from "vue";
import type { Connection, Edge, Node, VueFlowStore } from "@vue-flow/core";
import { getEdgeStyleProps } from "./useEdgeStyles";
import { useGroupInterfaceSync } from "../group/useGroupInterfaceSync";
import type { GroupSlotInfo, HistoryEntry } from "@comfytavern/types";
import { createHistoryEntry } from "@comfytavern/utils";
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
   * 检查类型是否兼容
   * @param sourceType 源类型
   * @param targetType 目标类型
   * @returns 类型是否兼容
   */
  const isTypeCompatible = (sourceType: string, targetType: string): boolean => {
    // WILDCARD（通配符）与任何类型兼容
    if (sourceType === "WILDCARD" || targetType === "WILDCARD") {
      return true;
    }
    // CONVERTIBLE_ANY 作为目标接受任何源类型
    if (targetType === "CONVERTIBLE_ANY") {
      return true;
    }
    // CONVERTIBLE_ANY 作为源可以连接到任何非动态目标
    if (sourceType === "CONVERTIBLE_ANY") {
      // 避免 CONVERTIBLE_ANY -> CONVERTIBLE_ANY 或 CONVERTIBLE_ANY -> WILDCARD
      return targetType !== "CONVERTIBLE_ANY" && targetType !== "WILDCARD";
    }

    // 首先检查类型是否相等
    if (sourceType === targetType) {
      return true;
    }
    // INT -> FLOAT
    if (targetType === "FLOAT" && sourceType === "INT") {
      return true;
    }
    // INT/FLOAT/BOOLEAN -> STRING
    if (
      targetType === "STRING" &&
      (sourceType === "INT" || sourceType === "FLOAT" || sourceType === "BOOLEAN")
    ) {
      return true;
    }
    // STRING -> CODE
    if (targetType === "CODE" && sourceType === "STRING") {
      return true;
    }
    // STRING -> COMBO
    if (targetType === "COMBO" && sourceType === "STRING") {
      return true;
    }

    // 默认：不兼容
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
      console.log(`[DEBUG GroupInput Lookup] Trying to find handle: '${sourceHandle}' in workflowData.interfaceInputs:`, activeState?.workflowData?.interfaceInputs);
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

    const sourceType = sourceOutput.type || "any";
    const targetType = targetInput.type || "any";

    // --- 类型兼容性检查 ---
    // 特殊处理 CONVERTIBLE_ANY 作为源的情况
    if (sourceType === "CONVERTIBLE_ANY") {
      // 不允许连接到动态类型
      if (targetType === "CONVERTIBLE_ANY" || targetType === "WILDCARD") {
        console.warn(`类型不兼容: CONVERTIBLE_ANY 不能连接到 ${targetType}`);
        return false;
      }
      // 允许连接到任何非动态类型，跳过后续检查
      return true;
    }

    // 常规检查：
    // 1. 检查目标是否指定了 acceptTypes
    if (targetInput.acceptTypes && targetInput.acceptTypes.length > 0) {
      if (!targetInput.acceptTypes.includes(sourceType)) {
        console.warn(`源类型 ${sourceType} 不在目标接受类型列表中:`, targetInput.acceptTypes);
        return false;
      }
      // 如果在 acceptTypes 中，则认为兼容 (不需要再调用 isTypeCompatible)
    }
    // 2. 如果没有 acceptTypes，使用通用的 isTypeCompatible 检查
    else if (!isTypeCompatible(sourceType, targetType)) {
      console.warn(`类型不兼容: ${sourceType} -> ${targetType}`);
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

    const sourceType = sourceOutputDef?.type || "any";
    const targetType = targetInputDef?.type || "any";

    // 获取边的样式和标记
    const {
      animated: edgeAnimated,
      style: edgeStyle,
      markerEnd: edgeMarkerEnd,
    } = getEdgeStyleProps(sourceType, targetType, isDark.value);

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
        sourceType: sourceType,
        targetType: targetType,
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
        (el) =>
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
      console.log(`[DEBUG GroupInput Lookup in handleConnect] Trying to find handle: '${sourceHandle!}' in workflowData.interfaceInputs:`, activeState?.workflowData?.interfaceInputs);
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

    const originalSourceType = sourceOutputDef.type;
    const originalTargetType = targetInputDef.type;
    let finalSourceType = originalSourceType;
    let finalTargetType = originalTargetType;

    let interfaceUpdateResult: {
      inputs: Record<string, GroupSlotInfo>;
      outputs: Record<string, GroupSlotInfo>;
    } | null = null;
    let requiresInterfaceUpdate = false;
    console.debug(`[handleConnect] Initial types: Source=${originalSourceType}, Target=${originalTargetType}`);

    // 处理 CONVERTIBLE_ANY 源
    if (originalSourceType === "CONVERTIBLE_ANY") {
      console.debug(`[handleConnect] Handling CONVERTIBLE_ANY source (${sourceHandle}@${source}) connecting to ${originalTargetType} target (${targetHandle}@${target})`);
      // 将源插槽类型转换为目标类型
      const targetDisplayName = targetInputDef.displayName || targetHandle!;
      const targetDescription = targetInputDef.customDescription || "";
      const targetConfig = targetInputDef.config || {};
      const targetDefaultValue = targetConfig.default;
      const targetMin = targetConfig.min;
      const targetMax = targetConfig.max;
      sourceOutputDef.type = originalTargetType;
      sourceOutputDef.displayName = targetDisplayName;
      sourceOutputDef.customDescription = targetDescription;
      finalSourceType = originalTargetType;

      // 如果源节点是 GroupInput，则同步接口
      const sourceNodeType = getNodeType(sourceNode);
      console.debug(`[handleConnect] Source node type for CONVERTIBLE_ANY source: ${sourceNodeType}`);
      // Check if the fullType ends with ':GroupInput'
      if (sourceNodeType === 'core:GroupInput') {
        console.debug(`[handleConnect] Source is GroupInput (${sourceNodeType}), attempting interface sync for slot ${sourceHandle}`);
        const direction: "inputs" | "outputs" = "inputs";
        const slotKey = sourceHandle!;
        // 获取目标节点的当前值
        const targetCurrentValue = targetNode.data?.values?.[targetHandle!];
        const newSlotInfo: GroupSlotInfo = {
          key: slotKey,
          type: sourceOutputDef.type,
          displayName: targetDisplayName,
          customDescription: targetDescription,
          // 使用目标节点的当前值，如果不存在则回退到定义中的默认值
          defaultValue: targetCurrentValue !== undefined ? targetCurrentValue : targetDefaultValue,
          min: targetMin,
          max: targetMax,
          allowDynamicType: sourceOutputDef.allowDynamicType,
          multi: sourceOutputDef.multi,
          acceptTypes: sourceOutputDef.acceptTypes,
          config: sourceOutputDef.config,
        };

        const currentTabId = tabStore.activeTabId;
        if (!currentTabId) {
          console.error("无法同步接口：找不到当前活动的标签页 ID。");
        } else {
          const sourceSyncResult = syncInterfaceSlotFromConnection(
            currentTabId,
            sourceNode.id,
            slotKey,
            newSlotInfo,
            direction
          );
          console.debug(`[handleConnect] Interface sync result for CONVERTIBLE_ANY source:`, sourceSyncResult);
          if (sourceSyncResult) {
            interfaceUpdateResult = sourceSyncResult; // Assign if successful
            requiresInterfaceUpdate = true;       // Set flag ONLY if successful
          }
          console.debug(`[handleConnect] requiresInterfaceUpdate after source sync attempt: ${requiresInterfaceUpdate}`);
        }
      } else if (sourceNodeType === 'core:GroupOutput') {
        // GroupOutput 不应有 CONVERTIBLE_ANY 输出
        console.warn(
          `源节点是 GroupOutput 但源插槽是 CONVERTIBLE_ANY (${sourceHandle})，这不符合预期。仅转换本地类型。`
        );
      }
    }

    // 处理 CONVERTIBLE_ANY 目标
    if (originalTargetType === "CONVERTIBLE_ANY") {
      console.debug(`[handleConnect] Handling CONVERTIBLE_ANY target (${targetHandle}@${target}) connected by ${finalSourceType} source (${sourceHandle}@${source})`);
      // 将目标插槽类型转换为最终的源类型
      const sourceDisplayName = sourceOutputDef.displayName || sourceHandle!;
      const sourceDescription = sourceOutputDef.customDescription || "";
      const sourceConfig = sourceOutputDef.config || {};
      const sourceDefaultValue = sourceConfig.default;
      const sourceMin = sourceConfig.min;
      const sourceMax = sourceConfig.max;
      targetInputDef.type = finalSourceType;
      targetInputDef.displayName = sourceDisplayName;
      targetInputDef.customDescription = sourceDescription;
      finalTargetType = finalSourceType;

      // 如果目标节点是 GroupInput 或 GroupOutput，则同步接口
      const targetNodeType = getNodeType(targetNode);
      console.debug(`[handleConnect] Target node type for CONVERTIBLE_ANY target: ${targetNodeType}`);
      // Check if the fullType ends with ':GroupInput' or ':GroupOutput'
      if (targetNodeType === 'core:GroupInput' || targetNodeType === 'core:GroupOutput') {
        console.debug(`[handleConnect] Target is GroupInput/Output (${targetNodeType}), attempting interface sync for slot ${targetHandle}`);
        const centralDirection: "inputs" | "outputs" =
          targetNodeType.endsWith(':GroupOutput') ? "outputs" : "inputs"; // Check ending here too
        const slotKey = targetHandle!;
        // 获取源节点的当前值
        const sourceCurrentValue = sourceNode.data?.values?.[sourceHandle!];
        const newSlotInfo: GroupSlotInfo = {
          key: slotKey,
          type: targetInputDef.type,
          displayName: sourceDisplayName,
          customDescription: sourceDescription,
          // 使用源节点的当前值，如果不存在则回退到定义中的默认值
          defaultValue: sourceCurrentValue !== undefined ? sourceCurrentValue : sourceDefaultValue,
          min: sourceMin,
          max: sourceMax,
          allowDynamicType: targetInputDef.allowDynamicType,
          multi: targetInputDef.multi,
          acceptTypes: targetInputDef.acceptTypes,
          config: targetInputDef.config,
        };

        const currentTabId = tabStore.activeTabId;
        if (!currentTabId) {
          console.error("无法同步接口：找不到当前活动的标签页 ID。");
        } else {
          const targetSyncResult = syncInterfaceSlotFromConnection(
            currentTabId,
            targetNode.id,
            slotKey,
            newSlotInfo,
            centralDirection
          );
          console.debug(`[handleConnect] Interface sync result for CONVERTIBLE_ANY target:`, targetSyncResult);
          if (targetSyncResult) {
            // Only assign if source sync didn't already provide a result
            if (!interfaceUpdateResult) {
              interfaceUpdateResult = targetSyncResult;
            }
            requiresInterfaceUpdate = true; // Set flag ONLY if target sync succeeded
          }
          console.debug(`[handleConnect] requiresInterfaceUpdate after target sync attempt: ${requiresInterfaceUpdate}`);
        }
      }
    } else if (originalTargetType === "WILDCARD") {
      // WILDCARD 目标采用最终的源类型
      finalTargetType = finalSourceType;
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
    } = getEdgeStyleProps(finalSourceType, finalTargetType, isDark.value);

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
        sourceType: finalSourceType,
        targetType: finalTargetType,
      },
    };

    // --- DEBUGGING START ---
    // console.log('[DEBUG] Final Edge Object before adding:', JSON.stringify(newEdge, null, 2));
    // console.log(`[DEBUG] Final types used for style: Source=${finalSourceType}, Target=${finalTargetType}`);
    // console.log(`[DEBUG] Edge style calculated:`, JSON.stringify(edgeStyle, null, 2));
    // console.log(`[DEBUG] Edge marker calculated:`, JSON.stringify(edgeMarkerEnd, null, 2));
    // --- DEBUGGING END ---

    // 6. 添加边并处理接口更新（如果需要）
    console.debug(`[handleConnect] Final check before adding edge: requiresInterfaceUpdate=${requiresInterfaceUpdate}, interfaceUpdateResult=`, interfaceUpdateResult);
    // Use interfaceUpdateResult directly as the condition and type guard
    // If interfaceUpdateResult is truthy (non-null), it means requiresInterfaceUpdate must have been true at some point.
    if (interfaceUpdateResult) {
      console.debug("[handleConnect] Path chosen: handleConnectionWithInterfaceUpdate (interfaceUpdateResult is non-null)");
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
        workflowStore.handleConnectionWithInterfaceUpdate(
          currentTabId,
          newEdge,
          interfaceUpdateResult.inputs,
          interfaceUpdateResult.outputs,
          sourceNode.id,
          targetNode.id,
          entry
        );
        // console.log(`[DEBUG] Called handleConnectionWithInterfaceUpdate for edge ${newEdge.id}`);
      } else {
        console.error("无法处理带接口更新的连接：找不到当前活动的标签页 ID。");
        // Fallback: 只添加边
        addEdges([newEdge]);
        // console.log(`[DEBUG] Added edge ${newEdge.id} via fallback addEdges (no tab ID)`);
        console.debug("新连接已添加 (Fallback - 无 Tab ID):", newEdge.id);
      }
    } else {
      console.debug("[handleConnect] Path chosen: addEdgeAndRecord (or fallback)");
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
        console.debug("新连接已添加 (无接口更新，记录历史):", newEdge.id);
        workflowStore.addEdgeAndRecord(currentTabId, newEdge, entry);
        // console.log(`[DEBUG] Called addEdgeAndRecord for edge ${newEdge.id}`);
      } else {
        console.error("无法添加普通连接并记录历史：找不到当前活动的标签页 ID。");
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
