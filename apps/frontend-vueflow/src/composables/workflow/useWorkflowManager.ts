import {
  DataFlowType,
  type GroupSlotInfo,
  type InputDefinition,
  type OutputDefinition,
  type WorkflowEdge as StorageEdge,
  type WorkflowNode as StorageNode,
  WorkflowStorageObjectSchema,
  type WorkflowStorageObject,
} from "@comfytavern/types";
import { getEffectiveDefaultValue } from "@comfytavern/utils";
import type { Edge as VueFlowEdge, Node as VueFlowNode } from "@vue-flow/core";
import { klona } from "klona";
import { computed, reactive, ref, watch } from "vue";
import defaultWorkflowTemplateUntyped from "@/data/DefaultWorkflow.json";
import { useDialogService } from "../../services/DialogService";
import { useNodeStore } from "../../stores/nodeStore";
import { useTabStore } from "../../stores/tabStore";
import { useThemeStore } from "../../stores/theme";
import type {
  TabWorkflowState,
  Viewport,
  WorkflowData,
  WorkflowStateSnapshot,
} from "../../types/workflowTypes";
import { transformWorkflowToVueFlow } from "@/utils/workflowTransformer";
import { useEdgeStyles } from "../canvas/useEdgeStyles";

// #region --- 内部辅助函数 ---

/**
 * 在给定的插槽记录中，为指定的前缀（'input' 或 'output'）找到下一个可用的索引。
 * @param slots - 一个记录 GroupSlotInfo 的对象。
 * @param prefix - 要查找的前缀，'input' 或 'output'。
 * @returns 下一个可用的数字索引。
 */
function findNextSlotIndex(
  slots: Record<string, GroupSlotInfo>,
  prefix: "input" | "output"
): number {
  let maxIndex = -1;
  const regex = new RegExp(`^${prefix}_(\\d+)$`);
  for (const key in slots) {
    const match = key.match(regex);
    if (match) {
      const indexStr = match[1];
      if (indexStr) {
        const index = parseInt(indexStr, 10);
        if (!isNaN(index) && index > maxIndex) {
          maxIndex = index;
        }
      }
    }
  }
  return maxIndex + 1;
}

// #endregion

// #region --- 单例实现 ---

let instance: ReturnType<typeof createWorkflowManager> | null = null;

/**
 * 创建工作流管理器的核心逻辑。
 * 这是一个私有函数，由 useWorkflowManager 包装以实现单例模式。
 */
function createWorkflowManager() {
  // --- 依赖项 ---
  const tabStore = useTabStore();
  const themeStore = useThemeStore();
  const nodeStore = useNodeStore();
  const dialogService = useDialogService();
  const { getEdgeStyleProps } = useEdgeStyles();
  const isDark = computed(() => themeStore.currentAppliedMode === "dark");

  // --- 核心状态 ---
  /**
   * 存储所有标签页的工作流状态。
   * Key 是标签页的 internalId，Value 是该标签页的状态对象。
   */
  const tabStates = reactive<Map<string, TabWorkflowState>>(new Map());

  // --- 计算属性 ---
  const activeTabId = computed(() => tabStore.activeTabId);
  const getAllTabStates = computed(() => tabStates);

  /**
   * 获取当前活动标签页的预览目标。
   */
  const activePreviewTarget = computed(() => {
    const state = getActiveTabState();
    return state?.workflowData?.previewTarget ?? null;
  });

  /**
   * 判断当前工作流是否为新创建（还未持久化）。
   */
  const isCurrentWorkflowNew = computed(() => !getActiveTabState()?.isPersisted);

  /**
   * 用于请求组输出总览模式的状态。
   */
  const _showGroupOutputOverview = ref(false);
  const showGroupOutputOverview = computed(() => _showGroupOutputOverview.value);

  /**
   * 监视活动标签页的 `elements` 数组的变化。
   * 为了高效地检测数组内容（节点/边）的增删，我们观察一个由数组长度和ID列表字符串组成的元组。
   * 这样可以避免深度观察整个 `elements` 数组带来的性能开销。
   */
  watch(
    () => {
      const id = activeTabId.value;
      if (id) {
        const state = tabStates.get(id);
        if (!state || !state.elements) return undefined;
        try {
          return [
            state.elements.length,
            JSON.stringify(state.elements.map((e: VueFlowNode | VueFlowEdge) => e.id)),
          ];
        } catch (error) {
          return undefined;
        }
      }
      return undefined;
    },
    () => {
      // 此处的回调函数主要用于调试，当前版本中无实际逻辑。
    },
    { deep: false }
  );

  // #region --- 内部转换函数 ---

  /**
   * 将存储格式的节点（StorageNode）转换为 VueFlow 节点格式。
   * @param storageNode - 存储格式的节点对象。
   * @returns VueFlow 节点对象。
   */
  function _storageNodeToVueFlowNode(storageNode: StorageNode): VueFlowNode {
    const nodeDef = nodeStore.getNodeDefinitionByFullType(storageNode.type);
    const vueNode: VueFlowNode = {
      id: storageNode.id,
      type: storageNode.type,
      position: storageNode.position,
      label: storageNode.displayName || nodeDef?.displayName || storageNode.type,
      data: {},
      width: storageNode.width,
      height: storageNode.height,
      style: {
        ...(storageNode.width && { width: `${storageNode.width}px` }),
        ...(storageNode.height && { height: `${storageNode.height}px` }),
      },
    };

    const vueFlowData: Record<string, any> = {
      ...(nodeDef || {}),
      configValues: klona(storageNode.configValues || {}),
      defaultDescription: nodeDef?.description || "",
      description: storageNode.customDescription || nodeDef?.description || "",
      inputs: {},
      outputs: {},
    };

    if (nodeDef?.inputs) {
      Object.entries(nodeDef.inputs).forEach(([inputName, inputDefUntyped]) => {
        const inputDef = inputDefUntyped as InputDefinition;
        const effectiveDefault = getEffectiveDefaultValue(inputDef);
        const storedValue = storageNode.inputValues?.[inputName];
        const finalValue = storedValue !== undefined ? storedValue : effectiveDefault;
        const defaultSlotDesc = inputDef.description || "";
        const customSlotDesc = storageNode.customSlotDescriptions?.inputs?.[inputName];

        vueFlowData.inputs[inputName] = {
          value: klona(finalValue),
          description: customSlotDesc || defaultSlotDesc,
          defaultDescription: defaultSlotDesc,
          ...klona(inputDef),
        };
      });
    }

    if (nodeDef?.outputs) {
      Object.entries(nodeDef.outputs).forEach(([outputName, outputDefUntyped]) => {
        const outputDef = outputDefUntyped as OutputDefinition;
        const defaultSlotDesc = outputDef.description || "";
        const customSlotDesc = storageNode.customSlotDescriptions?.outputs?.[outputName];

        vueFlowData.outputs[outputName] = {
          description: customSlotDesc || defaultSlotDesc,
          defaultDescription: defaultSlotDesc,
          ...klona(outputDef),
        };
      });
    }

    const nodeDefaultLabel = nodeDef?.displayName || storageNode.type;
    vueFlowData.defaultLabel = nodeDefaultLabel;
    vueFlowData.displayName = storageNode.displayName || nodeDefaultLabel;

    if (storageNode.inputConnectionOrders) {
      vueFlowData.inputConnectionOrders = klona(storageNode.inputConnectionOrders);
    }

    vueNode.data = vueFlowData;
    return vueNode;
  }

  /**
   * 将存储格式的边（StorageEdge）转换为 VueFlow 边格式（不含样式）。
   * @param storageEdge - 存储格式的边对象。
   * @returns VueFlow 边对象。
   */
  function _storageEdgeToVueFlowEdge(storageEdge: StorageEdge): VueFlowEdge {
    return {
      id: storageEdge.id,
      source: storageEdge.source,
      target: storageEdge.target,
      sourceHandle: storageEdge.sourceHandle,
      targetHandle: storageEdge.targetHandle,
      data: storageEdge.data || {},
    };
  }

  // #endregion

  // #region --- 核心状态应用逻辑 ---

  /**
   * 将一个完整的工作流数据应用到指定的标签页状态中。
   * @param internalId - 目标标签页的内部 ID。
   * @param workflow - 要应用的工作流数据对象。
   * @param elements - VueFlow 格式的节点和边数组。
   * @param viewport - 视口信息。
   * @returns 应用后的状态快照，如果失败则返回 null。
   */
  async function _applyWorkflowToTab(
    internalId: string,
    workflow: WorkflowData,
    elements: Array<VueFlowNode | VueFlowEdge>,
    viewport: Viewport
  ): Promise<WorkflowStateSnapshot | null> {
    const state = await ensureTabState(internalId, false);
    if (!state) {
      console.error(`[_applyWorkflowToTab] 无法找到标签页 ${internalId} 的状态。`);
      return null;
    }

    state.workflowData = klona(workflow);

    if (state.workflowData) {
      if (!state.workflowData.interfaceInputs) state.workflowData.interfaceInputs = {};
      const inputSlots = state.workflowData.interfaceInputs;
      if (!Object.values(inputSlots).some((slot) => slot.allowDynamicType === true)) {
        const nextInputIndex = findNextSlotIndex(inputSlots, "input");
        const newInputKey = `input_${nextInputIndex}`;
        inputSlots[newInputKey] = {
          key: newInputKey,
          dataFlowType: DataFlowType.CONVERTIBLE_ANY,
          displayName: "*",
          customDescription:
            "这是一个**可转换**的动态输入接口，初始类型为 `CONVERTIBLE_ANY`。\n\n- 连接后，其类型和名称将根据连接自动更新。\n- 会生成一个新的**空心插槽**。\n- 可在**侧边栏**编辑接口属性。",
          allowDynamicType: true,
        };
      }
      if (!state.workflowData.interfaceOutputs) state.workflowData.interfaceOutputs = {};
      const outputSlots = state.workflowData.interfaceOutputs;
      if (!Object.values(outputSlots).some((slot) => slot.allowDynamicType === true)) {
        const nextOutputIndex = findNextSlotIndex(outputSlots, "output");
        const newOutputKey = `output_${nextOutputIndex}`;
        outputSlots[newOutputKey] = {
          key: newOutputKey,
          dataFlowType: DataFlowType.CONVERTIBLE_ANY,
          displayName: "*",
          customDescription:
            "这是一个**可转换**的动态输出接口，初始类型为 `CONVERTIBLE_ANY`。\n\n- 连接后，其类型和名称将根据连接自动更新。\n- 会生成一个新的**空心插槽**。\n- 可在**侧边栏**编辑接口属性。",
          allowDynamicType: true,
        };
      }
    }

    state.viewport = klona(viewport);

    const nodes = elements.filter((el): el is VueFlowNode => !("source" in el));
    const originalEdges = elements.filter((el): el is VueFlowEdge => "source" in el);
    const styledEdges = originalEdges.map((edge) => {
      const sourceType = edge.data?.sourceType || "any";
      const targetType = edge.data?.targetType || "any";
      const styleProps = getEdgeStyleProps(sourceType, targetType, isDark.value);
      return { ...edge, ...styleProps };
    });

    state.elements = klona([...nodes, ...styledEdges]);

    const tabInfo = tabStore.tabs.find((t) => t.internalId === internalId);
    if (tabInfo?.type === "groupEditor" && state.workflowData) {
      state.groupInterfaceInfo = null; // 暂时禁用
    } else {
      state.groupInterfaceInfo = null;
    }

    state.isDirty = false;
    state.isLoaded = true;

    tabStore.updateTab(internalId, {
      label: workflow.name,
      associatedId: workflow.id,
      isDirty: false,
    });

    try {
      return klona({
        elements: state.elements,
        viewport: state.viewport,
        workflowData: state.workflowData,
      });
    } catch (error) {
      console.error(`[_applyWorkflowToTab] 创建返回快照时出错 for ${internalId}:`, error);
      return null;
    }
  }

  /**
   * 将默认工作流模板应用到指定的标签页。
   * @param internalId - 目标标签页的内部 ID。
   * @returns 应用后的状态快照，如果失败则返回 null。
   */
  async function applyDefaultWorkflowToTab(
    internalId: string
  ): Promise<WorkflowStateSnapshot | null> {
    const tabInfo = tabStore.tabs.find((t) => t.internalId === internalId);
    const projectId = tabInfo?.projectId || "default";
    const associatedId = tabInfo?.associatedId || crypto.randomUUID();
    const labelToUse = tabInfo?.label || defaultWorkflowTemplateUntyped.name || "*新工作流*";

    try {
      await nodeStore.ensureDefinitionsLoaded();

      const rawTemplateObject = {
        ...klona(defaultWorkflowTemplateUntyped),
        id: associatedId,
        name: labelToUse,
        projectId: projectId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        referencedWorkflows: [],
      };

      const validationResult = WorkflowStorageObjectSchema.safeParse(rawTemplateObject);
      if (!validationResult.success) {
        console.error("默认工作流模板数据验证失败:", validationResult.error);
        dialogService.showError("默认工作流模板格式无效。");
        return null;
      }
      const templateStorageObject = validationResult.data;

      const mockLoadWorkflowFunc = async (wfId: string): Promise<WorkflowStorageObject | null> => {
        console.warn(`[applyDefaultWorkflowToTab] mockLoadWorkflowFunc called for ${wfId}`);
        return null;
      };

      const { flowData, viewport } = await transformWorkflowToVueFlow(
        templateStorageObject,
        mockLoadWorkflowFunc,
        getEdgeStyleProps
      );

      const finalWorkflowData: WorkflowData = {
        ...templateStorageObject,
        id: associatedId,
        name: labelToUse,
        viewport: viewport,
      };

      return await _applyWorkflowToTab(
        internalId,
        finalWorkflowData,
        [...flowData.nodes, ...flowData.edges],
        viewport
      );
    } catch (error) {
      console.error(`[applyDefaultWorkflowToTab] 应用默认模板失败 for ${internalId}:`, error);
      dialogService.showError(
        `创建新工作流时应用默认模板失败: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  // #endregion

  // #region --- 公共状态管理函数 ---

  /**
   * 切换到组输出预览模式。
   */
  function switchToGroupOutputPreviewMode() {
    _showGroupOutputOverview.value = true;
  }

  /**
   * 清除组输出总览模式的请求。
   */
  function clearGroupOutputOverviewRequest() {
    _showGroupOutputOverview.value = false;
  }

  /**
   * 获取当前活动标签页的状态对象。
   * @returns 当前活动标签页的状态，如果无活动标签页则返回 undefined。
   */
  function getActiveTabState(): TabWorkflowState | undefined {
    const id = activeTabId.value;
    return id ? tabStates.get(id) : undefined;
  }

  /**
   * 获取指定ID的标签页状态对象。
   * @param internalId - 标签页的内部 ID。
   * @returns 对应标签页的状态，如果不存在则返回 undefined。
   */
  function getTabState(internalId: string): TabWorkflowState | undefined {
    return tabStates.get(internalId);
  }

  /**
   * 创建一个新的、初始化的标签页工作流状态对象。
   * @param internalId - 标签页的内部 ID。
   * @param tabInfo - 标签页的信息。
   * @returns 一个新的 TabWorkflowState 对象。
   */
  function createTabWorkflowState(
    internalId: string,
    tabInfo?: ReturnType<typeof useTabStore>["tabs"][number]
  ): TabWorkflowState {
    const associatedId = tabInfo?.associatedId;
    const initialWorkflowData: WorkflowData = {
      id: associatedId || `temp-${internalId}`,
      name: tabInfo?.label || "*新工作流*",
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      interfaceInputs: {},
      interfaceOutputs: {},
    };
    return {
      workflowData: initialWorkflowData,
      isDirty: false,
      isPersisted: false,
      vueFlowInstance: null,
      elements: [],
      viewport: initialWorkflowData.viewport,
      groupInterfaceInfo: null,
      isLoaded: false,
    };
  }

  /**
   * 确保给定标签页的状态存在。如果不存在，则会创建一个新的状态。
   * 如果状态是新创建的且代表一个新工作流，它将应用默认的工作流模板。
   * @param internalId - 标签页的内部 ID。
   * @param applyDefaultIfNeeded - 如果为 true (默认)，则在状态是新的且标签页用于新工作流时应用默认工作流。
   * @returns 确保存在的 TabWorkflowState。
   */
  async function ensureTabState(
    internalId: string,
    applyDefaultIfNeeded = true
  ): Promise<TabWorkflowState> {
    if (!tabStates.has(internalId)) {
      const tabInfo = tabStore.tabs.find((t) => t.internalId === internalId);
      const associatedId = tabInfo?.associatedId;
      const isNewWorkflow = !associatedId || associatedId.startsWith("temp-");

      const initialState = createTabWorkflowState(internalId, tabInfo);
      tabStates.set(internalId, initialState);

      if (isNewWorkflow && applyDefaultIfNeeded) {
        await applyDefaultWorkflowToTab(internalId);
      }
    }
    return tabStates.get(internalId)!;
  }

  /**
   * 获取指定标签页的工作流核心数据。
   * @param internalId - 标签页的内部 ID。
   * @returns 工作流数据对象，如果不存在则返回 null。
   */
  function getWorkflowData(internalId: string): WorkflowData | null {
    return tabStates.get(internalId)?.workflowData ?? null;
  }

  /**
   * 检查指定标签页的工作流是否有未保存的更改。
   * @param internalId - 标签页的内部 ID。
   * @returns 如果有未保存的更改则返回 true，否则返回 false。
   */
  function isWorkflowDirty(internalId: string): boolean {
    return tabStates.get(internalId)?.isDirty ?? false;
  }

  /**
   * 检查指定标签页的工作流是否为新创建（未持久化）。
   * @param internalId - 标签页的内部 ID。
   * @returns 如果是新工作流则返回 true，否则返回 false。
   */
  function isWorkflowNew(internalId: string): boolean {
    return !getTabState(internalId)?.isPersisted;
  }

  /**
   * 获取指定标签页的画布元素（节点和边）的深拷贝。
   * @param internalId - 标签页的内部 ID。
   * @returns 包含 VueFlow 节点和边的数组。
   */
  function getElements(internalId: string): Array<VueFlowNode | VueFlowEdge> {
    const state = tabStates.get(internalId);
    return state ? klona(state.elements) : [];
  }

  /**
   * 设置指定标签页的画布元素，并标记为“脏”。
   * @param internalId - 标签页的内部 ID。
   * @param elements - 新的元素数组。
   */
  async function setElements(internalId: string, elements: Array<VueFlowNode | VueFlowEdge>) {
    const state = await ensureTabState(internalId, false);
    if (!state) return;

    const newElements = klona(elements);
    if (JSON.stringify(state.elements) !== JSON.stringify(newElements)) {
      state.elements = newElements;
      markAsDirty(internalId);
    }
  }

  /**
   * 将指定标签页标记为“脏”（有未保存的更改）。
   * @param internalId - 标签页的内部 ID。
   */
  function markAsDirty(internalId: string) {
    const state = tabStates.get(internalId);
    if (state && !state.isDirty) {
      state.isDirty = true;
      tabStore.updateTab(internalId, { isDirty: true });
    } else if (!state) {
      console.warn(`[markAsDirty] 尝试将不存在的标签页 ${internalId} 标记为脏。`);
    }
  }

  /**
   * 移除指定标签页的工作流状态数据。
   * @param internalId - 标签页的内部 ID。
   */
  function removeWorkflowData(internalId: string) {
    if (tabStates.has(internalId)) {
      tabStates.delete(internalId);
    }
  }

  /**
   * 清除属于特定项目的所有工作流状态。
   * @param projectIdToClear - 要清除状态的项目 ID。
   */
  function clearWorkflowStatesForProject(projectIdToClear: string) {
    if (!projectIdToClear) return;

    const tabsToRemove: string[] = [];
    for (const tab of tabStore.tabs) {
      if (tab.projectId === projectIdToClear) {
        tabsToRemove.push(tab.internalId);
      }
    }

    for (const internalId of tabsToRemove) {
      if (tabStates.has(internalId)) {
        tabStates.delete(internalId);
      }
    }
  }

  /**
   * 检查指定标签页的状态是否已加载。
   * @param internalId - 标签页的内部 ID。
   * @returns 如果已加载则返回 true，否则返回 false。
   */
  function isTabLoaded(internalId: string): boolean {
    return tabStates.get(internalId)?.isLoaded ?? false;
  }

  /**
   * 原子性地更新画布元素和工作流接口定义。
   * 用于处理如 CONVERTIBLE_ANY 连接等需要同时更新两者的情况。
   * @param internalId - 标签页的内部 ID。
   * @param elements - 新的元素数组。
   * @param inputs - 新的输入接口定义。
   * @param outputs - 新的输出接口定义。
   */
  async function setElementsAndInterface(
    internalId: string,
    elements: Array<VueFlowNode | VueFlowEdge>,
    inputs: Record<string, GroupSlotInfo>,
    outputs: Record<string, GroupSlotInfo>
  ) {
    const state = await ensureTabState(internalId, false);
    if (!state || !state.workflowData) {
      console.error(`[setElementsAndInterface] 无法更新，未找到标签页 ${internalId} 的状态或 workflowData`);
      return;
    }

    const newElements = klona(elements);
    const newInputs = klona(inputs);
    const newOutputs = klona(outputs);

    const elementsChanged = JSON.stringify(state.elements) !== JSON.stringify(newElements);
    const inputsChanged = JSON.stringify(state.workflowData.interfaceInputs) !== JSON.stringify(newInputs);
    const outputsChanged = JSON.stringify(state.workflowData.interfaceOutputs) !== JSON.stringify(newOutputs);

    if (elementsChanged || inputsChanged || outputsChanged) {
      state.elements = newElements;

      if (state.workflowData) {
        const edgesFromElements = state.elements.filter((el) => "source" in el) as VueFlowEdge[];
        state.workflowData.edges = edgesFromElements.map((vueEdge) => ({
          id: vueEdge.id,
          source: vueEdge.source,
          target: vueEdge.target,
          sourceHandle: vueEdge.sourceHandle ?? null,
          targetHandle: vueEdge.targetHandle ?? null,
          type: vueEdge.type,
          data: vueEdge.data ? klona(vueEdge.data) : {},
        }));
      }

      state.workflowData.interfaceInputs = newInputs;
      state.workflowData.interfaceOutputs = newOutputs;

      markAsDirty(internalId);
    }
  }

  // #endregion

  // #region --- 状态快照与历史记录 ---

  /**
   * 获取指定标签页当前状态的深拷贝快照。
   * @param internalId - 目标标签页的内部 ID。
   * @returns 包含 elements, viewport, workflowData 的快照对象，如果状态不存在则返回 undefined。
   */
  function getCurrentSnapshot(internalId: string): WorkflowStateSnapshot | undefined {
    const state = tabStates.get(internalId);
    if (!state) {
      console.warn(`[getCurrentSnapshot] 无法获取快照，未找到标签页 ${internalId} 的状态`);
      return undefined;
    }
    try {
      return klona({
        elements: state.elements,
        viewport: state.viewport,
        workflowData: state.workflowData,
      });
    } catch (error) {
      console.error(`[getCurrentSnapshot] 获取标签页 ${internalId} 快照时出错:`, error);
      return undefined;
    }
  }

  /**
   * 应用一个工作流状态快照到指定的标签页。
   * 此操作主要用于历史记录恢复，仅更新核心数据，不直接修改画布。
   * @param internalId - 目标标签页的内部 ID。
   * @param snapshot - 要应用的状态快照。
   * @returns 如果应用成功则返回 true，否则返回 false。
   */
  function applyStateSnapshot(internalId: string, snapshot: WorkflowStateSnapshot): boolean {
    const state = tabStates.get(internalId);
    if (!state) {
      console.error(`[applyStateSnapshot] 无法应用快照，未找到标签页 ${internalId} 的状态`);
      return false;
    }
    try {
      if (snapshot.workflowData) {
        state.workflowData = klona(snapshot.workflowData);

        if (state.workflowData) {
          if (!state.workflowData.interfaceInputs) state.workflowData.interfaceInputs = {};
          const inputSlots = state.workflowData.interfaceInputs;
          if (!Object.values(inputSlots).some((slot) => slot.allowDynamicType === true)) {
            const nextInputIndex = findNextSlotIndex(inputSlots, "input");
            const newInputKey = `input_${nextInputIndex}`;
            inputSlots[newInputKey] = {
              key: newInputKey,
              dataFlowType: DataFlowType.CONVERTIBLE_ANY,
              displayName: "*",
              customDescription: "动态输入接口...",
              allowDynamicType: true,
            };
          }
          if (!state.workflowData.interfaceOutputs) state.workflowData.interfaceOutputs = {};
          const outputSlots = state.workflowData.interfaceOutputs;
          if (!Object.values(outputSlots).some((slot) => slot.allowDynamicType === true)) {
            const nextOutputIndex = findNextSlotIndex(outputSlots, "output");
            const newOutputKey = `output_${nextOutputIndex}`;
            outputSlots[newOutputKey] = {
              key: newOutputKey,
              dataFlowType: DataFlowType.CONVERTIBLE_ANY,
              displayName: "*",
              customDescription: "动态输出接口...",
              allowDynamicType: true,
            };
          }
        }
      } else {
        console.warn(`[applyStateSnapshot] 标签页 ${internalId} 的快照不包含 workflowData。`);
      }

      state.isLoaded = true;
      return true;
    } catch (error) {
      console.error(`[applyStateSnapshot] 应用核心数据快照到标签页 ${internalId} 时出错:`, error);
      return false;
    }
  }

  // #endregion

  // #region --- 节点与工作流操作 ---

  /**
   * 在指定标签页中创建一个新的、空的工作流。
   * @param internalId - 标签页的内部 ID。
   * @returns 创建成功则返回状态快照，否则返回 null。
   */
  async function createNewWorkflow(internalId: string): Promise<WorkflowStateSnapshot | null> {
    const state = await ensureTabState(internalId, false);
    const tabLabel = tabStore.tabs.find((t) => t.internalId === internalId)?.label || internalId;

    if (
      state.isDirty &&
      !(await dialogService.showConfirm({
        title: "创建新工作流确认",
        message: `标签页 "${tabLabel}" 有未保存的更改。确定要创建新工作流吗？这将丢失未保存的更改。`,
        confirmText: "创建新工作流",
        dangerConfirm: true,
      }))
    ) {
      return null;
    }

    try {
      return await applyDefaultWorkflowToTab(internalId);
    } catch (error) {
      console.error(`[createNewWorkflow] 为标签页 ${internalId} 应用默认工作流失败:`, error);
      return null;
    }
  }

  /**
   * 直接将单个节点添加到指定标签页的状态中。
   * @param internalId - 目标标签页的内部 ID。
   * @param nodeToAdd - 要添加的 VueFlowNode 对象。
   */
  async function addNode(internalId: string, nodeToAdd: VueFlowNode) {
    const state = await ensureTabState(internalId, false);
    if (!state) return;

    if (state.elements.some((el) => el.id === nodeToAdd.id)) {
      console.warn(`[addNode] ID 为 ${nodeToAdd.id} 的节点已存在于标签页 ${internalId} 中。`);
      return;
    }

    const newNode = klona(nodeToAdd);
    if (newNode.type === "core:NodeGroup" && newNode.data && newNode.data.groupInterface === undefined) {
      newNode.data.groupInterface = { inputs: {}, outputs: {} };
    }

    state.elements.push(newNode);
    markAsDirty(internalId);
  }

  /**
   * 直接更新指定标签页中一个或多个节点的位置。
   * @param internalId - 目标标签页的内部 ID。
   * @param updates - 一个包含 { nodeId, position } 对象的数组。
   */
  async function updateNodePositions(
    internalId: string,
    updates: { nodeId: string; position: { x: number; y: number } }[]
  ) {
    const state = await ensureTabState(internalId, false);
    if (!state) return;

    let changed = false;
    updates.forEach((update) => {
      const node = state.elements.find(
        (el) => el.id === update.nodeId && !("source" in el)
      ) as VueFlowNode | undefined;
      if (node) {
        if (node.position.x !== update.position.x || node.position.y !== update.position.y) {
          node.position = { ...update.position };
          changed = true;
        }
      }
    });

    if (changed) {
      markAsDirty(internalId);
    }
  }

  /**
   * 直接更新指定标签页中单个节点的尺寸和样式。
   * @param internalId - 目标标签页的内部 ID。
   * @param nodeId - 节点 ID。
   * @param dimensions - 包含 { width?: number, height?: number } 的对象。
   */
  async function updateNodeDimensions(
    internalId: string,
    nodeId: string,
    dimensions: { width?: number; height?: number }
  ) {
    const state = await ensureTabState(internalId, false);
    if (!state) return;

    const node = state.elements.find((el) => el.id === nodeId && !("source" in el)) as
      | VueFlowNode
      | undefined;

    if (node) {
      let changed = false;
      if (dimensions.width !== undefined && node.width !== dimensions.width) {
        node.width = dimensions.width;
        node.style = { ...(node.style || {}), width: `${dimensions.width}px` };
        changed = true;
      }
      if (dimensions.height !== undefined && node.height !== dimensions.height) {
        node.height = dimensions.height;
        node.style = { ...(node.style || {}), height: `${dimensions.height}px` };
        changed = true;
      }
      if (changed) {
        markAsDirty(internalId);
      }
    }
  }

  /**
   * 更新指定标签页中单个节点的内部 data 对象中的特定属性。
   * @param internalId - 目标标签页的内部 ID。
   * @param nodeId - 节点 ID。
   * @param dataPayload - 一个包含要更新的 data 属性的局部对象。
   */
  async function updateNodeInternalData(
    internalId: string,
    nodeId: string,
    dataPayload: Partial<VueFlowNode["data"]>
  ) {
    const state = await ensureTabState(internalId, false);
    if (!state) return;

    const nodeIndex = state.elements.findIndex((el) => el.id === nodeId && !("source" in el));

    if (nodeIndex !== -1) {
      const currentNode = state.elements[nodeIndex] as VueFlowNode;
      const currentData = currentNode.data || {};
      const newData = {
        ...currentData,
        ...Object.fromEntries(
          Object.entries(dataPayload).map(([key, value]) => [
            key,
            typeof value === "object" && value !== null ? klona(value) : value,
          ])
        ),
      };

      if (JSON.stringify(currentData) !== JSON.stringify(newData)) {
        state.elements[nodeIndex] = { ...currentNode, data: newData };
        markAsDirty(internalId);
      }
    }
  }

  /**
   * 更新指定标签页工作流的名称。
   * @param internalId - 目标标签页的内部 ID。
   * @param newName - 新的工作流名称。
   */
  async function updateWorkflowName(internalId: string, newName: string) {
    const state = await ensureTabState(internalId, false);
    if (!state || !state.workflowData) return;

    if (state.workflowData.name !== newName) {
      state.workflowData.name = newName;
      markAsDirty(internalId);
      tabStore.updateTab(internalId, { label: newName });
    }
  }

  /**
   * 更新指定标签页工作流的描述。
   * @param internalId - 目标标签页的内部 ID。
   * @param newDescription - 新的工作流描述。
   */
  async function updateWorkflowDescription(internalId: string, newDescription: string) {
    const state = await ensureTabState(internalId, false);
    if (!state || !state.workflowData) return;

    if (state.workflowData.description !== newDescription) {
      state.workflowData.description = newDescription;
      markAsDirty(internalId);
    }
  }

  /**
   * 设置或清除当前活动工作流的预览目标。
   * @param internalId - 目标标签页的内部 ID。
   * @param target - 预览目标对象 { nodeId: string, slotKey: string } 或 null 来清除。
   */
  async function setPreviewTarget(
    internalId: string,
    target: { nodeId: string; slotKey: string } | null
  ) {
    const state = await ensureTabState(internalId, false);
    if (!state || !state.workflowData) return;

    const oldTargetJson = JSON.stringify(state.workflowData.previewTarget ?? null);
    const newTargetJson = JSON.stringify(target ?? null);

    if (oldTargetJson !== newTargetJson) {
      state.workflowData.previewTarget = target ? klona(target) : null;
      markAsDirty(internalId);
    }
  }

  /**
   * 清除当前活动工作流的预览目标。
   * @param internalId - 目标标签页的内部 ID。
   */
  async function clearPreviewTarget(internalId: string) {
    await setPreviewTarget(internalId, null);
  }

  // #endregion

  // --- 返回公共 API ---
  return {
    // Getters / 计算属性
    activeTabId,
    getActiveTabState,
    getWorkflowData,
    isWorkflowDirty,
    getElements,
    isTabLoaded,
    getAllTabStates,
    getCurrentSnapshot,
    getTabState,
    activePreviewTarget,
    isCurrentWorkflowNew,
    showGroupOutputOverview,

    // 状态操作
    ensureTabState,
    setElements,
    markAsDirty,
    isWorkflowNew,
    removeWorkflowData,
    clearWorkflowStatesForProject,
    applyStateSnapshot,
    setElementsAndInterface,
    createNewWorkflow,
    applyDefaultWorkflowToTab,
    updateNodePositions,
    addNode,
    updateWorkflowName,
    updateWorkflowDescription,
    updateNodeDimensions,
    setPreviewTarget,
    clearPreviewTarget,
    updateNodeInternalData,
    switchToGroupOutputPreviewMode,
    clearGroupOutputOverviewRequest,

    // 转换函数
    storageNodeToVueFlowNode: _storageNodeToVueFlowNode,
    storageEdgeToVueFlowEdge: _storageEdgeToVueFlowEdge,
  };
}

/**
 * 提供一个单例的工作流管理器实例。
 * 这个 Composable 负责管理所有打开的工作流标签页的状态，
 * 包括它们的节点、边、视口、脏状态以及与后端存储的交互。
 * @returns 工作流管理器的公共 API。
 */
export function useWorkflowManager() {
  if (!instance) {
    instance = createWorkflowManager();
  }
  return instance;
}
