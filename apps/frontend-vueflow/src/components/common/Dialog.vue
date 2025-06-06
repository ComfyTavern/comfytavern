<template>
  <Teleport to="body">
    <!-- 遮罩层 -->
    <div
      v-if="props.visible"
      class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center transition-opacity duration-300"
      :class="{ 'opacity-0': !showContent, 'opacity-100': showContent }"
      @click="props.closeOnBackdrop && handleCancel()"
    >
      <!-- 对话框 -->
      <div
        class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4 transition-all duration-300"
        :class="{ 'opacity-0 scale-95': !showContent, 'opacity-100 scale-100': showContent }"
        :style="{ width: props.width }"
        @click.stop
      >
        <!-- 标题栏 -->
        <div v-if="props.title" class="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
            {{ props.title }}
          </h3>
          <button
            v-if="props.showCloseIcon"
            @click="handleCancel"
            class="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 focus:outline-none"
          >
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- 内容区域 -->
        <div class="p-4 text-gray-700 dark:text-gray-300">
          <slot>
            <p v-if="props.message">{{ props.message }}</p>
          </slot>
          <div v-if="props.type === 'input'" class="mt-2">
            <textarea
              v-if="props.inputType === 'textarea'"
              v-model="internalInputValue"
              :placeholder="props.inputPlaceholder"
              :rows="props.inputRows"
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-offset-gray-800"
              @input="emit('update:inputValue', internalInputValue)"
              @keydown.enter="handleInputEnter"
            ></textarea>
            <input
              v-else
              v-model="internalInputValue"
              :type="props.inputType"
              :placeholder="props.inputPlaceholder"
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-offset-gray-800"
              @input="emit('update:inputValue', internalInputValue)"
              @keydown.enter="handleInputEnter"
            />
          </div>
        </div>

        <!-- 按钮区域 -->
        <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-2">
          <slot name="actions">
            <!-- 默认按钮 -->
            <button
              v-if="shouldShowCancelButton"
              @click="handleCancel"
              class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
            >
              {{ props.cancelText }}
            </button>
            <button
              @click="handleConfirm"
              :class="[
                'px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors',
                props.dangerConfirm
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white'
              ]"
            >
              {{ props.confirmText }}
            </button>
          </slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue';

const props = withDefaults(defineProps<{
  visible: boolean;
  title?: string;
  message?: string; // 作为 slot 的后备内容
  type?: 'message' | 'confirm' | 'input';
  confirmText?: string;
  cancelText?: string;
  showCancelButton?: boolean; // 明确控制取消按钮的显示
  showCloseIcon?: boolean; // 标题栏的关闭图标
  closeOnBackdrop?: boolean;
  autoClose?: number; // 自动关闭时间（毫秒），0表示不自动关闭
  dangerConfirm?: boolean; // 确认按钮是否为危险操作样式

  // Input-specific props
  initialValue?: string; // 用于 input 类型，外部 v-model:inputValue 的初始值
  inputValue?: string; // 用于 input 类型，实现 v-model
  inputPlaceholder?: string;
  inputType?: 'text' | 'password' | 'number' | 'textarea';
  inputRows?: number;
  width?: string; // 对话框宽度
}>(), {
  type: 'message',
  confirmText: '确定',
  cancelText: '取消',
  showCancelButton: undefined, // 默认不直接控制，依赖 type
  showCloseIcon: true,
  closeOnBackdrop: true,
  autoClose: 0,
  dangerConfirm: false,
  initialValue: '',
  inputPlaceholder: '请输入内容...',
  inputType: 'text',
  inputRows: 3,
  width: 'max-w-md', // 默认宽度
});

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm', value?: string): void; // Input 类型时，value 为输入值
  (e: 'cancel'): void;
  (e: 'close'): void; // 由关闭图标或ESC触发
  (e: 'update:inputValue', value: string): void; // 用于 input 类型的 v-model
}>();

const showContent = ref(false);
const internalInputValue = ref(props.inputValue || props.initialValue);
let autoCloseTimer: number | null = null;

watch(() => props.visible, (newValue) => {
  if (newValue) {
    if (props.type === 'input') {
      internalInputValue.value = props.inputValue !== undefined ? props.inputValue : props.initialValue;
    }
    setTimeout(() => {
      showContent.value = true;
    }, 50); // 动画延迟

    if (props.autoClose && props.autoClose > 0) {
      autoCloseTimer = window.setTimeout(() => {
        closeDialog(true); // autoClose 视为一种取消/关闭
      }, props.autoClose);
    }
  } else {
    showContent.value = false;
  }
}, { immediate: true });

watch(() => props.inputValue, (newVal) => {
  if (props.type === 'input' && newVal !== undefined) {
    internalInputValue.value = newVal;
  }
});
watch(() => props.initialValue, (newVal) => {
    if (props.type === 'input' && props.inputValue === undefined) { // 仅当没有v-model:inputValue时，initialValue才驱动
        internalInputValue.value = newVal;
    }
});


const shouldShowCancelButton = computed(() => {
  if (props.showCancelButton !== undefined) {
    return props.showCancelButton;
  }
  return props.type === 'confirm' || props.type === 'input';
});

function closeDialog(isCancelOrClose: boolean) {
  showContent.value = false;
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = null;
  }
  setTimeout(() => {
    emit('update:visible', false);
    if (isCancelOrClose) {
      emit('close'); // 统一的关闭事件
      emit('cancel'); // 无论是点X, ESC, 背景, 还是取消按钮，都触发 cancel
    }
  }, 300); // 等待动画完成
}

function handleConfirm() {
  if (props.type === 'input') {
    emit('confirm', internalInputValue.value);
  } else {
    emit('confirm');
  }
  closeDialog(false); // confirm 不是 cancel/close
}

function handleCancel() {
  closeDialog(true);
}

function handleInputEnter(event: KeyboardEvent) {
  if (props.type === 'input') {
    if (props.inputType === 'textarea') {
      if (event.metaKey || event.ctrlKey) {
        handleConfirm();
      }
    } else {
      if (!event.isComposing) { // 避免输入法组合期间触发
        handleConfirm();
      }
    }
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (props.visible && event.key === 'Escape' && props.showCloseIcon) { // 只有显示关闭图标时才响应ESC
    handleCancel();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeyDown);
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer);
  }
});

</script>

<style scoped>
/* 基础样式可以从 MessageDialog.vue 迁移或在此定义 */
/* 确保 Tailwind CSS 生效 */
.dialog-input { /* 示例，可以根据需要添加更多特定样式 */
  margin-bottom: 10px; 
  width: 100%; 
  padding: 8px; 
  box-sizing: border-box; 
}
</style>