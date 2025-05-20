<template>
  <div class="rich-code-editor-wrapper" ref="wrapperRef" :class="{ dark: themeStore.isDark }">
    <div v-if="breadcrumbData" class="breadcrumb-bar">
      <span v-if="breadcrumbData.workflowName" class="breadcrumb-item">{{ breadcrumbData.workflowName }}</span>
      <span v-if="breadcrumbData.workflowName && (breadcrumbData.nodeName || breadcrumbData.inputName)" class="breadcrumb-separator">></span>
      <span v-if="breadcrumbData.nodeName" class="breadcrumb-item">{{ breadcrumbData.nodeName }}</span>
      <span v-if="breadcrumbData.nodeName && breadcrumbData.inputName" class="breadcrumb-separator">></span>
      <span v-if="breadcrumbData.inputName" class="breadcrumb-item">{{ breadcrumbData.inputName }}</span>
    </div>
    <div ref="editorContainerRef" class="editor-container"></div>
  </div>
  <EditorContextMenu
    :editor-view="editorView"
    :visible="showContextMenu"
    :position="contextMenuPosition"
    @close="closeContextMenu"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef, reactive } from 'vue';
import { EditorState, Compartment } from '@codemirror/state';
import {
  EditorView, lineNumbers, keymap, highlightSpecialChars, drawSelection, dropCursor,
  rectangularSelection, crosshairCursor, highlightActiveLine, highlightActiveLineGutter
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { foldGutter, foldKeymap } from '@codemirror/language'; // 导入 foldGutter 和 foldKeymap
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import type { BreadcrumbData, EditorInstanceConfig } from '@/types/editorTypes';
import { useThemeStore } from '@/stores/theme';
import EditorContextMenu from './EditorContextMenu.vue'; // 导入右键菜单组件

const props = defineProps<{
  editorId: string;
  initialContent: string;
  languageHint?: 'json' | 'markdown' | 'javascript' | 'python' | 'text' | string;
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
const lineNumbersCompartment = new Compartment(); // Compartment for line numbers
const foldGutterCompartment = new Compartment(); // Compartment for fold gutter
const themeStore = useThemeStore();
const wrapperRef = ref<HTMLDivElement | null>(null);

// 右键菜单状态
const showContextMenu = ref(false);
const contextMenuPosition = reactive({ x: 0, y: 0 });

const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault();
  contextMenuPosition.x = event.clientX;
  contextMenuPosition.y = event.clientY;
  showContextMenu.value = true;
};

const closeContextMenu = () => {
  showContextMenu.value = false;
};


onMounted(() => {
  if (!editorContainerRef.value) return;

  const currentConfig = props.config || {};

  const extensions = [
    themeCompartment.of(themeStore.isDark ? vscodeDark : vscodeLight),
    editableCompartment.of(EditorView.editable.of(!(currentConfig.readOnly ?? false))),
    lineNumbersCompartment.of(currentConfig.lineNumbers ?? true ? lineNumbers() : []),
    foldGutterCompartment.of(currentConfig.foldGutter ?? true ? foldGutter() : []),
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
      ...foldKeymap, // 添加 foldKeymap
      ...completionKeymap,
      ...lintKeymap,
      indentWithTab,
    ]),
    closeBrackets(),
    autocompletion(),
    EditorView.lineWrapping,
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
    EditorView.domEventHandlers({
      focus(_event, _view) {
        wrapperRef.value?.classList.add('is-focused');
      },
      blur(_event, _view) {
        wrapperRef.value?.classList.remove('is-focused');
        if (internalDirtyState.value) {
          triggerSave();
        }
      },
      contextmenu: (event, _view) => { // 将未使用的 view 重命名为 _view
        handleContextMenu(event);
        return true; // 表示已处理该事件
      },
    }),
  ];

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
      default:
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
      effects: editableCompartment.reconfigure(EditorView.editable.of(!(isReadOnly ?? false))),
    });
  }
});

watch(() => props.config?.lineNumbers, (show) => {
  if (editorView.value) {
    editorView.value.dispatch({
      effects: lineNumbersCompartment.reconfigure(show ?? true ? lineNumbers() : []),
    });
  }
});

watch(() => props.config?.foldGutter, (show) => {
  if (editorView.value) {
    editorView.value.dispatch({
      effects: foldGutterCompartment.reconfigure(show ?? true ? foldGutter() : []),
    });
  }
});

watch(() => themeStore.isDark, (isDark) => {
  if (editorView.value) {
    editorView.value.dispatch({
      effects: themeCompartment.reconfigure(isDark ? vscodeDark : vscodeLight),
    });
  }
});

const getContent = (): string => {
  return editorView.value?.state.doc.toString() || '';
};

const setContent = (newContent: string): void => {
  if (editorView.value) {
    editorView.value.dispatch({
      changes: { from: 0, to: editorView.value.state.doc.length, insert: newContent },
    });
    internalDirtyState.value = false;
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
  internalDirtyState.value = false;
};

defineExpose({
  getContent,
  setContent,
  isDirty,
  focusEditor,
  triggerSave,
  editorView, // 暴露 editorView 实例
});
</script>

<style scoped>
.rich-code-editor-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  @apply border border-gray-300; /* 默认亮色边框 */
  transition: border-color 0.2s ease-in-out;
}
.rich-code-editor-wrapper.dark {
  @apply border-gray-600; /* 暗色模式下的边框 */
}
.rich-code-editor-wrapper.is-focused {
  @apply border-2 border-blue-500;
}
.rich-code-editor-wrapper.dark.is-focused {
  @apply border-2 border-blue-400;
}

.breadcrumb-bar {
  padding: 8px 12px;
  background-color: #252526;
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
}

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