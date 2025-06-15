<template>
  <BaseModal :visible="visible" title="移动项目" @close="handleClose" modal-class="w-full max-w-lg"
    data-testid="fm-move-modal">
    <div class="p-4 sm:p-6 space-y-4 text-sm">
      <p v-if="itemsToMove.length > 0">
        将 {{ itemsToMove.length }} 个项目:
      <ul class="list-disc list-inside max-h-32 overflow-y-auto bg-gray-50 dark:bg-gray-700 p-2 rounded-md mt-1">
        <li v-for="item in itemsToMove" :key="item.logicalPath" class="truncate" :title="item.name">
          <component :is="item.itemType === 'directory' ? FolderIcon : DocumentIcon"
            class="h-4 w-4 inline-block mr-1.5 align-text-bottom text-gray-500 dark:text-gray-400" />
          {{ item.name }}
        </li>
      </ul>
      </p>
      <p v-else>没有选中的项目可移动。</p>

      <div>
        <label for="targetPathInput" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          移动到目标文件夹:
        </label>
        <!-- 简化的路径输入，未来可以替换为路径选择器组件 -->
        <input id="targetPathInput" ref="targetPathInputRef" v-model="targetPath" type="text"
          class="input input-bordered input-sm w-full dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
          placeholder="例如: user://documents/new_folder/" @keydown.enter="handleConfirm" />
        <p v-if="pathError" class="text-xs text-red-500 dark:text-red-400 mt-1">{{ pathError }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          请输入完整的目标文件夹逻辑路径，并以 / 结尾。
        </p>
      </div>
      <!-- TODO: 未来可以集成一个迷你文件浏览器或树状视图来选择目标路径 -->
    </div>

    <template #footer>
      <div class="flex justify-end space-x-2 p-3 bg-gray-50 dark:bg-gray-750 rounded-b-md">
        <button @click="handleClose" class="btn btn-sm btn-ghost" data-testid="fm-move-cancel-btn">
          取消
        </button>
        <button @click="handleConfirm" class="btn btn-sm btn-primary" :disabled="!canConfirm"
          data-testid="fm-move-confirm-btn">
          <ArrowRightCircleIcon class="h-5 w-5 mr-1.5" />
          移动
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import BaseModal from '@/components/common/BaseModal.vue'; // 确保路径正确
import type { FAMItem } from '@comfytavern/types';
import { useFileManagerStore } from '@/stores/fileManagerStore';
import { FolderIcon, DocumentIcon, ArrowRightCircleIcon } from '@heroicons/vue/24/outline';

const props = defineProps<{
  visible: boolean;
  itemsToMove: FAMItem[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirmMove', items: FAMItem[], targetPath: string): void;
}>();

const fileManagerStore = useFileManagerStore();
const targetPath = ref('');
const pathError = ref<string | null>(null);
const targetPathInputRef = ref<HTMLInputElement | null>(null);

const canConfirm = computed(() => {
  return props.itemsToMove.length > 0 && targetPath.value.trim() !== '' && !pathError.value;
});

const validatePath = (path: string): boolean => {
  pathError.value = null;
  if (!path.trim()) {
    // pathError.value = '目标路径不能为空。'; // 允许为空，由 canConfirm 控制按钮
    return false;
  }
  if (!path.includes('://')) {
    pathError.value = '路径必须包含协议头 (如 user://, shared://)。';
    return false;
  }
  if (!path.endsWith('/')) {
    pathError.value = '文件夹路径必须以 / 结尾。';
    return false;
  }
  // 检查是否移动到自身或子目录
  for (const item of props.itemsToMove) {
    if (item.itemType === 'directory') {
      // 目标路径是源路径本身，或目标路径是源路径的子路径
      if (path === item.logicalPath || path.startsWith(item.logicalPath)) {
        pathError.value = `不能将文件夹 "${item.name}" 移动到其自身或其子文件夹中。`;
        return false;
      }
    }
    // 检查是否移动到当前位置
    const sourceParentPath = item.logicalPath.substring(0, item.logicalPath.lastIndexOf('/', item.logicalPath.length - 2) + 1);
    if (path === sourceParentPath) {
      pathError.value = `项目 "${item.name}" 已在目标位置。`;
      return false;
    }
  }
  return true;
};

watch(targetPath, (newPath) => {
  validatePath(newPath);
});

watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    // 当模态框可见时，自动聚焦到输入框
    // 并设置默认目标路径为当前浏览路径
    targetPath.value = fileManagerStore.currentLogicalPath;
    pathError.value = null; // 清除旧错误
    nextTick(() => {
      targetPathInputRef.value?.focus();
      targetPathInputRef.value?.select();
    });
  }
});

const handleClose = () => {
  emit('close');
};

const handleConfirm = () => {
  if (validatePath(targetPath.value) && canConfirm.value) {
    emit('confirmMove', props.itemsToMove, targetPath.value.trim());
    // emit('close'); // 确认后通常由父组件关闭
  }
};

</script>

<style scoped>
/* BaseModal 应该处理大部分样式。 */
/* .input*, .btn* 样式由 DaisyUI 或全局 Tailwind 配置提供。 */
/* 在模板中直接使用 input, input-sm, input-bordered, btn, btn-sm, btn-ghost, btn-primary 类即可。 */
</style>