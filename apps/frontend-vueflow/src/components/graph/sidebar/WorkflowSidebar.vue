<template>
  <div class="workflow-sidebar">
    <!-- 左侧图标栏 -->
    <div class="sidebar-icon-bar">
      <!-- 返回主页按钮 -->
      <RouterLink to="/" class="icon-button w-full" v-comfy-tooltip="t('workflowSidebar.tooltips.goHome')">
        <span class="text-xl">🏠</span>
        <span class="tab-label">{{ t('workflowSidebar.buttons.goHome') }}</span>
      </RouterLink>

      <!-- 中间标签按钮 -->
      <div class="tab-buttons-container">
        <button v-for="tab in tabs" :key="tab.id" class="icon-button w-full" :class="{ 'active': activeTab === tab.id }" @click="setActiveTab(tab.id)" v-comfy-tooltip="t(tab.titleKey)">
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ t(tab.labelKey) }}</span>
        </button>
      </div>

      <!-- 底部控制按钮 -->
      <div class="bottom-buttons-container">
        <!-- 主题切换按钮 -->
        <button class="icon-button w-full" @click="cycleDisplayMode" v-comfy-tooltip="t('workflowSidebar.tooltips.toggleTheme')">
          <span class="tab-icon">
            <span v-if="displayMode === 'system'">💻</span>
            <span v-else-if="displayMode === 'light'">☀️</span>
            <span v-else>🌙</span> <!-- displayMode === 'dark' -->
          </span>
          <span class="tab-label">
            {{ displayMode === 'system' ? t('workflowSidebar.theme.system') : displayMode === 'dark' ? t('workflowSidebar.theme.dark') : t('workflowSidebar.theme.light') }}
          </span>
        </button>

        <!-- 设置按钮 -->
        <button class="icon-button w-full" @click="openSettings" v-comfy-tooltip="t('workflowSidebar.tooltips.settings')">
          <span class="tab-icon">⚙️</span>
          <span class="tab-label">{{ t('workflowSidebar.buttons.settings') }}</span>
        </button>
      </div>
    </div>

    <!-- 侧边栏内容区域 -->
    <div ref="sidebarContentRef" class="sidebar-content bg-background-surface" :style="{ width: activeTab ? '300px' : '0px' }">
      <component v-if="activeTab" :is="getTabComponent" @node-selected="nodeSelected" @add-node="addNodeToCanvas" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, markRaw, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router'; // 确保导入
import { useThemeStore, type DisplayMode } from '../../../stores/theme'; // 导入 DisplayMode
import { useUiStore } from '../../../stores/uiStore'; // 导入 UI Store
import NodePanel from './NodePanel.vue';
import WorkflowPanel from './WorkflowPanel.vue'; // 导入工作流面板
import GroupIOEdit from './GroupIOEdit.vue'; // <-- 导入接口编辑器
import HistoryPanel from './HistoryPanel.vue'; // <-- 导入历史记录面板
import WorkflowInfoPanel from './WorkflowInfoPanel.vue'; // <-- 导入工作流信息面板
import PerformancePanel from './PerformancePanel.vue'; // <-- 导入性能面板
// import Tooltip from '@/components/common/Tooltip.vue'; // 导入 Tooltip 组件
// import BaseModal from '../../common/BaseModal.vue'; // 不再需要
// import SettingsLayout from '../../settings/SettingsLayout.vue'; // 不再需要
import type { FrontendNodeDefinition } from '../../../stores/nodeStore';

// 定义标签页接口
interface SidebarTab {
  id: string;
  labelKey: string; // 改为翻译键
  titleKey: string; // 改为翻译键
  icon: string;
  component: any;
}

const { t } = useI18n();

const emit = defineEmits<{
  (e: 'add-node', nodeType: string, position?: { x: number, y: number }): void;
  (e: 'node-selected', node: FrontendNodeDefinition): void;
}>();

// 主题
const themeStore = useThemeStore();
const { displayMode } = storeToRefs(themeStore); // 获取 displayMode
const uiStore = useUiStore(); // 初始化 UI Store

function cycleDisplayMode() {
  const current = displayMode.value;
  let nextMode: DisplayMode;
  if (current === 'system') {
    nextMode = 'light';
  } else if (current === 'light') {
    nextMode = 'dark';
  } else { // current === 'dark'
    nextMode = 'system';
  }
  themeStore.setDisplayMode(nextMode);
}

const openSettings = () => {
  uiStore.openModalWithContent({
    component: defineAsyncComponent(() => import('../../settings/SettingsLayout.vue')),
    modalProps: {
      title: t('settings.title'),
      width: '60vw',
      height: '75vh',
    }
  });
};

// 定义可用的标签页
// 定义可用的标签页
const tabs = ref<SidebarTab[]>([
  {
    id: 'nodes',
    labelKey: 'workflowSidebar.tabs.nodes.label',
    titleKey: 'workflowSidebar.tabs.nodes.title',
    icon: '📦',
    component: markRaw(NodePanel)
  },
  {
    id: 'workflows',
    labelKey: 'workflowSidebar.tabs.workflows.label',
    titleKey: 'workflowSidebar.tabs.workflows.title',
    icon: '📁', // 使用文件夹图标
    component: markRaw(WorkflowPanel)
  },
  { // <-- 添加接口编辑器标签页
    id: 'interface',
    labelKey: 'workflowSidebar.tabs.interface.label',
    titleKey: 'workflowSidebar.tabs.interface.title',
    icon: '↔️', // 使用双向箭头图标
    component: markRaw(GroupIOEdit)
  },
  { // <-- 添加历史记录标签页
    id: 'history',
    labelKey: 'workflowSidebar.tabs.history.label',
    titleKey: 'workflowSidebar.tabs.history.title',
    icon: '📜', // 使用卷轴图标
    component: markRaw(HistoryPanel)
  },
  {
    id: 'performance',
    labelKey: 'workflowSidebar.tabs.performance.label',
    titleKey: 'workflowSidebar.tabs.performance.title',
    icon: '📊', // 使用条形图图标
    component: markRaw(PerformancePanel)
  },
  { // <-- 添加工作流信息标签页
    id: 'info',
    labelKey: 'workflowSidebar.tabs.info.label',
    titleKey: 'workflowSidebar.tabs.info.title',
    icon: 'ℹ️', // 使用信息图标
    component: markRaw(WorkflowInfoPanel)
  },
  // 未来可以添加更多标签页
]);
// 当前激活的标签页，可以为 null 表示关闭状态
const activeTab = ref<string | null>(null); // 当前激活的标签页 ID，null 表示关闭

// 控制设置模态框的显示状态 (已移至 uiStore)
// const isSettingsModalVisible = ref(false);

// 获取当前激活标签页的组件
const getTabComponent = computed(() => {
  const tab = tabs.value.find(t => t.id === activeTab.value);
  return tab ? tab.component : null;
});

// 设置激活的标签页，如果点击的是当前激活的标签，则关闭
const setActiveTab = (tabId: string) => {
  if (activeTab.value === tabId) {
    activeTab.value = null;
  } else {
    activeTab.value = tabId;
  }
};

// 处理子组件事件
const nodeSelected = (node: FrontendNodeDefinition) => {
  emit('node-selected', node);
};

const addNodeToCanvas = (nodeType: string, position?: { x: number, y: number }) => {
  emit('add-node', nodeType, position);
};

// 计算侧边栏是否可见（即是否有激活的标签页）
const isSidebarVisible = computed(() => activeTab.value !== null);

// 暴露状态和方法给父组件
const sidebarContentRef = ref<HTMLElement | null>(null);
const sidebarContentWidth = ref(0);
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (sidebarContentRef.value) {
    // 初始测量
    sidebarContentWidth.value = sidebarContentRef.value.offsetWidth;

    resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        sidebarContentWidth.value = entry.contentRect.width;
      }
    });
    resizeObserver.observe(sidebarContentRef.value);
  }
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

// 暴露状态和方法给父组件
defineExpose({
  isSidebarVisible,
  activeTab,
  setActiveTab, // 暴露 setActiveTab 方法给父组件
  sidebarContentWidth,
});
</script>

<style scoped>
.workflow-sidebar {
  @apply h-full flex bg-background-base;
}

.sidebar-icon-bar {
  @apply flex flex-col w-16 border-r border-border-base bg-background-surface items-center py-1 transition-all duration-300 ease-in-out;
  /* py-2 -> py-1 */
  /* 添加过渡 */
}

.icon-button {
  @apply flex flex-col items-center justify-center w-full py-1 px-1 text-text-muted hover:bg-neutral hover:bg-opacity-[var(--ct-component-hover-bg-opacity)] transition-colors cursor-pointer;
  /* py-2 -> py-1 */
  /* 调整内边距 */
}

.icon-button.active {
  @apply text-primary bg-primary bg-opacity-[var(--ct-menu-item-active-bg-opacity)] relative;
  /* 移除边框，用背景色区分 */
}

/* 可选：为激活状态添加一个细微的指示器 */
.icon-button.active::before {
  content: '';
  @apply absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-primary rounded-r-sm;
}


.tab-icon {
  @apply text-lg mb-1;
}

.tab-label {
  @apply text-[10px] font-medium leading-tight text-center;
  /* 调整字体大小和行高 */
}

.tab-buttons-container {
  @apply flex-1 flex flex-col items-center w-full overflow-y-auto gap-y-2 mt-6;
  /* Added mt-4 for separation */
  /* 允许标签按钮滚动 */
}

.bottom-buttons-container {
  @apply mt-auto flex flex-col items-center w-full border-t border-border-base pt-1;
  /* pt-2 -> pt-1 */
  /* 底部按钮容器 */
}

.sidebar-content {
  @apply flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out border-l border-background-base border-r border-border-base;
  /* 添加 flex-shrink-0 和过渡, 修改右边框颜色 */
}

/* 当没有激活标签页时，隐藏内容区域 */
.sidebar-content[style*="width: 0px"] {
  @apply border-l-0 border-r-0;
  /* 折叠时移除左边框 */
}
</style>