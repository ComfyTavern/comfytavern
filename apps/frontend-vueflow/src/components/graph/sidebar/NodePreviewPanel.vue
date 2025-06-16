<template>
  <div ref="panelRef" v-if="selectedNode" v-show="isSidebarVisible" class="node-preview-panel"
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
            <div class="param-name">{{ input.displayName || key }}</div>
            <div class="param-type">{{ input.dataFlowType }}</div>
          </div>
          <div v-if="input.matchCategories && input.matchCategories.length > 0" class="param-categories">
            <span v-for="category in input.matchCategories" :key="`input-${key}-${category}`" class="category-tag">
              {{ category }}
            </span>
          </div>
          <div v-if="input.description" class="param-description">
            <MarkdownRenderer :markdown-content="input.description" />
          </div>
        </div>
      </div>

      <div v-if="selectedNode.outputs && Object.keys(selectedNode.outputs).length > 0" class="details-section">
        <div class="details-section-title">输出参数</div>
        <div v-for="(output, key) in selectedNode.outputs" :key="`output-${key}`" class="details-param">
          <div class="param-header">
            <div class="param-name">{{ output.displayName || key }}</div>
            <div class="param-type">{{ output.dataFlowType }}</div>
          </div>
          <div v-if="output.matchCategories && output.matchCategories.length > 0" class="param-categories">
            <span v-for="category in output.matchCategories" :key="`output-${key}-${category}`" class="category-tag">
              {{ category }}
            </span>
          </div>
          <div v-if="output.description" class="param-description">
            <MarkdownRenderer :markdown-content="output.description" />
          </div>
        </div>
      </div>

      <!-- 节点配置项预览区域 -->
      <div v-if="selectedNode.configSchema && Object.keys(selectedNode.configSchema).length > 0"
        class="details-section">
        <div class="details-section-title">配置项</div>
        <div v-for="configKey in Object.keys(selectedNode.configSchema)" :key="`config-${configKey}`">
          <div v-if="selectedNode.configSchema && selectedNode.configSchema[configKey]" class="details-param">
            <div class="param-header">
              <div class="param-name">{{ selectedNode.configSchema[configKey]!.displayName || configKey }}</div>
              <div class="param-type">{{ selectedNode.configSchema[configKey]!.dataFlowType }}</div>
            </div>
            <div v-if="selectedNode.configSchema[configKey]!.description" class="param-description">
              <MarkdownRenderer :markdown-content="selectedNode.configSchema[configKey]!.description!" />
            </div>
            <div
              v-if="selectedNode.configSchema[configKey]!.matchCategories && selectedNode.configSchema[configKey]!.matchCategories!.length > 0"
              class="param-categories">
              <span v-for="category in selectedNode.configSchema[configKey]!.matchCategories"
                :key="`config-${configKey}-${category}`" class="category-tag">
                {{ category }}
              </span>
            </div>
            <!-- 显示配置项的接受类型或占位符 -->
            <div
              v-if="selectedNode.configSchema[configKey]!.config?.acceptedTypes && selectedNode.configSchema[configKey]!.config!.acceptedTypes!.length > 0"
              class="param-value-preview mt-1">
              <span class="text-xs text-text-muted mr-1">接受类型:</span>
              <span v-for="accType in selectedNode.configSchema[configKey]!.config!.acceptedTypes" :key="accType.value"
                class="category-tag !bg-success/20 !text-success mr-1"> 
                {{ accType.label || accType.value }}
              </span>
            </div>
            <div v-else-if="selectedNode.configSchema[configKey]!.config?.placeholder" class="param-value-preview mt-1">
              <span class="text-xs text-text-muted">占位提示: </span>
              <span class="text-xs italic p-1 text-text-muted"> 
                {{ selectedNode.configSchema[configKey]!.config?.placeholder }}
              </span>
            </div>
          </div>
        </div>
      </div>

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
import { ref, computed, onMounted, onUnmounted } from "vue";
import type { FrontendNodeDefinition } from "../../../stores/nodeStore"; // 确保路径正确
// import type { InputDefinition } from "@comfytavern/types"; // InputDefinition 未在此处直接使用，移除以避免警告
import { useThemeStore } from "../../../stores/theme"; // 确保路径正确
// import { storeToRefs } from "pinia"; // storeToRefs is not used
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
const isDark = computed(() => themeStore.currentAppliedMode === 'dark');

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

// InputDefinition 类型现在已从 @comfytavern/types 导入，如果需要可以在这里使用
// 例如，如果需要访问 configDef.config.acceptedTypes 的具体类型
// const configDef = selectedNode.value?.configSchema?.[configKey] as InputDefinition | undefined;
</script>

<style scoped>
.node-preview-panel {
  /* 移除 left-4 */
  @apply fixed top-20 z-[55] w-80 bg-background-surface rounded-lg shadow-lg border border-border-base flex flex-col;
  max-height: calc(100vh - 10rem);
  /* 限制最大高度，留出上下边距 */
}

.details-header {
  @apply flex justify-between items-center py-1 px-3 border-b border-border-base flex-shrink-0;
  /* 防止头部被压缩 */
}

.details-title {
  @apply font-medium text-text-base truncate; /* text-text-strong -> text-text-base */
  /* 防止标题过长 */
}

.close-button {
  @apply text-text-muted hover:text-text-base ml-2 flex items-center justify-center p-1 rounded hover:bg-neutral-softest; /* text-text-icon -> text-text-muted, hover:text-text-icon-hover -> hover:text-text-base, hover:bg-background-hover -> hover:bg-neutral/10 */
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
  @apply text-xs text-text-muted mb-2 font-mono px-1 py-0.5 bg-neutral-soft rounded inline-block; /* bg-background-neutral-soft -> bg-neutral/20 */
  /* 添加样式 */
}

.details-description {
  @apply text-sm text-text-base mb-4; /* text-text-default -> text-text-base */
}

.details-section {
  @apply mb-4;
}

.details-section-title {
  @apply text-xs font-medium text-text-secondary uppercase mb-2 tracking-wider; /* text-text-label-uppercase -> text-text-secondary uppercase */
  /* 调整样式 */
}

.details-param {
  @apply mb-2 p-2 bg-background-base rounded border border-neutral-soft; /* bg-background-inset -> bg-background-base, border-border-neutral-soft -> border-neutral/30 */
  /* 调整背景色 */
}

.param-header {
  @apply flex justify-between items-center mb-1;
}

.param-name {
  @apply text-sm font-medium text-text-base; /* text-text-default -> text-text-base */
}

.param-type {
  @apply text-xs px-1.5 py-0.5 bg-primary-soft text-primary rounded; /* bg-primary-soft text-primary-strong -> bg-primary/20 text-primary */
}

.param-description {
  @apply text-xs text-text-muted mt-1;
  /* 增加上边距 */
}

.param-categories {
  @apply mt-1 flex flex-wrap gap-1;
  /* 参数的类别标签容器 */
}

.category-tag {
  @apply text-xs px-1.5 py-0.5 bg-neutral-soft text-neutral rounded-md; /* bg-background-badge text-text-badge -> bg-neutral/20 text-neutral */
  /* 类别标签样式 */
}
</style>
