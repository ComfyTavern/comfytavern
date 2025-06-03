# 重构节点输入UI渲染逻辑规划文档

## 1. 背景与目标

当前项目中的核心节点组件（特别是 `apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue`）在其模板内部包含了大量用于渲染不同类型输入插槽UI的条件逻辑（`v-if`/`v-else-if`）。这种方式导致了以下问题：

*   **`BaseNode.vue` 组件过于臃肿复杂**：难以阅读、理解和维护。
*   **UI渲染逻辑分散**：部分逻辑可能散布在 `BaseNode.vue` 的模板、计算属性以及辅助函数（如 `isSimpleInlineInput`）中。
*   **扩展性差**：添加新的输入UI变体或修改现有逻辑时，容易引入错误，且改动成本高。
*   **规则不统一**：对于如何决定一个输入应该渲染成“大块”组件（如多行编辑器）还是“小巧”控件（如单行输入框），以及何时显示动作按钮等，缺乏一个清晰、统一的规则集，导致了用户指出的“混乱感”。

**目标：**

通过对节点输入插槽的UI渲染逻辑进行重构，实现以下目标：

*   **高度解耦**：将UI渲染决策逻辑与 `BaseNode.vue` 的核心结构分离。
*   **逻辑集中**：将所有关于“如何根据输入定义决定UI展现”的复杂逻辑集中到单一、可维护的模块中。
*   **规则统一**：建立清晰、一致的规则来决定输入控件的类型、大小、以及相关UI元素（标签、Handle、动作按钮）的显示。
*   **提升可维护性与灵活性**：使添加新输入UI或调整现有行为变得更容易、更安全。
*   **`BaseNode.vue` 瘦身**：使其模板更简洁，职责更单一。

## 2. 核心架构方案：`SlotUIDescriptorFactory` 与 `BaseNode.vue` 模板优化

我们将采用一种工厂模式结合通用渲染组件的架构：

*   **`SlotUIDescriptorFactory`** (服务或Vue Composable，例如 `useSlotUIDescriptor`):
    *   **职责**：接收一个节点的完整输入定义对象 (`inputDefinition`) 作为输入。
    *   经过内部一系列清晰的决策逻辑后，输出一个结构化的 **“插槽UI描述对象” (`SlotUIDescriptor`)**。
    *   这是所有UI渲染决策逻辑的**唯一集中地**。

*   **`SlotUIDescriptor`** (TypeScript接口/类型):
    *   这是一个纯数据对象，包含了渲染单个输入插槽UI所需的所有指令和信息。例如：
        *   `componentName: string | null`：要渲染的主输入组件的名称 (如 'StringInput', 'InlineRegexRuleDisplay', 'CodeEditor')，或者由 `config.component` 指定的自定义组件名。如果为 `null`，则不渲染主输入组件。
        *   `componentProps: Record<string, any>`：传递给主输入组件的 props。
        *   `showLabel: boolean`：是否显示标签。
        *   `labelText: string`：标签的文本 (通常来源于 `inputDefinition.displayName`；对于按钮类输入，可能来源于 `inputDefinition.config.label`)。
        *   `showHandle: boolean`：是否显示连接 Handle。
        *   `handleType: 'target' | 'source'` (对于输入总是 'target')。
        *   `handleId: string`。
        *   `actions: NodeInputAction[] | null`：传递给 `NodeInputActionsBar` 的动作按钮配置列表，如果为 `null` 则不显示动作条。
        *   `layoutHints: string[]`：可选的布局提示 (如 'compact', 'full-width')。
        *   其他必要的UI控制标志。


*   **`BaseNode.vue` 的改造**:
    *   其模板中渲染输入插槽的部分将进行优化。虽然渲染逻辑仍在 `BaseNode.vue` 中，但条件判断将基于 `SlotUIDescriptor`，而不是直接解析 `inputDefinition` 中的多个离散属性。
    *   对于每个输入插槽，它将：
        1.  调用 `SlotUIDescriptorFactory` (或 `useSlotUIDescriptor` Composable) 并传入该插槽的 `inputDefinition`，以获取对应的 `SlotUIDescriptor`。
        2.  `BaseNode.vue` 的模板将直接使用这个 `SlotUIDescriptor` 的属性来决定如何渲染UI元素（如Handle、标签、主输入组件、动作按钮等），通过 `v-if` 和动态组件 `<component :is="slotUIDescriptor.componentName" ... />` 实现。
    *   目标是使 `BaseNode.vue` 内部的渲染逻辑更加清晰和结构化，减少直接依赖 `inputDefinition` 原始字段的复杂判断。

## 3. UI决策原则与输入源

`SlotUIDescriptorFactory` 在生成 `SlotUIDescriptor` 时，将遵循以下原则和输入源：

*   **输入源**:
    1.  `inputDefinition.config`: 包含众多控制字段，如：
        *   `component: string` (直接指定组件名，具有最高优先级)。
        *   `multiline: boolean` (**核心标志**，用于区分“大块”组件和“小巧”控件)。
        *   `suggestions: any[]` (用于下拉/自动完成)。
        *   `languageHint: string` (用于代码/Markdown等编辑器，是前端组件如 `RichCodeEditor` 期望的 prop 名称)。
        *   `default`, `placeholder`, `label` (主要用于按钮类型输入的显示文本) 等。
        *   *未来可在此处添加更多精细的UI控制配置。*
    2.  `inputDefinition.dataFlowType: DataFlowTypeName`。
    3.  `inputDefinition.matchCategories: string[]` (使用现有为主，如 `CODE`, `JSON`, `MARKDOWN`, `REGEX_RULE_ARRAY`, `CanPreview`, `NoDefaultEdit`, `TRIGGER`)。
    4.  `inputDefinition.actions: NodeInputAction[]` (用于定义自定义操作按钮)。

*   **核心决策标志：`inputDefinition.config.multiline: true`**
    *   此标志是区分渲染“大块”组件还是“小巧”内联控件的**主要且统一的依据**。
    *   **所有期望渲染为大组件的输入（包括 `STRING` 类型的多行文本、`MARKDOWN` 编辑器、`CODE` 编辑器、`JSON` 编辑器/查看器、`CHAT_HISTORY` 查看器，以及 `ARRAY` 类型的 `REGEX_RULE_ARRAY` 对应的 `InlineRegexRuleDisplay.vue`），都必须在其节点定义的 `config` 中明确设置 `multiline: true`。**
    *   如果 `multiline: true`：`SlotUIDescriptorFactory` 会进一步查看 `dataFlowType` 和 `matchCategories` 来选择合适的“大块”组件，并设置 `SlotUIDescriptor.componentName`。
    *   如果 `multiline: false` (或未定义，默认为 `false`)：则会根据 `dataFlowType` 和 `config` (如 `suggestions`) 选择合适的“小巧”内联控件。

*   **主输入组件的选择优先级 (在 `SlotUIDescriptorFactory` 内部实现)**:
    1.  **`config.component`**: 如果提供，则 `SlotUIDescriptor.componentName` 直接使用此值。
    2.  **（待评估）`UI_NO_DEFAULT_INPUT_WIDGET` Category**: 如果存在此 Category，则 `SlotUIDescriptor.componentName` 可能为 `null`，不渲染任何主输入控件。
    3.  **基于 `config.multiline` 的决策**:
        *   若 `config.multiline: true`: 根据 `dataFlowType` 和 `matchCategories` (如 `CODE`, `MARKDOWN`, `REGEX_RULE_ARRAY`) 确定具体的“大块”组件名。若无特定匹配，`STRING` 类型默认为多行文本区域。
        *   若 `config.multiline: false` (或未定义): 根据 `dataFlowType` 和 `config` (如 `suggestions` for combo boxes, `TRIGGER` Category for buttons) 确定具体的“小巧”控件名。

*   **`BuiltInSocketMatchCategory` 的角色**:
    *   **内容语义增强**: 主要用于辅助 `SlotUIDescriptorFactory` 在 `config.multiline` 确定的“大/小”组件模式下，进一步细化选择哪个具体组件 (例如，`CODE`, `JSON`, `MARKDOWN`, `REGEX_RULE_ARRAY`, `TRIGGER`)。
    *   **现有UI行为控制**: 用于标记少数已存在的UI行为例外 (如 `CanPreview` 会影响 `SlotUIDescriptor.actions` 的内容，`NoDefaultEdit` 也会影响默认动作的生成)。

*   **新增 `BuiltInSocketMatchCategory` 原则**:
    *   **克制**。优先利用现有 `config` 字段和已有的 Category 组合。
    *   只有当一种必要的、少见的UI行为无法通过现有机制优雅表达，或会导致 `SlotUIDescriptorFactory` 逻辑异常复杂时，才考虑新增极少量的、目的明确的Category。
    *   目前，除了可能保留评估的 `UI_NO_DEFAULT_INPUT_WIDGET`，倾向于不新增其他UI控制类Category，而是鼓励通过 `config` 字段或 `actions` 定义来实现。
    *   如果增加一个新字段特别有用那就加上吧。

*   **动作按钮 (`NodeInputActionsBar`) 的决策**:
    *   其是否显示以及显示哪些按钮，将由 `SlotUIDescriptorFactory` 根据以下因素综合判断，并填充到 `SlotUIDescriptor.actions` 属性中：
        *   `inputDefinition.actions` 数组中定义的自定义操作。
        *   `inputDefinition.matchCategories` 中是否包含 `CanPreview`。
        *   该输入类型是否通常有关联的默认编辑操作，并且 `inputDefinition.matchCategories` 中不包含 `NoDefaultEdit`。
        *   （已移除）不再需要 `UI_OPENS_MODAL_...` Category，此功能应通过 `inputDefinition.actions` 实现。
    *   这将解耦动作按钮的逻辑，使其可以灵活配置给任何输入，无论其主控件是大是小。

## 4. 对现有代码的影响

*   **节点定义**:
    *   需要审查并修改部分现有节点的输入定义，确保所有期望渲染为“大块”内联组件的输入都在其 `config` 中添加 `multiline: true`。例如，[`ApplyRegexNode.ts`](apps/backend/src/nodes/processors/ApplyRegexNode.ts:1) 中的 `inlineRegexRules` 输入。
*   **前端组件**:
    *   [`BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue:1) 将进行重构，其模板中的输入渲染条件判断将基于 `SlotUIDescriptor`。
    *   需要创建新的 `SlotUIDescriptorFactory` (或 Vue Composable `useSlotUIDescriptor`)。
    *   现有的具体输入组件 (如 [`StringInput.vue`](apps/frontend-vueflow/src/components/graph/inputs/StringInput.vue:1), [`InlineRegexRuleDisplay.vue`](apps/frontend-vueflow/src/components/graph/inputs/InlineRegexRuleDisplay.vue:1) 等) 基本保持不变，它们将由 `BaseNode.vue` 根据 `SlotUIDescriptor` 动态加载。
    *   [`getInputComponent`](apps/frontend-vueflow/src/components/graph/inputs/index.ts) 函数的职责可能会被 `SlotUIDescriptorFactory` 吸收或调整。

## 5. 预期收益

*   **优化 `BaseNode.vue` 的模板结构，使其条件渲染逻辑更清晰，降低维护成本。**
*   **UI渲染决策逻辑高度集中和内聚**，更易于理解、测试和扩展。
*   **节点输入UI的行为定义更加清晰、声明式和统一。**
*   **提高添加新输入类型或UI变体的效率和安全性。**

## 6. 下一步详细设计与实施

1.  **定义 `SlotUIDescriptor` 接口**：明确其包含的所有字段及其类型。
2.  **设计 `SlotUIDescriptorFactory` 的详细逻辑**:
    *   绘制决策流程图或编写伪代码。
    *   明确处理各种 `inputDefinition` 组合的规则。
3.  **识别并修改需要更新 `config.multiline: true` 的现有节点定义**。
4.  **（可选）进一步评估是否确实需要 `UI_NO_DEFAULT_INPUT_WIDGET` Category**，或者是否有其他方式实现其意图。
5.  **分步实施**：
    *   可以先从 `SlotUIDescriptor` 定义和 `SlotUIDescriptorFactory` 的骨架开始。
    *   逐步将 `BaseNode.vue` 中的输入渲染逻辑重构为基于 `SlotUIDescriptor`。
    *   最后更新节点定义和相关文档。