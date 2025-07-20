<template>
  <div ref="editorContainerRef" class="editor-container flex flex-col bg-background-base" tabindex="-1">
    <!-- 主要内容区域 -->
    <div class="editor-main flex-1 relative overflow-hidden">
      <div v-if="loading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-text">{{ t("workflowEditor.loadingNodes") }}</div>
      </div>

      <!-- 主要内容布局 - 仅在节点定义加载后渲染 -->
      <div v-if="nodeDefinitionsLoaded" class="editor-content flex h-full">
        <!-- 侧边栏管理器 -->
        <WorkflowSidebar ref="sidebarManagerRef" @add-node="handleAddNodeFromPanel"
          @node-selected="handleNodeSelected" />

        <!-- 右侧主内容区域 (画布和可停靠编辑器) -->
        <div class="right-pane flex flex-col flex-1 overflow-hidden">
          <!-- 画布容器 -->
          <div class="canvas-container flex-1 relative">
            <Canvas ref="canvasRef" :model-value="currentElements" @update:model-value="updateElements"
              @node-click="handleNodeClick" @pane-ready="handlePaneReady" @connect="handleConnect"
              @node-drag-stop="handleNodesDragStop" @elements-remove="handleElementsRemove"
              @request-add-node-to-workflow="handleRequestAddNodeFromCanvas" :node-types="nodeTypes"
              @open-node-search-panel="handleOpenNodeSearchPanel" />

            <!-- 节点搜索面板 -->
            <div v-if="showNodeSearchPanel" class="modal-overlay-canvas" @click="showNodeSearchPanel = false"></div>
            <HierarchicalMenu v-if="showNodeSearchPanel" :sections="hierarchicalNodeMenuSections" :loading="loading"
              @select="handleHierarchicalNodeSelect" class="node-search-panel-canvas"
              :search-placeholder="t('workflowEditor.searchNodes')"
              :no-results-text="t('workflowEditor.noNodesFound')" />
          </div>
          <!-- 可停靠编辑器 -->
          <DockedEditorWrapper v-if="isDockedEditorVisible" ref="dockedEditorWrapperRef"
            class="docked-editor-wrapper" />
        </div>
      </div>
      <div v-else class="flex items-center justify-center h-full text-text-muted">
        {{ t("workflowEditor.loadingDefinitions") }}
      </div>

      <!-- 节点预览面板 -->
      <template v-if="sidebarManagerRef">
        <NodePreviewPanel :selected-node="selectedNodeForPreview"
          :is-sidebar-visible="sidebarManagerRef.isSidebarVisible" @close="selectedNodeForPreview = null"
          @add-node="handleAddNodeFromPanel" />
      </template>
    </div>

    <!-- 底部状态栏 -->
    <StatusBar class="editor-statusbar" />
    <!-- 右侧专用预览面板 -->
    <RightPreviewPanel />

    <!-- 正则表达式规则编辑器模态框 -->
    <RegexEditorModal v-if="isRegexEditorModalVisible" :visible="isRegexEditorModalVisible"
      :model-value="regexEditorModalData?.rules || []" :node-id="regexEditorModalData?.nodeId"
      :input-key="regexEditorModalData?.inputKey" @update:visible="handleModalVisibleUpdate" @save="handleModalSave" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, markRaw, watch, nextTick, provide } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import Canvas from "../../components/graph/Canvas.vue";
import HierarchicalMenu from "../../components/common/HierarchicalMenu.vue";
import type { MenuItem as HierarchicalMenuItem } from "../../components/common/HierarchicalMenu.vue";
import type { FrontendNodeDefinition } from "../../stores/nodeStore";
import BaseNode from "../../components/graph/nodes/BaseNode.vue";
import FrameNode from "../../components/graph/nodes/FrameNode.vue";
import WorkflowSidebar from "../../components/graph/sidebar/WorkflowSidebar.vue";
import NodePreviewPanel from "../../components/graph/sidebar/NodePreviewPanel.vue";
import RightPreviewPanel from "../../components/graph/sidebar/RightPreviewPanel.vue";
import DockedEditorWrapper from "../../components/graph/editor/DockedEditorWrapper.vue";
import StatusBar from "../../components/graph/StatusBar.vue";
import { type Node, type Edge, type XYPosition } from "@vue-flow/core";
import { useNodeStore } from "../../stores/nodeStore";
import { useWorkflowStore } from "../../stores/workflowStore";
import { useTabStore } from "../../stores/tabStore";
import { storeToRefs } from "pinia";
import { useCanvasInteraction } from "../../composables/canvas/useCanvasInteraction";
import { useTabManagement } from "../../composables/editor/useTabManagement";
import { useInterfaceWatcher } from "../../composables/editor/useInterfaceWatcher";
import { useKeyboardShortcuts } from "../../composables/editor/useKeyboardShortcuts";
import { useEditorState } from "../../composables/editor/useEditorState";
import { useWorkflowLifecycleCoordinator } from "../../composables/workflow/useWorkflowLifecycleCoordinator";
import RegexEditorModal from "../../components/modals/RegexEditorModal.vue";
import { useUiStore } from "../../stores/uiStore";

// 组件实例引用
type WorkflowSidebarInstance = InstanceType<typeof WorkflowSidebar> & {
  setActiveTab: (tabId: string) => void;
  isSidebarVisible: boolean;
  activeTab: string | null;
};

const { t } = useI18n();
const editorContainerRef = ref<HTMLElement | null>(null);
const canvasRef = ref<InstanceType<typeof Canvas> | null>(null);
const dockedEditorWrapperRef = ref<InstanceType<typeof DockedEditorWrapper> | null>(null);
const sidebarManagerRef = ref<WorkflowSidebarInstance | null>(null);
const lifecycleCoordinator = useWorkflowLifecycleCoordinator();

// 存储实例
const nodeStore = useNodeStore();
const workflowStore = useWorkflowStore();
const tabStore = useTabStore();
const uiStore = useUiStore();
const { nodeDefinitions } = storeToRefs(nodeStore);
const { isRegexEditorModalVisible, regexEditorModalData } = storeToRefs(uiStore);
const nodeDefinitionsLoaded = computed(
  () => !!nodeDefinitions.value && nodeDefinitions.value.length > 0
);
const route = useRoute();
const router = useRouter();
const {
  loading,
  selectedNodeForPreview,
  isDockedEditorVisible,
  requestedContextToOpen,
  clearRequestedContext,
  handleNodeSelected,
  handleError,
} = useEditorState();

const showNodeSearchPanel = ref(false);

// 为 HierarchicalMenu 准备节点数据
const hierarchicalNodeMenuSections = computed(() => {
  const sections: Record<string, any> = {};
  if (!nodeDefinitions.value) return sections;

  nodeDefinitions.value
    .filter((node: FrontendNodeDefinition) => {
      const fullType = `${node.namespace || "core"}:${node.type}`;
      return !fullType.includes("io:GroupInput") && !fullType.includes("io:GroupOutput");
    })
    .forEach((node: FrontendNodeDefinition) => {
      const namespace = node.namespace || "core";
      const category = node.category || t("workflowEditor.unclassified");

      if (!sections[namespace]) {
        sections[namespace] = {
          label: namespace,
          categories: {},
        };
      }
      if (!sections[namespace].categories[category]) {
        sections[namespace].categories[category] = {
          label: category,
          items: [],
        };
      }
      sections[namespace].categories[category].items.push({
        id: `${namespace}:${node.type}`,
        label: node.displayName || node.type,
        // TODO: 可根据节点类型设置不同图标
        description: node.description,
        category: category, // 用于搜索结果中的分类显示
        data: node,
      });
    });
  return sections;
});

const handleOpenNodeSearchPanel = () => {
  showNodeSearchPanel.value = true;
};

const handleHierarchicalNodeSelect = async (item: HierarchicalMenuItem) => {
  if (item.id) {
    await handleAddNodeFromPanel(item.id);
  }
  showNodeSearchPanel.value = false;
};

watch(
  requestedContextToOpen,
  (newContext) => {
    if (newContext && isDockedEditorVisible.value) {
      // 使用 nextTick 确保 DOM 更新完毕，dockedEditorWrapperRef 可用
      nextTick(() => {
        if (dockedEditorWrapperRef.value) {
          dockedEditorWrapperRef.value.openEditor(newContext);
          clearRequestedContext(); // 处理完后清除，避免重复触发
        } else {
          console.warn(
            "[EditorView] Watch requestedContextToOpen: dockedEditorWrapperRef is null even after nextTick."
          );
        }
      });
    }
  },
  { deep: true }
);

// 活动标签页
const activeTabId = computed(() => tabStore.activeTabId);

// 节点类型映射
const nodeTypes = computed(() => {
  const types: Record<string, any> = {
    default: markRaw(BaseNode),
    "core:frame": markRaw(FrameNode),
  };
  if (nodeDefinitions.value) {
    nodeDefinitions.value.forEach((def) => {
      if (def.namespace === "core" && def.type === "frame") return;
      const fullType = `${def.namespace || "core"}:${def.type}`;
      types[fullType] = markRaw(BaseNode);
    });
  }
  return types;
});

// 当前标签页的元素
const currentElements = computed(() => {
  if (!activeTabId.value) return [];
  return workflowStore.getElements(activeTabId.value);
});

// 当前VueFlow实例
const currentInstance = ref<any | null>(null);
const { handleAddNodeFromPanel, handleConnect, handleNodesDragStop, handleElementsRemove } =
  useCanvasInteraction(canvasRef);

useTabManagement(activeTabId, currentInstance, selectedNodeForPreview);
useInterfaceWatcher(activeTabId, currentElements);
useKeyboardShortcuts(activeTabId, editorContainerRef);

// 更新元素函数
function updateElements(_newElements: Array<Node | Edge>) {
  const currentTab = activeTabId.value;
  if (currentTab) {
    // 由 handleNodesDragStop 管理拖拽后的更新
  } else {
    console.warn("[EditorView] updateElements called but no active tab ID.");
  }
}

// 节点点击事件处理
// @ts-expect-error
const handleNodeClick = (node: Node) => { };

// 画布准备完成事件处理
const handlePaneReady = async (instance: any) => {
  currentInstance.value = instance;

  if (activeTabId.value) {
    const currentTabId = activeTabId.value;
    await workflowStore.setVueFlowInstance(currentTabId, instance);
  } else {
    console.warn("EditorView (handlePaneReady): Pane ready but no active tab ID yet.");
  }
};

// 处理来自 Canvas (通过右键菜单触发) 的节点添加请求
const handleRequestAddNodeFromCanvas = async (payload: {
  fullNodeType: string;
  flowPosition: XYPosition;
}) => {
  console.debug(`[EditorView] handleRequestAddNodeFromCanvas received payload:`, payload);
  if (!payload || !payload.fullNodeType) {
    console.error("[EditorView] Invalid payload for request-add-node-to-workflow:", payload);
    return;
  }
  await handleAddNodeFromPanel(payload.fullNodeType, payload.flowPosition);
};

// 提供 sidebarRef 给子组件
provide("sidebarRef", {
  setActiveTab: (tabId: string) => {
    if (sidebarManagerRef.value) {
      sidebarManagerRef.value.setActiveTab(tabId);
    }
  },
});

onMounted(async () => {
  // 监听拖放事件
  document.addEventListener("dragstart", () => { }, { passive: true });
  document.addEventListener("dragend", () => { }, { passive: true });

  // --- 统一初始化与清理逻辑 ---
  const initializeEditor = async () => {
    // 0. 增加路由守卫：仅当当前路由是编辑器时才执行初始化
    if (route.name !== "ProjectEditor") {
      console.debug("[EditorView] Not on ProjectEditor route, skipping initialization.");
      return;
    }

    const projectId = route.params.projectId as string;

    // 检查当前项目的标签页状态
    const projectTabs = tabStore.tabs.filter((t) => t.projectId === projectId);
    // 判断是否为 App.vue 刚刚创建的初始状态：只有一个标签页，且该标签页是全新的
    const isInitialDefaultTab =
      projectTabs.length === 1 &&
      projectTabs[0] &&
      workflowStore.isWorkflowNew(projectTabs[0].internalId);

    // 4. 加载节点定义 (可以提前并行开始)
    const fetchDefsPromise = nodeStore.fetchAllNodeDefinitions().catch((error) => {
      console.error("EditorView: Failed to fetch node definitions:", error);
      handleError(error, "获取节点定义");
    });

    if (isInitialDefaultTab && projectTabs[0]) {
      // **场景A：全新会话，由 App.vue 创建了默认标签页**
      console.info("[EditorView] Initial default tab found. Skipping recovery logic.");
      // 确保这个标签页的状态被正确初始化（应用默认模板）
      await workflowStore.ensureTabState(projectTabs[0].internalId);
    } else {
      // **场景B：恢复会话或无标签页**
      if (projectTabs.length > 0) {
        console.info("[EditorView] Restored tabs found. Proceeding with recovery and cleanup logic.");
        // 1. 获取有效工作流列表
        const availableWorkflows = await lifecycleCoordinator.fetchAvailableWorkflows();
        if (!availableWorkflows) {
          console.error("[EditorView] Failed to fetch available workflows. Initialization aborted.");
          return;
        }
        const availableWorkflowIds = new Set(availableWorkflows.map((wf) => wf.id));

        // 2. 清理无效的持久化标签页
        const tabsToRemove: string[] = [];
        for (const tab of projectTabs) {
          if (tab.associatedId && (tab.type === "workflow" || tab.type === "groupEditor")) {
            if (!availableWorkflowIds.has(tab.associatedId)) {
              tabsToRemove.push(tab.internalId);
            }
          }
        }
        if (tabsToRemove.length > 0) {
          console.info(
            `[EditorView] Cleaning up ${tabsToRemove.length} invalid tabs from localStorage.`,
            tabsToRemove
          );
          tabStore.removeTabs(tabsToRemove);
        }
      }

      // 3. 清理并确定初始加载的工作流 ID
      let workflowIdToLoad = route.params.workflowId as string | undefined;
      const availableWorkflows = await lifecycleCoordinator.fetchAvailableWorkflows(); // 重新获取或使用缓存
      if (workflowIdToLoad && !availableWorkflows?.some((wf) => wf.id === workflowIdToLoad)) {
        console.warn(
          `[EditorView] Workflow ID '${workflowIdToLoad}' from URL is invalid. Clearing from URL.`
        );
        workflowIdToLoad = undefined;
        const newParams = { ...route.params };
        delete newParams.workflowId;
        router.replace({ params: newParams });
      }

      // 5. 根据清理后的状态决定加载哪个工作流
      if (workflowIdToLoad) {
        await tabStore.loadAndOpenWorkflowById(projectId, workflowIdToLoad);
      } else if (
        tabStore.activeTabId &&
        tabStore.tabs.some((t) => t.internalId === tabStore.activeTabId)
      ) {
        // 确保活动标签页的状态被加载
        await workflowStore.ensureTabState(tabStore.activeTabId);
      } else {
        // 如果经过清理后仍然没有活动的标签页，或活动标签页无效，则初始化一个
        tabStore.initializeDefaultTab();
      }
    }

    // 统一等待节点定义加载并设置监听器
    loading.value = true;
    await fetchDefsPromise;
    loading.value = false;

    setupWatchers();

    // 初始 NodeGroup 同步检查
    if (tabStore.activeTabId) {
      performNodeGroupSyncCheck(tabStore.activeTabId);
    }
  };

  const setupWatchers = () => {
    // 监听 activeTabId 的变化，更新 URL
    watch(activeTabId, (newTabId, oldTabId) => {
      if (newTabId && newTabId !== oldTabId) {
        const tab = tabStore.tabs.find((t) => t.internalId === newTabId);
        const workflowId = tab?.associatedId;
        const currentWorkflowId = route.params.workflowId;
        if (workflowId && workflowId !== currentWorkflowId) {
          router.replace({ params: { ...route.params, workflowId } });
        } else if (!workflowId && currentWorkflowId) {
          const newParams = { ...route.params };
          delete newParams.workflowId;
          router.replace({ params: newParams });
        }
      }
    });

    // 监听 URL 中 workflowId 的变化，切换标签页
    watch(
      () => route.params.workflowId,
      (newWorkflowId, oldWorkflowId) => {
        if (newWorkflowId && newWorkflowId !== oldWorkflowId) {
          const projectId = route.params.projectId as string;
          if (projectId && tabStore.activeTab?.associatedId !== newWorkflowId) {
            tabStore.loadAndOpenWorkflowById(projectId, newWorkflowId as string);
          }
        }
      }
    );

    // 监听活动标签页变化以进行 NodeGroup 同步
    watch(activeTabId, (newTabId, oldTabId) => {
      if (newTabId && newTabId !== oldTabId) {
        performNodeGroupSyncCheck(newTabId);
      }
    });
  };

  const performNodeGroupSyncCheck = async (tabId: string) => {
    if (!workflowStore.isTabLoaded(tabId)) {
      const unwatch = watch(
        () => workflowStore.isTabLoaded(tabId),
        (isLoaded) => {
          if (isLoaded) {
            unwatch();
            executeSyncLogic(tabId);
          }
        }
      );
      return;
    }
    executeSyncLogic(tabId);
  };

  const executeSyncLogic = async (tabId: string) => {
    const elements = workflowStore.getElements(tabId);
    if (!elements || elements.length === 0) return;
    const changedTemplates = workflowStore.changedTemplateWorkflowIds;
    if (changedTemplates.size === 0) return;
    for (const el of elements) {
      if (el.type === "core:NodeGroup" && el.data?.configValues?.referencedWorkflowId) {
        const nodeGroup = el as Node;
        const referencedWorkflowId = nodeGroup.data.configValues.referencedWorkflowId as string;
        if (changedTemplates.has(referencedWorkflowId)) {
          await workflowStore.synchronizeGroupNodeInterfaceAndValues(
            tabId,
            nodeGroup.id,
            referencedWorkflowId
          );
        }
      }
    }
  };

  await initializeEditor();
});

// 组件卸载
onUnmounted(() => {
  if (activeTabId.value) {
    workflowStore.setVueFlowInstance(activeTabId.value, null);
  }
});

// 处理模态框事件
const handleModalVisibleUpdate = (isVisible: boolean) => {
  if (!isVisible) {
    uiStore.closeRegexEditorModal();
  }
};

const handleModalSave = (updatedRules: any /* RegexRule[] */) => {
  if (uiStore.regexEditorModalData?.onSave) {
    uiStore.regexEditorModalData.onSave(updatedRules);
  }
  uiStore.closeRegexEditorModal(); // 保存后也关闭模态框
};
</script>

<style scoped>
.editor-container {
  width: 100%;
  height: 100%;
  /* 从 100vh 改为 100% 以适应父容器 */
  position: relative;
  overflow: hidden;
}

/* 主要内容区域，包含画布和侧边栏 */
.editor-main {
  position: relative;
  overflow: hidden;
}

/* 内容区域布局 */
.editor-content {
  height: 100%;
  position: relative;
}

.right-pane {
  /* 包含画布和下方编辑器的容器 */
}

.canvas-container {
  /* 画布容器 */
  min-height: 0;
  /* 允许在flex容器中正确缩小 */
}

.docked-editor-wrapper {
  /* 停靠编辑器样式 */
  flex-shrink: 0;
  /* 防止压缩到0高度 */
  overflow-y: auto;
  /* 内容超出时滚动 */
  border-top: 1px solid theme("colors.gray.300");
  /* 与画布分隔 */
}

.dark .docked-editor-wrapper {
  border-top-color: theme("colors.gray.600");
}

/* 状态栏样式 */
.editor-statusbar {
  position: relative;
  z-index: 50;
  /* 确保状态栏在最上层 */
}

/* 加载遮罩 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.7);
  /* 亮色模式 */
}

.dark .loading-overlay {
  background-color: rgba(31, 41, 55, 0.7);
  /* 暗色模式 */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 40;
  /* 确保加载遮罩在画布之上，但在状态栏之下 */
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

.loading-text {
  font-size: 16px;
  color: #333;
  /* 亮色模式文本 */
}

.dark .loading-text {
  color: #f3f4f6;
  /* 暗色模式文本 */
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }}

.modal-overlay-canvas {
  position: absolute;
  /* 相对于 canvas-container 定位 */
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.3);
  /* 较浅的遮罩 */
  z-index: 1040;
  display: flex;
  align-items: center;
  justify-content: center;
}

.node-search-panel-canvas {
  position: absolute;
  /* 相对于 canvas-container 定位 */
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 500px;
  max-width: 80%;
  /* 相对于画布容器的宽度 */
  max-height: 70%;
  /* 相对于画布容器的高度 */
  z-index: 1050;
  /* HierarchicalMenu 组件内部已包含背景、阴影、圆角和滚动条样式 */
}
</style>
