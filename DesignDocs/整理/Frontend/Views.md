# 前端视图/页面组件 (`apps/frontend-vueflow/src/views/`)

## 1. 视图/页面组件概览

### 目录职责

[`apps/frontend-vueflow/src/views/`](apps/frontend-vueflow/src/views/) 目录是 ComfyTavern 前端应用中存放**顶级页面级组件**的核心位置。这些组件通常由 Vue Router 直接渲染，并对应着应用中特定的 URL 路径。它们代表了用户在应用中可以导航到的不同“页面”或主要功能区域。

### 与 `components/` 的区别

视图组件与 [`apps/frontend-vueflow/src/components/`](apps/frontend-vueflow/src/components/) 目录下的普通组件在职责和粒度上有所不同：

*   **视图组件 (`views/`)**:
    *   通常代表一个完整的页面或应用的一个主要功能区域（例如，编辑器页面、项目列表页面、设置页面）。
    *   负责组织和布局该页面的整体内容。
    *   可能会组合多个来自 [`components/`](apps/frontend-vueflow/src/components/) 目录的通用或特定功能子组件来构建其用户界面。
    *   是 Vue Router 路由配置中的直接目标，与特定的 URL 路径关联。
    *   更侧重于页面级别的逻辑、数据获取和状态管理。

*   **普通组件 (`components/`)**:
    *   通常是更小、更通用的 UI 构建块（例如，按钮、输入框、卡片、模态框、特定的图表或列表项）。
    *   具有较高的可复用性，可以在多个视图组件或其他普通组件中被引用和使用。
    *   更侧重于实现特定的 UI 功能或展示一小块独立的内容。
    *   一般不直接与路由关联，而是作为视图的一部分被渲染。

简而言之，`views/` 存放的是构成应用骨架的“大页面”，而 `components/` 存放的是构建这些页面的“小零件”。

## 2. 主要视图组件详解

以下是对 [`apps/frontend-vueflow/src/views/`](apps/frontend-vueflow/src/views/) 目录下主要视图组件的详细说明：

### [`views/AboutView.vue`](apps/frontend-vueflow/src/views/AboutView.vue:1)

*   **核心功能与用途**:
    *   展示关于 ComfyTavern 项目的详细信息，包括项目定位、核心特性、技术栈、当前状态以及 GitHub 仓库链接。
    *   作为一个静态信息展示页面，帮助用户了解项目的背景和目标。
*   **主要布局结构与子组件**:
    *   整体采用上下滚动布局，包含一个固定的左侧边栏 [`SideBar.vue`](apps/frontend-vueflow/src/views/SideBar.vue:1)。
    *   内容区域使用 [`OverlayScrollbarsComponent`](apps/frontend-vueflow/src/views/AboutView.vue:7) 实现自定义滚动条。
    *   主要内容分为多个卡片式区域：标题、项目描述、核心特点（工作流编排、AI 应用面板、开发者友好、创作平衡）、当前状态、技术栈和 GitHub 链接。
    *   使用了大量 Tailwind CSS 类进行样式设计，并包含一些自定义的动画效果（如卡片悬停、图标脉冲、文本渐变等）。
*   **核心逻辑 (`<script setup>`)**:
    *   导入并使用 [`SideBar.vue`](apps/frontend-vueflow/src/views/SideBar.vue:1) 组件。
    *   使用 [`useThemeStore`](apps/frontend-vueflow/src/stores/theme.ts:1) 来获取当前主题状态（亮色/暗色），并据此调整滚动条样式。
    *   定义了多个 `ref` 用于引用页面上的各个主要区块（如 `titleSection`, `descriptionCard` 等）。
    *   定义了静态数据数组，如 `workflowFeatures`, `appScenes`, `devFeatures`, `balanceFeatures`, `projectStatus`, `techStack`，用于在模板中渲染列表和卡片内容。
    *   在 `onMounted` 生命周期钩子中，设置了一个 `IntersectionObserver` 来实现元素的滚动淡入动画效果。当特定区块进入视口时，会添加 `animate-fade-in-up` 类。
*   **依赖的 Stores/Composables**:
    *   [`useThemeStore`](apps/frontend-vueflow/src/stores/theme.ts:1): 用于主题切换和样式调整。

### [`views/CharacterCardView.vue`](apps/frontend-vueflow/src/views/CharacterCardView.vue:1)

*   **核心功能与用途**:
    *   展示用户的角色卡列表。角色卡通常用于 AI 聊天或故事生成场景。
    *   允许用户浏览他们已有的角色卡。
*   **主要布局结构与子组件**:
    *   包含一个固定的左侧边栏 [`SideBar.vue`](apps/frontend-vueflow/src/views/SideBar.vue:1)。
    *   主要内容区域使用 [`OverlayScrollbarsComponent`](apps/frontend-vueflow/src/views/CharacterCardView.vue:55) 进行滚动。
    *   角色卡以网格形式展示，每个角色卡由 [`CharacterCard.vue`](apps/frontend-vueflow/src/components/CharacterCard.vue:1) 组件渲染。
    *   包含加载状态和错误提示的 UI。
*   **核心逻辑 (`<script setup>`)**:
    *   导入并使用 [`SideBar.vue`](apps/frontend-vueflow/src/views/SideBar.vue:1) 和 [`CharacterCard.vue`](apps/frontend-vueflow/src/components/CharacterCard.vue:1) 组件。
    *   使用 [`useThemeStore`](apps/frontend-vueflow/src/stores/theme.ts:1) 获取主题状态。
    *   使用 [`sillyTavernService`](apps/frontend-vueflow/src/services/SillyTavernService.ts:1) 在 `onMounted` 钩子中异步加载角色卡数据。
    *   `characters` ref 存储加载到的角色卡数据。
    *   `isLoading` 和 `error` refs 用于控制加载状态和错误信息的显示。
*   **依赖的 Stores/Composables**:
    *   [`useThemeStore`](apps/frontend-vueflow/src/stores/theme.ts:1): 用于主题相关的 UI 调整。
    *   [`sillyTavernService`](apps/frontend-vueflow/src/services/SillyTavernService.ts:1): 用于获取角色卡数据。

### [`views/EditorView.vue`](apps/frontend-vueflow/src/views/EditorView.vue:1)

*   **核心功能与用途**:
    *   提供核心的工作流编辑器界面，用户可以在此创建、编辑和管理 AI 工作流。
    *   这是 ComfyTavern 的主要交互界面之一，允许用户通过拖拽节点、连接节点等方式构建复杂的逻辑流程。
*   **主要布局结构与子组件**:
    *   整体采用三栏式布局（可变）：左侧边栏、中间画布、右侧预览/编辑器。
    *   **左侧边栏**: 由 [`SidebarManager.vue`](apps/frontend-vueflow/src/components/graph/sidebar/SidebarManager.vue:1) 管理，包含节点列表、工作流信息、历史记录等面板。
    *   **中间画布**: 由 [`Canvas.vue`](apps/frontend-vueflow/src/components/graph/Canvas.vue:1) 实现，是 VueFlow 的核心，用于展示和操作节点与边。
        *   画布内嵌了 [`HierarchicalMenu.vue`](apps/frontend-vueflow/src/components/common/HierarchicalMenu.vue:1) 作为节点搜索面板。
    *   **右侧可停靠编辑器**: 由 [`DockedEditorWrapper.vue`](apps/frontend-vueflow/src/components/graph/editor/DockedEditorWrapper.vue:1) 实现，用于编辑节点属性或特定内容。
    *   **底部状态栏**: 由 [`StatusBar.vue`](apps/frontend-vueflow/src/components/graph/StatusBar.vue:1) 显示画布状态信息。
    *   **悬浮面板**:
        *   [`NodePreviewPanel.vue`](apps/frontend-vueflow/src/components/graph/sidebar/NodePreviewPanel.vue:1): 用于预览选定节点的信息或输出。
        *   [`RightPreviewPanel.vue`](apps/frontend-vueflow/src/components/graph/sidebar/RightPreviewPanel.vue:1): 可能用于更通用的预览功能。
    *   **模态框**:
        *   [`RegexEditorModal.vue`](apps/frontend-vueflow/src/components/modals/RegexEditorModal.vue:1): 用于编辑节点的正则表达式规则。
*   **核心逻辑 (`<script setup>`)**:
    *   **状态管理**:
        *   大量使用 Pinia stores：[`useNodeStore`](apps/frontend-vueflow/src/stores/nodeStore.ts:1) (节点定义)、[`useWorkflowStore`](apps/frontend-vueflow/src/stores/workflowStore.ts:1) (工作流数据、画布元素、VueFlow 实例)、[`useTabStore`](apps/frontend-vueflow/src/stores/tabStore.ts:1) (标签页管理)、[`useUiStore`](apps/frontend-vueflow/src/stores/uiStore.ts:1) (UI 状态，如模态框可见性)。
    *   **Composables**:
        *   [`useRouteHandler`](apps/frontend-vueflow/src/composables/editor/useRouteHandler.ts:1): 处理路由参数，加载对应的项目和工作流。
        *   [`useCanvasInteraction`](apps/frontend-vueflow/src/composables/canvas/useCanvasInteraction.ts:1): 处理画布上的交互，如添加节点、连接、拖拽。
        *   [`useTabManagement`](apps/frontend-vueflow/src/composables/editor/useTabManagement.ts:1): 管理编辑器标签页的逻辑。
        *   [`useInterfaceWatcher`](apps/frontend-vueflow/src/composables/editor/useInterfaceWatcher.ts:1): 监视工作流接口变化。
        *   [`useKeyboardShortcuts`](apps/frontend-vueflow/src/composables/editor/useKeyboardShortcuts.ts:1): 实现键盘快捷键。
        *   [`useEditorState`](apps/frontend-vueflow/src/composables/editor/useEditorState.ts:1): 管理编辑器级别的状态，如加载状态、选中的预览节点等。
    *   **节点处理**:
        *   动态加载节点定义，并将其映射为 VueFlow 可用的 `nodeTypes`。
        *   处理节点的添加、删除、点击、拖拽事件。
        *   管理节点组 (NodeGroup) 的同步逻辑，当引用的模板工作流发生变化时，更新节点组的接口。
    *   **生命周期**:
        *   `onMounted`: 获取节点定义、初始化路由处理、执行初始的节点组同步检查。
        *   `onUnmounted`: 清理 VueFlow 实例。
    *   **事件处理**:
        *   处理来自子组件的事件，如从侧边栏添加节点 (`handleAddNodeFromPanel`)、画布请求添加节点 (`handleRequestAddNodeFromCanvas`)、节点连接 (`handleConnect`) 等。
        *   处理模态框的显示/隐藏和保存事件。
*   **依赖的 Stores/Composables**:
    *   Stores: [`useNodeStore`](apps/frontend-vueflow/src/stores/nodeStore.ts:1), [`useWorkflowStore`](apps/frontend-vueflow/src/stores/workflowStore.ts:1), [`useTabStore`](apps/frontend-vueflow/src/stores/tabStore.ts:1), [`useUiStore`](apps/frontend-vueflow/src/stores/uiStore.ts:1).
    *   Composables: [`useRouteHandler`](apps/frontend-vueflow/src/composables/editor/useRouteHandler.ts:1), [`useCanvasInteraction`](apps/frontend-vueflow/src/composables/canvas/useCanvasInteraction.ts:1), [`useTabManagement`](apps/frontend-vueflow/src/composables/editor/useTabManagement.ts:1), [`useInterfaceWatcher`](apps/frontend-vueflow/src/composables/editor/useInterfaceWatcher.ts:1), [`useKeyboardShortcuts`](apps/frontend-vueflow/src/composables/editor/useKeyboardShortcuts.ts:1), [`useEditorState`](apps/frontend-vueflow/src/composables/editor/useEditorState.ts:1).

### [`views/HomeLayout.vue`](apps/frontend-vueflow/src/views/HomeLayout.vue:1)

*   **核心功能与用途**:
    *   作为 `/home` 路径下所有子视图（如 [`HomeView.vue`](apps/frontend-vueflow/src/views/HomeView.vue:1), [`ProjectListView.vue`](apps/frontend-vueflow/src/views/ProjectListView.vue:1) 等）的布局容器。
    *   提供一个统一的框架，包含侧边栏和内容展示区域。
*   **主要布局结构与子组件**:
    *   包含一个固定的左侧边栏 [`SideBar.vue`](apps/frontend-vueflow/src/views/SideBar.vue:1)。
    *   使用 `<router-view>` 来渲染匹配当前子路由的组件。
    *   应用了简单的淡入淡出过渡效果 (`<transition name="fade">`) 当子路由切换时。
*   **核心逻辑 (`<script setup>`)**:
    *   导入并使用 [`SideBar.vue`](apps/frontend-vueflow/src/views/SideBar.vue:1) 组件。
    *   逻辑非常简单，主要负责结构布局。
*   **依赖的 Stores/Composables**:
    *   无直接依赖，但其子视图可能会依赖各种 Stores 和 Composables。

### [`views/HomeView.vue`](apps/frontend-vueflow/src/views/HomeView.vue:1)

*   **核心功能与用途**:
    *   作为应用的仪表盘或主页，展示欢迎信息、最近项目概览和角色卡概览。
    *   为用户提供快速访问常用功能的入口。
*   **主要布局结构与子组件**:
    *   内容区域使用 [`OverlayScrollbarsComponent`](apps/frontend-vueflow/src/views/HomeView.vue:4) 进行滚动。
    *   顶部显示欢迎标题和描述。
    *   主要内容分为两个卡片区域：
        *   **最近项目**: 显示最近修改的几个项目，点击可跳转到编辑器。
        *   **角色卡概览**: 使用 [`CharacterCardPreview.vue`](apps/frontend-vueflow/src/components/CharacterCardPreview.vue:1) 组件展示角色卡信息。
    *   包含加载状态和错误提示。
*   **核心逻辑 (`<script setup>`)**:
    *   导入并使用 [`CharacterCardPreview.vue`](apps/frontend-vueflow/src/components/CharacterCardPreview.vue:1) 组件。
    *   使用 [`useThemeStore`](apps/frontend-vueflow/src/stores/theme.ts:1) 获取主题状态。
    *   使用 [`useProjectManagement`](apps/frontend-vueflow/src/composables/editor/useProjectManagement.ts:1) Composable 来获取项目列表、加载状态、错误信息，并提供 `openProject` 方法。
    *   `recentProjects` computed 属性对项目列表进行排序和切片，以显示最近的项目。
    *   `formatDate` 方法用于格式化日期显示。
*   **依赖的 Stores/Composables**:
    *   [`useThemeStore`](apps/frontend-vueflow/src/stores/theme.ts:1): 用于主题相关的 UI 调整。
    *   [`useProjectManagement`](apps/frontend-vueflow/src/composables/editor/useProjectManagement.ts:1): 用于项目数据的获取和管理。

### [`views/ProjectListView.vue`](apps/frontend-vueflow/src/views/ProjectListView.vue:1)

*   **核心功能与用途**:
    *   展示用户的所有工作流项目列表。
    *   允许用户创建新项目或打开现有项目。
*   **主要布局结构与子组件**:
    *   包含一个固定的左侧边栏 [`SideBar.vue`](apps/frontend-vueflow/src/views/SideBar.vue:1)。
    *   主要内容区域使用 [`OverlayScrollbarsComponent`](apps/frontend-vueflow/src/views/ProjectListView.vue:67) 进行滚动。
    *   顶部有标题和“创建新项目”按钮。
    *   项目以卡片形式网格布局展示，每个项目卡片显示名称、描述和最后更新时间。
    *   包含加载状态和错误提示。
*   **核心逻辑 (`<script setup>`)**:
    *   导入并使用 [`SideBar.vue`](apps/frontend-vueflow/src/views/SideBar.vue:1) 组件。
    *   使用 [`useThemeStore`](apps/frontend-vueflow/src/stores/theme.ts:1) 获取主题状态。
    *   使用 [`useProjectManagement`](apps/frontend-vueflow/src/composables/editor/useProjectManagement.ts:1) Composable 获取项目数据、加载状态、错误信息，并提供 `createNewProject` 和 `openProject` 方法。
    *   使用 [`useDialogService`](apps/frontend-vueflow/src/services/DialogService.ts:1) 来弹出输入框，让用户输入新项目的名称。
    *   `promptAndCreateProject` 方法处理创建新项目的流程，包括获取用户输入和调用 `createNewProject`。
*   **依赖的 Stores/Composables**:
    *   [`useThemeStore`](apps/frontend-vueflow/src/stores/theme.ts:1): 用于主题相关的 UI 调整。
    *   [`useProjectManagement`](apps/frontend-vueflow/src/composables/editor/useProjectManagement.ts:1): 用于项目数据的获取和管理。
    *   [`useDialogService`](apps/frontend-vueflow/src/services/DialogService.ts:1): 用于显示创建项目时的输入对话框。

### [`views/SettingsView.vue`](apps/frontend-vueflow/src/views/SettingsView.vue:1)

*   **核心功能与用途**:
    *   提供应用设置界面，允许用户配置应用的各种选项。
*   **主要布局结构与子组件**:
    *   包含一个固定的左侧边栏 [`SideBar.vue`](apps/frontend-vueflow/src/views/SideBar.vue:1)。
    *   主要内容区域由 [`SettingsLayout.vue`](apps/frontend-vueflow/src/components/settings/SettingsLayout.vue:1) 组件负责渲染。[`SettingsLayout.vue`](apps/frontend-vueflow/src/components/settings/SettingsLayout.vue:1) 可能包含多个设置面板或分类。
*   **核心逻辑 (`<script setup>`)**:
    *   导入并使用 [`SideBar.vue`](apps/frontend-vueflow/src/views/SideBar.vue:1) 和 [`SettingsLayout.vue`](apps/frontend-vueflow/src/components/settings/SettingsLayout.vue:1) 组件。
    *   使用 [`useThemeStore`](apps/frontend-vueflow/src/stores/theme.ts:1) 来根据侧边栏的折叠状态调整主内容区的 `margin-left`。
*   **依赖的 Stores/Composables**:
    *   [`useThemeStore`](apps/frontend-vueflow/src/stores/theme.ts:1): 主要用于布局调整。
    *   其子组件 [`SettingsLayout.vue`](apps/frontend-vueflow/src/components/settings/SettingsLayout.vue:1) 可能会依赖 [`useSettingsStore`](apps/frontend-vueflow/src/stores/settingsStore.ts:1) 等。

### [`views/SideBar.vue`](apps/frontend-vueflow/src/views/SideBar.vue:1)

*   **核心功能与用途**:
    *   作为应用的主要导航侧边栏，提供到各个主要视图/页面的链接。
    *   显示当前用户信息（头像、名称）。
    *   提供主题切换和侧边栏折叠/展开功能。
    *   **注意**: 虽然它位于 `views/` 目录下，但其角色更像一个全局布局组件，被多个视图（如 [`HomeLayout.vue`](apps/frontend-vueflow/src/views/HomeLayout.vue:1), [`AboutView.vue`](apps/frontend-vueflow/src/views/AboutView.vue:1), [`SettingsView.vue`](apps/frontend-vueflow/src/views/SettingsView.vue:1) 等）直接引用。
*   **主要布局结构与子组件**:
    *   垂直伸缩布局，顶部是用户信息，中间是导航链接，底部是功能按钮（主题、设置、折叠）。
    *   使用 `<RouterLink>` 实现导航。
    *   图标和文本根据侧边栏的折叠状态动态显示/隐藏。
    *   使用了 `v-comfy-tooltip` 指令为按钮提供提示信息。
*   **核心逻辑 (`<script setup>`)**:
    *   使用 [`useThemeStore`](apps/frontend-vueflow/src/stores/theme.ts:1) 管理主题状态（亮色/暗色/系统、折叠状态、移动端视图）。
    *   使用 [`useAuthStore`](apps/frontend-vueflow/src/stores/authStore.ts:1) 获取当前用户信息（头像、用户名）。
    *   `onMounted`: 在移动端自动折叠侧边栏，并尝试获取用户上下文。
    *   `textClasses` computed 属性根据折叠状态控制文本的显示。
    *   `displayedAvatarUrl` computed 属性处理用户头像的显示逻辑，包括默认头像和处理相对/绝对路径。
    *   `onAvatarError` 处理头像加载失败的情况。
    *   `displayedUsername` computed 属性根据折叠状态显示用户名。
*   **依赖的 Stores/Composables**:
    *   [`useThemeStore`](apps/frontend-vueflow/src/stores/theme.ts:1): 管理侧边栏的显示、主题。
    *   [`useAuthStore`](apps/frontend-vueflow/src/stores/authStore.ts:1): 获取用户信息。

### [`views/TestPanelView.vue`](apps/frontend-vueflow/src/views/TestPanelView.vue:1)

*   **核心功能与用途**:
    *   提供一个用于测试各种 UI 组件和服务的面板，主要用于开发和调试。
    *   测试内容包括：
        *   [`DialogService`](apps/frontend-vueflow/src/services/DialogService.ts:1) 的模态对话框（消息、确认、输入）和通知（Toast）。
        *   [`UiStore`](apps/frontend-vueflow/src/stores/uiStore.ts:1) 控制的全局模态框（如设置模态框、正则编辑器模态框、初始用户名设置模态框）。
        *   [`SettingsControl.vue`](apps/frontend-vueflow/src/components/settings/SettingControl.vue:1) (通过 [`SettingsPanel.vue`](apps/frontend-vueflow/src/components/settings/SettingsPanel.vue:1) 间接测试)。
*   **主要布局结构与子组件**:
    *   页面包含多个 `<section>`，分别对应不同的测试类别。
    *   每个测试类别下有多个按钮，点击按钮触发相应的 UI 组件或服务方法。
    *   有专门的区域显示操作结果 (`dialogServiceResult`, `uiStoreResult`)。
    *   直接使用了 [`InitialUsernameSetupModal.vue`](apps/frontend-vueflow/src/components/auth/InitialUsernameSetupModal.vue:1) 和 [`SettingsPanel.vue`](apps/frontend-vueflow/src/components/settings/SettingsPanel.vue:1) 组件。
*   **核心逻辑 (`<script setup>`)**:
    *   导入并使用 [`useDialogService`](apps/frontend-vueflow/src/services/DialogService.ts:1), [`useUiStore`](apps/frontend-vueflow/src/stores/uiStore.ts:1), [`useSettingsStore`](apps/frontend-vueflow/src/stores/settingsStore.ts:1)。
    *   `dialogServiceResult` 和 `uiStoreResult` refs 用于在界面上显示操作反馈。
    *   `isInitialUsernameSetupModalVisible` ref 控制初始用户名设置模态框的显隐。
    *   定义了 `testSettingItems` 作为传递给 [`SettingsPanel.vue`](apps/frontend-vueflow/src/components/settings/SettingsPanel.vue:1) 的配置数据。
    *   包含大量的方法 (`showMessageDialog`, `showConfirmDialog`, `openSettings`, `openRegexEditor` 等) 来触发各种测试场景。
    *   `executeDialogAction` 是一个辅助函数，用于封装调用 `DialogService` 异步方法并更新结果的通用逻辑。
    *   使用 `watch` 监听 `uiStore.isSettingsModalVisible` 的变化来更新 `uiStoreResult`。
*   **依赖的 Stores/Composables**:
    *   [`useDialogService`](apps/frontend-vueflow/src/services/DialogService.ts:1): 用于测试对话框和通知。
    *   [`useUiStore`](apps/frontend-vueflow/src/stores/uiStore.ts:1): 用于测试全局模态框。
    *   [`useSettingsStore`](apps/frontend-vueflow/src/stores/settingsStore.ts:1): 用于验证设置项的更新。

## 3. 视图与路由的关联

上述视图组件（除 [`SideBar.vue`](apps/frontend-vueflow/src/views/SideBar.vue:1) 外，它更像一个布局组件）都在 [`apps/frontend-vueflow/src/router/index.ts`](apps/frontend-vueflow/src/router/index.ts:1) 文件中被配置为特定 URL 路径的渲染目标。

关键点：

*   **根路径 `/` 重定向**: 重定向到 `/home`。
*   **HomeLayout**: [`HomeLayout.vue`](apps/frontend-vueflow/src/views/HomeLayout.vue:1) 作为 `/home` 路径下所有子路由的布局容器，这些子路由包括：
    *   `/home` (空路径, 默认): [`HomeView.vue`](apps/frontend-vueflow/src/views/HomeView.vue:1)
    *   `/home/projects`: [`ProjectListView.vue`](apps/frontend-vueflow/src/views/ProjectListView.vue:1)
    *   `/home/characters`: [`CharacterCardView.vue`](apps/frontend-vueflow/src/views/CharacterCardView.vue:1)
    *   `/home/about`: [`AboutView.vue`](apps/frontend-vueflow/src/views/AboutView.vue:1) (懒加载)
    *   `/home/settings`: [`SettingsView.vue`](apps/frontend-vueflow/src/views/SettingsView.vue:1) (懒加载)
    *   `/home/settings/test-panel`: [`TestPanelView.vue`](apps/frontend-vueflow/src/views/TestPanelView.vue:1) (懒加载)
*   **编辑器路由**:
    *   `/projects/:projectId/editor/:workflowId?`: 对应 [`EditorView.vue`](apps/frontend-vueflow/src/views/EditorView.vue:1)。
    *   此路由包含一个 `beforeEnter` 导航守卫，用于在进入编辑器前加载指定的项目数据。它会使用 [`useProjectStore`](apps/frontend-vueflow/src/stores/projectStore.ts:1) 来执行项目加载逻辑。如果项目加载失败或项目 ID 无效，则会重定向到主页。`workflowId` 是可选参数。

关于路由配置的更详细信息，请参阅文档 [`DesignDocs/整理/Frontend/Routing.md`](DesignDocs/整理/Frontend/Routing.md:1)。