<template>
  <div class="plugin-manager h-full flex flex-col bg-background-base">
    <div class="flex-1 overflow-auto px-4">
      <DataListView
        :fetcher="pluginFetcher"
        :sort-options="sortOptions"
        :columns="columns"
        :initial-sort="{ field: 'displayName', direction: 'asc' }"
        item-key="name"
        selectable
        grid-class="grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4"
        :loading-message="t('common.loading')"
        :empty-message="t('common.noResults')"
        :error-message="t('settings.plugins.loadError')"
      >
        <template #header>
          <div class="pt-4 pb-2">
            <h2 class="text-2xl font-bold text-text-base">{{ t('settings.plugins.title') }}</h2>
            <p class="text-sm text-text-secondary mt-1">{{ t('settings.plugins.description') }}</p>
          </div>
          <div class="border-t border-border-base opacity-60"></div>
        </template>

        <template #toolbar-actions>
          <button
            @click="reloadPlugins"
            :disabled="pluginStore.isLoading"
            class="px-3 py-1.5 text-sm bg-primary text-primary-content rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <ArrowPathIcon :class="['h-4 w-4', { 'animate-spin': pluginStore.isLoading }]" />
            <span class="ml-2">{{ pluginStore.isLoading ? t('settings.plugins.reloading') : t('settings.plugins.reload') }}</span>
          </button>
        </template>

        <template #grid-item="{ item }">
          <div class="bg-background-surface rounded-lg shadow p-4 border border-border-base flex flex-col h-full">
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-text-base truncate" v-comfy-tooltip="item.displayName">
                {{ item.displayName }}
                <span class="text-sm text-text-secondary ml-2">v{{ item.version }}</span>
              </h3>
              <p class="text-sm text-text-secondary mt-1 flex-grow">{{ item.description || t('common.noDescription') }}</p>
            </div>
            <div class="ml-auto mt-4 flex-shrink-0">
              <BooleanToggle
                :model-value="item.isEnabled ?? true"
                @update:model-value="togglePluginStatus(item, $event)"
                size="large"
                v-comfy-tooltip="item.isEnabled ? t('settings.plugins.disableTooltip') : t('settings.plugins.enableTooltip')"
                :disabled="pluginStore.isPluginPending(item.name)"
              />
            </div>
          </div>
        </template>

        <template #list-item="{ item }">
          <td class="px-3 py-2.5 text-text-base font-medium whitespace-nowrap">
            {{ item.displayName }}
          </td>
          <td class="px-3 py-2.5 text-text-secondary truncate max-w-sm">
            {{ item.description || t('common.noDescription') }}
          </td>
          <td class="px-3 py-2.5 text-text-muted whitespace-nowrap">
            v{{ item.version }}
          </td>
          <td class="px-3 py-2.5 text-right">
             <BooleanToggle
                :model-value="item.isEnabled ?? true"
                @update:model-value="togglePluginStatus(item, $event)"
                size="small"
                v-comfy-tooltip="item.isEnabled ? t('settings.plugins.disableTooltip') : t('settings.plugins.enableTooltip')"
                :disabled="pluginStore.isPluginPending(item.name)"
              />
          </td>
        </template>
      </DataListView>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePluginStore } from '@/stores/pluginStore';
import BooleanToggle from '@/components/graph/inputs/BooleanToggle.vue';
import type { ExtensionInfo, SortConfig, ColumnDefinition } from '@comfytavern/types';
import DataListView from '@/components/data-list/DataListView.vue';
import { ArrowPathIcon } from '@heroicons/vue/24/solid';

const { t } = useI18n();
const pluginStore = usePluginStore();
const dataListViewRef = ref<{ refresh: () => void } | null>(null);

const pluginFetcher = async (params: { sort?: SortConfig<ExtensionInfo> }) => {
  await pluginStore.fetchPlugins();
  const plugins = [...pluginStore.plugins];

  if (params.sort) {
    const { field, direction } = params.sort;
    plugins.sort((a, b) => {
      const valA = a[field as keyof ExtensionInfo];
      const valB = b[field as keyof ExtensionInfo];

      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      const comparison = String(valA).localeCompare(String(valB));
      return direction === 'asc' ? comparison : -comparison;
    });
  }
  return plugins;
};

const sortOptions = [
  { label: t('common.name'), field: 'displayName' },
  { label: t('common.version'), field: 'version' },
];

const columns: ColumnDefinition<ExtensionInfo>[] = [
  { key: 'displayName', label: t('common.name'), sortable: true, width: '30%' },
  { key: 'description', label: t('common.description'), sortable: false, width: '45%' },
  { key: 'version', label: t('common.version'), sortable: true, width: '10%' },
  { key: 'isEnabled', label: t('common.enabled'), sortable: true, width: '15%' },
];

const togglePluginStatus = (plugin: ExtensionInfo, isEnabled: boolean) => {
  pluginStore.setPluginEnabled(plugin.name, isEnabled);
};

/**
 * 重新加载插件列表。
 * 这个操作会请求后端重新扫描插件目录，用于发现新安装或删除的插件。
 * 它与切换插件的启用/禁用状态无关，状态切换是即时生效的。
 */
const reloadPlugins = async () => {
  await pluginStore.reloadPlugins();
  // 刷新视图以显示可能新增或移除的插件
  dataListViewRef.value?.refresh();
};
</script>