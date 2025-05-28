import { type Ref } from "vue";
import { klona } from "klona/full";
import {
  type HistoryEntry,
  type GroupSlotInfo,
  DataFlowType,
  BuiltInSocketMatchCategory,
  type DataFlowTypeName,
  type WorkflowObject,
  type InputDefinition as ComfyInputDefinition, // GUGU: 使用别名以避免潜在的名称冲突
  type OutputDefinition,
  type GroupInterfaceInfo,
} from "@comfytavern/types";
import type { Edge, Node as VueFlowNode } from '@vue-flow/core';
import { getNodeType, parseSubHandleId } from "@/utils/nodeUtils"; // GUGU: 导入 parseSubHandleId
import { useGroupInterfaceSync } from "@/composables/group/useGroupInterfaceSync";
import type { WorkflowStateSnapshot } from "@/types/workflowTypes";


// 节点 node.data 的局部类型，用于在此可组合函数内提供更好的类型安全性
interface NodeInstanceData {
  inputs?: Record<string, ComfyInputDefinition | GroupSlotInfo>;
  outputs?: Record<string, OutputDefinition | GroupSlotInfo>;
  groupInterface?: GroupInterfaceInfo;
  inputConnectionOrders?: Record<string, string[]>; // GUGU: 为类型安全添加
  // 如果访问，则添加其他已知属性，如 configValues
}

/**
 * 用于管理与多输入插槽连接相关的操作的可组合函数，
 * 包括重新排序和更新边的 targetHandles，以及其他迁移的多输入操作。
 */
export function useMultiInputConnectionActions(
  _activeTabId: Ref<string | null> // 由于函数待重构，标记为未使用
) {

  /**
   * 为多输入插槽重新排序连接，并更新该插槽的所有边的 targetHandles。
   * @param nodeId 正在修改的节点的 ID。
   * @param inputKey 多输入句柄的基本键 (例如："text_input")。
   * @param newOrderedEdgeIds 按所需顺序排列的新边 ID 数组。
   * @param originalOrderedEdgeIds 重新排序前原始的边 ID 数组 (用于历史记录)。
   * @param nodeDisplayName 节点的可选显示名称，用于历史摘要。
   * @param inputDisplayName 输入插槽的可选显示名称，用于历史摘要。
   */
  async function reorderMultiInputConnections(
    _nodeId: string,
    _inputKey: string, // 例如 "text_input"
    _newOrderedEdgeIds: string[],
    _originalOrderedEdgeIds: string[], // 从 InlineConnectionSorter 传入
    _nodeDisplayName?: string, // 可选，用于历史摘要
    _inputDisplayName?: string // 可选，用于历史摘要
  ) {
    // 此函数依赖于直接的 store 访问和 getCurrentSnapshotLocal，这些正在从 action 中逐步淘汰。
    // 它需要重构以接收快照数据并返回修改。
    console.error(`[MultiInputActions] Function 'reorderMultiInputConnections' is pending full refactoring and should not be actively used.`);
    return Promise.resolve(); // 假设异步函数可能需要返回一个 Promise
  }

  /**
   * (从 useWorkflowInteractionCoordinator 迁移)
   * 更新节点输入连接顺序。此版本主要更新顺序数组。
   * 对于使用插槽中所有边的 targetHandle 更新进行全面重新排序，
   * 请使用 reorderMultiInputConnections。
   */
  async function updateNodeInputConnectionOrder(
    _nodeId: string,
    _handleKey: string,
    _newOrderedEdgeIds: string[],
    _entry: HistoryEntry // 调用者 (协调器) 准备完整的条目
  ) {
    // 此函数依赖于 getCurrentSnapshotLocal 和直接的 store 访问。待重构。
    console.error(`[MultiInputActions] Function 'updateNodeInputConnectionOrder' is pending full refactoring.`);
    return Promise.resolve();
  }

  /**
   * (从 useWorkflowInteractionCoordinator 迁移)
   * 处理从输入断开边连接的操作，如果是多输入，则更新 inputConnectionOrders。
   * 重要：此函数应修改传入的 mutableSnapshot 并返回修改后的部分。
   * @param mutableSnapshot - 可变的工作流状态快照。
   * @param edgeId - 要断开的边的 ID。
   * @param originalTargetNodeId - 原始目标节点的 ID。
   * @param originalTargetHandleId - 原始目标句柄的 ID (子句柄 ID)。
   * @param activeTabIdString - 当前活动标签页的 ID 字符串。
   * @returns 一个包含 modifiedElements 和 modifiedWorkflowData 的对象。
   */
  async function disconnectEdgeFromMultiInput(
    mutableSnapshot: WorkflowStateSnapshot,
    edgeId: string,
    originalTargetNodeId: string,
    originalTargetHandleId: string
    // activeTabIdString: string // 已移除，因为在此特定函数中未使用
  ): Promise<{ modifiedElements: (VueFlowNode | Edge)[]; modifiedWorkflowData: (WorkflowObject & { id: string }) | null }> {
    const elements = mutableSnapshot.elements;
    const workflowData = mutableSnapshot.workflowData; // 虽然此处未针对多输入逻辑直接修改

    // 1. 查找并移除边
    const edgeIndex = elements.findIndex(el => el.id === edgeId && 'source' in el);
    if (edgeIndex === -1) {
      console.warn(`[MultiInputActions:disconnectEdgeFromMultiInput] Edge ${edgeId} not found in snapshot. Skipping.`);
      return Promise.resolve({ modifiedElements: elements, modifiedWorkflowData: workflowData });
    }
    elements.splice(edgeIndex, 1); // 从 elements 中移除边

    // 2. 更新原始目标节点 (如果是多输入)
    const originalTargetNode = elements.find(el => el.id === originalTargetNodeId && !('source' in el)) as VueFlowNode | undefined;

    if (!originalTargetNode) {
      console.warn(`[MultiInputActions:disconnectEdgeFromMultiInput] Original target node ${originalTargetNodeId} not found. Edge removed, but target node state not updated.`);
      return Promise.resolve({ modifiedElements: elements, modifiedWorkflowData: workflowData });
    }

    const { originalKey: targetOriginalKey } = parseSubHandleId(originalTargetHandleId); // 移除了未使用的 oldTargetSubHandleIndex
    const targetNodeData = originalTargetNode.data as NodeInstanceData;

    if (targetNodeData?.inputs?.[targetOriginalKey]?.multi === true) {
      if (targetNodeData.inputConnectionOrders && targetNodeData.inputConnectionOrders[targetOriginalKey]) {
        const currentOrder = targetNodeData.inputConnectionOrders[targetOriginalKey];
        const edgeIndexInOrder = currentOrder.indexOf(edgeId);

        if (edgeIndexInOrder !== -1) {
          currentOrder.splice(edgeIndexInOrder, 1); // 从顺序中移除 edgeId

          // 如果存在且为数组，则更新 .value 数组
          const targetInputSlot = targetNodeData.inputs[targetOriginalKey];
          if (targetInputSlot && 'value' in targetInputSlot && Array.isArray(targetInputSlot.value)) {
            if (edgeIndexInOrder < targetInputSlot.value.length) {
              targetInputSlot.value.splice(edgeIndexInOrder, 1);
              console.debug(`[MultiInputActions:disconnectEdgeFromMultiInput] Value removed from inputs[${targetOriginalKey}].value at index ${edgeIndexInOrder}. New length: ${targetInputSlot.value.length}`);
            } else {
              console.warn(`[MultiInputActions:disconnectEdgeFromMultiInput] edgeIndexInOrder ${edgeIndexInOrder} out of bounds for value array (length ${targetInputSlot.value.length}) for ${targetOriginalKey}.`);
            }
          } else {
            console.debug(`[MultiInputActions:disconnectEdgeFromMultiInput] inputs[${targetOriginalKey}].value is not an array or slot not found, skipping value removal.`);
          }


          // 重新索引后续边的 targetHandles
          currentOrder.forEach((remainingEdgeId, newIndexInOrder) => {
            const edgeToReindex = elements.find(el => el.id === remainingEdgeId && 'source' in el) as Edge | undefined;
            if (edgeToReindex) {
              const newTargetHandle = `${targetOriginalKey}__${newIndexInOrder}`;
              if (edgeToReindex.targetHandle !== newTargetHandle) {
                edgeToReindex.targetHandle = newTargetHandle;
                console.debug(`[MultiInputActions:disconnectEdgeFromMultiInput] Re-indexed edge ${remainingEdgeId} targetHandle to ${newTargetHandle}.`);
              }
            }
          });

          if (currentOrder.length === 0) {
            delete targetNodeData.inputConnectionOrders[targetOriginalKey];
            if (Object.keys(targetNodeData.inputConnectionOrders).length === 0) {
              delete targetNodeData.inputConnectionOrders;
            }
            // 可选地，如果输入插槽变“空”，则清理它本身
            // 目前，仅移除顺序就足以满足连接逻辑。
            // 如果 .value 数组已受管理，现在也应该为空。
            if (targetInputSlot && 'value' in targetInputSlot && Array.isArray(targetInputSlot.value) && targetInputSlot.value.length === 0) {
              // 如果模式暗示在没有连接时 value 应为 undefined/null，则在此处处理。
              // 目前，空数组即可。或者删除它：
              // delete targetInputSlot.value;
              // if (Object.keys(targetInputSlot).length === 0) delete targetNodeData.inputs[targetOriginalKey];
            }
            console.debug(`[MultiInputActions:disconnectEdgeFromMultiInput] Order for ${targetOriginalKey} is now empty and removed.`);
          } else {
            console.debug(`[MultiInputActions:disconnectEdgeFromMultiInput] New order for ${targetOriginalKey}:`, currentOrder);
          }
        } else {
          console.warn(`[MultiInputActions:disconnectEdgeFromMultiInput] Edge ${edgeId} not found in inputConnectionOrder for ${targetOriginalKey}. State might be inconsistent if it was expected to be there.`);
        }
      } else {
        console.debug(`[MultiInputActions:disconnectEdgeFromMultiInput] No inputConnectionOrders for ${targetOriginalKey} on node ${originalTargetNodeId}, or slot is not multi-input. No order update needed for this slot.`);
      }
    } else {
      console.debug(`[MultiInputActions:disconnectEdgeFromMultiInput] Original target ${originalTargetNodeId}::${targetOriginalKey} is NOT multi-input (or slot/data missing). No multi-input specific cleanup needed for target node.`);
    }

    return Promise.resolve({
      modifiedElements: elements,
      modifiedWorkflowData: workflowData,
    });
  }

  /**
   * (从 useWorkflowInteractionCoordinator 迁移)
   * 处理将边连接到输入的操作，如果是多输入，则更新 inputConnectionOrders。
   * 假设如果连接到多输入，newEdgeParams.targetHandle 已具有正确的 __index。
   */
  // 函数签名已更改为同步，并接收可变的快照数据
  function connectEdgeToMultiInput(
    mutableSnapshot: { elements: (VueFlowNode | Edge)[]; workflowData?: (WorkflowObject & { id: string }) | null },
    newEdgeParams: Edge,
    targetIndexInOrder: number | undefined,
    // entry: HistoryEntry, // HistoryEntry 将由协调器处理
    activeTabIdString: string // 需要 tabId 用于 handleConvertibleAnyTypeChange
  ): { modifiedElements: (VueFlowNode | Edge)[]; modifiedWorkflowData?: (WorkflowObject & { id: string }) | null } {

    // 直接使用传入的 mutableSnapshot，不再获取 currentSnapshot 或 klona
    // 调用者 (InteractionCoordinator) 应该负责克隆初始快照
    const elementsToModify = mutableSnapshot.elements; // 这是对原始数组的引用
    let workflowDataToModify = mutableSnapshot.workflowData; // 这是对原始工作流数据的引用

    if (elementsToModify.some((el) => el && el.id === newEdgeParams.id)) {
      console.warn(
        `[MultiInputActions:connectEdgeToMultiInput (sync)] 边 ${newEdgeParams.id} 已存在。跳过。`
      );
      return { modifiedElements: elementsToModify, modifiedWorkflowData: workflowDataToModify };
    }

    const newEdge: Edge = klona(newEdgeParams); // 克隆传入的边参数以防外部修改
    elementsToModify.push(newEdge); // 直接修改传入的数组

    const targetNodeInElements = elementsToModify.find(
      (el) => el && el.id === newEdgeParams.target && !("source" in el)
    ) as VueFlowNode | undefined;

    if (targetNodeInElements && newEdgeParams.targetHandle) {
      const { originalKey: targetOriginalKey } = parseSubHandleId(newEdgeParams.targetHandle);
      if (typeof targetIndexInOrder === "number" && targetOriginalKey) {
        targetNodeInElements.data = targetNodeInElements.data || {};
        targetNodeInElements.data.inputConnectionOrders =
          targetNodeInElements.data.inputConnectionOrders || {};
        const currentOrder =
          targetNodeInElements.data.inputConnectionOrders[targetOriginalKey] || [];

        const newOrder = [...currentOrder];
        if (!newOrder.includes(newEdge.id)) {
          const validIndex = Math.max(0, Math.min(targetIndexInOrder, newOrder.length));
          newOrder.splice(validIndex, 0, newEdge.id);
        } else {
          const existingIdx = newOrder.indexOf(newEdge.id);
          if (existingIdx !== -1) newOrder.splice(existingIdx, 1);
          const validIndex = Math.max(0, Math.min(targetIndexInOrder, newOrder.length));
          newOrder.splice(validIndex, 0, newEdge.id);
        }
        targetNodeInElements.data.inputConnectionOrders[targetOriginalKey] = newOrder;

        newOrder.forEach((edgeInOrderId, indexInOrderLoop) => { // 重命名 indexInOrder 以避免冲突
          const edgeToUpdate = elementsToModify.find(
            (el) => el && el.id === edgeInOrderId && "source" in el
          ) as Edge | undefined;
          if (edgeToUpdate) {
            edgeToUpdate.targetHandle = `${targetOriginalKey}__${indexInOrderLoop}`;
          }
        });

        if (targetNodeInElements.data) {
          if (!targetNodeInElements.data.inputs) targetNodeInElements.data.inputs = {};
          if (!targetNodeInElements.data.inputs[targetOriginalKey]) targetNodeInElements.data.inputs[targetOriginalKey] = {};
          targetNodeInElements.data.inputs[targetOriginalKey]!.value = new Array(newOrder.length).fill(undefined);
        }
      }
    }

    // 调用 handleConvertibleAnyTypeChange 并更新 elementsToModify 和 workflowDataToModify
    // 假设 handleConvertibleAnyTypeChange 已被重构为同步或其异步性得到妥善处理
    if (!workflowDataToModify) {
      console.warn("[MultiInputActions:connectEdgeToMultiInput (sync)] workflowData is null or undefined. Skipping type change handling that might depend on it.");
    } else if (!workflowDataToModify.id) {
      console.warn("[MultiInputActions:connectEdgeToMultiInput (sync)] workflowData is missing an ID. Skipping type change handling.");
    } else {
      const { updatedElements, updatedWorkflowData } =
        handleConvertibleAnyTypeChange( // 假设现在是同步的，或者如果必须是异步的，则其结果会被等待
          newEdgeParams.source,
          newEdgeParams.sourceHandle,
          newEdgeParams.target,
          newEdgeParams.targetHandle,
          elementsToModify as VueFlowNode[], // 如果 elementsToModify 是 (VueFlowNode | Edge)[]，则可能需要类型转换
          workflowDataToModify, // 按原样传递
          activeTabIdString
        );
      // 更新 elementsToModify 和 workflowDataToModify 的引用，因为 handleConvertibleAnyTypeChange 返回的是克隆副本
      mutableSnapshot.elements = updatedElements; // 将其分配回 mutableSnapshot 属性
      mutableSnapshot.workflowData = updatedWorkflowData; // 将其分配回 mutableSnapshot 属性
      workflowDataToModify = updatedWorkflowData; // 同时更新局部变量以保持一致性（如果稍后使用）
    }

    // 移除了对 workflowManager.applyStateSnapshot 和 workflowStore.applyElementChangesAndRecordHistory 的调用

    // 返回修改后的快照数据
    return { modifiedElements: mutableSnapshot.elements, modifiedWorkflowData: mutableSnapshot.workflowData };
  }

  /**
   * (从 useWorkflowInteractionCoordinator 迁移)
   * 处理移动和重新连接边，更新多输入的 inputConnectionOrders。
   * 假设如果连接到多输入，newTargetHandleId 已具有正确的 __index。
   */
  // 重构 moveAndReconnectEdgeMultiInput
  function moveAndReconnectEdgeMultiInput(
    mutableSnapshot: WorkflowStateSnapshot, // 使用 WorkflowStateSnapshot 类型
    edgeToMoveId: string,
    originalTargetNodeId: string,
    originalTargetHandleId: string,
    newSourceNodeId: string,
    newSourceHandleId: string | undefined,
    newTargetNodeId: string | undefined, // 允许边被删除
    newTargetHandleId: string | undefined, // 允许边被删除
    newTargetIndexInOrder: number | undefined,
    // 以下参数由协调器处理并预先合并到快照，或作为单独参数传入
    // modifiedSlotInfo?: { nodeId: string, handleKey: string, newDefinition: GroupSlotInfo, direction: 'inputs' | 'outputs' }, // 修改的插槽信息
    // interfaceUpdateResult?: { inputs: Record<string, GroupSlotInfo>, outputs: Record<string, GroupSlotInfo> }, // 接口更新结果
    // newEdgeData?: { sourceType: DataFlowTypeName, targetType: DataFlowTypeName }, // 这个应该直接在协调器中更新到 edgeToUpdateInSnapshot.data // 新边数据
    activeTabIdString: string // 用于 handleConvertibleAnyTypeChange
  ): { modifiedElements: (VueFlowNode | Edge)[]; modifiedWorkflowData?: (WorkflowObject & { id: string }) | null } {
    console.debug(`[MultiInputActions] moveAndReconnectEdgeMultiInput (sync): Entry. Edge: ${edgeToMoveId}, OldTarget: ${originalTargetNodeId}::${originalTargetHandleId}, NewTarget: ${newTargetNodeId}::${newTargetHandleId}, NewIndex: ${newTargetIndexInOrder}`);

    const elementsToModify = mutableSnapshot.elements;
    let workflowDataToModify = mutableSnapshot.workflowData; // 可被 handleConvertibleAnyTypeChange 修改

    // 1. 从旧目标断开连接
    const { originalKey: oldTargetOriginalKey } = parseSubHandleId(originalTargetHandleId);
    const originalTargetNodeInSnapshot = elementsToModify.find(
      (el) => el && el.id === originalTargetNodeId && !("source" in el)
    ) as VueFlowNode | undefined;

    if (oldTargetOriginalKey && originalTargetNodeInSnapshot?.data?.inputConnectionOrders?.[oldTargetOriginalKey]) {
      const nodeData = originalTargetNodeInSnapshot.data as NodeInstanceData; // 类型断言
      const oldOrder = nodeData.inputConnectionOrders![oldTargetOriginalKey] as string[];
      const newOrderForOldTarget = oldOrder.filter((id: string) => id !== edgeToMoveId);

      if (newOrderForOldTarget.length !== oldOrder.length) { // 只有当边确实在旧顺序中时才更新
        nodeData.inputConnectionOrders![oldTargetOriginalKey] = newOrderForOldTarget;

        newOrderForOldTarget.forEach((edgeInOrderId, indexInOrder) => {
          const edgeToUpdate = elementsToModify.find(
            (el) => el && el.id === edgeInOrderId && "source" in el
          ) as Edge | undefined;
          if (edgeToUpdate) {
            edgeToUpdate.targetHandle = `${oldTargetOriginalKey}__${indexInOrder}`;
          }
        });

        if (nodeData.inputs && nodeData.inputs[oldTargetOriginalKey]) {
          const inputSlot = nodeData.inputs[oldTargetOriginalKey];
          if (inputSlot && 'value' in inputSlot) { // InputDefinition 的类型保护
            inputSlot.value = new Array(newOrderForOldTarget.length).fill(undefined); // 依赖类型保护的类型收窄
          }
        }

        if (newOrderForOldTarget.length === 0) {
          if (nodeData.inputConnectionOrders) delete nodeData.inputConnectionOrders[oldTargetOriginalKey];
          if (nodeData.inputConnectionOrders && Object.keys(nodeData.inputConnectionOrders).length === 0) {
            delete nodeData.inputConnectionOrders;
          }
          if (nodeData.inputs?.[oldTargetOriginalKey]) {
            const inputSlotToClean = nodeData.inputs[oldTargetOriginalKey];
            if (inputSlotToClean && 'value' in inputSlotToClean) {
              delete inputSlotToClean.value; // 依赖类型保护的类型收窄
            }
            if (Object.keys(inputSlotToClean!).length === 0) { // 在可能删除 value 后检查
              delete nodeData.inputs[oldTargetOriginalKey];
            }
            if (Object.keys(nodeData.inputs).length === 0) {
              delete nodeData.inputs;
            }
          }
        }
      }
    }

    // 2. 更新或移除边本身
    const edgeToUpdateIndex = elementsToModify.findIndex(
      (el) => el && el.id === edgeToMoveId && "source" in el
    );

    if (edgeToUpdateIndex === -1) {
      console.warn(`[MultiInputActions:moveAndReconnectEdgeMultiInput (sync)] 未找到要移动的边 ${edgeToMoveId}。跳过。`);
      return { modifiedElements: elementsToModify, modifiedWorkflowData: workflowDataToModify };
    }

    const edgeToUpdateInSnapshot = elementsToModify[edgeToUpdateIndex] as Edge;

    if (newTargetNodeId && newTargetHandleId) { // 边被连接到新的有效目标
      edgeToUpdateInSnapshot.source = newSourceNodeId;
      edgeToUpdateInSnapshot.sourceHandle = newSourceHandleId;
      edgeToUpdateInSnapshot.target = newTargetNodeId;
      // edgeToUpdateInSnapshot.targetHandle 将在下面 "连接到新目标" 部分处理
      // newEdgeData (sourceType, targetType) 应该由协调器在调用此函数前，
      // 通过 handleConvertibleAnyTypeChange 或其他逻辑确定并直接设置到 edgeToUpdateInSnapshot.data
    } else { // 边被删除 (拖到画布上释放)
      elementsToModify.splice(edgeToUpdateIndex, 1);
      // 如果边被删除，后续的 "连接到新目标" 和 "CONVERTIBLE_ANY" 处理将不适用
      console.debug(`[MultiInputActions:moveAndReconnectEdgeMultiInput (sync)] 边 ${edgeToMoveId} 已从 elements 中移除。`);
      return { modifiedElements: elementsToModify, modifiedWorkflowData: workflowDataToModify };
    }

    // 3. 连接到新目标
    if (newTargetNodeId && newTargetHandleId) { // 确保边没有被删除
      const newTargetNodeInSnapshot = elementsToModify.find(
        (el) => el && el.id === newTargetNodeId && !("source" in el)
      ) as VueFlowNode | undefined;

      if (newTargetNodeInSnapshot) {
        const { originalKey: newTargetOriginalKey } = parseSubHandleId(newTargetHandleId);

        if (typeof newTargetIndexInOrder === "number" && newTargetOriginalKey) { // 连接到多输入
          const nodeData = newTargetNodeInSnapshot.data as NodeInstanceData; // 类型断言
          nodeData.inputConnectionOrders = nodeData.inputConnectionOrders || {};
          const currentOrderAtNewTarget = (nodeData.inputConnectionOrders[newTargetOriginalKey] || []) as string[];

          let finalOrderAtNewTarget = [...currentOrderAtNewTarget];
          const existingIdxInNewTarget = finalOrderAtNewTarget.indexOf(edgeToMoveId);
          if (existingIdxInNewTarget !== -1) { // 如果边已存在于目标顺序中 (不太可能，但防御性处理)
            finalOrderAtNewTarget.splice(existingIdxInNewTarget, 1);
          }

          const validInsertAtIndex = Math.max(0, Math.min(newTargetIndexInOrder, finalOrderAtNewTarget.length));
          finalOrderAtNewTarget.splice(validInsertAtIndex, 0, edgeToMoveId);

          nodeData.inputConnectionOrders[newTargetOriginalKey] = finalOrderAtNewTarget;

          finalOrderAtNewTarget.forEach((edgeInOrderId, indexInOrder) => {
            const edgeToReindex = elementsToModify.find(
              (el) => el && el.id === edgeInOrderId && "source" in el
            ) as Edge | undefined;
            if (edgeToReindex) {
              edgeToReindex.targetHandle = `${newTargetOriginalKey}__${indexInOrder}`;
            }
          });

          nodeData.inputs = nodeData.inputs || {};
          let targetSlotDefinition = nodeData.inputs[newTargetOriginalKey];

          // 确保多输入插槽的插槽定义存在
          if (!targetSlotDefinition) {
            // 这种情况意味着模式可能完全缺少输入定义，
            // 或者 newTargetOriginalKey 不正确。
            // 对于多输入 (由 newTargetIndexInOrder 是数字指示)，
            // 我们期望有一个定义。
            // 节点的模式也可能定义此输入，但尚未在 `node.data.inputs` 中填充。
            // 如果可用，我们应该尝试从节点的模式中获取它。
            // 目前，我们假设如果它不在 data.inputs 中，则表示存在问题或需要创建。
            console.error(`[MultiInputActions] Critical: Input slot definition for multi-input ${newTargetOriginalKey} not found in node data on target node ${newTargetNodeId}. Cannot initialize .value array.`);
          } else {
            // 检查它是否是 ComfyInputDefinition 并标记为 multi。
            // 此处的 'multi' 属性是区分 ComfyInputDefinition 和 GroupSlotInfo 的良好判别符。
            if (targetSlotDefinition && 'multi' in targetSlotDefinition && (targetSlotDefinition as ComfyInputDefinition).multi === true) {
              // 此时，targetSlotDefinition 已知为 ComfyInputDefinition
              const multiInputSlot = targetSlotDefinition as ComfyInputDefinition; // 为清晰起见，收窄类型

              // 如果 .value 不存在或为 undefined，则初始化它。这会使 .value 成为一个数组。
              if (!('value' in multiInputSlot) || typeof (multiInputSlot as any).value === 'undefined') {
                (multiInputSlot as any).value = [];
                console.debug(`[MultiInputActions] Initialized .value array for native multi-input slot ${newTargetOriginalKey} on node ${newTargetNodeId}.`);
              }

              // 确保 .value 是一个数组 (在上面的块之后它应该是)，然后设置其长度并填充。
              // 这处理了新初始化的 'value' 和可能不是数组的预先存在的 'value' (多输入的错误状态)。
              // 直接分配一个新数组更安全。
              (multiInputSlot as any).value = new Array(finalOrderAtNewTarget.length).fill(undefined);
              console.debug(`[MultiInputActions] Set .value array for multi-input slot ${newTargetOriginalKey} on node ${newTargetNodeId} to length ${finalOrderAtNewTarget.length}.`);

            } else if (targetSlotDefinition) { // 它存在但不是具有 multi:true 的 ComfyInputDefinition
              // 此路径表示它要么是 GroupSlotInfo，要么是不是 multi 的 ComfyInputDefinition，
              // 要么是 multi 但 'multi' 属性检查失败的 ComfyInputDefinition (例如 'multi' 不是 'true')。
              console.warn(`[MultiInputActions] Input slot ${newTargetOriginalKey} on node ${newTargetNodeId} is not a valid multi-input slot for .value array initialization (e.g., GroupSlotInfo, or non-multi/misconfigured ComfyInputDefinition).`);
            }
            // 如果 targetSlotDefinition 从一开始就是 null/undefined，则第 693 行的外部 'if (!targetSlotDefinition)' 已经处理了日志记录错误。
          }
          console.debug(`[MultiInputActions:moveAndReconnectEdgeMultiInput (sync)] 多输入槽 ${newTargetOriginalKey} 的新顺序:`, JSON.parse(JSON.stringify(finalOrderAtNewTarget)));

        } else if (newTargetHandleId) { // 连接到单输入
          edgeToUpdateInSnapshot.targetHandle = newTargetHandleId;
          console.debug(`[MultiInputActions:moveAndReconnectEdgeMultiInput (sync)] 单输入槽 ${newTargetHandleId} 的 targetHandle 已设置。`);
        }
      } else {
        console.warn(`[MultiInputActions:moveAndReconnectEdgeMultiInput (sync)] 未找到新的目标节点 ${newTargetNodeId}。`);
      }
    }

    // 4. 处理 CONVERTIBLE_ANY 类型变化
    // 这一步应该在所有连接逻辑完成后，并且边已经更新了其 source/target/sourceHandle/targetHandle
    if (newTargetNodeId && newTargetHandleId && edgeToUpdateInSnapshot) { // 确保边仍然存在且已连接
      const { updatedElements, updatedWorkflowData } = handleConvertibleAnyTypeChange(
        edgeToUpdateInSnapshot.source,
        edgeToUpdateInSnapshot.sourceHandle,
        edgeToUpdateInSnapshot.target, // 使用更新后的 target
        edgeToUpdateInSnapshot.targetHandle, // 使用更新后的 targetHandle
        elementsToModify,
        workflowDataToModify,
        activeTabIdString
      );
      // 更新 elementsToModify 和 workflowDataToModify 的引用
      mutableSnapshot.elements = updatedElements; // 直接修改传入快照的属性
      mutableSnapshot.workflowData = updatedWorkflowData; // 直接修改传入快照的属性
      workflowDataToModify = updatedWorkflowData; // 更新局部变量以保持一致性
    }

    return { modifiedElements: mutableSnapshot.elements, modifiedWorkflowData: mutableSnapshot.workflowData };
  }


  // 获取插槽定义的辅助函数
  function getSlotDefinition(
    node: VueFlowNode,
    handleId: string | null | undefined,
    handleType: 'source' | 'target',
    currentWorkflowData?: WorkflowObject | undefined // 已更改类型
  ): ComfyInputDefinition | OutputDefinition | GroupSlotInfo | undefined { // 已更改返回类型
    if (!handleId) return undefined;

    const { originalKey: slotKey } = parseSubHandleId(handleId); // GUGU: 使用导入的 parseSubHandleId
    if (!slotKey) return undefined;

    const nodeType = getNodeType(node);
    const nodeData = node.data as NodeInstanceData; // 使用本地 NodeInstanceData 类型

    if (handleType === 'source') { // 输出插槽
      if (nodeType === 'core:GroupInput') {
        // GroupInput 的输出在工作流的 interfaceInputs 中定义
        return currentWorkflowData?.interfaceInputs?.[slotKey];
      } else if (nodeType === 'core:NodeGroup') {
        return nodeData?.groupInterface?.outputs?.[slotKey];
      } else {
        return nodeData?.outputs?.[slotKey] as OutputDefinition | undefined; // 为清晰起见进行类型转换
      }
    } else { // 输入插槽
      if (nodeType === 'core:GroupOutput') {
        // GroupOutput 的输入在工作流的 interfaceOutputs 中定义
        return currentWorkflowData?.interfaceOutputs?.[slotKey];
      } else if (nodeType === 'core:NodeGroup') {
        return nodeData?.groupInterface?.inputs?.[slotKey];
      } else {
        return nodeData?.inputs?.[slotKey] as ComfyInputDefinition | undefined; // 为清晰起见进行类型转换
      }
    }
  }

  // handleConvertibleAnyTypeChange 现在应该是同步的，或者其异步性由调用者处理
  // 它应该直接修改传入的 elementsCopy 和 workflowDataCopy (如果是引用的话)
  // 或者，如果它内部克隆，那么它应该返回这些克隆的修改版本。
  // 为了与 connectEdgeToMultiInput 的模式一致，让它返回修改后的对象。
  /* async */ function handleConvertibleAnyTypeChange(
    sourceNodeId: string,
    sourceHandleId: string | null | undefined,
    targetNodeId: string,
    targetHandleId: string | null | undefined,
    elementsToModifyArg: (VueFlowNode | Edge)[], // 已更改类型以包含 Edge
    workflowDataToModifyArg: (WorkflowObject & { id: string }) | undefined | null, // 允许 null
    activeTabIdString: string
  ): /* Promise<...> */ { updatedElements: (VueFlowNode | Edge)[]; updatedWorkflowData: (WorkflowObject & { id: string }) | null } { // GUGU: 将 undefined 更改为 null
    // 操作传入参数的克隆副本，以避免直接修改原始快照外的引用，除非这是期望的行为。
    // connectEdgeToMultiInput 的调用者 (InteractionCoordinator) 应该已经克隆了整个快照。
    // 因此，这里可以直接修改 elementsToModifyArg 和 workflowDataToModifyArg，或者克隆它们。
    // 为安全起见，并且因为原始函数克隆了，这里也克隆。
    const elementsCopy = klona(elementsToModifyArg); // 克隆传入的元素数组
    let workflowDataCopy: (WorkflowObject & { id: string }) | undefined | null = workflowDataToModifyArg ? klona(workflowDataToModifyArg) : workflowDataToModifyArg;

    const sourceNode = elementsCopy.find(n => n.id === sourceNodeId && !("source" in n)) as VueFlowNode | undefined; // 确保它是一个节点
    const targetNode = elementsCopy.find(n => n.id === targetNodeId && !("source" in n)) as VueFlowNode | undefined; // 确保它是一个节点

    if (!sourceNode || !targetNode) return {
      updatedElements: elementsCopy as (VueFlowNode | Edge)[],
      updatedWorkflowData: workflowDataCopy as ((WorkflowObject & { id: string }) | null)
    };

    // workflowDataCopy 可能是 null，getSlotDefinition 需要能处理
    const sourceSlotDef = getSlotDefinition(sourceNode, sourceHandleId, 'source', workflowDataCopy ?? undefined);
    const targetSlotDef = getSlotDefinition(targetNode, targetHandleId, 'target', workflowDataCopy ?? undefined);

    if (!sourceSlotDef || !targetSlotDef) return {
      updatedElements: elementsCopy as (VueFlowNode | Edge)[],
      updatedWorkflowData: workflowDataCopy as ((WorkflowObject & { id: string }) | null)
    };

    let nodeToUpdate: VueFlowNode | undefined;
    let keyOfSlotOnUpdatedNode: string | undefined; // 为清晰起见重命名
    let newType: DataFlowTypeName | undefined;
    let newCategories: string[] | undefined;
    let isSourceNodeBeingUpdated = false;

    const isSourceConvertible = sourceSlotDef.dataFlowType === DataFlowType.CONVERTIBLE_ANY || sourceSlotDef.matchCategories?.includes(BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);
    const isTargetConvertible = targetSlotDef.dataFlowType === DataFlowType.CONVERTIBLE_ANY || targetSlotDef.matchCategories?.includes(BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);

    if (isSourceConvertible && !isTargetConvertible && targetSlotDef.dataFlowType !== DataFlowType.WILDCARD && targetSlotDef.dataFlowType !== DataFlowType.CONVERTIBLE_ANY) {
      nodeToUpdate = sourceNode;
      keyOfSlotOnUpdatedNode = parseSubHandleId(sourceHandleId).originalKey; // GUGU: 使用导入的 parseSubHandleId
      newType = targetSlotDef.dataFlowType;
      newCategories = targetSlotDef.matchCategories?.filter((cat: string) => cat !== BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE && cat !== BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD) || [];
      isSourceNodeBeingUpdated = true;
    } else if (isTargetConvertible && !isSourceConvertible && sourceSlotDef.dataFlowType !== DataFlowType.WILDCARD && sourceSlotDef.dataFlowType !== DataFlowType.CONVERTIBLE_ANY) {
      nodeToUpdate = targetNode;
      keyOfSlotOnUpdatedNode = parseSubHandleId(targetHandleId).originalKey; // GUGU: 使用导入的 parseSubHandleId
      newType = sourceSlotDef.dataFlowType;
      newCategories = sourceSlotDef.matchCategories?.filter((cat: string) => cat !== BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE && cat !== BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD) || [];
      isSourceNodeBeingUpdated = false;
    } else {
      return {
        updatedElements: elementsCopy as (VueFlowNode | Edge)[],
        updatedWorkflowData: workflowDataCopy as ((WorkflowObject & { id: string }) | null)
      };
    }

    if (!nodeToUpdate || !keyOfSlotOnUpdatedNode || !newType) {
      return {
        updatedElements: elementsCopy as (VueFlowNode | Edge)[],
        updatedWorkflowData: workflowDataCopy as ((WorkflowObject & { id: string }) | null)
      };
    }

    const nodeToUpdateInCopy = elementsCopy.find(n => n.id === nodeToUpdate!.id && !("source" in n)) as VueFlowNode | undefined; // 确保它是一个节点
    if (!nodeToUpdateInCopy) return {
      updatedElements: elementsCopy as (VueFlowNode | Edge)[],
      updatedWorkflowData: workflowDataCopy as ((WorkflowObject & { id: string }) | null)
    };

    nodeToUpdateInCopy.data = nodeToUpdateInCopy.data || {}; // 确保 data 对象存在
    const nodeDataToUpdate = nodeToUpdateInCopy.data as NodeInstanceData; // 使用本地类型

    const nodeType = getNodeType(nodeToUpdateInCopy);
    let slotDefinitionToUpdate: ComfyInputDefinition | OutputDefinition | GroupSlotInfo | undefined;

    if (nodeType === 'core:NodeGroup') {
      const interfaceKey = isSourceNodeBeingUpdated ? 'outputs' : 'inputs';
      if (nodeDataToUpdate.groupInterface && nodeDataToUpdate.groupInterface[interfaceKey]) {
        slotDefinitionToUpdate = nodeDataToUpdate.groupInterface[interfaceKey]![keyOfSlotOnUpdatedNode];
      }
      if (slotDefinitionToUpdate) {
        (slotDefinitionToUpdate as GroupSlotInfo).dataFlowType = newType; // 为安全起见，转换为 GroupSlotInfo
        (slotDefinitionToUpdate as GroupSlotInfo).matchCategories = newCategories;
        // 向 NodeGroup 的 groupInterface 添加新的 convertible_any 占位符
        const groupInterfaceSlots = nodeDataToUpdate.groupInterface![interfaceKey]!;
        let newConvKeyIndex = 0;
        let nextConvKey = `${interfaceKey === 'inputs' ? 'input' : 'output'}_conv_${newConvKeyIndex}`;
        while (groupInterfaceSlots[nextConvKey]) {
          newConvKeyIndex++;
          nextConvKey = `${interfaceKey === 'inputs' ? 'input' : 'output'}_conv_${newConvKeyIndex}`;
        }
        groupInterfaceSlots[nextConvKey] = {
          key: nextConvKey, // GroupSlotInfo 需要 key
          displayName: '*',
          dataFlowType: DataFlowType.CONVERTIBLE_ANY,
          matchCategories: [BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE],
          customDescription: '自动生成的备用可转换插槽 (组接口)',
        } as GroupSlotInfo; // 确保它符合 GroupSlotInfo
      }
    } else if (nodeType === 'core:GroupInput' && isSourceNodeBeingUpdated) {
      if (nodeDataToUpdate.outputs) {
        slotDefinitionToUpdate = nodeDataToUpdate.outputs[keyOfSlotOnUpdatedNode];
      }
      if (slotDefinitionToUpdate) {
        (slotDefinitionToUpdate as OutputDefinition).dataFlowType = newType;
        (slotDefinitionToUpdate as OutputDefinition).matchCategories = newCategories;

        const { syncInterfaceSlotFromConnection } = useGroupInterfaceSync();
        // 为 syncInterfaceSlotFromConnection 创建一个类似 GroupSlotInfo 的对象
        const updatedSlotInfoForSync: GroupSlotInfo = {
          key: keyOfSlotOnUpdatedNode,
          displayName: slotDefinitionToUpdate.displayName || keyOfSlotOnUpdatedNode,
          dataFlowType: newType,
          matchCategories: newCategories,
          // required, config, multi, allowDynamicType 可能需要来源或默认值
        };
        const syncedInterfaces = syncInterfaceSlotFromConnection(activeTabIdString, nodeToUpdateInCopy.id, keyOfSlotOnUpdatedNode, updatedSlotInfoForSync, 'inputs');
        if (syncedInterfaces) {
          if (workflowDataCopy) {
            workflowDataCopy.interfaceInputs = syncedInterfaces.inputs;
          } else if (workflowDataCopy !== null) { // 如果是 undefined 则创建新的，但如果显式为 null 则不创建
            workflowDataCopy = {
              id: `temp-wf-gi-${Date.now()}`, // 确保唯一且描述性的临时 ID
              name: 'Temporary Workflow Data (GroupInput Sync)', // 确保 name 存在
              nodes: [], // 确保 nodes 存在
              edges: [], // 确保 edges 存在
              viewport: { x: 0, y: 0, zoom: 1 }, // 确保 viewport 存在
              interfaceInputs: syncedInterfaces.inputs,
              interfaceOutputs: {},
            } as (WorkflowObject & { id: string }); // 对新对象断言类型
          }
        }
      }
    } else if (nodeType === 'core:GroupOutput' && !isSourceNodeBeingUpdated) {
      if (nodeDataToUpdate.inputs) {
        slotDefinitionToUpdate = nodeDataToUpdate.inputs[keyOfSlotOnUpdatedNode];
      }
      if (slotDefinitionToUpdate) {
        (slotDefinitionToUpdate as ComfyInputDefinition).dataFlowType = newType;
        (slotDefinitionToUpdate as ComfyInputDefinition).matchCategories = newCategories;

        const { syncInterfaceSlotFromConnection } = useGroupInterfaceSync();
        const updatedSlotInfoForSync: GroupSlotInfo = {
          key: keyOfSlotOnUpdatedNode,
          displayName: slotDefinitionToUpdate.displayName || keyOfSlotOnUpdatedNode,
          dataFlowType: newType,
          matchCategories: newCategories,
        };
        const syncedInterfaces = syncInterfaceSlotFromConnection(activeTabIdString, nodeToUpdateInCopy.id, keyOfSlotOnUpdatedNode, updatedSlotInfoForSync, 'outputs');
        if (syncedInterfaces) {
          if (workflowDataCopy) {
            workflowDataCopy.interfaceOutputs = syncedInterfaces.outputs;
          } else if (workflowDataCopy === null && workflowDataToModifyArg === null) { // GUGU: 如果原始值为 null，则进行更精确的检查以创建新值
            workflowDataCopy = {
              id: `temp-wf-go-${Date.now()}`, // 确保唯一且描述性的临时 ID
              name: 'Temporary Workflow Data (GroupOutput Sync)', // 确保 name 存在
              nodes: [], // 确保 nodes 存在
              edges: [], // 确保 edges 存在
              viewport: { x: 0, y: 0, zoom: 1 }, // 确保 viewport 存在
              interfaceInputs: {},
              interfaceOutputs: syncedInterfaces.outputs,
            } as (WorkflowObject & { id: string }); // 对新对象断言类型
          }
        }
      }
    } else { // 常规节点
      const dictKey = isSourceNodeBeingUpdated ? 'outputs' : 'inputs';
      if (nodeDataToUpdate[dictKey]) {
        slotDefinitionToUpdate = nodeDataToUpdate[dictKey]![keyOfSlotOnUpdatedNode];
      }
      if (slotDefinitionToUpdate) {
        // 标准类型和类别更新
        slotDefinitionToUpdate.dataFlowType = newType;
        slotDefinitionToUpdate.matchCategories = newCategories;

        // 标记为不再是动态类型
        if ('allowDynamicType' in slotDefinitionToUpdate) {
          (slotDefinitionToUpdate as (ComfyInputDefinition | OutputDefinition | GroupSlotInfo)).allowDynamicType = false;
        }

        const slotToCopyFrom = isSourceNodeBeingUpdated ? targetSlotDef : sourceSlotDef;

        // 复制 displayName
        if (slotToCopyFrom.displayName) {
          slotDefinitionToUpdate.displayName = slotToCopyFrom.displayName;
        }

        // 复制 description (处理不同的属性名称)
        let descriptionToCopy: string | undefined;
        if ('description' in slotToCopyFrom && typeof slotToCopyFrom.description === 'string') {
          descriptionToCopy = slotToCopyFrom.description;
        } else if ('customDescription' in slotToCopyFrom && typeof slotToCopyFrom.customDescription === 'string') {
          descriptionToCopy = slotToCopyFrom.customDescription;
        }

        if (descriptionToCopy !== undefined) {
          if ('description' in slotDefinitionToUpdate) {
            (slotDefinitionToUpdate as ComfyInputDefinition | OutputDefinition).description = descriptionToCopy;
          } else if ('customDescription' in slotDefinitionToUpdate) {
            (slotDefinitionToUpdate as GroupSlotInfo).customDescription = descriptionToCopy;
          }
        }

        // 复制 config 对象 (深拷贝)
        // slotDefinitionToUpdate (CONVERTIBLE_ANY 插槽) 采用 slotToCopyFrom 的 config。
        if ('config' in slotToCopyFrom && (slotToCopyFrom as ComfyInputDefinition | GroupSlotInfo).config !== undefined) {
          // 源具有 config，因此 CONVERTIBLE_ANY 插槽应采用它。
          (slotDefinitionToUpdate as any).config = klona((slotToCopyFrom as ComfyInputDefinition | GroupSlotInfo).config);
        } else {
          // 源没有 config (或者它是 undefined)，因此从 CONVERTIBLE_ANY 插槽中删除它。
          delete (slotDefinitionToUpdate as any).config;
        }

        // 复制 min/max：这些是仅 GroupSlotInfo 上的直接属性。
        // 复制 min/max。slotDefinitionToUpdate (CONVERTIBLE_ANY 插槽) 采用 min/max。
        // 源可以是 GroupSlotInfo (直接 min/max) 或 InputDefinition (config 中的 min/max)。
        let minToApply: number | undefined = undefined;
        let maxToApply: number | undefined = undefined;

        // 首先检查直接属性 (对于 GroupSlotInfo 源)
        if ('min' in slotToCopyFrom && typeof (slotToCopyFrom as GroupSlotInfo).min === 'number') {
          minToApply = (slotToCopyFrom as GroupSlotInfo).min;
        }
        // 然后检查 config (对于具有 config 的 ComfyInputDefinition 或 GroupSlotInfo 源)
        else if ('config' in slotToCopyFrom && typeof (slotToCopyFrom as ComfyInputDefinition | GroupSlotInfo).config?.min === 'number') {
          // 如果采用此分支，则保证 .config 存在且 .config.min 是一个数字。
          minToApply = (slotToCopyFrom as ComfyInputDefinition | GroupSlotInfo).config!.min as number;
        }

        if ('max' in slotToCopyFrom && typeof (slotToCopyFrom as GroupSlotInfo).max === 'number') {
          maxToApply = (slotToCopyFrom as GroupSlotInfo).max;
        }
        else if ('config' in slotToCopyFrom && typeof (slotToCopyFrom as ComfyInputDefinition | GroupSlotInfo).config?.max === 'number') {
          // 如果采用此分支，则保证 .config 存在且 .config.max 是一个数字。
          maxToApply = (slotToCopyFrom as ComfyInputDefinition | GroupSlotInfo).config!.max as number;
        }

        if (minToApply !== undefined) {
          (slotDefinitionToUpdate as any).min = minToApply;
        } else {
          delete (slotDefinitionToUpdate as any).min;
        }

        if (maxToApply !== undefined) {
          (slotDefinitionToUpdate as any).max = maxToApply;
        } else {
          delete (slotDefinitionToUpdate as any).max;
        }
        // 对于常规节点，我们目前不会自动添加新的 CONVERTIBLE_ANY 占位符。
      }
    }
    return {
      updatedElements: elementsCopy as (VueFlowNode | Edge)[],
      updatedWorkflowData: workflowDataCopy as ((WorkflowObject & { id: string }) | null)
    };
  }

  // 返回所有公共方法
  return {
    reorderMultiInputConnections,
    updateNodeInputConnectionOrder,
    disconnectEdgeFromMultiInput,
    connectEdgeToMultiInput, // 签名和实现已更改
    moveAndReconnectEdgeMultiInput, // 需要类似的重构
  };
}