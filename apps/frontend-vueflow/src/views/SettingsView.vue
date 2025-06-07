<template>
  <div class="flex h-screen bg-gray-100 dark:bg-gray-900">
    <!-- 左侧边栏 -->
    <SideBar />

    <!-- 主要内容区域 -->
    <div class="flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out" :class="themeStore.collapsed ? 'ml-16' : 'ml-64'">
      <SettingsLayout />
    </div>
  </div>
</template>

<script setup lang="ts">
import SideBar from './SideBar.vue';
import SettingsLayout from '@/components/settings/SettingsLayout.vue';
import { useThemeStore } from '@/stores/theme';

const themeStore = useThemeStore();
</script>

<style scoped>
/* 可以根据需要添加样式 */
</style>