<template>
  <div class="display-mode-switcher">
    <label class="block font-medium text-text-base mb-1">显示模式:</label>
    <div class="flex space-x-2 rounded-md p-0.5 bg-background-surface" role="group">
      <button
        v-for="modeOption in modeOptions"
        :key="modeOption.value"
        type="button"
        @click="selectMode(modeOption.value)"
        :class="[
          'px-4 py-2 text-sm font-medium rounded-md transition-colors duration-150 ease-in-out',
          displayMode === modeOption.value
            ? 'bg-primary text-primary-content shadow-sm' // 选中状态: text-text-on-primary -> text-primary-content
            : 'text-text-base hover:bg-primary-softest focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50' // 未选中状态: text-text-base (保持)
        ]"
      >
        {{ modeOption.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useThemeStore, type DisplayMode } from '@/stores/theme';
import { storeToRefs } from 'pinia';

const themeStore = useThemeStore();
const { displayMode } = storeToRefs(themeStore);

interface ModeOption {
  label: string;
  value: DisplayMode;
}

const modeOptions: ModeOption[] = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
  { label: '系统', value: 'system' },
];

const selectMode = (mode: DisplayMode) => {
  themeStore.setDisplayMode(mode);
};
</script>

<style scoped>
/* 根据需要添加局部样式 */
.display-mode-switcher {
  /* 例如： margin-bottom: 1rem; */
}
</style>