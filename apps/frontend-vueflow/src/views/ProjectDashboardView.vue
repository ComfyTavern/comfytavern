<template>
  <div class="p-8">
    <h1 class="text-2xl font-bold mb-4 text-text-base">项目总览</h1>
    <p class="mb-6 text-text-muted">项目ID: {{ projectStore.currentProjectId }}</p>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- 编辑器入口 -->
      <div class="bg-background-surface p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
        <h2 class="text-xl font-semibold mb-2 text-text-base">工作流编辑器</h2>
        <p class="text-text-secondary mb-4">创建和管理您的 AI 工作流。</p>
        <router-link
          :to="{ name: 'ProjectEditor', params: { projectId: projectStore.currentProjectId } }"
          class="font-semibold text-primary hover:underline"
        >
          进入编辑器 &rarr;
        </router-link>
      </div>

      <!-- 占位符：Agents -->
      <div class="rounded-lg bg-neutral-softest p-6 shadow">
        <h2 class="text-xl font-semibold mb-2 text-text-muted">Agents (即将推出)</h2>
        <p class="text-text-muted">管理和部署智能代理。</p>
      </div>

      <!-- 占位符：场景 -->
      <div class="rounded-lg bg-neutral-softest p-6 shadow">
        <h2 class="text-xl font-semibold mb-2 text-text-muted">场景 (即将推出)</h2>
        <p class="text-text-muted">创建和管理交互式应用场景。</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useProjectStore } from '@/stores/projectStore'
import { onMounted } from 'vue';

const projectStore = useProjectStore()

onMounted(() => {
  // 可以在这里执行一些仪表盘初始化的逻辑
  console.log('ProjectDashboardView mounted for project:', projectStore.currentProjectId)
})
</script>