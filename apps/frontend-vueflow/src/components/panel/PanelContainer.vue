<script setup lang="ts">
import { ref, watchEffect, computed, toRef } from "vue";
import { useClipboard } from "@vueuse/core";
import { usePanelApiHost } from "@/composables/panel/usePanelApiHost";
import { usePanelStore } from "@/stores/panelStore";
import { useProjectStore } from "@/stores/projectStore";
import type { PanelDefinition } from "@comfytavern/types";

const props = defineProps<{
  panelId: string;
}>();
const iframeRef = ref<HTMLIFrameElement | null>(null);
const iframeSrc = ref("");
const sandboxRules = ref(["allow-scripts"]); // 默认最小权限

const panelStore = usePanelStore();
const projectStore = useProjectStore();
const currentDefinition = ref<PanelDefinition | null>(null);

// --- Panel API Host ---
// 对于通过后端 API 加载的 iframe，其 origin 是宿主应用的 origin
const panelOrigin = computed(() => window.location.origin);
const logs = ref<any[]>([]);
const isLogPanelVisible = ref(false);

// usePanelApiHost 在 setup 阶段被调用一次，并响应式地处理其生命周期。
const currentProjectId = computed(() => projectStore.currentProjectId);
usePanelApiHost(iframeRef, panelOrigin, currentProjectId, toRef(props, "panelId"), logs);

const { copy, copied, isSupported } = useClipboard();

const copyLogs = () => {
  const formattedLogs = logs.value
    .map(
      (log) =>
        `[${log.level.toUpperCase()}] ${log.message
          .map((item: any) => JSON.stringify(item))
          .join(" ")}`
    )
    .join("\n");
  copy(formattedLogs);
};

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
      sandboxRules.value = [
        "allow-scripts",
        "allow-forms",
        "allow-modals",
        "allow-same-origin",
        "allow-downloads",
      ];
    } else {
      iframeSrc.value = "";
      console.error(`[PanelContainer] 未找到或加载失败: ID 为 "${props.panelId}" 的面板定义。`);
    }
  } else {
    iframeSrc.value = "";
    if (!props.panelId) console.log("[PanelContainer] No panelId provided.");
    if (!projectId) console.log("[PanelContainer] No projectId available.");
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

    <!-- Log Panel -->
    <div class="log-panel-container">
      <div class="log-panel-header">
        <button @click="isLogPanelVisible = !isLogPanelVisible" class="toggle-button">
          {{ isLogPanelVisible ? "隐藏日志" : "显示日志" }} ({{ logs.length }})
        </button>
        <button
          v-if="isLogPanelVisible && isSupported"
          @click="copyLogs"
          class="toggle-button copy-button"
        >
          {{ copied ? "已复制!" : "复制日志" }}
        </button>
      </div>
      <div v-if="isLogPanelVisible" class="log-panel">
        <div v-for="(log, index) in logs" :key="index" :class="`log-entry log-${log.level}`">
          <span class="log-level">{{ log.level }}:</span>
          <pre class="log-message">{{
            log.message.map((item: any) => JSON.stringify(item, null, 2)).join(" ")
          }}</pre>
        </div>
      </div>
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

.log-panel-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
}

.log-panel-header {
  display: flex;
}

.toggle-button {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 8px 16px;
  cursor: pointer;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  margin-right: 2px;
}

.copy-button {
  background-color: #28a745;
}

.log-panel {
  max-height: 200px;
  overflow-y: auto;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px;
  font-family: monospace;
  font-size: 12px;
}

.log-entry {
  padding: 2px 5px;
  border-bottom: 1px solid #444;
  display: flex;
}

.log-level {
  font-weight: bold;
  margin-right: 1em;
  text-transform: uppercase;
}

.log-entry.log-log .log-level {
  color: #cccccc;
}
.log-entry.log-warn .log-level {
  color: #ffcc00;
}
.log-entry.log-error .log-level {
  color: #ff4d4d;
}
.log-entry.log-debug .log-level {
  color: #88aaff;
}

.log-message {
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
</style>
