<template>
  <div class="plugin-detail-modal flex flex-col h-full bg-background-base" v-if="currentPlugin">
    <!-- Header with Plugin Switcher -->
    <div class="p-4 border-b border-border-base">
      <label for="plugin-switcher" class="block text-sm font-medium text-text-secondary mb-1">
        {{ t('settings.plugins.switchTo') }}
      </label>
      <SelectInput
        id="plugin-switcher"
        v-model="currentPluginName"
        :suggestions="pluginOptions"
        :searchable="true"
        :apply-canvas-scale="false"
        size="large"
        class="w-full"
      />
    </div>

    <!-- Plugin Info and Settings -->
    <div class="flex-1 overflow-y-auto p-4">
      <div class="mb-6">
        <h2 class="text-xl font-bold text-text-base">{{ currentPlugin.displayName }}</h2>
        <p class="text-sm text-text-secondary mt-1">
          Version {{ currentPlugin.version }}
        </p>
        <p class="text-base text-text-secondary mt-4">{{ currentPlugin.description || t('common.noDescription') }}</p>
      </div>

      <div class="border-t border-border-base opacity-60 my-4"></div>

      <!-- Settings Panel -->
      <div v-if="currentPlugin.configOptions && currentPlugin.configOptions.length > 0">
        <h3 class="text-lg font-semibold text-text-base mb-3">{{ t('common.settings') }}</h3>
        <SettingsPanel :config="currentPlugin.configOptions" :key="currentPlugin.name" />
      </div>
      <div v-else class="text-center py-8 text-text-muted">
        <p>{{ t('settings.plugins.noConfiguration') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePluginStore } from '@/stores/pluginStore';
import type { ExtensionInfo } from '@comfytavern/types';
import SettingsPanel from '@/components/settings/SettingsPanel.vue';
import SelectInput from '@/components/graph/inputs/SelectInput.vue';

interface Props {
  initialPlugin: ExtensionInfo;
}

const props = defineProps<Props>();

const { t } = useI18n();
const pluginStore = usePluginStore();

// Internal state to manage the currently displayed plugin
const currentPlugin = ref<ExtensionInfo>(props.initialPlugin);
const currentPluginName = ref<string>(props.initialPlugin.name);

// Get all plugins that have configuration options
const configurablePlugins = computed(() => {
  return pluginStore.plugins.filter(p => p.configOptions && p.configOptions.length > 0);
});

// Format plugins for SelectInput component
const pluginOptions = computed(() => {
  return configurablePlugins.value.map(p => ({
    value: p.name,
    label: p.displayName,
  }));
});

// Watch for changes in the dropdown selection
watch(currentPluginName, (newName) => {
  const selectedPlugin = pluginStore.plugins.find(p => p.name === newName);
  if (selectedPlugin) {
    currentPlugin.value = selectedPlugin;
  }
});

// Watch for prop changes, in case the modal is re-used with a new initial plugin
watch(() => props.initialPlugin, (newInitialPlugin) => {
  if (newInitialPlugin && newInitialPlugin.name !== currentPlugin.value.name) {
    currentPlugin.value = newInitialPlugin;
    currentPluginName.value = newInitialPlugin.name;
  }
});
</script>

<style scoped>
/* Add any specific styles for the modal here if needed */
</style>