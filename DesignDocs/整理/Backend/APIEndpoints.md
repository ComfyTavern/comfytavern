# 后端 API 端点文档

本文档详细描述了 ComfyTavern 后端 API 的端点，主要集中在 `apps/backend/src/routes/` 目录下的路由定义。

## 1. API 路由 (`apps/backend/src/routes/`) 概览

`apps/backend/src/routes/` 目录是 ComfyTavern 后端定义 HTTP API 端点的核心位置。所有客户端与后端的交互都通过这些路由进行。API 路由按照其功能或所操作的资源进行模块化组织，并使用 [Elysia.js](https://elysiajs.com/) 框架定义。

## 2. 主要路由模块详解

### 2.1. 插件路由 ([`pluginRoutes.ts`](../../../../apps/backend/src/routes/pluginRoutes.ts:1))

*   **前缀**: `/api/plugins`
*   **功能领域**: 管理插件的生命周期，包括发现、状态变更和重载。
*   **代表性端点**:
    *   **`GET /`**:
        *   **功能描述**: 获取所有已发现的插件列表，包括其元数据和当前的启用/禁用状态。
        *   **与服务的交互**: 调用 `PluginLoader.discoverAllPlugins()`。
    *   **`PUT /:pluginName/state`**:
        *   **功能描述**: 启用或禁用指定的插件。这是一个需要管理员权限的操作。
        *   **关键请求参数 (Body)**: `{ "enabled": boolean }`
        *   **与服务的交互**: 调用 `PluginConfigService.setPluginState()` 来持久化配置，并调用 `PluginLoader.enablePlugin()` 或 `PluginLoader.disablePlugin()` 来动态加载/卸载插件。
    *   **`POST /reload`**:
        *   **功能描述**: 重新加载所有插件和内置节点。这是一个需要管理员权限的操作。
        *   **与服务的交互**: 调用 `PluginLoader.reloadPlugins()`。

### 2.2. 文件管理器路由 ([`fileManagerRoutes.ts`](../../../../apps/backend/src/routes/fileManagerRoutes.ts:1))

*   **前缀**: `/api/fam`
*   **功能领域**: 提供对文件资产的统一管理 (FAM - File Asset Management)。所有路径都使用**逻辑路径** (如 `user://...`, `shared://...`, `system://...`)。
*   **代表性端点**:
    *   **`GET /list/*`**:
        *   **功能描述**: 列出指定逻辑路径下的文件和目录。例如 `/api/fam/list/user://documents/`。
        *   **与服务的交互**: 调用 `FileManagerService.listDir()`。
    *   **`POST /upload/*`**:
        *   **功能描述**: 上传一个或多个文件到指定的逻辑目录。使用 `multipart/form-data`。
        *   **与服务的交互**: 调用 `FileManagerService.writeFile()`。
    *   **`GET /download/*`**:
        *   **功能描述**: 下载指定逻辑路径的文件。
        *   **与服务的交互**: 调用 `FileManagerService.readFile()`。
    *   **`GET /read/*`**:
        *   **功能描述**: 读取文件内容，主要用于前端预览。如果文件不存在，返回 `null` 而不是 404 错误。
        *   **与服务的交互**: 调用 `FileManagerService.readFile()`。
    *   **`POST /create-dir`**:
        *   **功能描述**: 在指定的父逻辑路径下创建一个新目录。
        *   **与服务的交互**: 调用 `FileManagerService.createDir()`。
    *   **`DELETE /delete`**:
        *   **功能描述**: 删除一个或多个指定的逻辑路径（文件或目录）。
        *   **与服务的交互**: 调用 `FileManagerService.delete()`。
    *   **`PUT /rename`**:
        *   **功能描述**: 重命名一个文件或目录。
        *   **与服务的交互**: 调用 `FileManagerService.move()`。
    *   **`PUT /move`**:
        *   **功能描述**: 将一个或多个文件/目录移动到新的父目录下。
        *   **与服务的交互**: 调用 `FileManagerService.move()`。
    *   **`POST /write-json`**:
        *   **功能描述**: 将一个 JSON 对象直接写入到指定的逻辑路径文件。
        *   **与服务的交互**: 调用 `FileManagerService.writeFile()`。
    *   **`GET /sdk/panel.js`**:
        *   **功能描述**: 提供一个稳定端点，用于获取应用面板开发所需的 SDK 脚本。
        *   **与服务的交互**: 调用 `FileManagerService.getPanelSdkScript()`。

### 2.3. 认证路由 ([`authRoutes.ts`](../../../../apps/backend/src/routes/authRoutes.ts:1))

*   **前缀**: `/api/auth`
*   **功能领域**: 用户认证与授权。
*   **代表性端点**:
    *   **`GET /current`**:
        *   **功能描述**: 获取当前用户的认证上下文。此端点严重依赖 `authMiddleware` 的处理结果。它直接返回由中间件准备好的 `userContext` 或处理中间件报告的 `authError`。
        *   **与服务的交互**: 不直接调用 `AuthService`，而是消费由 `authMiddleware` 注入的上下文。

### 2.4. 节点路由 ([`nodeRoutes.ts`](../../../../apps/backend/src/routes/nodeRoutes.ts:1))

*   **前缀**: `/api/nodes`
*   **功能领域**: 管理和提供节点定义及相关资源。
*   **代表性端点**:
    *   **`GET /`**:
        *   **功能描述**: 获取所有已加载和可用的节点定义列表，现在**包括由插件动态加载的节点**。
        *   **与服务的交互**: 调用 `NodeManager.getDefinitions()`。
    *   **`POST /reload`**:
        *   **功能描述**: 重新加载所有节点定义（包括内置和插件节点）。此操作现在通常通过 `/api/plugins/reload` 端点触发。
        *   **与服务的交互**: 调用 `PluginLoader.reloadPlugins()` (间接) 或 `NodeLoader`。
    *   **`GET /:namespace/:type/client-script/*`**:
        *   **功能描述**: 提供节点定义的客户端脚本。
        *   **与服务的交互**: 与 `NodeManager` 交互以定位节点定义及其脚本路径。

### 2.5. 项目路由 ([`projectRoutes.ts`](../../../../apps/backend/src/routes/projectRoutes.ts:1))

*   **前缀**: `/api/projects`
*   **功能领域**: 管理项目及其内部的工作流。
*   **核心变更**: 底层的文件系统操作现在已全部迁移到 `FileManagerService`，使用逻辑路径进行操作。
*   **代表性端点**:
    *   **`GET /`**: 列出当前用户的所有项目。
    *   **`POST /`**: 创建一个新项目。
    *   **`GET /:projectId/workflows`**: 列出特定项目内的所有工作流。
    *   **`POST /:projectId/workflows`**: 在项目内创建一个新工作流。
    *   **`GET /:projectId/workflows/:workflowId`**: 加载指定工作流。
    *   **`PUT /:projectId/workflows/:workflowId`**: 更新指定工作流。
    *   **`DELETE /:projectId/workflows/:workflowId`**: 删除指定工作流。
*   **与服务的交互**: 所有操作都通过 `projectService.ts` 中定义的函数进行，该服务现在内部调用 `FileManagerService`。

### 2.6. 执行路由 ([`executionRoutes.ts`](../../../../apps/backend/src/routes/executionRoutes.ts:1))

*   **前缀**: `/api`
*   **功能领域**: 处理工作流的执行请求，管理执行队列和状态查询。
*   **代表性端点**:
    *   **`POST /prompt`**: 提交一个工作流以供执行。
    *   **`GET /executions`**: 获取当前正在运行和等待执行的工作流列表。
    *   **`GET /prompt/:promptId`**: 查询特定工作流执行的状态。
    *   **`POST /interrupt/:promptId`**: 中断一个正在运行或排队等待的工作流执行。
    *   **`GET /system_stats`**: 获取系统执行相关的统计信息。
*   **与服务的交互**: 主要与 `ConcurrencyScheduler` 实例交互。

### 2.7. 其他路由

*   **`characterRoutes.ts`**: 管理角色卡数据。
*   **`userKeysRoutes.ts`**: 管理用户的 API 密钥和外部服务凭证。
*   **`userProfileRoutes.ts`**: 管理用户的个人配置信息（用户名、头像）。
*   **`workflowRoutes.ts`**: 提供对旧的全局工作流的访问（大部分功能已合并到项目体系中）。
*   **`llmConfigRoutes.ts`**: 管理 LLM 适配器和模型配置。
*   **`panelRoutes.ts`**: 管理应用面板的生命周期和数据。
*   **`pluginAssetRoutes.ts`**: 动态地为插件提供静态资源服务。

## 3. 路由注册

所有上述路由模块都在主应用入口文件 [`apps/backend/src/index.ts`](../../../../apps/backend/src/index.ts:1) 中被引入和注册到主 Elysia 应用实例上。插件提供的路由则由 `PluginLoader` 动态注册。