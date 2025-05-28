import { type Ref } from "vue";
import { klona } from "klona/full";
import { useWorkflowStore } from "@/stores/workflowStore";
import {
  type HistoryEntry,
  type GroupSlotInfo,
  // type VueFlowNodeData, // REMOVED
  DataFlowType,
  BuiltInSocketMatchCategory,
  type DataFlowTypeName,
  type WorkflowObject,
  type InputDefinition,
  type OutputDefinition,
  type GroupInterfaceInfo,
} from "@comfytavern/types";
import type { WorkflowStateSnapshot } from "@/types/workflowTypes";
import { createHistoryEntry } from "@comfytavern/utils";
import type { Edge, Node as VueFlowNode } from '@vue-flow/core';
import { useWorkflowManager } from "@/composables/workflow/useWorkflowManager";
import { getNodeType, parseSubHandleId } from "@/utils/nodeUtils"; // GUGU: Import parseSubHandleId
import { useGroupInterfaceSync } from "@/composables/group/useGroupInterfaceSync";

// import { useTabStore } from "@/stores/tabStore";

// Local type for node.data to provide better type safety within this composable
interface NodeInstanceData {
  inputs?: Record<string, InputDefinition | GroupSlotInfo>;
  outputs?: Record<string, OutputDefinition | GroupSlotInfo>;
  groupInterface?: GroupInterfaceInfo;
  // Add other known properties like inputConnectionOrders, configValues if they are accessed
}

/**
 * Composable for managing actions related to multi-input slot connections,
 * including reordering and updating edge targetHandles, and other migrated multi-input operations.
 */
export function useMultiInputConnectionActions(
  activeTabId: Ref<string | null>
) {
  const workflowStore = useWorkflowStore();
  const workflowManager = useWorkflowManager();

  // GUGU: Removed internal parseSubHandleIdLocal, will use imported version

  const getCurrentSnapshotLocal = (idToUse?: string): WorkflowStateSnapshot | undefined => {
    const effectiveId = idToUse ?? activeTabId.value;
    if (!effectiveId) {
      console.warn("[MultiInputActions] getCurrentSnapshotLocal: No active tab ID or provided ID.");
      return undefined;
    }
    return workflowManager.getCurrentSnapshot(effectiveId);
  };

  /**
   * Reorders connections for a multi-input slot and updates ALL edge targetHandles for that slot.
   * @param nodeId The ID of the node being modified.
   * @param inputKey The base key of the multi-input handle (e.g., "text_input").
   * @param newOrderedEdgeIds The new array of edge IDs in the desired order.
   * @param originalOrderedEdgeIds The original array of edge IDs before reordering (for history).
   * @param nodeDisplayName Optional display name of the node for history summary.
   * @param inputDisplayName Optional display name of the input slot for history summary.
   */
  async function reorderMultiInputConnections(
    nodeId: string,
    inputKey: string, // 例如 "text_input"
    newOrderedEdgeIds: string[],
    originalOrderedEdgeIds: string[], // 从 InlineConnectionSorter 传入
    nodeDisplayName?: string, // 可选，用于历史摘要
    inputDisplayName?: string // 可选，用于历史摘要
  ) {
    if (!activeTabId.value) {
      console.error("[MultiInputActions:reorderMultiInputConnections] No active tab ID.");
      return;
    }
    const tabId = activeTabId.value;

    const edgeTargetHandleChanges: Array<{
      edgeId: string;
      oldTargetHandle: string | null | undefined;
      newTargetHandle: string | null | undefined;
    }> = [];

    newOrderedEdgeIds.forEach((edgeId, newIndex) => {
      const edge = workflowStore.getEdgeById(tabId, edgeId);
      if (edge) {
        const newTargetHandle = `${inputKey}__${newIndex}`;
        if (edge.targetHandle !== newTargetHandle) {
          edgeTargetHandleChanges.push({
            edgeId: edge.id,
            oldTargetHandle: edge.targetHandle,
            newTargetHandle: newTargetHandle,
          });
        }
      } else {
        console.warn(`[MultiInputActions:reorderMultiInputConnections] 在重排序期间未找到边 ${edgeId}。`);
      }
    });

    const summaryNode = nodeDisplayName || nodeId;
    const summaryInput = inputDisplayName || inputKey;
    const summary = `重排节点 [${summaryNode}] 输入 [${summaryInput}] 的连接 (更新句柄)`;

    const historyPayload = {
      nodeId,
      inputKey,
      oldEdgeIdOrder: [...originalOrderedEdgeIds],
      newEdgeIdOrder: [...newOrderedEdgeIds],
      edgeTargetHandleChanges,
    };

    const entry: HistoryEntry = createHistoryEntry(
      "reorder",
      "nodeMultiInputConnections",
      summary,
      historyPayload
    );

    try {
      await workflowStore.updateMultiInputConnectionsAndRecord(
        tabId,
        nodeId,
        inputKey,
        newOrderedEdgeIds,
        edgeTargetHandleChanges,
        entry
      );
      console.log("[MultiInputActions:reorderMultiInputConnections] 多输入连接已更新并记录历史。");
    } catch (error) {
      console.error("[MultiInputActions:reorderMultiInputConnections] 更新多输入连接失败:", error);
    }
  }

  /**
   * (Migrated from useWorkflowInteractionCoordinator)
   * Updates node input connection order. This version primarily updates the order array.
   * For comprehensive reordering with targetHandle updates for all edges in the slot,
   * use reorderMultiInputConnections.
   */
  async function updateNodeInputConnectionOrder(
    nodeId: string,
    handleKey: string,
    newOrderedEdgeIds: string[],
    entry: HistoryEntry // Caller (coordinator) prepares the full entry
  ) {
    if (!activeTabId.value) {
      console.error("[MultiInputActions:updateNodeInputConnectionOrder] No active tab ID.");
      return;
    }
    const tabId = activeTabId.value;

    const currentSnapshot = getCurrentSnapshotLocal(tabId);
    if (!currentSnapshot) {
      console.error(
        `[MultiInputActions:updateNodeInputConnectionOrder] 无法获取标签页 ${tabId} 的当前快照。`
      );
      return;
    }

    const originalNode = currentSnapshot.elements.find(
      (el) => el.id === nodeId && !("source" in el)
    ) as VueFlowNode | undefined;

    if (!originalNode) {
      console.error(
        `[MultiInputActions:updateNodeInputConnectionOrder] 在当前快照中未找到节点 ${nodeId}。`
      );
      return;
    }

    const currentOrder = (originalNode.data?.inputConnectionOrders?.[handleKey] as string[] | undefined) || [];

    if (
      currentOrder.length === newOrderedEdgeIds.length &&
      currentOrder.every((id: string, index: number) => id === newOrderedEdgeIds[index])
    ) {
      console.debug(
        `[MultiInputActions:updateNodeInputConnectionOrder] 节点 ${nodeId} 句柄 ${handleKey} 的连接顺序未改变。跳过。`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const targetNodeInNextSnapshot = nextSnapshot.elements.find(
      (el) => el.id === nodeId && !("source" in el)
    ) as VueFlowNode | undefined;

    if (!targetNodeInNextSnapshot) {
      console.error(
        `[MultiInputActions:updateNodeInputConnectionOrder] 在 nextSnapshot 中未找到节点 ${nodeId}。`
      );
      return;
    }

    targetNodeInNextSnapshot.data = targetNodeInNextSnapshot.data || {};
    targetNodeInNextSnapshot.data.inputConnectionOrders =
      targetNodeInNextSnapshot.data.inputConnectionOrders || {};
    targetNodeInNextSnapshot.data.inputConnectionOrders[handleKey] = newOrderedEdgeIds;

    try {
      await workflowStore.updateNodeInputConnectionOrderAndRecordOnly(
        tabId,
        nodeId,
        handleKey,
        newOrderedEdgeIds,
        entry
      );
    } catch (error) {
      console.error("[MultiInputActions:updateNodeInputConnectionOrder] 更新失败:", error);
    }
  }

  /**
   * (Migrated from useWorkflowInteractionCoordinator)
   * Handles disconnecting an edge from an input, updating inputConnectionOrders if it's a multi-input.
   */
  async function disconnectEdgeFromMultiInput(
    edgeId: string,
    originalTargetNodeId: string,
    originalTargetHandleId: string,
    entry: HistoryEntry // Caller (coordinator) prepares the full entry
  ) {
    if (!activeTabId.value) {
      console.error("[MultiInputActions:disconnectEdgeFromMultiInput] No active tab ID.");
      return;
    }
    const tabId = activeTabId.value;

    const currentSnapshot = getCurrentSnapshotLocal(tabId);
    if (!currentSnapshot) {
      console.error(
        `[MultiInputActions:disconnectEdgeFromMultiInput] 无法获取标签页 ${tabId} 的当前快照。`
      );
      return;
    }

    const edgeToRemove = currentSnapshot.elements.find(
      (el) => el.id === edgeId && "source" in el
    ) as Edge | undefined;

    if (!edgeToRemove) {
      console.warn(
        `[MultiInputActions:disconnectEdgeFromMultiInput] 未找到要断开的边 ${edgeId}。跳过。`
      );
      return;
    }
    if (
      edgeToRemove.target !== originalTargetNodeId ||
      edgeToRemove.targetHandle !== originalTargetHandleId
    ) {
      console.warn(
        `[MultiInputActions:disconnectEdgeFromMultiInput] 边 ${edgeId} 的当前目标与提供的原始目标不匹配。跳过。`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    nextSnapshot.elements = nextSnapshot.elements.filter((el) => el.id !== edgeId);

    const { originalKey: targetOriginalKey } = parseSubHandleId(originalTargetHandleId); // GUGU: Use imported parseSubHandleId
    const targetNodeInNextSnapshot = nextSnapshot.elements.find(
      (el) => el.id === originalTargetNodeId && !("source" in el)
    ) as VueFlowNode | undefined;

    if (targetNodeInNextSnapshot?.data?.inputConnectionOrders?.[targetOriginalKey]) {
      const oldOrder = targetNodeInNextSnapshot.data.inputConnectionOrders[targetOriginalKey] as string[];
      const newOrder = oldOrder.filter((id: string) => id !== edgeId);
      targetNodeInNextSnapshot.data.inputConnectionOrders[targetOriginalKey] = newOrder;

      // 更新剩余连接的 targetHandle
      newOrder.forEach((edgeInOrderId, indexInOrder) => {
        const edgeToUpdate = nextSnapshot.elements.find(
          (el) => el.id === edgeInOrderId && "source" in el
        ) as Edge | undefined;
        if (edgeToUpdate) {
          edgeToUpdate.targetHandle = `${targetOriginalKey}__${indexInOrder}`;
        }
      });

      // 同步 .value 数组的长度
      if (targetNodeInNextSnapshot.data) {
        if (!targetNodeInNextSnapshot.data.inputs) {
          targetNodeInNextSnapshot.data.inputs = {};
        }
        if (!targetNodeInNextSnapshot.data.inputs[targetOriginalKey]) {
          targetNodeInNextSnapshot.data.inputs[targetOriginalKey] = {};
        }
        targetNodeInNextSnapshot.data.inputs[targetOriginalKey].value = new Array(newOrder.length).fill(undefined);
      }

      if (newOrder.length === 0) {
        delete targetNodeInNextSnapshot.data.inputConnectionOrders[targetOriginalKey];
        if (Object.keys(targetNodeInNextSnapshot.data.inputConnectionOrders).length === 0) {
          delete targetNodeInNextSnapshot.data.inputConnectionOrders;
        }
        // 如果 inputConnectionOrders[targetOriginalKey] 被删除，也清理对应的 .value（如果存在）
        if (targetNodeInNextSnapshot.data?.inputs?.[targetOriginalKey]) {
          delete targetNodeInNextSnapshot.data.inputs[targetOriginalKey].value;
          if (Object.keys(targetNodeInNextSnapshot.data.inputs[targetOriginalKey]).length === 0) {
            delete targetNodeInNextSnapshot.data.inputs[targetOriginalKey];
          }
          if (Object.keys(targetNodeInNextSnapshot.data.inputs).length === 0) {
            delete targetNodeInNextSnapshot.data.inputs;
          }
        }
      }
    }

    try {
      await workflowStore.applyElementChangesAndRecordHistory(
        tabId,
        nextSnapshot.elements,
        entry
      );
    } catch (error) {
      console.error("[MultiInputActions:disconnectEdgeFromMultiInput] 更新失败:", error);
    }
  }

  /**
   * (Migrated from useWorkflowInteractionCoordinator)
   * Handles connecting an edge to an input, updating inputConnectionOrders if it's a multi-input.
   * Assumes newEdgeParams.targetHandle already has the correct __index if connecting to multi-input.
   */
  async function connectEdgeToMultiInput(
    newEdgeParams: Edge,
    targetIndexInOrder: number | undefined,
    entry: HistoryEntry
  ) {
    console.debug(`[DEBUG-MI] connectEdgeToMultiInput: Entry. Edge ID: ${newEdgeParams.id}, Target Node: ${newEdgeParams.target}, Target Handle (sub-handle): ${newEdgeParams.targetHandle}, TargetIndexInOrder: ${targetIndexInOrder}`);
    if (!activeTabId.value) {
      console.error("[DEBUG-MI] connectEdgeToMultiInput: No active tab ID.");
      return;
    }
    const tabId = activeTabId.value;

    const currentSnapshot = getCurrentSnapshotLocal(tabId);
    if (!currentSnapshot) {
      console.error(
        `[MultiInputActions:connectEdgeToMultiInput] 无法获取标签页 ${tabId} 的当前快照。`
      );
      return;
    }

    if (currentSnapshot.elements.some((el: any) => el && el.id === newEdgeParams.id)) {
      console.warn(
        `[MultiInputActions:connectEdgeToMultiInput] 边 ${newEdgeParams.id} 已存在。跳过。`
      );
      return;
    }

    let nextSnapshot = klona(currentSnapshot);
    const newEdge: Edge = klona(newEdgeParams);
    nextSnapshot.elements.push(newEdge);

    const targetNodeInNextSnapshot = nextSnapshot.elements.find(
      (el: any) => el && el.id === newEdgeParams.target && !("source" in el)
    ) as VueFlowNode | undefined;

    if (targetNodeInNextSnapshot && newEdgeParams.targetHandle) {
      const { originalKey: targetOriginalKey } = parseSubHandleId(newEdgeParams.targetHandle); // GUGU: Use imported parseSubHandleId
      console.debug(`[DEBUG-MI] connectEdgeToMultiInput: TargetOriginalKey: ${targetOriginalKey}`);
      if (typeof targetIndexInOrder === "number" && targetOriginalKey) {
        targetNodeInNextSnapshot.data = targetNodeInNextSnapshot.data || {};
        targetNodeInNextSnapshot.data.inputConnectionOrders =
          targetNodeInNextSnapshot.data.inputConnectionOrders || {};
        const currentOrder =
          targetNodeInNextSnapshot.data.inputConnectionOrders[targetOriginalKey] || [];
        console.debug(`[DEBUG-MI] connectEdgeToMultiInput: Current order for ${targetOriginalKey}:`, JSON.parse(JSON.stringify(currentOrder)));

        const newOrder = [...currentOrder];
        if (!newOrder.includes(newEdge.id)) {
            // Ensure targetIndexInOrder is valid for splice
            const validIndex = Math.max(0, Math.min(targetIndexInOrder, newOrder.length));
            newOrder.splice(validIndex, 0, newEdge.id);
            console.debug(`[DEBUG-MI] connectEdgeToMultiInput: Splicing new edge ${newEdge.id} at index ${validIndex}.`);
        } else {
            console.warn(`[DEBUG-MI] connectEdgeToMultiInput: Edge ID ${newEdge.id} already in order for ${targetOriginalKey}. Re-inserting.`);
            const existingIdx = newOrder.indexOf(newEdge.id);
            if (existingIdx !== -1) newOrder.splice(existingIdx, 1);
            // Ensure targetIndexInOrder is valid for splice
            const validIndex = Math.max(0, Math.min(targetIndexInOrder, newOrder.length));
            newOrder.splice(validIndex, 0, newEdge.id);
            console.debug(`[DEBUG-MI] connectEdgeToMultiInput: Re-splicing edge ${newEdge.id} at index ${validIndex}.`);
        }
        targetNodeInNextSnapshot.data.inputConnectionOrders[targetOriginalKey] = newOrder;
        console.debug(`[DEBUG-MI] connectEdgeToMultiInput: New order for ${targetOriginalKey}:`, JSON.parse(JSON.stringify(newOrder)));

        newOrder.forEach((edgeInOrderId, indexInOrder) => {
          const edgeToUpdate = nextSnapshot.elements.find(
            (el: any) => el && el.id === edgeInOrderId && "source" in el
          ) as Edge | undefined;
          if (edgeToUpdate) {
            edgeToUpdate.targetHandle = `${targetOriginalKey}__${indexInOrder}`;
          }
        });
        
        if (targetNodeInNextSnapshot.data) {
            if (!targetNodeInNextSnapshot.data.inputs) targetNodeInNextSnapshot.data.inputs = {};
            if (!targetNodeInNextSnapshot.data.inputs[targetOriginalKey]) targetNodeInNextSnapshot.data.inputs[targetOriginalKey] = {};
            targetNodeInNextSnapshot.data.inputs[targetOriginalKey]!.value = new Array(newOrder.length).fill(undefined);
            console.debug(`[DEBUG-MI] connectEdgeToMultiInput: Synced inputs[${targetOriginalKey}].value array length to ${newOrder.length}`);
        }
      }
    }

    // Handle CONVERTIBLE_ANY type change
    let elementsAfterTypeChange = nextSnapshot.elements;
    let workflowDataAfterTypeChange = nextSnapshot.workflowData; // Can be WorkflowObject | null | undefined from snapshot

    if (!workflowDataAfterTypeChange) { // Check for null or undefined first
      console.error("[MultiInputActions:connectEdgeToMultiInput] Critical: nextSnapshot.workflowData is null or undefined. Skipping type change handling.");
    } else if (!workflowDataAfterTypeChange.id) { // Then check for id if workflowData object exists
      console.error("[MultiInputActions:connectEdgeToMultiInput] Critical: nextSnapshot.workflowData is missing an ID. Skipping type change handling.");
    } else {
      // Only call if workflowData and its id are valid
      // At this point, workflowDataAfterTypeChange is WorkflowObject & { id: string }
      const { updatedElements, updatedWorkflowData } = await handleConvertibleAnyTypeChange(
        newEdgeParams.source,
        newEdgeParams.sourceHandle,
        newEdgeParams.target,
        newEdgeParams.targetHandle,
        nextSnapshot.elements as VueFlowNode[],
        workflowDataAfterTypeChange as (WorkflowObject & { id: string }), // Safe to cast due to checks
        tabId
      );
      elementsAfterTypeChange = updatedElements;
      if (updatedWorkflowData !== undefined) { // updatedWorkflowData is (WorkflowObject & { id: string }) | undefined
        workflowDataAfterTypeChange = updatedWorkflowData;
      }
    }
    nextSnapshot.elements = elementsAfterTypeChange;
    nextSnapshot.workflowData = workflowDataAfterTypeChange; // Assign back potentially modified or original (if skipped)
    // Preserve viewport
    if (!nextSnapshot.viewport && currentSnapshot.viewport) {
      nextSnapshot.viewport = klona(currentSnapshot.viewport);
    }

    try {
      const elementsChanged = JSON.stringify(currentSnapshot.elements) !== JSON.stringify(nextSnapshot.elements);
      const workflowDataChanged = JSON.stringify(currentSnapshot.workflowData) !== JSON.stringify(nextSnapshot.workflowData);

      if (elementsChanged || workflowDataChanged) {
        // Apply the complete next state to the workflowManager if there are any changes.
        // This ensures the manager's reactive state is fully up-to-date before history recording.
        // applyStateSnapshot in workflowManager typically does not record history itself.
        workflowManager.applyStateSnapshot(tabId, nextSnapshot);
      }

      // Record the history for the primary action.
      // Note: This 'entry' might not fully describe all changes if handleConvertibleAnyTypeChange
      // made extensive modifications (especially to workflowData or other elements).
      // This is a limitation of the current history pattern if 'entry' isn't updated.
      await workflowStore.applyElementChangesAndRecordHistory(
        tabId,
        nextSnapshot.elements, // Elements are already consistent in the manager due to the call above
        entry
      );
    } catch (error) {
      console.error("[DEBUG-MI] connectEdgeToMultiInput: 更新失败:", error);
    }
  }

  /**
   * (Migrated from useWorkflowInteractionCoordinator)
   * Handles moving and reconnecting an edge, updating inputConnectionOrders for multi-inputs.
   * Assumes newTargetHandleId has the correct __index if connecting to multi-input.
   */
  async function moveAndReconnectEdgeMultiInput(
    edgeToMoveId: string,
    originalTargetNodeId: string,
    originalTargetHandleId: string,
    newSourceNodeId: string,
    newSourceHandleId: string | undefined,
    newTargetNodeId: string,
    newTargetHandleId: string | undefined,
    newTargetIndexInOrder: number | undefined,
    entry: HistoryEntry
  ) {
    console.debug(`[DEBUG-MI] moveAndReconnectEdgeMultiInput: Entry. Edge: ${edgeToMoveId}, OldTarget: ${originalTargetNodeId}::${originalTargetHandleId}, NewTarget: ${newTargetNodeId}::${newTargetHandleId}, NewIndex: ${newTargetIndexInOrder}`);
    if (!activeTabId.value) {
      console.error("[DEBUG-MI] moveAndReconnectEdgeMultiInput: No active tab ID.");
      return;
    }
    const tabId = activeTabId.value;

    // Roo: Extract CONVERTIBLE_ANY related info from history entry details
    const modifiedSlotInfoFromHistory = entry.details?.modifiedSlotInfo as ({ nodeId: string, handleKey: string, newDefinition: GroupSlotInfo, direction: 'inputs' | 'outputs' }) | undefined;
    const interfaceUpdateResultFromHistory = entry.details?.interfaceUpdateResult as ({ inputs: Record<string, GroupSlotInfo>, outputs: Record<string, GroupSlotInfo> }) | undefined;
    const newEdgeDataFromHistory = entry.details?.newEdgeData as ({ sourceType: DataFlowTypeName, targetType: DataFlowTypeName }) | undefined;

    const currentSnapshot = getCurrentSnapshotLocal(tabId);
    if (!currentSnapshot) {
      console.error(
        `[MultiInputActions:moveAndReconnectEdgeMultiInput] 无法获取标签页 ${tabId} 的当前快照。`
      );
      return;
    }

    const edgeIndexInCurrent = currentSnapshot.elements.findIndex((el: any) => el && el.id === edgeToMoveId && "source" in el);
    if (edgeIndexInCurrent === -1) {
      console.warn(
        `[MultiInputActions:moveAndReconnectEdgeMultiInput] 未找到要移动的边 ${edgeToMoveId}。跳过。`
      );
      return;
    }

    let nextSnapshot = klona(currentSnapshot);

    // Apply node slot updates from history if present
    if (modifiedSlotInfoFromHistory) {
      const nodeToUpdateInSnapshot = nextSnapshot.elements.find(
        (el) => el.id === modifiedSlotInfoFromHistory.nodeId && !("source" in el)
      ) as VueFlowNode | undefined;
      if (nodeToUpdateInSnapshot) {
        nodeToUpdateInSnapshot.data = nodeToUpdateInSnapshot.data || {};
        if (modifiedSlotInfoFromHistory.direction === 'inputs') {
          nodeToUpdateInSnapshot.data.inputs = nodeToUpdateInSnapshot.data.inputs || {};
          nodeToUpdateInSnapshot.data.inputs[modifiedSlotInfoFromHistory.handleKey] = klona(modifiedSlotInfoFromHistory.newDefinition);
        } else { // outputs
          nodeToUpdateInSnapshot.data.outputs = nodeToUpdateInSnapshot.data.outputs || {};
          nodeToUpdateInSnapshot.data.outputs[modifiedSlotInfoFromHistory.handleKey] = klona(modifiedSlotInfoFromHistory.newDefinition);
        }
      } else {
        console.warn(`[MultiInputActions:moveAndReconnectEdgeMultiInput] Node ${modifiedSlotInfoFromHistory.nodeId} for slot update not found in snapshot.`);
      }
    }

    // Apply workflow interface updates from history if present
    if (interfaceUpdateResultFromHistory) {
      if (!nextSnapshot.workflowData) {
        // Initialize workflowData if it's null/undefined, which shouldn't happen for an existing workflow
        console.warn("[MultiInputActions:moveAndReconnectEdgeMultiInput] nextSnapshot.workflowData is null/undefined. Initializing.");
        nextSnapshot.workflowData = { id: `wf-${Date.now()}`, name: "Untitled Workflow", nodes: [], edges: [], viewport: { x:0, y:0, zoom:1 }, interfaceInputs: {}, interfaceOutputs: {} };
      }
      if (Object.keys(interfaceUpdateResultFromHistory.inputs).length > 0) {
        nextSnapshot.workflowData.interfaceInputs = klona(interfaceUpdateResultFromHistory.inputs);
      }
      if (Object.keys(interfaceUpdateResultFromHistory.outputs).length > 0) {
        nextSnapshot.workflowData.interfaceOutputs = klona(interfaceUpdateResultFromHistory.outputs);
      }
    }

    // Remove from old multi-input order if applicable
    const { originalKey: oldTargetOriginalKey } = parseSubHandleId(originalTargetHandleId); // GUGU: Use imported parseSubHandleId
    const originalTargetNodeInNext = nextSnapshot.elements.find(
      (el: any) => el && el.id === originalTargetNodeId && !("source" in el)
    ) as VueFlowNode | undefined;

    if (oldTargetOriginalKey && originalTargetNodeInNext?.data?.inputConnectionOrders?.[oldTargetOriginalKey]) {
      const oldOrder = originalTargetNodeInNext.data.inputConnectionOrders[oldTargetOriginalKey] as string[];
      console.debug(`[DEBUG-MI] moveAndReconnectEdgeMultiInput: Old target ${originalTargetNodeId}::${oldTargetOriginalKey} - oldOrder:`, JSON.parse(JSON.stringify(oldOrder)));
      const newOrderForOldTarget = oldOrder.filter((id: string) => id !== edgeToMoveId);
      if (newOrderForOldTarget.length !== oldOrder.length) {
        originalTargetNodeInNext.data.inputConnectionOrders[oldTargetOriginalKey] = newOrderForOldTarget;
        console.debug(`[DEBUG-MI] moveAndReconnectEdgeMultiInput: Old target ${originalTargetNodeId}::${oldTargetOriginalKey} - newOrderForOldTarget (after removal):`, JSON.parse(JSON.stringify(newOrderForOldTarget)));
        newOrderForOldTarget.forEach((edgeInOrderId, indexInOrder) => {
          const edgeToUpdate = nextSnapshot.elements.find(
            (el: any) => el && el.id === edgeInOrderId && "source" in el
          ) as Edge | undefined;
          if (edgeToUpdate) {
            edgeToUpdate.targetHandle = `${oldTargetOriginalKey}__${indexInOrder}`;
          }
        });
        if (originalTargetNodeInNext.data) {
            if(!originalTargetNodeInNext.data.inputs) originalTargetNodeInNext.data.inputs = {};
            if(!originalTargetNodeInNext.data.inputs[oldTargetOriginalKey]) originalTargetNodeInNext.data.inputs[oldTargetOriginalKey] = {};
            originalTargetNodeInNext.data.inputs[oldTargetOriginalKey]!.value = new Array(newOrderForOldTarget.length).fill(undefined);
            console.debug(`[DEBUG-MI] moveAndReconnectEdgeMultiInput: Old target ${originalTargetNodeId}::${oldTargetOriginalKey} - synced .value array length to ${newOrderForOldTarget.length}`);
        }
        if (newOrderForOldTarget.length === 0) {
            if(originalTargetNodeInNext.data.inputConnectionOrders) delete originalTargetNodeInNext.data.inputConnectionOrders[oldTargetOriginalKey];
            if(originalTargetNodeInNext.data.inputConnectionOrders && Object.keys(originalTargetNodeInNext.data.inputConnectionOrders).length === 0) delete originalTargetNodeInNext.data.inputConnectionOrders;
            if(originalTargetNodeInNext.data.inputs?.[oldTargetOriginalKey]) {
                delete originalTargetNodeInNext.data.inputs[oldTargetOriginalKey]!.value;
                 if(Object.keys(originalTargetNodeInNext.data.inputs[oldTargetOriginalKey]!).length === 0) delete originalTargetNodeInNext.data.inputs[oldTargetOriginalKey];
                 if(Object.keys(originalTargetNodeInNext.data.inputs).length === 0) delete originalTargetNodeInNext.data.inputs;
            }
        }
      }
    }

    // Update the edge itself
    const edgeToUpdateInNext = nextSnapshot.elements.find(
      (el: any) => el && el.id === edgeToMoveId && "source" in el
    ) as Edge | undefined;

    if (!edgeToUpdateInNext) {
      console.error(`[MultiInputActions:moveAndReconnectEdgeMultiInput] 在 nextSnapshot 中未找到边 ${edgeToMoveId}。`);
      return;
    }
    
    if (newTargetNodeId && newTargetHandleId) { // Reconnecting to a new valid target
        edgeToUpdateInNext.source = newSourceNodeId;
        edgeToUpdateInNext.sourceHandle = newSourceHandleId;
        edgeToUpdateInNext.target = newTargetNodeId;
        // targetHandle will be set correctly when adding to new multi-input order below

        // Roo: Apply new edge data from history if present
        if (newEdgeDataFromHistory) {
          edgeToUpdateInNext.data = { ...edgeToUpdateInNext.data, ...klona(newEdgeDataFromHistory) };
        }

    } else { // Disconnecting (dragging to pane)
        nextSnapshot.elements = nextSnapshot.elements.filter((el: any) => el.id !== edgeToMoveId);
    }


    // Add to new multi-input order if applicable
    if (newTargetNodeId && newTargetHandleId && typeof newTargetIndexInOrder === "number") {
      const { originalKey: newTargetOriginalKey } = parseSubHandleId(newTargetHandleId); // GUGU: Use imported parseSubHandleId
      if (newTargetOriginalKey) {
        const newTargetNodeInNext = nextSnapshot.elements.find(
          (el: any) => el && el.id === newTargetNodeId && !("source" in el)
        ) as VueFlowNode | undefined;

        if (newTargetNodeInNext) {
          newTargetNodeInNext.data = newTargetNodeInNext.data || {};
          newTargetNodeInNext.data.inputConnectionOrders =
            newTargetNodeInNext.data.inputConnectionOrders || {};
          const currentOrderAtNewTarget =
            newTargetNodeInNext.data.inputConnectionOrders[newTargetOriginalKey] || [];
          console.debug(`[DEBUG-MI] moveAndReconnectEdgeMultiInput: New target ${newTargetNodeId}::${newTargetOriginalKey} - currentOrderAtNewTarget:`, JSON.parse(JSON.stringify(currentOrderAtNewTarget)));

          let finalOrderAtNewTarget = [...currentOrderAtNewTarget];
          const existingIdxInNewTarget = finalOrderAtNewTarget.indexOf(edgeToMoveId);
          if (existingIdxInNewTarget !== -1) {
            finalOrderAtNewTarget.splice(existingIdxInNewTarget, 1);
            console.debug(`[DEBUG-MI] moveAndReconnectEdgeMultiInput: Edge ${edgeToMoveId} already in new target's order, removed from old position ${existingIdxInNewTarget}.`);
          }
          // Ensure insertAtIndex is valid
          const validInsertAtIndex = Math.max(0, Math.min(newTargetIndexInOrder, finalOrderAtNewTarget.length));
          finalOrderAtNewTarget.splice(validInsertAtIndex, 0, edgeToMoveId);
          console.debug(`[DEBUG-MI] moveAndReconnectEdgeMultiInput: Splicing edge ${edgeToMoveId} into new target's order at index ${validInsertAtIndex}.`);

          newTargetNodeInNext.data.inputConnectionOrders[newTargetOriginalKey] = finalOrderAtNewTarget;
          console.debug(`[DEBUG-MI] moveAndReconnectEdgeMultiInput: New target ${newTargetNodeId}::${newTargetOriginalKey} - finalOrderAtNewTarget:`, JSON.parse(JSON.stringify(finalOrderAtNewTarget)));

          finalOrderAtNewTarget.forEach((edgeInOrderId, indexInOrder) => {
            const edgeToReindex = nextSnapshot.elements.find(
              (el: any) => el && el.id === edgeInOrderId && "source" in el
            ) as Edge | undefined;
            if (edgeToReindex) {
              edgeToReindex.targetHandle = `${newTargetOriginalKey}__${indexInOrder}`;
            }
          });
          if (newTargetNodeInNext.data) {
            if(!newTargetNodeInNext.data.inputs) newTargetNodeInNext.data.inputs = {};
            if(!newTargetNodeInNext.data.inputs[newTargetOriginalKey]) newTargetNodeInNext.data.inputs[newTargetOriginalKey] = {};
            newTargetNodeInNext.data.inputs[newTargetOriginalKey]!.value = new Array(finalOrderAtNewTarget.length).fill(undefined);
            console.debug(`[DEBUG-MI] moveAndReconnectEdgeMultiInput: New target ${newTargetNodeId}::${newTargetOriginalKey} - synced .value array length to ${finalOrderAtNewTarget.length}`);
          }
        }
      }
    } else if (newTargetNodeId && newTargetHandleId && edgeToUpdateInNext) { // Connecting to a single input slot
        edgeToUpdateInNext.targetHandle = newTargetHandleId;
    }

// Roo: Remove the internal call to handleConvertibleAnyTypeChange as it's now pre-handled by onEdgeUpdateEnd
// // Handle CONVERTIBLE_ANY type change
// if (newTargetNodeId && newTargetHandleId) { // Only if reconnecting
//     let elementsAfterTypeChangeOnMove = nextSnapshot.elements;
//     let workflowDataAfterTypeChangeOnMove = nextSnapshot.workflowData;
//     // ... (rest of the original handleConvertibleAnyTypeChange call) ...
//     nextSnapshot.elements = elementsAfterTypeChangeOnMove;
//     nextSnapshot.workflowData = workflowDataAfterTypeChangeOnMove;
// }

// Preserve viewport
    // Preserve viewport
    if (!nextSnapshot.viewport && currentSnapshot.viewport) {
        nextSnapshot.viewport = klona(currentSnapshot.viewport);
    }

    try {
      const elementsChanged = JSON.stringify(currentSnapshot.elements) !== JSON.stringify(nextSnapshot.elements);
      const workflowDataChanged = JSON.stringify(currentSnapshot.workflowData) !== JSON.stringify(nextSnapshot.workflowData);

      if (elementsChanged || workflowDataChanged) {
        // Apply the complete next state to the workflowManager if there are any changes.
        workflowManager.applyStateSnapshot(tabId, nextSnapshot);
      }

      // Record the history for the primary action.
      await workflowStore.applyElementChangesAndRecordHistory(
        tabId,
        nextSnapshot.elements, // Elements are already consistent in the manager
        entry
      );
    } catch (error) {
      console.error("[DEBUG-MI] moveAndReconnectEdgeMultiInput: 更新失败:", error);
    }
  }


  // Helper function to get slot definition
  function getSlotDefinition(
    node: VueFlowNode,
    handleId: string | null | undefined,
    handleType: 'source' | 'target',
    currentWorkflowData?: WorkflowObject | undefined // Changed type
  ): InputDefinition | OutputDefinition | GroupSlotInfo | undefined { // Changed return type
    if (!handleId) return undefined;

    const { originalKey: slotKey } = parseSubHandleId(handleId); // GUGU: Use imported parseSubHandleId
    if (!slotKey) return undefined;

    const nodeType = getNodeType(node);
    const nodeData = node.data as NodeInstanceData; // Use local NodeInstanceData type

    if (handleType === 'source') { // Output slot
      if (nodeType === 'core:GroupInput') {
        // GroupInput's outputs are defined in the workflow's interfaceInputs
        return currentWorkflowData?.interfaceInputs?.[slotKey];
      } else if (nodeType === 'core:NodeGroup') {
        return nodeData?.groupInterface?.outputs?.[slotKey];
      } else {
        return nodeData?.outputs?.[slotKey] as OutputDefinition | undefined; // Cast for clarity
      }
    } else { // Input slot
      if (nodeType === 'core:GroupOutput') {
        // GroupOutput's inputs are defined in the workflow's interfaceOutputs
        return currentWorkflowData?.interfaceOutputs?.[slotKey];
      } else if (nodeType === 'core:NodeGroup') {
        return nodeData?.groupInterface?.inputs?.[slotKey];
      } else {
        return nodeData?.inputs?.[slotKey] as InputDefinition | undefined; // Cast for clarity
      }
    }
  }

  async function handleConvertibleAnyTypeChange(
    sourceNodeId: string,
    sourceHandleId: string | null | undefined,
    targetNodeId: string,
    targetHandleId: string | null | undefined,
    currentSnapshotElements: VueFlowNode[],
    currentWorkflowData: (WorkflowObject & { id: string }) | undefined, // Expect id if object is provided
    activeTabIdString: string
  ): Promise<{ updatedElements: VueFlowNode[]; updatedWorkflowData: (WorkflowObject & { id: string }) | undefined }> { // Return type guarantees id if object
    const elementsCopy = klona(currentSnapshotElements);
    let workflowDataCopy: (WorkflowObject & { id: string }) | undefined = currentWorkflowData ? klona(currentWorkflowData) : undefined;

    const sourceNode = elementsCopy.find(n => n.id === sourceNodeId);
    const targetNode = elementsCopy.find(n => n.id === targetNodeId);

    if (!sourceNode || !targetNode) return { updatedElements: elementsCopy, updatedWorkflowData: workflowDataCopy };

    const sourceSlotDef = getSlotDefinition(sourceNode, sourceHandleId, 'source', workflowDataCopy);
    const targetSlotDef = getSlotDefinition(targetNode, targetHandleId, 'target', workflowDataCopy);

    if (!sourceSlotDef || !targetSlotDef) return { updatedElements: elementsCopy, updatedWorkflowData: workflowDataCopy };

    let nodeToUpdate: VueFlowNode | undefined;
    let keyOfSlotOnUpdatedNode: string | undefined; // Renamed for clarity
    let newType: DataFlowTypeName | undefined;
    let newCategories: string[] | undefined;
    let isSourceNodeBeingUpdated = false;

    const isSourceConvertible = sourceSlotDef.dataFlowType === DataFlowType.CONVERTIBLE_ANY || sourceSlotDef.matchCategories?.includes(BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);
    const isTargetConvertible = targetSlotDef.dataFlowType === DataFlowType.CONVERTIBLE_ANY || targetSlotDef.matchCategories?.includes(BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);

    if (isSourceConvertible && !isTargetConvertible && targetSlotDef.dataFlowType !== DataFlowType.WILDCARD && targetSlotDef.dataFlowType !== DataFlowType.CONVERTIBLE_ANY) {
      nodeToUpdate = sourceNode;
      keyOfSlotOnUpdatedNode = parseSubHandleId(sourceHandleId).originalKey; // GUGU: Use imported parseSubHandleId
      newType = targetSlotDef.dataFlowType;
      newCategories = targetSlotDef.matchCategories?.filter(cat => cat !== BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE && cat !== BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD) || [];
      isSourceNodeBeingUpdated = true;
    } else if (isTargetConvertible && !isSourceConvertible && sourceSlotDef.dataFlowType !== DataFlowType.WILDCARD && sourceSlotDef.dataFlowType !== DataFlowType.CONVERTIBLE_ANY) {
      nodeToUpdate = targetNode;
      keyOfSlotOnUpdatedNode = parseSubHandleId(targetHandleId).originalKey; // GUGU: Use imported parseSubHandleId
      newType = sourceSlotDef.dataFlowType;
      newCategories = sourceSlotDef.matchCategories?.filter(cat => cat !== BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE && cat !== BuiltInSocketMatchCategory.BEHAVIOR_WILDCARD) || [];
      isSourceNodeBeingUpdated = false;
    } else {
      return { updatedElements: elementsCopy, updatedWorkflowData: workflowDataCopy };
    }

    if (!nodeToUpdate || !keyOfSlotOnUpdatedNode || !newType) {
      return { updatedElements: elementsCopy, updatedWorkflowData: workflowDataCopy };
    }

    const nodeToUpdateInCopy = elementsCopy.find(n => n.id === nodeToUpdate!.id);
    if (!nodeToUpdateInCopy) return { updatedElements: elementsCopy, updatedWorkflowData: workflowDataCopy };
    
    const nodeDataToUpdate = nodeToUpdateInCopy.data as NodeInstanceData; // Use local type

    const nodeType = getNodeType(nodeToUpdateInCopy);
    let slotDefinitionToUpdate: InputDefinition | OutputDefinition | GroupSlotInfo | undefined;

    if (nodeType === 'core:NodeGroup') {
      const interfaceKey = isSourceNodeBeingUpdated ? 'outputs' : 'inputs';
      if (nodeDataToUpdate.groupInterface && nodeDataToUpdate.groupInterface[interfaceKey]) {
        slotDefinitionToUpdate = nodeDataToUpdate.groupInterface[interfaceKey]![keyOfSlotOnUpdatedNode];
      }
      if (slotDefinitionToUpdate) {
        (slotDefinitionToUpdate as GroupSlotInfo).dataFlowType = newType; // Cast to GroupSlotInfo for safety
        (slotDefinitionToUpdate as GroupSlotInfo).matchCategories = newCategories;
        // Add new convertible_any placeholder to NodeGroup's groupInterface
        const groupInterfaceSlots = nodeDataToUpdate.groupInterface![interfaceKey]!;
        let newConvKeyIndex = 0;
        let nextConvKey = `${interfaceKey === 'inputs' ? 'input' : 'output'}_conv_${newConvKeyIndex}`;
        while(groupInterfaceSlots[nextConvKey]) {
          newConvKeyIndex++;
          nextConvKey = `${interfaceKey === 'inputs' ? 'input' : 'output'}_conv_${newConvKeyIndex}`;
        }
        groupInterfaceSlots[nextConvKey] = {
          key: nextConvKey, // GroupSlotInfo requires key
          displayName: '*',
          dataFlowType: DataFlowType.CONVERTIBLE_ANY,
          matchCategories: [BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE],
          customDescription: '自动生成的备用可转换插槽 (组接口)',
        } as GroupSlotInfo; // Ensure it conforms to GroupSlotInfo
      }
    } else if (nodeType === 'core:GroupInput' && isSourceNodeBeingUpdated) {
      if (nodeDataToUpdate.outputs) {
        slotDefinitionToUpdate = nodeDataToUpdate.outputs[keyOfSlotOnUpdatedNode];
      }
      if (slotDefinitionToUpdate) {
        (slotDefinitionToUpdate as OutputDefinition).dataFlowType = newType;
        (slotDefinitionToUpdate as OutputDefinition).matchCategories = newCategories;

        const { syncInterfaceSlotFromConnection } = useGroupInterfaceSync();
        // Create a GroupSlotInfo-like object for syncInterfaceSlotFromConnection
        const updatedSlotInfoForSync: GroupSlotInfo = {
          key: keyOfSlotOnUpdatedNode,
          displayName: slotDefinitionToUpdate.displayName || keyOfSlotOnUpdatedNode,
          dataFlowType: newType,
          matchCategories: newCategories,
          // required, config, multi, allowDynamicType might need to be sourced or defaulted
        };
        const syncedInterfaces = syncInterfaceSlotFromConnection(activeTabIdString, nodeToUpdateInCopy.id, keyOfSlotOnUpdatedNode, updatedSlotInfoForSync, 'inputs');
        if (syncedInterfaces) {
          if (workflowDataCopy) {
            workflowDataCopy.interfaceInputs = syncedInterfaces.inputs;
          } else if (workflowDataCopy !== null) { // Create new if undefined, but not if explicitly null
            workflowDataCopy = {
              id: `temp-wf-gi-${Date.now()}`, // Ensure unique and descriptive temp ID
              name: 'Temporary Workflow Data (GroupInput Sync)', // Ensure name is present
              nodes: [], // Ensure nodes is present
              edges: [], // Ensure edges is present
              viewport: { x: 0, y: 0, zoom: 1 }, // Ensure viewport is present
              interfaceInputs: syncedInterfaces.inputs,
              interfaceOutputs: {},
            } as (WorkflowObject & { id: string }); // Assert type for the new object
          }
        }
      }
    } else if (nodeType === 'core:GroupOutput' && !isSourceNodeBeingUpdated) {
      if (nodeDataToUpdate.inputs) {
        slotDefinitionToUpdate = nodeDataToUpdate.inputs[keyOfSlotOnUpdatedNode];
      }
      if (slotDefinitionToUpdate) {
        (slotDefinitionToUpdate as InputDefinition).dataFlowType = newType;
        (slotDefinitionToUpdate as InputDefinition).matchCategories = newCategories;

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
          } else if (workflowDataCopy === undefined) { // Explicitly check for undefined
             workflowDataCopy = {
               id: `temp-wf-go-${Date.now()}`, // Ensure unique and descriptive temp ID
               name: 'Temporary Workflow Data (GroupOutput Sync)', // Ensure name is present
               nodes: [], // Ensure nodes is present
               edges: [], // Ensure edges is present
               viewport: { x: 0, y: 0, zoom: 1 }, // Ensure viewport is present
               interfaceInputs: {},
               interfaceOutputs: syncedInterfaces.outputs,
             } as (WorkflowObject & { id: string }); // Assert type for the new object
          }
        }
      }
    } else { // Regular node
      const dictKey = isSourceNodeBeingUpdated ? 'outputs' : 'inputs';
      if (nodeDataToUpdate[dictKey]) {
        slotDefinitionToUpdate = nodeDataToUpdate[dictKey]![keyOfSlotOnUpdatedNode];
      }
      if (slotDefinitionToUpdate) {
        // Standard type and category updates
        slotDefinitionToUpdate.dataFlowType = newType;
        slotDefinitionToUpdate.matchCategories = newCategories;
        
        // Mark as no longer dynamically typed
        if ('allowDynamicType' in slotDefinitionToUpdate) {
          (slotDefinitionToUpdate as (InputDefinition | OutputDefinition | GroupSlotInfo)).allowDynamicType = false;
        }

        const slotToCopyFrom = isSourceNodeBeingUpdated ? targetSlotDef : sourceSlotDef;

        // Copy displayName
        if (slotToCopyFrom.displayName) {
          slotDefinitionToUpdate.displayName = slotToCopyFrom.displayName;
        }

        // Copy description (handling different property names)
        let descriptionToCopy: string | undefined;
        if ('description' in slotToCopyFrom && typeof slotToCopyFrom.description === 'string') {
          descriptionToCopy = slotToCopyFrom.description;
        } else if ('customDescription' in slotToCopyFrom && typeof slotToCopyFrom.customDescription === 'string') {
          descriptionToCopy = slotToCopyFrom.customDescription;
        }

        if (descriptionToCopy !== undefined) {
          if ('description' in slotDefinitionToUpdate) {
            (slotDefinitionToUpdate as InputDefinition | OutputDefinition).description = descriptionToCopy;
          } else if ('customDescription' in slotDefinitionToUpdate) {
            (slotDefinitionToUpdate as GroupSlotInfo).customDescription = descriptionToCopy;
          }
        }

        // Copy config object (deep clone)
        // Copy config object (deep clone)
        // slotDefinitionToUpdate (the CONVERTIBLE_ANY slot) adopts config from slotToCopyFrom.
        if ('config' in slotToCopyFrom && (slotToCopyFrom as InputDefinition | GroupSlotInfo).config !== undefined) {
          // Source has a config, so the CONVERTIBLE_ANY slot should adopt it.
          (slotDefinitionToUpdate as any).config = klona((slotToCopyFrom as InputDefinition | GroupSlotInfo).config);
        } else {
          // Source does not have a config (or it's undefined), so remove it from the CONVERTIBLE_ANY slot.
          delete (slotDefinitionToUpdate as any).config;
        }
        
        // Copy min/max: These are direct properties only on GroupSlotInfo.
        // Copy min/max. slotDefinitionToUpdate (the CONVERTIBLE_ANY slot) adopts min/max.
        // Source can be GroupSlotInfo (direct min/max) or InputDefinition (min/max in config).
        let minToApply: number | undefined = undefined;
        let maxToApply: number | undefined = undefined;

        // Check direct properties first (for GroupSlotInfo source)
        if ('min' in slotToCopyFrom && typeof (slotToCopyFrom as GroupSlotInfo).min === 'number') {
            minToApply = (slotToCopyFrom as GroupSlotInfo).min;
        }
        // Then check config (for InputDefinition or GroupSlotInfo source with config)
        else if ('config' in slotToCopyFrom && typeof (slotToCopyFrom as InputDefinition | GroupSlotInfo).config?.min === 'number') {
            // If this branch is taken, .config is guaranteed to exist and .config.min is a number.
            minToApply = (slotToCopyFrom as InputDefinition | GroupSlotInfo).config!.min as number;
        }

        if ('max' in slotToCopyFrom && typeof (slotToCopyFrom as GroupSlotInfo).max === 'number') {
            maxToApply = (slotToCopyFrom as GroupSlotInfo).max;
        }
        else if ('config' in slotToCopyFrom && typeof (slotToCopyFrom as InputDefinition | GroupSlotInfo).config?.max === 'number') {
            // If this branch is taken, .config is guaranteed to exist and .config.max is a number.
            maxToApply = (slotToCopyFrom as InputDefinition | GroupSlotInfo).config!.max as number;
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
        // For regular nodes, we don't add a new CONVERTIBLE_ANY placeholder automatically for now.
      }
    }
    return { updatedElements: elementsCopy, updatedWorkflowData: workflowDataCopy };
  }

  // Return all public methods
  return {
    reorderMultiInputConnections,
    updateNodeInputConnectionOrder,
    disconnectEdgeFromMultiInput,
    connectEdgeToMultiInput,
    moveAndReconnectEdgeMultiInput,
  };
}