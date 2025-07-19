<template>
  <div class="plugin-manager p-4 h-full flex flex-col">
    <div class="flex-shrink-0">
      <div class="flex flex-wrap gap-3 mb-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h2 class="text-2xl font-bold text-text-base">{{ t('settings.plugins.title') }}</h2>
          <p class="text-sm text-text-secondary mt-1">{{ t('settings.plugins.description') }}</p>
        </div>
        <button @click="handleReloadPlugins"
          class="px-4 py-2 bg-primary text-primary-content rounded-lg shadow hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap self-start"
          :disabled="isLoading || !hasPendingChanges">
          {{ t('settings.plugins.reloadButton') }}
        </button>
      </div>

      <div v-if="hasPendingChanges" class="mb-4 p-3 bg-warning/20 text-warning-content border border-warning rounded-lg">
        <p>{{ t('settings.plugins.pendingChanges') }}</p>
      </div>
    </div>

    <div class="flex-grow min-h-0">
      <div v-if="isLoading" class="text-center p-8 h-full flex items-center justify-center">
        <p>{{ t('common.loading') }}</p>
      </div>

      <div v-else-if="plugins.length === 0" class="text-center p-8 border-2 border-dashed border-border-base rounded-lg h-full flex items-center justify-center">
        <p class="text-text-secondary">{{ t('common.noResults') }}</p>
      </div>

      <OverlayScrollbarsComponent v-else class="h-full" :options="scrollbarOptions" defer>
        <div class="space-y-4 pr-2">
          <div v-for="plugin in plugins" :key="plugin.name"
            class="bg-background-surface rounded-lg shadow p-4 border border-border-base flex items-center">
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-text-base truncate" v-comfy-tooltip="plugin.displayName">
                {{ plugin.displayName }}
                <span class="text-sm text-text-secondary ml-2">v{{ plugin.version }}</span>
              </h3>
              <p class="text-sm text-text-secondary mt-1">{{ plugin.description }}</p>
            </div>
            <div class="ml-4 flex-shrink-0">
              <BooleanToggle
                :model-value="plugin.isEnabled ?? true"
                @update:model-value="togglePluginStatus(plugin, $event)"
                size="large"
                v-comfy-tooltip="plugin.isEnabled ? t('settings.plugins.disableTooltip') : t('settings.plugins.enableTooltip')"
              />
            </div>
          </div>
        </div>
      </OverlayScrollbarsComponent>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePluginStore } from '@/stores/pluginStore';
import { storeToRefs } from 'pinia';
import BooleanToggle from '@/components/graph/inputs/BooleanToggle.vue';
import type { ExtensionInfo } from '@comfytavern/types';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-vue';
import 'overlayscrollbars/overlayscrollbars.css';
import { useThemeStore } from '@/stores/theme';

const { t } = useI18n();
const pluginStore = usePluginStore();
const { plugins, isLoading, hasPendingChanges } = storeToRefs(pluginStore);
const themeStore = useThemeStore();

const scrollbarOptions = computed(() => ({
  scrollbars: {
    theme: themeStore.currentAppliedMode === 'dark' ? 'os-theme-light' : 'os-theme-dark',
    visibility: 'auto' as const,
    autoHide: 'scroll' as const,
    autoHideDelay: 800,
    dragScroll: true,
    clickScroll: true,
  },
}));

onMounted(() => {
  pluginStore.fetchPlugins();
});

const togglePluginStatus = (plugin: ExtensionInfo, isEnabled: boolean) => {
  pluginStore.setPluginEnabled(plugin.name, isEnabled);
};

const handleReloadPlugins = () => {
  pluginStore.reloadPlugins();
};
</script>