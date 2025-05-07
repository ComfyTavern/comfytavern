# ComfyTavern 前端应用 (apps/frontend-vueflow) 概览

本文档总结了 `apps/frontend-vueflow` 目录下的前端应用的结构、功能和技术栈。

## 主要目录结构和关键文件/目录用途

```
apps/frontend-vueflow/
├── public/             # 静态资源，会被直接复制到构建输出目录
├── src/                # 应用源代码
│   ├── api/            # 后端 API 请求封装
│   ├── assets/         # 静态资源 (CSS, 图片等)
│   ├── components/     # Vue 组件
│   │   ├── common/     # 通用 UI 组件
│   │   ├── graph/      # VueFlow 图形界面核心组件 (画布, 节点, 边, 菜单, 侧边栏)
│   │   └── icons/      # 图标组件
│   ├── composables/    # Vue Composition API 可组合函数 (核心逻辑, 已按功能分组: Canvas, Node, Group, Workflow, Editor)
│   ├── router/         # Vue Router 路由配置
│   ├── services/       # 与外部服务交互 (如 SillyTavern)
│   ├── stores/         # Pinia 状态管理模块
│   ├── types/          # TypeScript 类型定义
│   ├── utils/          # 通用工具函数
│   ├── views/          # 页面级视图组件
│   ├── App.vue         # 根组件
│   └── main.ts         # 应用入口文件
├── .gitignore          # Git 忽略配置
├── index.html          # HTML 入口文件
├── package.json        # 项目元数据和依赖管理
├── postcss.config.js   # PostCSS 配置 (用于 Tailwind CSS)
├── tailwind.config.js  # Tailwind CSS 配置
├── tsconfig.app.json   # TypeScript 应用编译配置
├── tsconfig.json       # TypeScript 根配置
├── vite.config.ts      # Vite 构建和开发服务器配置
└── ...                 # 其他配置文件 (测试, 类型检查等)
```

## 核心功能概述

该前端应用是一个基于 VueFlow 的图形化工作流编辑器界面，主要功能包括：

*   **URL 加载与项目管理**: 支持通过 URL 加载工作流，并提供了项目元数据更新接口。优化了前端视图 (`HomeView`, `EditorView`) 和路由，提升用户体验。
*   **工作流画布**: 提供一个可交互的画布 (`Canvas.vue`)，用户可以在上面创建、连接和排列节点。
    *   支持缩放、平移、小地图、背景网格等。
    *   通过 `@vue-flow/core`, `@vue-flow/background`, `@vue-flow/controls`, `@vue-flow/minimap` 实现。
*   **节点系统**:
    *   提供多种类型的节点 (`BaseNode.vue` 及 `components/graph/inputs/` 下的各种输入组件)。`BaseNode` 负责渲染节点，并集成了对输入组件状态（如高度、编辑值）的更新处理及历史记录。
    *   支持节点的拖拽创建 (DnD - `useDnd.ts`)、连接、删除、编辑属性。
    *   支持节点分组 (`useWorkflowGrouping.ts`, `GroupIOEdit.vue`)，并增强了组功能（如 creationMethod, referencedWorkflows）。
    *   节点属性编辑通过侧边栏 (`SidebarManager.vue`, `NodePanel.vue`) 实现。
*   **连接管理**:
    *   处理节点之间的连接创建和验证 (`useCanvasConnections.ts`, `useNodeGroupConnectionValidation.ts`)。
    *   自定义边样式 (`useEdgeStyles.ts`)。
*   **状态管理**:
    *   使用 Pinia (`stores/`) 进行状态管理。核心工作流状态和逻辑通过 `useWorkflowManager` 集中管理，它整合了画布状态、节点操作（添加、移动等）、结构化历史记录以及节点组件状态存储。
    *   **历史记录管理**: 引入了交互协调器 (`WorkflowInteractionCoordinator`) 和生命周期协调器 (`WorkflowLifecycleCoordinator`)，它们与 `useWorkflowManager` 协同工作，统一处理画布交互、生命周期事件，并负责触发和生成基于结构化对象的历史记录。`useWorkflowManager` 负责管理这些历史记录，确保状态变更的可追溯性。
*   **交互增强**:
    *   上下文菜单 (`ContextMenu.vue`, `NodeContextMenu.vue`, `SlotContextMenu.vue`)。
    *   键盘快捷键 (`useCanvasKeyboardShortcuts.ts`)，修复了相关 bug。
    *   节点拖拽和缩放 (`useNodeResize.ts`)。
    *   新增历史记录侧边面板，允许查看、跳转历史记录项，并执行撤销/重做。
*   **数据持久化与同步**:
    *   通过 API (`api/workflow.ts`) 与后端交互，加载和保存工作流。
    *   通过 WebSocket (`useWebSocket.ts`, 已适配后端全局单例模式) 实现实时同步或执行状态更新，修复了历史记录操作时 WebSocket 连接异常的问题。
*   **项目管理**: 支持多项目或多工作流管理 (`useProjectManagement.ts`, `ProjectListView.vue`, `tabStore.ts`)。
*   **历史记录功能**: 提供了完整的撤销/重做功能。通过新增的历史记录侧边面板，用户可以方便地查看历史记录项、跳转到特定状态，并执行撤销/重做操作。
*   **与 SillyTavern 集成**: 存在与 SillyTavern 相关的服务 (`services/SillyTavernService.ts`) 和视图 (`CharacterCardView.vue`)，可能用于角色卡片或相关功能。
*   **UI/UX 改进**: 添加了 `MarkdownRenderer` 组件，改进了 `Tooltip` 组件，并优化了工作流保存流程 (`promptAndSaveWorkflow`)。
*   **插件系统**: 新增了插件系统设计文档和规划，为未来的功能扩展奠定基础。
*   **代码结构优化**: `EditorView.vue` 的核心逻辑已被重构并拆分到 `composables/editor/` 目录下的多个独立 composable 文件中，提高了可维护性。`composables` 目录整体按功能进行了分组。

## 主要技术栈、框架和依赖

*   **核心框架**: Vue.js 3
*   **图形库**: VueFlow (`@vue-flow/core`, `@vue-flow/background`, `@vue-flow/controls`, `@vue-flow/minimap`)
*   **状态管理**: Pinia
*   **路由**: Vue Router
*   **UI 库/样式**: Tailwind CSS, DaisyUI, Heroicons (`@heroicons/vue`)
*   **构建工具**: Vite
*   **语言**: TypeScript
*   **HTTP 请求**: Axios
*   **测试**: Vitest, Vue Test Utils, jsdom
*   **其他**: `@vueuse/core` (工具函数集), `klona` (深拷贝), `uuid` (生成唯一 ID), `png-chunk-text`, `png-chunks-extract` (可能用于处理 PNG 元数据)

## 构建和启动方式

*   **开发模式启动**: 在项目根目录执行 `bun run dev` (会同时启动前后端)，或在 `apps/frontend-vueflow` 目录下单独执行 `bun run dev` (或 `vite`) 启动前端开发服务器。前端开发服务器默认监听从 `../../config.json` 读取的端口，并通过 Vite 配置代理 API 和 WebSocket 请求到后端端口 (默认为 `3233`)。
*   **构建**: 在 `apps/frontend-vueflow` 目录下执行 `bun run build`。此命令会先进行类型检查 (`vue-tsc --build`)，然后使用 Vite (`vite build`) 进行生产环境构建。
*   **预览构建结果**: 在 `apps/frontend-vueflow` 目录下执行 `bun run preview` (使用 `vite preview`)。
*   **单元测试**: 在 `apps/frontend-vueflow` 目录下执行 `bun run test:unit` (使用 `vitest`)。