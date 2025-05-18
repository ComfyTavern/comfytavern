<template>
  <div
    v-if="panelLayout.isVisible"
    class="right-preview-panel"
    :style="{ width: `${panelLayout.width}px`, height: `${panelLayout.height}px` }"
  >
    <!-- 拖拽调整宽度的 Handle -->
    <div class="resize-handle-width" @mousedown.stop.prevent="startResizeWidth"></div>
    <!-- 拖拽调整高度的 Handle -->
    <div class="resize-handle-height" @mousedown.stop.prevent="startResizeHeight"></div>

    <!-- 面板头部，包含标题和关闭按钮 -->
    <div class="panel-header">
      <h3 class="panel-title">预览</h3>
      <button class="close-button" @click="togglePanelVisibility">
        &rarr; <!-- 简单箭头，后续可替换为图标 -->
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
  <!-- 收起时显示的按钮 -->
  <button
    v-else
    class="open-button"
    @click="togglePanelVisibility"
  >
    &larr; <!-- 简单箭头，后续可替换为图标 -->
  </button>
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
  panelLayout.value.height = Math.max(150, Math.min(newHeight, window.innerHeight - 40)); // 减去一些边距防止完全占满
};

const stopResizeHeight = () => {
  isResizingHeight.value = false;
  document.removeEventListener('mousemove', handleResizeHeight);
  document.removeEventListener('mouseup', stopResizeHeight);
};

onUnmounted(() => {
  document.removeEventListener('mousemove', handleResizeWidth);
  document.removeEventListener('mouseup', stopResizeWidth);
  document.removeEventListener('mousemove', handleResizeHeight);
  document.removeEventListener('mouseup', stopResizeHeight);
});
</script>

<style scoped>
.right-preview-panel {
  @apply fixed top-0 right-0 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-lg flex flex-col z-40;
  /* 移除了 h-full */
}

.resize-handle-width {
  @apply absolute top-0 left-0 w-2 h-full cursor-ew-resize z-50;
}

.resize-handle-height {
  @apply absolute bottom-0 left-0 w-full h-2 cursor-ns-resize z-50;
}

.panel-header {
  @apply flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0;
}

.panel-title {
  @apply text-sm font-semibold text-gray-700 dark:text-gray-200;
}

.close-button, .open-button {
  @apply p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded;
}

.open-button {
  @apply fixed top-1/2 right-0 transform -translate-y-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg p-2 rounded-l-md z-40;
  /* 调整了定位和样式，使其在收起时可见 */
}

.panel-content {
  @apply flex-grow p-0 overflow-y-auto; /* 移除内边距，让子元素控制 */
}
</style>