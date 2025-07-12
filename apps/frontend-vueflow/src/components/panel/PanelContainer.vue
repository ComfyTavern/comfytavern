<script setup lang="ts">
import { ref, watchEffect, computed, toRef, watch } from 'vue';
import { useRoute } from "vue-router";
import { useClipboard, useScroll, useElementSize } from '@vueuse/core';
import { usePanelApiHost } from "@/composables/panel/usePanelApiHost";
import { usePanelStore } from "@/stores/panelStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUiStore } from "@/stores/uiStore";
import type { PanelDefinition } from "@comfytavern/types";
import {
  ArrowPathIcon,
  CommandLineIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  TrashIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ArrowsUpDownIcon,
} from "@heroicons/vue/24/outline";

const props = defineProps<{
  panelId: string;
}>();

const iframeRef = ref<HTMLIFrameElement | null>(null);
const panelContainerRef = ref<HTMLElement | null>(null);
const iframeSrc = ref("");
const panelOrigin = ref(window.location.origin); // + 咕咕：改为 ref
const sandboxRules = ref(["allow-scripts"]); // 默认最小权限

const panelStore = usePanelStore();
const projectStore = useProjectStore();
const uiStore = useUiStore();
const route = useRoute();
const currentDefinition = ref<PanelDefinition | null>(null);

// --- Panel API Host ---
const logs = ref<any[]>([]);
const isLogPanelVisible = ref(false);

const currentProjectId = computed(() => projectStore.currentProjectId);
// + 咕咕：将 panelOrigin 的 ref 传递给 host
usePanelApiHost(iframeRef, panelOrigin, currentProjectId, toRef(props, "panelId"), logs);

// --- 日志面板功能 ---
const { copy, copied, isSupported } = useClipboard({ legacy: true });
const logPanelRef = ref<HTMLElement | null>(null);
const { y } = useScroll(logPanelRef);
const { height: containerHeight } = useElementSize(panelContainerRef);

const HEADER_HEIGHT = 40; // from panel-header height
const MIN_LOG_PANEL_HEIGHT = 60;

const maxLogPanelHeight = computed(() => {
  // 减去头部高度，并留出一点边距
  return containerHeight.value - HEADER_HEIGHT - 5;
});

// 从 store 初始化高度
const logPanelHeight = ref(uiStore.panelLogHeight);
const isResizing = ref(false);

const startResize = (e: MouseEvent) => {
  isResizing.value = true;
  e.preventDefault();
  document.body.style.cursor = 'row-resize';
  document.body.style.userSelect = 'none';

  const startY = e.clientY;
  const startHeight = logPanelHeight.value;

  const doDrag = (moveEvent: MouseEvent) => {
    // 从顶部向下拖动，所以是加法
    const newHeight = startHeight + (moveEvent.clientY - startY);
    // 限制高度在最小和最大值之间
    const clampedHeight = Math.max(
      MIN_LOG_PANEL_HEIGHT,
      Math.min(newHeight, maxLogPanelHeight.value)
    );
    uiStore.setPanelLogHeight(clampedHeight);
  };

  const stopDrag = () => {
    isResizing.value = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', doDrag);
    document.removeEventListener('mouseup', stopDrag);
    // 拖动结束后，持久化高度
    uiStore.persistPanelLogHeight();
  };

  document.addEventListener('mousemove', doDrag);
  document.addEventListener('mouseup', stopDrag);
};

// 监听 store 中的高度变化，以响应外部（例如 devtools）的修改
watch(
  [() => uiStore.panelLogHeight, maxLogPanelHeight],
  ([newHeight, maxH]) => {
    const clampedHeight = Math.max(MIN_LOG_PANEL_HEIGHT, Math.min(newHeight, maxH));
    logPanelHeight.value = clampedHeight;
    // 如果存储的高度超出了当前最大允许高度，则更新 store
    if (newHeight > maxH) {
      uiStore.setPanelLogHeight(maxH);
    }
  },
  { immediate: true }
);

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

const fitLogPanelHeight = () => {
  uiStore.setPanelLogHeight(maxLogPanelHeight.value);
};

const formatTimestamp = (isoString: string) => {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const goBack = () => {
  iframeRef.value?.contentWindow?.history.back();
};

const goForward = () => {
  iframeRef.value?.contentWindow?.history.forward();
};

const refresh = () => {
  // 使用 location.reload() 可能会更可靠
  iframeRef.value?.contentWindow?.location.reload();
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

    if (panelDefinition) {
      const isDevMode = route.query.dev === 'true';
      const devUrl = panelDefinition.devOptions?.devServerUrl;

      if (isDevMode && devUrl) {
        // 开发模式
        iframeSrc.value = devUrl;
        panelOrigin.value = new URL(devUrl).origin;
        console.log(`[PanelContainer] Dev Mode: Loading panel from ${devUrl}`);
      } else {
        // 生产模式
        if (panelDefinition.panelDirectory) {
          const logicalPath = `user://projects/${projectId}/ui/${panelDefinition.panelDirectory}/${panelDefinition.uiEntryPoint}`;
          iframeSrc.value = `/api/fam/download/${encodeURIComponent(logicalPath)}`;
          panelOrigin.value = window.location.origin;
          console.log(`[PanelContainer] Prod Mode: Set iframe src to: ${iframeSrc.value}`);
        } else {
          iframeSrc.value = "";
          console.error(`[PanelContainer] Prod Mode: panelDirectory is missing for panel ${props.panelId}.`);
        }
      }

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
  <div class="panel-container" ref="panelContainerRef">
    <!-- Panel Header / Toolbar -->
    <div class="panel-header">
      <!-- Left: Navigation -->
      <div class="flex items-center space-x-1">
        <button @click="goBack" v-comfy-tooltip="'后退'" class="header-button group">
          <ArrowUturnLeftIcon class="h-5 w-5" />
        </button>
        <button @click="goForward" v-comfy-tooltip="'前进'" class="header-button group">
          <ArrowUturnRightIcon class="h-5 w-5" />
        </button>
        <button @click="refresh" v-comfy-tooltip="'刷新'" class="header-button group">
          <ArrowPathIcon class="h-5 w-5 group-hover:animate-spin" />
        </button>
      </div>

      <div class="flex-grow"></div>

      <!-- Right: Log Controls -->
      <div class="flex items-center space-x-2">
        <!-- These buttons only show when the log panel is visible -->
        <template v-if="isLogPanelVisible">
          <button @click="fitLogPanelHeight" v-comfy-tooltip="'适应高度'" class="header-button">
            <ArrowsUpDownIcon class="h-5 w-5" />
          </button>
          <button v-if="isSupported" @click="copyLogs" v-comfy-tooltip="'复制所有日志'" class="header-button">
            <CheckIcon v-if="copied" class="h-5 w-5 text-success" />
            <ClipboardDocumentIcon v-else class="h-5 w-5" />
          </button>
          <button @click="clearLogs" v-comfy-tooltip="'清空日志'" class="header-button">
            <TrashIcon class="h-5 w-5" />
          </button>
        </template>

        <!-- This button is always visible -->
        <button @click="isLogPanelVisible = !isLogPanelVisible"
          v-comfy-tooltip="isLogPanelVisible ? '隐藏日志' : '显示日志'" class="header-button relative">
          <CommandLineIcon class="h-5 w-5" />
          <span v-if="logs.length > 0" class="log-count-badge absolute -top-1 -right-1">{{ logs.length }}</span>
        </button>
      </div>
    </div>

    <!-- Iframe Content -->
    <div class="iframe-content-wrapper" :class="{ 'pointer-events-none': isResizing }">
      <iframe v-if="iframeSrc" ref="iframeRef" :src="iframeSrc" :sandbox="sandboxRules.join(' ')"
        class="w-full h-full border-0" allow="encrypted-media; fullscreen; picture-in-picture"></iframe>
      <div v-else class="w-full h-full flex items-center justify-center bg-neutral-softest">
        <div class="text-center text-text-muted">
          <ArrowPathIcon class="mx-auto h-12 w-12 animate-spin mb-4" />
          <p>无法加载面板: {{ panelId }}</p>
          <p class="text-xs mt-2">请检查面板配置和项目ID是否正确。</p>
        </div>
      </div>
    </div>

    <!-- Log Panel -->
    <div
      class="log-panel-container"
      :class="{ 'is-visible': isLogPanelVisible, 'is-resizing': isResizing }"
      :style="{ height: isLogPanelVisible ? `${logPanelHeight}px` : '0px' }"
    >
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
      <!-- Resizer Handle -->
      <div
        v-if="isLogPanelVisible"
        class="log-panel-resizer"
        @mousedown="startResize"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.panel-container {
  @apply w-full h-full flex flex-col overflow-hidden relative bg-background-base;
}

.panel-header {
  @apply flex-shrink-0 bg-background-base border-b border-border-base px-2 py-1;
  height: 40px;
  display: flex;
  align-items: center;
}

.header-button {
  @apply p-1.5 rounded-md text-text-muted hover:text-text-base hover:bg-neutral-soft;
  @apply transition-colors duration-150;
}

.iframe-content-wrapper {
  @apply flex-grow relative overflow-hidden; /* 确保 iframe 不会超出 */
}

.log-panel-container {
  @apply absolute top-[40px] left-0 right-0 z-40 flex flex-col; /* 定位到 header 下方 */
  @apply bg-background-base border-b border-border-base shadow-lg; /* 修改为下边框和更柔和的阴影 */
  transition: height 0.3s ease-in-out;
  overflow: hidden; /* 改回 hidden */
}

.log-panel-container.is-resizing {
  transition: none; /* 拖拽时不应用动画，更跟手 */
}

.log-panel-container.is-visible {
  /* 高度现在由 style 绑定控制 */
}

.log-panel-resizer {
  @apply absolute bottom-0 left-0 w-full h-1.5 cursor-row-resize bg-border-base/50 hover:bg-primary;
  @apply transition-colors duration-200;
}

.log-count-badge {
  @apply bg-primary text-primary-content text-xs font-bold px-1.5 py-0.5 rounded-full;
  line-height: 1;
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

.log-entry.log-log .log-level {
  @apply text-text-muted;
}

.log-entry.log-warn .log-level {
  @apply text-warning;
}

.log-entry.log-error .log-level {
  @apply text-error;
}

.log-entry.log-debug .log-level {
  @apply text-accent;
}

.log-entry.log-info .log-level {
  @apply text-info;
}


.log-message {
  @apply whitespace-pre-wrap break-all flex-grow;
  margin: 0;
}
</style>
