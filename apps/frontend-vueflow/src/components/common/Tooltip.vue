<template>
  <!-- 触发 Tooltip 的元素容器 -->
  <div ref="referenceRef" :class="triggerClass">
    <slot />
  </div>
  <!-- 将 Tooltip 内容传送到 body，避免父元素的样式影响 -->
  <Teleport to="body">
    <div
      v-if="isTooltipVisible"
      ref="floatingRef"
      :style="[floatingStyles, { width: computedWidth, maxWidth: computedMaxWidth }]"
      :class="[
        'tooltip-content rounded shadow-lg border relative', // 添加 relative 定位以支持复制按钮定位
        isDark
          ? 'bg-gray-700 text-gray-100 border-gray-600' // 暗色模式样式
          : 'bg-white text-gray-900 border-gray-300', // 亮色模式样式
      ]"
      style="z-index: 100; overflow: hidden"
    >
      <!-- 复制按钮 -->
      <div class="relative">
        <button
          v-if="props.showCopyButton && (content || $slots.content)"
          class="copy-button absolute right-1 top-1 p-1 rounded-md hover:bg-opacity-10 hover:bg-gray-500 transition-colors group"
          @click="copyContent"
          style="z-index: 101; pointer-events: auto"
        >
          <svg
            class="w-4 h-4"
            :class="isDark ? 'text-gray-300' : 'text-gray-600'"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              v-if="!copySuccess"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
            <path
              v-else
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
          <!-- 自定义提示 -->
          <div
            class="absolute right-full top-1/2 transform -translate-y-1/2 mr-2 px-2 py-1 rounded text-xs whitespace-nowrap transition-all duration-200 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
            :class="isDark ? 'bg-gray-600 text-gray-100' : 'bg-gray-200 text-gray-800'"
          >
            {{ copyButtonTitle }}
          </div>
        </button>
      </div>

      <OverlayScrollbarsComponent
        :options="{
          scrollbars: { autoHide: 'scroll', theme: isDark ? 'os-theme-light' : 'os-theme-dark' },
          overflow: { y: 'scroll' }, // 始终允许垂直滚动
          paddingAbsolute: true, // 让内边距作用于滚动内容而非滚动条本身
        }"
        :style="{ maxHeight: computedMaxHeight }"
        class="p-2"
        defer
      >
        <!-- Tooltip 内容插槽，优先使用插槽内容，否则显示 content prop -->
        <slot name="content">
          <!-- 如果插槽没有提供内容，并且 content prop 有值，则使用 MarkdownRenderer 渲染 -->
          <MarkdownRenderer v-if="content" :markdown-content="content" />
        </slot>
      </OverlayScrollbarsComponent>
      <!-- 移除了箭头元素以简化并修复定位问题 -->
    </div>
  </Teleport>
</template>

<script lang="ts">
// 显式设置 inheritAttrs 为 false，以避免 Vue 在 Teleport 根节点上尝试继承属性而发出警告
export default {
  inheritAttrs: false,
};
</script>

<script setup lang="ts">
/**
 * @file 通用 Tooltip 组件
 * @description 基于 @floating-ui/vue 实现，提供悬停触发的提示信息。
 * @param {string} [content] - Tooltip 显示的文本内容 (如果未使用 content 插槽)。
 * @param {Placement} [placement='top'] - Tooltip 的位置 (来自 @floating-ui)。
 * @param {number} [offsetValue=12] - Tooltip 相对于触发元素的偏移量。
 * @param {number} [showDelay=150] - 显示 Tooltip 的延迟时间 (毫秒)。
 * @param {number} [hideDelay=100] - 隐藏 Tooltip 的延迟时间 (毫秒)。
 * @param {string | number} [width='auto'] - Tooltip 的宽度，可以是数字 (px) 或字符串 (e.g., '200px', 'auto')。
 * @param {string | number} [maxWidth] - Tooltip 的最大宽度，可以是数字 (px) 或字符串 (e.g., '300px')。
 * @param {string | Array<string> | Record<string, boolean>} [triggerClass=''] - 应用于触发器容器 div 的 CSS 类。
 * @param {boolean} [showCopyButton=false] - 是否显示复制按钮。
 * @param {boolean} [interactive=true] - Tooltip 是否可交互 (允许鼠标悬停在 Tooltip 内容上)。
 */
import { ref, computed, watch, onMounted, onUnmounted } from "vue"; // 添加 onMounted
import { useWindowSize, useEventListener } from "@vueuse/core"; // 导入 useWindowSize 和 useEventListener
import {
  useFloating,
  offset,
  flip,
  shift,
  // arrow, // 移除了箭头中间件
  autoUpdate,
  type Placement,
} from "@floating-ui/vue";
import { useElementHover } from "@vueuse/core"; // 保留用于 floatingRef
import { useThemeStore } from "@/stores/theme";
import { storeToRefs } from "pinia";
import MarkdownRenderer from "./MarkdownRenderer.vue";
import { OverlayScrollbarsComponent } from "overlayscrollbars-vue"; // 导入滚动条组件
import "overlayscrollbars/overlayscrollbars.css"; // 导入滚动条 CSS

interface Props {
  /** Tooltip 显示的文本内容 (如果未使用 content 插槽) */
  content?: string;
  /** Tooltip 的位置 (来自 @floating-ui) */
  placement?: Placement;
  /** Tooltip 相对于触发元素的偏移量 */
  offsetValue?: number;
  /** 显示 Tooltip 的延迟时间 (毫秒) */
  showDelay?: number;
  /** 隐藏 Tooltip 的延迟时间 (毫秒) */
  hideDelay?: number;
  /** Tooltip 的宽度，可以是数字 (px) 或字符串 (e.g., '200px', 'auto') */
  width?: string | number;
  /** Tooltip 的最大宽度，可以是数字 (px) 或字符串 (e.g., '300px') */
  maxWidth?: string | number;
  /** 应用于触发器容器 div 的 CSS 类 */
  triggerClass?: string | Array<string> | Record<string, boolean>;
  /** 是否显示复制按钮 */
  showCopyButton?: boolean;
  /** Tooltip 是否可交互 (允许鼠标悬停在 Tooltip 内容上) */
  interactive?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  placement: "top",
  offsetValue: 12,
  showDelay: 150,
  hideDelay: 100,
  width: "auto", // 设置默认宽度为 auto
  maxWidth: undefined, // 默认不限制最大宽度
  triggerClass: "", // 默认触发器类为空
  showCopyButton: false, // 默认不显示复制按钮
  interactive: false, // 默认 Tooltip 不可交互
});

// 触发 Tooltip 的 DOM 元素引用
const referenceRef = ref<HTMLElement | null>(null);
// Tooltip 浮动内容的 DOM 元素引用
const floatingRef = ref<HTMLElement | null>(null);
// --- 悬停与显示/隐藏逻辑 ---
const isTooltipVisible = ref(false);
const isReferenceHovered = ref(false); // 手动跟踪 referenceRef 的悬停状态

// 使用 @vueuse/core 检测浮动元素 (Tooltip 内容) 是否悬停 (仅当 interactive 为 true 时相关)
const isFloatingHovered = useElementHover(floatingRef, {
  delayEnter: 0, // 进入 Tooltip 内容本身不需要延迟
  delayLeave: props.hideDelay, // 离开时使用相同的延迟
});

// 用于控制显示延迟的 Timeout ID
let showTimeout: ReturnType<typeof setTimeout> | null = null;
// 用于控制隐藏延迟的 Timeout ID
let hideTimeout: ReturnType<typeof setTimeout> | null = null;
// 用于鼠标静止检测的 Timeout ID
let stillnessTimeout: ReturnType<typeof setTimeout> | null = null;
const stillnessDelay = 75; // 鼠标静止检测延迟 (毫秒)

// --- 主题集成 ---
const themeStore = useThemeStore();
const { isDark } = storeToRefs(themeStore); // 获取 isDark 状态
// --- 主题集成结束 ---

// --- 视口尺寸与最大高度 ---
const { height: windowHeight } = useWindowSize(); // 获取窗口高度
const computedMaxHeight = computed(() => {
  // 设置最大高度为视口高度的 50%，或者一个最小像素值，防止过小
  const calculatedHeight = windowHeight.value * 0.5;
  return `${Math.max(calculatedHeight, 100)}px`; // 至少 100px 高
});
// --- 视口尺寸与最大高度结束 ---

// 计算最终应用的宽度样式
const computedWidth = computed(() => {
  if (props.width === undefined) return undefined;
  return typeof props.width === "number" ? `${props.width}px` : props.width;
});

// 计算最终应用的最大宽度样式
const computedMaxWidth = computed(() => {
  if (props.maxWidth === undefined || props.maxWidth === null) return undefined;
  return typeof props.maxWidth === "number" ? `${props.maxWidth}px` : props.maxWidth;
});
// 复制功能相关的状态
const copySuccess = ref(false);
const copyButtonTitle = computed(() => (copySuccess.value ? "复制成功" : "复制内容"));

// 复制内容到剪贴板
const copyContent = async () => {
  try {
    let textToCopy = "";

    // 如果有 content prop，直接使用
    if (props.content) {
      textToCopy = props.content;
    }
    // 否则尝试获取 slot 内容
    else if (floatingRef.value) {
      // 获取实际渲染的文本内容
      textToCopy = floatingRef.value.textContent || "";
    }

    await navigator.clipboard.writeText(textToCopy);

    // 显示成功状态
    copySuccess.value = true;

    // 2.5秒后重置状态
    setTimeout(() => {
      copySuccess.value = false;
    }, 2500);
  } catch (err) {
    console.error("复制失败:", err);
  }
};

// --- 事件处理 ---

const clearTimeouts = () => {
  if (stillnessTimeout) clearTimeout(stillnessTimeout);
  if (showTimeout) clearTimeout(showTimeout);
  if (hideTimeout) clearTimeout(hideTimeout);
  stillnessTimeout = null;
  showTimeout = null;
  hideTimeout = null;
};

const startShowTimer = () => {
  clearTimeouts();
  showTimeout = setTimeout(() => {
    isTooltipVisible.value = true;
    showTimeout = null;
  }, props.showDelay);
};

const startHideTimer = () => {
  clearTimeouts();
  hideTimeout = setTimeout(() => {
    isTooltipVisible.value = false;
    hideTimeout = null;
  }, props.hideDelay);
};

const handleMouseEnter = (event: MouseEvent) => {
  // 如果鼠标左键按下 (可能在拖拽)，则不处理悬停进入
  if (event.buttons === 1) {
    return;
  }
  isReferenceHovered.value = true;
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
  // 启动静止检测计时器
  if (stillnessTimeout) clearTimeout(stillnessTimeout);
  stillnessTimeout = setTimeout(() => {
    // 静止时间达到，启动显示计时器
    if (!isTooltipVisible.value && !showTimeout) {
      startShowTimer();
    }
    stillnessTimeout = null;
  }, stillnessDelay);
};

const handleMouseMove = (event: MouseEvent) => {
  // 如果鼠标左键按下 (可能在拖拽)，则不处理移动重置
  if (event.buttons === 1) {
    // 如果因为拖拽导致 tooltip 意外显示了，离开时需要能隐藏，所以这里清除一下显示相关的 timer
    if (stillnessTimeout) clearTimeout(stillnessTimeout);
    if (showTimeout) clearTimeout(showTimeout);
    stillnessTimeout = null;
    showTimeout = null;
    return;
  }
  // 鼠标移动时重置静止检测计时器 (仅当鼠标在元素内且左键未按下)
  if (isReferenceHovered.value) {
    if (stillnessTimeout) clearTimeout(stillnessTimeout);
    stillnessTimeout = setTimeout(() => {
      if (!isTooltipVisible.value && !showTimeout) {
        startShowTimer();
      }
      stillnessTimeout = null;
    }, stillnessDelay);
  }
};

const handleMouseLeave = () => {
  isReferenceHovered.value = false;
  // 清除所有可能触发显示的计时器
  if (stillnessTimeout) clearTimeout(stillnessTimeout);
  if (showTimeout) clearTimeout(showTimeout);
  stillnessTimeout = null;
  showTimeout = null;

  // 如果 Tooltip 当前可见，并且鼠标没有悬停在浮动内容上 (或者不允许交互)
  // 则启动隐藏计时器
  if (isTooltipVisible.value && !hideTimeout) {
    if (!props.interactive || !isFloatingHovered.value) {
      startHideTimer();
    }
  }
};

// 监听浮动元素的悬停状态变化 (仅当 interactive 为 true 时)
watch(isFloatingHovered, (hovering) => {
  if (!props.interactive) return;

  if (hovering) {
    // 进入浮动元素，清除隐藏计时器
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
  } else {
    // 离开浮动元素，如果鼠标也不在触发器上，则启动隐藏计时器
    if (isTooltipVisible.value && !isReferenceHovered.value && !hideTimeout) {
      startHideTimer();
    }
  }
});

// --- 生命周期钩子 ---

onMounted(() => {
  if (referenceRef.value) {
    useEventListener(referenceRef.value, "mouseenter", handleMouseEnter);
    useEventListener(referenceRef.value, "mousemove", handleMouseMove);
    useEventListener(referenceRef.value, "mouseleave", handleMouseLeave);
  }
});

/**
 * @floating-ui 中间件配置。
 * @property {Function} offset - 控制浮动元素与参考元素的距离。
 * @property {Function} flip - 当空间不足时，自动翻转浮动元素的位置。
 * @property {Function} shift - 当浮动元素部分移出视口时，自动调整其位置。
 */
const middleware = computed(() => [
  offset(props.offsetValue), // 应用偏移量
  flip(),
  shift({ padding: 5 }), // 添加内边距，防止 Tooltip 紧贴边缘
  // arrow({ element: arrowRef }), // 移除了箭头中间件
]);

// 使用 @floating-ui/vue 的 useFloating 钩子计算浮动元素的动态样式
const { floatingStyles } = useFloating(
  referenceRef, // 触发 Tooltip 的参考元素
  floatingRef, // Tooltip 内容的浮动元素
  {
    // 动态计算 placement
    placement: computed(() => props.placement),
    // 当元素挂载时，自动更新位置
    whileElementsMounted: autoUpdate,
    // 应用上面定义的中间件
    middleware,
  }
);


// 组件卸载时清除所有待处理的计时器和事件监听器
onUnmounted(() => {
  clearTimeouts();
  // useEventListener 会自动清理监听器，无需手动移除
});
// --- 生命周期钩子结束 ---


</script>

<style scoped>
.tooltip-content {
  /* 移除 pointer-events: none; 以允许 Tooltip 接收悬停事件 */
  /* Markdown 样式现在由 MarkdownRenderer 组件处理 */
}

.copy-button {
  opacity: 0.6;
  pointer-events: auto;
}

.copy-button:hover {
  opacity: 1;
}

/* 提示动画 */
.copy-button .absolute {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

/* 移除了 .tooltip-arrow 相关样式 */
/* 移除了 Markdown 相关样式 */
</style>
