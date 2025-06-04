# ComfyTavern - 前端 (VueFlow)

本项目是 [ComfyTavern](../../README.md) 基于 [VueFlow](https://vueflow.dev/) 的前端实现，使用 Vue 3, Vite, 和 TypeScript 构建。它为用户提供了强大的可视化节点编辑器，用于创建、编排和管理 AI 工作流，并致力于将这些工作流封装成易于使用的交互式应用面板。

## 核心功能

-   **可视化节点编辑器**:
    -   基于 VueFlow，提供流畅的节点拖拽、连接、删除等操作。
    -   支持节点参数的动态配置和输入。
    -   工作流的保存、加载和导入/导出。
-   **节点管理**:
    -   侧边栏节点库，分类展示可用节点。
    -   节点搜索和拖拽添加功能。
    -   节点预览面板，显示节点详细信息和配置。
-   **工作流与项目管理**:
    -   标签页系统，支持同时编辑多个工作流。
    -   项目列表视图，方便管理和切换不同项目。
    -   工作流信息面板，展示和编辑当前工作流的元数据。
-   **实时交互**:
    -   通过 WebSocket 与后端服务实时通信。
    -   同步工作流执行状态、接收节点输出和错误信息。
-   **用户界面**:
    -   使用 Tailwind CSS 构建，支持亮色/暗色主题切换。
    -   响应式布局，提供一致的桌面端体验。

## 技术栈

-   **主要框架**: [Vue 3](https://vuejs.org/)
-   **构建工具**: [Vite](https://vitejs.dev/)
-   **语言**: [TypeScript](https://www.typescriptlang.org/)
-   **节点编辑器**: [VueFlow](https://vueflow.dev/)
-   **状态管理**: [Pinia](https://pinia.vuejs.org/)
-   **CSS 框架**: [Tailwind CSS](https://tailwindcss.com/)

## 项目结构 (src/)

-   `components/`: 通用 Vue 组件和特定功能组件（如节点、输入控件、菜单、面板等）。
-   `composables/`: Vue Composition API 函数 (Hooks)，封装可复用逻辑。
-   `stores/`: Pinia 状态管理模块（如节点、工作流、UI、项目等）。
-   `views/`: 页面级组件（如编辑器主视图、主页、项目列表等）。
-   `router/`: Vue Router 路由配置。
-   `api/`: 与后端 API 交互的函数。
-   `utils/`: 通用工具函数。
-   `assets/`: 静态资源。
-   `main.ts`: 应用入口文件。

## 运行与开发

前端服务通常作为整个 ComfyTavern 应用的一部分启动。请参考项目根目录的 [README.md](../../README.md#运行) 中的说明来启动开发或生产模式。

开发模式下，前端服务通常监听在 `http://localhost:5573/`。

## IDE推荐与类型支持

-   **IDE**: [VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (请禁用 Vetur)。
-   **类型检查**: 使用 `vue-tsc` 进行 `.vue` 文件的类型检查。
   为了在 TypeScript 中正确处理 `.vue` 文件的导入，编辑器需要 Volar 插件。
