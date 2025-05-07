# ComfyTavern 前端 (frontend-vueflow) 路由分析报告 (`src/router`)

## 1. 目录结构概述

`apps/frontend-vueflow/src/router` 目录结构非常简洁，仅包含一个核心路由配置文件：

```
apps/frontend-vueflow/src/router/
└── index.ts       # 主要的路由定义和配置
```

## 2. 主要路由规则

以下是 `index.ts` 中定义的主要路由规则及其对应的视图组件：

| 路径 (Path)                             | 路由名称 (Name) | 视图组件 (Component)        | 备注                                     |
| :-------------------------------------- | :-------------- | :-------------------------- | :--------------------------------------- |
| `/`                                     | `home`          | `HomeView`                  | 应用的根路径，显示主页。                 |
| `/projects`                             | `projects`      | `ProjectListView`           | 显示项目列表。                           |
| `/characters`                           | `characters`    | `CharacterCardView`         | 显示角色卡片视图。                       |
| `/about`                                | `about`         | `../views/AboutView.vue`    | 关于页面，使用路由懒加载。               |
| `/projects/:projectId/editor/:workflowId?` | `Editor`        | `EditorView`                | 编辑器视图，需要 `projectId` 参数，`workflowId` 参数是可选的，用于加载特定工作流。 |

## 3. 路由守卫与配置

*   **路由模式:** 使用 `createWebHistory`，这是基于 HTML5 History API 的模式，URL 不带 `#`。
*   **编辑器路由守卫 (`beforeEnter`):**
    *   在进入 `/projects/:projectId/editor/:workflowId?` 路由之前触发。此路由需要 `projectId` 参数，`workflowId` 参数是可选的。
    *   **目的:** 确保在进入编辑器视图前，对应的项目数据 (`projectId`) 已经被加载。
    *   **逻辑:**
        1.  从路由参数中获取 `projectId`。
        2.  检查 `projectId` 是否存在。如果不存在，或者项目加载失败/发生错误，则重定向到 `home` 路由。
        3.  在守卫内部使用 `useProjectStore` 获取项目状态管理实例 (注意 Pinia 实例需在应用入口创建)。
        4.  检查请求的 `projectId` 是否与当前已加载的项目 ID 相同。如果相同，则直接允许导航，避免重复加载。
        5.  如果不同，则调用 `projectStore.loadProject(projectId)` 异步加载项目数据。
        6.  根据加载结果决定是否允许导航或重定向。守卫中包含控制台日志输出 (debug, info, error) 以便调试。
*   **懒加载:** `/about` 路由使用了 `import()` 语法进行组件懒加载，这意味着对应的组件代码 (`AboutView.vue`) 只会在用户首次访问该路由时才会被下载和解析，有助于优化初始加载性能。