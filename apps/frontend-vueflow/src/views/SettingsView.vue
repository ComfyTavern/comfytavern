<template>
  <div class="flex h-screen bg-background-base">
    <!-- 左侧边栏 由 HomeLayout 提供 -->
    <!-- <SideBar /> -->

    <!-- 主要内容区域, HomeLayout 会处理 padding-left -->
    <div class="flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out">
      <!-- :class="themeStore.collapsed ? 'ml-16' : 'ml-64'" REMOVED -->
      <SettingsLayout />
    </div>
  </div>
</template>

<script setup lang="ts">
// import SideBar from './SideBar.vue'; // SideBar 由 HomeLayout 提供
import SettingsLayout from '@/components/settings/SettingsLayout.vue';
// import { useThemeStore } from '@/stores/theme'; // REMOVED

// const themeStore = useThemeStore(); // REMOVED
</script>

<style scoped>
/* 可以根据需要添加样式 */
</style>