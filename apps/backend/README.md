# ComfyTavern - 后端服务

本项目是 [ComfyTavern](../../README.md) 的后端部分，基于 ElysiaJS 和 Bun 构建，使用 TypeScript 开发。它负责处理平台的核心业务逻辑，包括节点管理、工作流执行、API 服务以及通过 WebSocket 进行的实时通信。

## 核心功能

-   **节点系统**:
    -   动态加载和管理节点定义。
    -   支持内置节点和自定义节点扩展。
-   **工作流引擎**:
    -   接收前端编排的工作流数据。
    -   按节点逻辑顺序执行工作流。
    -   处理节点间的输入输出数据流。
-   **HTTP API**:
    -   提供节点定义列表。
    -   管理项目（Projects）元数据和相关工作流文件。
    -   保存和加载单个工作流。
    -   提供其他资源接口（如角色卡信息）。
-   **WebSocket 通信**:
    -   实时推送工作流执行状态、进度和结果。
    -   处理来自前端的交互事件，如节点内部按钮点击。

## 技术栈

-   **框架**: [ElysiaJS](https://elysiajs.com/)
-   **运行时**: [Bun](https://bun.sh/)
-   **主要语言**: TypeScript

## 项目结构 (src/)

-   `nodes/`: 包含所有节点类型的定义和执行逻辑。
-   `routes/`: 定义所有 HTTP API 端点。
-   `services/`: 封装核心业务逻辑服务，如节点加载器 (`NodeLoader`)、节点管理器 (`NodeManager`)、项目服务 (`projectService`) 和执行引擎 (`ExecutionEngine`)。
-   `websocket/`: 处理 WebSocket 连接建立和消息交互。
-   `index.ts`: 后端服务的入口文件，负责初始化和启动 Elysia 应用。
-   `config.ts`: 存放后端服务的配置信息。

## 运行与开发

后端服务通常作为整个 ComfyTavern 应用的一部分启动。请参考项目根目录的 [README.md](../../README.md#运行) 中的说明来启动开发或生产模式。

开发模式下，后端服务通常监听在 `http://localhost:3233/`。