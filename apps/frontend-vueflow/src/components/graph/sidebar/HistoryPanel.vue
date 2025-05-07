<template>
  <div class="history-panel p-4 h-full flex flex-col">
    <!-- Use flex column -->
    <div class="flex justify-between items-center mb-4">
      <!-- Flex container for title and count -->
      <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200">操作历史</h3>
      <span v-if="currentHistory" class="text-sm text-gray-500 dark:text-gray-400">
        {{ currentHistory.items.length }} / {{ MAX_HISTORY_LENGTH }}
      </span>
    </div>
    <div v-if="!activeTabId" class="text-gray-500 dark:text-gray-400 text-center mt-4">
      <!-- Center text -->
      没有活动的标签页。
    </div>
    <div v-else-if="!currentHistory || currentHistory.items.length === 0" class="text-gray-500 dark:text-gray-400">
      当前标签页没有历史记录。
    </div>
    <!-- Roo: Apply OverlayScrollbars to the history list -->
    <OverlayScrollbarsComponent v-else :options="{
      scrollbars: { autoHide: 'scroll', theme: isDark ? 'os-theme-light' : 'os-theme-dark' },
    }" class="flex-1" defer>
      <ul class="space-y-2">
        <!-- Removed flex-1 and overflow-y-auto from ul -->
        <Tooltip v-for="item in reversedHistoryItems" :key="item.originalIndex" :content="generateTooltipContent(item)"
          placement="left" :showDelay="100" :offsetValue="10" width="auto" :showCopyButton="true" :interactive="true">
          <li class="history-item p-2 rounded cursor-pointer transition-colors duration-150" :class="{
            'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-medium':
              item.originalIndex === currentHistory.currentIndex,
            'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300':
              item.originalIndex !== currentHistory.currentIndex,
            'opacity-50': item.originalIndex > currentHistory.currentIndex, // 未来状态置灰 (基于原始索引)
          }" @click="handleHistoryClick(item.originalIndex)">
            <span class="mr-2 w-6 text-right text-gray-500 dark:text-gray-400">{{
              item.originalIndex
            }}</span>
            <!-- Display original index -->
            <span class="mr-2">{{
              item.originalIndex === currentHistory.savedIndex ? "💾" : "•"
            }}</span>
            <!-- Check savedIndex against originalIndex -->
            <span class="flex-1 truncate">{{ item.entry?.summary || "未命名操作" }}</span>
            <!-- <-- Use item.entry.summary -->
            <!-- Allow label to truncate -->
          </li>
        </Tooltip>
      </ul>
    </OverlayScrollbarsComponent>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import Tooltip from "../../common/Tooltip.vue";
// Roo: Import OverlayScrollbars and theme
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
const themeStore = useThemeStore(); // Roo: Get theme store instance
const { isDark } = storeToRefs(themeStore); // Roo: Get isDark state
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
const formatDetailValue = (value: any): string => {
  // <-- Remove key parameter
  if (value === null || value === undefined) {
    return String(value);
  }
  if (typeof value === "string") {
    const MAX_LEN = 50;
    return value.length > MAX_LEN ? `"${value.substring(0, MAX_LEN)}..."` : `"${value}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    // --- 通用数组格式化 (生成嵌套 Markdown 列表) ---
    const MAX_ARRAY_LINES = 5; // 最多显示多少行（项）
    const MAX_ITEM_LENGTH = 160; // 每项字符串最大长度
    const formattedItems = value
      .slice(0, MAX_ARRAY_LINES)
      .map((item) => {
        try {
          let strRep: string;
          if (typeof item === "object" && item !== null) {
            // 尝试更智能地显示对象
            if ("id" in item && "source" in item && "target" in item) {
              // 看起来像边
              strRep = `Edge(id: ${String(item.id).substring(0, 8)}..., S: ${item.source}(${item.sourceHandle
                }), T: ${item.target}(${item.targetHandle}))`;
            } else if ("id" in item) {
              strRep = `id: ${item.id}`;
            } else if ("name" in item) {
              strRep = `name: ${item.name}`;
            } else {
              strRep = JSON.stringify(item); // 回退到 JSON
            }
          } else {
            strRep = String(item);
          }
          // 截断过长的字符串表示
          return strRep.length > MAX_ITEM_LENGTH
            ? strRep.substring(0, MAX_ITEM_LENGTH) + "..."
            : strRep;
        } catch (e) {
          return "[...]"; // Stringify 失败或复杂对象
        }
      })
      .map((line) => `    - ${line}`) // 使用 4 个空格缩进，创建嵌套列表项
      .join("\n"); // 用换行符连接

    // 添加省略号（如果需要）和总长度
    const ellipsis = value.length > MAX_ARRAY_LINES ? "\n    - ..." : "";
    // 返回包含嵌套列表的 Markdown 字符串，以换行符开头，以便正确嵌套
    return ` ( ${value.length} )\n${formattedItems}${ellipsis}`;
    // --- 结束通用数组格式化 ---
  }
  if (typeof value === "object" && value !== null) {
    // 添加 null 检查
    // Basic object formatting (could be expanded)
    try {
      const str = JSON.stringify(value);
      const MAX_OBJ_LEN = 50;
      return str.length > MAX_OBJ_LEN ? `${str.substring(0, MAX_OBJ_LEN)}...}` : str;
    } catch (e) {
      return "[Object]"; // Fallback if stringify fails
    }
  }
  return String(value); // Fallback
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
        const formattedValue = formatDetailValue(value); // 获取可能包含嵌套列表的值
        // 如果值以换行符开头（表示是嵌套列表），则直接附加
        if (formattedValue.startsWith("\n")) {
          return `\n  - \`${key}\`:${formattedValue}`;
        } else {
          // 否则，作为普通行项目
          return `\n  - \`${key}\`: ${formattedValue}`;
        }
      })
      .join("");
  } else {
    detailsString += "\n  无";
  }

  return `**操作:** ${entry.summary || "未命名操作"}
**索引:** ${originalIndex}
**状态:** ${status}${savedStatus}${detailsString}
\n\n*点击跳转到此状态*`;
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
