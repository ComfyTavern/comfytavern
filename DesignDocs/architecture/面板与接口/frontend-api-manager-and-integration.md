# 设计文档：前端 API 适配管理器与集成接口 (v2.1)

## 1. 引言与目标

ComfyTavern 平台旨在通过一套多层次、清晰定义的 API 服务，将其核心的工作流执行能力和应用面板集成能力，灵活地暴露给不同类型的消费者，包括内部的应用面板、外部的第三方应用以及开发者。

本文档是对 `api-services-and-integration.md` 和 `api-adapter-design.md` 的整合与演进，旨在设计一个**纯前端的、以适配为核心**的 **API 适配管理器 (ApiAdapterManager)**。

**核心目标**：

- **简化应用开发**：创建一个名为 `ApiAdapterManager` 的前端核心服务，作为**从应用层（面板、外部调用）到内部原生工作流输入格式之间的“翻译层”**。它不直接与后端通信，而是为前端其他模块准备数据。
- **增强应用面板能力**：为**应用面板（微应用）**提供一个功能更强大、更灵活的 JavaScript API。面板开发者可以选择以**原生方式**直接提供工作流输入，也可以选择通过**适配器模式**，使用如 OpenAI API 的标准格式与工作流通信。
- **集成外部 API 兼容层**：将 **API 适配器 (ApiAdapter)** 的概念正式化，作为 `ApiAdapterManager` 的核心管理单元，用于执行外部 API 格式到内部工作流输入的转换。
- **明确分层**：清晰划分前端与后端的职责。前端负责用户交互、数据适配和最终执行载荷的构建；后端专注于接收标准化的工作流 JSON 并安全地执行。
- **确保设计的安全性、可扩展性和易用性**：所有设计都遵循这一基本原则。

## 2. 核心概念：前端 API 适配管理器 (`ApiAdapterManager`)

`ApiAdapterManager` 是一个运行在 ComfyTavern 前端的核心服务。它是一个**纯粹的前端数据准备与转换层**，而非一个 API 代理或网关。

它的核心职责是：接收来自应用层（如应用面板）的请求，如果需要，则使用预定义的 **API 适配器 (ApiAdapter)** 规则进行数据格式转换，最终输出可供前端其他部分（如 `ExecutionService`）用于构建最终工作流 JSON 的**原生输入值**。它还负责提供适配器的测试与调试能力。

### 2.1. 错误处理与调试机制

为了确保适配器开发的可靠性和效率，`ApiAdapterManager` 必须提供强大的错误处理和调试功能。

- **结构化错误**:

  - 当转换失败时（如 `adapterId` 不存在、`sourcePath` 无效、Transformer 执行错误等），`ApiAdapterManager` 必须抛出一个结构化的错误对象，而不是简单的字符串。
  - **示例错误结构**:
    ```typescript
    class AdapterError extends Error {
      constructor(
        public code:
          | "ADAPTER_NOT_FOUND"
          | "INVALID_SOURCE_PATH"
          | "TRANSFORMER_EXECUTION_FAILED"
          | "VALIDATION_FAILED",
        message: string,
        public details?: any
      ) {
        super(message);
        this.name = "AdapterError";
      }
    }
    ```
  - `panelApi` 的 `executeWorkflow` 方法会捕获此错误，并将其转换为对应用面板开发者友好的格式。

- **适配器测试能力**:

  - `ApiAdapterManager` 应提供一个离线测试方法，允许开发者在不实际执行整个工作流的情况下，验证适配器的转换逻辑。
  - **方法定义**:
    ```typescript
    // 在 ApiAdapterManager 内部
    async testAdapterTransform(
      adapterId: string,
      sampleData: any
    ): Promise<{
      success: boolean;
      result?: Record<string, any>; // 转换后的原生输入
      error?: AdapterError;
    }>
    ```
  - **后端测试端点 (Phase 2)**: 为支持更全面的测试（例如，当转换逻辑依赖于后端数据时），可以提供一个后端端点。
    - `POST /api/v1/adapters/{id}/test`：接收模拟的输入数据 (`sampleData`)，在后端环境中执行转换并返回结果。这对于验证同构的转换逻辑至关重要。
  - **实现说明**: 在 `Transformer` 保持纯函数（不依赖后端上下文）的前提下，此后端端点的价值有限，其实现可以推迟。仅当前端 `testAdapterTransform` 无法满足测试需求时（例如未来引入了依赖后端数据的上下文），再考虑实现此端点。

- **接口耦合验证**:
  - `ApiAdapter` 与其 `targetWorkflowId` 存在耦合关系。如果目标工作流的输入接口发生变化，适配器可能会失效。
  - **验证时机**:
    1.  **加载时 (推荐)**: 在前端从后端加载/刷新适配器列表时 (`GET /api/v1/adapters`)。工作流可能在任何时候被修改，此举可以尽早暴露接口不匹配问题。建议后端在提供列表时，为每个适配器附加一个 `validationStatus: 'OK' | 'OUTDATED' | 'WORKFLOW_NOT_FOUND'` 状态字段，以便前端 UI 能直观地展示适配器的健康状况，提升用户体验。
    2.  **执行前**: 在 `executeWorkflow` 调用 `adapter` 模式时，`ApiAdapterManager` 在执行转换**前**，应先调用 `getWorkflowInterface(adapter.targetWorkflowId)`。
    3.  **保存时**: 在适配器编辑器中保存 `ApiAdapter` 时，也应执行此验证。
  - **验证逻辑**: 校验 `adapter.requestMapping` 中的每一个 `key`（即工作流输入插槽 ID）是否存在于从 `getWorkflowInterface` 获取的输入接口定义中。
  - **失败处理**: 如果验证失败，应立即抛出 `AdapterError` (例如，`code: 'VALIDATION_FAILED'`)，并提供清晰的错误信息，指出哪个映射字段在工作流接口中已不存在，从而避免运行时才发现问题。

### 架构图

```mermaid
flowchart TD
    subgraph "应用层 (App Layer)"
        A[应用面板 / 外部调用]
    end

    subgraph "ComfyTavern 前端 (Frontend)"
        B{ApiAdapterManager}
        C[API 适配器配置]
        D[ExecutionService / WorkflowBuilder]

        B -- 管理 --> C
        A -- 1. 调用 (原生或适配器模式) --> B
        B -- 2. (如果需要)执行转换 --> B
        B -- 3. 输出原生输入值 --> D
        D -- 4. 构建完整工作流JSON --> D
        D -- 5. 发送请求 --> E
    end

    subgraph "ComfyTavern 后端 (Backend)"
        E[HTTP API: /api/v1/execute_raw_workflow]
        F[工作流执行引擎]
        E --> F
    end

    subgraph "直接调用路径 (Advanced Path)"
        G[有能力的外部系统]
        G -- 直接构建工作流JSON --> E
    end
```

## 3. 面板通信 API (`window.comfyTavern.panelApi`)

这是暴露给应用面板的接口，旨在提供稳定、易用且安全的通信桥梁。它内部会调用 `ApiAdapterManager`。

### 3.1. 核心方法

- `async getInterface(target: { type: 'adapter' | 'workflow', id: string }): Promise<WorkflowInterface>`
- `subscribeToExecutionEvents(executionId: string, callbacks: PanelExecutionCallbacks): () => void`
- `async getCurrentTheme(): Promise<ThemeInfo>`
- `async requestHostService(serviceName: string, args?: any): Promise<any>`
  - **描述**: 允许应用面板请求宿主环境（ComfyTavern 主应用）提供的特定服务，如弹出通知、访问本地存储等。
  - **安全边界**: 这是应用面板与宿主环境交互的最危险边界，必须严格控制。
    - **服务白名单**: 宿主环境必须维护一个明确的**服务白名单**，只有在白名单中注册的服务才能被面板调用。
    - **最小权限原则**: 白名单服务暴露给面板的功能必须是完成其业务所必需的**最小集合**，严禁提供任何可能触及系统底层或用户敏感信息的能力。
    - **权限控制**: 面板的定义 (`PanelDefinition`) 中可以声明其需要的服务权限，宿主在加载面板时可以据此进行授权。
    - **限流/限频**: 必须对来自面板的服务调用实施限流策略，防止面板通过高频调用（如连续弹出通知）进行 DoS 攻击或骚扰用户。
    - **参数校验**: 宿主环境在接收到服务调用请求时，必须对传入的 `args` 进行严格的类型和内容校验，防止恶意参数注入。

### 3.2. 核心交互：`invoke`

此方法封装了从数据准备到触发前端执行服务的完整流程。

`async invoke(request: InvocationRequest): Promise<InvocationResponse>`

其中 `InvocationRequest` 和 `InvocationResponse` 的定义与 `panel-api-specification.md` 中保持一致：

```typescript
// 能力调用请求对象
export type InvocationRequest =
  | {
      mode: 'adapter';
      adapterId: string;
      inputs: Record<string, any>;
    }
  | {
      mode: 'native';
      workflowId: string;
      inputs: Record<string, any>;
    };

// 能力调用响应对象
export interface InvocationResponse {
  executionId: string;
}
```

**内部流程**:

1.  `panelApi.invoke` 方法接收到 `InvocationRequest` 后，将其传递给 `ApiAdapterManager` 或直接传递给 `WorkflowInvocationService`。
2.  **`adapter` 模式**:
    - `ApiAdapterManager` 根据 `adapterId` 查找适配器规则。
    - 它使用规则转换 `inputs` 数据，并获取到目标的 `targetWorkflowId`。
    - 它将 `targetWorkflowId` 和转换后的输入传递给 `WorkflowInvocationService`。
3.  **`native` 模式**:
    - 请求直接（或通过一层简单的路由）到达 `WorkflowInvocationService`。
    - 服务使用提供的 `workflowId` 和 `inputs`。
4.  `WorkflowInvocationService` 负责获取工作流定义（无论是实时状态还是已保存的），构建最终的执行载荷，并将其发送到后端。
5.  执行成功后，`WorkflowInvocationService` 返回 `executionId`，并由 `panelApi` 最终返回给调用方。

## 4. API 适配器 (`ApiAdapter`)

`ApiAdapter` 是一个独立的、可配置的实体，与“工作流”在概念上平级。它定义了**一个外部 API 请求格式与一个内部 ComfyTavern 工作流输入之间的单向转换规则**。

这部分完整吸收了 `api-adapter-design.md` 的设计，但重点在于**请求转换**。

### 4.1. 映射规则

适配器的核心是其灵活的映射规则，它定义了数据如何从源（外部 API 请求）流向目标（工作流输入）。

- **简单映射**：直接的一对一字段映射。

  - 示例：工作流输入 `temp` ← 源 `request.body.temperature`

- **高级映射：转换器 (Transformer)**：当数据结构不匹配或需要预处理时使用。
  - **模板引擎 (Template Engine)**：使用 Handlebars.js 或 LiquidJS 等安全模板引擎处理文本和 `messages` 列表。
  - **预置函数 (Preset Functions)**：提供 `json.stringify`, `array.join`, `array.map` 等安全、无副作用的内置函数。
  - **JSONata (可选)**：用于复杂的 JSON 到 JSON 的查询和转换。

### 4.2. 数据结构 (示例)

一个 `ApiAdapter` 对象的概念性数据结构如下：

```typescript
interface ApiAdapter {
  id: string;
  name: string; // e.g., "My Character Chatbot API"
  adapterType: "openai_chat_v1" | "openai_completion_v1" | "custom";
  targetWorkflowId: string;
  modelIdentifier: string; // 主要用于后端 OpenAI 兼容层，根据外部请求的 `model` 字段路由到此适配器。在前端 `panelApi` 的 `adapter` 模式下不直接使用。

  // 请求映射规则 (Key: 工作流的输入插槽ID)
  requestMapping: Record<string, MappingRule>;

  // 响应映射规则 (可选，用于适配器测试或未来扩展)
  responseMapping?: Record<string, MappingRule>;
}

interface MappingRule {
  sourcePath: string; // e.g., "request.body.messages"
  transformer?: {
    type: "template" | "function" | "jsonata";
    expression: string; // 模板字符串或函数调用链
  };
  defaultValue?: any;
}
```

> **注**: `modelIdentifier` 是一个面向外部兼容 API 的“别名”或“路由键”。在前端通过 `panelApi.executeWorkflow` 以 `adapter` 模式调用时，系统直接使用 `adapterId` 作为唯一标识，`modelIdentifier` 在此链路中不发挥作用。其主要应用场景见 5.3 节。

### 4.3. 适配器的生命周期与来源管理

为了确保 `ApiAdapter` 的一致性、可发现性和可管理性，其生命周期管理遵循以下原则：

- **统一来源**: 所有 `ApiAdapter` 的权威定义都存储在**后端**，与工作流 (`Workflow`) 的管理方式类似。
- **API 端点**: 后端提供专门的 RESTful API 用于对 `ApiAdapter` 进行增删改查（CRUD）操作。
  - `GET /api/v1/adapters`: 获取所有可用的适配器列表。
  - `GET /api/v1/adapters/{id}`: 获取单个适配器的详细定义。
  - `POST /api/v1/adapters`: 创建一个新的适配器。
  - `PUT /api/v1/adapters/{id}`: 更新一个现有的适配器。
  - `DELETE /api/v1/adapters/{id}`: 删除一个适配器。
- **前端加载与缓存**:
  - 前端的 `ApiAdapterManager` 在初始化时，或在需要时，通过调用 `GET /api/v1/adapters` 来获取所有适配器配置。
  - 获取到的配置可以被缓存在前端，以减少不必要的网络请求。管理器应提供刷新机制以获取最新配置。
- **用户界面**:
  - 平台应提供一个专门的管理界面，让用户可以（在拥有相应权限时）创建、编辑和删除 `ApiAdapter`。
  - 这个界面会使用上述 API 与后端进行交互。

### 4.4. 数据源与上下文

**当前设计**:
在当前设计中，`ApiAdapter` 的 `MappingRule` 的 `sourcePath` 只能从 `WorkflowExecutionRequest.inputs.data` 这个载荷中获取数据。这确保了转换过程是一个纯函数，其输出完全由输入决定，易于测试和预测。

**未来考量**:
在某些高级场景下，转换逻辑可能需要依赖 `data` 之外的上下文信息，例如：

- 当前登录用户的 ID 或权限。
- 当前时间戳。
- 从后端动态获取的某个全局配置项。

如果未来需要支持这些场景，可以考虑以下方案：

- **上下文注入**: 由 `ApiAdapterManager` 在执行转换前，向 `data` 对象中安全地注入一个预定义的 `context` 对象，其中包含允许访问的上下文信息。
- **扩展 Transformer 环境**: 为 Transformer 的沙箱环境安全地提供一些只读的全局变量或函数来访问上下文。

无论采用何种方案，都必须严格控制上下文的访问范围和权限，确保适配器的安全性和可预测性。在当前版本中，我们优先保持其纯函数特性。

## 5. 后端 HTTP API 支持

后端的 API 设计可以保持简洁和专注，主要提供一个强大的、标准化的工作流执行入口。

### 5.1. 核心执行端点

- `POST /api/v1/execute_raw_workflow`
  - **这是前端调用的主要目标端点。**
  - 它接收一个完整的、扁平化的工作流 JSON 定义，以及可选的初始输入值。
  - 后端对此端点进行严格的安全校验（节点白名单、资源限制等）后执行。
  - 调用方（通常是前端的 `ExecutionService`）对工作流 JSON 的正确性和完整性负责。

### 5.2. 辅助端点

- `GET /api/v1/workflows/{workflowId}/interface`
  - 获取指定工作流的输入输出接口定义，供前端构建 UI 或进行验证。
- `GET /api/v1/executions/{promptId}/status`
  - 查询特定执行的状态和结果。
- **Webhook & Server-Sent Events (SSE)**
  - 继续支持 Webhook 回调和 SSE 事件流，用于异步通知。

### 5.3. 统一外部 API 网关：将工作流封装为标准 API

为了让用户能将 ComfyTavern 强大的工作流能力集成到任何支持 OpenAI API 的外部应用中，平台将提供一个统一的、符合 OpenAI 规范的 API 网关。

**核心定位**: 此网关的核心价值在于**将 ComfyTavern 的工作流执行能力封装成一个标准的 API 端点**。每一个通过此网关的外部 API 调用，都精确地映射并触发一次内部工作流的执行。

- **统一端点**: `POST /v1/chat/completions`

#### 5.3.1. 核心机制

1.  **API 适配器 (`ApiAdapter`)**: 这是实现封装的核心。一个 `ApiAdapter` 定义了：
    *   一个外部可见的“模型别名” (`modelIdentifier`)，例如 `my-character-chat-v1`。
    *   一个内部对应的 ComfyTavern 工作流 ID (`targetWorkflowId`)。
    *   一套转换规则 (`requestMapping`)，用于将传入的 OpenAI 格式请求体，转换为目标工作流所需的输入。

2.  **访问令牌 (Access Token)**:
    *   用户必须在 ComfyTavern 内部为自己的账户生成专用的访问令牌。
    *   这些令牌用于认证用户身份，并授权其使用 API 网关。

#### 5.3.2. 调用流程

1.  **配置**: 用户在 ComfyTavern 中创建一个 `ApiAdapter`，将一个工作流（例如，一个复杂的 Agent 对话流）映射到一个模型别名（如 `elara-the-agent`）。
2.  **认证**: 外部应用在请求头中携带用户生成的 ComfyTavern 访问令牌 (`Authorization: Bearer <comfytavern_token>`)。
3.  **请求**: 外部应用向 `POST /v1/chat/completions` 发起请求，请求体中指定 `model` 为之前配置的别名，例如 `{"model": "elara-the-agent", "messages": [...]}`。
4.  **路由与执行**:
    a. ComfyTavern 后端通过令牌认证用户。
    b. 系统使用请求中的 `model` 字段 (`elara-the-agent`)，在当前用户可访问的 `ApiAdapter` 中查找匹配的 `modelIdentifier`。
    c. 找到匹配的 `ApiAdapter` 后，系统使用其 `requestMapping` 规则，将请求中的 `messages` 等字段转换为目标工作流所需的输入。
    d. 系统执行 `ApiAdapter` 中指定的 `targetWorkflowId`，并将转换后的数据作为输入。
    e. 如果找不到匹配的 `ApiAdapter`，则返回标准的“模型未找到”错误。

#### 5.3.3. 战略意义

- **价值聚焦**: 此设计聚焦于对外提供 ComfyTavern 的核心价值——**强大的工作流执行能力**。
- **强大的封装性**: 即便是最复杂的多节点、多 LLM 调用的工作流，也可以被封装成一个单一、标准的 API 调用。
- **无缝集成**: 用户可以轻松地将他们创造的 Agent、RAG 应用或任何自动化流程，集成到任何现有的、支持 OpenAI API 的生态系统中。

### 5.4. 前后端一致性保障

为了保证在前端 `ApiAdapterManager` 和后端兼容层中执行的转换逻辑完全一致，必须遵循以下原则：

- **同构包 (Isomorphic Package)**：
  - 将 `ApiAdapter` 的 TypeScript 接口定义、所有 `MappingRule` 相关的类型，以及最核心的 **Transformer 执行器**（包括模板引擎、预置函数库、JSONata 引擎的封装）抽取到一个独立的、前后端均可引用的 npm 包中（例如 `@comfytavern/adapter-core`）。
  - 这样做可以从根本上保证“同一份代码，同一种解释”，避免因环境差异（如不同的模板引擎版本或实现）导致的行为不一致。
- **沙箱环境对齐**:
  - 同构包中的 Transformer 执行器需要考虑到不同环境的沙箱实现。
  - 在前端，它可能利用 Web Worker。
  - 在后端（Bun/Node.js），它可能利用 `vm` 模块或一个独立的进程。
  - 无论实现方式如何，其暴露的接口和功能（如允许的全局变量、可用的预置函数）必须是完全一致的。
## 6. 通用设计原则与安全

- **认证与授权**：所有后端 HTTP API 均需通过 API Key 进行认证。
- **错误处理**：使用标准 HTTP 状态码和结构化的 JSON 错误响应体。
- **API 版本管理**：通过 URL 路径进行版本控制 (`/api/v1/...`)。
- **输入验证**：对所有 API 接收的参数和数据进行严格的 Zod 验证。
- **转换器沙箱环境**：所有在 `ApiAdapter` 中定义的转换器（模板、函数、JSONata）的执行都必须在一个严格的前端沙箱环境中运行，禁止访问不安全的 API，并限制其计算资源。
  - **实现建议 (前端)**: 强烈建议使用 **Web Worker** 来执行这些转换逻辑。这能带来双重好处：
    1.  **安全隔离**: Web Worker 运行在独立的线程中，拥有自己的全局作用域，天然地隔离了主线程的 `window` 和 `document` 对象，防止转换逻辑意外或恶意地操作 DOM 或访问敏感数据。
    2.  **性能提升**: 对于计算密集的转换（如处理大型 `messages` 数组的模板），在 Web Worker 中执行可以避免阻塞主线程，确保 UI 的流畅响应。
- **原始工作流执行安全**：后端对 `/api/v1/execute_raw_workflow` 的调用执行最严格的校验，包括限制可执行节点类型、检查资源消耗等。

## 7. 关于 `promptId` 和历史记录

(此部分保留 `api-services-and-integration.md` 中的详细说明，作为重要附录)

目前，`promptId` 的管理主要是在内存中针对活跃的执行任务。执行结果会通过 WebSocket 实时发送给客户端。**但是，对于已完成的执行，目前没有一个明确的、已实现的持久化存储方案来保存其 `promptId` 对应的详细结果和历史记录。** 相关的 `HistoryService` 仍处于 `TODO` 状态。
