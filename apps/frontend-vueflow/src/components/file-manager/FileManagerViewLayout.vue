<template>
  <div class="file-manager-layout flex flex-1 overflow-hidden h-full">
    <!-- 左侧导航栏 -->
    <aside
      class="sidebar-nav-container bg-white dark:bg-gray-900 shadow-lg transition-all duration-300 ease-in-out flex-shrink-0"
      :class="isSidebarCollapsed ? 'w-16 hover:w-64 group' : 'w-64'" data-testid="fm-sidebar-nav">
      <SidebarNav v-model:collapsed="isSidebarCollapsed" />
    </aside>

    <!-- 右侧主区域 -->
    <main class="main-content flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-800"
      data-testid="fm-main-content">
      <!-- 顶部工具栏 -->
      <header
        class="file-toolbar-container bg-white dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
        data-testid="fm-toolbar">
        <FileToolbar />
      </header>

      <!-- 文件浏览器核心区域 -->
      <div class="file-browser-container flex-1 overflow-y-auto">
        <FileBrowser />
      </div>
    </main>

    <!-- 右侧/底部文件详情面板 (可选) -->
    <aside v-if="isDetailPanelVisible"
      class="file-detail-panel-container bg-white dark:bg-gray-900 shadow-lg transition-transform duration-300 ease-in-out flex-shrink-0 overflow-y-auto"
      :class="detailPanelClasses" data-testid="fm-detail-panel">
      <FileDetailPanel />
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useFileManagerStore } from '@/stores/fileManagerStore';

import SidebarNav from './SidebarNav.vue';
import FileToolbar from './FileToolbar.vue';
import FileBrowser from './FileBrowser.vue';
import FileDetailPanel from './FileDetailPanel.vue';

const fileManagerStore = useFileManagerStore();

// 左侧导航栏折叠状态
const isSidebarCollapsed = ref(false); // TODO: 可以从 store 或用户偏好设置读取初始值

// 详情面板可见性 (从 store 获取)
const isDetailPanelVisible = computed(() => fileManagerStore.isDetailPanelVisible);

// 详情面板位置 (示例，可以根据屏幕宽度或用户设置动态改变)
const detailPanelPosition = ref<'right' | 'bottom'>('right'); // Default to right

const detailPanelClasses = computed(() => {
  if (detailPanelPosition.value === 'right') {
    return 'w-72 md:w-80 lg:w-96 transform translate-x-0'; // Adjust width as needed
  }
  // For bottom panel, it might take full width and a portion of height
  return 'w-full h-1/3 border-t dark:border-gray-700 fixed bottom-0 left-0 right-0 transform translate-y-0 md:relative md:h-auto md:border-t-0 md:border-l';
});


// 响应式设计：根据屏幕宽度调整布局
const screenWidth = ref(window.innerWidth);
const updateScreenWidth = () => screenWidth.value = window.innerWidth;

watch(screenWidth, (newWidth) => {
  if (newWidth < 768) { // Example breakpoint for mobile (e.g., Tailwind's 'md')
    isSidebarCollapsed.value = true; // Collapse sidebar on small screens
    if (isDetailPanelVisible.value) { // If detail panel is open on small screen, move to bottom
      detailPanelPosition.value = 'bottom';
    }
  } else {
    // On larger screens, default to right panel if it was bottom due to screen size
    if (detailPanelPosition.value === 'bottom' && newWidth >= 768) {
      detailPanelPosition.value = 'right';
    }
    // Potentially un-collapse sidebar if it was auto-collapsed, or respect user's choice
    // isSidebarCollapsed.value = false; // Or load from user preference
  }
}, { immediate: true });

onMounted(() => {
  window.addEventListener('resize', updateScreenWidth);
  updateScreenWidth(); // Initial check
});

onUnmounted(() => {
  window.removeEventListener('resize', updateScreenWidth);
});

</script>

<style scoped>
.file-manager-layout {
  /* 确保布局撑满父容器 */
}

/* Ensure smooth transitions for panel movements */
.file-detail-panel-container {
  transition-property: width, height, transform;
}

/* Styles for when detail panel is on the bottom */
.file-detail-panel-container.h-1\/3 {
  /* Add specific styles if needed for bottom position */
}

/* 当侧边栏折叠时，hover时展开的交互（如果需要更复杂的交互） */
/* .sidebar-nav-container.group:hover {
   width: 16rem;
} */
</style>