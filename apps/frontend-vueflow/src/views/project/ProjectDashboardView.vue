<template>
  <div class="p-8">
    <h1 class="text-2xl font-bold mb-4 text-text-base">项目总览</h1>
    <p class="mb-6 text-text-muted">项目ID: {{ projectStore.currentProjectId }}</p>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <!-- 编辑器入口 -->
      <div class="bg-background-surface p-6 rounded-lg shadow hover:shadow-lg transition-shadow flex flex-col">
        <h2 class="text-xl font-semibold mb-2 text-text-base">工作流编辑器</h2>
        <p class="text-text-secondary mb-4 flex-grow">创建和管理您的 AI 工作流。</p>
        <router-link
          :to="{ name: 'ProjectEditor', params: { projectId: projectStore.currentProjectId } }"
          class="font-semibold text-primary hover:underline"
        >
          进入编辑器 &rarr;
        </router-link>
      </div>

      <!-- 应用面板入口 -->
      <div class="bg-background-surface p-6 rounded-lg shadow hover:shadow-lg transition-shadow flex flex-col">
        <h2 class="text-xl font-semibold mb-2 text-text-base">应用面板</h2>
        <p class="text-text-secondary mb-4 flex-grow">运行和管理封装为应用的交互式工作流。</p>
        <router-link
          :to="{ name: 'ProjectPanels', params: { projectId: projectStore.currentProjectId } }"
          class="font-semibold text-primary hover:underline"
        >
          管理面板 &rarr;
        </router-link>
      </div>

      <!-- API 适配器 -->
      <div class="bg-background-surface p-6 rounded-lg shadow hover:shadow-lg transition-shadow flex flex-col">
        <h2 class="text-xl font-semibold mb-2 text-text-base">API 适配器</h2>
        <p class="text-text-secondary mb-4 flex-grow">将工作流封装为标准API，供应用面板或外部服务调用。</p>
        <router-link
          :to="{ name: 'ProjectApiAdapters', params: { projectId: projectStore.currentProjectId } }"
          class="font-semibold text-primary hover:underline"
        >
          管理适配器 &rarr;
        </router-link>
      </div>
    </div>

    <!-- 最近工作流 -->
    <div class="bg-background-surface rounded-lg shadow p-6">
      <h2 class="text-xl font-semibold text-text-base mb-4">最近工作流</h2>
      <div>
        <div v-if="isLoading" class="text-center text-text-muted">
          正在加载工作流...
        </div>
        <div v-else-if="error" class="text-center text-error">
          加载工作流失败: {{ error }}
        </div>
        <div v-else-if="recentWorkflows.length === 0" class="text-center text-text-muted">
          没有找到工作流。
          <router-link :to="{ name: 'ProjectEditor', params: { projectId: projectStore.currentProjectId } }" class="text-primary hover:underline ml-2">创建一个新的工作流</router-link>
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="workflow in recentWorkflows" :key="workflow.id"
            class="bg-background-surface p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer"
            @click="openWorkflow(workflow.id)">
            <h3 class="font-semibold text-lg text-text-base mb-2 truncate">{{ workflow.name }}</h3>
            <p class="text-sm text-text-secondary mb-1">
              最后修改: {{ formatDate(workflow.updatedAt) }}
            </p>
            <p class="text-sm text-text-muted truncate">
              {{ workflow.description || '暂无描述' }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useProjectStore } from '@/stores/projectStore';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useTabStore, type Tab } from '@/stores/tabStore';
import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

const projectStore = useProjectStore();
const workflowStore = useWorkflowStore();
const tabStore = useTabStore();
const router = useRouter();
const { locale } = useI18n();

const { availableWorkflows } = storeToRefs(workflowStore);
const isLoading = ref(false);
const error = ref<string | null>(null);

const fetchWorkflows = async () => {
  isLoading.value = true;
  error.value = null;
  try {
    await workflowStore.fetchAvailableWorkflows();
  } catch (err) {
    console.error('加载工作流列表失败:', err);
    error.value = `加载工作流列表失败: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    isLoading.value = false;
  }
};

const openWorkflow = (workflowId: string) => {
  const projectId = projectStore.currentProjectId;
  if (projectId) {
    // 查找工作流以获取其名称
    const workflow = availableWorkflows.value.find(w => w.id === workflowId);
    const workflowName = workflow ? workflow.name : '未命名工作流';

    // 使用 tabStore 打开或切换到工作流标签页
    const existingTab = tabStore.tabs.find((tab: Tab) =>
      tab.type === 'workflow' &&
      tab.associatedId === workflowId &&
      tab.projectId === projectId
    );

    if (existingTab) {
      tabStore.setActiveTab(existingTab.internalId);
    } else {
      tabStore.addTab('workflow', workflowName, workflowId, true, projectId);
    }
    // 跳转到编辑器视图
    router.push({ name: 'ProjectEditor', params: { projectId } });
  }
};

// 计算最近的工作流
const recentWorkflows = computed(() => {
  const workflows = Array.isArray(availableWorkflows.value) ? availableWorkflows.value : [];
  return [...workflows]
    .sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 6);
});

const formatDate = (dateString?: string | Date) => {
  if (!dateString) return '未知日期';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return '无效日期';
  }
  return date.toLocaleString(locale.value, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

onMounted(() => {
  fetchWorkflows();
  console.log('ProjectDashboardView mounted for project:', projectStore.currentProjectId);
});
</script>