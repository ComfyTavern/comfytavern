<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-text-base">面板总览</h1>
      <button @click="openCreateModal"
        class="px-4 py-2 font-semibold text-primary-content bg-primary rounded-lg hover:bg-primary/90 transition-colors">
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
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
      <PanelCard
        v-for="panel in panelStore.panelList"
        :key="panel.id"
        :item="panel"
        @select="handlePanelSelect(panel)"
      >
        <template #actions>
          <div class="flex items-center justify-end w-full">
            <router-link
              :to="{ name: 'ProjectPanelSettings', params: { projectId: currentProjectId, panelId: panel.id } }"
              class="px-3 py-1 text-sm font-medium text-primary bg-primary-soft rounded-md hover:bg-primary-soft/80 whitespace-nowrap flex-shrink-0 mr-2 flex items-center"
              v-comfy-tooltip="'配置此面板的工作流绑定和接口'"
              @click.stop
            >
              <Cog6ToothIcon class="w-4 h-4" />
              <span class="ml-1">配置</span>
            </router-link>
            <router-link
              :to="{ name: 'ProjectPanel', params: { projectId: currentProjectId, panelId: panel.id } }"
              class="px-3 py-1 text-sm font-medium text-primary-content bg-primary rounded-md hover:bg-primary/90 flex items-center"
              v-comfy-tooltip="'在新标签页中打开面板'"
              @click.stop
            >
              <ArrowTopRightOnSquareIcon class="w-4 h-4" />
              <span class="ml-1">打开</span>
            </router-link>
            <router-link
              v-if="panel.devOptions?.devServerUrl"
              :to="{ name: 'ProjectPanel', params: { projectId: currentProjectId, panelId: panel.id }, query: { dev: 'true' } }"
              class="px-3 py-1 text-sm font-medium text-accent-content bg-accent rounded-md hover:bg-accent/90 flex items-center ml-2"
              v-comfy-tooltip="'以开发模式打开 (支持热更新)'"
              @click.stop
            >
              <BeakerIcon class="w-4 h-4" />
              <span class="ml-1">开发</span>
            </router-link>
          </div>
        </template>
      </PanelCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePanelStore } from '@/stores/panelStore';
import { useUiStore } from '@/stores/uiStore';
import { vComfyTooltip } from '@/directives/vComfyTooltip';
import { Cog6ToothIcon, ArrowTopRightOnSquareIcon, BeakerIcon } from '@heroicons/vue/24/outline';
import PanelCard from '@/components/panel/PanelCard.vue';
import type { PanelDefinition } from '@comfytavern/types';

const route = useRoute();
const router = useRouter();
const panelStore = usePanelStore();
const uiStore = useUiStore();

// 从路由参数中获取当前项目 ID
const currentProjectId = computed(() => route.params.projectId as string);

const handlePanelCreated = () => {
  // 列表已在 store action 中刷新，这里无需额外操作
  // 如果需要，可以在这里添加其他逻辑
};

const openCreateModal = () => {
  uiStore.openModal({
    component: defineAsyncComponent(() => import('@/components/panel/CreatePanelModal.vue')),
    props: {
      projectId: currentProjectId.value,
      onCreated: handlePanelCreated,
    },
    modalProps: {
      title: '新建面板',
    }
  });
};

const handlePanelSelect = (panel: PanelDefinition) => {
  router.push({ name: 'ProjectPanel', params: { projectId: currentProjectId.value, panelId: panel.id } });
};

onMounted(() => {
  if (currentProjectId.value) {
    // 组件挂载时获取面板列表
    panelStore.fetchPanelList(currentProjectId.value);
  }
});
</script>