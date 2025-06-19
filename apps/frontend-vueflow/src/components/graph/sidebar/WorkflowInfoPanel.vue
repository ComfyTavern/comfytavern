<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useTabStore } from "@/stores/tabStore";
// 移除旧的 workflowManager 导入
// import { useWorkflowManager } from "@/composables/workflow/useWorkflowManager";
import { useWorkflowStore } from "@/stores/workflowStore";
import { generateSafeWorkflowFilename } from "@/utils/textUtils";
import { transformVueFlowToCoreWorkflow } from "@/utils/workflowTransformer"; // 更正导入的函数名
import { createHistoryEntry } from "@comfytavern/utils"; // 导入历史条目创建函数
import type { Node as VueFlowNode, Edge as VueFlowEdge } from "@vue-flow/core"; // 导入类型
// Import OverlayScrollbars
import { OverlayScrollbarsComponent } from "overlayscrollbars-vue";
import 'overlayscrollbars/overlayscrollbars.css';
import { useThemeStore } from "@/stores/theme"; // Import theme store for dark mode check

const tabStore = useTabStore();
// 移除旧的 workflowManager 实例
// const workflowManager = useWorkflowManager();
const workflowStore = useWorkflowStore(); // 获取 workflowStore 实例
const themeStore = useThemeStore(); // 获取 themeStore 实例

const { t } = useI18n();
const { activeTabId } = storeToRefs(tabStore);
const isDark = computed(() => themeStore.currentAppliedMode === 'dark'); // 获取 isDark 状态

// 获取当前活动标签页的工作流状态
const activeState = computed(() => {
  // 使用 workflowStore 获取状态
  return activeTabId.value ? workflowStore.getTabState(activeTabId.value) : undefined;
});

// 获取工作流数据
const workflowData = computed(() => activeState.value?.workflowData);

// 用于编辑的本地状态
const editingName = ref("");
const editingDescription = ref("");

// 监视 workflowData 的变化，更新本地编辑状态
watch(
  workflowData,
  (newData) => {
    editingName.value = newData?.name || "";
    editingDescription.value = newData?.description || "";
    // 移除 nameConflictError 重置
  },
  { immediate: true }
); // 立即执行一次以初始化

// 辅助函数格式化后缀
const formatSuffix = (num: number): string => {
  return `.${num.toString().padStart(3, "0")}`;
};

// 处理名称输入框失焦事件
const handleNameBlur = async () => {
  // 改为 async
  const currentTabId = activeTabId.value;
  if (!currentTabId || !workflowData.value) return;

  const currentWorkflowId = workflowData.value.id;
  const originalName = workflowData.value.name || "";
  const newNameTrimmed = editingName.value.trim();

  if (!newNameTrimmed) {
    editingName.value = originalName;
    return;
  }

  if (newNameTrimmed === originalName) {
    return;
  }

  let finalName = newNameTrimmed;
  let finalSafeFilename = generateSafeWorkflowFilename(finalName);
  let suffixCounter = 0;
  let conflict = false;

  // 循环检查冲突并添加后缀
  do {
    conflict = workflowStore.availableWorkflows.some(
      (wf) => wf.id === finalSafeFilename && wf.id !== currentWorkflowId // 确保比较的是 ID (safe filename)
    );

    if (conflict) {
      suffixCounter++;
      const suffix = formatSuffix(suffixCounter);
      finalName = `${newNameTrimmed}${suffix}`;
      finalSafeFilename = generateSafeWorkflowFilename(finalName);
    }
  } while (conflict);
  // 使用最终确定的名称更新状态
  if (finalName !== editingName.value) {
    console.log(t('workflowInfoPanel.logs.nameConflictAdjusted', { oldName: editingName.value, newName: finalName }));
    editingName.value = finalName; // 更新输入框显示的值
  }

  console.log(t('workflowInfoPanel.logs.coordinatingNameUpdate', { tabId: currentTabId, newName: finalName }));

  // 创建历史记录条目
  const historyEntry = createHistoryEntry(
    "modify",
    "workflowMetadata",
    t('workflowInfoPanel.history.nameChanged', { newName: finalName }),
    {
      property: "name",
      oldValue: originalName,
      newValue: finalName,
      workflowId: currentWorkflowId, // 添加 workflowId 以供参考
    }
  );

  // 调用协调器函数
  try {
    await workflowStore.updateWorkflowNameAndRecord(currentTabId, finalName, historyEntry);
    console.log(t('workflowInfoPanel.logs.nameUpdateSuccess', { tabId: currentTabId }));
  } catch (error) {
    console.error(t('workflowInfoPanel.logs.nameUpdateError', { tabId: currentTabId }), error);
    // 考虑错误处理，例如恢复原始名称或显示错误消息
    editingName.value = originalName; // 发生错误时恢复原始名称
  }
};
// 移除旧的直接调用
// workflowManager.updateWorkflowName(activeTabId.value, finalName);

// 处理描述文本域失焦事件
const handleDescriptionBlur = async () => {
  // 改为 async
  const currentTabId = activeTabId.value;
  if (!currentTabId || !workflowData.value) return;

  const originalDescription = workflowData.value.description || "";
  const newDescription = editingDescription.value; // 通常 textarea 不需要 trim，除非有特定需求

  if (newDescription !== originalDescription) {
    console.log(t('workflowInfoPanel.logs.coordinatingDescriptionUpdate', { tabId: currentTabId }));

    // 创建历史记录条目
    const historyEntry = createHistoryEntry(
      "modify",
      "workflowMetadata",
      t('workflowInfoPanel.history.descriptionChanged'), // 简短摘要
      {
        property: "description",
        oldValue: originalDescription,
        newValue: newDescription,
        workflowId: workflowData.value.id, // 添加 workflowId
        // 可以考虑截断过长的描述以优化 details
        summaryNewValue:
          newDescription.substring(0, 100) + (newDescription.length > 100 ? "..." : ""),
      }
    );

    // 调用协调器函数
    try {
      await workflowStore.updateWorkflowDescriptionAndRecord(
        currentTabId,
        newDescription,
        historyEntry
      );
      console.log(t('workflowInfoPanel.logs.descriptionUpdateSuccess', { tabId: currentTabId }));
    } catch (error) {
      console.error(
        t('workflowInfoPanel.logs.descriptionUpdateError', { tabId: currentTabId }),
        error
      );
      // 考虑错误处理
      editingDescription.value = originalDescription; // 发生错误时恢复
    }
    // 移除旧的直接调用
    // workflowManager.updateWorkflowDescription(activeTabId.value, editingDescription.value);
  }
};

// 计算节点数量
const nodeCount = computed(() => {
  // 添加类型注解
  return (
    activeState.value?.elements?.filter((el: VueFlowNode | VueFlowEdge) => !("source" in el))
      .length ?? 0
  );
});

// 控制节点列表展开/收起的状态
const isNodeListExpanded = ref(false);

// 获取节点列表
const workflowNodes = computed(() => {
  // 添加类型注解
  return (
    activeState.value?.elements?.filter((el: VueFlowNode | VueFlowEdge) => !("source" in el)) ?? []
  );
});

const logWorkflowJson = () => {
  if (activeState.value && activeState.value.elements && activeState.value.workflowData) {
    const workflowMeta = activeState.value.workflowData; // 这是 WorkflowStorageObject

    // 构造 FlowExportObject 给 transformVueFlowToCoreWorkflow
    // 需要 VueFlowNode 和 VueFlowEdge 类型断言
    const flowExportForTransform: import("@vue-flow/core").FlowExportObject = {
      nodes: activeState.value.elements.filter(
        (el): el is VueFlowNode => !("source" in el)
      ),
      edges: activeState.value.elements.filter(
        (el): el is VueFlowEdge => "source" in el
      ),
      position: [
        workflowMeta.viewport?.x ?? 0,
        workflowMeta.viewport?.y ?? 0,
      ],
      zoom: workflowMeta.viewport?.zoom ?? 1,
      viewport: workflowMeta.viewport || { x: 0, y: 0, zoom: 1 }, // 使用 workflowMeta 中的 viewport
    };

    // 使用 transformVueFlowToCoreWorkflow 从最新的 elements 和 viewport 生成核心数据
    const {
      nodes: currentNodes,
      edges: currentEdges,
      viewport: currentViewport,
    } = transformVueFlowToCoreWorkflow(flowExportForTransform);

    // 创建最终的日志对象，基于 workflowMeta 并更新 nodes, edges, viewport
    const currentWorkflowForLog: import("@comfytavern/types").WorkflowStorageObject = {
      ...workflowMeta, // 复制所有元数据
      nodes: currentNodes, // 使用最新的节点
      edges: currentEdges, // 使用最新的边
      viewport: currentViewport // 使用最新的视口
    };

    console.debug(t('workflowInfoPanel.logs.currentWorkflowJson'), JSON.stringify(currentWorkflowForLog, null, 2));
  } else {
    console.warn(t('workflowInfoPanel.logs.noActiveStateForLog'));
  }
};
</script>

<template>
  <div class="workflow-info-panel h-full flex flex-col text-sm">
    <h3 class="text-lg text-text-base font-semibold mb-4 border-b pb-2 border-border-base px-4 pt-4 flex-shrink-0">{{
      t('workflowInfoPanel.title') }}
    </h3>

    <OverlayScrollbarsComponent v-if="workflowData"
      :options="{ scrollbars: { autoHide: 'scroll', theme: isDark ? 'os-theme-light' : 'os-theme-dark' } }"
      class="flex-1 px-4 pb-4" defer>
      <div class="space-y-4"> <!-- Inner wrapper for spacing -->
        <div>
          <label for="workflow-name" class="block text-xs font-medium text-text-secondary mb-1">{{
            t('common.name') }}</label>
          <input id="workflow-name" type="text" v-model="editingName" @blur="handleNameBlur"
            :placeholder="t('workflowInfoPanel.placeholders.name')" class="input-sm w-full" />

          <p class="text-xs text-text-muted mt-1">{{ t('workflowInfoPanel.hints.name') }}</p>
        </div>

        <div>
          <label for="workflow-description" class="block text-xs font-medium text-text-secondary mb-1">{{
            t('common.description') }}</label>
          <textarea id="workflow-description" v-model="editingDescription" @blur="handleDescriptionBlur" rows="4"
            :placeholder="t('workflowInfoPanel.placeholders.description')" class="textarea-sm w-full"></textarea>
          <p class="text-xs text-text-muted mt-1">{{ t('workflowInfoPanel.hints.description') }}</p>
          <p class="text-xs text-text-muted mt-1">{{ t('workflowInfoPanel.hints.markdownSupport') }}</p>
        </div>

        <!-- 可以添加其他信息显示，如 ID, 创建/更新时间等 -->
        <div class="text-xs text-text-muted space-y-1 border-t pt-3 mt-4 border-border-base">
          <p><strong>{{ t('workflowInfoPanel.labels.id') }}</strong> {{ workflowData.id }}</p>
          <p v-if="workflowData.createdAt">
            <strong>{{ t('workflowInfoPanel.labels.createdAt') }}</strong> {{ new
              Date(workflowData.createdAt).toLocaleString() }}
          </p>
          <p v-if="workflowData.updatedAt">
            <strong>{{ t('workflowInfoPanel.labels.updatedAt') }}</strong> {{ new
              Date(workflowData.updatedAt).toLocaleString() }}
          </p>
          <p v-if="workflowData.version"><strong>{{ t('workflowInfoPanel.labels.version') }}</strong> {{
            workflowData.version }}</p>
          <p><strong>{{ t('workflowInfoPanel.labels.nodeCount') }}</strong> {{ nodeCount }}</p>
          <!-- 添加节点数量显示 -->

          <div class="mt-3">
            <button @click="logWorkflowJson"
              class="w-full px-3 py-1.5 text-xs font-medium text-center text-info bg-transparent border border-info/50 rounded-md hover:bg-info-softest focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-info dark:focus:ring-offset-background-surface shadow-sm">
              {{ t('workflowInfoPanel.buttons.logJson') }}
            </button>
          </div>
        </div>

        <!-- 节点列表 (可收起/展开) -->
        <div class="border-t pt-3 mt-4 border-border-base">
          <div class="flex items-center cursor-pointer hover:text-primary"
            @click="isNodeListExpanded = !isNodeListExpanded">
            <span class="transform transition-transform text-xs text-text-muted duration-200 mr-2"
              :class="{ 'rotate-90': isNodeListExpanded }">
              ▶
            </span>
            <h2 class="text-xs font-medium uppercase text-text-secondary">
              {{ t('workflowInfoPanel.nodeList.title', { count: nodeCount }) }}
            </h2>
          </div>
          <OverlayScrollbarsComponent v-if="isNodeListExpanded"
            :options="{ scrollbars: { autoHide: 'scroll', theme: isDark ? 'os-theme-light' : 'os-theme-dark' } }"
            class="mt-2 max-h-60 border rounded border-neutral-soft bg-background-base bg-opacity-50 p-2 text-xs" defer>
            <div v-if="workflowNodes.length === 0" class="text-text-muted italic">
              {{ t('workflowInfoPanel.nodeList.noNodes') }}
            </div>
            <ul v-else class="space-y-1">
              <li v-for="node in workflowNodes" :key="node.id" class="truncate py-0.5 text-text-muted">
                <span class="font-mono text-text-muted mr-1">[{{ node.type }}]</span>
                {{ node.label || node.id }}
              </li>
            </ul>
          </OverlayScrollbarsComponent>
        </div>
      </div>
    </OverlayScrollbarsComponent>
    <div v-else class="text-text-muted italic text-center py-6 px-4 flex-1">{{
      t('workflowInfoPanel.noActiveWorkflow') }}</div>
    <!-- Added flex-1 here -->
  </div>
</template>

<style scoped>
/* 使用 Tailwind 的 input 和 textarea 基础样式，并添加 sm 尺寸 */
.input-sm {
  @apply block w-full px-2 py-1 text-sm border border-border-base rounded-md shadow-sm placeholder-text-muted focus:outline-none focus:ring-primary focus:border-primary bg-background-base text-text-base;
  /* border-border-input -> border-border-base, placeholder-text-placeholder -> placeholder-text-muted, bg-background-input -> bg-background-base, text-text-input -> text-text-base */
}

.textarea-sm {
  @apply block w-full px-2 py-1 text-sm border border-border-base rounded-md shadow-sm placeholder-text-muted focus:outline-none focus:ring-primary focus:border-primary bg-background-base text-text-base;
  /* border-border-input -> border-border-base, placeholder-text-placeholder -> placeholder-text-muted, bg-background-input -> bg-background-base, text-text-input -> text-text-base */
}
</style>
