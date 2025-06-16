import { EditorView } from "@codemirror/view";

// 定义基础 UI 主题，使用项目 CSS 变量，使其自适应亮暗模式
// 这个主题旨在覆盖 CodeMirror 预设主题 (如 vscodeLight/Dark) 的基础 UI 颜色，
// 而不影响它们的语法高亮部分。
export const comfyTavernBaseTheme = EditorView.theme({
  "&": { // 应用于 .cm-editor 根元素
    backgroundColor: "hsl(var(--ct-background-surface-hsl) / var(--ct-panel-bg-opacity, 1)) !important",
    color: "hsl(var(--ct-text-base-hsl)) !important",
    height: "100%", // 确保编辑器填满容器
    outline: "none !important", // 移除 CodeMirror 默认的焦点 outline
  },
  ".cm-content": { // 编辑内容区域
    caretColor: "hsl(var(--ct-primary-hsl)) !important", // 光标颜色
    padding: "8px", // 保持或根据需要调整内边距
  },
  ".cm-cursor, .cm-dropCursor": { // 光标和拖放光标
    borderLeft: "2px solid hsl(var(--ct-primary-hsl)) !important", // 光标可以更明显些
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": { // 文本选中背景
    backgroundColor: "hsl(var(--ct-primary-hsl) / 0.3) !important", // 使用主色的半透明版本
  },
  ".cm-gutters": { // 行号及其他 Gutter 区域
    backgroundColor: "hsl(var(--ct-background-base-hsl) / var(--ct-panel-bg-opacity, 1)) !important", // Gutter 背景使用 base 背景色
    color: "hsl(var(--ct-text-muted-hsl)) !important", // Gutter 文本颜色
    borderRight: "1px solid hsl(var(--ct-border-base-hsl)) !important", // Gutter 右边框
  },
  ".cm-lineNumbers .cm-gutterElement": { // 行号元素
    padding: "0 3px 0 5px", // 调整行号内边距
    minWidth: "30px", // 确保行号有足够空间
  },
  ".cm-activeLine": { // 当前激活行背景
    backgroundColor: "hsl(var(--ct-primary-hsl) / 0.08) !important", // 使用非常柔和的主色背景
  },
  ".cm-activeLineGutter": { // 当前激活行的 Gutter 背景
    backgroundColor: "hsl(var(--ct-primary-hsl) / 0.12) !important", // 比激活行背景稍明显一点
  },
  ".cm-foldGutter .cm-gutterElement": { // 折叠标记
    cursor: "pointer",
    color: "hsl(var(--ct-text-muted-hsl))",
  },
  ".cm-foldPlaceholder": { // 折叠后占位符
    backgroundColor: "hsl(var(--ct-background-surface-hsl) / 0.8)", // 半透明的 surface 背景
    border: "1px dashed hsl(var(--ct-border-base-hsl))",
    color: "hsl(var(--ct-text-muted-hsl))",
    padding: "0.2em 0.5em",
    borderRadius: "3px",
  },
  // CodeMirror 内置搜索或兼容插件的搜索匹配高亮
  ".cm-searchMatch": {
    backgroundColor: "hsl(var(--ct-warning-hsl) / 0.3)",
    borderRadius: "3px",
  },
  ".cm-searchMatch-selected": {
    backgroundColor: "hsl(var(--ct-warning-hsl) / 0.5)", // 选中的匹配项更明显
    borderRadius: "3px",
  },
  // 如果 @rigstech/codemirror-vscodesearch 插件的 UI (输入框、按钮等)
  // 颜色不符合主题，可能需要在这里添加更具体的覆盖样式。
  // 例如:
  // ".cm-editor .find-replace-container": {
  //   backgroundColor: "hsl(var(--ct-background-surface-hsl))",
  //   borderColor: "hsl(var(--ct-border-base-hsl))"
  // },
  // ".cm-editor .find-replace-panel input[type='text']": { // 选择器需精确
  //   backgroundColor: "hsl(var(--ct-background-base-hsl))",
  //   color: "hsl(var(--ct-text-base-hsl))",
  //   borderColor: "hsl(var(--ct-border-base-hsl))"
  // },
  // ".cm-editor .find-replace-panel button": {
  //   backgroundColor: "hsl(var(--ct-secondary-hsl))", // 或 primary
  //   color: "hsl(var(--ct-primary-content-hsl))" // 假设按钮文本用反色
  // }
}, { dark: false }); // dark: false 表示此主题定义依赖外部CSS变量切换亮暗模式