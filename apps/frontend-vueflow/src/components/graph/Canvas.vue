<template>
  <div ref="canvasContainerRef" class="canvas-container h-full w-full" @dragover.prevent="onDragOver"
    @dragleave="onDragLeave" @drop.prevent="onDrop" @dragenter.prevent>
    <VueFlow v-bind="$attrs" ref="vueFlowRef" v-model="internalElements" :node-types="props.nodeTypes" :edge-types="edgeTypes"
      :default-viewport="{ x: 0, y: 0, zoom: 1 }" :min-zoom="0.2" :max-zoom="4" fit-view-on-init
      :connect-on-drop="true" :edges-updatable="true" :edge-updater-radius="15"
      :snap-to-grid="true" :snapping-tolerance="10" :selectionMode="SelectionMode.Partial"
      :connection-line-component="UnplugConnectionLine"
      @edges-change="handleEdgesChange" :panOnDrag="true" :zoomOnScroll="true">
      <!-- 背景 -->
      <Background :pattern-color="isDark ? '#555' : '#aaa'" :gap="16" />

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
      :has-copied-nodes="hasCopiedNodes" @add-node="addNode" @add-group="addGroup" @copy="copySelected" @paste="paste"
      @delete="deleteSelected" @select-all="selectAllNodes" @reset-view="resetView" @close="closePaneContextMenu" />

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
import { ref, computed, onMounted, onUnmounted, type PropType } from 'vue' // 导入 PropType
import { watch, nextTick } from 'vue'
import { VueFlow, useVueFlow, SelectionMode, type NodeTypesObject, type EdgeTypesObject } from '@vue-flow/core' // 导入 NodeTypesObject 和 EdgeTypesObject
import UnplugConnectionLine from './edges/UnplugConnectionLine.vue';
import { useNodeStore } from '../../stores/nodeStore'
// workflowStore is needed by the composable, ensure it's available or imported if not already
import { useWorkflowStore } from '../../stores/workflowStore'; // 导入 WorkflowStore
import { useTabStore } from '../../stores/tabStore'; // 导入 TabStore
// import { useWorkflowStore } from '../../stores/workflowStore'
import useDragAndDrop from '../../composables/canvas/useDnd'
import { useCanvasKeyboardShortcuts } from '../../composables/canvas/useCanvasKeyboardShortcuts' // <-- Import the composable
import { useContextMenuPositioning } from '../../composables/canvas/useContextMenuPositioning'; // <-- Import the new composable
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import type { Node, Edge, Connection, XYPosition } from '@vue-flow/core'
import ContextMenu from './menus/ContextMenu.vue'
import NodeContextMenu from './menus/NodeContextMenu.vue'
import SlotContextMenu from './menus/SlotContextMenu.vue'; // 导入插槽右键菜单
import BaseNode from './nodes/BaseNode.vue'
import SortedMultiTargetEdge from './edges/SortedMultiTargetEdge.vue'; // 导入自定义边组件
import { useThemeStore } from '../../stores/theme'
import { storeToRefs } from 'pinia'
import { useCanvasConnections } from '../../composables/canvas/useCanvasConnections'
// import { useWorkflowGrouping, areTypesCompatible } from '../../composables/useWorkflowGrouping'; // 不再需要导入
import { useNodeGroupConnectionValidation } from '../../composables/node/useNodeGroupConnectionValidation'; // 导入新的 Composable
import { useWorkflowGrouping } from '@/composables/group/useWorkflowGrouping';
import { createHistoryEntry } from '@comfytavern/utils'; // <-- 导入 createHistoryEntry
// 定义props和emits
const props = defineProps({
  modelValue: { type: Array as PropType<Array<Node | Edge>>, required: true },
  nodeTypes: { type: Object as PropType<NodeTypesObject>, required: true }
});
const edgeTypes: EdgeTypesObject = {
  'sorted-multi-target': SortedMultiTargetEdge, // 使用导入的自定义边组件
};

const emit = defineEmits<{
  'update:modelValue': [value: Array<Node | Edge>]
  'node-click': [node: Node]
  'pane-ready': [instance: any] // Revert to emitting the hook instance, use 'any' for now
  'connect': [connection: Connection],
}>();

// 使用计算属性处理双向绑定
const internalElements = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

// 监听画布元素变化并打印日志
watch(internalElements, (newElements, oldElements) => {
  const oldNodes = oldElements?.filter(el => {
    if (typeof el !== 'object' || el === null) {
      // console.warn(`[Canvas] watch internalElements: Found non-object element in oldElements (for oldNodes):`, el); // 更详细的日志可选
      return false;
    }
    return 'position' in el;
  }) as Node[] || []; // 类型断言为 Node[]
  const newNodes = newElements?.filter(el => {
    if (typeof el !== 'object' || el === null) {
      console.warn(`[Canvas] watch internalElements: Found non-object element in newElements (for newNodes):`, el);
      return false;
    }
    return 'position' in el;
  }) as Node[] || []; // 类型断言为 Node[]
  const oldEdges = oldElements?.filter(el => {
    if (typeof el !== 'object' || el === null) {
      // console.warn(`[Canvas] watch internalElements: Found non-object element in oldElements (for oldEdges):`, el); // 更详细的日志可选
      return false;
    }
    return 'source' in el;
  }) || [];
  const newEdges = newElements?.filter(el => {
    if (typeof el !== 'object' || el === null) {
      console.warn(`[Canvas] watch internalElements: Found non-object element in newElements (for newEdges):`, el);
      return false;
    }
    return 'source' in el;
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
      return oldNode && (newNode.position.x !== oldNode.position.x || newNode.position.y !== oldNode.position.y);
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
}, { deep: true }); // 使用 deep watch 来检测内部变化，例如 position



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
  removeEdges, // Keep this for direct VueFlow operations if needed, e.g., invalidNodeGroupEdgeIds
  // addEdges,    // Keep this for direct VueFlow operations if needed
  getEdges,
  // instance, // The instance is directly available in vueFlowInstance
  onMoveEnd,
  // onNodeDragStop, // REMOVED: No longer used in Canvas.vue
} = vueFlowInstance;

// 获取拖拽相关函数
const { onDragOver, onDragLeave, onDrop } = useDragAndDrop();
const themeStore = useThemeStore()
const { isDark } = storeToRefs(themeStore)
const nodeStore = useNodeStore()
const { nodeDefinitions } = storeToRefs(nodeStore); // 从 nodeStore 获取响应式引用
const workflowStore = useWorkflowStore(); // 实例化 WorkflowStore
const tabStore = useTabStore(); // 实例化 TabStore
const activeTabId = computed(() => tabStore.activeTabId); // 获取活动标签页 ID
// const workflowStore = useWorkflowStore() // Ensure this is available if needed by the composable indirectly

// 初始化连线逻辑
const {
  removeNodeConnections,
  // setupConnectionHandlers 已移除，无需解构
} = useCanvasConnections({
  getNodes,
  isDark,
  // removeEdges and addEdges are no longer passed if useCanvasConnections doesn't expect them
  getEdges     // 传递 getEdges
  // elements: internalElements // elements 选项已移除，无需传递
});

// 设置连线处理函数
// setupConnectionHandlers(); // 调用已移除

// Initialize keyboard shortcuts
// Initialize keyboard shortcuts and get needed methods
const { deleteSelectedElements, selectAllElements } = useCanvasKeyboardShortcuts(); // <-- Use the composable and get functions

// Assign to names expected by the template for context menu
const deleteSelected = deleteSelectedElements;
const selectAllNodes = selectAllElements;

// 右键菜单状态
const showPaneContextMenu = ref(false);
const showNodeContextMenu = ref(false);
const showSlotContextMenu = ref(false); // 添加插槽菜单状态
// const contextMenuPosition = ref({ x: 0, y: 0 }); // Moved to useContextMenuPositioning
const selectedNodeId = ref('');
const selectedNodeType = ref<string | undefined>(undefined); // 用于存储右键点击节点的类型
const currentNodeSelectionCount = ref(0); // 添加回选中数量的 ref
const slotContextMenuContext = ref<{ nodeId: string; handleId: string; handleType: 'source' | 'target' } | null>(null); // 插槽菜单上下文
const copiedNodes = ref<Node[]>([]);

// 计算属性
const hasSelectedNodes = computed(() => {
  const nodes = getNodes.value;
  return nodes.some(node => node.selected);
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

// 添加节点
const addNode = (nodeType?: string) => {
  const position = project(contextMenuPosition.value) as XYPosition;

  // 如果没有指定节点类型，创建一个基础节点
  if (!nodeType) {
    const basicNode: Node = {
      id: `node-${Date.now()}`,
      type: 'default',
      position,
      data: { label: '新节点' }
    };
    internalElements.value = [...internalElements.value, basicNode];
    return;
  }

  // 获取节点定义 (使用 find)
  // 使用从 storeToRefs 获取的响应式 nodeDefinitions
  const nodeDefinition = nodeDefinitions.value.find(def => def.type === nodeType);
  if (!nodeDefinition) {
    console.error(`Node definition not found for type: ${nodeType}`);
    return;
  }

  // 创建新节点
  const newNode: Node = {
    id: `node-${Date.now()}`,
    type: nodeType, // 使用传入的节点类型
    position,
    data: {
      nodeType, // 实际的节点类型
      label: nodeDefinition.displayName || nodeDefinition.type,
      inputs: nodeDefinition.inputs || {},
      outputs: nodeDefinition.outputs || {},
      category: nodeDefinition.category
    }
  };

  internalElements.value = [...internalElements.value, newNode];
};

// 添加节点组
const addGroup = () => {
  const position = project(contextMenuPosition.value) as XYPosition;

  // 创建一个组节点
  const groupNode: Node = {
    id: `group-${Date.now()}`,
    type: 'group',
    position,
    style: {
      width: 300,
      height: 200,
      backgroundColor: isDark.value ? 'rgba(55, 65, 81, 0.7)' : 'rgba(240, 240, 240, 0.7)', // gray-700 with opacity
      border: `1px dashed ${isDark.value ? '#4B5563' : '#ccc'}`, // gray-600 for dark mode
      borderRadius: '8px',
      padding: '10px'
    },
    data: { label: '新节点组' }
  };

  internalElements.value = [...internalElements.value, groupNode];
};

// 复制选中节点
const copySelected = () => {
  const nodes = getNodes.value;
  copiedNodes.value = nodes.filter(node => node.selected);
  // TODO: Also copy edges between selected nodes?
};

// 粘贴节点
const paste = () => {
  if (copiedNodes.value.length === 0) return;

  const position = project(contextMenuPosition.value) as XYPosition;
  // Calculate average position of copied nodes to paste relative to context menu
  let avgX = 0;
  let avgY = 0;
  copiedNodes.value.forEach(n => {
    avgX += n.position.x;
    avgY += n.position.y;
  });
  avgX /= copiedNodes.value.length;
  avgY /= copiedNodes.value.length;

  const newNodes = copiedNodes.value.map(node => ({
    ...node,
    id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    position: {
      x: position.x + (node.position.x - avgX), // Paste relative to original structure
      y: position.y + (node.position.y - avgY)
    },
    selected: false // Deselect after pasting
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
  console.debug('编辑节点:', nodeId);
  // 这里添加编辑节点的逻辑
};

const duplicateNode = (nodeId: string) => {
  const nodeToDuplicate = internalElements.value.find(el => 'id' in el && el.id === nodeId) as Node;
  if (!nodeToDuplicate) return;

  const newNode: Node = {
    ...nodeToDuplicate,
    id: `node-${Date.now()}`,
    position: {
      x: nodeToDuplicate.position.x + 50,
      y: nodeToDuplicate.position.y + 50
    }
  };

  internalElements.value = [...internalElements.value, newNode];
};

const connectNode = (nodeId: string) => {
  console.debug('连接节点:', nodeId);
  // 这里添加连接节点的逻辑
};

const disconnectNode = (nodeId: string) => {
  // 使用更新后的 removeNodeConnections
  removeNodeConnections(nodeId);
};

const deleteNode = async (nodeId: string) => { // 标记为 async
  const nodeToRemove = getNodes.value.find(n => n.id === nodeId);
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
  const edgesToRemove = getEdges.value.filter(edge => edge.source === nodeId || edge.target === nodeId);
  const elementsToRemove: (Node | Edge)[] = [nodeToRemove, ...edgesToRemove];

  const nodeDisplayName = nodeToRemove.data?.label || nodeToRemove.data?.defaultLabel || nodeToRemove.id;
  const entry = createHistoryEntry(
    'delete',
    'node', // 更具体的操作对象类型
    `删除节点 ${nodeDisplayName}`, // 使用显示名称
    {
      deletedNodes: [{ // 保持数组结构，即使只有一个节点
        nodeId: nodeToRemove.id,
        nodeName: nodeDisplayName,
        nodeType: nodeToRemove.type, // type 已经是 namespace:type 格式
      }],
      // 确保边信息包含句柄
      deletedEdges: edgesToRemove.map(e => ({
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
  console.debug('Node clicked:', node);
  emit('node-click', node);
});

// 画布准备完成事件
onPaneReady((instance) => { // The hook receives the instance
  // Emit the instance received from the hook
  emit('pane-ready', instance);
});

// 节点右键菜单事件
// 使用新的 Composable
const { contextMenuPosition, calculateContextMenuPosition } = useContextMenuPositioning(canvasContainerRef);

onNodeContextMenu(({ event, node }) => {
  event.preventDefault();
  event.stopPropagation();

  selectedNodeId.value = node.id;
  selectedNodeType.value = node.type; // 获取并存储节点类型

  // 计算当前选中的节点数量
  const selectedNodes = getNodes.value.filter(n => n.selected);
  // 如果被右键点击的节点当前未被选中，但存在其他选中节点，则只考虑被点击的节点（表现为单选菜单）
  // 只有当被右键点击的节点本身就在多选集合中时，才真正按多选处理
  const isClickedNodeSelected = selectedNodes.some(n => n.id === node.id);
  if (selectedNodes.length > 1 && isClickedNodeSelected) {
    currentNodeSelectionCount.value = selectedNodes.length;
  } else {
    currentNodeSelectionCount.value = 1; // 视为单选操作
  }
  // console.debug(`[Canvas] Node context menu on ${node.id}. Effective selection count: ${currentNodeSelectionCount.value}`);


  const position = calculateContextMenuPosition(event);
  if (position) {
    closeAllContextMenus();
    showNodeContextMenu.value = true;
  } else {
    // Fallback or error handling if position couldn't be calculated
    // Optionally, show the menu at the raw event position as a fallback
    // contextMenuPosition.value = getEventClientPosition(event); // Need getEventClientPosition if using fallback
    closeAllContextMenus();
    showNodeContextMenu.value = true; // Still show menu, maybe at last known position or raw coords
  }
});

// 画布右键菜单事件
onPaneContextMenu((event) => {
  event.preventDefault();
  event.stopPropagation();

  const position = calculateContextMenuPosition(event);
  if (position) {
    closeAllContextMenus();
    showPaneContextMenu.value = true;
  } else {
    // Fallback or error handling
    closeAllContextMenus();
    showPaneContextMenu.value = true; // Still show menu
  }
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

  slotContextMenuContext.value = {
    nodeId: detail.nodeId,
    handleId: detail.handleId,
    handleType: detail.handleType,
  };

  // 使用新的 Composable 计算位置
  const position = calculateContextMenuPosition(mouseEvent);
  if (position) {
    closeAllContextMenus();
    showSlotContextMenu.value = true;
  } else {
    // Fallback or error handling
    closeAllContextMenus();
    showSlotContextMenu.value = true; // Still show menu
  }
};

// 处理插槽断开连接
const handleSlotDisconnect = (context: { nodeId: string; handleId: string; handleType: 'source' | 'target' }) => {
  if (activeTabId.value) {
    workflowStore.removeEdgesForHandle(activeTabId.value, context.nodeId, context.handleId, context.handleType);
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
  // areTypesCompatible, // 不再需要传递，Composable 会直接导入
});

// 监听无效边 ID 列表的变化
watch(invalidNodeGroupEdgeIds, (newInvalidIds, oldInvalidIds) => {
  // 仅在列表非空且发生变化时执行
  if (newInvalidIds.length > 0 && JSON.stringify(newInvalidIds) !== JSON.stringify(oldInvalidIds)) {
    // console.debug('[Canvas] Detected incompatible NodeGroup edges:', newInvalidIds);
    // 使用 nextTick 确保在 DOM 更新后执行移除操作，避免潜在的冲突
    nextTick(() => {
      removeEdges(newInvalidIds); // This removeEdges is from useVueFlow, for direct instance manipulation
      // 可选：通知用户
      alert(`因节点组接口变更或连接类型不兼容，已移除 ${newInvalidIds.length} 条连接。`);
      // removeEdges 会触发 getEdges 更新，进而可能重新计算 invalidNodeGroupEdgeIds
      // Composable 内部的 computed 会处理依赖更新，无需担心无限循环
    });
  }
}, { immediate: false }); // 不需要立即执行，等待 elements 初始化
// --- 结束 连接兼容性检查 ---

// --- 处理 NodeContextMenu 发出的多选事件 ---
// (这些函数之前已存在，确保它们在这里)
const handleCopySelection = () => {
  // console.debug('[Canvas] Handling copy-selection event');
  copySelected(); // 调用现有的复制逻辑
};

const handleCreateGroupFromSelection = () => {
  const selectedNodes = getNodes.value.filter(n => n.selected);
  const selectedNodeIds = selectedNodes.map(n => n.id);
  // console.debug('[Canvas] Handling create-group-from-selection event from context menu for nodes:', selectedNodeIds);

  if (selectedNodeIds.length <= 1) {
    console.log("Need to select more than one node to create a group.");
    alert("请选择多个节点来创建节点组。"); // 用户提示
    return;
  }

  if (!activeTabId.value) {
    console.error("Cannot group nodes: No active tab found.");
    alert("无法创建节点组：没有活动的标签页。");
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
    alert(`创建节点组失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
};

const handleCreateFrameForSelection = () => {
  const selectedNodes = getNodes.value.filter(n => n.selected);
  // console.debug('[Canvas] Handling create-frame-for-selection event for nodes:', selectedNodes.map(n => n.id));

  if (selectedNodes.length === 0) return;

  // 1. 计算包围盒
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const padding = 40; // 边框与节点之间的间距

  selectedNodes.forEach(node => {
    // 确保节点有位置和尺寸信息
    const widthSource = node.dimensions?.width ?? (typeof node.style === 'object' ? node.style.width : undefined) ?? 150;
    const heightSource = node.dimensions?.height ?? (typeof node.style === 'object' ? node.style.height : undefined) ?? 50;
    const nodeWidth = typeof widthSource === 'string' ? parseFloat(widthSource) : widthSource;
    const nodeHeight = typeof heightSource === 'string' ? parseFloat(heightSource) : heightSource;
    const x = node.position.x;
    const y = node.position.y;

    if (!isNaN(nodeWidth) && !isNaN(nodeHeight)) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + nodeWidth);
      maxY = Math.max(maxY, y + nodeHeight);
    } else {
      console.warn(`[Canvas] Node ${node.id} has invalid dimensions, using fallback for frame calculation.`);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + 150);
      maxY = Math.max(maxY, y + 50);
    }
  });

  if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
    console.error("[Canvas] Failed to calculate bounding box for selected nodes.");
    alert("无法为选中节点创建分组框，计算边界失败。");
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
    type: 'group',
    position: { x: frameX, y: frameY },
    style: {
      width: frameWidth,
      height: frameHeight,
      backgroundColor: isDark.value ? 'rgba(60, 70, 90, 0.3)' : 'rgba(220, 220, 240, 0.4)',
      border: `2px dotted ${isDark.value ? '#6B7280' : '#9CA3AF'}`,
      borderRadius: '12px',
    },
    data: { label: '分组框' },
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
  vueFlowRef
});

// 添加全局点击事件监听 (用于关闭菜单)
onMounted(() => {
  // Keyboard listeners are now handled by useCanvasKeyboardShortcuts

  // 注册 onNodeDragStop hook - REMOVED: Logic moved to EditorView
  // onNodeDragStop(handleNodesDragStop);
  // console.debug('[Canvas] onNodeDragStop hook registered.');

  // 监听视口移动结束事件并更新 Store
  onMoveEnd(({ flowTransform }) => { // 使用 flowTransform
    if (activeTabId.value) {
      const newViewport = { x: flowTransform.x, y: flowTransform.y, zoom: flowTransform.zoom };
      // console.log('Canvas Move/Zoom End - Zoom Value:', newViewport.zoom); // 移除调试打印
      // console.log('Canvas Move End - Viewport:', newViewport);
      workflowStore.setViewport(activeTabId.value, newViewport);
    }
  });

  // onZoomEnd 不存在，移除相关代码
  document.addEventListener('click', closeAllContextMenus);
  // 监听来自子组件的插槽右键菜单事件
  vueFlowRef.value?.$el.addEventListener('slot-contextmenu', handleSlotContextMenu);
});

onUnmounted(() => {
  // Keyboard listeners are now handled by useCanvasKeyboardShortcuts
  document.removeEventListener('click', closeAllContextMenus);
  // 移除事件监听器
  if (vueFlowRef.value?.$el) {
    vueFlowRef.value.$el.removeEventListener('slot-contextmenu', handleSlotContextMenu);
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
  @apply bg-gray-50 dark:bg-gray-900;
}

/* 连接线样式 */
:deep(.vue-flow__edge) {
  @apply cursor-pointer;
}

:deep(.vue-flow__edge.selected) {
  @apply stroke-blue-500 dark:stroke-blue-400 stroke-2;
}

:deep(.vue-flow__edge-path) {
  stroke-width: 2;
}

:deep(.vue-flow__connection-path) {
  stroke: #1890ff;
  stroke-width: 2;

  .dark & {
    stroke: #63b3ed;
    /* blue-400 */
  }
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
</style>
