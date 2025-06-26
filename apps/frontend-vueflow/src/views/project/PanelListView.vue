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
      <div
        v-for="panel in panelStore.panelList"
        :key="panel.id"
        class="flex flex-col bg-background-surface rounded-lg shadow transition-shadow hover:shadow-lg"
      >
        <div class="p-4 flex-grow">
          <h2 class="text-lg font-semibold text-text-base mb-2 truncate">{{ panel.displayName }}</h2>
          <p class="text-sm text-text-secondary flex-grow min-h-[40px]">{{ panel.description }}</p>
          <div class="text-xs text-text-disabled mt-4">
            <span>ID: {{ panel.id }}</span>
            <span class="mx-2">|</span>
            <span>v{{ panel.version }}</span>
          </div>
        </div>
        <div class="flex items-center justify-end p-2 border-t border-border-base/40 bg-background-surface/60 rounded-b-lg">
          <router-link
            :to="{ name: 'ProjectPanelSettings', params: { projectId: currentProjectId, panelId: panel.id } }"
            class="btn btn-sm btn-secondary mr-2"
            v-comfy-tooltip="'配置此面板的工作流绑定和接口'"
          >
            <span class="icon-[fluent--settings-20-regular] w-4 h-4"></span>
            <span class="ml-1">配置</span>
          </router-link>
          <router-link
            :to="{ name: 'ProjectPanel', params: { projectId: currentProjectId, panelId: panel.id } }"
            class="btn btn-sm btn-primary"
            v-comfy-tooltip="'在新标签页中打开面板'"
          >
            <span class="icon-[fluent--open-20-regular] w-4 h-4"></span>
            <span class="ml-1">打开</span>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { usePanelStore } from '@/stores/panelStore';
import { vComfyTooltip } from '@/directives/vComfyTooltip';

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