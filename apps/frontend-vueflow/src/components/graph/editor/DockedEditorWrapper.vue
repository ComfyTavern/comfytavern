<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, nextTick } from 'vue';
import type { Component } from 'vue';
import { useStorage } from '@vueuse/core';
import { useEditorState } from '@/composables/editor/useEditorState'; // <-- 咕咕：导入 useEditorState
import RichCodeEditor from '@/components/common/RichCodeEditor.vue';
import TabbedEditorHost from '@/components/common/TabbedEditorHost.vue';
import type { EditorOpeningContext, TabData } from '@/types/editorTypes';
// BreadcrumbData and EditorInstanceConfig are now part of EditorOpeningContext or TabData, imported from editorTypes.ts
import { useWorkflowManager } from '@/composables/workflow/useWorkflowManager';
import { useWorkflowInteractionCoordinator } from '@/composables/workflow/useWorkflowInteractionCoordinator';
import type { HistoryEntry, HistoryEntryDetails } from '@comfytavern/types';

// == Props, Events, Methods (Expose) ==
// interface Props {
//   // 未来可能需要的 props
// }
// const props = defineProps<Props>();

interface Emits {
  (e: 'editorOpened'): void;
  (e: 'editorClosed'): void;
  (e: 'contentSaved', nodeId: string, inputPath: string, newContent: string): void;
}
const emit = defineEmits<Emits>();

const workflowManager = useWorkflowManager();
const interactionCoordinator = useWorkflowInteractionCoordinator();

// == UI State Management ==
// const isVisible = useStorage('docked-editor-isVisible', false); // <-- 咕咕：移除内部 isVisible，由外部控制
const editorHeight = useStorage('docked-editor-height', 300); // 默认高度 300px
const isResident = useStorage('docked-editor-isResident', false); // 是否常驻，默认为 false
const { toggleDockedEditor, isDockedEditorVisible } = useEditorState(); // <-- 咕咕：使用全局状态

const panelStyle = computed(() => ({
  height: `${editorHeight.value}px`,
}));

let dragStartY = 0;
let initialHeight = 0;
const isResizing = ref(false);

function startResize(event: MouseEvent) {
  isResizing.value = true;
  dragStartY = event.clientY;
  initialHeight = editorHeight.value;
  document.addEventListener('mousemove', doResize);
  document.addEventListener('mouseup', stopResize);
}

function doResize(event: MouseEvent) {
  if (!isResizing.value) return;
  const deltaY = event.clientY - dragStartY;
  const newHeight = initialHeight - deltaY; // 向上拖动增加高度，向下拖动减少高度
  editorHeight.value = Math.max(100, Math.min(newHeight, window.innerHeight * 0.8)); // 最小100px，最大80%视窗高度
}

function stopResize() {
  isResizing.value = false;
  document.removeEventListener('mousemove', doResize);
  document.removeEventListener('mouseup', stopResize);
}

// function toggleVisibility() { // <-- 咕咕：移除，由 useEditorState.toggleDockedEditor 控制
//   isVisible.value = !isVisible.value;
//   if (isVisible.value) {
//     emit('editorOpened');
//   } else {
//     emit('editorClosed');
//   }
// }

function closeEditorPanel() {
  // if (!isResident.value) { // 即使常驻，关闭按钮也应该关闭它，除非有最小化逻辑
    if (isDockedEditorVisible.value) { // 只有在当前全局可见状态为 true 时才切换
      toggleDockedEditor(); // 调用全局切换函数
    }
    currentEditorContext.value = null; // 关闭时清除上下文
    emit('editorClosed');
  // }
}

// == Editor Mode Dispatching ==
type EditorMode = 'single' | 'fullMultiTab';
const currentEditorMode = ref<EditorMode>('fullMultiTab');
const activeEditorComponent = shallowRef<Component | null>(null);
const currentEditorContext = ref<EditorOpeningContext | null>(null); // 这个上下文包含了 nodeId, inputPath 等关键信息

const richCodeEditorRef = ref<InstanceType<typeof RichCodeEditor> | null>(null);
const tabbedEditorHostRef = ref<InstanceType<typeof TabbedEditorHost> | null>(null);
const openTabsMap = ref(new Map<string, TabData>()); // 用于存储 DockedEditorWrapper 打开的标签页信息

watch(currentEditorMode, (mode) => {
  if (mode === 'single') {
    activeEditorComponent.value = RichCodeEditor;
  } else if (mode === 'fullMultiTab') {
    activeEditorComponent.value = TabbedEditorHost;
  } else {
    activeEditorComponent.value = null;
  }
}, { immediate: true });

// == Context and Data Management ==
// breadcrumbData 将从 currentEditorContext 中获取

// == Data Saving ==
async function handleSave(content: string) {
  if (!currentEditorContext.value) {
    console.warn('无法保存，编辑器上下文丢失');
    return;
  }
  const { nodeId, inputPath, onSave: contextOnSave } = currentEditorContext.value; // languageHint removed
  const activeTabId = workflowManager.activeTabId.value;

  if (!activeTabId) {
    console.warn('无法保存，没有活动的标签页');
    return;
  }

  try {
    // 使用 interactionCoordinator 来更新节点数据并记录历史
    // 需要确定是更新 input 还是 config
    // 假设 inputPath 的格式能区分, e.g., "inputs.myInput" vs "config.myConfig"
    const historyDetails: HistoryEntryDetails = {
      nodeId,
      propertyName: inputPath, // 使用 inputPath 作为 propertyName
      newValue: content,
      // oldValue: ... // interactionCoordinator 内部可能会处理旧值
    };
    const historyEntry: HistoryEntry = {
      actionType: 'modify', // 更通用的操作类型
      objectType: 'nodeProperty', // 更具体的操作对象类型
      summary: `更新节点 ${nodeId} 的 ${inputPath}`,
      details: historyDetails,
      timestamp: Date.now(),
    };

    if (inputPath.startsWith('inputs.')) {
      const inputKey = inputPath.substring('inputs.'.length);
      await interactionCoordinator.updateNodeInputValueAndRecord(
        activeTabId,
        nodeId,
        inputKey,
        content,
        historyEntry
      );
    } else if (inputPath.startsWith('config.')) {
      const configKey = inputPath.substring('config.'.length);
      await interactionCoordinator.updateNodeConfigValueAndRecord(
        activeTabId,
        nodeId,
        configKey,
        content,
        historyEntry
      );
    } else {
      // 对于其他路径，可能需要一个更通用的更新方法，或者明确约定路径格式
      // 暂时作为配置更新处理
      console.warn(`未知的 inputPath 前缀: ${inputPath}，尝试作为配置更新。`);
      await interactionCoordinator.updateNodeConfigValueAndRecord(
        activeTabId,
        nodeId,
        inputPath, // 直接使用 inputPath 作为 key
        content,
        historyEntry
      );
    }

    console.log(`内容已通过协调器保存到节点 ${nodeId} 的 ${inputPath}:`, content);
    emit('contentSaved', nodeId, inputPath, content);

    // 调用上下文提供的 onSave 回调
    if (contextOnSave) {
      contextOnSave(content);
    }

    // 如果是单页模式且非驻留，则保存后关闭
    if (currentEditorMode.value === 'single' && !isResident.value) {
      closeEditorPanel();
    }
  } catch (error) {
    console.error('保存内容时出错:', error);
  }
}

function handleTabbedEditorSave(tab: TabData, newContent: string) {
  // TabbedEditorHost 保存时，我们需要从 tabData 中获取原始的 nodeId 和 inputPath
  // 这些信息应该在创建 TabData 时从 EditorOpeningContext 传入并存储
  // 假设 TabData 中已包含 nodeId 和 inputPath
  const { nodeId, inputPath } = tab as TabData & Pick<EditorOpeningContext, 'nodeId' | 'inputPath'>;

  if (nodeId && inputPath) {
    // 为了复用 handleSave 的逻辑，我们需要构造一个临时的 currentEditorContext
    // 或者直接调用 interactionCoordinator
    const activeTabId = workflowManager.activeTabId.value;
    if (!activeTabId) {
      console.warn('无法保存标签页，没有活动的标签页');
      return;
    }

    const historyDetails: HistoryEntryDetails = {
      nodeId,
      propertyName: inputPath,
      newValue: newContent,
    };
    const historyEntry: HistoryEntry = {
      actionType: 'modify',
      objectType: 'nodeProperty',
      summary: `更新节点 ${nodeId} 的 ${inputPath} (来自标签页 ${tab.title})`,
      details: historyDetails,
      timestamp: Date.now(),
    };

    if (inputPath.startsWith('inputs.')) {
      const inputKey = inputPath.substring('inputs.'.length);
      interactionCoordinator.updateNodeInputValueAndRecord(activeTabId, nodeId, inputKey, newContent, historyEntry);
    } else if (inputPath.startsWith('config.')) {
      const configKey = inputPath.substring('config.'.length);
      interactionCoordinator.updateNodeConfigValueAndRecord(activeTabId, nodeId, configKey, newContent, historyEntry);
    } else {
      console.warn(`未知的 inputPath 前缀: ${inputPath}，尝试作为配置更新。`);
      interactionCoordinator.updateNodeConfigValueAndRecord(activeTabId, nodeId, inputPath, newContent, historyEntry);
    }
    console.log(`标签页 ${tab.title} 的内容已保存到节点 ${nodeId} 的 ${inputPath}`);
    // emit('contentSaved', nodeId, inputPath, newContent); // 这个 emit 应该由 handleSave 内部处理，或者这里也发一次？
                                                        // 暂时由各自的保存逻辑触发
  } else {
    console.warn('TabbedEditorHost 保存失败：TabData 中缺少 nodeId 或 inputPath', tab);
  }
}


// == Public Methods (Exposed via defineExpose) ==
function openEditor(context: EditorOpeningContext) {
  currentEditorContext.value = context;
  currentEditorMode.value = context.bottomEditorMode || 'fullMultiTab';
  // breadcrumbData 将从 currentEditorContext.value.breadcrumbData 获取

  if (!isDockedEditorVisible.value) { // 如果全局状态是不可见，则通过切换使其可见
    toggleDockedEditor();
  }
  // isVisible.value = true; // <-- 咕咕：移除，依赖全局状态
  emit('editorOpened');

  nextTick(() => {
    if (currentEditorMode.value === 'single' && richCodeEditorRef.value) {
      richCodeEditorRef.value.setContent(context.initialContent || '');
      // Breadcrumb is passed as a prop, no need to call setBreadcrumbs
      // richCodeEditorRef.value.focus(); // 考虑是否自动聚焦
    } else if (currentEditorMode.value === 'fullMultiTab' && tabbedEditorHostRef.value) {
      const tabId = `${context.nodeId}_${context.inputPath}`;
      const newTab: TabData = {
        tabId,
        title: context.breadcrumbData?.inputName || context.breadcrumbData?.nodeName || context.inputPath || '新文件',
        editorId: `editor_${tabId}`,
        initialContent: context.initialContent || '',
        languageHint: context.languageHint,
        breadcrumbData: context.breadcrumbData, // 传递对象
        config: context.config,
        nodeId: context.nodeId, // 存储 nodeId 以便保存时使用
        inputPath: context.inputPath, // 存储 inputPath 以便保存时使用
      };
      openTabsMap.value.set(tabId, newTab); // 存储标签页信息
      tabbedEditorHostRef.value.openEditorTab(newTab); // 调用正确的方法
    }
  });
}

// Wrapper function for RichCodeEditor save-requested event
function handleRichCodeEditorSaveRequested(payload: { editorId: string; content: string }) {
  // In single mode, currentEditorContext is the source of truth for nodeId and inputPath
  if (currentEditorMode.value === 'single' && currentEditorContext.value) {
    handleSave(payload.content);
  } else {
    // This case should ideally not happen if RichCodeEditor is only used in single mode here
    console.warn('RichCodeEditor save requested in unexpected mode or without context.');
  }
}

// Wrapper function for tab saved event to ensure correct type inference and access to openTabsMap
function handleTabSavedEvent(payload: {tabId: string; editorId: string; content: string}) {
  const tabData = openTabsMap.value.get(payload.tabId);
  if (tabData) {
    handleTabbedEditorSave(tabData, payload.content);
  }
}

function handleTabClosedEvent(payload: { tabId: string; editorId: string }) {
  openTabsMap.value.delete(payload.tabId);
  if (openTabsMap.value.size === 0 && !isResident.value) {
    closeEditorPanel();
  }
}

// Computed property for the condition in @all-tabs-closed
const shouldCloseOnAllTabsClosed = computed(() => {
  return !isResident.value && openTabsMap.value.size === 0;
});


defineExpose({
  openEditor,
  // toggleVisibility, // <-- 咕咕：移除
  // isVisible, // <-- 咕咕：移除
  isResident,
});

onMounted(() => {
  // 组件挂载时，如果全局状态要求其可见，则触发 opened 事件
  if (isDockedEditorVisible.value) {
    emit('editorOpened');
     // 初始化时，如果可见且是多标签模式，确保 TabbedEditorHost 存在
    if (currentEditorMode.value === 'fullMultiTab') { // 默认是 fullMultiTab
      activeEditorComponent.value = TabbedEditorHost;
    }
  }
});

</script>

<template>
  <!-- v-if="isVisible" 已被移除，因为父组件 EditorView.vue 会通过 v-if="isDockedEditorVisible" 控制此组件的挂载 -->
  <div class="docked-editor-wrapper-root" :style="panelStyle">
    <div class="editor-resizer" @mousedown="startResize"></div>
    <div class="editor-header">
      <span class="editor-title">
        <!-- 根据模式显示不同标题 -->
        <template v-if="currentEditorMode === 'single' && currentEditorContext?.breadcrumbData">
          编辑:
          <span v-if="currentEditorContext.breadcrumbData.workflowName">{{ currentEditorContext.breadcrumbData.workflowName }} &gt; </span>
          <span v-if="currentEditorContext.breadcrumbData.nodeName">{{ currentEditorContext.breadcrumbData.nodeName }} &gt; </span>
          <span v-if="currentEditorContext.breadcrumbData.inputName">{{ currentEditorContext.breadcrumbData.inputName }}</span>
          <span v-if="!currentEditorContext.breadcrumbData.inputName && !currentEditorContext.breadcrumbData.nodeName">{{ currentEditorContext.inputPath }}</span>
        </template>
        <template v-else-if="currentEditorMode === 'single' && currentEditorContext">
          编辑: {{ currentEditorContext.inputPath }}
        </template>
        <template v-else-if="currentEditorMode === 'fullMultiTab'">
          编辑器
        </template>
      </span>
      <div class="editor-actions">
        <button @click="isResident = !isResident" :title="isResident ? '取消常驻' : '设为常驻'">
          {{ isResident ? '📌' : '📍' }}
        </button>
        <button @click="closeEditorPanel" title="关闭面板">✕</button>
      </div>
    </div>
    <div class="editor-content">
      <component
        :is="activeEditorComponent"
        v-if="activeEditorComponent"
        ref="richCodeEditorRef"
        v-show="currentEditorMode === 'single'"
        :editor-id="currentEditorContext ? `${currentEditorContext.nodeId}_${currentEditorContext.inputPath}_single` : 'single_editor'"
        :initial-content="currentEditorContext?.initialContent || ''"
        :language-hint="currentEditorContext?.languageHint"
        :breadcrumb-data="currentEditorContext?.breadcrumbData"
        :config="currentEditorContext?.config"
        @save-requested="handleRichCodeEditorSaveRequested"
      />
      <TabbedEditorHost
        ref="tabbedEditorHostRef"
        v-show="currentEditorMode === 'fullMultiTab'"
        @tab-saved="handleTabSavedEvent"
        @tab-closed="handleTabClosedEvent"
        @all-tabs-closed="() => { if (shouldCloseOnAllTabsClosed) closeEditorPanel(); }"
      />
      <!--
        注意: RichCodeEditor 和 TabbedEditorHost 的 ref 赋值方式需要调整。
        当使用动态组件 :is 时，ref 会指向动态组件本身。
        如果需要分别引用 RichCodeEditor 和 TabbedEditorHost 的实例，
        不能同时给 <component> 和 <TabbedEditorHost> 相同的 ref (richCodeEditorRef)。
        这里暂时将 RichCodeEditor 的 ref 赋给动态组件，TabbedEditorHost 单独引用。
        如果 RichCodeEditor 也是通过 v-if/v-else 切换，则可以分别给 ref。
        当前实现中，v-show 用于切换，所以 ref 应该是指向各自的组件实例。
        已将 RichCodeEditor 的 ref 赋给动态组件，TabbedEditorHost 单独引用。
        在 openEditor 中，根据 currentEditorMode 来访问对应的 ref。
        更新：调整为 v-show，这样 ref 可以正确指向。
        再更新：RichCodeEditor 通过动态组件加载，TabbedEditorHost 始终在模板中但用 v-show 控制。
                 因此，richCodeEditorRef 会指向动态加载的 RichCodeEditor 实例（如果是它的话）。
                 tabbedEditorHostRef 正常指向 TabbedEditorHost。
                 在 handleSave 中，如果是 single 模式，则 currentEditorContext 已经有了。
                 在 openEditor 中，根据模式操作对应的 ref。
      -->
    </div>
  </div>
</template>

<style scoped>
/* .docked-editor-wrapper 已被移除，根元素现在是 .docked-editor-wrapper-root */
.docked-editor-wrapper-root {
  /* position: fixed; */ /* 不再是 fixed，因为它现在是 EditorView flex 布局的一部分 */
  /* bottom: 0; */
  /* left: 0; */
  /* right: 0; */
  width: 100%; /* 占据其在 flex 容器中的分配宽度 */
  /* height 由 panelStyle 动态设置 */
  background-color: var(--color-background-soft); /* 使用 CSS 变量适应主题 */
  border-top: 1px solid var(--color-border); /* 这个边框可能需要根据在画布下方还是右侧调整 */
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1); /* 这个阴影可能也需要调整 */
  display: flex;
  flex-direction: column;
  /* z-index: 1000; */ /* z-index 通常在 fixed/absolute 定位时更关键 */
  overflow: hidden; /* 防止内容溢出根元素，由内部 editor-content 处理滚动 */
}

/* 如果 DockedEditorWrapper 是直接放在 EditorView 的 .right-pane.flex-col 内部，
   那么它的高度由 panelStyle 控制，宽度是 100% of .right-pane。
   边框和阴影可能需要根据实际视觉效果调整。
   例如，如果它在画布下方，可能只需要一个 border-top。
*/

.editor-resizer {
  left: 0;
  right: 0;
  background-color: var(--color-background-soft); /* 使用 CSS 变量适应主题 */
  border-top: 1px solid var(--color-border);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 1000; /* 确保在其他内容之上 */
}

.editor-resizer {
  width: 100%;
  height: 8px;
  background-color: var(--color-border-hover);
  cursor: ns-resize;
  position: absolute;
  top: -4px; /* 使其一半在面板内，一半在外，方便拖拽 */
  left: 0;
  z-index: 1001;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background-color: var(--color-background-mute); /* 稍暗的背景 */
  border-bottom: 1px solid var(--color-border);
  user-select: none; /* 防止拖拽时选中文字 */
}

.editor-title {
  font-weight: bold;
  font-size: 0.9em;
}

.editor-actions button {
  background: none;
  border: none;
  color: var(--color-text);
  cursor: pointer;
  padding: 4px 8px;
  font-size: 1.1em;
}

.editor-actions button:hover {
  background-color: var(--color-background-hover);
}

.editor-content {
  flex-grow: 1;
  overflow: hidden; /* 内容超出时隐藏，由子组件处理滚动 */
  position: relative; /* 为子组件的绝对定位提供上下文 */
}

/* 子编辑器组件应该填充整个 editor-content区域 */
.editor-content > :deep(*) {
  width: 100%;
  height: 100%;
}
</style>