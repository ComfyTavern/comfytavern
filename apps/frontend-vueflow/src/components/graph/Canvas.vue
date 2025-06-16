<template>
  <div ref="canvasContainerRef" class="canvas-container h-full w-full" tabindex="-1" @dragover.prevent="onDragOver"
    @dragleave="onDragLeave" @drop.prevent="onDrop" @dragenter.prevent>
    <VueFlow v-bind="$attrs" ref="vueFlowRef" v-model="internalElements" :node-types="props.nodeTypes"
      :edge-types="edgeTypes" :default-viewport="{ x: 0, y: 0, zoom: 1 }" :min-zoom="0.2" :max-zoom="4" fit-view-on-init
      :connect-on-drop="true" :edges-updatable="true" :edge-updater-radius="15" :snap-to-grid="true"
      :snapping-tolerance="10" :selectionMode="SelectionMode.Partial" :connection-line-component="UnplugConnectionLine"
      @edges-change="handleEdgesChange" :panOnDrag="true" :zoomOnScroll="true">
      <!-- 背景 -->
      <Background pattern-color="var(--ct-bg-pattern-color, #aaa)" :gap="16" />

      <!-- 控制器 -->
      <Controls />

      <!-- 小地图 -->
      <MiniMap />

      <!-- 默认节点和边的样式 -->
      <!-- 自定义节点组件 -->
      <template #node-default="nodeProps">
        <BaseNode v-bind="nodeProps" />
      </template>
    </VueFlow>
    <!-- 画布右键菜单 -->
    <ContextMenu :visible="showPaneContextMenu" :position="contextMenuPosition" :has-selected-nodes="hasSelectedNodes"
      :has-copied-nodes="hasCopiedNodes" @request-add-node="forwardRequestAddNode" @add-group="addGroup"
      @copy="copySelected" @paste="paste" @delete="deleteSelected" @select-all="onSelectAll" @reset-view="resetView"
      @close="closePaneContextMenu" @open-node-search-panel="() => emit('open-node-search-panel')" />

    <!-- 节点右键菜单 (根据选中数量显示不同内容) -->
    <NodeContextMenu :visible="showNodeContextMenu" :position="contextMenuPosition" :nodeId="selectedNodeId"
      :nodeType="selectedNodeType" :selected-node-count="currentNodeSelectionCount" @edit="editNode"
      @duplicate="duplicateNode" @connect="connectNode" @disconnect="disconnectNode" @delete="deleteNode"
      @copy-selection="handleCopySelection" @create-group-from-selection="handleCreateGroupFromSelection"
      @create-frame-for-selection="handleCreateFrameForSelection" @delete-selection="handleDeleteSelection"
      @close="closeNodeContextMenu" />

    <!-- 插槽右键菜单 -->
    <SlotContextMenu :visible="showSlotContextMenu" :position="contextMenuPosition"
      :node-id="slotContextMenuContext?.nodeId || ''" :handle-id="slotContextMenuContext?.handleId || ''"
      :handle-type="slotContextMenuContext?.handleType || 'target'" @disconnect="handleSlotDisconnect"
      @close="closeSlotContextMenu" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type PropType } from "vue"; // 导入 PropType
import { watch, nextTick } from "vue";
import {
  VueFlow,
  useVueFlow,
  SelectionMode,
  type NodeTypesObject,
  type EdgeTypesObject,
} from "@vue-flow/core"; // 导入 NodeTypesObject 和 EdgeTypesObject
import UnplugConnectionLine from "./edges/UnplugConnectionLine.vue";
import { useNodeStore } from "../../stores/nodeStore";
import { useWorkflowStore } from "../../stores/workflowStore"; // 导入 WorkflowStore
import { useTabStore } from "../../stores/tabStore"; // 导入 TabStore
import useDragAndDrop from "../../composables/canvas/useDnd";
import { useCanvasKeyboardShortcuts } from "../../composables/canvas/useCanvasKeyboardShortcuts"; // <-- Import the composable
import { useContextMenuPositioning, getEventClientPosition } from "../../composables/canvas/useContextMenuPositioning"; // <-- Import the new composable and getEventClientPosition
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import { MiniMap } from "@vue-flow/minimap";
import type { Node, Edge, Connection, XYPosition } from "@vue-flow/core";
import ContextMenu from "./menus/ContextMenu.vue";
import NodeContextMenu from "./menus/NodeContextMenu.vue";
import SlotContextMenu from "./menus/SlotContextMenu.vue"; // 导入插槽右键菜单
import BaseNode from "./nodes/BaseNode.vue";
import SortedMultiTargetEdge from "./edges/SortedMultiTargetEdge.vue"; // 导入自定义边组件
import { useThemeStore } from "../../stores/theme";
import { storeToRefs } from "pinia";
import { useCanvasConnections } from "../../composables/canvas/useCanvasConnections";
import { useNodeGroupConnectionValidation } from "../../composables/node/useNodeGroupConnectionValidation"; // 导入新的 Composable
import { useWorkflowGrouping } from "@/composables/group/useWorkflowGrouping";
import { createHistoryEntry } from "@comfytavern/utils"; // <-- 导入 createHistoryEntry
import { useDialogService } from "@/services/DialogService";

// 定义props和emits
const props = defineProps({
  modelValue: { type: Array as PropType<Array<Node | Edge>>, required: true },
  nodeTypes: { type: Object as PropType<NodeTypesObject>, required: true },
});
const edgeTypes: EdgeTypesObject = {
  "sorted-multi-target": SortedMultiTargetEdge, // 使用导入的自定义边组件
};

const emit = defineEmits<{
  "update:modelValue": [value: Array<Node | Edge>];
  "node-click": [node: Node];
  "pane-ready": [instance: any]; // Revert to emitting the hook instance, use 'any' for now
  connect: [connection: Connection];
  "request-add-node-to-workflow": [payload: { fullNodeType: string; flowPosition: XYPosition }]; // +++ 新的 emit
  "open-node-search-panel": []; // 新增：向上层传递打开节点搜索面板的事件
}>();

// 使用计算属性处理双向绑定
const internalElements = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

// 监听画布元素变化并打印日志
watch(
  internalElements,
  (newElements, oldElements) => {
    const oldNodes =
      (oldElements?.filter((el) => {
        if (typeof el !== "object" || el === null) {
          // console.warn(`[Canvas] watch internalElements: Found non-object element in oldElements (for oldNodes):`, el); // 更详细的日志可选
          return false;
        }
        return "position" in el;
      }) as Node[]) || []; // 类型断言为 Node[]
    const newNodes =
      (newElements?.filter((el) => {
        if (typeof el !== "object" || el === null) {
          console.warn(
            `[Canvas] watch internalElements: Found non-object element in newElements (for newNodes):`,
            el
          );
          return false;
        }
        return "position" in el;
      }) as Node[]) || []; // 类型断言为 Node[]
    const oldEdges =
      oldElements?.filter((el) => {
        if (typeof el !== "object" || el === null) {
          // console.warn(`[Canvas] watch internalElements: Found non-object element in oldElements (for oldEdges):`, el); // 更详细的日志可选
          return false;
        }
        return "source" in el;
      }) || [];
    const newEdges =
      newElements?.filter((el) => {
        if (typeof el !== "object" || el === null) {
          console.warn(
            `[Canvas] watch internalElements: Found non-object element in newElements (for newEdges):`,
            el
          );
          return false;
        }
        return "source" in el;
      }) || [];

    const totalNodes = newNodes.length; // 获取当前节点总数

    if (totalNodes !== oldNodes.length || newEdges.length !== oldEdges.length) {
      // 节点或边数量发生变化
      // console.debug(`[Canvas] Elements updated. Total Nodes: ${totalNodes}, Edges: ${oldEdges.length} -> ${newEdges.length}`);
    } else {
      // 如果数量没变，检查是否有节点位置变化
      const changedNodeInData = newNodes.find((newNode, index) => {
        const oldNode = oldNodes[index];
        // 确保 oldNode 存在且位置确实改变
        return (
          oldNode &&
          (newNode.position.x !== oldNode.position.x || newNode.position.y !== oldNode.position.y)
        );
      });
      if (changedNodeInData) {
        // 尝试从 Vue Flow 实例获取节点，它可能包含渲染后的 dimensions
        // 需要使用 .value 访问 ComputedRef 中的函数
        // const nodeFromInstance = vueFlowInstance.getNode.value(changedNodeInData.id);
        // 安全地访问 dimensions，提供默认值
        // const dimensions = {
        //   width: nodeFromInstance?.dimensions?.width ?? 'N/A',
        //   height: nodeFromInstance?.dimensions?.height ?? 'N/A'
        // };
        // console.debug(`[Canvas] Node position updated. Total Nodes: ${totalNodes}. Node ID: ${changedNodeInData.id}, New Position: ${JSON.stringify(changedNodeInData.position)}, Dimensions: ${JSON.stringify(dimensions)}`);
      }
      // 可以添加更详细的边变化检测，但暂时省略以保持简洁
    }
  },
  { deep: true }
); // 使用 deep watch 来检测内部变化，例如 position

// 获取 VueFlow 组件的引用
const vueFlowRef = ref<any | null>(null);
const canvasContainerRef = ref<HTMLDivElement | null>(null); // 添加画布容器引用

// 使用VueFlow提供的工具函数
// Use useVueFlow composable to get instance and functions
const vueFlowInstance = useVueFlow();
const {
  onNodeClick,
  onNodeContextMenu,
  onPaneReady,
  // onConnect,
  onPaneContextMenu,
  project,
  getNodes,
  addSelectedNodes, // 添加这个
  addSelectedEdges, // 添加这个
  removeEdges, // Keep this for direct VueFlow operations if needed, e.g., invalidNodeGroupEdgeIds
  getEdges,
  onMoveEnd,
} = vueFlowInstance;

// 获取拖拽相关函数
const { onDragOver, onDragLeave, onDrop } = useDragAndDrop();
const themeStore = useThemeStore();
const isDark = computed(() => themeStore.currentAppliedMode === 'dark');
const nodeStore = useNodeStore();
const { nodeDefinitions } = storeToRefs(nodeStore); // 从 nodeStore 获取响应式引用
const workflowStore = useWorkflowStore(); // 实例化 WorkflowStore
const tabStore = useTabStore(); // 实例化 TabStore
const dialogService = useDialogService(); // 实例化 DialogService
const activeTabId = computed(() => tabStore.activeTabId); // 获取活动标签页 ID
// const currentWorkflowInterface = computed(() => {
//   if (activeTabId.value) {
//     // 使用 getTabState 方法获取特定标签页的状态
//     const state = workflowStore.getTabState(activeTabId.value);
//     if (state && state.workflowData) {
//       return {
//         inputs: state.workflowData.interfaceInputs || {},
//         outputs: state.workflowData.interfaceOutputs || {},
//       };
//     }
//   }
//   return undefined;
// });

// 初始化连线逻辑
const { removeNodeConnections } = useCanvasConnections({
  getNodes,
  isDark,
  getEdges,
});

// Initialize keyboard shortcuts and get needed methods
const { deleteSelectedElements } = useCanvasKeyboardShortcuts(); // <-- selectAllElements 不再需要从这里解构

// Assign to names expected by the template for context menu
const deleteSelected = deleteSelectedElements;
// 处理全选事件
const onSelectAll = () => {
  // 直接调用 useVueFlow 的选择方法
  const nodesToSelect = getNodes.value;
  const edgesToSelect = getEdges.value;
  if (nodesToSelect.length > 0) {
    addSelectedNodes(nodesToSelect);
  }
  if (edgesToSelect.length > 0) {
    addSelectedEdges(edgesToSelect);
  }
  closePaneContextMenu();
};

// 右键菜单状态
const showPaneContextMenu = ref(false);
const showNodeContextMenu = ref(false);
const showSlotContextMenu = ref(false); // 添加插槽菜单状态
const rawInteractionPosition = ref<XYPosition>({ x: 0, y: 0 }); // 存储原始交互的视口坐标
// const contextMenuPosition = ref({ x: 0, y: 0 }); // Moved to useContextMenuPositioning
const selectedNodeId = ref("");
const selectedNodeType = ref<string | undefined>(undefined); // 用于存储右键点击节点的类型
const currentNodeSelectionCount = ref(0); // 添加回选中数量的 ref
const slotContextMenuContext = ref<{
  nodeId: string;
  handleId: string;
  handleType: "source" | "target";
} | null>(null); // 插槽菜单上下文
const copiedNodes = ref<Node[]>([]);

// 计算属性
const hasSelectedNodes = computed(() => {
  const nodes = getNodes.value;
  return nodes.some((node) => node.selected);
});

const hasCopiedNodes = computed(() => copiedNodes.value.length > 0);

// 关闭右键菜单
const closeContextMenu = (menu: { value: boolean }) => {
  menu.value = false;
};

// 关闭所有右键菜单
const closeAllContextMenus = () => {
  closeContextMenu(showPaneContextMenu);
  closeContextMenu(showNodeContextMenu);
  closeContextMenu(showSlotContextMenu); // 关闭插槽菜单
};

// 关闭画布右键菜单
const closePaneContextMenu = () => closeContextMenu(showPaneContextMenu);

// 关闭节点右键菜单
const closeNodeContextMenu = () => closeContextMenu(showNodeContextMenu);

// 关闭插槽右键菜单
const closeSlotContextMenu = () => closeContextMenu(showSlotContextMenu);

// 转发来自 ContextMenu 的节点添加请求给父组件 (EditorView)
const forwardRequestAddNode = (payload: { fullNodeType: string }) => { // screenPosition 不再由 ContextMenu 传递
  console.debug(`[Canvas] forwardRequestAddNode received payload:`, payload);
  if (!payload || !payload.fullNodeType) {
    console.error("[Canvas] Invalid payload for forwarding request-add-node:", payload);
    return;
  }

  // 使用存储的原始交互视口坐标
  const flowPosition = project(rawInteractionPosition.value);
  console.debug(`[Canvas] Calculated flowPosition for context menu add (using rawInteractionPosition):`, flowPosition);

  emit("request-add-node-to-workflow", {
    fullNodeType: payload.fullNodeType,
    flowPosition: flowPosition,
  });
  closeAllContextMenus(); // 添加节点后关闭菜单
};

// 添加节点组
const addGroup = () => {
  // 使用原始交互位置来确定组节点的位置
  const position = project(rawInteractionPosition.value) as XYPosition;

  // 创建一个组节点
  const groupNode: Node = {
    id: `group-${Date.now()}`,
    type: "group",
    position,
    style: {
      width: 300,
      height: 200,
      backgroundColor: "var(--ct-node-group-bg, rgba(240, 240, 240, 0.7))",
      border: `1px dashed var(--ct-node-group-border-color, #ccc)`,
      borderRadius: "8px",
      padding: "10px",
    },
    data: { label: "新节点组" },
  };

  internalElements.value = [...internalElements.value, groupNode];
};

// 复制选中节点
const copySelected = () => {
  const nodes = getNodes.value;
  copiedNodes.value = nodes.filter((node) => node.selected);
  // TODO: Also copy edges between selected nodes?
};

// 粘贴节点
const paste = () => {
  if (copiedNodes.value.length === 0) return;

  // 使用原始交互位置来确定粘贴的基准位置
  const position = project(rawInteractionPosition.value) as XYPosition;
  // Calculate average position of copied nodes to paste relative to context menu
  let avgX = 0;
  let avgY = 0;
  copiedNodes.value.forEach((n) => {
    avgX += n.position.x;
    avgY += n.position.y;
  });
  avgX /= copiedNodes.value.length;
  avgY /= copiedNodes.value.length;

  const newNodes = copiedNodes.value.map((node) => ({
    ...node,
    id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    position: {
      x: position.x + (node.position.x - avgX), // Paste relative to original structure
      y: position.y + (node.position.y - avgY),
    },
    selected: false, // Deselect after pasting
  }));

  internalElements.value = [...internalElements.value, ...newNodes];
  // TODO: Also paste edges between copied nodes?
};

// 删除选中节点 - Logic moved to useCanvasKeyboardShortcuts
// const deleteSelected = () => { ... };

// 重置视图
const resetView = () => {
  vueFlowRef.value?.fitView();
};

// 节点相关操作
const editNode = (nodeId: string) => {
  console.debug("编辑节点:", nodeId);
  // 这里添加编辑节点的逻辑
};

const duplicateNode = (nodeId: string) => {
  const nodeToDuplicate = internalElements.value.find(
    (el) => "id" in el && el.id === nodeId
  ) as Node;
  if (!nodeToDuplicate) return;

  const newNode: Node = {
    ...nodeToDuplicate,
    id: `node-${Date.now()}`,
    position: {
      x: nodeToDuplicate.position.x + 50,
      y: nodeToDuplicate.position.y + 50,
    },
  };

  internalElements.value = [...internalElements.value, newNode];
};

const connectNode = (nodeId: string) => {
  console.debug("连接节点:", nodeId);
  // 这里添加连接节点的逻辑
};

const disconnectNode = (nodeId: string) => {
  // 使用更新后的 removeNodeConnections
  removeNodeConnections(nodeId);
};

const deleteNode = async (nodeId: string) => {
  // 标记为 async
  const nodeToRemove = getNodes.value.find((n) => n.id === nodeId);
  if (!nodeToRemove) {
    console.warn(`[Canvas] Node with id ${nodeId} not found for deletion.`);
    return;
  }

  const activeTab = activeTabId.value;
  if (!activeTab) {
    console.warn("[Canvas] Cannot delete node: No active tab ID found.");
    return;
  }

  // 查找并准备删除与该节点相关的边
  const edgesToRemove = getEdges.value.filter(
    (edge) => edge.source === nodeId || edge.target === nodeId
  );
  const elementsToRemove: (Node | Edge)[] = [nodeToRemove, ...edgesToRemove];

  const nodeDisplayName =
    nodeToRemove.data?.label || nodeToRemove.data?.defaultLabel || nodeToRemove.id;
  const entry = createHistoryEntry(
    "delete",
    "node", // 更具体的操作对象类型
    `删除节点 ${nodeDisplayName}`, // 使用显示名称
    {
      deletedNodes: [
        {
          // 保持数组结构，即使只有一个节点
          nodeId: nodeToRemove.id,
          nodeName: nodeDisplayName,
          nodeType: nodeToRemove.type, // type 已经是 namespace:type 格式
        },
      ],
      // 确保边信息包含句柄
      deletedEdges: edgesToRemove.map((e) => ({
        edgeId: e.id,
        sourceNodeId: e.source,
        sourceHandle: e.sourceHandle,
        targetNodeId: e.target,
        targetHandle: e.targetHandle,
      })),
    }
  );

  await workflowStore.removeElementsAndRecord(activeTab, elementsToRemove, entry);
  console.log(`[Canvas] Dispatched deletion of node ${nodeId} and its connections.`);
};

// 节点点击事件
onNodeClick(({ node }) => {
  console.debug("Node clicked:", node);
  emit("node-click", node);
});

// 画布准备完成事件
onPaneReady((instance) => {
  // The hook receives the instance
  // Emit the instance received from the hook
  emit("pane-ready", instance);
});

// 节点右键菜单事件
// 使用新的 Composable
const { contextMenuPosition, calculateContextMenuPosition } =
  useContextMenuPositioning(canvasContainerRef);

onNodeContextMenu(({ event, node }) => {
  event.preventDefault();
  event.stopPropagation();

  rawInteractionPosition.value = getEventClientPosition(event); // 存储原始视口坐标
  selectedNodeId.value = node.id;
  selectedNodeType.value = node.type; // 获取并存储节点类型

  // 计算当前选中的节点数量
  const selectedNodes = getNodes.value.filter((n) => n.selected);
  const isClickedNodeSelected = selectedNodes.some((n) => n.id === node.id);
  if (selectedNodes.length > 1 && isClickedNodeSelected) {
    currentNodeSelectionCount.value = selectedNodes.length;
  } else {
    currentNodeSelectionCount.value = 1; // 视为单选操作
  }
  // console.debug(`[Canvas] Node context menu on ${node.id}. Effective selection count: ${currentNodeSelectionCount.value}`);

  // NodeContextMenu 默认宽度约 180px, 高度根据选项变化，预估 250px
  calculateContextMenuPosition(event, 180, 250);
  // contextMenuPosition.value 已在 calculateContextMenuPosition 内部更新
  closeAllContextMenus();
  showNodeContextMenu.value = true;
  // Fallback or error handling if position couldn't be calculated (calculateContextMenuPosition now always returns a position)
  // No explicit 'else' needed as calculateContextMenuPosition handles edge cases.
});

// 画布右键菜单事件
onPaneContextMenu((event) => {
  event.preventDefault();
  event.stopPropagation();

  rawInteractionPosition.value = getEventClientPosition(event); // 存储原始视口坐标
  // ContextMenu 默认宽度约 250px, 高度根据选项变化，预估 350px
  calculateContextMenuPosition(event, 250, 350);
  // contextMenuPosition.value 已在 calculateContextMenuPosition 内部更新
  closeAllContextMenus();
  showPaneContextMenu.value = true;
  // Fallback or error handling (calculateContextMenuPosition now always returns a position)
  // No explicit 'else' needed.
});

// 辅助函数：获取事件坐标，兼容鼠标和触摸事件 - Moved to useContextMenuPositioning.ts
// const getEventPosition = (event: MouseEvent | TouchEvent): XYPosition => { ... };

// 全选节点 - Logic moved to useCanvasKeyboardShortcuts
// const selectAllNodes = () => { ... };

// 连接建立事件处理已移至 useCanvasConnections.ts
// onConnect hook (previously lines 482-527) has been removed as its logic
// is now handled internally by useCanvasConnections.ts.

// 处理来自 BaseNode 的插槽右键菜单事件
const handleSlotContextMenu = (event: CustomEvent) => {
  const { detail } = event;
  const mouseEvent = detail.originalEvent as MouseEvent; // 获取原始鼠标事件

  event.preventDefault();
  event.stopPropagation();

  // console.debug('Canvas received slot-contextmenu:', detail);

  rawInteractionPosition.value = getEventClientPosition(mouseEvent); // 存储原始视口坐标
  slotContextMenuContext.value = {
    nodeId: detail.nodeId,
    handleId: detail.handleId,
    handleType: detail.handleType,
  };

  // SlotContextMenu 默认宽度约 180px, 高度根据选项变化，预估 100px
  calculateContextMenuPosition(mouseEvent, 180, 100); // 更新 contextMenuPosition ref
  // contextMenuPosition.value 已在 calculateContextMenuPosition 内部更新
  closeAllContextMenus();
  showSlotContextMenu.value = true;
};

// 处理插槽断开连接
const handleSlotDisconnect = (context: {
  nodeId: string;
  handleId: string;
  handleType: "source" | "target";
}) => {
  if (activeTabId.value) {
    workflowStore.removeEdgesForHandle(
      activeTabId.value,
      context.nodeId,
      context.handleId,
      context.handleType
    );
  }
  closeSlotContextMenu();
};

// 新增：处理节点拖拽停止事件 - REMOVED: This logic is now handled in EditorView.vue
// const handleNodesDragStop = (event: any) => {
//   console.debug('[Canvas] @nodes-drag-stop event fired:', event.nodes);
// };

// 处理边变化事件
const handleEdgesChange = () => {
  // console.log('Edges changed, marking as dirty.');
  // workflowStore.markAsDirty(); // Let EditorView handle marking dirty via update:modelValue
};

// --- 接口变更后检查连接兼容性 ---
// areTypesCompatible 已直接导入，无需从 useWorkflowGrouping 解构

// 使用新的 Composable 进行 NodeGroup 连接验证
const invalidNodeGroupEdgeIds = useNodeGroupConnectionValidation({
  nodes: getNodes, // 传递响应式引用
  edges: getEdges, // 传递响应式引用
  nodeDefinitions, // 传递响应式引用
  // currentWorkflowInterface, // 传递当前工作流的接口信息 - 已在 composable 内部获取
  // areTypesCompatible, // 不再需要传递，Composable 会直接导入
});

// 监听无效边 ID 列表的变化
watch(
  invalidNodeGroupEdgeIds,
  async (newInvalidIdsFromWatcher, oldInvalidIds) => {
    // 标记为 async
    // newInvalidIdsFromWatcher 是 watch 触发时的快照值，可能基于 updateNodeInternals 生效前的数据
    if (
      newInvalidIdsFromWatcher.length > 0 &&
      JSON.stringify(newInvalidIdsFromWatcher) !== JSON.stringify(oldInvalidIds)
    ) {
      // 等待，让 BaseNode 中的 updateNodeInternals (也在 nextTick 中) 有机会执行并传播效果
      await nextTick();

      // 在等待之后，重新获取最新的 invalidNodeGroupEdgeIds 值
      const currentInvalidIds = invalidNodeGroupEdgeIds.value;

      if (currentInvalidIds.length > 0) {
        removeEdges(currentInvalidIds);
        console.log(
          `[Canvas] 因节点组接口变更或连接类型不兼容，已移除 ${currentInvalidIds.length} 条连接。 Removed ${currentInvalidIds.length} incompatible NodeGroup edges.`
        );
      } else {
        // console.log('[Canvas] Incompatible edges were resolved after waiting for ticks. No removal needed.');
      }
    }
  },
  { immediate: false, flush: "post" }
); // flush: 'post' 确保在DOM更新后
// --- 结束 连接兼容性检查 ---

// --- 处理 NodeContextMenu 发出的多选事件 ---
// (这些函数之前已存在，确保它们在这里)
const handleCopySelection = () => {
  // console.debug('[Canvas] Handling copy-selection event');
  copySelected(); // 调用现有的复制逻辑
};

const handleCreateGroupFromSelection = () => {
  const selectedNodes = getNodes.value.filter((n) => n.selected);
  const selectedNodeIds = selectedNodes.map((n) => n.id);
  // console.debug('[Canvas] Handling create-group-from-selection event from context menu for nodes:', selectedNodeIds);

  if (selectedNodeIds.length < 1) {
    // 修改：允许单个节点创建组
    console.log("Need to select at least one node to create a group."); // 修改：更新提示信息
    dialogService.showError("请选择至少一个节点来创建节点组。"); // 修改：更新用户提示
    return;
  }

  if (!activeTabId.value) {
    console.error("Cannot group nodes: No active tab found.");
    dialogService.showError("无法创建节点组：没有活动的标签页。");
    return;
  }

  // 直接调用从 useWorkflowGrouping 获取的 performGrouping 函数
  // 需要确保 useWorkflowGrouping 已导入并解构 performGrouping
  const { groupSelectedNodes: performGrouping } = useWorkflowGrouping(); // 确保导入和解构
  try {
    performGrouping(selectedNodeIds, activeTabId.value);
    console.log(`[Canvas] Grouping action dispatched for tab ${activeTabId.value}.`);
  } catch (error) {
    console.error("Error during grouping from context menu:", error);
    dialogService.showError(`创建节点组失败: ${error instanceof Error ? error.message : "未知错误"}`);
  }
};

const handleCreateFrameForSelection = () => {
  const selectedNodes = getNodes.value.filter((n) => n.selected);
  // console.debug('[Canvas] Handling create-frame-for-selection event for nodes:', selectedNodes.map(n => n.id));

  if (selectedNodes.length === 0) return;

  // 1. 计算包围盒
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const padding = 40; // 边框与节点之间的间距

  selectedNodes.forEach((node) => {
    // 确保节点有位置和尺寸信息
    const widthSource =
      node.dimensions?.width ??
      (typeof node.style === "object" ? node.style.width : undefined) ??
      150;
    const heightSource =
      node.dimensions?.height ??
      (typeof node.style === "object" ? node.style.height : undefined) ??
      50;
    const nodeWidth = typeof widthSource === "string" ? parseFloat(widthSource) : widthSource;
    const nodeHeight = typeof heightSource === "string" ? parseFloat(heightSource) : heightSource;
    const x = node.position.x;
    const y = node.position.y;

    if (!isNaN(nodeWidth) && !isNaN(nodeHeight)) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + nodeWidth);
      maxY = Math.max(maxY, y + nodeHeight);
    } else {
      console.warn(
        `[Canvas] Node ${node.id} has invalid dimensions, using fallback for frame calculation.`
      );
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + 150);
      maxY = Math.max(maxY, y + 50);
    }
  });

  if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
    console.error("[Canvas] Failed to calculate bounding box for selected nodes.");
    dialogService.showError("无法为选中节点创建分组框，计算边界失败。");
    return;
  }

  // 2. 计算 Frame 节点的位置和大小
  const frameX = minX - padding;
  const frameY = minY - padding;
  const frameWidth = maxX - minX + 2 * padding;
  const frameHeight = maxY - minY + 2 * padding;

  // 3. 创建 Frame 节点
  const frameNode: Node = {
    id: `frame-${Date.now()}`,
    type: "group",
    position: { x: frameX, y: frameY },
    style: {
      width: frameWidth,
      height: frameHeight,
      backgroundColor: "var(--ct-frame-bg, rgba(220, 220, 240, 0.4))",
      border: `2px dotted var(--ct-frame-border-color, #9CA3AF)`,
      borderRadius: "12px",
    },
    data: { label: "分组框" },
    selectable: true,
    draggable: true,
    zIndex: -1000,
  };

  // 4. 添加 Frame 节点到画布
  internalElements.value = [...internalElements.value, frameNode];
  // console.debug(`[Canvas] Created frame node: ${frameNode.id} at (${frameX}, ${frameY}) size ${frameWidth}x${frameHeight}`);
};

const handleDeleteSelection = () => {
  // console.debug('[Canvas] Handling delete-selection event');
  deleteSelectedElements(); // 调用现有的删除选中元素逻辑
};
// --- 结束 多选事件处理 ---

// 暴露方法给父组件
defineExpose({
  vueFlowRef,
});

// 添加全局点击事件监听 (用于关闭菜单)
onMounted(() => {
  // Keyboard listeners are now handled by useCanvasKeyboardShortcuts

  // 注册 onNodeDragStop hook - REMOVED: Logic moved to EditorView
  // onNodeDragStop(handleNodesDragStop);
  // console.debug('[Canvas] onNodeDragStop hook registered.');

  // 监听视口移动结束事件并更新 Store
  onMoveEnd(({ flowTransform }) => {
    // 使用 flowTransform
    if (activeTabId.value) {
      const newViewport = { x: flowTransform.x, y: flowTransform.y, zoom: flowTransform.zoom };
      // console.log('Canvas Move/Zoom End - Zoom Value:', newViewport.zoom); // 移除调试打印
      // console.log('Canvas Move End - Viewport:', newViewport);
      workflowStore.setViewport(activeTabId.value, newViewport);
    }
  });

  // onZoomEnd 不存在，移除相关代码
  document.addEventListener("click", closeAllContextMenus);
  // 监听来自子组件的插槽右键菜单事件
  vueFlowRef.value?.$el.addEventListener("slot-contextmenu", handleSlotContextMenu);
});

onUnmounted(() => {
  // Keyboard listeners are now handled by useCanvasKeyboardShortcuts
  document.removeEventListener("click", closeAllContextMenus);
  // 移除事件监听器
  if (vueFlowRef.value?.$el) {
    vueFlowRef.value.$el.removeEventListener("slot-contextmenu", handleSlotContextMenu);
  }
});
</script>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100%;
  user-select: none;
  /* 禁止在画布容器上选择文本 */
  -webkit-user-select: none;
  /* 兼容旧版 WebKit */
  -moz-user-select: none;
  /* 兼容 Firefox */
  -ms-user-select: none;
  /* 兼容 IE/Edge */
}

/* VueFlow容器样式 */
:deep(.vue-flow) {
  @apply bg-background-base; /* 使用语义化背景色 */
}

/* 连接线样式 */
:deep(.vue-flow__edge) {
  @apply cursor-pointer;
}

:deep(.vue-flow__edge.selected) {
  @apply stroke-primary stroke-2; /* 使用语义化颜色 */
}

:deep(.vue-flow__edge-path) {
  stroke-width: 2;
}

:deep(.vue-flow__connection-path) {
  @apply stroke-primary; /* 使用语义化颜色 */
  stroke-width: 2;
}

/* 覆盖 VueFlow 节点包装器的默认边框 */
:deep(.vue-flow__node) {
  border: none !important;
  background-color: transparent !important;
  padding: 0 !important;
  overflow: visible !important;
}

/* 确保选中时的边框只应用在内部节点 */
:deep(.vue-flow__node.selected) {
  box-shadow: none !important;
}

/* 让选框对鼠标事件透明，以便右键点击可以穿透到节点 */
:deep(.vue-flow__nodesselection-rect) {
  pointer-events: none;
}

/* VueFlow Controls 主题化 - 强化版 */
:deep(.vue-flow__controls) {
  @apply shadow-md rounded-md overflow-hidden; /* 加 overflow-hidden 避免内部元素破坏圆角 */
}

:deep(.vue-flow__controls .vue-flow__controls-button) { /* 增加选择器特指度 */
  background-color: hsl(var(--ct-background-surface-hsl)) !important;
  color: hsl(var(--ct-text-base-hsl)) !important; /* SVG 会继承这个颜色如果 fill="currentColor" */
  border: 1px solid hsl(var(--ct-border-base-hsl)) !important;
  box-shadow: none !important; /* 移除库可能自带的阴影 */
  transition: background-color 0.15s ease-in-out !important; /* 保留过渡 */
}

:deep(.vue-flow__controls .vue-flow__controls-button:hover) {
  background-color: hsl(var(--ct-neutral-hsl) / 0.15) !important; /* 对应 hover:bg-neutral-softest (假设 softest 是 0.15 透明度) */
}

:deep(.vue-flow__controls .vue-flow__controls-button svg) {
  fill: currentColor !important; /* 强制SVG使用父元素的 color 属性 */
}

/* 控制器按钮之间的分隔线 - VueFlow 默认是垂直排列，按钮间是上边框 */
:deep(.vue-flow__controls .vue-flow__controls-button + .vue-flow__controls-button) {
  border-top-width: 1px !important;
  border-top-color: hsl(var(--ct-border-base-hsl)) !important; /* 使用主题边框色作为分隔线 */
  margin-left: 0 !important; /* 重置可能存在的库默认 margin */
  border-left-width: 0 !important; /* 如果意外是水平排列，则移除左边框 */
}

/* 禁用状态 */
:deep(.vue-flow__controls .vue-flow__controls-button:disabled) {
  background-color: hsl(var(--ct-background-surface-hsl) / var(--ct-disabled-opacity)) !important;
  color: hsl(var(--ct-text-muted-hsl) / var(--ct-disabled-opacity)) !important;
  border-color: hsl(var(--ct-border-base-hsl) / var(--ct-disabled-opacity)) !important;
  cursor: not-allowed !important;
}


/* VueFlow MiniMap 主题化 */
:deep(.vue-flow__minimap) {
  @apply bg-background-surface border border-border-base rounded-md shadow-md;
}
:deep(.vue-flow__minimap-mask) {
  /* 视口矩形外的遮罩 */
  /* 使用背景遮罩颜色和透明度, theme-variables.css 中定义了 --ct-backdrop-bg-hsl 和 --ct-backdrop-opacity */
  fill: hsl(var(--ct-backdrop-bg-hsl) / var(--ct-backdrop-opacity));
}
:deep(.vue-flow__minimap-node) {
  /* 小地图中的节点表示 */
  @apply fill-neutral stroke-border-base;
  stroke-width: 1px; /* 确保单位 */
}
:deep(.vue-flow__minimap-node.selected) { /* 如果有选中态 */
  @apply fill-primary stroke-primary;
}
</style>
