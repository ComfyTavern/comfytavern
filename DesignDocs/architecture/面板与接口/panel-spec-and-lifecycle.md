# 设计文档：应用面板规范与生命周期管理 (v2 - 微应用视角)

## 1. 引言与目标

**背景**：ComfyTavern 致力于将复杂的工作流封装成面向最终用户的交互式体验。这些体验通过“应用面板”提供，它本质上是一个**灵活的视图容器**。该容器可以被用户任意放置——例如作为独立的全屏页面、停靠在侧边栏，或以窗口形式浮动——并在其中加载和运行一个**功能丰富的、沙盒化的微型 Web 应用**。这些微应用由创作者构建，可以使用从简单 HTML/JS/CSS 到复杂 WebAssembly 应用（如游戏引擎、高级编辑器）等任意 Web 技术栈，并通过标准化的 API 与 ComfyTavern 平台进行深度集成。

**目标**：本文档旨在详细定义应用面板的规范、其数据结构、创作者如何构建和提供这些微应用，以及平台如何管理其生命周期。目标是实现一个高度灵活、功能强大、安全可控且对创作者友好的面板生态系统。

## 2. 核心设计理念

*   **面板即微应用 (Panel as a Micro-Application)**：将每个应用面板视为一个独立的、功能完备的 Web 应用。它可以拥有自己的状态管理、复杂逻辑，甚至集成第三方库或服务。
*   **创作者驱动的体验**：应用面板的完整用户体验由创作者完全控制和设计。
*   **沙盒化安全执行**：所有面板都在严格的沙盒环境 (`<iframe>`) 中运行，以确保主应用和其他面板的安全。
*   **标准化接口通信**：面板通过平台注入的标准化 JavaScript API (`window.comfyTavernPanelApi`) 与 ComfyTavern 核心功能及宿主环境进行通信。
*   **声明式配置与能力**：面板通过 `PanelDefinition` 清晰地声明其元数据、入口点、所需权限和绑定的工作流。
*   **响应式与自适应内容 (Responsive and Self-Adapting Content)**：平台提供灵活的容器，内容的呈现方式则由应用内部的 CSS 和 JavaScript 逻辑完全决定。创作者可以自由设定面板的初始尺寸与宽高比。

## 3. 应用面板定义 (`PanelDefinition`)

`PanelDefinition` 对象是描述和配置应用面板的核心数据结构。

*   **`panelId`**: `string` (唯一标识符)
*   **`displayName`**: `string` (UI 显示名称)
*   **`description`**: `string` (可选, 功能描述)
*   **`version`**: `string` (版本号, e.g., "1.0.0")
*   **`author`**: `string` (可选, 作者)
*   **`uiEntryPoint`**: `string`
    *   描述：指向面板微应用的主入口 HTML 文件（例如 `./my-game/index.html`，该 HTML 可能加载复杂的 JavaScript 应用、WebAssembly 模块等）。
    *   重要性：平台通过此入口加载面板。
*   **`uiRuntimeConfig`**: `object` (可选)
    *   `sandboxAttributes`: `string[]` (可选)
        *   描述：为 `<iframe>` 配置 `sandbox` 属性。创作者根据面板需求声明，平台可进行审核或限制。
        *   示例：`["allow-scripts", "allow-modals", "allow-pointer-lock"]`。对于需要同源访问内部资源或特定API的复杂应用（如使用CDN或本地打包资源的游戏），可能需要谨慎考虑 `allow-same-origin` (平台需提供指导)。
        *   默认：平台应提供一个安全的默认配置，并允许面板根据需要请求额外权限。
    *   `featurePermissions`: `string[]` (可选, 替代或补充 `sandboxAttributes` 中对特定 API 的控制)
        *   描述：明确声明面板需要的浏览器特性或 API，例如 `["webgl", "webaudio", "gamepad", "clipboard-read", "fullscreen"]`。平台可据此进行更细致的权限授予或向用户提示。
*   **`workflowBindings`**: `PanelWorkflowBinding[]`
    *   描述：定义此面板可绑定的工作流。
    *   结构 (`PanelWorkflowBinding`):
        *   `workflowId`: `string` (绑定的工作流 ID。这是唯一的关联方式，面板通过 `panelApi` 直接使用此 ID 调用工作流。)
*   **`resourceBundle`**: `object` (可选)
    *   `url`: `string` (指向面板静态资源包的 URL, e.g., a zip file or a manifest)
    *   `checksum`: `string` (可选, 用于校验资源完整性)
    *   `lazyLoad`: `boolean` (可选, 默认为 `true` for large bundles)
*   **`minAppVersion`**: `string` (可选, 运行此面板所需的 ComfyTavern 平台最低版本)
*   **`supportedLanguages`**: `string[]` (可选, 面板 UI 支持的语言)
*   **`iconUrl`**: `string` (可选, 面板图标)
*   **`tags`**: `string[]` (可选, 分类标签)

## 4. 应用面板：独立的微型 Web 应用

*   **技术栈与能力**：
    *   创作者可以使用任何现代 Web 技术构建面板，包括：
        *   主流前端框架 (Vue, React, Angular, Svelte)。
        *   纯 JavaScript (ES6+), HTML5, CSS3。
        *   **WebAssembly (WASM)**：允许使用 C++, Rust, Go 等语言编译的高性能代码，适用于游戏引擎 (e.g., Unity, Unreal via WASM, Godot Engine, Phaser, PlayCanvas), 复杂计算, 图形处理 (e.g., Three.js, Babylon.js) 等。
        *   CSS 预处理器 (Sass, Less), UI 库 (Tailwind CSS, Material UI)。
    *   面板可以包含自己的路由、状态管理、数据持久化（通过与宿主API交互）、以及与第三方服务的集成（在沙盒策略允许范围内）。
*   **运行环境与沙盒**：
    *   面板在 `<iframe>` 中沙盒化运行，确保安全隔离。
    *   `sandbox` 属性和 `featurePermissions` (通过 `PanelDefinition` 配置) 共同决定了面板的能力边界。平台需提供清晰的文档，指导创作者如何在满足功能需求（如访问 WebGL、Gamepad API、Pointer Lock API 等）和保障安全之间取得平衡。
    *   平台通过 `window.comfyTavernPanelApi` 向面板注入通信接口。
*   **核心职责 (面板微应用侧)**：
    1.  初始化自身应用逻辑和 UI。
    2.  通过 `comfyTavernPanelApi` 与宿主通信：
        *   获取绑定的工作流接口定义 (`getWorkflowInterface`)。
        *   执行工作流 (`executeWorkflow`)：这既可以是用户在面板上直接触发的，也可以是面板响应用户操作后，将数据传递给一个与 Agent 交互的技能工作流。
        *   订阅执行事件 (`subscribeToExecutionEvents`)：用于接收工作流（包括 Agent 的技能工作流）执行过程中的状态更新和结果。
        *   **响应 Agent 交互请求**：面板通过订阅 `panelApi` 的事件（例如 `onInteractionRequest`），响应由 Agent 工作流执行后产出的交互请求。面板根据请求渲染相应 UI，收集用户输入，并将结果通过回调函数交由交互协调器处理，以触发后续流程。
        *   **展示 Agent 状态与输出**: 订阅由 Agent (通过场景事件总线间接)发布的特定事件，以实时更新界面，展示 Agent 的状态、行动结果或世界环境的变化。
        *   获取宿主信息 (如主题 `getCurrentTheme`, 用户偏好等)。
        *   请求宿主服务 (如调整iframe尺寸、请求持久化存储、触发通知等，需在 `comfyTavernPanelApi` 中定义相应接口)。
    3.  管理自身状态并响应用户交互。这些交互既可以直接驱动面板内部逻辑，也可以通过 API 间接触发 Agent 的行为。同时，面板根据从宿主获取的数据（如 Agent 的输出和事件）来更新 UI。

## 5. 面板生命周期与管理

*   **发现与安装**：
    *   平台支持从本地目录、URL 或集成的面板市场/仓库中发现和安装面板。
    *   安装过程可能涉及下载资源包 (`PanelDefinition.resourceBundle`)、校验完整性、注册 `PanelDefinition`。
*   **加载与实例化**：
    *   当用户选择打开一个面板时，平台会为其创建一个 `<iframe>` 实例，根据 `PanelDefinition` 配置沙盒和特性权限，并加载其 `uiEntryPoint`。
    *   资源可以按需加载和缓存，特别是对于大型面板应用。
*   **版本控制与更新**：
    *   平台应支持面板的版本管理，允许创作者发布更新，用户可以选择升级。
*   **卸载**：从平台移除面板及其相关资源和配置。
*   **权限管理**：平台根据面板声明的 `featurePermissions` 和用户授权来控制面板对敏感 API 或宿主功能的访问。

## 6. 面板与宿主的高级交互 (通过 `comfyTavernPanelApi`)

除了核心的工作流交互，`comfyTavernPanelApi` 应设计为支持更丰富的面板-宿主通信：

*   **UI/UX 服务**：
    *   `requestResize(dimensions: { width?: string, height?: string })`: **(特定宿主环境适用)** 面板应用可以请求其宿主容器调整尺寸。此 API 主要用于面板被嵌入在原生应用（如 Tauri 扩展的窗口）中的场景，此时面板内的 Web 内容需要一种方式来控制其外部原生窗口的大小。在标准浏览器环境中，由于容器尺寸由用户直接控制，宿主环境可能会忽略此请求。
    *   `requestFullscreen()`
    *   `showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error')`
    *   `getSystemColors(): Promise<object>` (获取主题色、字体等)
*   **数据持久化服务** (作用域限定于面板自身)：
    *   `storage.setItem(key: string, value: string): Promise<void>`
    *   `storage.getItem(key: string): Promise<string | null>`
    *   `storage.removeItem(key: string): Promise<void>`
*   **用户上下文服务** (需用户授权)：
    *   `getCurrentUser(): Promise<{ id: string, displayName?: string } | null>`
*   **其他可扩展服务**：根据平台发展和面板需求，可逐步增加。

## 7. 未来展望

*   **面板间通信**：在严格的安全和权限控制下，允许面板之间进行有限的通信或数据共享。
*   **更细致的资源管理和按需加载策略**。
*   **平台提供的标准化 UI 组件库或服务**，供面板选择性使用，以保持一定程度的视觉和交互一致性。
*   **完善的面板开发工具和调试支持**。