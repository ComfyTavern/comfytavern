# 设计文档：通过 Tauri 扩展实现原生能力集成

## 1. 引言与目标

本设计文档提出一个将 Tauri 作为“第一方原生扩展应用”的架构方案，旨在为 ComfyTavern 平台无缝地、安全地集成操作系统原生能力（如全局快捷键、系统通知、悬浮窗、剪贴板访问等），同时最大限度地保留核心 Web 应用的灵活性和浏览器生态的优势。

此方案并非将整个前端应用打包进 Tauri，而是将 Tauri 视为一个独立的、与主应用并行的 **“助手应用”** 或 **“原生服务提供者”**。

**核心目标**：

-   **能力扩展**：赋予平台浏览器本身无法实现的原生系统交互能力。
-   **架构解耦**：避免原生逻辑与核心业务逻辑的紧密耦合，主应用依然可以在任何标准浏览器中独立运行。
-   **遵循现有规范**：将 Tauri 提供的原生能力，无缝整合进现有的 `ApiAdapterManager` 和 `panelApi` 体系中，特别是利用 [`frontend-api-manager-and-integration.md`](./面板与接口/frontend-api-manager-and-integration.md) 中定义的 `requestHostService` 和**非阻塞、多轮次的交互式执行流**机制。
-   **提升用户体验**：为主应用的用户提供更丰富、更便捷的跨应用操作体验（如全局划词、快捷操作等）。
-   **安全可控**：确保所有原生能力的调用都在一个明确定义的、安全的框架内进行。

## 2. 核心定位与架构

### 2.1. Tauri 应用的角色定位

在此架构中，Tauri 应用被定义为一个**可信的、第一方的原生扩展**。其核心职责是：

1.  **原生服务提供者 (Native Service Provider)**：负责监听系统事件（如全局快捷键）和执行原生操作（如读写剪贴板）。
2.  **特殊的应用面板 (Privileged App Panel)**：可将其视为一个拥有最高权限的“超级应用面板”，它不受浏览器沙箱限制，可以直接与操作系统交互。
3.  **现有 API 的遵循者 (API Consumer & Provider)**：它作为客户端消费平台的标准 API，同时又通过一个受控的机制，向主应用提供其独有的原生服务。

### 2.2. 融合架构图

Tauri 助手应用与应用面板（Panel）处于同一层级，都是 `ApiAdapterManager` 和 `panelApi` 体系下的服务消费者和提供者。

```mermaid
graph TD
    subgraph "应用层 (App Layer)"
        Panel[应用面板 (Web)]
        TauriApp[Tauri 助手应用 (作为第一方扩展)]
    end

    subgraph "ComfyTavern 前端 (主应用 - 运行在浏览器)"
        Host[宿主环境]
        PanelApi[window.comfytavern.panelApi]
        AdapterManager{ApiAdapterManager}
        ExecutionService[ExecutionService]

        Host -- "提供" --> PanelApi
        PanelApi -- "内部调用" --> AdapterManager
        AdapterManager -- "输出原生输入" --> ExecutionService
    end

    subgraph "ComfyTavern 后端"
        BackendApi[HTTP/WebSocket API]
        ExecutionEngine[工作流执行引擎]
        ExecutionService --> BackendApi
        BackendApi --> ExecutionEngine
    end

    subgraph "操作系统原生能力"
        NativeApi[系统 API (剪贴板, 快捷键, 文件系统)]
    end

    %% 通信流
    Panel -- "通过 panelApi 调用" --> Host
    TauriApp -- "1. 监听系统事件" --> NativeApi
    TauriApp -- "2. 作为客户端调用" --> BackendApi
    BackendApi -- "3. 通过 WebSocket 推送" --> Host
    Host -- "4. (可选) 触发应用逻辑" --> PanelApi

    %% 关键连接：Tauri 通过一个受控的“控制通道”与宿主环境通信
    TauriApp -- "通过控制通道注册/实现原生服务" <--> Host
    style TauriApp fill:#c9f,stroke:#333,stroke-width:4px
```

## 3. 集成实现方案

### 方案一：作为服务请求者 (简单模式)

此模式下，Tauri 应用与主应用完全解耦，仅通过后端作为中介间接通信。

1.  **Tauri 捕获事件**: 用户按下全局快捷键，Tauri 应用通过原生 API 获取到数据（如选中的文本）。
2.  **调用后端 API**: Tauri 应用像一个普通的第三方客户端一样，调用一个专门的后端端点（例如 `POST /api/v1/system/capture`），将采集到的数据上报。
3.  **后端广播**: 后端服务收到请求后，通过 WebSocket 将事件和数据广播给所有已连接的前端客户端。
4.  **主应用响应**: 在浏览器中运行的主应用监听到 WebSocket 事件，并根据业务逻辑更新界面或执行操作。

-   **优点**: 实现简单，逻辑清晰，对现有架构几乎无侵入。
-   **缺点**: 通信链路较长，不适用于需要同步返回结果的原生调用。

### 方案二：作为服务提供者 (高级模式 - 推荐)

此模式充分利用 `panelApi` 的 `requestHostService` 机制，实现更紧密、更强大的集成。

1.  **定义原生服务接口**: 在 ComfyTavern 主应用中，预先定义一组以 `native:` 为前缀的、需要原生能力实现的服务接口。

    ```typescript
    // 在主应用的某个服务注册中心
    // 这些服务在默认情况下是不可用的
    const hostServiceRegistry = {
      'native:readClipboard': async () => {
        throw new Error("原生服务 'readClipboard' 未连接");
      },
      'native:showNotification': async (options: { title: string, body: string }) => {
        throw new Error("原生服务 'showNotification' 未连接");
      },
      // ... 其他原生服务
    };
    ```

2.  **建立控制通道与服务实现**:
    -   Tauri 助手应用启动后，主动与主应用（通过 WebSocket 或其他IPC机制）建立一个**“控制通道”**。
    -   通过此通道，Tauri 应用向主应用“声明”它可以提供的原生服务列表。
    -   主应用收到声明后，用 Tauri 提供的真实调用逻辑**“重写 (override)”或“实现 (implement)”** 之前注册的空服务。真实的调用会通过控制通道将请求发送给 Tauri 并等待返回结果。

3.  **统一的服务调用**:
    -   任何前端模块（如应用面板）需要使用原生功能时，都通过标准的、与实现无关的 `panelApi` 进行调用。
    -   调用方无需关心该服务是由 Tauri 还是其他机制提供的。

    ```javascript
    // 应用面板代码
    try {
      const clipboardText = await window.comfytavern.panelApi.requestHostService('native:readClipboard');
      console.log('从剪贴板获取内容:', clipboardText);
    } catch (error) {
      console.error('无法调用原生服务:', error.message); // 如果 Tauri 助手未运行，会收到 "原生服务未连接" 的错误
    }
    ```

-   **优点**:
    -   **完美解耦**: 上层应用与原生实现完全解耦，面向统一接口编程。
    -   **安全可控**: 所有原生调用都由主应用作为“守门人”进行分发，可以轻松实现权限校验、参数检查和限流，完全遵循 `requestHostService` 的安全设计。
    -   **支持同步返回**: 适用于需要立即获得返回值的原生操作。
    -   **可扩展性强**: 未来可以引入其他原生扩展（如浏览器插件），同样遵循此模式注册服务。

## 4. 与 Agent/工作流的交互

此集成方案与 Agent 的审议-行动循环可以完美结合，实现由 Agent 决策驱动的原生交互。

**案例：Agent 决策需要用户进行原生确认**

1.  **Agent 审议与决策**: Agent 在其核心审议工作流中，根据当前上下文判断需要用户批准一个高风险操作。
2.  **发起工具调用**: Agent 的 LLM 核心输出一个工具调用指令，该指令旨在调用一个原生确认服务。这遵循标准的 Agent 工具调用协议。
3.  **前端捕获与执行**: 前端的 `AgentRuntime` 或 `InteractionCoordinator` 解析此工具调用，并执行 `window.comfytavern.panelApi.requestHostService('native:showConfirmation', params)`。
4.  **Tauri 执行**: 请求通过控制通道转发给 Tauri 助手，Tauri 调用系统 API 弹出一个原生的确认对话框。
5.  **收集用户输入**: 用户点击“是”或“否”，结果通过控制通道返回给前端。
6.  **作为观察结果，触发新一轮审议**: 前端将用户的选择（例如 `{"user_confirmation": true}`）格式化为一个“观察结果 (Observation)”，并将其作为输入，启动 Agent 的**新一轮**审议工作流。
7.  **后续流程**: Agent 在新的审议循环中，接收到用户的确认结果作为观察信息，并据此决定执行相应的后续逻辑。

## 5. 实现路线图

1.  **阶段一：基础建设与简单模式验证**
    -   创建基础的 Tauri 助手应用项目。
    -   实现**方案一（服务请求者）**，打通 Tauri -> Backend -> Frontend 的单向通信链路。
    -   实现一个简单的功能，如“全局快捷键上报划词内容”，验证整个流程。

2.  **阶段二：实现高级服务提供者模式**
    -   在主应用中设计并实现 `HostServiceRegistry` 和服务动态重写机制。
    -   建立主应用与 Tauri 助手之间的**控制通道** (推荐使用 WebSocket)。
    -   实现 `native:readClipboard` 和 `native:showNotification` 两个核心服务的完整调用链路。
    -   迁移阶段一的功能到此新模式下。

3.  **阶段三：与 Agent 交互流深度整合**
    -   确保 Agent 的工具调用机制可以正确地请求 `native:*` 前缀的服务。
    -   完善前端的 `InteractionCoordinator` 或 `AgentRuntime`，使其能够正确解析并执行对原生服务的工具调用。
    -   开发并测试至少一个由 Agent 决策驱动的原生交互场景。

通过以上设计，Tauri 将不再是一个孤立的应用，而是作为平台生态系统中有机的一部分，极大地扩展了 ComfyTavern 的能力边界。