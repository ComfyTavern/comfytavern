<template>
  <BaseModal :visible="visible" title="视图设置" @close="handleClose" modal-class="w-full max-w-md"
    data-testid="fm-view-settings-modal">
    <div class="p-4 sm:p-6 space-y-5">
      <div>
        <label for="view-mode" class="block text-sm font-medium text-text-base mb-1">视图模式</label>
        <select id="view-mode" v-model="localSettings.mode"
          class="select select-bordered select-sm w-full bg-background-base border-border-base">
          <option value="list">列表视图</option>
          <option value="grid">网格视图</option>
        </select>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="sort-field" class="block text-sm font-medium text-text-base mb-1">排序字段</label>
          <select id="sort-field" v-model="localSettings.sortField"
            class="select select-bordered select-sm w-full bg-background-base border-border-base">
            <option value="name">名称</option>
            <option value="size">大小</option>
            <option value="lastModified">修改日期</option>
            <option value="itemType">类型</option>
            <!-- 可根据 FAMListItem 扩展更多字段 -->
          </select>
        </div>
        <div>
          <label for="sort-direction"
            class="block text-sm font-medium text-text-base mb-1">排序方向</label>
          <select id="sort-direction" v-model="localSettings.sortDirection"
            class="select select-bordered select-sm w-full bg-background-base border-border-base">
            <option value="asc">升序</option>
            <option value="desc">降序</option>
          </select>
        </div>
      </div>

      <div v-if="localSettings.mode === 'list'">
        <label class="block text-sm font-medium text-text-base mb-1">列表视图显示列</label>
        <div class="space-y-1 max-h-40 overflow-y-auto p-1 rounded-md border border-border-base">
          <label v-for="column in availableColumns" :key="column.value"
            class="flex items-center space-x-2 p-1.5 hover:bg-background-base rounded text-xs">
            <input type="checkbox" :value="column.value" v-model="localSettings.visibleColumns"
              class="checkbox checkbox-xs checkbox-primary" :disabled="column.value === 'name'" />
            <span>{{ column.label }}</span>
          </label>
        </div>
      </div>

      <div v-if="localSettings.mode === 'grid'">
        <label for="thumbnail-size" class="block text-sm font-medium text-text-base mb-1">缩略图大小
          (网格视图)</label>
        <select id="thumbnail-size" v-model="localSettings.thumbnailSize"
          class="select select-bordered select-sm w-full bg-background-base border-border-base">
          <option value="small">小</option>
          <option value="medium">中</option>
          <option value="large">大</option>
        </select>
      </div>

      <div>
        <label for="information-density"
          class="block text-sm font-medium text-text-base mb-1">信息密度</label>
        <select id="information-density" v-model="localSettings.informationDensity"
          class="select select-bordered select-sm w-full bg-background-base border-border-base">
          <option value="compact">紧凑</option>
          <option value="comfortable">舒适</option>
          <option value="spacious">宽松</option>
        </select>
      </div>

    </div>

    <template #footer>
      <div class="flex justify-end items-center p-3 bg-background-surface rounded-b-md">
        <button @click="handleClose" type="button" class="btn btn-sm btn-ghost mr-2">
          取消
        </button>
        <button @click="applySettings" type="button" class="btn btn-sm btn-primary">
          应用设置
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import BaseModal from '@/components/common/BaseModal.vue';
import { useFileManagerStore, type ViewSettings } from '@/stores/fileManagerStore';
import type { FAMItem } from '@comfytavern/types';


const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const fileManagerStore = useFileManagerStore();

// Local state for form inputs
const localSettings = reactive<ViewSettings>({ ...fileManagerStore.viewSettings });

const availableColumns: { label: string; value: keyof FAMItem | string }[] = [
  { label: '名称', value: 'name' },
  { label: '大小', value: 'size' },
  { label: '修改日期', value: 'lastModified' },
  { label: '类型', value: 'itemType' },
  // 可以根据 FAMListItem 的实际字段添加更多，例如 'owner', 'permissions' 等
  // { label: '创建日期', value: 'createdAt' },
];

// Sync localSettings with store when modal becomes visible or store settings change
watch(() => props.visible, (newVal) => {
  if (newVal) {
    // Deep copy from store to localSettings to avoid direct mutation and allow cancellation
    Object.assign(localSettings, JSON.parse(JSON.stringify(fileManagerStore.viewSettings)));
  }
}, { immediate: true });

// Watch for external changes to store's viewSettings if needed, though typically modal is source of truth when open
watch(() => fileManagerStore.viewSettings, (newStoreSettings) => {
  if (!props.visible) { // Only update if modal is not open (to prevent overriding user's current edits)
    Object.assign(localSettings, JSON.parse(JSON.stringify(newStoreSettings)));
  }
}, { deep: true });


const applySettings = () => {
  // Ensure 'name' is always a visible column if in list mode
  if (localSettings.mode === 'list' && !localSettings.visibleColumns.includes('name')) {
    localSettings.visibleColumns.unshift('name');
  }
  fileManagerStore.updateViewSettings({ ...localSettings });
  emit('close');
};

const handleClose = () => {
  // Reset local form to match store if user cancels without applying
  // This is handled by the watch on props.visible when it becomes true again
  emit('close');
};

</script>

<style scoped>
/* Add any specific styles for the view settings modal here if needed */
</style>