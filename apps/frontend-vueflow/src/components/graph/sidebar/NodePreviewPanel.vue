<template>
  <div ref="panelRef" v-if="selectedNode" v-show="isSidebarVisible" class="node-preview-panel" :class="{ dark: isDark }"
    :style="panelStyle">
    <div class="details-header">
      <div class="details-title">{{ selectedNode.displayName || selectedNode.type }}</div>
      <button class="close-button" @click="closePanel">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"
          class="w-5 h-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <OverlayScrollbarsComponent
      :options="{ scrollbars: { autoHide: 'scroll', theme: isDark ? 'os-theme-light' : 'os-theme-dark' } }"
      class="details-content-scrollable flex-grow" defer>
      <!-- 添加节点类型显示 -->
      <div class="details-nodetype">
        {{ selectedNode.namespace ? `${selectedNode.namespace}:${selectedNode.type}` : selectedNode.type }}
      </div>
      <div v-if="selectedNode.description" class="details-description">
        <MarkdownRenderer :markdown-content="selectedNode.description" />
      </div>

      <div v-if="selectedNode.inputs && Object.keys(selectedNode.inputs).length > 0" class="details-section">
        <div class="details-section-title">输入参数</div>
        <div v-for="(input, key) in selectedNode.inputs" :key="`input-${key}`" class="details-param">
          <div class="param-header">
            <!-- 优先使用 displayName，然后是 key -->
            <div class="param-name">{{ input.displayName || key }}</div>
            <div class="param-type">{{ input.dataFlowType }}</div>
          </div>
          <!-- 如果 description 存在，则显示 -->
          <div v-if="input.description" class="param-description">
            <MarkdownRenderer :markdown-content="input.description" />
          </div>
        </div>
      </div>

      <div v-if="selectedNode.outputs && Object.keys(selectedNode.outputs).length > 0" class="details-section">
        <div class="details-section-title">输出参数</div>
        <div v-for="(output, key) in selectedNode.outputs" :key="`output-${key}`" class="details-param">
          <div class="param-header">
            <!-- 优先使用 displayName，然后是 key -->
            <div class="param-name">{{ output.displayName || key }}</div>
            <div class="param-type">{{ output.dataFlowType }}</div>
          </div>
          <!-- 如果 description 存在，则显示 -->
          <div v-if="output.description" class="param-description">
            <MarkdownRenderer :markdown-content="output.description" />
          </div>
        </div>
      </div>

      <!-- 特别为 NodeGroup 显示工作流选择器信息 -->
      <!-- Roo: 使用带命名空间的类型 -->
      <div v-if="selectedNode.type === 'core:NodeGroup'" class="details-section">
        <div class="details-section-title">内部组件</div>
        <div class="details-param">
          <div class="param-header">
            <div class="param-name">工作流选择器</div>
            <!-- 可以添加一个虚拟类型 -->
            <!-- <div class="param-type">Component</div> -->
          </div>
          <div class="param-description">选择要在此节点组中实例化的工作流。</div>
        </div>
      </div>
    </OverlayScrollbarsComponent>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue"; // 移除未使用的 nextTick
import type { FrontendNodeDefinition } from "../../../stores/nodeStore"; // 确保路径正确
import { useThemeStore } from "../../../stores/theme"; // 确保路径正确
import { storeToRefs } from "pinia";
import MarkdownRenderer from "../../common/MarkdownRenderer.vue"; // 导入 Markdown 渲染器
import { OverlayScrollbarsComponent } from "overlayscrollbars-vue";
import 'overlayscrollbars/overlayscrollbars.css';

defineProps<{
  selectedNode: FrontendNodeDefinition | null;
  isSidebarVisible: boolean; // 添加 prop 来控制可见性
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const themeStore = useThemeStore();
const { isDark } = storeToRefs(themeStore);

const panelRef = ref<HTMLElement | null>(null); // 引用面板元素
const panelLeft = ref<number | null>(null); // 存储计算出的 left 值
let resizeObserver: ResizeObserver | null = null; // 存储 ResizeObserver 实例

// 计算内联样式
const panelStyle = computed(() => {
  if (panelLeft.value !== null) {
    return { left: `${panelLeft.value}px` };
  }
  return {}; // 默认或回退样式
});

// 计算面板位置的函数
const calculatePosition = () => {
  const sidebarManagerElement = document.querySelector(".sidebar-manager") as HTMLElement; // 查找侧边栏管理器
  if (sidebarManagerElement) {
    const sidebarWidth = sidebarManagerElement.offsetWidth;
    const margin = 16; // 1rem 间距 (对应 Tailwind space-4)
    panelLeft.value = sidebarWidth + margin;
  } else {
    // 如果找不到侧边栏管理器，尝试找节点库面板
    const nodePanelElement = document.querySelector(".node-panel") as HTMLElement;
    if (nodePanelElement) {
      const nodePanelWidth = nodePanelElement.offsetWidth;
      panelLeft.value = nodePanelWidth + 16;
    } else {
      // 如果都找不到，这不应该发生，因为组件现在只在侧边栏就绪后挂载
      // 记录一个更严重的错误
      console.error(
        "NodePreviewPanel: calculatePosition called but SidebarManager or NodePanel not found. This should not happen."
      );
      panelLeft.value = 16; // 保留一个回退值以防万一
    }
  }
};

onMounted(() => {
  // 现在组件只在侧边栏就绪后挂载，可以直接计算位置和设置监听器
  calculatePosition(); // 初始计算位置

  // 查找参考元素用于 ResizeObserver
  const sidebarManagerElement = document.querySelector(".sidebar-manager");
  const nodePanelElement = document.querySelector(".node-panel");
  const elementToObserve = sidebarManagerElement || nodePanelElement; // 优先使用 SidebarManager

  if (elementToObserve) {
    resizeObserver = new ResizeObserver(() => {
      calculatePosition(); // 尺寸变化时重新计算
    });
    resizeObserver.observe(elementToObserve);
  } else {
    // 这仍然不应该发生，但保留一个警告
    console.error(
      "NodePreviewPanel: Failed to find .sidebar-manager or .node-panel for ResizeObserver even after delayed mount."
    );
  }
});

onUnmounted(() => {
  // 组件卸载时停止监听
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

const closePanel = () => {
  emit("close");
};
</script>

<style scoped>
.node-preview-panel {
  /* 移除 left-4 */
  @apply fixed top-20 z-50 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col;
  max-height: calc(100vh - 10rem);
  /* 限制最大高度，留出上下边距 */
}

.details-header {
  @apply flex justify-between items-center py-1 px-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0;
  /* 防止头部被压缩 */
}

.details-title {
  @apply font-medium text-gray-800 dark:text-gray-200 truncate;
  /* 防止标题过长 */
}

.close-button {
  @apply text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 ml-2 flex items-center justify-center p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700;
  /* 移除 text-3xl, 添加 flex 居中和一些内边距/圆角/悬停效果 */
  /* 增加左边距 */
}

/* .details-content is now the wrapper inside OverlayScrollbarsComponent */
.details-content-scrollable {
  @apply p-4;
  /* Keep padding */
  /* flex-grow is applied directly to the component */
}

.details-nodetype {
  @apply text-xs text-gray-500 dark:text-gray-400 mb-2 font-mono px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded inline-block;
  /* 添加样式 */
}

.details-description {
  @apply text-sm text-gray-600 dark:text-gray-400 mb-4;
}

.details-section {
  @apply mb-4;
}

.details-section-title {
  @apply text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider;
  /* 调整样式 */
}

.details-param {
  @apply mb-2 p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600;
  /* 调整背景色 */
}

.param-header {
  @apply flex justify-between items-center mb-1;
}

.param-name {
  @apply text-sm font-medium text-gray-700 dark:text-gray-200;
}

.param-type {
  @apply text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded;
}

.param-description {
  @apply text-xs text-gray-500 dark:text-gray-400 mt-1;
  /* 增加上边距 */
}
</style>
