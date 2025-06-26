<template>
  <div
    ref="editorContainerRef"
    class="editor-container flex flex-col bg-background-base"
    tabindex="-1"
  >
    <!-- 主要内容区域 -->
    <div class="editor-main flex-1 relative overflow-hidden">
      <div v-if="loading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-text">{{ t("editorView.loadingNodes") }}</div>
      </div>

      <!-- 主要内容布局 - 仅在节点定义加载后渲染 -->
      <div v-if="nodeDefinitionsLoaded" class="editor-content flex h-full">
        <!-- 侧边栏管理器 -->
        <SidebarManager
          ref="sidebarManagerRef"
          @add-node="handleAddNodeFromPanel"
          @node-selected="handleNodeSelected"
        />

        <!-- 右侧主内容区域 (画布和可停靠编辑器) -->
        <div class="right-pane flex flex-col flex-1 overflow-hidden">
          <!-- 画布容器 -->
          <div class="canvas-container flex-1 relative">
            <!-- 添加相对定位，用于可能的绝对定位子元素 -->
            <!-- 根据活动标签页类型条件渲染 Canvas 或 GroupEditor -->
            <Canvas
              ref="canvasRef"
              :model-value="currentElements"
              @update:model-value="updateElements"
              @node-click="handleNodeClick"
              @pane-ready="handlePaneReady"
              @connect="handleConnect"
              @node-drag-stop="handleNodesDragStop"
              @elements-remove="handleElementsRemove"
              @request-add-node-to-workflow="handleRequestAddNodeFromCanvas"
              :node-types="nodeTypes"
              @open-node-search-panel="handleOpenNodeSearchPanel"
            />
            <!-- 传递 nodeTypes, 添加 key 绑定, 添加 nodes-drag-stop 和 elements-remove 监听 -->

            <!-- 节点搜索面板 - 放置在 canvas-container 内部以实现相对定位 -->
            <div
              v-if="showNodeSearchPanel"
              class="modal-overlay-canvas"
              @click="showNodeSearchPanel = false"
            ></div>
            <HierarchicalMenu
              v-if="showNodeSearchPanel"
              :sections="hierarchicalNodeMenuSections"
              :loading="loading"
              @select="handleHierarchicalNodeSelect"
              class="node-search-panel-canvas"
              :search-placeholder="t('editorView.searchNodes')"
              :no-results-text="t('editorView.noNodesFound')"
            />
          </div>
          <!-- 可停靠编辑器 -->
          <DockedEditorWrapper
            v-if="isDockedEditorVisible"
            ref="dockedEditorWrapperRef"
            class="docked-editor-wrapper"
          />
        </div>
      </div>
      <div v-else class="flex items-center justify-center h-full text-text-muted">
        {{ t("editorView.loadingDefinitions") }}
      </div>

      <!-- 节点预览面板 - 仅在侧边栏准备好后渲染 -->
      <!-- 调试信息显示面板已帮助定位问题 (isSidebarReady)，现将其移除。 -->

      <!-- 修改 v-if 条件，直接判断 sidebarManagerRef 是否已挂载并可用 -->
      <template v-if="sidebarManagerRef">
        <NodePreviewPanel
          :selected-node="selectedNodeForPreview"
          :is-sidebar-visible="sidebarManagerRef.isSidebarVisible"
          @close="selectedNodeForPreview = null"
          @add-node="handleAddNodeFromPanel"
        />
      </template>
    </div>

    <!-- 底部状态栏 -->
    <StatusBar class="editor-statusbar" />
    <!-- 右侧专用预览面板 - 移动到 editor-container 的直接子节点，以确保正确的悬浮行为 -->
    <RightPreviewPanel />

    <!-- 正则表达式规则编辑器模态框 -->
    <RegexEditorModal
      v-if="isRegexEditorModalVisible"
      :visible="isRegexEditorModalVisible"
      :model-value="regexEditorModalData?.rules || []"
      :node-id="regexEditorModalData?.nodeId"
      :input-key="regexEditorModalData?.inputKey"
      @update:visible="handleModalVisibleUpdate"
      @save="handleModalSave"
    />
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, markRaw, watch, nextTick, provide } from "vue"; // watch 已经存在，无需重复导入, 移除 ComputedRef
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import Canvas from "../../components/graph/Canvas.vue";
import HierarchicalMenu from "../../components/common/HierarchicalMenu.vue";
import type { MenuItem as HierarchicalMenuItem } from "../../components/common/HierarchicalMenu.vue";
import type { FrontendNodeDefinition } from "../../stores/nodeStore"; // 确保导入
import BaseNode from "../../components/graph/nodes/BaseNode.vue";
import SidebarManager from "../../components/graph/sidebar/SidebarManager.vue";
import NodePreviewPanel from "../../components/graph/sidebar/NodePreviewPanel.vue";
import RightPreviewPanel from "../../components/graph/sidebar/RightPreviewPanel.vue";
import DockedEditorWrapper from "../../components/graph/editor/DockedEditorWrapper.vue";
import StatusBar from "../../components/graph/StatusBar.vue";
import { type Node, type Edge, type XYPosition } from "@vue-flow/core"; // +++ 导入 XYPosition
import { useNodeStore } from "../../stores/nodeStore";
import { useWorkflowStore } from "../../stores/workflowStore";
import { useTabStore } from "../../stores/tabStore";
import { storeToRefs } from "pinia";
import { useCanvasInteraction } from "../../composables/canvas/useCanvasInteraction";
import { useTabManagement } from "../../composables/editor/useTabManagement";
import { useInterfaceWatcher } from "../../composables/editor/useInterfaceWatcher";
import { useKeyboardShortcuts } from "../../composables/editor/useKeyboardShortcuts";
import { useEditorState } from "../../composables/editor/useEditorState";
import RegexEditorModal from "../../components/modals/RegexEditorModal.vue"; // ++ 导入模态框
import { useUiStore } from "../../stores/uiStore"; // ++ 导入 UI store

// 组件实例引用
// 定义 SidebarManager 的类型
type SidebarManagerInstance = InstanceType<typeof SidebarManager> & {
  setActiveTab: (tabId: string) => void;
  isSidebarVisible: boolean;
  activeTab: string | null;
};

const { t } = useI18n();
const editorContainerRef = ref<HTMLElement | null>(null);
const canvasRef = ref<InstanceType<typeof Canvas> | null>(null);
const dockedEditorWrapperRef = ref<InstanceType<typeof DockedEditorWrapper> | null>(null);
const sidebarManagerRef = ref<SidebarManagerInstance | null>(null);

// 存储实例
const nodeStore = useNodeStore();
const workflowStore = useWorkflowStore();
const tabStore = useTabStore();
const uiStore = useUiStore(); // ++ 获取 UI store 实例
const { nodeDefinitions } = storeToRefs(nodeStore);
const { isRegexEditorModalVisible, regexEditorModalData } = storeToRefs(uiStore); // ++ 解构 UI store state
const nodeDefinitionsLoaded = computed(
  () => !!nodeDefinitions.value && nodeDefinitions.value.length > 0
);
const route = useRoute();
const router = useRouter();
const {
  loading,
  selectedNodeForPreview,
  // isSidebarReady, // 此变量已不再直接使用，移除以解决 TS 警告
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
      const category = node.category || t("editorView.unclassified");

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
        // icon: '🔌', // 可以根据节点类型设置不同图标，但是当前还没设计节点的图标，暂时用不上
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
    // item.id 已经是 fullNodeType
    await handleAddNodeFromPanel(item.id); // handleAddNodeFromPanel 来自 useCanvasInteraction
  }
  showNodeSearchPanel.value = false;
};

// 之前的 selectedNodeForPreview watch 已帮助定位问题 (isSidebarReady)，现将其移除。

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
); // deep: true 以监视对象内部变化

// 活动标签页
const activeTabId = computed(() => tabStore.activeTabId);

// 节点类型映射
const nodeTypes = computed(() => {
  const types: Record<string, any> = {
    default: markRaw(BaseNode),
  };
  if (nodeDefinitions.value) {
    nodeDefinitions.value.forEach((def) => {
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
  useCanvasInteraction(canvasRef); // 移除 currentInstance 参数

useTabManagement(activeTabId, currentInstance, selectedNodeForPreview);

useInterfaceWatcher(activeTabId, currentElements);

useKeyboardShortcuts(activeTabId, editorContainerRef);

// 更新元素函数
function updateElements(_newElements: Array<Node | Edge>) {
  const currentTab = activeTabId.value;
  if (currentTab) {
    // 由handleNodesDragStop管理拖拽后的更新
  } else {
    console.warn("[EditorView] updateElements called but no active tab ID.");
  }
}

// 节点点击事件处理
// @ts-expect-error
const handleNodeClick = (node: Node) => {};

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
  // 现在将 flowPosition 传递给 handleAddNodeFromPanel
  await handleAddNodeFromPanel(payload.fullNodeType, payload.flowPosition);
};

// 在 Canvas 组件上监听 open-node-search-panel 事件
// (注意：这应该在 <Canvas ... @open-node-search-panel="handleOpenNodeSearchPanel" /> 模板中完成)
// 此处仅为逻辑占位，实际绑定在 template 中。

// 提供 sidebarRef 给子组件
provide("sidebarRef", {
  setActiveTab: (tabId: string) => {
    if (sidebarManagerRef.value) {
      sidebarManagerRef.value.setActiveTab(tabId);
    }
  },
});

// 组件挂载
onMounted(async () => {
  // 监听拖放事件
  document.addEventListener("dragstart", () => {}, { passive: true });
  document.addEventListener("dragend", () => {}, { passive: true });

  // 获取节点定义
  if (!nodeDefinitions.value || nodeDefinitions.value.length === 0) {
    loading.value = true;
    try {
      await nodeStore.fetchAllNodeDefinitions();
    } catch (error) {
      console.error("EditorView: Failed to fetch node definitions:", error);
      handleError(error, "获取节点定义");
    } finally {
      loading.value = false;
    }
  }

  // 确保活动标签页状态
  if (activeTabId.value) {
    workflowStore.ensureTabState(activeTabId.value);
  }

  // --- 状态恢复与 URL 同步 ---

  // 1. 监听 activeTabId 的变化，更新 URL
  watch(
    activeTabId,
    (newTabId, oldTabId) => {
      if (newTabId && newTabId !== oldTabId) {
        const tab = tabStore.tabs.find((t) => t.internalId === newTabId);
        const workflowId = tab?.associatedId;
        const currentWorkflowId = route.params.workflowId;

        // 仅当 URL 需要更新时才操作
        if (workflowId && workflowId !== currentWorkflowId) {
          router.replace({ params: { ...route.params, workflowId } });
        } else if (!workflowId && currentWorkflowId) {
          // 如果新标签页没有关联工作流，但 URL 中有，则移除它
          const newParams = { ...route.params };
          delete newParams.workflowId;
          router.replace({ params: newParams });
        }
      }
    },
    { immediate: false }
  ); // 初始加载时不触发

  // 2. 监听 URL 中 workflowId 的变化，切换标签页
  watch(
    () => route.params.workflowId,
    (newWorkflowId, oldWorkflowId) => {
      if (newWorkflowId && newWorkflowId !== oldWorkflowId) {
        const projectId = route.params.projectId as string;
        if (projectId) {
          // 检查是否已经因为切换 tab 导致 URL 变化，避免循环
          const activeTab = tabStore.activeTab;
          if (activeTab?.associatedId !== newWorkflowId) {
            tabStore.loadAndOpenWorkflowById(projectId, newWorkflowId as string);
          }
        }
      }
    },
    { immediate: false }
  ); // 初始加载时由 onMounted 处理

  // 3. onMounted 中的初始加载逻辑
  const projectId = route.params.projectId as string;
  const initialWorkflowId = route.params.workflowId as string | undefined;

  if (initialWorkflowId) {
    // 如果 URL 指定了工作流，则优先加载
    await tabStore.loadAndOpenWorkflowById(projectId, initialWorkflowId);
  } else if (activeTabId.value) {
    // 如果 tabStore 从 localStorage 恢复了 activeTabId，确保其状态被加载
    await workflowStore.ensureTabState(activeTabId.value);
  } else {
    // 如果两者都没有，则初始化一个默认标签页
    tabStore.initializeDefaultTab();
  }

  // --- NodeGroup 同步逻辑 ---
  const performNodeGroupSyncCheck = async (tabId: string | null | undefined) => {
    if (!tabId) return;

    // 等待 tab 加载完成
    // isTabLoaded 是一个函数，其响应性依赖于其内部使用的 store 状态 (getAllTabStates)
    // 我们需要确保在 isTabLoaded 变为 true 后执行
    if (!workflowStore.isTabLoaded(tabId)) {
      // console.debug(`[EditorView] Tab ${tabId} not loaded for NodeGroup sync. Waiting...`);
      // 使用一个临时的 watcher 来等待加载完成
      const unwatch = watch(
        () => workflowStore.isTabLoaded(tabId),
        (isLoaded) => {
          if (isLoaded) {
            // console.debug(`[EditorView] Tab ${tabId} is NOW loaded. Proceeding with NodeGroup sync.`);
            unwatch(); // 加载后停止监听
            executeSyncLogic(tabId);
          }
        }
      );
      return; // 等待 watcher 触发
    }

    // 如果已加载，直接执行
    executeSyncLogic(tabId);
  };

  const executeSyncLogic = async (tabId: string) => {
    const elements = workflowStore.getElements(tabId);
    if (!elements || elements.length === 0) {
      // console.debug(`[EditorView] No elements in tab ${tabId} for NodeGroup sync.`);
      return;
    }

    const changedTemplates = workflowStore.changedTemplateWorkflowIds; // 移除显式类型注解，让 TS 推断
    if (changedTemplates.size === 0) {
      // 直接访问 .size
      // console.debug("[EditorView] No templates marked as changed. Skipping NodeGroup sync.");
      return;
    }

    console.debug(
      `[EditorView] Performing NodeGroup sync check for tab ${tabId}. Changed templates:`,
      Array.from(changedTemplates)
    ); // 直接使用 changedTemplates

    for (const el of elements) {
      if (el.type === "core:NodeGroup" && el.data?.configValues?.referencedWorkflowId) {
        const nodeGroup = el as Node; // VueFlowNode
        const referencedWorkflowId = nodeGroup.data.configValues.referencedWorkflowId as string;

        if (changedTemplates.has(referencedWorkflowId)) {
          // 直接调用 .has()
          console.info(
            `[EditorView] NodeGroup ${nodeGroup.id} in tab ${tabId} references changed template ${referencedWorkflowId}. Triggering sync.`
          );
          try {
            // 确保在调用异步操作前，tabId 和 nodeId 仍然有效且相关
            // （虽然在这个上下文中它们应该是稳定的）
            await workflowStore.synchronizeGroupNodeInterfaceAndValues(
              tabId,
              nodeGroup.id,
              referencedWorkflowId
            );
            console.info(`[EditorView] Sync completed for NodeGroup ${nodeGroup.id}.`);
          } catch (error) {
            console.error(`[EditorView] Error synchronizing NodeGroup ${nodeGroup.id}:`, error);
          }
        }
      }
    }
  };

  // 初始加载时检查
  if (activeTabId.value) {
    performNodeGroupSyncCheck(activeTabId.value);
  }

  // 监听活动标签页变化
  watch(activeTabId, (newTabId, oldTabId) => {
    if (newTabId && newTabId !== oldTabId) {
      performNodeGroupSyncCheck(newTabId);
    }
  });
  // --- NodeGroup 同步逻辑结束 ---
});
// 组件卸载
onUnmounted(() => {
  if (activeTabId.value) {
    workflowStore.setVueFlowInstance(activeTabId.value, null);
  }
});

// ++ 处理模态框事件
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
  /* background-color: theme('colors.gray.800'); */
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
  }
}

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
