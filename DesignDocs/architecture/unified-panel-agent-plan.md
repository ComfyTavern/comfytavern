# Agent 架构 v3 - MVP 实施计划

## 1. 引言与目标

**基准架构**: 本实施计划完全基于 [`DesignDocs/architecture/agent_architecture_v3_consolidated.md`](DesignDocs/architecture/agent_architecture_v3_consolidated.md:1) 中定义的统一 Agent 架构。该文档是我们的最终目标和“真理之源”。

**当前起点**: 现有代码库已经实现了部分基础服务，包括一个请求驱动的 `ExecutionEngine`、支持场景隔离的 `WebSocketManager` 和 `WorldStateService`。这些被视为实现 v3 架构的“阶段0”已完成。

**本计划目标**: 定义一个清晰、分阶段的路线图，用于构建 v3 Agent 架构的**最小可行产品 (MVP)**。我们将从现有代码出发，逐步实现 `SceneManager`、`AgentRuntime`、以及与之配套的前端应用面板。
**设计对齐**: 本计划中关于应用面板的实现，将作为 [`DesignDocs/architecture/面板与接口/application-panel-integration-plan.md`](DesignDocs/architecture/面板与接口/application-panel-integration-plan.md:1) 中定义的、更宏大的面板集成方案的**首个 MVP 实例**。我们将遵循其核心原则（如 `iframe` 沙盒、`postMessage` 通信），但实现一个最小化的、以事件为中心的 API 子集，以达成一个可工作的、端到端的自主 Agent 交互闭环。

---

## 2. 实施阶段

### 阶段 0: 基础服务确认 (已完成)

*   **确认项**:
    *   后端 `ExecutionEngine` 可执行工作流。
    *   后端 `WorldStateService` 可管理场景状态。
    *   后端 `WebSocketManager` 支持按场景隔离的事件发布/订阅。
    *   前端 `executionStore` 可响应后端的执行状态更新。

### 阶段 1: 核心运行时骨架 (后端)

**目标**: 搭建 v3 架构的核心后端组件：`SceneManager` 和 `AgentRuntime` 的基础骨架。

*   **任务 1.1: 定义核心 Schema**
    *   **描述**: 在 `packages/types` 中，根据 v3 架构文档，正式创建 `AgentProfile` 和 `SceneDefinition` 的 Zod Schema。
    *   **关键产出**: `packages/types/src/schemas.ts` 中新增 `AgentProfileSchema` 和 `SceneDefinitionSchema`。

*   **任务 1.2: 实现 `SceneManager` 服务**
    *   **描述**: 创建 `SceneManager` 服务，负责管理场景实例的生命周期。
    *   **MVP 功能**:
        *   `createScene(sceneDefinition)`: 根据场景定义，创建场景实例。此过程会初始化 `WorldState`，并为场景中定义的每个 Agent 调用 `AgentRuntime` 的创建流程。
        *   `destroyScene(sceneInstanceId)`: 销毁场景实例和其下的所有 Agent。
        *   (此阶段暂不实现复杂的事件到工作流的路由，重点是生命周期管理)
    *   **关键产出**: `apps/backend/src/services/SceneManager.ts` 文件和 `SceneManager` 类的基础实现。

*   **任务 1.3: 实现 `AgentRuntime` 服务骨架**
    *   **描述**: 创建 `AgentRuntime` 服务，负责驱动单个 Agent 实例。
    *   **MVP 功能**:
        *   **构造函数**: 接收 `agentProfile` 和场景上下文（`WorldState` 访问器、`EventBus` 发布/订阅器）。加载 Profile 并初始化 `PrivateState`。
        *   **`start()` 方法**: 启动 Agent 的审议循环。在 MVP 阶段，这个循环可以是一个简单的定时器 (e.g., `setInterval`)。
        *   **审议循环 (`tick()`)**: 在每次循环中：
            1.  **准备上下文**: 收集 `WorldState`, `PrivateState` 等信息。
            2.  **请求执行**: 将上下文和 `core_deliberation_workflow_id` 提交给 `ExecutionEngine` 执行。
            3.  **(暂不处理)** 此时暂不复杂处理工作流的返回结果。
    *   **关键产出**: `apps/backend/src/services/AgentRuntime.ts` 文件和 `AgentRuntime` 类的基础实现。

### 阶段 2: 前端面板集成 (对齐 `panel-api` 规范)

**目标**: 遵循 [`panel-spec-and-lifecycle.md`](./面板与接口/panel-spec-and-lifecycle.md:1) 和 [`panel-api-specification.md`](./面板与接口/panel-api-specification.md:1) 的核心原则，搭建前端应用面板的承载容器，并实现一个服务于 Agent 交互的 `panelApi` MVP。

*   **任务 2.1: 实现 `PanelContainer.vue` 组件**
    *   **描述**: 创建一个 Vue 组件，该组件能接收 `PanelDefinition` (依据 [`panel-spec-and-lifecycle.md`](./面板与接口/panel-spec-and-lifecycle.md:1))，并据此渲染一个安全的 `<iframe>` 沙盒来加载面板的 `uiEntryPoint`。
    *   **安全要求**: 必须实施 `sandbox` 属性，初始阶段可限制所有权限，按需开启。
    *   **关键产出**: `apps/frontend-vueflow/src/components/panel/PanelContainer.vue`。

*   **任务 2.2: 实现 MVP 版 `panelApi` 并建立通信**
    *   **描述**: 实现一个 MVP 版本的 `panelApi`，作为 [`panel-api-specification.md`](./面板与接口/panel-api-specification.md:1) 中定义接口的子集。此阶段，API 核心是**事件总线**，而非完整的工作流执行。
    *   **API 设计 (注入到 `window.comfyTavern.panelApi`)**:
        ```typescript
        interface PanelApiMvp {
          events: {
            // 订阅来自 Host (由 Agent 发起) 的事件
            subscribe: (callback: (event: { type: string; payload: any; }) => void) => () => void; // 返回取消订阅函数
            // 向 Host (最终转发给 Agent) 发布事件
            publish: (event: { type: string; payload: any; }) => void;
          }
        }
        ```
    *   **通信流程**:
        1.  **Host -> Panel**: `PanelContainer` 监听后端 WebSocket 事件，通过 `iframe.contentWindow.postMessage` 转发给 `<iframe>`。`panelApi` 内部的 `subscribe` 回调函数负责接收这些消息。
        2.  **Panel -> Host**: `panelApi` 的 `publish` 方法调用 `parent.postMessage` 将事件发送到 `PanelContainer`。`PanelContainer` 再通过 WebSocket 发送到后端对应的场景实例。
    *   **关键产出**:
        *   `apps/frontend-vueflow/src/services/panelApiService.ts` (封装 `panelApi` 的注入和 `postMessage` 通信逻辑)。
        *   `PanelContainer.vue` 中实现与 `<iframe>` 的双向安全通信。
        *   `apps/frontend-vueflow/src/views/` 下可以创建一个简单的页面来测试 `PanelContainer.vue`。

### 阶段 3: 端到端交互闭环 MVP

**目标**: 打通从 Agent 主动发布事件到前端面板响应并回传事件的完整异步交互流程。

*   **任务 3.1: 实现核心原子工具节点**
    *   **描述**: 在后端实现 Agent 与环境交互所需的最核心的工具节点。
    *   **关键产出**:
        *   `scene:PublishEvent`: 在 `execute` 方法中，调用从 `context` 传入的场景 `EventBus` 的 `publish` 方法。
        *   `agent:UpdatePrivateState`: 在 `execute` 方法中，调用从 `context` 传入的 `AgentRuntime` 的方法来更新 `PrivateState`。

*   **任务 3.2: 创建示例 Agent 和面板 (MVP 版)**
    *   **Agent (后端)**:
        *   创建一个简单的 `agent_profile.json`。
        *   其 `core_deliberation_workflow` 审议流逻辑简化为：
            1.  检查 `PrivateState` 中的 `hasGreeted` 标志。
            2.  如果为 `false`，则调用 `scene:PublishEvent` 发布 `{type: 'request_user_name'}` 事件，然后调用 `agent:UpdatePrivateState` 将 `hasGreeted` 设为 `true`。
        *   在 `scene.json` 中配置此 Agent。
    *   **面板 (前端)**:
        *   创建一个简单的 `hello_panel.html` 文件。
        *   JS 逻辑:
            1.  调用 `window.comfyTavern.panelApi.events.subscribe(event => { ... })`。在回调中，检查 `event.type`。
            2.  如果 `event.type === 'request_user_name'`，则在页面上动态创建输入框和按钮。
            3.  用户点击按钮时，调用 `window.comfyTavern.panelApi.events.publish({ type: 'user_name_response', payload: { name: ... } })`。

*   **任务 3.3: 扩展 `SceneManager` 以处理入站事件**
    *   **描述**: `SceneManager` 需要能处理从 WebSocket 传来的、由面板发布的事件。
    *   **MVP 功能**:
        *   实现一个方法 `handlePanelEvent(sceneInstanceId, event)`。
        *   当此方法被调用时，它将该事件作为输入，触发关联 Agent 的一次**额外**的审议循环，而不是通过一个固定的事件->工作流映射。这简化了 MVP 实现，将事件处理逻辑保留在 Agent 的核心审议流中。
    *   **关键产出**: `SceneManager` 和 `websocket/handler.ts` 的功能增强。

*   **任务 3.4: 端到端调试**
    *   **描述**: 启动一个包含示例 Agent 和面板的场景。验证 Agent 的 `request_user_name` 事件能被面板接收并渲染出 UI，面板回传的 `user_name_response` 事件能被后端接收并触发 Agent 的下一次审议。
    *   **关键产出**: 一个可工作的、文档化的异步交互示例，作为 v3 架构 MVP 的成功标志。

---

## 4. 后续展望 (MVP之后)

在完成 MVP 后，我们将按照 v3 架构文档的指引，继续完善和增强系统：

*   **丰富 Agent 能力**: 实现更多原子工具 (`ReadWorldState`, `WriteToKnowledgeBase` 等) 和学习反思机制。
*   **完善 `SceneManager`**: 实现更复杂的事件到工作流的路由、场景生命周期工作流等。
*   **增强面板功能**: 逐步完整实现 [`panel-api-specification.md`](./面板与接口/panel-api-specification.md:1) 中定义的 `panelApi`，包括 `executeWorkflow`、`getWorkflowInterface` 等高级功能，并提供标准化的交互模板。
*   **可视化与调试**: 为 Agent 的 `PrivateState` 和审议过程提供可视化调试工具。