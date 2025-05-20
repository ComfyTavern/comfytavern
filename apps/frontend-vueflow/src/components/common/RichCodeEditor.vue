<template>
  <div class="rich-code-editor-wrapper" ref="wrapperRef" :class="{ dark: themeStore.isDark }">
    <div v-if="breadcrumbData" class="breadcrumb-bar">
      <span v-if="breadcrumbData.workflowName" class="breadcrumb-item">{{
        breadcrumbData.workflowName
      }}</span>
      <span
        v-if="breadcrumbData.workflowName && (breadcrumbData.nodeName || breadcrumbData.inputName)"
        class="breadcrumb-separator"
        >></span
      >
      <span v-if="breadcrumbData.nodeName" class="breadcrumb-item">{{
        breadcrumbData.nodeName
      }}</span>
      <span v-if="breadcrumbData.nodeName && breadcrumbData.inputName" class="breadcrumb-separator"
        >></span
      >
      <span v-if="breadcrumbData.inputName" class="breadcrumb-item">{{
        breadcrumbData.inputName
      }}</span>
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
import { ref, onMounted, onUnmounted, watch, shallowRef, reactive } from "vue";
import { EditorState, Compartment } from "@codemirror/state"; // Transaction removed as it's no longer used
import {
  EditorView,
  lineNumbers,
  keymap,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import { lintKeymap } from "@codemirror/lint";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { foldGutter, foldKeymap } from "@codemirror/language"; // 导入 foldGutter 和 foldKeymap
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import type { BreadcrumbData, EditorInstanceConfig } from "@/types/editorTypes";
import { useThemeStore } from "@/stores/theme";
import EditorContextMenu from "./EditorContextMenu.vue"; // 导入右键菜单组件

const props = defineProps<{
  editorId: string;
  initialContent: string;
  languageHint?: "json" | "markdown" | "javascript" | "python" | "text" | string;
  breadcrumbData?: BreadcrumbData;
  config?: EditorInstanceConfig;
}>();

const emit = defineEmits<{
  (e: "contentChanged", payload: { editorId: string; newContent: string; isDirty: boolean }): void;
  (e: "saveRequested", payload: { editorId: string; content: string }): void;
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
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        internalDirtyState.value = true;
        const emittedContent = update.state.doc.toString();
        let finalEmittedContent = emittedContent;

        if (props.languageHint === "json") {
          try {
            const parsedJson = JSON.parse(emittedContent);
            finalEmittedContent = JSON.stringify(parsedJson, null, 2);
          } catch (e) {
            console.warn(
              `[RichCodeEditor updateListener editorId: ${props.editorId}] JSON mode: emittedContent is not valid JSON for re-formatting, emitting as-is. Error:`,
              e,
              "Value (stringified):",
              JSON.stringify(emittedContent)
            );
          }
        }

        emit("contentChanged", {
          editorId: props.editorId,
          newContent: finalEmittedContent,
          isDirty: true,
        });
      }
    }),
    EditorView.domEventHandlers({
      focus(_event, _view) {
        wrapperRef.value?.classList.add("is-focused");
      },
      blur(_event, _view) {
        wrapperRef.value?.classList.remove("is-focused");
        if (internalDirtyState.value) {
          triggerSave();
        }
      },
      contextmenu: (event, _view) => {
        handleContextMenu(event);
        return true; // 表示已处理该事件
      },
    }),
  ];

  if (props.languageHint) {
    switch (props.languageHint.toLowerCase()) {
      case "javascript":
      case "js":
        extensions.push(javascript({ jsx: true }));
        break;
      case "json":
        extensions.push(json());
        break;
      case "markdown":
      case "md":
        extensions.push(markdown());
        break;
      default:
        break;
    }
  }

  let docContent = props.initialContent;
  if (props.languageHint === "json" && typeof props.initialContent !== "string") {
    try {
      docContent = JSON.stringify(props.initialContent, null, 2);
    } catch (e) {
      console.error(
        `[RichCodeEditor editorId: ${props.editorId}] Failed to stringify initialContent:`,
        e
      );
      docContent =
        '{\n  "error": "Invalid initial content for JSON editor, failed to stringify."\n}';
    }
  }

  const startState = EditorState.create({
    doc: docContent,
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

watch(
  () => props.initialContent,
  (newVal) => {
    let newContentForEditor = newVal; // Declare at the top of the watch callback

    if (props.languageHint === "json" && typeof newVal !== "string") {
      console.warn(
        // 保留这个警告，因为它指示了一个潜在的 props 类型问题
        `[RichCodeEditor editorId: ${
          props.editorId
        }] Watched initialContent for JSON languageHint is not a string. Type: ${typeof newVal}. Value:`,
        newVal,
        "Attempting to stringify."
      );
      try {
        newContentForEditor = JSON.stringify(newVal, null, 2);
      } catch (e) {
        console.error(
          // 保留这个错误
          `[RichCodeEditor editorId: ${props.editorId}] Failed to stringify watched initialContent:`,
          e
        );
        newContentForEditor =
          '{\n  "error": "Invalid watched content for JSON editor, failed to stringify."\n}';
      }
    }

    if (editorView.value) {
      if (newContentForEditor !== editorView.value.state.doc.toString()) {
        editorView.value.dispatch({
          changes: { from: 0, to: editorView.value.state.doc.length, insert: newContentForEditor },
        });
        internalDirtyState.value = false;
      }
    } else {
      if (newVal !== props.initialContent) {
      }
    }

    emit("contentChanged", {
      editorId: props.editorId,
      newContent: newContentForEditor,
      isDirty: false,
    });
  }
);

watch(
  () => props.config?.readOnly,
  (_isReadOnly) => {
    if (editorView.value) {
      editorView.value.dispatch({
        effects: editableCompartment.reconfigure(EditorView.editable.of(!(_isReadOnly ?? false))),
      });
    }
  }
);

watch(
  () => props.config?.lineNumbers,
  (show) => {
    if (editorView.value) {
      editorView.value.dispatch({
        effects: lineNumbersCompartment.reconfigure(show ?? true ? lineNumbers() : []),
      });
    }
  }
);

watch(
  () => props.config?.foldGutter,
  (show) => {
    if (editorView.value) {
      editorView.value.dispatch({
        effects: foldGutterCompartment.reconfigure(show ?? true ? foldGutter() : []),
      });
    }
  }
);

watch(
  () => themeStore.isDark,
  (isDark) => {
    if (editorView.value) {
      editorView.value.dispatch({
        effects: themeCompartment.reconfigure(isDark ? vscodeDark : vscodeLight),
      });
    }
  }
);

const getContent = (): string => {
  return editorView.value?.state.doc.toString() || "";
};

const setContent = (newContent: string): void => {
  if (editorView.value) {
    editorView.value.dispatch({
      changes: { from: 0, to: editorView.value.state.doc.length, insert: newContent },
    });
    internalDirtyState.value = false;
    emit("contentChanged", {
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
  emit("saveRequested", { editorId: props.editorId, content: currentContent });
  internalDirtyState.value = false;
};

defineExpose({
  getContent,
  setContent,
  isDirty,
  focusEditor,
  triggerSave,
  editorView,
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
  font-family: "Consolas", "Monaco", monospace;
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
