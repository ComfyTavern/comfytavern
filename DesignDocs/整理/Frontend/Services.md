# 前端服务 (`apps/frontend-vueflow/src/services/`) 文档

## 1. 引言

ComfyTavern 前端应用的服务层（位于 [`apps/frontend-vueflow/src/services/`](apps/frontend-vueflow/src/services/) 目录）封装了与特定功能相关的、可复用的业务逻辑。服务旨在提高代码的模块化、可复用性和可测试性，使得应用结构更清晰。通过将复杂的逻辑抽象到服务中，Vue 组件和 Composable 函数可以保持相对简洁，专注于它们的核心职责。

## 2. 核心服务详解

以下是 ComfyTavern 前端应用中的核心服务介绍。

### 2.1 DialogService

- **文件路径**: [`apps/frontend-vueflow/src/services/DialogService.ts`](apps/frontend-vueflow/src/services/DialogService.ts:1)
- **主要职责**: 提供一个全局的、统一的方式来显示模态对话框（如消息提示、确认框、输入框）和非模态通知（Toasts）。它简化了在应用各处触发这些 UI 元素的逻辑，并管理它们的队列和状态。
- **实现方式**: 结合 Pinia store (`useDialogService`) 进行状态管理。
- **核心 API**:
  - `showMessage(options)`: 显示简单的消息对话框。
  - `showConfirm(options)`: 显示确认对话框，返回一个解析为布尔值的 Promise。
  - `showInput(options)`: 显示带输入框的对话框，返回一个解析为字符串或 null 的 Promise。
  - `showToast(options)` / `showSuccess(message)` / `showError(message)`: 显示各种类型的通知。
- **相关组件**:
  - UI 由 [`Dialog.vue`](apps/frontend-vueflow/src/components/common/Dialog.vue:1) 和 [`ToastNotification.vue`](apps/frontend-vueflow/src/components/common/ToastNotification.vue:1) 渲染。
  - 容器由 [`DialogContainer.vue`](apps/frontend-vueflow/src/components/common/DialogContainer.vue:1) 在应用顶层管理。

### 2.2 SillyTavernService

- **文件路径**: [`apps/frontend-vueflow/src/services/SillyTavernService.ts`](apps/frontend-vueflow/src/services/SillyTavernService.ts:1)
- **主要职责**: 负责处理与 SillyTavern 角色卡相关的功能，主要是从后端加载角色卡数据，并将其转换为前端 UI 显示所需的格式。
- **实现方式**: 单例类。
- **核心 API**:
  - `getCharacterCards()`: 异步加载角色卡数据，如果加载失败则返回一组默认的角色卡。
- **相关组件**:
  - 主要为 [`CharacterCardView.vue`](apps/frontend-vueflow/src/views/home/CharacterCardView.vue:1) 提供数据。

### 2.3 PluginLoaderService

- **文件路径**: [`apps/frontend-vueflow/src/services/PluginLoaderService.ts`](apps/frontend-vueflow/src/services/PluginLoaderService.ts:1)
- **主要职责**: 负责动态加载和卸载插件的前端资源（JavaScript 和 CSS）。
- **核心 API**:
  - `loadPluginAssets(ext: ExtensionInfo)`: 加载单个插件的 JS 和 CSS 文件到 DOM 中。
  - `unloadPluginAssets(pluginName: string)`: 从 DOM 中移除单个插件的资源。
  - `loadAllPlugins()`: 在应用启动时，从后端获取所有已发现的插件列表，并加载其中已启用的插件。
- **使用场景**: 应用初始化时调用 `loadAllPlugins()`，并在插件启用/禁用状态改变时调用相应的方法。

### 2.4 ExtensionApiService

- **文件路径**: [`apps/frontend-vueflow/src/services/ExtensionApiService.ts`](apps/frontend-vueflow/src/services/ExtensionApiService.ts:1)
- **主要职责**: 在主应用初始化时，向 `window.ComfyTavern.extensionApi` 命名空间下附加一个 API 实例。这个 API 实例为外部插件脚本提供了一个安全、稳定的接口，以便它们可以与主应用的核心功能（如注册自定义节点 UI、添加菜单项、监听应用事件等）进行交互。
- **核心 API (暴露给插件)**:
  - `registerNodeUI(nodeType, component)`: 允许插件为特定类型的节点注册自定义的 Vue 渲染组件。
  - `addMenuItem(targetMenu, item)`: 允许插件向指定菜单添加新的菜单项。
  - `on(event, callback)`: 允许插件监听应用内部的事件钩子。
- **使用场景**: 在应用启动时由 `main.ts` 或相关初始化逻辑调用 `initializeExtensionApi()`。

### 2.5 WebSocketCoreService

- **文件路径**: [`apps/frontend-vueflow/src/services/WebSocketCoreService.ts`](apps/frontend-vueflow/src/services/WebSocketCoreService.ts:1)
- **主要职责**: 提供一个底层的、单例的 WebSocket 连接管理服务。它封装了连接、断开、自动重连、发送消息和消息订阅/分发的核心逻辑。
- **实现方式**: 通过 `useWebSocketCore()` Composable 函数提供单例访问。
- **核心 API**:
  - `connect()` / `disconnect()`: 控制连接。
  - `sendMessage(message)`: 发送 JSON 消息。
  - `subscribe(key, handler)`: 注册一个带唯一键的消息处理器，并返回一个取消订阅的函数。
- **使用场景**: 作为应用中所有需要 WebSocket 通信的上层逻辑（如工作流执行状态更新）的基础。

### 2.6 WorkflowInvocationService

- **文件路径**: [`apps/frontend-vueflow/src/services/WorkflowInvocationService.ts`](apps/frontend-vueflow/src/services/WorkflowInvocationService.ts:1)
- **主要职责**: 作为所有工作流调用的统一入口。它负责根据调用请求（`InvocationRequest`）来准备和触发工作流的执行。
- **实现方式**: 通过 `useWorkflowInvocation()` Composable 函数提供功能。
- **核心逻辑**:
  1.  **模式判断**: 区分 `live` 模式（使用编辑器当前实时状态）和 `saved` 模式（使用后端已保存的工作流版本）。
  2.  **数据准备**:
      - 在 `live` 模式下，它会运行节点的客户端脚本 (`onWorkflowExecute`)，然后使用 `flattenWorkflow` 工具将可能包含节点组的工作流扁平化，最后转换为核心工作流格式。
      - 在 `saved` 模式下，它会直接从后端加载已保存的工作流数据。
  3.  **输入注入**: 将调用时提供的 `inputs` 对象注入到工作流中，覆盖对应输入节点的默认值。
  4.  **调用执行**: 调用底层的 `useWorkflowExecution().executeWorkflowCore()` 来发送最终的执行载荷。
- **使用场景**: 被 `ApiAdapterManager` 或其他需要以编程方式触发工作流执行的模块（如编辑器内的“执行”按钮）调用。

### 2.7 ApiAdapterManager

- **文件路径**: [`apps/frontend-vueflow/src/services/ApiAdapterManager.ts`](apps/frontend-vueflow/src/services/ApiAdapterManager.ts:1)
- **主要职责**: 一个纯粹的前端数据准备与转换层，专门用于处理来自应用面板（Panel）的 API 调用。它将面板的简单调用请求，通过“适配器”转换为对复杂工作流的调用。
- **实现方式**: 通过 `useApiAdapterManager()` Composable 函数提供功能。
- **核心逻辑**:
  1.  接收一个 `InvocationRequest`，其中 `mode` 可以是 `native` 或 `adapter`。
  2.  **`native` 模式**: 直接调用 `WorkflowInvocationService`，目标是请求中指定的工作流。
  3.  **`adapter` 模式**:
      - 从 `adapterStore` 获取指定的适配器定义。
      - 使用适配器中定义的 `requestMapping` 规则，将面板传入的 `inputs` 转换为目标工作流所需的输入格式。
      - 调用 `WorkflowInvocationService`，目标是适配器中定义的目标工作流，并使用转换后的输入。
- **核心 API**:
  - `invoke(request)`: 处理调用请求。
  - `testAdapterTransform(adapterId, sampleData)`: 用于离线测试适配器的转换逻辑是否正确。
- **使用场景**: 主要由应用面板的运行时环境调用，作为面板与后端工作流之间的桥梁。

## 3. 服务设计原则

- **单一职责**: 每个服务专注于一个明确的功能领域。
- **封装与抽象**: 服务隐藏其内部复杂的实现细节，仅暴露清晰的 API。
- **可组合性**: 大多服务通过 Composable 函数 (`use...`) 的形式提供，易于在 Vue 组件的 `setup` 上下文中使用和组合。
- **依赖注入**: 服务之间的依赖关系通过在 Composable 内部调用其他服务的 Composable 来解决，或者依赖 Pinia store 来共享状态。
