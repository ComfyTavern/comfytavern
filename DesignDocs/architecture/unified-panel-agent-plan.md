# 统一应用面板与 Agent 实施计划

## 1. 引言与目标

本计划旨在为 ComfyTavern 平台实现其核心愿景——将复杂的工作流封装到可交互、可自定义的应用面板（Panel）中——提供一个清晰、分阶段的实施路线图。

该计划基于以下核心架构原则：

*   **异步事件驱动**: Agent 与应用面板之间的交互，通过一个场景（Scene）范围内的事件总线（EventBus）进行，实现真正的异步、非阻塞通信。
*   **Agent 作为核心**: 后端存在一个长期运行的、有状态的 Agent 运行时（AgentRuntime），负责驱动 Agent 的“感知-思考-行动”循环。
*   **同构工具复用**: 充分利用 `@comfytavern/utils` 中已经完成的、前后端共享的工作流准备工具（如扁平化、转换），来处理复杂工作流。
*   **后端原子化执行**: 后端工作流引擎（ExecutionEngine）始终负责执行完整的、无中断的工作流片段（如 Agent 的审议流或技能流），不直接参与交互流程的中断与恢复。

---

## 2. 实施阶段

### 阶段 0: 后端核心服务 (基础)

**目标**: 搭建支持异步 Agent 运行的基础设施。

*   **任务 1: 实现/完善 `WorldStateService`**
    *   **描述**: 提供一个场景范围内的、可进行原子性读写的共享状态存储服务。这是 Agent 感知环境的基础。
    *   **关键产出**:
        *   一个可以在后端被调用的服务，能够为不同的场景实例（`scene_instance_id`）创建、读取、更新和删除独立的 `WorldState` JSON 对象。
        *   需要考虑并发控制，确保更新的原子性。

*   **任务 2: 扩展 `WebSocketManager` 以支持场景隔离的 `EventBus`**
    *   **描述**: 确保每个场景实例都有自己独立的事件通道，用于 Agent 间的通信和 Agent 与环境的交互。
    *   **关键产出**:
        *   `WebSocketManager` 能够管理多个逻辑上的事件通道，每个通道与一个 `scene_instance_id` 关联。
        *   实现 `subscribe` 和 `publish` 方法，允许后端服务（如 `AgentRuntime`）向特定场景通道发布事件或从中订阅事件。
        *   前端客户端连接时，能够声明其希望监听的场景通道。

---

### 阶段 1: 后端集成与 Agent 运行时

**目标**: 让 Agent 能够在后端利用现有工具运行起来，并能处理复杂工作流。

*   **任务 1: 在后端实现 `workflowLoader` 和节点定义加载**
    *   **描述**: 根据 `refactor-workflow-utils-plan.md` 中规划的第三阶段，在后端实现 `WorkflowLoader` 接口，使其能从数据库或文件系统加载工作流定义。同时，也需要加载所有 `NodeDefinition`。
    *   **关键产出**:
        *   一个 `workflowLoader` 函数，能够根据 `workflowId` 异步返回 `WorkflowStorageObject`。
        *   一个服务或单例，持有所有已注册的 `NodeDefinition` 的 `Map<string, NodeDefinition>`。
        *   这些产出将作为依赖，注入到后续的服务中。

*   **任务 2: 实现 `SceneManager` 和 `AgentRuntime` 核心**
    *   **描述**: `AgentRuntime` 作为核心协调器，在其“思考”阶段决定需要执行某个工作流（如技能或审议流）时，它会触发内部的**工作流准备模块**。该模块负责调用共享包 `@comfytavern/utils` 中提供的 `flattenStorageWorkflow` 和 `transformStorageToExecutionPayload` 函数，将存储格式的工作流安全、一致地转换为可被 `ExecutionEngine` 执行的最终 `WorkflowExecutionPayload`。
    *   **关键产出**:
        *   `SceneManager`: 负责根据场景定义，创建、管理和销毁 `AgentRuntime` 实例。
        *   `AgentRuntime`:
            *   能够加载 `agent_profile.json` 并据此进行初始化。
            *   能根据 `subscribed_event_types` 向场景的 `EventBus` 订阅事件。
            *   在收到事件或定时触发时，执行其核心的“感知-思考-行动”循环。
            *   在“行动”阶段，能够**委托工作流准备模块**生成执行负载，并请求 `ExecutionEngine` 执行工作流。
            *   能够解析工作流的执行结果，并执行如“发布事件”到 `EventBus` 等后续指令。

*   **任务 3: 实现核心原子工具**
    *   **描述**: 实现 Agent 工作流中最基础的与环境交互的节点，如 `PublishEventTool`, `ReadWorldStateTool`, `UpdateWorldStateTool` 等。
    *   **关键产出**: 后端节点，这些节点在执行时会调用 `EventBus` 和 `WorldStateService` 提供的服务。

---

### 阶段 2: 前端通信与事件驱动 UI

**目标**: 让前端面板能够作为 Agent 的“感官”和“喉舌”，能与后端进行异步通信。

*   **任务 1: 创建 `PanelContainer.vue` 和 `panelApi`**
    *   **描述**: 创建一个 Vue 组件，该组件能接收 `PanelDefinition` 对象，并据此渲染一个 `<iframe>` 来安全地加载面板的 `uiEntryPoint`。同时，设计并实现向 `<iframe>` 注入 `window.comfyTavernPanelApi` 对象的机制。
    *   **关键产出**: 一个可以展示任何静态 HTML 页面的面板容器组件。

*   **任务 2: 实现 `panelApi` 的事件订阅与发布功能**
    *   **描述**: 重点实现 `panelApi` 的两个核心方法：
        1.  `panelApi.subscribe(eventType, callback)`: 允许面板注册一个回调函数来监听从后端（通过 WebSocket）转发来的特定类型的事件。
        2.  `panelApi.publish(eventType, payload)`: 允许面板将用户的操作封装成事件，通过 WebSocket 发送给后端。
    *   **关键产出**: 一套完整的前后端事件通信链路。

---

### 阶段 3: 端到端交互闭环

**目标**: 完成一个完整的、由 Agent 发起的、通过事件驱动的异步交互流程，以验证整个架构。

*   **任务 1: 创建一个示例 Agent 和面板**
    *   **Agent (后端)**:
        *   定义一个简单的 Agent Profile，其核心审议流逻辑如下：
            1.  检查其 `PrivateState` 中的 `hasGreeted` 标志。
            2.  如果为 `false`，则调用 `PublishEventTool` 发布一个 `{type: 'request_user_name'}` 事件，并将 `hasGreeted` 设为 `true`。
            3.  Agent 订阅 `user_name_response` 事件。
            4.  当收到此事件时，其审议流被再次触发，获取事件中的用户名，并发布一个 `{type: 'show_greeting', message: 'Hello, [username]'}` 事件。
    *   **面板 (前端)**:
        *   定义一个简单的面板，其 `uiEntryPoint` 是一个包含基本 JS 逻辑的 HTML 文件。
        *   JS 逻辑：
            1.  调用 `panelApi.subscribe('request_user_name', ...)`，回调函数用于在页面上动态创建一个输入框和一个提交按钮。
            2.  当用户点击提交按钮时，调用 `panelApi.publish('user_name_response', { name: ... })`。
            3.  调用 `panelApi.subscribe('show_greeting', ...)`，回调函数用于在页面上显示最终的问候语。

*   **任务 2: 端到端调试与验证**
    *   **描述**: 运行整个流程，确保 Agent 和面板能够通过定义的事件流正确地协同工作，完成从请求到响应的完整交互。
    *   **关键产出**: 一个可工作的、文档化的异步交互示例，作为未来更复杂应用的基石。

---

## 3. 后续展望

在完成上述核心实施计划后，可以继续推进以下优化和增强功能：

*   **标准化交互模板**: 设计并实现如“问答”、“确认”、“多选一”等标准交互的事件和面板 UI 模板，简化开发。
*   **`ApiAdapterManager`**: 作为可选的便捷层，实现 `ApiAdapterManager`，用于将面板的数据格式（如 OpenAI API 格式）转换为内部工作流所需的输入，但不参与流程控制。
*   **图形化编辑器**: 为 Agent Profile、场景定义、面板定义等提供图形化的管理界面。
*   **开发者文档与教程**: 撰写详细的文档，指导社区开发者如何创建自己的 Agent 和应用面板。