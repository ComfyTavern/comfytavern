# 活动上下文日志

此文件用于记录当前正在处理的复杂子任务的详细工作过程。
在子任务开始前，此文件应被清空或准备好。
在子任务完成后，NexusCore 将从此文件提取关键信息并整合到长期记忆库中。


## 调试会话：修复“连接边在接口更新后消失”问题

**日期：** 2025-05-25

**问题描述：**
在 ComfyTavern 项目的 `frontend-vueflow` 应用中，当用户执行一个会导致工作流顶层接口定义更新的连接操作时（例如，连接到一个 `CONVERTIBLE_ANY` 类型的组输入/输出槽），新创建的连接边会在操作完成后从画布上消失。

**诊断过程与根本原因分析：**
通过详细的日志分析（包括使用 `Proxy` 拦截状态变化），确定问题根源在于 `apps/frontend-vueflow/src/composables/editor/useInterfaceWatcher.ts`。该 Composable 负责监视工作流顶层接口（`interfaceInputs` 和 `interfaceOutputs`）的变化。当接口变化时，它会尝试更新画布上的 `GroupInput` 和 `GroupOutput` 节点以反映这些变化。
然而，在之前的实现中，`useInterfaceWatcher` 会获取一份当前 `elements`（画布上的所有节点和边）的快照，并基于这个快照来重新构建整个 `elements` 数组，然后通过 `workflowManager.setElements()` 将其设置回去。
问题在于，由于 Vue 的响应式更新队列和微任务时序，`useInterfaceWatcher` 获取到的 `elements` 快照可能是一个过时的版本——即在新边被添加到 `elements` 数组 *之前* 的状态。因此，当它用这个过时的、不包含新边的快照去覆盖整个 `elements` 数组时，新添加的边就被意外地清除了。

**解决方案实施：**
为了解决这个问题，采取了以下步骤：
1.  **引入细粒度更新方法**：
    *   在核心状态管理逻辑 `apps/frontend-vueflow/src/composables/workflow/useWorkflowManager.ts` 中，新增了一个名为 `updateNodeInternalData` 的异步函数。
    *   此函数允许针对性地更新指定节点的 `data` 对象中的特定属性，而无需修改或替换整个 `elements` 数组。它通过查找目标节点，然后合并其现有 `data` 与传入的 `dataPayload` 来工作。

2.  **修改接口监视器逻辑**：
    *   重构了 `apps/frontend-vueflow/src/composables/editor/useInterfaceWatcher.ts` 中的 `watch` 回调。
    *   当检测到顶层接口需要更新画布上的 `GroupInput` 或 `GroupOutput` 节点时，不再调用 `workflowManager.setElements()`。
    *   取而代之，它现在遍历最新的 `elements` 快照（从 `workflowManager.getCurrentSnapshot()` 获取，确保操作基于一致的状态），识别出需要更新的 `GroupInput` 或 `GroupOutput` 节点，并为每个此类节点调用新引入的 `workflowManager.updateNodeInternalData()` 方法，仅传递需要更新的 `inputs` 或 `outputs` 部分到节点的 `data` 对象中。

**结果与验证：**
经过上述修改后，问题得到解决。
*   新创建的连接边在“带接口更新的连接”操作后能够正确保留在画布上。
*   相关的 `GroupInput` 或 `GroupOutput` 节点的插槽也按预期更新。
*   控制台日志证实，`useInterfaceWatcher` 现在能够访问到包含新边的正确 `elements` 状态，并且其更新操作不再导致边被移除。

**后续清理：**
根据用户指示，在确认问题修复后，从 `useWorkflowManager.ts` 中移除了之前为调试 `elements` 属性设置而添加的 `Proxy` 包装器（位于 `createTabWorkflowState` 函数，原名 `createProxiedTabWorkflowState`）及其相关的日志记录，使代码更加整洁。
