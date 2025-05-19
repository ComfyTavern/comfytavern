<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, nextTick, toRaw } from "vue"; // 咕咕：导入 toRaw
import type { Component } from "vue";
import { useStorage } from "@vueuse/core";
import { useEditorState } from "@/composables/editor/useEditorState"; // <-- 咕咕：导入 useEditorState
import RichCodeEditor from "@/components/common/RichCodeEditor.vue";
import TabbedEditorHost from "@/components/common/TabbedEditorHost.vue";
import type { EditorOpeningContext, TabData, EditorInstanceConfig } from "@/types/editorTypes"; // 咕咕：确保 EditorInstanceConfig 已导入
// BreadcrumbData and EditorInstanceConfig are now part of EditorOpeningContext or TabData, imported from editorTypes.ts
import { useWorkflowManager } from "@/composables/workflow/useWorkflowManager";
import { useThemeStore } from "@/stores/theme"; // 咕咕：导入全局主题存储
import { useWorkflowInteractionCoordinator } from "@/composables/workflow/useWorkflowInteractionCoordinator";
import type { HistoryEntry, HistoryEntryDetails } from "@comfytavern/types";

// == Props, Events, Methods (Expose) ==
// interface Props {
//   // 未来可能需要的 props
// }
// const props = defineProps<Props>();

interface Emits {
  (e: "editorOpened"): void;
  (e: "editorClosed"): void;
  (e: "contentSaved", nodeId: string, inputPath: string, newContent: string): void;
}
const emit = defineEmits<Emits>();

const workflowManager = useWorkflowManager();
const interactionCoordinator = useWorkflowInteractionCoordinator();
const themeStore = useThemeStore(); // 咕咕：获取主题存储实例

// == UI State Management ==
// const isVisible = useStorage('docked-editor-isVisible', false); // <-- 咕咕：移除内部 isVisible，由外部控制
const editorHeight = useStorage("docked-editor-height", 300); // 默认高度 300px
// const isResident = useStorage('docked-editor-isResident', false); // 是否常驻，默认为 false // 咕咕：移除常驻按钮相关逻辑
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
  document.addEventListener("mousemove", doResize);
  document.addEventListener("mouseup", stopResize);
}

function doResize(event: MouseEvent) {
  if (!isResizing.value) return;
  const deltaY = event.clientY - dragStartY;
  const newHeight = initialHeight - deltaY; // 向上拖动增加高度，向下拖动减少高度
  editorHeight.value = Math.max(100, Math.min(newHeight, window.innerHeight * 0.8)); // 最小100px，最大80%视窗高度
}

function stopResize() {
  isResizing.value = false;
  document.removeEventListener("mousemove", doResize);
  document.removeEventListener("mouseup", stopResize);
}

function closeEditorPanel() {
  // if (!isResident.value) { // 即使常驻，关闭按钮也应该关闭它，除非有最小化逻辑
  if (isDockedEditorVisible.value) {
    // 只有在当前全局可见状态为 true 时才切换
    toggleDockedEditor(); // 调用全局切换函数
  }
  currentEditorContext.value = null; // 关闭时清除上下文
  emit("editorClosed");
  // }
}

// == Editor Mode Dispatching ==
type EditorMode = "single" | "fullMultiTab";
const currentEditorMode = ref<EditorMode>("fullMultiTab");
const activeEditorComponent = shallowRef<Component | null>(null);
const currentEditorContext = ref<EditorOpeningContext | null>(null); // 这个上下文包含了 nodeId, inputPath 等关键信息

const richCodeEditorRef = ref<InstanceType<typeof RichCodeEditor> | null>(null);
const tabbedEditorHostRef = ref<InstanceType<typeof TabbedEditorHost> | null>(null);
const openTabsMap = ref(new Map<string, TabData>()); // 用于存储 DockedEditorWrapper 打开的标签页信息

watch(
  currentEditorMode,
  (mode) => {
    if (mode === "single") {
      activeEditorComponent.value = RichCodeEditor;
    } else if (mode === "fullMultiTab") {
      activeEditorComponent.value = TabbedEditorHost;
    } else {
      activeEditorComponent.value = null;
    }
  },
  { immediate: true }
);

// == Context and Data Management ==
// breadcrumbData 将从 currentEditorContext 中获取

// == Data Saving ==
async function handleSave(content: string) {
  if (!currentEditorContext.value) {
    console.warn("无法保存，编辑器上下文丢失");
    return;
  }
  const { nodeId, inputPath, onSave: contextOnSave, breadcrumbData } = currentEditorContext.value; // languageHint removed, breadcrumbData added
  const activeTabId = workflowManager.activeTabId.value;

  if (!activeTabId) {
    console.warn("无法保存，没有活动的标签页");
    return;
  }

  try {
    // 使用 interactionCoordinator 来更新节点数据并记录历史
    const activeTabState = workflowManager.getActiveTabState();
    const node = activeTabState?.elements.find((el) => el.id === nodeId && !("source" in el));
    const nodeDisplayName =
      breadcrumbData?.nodeName ||
      (node as any)?.label ||
      (node as any)?.data?.displayName ||
      nodeId;
    let inputDisplayName = inputPath;
    if (inputPath.startsWith("inputs.")) {
      const inputKey = inputPath.substring("inputs.".length);
      let inputDef;
      if (node && (node as any).data && Array.isArray((node as any).data.inputs)) {
        inputDef = (node as any).data.inputs.find((i: any) => i.key === inputKey);
      }
      inputDisplayName = inputDef?.displayName || breadcrumbData?.inputName || inputKey;
    } else if (inputPath.startsWith("config.")) {
      const configKey = inputPath.substring("config.".length);
      const configDef = node?.data?.configSchema?.[configKey];
      inputDisplayName = (configDef as any)?.displayName || configKey;
    }

    const truncatedContent = content.length > 30 ? content.substring(0, 27) + "..." : content;
    const summary = `编辑 ${nodeDisplayName} - ${inputDisplayName}: "${truncatedContent}" (停靠编辑器)`;

    const historyDetails: HistoryEntryDetails = {
      nodeId,
      propertyName: inputPath, // 使用 inputPath 作为 propertyName
      newValue: content,
      // oldValue: ... // interactionCoordinator 内部可能会处理旧值
    };
    const historyEntry: HistoryEntry = {
      actionType: "modify", // 更通用的操作类型
      objectType: "nodeProperty", // 更具体的操作对象类型
      summary: summary, // 使用新的 summary
      details: historyDetails,
      timestamp: Date.now(),
    };

    if (inputPath.startsWith("inputs.")) {
      const inputKey = inputPath.substring("inputs.".length);
      await interactionCoordinator.updateNodeInputValueAndRecord(
        activeTabId,
        nodeId,
        inputKey,
        content,
        historyEntry
      );
    } else if (inputPath.startsWith("config.")) {
      const configKey = inputPath.substring("config.".length);
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
    emit("contentSaved", nodeId, inputPath, content);

    // 调用上下文提供的 onSave 回调
    if (contextOnSave) {
      contextOnSave(content);
    }

    // 如果是单页模式且非驻留，则保存后关闭
    // if (currentEditorMode.value === 'single' && !isResident.value) { // 咕咕：移除常驻按钮相关逻辑
    //   closeEditorPanel();
    // }
    // 咕咕：单页模式下，保存后总是关闭，除非未来有更复杂的逻辑
    if (currentEditorMode.value === "single") {
      closeEditorPanel();
    }
  } catch (error) {
    console.error("保存内容时出错:", error);
  }
}

function handleTabbedEditorSave(tab: TabData, newContent: string) {
  // TabbedEditorHost 保存时，我们需要从 tabData 中获取原始的 nodeId 和 inputPath
  // 这些信息应该在创建 TabData 时从 EditorOpeningContext 传入并存储
  // 假设 TabData 中已包含 nodeId 和 inputPath
  const {
    nodeId,
    inputPath,
    breadcrumbData,
    title: tabTitle,
  } = tab as TabData & Pick<EditorOpeningContext, "nodeId" | "inputPath" | "breadcrumbData">;

  if (nodeId && inputPath) {
    // 为了复用 handleSave 的逻辑，我们需要构造一个临时的 currentEditorContext
    // 或者直接调用 interactionCoordinator
    const activeTabId = workflowManager.activeTabId.value;
    if (!activeTabId) {
      console.warn("无法保存标签页，没有活动的标签页");
      return;
    }

    const activeTabState = workflowManager.getActiveTabState();
    const node = activeTabState?.elements.find((el) => el.id === nodeId && !("source" in el));
    const nodeDisplayName =
      breadcrumbData?.nodeName ||
      (node as any)?.label ||
      (node as any)?.data?.displayName ||
      nodeId;
    let inputDisplayName = inputPath;
    if (inputPath.startsWith("inputs.")) {
      const inputKey = inputPath.substring("inputs.".length);
      let inputDef;
      if (node && (node as any).data && Array.isArray((node as any).data.inputs)) {
        inputDef = (node as any).data.inputs.find((i: any) => i.key === inputKey);
      }
      let parsedInputNameFromTabTitle: string | undefined;
      if (tabTitle && tabTitle.includes(" > ")) {
        parsedInputNameFromTabTitle = tabTitle.substring(tabTitle.lastIndexOf(" > ") + 3).trim();
      }
      inputDisplayName =
        inputDef?.displayName ||
        parsedInputNameFromTabTitle ||
        breadcrumbData?.inputName ||
        inputKey; // 咕咕：调整优先级，加入从 tabTitle 解析的名称
    } else if (inputPath.startsWith("config.")) {
      const configKey = inputPath.substring("config.".length);
      const configDef = node?.data?.configSchema?.[configKey];
      inputDisplayName = (configDef as any)?.displayName || configKey;
    }

    const truncatedContent =
      newContent.length > 30 ? newContent.substring(0, 27) + "..." : newContent;
    const summary = `编辑 ${nodeDisplayName} - ${inputDisplayName}: "${truncatedContent}" (来自标签页 ${tabTitle})`;

    const historyDetails: HistoryEntryDetails = {
      nodeId,
      propertyName: inputPath,
      newValue: newContent,
    };
    const historyEntry: HistoryEntry = {
      actionType: "modify",
      objectType: "nodeProperty",
      summary: summary, // 使用新的 summary
      details: historyDetails,
      timestamp: Date.now(),
    };

    if (inputPath.startsWith("inputs.")) {
      const inputKey = inputPath.substring("inputs.".length);
      interactionCoordinator.updateNodeInputValueAndRecord(
        activeTabId,
        nodeId,
        inputKey,
        newContent,
        historyEntry
      );
    } else if (inputPath.startsWith("config.")) {
      const configKey = inputPath.substring("config.".length);
      interactionCoordinator.updateNodeConfigValueAndRecord(
        activeTabId,
        nodeId,
        configKey,
        newContent,
        historyEntry
      );
    } else {
      console.warn(`未知的 inputPath 前缀: ${inputPath}，尝试作为配置更新。`);
      interactionCoordinator.updateNodeConfigValueAndRecord(
        activeTabId,
        nodeId,
        inputPath,
        newContent,
        historyEntry
      );
    }
    console.log(`标签页 ${tab.title} 的内容已保存到节点 ${nodeId} 的 ${inputPath}`);
    // emit('contentSaved', nodeId, inputPath, newContent); // 这个 emit 应该由 handleSave 内部处理，或者这里也发一次？
    // 暂时由各自的保存逻辑触发
  } else {
    console.warn("TabbedEditorHost 保存失败：TabData 中缺少 nodeId 或 inputPath", tab);
  }
}

// == Public Methods (Exposed via defineExpose) ==
function openEditor(context: EditorOpeningContext) {
  currentEditorContext.value = context;
  currentEditorMode.value = context.bottomEditorMode || "fullMultiTab";
  // breadcrumbData 将从 currentEditorContext.value.breadcrumbData 获取

  if (!isDockedEditorVisible.value) {
    // 如果全局状态是不可见，则通过切换使其可见
    toggleDockedEditor();
  }
  // isVisible.value = true; // <-- 咕咕：移除，依赖全局状态
  emit("editorOpened");

  nextTick(() => {
    // 咕咕：准备传递给编辑器的配置，包含从全局主题派生的 theme 属性
    const editorConfigWithTheme: EditorInstanceConfig = {
      ...(context.config || {}), // 保留 context 中可能已有的其他配置
      theme: themeStore.isDark ? "dark" : "light",
    };

    if (currentEditorMode.value === "single" && richCodeEditorRef.value) {
      // 咕咕：在单页模式下，直接更新 currentEditorContext 的 config，RichCodeEditor 会通过 prop 接收
      currentEditorContext.value = {
        ...context,
        config: editorConfigWithTheme,
      };
      // 确保 RichCodeEditor 的 props 更新，Vue 的响应式系统应该会自动处理
      // 如果 RichCodeEditor 内部不直接 watch props.config 来更新主题，则可能需要手动调用其方法
      // 但根据 Grok 的修改，RichCodeEditor 应该会 watch props.config.theme
      richCodeEditorRef.value.setContent(context.initialContent || "");
      // richCodeEditorRef.value.focus(); // 考虑是否自动聚焦
    } else if (currentEditorMode.value === "fullMultiTab" && tabbedEditorHostRef.value) {
      const tabId = `${context.nodeId}_${context.inputPath}`;
      const newTab: TabData = {
        tabId,
        title:
          context.title ||
          context.breadcrumbData?.inputName ||
          context.breadcrumbData?.nodeName ||
          context.inputPath ||
          "新文件",
        editorId: `editor_${tabId}`,
        initialContent: context.initialContent || "",
        languageHint: context.languageHint,
        breadcrumbData: context.breadcrumbData,
        config: editorConfigWithTheme, // 咕咕：传递包含主题的配置
        nodeId: context.nodeId,
        inputPath: context.inputPath,
      };
      openTabsMap.value.set(tabId, newTab);
      tabbedEditorHostRef.value.openEditorTab(newTab);
    }
  });
}

// Wrapper function for RichCodeEditor save-requested event
function handleRichCodeEditorSaveRequested(payload: { editorId: string; content: string }) {
  // In single mode, currentEditorContext is the source of truth for nodeId and inputPath
  if (currentEditorMode.value === "single" && currentEditorContext.value) {
    handleSave(payload.content);
  } else {
    // This case should ideally not happen if RichCodeEditor is only used in single mode here
    console.warn("RichCodeEditor save requested in unexpected mode or without context.");
  }
}

// Wrapper function for tab saved event to ensure correct type inference and access to openTabsMap
function handleTabSavedEvent(payload: { tabId: string; editorId: string; content: string }) {
  const tabData = openTabsMap.value.get(payload.tabId);
  if (tabData) {
    handleTabbedEditorSave(tabData, payload.content);
  }
}

function handleTabClosedEvent(payload: { tabId: string; editorId: string }) {
  openTabsMap.value.delete(payload.tabId);
  // if (openTabsMap.value.size === 0 && !isResident.value) { // 咕咕：移除常驻按钮相关逻辑
  //   closeEditorPanel();
  // }
  // 咕咕：所有标签关闭后总是关闭编辑器
  if (openTabsMap.value.size === 0) {
    closeEditorPanel();
  }
}

// Computed property for the condition in @all-tabs-closed
// const shouldCloseOnAllTabsClosed = computed(() => { // 咕咕：移除常驻按钮相关逻辑
//   return !isResident.value && openTabsMap.value.size === 0;
// });
// 咕咕：现在总是应该在所有标签关闭时关闭
const shouldCloseOnAllTabsClosed = computed(() => openTabsMap.value.size === 0);

// 咕咕：处理编辑器获得焦点时的同步逻辑
async function handleFocusIn() {
  if (!isDockedEditorVisible.value) return; // 编辑器不可见时不做任何事

  const activeWorkflowTabId = workflowManager.activeTabId.value; // 这是工作流的标签页 ID
  if (!activeWorkflowTabId) return;

  const activeWorkflow = workflowManager.getActiveTabState();
  if (!activeWorkflow?.elements) return;

  if (currentEditorMode.value === "single") {
    if (currentEditorContext.value && richCodeEditorRef.value) {
      const { nodeId, inputPath } = currentEditorContext.value;
      const node = activeWorkflow.elements.find((el) => el.id === nodeId && !("source" in el));
      if (node && node.data) {
        // let latestValue: any; // 咕咕：移除未使用的 latestValue
        let actualStringValue: string | undefined;
        // 咕咕：从节点数据中安全地提取值
        const rawNodeData = toRaw(node.data); // 使用 toRaw 获取原始对象，避免潜在的 Proxy 问题
        if (inputPath.startsWith("inputs.")) {
          const inputKey = inputPath.substring("inputs.".length);
          const inputValueObject = rawNodeData.inputs?.[inputKey];
          // 咕咕：输入值通常是一个对象，实际的文本在 .value 属性
          if (
            typeof inputValueObject === "object" &&
            inputValueObject !== null &&
            "value" in inputValueObject
          ) {
            actualStringValue = String(inputValueObject.value); // 确保是字符串
          } else if (typeof inputValueObject === "string") {
            // 也可能是直接的字符串
            actualStringValue = inputValueObject;
          }
        } else if (inputPath.startsWith("config.")) {
          const configKey = inputPath.substring("config.".length);
          // 咕咕：配置值通常直接是字符串或其他原始类型
          actualStringValue = rawNodeData.config?.[configKey];
        } else {
          actualStringValue = rawNodeData[inputPath];
        }

        if (actualStringValue !== undefined) {
          // 咕咕：现在判断 actualStringValue
          const currentEditorContent = richCodeEditorRef.value.getContent();
          if (currentEditorContent !== actualStringValue) {
            richCodeEditorRef.value.setContent(actualStringValue);
          }
        }
      }
    }
  } else if (currentEditorMode.value === "fullMultiTab") {
    if (tabbedEditorHostRef.value) {
      const activeHostTabId = tabbedEditorHostRef.value.getActiveTabId(); // 这是 TabbedEditorHost 内部的激活标签ID
      if (activeHostTabId) {
        const tabData = openTabsMap.value.get(activeHostTabId); // openTabsMap 存储了 DockedEditorWrapper 打开的标签
        if (tabData && tabData.nodeId && tabData.inputPath) {
          const { nodeId, inputPath } = tabData;
          const node = activeWorkflow.elements.find((el) => el.id === nodeId && !("source" in el));
          if (node && node.data) {
            // let latestValue: any; // 咕咕：移除未使用的 latestValue 声明
            let actualStringValue: string | undefined;
            const rawNodeData = toRaw(node.data);
            if (inputPath.startsWith("inputs.")) {
              const inputKey = inputPath.substring("inputs.".length);
              const inputValueObject = rawNodeData.inputs?.[inputKey];
              if (
                typeof inputValueObject === "object" &&
                inputValueObject !== null &&
                "value" in inputValueObject
              ) {
                actualStringValue = String(inputValueObject.value);
              } else if (typeof inputValueObject === "string") {
                actualStringValue = inputValueObject;
              }
              // latestValue = inputValueObject; // 咕咕：移除未使用的 latestValue 赋值
            } else if (inputPath.startsWith("config.")) {
              const configKey = inputPath.substring("config.".length);
              actualStringValue = rawNodeData.config?.[configKey];
              // latestValue = actualStringValue; // 咕咕：移除未使用的 latestValue 赋值
            } else {
              actualStringValue = rawNodeData[inputPath];
              // latestValue = actualStringValue; // 咕咕：移除未使用的 latestValue 赋值
            }

            if (actualStringValue !== undefined) {
              const currentEditorContent = tabbedEditorHostRef.value.getTabContent(activeHostTabId);
              if (currentEditorContent !== actualStringValue) {
                tabbedEditorHostRef.value.updateTabContent(activeHostTabId, actualStringValue);
              }
            }
          }
        }
      }
    }
  }
}

defineExpose({
  openEditor,
  // toggleVisibility, // <-- 咕咕：移除
  // isVisible, // <-- 咕咕：移除
  // isResident, // 咕咕：移除常驻按钮相关逻辑
});

onMounted(() => {
  // 组件挂载时，如果全局状态要求其可见，则触发 opened 事件
  if (isDockedEditorVisible.value) {
    emit("editorOpened");
    // 初始化时，如果可见且是多标签模式，确保 TabbedEditorHost 存在
    if (currentEditorMode.value === "fullMultiTab") {
      // 默认是 fullMultiTab
      activeEditorComponent.value = TabbedEditorHost;
    }
  }
});
</script>

<template>
  <!-- v-if="isVisible" 已被移除，因为父组件 EditorView.vue 会通过 v-if="isDockedEditorVisible" 控制此组件的挂载 -->
  <div
    class="docked-editor-wrapper-root"
    :style="panelStyle"
    :class="{ dark: themeStore.isDark }"
    @focusin="handleFocusIn"
  >
    <div class="editor-resizer" @mousedown="startResize"></div>
    <div class="editor-header">
      <span class="editor-title">
        <!-- 根据模式显示不同标题 -->
        <template v-if="currentEditorMode === 'single' && currentEditorContext?.breadcrumbData">
          编辑:
          <span v-if="currentEditorContext.breadcrumbData.workflowName"
            >{{ currentEditorContext.breadcrumbData.workflowName }} &gt;
          </span>
          <span v-if="currentEditorContext.breadcrumbData.nodeName"
            >{{ currentEditorContext.breadcrumbData.nodeName }} &gt;
          </span>
          <span v-if="currentEditorContext.breadcrumbData.inputName">{{
            currentEditorContext.breadcrumbData.inputName
          }}</span>
          <span
            v-if="
              !currentEditorContext.breadcrumbData.inputName &&
              !currentEditorContext.breadcrumbData.nodeName
            "
            >{{ currentEditorContext.inputPath }}</span
          >
        </template>
        <template v-else-if="currentEditorMode === 'single' && currentEditorContext">
          编辑: {{ currentEditorContext.inputPath }}
        </template>
        <template v-else-if="currentEditorMode === 'fullMultiTab'"> 编辑器 </template>
      </span>
      <div class="editor-actions">
        <!-- <button @click="isResident = !isResident" :title="isResident ? '取消常驻' : '设为常驻'"> // 咕咕：移除常驻按钮
          {{ isResident ? '📌' : '📍' }}
        </button> -->
        <button @click="closeEditorPanel" title="关闭面板">✕</button>
      </div>
    </div>
    <div class="editor-content">
      <!-- Single Mode: Show RichCodeEditor if context exists, otherwise show placeholder -->
      <template v-if="currentEditorMode === 'single'">
        <component
          :is="activeEditorComponent"
          v-if="activeEditorComponent && currentEditorContext"
          ref="richCodeEditorRef"
          :editor-id="`${currentEditorContext.nodeId}_${currentEditorContext.inputPath}_single`"
          :initial-content="currentEditorContext.initialContent || ''"
          :language-hint="currentEditorContext.languageHint"
          :breadcrumb-data="currentEditorContext.breadcrumbData"
          :config="currentEditorContext.config"
          @save-requested="handleRichCodeEditorSaveRequested"
        />
        <div v-else class="editor-placeholder">没有活动的编辑对象。请从节点输入处打开编辑器。</div>
      </template>

      <!-- Multi-Tab Mode: TabbedEditorHost handles its own empty state -->
      <TabbedEditorHost
        v-show="currentEditorMode === 'fullMultiTab'"
        ref="tabbedEditorHostRef"
        @tab-saved="handleTabSavedEvent"
        @tab-closed="handleTabClosedEvent"
        @all-tabs-closed="
          () => {
            if (shouldCloseOnAllTabsClosed) closeEditorPanel();
          }
        "
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
.docked-editor-wrapper-root {
  width: 100%;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  @apply bg-white border-t border-gray-200 text-gray-800;
}
.docked-editor-wrapper-root.dark {
  @apply bg-gray-800 border-t border-gray-700 text-gray-200;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.25);
}

.editor-resizer {
  width: 100%;
  height: 8px;
  cursor: ns-resize;
  position: absolute;
  top: -4px;
  left: 0;
  z-index: 1001;
  @apply bg-gray-300;
}
.docked-editor-wrapper-root.dark .editor-resizer {
  @apply bg-gray-600;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  user-select: none;
  position: relative; /* 确保在 resizer 之上，如果 resizer 不是 absolute */
  z-index: 1000; /* 低于 resizer */
  @apply bg-gray-100 border-b border-gray-200;
}
.docked-editor-wrapper-root.dark .editor-header {
  @apply bg-gray-700 border-gray-600; /* 使用 700 替代 750 */
}

.editor-title {
  font-weight: bold;
  font-size: 0.9em;
  /* 颜色从 .docked-editor-wrapper-root 继承 */
}

.editor-actions button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 1.1em;
  @apply text-gray-600 hover:bg-gray-200;
}
.docked-editor-wrapper-root.dark .editor-actions button {
  @apply text-gray-300 hover:bg-gray-600;
}

.editor-content {
  flex-grow: 1;
  overflow: hidden;
  position: relative;
  /* 背景由内部 RichCodeEditor 主题控制 */
}

.editor-content > :deep(*) {
  width: 100%;
  height: 100%;
}

.editor-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  font-style: italic;
  padding: 20px;
  text-align: center;
  @apply text-gray-400;
}
.docked-editor-wrapper-root.dark .editor-placeholder {
  @apply text-gray-500;
}
</style>
