<template>
  <div data-testid="fm-move-modal">
    <div class="p-4 sm:p-6 space-y-4 text-sm">
      <p v-if="itemsToMove.length > 0">
        {{ t('fileManager.moveModal.itemsToMove', { count: itemsToMove.length }) }}
      <ul class="list-disc list-inside max-h-32 overflow-y-auto bg-background-base p-2 rounded-md mt-1">
        <li v-for="item in itemsToMove" :key="item.logicalPath" class="truncate" v-comfy-tooltip="item.name">
          <component :is="item.itemType === 'directory' ? FolderIcon : DocumentIcon"
            class="h-4 w-4 inline-block mr-1.5 align-text-bottom text-text-muted" />
          {{ item.name }}
        </li>
      </ul>
      </p>
      <p v-else>{{ t('fileManager.moveModal.noItemsToMove') }}</p>

      <div>
        <label for="targetPathInput" class="block text-sm font-medium text-text-base mb-1">
          {{ t('fileManager.moveModal.targetFolderLabel') }}
        </label>
        <input id="targetPathInput" ref="targetPathInputRef" v-model="targetPath" type="text"
          class="input input-bordered input-sm w-full bg-background-base text-text-base border-border-base"
          :placeholder="t('fileManager.moveModal.targetPathPlaceholder')" @keydown.enter="handleConfirm" />
        <p v-if="pathError" class="text-xs text-error mt-1">{{ pathError }}</p>
        <p class="text-xs text-text-muted mt-1">
          {{ t('fileManager.moveModal.pathHint') }}
        </p>
      </div>
    </div>

    <div class="flex justify-end space-x-2 p-3 bg-background-surface rounded-b-md">
      <button @click="handleClose" class="btn btn-sm btn-ghost" data-testid="fm-move-cancel-btn">
        {{ t('common.cancel') }}
      </button>
      <button @click="handleConfirm" class="btn btn-sm btn-primary" :disabled="!canConfirm"
        data-testid="fm-move-confirm-btn">
        <ArrowRightCircleIcon class="h-5 w-5 mr-1.5" />
        {{ t('fileManager.moveModal.moveButton') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import type { FAMItem } from '@comfytavern/types';
import { useFileManagerStore } from '@/stores/fileManagerStore';
import { FolderIcon, DocumentIcon, ArrowRightCircleIcon } from '@heroicons/vue/24/outline';

const props = defineProps<{
  itemsToMove: FAMItem[];
  onConfirmMove: (items: FAMItem[], targetPath: string) => void;
}>();

const emit = defineEmits(['close-modal']);

const { t } = useI18n();
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
    return false;
  }
  if (!path.includes('://')) {
    pathError.value = t('fileManager.moveModal.errors.protocolRequired');
    return false;
  }
  if (!path.endsWith('/')) {
    pathError.value = t('fileManager.moveModal.errors.folderPathMustEndWithSlash');
    return false;
  }
  for (const item of props.itemsToMove) {
    if (item.itemType === 'directory') {
      if (path === item.logicalPath || path.startsWith(item.logicalPath)) {
        pathError.value = t('fileManager.moveModal.errors.cannotMoveIntoSelfOrChild', { itemName: item.name });
        return false;
      }
    }
    const sourceParentPath = item.logicalPath.substring(0, item.logicalPath.lastIndexOf('/', item.logicalPath.length - 2) + 1);
    if (path === sourceParentPath) {
      pathError.value = t('fileManager.moveModal.errors.alreadyAtTarget', { itemName: item.name });
      return false;
    }
  }
  return true;
};

watch(targetPath, (newPath) => {
  validatePath(newPath);
});

onMounted(() => {
  targetPath.value = fileManagerStore.currentLogicalPath;
  pathError.value = null;
  nextTick(() => {
    targetPathInputRef.value?.focus();
    targetPathInputRef.value?.select();
  });
});

const handleClose = () => {
  emit('close-modal');
};

const handleConfirm = () => {
  if (validatePath(targetPath.value) && canConfirm.value) {
    props.onConfirmMove(props.itemsToMove, targetPath.value.trim());
    emit('close-modal');
  }
};

</script>

<style scoped>
/* BaseModal 应该处理大部分样式。 */
/* .input*, .btn* 样式由 DaisyUI 或全局 Tailwind 配置提供。 */
/* 在模板中直接使用 input, input-sm, input-bordered, btn, btn-sm, btn-ghost, btn-primary 类即可。 */
</style>