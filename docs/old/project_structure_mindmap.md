# ComfyTavern 项目结构脑图

```mermaid
mindmap
  root(ComfyTavern 项目)
    项目概览
      名称: comfytavern
      版本: 0.0.3
      描述: LLM驱动可视化创作引擎...
      目标: 面向创作者的引擎, 预设模板, 规则集, 上下文管理, 非线性对话, Agent助手...
      结构: Monorepo (Bun Workspaces)
      状态: 早期开发 (beta), Vue Flow 主要方向
    主要技术栈
      核心运行时: Bun
      语言: TypeScript (ESNext, strict)
      后端 (apps/backend): Elysia.js
      前端 (apps/frontend-vueflow)
        框架: Vue.js 3
        构建工具: Vite
        图形库: VueFlow (@vue-flow/core)
        状态管理: Pinia
        UI/样式: Tailwind CSS, DaisyUI
        路由: Vue Router
      共享包 (packages)
        @comfytavern/types: Zod
      数据存储: 文件系统 (JSON)
      通信: RESTful API, WebSocket
    核心模块
      后端 (apps/backend)
        核心功能
          节点管理 (NodeManager, NodeLoader, 动态加载)
          项目管理 (projectRoutes, projectService, CRUD, projects/ 目录)
          工作流管理 (项目内 CRUD, JSON 存储)
          工作流执行 (ExecutionEngine, 拓扑排序, 输入/输出处理)
          API 服务 (routes/, RESTful)
          WebSocket 服务 (websocket/handler, /ws, 实时状态)
        关键文件/目录: src/index.ts, src/config.ts, src/nodes/, src/routes/, src/services/, src/websocket/, src/ExecutionEngine.ts
        技术栈: Elysia.js, Bun, TypeScript
        API 结构
          GET /api/nodes (获取定义)
          GET /client-scripts/* (获取节点脚本)
          GET /api/workflows (列出全局工作流)
          /api/projects/{projectId}/... (项目及工作流 CRUD)
          POST /api/server/restart (尝试重启)
          /ws (WebSocket 端点)
      前端 (apps/frontend-vueflow)
        核心功能
          工作流画布 (Canvas.vue, VueFlow 核心库, 交互)
          节点系统 (BaseNode.vue, 输入控件, 拖拽创建 useDnd, 属性编辑 NodePanel, 分组 useWorkflowGrouping)
          连接管理 (useCanvasConnections, 验证 useNodeGroupConnectionValidation)
          状态管理 (Pinia stores/, workflowStore, nodeStore, projectStore, tabStore, executionStore)
          交互增强 (ContextMenu, 快捷键 useCanvasKeyboardShortcuts, 撤销/重做 useWorkflowHistory)
          数据同步 (API api/, WebSocket useWebSocket)
          项目管理 (ProjectListView, tabStore, useProjectManagement)
          SillyTavern 集成 (CharacterCardView, SillyTavernService)
        关键文件/目录: src/main.ts, src/App.vue, src/components/graph/, src/composables/, src/stores/, src/api/, src/views/
        技术栈: Vue 3, Vite, VueFlow, Pinia, Vue Router, Tailwind, DaisyUI, TypeScript, Axios
        组件 (src/components/)
          核心 (graph/)
            Canvas.vue (核心画布)
            StatusBar.vue (状态栏)
            TabBar.vue (标签页)
            输入控件 (inputs/ - BooleanToggle, CodeInput, NumberInput, ...)
            菜单 (menus/ - ContextMenu, NodeContextMenu, SlotContextMenu, ...)
            节点 (nodes/BaseNode.vue - 基础节点)
            侧边栏 (sidebar/ - NodePanel, NodePreviewPanel, SidebarManager, GroupIOEdit, ...)
          通用 (common/ - SuggestionDropdown, Tooltip)
          图标 (icons/)
        Composables (src/composables/)
          画布与交互 (useCanvasConnections, useCanvasKeyboardShortcuts, useDnd, useEdgeStyles, useNodeActions, useNodeResize, useNodeState, useWorkflowViewManagement, useContextMenuPositioning)
          工作流核心 (useWorkflowData, useWorkflowGrouping, useWorkflowHistory, useWorkflowManager, useNodeGroupConnectionValidation, useGroupInterfaceSync, useGroupIOSlots, useWorkflowInterfaceManagement)
          数据与通信 (useWebSocket, useProjectManagement)
          节点特定 (useNodeProps, useNodeClientScript, useUniqueNodeId)
        Stores (src/stores/)
          useWorkflowStore (核心协调器, 整合 Composables)
          useExecutionStore (执行状态管理)
          useNodeStore (节点定义加载/管理)
          useTabStore (标签页状态管理)
          useProjectStore (项目数据管理)
          useThemeStore (主题/布局状态)
          (useCounterStore - 示例)
        Utils (src/utils/)
          api.ts (useApi 封装 Axios)
          deepClone.ts (JSON 实现)
          nodeUtils.ts (getNodeType)
          textUtils.ts (measureTextWidth, 字体常量)
          urlUtils.ts (动态 URL 生成 - API, WS, Backend)
          workflowTransformer.ts (前后端格式转换 - VueFlow <-> CoreWorkflow)
        Router (src/router/)
          规则: /, /projects, /characters, /about, /projects/:projectId/editor/:workflowId?
          视图: HomeView, ProjectListView, CharacterCardView, AboutView, EditorView
          模式: WebHistory
          守卫: EditorView (进入前加载项目数据)
          懒加载: AboutView
        API (src/api/)
          workflow.ts (listWorkflowsApi, loadWorkflowApi, saveWorkflowApi, deleteWorkflowApi)
          使用 useApi 工具
          错误处理, 日志, 类型安全
        Services (src/services/)
          SillyTavernService.ts (加载本地角色卡 - PNG/JSON, 非实时 API)
        Types (src/types/)
          workflowTypes.ts (WorkflowData, TabWorkflowState, WorkflowStateSnapshot, HistoryState, EdgeStyleProps, ...)
          SillyTavern.ts
          声明文件 (.d.ts - png-chunk-text, png-chunks-extract)
        Views (src/views/)
          EditorView (核心编辑器界面, 集成 Canvas, Sidebar, StatusBar)
          ProjectListView (项目列表展示与创建)
          HomeView, AboutView, CharacterCardView (辅助页面)
          SideBar.vue (可重用侧边栏组件)
        入口与根组件
          main.ts (初始化 Vue, Pinia, Router, 导入全局 CSS)
          App.vue (根容器, RouterView, 初始化全局状态, 主题/项目切换监听, 启动画面)
      共享包 (packages)
        @comfytavern/types (packages/types)
          用途: 共享 TS 类型和 Zod 验证模式
          核心内容: node.ts (NodeDefinition, Input/OutputDefinition, ExecutionStatus, WebSocketMessageType, ...), schemas.ts (Zod 模式: WorkflowNodeSchema, WorkflowEdgeSchema, WorkflowObjectSchema, ProjectMetadataSchema, ...)
        @comfytavern/utils (packages/utils)
          用途: 共享工具函数 (目前为空)
    文档 (docs/ - 排除整理/old)
      架构与规划 (action-plan-project-refactor, backend计划, frontend-vueflow计划, plugin-system-plan, project-architecture-plan, refactor-history-architecture-plan, refactor-workflowStore-plan)
      规范 (backend规范, node-types.md/zh.md)
      分析与笔记 (comfyui笔记, composables-overview, graph_components_report, my-schema-flow-history-analysis)
      问题修复 (fix-groupio-initial-slot-disappearance)
    启动与构建
      主入口: server.ts (管理前后端子进程)
      启动脚本: start.bat / start.sh (支持 dev/prod, vueflow 参数)
      package.json 脚本 (根目录): dev, build, start, dev:frontend, build:backend, start:frontend, start:backend, ...
      开发服务器端口
        前端 (Vite): 5573 (代理 API/WS 到后端)
        后端 (Elysia): 3233