# 设计文档：API 服务与集成接口设计 (v1)

## 1. 引言与目标

ComfyTavern 平台通过一套多层次的 API 服务，将其核心的工作流执行能力和应用面板集成能力暴露给不同类型的消费者。本文档旨在详细定义这些 API 接口的类别、目标用户、核心职责、接口规范以及相关的设计原则。

**目标**：

*   为**应用面板（微应用）**提供一个稳定、易用的 JavaScript API，使其能够与平台内预定义的工作流进行深度交互。
*   为**第三方应用和开发者**提供标准的 HTTP API，以便将 ComfyTavern 的工作流能力作为服务集成到外部系统中。
*   支持对 **OpenAI API 格式的兼容**，降低现有 OpenAI 生态工具的集成门槛。
*   为**高级用例**提供直接执行原始工作流定义的接口，赋予最大的灵活性。
*   确保所有 API 的设计都遵循安全性、可扩展性和易用性的原则。

## 2. API 类别、目标用户与核心职责

ComfyTavern 提供以下主要类别的 API：

### 2.1. 面向应用面板的 JavaScript API (`window.comfyTavernPanelApi`)

*   **目标用户**：应用面板（微应用）的开发者。
*   **交互方式**：通过注入到面板 `<iframe>` `contentWindow` 的全局 JavaScript 对象进行调用。
*   **核心职责**：
    *   作为应用面板与 ComfyTavern 平台（特别是其**预定义工作流**）之间主要的、标准化的通信桥梁。
    *   封装工作流接口获取、输入值到工作流特定槽位的映射与注入、触发执行、实时事件订阅等复杂逻辑。
    *   提供面板与宿主环境进行其他交互的能力（如获取主题信息、请求UI服务等）。
*   **关键特性**：
    *   **易用性**：为面板开发者提供简洁、高级的接口，无需关心工作流的内部图结构或与后端通信的底层细节。
    *   **安全性**：运行在沙盒环境中，API 的能力受到平台的严格控制。
*   **主要接口定义 (示例)**：
    *   `async getWorkflowInterface(workflowId: string): Promise<{ inputs: Record<string, GroupSlotInfo>, outputs: Record<string, GroupSlotInfo> }>`
        *   获取指定 `workflowId` (在面板 `PanelDefinition.workflowBindings` 中声明的) 的输入输出接口定义。
    *   `async executeWorkflow(workflowId: string, interfaceInputValues: Record<string, any>): Promise<{ executionId: string }>`
        *   异步启动指定 `workflowId` 的执行，传入用户在面板中提供的输入值。返回一个唯一的执行 ID。
    *   `subscribeToExecutionEvents(executionId: string, callbacks: PanelExecutionCallbacks): () => void`
        *   订阅指定执行 ID 的实时事件，如状态变更、节点输出、工作流最终输出、错误等。返回一个取消订阅的函数。
        *   `PanelExecutionCallbacks`: `{ onStatusChange?, onNodeOutput?, onWorkflowOutput?, onError? }`
    *   `async getCurrentTheme(): Promise<{ isDark: boolean, colors: Record<string, string>, ... }>`
        *   获取当前宿主环境的主题信息。
    *   `async requestHostService(serviceName: string, args?: any): Promise<any>`
        *   一个通用的请求宿主服务的接口，例如：
            *   `requestHostService('resize', { height: '800px' })`
            *   `requestHostService('showNotification', { message: '任务完成', type: 'success' })`
            *   `requestHostService('storage.setItem', { key: 'panelState', value: '...' })`

### 2.2. HTTP API: 与预定义工作流交互

*   **目标用户**：第三方应用、后端服务、自动化脚本等外部系统。
*   **交互方式**：标准的 HTTP/S 请求。
*   **核心职责**：将平台内**预定义的工作流**作为独立的服务暴露出去，允许外部系统通过网络调用。
*   **主要接口定义**：
    *   `GET /api/v1/workflows/{workflowId}/interface`
        *   描述：获取指定 `workflowId` 的工作流的输入输出接口定义。
        *   认证：需要。
    *   `POST /api/v1/workflows/{workflowId}/execute`
        *   描述：执行指定的 `workflowId` 代表的工作流。
        *   认证：需要。
        *   请求体：`{ "interfaceInputValues": Record<string, any>, "executionOptions"?: { "mode": "async" | "sync", "callbackUrl"?: string } }`
        *   响应：
            *   异步模式 (默认或 `mode: "async"`)：返回 `202 Accepted` 和 `{ "executionId": "string" }`。调用方可通过其他端点查询状态或通过 Webhook/SSE 接收事件。
            *   同步模式 (可选, `mode: "sync"`, 适用于快速执行的工作流)：直接返回 `200 OK` 和 `{ "outputs": Record<string, any> }` 或相应的错误。
    *   `GET /api/v1/executions/{executionId}/status`
        *   描述：查询特定 `executionId` 的执行状态和结果（如果已完成）。
        *   认证：需要。
    *   **Webhook 回调 (可选配置)**：
        *   平台允许 API 调用方在执行请求时（或通过管理界面）注册一个回调 URL。
        *   当工作流执行完成、失败或达到特定阶段时，平台向该 URL 发送包含执行结果或状态的 HTTP POST 请求。
    *   **Server-Sent Events (SSE) (可选)**：
        *   `GET /api/v1/executions/{executionId}/events`
        *   描述：客户端可以通过此端点建立一个持久连接，接收关于特定 `executionId` 执行过程中的实时事件流（状态更新、中间输出等）。

### 2.3. HTTP API: OpenAI API 兼容层

*   **目标用户**：希望利用现有 OpenAI SDK、工具链或已集成 OpenAI API 的应用。
*   **交互方式**：标准的 HTTP/S 请求，遵循 OpenAI API 的路径和数据格式。
*   **核心职责**：将 ComfyTavern 平台内特定的、经过适配的**预定义工作流**包装成 OpenAI 兼容的 API 端点。API 网关负责请求/响应格式的转换和到目标工作流的路由。
*   **主要实现方式**：
    *   **端点映射**：提供 OpenAI 标准端点，如：
        *   `POST /v1/chat/completions`
        *   `POST /v1/completions` (旧版)
        *   (未来可扩展) `POST /v1/images/generations`, `POST /v1/embeddings`
    *   **工作流路由**：主要通过请求中的 `model` 参数值映射到具体的 ComfyTavern 工作流 ID。API 网关维护此映射关系。
    *   **请求转换**：将 OpenAI 请求参数（如 `messages`, `temperature`, `max_tokens`, `stream`）通过灵活的映射规则转换为目标工作流的 `interfaceInputValues`。`messages` 列表的处理需要在工作流内部通过专用节点或脚本完成。
    *   **响应转换**：将工作流的 `interfaceOutputs` 转换为 OpenAI 标准响应格式（包括 `choices`, `message`, `usage` 统计等）。若工作流未提供 token 计数，`usage` 字段可能省略或估算。错误也需转换为 OpenAI 标准错误对象。
    *   **认证**：沿用平台统一的 API Key 认证机制。

### 2.4. HTTP API: 直接原始工作流执行

*   **目标用户**：需要动态构建和执行任意工作流图结构的高级应用面板、开发者工具、自动化脚本或其他后端系统。
*   **交互方式**：标准的 HTTP/S 请求。
*   **核心职责**：接收调用方**自行构建的完整、扁平化的工作流 JSON 定义**以及可选的初始输入，并将其提交给后端执行引擎执行。
*   **调用方责任**：调用方对工作流 JSON 的正确性、完整性和安全性负主要责任。
*   **API 层的角色**：
    *   **后端端点**：直接接收请求，进行严格的安全校验（如限制可执行节点类型、检查资源消耗等），然后执行。
    *   **前端代理 (如果存在)**：如果此类请求通过前端的某个 API 代理（例如，一个非常高级的面板通过 JS 调用了一个封装此功能的接口），该前端代理的角色应**近乎透明的转发**。它主要负责认证、将请求路由到后端对应的 `/api/v1/execute_raw_workflow` 端点，**不应解析或修改工作流 JSON 本身**。
*   **主要接口定义**：
    *   `POST /api/v1/execute_raw_workflow`
        *   认证：需要。
        *   请求体：
            ```json
            {
              "workflow_json": { /* ... 扁平化的、符合后端执行引擎要求的完整工作流图定义 ... */ },
              "inputs": { 
                /* 可选的，用于覆盖工作流中特定节点特定输入槽的初始值。
                   例如: { "node_id_1": { "input_slot_name": "new_value" } } 
                */
              },
              "client_id": "string" // (可选) 用于 WebSocket 通信的客户端ID，以便接收执行事件
            }
            ```
        *   响应：
            *   异步模式 (推荐)：返回 `202 Accepted` 和 `{ "execution_id": "string" }`。
            *   同步模式 (可选, 用于极快速的工作流)：直接返回执行结果。

## 3. 通用 API 设计原则

*   **认证与授权**：
    *   所有 HTTP API（类别 2.2, 2.3, 2.4）均需认证。首选 API Key 机制（通过 HTTP 头部 `Authorization: Bearer <API_KEY>` 或 `X-API-Key: <API_KEY>`）。
    *   API Key 应具有可配置的权限范围（例如，可访问的工作流、允许的操作等）。
    *   未来可考虑 OAuth 2.0 等更完善的授权方案。
*   **请求与响应格式**：统一使用 JSON。
*   **错误处理**：
    *   使用标准的 HTTP 状态码（4xx 表示客户端错误，5xx 表示服务器端错误）。
    *   错误响应体应包含结构化的错误信息：`{ "error": { "type": "string", "message": "string", "code"?: "string", "param"?: "string" } }`。
*   **API 版本管理**：通过 URL 路径进行版本控制 (e.g., `/api/v1/...`)。
*   **速率限制**：对所有 API 调用实施合理的速率限制，防止滥用。
*   **日志与监控**：记录详细的 API 调用日志（请求、响应、错误、调用者信息等），监控 API 性能和异常行为。
*   **幂等性**：对于可能产生副作用的 `POST`, `PUT`, `DELETE` 请求，尽可能设计为幂等的，或提供机制让调用方实现幂等性（如使用唯一的请求 ID）。

## 4. API 网关/代理层架构 (初步设想)

*   **`window.comfyTavernPanelApi` 的实现**：这部分逻辑通常作为 ComfyTavern 前端应用的一部分存在。它直接与前端的路由、状态管理、以及与后端 WebSocket 管理器交互。
*   **HTTP API 的实现**：
    *   可以与 ComfyTavern 后端主应用一同部署（例如，作为 Elysia 应用的额外路由）。
    *   也可以作为一个独立的轻量级 API 网关微服务（推荐使用与后端一致的技术栈，如 Bun/Elysia）。此网关负责认证、请求校验、路由、以及与后端核心执行引擎的通信（可能是内部 API 调用或消息队列）。
    *   OpenAI 兼容层和直接原始工作流执行 API 通常在此网关中实现。
*   **与后端核心的交互**：API 网关/代理层通过内部机制（如直接函数调用、内部 HTTP API、或通过 WebSocket 管理器）与后端的 `ExecutionEngine` 和 `NodeManager` 等核心服务通信。

## 5. 安全考虑 (API层面)

*   **输入验证**：对所有 API 接收的参数和数据进行严格的类型、格式和内容验证。
*   **输出编码**：确保返回给客户端的数据经过适当编码，防止 XSS 等问题（主要针对返回 HTML 内容的场景，JSON API 相对安全）。
*   **防止信息泄露**：错误信息不应泄露过多敏感的内部系统细节。
*   **依赖安全**：确保 API 实现所依赖的库和框架没有已知的安全漏洞。
*   **传输安全**：所有 API 通信强制使用 HTTPS。
*   **原始工作流执行的安全**：对于 `/api/v1/execute_raw_workflow`，后端必须进行极其严格的校验，包括但不限于：
    *   限制可执行的节点类型（例如，禁止执行能直接操作文件系统或执行任意代码的“不安全”节点，除非调用者有特殊授权）。
    *   检查工作流的复杂度、资源消耗预期，防止拒绝服务攻击。
    *   对输入值进行清理和验证。

## 6. 未来展望

*   更完善的 API 监控、分析和计费系统。
*   支持 GraphQL API 接口作为 REST API 的补充。
*   为第三方提供更细致的 WebSocket API 服务（通过 API 网关管理）。
*   API 文档自动化生成与发布 (e.g., from OpenAPI specs)。
*   


## 7. 关于executionId的说明

#### 根据对现有代码的分析，关于 `executionId`（在代码中通常称为 `promptId`）的管理和执行结果的存储，目前的情况如下：

**1. `executionId` (`promptId`) 的生成与管理：**

*   **生成**：当一个新的工作流执行被提交时，[`ConcurrencyScheduler`](apps/backend/src/services/ConcurrencyScheduler.ts:1) 会使用 `nanoid()` 为这次执行生成一个唯一的 `promptId` ([`apps/backend/src/services/ConcurrencyScheduler.ts:52`](apps/backend/src/services/ConcurrencyScheduler.ts:52))。
*   **内存管理**：
    *   `ConcurrencyScheduler` 在内存中维护两个主要列表来管理活跃的执行：
        *   `runningExecutions`: 一个 `Map`，存储当前正在运行的执行任务。
        *   `waitingQueue`: 一个数组，存储等待执行的任务。
    *   这些列表用于调度、追踪实时状态和中断操作。
*   **传递**：
    *   `promptId` 会在提交执行的 API 响应中返回给客户端（例如，HTTP API [`POST /api/prompt`](apps/backend/src/routes/executionRoutes.ts:18) 返回 `{ promptId: ... }`）。
    *   在 WebSocket 通信中，`promptId` 也用于标识相关的执行事件。
    *   `ExecutionEngine` 在执行具体工作流时，会接收并使用这个 `promptId`。

**2. 执行结果的处理与存储：**

*   **节点执行期间的内存存储**：
    *   [`ExecutionEngine`](apps/backend/src/ExecutionEngine.ts:1) 在执行工作流时，会将每个节点的输出结果临时存储在其内部的 `this.nodeResults` 对象中 ([`apps/backend/src/ExecutionEngine.ts:523`](apps/backend/src/ExecutionEngine.ts:523))。这些结果主要用于后续节点的输入。
*   **实时结果传递 (WebSocket)**：
    *   当一个节点执行完成时，`ExecutionEngine` 会通过 WebSocket 发送 `NODE_COMPLETE` 消息，其中包含该节点的 `output` ([`apps/backend/src/ExecutionEngine.ts:549-556`](apps/backend/src/ExecutionEngine.ts:549-556))。
    *   当整个工作流执行完成时，如果定义了 `outputInterfaceMappings`，`ExecutionEngine` 会聚合最终的工作流输出，并使用一个特殊的节点 ID `__WORKFLOW_INTERFACE_OUTPUTS__` 通过 `NODE_COMPLETE` 消息发送 ([`apps/backend/src/ExecutionEngine.ts:137-157`](apps/backend/src/ExecutionEngine.ts:137-157))。
*   **通过 API 查询状态和结果 (部分实现，部分 TODO)**：
    *   API 端点 `GET /api/prompt/:promptId` ([`apps/backend/src/routes/executionRoutes.ts:62`](apps/backend/src/routes/executionRoutes.ts:62)) 用于查询特定执行的状态。
    *   目前，它主要从 `ConcurrencyScheduler` 的内存中获取运行中或等待中任务的状态 ([`apps/backend/src/routes/executionRoutes.ts:65`](apps/backend/src/routes/executionRoutes.ts:65))。
    *   代码中有明确的 `TODO` 指出，需要从一个设想中的 `HistoryService` 获取更详细的信息，包括已完成任务的 `outputs` 和 `nodeStatus` ([`apps/backend/src/routes/executionRoutes.ts:67-71`](apps/backend/src/routes/executionRoutes.ts:67-71), [`apps/backend/src/routes/executionRoutes.ts:76-77`](apps/backend/src/routes/executionRoutes.ts:76-77))。
*   **持久化存储 (目前缺失/TODO)**：
    *   在 `ConcurrencyScheduler` ([`apps/backend/src/services/ConcurrencyScheduler.ts:151`](apps/backend/src/services/ConcurrencyScheduler.ts:151)) 和 `ExecutionEngine` ([`apps/backend/src/ExecutionEngine.ts:159`](apps/backend/src/ExecutionEngine.ts:159), [`apps/backend/src/ExecutionEngine.ts:164`](apps/backend/src/ExecutionEngine.ts:164)) 的代码中，都有 `TODO` 注释，指出需要将执行结果（成功或失败）存入一个 `HistoryService`。
    *   然而，目前在 `apps/backend/src/services/` 目录下并没有找到 `HistoryService.ts` 的实现。
    *   类型文件 [`packages/types/src/history.ts`](packages/types/src/history.ts:1) 定义的是编辑器操作历史，与执行结果历史无关。
    *   类型文件 [`packages/types/src/workflowExecution.ts`](packages/types/src/workflowExecution.ts:1) 中虽然定义了 `HistoryEntryResponse` ([`packages/types/src/workflowExecution.ts:233`](packages/types/src/workflowExecution.ts:233)) 作为 `/history/{promptId}` API 的响应示例，但其依赖的持久化存储机制并未实现。

**总结：**

目前，`executionId` (`promptId`) 的管理主要是在内存中针对活跃的执行任务。执行结果会通过 WebSocket 实时发送给客户端。**但是，对于已完成的执行，目前没有一个明确的、已实现的持久化存储方案来保存其 `executionId` 对应的详细结果和历史记录。** 相关的 `HistoryService` 仍处于 `TODO` 状态，并且其底层的存储方案（是否使用数据库等）根据当前情况来看是不确定的。
