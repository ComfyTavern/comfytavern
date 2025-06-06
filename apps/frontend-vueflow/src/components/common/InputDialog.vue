<template>
  <MessageDialog
    v-model:visible="dialogVisible"
    :title="title"
    :message="message"
    :confirm-text="props.confirmText"
    :show-close-button="props.showCloseButton"
    :close-on-backdrop="props.closeOnBackdrop"
    @confirm="handleOuterConfirm" 
    @close="handleOuterClose"
  >
    <!-- 输入框区域 -->
    <div class="mt-2">
      <textarea 
        v-if="props.inputType === 'textarea'"
        v-model="inputValue"
        :placeholder="props.placeholder"
        :rows="props.inputRows"
        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-offset-gray-800"
        @keydown.enter.prevent="handleInputEnter"
      ></textarea>
      <input 
        v-else
        v-model="inputValue"
        :type="props.inputType"
        :placeholder="props.placeholder"
        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-offset-gray-800"
        @keydown.enter.prevent="onConfirm"
      />
    </div>
    
    <!-- 自定义按钮区域 -->
    <template #actions>
      <!-- 取消按钮 -->
      <button
        @click="onCancel"
        class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors mr-2"
      >
        {{ props.cancelText }}
      </button>
      
      <!-- 确认按钮 -->
      <button
        @click="onConfirm"
        :class="[
          'px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors',
          props.dangerConfirm 
            ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white' 
            : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white'
        ]"
      >
        {{ props.confirmText }}
      </button>
    </template>
  </MessageDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import MessageDialog from './MessageDialog.vue';

const props = withDefaults(defineProps<{
  visible: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  dangerConfirm?: boolean;
  initialValue?: string;
  placeholder?: string;
  inputType?: 'text' | 'password' | 'number' | 'textarea';
  inputRows?: number;
}>(), {
  title: '输入',
  message: '',
  confirmText: '确定',
  cancelText: '取消',
  showCloseButton: true,
  closeOnBackdrop: false, 
  dangerConfirm: false,
  initialValue: '',
  placeholder: '请输入内容...',
  inputType: 'text',
  inputRows: 3,
});

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm', inputValue: string): void;
  (e: 'cancel'): void;
  (e: 'close'): void; 
}>();

const inputValue = ref(props.initialValue);

// 监听 initialValue 的变化，以便在对话框复用时更新输入框的初始值
watch(() => props.initialValue, (newValue) => {
  inputValue.value = newValue;
});
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    inputValue.value = props.initialValue; // 对话框显示时重置为初始值
  }
});


// 计算属性，用于双向绑定visible
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
});

// 确认按钮点击事件
const onConfirm = () => {
  emit('confirm', inputValue.value);
  emit('update:visible', false);
};

// 取消按钮点击事件
const onCancel = () => {
  emit('cancel');
  emit('update:visible', false);
};

// MessageDialog 的 confirm 事件 (通常是点击背景或ESC关闭时，如果 MessageDialog 内部有默认确认行为)
// 在这里，我们希望 MessageDialog 的原生 confirm (如果有) 也触发 cancel
const handleOuterConfirm = () => {
  // 对于 InputDialog，MessageDialog 的 confirm 通常不应该直接触发 InputDialog 的 confirm
  // 而是应该由 InputDialog 自己的按钮控制。
  // 如果 MessageDialog 的 confirm 是由其内部的单个按钮触发的，那这个 InputDialog 就不应该用那个按钮。
  // 实际上，由于我们用了 actions slot，MessageDialog 内部的默认按钮不会显示。
  // 这个回调主要是为了处理 MessageDialog 可能通过其他方式（如 autoClose）触发的 confirm。
  // 但对于 InputDialog，更合理的行为是 autoClose 也视为 cancel。
  onCancel(); 
};

// 关闭事件（点击X或按ESC，由 MessageDialog 触发）
const handleOuterClose = () => {
  emit('close'); // 传递 MessageDialog 的 close 事件
  // 关闭时默认触发取消事件
  emit('cancel'); 
};

// 处理输入框内的 Enter 键
const handleInputEnter = (event: KeyboardEvent) => {
  if (props.inputType === 'textarea') {
    // 对于 textarea，通常不希望 Enter 直接提交，除非配合 Ctrl/Meta
    if (event.metaKey || event.ctrlKey) {
      onConfirm();
    }
    // 如果不希望 Enter 提交，可以在这里 event.stopPropagation() 或不执行 onConfirm()
  } else {
    onConfirm();
  }
};
</script>