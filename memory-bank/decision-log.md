# 决策日志：节点插槽类型系统重构

本日志记录在节点插槽类型系统重构项目中的关键设计决策及其理由。

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

**决策日期:** 2025/05/18

**决策点:** 可停靠编辑器面板的常驻行为、控制方式及布局

**背景:**
在确认了 [`DesignDocs/architecture/enhanced-editor-panel-design.md`](../DesignDocs/architecture/enhanced-editor-panel-design.md) 的详细设计后，需要明确可停靠编辑器面板（原“底部弹出式编辑面板”）的具体用户交互偏好。

**用户确认的偏好:**
1.  **面板常驻行为**: 非永久常驻。当没有活动编辑内容或用户主动关闭时，面板应完全隐藏。
2.  **展开/收起按钮位置**: 通过底栏 ([`apps/frontend-vueflow/src/components/graph/StatusBar.vue`](../apps/frontend-vueflow/src/components/graph/StatusBar.vue:0)) 中的一个专用按钮来控制面板的显示与隐藏。
3.  **与画布和侧边栏的交互**: 编辑器面板（例如停靠在底部时）应与画布区域视为同一主内容区，两者都会受到左侧边栏宽度变化的影响（即左侧边栏展开时，画布和底部编辑器面板的可用宽度都会相应减少）。

**最终决策:**
采纳用户确认的上述偏好。

**理由:**
- 用户直接指定了这些交互偏好，以确保符合其使用习惯和期望。
- 非永久常驻并通过专用按钮控制，可以最大化画布可视区域，仅在需要时显示编辑器。
- 与画布同级并受侧边栏影响，符合主流IDE和工具的布局逻辑。

**影响:**
- `DockedEditorWrapper.vue` (来自 [`enhanced-editor-panel-design.md`](../DesignDocs/architecture/enhanced-editor-panel-design.md)) 需要实现：
    -   管理其自身的可见性状态。
    -   响应来自外部（如状态栏按钮）的控制信号以切换可见性。
    -   其布局需要能适应父容器的宽度变化（受左侧边栏影响）。
- [`apps/frontend-vueflow/src/components/graph/StatusBar.vue`](../apps/frontend-vueflow/src/components/graph/StatusBar.vue:0) 需要：
    -   新增一个“文本编辑器”或类似功能的切换按钮。
    -   该按钮的逻辑需要能控制 `DockedEditorWrapper.vue` 的显示/隐藏状态（可能通过全局状态管理或事件总线）。
- 主视图组件 (可能是 [`apps/frontend-vueflow/src/views/EditorView.vue`](../apps/frontend-vueflow/src/views/EditorView.vue:0) 或其布局父级) 需要：
    -   正确集成和定位 `DockedEditorWrapper.vue`。
    -   确保其布局能正确响应左侧边栏的挤压效果。

**参考文档:**
- [`DesignDocs/architecture/enhanced-editor-panel-design.md`](../DesignDocs/architecture/enhanced-editor-panel-design.md)
- [`DesignDocs/architecture/floating-preview-editor-design.md`](../DesignDocs/architecture/floating-preview-editor-design.md) (关于整体UI布局的上下文)
- [`apps/frontend-vueflow/src/components/graph/StatusBar.vue`](../apps/frontend-vueflow/src/components/graph/StatusBar.vue:0) (将被修改)
- [`apps/frontend-vueflow/src/views/EditorView.vue`](../apps/frontend-vueflow/src/views/EditorView.vue:0) (可能被修改以集成和布局编辑器面板)
---

**决策日期:** 2025/05/18

**决策点:** 关于组件内部CSS类名的命名规范，以避免样式冲突

**背景:**
在实现任务 4.5（底部可停靠编辑器面板空状态提示）的过程中，发现 [`TabbedEditorHost.vue`](../apps/frontend-vueflow/src/components/common/TabbedEditorHost.vue:0) 内部使用的通用CSS类名（如 `.tab-content`）与项目中其他地方（可能是全局样式或第三方库如daisyUI）的同名类发生冲突，导致预期的空状态提示无法正确显示和布局。

**讨论与考虑:**
- 直接使用通用类名（如 `tab-content`, `header`, `footer` 等）虽然简单，但在大型项目或引入第三方UI库时，极易发生样式冲突，导致难以调试的布局问题。
- 为组件内部特定的、非意图暴露给外部覆写的CSS类名添加项目级或组件级的前缀（如 `ct-` 代表 ComfyTavern，或更具体的组件名前缀），可以有效隔离样式作用域，减少冲突可能性。

**最终决策:**
**推荐并采纳在Vue组件（尤其是使用 `<style scoped>` 的组件）内部，为其主要的、可能与外部冲突的CSS类名添加项目特定的前缀（例如 `ct-`）作为一种开发实践。**
例如，在 [`TabbedEditorHost.vue`](../apps/frontend-vueflow/src/components/common/TabbedEditorHost.vue:0) 中，将 `.tab-content` 修改为 `.ct-tab-content`。

**理由:**
- **减少样式冲突**: 显著降低因类名重复导致的样式覆盖和布局问题。
- **提高可维护性**: 使组件样式更加独立和可预测，便于长期维护和团队协作。
- **增强封装性**: 更好地封装组件内部实现细节，减少对全局样式的意外依赖或影响。

**影响:**
- 未来新组件开发或现有组件重构时，应考虑此命名规范。
- 对于已存在大量通用类名的复杂组件，可逐步进行改造。
- 此实践主要针对组件内部结构性或功能性的类名，对于直接应用UI框架（如Tailwind CSS）的工具类，则按框架自身用法即可。

**参考任务:**
- 任务 4.5 (底部可停靠编辑器面板空状态提示) 的调试过程，记录在对应的 `active-context.md` 中。
---

**决策日期:** 2025/05/18

**决策点:** 可停靠编辑器标签页内容加载、JSON 处理及标题显示机制

**背景:**
用户报告在点击节点输入控件的“编辑”按钮后，可停靠编辑器面板 (`DockedEditorWrapper.vue`) 虽然被唤起，但面板内的标签页是空的，内容未加载，编辑JSON时报错，且标签页标题不友好。

**最终决策与理由:**

1.  **标签页内容加载机制**:
    *   **决策**: 确保编辑器打开请求发生时，包含 `initialContent`、`languageHint` 和 `title` 的完整上下文能够被正确传递到负责渲染标签页的组件。
    *   **理由**: 解决之前编辑器无法直接响应状态中标签数据变化的问题，确保内容正确加载。

2.  **处理 JSON 内容在编辑器中的显示与保存**:
    *   **决策**: 在为 JSON 类型的输入构造编辑器上下文时，需将对象转换为格式化的字符串 (`JSON.stringify`) 供编辑器使用。在保存时，需将编辑器返回的字符串内容转换回对象 (`JSON.parse`)。
    *   **理由**: 确保编辑器能正确接收和显示 JSON 内容，并在保存时安全地转换回原始数据结构，避免类型不匹配错误。

3.  **优化可停靠编辑器标签页标题显示**:
    *   **决策**: 优先使用从编辑器打开上下文中传入的预设标题作为标签页的显示名称。
    *   **理由**: 确保用户友好的、预设的标题能够被最终用作标签页的显示名称，提高界面的可读性和易用性。

**影响:**
- 这些决策共同解决了可停靠编辑器面板在打开标签页、加载内容、处理特定数据类型（JSON）以及显示标签标题方面存在的问题。
- 相关文件已按此决策修改：[`apps/frontend-vueflow/src/composables/editor/useEditorState.ts`](../apps/frontend-vueflow/src/composables/editor/useEditorState.ts), [`apps/frontend-vueflow/src/views/EditorView.vue`](../apps/frontend-vueflow/src/views/EditorView.vue), [`apps/frontend-vueflow/src/composables/workflow/useWorkflowInteractionCoordinator.ts`](../apps/frontend-vueflow/src/composables/workflow/useWorkflowInteractionCoordinator.ts), [`apps/frontend-vueflow/src/components/graph/editor/DockedEditorWrapper.vue`](../apps/frontend-vueflow/src/components/graph/editor/DockedEditorWrapper.vue)。

**参考任务:**
- 子任务 NEXUSCORE_SUBTASK_DOCKED_EDITOR_FIX_AND_ENHANCE_V1 的详细修复过程，记录在 [`memory-bank/active-context.md`](./active-context.md) (现已归档)。
---