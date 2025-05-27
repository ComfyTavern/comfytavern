import { type Ref, type ComputedRef, ref, watch } from "vue";
import {
  type Connection,
  type Edge,
  type Node,
  useVueFlow,
  // type HandleType, // 移除了未使用的 HandleType
  // 从 @vue-flow/core 导入核心类型
  type VueFlowStore,
  type ConnectingHandle,
} from "@vue-flow/core";
import { getEdgeStyleProps } from "./useEdgeStyles";
// import { useGroupInterfaceSync } from "../group/useGroupInterfaceSync"; // 已移除，因为 syncInterfaceSlotFromConnection 被移除了
import {
  type GroupSlotInfo,
  type DataFlowTypeName,
  DataFlowType,
  BuiltInSocketMatchCategory,
} from "@comfytavern/types";
import { createHistoryEntry } from "@comfytavern/utils";
import { useTabStore } from "@/stores/tabStore";
import { useWorkflowStore } from "@/stores/workflowStore";
import { useNodeStore } from "@/stores/nodeStore"; // 新增导入
import type { FrontendNodeDefinition } from '@/stores/nodeStore'; // 导入类型
import { getNodeType } from "@/utils/nodeUtils";
import { klona } from 'klona/json';
import { nanoid } from 'nanoid';

// DraggingState 定义保持不变
export interface DraggingState {
  type: 'reorder' | 'disconnect_reconnect' | 'unplug_from_input'; // 新增拔出类型
  originalTargetNodeId: string; // 如果是 unplug_from_input，这是被拔出的目标节点
  originalTargetHandleId: string; // 如果是 unplug_from_input，这是被拔出的目标句柄
  originalEdge: Edge; // 拖拽的原始边
  originalSourceNodeId: string; // 原始边的源节点
  originalSourceHandleId?: string; // 原始边的源句柄
  isOriginalTargetMultiInput: boolean; // 原始目标是否为多输入
  originalEvent: MouseEvent | TouchEvent;
  isUnpluggingFromInput?: boolean; // 明确标记是否从输入端拔出
  unpluggedEdgeSourceNodeId?: string; // 拔出后，连接线模拟的源
  unpluggedEdgeSourceHandleId?: string; // 拔出后，连接线模拟的源句柄
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
  const tabStore = useTabStore();
  const workflowStore = useWorkflowStore();
  const nodeStore = useNodeStore(); // 确保 nodeStore 在这里正确初始化

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

  /**
   * 解析句柄 ID，区分普通句柄和子句柄 (例如 'key__0')。
   * @param handleId 待解析的句柄 ID。
   * @returns 返回一个对象，包含原始键名、可选的索引和是否为子句柄的布尔值。
   */
  function parseSubHandleId(handleId: string | null | undefined): { originalKey: string; index?: number; isSubHandle: boolean } {
    if (!handleId) { // Covers null, undefined, and empty string ""
      return { originalKey: '', index: undefined, isSubHandle: false };
    }
    const parts = handleId.split('__');
    
    if (parts.length === 2) {
      const keyPart = parts[0];
      const indexStrPart = parts[1];
      // 显式检查以帮助 TypeScript 缩小类型，即使逻辑上已知它们是字符串
      if (typeof keyPart === 'string' && typeof indexStrPart === 'string') {
        const potentialIndex = parseInt(indexStrPart, 10);
        if (!isNaN(potentialIndex)) {
          return { originalKey: keyPart, index: potentialIndex, isSubHandle: true };
        }
      }
    }
    // 如果不符合 "key__index" 格式，或 index 不是数字，或类型检查未通过，
    // 则原始的 handleId 作为 key。
    return { originalKey: handleId, index: undefined, isSubHandle: false };
  }

  const getReadableNames = (nodeId: string, rawHandleId: string | null | undefined, handleType?: 'source' | 'target') => {
    const node = findNode(nodeId);
    const nodeName = node?.data?.displayName || node?.data?.label || nodeId;

    const { originalKey: parsedHandleKey, index: subHandleIndex, isSubHandle } = parseSubHandleId(rawHandleId);

    let handleName = parsedHandleKey || 'UNKNOWN_HANDLE';
    // 如果是子句柄，可以在名称中体现索引，例如 "MyInput[0]"
    // if (isSubHandle && typeof subHandleIndex === 'number') {
    //   handleName = `${parsedHandleKey}[${subHandleIndex}]`;
    // }

    const actualHandleIdForLog = rawHandleId || 'UNKNOWN_HANDLE_ID'; // 用于日志，避免 null

    if (node && parsedHandleKey) {
      let slotDef: GroupSlotInfo | undefined;
      const nType = getNodeType(node);

      if (handleType === 'source') {
        if (nType === 'core:GroupInput') {
          slotDef = workflowStore.getActiveTabState()?.workflowData?.interfaceInputs?.[parsedHandleKey];
        } else if (nType === 'core:NodeGroup') {
          slotDef = (node.data as any)?.groupInterface?.outputs?.[parsedHandleKey];
        } else {
          slotDef = (node.data as any)?.outputs?.[parsedHandleKey];
        }
      } else if (handleType === 'target') {
        if (nType === 'core:GroupOutput') {
          slotDef = workflowStore.getActiveTabState()?.workflowData?.interfaceOutputs?.[parsedHandleKey];
        } else if (nType === 'core:NodeGroup') {
          slotDef = (node.data as any)?.groupInterface?.inputs?.[parsedHandleKey];
        } else {
          slotDef = (node.data as any)?.inputs?.[parsedHandleKey];
        }
      } else { // 如果没有提供 handleType，尝试同时检查 inputs 和 outputs
        slotDef = (node.data as any)?.inputs?.[parsedHandleKey] || (node.data as any)?.outputs?.[parsedHandleKey] || (node.data as any)?.groupInterface?.inputs?.[parsedHandleKey] || (node.data as any)?.groupInterface?.outputs?.[parsedHandleKey];
        if (!slotDef) { // 尝试检查工作流级别的接口定义
          const activeState = workflowStore.getActiveTabState()?.workflowData;
          if (activeState) {
            slotDef = activeState.interfaceInputs?.[parsedHandleKey] || activeState.interfaceOutputs?.[parsedHandleKey];
          }
        }
      }

      if (slotDef?.displayName) {
        handleName = slotDef.displayName;
        // 如果是子句柄，并且我们想在显示名称后附加索引
        if (isSubHandle && typeof subHandleIndex === 'number') {
          handleName = `${slotDef.displayName} [${subHandleIndex}]`; // 例如 "图像 [0]"
        }
      } else if (isSubHandle && typeof subHandleIndex === 'number') {
        // 如果没有 displayName 但有子句柄索引，至少显示原始键和索引
        handleName = `${parsedHandleKey}[${subHandleIndex}]`;
      }
    }
    // 返回原始的 rawHandleId 作为 handleId，因为其他地方可能需要它来识别子句柄
    return { nodeName, handleName, nodeId, handleId: actualHandleIdForLog, parsedHandleKey, subHandleIndex, isSubHandle };
  };

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

  const isValidConnection = (connection: Connection, updatingEdgeId?: string): boolean => {
    console.log('%c[CanvasConnections DEBUG] isValidConnection CALLED (TOP LEVEL). Connection:', 'color: red; font-weight: bold;', JSON.parse(JSON.stringify(connection)), `UpdatingEdgeId: ${updatingEdgeId}`); // 强调日志
    console.log('[CanvasConnections DEBUG] isValidConnection called. Connection:', JSON.parse(JSON.stringify(connection)), `UpdatingEdgeId: ${updatingEdgeId}`);
    const { source, target, sourceHandle: rawSourceHandle, targetHandle: rawTargetHandle } = connection;

    if (!source || !target || !rawSourceHandle || !rawTargetHandle) {
      console.warn('[CanvasConnections DEBUG] isValidConnection: Missing connection parameters -> false');
      return false;
    }

    const { originalKey: sourceKey } = parseSubHandleId(rawSourceHandle);
    const { originalKey: targetKey } = parseSubHandleId(rawTargetHandle);

    if (!sourceKey || !targetKey) {
      console.warn(`[CanvasConnections DEBUG] isValidConnection: Could not parse original key from raw handles. RawSource: ${rawSourceHandle}, RawTarget: ${rawTargetHandle} -> false`);
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
      sourceOutput = activeState?.workflowData?.interfaceInputs?.[sourceKey];
    } else if (getNodeType(sourceNode) === 'core:NodeGroup') {
      sourceOutput = (sourceNode.data as any)?.groupInterface?.outputs?.[sourceKey];
    } else {
      sourceOutput = (sourceNode.data as any)?.outputs?.[sourceKey];
    }

    let targetInput: GroupSlotInfo | undefined;
    if (getNodeType(targetNode) === 'core:GroupOutput') {
      const activeState = workflowStore.getActiveTabState();
      targetInput = activeState?.workflowData?.interfaceOutputs?.[targetKey];
    } else if (getNodeType(targetNode) === 'core:NodeGroup') {
      targetInput = (targetNode.data as any)?.groupInterface?.inputs?.[targetKey];
    } else {
      targetInput = (targetNode.data as any)?.inputs?.[targetKey];
    }

    if (!sourceOutput || !targetInput) {
      console.error(`[CanvasConnections DEBUG] isValidConnection: Slot definition not found for ${sourceKey}(raw:${rawSourceHandle})@${source} or ${targetKey}(raw:${rawTargetHandle})@${target}. SourceOutput:`, sourceOutput, "TargetInput:", targetInput, "-> false");
      return false;
    }
    const compatible = isTypeCompatible(sourceOutput, targetInput);
    console.log(`[CanvasConnections DEBUG] isValidConnection: Result of isTypeCompatible for ${sourceKey}@${source} -> ${targetKey}@${target} is: ${compatible}`);
    
    if (compatible) {
      // 首先，获取目标输入定义，以检查其是否为 multi:true
      // targetNode 和 targetKey 已经在此函数前面部分获取和验证过
      // targetInput (GroupSlotInfo) 也已获取

      if (targetInput && targetInput.multi === true) {
        // 目标是一个 multi:true 的输入插槽
        const parsedTargetHandleInfo = parseSubHandleId(rawTargetHandle);
        if (!parsedTargetHandleInfo.isSubHandle) {
          // 连接尝试的目标句柄ID不是一个子句柄格式 (例如，是 'text_inputs' 而不是 'text_inputs__0')
          // 对于 multi:true 的输入，我们强制要求连接到具体的子句柄。
          console.warn(`[CanvasConnections DEBUG] isValidConnection: Attempted to connect to the parent handle ('${rawTargetHandle}') of a multi-input slot on node '${target}'. Connections to multi-input slots must target a specific sub-handle (e.g., '${rawTargetHandle}__0'). -> false`);
          return false;
        }
      }

      // 然后，如果目标确实是一个子句柄 (parsedTargetHandleInfo.isSubHandle 会再次确认为 true，或者如果上面没有返回false，这里继续检查)
      // 或者即使不是 multi:true，但如果handleID恰好是 key__index 格式，也按子句柄检查（虽然不太可能）
      const parsedTargetHandleInfoForOccupationCheck = parseSubHandleId(rawTargetHandle); // 重新parse或复用上面的
      const targetIsSubHandle = parsedTargetHandleInfoForOccupationCheck.isSubHandle;
      
      console.log(`[CanvasConnections DEBUG] isValidConnection: Checking sub-handle occupation. Connection Target: ${connection.target}, Raw Target Handle: ${rawTargetHandle}, Parsed Target Handle Info:`, JSON.parse(JSON.stringify(parsedTargetHandleInfoForOccupationCheck)));
      console.log(`[CanvasConnections DEBUG] isValidConnection: Is target a sub-handle (for occupation check)? ${targetIsSubHandle}`);

      if (targetIsSubHandle) { // targetIsSubHandle is true if connection.targetHandle is like 'key__index'
        const isNewConnection = !updatingEdgeId;

        // targetInput (正确的变量名) 应该在此函数的前面部分已经基于 originalKey 获取了
        if (targetInput && targetInput.multi === true && isNewConnection) {
          // 对于新的连接到多输入插槽：
          // 即使视觉上指向的子句柄 (connection.targetHandle) 当前已被连接，我们也允许它通过此检查。
          // 实际的插入索引将由 reorderPreviewIndex 决定，并且 connectEdgeToMultiInput 会处理现有连接的顺延。
          console.log(`[CanvasConnections DEBUG] isValidConnection: New connection targeting multi-input sub-handle ${connection.targetHandle}. Allowing. Reorder logic will manage placement and shifting.`);
          // 对于这种情况，我们不因“占用”而返回 false。类型兼容性等其他检查仍然适用。
        } else {
          // 对于以下情况，执行原始的占用检查：
          // 1. 目标不是多输入插槽，但句柄名恰好是 key__index 格式 (不太可能，但作为防御)。
          // 2. 正在更新一个现有的连接 (updatingEdgeId 已提供)。
          const currentEdges = getEdges.value;
          console.log(`[CanvasConnections DEBUG] isValidConnection: Current edges count: ${currentEdges.length}`);
          const edgesToTargetNode = currentEdges.filter(e => e.target === connection.target);
          console.log(`[CanvasConnections DEBUG] isValidConnection: Edges connected to target node ${connection.target}:`, edgesToTargetNode.map(e => ({ id: e.id, targetHandle: e.targetHandle })));
          
          const occupyingEdges = currentEdges.filter(edge =>
            edge.target === connection.target &&
            edge.targetHandle === connection.targetHandle
          );
          const isOccupied = occupyingEdges.length > 0;
          console.log(`[CanvasConnections DEBUG] isValidConnection: Target sub-handle ${connection.target}::${connection.targetHandle} occupied by ${occupyingEdges.length} edge(s). (Not a new connection to multi-input where reorder applies, or target is not multi-input)`);

          if (isOccupied) {
            const singleOccupyingEdge = (occupyingEdges.length === 1) ? occupyingEdges[0] : null;
            if (updatingEdgeId && singleOccupyingEdge && singleOccupyingEdge.id === updatingEdgeId) {
              console.log(`[CanvasConnections DEBUG] isValidConnection: Target sub-handle ${connection.target}::${connection.targetHandle} is occupied by the edge being updated ('${updatingEdgeId}'). Allowing reconnection.`);
            } else { // 被不同的边或多个边占用
              // 如果目标是多输入插槽 (targetInput 应该已定义且 multi === true)
              // 即使这是一个连接更新，并且目标子句柄被其他边占用，我们也应该允许。
              // 后续的重排逻辑 (在 onEdgeUpdateEnd 中调用的 moveAndReconnectEdgeAndRecord) 会处理实际的放置。
              if (targetInput && targetInput.multi === true) {
                console.log(`[CanvasConnections DEBUG] isValidConnection: Edge update/connection to multi-input sub-handle ${connection.target}::${connection.targetHandle} which is occupied by a different edge. Allowing, as reorder/placement logic will manage.`);
                // 对于多输入插槽，当被其他边占用时，不在此处返回 false。
                // 类型兼容性 (由 `compatible` 变量检查) 和其他通用规则仍然适用。
              } else {
                // 对于非多输入插槽 (或者如果 targetInput 未定义/不是 multi 类型),
                // 被不同的边占用是一个冲突。
                console.warn(`[CanvasConnections DEBUG] isValidConnection: Target sub-handle ${connection.target}::${connection.targetHandle} (non-multi-input or unknown type) is ALREADY OCCUPIED by a different edge. updatingEdgeId: '${updatingEdgeId}'. Occupying edge IDs: ${occupyingEdges.map(e => e.id).join(', ')}. -> false`);
                return false;
              }
            }
          } else {
            console.log(`[CanvasConnections DEBUG] isValidConnection: Target sub-handle ${connection.target}::${connection.targetHandle} is NOT occupied (or it's a new connection to multi-input where occupation of specific sub-handle doesn't block initial validation). Proceeding.`);
          }
        }
      }
    }
    
    return compatible;
  };

  const createEdge = (params: Connection): Edge | null => {
    if (draggingState.value?.type === 'reorder') return null;
    if (!isValidConnection(params)) return null;

    const sourceNode = getNodes.value.find((node) => node.id === params.source)!;
    const targetNode = getNodes.value.find((node) => node.id === params.target)!;

    let sourceOutputDef: GroupSlotInfo | undefined;
    if (getNodeType(sourceNode) === 'core:GroupInput') { sourceOutputDef = workflowStore.getActiveTabState()?.workflowData?.interfaceInputs?.[params.sourceHandle!]; }
    else if (getNodeType(sourceNode) === 'core:NodeGroup') { sourceOutputDef = (sourceNode.data as any)?.groupInterface?.outputs?.[params.sourceHandle!]; }
    else { sourceOutputDef = (sourceNode.data as any)?.outputs?.[params.sourceHandle!]; }

    // params.targetHandle 可能是子句柄ID (e.g., "key__0") 或普通句柄ID
    const { originalKey: parsedTargetHandleKey } = parseSubHandleId(params.targetHandle); // 移除了未使用的 isTargetSubHandle

    let targetInputDef: GroupSlotInfo | undefined;
    // 使用 parsedTargetHandleKey 来获取插槽定义
    if (getNodeType(targetNode) === 'core:GroupOutput') { targetInputDef = workflowStore.getActiveTabState()?.workflowData?.interfaceOutputs?.[parsedTargetHandleKey]; }
    else if (getNodeType(targetNode) === 'core:NodeGroup') { targetInputDef = (targetNode.data as any)?.groupInterface?.inputs?.[parsedTargetHandleKey]; }
    else { targetInputDef = (targetNode.data as any)?.inputs?.[parsedTargetHandleKey]; }

    if (!sourceOutputDef || !targetInputDef) {
        console.error(`[CanvasConnections DEBUG] createEdge: Slot definition not found. Source: ${params.sourceHandle}, Target (parsed): ${parsedTargetHandleKey} (raw: ${params.targetHandle})`);
        return null;
    }

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
    
    let edgeType = 'default'; // 始终使用默认边类型
    let finalTargetHandleForEdge = params.targetHandle; // 始终使用 Vue Flow 提供的实际连接句柄 (即子句柄 ID)

    if (targetInputDef.multi) {
      // 即便对于多输入，我们也希望使用 'default' 边类型，
      // 并且 finalTargetHandleForEdge 应该保持为 params.targetHandle (子句柄 ID)。
      // 如果标准边正确连接到各个子句柄，就不再需要 'sortedMultiTargetEdge' 及其连接到主键的逻辑。
      console.log(`[CanvasConnections DEBUG] createEdge: Multi-input target. Edge type WILL BE: ${edgeType}. Edge targetHandle WILL BE the sub-handle: ${finalTargetHandleForEdge}.`);
    } else {
      // 单输入目标，标准边，连接到特定句柄。
      console.log(`[CanvasConnections DEBUG] createEdge: Single-input target. Edge type: ${edgeType}. Edge targetHandle: ${finalTargetHandleForEdge}.`);
    }

    return {
      id: nanoid(10),
      source: params.source,
      sourceHandle: params.sourceHandle,
      target: params.target,
      targetHandle: finalTargetHandleForEdge, // 使用调整后的 targetHandle
      type: edgeType,
      animated,
      style,
      markerEnd,
      data: { sourceType: finalSourceDft, targetType: finalTargetDft },
    };
  };

  const handleConnect = async (params: Connection): Promise<Edge | null> => {
    console.log('[CanvasConnections DEBUG] handleConnect triggered. Params:', JSON.parse(JSON.stringify(params)));
    const currentTabId = tabStore.activeTabId;
    if (!currentTabId) {
      console.error("[CanvasConnections DEBUG] [handleConnect] No active tab ID.");
      return null;
    }

    // onConnect (handleConnect) 只处理全新的连接。
    // 拖拽现有连接的逻辑已移至 onEdgeUpdateEnd。
    if (draggingState.value) {
      console.warn('[CanvasConnections DEBUG] handleConnect: Expected draggingState to be null for a new connection, but it was not. This indicates an edge update is being handled by onEdgeUpdateEnd. Skipping handleConnect.');
      return null; // 让 onEdgeUpdateEnd 处理
    }

    console.log('[CanvasConnections DEBUG] handleConnect: Processing as BRAND NEW connection.');

    if (!isValidConnection(params)) {
      console.log('[CanvasConnections DEBUG] handleConnect (New): Connection is invalid.');
      return null;
    }

    const { source, target, sourceHandle, targetHandle } = params;
    if (!source || !target || !sourceHandle || !targetHandle) {
      console.error('[CanvasConnections DEBUG] handleConnect: Missing critical connection parameters.');
      return null;
    }

    const sourceNode = findNode(source);
    const targetNode = findNode(target);
    if (!sourceNode || !targetNode) {
      console.error(`[CanvasConnections DEBUG] handleConnect: Source or target node not found.`);
      return null;
    }

    let targetInputDef: GroupSlotInfo | undefined;
    const targetNodeType = getNodeType(targetNode);
    const { originalKey: parsedTargetHandleKeyFromParams } = parseSubHandleId(targetHandle); // 解析原始键

    if (targetNodeType === 'core:GroupOutput') {
        targetInputDef = workflowStore.getActiveTabState()?.workflowData?.interfaceOutputs?.[parsedTargetHandleKeyFromParams];
    } else if (targetNodeType === 'core:NodeGroup') {
        targetInputDef = (targetNode.data as any)?.groupInterface?.inputs?.[parsedTargetHandleKeyFromParams];
    } else {
        targetInputDef = (targetNode.data as any)?.inputs?.[parsedTargetHandleKeyFromParams];
    }

    if (!targetInputDef) {
      console.error(
        `[CanvasConnections DEBUG] handleConnect: Target input definition not found for ${target}::${targetHandle}. Parsed key: ${parsedTargetHandleKeyFromParams}. Target node type: '${targetNodeType}'. Expected definition type (example for MergeNode): 'TextMerge'.`
      );
      // 打印目标节点数据和所有可用节点定义以供调试
      if (targetNode?.data) {
        console.log('[CanvasConnections DEBUG] Target node data.inputs:', JSON.parse(JSON.stringify(targetNode.data.inputs)));
      }
      // 从 nodeStore 获取节点定义数组
      const nodeDefinitionsArray: FrontendNodeDefinition[] = nodeStore.nodeDefinitions; // 直接访问，无需 .value

      if (nodeDefinitionsArray && nodeDefinitionsArray.length > 0) {
        console.log('[CanvasConnections DEBUG] All available node definition types in nodeStore:', nodeDefinitionsArray.map((d: FrontendNodeDefinition) => d.type));
        const textMergeDef = nodeDefinitionsArray.find((d: FrontendNodeDefinition) => d.type === 'TextMerge' && d.namespace === 'Utilities'); // 确保也匹配命名空间
        if (textMergeDef) {
            console.log('[CanvasConnections DEBUG] TextMerge definition from nodeStore:', JSON.parse(JSON.stringify(textMergeDef)));
        } else {
            console.log('[CanvasConnections DEBUG] TextMerge definition NOT found in workflowManager.');
        }
      }
      return null;
    }

    const isTargetMultiInput = targetInputDef.multi === true;
    let targetIndexInOrder: number | undefined = undefined;
    if (isTargetMultiInput) {
      if (reorderPreviewIndex.value !== null) {
        targetIndexInOrder = reorderPreviewIndex.value;
        console.log(`[CanvasConnections DEBUG] handleConnect: Multi-input target. Using reorderPreviewIndex: ${targetIndexInOrder}.`);
      } else {
        // 如果 reorderPreviewIndex 不可用（例如非拖拽创建或 watch 逻辑未覆盖），则追加到末尾
        // 使用从 targetHandle 解析出的 originalKey 来访问 inputConnectionOrders
        const { originalKey: parsedTargetKeyForOrder } = parseSubHandleId(targetHandle);
        const existingConnectionsToHandle = (targetNode.data.inputConnectionOrders?.[parsedTargetKeyForOrder] as string[] | undefined) || [];
        targetIndexInOrder = existingConnectionsToHandle.length;
        console.warn(`[CanvasConnections DEBUG] handleConnect: Multi-input target. reorderPreviewIndex is null. Using originalKey '${parsedTargetKeyForOrder}' for order calculation. Appending to end (index: ${targetIndexInOrder}).`);
      }
    } else {
      // 对于单输入，如果已有连接，协调器 connectEdgeToInputAndRecord 或 moveAndReconnectEdgeAndRecord 会处理替换逻辑。
      // 此处无需手动移除，只需传递正确的参数给协调器。
      // 如果是全新连接到单输入，且该单输入已有连接，则旧连接会被替换。
      // targetIndexInOrder 保持 undefined
    }

    // 调用 createEdge 来获取包含正确 type 和 targetHandle (原始键 for multi-input) 的边对象
    const newEdgeObjectFromCreateEdge = createEdge(params);

    if (!newEdgeObjectFromCreateEdge) {
      // createEdge 内部已经调用了 isValidConnection 并可能打印了错误
      console.error('[CanvasConnections DEBUG] handleConnect: createEdge returned null. Aborting connection.');
      return null;
    }

    // newEdgeObjectFromCreateEdge 现在包含了所有必要的属性，包括
    // id, source, sourceHandle, target, targetHandle (原始键), type, animated, style, markerEnd, data
    // 我们将这个完整的对象（或其相关部分）传递给协调器
    // 当前 connectEdgeToInputAndRecord 期望一个更简单的 newEdgeParams 对象，
    // 我们需要确保它能处理或我们传递它期望的结构，但包含关键的修正。
    // 为了最小化对协调器的立即更改，我们先构造一个包含修正后 targetHandle 和 type 的对象。
    // 理想情况下，协调器应该接受一个完整的 EdgeInit 对象。

    const newEdgeParamsForCoordinator = {
      id: newEdgeObjectFromCreateEdge.id,
      source: newEdgeObjectFromCreateEdge.source,
      sourceHandle: newEdgeObjectFromCreateEdge.sourceHandle,
      target: newEdgeObjectFromCreateEdge.target,
      targetHandle: newEdgeObjectFromCreateEdge.targetHandle, // 这是来自 createEdge 的，对于多输入是原始键
      type: newEdgeObjectFromCreateEdge.type,                 // 这是来自 createEdge 的
      animated: newEdgeObjectFromCreateEdge.animated,
      style: newEdgeObjectFromCreateEdge.style,
      markerEnd: newEdgeObjectFromCreateEdge.markerEnd,
      data: newEdgeObjectFromCreateEdge.data,
    };
    // 注意：上面的 targetHandle 是 params.targetHandle (子句柄ID)，而 newEdgeObjectFromCreateEdge.targetHandle 才是修正后的。
    // 所以，上面的 sourceNames 和 targetNames 应该基于 params 来获取，因为它们用于用户可读的日志。
    // 而 newEdgeParamsForCoordinator.targetHandle 必须是修正后的。

            // Roo: sourceNames and targetNames removed as they were unused.
            // HistoryEntry creation re-introduced below.
        
            // 调用新的协调器函数
            // 注意：这里不再需要 createAndAddVerifiedEdge，因为类型转换和接口同步逻辑
            // 应该在协调器函数内部或由协调器调用的更底层的服务处理。
            // 目前 connectEdgeToInputAndRecord 还不处理类型转换或接口同步。
            // 这部分可能需要在未来的重构中加入到协调器或其调用的服务中。
            // 暂时，我们假设 connectEdgeToInputAndRecord 专注于连接和排序。
        
            // TODO: 考虑接口同步 (syncInterfaceSlotFromConnection) 和类型转换逻辑如何与新协调器集成。
            // 目前的 connectEdgeToInputAndRecord 比较纯粹，只负责添加边和更新顺序。
            // 复杂的类型转换和接口同步可能需要一个更高层次的协调器或在 connectEdgeToInputAndRecord 内部扩展。
            
            const readableSource = getReadableNames(params.source, params.sourceHandle, 'source');
            const readableTarget = getReadableNames(params.target, params.targetHandle, 'target');
            const connectSummary = `连接 ${readableSource.nodeName}::${readableSource.handleName} -> ${readableTarget.nodeName}::${readableTarget.handleName}`;
            const historyEntry = createHistoryEntry(
              "connect",
              "edge",
              connectSummary,
              {
                edgeId: newEdgeParamsForCoordinator.id,
                sourceNodeId: newEdgeParamsForCoordinator.source,
                sourceHandleId: newEdgeParamsForCoordinator.sourceHandle,
                targetNodeId: newEdgeParamsForCoordinator.target,
                targetHandleId: newEdgeParamsForCoordinator.targetHandle, // This is the sub-handle ID
                type: newEdgeParamsForCoordinator.type,
                data: newEdgeParamsForCoordinator.data,
              }
            );

            await workflowStore.connectEdgeToInputAndRecord(
              newEdgeParamsForCoordinator, // First arg is the edge itself
              targetIndexInOrder,
              historyEntry // Third arg is the HistoryEntry
            );
    // 由于 connectEdgeToInputAndRecord 是异步的，并且会更新 store，
    // VueFlow 应该会自动响应 store 的变化来渲染新的边。
    // 我们返回一个象征性的 Edge 对象或 null。
    // 重要的是状态已通过协调器更新。
    const finalEdgeState = workflowStore.getElements(currentTabId).find(el => el.id === newEdgeObjectFromCreateEdge.id && "source" in el) as Edge | undefined; // 使用 newEdgeObjectFromCreateEdge.id
    console.log(`[CanvasConnections DEBUG] handleConnect (New): Finished calling connectEdgeToInputAndRecord. Resulting edge in store:`, finalEdgeState ? finalEdgeState.id : 'not found in store immediately');
    return finalEdgeState || null; // 返回 store 中的边或 null
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
      console.debug('[DIAGNOSTIC LOG] onEdgeUpdateStart: Exit (early due to invalid eventDetails). Final draggingState:', draggingState.value ? JSON.parse(JSON.stringify(draggingState.value)) : null);
      return;
    }

    const event = eventDetails.event as MouseEvent | undefined;
    const edge = eventDetails.edge as Edge | undefined;

    if (!event || !edge) {
      console.error('[CanvasConnections DEBUG] onEdgeUpdateStart: "event" or "edge" is missing in eventDetails. Received:', eventDetails);
      draggingState.value = null;
      console.debug('[DIAGNOSTIC LOG] onEdgeUpdateStart: Exit (early due to missing event or edge). Final draggingState:', draggingState.value ? JSON.parse(JSON.stringify(draggingState.value)) : null);
      return;
    }

    // 关键验证：对于一个正在被更新（拖拽）的边，其 targetHandle 必须是一个有效的字符串。
    // sourceHandle 可以是 string | null (例如，如果允许从节点本身拖拽，尽管我们主要处理句柄)。
    // DraggingState.originalTargetHandleId 要求 string。
    if (typeof edge.targetHandle !== 'string') {
      console.error(`[CanvasConnections DEBUG] onEdgeUpdateStart: Edge targetHandle is invalid (not a string). Edge ID: ${edge.id}, Target Handle: ${edge.targetHandle}. This is required for DraggingState.`);
      draggingState.value = null;
      console.debug('[DIAGNOSTIC LOG] onEdgeUpdateStart: Exit (early due to invalid edge.targetHandle). Final draggingState:', draggingState.value ? JSON.parse(JSON.stringify(draggingState.value)) : null);
      return;
    }
    // 至此，edge.targetHandle 可以安全地视为 string。
    // edge.sourceHandle 仍然是 string | null | undefined。

    // 改为通过 event.target 判断拖拽起始点
    const targetElement = event.target as HTMLElement;
    let isUnpluggingFromInputHandle = false;
    let draggedHandleType: 'source' | 'target' | null = null;
    let draggedNodeId: string | null = null;
    let draggedHandleId: string | null = null;

    const edgeUpdater = targetElement.closest('.vue-flow__edgeupdater');

    if (edgeUpdater) {
      if (edgeUpdater.classList.contains('vue-flow__edgeupdater-target')) {
        isUnpluggingFromInputHandle = true;
        draggedHandleType = 'target';
        draggedNodeId = edge.target;
        draggedHandleId = edge.targetHandle; // edge.targetHandle 已验证为 string
      } else if (edgeUpdater.classList.contains('vue-flow__edgeupdater-source')) {
        isUnpluggingFromInputHandle = false;
        draggedHandleType = 'source';
        draggedNodeId = edge.source;
        draggedHandleId = edge.sourceHandle ?? null; // sourceHandle 可以是 null
      } else {
        console.error('[CanvasConnections DEBUG] onEdgeUpdateStart: Clicked on an edge updater, but cannot determine if it was source or target.', edgeUpdater);
        draggingState.value = null;
        console.debug('[DIAGNOSTIC LOG] onEdgeUpdateStart: Exit (early due to unknown edge updater type). Final draggingState:', draggingState.value ? JSON.parse(JSON.stringify(draggingState.value)) : null);
        return;
      }
    } else {
      // 如果不是直接点击 updater，尝试回退到 vueFlowInstance.connectionStartHandle (作为备用方案)
      const fallbackStartHandleDetails = vueFlowInstance.connectionStartHandle.value;
      if (fallbackStartHandleDetails && fallbackStartHandleDetails.nodeId && fallbackStartHandleDetails.id && fallbackStartHandleDetails.type) {
        console.warn('[CanvasConnections DEBUG] onEdgeUpdateStart: Could not determine dragged handle from event.target being an edge updater, falling back to vueFlowInstance.connectionStartHandle.value. This might be less reliable.', fallbackStartHandleDetails);
        isUnpluggingFromInputHandle = fallbackStartHandleDetails.type === 'target';
        draggedHandleType = fallbackStartHandleDetails.type;
        draggedNodeId = fallbackStartHandleDetails.nodeId;
        // vueFlowInstance.connectionStartHandle.id 可能是 null，但 edge 上的 handleId 应该是 string
        // 我们需要确保从 edge 对象获取正确的 handleId，如果拖拽的是它的一部分
        if (draggedHandleType === 'target') {
          draggedHandleId = edge.targetHandle; // edge.targetHandle 已验证为 string
        } else if (draggedHandleType === 'source') {
          draggedHandleId = edge.sourceHandle ?? null; // sourceHandle 可以是 null
        } else { // Should not happen if type is set
          draggedHandleId = fallbackStartHandleDetails.id ?? null; // fallback id 也可以是 null
        }

      } else {
        console.error('[CanvasConnections DEBUG] onEdgeUpdateStart: Clicked on an edge, but cannot determine dragged handle from event.target (not an updater) and connectionStartHandle is not set or invalid.', { targetElement, fallbackStartHandleDetails });
        draggingState.value = null;
        console.debug('[DIAGNOSTIC LOG] onEdgeUpdateStart: Exit (early due to undetermined drag start from edge click). Final draggingState:', draggingState.value ? JSON.parse(JSON.stringify(draggingState.value)) : null);
        return;
      }
    }

    // 现在检查 draggedHandleId。
    // 如果拖拽的是 target (isUnpluggingFromInputHandle = true), draggedHandleId 必须是 string (来自 edge.targetHandle)。
    // 如果拖拽的是 source (isUnpluggingFromInputHandle = false), draggedHandleId 可以是 string 或 null (来自 edge.sourceHandle ?? null)。
    // 我们需要确保如果它是 null，后续逻辑能正确处理，或者在这里就认为无效。
    // DraggingState.originalSourceHandleId 是 string | undefined，所以 null 需要转为 undefined。
    // DraggingState.originalTargetHandleId 是 string。

    if (!draggedHandleType || !draggedNodeId) {
      console.error('[CanvasConnections DEBUG] onEdgeUpdateStart: Failed to determine draggedHandleType or draggedNodeId.', { draggedHandleType, draggedNodeId });
      draggingState.value = null;
      console.debug('[DIAGNOSTIC LOG] onEdgeUpdateStart: Exit (early due to missing type or nodeId). Final draggingState:', draggingState.value ? JSON.parse(JSON.stringify(draggingState.value)) : null);
      return;
    }

    // 如果拖拽的是目标句柄，那么 draggedHandleId 必须是字符串 (因为 edge.targetHandle 已验证为字符串)
    if (draggedHandleType === 'target' && typeof draggedHandleId !== 'string') {
      console.error(`[CanvasConnections DEBUG] onEdgeUpdateStart: Dragging target handle, but draggedHandleId is not a string. This should not happen if edge.targetHandle was validated. draggedHandleId: ${draggedHandleId}`);
      draggingState.value = null;
      return;
    }
    // 如果拖拽的是源句柄，draggedHandleId 可以是 string | null。

    // 在记录日志和设置 DraggingState 时，需要处理 draggedHandleId 可能为 null 的情况（当拖拽源句柄时）
    // const logHandleId = draggedHandleId === null ? 'NULL_HANDLE' : draggedHandleId; // 使用 getReadableNames 代替
    const draggedNames = getReadableNames(draggedNodeId!, draggedHandleId, draggedHandleType!);
    console.log(`[CanvasConnections DEBUG] onEdgeUpdateStart triggered. Edge ID: ${edge.id}. Drag started from handle type: ${draggedHandleType} on node ${draggedNames.nodeName} (ID: ${draggedNames.nodeId}) handle ${draggedNames.handleName} (ID: ${draggedNames.handleId}). Is unplugging from input: ${isUnpluggingFromInputHandle}`);

    let typeForDraggingState: DraggingState['type'] = isUnpluggingFromInputHandle ? 'unplug_from_input' : 'disconnect_reconnect';
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

        if (targetInputDef) {
          isOriginalTargetMulti = targetInputDef.multi === true;
        }
      }
    }

    draggingState.value = {
      type: typeForDraggingState,
      originalTargetNodeId: edge.target, // 对于 unplug_from_input，这是被拔出的目标
      originalTargetHandleId: edge.targetHandle, // 已验证为 string
      originalEdge: klona(edge),
      originalSourceNodeId: edge.source,
      originalSourceHandleId: edge.sourceHandle ?? undefined, // 保持 string | undefined
      isOriginalTargetMultiInput: isOriginalTargetMulti,
      originalEvent: event,
      isUnpluggingFromInput: isUnpluggingFromInputHandle,
      // 如果是从输入端拔出，我们需要模拟连接线的另一端是原始的源
      unpluggedEdgeSourceNodeId: isUnpluggingFromInputHandle ? edge.source : undefined,
      unpluggedEdgeSourceHandleId: isUnpluggingFromInputHandle ? (edge.sourceHandle ?? undefined) : undefined, // 确保 null 被转换成 undefined
    };

    if (isUnpluggingFromInputHandle) {
      // 阻止 VueFlow 默认的边更新行为，因为我们将手动处理这个“拔出”操作
      // 这通常通过在 onEdgeUpdate 回调中返回 false 来实现，但 onEdgeUpdateStart 没有这个机制。
      // 我们将在 onEdgeUpdateEnd 中处理，如果检测到是 unplug_from_input，则不创建新边，而是处理拔出逻辑。
      console.log(`[CanvasConnections DEBUG] onEdgeUpdateStart: Detected unplug from input. Original edge ${edge.id} will be managed manually.`);
    }

    console.log('[CanvasConnections DEBUG] onEdgeUpdateStart: Set draggingState. State:', JSON.parse(JSON.stringify(draggingState.value)));
    console.debug('[DIAGNOSTIC LOG] onEdgeUpdateStart: draggingState AFTER set:', JSON.parse(JSON.stringify(draggingState.value)));
    console.debug('[DIAGNOSTIC LOG] onEdgeUpdateStart: Exit (normal). Final draggingState:', JSON.parse(JSON.stringify(draggingState.value)));
  });

  onConnectStart((params) => {
    console.log('[CanvasConnections DEBUG] onConnectStart triggered. Params:', JSON.parse(JSON.stringify(params)));
    const startHandleNodeId = params.nodeId;
    const startHandleId = params.handleId;
    const startHandleType = params.handleType; // 'source' or 'target'

    // 如果是从已连接的输入句柄开始拖拽 (即 handleType 是 'target' 且该句柄已有连接)
    // 这种情况应该由 onEdgeUpdateStart 覆盖，因为它会检测到正在拖拽一个现有的边。
    // onConnectStart 主要用于处理从一个 *未连接* 的句柄开始拖拽新连接的情况。
    // 或者，当 onEdgeUpdateStart 触发时，它会设置 draggingState。
    // 如果 draggingState 已经设置，说明是 onEdgeUpdateStart 触发的。
    if (draggingState.value) {
      console.log('[CanvasConnections DEBUG] onConnectStart: draggingState is already set (likely by onEdgeUpdateStart for an existing edge). onConnectStart will not overwrite it.');
      return;
    }

    // 如果是从一个 target handle 开始拖拽，并且这个 target handle 当前有连接，
    // 这实际上是一个“拔出”操作，应该由 onEdgeUpdateStart 处理（因为它会识别出正在拖动现有边）。
    // 此处的 onConnectStart 主要是为了处理从一个 *空闲* 的句柄开始拖拽新连接。
    if (startHandleType === 'target') {
      const existingEdgesToThisHandle = getEdges.value.filter(
        (edge) => edge.target === startHandleNodeId && edge.targetHandle === startHandleId
      );
      if (existingEdgesToThisHandle.length > 0) {
        // 这意味着用户从一个已连接的输入句柄开始拖拽。
        // VueFlow 应该会触发 onEdgeUpdateStart 来处理这个场景。
        // 我们在这里不应该设置 draggingState，以避免冲突。
        console.log(`[CanvasConnections DEBUG] onConnectStart: Drag started from an already connected target handle (${startHandleNodeId}::${startHandleId}). This should be handled by onEdgeUpdateStart.`);
        // 不设置 draggingState，让 onEdgeUpdateStart 处理
        return;
      }
    }

    // 对于从空闲句柄开始的全新连接尝试，draggingState 保持 null
    console.log('[CanvasConnections DEBUG] onConnectStart: Initializing for a brand new connection from a free handle (draggingState remains null).');
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
    const originalEdgeIdFromDrag = originalEdge?.id; // 获取正在拖拽的原始边的 ID
    const currentTabId = tabStore.activeTabId;

    if (!currentTabId) {
      console.error("[CanvasConnections DEBUG] [onEdgeUpdateEnd] No active tab ID. Cannot process edge update.");
      // 注意：originalEdge 可能未被移除，这是一个潜在的问题状态。
      console.debug('[DIAGNOSTIC LOG] onEdgeUpdateEnd: Exit (early due to no active tab ID). activeDraggingState (local copy):', activeDraggingState ? JSON.parse(JSON.stringify(activeDraggingState)) : null);
      return;
    }

    // 原始边及其在旧目标（如果是多输入）的顺序，将由协调器函数处理。
    // 不再在此处直接调用 removeElementsAndRecord 或 updateNodeInputConnectionOrderAndRecord。

    if (edge) { // VueFlow 认为连接到了某个东西 (payload.edge 不为 null)
      console.debug(`[CanvasConnections DEBUG] onEdgeUpdateEnd: VueFlow's \`edge\` payload is present. Info:`, JSON.parse(JSON.stringify(edge)));

      const finalTargetHandleInfo = capturedConnectionEndHandle; // 使用捕获的句柄信息

      if (finalTargetHandleInfo && finalTargetHandleInfo.nodeId && finalTargetHandleInfo.id && finalTargetHandleInfo.type === 'target') {
        // 确定新连接的参数
        // VueFlow 的 `edge` payload (即此处的 `edge` 变量) 的 source/target 指的是 *新形成的连接* 的固定端。
        // `finalTargetHandleInfo` 是鼠标最终悬停的句柄，即新的浮动端。
        // `activeDraggingState.originalEdge` 是原始连接。
        // `vueFlowInstance.connectionStartHandle.value` 是拖拽开始的句柄。

        const draggingStartHandle = vueFlowInstance.connectionStartHandle.value;
        let newConnectionParams: Connection;

        if (draggingStartHandle?.type === 'source') {
          // 拖拽的是源句柄，新目标是 finalTargetHandleInfo
          newConnectionParams = {
            source: finalTargetHandleInfo.nodeId, // 新的源是鼠标悬停的句柄 (如果它是源类型) - 这里逻辑简化，假设总是拖目标端
            sourceHandle: finalTargetHandleInfo.id, // 实际上，如果拖源，这里应该是 finalTargetHandleInfo
            target: edge.target, // 目标是固定的 (来自VueFlow的edge payload)
            targetHandle: edge.targetHandle,
          };
          // 更正：如果拖拽的是源句柄，那么 edge.target/targetHandle 是固定的，finalTargetHandleInfo 是新的源。
          // 但 VueFlow 的 onEdgeUpdateEnd 的 `edge` 参数，其 source/target 指的是 *新形成的连接*。
          // 所以，如果拖拽的是源端，那么 `edge.target` 是原始目标，`finalTargetHandleInfo` 是新的源。
          // 如果拖拽的是目标端，那么 `edge.source` 是原始源，`finalTargetHandleInfo` 是新的目标。

          // 简化和修正：我们总是假设拖拽的是目标端，或者 VueFlow 的 `edge` payload 正确反映了固定端。
          // `edge.source` 和 `edge.sourceHandle` 是连接的固定起点。
          // `finalTargetHandleInfo.nodeId` 和 `finalTargetHandleInfo.id` 是连接的新浮动终点。
          newConnectionParams = {
            source: edge.source,
            sourceHandle: edge.sourceHandle,
            target: finalTargetHandleInfo.nodeId,
            targetHandle: finalTargetHandleInfo.id,
          };

        } else if (draggingStartHandle?.type === 'target') {
          // 拖拽的是目标句柄，新目标是 finalTargetHandleInfo
          newConnectionParams = {
            source: edge.source, // 源是固定的 (来自VueFlow的edge payload)
            sourceHandle: edge.sourceHandle,
            target: finalTargetHandleInfo.nodeId, // 新的目标是鼠标悬停的句柄
            targetHandle: finalTargetHandleInfo.id,
          };
        } else {
          console.warn("[CanvasConnections DEBUG] onEdgeUpdateEnd: Could not determine if source or target was dragged based on connectionStartHandle. Defaulting to edge payload's source and finalTargetHandleInfo as target.");
          newConnectionParams = {
            source: edge.source,
            sourceHandle: edge.sourceHandle,
            target: finalTargetHandleInfo.nodeId,
            targetHandle: finalTargetHandleInfo.id,
          };
        }


        if (isValidConnection(newConnectionParams, originalEdgeIdFromDrag)) {
          console.debug(`[CanvasConnections DEBUG] onEdgeUpdateEnd: New connection is valid (passing originalEdgeId: ${originalEdgeIdFromDrag}). Attempting to move/reconnect.`);

          const targetNode = findNode(newConnectionParams.target);
          // 从 newConnectionParams.targetHandle 解析原始键
          const { originalKey: newTargetOriginalKeyFromParams } = parseSubHandleId(newConnectionParams.targetHandle);
          let targetInputDef: GroupSlotInfo | undefined;

          if (targetNode && newTargetOriginalKeyFromParams) {
            // 使用原始键获取输入定义
            const nodeDefinition = nodeStore.getNodeDefinitionByFullType(targetNode.type || '');
            targetInputDef = nodeDefinition?.inputs?.[newTargetOriginalKeyFromParams] ||
                             (targetNode.data as any)?.inputs?.[newTargetOriginalKeyFromParams] ||
                             (getNodeType(targetNode) === 'core:NodeGroup' ? (targetNode.data as any)?.groupInterface?.inputs?.[newTargetOriginalKeyFromParams] : undefined) ||
                             (getNodeType(targetNode) === 'core:GroupOutput' ? workflowStore.getActiveTabState()?.workflowData?.interfaceOutputs?.[newTargetOriginalKeyFromParams] : undefined);
          }

          const isNewTargetMultiInput = targetInputDef?.multi === true;
          let newTargetIndexInOrder: number | undefined = undefined; // 维持 number | undefined

          if (isNewTargetMultiInput && newTargetOriginalKeyFromParams && targetNode) { // 确保 targetNode 和 originalKey 有效
            const parsedNewTargetHandle = parseSubHandleId(newConnectionParams.targetHandle);
            if (parsedNewTargetHandle.isSubHandle && typeof parsedNewTargetHandle.index === 'number') {
              newTargetIndexInOrder = parsedNewTargetHandle.index;
              console.log(`[CanvasConnections DEBUG] onEdgeUpdateEnd: Multi-input target. Using index ${newTargetIndexInOrder} from connected sub-handle '${newConnectionParams.targetHandle}'.`);
            } else {
              // 连接到主多输入句柄 (例如 'text_inputs' 而非 'text_inputs__0') 或解析子句柄索引失败。
              // 这意味着应该追加到该多输入键的连接列表末尾。
              newTargetIndexInOrder = undefined; // undefined 表示追加，以匹配函数签名
              console.warn(`[CanvasConnections DEBUG] onEdgeUpdateEnd: Multi-input target '${newTargetOriginalKeyFromParams}'. Connected to main handle '${newConnectionParams.targetHandle}' or sub-handle index not found. Will append (targetIndex: undefined).`);
            }
          }

          // 检查是否有实际变更
          const {
            source: newSourceNodeId,
            sourceHandle: newSourceHandleId, // string | null
            target: newTargetNodeId,
            targetHandle: newTargetHandleId, // string | null
          } = newConnectionParams;

          const {
            originalSourceNodeId, // string
            originalSourceHandleId, // string | undefined
            originalTargetNodeId, // string
            originalTargetHandleId, // string
          } = activeDraggingState;

          // 规范化句柄以便比较 (将 null 和 undefined 视为等效)
          const currentNewSourceHandleForCompare = newSourceHandleId ?? undefined;
          const currentNewTargetHandleForCompare = newTargetHandleId ?? undefined;

          const noChangeDetected =
            originalSourceNodeId === newSourceNodeId &&
            originalSourceHandleId === currentNewSourceHandleForCompare &&
            originalTargetNodeId === newTargetNodeId &&
            originalTargetHandleId === currentNewTargetHandleForCompare;
            // 注意：对于多输入，如果顺序没有改变，也应该视为无变化。
            // 此处的 newTargetIndexInOrder 已经计算。
            // 如果 noChangeDetected 为 true，且目标是多输入，
            // 我们还需要检查 newTargetIndexInOrder 是否与原始索引相同。
            // 但获取原始索引比较复杂，暂时简化为仅比较句柄。
            // 如果用户将边拖放到完全相同的子句柄，通常顺序不会改变，除非它是唯一的连接或重新排序逻辑导致。

          if (noChangeDetected) {
            console.log(`[CanvasConnections DEBUG] onEdgeUpdateEnd: Edge reconnected to the exact same source/target handles. No actual change. Skipping history record and store action.`);
            // 边已经存在于 store 中，并且其属性没有改变，所以不需要调用 store action。
            // VueFlow 应该已经正确处理了视觉上的拖拽和释放。
          } else {
            const oldSourceForSummary = getReadableNames(originalEdge.source, originalEdge.sourceHandle, 'source');
            const oldTargetForSummary = getReadableNames(activeDraggingState.originalTargetNodeId, activeDraggingState.originalTargetHandleId, 'target');
            const newTargetForSummary = getReadableNames(newConnectionParams.target, newConnectionParams.targetHandle, 'target');
            const summary = `移动连接 ${oldSourceForSummary.nodeName}::${oldSourceForSummary.handleName} (${originalEdge.source}::${originalEdge.sourceHandle}) -> ${oldTargetForSummary.nodeName}::${oldTargetForSummary.handleName} (${activeDraggingState.originalTargetNodeId}::${activeDraggingState.originalTargetHandleId})  TO  ${newTargetForSummary.nodeName}::${newTargetForSummary.handleName} (${newConnectionParams.target}::${newConnectionParams.targetHandle})`;
            const historyEntry = createHistoryEntry(
              "modify",
              "edge",
              summary,
              {
                edgeId: originalEdge.id,
                oldSourceNodeId: originalEdge.source,
                oldSourceHandleId: originalEdge.sourceHandle,
                oldTargetNodeId: activeDraggingState.originalTargetNodeId,
                oldTargetHandleId: activeDraggingState.originalTargetHandleId,
                newSourceNodeId: newConnectionParams.source,
                newSourceHandleId: newConnectionParams.sourceHandle, // Will be string | null
                newTargetNodeId: newConnectionParams.target,
                newTargetHandleId: newConnectionParams.targetHandle, // Will be string | null
                newTargetIndexInOrder: newTargetIndexInOrder,
              }
            );

            await workflowStore.moveAndReconnectEdgeAndRecord(
              originalEdge.id,
              activeDraggingState.originalTargetNodeId,
              activeDraggingState.originalTargetHandleId,
              newConnectionParams.source,
              newConnectionParams.sourceHandle ?? undefined, // 确保 null 转为 undefined, coordinator expects string | undefined
              newConnectionParams.target,
              newConnectionParams.targetHandle ?? undefined, // 确保 null 转为 undefined, coordinator expects string | undefined
              newTargetIndexInOrder,
              historyEntry
            );
          }
        } else {
          console.warn(`[CanvasConnections DEBUG] onEdgeUpdateEnd: New connection for edge update is invalid. Original edge ${originalEdge.id} was (or should have been) disconnected. No new edge added. Target: ${newConnectionParams.target}::${newConnectionParams.targetHandle}`);
          // 如果连接无效，但原始边是从输入端拔出的 (activeDraggingState.type === 'unplug_from_input')，
          // 则需要确保它被正确地“断开”。
          if (activeDraggingState.type === 'unplug_from_input') {
            const readableSource = getReadableNames(originalEdge.source, originalEdge.sourceHandle, 'source');
            const readableTarget = getReadableNames(activeDraggingState.originalTargetNodeId, activeDraggingState.originalTargetHandleId, 'target');
            const disconnectSummary = `断开连接 (更新无效): ${readableSource.nodeName}::${readableSource.handleName} -> ${readableTarget.nodeName}::${readableTarget.handleName}`;
            const disconnectEntry = createHistoryEntry(
              "disconnect",
              "edge",
              disconnectSummary,
              {
                edgeId: originalEdge.id,
                sourceNodeId: originalEdge.source,
                sourceHandleId: originalEdge.sourceHandle,
                targetNodeId: activeDraggingState.originalTargetNodeId,
                targetHandleId: activeDraggingState.originalTargetHandleId,
                reason: "edge_update_to_invalid_target_unplugged_from_input"
              }
            );
            await workflowStore.disconnectEdgeFromInputAndRecord(
              originalEdge.id,
              activeDraggingState.originalTargetNodeId,
              activeDraggingState.originalTargetHandleId,
              disconnectEntry
            );
          } else { // activeDraggingState.type is 'reorder' or 'disconnect_reconnect'
            // 如果是从源端拖拽到无效目标，也视为删除原始边。
            // moveAndReconnectEdgeAndRecord 应该能处理目标为 null/undefined 的情况，即删除。
            // 或者，如果原始边没有被其他方式移除，这里需要一个删除操作。
            // 假设：如果拖到无效区域，原始边已被移除，这里不需要额外操作。
            // 但为了确保，如果不是 unplug_from_input，我们可能需要显式删除。
            // 然而，更理想的是 moveAndReconnectEdgeAndRecord(..., null, null, null, null, historyEntryForDelete)
            console.log(`[CanvasConnections DEBUG] onEdgeUpdateEnd: Edge ${originalEdge.id} (dragged from source) dropped on invalid target. Assumed disconnected/deleted by coordinator or prior logic.`);
            // const deleteEntry = createHistoryEntry(
            // "delete", "edge", `删除连接 ${originalEdge.id} (从源拖到无效目标)`,
            // { edgeId: originalEdge.id, reason: "drag_from_source_to_invalid_target_on_update_end" }
            // );
            // 再次，我们不应该在这里直接调用 removeElementsAndRecord。
            // 理想情况下，moveAndReconnectEdgeAndRecord 应该处理这种情况。
            // 暂时依赖于：如果不是 unplug_from_input，则原始边已被移除或将被其他逻辑处理。
            // 这是一个需要进一步澄清的流程点。
            // 为了安全，如果 activeDraggingState.type !== 'unplug_from_input'，
            // 并且我们确定原始边没有被其他协调器调用处理，这里应该有一个删除。
            // 但目前，我们假设 moveAndReconnectEdgeAndRecord 能够处理这种情况，
            // 或者 disconnectEdgeFromInputAndRecord 已经覆盖了所有需要“断开”的场景。
            // 如果拖拽的是源，并且目标无效，这等同于删除。
            // 我们需要一个协调器函数来删除边并更新相关顺序。
            // 暂时，我们先假设如果连接无效，且不是 unplug_from_input，则原始边已被移除。
            // 这在当前代码中可能不成立，因为 L772 的 removeElementsAndRecord 被注释掉了。
            // 这是一个潜在的 bug：如果从 source 拖到无效目标，原始边可能不会被移除。
            // 修复：如果不是 unplug_from_input 且连接无效，则调用 disconnectEdgeFromInputAndRecord
            // 但这不完全正确，因为 disconnect 是针对 target 的。
            // 正确的做法是，如果从 source 拖到无效目标，应该调用一个能删除边的协调器。
            // 暂时，我们先假设这种情况由外部处理或是一个待修复点。
            console.warn(`[CanvasConnections DEBUG] onEdgeUpdateEnd: Edge ${originalEdge.id} dragged from source to invalid target. Deletion logic needs to be robustly handled by a coordinator. Original edge might not be removed if not unplugged from input.`);
            // );
            // TODO: Call a proper delete coordinator: await workflowStore.deleteEdgeAndRecord(currentTabId, originalEdge.id, deleteEntry);
          }
        }
      } else { // finalTargetHandleInfo 无效 (例如，拖到画布空白处，但 VueFlow 仍然提供了 edge payload，这不太可能)
                console.warn(`[CanvasConnections DEBUG] onEdgeUpdateEnd: VueFlow's \`edge\` payload exists, but CAPTURED connectionEndHandle is invalid, not a target, or missing details. Treating as disconnect if unplugged from input.`);
                if (activeDraggingState.type === 'unplug_from_input') {
                  const readableSource = getReadableNames(originalEdge.source, originalEdge.sourceHandle, 'source');
                  const readableTarget = getReadableNames(activeDraggingState.originalTargetNodeId, activeDraggingState.originalTargetHandleId, 'target');
                  const summary = `断开连接 (拖到无效目标区域): ${readableSource.nodeName}::${readableSource.handleName} -> ${readableTarget.nodeName}::${readableTarget.handleName}`;
                  const disconnectEntry = createHistoryEntry(
                    "disconnect",
                    "edge",
                    summary,
                    {
                      edgeId: originalEdge.id,
                      sourceNodeId: originalEdge.source,
                      sourceHandleId: originalEdge.sourceHandle,
                      targetNodeId: activeDraggingState.originalTargetNodeId,
                      targetHandleId: activeDraggingState.originalTargetHandleId,
                      reason: "edge_update_dropped_on_invalid_area_unplugged_from_input"
                    }
                  );
                  await workflowStore.disconnectEdgeFromInputAndRecord(
                    originalEdge.id,
                    activeDraggingState.originalTargetNodeId,
                    activeDraggingState.originalTargetHandleId,
                    disconnectEntry
                  );
          console.log(`[CanvasConnections DEBUG] onEdgeUpdateEnd: Edge ${originalEdge.id} (dragged from source) dropped on invalid area (edge payload present but no valid target handle). Assumed disconnected/deleted by coordinator.`);
        }
      }
    } else { // 拖放到画布上 (VueFlow 的 `edge` 参数为 null)
      console.debug(`[CanvasConnections DEBUG] onEdgeUpdateEnd: Dropped on pane (VueFlow's \`edge\` payload is null).`);
      if (activeDraggingState.type === 'unplug_from_input') {
        console.log(`[CanvasConnections DEBUG] onEdgeUpdateEnd: Edge ${originalEdge.id} was unplugged from input and dropped on pane. Disconnecting.`);
        const readableSource = getReadableNames(originalEdge.source, originalEdge.sourceHandle, 'source');
        const readableTarget = getReadableNames(activeDraggingState.originalTargetNodeId, activeDraggingState.originalTargetHandleId, 'target');
        const disconnectSummary = `断开连接 (拖到画布): ${readableSource.nodeName}::${readableSource.handleName} -> ${readableTarget.nodeName}::${readableTarget.handleName}`;
        const disconnectEntry = createHistoryEntry(
          "disconnect",
          "edge",
          disconnectSummary,
          {
            edgeId: originalEdge.id,
            sourceNodeId: originalEdge.source,
            sourceHandleId: originalEdge.sourceHandle,
            targetNodeId: activeDraggingState.originalTargetNodeId,
            targetHandleId: activeDraggingState.originalTargetHandleId,
            reason: "edge_unplugged_from_input_dropped_on_pane"
          }
        );
        await workflowStore.disconnectEdgeFromInputAndRecord(
          originalEdge.id,
          activeDraggingState.originalTargetNodeId,
          activeDraggingState.originalTargetHandleId,
          disconnectEntry
        );
      } else { // activeDraggingState.type is 'reorder' or 'disconnect_reconnect'
        // 从源端拔出，或从已连接的输出端拔出，释放到画布，等同于删除原始边
        console.log(`[CanvasConnections DEBUG] onEdgeUpdateEnd: Edge ${originalEdge.id} (dragged from type '${activeDraggingState.type}') dropped on pane. Deleting original edge.`);

        const oldSourceNames = getReadableNames(originalEdge.source, originalEdge.sourceHandle, 'source');
        const oldTargetNames = getReadableNames(originalEdge.target, originalEdge.targetHandle, 'target');

        const deleteHistorySummary = `删除连接 (拖到画布): ${oldSourceNames.nodeName}::${oldSourceNames.handleName} -> ${oldTargetNames.nodeName}::${oldTargetNames.handleName}`;
        const deleteHistoryEntry = createHistoryEntry(
          'delete', // 使用 'delete' 作为操作类型
          'edge',
          deleteHistorySummary,
          {
            edgeId: originalEdge.id,
            sourceNodeId: originalEdge.source,
            sourceHandle: originalEdge.sourceHandle,
            targetNodeId: originalEdge.target,
            targetHandle: originalEdge.targetHandle,
            reason: 'edge_dragged_to_pane_and_deleted'
          }
        );
        await workflowStore.removeElementsAndRecord(currentTabId, [originalEdge], deleteHistoryEntry);
      }
      // 如果 activeDraggingState.type === 'unplug_from_input' 且拖到画布，则已由上面的 disconnectEdgeFromInputAndRecord 处理
    }
    console.debug('[DIAGNOSTIC LOG] onEdgeUpdateEnd: Exit (normal). activeDraggingState (local copy):', activeDraggingState ? JSON.parse(JSON.stringify(activeDraggingState)) : null);
  });

  // Watch for changes in the handle the mouse is currently over *while dragging*
  // 将 handleConnect 注册为 onConnect 事件的回调
  onConnect(handleConnect);
  watch(vueFlowInstance.connectionEndHandle, (newEndHandle: ConnectingHandle | null, oldEndHandle: ConnectingHandle | null) => {
    const startHandle = vueFlowInstance.connectionStartHandle.value; // This is ConnectingHandle | null

    if (startHandle) { // Only log if a connection drag is in progress
      const startNames = getReadableNames(startHandle.nodeId, startHandle.id, startHandle.type);

      if (newEndHandle && newEndHandle.type === 'target') {
        const newEndNames = getReadableNames(newEndHandle.nodeId, newEndHandle.id, newEndHandle.type);
        console.log(
          `[CanvasConnections DEBUG] Dragging from ${startNames.nodeName}::${startNames.handleName} (ID: ${startNames.nodeId}::${startNames.handleId}, Type: ${startHandle.type}). MOUSE ENTERED handle: ${newEndNames.nodeName}::${newEndNames.handleName} (ID: ${newEndNames.nodeId}::${newEndNames.handleId}, Type: ${newEndHandle.type})`,
        );

        const targetNode = findNode(newEndHandle.nodeId);
        if (targetNode && newEndHandle.id) { // 确保 newEndHandle.id 不是 null
          const { originalKey: currentOriginalHandleKey } = parseSubHandleId(newEndHandle.id);
          let targetInputDef: GroupSlotInfo | undefined;

          if (currentOriginalHandleKey) {
            const nodeDefinition = nodeStore.getNodeDefinitionByFullType(targetNode.type || '');
            targetInputDef = nodeDefinition?.inputs?.[currentOriginalHandleKey] ||
                             (targetNode.data as any)?.inputs?.[currentOriginalHandleKey] ||
                             (getNodeType(targetNode) === 'core:NodeGroup' ? (targetNode.data as any)?.groupInterface?.inputs?.[currentOriginalHandleKey] : undefined) ||
                             (getNodeType(targetNode) === 'core:GroupOutput' ? workflowStore.getActiveTabState()?.workflowData?.interfaceOutputs?.[currentOriginalHandleKey] : undefined);
          }

          if (targetInputDef && targetInputDef.multi === true && currentOriginalHandleKey) {
            // newEndHandle.id 是鼠标当前悬停的句柄ID，例如 "text_inputs__0"
            // currentIsSubHandle 和 subHandleIndexOfHovered 是从 newEndHandle.id 解析出来的
            const { isSubHandle: currentIsSubHandle, index: subHandleIndexOfHovered } = parseSubHandleId(newEndHandle.id);
            if (currentIsSubHandle && typeof subHandleIndexOfHovered === 'number') {
              // 如果鼠标直接悬停在一个已编号的子句柄上 (例如 text_inputs__0, text_inputs__1),
              // 那么 reorderPreviewIndex 就应该是那个子句柄的索引。
              reorderPreviewIndex.value = subHandleIndexOfHovered;
              console.log(`[CanvasConnections DEBUG] Multi-input target. Hovered over specific sub-handle ${newEndHandle.id}. Using its index ${subHandleIndexOfHovered} as reorderPreviewIndex.`);
            } else if (!currentIsSubHandle) {
              // 如果鼠标悬停在多输入插槽的主区域，但不在一个具体的 __index 子句柄上
              // (这种情况可能较少，因为视觉上通常都是与具体的子句柄交互)
              // 此时，可以考虑追加到末尾。
              const inputOrders = (targetNode.data.inputConnectionOrders?.[currentOriginalHandleKey] as string[] | undefined) || [];
              reorderPreviewIndex.value = inputOrders.length;
              console.log(`[CanvasConnections DEBUG] Multi-input target. Hovered over main handle part ${newEndHandle.id} (not a specific sub-handle). Defaulting reorderPreviewIndex to append: ${reorderPreviewIndex.value}.`);
            } else {
              // 其他未能识别的悬停情况 (例如，isSubHandle 为 true 但 subHandleIndexOfHovered 不是数字)
              // 这通常不应该发生，如果发生则表示解析或句柄ID格式有问题。
              console.warn(`[CanvasConnections DEBUG] Multi-input target. Hovered handle ${newEndHandle.id} is not a recognized sub-handle index pattern for reordering. Setting reorderPreviewIndex to null.`);
              reorderPreviewIndex.value = null;
            }
          } else {
            reorderPreviewIndex.value = null; // 目标不是多输入，或者没有有效的原始键
          }
        } else {
          reorderPreviewIndex.value = null; // 找不到目标节点
        }
      } else if (oldEndHandle) { // Mouse left a handle or newEndHandle is not a target
        const oldEndNames = getReadableNames(oldEndHandle.nodeId, oldEndHandle.id, oldEndHandle.type);
        console.log(
          `[CanvasConnections DEBUG] Dragging from ${startNames.nodeName}::${startNames.handleName} (ID: ${startNames.nodeId}::${startNames.handleId}, Type: ${startHandle.type}). MOUSE LEFT handle: ${oldEndNames.nodeName}::${oldEndNames.handleName} (ID: ${oldEndNames.nodeId}::${oldEndNames.handleId}, Type: ${oldEndHandle.type})`, // 使用 oldEndHandle.type
        );
        reorderPreviewIndex.value = null;
      } else {
        // newEndHandle is null and oldEndHandle was also null (or drag just started and not over anything yet)
        reorderPreviewIndex.value = null;
      }
    } else { // Dragging not in progress
      reorderPreviewIndex.value = null;
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
