<template>
  <div class="plugin-manager h-full flex flex-col bg-background-base">
    <div class="flex-1 overflow-auto px-4">
      <DataListView
        ref="dataListViewRef"
        view-id="plugin-manager"
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
        show-refresh-button
        :is-refreshing="pluginStore.isLoading"
        @refresh="reloadPlugins"
      >
        <template #header>
          <div class="pt-4 pb-2">
            <h2 class="text-2xl font-bold text-text-base">{{ t('settings.plugins.title') }}</h2>
            <p class="text-sm text-text-secondary mt-1">{{ t('settings.plugins.description') }}</p>
          </div>
          <div class="border-t border-border-base opacity-60"></div>
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
            <div class="ml-auto mt-4 flex-shrink-0 flex items-center space-x-2">
              <button
                v-if="item.configOptions && item.configOptions.length > 0"
                @click="openPluginSettings(item)"
                class="p-2 rounded-md hover:bg-background-highlight transition-colors"
                v-comfy-tooltip="t('common.settings')"
              >
                <Cog6ToothIcon class="h-5 w-5 text-text-secondary" />
              </button>
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
            <div class="flex items-center justify-end space-x-2">
              <button
                v-if="item.configOptions && item.configOptions.length > 0"
                @click="openPluginSettings(item)"
                class="p-1.5 rounded-md hover:bg-background-highlight transition-colors"
                v-comfy-tooltip="t('common.settings')"
              >
                <Cog6ToothIcon class="h-4 w-4 text-text-secondary" />
              </button>
              <BooleanToggle
                :model-value="item.isEnabled ?? true"
                @update:model-value="togglePluginStatus(item, $event)"
                size="small"
                v-comfy-tooltip="item.isEnabled ? t('settings.plugins.disableTooltip') : t('settings.plugins.enableTooltip')"
                :disabled="pluginStore.isPluginPending(item.name)"
              />
            </div>
          </td>
        </template>
      </DataListView>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, markRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePluginStore } from '@/stores/pluginStore';
import { useUiStore } from '@/stores/uiStore';
import BooleanToggle from '@/components/graph/inputs/BooleanToggle.vue';
import type { ExtensionInfo, SortConfig, ColumnDefinition } from '@comfytavern/types';
import DataListView from '@/components/data-list/DataListView.vue';
import PluginDetailModal from './PluginDetailModal.vue';
import { Cog6ToothIcon } from '@heroicons/vue/24/outline';

const { t } = useI18n();
const pluginStore = usePluginStore();
const uiStore = useUiStore();
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

const openPluginSettings = (plugin: ExtensionInfo) => {
  console.log('Opening settings for plugin:', plugin.name, plugin);
  uiStore.openModalWithContent({
    component: markRaw(PluginDetailModal),
    props: {
      initialPlugin: plugin,
    },
    modalProps: {
      title: t('settings.plugins.configurationTitle', { pluginName: plugin.displayName }),
      width: '800px',
      height: 'calc(100vh - 120px)',
      showCloseIcon: true,
      closeOnBackdrop: false,
    },
  });
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