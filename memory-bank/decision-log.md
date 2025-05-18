# 决策日志：节点插槽类型系统重构

本日志记录在节点插槽类型系统重构项目中的关键设计决策及其理由。

---

**决策日期:** 2025/05/17

**决策点:** 关于UI Hint字段 (`uiHint`) 的引入

**背景:**
在初步的类型系统设计中，曾考虑引入一个顶层的 `uiHint: string` 字段到 `InputDefinition.config` 中，用于明确建议前端应渲染的UI组件。

**讨论与考虑:**
- 用户反馈现有系统已通过 `type` 结合 `config` 中的特定属性（如 `multiline: true`）来间接影响UI。
- 对于 `CODE` 等类型的UI表现，用户倾向于继续使用 `config` 内的配置（如 `languageHint`）来触发特定渲染。
- 考虑到 [`DesignDocs/architecture/floating-text-preview-plan.md`](../DesignDocs/architecture/floating-text-preview-plan.md) 的计划（可能将多行编辑统一到浮动窗口），对节点本身UI组件的“暗示”需求降低。

**最终决策:**
**不引入顶层的 `uiHint` 字段。**
前端UI组件的选择和渲染方式，将主要依据 `DataFlowType`、`SocketMatchCategory` (可选) 以及 `InputDefinition.config` 对象内部的具体配置项（如 `multiline`, `languageHint`, `suggestions`, 以及未来可能新增的 `preferFloatingEditor` 等）。

**理由:**
- 保持与现有设计思路的延续性。
- 避免引入过多的新顶层概念，保持 `InputDefinition` 结构的相对简洁。
- 更好地与“统一多行/复杂内容浮动编辑窗口”的未来规划相契合。
- 允许通过 `config` 进行更细粒度的UI行为控制。

**参考文档:**
- [`DesignDocs/architecture/new-slot-type-system-design.md`](../DesignDocs/architecture/new-slot-type-system-design.md) (已更新以反映此决策)

---

**决策日期:** 2025/05/18

**决策点:** 关于代码编辑器组件的实现策略 (针对底部编辑面板)

**背景:**
在执行子任务 SLOT_TYPE_REFACTOR_UI_4_3_1 (代码编辑器组件增强) 时，初步方案是直接增强现有的 [`CodeInput.vue`](../apps/frontend-vueflow/src/components/graph/inputs/CodeInput.vue) 组件。该子任务已按此方案完成，集成了搜索和JSON校验功能。

**用户反馈与讨论:**
用户在子任务完成后指出，直接修改 [`CodeInput.vue`](../apps/frontend-vueflow/src/components/graph/inputs/CodeInput.vue) 以适应底部编辑面板的复杂需求，可能会影响该组件在节点内部直接用于简单代码输入的场景。更优的做法可能是：
1.  创建一个新的、功能更全面的代码编辑器组件 (例如 `EnhancedCodeEditor.vue`) 专用于底部编辑面板。
2.  或者，将对 [`CodeInput.vue`](../apps/frontend-vueflow/src/components/graph/inputs/CodeInput.vue) 的增强逻辑主要应用于后续将创建的 [`BottomEditorPanel.vue`](../DesignDocs/architecture/floating-preview-editor-design.md) 内部，而保持节点内使用的 [`CodeInput.vue`](../apps/frontend-vueflow/src/components/graph/inputs/CodeInput.vue) 相对简洁。

**最终决策:**
**采纳用户反馈，调整代码编辑器的实现策略。**
虽然子任务 SLOT_TYPE_REFACTOR_UI_4_3_1 已对 [`CodeInput.vue`](../apps/frontend-vueflow/src/components/graph/inputs/CodeInput.vue) 进行了增强，但后续在实现 [`BottomEditorPanel.vue`](../DesignDocs/architecture/floating-preview-editor-design.md) 时，将采取以下策略之一：
*   **选项A (推荐):** 创建一个新的专用代码编辑器组件 (如 `EnhancedCodeEditor.vue`)，将 SLOT_TYPE_REFACTOR_UI_4_3_1 中实现的搜索、高级JSON处理等功能迁移或重新实现在这个新组件中。[`CodeInput.vue`](../apps/frontend-vueflow/src/components/graph/inputs/CodeInput.vue) 将恢复或保持其作为节点内嵌简单代码输入框的定位，移除或条件化已添加的复杂功能。
*   **选项B:** 在 [`BottomEditorPanel.vue`](../DesignDocs/architecture/floating-preview-editor-design.md) 内部直接实例化和配置 CodeMirror，集成所有增强功能，而不是依赖一个外部的、过度增强的 [`CodeInput.vue`](../apps/frontend-vueflow/src/components/graph/inputs/CodeInput.vue)。

具体选择将在实现 [`BottomEditorPanel.vue`](../DesignDocs/architecture/floating-preview-editor-design.md) 时由负责的 Code 模式决定，但目标是确保节点内直接使用的 [`CodeInput.vue`](../apps/frontend-vueflow/src/components/graph/inputs/CodeInput.vue) 保持轻量和专注。

**理由:**
- 保持组件的单一职责原则。
- 避免不必要的复杂性传递给简单应用场景。
- 提高代码的可维护性和可读性。

**影响:**
- 后续创建 `BottomEditorPanel.vue` 的任务需要明确此决策。
- 可能需要回滚或重构 [`CodeInput.vue`](../apps/frontend-vueflow/src/components/graph/inputs/CodeInput.vue) 在 SLOT_TYPE_REFACTOR_UI_4_3_1 中的部分修改。

**参考文档:**
- [`DesignDocs/architecture/floating-preview-editor-design.md`](../DesignDocs/architecture/floating-preview-editor-design.md)
- [`memory-bank/progress-log.md`](./progress-log.md) (任务 SLOT_TYPE_REFACTOR_UI_4_3_1 的备注)

---

**决策日期:** 2025/05/18

**决策点:** 关于“预览标记视觉反馈”的实现方式调整

**背景:**
子任务 SLOT_TYPE_REFACTOR_UI_4_3_5 (插槽预览交互实现 - 视觉反馈) 的原定计划是让 [`BaseNode.vue`](../apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue) 组件直接读取全局的 `activePreviewTarget` 状态，并为每个输出插槽判断是否需要显示预览指示器。

**用户反馈与讨论:**
用户对此方案提出疑问，认为让每个节点实例都去查找哪个插槽被预览的方式可能“奇怪”，并暗示基于事件通知的机制可能更合适。

**讨论与考虑的替代方案:**
1.  **事件总线/发布订阅**: 当 `activePreviewTarget` 改变时发出事件，节点订阅并响应。
2.  **精确 Props 传递**: 由高层管理者计算哪些节点/插槽需要指示器，并通过 prop 精确传递状态。
3.  **细化 Store Getter**: `useWorkflowManager` 提供更精细的 getter，如 `isSlotPreviewTarget(nodeId, slotKey)`，由节点调用。

**最终决策 (更新于 2025/05/18):**
**采纳更简洁的方案，直接利用现有的单一预览目标状态进行视觉反馈。**
经过进一步讨论和对现有代码的分析，特别是 [`apps/frontend-vueflow/src/composables/workflow/useWorkflowManager.ts`](../apps/frontend-vueflow/src/composables/workflow/useWorkflowManager.ts) 中的 `activePreviewTarget` 计算属性，决定采用以下方案：

1.  **直接消费 `activePreviewTarget`**: 在 [`BaseNode.vue`](../apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue) 中，直接使用从 `useWorkflowManager` 获取的 `activePreviewTarget` 计算属性。
2.  **动态 CSS 类**: 当某个输出插槽的 `nodeId` 和 `slotKey` 与 `activePreviewTarget.value` (即 `workflowData.previewTarget`) 匹配时，为其对应的 Handle 组件动态添加一个特定的 CSS 类 (例如 `styles.handlePreviewing`)。
3.  **CSS 样式定义**: 在 [`apps/frontend-vueflow/src/components/graph/nodes/handleStyles.module.css`](../apps/frontend-vueflow/src/components/graph/nodes/handleStyles.module.css) 中定义 `styles.handlePreviewing` 样式，以提供清晰的视觉指示（如光晕或边框高亮）。

**理由 (更新):**
- **简单高效**: 此方案直接利用现有状态，避免了引入新的状态管理模块或复杂的事件机制，代码改动量小。
- **职责清晰**: `useWorkflowManager` 继续管理预览的“数据源”，`BaseNode.vue` 负责根据此数据源进行“视觉呈现”。
- **符合用户预期**: 解决了最初对每个节点实例都去查找预览状态的性能担忧，同时保持了方案的简洁性。

**影响 (更新):**
- 子任务 SLOT_TYPE_REFACTOR_UI_4_3_5 (视觉反馈) 可以按照此简化方案进行。
- 无需更新 [`memory-bank/active-context.md`](./active-context.md) 关于此部分的复杂设计。

**参考文档 (更新):**
- [`DesignDocs/architecture/floating-preview-editor-design.md`](../DesignDocs/architecture/floating-preview-editor-design.md) (已更新其 2.3.4 节和 10.3 节以反映此简化方案)
- [`apps/frontend-vueflow/src/composables/workflow/useWorkflowManager.ts`](../apps/frontend-vueflow/src/composables/workflow/useWorkflowManager.ts) (查看 `activePreviewTarget` 的实现)
- [`apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue`](../apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue) (将进行修改以添加动态类)
- [`apps/frontend-vueflow/src/components/graph/nodes/handleStyles.module.css`](../apps/frontend-vueflow/src/components/graph/nodes/handleStyles.module.css) (将添加新样式)

---