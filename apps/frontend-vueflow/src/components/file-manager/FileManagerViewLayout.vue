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

      <!-- 文件浏览器核心区域 和 详情面板 -->
      <div class="content-body flex flex-1 overflow-hidden">
        <!-- 文件浏览器核心区域 -->
        <div class="file-browser-container flex-1 overflow-y-auto">
          <FileBrowser />
        </div>

        <!-- 右侧文件详情面板 (可选) -->
        <aside v-if="isDetailPanelVisible"
          class="file-detail-panel-container bg-white dark:bg-gray-900 shadow-lg flex-shrink-0 overflow-y-auto border-l border-gray-200 dark:border-gray-700"
          :style="{ width: `${detailPanelWidth}px` }" data-testid="fm-detail-panel">
          <FileDetailPanel />
        </aside>
      </div>
    </main>
    <!-- 展开按钮已移至 FileToolbar.vue -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
// import { useFileManagerStore } from '@/stores/fileManagerStore'; // 移除未使用的导入
import { useUiStore } from '@/stores/uiStore'; // + 导入 uiStore

import SidebarNav from './SidebarNav.vue';
import FileToolbar from './FileToolbar.vue';
import FileBrowser from './FileBrowser.vue';
import FileDetailPanel from './FileDetailPanel.vue';
// import { ChevronLeftIcon } from '@heroicons/vue/24/outline'; // - 移除未使用的图标

// const fileManagerStore = useFileManagerStore(); // 不再直接使用 fileManagerStore 的状态来控制详情面板
const uiStore = useUiStore(); // + 初始化 uiStore

// 左侧导航栏折叠状态 (从 uiStore 获取和设置)
const isSidebarCollapsed = computed({
  get: () => uiStore.isFileManagerSidebarCollapsed,
  set: (value) => uiStore.setFileManagerSidebarCollapsed(value),
});

// 详情面板可见性 (从 uiStore 获取)
const isDetailPanelVisible = computed(() => uiStore.isFileManagerDetailPanelOpen);
const detailPanelWidth = computed(() => uiStore.fileManagerDetailPanelWidth);

// detailPanelPosition 和 detailPanelLayoutClasses 不再需要，因为布局已固定
// const detailPanelPosition = ref<'right' | 'bottom'>('right');
// const detailPanelLayoutClasses = computed(() => { ... });


// 响应式设计：根据屏幕宽度调整布局 (主要调整侧边栏，详情面板位置固定)
const screenWidth = ref(window.innerWidth);
const updateScreenWidth = () => screenWidth.value = window.innerWidth;

watch(screenWidth, (newWidth) => {
  if (newWidth < 768) { // Example breakpoint for mobile (e.g., Tailwind's 'md')
    uiStore.setFileManagerSidebarCollapsed(true); // Collapse sidebar on small screens
    // 详情面板现在固定在右侧，如果小屏幕需要不同行为（如隐藏），可以在这里添加逻辑
    // 例如: if (isDetailPanelVisible.value) { uiStore.closeFileManagerDetailPanel(); }
  } else {
    // On larger screens
    // Potentially un-collapse sidebar if it was auto-collapsed, or respect user's choice
    // uiStore.setFileManagerSidebarCollapsed(false); // 或者从用户偏好加载，或者保持当前状态
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