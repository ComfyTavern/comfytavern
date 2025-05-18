# ComfyTavern 编辑与预览 UI 增强设计方案 (v3 - 插槽标记预览)

## 1. 引言与目标

本文档旨在为 ComfyTavern 项目的 UI 交互体验提供增强设计方案，特别是针对节点输出的**内容预览**和节点复杂输入的**内容编辑**功能。核心目标是实现一个清晰、高效、符合用户直觉的 UI 方案，主要包括：

1.  **右侧专用预览面板**: 提供一个专门的区域，用于实时预览通过在输出插槽上直接标记的节点输出内容。
2.  **底部弹出式编辑面板**: 为代码、Markdown、JSON 等长文本或复杂输入提供一个横向空间充足、功能完善的编辑环境，此面板由画布节点内部的特定触发器激活。
3.  **节点内部输入控件优化**: 对于不适合在节点内部直接编辑的复杂输入，节点内部将显示一个触发按钮，用以激活底部编辑面板。简单输入则继续在节点内部直接编辑。

此方案旨在优化现有直接在节点内部编辑所有类型输入的体验，特别是针对复杂内容，同时提供强大的预览能力。它整合了以下关键信息：
-   对 Blender 等成熟节点工具交互模式的借鉴（直接在插槽上标记预览）。
-   用户关于预览和编辑分离、以及专用编辑区域的偏好。
-   对当前节点属性直接在节点内部编辑的现状的认知。
-   对代码编辑器（特别是搜索功能）的改进需求。

## 2. 核心交互面板与组件

### 2.1. 右侧专用预览面板 (`RightPreviewPanel.vue` - 暂定名)

#### 2.1.1. 定位与职责
此面板固定于画布最右侧，专门用于显示通过在画布节点的输出插槽上标记的预览目标所对应的节点输出内容。

#### 2.1.2. 功能与特性
-   **可展开/收起**: 用户可以控制面板的显示与隐藏。
-   **宽度可调**: 用户可以拖拽调整面板宽度。状态通过 `localStorage` 持久化。
-   **内容渲染**: 根据数据类型、`matchCategories` 和 `config.languageHint` 自动选择渲染方式（纯文本、Markdown、JSON、图片等），内容只读。
    -   **图片处理**: 如果数据是图片 URL，则加载并显示图片；如果是 Base64 编码的图片数据或者图片对象，则直接渲染。需要考虑合适的错误处理和加载状态显示。
    -   **音频/视频处理**: 类似图片处理，但需要考虑视频播放器的加载和播放等控件。
-   **触发机制**: 当工作流中某个输出插槽被标记为预览目标时，其数据自动显示在此面板。在任何时候，只允许一个输出插槽作为预览目标。

#### 2.1.3. 单一预览源
系统在任何时候仅支持一个活动的预览源。当新的输出插槽被标记为预览时，任何先前标记的插槽将自动取消预览状态。

### 2.2. 底部弹出式编辑面板 (`BottomEditorPanel.vue` - 暂定名)

#### 2.2.1. 定位与职责
从画布底部向上滑出，为代码、Markdown、JSON 等长文本/复杂输入提供专用编辑环境。

#### 2.2.2. 功能与特性
-   **触发机制**:
    -   当节点某个输入字段的 `InputDefinition.config.bottomEditor` (统一配置项名称) 设置为 `true` 时。
    -   在画布的该**节点内部**，此输入字段将显示一个**“编辑”按钮**或一个指示可点击的区域（例如，显示内容摘要并提示“点击编辑完整内容”），替代原有的直接输入控件。
    -   用户点击此节点内部的按钮/区域后，底部编辑面板弹出。此时，需要向 `BottomEditorPanel.vue` 传递以下上下文信息：
        -   `nodeId: string`
        -   `inputKey: string`
        -   `currentValue: any`
        -   `inputDefinition: InputDefinition` (或其关键部分，至少包含 `dataFlowType`, `matchCategories`, `config` 以便正确配置编辑器)
-   **高度可调**: 用户可拖拽调整面板高度。状态通过 `localStorage` 持久化。
-   **横向空间充足**: 为代码等内容提供良好视野。
-   **集成代码编辑器**:
    -   基于 CodeMirror 6 (例如，增强现有的 [`CodeInput.vue`](./apps/frontend-vueflow/src/components/graph/inputs/CodeInput.vue) 或创建新组件 `EnhancedCodeEditor.vue`)。
    -   **核心需求**:
        -   **搜索与替换**: 集成 `@codemirror/search`，提供 UI 友好的搜索框 (支持正则、大小写等)，建议搜索框在编辑器顶部。
        -   **语法高亮**: 根据 `inputDefinition.config.languageHint` (javascript, python, json, markdown 等)。
        -   **JSON 内容处理**: 对于 JSON，除了高亮，还应支持自动格式化和基础的语法校验。
        -   行号、自动换行、缩进控制等。
-   **保存与取消**:
    -   明确的“保存”和“取消/关闭”按钮。
    -   “保存”：更新节点数据，触发历史记录，关闭面板。
    -   “取消/关闭”：不保存，关闭面板（可提示“未保存的更改将会丢失”）。
-   **失焦自动保存 (可选与可配置)**:
    -   此功能是否默认启用需仔细评估用户体验。
    -   建议提供一个全局设置或节点级别的配置项来控制是否启用失焦自动保存。如果启用，其行为与点击“保存”按钮一致。

### 2.3. 插槽标记预览机制

#### 2.3.1. 定位与职责
允许用户直接在节点的输出插槽上标记一个作为当前的唯一预览源，其内容将显示在右侧专用预览面板。

#### 2.3.2. 交互方式
-   **右键菜单交互**:
    -   在节点的**输出插槽**上右键，将显示上下文菜单 ([`SlotContextMenu.vue`](apps/frontend-vueflow/src/components/graph/menus/SlotContextMenu.vue:0))。
    -   菜单项包括：“设为预览” (如果该插槽未被预览) 或 “取消预览” (如果该插槽当前为预览目标)。
    -   选择“设为预览”会将此插槽设为唯一的预览目标，并取消其他任何已标记插槽的预览状态。
    -   选择“取消预览”会清除此插槽的预览状态，此时预览面板将清空。
-   **快捷键交互** (相关逻辑可考虑在 [`useCanvasKeyboardShortcuts.ts`](apps/frontend-vueflow/src/composables/canvas/useCanvasKeyboardShortcuts.ts:0) 或新的专用 composable 中实现):
    -   **快捷键 (例如 Alt/Option) + 左键单击节点**: 循环切换该节点下所有**输出插槽**的预览状态。每次点击，会将该节点的下一个输出插槽（按定义顺序）设为预览目标，并取消其他所有插槽的预览状态。如果再次点击已是预览目标的节点的最后一个输出插槽，则可以取消当前工作流的所有预览（即将预览目标设为 `null`）。如果节点没有输出插槽，则此操作无效。
    -   **快捷键 (例如 Alt/Option) + 左键单击输出插槽**: 直接将该输出插槽设为预览目标。如果该插槽已是预览目标，则再次点击会取消其预览状态。任何时候只有一个插槽能被标记。

#### 2.3.3. 状态存储
-   预览目标的信息将存储在工作流的核心数据结构中（例如，`WorkflowStorageItem`，相关定义在 [`packages/types/src/workflow.ts`](packages/types/src/workflow.ts:0) 和 Zod schema [`packages/types/src/schemas.ts`](packages/types/src/schemas.ts:0)）。
-   建议字段：`previewTarget?: { nodeId: string; slotKey: string; } | null;`
    -   `nodeId`: 被标记预览的插槽所在的节点 ID。
    -   `slotKey`: 被标记预览的输出插槽的唯一标识符 (key)。
    -   值为 `null` 表示当前没有活动的预览目标。
-   此状态随工作流一同保存和加载。

#### 2.3.4. UI 表现
-   当一个输出插槽被标记为预览目标（即其 `nodeId` 和 `slotKey` 与 `workflowManager.activePreviewTarget` 的值匹配）时，该插槽的 Handle 在画布上应有清晰的视觉指示器。
    -   **实现方式**: 在 [`BaseNode.vue`](../../apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue) 中，通过比较当前输出插槽的 `nodeId` (来自 `props.id`) 和 `slotKey` 与 `workflowManager.activePreviewTarget.value` 的对应值，动态添加一个特定的 CSS 类 (例如 `styles.handlePreviewing`) 到 Handle 组件上。
    -   **样式**: 此 CSS 类在 [`apps/frontend-vueflow/src/components/graph/nodes/handleStyles.module.css`](../../apps/frontend-vueflow/src/components/graph/nodes/handleStyles.module.css) 中定义，可以表现为光晕、边框高亮或其他醒目的视觉效果。
-   右侧预览面板 ([`RightPreviewPanel.vue`](DesignDocs/architecture/floating-preview-editor-design.md:19)) 始终反映 `previewTarget` 的内容。

### 2.4. 节点内部输入控件 (`BaseNode.vue` / 特定节点类型组件中)

#### 2.4.1. 职责与调整
-   **简单输入**: 继续在节点内部直接渲染对应的输入控件（单行文本、数字、布尔开关、下拉选择等），如现状所示。
-   **复杂输入 (需要底部编辑器)**:
    -   当 `inputDefinition.config.bottomEditor` (统一配置项名称) 为 `true` 时。
    -   节点内部**不直接渲染**该输入的完整编辑控件 (如大的 `textarea` 或嵌入式 CodeMirror)。
    -   而是渲染一个**触发器**：可以是一个“编辑”按钮（例如，标有“编辑代码”、“编辑Markdown”），或者一个显示当前值摘要、点击后可展开编辑的区域。
    -   此触发器负责激活底部编辑面板，并传递必要的上下文给 `BottomEditorPanel.vue`，包括 `nodeId`, `inputKey`, `currentValue` 以及该输入插槽的完整 `InputDefinition` (或其关键部分如 `dataFlowType`, `matchCategories`, `config`)。

### 2.5. 左侧面板 (现状说明)
根据用户反馈，左侧面板目前主要包含如节点库 ([`NodePanel.vue`](apps/frontend-vueflow/src/components/graph/sidebar/NodePanel.vue))、历史记录 ([`HistoryPanel.vue`](apps/frontend-vueflow/src/components/graph/sidebar/HistoryPanel.vue))、工作流管理 ([`WorkflowPanel.vue`](apps/frontend-vueflow/src/components/graph/sidebar/WorkflowPanel.vue))、组IO编辑 ([`GroupIOEdit.vue`](apps/frontend-vueflow/src/components/graph/sidebar/GroupIOEdit.vue)) 等功能。它**不是**一个统一的节点所有属性的编辑中心。节点属性的编辑主要发生在节点自身内部（对于简单属性）或通过底部编辑面板（对于复杂属性）。

## 3. 预览机制 (插槽标记与右侧预览面板)

### 3.1. 核心流程
1.  用户通过右键点击输出插槽并选择“设为预览”，或使用快捷键（例如 Alt + 点击节点/输出插槽）来标记一个输出插槽作为预览目标。
2.  工作流状态中的 `previewTarget` 字段被更新为所选插槽的 `nodeId` 和 `slotKey`。
3.  任何先前标记的预览目标会自动取消。
4.  右侧预览面板 ([`RightPreviewPanel.vue`](DesignDocs/architecture/floating-preview-editor-design.md:19)) 监听到 `previewTarget` 的变化。
5.  预览面板根据 `previewTarget` 中的 `nodeId` 和 `slotKey`，获取对应节点该输出插槽的当前数据。
6.  获取到的数据在预览面板中渲染显示。
7.  当被预览插槽的上游节点数据更新导致该插槽的输出变化时，预览面板应自动更新显示内容。
8.  用户可以通过再次操作（右键取消或快捷键）清除预览标记，此时 `previewTarget` 设为 `null`，预览面板清空。

### 3.2. 状态管理
-   右侧预览面板的可见性、宽度等 UI 状态持久化到 `localStorage`。
-   当前的预览目标 (`previewTarget: { nodeId: string, slotKey: string } | null`) 作为工作流核心数据的一部分，随工作流一同保存和加载，并应纳入历史记录管理。将其纳入历史记录的目的是使得“设置/取消预览目标”这一操作本身成为可撤销/重做的步骤。

### 3.3. 节点/插槽/连接删除处理
-   **预览目标节点被删除**: 如果 `previewTarget` 指向的节点被删除，`previewTarget` 应自动设为 `null`，预览面板清空。
-   **预览目标插槽消失**: 如果由于节点定义更新等原因，`previewTarget` 指向的插槽不再存在于对应节点上，`previewTarget` 应自动设为 `null`，预览面板清空。
-   **清除预览标记**: 用户主动清除预览标记，`previewTarget` 设为 `null`，预览面板清空。

## 4. 编辑机制 (底部编辑面板与节点内部触发)

### 4.1. 核心流程
1.  用户在画布的某个节点内部，找到一个配置为使用底部编辑器的复杂输入字段。该字段显示为一个“编辑”按钮或可点击的摘要区域。
2.  用户点击此节点内部的触发器。
3.  底部编辑面板从下方滑出，加载该字段的当前值和相关 `InputDefinition` 到代码编辑器。
4.  用户修改内容。
5.  用户点击“保存”：更新节点数据，创建历史记录，关闭面板。
6.  用户点击“取消/关闭”：关闭面板，不保存。

### 4.2. 状态管理
底部编辑面板的可见性、高度等状态持久化到 `localStorage`。当前编辑上下文 (`nodeId`, `inputKey`, `inputDefinition`) 需传递给面板。

### 4.3. 节点/端口删除处理
若正在编辑其输入的节点被删除，底部面板应关闭。

## 5. 数据流与状态同步 (总结)

### 5.1. 预览数据流
用户标记输出插槽 -> 工作流状态 (`previewTarget`) 更新 -> 右侧预览面板获取并显示对应插槽数据。

### 5.2. 编辑数据流
画布节点内部“编辑”按钮点击 (携带 `nodeId`, `inputKey`, `currentValue`, `inputDefinition`) -> 底部编辑面板显示 -> 用户编辑 -> “保存” -> `workflowStore.updateNodeInputValue()` -> 节点数据更新 & 历史记录 -> 面板关闭。

## 6. 内容渲染策略 (汇总)

### 6.1. 右侧专用预览面板 (只读)
Markdown 渲染效果，代码/JSON 高亮格式化（JSON 应支持折叠），图片直接渲染（处理 URL 和 Base64），其他纯文本。

### 6.2. 底部编辑面板 (可编辑)
通过集成的 CodeMirror 6 处理：Markdown 模式 (可带预览)，对应代码语言模式 (高亮、搜索、格式化，JSON 支持格式化和校验)，纯文本模式。

## 7. Tooltip 更新 (保留)
节点插槽 Tooltip 显示 `displayName`, `description`, `DataFlowType`, `Match Categories`。

## 8. 面板状态持久化 (localStorage)
-   右侧预览面板: `rightPreviewPanelLayout: { isVisible: boolean, width: number }`
-   底部编辑面板: `bottomEditorPanelLayout: { height: number }`

## 9. (可选/未来展望) 进一步的 UI 增强
可停靠面板系统、多预览目标支持等。

## 10. 实现步骤建议 (高级别)

1.  **代码编辑器组件增强 (`CodeInput.vue` 或新建 `EnhancedCodeEditor.vue`)**:
    *   **首要**: 安装并集成 `@codemirror/search`，配置 `search({ top: true })`，确保搜索 UI 友好。
    *   完善语法高亮，特别是 JSON 的格式化与校验。
2.  **核心类型与状态管理更新**:
    *   在工作流核心数据结构 ([`packages/types/src/workflow.ts`](packages/types/src/workflow.ts:0), [`packages/types/src/schemas.ts`](packages/types/src/schemas.ts:0)) 中添加 `previewTarget` 字段。
    *   在状态管理模块 ([`workflowStore.ts`](apps/frontend-vueflow/src/stores/workflowStore.ts:0) 或相关 composables) 中实现更新和读取 `previewTarget` 的逻辑，并确保纳入历史记录（作为可撤销操作）。
3.  **插槽预览交互实现**:
    *   在输出插槽的右键菜单 ([`SlotContextMenu.vue`](apps/frontend-vueflow/src/components/graph/menus/SlotContextMenu.vue:0)) 中添加“设为预览”/“取消预览”功能。
    *   在 ([`useCanvasKeyboardShortcuts.ts`](apps/frontend-vueflow/src/composables/canvas/useCanvasKeyboardShortcuts.ts:0) 或新 composable) 中实现快捷键标记预览的逻辑。
    *   **预览标记视觉反馈**:
        *   在 [`BaseNode.vue`](../../apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue) 中，使其能够响应 `workflowManager.activePreviewTarget` 的变化。
        *   当某个输出插槽的 `nodeId` 和 `slotKey` 与 `activePreviewTarget.value` 匹配时，为其 Handle 组件动态添加一个特定的 CSS 类 (例如 `styles.handlePreviewing`)。
        *   在 [`apps/frontend-vueflow/src/components/graph/nodes/handleStyles.module.css`](../../apps/frontend-vueflow/src/components/graph/nodes/handleStyles.module.css) 中定义 `styles.handlePreviewing` 样式，以提供清晰的视觉指示（如光晕或边框高亮）。
4.  **实现右侧专用预览面板 (`RightPreviewPanel.vue`)**:
    *   基础布局、使其能响应 `previewTarget` 状态变化。
    *   实现从 `previewTarget` 获取数据并进行内容渲染（多类型支持，包括图片）。
5.  **实现底部弹出式编辑面板 (`BottomEditorPanel.vue`)**:
    *   基础布局、集成增强后的代码编辑器。
    *   实现接收上下文（包括 `inputDefinition`）并据此配置编辑器的逻辑。
6.  **节点内部触发器改造 (`BaseNode.vue` / 特定节点)**:
    *   根据输入配置 (`config.bottomEditor: true`)，渲染“编辑”按钮替代原有复杂输入控件。
    *   实现点击按钮激活底部编辑面板并传递完整上下文。
7.  **完善预览功能**: 状态持久化（面板UI状态）、边界处理（节点/插槽删除等）。
8.  **完善编辑功能**: “保存”/“取消”逻辑、历史记录、状态持久化（面板UI状态）、边界处理、失焦保存(可选，带配置)。
9.  **Tooltip 更新**。
10. **整体测试与细节打磨**。