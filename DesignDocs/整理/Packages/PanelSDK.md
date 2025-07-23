# @comfytavern/panel-sdk 包文档

## 1. 包概述

`@comfytavern/panel-sdk` 包是 ComfyTavern 项目中新增的一个核心共享模块，其源代码位于 [`packages/panel-sdk/src/`](../../../../packages/panel-sdk/src/) 目录下。它的主要职责是提供一套专门的 JavaScript / TypeScript SDK，用于 ComfyTavern 的**应用面板（Application Panel）**与宿主环境（Host Environment）之间进行通信和交互。

应用面板通常以 IFrame 的形式嵌入在 ComfyTavern 宿主应用中，SDK 抽象了底层的 `postMessage` 机制，提供了一套简洁、类型安全的 API，使面板能够：

- 调用宿主提供的服务（如工作流执行、文件操作）。
- 订阅宿主环境的事件（如主题变更、工作流执行结果）。
- 将面板内部的日志转发到宿主环境进行统一管理。

通过这个 SDK，面板开发者可以专注于面板的 UI 和业务逻辑，而无需关心复杂的跨域通信细节。

## 2. 关键文件和结构

### 2.1. `index.ts` - SDK 入口与初始化

[`packages/panel-sdk/src/index.ts`](../../../../packages/panel-sdk/src/index.ts:1) 是 `@comfytavern/panel-sdk` 的主要入口文件。它包含了 SDK 的初始化逻辑，建立面板与宿主之间的通信桥梁，并暴露 `panelApi` 对象供面板应用使用。

**核心功能：**

- **`initializePanelApi()`**: 负责 SDK 的初始化，确保单例模式，避免重复初始化。
- **`window.addEventListener('message', ...)`**: 监听来自宿主环境的消息，处理 API 响应、执行事件和主题更新等。
- **`panelApi` (Proxy 对象)**: SDK 的核心，通过 Proxy 机制动态处理对宿主 API 的调用，将方法调用转换为 `postMessage` 请求，并管理 Promise 的解析。
- **事件订阅**: 提供了 `subscribeToExecutionEvents` 和 `log` 等特殊方法，用于处理事件监听和日志转发。
- **`panel-sdk-ready` 消息**: 在 SDK 初始化完成后，会向宿主发送 `panel-sdk-ready` 消息，通知宿主面板已准备就绪。

### 2.2. `types.ts` - API 接口定义

[`packages/panel-sdk/src/types.ts`](../../../../packages/panel-sdk/src/types.ts:1) 定义了 `panelApi` 对象的接口 `ComfyTavernPanelApi`，以及在面板与宿主之间通信时使用的各种数据结构和回调类型。它从 `@comfytavern/types` 包中导入了许多基础类型，保证了类型的一致性。

**关键类型和接口：**

- **`WorkflowInterface`**: 描述工作流或适配器的公共接口，包括输入和输出插槽定义。
- **`PanelExecutionCallbacks`**: 定义了工作流执行过程中回调函数的接口，如 `onProgress`, `onResult`, `onError`。
- **`TextInputRequest`, `OptionSelectionRequest`**: 定义了宿主向面板请求用户交互（如文本输入、选项选择）的数据结构。
- **`PanelInteractionProvider`**: 面板端用于实现宿主交互请求的回调接口。
- **`ThemeInfo`**: 包含当前主题的模式（亮/暗）和 CSS 变量信息。
- **`ComfyTavernPanelApi`**: SDK 暴露给面板应用的主要 API 接口，包含了以下核心方法：
  - **`invoke(request: InvocationRequest): Promise<InvocationResponse>`**: 调用工作流或适配器。
  - **`getInterface(target: { type: 'adapter' | 'workflow', id: string }): Promise<WorkflowInterface>`**: 获取指定工作流或适配器的接口定义。
  - **`subscribeToExecutionEvents(executionId: string, callbacks: PanelExecutionCallbacks): () => void`**: 订阅指定工作流执行的事件，并返回一个取消订阅函数。
  - **`subscribeToInteractionRequests(uiProvider: PanelInteractionProvider): () => void`**: 订阅宿主发来的用户交互请求，面板需提供相应的 UI 处理方法。
  - **`publishEvent(eventType: string, payload: any): Promise<void>`**: 向宿主发布自定义事件。
  - **`getCurrentTheme(): Promise<ThemeInfo>`**: 获取当前应用主题信息。
  - **`requestHostService<T = any>(serviceName: string, args?: any): Promise<T>`**: 请求宿主提供的通用服务。
  - **文件操作 API**: `listFiles`, `readFile`, `writeFile`, `deleteFile`, `createDirectory`，允许面板访问和管理宿主的文件系统（在权限范围内）。
  - **`log(level: 'log' | 'warn' | 'error' | 'debug', ...args: any[]): void`**: 将日志消息转发到宿主环境的控制台。

## 3. 使用场景

`@comfytavern/panel-sdk` 主要用于以下场景：

- **构建 ComfyTavern 应用面板**: 开发者在创建新的应用面板时，可以直接引入并使用此 SDK，简化与宿主环境的集成。
- **调用后端工作流**: 面板可以通过 `panelApi.invoke()` 轻松触发后端工作流或适配器的执行，并将结果显示在面板中。
- **文件管理界面**: 如果面板需要提供文件上传、下载、浏览等功能，可以直接使用 SDK 提供的文件操作 API。
- **实时交互**: 通过订阅执行事件，面板可以实时显示工作流的进度、输出和错误信息。
- **用户输入**: 当宿主环境需要面板提供用户输入（例如，工作流节点需要一个动态文本输入或选项选择）时，SDK 提供的交互请求机制允许面板提供相应的 UI。

## 4. 维护和扩展

- **接口稳定性**: `ComfyTavernPanelApi` 接口应保持相对稳定，任何破坏性变更都需要谨慎处理并提供清晰的迁移指南。
- **类型定义**: 新增的 API 方法和数据结构应及时在 `types.ts` 中进行定义，并从 `@comfytavern/types` 中复用已有类型。
- **安全性**: 由于涉及到跨域通信，SDK 在内部实现了必要的安全机制，但面板开发者仍需注意数据传递的安全性，避免敏感信息泄露。
- **错误处理**: SDK 提供了 Promise 机制，开发者应充分利用 `try-catch` 或 `.catch()` 处理 API 调用可能出现的错误。
