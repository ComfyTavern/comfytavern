# 后端服务层 (`apps/backend/src/services/`) 文档

## 1. 服务层概览

`apps/backend/src/services/` 目录是 ComfyTavern 后端应用的核心业务逻辑实现层。它封装了应用的主要业务规则、数据操作、与外部服务的交互以及其他关键功能模块。服务层旨在提供清晰、可重用和可测试的业务逻辑单元。

### 1.1. 目录职责

该目录下的每个服务模块通常负责一块特定的业务领域或功能。主要职责包括：

- **封装业务逻辑**：将复杂的业务流程和规则封装在服务方法中。
- **数据持久化与检索**：通过与 [`DatabaseService`](#2.4.-databaseservicets) 交互处理数据库操作，或通过 [`FileManagerService`](#2.10.-filemanagerservicets) 处理文件系统操作。
- **核心功能实现**：提供如用户认证、插件加载、文件管理、工作流执行调度等核心应用功能。
- **状态管理**：部分服务负责管理特定的应用状态或配置。

### 1.2. 设计原则

- **单一职责原则 (SRP)**：每个服务类或模块专注于一个明确的业务功能。
- **封装**：通过定义良好的接口（公共方法）暴露功能，隐藏内部实现细节。
- **依赖管理**：服务之间的依赖关系清晰。许多服务采用单例模式或静态方法提供全局访问点。
- **配置驱动**: 许多服务的行为可以通过外部配置文件进行调整。

## 2. 主要服务模块详解

以下是对 `apps/backend/src/services/` 目录下主要服务模块的详细说明。

### 2.1. `PluginLoader.ts`

- **核心职责**:
  - **插件系统的核心**，负责管理整个插件生命周期。
  - **发现插件**：扫描指定插件目录，读取每个插件的 `plugin.yaml` 清单文件。
  - **加载插件**：在应用启动时，根据配置加载所有已启用的插件。
  - **动态管理**：支持在运行时动态地启用、禁用和重载插件。
  - **节点注册**：调用 `NodeLoader` 来加载插件中定义的节点，并以插件名称为命名空间进行注册。
  - **前端资源**：解析插件清单中的前端配置，为前端提供插件的 JS 和 CSS 资源路径。
  - **状态通知**：通过 WebSocket 向客户端广播插件状态的变更（如启用、禁用、重载）。
- **关键公共方法/接口**:
  - `discoverAllPlugins()`: 发现所有插件并返回其元数据及启用状态。
  - `loadPlugins(app, pluginBasePaths, projectRootDir)`: 在应用启动时加载所有启用的插件。
  - `reloadPlugins()`: 重新加载所有插件和内置节点。
  - `enablePlugin(pluginName)`: 动态启用一个插件。
  - `disablePlugin(pluginName)`: 动态禁用一个插件。
- **依赖关系**: `NodeLoader`, `NodeManager`, `PluginConfigService`, `WebSocketManager`。

### 2.2. `PluginConfigService.ts`

- **核心职责**:
  - 管理插件的持久化配置，主要是插件的启用/禁用状态。
  - 从 `config/plugin_config.json` 文件中读取和写入插件配置。
- **关键公共方法/接口**:
  - `isPluginEnabled(pluginName)`: 检查一个插件是否被标记为启用。
  - `setPluginState(pluginName, enabled)`: 设置一个插件的启用状态并保存到配置文件。
- **依赖关系**: `FileManagerService` (用于读写配置文件)。

### 2.3. `AuthService.ts`

- **核心职责**:
  - 管理和确定应用的当前认证操作模式 (`SingleUser` 或 `MultiUser`)。
  - 构建和提供用户上下文信息 (`UserContext`)。
  - 处理基于 API 密钥的认证。
- **关键公共方法/接口**:
  - `getUserContext(elysiaContext)`: 异步获取当前请求的用户上下文。
    - **API 密钥优先**: 如果请求头中提供了有效的 `Bearer` token，则通过 API 密钥进行认证。如果 token 无效，则直接拒绝。
    - **单用户模式**: 如果没有 API 密钥，在单用户模式下，会从数据库加载默认用户的完整信息，包括其 API 密钥和外部服务凭证的元数据。
    - **多用户模式**: 逻辑待实现。
- **依赖关系**: `DatabaseService`, `config.ts`。

### 2.4. `DatabaseService.ts`

- **核心职责**:
  - 初始化和管理应用的 SQLite 数据库连接 (使用 Drizzle ORM 和 `bun:sqlite`)。
  - 提供对 Drizzle ORM 实例的全局访问点 (`getDb()`)。
  - 在单用户模式下，确保默认用户记录存在。
- **关键公共方法/接口**:
  - `initialize()`: 初始化数据库服务。
  - `getDb()`: 返回已初始化的 Drizzle ORM 数据库实例。
- **依赖关系**: `drizzle-orm`, `bun:sqlite`, `AuthService` (用于获取操作模式)。

### 2.5. `ConcurrencyScheduler.ts`

- **核心职责**:
  - 管理和调度工作流的并发执行，确保不超过配置的最大并发数。
  - 维护一个等待队列来处理超出的执行请求。
  - 与 `ExecutionEngine` 协作启动和管理工作流执行。
  - 处理执行的中断请求。
- **关键公共方法/接口**:
  - `submitExecution(payload, source, clientId)`: 提交一个新的工作流执行请求。
  - `interruptExecution(promptId)`: 尝试中断一个正在运行或排队的执行。
- **依赖关系**: `WebSocketManager`, `ExecutionEngine`, `config.ts`。

### 2.6. `CryptoService.ts`

- **核心职责**:
  - 提供密码哈希和验证功能 (`Bun.password`)。
  - 提供敏感凭证的加密和解密功能 (AES-256-CBC)，依赖于主加密密钥 (MEK)。
- **关键公共方法/接口**:
  - `hash(plaintext)` / `verify(plaintext, hash)`: 哈希和验证密码。
  - `encryptCredential(plaintext)` / `decryptCredential(encryptedString)`: 加密和解密凭证。
- **依赖关系**: `crypto-js`, `config.ts` (用于获取 MEK 和加密开关)。

### 2.7. `LoggingService.ts`

- **核心职责**:
  - 为工作流的每次执行提供详细的、持久化的日志记录。
  - 将日志条目写入按日期和 PromptID 组织的特定日志文件中。
  - 记录工作流和节点的各个生命周期事件（开始、完成、错误、中断等）。
- **关键公共方法/接口**:
  - `initializeExecutionLog(promptId, payload)`: 为新执行初始化日志文件。
  - `logNodeStart()`, `logNodeComplete()`, `logNodeError()` 等: 记录节点事件。
- **依赖关系**: `config.ts` (用于获取日志目录)。

### 2.8. `NodeLoader.ts`

- **核心职责**:
  - 动态加载节点定义文件 (`.ts`)。
  - 扫描指定目录，动态 `import()` 模块，并提取导出的 `definition` 或 `definitions`。
  - 将加载到的节点定义注册到 `NodeManager` 中。
- **关键公共方法/接口**:
  - `loadNodes(dirPath, namespace?)`: 异步加载指定目录下的所有节点定义，并可选择性地为其提供一个默认命名空间（用于插件节点）。
- **依赖关系**: `NodeManager`。

### 2.9. `NodeManager.ts`

- **核心职责**:
  - 作为所有可用节点定义的中央注册表和管理器。
  - 存储和检索节点定义，使用 `namespace:type` 格式的 `fullType` 作为唯一标识符。
  - 为节点确定最终的命名空间。
- **关键公共方法/接口**:
  - `registerNode(node, filePath?)`: 注册一个节点定义。
  - `getDefinitions()`: 返回所有已注册节点定义的列表。
  - `getNode(fullType)`: 获取单个节点定义。
  - `unregisterNodesByNamespace(namespace)`: 反注册属于特定命名空间的所有节点（用于禁用插件）。
- **依赖关系**: 无。

### 2.10. `FileManagerService.ts`

- **核心职责**:
  - **统一文件资产管理 (FAM)** 的核心实现。
  - 实现了一套**逻辑路径系统**，使用 `scheme://path` 格式（如 `user://`, `shared://`, `system://`）来抽象和保护物理文件系统。
  - **安全路径解析**: 提供 `resolvePath` 方法，将逻辑路径安全地解析为物理路径，并内置路径遍历攻击防护。
  - **提供文件操作 API**: 封装了完整的文件和目录 CRUD 操作，如 `exists`, `readFile`, `writeFile`, `listDir`, `createDir`, `delete`, `move`, `stat`, `copy`。
  - **服务面板 SDK**: 包含 `getPanelSdkScript` 方法，用于向应用面板提供开发所需的 SDK 脚本。
- **关键公共方法/接口**:
  - `resolvePath(userId, logicalPath)`: 将逻辑路径解析为物理路径。
  - `listDir(userId, logicalPath)`: 列出目录内容。
  - `readFile(userId, logicalPath)` / `writeFile(userId, logicalPath, data)`: 读写文件。
  - `delete(userId, logicalPath)` / `move(userId, source, dest)`: 删除和移动文件/目录。
- **依赖关系**: `utils/fileUtils.ts` (用于获取根目录路径)。

### 2.11. `projectService.ts`

- **核心职责**:
  - 管理用户项目和工作流的 CRUD 操作。
  - 处理项目元数据 (`project.json`) 和工作流文件 (`.json`) 的读写。
  - 当被引用的工作流接口发生变化时，同步更新 `NodeGroup` 节点的快照。
- **关键公共方法/接口**:
  - `listProjects(userId)`, `createProject(userId, ...)`: 管理项目。
  - `listWorkflows(userId, projectId)`, `getWorkflow(...)`, `updateWorkflow(...)`, `deleteWorkflowToRecycleBin(...)`: 管理工作流。
- **依赖关系**: **`FileManagerService`** (现在所有文件操作都通过 FAM 服务进行), `zod`, `lodash/isEqual`。

### 2.12. LLM 相关服务

- **`ApiConfigService.ts`**: 负责管理 LLM API 适配器的配置。
- **`LlmApiAdapterRegistry.ts`**: 注册和管理所有可用的 LLM API 适配器，允许系统与多种不同的 LLM 服务进行交互。
- **`ActivatedModelService.ts`**: 管理当前在系统中被激活和可用的 LLM 模型。

### 2.13. `WorkflowManager.ts`

- **核心职责**:
  - 管理工作流的加载和存储。
  - 此服务使用 `FileManagerService` 来通过逻辑路径访问文件，实现与物理存储的解耦。
  - 根据用户 ID、项目 ID 和工作流 ID 从文件系统加载工作流定义。
  - 提供获取绑定了特定用户和项目上下文的 `workflowLoader` 函数。
- **关键公共方法/接口**:
  - `loadWorkflow(userId, projectId, workflowId)`: 从文件系统加载工作流定义。
  - `getScopedWorkflowLoader(userId, projectId)`: 获取一个符合 `WorkflowLoader` 接口的函数。
- **依赖关系**: `FileManagerService`, `@comfytavern/types` (用于 `WorkflowStorageObject`, `NanoId`, `WorkflowStorageObjectSchema`)。

### 2.14. `WorldStateService.ts`

- **核心职责**:
  - 提供一个场景范围内的、可进行原子性读写的共享状态存储。
  - 这是 Agent 感知环境的基础。
  - 它通过一个轻量级的异步锁机制来确保更新操作的原子性。
- **关键公共方法/接口**:
  - `createSceneState(sceneInstanceId, initialState)`: 当新场景实例创建时，初始化其世界状态。
  - `getState(sceneInstanceId)`: 获取指定场景的当前状态。
  - `updateState(sceneInstanceId, updater)`: 原子性地更新指定场景的状态。
  - `deleteState(sceneInstanceId)`: 当场景实例结束时，清理其状态。
- **依赖关系**: `@comfytavern/types` (用于 `NanoId`)。
