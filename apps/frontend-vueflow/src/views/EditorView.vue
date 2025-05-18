<template>
  <div class="editor-container flex flex-col bg-gray-100 dark:bg-gray-900">
    <!-- 主要内容区域 -->
    <div class="editor-main flex-1 relative overflow-hidden">
      <div v-if="loading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-text">正在加载节点数据...</div>
      </div>

      <!-- 主要内容布局 - 仅在节点定义加载后渲染 -->
      <div v-if="nodeDefinitionsLoaded" class="editor-content flex h-full">
        <!-- 侧边栏管理器 -->
        <SidebarManager
          ref="sidebarManagerRef"
          @add-node="handleAddNodeFromPanel"
          @node-selected="handleNodeSelected"
        />

        <!-- 右侧主内容区域 (画布和可停靠编辑器) -->
        <div class="right-pane flex flex-col flex-1 overflow-hidden">
          <!-- 画布容器 -->
          <div class="canvas-container flex-1 relative">
            <!-- 添加相对定位，用于可能的绝对定位子元素 -->
            <!-- 根据活动标签页类型条件渲染 Canvas 或 GroupEditor -->
            <Canvas
              ref="canvasRef"
              :model-value="currentElements"
              @update:model-value="updateElements"
              @node-click="handleNodeClick"
              @pane-ready="handlePaneReady"
              @connect="handleConnect"
              @node-drag-stop="handleNodesDragStop"
              @elements-remove="handleElementsRemove"
              :node-types="nodeTypes"
            />
            <!-- 传递 nodeTypes, 添加 key 绑定, 添加 nodes-drag-stop 和 elements-remove 监听 -->
          </div>
          <!-- 可停靠编辑器 -->
          <DockedEditorWrapper v-if="isDockedEditorVisible" ref="dockedEditorWrapperRef" class="docked-editor-wrapper" />
        </div>
      </div>
      <div v-else class="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        正在加载节点定义...
      </div>

      <!-- 节点预览面板 - 仅在侧边栏准备好后渲染 -->
      <template v-if="isSidebarReady">
        <NodePreviewPanel
          :selected-node="selectedNodeForPreview"
          :is-sidebar-visible="sidebarManagerRef?.isSidebarVisible ?? false"
          @close="selectedNodeForPreview = null"
          @add-node="handleAddNodeFromPanel"
        />
      </template>

      <!-- 右侧专用预览面板 -->
      <RightPreviewPanel />
    </div>

    <!-- 底部状态栏 -->
    <StatusBar class="editor-statusbar" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, markRaw, watch, nextTick } from "vue"; // Roo: Removed unused shallowRef. Added watch, nextTick
// import { useRoute, useRouter } from "vue-router"; // Roo: Moved to useRouteHandler - REMOVING IMPORT
// import { useDefaultWorkflowLoader } from "../composables/useDefaultWorkflowLoader"; // Roo: 移除默认工作流加载器
// import { useVueFlow } from '@vue-flow/core'; // Roo: Removed unused import
import Canvas from "../components/graph/Canvas.vue";
import BaseNode from "../components/graph/nodes/BaseNode.vue"; // 导入 BaseNode
// import TabBar from '../components/graph/tabs/TabBar.vue'; // 已移至 StatusBar
// 移除了 GroupEditor 导入
import SidebarManager from "../components/graph/sidebar/SidebarManager.vue";
import NodePreviewPanel from "../components/graph/sidebar/NodePreviewPanel.vue";
import RightPreviewPanel from "../components/graph/sidebar/RightPreviewPanel.vue"; // <-- 咕咕：导入新组件
import DockedEditorWrapper from "../components/graph/editor/DockedEditorWrapper.vue"; // <-- 咕咕：导入新组件
import StatusBar from "../components/graph/StatusBar.vue";
import { type Node, type Edge } from "@vue-flow/core"; // Roo: Removed unused isNode, Connection, NodeDragEvent
import {
  useNodeStore, // type FrontendNodeDefinition, // Roo: Removed unused type import
} from /* defaultNodeStyle, */ "../stores/nodeStore"; // 移除了未使用的 defaultNodeStyle
import { useWorkflowStore } from "../stores/workflowStore"; // 移除了未使用的 ManagedVueFlowInstance 导入, 移除了未使用的 WorkflowData
// import { useWorkflowManager } from "../composables/useWorkflowManager"; // <-- REMOVED: Not used directly here
import { useTabStore } from "../stores/tabStore"; // 导入 TabStore (移除未使用的 Tab 类型)
import { storeToRefs } from "pinia"; // 导入 storeToRefs
// import { useUniqueNodeId } from "../composables/useUniqueNodeId"; // Roo: Removed unused import
// import { useProjectStore } from "../stores/projectStore"; // Roo: Moved to useRouteHandler - REMOVING IMPORT
// import defaultWorkflowTemplate from '../components/graph/default-workflow.json'; // 移除了未使用的导入
import { useRouteHandler } from "../composables/editor/useRouteHandler"; // Roo: Import new composable
import { useCanvasInteraction } from "../composables/canvas/useCanvasInteraction"; // Roo: Import new composable
import { useTabManagement } from "../composables/editor/useTabManagement"; // Roo: Import new composable
import { useInterfaceWatcher } from "../composables/editor/useInterfaceWatcher"; // Roo: Import new composable
import { useKeyboardShortcuts } from "../composables/editor/useKeyboardShortcuts"; // Roo: Ensure this import exists
import { useEditorState } from "../composables/editor/useEditorState"; // Roo: Import new composable

// Roo: Editor state management moved to useEditorState.ts
const canvasRef = ref<InstanceType<typeof Canvas> | null>(null); // Restore ref definition for component instance
const dockedEditorWrapperRef = ref<InstanceType<typeof DockedEditorWrapper> | null>(null); // 咕咕：新增 ref
// const { screenToFlowCoordinate } = useVueFlow(); // Roo: Removed unused screenToFlowCoordinate
// const { instance } = useVueFlow(); // 实例现在按标签页管理

// --- Stores ---
const nodeStore = useNodeStore();
const workflowStore = useWorkflowStore();
// const workflowManager = useWorkflowManager(); // <-- REMOVED: Not used directly here
const tabStore = useTabStore(); // 实例化 TabStore
const { nodeDefinitions } = storeToRefs(nodeStore); // 从 nodeStore 获取响应式引用
// const { activeHistoryIndex } = storeToRefs(workflowStore); // <-- 移除未使用的导入
const nodeDefinitionsLoaded = computed(
  () => !!nodeDefinitions.value && nodeDefinitions.value.length > 0
); // 检查节点定义是否已加载
// const { generateUniqueNodeId } = useUniqueNodeId(); // Roo: Removed unused declaration
// useDefaultWorkflowLoader(); // Roo: 移除默认工作流加载器调用
// const route = useRoute(); // Roo: Moved to useRouteHandler - REMOVING DECLARATION
// const router = useRouter(); // Roo: Moved to useRouteHandler - REMOVING DECLARATION
// const projectStore = useProjectStore(); // Roo: Moved to useRouteHandler - REMOVING DECLARATION
const { initializeRouteHandling } = useRouteHandler(); // Roo: Initialize route handler
// Roo: Moved useCanvasInteraction initialization after currentInstance declaration
// Roo: Initialize editor state handler
const {
  loading,
  selectedNodeForPreview,
  isSidebarReady,
  sidebarManagerRef,
  isDockedEditorVisible, // <-- 咕咕：解构新状态
  requestedContextToOpen, // 咕咕：解构新状态
  clearRequestedContext,  // 咕咕：解构新方法
  handleNodeSelected,
  handleError,
} = useEditorState();

watch(requestedContextToOpen, (newContext) => {
  if (newContext && isDockedEditorVisible.value) {
    // 使用 nextTick 确保 DOM 更新完毕，dockedEditorWrapperRef 可用
    nextTick(() => {
      if (dockedEditorWrapperRef.value) {
        dockedEditorWrapperRef.value.openEditor(newContext);
        clearRequestedContext(); // 处理完后清除，避免重复触发
      } else {
        console.warn("[EditorView] Watch requestedContextToOpen: dockedEditorWrapperRef is null even after nextTick.");
      }
    });
  }
}, { deep: true }); // deep: true 以监视对象内部变化

// --- Active Tab ---
const activeTabId = computed(() => tabStore.activeTabId);

// 动态定义节点类型映射，确保所有从后端加载的类型都能渲染
const nodeTypes = computed(() => {
  const types: Record<string, any> = {
    default: markRaw(BaseNode), // 保留 default 以防万一
  };
  if (nodeDefinitions.value) {
    nodeDefinitions.value.forEach((def) => {
      // Construct the full type (namespace:type)
      const fullType = `${def.namespace || 'core'}:${def.type}`;
      // Register BaseNode using the full type as the key
      types[fullType] = markRaw(BaseNode);
    });
  }
  // console.debug("[EditorView] Computed nodeTypes:", Object.keys(types)); // 注释掉重复日志
  return types;
});

// 定义 VueFlow 实例的类型 - 现在已导入

// --- 活动标签页的计算元素 ---
const currentElements = computed(() => {
  if (!activeTabId.value) return [];
  return workflowStore.getElements(activeTabId.value);
});

// --- 在 Store 中更新元素 ---

// 存储与活动标签页关联的当前 VueFlow 实例
const currentInstance = ref<any | null>(null); // 暂时使用 any

// Roo: Initialize canvas interaction handler AFTER currentInstance is declared
const { handleAddNodeFromPanel, handleConnect, handleNodesDragStop, handleElementsRemove } =
  useCanvasInteraction(canvasRef); // 移除 currentInstance 参数

// Roo: Initialize tab management handler
useTabManagement(activeTabId, currentInstance, selectedNodeForPreview);

// Roo: Initialize interface watcher
useInterfaceWatcher(activeTabId, currentElements);

// Roo: Initialize keyboard shortcuts handler
useKeyboardShortcuts(activeTabId);

function updateElements(_newElements: Array<Node | Edge>) {
  // Roo: Renamed param to indicate it's unused here
  const currentTab = activeTabId.value;
  // console.debug(`[DEBUG EditorView/updateElements] Called for tab ${currentTab}. Received ${_newElements.length} elements. First few IDs:`, _newElements.slice(0, 3).map(el => el.id));
  // console.debug(
  //   `[EditorView] updateElements called for tab ${currentTab}. Element count: ${newElements.length}. IDs:`,
  //   newElements.map((el) => el.id)
  // );
  if (currentTab) {
    // console.debug(`[DEBUG EditorView/updateElements] About to set elements for tab ${currentTab}:`, JSON.stringify(newElements));
    // workflowStore.setElements(currentTab, newElements); // Roo: Commented out - Let handleNodesDragStop manage updates after drag
    // console.debug(
    //   `[EditorView] workflowStore.setElements called after updateElements for tab ${currentTab}.`
    // );
  } else {
    console.warn("[EditorView] updateElements called but no active tab ID.");
  }
}

// fetchNodes 函数此处不再需要，已移至 onMounted

// createDefaultNodes 函数此处不再需要，逻辑应与标签页创建绑定

// 节点点击事件处理
// @ts-expect-error
const handleNodeClick = (node: Node) => {
  // console.debug("EditorView - Node clicked:", node);
};

// 画布准备完成事件处理 - 现在由 Canvas 组件内部处理实例注册
const handlePaneReady = async (instance: any) => {
  // Make async
  // console.info("EditorView - Canvas pane ready, received instance."); // 改为 info
  currentInstance.value = instance; // 本地存储实例

  if (activeTabId.value) {
    const currentTabId = activeTabId.value; // 捕获以提高清晰度
    // console.debug(`EditorView (handlePaneReady): 将实例与标签页 ${currentTabId} 关联。`);
    // 将实例与标签页关联。setVueFlowInstance 将尝试同步现有状态。
    await workflowStore.setVueFlowInstance(currentTabId, instance); // Add await

    // 状态同步现在由 setVueFlowInstance 内部处理，它会读取 store 中的当前状态并应用到实例。
    // 初始加载或默认状态的应用由 ensureTabState 和 loadWorkflow 处理。
    // console.debug(`EditorView (handlePaneReady): Instance associated for tab ${currentTabId}. State synchronization is handled by setVueFlowInstance.`);
    // 可选：如果需要在实例准备好后立即 fitView
    // nextTick(() => {
    //   instance.fitView();
    // });
  } else {
    console.warn("EditorView (handlePaneReady): Pane ready but no active tab ID yet.");
  }
};

// --- Roo: Active tab watcher logic moved to useTabManagement.ts ---

// --- Roo: Workflow interface watcher logic moved to useInterfaceWatcher.ts ---

// --- Roo: Node selection logic moved to useEditorState.ts ---

// --- Roo: Canvas interaction logic moved to useCanvasInteraction.ts ---

// --- Roo: Error handling logic moved to useEditorState.ts ---

// --- Roo: Keyboard shortcut logic moved to useKeyboardShortcuts.ts ---

// 组件挂载时
onMounted(async () => {
  // 如果需要初始获取，则设为 async
  // console.info("EditorView component mounted."); // 改为 info
  // Roo: Keydown listener setup moved to useKeyboardShortcuts.ts

  // Roo: Global error listener setup moved to useEditorState.ts (implicitly via handleError)

  // 监听拖放相关的自定义事件
  document.addEventListener(
    "dragstart",
    () => {
      // console.log('EditorView - 检测到拖拽开始');
    },
    { passive: true }
  );

  document.addEventListener(
    "dragend",
    () => {
      // console.log('EditorView - Drag end detected');
    },
    { passive: true }
  );

  // 挂载时获取一次节点定义（或移至 App.vue/layout）
  // 使用从 storeToRefs 获取的响应式 nodeDefinitions
  if (!nodeDefinitions.value || nodeDefinitions.value.length === 0) {
    // console.info("EditorView: Fetching node definitions..."); // 改为 info
    loading.value = true;
    try {
      await nodeStore.fetchAllNodeDefinitions();
      // console.info("EditorView: Node definitions fetched successfully."); // 改为 info
    } catch (error) {
      console.error("EditorView: Failed to fetch node definitions:", error);
      handleError(error, "获取节点定义");
    } finally {
      loading.value = false;
    }
  } else {
    // console.debug("EditorView: Node definitions already loaded.");
  }

  // 确保初始活动标签页的状态存在
  if (activeTabId.value) {
    workflowStore.ensureTabState(activeTabId.value);
    // 如果初始标签页没有元素，也许创建默认节点？
    // 这个逻辑可能更适合放在 tabStore 的 addTab/initializeDefaultTab 中
    // if (workflowStore.getElements(activeTabId.value).length === 0) {
    //    createDefaultNodesForTab(activeTabId.value); // 需要一个新函数
    // }
  }

  // Roo: 调用 useRouteHandler 中的初始化函数
  initializeRouteHandling();
});

// --- Roo: 路由处理逻辑已移至 useRouteHandler.ts ---
// --- Roo: 第二个 onMounted 钩子已合并到上面的第一个钩子中并移除 ---

// --- Roo: Sidebar readiness watcher moved to useEditorState.ts ---

// 组件卸载时移除事件监听器
onUnmounted(() => {
  // console.info("EditorView component unmounting."); // 改为 info
  // Roo: Keydown listener removal moved to useKeyboardShortcuts.ts
  // 组件卸载时清理最后一个活动标签页的实例关联
  if (activeTabId.value) {
    // No need to await here as the component is unmounting
    workflowStore.setVueFlowInstance(activeTabId.value, null);
    // console.debug(`EditorView: Dissociated instance from tab ${activeTabId.value} on unmount.`);
  }
});

// --- Roo: 路由处理逻辑和参数监听已移至 useRouteHandler.ts ---
</script>

<style scoped>
.editor-container {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

/* 主要内容区域，包含画布和侧边栏 */
.editor-main {
  position: relative;
  overflow: hidden;
}

/* 内容区域布局 */
.editor-content {
  height: 100%;
  position: relative;
}

.right-pane {
  /* 用于包含画布和下方编辑器的容器 */
}

.canvas-container {
  /* 画布容器，确保它可以正确地 flex grow */
  min-height: 0; /* 允许在 flex 容器中正确缩小 */
}
.docked-editor-wrapper {
  /* 现在它在画布下方 */
  flex-shrink: 0; /* 防止在空间不足时被压缩到0高度 */
  /* 高度由 DockedEditorWrapper 组件内部的 panelStyle (editorHeight) 控制 */
  /* min-height 和 max-height 也是由 DockedEditorWrapper 内部逻辑控制拖拽范围 */
  overflow-y: auto; /* 如果内容超出则滚动, 但 DockedEditorWrapper 内部的 editor-content 也有 overflow */
  border-top: 1px solid theme('colors.gray.300'); /* 与画布分隔 */
  /* background-color: theme('colors.gray.50'); */ /* 可选背景色 */
}

.dark .docked-editor-wrapper {
  border-top-color: theme('colors.gray.600');
  /* background-color: theme('colors.gray.800'); */
}


/* 状态栏样式 */
.editor-statusbar {
  position: relative;
  z-index: 50;
  /* 确保状态栏在最上层 */
}

/* 加载遮罩 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.7);
  /* 亮色模式 */
}

.dark .loading-overlay {
  background-color: rgba(31, 41, 55, 0.7);
  /* 暗色模式 (bg-gray-800 带透明度) */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 40;
  /* 确保加载遮罩在画布之上，但在状态栏之下 */
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

.loading-text {
  font-size: 16px;
  color: #333;
  /* 亮色模式文本 */
}

.dark .loading-text {
  color: #f3f4f6;
  /* 暗色模式文本 (text-gray-100) */
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>
