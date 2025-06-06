<template>
  <div class="dialog-container">
    <!-- 动态渲染当前活动的对话框 -->
    <component
      v-if="dialogService.activeDialog"
      :is="dialogService.activeDialog.component"
      v-bind="dialogService.activeDialog.props"
    />
    
    <!-- 渲染所有通知 -->
    <template v-for="toast in dialogService.toasts" :key="toast.id">
      <ToastNotification v-bind="toast.props" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { useDialogService } from '@/services/DialogService';
import ToastNotification from './ToastNotification.vue';

// 获取对话服务实例
const dialogService = useDialogService();
</script>