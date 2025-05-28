<template>
  <div ref="panelElementRef" class="right-preview-panel" :class="{ 'is-expanded': panelLayout.isExpanded }" :style="{
    width: panelLayout.isExpanded ? `${panelLayout.width}px` : '40px',
    height: panelLayout.isExpanded ? `${panelLayout.height}px` : '40px',
    top: `${panelLayout.top}px` // 移除了 transform 以便通过 width/height 过渡实现动画
  }">
    <!-- 拖拽调整宽度的 Handle -->
    <div v-if="panelLayout.isExpanded" class="resize-handle-width" @mousedown.stop.prevent="startResizeWidth"></div>
    <!-- 拖拽调整高度的 Handle -->
    <div v-if="panelLayout.isExpanded" class="resize-handle-height" @mousedown.stop.prevent="startResizeHeight"></div>
    <!-- 拖拽调整宽度和高度的 Handle (左下角) -->
    <div v-if="panelLayout.isExpanded" class="resize-handle-corner" @mousedown.stop.prevent="startResizeCorner"></div>
    <!-- 拖拽调整停靠位置 (顶部) 的 Handle | 多余了 -->
    <!--<div v-if="panelLayout.isExpanded" class="resize-handle-top" @mousedown.stop.prevent="startDragTop"></div>-->

    <!-- 面板头部，包含标题和切换按钮 -->
    <div class="panel-header" :class="{ 'collapsed': !panelLayout.isExpanded }" @mousedown.stop.prevent="startDragTop">
      <h3 v-if="panelLayout.isExpanded" class="panel-title truncate"
        :title="activeTarget ? `${nodeDisplayName} (ID: ${activeTarget.nodeId})` : '预览'">
        <template v-if="activeTarget">
          {{ nodeDisplayName }} <span class="text-xs text-gray-500 dark:text-gray-400 ml-1">(ID: {{ activeTarget.nodeId
          }})</span>
        </template>
        <template v-else>
          <span class="text-gray-700 dark:text-gray-300">预览面板 
            <span class="text-gray-400 dark:text-gray-500">（未设置目标）</span>
          </span>
        </template>
      </h3>
      <button class="toggle-button" @click="togglePanelExpansion">
        <!-- 收起状态显示放大镜图标 -->
        <svg v-if="!panelLayout.isExpanded" class="icon" viewBox="0 0 1024 1024" version="1.1"
          xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor">
          <path
            d="M771.3 1023.978h-617.1c-85 0-154.2-68.8-154.2-153.2v-717.5c0-84.5 68.8-153.2 153.2-153.2h717.6c40.9 0 79.4 16 108.4 44.9 28.9 29 44.9 67.6 44.9 108.6v589.5c0 18.8-15.2 34.1-34.1 34.1-18.8 0-34.1-15.1-34.1-34v-589.7c0-47-38.2-85.3-85-85.3h-717.5c-46.8 0-85 38.2-85 85v717.5c0 46.8 38.5 85 85.9 85h616.9c18.8 0 34.1 15.2 34.1 34.1 0.1 18.7-15.2 34.2-34 34.2zM512.1 785.078c-73 0-141.5-28.4-193.1-79.9-51.6-51.6-79.9-120.1-79.9-193.1s28.4-141.5 79.9-193.1c51.6-51.6 120.1-79.9 193.1-79.9s141.5 28.4 193.1 79.9c51.6 51.6 79.9 120.1 79.9 193.1s-28.4 141.5-79.9 193.1c-51.5 51.6-120.2 79.9-193.1 79.9z m0-477.9c-112.9 0-204.8 91.9-204.8 204.8s91.9 204.8 204.8 204.8 204.8-91.9 204.8-204.8c0-113-91.9-204.8-204.8-204.8zM840.7 874.578c-8.6 0-17.3-3.2-23.9-9.7l-158.7-155.5c-13.4-13.2-13.7-34.8-0.5-48.2 13.2-13.4 34.8-13.7 48.2-0.5l158.6 155.5c13.4 13.2 13.7 34.8 0.5 48.2-6.6 6.9-15.4 10.2-24.2 10.2z"
            p-id="2386"></path>
        </svg>
        <!-- 展开状态显示向右箭头图标 -->
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor"
          class="bi bi-arrow-right-square" viewBox="0 0 16 16">
          <path fill-rule="evenodd"
            d="M15 2a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2zM0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm4.5 5.5a.5.5 0 0 0 0 1h5.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L10.293 7.5H4.5z" />
        </svg>
      </button>
    </div>

    <!-- 面板内容区域 -->
    <div v-if="panelLayout.isExpanded" class="panel-content">
      <template v-if="activeTarget">
        <div class="p-4 space-y-2">
          <div>
            <p class="text-sm mb-2">
              <span class="font-semibold text-gray-500 dark:text-gray-400">插槽: </span>
              <span class="text-gray-800 dark:text-gray-100">{{ slotDisplayName }}</span>
              <span class="text-xs text-gray-500 dark:text-gray-400 ml-1">(Key: {{ activeTarget.slotKey }})</span>
              <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase ml-2">- 输出</span>
            </p>
            <div class="p-2 border rounded bg-gray-50 dark:bg-gray-700/50 max-h-96 overflow-y-auto"> <!-- 输出内容 -->
              <template v-if="previewData !== null && previewData !== undefined">
                <MarkdownRenderer v-if="isMarkdownSlot && typeof previewData === 'string'"
                  :markdown-content="previewData" />
                <pre v-else-if="typeof previewData === 'object' || Array.isArray(previewData)"
                  class="text-xs whitespace-pre-wrap break-all">{{ JSON.stringify(previewData, null, 2) }}</pre>
                <p v-else class="text-xs whitespace-pre-wrap break-all">{{ String(previewData) }}</p>
              </template>
              <p v-else class="text-xs text-gray-500 dark:text-gray-400 italic">
                无可用预览数据或插槽未产生输出。
              </p>
            </div>
          </div>
        </div>
      </template>
      <template v-else>
        <p class="p-4 text-sm text-gray-500 dark:text-gray-400">
          无预览目标被选中。右键点击节点输出桩或连线以预览。
        </p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, type Ref, computed } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { useWorkflowManager } from '@/composables/workflow/useWorkflowManager';
import { useExecutionStore } from '@/stores/executionStore';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useNodeStore } from '@/stores/nodeStore';
import MarkdownRenderer from '@/components/common/MarkdownRenderer.vue';
import type { Node as VueFlowNode } from "@vue-flow/core"; // 导入 VueFlowNode
import type { OutputDefinition } from '@comfytavern/types'; // 修正：导入 OutputDefinition

const workflowManager = useWorkflowManager();
const executionStore = useExecutionStore();
const workflowStore = useWorkflowStore();
const nodeStore = useNodeStore();

const panelElementRef: Ref<HTMLElement | null> = ref(null);

const activeTarget = computed(() => workflowManager.activePreviewTarget.value);
const activeTabId = computed(() => workflowManager.activeTabId.value);

const previewData = computed(() => {
  if (!activeTarget.value || !activeTabId.value) return null;
  const { nodeId, slotKey } = activeTarget.value;
  const tabState = executionStore.tabExecutionStates.get(activeTabId.value);
  if (!tabState || !tabState.nodeOutputs || !tabState.nodeOutputs[nodeId]) {
    return null;
  }
  return tabState.nodeOutputs[nodeId]?.[slotKey] ?? null;
});

const activeNodeInstance = computed(() => {
  if (!activeTarget.value || !activeTabId.value) return null;
  const workflowData = workflowStore.getWorkflowData(activeTabId.value);
  return workflowData?.nodes.find((n: VueFlowNode) => n.id === activeTarget.value!.nodeId) || null;
});

const nodeDisplayName = computed(() => {
  if (!activeNodeInstance.value) return activeTarget.value?.nodeId || 'N/A';
  const node = activeNodeInstance.value;
  const fullType = node.data?.namespace ? `${node.data.namespace}:${node.type}` : node.type;
  const nodeDef = nodeStore.getNodeDefinitionByFullType(fullType);
  // 优先顺序: 用户自定义标签 (node.data.label) -> VueFlow 标签 (node.label) -> 节点定义显示名 (nodeDef.displayName) -> 节点类型 (node.type)
  return node.data?.label || node.label || nodeDef?.displayName || node.type;
});

const slotDisplayName = computed(() => {
  if (!activeNodeInstance.value || !activeTarget.value) return activeTarget.value?.slotKey || 'N/A';
  const node = activeNodeInstance.value;
  const slotKey = activeTarget.value.slotKey; // 这个 slotKey 就是 outputs Record 中的键
  const fullType = node.data?.namespace ? `${node.data.namespace}:${node.type}` : node.type;
  const nodeDef = nodeStore.getNodeDefinitionByFullType(fullType);
  const outputSlotDef: OutputDefinition | undefined = nodeDef?.outputs?.[slotKey]; // 直接通过 key 访问并添加类型注解
  // 优先顺序: 插槽定义显示名 (outputSlotDef.displayName) -> 插槽键 (slotKey)
  return outputSlotDef?.displayName || slotKey; // 使用 displayName
});

// 辅助函数判断内容是否可能是 Markdown
const isMarkdownSlot = computed(() => {
  if (!activeTarget.value) return false;
  // 启发式规则: 如果 slotKey 包含 'markdown'
  if (activeTarget.value.slotKey.toLowerCase().includes('markdown')) return true;

  // 检查插槽定义的类型（如果可用）
  const node = activeNodeInstance.value;
  if (node) {
    const slotKey = activeTarget.value.slotKey;
    const fullType = node.data?.namespace ? `${node.data.namespace}:${node.type}` : node.type;
    const nodeDef = nodeStore.getNodeDefinitionByFullType(fullType);
    const outputSlotDef: OutputDefinition | undefined = nodeDef?.outputs?.[slotKey]; // 直接通过 key 访问并添加类型注解
    // 假设 'markdown' 是一个明确的类型，检查 dataFlowType
    if (outputSlotDef?.dataFlowType && typeof outputSlotDef.dataFlowType === 'string' && outputSlotDef.dataFlowType.toLowerCase().includes('markdown')) return true;
  }
  return false;
});

const panelLayout = useLocalStorage('rightPreviewPanelLayout', {
  isExpanded: true,
  width: 300,
  height: 400,
  top: 100,
});

const wasDraggingHeader = ref(false); // 新增：用于判断是否正在拖拽头部

const togglePanelExpansion = () => {
  if (wasDraggingHeader.value) {
    // 如果刚刚是拖拽操作，则不切换展开状态，并重置标志
    // wasDraggingHeader.value = false; // 这个重置应该在 stopDragTop 或 mousedown 时处理
    return;
  }
  panelLayout.value.isExpanded = !panelLayout.value.isExpanded;
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
  panelElementRef.value?.classList.add('is-resizing');
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
  panelElementRef.value?.classList.remove('is-resizing');
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
  panelElementRef.value?.classList.add('is-resizing');
  document.addEventListener('mousemove', handleResizeHeight);
  document.addEventListener('mouseup', stopResizeHeight);
};

const handleResizeHeight = (event: MouseEvent) => {
  if (!isResizingHeight.value) return;
  const deltaY = event.clientY - initialMouseY.value;
  const newHeight = initialHeight.value + deltaY;
  const maxPanelHeight = window.innerHeight - panelLayout.value.top - 20;
  panelLayout.value.height = Math.max(150, Math.min(newHeight, maxPanelHeight));
};

const stopResizeHeight = () => {
  isResizingHeight.value = false;
  panelElementRef.value?.classList.remove('is-resizing');
  document.removeEventListener('mousemove', handleResizeHeight);
  document.removeEventListener('mouseup', stopResizeHeight);
};

// 停靠位置 (Top) 拖拽逻辑
const isDraggingTop = ref(false);
const initialMouseYTop = ref(0);
const initialTop = ref(0);

const startDragTop = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  isDraggingTop.value = true;
  initialMouseYTop.value = event.clientY;
  initialTop.value = panelLayout.value.top;
  wasDraggingHeader.value = false; // 每次开始拖动（或点击）头部时，重置拖拽标志
  document.addEventListener('mousemove', handleDragTop);
  document.addEventListener('mouseup', stopDragTop);
};

const handleDragTop = (event: MouseEvent) => {
  if (!isDraggingTop.value) return;
  const deltaY = event.clientY - initialMouseYTop.value;
  if (deltaY !== 0) { // 只有当实际发生拖动时才标记
    wasDraggingHeader.value = true;
  }
  const newTop = initialTop.value + deltaY;
  const minTop = 0;
  const maxTop = window.innerHeight - 40; // 40 是收起时的高度
  panelLayout.value.top = Math.max(minTop, Math.min(newTop, maxTop));
};

const stopDragTop = () => {
  isDraggingTop.value = false;
  document.removeEventListener('mousemove', handleDragTop);
  document.removeEventListener('mouseup', stopDragTop);
};

// 左下角拖拽逻辑 (同时调整宽度和高度)
const isResizingCorner = ref(false);
const initialMouseXCorner = ref(0);
const initialMouseYCorner = ref(0);
const initialWidthCorner = ref(0);
const initialHeightCorner = ref(0);

const startResizeCorner = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  isResizingCorner.value = true;
  initialMouseXCorner.value = event.clientX;
  initialMouseYCorner.value = event.clientY;
  initialWidthCorner.value = panelLayout.value.width;
  initialHeightCorner.value = panelLayout.value.height;
  panelElementRef.value?.classList.add('is-resizing');
  document.addEventListener('mousemove', handleResizeCorner);
  document.addEventListener('mouseup', stopResizeCorner);
};

const handleResizeCorner = (event: MouseEvent) => {
  if (!isResizingCorner.value) return;

  const deltaX = event.clientX - initialMouseXCorner.value;
  // 因为是从左边拖拽，所以 deltaX 增加时，宽度应该减少
  const newWidth = initialWidthCorner.value - deltaX;
  panelLayout.value.width = Math.max(200, Math.min(newWidth, 800));

  const deltaY = event.clientY - initialMouseYCorner.value;
  const newHeight = initialHeightCorner.value + deltaY;
  const maxPanelHeight = window.innerHeight - panelLayout.value.top - 20; // 20 是一个大致的底部边距
  panelLayout.value.height = Math.max(150, Math.min(newHeight, maxPanelHeight));
};

const stopResizeCorner = () => {
  isResizingCorner.value = false;
  panelElementRef.value?.classList.remove('is-resizing');
  document.removeEventListener('mousemove', handleResizeCorner);
  document.removeEventListener('mouseup', stopResizeCorner);
};

onUnmounted(() => {
  document.removeEventListener('mousemove', handleResizeWidth);
  document.removeEventListener('mouseup', stopResizeWidth);
  document.removeEventListener('mousemove', handleResizeHeight);
  document.removeEventListener('mouseup', stopResizeHeight);
  document.removeEventListener('mousemove', handleDragTop);
  document.removeEventListener('mouseup', stopDragTop);
  document.removeEventListener('mousemove', handleResizeCorner);
  document.removeEventListener('mouseup', stopResizeCorner);
});
</script>

<style scoped>
.right-preview-panel {
  @apply fixed right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg flex flex-col z-50 rounded-md;
  /* 添加圆角 */
  transition: width 0.3s ease-in-out, height 0.3s ease-in-out;
  /* 对宽度和高度应用过渡，实现展开收起动画 */
  overflow: hidden;
  /* 防止内容在收起时溢出 */
}

.right-preview-panel.is-expanded {
  @apply w-auto h-auto;
  /* 展开时移除边框，因为内部有 panel-header 的边框 */
  border: none;
  /* 展开时移除外层边框，因为 panel-header 有自己的边框 */
  border-top-left-radius: 0.375rem;
  /* 保持左上圆角 */
  border-bottom-left-radius: 0.375rem;
  /* 保持左下圆角 */
  border-top-right-radius: 0;
  /* 展开时右上角不需要圆角，因为它贴边 */
  border-bottom-right-radius: 0;
  /* 展开时右下角不需要圆角 */
}

/* 收起状态下的特定圆角，确保像一个独立的圆角图标按钮 */
.right-preview-panel:not(.is-expanded) {
  @apply rounded-md;
}

.right-preview-panel.is-resizing {
  transition: none !important;
  /* 拖拽时禁用所有过渡效果，确保即时响应 */
}

.resize-handle-width {
  @apply absolute top-0 left-0 w-3 h-full cursor-ew-resize z-50;
  /* 稍微加宽拖拽区域 */
}

.resize-handle-height {
  @apply absolute bottom-0 left-0 w-full h-3 cursor-ns-resize z-50;
  /* 稍微加高拖拽区域 */
}

.resize-handle-top {
  @apply absolute top-0 left-0 w-full h-3 cursor-ns-resize z-50 bg-transparent hover:bg-blue-300/30;
  /* 稍微加高拖拽区域 */
}

.resize-handle-corner {
  @apply absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize z-50 bg-gray-400 dark:bg-gray-600 opacity-0 hover:opacity-100 rounded-tr-md transition-opacity duration-150;
  /* 左下角控制点，平时透明，悬停时不透明，右上圆角 */
}

.panel-header {
  @apply flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0;
  cursor: grab;
  /* 整个头部都可以拖动 */
}

.panel-header.collapsed {
  @apply p-0 border-b-0 justify-center items-center;
  /* 收起时居中图标, 确保垂直也居中 */
  height: 100%;
  /* 确保按钮填满收起后的容器 */
  width: 100%;
  /* 确保按钮填满收起后的容器 */
}

.panel-title {
  @apply text-lg font-semibold text-gray-700 dark:text-gray-200;
}

.toggle-button {
  @apply p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md;
  /* 给按钮本身也加点圆角 */
  display: flex;
  /* 用于更好地控制SVG图标的对齐 */
  align-items: center;
  justify-content: center;
}

.panel-header.collapsed .toggle-button {
  @apply w-full h-full flex items-center justify-center rounded-md;
  /* 让图标在按钮内也居中，并保持圆角 */
}

.panel-content {
  @apply flex-grow p-0 overflow-y-auto;
}
</style>