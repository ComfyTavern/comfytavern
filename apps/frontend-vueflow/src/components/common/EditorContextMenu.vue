<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="contextMenuRef"
      class="context-menu fixed"
      :style="{ top: `${displayPosition.y}px`, left: `${displayPosition.x}px` }"
      @click.stop
      @contextmenu.prevent
    >
      <button class="context-menu-item" @click="execCommand('undo')" :disabled="!canUndo">撤销</button>
      <button class="context-menu-item" @click="execCommand('redo')" :disabled="!canRedo">重做</button>
      <div class="context-menu-divider"></div>
      <button class="context-menu-item" @click="execCommand('cut')">剪切</button>
      <button class="context-menu-item" @click="execCommand('copy')">复制</button>
      <button class="context-menu-item" @click="execCommand('paste')">粘贴</button>
      <div class="context-menu-divider"></div>
      <button class="context-menu-item" @click="execCommand('selectAll')">全选</button>
      <div class="context-menu-divider"></div>
      <button class="context-menu-item" @click="execCommand('search')">搜索</button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, reactive } from 'vue';
import type { EditorView } from '@codemirror/view';
import { undo, redo, selectAll, undoDepth, redoDepth } from '@codemirror/commands';
// import { openSearchPanel } from '@codemirror/search'; // 旧的搜索面板功能，将被替换
import { customSearchKeymap } from '@rigstech/codemirror-vscodesearch'; // 导入新的搜索插件的keymap
import type { KeyBinding } from "@codemirror/view"; // 导入 KeyBinding 类型
import { onClickOutside } from '@vueuse/core';

const props = defineProps<{
  editorView: EditorView | null | undefined; // 允许 null 类型
  visible: boolean;
  position: { x: number; y: number };
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const contextMenuRef = ref<HTMLDivElement | null>(null);
const displayPosition = reactive({ x: 0, y: 0 });

watch(
  [() => props.position, () => props.visible],
  ([newPosition, isVisible]) => {
    if (isVisible) {
      // Set initial position immediately
      displayPosition.x = newPosition.x;
      displayPosition.y = newPosition.y;

      nextTick(() => { // Adjust after DOM update to get correct dimensions
        if (!contextMenuRef.value) return;

        const menuEl = contextMenuRef.value;
        // Use getBoundingClientRect for more accurate dimensions including transforms if any
        const menuRect = menuEl.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        let adjustedX = newPosition.x;
        let adjustedY = newPosition.y;

        // Adjust X position
        if (newPosition.x + menuRect.width > windowWidth) {
          adjustedX = windowWidth - menuRect.width - 5; // 5px buffer
        }
        if (adjustedX < 5) { // Ensure it doesn't go off screen left, 5px buffer
          adjustedX = 5;
        }
         // If menu is wider than viewport, pin to left with buffer
        if (menuRect.width >= windowWidth) {
            adjustedX = 5;
        }


        // Adjust Y position
        if (newPosition.y + menuRect.height > windowHeight) {
          adjustedY = windowHeight - menuRect.height - 5; // 5px buffer
        }
        if (adjustedY < 5) { // Ensure it doesn't go off screen top, 5px buffer
          adjustedY = 5;
        }
        // If menu is taller than viewport, pin to top with buffer
        if (menuRect.height >= windowHeight) {
            adjustedY = 5;
        }

        displayPosition.x = adjustedX;
        displayPosition.y = adjustedY;
      });
    }
  },
  { immediate: true, deep: true } // deep for props.position object
);

onClickOutside(contextMenuRef, () => {
  if (props.visible) {
    emit('close');
  }
});

const isSelectionEmpty = computed(() => {
  if (!props.editorView) {
    console.log('[EditorContextMenu] editorView is not available.');
    return true;
  }
  const selection = props.editorView.state.selection.main;
  console.log('[EditorContextMenu] Selection state:', JSON.stringify(selection), `From: ${selection.from}, To: ${selection.to}, Empty: ${selection.empty}`);
  const isEmpty = selection.from === selection.to; // 或者直接使用 selection.empty
  console.log('[EditorContextMenu] isSelectionEmpty computed:', isEmpty, 'Based on from === to. selection.empty is:', selection.empty);
  return isEmpty; // 优先使用 selection.empty 如果它更可靠
  // return selection.empty; // 尝试直接使用 CodeMirror 的 .empty 属性
});

const canUndo = computed(() => {
  return props.editorView ? undoDepth(props.editorView.state) > 0 : false;
});

const canRedo = computed(() => {
  return props.editorView ? redoDepth(props.editorView.state) > 0 : false;
});

const canPaste = computed(() => {
  // 检查浏览器是否支持 Clipboard API 的 readText 方法
  // 注意：在某些安全上下文中（例如非 HTTPS），navigator.clipboard 可能不可用
  return typeof navigator.clipboard?.readText === 'function';
});

async function execCommand(command: 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll' | 'search') {
  if (!props.editorView) return;
  const view = props.editorView;

  try {
    switch (command) {
      case 'undo':
        undo(view);
        break;
      case 'redo':
        redo(view);
        break;
      case 'cut':
        if (!isSelectionEmpty.value) {
          const { from, to } = view.state.selection.main;
          const selectedText = view.state.sliceDoc(from, to);
          await navigator.clipboard.writeText(selectedText);
          view.dispatch({ changes: { from, to, insert: '' } });
        }
        break;
      case 'copy':
        if (!isSelectionEmpty.value) {
          const { from, to } = view.state.selection.main;
          const selectedText = view.state.sliceDoc(from, to);
          await navigator.clipboard.writeText(selectedText);
        }
        break;
      case 'paste':
        if (canPaste.value) { // 再次检查以防万一
          const text = await navigator.clipboard.readText();
          if (text) {
            view.dispatch(view.state.replaceSelection(text));
          }
        } else {
          console.warn('Paste command disabled: Clipboard API not fully available or permission denied.');
          // 可以考虑通过 UI 通知用户
        }
        break;
      case 'selectAll':
        selectAll(view);
        break;
      case 'search':
        // 尝试执行 customSearchKeymap 中原始的 Mod-F 命令
        // eslint-disable-next-line no-case-declarations
        const originalModFEntry = (customSearchKeymap as KeyBinding[]).find(
          (k: KeyBinding) => k.key && typeof k.key === 'string' && k.key.toLowerCase() === "mod-f"
        );
        if (originalModFEntry && typeof originalModFEntry.run === 'function') {
          originalModFEntry.run(view);
        } else {
          console.warn("EditorContextMenu: Mod-F command (for vscodeSearch) not found in customSearchKeymap.");
          // 作为备用，可以尝试一个通用的搜索命令，但这里我们期望 customSearchKeymap 提供
        }
        break;
    }
  } catch (err) {
    console.error(`Failed to execute command ${command}:`, err);
    // 可以考虑显示一个用户友好的错误消息
  }
  emit('close');
}
</script>

<style scoped>
.context-menu {
  @apply absolute bg-gray-800 text-white rounded-md shadow-lg p-1 z-[1000] min-w-[160px] border border-gray-700;
}
.context-menu-item {
  @apply block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-700 rounded cursor-pointer focus:outline-none focus:bg-gray-700;
}
.context-menu-item:disabled {
  @apply opacity-50 cursor-not-allowed hover:bg-transparent;
}
.context-menu-divider {
  @apply border-t border-gray-600 my-1 mx-1;
}
</style>