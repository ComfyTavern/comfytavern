# EditorView.vue 重构计划

## 目标

重构大型组件 `apps/frontend-vueflow/src/views/EditorView.vue`（超过 950 行），将其中的特定功能提取到专门的 Vue Composables 中。旨在提高代码的可读性、可维护性、可测试性，并遵循 Vue 3 的最佳实践。

## 拟议的 Composables

将在 `apps/frontend-vueflow/src/composables/` 目录（或稍后可能创建的子目录）中创建以下新的 Composable 函数：

1.  **`useRouteHandler.ts`**
    *   **职责:** 处理与 Vue Router 参数（`projectId`, `workflowId`）相关的逻辑。
    *   **提取的逻辑:**
        *   监听 `route.params.projectId` 和 `route.params.workflowId` 的 `watch` 监听器。
        *   `handleWorkflowIdFromRoute` 函数。
    *   **依赖:** `vue-router`, `tabStore`, `projectStore`。

2.  **`useCanvasInteraction.ts`**
    *   **职责:** 管理与 Vue Flow 画布元素直接相关的用户交互（添加、连接、拖拽、移除）。
    *   **提取的逻辑:**
        *   `handleAddNodeFromPanel` 函数。
        *   `handleConnect` 函数。
        *   `handleNodesDragStop` 函数。
        *   `handleElementsRemove` 函数。
    *   **依赖:** `workflowStore`, `nodeStore`, `useUniqueNodeId`, `@vue-flow/core`。

3.  **`useTabManagement.ts`**
    *   **职责:** 处理活动标签页更改时发生的副作用。
    *   **提取的逻辑:**
        *   监听 `activeTabId` 的 `watch` 监听器。
        *   关联/解除关联 Vue Flow 实例的逻辑 (`workflowStore.setVueFlowInstance`)。
        *   确保标签页状态存在 (`workflowStore.ensureTabState`)。
        *   触发工作流加载 (`workflowStore.loadWorkflow`)。
        *   分发 `force-save-interface-changes` 事件。
    *   **依赖:** `tabStore`, `workflowStore`, `vue-router`。

4.  **`useSaveShortcut.ts`**
    *   **职责:** 处理用于保存当前工作流的全局 Ctrl+S / Cmd+S 键盘快捷键。
    *   **提取的逻辑:**
        *   `handleKeyDown` 函数中检查 Ctrl+S/Cmd+S 的部分。
        *   检查脏状态、如果是新工作流则提示输入名称以及调用 `workflowStore.saveWorkflow` 的逻辑。
    *   **依赖:** `workflowStore`。

5.  **`useGroupNodeSync.ts`**
    *   **职责:** 将中央工作流接口定义（`workflowStore.workflowData.interfaceInputs/Outputs`）的更改同步到画布上显示的 `GroupInput` 和 `GroupOutput` 节点的数据。
    *   **提取的逻辑:**
        *   监听 `workflowStore.getWorkflowData(...).interfaceInputs/Outputs` 的 `watch` 监听器。
        *   查找并更新 `elements` 数组中相应 `GroupInput`/`GroupOutput` 节点的 `data` 属性的逻辑。
    *   **依赖:** `workflowStore`, `@vue-flow/core`。

## 预期结果

*   `EditorView.vue` 将显著缩小，主要负责：
    *   渲染主模板结构和子组件（`SidebarManager`, `Canvas`, `NodePreviewPanel`, `StatusBar`）。
    *   初始化并使用新创建的 composables。
    *   将来自 composables 的状态和方法连接到模板和子组件。
    *   处理任何剩余的顶层逻辑（例如，`onMounted` 中的初始节点定义加载）。
*   改进关注点分离。
*   更容易对 composables 中的单个功能进行单元测试。
*   `composables` 目录内的整体代码组织更好（稍后可考虑进一步组织到子目录中）。

## 后续步骤

通过创建新的 Composable 文件并将相应的逻辑从 `EditorView.vue` 移入，继续实施此重构计划。