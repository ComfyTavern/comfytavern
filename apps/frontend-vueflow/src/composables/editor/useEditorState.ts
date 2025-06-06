import { ref, shallowRef, computed } from 'vue';
import type { FrontendNodeDefinition } from '@/stores/nodeStore';
import type { TabData, EditorOpeningContext } from '@/types/editorTypes';
import { klona } from 'klona/full'; // 确保导入 klona

// 辅助函数：生成唯一ID
const generateUniqueId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

// 将状态移到函数外部，使其成为模块级单例状态
const loading = ref(false); // 初始节点定义获取的加载状态
const selectedNodeForPreview = ref<FrontendNodeDefinition | null>(null);
// const isSidebarReady = ref(false); // 此状态已由 EditorView.vue 中的 v-if="sidebarManagerRef" 替代
// SidebarManager 实例的类型定义
type SidebarManagerInstance = {
  isSidebarVisible: boolean;
  activeTab: string | null;
  setActiveTab: (tabId: string) => void;
};

const sidebarManagerRef = shallowRef<SidebarManagerInstance | null>(null); // SidebarManager 实例的引用

// --- 可停靠编辑器相关状态 ---
const isDockedEditorVisible = ref(false); // 控制 DockedEditorWrapper 的可见性
const editorTabs = ref<TabData[]>([]); // 存储当前打开的编辑器标签页数组
const activeEditorTabId = ref<string | null>(null); // 当前激活的编辑器标签页的 ID
const requestedContextToOpen = ref<EditorOpeningContext | null>(null); // 新增，用于存储请求打开的上下文

// 计算属性，获取当前激活的标签页数据
const activeEditorTab = computed(() => {
  if (!activeEditorTabId.value) return null;
  return editorTabs.value.find(tab => tab.tabId === activeEditorTabId.value) || null;
});


/**
 * 用于管理编辑器杂项状态的 Composable 函数，例如加载状态、
 * 节点预览、侧边栏就绪状态、错误处理以及可停靠编辑器的状态。
 * 现在返回的是模块级单例状态。
 */
export function useEditorState() {
  // 处理来自 NodePanel 的节点选择（用于预览）
  const handleNodeSelected = (node: FrontendNodeDefinition) => {
    selectedNodeForPreview.value = node;
  };

  // 通用错误处理程序
  const handleError = (error: any, context: string) => {
    console.error(`EditorView错误(${context}):`, error);
    // TODO: 添加面向用户的错误通知 UI
  };

  // 监听 SidebarManager 组件是否挂载的 watch (用于设置 isSidebarReady) 已不再需要，因为 isSidebarReady 已被移除。
  // watch(
  //   sidebarManagerRef,
  //   (newValue) => {
  //     if (newValue && !isSidebarReady.value) { // isSidebarReady 已移除
  //       // isSidebarReady.value = true; // isSidebarReady 已移除
  //     }
  //   },
  //   {
  //     flush: "post",
  //   }
  // );

  const toggleDockedEditor = () => {
    isDockedEditorVisible.value = !isDockedEditorVisible.value;
    // 如果关闭编辑器且没有标签页，则清空 activeEditorTabId
    if (!isDockedEditorVisible.value && editorTabs.value.length === 0) {
        activeEditorTabId.value = null;
    }
    // 如果打开编辑器且有标签页但没有活动的，则激活第一个
    else if (isDockedEditorVisible.value && editorTabs.value.length > 0 && !activeEditorTabId.value) {
        activeEditorTabId.value = editorTabs.value[0]?.tabId || null; // 使用可选链
    }
  };

  const openOrFocusEditorTab = (context: EditorOpeningContext) => {
    const existingTab = editorTabs.value.find(
      (tab) => tab.nodeId === context.nodeId && tab.inputPath === context.inputPath
    );

    if (existingTab) {
      activeEditorTabId.value = existingTab.tabId;
    } else {
      const newTabId = `editor_tab_${context.nodeId}_${context.inputPath.replace(/\./g, '_')}_${generateUniqueId()}`;
      const newEditorId = `rich_editor_${newTabId}`;
      const newTab: TabData = {
        tabId: newTabId,
        editorId: newEditorId,
        title: context.title || `${context.nodeId} - ${context.inputPath}`,
        initialContent: context.initialContent,
        languageHint: context.languageHint,
        breadcrumbData: context.breadcrumbData,
        config: context.config,
        isDirty: false,
        nodeId: context.nodeId,
        inputPath: context.inputPath,
        // 存储回调
        onSave: context.onSave
          ? (content: string) => {
              if (context.onSave) context.onSave(content); // 再次检查 context.onSave
              const tab = editorTabs.value.find(t => t.tabId === newTabId);
              if (tab) tab.isDirty = false;
            }
          : undefined,
        onClose: context.onClose,
      };
      editorTabs.value.push(newTab);
      activeEditorTabId.value = newTabId;
    }

    if (!isDockedEditorVisible.value) {
      isDockedEditorVisible.value = true;
    }
    // 存储请求的上下文
    requestedContextToOpen.value = klona(context);
  };

  const clearRequestedContext = () => { // 新增方法
    requestedContextToOpen.value = null;
  };

  const closeEditorTab = (tabIdToClose: string) => {
    const tabIndex = editorTabs.value.findIndex((tab) => tab.tabId === tabIdToClose);
    if (tabIndex === -1) return;

    const closingTab = editorTabs.value[tabIndex]; // closingTab 在这里肯定存在

    // 调用标签页自己的 onClose 回调（如果存在）
    if (closingTab && closingTab.onClose) { // 再次检查 closingTab 确保类型守卫
        try {
            closingTab.onClose();
        } catch (e) {
            console.error(`Error in onClose callback for tab ${tabIdToClose}:`, e);
        }
    }

    editorTabs.value.splice(tabIndex, 1);

    if (activeEditorTabId.value === tabIdToClose) {
      if (editorTabs.value.length > 0) {
        const newActiveIndex = Math.max(0, tabIndex - 1);
        activeEditorTabId.value = editorTabs.value[newActiveIndex]?.tabId || editorTabs.value[0]?.tabId || null;
      } else {
        activeEditorTabId.value = null;
      }
    }
    
    if (editorTabs.value.length === 0) {
        isDockedEditorVisible.value = false;
        activeEditorTabId.value = null; // 确保 activeId 也清空
    }
  };

  const setActiveEditorTab = (tabId: string) => {
    if (editorTabs.value.some(tab => tab.tabId === tabId)) {
      activeEditorTabId.value = tabId;
    }
  };

  // 当编辑器内容改变时，标记标签页为 dirty
  const markTabAsDirty = (tabId: string, dirtyState: boolean = true) => {
    const tab = editorTabs.value.find(t => t.tabId === tabId);
    if (tab) {
      tab.isDirty = dirtyState;
    }
  };


  return {
    loading,
    selectedNodeForPreview,
    // isSidebarReady, // 已移除
    sidebarManagerRef,
    // 可停靠编辑器相关
    isDockedEditorVisible,
    editorTabs,
    activeEditorTabId,
    activeEditorTab, // 导出计算属性
    requestedContextToOpen, // 导出新状态
    // 方法
    handleNodeSelected,
    handleError,
    toggleDockedEditor,
    openOrFocusEditorTab,
    closeEditorTab,
    setActiveEditorTab,
    markTabAsDirty,
    clearRequestedContext, // 导出新方法
  };
}