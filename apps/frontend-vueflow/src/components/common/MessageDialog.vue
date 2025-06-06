<template>
  <Teleport to="body">
    <!-- 遮罩层 -->
    <div
      v-if="visible"
      class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center transition-opacity duration-300"
      :class="{ 'opacity-0': !showContent, 'opacity-100': showContent }"
      @click="closeOnBackdrop && close()"
    >
      <!-- 对话框 -->
      <div
        class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4 transition-all duration-300"
        :class="{ 'opacity-0 scale-95': !showContent, 'opacity-100 scale-100': showContent }"
        @click.stop
      >
        <!-- 标题栏 -->
        <div class="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
            {{ title }}
          </h3>
          <button
            v-if="showCloseButton"
            @click="close"
            class="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 focus:outline-none"
          >
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- 内容区域 -->
        <div class="p-4 text-gray-700 dark:text-gray-300">
          <!-- 如果有内容插槽，则使用插槽 -->
          <slot>
            <!-- 否则使用message属性 -->
            <p>{{ message }}</p>
          </slot>
        </div>

        <!-- 按钮区域 -->
        <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-2">
          <!-- 自定义按钮插槽 -->
          <slot name="actions">
            <!-- 默认确定按钮 -->
            <button
              @click="confirm"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
            >
              {{ confirmText }}
            </button>
          </slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps<{
  visible: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  autoClose?: number; // 自动关闭时间（毫秒），0表示不自动关闭
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm'): void;
  (e: 'close'): void;
}>();

// 控制内容显示的动画
const showContent = ref(false);

// 自动关闭计时器
let autoCloseTimer: number | null = null;

// 监听visible变化，控制动画
watch(() => props.visible, (newValue) => {
  if (newValue) {
    // 显示对话框时，先渲染DOM，然后添加动画
    setTimeout(() => {
      showContent.value = true;
    }, 50);

    // 设置自动关闭
    if (props.autoClose && props.autoClose > 0) {
      autoCloseTimer = window.setTimeout(() => {
        close();
      }, props.autoClose);
    }
  } else {
    // 隐藏对话框时，先执行动画，然后移除DOM
    showContent.value = false;
  }
}, { immediate: true });

// 确认按钮点击事件
const confirm = () => {
  emit('confirm');
  close();
};

// 关闭对话框
const close = () => {
  // 先执行动画
  showContent.value = false;
  
  // 清除自动关闭计时器
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = null;
  }
  
  // 等待动画完成后再关闭
  setTimeout(() => {
    emit('update:visible', false);
    emit('close');
  }, 300);
};

// 键盘事件处理
const handleKeyDown = (event: KeyboardEvent) => {
  if (props.visible && event.key === 'Escape') {
    close();
  }
};

// 组件挂载时添加键盘事件监听
onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
});

// 组件卸载前移除键盘事件监听
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeyDown);
  
  // 清除可能存在的计时器
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer);
  }
});
</script>