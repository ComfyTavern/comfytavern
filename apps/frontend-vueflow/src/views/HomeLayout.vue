<template>
  <div class="min-h-screen bg-gray-100 dark:bg-gray-900 flex"> <!-- 改为 flex 布局 -->
    <SideBar />
    <main class="flex-1 overflow-x-hidden overflow-y-auto transition-all duration-300 ease-in-out"
          :style="{ paddingLeft: mainContentPaddingLeft }"> <!-- 主内容区域 -->
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup lang="ts">
import SideBar from './SideBar.vue';
// import { useThemeStore } from '../stores/theme'; // 移除未使用的 themeStore
import { useUiStore } from '@/stores/uiStore'; // + 引入 uiStore
import { computed } from 'vue'; // 引入 computed

// const themeStore = useThemeStore(); // 移除未使用的 themeStore 实例化
const uiStore = useUiStore(); // + 实例化 uiStore

// 根据侧边栏状态计算主内容的左内边距
const mainContentPaddingLeft = computed(() => {
  return uiStore.isMainSidebarCollapsed ? '4rem' : '16rem'; // + 使用 uiStore.isMainSidebarCollapsed
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 确保 main 区域能正确处理其内部内容的宽度 */
/* main { */
  /* 如果子组件是 w-full，它会相对于这个 main 元素的 padding box */
  /* 我们可能需要确保子组件不会超出 main 的可视区域 */
/* } */
</style>