<template>
  <div class="rich-code-editor-wrapper">
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
// 以后可以根据 languageHint 动态导入其他语言包

// 类型定义
export interface BreadcrumbData {
  workflowName?: string;
  nodeName?: string;
  inputName?: string;
  [key: string]: any;
}

export interface EditorInstanceConfig {
  readOnly?: boolean;
  theme?: 'light' | 'dark'; // 后续可以扩展更复杂的主题系统
  // 其他 CodeMirror 配置项
}

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

// CodeMirror 实例的创建和管理
const editableCompartment = new Compartment();

onMounted(() => {
  if (!editorContainerRef.value) return;

  const extensions = [
    editableCompartment.of(EditorView.editable.of(!(props.config?.readOnly ?? false))), // 初始化可编辑状态
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
  ];

  // 根据 languageHint 添加对应的语言支持
  if (props.languageHint) {
    switch (props.languageHint.toLowerCase()) {
      case 'javascript':
      case 'js':
        extensions.push(javascript());
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
  
  // TODO: 根据 props.config.theme 设置主题

  const startState = EditorState.create({
    doc: props.initialContent,
    extensions: extensions,
  });

  const view = new EditorView({
    state: startState,
    parent: editorContainerRef.value,
  });
  editorView.value = view;

  // 初始的 readOnly 状态已在 editableCompartment.of 中设置
  // if (props.config?.readOnly) {
  //   view.dispatch({
  //     effects: EditorView.editable.reconfigure(EditorView.editable.of(false)) //  <-- 这里可能需要调整为 Compartment 的 reconfigure
  //   });
  // }
});

onUnmounted(() => {
  editorView.value?.destroy();
});

// Props 监听
watch(() => props.initialContent, (newVal) => {
  if (editorView.value && newVal !== editorView.value.state.doc.toString()) {
    editorView.value.dispatch({
      changes: { from: 0, to: editorView.value.state.doc.length, insert: newVal },
    });
    internalDirtyState.value = false; // 重置内容后，标记为未修改
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
      effects: editableCompartment.reconfigure(EditorView.editable.of(!isReadOnly))
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
      newContent: newContent,
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
  border: 1px solid #ccc; /* 临时边框，便于查看 */
}

.breadcrumb-bar {
  padding: 8px 12px;
  background-color: #f0f0f0; /* 临时背景色 */
  border-bottom: 1px solid #ccc; /* 临时边框 */
  font-size: 0.9em;
  color: #333;
  display: flex;
  align-items: center;
  flex-wrap: wrap; /* 允许换行 */
}

.breadcrumb-item {
  margin-right: 4px;
}

.breadcrumb-separator {
  margin: 0 4px;
  color: #888;
}

.editor-container {
  flex-grow: 1;
  overflow: auto; /* 确保编辑器内容溢出时可滚动 */
  position: relative; /* CodeMirror 可能需要 */
}

/* 确保 CodeMirror 填满容器 */
:deep(.cm-editor) {
  height: 100%;
  width: 100%;
}
</style>
