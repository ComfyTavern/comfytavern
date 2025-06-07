<template>
  <div ref="panelElementRef" class="right-preview-panel" :class="{ 'is-expanded': panelLayout.isExpanded }" :style="{
    width: panelLayout.isExpanded ? `${panelLayout.width}px` : '40px',
    height: panelLayout.isExpanded ? `${panelLayout.height}px` : '40px',
    top: `${panelLayout.top}px` // 移除了 transform 以便通过 width/height 过渡实现动画
  }">
    <!-- 拖拽调整宽度的 Handle -->
    <div v-if="panelLayout.isExpanded" class="resize-handle-width" @mousedown.stop.prevent="startResizeWidth"></div>
    <!-- 拖拽调整高度的 Handle -->
    <div v-if="panelLayout.isExpanded" class="resize-handle-height" @mousedown.stop.prevent="startResizeHeight"></div>
    <!-- 拖拽调整宽度和高度的 Handle (左下角) -->
    <div v-if="panelLayout.isExpanded" class="resize-handle-corner" @mousedown.stop.prevent="startResizeCorner"></div>
    <!-- 拖拽调整停靠位置 (顶部) 的 Handle | 多余了 -->
    <!--<div v-if="panelLayout.isExpanded" class="resize-handle-top" @mousedown.stop.prevent="startDragTop"></div>-->

    <!-- 面板头部，包含标题、模式切换和展开/收起按钮 -->
    <div class="panel-header" :class="{ 'collapsed': !panelLayout.isExpanded }" @mousedown.stop.prevent="startDragTop">
      <div v-if="panelLayout.isExpanded" class="flex items-center space-x-2 flex-grow min-w-0">
        <h3 class="panel-title truncate flex-shrink"
          :title="panelMode === 'singlePreview' && activeTarget ? `单一预览: ${nodeDisplayName} (ID: ${activeTarget.nodeId})` :
            (panelMode === 'groupOverview' && activeTabId && groupOutputs ? `组输出总览: ${activeWorkflowName}` :
              (panelMode === 'streamPreview' && activeTarget && activeTarget.nodeId ? `流式输出: ${nodeDisplayName} (ID: ${activeTarget.nodeId})` : '预览'))">
          <template v-if="panelMode === 'singlePreview'">
            <template v-if="activeTarget">
              单一: {{ nodeDisplayName }} <span class="text-xs text-gray-500 dark:text-gray-400 ml-1">(ID: {{
                activeTarget.nodeId }})</span>
            </template>
            <template v-else>
              <span class="text-gray-700 dark:text-gray-300">单一预览 <span
                  class="text-gray-400 dark:text-gray-500">（未选目标）</span></span>
            </template>
          </template>
          <template v-else-if="panelMode === 'groupOverview'">
            <template v-if="activeTabId && groupOutputs">
              组总览: {{ activeWorkflowName }}
            </template>
            <template v-else>
              <span class="text-gray-700 dark:text-gray-300">组输出总览 <span
                  class="text-gray-400 dark:text-gray-500">（无可用工作流）</span></span>
            </template>
          </template>
          <template v-else-if="panelMode === 'streamPreview'">
            <template v-if="activeTarget && activeTarget.nodeId">
              流式: {{ nodeDisplayName }} <span class="text-xs text-gray-500 dark:text-gray-400 ml-1">(ID: {{
                activeTarget.nodeId }})</span>
            </template>
            <template v-else>
              <span class="text-gray-700 dark:text-gray-300">流式输出 <span
                  class="text-gray-400 dark:text-gray-500">（未选目标）</span></span>
            </template>
          </template>
        </h3>
      </div>
      <div v-if="panelLayout.isExpanded"
        class="mode-switcher flex-shrink-0 flex items-center space-x-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-md mx-2">
        <button @click="panelMode = 'singlePreview'"
          :class="['px-2 py-0.5 text-xs rounded-md transition-colors', panelMode === 'singlePreview' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600']"
          title="单一插槽预览模式">
          单一
        </button>
        <button @click="panelMode = 'groupOverview'"
          :class="['px-2 py-0.5 text-xs rounded-md transition-colors', panelMode === 'groupOverview' ? 'bg-green-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600']"
          title="组输出总览模式">
          组总览
        </button>
        <button @click="panelMode = 'streamPreview'"
          :class="['px-2 py-0.5 text-xs rounded-md transition-colors', panelMode === 'streamPreview' ? 'bg-purple-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600']"
          title="流式输出预览模式">
          流式
        </button>
      </div>
      <button class="toggle-button" @click="togglePanelExpansion">
        <!-- 收起状态显示放大镜图标 -->
        <svg v-if="!panelLayout.isExpanded" class="icon" viewBox="0 0 1024 1024" version="1.1"
          xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor">
          <path
            d="M771.3 1023.978h-617.1c-85 0-154.2-68.8-154.2-153.2v-717.5c0-84.5 68.8-153.2 153.2-153.2h717.6c40.9 0 79.4 16 108.4 44.9 28.9 29 44.9 67.6 44.9 108.6v589.5c0 18.8-15.2 34.1-34.1 34.1-18.8 0-34.1-15.1-34.1-34v-589.7c0-47-38.2-85.3-85-85.3h-717.5c-46.8 0-85 38.2-85 85v717.5c0 46.8 38.5 85 85.9 85h616.9c18.8 0 34.1 15.2 34.1 34.1 0.1 18.7-15.2 34.2-34 34.2zM512.1 785.078c-73 0-141.5-28.4-193.1-79.9-51.6-51.6-79.9-120.1-79.9-193.1s28.4-141.5 79.9-193.1c51.6-51.6 120.1-79.9 193.1-79.9s141.5 28.4 193.1 79.9c51.6 51.6 79.9 120.1 79.9 193.1s-28.4 141.5-79.9 193.1c-51.5 51.6-120.2 79.9-193.1 79.9z m0-477.9c-112.9 0-204.8 91.9-204.8 204.8s91.9 204.8 204.8 204.8 204.8-91.9 204.8-204.8c0-113-91.9-204.8-204.8-204.8zM840.7 874.578c-8.6 0-17.3-3.2-23.9-9.7l-158.7-155.5c-13.4-13.2-13.7-34.8-0.5-48.2 13.2-13.4 34.8-13.7 48.2-0.5l158.6 155.5c13.4 13.2 13.7 34.8 0.5 48.2-6.6 6.9-15.4 10.2-24.2 10.2z"
            p-id="2386"></path>
        </svg>
        <!-- 展开状态显示向右箭头图标 -->
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
          <div class="p-4 space-y-2">
            <div>
              <p class="text-sm mb-2">
                <span class="font-semibold text-gray-500 dark:text-gray-400">插槽: </span>
                <span class="text-gray-800 dark:text-gray-100">{{ slotDisplayName }}</span>
                <span class="text-xs text-gray-500 dark:text-gray-400 ml-1">(Key: {{ activeTarget.slotKey }})</span>
                <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase ml-2">- 输出</span>
              </p>
              <div class="p-2 border rounded bg-gray-50 dark:bg-gray-700/50 max-h-96 overflow-y-auto"> <!-- 输出内容 -->
                <template v-if="previewData !== null && previewData !== undefined">
                  <MarkdownRenderer v-if="isMarkdownSlot && typeof previewData === 'string'"
                    :markdown-content="previewData" />
                  <pre v-else-if="typeof previewData === 'object' || Array.isArray(previewData)"
                    class="text-xs whitespace-pre-wrap break-all">{{ JSON.stringify(previewData, null, 2) }}</pre>
                  <p v-else class="text-xs whitespace-pre-wrap break-all">{{ String(previewData) }}</p>
                </template>
                <p v-else class="text-xs text-gray-500 dark:text-gray-400 italic">
                  无可用预览数据或插槽未产生输出。
                </p>
              </div>
            </div>
          </div>
        </template>
        <template v-else>
          <p class="p-4 text-sm text-gray-500 dark:text-gray-400">
            无预览目标被选中。右键点击节点输出桩或连线以预览。
          </p>
        </template>
      </template>

      <!-- 组输出总览模式 -->
      <template v-else-if="panelMode === 'groupOverview'">
        <template v-if="!activeTabId">
          <p class="p-4 text-sm text-gray-500 dark:text-gray-400">
            没有活动的工作流。
          </p>
        </template>
        <template v-else-if="!groupOutputs || Object.keys(groupOutputs).length === 0">
          <p class="p-4 text-sm text-gray-500 dark:text-gray-400">
            当前工作流没有定义组输出接口。
          </p>
        </template>
        <template v-else-if="displayableGroupOutputsCount > 0">
          <div class="p-2 space-y-2">
            <template v-for="(outputDef, key) in displayableGroupOutputs" :key="key">
              <!-- outputDef.dataFlowType !== DataFlowType.CONVERTIBLE_ANY is already filtered by displayableGroupOutputs -->
              <div class="border border-gray-200 dark:border-gray-600 rounded-md overflow-hidden">
                <div @click="toggleGroupOutputCollapse(String(key))"
                  class="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer transition-colors">
                  <span class="font-medium text-sm text-gray-700 dark:text-gray-200">{{ outputDef.displayName || key
                  }}</span>
                  <svg class="w-5 h-5 text-gray-500 dark:text-gray-400 transform transition-transform duration-200"
                    :class="{ 'rotate-180': !isGroupOutputCollapsed(String(key)) }" viewBox="0 0 20 20"
                    fill="currentColor">
                    <path fill-rule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clip-rule="evenodd" />
                  </svg>
                </div>
                <div v-show="!isGroupOutputCollapsed(String(key))"
                  class="p-2 border-t border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 space-y-2">
                  <div>
                    <p class="text-xs mb-1 text-gray-500 dark:text-gray-400 font-semibold">最终值:</p>
                    <template
                      v-if="groupPreviewData && groupPreviewData[key] !== null && groupPreviewData[key] !== undefined">
                      <MarkdownRenderer v-if="isMarkdownContent(groupPreviewData[key])"
                        :markdown-content="groupPreviewData[key] as string" />
                      <pre v-else-if="typeof groupPreviewData[key] === 'object' || Array.isArray(groupPreviewData[key])"
                        class="text-xs whitespace-pre-wrap break-all">{{ JSON.stringify(groupPreviewData[key], null, 2) }}</pre>
                      <p v-else class="text-xs whitespace-pre-wrap break-all">{{ String(groupPreviewData[key]) }}</p>
                    </template>
                    <p v-else class="text-xs text-gray-500 dark:text-gray-400 italic">
                      无最终预览数据。
                    </p>
                  </div>

                  <!-- 新增：显示接口的流式输出 -->
                  <div v-if="outputDef.dataFlowType === DataFlowType.STREAM">
                    <p class="text-xs mt-2 mb-1 text-gray-500 dark:text-gray-400 font-semibold">实时流:</p>
                    <div class="p-1 border rounded bg-gray-100 dark:bg-gray-700/30 max-h-48 overflow-y-auto">
                      <pre v-if="getInterfaceStreamText(String(key))" class="text-xs whitespace-pre-wrap break-all">{{ getInterfaceStreamText(String(key)) }}</pre>
                      <p v-else-if="isInterfaceStreamProcessing(String(key))" class="text-xs text-gray-500 dark:text-gray-400 italic">等待流数据...</p>
                      <p v-else class="text-xs text-gray-500 dark:text-gray-400 italic">无流数据。</p>
                    </div>
                    <p v-if="isInterfaceStreamDone(String(key))" class="text-xs text-green-500 dark:text-green-400 mt-1">流已结束。</p>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </template>
        <template v-else>
          <!-- This case implies activeTabId and groupOutputs exist, but all are CONVERTIBLE_ANY or no displayable outputs -->
          <p class="p-4 text-sm text-gray-500 dark:text-gray-400">
            当前工作流的组输出没有可用接口。
          </p>
        </template>
      </template>

      <!-- 流式预览模式 -->
      <template v-else-if="panelMode === 'streamPreview'">
        <template v-if="activeTarget && activeTarget.nodeId">
          <div class="p-4 space-y-2">
            <div>
              <p class="text-xs mb-2 text-gray-500 dark:text-gray-400">实时流式文本输出：</p>
              <div class="p-2 border rounded bg-gray-50 dark:bg-gray-700/50 max-h-96 overflow-y-auto">
                <pre v-if="currentAccumulatedStreamText"
                  class="text-xs whitespace-pre-wrap break-all">{{ currentAccumulatedStreamText }}</pre>
                <p v-else class="text-xs text-gray-500 dark:text-gray-400 italic">
                  等待流数据...
                </p>
              </div>
            </div>
          </div>
        </template>
        <template v-else>
          <p class="p-4 text-sm text-gray-500 dark:text-gray-400">
            无预览目标被选中。右键点击节点以激活流式预览。
          </p>
        </template>
      </template>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, type Ref, computed, watch } from 'vue'; // Added watch
import { useLocalStorage } from '@vueuse/core';
import { DataFlowType, type OutputDefinition } from '@comfytavern/types'; // ChunkPayload 不再需要在这里导入, 添加 WorkflowNode, OutputDefinition
import { useWorkflowManager } from '@/composables/workflow/useWorkflowManager';
import { useExecutionStore } from '@/stores/executionStore';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useNodeStore } from '@/stores/nodeStore';
import MarkdownRenderer from '@/components/common/MarkdownRenderer.vue';
import type { Node as VueFlowNode } from "@vue-flow/core";

// 新增：面板模式状态
const panelMode = ref<'singlePreview' | 'groupOverview' | 'streamPreview'>('singlePreview');

// 新增：组输出项的折叠状态 (使用 activeTabId 作为 key)
const groupOutputItemCollapseState = useLocalStorage('groupOutputItemCollapseStatePerWorkflow', {} as Record<string, Record<string, boolean>>);

const workflowManager = useWorkflowManager();
const executionStore = useExecutionStore();
const workflowStore = useWorkflowStore();
const nodeStore = useNodeStore();

const panelElementRef: Ref<HTMLElement | null> = ref(null);

const activeTarget = computed(() => workflowManager.activePreviewTarget.value);
const activeTabId = computed(() => workflowManager.activeTabId.value);

// 获取当前工作流数据
const activeWorkflowData = computed(() => {
  if (!activeTabId.value) return null;
  return workflowStore.getWorkflowData(activeTabId.value);
});

// 新增：获取当前活动工作流的名称
const activeWorkflowName = computed(() => {
  return activeWorkflowData.value?.name || activeTabId.value; // 如果 name 不存在，则回退到显示 id
});

// 获取当前工作流的 interfaceOutputs 定义
const groupOutputs = computed(() => {
  if (!activeWorkflowData.value?.interfaceOutputs) return null; // 直接从 activeWorkflowData 访问
  return activeWorkflowData.value.interfaceOutputs; // 直接从 activeWorkflowData 访问
});

// 获取组输出的预览数据 (运行时值)
const WORKFLOW_INTERFACE_OUTPUT_ID = '__WORKFLOW_INTERFACE_OUTPUTS__'; // 特殊ID，需要与执行引擎约定

const groupPreviewData = computed(() => {
  if (!activeTabId.value || !groupOutputs.value) return null;
  const tabState = executionStore.tabExecutionStates.get(activeTabId.value);

  if (!tabState || !tabState.nodeOutputs || !tabState.nodeOutputs[WORKFLOW_INTERFACE_OUTPUT_ID]) {
    return null;
  }
  const outputs = tabState.nodeOutputs[WORKFLOW_INTERFACE_OUTPUT_ID];
  if (!outputs) return null;

  return Object.keys(groupOutputs.value).reduce((acc, key) => {
    const outputDefinition = groupOutputs.value![key];
    if (outputDefinition && outputDefinition.dataFlowType !== DataFlowType.CONVERTIBLE_ANY) {
      acc[key] = outputs && key in outputs ? outputs[key] : null;
    }
    return acc;
  }, {} as Record<string, any>);
});

// 新增：计算可显示的组输出项
const displayableGroupOutputs = computed<Record<string, OutputDefinition>>(() => {
  const result: Record<string, OutputDefinition> = {};
  if (groupOutputs.value) {
    for (const key in groupOutputs.value) {
      const outputDef = groupOutputs.value[key];
      // Add a check to ensure outputDef is defined before accessing its properties
      if (outputDef && outputDef.dataFlowType !== DataFlowType.CONVERTIBLE_ANY) {
        result[key] = outputDef; // outputDef is narrowed to OutputDefinition here
      }
    }
  }
  return result;
});

const displayableGroupOutputsCount = computed(() => {
  return Object.keys(displayableGroupOutputs.value).length;
});

// 处理组输出项的折叠状态
const toggleGroupOutputCollapse = (outputKey: string) => {
  if (!activeTabId.value) return;
  const workflowId = activeTabId.value;
  if (!groupOutputItemCollapseState.value[workflowId]) {
    groupOutputItemCollapseState.value[workflowId] = {};
  }
  groupOutputItemCollapseState.value[workflowId][outputKey] = !(groupOutputItemCollapseState.value[workflowId][outputKey] ?? true);
};

const isGroupOutputCollapsed = (outputKey: string) => {
  if (!activeTabId.value) return true;
  const workflowId = activeTabId.value;
  // 默认折叠 (返回 true)
  return groupOutputItemCollapseState.value[workflowId]?.[outputKey] ?? true;
};

// 简单的 Markdown 内容检测
const isMarkdownContent = (content: unknown): content is string => {
  if (typeof content !== 'string') return false;
  return /^#|^\*\*|^-\s|^```|\[.*\]\(.*\)|!\[.*\]\(.*\)/.test(content);
};

// 监听 activeTarget 的变化
watch(activeTarget, (newTarget, oldTarget) => {
  // 如果设置了新的单一预览目标，并且当前不是流式预览，则切换回单一预览模式
  if (newTarget && panelMode.value === 'groupOverview') {
    panelMode.value = 'singlePreview';
  }
  // 如果节点目标改变，并且当前是流式预览模式，可能需要重置流式内容
  // (这部分逻辑可以根据具体需求调整，例如，如果流式内容是持久的直到手动清除)
  if (newTarget?.nodeId !== oldTarget?.nodeId && panelMode.value === 'streamPreview') {
    // currentAccumulatedStreamText 会通过 computed 自动更新
  }
}, { deep: true });

// 监听来自 workflowManager 的请求，切换到组输出总览模式
watch(() => workflowManager.showGroupOutputOverview.value, (showGroupOverview) => {
  if (showGroupOverview) {
    panelMode.value = 'groupOverview';
    if (!panelLayout.value.isExpanded) { // 如果面板当前是收起的
      panelLayout.value.isExpanded = true; // 则展开面板
    }
    workflowManager.clearGroupOutputOverviewRequest(); // 重置请求
  }
});

const previewData = computed(() => {
  if (!activeTarget.value || !activeTabId.value) return null;
  const { nodeId, slotKey } = activeTarget.value;
  const tabState = executionStore.tabExecutionStates.get(activeTabId.value);
  if (!tabState || !tabState.nodeOutputs || !tabState.nodeOutputs[nodeId]) {
    // 尝试从 nodePreviewOutputs 获取，如果 nodeOutputs 中没有
    // 这取决于流式预览是否会写入 previewOutputs
    // 根据 store 的逻辑，NODE_COMPLETE 会写入 nodeOutputs 或 nodePreviewOutputs
    // NODE_YIELD 应该类似地决定写入哪里
    // 假设 NODE_YIELD 会更新到 nodeOutputs (如果主流程)
    if (tabState?.nodePreviewOutputs && tabState.nodePreviewOutputs[nodeId]) {
      return tabState.nodePreviewOutputs[nodeId]?.[slotKey] ?? null;
    }
    return null;
  }
  return tabState.nodeOutputs[nodeId]?.[slotKey] ?? null;
});

const activeNodeInstance = computed<VueFlowNode | null>(() => {
  if (!activeTarget.value || !activeTabId.value) {
    return null;
  }
  const elements = workflowManager.getElements(activeTabId.value);
  const nodeElements = elements.filter(el => !("source" in el)) as VueFlowNode[]; // 过滤出节点
  const foundNode = nodeElements.find(n => n.id === activeTarget.value!.nodeId) || null;
  return foundNode;
});

const nodeDisplayName = computed(() => {
  if (!activeNodeInstance.value) {
    return activeTarget.value?.nodeId || 'N/A';
  }
  const node = activeNodeInstance.value; // 类型为 VueFlowNode
  const nodeDef = node.type ? nodeStore.getNodeDefinitionByFullType(node.type) : undefined;
  return node.data?.displayName || node.label || nodeDef?.displayName || node.id || node.type || 'N/A';
});

const slotDisplayName = computed(() => {
  if (!activeNodeInstance.value || !activeTarget.value) {
    return activeTarget.value?.slotKey || 'N/A';
  }
  const node = activeNodeInstance.value; // 类型为 VueFlowNode
  const slotKey = activeTarget.value.slotKey;

  const vueFlowSlotData = node.data?.outputs?.[slotKey];
  if (vueFlowSlotData?.displayName) {
    return vueFlowSlotData.displayName;
  }

  const nodeDef = node.type ? nodeStore.getNodeDefinitionByFullType(node.type) : undefined;
  const outputSlotDefFromDef = nodeDef?.outputs?.[slotKey];
  return outputSlotDefFromDef?.displayName || slotKey;
});

// 新增：计算属性，用于获取当前选中节点的累积流式文本
const currentAccumulatedStreamText = computed(() => {
  if (!activeTabId.value || !activeTarget.value?.nodeId) {
    return '';
  }
  return executionStore.getAccumulatedStreamedText(activeTabId.value, activeTarget.value.nodeId) || '';
});

// 新增：用于获取工作流接口流式数据的方法
const getInterfaceStreamText = (interfaceKey: string) => {
  if (!activeTabId.value) return '';
  return executionStore.getAccumulatedInterfaceStreamedText(activeTabId.value, interfaceKey) || '';
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
  // 检查 store 中是否存在该接口流的记录，无论是否有数据，只要记录存在且未完成，就视为正在处理
  return !!executionStore.tabExecutionStates.get(activeTabId.value)?.streamingInterfaceOutputs?.[interfaceKey];
};


const isMarkdownSlot = computed(() => {
  if (!activeTarget.value) return false;
  // 启发式规则
  if (activeTarget.value.slotKey.toLowerCase().includes('markdown')) return true;

  const node = activeNodeInstance.value; // 类型为 VueFlowNode
  if (node) {
    const slotKey = activeTarget.value.slotKey;
    const outputSlotDef = node.data?.outputs?.[slotKey]; // 从 VueFlowNode.data 获取
    if (outputSlotDef?.dataFlowType && typeof outputSlotDef.dataFlowType === 'string' && outputSlotDef.dataFlowType.toLowerCase().includes('markdown')) {
      return true;
    }
    // 可选: 如果 VueFlowNode.data 中没有，再尝试从 nodeDef 获取
    // const nodeDef = node.type ? nodeStore.getNodeDefinitionByFullType(node.type) : undefined;
    // const outputSlotDefFromDef = nodeDef?.outputs?.[slotKey];
    // if (outputSlotDefFromDef?.dataFlowType && typeof outputSlotDefFromDef.dataFlowType === 'string' && outputSlotDefFromDef.dataFlowType.toLowerCase().includes('markdown')) return true;
  }
  return false;
});

const panelLayout = useLocalStorage('rightPreviewPanelLayout', {
  isExpanded: true,
  width: 300,
  height: 400,
  top: 100,
});

const wasDraggingHeader = ref(false); // 新增：用于判断是否正在拖拽头部

const togglePanelExpansion = () => {
  if (wasDraggingHeader.value) {
    // 如果刚刚是拖拽操作，则不切换展开状态，并重置标志
    // wasDraggingHeader.value = false; // 这个重置应该在 stopDragTop 或 mousedown 时处理
    return;
  }
  panelLayout.value.isExpanded = !panelLayout.value.isExpanded;
};

// 宽度拖拽逻辑
const isResizingWidth = ref(false);
const initialMouseX = ref(0);
const initialWidth = ref(0);

const startResizeWidth = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  isResizingWidth.value = true;
  initialMouseX.value = event.clientX;
  initialWidth.value = panelLayout.value.width;
  panelElementRef.value?.classList.add('is-resizing');
  document.addEventListener('mousemove', handleResizeWidth);
  document.addEventListener('mouseup', stopResizeWidth);
};

const handleResizeWidth = (event: MouseEvent) => {
  if (!isResizingWidth.value) return;
  const deltaX = event.clientX - initialMouseX.value;
  const newWidth = initialWidth.value - deltaX;
  panelLayout.value.width = Math.max(200, Math.min(newWidth, 800));
};

const stopResizeWidth = () => {
  isResizingWidth.value = false;
  panelElementRef.value?.classList.remove('is-resizing');
  document.removeEventListener('mousemove', handleResizeWidth);
  document.removeEventListener('mouseup', stopResizeWidth);
};

// 高度拖拽逻辑
const isResizingHeight = ref(false);
const initialMouseY = ref(0);
const initialHeight = ref(0);

const startResizeHeight = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  isResizingHeight.value = true;
  initialMouseY.value = event.clientY;
  initialHeight.value = panelLayout.value.height;
  panelElementRef.value?.classList.add('is-resizing');
  document.addEventListener('mousemove', handleResizeHeight);
  document.addEventListener('mouseup', stopResizeHeight);
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
  panelElementRef.value?.classList.remove('is-resizing');
  document.removeEventListener('mousemove', handleResizeHeight);
  document.removeEventListener('mouseup', stopResizeHeight);
};

// 停靠位置 (Top) 拖拽逻辑
const isDraggingTop = ref(false);
const initialMouseYTop = ref(0);
const initialTop = ref(0);

const startDragTop = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  isDraggingTop.value = true;
  initialMouseYTop.value = event.clientY;
  initialTop.value = panelLayout.value.top;
  wasDraggingHeader.value = false; // 每次开始拖动（或点击）头部时，重置拖拽标志
  document.addEventListener('mousemove', handleDragTop);
  document.addEventListener('mouseup', stopDragTop);
};

const handleDragTop = (event: MouseEvent) => {
  if (!isDraggingTop.value) return;
  const deltaY = event.clientY - initialMouseYTop.value;
  if (deltaY !== 0) { // 只有当实际发生拖动时才标记
    wasDraggingHeader.value = true;
  }
  const newTop = initialTop.value + deltaY;
  const minTop = 0;
  const maxTop = window.innerHeight - 40; // 40 是收起时的高度
  panelLayout.value.top = Math.max(minTop, Math.min(newTop, maxTop));
};

const stopDragTop = () => {
  isDraggingTop.value = false;
  document.removeEventListener('mousemove', handleDragTop);
  document.removeEventListener('mouseup', stopDragTop);
};

// 左下角拖拽逻辑 (同时调整宽度和高度)
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
  panelElementRef.value?.classList.add('is-resizing');
  document.addEventListener('mousemove', handleResizeCorner);
  document.addEventListener('mouseup', stopResizeCorner);
};

const handleResizeCorner = (event: MouseEvent) => {
  if (!isResizingCorner.value) return;

  const deltaX = event.clientX - initialMouseXCorner.value;
  // 因为是从左边拖拽，所以 deltaX 增加时，宽度应该减少
  const newWidth = initialWidthCorner.value - deltaX;
  panelLayout.value.width = Math.max(200, Math.min(newWidth, 800));

  const deltaY = event.clientY - initialMouseYCorner.value;
  const newHeight = initialHeightCorner.value + deltaY;
  const maxPanelHeight = window.innerHeight - panelLayout.value.top - 20; // 20 是一个大致的底部边距
  panelLayout.value.height = Math.max(150, Math.min(newHeight, maxPanelHeight));
};

const stopResizeCorner = () => {
  isResizingCorner.value = false;
  panelElementRef.value?.classList.remove('is-resizing');
  document.removeEventListener('mousemove', handleResizeCorner);
  document.removeEventListener('mouseup', stopResizeCorner);
};

onUnmounted(() => {
  document.removeEventListener('mousemove', handleResizeWidth);
  document.removeEventListener('mouseup', stopResizeWidth);
  document.removeEventListener('mousemove', handleResizeHeight);
  document.removeEventListener('mouseup', stopResizeHeight);
  document.removeEventListener('mousemove', handleDragTop);
  document.removeEventListener('mouseup', stopDragTop);
  document.removeEventListener('mousemove', handleResizeCorner);
  document.removeEventListener('mouseup', stopResizeCorner);
});
</script>

<style scoped>
.right-preview-panel {
  @apply fixed right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg flex flex-col z-50 rounded-md;
  /* 添加圆角 */
  transition: width 0.2s ease-in-out, height 0.2s ease-in-out;
  /* 对宽度和高度应用过渡，实现展开收起动画 */
  overflow: hidden;
  /* 防止内容在收起时溢出 */
}

.right-preview-panel.is-expanded {
  @apply w-auto h-auto;
  /* 展开时移除边框，因为内部有 panel-header 的边框 */
  border: none;
  /* 展开时移除外层边框，因为 panel-header 有自己的边框 */
  border-top-left-radius: 0.375rem;
  /* 保持左上圆角 */
  border-bottom-left-radius: 0.375rem;
  /* 保持左下圆角 */
  border-top-right-radius: 0;
  /* 展开时右上角不需要圆角，因为它贴边 */
  border-bottom-right-radius: 0;
  /* 展开时右下角不需要圆角 */
}

/* 收起状态下的特定圆角，确保像一个独立的圆角图标按钮 */
.right-preview-panel:not(.is-expanded) {
  @apply rounded-md;
}

.right-preview-panel.is-resizing {
  transition: none !important;
  /* 拖拽时禁用所有过渡效果，确保即时响应 */
}

.resize-handle-width {
  @apply absolute top-0 left-0 w-3 h-full cursor-ew-resize z-50;
  /* 稍微加宽拖拽区域 */
}

.resize-handle-height {
  @apply absolute bottom-0 left-0 w-full h-3 cursor-ns-resize z-50;
  /* 稍微加高拖拽区域 */
}

.resize-handle-top {
  @apply absolute top-0 left-0 w-full h-3 cursor-ns-resize z-50 bg-transparent hover:bg-blue-300/30;
  /* 稍微加高拖拽区域 */
}

.resize-handle-corner {
  @apply absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize z-50 bg-gray-400 dark:bg-gray-600 opacity-0 hover:opacity-100 rounded-tr-md transition-opacity duration-150;
  /* 左下角控制点，平时透明，悬停时不透明，右上圆角 */
}

.panel-header {
  @apply flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0;
  cursor: grab;
  /* 整个头部都可以拖动 */
}

.panel-header.collapsed {
  @apply p-0 border-b-0 justify-center items-center;
  /* 收起时居中图标, 确保垂直也居中 */
  height: 100%;
  /* 确保按钮填满收起后的容器 */
  width: 100%;
  /* 确保按钮填满收起后的容器 */
}

.panel-title {
  @apply text-lg font-semibold text-gray-700 dark:text-gray-200;
}

.toggle-button {
  @apply p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md;
  /* 给按钮本身也加点圆角 */
  display: flex;
  /* 用于更好地控制SVG图标的对齐 */
  align-items: center;
  justify-content: center;
}

.panel-header.collapsed .toggle-button {
  @apply w-full h-full flex items-center justify-center rounded-md;
  /* 让图标在按钮内也居中，并保持圆角 */
}

.panel-content {
  @apply flex-grow p-0 overflow-y-auto;
}
</style>