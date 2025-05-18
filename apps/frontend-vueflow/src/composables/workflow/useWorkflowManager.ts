import { reactive, computed } from "vue";
import { klona } from "klona";
import { DataFlowType, type GroupSlotInfo, type WorkflowNode as StorageNode, type WorkflowEdge as StorageEdge } from "@comfytavern/types"; // Import StorageNode/Edge aliases
import type { Node as VueFlowNode, Edge as VueFlowEdge } from "@vue-flow/core";
import type {
  WorkflowData,
  TabWorkflowState,
  Viewport,
  WorkflowStateSnapshot,
} from "../../types/workflowTypes";
import { useTabStore } from "../../stores/tabStore";
import { useThemeStore } from "../../stores/theme";
import { storeToRefs } from "pinia";
import { useEdgeStyles } from "../canvas/useEdgeStyles";
// import { useWorkflowData } from "./useWorkflowData"; // 不再需要
import { useNodeStore } from "../../stores/nodeStore";
import defaultWorkflowTemplateUntyped from '@/data/DefaultWorkflow.json'; // <-- 导入默认模板
import type { DataFlowTypeName } from '@comfytavern/types'; // 确保导入 DataFlowTypeName

// --- 辅助函数 (来自 useWorkflowCoreLogic) ---
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

// --- 单例实现 ---
let instance: ReturnType<typeof createWorkflowManager> | null = null;

function createWorkflowManager() {
  // --- 依赖项 ---
  const tabStore = useTabStore();
  const themeStore = useThemeStore();
  const { isDark } = storeToRefs(themeStore);
  const { getEdgeStyleProps } = useEdgeStyles();
  // const workflowDataHandler = useWorkflowData(); // 不再需要
  const nodeStore = useNodeStore(); // 获取 NodeStore 实例

  // --- 内部状态标志 ---
  // --- 核心状态 ---
  const tabStates = reactive<Map<string, TabWorkflowState>>(new Map());

  // --- 计算属性状态 ---
  const activeTabId = computed(() => tabStore.activeTabId);
  const getAllTabStates = computed(() => tabStates);

  // --- 内部转换辅助函数 ---
  /**
   * 将存储格式的节点转换为 VueFlow 节点格式。
   * @param storageNode 存储格式的节点对象。
   * @returns VueFlow 节点对象。
   */
  function _storageNodeToVueFlowNode(storageNode: StorageNode): VueFlowNode {
      // 使用 nodeStore 获取节点定义
      const nodeDef = nodeStore.getNodeDefinitionByFullType(storageNode.type);
      const vueNode: VueFlowNode = {
          id: storageNode.id,
          type: storageNode.type, // 保留完整类型
          position: storageNode.position,
          label: storageNode.label || nodeDef?.displayName || storageNode.type,
          // 合并节点定义和存储数据
          data: nodeDef ? { ...nodeDef, ...(storageNode.data || {}) } : { ...(storageNode.data || {}) },
          width: storageNode.width, // 从存储中获取宽度
          height: storageNode.height, // 从存储中获取高度
          style: { // 根据存储的宽高设置样式
              ...(storageNode.width && { width: `${storageNode.width}px` }),
              ...(storageNode.height && { height: `${storageNode.height}px` }),
          },
          // 其他 VueFlowNode 可能需要的属性...
      };
      return vueNode;
  }

  /**
   * 将存储格式的边转换为 VueFlow 边格式 (不含样式)。
   * @param storageEdge 存储格式的边对象。
   * @returns VueFlow 边对象。
   */
  function _storageEdgeToVueFlowEdge(storageEdge: StorageEdge): VueFlowEdge {
      const vueEdge: VueFlowEdge = {
          id: storageEdge.id,
          source: storageEdge.source,
          target: storageEdge.target,
          sourceHandle: storageEdge.sourceHandle,
          targetHandle: storageEdge.targetHandle,
          data: storageEdge.data || {}, // 确保 data 存在
          // 不包含样式属性 (markerStart, markerEnd, style, animated)
      };
      return vueEdge;
  }


  // --- 核心逻辑函数 (改编自 useWorkflowCoreLogic) ---

  async function _applyWorkflowToTab(
    internalId: string,
    workflow: WorkflowData,
    elements: Array<VueFlowNode | VueFlowEdge>,
    viewport: Viewport
  ): Promise<WorkflowStateSnapshot | null> {
    // 添加返回类型
    // 确保状态存在（但此处不应用默认值，此函数应用 *加载的* 数据）
    const state = await ensureTabState(internalId, false); // 添加 await
    if (!state) {
      console.error(`[_applyWorkflowToTab] 无法找到标签页 ${internalId} 的状态。`);
      return null; // 返回 null
    }
    const tabInfo = tabStore.tabs.find((t) => t.internalId === internalId);

    // console.info(`[_applyWorkflowToTab] 开始为标签页 ${internalId} 应用工作流:`, workflow.id);

    // 1. 更新 workflowData (深拷贝以确保安全)
    state.workflowData = JSON.parse(JSON.stringify(workflow));

    // 确保动态插槽存在
    if (state.workflowData) {
      // 输入
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
        // 此处不标记为脏，因为我们正在应用一个加载的状态，它将成为基线
      }
      // 输出
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
        // 此处不标记为脏
      }
    }

    // 2. 更新 viewport
    state.viewport = JSON.parse(JSON.stringify(viewport));

    // 3. 计算并应用边的样式
    const nodes = elements.filter((el): el is VueFlowNode => !("source" in el));
    const originalEdges = elements.filter((el): el is VueFlowEdge => "source" in el);
    const styledEdges = originalEdges.map((edge) => {
      const sourceType = edge.data?.sourceType || "any";
      const targetType = edge.data?.targetType || "any";
      const styleProps = getEdgeStyleProps(sourceType, targetType, isDark.value);
      return { ...edge, ...styleProps };
    });
    // console.debug(
    //   `[_applyWorkflowToTab] 为 ${internalId} 计算了 ${styledEdges.length} 条边的样式。`
    // );

    // 4. 更新元素 (再次深拷贝以确保安全，尽管 styledEdges 是新的)
    state.elements = JSON.parse(JSON.stringify([...nodes, ...styledEdges]));

    // 5. 处理节点组接口信息
    if (tabInfo?.type === "groupEditor" && state.workflowData) {
      // state.groupInterfaceInfo = workflowDataHandler.extractGroupInterface(state.workflowData); // 暂时移除，如果需要再加回来
      // console.debug(
      //   `[_applyWorkflowToTab] 已为节点组编辑器 ${internalId} 提取并设置接口信息:`,
      //   state.groupInterfaceInfo
      // );
    } else {
      state.groupInterfaceInfo = null;
    }

    // 6. 标记为干净和已加载
    state.isDirty = false;
    state.isLoaded = true;

    // 7. 历史记录逻辑已移除
    // console.debug(`[_applyWorkflowToTab] 已为 ${internalId} 标记为已加载。`); // 保留日志点，但更新内容

    // 8. 更新 TabStore
    tabStore.updateTab(internalId, {
      label: workflow.name,
      associatedId: workflow.id,
      isDirty: false,
    });
    // console.debug(`[_applyWorkflowToTab] 已更新标签页 ${internalId} 的标签信息。`);

    // console.info(
    //   `[_applyWorkflowToTab] 成功为标签页 ${internalId} 应用工作流状态 ${workflow.id}。`
    // );

    // 返回应用的快照
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

  async function applyDefaultWorkflowToTab(
    internalId: string
  ): Promise<WorkflowStateSnapshot | null> {
    const tabInfo = tabStore.tabs.find((t) => t.internalId === internalId);
    const associatedId = tabInfo?.associatedId || `temp-${internalId}`;
    const labelToUse = tabInfo?.label || defaultWorkflowTemplateUntyped.name || "*新工作流*"; // 使用模板名称或默认值

    console.debug(
      `[useWorkflowManager/applyDefaultWorkflowToTab] 正在将默认模板应用于 ${internalId} (ID: ${associatedId})`
    );

    try {
      // 确保节点定义已加载，以便正确填充节点数据
      await nodeStore.ensureDefinitionsLoaded();

      // 深拷贝模板以避免修改原始导入对象
      const defaultWorkflowTemplate = defaultWorkflowTemplateUntyped as unknown as WorkflowData; // Add type assertion
      const templateData = klona(defaultWorkflowTemplate);

      // 显式处理 interfaceInputs 和 interfaceOutputs 的类型
      const typedInterfaceInputs: Record<string, GroupSlotInfo> = {};
      if (templateData.interfaceInputs) {
        for (const key in templateData.interfaceInputs) {
          const slot = templateData.interfaceInputs[key];
          if (slot) { // Add null check for slot
            typedInterfaceInputs[key] = {
              ...slot,
              key: slot.key, // Explicitly assign key
              dataFlowType: slot.dataFlowType as DataFlowTypeName // 确保类型正确
            };
          }
        }
      }

      const typedInterfaceOutputs: Record<string, GroupSlotInfo> = {};
      if (templateData.interfaceOutputs) {
        for (const key in templateData.interfaceOutputs) {
          const slot = templateData.interfaceOutputs[key];
          if (slot) { // Add null check for slot
            typedInterfaceOutputs[key] = {
              ...slot,
              key: slot.key, // Explicitly assign key
              dataFlowType: slot.dataFlowType as DataFlowTypeName // 确保类型正确
            };
          }
        }
      }

      // 准备 VueFlow elements
      const elements: Array<VueFlowNode | VueFlowEdge> = [];

      // Remove unused interface DefaultWorkflowNodeTpl

      // 处理节点
      for (const nodeTpl of templateData.nodes as StorageNode[]) { // 使用 StorageNode 类型
          const vueNode = _storageNodeToVueFlowNode(nodeTpl); // 使用辅助函数
          elements.push(vueNode);
      }

      // 处理边
      if (Array.isArray(templateData.edges) && templateData.edges.length > 0) {
          for (const edgeTpl of templateData.edges as StorageEdge[]) { // 使用 StorageEdge 类型
              if (typeof edgeTpl === 'object' && edgeTpl !== null && edgeTpl.id && edgeTpl.source && edgeTpl.target) {
                  const vueEdge = _storageEdgeToVueFlowEdge(edgeTpl); // 使用辅助函数
                  elements.push(vueEdge);
              } else {
                  console.warn(`[applyDefaultWorkflowToTab] 跳过无效的边模板:`, edgeTpl);
              }
          }
      }

      // 准备最终的 WorkflowData (使用模板数据，但更新 ID 和 name)
      // 确保 nodes 和 edges 引用原始模板数据
      const finalWorkflowData: WorkflowData = {
        ...templateData, // 包含 viewport, interfaceInputs, interfaceOutputs 等
        id: associatedId,
        name: labelToUse,
        nodes: templateData.nodes, // 引用原始模板节点
        edges: templateData.edges, // 引用原始模板边
        interfaceInputs: typedInterfaceInputs, // 使用类型处理过的版本
        interfaceOutputs: typedInterfaceOutputs, // 使用类型处理过的版本
      };

      // 使用 _applyWorkflowToTab 应用状态，它会处理边的样式
      const snapshot = await _applyWorkflowToTab(
        internalId,
        finalWorkflowData, // 传递包含原始 nodes/edges 的 workflow 数据
        elements, // 传递转换后的 VueFlow elements (包含基础边)
        finalWorkflowData.viewport // 使用模板的 viewport
      );

      if (snapshot) {
        console.info(
          `[useWorkflowManager/applyDefaultWorkflowToTab] 已成功将默认模板状态应用于 ${internalId}。`
        );
      } else {
        console.error(
          `[useWorkflowManager/applyDefaultWorkflowToTab] _applyWorkflowToTab 未能返回快照 for ${internalId}。`
        );
      }
      return snapshot;

    } catch (error) {
      console.error(`[useWorkflowManager/applyDefaultWorkflowToTab] 应用默认模板失败 for ${internalId}:`, error);
      // 可以考虑添加一个回退机制，比如应用一个最小化的硬编码模板
      // 或者直接返回 null 并显示错误
      alert(`创建新工作流时应用默认模板失败: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  // --- 新增：直接更新节点位置 ---
  /**
   * 直接更新指定标签页中一个或多个节点的位置。
   * 这个方法会标记标签页为脏状态，但不会自动记录历史。
   * @param internalId 目标标签页的内部 ID。
   * @param updates 一个包含 { nodeId, position } 对象的数组。
   */
  async function updateNodePositions(
    internalId: string,
    updates: { nodeId: string; position: { x: number; y: number } }[]
  ) {
    const state = await ensureTabState(internalId, false); // 确保状态存在
    if (!state) {
      console.warn(`[updateNodePositions] 无法更新位置，未找到标签页 ${internalId} 的状态`);
      return;
    }

    let changed = false;
    updates.forEach((update) => {
      const nodeIndex = state.elements.findIndex(
        (el) => el.id === update.nodeId && !("source" in el)
      ); // 确保是节点
      if (nodeIndex !== -1) {
        const node = state.elements[nodeIndex] as VueFlowNode; // 类型断言
        // 比较位置是否真的改变，避免不必要的更新和标记
        if (node.position.x !== update.position.x || node.position.y !== update.position.y) {
          // console.debug(`[updateNodePositions] 正在更新标签页 ${internalId} 中节点 ${update.nodeId} 的位置，从 ${JSON.stringify(node.position)} 到 ${JSON.stringify(update.position)}`);
          node.position = { ...update.position }; // 更新位置 (使用扩展运算符创建新对象)
          changed = true;
        }
      } else {
        console.warn(
          `[updateNodePositions] 未在标签页 ${internalId} 中找到要更新位置的节点: ${update.nodeId}`
        );
      }
    });

    if (changed) {
      markAsDirty(internalId); // 如果有任何位置改变，标记为脏
    }
  }

  // --- 公共状态管理函数 (改编自 useWorkflowState) ---

  // --- 新增：直接添加节点 ---
  /**
   * 直接将单个节点添加到指定标签页的状态中。
   * 这个方法会标记标签页为脏状态，但不会自动记录历史。
   * @param internalId 目标标签页的内部 ID。
   * @param nodeToAdd 要添加的 VueFlowNode 对象。
   */
  async function addNode(internalId: string, nodeToAdd: VueFlowNode) {
    const state = await ensureTabState(internalId, false); // 确保状态存在
    if (!state) {
      console.warn(`[addNode] 无法添加节点，未找到标签页 ${internalId} 的状态`);
      return;
    }

    // 检查节点是否已存在
    if (state.elements.some((el) => el.id === nodeToAdd.id)) {
      console.warn(
        `[addNode] ID 为 ${nodeToAdd.id} 的节点已存在于标签页 ${internalId} 中。跳过添加。`
      );
      return;
    }

    // 深拷贝节点
    const newNode = klona(nodeToAdd);

    // 如果是 NodeGroup 并且没有 groupInterface，则初始化一个空的
    if (newNode.type === 'core:NodeGroup' && newNode.data && newNode.data.groupInterface === undefined) {
      newNode.data.groupInterface = { inputs: {}, outputs: {} };
      console.debug(`[addNode] Initialized empty groupInterface for new NodeGroup ${newNode.id}`);
    }

    // 添加到 elements 数组
    state.elements.push(newNode);
    // console.debug(`[addNode] 已将节点 ${newNode.id} 添加到标签页 ${internalId} 的状态中`);

    // 标记为脏
    markAsDirty(internalId);
  }

  function getActiveTabState(): TabWorkflowState | undefined {
    const id = activeTabId.value;
    return id ? tabStates.get(id) : undefined;
  }

  /**
   * 确保给定标签页的状态存在。
   * 如果状态是新创建的并且代表一个新的工作流（没有 associatedId 或 temp ID），
   * 它将应用默认的工作流状态。
   * @param internalId 标签页的内部 ID。
   * @param applyDefaultIfNeeded 如果为 true (默认)，则在状态是新的且标签页用于新工作流时应用默认工作流。
   * @returns 确保存在的 TabWorkflowState。
   */
  async function ensureTabState(
    internalId: string,
    applyDefaultIfNeeded = true
  ): Promise<TabWorkflowState> {
    // 添加 async 和 Promise 返回类型
    const stateExists = tabStates.has(internalId);
    let state = stateExists ? tabStates.get(internalId)! : null;

    if (!stateExists) {
      // console.debug(`[useWorkflowManager/ensureTabState] 初始化标签页 ${internalId} 的状态`);
      const tabInfo = tabStore.tabs.find((t) => t.internalId === internalId);
      const associatedId = tabInfo?.associatedId;
      const isNewWorkflow = !associatedId || associatedId.startsWith("temp-");

      // 首先创建一个最小的初始状态
      const initialWorkflowData: WorkflowData = {
        id: associatedId || `temp-${internalId}`,
        name: tabInfo?.label || "*新工作流*",
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        interfaceInputs: {}, // 将由 applyDefault 或 applyWorkflow 填充
        interfaceOutputs: {}, // 将由 applyDefault 或 applyWorkflow 填充
      };
      const initialState: TabWorkflowState = {
        workflowData: initialWorkflowData, // 最小化开始
        isDirty: false,
        vueFlowInstance: null, // 由 useWorkflowViewManagement 外部管理
        elements: [],
        viewport: initialWorkflowData.viewport,
        groupInterfaceInfo: null,
        isLoaded: false, // 初始标记为未加载
      };
      tabStates.set(internalId, initialState);
      state = initialState;
      // 移除了 ensureHistoryState 调用

      // *仅*当它是新的工作流标签页且被请求时才应用默认工作流
      if (isNewWorkflow && applyDefaultIfNeeded) {
        // console.info(
        //   `[useWorkflowManager/ensureTabState] 新工作流标签页 ${internalId}。正在应用默认状态。`
        // );
        await applyDefaultWorkflowToTab(internalId); // 添加 await
      } else {
        // console.info(
        //   `[useWorkflowManager/ensureTabState] 已为 ${internalId} 创建初始状态。等待加载数据或显式应用默认值。`
        // );
        // 为正在加载的现有工作流记录空历史
        // 移除了 recordHistory 调用
      }
    }
    return state!;
  }

  function getWorkflowData(internalId: string): WorkflowData | null {
    // 返回深拷贝？对于只读访问可能不是必需的。暂时返回直接引用。
    return tabStates.get(internalId)?.workflowData ?? null;
  }

  function isWorkflowDirty(internalId: string): boolean {
    return tabStates.get(internalId)?.isDirty ?? false;
  }

  function getElements(internalId: string): Array<VueFlowNode | VueFlowEdge> {
    // 返回深拷贝以防止在 setter 之外意外修改
    const state = tabStates.get(internalId);
    return state ? JSON.parse(JSON.stringify(state.elements)) : [];
  }

  async function setElements(internalId: string, elements: Array<VueFlowNode | VueFlowEdge>) {
    // 添加 async
    // 移除了 isApplyingInitialDefault 和 isApplyingSnapshot 检查

    const state = await ensureTabState(internalId, false); // 添加 await
    if (!state) return;

    // 深拷贝元素
    const newElements = JSON.parse(JSON.stringify(elements));

    // 在标记为脏和记录历史之前检查元素是否实际更改 (原始逻辑)
    if (JSON.stringify(state.elements) !== JSON.stringify(newElements)) {
      // console.debug(`[useWorkflowManager/setElements] 标签页 ${internalId} 的元素已更改。`);
      state.elements = newElements;
      markAsDirty(internalId); // 标记为脏
      // 移除了 recordHistory 调用
    } else {
      // console.debug(`[useWorkflowManager/setElements] 标签页 ${internalId} 的元素未更改。跳过标记为脏。`);
    }
  }

  function markAsDirty(internalId: string) {
    const state = tabStates.get(internalId);
    if (state && !state.isDirty) {
      state.isDirty = true;
      tabStore.updateTab(internalId, { isDirty: true }); // 与 tabStore 同步
      // console.debug(`[useWorkflowManager/markAsDirty] 标签页 ${internalId} 已标记为脏。`);
    } else if (!state) {
      console.warn(
        `[useWorkflowManager/markAsDirty] 尝试将不存在的标签页 ${internalId} 标记为脏。`
      );
    }
  }

  function removeWorkflowData(internalId: string) {
    if (tabStates.has(internalId)) {
      tabStates.delete(internalId);
      // 移除了 removeHistory 调用
      // console.debug(
      //   `[useWorkflowManager/removeWorkflowData] 已移除标签页 ${internalId} 的状态`
      // );
    }
  }

  function clearWorkflowStatesForProject(projectIdToClear: string) {
    if (!projectIdToClear) return;

    // console.info(
    //   `[useWorkflowManager/clearWorkflowStatesForProject] 正在清除项目 ${projectIdToClear} 的工作流状态...`
    // );
    let clearedCount = 0;
    const tabsToRemove: string[] = [];

    for (const tab of tabStore.tabs) {
      if (tab.projectId === projectIdToClear) {
        tabsToRemove.push(tab.internalId);
      }
    }

    for (const internalId of tabsToRemove) {
      if (tabStates.has(internalId)) {
        tabStates.delete(internalId);
        // 移除了 removeHistory 调用
        clearedCount++;
        // console.debug(
        //   `[useWorkflowManager/clearWorkflowStatesForProject] 已移除标签页 ${internalId} 的状态 (项目: ${projectIdToClear})`
        // );
      }
    }
    // console.info(
    //   `[useWorkflowManager/clearWorkflowStatesForProject] 已清除项目 ${projectIdToClear} 的 ${clearedCount} 个工作流状态。`
    // );
  }

  function isTabLoaded(internalId: string): boolean {
    return tabStates.get(internalId)?.isLoaded ?? false;
  }

  /**
   * 原子性地更新元素和工作流接口定义，并记录历史。
   * 用于处理 CONVERTIBLE_ANY 连接等需要同时更新两者的情况。
   */
  async function setElementsAndInterface( // 添加 async
    internalId: string,
    elements: Array<VueFlowNode | VueFlowEdge>,
    inputs: Record<string, GroupSlotInfo>,
    outputs: Record<string, GroupSlotInfo>
  ) {
    const state = await ensureTabState(internalId, false); // 添加 await
    if (!state || !state.workflowData) {
      console.error(
        `[setElementsAndInterface] 无法更新，未找到标签页 ${internalId} 的状态或 workflowData`
      );
      return;
    }

    // 深拷贝传入的数据以确保隔离
    const newElements = JSON.parse(JSON.stringify(elements));
    const newInputs = JSON.parse(JSON.stringify(inputs));
    const newOutputs = JSON.parse(JSON.stringify(outputs));

    // 检查状态是否真的发生了变化
    const elementsChanged = JSON.stringify(state.elements) !== JSON.stringify(newElements);
    const inputsChanged =
      JSON.stringify(state.workflowData.interfaceInputs) !== JSON.stringify(newInputs);
    const outputsChanged =
      JSON.stringify(state.workflowData.interfaceOutputs) !== JSON.stringify(newOutputs);

    if (elementsChanged || inputsChanged || outputsChanged) {
      // console.debug(
      //   `[setElementsAndInterface] 标签页 ${internalId} 的状态已更改。更新元素: ${elementsChanged}, 输入: ${inputsChanged}, 输出: ${outputsChanged}`
      // );

      // 应用更新
      state.elements = newElements;
      state.workflowData.interfaceInputs = newInputs;
      state.workflowData.interfaceOutputs = newOutputs;

      // 标记为脏并记录历史
      markAsDirty(internalId);
      // 移除了 recordHistory 调用
    } else {
      // console.debug(`[setElementsAndInterface] 标签页 ${internalId} 的状态未更改。跳过更新。`);
    }
  }

  // --- 新增：状态快照获取与应用 ---

  /**
   * 获取指定标签页当前状态的深拷贝快照。
   * @param internalId 目标标签页的内部 ID。
   * @returns 包含 elements, viewport, workflowData 的快照对象，如果状态不存在则返回 undefined。
   */
  function getCurrentSnapshot(internalId: string): WorkflowStateSnapshot | undefined {
    const state = tabStates.get(internalId);
    if (!state) {
      console.warn(`[getCurrentSnapshot] 无法获取快照，未找到标签页 ${internalId} 的状态`);
      return undefined;
    }
    try {
      // 返回状态的深拷贝
      return klona({
        elements: state.elements,
        viewport: state.viewport,
        workflowData: state.workflowData,
        // 可以根据需要添加其他需要记录的状态属性
      });
    } catch (error) {
      console.error(`[getCurrentSnapshot] 获取标签页 ${internalId} 快照时出错:`, error);
      return undefined;
    }
  }

  /**
   * 应用一个工作流状态快照到指定的标签页。
   * 这个操作不会被记录到历史记录中，也不会将标签页标记为“脏”。
   * 主要用于外部历史记录管理系统（如 useWorkflowHistory）来恢复状态。
   * @param internalId 目标标签页的内部 ID。
   * @param snapshot 要应用的状态快照。
   */
  function applyStateSnapshot(internalId: string, snapshot: WorkflowStateSnapshot): boolean {
    const state = tabStates.get(internalId);
    if (!state) {
      console.error(`[applyStateSnapshot] 无法应用快照，未找到标签页 ${internalId} 的状态`);
      return false;
    }
    // console.debug(`[applyStateSnapshot] 正在将外部快照应用于标签页 ${internalId}`);
    try {
      // 根据最新计划，此函数只应用非画布元素/视图的核心数据状态
      // 画布元素和视图将由 workflowStore 的 undo/redo 使用命令式 API 更新

      // 1. 应用 workflowData (如果存在)
      if (snapshot.workflowData) {
        // 深拷贝以确保安全
        state.workflowData = klona(snapshot.workflowData);
        // console.debug(`[applyStateSnapshot] 已应用标签页 ${internalId} 的 workflowData`);

        // 2. 确保应用快照后，动态插槽仍然存在 (逻辑从 _applyWorkflowToTab 借鉴)
        // 这部分逻辑依赖于 workflowData，所以放在这里是合适的
        if (state.workflowData) {
          // 输入
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
          // 输出
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
          // console.debug(`[applyStateSnapshot] 已确保标签页 ${internalId} 的动态插槽`);
        }
      } else {
        console.warn(`[applyStateSnapshot] 标签页 ${internalId} 的快照不包含 workflowData。`);
        // 根据需要决定是否要清空 state.workflowData
        // state.workflowData = null;
      }

      // 3. 应用其他非画布/视图状态 (如果未来添加到 WorkflowStateSnapshot)
      // 例如: state.someOtherMetadata = klona(snapshot.someOtherMetadata);

      // 4. 标记为已加载，因为应用快照意味着状态是完整的
      state.isLoaded = true;

      // 5. 不更新 state.elements 或 state.viewport
      // 6. 不标记为脏或记录历史

      // console.debug(`[applyStateSnapshot] 核心数据快照已成功应用于标签页 ${internalId}。元素/视口更新推迟给调用者。`);
      return true;
    } catch (error) {
      console.error(`[applyStateSnapshot] 应用核心数据快照到标签页 ${internalId} 时出错:`, error);
      return false;
    }
  }

  // --- 其他公共函数 ---

  /**
   * 在指定标签页中创建一个新的、空的（默认）工作流。
   * 处理脏检查并重置标签页状态。
   * @param internalId 标签页的内部 ID。
   */
  async function createNewWorkflow(internalId: string): Promise<WorkflowStateSnapshot | null> {
    // 添加返回类型
    // 注意：ensureTabState 和 applyDefaultWorkflowToTab 现在直接调用
    // 因为它们在此 composable 的作用域内定义。
    // tabStore 也可直接使用。
    const state = await ensureTabState(internalId); // 添加 await
    const tabLabel = tabStore.tabs.find((t) => t.internalId === internalId)?.label || internalId;

    if (state.isDirty && !confirm(`标签页 "${tabLabel}" 有未保存的更改。确定要创建新工作流吗？`)) {
      return null; // 返回 null
    }

    console.log(`[useWorkflowManager/createNewWorkflow] 开始为标签页 ${internalId} 创建新工作流。`);

    try {
      // 委托应用默认工作流的核心逻辑
      const snapshot = await applyDefaultWorkflowToTab(internalId); // 获取快照
      if (snapshot) {
        console.log(
          `[useWorkflowManager/createNewWorkflow] 已成功为标签页 ${internalId} 应用默认工作流。`
        );
      } else {
        console.error(
          `[useWorkflowManager/createNewWorkflow] applyDefaultWorkflowToTab未能返回快照 for ${internalId}。`
        );
      }
      return snapshot; // 返回快照或 null
      // 成功创建后更新标签页元数据（保留现有标签）
      // _applyWorkflowToTab（由 applyDefaultWorkflowToTab 调用）已处理标签页更新
      // tabStore.updateTab(internalId, { isDirty: false, associatedId: null }); // 此处不再需要
    } catch (error) {
      console.error(
        `[useWorkflowManager/createNewWorkflow] 为标签页 ${internalId} 应用默认工作流失败:`,
        error
      );
      // TODO: 添加用户反馈（例如，toast 通知）
      return null; // 在 catch 块中也返回 null
    }
  }

  // --- 新增：更新工作流元数据 ---
  /**
   * 更新指定标签页工作流的名称。
   * @param internalId 目标标签页的内部 ID。
   * @param newName 新的工作流名称。
   */
  async function updateWorkflowName(internalId: string, newName: string) {
    const state = await ensureTabState(internalId, false); // 确保状态存在
    if (!state || !state.workflowData) {
      console.warn(`[updateWorkflowName] 无法更新名称，未找到标签页 ${internalId} 的状态或 workflowData`);
      return;
    }
    if (state.workflowData.name !== newName) {
      // console.debug(`[updateWorkflowName] 正在更新标签页 ${internalId} 的工作流名称从 "${state.workflowData.name}" 到 "${newName}"`);
      state.workflowData.name = newName;
      markAsDirty(internalId);
      tabStore.updateTab(internalId, { label: newName }); // 更新标签页标签
      // 可以在这里添加历史记录点，如果需要的话
    }
  }

  /**
   * 更新指定标签页工作流的描述。
   * @param internalId 目标标签页的内部 ID。
   * @param newDescription 新的工作流描述。
   */
  async function updateWorkflowDescription(internalId: string, newDescription: string) {
    const state = await ensureTabState(internalId, false); // 确保状态存在
    if (!state || !state.workflowData) {
      console.warn(`[updateWorkflowDescription] 无法更新描述，未找到标签页 ${internalId} 的状态或 workflowData`);
      return;
    }
    // 假设 WorkflowData 类型有 description 字段
    if (state.workflowData.description !== newDescription) {
      // console.debug(`[updateWorkflowDescription] 正在更新标签页 ${internalId} 的工作流描述`);
      state.workflowData.description = newDescription; // 类型已更新，移除断言
      markAsDirty(internalId);
      // 可以在这里添加历史记录点，如果需要的话
    }
  }

  // --- 新增：直接更新节点尺寸 ---
  /**
   * 直接更新指定标签页中单个节点的尺寸和样式。
   * 这个方法会标记标签页为脏状态，但不会自动记录历史。
   * @param internalId 目标标签页的内部 ID。
   * @param nodeId 节点 ID。
   * @param dimensions 包含 { width?: number, height?: number } 的对象。
   */
  async function updateNodeDimensions(
    internalId: string,
    nodeId: string,
    dimensions: { width?: number; height?: number }
  ) {
    const state = await ensureTabState(internalId, false); // 确保状态存在
    if (!state) {
      console.warn(`[updateNodeDimensions] 无法更新尺寸，未找到标签页 ${internalId} 的状态`);
      return;
    }

    const nodeIndex = state.elements.findIndex(
      (el) => el.id === nodeId && !("source" in el)
    ); // 确保是节点

    if (nodeIndex !== -1) {
      const node = state.elements[nodeIndex] as VueFlowNode; // 类型断言
      let changed = false;

      // 更新宽度
      if (dimensions.width !== undefined && node.width !== dimensions.width) {
        node.width = dimensions.width;
        node.style = { ...(node.style || {}), width: `${dimensions.width}px` };
        changed = true;
      }

      // 更新高度
      if (dimensions.height !== undefined && node.height !== dimensions.height) {
        node.height = dimensions.height;
        node.style = { ...(node.style || {}), height: `${dimensions.height}px` };
        changed = true;
      }

      if (changed) {
        // console.debug(`[updateNodeDimensions] 正在更新标签页 ${internalId} 中节点 ${nodeId} 的尺寸/样式`);
        markAsDirty(internalId); // 如果有任何尺寸改变，标记为脏
      }
    } else {
      console.warn(
        `[updateNodeDimensions] 未在标签页 ${internalId} 中找到要更新尺寸的节点: ${nodeId}`
      );
    }
  }
  // --- 结束新增 ---

  // --- 返回公共 API ---
  return {
    // Getters / 计算属性
    activeTabId,
    getActiveTabState,
    getWorkflowData,
    isWorkflowDirty,
    getElements, // 返回深拷贝
    isTabLoaded,
    getAllTabStates, // 指向响应式 Map 的计算属性引用
    getCurrentSnapshot, // <-- 添加新方法
    // 移除了 getHistoryState 和 historyActionCounter

    // 状态操作
    ensureTabState,
    setElements, // 元素更改的主要入口点
    markAsDirty,
    removeWorkflowData,
    clearWorkflowStatesForProject,
    applyStateSnapshot, // <-- 已存在，确保实现正确
    setElementsAndInterface,
    createNewWorkflow,
    applyDefaultWorkflowToTab, // <-- 导出此函数
    updateNodePositions, // <-- 导出新方法
    addNode,
    updateWorkflowName,
    updateWorkflowDescription,
    updateNodeDimensions, // <-- 导出新方法

    // 移除了 undo 和 redo

    // 核心逻辑 (workflowStore 可能需要用于协调)

    // 导出转换函数
    storageNodeToVueFlowNode: _storageNodeToVueFlowNode,
    storageEdgeToVueFlowEdge: _storageEdgeToVueFlowEdge,
  };
}

export function useWorkflowManager() {
  if (!instance) {
    instance = createWorkflowManager();
  }
  return instance;
}
