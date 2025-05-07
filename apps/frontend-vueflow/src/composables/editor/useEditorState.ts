import { ref, shallowRef, watch } from 'vue'; // 移除了未使用的 ShallowRef 导入
import type { FrontendNodeDefinition } from '@/stores/nodeStore';

/**
 * 用于管理编辑器杂项状态的 Composable 函数，例如加载状态、
 * 节点预览、侧边栏就绪状态和错误处理。
 */
export function useEditorState() {
  const loading = ref(false); // 初始节点定义获取的加载状态
  const selectedNodeForPreview = ref<FrontendNodeDefinition | null>(null);
  const isSidebarReady = ref(false); // 控制 NodePreviewPanel 的渲染
  const sidebarManagerRef = shallowRef<{ isSidebarVisible: boolean } | null>(null); // SidebarManager 实例的引用

  // 处理来自 NodePanel 的节点选择（用于预览）
  const handleNodeSelected = (node: FrontendNodeDefinition) => {
    selectedNodeForPreview.value = node;
  };

  // 通用错误处理程序
  const handleError = (error: any, context: string) => {
    console.error(`EditorView错误(${context}):`, error);
    // TODO: 添加面向用户的错误通知 UI
  };

  // 监听 SidebarManager 组件是否挂载
  watch(
    sidebarManagerRef,
    (newValue) => {
      if (newValue && !isSidebarReady.value) {
        // console.debug(
        //   "[useEditorState] sidebarManagerRef 现在可用。将 isSidebarReady 设置为 true。"
        // );
        isSidebarReady.value = true;
      }
    },
    {
      flush: "post", // 确保在检查 ref 之前 DOM 已更新
    }
  );

  return {
    loading,
    selectedNodeForPreview,
    isSidebarReady,
    sidebarManagerRef,
    handleNodeSelected,
    handleError,
  };
}