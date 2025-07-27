<template>
  <div ref="panelElementRef" class="right-preview-panel" :class="{ 'is-expanded': panelLayout.isExpanded }" :style="{
    width: panelLayout.isExpanded ? `${panelLayout.width}px` : '40px',
    height: panelLayout.isExpanded ? `${panelLayout.height}px` : '40px',
    top: `${panelLayout.top}px`, // 移除了 transform 以便通过 width/height 过渡实现动画
  }">
    <!-- 拖拽调整宽度的 Handle -->
    <div v-if="panelLayout.isExpanded" class="resize-handle-width" @mousedown.stop.prevent="startResizeWidth"></div>
    <!-- 拖拽调整高度的 Handle -->
    <div v-if="panelLayout.isExpanded" class="resize-handle-height" @mousedown.stop.prevent="startResizeHeight"></div>
    <!-- 拖拽调整宽度和高度的 Handle (左下角) -->
    <div v-if="panelLayout.isExpanded" class="resize-handle-corner" @mousedown.stop.prevent="startResizeCorner"></div>

    <!-- 面板头部，包含标题、模式切换和展开/收起按钮 -->
    <div class="panel-header" :class="{ collapsed: !panelLayout.isExpanded }" @mousedown.stop.prevent="startDragTop">
      <div v-if="panelLayout.isExpanded" class="flex items-center space-x-2 flex-grow min-w-0">
        <h3 class="panel-title truncate flex-shrink" :title="panelMode === 'singlePreview' && activeTarget
          ? t('rightPreviewPanel.titleSinglePreviewActive', { nodeName: nodeDisplayName, nodeId: activeTarget.nodeId })
          : panelMode === 'groupOverview' && activeTabId && groupOutputs
            ? t('rightPreviewPanel.titleGroupOverviewActive', { workflowName: activeWorkflowName })
            : t('rightPreviewPanel.titleDefault')
          ">
          <template v-if="panelMode === 'singlePreview'">
            <template v-if="activeTarget">
              {{ nodeDisplayName }}
              <span class="text-xs text-text-muted ml-1">(ID: {{ activeTarget.nodeId }})</span>
            </template>
            <template v-else>
              <span class="text-text-base">{{ t('rightPreviewPanel.singlePreview') }} <span
                  class="text-text-muted">{{ t('rightPreviewPanel.noTargetSelected') }}</span></span>
            </template>
          </template>
          <template v-else-if="panelMode === 'groupOverview'">
            <template v-if="activeTabId && groupOutputs"> <span
                class="text-lg font-semibold text-success">{{
                  activeWorkflowName }}</span> {{ t('rightPreviewPanel.groupOverview') }} </template>
            <template v-else>
              <span class="text-text-base">{{ t('rightPreviewPanel.groupOverview') }}
                <span class="text-text-muted">{{ t('rightPreviewPanel.noWorkflowAvailable') }}</span></span>
            </template>
          </template>
        </h3>
      </div>
      <!-- 按钮组 -->
      <div v-if="panelLayout.isExpanded"
        class="mode-switcher flex-shrink-0 flex items-center space-x-1 p-1 bg-neutral-softest rounded-md mx-2">
        <button @click="panelMode = 'singlePreview'" :class="[
          'px-2 py-0.5 text-xs rounded-md transition-colors',
          panelMode === 'singlePreview'
            ? 'bg-primary text-primary-content shadow-sm'
            : 'text-text-secondary hover:bg-neutral-softest',
        ]" v-comfy-tooltip="t('rightPreviewPanel.singleModeTooltip')">
          {{ t('rightPreviewPanel.singleModeButton') }}
        </button>
        <button @click="panelMode = 'groupOverview'" :class="[
          'px-2 py-0.5 text-xs rounded-md transition-colors',
          panelMode === 'groupOverview'
            ? 'bg-success text-primary-content shadow-sm'
            : 'text-text-secondary hover:bg-neutral-softest',
        ]" v-comfy-tooltip="t('rightPreviewPanel.groupModeTooltip')">
          {{ t('rightPreviewPanel.groupModeButton') }}
        </button>
      </div>
      <button class="toggle-button" @click="togglePanelExpansion">
        <svg v-if="!panelLayout.isExpanded" class="icon" viewBox="0 0 1024 1024" version="1.1"
          xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor">
          <path
            d="M771.3 1023.978h-617.1c-85 0-154.2-68.8-154.2-153.2v-717.5c0-84.5 68.8-153.2 153.2-153.2h717.6c40.9 0 79.4 16 108.4 44.9 28.9 29 44.9 67.6 44.9 108.6v589.5c0 18.8-15.2 34.1-34.1 34.1-18.8 0-34.1-15.1-34.1-34v-589.7c0-47-38.2-85.3-85-85.3h-717.5c-46.8 0-85 38.2-85 85v717.5c0 46.8 38.5 85 85.9 85h616.9c18.8 0 34.1 15.2 34.1 34.1 0.1 18.7-15.2 34.2-34 34.2zM512.1 785.078c-73 0-141.5-28.4-193.1-79.9-51.6-51.6-79.9-120.1-79.9-193.1s28.4-141.5 79.9-193.1c51.6-51.6 120.1-79.9 193.1-79.9s141.5 28.4 193.1 79.9c51.6 51.6 79.9 120.1 79.9 193.1s-28.4 141.5-79.9 193.1c-51.5 51.6-120.2 79.9-193.1 79.9z m0-477.9c-112.9 0-204.8 91.9-204.8 204.8s91.9 204.8 204.8 204.8 204.8-91.9 204.8-204.8c0-113-91.9-204.8-204.8-204.8zM840.7 874.578c-8.6 0-17.3-3.2-23.9-9.7l-158.7-155.5c-13.4-13.2-13.7-34.8-0.5-48.2 13.2-13.4 34.8-13.7 48.2-0.5l158.6 155.5c13.4 13.2 13.7 34.8 0.5 48.2-6.6 6.9-15.4 10.2-24.2 10.2z"
            p-id="2386"></path>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor"
          class="bi bi-arrow-right-square" viewBox="0 0 16 16">
          <path fill-rule="evenodd"
            d="M15 2a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2zM0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm4.5 5.5a.5.5 0 0 0 0 1h5.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L10.293 7.5H4.5z" />
        </svg>
      </button>
    </div>

    <!-- 面板内容区域 -->
    <div v-if="panelLayout.isExpanded" class="panel-content">
      <!-- 单一预览模式 -->
      <template v-if="panelMode === 'singlePreview'">
        <template v-if="activeTarget">
          <div class="p-4 flex flex-col overflow-hidden h-full space-y-2">
            <!-- 插槽信息 -->
            <p class="text-sm flex-shrink-0">
              <span class="font-semibold text-text-muted">{{ t('rightPreviewPanel.slotLabel') }}</span>
              <span class="text-text-base">{{ slotDisplayName }}</span>
              <span class="text-xs text-text-muted ml-1">({{ t('rightPreviewPanel.keyLabel') }} {{ activeTarget.slotKey }})</span>
              <span class="text-xs font-semibold text-text-muted uppercase ml-2">- {{ t('rightPreviewPanel.outputSuffix') }}</span>
              <span v-if="isStreamSlot"
                class="text-xs font-semibold text-accent uppercase ml-2">[{{ t('rightPreviewPanel.streamTag') }}]</span>
              <span v-if="isSingleStreamProcessing"
                class="text-info ml-2 font-normal text-xs">({{ t('rightPreviewPanel.streamingStatus') }})</span>
              <span v-else-if="isStreamSlot && isSingleStreamDone"
                class="text-success ml-2 font-normal text-xs">({{ t('rightPreviewPanel.streamEndedStatus') }})</span>
            </p>

            <div class="flex flex-col flex-grow overflow-hidden">
              <!-- 内容框：移除 max-h, 添加 flex-grow overflow-y-auto -->
              <div class="p-2 border rounded bg-neutral-softest flex-grow overflow-y-auto">
                <!-- 使用 mergedSinglePreviewContent， 增加 !== '' 的判断 -->
                <template v-if="
                  mergedSinglePreviewContent !== null &&
                  mergedSinglePreviewContent !== undefined &&
                  mergedSinglePreviewContent !== ''
                ">
                  <!-- 使用 mergedSinglePreviewContent -->
                  <MarkdownRenderer v-if="isMarkdownSlot && typeof mergedSinglePreviewContent === 'string'"
                    :markdown-content="mergedSinglePreviewContent" />
                  <pre v-else-if="
                    typeof mergedSinglePreviewContent === 'object' ||
                    Array.isArray(mergedSinglePreviewContent)
                  "
                    class="text-xs whitespace-pre-wrap break-all">{{ JSON.stringify(mergedSinglePreviewContent, null, 2) }}</pre>
                  <p v-else class="text-xs whitespace-pre-wrap break-all">
                    {{ String(mergedSinglePreviewContent) }}
                  </p>
                </template>
                <!-- 无内容时的提示 -->
                <p v-else class="text-xs text-text-muted italic">
                  <template v-if="isSingleStreamProcessing">{{ t('rightPreviewPanel.waitingForStreamData') }}</template>
                  <template v-else>{{ t('rightPreviewPanel.noPreviewData') }}</template>
                </p>
              </div>
            </div>
          </div>
        </template>
        <template v-else>
          <p class="p-4 text-sm text-text-muted">
            {{ t('rightPreviewPanel.noTargetSelectedHint') }}
          </p>
        </template>
      </template>

      <!-- 组输出总览模式 (保持不变) -->
      <!-- 组输出总览模式 -->
      <template v-else-if="panelMode === 'groupOverview'">
        <template v-if="!activeTabId">
          <p class="p-4 text-sm text-text-muted">{{ t('rightPreviewPanel.noActiveWorkflow') }}</p>
        </template>
        <template v-else-if="!groupOutputs || Object.keys(groupOutputs).length === 0">
          <p class="p-4 text-sm text-text-muted">{{ t('rightPreviewPanel.noGroupOutputsDefined') }}</p>
        </template>
        <template v-else-if="processedGroupOutputs.length > 0">
          <!-- 添加 overflow-y-auto 以便内容过多时滚动 -->
          <div class="p-2 space-y-2 overflow-y-auto h-full">
            <template v-for="item in processedGroupOutputs" :key="item.key">
              <div class="border border-border-base rounded-md overflow-hidden">
                <!-- Header -->
                <div @click="toggleGroupOutputCollapse(item.key)"
                  class="flex items-center justify-between p-2 bg-neutral-softest hover:bg-neutral-soft cursor-pointer transition-colors">
                  <span class="font-medium text-sm text-text-base">
                    {{ item.outputDef.displayName || item.key }}
                    <!-- 添加 STREAM 标签 -->
                    <span v-if="item.isStream"
                      class="text-xs font-semibold text-accent uppercase ml-1">[{{ t('rightPreviewPanel.streamTag') }}]</span>
                    <!-- 标题和状态 -->
                    <span class="text-xs mb-1 text-text-muted font-semibold">
                      {{ t('rightPreviewPanel.outputValueLabel') }}
                      <!-- 显示状态文本 -->
                      <span v-if="item.status" :class="['ml-2 font-normal text-xs', item.status.class]">
                        {{ item.status.text }}
                      </span>
                    </span>
                  </span>
                  <svg class="w-5 h-5 text-text-muted transform transition-transform duration-200"
                    :class="{ 'rotate-180': !isGroupOutputCollapsed(item.key) }" viewBox="0 0 20 20"
                    fill="currentColor">
                    <path fill-rule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clip-rule="evenodd" />
                  </svg>
                </div>
                <!-- Content: 合并后的单一内容块 -->
                <div v-show="!isGroupOutputCollapsed(item.key)"
                  class="p-2 border-t border-border-base bg-background-base space-y-1">
                  <!-- 内容显示区域 -->
                  <div class="p-1 border rounded bg-neutral-softest max-h-64 overflow-y-auto">
                    <!-- 有内容时 -->
                    <template v-if="!item.isEmpty">
                      <MarkdownRenderer v-if="item.isMarkdown && typeof item.content === 'string'"
                        :markdown-content="item.content" />
                      <pre v-else-if="typeof item.content === 'object' || Array.isArray(item.content)"
                        class="text-xs whitespace-pre-wrap break-all">{{ JSON.stringify(item.content, null, 2) }}</pre>
                      <p v-else class="text-xs whitespace-pre-wrap break-all">{{ String(item.content) }}</p>
                    </template>
                    <!-- 无内容时的提示 -->
                    <p v-else class="text-xs text-text-muted italic">
                      {{ item.emptyText }}
                    </p>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </template>
        <template v-else>
          <p class="p-4 text-sm text-text-muted">
            {{ t('rightPreviewPanel.noGroupOutputsAvailable') }}
          </p>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, type Ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useLocalStorage } from "@vueuse/core";
import { DataFlowType, type OutputDefinition, ExecutionStatus } from "@comfytavern/types";
import { useWorkflowManager } from "@/composables/workflow/useWorkflowManager";
import { useExecutionStore } from "@/stores/executionStore";
import { useWorkflowStore } from "@/stores/workflowStore";
import { useNodeStore } from "@/stores/nodeStore";
import MarkdownRenderer from "@/components/common/MarkdownRenderer.vue";
import type { Node as VueFlowNode } from "@vue-flow/core";


const { t } = useI18n();
const panelMode = useLocalStorage<"singlePreview" | "groupOverview">(
  "rightPreviewPanelMode", // 用于 localStorage 的键名
  "singlePreview" // 默认值
);
const groupOutputItemCollapseState = useLocalStorage(
  "groupOutputItemCollapseStatePerWorkflow",
  {} as Record<string, Record<string, boolean>>
);

const workflowManager = useWorkflowManager();
const executionStore = useExecutionStore();
const workflowStore = useWorkflowStore();
const nodeStore = useNodeStore();

const panelElementRef: Ref<HTMLElement | null> = ref(null);
const activeTarget = computed(() => workflowManager.activePreviewTarget.value);
const activeTabId = computed(() => workflowManager.activeTabId.value);

const activeWorkflowData = computed(() => {
  if (!activeTabId.value) return null;
  return workflowStore.getWorkflowData(activeTabId.value);
});

const activeWorkflowName = computed(() => {
  return activeWorkflowData.value?.name || activeTabId.value;
});

const groupOutputs = computed(() => {
  if (!activeWorkflowData.value?.interfaceOutputs) return null;
  return activeWorkflowData.value.interfaceOutputs;
});

const WORKFLOW_INTERFACE_OUTPUT_ID = "__WORKFLOW_INTERFACE_OUTPUTS__";

const displayableGroupOutputs = computed<Record<string, OutputDefinition>>(() => {
  const result: Record<string, OutputDefinition> = {};
  if (groupOutputs.value) {
    for (const key in groupOutputs.value) {
      const outputDef = groupOutputs.value[key];
      if (outputDef && outputDef.dataFlowType !== DataFlowType.CONVERTIBLE_ANY) {
        result[key] = outputDef;
      }
    }
  }
  return result;
});

const toggleGroupOutputCollapse = (outputKey: string) => {
  if (!activeTabId.value) return;
  const workflowId = activeTabId.value;
  if (!groupOutputItemCollapseState.value[workflowId]) {
    groupOutputItemCollapseState.value[workflowId] = {};
  }
  groupOutputItemCollapseState.value[workflowId][outputKey] = !(
    groupOutputItemCollapseState.value[workflowId][outputKey] ?? true
  );
};

const isGroupOutputCollapsed = (outputKey: string) => {
  if (!activeTabId.value) return true;
  const workflowId = activeTabId.value;
  // 默认展开
  return groupOutputItemCollapseState.value[workflowId]?.[outputKey] ?? false;
};

const isMarkdownContent = (content: unknown): content is string => {
  if (typeof content !== "string") return false;
  // 增加对空字符串的判断，避免空字符串被误判
  if (content.trim() === "") return false;
  return /^#|^\*\*|^-\s|^```|\[.*\]\(.*\)|!\[.*\]\(.*\)/.test(content);
};

watch(
  activeTarget,
  (newTarget) => {
    if (newTarget && panelMode.value === "groupOverview") {
      panelMode.value = "singlePreview";
    }
  },
  { deep: true }
);

watch(
  () => workflowManager.showGroupOutputOverview.value,
  (showGroupOverview) => {
    if (showGroupOverview) {
      panelMode.value = "groupOverview";
      if (!panelLayout.value.isExpanded) {
        panelLayout.value.isExpanded = true;
      }
      // 切换到组总览时，默认展开所有项
      if (activeTabId.value && groupOutputs.value) {
        const workflowId = activeTabId.value;
        if (!groupOutputItemCollapseState.value[workflowId]) {
          groupOutputItemCollapseState.value[workflowId] = {};
        }
        const currentWorkflowCollapseState = groupOutputItemCollapseState.value[workflowId];
        // 确保 currentWorkflowCollapseState 确实被赋值了 (虽然逻辑上它应该总是对象)
        if (currentWorkflowCollapseState) {
          Object.keys(groupOutputs.value).forEach(key => {
            currentWorkflowCollapseState[key] = false; // false 表示展开
          });
        }
      }
      workflowManager.clearGroupOutputOverviewRequest();
    }
  }
);

// 判断最终值是否为 stream_placeholder
const isPlaceholder = (data: any): boolean => {
  return typeof data === 'object' && data !== null && data.type === 'stream_placeholder';
};

// 最终/静态值 (保持不变)
const previewData = computed(() => {
  if (!activeTarget.value || !activeTabId.value) return null;
  const { nodeId, slotKey } = activeTarget.value;
  const tabState = executionStore.tabExecutionStates.get(activeTabId.value);
  if (tabState?.nodeOutputs?.[nodeId]?.[slotKey] !== undefined) {
    return tabState.nodeOutputs[nodeId][slotKey];
  }
  if (tabState?.nodePreviewOutputs?.[nodeId]?.[slotKey] !== undefined) {
    return tabState.nodePreviewOutputs[nodeId][slotKey];
  }
  return null;
});

const activeNodeInstance = computed<VueFlowNode | null>(() => {
  if (!activeTarget.value || !activeTabId.value) {
    return null;
  }
  const elements = workflowManager.getElements(activeTabId.value);
  const nodeElements = elements.filter((el) => !("source" in el)) as VueFlowNode[];
  const foundNode = nodeElements.find((n) => n.id === activeTarget.value!.nodeId) || null;
  return foundNode;
});

const nodeDisplayName = computed(() => {
  if (!activeNodeInstance.value) {
    return activeTarget.value?.nodeId || "N/A";
  }
  const node = activeNodeInstance.value;
  const nodeDef = node.type ? nodeStore.getNodeDefinitionByFullType(node.type) : undefined;
  return (
    node.data?.displayName || node.label || nodeDef?.displayName || node.id || node.type || "N/A"
  );
});

const activeSlotDefinition = computed<OutputDefinition | undefined>(() => {
  const node = activeNodeInstance.value;
  const slotKey = activeTarget.value?.slotKey;
  if (!node || !slotKey) return undefined;
  const instanceDef = node.data?.outputs?.[slotKey];
  if (instanceDef) return instanceDef;
  const nodeDef = node.type ? nodeStore.getNodeDefinitionByFullType(node.type) : undefined;
  return nodeDef?.outputs?.[slotKey];
});

// 判断当前选中的插槽是否为 STREAM 类型 (保持)
const isStreamSlot = computed(() => {
  return !!activeSlotDefinition.value?.isStream;
});

const slotDisplayName = computed(() => {
  if (!activeTarget.value) return "N/A";
  return activeSlotDefinition.value?.displayName || activeTarget.value.slotKey;
});

// 获取当前选中节点的累积流式文本 (保持)
const currentAccumulatedStreamText = computed(() => {
  if (!activeTabId.value || !activeTarget.value?.nodeId) {
    return "";
  }
  // 确保只在 isStreamSlot 为 true 时才真正去获取
  if (!isStreamSlot.value) return "";
  return (
    executionStore.getAccumulatedStreamedText(activeTabId.value, activeTarget.value.nodeId) || ""
  );
});

// 单一节点流状态判断 (保持)
const isSingleStreamDone = computed(() => {
  if (!activeTabId.value || !activeTarget.value?.nodeId) return false;
  if (!isStreamSlot.value) return false;
  const nodeState = executionStore.getNodeState(activeTabId.value, activeTarget.value.nodeId);
  return (
    nodeState === ExecutionStatus.COMPLETE ||
    nodeState === ExecutionStatus.ERROR ||
    nodeState === ExecutionStatus.INTERRUPTED
  );
});

const isSingleStreamProcessing = computed(() => {
  if (!activeTabId.value || !activeTarget.value?.nodeId) return false;
  if (!isStreamSlot.value) return false;
  const promptId = executionStore.getCurrentPromptId(activeTabId.value);
  if (!promptId) return false;
  if (isSingleStreamDone.value) return false;
  return !!executionStore.tabExecutionStates.get(activeTabId.value)?.streamingNodeContent?.[
    activeTarget.value.nodeId
  ];
});

// !!! 咕咕修正核心逻辑: 合并单一预览的内容显示
// 根据状态智能决定显示 实时流 还是 最终/静态值
const mergedSinglePreviewContent = computed(() => {
  if (!activeTarget.value || !activeTabId.value) return null;

  const finalOrStaticData = previewData.value; // 最终值 或 非流式静态值
  const streamText = currentAccumulatedStreamText.value; // 实时流文本

  // 核心判断：区分是否为流式插槽
  if (isStreamSlot.value) {
    // 情况 1: 是流式插槽
    if (isSingleStreamDone.value) {
      // 流已结束：如果最终值存在且不是 placeholder，则显示最终值，否则显示累积的流文本
      const finalDataIsValid = finalOrStaticData !== null && finalOrStaticData !== undefined && !isPlaceholder(finalOrStaticData);
      return finalDataIsValid ? finalOrStaticData : streamText;
    } else {
      // 1b: 流未结束 (正在处理 或 等待中) -> 显示实时累积的流文本 (如果为空，模板会显示"等待")
      return streamText;
    }
  } else {
    // 情况 2: 不是流式插槽 -> 始终显示静态值
    return finalOrStaticData;
  }
});
// !!! 咕咕修正结束

const getInterfaceStreamText = (interfaceKey: string) => {
  if (!activeTabId.value) return "";
  return executionStore.getAccumulatedInterfaceStreamedText(activeTabId.value, interfaceKey) || "";
};

const isInterfaceStreamDone = (interfaceKey: string) => {
  if (!activeTabId.value) return false;
  return executionStore.isInterfaceStreamComplete(activeTabId.value, interfaceKey) === true;
};

const isInterfaceStreamProcessing = (interfaceKey: string) => {
  if (!activeTabId.value) return false;
  const promptId = executionStore.getCurrentPromptId(activeTabId.value);
  if (!promptId) return false;
  if (isInterfaceStreamDone(interfaceKey)) return false;
  return !!executionStore.tabExecutionStates.get(activeTabId.value)?.streamingInterfaceOutputs?.[
    interfaceKey
  ];
};

const isMarkdownSlot = computed(() => {
  if (!activeTarget.value) return false;
  // 增加对内容本身的判断，如果内容看起来像Markdown也渲染
  const content = mergedSinglePreviewContent.value;
  if (typeof content === "string" && isMarkdownContent(content)) {
    return true;
  }
  if (activeTarget.value.slotKey.toLowerCase().includes("markdown")) return true;
  const outputSlotDef = activeSlotDefinition.value;
  if (
    outputSlotDef?.dataFlowType &&
    typeof outputSlotDef.dataFlowType === "string" &&
    outputSlotDef.dataFlowType.toLowerCase().includes("markdown")
  ) {
    return true;
  }
  return false;
});


// --- 组输出总览模式：新计算属性和方法 ---

// 核心方法：获取组输出项的合并内容
const getMergedGroupContent = (key: string, outputDef: OutputDefinition) => {
  const isStream = !!outputDef.isStream;
  const tabState = activeTabId.value ? executionStore.tabExecutionStates.get(activeTabId.value) : undefined;
  const finalData = tabState?.nodeOutputs?.[WORKFLOW_INTERFACE_OUTPUT_ID]?.[key];
  const streamText = getInterfaceStreamText(key); // 已有方法
  const streamDone = isInterfaceStreamDone(key); // 已有方法

  if (isStream) {
    if (streamDone) {
      // 流已结束：如果最终值存在且不是 placeholder，则显示最终值，否则显示累积的流文本
      const finalDataIsValid = finalData !== null && finalData !== undefined && !isPlaceholder(finalData);
      return finalDataIsValid ? finalData : streamText;
    } else {
      // 流未结束：显示实时流文本
      return streamText;
    }
  } else {
    // 非流式：显示静态最终值
    return finalData;
  }
};

// 获取组输出项的状态文本和样式
const getGroupStatusText = (key: string, outputDef: OutputDefinition): { text: string, class: string } | null => {
  const isStream = !!outputDef.isStream;
  if (!isStream) return null;

  const streamProcessing = isInterfaceStreamProcessing(key); // 已有方法
  const streamDone = isInterfaceStreamDone(key); // 已有方法

  if (streamProcessing) return { text: `(${t('rightPreviewPanel.streamingStatus')})`, class: "text-info" };
  if (streamDone) return { text: `(${t('rightPreviewPanel.streamEndedStatus')})`, class: "text-success" };
  return null;
};

// 判断组输出项是否为 Markdown
const isGroupOutputMarkdown = (key: string, outputDef: OutputDefinition, content: any): boolean => {
  if (typeof content === 'string' && isMarkdownContent(content)) return true; // isMarkdownContent 已有
  if (key.toLowerCase().includes("markdown")) return true;
  if (
    outputDef.dataFlowType && // outputDef.dataType 之前可能是笔误，应该是 dataFlowType
    typeof outputDef.dataFlowType === "string" &&
    outputDef.dataFlowType.toLowerCase().includes("markdown")
  ) {
    return true;
  }
  return false;
};

// 获取组输出项为空时的提示文本
const getGroupEmptyText = (key: string, outputDef: OutputDefinition, content: any): string => {
  const contentIsEmpty = content === null || content === undefined || content === "";
  if (!contentIsEmpty) return "";

  const isStream = !!outputDef.isStream;
  const streamProcessing = isInterfaceStreamProcessing(key); // 已有方法

  if (isStream && streamProcessing) return t('rightPreviewPanel.waitingForStreamData');
  return t('rightPreviewPanel.noGroupPreviewData');
};

const processedGroupOutputs = computed(() => {
  if (!displayableGroupOutputs.value) return []; // displayableGroupOutputs 已有
  return Object.entries(displayableGroupOutputs.value).map(([key, outputDef]) => {
    const content = getMergedGroupContent(key, outputDef);
    const status = getGroupStatusText(key, outputDef);
    const isEmpty = content === null || content === undefined || content === '';
    const markdown = isGroupOutputMarkdown(key, outputDef, content); // Renamed to avoid conflict
    const emptyText = getGroupEmptyText(key, outputDef, content);
    return {
      key,
      outputDef,
      content,
      status,
      isEmpty,
      isMarkdown: markdown, // Use the renamed variable
      emptyText,
      isStream: !!outputDef.isStream,
    };
  });
});
// --- 组输出总览模式：方法定义结束 ---

// --- 布局和拖拽逻辑 (保持不变) ---
const panelLayout = useLocalStorage("rightPreviewPanelLayout", {
  isExpanded: true,
  width: 350,
  height: 500,
  top: 100,
});

const wasDraggingHeader = ref(false);

const togglePanelExpansion = () => {
  if (wasDraggingHeader.value) {
    return;
  }
  panelLayout.value.isExpanded = !panelLayout.value.isExpanded;
};

const isResizingWidth = ref(false);
const initialMouseX = ref(0);
const initialWidth = ref(0);
const startResizeWidth = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  isResizingWidth.value = true;
  initialMouseX.value = event.clientX;
  initialWidth.value = panelLayout.value.width;
  panelElementRef.value?.classList.add("is-resizing");
  document.addEventListener("mousemove", handleResizeWidth);
  document.addEventListener("mouseup", stopResizeWidth);
};
const handleResizeWidth = (event: MouseEvent) => {
  if (!isResizingWidth.value) return;
  const deltaX = event.clientX - initialMouseX.value;
  const newWidth = initialWidth.value - deltaX;
  panelLayout.value.width = Math.max(200, Math.min(newWidth, 800));
};
const stopResizeWidth = () => {
  isResizingWidth.value = false;
  panelElementRef.value?.classList.remove("is-resizing");
  document.removeEventListener("mousemove", handleResizeWidth);
  document.removeEventListener("mouseup", stopResizeWidth);
};

const isResizingHeight = ref(false);
const initialMouseY = ref(0);
const initialHeight = ref(0);
const startResizeHeight = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  isResizingHeight.value = true;
  initialMouseY.value = event.clientY;
  initialHeight.value = panelLayout.value.height;
  panelElementRef.value?.classList.add("is-resizing");
  document.addEventListener("mousemove", handleResizeHeight);
  document.addEventListener("mouseup", stopResizeHeight);
};
const handleResizeHeight = (event: MouseEvent) => {
  if (!isResizingHeight.value) return;
  const deltaY = event.clientY - initialMouseY.value;
  const newHeight = initialHeight.value + deltaY;
  const maxPanelHeight = window.innerHeight - panelLayout.value.top - 20;
  panelLayout.value.height = Math.max(150, Math.min(newHeight, maxPanelHeight));
};
const stopResizeHeight = () => {
  isResizingHeight.value = false;
  panelElementRef.value?.classList.remove("is-resizing");
  document.removeEventListener("mousemove", handleResizeHeight);
  document.removeEventListener("mouseup", stopResizeHeight);
};

const isDraggingTop = ref(false);
const initialMouseYTop = ref(0);
const initialTop = ref(0);
const startDragTop = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  isDraggingTop.value = true;
  initialMouseYTop.value = event.clientY;
  initialTop.value = panelLayout.value.top;
  wasDraggingHeader.value = false;
  document.addEventListener("mousemove", handleDragTop);
  document.addEventListener("mouseup", stopDragTop);
};
const handleDragTop = (event: MouseEvent) => {
  if (!isDraggingTop.value) return;
  const deltaY = event.clientY - initialMouseYTop.value;
  if (Math.abs(deltaY) > 2) {
    wasDraggingHeader.value = true;
  }
  const newTop = initialTop.value + deltaY;
  const minTop = 0;
  const maxTop = window.innerHeight - 40;
  panelLayout.value.top = Math.max(minTop, Math.min(newTop, maxTop));
};
const stopDragTop = () => {
  setTimeout(() => {
    wasDraggingHeader.value = false;
  }, 0);
  isDraggingTop.value = false;
  document.removeEventListener("mousemove", handleDragTop);
  document.removeEventListener("mouseup", stopDragTop);
};

const isResizingCorner = ref(false);
const initialMouseXCorner = ref(0);
const initialMouseYCorner = ref(0);
const initialWidthCorner = ref(0);
const initialHeightCorner = ref(0);
const startResizeCorner = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  isResizingCorner.value = true;
  initialMouseXCorner.value = event.clientX;
  initialMouseYCorner.value = event.clientY;
  initialWidthCorner.value = panelLayout.value.width;
  initialHeightCorner.value = panelLayout.value.height;
  panelElementRef.value?.classList.add("is-resizing");
  document.addEventListener("mousemove", handleResizeCorner);
  document.addEventListener("mouseup", stopResizeCorner);
};
const handleResizeCorner = (event: MouseEvent) => {
  if (!isResizingCorner.value) return;
  const deltaX = event.clientX - initialMouseXCorner.value;
  const newWidth = initialWidthCorner.value - deltaX;
  panelLayout.value.width = Math.max(200, Math.min(newWidth, 800));
  const deltaY = event.clientY - initialMouseYCorner.value;
  const newHeight = initialHeightCorner.value + deltaY;
  const maxPanelHeight = window.innerHeight - panelLayout.value.top - 20;
  panelLayout.value.height = Math.max(150, Math.min(newHeight, maxPanelHeight));
};
const stopResizeCorner = () => {
  isResizingCorner.value = false;
  panelElementRef.value?.classList.remove("is-resizing");
  document.removeEventListener("mousemove", handleResizeCorner);
  document.removeEventListener("mouseup", stopResizeCorner);
};

onUnmounted(() => {
  document.removeEventListener("mousemove", handleResizeWidth);
  document.removeEventListener("mouseup", stopResizeWidth);
  document.removeEventListener("mousemove", handleResizeHeight);
  document.removeEventListener("mouseup", stopResizeHeight);
  document.removeEventListener("mousemove", handleDragTop);
  document.removeEventListener("mouseup", stopDragTop);
  document.removeEventListener("mousemove", handleResizeCorner);
  document.removeEventListener("mouseup", stopResizeCorner);
});
</script>

<style scoped>
/* Style 保持不变 */
.right-preview-panel {
  @apply fixed right-0 bg-background-base border border-border-base shadow-lg flex flex-col z-50 rounded-md;
  transition: width 0.2s ease-in-out, height 0.2s ease-in-out;
  overflow: hidden;
}

.right-preview-panel.is-expanded {
  @apply w-auto h-auto;
  /* 展开时靠右对齐，移除右侧圆角和边框 */
  border: none;
  /* 移除所有边框，由内部元素控制 */
  border-top-left-radius: 0.375rem;
  border-bottom-left-radius: 0.375rem;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  /* 添加左侧边框线感 */
  border-left: 1px solid hsl(var(--ct-border-base-hsl) / 1);
}

/* Removed .dark .right-preview-panel.is-expanded rule */

.right-preview-panel:not(.is-expanded) {
  @apply rounded-md;
}

.right-preview-panel.is-resizing {
  transition: none !important;
  user-select: none;
  pointer-events: none;
}

.right-preview-panel.is-resizing .resize-handle-width,
.right-preview-panel.is-resizing .resize-handle-height,
.right-preview-panel.is-resizing .resize-handle-corner,
.right-preview-panel.is-resizing .panel-header {
  pointer-events: auto;
}

.resize-handle-width {
  @apply absolute top-0 left-0 w-3 h-full cursor-ew-resize z-50;
}

.resize-handle-height {
  @apply absolute bottom-0 left-0 w-full h-3 cursor-ns-resize z-50;
}

.resize-handle-top {
  /* hover:bg-primary-softest (was hover:bg-blue-300/30) */
  @apply absolute top-0 left-0 w-full h-3 cursor-ns-resize z-50 bg-transparent hover:bg-primary-softest;
}

.resize-handle-corner {
  @apply absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize z-50 bg-neutral opacity-0 hover:opacity-100 rounded-tr-md transition-opacity duration-150;
}

.panel-header {
  @apply flex items-center justify-between p-2 border-b border-border-base flex-shrink-0 select-none;
  cursor: grab;
  /* 默认抓手光标 */
}

.panel-header:active {
  cursor: grabbing;
}

.panel-header.collapsed {
  @apply p-0 border-b-0 justify-center items-center;
  height: 100%;
  width: 100%;
  cursor: pointer;
  /* 收起时点击展开，非抓手 */
}

.panel-title {
  @apply text-lg font-semibold text-text-base;
}

.toggle-button {
  @apply p-1 text-text-muted hover:bg-neutral-softest rounded-md cursor-pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  /* 确保按钮始终可点击 */
}

.panel-header.collapsed .toggle-button {
  @apply w-full h-full flex items-center justify-center rounded-md;
}

.panel-content {
  @apply flex-grow p-0 overflow-hidden flex flex-col;
}
</style>
