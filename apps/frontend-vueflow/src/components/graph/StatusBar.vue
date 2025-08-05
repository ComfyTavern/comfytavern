<template>
  <div
    class="status-bar bg-background-surface border-t border-border-base px-3 py-1.5 text-sm flex items-center justify-between shadow-inner">
    <div class="flex items-center space-x-4 flex-grow min-w-0">
      <div class="text-primary font-semibold flex-shrink-0">{{ projectName }}</div>
      <!-- 工作流菜单触发器 -->
      <div class="relative flex-shrink-0">
        <button ref="workflowButtonRef" @click="toggleWorkflowMenu" class="status-bar-button">
          工作流
        </button>
        <div ref="workflowMenuContainerRef">
          <WorkflowMenu v-if="showWorkflowMenu" @close="showWorkflowMenu = false" />
        </div>
      </div>
      <TabBar class="flex-grow px-2" />
    </div>

    <div class="flex items-center space-x-2 flex-shrink-0">
      <!-- 可停靠编辑器切换按钮 -->
      <button @click="toggleDockedEditor" v-comfy-tooltip="isDockedEditorVisible ? '隐藏编辑器面板' : '显示编辑器面板'"
        class="px-2 py-1 rounded border border-transparent text-text-muted hover:bg-neutral-softest focus:outline-none transition-all duration-150"
        :class="{
          'text-primary border-primary-soft bg-primary-softest': isDockedEditorVisible,
          'text-text-muted': !isDockedEditorVisible,
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
      <button @click="togglePreview" v-comfy-tooltip="isPreviewEnabled ? '禁用实时预览' : '启用实时预览'"
        class="px-2 py-1 rounded border border-transparent text-text-muted hover:bg-neutral-softest focus:outline-none transition-all duration-150"
        :class="{
          'text-primary border-primary-soft bg-primary-softest': isPreviewEnabled,
          'text-text-muted': !isPreviewEnabled,
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

      <!-- 执行/中止按钮 -->
      <button v-if="isCurrentTabExecuting" @click="handleInterruptWorkflow"
        class="px-3 py-1 rounded text-error-content font-medium bg-error/90 saturate-[.85] hover:bg-error/95 hover:saturate-[.75] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-error">
        中止
      </button>
      <button v-else @click="handleExecuteWorkflow"
        class="px-3 py-1 rounded text-primary-content font-medium bg-success/90 saturate-[.85] hover:bg-success/95 hover:saturate-[.75] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-success">
        执行
      </button>

      <!-- 显示当前标签页工作流执行状态 -->
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
          'bg-neutral':
            currentWorkflowStatus === ExecutionStatus.IDLE ||
            currentWorkflowStatus === ExecutionStatus.QUEUED ||
            currentWorkflowStatus === ExecutionStatus.SKIPPED,
        }"></span>
        <span>{{ workflowStatusText }}</span>
      </span>

      <!-- 队列状态 & 弹窗 -->
      <div class="relative">
        <div ref="queueStatusTriggerRef" @click="toggleQueuePopup"
          class="flex items-center space-x-2 text-xs font-medium ml-4 cursor-pointer p-1 rounded-md hover:bg-neutral-softest">
          <!-- 运行中状态 -->
          <span class="flex items-center space-x-1.5" :class="{
            'text-warning': runningCount > 0,
            'text-text-muted': runningCount === 0
          }">
            <span class="inline-block h-2 w-2 rounded-full" :class="{
              'bg-warning animate-pulse': runningCount > 0,
              'bg-neutral': runningCount === 0
            }"></span>
            <span>运行: {{ runningCount }}</span>
          </span>
          <!-- 分隔符 -->
          <span class="text-text-divider">|</span>
          <!-- 排队中状态 -->
          <span class="flex items-center space-x-1.5" :class="{
            'text-info': pendingCount > 0,
            'text-text-muted': pendingCount === 0
          }">
            <span class="inline-block h-2 w-2 rounded-full" :class="{
              'bg-info': pendingCount > 0,
              'bg-neutral': pendingCount === 0
            }"></span>
            <span>队列: {{ pendingCount }}</span>
          </span>
        </div>
        <div ref="queuePopupContainerRef">
          <QueueStatusPopup v-if="showQueuePopup" />
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { onClickOutside } from "@vueuse/core";
import { useWorkflowStore } from "@/stores/workflowStore";
import { useTabStore } from "@/stores/tabStore";
import { useExecutionStore } from "@/stores/executionStore";
import { useEditorState } from "@/composables/editor/useEditorState";
import { useProjectStore } from "@/stores/projectStore";
import { storeToRefs } from "pinia";
import WorkflowMenu from "@/components/graph/menus/WorkflowMenu.vue";
import TabBar from "@/components/graph/TabBar.vue";
import { ExecutionStatus } from "@comfytavern/types";
import { useWorkflowExecution } from "@/composables/workflow/useWorkflowExecution";
import { useDialogService } from '@/services/DialogService';
import { useSystemStatusStore } from '@/stores/systemStatusStore';
import QueueStatusPopup from './QueueStatusPopup.vue';

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
const dialogService = useDialogService();

const systemStatusStore = useSystemStatusStore();
const { runningCount, pendingCount } = storeToRefs(systemStatusStore);
const showWorkflowMenu = ref(false);
const workflowButtonRef = ref<HTMLButtonElement | null>(null);
const workflowMenuContainerRef = ref<HTMLDivElement | null>(null);

const showQueuePopup = ref(false);
const queuePopupContainerRef = ref<HTMLDivElement | null>(null);
const queueStatusTriggerRef = ref<HTMLDivElement | null>(null);

onClickOutside(
  workflowMenuContainerRef,
  (event: PointerEvent) => {
    if (workflowButtonRef.value && !workflowButtonRef.value.contains(event.target as Node)) {
      showWorkflowMenu.value = false;
    }
  },
  {
    ignore: [workflowButtonRef],
  }
);

onClickOutside(
  queuePopupContainerRef,
  (event: PointerEvent) => {
    if (queueStatusTriggerRef.value && !queueStatusTriggerRef.value.contains(event.target as Node)) {
      showQueuePopup.value = false;
    }
  },
  {
    ignore: [queueStatusTriggerRef],
  }
);

const activeWorkflowData = computed(() => {
  return activeTabId.value ? workflowStore.getWorkflowData(activeTabId.value) : null;
});

const currentWorkflowStatus = computed(() => {
  if (!activeTabId.value) {
    return ExecutionStatus.IDLE;
  }
  return executionStore.getWorkflowStatus(activeTabId.value);
});

const isCurrentTabExecuting = computed(() => {
  return currentWorkflowStatus.value === ExecutionStatus.RUNNING || currentWorkflowStatus.value === ExecutionStatus.QUEUED;
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

const toggleQueuePopup = () => {
  showQueuePopup.value = !showQueuePopup.value;
};

// --- 执行与中断工作流 ---
const { executeWorkflow: executeActiveWorkflow } = useWorkflowExecution();

const handleExecuteWorkflow = async () => {
  console.log("触发执行工作流 (StatusBar)...");

  if (!activeTabId.value) {
    console.error("[StatusBar] 无法执行：没有活动的标签页。");
    dialogService.showError("请先选择一个标签页。");
    return;
  }

  if (isCurrentTabExecuting.value) {
    dialogService.showWarning("当前工作流已在执行或排队中。");
    return;
  }

  const currentElements = workflowStore.getElements(activeTabId.value);
  if (!currentElements || currentElements.length === 0) {
    const workflowDataFromStore = activeWorkflowData.value;
    if (workflowDataFromStore && workflowDataFromStore.nodes && workflowDataFromStore.nodes.length > 0) {
      console.warn("[StatusBar] 画布当前元素为空，但侦测到已加载的工作流数据。可能画布尚未完全渲染或同步。执行已取消。");
      dialogService.showError("画布尚未完全准备就绪，请稍等片刻或尝试重新加载工作流。");
    } else {
      console.error("[StatusBar] 无法执行：当前画布元素和工作流存储数据均为空或无效。");
      dialogService.showError("画布上没有元素可执行，或画布状态不正确。");
    }
    return;
  }
  await executeActiveWorkflow();
};

const handleInterruptWorkflow = async () => {
  if (!activeTabId.value) {
    dialogService.showError("没有活动的标签页来中断。");
    return;
  }
  const promptId = executionStore.getCurrentPromptId(activeTabId.value);
  if (!promptId) {
    dialogService.showError("无法找到当前执行的ID，可能任务已完成或状态尚未同步。");
    return;
  }
  await systemStatusStore.interrupt(promptId);
};

// --- 生命周期钩子 ---
onMounted(() => {
  // 获取初始的队列状态
  systemStatusStore.fetchInitialSystemStats();
});

onUnmounted(() => {
  // store 现在是全局监听，不需要在这里清理
});
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
