<template>
  <div class="node-panel" :class="{ dark: isDark }">
    <div class="panel-header">
      <div class="header-top">
        <div class="panel-title">节点库</div>
        <Tooltip content="重新启动后端服务以重载节点">
          <button
            @click="reloadNodes"
            :disabled="nodeLoading || localLoading || isWaitingForReload"
            class="reload-button"
          >
            🔄
          </button>
        </Tooltip>
      </div>
      <div class="panel-search">
        <input type="text" v-model="searchQuery" placeholder="搜索节点..." class="search-input" />
      </div>
    </div>

    <div v-if="nodeLoading || localLoading || isWaitingForReload" class="panel-loading">
      <svg class="svg-spinner" viewBox="0 0 50 50">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
      </svg>
      <span>{{
        isWaitingForReload
          ? "等待服务器重启中..."
          : nodeLoading || localLoading
          ? "加载节点中..."
          : ""
      }}</span>
      <template v-if="showManualRefreshButton">
        <div class="mt-4 text-sm text-gray-500">服务器重启超时</div>
        <button
          @click="manualRefresh"
          class="mt-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
        >
          手动刷新
        </button>
      </template>
    </div>

    <OverlayScrollbarsComponent
      v-else
      :options="{
        scrollbars: { autoHide: 'scroll', theme: isDark ? 'os-theme-light' : 'os-theme-dark' },
      }"
      class="panel-content-scrollable flex-1"
      defer
    >
      <!-- Content that needs scrolling -->
      <template v-if="nodeDefinitions?.length">
        <div v-if="searchQuery" class="search-results">
          <!-- 搜索结果标题已移除，直接显示列表 -->
          <div
            v-for="node in filteredNodes"
            :key="node.type"
            class="node-item"
            draggable="true"
            @dragstart="(event) => handleDragStart(event, node)"
            @dragend="handleDragEnd"
            @click="selectNode(node)"
          >
            <div class="node-info">
              <div class="node-name">{{ node.displayName || node.type }}</div>
              <div class="node-type">{{ node.category }}</div>
              <div v-if="node.description" class="node-description">{{ node.description }}</div>
            </div>
            <div class="node-actions">
              <Tooltip content="点击或拖拽添加到画布">
                <div class="node-drag-handle" @click.stop="addNodeToCanvas(node.type)">
                  <span>⋮⋮</span>
                </div>
              </Tooltip>
            </div>
          </div>

          <div v-if="filteredNodes.length === 0" class="no-results">没有找到匹配的节点</div>
        </div>

        <template v-else>
          <!-- Iterate through namespaces -->
          <div
            v-for="(categories, namespace) in nodesByNamespaceAndCategory"
            :key="namespace"
            class="node-namespace-section"
          >
            <!-- Namespace Title Bar -->
            <div
              class="namespace-title bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded cursor-pointer flex items-center justify-between mb-1"
              @click="toggleCollapse(namespace)"
            >
              <span>{{ namespace }}</span>
              <span class="text-lg">{{ collapsedStates[namespace] ? "▸" : "▾" }}</span>
            </div>

            <!-- Categories within the namespace (collapsible content) -->
            <div v-show="!collapsedStates[namespace]">
              <!-- Iterate through categories within the namespace -->
              <div
                v-for="(nodes, category) in categories"
                :key="`${namespace}-${category}`"
                class="node-category-section"
              >
                <!-- Category Title Bar -->
                <div
                  class="category-title bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded cursor-pointer flex items-center justify-between mt-1"
                  @click="toggleCollapse(`${namespace}:${category}`)"
                >
                  <span>{{ category }}</span>
                  <span class="text-lg">{{
                    collapsedStates[`${namespace}:${category}`] ? "▸" : "▾"
                  }}</span>
                </div>

                <!-- Nodes within the category (collapsible content) -->
                <div v-show="!collapsedStates[`${namespace}:${category}`]">
                  <!-- Iterate through nodes within the category -->
                  <div
                    v-for="node in nodes"
                    :key="`${namespace}:${node.type}`"
                    class="node-item"
                    draggable="true"
                    @dragstart="(event) => handleDragStart(event, node)"
                    @dragend="handleDragEnd"
                    @click="selectNode(node)"
                  >
                    <div class="node-info">
                      <div class="node-name">{{ node.displayName || node.type }}</div>
                      <div class="node-type">{{ namespace }}:{{ node.type }}</div>
                      <div v-if="node.description" class="node-description">
                        {{ node.description }}
                      </div>
                    </div>
                    <div class="node-actions">
                      <Tooltip content="点击或拖拽添加到画布">
                        <div
                          class="node-drag-handle"
                          @click.stop="addNodeToCanvas(`${namespace}:${node.type}`)"
                        >
                          <span>⋮⋮</span>
                        </div>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>

      <div v-else class="no-nodes">没有可用的节点定义</div>
      <!-- End of content that needs scrolling -->
    </OverlayScrollbarsComponent>

    <!-- 节点详情已被移至 NodePreviewPanel.vue -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { useNodeStore, type FrontendNodeDefinition } from "../../../stores/nodeStore";
import { useApi } from "../../../utils/api";
import useDragAndDrop from "../../../composables/canvas/useDnd";
import { useThemeStore } from "../../../stores/theme";
import { storeToRefs } from "pinia";
import Tooltip from "@/components/common/Tooltip.vue";
import { OverlayScrollbarsComponent } from "overlayscrollbars-vue";
import "overlayscrollbars/overlayscrollbars.css";

// State for collapsed sections
const collapsedStates = ref<Record<string, boolean>>({});

// Function to toggle collapse state
const toggleCollapse = (key: string) => {
  // Initialize if key doesn't exist (default to expanded)
  if (collapsedStates.value[key] === undefined) {
    collapsedStates.value[key] = false; // Start expanded
  }
  collapsedStates.value[key] = !collapsedStates.value[key];
};

const emit = defineEmits<{
  (e: "add-node", fullNodeType: string, position?: { x: number; y: number }): void;
  (e: "node-selected", node: FrontendNodeDefinition | null): void; // 修改事件，允许传递 null
}>();

const nodeStore = useNodeStore();
const themeStore = useThemeStore();
const { onDragStart } = useDragAndDrop();

const {
  nodeDefinitions,
  loading: nodeLoading,
  error: nodeError,
  definitionsLoaded,
} = storeToRefs(nodeStore);
const { isDark } = storeToRefs(themeStore);

const localLoading = ref(false); // 用于 reloadNodes 等本地操作的加载状态
const searchQuery = ref("");
const selectedNodeType = ref<string | null>(null);
const isDragging = ref(false);
const isWaitingForReload = ref(false);
const showManualRefreshButton = ref(false);
let reloadIntervalId: ReturnType<typeof setInterval> | null = null;
const maxReloadAttempts = 10;
let reloadAttempts = 0;

// fetchNodes action 现在主要调用 store action
// 本地加载状态 localLoading 可以用于指示 fetchNodes 这个特定操作
const fetchNodes = async () => {
  localLoading.value = true;
  try {
    // 调用 store action
    await nodeStore.fetchAllNodeDefinitions();
  } catch (error) {
    // 错误处理可以依赖 store 的 error 状态 (nodeError)
    console.error("获取节点失败 (NodePanel):", error);
  } finally {
    localLoading.value = false;
  }
};

// Updated grouping: Namespace -> Category -> Nodes
const nodesByNamespaceAndCategory = computed(() => {
  const result: Record<string, Record<string, FrontendNodeDefinition[]>> = {};

  if (!nodeDefinitions.value) return result;

  nodeDefinitions.value.forEach((node: FrontendNodeDefinition) => {
    const namespace = node.namespace || "core"; // Default to 'core' if namespace is missing
    const category = node.category || "未分类";

    if (!result[namespace]) {
      result[namespace] = {};
    }
    if (!result[namespace][category]) {
      result[namespace][category] = [];
    }
    result[namespace][category].push(node);
  });

  // Sort namespaces (e.g., 'core' first) and categories within each namespace
  const sortedResult: Record<string, Record<string, FrontendNodeDefinition[]>> = {};
  const namespaces = Object.keys(result).sort((a, b) => {
    if (a === "core") return -1;
    if (b === "core") return 1;
    return a.localeCompare(b);
  });

  namespaces.forEach((ns) => {
    const namespaceData = result[ns];
    if (namespaceData) {
      // Check if namespace data exists
      // Create a temporary variable for the current namespace's categories
      const currentNamespaceCategories: Record<string, FrontendNodeDefinition[]> = {};
      // Assign the temporary variable to the main result object
      sortedResult[ns] = currentNamespaceCategories;

      const categories = Object.keys(namespaceData).sort(); // Sort categories alphabetically
      categories.forEach((cat) => {
        const categoryData = namespaceData[cat];
        if (categoryData) {
          // Check if category data exists
          // Assign to the temporary variable, which is guaranteed to be defined here
          currentNamespaceCategories[cat] = categoryData;
        }
      });
    }
  });

  return sortedResult;
});

const filteredNodes = computed(() => {
  if (!searchQuery.value || !nodeDefinitions.value) return [] as FrontendNodeDefinition[];

  const query = searchQuery.value.toLowerCase();
  // Use the search function from the store, which already handles namespace and full type
  // return nodeDefinitions.value.filter(...) // Remove local filtering
  return nodeStore.searchNodeDefinitions(query); // Delegate search to the store
});
const handleDragStart = (event: DragEvent, node: FrontendNodeDefinition) => {
  isDragging.value = true;
  if (event.target instanceof HTMLElement) {
    event.target.classList.add("dragging");
  }
  onDragStart(event, node);
};

const handleDragEnd = (event: DragEvent) => {
  isDragging.value = false;
  if (event.target instanceof HTMLElement) {
    event.target.classList.remove("dragging");
  }
  // 为防止浏览器兼容性问题，在拖拽结束后添加延迟
  setTimeout(() => {
    document.querySelectorAll(".dragging").forEach((el) => {
      el.classList.remove("dragging");
    });
  }, 100);
};

// 清理重载检查定时器
const clearReloadInterval = () => {
  if (reloadIntervalId) {
    clearInterval(reloadIntervalId);
    reloadIntervalId = null;
    isWaitingForReload.value = false;
    localLoading.value = false; // 控制本地操作的加载状态
    reloadAttempts = 0;
    console.log("Reload check interval cleared.");
  }
};

const attemptFetchNodes = async () => {
  reloadAttempts++;
  console.log(`Attempting to fetch nodes (Attempt ${reloadAttempts}/${maxReloadAttempts})...`);
  try {
    // 尝试获取节点，但不显示加载状态，因为主加载状态仍在
    await nodeStore.fetchAllNodeDefinitions();
    // 如果成功获取到节点，说明后端已重启完成
    console.log("Nodes fetched successfully after restart.");
    console.log("节点已重新加载。");
    clearReloadInterval();
    // 确保 loading 状态被正确设置为 false - 应控制 localLoading
    localLoading.value = false;
    await nextTick(); // 等待DOM更新
  } catch (error) {
    console.warn(`Failed to fetch nodes on attempt ${reloadAttempts}:`, error);
    if (reloadAttempts >= maxReloadAttempts) {
      console.error("Max reload attempts reached. Stopping check.");
      console.error("服务器重载超时，请手动刷新。"); // 显示手动刷新按钮
      showManualRefreshButton.value = true; // 显示手动刷新按钮
      clearReloadInterval();
      // 保持 loading 状态，因为我们需要显示手动刷新按钮 - 应是 localLoading
      isWaitingForReload.value = false;
    }
    // 失败则继续等待下一次尝试
  }
};

const reloadNodes = async () => {
  if (nodeLoading.value || localLoading.value || isWaitingForReload.value) return;

  clearReloadInterval();

  localLoading.value = true; // 使用本地加载状态指示重启请求过程
  console.log("Requesting server restart...");

  try {
    const api = useApi();
    const response = await api.post<{ success: boolean; message: string }>("/server/restart", {});

    if (response.success) {
      console.log("Server restart request sent successfully.");
      console.info("服务器正在重启，请稍候...");
      isWaitingForReload.value = true;
      reloadAttempts = 0;
      // 稍作延迟后启动第一次检查，然后设置定时器
      setTimeout(() => {
        if (isWaitingForReload.value) {
          attemptFetchNodes();
          // 如果第一次尝试后仍然需要轮询
          // 并且定时器还没有被清除
          if (isWaitingForReload.value && !reloadIntervalId) {
            reloadIntervalId = setInterval(attemptFetchNodes, 3000);
          }
        }
      }, 1500); // 初始延迟 1.5 秒
      // 注意：保持 loading.value = true 直到重载完成或超时
    } else {
      console.error("Failed to request server restart:", response.message);
      console.error(`请求服务器重启失败: ${response.message}`);
      localLoading.value = false;
    }
  } catch (error: any) {
    // 使用 any 类型来检查 error.code
    console.error("Error requesting server restart:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`请求服务器重启时出错: ${errorMessage}`);

    // 特殊处理：如果错误是 ERR_CONNECTION_RESET，我们假设重启已触发
    if (
      error.code === "ERR_NETWORK" ||
      error.message.includes("Network Error") ||
      error.message.includes("ERR_CONNECTION_RESET")
    ) {
      console.warn(
        "Connection reset detected, assuming restart was triggered. Starting polling..."
      );
      console.info("服务器正在重启，请稍候...");
      isWaitingForReload.value = true;
      reloadAttempts = 0;
      // 稍作延迟后启动第一次检查，然后设置定时器 (同上)
      setTimeout(() => {
        if (isWaitingForReload.value) {
          attemptFetchNodes();
          if (isWaitingForReload.value && !reloadIntervalId) {
            reloadIntervalId = setInterval(attemptFetchNodes, 3000);
          }
        }
      }, 1500); // 初始延迟 1.5 秒
      // 保持 loading 状态
    } else {
      // 其他错误，正常处理
      localLoading.value = false;
    }
  }
  // 注意：成功发送请求后，loading 状态由 attemptFetchNodes 或 clearReloadInterval 控制
};
const selectNode = (node: FrontendNodeDefinition) => {
  const fullType = `${node.namespace || "core"}:${node.type}`; // Construct full type
  if (selectedNodeType.value === fullType) {
    // Compare with full type
    selectedNodeType.value = null;
    emit("node-selected", null);
  } else {
    selectedNodeType.value = fullType; // Store full type
    emit("node-selected", node);
  }
};

// Expects fullNodeType (e.g., "core:MergeNode")
const addNodeToCanvas = (fullNodeType: string) => {
  emit("add-node", fullNodeType); // Emit the full type
};

// 手动刷新节点
const manualRefresh = async () => {
  console.log("手动刷新节点...");
  showManualRefreshButton.value = false;
  // loading.value = true; // 不再直接控制本地 loading，依赖 fetchNodes/store action
  isWaitingForReload.value = false;

  // 调用 fetchNodes
  await fetchNodes();
  // 可以在这里检查 nodeError.value 来判断是否成功
  if (!nodeError.value) {
    console.log("节点已手动刷新完成");
  } else {
    console.error("手动刷新失败:", nodeError.value);
    showManualRefreshButton.value = true; // 如果 store action 失败，重新显示按钮
  }
  // localLoading 由 fetchNodes 控制
};

onMounted(() => {
  if (!definitionsLoaded.value) {
    fetchNodes();
  }
  // 组件卸载时清理定时器
  // 返回清理函数是 onMounted 的一个特性，这里保持不变
  return () => {
    clearReloadInterval();
  };
});
</script>

<style scoped>
.node-panel {
  @apply h-full flex flex-col bg-white dark:bg-gray-800;
  /* 移除边框和固定宽度，由父组件管理 */
  width: 100%;
}

.panel-header {
  @apply flex flex-col p-4 border-b border-gray-200 dark:border-gray-700;
}

.header-top {
  @apply flex justify-between items-center mb-3;
}

.reload-button {
  @apply p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed;
}

.panel-title {
  @apply text-lg font-medium text-gray-800 dark:text-gray-200;
}

.search-input {
  @apply w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400;
}

.panel-loading {
  @apply flex flex-col items-center justify-center p-8 text-gray-500 dark:text-gray-400;
}

/* Removed .loading-spinner styles */

.svg-spinner {
  animation: rotate 2s linear infinite;
  width: 32px; /* w-8 */
  height: 32px; /* h-8 */
  margin-bottom: 0.5rem; /* mb-2 */
}

.svg-spinner .path {
  /* 使用了之前 CSS 动画中的 blue-500 颜色 */
  stroke: #3b82f6;
  stroke-linecap: round;
  animation: dash 1.5s ease-in-out infinite;
}

@keyframes rotate {
  100% {
    transform: rotate(360deg);
  }
}

@keyframes dash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}

/* .panel-content is now the wrapper inside OverlayScrollbarsComponent */
.panel-content-scrollable {
  /* flex-1 is applied directly to the component */
  @apply p-2; /* Keep padding */
}

/* Removed .section-title styles as they are replaced by title bars */

.node-namespace-section {
  /* Removed mb-4, spacing handled by title bar margin */
}
.namespace-title {
  /* Styles added directly in template for background, padding, etc. */
  @apply text-base font-medium text-gray-700 dark:text-gray-200; /* Added font styling and increased size */
}

.node-category-section {
  /* Removed ml-2 */
  /* Removed mb-4, spacing handled by title bar margin */
}
.category-title {
  /* Styles added directly in template for background, padding, etc. */
  @apply text-sm font-medium text-gray-600 dark:text-gray-300; /* Added font styling */
}

.node-item {
  @apply flex items-center p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer relative;
  transition: all 0.2s;
  /* Removed ml-2 */
}

.node-item:hover {
  @apply bg-gray-100 dark:bg-gray-700;
}

.node-item.dragging {
  @apply bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 opacity-70;
  transform: scale(0.98);
}

.node-icon {
  @apply w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-md text-gray-700 dark:text-gray-300 mr-3;
}

.node-actions {
  @apply flex items-center;
}

.node-drag-handle {
  @apply w-6 h-6 flex items-center justify-center text-gray-400 dark:text-gray-500 rounded hover:bg-gray-200 dark:hover:bg-gray-600 cursor-grab ml-1 opacity-0;
  transition: opacity 0.2s;
}

.node-item:hover .node-drag-handle {
  @apply opacity-100;
}

.node-item.dragging .node-drag-handle {
  @apply cursor-grabbing;
}

.node-info {
  @apply flex-1 overflow-hidden mr-1; /* Added overflow hidden and margin */
}

.node-name {
  @apply text-sm font-medium text-gray-700 dark:text-gray-200 truncate; /* Added truncate */
}

.node-type {
  @apply text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate; /* Added truncate */
}

.node-description {
  @apply text-xs text-gray-400 dark:text-gray-500 truncate;
  /* max-width: 240px; Removed fixed max-width, rely on parent overflow */
}

.no-nodes,
.no-results {
  @apply p-4 text-center text-gray-500 dark:text-gray-400;
}

/* .node-details 及其子元素的样式已移至 NodePreviewPanel.vue */
</style>
