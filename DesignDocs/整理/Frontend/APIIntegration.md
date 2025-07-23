# 前端 API 集成文档

本文档详细描述了 ComfyTavern 前端应用中 API 客户端的组织结构、通用 API 工具的功能，以及各个主要 API 模块的职责和用法。

## 1. 前端 API 集成概览

前端应用通过专门的 API 客户端模块与后端 HTTP API 进行交互。这些模块主要存放在 [`apps/frontend-vueflow/src/api/`](apps/frontend-vueflow/src/api/) 目录下，并依赖一个通用的 API 工具文件 [`apps/frontend-vueflow/src/utils/api.ts`](apps/frontend-vueflow/src/utils/api.ts:1) 来处理底层的 HTTP 请求。

### 1.1. `apps/frontend-vueflow/src/api/` 目录职责

[`apps/frontend-vueflow/src/api/`](apps/frontend-vueflow/src/api/) 目录是前端应用中专门用于封装与后端 HTTP API 交互的客户端代码的存放位置。其核心职责是将具体的 API 调用逻辑（如构造请求、发送请求、处理响应）与应用的业务逻辑或 UI 组件分离开来。

这种分离带来了以下好处：

*   **模块化**：每个 API 领域（如认证、工作流管理）都有其专属的模块文件，使得代码更易于组织和维护。
*   **可重用性**：API 调用函数可以在应用的不同部分（如 Pinia Stores, Composables, Vue 组件）中被重用。
*   **可测试性**：可以独立测试 API 客户端模块，模拟后端响应。
*   **关注点分离**：UI 组件专注于展示和用户交互，业务逻辑层（如 Stores）专注于状态管理和业务流程，而 API 客户端则专注于与后端通信。

### 1.2. 通用 API 工具 ([`apps/frontend-vueflow/src/utils/api.ts`](apps/frontend-vueflow/src/utils/api.ts:1)) 的作用

文件 [`apps/frontend-vueflow/src/utils/api.ts`](apps/frontend-vueflow/src/utils/api.ts:1) 提供了一个名为 `useApi` 的 Composable 函数，它是前端所有 API 请求的基础。其核心作用包括：

*   **封装底层 HTTP 请求库**：
    *   内部使用了 `axios` 库来发起 HTTP 请求。
    *   通过 [`axios.create()`](apps/frontend-vueflow/src/utils/api.ts:8) 创建了一个 `axios` 实例，并进行了基础配置。
*   **提供通用的请求方法**：
    *   导出了封装好的 [`get`](apps/frontend-vueflow/src/utils/api.ts:16)、[`post`](apps/frontend-vueflow/src/utils/api.ts:21)、[`put`](apps/frontend-vueflow/src/utils/api.ts:26) 和 [`del`](apps/frontend-vueflow/src/utils/api.ts:31) (delete) 方法。
    *   这些方法简化了请求的发送，并自动处理了从响应中提取 `data` 部分的逻辑。
*   **处理通用的请求头**：
    *   在创建 `axios` 实例时，默认设置了 [`Content-Type`](apps/frontend-vueflow/src/utils/api.ts:12) 为 `application/json`。
    *   对于特定请求（如文件上传），可以在调用时覆盖默认头部，例如在 [`userProfileApi.ts`](apps/frontend-vueflow/src/api/userProfileApi.ts:78) 中上传头像时，将 `Content-Type` 设置为 `undefined` 以便 `axios` 自动处理 `multipart/form-data`。
*   **管理 API 的基础 URL (Base URL)**：
    *   通过调用 [`getApiBaseUrl()`](apps/frontend-vueflow/src/utils/api.ts:2) 函数（来自 [`apps/frontend-vueflow/src/utils/urlUtils.ts`](apps/frontend-vueflow/src/utils/urlUtils.ts)）来获取 API 的基础 URL ([`API_BASE_URL`](apps/frontend-vueflow/src/utils/api.ts:5))。这使得 API 端点可以在不同环境中轻松配置。
*   **超时配置**：
    *   设置了默认的请求超时时间为 `5000ms` ([`timeout: 5000`](apps/frontend-vueflow/src/utils/api.ts:10))。
*   **统一的 API 错误处理逻辑（部分）**：
    *   虽然 [`utils/api.ts`](apps/frontend-vueflow/src/utils/api.ts:1) 本身不直接实现复杂的全局错误处理（如自动跳转登录页或显示全局错误通知），但它为上层 API 模块提供了一个统一的请求发起点。各个 API 模块或调用方可以根据需要捕获和处理 `axios` 抛出的错误。例如，在 [`userProfileApi.ts`](apps/frontend-vueflow/src/api/userProfileApi.ts:24) 中有针对更新用户名失败的特定错误处理。

## 2. 主要 API 模块详解

以下是对 [`apps/frontend-vueflow/src/api/`](apps/frontend-vueflow/src/api/) 目录下主要 API 模块的详细说明。

### 2.1. [`apps/frontend-vueflow/src/api/authApi.ts`](apps/frontend-vueflow/src/api/authApi.ts:1)

*   **模块名称及其路径**：[`apps/frontend-vueflow/src/api/authApi.ts`](apps/frontend-vueflow/src/api/authApi.ts:1)
*   **负责的 API 领域**：该模块负责处理与用户认证相关的 API 端点，例如获取当前用户上下文信息。
*   **关键 API 调用函数**：
    *   **`getCurrentUserContext(): Promise<UserContext>`** ([`apps/frontend-vueflow/src/api/authApi.ts:9`](apps/frontend-vueflow/src/api/authApi.ts:9))
        *   **功能描述**：从后端获取当前用户的上下文信息。这包括认证模式、用户身份（如果已认证）以及相关的密钥/凭证元数据。
        *   **参数**：无。
        *   **返回值**：一个 Promise，解析为 [`UserContext`](../../../../packages/types/src/schemas.ts) 对象（类型定义在 `@comfytavern/types` 中）。
        *   **内部实现简述**：使用 [`utils/api.ts`](apps/frontend-vueflow/src/utils/api.ts:1) 中提供的 `get` 方法向 `/auth/current` 端点发起 GET 请求。

### 2.2. [`apps/frontend-vueflow/src/api/userKeysApi.ts`](apps/frontend-vueflow/src/api/userKeysApi.ts:1)

*   **模块名称及其路径**：[`apps/frontend-vueflow/src/api/userKeysApi.ts`](apps/frontend-vueflow/src/api/userKeysApi.ts:1)
*   **负责的 API 领域**：该模块负责管理用户的 API 密钥和外部服务凭证，包括列出、创建和删除这些密钥与凭证。所有请求都基于 `/users/me` 路径。
*   **关键 API 调用函数**：
    *   **服务 API 密钥 (Service API Keys)**：
        *   **`listServiceApiKeys(): Promise<ServiceApiKeyMetadata[]>`** ([`apps/frontend-vueflow/src/api/userKeysApi.ts:19`](apps/frontend-vueflow/src/api/userKeysApi.ts:19))
            *   **功能描述**：列出当前用户的所有服务 API 密钥的元数据。
            *   **参数**：无。
            *   **返回值**：一个 Promise，解析为 [`ServiceApiKeyMetadata`](../../../../packages/types/src/schemas.ts) 数组。
            *   **内部实现简述**：使用 `get` 方法向 `/users/me/service-keys` 端点发起 GET 请求。
        *   **`createServiceApiKey(payload: CreateServiceApiKeyPayload): Promise<ServiceApiKeyWithSecret>`** ([`apps/frontend-vueflow/src/api/userKeysApi.ts:29`](apps/frontend-vueflow/src/api/userKeysApi.ts:29))
            *   **功能描述**：为当前用户创建一个新的服务 API 密钥。
            *   **参数**：`payload` ([`CreateServiceApiKeyPayload`](../../../../packages/types/src/schemas.ts))，包含创建密钥所需的参数（如名称、范围）。
            *   **返回值**：一个 Promise，解析为包含密钥明文的 [`ServiceApiKeyWithSecret`](../../../../packages/types/src/schemas.ts) 对象。
            *   **内部实现简述**：使用 `post` 方法向 `/users/me/service-keys` 端点发起 POST 请求。
        *   **`deleteServiceApiKey(keyId: string): Promise<void>`** ([`apps/frontend-vueflow/src/api/userKeysApi.ts:39`](apps/frontend-vueflow/src/api/userKeysApi.ts:39))
            *   **功能描述**：删除当前用户指定的服务 API 密钥。
            *   **参数**：`keyId` (string)，要删除的密钥的 ID。
            *   **返回值**：一个 Promise，在成功时解析为 `void`。
            *   **内部实现简述**：使用 `del` 方法向 `/users/me/service-keys/:keyId` 端点发起 DELETE 请求。
    *   **外部服务凭证 (External Service Credentials)**：
        *   **`listExternalCredentials(): Promise<ExternalCredentialMetadata[]>`** ([`apps/frontend-vueflow/src/api/userKeysApi.ts:50`](apps/frontend-vueflow/src/api/userKeysApi.ts:50))
            *   **功能描述**：列出当前用户的所有外部服务凭证的元数据。
            *   **参数**：无。
            *   **返回值**：一个 Promise，解析为 [`ExternalCredentialMetadata`](../../../../packages/types/src/schemas.ts) 数组。
            *   **内部实现简述**：使用 `get` 方法向 `/users/me/credentials` 端点发起 GET 请求。
        *   **`createExternalCredential(payload: CreateExternalCredentialPayload): Promise<StoredExternalCredential>`** ([`apps/frontend-vueflow/src/api/userKeysApi.ts:60`](apps/frontend-vueflow/src/api/userKeysApi.ts:60))
            *   **功能描述**：为当前用户添加一个新的外部服务凭证。
            *   **参数**：`payload` ([`CreateExternalCredentialPayload`](../../../../packages/types/src/schemas.ts))，包含创建凭证所需的参数（如服务名称、凭证内容）。
            *   **返回值**：一个 Promise，解析为不含敏感信息的 [`StoredExternalCredential`](../../../../packages/types/src/schemas.ts) 对象。
            *   **内部实现简述**：使用 `post` 方法向 `/users/me/credentials` 端点发起 POST 请求。
        *   **`deleteExternalCredential(credentialId: string): Promise<void>`** ([`apps/frontend-vueflow/src/api/userKeysApi.ts:70`](apps/frontend-vueflow/src/api/userKeysApi.ts:70))
            *   **功能描述**：删除当前用户指定的外部服务凭证。
            *   **参数**：`credentialId` (string)，要删除的凭证的 ID。
            *   **返回值**：一个 Promise，在成功时解析为 `void`。
            *   **内部实现简述**：使用 `del` 方法向 `/users/me/credentials/:credentialId` 端点发起 DELETE 请求。

### 2.3. [`apps/frontend-vueflow/src/api/userProfileApi.ts`](apps/frontend-vueflow/src/api/userProfileApi.ts:1)

*   **模块名称及其路径**：[`apps/frontend-vueflow/src/api/userProfileApi.ts`](apps/frontend-vueflow/src/api/userProfileApi.ts:1)
*   **负责的 API 领域**：该模块负责处理用户个人资料相关的 API，例如更新用户名和上传头像。
*   **关键 API 调用函数**：
    *   **`updateDefaultUsername(payload: UpdateUsernamePayload): Promise<UpdateUsernameResponse>`** ([`apps/frontend-vueflow/src/api/userProfileApi.ts:18`](apps/frontend-vueflow/src/api/userProfileApi.ts:18))
        *   **功能描述**：更新当前默认用户的用户名。
        *   **参数**：`payload` ([`UpdateUsernamePayload`](apps/frontend-vueflow/src/api/userProfileApi.ts:3))，包含新用户名 `{ username: string }`。
        *   **返回值**：一个 Promise，解析为 [`UpdateUsernameResponse`](apps/frontend-vueflow/src/api/userProfileApi.ts:7) 对象，包含成功状态、消息和可选的更新后用户名。
        *   **内部实现简述**：使用 `put` 方法向 `/users/me/username` 端点发起 PUT 请求。包含特定的错误处理逻辑，以解析后端返回的错误信息。
    *   **`uploadAvatar(originalFile: File): Promise<UploadAvatarResponse>`** ([`apps/frontend-vueflow/src/api/userProfileApi.ts:48`](apps/frontend-vueflow/src/api/userProfileApi.ts:48))
        *   **功能描述**：上传用户头像文件。
        *   **参数**：`originalFile` (File)，要上传的头像文件。
        *   **返回值**：一个 Promise，解析为 [`UploadAvatarResponse`](apps/frontend-vueflow/src/api/userProfileApi.ts:37) 对象，包含成功状态、消息和可选的新头像 URL。
        *   **内部实现简述**：
            *   创建一个 `FormData` 对象，并将文件附加到其中，字段名为 `avatar`。
            *   文件名被简化为 `avatar.[extension]`。
            *   使用 `post` 方法向 `/users/me/avatar` 端点发起 POST 请求。
            *   在请求配置中，将 `headers['Content-Type']` 设置为 `undefined` ([`apps/frontend-vueflow/src/api/userProfileApi.ts:80`](apps/frontend-vueflow/src/api/userProfileApi.ts:80))，以便 `axios` 自动处理 `multipart/form-data` 类型的请求头和边界。
            *   包含特定的错误处理逻辑，以解析后端返回的错误信息，特别是文件验证相关的错误。

### 2.4. [`apps/frontend-vueflow/src/api/workflow.ts`](apps/frontend-vueflow/src/api/workflow.ts:1)

*   **模块名称及其路径**：[`apps/frontend-vueflow/src/api/workflow.ts`](apps/frontend-vueflow/src/api/workflow.ts:1)
*   **负责的 API 领域**：该模块负责处理与工作流相关的 CRUD (创建、读取、更新、删除) 操作。所有 API 调用都与特定的项目 (`projectId`) 相关联。
*   **关键 API 调用函数**：
    *   **`listWorkflowsApi(projectId: string): Promise<Array<{ id: string; name: string }>>`** ([`apps/frontend-vueflow/src/api/workflow.ts:12`](apps/frontend-vueflow/src/api/workflow.ts:12))
        *   **功能描述**：获取指定项目下所有工作流的列表（仅包含 ID 和名称等元数据）。
        *   **参数**：`projectId` (string)，项目 ID。
        *   **返回值**：一个 Promise，解析为包含工作流元数据 `{ id: string; name: string }` 的数组。
        *   **内部实现简述**：使用 `get` 方法向 `/projects/:projectId/workflows` 端点发起 GET 请求。
    *   **`loadWorkflowApi(projectId: string, workflowId: string): Promise<WorkflowObject | null>`** ([`apps/frontend-vueflow/src/api/workflow.ts:32`](apps/frontend-vueflow/src/api/workflow.ts:32))
        *   **功能描述**：从后端加载指定项目下的特定工作流的完整数据。
        *   **参数**：`projectId` (string)，项目 ID；`workflowId` (string)，工作流 ID。
        *   **返回值**：一个 Promise，解析为 [`WorkflowObject`](../../../../packages/types/src/workflow.ts) 对象；如果未找到，则解析为 `null`。
        *   **内部实现简述**：使用 `get` 方法向 `/projects/:projectId/workflows/:workflowId` 端点发起 GET 请求。会处理 404 错误并返回 `null`。
    *   **`saveWorkflowApi(projectId: string, data: Omit<WorkflowObject, 'id'> | WorkflowObject, workflowId?: string): Promise<WorkflowObject>`** ([`apps/frontend-vueflow/src/api/workflow.ts:58`](apps/frontend-vueflow/src/api/workflow.ts:58))
        *   **功能描述**：保存工作流到后端。如果提供了 `workflowId`，则为更新 (PUT) 操作；否则为创建 (POST) 操作。
        *   **参数**：
            *   `projectId` (string)，项目 ID。
            *   `data` ([`Omit<WorkflowObject, 'id'>`](../../../../packages/types/src/workflow.ts) 或 [`WorkflowObject`](../../../../packages/types/src/workflow.ts))，工作流数据。
            *   `workflowId` (string, 可选)，如果更新现有工作流，则提供其 ID。
        *   **返回值**：一个 Promise，解析为保存（创建或更新）后的 [`WorkflowObject`](../../../../packages/types/src/workflow.ts) 对象。
        *   **内部实现简述**：
            *   根据是否提供 `workflowId`，选择使用 `put` 方法 (更新到 `/projects/:projectId/workflows/:workflowId`) 或 `post` 方法 (创建到 `/projects/:projectId/workflows`)。
            *   在发送数据前，会记录 `core:NodeGroup` 节点的相关信息（使用 [`deepClone`](apps/frontend-vueflow/src/utils/deepClone.ts:1)）。
    *   **`deleteWorkflowApi(projectId: string, workflowId: string): Promise<void>`** ([`apps/frontend-vueflow/src/api/workflow.ts:117`](apps/frontend-vueflow/src/api/workflow.ts:117))
        *   **功能描述**：从后端删除指定项目下的特定工作流。
        *   **参数**：`projectId` (string)，项目 ID；`workflowId` (string)，工作流 ID。
        *   **返回值**：一个 Promise，在成功时解析为 `void`。
        *   **内部实现简述**：使用 `del` 方法向 `/projects/:projectId/workflows/:workflowId` 端点发起 DELETE 请求。会处理 404 错误并抛出特定错误。

## 3. 在应用中使用 API 客户端

在 [`apps/frontend-vueflow/src/api/`](apps/frontend-vueflow/src/api/) 目录下定义的 API 客户端模块通常在前端应用的以下部分被调用和使用：

*   **Pinia Stores 的 Actions 中**：
    *   这是最常见的模式。Pinia store 的 actions 负责处理异步操作和状态变更。API 调用通常封装在 actions 内部，获取数据后提交 mutations (或直接修改 state) 来更新应用状态。
    *   例如，[`workflowStore.ts`](apps/frontend-vueflow/src/stores/workflowStore.ts:1) 可能会调用 [`workflow.ts`](apps/frontend-vueflow/src/api/workflow.ts:1) 中的函数来加载、保存或删除工作流，并相应地更新工作流列表或当前活动工作流的状态。
    *   同样，[`authStore.ts`](apps/frontend-vueflow/src/stores/authStore.ts:1) 可能会调用 [`authApi.ts`](apps/frontend-vueflow/src/api/authApi.ts:1) 来获取用户上下文。

*   **Composable 函数中**：
    *   对于某些特定功能或 UI 模块，可能会创建 Composable 函数来封装相关的 API 调用、本地状态管理和逻辑。
    *   例如，一个管理用户设置的 Composable 可能会调用 [`userProfileApi.ts`](apps/frontend-vueflow/src/api/userProfileApi.ts:1) 中的函数来更新用户名或头像，并管理相关的加载状态和错误信息。

*   **Vue 组件的 `<script setup>` 中（较少情况）**：
    *   在少数情况下，如果 API 调用非常简单，并且与特定用户交互紧密相关（例如，点击按钮触发一个一次性的简单操作），可能会直接在组件的 `<script setup>` 中调用 API 函数。
    *   然而，为了更好的状态管理和逻辑分离，更复杂的或涉及共享状态的 API 调用通常会委托给 Pinia store 或 Composable。

通过这种方式，API 交互逻辑得到了良好的组织和封装，使得前端应用代码更加清晰、可维护和可测试。
### 2.5. `apps/frontend-vueflow/src/api/adapterApi.ts`

*   **模块名称及其路径**: [`apps/frontend-vueflow/src/api/adapterApi.ts`](apps/frontend-vueflow/src/api/adapterApi.ts:1)
*   **负责的 API 领域**: 该模块负责处理前端 API 适配器（ApiAdapter）的 CRUD 操作。这些适配器定义了应用面板如何与后端工作流进行数据转换和调用。其底层操作依赖于文件管理器 API 来读写适配器配置的 JSON 文件。
*   **关键 API 调用函数**:
    *   **`list(projectId: string): Promise<ApiAdapter[]>`**: 列出指定项目的所有 API 适配器。
    *   **`get(projectId: string, adapterId: string): Promise<ApiAdapter | null>`**: 获取单个 API 适配器的详细定义。
    *   **`create(projectId: string, payload: CreateApiAdapterPayload): Promise<ApiAdapter>`**: 创建一个新的 API 适配器。
    *   **`update(projectId: string, adapterId: string, payload: UpdateApiAdapterPayload): Promise<ApiAdapter>`**: 更新一个现有的 API 适配器。
    *   **`remove(projectId: string, adapterId: string): Promise<void>`**: 删除一个 API 适配器。
*   **内部实现简述**: 这些函数通过调用 `fileManagerApiClient` 的 `listDir`, `readFile`, `writeFile`, `deleteFilesOrDirs` 等方法，将 API 适配器作为项目目录下的 JSON 文件进行管理。

### 2.6. `apps/frontend-vueflow/src/api/fileManagerApi.ts`

*   **模块名称及其路径**: [`apps/frontend-vueflow/src/api/fileManagerApi.ts`](apps/frontend-vueflow/src/api/fileManagerApi.ts:1)
*   **负责的 API 领域**: 该模块提供了与后端文件管理服务 (FAMService) 交互的核心 API。它允许前端应用执行各种文件和目录操作。
*   **关键 API 调用函数**:
    *   **`listDir(logicalPath: string, options?: { ensureExists?: boolean }): Promise<FAMItem[]>`**: 列出指定逻辑路径下的文件和目录。
    *   **`createDir(parentLogicalPath: string, dirName: string): Promise<FAMItem>`**: 在指定父路径下创建新目录。
    *   **`writeFile(targetLogicalPath: string, formData: FormData): Promise<FAMItem[]>`**: 上传一个或多个文件到指定路径。
    *   **`renameFileOrDir(logicalPath: string, newName: string): Promise<FAMItem>`**: 重命名文件或目录。
    *   **`moveFilesOrDirs(sourcePaths: string[], targetParentPath: string): Promise<FAMItem[]>`**: 移动一个或多个文件/目录。
    *   **`deleteFilesOrDirs(logicalPaths: string[]): Promise<void>`**: 删除一个或多个文件/目录。
    *   **`getDownloadFileLink(logicalPath: string): Promise<string>`**: 获取文件的直接下载链接。
    *   **`readFile(logicalPath: string): Promise<any>`**: 读取指定文件的内容。
    *   **`writeJsonFile(logicalPath: string, content: object): Promise<void>`**: 直接通过 JSON 内容写入一个文件（通常用于配置文件）。
*   **内部实现简述**: 所有函数都使用 `useApi()` 提供的底层 HTTP 方法 (`get`, `post`, `put`, `del`) 向后端 `/fam` 前缀下的相应端点发起请求。

### 2.7. `apps/frontend-vueflow/src/api/llmConfigApi.ts`

*   **模块名称及其路径**: [`apps/frontend-vueflow/src/api/llmConfigApi.ts`](apps/frontend-vueflow/src/api/llmConfigApi.ts:1)
*   **负责的 API 领域**: 该模块负责处理与大语言模型 (LLM) 配置相关的 API 端点，包括管理 API 渠道（凭证）、已激活的模型以及 LLM 提供商列表。
*   **关键 API 调用函数**:
    *   **API 渠道 (Credentials)**:
        *   **`getProviders(): Promise<{ id: string; name: string }[]>`**: 获取所有可用的 LLM 提供商列表。
        *   **`getApiChannels(): Promise<ApiCredentialConfig[]>`**: 获取所有用户配置的 API 渠道。
        *   **`saveApiChannel(channel: Partial<ApiCredentialConfig>): Promise<ApiCredentialConfig>`**: 保存（创建或更新）一个 API 渠道。
        *   **`deleteApiChannel(id: string): Promise<void>`**: 删除一个 API 渠道。
        *   **`listModelsFromChannel(id: string): Promise<string[]>`**: 列出指定渠道可用的模型 ID。
    *   **已激活的模型 (Activated Models)**:
        *   **`getActivatedModels(): Promise<ActivatedModelInfo[]>`**: 获取所有已激活的模型列表。
        *   **`addActivatedModel(modelData: Omit<ActivatedModelInfo, 'id' | 'createdAt'>): Promise<ActivatedModelInfo>`**: 添加一个新激活的模型。
        *   **`updateActivatedModel(id: string, modelData: Partial<Omit<ActivatedModelInfo, 'id' | 'createdAt'>>): Promise<ActivatedModelInfo>`**: 更新一个已激活的模型。
        *   **`deleteActivatedModel(id: string): Promise<void>`**: 删除一个已激活的模型。
    *   **模型发现 (Model Discovery)**:
        *   **`discoverModelsFromChannel(channelId: string): Promise<any[]>`**: 从指定渠道发现可用的模型。
*   **内部实现简述**: 这些函数都使用 `useApi()` 提供的底层 HTTP 方法 (`get`, `post`, `put`, `del`) 向后端 `/llm` 前缀下的相应端点发起请求。

### 2.8. `apps/frontend-vueflow/src/api/pluginApi.ts`

*   **模块名称及其路径**: [`apps/frontend-vueflow/src/api/pluginApi.ts`](apps/frontend-vueflow/src/api/pluginApi.ts:1)
*   **负责的 API 领域**: 该模块负责处理与后端插件管理相关的 API 端点。
*   **关键 API 调用函数**:
    *   **`getPlugins(): Promise<ExtensionInfo[]>`**: 获取所有已发现的插件列表。
    *   **`setPluginState(pluginName: string, enabled: boolean): Promise<{ success: boolean; message: string }>`**: 设置指定插件的启用/禁用状态。
    *   **`reloadPlugins(): Promise<{ success: boolean; message: string; count: number }>`**: 请求后端重新扫描并加载所有插件（通常在安装或删除插件文件后调用）。
*   **内部实现简述**: 这些函数使用 `api` (即 `useApi()` 的实例) 向后端 `/plugins` 前缀下的相应端点发起请求。