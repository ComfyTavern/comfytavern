// apps/frontend-vueflow/src/stores/workflow/actions/edgeActions.ts
import { nextTick } from 'vue';
import { klona } from 'klona';
import type { Node as VueFlowNode, Edge as VueFlowEdge } from "@vue-flow/core";
import type { WorkflowStoreContext } from '../types';
import type { HistoryEntry, GroupSlotInfo } from '@comfytavern/types';
import { parseSubHandleId } from '../../../utils/nodeUtils';

export function createEdgeActions(context: WorkflowStoreContext) {
  const {
    workflowManager,
    recordHistory,
    multiInputActions,
    workflowViewManagement,
  } = context;

  async function updateNodeInternals(internalId: string, nodeIds: string[]) {
    const instance = workflowViewManagement.getVueFlowInstance(internalId);
    if (instance) {
      await nextTick();
      await nextTick();
      instance.updateNodeInternals(nodeIds);
      await nextTick();
    }
  }

  function getEdgeById(internalId: string, edgeId: string): VueFlowEdge | undefined {
    const elements = workflowManager.getElements(internalId);
    return elements.find(el => el.id === edgeId && "source" in el) as VueFlowEdge | undefined;
  }

  async function addEdgeAndRecord(internalId: string, edgeToAdd: VueFlowEdge, entry: HistoryEntry) {
    if (!edgeToAdd) {
      console.warn("[EdgeActions:addEdgeAndRecord] 提供了无效参数。");
      return;
    }
    const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(`[EdgeActions:addEdgeAndRecord] 无法获取标签页 ${internalId} 的当前快照。`);
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    nextSnapshot.elements.push(edgeToAdd);

    await workflowManager.setElements(internalId, nextSnapshot.elements);
    recordHistory(internalId, entry, nextSnapshot);
  }

  async function handleConnectionWithInterfaceUpdate(
    internalId: string,
    newEdge: VueFlowEdge,
    newInputs: Record<string, GroupSlotInfo>,
    newOutputs: Record<string, GroupSlotInfo>,
    modifiedSlotInfo: {
      node: VueFlowNode;
      handleKey: string;
      newDefinition: GroupSlotInfo;
      direction: "inputs" | "outputs";
    } | null,
    sourceNodeId: string,
    targetNodeId: string,
    entry: HistoryEntry
  ) {
    const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot || !currentSnapshot.workflowData) {
      console.error(
        `[EdgeActions:handleConnectionWithInterfaceUpdate] 无法获取标签页 ${internalId} 的当前快照或缺少 workflowData。`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const nextSnapshotElements = nextSnapshot.elements;

    if (modifiedSlotInfo) {
      const nodeIndex = nextSnapshotElements.findIndex(
        (el) => el.id === modifiedSlotInfo.node.id && !("source" in el)
      );
      if (nodeIndex !== -1) {
        const nodeToUpdate = klona(nextSnapshotElements[nodeIndex]) as VueFlowNode;
        nodeToUpdate.data = nodeToUpdate.data || {};
        if (modifiedSlotInfo.direction === "inputs") {
          nodeToUpdate.data.inputs = nodeToUpdate.data.inputs || {};
          nodeToUpdate.data.inputs[modifiedSlotInfo.handleKey] = klona(
            modifiedSlotInfo.newDefinition
          );
        } else {
          nodeToUpdate.data.outputs = nodeToUpdate.data.outputs || {};
          nodeToUpdate.data.outputs[modifiedSlotInfo.handleKey] = klona(
            modifiedSlotInfo.newDefinition
          );
        }
        nextSnapshotElements[nodeIndex] = nodeToUpdate;
      }
    }

    const targetNodeForMultiInputCheck = nextSnapshotElements.find(
      (el) => el.id === targetNodeId && !("source" in el)
    ) as VueFlowNode | undefined;
    let isMultiInputConnection = false;

    if (targetNodeForMultiInputCheck && newEdge.targetHandle) {
      const { originalKey: targetOriginalKey } = parseSubHandleId(newEdge.targetHandle);
      const targetInputDef = targetNodeForMultiInputCheck.data?.inputs?.[targetOriginalKey];

      if (targetInputDef?.multi === true) {
        isMultiInputConnection = true;
        const targetIndexInOrder = entry.details?.newTargetIndexInOrder as number | undefined;

        if (typeof targetIndexInOrder === "number") {
          const multiInputResult = await multiInputActions.connectEdgeToMultiInput(
            nextSnapshot,
            klona(newEdge),
            targetIndexInOrder,
            internalId
          );
          nextSnapshot.elements = multiInputResult.modifiedElements;
          if (multiInputResult.modifiedWorkflowData !== undefined) {
            nextSnapshot.workflowData = multiInputResult.modifiedWorkflowData;
          }
        }
      }
    }

    if (!isMultiInputConnection) {
      if (!nextSnapshot.elements.find((el) => el.id === newEdge.id)) {
        nextSnapshot.elements.push(klona(newEdge));
      } else {
        console.warn(`[EdgeActions] Edge ${newEdge.id} already exists in elements`);
      }
    }

    if (Object.keys(newInputs).length > 0) {
      nextSnapshot.workflowData!.interfaceInputs = klona(newInputs);
    }
    if (Object.keys(newOutputs).length > 0) {
      nextSnapshot.workflowData!.interfaceOutputs = klona(newOutputs);
    }

    recordHistory(internalId, entry, nextSnapshot);

    await workflowManager.setElementsAndInterface(
      internalId,
      nextSnapshot.elements,
      nextSnapshot.workflowData?.interfaceInputs ?? {},
      nextSnapshot.workflowData?.interfaceOutputs ?? {}
    );

    await nextTick();

    await updateNodeInternals(internalId, [sourceNodeId, targetNodeId]);
  }

  async function removeEdgesByHandleAndRecord(
    internalId: string,
    nodeId: string,
    handleId: string,
    handleType: "source" | "target",
    entry: HistoryEntry
  ) {
    const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(`[EdgeActions:removeEdgesByHandleAndRecord] 无法获取标签页 ${internalId} 的当前快照。`);
      return;
    }

    const edgesToRemove: VueFlowEdge[] = [];
    const remainingElements = currentSnapshot.elements.filter((el) => {
      if (!("source" in el)) return true;
      const edge = el as VueFlowEdge;
      let shouldRemove = false;
      if (handleType === "source" && edge.source === nodeId && edge.sourceHandle === handleId)
        shouldRemove = true;
      else if (handleType === "target" && edge.target === nodeId && edge.targetHandle === handleId)
        shouldRemove = true;

      if (shouldRemove) {
        edgesToRemove.push(klona(edge));
        return false;
      }
      return true;
    });

    if (edgesToRemove.length === 0) {
      console.warn(`[EdgeActions:removeEdgesByHandleAndRecord] 未找到连接到节点 ${nodeId} 句柄 ${handleId} (${handleType}) 的边。`);
      return;
    }

    const nextSnapshot = { ...currentSnapshot, elements: remainingElements };

    await workflowManager.setElements(internalId, remainingElements);

    entry.details = {
      ...(entry.details || {}),
      nodeId,
      handleId,
      handleType,
      removedEdges: edgesToRemove.map(e => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle, target: e.target, targetHandle: e.targetHandle })),
    };
    recordHistory(internalId, entry, nextSnapshot);
  }

  async function updateNodeInputConnectionOrderAndRecord(
    nodeId: string,
    handleKey: string,
    newOrderedEdgeIds: string[],
    entry: HistoryEntry
  ) {
    const internalId = context.tabStore.activeTabId;
    if (!internalId) {
      console.error("[EdgeActions:updateNodeInputConnectionOrderAndRecord] No active tab ID.");
      return;
    }
    const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(`[EdgeActions:updateNodeInputConnectionOrderAndRecord] Cannot get snapshot for tab ${internalId}`);
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const result = await multiInputActions.updateNodeInputConnectionOrder(nextSnapshot, nodeId, handleKey, newOrderedEdgeIds);

    nextSnapshot.elements = result.modifiedElements;
    if (result.modifiedWorkflowData !== undefined) {
      nextSnapshot.workflowData = result.modifiedWorkflowData;
    }

    recordHistory(internalId, entry, nextSnapshot);
    const applied = workflowManager.applyStateSnapshot(internalId, nextSnapshot);
    if (!applied) {
      console.error(`[EdgeActions:updateNodeInputConnectionOrderAndRecord] Failed to apply snapshot for tab ${internalId}.`);
    }

    if (nextSnapshot.elements.find((n) => n.id === nodeId && !("source" in n))) {
      await updateNodeInternals(internalId, [nodeId]);
    }
  }

  async function disconnectEdgeFromInputAndRecord(
    edgeId: string,
    originalTargetNodeId: string,
    originalTargetHandleId: string,
    entry: HistoryEntry
  ) {
    const internalId = context.tabStore.activeTabId;
    if (!internalId) {
      console.error("[EdgeActions:disconnectEdgeFromInputAndRecord] No active tab ID.");
      return;
    }
    const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(`[EdgeActions:disconnectEdgeFromInputAndRecord] Cannot get snapshot for tab ${internalId}`);
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const result = await multiInputActions.disconnectEdgeFromMultiInput(nextSnapshot, edgeId, originalTargetNodeId, originalTargetHandleId);

    nextSnapshot.elements = result.modifiedElements;
    if (result.modifiedWorkflowData !== undefined) {
      nextSnapshot.workflowData = result.modifiedWorkflowData;
    }

    recordHistory(internalId, entry, nextSnapshot);

    if (nextSnapshot.workflowData) {
      await workflowManager.setElementsAndInterface(
        internalId,
        nextSnapshot.elements,
        nextSnapshot.workflowData.interfaceInputs ?? {},
        nextSnapshot.workflowData.interfaceOutputs ?? {}
      );
    } else {
      await workflowManager.setElements(internalId, nextSnapshot.elements);
    }

    if (nextSnapshot.elements.find((n) => n.id === originalTargetNodeId && !("source" in n))) {
      await updateNodeInternals(internalId, [originalTargetNodeId]);
    }
  }

  async function connectEdgeToInputAndRecord(
    newEdgeParams: VueFlowEdge,
    targetIndexInOrder: number | undefined,
    entry: HistoryEntry
  ) {
    const internalId = context.tabStore.activeTabId;
    if (!internalId) {
      console.error("[EdgeActions:connectEdgeToInputAndRecord] No active tab ID.");
      return;
    }
    const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(`[EdgeActions:connectEdgeToInputAndRecord] Cannot get snapshot for tab ${internalId}`);
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const result = await multiInputActions.connectEdgeToMultiInput(nextSnapshot, klona(newEdgeParams), targetIndexInOrder, internalId);

    nextSnapshot.elements = result.modifiedElements;
    if (result.modifiedWorkflowData !== undefined) {
      nextSnapshot.workflowData = result.modifiedWorkflowData;
    }

    recordHistory(internalId, entry, nextSnapshot);

    if (nextSnapshot.workflowData) {
      await workflowManager.setElementsAndInterface(
        internalId,
        nextSnapshot.elements,
        nextSnapshot.workflowData.interfaceInputs ?? {},
        nextSnapshot.workflowData.interfaceOutputs ?? {}
      );
    } else {
      await workflowManager.setElements(internalId, nextSnapshot.elements);
    }
    
    const sourceNodeId = newEdgeParams.source;
    const targetNodeId = newEdgeParams.target;
    if (sourceNodeId && targetNodeId) {
      await updateNodeInternals(internalId, [sourceNodeId, targetNodeId]);
    }
  }

  async function moveAndReconnectEdgeAndRecord(
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
    const internalId = context.tabStore.activeTabId;
    if (!internalId) {
      console.error("[EdgeActions:moveAndReconnectEdgeAndRecord] No active tab ID.");
      return;
    }
    const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(`[EdgeActions:moveAndReconnectEdgeAndRecord] Cannot get snapshot for tab ${internalId}`);
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const result = await multiInputActions.moveAndReconnectEdgeMultiInput(
      nextSnapshot,
      edgeToMoveId,
      originalTargetNodeId,
      originalTargetHandleId,
      newSourceNodeId,
      newSourceHandleId,
      newTargetNodeId,
      newTargetHandleId,
      newTargetIndexInOrder,
      internalId
    );

    nextSnapshot.elements = result.modifiedElements;
    if (result.modifiedWorkflowData !== undefined) {
      nextSnapshot.workflowData = result.modifiedWorkflowData;
    }

    recordHistory(internalId, entry, nextSnapshot);

    if (nextSnapshot.workflowData) {
      await workflowManager.setElementsAndInterface(
        internalId,
        nextSnapshot.elements,
        nextSnapshot.workflowData.interfaceInputs ?? {},
        nextSnapshot.workflowData.interfaceOutputs ?? {}
      );
    } else {
      await workflowManager.setElements(internalId, nextSnapshot.elements);
    }

    const nodesToUpdate = new Set<string>([originalTargetNodeId, newSourceNodeId, newTargetNodeId]);
    await updateNodeInternals(internalId, Array.from(nodesToUpdate));
  }

  async function updateMultiInputConnectionsAndRecord(
    internalId: string,
    nodeId: string,
    inputKey: string,
    newOrderedEdgeIds: string[],
    edgeTargetHandleChanges: Array<{ edgeId: string; oldTargetHandle?: string | null; newTargetHandle?: string | null }>,
    entry: HistoryEntry
  ): Promise<void> {
    const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(`[EdgeActions:updateMultiInputConnectionsAndRecord] 无法获取标签页 ${internalId} 的当前快照。`);
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const nodeToUpdate = nextSnapshot.elements.find(
      (el) => el.id === nodeId && !("source" in el)
    ) as VueFlowNode | undefined;

    if (!nodeToUpdate) {
      console.error(`[EdgeActions:updateMultiInputConnectionsAndRecord] 在 nextSnapshot 中未找到节点 ${nodeId}。`);
      return;
    }
    nodeToUpdate.data = nodeToUpdate.data || {};
    nodeToUpdate.data.inputConnectionOrders = nodeToUpdate.data.inputConnectionOrders || {};
    nodeToUpdate.data.inputConnectionOrders[inputKey] = newOrderedEdgeIds;

    for (const change of edgeTargetHandleChanges) {
      const edgeToUpdate = nextSnapshot.elements.find(
        (el) => el.id === change.edgeId && "source" in el
      ) as VueFlowEdge | undefined;
      if (edgeToUpdate) {
        if (change.newTargetHandle !== undefined) {
          edgeToUpdate.targetHandle = change.newTargetHandle;
        }
      }
    }
    await workflowManager.setElements(internalId, nextSnapshot.elements);
    recordHistory(internalId, entry, nextSnapshot);
  }

  return {
    getEdgeById,
    addEdgeAndRecord,
    handleConnectionWithInterfaceUpdate,
    removeEdgesByHandleAndRecord,
    updateNodeInputConnectionOrderAndRecord,
    disconnectEdgeFromInputAndRecord,
    connectEdgeToInputAndRecord,
    moveAndReconnectEdgeAndRecord,
    updateMultiInputConnectionsAndRecord,
  };
}