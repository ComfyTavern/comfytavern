<template>
  <div class="ct-tabbed-editor-host"> <!-- Removed :class="{ dark: isDark }" -->
    <div class="ct-tab-bar">
      <div
        v-for="tab in openTabs"
        :key="tab.tabId"
        class="ct-tab-item"
        :class="{ active: tab.tabId === activeTabIdInternal }"
        @click="activateTab(tab.tabId)"
      >
        <span class="ct-tab-title">{{ getTruncatedTitle(tab.title) }}</span>
        <button class="ct-close-tab-btn" @click.stop="handleCloseTab(tab.tabId)">×</button>
      </div>
    </div>
    <div class="ct-tab-content">
      <template v-for="tab in openTabs" :key="tab.tabId">
        <div v-show="tab.tabId === activeTabIdInternal" class="ct-editor-instance-wrapper">
          <RichCodeEditor
            :ref="(el) => { if (el) editorRefs[tab.editorId] = el as InstanceType<typeof RichCodeEditor>; else delete editorRefs[tab.editorId]; }"
            :editor-id="tab.editorId"
            :initial-content="tab.initialContent"
            :language-hint="tab.languageHint"
            :breadcrumb-data="tab.breadcrumbData"
            :config="tab.config"
            @content-changed="(payload) => handleContentChanged(tab.tabId, payload)"
            @save-requested="(payload) => handleSaveRequested(tab.tabId, payload)"
          />
        </div>
      </template>
      <div v-if="openTabs.length === 0" class="ct-no-tabs-placeholder">
        没有活动的编辑标签页。请从节点输入处打开编辑器。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, reactive } from 'vue'; // computed removed as isDark is no longer used directly in template
import RichCodeEditor from './RichCodeEditor.vue';
import type { TabData } from '@/types/editorTypes';
// import { useThemeStore } from '@/stores/theme'; // Not directly needed if not using isDark in script
// import { storeToRefs } from 'pinia'; // Not directly needed

// Props
const props = defineProps<{
  initialTabsData?: TabData[];
  activeTabId?: string;
}>();

// Emits
const emit = defineEmits<{
  (e: 'tabOpened', payload: { tabId: string; editorId: string }): void;
  (e: 'tabClosed', payload: { tabId: string; editorId: string }): void;
  (e: 'tabSaved', payload: { tabId: string; editorId: string; content: string }): void;
  (e: 'activeTabChanged', payload: { newTabId?: string; oldTabId?: string }): void;
  (e: 'allTabsClosed'): void;
}>();

const openTabs = ref<TabData[]>([]);
const activeTabIdInternal = ref<string | undefined>(undefined);
const editorRefs = reactive<Record<string, InstanceType<typeof RichCodeEditor> | null>>({});
// const themeStore = useThemeStore(); // No longer needed here
// const { currentAppliedMode } = storeToRefs(themeStore); // No longer needed here
// const isDark = computed(() => currentAppliedMode.value === 'dark'); // No longer needed here

// 初始化
onMounted(() => {
  if (props.initialTabsData && props.initialTabsData.length > 0) {
    openTabs.value = [...props.initialTabsData];
    if (props.activeTabId && openTabs.value.some(tab => tab.tabId === props.activeTabId)) {
      activeTabIdInternal.value = props.activeTabId;
    } else if (openTabs.value[0]) { // 确保 openTabs.value[0] 存在
      activeTabIdInternal.value = openTabs.value[0].tabId;
    }
  }
});

// 监听外部 activeTabId 变化
watch(() => props.activeTabId, (newId) => {
  if (newId && openTabs.value.some(tab => tab.tabId === newId)) {
    activateTab(newId);
  }
});

// 激活标签页
const activateTab = (tabId: string) => {
  if (activeTabIdInternal.value === tabId) return;
  const oldTabId = activeTabIdInternal.value;
  activeTabIdInternal.value = tabId;
  emit('activeTabChanged', { newTabId: tabId, oldTabId });
  nextTick(() => {
    const activeEditorTab = openTabs.value.find(t => t.tabId === tabId);
    if (activeEditorTab && editorRefs[activeEditorTab.editorId]) {
      editorRefs[activeEditorTab.editorId]?.focusEditor();
    }
  });
};

// 处理内容变更
const handleContentChanged = (tabId: string, payload: { editorId: string; newContent: string; isDirty: boolean }) => {
  const tab = openTabs.value.find(t => t.tabId === tabId);
  if (tab) {
    tab.isDirty = payload.isDirty;
  }
};

// 处理保存请求
const handleSaveRequested = (tabId: string, payload: { editorId: string; content: string }) => {
  const tab = openTabs.value.find(t => t.tabId === tabId);
  if (tab) {
    tab.isDirty = false; 
    emit('tabSaved', { tabId, editorId: payload.editorId, content: payload.content });
  }
};

// 处理关闭标签页按钮点击
const handleCloseTab = (tabId: string) => {
  closeEditorTab(tabId);
};

// 获取截断后的标题
const getTruncatedTitle = (title: string): string => {
  const maxLength = 30;
  if (title.length > maxLength) {
    return `${title.substring(0, maxLength)}...`;
  }
  return title;
};

// 暴露的方法
const openEditorTab = (tabData: TabData): void => {
  const existingTab = openTabs.value.find(tab => tab.tabId === tabData.tabId || tab.editorId === tabData.editorId);
  if (existingTab) {
    activateTab(existingTab.tabId);
  } else {
    openTabs.value.push({ ...tabData, isDirty: false });
    activateTab(tabData.tabId);
    emit('tabOpened', { tabId: tabData.tabId, editorId: tabData.editorId });
  }
};

const closeEditorTab = (tabId: string): void => {
  const tabIndex = openTabs.value.findIndex(tab => tab.tabId === tabId);
  if (tabIndex === -1) return;

  // TODO: 如果 openTabs.value[tabIndex].isDirty，可以提示用户保存
  const closedTabsArray = openTabs.value.splice(tabIndex, 1);
  
  if (closedTabsArray.length > 0) {
    const closedTab = closedTabsArray[0];
    
    if (closedTab) {
      delete editorRefs[closedTab.editorId];
      emit('tabClosed', { tabId: closedTab.tabId, editorId: closedTab.editorId });

      if (activeTabIdInternal.value === closedTab.tabId) {
        const oldActiveTabId = activeTabIdInternal.value;
        if (openTabs.value.length > 0) {
          let newActiveCandidateIndex = tabIndex;
          if (newActiveCandidateIndex >= openTabs.value.length) {
            newActiveCandidateIndex = openTabs.value.length - 1;
          }
          
          if (newActiveCandidateIndex >= 0 && newActiveCandidateIndex < openTabs.value.length) {
            const newActiveTab = openTabs.value[newActiveCandidateIndex];
            if (newActiveTab) {
              activateTab(newActiveTab.tabId);
            } else {
              activeTabIdInternal.value = undefined;
              emit('activeTabChanged', { newTabId: undefined, oldTabId: oldActiveTabId });
              emit('allTabsClosed');
            }
          } else {
            activeTabIdInternal.value = undefined;
            emit('activeTabChanged', { newTabId: undefined, oldTabId: oldActiveTabId });
            emit('allTabsClosed');
          }
        } else { 
          activeTabIdInternal.value = undefined;
          emit('activeTabChanged', { newTabId: undefined, oldTabId: oldActiveTabId });
          emit('allTabsClosed');
        }
      }
    }
  }
};

const saveEditorTab = (tabId: string): void => {
  const tab = openTabs.value.find(t => t.tabId === tabId);
  if (tab && editorRefs[tab.editorId]) {
    editorRefs[tab.editorId]?.triggerSave();
  }
};

const getActiveTabId = (): string | undefined => {
  return activeTabIdInternal.value;
};

const getTabContent = (tabId: string): string | undefined => {
  const tab = openTabs.value.find(t => t.tabId === tabId);
  if (tab && editorRefs[tab.editorId]) {
    return editorRefs[tab.editorId]?.getContent();
  }
  return undefined;
};

const updateTabContent = (tabId: string, newContent: string): void => {
  const tab = openTabs.value.find(t => t.tabId === tabId);
  if (tab && editorRefs[tab.editorId]) {
    editorRefs[tab.editorId]?.setContent(newContent);
    // 考虑是否需要将 tab.isDirty 设置为 false，取决于同步逻辑是否算作“干净”状态
    // 暂时不修改 isDirty，因为这通常由用户编辑触发
  }
};

defineExpose({
  openEditorTab,
  closeEditorTab,
  saveEditorTab,
  getActiveTabId,
  getTabContent, // 暴露新方法
  updateTabContent, // 暴露新方法
});
</script>

<style scoped>
.ct-tabbed-editor-host {
  display: flex;
  flex-direction: column;
  height: 100%;
  @apply bg-background-surface border border-border-base;
}
/* .ct-tabbed-editor-host.dark removed, Tailwind dark: prefix will handle */

.ct-tab-bar {
  display: flex;
  flex-shrink: 0;
  overflow-x: auto;
  @apply bg-background-base border-b border-border-base;
}
/* .ct-tabbed-editor-host.dark .ct-tab-bar removed */

.ct-tab-item {
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  white-space: nowrap;
  user-select: none;
  @apply border-r border-border-base text-text-base;
}
/* .ct-tabbed-editor-host.dark .ct-tab-item removed */

.ct-tab-item:hover {
  @apply bg-background-base dark:bg-neutral dark:bg-opacity-[var(--ct-component-hover-bg-opacity)];
}
/* .ct-tabbed-editor-host.dark .ct-tab-item:hover removed */

.ct-tab-item.active {
  position: relative;
  @apply bg-background-surface border-b-transparent text-primary;
}
/* .ct-tabbed-editor-host.dark .ct-tab-item.active removed */

/* 确保激活的tab底部边框与内容区域背景融合 */
.ct-tab-item.active {
  /* The border-bottom-color is now effectively transparent due to bg-background-surface */
  /* and the tab bar having bg-background-base. If a visible line is desired, */
  /* it would need to be a different color or approach. */
  /* For fusion, this setup should work if tab content area also has bg-background-surface */
   border-bottom-color: hsl(var(--ct-background-surface-hsl)); /* Match content background */
}
/* Removed specific .dark and :not(.dark) for --active-tab-border-color as it's now directly set */


.ct-tab-title {
  margin-right: 8px;
  font-size: 0.9em;
}

.ct-close-tab-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1em;
  padding: 0 4px;
  margin-left: auto;
  border-radius: 3px;
  @apply text-text-muted;
}
/* .ct-tabbed-editor-host.dark .ct-close-tab-btn removed */

.ct-close-tab-btn:hover {
  @apply bg-background-base text-text-base dark:bg-neutral dark:bg-opacity-[var(--ct-component-hover-bg-opacity)] dark:text-text-base;
}
/* .ct-tabbed-editor-host.dark .ct-close-tab-btn:hover removed */

.ct-tab-content {
  flex-grow: 1;
  position: relative;
  overflow: hidden;
  @apply bg-background-surface; /* Content area background */
}
/* .ct-tabbed-editor-host.dark .ct-tab-content removed */


.ct-editor-instance-wrapper {
  height: 100%;
  width: 100%;
}

.ct-no-tabs-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  font-style: italic;
  padding: 20px;
  text-align: center;
  @apply text-text-muted;
}
/* .ct-tabbed-editor-host.dark .ct-no-tabs-placeholder removed */
</style>