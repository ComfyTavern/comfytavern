<template>
  <!-- Teleport to="body" 已移除 -->
  <!-- ********* 核心修改： 移除了 v-if="visible" ********* -->
  <!-- 让组件的生命周期由父组件的 v-for 和 TransitionGroup 控制，内部只控制动画class -->
  <div class="transition-all duration-300 flex items-center" :style="{ zIndex: 9999 }" :class="[
    /* positionClasses 已移除，由 DialogContainer 控制 */
    { 'opacity-0 translate-y-4': !showContent, 'opacity-100 translate-y-0': showContent }
  ]" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
    <div class="max-w-md w-full shadow-lg rounded-lg pointer-events-auto overflow-hidden" :class="[
      typeClasses,
      { 'ring-1': !isDark }
    ]">
      <div class="p-4">
        <div class="flex items-start">
          <!-- 图标 -->
          <div class="flex-shrink-0">
            <!-- 成功图标 -->
            <svg v-if="type === 'success'" class="h-6 w-6 text-success" xmlns="http://www.w3.org/2000/svg" fill="none"
              viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>

            <!-- 错误图标 -->
            <svg v-else-if="type === 'error'" class="h-6 w-6 text-error" xmlns="http://www.w3.org/2000/svg"
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>

            <!-- 警告图标 -->
            <svg v-else-if="type === 'warning'" class="h-6 w-6 text-warning" xmlns="http://www.w3.org/2000/svg"
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>

            <!-- 信息图标 -->
            <svg v-else class="h-6 w-6 text-info" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
              stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <!-- 内容 -->
          <div class="ml-3 flex-1 pt-0.5 relative min-w-0"> <!-- 添加 min-w-0 来约束 flex item 的宽度 -->
            <p v-if="title" class="text-sm font-medium" :class="textColorClass">{{ title }}</p> <!-- 移除 pr-6 -->
            <OverlayScrollbarsComponent
              :options="{
                scrollbars: { autoHide: 'scroll', theme: isDark ? 'os-theme-light' : 'os-theme-dark' },
                overflow: { y: 'scroll', x: 'hidden' }, // 明确x轴隐藏，y轴滚动
                paddingAbsolute: true,
              }"
              :style="{ maxHeight: title ? '8rem' : '10rem' }"
              class="text-sm pr-2"
              :class="[title ? 'mt-1' : '', textColorClass]"
            >
              <MarkdownRenderer v-if="message" :markdown-content="message" />
            </OverlayScrollbarsComponent>
            <!-- 复制按钮已移动到关闭按钮区域 -->
          </div>

          <!-- 关闭按钮和复制按钮 -->
          <div class="ml-4 flex-shrink-0 flex flex-col items-center space-y-1.5">
            <button @click="close"
              class="inline-flex rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent"
              :class="closeButtonClass">
              <span class="sr-only">关闭</span>
              <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clip-rule="evenodd" />
              </svg>
            </button>
            <button
              v-if="props.showCopyButton && message"
              @click="copyContent"
              class="p-0.5 rounded text-text-muted hover:text-text-base focus:outline-none"
              :title="copyButtonTitle"
            >
              <svg v-if="!copySuccess" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
              <svg v-else class="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 进度条 -->
      <div v-if="duration > 0" class="h-1 mt-2 transition-all duration-100 ease-linear" :class="progressBarClass"
        :style="{ width: `${progressWidth}%` }"></div>
    </div>
  </div>
  <!-- </Teleport> -->
</template>

<script setup lang="ts">
// 增加 onUnmounted, onMounted 钩子
import { ref, computed, watch, onBeforeUnmount, onMounted, onUnmounted } from 'vue';
import { useThemeStore } from '../../stores/theme';
import MarkdownRenderer from './MarkdownRenderer.vue'; // 导入 MarkdownRenderer
import { OverlayScrollbarsComponent } from 'overlayscrollbars-vue'; // 导入滚动条组件
import 'overlayscrollbars/overlayscrollbars.css'; // 导入滚动条 CSS

type ToastType = 'info' | 'success' | 'warning' | 'error';
// position type 已移除，因为不由自身控制
// type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

const props = withDefaults(defineProps<{
  // visible 现在主要用于 watch 启动 timer 和动画，不控制 v-if
  visible: boolean;
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number; // 显示时长，单位毫秒，0表示不自动关闭
  // position?: ToastPosition; // 位置由父容器 DialogContainer 控制
  showCopyButton?: boolean; // 是否显示复制按钮
}>(), {
  title: '',
  type: 'info',
  duration: 5000, // 默认5秒后自动关闭
  // position: 'top-right',
  showCopyButton: true, // 默认显示复制按钮
});

const emit = defineEmits<{
  // 通知父组件可以移除了
  (e: 'update:visible', value: boolean): void;
  (e: 'close'): void; // 含义变为：通知父组件，本组件已完成关闭流程，可以被移除了
}>();

// 使用主题store
const themeStore = useThemeStore();
const isDark = computed(() => themeStore.currentAppliedMode === 'dark');

// 控制内容显示的动画
const showContent = ref(false);
// 增加一个标志位，防止重复关闭
const isClosing = ref(false);


// 自动关闭计时器
let autoCloseTimer: number | undefined = undefined; // 使用 undefined 更清晰

// 进度条宽度
const progressWidth = ref(100);
let progressInterval: number | undefined = undefined;


// 计算类型相关的类名
const typeClasses = computed(() => {
  // 防御性编程：在组件卸载过程中，props 可能为 null 或 computed 被访问
  const currentType = props?.type || 'info';
  if (isDark.value) {
    // 暗色模式下的样式
    switch (currentType) {
      case 'success':
        return 'bg-background-surface border-l-4 border-success';
      case 'error':
        return 'bg-background-surface border-l-4 border-error';
      case 'warning':
        return 'bg-background-surface border-l-4 border-warning';
      case 'info':
      default:
        return 'bg-background-surface border-l-4 border-info';
    }
  } else {
    // 亮色模式下的样式
    switch (currentType) {
      case 'success':
        return 'bg-white ring-green-300 border-l-4 border-green-500';
      case 'error':
        return 'bg-white ring-red-300 border-l-4 border-red-500';
      case 'warning':
        return 'bg-white ring-yellow-300 border-l-4 border-yellow-500';
      case 'info':
      default:
        return 'bg-white ring-blue-300 border-l-4 border-blue-500';
    }
  }
});

// 计算文本颜色
const textColorClass = computed(() => {
  return 'text-text-base';
});

// 计算关闭按钮样式
const closeButtonClass = computed(() => {
  // 模板中已有 focus:ring-offset-transparent, 这里只提供颜色和 focus:ring-neutral
  return 'text-text-muted hover:text-text-base focus:ring-neutral';
});
// 计算进度条样式
const progressBarClass = computed(() => {
  // 防御性编程
  const currentType = props?.type || 'info';
  switch (currentType) {
    case 'success':
      return 'bg-success';
    case 'error':
      return 'bg-error';
    case 'warning':
      return 'bg-warning';
    case 'info':
    default:
      return 'bg-info';
  }
});

// 清除所有计时器
const clearTimers = () => {
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = undefined;
  }
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = undefined;
  }
};

// 关闭Toast
const close = () => {
  // 防止重复触发
  if (isClosing.value) return;
  isClosing.value = true;

  // 先执行动画
  showContent.value = false;
  // 清除计时器
  clearTimers();
  // 等待动画完成后再通知父组件移除自己
  // 300ms 是 transition-all duration-300 的时长
  setTimeout(() => {
    // 只有当组件还未被父级卸载时才 emit
    if (props.visible) {
      emit('update:visible', false);
      emit('close');
    }
    // isClosing.value = false; // 组件即将销毁，无需重置
  }, 300);
};

// 启动计时器和进度条
const startTimers = () => {
  clearTimers();
  // 如果正在关闭或不需要自动关闭，则返回
  if (isClosing.value || (props.duration ?? 0) <= 0) {
    progressWidth.value = 100; // 确保非自动关闭时进度条是满的
    return;
  }

  progressWidth.value = 100;

  autoCloseTimer = window.setTimeout(() => {
    close();
  }, props.duration);

  const updateInterval = 50; // 增加间隔，减少更新频率
  const totalSteps = props.duration! / updateInterval;
  const decrementPerStep = 100 / totalSteps;

  progressInterval = window.setInterval(() => {
    // 关键：在正在关闭或不可见时，停止更新 state，避免触发更新
    if (!props.visible || isClosing.value) {
      clearTimers(); // 确保清除
      return;
    }
    progressWidth.value = Math.max(0, progressWidth.value - decrementPerStep);
    // 进度为0时，也清除 interval，让 timeout 去触发 close
    if (progressWidth.value <= 0) {
      clearTimers();
    }
  }, updateInterval);
};

// 鼠标移入处理
const handleMouseEnter = () => {
  // 只有在需要自动关闭时才暂停
  if (!isClosing.value && (props.duration ?? 0) > 0) {
    clearTimers();
  }
};

// 鼠标移出处理
const handleMouseLeave = () => {
  // 只有在需要自动关闭时才恢复
  if (!isClosing.value && (props.duration ?? 0) > 0) {
    // 重新开始计时，但可以考虑不清零进度条，这里选择重新开始
    startTimers();
  }
};

// 复制功能
const copySuccess = ref(false);
const copyButtonTitle = computed(() => (copySuccess.value ? '已复制' : '复制内容'));

const copyContent = async () => {
  if (!props.message) return;
  try {
    await navigator.clipboard.writeText(props.message);
    copySuccess.value = true;
    setTimeout(() => {
      copySuccess.value = false;
    }, 2000);
  } catch (err) {
    console.error('复制消息失败:', err);
    // 可以在此添加用户提示，例如使用一个新的 toast
  }
};

// 监听visible变化，控制动画和计时器
watch(() => props.visible, (newValue) => {
  if (newValue) {
    isClosing.value = false; // 重置关闭状态
    // 显示Toast时，nextTick 或短延迟后添加动画 class
    setTimeout(() => {
      showContent.value = true;
    }, 10); // 确保 DOM 已挂载
    startTimers();
  } else {
    // 如果是父组件主动设置 visible 为 false, 也触发关闭流程
    if (!isClosing.value) {
      close();
    }
    // 无论如何，visible 为 false 时，清除计时器
    clearTimers();
  }
}, { immediate: false }); // immediate 改为 false, 初始由 onMounted 处理

onMounted(() => {
  // 初始挂载时如果 visible 为 true，执行显示逻辑
  if (props.visible) {
    isClosing.value = false;
    setTimeout(() => {
      showContent.value = true;
    }, 10);
    startTimers();
  }
})

// 组件卸载前/时 清除计时器，确保万无一失
onBeforeUnmount(() => {
  clearTimers();
});
onUnmounted(() => {
  clearTimers();
})
</script>