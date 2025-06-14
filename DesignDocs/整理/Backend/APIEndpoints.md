# 后端 API 端点文档

本文档详细描述了 ComfyTavern 后端 API 的端点，主要集中在 `apps/backend/src/routes/` 目录下的路由定义。

## 1. API 路由 (`apps/backend/src/routes/`) 概览

### 目录职责

`apps/backend/src/routes/` 目录是 ComfyTavern 后端定义 HTTP API 端点的核心位置。所有客户端（如前端 Vue 应用）与后端进行的交互都通过这些路由进行。

### 组织方式

API 路由按照其功能或所操作的资源进行模块化组织。通常，每个 `.ts` 文件（例如，[`authRoutes.ts`](../../../../apps/backend/src/routes/authRoutes.ts:1)，[`workflowRoutes.ts`](../../../../apps/backend/src/routes/workflowRoutes.ts:1)）对应一个或一组相关资源的路由。这种组织方式有助于保持代码的清晰性和可维护性。

### Elysia 路由机制

后端采用 [Elysia.js](https://elysiajs.com/) 框架来定义和处理路由。Elysia 提供了简洁的 API 来创建路由：

*   **`new Elysia({ prefix: '/api/...' })`**: 创建一个新的 Elysia 实例，通常会带有一个基础前缀，如 `/api`，该实例下的所有路由都会继承这个前缀。
*   **`app.group('/resource', (group) => ...)`**: 用于将相关的路由组织在同一个群组下，可以为群组设置特定的前缀。
*   **`app.get('/path', handler, schema?)`**: 定义一个 HTTP GET 请求的处理器。
*   **`app.post('/path', handler, schema?)`**: 定义一个 HTTP POST 请求的处理器。
*   **`app.put('/path', handler, schema?)`**: 定义一个 HTTP PUT 请求的处理器。
*   **`app.delete('/path', handler, schema?)`**: 定义一个 HTTP DELETE 请求的处理器。
*   **`handler`**: 一个异步或同步函数，接收一个包含请求和响应上下文的对象，并处理请求逻辑。
*   **`schema`**: 可选参数，用于定义请求体、查询参数、路径参数和响应的校验模式，通常使用 Elysia 内置的 `t` (TypeBox) 或 Zod 来定义。

路由处理器通常会调用相应的服务层（位于 `apps/backend/src/services/`）中的方法来执行核心业务逻辑，例如数据库操作、文件系统交互或与其他外部服务的通信。

## 2. 主要路由模块详解

以下是对 `apps/backend/src/routes/` 目录下主要路由模块的详细说明。

### 2.1 认证路由 ([`authRoutes.ts`](../../../../apps/backend/src/routes/authRoutes.ts:1))

*   **功能领域**: 用户认证与授权。此模块负责确定当前用户的认证状态和上下文信息。
*   **代表性端点**:
    *   **`GET /api/auth/current`**:
        *   **功能描述**: 获取当前用户的认证状态和上下文。前端使用此端点来调整 UI 和行为，例如根据用户是否已登录或处于何种操作模式（如本地无密码、本地有密码、多用户共享）来显示不同的内容或功能。
        *   **关键请求参数**: 无。认证信息通常通过 Cookie 或 Authorization 请求头传递，并由 [`authMiddleware.ts`](../../../../apps/backend/src/middleware/authMiddleware.ts:1) 处理。
        *   **主要响应内容**: 返回一个 [`UserContext`](../../../../packages/types/src/index.ts:1) 对象，包含用户身份、操作模式等信息。如果发生错误，则返回错误对象。
*   **中间件使用**: 此路由模块依赖于全局应用的 [`authMiddleware.ts`](../../../../apps/backend/src/middleware/authMiddleware.ts:1)。该中间件会预先处理请求，尝试从会话、令牌或 API 密钥中确定用户身份，并将结果（`userContext` 或 `authError`）注入到请求上下文中，供路由处理器使用。
*   **与服务的交互**: 主要通过 [`AuthService`](../../../../apps/backend/src/services/AuthService.ts:1)（由中间件调用）来获取用户上下文。

### 2.2 角色卡路由 ([`characterRoutes.ts`](../../../../apps/backend/src/routes/characterRoutes.ts:1))

*   **功能领域**: 管理和提供角色卡（Character Cards）数据，这些数据通常用于 AI 聊天或故事生成场景。
*   **代表性端点**:
    *   **`GET /api/characters/`**:
        *   **功能描述**: 列出当前用户库中所有可用的角色卡。它会读取用户特定目录下的 PNG 和 JSON 文件，提取元数据并合并信息。
        *   **关键请求参数**: 无。用户身份通过认证中间件确定。
        *   **主要响应内容**: 返回一个包含 [`ApiCharacterEntry`](../../../../packages/types/src/index.ts:1) 对象数组的列表，每个对象代表一个角色卡及其元数据。
    *   **`GET /api/characters/image/:imageName`**:
        *   **功能描述**: 获取指定角色卡的图片文件。图片名称通常是角色卡关联的 PNG 文件名。
        *   **关键请求参数**:
            *   路径参数: `:imageName` (URL编码的角色卡图片文件名)
        *   **主要响应内容**: 返回图片文件的二进制流，并设置正确的 `Content-Type` (如 `image/png`)。
*   **中间件使用**: 依赖 [`authMiddleware.ts`](../../../../apps/backend/src/middleware/authMiddleware.ts:1) 来确定当前用户，以便访问该用户的角色卡库。
*   **与服务的交互**: 直接与文件系统交互，读取和解析用户特定目录（通过 [`getUserDataRoot()`](../../../../apps/backend/src/utils/fileUtils.ts:1) 和用户ID构建）下的角色卡文件。使用 `png-chunk-text` 和 `png-chunks-extract` 库从 PNG 图片中提取元数据。

### 2.3 执行路由 ([`executionRoutes.ts`](../../../../apps/backend/src/routes/executionRoutes.ts:1))

*   **功能领域**: 处理工作流的执行请求，管理执行队列和状态查询。
*   **代表性端点**:
    *   **`POST /api/prompt`**:
        *   **功能描述**: 提交一个工作流以供执行。工作流负载包含节点定义和连接关系。
        *   **关键请求参数**:
            *   请求体: [`WorkflowExecutionPayload`](../../../../packages/types/src/execution.ts:1) (包含工作流图、前端信息等)
        *   **主要响应内容**: 返回一个包含 `promptId` 的对象，该 ID 用于后续查询执行状态。
    *   **`GET /api/executions`**:
        *   **功能描述**: 获取当前正在运行和等待执行的工作流列表。
        *   **关键请求参数**: 无。
        *   **主要响应内容**: 返回一个 [`ExecutionsListResponse`](../../../../packages/types/src/execution.ts:1) 对象，包含 `running` 和 `pending` 的工作流执行信息。
    *   **`GET /api/prompt/:promptId`**:
        *   **功能描述**: 查询特定工作流执行的状态。
        *   **关键请求参数**:
            *   路径参数: `:promptId` (执行ID)
        *   **主要响应内容**: 返回一个 [`PromptStatusResponse`](../../../../packages/types/src/execution.ts:1) 对象，包含执行状态、节点状态等信息。
    *   **`POST /api/interrupt/:promptId`**:
        *   **功能描述**: 中断一个正在运行或排队等待的工作流执行。
        *   **关键请求参数**:
            *   路径参数: `:promptId` (执行ID)
        *   **主要响应内容**: 返回操作成功或失败的消息。
    *   **`GET /api/system_stats`**:
        *   **功能描述**: 获取系统执行相关的统计信息，如最大并发数、当前运行和等待的任务数。
        *   **关键请求参数**: 无。
        *   **主要响应内容**: 返回包含系统统计信息的对象。
*   **中间件使用**: 无特定中间件，但依赖于全局的 CORS 配置。
*   **与服务的交互**:
    *   主要与 [`ConcurrencyScheduler`](../../../../apps/backend/src/services/ConcurrencyScheduler.ts:1) 实例（在 [`apps/backend/src/index.ts`](../../../../apps/backend/src/index.ts:1) 中导出为 `scheduler`）交互，用于提交执行、查询状态和中断执行。
    *   配置信息如 `MAX_CONCURRENT_WORKFLOWS` 从 [`apps/backend/src/config.ts`](../../../../apps/backend/src/config.ts:1) 获取。

### 2.4 节点路由 ([`nodeRoutes.ts`](../../../../apps/backend/src/routes/nodeRoutes.ts:1))

*   **功能领域**: 管理和提供节点定义，以及节点相关的客户端脚本。
*   **代表性端点**:
    *   **`GET /api/nodes`**:
        *   **功能描述**: 获取所有已加载和可用的节点定义列表。
        *   **关键请求参数**: 无。
        *   **主要响应内容**: 返回一个包含所有 [`NodeDefinition`](../../../../packages/types/src/node.ts:1) 对象的数组。
    *   **`POST /api/nodes/reload`**:
        *   **功能描述**: 重新加载所有节点定义，包括内置节点和自定义节点。此操作会清空现有节点，然后从磁盘重新扫描和加载。完成后会通过 WebSocket 通知所有连接的客户端。
        *   **关键请求参数**: 无。
        *   **主要响应内容**: 返回操作成功或失败的消息，以及重新加载的节点数量。
    *   **`GET /api/nodes/:namespace/:type/client-script/*`**:
        *   **功能描述**: 提供节点定义的客户端脚本。路径中的 `*` 部分对应节点定义中 `clientScriptUrl` 字段指定的相对路径。
        *   **关键请求参数**:
            *   路径参数: `:namespace` (节点命名空间), `:type` (节点类型), `*` (脚本相对路径)
        *   **主要响应内容**: 返回 JavaScript 文件内容，`Content-Type` 为 `application/javascript`。
*   **中间件使用**: 无特定中间件。
*   **与服务的交互**:
    *   与 [`NodeManager`](../../../../apps/backend/src/services/NodeManager.ts:1) (通过 `nodeManager` 实例) 交互以获取和管理节点定义。
    *   与 [`NodeLoader`](../../../../apps/backend/src/services/NodeLoader.ts:1) 交互以重新加载节点。
    *   与 [`WebSocketManager`](../../../../apps/backend/src/websocket/WebSocketManager.ts:1) (通过 `wsManager` 实例) 交互以在节点重载后广播通知。
    *   自定义节点路径从 [`apps/backend/src/config.ts`](../../../../apps/backend/src/config.ts:1) (`CUSTOM_NODE_PATHS`) 获取。

### 2.5 项目路由 ([`projectRoutes.ts`](../../../../apps/backend/src/routes/projectRoutes.ts:1))

*   **功能领域**: 管理项目及其内部的工作流。项目是组织工作流的容器。
*   **代表性端点**:
    *   **`GET /api/projects/`**:
        *   **功能描述**: 列出当前用户的所有项目。
        *   **关键请求参数**: 无。用户身份通过认证中间件确定。
        *   **主要响应内容**: 返回一个包含 [`ProjectMetadata`](../../../../packages/types/src/workflow.ts:1) 对象数组的列表。
    *   **`POST /api/projects/`**:
        *   **功能描述**: 创建一个新项目。
        *   **关键请求参数**:
            *   请求体: `{ name: string }` (项目名称)
        *   **主要响应内容**: 返回新创建项目的 [`ProjectMetadata`](../../../../packages/types/src/workflow.ts:1)。
    *   **`GET /api/projects/:projectId/metadata`**:
        *   **功能描述**: 获取特定项目的元数据。
        *   **关键请求参数**:
            *   路径参数: `:projectId` (项目ID)
        *   **主要响应内容**: 返回项目的 [`ProjectMetadata`](../../../../packages/types/src/workflow.ts:1)。
    *   **`PUT /api/projects/:projectId/metadata`**:
        *   **功能描述**: 更新特定项目的元数据。
        *   **关键请求参数**:
            *   路径参数: `:projectId`
            *   请求体: 部分 [`ProjectMetadata`](../../../../packages/types/src/workflow.ts:1) 对象 (例如，更新名称、描述等)
        *   **主要响应内容**: 返回更新后的 [`ProjectMetadata`](../../../../packages/types/src/workflow.ts:1)。
    *   **`GET /api/projects/:projectId/workflows`**:
        *   **功能描述**: 列出特定项目内的所有工作流。
        *   **关键请求参数**:
            *   路径参数: `:projectId`
        *   **主要响应内容**: 返回一个包含 [`WorkflowStorageObject`](../../../../packages/types/src/workflow.ts:1) 简要信息（如 `id`, `name`）的数组。
    *   **`POST /api/projects/:projectId/workflows`**:
        *   **功能描述**: 在特定项目内创建一个新工作流。
        *   **关键请求参数**:
            *   路径参数: `:projectId`
            *   请求体: [`CreateWorkflowObject`](../../../../packages/types/src/workflow.ts:1) (包含工作流名称、可选的初始节点和边等)
        *   **主要响应内容**: 返回新创建的完整 [`WorkflowObject`](../../../../packages/types/src/workflow.ts:1)。
    *   **`GET /api/projects/:projectId/workflows/:workflowId`**:
        *   **功能描述**: 加载特定项目内的指定工作流。
        *   **关键请求参数**:
            *   路径参数: `:projectId`, `:workflowId`
        *   **主要响应内容**: 返回完整的 [`WorkflowObject`](../../../../packages/types/src/workflow.ts:1)。
    *   **`PUT /api/projects/:projectId/workflows/:workflowId`**:
        *   **功能描述**: 更新特定项目内的指定工作流。
        *   **关键请求参数**:
            *   路径参数: `:projectId`, `:workflowId`
            *   请求体: [`UpdateWorkflowObject`](../../../../packages/types/src/workflow.ts:1) (包含要更新的工作流数据)
        *   **主要响应内容**: 返回更新后的完整 [`WorkflowObject`](../../../../packages/types/src/workflow.ts:1)。
    *   **`DELETE /api/projects/:projectId/workflows/:workflowId`**:
        *   **功能描述**: 删除特定项目内的指定工作流（通常是移动到回收站）。
        *   **关键请求参数**:
            *   路径参数: `:projectId`, `:workflowId`
        *   **主要响应内容**: 成功时返回 `204 No Content`。
*   **中间件使用**: 依赖 [`authMiddleware.ts`](../../../../apps/backend/src/middleware/authMiddleware.ts:1) 来确定当前用户，以便进行权限控制和数据隔离。
*   **与服务的交互**:
    *   所有操作都通过 [`apps/backend/src/services/projectService.ts`](../../../../apps/backend/src/services/projectService.ts:1) 中定义的函数进行，如 `createProject`, `getWorkflow`, `updateWorkflow` 等。
    *   服务层负责处理文件系统操作（在 `PROJECTS_BASE_DIR` 下为每个用户和项目创建目录和文件）、JSON 解析/序列化以及业务逻辑验证。
    *   项目基础目录从 [`apps/backend/src/config.ts`](../../../../apps/backend/src/config.ts:1) (`PROJECTS_BASE_DIR`) 获取。

### 2.6 用户密钥路由 ([`userKeysRoutes.ts`](../../../../apps/backend/src/routes/userKeysRoutes.ts:1))

*   **功能领域**: 管理当前用户的 API 密钥和外部服务凭证。
*   **子路由组**:
    *   `/api/users/me/service-keys`: 管理服务 API 密钥 (Service API Keys)。
    *   `/api/users/me/credentials`: 管理外部服务凭证 (External Service Credentials)。
*   **代表性端点 (Service API Keys)**:
    *   **`GET /api/users/me/service-keys/`**:
        *   **功能描述**: 列出当前用户的所有服务 API 密钥元数据。
        *   **主要响应内容**: 返回 [`ServiceApiKeyMetadata`](../../../../packages/types/src/index.ts:1) 对象数组。
    *   **`POST /api/users/me/service-keys/`**:
        *   **功能描述**: 为当前用户创建一个新的服务 API 密钥。
        *   **关键请求参数 (请求体)**: `{ name?: string, scopes?: string[] }`
        *   **主要响应内容**: 返回 [`ServiceApiKeyWithSecret`](../../../../packages/types/src/index.ts:1) 对象，包含新创建的密钥（**密钥本身仅在创建时返回一次**）。
    *   **`DELETE /api/users/me/service-keys/:keyId`**:
        *   **功能描述**: 删除当前用户的指定服务 API 密钥。
        *   **关键请求参数 (路径参数)**: `:keyId`
        *   **主要响应内容**: 成功时返回 `204 No Content`。
*   **代表性端点 (External Service Credentials)**:
    *   **`GET /api/users/me/credentials/`**:
        *   **功能描述**: 列出当前用户的所有外部服务凭证元数据。
        *   **主要响应内容**: 返回 [`ExternalCredentialMetadata`](../../../../packages/types/src/index.ts:1) 对象数组。
    *   **`POST /api/users/me/credentials/`**:
        *   **功能描述**: 为当前用户添加一个新的外部服务凭证。凭证内容会被加密存储。
        *   **关键请求参数 (请求体)**: `{ serviceName: string, credential: string, displayName?: string }`
        *   **主要响应内容**: 返回新创建凭证的 [`ExternalCredentialMetadata`](../../../../packages/types/src/index.ts:1)。
    *   **`DELETE /api/users/me/credentials/:credentialId`**:
        *   **功能描述**: 删除当前用户的指定外部服务凭证。
        *   **关键请求参数 (路径参数)**: `:credentialId`
        *   **主要响应内容**: 成功时返回 `204 No Content`。
*   **中间件使用**: 依赖 [`authMiddleware.ts`](../../../../apps/backend/src/middleware/authMiddleware.ts:1) 来确定当前用户。
*   **与服务的交互**:
    *   与 [`DatabaseService`](../../../../apps/backend/src/services/DatabaseService.ts:1) 交互，在 `serviceApiKeys` 和 `externalCredentials` 表中存储和检索数据。
    *   与 [`CryptoService`](../../../../apps/backend/src/services/CryptoService.ts:1) 交互，用于哈希服务 API 密钥和加解密外部服务凭证。

### 2.7 用户配置路由 ([`userProfileRoutes.ts`](../../../../apps/backend/src/routes/userProfileRoutes.ts:1))

*   **功能领域**: 管理当前用户的个人配置信息，如用户名和头像。
*   **代表性端点**:
    *   **`PUT /api/users/me/username`**:
        *   **功能描述**: 更新当前默认用户的用户名。此操作通常仅在本地单用户模式下可用。
        *   **关键请求参数 (请求体)**: `{ username: string }`
        *   **主要响应内容**: 返回操作成功或失败的消息，以及更新后的用户名。
    *   **`POST /api/users/me/avatar`**:
        *   **功能描述**: 上传或更新当前用户的头像图片。
        *   **关键请求参数 (请求体)**: `multipart/form-data` 包含一个名为 `avatar` 的文件字段。
        *   **主要响应内容**: 返回操作成功或失败的消息，以及新的头像 URL。
*   **中间件使用**: 依赖 [`authMiddleware.ts`](../../../../apps/backend/src/middleware/authMiddleware.ts:1) 来确定当前用户。
*   **与服务的交互**:
    *   与 [`DatabaseService`](../../../../apps/backend/src/services/DatabaseService.ts:1) 交互，在 `users` 表中更新用户名和头像 URL。
    *   直接与文件系统交互（通过 [`getAvatarsDir()`](../../../../apps/backend/src/utils/fileUtils.ts:1) 和 [`ensureDirExists()`](../../../../apps/backend/src/utils/fileUtils.ts:1)），将上传的头像文件保存到服务器的特定目录。

### 2.8 全局工作流路由 ([`workflowRoutes.ts`](../../../../apps/backend/src/routes/workflowRoutes.ts:1))

*   **功能领域**: 提供对全局工作流（存储在预定义 `WORKFLOWS_DIR` 目录下的工作流）的访问。这些通常是预置的或共享的工作流模板。
*   **代表性端点**:
    *   **`GET /api/workflows/`**:
        *   **功能描述**: 列出所有可用的全局工作流。它会读取 `WORKFLOWS_DIR` 目录下的 JSON 文件。
        *   **关键请求参数**: 无。
        *   **主要响应内容**: 返回一个包含工作流 `id` 和 `name` 的对象数组。
    *   **`GET /api/workflows/:id`**:
        *   **功能描述**: 加载指定的全局工作流。**注意：此路由当前在实现中被标记为禁用或仅返回提示，因为全局工作流的管理策略可能已转向通过项目 API 进行。**
        *   **关键请求参数**:
            *   路径参数: `:id` (工作流文件名，不含 `.json` 后缀)
        *   **主要响应内容**: （如果启用）返回工作流的 JSON 内容。当前实现返回 404 或提示信息。
    *   **`POST /api/workflows/`**, **`PUT /api/workflows/:id`**, **`DELETE /api/workflows/:id`**:
        *   **功能描述**: 这些端点用于创建、更新和删除全局工作流，但**当前实现中均被禁用**，并返回 `405 Method Not Allowed`。管理全局工作流通常需要更严格的权限控制，或者已通过项目系统进行管理。
*   **中间件使用**: 无特定中间件。
*   **与服务的交互**:
    *   直接与文件系统交互，读取 `WORKFLOWS_DIR`（从 [`apps/backend/src/config.ts`](../../../../apps/backend/src/config.ts:1) 获取）目录下的工作流文件。
    *   使用 [`sanitizeWorkflowIdFromParam()`](../../../../apps/backend/src/utils/helpers.ts:1) 清理路径参数。

## 3. 路由注册

所有上述路由模块都在主应用入口文件 [`apps/backend/src/index.ts`](../../../../apps/backend/src/index.ts:1) 中被引入和注册到主 Elysia 应用实例上。

注册过程大致如下：

1.  从各自的路由文件中导入路由实例或插件函数（例如，`import { authRoutes } from './routes/authRoutes';` 或 `import { projectRoutesPlugin } from './routes/projectRoutes';`）。
2.  使用 Elysia 应用实例的 `.use()` 方法来挂载这些路由。

```typescript
// 示例摘自 apps/backend/src/index.ts

// ... 其他导入 ...
import { authRoutes } from './routes/authRoutes';
import { userKeysRoutes } from './routes/userKeysRoutes';
import { userProfileRoutes } from './routes/userProfileRoutes';
import { nodeApiRoutes, clientScriptRoutes } from './routes/nodeRoutes';
import { globalWorkflowRoutes } from './routes/workflowRoutes';
import { executionApiRoutes } from './routes/executionRoutes';
import { characterApiRoutes } from './routes/characterRoutes';
import { projectRoutesPlugin } from './routes/projectRoutes';
import { applyAuthMiddleware } from './middleware/authMiddleware';

// ... app 初始化 ...
const app = new Elysia()
  .use(cors(...))
  .use(staticPlugin(...))
  .use(applyAuthMiddleware) // 应用认证中间件
  .use(authRoutes)
  .use(userKeysRoutes)
  .use(userProfileRoutes)
  .use(nodeApiRoutes)
  .use(clientScriptRoutes)
  .use(globalWorkflowRoutes)
  .use(executionApiRoutes)
  .use(characterApiRoutes)
  .use(projectRoutesPlugin({ appVersion })); // 项目路由作为插件使用

// ... WebSocket 和服务器启动 ...
```

这种方式确保了所有 API 端点都通过统一的入口进行管理和配置，同时也应用了像 CORS 和静态文件服务这样的全局中间件。认证中间件 (`applyAuthMiddleware`) 在所有业务路由之前应用，以确保请求在到达具体处理器之前已经过认证检查。