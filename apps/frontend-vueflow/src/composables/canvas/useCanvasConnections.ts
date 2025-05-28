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
import { useGroupInterfaceSync } from "../group/useGroupInterfaceSync"; // Roo: 重新引入
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
// import type { FrontendNodeDefinition } from '@/stores/nodeStore'; // Roo: 移除未使用的导入
import { getNodeType, parseSubHandleId } from "@/utils/nodeUtils"; // GUGU: Import parseSubHandleId
import { klona } from 'klona/json';
import { nanoid } from 'nanoid';
import type { Node as VueFlowNode } from '@vue-flow/core'; // Roo: 明确导入 VueFlow Node 类型

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
  const { syncInterfaceSlotFromConnection } = useGroupInterfaceSync(); // Roo: 获取同步函数

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

  // GUGU: Removed internal parseSubHandleId, will use imported version

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

    const isSourceConvertible = isSlotConvertibleAny(sourceDft, sourceCats);
    const isTargetConvertible = isSlotConvertibleAny(targetDft, targetCats);
    const isSourceWild = isSlotWildcard(sourceDft, sourceCats);
    const isTargetWild = isSlotWildcard(targetDft, targetCats);

    // 规则 1: 通配符行为 (WILDCARD or BEHAVIOR_WILDCARD)
    // 如果一方是通配符，另一方不是可转换类型，则兼容。
    // (通配符可以变成对方类型，可转换类型会变成对方类型，两者相遇时，通配符优先保持其通配行为，让对方去适应它，除非对方也是通配符)
    if (isSourceWild && !isTargetConvertible) return true;
    if (isTargetWild && !isSourceConvertible) return true;
    if (isSourceWild && isTargetWild) return true; // 通配符之间互相兼容

    // 规则 2: 可转换行为 (CONVERTIBLE_ANY or BEHAVIOR_CONVERTIBLE)
    // 如果一方是可转换类型，另一方不是通配符，则兼容 (包括两个可转换类型相遇的情况)。
    if (isSourceConvertible && !isTargetWild) return true; // 源可转，目标不是通配符 (可以是具体类型或其他可转类型)
    if (isTargetConvertible && !isSourceWild) return true; // 目标可转，源不是通配符 (可以是具体类型或其他可转类型)
    // 注意：isSourceConvertible && isTargetConvertible 的情况已被上面覆盖。

    // 如果执行到这里，说明源和目标都不是行为型通配符或可转换类型，或者是它们与这些类型的组合未被上述规则覆盖。
    // 此时，我们只处理具体类型之间的匹配。

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
      return true;
    }
    return false;
  };

  const isValidConnection = (connection: Connection, updatingEdgeId?: string): boolean => {
    const { source, target, sourceHandle: rawSourceHandle, targetHandle: rawTargetHandle } = connection;

    if (!source || !target || !rawSourceHandle || !rawTargetHandle) {
      return false;
    }

    const { originalKey: sourceKey } = parseSubHandleId(rawSourceHandle);
    const { originalKey: targetKey } = parseSubHandleId(rawTargetHandle);

    if (!sourceKey || !targetKey) {
      return false;
    }

    const sourceNode = getNodes.value.find((node) => node.id === source);
    const targetNode = getNodes.value.find((node) => node.id === target);

    if (!sourceNode || !targetNode) {
      return false;
    }
    if (source === target) {
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
      return false;
    }
    const compatible = isTypeCompatible(sourceOutput, targetInput);
    
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
          return false;
        }
      }

      // 然后，如果目标确实是一个子句柄 (parsedTargetHandleInfo.isSubHandle 会再次确认为 true，或者如果上面没有返回false，这里继续检查)
      // 或者即使不是 multi:true，但如果handleID恰好是 key__index 格式，也按子句柄检查（虽然不太可能）
      const parsedTargetHandleInfoForOccupationCheck = parseSubHandleId(rawTargetHandle); // 重新parse或复用上面的
      const targetIsSubHandle = parsedTargetHandleInfoForOccupationCheck.isSubHandle;
      

      if (targetIsSubHandle) { // targetIsSubHandle is true if connection.targetHandle is like 'key__index'
        const isNewConnection = !updatingEdgeId;

        // targetInput (正确的变量名) 应该在此函数的前面部分已经基于 originalKey 获取了
        if (targetInput && targetInput.multi === true && isNewConnection) {
          // 对于新的连接到多输入插槽：
          // 即使视觉上指向的子句柄 (connection.targetHandle) 当前已被连接，我们也允许它通过此检查。
          // 实际的插入索引将由 reorderPreviewIndex 决定，并且 connectEdgeToMultiInput 会处理现有连接的顺延。
          // 对于这种情况，我们不因“占用”而返回 false。类型兼容性等其他检查仍然适用。
        } else {
          // 对于以下情况，执行原始的占用检查：
          // 1. 目标不是多输入插槽，但句柄名恰好是 key__index 格式 (不太可能，但作为防御)。
          // 2. 正在更新一个现有的连接 (updatingEdgeId 已提供)。
          const currentEdges = getEdges.value;
          
          const occupyingEdges = currentEdges.filter(edge =>
            edge.target === connection.target &&
            edge.targetHandle === connection.targetHandle
          );
          const isOccupied = occupyingEdges.length > 0;

          if (isOccupied) {
            const singleOccupyingEdge = (occupyingEdges.length === 1) ? occupyingEdges[0] : null;
            if (updatingEdgeId && singleOccupyingEdge && singleOccupyingEdge.id === updatingEdgeId) {
            } else { // 被不同的边或多个边占用
              // 如果目标是多输入插槽 (targetInput 应该已定义且 multi === true)
              // 即使这是一个连接更新，并且目标子句柄被其他边占用，我们也应该允许。
              // 后续的重排逻辑 (在 onEdgeUpdateEnd 中调用的 moveAndReconnectEdgeAndRecord) 会处理实际的放置。
              if (targetInput && targetInput.multi === true) {
                // 对于多输入插槽，当被其他边占用时，不在此处返回 false。
                // 类型兼容性 (由 `compatible` 变量检查) 和其他通用规则仍然适用。
              } else {
                // 对于非多输入插槽 (或者如果 targetInput 未定义/不是 multi 类型),
                // 被不同的边占用是一个冲突。
                return false;
              }
            }
          } else {
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
    } else {
      // 单输入目标，标准边，连接到特定句柄。
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

  // Roo: 辅助函数，用于创建同步插槽信息，复制相关属性，修复被弄丢的属性获取功能
  const createSyncSlotInfo = (
    baseSlot: GroupSlotInfo, // The CONVERTIBLE_ANY slot that is being transformed
    newDft: DataFlowTypeName,
    newCats: string[],
    connectedSlot: GroupSlotInfo, // The slot it's connecting to
  ): GroupSlotInfo => {
    // Ensure config is an object before spreading
    const connectedConfig = typeof connectedSlot.config === 'object' && connectedSlot.config !== null ? connectedSlot.config : {};
    const baseConfig = typeof baseSlot.config === 'object' && baseSlot.config !== null ? baseSlot.config : {};

    return {
      ...baseSlot, // Preserve original key, multi, allowDynamicType etc.
      dataFlowType: newDft,
      matchCategories: [...newCats], // Ensure new array
      displayName: connectedSlot.displayName || baseSlot.key,
      customDescription: connectedSlot.customDescription || (connectedSlot as any).description || "",
      config: { // Deep copy or selective copy of config
        ...baseConfig, // Start with base config
        ...connectedConfig, // Override with connected slot's config
        // Explicitly copy default if it exists, as it's crucial
        default: connectedSlot.config?.default ?? baseSlot.config?.default,
      },
      min: connectedSlot.min ?? baseSlot.min,
      max: connectedSlot.max ?? baseSlot.max,
      required: connectedSlot.required ?? baseSlot.required,
    };
  };

  const handleConnect = async (params: Connection): Promise<Edge | null> => {
    const currentTabId = tabStore.activeTabId;
    if (!currentTabId) {
      return null;
    }

    // onConnect (handleConnect) 只处理全新的连接。
    // 拖拽现有连接的逻辑已移至 onEdgeUpdateEnd。
    if (draggingState.value) {
      return null; // 让 onEdgeUpdateEnd 处理
    }


    if (!isValidConnection(params)) {
      return null;
    }

    const { source, target, sourceHandle, targetHandle } = params;
    if (!source || !target || !sourceHandle || !targetHandle) {
      return null;
    }

    const sourceNode = findNode(source);
    const targetNode = findNode(target);
    if (!sourceNode || !targetNode) {
      return null;
    }

    // Roo: 获取源和目标插槽的完整定义
    const { originalKey: parsedSourceHandleKey } = parseSubHandleId(sourceHandle);
    const { originalKey: parsedTargetHandleKey } = parseSubHandleId(targetHandle);

    let sourceOutputDef: GroupSlotInfo | undefined;
    const sourceNodeType = getNodeType(sourceNode);
    if (sourceNodeType === 'core:GroupInput') {
      sourceOutputDef = workflowStore.getActiveTabState()?.workflowData?.interfaceInputs?.[parsedSourceHandleKey];
    } else if (sourceNodeType === 'core:NodeGroup') {
      sourceOutputDef = (sourceNode.data as any)?.groupInterface?.outputs?.[parsedSourceHandleKey];
    } else {
      sourceOutputDef = (sourceNode.data as any)?.outputs?.[parsedSourceHandleKey];
    }

    let targetInputDef: GroupSlotInfo | undefined;
    const targetNodeType = getNodeType(targetNode);
    if (targetNodeType === 'core:GroupOutput') {
        targetInputDef = workflowStore.getActiveTabState()?.workflowData?.interfaceOutputs?.[parsedTargetHandleKey];
    } else if (targetNodeType === 'core:NodeGroup') {
        targetInputDef = (targetNode.data as any)?.groupInterface?.inputs?.[parsedTargetHandleKey];
    } else {
        targetInputDef = (targetNode.data as any)?.inputs?.[parsedTargetHandleKey];
    }

    if (!sourceOutputDef || !targetInputDef) {
      return null;
    }
    // Roo: 深拷贝插槽定义，以便安全修改
    const originalSourceOutputDef = klona(sourceOutputDef);
    const originalTargetInputDef = klona(targetInputDef);


    // 调用 createEdge 来获取包含正确 type 和 targetHandle (原始键 for multi-input) 的边对象
    const newEdgeObjectFromCreateEdge = createEdge(params);

    if (!newEdgeObjectFromCreateEdge) {
      // createEdge 内部已经调用了 isValidConnection 并可能打印了错误
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

            // Roo: <<<< START CONVERTIBLE_ANY LOGIC >>>>
            let finalSourceDefForEdge = klona(originalSourceOutputDef); // 用于边的data和样式
            let finalTargetDefForEdge = klona(originalTargetInputDef); // 用于边的data和样式

            const isSourceConv = originalSourceOutputDef.dataFlowType === DataFlowType.CONVERTIBLE_ANY || (originalSourceOutputDef.matchCategories || []).includes(BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);
            const isTargetConv = originalTargetInputDef.dataFlowType === DataFlowType.CONVERTIBLE_ANY || (originalTargetInputDef.matchCategories || []).includes(BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);
            const isSourceWild = originalSourceOutputDef.dataFlowType === DataFlowType.WILDCARD || (originalSourceOutputDef.matchCategories || []).includes(BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD);
            const isTargetWild = originalTargetInputDef.dataFlowType === DataFlowType.WILDCARD || (originalTargetInputDef.matchCategories || []).includes(BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD);

            let modifiedSlotInfo: { node: VueFlowNode, handleKey: string, newDefinition: GroupSlotInfo, direction: 'inputs' | 'outputs' } | null = null;
            let interfaceUpdateResult: { inputs: Record<string, GroupSlotInfo>, outputs: Record<string, GroupSlotInfo> } | null = null;

            if (isSourceConv && !isTargetConv && !isTargetWild) {
              // 源是 CONVERTIBLE_ANY，转换为目标类型
              finalSourceDefForEdge.dataFlowType = originalTargetInputDef.dataFlowType;
              finalSourceDefForEdge.matchCategories = [...(originalTargetInputDef.matchCategories || [])];

              const newSourceSlotDef = createSyncSlotInfo(originalSourceOutputDef, originalTargetInputDef.dataFlowType, originalTargetInputDef.matchCategories || [], originalTargetInputDef);
              if (sourceNodeType === 'core:GroupInput') {
                interfaceUpdateResult = syncInterfaceSlotFromConnection(currentTabId, sourceNode.id, parsedSourceHandleKey, newSourceSlotDef, 'inputs');
              } else {
                modifiedSlotInfo = { node: sourceNode, handleKey: parsedSourceHandleKey, newDefinition: newSourceSlotDef, direction: 'outputs' };
              }
            } else if (isTargetConv && !isSourceConv && !isSourceWild) {
              // 目标是 CONVERTIBLE_ANY，转换为源类型
              finalTargetDefForEdge.dataFlowType = originalSourceOutputDef.dataFlowType;
              finalTargetDefForEdge.matchCategories = [...(originalSourceOutputDef.matchCategories || [])];

              const newTargetSlotDef = createSyncSlotInfo(originalTargetInputDef, originalSourceOutputDef.dataFlowType, originalSourceOutputDef.matchCategories || [], originalSourceOutputDef);
              if (targetNodeType === 'core:GroupOutput') {
                interfaceUpdateResult = syncInterfaceSlotFromConnection(currentTabId, targetNode.id, parsedTargetHandleKey, newTargetSlotDef, 'outputs');
              } else if (targetNodeType === 'core:GroupInput') { // Should not happen if target is GroupInput and CONVERTIBLE_ANY (GroupInput outputs)
                 // This case might need review, typically GroupInput outputs are CONVERTIBLE_ANY
              }
              else {
                modifiedSlotInfo = { node: targetNode, handleKey: parsedTargetHandleKey, newDefinition: newTargetSlotDef, direction: 'inputs' };
              }
            } else if (isTargetWild && !isSourceConv) {
                finalTargetDefForEdge.dataFlowType = originalSourceOutputDef.dataFlowType;
                finalTargetDefForEdge.matchCategories = [...(originalSourceOutputDef.matchCategories || [])];
            } else if (isSourceWild && !isTargetConv) {
                finalSourceDefForEdge.dataFlowType = originalTargetInputDef.dataFlowType;
                finalSourceDefForEdge.matchCategories = [...(originalTargetInputDef.matchCategories || [])];
            }
            // Roo: <<<< END CONVERTIBLE_ANY LOGIC >>>>

            // 更新边的样式和数据属性，使用转换后的类型
            const { animated, style, markerEnd } = getEdgeStyleProps(finalSourceDefForEdge.dataFlowType, finalTargetDefForEdge.dataFlowType, isDark.value);
            newEdgeParamsForCoordinator.animated = animated;
            newEdgeParamsForCoordinator.style = style;
            newEdgeParamsForCoordinator.markerEnd = markerEnd;
            newEdgeParamsForCoordinator.data = {
              sourceType: finalSourceDefForEdge.dataFlowType,
              targetType: finalTargetDefForEdge.dataFlowType,
            };


            const readableSource = getReadableNames(params.source, params.sourceHandle, 'source');
            const readableTarget = getReadableNames(params.target, params.targetHandle, 'target');
            const connectSummary = `连接 ${readableSource.nodeName}::${readableSource.handleName} -> ${readableTarget.nodeName}::${readableTarget.handleName}`;
            
            let newTargetIndexInOrderForHistory: number | undefined = undefined;
            if (targetInputDef?.multi === true) {
              // For new connections to multi-input, reorderPreviewIndex should hold the calculated index.
              // Ensure reorderPreviewIndex.value is a number. If null, it might mean append (length of current connections).
              if (typeof reorderPreviewIndex.value === 'number') {
                newTargetIndexInOrderForHistory = reorderPreviewIndex.value;
              } else {
                // Fallback: if reorderPreviewIndex is null, calculate append index.
                // This might happen if watch for connectionEndHandle didn't set it correctly or in race conditions.
                const existingConnectionsToSlot = getEdges.value.filter(
                  edge => edge.target === targetNode.id && parseSubHandleId(edge.targetHandle).originalKey === parsedTargetHandleKey
                );
                newTargetIndexInOrderForHistory = existingConnectionsToSlot.length;
              }
            }
            
            const historyEntryDetails: Record<string, any> = {
              edgeId: newEdgeParamsForCoordinator.id,
              sourceNodeId: newEdgeParamsForCoordinator.source,
              sourceHandleId: newEdgeParamsForCoordinator.sourceHandle,
              targetNodeId: newEdgeParamsForCoordinator.target,
              targetHandleId: newEdgeParamsForCoordinator.targetHandle, // This is the sub-handle ID
              type: newEdgeParamsForCoordinator.type,
              data: newEdgeParamsForCoordinator.data,
              modifiedSlotInfo: modifiedSlotInfo ? { nodeId: modifiedSlotInfo.node.id, handleKey: modifiedSlotInfo.handleKey, direction: modifiedSlotInfo.direction, newDefinition: klona(modifiedSlotInfo.newDefinition) } : undefined,
              interfaceUpdateResult: interfaceUpdateResult ? klona(interfaceUpdateResult) : undefined,
            };

            if (newTargetIndexInOrderForHistory !== undefined) {
              historyEntryDetails.newTargetIndexInOrder = newTargetIndexInOrderForHistory;
            }

            const historyEntry = createHistoryEntry(
              "connect",
              "edge",
              connectSummary,
              historyEntryDetails
            );
            
            // Roo: 调用扩展后的 handleConnectionWithInterfaceUpdate 协调器函数
            // 注意：targetIndexInOrder 在此模型中不直接传递给 handleConnectionWithInterfaceUpdate，
            // 它应该在 newEdgeParamsForCoordinator.targetHandle 中通过子句柄ID体现，
            // 或者由 multiInputActions 内部处理（如果适用）。
            // 此处假设 newEdgeParamsForCoordinator 包含了所有必要的边信息。
            // interfaceUpdateResult 可能为 null，所以使用 ?. 和 ?? {}
            await workflowStore.handleConnectionWithInterfaceUpdate(
              currentTabId, // internalId
              newEdgeParamsForCoordinator, // newEdge
              interfaceUpdateResult?.inputs ?? {}, // newInputs
              interfaceUpdateResult?.outputs ?? {}, // newOutputs
              modifiedSlotInfo, // Roo: new parameter for modified normal node slot
              sourceNode.id, // sourceNodeId
              targetNode.id, // targetNodeId
              historyEntry
            );
    // 由于 handleConnectionWithInterfaceUpdate 是异步的，并且会更新 store，
    // VueFlow 应该会自动响应 store 的变化来渲染新的边和节点（如果插槽更新导致重绘）。
    // 我们返回一个象征性的 Edge 对象或 null。
    // 重要的是状态已通过协调器更新。
    const finalEdgeState = workflowStore.getElements(currentTabId).find(el => el.id === newEdgeObjectFromCreateEdge.id && "source" in el) as Edge | undefined; // 使用 newEdgeObjectFromCreateEdge.id

    // DEBUG LOGS START
    if (currentTabId) {
      console.debug('[DEBUG-CONNECT] VueFlow Edges after handleConnect:', JSON.parse(JSON.stringify(vueFlowInstance.getEdges.value)));
      const storeWorkflowData = workflowStore.getWorkflowData(currentTabId);
      console.debug('[DEBUG-CONNECT] Store Edges after handleConnect:', JSON.parse(JSON.stringify(storeWorkflowData?.edges || [])));
    }
    // DEBUG LOGS END

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
    if (!eventDetails || typeof eventDetails !== 'object') {
      draggingState.value = null;
      return;
    }

    const event = eventDetails.event as MouseEvent | undefined;
    const edge = eventDetails.edge as Edge | undefined;

    if (!event || !edge) {
      draggingState.value = null;
      return;
    }

    // 关键验证：对于一个正在被更新（拖拽）的边，其 targetHandle 必须是一个有效的字符串。
    // sourceHandle 可以是 string | null (例如，如果允许从节点本身拖拽，尽管我们主要处理句柄)。
    // DraggingState.originalTargetHandleId 要求 string。
    if (typeof edge.targetHandle !== 'string') {
      draggingState.value = null;
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
        draggingState.value = null;
        return;
      }
    } else {
      // 如果不是直接点击 updater，尝试回退到 vueFlowInstance.connectionStartHandle (作为备用方案)
      const fallbackStartHandleDetails = vueFlowInstance.connectionStartHandle.value;
      if (fallbackStartHandleDetails && fallbackStartHandleDetails.nodeId && fallbackStartHandleDetails.id && fallbackStartHandleDetails.type) {
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
        draggingState.value = null;
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
      draggingState.value = null;
      return;
    }

    // 如果拖拽的是目标句柄，那么 draggedHandleId 必须是字符串 (因为 edge.targetHandle 已验证为字符串)
    if (draggedHandleType === 'target' && typeof draggedHandleId !== 'string') {
      draggingState.value = null;
      return;
    }
    // 如果拖拽的是源句柄，draggedHandleId 可以是 string | null。

    // 在记录日志和设置 DraggingState 时，需要处理 draggedHandleId 可能为 null 的情况（当拖拽源句柄时）
    // const logHandleId = draggedHandleId === null ? 'NULL_HANDLE' : draggedHandleId; // 使用 getReadableNames 代替

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
    }

  });

  onConnectStart((params) => {
    const startHandleNodeId = params.nodeId;
    const startHandleId = params.handleId;
    const startHandleType = params.handleType; // 'source' or 'target'

    // 如果是从已连接的输入句柄开始拖拽 (即 handleType 是 'target' 且该句柄已有连接)
    // 这种情况应该由 onEdgeUpdateStart 覆盖，因为它会检测到正在拖拽一个现有的边。
    // onConnectStart 主要用于处理从一个 *未连接* 的句柄开始拖拽新连接的情况。
    // 或者，当 onEdgeUpdateStart 触发时，它会设置 draggingState。
    // 如果 draggingState 已经设置，说明是 onEdgeUpdateStart 触发的。
    if (draggingState.value) {
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
        // 不设置 draggingState，让 onEdgeUpdateStart 处理
        return;
      }
    }

    // 对于从空闲句柄开始的全新连接尝试，draggingState 保持 null
  });


  onConnectEnd(async (eventOrConnectionParams?: Connection | MouseEvent | TouchEvent) => {
    // 新增日志：记录原始参数和 draggingState

    // 新增日志：详细记录 event.target (如果参数是事件对象)
    if (eventOrConnectionParams && !(eventOrConnectionParams as Connection).targetHandle && (eventOrConnectionParams instanceof MouseEvent || eventOrConnectionParams instanceof TouchEvent)) {
      const event = eventOrConnectionParams as MouseEvent | TouchEvent;
      if (event.target) {
      } else {
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
      // 此时，不确定原始边是否已被处理，所以不在这里移除原始边，
      // onEdgeUpdateEnd 应该负责处理边的移除。这里只清理客户端状态。
      // draggingState.value = null; // 修复：注释掉，防止过早清除
      // console.debug('[DIAGNOSTIC LOG] onConnectEnd: POST-CLEAR. draggingState is now:', JSON.parse(JSON.stringify(draggingState.value))); // 修复：相关的日志也注释掉
      // reorderPreviewIndex.value = null; // 修复：相关的清理也注释掉
    } else {
      // draggingState 为 null。
      // 这可能是：
      // 1. 全新连接尝试结束（无论成功连接还是拖放到画布）。
      // 2. 现有连接拖拽已由 onEdgeUpdateEnd 正确处理并清除了 draggingState。
      // 3. 没有拖动操作发生。
    }
  });

  // 新增：处理现有连接更新的结束
  onEdgeUpdateEnd(async (payload: { edge?: Edge, event: MouseEvent | TouchEvent }) => { // Signature changed to single payload object
    const { edge } = payload; // Destructure edge and event
    // 在函数入口处立即捕获 connectionEndHandle 的当前值，并进行深拷贝
    const capturedConnectionEndHandle = vueFlowInstance.connectionEndHandle.value ? klona(vueFlowInstance.connectionEndHandle.value) : null;

    // 打印捕获到的值，而不是实时值

    if (!draggingState.value || !draggingState.value.originalEdge) {
      draggingState.value = null; // 清理以防万一
      reorderPreviewIndex.value = null;
      return;
    }

    const activeDraggingState = klona(draggingState.value);
    // 立即清理全局 draggingState
    draggingState.value = null;
    reorderPreviewIndex.value = null;

    const { originalEdge } = activeDraggingState;
    const originalEdgeIdFromDrag = originalEdge?.id; // 获取正在拖拽的原始边的 ID
    const currentTabId = tabStore.activeTabId;

    if (!currentTabId) {
      // 注意：originalEdge 可能未被移除，这是一个潜在的问题状态。
      return;
    }

    // 原始边及其在旧目标（如果是多输入）的顺序，将由协调器函数处理。
    // 不再在此处直接调用 removeElementsAndRecord 或 updateNodeInputConnectionOrderAndRecord。

    if (edge) { // VueFlow 认为连接到了某个东西 (payload.edge 不为 null)

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
          newConnectionParams = {
            source: edge.source,
            sourceHandle: edge.sourceHandle,
            target: finalTargetHandleInfo.nodeId,
            targetHandle: finalTargetHandleInfo.id,
          };
        }

        if (isValidConnection(newConnectionParams, originalEdgeIdFromDrag)) {

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
            } else {
              // 连接到主多输入句柄 (例如 'text_inputs' 而非 'text_inputs__0') 或解析子句柄索引失败。
              // 这意味着应该追加到该多输入键的连接列表末尾。
              newTargetIndexInOrder = undefined; // undefined 表示追加，以匹配函数签名
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
            // 边已经存在于 store 中，并且其属性没有改变，所以不需要调用 store action。
            // VueFlow 应该已经正确处理了视觉上的拖拽和释放。
          } else {
            // Roo: <<<< START CONVERTIBLE_ANY LOGIC FOR EDGE UPDATE >>>>
            const newSourceNode = findNode(newConnectionParams.source);
            const newTargetNode = findNode(newConnectionParams.target);

            if (!newSourceNode || !newTargetNode) {
              // Should not happen if isValidConnection passed
              console.error("[onEdgeUpdateEnd] Failed to find new source or target node.");
              // Potentially revert or handle error state
              return;
            }

            const { originalKey: parsedNewSourceHandleKey } = parseSubHandleId(newConnectionParams.sourceHandle);
            const { originalKey: parsedNewTargetHandleKey } = parseSubHandleId(newConnectionParams.targetHandle);

            let newSourceOutputDef: GroupSlotInfo | undefined;
            const newSourceNodeType = getNodeType(newSourceNode);
            if (newSourceNodeType === 'core:GroupInput') {
              newSourceOutputDef = workflowStore.getActiveTabState()?.workflowData?.interfaceInputs?.[parsedNewSourceHandleKey];
            } else if (newSourceNodeType === 'core:NodeGroup') {
              newSourceOutputDef = (newSourceNode.data as any)?.groupInterface?.outputs?.[parsedNewSourceHandleKey];
            } else {
              newSourceOutputDef = (newSourceNode.data as any)?.outputs?.[parsedNewSourceHandleKey];
            }

            let newTargetInputDef: GroupSlotInfo | undefined;
            const newTargetNodeType = getNodeType(newTargetNode);
            if (newTargetNodeType === 'core:GroupOutput') {
              newTargetInputDef = workflowStore.getActiveTabState()?.workflowData?.interfaceOutputs?.[parsedNewTargetHandleKey];
            } else if (newTargetNodeType === 'core:NodeGroup') {
              newTargetInputDef = (newTargetNode.data as any)?.groupInterface?.inputs?.[parsedNewTargetHandleKey];
            } else {
              newTargetInputDef = (newTargetNode.data as any)?.inputs?.[parsedNewTargetHandleKey];
            }

            if (!newSourceOutputDef || !newTargetInputDef) {
              console.error(`[onEdgeUpdateEnd] Failed to find slot definitions for new connection: ${parsedNewSourceHandleKey}@${newSourceNode.id} or ${parsedNewTargetHandleKey}@${newTargetNode.id}`);
              return;
            }

            const originalNewSourceOutputDef = klona(newSourceOutputDef);
            const originalNewTargetInputDef = klona(newTargetInputDef);

            let finalSourceDefForEdgeOnUpdate = klona(originalNewSourceOutputDef);
            let finalTargetDefForEdgeOnUpdate = klona(originalNewTargetInputDef);

            const isNewSourceConv = originalNewSourceOutputDef.dataFlowType === DataFlowType.CONVERTIBLE_ANY || (originalNewSourceOutputDef.matchCategories || []).includes(BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);
            const isNewTargetConv = originalNewTargetInputDef.dataFlowType === DataFlowType.CONVERTIBLE_ANY || (originalNewTargetInputDef.matchCategories || []).includes(BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);
            const isNewSourceWild = originalNewSourceOutputDef.dataFlowType === DataFlowType.WILDCARD || (originalNewSourceOutputDef.matchCategories || []).includes(BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD);
            const isNewTargetWild = originalNewTargetInputDef.dataFlowType === DataFlowType.WILDCARD || (originalNewTargetInputDef.matchCategories || []).includes(BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD);

            let modifiedSlotInfoOnUpdate: { node: VueFlowNode, handleKey: string, newDefinition: GroupSlotInfo, direction: 'inputs' | 'outputs' } | null = null;
            let interfaceUpdateResultOnUpdate: { inputs: Record<string, GroupSlotInfo>, outputs: Record<string, GroupSlotInfo> } | null = null;

            if (isNewSourceConv && !isNewTargetConv && !isNewTargetWild) {
              finalSourceDefForEdgeOnUpdate.dataFlowType = originalNewTargetInputDef.dataFlowType;
              finalSourceDefForEdgeOnUpdate.matchCategories = [...(originalNewTargetInputDef.matchCategories || [])];
              const newSourceSlotDefConverted = createSyncSlotInfo(originalNewSourceOutputDef, originalNewTargetInputDef.dataFlowType, originalNewTargetInputDef.matchCategories || [], originalNewTargetInputDef);
              if (newSourceNodeType === 'core:GroupInput') {
                interfaceUpdateResultOnUpdate = syncInterfaceSlotFromConnection(currentTabId, newSourceNode.id, parsedNewSourceHandleKey, newSourceSlotDefConverted, 'inputs');
              } else {
                modifiedSlotInfoOnUpdate = { node: newSourceNode, handleKey: parsedNewSourceHandleKey, newDefinition: newSourceSlotDefConverted, direction: 'outputs' };
              }
            } else if (isNewTargetConv && !isNewSourceConv && !isNewSourceWild) {
              finalTargetDefForEdgeOnUpdate.dataFlowType = originalNewSourceOutputDef.dataFlowType;
              finalTargetDefForEdgeOnUpdate.matchCategories = [...(originalNewSourceOutputDef.matchCategories || [])];
              const newTargetSlotDefConverted = createSyncSlotInfo(originalNewTargetInputDef, originalNewSourceOutputDef.dataFlowType, originalNewSourceOutputDef.matchCategories || [], originalNewSourceOutputDef);
              if (newTargetNodeType === 'core:GroupOutput') {
                interfaceUpdateResultOnUpdate = syncInterfaceSlotFromConnection(currentTabId, newTargetNode.id, parsedNewTargetHandleKey, newTargetSlotDefConverted, 'outputs');
              } else {
                modifiedSlotInfoOnUpdate = { node: newTargetNode, handleKey: parsedNewTargetHandleKey, newDefinition: newTargetSlotDefConverted, direction: 'inputs' };
              }
            } else if (isNewTargetWild && !isNewSourceConv) {
                finalTargetDefForEdgeOnUpdate.dataFlowType = originalNewSourceOutputDef.dataFlowType;
                finalTargetDefForEdgeOnUpdate.matchCategories = [...(originalNewSourceOutputDef.matchCategories || [])];
            } else if (isNewSourceWild && !isNewTargetConv) {
                finalSourceDefForEdgeOnUpdate.dataFlowType = originalNewTargetInputDef.dataFlowType;
                finalSourceDefForEdgeOnUpdate.matchCategories = [...(originalNewTargetInputDef.matchCategories || [])];
            }
            // Roo: <<<< END CONVERTIBLE_ANY LOGIC FOR EDGE UPDATE >>>>

            const oldSourceForSummary = getReadableNames(originalEdge.source, originalEdge.sourceHandle, 'source');
            const oldTargetForSummary = getReadableNames(activeDraggingState.originalTargetNodeId, activeDraggingState.originalTargetHandleId, 'target');
            const newTargetForSummary = getReadableNames(newConnectionParams.target, newConnectionParams.targetHandle, 'target'); // newConnectionParams.source is the same as oldSourceForSummary if only target is changed
            const summary = `移动连接 ${oldSourceForSummary.nodeName}::${oldSourceForSummary.handleName} (${originalEdge.source}::${originalEdge.sourceHandle}) -> ${oldTargetForSummary.nodeName}::${oldTargetForSummary.handleName} (${activeDraggingState.originalTargetNodeId}::${activeDraggingState.originalTargetHandleId})  TO  ${getReadableNames(newConnectionParams.source, newConnectionParams.sourceHandle, 'source').nodeName}::${getReadableNames(newConnectionParams.source, newConnectionParams.sourceHandle, 'source').handleName} -> ${newTargetForSummary.nodeName}::${newTargetForSummary.handleName}`;

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
                // Roo: Add information about slot/interface modifications for history/undo
                modifiedSlotInfo: modifiedSlotInfoOnUpdate ? { nodeId: modifiedSlotInfoOnUpdate.node.id, handleKey: modifiedSlotInfoOnUpdate.handleKey, direction: modifiedSlotInfoOnUpdate.direction, newDefinition: klona(modifiedSlotInfoOnUpdate.newDefinition) } : undefined,
                interfaceUpdateResult: interfaceUpdateResultOnUpdate ? klona(interfaceUpdateResultOnUpdate) : undefined,
                // Roo: Add new edge data based on potential type conversion
                newEdgeData: {
                  sourceType: finalSourceDefForEdgeOnUpdate.dataFlowType,
                  targetType: finalTargetDefForEdgeOnUpdate.dataFlowType,
                }
              }
            );

            // Roo: moveAndReconnectEdgeAndRecord WILL NEED TO BE MODIFIED to accept these new params
            await workflowStore.moveAndReconnectEdgeAndRecord(
              originalEdge.id,
              activeDraggingState.originalTargetNodeId,
              activeDraggingState.originalTargetHandleId,
              newConnectionParams.source,
              newConnectionParams.sourceHandle ?? undefined,
              newConnectionParams.target,
              newConnectionParams.targetHandle ?? undefined,
              newTargetIndexInOrder,
              historyEntry,
              // Roo: Pass new parameters here once coordinator is updated
              // modifiedSlotInfoOnUpdate,
              // interfaceUpdateResultOnUpdate,
              // { sourceType: finalSourceDefForEdgeOnUpdate.dataFlowType, targetType: finalTargetDefForEdgeOnUpdate.dataFlowType }
            );
          }
        } else {
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
            // );
            // TODO: Call a proper delete coordinator: await workflowStore.deleteEdgeAndRecord(currentTabId, originalEdge.id, deleteEntry);
          }
        }
      } else { // finalTargetHandleInfo 无效 (例如，拖到画布空白处，但 VueFlow 仍然提供了 edge payload，这不太可能)
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
        }
      }
    } else { // 拖放到画布上 (VueFlow 的 `edge` 参数为 null)
      if (activeDraggingState.type === 'unplug_from_input') {
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
});

  // Watch for changes in the handle the mouse is currently over *while dragging*
  // 将 handleConnect 注册为 onConnect 事件的回调
  onConnect(handleConnect);
  watch(vueFlowInstance.connectionEndHandle, (newEndHandle: ConnectingHandle | null, oldEndHandle: ConnectingHandle | null) => {
    const startHandle = vueFlowInstance.connectionStartHandle.value; // This is ConnectingHandle | null

    if (startHandle) { // Only log if a connection drag is in progress
      // const startNames = getReadableNames(startHandle.nodeId, startHandle.id, startHandle.type); // Reduced verbosity

      if (newEndHandle && newEndHandle.type === 'target') {
        // const newEndNames = getReadableNames(newEndHandle.nodeId, newEndHandle.id, newEndHandle.type); // Reduced verbosity

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
            } else if (!currentIsSubHandle) {
              // 如果鼠标悬停在多输入插槽的主区域，但不在一个具体的 __index 子句柄上
              const inputOrders = (targetNode.data.inputConnectionOrders?.[currentOriginalHandleKey] as string[] | undefined) || [];
              reorderPreviewIndex.value = inputOrders.length;
            } else {
              reorderPreviewIndex.value = null;
            }
          } else {
            reorderPreviewIndex.value = null; // 目标不是多输入，或者没有有效的原始键
          }
        } else {
          reorderPreviewIndex.value = null; // 找不到目标节点
        }
      } else if (oldEndHandle) { // Mouse left a handle or newEndHandle is not a target
        reorderPreviewIndex.value = null;
      } else {
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
