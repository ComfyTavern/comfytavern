<template>
  <div class="file-manager-layout flex flex-1 overflow-hidden h-full">
    <!-- 左侧导航栏 -->
    <aside class="sidebar-nav-container bg-background-surface shadow-lg flex-shrink-0 relative"
      :style="{ width: computedSidebarDynamicWidth }" data-testid="fm-sidebar-nav">
      <SidebarNav v-model:collapsed="isSidebarCollapsed" />
      <!-- 侧边栏拖拽调整器 -->
      <div v-if="!isSidebarCollapsed"
        class="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary-soft transition-colors duration-150 z-10"
        @mousedown.prevent="startResizeSidebar"
        title="Resize sidebar"
        data-testid="fm-sidebar-resizer">
        <!-- 样式已统一，内部线条移除 -->
      </div>
    </aside>

    <!-- 右侧主区域 -->
    <main class="main-content flex-1 flex flex-col overflow-hidden bg-background-base" data-testid="fm-main-content">
      <!-- 顶部工具栏 -->
      <header class="file-toolbar-container bg-background-surface border-b border-border-base flex-shrink-0"
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
          class="file-detail-panel-container bg-background-surface shadow-lg flex-shrink-0 overflow-y-auto border-l border-border-base"
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
import { useUiStore } from '@/stores/uiStore';

import SidebarNav from './SidebarNav.vue';
import FileToolbar from './FileToolbar.vue';
import FileBrowser from './FileBrowser.vue';
import FileDetailPanel from './FileDetailPanel.vue';
// import { ChevronLeftIcon } from '@heroicons/vue/24/outline'; // - 移除未使用的图标

// const fileManagerStore = useFileManagerStore(); // 不再直接使用 fileManagerStore 的状态来控制详情面板
const uiStore = useUiStore(); // + 初始化 uiStore

// 左侧导航栏折叠状态
const isSidebarCollapsed = computed({
  get: () => uiStore.isFileManagerSidebarCollapsed,
  set: (value) => uiStore.setFileManagerSidebarCollapsed(value),
});

// 左侧导航栏动态宽度
const computedSidebarDynamicWidth = computed(() => {
  if (isSidebarCollapsed.value) {
    return '4rem'; // 64px, 对应 Tailwind w-16
  }
  return `${uiStore.fileManagerSidebarWidth}px`;
});

// 详情面板可见性 (从 uiStore 获取)
const isDetailPanelVisible = computed(() => uiStore.isFileManagerDetailPanelOpen);
const detailPanelWidth = computed(() => uiStore.fileManagerDetailPanelWidth);

// 侧边栏拖拽调整逻辑
const isResizingSidebar = ref(false);
const initialMouseX = ref(0);
const initialSidebarWidthState = ref(0); // 使用一个不同的名字以避免与 store 中的属性混淆

const startResizeSidebar = (event: MouseEvent) => {
  if (isSidebarCollapsed.value) return; // 折叠时不允许拖拽

  isResizingSidebar.value = true;
  initialMouseX.value = event.clientX;
  initialSidebarWidthState.value = uiStore.fileManagerSidebarWidth; // 从 store 获取初始宽度

  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';

  window.addEventListener('mousemove', doResizeSidebar);
  window.addEventListener('mouseup', stopResizeSidebar);
};

const doResizeSidebar = (event: MouseEvent) => {
  if (!isResizingSidebar.value) return;

  const deltaX = event.clientX - initialMouseX.value;
  const newWidth = initialSidebarWidthState.value + deltaX;
  uiStore.setFileManagerSidebarWidth(newWidth); // store action 会处理 min/max
};

const stopResizeSidebar = () => {
  if (!isResizingSidebar.value) return;

  isResizingSidebar.value = false;
  // isSidebarTransitionDisabled.value = false; // 移除

  document.body.style.cursor = '';
  document.body.style.userSelect = '';

  window.removeEventListener('mousemove', doResizeSidebar);
  window.removeEventListener('mouseup', stopResizeSidebar);

  // 在拖拽结束后，持久化侧边栏宽度
  uiStore.persistFileManagerSidebarWidth();
};

// 响应式设计：根据屏幕宽度调整布局 (主要调整侧边栏，详情面板位置固定)
const screenWidth = ref(window.innerWidth);
const updateScreenWidth = () => screenWidth.value = window.innerWidth;

watch(screenWidth, (newWidth) => {
  if (newWidth < 768) { // Example breakpoint for mobile (e.g., Tailwind's 'md')
    if (!isSidebarCollapsed.value) { // 仅当未折叠时才自动折叠
      uiStore.setFileManagerSidebarCollapsed(true);
    }
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
  // 确保在组件卸载时移除拖拽监听器
  if (isResizingSidebar.value) {
    stopResizeSidebar();
  }
});

</script>

<style scoped>
.file-manager-layout {
  /* 确保布局撑满父容器 */
}

.sidebar-resizer {
  /* 拖拽条本身宽度，增加可点击区域 */
  width: 8px;
  background-color: transparent;
  /* 使其透明，依赖内部线条显示 */
}

.resizer-line {
  /* 实际显示的线条 */
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