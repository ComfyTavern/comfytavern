# ComfyTavern 项目概览

## 1. 项目简介 (ComfyTavern)

ComfyTavern 是一个面向创作者和最终用户的 AI 创作与应用平台。它旨在打破 AI 技术的使用壁垒，让复杂 AI 功能的构建与体验变得简单直观。

**核心价值主张与目标用户：**

- **对于创作者**：ComfyTavern 提供了一个基于 [VueFlow](https://vueflow.dev/) 的强大可视化节点编辑器。创作者可以利用这个直观的画布，通过拖拽、连接和配置节点，灵活地编排复杂的 AI 工作流。平台支持丰富的内置节点和易于扩展的自定义节点能力，满足多样化的创作需求。
- **对于最终用户**：ComfyTavern 的核心魅力在于其能够将创作者构建的复杂工作流，封装成易于使用、面向特定场景的**交互式应用面板**（或称“迷你应用”）。这些应用面板（例如：AI 聊天机器人、互动故事生成器、自动化数据处理工具、创意内容辅助等）为最终用户提供了直接、友好的交互界面，隐藏了底层工作流的复杂性。用户无需理解节点逻辑，即可直接体验和使用强大的 AI 功能。

**主要用户体验方向：**

ComfyTavern 特别关注最终用户在各种设备上（尤其是移动端）的“即开即用”体验。目标是让 AI 功能像普通应用一样触手可及，而不仅仅停留在开发者或技术爱好者的节点编辑层面。

**平台特性：**

- **双重特性**：既是赋能创作者的强大 AI 工作流编排工具，也是服务最终用户的、易于上手的 AI 应用运行平台。
- **扩展性**：平台兼具开发者友好的扩展性，支持自定义节点开发、插件系统集成和应用面板开发框架。

ComfyTavern 致力于成为连接 AI 技术与广泛应用的桥梁，让每个人都能轻松驾驭和享受 AI 带来的便利与乐趣。

## 2. 核心架构与主要模块

ComfyTavern 项目采用现代化的 Monorepo 结构进行组织，主要代码库分为 `apps/`（包含独立的前端和后端应用程序）和 `packages/`（包含项目内共享的库）。其核心设计理念围绕着高度的模块化和扩展性，特别是通过插件系统、统一文件资产管理 (FAM) 和应用面板 SDK (Panel SDK) 来实现。

```mermaid
graph TD
    A[用户] --> B(前端应用: apps/frontend-vueflow);
    B --> C{后端API: apps/backend};
    C --> D[数据库: SQLite];
    C --> E[AI工作流执行引擎];
    C --> F[插件系统: PluginLoader/Manager];
    C --> G[文件资产管理: FAM Service];
    B <--> G;
    H[共享包: packages/* <br/> (@comfytavern/types, @comfytavern/utils, @comfytavern/panel-sdk)] --> B;
    H --> C;
    B --> I[应用面板 SDK: Panel SDK];
    I --> B;
    F --> C;
    F --> B;
    J[开发文档体系: DesignDocs/整理/Development/*] -.-> K((开发者));
    subgraph 核心服务
        C
        E
        F
        G
    end
    subgraph 用户交互层
        B
        I
    end
    subgraph 数据存储
        D
    end
    classDef mainNode fill:#f9f,stroke:#333,stroke-width:2px;
    class A,K mainNode;
```

以下是项目主要组成部分的详细概览：

### 2.1. 前端应用 (`apps/frontend-vueflow`)

前端是 ComfyTavern 的用户交互核心，负责提供功能丰富且友好的图形化界面。

- **核心职责**:
  - **可视化编排**: 提供基于 VueFlow 的节点编辑器。
  - **UI/UX**: 负责项目管理、应用面板渲染、文件管理、插件管理和各类设置界面。
  - **状态管理**: 使用 Pinia 集中管理应用状态，如用户认证、UI 状态、工作流数据等。
  - **后端通信**: 通过 HTTP (Axios) 和 WebSocket 与后端服务高效通信，处理数据持久化和实时状态更新。
- **架构特点**:
  - **组件化**: UI 被拆分为可复用的 Vue 组件，按功能组织在 `components/` 目录下。
  - **逻辑复用**: 广泛使用 Composition API 函数 (Composables) 封装和复用响应式逻辑，如画布交互 (`useCanvasInteraction`)、工作流管理 (`useWorkflowManager`) 和 WebSocket 通信 (`useWebSocket`)。
  - **中心化状态**: Pinia Stores (`stores/`) 作为状态的单一事实来源，每个 Store 负责特定领域（如 `authStore`, `workflowStore`, `fileManagerStore`）。
  - **清晰分层**: 严格分离视图 (`views/`)、API 客户端 (`api/`)、服务 (`services/`) 和工具函数 (`utils/`)，确保代码结构清晰。
- **详细概览**: [`DesignDocs/整理/Frontend/Overview.md`](../Frontend/Overview.md)

### 2.2. 后端服务 (`apps/backend`)

后端是 ComfyTavern 的业务逻辑和数据处理中心，为前端提供强大的支持。

- **核心职责**:
  - **API 服务**: 提供基于 Elysia 的高性能 HTTP API 和 WebSocket 服务。
  - **工作流执行**: 核心的执行引擎负责解析、调度和执行 AI 工作流。
  - **数据持久化**: 通过 Drizzle ORM 与 SQLite 数据库交互，管理用户、项目、工作流等数据。
  - **核心服务**: 实现插件系统、文件资产管理 (FAM)、用户认证、LLM 配置管理等核心服务。
- **架构特点**:
  - **高性能框架**: 采用基于 Bun 的 Elysia 框架，保证了极高的 API 响应速度。
  - **模块化设计**: 功能被组织为独立的服务 (`services/`) 和路由模块 (`routes/`)，通过中间件 (`middleware/`) 处理通用逻辑（如认证）。
  - **可扩展节点系统**: 节点定义清晰，易于扩展，支持自定义执行逻辑和客户端脚本。
  - **实时通信**: 通过 WebSocket Manager 实现与前端的双向实时通信，用于推送执行状态和结果。
- **详细概览**: [`DesignDocs/整理/Backend/Overview.md`](../Backend/Overview.md)

### 2.3. 共享包 (`packages/`)

`packages/` 目录存放跨前后端复用的模块，是保障项目一致性和代码复用性的关键。

- **`@comfytavern/types`**:
  - **职责**: 项目的基石，提供统一的 TypeScript 类型定义和 Zod 验证 schemas。
  - **价值**: 确保了前端、后端及各模块间数据结构的一致性和类型安全，是前后端数据契约的实现。
- **`@comfytavern/utils`**:
  - **职责**: 提供一系列通用的、可在前后端运行的工具函数。
  - **核心功能**: 包含了工作流数据在不同格式（VueFlow、存储、执行）之间转换的核心逻辑 (`workflow-preparer.ts`)，以及节点组的扁平化处理。
- **`@comfytavern/panel-sdk`**:
  - **职责**: 一个专为应用面板开发的 SDK，封装了面板 (IFrame) 与主应用 (Host) 之间的 `postMessage` 通信。
  - **价值**: 为面板开发者提供了简洁、类型安全的 API，使其能轻松调用宿主功能（如执行工作流、文件操作）和订阅事件，极大简化了面板应用的开发。
- **详细概览**: [`DesignDocs/整理/Packages/Overview.md`](../Packages/Overview.md)

## 3. 技术选型概要

ComfyTavern 项目选用了一系列现代、高效的技术栈，以支持其功能实现和长期发展：

- **运行时 & 核心工具链**:
  - **Bun**: 作为 JavaScript/TypeScript 运行时、包管理器、测试运行器和内置打包器，提供卓越的性能和一体化的开发体验。
- **主要编程语言**:
  - **TypeScript**: 全面采用 TypeScript 进行开发，以增强代码的类型安全、可读性和可维护性。
- **前端 (UI & 交互)**:
  - **Vue 3**: 核心 UI 框架，充分利用其 Composition API 和 `<script setup>` 语法。
  - **Vite**: 前端构建工具，提供快速的开发服务器和优化的生产构建。
  - **VueFlow**: 用于构建可视化节点编辑器的核心库。
  - **Pinia**: 官方推荐的 Vue 状态管理库。
  - **Tailwind CSS**: 功能类优先的 CSS 框架，用于快速构建界面。
  - **Vue Router**: 官方路由管理器，用于单页应用导航。
- **后端 (API & 业务逻辑)**:
  - **Elysia**: 基于 Bun 构建的高性能、轻量级 TypeScript Web 框架。
  - **Drizzle ORM**: 类型安全的 SQL 查询构建器和 ORM，默认配合 SQLite 使用。
- **代码质量与规范**:
  - **WebHint / ESLint**: 用于代码风格检查和潜在错误发现。
  - **Prettier**: 用于代码自动格式化，保持代码风格一致。

## 4. 开发与协作

项目为开发者提供了一套完整的开发指南，旨在确保开发效率和项目质量。

- **环境搭建**: 提供了简化的启动脚本 (`bun run dev`)，可自动处理环境配置、依赖安装和数据库初始化，实现快速启动。
- **编码规范**: 强调代码格式化 (Prettier)、类型检查 (TypeScript) 和代码风格 (WebHint)。规范了 TypeScript 和 Vue 3 的使用，并强制要求使用中文注释。
- **测试策略**: 采用 Vitest 作为主要测试框架，支持单元测试、组件测试和集成测试，并鼓励高水平的测试覆盖率。
- **部署**: 提供了一键启动脚本用于快速本地部署，并为生产环境提供了使用 PM2 或 Docker 的进阶部署建议。
- **详细概览**: [`DesignDocs/整理/Development/Overview.md`](../Development/Overview.md)

## 5. 项目目标与愿景

**核心目标：**

1.  **赋能创作者**：为 AI 内容和应用创作者提供一个强大、灵活且易于上手的可视化工作流编排工具，使他们能够轻松构建、测试和迭代复杂的 AI 应用逻辑，并通过**插件系统**无限扩展其能力。
2.  **服务最终用户**：将这些复杂的 AI 工作流转化为简单直观、面向特定场景的“应用面板”，让不具备技术背景的最终用户也能轻松享受到 AI 带来的便利和乐趣，特别是在移动设备上。这得益于**应用面板 SDK** 和**统一文件资产管理**的支撑。

**项目愿景：**

我们期望 ComfyTavern 能够发展成为一个充满活力的 AI 创作与应用生态系统。未来的发展方向包括构建更丰富的节点生态、引入 AI 辅助编排能力、支持更广泛的应用面板场景、建设强大的社区，并最终集成和构建先进的 Agent 智能体生态系统，让 AI 真正融入每个人的数字生活。

## 6. 如何开始 / 进一步阅读

无论您是新加入项目的开发者、潜在的贡献者，还是对 ComfyTavern 技术细节感兴趣的读者，以下导航将帮助您快速入门和深入了解：

- **快速了解项目整体**:

  - 首先，建议您完整阅读本文档 ([`DesignDocs/整理/ProjectOverview.md`](./ProjectOverview.md))，它为您提供了项目的顶层视图。

- **参与开发**:

  - **环境搭建**: 请查阅 [`DesignDocs/整理/Development/EnvironmentSetup.md`](../Development/EnvironmentSetup.md) 来配置您的本地开发环境。
  - **开发流程与规范**: 通读 [`DesignDocs/整理/Development/Overview.md`](../Development/Overview.md) 以了解完整的开发流程、编码标准、测试策略和部署指南。

- **深入特定模块**:

  - 对**前端架构和实现**感兴趣，请从 [`DesignDocs/整理/Frontend/Overview.md`](../Frontend/Overview.md) 开始。
  - 对**后端服务和逻辑**感兴趣，请从 [`DesignDocs/整理/Backend/Overview.md`](../Backend/Overview.md) 开始。
  - 对**项目共享库（类型定义、工具函数）**感兴趣，请从 [`DesignDocs/整理/Packages/Overview.md`](../Packages/Overview.md) 开始。
  - 对**未来核心的 Agent 智能体架构**感兴趣，请深入阅读 [`DesignDocs/architecture/agent_architecture_consolidated.md`](../../architecture/agent_architecture_consolidated.md)。
  - 对**统一文件资产管理 (FAM)** 感兴趣，请深入阅读 [`docs/guides/file-asset-management-guide.md`](../../../docs/guides/file-asset-management-guide.md)。
  - 对**插件系统** 感兴趣，请深入阅读 [`DesignDocs/architecture/unified-plugin-and-tool-architecture.md`](../../architecture/unified-plugin-and-tool-architecture.md)。
  - 对**应用面板 SDK** 感兴趣，请深入阅读 [`DesignDocs/整理/Packages/PanelSDK.md`](../Packages/PanelSDK.md)。

- **项目源码**:
  - 您可以直接在当前项目根目录下浏览和研究源代码。
