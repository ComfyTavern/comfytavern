// apps/frontend-vueflow/src/composables/workflow/useWorkflowInteractionCoordinator.ts
import { useEditorState } from "@/composables/editor/useEditorState";
import { useMultiInputConnectionActions } from "@/composables/node/useMultiInputConnectionActions";
import { useSlotDefinitionHelper } from "@/composables/node/useSlotDefinitionHelper"; // 导入 useSlotDefinitionHelper
import { useTabStore } from "@/stores/tabStore";
import type { EditorOpeningContext } from "@/types/editorTypes";
import type { WorkflowStateSnapshot } from "@/types/workflowTypes";
import { getNodeType, parseSubHandleId } from "@/utils/nodeUtils";
import type { GroupSlotInfo, HistoryEntry, InputDefinition, NodeDefinition } from "@comfytavern/types";
import { DataFlowType } from "@comfytavern/types";
import type { Edge, Node as VueFlowNode, XYPosition } from "@vue-flow/core";
import { klona } from "klona/full";
import { computed, nextTick } from "vue";
import { useWorkflowGrouping } from "../group/useWorkflowGrouping";
import { useWorkflowHistory } from "./useWorkflowHistory";
import { useWorkflowInterfaceManagement } from "./useWorkflowInterfaceManagement";
import { useWorkflowManager } from "./useWorkflowManager";
import { useWorkflowPreview } from "./useWorkflowPreview";
import { useWorkflowViewManagement } from "./useWorkflowViewManagement";

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
  const { triggerPreview: requestPreviewExecution, isPreviewEnabled } = useWorkflowPreview(); // 使用新的预览 composable

  // 创建一个新的 computed Ref 来包装 tabStore.activeTabId，确保它是一个 Ref 对象
  const coordinatorActiveTabIdRef = computed(() => tabStore.activeTabId);
  const multiInputActions = useMultiInputConnectionActions(coordinatorActiveTabIdRef);
  const { getSlotDefinition } = useSlotDefinitionHelper(); // 实例化 getSlotDefinition

  // --- 内部辅助函数 ---

  /**
   * 获取当前活动标签页或指定标签页的最新状态快照
   * @param internalId - 可选的标签页内部 ID，未提供时使用活动标签页ID
   * @returns 工作流状态快照，找不到时返回 undefined
   */
  function getCurrentSnapshot(internalId?: string): WorkflowStateSnapshot | undefined {
    const idToUse = internalId ?? tabStore.activeTabId;
    return idToUse ? workflowManager.getCurrentSnapshot(idToUse) : undefined;
  }

  /**
   * 验证标签页ID并获取其快照
   * @param internalId - 标签页的内部 ID
   * @param action - 调用此函数的动作名称，用于错误日志
   * @returns 包含快照或错误信息的对象
   */
  function validateAndGetSnapshot(
    internalId: string | undefined,
    action: string
  ): { snapshot?: WorkflowStateSnapshot; error?: string } {
    if (!internalId) {
      return { error: `[${action}] 无效的标签页ID` };
    }
    const snapshot = getCurrentSnapshot(internalId);
    if (!snapshot) {
      return { error: `[${action}] 无法获取标签页 ${internalId} 的快照` };
    }
    return { snapshot };
  }

  /**
   * 记录历史快照
   * @param internalId - 标签页的内部 ID
   * @param entry - 要记录的历史条目
   * @param snapshotToRecord - 可选的特定快照，未提供则获取当前快照
   */
  function recordHistory(
    internalId: string,
    entry: HistoryEntry,
    snapshotToRecord?: WorkflowStateSnapshot
  ) {
    const snapshot = snapshotToRecord ?? getCurrentSnapshot(internalId);
    if (snapshot) {
      historyManager.recordSnapshot(internalId, entry, snapshot);
    }
  }

  /**
   * 异步更新指定节点的内部状态和视图
   * 通常在节点的连接或结构变化后调用，确保 VueFlow 正确渲染
   * @param internalId - 标签页的内部 ID
   * @param nodeIds - 需要更新的节点 ID 数组
   */
  async function updateNodeInternals(internalId: string, nodeIds: string[]) {
    const instance = workflowViewManagement.getVueFlowInstance(internalId);
    if (instance) {
      await nextTick();
      await nextTick();
      instance.updateNodeInternals(nodeIds);
      await nextTick();
    }
  }

  // --- 状态更新与历史记录函数 ---
  // 这些函数遵循一个通用模式：
  // 获取当前快照 (修改前)。
  // 准备下一个状态快照 (深拷贝当前快照并应用更改)。
  // 应用状态更新 (通常通过 workflowManager)。
  // 记录历史 (使用准备好的下一个状态快照)。
  // (可选) 触发副作用，例如预览执行。

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
    if (!nodeId || inputKey === undefined) {
      console.warn("[InteractionCoordinator:updateNodeInputValueAndRecord] 无效参数。");
      return;
    }

    const { snapshot: currentSnapshot, error: snapshotError } = validateAndGetSnapshot(
      internalId,
      "updateNodeInputValueAndRecord"
    );
    if (snapshotError || !currentSnapshot) {
      console.error(
        snapshotError ||
          `[InteractionCoordinator:updateNodeInputValueAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
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

    // 应用状态更新
    // setElements 内部处理脏状态标记
    await workflowManager.setElements(internalId, nextSnapshot.elements);

    // 记录历史
    recordHistory(internalId, entry, nextSnapshot); // 传递准备好的 nextSnapshot

    // 触发预览 (如果启用)
    // requestPreviewExecution(internalId, nodeId, inputKey, value);
    // triggerPreview 现在只需要 changedNodeId 和可选的 changeDetails
    // internalId 会在 triggerPreview 内部通过 tabStore 获取
    if (isPreviewEnabled.value) {
      // 检查预览是否启用
      requestPreviewExecution(nodeId, { type: "input", key: inputKey, value });
    }
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
    if (!nodeId || configKey === undefined) {
      console.warn("[InteractionCoordinator:updateNodeConfigValueAndRecord] 无效参数。");
      return;
    }

    const { snapshot: currentSnapshot, error: snapshotError } = validateAndGetSnapshot(
      internalId,
      "updateNodeConfigValueAndRecord"
    );
    if (snapshotError || !currentSnapshot) {
      console.error(
        snapshotError ||
          `[InteractionCoordinator:updateNodeConfigValueAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
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
        `[InteractionCoordinator:updateNodeConfigValueAndRecord] 在标签页 ${internalId} 中未找到节点 ${nodeId}。`
      );
      return;
    }

    // 修改 nextSnapshot 中的目标节点数据和可能的边
    const targetNode = nextSnapshot.elements[nodeIndex] as VueFlowNode;
    let finalElements = nextSnapshot.elements; // 从克隆的元素开始

    // 准备基础的节点数据更新 (configValues)
    const baseDataUpdate = {
      ...targetNode.data,
      configValues: {
        ...(targetNode.data.configValues || {}),
        [configKey]: value,
      },
    };
    targetNode.data = baseDataUpdate;

    // 特殊处理：NodeGroup referencedWorkflowId
    const nodeType = getNodeType(targetNode);
    if (nodeType === "core:NodeGroup" && configKey === "referencedWorkflowId") {
      const newWorkflowId = value as string | null;
      if (newWorkflowId) {
        console.debug(
          `[InteractionCoordinator] 触发 NodeGroup ${nodeId} 的接口更新，工作流为 ${newWorkflowId}`
        );
        // updateNodeGroupWorkflowReference 返回计算出的更改 (更新的节点数据、要移除的边)，
        // 而不直接应用它们，这符合此协调器的模式。
        const groupUpdateResult = await workflowGrouping.updateNodeGroupWorkflowReference(
          nodeId,
          newWorkflowId,
          internalId
        );

        if (groupUpdateResult.success && groupUpdateResult.updatedNodeData) {
          // 将更新的数据合并到 nextSnapshot 中的节点
          const baseLabel = groupUpdateResult.updatedNodeData.label;
          // 如果 baseLabel 存在 (即成功引用了工作流名称)，则添加 emoji 前缀
          // 否则，理论上 groupUpdateResult.updatedNodeData.label 不会为空（会回退到 "分组_id"），但为保险起见，可以加个默认值
          const finalDisplayLabel = baseLabel ? `📦 ${baseLabel}` : `📦 节点组`;

          // 新增：从 groupInterface 更新 inputs 和 outputs
          const newInputs = groupUpdateResult.updatedNodeData.groupInterface?.inputs || {};
          const newOutputs = groupUpdateResult.updatedNodeData.groupInterface?.outputs || {};

          targetNode.data = {
            ...targetNode.data, // 保留 configValue 更新
            groupInterface: groupUpdateResult.updatedNodeData.groupInterface,
            label: finalDisplayLabel, // 更新 data.label
            displayName: finalDisplayLabel, // 更新 displayName
            inputs: newInputs, // 更新节点的输入插槽定义
            outputs: newOutputs, // 更新节点的输出插槽定义
          };
          // 同时更新顶层 label 属性，以便 VueFlow 正确显示
          targetNode.label = finalDisplayLabel;

          console.debug(
            `[InteractionCoordinator] 已将 NodeGroup 数据更新 (包括顶层 label: ${targetNode.label}, displayName: ${targetNode.data.displayName}, inputs/outputs from groupInterface) 合并到 ${nodeId} 的 nextSnapshot`
          );

          // 如果需要，在 nextSnapshot 中过滤边
          if (groupUpdateResult.edgeIdsToRemove && groupUpdateResult.edgeIdsToRemove.length > 0) {
            const edgeIdsToRemoveSet = new Set(groupUpdateResult.edgeIdsToRemove);
            const originalElementCount = finalElements.length;
            finalElements = finalElements.filter(
              (el) => !("source" in el) || !edgeIdsToRemoveSet.has(el.id)
            );
            nextSnapshot.elements = finalElements; // 更新快照中的元素
            console.debug(
              `[InteractionCoordinator] 在 NodeGroup ${nodeId} 的 nextSnapshot 中过滤了 ${
                originalElementCount - finalElements.length
              } 条不兼容的边`
            );
          }
        } else {
          console.error(
            `[InteractionCoordinator] 获取 NodeGroup ${nodeId} 的更新数据失败。将在没有接口/边更新的情况下继续。`
          );
        }
      } else {
        // 清空引用的工作流 ID
        console.warn(
          `[InteractionCoordinator] NodeGroup ${nodeId} 的 referencedWorkflowId 已清除。正在清除接口、标签和连接数据。`
        );
        targetNode.data.groupInterface = undefined; // 清除接口定义
        targetNode.data.inputs = {}; // 恢复到节点定义中的默认空输入
        targetNode.data.outputs = {}; // 恢复到节点定义中的默认空输出
        targetNode.data.inputConnectionOrders = {}; // 清除连接顺序
        targetNode.data.label = "📦节点组"; // 恢复 data.label
        targetNode.data.displayName = "📦节点组"; // 恢复 displayName
        targetNode.label = "📦节点组"; // 恢复顶层 label

        // 查找并准备移除所有连接到此节点组的边
        const edgesConnectedToNodeGroup = currentSnapshot.elements.filter(
          (el): el is Edge => "source" in el && (el.source === nodeId || el.target === nodeId)
        );

        if (edgesConnectedToNodeGroup.length > 0) {
          const removedEdgeIds = new Set(edgesConnectedToNodeGroup.map((edge) => edge.id));
          // 从 finalElements (它是 nextSnapshot.elements 的一个可变副本或初始引用) 中过滤掉这些边
          finalElements = finalElements.filter(
            (el) => !("source" in el) || !removedEdgeIds.has(el.id)
          );
          // 确保 nextSnapshot.elements 也得到更新，因为它是用于历史记录的
          nextSnapshot.elements = finalElements;
          console.debug(
            `[InteractionCoordinator] 在 NodeGroup ${nodeId} 清除引用时，移除了 ${removedEdgeIds.size} 条相关边。`
          );

          // 存储被移除边的完整信息，以便撤销操作可以恢复它们
          const removedEdgesData = edgesConnectedToNodeGroup.map((edge) => klona(edge));
          if (entry.details) {
            entry.details.removedEdgesOnClearReference = removedEdgesData;
          } else {
            entry.details = { removedEdgesOnClearReference: removedEdgesData };
          }
        }
      }
    }

    // 应用状态更新 (使用 nextSnapshot 的最终 elements)
    await workflowManager.setElements(internalId, finalElements);

    // 特殊处理 NodeGroup 的视图更新
    if (nodeType === "core:NodeGroup" && configKey === "referencedWorkflowId") {
      // 无论 referencedWorkflowId 是被设置还是被清除，都尝试更新节点内部结构，
      // 因为插槽定义发生了变化。
      await updateNodeInternals(internalId, [nodeId]);
      console.debug(
        `[InteractionCoordinator] Called updateNodeInternals for NodeGroup ${nodeId} after referencedWorkflowId change (new value: ${value}).`
      );
    }

    // 记录历史 (使用准备好的 nextSnapshot)
    recordHistory(internalId, entry, nextSnapshot);

    // 触发预览 (如果启用)
    // 注意：预览通常针对输入值的变化。配置值的变化是否需要触发预览取决于具体情况。
    // 如果配置变化影响输出，则可能需要触发预览。
    // 这里假设配置变化也需要触发预览。
    // requestPreviewExecution(internalId, nodeId, configKey, value);
    // triggerPreview 现在只需要 changedNodeId 和可选的 changeDetails
    // internalId 会在 triggerPreview 内部通过 tabStore 获取
    if (isPreviewEnabled.value) {
      // 检查预览是否启用
      requestPreviewExecution(nodeId, { type: "config", key: configKey, value });
    }
  }

  /**
   * 原子性地更改节点的模式，更新其配置值，移除因插槽变化而失效的边，并记录单一历史条目。
   * @param internalId - 标签页的内部 ID。
   * @param nodeId - 目标节点的 ID。
   * @param configKey - 模式选择器的配置键。
   * @param newModeId - 新的模式 ID。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function changeNodeModeAndRecord(
    internalId: string,
    nodeId: string,
    configKey: string,
    newModeId: string,
    entry: HistoryEntry
  ) {
    const { snapshot: currentSnapshot, error: snapshotError } = validateAndGetSnapshot(
      internalId,
      "changeNodeModeAndRecord"
    );
    if (snapshotError || !currentSnapshot) {
      console.error(snapshotError || `[changeNodeModeAndRecord] 无法获取标签页 ${internalId} 的快照。`);
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const nodeIndex = nextSnapshot.elements.findIndex(
      (el) => el.id === nodeId && !("source" in el)
    );
    if (nodeIndex === -1) {
      console.error(`[changeNodeModeAndRecord] 在标签页 ${internalId} 中未找到节点 ${nodeId}。`);
      return;
    }
    const targetNode = nextSnapshot.elements[nodeIndex] as VueFlowNode;
    const nodeDef = targetNode.data as NodeDefinition;

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
      const edgesToRemove: Edge[] = [];
      nextSnapshot.elements = nextSnapshot.elements.filter((el) => {
        if (!("source" in el)) return true; // 保留节点
        const edge = el as Edge;
        let shouldRemove = false;

        if (edge.source === nodeId && edge.sourceHandle && removedOutputKeys.has(parseSubHandleId(edge.sourceHandle).originalKey)) {
          shouldRemove = true;
        }
        if (edge.target === nodeId && edge.targetHandle && removedInputKeys.has(parseSubHandleId(edge.targetHandle).originalKey)) {
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
    await workflowManager.setElements(internalId, nextSnapshot.elements);

    // 5. 更新节点视图
    await updateNodeInternals(internalId, [nodeId]);

    // 6. 记录历史
    recordHistory(internalId, entry, nextSnapshot);

    // 7. 触发预览
    if (isPreviewEnabled.value) {
      requestPreviewExecution(nodeId, { type: "config", key: configKey, value: newModeId });
    }
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
    entry?: HistoryEntry
  ) {
    if (!updates || updates.length === 0) {
      console.warn("[InteractionCoordinator:updateNodePositionAndRecord] 提供了无效参数。");
      return;
    }
    const { snapshot: currentSnapshot, error: snapshotError } = validateAndGetSnapshot(
      internalId,
      "updateNodePositionAndRecord"
    );
    if (snapshotError || !currentSnapshot) {
      console.error(
        snapshotError ||
          `[InteractionCoordinator:updateNodePositionAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
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
          `[InteractionCoordinator:updateNodePositionAndRecord] 更新时在快照中未找到节点 ${update.nodeId}。`
        );
      }
    }

    // 如果没有任何节点被实际更新，则跳过
    if (!updated) {
      console.warn(
        "[InteractionCoordinator:updateNodePositionAndRecord] 没有节点被更新。跳过历史记录。"
      );
      return;
    }

    // 应用状态更新
    // 注意：workflowManager.updateNodePositions 内部调用 setElements
    await workflowManager.updateNodePositions(internalId, updates);

    // 记录历史
    // 传递 nextSnapshot 确保记录的是我们预期的、包含所有位置更新的状态
    if (entry) {
      recordHistory(internalId, entry, nextSnapshot);
    }
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
    // 新增参数用于处理普通节点插槽的更新
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
    const { snapshot: currentSnapshot, error: snapshotError } = validateAndGetSnapshot(
      internalId,
      "handleConnectionWithInterfaceUpdate"
    );
    if (snapshotError || !currentSnapshot || !currentSnapshot.workflowData) {
      console.error(
        snapshotError ||
          `[handleConnectionWithInterfaceUpdate] 无法获取标签页 ${internalId} 的当前快照或缺少 workflowData。`
      );
      return;
    }

    // 准备下一个状态快照 (深拷贝以确保可变性)
    const nextSnapshot = klona(currentSnapshot);
    // 使用 nextSnapshot 中的 elements 和 workflowData 进行修改
    // nextSnapshotElements 仍然被非多输入路径使用。
    // nextWorkflowData 未被直接读取，因为对 workflowData 的修改是通过 nextSnapshot.workflowData 或 multiInputResult 进行的。
    const nextSnapshotElements = nextSnapshot.elements;
    // const nextWorkflowData = nextSnapshot.workflowData!; // 移除未使用的变量

    // 处理普通节点插槽更新
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

    // 处理连接（边和节点数据更新）
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
          // 调用 multiInputActions.connectEdgeToMultiInput，它被修改为 async 并返回 Promise<{ updatedElements, updatedWorkflowData, ... }>
          const multiInputResult = await multiInputActions.connectEdgeToMultiInput(
            nextSnapshot, // mutableSnapshot
            klona(newEdge), // newEdgeParams
            targetIndexInOrder, // targetIndexInOrder
            internalId // activeTabIdString (using the existing internalId string param from handleConnectionWithInterfaceUpdate)
          );
          // 使用 multiInputActions 返回的更新后的数据更新快照
          // 即使 multiInputActions 修改了引用，显式赋值更安全和清晰
          nextSnapshot.elements = multiInputResult.modifiedElements;
          if (multiInputResult.modifiedWorkflowData !== undefined) {
            // 检查 undefined，因为它可以是 null
            nextSnapshot.workflowData = multiInputResult.modifiedWorkflowData;
          }
        }
      }
    }

    if (!isMultiInputConnection) {
      // 如果不是多输入连接 (例如，目标不是多输入，或者 targetHandle 无效)
      if (!nextSnapshot.elements.find((el) => el.id === newEdge.id)) {
        // 确保 nextSnapshot.elements 是最新的
        nextSnapshot.elements.push(klona(newEdge)); // 直接修改 nextSnapshot.elements
      } else {
        console.warn(`[InteractionCoordinator] Edge ${newEdge.id} already exists in elements`);
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

    await nextTick(); // 等待下一个 tick，确保响应式更新已传播

    // 触发视图更新 (强制更新连接节点的内部结构)
    await updateNodeInternals(internalId, [sourceNodeId, targetNodeId]);
  }

  /**
   /**
    * 将单个节点添加到指定标签页的状态并记录历史。
    * @param internalId - 目标标签页的内部 ID。
    * @param nodeToAdd - 要添加的 VueFlowNode 对象。
    * @param entry - 描述此操作的历史记录条目。
    */
   async function addNodeAndRecord(internalId: string, nodeToAdd: VueFlowNode, entry: HistoryEntry) {
     await addElementsAndRecord(internalId, [nodeToAdd], [], entry);
   }
 
   /**
    * 添加一个分组框（Frame）节点到指定标签页并记录历史。
    * @param internalId - 目标标签页的内部 ID。
    * @param frameNode - 要添加的 Frame 节点对象。
    * @param entry - 描述此操作的历史记录条目。
    */
   async function addFrameNodeAndRecord(internalId: string, frameNode: VueFlowNode, entry: HistoryEntry) {
     // Frame 节点本质上也是一个节点，所以我们可以复用 addElementsAndRecord 逻辑
     await addElementsAndRecord(internalId, [frameNode], [], entry);
   }
  /**
   * 批量添加节点和边，并原子性地记录历史。
   * @param internalId - 目标标签页的内部 ID。
   * @param nodesToAdd - 要添加的 VueFlowNode 对象数组。
   * @param edgesToAdd - 要添加的 Edge 对象数组。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function addElementsAndRecord(
    internalId: string,
    nodesToAdd: VueFlowNode[],
    edgesToAdd: Edge[],
    entry: HistoryEntry
  ) {
    if ((!nodesToAdd || nodesToAdd.length === 0) && (!edgesToAdd || edgesToAdd.length === 0)) {
      console.warn("[InteractionCoordinator:addElementsAndRecord] 提供了无效参数。");
      return;
    }
    const { snapshot: currentSnapshot, error: snapshotError } = validateAndGetSnapshot(
      internalId,
      "addElementsAndRecord"
    );
    if (snapshotError || !currentSnapshot) {
      console.error(
        snapshotError ||
          `[InteractionCoordinator:addElementsAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
      );
      return;
    }

    // 准备下一个状态快照 (深拷贝并添加所有新元素)
    const nextSnapshot = klona(currentSnapshot);
    const newElements = [...nodesToAdd, ...edgesToAdd];
    nextSnapshot.elements.push(...newElements);

    // 应用状态更新
    // 注意：这里我们直接设置完整的元素数组，而不是逐个添加
    // 这对于 workflowManager 来说更高效，也确保了原子性
    await workflowManager.setElements(internalId, nextSnapshot.elements);

    // 记录历史
    recordHistory(internalId, entry, nextSnapshot);
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
      console.error(
        `[InteractionCoordinator] 更新接口后无法获取标签页 ${internalId} 的状态。无法过滤边。`
      );
      // 尝试记录历史，但可能不包含边的更改
      recordHistory(internalId, entry);
      return;
    }

    // 确定被删除的接口键
    const newInputKeys = new Set(Object.keys(stateAfter.workflowData?.interfaceInputs || {}));
    const newOutputKeys = new Set(Object.keys(stateAfter.workflowData?.interfaceOutputs || {}));
    const deletedInputKeys = new Set([...oldInputKeys].filter((k) => !newInputKeys.has(k)));
    const deletedOutputKeys = new Set([...oldOutputKeys].filter((k) => !newOutputKeys.has(k)));

    // 如果有接口被删除，则过滤掉连接到这些接口的边
    let edgesRemovedCount = 0;
    let filteredElements = stateAfter.elements || [];
    const removedEdges: Edge[] = []; // 存储被移除的边信息以供历史记录
    const nodesMap = new Map(
      filteredElements
        .filter((el): el is VueFlowNode => !("source" in el))
        .map((node) => [node.id, node])
    );

    if (deletedInputKeys.size > 0 || deletedOutputKeys.size > 0) {
      console.debug(`[InteractionCoordinator] 接口插槽已移除。正在过滤边...`);
      filteredElements = filteredElements.filter((el) => {
        if (!("source" in el)) return true; // 保留节点
        const edge = el as Edge;
        const sourceNode = nodesMap.get(edge.source);
        const targetNode = nodesMap.get(edge.target);
        let shouldRemove = false;
        // 检查边是否连接到已删除的 GroupInput 或 GroupOutput 句柄
        if (sourceNode?.type === "core:GroupInput" && deletedInputKeys.has(edge.sourceHandle ?? ""))
          shouldRemove = true;
        if (
          targetNode?.type === "core:GroupOutput" &&
          deletedOutputKeys.has(edge.targetHandle ?? "")
        )
          shouldRemove = true;

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
      const removedEdgeDetails = removedEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourceHandle,
        target: edge.target,
        targetHandle: edge.targetHandle,
      }));
      entry.details = { ...(entry.details || {}), removedEdges: removedEdgeDetails };
      console.debug(
        `[InteractionCoordinator] 已将 ${removedEdges.length} 条移除边的详细信息添加到历史条目。`
      );
    }

    // 获取最终状态作为 nextSnapshot (应用了接口更新和边过滤后的状态)
    const finalSnapshot = workflowManager.getCurrentSnapshot(internalId);
    if (!finalSnapshot) {
      console.error(
        `[InteractionCoordinator] 接口更新后无法获取标签页 ${internalId} 的最终状态。无法准确记录历史。`
      );
      // 尝试使用 stateAfter 作为回退，但不保证完全准确
      recordHistory(internalId, entry, stateAfter);
      return;
    }

    // 记录最终的历史快照
    recordHistory(internalId, entry, finalSnapshot);
  }

  /**
   * 将单个边添加到指定标签页的状态并记录历史。
   * @param internalId - 目标标签页的内部 ID。
   * @param edgeToAdd - 要添加的 Edge 对象。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function addEdgeAndRecord(internalId: string, edgeToAdd: Edge, entry: HistoryEntry) {
    if (!edgeToAdd) {
      console.warn("[InteractionCoordinator:addEdgeAndRecord] 提供了无效参数。");
      return;
    }
    const { snapshot: currentSnapshot, error: snapshotError } = validateAndGetSnapshot(
      internalId,
      "addEdgeAndRecord"
    );
    if (snapshotError || !currentSnapshot) {
      console.error(
        snapshotError || `[addEdgeAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
      );
      return;
    }

    // 准备下一个状态快照 (添加边)
    const nextSnapshot: WorkflowStateSnapshot = {
      ...currentSnapshot,
      elements: [...currentSnapshot.elements, edgeToAdd],
    };

    // 应用状态更新
    workflowManager.setElements(internalId, nextSnapshot.elements);

    // 记录历史
    recordHistory(internalId, entry, nextSnapshot);
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
    if (!elementsToRemove || elementsToRemove.length === 0) {
      console.warn("[InteractionCoordinator:removeElementsAndRecord] 提供了无效参数。");
      return;
    }

    const { snapshot: currentSnapshot, error: snapshotError } = validateAndGetSnapshot(
      internalId,
      "removeElementsAndRecord"
    );
    if (snapshotError || !currentSnapshot) {
      console.error(
        snapshotError ||
          `[InteractionCoordinator:removeElementsAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
      );
      return;
    }

    // 获取用户明确选择要删除的元素 ID 集合
    const explicitlyRemovedElementIds = new Set(elementsToRemove.map((el) => el.id));
    const removedEdgesFromInput: Edge[] = []; // 存储因 inputConnectionOrder 更新而“移除”的边信息

    // 使用快照中的元素进行过滤，并准备更新 inputConnectionOrders
    const nextSnapshot = klona(currentSnapshot); // 深拷贝以进行修改

    // --- 新增逻辑：识别所有需要被删除的元素（包括因节点删除而隐式删除的边）---
    const nodesBeingExplicitlyRemovedIds = new Set<string>();
    elementsToRemove.forEach((el) => {
      // 检查 el 是否为节点 (没有 source 和 target 属性，或者说不是边)
      // VueFlow 的 Edge 类型定义明确包含 source 和 target
      if (
        !Object.prototype.hasOwnProperty.call(el, "source") &&
        !Object.prototype.hasOwnProperty.call(el, "target")
      ) {
        nodesBeingExplicitlyRemovedIds.add(el.id);
      }
    });

    const implicitlyRemovedEdgeIds = new Set<string>();
    if (nodesBeingExplicitlyRemovedIds.size > 0) {
      currentSnapshot.elements.forEach((el) => {
        // 检查 el 是否为边
        if (
          Object.prototype.hasOwnProperty.call(el, "source") &&
          Object.prototype.hasOwnProperty.call(el, "target")
        ) {
          const edge = el as Edge; // 类型断言
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
    // --- 新增逻辑结束 ---

    const nodesToUpdateInternals = new Set<string>();

    // 筛选出所有实际将被移除的边 (无论是显式选择还是因节点删除而隐式移除)
    // 这些边如果连接到多输入节点，需要更新其 inputConnectionOrders
    const actualEdgesBeingRemoved = currentSnapshot.elements.filter(
      (el): el is Edge => "source" in el && allElementIdsToRemove.has(el.id)
    );

    for (const edgeToRemove of actualEdgesBeingRemoved) {
      // 使用 actualEdgesBeingRemoved
      const targetNodeIndex = nextSnapshot.elements.findIndex(
        (n) => n.id === edgeToRemove.target && !("source" in n)
      );
      if (targetNodeIndex !== -1) {
        // 注意：这里操作的是 nextSnapshot.elements，它之后会被基于 allElementIdsToRemove 从 currentSnapshot 重新构建。
        // 但 inputConnectionOrders 的修改是针对 nextSnapshot 中仍然存在的节点。
        // 如果 targetNode 本身在 allElementIdsToRemove 中，它最终会被移除，这里的修改就无意义了。
        // 因此，只应在 targetNode 不会被删除时更新其 inputConnectionOrders。
        if (!allElementIdsToRemove.has(edgeToRemove.target)) {
          const targetNode = nextSnapshot.elements[targetNodeIndex] as VueFlowNode; // 这个 targetNode 是 nextSnapshot 里的
          nodesToUpdateInternals.add(targetNode.id); // 标记目标节点需要更新视图

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
                console.debug(
                  `[InteractionCoordinator:removeElementsAndRecord] Updated inputConnectionOrders for node ${targetNode.id}, handle ${targetOriginalKey}. Removed edge ${edgeToRemove.id}`
                );
                // removedEdgesFromInput 记录的是因 inputConnectionOrder 变化而“逻辑上”移除的边，
                // 即使这条边可能因为其他原因（如节点删除）而被物理删除。
                // 这个数组主要用于历史记录的 details，以区分是直接删除边还是因顺序调整。
                // 但如果边本身就在 allElementIdsToRemove 中，它会被物理删除，这里的记录可能有些冗余，但无害。
                removedEdgesFromInput.push(klona(edgeToRemove)); // 克隆以防万一
              }
            }
          }
        }
      }
      // 同时标记源节点，以防万一其视图也受影响 (如果源节点没被删除的话)
      if (edgeToRemove.source && !allElementIdsToRemove.has(edgeToRemove.source)) {
        nodesToUpdateInternals.add(edgeToRemove.source);
      }
    }

    // 更新 nextSnapshot.elements，基于 currentSnapshot 和 allElementIdsToRemove
    nextSnapshot.elements = currentSnapshot.elements.filter(
      (el) => !allElementIdsToRemove.has(el.id)
    );

    // 检查是否真的有元素被移除，避免无效的历史记录
    if (
      nextSnapshot.elements.length === currentSnapshot.elements.length &&
      removedEdgesFromInput.length === 0
    ) {
      console.warn(
        "[InteractionCoordinator:removeElementsAndRecord] 没有元素被实际移除或 inputConnectionOrders 未改变。跳过历史记录。"
      );
      return;
    }

    // 将移除的边的信息添加到历史记录条目的 details 中
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

    // 应用状态更新 (setElements 会处理 workflowData 的部分，但 applyStateSnapshot 更全面)
    // workflowManager.setElements(internalId, nextSnapshot.elements);
    // 使用 applyStateSnapshot 来确保 workflowData (如果被修改) 也被正确应用
    const applied = workflowManager.applyStateSnapshot(internalId, nextSnapshot);
    console.log(
      `[DEBUG removeElementsAndRecord ${internalId}] After applyStateSnapshot. nextSnapshot.elements (${nextSnapshot.elements.length}):`,
      nextSnapshot.elements.map((el) => el.id)
    );
    const managerElementsBeforeSet = workflowManager.getElements(internalId);
    console.log(
      `[DEBUG removeElementsAndRecord ${internalId}] After applyStateSnapshot. workflowManager.getElements() BEFORE explicit setElements (${managerElementsBeforeSet.length}):`,
      managerElementsBeforeSet.map((el) => el.id)
    );
    if (!applied) {
      console.error(
        `[InteractionCoordinator:removeElementsAndRecord] Failed to apply snapshot for tab ${internalId}.`
      );
      // 根据需要处理错误，例如恢复到 currentSnapshot
      return;
    }

    // 显式更新 workflowManager 内部的 elements 状态
    await workflowManager.setElements(internalId, nextSnapshot.elements);
    const managerElementsAfterSet = workflowManager.getElements(internalId);
    console.log(
      `[DEBUG removeElementsAndRecord ${internalId}] AFTER explicit workflowManager.setElements. workflowManager.getElements() (${managerElementsAfterSet.length}):`,
      managerElementsAfterSet.map((el) => el.id)
    );

    console.log(
      `[DEBUG removeElementsAndRecord ${internalId}] Before recordHistory. Snapshot to be recorded elements (${nextSnapshot.elements.length}):`,
      nextSnapshot.elements.map((el) => el.id)
    );

    const instance = workflowViewManagement.getVueFlowInstance(internalId);
    if (instance) {
      console.log(
        `[DEBUG removeElementsAndRecord ${internalId}] Before updateNodeInternals. VueFlow instance nodes (${instance.getNodes.value.length}):`,
        instance.getNodes.value.map((n: VueFlowNode) => n.id)
      );
      console.log(
        `[DEBUG removeElementsAndRecord ${internalId}] Before updateNodeInternals. VueFlow instance edges (${instance.getEdges.value.length}):`,
        instance.getEdges.value.map((e: Edge) => e.id)
      );
    } else {
      console.warn(
        `[DEBUG removeElementsAndRecord ${internalId}] Before updateNodeInternals. Could not get VueFlow instance.`
      );
    }
    // 记录历史
    recordHistory(internalId, entry, nextSnapshot); // 传递准备好的 nextSnapshot

    // 更新受影响节点的内部视图
    if (nodesToUpdateInternals.size > 0) {
      await updateNodeInternals(internalId, Array.from(nodesToUpdateInternals));
      console.debug(
        `[InteractionCoordinator:removeElementsAndRecord] Called updateNodeInternals for nodes:`,
        Array.from(nodesToUpdateInternals)
      );
    }
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
    handleType: "source" | "target",
    entry: HistoryEntry
  ) {
    if (!nodeId || !handleId || !handleType) {
      console.warn("[InteractionCoordinator:removeEdgesByHandleAndRecord] 提供了无效参数。");
      return;
    }
    const { snapshot: currentSnapshot, error: snapshotError } = validateAndGetSnapshot(
      internalId,
      "removeEdgesByHandleAndRecord"
    );
    if (snapshotError || !currentSnapshot) {
      console.error(
        snapshotError || `[removeEdgesByHandleAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
      );
      return;
    }

    // 过滤掉连接到指定句柄的边
    const edgesToRemove: Edge[] = [];
    const remainingElements = currentSnapshot.elements.filter((el) => {
      if (!("source" in el)) return true; // 保留节点
      const edge = el as Edge;
      let shouldRemove = false;
      if (handleType === "source" && edge.source === nodeId && edge.sourceHandle === handleId)
        shouldRemove = true;
      else if (handleType === "target" && edge.target === nodeId && edge.targetHandle === handleId)
        shouldRemove = true;

      if (shouldRemove) {
        edgesToRemove.push(klona(edge)); // 记录被移除的边
        return false; // 过滤掉这条边
      }
      return true; // 保留这条边
    });

    // 如果没有边被移除，则直接返回
    if (edgesToRemove.length === 0) {
      console.warn(
        `[InteractionCoordinator:removeEdgesByHandleAndRecord] 未找到连接到节点 ${nodeId} 句柄 ${handleId} (${handleType}) 的边。未做任何更改。`
      );
      return;
    }

    // 准备下一个状态快照
    const nextSnapshot: WorkflowStateSnapshot = {
      ...currentSnapshot,
      elements: remainingElements,
    };

    // 应用状态更新
    workflowManager.setElements(internalId, remainingElements);

    // 记录历史 (包含移除边的详细信息)
    const removedEdgeDetails = edgesToRemove.map((edge) => ({
      id: edge.id,
      source: edge.source,
      sourceHandle: edge.sourceHandle,
      target: edge.target,
      targetHandle: edge.targetHandle,
    }));
    entry.details = {
      ...(entry.details || {}),
      nodeId,
      handleId,
      handleType,
      removedEdges: removedEdgeDetails,
    };
    recordHistory(internalId, entry, nextSnapshot);
  }

  /**
   * 更新节点的尺寸（宽度和/或高度）并记录历史。
   * @param internalId - 标签页的内部 ID。
   * @param nodeId - 目标节点的 ID。
   * @param dimensions - 包含 { width?: number, height?: number } 的对象，指定新的尺寸。
   * @param entry - 描述此操作的历史记录条目。
   */
  /**
   * 更新节点的标签（显示名称）并记录历史。
   * @param internalId - 标签页的内部 ID。
   * @param nodeId - 目标节点的 ID。
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
      console.warn("[InteractionCoordinator:updateNodeLabelAndRecord] 无效的 nodeId。");
      return;
    }

    const { snapshot: currentSnapshot, error: snapshotError } = validateAndGetSnapshot(
      internalId,
      "updateNodeLabelAndRecord"
    );
    if (snapshotError || !currentSnapshot) {
      console.error(
        snapshotError ||
          `[InteractionCoordinator:updateNodeLabelAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const nodeIndex = nextSnapshot.elements.findIndex(
      (el: VueFlowNode | Edge) => el.id === nodeId && !("source" in el)
    );
    if (nodeIndex === -1) {
      console.error(
        `[InteractionCoordinator:updateNodeLabelAndRecord] 在标签页 ${internalId} 中未找到节点 ${nodeId}。`
      );
      return;
    }
    const targetNode = nextSnapshot.elements[nodeIndex] as VueFlowNode;

    // 如果标签未改变，则跳过
    const oldLabel = targetNode.data.label || targetNode.label;
    if (oldLabel === newLabel) {
      console.debug(
        `[InteractionCoordinator:updateNodeLabelAndRecord] Node ${nodeId} label has not changed. Skipping history record.`
      );
      return;
    }

    // 更新 data.label 和顶层 label
    targetNode.data = {
      ...targetNode.data,
      label: newLabel,
    };
    targetNode.label = newLabel;

    // 应用状态更新
    await workflowManager.setElements(internalId, nextSnapshot.elements);

    // 记录历史
    recordHistory(internalId, entry, nextSnapshot);
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
    if (!nodeId || (!dimensions.width && !dimensions.height)) {
      console.warn("[InteractionCoordinator:updateNodeDimensionsAndRecord] 无效参数。");
      return;
    }

    const { snapshot: currentSnapshot, error: snapshotError } = validateAndGetSnapshot(
      internalId,
      "updateNodeDimensionsAndRecord"
    );
    if (snapshotError || !currentSnapshot) {
      console.error(
        snapshotError ||
          `[InteractionCoordinator:updateNodeDimensionsAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const nodeIndex = nextSnapshot.elements.findIndex(
      (el: VueFlowNode | Edge) => el.id === nodeId && !("source" in el)
    );
    if (nodeIndex === -1) {
      console.error(
        `[InteractionCoordinator:updateNodeDimensionsAndRecord] 在标签页 ${internalId} 中未找到节点 ${nodeId}。`
      );
      return;
    }
    const targetNode = nextSnapshot.elements[nodeIndex] as VueFlowNode;

    // 更新目标节点的宽度和/或高度及其样式
    if (dimensions.width !== undefined) {
      targetNode.width = dimensions.width;
      targetNode.style = { ...(targetNode.style || {}), width: `${dimensions.width}px` };
    }
    if (dimensions.height !== undefined) {
      targetNode.height = dimensions.height;
      targetNode.style = { ...(targetNode.style || {}), height: `${dimensions.height}px` };
    }

    // 检查尺寸是否真的发生了变化
    const originalNode = currentSnapshot.elements.find(
      (el) => el.id === nodeId && !("source" in el)
    ) as VueFlowNode | undefined;
    if (!originalNode) {
      // 理论上如果找到了 nodeIndex，这种情况不应发生
      console.error(
        `[InteractionCoordinator:updateNodeDimensionsAndRecord] 未在当前快照中找到原始节点 ${nodeId}`
      );
      return;
    }
    const hasChanged =
      (dimensions.width !== undefined && originalNode.width !== dimensions.width) ||
      (dimensions.height !== undefined && originalNode.height !== dimensions.height);

    // 如果尺寸未变，则跳过
    if (!hasChanged) {
      console.debug(
        "[InteractionCoordinator:updateNodeDimensionsAndRecord] 尺寸未改变。跳过历史记录。"
      );
      return;
    }

    // 应用状态更新
    await workflowManager.setElements(internalId, nextSnapshot.elements);

    // 记录历史
    recordHistory(internalId, entry, nextSnapshot); // 传递准备好的 nextSnapshot
  }

  /**
   * 更新一个或多个节点的父节点，并记录历史。
   * @param internalId - 标签页的内部 ID。
   * @param updates - 一个包含 { nodeId, parentNodeId } 对象的数组，parentNodeId 为 null 表示移除父节点。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function updateNodeParentAndRecord(
    internalId: string,
    updates: { nodeId: string; parentNodeId: string | null; position: XYPosition }[],
    entry?: HistoryEntry
  ) {
    if (!updates || updates.length === 0) {
      console.warn("[InteractionCoordinator:updateNodeParentAndRecord] 无效参数。");
      return;
    }

    const { snapshot: currentSnapshot, error: snapshotError } = validateAndGetSnapshot(
      internalId,
      "updateNodeParentAndRecord"
    );
    if (snapshotError || !currentSnapshot) {
      console.error(
        snapshotError ||
          `[InteractionCoordinator:updateNodeParentAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
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
          node.position = update.position; // 同时更新位置
          hasChanged = true;
        }
      }
    }

    if (!hasChanged) {
      console.debug("[InteractionCoordinator:updateNodeParentAndRecord] 节点的父节点未改变。跳过历史记录。");
      return;
    }

    await workflowManager.setElements(internalId, nextSnapshot.elements);
    if (entry) {
      recordHistory(internalId, entry, nextSnapshot);
    }
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
    if (!nodeId || !inputKey || !stateUpdate) {
      console.warn("[InteractionCoordinator:updateNodeComponentStateAndRecord] 无效参数。");
      return;
    }

    const { snapshot: currentSnapshot, error: snapshotError } = validateAndGetSnapshot(
      internalId,
      "updateNodeComponentStateAndRecord"
    );
    if (snapshotError || !currentSnapshot) {
      console.error(
        snapshotError ||
          `[InteractionCoordinator:updateNodeComponentStateAndRecord] 无法获取标签页 ${internalId} 的当前快照。`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot);
    const nodeIndex = nextSnapshot.elements.findIndex(
      (el) => el.id === nodeId && !("source" in el)
    );
    if (nodeIndex === -1) {
      console.error(
        `[InteractionCoordinator:updateNodeComponentStateAndRecord] 在标签页 ${internalId} 中未找到节点 ${nodeId}。`
      );
      return;
    }
    const targetNode = nextSnapshot.elements[nodeIndex] as VueFlowNode;

    // 更新目标节点 data 中的 componentStates
    targetNode.data = targetNode.data || {};
    targetNode.data.componentStates = targetNode.data.componentStates || {};
    targetNode.data.componentStates[inputKey] = targetNode.data.componentStates[inputKey] || {};
    if (stateUpdate.height !== undefined)
      targetNode.data.componentStates[inputKey].height = stateUpdate.height;
    if (stateUpdate.value !== undefined)
      targetNode.data.componentStates[inputKey].value = stateUpdate.value;

    // 检查状态是否真的发生了变化
    const originalNode = currentSnapshot.elements.find(
      (el) => el.id === nodeId && !("source" in el)
    ) as VueFlowNode | undefined;
    if (!originalNode) {
      console.error(
        `[InteractionCoordinator:updateNodeComponentStateAndRecord] Original node ${nodeId} not found in current snapshot for comparison.`
      );
      return;
    }
    const originalComponentState = originalNode.data?.componentStates?.[inputKey] || {};
    const hasChanged =
      (stateUpdate.height !== undefined && originalComponentState.height !== stateUpdate.height) ||
      (stateUpdate.value !== undefined && originalComponentState.value !== stateUpdate.value);

    // 如果状态未变，则跳过
    if (!hasChanged) {
      console.debug(
        "[InteractionCoordinator:updateNodeComponentStateAndRecord] 组件状态未改变。跳过历史记录。"
      );
      return;
    }

    // 应用状态更新
    await workflowManager.setElements(internalId, nextSnapshot.elements);

    // 记录历史
    recordHistory(internalId, entry, nextSnapshot); // 传递准备好的 nextSnapshot
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
    if (newName === undefined) {
      console.warn("[InteractionCoordinator:updateWorkflowNameAndRecord] 无效参数。");
      return;
    }
    const { snapshot: currentSnapshot, error: snapshotError } = validateAndGetSnapshot(
      internalId,
      "updateWorkflowNameAndRecord"
    );
    if (snapshotError || !currentSnapshot || !currentSnapshot.workflowData) {
      console.error(
        snapshotError ||
          `[updateWorkflowNameAndRecord] 无法获取标签页 ${internalId} 的当前快照或 workflowData。`
      );
      return;
    }

    // 如果名称未改变，则跳过
    if (currentSnapshot.workflowData.name === newName) {
      console.debug(`[updateWorkflowNameAndRecord] 标签页 ${internalId} 的名称未改变。跳过。`);
      return;
    }

    // 准备下一个状态快照
    const nextSnapshot = klona(currentSnapshot);
    nextSnapshot.workflowData!.name = newName; // 更新名称

    // 应用状态更新 (使用 applyStateSnapshot 更新 workflowData)
    const applied = workflowManager.applyStateSnapshot(internalId, nextSnapshot);

    if (applied) {
      // 记录历史
      recordHistory(internalId, entry, nextSnapshot);
      // 标记为脏状态并更新标签页标题
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
    if (newDescription === undefined) {
      console.warn("[InteractionCoordinator:updateWorkflowDescriptionAndRecord] 无效参数。");
      return;
    }
    const { snapshot: currentSnapshot, error: snapshotError } = validateAndGetSnapshot(
      internalId,
      "updateWorkflowDescriptionAndRecord"
    );
    if (snapshotError || !currentSnapshot || !currentSnapshot.workflowData) {
      console.error(
        snapshotError ||
          `[updateWorkflowDescriptionAndRecord] 无法获取标签页 ${internalId} 的当前快照或 workflowData。`
      );
      return;
    }

    // 如果描述未改变，则跳过
    const currentDescription = currentSnapshot.workflowData.description || "";
    if (currentDescription === newDescription) {
      console.debug(
        `[updateWorkflowDescriptionAndRecord] 标签页 ${internalId} 的描述未改变。跳过。`
      );
      return;
    }

    // 准备下一个状态快照
    const nextSnapshot = klona(currentSnapshot);
    nextSnapshot.workflowData!.description = newDescription; // 更新描述

    // 应用状态更新
    const applied = workflowManager.applyStateSnapshot(internalId, nextSnapshot);

    if (applied) {
      // 记录历史
      recordHistory(internalId, entry, nextSnapshot);
      // 标记为脏状态
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
    // 如果正在尝试设置目标 (而不是清除)
    if (target) {
      const currentWorkflowState = workflowManager.getCurrentSnapshot(internalId); // 修正：使用 getCurrentSnapshot
      if (currentWorkflowState?.elements) {
        const targetNode = currentWorkflowState.elements.find(
          (el: VueFlowNode | Edge) => el.id === target.nodeId && !("source" in el)
        ) as VueFlowNode | undefined; // 修正：添加 el 类型
        if (targetNode) {
          let slotType: string | undefined;
          // 检查是否为 GroupInput 或 GroupOutput 节点，它们从 workflowData 获取接口定义
          // 注意：GroupInput 节点的输出 Handle 代表其在 workflowData.interfaceInputs 中的定义
          // GroupOutput 节点的输出 Handle 代表其在 workflowData.interfaceOutputs 中的定义
          if (targetNode.type === "core:GroupInput") {
            const workflowData = currentWorkflowState.workflowData;
            // GroupInput 节点的输出 Handle (source handle) 对应于 interfaceInputs
            if (workflowData?.interfaceInputs) {
              // 确保 interfaceInputs 存在
              // slotType = workflowData.interfaceInputs[target.slotKey]?.dataFlowType; // 使用可选链
              const slotDef = getSlotDefinition(targetNode, target.slotKey, "source", workflowData);
              slotType = slotDef?.dataFlowType;
            }
          } else if (targetNode.type === "core:GroupOutput") {
            // GroupOutput 节点在画布上没有直接的输出句柄 (source handle) 可供用户点击选择预览。
            // 其“概念性输出”在工作流的 interfaceOutputs 中定义。
            // 当用户选择预览 GroupOutput 的某个概念性输出时，
            // 传入的 target.slotKey 必须是 workflowData.interfaceOutputs 中的一个键，
            // 以便查找该输出的类型 (dataFlowType) 等信息。
            const workflowData = currentWorkflowState.workflowData;
            if (workflowData?.interfaceOutputs) {
              // 确保 interfaceOutputs 存在
              // slotType = workflowData.interfaceOutputs[target.slotKey]?.dataFlowType; // 使用可选链
              const slotDef = getSlotDefinition(targetNode, target.slotKey, "target", workflowData);
              slotType = slotDef?.dataFlowType;
            }
          } else {
            // 普通节点的输出插槽
            const outputDefinition =
              targetNode.data?.outputSchema?.[target.slotKey] ||
              targetNode.data?.outputs?.[target.slotKey];
            slotType = outputDefinition?.dataFlowType;
          }

          if (slotType === DataFlowType.WILDCARD || slotType === DataFlowType.CONVERTIBLE_ANY) {
            console.warn(
              `[InteractionCoordinator:setPreviewTargetAndRecord] 尝试将类型为 ${slotType} 的插槽 ${target.nodeId}::${target.slotKey} 设置为预览目标，已阻止。`
            );
            return; // 阻止设置
          }
        } else {
          console.warn(
            `[InteractionCoordinator:setPreviewTargetAndRecord] 尝试设置预览目标时未找到节点 ${target.nodeId}。`
          );
        }
      }
    }

    const { snapshot: currentSnapshot, error: snapshotError } = validateAndGetSnapshot(
      internalId,
      "setPreviewTargetAndRecord"
    );
    if (snapshotError || !currentSnapshot || !currentSnapshot.workflowData) {
      console.error(
        snapshotError ||
          `[setPreviewTargetAndRecord] 无法获取标签页 ${internalId} 的当前快照或 workflowData。`
      );
      return;
    }

    // 检查预览目标是否真的发生了变化
    const oldTargetJson = JSON.stringify(currentSnapshot.workflowData.previewTarget ?? null);
    const newTargetJson = JSON.stringify(target ?? null);

    if (oldTargetJson === newTargetJson) {
      console.debug(`[setPreviewTargetAndRecord] 标签页 ${internalId} 的预览目标未改变。跳过。`);
      return;
    }

    // 准备下一个状态快照
    const nextSnapshot = klona(currentSnapshot);
    if (nextSnapshot.workflowData) {
      // Type guard
      nextSnapshot.workflowData.previewTarget = target ? klona(target) : null;
    }

    // 应用状态更新 (通过 workflowManager)
    // workflowManager.setPreviewTarget 内部会处理脏状态标记
    await workflowManager.setPreviewTarget(internalId, target);

    // 记录历史
    recordHistory(internalId, entry, nextSnapshot);

    // 触发预览 (可选，根据需求)
    // 当前设计是设置目标时不触发，而是后续节点值变化时触发
    // if (isPreviewEnabled.value && target) {
    //   requestPreviewExecution(internalId, target.nodeId, target.slotKey, /* 获取当前值? */);
    // }
    console.debug(
      `[InteractionCoordinator] 已为标签页 ${internalId} 设置预览目标并记录历史: ${newTargetJson}`
    );
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
    currentValue: any, // currentValue 可以是任何类型
    inputDefinition: InputDefinition, // InputDefinition 是 GroupSlotInfo
    editorTitle?: string
  ) => {
    const editorState = useEditorState();

    // 确定 editorType
    let editorType = "text"; // 默认类型
    if (inputDefinition.config?.languageHint) {
      editorType = inputDefinition.config.languageHint as string;
    } else {
      switch (inputDefinition.dataFlowType) {
        case DataFlowType.OBJECT: // 用于 JSON_LIKE
          editorType = "json";
          break;
        case DataFlowType.STRING: // 用于 MARKDOWN_LIKE 或普通文本
          editorType = "text"; // 或者 'markdown' 如果有其他提示
          break;
        default:
          editorType = "text";
          break;
      }
    }
    if (inputDefinition.config?.uiWidget === "CodeInput" && !inputDefinition.config?.languageHint) {
      editorType = (inputDefinition.config?.language as string) || "plaintext";
    } else if (
      inputDefinition.config?.uiWidget === "TextAreaInput" &&
      !inputDefinition.config?.languageHint
    ) {
      if (inputDefinition.matchCategories?.includes("Markdown")) {
        editorType = "markdown";
      } else {
        editorType = "text";
      }
    }

    // 准备 initialContent，确保 JSON 对象被字符串化
    let finalInitialContent: string;
    if (editorType === "json" && typeof currentValue === "object" && currentValue !== null) {
      try {
        finalInitialContent = JSON.stringify(currentValue, null, 2); // 美化 JSON 字符串
      } catch (e) {
        console.error(`Error stringifying JSON for editor ${nodeId}.${inputKey}:`, e);
        finalInitialContent = String(currentValue); // 回退到普通字符串转换
      }
    } else if (currentValue === null || currentValue === undefined) {
      finalInitialContent = ""; // 对于 null 或 undefined，使用空字符串
    } else {
      finalInitialContent = String(currentValue); // 其他类型转换为字符串
    }

    const finalTitle = editorTitle || `编辑 ${nodeId} - ${inputKey}`;

    const context: EditorOpeningContext = {
      nodeId,
      inputPath: `inputs.${inputKey}`, // 假设我们总是编辑 'inputs' 下的属性
      initialContent: finalInitialContent, // 使用处理过的 initialContent
      languageHint: editorType,
      title: finalTitle, // 使用 editorTitle 或生成的默认标题
      onSave: (newContent: string) => {
        // newContent 从编辑器出来总是字符串
        let valueToSave: any = newContent;
        if (editorType === "json") {
          try {
            valueToSave = JSON.parse(newContent);
          } catch (e) {
            console.error(`Error parsing JSON from editor for ${nodeId}.${inputKey}:`, e);
            // 决定如何处理解析错误：是保存原始字符串还是报错？
            // 暂时保存原始字符串，但可能需要用户提示或更复杂的错误处理
          }
        }

        const historyEntry: HistoryEntry = {
          actionType: "modify", // 使用 actionType
          objectType: "nodeInput", // 使用 objectType
          summary: `更新节点 ${nodeId} 输入 ${inputKey}`,
          timestamp: Date.now(),
          details: {
            nodeId,
            inputKey,
            propertyName: inputKey, // 对应 HistoryEntryDetails
            oldValue: currentValue, // oldValue 仍然是原始的 currentValue
            newValue: valueToSave, // newValue 是处理过的 (可能是对象或字符串)
          },
        };
        updateNodeInputValueAndRecord(activeTabId, nodeId, inputKey, valueToSave, historyEntry);
        console.log(
          `[InteractionCoordinator] Docked editor content saved for ${nodeId}.${inputKey}:`,
          valueToSave
        );
      },
    };

    // 确保编辑器面板可见
    if (!editorState.isDockedEditorVisible.value) {
      editorState.toggleDockedEditor();
    }

    // 调用 editorState 中的方法来打开/激活编辑器标签页
    // 假设 editorState 有一个名为 openEditor 的方法
    // editorState.openEditor(context);
    // 根据 useEditorState.ts 的当前实现，它还没有 openEditor 方法。
    // 我们需要先在 useEditorState.ts 中实现类似的功能。
    // 暂时，我们只打印日志，表示意图。
    console.log("[InteractionCoordinator] Requesting to open docked editor with context:", context);
    // 这里需要调用 useEditorState 提供的实际方法。
    // openOrFocusEditorTab 应该总是存在于 useEditorState 的返回中
    editorState.openOrFocusEditorTab(context);
  };

  /**
   * 更新节点输入连接顺序并记录历史。
   * @param internalId - 标签页的内部 ID。
   * @param nodeId - 目标节点的 ID。
   * @param handleKey - 输入插槽的 key。
   * @param orderedEdgeIds - 排序后的 Edge ID 列表。
   * @param entry - 接收一个已创建的 HistoryEntry 对象。
   */
  async function updateNodeInputConnectionOrderAndRecord(
    nodeId: string,
    handleKey: string,
    newOrderedEdgeIds: string[],
    entry: HistoryEntry // entry is for recordHistory
  ) {
    const currentActiveTabId = tabStore.activeTabId;
    if (!currentActiveTabId) {
      console.error(
        "[InteractionCoordinator:updateNodeInputConnectionOrderAndRecord] No active tab ID."
      );
      return;
    }
    const { snapshot: currentSnapshot, error: snapshotError } = validateAndGetSnapshot(
      currentActiveTabId,
      "updateNodeInputConnectionOrderAndRecord"
    );
    if (snapshotError || !currentSnapshot) {
      console.error(
        snapshotError ||
          `[InteractionCoordinator:updateNodeInputConnectionOrderAndRecord] Cannot get snapshot for tab ${currentActiveTabId}`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot); // 准备可变快照

    // 调用 action 更新节点输入连接顺序
    const result = await multiInputActions.updateNodeInputConnectionOrder(
      nextSnapshot, // mutableSnapshot
      nodeId, // nodeId
      handleKey, // handleKey
      newOrderedEdgeIds // newOrderedEdgeIds
    );

    // 使用 action 返回的结果更新 nextSnapshot
    // 即使 action 直接修改了 nextSnapshot.elements 和 nextSnapshot.workflowData，
    // 并且返回了这些引用，那么这里的赋值是正确的。
    // 如果 action 返回了全新的对象，这也是正确的。
    nextSnapshot.elements = result.modifiedElements;
    if (result.modifiedWorkflowData !== undefined) {
      // 检查 undefined，因为它可以是 null
      nextSnapshot.workflowData = result.modifiedWorkflowData;
    }

    // 记录历史
    recordHistory(currentActiveTabId, entry, nextSnapshot);

    // 应用状态更新
    // 使用 applyStateSnapshot 来确保 workflowData (如果被修改) 也被正确应用
    const applied = workflowManager.applyStateSnapshot(currentActiveTabId, nextSnapshot);
    if (!applied) {
      console.error(
        `[InteractionCoordinator:updateNodeInputConnectionOrderAndRecord] Failed to apply snapshot for tab ${currentActiveTabId}.`
      );
    }

    // (可选) 触发视图更新，确保连接的节点正确渲染
    // 对于仅顺序更改，通常不需要 updateNodeInternals，除非它影响了插槽的显示方式
    // 但为了与其他多输入操作保持一致，可以考虑添加
    if (nextSnapshot.elements.find((n) => n.id === nodeId && !("source" in n))) {
      await updateNodeInternals(currentActiveTabId, [nodeId]);
    }
  }

  /**
   * 处理边从输入端断开的操作，并更新原目标节点的 inputConnectionOrders (如果它是多输入插槽)。
   * @param internalId - 标签页的内部 ID。
   * @param edgeId - 要断开的边的 ID。
   * @param originalTargetNodeId - 原始目标节点的 ID。
   * @param originalTargetHandleId - 原始目标句柄的 ID。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function disconnectEdgeFromInputAndRecord(
    // internalId: string, // internalId is now derived from activeTabId in multiInputActions
    edgeId: string,
    originalTargetNodeId: string,
    originalTargetHandleId: string,
    entry: HistoryEntry // This entry is for recordHistory
  ) {
    const currentActiveTabId = tabStore.activeTabId;
    if (!currentActiveTabId) {
      console.error("[InteractionCoordinator:disconnectEdgeFromInputAndRecord] No active tab ID.");
      return;
    }
    const { snapshot: currentSnapshot, error: snapshotError } = validateAndGetSnapshot(
      currentActiveTabId,
      "disconnectEdgeFromInputAndRecord"
    );
    if (snapshotError || !currentSnapshot) {
      console.error(
        snapshotError ||
          `[InteractionCoordinator:disconnectEdgeFromInputAndRecord] Cannot get snapshot for tab ${currentActiveTabId}`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot); // Prepare mutable snapshot

    // 调用 action 处理边断开连接
    const result = await multiInputActions.disconnectEdgeFromMultiInput(
      nextSnapshot, // mutableSnapshot
      edgeId, // edgeId
      originalTargetNodeId, // originalTargetNodeId
      originalTargetHandleId // originalTargetHandleId
      // currentActiveTabId        // Removed 5th argument (activeTabIdString)
    );

    // 使用 action 返回的结果更新 nextSnapshot
    // 如果 action 直接修改了 nextSnapshot.elements 和 nextSnapshot.workflowData，
    // 并且返回了这些引用，那么这里的赋值是正确的。
    // 如果 action 返回了全新的对象，这也是正确的。
    nextSnapshot.elements = result.modifiedElements;
    if (result.modifiedWorkflowData !== undefined) {
      nextSnapshot.workflowData = result.modifiedWorkflowData;
    }

    // 确保边确实从 nextSnapshot.elements 中移除了 (如果 action 应该这样做的话)
    // disconnectEdgeFromMultiInput 函数现在已实现，并负责从 elements 中移除边
    // 以及更新多输入目标节点的 inputConnectionOrders。

    // 记录历史
    recordHistory(currentActiveTabId, entry, nextSnapshot);

    // 应用状态更新
    if (nextSnapshot.workflowData) {
      await workflowManager.setElementsAndInterface(
        currentActiveTabId,
        nextSnapshot.elements,
        nextSnapshot.workflowData.interfaceInputs ?? {},
        nextSnapshot.workflowData.interfaceOutputs ?? {}
      );
    } else {
      await workflowManager.setElements(currentActiveTabId, nextSnapshot.elements);
    }

    // (可选) 触发视图更新
    if (nextSnapshot.elements.find((n) => n.id === originalTargetNodeId && !("source" in n))) {
      await updateNodeInternals(currentActiveTabId, [originalTargetNodeId]);
    }
  }

  /**
   * 处理边连接到输入端的操作，并更新目标节点的 inputConnectionOrders (如果它是多输入插槽)。
   * @param internalId - 标签页的内部 ID。
   * @param newEdgeParams - 包含 source/target node/handle 的新边参数。
   * @param targetIndexInOrder - 可选，如果目标是多输入，则为插入位置的索引。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function connectEdgeToInputAndRecord(
    newEdgeParams: Edge,
    targetIndexInOrder: number | undefined,
    entry: HistoryEntry // entry is for recordHistory
  ) {
    const currentActiveTabId = tabStore.activeTabId;
    if (!currentActiveTabId) {
      console.error("[InteractionCoordinator:connectEdgeToInputAndRecord] No active tab ID.");
      return;
    }
    const { snapshot: currentSnapshot, error: snapshotError } = validateAndGetSnapshot(
      currentActiveTabId,
      "connectEdgeToInputAndRecord"
    );
    if (snapshotError || !currentSnapshot) {
      console.error(
        snapshotError ||
          `[InteractionCoordinator:connectEdgeToInputAndRecord] Cannot get snapshot for tab ${currentActiveTabId}`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot); // Prepare mutable snapshot

    // 调用 action 处理边连接
    const result = await multiInputActions.connectEdgeToMultiInput(
      nextSnapshot, // mutableSnapshot
      klona(newEdgeParams), // newEdgeParams (克隆以防万一)
      targetIndexInOrder, // targetIndexInOrder
      currentActiveTabId // activeTabIdString
    );

    // 使用 action 返回的结果更新 nextSnapshot
    nextSnapshot.elements = result.modifiedElements;
    if (result.modifiedWorkflowData !== undefined) {
      nextSnapshot.workflowData = result.modifiedWorkflowData;
    }

    // 记录历史
    recordHistory(currentActiveTabId, entry, nextSnapshot);

    // 应用状态更新
    if (nextSnapshot.workflowData) {
      await workflowManager.setElementsAndInterface(
        currentActiveTabId,
        nextSnapshot.elements,
        nextSnapshot.workflowData.interfaceInputs ?? {},
        nextSnapshot.workflowData.interfaceOutputs ?? {}
      );
    } else {
      // 万一 workflowData 变为 null (理论上不应该，但作为保险)
      await workflowManager.setElements(currentActiveTabId, nextSnapshot.elements);
      // (可选) 触发视图更新，确保连接的节点正确渲染
      const sourceNodeId = newEdgeParams.source;
      const targetNodeId = newEdgeParams.target;
      if (
        sourceNodeId &&
        targetNodeId &&
        nextSnapshot.elements.find((n) => n.id === sourceNodeId) &&
        nextSnapshot.elements.find((n) => n.id === targetNodeId)
      ) {
        await updateNodeInternals(currentActiveTabId, [sourceNodeId, targetNodeId]);
      } else {
        console.warn(
          `[InteractionCoordinator:connectEdgeToInputAndRecord] Source or target node for edge ${newEdgeParams.id} not found in snapshot, skipping updateNodeInternals.`
        );
      }
    }
  }

  /**
   * 处理将一条现有连接从其旧的连接点移动到新的连接点。
   * 包括处理从单输入到多输入、多输入到单输入、多输入到多输入（可能涉及顺序改变）等情况。
   * @param internalId - 标签页的内部 ID。
   * @param edgeToMoveId - 要移动的边的 ID。
   * @param originalTargetNodeId - 原始目标节点的 ID。
   * @param originalTargetHandleId - 原始目标句柄的 ID。
   * @param newSourceNodeId - 新的源节点 ID。
   * @param newSourceHandleId - 新的源句柄 ID。
   * @param newTargetNodeId - 新的目标节点 ID。
   * @param newTargetHandleId - 新的目标句柄 ID。
   * @param newTargetIndexInOrder - 可选，如果新目标是多输入，则为插入位置的索引。
   * @param entry - 描述此操作的历史记录条目。
   */
  async function moveAndReconnectEdgeAndRecord(
    // internalId: string, // internalId is now derived from activeTabId in multiInputActions
    edgeToMoveId: string,
    originalTargetNodeId: string,
    originalTargetHandleId: string,
    newSourceNodeId: string,
    newSourceHandleId: string | undefined,
    newTargetNodeId: string, // 确保这是 string 类型，而不是 string | undefined
    newTargetHandleId: string | undefined,
    newTargetIndexInOrder: number | undefined,
    entry: HistoryEntry
  ) {
    const currentActiveTabId = tabStore.activeTabId;
    if (!currentActiveTabId) {
      console.error("[InteractionCoordinator:moveAndReconnectEdgeAndRecord] No active tab ID.");
      return;
    }
    const { snapshot: currentSnapshot, error: snapshotError } = validateAndGetSnapshot(
      currentActiveTabId,
      "moveAndReconnectEdgeAndRecord"
    );
    if (snapshotError || !currentSnapshot) {
      console.error(
        snapshotError ||
          `[InteractionCoordinator:moveAndReconnectEdgeAndRecord] Cannot get snapshot for tab ${currentActiveTabId}`
      );
      return;
    }

    const nextSnapshot = klona(currentSnapshot); // 准备可变快照

    // 调用 action 处理边移动和重连
    const result = await multiInputActions.moveAndReconnectEdgeMultiInput(
      nextSnapshot, // mutableSnapshot
      edgeToMoveId, // edgeToMoveId
      originalTargetNodeId, // originalTargetNodeId
      originalTargetHandleId, // originalTargetHandleId
      newSourceNodeId, // newSourceNodeId
      newSourceHandleId, // newSourceHandleId
      newTargetNodeId, // newTargetNodeId (确保这里是 string)
      newTargetHandleId, // newTargetHandleId
      newTargetIndexInOrder, // newTargetIndexInOrder
      currentActiveTabId //. activeTabIdString
    );

    // 使用 action 返回的结果更新 nextSnapshot
    nextSnapshot.elements = result.modifiedElements;
    if (result.modifiedWorkflowData !== undefined) {
      // 检查 undefined，因为它可以是 null
      nextSnapshot.workflowData = result.modifiedWorkflowData;
    }

    // 记录历史
    recordHistory(currentActiveTabId, entry, nextSnapshot);

    // 应用状态更新
    if (nextSnapshot.workflowData) {
      await workflowManager.setElementsAndInterface(
        currentActiveTabId,
        nextSnapshot.elements,
        nextSnapshot.workflowData.interfaceInputs ?? {},
        nextSnapshot.workflowData.interfaceOutputs ?? {}
      );
    } else {
      // 万一 workflowData 变为 null (理论上不应该，但作为保险)
      await workflowManager.setElements(currentActiveTabId, nextSnapshot.elements);
      // (可选) 触发视图更新，确保连接的节点正确渲染
      const nodesToUpdate = new Set<string>();
      if (originalTargetNodeId) nodesToUpdate.add(originalTargetNodeId);
      if (newSourceNodeId) nodesToUpdate.add(newSourceNodeId);
      if (newTargetNodeId) nodesToUpdate.add(newTargetNodeId);

      const validNodesToUpdate = Array.from(nodesToUpdate).filter((nodeId) =>
        nextSnapshot.elements.find((n) => n.id === nodeId && !("source" in n))
      );

      if (validNodesToUpdate.length > 0) {
        await updateNodeInternals(currentActiveTabId, validNodesToUpdate);
      } else {
        console.warn(
          `[InteractionCoordinator:moveAndReconnectEdgeAndRecord] No valid nodes found to update internals for edge ${edgeToMoveId}.`
        );
      }
    }
  }

  // 导出公共接口
  return {
    // --- 核心交互函数 ---
    updateNodePositionAndRecord, // 更新节点位置
    handleConnectionWithInterfaceUpdate, // 处理带接口更新的连接
    addNodeAndRecord, // 添加节点
    addFrameNodeAndRecord, // 添加分组框
    updateWorkflowInterfaceAndRecord, // 更新工作流接口
    addEdgeAndRecord, // 添加边
    removeElementsAndRecord, // 删除元素 (节点/边)
    updateNodeInputValueAndRecord, // 更新节点输入值 (含预览触发)
    updateNodeConfigValueAndRecord, // 更新节点配置值 (含预览触发和 NodeGroup 逻辑)
changeNodeModeAndRecord, // 原子性地更改节点模式
    updateNodeLabelAndRecord,
    updateNodeDimensionsAndRecord, // 更新节点尺寸
    updateNodeComponentStateAndRecord, // 更新节点内部组件状态
    updateNodeParentAndRecord, // 新增：更新节点的父节点
    removeEdgesByHandleAndRecord, // 按句柄删除边
    updateWorkflowNameAndRecord, // 更新工作流名称
    updateWorkflowDescriptionAndRecord, // 更新工作流描述
    setPreviewTargetAndRecord, // 新增：设置/清除预览目标并记录历史
    openDockedEditorForNodeInput, // 新增：打开可停靠编辑器
    updateNodeInputConnectionOrderAndRecord,
    disconnectEdgeFromInputAndRecord,
    connectEdgeToInputAndRecord,
    moveAndReconnectEdgeAndRecord,
    addElementsAndRecord, // <-- 导出新函数

    // --- 预览相关 (来自 useWorkflowPreview) ---
    isPreviewEnabled, // 导出从 useWorkflowPreview 获取的预览状态
    // requestPreviewExecution 主要由上面的更新函数内部调用，通常不直接从协调器暴露
    // executeWorkflow 已移至 useWorkflowExecution
  };
}
