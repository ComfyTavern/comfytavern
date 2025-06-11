<template>
  <div class="history-panel p-4 h-full flex flex-col">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-lg font-semibold text-gray-ID_MAX_LEN00 dark:text-gray-200">操作历史</h3>
      <span v-if="currentHistory" class="text-sm text-gray-500 dark:text-gray-400">
        {{ currentHistory.items.length }} / {{ MAX_HISTORY_LENGTH }}
      </span>
    </div>
    <div v-if="!activeTabId" class="text-gray-500 dark:text-gray-400 text-center mt-4">
      没有活动的标签页。
    </div>
    <div v-else-if="!currentHistory || currentHistory.items.length === 0" class="text-gray-500 dark:text-gray-400">
      当前标签页没有历史记录。
    </div>
    <OverlayScrollbarsComponent v-else :options="{
      scrollbars: { autoHide: 'scroll', theme: isDark ? 'os-theme-light' : 'os-theme-dark' },
    }" class="flex-1" defer>
      <ul class="space-y-2">
        <li v-for="item in reversedHistoryItems" :key="item.originalIndex"
          v-comfy-tooltip="{
            content: generateTooltipContent(item),
            placement: 'left',
            delayShow: 100,
            offset: 10,
            width: 'auto',
            copyButton: true,
            interactive: true
          }"
          class="history-item p-2 rounded cursor-pointer transition-colors duration-150" :class="{
            'bg-blue-100 dark:bg-blue-900 text-blue-ID_MAX_LEN00 dark:text-blue-200 font-medium':
              item.originalIndex === currentHistory.currentIndex,
            'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300':
              item.originalIndex !== currentHistory.currentIndex,
            'opacity-50': item.originalIndex > currentHistory.currentIndex,
          }" @click="handleHistoryClick(item.originalIndex)">
          <span class="mr-2 w-6 text-right text-gray-500 dark:text-gray-400">{{
            item.originalIndex
          }}</span>
          <span class="mr-2">{{
            item.originalIndex === currentHistory.savedIndex ? "💾" : "•"
          }}</span>
          <span class="flex-1 truncate">{{ item.entry?.summary || "未命名操作" }}</span>
        </li>
      </ul>
    </OverlayScrollbarsComponent>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
// import Tooltip from "../../common/Tooltip.vue"; // Tooltip 组件不再直接使用
// Import OverlayScrollbars and theme
import { OverlayScrollbarsComponent } from "overlayscrollbars-vue";
import "overlayscrollbars/overlayscrollbars.css";
import { useThemeStore } from "@/stores/theme";
import {
  useWorkflowHistory,
  MAX_HISTORY_LENGTH,
  type HistoryItem, // Import HistoryItem type
} from "../../../composables/workflow/useWorkflowHistory";
import { useTabStore } from "../../../stores/tabStore";
import { useWorkflowStore } from "../../../stores/workflowStore";

const tabStore = useTabStore();
const workflowHistory = useWorkflowHistory();
const workflowStore = useWorkflowStore(); // 获取 workflowStore 实例

const { activeTabId } = storeToRefs(tabStore);
const themeStore = useThemeStore(); // Get theme store instance
const { isDark } = storeToRefs(themeStore); // Get isDark state
// useWorkflowHistory 不直接暴露 historyMap，需要通过 getHistoryState 获取

// 获取当前活动标签页的历史记录对象
const currentHistory = computed(() => {
  if (!activeTabId.value) {
    return null;
  }
  // 使用 getHistoryState 函数获取当前标签页的状态
  return workflowHistory.getHistoryState(activeTabId.value);
});

// 创建一个计算属性来反转历史记录项，并保留原始索引
const reversedHistoryItems = computed(() => {
  if (!currentHistory.value) {
    return [];
  }
  // 创建一个包含原始索引的新数组并反转
  return currentHistory.value.items
    .map((item, index) => ({ ...item, originalIndex: index }))
    .reverse();
});

// Helper function to format detail values for tooltip
const MAX_RECURSION_DEPTH = 5; // 最大递归深度
const STRING_MAX_LEN = 160; // 字符串最大显示长度
const ID_MAX_LEN = 16; // ID 最大显示长度
const ARRAY_MAX_ITEMS_SHALLOW = 15; // 浅层数组最大显示项数
const OBJECT_MAX_PROPS_SHALLOW = 15; // 浅层对象最大显示属性数

const formatDetailValue = (
  value: any,
  currentDepth: number = 0,
  isInsideArray: boolean = false,
): string => {
  const indent = "  ".repeat(currentDepth + (isInsideArray ? 1 : 0)); // 数组内元素额外缩进
  const nestedIndent = "  ".repeat(currentDepth + 1 + (isInsideArray ? 1 : 0));

  if (currentDepth > MAX_RECURSION_DEPTH) {
    return `${indent}[深度超限]`;
  }

  if (value === null) return `${indent}null`;
  if (value === undefined) return `${indent}undefined`;
  if (typeof value === "boolean") return `${indent}${String(value)}`;
  if (typeof value === "number") return `${indent}${String(value)}`;
  if (typeof value === "string") {
    return value.length > STRING_MAX_LEN
      ? `${indent}"${value.substring(0, STRING_MAX_LEN)}..."`
      : `${indent}"${value}"`;
  }

  // 特定对象类型的优先处理
  if (typeof value === "object" && value !== null) {
    // 节点对象
    if (
      "nodeId" in value &&
      "nodeName" in value &&
      "nodeType" in value &&
      Object.keys(value).length <= 5 // 避免过于复杂的对象被错误识别
    ) {
      const nodeIdStr = String(value.nodeId);
      const displayNodeId = nodeIdStr.length > ID_MAX_LEN ? nodeIdStr.substring(0, ID_MAX_LEN) + "..." : nodeIdStr;
      let nodeStr = `${indent}节点: ${value.nodeName} (类型: ${value.nodeType}, ID: ${displayNodeId})`;
      return nodeStr;
    }
    // 边对象
    if (
      "edgeId" in value &&
      "sourceNodeId" in value &&
      "targetNodeId" in value &&
      Object.keys(value).length <= 6 // 类似节点的考虑
    ) {
      const edgeIdStr = String(value.edgeId);
      const displayEdgeId = edgeIdStr.length > ID_MAX_LEN ? edgeIdStr.substring(0, ID_MAX_LEN) + "..." : edgeIdStr;
      const sourceNodeIdStr = String(value.sourceNodeId);
      const displaySourceNodeId = sourceNodeIdStr.length > ID_MAX_LEN ? sourceNodeIdStr.substring(0, ID_MAX_LEN) + "..." : sourceNodeIdStr;
      const targetNodeIdStr = String(value.targetNodeId);
      const displayTargetNodeId = targetNodeIdStr.length > ID_MAX_LEN ? targetNodeIdStr.substring(0, ID_MAX_LEN) + "..." : targetNodeIdStr;

      return `${indent}边: ${displayEdgeId} (源: ${displaySourceNodeId}(${value.sourceHandle || ""}) -> 目标: ${displayTargetNodeId}(${value.targetHandle || ""}))`;
    }
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return `${indent}[] (0)`;
    let arrStr = `${indent}( ${value.length} )`;
    const itemsToShow = currentDepth === 0 ? value : value.slice(0, ARRAY_MAX_ITEMS_SHALLOW); // 顶层数组完整显示，嵌套数组部分显示
    for (let i = 0; i < itemsToShow.length; i++) {
      arrStr += `\n${nestedIndent}- ${formatDetailValue(itemsToShow[i], currentDepth + 1, true).trimStart()}`;
    }
    if (currentDepth > 0 && value.length > ARRAY_MAX_ITEMS_SHALLOW) {
      arrStr += `\n${nestedIndent}- ... (${value.length - ARRAY_MAX_ITEMS_SHALLOW} more)`;
    }
    return arrStr;
  }

  if (typeof value === "object" && value !== null) {
    const objValue = value as Record<string, any>;
    const keys = Object.keys(objValue);
    if (keys.length === 0) return `${indent}{}`;
    let objStr = `${indent}{`;
    const propsToShow = currentDepth === 0 ? keys : keys.slice(0, OBJECT_MAX_PROPS_SHALLOW);
    for (let i = 0; i < propsToShow.length; i++) {
      const key = propsToShow[i];
      objStr += `\n${nestedIndent}"${key}": ${formatDetailValue(
        // @ts-ignore
        objValue[key],
        currentDepth + 1,
        false,
      ).trimStart()}`;
    }
    if (currentDepth > 0 && keys.length > OBJECT_MAX_PROPS_SHALLOW) {
      objStr += `\n${nestedIndent}... (${keys.length - OBJECT_MAX_PROPS_SHALLOW} more properties)`;
    }
    objStr += `\n${indent}}`;
    return objStr;
  }

  try {
    const str = JSON.stringify(value);
    return str.length > STRING_MAX_LEN
      ? `${indent}${str.substring(0, STRING_MAX_LEN)}...`
      : `${indent}${str}`;
  } catch (e) {
    return `${indent}[序列化失败]`;
  }
};

// Function to generate tooltip content dynamically
const generateTooltipContent = (item: HistoryItem & { originalIndex: number }): string => {
  if (!item || !item.entry || !currentHistory.value) {
    return "无效的历史记录项";
  }

  const { entry, originalIndex } = item;
  const { currentIndex, savedIndex } = currentHistory.value;

  const status =
    originalIndex === currentIndex ? "当前" : originalIndex < currentIndex ? "过去" : "未来";
  const savedStatus = originalIndex === savedIndex ? " (已保存)" : "";

  let detailsString = "\n\n**详情:**";
  if (entry.details && Object.keys(entry.details).length > 0) {
    detailsString += Object.entries(entry.details)
      .map(([key, value]) => {
        if (key === 'movedNodes' && Array.isArray(value)) {
          const header = `\`${key}\`(${value.length}):`;
          let itemsContent = "";
          if (value.length > 0) {
            itemsContent = value.map((nodeItem: any) => {
              const formattedNode = formatDetailValue(nodeItem, 0, false).trimStart();
              return `    - ${formattedNode}`; // Indent by 4 spaces, add bullet
            }).join("\n");
          }
          return `\n  - ${header}${itemsContent ? `\n${itemsContent}` : ''}`;
        } else {
          // 初始调用 formatDetailValue，深度为0
          const formattedValue = formatDetailValue(value, 0).trimStart();
          return `\n  - \`${key}\`:\n${formattedValue.replace(/^/gm, "    ")}`; // 为整个值块增加缩进
        }
      })
      .join("");
  } else {
    detailsString += "\n  无";
  }

  return `**操作:** ${entry.summary || "未命名操作"}
**索引:** ${originalIndex}
**状态:** ${status}${savedStatus}${detailsString}
`;
};

// 处理历史记录项点击事件 - 使用原始索引
const handleHistoryClick = (targetOriginalIndex: number) => {
  if (!activeTabId.value || !currentHistory.value) return;

  const currentOriginalIndex = currentHistory.value.currentIndex;
  const steps = targetOriginalIndex - currentOriginalIndex; // 使用原始索引计算步数

  // console.debug(
  //   `[HistoryPanel] Clicked original index ${targetOriginalIndex}. Current original index ${currentOriginalIndex}. Steps: ${steps}`
  // );

  if (steps > 0) {
    // 需要重做
    workflowStore.redo(steps); // 调用 workflowStore 的 redo 方法
    // console.debug(`[HistoryPanel] Calling workflowStore.redo(${steps})`);
  } else if (steps < 0) {
    // 需要撤销
    workflowStore.undo(Math.abs(steps)); // 调用 workflowStore 的 undo 方法
    // console.debug(`[HistoryPanel] Calling workflowStore.undo(${Math.abs(steps)})`);
  } else {
    // console.debug("[HistoryPanel] Clicked on the current state, no action needed.");
  }
};
</script>

<style scoped>
.history-panel {
  /* 基本样式 */
}

.history-item {
  /* 列表项样式 */
  list-style: none;
  /* 移除默认列表标记 */
  @apply flex items-center;
  /* Use flex to align items */
}

/* 可以添加更多自定义样式 */
</style>
