// apps/frontend-vueflow/src/types/editorTypes.ts

import type { EditorInstanceConfig, BreadcrumbData } from '@/components/common/RichCodeEditor.vue'; // 假设 RichCodeEditor.vue 会导出这些类型

/**
 * 表示编辑器标签页的数据结构。
 */
export interface TabData {
  /**
   * 标签页的唯一标识符。
   */
  tabId: string;
  /**
   * 标签页显示的标题。
   */
  title: string;
  /**
   * 内部 RichCodeEditor 实例的唯一标识符。
   */
  editorId: string;
  /**
   * 编辑器的初始内容。
   */
  initialContent: string;
  /**
   * 语言提示，用于语法高亮等。
   */
  languageHint?: string;
  /**
   * 面包屑导航数据。
   */
  breadcrumbData?: BreadcrumbData;
  /**
   * 编辑器实例的特定配置。
   */
  config?: EditorInstanceConfig;
  /**
   * 标记标签页是否为脏（有未保存的更改）。
   * @default false
   */
  isDirty?: boolean;
  /**
   * 可选：关联的节点 ID，用于从标签页追溯到工作流节点。
   */
  nodeId?: string;
  /**
   * 可选：关联的节点输入路径，用于从标签页追溯到具体编辑的属性。
   */
  inputPath?: string;
  /**
   * 可选的回调函数，当编辑器内容保存时调用。
   * @param content - 保存的内容。
   * @returns void
   */
  onSave?: (content: string) => void;
  /**
   * 可选的回调函数，当编辑器关闭时调用。
   * @returns void
   */
  onClose?: () => void;
}

// 在文件末尾添加
/**
 * 打开编辑器时传递的上下文信息。
 */
export interface EditorOpeningContext {
  /**
   * 目标节点的 ID，用于关联编辑器内容。
   */
  nodeId: string;
  /**
   * 目标节点输入定义的路径，例如 'inputs.code' 或 'config.script'。
   * 这有助于定位要编辑的具体内容。
   */
  inputPath: string;
  /**
   * 编辑器的初始内容。
   */
  initialContent: string;
  /**
   * 可选的编辑器标题。如果未提供，编辑器可能会根据其他上下文生成一个。
   */
  title?: string;
  /**
   * 语言提示，用于语法高亮等。
   */
  languageHint?: string;
  /**
   * 面包屑导航数据。
   */
  breadcrumbData?: BreadcrumbData;
  /**
   * 编辑器实例的特定配置。
   */
  config?: EditorInstanceConfig;

  /**
   * 指定底部编辑器的模式。
   * 'single': 单文件编辑器 (RichCodeEditor)
   * 'fullMultiTab': 全功能多标签编辑器 (TabbedEditorHost)
   * @default 'fullMultiTab'
   */
  bottomEditorMode?: 'single' | 'fullMultiTab';
  /**
   * 可选的回调函数，当编辑器内容保存时调用。
   * @param content - 保存的内容。
   * @returns void
   */
  onSave?: (content: string) => void;
  /**
   * 可选的回调函数，当编辑器关闭时调用。
   * @returns void
   */
  onClose?: () => void;
}