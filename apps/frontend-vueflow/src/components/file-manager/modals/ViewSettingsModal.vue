<template>
  <div data-testid="fm-view-settings-modal" class="flex flex-col h-full">
    <div class="p-4 sm:p-6 space-y-5 flex-grow overflow-y-auto">
      <div>
        <label for="view-mode" class="block text-sm font-medium text-text-base mb-1">{{
          t('fileManager.viewSettings.viewMode') }}</label>
        <select id="view-mode" v-model="localSettings.mode"
          class="select select-bordered select-sm w-full bg-background-base border-border-base">
          <option value="list">{{ t('fileManager.viewSettings.listView') }}</option>
          <option value="grid">{{ t('fileManager.viewSettings.gridView') }}</option>
        </select>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="sort-field" class="block text-sm font-medium text-text-base mb-1">{{
            t('fileManager.viewSettings.sortField') }}</label>
          <select id="sort-field" v-model="localSettings.sortField"
            class="select select-bordered select-sm w-full bg-background-base border-border-base">
            <option value="name">{{ t('fileManager.toolbar.sortByName') }}</option>
            <option value="size">{{ t('fileManager.toolbar.sortBySize') }}</option>
            <option value="lastModified">{{ t('fileManager.toolbar.sortByDate') }}</option>
            <option value="itemType">{{ t('common.type') }}</option>
            <!-- 可根据 FAMListItem 扩展更多字段 -->
          </select>
        </div>
        <div>
          <label for="sort-direction" class="block text-sm font-medium text-text-base mb-1">{{
            t('fileManager.viewSettings.sortDirection') }}</label>
          <select id="sort-direction" v-model="localSettings.sortDirection"
            class="select select-bordered select-sm w-full bg-background-base border-border-base">
            <option value="asc">{{ t('fileManager.viewSettings.ascending') }}</option>
            <option value="desc">{{ t('fileManager.viewSettings.descending') }}</option>
          </select>
        </div>
      </div>

      <div v-if="localSettings.mode === 'list'">
        <label class="block text-sm font-medium text-text-base mb-1">{{ t('fileManager.viewSettings.visibleColumns')
        }}</label>
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
        <label for="thumbnail-size" class="block text-sm font-medium text-text-base mb-1">{{
          t('fileManager.viewSettings.thumbnailSize') }}</label>
        <select id="thumbnail-size" v-model="localSettings.thumbnailSize"
          class="select select-bordered select-sm w-full bg-background-base border-border-base">
          <option value="small">{{ t('fileManager.viewSettings.sizeSmall') }}</option>
          <option value="medium">{{ t('fileManager.viewSettings.sizeMedium') }}</option>
          <option value="large">{{ t('fileManager.viewSettings.sizeLarge') }}</option>
        </select>
      </div>

      <div>
        <label for="information-density" class="block text-sm font-medium text-text-base mb-1">{{
          t('fileManager.viewSettings.informationDensity') }}</label>
        <select id="information-density" v-model="localSettings.informationDensity"
          class="select select-bordered select-sm w-full bg-background-base border-border-base">
          <option value="compact">{{ t('fileManager.viewSettings.densityCompact') }}</option>
          <option value="comfortable">{{ t('fileManager.viewSettings.densityComfortable') }}</option>
          <option value="spacious">{{ t('fileManager.viewSettings.densitySpacious') }}</option>
        </select>
      </div>
    </div>

    <div class="flex justify-end items-center p-3 bg-background-surface rounded-b-md flex-shrink-0">
      <button @click="handleClose" type="button" class="btn btn-sm btn-ghost mr-2">
        {{ t('common.cancel') }}
      </button>
      <button @click="applySettings" type="button" class="btn btn-sm btn-primary">
        {{ t('fileManager.viewSettings.applySettings') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFileManagerStore, type ViewSettings } from '@/stores/fileManagerStore';
import type { FAMItem } from '@comfytavern/types';

const { t } = useI18n();

type AvailableColumn = {
  label: string;
  value: keyof FAMItem | string;
};

const fileManagerStore = useFileManagerStore();

const emit = defineEmits(['close-modal']);

// Local state for form inputs
const localSettings = reactive<ViewSettings>({ ...fileManagerStore.viewSettings });

const availableColumns = computed<AvailableColumn[]>(() => [
  { label: t('fileManager.viewSettings.columnLabels.name'), value: 'name' },
  { label: t('fileManager.viewSettings.columnLabels.size'), value: 'size' },
  { label: t('fileManager.viewSettings.columnLabels.lastModified'), value: 'lastModified' },
  { label: t('fileManager.viewSettings.columnLabels.itemType'), value: 'itemType' },
  // 可以根据 FAMListItem 的实际字段添加更多，例如 'owner', 'permissions' 等
  // { label: '创建日期', value: 'createdAt' },
]);

onMounted(() => {
  // Deep copy from store to localSettings to avoid direct mutation and allow cancellation
  Object.assign(localSettings, JSON.parse(JSON.stringify(fileManagerStore.viewSettings)));
});

const applySettings = () => {
  // Ensure 'name' is always a visible column if in list mode
  if (localSettings.mode === 'list' && !localSettings.visibleColumns.includes('name')) {
    localSettings.visibleColumns.unshift('name');
  }
  fileManagerStore.updateViewSettings({ ...localSettings });
  emit('close-modal');
};

const handleClose = () => {
  emit('close-modal');
};

</script>

<style scoped>
/* Add any specific styles for the view settings modal here if needed */
</style>