<template>
  <div class="rich-code-editor-wrapper" ref="wrapperRef" :class="{ dark: themeStore.isDark }">
    <div v-if="breadcrumbData" class="breadcrumb-bar">
      <span v-if="breadcrumbData.workflowName" class="breadcrumb-item">{{ breadcrumbData.workflowName }}</span>
      <span v-if="breadcrumbData.workflowName && (breadcrumbData.nodeName || breadcrumbData.inputName)" class="breadcrumb-separator">></span>
      <span v-if="breadcrumbData.nodeName" class="breadcrumb-item">{{ breadcrumbData.nodeName }}</span>
      <span v-if="breadcrumbData.nodeName && breadcrumbData.inputName" class="breadcrumb-separator">></span>
      <span v-if="breadcrumbData.inputName" class="breadcrumb-item">{{ breadcrumbData.inputName }}</span>
      <!-- 可以根据需要扩展更多面包屑项 -->
    </div>
    <div ref="editorContainerRef" class="editor-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef } from 'vue';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, lineNumbers, keymap, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import type { BreadcrumbData, EditorInstanceConfig } from '@/types/editorTypes'; // 咕咕：从 editorTypes.ts 导入类型
import { useThemeStore } from '@/stores/theme'; // 咕咕：导入全局主题存储


const props = defineProps<{
  editorId: string;
  initialContent: string;
  languageHint?: 'json' | 'markdown' | 'javascript' | 'python' | 'text' | string; // 扩展 string 以允许自定义
  breadcrumbData?: BreadcrumbData;
  config?: EditorInstanceConfig;
}>();

const emit = defineEmits<{
  (e: 'contentChanged', payload: { editorId: string; newContent: string; isDirty: boolean }): void;
  (e: 'saveRequested', payload: { editorId: string; content: string }): void;
}>();

const editorContainerRef = ref<HTMLDivElement | null>(null);
const editorView = shallowRef<EditorView | null>(null);
const internalDirtyState = ref(false);
const themeCompartment = new Compartment();
const editableCompartment = new Compartment();
const themeStore = useThemeStore(); // 咕咕：获取全局主题存储实例
const wrapperRef = ref<HTMLDivElement | null>(null); // 咕咕：恢复 wrapperRef 的声明

onMounted(() => {
  if (!editorContainerRef.value) return;

  const extensions = [
    // 咕咕：初始主题根据全局 themeStore 设置
    themeCompartment.of(themeStore.isDark ? vscodeDark : vscodeLight),
    editableCompartment.of(EditorView.editable.of(!(props.config?.readOnly ?? false))),
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...completionKeymap,
      ...lintKeymap,
      indentWithTab, // Tab 键缩进
    ]),
    closeBrackets(),
    autocompletion(),
    EditorView.lineWrapping, // 自动换行
    EditorView.updateListener.of(update => {
      if (update.docChanged) {
        internalDirtyState.value = true;
        emit('contentChanged', {
          editorId: props.editorId,
          newContent: update.state.doc.toString(),
          isDirty: true,
        });
      }
    }),
    // 咕咕：添加 DOM 事件处理器以处理焦点
    EditorView.domEventHandlers({
      focus(_event, _view) { // 咕咕：标记未使用参数
        wrapperRef.value?.classList.add('is-focused');
      },
      blur(_event, _view) { // 咕咕：标记未使用参数
        wrapperRef.value?.classList.remove('is-focused');
        // 咕咕：在这里可以添加失焦自动保存逻辑 (阶段二)
        if (internalDirtyState.value) { // 咕咕：启用失焦自动保存
          triggerSave();
        }
      },
    }),
  ];

  // 根据 languageHint 添加对应的语言支持
  if (props.languageHint) {
    switch (props.languageHint.toLowerCase()) {
      case 'javascript':
      case 'js':
        extensions.push(javascript({ jsx: true }));
        break;
      case 'json':
        extensions.push(json());
        break;
      case 'markdown':
      case 'md':
        extensions.push(markdown());
        break;
      // 可以添加更多语言
      default:
        // 对于未知或 'text'，不添加特定语言高亮，或添加一个通用的
        break;
    }
  }

  const startState = EditorState.create({
    doc: props.initialContent,
    extensions,
  });

  const view = new EditorView({
    state: startState,
    parent: editorContainerRef.value,
  });
  editorView.value = view;
});

onUnmounted(() => {
  editorView.value?.destroy();
});

watch(() => props.initialContent, (newVal) => {
  if (editorView.value && newVal !== editorView.value.state.doc.toString()) {
    editorView.value.dispatch({
      changes: { from: 0, to: editorView.value.state.doc.length, insert: newVal },
    });
    internalDirtyState.value = false;
    emit('contentChanged', {
      editorId: props.editorId,
      newContent: newVal,
      isDirty: false,
    });
  }
});

watch(() => props.config?.readOnly, (isReadOnly) => {
  if (editorView.value) {
    editorView.value.dispatch({
      effects: editableCompartment.reconfigure(EditorView.editable.of(!isReadOnly)),
    });
  }
});

// watch(() => props.config?.theme, (newTheme) => { // 咕咕：移除对 props.config.theme 的监听
//   if (editorView.value) {
//     editorView.value.dispatch({
//       effects: themeCompartment.reconfigure(newTheme === 'light' ? vscodeLight : vscodeDark),
//     });
//   }
// });

// 咕咕：监听全局 themeStore.isDark 的变化来切换 CodeMirror 主题
watch(() => themeStore.isDark, (isDark) => {
  if (editorView.value) {
    editorView.value.dispatch({
      effects: themeCompartment.reconfigure(isDark ? vscodeDark : vscodeLight),
    });
  }
});

// 暴露的方法
const getContent = (): string => {
  return editorView.value?.state.doc.toString() || '';
};

const setContent = (newContent: string): void => {
  if (editorView.value) {
    editorView.value.dispatch({
      changes: { from: 0, to: editorView.value.state.doc.length, insert: newContent },
    });
    internalDirtyState.value = false; // 外部设置内容后，标记为未修改
    emit('contentChanged', {
      editorId: props.editorId,
      newContent,
      isDirty: false,
    });
  }
};

const isDirty = (): boolean => {
  return internalDirtyState.value;
};

const focusEditor = (): void => {
  editorView.value?.focus();
};

const triggerSave = (): void => {
  const currentContent = getContent();
  emit('saveRequested', { editorId: props.editorId, content: currentContent });
  internalDirtyState.value = false; // 保存后标记为未修改
  // 可以在这里添加一个视觉反馈，比如短暂显示“已保存”
};

defineExpose({
  getContent,
  setContent,
  isDirty,
  focusEditor,
  triggerSave,
});
</script>

<style scoped>
.rich-code-editor-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  /* 基础边框颜色，暗色模式下由 .dark 类覆盖 */
  @apply border border-gray-300; /* 默认亮色边框 */
  transition: border-color 0.2s ease-in-out; /* 添加过渡效果 */
}
.rich-code-editor-wrapper.dark {
  @apply border-gray-600; /* 暗色模式下的边框 */
}
.rich-code-editor-wrapper.is-focused {
  /* 亮色模式焦点 */
  @apply border-2 border-blue-500; /* 增加边框宽度以示强调 */
  /* padding: -1px; */ /* 如果边框增加导致布局移动，可能需要调整内边距或使用 outline */
}
.rich-code-editor-wrapper.dark.is-focused {
  /* 暗色模式焦点 */
  @apply border-2 border-blue-400; /* 增加边框宽度以示强调 */
}


/* 背景色由 CodeMirror 主题控制，这里不再设置背景色 */
/* .rich-code-editor-wrapper {
  background-color: #1e1e1e;
} */

.breadcrumb-bar {
  padding: 8px 12px;
  background-color: #252526;
  /* VSCode 侧边栏风格 */
  border-bottom: 1px solid #3c3c3c;
  font-size: 0.9em;
  color: #d4d4d4;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.breadcrumb-item {
  margin-right: 4px;
}

.breadcrumb-separator {
  margin: 0 4px;
  color: #858585;
}

.editor-container {
  flex-grow: 1;
  overflow: auto;
  position: relative;
}

/* CodeMirror 样式 */
:deep(.cm-editor) {
  height: 100%;
  width: 100%;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 14px;
}

:deep(.cm-content) {
  padding: 8px;
}

:deep(.cm-scroller) {
  touch-action: auto;
  /* 优化移动端触摸 */
}

/* 移动端适配 */
@media (max-width: 600px) {
  :deep(.cm-editor) {
    font-size: 12px;
  }

  .breadcrumb-bar {
    font-size: 0.8em;
    padding: 6px 10px;
  }
}
</style>