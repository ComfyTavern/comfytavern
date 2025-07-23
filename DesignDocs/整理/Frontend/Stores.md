# 前端状态管理 (Pinia Stores)

## 1. 概览

前端应用的状态管理主要集中在 [`apps/frontend-vueflow/src/stores/`](apps/frontend-vueflow/src/stores/) 目录中。该目录下的每个 `.ts` 文件（通常以 `Store` 结尾，例如 [`authStore.ts`](apps/frontend-vueflow/src/stores/authStore.ts:1)）代表一个独立的 Pinia store 模块，负责管理应用中特定领域的状态。

Pinia 是一个基于 Vue 3 Composition API 的状态管理库，它具有以下特点和优势：

- **集中式管理**：将全局或跨组件共享的状态集中存储和管理，使得状态变化更易于追踪和维护。
- **响应式更新**：Pinia store 中的状态是响应式的，当状态发生变化时，依赖这些状态的组件会自动更新。
- **类型安全**：与 TypeScript 良好集成，提供强大的类型推断和检查，有助于减少运行时错误。
- **模块化**：允许将状态分割到不同的 store 模块中，每个模块关注特定的业务领域，提高了代码的可组织性和可维护性。
- **Vue Devtools 支持**：与 Vue Devtools 集成良好，方便在开发过程中检查和调试状态。
- **持久化**：可以通过插件（如 `pinia-plugin-persistedstate`，或如本项目中 [`settingsStore.ts`](apps/frontend-vueflow/src/stores/settingsStore.ts:1) 手动实现的 `localStorage`）将状态持久化，以便在页面刷新或会话之间保留用户偏好或应用状态。

## 2. 主要 Store 详解

以下是对 [`apps/frontend-vueflow/src/stores/`](apps/frontend-vueflow/src/stores/) 目录下主要 Pinia store 的详细说明：

### [`authStore.ts`](apps/frontend-vueflow/src/stores/authStore.ts:1)

- **核心职责/管理的状态领域**：
  - 管理用户的认证状态、用户上下文信息（包括用户详情、服务 API 密钥、外部凭证等）。
  - 处理用户登录、登出、获取用户上下文、管理 API 密钥和外部凭证的逻辑。
  - 管理用户名的更新。
- **关键 State 属性**：
  - `userContext: UserContext | null`：存储当前用户的完整上下文信息。
  - `isLoadingContext: boolean`：标记是否正在加载用户上下文。
  - `contextError: unknown | null`：存储加载用户上下文时发生的错误。
  - `newlyCreatedApiKeySecret: string | null`：临时存储新创建的 API 密钥的 secret，方便 UI 展示后清除。
- **关键 Getters**：
  - `isAuthenticated: boolean`：根据不同的认证模式判断用户是否已认证。
  - `currentUser: User | null`：获取当前登录的用户对象。
  - `currentMode: string | null`：获取当前的认证模式。
  - `serviceApiKeys: ServiceApiKeyMetadata[]`：获取当前用户的服务 API 密钥列表。
  - `externalCredentials: ExternalCredentialMetadata[]`：获取当前用户的外部凭证列表。
- **关键 Actions**：
  - `fetchUserContext()`：异步获取并更新当前用户的上下文信息。
  - `createNewApiKey(payload: CreateServiceApiKeyPayload)`：创建新的服务 API 密钥，并刷新用户上下文。
  - `removeApiKey(keyId: string)`：删除指定的服务 API 密钥，并刷新用户上下文。
  - `addNewCredential(payload: CreateExternalCredentialPayload)`：添加新的外部凭证，并刷新用户上下文。
  - `removeCredential(credentialId: string)`：删除指定的外部凭证，并刷新用户上下文。
  - `clearNewlyCreatedApiKeySecret()`：清除临时存储的新 API 密钥 secret。
  - `updateUsername(newUsername: string)`：更新用户的默认用户名，并刷新用户上下文。
- **典型使用场景/消费者**：
  - 应用初始化时获取用户状态（例如在 `App.vue` 或路由守卫中）。
  - 用户设置页面，用于展示和管理 API 密钥、外部凭证、用户名。
  - 需要根据用户认证状态控制访问权限的组件或路由。

### [`executionStore.ts`](apps/frontend-vueflow/src/stores/executionStore.ts:1)

- **核心职责/管理的状态领域**：
  - 管理工作流执行相关的状态，按标签页（`internalId`）分别存储。
  - 追踪每个标签页中工作流的整体执行状态（如 IDLE, QUEUED, RUNNING, COMPLETE, ERROR）。
  - 追踪每个节点的执行状态、进度、错误信息、最终输出和预览输出。
  - 处理和存储节点的流式输出内容（`NODE_YIELD`）和工作流接口的流式输出（`WORKFLOW_INTERFACE_YIELD`）。
  - 管理全局预览模式的开关状态。
  - 注册和管理节点客户端脚本的执行器。
- **关键 State 属性**：
  - `tabExecutionStates: Map<string, TabExecutionState>`：一个 Map 对象，键为标签页的 `internalId`，值为该标签页的详细执行状态对象 `TabExecutionState`。
    - `TabExecutionState` 包含：`promptId`, `workflowStatus`, `workflowError`, `nodeStates`, `nodeErrors`, `nodeProgress`, `nodeOutputs`, `nodePreviewOutputs`, `streamingNodeContent`, `streamingInterfaceOutputs`。
  - `isPreviewEnabled: Ref<boolean>`：全局预览模式是否开启。
  - `nodeClientScriptExecutors: Map<string, ClientScriptHookExecutor>`：存储节点 ID 到其客户端脚本执行器的映射。
- **关键 Getters**：
  - 提供一系列针对特定标签页和节点的 getter，例如：
    - `getWorkflowStatus(internalId: string)`
    - `getCurrentPromptId(internalId: string)`
    - `getNodeState(internalId: string, nodeId: string)`
    - `getNodeOutput(internalId: string, nodeId: string, outputKey: string)`
    - `getAllNodeOutputs(internalId: string, nodeId: string)` (获取节点的所有最终输出)
    - `getNodePreviewOutput(internalId: string, nodeId: string, outputKey: string)`
    - `getAllNodePreviewOutputs(internalId: string, nodeId: string)` (获取节点的所有预览输出)
    - `getAccumulatedStreamedText(internalId: string, nodeId: string)` (节点流式文本)
    - `getRawStreamedChunks(internalId: string, nodeId: string)` (节点流式原始块)
    - `getAccumulatedInterfaceStreamedText(internalId: string, interfaceOutputKey: string)` (接口流式文本)
    - `getRawInterfaceStreamedChunks(internalId: string, interfaceOutputKey: string)` (接口流式原始块)
    - `isInterfaceStreamComplete(internalId: string, interfaceOutputKey: string)` (接口流是否完成)
    - `getNodeClientScriptExecutor(nodeId: string)`
- **关键 Actions**：
  - `togglePreview()`：切换全局预览模式。
  - `ensureTabExecutionState(internalId: string)`：确保指定标签页的执行状态对象存在。
  - `prepareForNewExecution(internalId: string)`：重置指定标签页的执行状态，为新的执行做准备，包括清除流式内容和接口内容。
  - `handlePromptAccepted(internalId: string, payload: PromptAcceptedResponsePayload)`：处理后端接受执行请求后的消息。
  - `updateWorkflowStatus(internalId: string, payload: ExecutionStatusUpdatePayload)`：更新工作流的整体状态。
  - `updateNodeExecuting(internalId: string, payload: NodeExecutingPayload)`：标记节点开始执行。
  - `updateNodeProgress(internalId: string, payload: NodeProgressPayload)`：更新节点执行进度。
  - `updateNodeExecutionResult(internalId: string, payload: NodeCompletePayload)`：处理节点执行完成并存储结果（区分主工作流和预览工作流）。
  - `updateNodeError(internalId: string, payload: NodeErrorPayload)`：处理节点执行错误。
  - `handleNodeYield(internalId: string, payload: NodeYieldPayload)`：处理节点的流式输出。
  - `handleWorkflowInterfaceYield(internalId: string, payload: WorkflowInterfaceYieldPayload)`：处理工作流接口的流式输出。
  - `removeTabExecutionState(internalId: string)`：当标签页关闭时，移除其执行状态。
  - `setWorkflowStatusManually(internalId: string, status: ExecutionStatus, associatedPromptId?: NanoId)`：手动设置工作流状态。
  - `registerNodeClientScriptExecutor(nodeId: string, executor: ClientScriptHookExecutor)`：注册节点客户端脚本执行器。
  - `unregisterNodeClientScriptExecutor(nodeId: string)`：注销节点客户端脚本执行器。
- **典型使用场景/消费者**：
  - 画布界面 ([`apps/frontend-vueflow/src/components/graph/Canvas.vue`](apps/frontend-vueflow/src/components/graph/Canvas.vue:1))，用于展示节点状态、进度条、输出结果。
  - 状态栏 ([`apps/frontend-vueflow/src/components/graph/StatusBar.vue`](apps/frontend-vueflow/src/components/graph/StatusBar.vue:1))，显示工作流执行状态。
  - 历史面板、预览面板等侧边栏组件。
  - WebSocket 消息处理器，根据后端推送的执行事件更新 store。
  - 需要执行客户端脚本的节点组件。

### [`nodeStore.ts`](apps/frontend-vueflow/src/stores/nodeStore.ts:1)

- **核心职责/管理的状态领域**：
  - 管理前端可用的节点定义列表。
  - 负责从后端获取所有节点定义，并提供搜索和按类型查找节点定义的功能。
  - 处理后端节点重载的通知，并重新获取节点定义。
- **关键 State 属性**：
  - `nodeDefinitions: Ref<FrontendNodeDefinition[]>`：存储所有前端节点定义的数组。`FrontendNodeDefinition` 是一个排除了后端特定字段并可能包含前端特有字段（如 `clientScriptUrl`）的类型。
  - `definitionsLoaded: Ref<boolean>`：标记节点定义是否已成功加载。
  - `loading: Ref<boolean>`：标记是否正在加载节点定义。
  - `error: Ref<string | null>`：存储加载节点定义时发生的错误信息。
  - `notifiedNodesReloaded: Ref<boolean>`：标记是否已收到后端节点重载的通知。
  - `reloadError: Ref<string | null>`：存储节点重载过程中发生的错误信息。
- **关键 Getters**：
  - `nodeDefinitionsByCategory: ComputedRef<Record<string, FrontendNodeDefinition[]>>`：将节点定义按类别（`category` 字段）分组。
- **关键 Actions**：
  - `fetchAllNodeDefinitions(showLoading = true)`：异步从后端 API (`/nodes`) 获取所有节点定义。
  - `searchNodeDefinitions(query: string)`：根据关键词搜索节点定义（匹配名称、类型、命名空间、描述、类别）。
  - `getNodeDefinitionByFullType(fullType: string)`：根据节点的完整类型（`namespace:type` 或仅 `type`）获取单个节点定义。
  - `ensureDefinitionsLoaded()`：确保节点定义已加载，如果未加载则触发加载。这是一个常用的辅助函数，在其他组件或 store 需要节点定义时调用。
  - `handleNodesReloadedNotification(payload: NodesReloadedPayload)`：处理来自后端的节点已重载通知，如果成功则重新获取所有节点定义。
- **典型使用场景/消费者**：
  - 节点面板 ([`apps/frontend-vueflow/src/components/graph/sidebar/NodePanel.vue`](apps/frontend-vueflow/src/components/graph/sidebar/NodePanel.vue:1))，用于展示可拖拽到画布上的节点列表。
  - 画布组件，当从数据加载工作流或创建新节点时，需要根据节点类型获取其定义。
  - WebSocket 消息处理器，当收到节点重载通知时调用 `handleNodesReloadedNotification`。
  - 应用初始化阶段，调用 `ensureDefinitionsLoaded` 以确保节点定义可用。

### [`performanceStatsStore.ts`](apps/frontend-vueflow/src/stores/performanceStatsStore.ts:1)

- **核心职责/管理的状态领域**：
  - 管理前端性能相关的统计数据，主要按标签页（`internalId`）分别存储。
  - 追踪每个标签页的性能统计项（`StatItem[]`），例如组件渲染耗时、函数执行时间等。
  - 追踪每个标签页是否已收集过性能数据以及当前的加载状态。
  - 追踪每个标签页中不同类型组件的实例计数。
- **关键 State 属性**：
  - `statsByTab: Ref<Map<string, StatItem[]>>`：存储每个标签页的性能统计条目数组。
  - `collectedByTab: Ref<Map<string, boolean>>`：标记每个标签页是否已收集过性能数据。
  - `loadingByTab: Ref<Map<string, boolean>>`：标记每个标签页的性能数据加载状态。
  - `componentCountsByTab: Ref<Map<string, Record<string, number>>>`：存储每个标签页中各类组件的实例数量。
- **关键 Getters**：
  - `getStats(tabInternalId: string): StatItem[] | undefined`：获取指定标签页的性能统计数据。
  - `hasCollected(tabInternalId: string): boolean`：检查指定标签页是否已收集过数据。
  - `isLoading(tabInternalId: string): boolean`：检查指定标签页是否正在加载数据。
  - `getComponentStats(tabInternalId: string): Record<string, number> | undefined`：获取指定标签页的组件实例计数。
- **关键 Actions**：
  - `setStats(tabInternalId: string, stats: StatItem[])`：设置指定标签页的性能统计数据。
  - `setLoading(tabInternalId: string, isLoadingState: boolean)`：设置指定标签页的加载状态。
  - `clearStats(tabInternalId: string)`：清除指定标签页的所有性能统计数据和组件计数。
  - `incrementComponentCount(tabInternalId: string, componentType: string)`：增加指定标签页中特定类型组件的计数。
  - `decrementComponentCount(tabInternalId: string, componentType: string)`：减少指定标签页中特定类型组件的计数。
  - `setComponentUsageStats(tabInternalId: string, componentUsage: Record<string, number>)`：直接设置指定标签页的组件使用统计。
- **典型使用场景/消费者**：
  - 性能面板 ([`apps/frontend-vueflow/src/components/graph/sidebar/PerformancePanel.vue`](apps/frontend-vueflow/src/components/graph/sidebar/PerformancePanel.vue:1))，用于展示和刷新性能数据。
  - Vue 组件的生命周期钩子（如 `onMounted`, `onUnmounted`）中，调用 `incrementComponentCount` 和 `decrementComponentCount` 来追踪组件实例。
  - 需要收集和展示性能指标的调试工具或开发辅助功能。

### [`projectStore.ts`](apps/frontend-vueflow/src/stores/projectStore.ts:1)

- **核心职责/管理的状态领域**：
  - 管理当前活动的项目及其元数据。
  - 负责加载项目元数据、获取可用项目列表以及创建新项目。
- **关键 State 属性**：
  - `currentProjectId: Ref<string | null>`：当前活动项目的 ID。
  - `currentProjectMetadata: Ref<ProjectMetadata | null>`：当前活动项目的元数据。
  - `isLoading: Ref<boolean>`：标记是否正在加载项目数据。
  - `error: Ref<string | null>`：存储加载或创建项目时发生的错误信息。
  - `availableProjects: Ref<ProjectMetadata[]>`：存储从后端获取的所有可用项目元数据列表。
- **关键 Getters**：
  - （此 store 没有显式定义 getters，所有状态直接通过 `ref` 暴露）
- **关键 Actions**：
  - `loadProject(projectId: string): Promise<boolean>`：异步从后端 API (`/projects/{projectId}/metadata`) 加载指定项目的元数据，并使用 Zod schema ([`ProjectMetadataSchema`](packages/types/src/schemas.ts:1)) 进行验证。成功加载后会更新 `currentProjectId` 和 `currentProjectMetadata`。
  - `fetchAvailableProjects(): Promise<void>`：异步从后端 API (`/projects`) 获取所有可用项目的元数据列表，并更新 `availableProjects`。
  - `createProject(projectData: { name: string; description?: string }): Promise<ProjectMetadata | null>`：异步向后端 API (`/projects`) 发送请求以创建新项目。成功创建后会重新获取项目列表并返回新项目的元数据。
  - `updateProject(projectId: string, projectData: Partial<Pick<ProjectMetadata, 'name' | 'description'>>): Promise<ProjectMetadata | null>`：更新指定项目的元数据。
  - `deleteProject(projectId: string): Promise<boolean>`：删除指定项目。
- **典型使用场景/消费者**：
  - 应用初始化时，根据 URL 或其他逻辑加载特定项目。
  - 项目列表视图 ([`apps/frontend-vueflow/src/views/ProjectListView.vue`](apps/frontend-vueflow/src/views/ProjectListView.vue:1))，用于展示、选择和创建项目。
  - [`tabStore.ts`](apps/frontend-vueflow/src/stores/tabStore.ts:1)，在添加新标签页或同步 URL 时需要获取当前项目 ID。
  - 其他需要访问当前项目信息的组件或 store。

### [`settingsStore.ts`](apps/frontend-vueflow/src/stores/settingsStore.ts:1)

- **核心职责/管理的状态领域**：
  - 管理应用级别的用户设置。
  - 负责从 `localStorage` 加载已保存的设置，并在设置更新时通过防抖函数将其保存回 `localStorage`。
  - 提供获取和更新单个设置项的方法，并支持从配置中读取默认值。
- **关键 State 属性**：
  - `settings: Ref<Record<string, any>>`：一个对象，键为设置项的 `key` (来自 `SettingItemConfig.key`)，值为该设置项的当前值。
  - `i18nSettings: I18nSettings`：存储国际化（i18n）相关的设置，包括当前语言、回退语言和自动检测开关。
- **关键 Getters**：
  - （此 store 没有显式定义 getters，设置值通过 `getSetting` action 获取，`i18nSettings` 直接响应式。）
- **关键 Actions**：
  - `loadSettings()`：从 `localStorage` (键为 `app_settings`) 加载设置，包括 `settings` 和 `i18nSettings`。
  - `saveSettings()`：将当前 `settings` 和 `i18nSettings` 对象序列化并保存到 `localStorage`。此操作被防抖处理（默认 500ms），以避免频繁写入。
  - `updateSetting(key: string, value: any)`：更新指定 `key` 的设置项的值。此操作会触发 `watch`，进而调用 `saveSettings`。
  - `getSetting(key: string, defaultValueFromConfig: any): any`：获取指定 `key` 的设置项的值。如果 `settings` 对象中不存在该 `key` 或其值为 `undefined`，则返回 `defaultValueFromConfig`。
  - `initializeDefaultSettings(configs: SettingItemConfig[])`：批量初始化设置。对于 `configs` 数组中的每个配置项，如果其 `key` 在当前 `settings` 中不存在，则将其设置为 `config.defaultValue`。
  - `setLanguage(langCode: string)`：设置当前的语言代码，并关闭自动检测功能。
- **典型使用场景/消费者**：
  - 设置面板 ([`apps/frontend-vueflow/src/components/settings/SettingsPanel.vue`](apps/frontend-vueflow/src/components/settings/SettingsPanel.vue:1)) 和设置项控件 ([`apps/frontend-vueflow/src/components/settings/SettingControl.vue`](apps/frontend-vueflow/src/components/settings/SettingControl.vue:1))，用于展示和修改用户设置。
  - 应用初始化时（`onMounted` 钩子内），调用 `loadSettings`。
  - 任何需要根据用户偏好调整行为的组件或模块，通过 `getSetting` 获取设置值。
- **状态管理模式与最佳实践体现**：
  - **状态持久化**：通过 `localStorage` 实现设置的持久化。
  - **防抖 (Debounce)**：在保存设置到 `localStorage` 时使用防抖函数，优化性能，避免过于频繁的写操作。

### [`tabStore.ts`](apps/frontend-vueflow/src/stores/tabStore.ts:1)

- **核心职责/管理的状态领域**：
  - 管理编辑器中打开的标签页（tabs）的状态。
  - 包括标签页的列表、当前活动的标签页 ID。
  - 处理标签页的添加、移除、更新和激活逻辑。
  - 与 Vue Router 同步，确保活动标签页与 URL 路径参数（如 `projectId`, `workflowId`）保持一致。
  - 处理标签页关闭时的确认（如果存在未保存的更改）。
  - 管理特定类型标签页（如 `groupEditor`）的打开逻辑。
- **关键 State 属性**：
  - `tabs: Ref<Tab[]>`：存储所有打开的标签页对象的数组。每个 `Tab` 对象包含 `internalId`, `projectId`, `type`, `label`, `associatedId`, `isDirty`。
  - `activeTabId: Ref<string | null>`：当前活动的标签页的 `internalId`。
- **关键 Getters**：
  - `activeTab: ComputedRef<Tab | null>`：根据 `activeTabId` 计算并返回当前活动的标签页对象。
- **关键 Actions**：
  - `addTab(type: TabType, label: string, associatedId: string | null, setActive: boolean, projectId?: string): Tab | null`：添加一个新的标签页。
  - `removeTab(internalId: string): Promise<void>`：移除指定的标签页。如果标签页有未保存更改 (`isDirty`)，会使用 [`DialogService`](apps/frontend-vueflow/src/services/DialogService.ts:1) 弹出确认对话框。关闭标签页时，会清理关联的 [`workflowStore`](apps/frontend-vueflow/src/stores/workflowStore.ts:1) 和 [`performanceStatsStore`](apps/frontend-vueflow/src/stores/performanceStatsStore.ts:1) 中的状态。
  - `removeTabs(internalIds: string[])`：批量移除标签页，不进行脏检查，用于启动时清理无效标签页。
  - `updateTab(internalId: string, updates: Partial<Omit<Tab, "internalId" | "type" | "projectId">>): void`：更新指定标签页的属性（如 `label`, `associatedId`, `isDirty`）。
  - `setActiveTab(internalId: string | null): void`：设置活动标签页，并负责将 URL 与新激活的标签页同步。
  - `initializeDefaultTab(): void`：当没有标签页或活动标签页不属于当前项目时，初始化一个默认的标签页。
  - `clearTabsForProject(projectIdToClear: string): void`：清除属于特定项目的所有标签页。
  - `openGroupEditorTab(referencedWorkflowId: string, projectId?: string): Promise<void>`：打开一个用于编辑引用工作流（作为组）的特殊标签页。
  - `loadAndOpenWorkflowById(projectId: string, workflowId: string)`：根据 workflowId 加载并打开工作流标签页，如果不存在则创建。
- **典型使用场景/消费者**：
  - 标签栏组件 ([`apps/frontend-vueflow/src/components/graph/TabBar.vue`](apps/frontend-vueflow/src/components/graph/TabBar.vue:1))，用于显示和管理标签页。
  - 编辑器视图 ([`apps/frontend-vueflow/src/views/EditorView.vue`](apps/frontend-vueflow/src/views/EditorView.vue:1))，根据活动标签页渲染对应的内容。
  - 路由守卫或 `App.vue`，用于在项目加载或 URL 变化时同步标签页状态。
  - [`workflowStore.ts`](apps/frontend-vueflow/src/stores/workflowStore.ts:1)，在进行历史操作（undo/redo）或加载工作流时，需要知道当前的活动标签页。
  - 任何需要根据当前活动标签页信息进行操作的组件。

### [`theme.ts`](apps/frontend-vueflow/src/stores/theme.ts:1) (主题管理 Store)

- **核心职责/管理的状态领域**：
  - 管理应用的主题外观，包括主题预设的选择和亮/暗模式的切换。
  - 加载系统内置主题和用户自定义主题。
  - 动态应用主题相关的 CSS 变量。
- **关键 State 属性**：
  - `availableThemes: Ref<ThemePreset[]>`：所有可用的主题预设列表（包括系统和用户自定义）。
  - `selectedThemeId: Ref<string>`：当前选中的主题预设的唯一 ID。
  - `displayMode: Ref<DisplayMode>` (`'light' | 'dark' | 'system'`)：用户选择的显示模式（亮色、暗色或跟随系统）。
  - `userCustomThemes: Ref<ThemePreset[]>`：用户自定义并保存的主题列表（阶段二功能）。
- **关键 Getters**：
  - `currentAppliedMode: ComputedRef<'light' | 'dark'>`：根据 `displayMode` 和系统偏好计算出的当前实际应用的模式（`'light'` 或 `'dark'`）。
  - `currentThemePreset: ComputedRef<ThemePreset | undefined>`：当前选中的主题预设对象。
- **关键 Actions**：
  - `initTheme()`：初始化主题系统，加载可用主题并应用当前主题。
  - `loadAvailableThemes()`：异步从预定义位置（系统文件和用户文件）加载所有主题预设。
  - `selectThemePreset(themeId: string)`：根据 ID 选择一个主题预设，并将其保存到 `localStorage`。
  - `setDisplayMode(mode: DisplayMode)`：设置应用的显示模式（亮色/暗色/跟随系统），并将其保存到 `localStorage`。
  - `applyCurrentTheme()`：根据当前选择的主题预设和显示模式，动态应用 CSS 变量和设置 `<html>` 元素的 `data-theme` 和 `dark` 类。
  - `saveUserTheme(theme: ThemePreset)` (阶段二)：保存用户自定义主题。
  - `deleteUserTheme(themeId: string)` (阶段二)：删除用户自定义主题。
  - `updateUserTheme(themeId: string, updatedVariables: Partial<ThemePreset['variants']['light']['variables']>)` (阶段二)：更新用户自定义主题的变量。
- **典型使用场景/消费者**：
  - 应用根组件 ([`apps/frontend-vueflow/src/App.vue`](apps/frontend-vueflow/src/App.vue:1)) 在应用启动时调用 `initTheme`。
  - 设置面板中提供主题选择器和亮/暗模式切换的 UI 组件。
  - 任何需要根据当前主题颜色或模式调整样式的组件。
- **状态管理模式与最佳实践体现**：
  - **状态持久化**：通过 `localStorage` 持久化用户选择的 `selectedThemeId` 和 `displayMode`。
  - **系统偏好集成**：能够响应操作系统的暗色模式偏好 (`window.matchMedia('(prefers-color-scheme: dark)')`)。
  - **模块化管理**：将主题的加载、选择、应用逻辑封装在独立的 Store 中。
  - **动态 CSS 变量**：通过直接操作 CSS 变量 (`document.documentElement.style.setProperty`) 实现主题的动态切换。

### [`tooltipStore.ts`](apps/frontend-vueflow/src/stores/tooltipStore.ts:1)

- **核心职责/管理的状态领域**：
  - 管理全局唯一的 Tooltip（提示框）的显示状态、内容和定位。
  - 与 `@floating-ui/vue` 库集成，处理 Tooltip 的动态定位（如 `offset`, `flip`, `shift`）。
  - 提供显示和隐藏 Tooltip 的方法，并支持延迟显示/隐藏、交互性等选项。
- **关键 State 属性**：
  - `isVisible: Ref<boolean>`：Tooltip 当前是否可见。
  - `content: Ref<string>`：Tooltip 显示的文本内容。
  - `targetElement: ShallowRef<HTMLElement | null>`：Tooltip 指向的目标 HTML 元素。
  - `options: Ref<TooltipOptions>`：当前 Tooltip 的配置选项（如 `placement`, `delayShow`, `width`, `maxWidth` 等）。
  - `floatingElement: ShallowRef<HTMLElement | null>`：Tooltip 渲染器组件的根元素，用于 `@floating-ui` 定位。
  - `floatingStyles: ComputedRef<CSSProperties>`：由 `@floating-ui` 计算得出的 Tooltip 样式（主要用于定位）。
- **关键 Getters**：
  - （状态和计算属性直接通过 ref/computed 暴露）
- **关键 Actions**：
  - `show(payload: { targetElement: HTMLElement; content: string; options?: Partial<TooltipOptions> })`：显示 Tooltip。接收目标元素、内容和可选的配置。
  - `hide(forceImmediate: boolean = false)`：隐藏 Tooltip。支持立即隐藏或根据 `delayHide` 延迟隐藏。
  - `setFloatingElement(el: HTMLElement | null)`：设置 Tooltip 渲染器组件的根元素。
  - `updateFloatingUiPosition()`：手动触发 `@floating-ui` 的位置更新计算。
  - `clearTimeouts()`：清除显示和隐藏的延迟计时器。
- **典型使用场景/消费者**：
  - 全局 Tooltip 渲染器组件 ([`apps/frontend-vueflow/src/components/common/TooltipRenderer.vue`](apps/frontend-vueflow/src/components/common/TooltipRenderer.vue:1))，负责根据 store 的状态渲染实际的 Tooltip UI。
  - Vue 指令 `v-comfy-tooltip` ([`apps/frontend-vueflow/src/directives/vComfyTooltip.ts`](apps/frontend-vueflow/src/directives/vComfyTooltip.ts:1))，用于在 HTML 元素上方便地应用 Tooltip。当指令绑定的元素触发事件（如 hover）时，会调用 `show` action。
  - 任何需要以编程方式控制全局 Tooltip 显示的组件或逻辑。

### [`uiStore.ts`](apps/frontend-vueflow/src/stores/uiStore.ts:1)

- **核心职责/管理的状态领域**：
  - 管理应用中各种全局 UI 元素（主要是模态框、面板和侧边栏）的显示状态、尺寸和相关数据。
  - 控制正则表达式编辑器模态框 ([`apps/frontend-vueflow/src/components/modals/RegexEditorModal.vue`](apps/frontend-vueflow/src/components/modals/RegexEditorModal.vue:1)) 的可见性和数据。
  - 控制设置模态框 ([`apps/frontend-vueflow/src/components/settings/SettingsLayout.vue`](apps/frontend-vueflow/src/components/settings/SettingsLayout.vue:1) 或类似组件) 的可见性和属性（如宽度、高度）。
  - 管理初始用户名设置模态框 ([`apps/frontend-vueflow/src/components/auth/InitialUsernameSetupModal.vue`](apps/frontend-vueflow/src/components/auth/InitialUsernameSetupModal.vue:1)) 的可见性和初始用户名。
  - 提供动态获取 z-index 的功能，以确保新打开的模态框等浮动元素总是在最上层。
  - 管理文件管理器详情面板的开关和宽度。
  - 管理文件管理器左侧导航栏的折叠状态和宽度。
  - 管理主侧边栏的折叠状态和移动端视图的检测。
  - 管理面板日志的高度和列表视图的列宽。
- **关键 State 属性**：
  - `isRegexEditorModalVisible: boolean`：正则表达式编辑器模态框是否可见。
  - `regexEditorModalData: RegexEditorModalData | null`：传递给正则表达式编辑器模态框的数据（包括规则、节点 ID、输入键和保存回调）。
  - `isSettingsModalVisible: boolean`：设置模态框是否可见。
  - `settingsModalProps: { width: string; height: string }`：设置模态框的宽度和高度属性。
  - `baseZIndex: number`：基础 z-index 值。
  - `currentMaxZIndex: number`：当前已分配的最大 z-index 值。
  - `isInitialUsernameSetupModalVisible: boolean`：初始用户名设置模态框是否可见。
  - `initialUsernameForSetup: string | null`：传递给初始用户名设置模态框的初始用户名。
  - `isFileManagerDetailPanelOpen: boolean`：文件管理器详情面板是否打开。
  - `fileManagerDetailPanelWidth: number`：文件管理器详情面板的宽度。
  - `isFileManagerSidebarCollapsed: boolean`：文件管理器左侧导航栏是否折叠。
  - `fileManagerSidebarWidth: number`：文件管理器左侧导航栏的宽度。
  - `isMainSidebarCollapsed: boolean`：主侧边栏是否折叠。
  - `isMobileView: boolean`：当前是否为移动端视图。
  - `panelLogHeight: number`：面板日志区域的高度。
  - `listViewColumnWidths: { [viewId: string]: { [columnId: string]: number } }`：存储列表视图各列的宽度。
- **关键 Getters**：
  - （状态直接通过 ref 暴露）
- **关键 Actions**：
  - `setupMobileViewListener()`：设置窗口大小监听器，以更新 `isMobileView` 状态。
  - `getNextZIndex(): number`：获取下一个可用的 z-index 值（通常比当前最大值大 10）。
  - `openRegexEditorModal(data: RegexEditorModalData)`：打开正则表达式编辑器模态框并传入数据。
  - `closeRegexEditorModal()`：关闭正则表达式编辑器模态框。
  - `openSettingsModal(props?: { width?: string; height?: string })`：打开设置模态框，并可选地传入宽度和高度。
  - `closeSettingsModal()`：关闭设置模态框。
  - `openInitialUsernameSetupModal(payload?: { initialUsername?: string })`：打开初始用户名设置模态框。
  - `closeInitialUsernameSetupModal()`：关闭初始用户名设置模态框。
  - `openFileManagerDetailPanel()`：打开文件管理器详情面板。
  - `closeFileManagerDetailPanel()`：关闭文件管理器详情面板。
  - `toggleFileManagerDetailPanel(isOpen?: boolean)`：切换文件管理器详情面板的开关状态。
  - `setFileManagerDetailPanelWidth(width: number)`：设置文件管理器详情面板的宽度。
  - `resetFileManagerDetailPanelWidth()`：重置文件管理器详情面板宽度为默认值。
  - `toggleFileManagerSidebar()`：切换文件管理器左侧导航栏的折叠状态。
  - `setFileManagerSidebarCollapsed(collapsed: boolean)`：设置文件管理器左侧导航栏的折叠状态。
  - `setFileManagerSidebarWidth(width: number)`：设置文件管理器左侧导航栏的宽度。
  - `persistFileManagerSidebarWidth()`：持久化文件管理器左侧导航栏的宽度到 localStorage。
  - `resetFileManagerSidebarWidth()`：重置文件管理器左侧导航栏宽度为默认值。
  - `toggleMainSidebar()`：切换主侧边栏的折叠状态。
  - `setMainSidebarCollapsed(collapsed: boolean)`：设置主侧边栏的折叠状态。
  - `setPanelLogHeight(height: number)`：设置面板日志区域的高度。
  - `persistPanelLogHeight()`：持久化面板日志高度到 localStorage。
  - `resetPanelLogHeight()`：重置面板日志高度为默认值。
  - `setListViewColumnWidth(viewId: string, columnId: string, width: number)`：设置列表视图中特定列的宽度。
  - `getListViewColumnWidths(viewId: string): { [columnId: string]: number }`：获取列表视图中特定视图的所有列宽。
- **典型使用场景/消费者**：
  - 需要打开上述模态框的组件，例如节点属性编辑器中的正则表达式输入、顶部菜单中的设置按钮、应用启动时检查用户是否需要设置初始用户名的逻辑。
  - 基础模态框组件 ([`apps/frontend-vueflow/src/components/common/BaseModal.vue`](apps/frontend-vueflow/src/components/common/BaseModal.vue:1)) 或其他需要动态层叠顺序的浮动 UI 元素，会调用 `getNextZIndex()`。
  - 文件管理器界面 ([`FileManagerPage.vue`](apps/frontend-vueflow/src/views/home/FileManagerPage.vue:1)) 及其子组件，用于控制面板和侧边栏的显示、尺寸和折叠状态。
  - 列表视图组件，用于存储和加载列宽。

### [`workflowStore.ts`](apps/frontend-vueflow/src/stores/workflowStore.ts:1)

- **核心职责/管理的状态领域**：
  - 这是前端的核心 store 之一，负责管理与工作流图谱相关的所有状态和操作。
  - 通过组合多个 Composable 函数（如 `useWorkflowManager`, `useWorkflowHistory`, `useWorkflowData` 等）来实现复杂的功能。
  - 管理每个标签页（`internalId`）的工作流状态，包括节点、边、视口位置、工作流元数据（名称、描述）、接口定义（输入/输出槽）、历史记录（undo/redo）等。
  - 处理工作流的加载、保存（包括另存为）、创建、删除。
  - 管理节点组的创建、内嵌工作流的接口同步。
  - 协调与后端 WebSocket 的通信，用于发送节点按钮点击等交互事件。
  - 管理已更改的模板工作流 ID 集合，用于提示用户同步 NodeGroup 实例。
- **关键 State 属性 (主要通过 Composable 内部管理，这里列举一些概念上的)**：
  - `availableWorkflows: Ref<Array<{ id: string; name: string; ... }>>`：存储从后端获取的可用工作流列表。
  - `allTabStates: Ref<Map<string, TabWorkflowState>>` (来自 `useWorkflowManager`)：存储每个标签页的完整工作流状态。
  - `historyStacks: Map<string, { undoStack: Ref<WorkflowStateSnapshot[]>, redoStack: Ref<WorkflowStateSnapshot[]> }>` (来自 `useWorkflowHistory`)：存储每个标签页的撤销/重做栈。
  - `changedTemplateWorkflowIds: Ref<Set<string>>`：记录其接口已被修改的模板工作流的 ID。
- **关键 Getters (部分通过 Composable 暴露)**：
  - `getActiveTabState()` (来自 `useWorkflowManager`)：获取当前活动标签页的工作流状态。
  - `isWorkflowDirty(internalId: string)` (来自 `useWorkflowManager`)：检查指定标签页的工作流是否有未保存的更改。
  - `canUndo(id: string)`, `canRedo(id: string)` (来自 `useWorkflowHistory`)：检查是否可以执行撤销/重做。
  - `activeHistoryIndex`：当前活动标签页的历史记录索引。
- **关键 Actions (大量通过 Composable 暴露和组合)**：
  - **历史管理**：`undo(steps, internalId?)`, `redo(steps, internalId?)`, `canUndo(id)`, `canRedo(id)`, `hasUnsavedChanges(id)`, `activeHistoryIndex` (Getter)，`recordHistorySnapshot(entry, snapshotPayload?)`。
  - **生命周期**：`loadWorkflow(internalId, projectId, workflowIdToLoad)` (来自 `useWorkflowLifecycleCoordinator`)，`saveWorkflow(name?)` (来自 `useWorkflowLifecycleCoordinator`)，`createNewWorkflowAndRecord()` (来自 `useWorkflowLifecycleCoordinator`)，`fetchWorkflow(projectId, workflowId)`，`fetchAvailableWorkflows()`, `deleteWorkflow(workflowId)`，`promptAndSaveWorkflow(isSaveAs = false)`。
  - **数据操作**：`setElements(internalId, elements)` (来自 `useWorkflowManager`)，`updateWorkflowData(internalId, newData, isDirty)`，`updateNodeInputValueAndRecord(...)`, `addNodeAndRecord(...)`, `addFrameNodeAndRecord(...)` (添加分组框)，`addEdgeAndRecord(...)`, `removeElementsAndRecord(...)` (来自 `useWorkflowInteractionCoordinator`)。
  - **视图管理**：`setVueFlowInstance(internalId, instance)`, `getVueFlowInstance(internalId)`, `setViewport(internalId, viewport)`, `updateEdgeStylesForTab(internalId)`。
  - **接口管理**：`updateWorkflowInterface(internalId, updateFn, entry)` (来自 `useWorkflowInteractionCoordinator`)，用于修改工作流的输入输出接口。`removeEdgesForHandle(internalId, nodeId, handleId, type)`。
  - **节点组管理**：`createGroupFromSelection(internalId, groupName?)` (来自 `useWorkflowGrouping`)，`synchronizeGroupNodeInterfaceAndValues(internalId, nodeGroupInstanceId, referencedWorkflowId)`，`resetNodeGroupInputToDefaultAndRecord(internalId, nodeId, slotKey)`。
  - **交互**：`handleNodeButtonClick(internalId, nodeId, inputKey)` (发送 WebSocket 消息)，`getEdgeById(internalId, edgeId)`，`updateMultiInputConnectionsAndRecord(...)`，`applyElementChangesAndRecordHistory(...)`，`updateNodePositionAndRecord(...)`，`updateNodeConfigValueAndRecord(...)`，`changeNodeModeAndRecord(...)`，`updateNodeLabelAndRecord(...)`，`updateNodeDimensionsAndRecord(...)`，`updateNodeParentAndRecord(...)`，`removeEdgesByHandleAndRecord(...)`，`updateWorkflowNameAndRecord(...)`，`updateWorkflowDescriptionAndRecord(...)`，`updateNodeInputConnectionOrderAndRecord(...)`，`disconnectEdgeFromInputAndRecord(...)`，`connectEdgeToInputAndRecord(...)`，`moveAndReconnectEdgeAndRecord(...)`。
  - `markTemplateAsChanged(templateId: string)`：标记一个模板工作流已被修改。
- **典型使用场景/消费者**：
  - 画布组件 ([`apps/frontend-vueflow/src/components/graph/Canvas.vue`](apps/frontend-vueflow/src/components/graph/Canvas.vue:1)) 和相关的 VueFlow 实例，用于渲染和交互。
  - 顶部菜单和快捷键，用于触发保存、撤销、重做等操作。
  - 侧边栏面板，如工作流信息面板 ([`apps/frontend-vueflow/src/components/graph/sidebar/WorkflowInfoPanel.vue`](apps/frontend-vueflow/src/components/graph/sidebar/WorkflowInfoPanel.vue:1))，用于显示和编辑工作流元数据。
  - 节点属性编辑器，当修改节点输入值或配置时，会调用 action 更新 store 并记录历史。
  - [`tabStore.ts`](apps/frontend-vueflow/src/stores/tabStore.ts:1)，在关闭标签页时需要清理工作流状态。
  - 几乎所有与工作流图谱交互的组件都会直接或间接使用此 store。

### `adapterStore.ts`

- **核心职责/管理的状态领域**:
  - 管理与当前项目关联的 API 适配器（ApiAdapter）的 CRUD (创建, 读取, 更新, 删除) 操作。
  - API 适配器用于将应用面板（Panel）的简单 API 调用转换为对复杂工作流的调用。
- **关键 State 属性**:
  - `adapters: Ref<ApiAdapter[]>`: 当前项目的所有适配器列表。
  - `isLoading: Ref<boolean>`: 加载状态。
  - `error: Ref<Error | null>`: 错误信息。
- **关键 Getters**:
  - `adaptersById: ComputedRef<Record<string, ApiAdapter>>`: 按 ID 索引的适配器映射，便于快速查找。
- **关键 Actions**:
  - `fetchAdapters(force = false)`: 获取当前项目的适配器列表。
  - `createAdapter(payload)`: 创建一个新的适配器。
  - `updateAdapter(id, payload)`: 更新一个已有的适配器。
  - `deleteAdapter(id)`: 删除一个适配器。
- **典型使用场景/消费者**:
  - API 适配器管理界面，用于配置面板如何调用工作流。
  - [`ApiAdapterManager`](apps/frontend-vueflow/src/services/ApiAdapterManager.ts:1) 服务，在执行 `adapter` 模式的调用时，会使用此 store 获取适配器定义。

### `fileManagerStore.ts`

- **核心职责/管理的状态领域**:
  - 管理文件管理器（File Manager）的全部前端状态。这是一个非常核心和复杂的状态管理器。
  - 职责包括：当前路径、文件/目录列表的获取与展示、项目选择、剪贴板操作（复制/剪切/粘贴）、筛选、排序、视图设置（列表/网格）、最近访问记录和收藏夹。
- **关键 State 属性**:
  - `currentLogicalPath: string`: 当前浏览的逻辑路径 (e.g., `user://my-project/assets/`)。
  - `items: FAMItem[]`: 当前路径下的原始文件/目录列表。
  - `filteredItems: FAMItem[]`: 经过筛选和排序后用于显示的文件/目录列表。
  - `selectedItemPaths: string[]`: 已选中项目的逻辑路径数组。
  - `clipboard: { action: 'copy' | 'cut'; sourcePaths: string[] } | null`: 剪贴板状态。
  - `filterOptions: FilterOptions`: 当前的筛选条件。
  - `viewSettings: ViewSettings`: 当前的视图设置（如排序字段、模式等）。
  - `recentAccessItems: RecentAccessItem[]`: 最近访问的条目列表。
  - `favoritesPaths: string[]`: 收藏夹路径列表。
- **关键 Getters**:
  - `selectedItems: FAMItem[]`: 返回当前选中的项目对象数组。
  - `breadcrumbsSegments`: 计算出用于面包屑导航的路径段。
  - `availableFileTypes`: 从当前项目列表中提取出所有可用的文件扩展名，用于筛选器。
- **关键 Actions**:
  - `initialize(userId, initialPath?)`: 初始化 store，设置用户并导航到初始路径。
  - `navigateTo(logicalPath)`: 导航到新的路径并获取其内容。
  - `fetchItems()`: 从后端获取当前路径下的文件和目录列表。
  - 文件/目录操作: `createDirectory(name?)`, `renameItem(item, newName?)`, `deleteItems(items?)`, `moveItems(items, targetPath)` 等，这些 actions 会调用相应的 API 并刷新列表。
  - `copyToClipboard(items?)`, `cutToClipboard(items?)`, `pasteFromClipboard()`: 实现剪贴板功能。
  - `updateFilterOptions(options)`, `updateViewSettings(settings)`: 更新筛选和视图设置，并重新计算 `filteredItems`。
- **典型使用场景/消费者**:
  - 文件管理器页面 ([`FileManagerPage.vue`](apps/frontend-vueflow/src/views/home/FileManagerPage.vue:1)) 及其所有子组件（如工具栏、面包屑、文件列表、上下文菜单等）。

### `llmConfigStore.ts`

- **核心职责/管理的状态领域**:
  - 管理与大语言模型 (LLM) 提供商相关的配置。
  - 包括 API 渠道（凭证管理）、已激活的模型列表，以及可用的提供商列表。
- **关键 State 属性**：
  - `channels: Ref<ApiCredentialConfig[]>`：用户配置的 API 渠道列表。
  - `activatedModels: Ref<ActivatedModelInfo[]>`：用户已激活并可供使用的模型列表。
  - `providers: Ref<{ id: string; name: string }[]>`：从后端获取的可用的 LLM 提供商列表。
  - `isLoadingChannels: Ref<boolean>`：API 渠道加载状态。
  - `isLoadingModels: Ref<boolean>`：模型加载状态。
  - `isLoadingProviders: Ref<boolean>`：提供商加载状态。
  - `error: Ref<string | null>`：错误信息。
- **关键 Getters**：
  - `channelOptions`: 将渠道列表转换为适用于下拉选择框的格式。
- **关键 Actions**：
  - `fetchChannels()`：获取所有 API 渠道。
  - `saveChannel(channelData)`：保存 API 渠道（可用于创建和更新）。
  - `addChannel(channelData)`：添加新的 API 渠道。
  - `updateChannel(channelData)`：更新现有 API 渠道。
  - `deleteChannel(id)`：删除指定 ID 的 API 渠道。
  - `fetchProviders()`：获取所有可用的 LLM 提供商列表。
  - `fetchModels()`：获取所有已激活的模型。
  - `addModel(modelData)`：添加新的激活模型。
  - `updateModel(id, modelData)`：更新指定 ID 的激活模型。
  - `deleteModel(id)`：删除指定 ID 的激活模型。
  - `discoverModels(channelId)`：从指定的 API 渠道动态发现可用的模型。
- **典型使用场景/消费者**:
  - LLM 配置管理界面 ([`ApiAdaptersView.vue`](apps/frontend-vueflow/src/views/project/ApiAdaptersView.vue:1) 或类似设置页面)，允许用户添加、编辑和删除 API 凭证和模型。

### `panelStore.ts`

- **核心职责/管理的状态领域**:
  - 管理应用面板 (Panel) 的定义。应用面板是工作流的一种面向最终用户的、简化的交互界面。
  - 负责获取项目下面板列表、加载单个面板的详细定义、保存面板配置以及从模板创建新面板。
- **关键 State 属性**:
  - `panelsById: Map<string, PanelDefinition>`: 按 ID 缓存的面板定义。
  - `panelList: Ref<PanelDefinition[]>`: 当前项目的面板列表。
  - `isLoadingList`, `isLoadingDefinition`, `isSavingDefinition`: 各种加载和保存状态。
- **关键 Actions**:
  - `fetchPanelList(projectId)`: 获取并缓存指定项目的所有面板列表。
  - `fetchPanelDefinition(projectId, panelId)`: 获取单个面板的详细定义（优先从缓存读取）。
  - `savePanelDefinition(projectId, panelDef)`: 将面板定义（通常是 `panel.json` 的内容）保存回文件系统。
  - `fetchPanelTemplates()`: 获取所有可用的面板模板。
  - `createPanel(projectId, data)`: 从模板或全新创建一个面板。
- **典型使用场景/消费者**:
  - 面板列表视图 ([`PanelListView.vue`](apps/frontend-vueflow/src/views/project/PanelListView.vue:1))，用于展示和管理项目中的所有面板。
  - 面板设置/编辑器视图 ([`PanelSettingsView.vue`](apps/frontend-vueflow/src/views/project/PanelSettingsView.vue:1))，用于编辑面板的定义。

### `pluginStore.ts`

- **核心职责/管理的状态领域**:
  - 管理插件（Extensions）的状态。
  - 负责从后端获取所有已发现的插件列表。
  - 处理插件的启用和禁用操作，这是通过向后端发送 API 请求，然后由后端通过 WebSocket 推送状态更新来实现的。
  - 监听 WebSocket 消息，以实时响应插件状态的变化（例如，动态加载/卸载插件资源）。
- **关键 State 属性**:
  - `plugins: Ref<ExtensionInfo[]>`: 当前的插件列表及其状态。
  - `originalPlugins: Ref<ExtensionInfo[]>`: 用于比较是否有未保存更改的原始插件列表副本。
  - `pendingPlugins: Ref<string[]>`: 正在变更状态（启用/禁用）的插件名称列表，用于在 UI 上显示加载指示。
- **关键 Getters**:
  - `hasPendingChanges`: 计算属性，判断当前插件状态与原始状态相比是否有变化。
  - `isPluginPending(pluginName)`: 检查特定插件当前是否正在处理中。
- **关键 Actions**:
  - `fetchPlugins()`: 从后端获取所有插件的列表。
  - `setPluginEnabled(pluginName, enabled)`: 向后端发送请求以启用或禁用一个插件。这是一个即时生效的操作。
  - `reloadPlugins()`: 请求后端重新扫描插件目录，用于发现新安装或删除的插件。
  - `listenToPluginChanges()`: (在 store 初始化时调用) 订阅 WebSocket 消息，处理 `plugin-enabled`, `plugin-disabled`, `plugins-reloaded` 等事件。当收到这些事件时，会调用 [`PluginLoaderService`](apps/frontend-vueflow/src/services/PluginLoaderService.ts:1) 来加载/卸载资源，并更新本地状态。
- **典型使用场景/消费者**:
  - 插件管理器界面 ([`PluginManager.vue`](apps/frontend-vueflow/src/components/settings/PluginManager.vue:1))，用于展示插件列表并允许用户启用/禁用它们。
  - 应用初始化逻辑，用于监听 WebSocket 事件。

## 3. 状态管理模式与最佳实践

根据对现有 store 的分析，项目中体现了以下一些状态管理模式和实践：

- **模块化 Store**：应用状态被清晰地分割到多个独立的 store 中，每个 store 关注特定的功能领域（如认证、UI、工作流等），这符合 Pinia 的设计理念，易于维护和扩展。
- **状态持久化**：
  - [`settingsStore.ts`](apps/frontend-vueflow/src/stores/settingsStore.ts:1) 使用 `localStorage` 来持久化用户设置，确保用户偏好在会话之间得以保留。
  - [`theme.ts`](apps/frontend-vueflow/src/stores/theme.ts:1) 同样使用 `localStorage` 持久化主题选择。
- **防抖 (Debounce)**：
  - 在 [`settingsStore.ts`](apps/frontend-vueflow/src/stores/settingsStore.ts:1) 中，`saveSettings` 操作被防抖处理，以避免在用户频繁更改设置时过于频繁地写入 `localStorage`，从而优化性能。
- **组合式函数 (Composables) 的广泛使用**：
  - 特别是在复杂的 [`workflowStore.ts`](apps/frontend-vueflow/src/stores/workflowStore.ts:1) 中，大量逻辑被抽取到可复用的 Composable 函数中（例如 `useWorkflowManager`, `useWorkflowHistory`, `useWorkflowData` 等）。这些 Composable 函数封装了特定方面的状态和行为，然后在 store 的 `setup` 函数中被组合使用。这使得 store 本身保持相对简洁，同时提高了代码的组织性和可测试性。
- **依赖注入/服务使用**：
  - Store 内部会使用其他服务，例如 [`tabStore.ts`](apps/frontend-vueflow/src/stores/tabStore.ts:1) 使用 [`DialogService`](apps/frontend-vueflow/src/services/DialogService.ts:1) 来显示确认对话框。
  - Store 之间也存在依赖关系，例如 [`tabStore.ts`](apps/frontend-vueflow/src/stores/tabStore.ts:1) 依赖 [`workflowStore`](apps/frontend-vueflow/src/stores/workflowStore.ts:1) 和 [`projectStore`](apps/frontend-vueflow/src/stores/projectStore.ts:1)。
- **类型安全**：
  - 所有 store 都使用 TypeScript 编写，并为 state、getters 和 actions 提供了类型定义，利用了 Pinia 对 TypeScript 的良好支持。
- **错误处理**：
  - 在异步 action（如 API 调用）中，通常会包含 `try...catch`块来处理潜在的错误，并将错误信息存储在 store 的 `error`状态中，供 UI 显示。
- **按需加载/确保状态存在**：
  - 一些 store 提供了如 `ensureTabExecutionState` ([`executionStore.ts`](apps/frontend-vueflow/src/stores/executionStore.ts:1)) 或 `ensureDefinitionsLoaded` ([`nodeStore.ts`](apps/frontend-vueflow/src/stores/nodeStore.ts:1)) 这样的辅助函数，用于在使用特定状态前确保其已被初始化或加载。

（如果项目后续引入了如 `pinia-plugin-persistedstate` 等通用持久化插件，或者有更明确的关于 actions 中异步逻辑处理（如统一的 API 调用封装、加载状态管理模式）的规范，可以在此部分进一步补充。）
