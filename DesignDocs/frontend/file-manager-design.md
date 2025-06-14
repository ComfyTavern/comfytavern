# FAM 系统前端文件管理器设计文档 (修订版)

## 1. 引言

本文档旨在为 ComfyTavern 的统一文件与资产管理系统（FAM 系统）设计前端用户界面和交互逻辑。目标是创建一个直观、高效的文件管理器，允许用户浏览、操作和管理其在 FAM 系统中存储的文件和资产。

设计将基于后端 `FileManagerService` (FAMService) 提供的 API，并遵循 [`DesignDocs/architecture/unified-file-asset-management.md`](DesignDocs/architecture/unified-file-asset-management.md:1) 中定义的逻辑路径方案。本文档在初始版本基础上，整合了对项目现有组件、服务和 UI 模式的调研结果，以及基于 Blender 等专业文件管理器的 UI 参考优化，以确保新功能与项目整体风格和实践保持一致，同时提供专业级的用户体验。

## 2. 核心功能

- **浏览文件和目录**: 用户能够以层级结构浏览 `user://`、`shared://` 和 `system://` 空间下的文件和目录。
- **文件/目录操作**:
  - 创建目录
  - 上传文件 (支持多文件、显示进度)
  - 下载文件
  - 重命名文件/目录
  - 移动文件/目录 (支持到不同路径)
  - 删除文件/目录 (支持批量操作，后端若支持回收站则对接)
  - 复制文件/目录 (可选，如果后端支持 `copy` API)
- **查看信息与预览**:
  - 显示文件/目录的名称、类型、大小、最后修改日期等元数据。
  - 对常见文件类型（如图片、文本）提供预览功能。
- **导航**:
  - 面包屑导航（支持直接编辑路径）。
  - 通过可折叠的左侧导航栏快速访问逻辑根路径、最近访问和用户收藏夹。
- **过滤与搜索**:
  - 基本的搜索功能 (按文件名)。
  - 高级筛选器（按文件类型、大小范围、日期范围等）。
- **视图控制**:
  - 支持列表视图和网格视图切换。
  - 支持按名称、大小、日期等排序。
  - 可配置显示列和信息密度。
- **最近访问**: 跟踪并显示用户最近访问的文件和目录，提供快速访问入口。
- **用户反馈**: 清晰的加载状态、操作成功/失败的 Toast 通知、模态框确认等。

## 3. 技术选型与现有实践集成

- **框架**: Vue 3 + TypeScript + Vite
- **状态管理**: Pinia (`fileManagerStore.ts`)
- **UI 组件库**: 复用项目中已有的通用组件和 Tailwind CSS。
  - **通用输入控件**: 优先使用 `apps/frontend-vueflow/src/components/graph/inputs/` 下的组件 (如 `StringInput.vue`, `NumberInput.vue`, `BooleanToggle.vue`, `SelectInput.vue`)。
  - **Tooltip**: 使用全局注册的 `v-comfy-tooltip` 指令 ([`apps/frontend-vueflow/src/directives/vComfyTooltip.ts`](apps/frontend-vueflow/src/directives/vComfyTooltip.ts:1)) 和 `tooltipStore` ([`apps/frontend-vueflow/src/stores/tooltipStore.ts`](apps/frontend-vueflow/src/stores/tooltipStore.ts:1))。
  - **滚动条**: 使用 `OverlayScrollbarsComponent`。
- **API 通信**:
  - 创建 `fileManagerApi.ts`，遵循项目中 `useApi()` hook ([`apps/frontend-vueflow/src/utils/api.ts`](apps/frontend-vueflow/src/utils/api.ts:1) 推断) 的模式封装对后端 `FAMService` 的 HTTP 请求。
- **对话框与通知**:
  - **标准交互**: 对于简单的消息提示、确认对话框（如删除确认）、单行文本输入（如新建文件夹、重命名），优先使用现有的 `DialogService` ([`apps/frontend-vueflow/src/services/DialogService.ts`](apps/frontend-vueflow/src/services/DialogService.ts:1)) 及其依赖的 [`Dialog.vue`](apps/frontend-vueflow/src/components/common/Dialog.vue:1)。
  - **自定义复杂模态框**: 对于需要复杂布局、多个输入字段或特定交互逻辑的模态框（如文件上传管理器、文件移动（含目标选择器）、高级筛选器、文件属性高级编辑等），基于通用的 [`BaseModal.vue`](apps/frontend-vueflow/src/components/common/BaseModal.vue:1) 组件进行构建。
- **用户上下文与授权**:
  - 文件管理器操作通常需要用户身份 (`userId`) 以进行权限校验和数据隔离。
  - **获取 `userId`**:
    - 对于作为独立页面使用的文件管理器，其路由守卫应确保 `authStore` 中的 `userContext` 已加载。`userId` (即 `authStore.currentUser.id`) 应在页面初始化时传递给 `fileManagerStore` (例如通过 `fileManagerStore.initialize(userId, initialPath)` action)。
    - 如果文件管理器作为嵌入式组件，其父组件应负责从已初始化的 `authStore` 获取 `userId` 并通过 props 或 store action 传递。
  - **API 请求中的用户身份**:
    - 理想情况下，后端应通过认证凭证 (如 Token 或 Cookie) 自动识别用户，前端 API 调用无需显式传递 `userId`。
    - 若后端 API 确实需要 `userId` 参数，此参数应由 `fileManagerApi.ts` 内部从 `authStore` 获取并添加到请求中，而不是由文件管理器组件或 `fileManagerStore` 的每个 action 手动传递。这可能需要增强 `useApi` hook 或在 `fileManagerApi.ts` 中实现。
  - 文件管理器组件本身不直接负责从 `authStore` 拉取认证状态或 `userId`，也不直接管理认证流程。
- **数据校验**: 考虑对从 API 获取的列表项数据（如 `FAMListItem`）使用 Zod schema 进行客户端验证，借鉴 [`projectStore.ts`](apps/frontend-vueflow/src/stores/projectStore.ts:1) 的实践。

## 4. 文件结构规划 (修订)

新的文件管理器相关代码将组织如下：

```
apps/frontend-vueflow/src/
├── api/
│   └── fileManagerApi.ts         # API 客户端
├── assets/
│   └── icons/                    # (可能) 文件类型图标
├── components/
│   └── file-manager/             # 文件管理器相关组件
│       ├── FileManagerViewLayout.vue # (新增) 文件管理器整体布局，包含导航、工具栏、主区域、详情面板
│       ├── SidebarNav.vue        # 左侧导航栏 (根路径、最近访问、收藏夹)
│       ├── FileToolbar.vue       # 工具栏组件 (包含筛选器、显示设置等)
│       ├── FileBrowser.vue       # 核心文件/目录列表视图 (含面包屑)
│       ├── Breadcrumbs.vue       # 面包屑导航组件 (支持路径编辑)
│       ├── FileListItem.vue      # 单个文件/目录条目组件
│       ├── FileGridItem.vue      # 网格视图下的文件/目录条目组件
│       ├── FileContextMenu.vue   # 右键上下文菜单组件
│       ├── FileDetailPanel.vue   # (新增) 右侧/底部文件详情/预览面板
│       ├── RecentAccessList.vue  # 最近访问列表组件
│       └── modals/               # 自定义复杂模态框 (基于 BaseModal.vue)
│           ├── MoveModal.vue         # 文件移动，含路径选择
│           ├── UploadManagerModal.vue  # 文件上传管理器 (列表、进度、控制)
│           ├── FilterModal.vue       # 高级筛选器模态框
│           └── ViewSettingsModal.vue # 视图显示设置模态框
│           # CreateFolderModal 和 RenameModal 优先使用 DialogService.showInput
│           # ConfirmDeleteModal 优先使用 DialogService.showConfirm
├── composables/
│   ├── useFileManager.ts       # (可选) 封装文件管理器核心交互逻辑
│   └── useFilePreview.ts       # (新增) 文件预览相关逻辑
├── router/
│   └── index.ts                  # (修改) 添加文件管理器路由
├── stores/
│   └── fileManagerStore.ts       # Pinia store
└── views/
    └── FileManagerPage.vue       # 文件管理器主路由页面 (可能仅简单包裹 FileManagerViewLayout)
```

## 5. 组件设计 (修订)

### 5.1. `FileManagerPage.vue` (新增或调整原 `FileManagerView`)

- **职责**: 作为文件管理器功能的顶层路由组件。
- **内容**: 主要渲染 `FileManagerViewLayout.vue`。
- **逻辑**: 从路由参数获取初始路径，初始化 `fileManagerStore`。

### 5.2. `FileManagerViewLayout.vue` (新增)

- **职责**: 文件管理器页面的整体布局容器。
- **布局**:
  - 左侧: `SidebarNav.vue` (可折叠)。
  - 右侧主区域:
    - 顶部: `FileToolbar.vue`。
    - 中部: `FileBrowser.vue` (包含文件列表和面包屑)。
    - 右侧/底部 (可选，可配置): `FileDetailPanel.vue` (可切换显示/隐藏，或作为可调整大小的面板)。
- **交互**: 协调各子组件之间的交互。
- **响应式**: 在移动端和窄屏幕下，可将左侧导航栏和右侧详情面板设为可折叠的抽屉模式。

### 5.3. `SidebarNav.vue` 

- **职责**: 提供快速导航入口，切换文件浏览器的根路径。
- **内容**:
  - 逻辑根路径 (`user://`, `shared://`, `system://` 的友好名称)
  - **最近访问**: 显示最近访问的文件和目录列表，支持快速跳转
  - 用户收藏夹 (可添加/移除常用路径)（预计，需要配合用户配置数据保存）
- **样式**: 可参考 [`apps/frontend-vueflow/src/views/SideBar.vue`](apps/frontend-vueflow/src/views/SideBar.vue:1) 的可折叠列表样式，或 [`apps/frontend-vueflow/src/components/graph/sidebar/SidebarManager.vue`](apps/frontend-vueflow/src/components/graph/sidebar/SidebarManager.vue:1) 左侧的紧凑图标栏样式。
- **交互**:
  - 点击导航项调用 `fileManagerStore.navigateTo(logicalPath)`。
  - 最近访问列表支持清算和固定操作。
  - 可折叠的分组显示 (根路径、最近访问、收藏夹)。

### 5.4. `FileToolbar.vue`

- **职责**: 提供全局文件操作按钮和视图控制。
- **内容**:
  - **基本操作**: 上传文件、新建文件夹 (触发 `DialogService.showInput`)、刷新列表
  - **搜索**: 搜索框 (使用 `StringInput` 组件)
  - **筛选器**: 快速筛选按钮 (文件类型、日期) 和高级筛选器按钮 (打开 `FilterModal.vue`)
  - **视图控制**: 列表/网格视图切换、排序方式选择 (下拉菜单或快速按钮)
  - **显示设置**: 显示设置按钮 (打开 `ViewSettingsModal.vue`)，配置显示列、信息密度等
- **布局**:
  - 左侧: 基本操作按钮
  - 中部: 搜索框
  - 右侧: 筛选器、视图控制、显示设置
- **输入控件**: 复用 `apps/frontend-vueflow/src/components/graph/inputs/` 下的组件。
- **Tooltip**: 使用 `v-comfy-tooltip` 为按钮提供说明。

### 5.5. `FileBrowser.vue`

- **职责**: 显示当前路径下的文件和目录列表，以及面包屑导航。
- **包含组件**:
  - `Breadcrumbs.vue` (支持路径编辑)
  - `FileListItem.vue` (列表视图，循环渲染)
  - `FileGridItem.vue` (网格视图，循环渲染)
- **逻辑**:
  - 从 `fileManagerStore` 获取数据和视图设置。
  - 处理条目选择 (单击、Ctrl/Shift+单击)。
  - 触发 `FileDetailPanel.vue` 的更新。
  - 管理 `FileContextMenu.vue`。
  - 支持键盘导航 (方向键、回车、删除键等)。
- **滚动**: 使用 `OverlayScrollbarsComponent`。
- **虚拟化**: 对大量文件的目录考虑实现虚拟滚动以提升性能。

### 5.6. `Breadcrumbs.vue`

- **职责**: 显示当前逻辑路径的面包屑，支持路径直接编辑。
- **功能**:
  - **显示模式**: 显示路径层级，每个分段可点击导航到对应父级目录。
  - **编辑模式**: 点击编辑按钮或双击路径区域，转为文本输入框，允许用户直接输入目标路径。
  - **路径验证**: 在编辑模式下，实时验证路径格式，并在用户确认时检查路径是否存在。
- **交互**:
  - 单击分段导航到对应目录。
  - 双击或点击编辑图标进入编辑模式。
  - 支持路径自动补全 (可选，需要后端支持返回补全建议)。

### 5.7. `FileListItem.vue` 和 `FileGridItem.vue`

- **职责**: 渲染单个文件/目录条目 (分别用于列表视图和网格视图)。
- **显示内容**:
  - 文件类型图标、名称、大小、修改日期等 (根据视图设置可配置)。
  - 选中状态高亮。
  - 文件预览缩略图 (网格视图，对图片等支持的格式)。
- **交互**:
  - 单击选中，双击进入目录/打开文件，右键上下文菜单。
  - 支持拖拽选择和拖拽移动。
- **Tooltip**: 可用 `v-comfy-tooltip` 显示完整名称或其他元信息。

### 5.8. `FileContextMenu.vue`

- **职责**: 右键上下文菜单。
- **逻辑**: 根据选中项动态生成菜单项 (打开、下载、通过 `DialogService.showInput` 重命名、通过 `DialogService.showConfirm` 删除、移动、复制路径、查看属性、添加到收藏夹等)。
- **智能化**: 根据选中的文件类型和数量，动态显示相关的操作选项。

### 5.9. `FileDetailPanel.vue` (新增)

- **职责**: 在主视图的右侧或底部显示选中文件/目录的详细信息、预览或相关操作。
- **模式**: 借鉴 [`apps/frontend-vueflow/src/components/graph/sidebar/SidebarManager.vue`](apps/frontend-vueflow/src/components/graph/sidebar/SidebarManager.vue:1) 的面板切换模式。可以有一组小图标按钮来切换不同视图：
  - **属性视图**: 显示元数据，布局参考 [`apps/frontend-vueflow/src/components/settings/SettingItemRow.vue`](apps/frontend-vueflow/src/components/settings/SettingItemRow.vue:1)。部分属性可编辑（如文件名，通过 `StringInput` 和 `onSave` 模式）。
  - **预览视图**: 对图片、文本、代码等常见格式进行内联预览。
  - **(未来) 版本历史视图**。
- **响应式**: 在窄屏幕下可转为底部面板或模态框显示。

### 5.10. `RecentAccessList.vue` (新增)

- **职责**: 显示最近访问的文件和目录列表。
- **功能**:
  - 按时间倒序显示最近访问的条目。
  - 支持搜索和筛选最近访问的条目。
  - 提供快速清除历史记录的选项。
  - 支持固定常用条目 (转为收藏夹)。
- **集成**: 可作为 `SidebarNav.vue` 的子组件，也可作为独立的面板或模态框使用。

### 5.11. 自定义模态框 (基于 `BaseModal.vue`)

- **`MoveModal.vue`**:
  - **内容**: 当前选中项列表、目标路径输入/选择器 (可能是一个简化的树状视图或路径输入框)。
  - **容器**: 使用 [`BaseModal.vue`](apps/frontend-vueflow/src/components/common/BaseModal.vue:1)。
  - **页脚**: "移动"、"取消"按钮。
- **`UploadManagerModal.vue`**:
  - **内容**: 待上传文件列表、单个/总体上传进度条、开始/暂停/取消控制按钮、上传成功/失败状态。
  - **容器**: 使用 [`BaseModal.vue`](apps/frontend-vueflow/src/components/common/BaseModal.vue:1)。
- **`FilterModal.vue`** (新增):
  - **内容**: 高级筛选选项表单，包括文件类型多选、大小范围、日期范围、自定义属性筛选等。
  - **输入控件**: 使用项目标准输入组件 (`SelectInput`, `StringInput`, `DateRangeInput` 等)。
  - **容器**: 使用 [`BaseModal.vue`](apps/frontend-vueflow/src/components/common/BaseModal.vue:1)。
  - **页脚**: "应用筛选"、"清除"、"取消"按钮。
- **`ViewSettingsModal.vue`** (新增):
  - **内容**: 视图显示设置，包括显示列配置、信息密度、缩略图大小、排序偏好等。
  - **布局**: 可借鉴 [`SettingsLayout.vue`](apps/frontend-vueflow/src/components/settings/SettingsLayout.vue:1) 模式。
  - **容器**: 使用 [`BaseModal.vue`](apps/frontend-vueflow/src/components/common/BaseModal.vue:1)。
  - **页脚**: "应用"、"重置为默认"、"取消"按钮。

## 6. 状态管理 (`fileManagerStore.ts`) (修订)

### 6.1. State (修订)

```typescript
interface FAMListItem {
  /* ...保持不变... */
}
interface ZodValidatedFAMListItem extends FAMListItem {
  /* Zod验证后的类型，可能更精确 */
}

interface RecentAccessItem {
  logicalPath: string;
  accessTime: number;
  itemType: "file" | "directory";
  displayName: string;
}

interface FilterOptions {
  fileTypes: string[]; // 选择的文件扩展名
  sizeRange: [number, number] | null; // 文件大小范围 (字节)
  dateRange: [Date, Date] | null; // 修改日期范围
  namePattern: string; // 文件名搜索模式
  showHiddenFiles: boolean; // 是否显示隐藏文件
}

interface ViewSettings {
  mode: "list" | "grid"; // 视图模式
  sortField: keyof ZodValidatedFAMListItem; // 排序字段
  sortDirection: "asc" | "desc"; // 排序方向
  visibleColumns: string[]; // 列表视图下可见的列
  thumbnailSize: "small" | "medium" | "large"; // 缩略图大小
  informationDensity: "compact" | "comfortable" | "spacious"; // 信息密度
}

interface FileManagerState {
  currentLogicalPath: string;
  currentUserId: string | null;
  items: ZodValidatedFAMListItem[]; // 使用Zod验证后的类型
  filteredItems: ZodValidatedFAMListItem[]; // 筛选后的条目
  selectedItemPaths: string[];
  isLoading: boolean;
  error: any | null;
  rootNavigationItems: { label: string; logicalPath: string; icon?: string }[];
  clipboard: { action: "copy" | "cut"; sourcePaths: string[] } | null;

  // 新增：最近访问相关
  recentAccessItems: RecentAccessItem[];

  // 新增：筛选和搜索
  filterOptions: FilterOptions;
  isFilterActive: boolean;

  // 新增：视图设置
  viewSettings: ViewSettings;

  // 新增：用于右侧/底部详情面板
  isDetailPanelVisible: boolean;
  detailPanelActiveTab: "properties" | "preview" | "actions" | null;
  selectedItemForDetail: ZodValidatedFAMListItem | null;

  // 新增：收藏夹路径
  favoritesPaths: string[];
}
```

### 6.2. Getters (修订)

- `currentUserRootPath`
- `selectedItems`: 返回 `items` 中路径在 `selectedItemPaths` 中的条目。
- `breadcrumbsSegments`
- `recentAccessItemsSorted`: 按访问时间倒序返回最近访问条目。
- `availableFileTypes`: 从当前 `items` 中提取所有文件扩展名，用于筛选器选项。
- `activeFiltersCount`: 返回当前激活的筛选条件数量。

### 6.3. Actions (修订)

- `initialize(userId: string | null, initialPath?: string)`
- `navigateTo(logicalPath: string)`: 导航时更新最近访问记录。
- `goUp()`
- `async fetchItems()`:
  - 调用 `fileManagerApi.listDir()`。
  - **新增**: 使用 Zod schema 验证返回的 `FAMListItem[]` 数据。
  - 更新 `items`。
  - 调用 `applyFilters()` 更新 `filteredItems`。
- `createDirectory(name: string)`: 使用 `DialogService.showInput` 获取名称，然后调用 API。
- `uploadFiles(files: FileList)`: 打开 `UploadManagerModal.vue` 进行管理，或直接处理简单上传。
- `renameItem(itemToRename: ZodValidatedFAMListItem)`: 使用 `DialogService.showInput` 获取新名称 (以旧名称为初始值)，然后调用 API。
- `moveItems(itemsToMove: ZodValidatedFAMListItem[])`: 打开 `MoveModal.vue` 选择目标路径，然后调用 API。
- `deleteItems(itemsToDelete: ZodValidatedFAMListItem[])`: 使用 `DialogService.showConfirm` 确认，然后调用 API。
- `downloadFile(item: ZodValidatedFAMListItem)`
- `setSelectedItemPaths(paths: string[])`:
  - 更新 `state.selectedItemPaths = paths`。
  - 如果 `paths` 非空 (即有选中项):
    - 设置 `state.selectedItemForDetail` (例如，基于 `paths[0]` 从 `state.items` 或 `state.filteredItems` 中查找对应的完整 `item` 对象)。
    - 设置 `state.isDetailPanelVisible = true`。
    - 如果 `state.detailPanelActiveTab` 为 `null` (或需要根据新选中项重置)，则设置一个默认的活动标签页 (例如 `'properties'`)。
  - 如果 `paths` 为空 (即取消所有选择):
    - 设置 `state.selectedItemForDetail = null`。
    - 设置 `state.isDetailPanelVisible = false`。
    - 设置 `state.detailPanelActiveTab = null`。
- `copyToClipboard(items: ZodValidatedFAMListItem[])`
- `cutToClipboard(items: ZodValidatedFAMListItem[])`
- `pasteFromClipboard()`
- `toggleDetailPanel(visible?: boolean)`:
  - 直接控制详情面板的显隐状态 `state.isDetailPanelVisible`。
  - 如果 `visible` 参数被提供，则 `state.isDetailPanelVisible = visible`。
  - 如果 `visible` 参数未提供，则 `state.isDetailPanelVisible = !state.isDetailPanelVisible` (切换状态)。
  - 如果面板变为不可见 (`state.isDetailPanelVisible === false`)，则同时设置 `state.detailPanelActiveTab = null`。
- `setDetailPanelTab(tab: 'properties' | 'preview' | 'actions' | null)`:
  - 直接设置详情面板的活动标签页 `state.detailPanelActiveTab = tab`。
  - 如果 `tab` 不为 `null` 且 `state.isDetailPanelVisible` 为 `false`，则应考虑是否自动将 `state.isDetailPanelVisible` 设置为 `true`，或者此 action 仅在面板可见时才有意义。 (此行为需进一步确认，通常是先确保面板可见再设置 tab)
- `clearSelection()`:
  - 清除所有选中项，并将详情面板相关的状态重置。
  - 设置 `state.selectedItemPaths = []`。
  - 设置 `state.selectedItemForDetail = null`。
  - 设置 `state.isDetailPanelVisible = false`。
  - 设置 `state.detailPanelActiveTab = null`。

**新增的 Actions:**

- `addToRecentAccess(logicalPath: string, itemType: 'file' | 'directory')`: 添加条目到最近访问记录。
- `clearRecentAccess()`: 清除最近访问记录。
- `addToFavorites(logicalPath: string)` / `removeFromFavorites(logicalPath: string)`: 管理收藏夹。
- `updateFilterOptions(newOptions: Partial<FilterOptions>)`: 更新筛选选项并应用筛选。
- `applyFilters()`: 根据当前 `filterOptions` 从 `items` 生成 `filteredItems`。
- `clearFilters()`: 清除所有筛选条件。
- `updateViewSettings(newSettings: Partial<ViewSettings>)`: 更新视图设置。
- `searchFiles(query: string)`: 快速搜索，更新筛选结果。

## 7. API 客户端 (`fileManagerApi.ts`) (修订)

- **遵循 `useApi()` 模式**: 确保所有请求通过项目中统一的 `useApi()` hook 发出，以便统一处理 baseURL、认证 Token 和基本错误。
- **`writeFile` 方法**:
  - 接收 `FormData` 用于文件上传。
  - 在 `useApi` 的 `post` 或 `put` 调用中，如果传递 `FormData`，确保 `Content-Type` header 被正确设置为 `multipart/form-data` (通常 `axios` 或 `fetch` 会自动处理，如果 `Content-Type` 未显式设置或设为 `undefined`)。
- **`userId` 处理**: 虽然 API 函数签名中可能包含 `userId`，但更推荐的做法是在 `useApi()` hook 或其底层封装中统一从 `authStore` 获取 `userId` (或后端通过 Token 解析)，而不是让每个 API 调用点都传递它。如果必须由前端传递，则应在 `fileManagerApi.ts` 内部从 `authStore` 获取。
- **错误处理**: 遵循项目统一的错误处理模式，通常是捕获并重新抛出，由 Store Action 处理用户反馈。
- **可选的新增方法**:
  - `searchFiles(logicalPath: string, query: string, options?: SearchOptions)`: 如果后端支持搜索功能。
  - `getFilePreview(logicalPath: string, fileType: string)`: 获取文件预览内容，如果后端支持预览功能。

## 8. 路由设计 (修订)

- 路由定义 (`/file-manager`) 和 `props` 传递保持不变。
- **`beforeEnter` 守卫**:
  - 确保 `authStore.checkAuthStatus()` (或类似方法) 先执行完毕，保证 `userId` 可用。
  - 然后调用 `fileManagerStore.initialize(userId, targetPath)`。
  - 这种模式与项目中 [`apps/frontend-vueflow/src/router/index.ts`](apps/frontend-vueflow/src/router/index.ts:1) 的实践一致。
- **子路由** (可选):
  - 考虑添加子路由支持直接导航到特定功能，如 `/file-manager/recent`、`/file-manager/favorites` 等。

## 9. 核心用户流程示例 (修订)

### 9.1. 浏览和导航

1.  用户访问文件管理器页面，`fileManagerStore` 初始化为用户空间根目录。
2.  左侧导航栏显示根路径、最近访问和收藏夹。
3.  用户可以点击左侧导航快速切换到不同区域，或在主区域双击目录进入。
4.  顶部面包屑显示当前路径，用户可以点击分段导航或双击编辑路径。

### 9.2. 创建新文件夹 (修订)

1.  用户点击工具栏 "新建文件夹" 按钮。
2.  调用 `DialogService.showInput({ title: '新建文件夹', inputPlaceholder: '请输入文件夹名称' })`。
3.  用户输入名称并确认，Promise resolve 输入的名称。
4.  `fileManagerStore.createDirectory(folderName)` 被调用。
5.  Store action 调用 `fileManagerApi.createDir()`。
6.  API 成功后，Store action 调用 `fetchItems()` 刷新列表。
7.  `DialogService.showToast({ type: 'success', message: '文件夹创建成功' })`。

### 9.3. 查看文件属性 (新增)

1.  用户在 `FileBrowser.vue` 中单击选中一个文件。
2.  `fileManagerStore.setSelectedItemPaths()` 被调用，更新选中项和 `selectedItemForDetail`。
3.  `fileManagerStore.toggleDetailPanel(true)` 和 `fileManagerStore.setDetailPanelTab('properties')` 被调用。
4.  `FileDetailPanel.vue` 根据 `selectedItemForDetail` 显示文件属性，布局类似 `SettingItemRow.vue`。

### 9.4. 高级筛选 (新增)

1.  用户点击工具栏的 "高级筛选" 按钮。
2.  `FilterModal.vue` 模态框打开，显示筛选选项表单。
3.  用户设置筛选条件 (文件类型、大小范围、日期范围等)。
4.  点击 "应用筛选"，调用 `fileManagerStore.updateFilterOptions(filterOptions)`。
5.  Store 更新 `filteredItems`，列表视图显示筛选后的结果。
6.  工具栏显示筛选状态指示器，可快速清除筛选。

### 9.5. 切换视图模式 (新增)

1.  用户点击工具栏的视图切换按钮 (列表/网格)。
2.  调用 `fileManagerStore.updateViewSettings({ mode: 'grid' })`。
3.  `FileBrowser.vue` 根据视图设置渲染 `FileGridItem.vue` 而不是 `FileListItem.vue`。
4.  网格视图显示文件缩略图和基本信息。

## 10. UI/UX 注意事项 (修订)

- **Tooltip**: 广泛使用 `v-comfy-tooltip` 为按钮、文件项、截断的文本等提供提示。
- **右侧/底部信息面板**:
  - 提供清晰的打开/关闭机制。
  - 面板内部标签页切换应流畅。
  - 面板大小可调整（如果技术上可行且必要）。
- **筛选和搜索**:
  - 提供清晰的筛选状态指示。
  - 支持快速清除筛选条件。
  - 搜索结果高亮匹配文本。
- **视图切换**:
  - 视图模式切换应保持选中状态和滚动位置。
  - 网格视图提供合适的缩略图和间距。
- **最近访问**:
  - 按时间分组显示 (今天、昨天、本周、更早)。
  - 提供搜索和筛选最近访问的功能。
- **路径编辑**:
  - 路径编辑模式提供自动补全建议。
  - 支持相对路径和逻辑路径格式。
- **响应式设计**:
  - 在移动端和平板设备上优化布局。
  - 触摸友好的交互元素。
- **一致性**: 尽可能复用项目中已有的图标、颜色、间距等视觉元素和交互模式。
- **性能**:
  - 大目录使用虚拟滚动。
  - 图片预览使用懒加载。
  - 合理缓存 API 响应和缩略图。
- **可访问性**:
  - 支持键盘导航。
  - 提供适当的 ARIA 标签。
  - 支持屏幕阅读器。

## 11. 与现有项目 UI 模式的集成与复用 (新增章节)

本文件管理器将积极利用 ComfyTavern 项目中已建立的 UI 模式、服务和通用组件，以确保一致的用户体验和高效的开发。

- **对话框与通知**:
  - 标准交互（消息、确认、简单输入）将通过 `DialogService` 实现。
  - 复杂模态框（如上传管理器、移动操作、高级筛选器、视图设置）将基于 `BaseModal.vue` 构建，利用其插槽机制自定义内容和页脚。
- **输入控件**:
  - 所有用户输入字段（搜索框、重命名、新建文件夹名称、筛选条件等）将优先使用 `apps/frontend-vueflow/src/components/graph/inputs/` 目录下提供的标准化组件（`StringInput`, `NumberInput`, `BooleanToggle`, `SelectInput` 等）。
- **信息展示**:
  - 文件属性等键值对信息的展示，可以借鉴 `SettingItemRow.vue` 的左右布局模式（标签+描述 与 值/控件）。
- **侧边栏/面板交互**:
  - 文件管理器的左侧导航栏 (`SidebarNav.vue`) 的样式和折叠行为可参考全局的 `SideBar.vue` 或编辑器内的 `SidebarManager.vue` 左侧图标栏。
  - 右侧/底部用于显示文件详情/预览的 `FileDetailPanel.vue`，其面板切换和管理逻辑可借鉴 `SidebarManager.vue` 的动态组件加载和标签页模式。
- **Tooltip**: 全局使用 `v-comfy-tooltip` 指令提供上下文提示。
- **滚动**: 内容区域的滚动将使用 `OverlayScrollbarsComponent`。
- **API 调用与状态管理**: 遵循项目中 `useApi` hook 和 Pinia store 的现有模式，包括错误处理和数据验证（如使用 Zod）。
- **设置界面**: 如果文件管理器未来需要独立的设置项，其配置界面的呈现和触发方式（例如通过 `uiStore` 打开模态框，内容使用 `SettingsLayout.vue` 模式）可参考现有设置功能的实现。

通过这种方式，文件管理器将不仅仅是一个新功能，更是项目现有优秀实践的延伸和应用。

## 12. 性能优化与可扩展性

- **虚拟化**: 对包含大量文件的目录实现虚拟滚动，减少 DOM 节点数量。
- **缓存策略**:
  - 缓存目录列表数据，避免重复请求。
  - 缓存文件缩略图和预览内容。
  - 实现智能刷新，只在必要时更新数据。
- **懒加载**:
  - 图片预览和缩略图使用懒加载。
  - 深层目录内容按需加载。
- **预加载**: 对用户可能访问的相邻目录进行预加载。
- **数据压缩**: 考虑对大量文件列表数据进行压缩传输。
- **增量更新**: 支持文件系统变化的增量同步，而不是完全重新加载。

## 13. 安全性考虑

- **权限验证**: 确保所有文件操作都经过后端权限验证。
- **路径验证**: 对用户输入的路径进行严格验证，防止路径遍历攻击。
- **文件类型检查**: 上传文件时进行文件类型和大小 validation。
- **访问日志**: 记录文件访问和操作日志，用于 audit 和安全监控。
- **敏感信息保护**: 确保不在前端暴露敏感的系统路径或配置信息。

## 14. 后续步骤与迭代

1.  **第一阶段** (MVP):
    - 基础文件浏览和操作功能
    - 简单的列表视图
    - 基本的导航和搜索
2.  **第二阶段** (增强):
    - 网格视图和预览功能
    - 高级筛选和排序
    - 最近访问和收藏夹
3.  **第三阶段** (优化):
    - 详情面板和操作选项
    - 性能优化和虚拟化
    - 移动端优化
4.  **第四阶段** (高级功能):
    - 文件版本管理
    - 协作功能 (如果需要)
    - 插件化的文件操作

此设计文档为 FAM 系统前端文件管理器的开发提供了全面的蓝图。在实际开发过程中，细节可能会根据具体需求和遇到的问题进行调整，但总体架构和设计原则将保持稳定。
