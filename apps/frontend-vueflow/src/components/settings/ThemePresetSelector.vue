<template>
  <div class="theme-preset-selector">
    <label for="theme-select" class="block text-sm font-medium text-text-base mb-1">选择主题:</label>
    <select
      id="theme-select"
      v-model="selectedTheme"
      @change="onThemeChange"
      class="block w-full pl-3 pr-10 py-2 text-text-base border-border-base focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md bg-background-surface"
    >
      <option v-for="theme in availableThemes" :key="theme.id" :value="theme.id">
        {{ theme.name }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useThemeStore } from '@/stores/theme';
import { storeToRefs } from 'pinia';

const themeStore = useThemeStore();
const { availableThemes, selectedThemeId } = storeToRefs(themeStore);

// 使用 computed属性来双向绑定 select 的值
const selectedTheme = computed({
  get: () => selectedThemeId.value,
  set: (value) => {
    if (value) {
      themeStore.selectThemePreset(value);
    }
  }
});

// @change 事件处理器，虽然 computed set 已经处理了，但可以保留用于调试或额外逻辑
const onThemeChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  // themeStore.selectThemePreset(target.value); // 已由 computed set 处理
  console.log('Theme selected via @change:', target.value);
};
</script>

<style scoped>
/* 根据需要添加局部样式 */
.theme-preset-selector {
  /* 例如： margin-bottom: 1rem; */
}
</style>