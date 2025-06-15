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
  isSettingsModalVisible: boolean; // 控制设置模态框的显示状态
  settingsModalProps: { // 修改：存储设置模态框的属性
    width: string;
    height: string; // 修改：固定高度
  };
  baseZIndex: number; // 新增：基础 z-index
  currentMaxZIndex: number; // 新增：当前最大 z-index
  // + 用于初始用户名设置模态框
  isInitialUsernameSetupModalVisible: boolean;
  initialUsernameForSetup: string | null;

  // 文件管理器详情面板状态
  isFileManagerDetailPanelOpen: boolean;
  fileManagerDetailPanelWidth: number;

  // 文件管理器左侧导航栏折叠状态
  isFileManagerSidebarCollapsed: boolean;
}

const defaultSettingsModalProps = {
  width: 'max-w-3xl', // 默认宽度
  height: '75vh',   // 修改：默认固定高度
};

const BASE_Z_INDEX = 1000; // 定义基础 z-index 值
const DEFAULT_FM_DETAIL_PANEL_WIDTH = 320; // 默认详情面板宽度
const MIN_FM_DETAIL_PANEL_WIDTH = 200; // 最小详情面板宽度
const MAX_FM_DETAIL_PANEL_WIDTH = 1200; // 最大详情面板宽度 (可根据需要调整)

const FM_SIDEBAR_COLLAPSED = 'fm_sidebar_collapsed'; // 已存在的 key
const FM_DETAIL_PANEL_OPEN = 'fm_detail_panel_open'; // 新增 key

export const useUiStore = defineStore('ui', {
  state: (): UiStoreState => {
    console.log('[uiStore] Initializing state...');

    // 初始化侧边栏状态
    let initialSidebarCollapsed = false;
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedSidebarState = localStorage.getItem(FM_SIDEBAR_COLLAPSED);
      console.log(`[uiStore] Raw value from localStorage for ${FM_SIDEBAR_COLLAPSED}:`, storedSidebarState);
      if (storedSidebarState !== null) {
        try {
          initialSidebarCollapsed = JSON.parse(storedSidebarState);
          console.log('[uiStore] Parsed initialSidebarCollapsed from localStorage:', initialSidebarCollapsed);
        } catch (error) {
          console.error('[uiStore] Error parsing stored sidebar state:', error, 'Defaulting to false.');
          initialSidebarCollapsed = false;
        }
      } else {
        console.log(`[uiStore] No ${FM_SIDEBAR_COLLAPSED} found in localStorage, defaulting to false.`);
        initialSidebarCollapsed = false;
      }
    } else {
      console.log('[uiStore] localStorage not available, defaulting sidebar to false.');
      initialSidebarCollapsed = false;
    }
    console.log('[uiStore] Final initialSidebarCollapsed state being set:', initialSidebarCollapsed);

    // 初始化详情面板打开状态
    let initialDetailPanelOpen = false;
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedDetailPanelState = localStorage.getItem(FM_DETAIL_PANEL_OPEN);
      console.log(`[uiStore] Raw value from localStorage for ${FM_DETAIL_PANEL_OPEN}:`, storedDetailPanelState);
      if (storedDetailPanelState !== null) {
        try {
          initialDetailPanelOpen = JSON.parse(storedDetailPanelState);
          console.log('[uiStore] Parsed initialDetailPanelOpen from localStorage:', initialDetailPanelOpen);
        } catch (error) {
          console.error('[uiStore] Error parsing stored detail panel state:', error, 'Defaulting to false.');
          initialDetailPanelOpen = false;
        }
      } else {
        console.log(`[uiStore] No ${FM_DETAIL_PANEL_OPEN} found in localStorage, defaulting to false.`);
        initialDetailPanelOpen = false;
      }
    } else {
      console.log('[uiStore] localStorage not available, defaulting detail panel to false.');
      initialDetailPanelOpen = false;
    }
    console.log('[uiStore] Final initialDetailPanelOpen state being set:', initialDetailPanelOpen);

    return {
      isRegexEditorModalVisible: false,
      regexEditorModalData: null as RegexEditorModalData | null,
      isSettingsModalVisible: false,
      settingsModalProps: { ...defaultSettingsModalProps },
      baseZIndex: BASE_Z_INDEX,
      currentMaxZIndex: BASE_Z_INDEX,
      isInitialUsernameSetupModalVisible: false,
      initialUsernameForSetup: null as string | null,
      isFileManagerDetailPanelOpen: initialDetailPanelOpen, // 使用从 localStorage 读取的值
      fileManagerDetailPanelWidth: DEFAULT_FM_DETAIL_PANEL_WIDTH,
      isFileManagerSidebarCollapsed: initialSidebarCollapsed, // 使用从 localStorage 读取的值
    };
  },
  actions: {
    getNextZIndex(): number {
      this.currentMaxZIndex += 10;
      return this.currentMaxZIndex;
    },
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

    // 控制设置模态框的方法
    openSettingsModal(props?: { width?: string; height?: string }) {
      if (props) {
        this.settingsModalProps.width = props.width ?? defaultSettingsModalProps.width;
        this.settingsModalProps.height = props.height ?? defaultSettingsModalProps.height;
      } else {
        // 如果没有传递 props，确保使用默认值
        this.settingsModalProps = { ...defaultSettingsModalProps };
      }
      this.isSettingsModalVisible = true;
    },
    closeSettingsModal() {
      this.isSettingsModalVisible = false;
      // 关闭时重置为默认尺寸，可选行为
      this.settingsModalProps = { ...defaultSettingsModalProps };
    },

    // + 控制初始用户名设置模态框的方法
    openInitialUsernameSetupModal(payload?: { initialUsername?: string }) {
      this.initialUsernameForSetup = payload?.initialUsername || null;
      this.isInitialUsernameSetupModalVisible = true;
    },
    closeInitialUsernameSetupModal() {
      this.isInitialUsernameSetupModalVisible = false;
      this.initialUsernameForSetup = null; // 关闭时清除，确保下次打开是干净状态
    },

    // 文件管理器详情面板 Actions
    _saveDetailPanelState(isOpen: boolean) {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(FM_DETAIL_PANEL_OPEN, JSON.stringify(isOpen));
          console.log(`[uiStore] Saved to localStorage (${FM_DETAIL_PANEL_OPEN}):`, isOpen);
        } catch (error) {
          console.error('[uiStore] Error saving detail panel state to localStorage:', error);
        }
      } else {
        console.warn('[uiStore] localStorage not available, cannot save detail panel state.');
      }
    },
    openFileManagerDetailPanel() {
      console.log('[uiStore] openFileManagerDetailPanel called. Current state:', this.isFileManagerDetailPanelOpen);
      if (!this.isFileManagerDetailPanelOpen) {
        this.isFileManagerDetailPanelOpen = true;
        this._saveDetailPanelState(true);
        console.log('[uiStore] Detail panel opened. New state:', this.isFileManagerDetailPanelOpen);
      } else {
        console.log('[uiStore] Detail panel already open.');
      }
      // TODO: 可以考虑在这里检查是否有选中项，并通知 fileManagerStore 更新 selectedItemForDetail
    },
    closeFileManagerDetailPanel() {
      console.log('[uiStore] closeFileManagerDetailPanel called. Current state:', this.isFileManagerDetailPanelOpen);
      if (this.isFileManagerDetailPanelOpen) {
        this.isFileManagerDetailPanelOpen = false;
        this._saveDetailPanelState(false);
        console.log('[uiStore] Detail panel closed. New state:', this.isFileManagerDetailPanelOpen);
      } else {
        console.log('[uiStore] Detail panel already closed.');
      }
    },
    toggleFileManagerDetailPanel(isOpen?: boolean) {
      const newState = typeof isOpen === 'boolean' ? isOpen : !this.isFileManagerDetailPanelOpen;
      console.log(`[uiStore] toggleFileManagerDetailPanel called with isOpen: ${isOpen}. Current state: ${this.isFileManagerDetailPanelOpen}. New target state: ${newState}`);
      if (this.isFileManagerDetailPanelOpen !== newState) {
        this.isFileManagerDetailPanelOpen = newState;
        this._saveDetailPanelState(newState);
        console.log('[uiStore] Detail panel toggled. New state:', this.isFileManagerDetailPanelOpen);
      } else {
        console.log('[uiStore] Detail panel state unchanged by toggle.');
      }
    },
    setFileManagerDetailPanelWidth(width: number) {
      this.fileManagerDetailPanelWidth = Math.max(MIN_FM_DETAIL_PANEL_WIDTH, Math.min(width, MAX_FM_DETAIL_PANEL_WIDTH));
      // TODO: 可以考虑持久化这个宽度到 localStorage
    },
    resetFileManagerDetailPanelWidth() {
      this.fileManagerDetailPanelWidth = DEFAULT_FM_DETAIL_PANEL_WIDTH;
    },

    // 文件管理器侧边栏 Actions
    toggleFileManagerSidebar() {
      // 正确的侧边栏持久化应该在 theme.ts 中，这里只是 uiStore 中的一个状态，如果 theme.ts 也改用这个，则需要加 localStorage
      console.log(`[uiStore] toggleFileManagerSidebar called. Current state: ${this.isFileManagerSidebarCollapsed}`);
      this.isFileManagerSidebarCollapsed = !this.isFileManagerSidebarCollapsed;
      // 如果决定在这里持久化（而不是 theme.ts），则需要添加 localStorage.setItem(...)
      console.log(`[uiStore] Sidebar collapsed toggled. New state: ${this.isFileManagerSidebarCollapsed}`);
    },
    setFileManagerSidebarCollapsed(collapsed: boolean) {
      // 正确的侧边栏持久化应该在 theme.ts 中
      console.log(`[uiStore] setFileManagerSidebarCollapsed called with: ${collapsed}. Current state: ${this.isFileManagerSidebarCollapsed}`);
      this.isFileManagerSidebarCollapsed = collapsed;
      // 如果决定在这里持久化（而不是 theme.ts），则需要添加 localStorage.setItem(...)
      console.log(`[uiStore] Sidebar collapsed set. New state: ${this.isFileManagerSidebarCollapsed}`);
    },
  },
});