# ComfyTavern 项目最终概览

本文档综合了对 ComfyTavern 项目各部分的分析报告，提供一个整体的项目概览，涵盖目标、技术栈、核心模块、功能、文档和启动方式。

## 1. 项目概览 (Project Overview)

*   **名称:** comfytavern
*   **版本:** 0.0.3
*   **描述:** 一个面向创作者的 LLM 驱动可视化创作引擎，基于节点画布，旨在帮助创作者通过直观的拖拽界面设计复杂的 AI 交互体验（如聊天机器人、视觉小说、文字RPG）。
*   **目标:** 成为一个面向创作者的 LLM 驱动可视化创作引擎，提供预设模板、规则集、上下文管理和非线性对话功能，支持通过内置 Agent 助手自定义节点和界面，并规划了灵活的插件系统以扩展功能。
*   **结构:** Monorepo (使用 Bun Workspaces 管理 `apps/*` 和 `packages/*`)。
*   **状态:** 项目处于早期开发阶段 (beta)，正在评估 LiteGraph.js 和 Vue Flow 两种节点编辑器，目前 Vue Flow 是主要开发方向。

## 2. 主要技术栈 (Main Tech Stack)

*   **核心运行时:** Bun
*   **语言:** TypeScript (ESNext 模块, `strict` 模式)
*   **后端 (`apps/backend`):**
    *   框架: Elysia.js
*   **前端 (`apps/frontend-vueflow`):**
    *   框架: Vue.js 3
    *   构建工具: Vite
    *   图形库: VueFlow (`@vue-flow/core`)
    *   状态管理: Pinia
    *   UI/样式: Tailwind CSS, DaisyUI
    *   路由: Vue Router
*   **共享包 (`packages`):**
    *   `@comfytavern/types`: 使用 Zod 进行 Schema 定义和验证。
*   **数据存储:** 文件系统 (使用 JSON 文件存储工作流和项目元数据)。
*   **通信:** RESTful API (HTTP), WebSocket

## 3. 核心模块划分与功能 (Core Modules & Functionality)

### 3.1 后端 (`apps/backend`)

*   **核心功能:** 作为工作流执行和管理平台的服务端。
    *   **节点管理:** 动态加载和管理节点定义 (`nodes/`, `NodeManager.ts`, `NodeLoader.ts`)。
    *   **项目管理:** 创建、列出、管理项目及其元数据 (`routes/projectRoutes.ts`, `services/projectService.ts`)。项目数据存储在根目录 `projects/` 下。
    *   **工作流管理:** 项目内工作流的 CRUD 操作，存储为 JSON 文件 (`projects/<projectId>/workflows/*.json`)。
    *   **工作流执行:** 使用 `ExecutionEngine.ts` 进行拓扑排序和节点执行，处理输入输出。
    *   **API 服务:** 提供 RESTful API (`routes/`) 管理节点、项目、工作流。
    *   **WebSocket 服务:** 通过 `/ws` 端点 (`websocket/handler.ts`) 实时推送执行状态 (已重构为全局单例模式管理连接)。
*   **关键文件/目录:** `src/index.ts` (入口), `src/config.ts`, `src/nodes/`, `src/routes/`, `src/services/`, `src/websocket/`, `src/ExecutionEngine.ts`。

### 3.2 前端 (`apps/frontend-vueflow`)

*   **核心功能:** 提供基于 VueFlow 的图形化工作流编辑器界面。
    *   **工作流画布:** 可交互画布 (`components/graph/Canvas.vue`)，支持节点创建、连接、排列、缩放、平移等。
    *   **节点系统:** 支持多种节点类型 (`BaseNode.vue`)、拖拽创建 (`useDnd.ts`)、属性编辑 (侧边栏 `NodePanel.vue`)、节点分组 (`useWorkflowGrouping.ts`)。`BaseNode` 改进了对输入组件状态（如高度、编辑值）的处理和历史记录。
    *   **连接管理:** 处理节点连接创建和验证 (`useCanvasConnections.ts`)。
    *   **状态管理:** 重构后的核心状态管理，由 `useWorkflowManager` 封装核心逻辑，整合画布状态、节点操作、结构化历史记录等，并引入 `WorkflowInteractionCoordinator` 和 `WorkflowLifecycleCoordinator` 作为交互与生命周期协调器。Pinia (`stores/`) 的角色可能已调整。
    *   **交互增强:** 上下文菜单 (`ContextMenu.vue`)、键盘快捷键 (`useCanvasKeyboardShortcuts.ts`)。重构和增强后的撤销/重做功能，支持结构化历史记录，并通过侧边栏面板提供查看与跳转。
    *   **数据同步:** 通过 API (`api/`) 和 WebSocket (`useWebSocket.ts`, 已适配后端单例模式) 与后端交互，加载/保存工作流及接收实时更新。
    *   **项目管理:** 支持多项目/工作流视图 (`ProjectListView.vue`, `tabStore.ts`)。
    *   **SillyTavern 集成:** 存在相关服务和视图，可能用于角色卡片等功能。
    *   **代码结构:** `EditorView.vue` 已重构，逻辑拆分到多个独立的 composable 文件中。`composables` 目录已按功能分组（Canvas, Node, Group, Workflow, Editor）。
*   **关键文件/目录:** `src/main.ts` (入口), `src/components/graph/` (核心 UI), `src/composables/` (核心逻辑, 已分组), `src/stores/` (状态管理), `src/api/` (后端交互)。

### 3.3 共享包 (`packages`)

*   **`@comfytavern/types` (`packages/types`):**
    *   定义项目共享的 TypeScript 类型和 Zod 数据验证模式。
    *   涵盖节点定义、输入/输出、执行状态、WebSocket 消息、工作流结构（包括增强的组功能）、项目元数据、结构化历史记录条目等。
    *   被后端和前端 VueFlow 应用广泛使用。
*   **`@comfytavern/utils` (`packages/utils`):**
    *   计划用于提供项目共享的工具函数。
    *   目前为空，尚未实现具体功能。

## 4. 文档摘要 (`docs/` 目录, 排除 `整理` 和 `old`)

`docs` 目录包含了项目开发过程中的重要规划、规范、笔记和分析：

*   **架构与规划:** 项目重构计划 (`action-plan-project-refactor.md`), 后端架构计划 (`backend计划.md`), 前端迁移计划 (`frontend-vueflow计划.md`), **插件系统设计 (`plugin-system-plan.md`)**, 工程项目架构规划 (`project-architecture-plan.md`), **状态管理与历史记录重构 (`refactor-history-architecture-plan.md`, `refactor-workflowStore-plan.md`)**。
*   **规范:** 后端开发规范 (`backend规范.md`), 节点类型系统定义 (`node-types/node-types.md`, `node-types/node-types.zh.md`)。
*   **分析与笔记:** ComfyUI 学习笔记 (`comfyui笔记.md`), 前端 Composables 功能解释 (`composables-overview.md`), 前端图形组件分析 (`graph_components_report.md`), 历史记录系统实现分析 (`my-schema-flow-history-analysis.md`)。
*   **问题修复:** GroupIO 节点插槽渲染问题修复记录 (`fix-groupio-initial-slot-disappearance.md`)。

这些文档为理解项目的设计决策、演进过程和技术细节提供了宝贵的上下文。

## 5. 项目启动和构建 (Startup & Build)

*   **主入口:** 根目录 `server.ts`，使用 `bun run server.ts` 或 `bun run dev` 启动，负责管理后端和前端子进程。
*   **启动脚本:** 根目录提供 `start.bat` (Windows) 和 `start.sh` (Linux/macOS) 脚本，用于统一启动服务。
    *   支持 `dev` 参数切换开发/生产模式。
    *   支持 `vueflow` 参数选择 Vue Flow 前端 (默认或不带参数为 LiteGraph 前端)。
*   **`package.json` 脚本 (根目录):**
    *   `dev`: 开发模式启动 (默认 Vue Flow 前端)。
    *   `build`: 构建前后端。
    *   `start`: 生产模式启动。
    *   提供单独控制前后端开发、构建、启动的脚本 (`dev:frontend`, `build:backend` 等)。
*   **开发服务器端口:**
    *   前端 (Vite): http://localhost:5573 (代理 API 到后端)
    *   后端 (Elysia): http://localhost:3233