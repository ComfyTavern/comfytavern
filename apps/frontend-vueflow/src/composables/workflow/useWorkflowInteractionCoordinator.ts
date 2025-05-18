// apps/frontend-vueflow/src/composables/workflow/useWorkflowInteractionCoordinator.ts
import { nextTick } from "vue";
import { klona } from "klona/full";
import type { Node as VueFlowNode, Edge } from "@vue-flow/core";
import { type GroupSlotInfo, type HistoryEntry, DataFlowType, type InputDefinition } from "@comfytavern/types"; // 导入 DataFlowType 和 InputDefinition
import { useWorkflowManager } from "./useWorkflowManager";
import { useWorkflowHistory } from "./useWorkflowHistory";
import { useWorkflowViewManagement } from "./useWorkflowViewManagement";
import { useWorkflowInterfaceManagement } from "./useWorkflowInterfaceManagement";
import { useTabStore } from "@/stores/tabStore";
import type { WorkflowStateSnapshot } from "@/types/workflowTypes";
import { getNodeType } from "@/utils/nodeUtils"; // 用于在配置更新中检查 NodeGroup
import { useWorkflowGrouping } from "../group/useWorkflowGrouping";
import { useWorkflowPreview } from './useWorkflowPreview'; // 导入新的预览 composable
import { useEditorState } from '@/composables/editor/useEditorState'; // 导入 useEditorState
import type { EditorOpeningContext } from '@/types/editorTypes'; // 导入 EditorOpeningContext

/**
 * @module composables/workflow/useWorkflowInteractionCoordinator
 * @description
 * 协调工作流交互的核心 composable。
 * 它充当各种工作流相关操作（如节点/边操作、历史记录、接口管理、预览执行）的中心枢纽。
 * 这个协调器确保状态更新和历史记录以原子方式发生，并触发必要的副作用（如预览）。
 */
export function useWorkflowInteractionCoordinator() {
  const workflowManager = useWorkflowManager();
  const historyManager = useWorkflowHistory();
  const workflowViewManagement = useWorkflowViewManagement();
  const workflowInterfaceManagement = useWorkflowInterfaceManagement();
  const workflowGrouping = useWorkflowGrouping();
  const tabStore = useTabStore();
  const { requestPreviewExecution, isPreviewEnabled } = useWorkflowPreview(); // 使用新的预览 composable

  // --- 内部辅助函数 ---

  /**
   * 获取当前活动标签页或指定标签页的最新状态快照。
   * @param internalId - 可选的标签页内部 ID。如果未提供，则使用活动标签页的 ID。
   * @returns 当前工作流状态快照，如果找不到或没有活动标签页则返回 undefined。
   */
  function _getCurrentSnapshot(internalId?: string): WorkflowStateSnapshot | undefined {
    const idToUse = internalId ?? tabStore.activeTabId;
    if (!idToUse) {
      console.warn("[InteractionCoordinator] 无法获取快照：没有活动标签页或未提供 ID。");
      return undefined;
    }
    // workflowManager.getCurrentSnapshot 在找不到时会返回 undefined
    return workflowManager.getCurrentSnapshot(idToUse);
  }

  /**
   * 记录历史快照的辅助函数。
   * @param internalId - 标签页的内部 ID。
   * @param entry - 要记录的历史条目信息。
   * @param snapshotToRecord - 可选的快照对象。如果提供，则记录此快照；否则，从管理器获取当前快照。
   */
  function _recordHistory(
    internalId: string,
    entry: HistoryEntry,
    snapshotToRecord?: WorkflowStateSnapshot
  ) {
    const snapshot = snapshotToRecord ?? _getCurrentSnapshot(internalId);
    if (snapshot) {
      // 将完整的 entry 对象传递给 historyManager
      historyManager.recordSnapshot(internalId, entry, snapshot);
      // console.debug(`[InteractionCoordinator] 已记录标签页 ${internalId} 的快照: "${entry.summary}"`);
    } else {
      console.warn(
        `[InteractionCoordinator] 无法获取或使用提供的快照为标签页 ${internalId} 记录历史: "${entry.summary}"`
      );
    }
  }

  // --- 状态更新与历史记录函数 ---
  // 这些函数遵循一个通用模式：
  // 1. 获取当前快照 (修改前)。
  // 2. 准备下一个状态快照 (深拷贝当前快照并应用更改)。
  // 3. 应用状态更新 (通常通过 workflowManager)。
  // 4. 记录历史 (使用准备好的下一个状态快照)。
  // 5. (可选) 触发副作用，例如预览执行。

  /**
   * 更新节点输入值，记录历史，并在启用预览时触发预览请求。
   * @param internalId - 标签页的内部 ID。
   * @param nodeId - 目标节点的 ID。
   * @param inputKey - 要更新的输入端口的键名。
   * @param value - 新的输入值。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function updateNodeInputValueAndRecord(
    internalId: string,
    nodeId: string,
    inputKey: string,
    value: any,
    entry: HistoryEntry
  ) {
    if (!internalId || !nodeId || inputKey === undefined) {
      console.warn("[InteractionCoordinator:updateNodeInputValueAndRecord] 无效参数。");
      return;
    }

    // 1. 获取当前快照
    const currentSnapshot = _getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(`[InteractionCoordinator:updateNodeInputValueAndRecord] 无法获取标签页 ${internalId} 的当前快照。`);
      return;
    }

    // 2. 准备下一个状态快照
    const nextSnapshot = klona(currentSnapshot);
    const nodeIndex = nextSnapshot.elements.findIndex((el) => el.id === nodeId && !("source" in el));

    if (nodeIndex === -1) {
      console.error(
        `[InteractionCoordinator:updateNodeInputValueAndRecord] 在标签页 ${internalId} 中未找到节点 ${nodeId}。`
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

    // 3. 应用状态更新
    // setElements 内部处理脏状态标记
    await workflowManager.setElements(internalId, nextSnapshot.elements);

    // 4. 记录历史
    _recordHistory(internalId, entry, nextSnapshot); // 传递准备好的 nextSnapshot

    // 5. 触发预览 (如果启用)
    requestPreviewExecution(internalId, nodeId, inputKey, value);
  }

  /**
   * 更新节点配置值，记录历史，并在启用预览时触发预览请求。
   * 特殊处理 NodeGroup 的 referencedWorkflowId 更改。
   * @param internalId - 标签页的内部 ID。
   * @param nodeId - 目标节点的 ID。
   * @param configKey - 要更新的配置项的键名。
   * @param value - 新的配置值。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function updateNodeConfigValueAndRecord(
    internalId: string,
    nodeId: string,
    configKey: string,
    value: any,
    entry: HistoryEntry
  ) {
    if (!internalId || !nodeId || configKey === undefined) {
      console.warn("[InteractionCoordinator:updateNodeConfigValueAndRecord] 无效参数。");
      return;
    }

    // 1. 获取当前快照
    const currentSnapshot = _getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(`[InteractionCoordinator:updateNodeConfigValueAndRecord] 无法获取标签页 ${internalId} 的当前快照。`);
      return;
    }

    // 2. 准备下一个状态快照
    const nextSnapshot = klona(currentSnapshot);
    const nodeIndex = nextSnapshot.elements.findIndex((el) => el.id === nodeId && !("source" in el));

    if (nodeIndex === -1) {
      console.error(
        `[InteractionCoordinator:updateNodeConfigValueAndRecord] 在标签页 ${internalId} 中未找到节点 ${nodeId}。`
      );
      return;
    }

    // 3. 修改 nextSnapshot 中的目标节点数据和可能的边
    const targetNode = nextSnapshot.elements[nodeIndex] as VueFlowNode;
    let finalElements = nextSnapshot.elements; // 从克隆的元素开始

    // 3.1 准备基础的节点数据更新 (configValues)
    const baseDataUpdate = {
      ...targetNode.data,
      configValues: {
        ...(targetNode.data.configValues || {}),
        [configKey]: value, // 更新配置值
      },
    };
    targetNode.data = baseDataUpdate; // 在快照中更新数据

    // 3.2 特殊处理：NodeGroup referencedWorkflowId
    const nodeType = getNodeType(targetNode);
    if (nodeType === 'core:NodeGroup' && configKey === "referencedWorkflowId") {
      const newWorkflowId = value as string | null;
      if (newWorkflowId) {
        console.debug(`[InteractionCoordinator] 触发 NodeGroup ${nodeId} 的接口更新，工作流为 ${newWorkflowId}`);
        // 注意：updateNodeGroupWorkflowReference 可能会在内部调用 setElements，
        // 这可能与此模式冲突。理想情况下，它应该返回必要的更改
        // (更新的节点数据、要移除的边) 而不直接应用它们。
        // 暂时假设它返回更改。
        const groupUpdateResult = await workflowGrouping.updateNodeGroupWorkflowReference(nodeId, newWorkflowId, internalId);

        if (groupUpdateResult.success && groupUpdateResult.updatedNodeData) {
          // 将更新的数据合并到 nextSnapshot 中的节点
          targetNode.data = {
            ...targetNode.data, // 保留 configValue 更新
            groupInterface: groupUpdateResult.updatedNodeData.groupInterface,
            label: groupUpdateResult.updatedNodeData.label,
          };
          console.debug(`[InteractionCoordinator] 已将 NodeGroup 数据更新合并到 ${nodeId} 的 nextSnapshot`);

          // 如果需要，在 nextSnapshot 中过滤边
          if (groupUpdateResult.edgeIdsToRemove && groupUpdateResult.edgeIdsToRemove.length > 0) {
            const edgeIdsToRemoveSet = new Set(groupUpdateResult.edgeIdsToRemove);
            const originalElementCount = finalElements.length;
            finalElements = finalElements.filter(el => !('source' in el) || !edgeIdsToRemoveSet.has(el.id));
            nextSnapshot.elements = finalElements; // 更新快照中的元素
            console.debug(`[InteractionCoordinator] 在 NodeGroup ${nodeId} 的 nextSnapshot 中过滤了 ${originalElementCount - finalElements.length} 条不兼容的边`);
          }
        } else {
          console.error(`[InteractionCoordinator] 获取 NodeGroup ${nodeId} 的更新数据失败。将在没有接口/边更新的情况下继续。`);
        }
      } else {
        // 清空引用的工作流 ID
        console.warn(
          `[InteractionCoordinator] NodeGroup ${nodeId} 的 referencedWorkflowId 已清除。接口清除逻辑尚未实现。`
        );
        // 此处可能需要在 nextSnapshot 中清除 groupInterface 和 label
        // targetNode.data.groupInterface = {};
        // targetNode.data.label = 'NodeGroup'; // 或默认标签
      }
    }

    // 4. 应用状态更新 (使用 nextSnapshot 的最终 elements)
    await workflowManager.setElements(internalId, finalElements);

    // 5. 记录历史 (使用准备好的 nextSnapshot)
    _recordHistory(internalId, entry, nextSnapshot);

    // 6. 触发预览 (如果启用)
    // 注意：预览通常针对输入值的变化。配置值的变化是否需要触发预览取决于具体情况。
    // 如果配置变化影响输出，则可能需要触发预览。
    // 这里假设配置变化也需要触发预览。
    requestPreviewExecution(internalId, nodeId, configKey, value);
  }

  /**
   * 更新一个或多个节点的位置，并原子性地记录历史快照。
   * @param internalId - 目标标签页的内部 ID。
   * @param updates - 一个包含 { nodeId, position } 对象的数组，描述要更新的节点及其新位置。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function updateNodePositionAndRecord(
    internalId: string,
    updates: { nodeId: string; position: { x: number; y: number } }[],
    entry: HistoryEntry
  ) {
    if (!internalId || !updates || updates.length === 0) {
      console.warn(
        "[InteractionCoordinator:updateNodePositionAndRecord] 提供了无效参数。"
      );
      return;
    }
    // 1. 获取当前快照
    const currentSnapshot = _getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(`[InteractionCoordinator:updateNodePositionAndRecord] 无法获取标签页 ${internalId} 的当前快照。`);
      return;
    }

    // 2. 准备下一个状态快照
    const nextSnapshot = klona(currentSnapshot);
    // 创建一个节点 ID 到节点对象的映射，方便查找
    const nodeMap = new Map(nextSnapshot.elements.filter(el => !('source' in el)).map(node => [node.id, node as VueFlowNode]));

    // 修改 nextSnapshot 中的节点位置
    let updated = false;
    for (const update of updates) {
      const node = nodeMap.get(update.nodeId);
      if (node) {
        node.position = update.position;
        updated = true;
      } else {
        console.warn(`[InteractionCoordinator:updateNodePositionAndRecord] 更新时在快照中未找到节点 ${update.nodeId}。`);
      }
    }

    // 如果没有任何节点被实际更新，则跳过
    if (!updated) {
      console.warn("[InteractionCoordinator:updateNodePositionAndRecord] 没有节点被更新。跳过历史记录。");
      return;
    }

    // 3. 应用状态更新
    // 注意：workflowManager.updateNodePositions 内部会调用 setElements。
    // 理想情况下，我们应该直接调用 setElements(internalId, nextSnapshot.elements) 以符合模式。
    // 但为了最小化改动，暂时保留 updateNodePositions 调用，假设它只更新位置。
    await workflowManager.updateNodePositions(internalId, updates);

    // 4. 记录历史
    // 传递 nextSnapshot 确保记录的是我们预期的、包含所有位置更新的状态
    _recordHistory(internalId, entry, nextSnapshot);
  }

  /**
   * 处理需要同时添加边和更新工作流接口（例如 GroupInput/GroupOutput）的连接操作。
   * 原子性地更新状态、记录历史并更新视图（触发节点内部更新）。
   * @param internalId - 标签页的内部 ID。
   * @param newEdge - 要添加的新边的定义。
   * @param newInputs - 更新后的完整输入接口定义 (Record<string, GroupSlotInfo>)。
   * @param newOutputs - 更新后的完整输出接口定义 (Record<string, GroupSlotInfo>)。
   * @param sourceNodeId - 连接的源节点 ID。
   * @param targetNodeId - 连接的目标节点 ID。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function handleConnectionWithInterfaceUpdate(
    internalId: string,
    newEdge: Edge,
    newInputs: Record<string, GroupSlotInfo>,
    newOutputs: Record<string, GroupSlotInfo>,
    sourceNodeId: string,
    targetNodeId: string,
    entry: HistoryEntry
  ) {
    // 1. 获取当前快照
    const currentSnapshot = _getCurrentSnapshot(internalId);
    if (!currentSnapshot || !currentSnapshot.workflowData) {
      console.error(`[handleConnectionWithInterfaceUpdate] 无法获取标签页 ${internalId} 的当前快照或缺少 workflowData。`);
      return;
    }

    // 2. 准备下一个状态快照 (添加边并更新接口)
    const nextSnapshot: WorkflowStateSnapshot = {
      elements: [...currentSnapshot.elements, newEdge], // 添加新边
      viewport: currentSnapshot.viewport,
      workflowData: {
        ...currentSnapshot.workflowData,
        interfaceInputs: newInputs, // 更新输入接口
        interfaceOutputs: newOutputs, // 更新输出接口
      },
    };

    // 4. 记录历史 (在应用状态之前记录，以避免潜在的观察者竞态条件)
    _recordHistory(internalId, entry, nextSnapshot);

    // 3. 应用状态更新 (同时设置元素和接口)
    await workflowManager.setElementsAndInterface(
      internalId,
      nextSnapshot.elements,
      nextSnapshot.workflowData?.interfaceInputs ?? {},
      nextSnapshot.workflowData?.interfaceOutputs ?? {}
    );

    // 5. 触发视图更新 (强制更新连接节点的内部结构)
    const instance = workflowViewManagement.getVueFlowInstance(internalId);
    if (instance) {
      await nextTick(); // 等待 DOM 更新
      instance.updateNodeInternals([sourceNodeId, targetNodeId]); // 更新节点内部
      await nextTick(); // 确保 updateNodeInternals 完成后的更新生效
    } else {
      console.warn(`[InteractionCoordinator] 无法获取标签页 ${internalId} 的 VueFlow 实例以强制 updateNodeInternals。`);
    }
  }

  /**
   * 将单个节点添加到指定标签页的状态并记录历史。
   * @param internalId - 目标标签页的内部 ID。
   * @param nodeToAdd - 要添加的 VueFlowNode 对象。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function addNodeAndRecord(internalId: string, nodeToAdd: VueFlowNode, entry: HistoryEntry) {
    if (!internalId || !nodeToAdd) {
      console.warn("[InteractionCoordinator:addNodeAndRecord] 提供了无效参数。");
      return;
    }
    // 1. 获取当前快照
    const currentSnapshot = _getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(`[InteractionCoordinator:addNodeAndRecord] 无法获取标签页 ${internalId} 的当前快照。`);
      return;
    }

    // 2. 准备下一个状态快照 (深拷贝并添加节点)
    const nextSnapshot = klona(currentSnapshot);
    nextSnapshot.elements.push(nodeToAdd);

    // 3. 应用状态更新
    // 注意：workflowManager.addNode 内部可能调用 setElements。
    // 理想情况是直接调用 setElements(internalId, nextSnapshot.elements)。
    // 暂时保留 addNode 调用。
    await workflowManager.addNode(internalId, nodeToAdd);

    // 4. 记录历史
    _recordHistory(internalId, entry, nextSnapshot); // 传递准备好的 nextSnapshot
  }

  /**
   * 原子性地更新工作流接口（输入/输出），并处理因接口删除而需要移除的边，最后记录历史。
   * @param internalId - 标签页的内部 ID。
   * @param updateFn - 一个函数，接收当前的 inputs 和 outputs，并返回更新后的 { inputs, outputs } 对象。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function updateWorkflowInterfaceAndRecord(
    internalId: string,
    updateFn: (
      currentInputs: Record<string, GroupSlotInfo>,
      currentOutputs: Record<string, GroupSlotInfo>
    ) => {
      inputs: Record<string, GroupSlotInfo>;
      outputs: Record<string, GroupSlotInfo>;
    },
    entry: HistoryEntry
  ) {
    // 记录更新前的接口键
    const stateBefore = workflowManager.getAllTabStates.value.get(internalId);
    const oldInputKeys = new Set(Object.keys(stateBefore?.workflowData?.interfaceInputs || {}));
    const oldOutputKeys = new Set(Object.keys(stateBefore?.workflowData?.interfaceOutputs || {}));

    // 调用接口管理模块更新接口
    await workflowInterfaceManagement.updateWorkflowInterface(internalId, updateFn);

    // 获取更新后的状态
    const stateAfter = workflowManager.getAllTabStates.value.get(internalId);
    if (!stateAfter) {
      console.error(`[InteractionCoordinator] 更新接口后无法获取标签页 ${internalId} 的状态。无法过滤边。`);
      // 尝试记录历史，但可能不包含边的更改
      _recordHistory(internalId, entry);
      return;
    }

    // 确定被删除的接口键
    const newInputKeys = new Set(Object.keys(stateAfter.workflowData?.interfaceInputs || {}));
    const newOutputKeys = new Set(Object.keys(stateAfter.workflowData?.interfaceOutputs || {}));
    const deletedInputKeys = new Set([...oldInputKeys].filter(k => !newInputKeys.has(k)));
    const deletedOutputKeys = new Set([...oldOutputKeys].filter(k => !newOutputKeys.has(k)));

    // 如果有接口被删除，则过滤掉连接到这些接口的边
    let edgesRemovedCount = 0;
    let filteredElements = stateAfter.elements || [];
    const removedEdges: Edge[] = []; // 存储被移除的边信息以供历史记录
    const nodesMap = new Map(filteredElements.filter((el): el is VueFlowNode => !("source" in el)).map(node => [node.id, node]));

    if (deletedInputKeys.size > 0 || deletedOutputKeys.size > 0) {
      console.debug(`[InteractionCoordinator] 接口插槽已移除。正在过滤边...`);
      filteredElements = filteredElements.filter(el => {
        if (!("source" in el)) return true; // 保留节点
        const edge = el as Edge;
        const sourceNode = nodesMap.get(edge.source);
        const targetNode = nodesMap.get(edge.target);
        let shouldRemove = false;
        // 检查边是否连接到已删除的 GroupInput 或 GroupOutput 句柄
        if (sourceNode?.type === 'core:GroupInput' && deletedInputKeys.has(edge.sourceHandle ?? '')) shouldRemove = true;
        if (targetNode?.type === 'core:GroupOutput' && deletedOutputKeys.has(edge.targetHandle ?? '')) shouldRemove = true;

        if (shouldRemove) {
          removedEdges.push(klona(edge)); // 记录被移除的边
          edgesRemovedCount++;
          return false; // 过滤掉这条边
        }
        return true; // 保留这条边
      });

      // 如果有边被移除，则更新元素状态
      if (edgesRemovedCount > 0) {
        workflowManager.setElements(internalId, filteredElements);
        console.debug(`[InteractionCoordinator] 移除 ${edgesRemovedCount} 条边后更新了元素。`);
      } else {
        console.debug(`[InteractionCoordinator] 无需移除边。`);
      }
    }

    // 将移除的边信息添加到历史记录条目的 details 中
    if (removedEdges.length > 0) {
      const removedEdgeDetails = removedEdges.map(edge => ({ id: edge.id, source: edge.source, sourceHandle: edge.sourceHandle, target: edge.target, targetHandle: edge.targetHandle }));
      entry.details = { ...(entry.details || {}), removedEdges: removedEdgeDetails };
      console.debug(`[InteractionCoordinator] 已将 ${removedEdges.length} 条移除边的详细信息添加到历史条目。`);
    }

    // 获取最终状态作为 nextSnapshot (应用了接口更新和边过滤后的状态)
    const finalSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!finalSnapshot) {
      console.error(`[InteractionCoordinator] 接口更新后无法获取标签页 ${internalId} 的最终状态。无法准确记录历史。`);
      // 尝试使用 stateAfter 作为回退，但不保证完全准确
      _recordHistory(internalId, entry, stateAfter);
      return;
    }

    // 记录最终的历史快照
    _recordHistory(internalId, entry, finalSnapshot);
  }

  /**
   * 将单个边添加到指定标签页的状态并记录历史。
   * @param internalId - 目标标签页的内部 ID。
   * @param edgeToAdd - 要添加的 Edge 对象。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function addEdgeAndRecord(internalId: string, edgeToAdd: Edge, entry: HistoryEntry) {
    if (!internalId || !edgeToAdd) {
      console.warn("[InteractionCoordinator:addEdgeAndRecord] 提供了无效参数。");
      return;
    }
    // 1. 获取当前快照
    const currentSnapshot = _getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(`[addEdgeAndRecord] 无法获取标签页 ${internalId} 的当前快照。`);
      return;
    }

    // 2. 准备下一个状态快照 (添加边)
    const nextSnapshot: WorkflowStateSnapshot = {
      ...currentSnapshot,
      elements: [...currentSnapshot.elements, edgeToAdd],
    };

    // 3. 应用状态更新
    workflowManager.setElements(internalId, nextSnapshot.elements);

    // 4. 记录历史
    _recordHistory(internalId, entry, nextSnapshot);
  }

  /**
   * 删除指定的元素（节点和/或边）并记录历史。
   * @param internalId - 目标标签页的内部 ID。
   * @param elementsToRemove - 要删除的节点或边对象的数组。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function removeElementsAndRecord(
    internalId: string,
    elementsToRemove: (VueFlowNode | Edge)[],
    entry: HistoryEntry
  ) {
    if (!internalId || !elementsToRemove || elementsToRemove.length === 0) {
      console.warn("[InteractionCoordinator:removeElementsAndRecord] 提供了无效参数。");
      return;
    }

    // 获取当前元素和要移除元素的 ID 集合
    const elementIdsToRemoveSet = new Set(elementsToRemove.map((el) => el.id));
    const currentElements = workflowManager.getElements(internalId);
    // 过滤掉要移除的元素
    const remainingElements = currentElements.filter((el) => !elementIdsToRemoveSet.has(el.id));

    // 1. 获取当前快照 (需要完整的快照信息)
    const currentSnapshot = _getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(`[InteractionCoordinator:removeElementsAndRecord] 无法获取标签页 ${internalId} 的当前快照。`);
      return;
    }

    // 检查是否真的有元素被移除，避免无效的历史记录
    if (remainingElements.length === currentSnapshot.elements.length) {
      console.warn("[InteractionCoordinator:removeElementsAndRecord] 没有元素被实际移除。跳过历史记录。");
      return;
    }

    // 2. 准备下一个状态快照 (使用过滤后的元素)
    const nextSnapshot: WorkflowStateSnapshot = {
      ...currentSnapshot, // 保留 viewport 和 workflowData
      elements: remainingElements,
    };

    // 3. 应用状态更新
    workflowManager.setElements(internalId, nextSnapshot.elements);

    // 4. 记录历史
    _recordHistory(internalId, entry, nextSnapshot); // 传递准备好的 nextSnapshot
  }

  /**
   * 删除连接到指定节点句柄的所有边并记录历史。
   * @param internalId - 目标标签页的内部 ID。
   * @param nodeId - 目标节点的 ID。
   * @param handleId - 目标句柄的 ID。
   * @param handleType - 句柄类型 ('source' 或 'target')。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function removeEdgesByHandleAndRecord(
    internalId: string,
    nodeId: string,
    handleId: string,
    handleType: 'source' | 'target',
    entry: HistoryEntry
  ) {
    if (!internalId || !nodeId || !handleId || !handleType) {
      console.warn('[InteractionCoordinator:removeEdgesByHandleAndRecord] 提供了无效参数。');
      return;
    }
    // 1. 获取当前快照
    const currentSnapshot = _getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(`[removeEdgesByHandleAndRecord] 无法获取标签页 ${internalId} 的当前快照。`);
      return;
    }

    // 过滤掉连接到指定句柄的边
    const edgesToRemove: Edge[] = [];
    const remainingElements = currentSnapshot.elements.filter(el => {
      if (!('source' in el)) return true; // 保留节点
      const edge = el as Edge;
      let shouldRemove = false;
      if (handleType === 'source' && edge.source === nodeId && edge.sourceHandle === handleId) shouldRemove = true;
      else if (handleType === 'target' && edge.target === nodeId && edge.targetHandle === handleId) shouldRemove = true;

      if (shouldRemove) {
        edgesToRemove.push(klona(edge)); // 记录被移除的边
        return false; // 过滤掉这条边
      }
      return true; // 保留这条边
    });

    // 如果没有边被移除，则直接返回
    if (edgesToRemove.length === 0) {
      console.warn(`[InteractionCoordinator:removeEdgesByHandleAndRecord] 未找到连接到节点 ${nodeId} 句柄 ${handleId} (${handleType}) 的边。未做任何更改。`);
      return;
    }

    // 2. 准备下一个状态快照
    const nextSnapshot: WorkflowStateSnapshot = {
      ...currentSnapshot,
      elements: remainingElements,
    };

    // 3. 应用状态更新
    workflowManager.setElements(internalId, remainingElements);

    // 4. 记录历史 (包含移除边的详细信息)
    const removedEdgeDetails = edgesToRemove.map(edge => ({ id: edge.id, source: edge.source, sourceHandle: edge.sourceHandle, target: edge.target, targetHandle: edge.targetHandle }));
    entry.details = { ...(entry.details || {}), nodeId, handleId, handleType, removedEdges: removedEdgeDetails };
    _recordHistory(internalId, entry, nextSnapshot);
  }

  /**
   * 更新节点的尺寸（宽度和/或高度）并记录历史。
   * @param internalId - 标签页的内部 ID。
   * @param nodeId - 目标节点的 ID。
   * @param dimensions - 包含 { width?: number, height?: number } 的对象，指定新的尺寸。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function updateNodeDimensionsAndRecord(
    internalId: string,
    nodeId: string,
    dimensions: { width?: number; height?: number },
    entry: HistoryEntry
  ) {
    if (!internalId || !nodeId || (!dimensions.width && !dimensions.height)) {
      console.warn("[InteractionCoordinator:updateNodeDimensionsAndRecord] 无效参数。");
      return;
    }

    // 获取当前元素并找到目标节点索引
    const currentElements = workflowManager.getElements(internalId);
    const nodeIndex = currentElements.findIndex((el: VueFlowNode | Edge) => el.id === nodeId && !("source" in el));
    if (nodeIndex === -1) {
      console.error(`[InteractionCoordinator:updateNodeDimensionsAndRecord] 在标签页 ${internalId} 中未找到节点 ${nodeId}。`);
      return;
    }

    // 创建元素的深拷贝以进行修改
    const newElements = klona(currentElements);
    const targetNode = newElements[nodeIndex] as VueFlowNode;

    // 更新目标节点的宽度和/或高度及其样式
    if (dimensions.width !== undefined) {
      targetNode.width = dimensions.width;
      targetNode.style = { ...(targetNode.style || {}), width: `${dimensions.width}px` };
    }
    if (dimensions.height !== undefined) {
      targetNode.height = dimensions.height;
      targetNode.style = { ...(targetNode.style || {}), height: `${dimensions.height}px` };
    }

    // 1. 获取当前快照 (用于比较和记录)
    const currentSnapshot = _getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(`[InteractionCoordinator:updateNodeDimensionsAndRecord] 无法获取标签页 ${internalId} 的当前快照。`);
      return;
    }

    // 检查尺寸是否真的发生了变化
    const originalNode = currentSnapshot.elements[nodeIndex] as VueFlowNode;
    const hasChanged = (dimensions.width !== undefined && originalNode.width !== dimensions.width) ||
      (dimensions.height !== undefined && originalNode.height !== dimensions.height);

    // 如果尺寸未变，则跳过
    if (!hasChanged) {
      console.debug("[InteractionCoordinator:updateNodeDimensionsAndRecord] 尺寸未改变。跳过历史记录。");
      return;
    }

    // 2. 准备下一个状态快照 (newElements 已经是修改后的)
    const nextSnapshot: WorkflowStateSnapshot = {
      ...currentSnapshot,
      elements: newElements,
    };

    // 3. 应用状态更新
    await workflowManager.setElements(internalId, nextSnapshot.elements);

    // 4. 记录历史
    _recordHistory(internalId, entry, nextSnapshot); // 传递准备好的 nextSnapshot
  }

  /**
   * 更新节点内部特定组件的状态（例如文本区域的高度或值）并记录历史。
   * 用于处理节点内部 UI 组件引起的状态变化。
   * @param internalId - 标签页的内部 ID。
   * @param nodeId - 目标节点的 ID。
   * @param inputKey - 与组件关联的输入端口的键名（用于标识组件）。
   * @param stateUpdate - 包含要更新的状态的对象，例如 { height?: number, value?: string }。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function updateNodeComponentStateAndRecord(
    internalId: string,
    nodeId: string,
    inputKey: string,
    stateUpdate: { height?: number; value?: string },
    entry: HistoryEntry
  ) {
    if (!internalId || !nodeId || !inputKey || !stateUpdate) {
      console.warn('[InteractionCoordinator:updateNodeComponentStateAndRecord] 无效参数。');
      return;
    }

    // 获取当前元素并找到目标节点索引
    const currentElements = workflowManager.getElements(internalId);
    const nodeIndex = currentElements.findIndex((el) => el.id === nodeId && !('source' in el));
    if (nodeIndex === -1) {
      console.error(`[InteractionCoordinator:updateNodeComponentStateAndRecord] 在标签页 ${internalId} 中未找到节点 ${nodeId}。`);
      return;
    }

    // 创建元素的深拷贝以进行修改
    const newElements = klona(currentElements);
    const targetNode = newElements[nodeIndex] as VueFlowNode;

    // 更新目标节点 data 中的 componentStates
    targetNode.data = targetNode.data || {};
    targetNode.data.componentStates = targetNode.data.componentStates || {};
    targetNode.data.componentStates[inputKey] = targetNode.data.componentStates[inputKey] || {};
    if (stateUpdate.height !== undefined) targetNode.data.componentStates[inputKey].height = stateUpdate.height;
    if (stateUpdate.value !== undefined) targetNode.data.componentStates[inputKey].value = stateUpdate.value;

    // 1. 获取当前快照 (用于比较和记录)
    const currentSnapshot = _getCurrentSnapshot(internalId);
    if (!currentSnapshot) {
      console.error(`[InteractionCoordinator:updateNodeComponentStateAndRecord] 无法获取标签页 ${internalId} 的当前快照。`);
      return;
    }

    // 检查状态是否真的发生了变化
    const originalNode = currentSnapshot.elements[nodeIndex] as VueFlowNode;
    const originalComponentState = originalNode.data?.componentStates?.[inputKey] || {};
    const hasChanged = (stateUpdate.height !== undefined && originalComponentState.height !== stateUpdate.height) ||
      (stateUpdate.value !== undefined && originalComponentState.value !== stateUpdate.value);

    // 如果状态未变，则跳过
    if (!hasChanged) {
      console.debug("[InteractionCoordinator:updateNodeComponentStateAndRecord] 组件状态未改变。跳过历史记录。");
      return;
    }

    // 2. 准备下一个状态快照 (newElements 已经是修改后的)
    const nextSnapshot: WorkflowStateSnapshot = {
      ...currentSnapshot,
      elements: newElements,
    };

    // 3. 应用状态更新
    await workflowManager.setElements(internalId, nextSnapshot.elements);

    // 4. 记录历史
    _recordHistory(internalId, entry, nextSnapshot); // 传递准备好的 nextSnapshot
  }

  /**
   * 更新工作流的名称，记录历史，并更新标签页标题。
   * @param internalId - 标签页的内部 ID。
   * @param newName - 新的工作流名称。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function updateWorkflowNameAndRecord(
    internalId: string,
    newName: string,
    entry: HistoryEntry
  ) {
    if (!internalId || newName === undefined) {
      console.warn("[InteractionCoordinator:updateWorkflowNameAndRecord] 无效参数。");
      return;
    }
    // 1. 获取当前快照
    const currentSnapshot = _getCurrentSnapshot(internalId);
    if (!currentSnapshot || !currentSnapshot.workflowData) {
      console.error(`[updateWorkflowNameAndRecord] 无法获取标签页 ${internalId} 的当前快照或 workflowData。`);
      return;
    }

    // 如果名称未改变，则跳过
    if (currentSnapshot.workflowData.name === newName) {
      console.debug(`[updateWorkflowNameAndRecord] 标签页 ${internalId} 的名称未改变。跳过。`);
      return;
    }

    // 2. 准备下一个状态快照
    const nextSnapshot = klona(currentSnapshot);
    nextSnapshot.workflowData!.name = newName; // 更新名称

    // 3. 应用状态更新 (使用 applyStateSnapshot 更新 workflowData)
    const applied = workflowManager.applyStateSnapshot(internalId, nextSnapshot);

    if (applied) {
      // 4. 记录历史
      _recordHistory(internalId, entry, nextSnapshot);
      // 5. 标记为脏状态并更新标签页标题
      workflowManager.markAsDirty(internalId);
      tabStore.updateTab(internalId, { label: newName });
    } else {
      console.error(`[updateWorkflowNameAndRecord] 应用快照失败 for tab ${internalId}.`);
    }
  }

  /**
   * 更新工作流的描述并记录历史。
   * @param internalId - 标签页的内部 ID。
   * @param newDescription - 新的工作流描述。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function updateWorkflowDescriptionAndRecord(
    internalId: string,
    newDescription: string,
    entry: HistoryEntry
  ) {
    if (!internalId || newDescription === undefined) {
      console.warn("[InteractionCoordinator:updateWorkflowDescriptionAndRecord] 无效参数。");
      return;
    }
    // 1. 获取当前快照
    const currentSnapshot = _getCurrentSnapshot(internalId);
    if (!currentSnapshot || !currentSnapshot.workflowData) {
      console.error(`[updateWorkflowDescriptionAndRecord] 无法获取标签页 ${internalId} 的当前快照或 workflowData。`);
      return;
    }

    // 如果描述未改变，则跳过
    const currentDescription = currentSnapshot.workflowData.description || "";
    if (currentDescription === newDescription) {
      console.debug(`[updateWorkflowDescriptionAndRecord] 标签页 ${internalId} 的描述未改变。跳过。`);
      return;
    }

    // 2. 准备下一个状态快照
    const nextSnapshot = klona(currentSnapshot);
    nextSnapshot.workflowData!.description = newDescription; // 更新描述

    // 3. 应用状态更新
    const applied = workflowManager.applyStateSnapshot(internalId, nextSnapshot);

    if (applied) {
      // 4. 记录历史
      _recordHistory(internalId, entry, nextSnapshot);
      // 5. 标记为脏状态
      workflowManager.markAsDirty(internalId);
    } else {
      console.error(`[updateWorkflowDescriptionAndRecord] 应用快照失败 for tab ${internalId}.`);
    }
  }

  /**
   * 设置或清除工作流的预览目标，并记录历史。
   * @param internalId - 标签页的内部 ID。
   * @param target - 预览目标对象 { nodeId: string, slotKey: string } 或 null 来清除。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function setPreviewTargetAndRecord(
    internalId: string,
    target: { nodeId: string; slotKey: string } | null,
    entry: HistoryEntry
  ) {
    if (!internalId) {
      console.warn("[InteractionCoordinator:setPreviewTargetAndRecord] 无效的 internalId。");
      return;
    }

    // 如果正在尝试设置目标 (而不是清除)
    if (target) {
      const currentWorkflowState = workflowManager.getCurrentSnapshot(internalId); // 修正：使用 getCurrentSnapshot
      if (currentWorkflowState?.elements) {
        const targetNode = currentWorkflowState.elements.find((el: VueFlowNode | Edge) => el.id === target.nodeId && !("source" in el)) as VueFlowNode | undefined; // 修正：添加 el 类型
        if (targetNode) {
          let slotType: string | undefined;
          // 检查是否为 GroupInput 或 GroupOutput 节点，它们从 workflowData 获取接口定义
          // 注意：GroupInput 节点的输出 Handle 代表其在 workflowData.interfaceInputs 中的定义
          // GroupOutput 节点的输出 Handle 代表其在 workflowData.interfaceOutputs 中的定义
          if (targetNode.type === 'core:GroupInput') {
            const workflowData = currentWorkflowState.workflowData;
            // GroupInput 节点的输出 Handle (source handle) 对应于 interfaceInputs
            if (workflowData?.interfaceInputs) { // 确保 interfaceInputs 存在
              slotType = workflowData.interfaceInputs[target.slotKey]?.dataFlowType; // 使用可选链
            }
          } else if (targetNode.type === 'core:GroupOutput') {
             // GroupOutput 节点没有输出 Handle (source handle) 可供预览，预览目标通常是普通节点的输出或 GroupInput 的输出
             // 此处逻辑可能需要审阅，因为 GroupOutput 的输出是连接到其 target Handle 的
             // 但如果确实要支持预览 GroupOutput 的“概念性”输出，则需要从 interfaceOutputs 查找
             // 假设这里的 target.slotKey 指的是 GroupOutput 节点上代表其最终输出的那个 Handle ID
             // 这通常是其在 workflowData.interfaceOutputs 中的 key
            const workflowData = currentWorkflowState.workflowData;
            if (workflowData?.interfaceOutputs) { // 确保 interfaceOutputs 存在
              slotType = workflowData.interfaceOutputs[target.slotKey]?.dataFlowType; // 使用可选链
            }
          } else {
            // 普通节点的输出插槽
            const outputDefinition = targetNode.data?.outputSchema?.[target.slotKey] || targetNode.data?.outputs?.[target.slotKey];
            slotType = outputDefinition?.dataFlowType;
          }

          if (slotType === DataFlowType.WILDCARD || slotType === DataFlowType.CONVERTIBLE_ANY) {
            console.warn(`[InteractionCoordinator:setPreviewTargetAndRecord] 尝试将类型为 ${slotType} 的插槽 ${target.nodeId}::${target.slotKey} 设置为预览目标，已阻止。`);
            return; // 阻止设置
          }
        } else {
          console.warn(`[InteractionCoordinator:setPreviewTargetAndRecord] 尝试设置预览目标时未找到节点 ${target.nodeId}。`);
        }
      }
    }

    // 1. 获取当前快照
    const currentSnapshot = _getCurrentSnapshot(internalId);
    if (!currentSnapshot || !currentSnapshot.workflowData) {
      console.error(`[setPreviewTargetAndRecord] 无法获取标签页 ${internalId} 的当前快照或 workflowData。`);
      return;
    }

    // 检查预览目标是否真的发生了变化
    const oldTargetJson = JSON.stringify(currentSnapshot.workflowData.previewTarget ?? null);
    const newTargetJson = JSON.stringify(target ?? null);

    if (oldTargetJson === newTargetJson) {
      console.debug(`[setPreviewTargetAndRecord] 标签页 ${internalId} 的预览目标未改变。跳过。`);
      return;
    }

    // 2. 准备下一个状态快照
    const nextSnapshot = klona(currentSnapshot);
    if (nextSnapshot.workflowData) { // Type guard
        nextSnapshot.workflowData.previewTarget = target ? klona(target) : null;
    }


    // 3. 应用状态更新 (通过 workflowManager)
    // workflowManager.setPreviewTarget 内部会处理脏状态标记
    await workflowManager.setPreviewTarget(internalId, target);

    // 4. 记录历史
    _recordHistory(internalId, entry, nextSnapshot);

    // 5. 触发预览 (可选，根据需求)
    // 当前设计是设置目标时不触发，而是后续节点值变化时触发
    // if (isPreviewEnabled.value && target) {
    //   requestPreviewExecution(internalId, target.nodeId, target.slotKey, /* 获取当前值? */);
    // }
    console.debug(`[InteractionCoordinator] 已为标签页 ${internalId} 设置预览目标并记录历史: ${newTargetJson}`);
  }

  /**
   * 打开可停靠编辑器以编辑节点输入。
   * @param activeTabId - 当前活动工作流的 ID。
   * @param nodeId - 目标节点的 ID。
   * @param inputKey - 目标输入的键。
   * @param currentValue - 当前输入值。
   * @param inputDefinition - 目标输入的定义。
   * @param editorTitle - 可选的编辑器标题。
   */
  const openDockedEditorForNodeInput = (
    activeTabId: string,
    nodeId: string,
    inputKey: string,
    currentValue: string,
    inputDefinition: InputDefinition, // InputDefinition 是 GroupSlotInfo
    editorTitle?: string
  ) => {
    const editorState = useEditorState();

    // 确定 editorType
    let editorType = 'text'; // 默认类型
    if (inputDefinition.config?.languageHint) {
      editorType = inputDefinition.config.languageHint as string;
    } else {
      switch (inputDefinition.dataFlowType) {
        case DataFlowType.OBJECT: // 用于 JSON_LIKE
          editorType = 'json';
          break;
        case DataFlowType.STRING: // 用于 MARKDOWN_LIKE 或普通文本
          // 咕咕：如果将来 InputDefinition 包含更丰富的元数据（如 uiHint: 'markdown'），可以在这里判断
          // 目前，如果 dataFlowType 是 STRING 且没有 languageHint，默认为 'text'
          // 如果希望默认为 markdown，可以在这里修改或依赖 inputDefinition.config.uiWidget === 'TextAreaInput' 等前端组件类型
          editorType = 'text'; // 或者 'markdown' 如果有其他提示
          break;
        default:
          editorType = 'text';
          break;
      }
    }
    // 进一步根据 inputDefinition.config.uiWidget (如果存在) 来细化
    // 例如，如果 uiWidget 是 'CodeInput' 且没有 languageHint，可以默认为 'plaintext' 或其他
    if (inputDefinition.config?.uiWidget === 'CodeInput' && !inputDefinition.config?.languageHint) {
      editorType = (inputDefinition.config?.language as string) || 'plaintext';
    } else if (inputDefinition.config?.uiWidget === 'TextAreaInput' && !inputDefinition.config?.languageHint) {
      // TextAreaInput 通常是纯文本，但如果将来支持 markdown 等，可以在这里扩展
      // 也可以检查 inputDefinition.matchCategories 是否包含 BuiltInSocketMatchCategory.MARKDOWN
      if (inputDefinition.matchCategories?.includes('Markdown')) { // 假设 'Markdown' 是 BuiltInSocketMatchCategory 中的一个值
        editorType = 'markdown';
      } else {
        editorType = 'text';
      }
    }

    const finalTitle = editorTitle || `编辑 ${nodeId} - ${inputKey}`;

    const context: EditorOpeningContext = {
      nodeId,
      inputPath: `inputs.${inputKey}`, // 假设我们总是编辑 'inputs' 下的属性
      initialContent: currentValue,
      languageHint: editorType,
      title: finalTitle, // 使用 editorTitle 或生成的默认标题
      // breadcrumbData 和 config 可以根据需要从 inputDefinition 或其他地方填充
      // breadcrumbData: [{ text: `Node: ${nodeId}`, key: nodeId }, { text: `Input: ${inputKey}`, key: inputKey }],
      // config: { ...inputDefinition.config }, // 可以传递 inputDefinition 的 config
      onSave: (newContent) => {
        const historyEntry: HistoryEntry = {
          actionType: "modify", // 使用 actionType
          objectType: "nodeInput", // 使用 objectType
          summary: `更新节点 ${nodeId} 输入 ${inputKey}`,
          timestamp: Date.now(),
          details: {
            nodeId,
            inputKey,
            propertyName: inputKey, // 对应 HistoryEntryDetails
            oldValue: currentValue,
            newValue: newContent,
          },
        };
        updateNodeInputValueAndRecord(activeTabId, nodeId, inputKey, newContent, historyEntry);
        console.log(`[InteractionCoordinator] Docked editor content saved for ${nodeId}.${inputKey}:`, newContent);
      },
    };

    // 确保编辑器面板可见
    if (!editorState.isDockedEditorVisible.value) {
      editorState.toggleDockedEditor();
    }

    // 调用 editorState 中的方法来打开/激活编辑器标签页
    // 假设 editorState 有一个名为 openEditor 的方法
    // editorState.openEditor(context);
    // 咕咕：根据 useEditorState.ts 的当前实现，它还没有 openEditor 方法。
    // 我们需要先在 useEditorState.ts 中实现类似的功能。
    // 暂时，我们只打印日志，表示意图。
    console.log('[InteractionCoordinator] Requesting to open docked editor with context:', context);
    // 咕咕：这里需要调用 useEditorState 提供的实际方法。
    // openOrFocusEditorTab 应该总是存在于 useEditorState 的返回中
    editorState.openOrFocusEditorTab(context);
  };

  // 导出公共接口
  return {
    // --- 核心交互函数 ---
    updateNodePositionAndRecord,          // 更新节点位置
    handleConnectionWithInterfaceUpdate, // 处理带接口更新的连接
    addNodeAndRecord,                     // 添加节点
    updateWorkflowInterfaceAndRecord,     // 更新工作流接口
    addEdgeAndRecord,                     // 添加边
    removeElementsAndRecord,              // 删除元素 (节点/边)
    updateNodeInputValueAndRecord,        // 更新节点输入值 (含预览触发)
    updateNodeConfigValueAndRecord,       // 更新节点配置值 (含预览触发和 NodeGroup 逻辑)
    updateNodeDimensionsAndRecord,        // 更新节点尺寸
    updateNodeComponentStateAndRecord,    // 更新节点内部组件状态
    removeEdgesByHandleAndRecord,         // 按句柄删除边
    updateWorkflowNameAndRecord,          // 更新工作流名称
    updateWorkflowDescriptionAndRecord,   // 更新工作流描述
    setPreviewTargetAndRecord,            // 新增：设置/清除预览目标并记录历史
    openDockedEditorForNodeInput,         // 新增：打开可停靠编辑器

    // --- 预览相关 (来自 useWorkflowPreview) ---
    isPreviewEnabled, // 导出从 useWorkflowPreview 获取的预览状态
    // requestPreviewExecution 主要由上面的更新函数内部调用，通常不直接从协调器暴露
    // executeWorkflow 已移至 useWorkflowExecution
  };
}
