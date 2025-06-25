# 设计文档：应用面板集成方案 (总览)

## 1. 引言

本文档最初旨在规划 ComfyTavern 平台中应用面板的集成方案，涵盖从面板定义、API 设计、执行流程到安全考虑等多个方面，同时，这些应用面板也是 Agent 与最终用户交互的关键界面。

根据进一步的讨论和细化，原有的综合性计划已被拆分为多个更专注、更详细的独立设计文档。本文档现作为这些详细设计文档的**总览和入口**，帮助读者快速定位到特定功能模块的详细规划。

## 2. 核心设计模块与详细文档链接

应用面板的集成方案主要围绕以下核心模块进行设计，每个模块都有其对应的详细设计文档，建议按以下顺序阅读以获得最佳理解：

### 2.1. 应用面板规范与生命周期管理

*   **文档链接**: [`./panel-spec-and-lifecycle.md`](./panel-spec-and-lifecycle.md:1)
*   **核心内容**:
    *   **定义了“什么是面板”**：将“应用面板”定义为功能丰富的、沙盒化的、可使用任意 Web 技术栈（包括 WebAssembly）构建的微型 Web 应用。
    *   详细阐述了 `PanelDefinition` 核心数据结构，包括面板的元数据、UI 入口点 (`uiEntryPoint`)、运行配置（如 `sandboxAttributes` 和 `featurePermissions`）、工作流绑定等。
    *   明确了面板的发现、加载、版本控制和存储等生命周期管理机制。

### 2.2. 应用面板 API (`panelApi`) 规范

*   **文档链接**: [`./panel-api-specification.md`](./panel-api-specification.md:1)
*   **核心内容**:
    *   **定义了面板“如何与外界沟通”**：作为 `window.comfyTavern.panelApi` 的**单一事实来源**，提供了其完整的 TypeScript 接口定义。
    *   固化了 `executeWorkflow`, `getWorkflowInterface`, `subscribeToExecutionEvents`, `requestHostService` 等核心方法的签名和行为。
    *   确立了面板与宿主环境之间基于 `postMessage` 的安全通信机制和必须遵守的安全边界。

### 2.3. 前端 API 适配管理器与集成

*   **文档链接**: [`./frontend-api-manager-and-integration.md`](./frontend-api-manager-and-integration.md:1)
*   **核心内容**:
    *   **定义了前端“如何处理这种沟通”**：引入了一个纯前端的核心服务 `ApiAdapterManager`，作为应用层请求到原生工作流输入的“翻译层”。
    *   为 `panelApi.executeWorkflow` 提供了两种调用模式：`native`（直接提供工作流输入）和 `adapter`（使用 API 适配器转换外部格式，如 OpenAI API）。
    *   详细设计了 `ApiAdapter` 的概念、数据结构、转换规则（Transformer）以及其创建、管理和测试的生命周期。
    *   明确了前端负责构建最终执行载荷，而后端通过 `/api/v1/execute_raw_workflow` 接口接收标准化工作流 JSON 进行安全执行的分层策略。

### 2.4. 执行核心与安全保障

*   **文档链接**: [`./execution-core-and-security.md`](./execution-core-and-security.md:1)
*   **核心内容**:
    *   **定义了请求“如何被安全执行”**：详细描述了应用面板的 `<iframe>` 安全沙盒环境，包括 `sandbox` 属性、特性权限 (`featurePermissions`) 和内容安全策略 (CSP)。
    *   阐述了从 API 或面板接收输入，到安全地注入预定义工作流，再到后端执行的完整核心流程。
    *   重点讨论了后端在执行原始工作流定义时必须进行的严格安全校验机制（如节点类型白名单、资源限制、输入校验等）。

### 2.5. 开发者生态与支持

*   **文档链接**: [`./developer-ecosystem-and-support.md`](./developer-ecosystem-and-support.md:1)
*   **核心内容**:
    *   **定义了“如何支持开发者来使用这一切”**：面向应用面板创作者和 API 集成者，规划了全面的文档体系、开发者工具（如面板脚手架、SDK）和社区支持渠道。
    *   强调了持续关注和改进开发者体验 (DX) 的重要性，以构建活跃、健康的开发者生态。

## 3. 后续步骤

请参考上述各个独立的详细设计文档，以了解每个功能模块的具体规划和技术细节。这些文档将作为后续开发和实现工作的指导。