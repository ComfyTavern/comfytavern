import { defineStore } from 'pinia';
import type { RegexRule } from '@comfytavern/types';

interface RegexEditorModalData {
  rules: RegexRule[];
  nodeId: string;
  inputKey: string;
  // 可以添加一个回调，当模态框保存时调用，用于更新节点数据
  onSave: (updatedRules: RegexRule[]) => void;
}

interface UiStoreState {
  isRegexEditorModalVisible: boolean;
  regexEditorModalData: RegexEditorModalData | null;
  isSettingsModalVisible: boolean; // 新增：控制设置模态框的显示状态
}

export const useUiStore = defineStore('ui', {
  state: (): UiStoreState => ({
    isRegexEditorModalVisible: false,
    regexEditorModalData: null,
    isSettingsModalVisible: false, // 新增
  }),
  actions: {
    openRegexEditorModal(data: RegexEditorModalData) {
      this.regexEditorModalData = data;
      this.isRegexEditorModalVisible = true;
    },
    closeRegexEditorModal() {
      this.isRegexEditorModalVisible = false;
      // 可选：关闭时清除数据，以避免下次打开时短暂显示旧数据
      // this.regexEditorModalData = null; 
      // 但如果希望保留上次编辑的上下文（例如用户只是意外关闭），则不清除
    },
    // 如果 RegexEditorModal 内部处理保存逻辑并通过事件冒泡或直接调用节点更新，
    // 那么这里的 onSave 可能就不需要在 modalData 中传递，而是由 BaseNode 直接处理。
    // 但如果希望模态框保存后，通过 store 通知 BaseNode 更新，则 onSave 回调有用。
    // 目前的设计是 BaseNode 触发打开，模态框内部编辑，保存时通过 emit('save') + v-model 更新。
    // 所以这里的 onSave 暂时作为一种可能性保留。

    // 新增：控制设置模态框的方法
    openSettingsModal() {
      this.isSettingsModalVisible = true;
    },
    closeSettingsModal() {
      this.isSettingsModalVisible = false;
    },
  },
});