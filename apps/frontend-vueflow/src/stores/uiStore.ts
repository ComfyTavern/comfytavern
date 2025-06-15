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

  // 新增：主侧边栏折叠状态
  isMainSidebarCollapsed: boolean;
  // 新增：是否为移动端视图
  isMobileView: boolean;
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
const MAIN_SIDEBAR_COLLAPSED = 'main_sidebar_collapsed'; // 新增：主侧边栏 localStorage key

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

    // 初始化主侧边栏状态
    let initialMainSidebarCollapsed = false; // 默认值
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedMainSidebarState = localStorage.getItem(MAIN_SIDEBAR_COLLAPSED);
      console.log(`[uiStore] Raw value from localStorage for ${MAIN_SIDEBAR_COLLAPSED}:`, storedMainSidebarState);
      if (storedMainSidebarState !== null) {
        try {
          initialMainSidebarCollapsed = JSON.parse(storedMainSidebarState);
          console.log('[uiStore] Parsed initialMainSidebarCollapsed from localStorage:', initialMainSidebarCollapsed);
        } catch (error) {
          console.error('[uiStore] Error parsing stored main sidebar state:', error, `Defaulting to false.`);
          initialMainSidebarCollapsed = false;
        }
      } else {
        console.log(`[uiStore] No ${MAIN_SIDEBAR_COLLAPSED} found in localStorage, defaulting to false.`);
        initialMainSidebarCollapsed = false; // 明确默认值
      }
    } else {
      console.log('[uiStore] localStorage not available, defaulting main sidebar to false.');
      initialMainSidebarCollapsed = false;
    }
    console.log('[uiStore] Final initialMainSidebarCollapsed state being set:', initialMainSidebarCollapsed);

    // 初始化移动端视图状态
    const mediaQueryMobile = typeof window !== 'undefined' ? window.matchMedia('(max-width: 1024px)') : null;
    const initialIsMobileView = mediaQueryMobile ? mediaQueryMobile.matches : false;
    console.log('[uiStore] Initial isMobileView state being set:', initialIsMobileView);


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
      isMainSidebarCollapsed: initialMainSidebarCollapsed, // 使用从 localStorage 读取的值
      isMobileView: initialIsMobileView, // 使用初始化的值
    };
  },
  actions: {
    // 在 actions 中定义一个方法来初始化媒体查询监听器，或者在 state 函数外部执行，确保只执行一次
    // Pinia store 的 state 函数在 store 第一次被使用时执行一次。
    // 我们可以在 state 函数返回的对象之后，但在 defineStore 的 actions/getters 之前设置监听器。
    // 或者，更符合 Pinia 模式的做法是在 action 中处理，但需要确保这个 action 在应用初始化时被调用。
    // 一个更简单的方式是直接在 state 函数中设置，因为它只运行一次。

    // 为了确保响应性，isMobileView 应该是一个 ref，或者在 state 中直接更新。
    // Pinia 的 state 属性本身就是响应式的。

    // 媒体查询监听器应该在 state 函数内部设置，以确保在 store 初始化时正确设置。
    // Pinia 会处理 state 属性的响应性。
    // 我们需要在 state 函数中添加监听器逻辑，或者在 store 创建后立即调用的 action 中添加。
    // 考虑到 state 函数只执行一次，在那里设置监听器是合适的。
    // (上面的 initialIsMobileView 已经处理了初始值，现在需要添加监听器)

    // Pinia 推荐在 action 中处理副作用，但对于这种全局监听器，
    // 且其目的是更新 store 的 state，在 store 初始化时设置是可以接受的。
    // 我们将把监听器设置逻辑移到 state 函数之后，或者通过一个初始化 action。
    // 让我们尝试在 state 函数中直接设置，如果 Pinia 的设计允许这样做并保持清晰。
    // Pinia 的 state 是一个函数，它返回初始状态对象。我们不能直接在 state 函数内部修改 this。
    // 因此，一个常见的模式是创建一个 action 来进行初始化。

    // 修正：将监听器设置移至 actions 中，并确保它在应用启动时被调用一次。
    // 或者，更简单地，在 state 函数中创建 ref 并返回，然后在外部（例如 App.vue）监听。
    // 但为了 store 的内聚性，我们尝试在 store 内部完成。

    // 让我们调整 state 的初始化，使其包含监听器逻辑，并确保 this 的正确性。
    // Pinia state 是一个返回对象的函数，我们不能在其中直接使用 this 来调用 actions 或修改其他 state。
    // 最好的方式是在 store 创建后，通过一个 action 来设置监听器。
    // 但为了简单起见，并且因为 state 函数只执行一次，我们可以直接在 state 函数中设置监听器来更新一个 ref，
    // 然后将这个 ref 作为 state 的一部分。不过 Pinia 的 state 属性已经是响应式的。

    // 再次思考：Pinia 的 state 属性已经是响应式的。
    // 我们可以在 state 函数中设置 initialIsMobileView。
    // 然后，我们需要一个地方来添加事件监听器以在运行时更新 isMobileView。
    // 这通常通过一个 action 完成，该 action 在应用加载时被调用。

    // 让我们在 actions 中添加一个 setupMobileViewListener action。
    setupMobileViewListener() {
      if (typeof window !== 'undefined') {
        const mediaQueryMobile = window.matchMedia('(max-width: 1024px)');
        // 初始设置
        this.isMobileView = mediaQueryMobile.matches;
        // 添加监听器
        mediaQueryMobile.addEventListener('change', (e) => {
          this.isMobileView = e.matches;
          console.log('[uiStore] isMobileView changed by listener:', this.isMobileView);
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

    // 主侧边栏 Actions
    _saveMainSidebarState(collapsed: boolean) {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(MAIN_SIDEBAR_COLLAPSED, JSON.stringify(collapsed));
          console.log(`[uiStore] Saved to localStorage (${MAIN_SIDEBAR_COLLAPSED}):`, collapsed);
        } catch (error) {
          console.error('[uiStore] Error saving main sidebar state to localStorage:', error);
        }
      } else {
        console.warn('[uiStore] localStorage not available, cannot save main sidebar state.');
      }
    },
    toggleMainSidebar() {
      console.log(`[uiStore] toggleMainSidebar called. Current state: ${this.isMainSidebarCollapsed}`);
      this.isMainSidebarCollapsed = !this.isMainSidebarCollapsed;
      this._saveMainSidebarState(this.isMainSidebarCollapsed);
      console.log(`[uiStore] Main sidebar collapsed toggled. New state: ${this.isMainSidebarCollapsed}`);
    },
    setMainSidebarCollapsed(collapsed: boolean) {
      console.log(`[uiStore] setMainSidebarCollapsed called with: ${collapsed}. Current state: ${this.isMainSidebarCollapsed}`);
      if (this.isMainSidebarCollapsed !== collapsed) {
        this.isMainSidebarCollapsed = collapsed;
        this._saveMainSidebarState(this.isMainSidebarCollapsed);
        console.log(`[uiStore] Main sidebar collapsed set. New state: ${this.isMainSidebarCollapsed}`);
      }
    },
  },
});