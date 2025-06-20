<template>
  <div class="rich-code-editor-wrapper" ref="wrapperRef">
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
import { highlightSelectionMatches } from "@codemirror/search"; // searchKeymap 将被新的插件替换
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
import { vscodeSearch, customSearchKeymap } from '@rigstech/codemirror-vscodesearch'; // 导入新的搜索插件
import type { KeyBinding } from "@codemirror/view"; // 导入 KeyBinding 类型
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { comfyTavernBaseTheme } from "@/codemirror-theme/comfyTavernEditorTheme"; // 导入自定义基础主题
import type { BreadcrumbData, EditorInstanceConfig } from "@/types/editorTypes";
import { useThemeStore } from "@/stores/theme";
import EditorContextMenu from "../graph/editor/EditorContextMenu.vue"; // 导入右键菜单组件

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
    themeCompartment.of(themeStore.currentAppliedMode === 'dark' ? vscodeDark : vscodeLight), // 提供语法高亮和默认行为
    comfyTavernBaseTheme, // 应用自定义基础UI颜色，覆盖 vscodeLight/Dark 的对应部分
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
      // ...searchKeymap, // 旧的搜索快捷键，将被 customSearchKeymap 替换
      ...historyKeymap,
      ...foldKeymap, // 添加 foldKeymap
      ...completionKeymap,
      ...lintKeymap,
      indentWithTab,
      // 从 customSearchKeymap 中移除 Mod-F，然后手动添加，确保 preventDefault 生效
      ...(customSearchKeymap as KeyBinding[]).filter(
        (k: KeyBinding) => !(k.key && typeof k.key === 'string' && k.key.toLowerCase() === "mod-f")
      ),
      {
        key: "Mod-f",
        run: (view: EditorView): boolean => {
          // 尝试执行 customSearchKeymap 中原始的 Mod-F 命令
          const originalModFEntry = (customSearchKeymap as KeyBinding[]).find(
            (k: KeyBinding) => k.key && typeof k.key === 'string' && k.key.toLowerCase() === "mod-f"
          );
          if (originalModFEntry && typeof originalModFEntry.run === 'function') {
            originalModFEntry.run(view);
          } else {
            // 如果在 customSearchKeymap 中找不到 Mod-F 的处理函数，
            // 这可能意味着 vscodeSearch 插件没有正确提供该快捷键，
            // 或者它依赖于其他方式来激活搜索。
            // 作为一个备选方案，可以尝试调用一个已知的搜索命令，但这里我们依赖库的配置。
            console.warn("RichCodeEditor: Mod-F command not found in customSearchKeymap from @rigstech/codemirror-vscodesearch.");
            // 即使找不到命令，也返回 true 来尝试阻止浏览器默认行为，
            // 因为用户的意图是使用编辑器内搜索。
          }
          return true; // 阻止浏览器默认的查找行为
        },
      },
    ]),
    vscodeSearch, // 添加新的搜索插件UI
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
  () => themeStore.currentAppliedMode, // 监听 currentAppliedMode
  (newMode) => { // newMode 将是 'light' 或 'dark'
    if (editorView.value) {
      editorView.value.dispatch({
        effects: themeCompartment.reconfigure(newMode === 'dark' ? vscodeDark : vscodeLight),
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
  @apply border border-border-base; /* 使用主题变量定义边框 */
  transition: border-color 0.2s ease-in-out;
}
/* .dark specific styles for border are removed as theme variables handle it */
.rich-code-editor-wrapper.is-focused {
  @apply border-primary; /* 聚焦时边框颜色使用 primary */
}
/* .dark.is-focused specific styles are removed */

.breadcrumb-bar {
  @apply bg-neutral text-text-secondary border-b border-border-base;
  padding: 8px 12px;
  font-size: 0.9em;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.breadcrumb-item {
  margin-right: 4px;
}

.breadcrumb-separator {
  @apply text-text-muted;
  margin: 0 4px;
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
:deep(.cm-editor .find-replace-container) {
  position: absolute !important;
  top: 5px; /* 如果面包屑存在，可能需要调整为 40px 左右 */
  right: 15px;
  width: auto;
  min-width: 350px;
  z-index: 20;
  @apply shadow-lg rounded-md; /* 使用 Tailwind 的 shadow 和 rounded */
}
</style>
