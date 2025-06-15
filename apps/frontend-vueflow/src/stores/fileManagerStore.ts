// apps/frontend-vueflow/src/stores/fileManagerStore.ts
import { defineStore } from 'pinia';
import * as fileManagerApi from '@/api/fileManagerApi';
import { FAMItemsSchema, type FAMItem } from '@comfytavern/types'; // 导入统一类型和 Schema
import { useDialogService } from '@/services/DialogService'; // 导入对话框服务


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
  sortField: keyof FAMItem | 'name' | 'size' | 'lastModified' | 'itemType'; // 排序字段, FAMItem 替换 ZodValidatedFAMListItem
  sortDirection: 'asc' | 'desc'; // 排序方向
  visibleColumns: Array<keyof FAMItem | string>; // 列表视图下可见的列, FAMItem 替换 ZodValidatedFAMListItem
  thumbnailSize: 'small' | 'medium' | 'large'; // 网格视图缩略图大小
  informationDensity: 'compact' | 'comfortable' | 'spacious'; // 信息密度
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
  isDetailPanelVisible: boolean;
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
      { label: '我的文件', logicalPath: 'user://', icon: 'UserIcon' }, // icon 是示例
      { label: '共享空间', logicalPath: 'shared://', icon: 'UsersIcon' },
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
    },
    isDetailPanelVisible: false,
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
          { label: '我的文件', logicalPath: `user://`, icon: 'UserIcon' },
          { label: '共享空间', logicalPath: 'shared://', icon: 'UsersIcon' },
        ];
      } else {
        this.rootNavigationItems = [
          { label: '共享空间', logicalPath: 'shared://', icon: 'UsersIcon' },
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
        dialogService.showError(`加载文件列表失败: ${(err as Error).message || '未知错误'}`);
      } finally {
        this.isLoading = false;
      }
    },

    // --- 文件/目录操作 ---
    async createDirectory(name?: string) {
      const dialogService = useDialogService();
      const dirName = name || await dialogService.showInput({
        title: '新建文件夹',
        inputPlaceholder: '请输入文件夹名称',
        // TODO: 添加验证规则，例如不允许特殊字符
      });

      if (dirName) {
        this.isLoading = true;
        try {
          await fileManagerApi.createDir(this.currentLogicalPath, dirName);
          dialogService.showSuccess(`文件夹 "${dirName}" 创建成功`);
          await this.fetchItems(); // 刷新列表
        } catch (err) {
          this.error = err;
          dialogService.showError(`创建文件夹失败: ${(err as Error).message}`);
        } finally {
          this.isLoading = false;
        }
      }
    },


    async renameItem(itemToRename: FAMItem, newName?: string) {
      const dialogService = useDialogService();
      const finalNewName = newName || await dialogService.showInput({
        title: `重命名 ${itemToRename.itemType === 'directory' ? '文件夹' : '文件'}`,
        initialValue: itemToRename.name,
        inputPlaceholder: '请输入新名称',
      });

      if (finalNewName && finalNewName !== itemToRename.name) {
        this.isLoading = true;
        try {
          await fileManagerApi.renameFileOrDir(itemToRename.logicalPath, finalNewName);
          dialogService.showSuccess(`已重命名为 "${finalNewName}"`);
          // 更新选中项和详情（如果被重命名的项是当前选中的）
          if (this.selectedItemForDetail?.logicalPath === itemToRename.logicalPath) {
            const updatedItem = { ...this.selectedItemForDetail, name: finalNewName, logicalPath: itemToRename.logicalPath.substring(0, itemToRename.logicalPath.lastIndexOf('/') + 1) + finalNewName };
            this.selectedItemForDetail = updatedItem as FAMItem; // 类型更新
          }
          this.selectedItemPaths = this.selectedItemPaths.map(p => p === itemToRename.logicalPath ? (itemToRename.logicalPath.substring(0, itemToRename.logicalPath.lastIndexOf('/') + 1) + finalNewName) : p);

          await this.fetchItems(); // 刷新列表
        } catch (err: any) { // Restored catch block
          this.error = err;
          dialogService.showError(`重命名失败: ${(err as Error).message}`);
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
        title: '确认删除',
        message: `您确定要删除选中的 ${items.length} 个项目吗？此操作可能无法撤销。`,
        dangerConfirm: true,
        confirmText: '删除',
      });

      if (confirmed) {
        this.isLoading = true;
        try {
          const pathsToDelete = items.map(item => item.logicalPath);
          await fileManagerApi.deleteFilesOrDirs(pathsToDelete);
          dialogService.showSuccess(`${items.length} 个项目已删除`);
          this.clearSelection(); // 删除后清除选择
          await this.fetchItems(); // 刷新列表
        } catch (err) {
          this.error = err;
          dialogService.showError(`删除失败: ${(err as Error).message}`);
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
        dialogService.showSuccess(`${itemsToMove.length} 个项目已移动`);
        this.clearSelection();
        await this.fetchItems(); // 刷新当前目录
        // TODO: 可能需要导航到 targetParentPath 或刷新来源目录（如果不同）
      } catch (err) {
        this.error = err;
        dialogService.showError(`移动失败: ${(err as Error).message}`);
      } finally {
        this.isLoading = false;
      }
    },

    async downloadFile(item: FAMItem) {
      if (item.itemType === 'directory') {
        // TODO: 支持下载文件夹 (可能需要后端压缩)
        useDialogService().showInfo('暂不支持下载文件夹。');
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
        useDialogService().showError(`获取下载链接失败: ${(err as Error).message}`);
      }
    },

    // --- 选择处理 ---
    setSelectedItemPaths(paths: string[]) {
      this.selectedItemPaths = paths;
      if (paths.length > 0) {
        // 优先从 filteredItems 中查找，因为用户看到的是这个列表
        const firstSelectedItem = this.filteredItems.find((item: FAMItem) => item.logicalPath === paths[0]) || this.items.find((item: FAMItem) => item.logicalPath === paths[0]);
        this.selectedItemForDetail = firstSelectedItem || null;
        if (firstSelectedItem) {
          this.isDetailPanelVisible = true;
          if (!this.detailPanelActiveTab) {
            this.detailPanelActiveTab = 'properties';
          }
        } else {
          // 如果找不到选中项的详细信息（理论上不应发生，除非列表不同步）
          this.selectedItemForDetail = null;
          this.isDetailPanelVisible = false;
          this.detailPanelActiveTab = null;
        }
      } else {
        this.selectedItemForDetail = null;
        this.isDetailPanelVisible = false; // 无选择时可以考虑隐藏详情面板
        this.detailPanelActiveTab = null;
      }
    },

    clearSelection() {
      this.selectedItemPaths = [];
      this.selectedItemForDetail = null;
      this.isDetailPanelVisible = false;
      this.detailPanelActiveTab = null;
    },

    // --- 剪贴板 ---
    copyToClipboard(items?: FAMItem[]) {
      const itemsToCopy = items || this.selectedItems;
      if (itemsToCopy.length > 0) {
        this.clipboard = { action: 'copy', sourcePaths: itemsToCopy.map(item => item.logicalPath) };
        useDialogService().showToast({ message: `${itemsToCopy.length} 个项目已复制到剪贴板`, type: 'info' });
      }
    },
    cutToClipboard(items?: FAMItem[]) {
      const itemsToCut = items || this.selectedItems;
      if (itemsToCut.length > 0) {
        this.clipboard = { action: 'cut', sourcePaths: itemsToCut.map(item => item.logicalPath) };
        useDialogService().showToast({ message: `${itemsToCut.length} 个项目已剪切到剪贴板`, type: 'info' });
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
            dialogService.showError('不能将文件夹移动到其自身或其子文件夹中。');
            return;
          }
          if (sourcePath.substring(0, sourcePath.lastIndexOf('/') + 1) === targetParentPath) {
            dialogService.showInfo('项目已在目标位置。');
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
          dialogService.showInfo('复制功能暂未实现。'); // 临时
        } else if (action === 'cut') {
          await fileManagerApi.moveFilesOrDirs(sourcePaths, targetParentPath);
          dialogService.showSuccess(`${sourcePaths.length} 个项目已移动`);
        }
        this.clipboard = null; // 操作后清空剪贴板
        await this.fetchItems();
      } catch (err) {
        this.error = err;
        dialogService.showError(`粘贴失败: ${(err as Error).message}`);
      } finally {
        this.isLoading = false;
      }
    },

    // --- 详情面板控制 ---
    toggleDetailPanel(visible?: boolean) {
      if (visible !== undefined) {
        this.isDetailPanelVisible = visible;
      } else {
        this.isDetailPanelVisible = !this.isDetailPanelVisible;
      }
      if (!this.isDetailPanelVisible) {
        this.detailPanelActiveTab = null;
      } else if (this.isDetailPanelVisible && !this.detailPanelActiveTab && this.selectedItemForDetail) {
        // 如果面板变为可见，且没有活动tab，且有选中项，则默认显示属性
        this.detailPanelActiveTab = 'properties';
      }
    },
    setDetailPanelTab(tab: 'properties' | 'preview' | 'actions' | null) {
      this.detailPanelActiveTab = tab;
      if (tab !== null && !this.isDetailPanelVisible && this.selectedItemForDetail) {
        this.isDetailPanelVisible = true; // 如果设置了tab且有选中项，则确保面板可见
      }
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
        useDialogService().showSuccess('已添加到收藏夹');
      }
    },
    removeFromFavorites(logicalPath: string) {
      this.favoritesPaths = this.favoritesPaths.filter(p => p !== logicalPath);
      // TODO: 持久化
      useDialogService().showSuccess('已从收藏夹移除');
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

        let valA_raw = a[sortField as keyof FAMItem]; // FAMItem 替换 ZodValidatedFAMListItem
        let valB_raw = b[sortField as keyof FAMItem]; // FAMItem 替换 ZodValidatedFAMListItem

        let valA: string | number | boolean;
        let valB: string | number | boolean;

        // 对特定字段进行处理并确保类型安全
        if (sortField === 'name') {
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
    // 此处仅为示例，实际 UploadManagerModal 可能有自己的 store 或直接处理
    async uploadFiles(files: FileList) {
      const dialogService = useDialogService();
      if (!files || files.length === 0) return;

      // 简单实现：直接上传，不打开 UploadManagerModal
      // 实际项目中，这里会打开 UploadManagerModal.vue，并将 files 传递给它
      // UploadManagerModal 内部会调用 fileManagerApi.writeFile，并管理上传进度
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        const file = files.item(i); // 使用 .item(i) 获取 File 对象，可能为 null
        if (file) { // 确保 file 不是 null
          formData.append('files', file); // 'files' 需要与后端接收字段匹配
        }
      }

      if (formData.getAll('files').length === 0 && files.length > 0) {
        dialogService.showWarning('没有有效的文件被选中上传。');
        return;
      }
      if (formData.getAll('files').length === 0) return; // 没有文件就不用继续了


      this.isLoading = true; // 表示文件列表正在因上传而可能发生变化
      try {
        await fileManagerApi.writeFile(this.currentLogicalPath, formData);
        dialogService.showSuccess(`${files.length} 个文件上传成功`);
        await this.fetchItems(); // 上传成功后刷新列表
      } catch (err) {
        this.error = err;
        dialogService.showError(`上传失败: ${(err as Error).message}`);
      } finally {
        this.isLoading = false;
      }
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