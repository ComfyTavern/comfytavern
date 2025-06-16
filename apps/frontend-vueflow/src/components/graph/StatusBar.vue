<template>
  <div
    class="status-bar bg-background-surface border-t border-border-base px-3 py-1.5 text-sm flex items-center justify-between shadow-inner">
    <div class="flex items-center space-x-4 flex-grow min-w-0">
      <!-- Added flex-grow -->
      <div class="text-primary font-semibold flex-shrink-0">{{ projectName }}</div>
      <!-- 工作流菜单触发器 -->
      <div class="relative flex-shrink-0">
        <button ref="workflowButtonRef" @click="toggleWorkflowMenu" class="status-bar-button">
          工作流
        </button>
        <WorkflowMenu ref="workflowMenuRef" v-if="showWorkflowMenu" @close="showWorkflowMenu = false" />
      </div>
      <TabBar class="flex-grow px-2" />
    </div>

    <div class="flex items-center space-x-2 flex-shrink-0">
      <!-- 可停靠编辑器切换按钮 -->
      <button @click="toggleDockedEditor" :title="isDockedEditorVisible ? '隐藏编辑器面板' : '显示编辑器面板'"
        class="px-2 py-1 rounded border border-transparent text-text-muted hover:bg-neutral-softest focus:outline-none transition-all duration-150"
        :class="{
          'text-primary border-primary-soft bg-primary-softest': isDockedEditorVisible,
          'text-text-muted': !isDockedEditorVisible, /* text-gray-500 is more like text-muted or text-secondary */
        }">
        <svg v-if="isDockedEditorVisible" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block" fill="none"
          viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
        </svg>
      </button>
      <!-- 实时预览切换按钮 -->
      <button @click="togglePreview" :title="isPreviewEnabled ? '禁用实时预览' : '启用实时预览'"
        class="px-2 py-1 rounded border border-transparent text-text-muted hover:bg-neutral-softest focus:outline-none transition-all duration-150"
        :class="{
          'text-primary border-primary-soft bg-primary-softest': isPreviewEnabled,
          'text-text-muted': !isPreviewEnabled, /* text-gray-500 is more like text-muted or text-secondary */
        }">
        <svg v-if="isPreviewEnabled" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block" fill="none"
          viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" />
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M2.458 12C3.732 7.943 7.523 5 12 5c1.556 0 3.04.28 4.416.793" />
        </svg>
      </button>
      <!-- 执行按钮 -->
      <button @click="handleExecuteWorkflow"
        class="px-3 py-1 rounded text-primary-content font-medium bg-success/90 saturate-[.85] hover:bg-success/95 hover:saturate-[.75] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-success">
        执行
      </button>
      <!-- 显示工作流执行状态 -->
      <span v-if="workflowStatusText" class="flex items-center space-x-1.5 text-xs font-medium ml-2" :class="{
        'text-warning': currentWorkflowStatus === ExecutionStatus.RUNNING,
        'text-success': currentWorkflowStatus === ExecutionStatus.COMPLETE,
        'text-error': currentWorkflowStatus === ExecutionStatus.ERROR,
        'text-text-muted':
          currentWorkflowStatus === ExecutionStatus.IDLE ||
          currentWorkflowStatus === ExecutionStatus.QUEUED ||
          currentWorkflowStatus === ExecutionStatus.SKIPPED,
      }">
        <span class="inline-block h-2 w-2 rounded-full" :class="{
          'bg-warning animate-pulse': currentWorkflowStatus === ExecutionStatus.RUNNING,
          'bg-success': currentWorkflowStatus === ExecutionStatus.COMPLETE,
          'bg-error': currentWorkflowStatus === ExecutionStatus.ERROR,
          'bg-neutral': /* bg-gray-400 is more like neutral for an indicator */
            currentWorkflowStatus === ExecutionStatus.IDLE ||
            currentWorkflowStatus === ExecutionStatus.QUEUED ||
            currentWorkflowStatus === ExecutionStatus.SKIPPED,
        }"></span>
        <span>{{ workflowStatusText }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
// import type { Node as VueFlowNode, Edge as VueFlowEdge } from "@vue-flow/core"; // 不再直接在此处使用
import { onClickOutside } from "@vueuse/core";
// import { klona } from "klona/full"; // 已移至 useWorkflowExecution
import { useWorkflowStore } from "@/stores/workflowStore";
import { useTabStore } from "@/stores/tabStore";
import { useExecutionStore } from "@/stores/executionStore";
import { useEditorState } from "@/composables/editor/useEditorState";
import { useProjectStore } from "@/stores/projectStore";
import { storeToRefs } from "pinia";
import WorkflowMenu from "@/components/graph/menus/WorkflowMenu.vue";
import TabBar from "@/components/graph/TabBar.vue";
// import { useWebSocket } from "@/composables/useWebSocket"; // 已移至 useWorkflowExecution
import {
  ExecutionStatus,
  // WebSocketMessageType, // 已移至 useWorkflowExecution
  // type ExecuteWorkflowPayload, // 已移至 useWorkflowExecution
} from "@comfytavern/types";
// import { // 已移至 useWorkflowExecution
//   transformVueFlowToExecutionPayload,
//   transformVueFlowToCoreWorkflow,
// } from "@/utils/workflowTransformer";
// import type { FlowExportObject } from "@vue-flow/core"; // 已移至 useWorkflowExecution
import { useWorkflowExecution } from "@/composables/workflow/useWorkflowExecution"; // 导入新的 composable
import { useDialogService } from '@/services/DialogService'; // 导入 DialogService

const workflowStore = useWorkflowStore();
const tabStore = useTabStore();
const { activeTabId } = storeToRefs(tabStore);
const executionStore = useExecutionStore();
const { isPreviewEnabled } = storeToRefs(executionStore);
const { togglePreview } = executionStore;
const { isDockedEditorVisible, toggleDockedEditor } = useEditorState();
const projectStore = useProjectStore();
const { currentProjectMetadata } = storeToRefs(projectStore);
const projectName = computed(() => currentProjectMetadata.value?.name || "ComfyTavern");
const dialogService = useDialogService(); // 获取 DialogService 实例

const showWorkflowMenu = ref(false);
const workflowButtonRef = ref<HTMLButtonElement | null>(null);
const workflowMenuRef = ref<InstanceType<typeof WorkflowMenu> | null>(null);
const targetElementRef = ref<HTMLElement | null>(null);

// Computed property for the active tab's workflow data
// 保留 activeWorkflowData，因为备用逻辑的讨论还在进行中
const activeWorkflowData = computed(() => {
  return activeTabId.value ? workflowStore.getWorkflowData(activeTabId.value) : null;
});

const currentWorkflowStatus = computed(() => {
  if (!activeTabId.value) {
    return ExecutionStatus.IDLE;
  }
  return executionStore.getWorkflowStatus(activeTabId.value);
});

const workflowStatusText = computed(() => {
  switch (currentWorkflowStatus.value) {
    case ExecutionStatus.IDLE:
      return "空闲";
    case ExecutionStatus.QUEUED:
      return "排队中";
    case ExecutionStatus.RUNNING:
      return "运行中...";
    case ExecutionStatus.COMPLETE:
      return "已完成";
    case ExecutionStatus.ERROR:
      return "错误";
    case ExecutionStatus.SKIPPED:
      return "已跳过";
    default:
      return "";
  }
});

const toggleWorkflowMenu = () => {
  showWorkflowMenu.value = !showWorkflowMenu.value;
};

watch(workflowMenuRef, (newVal) => {
  targetElementRef.value = newVal ? (newVal.$el as HTMLElement) : null;
});

onClickOutside(
  targetElementRef,
  (event: PointerEvent) => {
    if (workflowButtonRef.value && !workflowButtonRef.value.contains(event.target as Node)) {
      showWorkflowMenu.value = false;
    }
  },
  {
    ignore: [workflowButtonRef],
  }
);

// --- 执行工作流 ---
const { executeWorkflow: executeActiveWorkflow } = useWorkflowExecution(); // 从 composable 获取执行函数

const handleExecuteWorkflow = async () => {
  console.log("触发执行工作流 (StatusBar)...");

  if (!activeTabId.value) {
    console.error("[StatusBar] 无法执行：没有活动的标签页。");
    dialogService.showError("请先选择一个标签页。");
    return;
  }

  const currentElements = workflowStore.getElements(activeTabId.value);
  if (!currentElements || currentElements.length === 0) {
    // 画布实时元素为空
    const workflowDataFromStore = activeWorkflowData.value; // activeWorkflowData 是 computed(() => workflowStore.getWorkflowData(...))
    if (workflowDataFromStore && workflowDataFromStore.nodes && workflowDataFromStore.nodes.length > 0) {
      // Store 中有数据，说明可能只是画布未同步或未渲染完全
      console.warn("[StatusBar] 画布当前元素为空，但侦测到已加载的工作流数据。可能画布尚未完全渲染或同步。执行已取消。");
      dialogService.showError("画布尚未完全准备就绪，请稍等片刻或尝试重新加载工作流。");
    } else {
      // Store 中也无数据，或数据无效
      console.error("[StatusBar] 无法执行：当前画布元素和工作流存储数据均为空或无效。");
      dialogService.showError("画布上没有元素可执行，或画布状态不正确。");
    }
    return; // 阻止执行
  }

  // 画布元素看起来是存在的，调用 composable 执行
  // composable 内部也会进行元素检查，作为双重保障
  await executeActiveWorkflow();
};
</script>

<style scoped>
.status-bar {
  /* 状态栏样式 */
  height: 40px;
  /* 固定高度 */
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.status-bar-button {
  @apply px-2 py-0.5 rounded text-text-secondary hover:bg-neutral-softest transition-colors duration-150 focus:outline-none;
}
</style>
