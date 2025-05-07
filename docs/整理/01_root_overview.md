# ComfyTavern 项目根目录概览

## 1. 项目基本信息

*   **名称 (Name):** comfytavern
*   **版本 (Version):** 0.0.3
*   **描述 (Description):** 一个面向创作者的LLM驱动可视化创作引擎，基于节点画布，旨在帮助创作者通过直观的拖拽界面设计复杂的AI交互体验（如聊天机器人、视觉小说、文字RPG）。(来自 README.md)
*   **结构 (Structure):** Monorepo (使用 Bun Workspaces 管理 `apps/*` 和 `packages/*`)
*   `packages/`: 存放共享代码，如 `packages/types`, `packages/utils`。
*   `docs/`: 项目文档和报告，包括 `docs/整理/` 子目录。

## 2. 主要技术栈和依赖

*   **核心运行时:** Bun
*   **语言:** TypeScript (ESNext 模块, `strict` 模式)
*   **后端:** Bun + Elysia (位于 `apps/backend`)
*   **前端:**
    *   Vue 3 + TypeScript + Vite
    *   节点编辑器: Vue Flow (位于 `apps/frontend-vueflow`) 是当前主要的开发方向。LiteGraph.js (位于 `apps/frontend`) 处于维护或评估状态。
*   **主要依赖 (根目录 `package.json`):**
    *   `@comfyorg/litegraph`: LiteGraph.js 核心库 (ComfyUI 分支)
    *   `codemirror`, `vue-codemirror`, `@codemirror/*`: 代码编辑器组件
    *   `lodash`: 工具库
    *   `zod`: Schema 验证
    *   `sanitize-filename`: 文件名清理
*   **开发依赖 (根目录 `package.json`):**
    *   `typescript`
    *   `@types/bun`

## 3. 项目启动和构建方式

*   **主入口:** `server.ts` (使用 `bun run server.ts` 或 `bun run dev` 启动)，负责管理前后端子进程。
*   **启动脚本:** 根目录提供 `start.bat` (Windows) 和 `start.sh` (Linux/macOS) 脚本，用于统一启动前后端服务。
    *   `.\start.bat` / `./start.sh`: 生产模式启动，使用 LiteGraph 前端。
    *   `.\start.bat dev` / `./start.sh dev`: 开发模式启动，使用 LiteGraph 前端。
    *   `.\start.bat vueflow` / `./start.sh vueflow`: 生产模式启动，使用 Vue Flow 前端。
    *   `.\start.bat dev vueflow` / `./start.sh dev vueflow`: 开发模式启动，使用 Vue Flow 前端。
*   **`package.json` 脚本:**
    *   `dev`: 运行 `server.ts` (开发模式)。
    *   `build`: 构建前后端 (`bun run build:frontend && bun run build:backend`)。
    *   `start`: 生产模式启动 (先启动后端，再构建并预览前端)。
    *   `dev:frontend`, `dev:backend`, `build:frontend`, `build:backend`, `start:frontend`, `start:backend`: 分别控制前后端的开发、构建和启动。
*   **开发服务器端口:**
    *   前端: http://localhost:5573
    *   后端: http://localhost:3233

## 4. 项目目标和简介 (来自 README.md)

*   **目标:** 成为一个面向创作者的LLM驱动可视化创作引擎。
*   **核心功能:**
    *   提供基于节点画布的界面，用于设计复杂的AI交互体验。
    *   支持构建聊天机器人、视觉小说、文字RPG等。
    *   提供预设模板和规则集，简化创作流程。
    *   内置上下文管理和非线性对话功能。
    *   支持通过内置Agent助手自定义节点和界面。
*   **状态:** 项目处于早期开发阶段 (beta)，Vue Flow 是主要的节点编辑器开发方向，LiteGraph.js 处于维护或评估状态。