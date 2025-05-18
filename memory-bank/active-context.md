# 活动上下文

此文件用于记录当前活动子任务的详细工作过程、思考、数据分析和中间发现。
在子任务完成后，NexusCore 会审查此文件，并将关键信息整合到长期的记忆库中。

---

## [`BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue:0) 输入控件UI调整总结 (截至 2025/05/18)

**任务目标回顾：**

根据用户提供的设计图和详细描述，调整 `BaseNode.vue` 中复杂输入类型（多行文本、Markdown、JSON、代码）的UI和交互，主要目标包括：
1.  将“预览”和“编辑（打开停靠编辑器）”按钮统一放置在插槽名称的右侧（`.param-header` 内）。
2.  **多行文本/Markdown**：在 `.param-header` 的按钮旁边（或紧随其后，但仍在头部区域）提供一个高度受限的内联文本编辑区域。下方 `.param-content` 不再显示完整的 `TextAreaInput`，或者调整为受限高度的只读预览（根据最终设计）。用户反馈提及之前AI移除了多行文本的节点内编辑功能。
3.  **代码（如JS）**：仅在 `.param-header` 显示“预览”和“编辑”按钮，节点下方不显示任何内联编辑器。
4.  **JSON对象**：在 `.param-header` 显示“预览”和“编辑”按钮。下方 `.param-content` 显示一个高度受限、只读的JSON预览（如 `JsonInlineViewer`）。
5.  确保对 `nodeGroupInfo` 的访问是安全的（处理其可能为 `null` 的情况）。

**关键的 `<script setup>` 逻辑调整尝试：**

1.  **引入/修改辅助函数**：
    *   `isSimpleInlineInput(input: InputDefinition): boolean`：用于判断输入是否为简单的、适合直接在右侧渲染紧凑控件的类型。多次尝试修正其末尾的括号错误。
    *   `showActionButtonsForInput(input: InputDefinition): boolean`：用于判断哪些输入类型（代码、多行文本、Markdown、JSON）旁边需要显示“预览”和“编辑”按钮。尝试恢复此函数（如果因 `apply_diff` 失败而丢失）并确保其逻辑正确。
    *   `getLanguageHintForInput(input: InputDefinition): string | undefined`：用于获取代码或文本的语言类型，供预览或编辑器使用。调整了对 `Code:JavaScript` 等具体分类的处理。
    *   `getPreviewTooltipContent(value: any, inputDef: InputDefinition): string`：为预览按钮的 Tooltip 生成截断或格式化的内容。
    *   `openEditorForInput(input: InputDefinition)`：核心函数，用于收集参数并调用 `interactionCoordinator.openDockedEditorForNodeInput`。其实现方式从最初的构建 `EditorOpeningContext` 对象并传递给 `handleOpenDockedEditor`，演变为直接收集6个参数调用协调器函数。

2.  **对 `interactionCoordinator.openDockedEditorForNodeInput` 的调用**：
    *   最初尝试传递一个 `EditorOpeningContext` 对象，后根据对 `useWorkflowInteractionCoordinator.ts` 的分析，确认为需要传递6个独立的参数 (`activeTabId`, `nodeId`, `inputKey`, `currentValue`, `inputDefinition`, `editorTitle`)。

3.  **移除不再需要的逻辑**：
    *   移除了 `handleOpenDockedEditor` 函数，因为其功能被新的 `openEditorForInput` 逻辑取代。
    *   注释掉了 `EditorOpeningContext` 的导入，因为它不再由 `BaseNode.vue` 直接构建并传递给协调器。

**模板 (`<template>`) 部分的主要改动尝试：**

1.  **按钮的统一渲染**：
    *   在 `.param-header` 内，通过 `v-else-if="showActionButtonsForInput(input)"` 条件渲染统一的“预览”和“编辑”按钮组合，使其与插槽名称对齐。

2.  **不同输入类型的条件渲染调整**：
    *   **简单内联输入**：通过 `v-if="isSimpleInlineInput(input) && ..."` 条件渲染。
    *   **代码输入**：依赖 `showActionButtonsForInput` 为真且 `isSimpleInlineInput` 为假，此时只应显示按钮，不应有 `.param-content` 中的内联编辑器。
    *   **多行文本/Markdown (`TextAreaInput`)**：
        *   目标是在 `.param-header` 显示按钮，并在 `.param-content` 中显示一个**可编辑、高度受限**的 `TextAreaInput`。
        *   调整了 `.param-content` 中 `TextAreaInput` 的 `v-if` 条件，确保其在需要时渲染。
        *   确保 `@open-docked-editor="openEditorForInput(input)"` 事件绑定到 `TextAreaInput` 组件上，以便其内部的“编辑”功能（如果由组件自身触发）能正确调用 `BaseNode.vue` 中的逻辑。
    *   **JSON (`JsonInlineViewer`)**：
        *   目标是在 `.param-header` 显示按钮，并在 `.param-content` 中显示一个**只读、高度受限**的 `JsonInlineViewer`。
        *   调整了 `.param-content` 中 `JsonInlineViewer` 的 `v-if` 条件。
        *   确保 `@open-docked-editor="openEditorForInput(input)"` 事件绑定。

3.  **类型断言的使用**：
    *   在模板中多处对 `input.key` 的访问，使用了 `(input as any).key` 来临时解决 TypeScript Linter 可能的类型推断错误。

4.  **`nodeGroupInfo` 的安全访问**：
    *   在模板中访问 `nodeGroupInfo` 的属性（如 `nodeGroupInfo.nodeCount`）之前，添加了 `<template v-if="nodeGroupInfo">` 来进行空值检查。

**遇到的主要问题和解决方案尝试：**

1.  **`apply_diff` 多次失败**：主要原因是 SEARCH 块与文件当前内容不匹配，这通常由于连续的、部分成功的 `apply_diff` 操作导致文件状态与预期不符。最终采用 `write_to_file` 来确保文件内容的一致性。
2.  **`<script setup>` 块的括号/语法错误**：
    *   `isSimpleInlineInput` 函数末尾的括号问题，多次尝试修复，最终通过 `write_to_file` 修正。
    *   `showActionButtonsForInput` 函数末尾曾出现多余的 `};`，也通过 `write_to_file` 修正。
    *   Linter 曾报错 `</script>` 处应为 `}`，这通常指示 `<script setup>` 内部有未闭合的块。通过 `write_to_file` 重新构建整个脚本部分后，此类结构性问题应得到解决。
3.  **TypeScript 类型错误**：
    *   **`interactionCoordinator.openDockedEditorForNodeInput` 参数数量**：最初理解为接收 `EditorOpeningContext`，后查阅其定义发现需要6个独立参数，并据此修改了调用方式。
    *   **模板中辅助函数找不到**：在 `<script setup>` 中定义的函数在模板中无法访问，这通常与脚本块的整体解析状态有关。通过 `write_to_file` 确保所有函数都在顶级作用域正确定义后，此问题应得到解决。
    *   **`InputDefinition.key` 找不到**：尽管类型定义中存在 `key`，但在 `BaseNode.vue` 的 `v-for` 循环中，`input` 的类型有时未被正确推断。临时解决方案是在模板中使用 `(input as any).key`。
    *   **`EditorOpeningContext` 的 `editorId` 问题**：确认了该类型定义中不包含 `editorId`，因此在 `BaseNode.vue` 中不应尝试创建或传递此属性给协调器（协调器内部会处理）。
    *   **`MarkdownRenderer` 的 props**：将其 `source` prop 修改为正确的 `markdownContent`。

通过一系列的 `read_file`, `apply_diff`, 以及最终的 `write_to_file` 操作，我们逐步修正了 [`BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue:0) 中的问题，使其更接近预期的设计。用户反馈表明主要的结构性错误已消失，并且预览和编辑图标已按预期出现。后续可能需要进一步微调模板以完全匹配UI布局细节。
