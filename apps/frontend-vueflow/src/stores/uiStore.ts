import { defineStore } from 'pinia';
import type { RegexRule } from '@comfytavern/types';

interface RegexEditorModalData {
  rules: RegexRule[];
  nodeId: string;
  inputKey: string;
  // 可以添加一个回调，当模态框保存时调用，用于更新节点数据
  onSave: (updatedRules: RegexRule[]) => void;
}

import type { Component } from 'vue';

interface ModalContent {
  component: Component | null;
  props?: Record<string, any>;
  modalProps?: {
    title?: string;
    width?: string;
    height?: string;
    showCloseIcon?: boolean;
    closeOnBackdrop?: boolean;
  };
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
  fileManagerSidebarWidth: number; // 新增：文件管理器左侧导航栏宽度

  // 新增：主侧边栏折叠状态
  isMainSidebarCollapsed: boolean;
  // 新增：是否为移动端视图
  isMobileView: boolean;

  // 新增：面板日志高度
  panelLogHeight: number;

  // 新增：列表视图列宽
  listViewColumnWidths: { [viewId: string]: { [columnId: string]: number } };

  // 新增：动态模态框内容
  modalContent: ModalContent | null;
}

const defaultSettingsModalProps = {
  width: 'max-w-3xl', // 默认宽度
  height: '75vh',   // 修改：默认固定高度
};

const BASE_Z_INDEX = 1000; // 定义基础 z-index 值
const DEFAULT_FM_DETAIL_PANEL_WIDTH = 320; // 默认详情面板宽度
const MIN_FM_DETAIL_PANEL_WIDTH = 200; // 最小详情面板宽度
const MAX_FM_DETAIL_PANEL_WIDTH = 1200; // 最大详情面板宽度 (可根据需要调整)

const DEFAULT_FM_SIDEBAR_WIDTH = 256; // 默认文件管理器侧边栏宽度 (w-64)
const MIN_FM_SIDEBAR_WIDTH = 160;    // 最小文件管理器侧边栏宽度 (w-40)
const MAX_FM_SIDEBAR_WIDTH = 512;    // 最大文件管理器侧边栏宽度 (w-128)

const DEFAULT_PANEL_LOG_HEIGHT = 250; // 新增：默认面板日志高度
const MIN_PANEL_LOG_HEIGHT = 80;      // 新增：最小面板日志高度

const FM_SIDEBAR_COLLAPSED = 'fm_sidebar_collapsed'; // 已存在的 key
const FM_DETAIL_PANEL_OPEN = 'fm_detail_panel_open'; // 新增 key
const FM_SIDEBAR_WIDTH_KEY = 'fm_sidebar_width'; // 新增：localStorage key for sidebar width
const MAIN_SIDEBAR_COLLAPSED = 'main_sidebar_collapsed'; // 新增：主侧边栏 localStorage key
const PANEL_LOG_HEIGHT_KEY = 'panel_log_height'; // 新增：面板日志高度 localStorage key
const LIST_VIEW_COLUMN_WIDTHS_KEY = 'list_view_column_widths'; // 新增：列表视图列宽 localStorage key

export const useUiStore = defineStore('ui', {
  state: (): UiStoreState => {
    // console.log(`[uiStore]('[uiStore] Initializing state...');

    // 初始化侧边栏状态
    let initialSidebarCollapsed = false;
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedSidebarState = localStorage.getItem(FM_SIDEBAR_COLLAPSED);
      // console.log(`[uiStore] Raw value from localStorage for ${FM_SIDEBAR_COLLAPSED}:`, storedSidebarState);
      if (storedSidebarState !== null) {
        try {
          initialSidebarCollapsed = JSON.parse(storedSidebarState);
          // console.log(`[uiStore]('[uiStore] Parsed initialSidebarCollapsed from localStorage:', initialSidebarCollapsed);
        } catch (error) {
          console.error('[uiStore] Error parsing stored sidebar state:', error, 'Defaulting to false.');
          initialSidebarCollapsed = false;
        }
      } else {
        // console.log(`[uiStore] No ${FM_SIDEBAR_COLLAPSED} found in localStorage, defaulting to false.`);
        initialSidebarCollapsed = false;
      }
    } else {
      // console.log(`[uiStore]('[uiStore] localStorage not available, defaulting sidebar to false.');
      initialSidebarCollapsed = false;
    }
    // console.log(`[uiStore]('[uiStore] Final initialSidebarCollapsed state being set:', initialSidebarCollapsed);

    // 初始化详情面板打开状态
    let initialDetailPanelOpen = false;
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedDetailPanelState = localStorage.getItem(FM_DETAIL_PANEL_OPEN);
      // console.log(`[uiStore] Raw value from localStorage for ${FM_DETAIL_PANEL_OPEN}:`, storedDetailPanelState);
      if (storedDetailPanelState !== null) {
        try {
          initialDetailPanelOpen = JSON.parse(storedDetailPanelState);
          // console.log(`[uiStore]('[uiStore] Parsed initialDetailPanelOpen from localStorage:', initialDetailPanelOpen);
        } catch (error) {
          console.error('[uiStore] Error parsing stored detail panel state:', error, 'Defaulting to false.');
          initialDetailPanelOpen = false;
        }
      } else {
        // console.log(`[uiStore] No ${FM_DETAIL_PANEL_OPEN} found in localStorage, defaulting to false.`);
        initialDetailPanelOpen = false;
      }
    } else {
      // console.log(`[uiStore]('[uiStore] localStorage not available, defaulting detail panel to false.');
      initialDetailPanelOpen = false;
    }
    // console.log(`[uiStore]('[uiStore] Final initialDetailPanelOpen state being set:', initialDetailPanelOpen);

    // 初始化主侧边栏状态
    let initialMainSidebarCollapsed = false; // 默认值
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedMainSidebarState = localStorage.getItem(MAIN_SIDEBAR_COLLAPSED);
      // console.log(`[uiStore] Raw value from localStorage for ${MAIN_SIDEBAR_COLLAPSED}:`, storedMainSidebarState);
      if (storedMainSidebarState !== null) {
        try {
          initialMainSidebarCollapsed = JSON.parse(storedMainSidebarState);
          // console.log(`[uiStore]('[uiStore] Parsed initialMainSidebarCollapsed from localStorage:', initialMainSidebarCollapsed);
        } catch (error) {
          console.error('[uiStore] Error parsing stored main sidebar state:', error, `Defaulting to false.`);
          initialMainSidebarCollapsed = false;
        }
      } else {
        // console.log(`[uiStore] No ${MAIN_SIDEBAR_COLLAPSED} found in localStorage, defaulting to false.`);
        initialMainSidebarCollapsed = false; // 明确默认值
      }
    } else {
      // console.log(`[uiStore]('[uiStore] localStorage not available, defaulting main sidebar to false.');
      initialMainSidebarCollapsed = false;
    }
    // console.log(`[uiStore]('[uiStore] Final initialMainSidebarCollapsed state being set:', initialMainSidebarCollapsed);

    // 初始化移动端视图状态
    const mediaQueryMobile = typeof window !== 'undefined' ? window.matchMedia('(max-width: 1024px)') : null;
    const initialIsMobileView = mediaQueryMobile ? mediaQueryMobile.matches : false;
    // console.log(`[uiStore]('[uiStore] Initial isMobileView state being set:', initialIsMobileView);

    // 初始化文件管理器侧边栏宽度
    let initialFileManagerSidebarWidth = DEFAULT_FM_SIDEBAR_WIDTH;
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedSidebarWidth = localStorage.getItem(FM_SIDEBAR_WIDTH_KEY);
      // console.log(`[uiStore] Raw value from localStorage for ${FM_SIDEBAR_WIDTH_KEY}:`, storedSidebarWidth);
      if (storedSidebarWidth !== null) {
        try {
          const parsedWidth = parseInt(storedSidebarWidth, 10);
          if (!isNaN(parsedWidth) && parsedWidth >= MIN_FM_SIDEBAR_WIDTH && parsedWidth <= MAX_FM_SIDEBAR_WIDTH) {
            initialFileManagerSidebarWidth = parsedWidth;
            // console.log(`[uiStore]('[uiStore] Parsed initialFileManagerSidebarWidth from localStorage:', initialFileManagerSidebarWidth);
          } else {
            console.warn(`[uiStore] Invalid stored sidebar width (${parsedWidth}), removing from localStorage. Defaulting to ${DEFAULT_FM_SIDEBAR_WIDTH}.`);
            localStorage.removeItem(FM_SIDEBAR_WIDTH_KEY); // 移除无效值
            initialFileManagerSidebarWidth = DEFAULT_FM_SIDEBAR_WIDTH;
          }
        } catch (error) {
          console.error('[uiStore] Error parsing stored sidebar width:', error, `Defaulting to ${DEFAULT_FM_SIDEBAR_WIDTH}.`);
          localStorage.removeItem(FM_SIDEBAR_WIDTH_KEY);
          initialFileManagerSidebarWidth = DEFAULT_FM_SIDEBAR_WIDTH;
        }
      } else {
        // console.log(`[uiStore] No ${FM_SIDEBAR_WIDTH_KEY} found in localStorage, defaulting to ${DEFAULT_FM_SIDEBAR_WIDTH}.`);
        initialFileManagerSidebarWidth = DEFAULT_FM_SIDEBAR_WIDTH;
      }
    } else {
      // console.log(`[uiStore] localStorage not available, defaulting sidebar width to ${DEFAULT_FM_SIDEBAR_WIDTH}.`);
      initialFileManagerSidebarWidth = DEFAULT_FM_SIDEBAR_WIDTH;
    }
    // console.log(`[uiStore]('[uiStore] Final initialFileManagerSidebarWidth state being set:', initialFileManagerSidebarWidth);

    // 初始化面板日志高度
    let initialPanelLogHeight = DEFAULT_PANEL_LOG_HEIGHT;
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedHeight = localStorage.getItem(PANEL_LOG_HEIGHT_KEY);
      if (storedHeight !== null) {
        try {
          const parsedHeight = parseInt(storedHeight, 10);
          if (!isNaN(parsedHeight) && parsedHeight >= MIN_PANEL_LOG_HEIGHT) {
            initialPanelLogHeight = parsedHeight;
          } else {
            // 如果值无效，则移除
            localStorage.removeItem(PANEL_LOG_HEIGHT_KEY);
          }
        } catch (error) {
          console.error('[uiStore] Error parsing stored panel log height:', error);
          localStorage.removeItem(PANEL_LOG_HEIGHT_KEY);
        }
      }
    }

    // + 初始化列表视图列宽
    let initialListViewColumnWidths = {};
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedWidths = localStorage.getItem(LIST_VIEW_COLUMN_WIDTHS_KEY);
      if (storedWidths) {
        try {
          initialListViewColumnWidths = JSON.parse(storedWidths);
        } catch (e) {
          console.error('[uiStore] Error parsing stored list view column widths:', e);
          initialListViewColumnWidths = {};
        }
      }
    }

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
      fileManagerSidebarWidth: initialFileManagerSidebarWidth, // 新增
      isMainSidebarCollapsed: initialMainSidebarCollapsed, // 使用从 localStorage 读取的值
      isMobileView: initialIsMobileView, // 使用初始化的值
      panelLogHeight: initialPanelLogHeight, // 新增
      listViewColumnWidths: initialListViewColumnWidths, // 新增
      modalContent: null, // 新增
    };
  },
  actions: {
    // 动态内容模态框
    openModalWithContent(payload: ModalContent) {
      this.modalContent = payload;
    },
    closeModalWithContent() {
      this.modalContent = null;
    },

    setupMobileViewListener() {
      if (typeof window !== 'undefined') {
        const mediaQueryMobile = window.matchMedia('(max-width: 1024px)');
        // 初始设置
        this.isMobileView = mediaQueryMobile.matches;
        // 添加监听器
        mediaQueryMobile.addEventListener('change', (e) => {
          this.isMobileView = e.matches;
          // console.log('[uiStore] isMobileView changed by listener:', this.isMobileView); // 移除频繁触发的日志
        });
      }
    },

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
          // // console.log(`[uiStore] Saved to localStorage (${FM_DETAIL_PANEL_OPEN}):`, isOpen); // 移除常规保存日志
        } catch (error) {
          console.error('[uiStore] Error saving detail panel state to localStorage:', error);
        }
      } else {
        console.warn('[uiStore] localStorage not available, cannot save detail panel state.');
      }
    },
    openFileManagerDetailPanel() {
      // console.log('[uiStore] openFileManagerDetailPanel called. Current state:', this.isFileManagerDetailPanelOpen); // 移除
      if (!this.isFileManagerDetailPanelOpen) {
        this.isFileManagerDetailPanelOpen = true;
        this._saveDetailPanelState(true);
        // console.log('[uiStore] Detail panel opened. New state:', this.isFileManagerDetailPanelOpen); // 移除
      } else {
        // console.log('[uiStore] Detail panel already open.'); // 移除
      }
      // TODO: 可以考虑在这里检查是否有选中项，并通知 fileManagerStore 更新 selectedItemForDetail
    },
    closeFileManagerDetailPanel() {
      // console.log('[uiStore] closeFileManagerDetailPanel called. Current state:', this.isFileManagerDetailPanelOpen); // 移除
      if (this.isFileManagerDetailPanelOpen) {
        this.isFileManagerDetailPanelOpen = false;
        this._saveDetailPanelState(false);
        // console.log('[uiStore] Detail panel closed. New state:', this.isFileManagerDetailPanelOpen); // 移除
      } else {
        // console.log('[uiStore] Detail panel already closed.'); // 移除
      }
    },
    toggleFileManagerDetailPanel(isOpen?: boolean) {
      const newState = typeof isOpen === 'boolean' ? isOpen : !this.isFileManagerDetailPanelOpen;
      // // console.log(`[uiStore] toggleFileManagerDetailPanel called with isOpen: ${isOpen}. Current state: ${this.isFileManagerDetailPanelOpen}. New target state: ${newState}`); // 移除
      if (this.isFileManagerDetailPanelOpen !== newState) {
        this.isFileManagerDetailPanelOpen = newState;
        this._saveDetailPanelState(newState);
        // console.log('[uiStore] Detail panel toggled. New state:', this.isFileManagerDetailPanelOpen); // 移除
      } else {
        // console.log('[uiStore] Detail panel state unchanged by toggle.'); // 移除
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
    _saveFileManagerSidebarState(collapsed: boolean) { // 重命名以区分宽度保存
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(FM_SIDEBAR_COLLAPSED, JSON.stringify(collapsed));
          // // console.log(`[uiStore] Saved to localStorage (${FM_SIDEBAR_COLLAPSED}):`, collapsed); // 移除常规保存日志
        } catch (error) {
          console.error('[uiStore] Error saving sidebar collapsed state to localStorage:', error);
        }
      } else {
        console.warn('[uiStore] localStorage not available, cannot save sidebar collapsed state.');
      }
    },
    toggleFileManagerSidebar() {
      // // console.log(`[uiStore] toggleFileManagerSidebar called. Current state: ${this.isFileManagerSidebarCollapsed}`); // 移除
      this.isFileManagerSidebarCollapsed = !this.isFileManagerSidebarCollapsed;
      this._saveFileManagerSidebarState(this.isFileManagerSidebarCollapsed);
      // // console.log(`[uiStore] Sidebar collapsed toggled. New state: ${this.isFileManagerSidebarCollapsed}`); // 移除
    },
    setFileManagerSidebarCollapsed(collapsed: boolean) {
      // // console.log(`[uiStore] setFileManagerSidebarCollapsed called with: ${collapsed}. Current state: ${this.isFileManagerSidebarCollapsed}`); // 移除
      if (this.isFileManagerSidebarCollapsed !== collapsed) {
        this.isFileManagerSidebarCollapsed = collapsed;
        this._saveFileManagerSidebarState(this.isFileManagerSidebarCollapsed);
        // // console.log(`[uiStore] Sidebar collapsed set. New state: ${this.isFileManagerSidebarCollapsed}`); // 移除
      }
    },

    // 新增：文件管理器侧边栏宽度 Actions
    _saveFileManagerSidebarWidth(width: number) {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(FM_SIDEBAR_WIDTH_KEY, width.toString());
          // console.log(`[uiStore] Saved sidebar width to localStorage (${FM_SIDEBAR_WIDTH_KEY}):`, width);
        } catch (error) {
          console.error('[uiStore] Error saving sidebar width to localStorage:', error);
        }
      } else {
        console.warn('[uiStore] localStorage not available, cannot save sidebar width.');
      }
    },
    setFileManagerSidebarWidth(width: number) {
      const newWidth = Math.max(MIN_FM_SIDEBAR_WIDTH, Math.min(width, MAX_FM_SIDEBAR_WIDTH));
      if (this.fileManagerSidebarWidth !== newWidth) {
        this.fileManagerSidebarWidth = newWidth;
        // 不再直接保存到 localStorage，仅更新状态
        // console.log('[uiStore] Sidebar width updated in store. New width:', this.fileManagerSidebarWidth); // 移除这条过于频繁的日志
      }
    },
    persistFileManagerSidebarWidth() {
      this._saveFileManagerSidebarWidth(this.fileManagerSidebarWidth);
      // 这条日志在操作结束时打印，是合理的
      // console.log(`[uiStore]('[uiStore] Sidebar width persisted to localStorage.');
    },
    resetFileManagerSidebarWidth() {
      if (this.fileManagerSidebarWidth !== DEFAULT_FM_SIDEBAR_WIDTH) {
        this.fileManagerSidebarWidth = DEFAULT_FM_SIDEBAR_WIDTH;
        this._saveFileManagerSidebarWidth(DEFAULT_FM_SIDEBAR_WIDTH); // 重置操作通常希望立即持久化
        // console.log(`[uiStore]('[uiStore] Sidebar width reset to default and persisted.');
      }
    },

    // 主侧边栏 Actions
    _saveMainSidebarState(collapsed: boolean) {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(MAIN_SIDEBAR_COLLAPSED, JSON.stringify(collapsed));
          // // console.log(`[uiStore] Saved to localStorage (${MAIN_SIDEBAR_COLLAPSED}):`, collapsed); // 移除常规保存日志
        } catch (error) {
          console.error('[uiStore] Error saving main sidebar state to localStorage:', error);
        }
      } else {
        console.warn('[uiStore] localStorage not available, cannot save main sidebar state.');
      }
    },
    toggleMainSidebar() {
      // // console.log(`[uiStore] toggleMainSidebar called. Current state: ${this.isMainSidebarCollapsed}`); // 移除
      this.isMainSidebarCollapsed = !this.isMainSidebarCollapsed;
      this._saveMainSidebarState(this.isMainSidebarCollapsed);
      // // console.log(`[uiStore] Main sidebar collapsed toggled. New state: ${this.isMainSidebarCollapsed}`); // 移除
    },
    setMainSidebarCollapsed(collapsed: boolean) {
      // // console.log(`[uiStore] setMainSidebarCollapsed called with: ${collapsed}. Current state: ${this.isMainSidebarCollapsed}`); // 移除
      if (this.isMainSidebarCollapsed !== collapsed) {
        this.isMainSidebarCollapsed = collapsed;
        this._saveMainSidebarState(this.isMainSidebarCollapsed);
        // // console.log(`[uiStore] Main sidebar collapsed set. New state: ${this.isMainSidebarCollapsed}`); // 移除
      }
    },

    // 面板日志高度 Actions
    _savePanelLogHeight(height: number) {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(PANEL_LOG_HEIGHT_KEY, height.toString());
        } catch (error) {
          console.error('[uiStore] Error saving panel log height to localStorage:', error);
        }
      }
    },
    setPanelLogHeight(height: number) {
      // 限制最小和最大高度，与 PanelContainer.vue 中的逻辑保持一致
      const newHeight = Math.max(MIN_PANEL_LOG_HEIGHT, Math.min(height, window.innerHeight * 0.9));
      if (this.panelLogHeight !== newHeight) {
        this.panelLogHeight = newHeight;
      }
    },
    persistPanelLogHeight() {
      this._savePanelLogHeight(this.panelLogHeight);
    },
    resetPanelLogHeight() {
      if (this.panelLogHeight !== DEFAULT_PANEL_LOG_HEIGHT) {
        this.panelLogHeight = DEFAULT_PANEL_LOG_HEIGHT;
        this._savePanelLogHeight(DEFAULT_PANEL_LOG_HEIGHT);
      }
    },

    // 新增：列表视图列宽 Actions
    _saveListViewColumnWidths() {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(LIST_VIEW_COLUMN_WIDTHS_KEY, JSON.stringify(this.listViewColumnWidths));
        } catch (error) {
          console.error('[uiStore] Error saving list view column widths to localStorage:', error);
        }
      }
    },
    setListViewColumnWidth(viewId: string, columnId: string, width: number) {
      if (!this.listViewColumnWidths[viewId]) {
        this.listViewColumnWidths[viewId] = {};
      }
      this.listViewColumnWidths[viewId][columnId] = width;
      // 每次变更都直接保存，如果性能敏感可以改为节流或手动触发
      this._saveListViewColumnWidths();
    },
    getListViewColumnWidths(viewId: string): { [columnId: string]: number } {
      return this.listViewColumnWidths[viewId] || {};
    },
  },
});