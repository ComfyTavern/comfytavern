// apps/frontend-vueflow/src/stores/fileManagerStore.ts
import { defineStore } from 'pinia';
import * as fileManagerApi from '@/api/fileManagerApi';
import { FAMItemsSchema, type FAMItem } from '@comfytavern/types'; // 导入统一类型和 Schema
import { useDialogService } from '@/services/DialogService'; // 导入对话框服务
import i18n from '@/locales';
import { useUiStore } from './uiStore';
import UploadManagerModal from '@/components/file-manager/modals/UploadManagerModal.vue';


export interface RecentAccessItem {
  logicalPath: string;
  accessTime: number; // 时间戳
  itemType: 'file' | 'directory';
  displayName: string; // 用于显示，通常是文件名或目录名
}

export interface FilterOptions {
  namePattern: string; // 文件名搜索模式/关键词
  itemType?: '' | 'file' | 'directory'; // 新增：按项目类型筛选
  fileTypes: string[]; // 选择的文件扩展名 (e.g., ['.txt', '.jpg']) - 主要用于文件类型
  sizeRange: [number, number] | null; // 文件大小范围 (字节) [min, max]
  dateRange: [Date, Date] | null; // 修改日期范围 [startDate, endDate]
  showHiddenFiles: boolean; // 是否显示隐藏文件 (如果后端支持)
}

export interface ViewSettings {
  mode: 'list' | 'grid'; // 视图模式
  sortField: keyof FAMItem | 'name' | 'size' | 'lastModified' | 'itemType' | 'extension'; // 排序字段, FAMItem 替换 ZodValidatedFAMListItem, 新增 extension
  sortDirection: 'asc' | 'desc'; // 排序方向
  visibleColumns: Array<keyof FAMItem | string>; // 列表视图下可见的列, FAMItem 替换 ZodValidatedFAMListItem
  thumbnailSize: 'small' | 'medium' | 'large'; // 网格视图缩略图大小
  informationDensity: 'compact' | 'comfortable' | 'spacious'; // 信息密度
  gridItemSize: number; // 网格视图项目大小
}

export interface FileManagerState {
  currentLogicalPath: string;
  currentUserId: string | null; // 从 authStore 获取并初始化
  items: FAMItem[]; // 当前路径下的原始条目列表
  filteredItems: FAMItem[]; // 经过筛选和排序后的条目列表
  selectedItemPaths: string[]; // 选中条目的 logicalPath 数组
  isLoading: boolean;
  error: any | null; // API 请求错误信息
  rootNavigationItems: { label: string; logicalPath: string; icon?: string }[]; // 左侧导航根路径
  clipboard: { action: 'copy' | 'cut'; sourcePaths: string[] } | null; //剪贴板

  // 最近访问相关
  recentAccessItems: RecentAccessItem[];
  maxRecentAccessItems: number; // 最大记录数

  // 筛选和搜索
  filterOptions: FilterOptions;
  isFilterActive: boolean;

  // 视图设置
  viewSettings: ViewSettings;

  // 用于右侧/底部详情面板
  // isDetailPanelVisible: boolean; // 将移至 uiStore 控制
  detailPanelActiveTab: 'properties' | 'preview' | 'actions' | null; // 'actions' 可能是未来扩展
  selectedItemForDetail: FAMItem | null; // 当前详情面板显示的项目

  // 收藏夹路径
  favoritesPaths: string[];
}

const DEFAULT_MAX_RECENT_ACCESS = 50;

export const useFileManagerStore = defineStore('fileManager', {
  state: (): FileManagerState => ({
    currentLogicalPath: '', // 需要初始化
    currentUserId: null,
    items: [],
    filteredItems: [],
    selectedItemPaths: [],
    isLoading: false,
    error: null,
    rootNavigationItems: [ // 初始可以为空，由 initialize 或配置加载
      { label: 'My Files', logicalPath: 'user://', icon: 'UserIcon' }, // icon 是示例, label 会在 initialize 中被覆盖
      { label: 'Shared Space', logicalPath: 'shared://', icon: 'UsersIcon' },
      // system:// 通常不直接暴露给普通用户浏览，除非特定场景
    ],
    clipboard: null,
    recentAccessItems: [],
    maxRecentAccessItems: DEFAULT_MAX_RECENT_ACCESS,
    filterOptions: {
      namePattern: '',
      itemType: '', // 初始化新增字段
      fileTypes: [],
      sizeRange: null,
      dateRange: null,
      showHiddenFiles: false,
    },
    isFilterActive: false,
    viewSettings: {
      mode: 'list',
      sortField: 'name',
      sortDirection: 'asc',
      visibleColumns: ['name', 'size', 'lastModified', 'itemType'], // 默认显示列
      thumbnailSize: 'medium',
      informationDensity: 'comfortable',
      gridItemSize: 96, // 新增：默认网格项目大小
    },
    // isDetailPanelVisible: false, // 移至 uiStore
    detailPanelActiveTab: null,
    selectedItemForDetail: null,
    favoritesPaths: [], // 从用户配置加载
  }),

  getters: {
    currentUserRootPath(state): string | null {
      if (!state.currentUserId) return null;
      // 简单示例，实际可能更复杂或固定为 'user://'
      return `user://${state.currentUserId}/`;
    },
    selectedItems(state): FAMItem[] {
      return state.items.filter((item: FAMItem) => state.selectedItemPaths.includes(item.logicalPath));
    },
    breadcrumbsSegments(state): { label: string; path: string }[] {
      if (!state.currentLogicalPath) return [];
      const segments = state.currentLogicalPath.replace(/\/$/, '').split('/');
      let currentPath = '';
      const breadcrumbs: { label: string; path: string }[] = [];

      // 处理根路径 "user://" "shared://" 等
      if (segments.length > 0 && segments[0] && segments[0].endsWith(':')) { // 确保 segments[0] 存在
        const rootLabel = segments[0]; // e.g., "user:"
        currentPath = `${rootLabel}//`;
        // 确保 label 是 string
        const foundRootLabel = state.rootNavigationItems.find(r => r.logicalPath === currentPath)?.label;
        breadcrumbs.push({ label: foundRootLabel ?? rootLabel, path: currentPath });
        segments.shift(); // 移除根协议部分
        if (segments.length > 0 && segments[0] === '') segments.shift(); // 移除根协议后的空字符串
      }


      for (const segment of segments) {
        if (!segment) continue; // 避免空路径段
        currentPath += `${segment}/`;
        breadcrumbs.push({ label: segment, path: currentPath });
      }
      return breadcrumbs;
    },
    recentAccessItemsSorted(state): RecentAccessItem[] {
      return [...state.recentAccessItems].sort((a, b) => b.accessTime - a.accessTime);
    },
    availableFileTypes(state): string[] {
      const types = new Set<string>();
      state.items.forEach((item: FAMItem) => {
        if (item.itemType === 'file' && item.name.includes('.')) {
          const ext = item.name.substring(item.name.lastIndexOf('.')).toLowerCase();
          if (ext) types.add(ext);
        }
      });
      return Array.from(types).sort();
    },
    activeFiltersCount(state): number {
      let count = 0;
      if (state.filterOptions.namePattern) count++;
      if (state.filterOptions.itemType) count++; // 计入 itemType 筛选
      if (state.filterOptions.fileTypes.length > 0) count++;
      if (state.filterOptions.sizeRange) count++;
      if (state.filterOptions.dateRange) count++;
      if (state.filterOptions.showHiddenFiles) count++;
      return count;
    },
  },

  actions: {
    // --- 初始化与导航 ---
    initialize(userId: string | null, initialPath?: string) {
      this.currentUserId = userId;
      // TODO: 从本地存储加载用户偏好，如 favoritesPaths, viewSettings, recentAccessItems
      // this.loadUserPreferences();

      const pathToGo = initialPath || (userId ? `user://` : 'shared://'); // 默认路径
      this.navigateTo(pathToGo);

      // 示例：如果 currentUserId 存在，可以动态设置 rootNavigationItems
      if (userId) {
        this.rootNavigationItems = [
          { label: i18n.global.t('fileManager.store.myFiles'), logicalPath: `user://`, icon: 'UserIcon' },
          { label: i18n.global.t('fileManager.store.sharedSpace'), logicalPath: 'shared://', icon: 'UsersIcon' },
        ];
      } else {
        this.rootNavigationItems = [
          { label: i18n.global.t('fileManager.store.sharedSpace'), logicalPath: 'shared://', icon: 'UsersIcon' },
        ];
      }
    },

    async navigateTo(logicalPath: string) {
      if (this.isLoading) return;
      this.currentLogicalPath = logicalPath;
      this.selectedItemPaths = []; // 清除选择
      this.selectedItemForDetail = null;
      // this.isDetailPanelVisible = false; // 导航时可以考虑隐藏详情
      await this.fetchItems();
      // 导航成功后添加到最近访问
      const itemType = logicalPath.endsWith('/') ? 'directory' : 'file'; // 简单判断
      const displayName = logicalPath.split('/').filter(Boolean).pop() || logicalPath;
      this.addToRecentAccess(logicalPath, itemType, displayName);
    },

    goUp() {
      if (this.currentLogicalPath.endsWith('//')) return; // 已经是根路径
      const segments = this.currentLogicalPath.replace(/\/$/, '').split('/');
      if (segments.length <= (this.currentLogicalPath.includes('://') ? 1 : 0)) return; // 防止切到根协议之外

      segments.pop();
      let parentPath = segments.join('/');
      if (!parentPath.endsWith('//') && parentPath !== '') {
        parentPath += '/';
      } else if (parentPath.endsWith(':')) { // e.g. "user:"
        parentPath += '//';
      }
      if (parentPath) {
        this.navigateTo(parentPath);
      }
    },

    async fetchItems() {
      if (!this.currentLogicalPath) return;
      this.isLoading = true;
      this.error = null;
      try {
        const items: FAMItem[] = await fileManagerApi.listDir(this.currentLogicalPath); // listDir 现在返回 FAMItem[]
        console.log('[FileManagerStore.fetchItems] Raw items from API for path', this.currentLogicalPath, ':', JSON.parse(JSON.stringify(items)));
        const libraryItem = items.find((it: FAMItem) => it.name === 'library');
        const projectsItem = items.find((it: FAMItem) => it.name === 'projects');
        if (libraryItem) {
          console.log(`[FileManagerStore.fetchItems] 'library' item from API: name=${libraryItem.name}, itemType=${libraryItem.itemType}, logicalPath=${libraryItem.logicalPath}`);
        }
        if (projectsItem) {
          console.log(`[FileManagerStore.fetchItems] 'projects' item from API: name=${projectsItem.name}, itemType=${projectsItem.itemType}, logicalPath=${projectsItem.logicalPath}`);
        }
        try {
          this.items = FAMItemsSchema.parse(items); // 使用 Zod schema 验证和解析
        } catch (zodError: any) { // Catch ZodError
          console.error('[FileManagerStore.fetchItems] Zod validation failed for API response:', zodError.errors);
          this.error = zodError.errors; // Store Zod errors
          this.items = []; // 验证失败则清空
        }
        this.applyFiltersAndSort();
      } catch (err) {
        this.error = err;
        this.items = [];
        this.filteredItems = [];
        // 使用 DialogService 显示错误
        const dialogService = useDialogService();
        dialogService.showError(i18n.global.t('fileManager.store.errors.loadFailed', { error: (err as Error).message || i18n.global.t('fileManager.store.errors.unknown') }));
      } finally {
        this.isLoading = false;
      }
    },

    // --- 文件/目录操作 ---
    async createDirectory(name?: string) {
      const dialogService = useDialogService();
      const dirName = name || await dialogService.showInput({
        title: i18n.global.t('fileManager.store.createDirectory.title'),
        inputPlaceholder: i18n.global.t('fileManager.store.createDirectory.placeholder'),
        // TODO: 添加验证规则，例如不允许特殊字符
      });

      if (dirName) {
        this.isLoading = true;
        try {
          await fileManagerApi.createDir(this.currentLogicalPath, dirName);
          dialogService.showSuccess(i18n.global.t('fileManager.store.createDirectory.success', { dirName }));
          await this.fetchItems(); // 刷新列表
        } catch (err) {
          this.error = err;
          dialogService.showError(i18n.global.t('fileManager.store.createDirectory.error', { error: (err as Error).message }));
        } finally {
          this.isLoading = false;
        }
      }
    },


    async renameItem(itemToRename: FAMItem, newName?: string) {
      const dialogService = useDialogService();
      const itemTypeLabel = i18n.global.t(itemToRename.itemType === 'directory' ? 'common.folder' : 'common.file');
      const finalNewName = newName || await dialogService.showInput({
        title: i18n.global.t('fileManager.store.rename.title', { itemType: itemTypeLabel }),
        initialValue: itemToRename.name,
        inputPlaceholder: i18n.global.t('fileManager.store.rename.placeholder'),
      });

      if (finalNewName && finalNewName !== itemToRename.name) {
        this.isLoading = true;
        try {
          await fileManagerApi.renameFileOrDir(itemToRename.logicalPath, finalNewName);
          dialogService.showSuccess(i18n.global.t('fileManager.store.rename.success', { newName: finalNewName }));
          // 更新选中项和详情（如果被重命名的项是当前选中的）
          if (this.selectedItemForDetail?.logicalPath === itemToRename.logicalPath) {
            const updatedItem = { ...this.selectedItemForDetail, name: finalNewName, logicalPath: itemToRename.logicalPath.substring(0, itemToRename.logicalPath.lastIndexOf('/') + 1) + finalNewName };
            this.selectedItemForDetail = updatedItem as FAMItem; // 类型更新
          }
          this.selectedItemPaths = this.selectedItemPaths.map(p => p === itemToRename.logicalPath ? (itemToRename.logicalPath.substring(0, itemToRename.logicalPath.lastIndexOf('/') + 1) + finalNewName) : p);

          await this.fetchItems(); // 刷新列表
        } catch (err: any) { // Restored catch block
          this.error = err;
          dialogService.showError(i18n.global.t('fileManager.store.rename.error', { error: (err as Error).message }));
        } finally {
          this.isLoading = false;
        }
      }
    },

    async deleteItems(itemsToDelete?: FAMItem[]) {
      const items = itemsToDelete || this.selectedItems;
      if (items.length === 0) return;

      const dialogService = useDialogService();
      const confirmed = await dialogService.showConfirm({
        title: i18n.global.t('fileManager.store.delete.title'),
        message: i18n.global.t('fileManager.store.delete.message', { count: items.length }),
        dangerConfirm: true,
        confirmText: i18n.global.t('fileManager.store.delete.confirmText'),
      });

      if (confirmed) {
        this.isLoading = true;
        try {
          const pathsToDelete = items.map(item => item.logicalPath);
          await fileManagerApi.deleteFilesOrDirs(pathsToDelete);
          dialogService.showSuccess(i18n.global.t('fileManager.store.delete.success', { count: items.length }));
          this.clearSelection(); // 删除后清除选择
          await this.fetchItems(); // 刷新列表
        } catch (err) {
          this.error = err;
          dialogService.showError(i18n.global.t('fileManager.store.delete.error', { error: (err as Error).message }));
        } finally {
          this.isLoading = false;
        }
      }
    },

    async moveItems(itemsToMove: FAMItem[], targetParentPath: string) {
      if (itemsToMove.length === 0 || !targetParentPath) return;
      this.isLoading = true;
      const dialogService = useDialogService();
      try {
        const sourcePaths = itemsToMove.map(item => item.logicalPath);
        await fileManagerApi.moveFilesOrDirs(sourcePaths, targetParentPath);
        dialogService.showSuccess(i18n.global.t('fileManager.store.move.success', { count: itemsToMove.length }));
        this.clearSelection();
        await this.fetchItems(); // 刷新当前目录
        // TODO: 可能需要导航到 targetParentPath 或刷新来源目录（如果不同）
      } catch (err) {
        this.error = err;
        dialogService.showError(i18n.global.t('fileManager.store.move.error', { error: (err as Error).message }));
      } finally {
        this.isLoading = false;
      }
    },

    async downloadFile(item: FAMItem) {
      if (item.itemType === 'directory') {
        // TODO: 支持下载文件夹 (可能需要后端压缩)
        useDialogService().showInfo(i18n.global.t('fileManager.store.download.noFolderSupport'));
        return;
      }
      try {
        const downloadLink = await fileManagerApi.getDownloadFileLink(item.logicalPath);
        // 创建一个隐藏的 a 标签来触发下载
        const anchor = document.createElement('a');
        anchor.href = downloadLink;
        anchor.download = item.name; // 设置下载的文件名
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      } catch (err) {
        useDialogService().showError(i18n.global.t('fileManager.store.download.error', { error: (err as Error).message }));
      }
    },

    // --- 选择处理 ---
    setSelectedItemPaths(paths: string[]) {
      this.selectedItemPaths = paths;
      if (paths.length > 0) {
        // 优先从 filteredItems 中查找，因为用户看到的是这个列表
        const firstSelectedItem = this.filteredItems.find((item: FAMItem) => item.logicalPath === paths[0]) || this.items.find((item: FAMItem) => item.logicalPath === paths[0]);
        this.selectedItemForDetail = firstSelectedItem || null;

        // 面板的可见性由 uiStore 控制，这里只负责更新内容和可能的默认 tab
        if (firstSelectedItem) {
          // const uiStore = useUiStore(); // 避免在 action 内部直接 useStore，如果需要交互，应通过参数或更高级模式
          // if (uiStore.isFileManagerDetailPanelOpen && !this.detailPanelActiveTab) {
          //   this.detailPanelActiveTab = 'properties';
          // }
          // 决定是否在选中时自动设置 tab 的逻辑可以放在组件层面或保留当前逻辑
           if (!this.detailPanelActiveTab) { // 如果面板已打开但没有tab，或者即将因选中而关注，则设置默认tab
             this.detailPanelActiveTab = 'properties';
           }
        } else {
          this.selectedItemForDetail = null; // 确保清除
          this.detailPanelActiveTab = null; // 清除 tab
        }
      } else {
        this.selectedItemForDetail = null;
        this.detailPanelActiveTab = null;
      }
    },

    clearSelection() {
      this.selectedItemPaths = [];
      this.selectedItemForDetail = null;
      // this.isDetailPanelVisible = false; // 由 uiStore 控制
      this.detailPanelActiveTab = null;
    },

    // --- 剪贴板 ---
    copyToClipboard(items?: FAMItem[]) {
      const itemsToCopy = items || this.selectedItems;
      if (itemsToCopy.length > 0) {
        this.clipboard = { action: 'copy', sourcePaths: itemsToCopy.map(item => item.logicalPath) };
        useDialogService().showToast({ message: i18n.global.t('fileManager.store.clipboard.copied', { count: itemsToCopy.length }), type: 'info' });
      }
    },
    cutToClipboard(items?: FAMItem[]) {
      const itemsToCut = items || this.selectedItems;
      if (itemsToCut.length > 0) {
        this.clipboard = { action: 'cut', sourcePaths: itemsToCut.map(item => item.logicalPath) };
        useDialogService().showToast({ message: i18n.global.t('fileManager.store.clipboard.cut', { count: itemsToCut.length }), type: 'info' });
      }
    },
    async pasteFromClipboard() {
      if (!this.clipboard || this.clipboard.sourcePaths.length === 0) return;

      const { action, sourcePaths } = this.clipboard;
      const targetParentPath = this.currentLogicalPath;
      const dialogService = useDialogService();

      // 防止粘贴到自身或其子目录 (对于移动操作)
      if (action === 'cut') {
        for (const sourcePath of sourcePaths) {
          if (targetParentPath.startsWith(sourcePath) && sourcePath !== targetParentPath) {
            dialogService.showError(i18n.global.t('fileManager.store.paste.errorMoveIntoSelf'));
            return;
          }
          if (sourcePath.substring(0, sourcePath.lastIndexOf('/') + 1) === targetParentPath) {
            dialogService.showInfo(i18n.global.t('fileManager.store.paste.alreadyAtTarget'));
            this.clipboard = null; // 清空剪贴板
            return;
          }
        }
      }

      this.isLoading = true;
      try {
        if (action === 'copy') {
          // TODO: 实现 fileManagerApi.copyFilesOrDirs(sourcePaths, targetParentPath)
          // 假设 API 存在
          // await fileManagerApi.copyFilesOrDirs(sourcePaths, targetParentPath);
          dialogService.showInfo(i18n.global.t('fileManager.store.paste.copyNotImplemented')); // 临时
        } else if (action === 'cut') {
          await fileManagerApi.moveFilesOrDirs(sourcePaths, targetParentPath);
          dialogService.showSuccess(i18n.global.t('fileManager.store.paste.moveSuccess', { count: sourcePaths.length }));
        }
        this.clipboard = null; // 操作后清空剪贴板
        await this.fetchItems();
      } catch (err) {
        this.error = err;
        dialogService.showError(i18n.global.t('fileManager.store.paste.error', { error: (err as Error).message }));
      } finally {
        this.isLoading = false;
      }
    },

    // --- 详情面板控制 ---
    // toggleDetailPanel action 已移除，由 uiStore 控制

    setDetailPanelTab(tab: 'properties' | 'preview' | 'actions' | null) {
      this.detailPanelActiveTab = tab;
      // 面板的可见性由 uiStore 控制，此处不再根据 tab 设置来强制打开面板
      // 如果需要这种行为（例如点击预览tab时自动打开面板），应在调用此action的地方配合调用 uiStore.openFileManagerDetailPanel()
    },

    // --- 最近访问 ---
    addToRecentAccess(logicalPath: string, itemType: 'file' | 'directory', displayName: string) {
      const now = Date.now();
      // 移除已存在的相同路径，以更新其访问时间并移到最前
      this.recentAccessItems = this.recentAccessItems.filter(item => item.logicalPath !== logicalPath);
      this.recentAccessItems.unshift({ logicalPath, accessTime: now, itemType, displayName });
      // 保持列表不超过最大长度
      if (this.recentAccessItems.length > this.maxRecentAccessItems) {
        this.recentAccessItems.splice(this.maxRecentAccessItems);
      }
      // TODO: 持久化 recentAccessItems
    },
    clearRecentAccess() {
      this.recentAccessItems = [];
      // TODO: 持久化
    },

    // --- 收藏夹 ---
    addToFavorites(logicalPath: string) {
      if (!this.favoritesPaths.includes(logicalPath)) {
        this.favoritesPaths.push(logicalPath);
        // TODO: 持久化
        useDialogService().showSuccess(i18n.global.t('fileManager.store.favorites.added'));
      }
    },
    removeFromFavorites(logicalPath: string) {
      this.favoritesPaths = this.favoritesPaths.filter(p => p !== logicalPath);
      // TODO: 持久化
      useDialogService().showSuccess(i18n.global.t('fileManager.store.favorites.removed'));
    },
    isFavorite(logicalPath: string): boolean {
      return this.favoritesPaths.includes(logicalPath);
    },

    // --- 筛选与排序 ---
    updateFilterOptions(newOptions: Partial<FilterOptions>) {
      this.filterOptions = { ...this.filterOptions, ...newOptions };
      this.applyFiltersAndSort();
      this.isFilterActive = this.activeFiltersCount > 0;
    },
    applyFiltersAndSort() {
      let result = [...this.items];

      // 筛选逻辑
      if (this.filterOptions.namePattern) {
        const pattern = this.filterOptions.namePattern.toLowerCase();
        result = result.filter(item => item.name.toLowerCase().includes(pattern));
      }
      // 新增：按 itemType 筛选
      if (this.filterOptions.itemType) {
        result = result.filter((item: FAMItem) => item.itemType === this.filterOptions.itemType);
      }
      // fileTypes 筛选主要针对文件
      if (this.filterOptions.fileTypes.length > 0) {
        result = result.filter((item: FAMItem) => {
          if (item.itemType === 'directory') return true; // 如果 itemType 筛选已选 'directory'，这里不应再过滤掉它
          // 如果 itemType 筛选是 'file' 或空，则按扩展名过滤文件
          if (item.itemType === 'file') {
            const ext = item.name.substring(item.name.lastIndexOf('.')).toLowerCase();
            return this.filterOptions.fileTypes.includes(ext);
          }
          return true; // 对于其他情况（如 itemType 未指定），不基于 fileTypes 过滤文件夹
        });
      }
      if (this.filterOptions.sizeRange) {
        const [min, max] = this.filterOptions.sizeRange;
        result = result.filter((item: FAMItem) => item.size !== undefined && item.size !== null && item.size >= min && item.size <= max);
      }
      if (this.filterOptions.dateRange) {
        const [start, end] = this.filterOptions.dateRange;
        const startTime = start.getTime();
        const endTime = end.getTime() + (24 * 60 * 60 * 1000 - 1); // 包含结束日期的全天
        result = result.filter((item: FAMItem) => item.lastModified && item.lastModified >= startTime && item.lastModified <= endTime);
      }
      // TODO: showHiddenFiles 筛选 (需要后端支持或文件名约定)

      // 排序逻辑
      const { sortField, sortDirection } = this.viewSettings;
      result.sort((a, b) => {
        // 始终将文件夹排在文件前面 (或根据用户设置)
        if (a.itemType === 'directory' && b.itemType === 'file') return -1;
        if (a.itemType === 'file' && b.itemType === 'directory') return 1;

        let valA_raw: any = a[sortField as keyof FAMItem];
        let valB_raw: any = b[sortField as keyof FAMItem];

        const getExtension = (filename: string | undefined | null): string => {
          if (typeof filename !== 'string') return '';
          const lastDot = filename.lastIndexOf('.');
          if (lastDot === -1 || lastDot === 0 || lastDot === filename.length - 1) {
            return ''; // 没有扩展名或点在开头/末尾
          }
          return filename.substring(lastDot + 1).toLowerCase();
        };

        if (sortField === 'extension') {
          valA_raw = getExtension(a.name);
          valB_raw = getExtension(b.name);
        }

        let valA: string | number | boolean;
        let valB: string | number | boolean;

        // 对特定字段进行处理并确保类型安全
        if (sortField === 'name' || sortField === 'itemType' || sortField === 'extension') { // itemType 和 extension 也按字符串处理
          valA = (typeof valA_raw === 'string' ? valA_raw : '').toLowerCase();
          valB = (typeof valB_raw === 'string' ? valB_raw : '').toLowerCase();
        } else if (sortField === 'size' || sortField === 'lastModified') {
          valA = typeof valA_raw === 'number' ? valA_raw : 0;
          valB = typeof valB_raw === 'number' ? valB_raw : 0;
        } else if (typeof valA_raw === 'boolean' && typeof valB_raw === 'boolean') {
          valA = valA_raw ? 1 : 0; // true > false
          valB = valB_raw ? 1 : 0;
        } else { // 其他类型或混合类型，转为字符串比较，处理 null/undefined
          valA = valA_raw === null || typeof valA_raw === 'undefined' ? '' : String(valA_raw).toLowerCase();
          valB = valB_raw === null || typeof valB_raw === 'undefined' ? '' : String(valB_raw).toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });

      this.filteredItems = result;
      this.isFilterActive = this.activeFiltersCount > 0; // 更新筛选状态
      // 如果当前选中的项目在筛选后不可见，则清除详情
      if (this.selectedItemForDetail && !this.filteredItems.find((item: FAMItem) => item.logicalPath === this.selectedItemForDetail!.logicalPath)) {
        this.selectedItemForDetail = null;
        // this.isDetailPanelVisible = false; // 可选：筛选后若选中项消失，是否隐藏详情
      }
    },
    clearFilters() {
      this.filterOptions = {
        namePattern: '',
        itemType: '', // 重置新增字段
        fileTypes: [],
        sizeRange: null,
        dateRange: null,
        showHiddenFiles: false,
      };
      this.applyFiltersAndSort();
    },
    searchFiles(query: string) { // 快速搜索，本质是更新 namePattern
      this.updateFilterOptions({ namePattern: query });
    },

    // --- 视图设置 ---
    updateViewSettings(newSettings: Partial<ViewSettings>) {
      this.viewSettings = { ...this.viewSettings, ...newSettings };
      // 如果排序字段或方向改变，重新应用筛选和排序
      if (newSettings.sortField || newSettings.sortDirection) {
        this.applyFiltersAndSort();
      }
      // TODO: 持久化 viewSettings
    },

    // --- 文件上传 (UploadManagerModal 相关逻辑的入口) ---
    uploadFiles(files: FileList) {
      if (!files || files.length === 0) return;

      const uiStore = useUiStore();
      const dialogService = useDialogService();

      uiStore.openModalWithContent({
        component: UploadManagerModal,
        props: {
          filesToUpload: files,
          targetPath: this.currentLogicalPath,
          onUploadsFinished: (results: { successCount: number, errorCount: number }) => {
            console.log('Uploads finished:', results);
            // 可以在这里显示一个总结性的通知
            if (results.errorCount > 0) {
              dialogService.showWarning(
                i18n.global.t('fileManager.uploadManager.someSuccess', {
                  successCount: results.successCount,
                  totalCount: results.successCount + results.errorCount
                })
              );
            } else {
              dialogService.showSuccess(
                i18n.global.t('fileManager.uploadManager.allSuccess')
              );
            }
            // fileManagerStore.fetchItems() 已经在 UploadManagerModal 内部调用了
          },
        },
        modalProps: {
          title: i18n.global.t('fileManager.uploadManager.title'),
          width: 'max-w-2xl',
          showCloseIcon: true,
          // 当上传时，不允许点击背景关闭
          closeOnBackdrop: false, // UploadManager 内部会根据上传状态控制
        }
      });
    },

    // TODO: loadUserPreferences from localStorage
    // TODO: saveUserPreferences to localStorage (on change for relevant state)
  },
});

// 辅助函数，用于从 localStorage 加载/保存状态 (示例)
// function loadFromLocalStorage<T>(key: string, defaultValue: T): T {
//   const stored = localStorage.getItem(key);
//   return stored ? JSON.parse(stored) : defaultValue;
// }
// function saveToLocalStorage<T>(key: string, value: T) {
//   localStorage.setItem(key, JSON.stringify(value));
// }