// apps/frontend-vueflow/src/stores/workflow/actions/edgeActions.ts
import { nextTick } from "vue";
import { klona } from "klona";
import type { Node as VueFlowNode, Edge as VueFlowEdge } from "@vue-flow/core";
import type { WorkflowStoreContext } from "../types";
import type { HistoryEntry, GroupSlotInfo } from "@comfytavern/types";
import { parseSubHandleId } from "../../../utils/nodeUtils";

export function createEdgeActions(context: WorkflowStoreContext) {
  const { workflowManager, recordHistory, multiInputActions, updateNodeInternals } = context;

  /**
   * 根据 ID 获取指定标签页中的边。
   * @param internalId - 标签页的内部 ID。
   * @param edgeId - 要查找的边的 ID。
   * @returns 找到的 VueFlowEdge 对象，如果未找到则返回 undefined。
   */
  function getEdgeById(internalId: string, edgeId: string): VueFlowEdge | undefined {
    const elements = workflowManager.getElements(internalId);
    return elements.find((el) => el.id === edgeId && "source" in el) as VueFlowEdge | undefined;
  }

  /**
   * 添加一条边并记录历史。
   * @param internalId - 标签页的内部 ID。
   * @param edgeToAdd - 要添加的 VueFlowEdge 对象。
   * @param entry - 描述此操作的历史记录条目。
   */
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

  /**
   * 处理一个可能伴随节点组接口更新的新连接。
   * 此函数会处理边的添加、多输入连接、节点组接口的动态修改，并记录完整的历史状态。
   * @param internalId - 标签页的内部 ID。
   * @param newEdge - 新创建的边。
   * @param newInputs - 更新后的工作流输入接口定义。
   * @param newOutputs - 更新后的工作流输出接口定义。
   * @param modifiedSlotInfo - 如果连接导致了某个节点组插槽的定义被修改，则提供此信息。
   * @param sourceNodeId - 源节点的 ID。
   * @param targetNodeId - 目标节点的 ID。
   * @param entry - 描述此复杂操作的历史记录条目。
   */
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

  /**
   * 移除连接到指定节点句柄的所有边，并记录历史。
   * @param internalId - 标签页的内部 ID。
   * @param nodeId - 目标节点的 ID。
   * @param handleId - 目标句柄的 ID。
   * @param handleType - 句柄类型 ('source' 或 'target')。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function removeEdgesByHandleAndRecord(
    internalId: string,
    nodeId: string,
    handleId: string,
    handleType: "source" | "target",
    entry: HistoryEntry
  ) {
    const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(
        `[EdgeActions:removeEdgesByHandleAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
      );
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
      console.warn(
        `[EdgeActions:removeEdgesByHandleAndRecord] 未找到连接到节点 ${nodeId} 句柄 ${handleId} (${handleType}) 的边。`
      );
      return;
    }

    const nextSnapshot = { ...currentSnapshot, elements: remainingElements };

    await workflowManager.setElements(internalId, remainingElements);

    entry.details = {
      ...(entry.details || {}),
      nodeId,
      handleId,
      handleType,
      removedEdges: edgesToRemove.map((e) => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourceHandle,
        target: e.target,
        targetHandle: e.targetHandle,
      })),
    };
    recordHistory(internalId, entry, nextSnapshot);
  }

  /**
   * 更新节点上多输入插槽的连接顺序，并记录历史。
   * @param nodeId - 目标节点的 ID。
   * @param handleKey - 多输入插槽的原始键。
   * @param newOrderedEdgeIds - 按新顺序排列的边 ID 数组。
   * @param entry - 描述此操作的历史记录条目。
   */
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
      console.error(
        `[EdgeActions:updateNodeInputConnectionOrderAndRecord] Cannot get snapshot for tab ${internalId}`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const result = await multiInputActions.updateNodeInputConnectionOrder(
      nextSnapshot,
      nodeId,
      handleKey,
      newOrderedEdgeIds
    );

    nextSnapshot.elements = result.modifiedElements;
    if (result.modifiedWorkflowData !== undefined) {
      nextSnapshot.workflowData = result.modifiedWorkflowData;
    }

    recordHistory(internalId, entry, nextSnapshot);
    const applied = workflowManager.applyStateSnapshot(internalId, nextSnapshot);
    if (!applied) {
      console.error(
        `[EdgeActions:updateNodeInputConnectionOrderAndRecord] Failed to apply snapshot for tab ${internalId}.`
      );
    }

    if (nextSnapshot.elements.find((n) => n.id === nodeId && !("source" in n))) {
      await updateNodeInternals(internalId, [nodeId]);
    }
  }

  /**
   * 从输入插槽（特别是多输入插槽）断开一条边，并记录历史。
   * @param edgeId - 要断开的边的 ID。
   * @param originalTargetNodeId - 原始目标节点的 ID。
   * @param originalTargetHandleId - 原始目标句柄的 ID。
   * @param entry - 描述此操作的历史记录条目。
   */
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
      console.error(
        `[EdgeActions:disconnectEdgeFromInputAndRecord] Cannot get snapshot for tab ${internalId}`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const result = await multiInputActions.disconnectEdgeFromMultiInput(
      nextSnapshot,
      edgeId,
      originalTargetNodeId,
      originalTargetHandleId
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
      console.error(
        `[EdgeActions:connectEdgeToInputAndRecord] Cannot get snapshot for tab ${internalId}`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const result = await multiInputActions.connectEdgeToMultiInput(
      nextSnapshot,
      klona(newEdgeParams),
      targetIndexInOrder,
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
      console.error(
        `[EdgeActions:moveAndReconnectEdgeAndRecord] Cannot get snapshot for tab ${internalId}`
      );
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
    edgeTargetHandleChanges: Array<{
      edgeId: string;
      oldTargetHandle?: string | null;
      newTargetHandle?: string | null;
    }>,
    entry: HistoryEntry
  ): Promise<void> {
    const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(
        `[EdgeActions:updateMultiInputConnectionsAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const nodeToUpdate = nextSnapshot.elements.find(
      (el) => el.id === nodeId && !("source" in el)
    ) as VueFlowNode | undefined;

    if (!nodeToUpdate) {
      console.error(
        `[EdgeActions:updateMultiInputConnectionsAndRecord] 在 nextSnapshot 中未找到节点 ${nodeId}。`
      );
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
