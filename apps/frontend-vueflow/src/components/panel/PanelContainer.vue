<script setup lang="ts">
import { ref, watchEffect, computed, toRef, watch } from "vue";
import { useClipboard, useScroll } from "@vueuse/core";
import { usePanelApiHost } from "@/composables/panel/usePanelApiHost";
import { usePanelStore } from "@/stores/panelStore";
import { useProjectStore } from "@/stores/projectStore";
import type { PanelDefinition } from "@comfytavern/types";
import {
  ArrowPathIcon,
  CommandLineIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  TrashIcon,
} from "@heroicons/vue/24/outline";

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
const panelOrigin = computed(() => window.location.origin);
const logs = ref<any[]>([]);
const isLogPanelVisible = ref(false);

const currentProjectId = computed(() => projectStore.currentProjectId);
usePanelApiHost(iframeRef, panelOrigin, currentProjectId, toRef(props, "panelId"), logs);

// --- 日志面板功能 ---
const { copy, copied, isSupported } = useClipboard({ legacy: true });
const logPanelRef = ref<HTMLElement | null>(null);
const { y } = useScroll(logPanelRef);

const copyLogs = () => {
  const formattedLogs = logs.value
    .map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      const message = log.message.map((item: any) => {
        try {
          return JSON.stringify(item);
        } catch {
          return String(item);
        }
      }).join(" ");
      return `[${time}] [${log.level.toUpperCase()}] ${message}`;
    })
    .join("\n");
  copy(formattedLogs);
};

const clearLogs = () => {
  logs.value = [];
};

const formatTimestamp = (isoString: string) => {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// 自动滚动到底部
// 咕咕：添加 watch 依赖
watch(logs, () => {
  if (isLogPanelVisible.value && logPanelRef.value) {
    // 延迟以等待 DOM 更新
    setTimeout(() => {
      y.value = logPanelRef.value!.scrollHeight;
    }, 0);
  }
}, { deep: true });

watchEffect(async () => {
  const projectId = projectStore.currentProjectId;
  if (props.panelId && projectId) {
    console.log(`[PanelContainer] 开始加载面板定义: ${props.panelId} for project: ${projectId}`);

    const panelDefinition = await panelStore.fetchPanelDefinition(projectId, props.panelId);
    currentDefinition.value = panelDefinition;

    if (panelDefinition && panelDefinition.panelDirectory) {
      const logicalPath = `user://projects/${projectId}/ui/${panelDefinition.panelDirectory}/${panelDefinition.uiEntryPoint}`;
      iframeSrc.value = `/api/fam/download/${encodeURIComponent(logicalPath)}`;
      console.log(`[PanelContainer] Set iframe src to: ${iframeSrc.value}`);

      // TODO: 将来从 panelDefinition.uiRuntimeConfig.sandboxAttributes 获取
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
    <div v-else class="w-full h-full flex items-center justify-center bg-neutral-softest">
      <div class="text-center text-text-muted">
        <ArrowPathIcon class="mx-auto h-12 w-12 animate-spin mb-4" />
        <p>无法加载面板: {{ panelId }}</p>
        <p class="text-xs mt-2">请检查面板配置和项目ID是否正确。</p>
      </div>
    </div>

    <!-- Log Panel -->
    <div class="log-panel-container" :class="{ 'is-visible': isLogPanelVisible }">
      <!-- Header -->
      <div class="log-panel-header">
        <button @click="isLogPanelVisible = !isLogPanelVisible" v-comfy-tooltip="isLogPanelVisible ? '隐藏日志' : '显示日志'" class="toggle-button">
          <CommandLineIcon class="h-5 w-5" />
          <span v-if="isLogPanelVisible" class="ml-2 font-semibold">面板日志</span>
          <span class="log-count-badge" :class="{'ml-2': isLogPanelVisible}">{{ logs.length }}</span>
        </button>
        <div v-if="isLogPanelVisible" class="flex-grow"></div>
        <div v-if="isLogPanelVisible" class="flex items-center space-x-2 mr-2">
           <button v-if="isSupported" @click="copyLogs" v-comfy-tooltip="'复制所有日志'" class="control-button">
            <CheckIcon v-if="copied" class="h-4 w-4" />
            <ClipboardDocumentIcon v-else class="h-4 w-4" />
            <span>{{ copied ? "已复制" : "复制" }}</span>
          </button>
          <button @click="clearLogs" v-comfy-tooltip="'清空日志'" class="control-button">
            <TrashIcon class="h-4 w-4" />
             <span>清空</span>
          </button>
        </div>
      </div>
      <!-- Body -->
      <div v-if="isLogPanelVisible" ref="logPanelRef" class="log-panel-body">
        <div v-if="logs.length === 0" class="text-text-muted italic text-center py-4">
          暂无日志输出。
        </div>
        <div v-for="(log, index) in logs" :key="index" :class="`log-entry log-${log.level}`">
          <span class="log-timestamp">{{ formatTimestamp(log.timestamp) }}</span>
          <span class="log-level">{{ log.level }}</span>
          <pre class="log-message">{{
            log.message.map((item: any) => {
              try {
                return JSON.stringify(item, null, 2);
              } catch {
                return String(item);
              }
            }).join(" ")
          }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-container {
  @apply w-full h-full overflow-hidden relative bg-background-base;
}

.log-panel-container {
  @apply absolute bottom-0 left-0 right-0 z-50 flex flex-col;
  @apply bg-background-base border-t border-border-base shadow-2xl;
  @apply transition-all duration-300 ease-in-out;
  max-height: 40px;
}

.log-panel-container.is-visible {
  max-height: 40%;
}

.log-panel-header {
  @apply flex items-center p-1 flex-shrink-0;
  height: 40px;
}

.toggle-button {
  @apply flex items-center px-3 py-1.5 rounded-md cursor-pointer;
  @apply text-text-muted hover:text-text-base hover:bg-neutral-soft;
  @apply transition-all duration-150;
}

.log-count-badge {
  @apply bg-primary text-primary-content text-xs font-bold px-1.5 py-0.5 rounded-full;
}

.control-button {
  @apply flex items-center space-x-1.5 px-2 py-1 rounded text-xs;
  @apply text-text-secondary bg-neutral-softest hover:bg-neutral-soft hover:text-text-base;
  @apply transition-colors;
}

.log-panel-body {
  @apply flex-grow overflow-y-auto bg-neutral-softest p-2;
  @apply font-mono text-xs;
}

.log-entry {
  @apply flex items-start p-1.5 border-b border-border-base/50;
}
.log-entry:last-child {
  @apply border-b-0;
}

.log-timestamp {
  @apply text-text-muted mr-3;
}

.log-level {
  @apply font-bold mr-3 uppercase w-12 flex-shrink-0;
}

.log-entry.log-log .log-level { @apply text-text-muted; }
.log-entry.log-warn .log-level { @apply text-warning; }
.log-entry.log-error .log-level { @apply text-error; }
.log-entry.log-debug .log-level { @apply text-accent; }
.log-entry.log-info .log-level { @apply text-info; }


.log-message {
  @apply whitespace-pre-wrap break-all flex-grow;
  margin: 0;
}
</style>
