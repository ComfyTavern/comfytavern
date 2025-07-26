// apps/frontend-vueflow/src/stores/workflow/actions/nodeActions.ts
import { klona } from 'klona';
import type { Node as VueFlowNode, Edge as VueFlowEdge } from "@vue-flow/core";
import type { WorkflowStoreContext } from '../types';
import type { HistoryEntry } from '@comfytavern/types';
import { getNodeType, parseSubHandleId } from '../../../utils/nodeUtils';
import { nextTick } from 'vue';

export function createNodeActions(context: WorkflowStoreContext) {
  const { workflowManager, recordHistory } = context;

  /**
   * 异步更新指定节点的内部状态和视图
   * @param internalId - 标签页的内部 ID
   * @param nodeIds - 需要更新的节点 ID 数组
   */
  async function updateNodeInternals(internalId: string, nodeIds: string[]) {
    const instance = context.workflowViewManagement.getVueFlowInstance(internalId);
    if (instance) {
      await nextTick();
      await nextTick();
      instance.updateNodeInternals(nodeIds);
      await nextTick();
    }
  }

  async function updateNodeLabelAndRecord(
    internalId: string,
    nodeId: string,
    newLabel: string,
    entry: HistoryEntry
  ) {
    if (!nodeId) {
      console.warn("[NodeActions:updateNodeLabelAndRecord] 无效的 nodeId。");
      return;
    }

    const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(
        `[NodeActions:updateNodeLabelAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const nodeIndex = nextSnapshot.elements.findIndex(
      (el: VueFlowNode | VueFlowEdge) => el.id === nodeId && !("source" in el)
    );
    if (nodeIndex === -1) {
      console.error(
        `[NodeActions:updateNodeLabelAndRecord] 在标签页 ${internalId} 中未找到节点 ${nodeId}。`
      );
      return;
    }
    const targetNode = nextSnapshot.elements[nodeIndex] as VueFlowNode;

    const oldLabel = targetNode.data.label || targetNode.label;
    if (oldLabel === newLabel) {
      console.debug(
        `[NodeActions:updateNodeLabelAndRecord] Node ${nodeId} label has not changed. Skipping history record.`
      );
      return;
    }

    targetNode.data = {
      ...targetNode.data,
      label: newLabel,
    };
    targetNode.label = newLabel;

    await workflowManager.setElements(internalId, nextSnapshot.elements);

    recordHistory(internalId, entry, nextSnapshot);
  }

  async function updateNodeDimensionsAndRecord(
    internalId: string,
    nodeId: string,
    dimensions: { width?: number; height?: number },
    entry: HistoryEntry
  ) {
    if (!nodeId || (!dimensions.width && !dimensions.height)) {
      console.warn("[NodeActions:updateNodeDimensionsAndRecord] 无效参数。");
      return;
    }

    const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(
        `[NodeActions:updateNodeDimensionsAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const nodeIndex = nextSnapshot.elements.findIndex(
      (el: VueFlowNode | VueFlowEdge) => el.id === nodeId && !("source" in el)
    );
    if (nodeIndex === -1) {
      console.error(
        `[NodeActions:updateNodeDimensionsAndRecord] 在标签页 ${internalId} 中未找到节点 ${nodeId}。`
      );
      return;
    }
    const targetNode = nextSnapshot.elements[nodeIndex] as VueFlowNode;

    if (dimensions.width !== undefined) {
      targetNode.width = dimensions.width;
      targetNode.style = { ...(targetNode.style || {}), width: `${dimensions.width}px` };
    }
    if (dimensions.height !== undefined) {
      targetNode.height = dimensions.height;
      targetNode.style = { ...(targetNode.style || {}), height: `${dimensions.height}px` };
    }

    const originalNode = currentSnapshot.elements.find(
      (el) => el.id === nodeId && !("source" in el)
    ) as VueFlowNode | undefined;
    if (!originalNode) {
      console.error(
        `[NodeActions:updateNodeDimensionsAndRecord] 未在当前快照中找到原始节点 ${nodeId}`
      );
      return;
    }
    const hasChanged =
      (dimensions.width !== undefined && originalNode.width !== dimensions.width) ||
      (dimensions.height !== undefined && originalNode.height !== dimensions.height);

    if (!hasChanged) {
      console.debug(
        "[NodeActions:updateNodeDimensionsAndRecord] 尺寸未改变。跳过历史记录。"
      );
      return;
    }

    await workflowManager.setElements(internalId, nextSnapshot.elements);

    recordHistory(internalId, entry, nextSnapshot);
  }

  async function updateNodeParentAndRecord(
    internalId: string,
    updates: { nodeId: string; parentNodeId: string | null; position: { x: number; y: number } }[],
    entry?: HistoryEntry
  ) {
    if (!updates || updates.length === 0) {
      console.warn("[NodeActions:updateNodeParentAndRecord] 无效参数。");
      return;
    }

    const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(
        `[NodeActions:updateNodeParentAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const nodeMap = new Map(
      nextSnapshot.elements
        .filter((el): el is VueFlowNode => !("source" in el))
        .map((node) => [node.id, node])
    );

    let hasChanged = false;
    for (const update of updates) {
      const node = nodeMap.get(update.nodeId);
      if (node) {
        const oldParentNode = (node as any).parentNode || null;
        const newParentNode = update.parentNodeId;
        
        if (oldParentNode !== newParentNode || node.position.x !== update.position.x || node.position.y !== update.position.y) {
          (node as any).parentNode = newParentNode;
          node.position = update.position;
          hasChanged = true;
        }
      }
    }

    if (!hasChanged) {
      console.debug("[NodeActions:updateNodeParentAndRecord] 节点的父节点未改变。跳过历史记录。");
      return;
    }

    await workflowManager.setElements(internalId, nextSnapshot.elements);
    if (entry) {
      recordHistory(internalId, entry, nextSnapshot);
    }
  }

  async function updateNodeInputValueAndRecord(
    internalId: string,
    nodeId: string,
    inputKey: string,
    value: any,
    entry: HistoryEntry
  ) {
    if (!nodeId || inputKey === undefined) {
      console.warn("[NodeActions:updateNodeInputValueAndRecord] 无效参数。");
      return;
    }

    const currentSnapshot = context.workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(
        `[NodeActions:updateNodeInputValueAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
      );
      return;
    }

    // 准备下一个状态快照
    const nextSnapshot = klona(currentSnapshot);
    const nodeIndex = nextSnapshot.elements.findIndex(
      (el) => el.id === nodeId && !("source" in el)
    );

    if (nodeIndex === -1) {
      console.error(
        `[NodeActions:updateNodeInputValueAndRecord] 在标签页 ${internalId} 中未找到节点 ${nodeId}。`
      );
      return;
    }

    // 修改 nextSnapshot 中的目标节点数据
    const targetNode = nextSnapshot.elements[nodeIndex] as VueFlowNode;
    const currentInput = targetNode.data.inputs?.[inputKey] || {};
    targetNode.data = {
      ...targetNode.data,
      inputs: {
        ...(targetNode.data.inputs || {}),
        [inputKey]: {
          ...currentInput,
          value: value, // 更新值
        },
      },
    };

    // 应用状态更新
    await context.workflowManager.setElements(internalId, nextSnapshot.elements);

    // 记录历史
    context.recordHistory(internalId, entry, nextSnapshot);

    // 触发预览 (如果启用)
    if (context.workflowPreview.isPreviewEnabled.value) {
      context.workflowPreview.triggerPreview(nodeId, { type: "input", key: inputKey, value });
    }
  }

  async function updateNodeConfigValueAndRecord(
    internalId: string,
    nodeId: string,
    configKey: string,
    value: any,
    entry: HistoryEntry
  ) {
    if (!nodeId || configKey === undefined) {
      console.warn("[NodeActions:updateNodeConfigValueAndRecord] 无效参数。");
      return;
    }

    const currentSnapshot = context.workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(
        `[NodeActions:updateNodeConfigValueAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const nodeIndex = nextSnapshot.elements.findIndex(
      (el) => el.id === nodeId && !("source" in el)
    );

    if (nodeIndex === -1) {
      console.error(
        `[NodeActions:updateNodeConfigValueAndRecord] 在标签页 ${internalId} 中未找到节点 ${nodeId}。`
      );
      return;
    }

    const targetNode = nextSnapshot.elements[nodeIndex] as VueFlowNode;
    let finalElements = nextSnapshot.elements;

    const baseDataUpdate = {
      ...targetNode.data,
      configValues: {
        ...(targetNode.data.configValues || {}),
        [configKey]: value,
      },
    };
    targetNode.data = baseDataUpdate;

    const nodeType = getNodeType(targetNode);
    if (nodeType === "core:NodeGroup" && configKey === "referencedWorkflowId") {
      const newWorkflowId = value as string | null;
      if (newWorkflowId) {
        const groupUpdateResult = await context.workflowGrouping.updateNodeGroupWorkflowReference(
          nodeId,
          newWorkflowId,
          internalId
        );

        if (groupUpdateResult.success && groupUpdateResult.updatedNodeData) {
          const baseLabel = groupUpdateResult.updatedNodeData.label;
          const finalDisplayLabel = baseLabel ? `📦 ${baseLabel}` : `📦 节点组`;

          const newInputs = groupUpdateResult.updatedNodeData.groupInterface?.inputs || {};
          const newOutputs = groupUpdateResult.updatedNodeData.groupInterface?.outputs || {};

          targetNode.data = {
            ...targetNode.data,
            groupInterface: groupUpdateResult.updatedNodeData.groupInterface,
            label: finalDisplayLabel,
            displayName: finalDisplayLabel,
            inputs: newInputs,
            outputs: newOutputs,
          };
          targetNode.label = finalDisplayLabel;

          if (groupUpdateResult.edgeIdsToRemove && groupUpdateResult.edgeIdsToRemove.length > 0) {
            const edgeIdsToRemoveSet = new Set(groupUpdateResult.edgeIdsToRemove);
            finalElements = finalElements.filter(
              (el) => !("source" in el) || !edgeIdsToRemoveSet.has(el.id)
            );
            nextSnapshot.elements = finalElements;
          }
        }
      } else {
        targetNode.data.groupInterface = undefined;
        targetNode.data.inputs = {};
        targetNode.data.outputs = {};
        targetNode.data.inputConnectionOrders = {};
        targetNode.data.label = "📦节点组";
        targetNode.data.displayName = "📦节点组";
        targetNode.label = "📦节点组";

        const edgesConnectedToNodeGroup = currentSnapshot.elements.filter(
          (el): el is VueFlowEdge => "source" in el && (el.source === nodeId || el.target === nodeId)
        );

        if (edgesConnectedToNodeGroup.length > 0) {
          const removedEdgeIds = new Set(edgesConnectedToNodeGroup.map((edge) => edge.id));
          finalElements = finalElements.filter(
            (el) => !("source" in el) || !removedEdgeIds.has(el.id)
          );
          nextSnapshot.elements = finalElements;
          
          const removedEdgesData = edgesConnectedToNodeGroup.map((edge) => klona(edge));
          if (entry.details) {
            entry.details.removedEdgesOnClearReference = removedEdgesData;
          } else {
            entry.details = { removedEdgesOnClearReference: removedEdgesData };
          }
        }
      }
    }

    await context.workflowManager.setElements(internalId, finalElements);

    if (nodeType === "core:NodeGroup" && configKey === "referencedWorkflowId") {
      await updateNodeInternals(internalId, [nodeId]);
    }

    context.recordHistory(internalId, entry, nextSnapshot);

    if (context.workflowPreview.isPreviewEnabled.value) {
      context.workflowPreview.triggerPreview(nodeId, { type: "config", key: configKey, value });
    }
  }

  async function changeNodeModeAndRecord(
    internalId: string,
    nodeId: string,
    configKey: string,
    newModeId: string,
    entry: HistoryEntry
  ) {
    const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(`[NodeActions:changeNodeModeAndRecord] 无法获取标签页 ${internalId} 的快照。`);
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const nodeIndex = nextSnapshot.elements.findIndex(
      (el) => el.id === nodeId && !("source" in el)
    );
    if (nodeIndex === -1) {
      console.error(`[NodeActions:changeNodeModeAndRecord] 在标签页 ${internalId} 中未找到节点 ${nodeId}。`);
      return;
    }
    const targetNode = nextSnapshot.elements[nodeIndex] as VueFlowNode;
    const nodeDef = targetNode.data as any;

    targetNode.data = {
      ...targetNode.data,
      configValues: {
        ...(targetNode.data.configValues || {}),
        [configKey]: newModeId,
      },
    };

    const oldModeId = entry.details?.oldValue as string | undefined;
    const oldModeDef = oldModeId ? nodeDef.modes?.[oldModeId] : undefined;
    const newModeDef = nodeDef.modes?.[newModeId];

    const oldInputs = oldModeDef?.inputs || nodeDef.inputs || {};
    const oldOutputs = oldModeDef?.outputs || nodeDef.outputs || {};
    const newInputs = newModeDef?.inputs || nodeDef.inputs || {};
    const newOutputs = newModeDef?.outputs || nodeDef.outputs || {};

    const oldInputKeys = new Set(Object.keys(oldInputs));
    const oldOutputKeys = new Set(Object.keys(oldOutputs));
    const newInputKeys = new Set(Object.keys(newInputs));
    const newOutputKeys = new Set(Object.keys(newOutputs));

    const removedInputKeys = new Set([...oldInputKeys].filter((k) => !newInputKeys.has(k)));
    const removedOutputKeys = new Set([...oldOutputKeys].filter((k) => !newOutputKeys.has(k)));

    if (removedInputKeys.size > 0 || removedOutputKeys.size > 0) {
      const edgesToRemove: VueFlowEdge[] = [];
      nextSnapshot.elements = nextSnapshot.elements.filter((el) => {
        if (!("source" in el)) return true;
        const edge = el as VueFlowEdge;
        let shouldRemove = false;

        if (edge.source === nodeId && typeof edge.sourceHandle === 'string') {
          const sourceKey = edge.sourceHandle.split('__')[0];
          if (sourceKey && removedOutputKeys.has(sourceKey)) {
            shouldRemove = true;
          }
        }
        if (edge.target === nodeId && typeof edge.targetHandle === 'string') {
          const targetKey = edge.targetHandle.split('__')[0];
          if (targetKey && removedInputKeys.has(targetKey)) {
            shouldRemove = true;
          }
        }

        if (shouldRemove) {
          edgesToRemove.push(klona(edge));
          return false;
        }
        return true;
      });

      if (entry.details) {
        entry.details.removedEdges = edgesToRemove;
      } else {
        entry.details = { removedEdges: edgesToRemove };
      }
    }
    
    await workflowManager.setElements(internalId, nextSnapshot.elements);

    // TODO: updateNodeInternals

    recordHistory(internalId, entry, nextSnapshot);

    // TODO: 触发预览
  }

  async function addElementsAndRecord(
    internalId: string,
    nodesToAdd: VueFlowNode[],
    edgesToAdd: VueFlowEdge[],
    entry: HistoryEntry
  ) {
    if ((!nodesToAdd || nodesToAdd.length === 0) && (!edgesToAdd || edgesToAdd.length === 0)) {
      console.warn("[NodeActions:addElementsAndRecord] 提供了无效参数。");
      return;
    }
    const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(
        `[NodeActions:addElementsAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const newElements = [...nodesToAdd, ...edgesToAdd];
    nextSnapshot.elements.push(...newElements);

    await workflowManager.setElements(internalId, nextSnapshot.elements);

    recordHistory(internalId, entry, nextSnapshot);
  }

  async function addNodeAndRecord(internalId: string, nodeToAdd: VueFlowNode, entry: HistoryEntry) {
    await addElementsAndRecord(internalId, [nodeToAdd], [], entry);
  }

  async function addFrameNodeAndRecord(internalId: string, frameNode: VueFlowNode, entry: HistoryEntry) {
    await addElementsAndRecord(internalId, [frameNode], [], entry);
  }

  async function removeElementsAndRecord(
    internalId: string,
    elementsToRemove: (VueFlowNode | VueFlowEdge)[],
    entry: HistoryEntry
  ) {
    if (!elementsToRemove || elementsToRemove.length === 0) {
      console.warn("[NodeActions:removeElementsAndRecord] 提供了无效参数。");
      return;
    }

    const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(
        `[NodeActions:removeElementsAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
      );
      return;
    }

    const explicitlyRemovedElementIds = new Set(elementsToRemove.map((el) => el.id));
    const removedEdgesFromInput: VueFlowEdge[] = [];

    const nextSnapshot = klona(currentSnapshot);

    const nodesBeingExplicitlyRemovedIds = new Set<string>();
    elementsToRemove.forEach((el: VueFlowNode | VueFlowEdge) => {
      if (
        !Object.prototype.hasOwnProperty.call(el, "source") &&
        !Object.prototype.hasOwnProperty.call(el, "target")
      ) {
        nodesBeingExplicitlyRemovedIds.add(el.id);
      }
    });

    const implicitlyRemovedEdgeIds = new Set<string>();
    if (nodesBeingExplicitlyRemovedIds.size > 0) {
      currentSnapshot.elements.forEach((el: VueFlowNode | VueFlowEdge) => {
        if (
          Object.prototype.hasOwnProperty.call(el, "source") &&
          Object.prototype.hasOwnProperty.call(el, "target")
        ) {
          const edge = el as VueFlowEdge;
          if (
            nodesBeingExplicitlyRemovedIds.has(edge.source) ||
            nodesBeingExplicitlyRemovedIds.has(edge.target)
          ) {
            implicitlyRemovedEdgeIds.add(edge.id);
          }
        }
      });
    }

    const allElementIdsToRemove = new Set([
      ...explicitlyRemovedElementIds,
      ...implicitlyRemovedEdgeIds,
    ]);

    const nodesToUpdateInternals = new Set<string>();

    const actualEdgesBeingRemoved = currentSnapshot.elements.filter(
      (el): el is VueFlowEdge => "source" in el && allElementIdsToRemove.has(el.id)
    );

    for (const edgeToRemove of actualEdgesBeingRemoved) {
      const targetNodeIndex = nextSnapshot.elements.findIndex(
        (n: VueFlowNode | VueFlowEdge) => n.id === edgeToRemove.target && !("source" in n)
      );
      if (targetNodeIndex !== -1) {
        if (!allElementIdsToRemove.has(edgeToRemove.target)) {
          const targetNode = nextSnapshot.elements[targetNodeIndex] as VueFlowNode;
          nodesToUpdateInternals.add(targetNode.id);

          if (targetNode.data?.inputConnectionOrders && edgeToRemove.targetHandle) {
            const { originalKey: targetOriginalKey } = parseSubHandleId(edgeToRemove.targetHandle);
            if (targetNode.data.inputConnectionOrders[targetOriginalKey]) {
              const currentOrder: string[] =
                targetNode.data.inputConnectionOrders[targetOriginalKey];
              const newOrder = currentOrder.filter((id: string) => id !== edgeToRemove.id);
              if (newOrder.length !== currentOrder.length) {
                targetNode.data.inputConnectionOrders[targetOriginalKey] = newOrder;
                if (newOrder.length === 0) {
                  delete targetNode.data.inputConnectionOrders[targetOriginalKey];
                }
                removedEdgesFromInput.push(klona(edgeToRemove));
              }
            }
          }
        }
      }
      if (edgeToRemove.source && !allElementIdsToRemove.has(edgeToRemove.source)) {
        nodesToUpdateInternals.add(edgeToRemove.source);
      }
    }

    nextSnapshot.elements = currentSnapshot.elements.filter(
      (el: VueFlowNode | VueFlowEdge) => !allElementIdsToRemove.has(el.id)
    );

    if (
      nextSnapshot.elements.length === currentSnapshot.elements.length &&
      removedEdgesFromInput.length === 0
    ) {
      console.warn(
        "[NodeActions:removeElementsAndRecord] 没有元素被实际移除或 inputConnectionOrders 未改变。跳过历史记录。"
      );
      return;
    }

    if (removedEdgesFromInput.length > 0 && entry.details) {
      entry.details.removedEdgesFromInputOnElementRemove = removedEdgesFromInput.map((e) => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourceHandle,
        target: e.target,
        targetHandle: e.targetHandle,
      }));
    } else if (removedEdgesFromInput.length > 0) {
      entry.details = {
        removedEdgesFromInputOnElementRemove: removedEdgesFromInput.map((e) => ({
          id: e.id,
          source: e.source,
          sourceHandle: e.sourceHandle,
          target: e.target,
          targetHandle: e.targetHandle,
        })),
      };
    }

    await workflowManager.setElements(internalId, nextSnapshot.elements);

    recordHistory(internalId, entry, nextSnapshot);

    if (nodesToUpdateInternals.size > 0) {
      // TODO: updateNodeInternals
      console.debug(
        `[NodeActions:removeElementsAndRecord] Should call updateNodeInternals for nodes:`,
        Array.from(nodesToUpdateInternals)
      );
    }
  }

  return {
    updateNodeLabelAndRecord,
    updateNodeDimensionsAndRecord,
    updateNodeParentAndRecord,
    updateNodeInputValueAndRecord,
    updateNodeConfigValueAndRecord,
    changeNodeModeAndRecord,
    addNodeAndRecord,
    addFrameNodeAndRecord,
    removeElementsAndRecord,
  };
}