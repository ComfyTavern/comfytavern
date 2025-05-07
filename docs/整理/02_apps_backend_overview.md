# ComfyTavern Backend (`apps/backend`) 概览

本文档总结了 ComfyTavern 项目后端应用 (`apps/backend`) 的基本信息，包括目录结构、核心功能、技术栈和 API 结构。

## 1. 目录结构和文件用途

`apps/backend` 目录包含了后端服务的主要代码：

*   **`src/`**: 源代码目录。
    *   **`index.ts`**: 应用入口文件。使用 Elysia.js 框架初始化服务器，加载节点，挂载 API 路由和 WebSocket 处理器。
    *   **`config.ts`**: 读取根目录 `config.json` 并导出配置常量，如端口号、前端 URL、工作流和项目目录路径 (`library/workflows`, `projects/`)。
    *   **`nodes/`**: 包含所有节点定义的目录。
        *   `NodeManager.ts`: 管理节点定义（加载、获取）。
        *   `NodeLoader.ts`: 负责动态加载 `nodes/` 目录下的所有节点定义。
        *   `*.ts`: 具体的节点实现（例如 `RandomNumberNode.ts`, `OpenAIChatNode.ts`, `GroupInputNode.ts` 等）。
        *   `client-scripts/`: 存放节点对应的客户端 JavaScript 文件，通过 `/client-scripts/*` API 提供给前端。
    *   **`routes/`**: API 路由定义。
        *   `nodeRoutes.ts`: 定义 `/api/nodes` (获取节点定义) 和 `/client-scripts/*` (获取节点客户端脚本) 路由。
        *   `workflowRoutes.ts`: 定义 `/api/workflows` (全局工作流，主要是列出，其他操作指向项目 API)。
        *   `projectRoutes.ts`: 定义 `/api/projects` (项目管理和项目内工作流的 CRUD 操作，包括元数据管理)。
    *   **`services/`**: 包含业务逻辑服务。
        *   `projectService.ts`: 处理项目相关的逻辑，如获取项目工作流目录、同步节点组引用、更新项目元数据。
    *   **`utils/`**: 工具函数。
        *   `helpers.ts`: 包含辅助函数，如 ID 清理、安全文件名生成等。
        *   `ImageProcessor.ts`: (文件名存在，但未读取内容，推测用于图像处理)。
    *   **`websocket/`**: WebSocket 相关逻辑。
        *   `handler.ts`: 定义 WebSocket 连接的事件处理 (open, message, close) 和消息 Schema，用于工作流执行状态的实时通信。
    *   **`ExecutionEngine.ts`**: 工作流执行引擎。负责接收工作流数据，进行拓扑排序，按顺序执行节点，处理输入输出，并通过回调发送状态更新。
*   **`dist/`**: TypeScript 编译后的 JavaScript 输出目录。
*   **`projects/`**: (此目录在 `apps/backend` 下，但配置指向根目录的 `projects/`) 存放用户项目数据的地方。每个子目录代表一个项目，包含 `project.json` 元数据和 `workflows/` 子目录。
*   **`package.json`**: Node.js 项目描述文件，包含依赖项和脚本。
*   **`tsconfig.json`**: TypeScript 配置文件。
*   **`.gitignore`**: Git 忽略文件配置。
*   **`README.md`**: 后端应用的说明文件。

## 2. 核心功能概述

后端应用的核心功能是作为一个 **工作流执行和管理平台** 的服务端：

1.  **节点管理**: 动态加载和管理可用的节点类型及其定义。
2.  **项目管理**: 支持创建、列出、管理项目。每个项目有自己的元数据 (`project.json`) 和工作流集合。
3.  **工作流管理**:
    *   支持在项目内创建、读取、更新、删除 (CRUD) 工作流。
    *   工作流以 JSON 格式存储在文件系统中 (`projects/<projectId>/workflows/*.json`)。
    *   支持列出全局库中的工作流 (`library/workflows/*.json`)，但主要操作在项目层面。
4.  **工作流执行**:
    *   接收工作流数据（节点、边）。
    *   使用 `ExecutionEngine` 进行拓扑排序，确保节点按正确依赖顺序执行。
    *   按顺序执行节点，传递输入/输出数据。
    *   通过 WebSocket 向客户端实时推送节点和工作流的执行状态（运行中、完成、错误、跳过）。
5.  **API 服务**: 提供 RESTful API 供前端或其他客户端调用，用于管理节点、项目、工作流以及触发执行。
6.  **WebSocket 服务**: 提供 WebSocket 端点 (`/ws`)，用于实时双向通信，主要是后端向前端推送执行状态更新。**连接管理已重构为全局单例模式**，以优化资源使用和稳定性。
7.  **服务器管理**: 提供一个简单的 API 端点 (`/api/server/restart`) 用于尝试触发服务器重启（通过修改文件时间戳）。

## 3. 主要技术栈和依赖

*   **框架**: [Elysia.js](https://elysiajs.com/) (一个高性能的 Bun/Node.js Web 框架)
*   **语言**: TypeScript
*   **运行时**: Bun (根据用户指令和根目录 `bun.lock` 推断)
*   **主要库**:
    *   `@elysiajs/cors`: 处理 CORS 跨域请求。
    *   `@comfytavern/types`: 共享的 TypeScript 类型定义 (位于 `packages/types`)。
    *   `lodash/isEqual`: 用于深度比较对象 (在 `index.ts` 中看到)。
    *   `sanitize-filename`: (可能) 用于清理文件名 (通过 `helpers.ts`)。
*   **数据存储**: 文件系统 (JSON 文件存储工作流和项目元数据)。**没有使用传统数据库**。
*   **通信**: RESTful API (HTTP), WebSocket

## 4. 主要 API 路由结构

*   **`/api/nodes`**:
    *   `GET /`: 获取所有节点定义。
*   **`/client-scripts/*`**:
    *   `GET /*`: 获取指定节点的客户端脚本。
*   **`/api/workflows`**: (全局工作流，主要用于读取)
    *   `GET /`: 列出全局工作流。
    *   `GET /:id`: (已禁用)
    *   `POST /`: (已禁用)
    *   `PUT /:id`: (已禁用)
    *   `DELETE /:id`: (已禁用)
*   **`/api/projects`**: (项目管理)
    *   `GET /`: 列出所有项目。
    *   `GET /:projectId/metadata`: 获取项目元数据。
    *   `PUT /:projectId/metadata`: 更新项目元数据。
    *   `GET /:projectId/workflows`: 列出项目内的工作流。
    *   `POST /:projectId/workflows`: 创建项目内工作流。
    *   `GET /:projectId/workflows/:workflowId`: 获取项目内指定工作流。
    *   `PUT /:projectId/workflows/:workflowId`: 更新项目内指定工作流。
    *   `DELETE /:projectId/workflows/:workflowId`: 删除项目内指定工作流。
*   **`/api/server`**:
    *   `POST /restart`: 尝试触发服务器重启。
*   **`/ws`**: WebSocket 端点，用于实时通信。