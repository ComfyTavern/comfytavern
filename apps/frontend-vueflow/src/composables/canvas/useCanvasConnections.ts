import { type Ref, type ComputedRef, ref, watch } from "vue";
import {
  type Connection,
  type Edge,
  type Node,
  useVueFlow,
  type HandleType,
  // 从 @vue-flow/core 导入核心类型
  type VueFlowStore,
  type ConnectingHandle,
} from "@vue-flow/core";
import { getEdgeStyleProps } from "./useEdgeStyles";
import { useGroupInterfaceSync } from "../group/useGroupInterfaceSync";
import {
  type GroupSlotInfo,
  type DataFlowTypeName,
  DataFlowType,
  BuiltInSocketMatchCategory,
} from "@comfytavern/types";
import { createHistoryEntry, getEffectiveDefaultValue } from "@comfytavern/utils";
import { useTabStore } from "@/stores/tabStore";
import { useWorkflowStore } from "@/stores/workflowStore";
import { getNodeType } from "@/utils/nodeUtils";
import { klona } from 'klona/json';
import { nanoid } from 'nanoid';

// DraggingState 定义保持不变
export interface DraggingState {
  type: 'reorder' | 'disconnect_reconnect';
  originalTargetNodeId: string;
  originalTargetHandleId: string;
  originalEdge: Edge;
  originalSourceNodeId: string;
  originalSourceHandleId?: string;
  isOriginalTargetMultiInput: boolean;
  originalEvent: MouseEvent | TouchEvent;
}

export const draggingState = ref<DraggingState | null>(null);

interface UseCanvasConnectionsOptions {
  getNodes: ComputedRef<Node[]>;
  isDark: Ref<boolean>;
  getEdges: ComputedRef<Edge[]>;
}

export function useCanvasConnections({
  getNodes,
  isDark,
  getEdges,
}: UseCanvasConnectionsOptions) {
  const { syncInterfaceSlotFromConnection } = useGroupInterfaceSync();
  const tabStore = useTabStore();
  const workflowStore = useWorkflowStore();

  // vueFlowInstance 的类型现在是 VueFlowStore
  const vueFlowInstance: VueFlowStore = useVueFlow();
  const {
    onConnectStart, // 这个事件仍然可以用来检测新连接的开始意图
    onConnect,      // 用于处理全新的连接
    onConnectEnd,
    findNode,
    removeEdges: vueFlowRemoveEdges,
    onEdgeUpdateStart,
    onEdgeUpdateEnd, // 用于处理现有连接的更新
    // connectionStartHandle 和 connectionEndHandle 直接从 vueFlowInstance 获取
    // 它们已经是 Ref<ConnectingHandle | null> 类型
  } = vueFlowInstance;

  // 将 handleConnect 注册为 onConnect 事件的回调
  // onConnect(handleConnect); // 此调用已移至 handleConnect 定义之后、watch 块之前 (L663附近)

  const reorderPreviewIndex = ref<number | null>(null);

  const isTypeCompatible = (sourceSlot: GroupSlotInfo, targetSlot: GroupSlotInfo): boolean => {
    console.log('[CanvasConnections DEBUG] isTypeCompatible called. Source Slot:', JSON.parse(JSON.stringify(sourceSlot)), 'Target Slot:', JSON.parse(JSON.stringify(targetSlot)));
    const sourceDft = sourceSlot.dataFlowType;
    const sourceCats = sourceSlot.matchCategories || [];
    const targetDft = targetSlot.dataFlowType;
    const targetCats = targetSlot.matchCategories || [];

    const isSlotConvertibleAny = (dft: DataFlowTypeName, cats: string[]) =>
      dft === DataFlowType.CONVERTIBLE_ANY ||
      cats.includes(BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);

    const isSlotWildcard = (dft: DataFlowTypeName, cats: string[]) =>
      dft === DataFlowType.WILDCARD ||
      cats.includes(BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD);

    const isSourceConvertibleAny = isSlotConvertibleAny(sourceDft, sourceCats);
    const isTargetConvertibleAny = isSlotConvertibleAny(targetDft, targetCats);
    const isSourceWildcard = isSlotWildcard(sourceDft, sourceCats);
    const isTargetWildcard = isSlotWildcard(targetDft, targetCats);

    if (isSourceWildcard && !isTargetConvertibleAny) return true;
    if (isTargetWildcard && !isSourceConvertibleAny) return true;

    if (isSourceConvertibleAny) {
      return !isTargetWildcard && !isTargetConvertibleAny;
    }
    if (isTargetConvertibleAny) {
      return !isSourceWildcard && !isSourceConvertibleAny;
    }

    const behaviorCategoryNames = [
      BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE,
      BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD,
    ];
    const actualSourceCats = sourceCats.filter((cat) => !behaviorCategoryNames.some(bhCat => bhCat === cat));
    const actualTargetCats = targetCats.filter((cat) => !behaviorCategoryNames.some(bhCat => bhCat === cat));

    if (actualSourceCats.length > 0 && actualTargetCats.length > 0) {
      for (const sCat of actualSourceCats) {
        if (actualTargetCats.includes(sCat)) {
          return true;
        }
      }
    }

    if (sourceDft === targetDft) return true;
    if (sourceDft === DataFlowType.INTEGER && targetDft === DataFlowType.FLOAT) return true;
    const stringCompatibleSourceDfts: DataFlowTypeName[] = [
      DataFlowType.INTEGER, DataFlowType.FLOAT, DataFlowType.BOOLEAN,
    ];
    if (stringCompatibleSourceDfts.includes(sourceDft) && targetDft === DataFlowType.STRING) {
      return true;
    }
    if (sourceDft === DataFlowType.STRING && targetCats.includes(BuiltInSocketMatchCategory.CODE)) return true;
    if (sourceCats.includes(BuiltInSocketMatchCategory.CODE) && targetDft === DataFlowType.STRING) return true;
    if (sourceDft === DataFlowType.STRING && targetCats.includes(BuiltInSocketMatchCategory.COMBO_OPTION)) return true;
    if (sourceCats.includes(BuiltInSocketMatchCategory.COMBO_OPTION) && targetDft === DataFlowType.STRING) {
      console.log('[CanvasConnections DEBUG] isTypeCompatible: COMBO_OPTION to STRING -> true');
      return true;
    }
    console.log('[CanvasConnections DEBUG] isTypeCompatible: No compatibility rule matched -> false');
    return false;
  };

  const isValidConnection = (connection: Connection): boolean => {
    console.log('%c[CanvasConnections DEBUG] isValidConnection CALLED (TOP LEVEL). Connection:', 'color: red; font-weight: bold;', JSON.parse(JSON.stringify(connection))); // 强调日志
    console.log('[CanvasConnections DEBUG] isValidConnection called. Connection:', JSON.parse(JSON.stringify(connection)));
    const { source, target, sourceHandle, targetHandle } = connection;
    if (!source || !target || !sourceHandle || !targetHandle) {
      console.warn('[CanvasConnections DEBUG] isValidConnection: Missing connection parameters -> false');
      return false;
    }
    const sourceNode = getNodes.value.find((node) => node.id === source);
    const targetNode = getNodes.value.find((node) => node.id === target);
    if (!sourceNode || !targetNode) {
      console.error("[CanvasConnections DEBUG] isValidConnection: Source or target node not found. Source:", source, "Target:", target, "-> false");
      return false;
    }
    if (source === target) {
      console.warn("[CanvasConnections DEBUG] isValidConnection: Self-loop forbidden (source === target). Source:", source, "-> false");
      return false;
    }

    let sourceOutput: GroupSlotInfo | undefined;
    if (getNodeType(sourceNode) === 'core:GroupInput') {
      const activeState = workflowStore.getActiveTabState();
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
      console.error(`[CanvasConnections DEBUG] isValidConnection: Slot definition not found for ${sourceHandle}@${source} or ${targetHandle}@${target}. SourceOutput:`, sourceOutput, "TargetInput:", targetInput, "-> false");
      return false;
    }
    const compatible = isTypeCompatible(sourceOutput, targetInput);
    console.log(`[CanvasConnections DEBUG] isValidConnection: Result of isTypeCompatible for ${sourceHandle}@${source} -> ${targetHandle}@${target} is: ${compatible}`);
    return compatible;
  };

  async function createAndAddVerifiedEdge(
    tabId: string,
    connectionParams: Connection,
    historyReasonContext: string = 'connect_new'
  ): Promise<Edge | null> {
    const { source, target, sourceHandle, targetHandle } = connectionParams;

    const sourceNode = findNode(source!);
    const targetNode = findNode(target!);
    if (!sourceNode || !targetNode) {
      console.error(`[createAndAddVerifiedEdge] Source or target node not found.`);
      return null;
    }

    let sourceOutputDef: GroupSlotInfo | undefined;
    if (getNodeType(sourceNode) === 'core:GroupInput') { sourceOutputDef = workflowStore.getActiveTabState()?.workflowData?.interfaceInputs?.[sourceHandle!]; }
    else if (getNodeType(sourceNode) === 'core:NodeGroup') { sourceOutputDef = (sourceNode.data as any)?.groupInterface?.outputs?.[sourceHandle!]; }
    else { sourceOutputDef = (sourceNode.data as any)?.outputs?.[sourceHandle!]; }

    let targetInputDef: GroupSlotInfo | undefined;
    if (getNodeType(targetNode) === 'core:GroupOutput') { targetInputDef = workflowStore.getActiveTabState()?.workflowData?.interfaceOutputs?.[targetHandle!]; }
    else if (getNodeType(targetNode) === 'core:NodeGroup') { targetInputDef = (targetNode.data as any)?.groupInterface?.inputs?.[targetHandle!]; }
    else { targetInputDef = (targetNode.data as any)?.inputs?.[targetHandle!]; }

    if (!sourceOutputDef || !targetInputDef) {
      console.error(`[createAndAddVerifiedEdge] Slot definitions not found.`);
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
    let interfaceUpdateResult: { inputs: Record<string, GroupSlotInfo>; outputs: Record<string, GroupSlotInfo>; } | null = null;

    const isSourceNodeConvertible = finalSourceDft === DataFlowType.CONVERTIBLE_ANY || finalSourceCats.includes(BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);
    const isTargetNodeConvertible = finalTargetDft === DataFlowType.CONVERTIBLE_ANY || finalTargetCats.includes(BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);
    const isSourceNodeWildcard = finalSourceDft === DataFlowType.WILDCARD || finalSourceCats.includes(BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD);
    const isTargetNodeWildcard = finalTargetDft === DataFlowType.WILDCARD || finalTargetCats.includes(BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD);

    const createSyncSlotInfo = (baseSlot: GroupSlotInfo, newDft: DataFlowTypeName, newCats: string[], connectedSlot: GroupSlotInfo, connectedNodeValueProvider: Node, connectedHandleKeyValueProvider: string): GroupSlotInfo => {
      const connectedCurrentValue = connectedNodeValueProvider.data?.values?.[connectedHandleKeyValueProvider];
      return {
        ...baseSlot, dataFlowType: newDft, matchCategories: newCats,
        displayName: connectedSlot.displayName || connectedHandleKeyValueProvider,
        customDescription: connectedSlot.customDescription || "",
        config: { ...baseSlot.config, default: connectedCurrentValue ?? getEffectiveDefaultValue(connectedSlot), min: connectedSlot.config?.min ?? baseSlot.config?.min, max: connectedSlot.config?.max ?? baseSlot.config?.max, },
      };
    };

    if (isSourceNodeConvertible && !isTargetNodeConvertible && !isTargetNodeWildcard) {
      finalSourceDft = originalTargetDft;
      finalSourceCats = originalTargetCats.filter(cat => cat !== BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);
      const tempSourceOutputDef = { ...sourceOutputDef, dataFlowType: finalSourceDft, matchCategories: finalSourceCats };
      if (getNodeType(sourceNode) === 'core:GroupInput') {
        const newSlotInfo = createSyncSlotInfo(tempSourceOutputDef, finalSourceDft, finalSourceCats, targetInputDef, targetNode, targetHandle!);
        const syncResult = syncInterfaceSlotFromConnection(tabId, sourceNode.id, sourceHandle!, newSlotInfo, "inputs");
        if (syncResult) interfaceUpdateResult = syncResult;
      }
    } else if (isTargetNodeConvertible && !isSourceNodeConvertible && !isSourceNodeWildcard) {
      finalTargetDft = originalSourceDft;
      finalTargetCats = originalSourceCats.filter(cat => cat !== BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);
      const tempTargetInputDef = { ...targetInputDef, dataFlowType: finalTargetDft, matchCategories: finalTargetCats };
      const targetNodeType = getNodeType(targetNode);
      if (targetNodeType === 'core:GroupInput' || targetNodeType === 'core:GroupOutput') {
        const newSlotInfo = createSyncSlotInfo(tempTargetInputDef, finalTargetDft, finalTargetCats, sourceOutputDef, sourceNode, sourceHandle!);
        const centralDirection = targetNodeType.endsWith(':GroupOutput') ? "outputs" : "inputs";
        const syncResult = syncInterfaceSlotFromConnection(tabId, targetNode.id, targetHandle!, newSlotInfo, centralDirection);
        if (syncResult) { if (!interfaceUpdateResult) interfaceUpdateResult = syncResult; }
      }
    } else if (isTargetNodeWildcard && !isSourceNodeConvertible) {
      finalTargetDft = originalSourceDft; finalTargetCats = [...originalSourceCats];
    } else if (isSourceNodeWildcard && !isTargetNodeConvertible) {
      finalSourceDft = originalTargetDft; finalSourceCats = [...originalTargetCats];
    }

    const isMultiInput = targetInputDef.multi === true;
    if (!isMultiInput) {
      const existingEdgesToTargetHandle = getEdges.value.filter(
        (el): el is Edge => el.target === target && el.targetHandle === targetHandle
      );
      if (existingEdgesToTargetHandle.length > 0) {
        if (historyReasonContext === 'connect_new') {
          for (const edgeToRemove of existingEdgesToTargetHandle) {
            const oldSrcNode = findNode(edgeToRemove.source);
            const oldSrcNodeName = oldSrcNode?.data?.label || edgeToRemove.source;
            const oldTgtNodeName = targetNode.data?.label || edgeToRemove.target;
            const removeEntry = createHistoryEntry('remove', 'edge',
              `移除连接 (因单输入替换): ${oldSrcNodeName}::${edgeToRemove.sourceHandle} -> ${oldTgtNodeName}::${edgeToRemove.targetHandle}`,
              { edgeId: edgeToRemove.id, sourceNodeId: edgeToRemove.source, sourceHandle: edgeToRemove.sourceHandle, targetNodeId: edgeToRemove.target, targetHandle: edgeToRemove.targetHandle, reason: 'single_input_replacement' }
            );
            await workflowStore.removeElementsAndRecord(tabId, [edgeToRemove], removeEntry);
          }
        } else {
          vueFlowRemoveEdges(existingEdgesToTargetHandle.map(e => e.id));
        }
      }
    }

    const { animated, style, markerEnd } = getEdgeStyleProps(finalSourceDft, finalTargetDft, isDark.value);
    const edgeToAdd: Edge = {
      id: nanoid(10),
      source: source!, sourceHandle: sourceHandle!, target: target!, targetHandle: targetHandle!,
      type: "default", animated, style, markerEnd,
      data: {
        sourceType: finalSourceDft, targetType: finalTargetDft,
        originalSourceDft, originalSourceCats, originalTargetDft, originalTargetCats,
      },
    };

    const sourceNodeName = sourceNode.data?.displayName || sourceNode.data?.label || source;
    const targetNodeName = targetNode.data?.displayName || targetNode.data?.label || target;
    const sourceHandleName = sourceOutputDef?.displayName || sourceHandle;
    const targetHandleName = targetInputDef?.displayName || targetHandle;
    let summary = `连接 ${sourceNodeName}::${sourceHandleName} -> ${targetNodeName}::${targetHandleName}`;
    if (historyReasonContext === 'reconnect_new_edge') {
      summary = `重连接到 ${targetNodeName}::${targetHandleName} (原从 ${sourceNodeName}::${sourceHandleName})`;
    }

    if (interfaceUpdateResult) {
      summary += ' (接口更新)';
      const entry = createHistoryEntry("connect", "edge", summary, {
        edgeId: edgeToAdd.id, sourceNodeId: source, sourceHandle, targetNodeId: target, targetHandle,
        interfaceUpdated: true, reason: historyReasonContext,
      });
      await workflowStore.handleConnectionWithInterfaceUpdate(
        tabId, edgeToAdd,
        interfaceUpdateResult.inputs, interfaceUpdateResult.outputs,
        sourceNode.id, targetNode.id, entry
      );
    } else {
      const entry = createHistoryEntry("connect", "edge", summary, {
        edgeId: edgeToAdd.id, sourceNodeId: source, sourceHandle, targetNodeId: target, targetHandle,
        reason: historyReasonContext,
      });
      await workflowStore.addEdgeAndRecord(tabId, edgeToAdd, entry);
    }
    return edgeToAdd;
  }

  const createEdge = (params: Connection): Edge | null => {
    if (draggingState.value?.type === 'reorder') return null;
    if (!isValidConnection(params)) return null;

    const sourceNode = getNodes.value.find((node) => node.id === params.source)!;
    const targetNode = getNodes.value.find((node) => node.id === params.target)!;

    let sourceOutputDef: GroupSlotInfo | undefined;
    if (getNodeType(sourceNode) === 'core:GroupInput') { sourceOutputDef = workflowStore.getActiveTabState()?.workflowData?.interfaceInputs?.[params.sourceHandle!]; }
    else if (getNodeType(sourceNode) === 'core:NodeGroup') { sourceOutputDef = (sourceNode.data as any)?.groupInterface?.outputs?.[params.sourceHandle!]; }
    else { sourceOutputDef = (sourceNode.data as any)?.outputs?.[params.sourceHandle!]; }

    let targetInputDef: GroupSlotInfo | undefined;
    if (getNodeType(targetNode) === 'core:GroupOutput') { targetInputDef = workflowStore.getActiveTabState()?.workflowData?.interfaceOutputs?.[params.targetHandle!]; }
    else if (getNodeType(targetNode) === 'core:NodeGroup') { targetInputDef = (targetNode.data as any)?.groupInterface?.inputs?.[params.targetHandle!]; }
    else { targetInputDef = (targetNode.data as any)?.inputs?.[params.targetHandle!]; }

    if (!sourceOutputDef || !targetInputDef) return null;

    let finalSourceDft = sourceOutputDef.dataFlowType;
    let finalTargetDft = targetInputDef.dataFlowType;
    const isSourceConv = finalSourceDft === DataFlowType.CONVERTIBLE_ANY || (sourceOutputDef.matchCategories || []).includes(BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);
    const isTargetConv = finalTargetDft === DataFlowType.CONVERTIBLE_ANY || (targetInputDef.matchCategories || []).includes(BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);
    const isSourceWild = finalSourceDft === DataFlowType.WILDCARD || (sourceOutputDef.matchCategories || []).includes(BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD);
    const isTargetWild = finalTargetDft === DataFlowType.WILDCARD || (targetInputDef.matchCategories || []).includes(BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD);

    if (isSourceConv && !isTargetConv && !isTargetWild) finalSourceDft = finalTargetDft;
    else if (isTargetConv && !isSourceConv && !isSourceWild) finalTargetDft = finalSourceDft;
    else if (isTargetWild && !isSourceConv) finalTargetDft = finalSourceDft;
    else if (isSourceWild && !isTargetConv) finalSourceDft = finalTargetDft;

    const { animated, style, markerEnd } = getEdgeStyleProps(finalSourceDft, finalTargetDft, isDark.value);
    return {
      id: nanoid(10),
      source: params.source, sourceHandle: params.sourceHandle, target: params.target, targetHandle: params.targetHandle,
      type: "default", animated, style, markerEnd,
      data: { sourceType: finalSourceDft, targetType: finalTargetDft },
    };
  };

  const handleConnect = async (params: Connection): Promise<Edge | null> => {
    console.log('[CanvasConnections DEBUG] handleConnect triggered. Params:', JSON.parse(JSON.stringify(params)));
    console.log('[CanvasConnections DEBUG] handleConnect: Initial draggingState:', JSON.parse(JSON.stringify(draggingState.value)));
    const currentTabId = tabStore.activeTabId;
    if (!currentTabId) {
      console.error("[CanvasConnections DEBUG] [handleConnect] No active tab ID.");
      return null;
    }

    // 当 onConnect (handleConnect) 被调用时，它应该只处理全新的连接。
    // 拖拽现有连接的逻辑已移至 onEdgeUpdateEnd。
    // 对于全新连接，onConnectStart 不会设置 draggingState，所以 draggingState.value 应该为 null。
    if (draggingState.value) {
      console.warn('[CanvasConnections DEBUG] handleConnect: Expected draggingState to be null for a new connection, but it was not. This may indicate an unexpected state. State:', JSON.parse(JSON.stringify(draggingState.value)));
      // 理论上，如果 draggingState 不为 null，意味着 onEdgeUpdateStart 被触发了，
      // 那么应该由 onEdgeUpdateEnd 处理，而不是 onConnect/handleConnect。
      // 为安全起见，如果进入此分支，可能意味着流程混乱，可以选择不处理或积极清理。
      // 目前仅记录警告，并按新连接处理。
    }

    console.log('[CanvasConnections DEBUG] handleConnect: Processing as BRAND NEW connection.');
    const currentElements = workflowStore.getElements(currentTabId);
    const existingEdge = currentElements.find(
      (el: Node | Edge) => !("position" in el) && el.source === params.source && el.sourceHandle === params.sourceHandle && el.target === params.target && el.targetHandle === params.targetHandle
    );
    if (existingEdge) {
      console.warn(`[handleConnect] Duplicate edge detected (ID: ${existingEdge.id}), skipping.`);
      return null;
    }

    const isNewBrandConnectionValid = isValidConnection(params);
    console.log('[CanvasConnections DEBUG] handleConnect (New): Connection validity:', isNewBrandConnectionValid);
    if (!isNewBrandConnectionValid) {
      return null;
    }
    console.log('[CanvasConnections DEBUG] handleConnect (New): Attempting to add brand new edge.');
    const newEdge = await createAndAddVerifiedEdge(currentTabId, params, "connect_new");
    console.log(`[CanvasConnections DEBUG] handleConnect (New): Finished adding brand new edge. Result:`, newEdge ? newEdge.id : 'null');
    return newEdge;
  };

  const removeNodeConnections = (nodeId: string) => {
    const edgesToRemove = getEdges.value.filter(edge => edge.source === nodeId || edge.target === nodeId);
    if (edgesToRemove.length > 0) {
      vueFlowRemoveEdges(edgesToRemove.map((edge) => edge.id));
    }
  };

  const removeTargetConnections = (nodeId: string, handleId: string) => {
    const edgesToRemove = getEdges.value.filter(edge => edge.target === nodeId && edge.targetHandle === handleId);
    if (edgesToRemove.length > 0) {
      vueFlowRemoveEdges(edgesToRemove.map((edge) => edge.id));
    }
  };

  onEdgeUpdateStart((eventDetails: any) => {
    console.debug('[DIAGNOSTIC LOG] onEdgeUpdateStart: Entry. EventDetails:', eventDetails ? JSON.parse(JSON.stringify(eventDetails)) : eventDetails);
    if (!eventDetails || typeof eventDetails !== 'object') {
      console.error('[CanvasConnections DEBUG] onEdgeUpdateStart: eventDetails is not an object or is undefined. Received:', eventDetails);
      draggingState.value = null;
      console.debug('[DIAGNOSTIC LOG] onEdgeUpdateStart: Exit (early due to invalid eventDetails). Final draggingState:', JSON.parse(JSON.stringify(draggingState.value)));
      return;
    }

    const event = eventDetails.event as MouseEvent | undefined;
    const edge = eventDetails.edge as Edge | undefined;

    if (!event || !edge) {
      console.error('[CanvasConnections DEBUG] onEdgeUpdateStart: "event" or "edge" is missing in eventDetails. Received:', eventDetails);
      draggingState.value = null;
      console.debug('[DIAGNOSTIC LOG] onEdgeUpdateStart: Exit (early due to missing event or edge). Final draggingState:', JSON.parse(JSON.stringify(draggingState.value)));
      return;
    }

    let handleTypeOfGrabbedHandle: HandleType | undefined = undefined;
    const domTarget = event.target as SVGElement;

    if (domTarget && typeof domTarget.getAttribute === 'function') {
      const dataType = domTarget.getAttribute('data-type');
      if (dataType === 'source' || dataType === 'target') {
        handleTypeOfGrabbedHandle = dataType as HandleType;
      }
    }

    if (!handleTypeOfGrabbedHandle && domTarget && typeof domTarget.querySelector === 'function') {
      const circleElement = domTarget.querySelector('circle[data-type]');
      if (circleElement) {
        const dataType = circleElement.getAttribute('data-type');
        if (dataType === 'source' || dataType === 'target') {
          handleTypeOfGrabbedHandle = dataType as HandleType;
        }
      }
    }

    if (handleTypeOfGrabbedHandle === undefined) {
      console.warn(`[CanvasConnections DEBUG] onEdgeUpdateStart: handleType is UNDEFINED after attempting to derive it from DOM. This is critical. DOM Target:`, domTarget, `Event Details:`, eventDetails, "Stopping further processing.");
      draggingState.value = null;
      console.debug('[DIAGNOSTIC LOG] onEdgeUpdateStart: Exit (early due to undefined handleTypeOfGrabbedHandle). Final draggingState:', JSON.parse(JSON.stringify(draggingState.value)));
      return;
    }

    console.log('[CanvasConnections DEBUG] onEdgeUpdateStart triggered. Edge ID:', edge.id, 'Derived Grabbed handle type:', handleTypeOfGrabbedHandle);

    let typeForDraggingState: DraggingState['type'] = 'disconnect_reconnect';
    let isOriginalTargetMulti = false;

    const originalTargetNode = findNode(edge.target);
    if (originalTargetNode) {
      const originalTargetHandleId = edge.targetHandle;
      if (originalTargetHandleId) {
        let targetInputDef: GroupSlotInfo | undefined;
        const nodeType = getNodeType(originalTargetNode);

        if (nodeType === 'core:GroupOutput') {
          targetInputDef = workflowStore.getActiveTabState()?.workflowData?.interfaceOutputs?.[originalTargetHandleId];
        } else if (nodeType === 'core:NodeGroup') {
          targetInputDef = (originalTargetNode.data as any)?.groupInterface?.inputs?.[originalTargetHandleId];
        } else {
          targetInputDef = (originalTargetNode.data as any)?.inputs?.[originalTargetHandleId];
        }

        if (!targetInputDef) {
          console.warn(`[CanvasConnections DEBUG] onEdgeUpdateStart: Original target input definition not found for ${edge.target}::${originalTargetHandleId}`);
        } else {
          isOriginalTargetMulti = targetInputDef.multi === true;
        }
      } else {
        console.warn(`[CanvasConnections DEBUG] onEdgeUpdateStart: Original edge ${edge.id} is missing targetHandle.`);
      }
    } else {
      console.warn(`[CanvasConnections DEBUG] onEdgeUpdateStart: Original target node ${edge.target} not found for edge ${edge.id}`);
    }

    console.log(`[CanvasConnections DEBUG] onEdgeUpdateStart: Grabbed handle type: ${handleTypeOfGrabbedHandle}, Original target multi-input: ${isOriginalTargetMulti}, Drag type set to: ${typeForDraggingState}`);

    draggingState.value = {
      type: typeForDraggingState,
      originalTargetNodeId: edge.target,
      originalTargetHandleId: edge.targetHandle!,
      originalEdge: klona(edge),
      originalSourceNodeId: edge.source,
      originalSourceHandleId: edge.sourceHandle ?? undefined,
      isOriginalTargetMultiInput: isOriginalTargetMulti,
      originalEvent: event,
    };
    console.log('[CanvasConnections DEBUG] onEdgeUpdateStart: Set draggingState. State:', JSON.parse(JSON.stringify(draggingState.value)));
    console.debug('[DIAGNOSTIC LOG] onEdgeUpdateStart: draggingState AFTER set:', JSON.parse(JSON.stringify(draggingState.value)));
    console.debug('[DIAGNOSTIC LOG] onEdgeUpdateStart: Exit (normal). Final draggingState:', JSON.parse(JSON.stringify(draggingState.value)));
  });

  // onConnectStart is useful to know when a *new* connection attempt begins
  // (i.e., not starting from an existing edge).
  // VueFlow sets connectionStartHandle when a connection drag begins,
  // regardless of whether it's a new connection or an edge update.
  onConnectStart((params) => { // params is OnConnectStartParams, which is compatible with ConnectingHandle
    console.log('[CanvasConnections DEBUG] onConnectStart triggered (NEW CONNECTION INTENT or EDGE UPDATE START). Params:', JSON.parse(JSON.stringify(params)));
    // We rely on onEdgeUpdateStart to set draggingState for existing edges.
    // If draggingState is not set by onEdgeUpdateStart, it means this is a brand new connection attempt.
    if (!draggingState.value) {
      console.log('[CanvasConnections DEBUG] onConnectStart: Initializing for a brand new connection (draggingState was null).');
      // For brand new connections, draggingState remains null until handleConnect or onConnectEnd.
    } else {
      console.log('[CanvasConnections DEBUG] onConnectStart: draggingState is already set (likely by onEdgeUpdateStart). onConnectStart will not overwrite it.');
    }
  });


  onConnectEnd(async (eventOrConnectionParams?: Connection | MouseEvent | TouchEvent) => {
    console.debug('[DIAGNOSTIC LOG] onConnectEnd: Entry. Event/Params:', eventOrConnectionParams ? JSON.parse(JSON.stringify(eventOrConnectionParams)) : 'undefined', 'Current draggingState:', draggingState.value ? JSON.parse(JSON.stringify(draggingState.value)) : null);
    // 新增日志：记录原始参数和 draggingState
    console.debug(
      `%c[CanvasConnections DEBUG] onConnectEnd triggered.`,
      'color: blue; font-weight: bold;',
      'Event/Params:', eventOrConnectionParams ? JSON.parse(JSON.stringify(eventOrConnectionParams)) : 'undefined',
      'Initial draggingState:', draggingState.value ? JSON.parse(JSON.stringify(draggingState.value)) : null
    );

    // 新增日志：详细记录 event.target (如果参数是事件对象)
    if (eventOrConnectionParams && !(eventOrConnectionParams as Connection).targetHandle && (eventOrConnectionParams instanceof MouseEvent || eventOrConnectionParams instanceof TouchEvent)) {
      const event = eventOrConnectionParams as MouseEvent | TouchEvent;
      if (event.target) {
        const targetElement = event.target as HTMLElement;
        console.debug(
          `[CanvasConnections DEBUG] onConnectEnd: event.target details:`,
          {
            tagName: targetElement.tagName,
            id: targetElement.id,
            classList: Array.from(targetElement.classList),
            dataset: JSON.parse(JSON.stringify(targetElement.dataset)), // 深拷贝 dataset
            closestHandle: targetElement.closest('.vue-flow__handle'), // 检查最近的 handle
            // 尝试获取更具体的 vue-flow 元素信息
            isPane: targetElement.classList.contains('vue-flow__pane'),
            isEdge: targetElement.closest('.vue-flow__edge') !== null,
            isNode: targetElement.closest('.vue-flow__node') !== null,
          },
        );
      } else {
        console.debug('[CanvasConnections DEBUG] onConnectEnd: event.target is null or undefined.');
      }
    }

    // 拖拽现有连接的逻辑已移至 onEdgeUpdateEnd。
    // onConnectEnd 主要用于清理可能由 onEdgeUpdateStart 设置但未被 onEdgeUpdateEnd 完全处理的 draggingState，
    // 例如拖拽被取消或发生意外情况。
    // 对于全新的连接尝试（draggingState 为 null），如果拖放到画布，此函数目前不会执行特殊清理，
    // 因为 onConnectStart 并没有为全新连接设置 draggingState。
    if (draggingState.value) {
      // 如果 draggingState 仍然存在，意味着 onEdgeUpdateStart 被触发了（即拖拽现有连接），
      // 但 onEdgeUpdateEnd 可能由于某种原因没有触发或没有完全清理状态（例如拖拽被外部取消）。
      // 这是一个回退清理机制。
      console.debug('[DIAGNOSTIC LOG] onConnectEnd: PRE-CLEAR. Condition for clearing draggingState (is draggingState.value truthy?):', !!draggingState.value, 'Current draggingState:', JSON.parse(JSON.stringify(draggingState.value)));
      console.debug('[CanvasConnections DEBUG] onConnectEnd: draggingState is still populated. This implies an existing edge drag was started but not fully handled by onEdgeUpdateEnd. Clearing state as a fallback.', JSON.parse(JSON.stringify(draggingState.value)));
      // 此时，不确定原始边是否已被处理，所以不在这里移除原始边，
      // onEdgeUpdateEnd 应该负责处理边的移除。这里只清理客户端状态。
      // draggingState.value = null; // 修复：注释掉，防止过早清除
      // console.debug('[DIAGNOSTIC LOG] onConnectEnd: POST-CLEAR. draggingState is now:', JSON.parse(JSON.stringify(draggingState.value))); // 修复：相关的日志也注释掉
      // reorderPreviewIndex.value = null; // 修复：相关的清理也注释掉
      console.debug('[CanvasConnections DEBUG] onConnectEnd: draggingState was populated, but NOT cleared here to allow onEdgeUpdateEnd to process it.');
    } else {
      // draggingState 为 null。
      // 这可能是：
      // 1. 全新连接尝试结束（无论成功连接还是拖放到画布）。
      // 2. 现有连接拖拽已由 onEdgeUpdateEnd 正确处理并清除了 draggingState。
      // 3. 没有拖动操作发生。
      console.debug('[CanvasConnections DEBUG] onConnectEnd: draggingState is null. No specific cleanup action taken by onConnectEnd for this path, assuming prior handlers (onConnect, onEdgeUpdateEnd) or no drag state.');
    }
  });

  // 新增：处理现有连接更新的结束
  onEdgeUpdateEnd(async (payload: { edge?: Edge, event: MouseEvent | TouchEvent }) => { // Signature changed to single payload object
    const { edge, event } = payload; // Destructure edge and event
    // 在函数入口处立即捕获 connectionEndHandle 的当前值，并进行深拷贝
    const capturedConnectionEndHandle = vueFlowInstance.connectionEndHandle.value ? klona(vueFlowInstance.connectionEndHandle.value) : null;

    console.debug('[DIAGNOSTIC LOG] onEdgeUpdateEnd: Entry. Payload:', { event, updatedEdge: edge ? JSON.parse(JSON.stringify(edge)) : 'undefined' }, 'Composable draggingState.value at entry:', draggingState.value ? JSON.parse(JSON.stringify(draggingState.value)) : null);
    // 打印捕获到的值，而不是实时值
    console.debug('[DIAGNOSTIC LOG] onEdgeUpdateEnd: CAPTURED vueFlowInstance.connectionEndHandle.value:', capturedConnectionEndHandle ? JSON.parse(JSON.stringify(capturedConnectionEndHandle)) : null);
    console.debug('[CanvasConnections DEBUG] onEdgeUpdateEnd triggered.', { event, updatedEdge: edge ? JSON.parse(JSON.stringify(edge)) : 'undefined', initialDraggingState: draggingState.value ? JSON.parse(JSON.stringify(draggingState.value)) : null });

    if (!draggingState.value || !draggingState.value.originalEdge) {
      console.warn('[CanvasConnections DEBUG] onEdgeUpdateEnd: No original edge in draggingState or draggingState is null. This might happen if onEdgeUpdateStart did not set it, or it was cleared prematurely. Current draggingState:', draggingState.value ? JSON.parse(JSON.stringify(draggingState.value)) : 'null');
      draggingState.value = null; // 清理以防万一
      reorderPreviewIndex.value = null;
      console.debug('[DIAGNOSTIC LOG] onEdgeUpdateEnd: Exit (early due to no original edge in draggingState).');
      return;
    }

    const activeDraggingState = klona(draggingState.value);
    // 立即清理全局 draggingState
    draggingState.value = null;
    console.debug('[DIAGNOSTIC LOG] onEdgeUpdateEnd: Global draggingState.value AFTER immediate clear:', JSON.parse(JSON.stringify(draggingState.value)));
    reorderPreviewIndex.value = null;

    const { originalEdge } = activeDraggingState;
    const currentTabId = tabStore.activeTabId;

    if (!currentTabId) {
      console.error("[CanvasConnections DEBUG] [onEdgeUpdateEnd] No active tab ID. Cannot process edge update.");
      // 注意：originalEdge 可能未被移除，这是一个潜在的问题状态。
      console.debug('[DIAGNOSTIC LOG] onEdgeUpdateEnd: Exit (early due to no active tab ID). activeDraggingState (local copy):', activeDraggingState ? JSON.parse(JSON.stringify(activeDraggingState)) : null);
      return;
    }

    // 作为更新操作的一部分，总是先移除原始边
    const sourceNodeOriginal = findNode(originalEdge.source);
    const targetNodeOriginal = findNode(originalEdge.target);
    const oldSourceNodeName = sourceNodeOriginal?.data?.label || originalEdge.source;
    const oldTargetNodeName = targetNodeOriginal?.data?.label || originalEdge.target;
    const removeReason = edge ? 'edge_update_replace_old' : 'edge_update_dropped_on_pane'; // Use 'edge'
    const removeHistorySummary = `断开旧连接 (${edge ? '更新替换' : '拖到画布'}): ${oldSourceNodeName}::${originalEdge.sourceHandle} -> ${oldTargetNodeName}::${originalEdge.targetHandle}`; // Use 'edge'

    const removeHistoryEntry = createHistoryEntry(
      'remove', 'edge', removeHistorySummary,
      {
        edgeId: originalEdge.id,
        sourceNodeId: originalEdge.source,
        sourceHandle: originalEdge.sourceHandle,
        targetNodeId: originalEdge.target,
        targetHandle: originalEdge.targetHandle,
        reason: removeReason
      }
    );
    await workflowStore.removeElementsAndRecord(currentTabId, [originalEdge], removeHistoryEntry);
    console.debug(`[CanvasConnections DEBUG] onEdgeUpdateEnd: Removed original edge ${originalEdge.id}.`);

    if (edge) { // VueFlow 认为连接到了某个东西 (payload.edge 不为 null)
      console.debug(`[CanvasConnections DEBUG] onEdgeUpdateEnd: VueFlow's \`edge\` payload is present. Info:`, JSON.parse(JSON.stringify(edge)));

      // 使用在函数入口处捕获的 capturedConnectionEndHandle
      const finalTargetHandleInfo = capturedConnectionEndHandle;

      if (finalTargetHandleInfo && finalTargetHandleInfo.nodeId && finalTargetHandleInfo.id) {
        // 优先使用捕获到的 connectionEndHandle 的信息来构建新连接参数
        // 当拖拽现有边的目标端时，source 和 sourceHandle 应该保持 originalEdge 的。
        // 当拖拽现有边的源端时，target 和 targetHandle 应该保持 originalEdge 的。
        // VueFlow 的 `edge` payload (即此处的 `edge` 变量) 会反映哪个端点是固定的，哪个是新的。
        // 因此，我们从 `edge` 中获取固定端，从 `finalTargetHandleInfo` 获取新的浮动端。

        let newConnectionParams: Connection;
        // 检查拖拽的是源句柄还是目标句柄，以正确构建 newConnectionParams
        // vueFlowInstance.connectionStartHandle 包含拖拽开始时的句柄信息
        const draggingStartHandle = vueFlowInstance.connectionStartHandle.value;

        if (draggingStartHandle && draggingStartHandle.type === 'source' && draggingStartHandle.nodeId === edge.source && draggingStartHandle.id === edge.sourceHandle) {
          // 正在拖拽源句柄，目标句柄是固定的 (来自原始边或VueFlow的edge payload)
          // 新的源是 finalTargetHandleInfo (如果它是一个有效的源句柄)
          // 但我们通常不允许将边的源端连接到另一个源或目标，这里逻辑简化为总是更新目标。
          // 更完整的实现需要检查 finalTargetHandleInfo.type。
          // 目前的假设是：我们总是拖拽一个已连接的边的“目标端”去连接到新的目标，或者拖拽“源端”去连接到新的源。
          // VueFlow 的 onEdgeUpdateEnd 的 `edge` 参数，其 source/target 指的是 *新形成的连接*。
          // originalEdge 才是原始连接。
          // activeDraggingState.originalEdge.source/target 是原始的。
          // finalTargetHandleInfo 是鼠标最终悬停的句柄。

          // 如果拖拽的是原始边的目标端 (originalEdge.targetHandle)
          if (activeDraggingState.originalEdge.target === draggingStartHandle.nodeId && activeDraggingState.originalEdge.targetHandle === draggingStartHandle.id) {
             // 这是不可能的，因为 draggingStartHandle 是 source 类型
          }


          // 修正逻辑：
          // `edge.source` 和 `edge.sourceHandle` 是连接的起点。
          // `finalTargetHandleInfo.nodeId` 和 `finalTargetHandleInfo.id` 是连接的新终点。
          newConnectionParams = {
            source: edge.source,
            sourceHandle: edge.sourceHandle,
            target: finalTargetHandleInfo.nodeId,
            targetHandle: finalTargetHandleInfo.id,
          };

        } else if (draggingStartHandle && draggingStartHandle.type === 'target' && draggingStartHandle.nodeId === edge.target && draggingStartHandle.id === edge.targetHandle) {
          // 正在拖拽目标句柄，源句柄是固定的
          // 新的目标是 finalTargetHandleInfo
           newConnectionParams = {
            source: edge.source, // 源来自 payload edge
            sourceHandle: edge.sourceHandle,
            target: finalTargetHandleInfo.nodeId, // 新目标来自 connectionEndHandle
            targetHandle: finalTargetHandleInfo.id,
          };
        } else {
            // 默认行为或无法确定拖拽的哪一端时，我们假设更新目标，源来自 payload edge
            // (VueFlow的edge payload应该已经处理了哪一端是固定的)
            console.warn("[CanvasConnections DEBUG] onEdgeUpdateEnd: Could not definitively determine which handle (source/target) was dragged. Defaulting to updating target based on finalTargetHandleInfo and edge payload's source.");
            newConnectionParams = {
                source: edge.source,
                sourceHandle: edge.sourceHandle,
                target: finalTargetHandleInfo.nodeId,
                targetHandle: finalTargetHandleInfo.id,
            };
        }
        // (确保这里的 newConnectionParams 确实被正确赋值了)
        if (!newConnectionParams) { // 安全检查，理论上不应发生
             console.error("[CanvasConnections DEBUG] onEdgeUpdateEnd: newConnectionParams was not set due to unexpected draggingStartHandle state. Aborting connection attempt.");
        } else {
            console.debug(`[CanvasConnections DEBUG] onEdgeUpdateEnd: Using CAPTURED connectionEndHandle for new connection. Params:`, JSON.parse(JSON.stringify(newConnectionParams)));

            if (isValidConnection(newConnectionParams)) {
              console.debug(`[CanvasConnections DEBUG] onEdgeUpdateEnd: New connection (from CAPTURED connectionEndHandle) is valid. Attempting to add verified edge.`);
              await createAndAddVerifiedEdge(currentTabId, newConnectionParams, 'edge_update_create_new_from_captured_endhandle');
            } else {
              console.warn(`[CanvasConnections DEBUG] onEdgeUpdateEnd: New connection (from CAPTURED connectionEndHandle) for edge update is invalid. Original edge ${originalEdge.id} was removed. No new edge added. Target: ${newConnectionParams.target}::${newConnectionParams.targetHandle}`);
            }
        }
      } else {
        console.warn(`[CanvasConnections DEBUG] onEdgeUpdateEnd: VueFlow's \`edge\` payload exists, but CAPTURED connectionEndHandle is invalid or missing details. Treating as disconnect. Original edge ${originalEdge.id} removed. VueFlow edge:`, edge ? JSON.parse(JSON.stringify(edge)) : 'null', "CAPTURED ConnectionEndHandle:", finalTargetHandleInfo ? JSON.parse(JSON.stringify(finalTargetHandleInfo)) : null);
      }
    } else {
      // 拖放到画布上 (VueFlow 的 `edge` 参数为 null)，原始边已被移除，无需创建新边
      console.debug(`[CanvasConnections DEBUG] onEdgeUpdateEnd: Dropped on pane (VueFlow's \`edge\` payload is null). Original edge ${originalEdge.id} removed. No new edge to create.`);
    }
    console.debug('[DIAGNOSTIC LOG] onEdgeUpdateEnd: Exit (normal). activeDraggingState (local copy):', activeDraggingState ? JSON.parse(JSON.stringify(activeDraggingState)) : null);
  });

  // Watch for changes in the handle the mouse is currently over *while dragging*
  // 将 handleConnect 注册为 onConnect 事件的回调
  onConnect(handleConnect);
  watch(vueFlowInstance.connectionEndHandle, (newEndHandle: ConnectingHandle | null, oldEndHandle: ConnectingHandle | null) => {
    const startHandle = vueFlowInstance.connectionStartHandle.value; // This is ConnectingHandle | null

    if (startHandle) { // Only log if a connection drag is in progress
      const startNodeId = startHandle.nodeId;
      const startHandleId = startHandle.id || 'UNKNOWN_START_HANDLE_ID'; // .id is optional string | null
      const startHandleType = startHandle.type;

      if (newEndHandle) {
        // Mouse is over a new potential target handle
        const newEndNodeId = newEndHandle.nodeId;
        const newEndHandleId = newEndHandle.id || 'UNKNOWN_END_HANDLE_ID'; // .id is optional string | null
        const newEndHandleType = newEndHandle.type;
        console.log(
          `[CanvasConnections DEBUG] Dragging from ${startNodeId}::${startHandleId} (${startHandleType}). MOUSE ENTERED handle: ${newEndNodeId}::${newEndHandleId} (${newEndHandleType})`,
        );
      } else if (oldEndHandle) {
        // Mouse left a handle (newEndHandle is null, but oldEndHandle was not)
        const oldEndNodeId = oldEndHandle.nodeId;
        const oldEndHandleId = oldEndHandle.id || 'UNKNOWN_PREV_HANDLE_ID'; // .id is optional string | null
        const oldEndHandleType = oldEndHandle.type;
        console.log(
          `[CanvasConnections DEBUG] Dragging from ${startNodeId}::${startHandleId} (${startHandleType}). MOUSE LEFT handle: ${oldEndNodeId}::${oldEndHandleId} (${oldEndHandleType})`,
        );
      }
    }
  });


  return {
    createEdge,
    // handleConnect, // 不再导出，它是 onConnect 的内部回调
    isValidConnection,
    removeNodeConnections,
    removeTargetConnections,
    draggingState,
    reorderPreviewIndex,
  };
}
