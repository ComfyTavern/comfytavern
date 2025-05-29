<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { useTabStore } from "@/stores/tabStore";
// 移除旧的 workflowManager 导入
// import { useWorkflowManager } from "@/composables/workflow/useWorkflowManager";
import { useWorkflowStore } from "@/stores/workflowStore";
import { generateSafeWorkflowFilename } from "@/utils/textUtils";
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

const { activeTabId } = storeToRefs(tabStore);
const { isDark } = storeToRefs(themeStore); // 获取 isDark 状态

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
    console.log(`名称调整以避免冲突：从 "${editingName.value}" 调整为 "${finalName}"`);
    editingName.value = finalName; // 更新输入框显示的值
  }

  console.log(`Coordinating workflow name update for tab ${currentTabId} to: ${finalName}`);

  // 创建历史记录条目
  const historyEntry = createHistoryEntry(
    "modify",
    "workflowMetadata",
    `修改工作流名称为 "${finalName}"`,
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
    console.log(`Workflow name update coordinated successfully for tab ${currentTabId}.`);
  } catch (error) {
    console.error(`Error coordinating workflow name update for tab ${currentTabId}:`, error);
    // 考虑错误处理，例如恢复原始名称或显示错误消息
    editingName.value = originalName; // 发生错误时恢复原始名称
  }
  // 移除旧的直接调用
  // workflowManager.updateWorkflowName(activeTabId.value, finalName);
};

// 处理描述文本域失焦事件
const handleDescriptionBlur = async () => {
  // 改为 async
  const currentTabId = activeTabId.value;
  if (!currentTabId || !workflowData.value) return;

  const originalDescription = workflowData.value.description || "";
  const newDescription = editingDescription.value; // 通常 textarea 不需要 trim，除非有特定需求

  if (newDescription !== originalDescription) {
    console.log(`Coordinating workflow description update for tab ${currentTabId}`);

    // 创建历史记录条目
    const historyEntry = createHistoryEntry(
      "modify",
      "workflowMetadata",
      `修改工作流描述`, // 简短摘要
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
      console.log(`Workflow description update coordinated successfully for tab ${currentTabId}.`);
    } catch (error) {
      console.error(
        `Error coordinating workflow description update for tab ${currentTabId}:`,
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
</script>

<template>
  <div class="workflow-info-panel h-full flex flex-col text-sm">
    <h3 class="text-lg font-semibold mb-4 border-b pb-2 dark:border-gray-600 px-4 pt-4 flex-shrink-0">工作流信息</h3>

    <OverlayScrollbarsComponent v-if="workflowData"
      :options="{ scrollbars: { autoHide: 'scroll', theme: isDark ? 'os-theme-light' : 'os-theme-dark' } }"
      class="flex-1 px-4 pb-4" defer>
      <div class="space-y-4"> <!-- Inner wrapper for spacing -->
        <div>
          <label for="workflow-name" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">名称</label>
          <input id="workflow-name" type="text" v-model="editingName" @blur="handleNameBlur" placeholder="工作流名称"
            class="input-sm w-full" />

          <p class="text-xs text-gray-500 mt-1">工作流的显示名称。如果名称冲突，会自动添加后缀。</p>
        </div>

        <div>
          <label for="workflow-description"
            class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">描述</label>
          <textarea id="workflow-description" v-model="editingDescription" @blur="handleDescriptionBlur" rows="4"
            placeholder="工作流描述信息..." class="textarea-sm w-full"></textarea>
          <p class="text-xs text-gray-500 mt-1">详细描述这个工作流的功能和用途。</p>
          <p class="text-xs text-gray-500 mt-1">支持markdown语法。</p>
        </div>

        <!-- 可以添加其他信息显示，如 ID, 创建/更新时间等 -->
        <div class="text-xs text-gray-500 space-y-1 border-t pt-3 mt-4 dark:border-gray-600">
          <p><strong>ID:</strong> {{ workflowData.id }}</p>
          <p v-if="workflowData.createdAt">
            <strong>创建时间:</strong> {{ new Date(workflowData.createdAt).toLocaleString() }}
          </p>
          <p v-if="workflowData.updatedAt">
            <strong>更新时间:</strong> {{ new Date(workflowData.updatedAt).toLocaleString() }}
          </p>
          <p v-if="workflowData.version"><strong>版本:</strong> {{ workflowData.version }}</p>
          <p><strong>节点数量:</strong> {{ nodeCount }}</p>
          <!-- 添加节点数量显示 -->
        </div>

        <!-- 节点列表 (可收起/展开) -->
        <div class="border-t pt-3 mt-4 dark:border-gray-600">
          <div class="flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
            @click="isNodeListExpanded = !isNodeListExpanded">
            <span class="transform transition-transform duration-200 mr-2" :class="{ 'rotate-90': isNodeListExpanded }">
              ▶
            </span>
            <h2 class="text-xs font-medium uppercase text-gray-600 dark:text-gray-400">
              工作流节点列表 ({{ nodeCount }})
            </h2>
          </div>
          <OverlayScrollbarsComponent v-if="isNodeListExpanded"
            :options="{ scrollbars: { autoHide: 'scroll', theme: isDark ? 'os-theme-light' : 'os-theme-dark' } }"
            class="mt-2 max-h-60 border rounded dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-2 text-xs" defer>
            <div v-if="workflowNodes.length === 0" class="text-gray-400 italic">
              此工作流中没有节点。
            </div>
            <ul v-else class="space-y-1">
              <li v-for="node in workflowNodes" :key="node.id" class="truncate py-0.5">
                <span class="font-mono text-gray-500 dark:text-gray-400 mr-1">[{{ node.type }}]</span>
                {{ node.label || node.id }}
              </li>
            </ul>
          </OverlayScrollbarsComponent>
        </div>
      </div>
    </OverlayScrollbarsComponent>
    <div v-else class="text-gray-500 italic text-center py-6 px-4 flex-1">没有活动的工作流或数据不可用。</div>
    <!-- Added flex-1 here -->
  </div>
</template>

<style scoped>
/* 使用 Tailwind 的 input 和 textarea 基础样式，并添加 sm 尺寸 */
.input-sm {
  @apply block w-full px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500;
}

.textarea-sm {
  @apply block w-full px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500;
}
</style>
