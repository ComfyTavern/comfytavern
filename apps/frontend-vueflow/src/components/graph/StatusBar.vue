<template>
  <div
    class="status-bar bg-gray-100 dark:bg-gray-800 border-t border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm flex items-center justify-between shadow-inner"
  >
    <div class="flex items-center space-x-4 flex-grow">
      <!-- Added flex-grow -->
      <div class="text-blue-500 dark:text-blue-400 font-semibold">{{ projectName }}</div>
      <!-- 工作流菜单触发器 -->
      <div class="relative">
        <button ref="workflowButtonRef" @click="toggleWorkflowMenu" class="status-bar-button">
          工作流
        </button>
        <WorkflowMenu
          ref="workflowMenuRef"
          v-if="showWorkflowMenu"
          @close="showWorkflowMenu = false"
        />
      </div>
      <!-- Added TabBar and flex-grow -->

      <!-- 编辑菜单触发器 (如果需要) -->
      <!--
      <div class="relative">
        <button @click="toggleEditMenu" class="status-bar-button">编辑</button>
        <EditMenu v-if="showEditMenu" @close="showEditMenu = false" />
      </div>
      -->
      <!-- 可以添加其他菜单项，如视图、帮助等 -->
      <!-- 标签栏 -->
      <TabBar class="flex-grow" />
    </div>

    <div class="flex items-center space-x-4">
      <!-- 可停靠编辑器切换按钮 -->
      <button
        @click="toggleDockedEditor"
        :title="isDockedEditorVisible ? '隐藏编辑器面板' : '显示编辑器面板'"
        class="px-2 py-1 rounded border border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none transition-all duration-150"
        :class="{
          'text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/50':
            isDockedEditorVisible,
          'text-gray-500 dark:text-gray-500': !isDockedEditorVisible,
        }"
      >
        <svg
          v-if="isDockedEditorVisible"
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 inline-block"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
          />
        </svg>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 inline-block"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
          />
        </svg>
      </button>
      <!-- 实时预览切换按钮 -->
      <button
        @click="togglePreview"
        :title="isPreviewEnabled ? '禁用实时预览' : '启用实时预览'"
        class="px-2 py-1 rounded border border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none transition-all duration-150"
        :class="{
          'text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/50':
            isPreviewEnabled,
          'text-gray-500 dark:text-gray-500': !isPreviewEnabled,
        }"
      >
        <svg
          v-if="isPreviewEnabled"
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 inline-block"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 inline-block"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M2.458 12C3.732 7.943 7.523 5 12 5c1.556 0 3.04.28 4.416.793"
          />
        </svg>
      </button>
      <!-- 执行按钮 -->
      <button
        @click="handleExecuteWorkflow"
        class="px-3 py-1 rounded text-white font-medium bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500"
      >
        执行
      </button>
      <!-- 显示工作流执行状态 -->
      <span
        v-if="workflowStatusText"
        class="flex items-center space-x-1.5 text-xs font-medium ml-2"
        :class="{
          'text-yellow-700 dark:text-yellow-300': currentWorkflowStatus === ExecutionStatus.RUNNING,
          'text-green-700 dark:text-green-300': currentWorkflowStatus === ExecutionStatus.COMPLETE,
          'text-red-700 dark:text-red-300': currentWorkflowStatus === ExecutionStatus.ERROR,
          'text-gray-600 dark:text-gray-400':
            currentWorkflowStatus === ExecutionStatus.IDLE ||
            currentWorkflowStatus === ExecutionStatus.QUEUED ||
            currentWorkflowStatus === ExecutionStatus.SKIPPED,
        }"
      >
        <span
          class="inline-block h-2 w-2 rounded-full"
          :class="{
            'bg-yellow-500 animate-pulse': currentWorkflowStatus === ExecutionStatus.RUNNING,
            'bg-green-500': currentWorkflowStatus === ExecutionStatus.COMPLETE,
            'bg-red-500': currentWorkflowStatus === ExecutionStatus.ERROR,
            'bg-gray-400':
              currentWorkflowStatus === ExecutionStatus.IDLE ||
              currentWorkflowStatus === ExecutionStatus.QUEUED ||
              currentWorkflowStatus === ExecutionStatus.SKIPPED,
          }"
        ></span>
        <span>{{ workflowStatusText }}</span>
      </span>
      <!-- 也许可以添加 Zoom 控制等 -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue"; // <-- Removed onMounted, onUnmounted
import type { Edge as VueFlowEdge } from "@vue-flow/core"; // <-- Import VueFlowEdge
import { onClickOutside } from "@vueuse/core";
import { useWorkflowStore } from "@/stores/workflowStore"; // Import workflow store
import { useTabStore } from "@/stores/tabStore"; // Import tab store
import { useExecutionStore } from "@/stores/executionStore"; // 导入执行状态存储
import { useEditorState } from "@/composables/editor/useEditorState"; // <-- 咕咕：导入 editor state
import { useProjectStore } from "@/stores/projectStore"; // 导入项目状态存储
import { storeToRefs } from "pinia";
import WorkflowMenu from "@/components/graph/menus/WorkflowMenu.vue";
import TabBar from "@/components/graph/TabBar.vue"; // Import TabBar
// import Tooltip from '@/components/common/Tooltip.vue'; // 移除未使用的 Tooltip 导入
import { useWebSocket } from "@/composables/useWebSocket"; // 导入 WebSocket
// 移除 useVueFlow, 因为我们将从 store 获取数据
import {
  ExecutionStatus,
  WebSocketMessageType,
  type ExecuteWorkflowPayload,
} from "@comfytavern/types"; // 导入消息类型和负载类型
import { transformVueFlowToExecutionPayload } from "@/utils/workflowTransformer"; // <-- 导入转换函数
// import EditMenu from './menus/EditMenu.vue';

const workflowStore = useWorkflowStore();
// const { currentWorkflow, isDirty } = storeToRefs(workflowStore); // Removed, state is now per-tab
const tabStore = useTabStore(); // Instantiate tab store
const { activeTabId } = storeToRefs(tabStore); // Get reactive activeTabId
const executionStore = useExecutionStore(); // 获取执行状态存储实例
const { isPreviewEnabled } = storeToRefs(executionStore); // 获取预览状态
const { togglePreview } = executionStore; // 获取切换 Action
const { isDockedEditorVisible, toggleDockedEditor } = useEditorState(); // <-- 咕咕：获取编辑器状态和切换函数
const projectStore = useProjectStore();
const { currentProjectMetadata } = storeToRefs(projectStore); // <-- 修正：使用 currentProjectMetadata
const projectName = computed(() => currentProjectMetadata.value?.name || "ComfyTavern"); // 提供一个默认名称，以防项目名称为空
// const { workflowStatus } = storeToRefs(executionStore); // 不再直接解构全局状态
const showWorkflowMenu = ref(false);
const workflowButtonRef = ref<HTMLButtonElement | null>(null);
const workflowMenuRef = ref<InstanceType<typeof WorkflowMenu> | null>(null); // Ref for the component instance
const targetElementRef = ref<HTMLElement | null>(null); // Ref for the actual DOM element
// const showEditMenu = ref(false);

// Computed property for the active tab's workflow data
const activeWorkflowData = computed(() => {
  return activeTabId.value ? workflowStore.getWorkflowData(activeTabId.value) : null;
});

// 计算属性：获取当前活动标签页的工作流状态
const currentWorkflowStatus = computed(() => {
  if (!activeTabId.value) {
    return ExecutionStatus.IDLE; // 没有活动标签页，视为空闲
  }
  return executionStore.getWorkflowStatus(activeTabId.value);
});

// 计算属性：将 ExecutionStatus 枚举映射为用户友好的文本
const workflowStatusText = computed(() => {
  // 使用新的计算属性 currentWorkflowStatus
  switch (currentWorkflowStatus.value) {
    case ExecutionStatus.IDLE:
      return "空闲";
    case ExecutionStatus.QUEUED:
      return "排队中"; // Use QUEUED
    case ExecutionStatus.RUNNING:
      return "运行中...";
    case ExecutionStatus.COMPLETE:
      return "已完成"; // Use COMPLETE
    case ExecutionStatus.ERROR:
      return "错误";
    case ExecutionStatus.SKIPPED:
      return "已跳过"; // SKIPPED is correct
    default:
      return "";
  }
});

const toggleWorkflowMenu = () => {
  showWorkflowMenu.value = !showWorkflowMenu.value;
  // showEditMenu.value = false; // 关闭其他菜单
};

// const toggleEditMenu = () => {
//   showEditMenu.value = !showEditMenu.value;
//   showWorkflowMenu.value = false; // 关闭其他菜单
// };

// 点击外部关闭菜单
// 注意：onClickOutside 需要目标元素的实际 DOM 节点。
// 由于 WorkflowMenu 使用 v-if，它在隐藏时 DOM 节点不存在。
// 我们需要确保在 showWorkflowMenu 变为 true 后再获取 workflowMenuRef 的 DOM 元素。
// Watch the component ref. When the menu component mounts/unmounts (due to v-if),
// update the targetElementRef with the actual DOM element or null.
watch(workflowMenuRef, (newVal) => {
  // Use $el to get the root DOM node of the component instance
  targetElementRef.value = newVal ? (newVal.$el as HTMLElement) : null;
});

// Now use the targetElementRef (which holds the HTMLElement or null) for onClickOutside
onClickOutside(
  targetElementRef, // Pass the ref holding the DOM element
  (event: PointerEvent) => {
    // Check if the click target is outside the button
    if (workflowButtonRef.value && !workflowButtonRef.value.contains(event.target as Node)) {
      // The targetElementRef check is implicitly handled by onClickOutside
      showWorkflowMenu.value = false;
    }
  },
  {
    // Ignore clicks on the button itself
    ignore: [workflowButtonRef],
    // Optional: Detect clicks inside iframes if needed
    // detectIframe: true,
  }
);

// --- 执行工作流 ---
const { sendMessage } = useWebSocket();
// 移除 toObject

const handleExecuteWorkflow = () => {
  console.log("触发执行工作流...");
  if (!activeTabId.value) {
    console.error("无法执行：没有活动的标签页。");
    alert("请先选择一个标签页。");
    return;
  }
  const currentWorkflowValue = activeWorkflowData.value; // Use computed property for active tab data

  // 检查 store 中是否有有效的工作流数据
  if (
    !currentWorkflowValue ||
    !currentWorkflowValue.nodes ||
    currentWorkflowValue.nodes.length === 0
  ) {
    console.error("无法执行：当前工作流数据无效或为空。");
    // TODO: 向用户显示错误提示
    return;
  }

  // 使用转换函数将当前状态转换为执行载荷
  // Ensure the argument matches the expected structure { nodes: VueFlowNode[], edges: VueFlowEdge[] }
  // Use type assertion for edges to bypass markerEnd incompatibility, as it's not used in the execution payload.
  const executionPayloadData = transformVueFlowToExecutionPayload({
    nodes: currentWorkflowValue.nodes,
    edges: currentWorkflowValue.edges as VueFlowEdge[], // <-- Add type assertion
  });

  // Construct the payload according to ExecuteWorkflowPayload interface
  const payload: ExecuteWorkflowPayload = {
    // workflowId: currentWorkflowValue.id, // REMOVED: workflowId is not part of ExecuteWorkflowPayload
    // name: currentWorkflowValue.name || '未命名工作流', // Remove name, it's not part of the payload interface
    nodes: executionPayloadData.nodes, // 使用转换后的 nodes
    edges: executionPayloadData.edges, // 使用转换后的 edges
    // Optionally add clientId or metadata if needed by the backend
    // clientId: 'comfytavern-frontend',
  };

  console.log("发送 EXECUTE_WORKFLOW 消息, payload:", payload);
  sendMessage({
    type: WebSocketMessageType.PROMPT_REQUEST,
    payload: payload,
  });

  // 发送消息后立即更新状态为 PENDING
  if (activeTabId.value) {
    executionStore.setWorkflowStatusManually(activeTabId.value, ExecutionStatus.QUEUED); // Use QUEUED
  }

  // 状态栏将通过 computed 属性自动更新视觉反馈
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
  @apply px-2 py-0.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150 focus:outline-none;
}
</style>
