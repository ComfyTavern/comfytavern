<template>
  <div class="node-panel">
    <div class="panel-header">
      <div class="header-top">
        <div class="panel-title">{{ t('nodePanel.title') }}</div>
        <button @click="reloadNodes" :disabled="nodeLoading || localLoading" class="reload-button"
          v-comfy-tooltip="t('nodePanel.reloadNodesTooltip')">
          🔄
        </button>
      </div>
      <div class="panel-search">
        <input type="text" v-model="searchQuery" :placeholder="t('nodePanel.searchPlaceholder')" class="search-input" />
      </div>
    </div>

    <!--
      调整加载状态的判断逻辑:
      - nodeStore.notifiedNodesReloaded: 显示 "节点已重载，正在刷新列表..."
      - nodeStore.loading (nodeLoading): 显示 "加载节点中..." (当非 notifiedNodesReloaded 时)
      - localLoading: 用于 reloadNodes API 调用期间的加载状态
      - nodeStore.reloadError: 显示重载错误信息
    -->
    <div v-if="notifiedNodesReloaded || nodeLoading || localLoading || reloadError" class="panel-loading">
      <svg class="svg-spinner" viewBox="0 0 50 50">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
      </svg>
      <span v-if="notifiedNodesReloaded">{{ t('nodePanel.reloadedRefreshing') }}</span>
      <span v-else-if="nodeLoading || localLoading">{{ t('nodePanel.loadingNodes') }}</span>
      <span v-if="reloadError" class="text-danger mt-2">
        {{ t('nodePanel.reloadFailed', { error: reloadError }) }}
        <button @click="reloadNodes"
          class="ml-2 px-2 py-1 bg-primary hover:bg-primary-hover text-text-on-primary rounded-md text-xs"
          :disabled="localLoading">
          {{ t('common.retry') }}
        </button>
      </span>
    </div>

    <OverlayScrollbarsComponent v-else-if="!reloadError" :options="{
      scrollbars: { autoHide: 'scroll', theme: isDark ? 'os-theme-light' : 'os-theme-dark' },
    }" class="panel-content-scrollable flex-1" defer>
      <!-- Content that needs scrolling -->
      <template v-if="nodeDefinitions?.length">
        <div v-if="searchQuery" class="search-results">
          <!-- 搜索结果标题已移除，直接显示列表 -->
          <div v-for="node in filteredNodes" :key="node.type" class="node-item" draggable="true"
            @dragstart="(event) => handleDragStart(event, node)" @dragend="handleDragEnd" @click="selectNode(node)">
            <div class="node-info">
              <div class="node-name">{{ node.displayName || node.type }}</div>
              <div class="node-type">{{ node.category }}</div>
              <div v-if="node.description" class="node-description">{{ node.description }}</div>
            </div>
            <div class="node-actions">
              <div class="node-drag-handle" @click.stop="addNodeToCanvas(node.type)"
                v-comfy-tooltip="t('nodePanel.addOrDragToCanvasTooltip')">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                  class="lucide lucide-plus">
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
              </div>
            </div>
          </div>

          <div v-if="filteredNodes.length === 0" class="no-results">{{ t('nodePanel.noMatchingNodes') }}</div>
        </div>

        <template v-else>
          <!-- Iterate through namespaces -->
          <div v-for="(categories, namespace) in nodesByNamespaceAndCategory" :key="namespace"
            class="node-namespace-section">
            <!-- Namespace Title Bar -->
            <div
              class="namespace-title bg-primary/20 px-2 py-1 rounded cursor-pointer flex items-center justify-between mb-1"
              @click="toggleCollapse(namespace)">
              <span>{{ namespace }}</span>
              <span class="text-lg">{{ collapsedStates[namespace] ? "▸" : "▾" }}</span>
            </div>

            <!-- Categories within the namespace (collapsible content) -->
            <div v-show="!collapsedStates[namespace]">
              <!-- Iterate through categories within the namespace -->
              <div v-for="(nodes, category) in categories" :key="`${namespace}-${category}`"
                class="node-category-section">
                <!-- Category Title Bar -->
                <div
                  class="category-title  bg-primary/10 px-2 py-1 rounded cursor-pointer flex items-center justify-between mt-1"
                  @click="toggleCollapse(`${namespace}:${category}`)">
                  <span>{{ category }}</span>
                  <span class="text-lg">{{
                    collapsedStates[`${namespace}:${category}`] ? "▸" : "▾"
                  }}</span>
                </div>

                <!-- Nodes within the category (collapsible content) -->
                <div v-show="!collapsedStates[`${namespace}:${category}`]">
                  <!-- Iterate through nodes within the category -->
                  <div v-for="node in nodes" :key="`${namespace}:${node.type}`" class="node-item" draggable="true"
                    @dragstart="(event) => handleDragStart(event, node)" @dragend="handleDragEnd"
                    @click="selectNode(node)">
                    <div class="node-info">
                      <div class="node-name">{{ node.displayName || node.type }}</div>
                      <div class="node-type">{{ namespace }}:{{ node.type }}</div>
                      <div v-if="node.description" class="node-description">
                        {{ node.description }}
                      </div>
                    </div>
                    <div class="node-actions">
                      <div class="node-drag-handle" @click.stop="addNodeToCanvas(`${namespace}:${node.type}`)"
                        v-comfy-tooltip="t('nodePanel.addOrDragToCanvasTooltip')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                          class="lucide lucide-plus">
                          <path d="M5 12h14" />
                          <path d="M12 5v14" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>

      <div v-else class="no-nodes">{{ t('nodePanel.noNodesAvailable') }}</div>
      <!-- End of content that needs scrolling -->
    </OverlayScrollbarsComponent>

    <!-- 节点详情已被移至 NodePreviewPanel.vue -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"; // 移除了 nextTick
import { useI18n } from "vue-i18n";
import { useNodeStore, type FrontendNodeDefinition } from "../../../stores/nodeStore";
import { useApi } from "../../../utils/api";
import useDragAndDrop from "../../../composables/canvas/useDnd";
import { useThemeStore } from "../../../stores/theme";
import { storeToRefs } from "pinia";
// import Tooltip from "@/components/common/Tooltip.vue"; // Tooltip 组件不再直接使用
import { OverlayScrollbarsComponent } from "overlayscrollbars-vue";
import "overlayscrollbars/overlayscrollbars.css";
// State for collapsed sections
const LOCAL_STORAGE_KEY = "nodePanelCollapsedStates";
const collapsedStates = ref<Record<string, boolean>>({});
const { t } = useI18n();
// Function to toggle collapse state
const toggleCollapse = (key: string) => {
  // Initialize if key doesn't exist (default to expanded)
  if (collapsedStates.value[key] === undefined) {
    collapsedStates.value[key] = false; // Initialize as expanded
  }
  collapsedStates.value[key] = !collapsedStates.value[key]; // Toggle the state

  // Save to localStorage
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(collapsedStates.value));
  } catch (error) {
    console.error(t('nodePanel.errorSavingCollapseState'), error);
  }
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
  loading: nodeLoading, // 来自 store 的主加载状态
  // error: nodeError, // 主错误状态，现在通过 nodeStore.error 和 nodeStore.reloadError 处理
  definitionsLoaded,
  notifiedNodesReloaded, // 新增：监听来自 store 的重载通知状态
  reloadError, // 新增：监听来自 store 的重载错误状态
} = storeToRefs(nodeStore);
const isDark = computed(() => themeStore.currentAppliedMode === 'dark');

const localLoading = ref(false); // 用于 reloadNodes API 调用期间的加载状态
const searchQuery = ref("");
const selectedNodeType = ref<string | null>(null);
const isDragging = ref(false);
// 移除了 isWaitingForReload, showManualRefreshButton, reloadIntervalId, maxReloadAttempts, reloadAttempts

// fetchNodes action 现在主要调用 store action
// 本地加载状态 localLoading 可以用于指示 fetchNodes 这个特定操作
const fetchNodes = async () => {
  localLoading.value = true;
  try {
    // 调用 store action
    await nodeStore.fetchAllNodeDefinitions();
  } catch (error) {
    // 错误处理可以依赖 store 的 error 状态 (nodeError)
    console.error(t('nodePanel.errorFetchingNodes'), error);
  } finally {
    localLoading.value = false;
  }
};

// Updated grouping: Namespace -> Category -> Nodes
const nodesByNamespaceAndCategory = computed(() => {
  console.log('[NodePanel] Recalculating nodesByNamespaceAndCategory. Current nodeDefinitions count:', nodeDefinitions.value?.length);
  // console.log('[NodePanel] nodeDefinitions for nodesByNamespaceAndCategory:', JSON.parse(JSON.stringify(nodeDefinitions.value)));

  const result: Record<string, Record<string, FrontendNodeDefinition[]>> = {};

  if (!nodeDefinitions.value || nodeDefinitions.value.length === 0) { // 检查数组是否为空
    console.log('[NodePanel] nodesByNamespaceAndCategory: nodeDefinitions is null or empty, returning empty result.');
    return result;
  }

  nodeDefinitions.value.forEach((node: FrontendNodeDefinition) => {
    const namespace = node.namespace || "core"; // Default to 'core' if namespace is missing
    const category = node.category || t('nodePanel.unclassifiedCategory');

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

// 移除了旧的 clearReloadInterval 和 attemptFetchNodes 方法

const reloadNodes = async () => {
  // 检查 localLoading 或 nodeStore 是否已处于某种加载/通知状态
  if (localLoading.value || nodeLoading.value || notifiedNodesReloaded.value) return;

  localLoading.value = true;
  nodeStore.reloadError = null; // 清除之前的重载错误
  // nodeStore.error = null; // 可选：清除主错误状态，让 fetchAllNodeDefinitions 重新评估

  console.log("Requesting nodes reload from server via /api/nodes/reload...");

  try {
    const api = useApi();
    // 调用新的后端 API 端点，移除重复的 /api 前缀
    const response = await api.post<{ success: boolean; message?: string; count?: number }>("/nodes/reload", {});

    if (response.success) {
      console.log("Node reload request API call successful.", response.message);
      // API 调用本身成功。
      // 主动获取一次最新的节点定义，以应对 WebSocket 通知可能延迟或因连接问题失败的情况。
      // 这确保了用户点击按钮后，至少会尝试通过 HTTP GET 来刷新列表。
      // 如果 WebSocket 通知也成功到达并触发了 fetch, Pinia store 的 action 通常是幂等的或能处理重复调用。
      console.log('[NodePanel] Proactively fetching node definitions after successful /nodes/reload API call.');
      nodeStore.fetchAllNodeDefinitions().catch(err => {
        console.error('[NodePanel] Error during proactive fetch after reload API call:', err);
        // 如果 nodeStore.reloadError 尚未被设置（例如，API 调用成功但后续的 WS->fetch 失败），则可以在此设置
        if (!nodeStore.reloadError) {
          nodeStore.reloadError = t('nodePanel.errorProactiveFetchFailed');
        }
      });
    } else {
      console.error("API call to /api/nodes/reload failed:", response.message);
      nodeStore.reloadError = response.message || t('nodePanel.errorRequestReloadFailedAPI');
    }
  } catch (err: any) {
    console.error("Error during /api/nodes/reload API call:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    nodeStore.reloadError = t('nodePanel.errorRequestReloadErrorAPI', { errorMessage });
  } finally {
    localLoading.value = false; // 确保在 API 请求完成后（无论成功、失败或异常）都重置 localLoading
  }
};

const selectNode = (node: FrontendNodeDefinition) => {
  console.debug('[NodePanel] selectNode called with:', node ? `${node.namespace || 'core'}:${node.type}` : null, 'Current selectedNodeType:', selectedNodeType.value); // 添加诊断日志
  const fullType = `${node.namespace || "core"}:${node.type}`; // Construct full type
  if (selectedNodeType.value === fullType) {
    // Compare with full type
    selectedNodeType.value = null;
    emit("node-selected", null);
    console.debug('[NodePanel] emitted node-selected with null (deselected)'); // 添加诊断日志
  } else {
    selectedNodeType.value = fullType; // Store full type
    emit("node-selected", node);
    console.debug('[NodePanel] emitted node-selected with node:', node ? `${node.namespace || 'core'}:${node.type}` : null); // 添加诊断日志
  }
};

// Expects fullNodeType (e.g., "core:MergeNode")
const addNodeToCanvas = (fullNodeType: string) => {
  emit("add-node", fullNodeType); // Emit the full type
};

// 移除了 manualRefresh 方法

onMounted(() => {
  try {
    const savedStates = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedStates) {
      const parsedStates = JSON.parse(savedStates);
      // 确保 parsedStates 是一个对象，防止 localStorage 中存了非对象类型的值
      if (typeof parsedStates === 'object' && parsedStates !== null) {
        collapsedStates.value = parsedStates;
      } else {
        // 如果解析出来不是对象，或者为 null，则不使用，并可以考虑清除
        console.warn(t('nodePanel.errorInvalidCollapseStateFormat'));
        // localStorage.removeItem(LOCAL_STORAGE_KEY); // 可选：清除无效数据
      }
    }
  } catch (error) {
    console.error(t('nodePanel.errorLoadingCollapseState'), error);
    // localStorage.removeItem(LOCAL_STORAGE_KEY); // 可选：清除无效数据
  }

  if (!definitionsLoaded.value) {
    fetchNodes(); // 初始加载节点
  }
  // 组件卸载时不再需要清理旧的定时器
});
</script>

<style scoped>
.node-panel {
  @apply h-full flex flex-col;
  /* 移除边框和固定宽度，由父组件管理 */
  width: 100%;
}

.panel-header {
  @apply flex flex-col p-4 border-b border-border-base;
}

.header-top {
  @apply flex justify-between items-center mb-3;
}

.reload-button {
  @apply p-1 rounded hover:bg-primary hover:bg-opacity-[var(--ct-component-hover-bg-opacity)] text-text-muted disabled:opacity-50 disabled:cursor-not-allowed;
}

.panel-title {
  @apply text-lg text-text-base font-semibold;
  /* text-text-strong -> text-text-base */
}

.search-input {
  @apply w-full px-3 py-2 border border-border-base bg-background-base text-text-base rounded-md focus:outline-none focus:ring-2 focus:ring-primary;
  /* border-border-input -> border-border-base, bg-background-input -> bg-background-base, text-text-input -> text-text-base */
}

.panel-loading {
  @apply flex flex-col items-center justify-center p-8 text-text-muted;
}

/* Removed .loading-spinner styles */

.svg-spinner {
  animation: rotate 2s linear infinite;
  width: 32px;
  /* w-8 */
  height: 32px;
  /* h-8 */
  margin-bottom: 0.5rem;
  /* mb-2 */
}

.svg-spinner .path {
  /* 使用了之前 CSS 动画中的 blue-500 颜色 */
  stroke: hsl(var(--ct-primary-hsl));
  /* 使用 CSS 变量 */
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
  @apply p-2;
  /* Keep padding */
}

/* Removed .section-title styles as they are replaced by title bars */

.node-namespace-section {
  /* Removed mb-4, spacing handled by title bar margin */
}

.namespace-title {
  /* Styles added directly in template for background, padding, etc. */
  @apply text-text-base font-medium;
}

.node-category-section {
  /* Removed ml-2 */
  /* Removed mb-4, spacing handled by title bar margin */
}

.category-title {
  /* Styles added directly in template for background, padding, etc. */
  @apply text-sm font-medium text-text-secondary;
  /* text-text-subtle -> text-text-secondary (assuming subtle was meant to be secondary) */
}

.node-item {
  @apply flex items-center p-2 rounded-md hover:bg-primary hover:bg-opacity-[var(--ct-component-hover-bg-opacity)] cursor-pointer relative;
  transition: all 0.2s;
  /* Removed ml-2 */
}

/* .node-item:hover class is now redundant due to hover: prefix in .node-item */

.node-item.dragging {
  @apply bg-primary-softest border border-primary-soft opacity-70;
  transform: scale(0.98);
}

.node-icon {
  @apply w-8 h-8 flex items-center justify-center bg-neutral/20 rounded-md text-text-base mr-3;
  /* bg-background-neutral-soft -> bg-neutral/20, text-text-default -> text-text-base */
}

.node-actions {
  @apply flex items-center;
}

.node-drag-handle {
  @apply w-8 h-8 flex text-3xl items-center justify-center text-text-muted rounded hover:bg-primary hover:bg-opacity-[var(--ct-component-hover-bg-opacity)] cursor-pointer ml-1 border border-border-base border-opacity-40;
  /* text-text-icon -> text-text-muted */
  transition: background-color 0.2s;
}

.node-item.dragging .node-drag-handle {
  @apply cursor-grabbing;
}

.node-info {
  @apply flex-1 overflow-hidden mr-1;
  /* Added overflow hidden and margin */
}

.node-name {
  @apply text-sm font-medium text-text-base truncate;
  /* text-text-default -> text-text-base, Added truncate */
}

.node-type {
  @apply text-xs text-text-muted mb-0.5 truncate;
  /* Added truncate */
}

.node-description {
  @apply text-xs text-text-muted truncate;
  /* text-text-placeholder -> text-text-muted */
  /* max-width: 240px; Removed fixed max-width, rely on parent overflow */
}

.no-nodes,
.no-results {
  @apply p-4 text-center text-text-muted;
}

/* .node-details 及其子元素的样式已移至 NodePreviewPanel.vue */
</style>
