**设计文档：应用面板集成方案**

**1. 引言与目标**

*   **背景**：回顾 ComfyTavern 的核心价值主张——将复杂工作流封装成面向最终用户的交互式应用面板。
*   **目标**：设计一个高度灵活、安全且对创作者友好的机制，允许将任何 ComfyTavern 工作流封装成具有自定义用户界面的应用面板。创作者可以使用 HTML/JS/CSS（包括由 AI 工具生成的）来构建面板 UI，并通过一个标准化的代理 API 与 ComfyTavern 核心功能交互。

**2. 核心设计理念**

*   **工作流即函数**：将每个 ComfyTavern 工作流视为一个可调用的“函数”，其 `interfaceInputs` 为函数参数，`interfaceOutputs` 为函数返回值。
*   **代理中间层封装**：提供一个清晰的代理 API 层，作为应用面板（“函数调用者”）与工作流执行核心（“函数体”）之间的桥梁，隐藏底层复杂性。
*   **创作者驱动的 UI**：应用面板的 UI 由创作者完全控制，可以使用任何 Web 技术栈实现，运行在沙盒环境中以确保安全。
*   **中心化接口定义**：工作流的输入输出接口 (`interfaceInputs`/`interfaceOutputs`) 在工作流元数据中统一定义，并通过画布上的 `core:GroupInput`/`core:GroupOutput` 节点进行可视化代理。

**3. 关键组件与数据结构**

*   **3.1. 应用面板定义 (`PanelDefinition`)**
    *   **`panelId`**: `string` - 唯一标识符。
    *   **`displayName`**: `string` - UI 显示名称。
    *   **`description`**: `string` (可选) - 功能描述。
    *   **`version`**: `string` - 版本号。
    *   **`author`**: `string` (可选) - 作者。
    *   **`uiEntryPoint`**: `string` - 面板 UI 的入口点（例如，`./my-panel/index.html` 或 `./my-panel/main.js`）。这是面板静态资源的主文件。
    *   **`uiRuntimeConfig`**: `object` (可选) - 面板运行环境配置。
        *   `sandboxAttributes`: `string[]` (可选) - 用于 `<iframe>` 的 `sandbox` 属性列表 (例如, `["allow-scripts", "allow-modals"]`)。默认为较严格的配置。
        *   `initialHeight`: `string` (可选) - `<iframe>` 的建议初始高度。
    *   **`workflowBindings`**: `PanelWorkflowBinding[]` - 定义此面板可绑定的工作流。
        *   `workflowId`: `string` - 关联的工作流 ID。
        *   `displayName`: `string` (可选) - 此工作流在此面板上下文中的显示名称。
    *   *未来可能包含：图标、分类标签、所需权限等。*

*   **3.2. 代理中间层 (Proxy Layer)**
    *   **实现方式**：作为 ComfyTavern 前端的一部分，通过向沙盒化的应用面板环境（如 `iframe.contentWindow`）注入一个全局 API 对象 (例如 `window.comfyTavernPanelApi`) 来提供服务。
    *   **核心 API 接口**：
        *   `async getWorkflowInterface(workflowId: string): Promise<{ inputs: Record<string, GroupSlotInfo>, outputs: Record<string, GroupSlotInfo> }>`
        *   `async executeWorkflow(workflowId: string, interfaceInputValues: Record<string, any>): Promise<{ promptId: string }>`
        *   `subscribeToExecutionEvents(promptId: string, callbacks: PanelExecutionCallbacks): () => void` (取消订阅函数)
            *   `PanelExecutionCallbacks`: `{ onStatusChange?, onNodeOutput?, onWorkflowOutput?, onError? }`
        *   `async getCurrentTheme(): Promise<{isDark: boolean, ...}>` (可选)
    *   **职责**：验证请求、调用 ComfyTavern 核心执行逻辑、处理输入注入、管理 WebSocket 通信并向面板转发相关事件。

*   **3.3. 应用面板 (Creator-Provided UI)**
    *   **技术栈**：任意 HTML, CSS, JavaScript。
    *   **运行环境**：沙盒化 `<iframe>`。
    *   **核心职责**：
        1.  通过 `comfyTavernPanelApi.getWorkflowInterface` 获取接口定义。
        2.  根据接口定义渲染或适配 UI。
        3.  收集用户输入，并将其组织成 `interfaceInputValues: Record<string, any>` (key 对应 `interfaceInputs` 的 key)。
        4.  调用 `comfyTavernPanelApi.executeWorkflow` 触发执行。
        5.  通过 `comfyTavernPanelApi.subscribeToExecutionEvents` 接收状态和结果，更新 UI。

**4. 核心执行流程与输入注入**

*   **4.1. 流程概述 (Mermaid 序列图已提供)**
    1.  用户在应用面板 UI 交互并提供输入。
    2.  面板 JS 调用 `ProxyAPI.executeWorkflow(workflowId, panelInputs)`。
    3.  代理层接收请求，加载 `workflowId` 的原始 VueFlow 元素。
    4.  **输入注入**：代理层创建元素副本，找到顶层 `core:GroupInput` 节点，遍历 `panelInputs`，将值设置到从 `core:GroupInput` 对应输出槽连接的下游节点的相应输入数据中。
    5.  代理层调用内部核心执行逻辑（类似调整后的 `useWorkflowExecution.executeWorkflow`），传入已注入输入的元素列表。
    6.  核心执行逻辑执行扁平化 (`flattenWorkflow`)、转换 (`transformVueFlowToCoreWorkflow`, `transformVueFlowToExecutionPayload`)、构建 `outputInterfaceMappings`。
    7.  通过 WebSocket 发送 `PROMPT_REQUEST` 给后端。
    8.  后端执行，并通过 WebSocket 返回状态和结果。
    9.  代理层接收 WebSocket 消息，通过回调函数转发给应用面板 JS。
    10. 应用面板 JS 更新 UI。

*   **4.2. 输入注入细节**：
    *   在调用 `flattenWorkflow` 之前，代理层会预处理工作流的元素列表。
    *   它会找到代表主工作流输入的 `core:GroupInput` 节点。
    *   对于应用面板提供的每个 `interfaceInput` 值，代理层会查找从 `core:GroupInput` 对应输出槽出发的连接，定位到直接下游的节点及其输入槽。
    *   面板的输入值将被直接写入这些直接下游节点的输入数据结构中（例如，更新 `targetNode.data.inputs[targetSlotKey].value` 或 `targetNode.inputValues[targetSlotKey]`，需确保与后续转换逻辑兼容）。
    *   （可选）顶层的 `core:GroupInput` 节点本身及其出边在注入完成后，可以从待处理的元素列表中移除，因为它定义接口和引导注入的功能已完成。或者保留，但确保其后端执行无副作用。

**5. 数据流图 (Mermaid 流程图已提供)**

**6. 对现有模块的潜在修改**

*   **`useWorkflowExecution.ts`**:
    *   需要能够被代理层以更程序化的方式调用，可能需要重构其 `executeWorkflow` 函数，使其能够接收一个预处理（已注入面板输入）的元素列表，或者直接接收 `interfaceInputValues` 作为参数。
*   **前端路由/视图管理**：
    *   当项目的 `preferredView` 为 "custom" 时，需要加载一个“面板宿主”组件，该组件负责创建 `iframe`、加载面板的 `uiEntryPoint`、并建立与面板的通信桥梁（注入 `comfyTavernPanelApi`）。
*   **`core:GroupInput` 节点 (后端实现)**:
    *   如果顶层 `core:GroupInput` 节点在扁平化后仍然保留并发送到后端，其后端 `execute` 方法应设计为无操作或仅传递通过 `configValues` 或特殊 `inputs` 传入的值（如果采用这种方式传递面板输入）。但根据我们最新的讨论，输入注入发生在前端，后端 `core:GroupInput` 可能不需要感知面板的直接输入。

**7. 安全考虑**

*   **`<iframe>` 沙盒**：严格配置 `iframe` 的 `sandbox` 属性，遵循最小权限原则，例如默认禁止 `allow-same-origin` (除非面板资源与主应用同源且受信任)、`allow-forms`、`allow-popups` 等，仅开启必要的权限如 `allow-scripts`。
*   **API 权限**：代理层暴露给面板的 API 应是受限的，不应允许面板执行任意代码或访问 ComfyTavern 的内部状态。
*   **内容安全策略 (CSP)**：为 `iframe` 和主应用设置合适的 CSP 头部，减少 XSS 风险。
*   **面板来源验证** (未来)：对于从外部加载的面板，可能需要来源验证机制。

**8. 文档与开发者体验**

*   为应用面板开发者提供清晰的 API 文档和开发指南。
*   提供面板创建模板或示例。

**9. 未来展望**

*   面板市场/仓库。
*   更细致的面板权限管理。
*   代理层提供更多标准服务（如持久化面板状态、用户偏好设置等）。