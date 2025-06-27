<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-text-base">应用面板</h1>
      <button class="btn btn-brand-primary">
        新建面板
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="panelStore.isLoadingList" class="text-center py-10">
      <p class="text-text-secondary">正在加载面板列表...</p>
    </div>

    <!-- 列表为空 -->
    <div v-else-if="panelStore.panelList.length === 0"
      class="text-center p-12 border-2 border-dashed border-border-base rounded-lg">
      <p class="text-text-secondary">此项目还没有应用面板。</p>
    </div>

    <!-- 面板网格 -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      <div v-for="panel in panelStore.panelList" :key="panel.id"
        class="flex flex-col bg-background-surface rounded-lg shadow-md transition-all duration-200 border border-border-base/20 hover:shadow-lg hover:border-primary/40">
        <div class="p-4 flex-grow">
          <h2 class="text-lg font-semibold text-text-base mb-2 truncate">{{ panel.displayName }}</h2>
          <p class="text-sm text-text-secondary flex-grow min-h-[40px]">{{ panel.description }}</p>
          <div class="text-xs text-text-disabled mt-4">
            <span>ID: {{ panel.id }}</span>
            <span class="mx-2">|</span>
            <span>v{{ panel.version }}</span>
          </div>
        </div>
        <div class="flex items-center justify-end p-3 bg-background-surface/50 border-t border-border-base rounded-b-lg">
          <router-link
            :to="{ name: 'ProjectPanelSettings', params: { projectId: currentProjectId, panelId: panel.id } }"
            class="px-3 py-1 text-sm font-medium text-primary bg-primary-soft rounded-md hover:bg-primary-soft/80 whitespace-nowrap flex-shrink-0 mr-2 flex items-center"
            v-comfy-tooltip="'配置此面板的工作流绑定和接口'">
            <IconSettings class="w-4 h-4" />
            <span class="ml-1">配置</span>
          </router-link>
          <router-link :to="{ name: 'ProjectPanel', params: { projectId: currentProjectId, panelId: panel.id } }"
            class="px-3 py-1 text-sm font-medium text-primary-content bg-primary rounded-md hover:bg-primary/90 flex items-center"
            v-comfy-tooltip="'在新标签页中打开面板'">
            <IconOpen class="w-4 h-4" />
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
import IconSettings from '@/components/icons/IconSettings.vue';
import IconOpen from '@/components/icons/IconOpen.vue';

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