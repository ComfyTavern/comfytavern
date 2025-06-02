<template>
  <div class="sidebar-manager" :class="{ 'dark': isDark }">
    <!-- 左侧图标栏 -->
    <div class="sidebar-icon-bar">
      <!-- 返回主页按钮 -->
      <Tooltip content="返回主页" triggerClass="w-full">
        <RouterLink to="/" class="icon-button">
          <span class="text-xl">🏠</span>
          <span class="tab-label">返回</span>
        </RouterLink>
      </Tooltip>

      <!-- 中间标签按钮 -->
      <div class="tab-buttons-container">
        <Tooltip v-for="tab in tabs" :key="tab.id" :content="tab.title" triggerClass="w-full">
          <button class="icon-button" :class="{ 'active': activeTab === tab.id }" @click="setActiveTab(tab.id)">
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ tab.label }}</span>
          </button>
        </Tooltip>
      </div>

      <!-- 底部控制按钮 -->
      <div class="bottom-buttons-container">
        <!-- 主题切换按钮 -->
        <Tooltip content="切换主题" triggerClass="w-full">
          <button class="icon-button" @click="themeStore.toggleTheme()">
            <span class="tab-icon">
              <span v-if="themeStore.theme === 'system'">💻</span>
              <span v-else-if="themeStore.theme === 'light'">☀️</span>
              <span v-else>🌙</span>
            </span>
            <span class="tab-label">
              {{ themeStore.theme === 'system' ? '系统' : themeStore.theme === 'dark' ? '暗色' : '亮色' }}
            </span>
          </button>
        </Tooltip>

        <!-- 设置按钮 -->
        <Tooltip content="设置" triggerClass="w-full">
          <button class="icon-button">
            <span class="tab-icon">⚙️</span>
            <span class="tab-label">设置</span>
          </button>
        </Tooltip>
      </div>
    </div>

    <!-- 侧边栏内容区域 -->
    <div class="sidebar-content" :style="{ width: activeTab ? '300px' : '0px' }">
      <component v-if="activeTab" :is="getTabComponent" @node-selected="nodeSelected" @add-node="addNodeToCanvas" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, markRaw } from 'vue';
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router'; // 确保导入
import { useThemeStore } from '../../../stores/theme';
import NodePanel from './NodePanel.vue';
import WorkflowPanel from './WorkflowPanel.vue'; // 导入工作流面板
import GroupIOEdit from './GroupIOEdit.vue'; // <-- 导入接口编辑器
import HistoryPanel from './HistoryPanel.vue'; // <-- 导入历史记录面板
import WorkflowInfoPanel from './WorkflowInfoPanel.vue'; // <-- 导入工作流信息面板
import Tooltip from '@/components/common/Tooltip.vue'; // 导入 Tooltip 组件
import type { FrontendNodeDefinition } from '../../../stores/nodeStore';

// 定义标签页接口
interface SidebarTab {
  id: string;
  label: string;
  title: string;
  icon: string;
  component: any;
}

const emit = defineEmits<{
  (e: 'add-node', nodeType: string, position?: { x: number, y: number }): void;
  (e: 'node-selected', node: FrontendNodeDefinition): void;
}>();

// 主题
const themeStore = useThemeStore();
const { isDark } = storeToRefs(themeStore);

// 定义可用的标签页
const tabs = ref<SidebarTab[]>([
  {
    id: 'nodes',
    label: '节点',
    title: '节点库',
    icon: '📦',
    component: markRaw(NodePanel)
  },
  {
    id: 'workflows',
    label: '工作流',
    title: '工作流管理',
    icon: '📁', // 使用文件夹图标
    component: markRaw(WorkflowPanel)
  },
  { // <-- 添加接口编辑器标签页
    id: 'interface',
    label: '接口',
    title: '工作流接口',
    icon: '↔️', // 使用双向箭头图标
    component: markRaw(GroupIOEdit)
  },
  { // <-- 添加历史记录标签页
    id: 'history',
    label: '历史',
    title: '操作历史',
    icon: '📜', // 使用卷轴图标
    component: markRaw(HistoryPanel)
  },
  { // <-- 添加工作流信息标签页
    id: 'info',
    label: '信息',
    title: '工作流信息',
    icon: 'ℹ️', // 使用信息图标
    component: markRaw(WorkflowInfoPanel)
  },
  // 未来可以添加更多标签页
]);

// 当前激活的标签页，可以为 null 表示关闭状态
const activeTab = ref<string | null>(null); // 当前激活的标签页 ID，null 表示关闭

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
defineExpose({
  isSidebarVisible,
  activeTab,
  setActiveTab // 暴露 setActiveTab 方法给父组件
});
</script>

<style scoped>
.sidebar-manager {
  @apply h-full flex bg-white dark:bg-gray-800;
}

.sidebar-icon-bar {
  @apply flex flex-col w-12 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 items-center py-1 transition-all duration-300 ease-in-out; /* py-2 -> py-1 */
  /* 添加过渡 */
}

.icon-button {
  @apply flex flex-col items-center justify-center w-full py-1 px-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer; /* py-2 -> py-1 */
  /* 调整内边距 */
}

.icon-button.active {
  @apply text-blue-500 dark:text-blue-400 bg-gray-100 dark:bg-gray-700 relative;
  /* 移除边框，用背景色区分 */
}

/* 可选：为激活状态添加一个细微的指示器 */
.icon-button.active::before {
  content: '';
  @apply absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-blue-500 dark:bg-blue-400 rounded-r-sm;
}


.tab-icon {
  @apply text-lg mb-1;
}

.tab-label {
  @apply text-[10px] font-medium leading-tight text-center;
  /* 调整字体大小和行高 */
}

.tab-buttons-container {
  @apply flex-1 flex flex-col items-center w-full overflow-y-auto gap-y-2 mt-6; /* Added mt-4 for separation */
  /* 允许标签按钮滚动 */
}

.bottom-buttons-container {
  @apply mt-auto flex flex-col items-center w-full border-t border-gray-200 dark:border-gray-700 pt-1; /* pt-2 -> pt-1 */
  /* 底部按钮容器 */
}

.sidebar-content {
  @apply flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out border-l border-gray-200 dark:border-gray-700;
  /* 添加 flex-shrink-0 和过渡 */
}

/* 当没有激活标签页时，隐藏内容区域 */
.sidebar-content[style*="width: 0px"] {
  @apply border-l-0;
  /* 折叠时移除左边框 */
}
</style>