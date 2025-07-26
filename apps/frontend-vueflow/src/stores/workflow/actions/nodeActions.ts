// apps/frontend-vueflow/src/stores/workflow/actions/nodeActions.ts
import { klona } from "klona";
import type { Node as VueFlowNode, Edge as VueFlowEdge } from "@vue-flow/core";
import type { WorkflowStoreContext } from "../types";
import type { HistoryEntry } from "@comfytavern/types";
import { getNodeType, parseSubHandleId } from "../../../utils/nodeUtils";

/**
 * 创建与节点操作相关的 Action。
 * @param context - 提供对 store 核心部分的访问。
 * @returns 一个包含节点操作函数的对象。
 */
export function createNodeActions(context: WorkflowStoreContext) {
  const { workflowManager, updateNodeInternals } = context;

  /**
   * 更新节点的标签（显示名称）并记录历史。
   * @param internalId - 标签页的内部 ID。
   * @param nodeId - 要更新的节点的 ID。
   * @param newLabel - 新的标签文本。
   * @param entry - 描述此操作的历史记录条目。
   */
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

    context.recordHistory(internalId, entry, nextSnapshot);
  }

  /**
   * 更新节点的尺寸（宽度和/或高度）并记录历史。
   * @param internalId - 标签页的内部 ID。
   * @param nodeId - 要更新的节点的 ID。
   * @param dimensions - 包含 `width` 和/或 `height` 的对象。
   * @param entry - 描述此操作的历史记录条目。
   */
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
      console.debug("[NodeActions:updateNodeDimensionsAndRecord] 尺寸未改变。跳过历史记录。");
      return;
    }

    await workflowManager.setElements(internalId, nextSnapshot.elements);

    context.recordHistory(internalId, entry, nextSnapshot);
  }

  /**
   * 更新一个或多个节点的父节点（用于节点组/框架）并记录历史。
   * @param internalId - 标签页的内部 ID。
   * @param updates - 一个包含节点 ID、新父节点 ID 和位置更新的数组。
   * @param entry - 可选的，描述此批量操作的历史记录条目。
   */
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

        if (
          oldParentNode !== newParentNode ||
          node.position.x !== update.position.x ||
          node.position.y !== update.position.y
        ) {
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
      context.recordHistory(internalId, entry, nextSnapshot);
    }
  }

  /**
   * 更新节点上特定输入插槽的值，并记录历史。
   * @param internalId - 标签页的内部 ID。
   * @param nodeId - 目标节点的 ID。
   * @param inputKey - 目标输入插槽的键。
   * @param value - 要设置的新值。
   * @param entry - 描述此操作的历史记录条目。
   */
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

  /**
   * 更新节点上特定配置项的值，并记录历史。
   * 对节点组的 `referencedWorkflowId` 有特殊处理逻辑。
   * @param internalId - 标签页的内部 ID。
   * @param nodeId - 目标节点的 ID。
   * @param configKey - 目标配置项的键。
   * @param value - 要设置的新值。
   * @param entry - 描述此操作的历史记录条目。
   */
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
          (el): el is VueFlowEdge =>
            "source" in el && (el.source === nodeId || el.target === nodeId)
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

  /**
   * 更改节点的工作模式，并记录历史。
   * 这会更新节点的配置值，并自动处理因模式切换导致的插槽增减和相关边的移除。
   * @param internalId - 标签页的内部 ID。
   * @param nodeId - 目标节点的 ID。
   * @param configKey - 存储模式的配置键。
   * @param newModeId - 要切换到的新模式的 ID。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function changeNodeModeAndRecord(
    internalId: string,
    nodeId: string,
    configKey: string,
    newModeId: string,
    entry: HistoryEntry
  ) {
    const currentSnapshot = context.workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(`[NodeActions:changeNodeModeAndRecord] 无法获取标签页 ${internalId} 的快照。`);
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const nodeIndex = nextSnapshot.elements.findIndex(
      (el) => el.id === nodeId && !("source" in el)
    );
    if (nodeIndex === -1) {
      console.error(
        `[NodeActions:changeNodeModeAndRecord] 在标签页 ${internalId} 中未找到节点 ${nodeId}。`
      );
      return;
    }
    const targetNode = nextSnapshot.elements[nodeIndex] as VueFlowNode;
    const nodeDef = targetNode.data as any;

    // 1. 更新配置值
    targetNode.data = {
      ...targetNode.data,
      configValues: {
        ...(targetNode.data.configValues || {}),
        [configKey]: newModeId,
      },
    };

    // 2. 确定因模式切换而移除的插槽
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

    // 3. 从快照中过滤掉连接到已移除插槽的边
    if (removedInputKeys.size > 0 || removedOutputKeys.size > 0) {
      const edgesToRemove: VueFlowEdge[] = [];
      nextSnapshot.elements = nextSnapshot.elements.filter((el) => {
        if (!("source" in el)) return true; // 保留节点
        const edge = el as VueFlowEdge;
        let shouldRemove = false;

        if (
          edge.source === nodeId &&
          edge.sourceHandle &&
          removedOutputKeys.has(parseSubHandleId(edge.sourceHandle).originalKey)
        ) {
          shouldRemove = true;
        }
        if (
          edge.target === nodeId &&
          edge.targetHandle &&
          removedInputKeys.has(parseSubHandleId(edge.targetHandle).originalKey)
        ) {
          shouldRemove = true;
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

    // 4. 应用状态更新
    await context.workflowManager.setElements(internalId, nextSnapshot.elements);

    // 5. 更新节点视图
    await updateNodeInternals(internalId, [nodeId]);

    // 6. 记录历史
    context.recordHistory(internalId, entry, nextSnapshot);

    // 7. 触发预览
    if (context.workflowPreview.isPreviewEnabled.value) {
      context.workflowPreview.triggerPreview(nodeId, {
        type: "config",
        key: configKey,
        value: newModeId,
      });
    }
  }

  async function updateNodeComponentStateAndRecord(
    internalId: string,
    nodeId: string,
    inputKey: string,
    stateUpdate: { height?: number; value?: string },
    entry: HistoryEntry
  ) {
    if (!nodeId || !inputKey || !stateUpdate) {
      console.warn("[NodeActions:updateNodeComponentStateAndRecord] 无效参数。");
      return;
    }

    const currentSnapshot = context.workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(
        `[NodeActions:updateNodeComponentStateAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const nodeIndex = nextSnapshot.elements.findIndex(
      (el) => el.id === nodeId && !("source" in el)
    );
    if (nodeIndex === -1) {
      console.error(
        `[NodeActions:updateNodeComponentStateAndRecord] 在标签页 ${internalId} 中未找到节点 ${nodeId}。`
      );
      return;
    }
    const targetNode = nextSnapshot.elements[nodeIndex] as VueFlowNode;

    targetNode.data = targetNode.data || {};
    targetNode.data.componentStates = targetNode.data.componentStates || {};
    targetNode.data.componentStates[inputKey] = targetNode.data.componentStates[inputKey] || {};
    if (stateUpdate.height !== undefined)
      targetNode.data.componentStates[inputKey].height = stateUpdate.height;
    if (stateUpdate.value !== undefined)
      targetNode.data.componentStates[inputKey].value = stateUpdate.value;

    const originalNode = currentSnapshot.elements.find(
      (el) => el.id === nodeId && !("source" in el)
    ) as VueFlowNode | undefined;
    if (!originalNode) {
      console.error(
        `[NodeActions:updateNodeComponentStateAndRecord] Original node ${nodeId} not found in current snapshot for comparison.`
      );
      return;
    }
    const originalComponentState = originalNode.data?.componentStates?.[inputKey] || {};
    const hasChanged =
      (stateUpdate.height !== undefined && originalComponentState.height !== stateUpdate.height) ||
      (stateUpdate.value !== undefined && originalComponentState.value !== stateUpdate.value);

    if (!hasChanged) {
      console.debug(
        "[NodeActions:updateNodeComponentStateAndRecord] 组件状态未改变。跳过历史记录。"
      );
      return;
    }

    await context.workflowManager.setElements(internalId, nextSnapshot.elements);

    context.recordHistory(internalId, entry, nextSnapshot);
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
      console.error(`[NodeActions:addElementsAndRecord] 无法获取标签页 ${internalId} 的当前快照。`);
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const newElements = [...nodesToAdd, ...edgesToAdd];
    nextSnapshot.elements.push(...newElements);

    await workflowManager.setElements(internalId, nextSnapshot.elements);

    context.recordHistory(internalId, entry, nextSnapshot);
  }

  async function addNodeAndRecord(internalId: string, nodeToAdd: VueFlowNode, entry: HistoryEntry) {
    await addElementsAndRecord(internalId, [nodeToAdd], [], entry);
  }

  async function addFrameNodeAndRecord(
    internalId: string,
    frameNode: VueFlowNode,
    entry: HistoryEntry
  ) {
    await addElementsAndRecord(internalId, [frameNode], [], entry);
  }

  async function updateNodePositionAndRecord(
    internalId: string,
    updates: { nodeId: string; position: { x: number; y: number } }[],
    entry?: HistoryEntry
  ) {
    if (!updates || updates.length === 0) {
      console.warn("[NodeActions:updateNodePositionAndRecord] 提供了无效参数。");
      return;
    }
    const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(
        `[NodeActions:updateNodePositionAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
      );
      return;
    }

    // 准备下一个状态快照
    const nextSnapshot = klona(currentSnapshot);
    // 创建一个节点 ID 到节点对象的映射，方便查找
    const nodeMap = new Map(
      nextSnapshot.elements
        .filter((el) => !("source" in el))
        .map((node) => [node.id, node as VueFlowNode])
    );

    // 修改 nextSnapshot 中的节点位置
    let updated = false;
    for (const update of updates) {
      const node = nodeMap.get(update.nodeId);
      if (node) {
        node.position = update.position;
        updated = true;
      } else {
        console.warn(
          `[NodeActions:updateNodePositionAndRecord] 更新时在快照中未找到节点 ${update.nodeId}。`
        );
      }
    }

    // 如果没有任何节点被实际更新，则跳过
    if (!updated) {
      console.warn("[NodeActions:updateNodePositionAndRecord] 没有节点被更新。跳过历史记录。");
      return;
    }

    // 应用状态更新
    // 注意：workflowManager.updateNodePositions 内部调用 setElements
    await workflowManager.updateNodePositions(internalId, updates);

    // 记录历史
    // 传递 nextSnapshot 确保记录的是我们预期的、包含所有位置更新的状态
    if (entry) {
      context.recordHistory(internalId, entry, nextSnapshot);
    }
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

    context.recordHistory(internalId, entry, nextSnapshot);

    if (nodesToUpdateInternals.size > 0) {
      await updateNodeInternals(internalId, Array.from(nodesToUpdateInternals));
    }
  }

  return {
    updateNodePositionAndRecord,
    updateNodeLabelAndRecord,
    updateNodeDimensionsAndRecord,
    updateNodeParentAndRecord,
    updateNodeInputValueAndRecord,
    updateNodeConfigValueAndRecord,
    changeNodeModeAndRecord,
    updateNodeComponentStateAndRecord,
    addElementsAndRecord,
    addNodeAndRecord,
    addFrameNodeAndRecord,
    removeElementsAndRecord,
  };
}
