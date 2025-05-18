<template>
  <div class="ct-tabbed-editor-host">
    <div class="ct-tab-bar">
      <div
        v-for="tab in openTabs"
        :key="tab.tabId"
        class="ct-tab-item"
        :class="{ active: tab.tabId === activeTabIdInternal }"
        @click="activateTab(tab.tabId)"
      >
        <span class="ct-tab-title">{{ tab.title }}</span>
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
import { ref, watch, nextTick, onMounted, reactive } from 'vue';
import RichCodeEditor from './RichCodeEditor.vue';
import type { TabData } from '@/types/editorTypes';

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

defineExpose({
  openEditorTab,
  closeEditorTab,
  saveEditorTab,
  getActiveTabId,
});
</script>

<style scoped>
.ct-tabbed-editor-host {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--color-background-soft, #f0f0f0);
  border: 1px solid var(--color-border, #ccc);
}

.ct-tab-bar {
  display: flex;
  flex-shrink: 0;
  background-color: var(--color-background-mute, #e0e0e0);
  border-bottom: 1px solid var(--color-border, #ccc);
  overflow-x: auto;
}

.ct-tab-item {
  padding: 8px 12px;
  cursor: pointer;
  border-right: 1px solid var(--color-border, #ccc);
  display: flex;
  align-items: center;
  white-space: nowrap;
  user-select: none;
}

.ct-tab-item:hover {
  background-color: var(--color-background-hover, #d0d0d0);
}

.ct-tab-item.active {
  background-color: var(--color-background, #ffffff);
  border-bottom-color: var(--color-background, #ffffff);
  position: relative;
}

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
  color: var(--color-text-secondary, #666);
  border-radius: 3px;
}

.ct-close-tab-btn:hover {
  background-color: var(--color-background-hover, #c0c0c0);
  color: var(--color-text, #333);
}

.ct-tab-content {
  flex-grow: 1;
  position: relative;
  background-color: var(--color-background, #ffffff);
  overflow: hidden; /* 确保内容超出时隐藏 */
}

.ct-editor-instance-wrapper {
  height: 100%;
  width: 100%;
}

.ct-no-tabs-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: var(--color-text-muted, #888);
  font-style: italic;
  padding: 20px; /* 添加一些内边距使其更美观 */
  text-align: center; /* 确保文字居中 */
}
</style>