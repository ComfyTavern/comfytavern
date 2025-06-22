# 项目改造实施计划：引入项目总览并修复状态恢复 (v3)

## 1. 核心目标

1.  **重构项目入口**: 改变当前“选择项目后直接进入编辑器”的流程，引入一个可扩展的“项目总览面板”作为项目的第一入口。
2.  **实现URL与状态双向同步**: 修复并实现编辑器在页面刷新或直接访问时，能根据URL中的工作流ID正确恢复会话；同时，在编辑器内切换标签页时，URL能同步更新。
3.  **实现会话持久化**: 实现单浏览器窗口的标签页会话持久化，当用户关闭并重新打开浏览器时，能恢复上次打开的标签页布局。
4.  **明确并发策略**: 明确并实施在多浏览器窗口环境下的非同步并发处理策略，以保证数据安全和行为的可预测性。

## 2. 计划总览 (Mermaid 图)

```mermaid
graph TD
    subgraph "新流程"
        F[用户在 ProjectListView 点击项目] --> G[调用 openProject(projectId)];
        G --> H[router.push({ name: 'ProjectRoot', params: { projectId } })];
        H --> I[触发 /project/:projectId 路由守卫];
        I -- 加载项目 --> J[ProjectLoader 组件];
        J -- 读取 project.preferredView --> K{路由分发};
        K -- 'dashboard' 或默认 --> L[跳转到 /project/:id/dashboard];
        L --> M[显示 ProjectDashboardView];
        M -- 点击进入编辑器 --> N[跳转到 /project/:id/editor];
        
        subgraph "编辑器状态恢复、持久化与双向同步"
            O[应用启动] --> P[tabStore从localStorage恢复标签页引用];
            N -- 首次加载或刷新 --> Q[EditorView onMounted];
            Q -- URL中有:workflowId? --> R[store.loadAndOpenWorkflow(id)];
            R --> S[打开或切换到指定工作流标签页];
            Q -- URL中无:workflowId --> T[恢复上次激活的标签页或打开新标签页];
            
            U[用户在 TabBar 点击标签页] --> V[tabStore.setActiveTab(id)];
            V -- 触发 Watcher (在EditorView中) --> W[router.replace({ params: { workflowId: newId } })];
            W -- 更新URL --> X[URL与激活标签页同步];
        end

        K -- 'editor' (兼容旧项目) --> N;
    end
```

## 3. 分步实施计划

### 第一阶段：前端路由系统 (`router/index.ts`)

1.  **修改现有编辑器路由**:
    *   将其 `path` 从 `/projects/:projectId/editor/:workflowId?` 更改为 `editor/:workflowId?` (相对路径)。
    *   将其 `name` 从 `'Editor'` 更改为 `'ProjectEditor'` 以提高清晰度。
    *   **移除**其 `beforeEnter` 路由守卫，项目加载的职责将上移。

2.  **创建新的项目根路由 (父路由)**:
    *   添加一个新路由作为所有项目内页面的容器。
    *   `path: '/project/:projectId'`
    *   `name: 'ProjectRoot'`
    *   此路由将渲染一个中间加载组件 `ProjectLoader.vue`。
    *   **添加 `beforeEnter` 路由守卫**: 此守卫将调用 `projectStore.loadProject(projectId)`，并在失败时重定向。

3.  **创建子路由**:
    *   将修改后的编辑器路由 (`'ProjectEditor'`) 移动到 `ProjectRoot` 路由的 `children` 数组中。
    *   在 `ProjectRoot` 路由下，添加另一个子路由 `'ProjectDashboard'`，路径为 `dashboard`，组件指向 `ProjectDashboardView.vue`。

### 第二阶段：创建新组件

1.  **创建 `ProjectLoader.vue`**:
    *   一个轻量级的分发组件。
    *   在其 `onMounted` 钩子中，它会检查 `projectStore.currentProjectMetadata.preferredView` 的值，然后使用 `router.replace()` 将用户导航到正确的子路由 (`'ProjectDashboard'` 或 `'ProjectEditor'`)。

2.  **创建 `ProjectDashboardView.vue`**:
    *   新的项目总览UI。
    *   从 `projectStore` 获取并显示项目信息。
    *   包含一个明确的 `<router-link>` 指向 `'ProjectEditor'` 路由。
    *   为未来的功能（如 Agent、场景等）预留UI占位符。

### 第三阶段：修改现有逻辑

1.  **修改 `useProjectManagement.ts`**:
    *   在 `openProject` 和 `createNewProject` 函数中，将 `router.push` 的目标从 `{ name: 'Editor', ... }` 修改为 `{ name: 'ProjectRoot', ... }`。

### 第四阶段：实现编辑器状态恢复、持久化与双向同步

1.  **增强 `tabStore.ts` (持久化核心)**:
    *   引入 `pinia-plugin-persistedstate` 或类似机制。
    *   **持久化内容**: 只持久化 `tabs` 数组的简化版 `[{ internalId, projectId, workflowId, label, type }]` 和 `activeTabId` 字符串到 `localStorage`。
    *   **恢复时机**: 应用首次加载时，`tabStore` 从 `localStorage` 读取数据来初始化状态。

2.  **增强 `EditorView.vue` (状态恢复与同步)**:
    *   **`onMounted` 逻辑**:
        *   检查 `tabStore` 是否已从 `localStorage` 恢复了标签页。
        *   如果URL中指定了 `workflowId`，则优先调用 `tabStore.loadAndOpenWorkflowById(projectId, workflowId)` 加载并打开。
        *   否则，恢复上次激活的标签页。
    *   **新增 `watch` 监听器 (双向绑定)**:
        *   监听 `tabStore.activeTabId` 的变化，以更新 URL。
        *   监听 `route.params.workflowId` 的变化，以切换激活的标签页。

3.  **增强 `tabStore.ts` (功能支持)**:
    *   创建 `loadAndOpenWorkflowById(projectId: string, workflowId: string)` action，负责加载或切换到指定工作流的标签页。
    *   修改 `addTab` action，确保新创建的、有持久化ID的标签页能同步更新URL。

### 第五阶段：并发处理策略

1.  **明确策略**: 本次重构将采用**非同步**策略。
    *   在不同浏览器窗口打开同一个工作流，每个窗口都将从服务器加载一份独立的、最新的数据副本。
    *   在一个窗口中保存工作流，**不会**自动更新其他窗口的内容。
2.  **技术实现**:
    *   无需额外代码。确保 `loadWorkflow` 等函数每次都从服务器获取最新数据，不使用本地缓存。