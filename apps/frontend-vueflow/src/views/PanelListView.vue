<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-text-base">应用面板</h1>
      <button class="btn btn-primary">
        <span class="icon-[fluent--add-12-filled] w-4 h-4"></span>
        <span class="ml-2">新建面板</span>
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="panelStore.isLoadingList" class="text-center py-10">
      <p class="text-text-secondary">正在加载面板列表...</p>
    </div>

    <!-- 列表为空 -->
    <div v-else-if="panelStore.panelList.length === 0" class="bg-background-surface p-6 rounded-lg shadow text-center">
      <p class="text-text-secondary">此项目还没有应用面板。</p>
    </div>

    <!-- 面板网格 -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      <router-link
        v-for="panel in panelStore.panelList"
        :key="panel.id"
        :to="{ name: 'ProjectPanel', params: { projectId: currentProjectId, panelId: panel.id } }"
        class="block bg-background-surface hover:bg-background--hover p-4 rounded-lg shadow transition-transform transform hover:-translate-y-1"
      >
        <div class="flex flex-col h-full">
          <h2 class="text-lg font-semibold text-text-base mb-2 truncate">{{ panel.displayName }}</h2>
          <p class="text-sm text-text-secondary flex-grow">{{ panel.description }}</p>
          <div class="text-xs text-text-disabled mt-4">
            <span>ID: {{ panel.id }}</span>
            <span class="mx-2">|</span>
            <span>v{{ panel.version }}</span>
          </div>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { usePanelStore } from '@/stores/panelStore';

const route = useRoute();
const panelStore = usePanelStore();

// 从路由参数中获取当前项目 ID
const currentProjectId = computed(() => route.params.projectId as string);

onMounted(() => {
  if (currentProjectId.value) {
    // 组件挂载时获取面板列表
    panelStore.fetchPanelList(currentProjectId.value);
  }
});
</script>