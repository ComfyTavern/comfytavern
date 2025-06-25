<script setup lang="ts">
import { ref, watchEffect, onMounted, computed } from 'vue';
import { usePanelApiHost } from '@/composables/panel/usePanelApiHost';
import { usePanelStore } from '@/stores/panelStore';
import { useProjectStore } from '@/stores/projectStore';
import type { PanelDefinition } from '@comfytavern/types';

const props = defineProps<{
  panelId: string;
}>();
const iframeRef = ref<HTMLIFrameElement | null>(null);
const iframeSrc = ref('');
const sandboxRules = ref(['allow-scripts']); // 默认最小权限

const panelStore = usePanelStore();
const projectStore = useProjectStore();
const currentDefinition = ref<PanelDefinition | null>(null);

// --- Panel API Host ---
// 对于通过后端 API 加载的 iframe，其 origin 是宿主应用的 origin
const panelOrigin = computed(() => window.location.origin);
const { initializeHost } = usePanelApiHost(iframeRef, panelOrigin);

onMounted(() => {
  // `load` 事件监听器已被移除，
  // 注入脚本的逻辑现在由 usePanelApiHost 中的 `panel-ready` 消息处理器触发。
  initializeHost();
});


watchEffect(async () => {
  const projectId = projectStore.currentProjectId;
  if (props.panelId && projectId) {
    console.log(`[PanelContainer] 开始加载面板定义: ${props.panelId} for project: ${projectId}`);

    const panelDefinition = await panelStore.fetchPanelDefinition(projectId, props.panelId);
    currentDefinition.value = panelDefinition;

    if (panelDefinition && panelDefinition.panelDirectory) {
      // 构造逻辑路径，这次使用后端提供的 panelDirectory
      const logicalPath = `user://projects/${projectId}/ui/${panelDefinition.panelDirectory}/${panelDefinition.uiEntryPoint}`;
      
      // 构造最终的下载 URL，指向后端的文件服务代理
      iframeSrc.value = `/api/fam/download/${encodeURIComponent(logicalPath)}`;
      
      console.log(`[PanelContainer] Set iframe src to: ${iframeSrc.value}`);
      
      // TODO: 将来从 panelDefinition.uiRuntimeConfig.sandboxAttributes 获取
      // 目前暂时使用较宽松的权限
      sandboxRules.value = ['allow-scripts', 'allow-forms', 'allow-modals', 'allow-same-origin', 'allow-downloads'];

    } else {
      iframeSrc.value = '';
      console.error(`[PanelContainer] 未找到或加载失败: ID 为 "${props.panelId}" 的面板定义。`);
    }
  } else {
    iframeSrc.value = '';
    if (!props.panelId) console.log('[PanelContainer] No panelId provided.');
    if (!projectId) console.log('[PanelContainer] No projectId available.');
  }
});
</script>

<template>
  <div class="panel-container">
    <iframe
      v-if="iframeSrc"
      ref="iframeRef"
      :src="iframeSrc"
      :sandbox="sandboxRules.join(' ')"
      class="w-full h-full border-0"
      allow="encrypted-media; fullscreen; picture-in-picture"
    ></iframe>
    <div v-else class="w-full h-full flex items-center justify-center">
      <p>无法加载面板: {{ panelId }}</p>
    </div>
  </div>
</template>

<style scoped>
.panel-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  background-color: #f0f0f0; /* 临时背景色 */
}
</style>