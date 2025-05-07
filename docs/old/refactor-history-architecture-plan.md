# 前端 VueFlow 状态管理与历史记录架构重构计划

**目标:** 解决历史记录触发机制脆弱、状态同步复杂、职责不清的问题，实现更健壮、清晰、可维护的架构。采用分离历史记录、显式触发并加入操作标签的方案。

**核心方案 (已实施):**

1.  **分离历史记录:** `useWorkflowHistory` Composable 专门管理历史快照和撤销/重做逻辑。
2.  **显式触发:** 在用户完成有意义的操作后，由 `workflowStore` 或相关调用者显式调用 `useWorkflowHistory.recordSnapshot`。
3.  **操作标签:** 在调用 `recordSnapshot` 时，根据操作上下文生成描述性的 `label`。

**当前架构实现:**

1.  **`useWorkflowHistory` Composable** (`apps/frontend-vueflow/src/composables/useWorkflowHistory.ts`)
    - **职责:** 管理每个标签页的历史记录栈 (`historyMap`)，包含 `items` (快照数组) 和 `currentIndex`。
    - **核心方法:**
        - `recordSnapshot(internalId, label, payload)`: 添加新快照，处理历史截断，使用 `klona` 深拷贝 `payload`。
        - `undo(internalId)` / `redo(internalId)`: 移动 `currentIndex`，返回目标快照的**深拷贝** (`klona`) 或 `null`。
        - `markAsSaved(internalId)`: 将当前 `currentIndex` 标记为已保存状态 (`savedIndex`)。
        - `canUndo(internalId)` / `canRedo(internalId)` / `hasUnsavedChanges(internalId)`: 计算属性，提供状态查询。
    - **数据结构:**
        - `WorkflowStateSnapshot` (`@/types/workflowTypes.ts`): 定义了快照内容，包含 `elements`, `viewport`, `workflowData`。
        - `TItem`: 包含 `label` 和 `payload` (即 `WorkflowStateSnapshot`)。
    - **关键点:**
        - **深拷贝:** 在记录和返回快照时使用 `klona` 保证状态隔离。
        - **错误处理:** 包含基本的 `try...catch`。

2.  **`useWorkflowManager` Composable** (`apps/frontend-vueflow/src/composables/useWorkflowManager.ts`)
    - **职责:** 管理所有标签页的**当前**工作流状态 (`tabStates`)，包含 `elements`, `viewport`, `workflowData`, `isDirty` 等。**不处理历史记录**。
    - **核心方法:**
        - `getCurrentSnapshot(internalId)`: 获取指定标签页当前状态的**深拷贝** (`klona`)，用于记录历史。
        - `applyStateSnapshot(internalId, snapshot)`: **只应用非画布核心数据** (如 `workflowData`) 到 `tabStates` 中对应的状态。**不修改画布**。
        - `setElements(internalId, elements)`: 更新指定标签页的 `elements` 状态。
        - `markAsDirty(internalId)`: 标记标签页为脏状态。
        - 提供状态获取的 getter (`getActiveTabState`, `getElements` 等)。
    - **关键点:** 状态管理的中心，与历史记录解耦。

3.  **`workflowStore` (Pinia Store)** (`apps/frontend-vueflow/src/stores/workflowStore.ts`)
    - **职责:** **协调器**。连接视图层、`useWorkflowManager`、`useWorkflowHistory` 和其他 composables (如 `useWorkflowData`, `useWorkflowViewManagement`)。
    - **核心流程:**
        - **记录历史:** 在执行完修改状态的操作后 (如添加节点、保存工作流)，调用 `manager.getCurrentSnapshot` 获取当前状态，然后调用 `history.recordSnapshot` 记录快照，并附带 `label`。**关键:** 在记录前通常需要 `await nextTick()` 确保状态已更新。
        - **撤销/重做 (`undo`/`redo`):**
            1. 调用 `history.undo/redo` 获取目标 `payload`。
            2. 调用 `manager.applyStateSnapshot` 应用**核心数据**。
            3. 获取 `vueFlowInstance`。
            4. **命令式更新画布:** 使用 `instance.setNodes/setEdges/setViewport` 并采用 "清空 -> `await nextTick()` -> 设置" 模式，强制画布与 `payload` 同步。
        - **保存 (`saveWorkflow`):**
            1. 调用 `data.saveWorkflow` 保存数据。
            2. 成功后，更新 `manager` 中的 `workflowData` 和 `isDirty` 状态。
            3. 调用 `history.markAsSaved` 同步保存点。
            4. 调用 `ensureHistoryAndRecord` 记录保存操作本身。
    - **关键点:**
        - 明确的协调流程，保证状态更新、历史记录和视图更新的顺序。
        - **撤销/重做时的命令式画布更新是关键实现**。
        - 通过 `ensureHistoryAndRecord` 统一记录入口。

4.  **视图层 (Components/Views)** (如 `EditorView.vue`, `useDnd.ts`, `useCanvasKeyboardShortcuts.ts`)
    - **职责:** 捕获用户交互事件 (拖拽释放、键盘快捷键、属性修改确认等)。
    - **交互流程:**
        - 调用 `workflowStore` 中对应的**协调动作** (如 `store.addNode`, `store.handleConnection`, `store.undo`)。
        - **不直接**调用 `manager` 或 `history` 的方法（除了 `workflowStore` 内部协调）。
    - **关键点:** 视图层只负责触发动作，不关心状态管理和历史记录的具体实现。

## 历史记录触发点与标签 (当前实现示例)

- **节点添加 (拖拽):** (`useDnd.ts` -> `store.ensureHistoryAndRecord`)
    - `label`: `通过拖放添加节点: ${nodeDisplayName}` (在 `useDnd` 中生成并传递)
    - **注意:** 在 `addNodes` 后、记录前使用了 `await nextTick()`。
- **节点移动:** (需要监听 `nodesDragStop` 事件，调用 `store` 的方法来记录)
    - `label`: `移动节点: ${nodeLabelOrId}`
- **连接创建:** (需要监听 `connectEnd` 事件，调用 `store.handleConnectionWithInterfaceUpdate` 或类似方法)
    - `label`: `连接节点` 或 `连接节点并更新接口`
- **保存:** (`workflowStore.saveWorkflow`)
    - `label`: `保存工作流: ${workflowName}`
- **撤销/重做:** 不记录自身。
- **加载/新建:** (`workflowStore.loadWorkflow`/`createNewWorkflowAndRecord`)
    - `label`: `加载工作流: ${workflowName}` / `新建工作流`

## 总结与后续

当前架构已基本按照重构计划实施，解决了之前版本的问题。核心在于职责分离、显式历史记录和命令式的画布状态恢复。

**后续可优化点:**

1.  **节点移动历史记录:** 确认 `nodesDragStop` 事件已正确接入，并在 `workflowStore` 中有对应的方法处理和记录历史。
2.  **属性修改历史记录:** 审视属性面板等组件，确保修改确认后能触发 `workflowStore` 的方法记录历史。
3.  **标签生成标准化:** 确保所有触发点都生成了清晰一致的 `label`。
4.  **错误处理细化:** 在各个关键步骤增加更详细的错误处理和用户反馈。
5.  **性能考量:** 对于非常大的工作流，深拷贝快照可能存在性能瓶颈，未来可探索增量更新或 diff/patch 方案（但会增加复杂度）。

---

*(以下为旧的修复计划，大部分已通过上述架构实现，保留作参考)*

## ~~历史记录实现修复计划 (基于 2025-04-17 分析和优化)~~

~~**问题分析:**~~

~~当前历史记录功能存在核心实现缺失、视图层错误和画布状态恢复不准确的问题。~~

~~**修复步骤:**~~

~~1.  **实现 `useWorkflowManager` 核心方法:** (已完成)~~
    ~~- ...~~
~~2.  **移除 `:key` 绑定:** (已完成)~~
    ~~- ...~~
~~3.  **重构 `undo`/`redo` 画布更新 (关键调整):** (已完成)~~
    ~~- ...~~
~~4.  **简化 `handlePaneReady`:** (已完成)~~
    ~~- ...~~
~~5.  **审视并明确历史记录触发点与粒度:** (进行中/已部分完成)~~
    ~~- ...~~

~~**标签生成策略 (细化):** (已采纳)~~
~~...~~

~~**预期收益:** (已实现)~~
~~...~~

---

## 未来考虑 (保持不变)

1.  **交互增强:** 借鉴参考项目监听 VueFlow 事件触发 UI 反馈的模式。
2.  **读取状态模块更新:** 在核心功能稳定后，审视可能读取工作流状态的模块，确保它们从新机制获取数据。
