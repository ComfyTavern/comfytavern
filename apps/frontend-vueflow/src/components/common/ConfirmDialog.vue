<template>
  <MessageDialog
    v-model:visible="dialogVisible"
    :title="title"
    :message="message"
    :confirm-text="confirmText"
    :show-close-button="showCloseButton"
    :close-on-backdrop="closeOnBackdrop"
    @confirm="onConfirm"
    @close="onClose"
  >
    <!-- 自定义内容插槽 -->
    <slot></slot>
    
    <!-- 自定义按钮区域 -->
    <template #actions>
      <!-- 取消按钮 -->
      <button
        @click="onCancel"
        class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors mr-2"
      >
        {{ cancelText }}
      </button>
      
      <!-- 确认按钮 -->
      <button
        @click="onConfirm"
        :class="[
          'px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors',
          dangerConfirm 
            ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white' 
            : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white'
        ]"
      >
        {{ confirmText }}
      </button>
    </template>
  </MessageDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MessageDialog from './MessageDialog.vue';

const props = withDefaults(defineProps<{
  visible: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  dangerConfirm?: boolean; // 是否为危险操作确认（红色按钮）
}>(), {
  title: '确认',
  message: '',
  confirmText: '确定',
  cancelText: '取消',
  showCloseButton: true,
  closeOnBackdrop: false, // 默认点击背景不关闭，避免误操作
  dangerConfirm: false,
});

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm'): void;
  (e: 'cancel'): void;
  (e: 'close'): void;
}>();

// 计算属性，用于双向绑定visible
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
});

// 确认按钮点击事件
const onConfirm = () => {
  emit('confirm');
  emit('update:visible', false);
};

// 取消按钮点击事件
const onCancel = () => {
  emit('cancel');
  emit('update:visible', false);
};

// 关闭事件（点击X或按ESC）
const onClose = () => {
  emit('close');
  // 关闭时默认触发取消事件
  emit('cancel');
};
</script>