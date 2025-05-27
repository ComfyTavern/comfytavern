import { type Ref } from "vue";
import { klona } from "klona/full";
import { useWorkflowStore } from "@/stores/workflowStore";
import type { HistoryEntry } from "@comfytavern/types";
import type { WorkflowStateSnapshot } from "@/types/workflowTypes"; // Corrected import
import { createHistoryEntry } from "@comfytavern/utils";
import type { Edge, Node as VueFlowNode } from '@vue-flow/core';
import { useWorkflowManager } from "@/composables/workflow/useWorkflowManager";
// import { useTabStore } from "@/stores/tabStore"; // No longer needed directly here as activeTabId is passed in

/**
 * Composable for managing actions related to multi-input slot connections,
 * including reordering and updating edge targetHandles, and other migrated multi-input operations.
 */
export function useMultiInputConnectionActions(
  activeTabId: Ref<string | null>
) {
  const workflowStore = useWorkflowStore();
  const workflowManager = useWorkflowManager();

  // Inner helper functions, accessible by all methods returned by this composable
  const parseSubHandleIdLocal = (handleId: string | null | undefined): { originalKey: string; index?: number; isSubHandle: boolean } => {
    if (!handleId) {
      return { originalKey: '', index: undefined, isSubHandle: false };
    }
    const parts = handleId.split('__');
    if (parts.length === 2) {
      const keyPart = parts[0];
      const indexStrPart = parts[1];
      if (typeof keyPart === 'string' && typeof indexStrPart === 'string') {
        const potentialIndex = parseInt(indexStrPart, 10);
        if (!isNaN(potentialIndex)) {
          return { originalKey: keyPart, index: potentialIndex, isSubHandle: true };
        }
      }
    }
    return { originalKey: handleId, index: undefined, isSubHandle: false };
  };

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

    const { originalKey: targetOriginalKey } = parseSubHandleIdLocal(originalTargetHandleId);
    const targetNodeInNextSnapshot = nextSnapshot.elements.find(
      (el) => el.id === originalTargetNodeId && !("source" in el)
    ) as VueFlowNode | undefined;

    if (targetNodeInNextSnapshot?.data?.inputConnectionOrders?.[targetOriginalKey]) {
      const oldOrder = targetNodeInNextSnapshot.data.inputConnectionOrders[targetOriginalKey] as string[];
      const newOrder = oldOrder.filter((id: string) => id !== edgeId);
      targetNodeInNextSnapshot.data.inputConnectionOrders[targetOriginalKey] = newOrder;
      if (newOrder.length === 0) {
          delete targetNodeInNextSnapshot.data.inputConnectionOrders[targetOriginalKey];
          if (Object.keys(targetNodeInNextSnapshot.data.inputConnectionOrders).length === 0) {
              delete targetNodeInNextSnapshot.data.inputConnectionOrders;
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
    if (!activeTabId.value) {
      console.error("[MultiInputActions:connectEdgeToMultiInput] No active tab ID.");
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

    if (currentSnapshot.elements.some((el) => {
      // 首先确保 el 是一个有效的对象
      if (typeof el !== 'object' || el === null) {
        // 如果 el 不是对象（比如是那个污染的字符串ID），它不可能有一个与 newEdgeParams.id 匹配的 id
        // 除非 newEdgeParams.id 也是 undefined，那种情况下 el.id (undefined) === newEdgeParams.id (undefined) 会是 true
        // 我们在这里返回 false 来跳过非对象元素，以避免访问 el.id 导致潜在问题或错误判断
        return false;
      }
      return el.id === newEdgeParams.id;
    })) {
      console.warn(
        `[MultiInputActions:connectEdgeToMultiInput] 边 ${newEdgeParams.id} 已存在。跳过。`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const newEdge: Edge = klona(newEdgeParams); 
    nextSnapshot.elements.push(newEdge);

    const targetNodeInNextSnapshot = nextSnapshot.elements.find(
      (el) => {
        // 防御性检查，确保 el 是一个对象并且不是 null
        // Defensive check to ensure el is an object and not null
        if (typeof el !== 'object' || el === null) {
          console.warn(`[MultiInputActions:connectEdgeToMultiInput] 在快照的 elements 数组中发现非对象元素:`, el);
          return false; // 跳过此无效元素 // Skip this invalid element
        }
        // 原始逻辑：检查 el 是否为目标节点
        // Original logic: check if el is the target node
        // "source" in el 用于区分节点和边（边有 source 属性，节点没有）
        // "source" in el is used to distinguish nodes from edges (edges have source, nodes don't)
        return el.id === newEdgeParams.target && !("source" in el);
      }
    ) as VueFlowNode | undefined;

    if (targetNodeInNextSnapshot && newEdgeParams.targetHandle) {
      const { originalKey: targetOriginalKey } = parseSubHandleIdLocal(newEdgeParams.targetHandle);
      if (typeof targetIndexInOrder === "number" && targetOriginalKey) {
        targetNodeInNextSnapshot.data = targetNodeInNextSnapshot.data || {};
        targetNodeInNextSnapshot.data.inputConnectionOrders =
          targetNodeInNextSnapshot.data.inputConnectionOrders || {};
        const currentOrder =
          targetNodeInNextSnapshot.data.inputConnectionOrders[targetOriginalKey] || [];
        
        const newOrder = [...currentOrder];
        if (!newOrder.includes(newEdge.id)) {
            newOrder.splice(targetIndexInOrder, 0, newEdge.id);
        } else {
            console.warn(`[MultiInputActions:connectEdgeToMultiInput] Edge ID ${newEdge.id} already in order for ${targetOriginalKey}. Re-inserting.`);
            const existingIdx = newOrder.indexOf(newEdge.id);
            if (existingIdx !== -1) newOrder.splice(existingIdx, 1);
            newOrder.splice(targetIndexInOrder, 0, newEdge.id);
        }
        targetNodeInNextSnapshot.data.inputConnectionOrders[targetOriginalKey] = newOrder;
      }
    }

    try {
      await workflowStore.applyElementChangesAndRecordHistory( 
          tabId,
          nextSnapshot.elements,
          entry
      );
    } catch (error) {
      console.error("[MultiInputActions:connectEdgeToMultiInput] 更新失败:", error);
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
    if (!activeTabId.value) {
      console.error("[MultiInputActions:moveAndReconnectEdgeMultiInput] No active tab ID.");
      return;
    }
    const tabId = activeTabId.value;

    const currentSnapshot = getCurrentSnapshotLocal(tabId);
    if (!currentSnapshot) {
      console.error(
        `[MultiInputActions:moveAndReconnectEdgeMultiInput] 无法获取标签页 ${tabId} 的当前快照。`
      );
      return;
    }

    const edgeIndexInCurrent = currentSnapshot.elements.findIndex((el) => el.id === edgeToMoveId && "source" in el);
    if (edgeIndexInCurrent === -1) {
      console.warn(
        `[MultiInputActions:moveAndReconnectEdgeMultiInput] 未找到要移动的边 ${edgeToMoveId}。跳过。`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot);

    const { originalKey: oldTargetOriginalKey } = parseSubHandleIdLocal(originalTargetHandleId);
    const originalTargetNodeInNext = nextSnapshot.elements.find(
      (el) => el.id === originalTargetNodeId && !("source" in el)
    ) as VueFlowNode | undefined;

    if (oldTargetOriginalKey && originalTargetNodeInNext?.data?.inputConnectionOrders?.[oldTargetOriginalKey]) {
      const oldOrder = originalTargetNodeInNext.data.inputConnectionOrders[oldTargetOriginalKey] as string[];
      const newOrder = oldOrder.filter((id: string) => id !== edgeToMoveId);
      if (newOrder.length !== oldOrder.length) {
          originalTargetNodeInNext.data.inputConnectionOrders[oldTargetOriginalKey] = newOrder;
          if (newOrder.length === 0) {
              delete originalTargetNodeInNext.data.inputConnectionOrders[oldTargetOriginalKey];
              if (Object.keys(originalTargetNodeInNext.data.inputConnectionOrders).length === 0) {
                  delete originalTargetNodeInNext.data.inputConnectionOrders;
              }
          }
      }
    }

    const edgeToUpdateInNext = nextSnapshot.elements.find(
      (el) => el.id === edgeToMoveId && "source" in el
    ) as Edge | undefined;

    if (!edgeToUpdateInNext) {
      console.error(`[MultiInputActions:moveAndReconnectEdgeMultiInput] 在 nextSnapshot 中未找到边 ${edgeToMoveId}。`);
      return;
    }
    edgeToUpdateInNext.source = newSourceNodeId;
    edgeToUpdateInNext.sourceHandle = newSourceHandleId;
    edgeToUpdateInNext.target = newTargetNodeId;
    edgeToUpdateInNext.targetHandle = newTargetHandleId;

    if (newTargetHandleId && typeof newTargetIndexInOrder === "number") {
      const { originalKey: newTargetOriginalKey } = parseSubHandleIdLocal(newTargetHandleId);
      if (newTargetOriginalKey) {
        const newTargetNodeInNext = nextSnapshot.elements.find(
          (el) => el.id === newTargetNodeId && !("source" in el)
        ) as VueFlowNode | undefined;

        if (newTargetNodeInNext) {
          newTargetNodeInNext.data = newTargetNodeInNext.data || {};
          newTargetNodeInNext.data.inputConnectionOrders =
            newTargetNodeInNext.data.inputConnectionOrders || {};
          const currentOrderAtNewTarget =
            newTargetNodeInNext.data.inputConnectionOrders[newTargetOriginalKey] || [];
          
          const newOrderAtNewTarget = [...currentOrderAtNewTarget];
          const existingIdx = newOrderAtNewTarget.indexOf(edgeToMoveId); 
          if (existingIdx !== -1) newOrderAtNewTarget.splice(existingIdx, 1);
          
          const insertAtIndex = Math.max(0, Math.min(newTargetIndexInOrder, newOrderAtNewTarget.length));
          newOrderAtNewTarget.splice(insertAtIndex, 0, edgeToMoveId);
          
          newTargetNodeInNext.data.inputConnectionOrders[newTargetOriginalKey] = newOrderAtNewTarget;
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
      console.error("[MultiInputActions:moveAndReconnectEdgeMultiInput] 更新失败:", error);
    }
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