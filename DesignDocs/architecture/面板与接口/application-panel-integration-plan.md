# 设计文档：应用面板集成方案 (总览)

## 1. 引言

本文档最初旨在规划 ComfyTavern 平台中应用面板的集成方案，涵盖从面板定义、API 设计、执行流程到安全考虑等多个方面，同时，这些应用面板也是 Agent 与最终用户交互的关键界面。

根据进一步的讨论和细化，原有的综合性计划已被拆分为多个更专注、更详细的独立设计文档。本文档现作为这些详细设计文档的**总览和入口**，帮助读者快速定位到特定功能模块的详细规划。

## 2. 核心设计模块与详细文档链接

应用面板的集成方案主要围绕以下核心模块进行设计，每个模块都有其对应的详细设计文档：

### 2.1. 应用面板规范与生命周期管理

*   **文档链接**: [`./panel-spec-and-lifecycle.md`](./panel-spec-and-lifecycle.md:1)
*   **核心内容**:
    *   定义了“应用面板”作为功能丰富的、沙盒化的微型 Web 应用的核心概念。
    *   详细阐述了 `PanelDefinition` 数据结构，包括面板的元数据、UI 入口点、运行配置（如 `sandbox` 属性和 `featurePermissions`）、工作流绑定等。
    *   讨论了应用面板的技术栈选择、在 `<iframe>` 中的沙盒化运行环境，以及通过 `window.comfyTavernPanelApi` 与宿主的安全通信。
    *   初步设想了面板的发现、加载、版本控制、存储和权限管理等生命周期管理机制。
    *   展望了面板与宿主之间更高级的交互可能性。

### 2.2. API 服务与集成接口设计

*   **文档链接**: [`./api-services-and-integration.md`](./api-services-and-integration.md:1)
*   **核心内容**:
    *   详细规划了 ComfyTavern 平台提供的多层次 API 服务。
    *   **面向应用面板的 JavaScript API (`window.comfyTavernPanelApi`)**: 作为面板与平台内预定义工作流交互的主要桥梁，封装了工作流接口获取、执行、事件订阅等功能。
    *   **面向第三方的 HTTP API (与预定义工作流交互)**: 包括获取工作流接口、执行工作流（支持同步/异步）、查询执行状态，以及可选的 Webhook 和 SSE 支持。
    *   **OpenAI API 兼容层**: 设计了如何将特定工作流适配为 OpenAI 兼容的 HTTP 接口，包括端点映射、请求/响应转换等。
    *   **直接原始工作流执行 API (`/api/v1/execute_raw_workflow`)**: 为高级用例提供直接提交和执行完整工作流 JSON 定义的能力，并明确了调用方职责和 API 层的“透明转发”角色（如果前端涉及）。
    *   阐述了通用的 API 设计原则（认证、错误处理、版本管理等）和 API 网关/代理层的初步架构设想。

### 2.3. 执行核心与安全保障

*   **文档链接**: [`./execution-core-and-security.md`](./execution-core-and-security.md:1)
*   **核心内容**:
    *   详细描述了应用面板的安全沙盒运行环境，包括 `<iframe>` 配置、特性权限 (`featurePermissions`) 和内容安全策略 (CSP)。
    *   阐述了从面板或 API 调用接收输入，到安全地注入预定义工作流，再到后端执行的完整核心流程。
    *   重点讨论了直接执行原始工作流定义时，后端所需进行的严格安全校验机制（如节点类型白名单、资源限制、输入校验等）。
    *   概述了平台通用的安全保障措施，如身份认证、授权、速率限制、日志监控、传输安全等。

### 2.4. 开发者生态与支持

*   **文档链接**: [`./developer-ecosystem-and-support.md`](./developer-ecosystem-and-support.md:1)
*   **核心内容**:
    *   规划了面向不同开发者群体（面板创作者、API 集成者等）的全面文档体系，包括 API 参考、开发指南、教程和示例。
    *   设想了必要的开发者工具与资源，如面板项目脚手架、客户端 SDK、调试支持等。
    *   讨论了建立开发者社区和支持渠道的重要性。
    *   强调了持续关注和改进开发者体验 (DX) 的必要性。

## 3. 后续步骤

请参考上述各个独立的详细设计文档，以了解每个功能模块的具体规划和技术细节。这些文档将作为后续开发和实现工作的指导。