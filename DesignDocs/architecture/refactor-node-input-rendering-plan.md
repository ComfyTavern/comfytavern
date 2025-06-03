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
    *   **核心职责**：接收一个节点的完整输入定义对象 (`inputDefinition`) 作为输入。其主要任务是根据 `inputDefinition` **决定要渲染的主输入组件的名称 (`componentName`)**，并提供一些基本的UI控制标志。目标是保持工厂的轻量化，避免其自身成为另一个复杂的逻辑中心。
    *   输出一个精简的 **“插槽UI描述对象” (`SlotUIDescriptor`)**。

*   **`SlotUIDescriptor`** (TypeScript接口/类型):
    *   这是一个纯数据对象，主要包含渲染单个输入插槽UI所需的核心指令：
        *   `componentName: string | null`：要渲染的主输入组件的名称 (如 'StringInput', 'CodeInput', 'ButtonInput')。由 `SlotUIDescriptorFactory` 根据 `inputDefinition.config.component` (最高优先级), `inputDefinition.config.displayAs`, `inputDefinition.dataFlowType`, `inputDefinition.matchCategories`, 和 `inputDefinition.config.multiline` 决定。如果为 `null`，则不渲染主输入组件。
        *   `showLabel: boolean`：是否显示标签 (由工厂根据规则判断，例如某些紧凑型输入可能不显示标签)。
        *   `labelText: string`：标签的文本 (通常来源于 `inputDefinition.displayName`)。
        *   `showHandle: boolean`：是否显示连接 Handle (由 `inputDefinition.config.showHandle` 控制，默认为 `true`)。
        *   `customActions?: NodeInputAction[]`：从 `inputDefinition.actions` 提取的自定义动作列表。
        *   注意：`SlotUIDescriptor` 自身不包含传递给主输入组件的详细 `props`。这些 props 将由 `BaseNode.vue` 将原始 `inputDefinition` (或其关键部分) 传递给动态加载的组件，由组件自行解析和使用。


*   **`BaseNode.vue` 的改造**:
    *   其模板中渲染输入插槽的部分将显著简化，主要消除根据输入类型选择不同组件的 `v-if`/`v-else-if` 逻辑。
    *   对于每个输入插槽，它将：
        1.  调用 `SlotUIDescriptorFactory` (或 `useSlotUIDescriptor` Composable) 并传入该插槽的 `inputDefinition`，以获取对应的 `SlotUIDescriptor`。
        2.  `BaseNode.vue` 的模板将使用 `SlotUIDescriptor.componentName` 通过动态组件 `<component :is="descriptor.componentName" ... />` 来渲染主输入UI。
        3.  它会将原始的 `inputDefinition` (或其关键部分，如 `config`, `id`, `displayName`) 以及 `nodeId`, `inputKey` 等上下文信息作为 props 传递给动态加载的组件。各组件自行负责从这些 props 中提取所需的配置。
        4.  标签 (Label) 和连接点 (Handle) 的显示将分别由 `SlotUIDescriptor.showLabel`, `SlotUIDescriptor.labelText`, 和 `SlotUIDescriptor.showHandle` 控制。
        5.  `NodeInputActionsBar` 组件将接收原始 `inputDefinition` (用于生成标准动作和预览) 和 `SlotUIDescriptor.customActions` (自定义动作列表)。
    *   目标是使 `BaseNode.vue` 的模板更简洁，主要负责UI结构和基于 `SlotUIDescriptor` 的基本控制，而不是复杂的条件渲染逻辑。

## 3. UI决策原则与输入源

`SlotUIDescriptorFactory` 在生成 `SlotUIDescriptor` 时，将遵循以下原则和输入源：

*   **输入源**:
    1.  `inputDefinition.config`: 包含众多控制字段，如：
        *   `component: string` (直接指定组件名，具有最高优先级，例如 `ButtonInput` 用于按钮)。
        *   `showHandle: boolean` (可选，默认为 `true`): 控制是否显示连接点。按钮通常设置为 `false`。
        *   `multiline: boolean` (核心标志，用于区分“大块”组件和“小巧”控件)。
        *   `suggestions: any[]` (用于下拉/自动完成)。
        *   `languageHint: string` (用于代码/Markdown等编辑器)。
        *   `label: string` (例如，用于 `ButtonInput` 组件的按钮文本)。
        *   `default`, `placeholder` 等其他相关配置，供具体输入组件按需解析。
    2.  `inputDefinition.dataFlowType: DataFlowTypeName`。
    3.  `inputDefinition.matchCategories: string[]` (例如 `CODE`, `JSON`, `MARKDOWN`, `REGEX_RULE_ARRAY`, `CanPreview`, `NoDefaultEdit`)。按钮不再通过 `TRIGGER` Category 识别，而是通过 `config.component: 'ButtonInput'`。
    4.  `inputDefinition.actions: NodeInputAction[]` (提取为 `SlotUIDescriptor.customActions`)。

*   **核心决策标志：`inputDefinition.config.multiline: true`**
    *   此标志是区分渲染“大块”组件还是“小巧”内联控件的**主要且统一的依据**。
    *   **所有期望渲染为大组件的输入（包括 `STRING` 类型的多行文本、`MARKDOWN` 编辑器、`CODE` 编辑器、`JSON` 编辑器/查看器、`CHAT_HISTORY` 查看器，以及 `ARRAY` 类型的 `REGEX_RULE_ARRAY` 对应的 `InlineRegexRuleDisplay.vue`），都必须在其节点定义的 `config` 中明确设置 `multiline: true`。**
    *   如果 `multiline: true`：`SlotUIDescriptorFactory` 会进一步查看 `dataFlowType` 和 `matchCategories` 来选择合适的“大块”组件，并设置 `SlotUIDescriptor.componentName`。
    *   如果 `multiline: false` (或未定义，默认为 `false`)：则会根据 `dataFlowType` 和 `config` (如 `suggestions`) 选择合适的“小巧”内联控件。

*   **主输入组件的选择优先级 (在 `SlotUIDescriptorFactory` 内部实现)**:
    1.  **`config.component`**: 如果提供，则 `SlotUIDescriptor.componentName` 直接使用此值。
    2.  **基于 `config.multiline` 的决策 (当 `config.component` 未指定时)**:
        *   若 `config.multiline: true`: `SlotUIDescriptorFactory` 会结合 `dataFlowType` 和 `matchCategories` (如 `CODE`, `MARKDOWN`, `REGEX_RULE_ARRAY`) 来选择合适的“大块”组件名 (例如 `CodeInput`, `TextAreaInput`)。
        *   若 `config.multiline: false` (或未定义): `SlotUIDescriptorFactory` 会结合 `dataFlowType` 和 `config` (如 `suggestions` 存在时可能选择 `SelectInput`) 来选择合适的“小巧”内联控件名 (例如 `StringInput`, `NumberInput`)。

*   **`BuiltInSocketMatchCategory` 的角色**:
    *   **内容语义增强**: 主要用于辅助 `SlotUIDescriptorFactory` 在 `config.component` 未指定，且 `config.multiline` 确定的“大/小”组件模式下，进一步细化选择哪个具体组件 (例如，`CODE`, `JSON`, `MARKDOWN`, `REGEX_RULE_ARRAY`)。
    *   **现有UI行为控制**: 用于标记少数已存在的UI行为例外 (如 `CanPreview` 和 `NoDefaultEdit` 会影响 `NodeInputActionsBar` 中标准动作的生成)。

*   **新增 `BuiltInSocketMatchCategory` 原则**:
    *   **克制**。优先利用 `inputDefinition.config` 中的字段进行UI控制。
    *   **`TRIGGER` Category 已被移除**。按钮通过 `config.component: 'ButtonInput'` 和 `config.showHandle: false` 进行定义。
    *   新增UI控制需求时，优先考虑在 `config` 中添加明确的配置字段。

*   **动作按钮 (`NodeInputActionsBar`) 的决策**:
    *   `SlotUIDescriptorFactory` 会将 `inputDefinition.actions` 提取到 `SlotUIDescriptor.customActions`。
    *   `NodeInputActionsBar` 组件接收 `customActions` 和原始的 `inputDefinition`。
    *   `NodeInputActionsBar` 内部会根据 `inputDefinition.matchCategories` (如 `CanPreview`, `NoDefaultEdit`) 来决定是否生成和显示其内置的标准动作（如预览、编辑），并与传入的 `customActions` 合并。
    *   这种方式下，标准动作的生成逻辑保留在 `NodeInputActionsBar` 中，工厂不负责生成标准动作。

## 4. 对现有代码的影响

*   **节点定义**:
    *   需要审查并修改部分现有节点的输入定义，确保所有期望渲染为“大块”内联组件的输入都在其 `config` 中添加 `multiline: true`。例如，[`ApplyRegexNode.ts`](apps/backend/src/nodes/processors/ApplyRegexNode.ts:1) 中的 `inlineRegexRules` 输入。
*   **前端组件**:
    *   [`BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue:1) 将进行重构，其模板中的输入渲染条件判断将基于 `SlotUIDescriptor`。
    *   需要创建新的 `SlotUIDescriptorFactory` (或 Vue Composable `useSlotUIDescriptor`)。
    *   现有的具体输入组件 (如 [`StringInput.vue`](apps/frontend-vueflow/src/components/graph/inputs/StringInput.vue:1), [`InlineRegexRuleDisplay.vue`](apps/frontend-vueflow/src/components/graph/inputs/InlineRegexRuleDisplay.vue:1) 等) 基本保持不变，它们将由 `BaseNode.vue` 根据 `SlotUIDescriptor` 动态加载。
    *   [`getInputComponent`](apps/frontend-vueflow/src/components/graph/inputs/index.ts) 函数 (或类似 `useNodeProps` 中的组件选择逻辑) 的核心职责将被 `SlotUIDescriptorFactory` 取代。但具体的 props 解析和应用逻辑将分散到各个输入组件自身或其辅助工具中。

## 5. 预期收益

*   **优化 `BaseNode.vue` 的模板结构，使其条件渲染逻辑更清晰，降低维护成本。**
*   **UI渲染决策逻辑高度集中和内聚**，更易于理解、测试和扩展。
*   **节点输入UI的行为定义更加清晰、声明式和统一。**
*   **提高添加新输入类型或UI变体的效率和安全性。**

## 6. 下一步详细设计与实施

1.  **最终确定 `SlotUIDescriptor` 接口**：确保其字段精简并满足核心需求。
2.  **实现 `SlotUIDescriptorFactory`**:
    *   实现基于 `inputDefinition` (特别是 `config.component`, `config.displayAs`, `dataFlowType`, `matchCategories`, `config.multiline`) 选择 `componentName` 的逻辑。
    *   实现提取 `showLabel`, `labelText`, `showHandle` (基于 `config.showHandle`) 和 `customActions` 的逻辑。
3.  **修改 `BaseNode.vue`**:
    *   集成 `SlotUIDescriptorFactory` 的调用。
    *   更新模板以使用 `SlotUIDescriptor` 进行动态组件渲染和基本UI元素控制。
    *   确保将原始 `inputDefinition` (或其必要部分) 和上下文 props 传递给动态加载的组件。
    *   确保将 `inputDefinition` 和 `customActions` 传递给 `NodeInputActionsBar`。
4.  **审查并更新现有节点定义**:
    *   确保所有期望渲染为“大块”组件的输入都已设置 `config.multiline: true`。
    *   将所有按钮类型的输入定义更新为使用 `config.component: 'ButtonInput'` 和 `config.showHandle: false`，并移除 `TRIGGER` Category。
5.  **确保各输入组件的适应性**:
    *   各具体输入组件需能从传入的 `inputDefinition` prop (特别是 `config`) 中正确解析和使用其所需的配置项。
    *   它们应继续使用 `useNodeState` 处理值的获取/更新和连接状态。
6.  **更新相关文档**: 包括节点开发指南和类型定义。