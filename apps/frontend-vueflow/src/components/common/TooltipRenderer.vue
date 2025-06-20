<template>
  <Teleport to="body">
    <Transition name="tooltip-fade">
      <div
        v-if="tooltipStore.isVisible"
        ref="floatingRendererRef"
        :style="[
          tooltipStore.floatingStyles,
          {
            width: computedWidth,
            maxWidth: computedMaxWidth,
            zIndex: 10000, // 确保在最上层
          },
        ]"
        :class="[
          'comfy-tooltip-renderer fixed shadow-lg rounded-md',
          'bg-[hsl(var(--ct-background-surface-hsl))] text-[hsl(var(--ct-text-base-hsl))] border border-[hsl(var(--ct-border-base-hsl))]',
          tooltipStore.options.customClass,
        ]"
        role="tooltip"
        :id="tooltipId"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
      >
        <!-- 复制按钮 -->
        <div v-if="tooltipStore.options.showCopyButton && tooltipStore.content" class="relative">
          <button
            class="copy-button absolute right-1 top-1 p-1 rounded-md hover:bg-neutral-softest transition-colors group"
            style="z-index: 101; pointer-events: auto"
            @click="copyContentToClipboard"
            type="button"
          >
            <svg class="w-4 h-4 text-[hsl(var(--ct-text-muted-hsl))]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path v-if="!copySuccess" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <div
              class="absolute right-full top-1/2 transform -translate-y-1/2 mr-2 px-2 py-1 rounded text-xs whitespace-nowrap transition-all duration-200 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
              :class="['bg-[hsl(var(--ct-background-base-hsl))] text-[hsl(var(--ct-text-secondary-hsl))]']"
            >
              {{ copyButtonTitle }}
            </div>
          </button>
        </div>

        <OverlayScrollbarsComponent
          :options="{
            scrollbars: { autoHide: 'scroll', theme: isDark ? 'os-theme-light' : 'os-theme-dark' },
            overflow: { y: 'scroll' },
            paddingAbsolute: true,
          }"
          :style="{ maxHeight: computedMaxHeight }"
          class="p-2"
          defer
        >
          <!-- 优先渲染结构化内容，然后是 Markdown -->
          <!-- TODO: 增加对结构化内容的处理 (来自阶段三的计划) -->
          <MarkdownRenderer v-if="typeof tooltipStore.content === 'string'" :markdown-content="tooltipStore.content" />
          <!-- 否则，如果 content 是一个 VNode 或组件定义 (未来扩展) -->
          <!-- <component :is="tooltipStore.content" v-else-if="isVNode(tooltipStore.content) || typeof tooltipStore.content === 'object'"/> -->
        </OverlayScrollbarsComponent>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, getCurrentInstance } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTooltipStore } from '@/stores/tooltipStore';
import { useThemeStore } from '@/stores/theme';
import { storeToRefs } from 'pinia';
import { useWindowSize, isClient } from '@vueuse/core';
import MarkdownRenderer from './MarkdownRenderer.vue'; // 假设路径正确
import { OverlayScrollbarsComponent } from 'overlayscrollbars-vue';
import 'overlayscrollbars/overlayscrollbars.css';

const tooltipStore = useTooltipStore();
const themeStore = useThemeStore();
const { currentAppliedMode } = storeToRefs(themeStore);
const isDark = computed(() => currentAppliedMode.value === 'dark');

const floatingRendererRef = ref<HTMLElement | null>(null);
const { t } = useI18n();
const copySuccess = ref(false);
const copyButtonTitle = computed(() => (copySuccess.value ? t('tooltip.copySuccess') : t('tooltip.copyContent')));

// 生成一个唯一的 ID，用于 ARIA
const instance = getCurrentInstance();
const tooltipId = computed(() => `comfy-tooltip-${instance?.uid || Math.random().toString(36).slice(2, 7)}`);


// 将渲染器 DOM 元素设置到 store 中，以便 @floating-ui 计算位置
watch(floatingRendererRef, (newEl) => {
  tooltipStore.setFloatingElement(newEl);
});

onMounted(() => {
  if (floatingRendererRef.value) {
    tooltipStore.setFloatingElement(floatingRendererRef.value);
    // 初始显示时，可能需要强制更新一次位置，因为元素刚挂载
    // 但 autoUpdate 应该会处理这个
  }
});

onUnmounted(() => {
  tooltipStore.setFloatingElement(null);
});


const { height: windowHeight } = useWindowSize();
const computedMaxHeight = computed(() => {
  if (!isClient) return '50vh'; // SSR 默认值
  const calculatedHeight = windowHeight.value * 0.7; // 允许更高一些
  return `${Math.max(calculatedHeight, 150)}px`; // 至少 150px 高
});

const computedWidth = computed(() => {
  const widthOpt = tooltipStore.options.width; // 使用独立的 width 选项
  if (widthOpt === undefined) return 'auto'; // 如果 width 未定义，则默认为 'auto'
  return typeof widthOpt === 'number' ? `${widthOpt}px` : widthOpt;
});

const computedMaxWidth = computed(() => {
  const maxWidthOpt = tooltipStore.options.maxWidth;
  if (maxWidthOpt === undefined || maxWidthOpt === null) return undefined; // 默认无最大宽度限制
  return typeof maxWidthOpt === 'number' ? `${maxWidthOpt}px` : maxWidthOpt;
});

const copyContentToClipboard = async () => {
  if (!tooltipStore.content) return;
  try {
    // 假设 content 总是字符串
    await navigator.clipboard.writeText(tooltipStore.content as string);
    copySuccess.value = true;
    setTimeout(() => {
      copySuccess.value = false;
    }, 2500);
  } catch (err) {
    console.error(t('tooltip.copyFailed', { error: err }));
  }
};

const handleMouseEnter = () => {
  if (tooltipStore.options.interactive) {
    // 如果 Tooltip 是可交互的，当鼠标进入 Tooltip 时，清除可能由指令触发的隐藏计时器
    tooltipStore.clearTimeouts(); // 尤其是 hideTimeout
  }
};

const handleMouseLeave = () => {
  if (tooltipStore.options.interactive) {
    // 如果 Tooltip 是可交互的，当鼠标离开 Tooltip 时，启动隐藏计时器
    // （与指令离开目标元素时的行为一致）
    tooltipStore.hide(); // hide 方法内部会处理 delayHide
  }
};

</script>

<style scoped>
.comfy-tooltip-renderer {
  /* 基本样式 */
  overflow: hidden; /* 防止内容溢出外部容器 */
}

.copy-button {
  opacity: 0.6;
  pointer-events: auto;
}

.copy-button:hover {
  opacity: 1;
}

.copy-button .absolute {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

/* 过渡动画 */
.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.2s ease;
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
}
</style>