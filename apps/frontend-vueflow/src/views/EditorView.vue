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
          <DockedEditorWrapper
            v-if="isDockedEditorVisible"
            ref="dockedEditorWrapperRef"
            class="docked-editor-wrapper"
          />
        </div>
      </div>
      <div v-else class="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        正在加载节点定义...
      </div>

      <!-- 节点预览面板 - 仅在侧边栏准备好后渲染 -->
      <!-- 调试信息显示面板已帮助定位问题 (isSidebarReady)，现将其移除。 -->

      <!-- 修改 v-if 条件，直接判断 sidebarManagerRef 是否已挂载并可用 -->
      <template v-if="sidebarManagerRef">
        <NodePreviewPanel
          :selected-node="selectedNodeForPreview"
          :is-sidebar-visible="sidebarManagerRef.isSidebarVisible"
          @close="selectedNodeForPreview = null"
          @add-node="handleAddNodeFromPanel"
        />
      </template>

    </div>

    <!-- 底部状态栏 -->
    <StatusBar class="editor-statusbar" />
    <!-- 右侧专用预览面板 - 移动到 editor-container 的直接子节点，以确保正确的悬浮行为 -->
    <RightPreviewPanel />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, markRaw, watch, nextTick, provide } from "vue"; // watch 已经存在，无需重复导入
import Canvas from "../components/graph/Canvas.vue";
import BaseNode from "../components/graph/nodes/BaseNode.vue";
import SidebarManager from "../components/graph/sidebar/SidebarManager.vue";
import NodePreviewPanel from "../components/graph/sidebar/NodePreviewPanel.vue";
import RightPreviewPanel from "../components/graph/sidebar/RightPreviewPanel.vue";
import DockedEditorWrapper from "../components/graph/editor/DockedEditorWrapper.vue";
import StatusBar from "../components/graph/StatusBar.vue";
import { type Node, type Edge } from "@vue-flow/core";
import { useNodeStore } from "../stores/nodeStore";
import { useWorkflowStore } from "../stores/workflowStore";
import { useTabStore } from "../stores/tabStore";
import { storeToRefs } from "pinia";
import { useRouteHandler } from "../composables/editor/useRouteHandler";
import { useCanvasInteraction } from "../composables/canvas/useCanvasInteraction";
import { useTabManagement } from "../composables/editor/useTabManagement";
import { useInterfaceWatcher } from "../composables/editor/useInterfaceWatcher";
import { useKeyboardShortcuts } from "../composables/editor/useKeyboardShortcuts";
import { useEditorState } from "../composables/editor/useEditorState";

// 组件实例引用
// 定义 SidebarManager 的类型
type SidebarManagerInstance = InstanceType<typeof SidebarManager> & {
  setActiveTab: (tabId: string) => void;
  isSidebarVisible: boolean;
  activeTab: string | null;
};

const canvasRef = ref<InstanceType<typeof Canvas> | null>(null);
const dockedEditorWrapperRef = ref<InstanceType<typeof DockedEditorWrapper> | null>(null);
const sidebarManagerRef = ref<SidebarManagerInstance | null>(null);

// 存储实例
const nodeStore = useNodeStore();
const workflowStore = useWorkflowStore();
const tabStore = useTabStore();
const { nodeDefinitions } = storeToRefs(nodeStore);
const nodeDefinitionsLoaded = computed(
  () => !!nodeDefinitions.value && nodeDefinitions.value.length > 0
);
const { initializeRouteHandling } = useRouteHandler();
const {
  loading,
  selectedNodeForPreview,
  // isSidebarReady, // 此变量已不再直接使用，移除以解决 TS 警告
  isDockedEditorVisible,
  requestedContextToOpen,
  clearRequestedContext,
  handleNodeSelected,
  handleError,
} = useEditorState();

// 之前的 selectedNodeForPreview watch 已帮助定位问题 (isSidebarReady)，现将其移除。

watch(
  requestedContextToOpen,
  (newContext) => {
    if (newContext && isDockedEditorVisible.value) {
      // 使用 nextTick 确保 DOM 更新完毕，dockedEditorWrapperRef 可用
      nextTick(() => {
        if (dockedEditorWrapperRef.value) {
          dockedEditorWrapperRef.value.openEditor(newContext);
          clearRequestedContext(); // 处理完后清除，避免重复触发
        } else {
          console.warn(
            "[EditorView] Watch requestedContextToOpen: dockedEditorWrapperRef is null even after nextTick."
          );
        }
      });
    }
  },
  { deep: true }
); // deep: true 以监视对象内部变化

// 活动标签页
const activeTabId = computed(() => tabStore.activeTabId);

// 节点类型映射
const nodeTypes = computed(() => {
  const types: Record<string, any> = {
    default: markRaw(BaseNode),
  };
  if (nodeDefinitions.value) {
    nodeDefinitions.value.forEach((def) => {
      const fullType = `${def.namespace || "core"}:${def.type}`;
      types[fullType] = markRaw(BaseNode);
    });
  }
  return types;
});

// 当前标签页的元素
const currentElements = computed(() => {
  if (!activeTabId.value) return [];
  return workflowStore.getElements(activeTabId.value);
});

// 当前VueFlow实例
const currentInstance = ref<any | null>(null);
const { handleAddNodeFromPanel, handleConnect, handleNodesDragStop, handleElementsRemove } =
  useCanvasInteraction(canvasRef); // 移除 currentInstance 参数

useTabManagement(activeTabId, currentInstance, selectedNodeForPreview);

useInterfaceWatcher(activeTabId, currentElements);

useKeyboardShortcuts(activeTabId);

// 更新元素函数
function updateElements(_newElements: Array<Node | Edge>) {
  const currentTab = activeTabId.value;
  if (currentTab) {
    // 由handleNodesDragStop管理拖拽后的更新
  } else {
    console.warn("[EditorView] updateElements called but no active tab ID.");
  }
}

// 节点点击事件处理
// @ts-expect-error
const handleNodeClick = (node: Node) => {};

// 画布准备完成事件处理
const handlePaneReady = async (instance: any) => {
  currentInstance.value = instance;

  if (activeTabId.value) {
    const currentTabId = activeTabId.value;
    await workflowStore.setVueFlowInstance(currentTabId, instance);
  } else {
    console.warn("EditorView (handlePaneReady): Pane ready but no active tab ID yet.");
  }
};

// 提供 sidebarRef 给子组件
provide('sidebarRef', {
  setActiveTab: (tabId: string) => {
    if (sidebarManagerRef.value) {
      sidebarManagerRef.value.setActiveTab(tabId);
    }
  }
});

// 组件挂载
onMounted(async () => {
  // 监听拖放事件
  document.addEventListener("dragstart", () => {}, { passive: true });
  document.addEventListener("dragend", () => {}, { passive: true });

  // 获取节点定义
  if (!nodeDefinitions.value || nodeDefinitions.value.length === 0) {
    loading.value = true;
    try {
      await nodeStore.fetchAllNodeDefinitions();
    } catch (error) {
      console.error("EditorView: Failed to fetch node definitions:", error);
      handleError(error, "获取节点定义");
    } finally {
      loading.value = false;
    }
  }

  // 确保活动标签页状态
  if (activeTabId.value) {
    workflowStore.ensureTabState(activeTabId.value);
  }

  // 初始化路由处理
  initializeRouteHandling();
});
// 组件卸载
onUnmounted(() => {
  if (activeTabId.value) {
    workflowStore.setVueFlowInstance(activeTabId.value, null);
  }
});
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
  /* 包含画布和下方编辑器的容器 */
}

.canvas-container {
  /* 画布容器 */
  min-height: 0; /* 允许在flex容器中正确缩小 */
}
.docked-editor-wrapper {
  /* 停靠编辑器样式 */
  flex-shrink: 0; /* 防止压缩到0高度 */
  overflow-y: auto; /* 内容超出时滚动 */
  border-top: 1px solid theme("colors.gray.300"); /* 与画布分隔 */
}

.dark .docked-editor-wrapper {
  border-top-color: theme("colors.gray.600");
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
  background-color: rgba(255, 255, 255, 0.7); /* 亮色模式 */
}

.dark .loading-overlay {
  background-color: rgba(31, 41, 55, 0.7); /* 暗色模式 */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 40; /* 确保加载遮罩在画布之上，但在状态栏之下 */
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
  color: #333; /* 亮色模式文本 */
}

.dark .loading-text {
  color: #f3f4f6; /* 暗色模式文本 */
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
