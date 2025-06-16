<template>
  <div class="workflow-panel p-4 h-full flex flex-col bg-background-surface text-text-base"> 
    <h3 class="text-lg font-semibold mb-4 border-b pb-2 border-border-base">工作流</h3>

    <!-- 搜索框 (可选) -->
    <div class="mb-3">
      <input type="text" v-model="searchTerm" placeholder="搜索工作流..."
        class="w-full px-2 py-1 border rounded bg-background-base border-border-base focus:outline-none focus:ring-1 focus:ring-primary"> 
    </div>

    <!-- 刷新按钮 -->
    <div class="mb-3">
      <button @click="handleRefresh" class="toolbar-button w-full justify-center" :disabled="loadingWorkflows">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 mr-2 flex-shrink-0"
          :class="{ 'animate-spin': loadingWorkflows }">
          <path fill-rule="evenodd" clip-rule="evenodd"
            d="M4.5 12a7.5 7.5 0 0 1 13.8-4.07l-2-.4a1.5 1.5 0 0 0-.6 2.94l5 1c.76.15 1.51-.3 1.74-1.04l1.5-5a1.5 1.5 0 1 0-2.88-.86l-.43 1.45A10.49 10.49 0 0 0 1.5 12a10.5 10.5 0 0 0 20.4 3.5 1.5 1.5 0 1 0-2.83-1A7.5 7.5 0 0 1 4.5 12Z"
            fill="currentColor"></path>
        </svg>
        刷新列表
      </button>
    </div>

    <!-- 工作流列表 -->
    <!-- Remove overflow-y-auto, add flex-1 to OverlayScrollbarsComponent -->
    <OverlayScrollbarsComponent
      :options="{ scrollbars: { autoHide: 'scroll', theme: isDark ? 'os-theme-light' : 'os-theme-dark' } }"
      class="flex-1 border rounded border-border-base" defer>
      <div v-if="loadingWorkflows" class="p-4 text-center text-text-muted">加载中...</div>
      <div v-else-if="filteredWorkflows.length === 0" class="p-4 text-center text-text-muted">
        {{ availableWorkflows.length === 0 ? '没有可加载的工作流。' : '没有匹配的工作流。' }}
      </div>
      <ul v-else>
        <li v-for="wf in filteredWorkflows" :key="wf.id"
          class="p-3 hover:bg-background-hover cursor-pointer flex justify-between items-center border-b border-border-base last:border-b-0"
          @click="handleLoad(wf.id)">
          <!-- 分开名称 Tooltip 和 状态 Tooltip -->
          <div class="flex items-center flex-grow min-w-0 mr-2"> <!-- 包裹名称和图标 -->
            <Tooltip :content="`点击加载 **${wf.name}**\n\n---\n${wf.description || '没有描述'}`" placement="top-start"
              :offsetValue="8" :showDelay="500" triggerClass="truncate flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                stroke="currentColor" class="w-4 h-4 mr-2 text-text-muted flex-shrink-0">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75c0-.231-.035-.454-.1-.664M6.75 7.5H18a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25H6.75a2.25 2.25 0 0 1-2.25-2.25v-9a2.25 2.25 0 0 1 2.25-2.25Z" />
              </svg>
              <span class="truncate">{{ wf.name }}</span>
            </Tooltip>
            <!-- 状态徽章 Tooltip 移到外面 -->
            <Tooltip v-if="wf.isOrphanGroup" content="这是一个由“创建组”产生且当前未被引用的工作流" placement="top">
              <span
                class="ml-2 text-xs px-1.5 py-0.5 rounded bg-warning/20 text-warning flex-shrink-0">
                未使用
              </span>
            </Tooltip>
            <Tooltip v-else-if="wf.referenceCount > 0" :content="`被 ${wf.referenceCount} 个工作流引用`" placement="top">
              <span
                class="ml-2 text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary flex-shrink-0">
                {{ wf.referenceCount }}
              </span>
            </Tooltip>
          </div>
          <div class="flex items-center flex-shrink-0"> <!-- 包裹按钮 -->
            <Tooltip content="删除">
              <button @click.stop="handleDelete(wf.id)"
                class="text-error hover:text-error ml-2 p-1 rounded hover:bg-error-softest opacity-70 hover:opacity-100">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                  stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round"
                    d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
            </Tooltip>
          </div>
        </li>
      </ul>
    </OverlayScrollbarsComponent>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useWorkflowStore } from '@/stores/workflowStore';
import { storeToRefs } from 'pinia';
import { useTabStore } from '@/stores/tabStore'; // Import tabStore
import { useProjectStore } from '@/stores/projectStore'; // Import projectStore
import Tooltip from '@/components/common/Tooltip.vue'; // 导入 Tooltip 组件
// import { useVueFlow } from '@vue-flow/core'; // Remove unused import
// Import OverlayScrollbars and theme
import { OverlayScrollbarsComponent } from "overlayscrollbars-vue";
import 'overlayscrollbars/overlayscrollbars.css';
import { useThemeStore } from "@/stores/theme";
import { useDialogService } from '@/services/DialogService'; // 导入 DialogService

const workflowStore = useWorkflowStore();
const tabStore = useTabStore(); // Get tabStore instance
const projectStore = useProjectStore(); // Get projectStore instance
const { availableWorkflows } = storeToRefs(workflowStore);
const themeStore = useThemeStore(); // Get theme store instance
const isDark = computed(() => themeStore.currentAppliedMode === 'dark'); // Get isDark state
const dialogService = useDialogService(); // 获取 DialogService 实例
// const { activeTabId } = storeToRefs(tabStore); // Removed unused activeTabId
// const vueFlow = useVueFlow(); // Remove unused variable

const loadingWorkflows = ref(false);
const searchTerm = ref('');

// 计算过滤后的工作流列表

// 计算引用计数和孤儿状态
const workflowsWithStats = computed(() => {
  const referenceCounts = new Map<string, number>();
  const allWorkflows = availableWorkflows.value;

  // 初始化所有工作流的引用计数为 0
  allWorkflows.forEach(wf => {
    referenceCounts.set(wf.id, 0);
  });

  // 遍历计算引用
  allWorkflows.forEach(referencingWf => {
    if (Array.isArray(referencingWf.referencedWorkflows)) {
      referencingWf.referencedWorkflows.forEach(referencedId => {
        if (referenceCounts.has(referencedId)) {
          referenceCounts.set(referencedId, (referenceCounts.get(referencedId) || 0) + 1);
        }
      });
    }
  });

  // 添加统计信息到每个工作流对象
  return allWorkflows.map(wf => {
    const count = referenceCounts.get(wf.id) || 0;
    const isOrphan = wf.creationMethod === 'group' && count === 0;
    return {
      ...wf,
      referenceCount: count,
      isOrphanGroup: isOrphan,
    };
  });
});

// 计算过滤后的工作流列表 (基于包含统计信息的工作流)
const filteredWorkflows = computed(() => {
  const sourceWorkflows = workflowsWithStats.value; // 使用包含统计信息的数据源
  if (!searchTerm.value) {
    return sourceWorkflows;
  }
  const lowerSearchTerm = searchTerm.value.toLowerCase();
  // 从 workflowsWithStats 过滤
  return sourceWorkflows.filter(wf =>
    wf.name.toLowerCase().includes(lowerSearchTerm) ||
    wf.id.toLowerCase().includes(lowerSearchTerm)
  );
});

const handleRefresh = async () => {
  loadingWorkflows.value = true;
  await workflowStore.fetchAvailableWorkflows();
  loadingWorkflows.value = false;
};

const handleLoad = async (workflowId: string) => {
  const workflowToLoad = availableWorkflows.value.find(wf => wf.id === workflowId);
  if (!workflowToLoad) {
    console.error(`WorkflowPanel: Workflow with ID ${workflowId} not found in available list.`);
    dialogService.showError("无法加载工作流：未在列表中找到。");
    return;
  }

  const currentProjectId = projectStore.currentProjectId;
  if (!currentProjectId) {
    console.error("WorkflowPanel: Cannot load workflow, current project ID is missing.");
    dialogService.showError("无法加载工作流：缺少项目信息。");
    return;
  }

  // 检查是否已存在该工作流的标签页
  const existingTab = tabStore.tabs.find(tab =>
    tab.type === 'workflow' &&
    tab.associatedId === workflowId &&
    tab.projectId === currentProjectId
  );

  if (existingTab) {
    // 激活已存在的标签页
    tabStore.setActiveTab(existingTab.internalId);
    console.log(`WorkflowPanel: Activated existing workflow tab ${existingTab.internalId} for workflow ${workflowId}`);
  } else {
    // 添加新标签页
    const newTab = tabStore.addTab('workflow', workflowToLoad.name || `工作流 ${workflowId.substring(0, 6)}`, workflowId, true, currentProjectId);
    console.log(`WorkflowPanel: Opened new workflow tab ${newTab?.internalId} for workflow ${workflowId}`);
  }
};

const handleDelete = async (workflowId: string) => {
  // 确认对话已在 store action 中处理
  await workflowStore.deleteWorkflow(workflowId);
};

// 组件挂载时获取列表
onMounted(() => {
  handleRefresh();
});
</script>

<style scoped>
.workflow-panel {
  /* 面板特定样式 */
}

.toolbar-button {
  @apply px-3 py-1.5 rounded text-text-base bg-neutral/20 hover:bg-neutral/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm transition-colors; /* text-text-default -> text-text-base, bg-background-neutral-soft -> bg-neutral/20, hover:bg-background-neutral -> hover:bg-neutral/30 */
}
</style>