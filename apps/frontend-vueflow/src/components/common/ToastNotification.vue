<template>
  <!-- Teleport to="body" 已移除 -->
  <div
    v-if="visible"
    class="transition-all duration-300 flex items-center"
    :style="{ zIndex: 9999 }"
    :class="[
      /* positionClasses 已移除，由 DialogContainer 控制 */
      { 'opacity-0 translate-y-4': !showContent, 'opacity-100 translate-y-0': showContent }
    ]"
  >
    <div
      class="max-w-md w-full shadow-lg rounded-lg pointer-events-auto overflow-hidden"
      :class="[
        typeClasses,
        { 'ring-1': !isDark }
      ]"
    >
      <div class="p-4">
        <div class="flex items-start">
          <!-- 图标 -->
          <div class="flex-shrink-0">
            <!-- 成功图标 -->
            <svg
              v-if="type === 'success'"
              class="h-6 w-6 text-green-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              
              <!-- 错误图标 -->
              <svg
                v-else-if="type === 'error'"
                class="h-6 w-6 text-red-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              
              <!-- 警告图标 -->
              <svg
                v-else-if="type === 'warning'"
                class="h-6 w-6 text-yellow-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              
              <!-- 信息图标 -->
              <svg
                v-else
                class="h-6 w-6 text-blue-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <!-- 内容 -->
            <div class="ml-3 flex-1 pt-0.5">
              <p v-if="title" class="text-sm font-medium" :class="textColorClass">{{ title }}</p>
              <p class="text-sm" :class="[title ? 'mt-1' : '', textColorClass]">{{ message }}</p>
            </div>
            
            <!-- 关闭按钮 -->
            <div class="ml-4 flex-shrink-0 flex">
              <button
                @click="close"
                class="inline-flex rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent"
                :class="closeButtonClass"
              >
                <span class="sr-only">关闭</span>
                <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        <!-- 进度条 -->
        <div
          v-if="duration > 0"
          class="h-1 transition-all duration-100 ease-linear"
          :class="progressBarClass"
          :style="{ width: `${progressWidth}%` }"
        ></div>
      </div>
    </div>
  <!-- </Teleport> -->
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { useThemeStore } from '../../stores/theme';

type ToastType = 'info' | 'success' | 'warning' | 'error';
type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

const props = withDefaults(defineProps<{
  visible: boolean;
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number; // 显示时长，单位毫秒，0表示不自动关闭
  position?: ToastPosition;
}>(), {
  title: '',
  type: 'info',
  duration: 3000, // 默认3秒后自动关闭
  position: 'top-right',
});

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'close'): void;
}>();

// 使用主题store
const themeStore = useThemeStore();
const isDark = computed(() => themeStore.isDark);

// 控制内容显示的动画
const showContent = ref(false);

// 自动关闭计时器
let autoCloseTimer: number | null = null;

// 进度条宽度
const progressWidth = ref(100);
let progressInterval: number | null = null;

// 计算位置类名 (已移除，由 DialogContainer 控制)
// const positionClasses = computed(() => { ... });

// 计算类型相关的类名
const typeClasses = computed(() => {
  if (isDark.value) {
    // 暗色模式下的样式
    switch (props.type) {
      case 'success':
        return 'bg-gray-800 border-l-4 border-green-500';
      case 'error':
        return 'bg-gray-800 border-l-4 border-red-500';
      case 'warning':
        return 'bg-gray-800 border-l-4 border-yellow-500';
      case 'info':
      default:
        return 'bg-gray-800 border-l-4 border-blue-500';
    }
  } else {
    // 亮色模式下的样式
    switch (props.type) {
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
  if (isDark.value) {
    return 'text-gray-100';
  } else {
    return 'text-gray-900';
  }
});

// 计算关闭按钮样式
const closeButtonClass = computed(() => {
  if (isDark.value) {
    return 'text-gray-400 hover:text-gray-200 focus:ring-gray-600';
  } else {
    return 'text-gray-400 hover:text-gray-600 focus:ring-gray-400';
  }
});

// 计算进度条样式
const progressBarClass = computed(() => {
  switch (props.type) {
    case 'success':
      return 'bg-green-500';
    case 'error':
      return 'bg-red-500';
    case 'warning':
      return 'bg-yellow-500';
    case 'info':
    default:
      return 'bg-blue-500';
  }
});

// 监听visible变化，控制动画
watch(() => props.visible, (newValue) => {
  if (newValue) {
    // 显示Toast时，先渲染DOM，然后添加动画
    setTimeout(() => {
      showContent.value = true;
    }, 50);

    // 重置进度条
    progressWidth.value = 100;

    // 设置自动关闭和进度条
    if (props.duration && props.duration > 0) {
      // 设置自动关闭计时器
      autoCloseTimer = window.setTimeout(() => {
        close();
      }, props.duration);

      // 设置进度条动画
      const updateInterval = 10; // 每10毫秒更新一次
      const steps = props.duration / updateInterval;
      const decrementPerStep = 100 / steps;

      progressInterval = window.setInterval(() => {
        progressWidth.value = Math.max(0, progressWidth.value - decrementPerStep);
      }, updateInterval);
    }
  } else {
    // 隐藏Toast时，先执行动画，然后移除DOM
    showContent.value = false;
    
    // 清除计时器
    clearTimers();
  }
}, { immediate: true });

// 关闭Toast
const close = () => {
  // 先执行动画
  showContent.value = false;
  
  // 清除计时器
  clearTimers();
  
  // 等待动画完成后再关闭
  setTimeout(() => {
    emit('update:visible', false);
    emit('close');
  }, 300);
};

// 清除所有计时器
const clearTimers = () => {
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = null;
  }
  
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
};

// 组件卸载前清除计时器
onBeforeUnmount(() => {
  clearTimers();
});
</script>