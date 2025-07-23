# 后端 WebSocket 通信

## 1. WebSocket 通信 (`apps/backend/src/websocket/`) 概览

`apps/backend/src/websocket/` 目录下的模块共同构成了 ComfyTavern 后端 WebSocket 通信的核心。它们负责在服务器与客户端之间建立和管理实时的、双向的通信通道。

### 1.1. 目录/功能职责

该目录主要包含以下文件和职责：

- **[`handler.ts`](../../../../apps/backend/src/websocket/handler.ts:1)**: 定义了 WebSocket 连接的生命周期事件处理器（如连接打开、消息接收、连接关闭、错误处理）。它作为 WebSocket 路由的直接处理逻辑，负责解析客户端消息并将其分发到相应的服务（主要是 [`ConcurrencyScheduler`](../../../../apps/backend/src/services/ConcurrencyScheduler.ts:1)）。
- **[`WebSocketManager.ts`](../../../../apps/backend/src/websocket/WebSocketManager.ts:1)**: 提供了一个中心化的管理器，用于跟踪所有活跃的 WebSocket 连接，分配客户端 ID，并提供向特定客户端或所有客户端广播消息的功能。

### 1.2. 使用目的

在 ComfyTavern 项目中，WebSocket 主要用于以下目的和场景：

- **工作流执行状态的实时更新**：当用户在前端触发工作流执行后，后端会通过 WebSocket 将执行的各个阶段（如节点开始执行、节点完成、执行成功/失败、输出生成等）的状态实时推送给前端。
- **节点执行日志的流式传输**：工作流中节点执行时产生的日志信息，可以通过 WebSocket 流式地发送到前端，供用户实时查看。
- **实时交互反馈**：例如，当用户点击节点上的特定按钮（如中断执行）时，该请求通过 WebSocket 发送到后端进行处理。
- **错误通知**：后端在处理 WebSocket 消息或执行工作流过程中发生的错误，可以通过 WebSocket 实时通知前端。
- **系统状态广播**：当系统级状态发生变化时（例如，通过 API 启用/禁用或重载插件），后端会通过 WebSocket 广播消息 (`plugins-reloaded`, `plugin-enabled`, `plugin-disabled`)，通知所有连接的客户端更新其状态（如重新加载节点列表）。

### 1.3. 技术实现

后端 WebSocket 功能基于 [Elysia](https://elysiajs.com/) 框架，并利用其内置的 WebSocket 支持（通常通过 `@elysiajs/websocket` 插件或核心功能实现，在本项目中是 Bun 内置的 WebSocket 支持与 Elysia 的集成）。Elysia 提供了定义 WebSocket 路由、处理连接生命周期事件以及收发消息的便捷 API。

## 2. 核心组件与逻辑详解

### 2.1. `WebSocketManager.ts` ([`apps/backend/src/websocket/WebSocketManager.ts`](../../../../apps/backend/src/websocket/WebSocketManager.ts:1))

`WebSocketManager` 类是管理所有 WebSocket 连接的核心组件。

#### 2.1.1. 职责

- **管理活跃连接**：维护一个所有已连接客户端的列表。
- **客户端识别与跟踪**：为每个新连接的客户端分配一个唯一的 `clientId` ([`NanoId`](../../../../packages/types/src/common.ts:1))，并使用此 ID 来识别和管理客户端。
- **连接处理**：
  - `addClient(ws)`: 当新客户端连接时，将其添加到管理器中，并分配 `clientId`。
  - `removeClient(ws)`: 当客户端断开连接时，将其从管理器中移除。
  - `handleError(ws, error)`: 处理特定连接发生的错误，并通常会导致移除该客户端。
- **消息广播与发送**：
  - `sendMessageToClient(clientId, type, payload)`: 向具有特定 `clientId` 的客户端发送消息。
  - `broadcast(type, payload)`: 向所有当前连接的客户端广播消息。

#### 2.1.2. 内部实现

- `clients: Map<NanoId, ClientInfo>`: 一个 `Map` 结构，用于存储从 `clientId` 到 `ClientInfo` 对象的映射。`ClientInfo` 包含客户端的 WebSocket 上下文对象 (`ws: WsContext`)。
- `wsToClientId: WeakMap<WsContext, NanoId>`: 一个 `WeakMap` 结构，用于从 WebSocket 上下文对象 (`WsContext`，即 `ServerWebSocket<WsContextData>`) 快速查找到对应的 `clientId`。这在处理 `close` 和 `error` 事件时特别有用，因为这些事件直接提供 `ws` 对象。

### 2.2. WebSocket 事件处理器 (在 [`handler.ts`](../../../../apps/backend/src/websocket/handler.ts:1) 中定义)

[`handler.ts`](../../../../apps/backend/src/websocket/handler.ts:1) 文件中的 `createWebsocketHandler` 函数创建并返回一个包含 WebSocket 事件处理逻辑的对象。这些处理器由 Elysia 的 WebSocket 路由在相应的生命周期事件发生时调用。

#### 2.2.1. 连接建立 (`open`)

- 当一个新的 WebSocket 连接建立时，`open(ws)` 处理器被调用。
- 它首先调用 `wsManager.addClient(ws)` 来注册新的客户端并获取一个唯一的 `clientId`。
- 然后，这个 `clientId` 被存储在 `ws.data.clientId` 中。Elysia 允许通过 `ws.data` 对象为每个 WebSocket 连接附加自定义上下文数据，这使得在后续的 `message`、`close` 和 `error` 事件中可以方便地访问到该连接的 `clientId`。

#### 2.2.2. 消息接收 (`message`)

- 当服务器从客户端接收到一条消息时，`message(ws, message)` 处理器被调用。
- 它首先从 `ws.data.clientId` 中检索出发送该消息的客户端的 `clientId`。
- **消息格式**：期望接收到的消息是遵循 [`WebSocketMessage`](../../../../packages/types/src/execution.ts:1) 接口的 JSON 对象，该对象必须包含：
  - `type`: 一个表示消息类型的字符串，其值应为 [`WebSocketMessageType`](../../../../packages/types/src/execution.ts:1) 枚举中定义的值之一。
  - `payload`: 一个任意类型的对象，其具体结构取决于 `type`。
- **消息处理逻辑**：处理器使用 `switch` 语句根据 `message.type` 来执行不同的操作：
  - **`WebSocketMessageType.PROMPT_REQUEST`**:
    - `payload` 被断言为 [`WorkflowExecutionPayload`](../../../../packages/types/src/execution.ts:1)。
    - 该请求（包含工作流定义、输入等）通过 `scheduler.submitExecution(payload, 'websocket', clientId)` 提交给 [`ConcurrencyScheduler`](../../../../apps/backend/src/services/ConcurrencyScheduler.ts:1) 进行异步处理。
  - **`WebSocketMessageType.INTERRUPT_REQUEST`**:
    - `payload` 包含一个 `promptId` ([`NanoId`](../../../../packages/types/src/common.ts:1))。
    - 调用 `scheduler.interruptExecution(payload.promptId)` 来尝试中断指定 `promptId` 的工作流执行。
  - **`WebSocketMessageType.BUTTON_CLICK`**:
    - `payload` 被断言为 [`ButtonClickPayload`](../../../../packages/types/src/execution.ts:1)。
    - 当前主要记录日志，表明收到了按钮点击事件，并包含节点 ID、按钮名称等上下文信息。未来的实现可以在此处理由节点上按钮触发的后端逻辑。
  - **`default` (未知消息类型)**:
    - 如果收到未知的消息类型，服务器会向客户端发送一个类型为 `WebSocketMessageType.ERROR` 的消息，告知客户端消息类型未知。
- **错误处理**：如果在处理消息的过程中发生任何错误，会捕获该错误，记录到服务器控制台，并向客户端发送一个包含错误信息的 `WebSocketMessageType.ERROR` 消息。

#### 2.2.3. 连接关闭 (`close`)

- 当一个 WebSocket 连接关闭时（无论由客户端还是服务器发起，或由于网络问题），`close(ws, code, reason)` 处理器被调用。
- 它从 `ws.data.clientId` 获取 `clientId`。
- 调用 `wsManager.removeClient(ws)` 来从管理器中移除该客户端的记录。

#### 2.2.4. 错误处理 (`error`)

- 当 WebSocket 通信过程中发生错误时，`error(context)` 处理器被调用，其中 `context` 包含 `ws` (WebSocket 上下文) 和 `error` (错误对象)。
- 它从 `context.ws.data.clientId` 获取 `clientId`。
- 调用 `wsManager.handleError(context.ws, context.error)`，这通常会记录错误并从管理器中移除该客户端。

## 3. 主要通信场景与消息协议

### 3.1. 主要场景

如前所述，WebSocket 主要用于：

1.  **工作流执行请求与状态更新**：客户端通过发送 `PROMPT_REQUEST` 启动工作流，服务器通过一系列特定类型的消息（如 `EXECUTION_UPDATE`, `NODE_OUTPUT`, `EXECUTION_COMPLETE`, `EXECUTION_ERROR` - 这些具体类型由 `ConcurrencyScheduler` 和 `ExecutionEngine` 定义并发送）反馈执行进度和结果。
2.  **日志流**：服务器通过如 `LOG_MESSAGE` 类型的消息将执行日志实时发送给客户端。
3.  **中断请求**：客户端发送 `INTERRUPT_REQUEST` 来请求停止正在进行的工作流。
4.  **节点交互**：客户端发送 `BUTTON_CLICK` 等消息与工作流中的节点进行交互。

### 3.2. 消息格式/协议

所有客户端与服务器之间的 WebSocket 消息都应为 JSON 对象，并遵循以下基本结构：

```typescript
interface WebSocketMessage<T> {
  type: WebSocketMessageType; // 来自 @comfytavern/types
  payload: T;
}
```

#### 3.2.1. 客户端发送给服务器的关键消息类型：

- **`WebSocketMessageType.PROMPT_REQUEST`**:
  - `payload`: [`WorkflowExecutionPayload`](../../../../packages/types/src/execution.ts:1)
  - 描述：客户端请求执行一个工作流。`payload` 包含工作流的完整定义或引用、输入数据、以及可能的执行配置。
- **`WebSocketMessageType.INTERRUPT_REQUEST`**:
  - `payload`: `{ promptId: NanoId }`
  - 描述：客户端请求中断一个特定 `promptId` 对应的工作流执行。
- **`WebSocketMessageType.BUTTON_CLICK`**:
  - `payload`: [`ButtonClickPayload`](../../../../packages/types/src/execution.ts:1)
  - 描述：客户端通知服务器，用户点击了某个节点上的一个按钮。`payload` 包含节点 ID、按钮名称、工作流 ID 等上下文信息。

#### 3.2.2. 服务器发送给客户端的关键消息类型（示例）：

这些消息通常由 [`WebSocketManager`](../../../../apps/backend/src/websocket/WebSocketManager.ts:1) 的 `sendMessageToClient` 或 `broadcast` 方法发送，具体类型和载荷由调用方（如 [`ConcurrencyScheduler`](../../../../apps/backend/src/services/ConcurrencyScheduler.ts:1) 或 [`ExecutionEngine`](../../../../apps/backend/src/ExecutionEngine.ts:1)）决定。

- **`WebSocketMessageType.PROMPT_ACCEPTED_RESPONSE`**:
  - `payload`: `{ promptId: NanoId, clientId: NanoId, ... }` (具体结构参考 [`PromptAcceptedResponsePayload`](../../../../packages/types/src/execution.ts:1))
  - 描述：服务器确认已接受客户端的 `PROMPT_REQUEST`，并返回一个 `promptId` 用于后续跟踪。
- **`WebSocketMessageType.EXECUTION_UPDATE`**:
  - `payload`: 包含执行状态、当前节点、进度等信息。 (具体结构参考 [`ExecutionUpdatePayload`](../../../../packages/types/src/execution.ts:1))
  - 描述：服务器推送工作流执行的实时状态更新。
- **`WebSocketMessageType.NODE_OUTPUT`**:
  - `payload`: 包含节点 ID、输出槽名称、输出数据等。 (具体结构参考 [`NodeOutputPayload`](../../../../packages/types/src/execution.ts:1))
  - 描述：服务器推送特定节点的执行输出。
- **`WebSocketMessageType.LOG_MESSAGE`**:
  - `payload`: 包含日志级别、消息内容、时间戳等。 (具体结构参考 [`LogMessagePayload`](../../../../packages/types/src/execution.ts:1))
  - 描述：服务器推送工作流执行过程中产生的日志。
- **`WebSocketMessageType.EXECUTION_COMPLETE`**:
  - `payload`: 包含 `promptId` 和最终的输出或状态。 (具体结构参考 [`ExecutionCompletePayload`](../../../../packages/types/src/execution.ts:1))
  - 描述：通知客户端工作流执行已成功完成。
- **`WebSocketMessageType.EXECUTION_INTERRUPTED`**:
  - `payload`: 包含 `promptId`。 (具体结构参考 [`ExecutionInterruptedPayload`](../../../../packages/types/src/execution.ts:1))
  - 描述：通知客户端工作流已被成功中断。
- **`WebSocketMessageType.ERROR`**:
  - `payload`: [`ErrorPayload`](../../../../packages/types/src/execution.ts:1) (通常包含 `message: string` 和可选的 `details`)
  - 描述：服务器通知客户端在处理请求或执行过程中发生了错误。

### 3.3. 数据流向

1.  **客户端 -> 服务器**：用户在前端进行操作（如点击“执行工作流”按钮、点击节点上的按钮）-> 前端构建相应类型的 `WebSocketMessage` -> 通过 WebSocket 连接发送给服务器 -> 服务器的 [`handler.ts`](../../../../apps/backend/src/websocket/handler.ts:1) 中的 `message` 处理器接收并处理。
2.  **服务器 -> 客户端**：
    - 后端服务（如 [`ExecutionEngine`](../../../../apps/backend/src/ExecutionEngine.ts:1) 在执行工作流时，或 [`LoggingService`](../../../../apps/backend/src/services/LoggingService.ts:1) 记录日志时）产生需要通知客户端的数据。
    - 这些服务通过调用 [`WebSocketManager`](../../../../apps/backend/src/websocket/WebSocketManager.ts:1) 的 `sendMessageToClient` (针对特定客户端) 或 `broadcast` (针对所有客户端) 方法。
    - [`WebSocketManager`](../../../../apps/backend/src/websocket/WebSocketManager.ts:1) 将数据封装成 `WebSocketMessage` (指定 `type` 和 `payload`) -> 通过对应的 WebSocket 连接发送给客户端 -> 前端接收消息并更新 UI。

## 4. 与后端其他部分的集成

WebSocket 系统并非孤立存在，它与后端的多个核心服务紧密集成，以实现实时数据推送。

- **[`ConcurrencyScheduler.ts`](../../../../apps/backend/src/services/ConcurrencyScheduler.ts:1)**:

  - WebSocket 的 `message` 处理器（在 [`handler.ts`](../../../../apps/backend/src/websocket/handler.ts:1)）直接依赖于 `ConcurrencyScheduler`。
  - 当收到 `PROMPT_REQUEST` 时，`handler` 将请求委托给 `scheduler.submitExecution()`。
  - 当收到 `INTERRUPT_REQUEST` 时，`handler` 调用 `scheduler.interruptExecution()`。
  - `ConcurrencyScheduler` 在其内部处理工作流的排队、并发控制，并与 [`ExecutionEngine`](../../../../apps/backend/src/ExecutionEngine.ts:1) 交互。在执行的不同阶段，`ConcurrencyScheduler` 会负责调用 `WebSocketManager` 的方法（如 `sendMessageToClient`）来向客户端发送状态更新、结果或错误信息（例如，发送 `PROMPT_ACCEPTED_RESPONSE`）。

- **[`ExecutionEngine.ts`](../../../../apps/backend/src/ExecutionEngine.ts:1)**:

  - `ExecutionEngine` 负责实际执行工作流中的节点。
  - 在节点执行过程中，当产生输出、日志或状态变更时，`ExecutionEngine`（或其调用的节点本身）需要将这些信息传递出去。这通常是通过事件、回调机制，或者直接（或间接通过 `ConcurrencyScheduler`）调用 `WebSocketManager` 的方法来实现的，以便将 `EXECUTION_UPDATE`、`NODE_OUTPUT`、`LOG_MESSAGE` 等消息推送给相关的客户端。

- **[`LoggingService.ts`](../../../../apps/backend/src/services/LoggingService.ts:1)** (假设存在或其功能集成在其他服务中):
  - 如果有一个专门的日志服务，它在收集到与工作流执行相关的日志时，可能会调用 `WebSocketManager.broadcast` 或 `sendMessageToClient` 将这些日志条目（封装为 `LOG_MESSAGE` 类型）发送给前端。

总的来说，WebSocket 系统作为后端与前端之间的实时通信桥梁，使得后端的核心业务逻辑（如工作流执行）能够将其动态变化的数据和状态及时地反映到用户界面上。[`WebSocketManager`](../../../../apps/backend/src/websocket/WebSocketManager.ts:1) 提供了发送这些消息的接口，而其他服务（如 `ConcurrencyScheduler` 和 `ExecutionEngine`）则是这些消息内容的生产者。
