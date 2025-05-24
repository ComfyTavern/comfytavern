<template>
  <div
    v-if="panelLayout.isVisible"
    class="right-preview-panel"
    :style="{ width: `${panelLayout.width}px`, height: `${panelLayout.height}px`, top: `${panelLayout.top}px` }"
  >
    <!-- 拖拽调整宽度的 Handle -->
    <div class="resize-handle-width" @mousedown.stop.prevent="startResizeWidth"></div>
    <!-- 拖拽调整高度的 Handle -->
    <div class="resize-handle-height" @mousedown.stop.prevent="startResizeHeight"></div>
    <!-- 拖拽调整停靠位置 (顶部) 的 Handle -->
    <div class="resize-handle-top" @mousedown.stop.prevent="startDragTop"></div>

    <!-- 面板头部，包含标题和关闭按钮 -->
    <div class="panel-header">
      <h3 class="panel-title">预览</h3>
      <button class="close-button" @click="togglePanelVisibility">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-right-square" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M15 2a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2zM0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm4.5 5.5a.5.5 0 0 0 0 1h5.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L10.293 7.5H4.5z"/>
        </svg>
      </button>
    </div>

    <!-- 面板内容区域 -->
    <div class="panel-content">
      <template v-if="workflowManager.activePreviewTarget.value">
        <p class="p-4 text-sm text-gray-500 dark:text-gray-400">
          正在加载预览: 节点 {{ workflowManager.activePreviewTarget.value.nodeId }}, 插槽 {{ workflowManager.activePreviewTarget.value.slotKey }}
        </p>
      </template>
      <template v-else>
        <p class="p-4 text-sm text-gray-500 dark:text-gray-400">
          无预览目标被选中。
        </p>
      </template>
    </div>
  </div>
  <!-- 收起时显示的悬浮图标 -->
  <div
    v-else
    class="collapsed-icon-wrapper"
    :style="{ top: `${panelLayout.top}px` }"
    @click="togglePanelVisibility"
    @mousedown.stop.prevent="startDragTop"
  >
    <svg class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor">
      <path d="M771.3 1023.978h-617.1c-85 0-154.2-68.8-154.2-153.2v-717.5c0-84.5 68.8-153.2 153.2-153.2h717.6c40.9 0 79.4 16 108.4 44.9 28.9 29 44.9 67.6 44.9 108.6v589.5c0 18.8-15.2 34.1-34.1 34.1-18.8 0-34.1-15.1-34.1-34v-589.7c0-47-38.2-85.3-85-85.3h-717.5c-46.8 0-85 38.2-85 85v717.5c0 46.8 38.5 85 85.9 85h616.9c18.8 0 34.1 15.2 34.1 34.1 0.1 18.7-15.2 34.2-34 34.2zM512.1 785.078c-73 0-141.5-28.4-193.1-79.9-51.6-51.6-79.9-120.1-79.9-193.1s28.4-141.5 79.9-193.1c51.6-51.6 120.1-79.9 193.1-79.9s141.5 28.4 193.1 79.9c51.6 51.6 79.9 120.1 79.9 193.1s-28.4 141.5-79.9 193.1c-51.5 51.6-120.2 79.9-193.1 79.9z m0-477.9c-112.9 0-204.8 91.9-204.8 204.8s91.9 204.8 204.8 204.8 204.8-91.9 204.8-204.8c0-113-91.9-204.8-204.8-204.8zM840.7 874.578c-8.6 0-17.3-3.2-23.9-9.7l-158.7-155.5c-13.4-13.2-13.7-34.8-0.5-48.2 13.2-13.4 34.8-13.7 48.2-0.5l158.6 155.5c13.4 13.2 13.7 34.8 0.5 48.2-6.6 6.9-15.4 10.2-24.2 10.2z" p-id="2386"></path>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { useWorkflowManager } from '@/composables/workflow/useWorkflowManager';

const workflowManager = useWorkflowManager();

const panelLayout = useLocalStorage('rightPreviewPanelLayout', {
  isVisible: true,
  width: 300,
  height: 400, // 默认高度
  top: 100, // 默认顶部停靠位置
});

const togglePanelVisibility = () => {
  panelLayout.value.isVisible = !panelLayout.value.isVisible;
};

// 宽度拖拽逻辑
const isResizingWidth = ref(false);
const initialMouseX = ref(0);
const initialWidth = ref(0);

const startResizeWidth = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  isResizingWidth.value = true;
  initialMouseX.value = event.clientX;
  initialWidth.value = panelLayout.value.width;
  document.addEventListener('mousemove', handleResizeWidth);
  document.addEventListener('mouseup', stopResizeWidth);
};

const handleResizeWidth = (event: MouseEvent) => {
  if (!isResizingWidth.value) return;
  const deltaX = event.clientX - initialMouseX.value;
  const newWidth = initialWidth.value - deltaX;
  panelLayout.value.width = Math.max(200, Math.min(newWidth, 800));
};

const stopResizeWidth = () => {
  isResizingWidth.value = false;
  document.removeEventListener('mousemove', handleResizeWidth);
  document.removeEventListener('mouseup', stopResizeWidth);
};

// 高度拖拽逻辑
const isResizingHeight = ref(false);
const initialMouseY = ref(0);
const initialHeight = ref(0);

const startResizeHeight = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  isResizingHeight.value = true;
  initialMouseY.value = event.clientY;
  initialHeight.value = panelLayout.value.height;
  document.addEventListener('mousemove', handleResizeHeight);
  document.addEventListener('mouseup', stopResizeHeight);
};

const handleResizeHeight = (event: MouseEvent) => {
  if (!isResizingHeight.value) return;
  const deltaY = event.clientY - initialMouseY.value;
  const newHeight = initialHeight.value + deltaY; // 拖拽底部 Handle，鼠标向下移动是增加高度
  const maxPanelHeight = window.innerHeight - panelLayout.value.top - 20; // 20px 作为底部边距
  panelLayout.value.height = Math.max(150, Math.min(newHeight, maxPanelHeight));
};

const stopResizeHeight = () => {
  isResizingHeight.value = false;
  document.removeEventListener('mousemove', handleResizeHeight);
  document.removeEventListener('mouseup', stopResizeHeight);
};

// 停靠位置 (Top) 拖拽逻辑
const isDraggingTop = ref(false);
const initialMouseYTop = ref(0);
const initialTop = ref(0);

const startDragTop = (event: MouseEvent) => {
  // 如果事件目标是按钮内的SVG图标，并且面板是展开的，则不触发顶部拖拽
  // 允许在收起状态下拖拽图标，或在展开状态下拖拽顶部拖拽条
  if (panelLayout.value.isVisible && (event.target as HTMLElement).closest('.panel-header .close-button svg')) {
    return;
  }
  // 如果是从 resize-handle-top 触发的，则总是允许
  const targetElement = event.target as EventTarget;
  const isTargetResizeHandleTop = (targetElement instanceof HTMLElement) && targetElement.classList.contains('resize-handle-top');

  if (!panelLayout.value.isVisible || isTargetResizeHandleTop) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingTop.value = true;
    initialMouseYTop.value = event.clientY;
    initialTop.value = panelLayout.value.top;
    document.addEventListener('mousemove', handleDragTop);
    document.addEventListener('mouseup', stopDragTop);
  }
};

const handleDragTop = (event: MouseEvent) => {
  if (!isDraggingTop.value) return;
  const deltaY = event.clientY - initialMouseYTop.value;
  const newTop = initialTop.value + deltaY;
  // 确保图标/面板至少有 40px 在可视区域内，并且顶部不小于0
  const minTop = 0;
  const maxTop = window.innerHeight - (panelLayout.value.isVisible ? Math.min(panelLayout.value.height, 40) : 40); // 40 是图标或面板的最小可见高度
  panelLayout.value.top = Math.max(minTop, Math.min(newTop, maxTop));
};

const stopDragTop = () => {
  isDraggingTop.value = false;
  document.removeEventListener('mousemove', handleDragTop);
  document.removeEventListener('mouseup', stopDragTop);
};

onUnmounted(() => {
  document.removeEventListener('mousemove', handleResizeWidth);
  document.removeEventListener('mouseup', stopResizeWidth);
  document.removeEventListener('mousemove', handleResizeHeight);
  document.removeEventListener('mouseup', stopResizeHeight);
  document.removeEventListener('mousemove', handleDragTop);
  document.removeEventListener('mouseup', stopDragTop);
});
</script>

<style scoped>
.right-preview-panel {
  @apply fixed right-0 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-lg flex flex-col z-50;
  /* 移除了 h-full, top 由 :style 动态绑定 */
  /* 添加一个最小高度，以确保拖拽手柄可见 */
  min-height: 50px;
}

.resize-handle-width {
  @apply absolute top-0 left-0 w-2 h-full cursor-ew-resize z-50;
}

.resize-handle-height {
  @apply absolute bottom-0 left-0 w-full h-2 cursor-ns-resize z-50;
}

.resize-handle-top {
  @apply absolute top-0 left-0 w-full h-2 cursor-ns-resize z-50 bg-transparent hover:bg-blue-300/30;
  /* 展开时顶部的拖拽条，可以做得更明显一些 */
}

.panel-header {
  @apply flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0;
  /* 添加 cursor: grab 来暗示面板头部可以拖动 (虽然实际拖动的是 resize-handle-top) */
  /* cursor: grab; */ /* 暂时移除，因为拖拽条更明确 */
}

.panel-title {
  @apply text-sm font-semibold text-gray-700 dark:text-gray-200;
}

.close-button, .open-button {
  @apply p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded;
}

.collapsed-icon-wrapper {
  @apply fixed right-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg p-2 rounded-md z-50 cursor-grab;
  /* top 由 :style 动态绑定 */
  /* 使图标看起来更像一个可交互的按钮 */
  transition: background-color 0.2s;
}

.collapsed-icon-wrapper:hover {
  @apply bg-gray-100 dark:bg-gray-700;
}

.collapsed-icon-wrapper .icon {
  @apply text-gray-600 dark:text-gray-300;
}

.panel-content {
  @apply flex-grow p-0 overflow-y-auto; /* 移除内边距，让子元素控制 */
}
</style>