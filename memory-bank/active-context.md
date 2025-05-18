# 活动上下文：节点插槽类型系统重构 - UI 实现

本文件用于记录当前正在进行的 UI 实现任务的详细工作过程、思考、遇到的问题和解决方案。

**背景:**
UI 设计方案已由 Architect 模式完成，并记录在 [`DesignDocs/architecture/floating-preview-editor-design.md`](./DesignDocs/architecture/floating-preview-editor-design.md)。该方案基于“右侧专用预览面板”和“底部弹出式编辑面板”。

**当前阶段:** 阶段四：前端UI组件渲染逻辑更新与UI/UX增强 - UI 实现

**当前子任务:**

将根据 [`DesignDocs/architecture/floating-preview-editor-design.md`](./DesignDocs/architecture/floating-preview-editor-design.md) 中的实现步骤建议，逐一委派和执行子任务。

---
*子任务 4.3.1 (代码编辑器组件增强) 已完成。详细日志已归档到 [`memory-bank/progress-log.md`](./memory-bank/progress-log.md)。关于代码编辑器实现策略的调整已记录在 [`memory-bank/decision-log.md`](./memory-bank/decision-log.md)。*
*子任务 4.3.2 (核心类型与状态管理更新 - 添加 `previewTarget`) 已完成。详细日志已归档到 [`memory-bank/progress-log.md`](./memory-bank/progress-log.md)。*
*子任务 4.3.3 (插槽预览交互实现 - 右键菜单) 已完成。用户确认通过新任务修复。详细日志已归档到 [`memory-bank/progress-log.md`](./memory-bank/progress-log.md)。*
*子任务 4.3.4 (插槽预览交互实现 - 快捷键交互) 已完成。详细日志已归档到 [`memory-bank/progress-log.md`](./memory-bank/progress-log.md)。*
---

## 子任务 4.3.5 (来自设计文档步骤3.c): 插槽预览交互实现 - 视觉反馈 (SVG图标方案)

**状态:** 待用户确认

**目标 (已根据 [`memory-bank/decision-log.md`](./memory-bank/decision-log.md) 中 2025/05/18 的决策及用户最新反馈更新):**
在被标记为预览目标的输出插槽上提供清晰的视觉指示。实现方案如下：
1.  在 [`apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue`](../apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue) 中，直接消费从 `useWorkflowManager()` 获取的 `activePreviewTarget` 计算属性。
2.  当某个输出插槽的 `nodeId` 和 `slotKey` 与 `activePreviewTarget.value` 匹配时，在该输出插槽的位置渲染一个“眼睛”SVG 图标，**覆盖或替换**原始插槽点的视觉效果。
3.  SVG 图标的样式和定位应确保清晰可见且不影响用户交互，并与原始插槽点大小一致。

**核心需求:**
1.  **修改 [`apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue`](../apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue):**
    *   导入并使用 `useWorkflowManager`。
    *   在模板中渲染输出插槽 (Handles) 的部分。
    *   对于每一个输出插槽：
        *   条件性地渲染“眼睛”SVG 图标，如果它是 `activePreviewTarget`。SVG 图标将使用绝对定位覆盖在 Handle 的位置。
        *   条件性地给 `<Handle>` 组件添加一个 CSS 类 (例如 `styles.handleHiddenWhenPreviewing`)，当它是 `activePreviewTarget` 时，这个类会隐藏 Handle 的默认视觉样式（例如背景透明）。
    *   确保图标的显示是响应式的。
2.  **图标样式与定位**:
    *   SVG 图标的大小应与 Handle 圆点大致相同 (例如 `w-2.5 h-2.5`)，颜色应与 UI 协调 (例如 `text-blue-500` 或 `currentColor` 以适应主题)。
    *   SVG 图标通过绝对定位精确覆盖在 Handle 的位置。
3.  **CSS 修改**:
    *   在 [`apps/frontend-vueflow/src/components/graph/nodes/handleStyles.module.css`](../apps/frontend-vueflow/src/components/graph/nodes/handleStyles.module.css) 中添加 `handleHiddenWhenPreviewing` 类。

**详细日志 (由受委派的模式记录):**
*   **2025/05/18 12:08:** 开始执行子任务 4.3.5。
*   已阅读相关文档。
*   初步方案：SVG 图标放置在 Handle 旁边。
*   **2025/05/18 12:09:** Diff 应用成功。
*   **2025/05/18 12:10:** 收到用户反馈，要求 SVG 图标覆盖或替换原始插槽点。
*   **调整方案:**
    1.  SVG 图标将使用绝对定位覆盖在 Handle 组件的位置。
    2.  Handle 组件本身仍然渲染。
    3.  当插槽是预览目标时，给 Handle 组件动态添加 CSS 类 `styles.handleHiddenWhenPreviewing`，使其默认视觉效果不可见。
    4.  SVG 图标大小 `w-2.5 h-2.5` (10px)，`stroke-width="2"`，颜色 `text-blue-500 dark:text-blue-400`，绝对定位 `absolute top-1/2 right-[-6px] -translate-y-1/2 pointer-events-none`。
    5.  在 [`apps/frontend-vueflow/src/components/graph/nodes/handleStyles.module.css`](../apps/frontend-vueflow/src/components/graph/nodes/handleStyles.module.css) 中定义 `handleHiddenWhenPreviewing` 类。
*   **2025/05/18 12:11:** `handleStyles.module.css` 更新成功。
*   **2025/05/18 12:12:** 第一次尝试修改 `BaseNode.vue` 的 diff 失败，因为文件已被第一次（不正确的）diff 修改。
*   **2025/05/18 12:12:** 重新读取 `BaseNode.vue`。
*   **2025/05/18 12:26:** 第二次尝试修改 `BaseNode.vue` 的 diff 成功，但出现 TypeScript 错误 `计算属性名的类型必须为 "string"、"number"、"symbol" 或 "any"`。
*   **调整方案 (修复TS错误):** 修改 `:class` 绑定，将对象 `{ [styles.handleHiddenWhenPreviewing]: condition }` 替换为 `(condition) ? { [styles.handleHiddenWhenPreviewing!]: true } : {}`，使用非空断言 `!`。
*   **2025/05/18 12:27:** 第三次尝试修改 `BaseNode.vue` 的 diff 成功，TypeScript 错误已解决。
*   所有计划的修改已完成。准备向用户请求确认。
*   **2025/05/18 12:35:** 用户反馈，替换为眼睛图标后，缺失了连线拖拽功能，并且眼睛图标需要更大。
*   **调整方案 (修复拖拽和调整大小):**
    1.  **移除独立的 SVG 眼睛图标**: 不再在 `BaseNode.vue` 中单独渲染 SVG。
    2.  **修改 Handle 样式**: 当 Handle 是预览目标时，直接修改 `<Handle>` 组件的样式，使其显示为眼睛图标。
        *   在 `BaseNode.vue` 中，当输出插槽是预览目标时，给 `<Handle>` 组件应用新的 CSS 类 `styles.handleAsPreviewIcon`，而不是之前的 `styles.handleHiddenWhenPreviewing`。
        *   在 `handleStyles.module.css` 中：
            *   移除 `.handleHiddenWhenPreviewing` 样式。
            *   添加新的 `.handleAsPreviewIcon` 样式，使用 `background-image` (内联 SVG) 显示眼睛图标。
            *   调整 `width` 和 `height` 为 `18px`。
            *   调整 `left` 和 `right` 定位值以适应新的尺寸 (例如 `-9px`)。
            *   确保背景和边框完全透明，以避免与 Handle 原有样式冲突。
*   **2025/05/18 12:36:** `BaseNode.vue` 修改成功，移除了独立 SVG 并更新了 Handle 的 class 绑定。
*   **2025/05/18 12:36:** `handleStyles.module.css` 修改成功，定义了 `handleAsPreviewIcon` 并移除了旧样式。
*   **2025/05/18 12:37:** 用户反馈眼睛图标上仍有方块覆盖。
*   **调整方案 (修复视觉覆盖问题):**
    *   在 `handleStyles.module.css` 的 `.handleAsPreviewIcon` 样式中，更强制地清除 `background-color` 和 `border` 相关的所有属性 (例如 `border-color`, `border-width`, `border-style`, `box-shadow`)，并使用 `!important` 确保覆盖。
    *   移除了 `cursor: default !important;` 以确保 Handle 的拖拽功能。
*   **2025/05/18 12:37:** `handleStyles.module.css` 再次修改成功。
*   **2025/05/18 12:39:** 用户确认视觉问题已解决。任务完成。
*   **2025/05/18 12:42:** 用户反馈新 bug：`CONVERTIBLE_ANY` 类型插槽在连接后，新生成的下一个 `CONVERTIBLE_ANY` 插槽样式错误（变为实心）。同时，Alt+Click 行为不符合预期，即使点击 Handle 也会触发节点循环预览。
*   **调试与修复 `CONVERTIBLE_ANY` 插槽样式问题:**
    *   检查 `useGroupIOSlots.ts`，确认其正确传递 `dataFlowType`。
    *   检查 `BaseNode.vue` 中 `isAnyType` 的使用，确认其正确应用 `styles.handleAny`。
    *   通过日志发现 `useGroupInterfaceSync.ts` 在同步接口时，新创建的 `CONVERTIBLE_ANY` 插槽的类型被错误地记录为 `undefined` (日志显示 `new type: undefined`)。
    *   定位到 `useGroupInterfaceSync.ts` 中，在动态创建新的 `CONVERTIBLE_ANY` 插槽时，错误地使用了 `type: 'CONVERTIBLE_ANY'` 而不是 `dataFlowType: DataFlowType.CONVERTIBLE_ANY`。
    *   **2025/05/18 12:53:** 修正 `useGroupInterfaceSync.ts`，使用正确的 `dataFlowType` 字段。
*   **调试与修复 Alt+Click 行为问题:**
    *   初步怀疑 `useCanvasKeyboardShortcuts.ts` 中 `handleNodeAltClick` 函数内通过 `event.target.closest()` 判断 Handle 点击的逻辑失效。
    *   添加调试日志，确认 `event.target` 确实是 Handle 元素，但 `closest('.vue-flow__handle-source')` 返回 `null`。
    *   **调整方案：**
        1.  在 `BaseNode.vue` 的输出 `<Handle>` 组件上直接监听 `@click` 事件，并在事件处理函数 `handleOutputAltClick` 内部检查 `event.altKey`。如果为 `true`，则执行精确的预览设置/清除逻辑，并调用 `event.stopPropagation()` 阻止事件冒泡到 `onNodeClick`。此方法也包含对 `WILDCARD` 和 `CONVERTIBLE_ANY` 类型的预览阻止。
        2.  简化 `useCanvasKeyboardShortcuts.ts` 中的 `handleNodeAltClick` 函数。由于精确的 Handle 点击已在 `BaseNode.vue` 中处理，此函数现在假定所有到达它的 Alt+Click 事件都发生在节点主体上，因此只执行节点输出插槽的循环切换预览逻辑。在循环时，会过滤掉不可预览的插槽类型（`WILDCARD`, `CONVERTIBLE_ANY`）。
    *   **2025/05/18 1:04:** `BaseNode.vue` 修改成功，添加了 `handleOutputAltClick`。
    *   **2025/05/18 1:11:** `useCanvasKeyboardShortcuts.ts` 修改成功，简化了 `handleNodeAltClick` 逻辑并修复了相关 TypeScript 错误。
*   **2025/05/18 1:15:** 所有已知问题已修复。用户确认可以更新任务记录。