# ComfyTavern 编辑与预览 UI 增强设计方案 (v3 - 插槽标记预览)

## 1. 引言与目标

本文档旨在为 ComfyTavern 项目的 UI 交互体验提供增强设计方案，特别是针对节点输出的**内容预览**和节点复杂输入的**内容编辑**功能。核心目标是实现一个清晰、高效、符合用户直觉的 UI 方案，主要包括：

1.  **右侧专用预览面板**: 提供一个专门的区域，用于实时预览通过在输出插槽上直接标记的节点输出内容。
2.  **可停靠编辑器面板**: 为代码、Markdown、JSON 等长文本或复杂输入提供一个横向空间充足、功能完善的编辑环境，此面板由画布节点内部的特定触发器激活，其位置可配置（当前默认为画布底部）。
3.  **节点内部输入控件优化**: 对于不适合在节点内部直接编辑的复杂输入，节点内部将显示一个触发按钮，用以激活可停靠编辑器面板。简单输入则继续在节点内部直接编辑。

此方案旨在优化现有直接在节点内部编辑所有类型输入的体验，特别是针对复杂内容，同时提供强大的预览能力。它整合了以下关键信息：
-   对 Blender 等成熟节点工具交互模式的借鉴（直接在插槽上标记预览）。
-   用户关于预览和编辑分离、以及专用编辑区域的偏好。
-   对当前节点属性直接在节点内部编辑的现状的认知。
-   对代码编辑器（特别是搜索功能）的改进需求。

---

**重要说明：关于可停靠编辑器面板的详细设计**

本文档中后续章节（特别是 2.2、4、5.2、6.2 及相关实现步骤）所提及的“可停靠编辑器面板”（之前称为“底部弹出式编辑面板”）的详细设计、组件架构（如 `DockedEditorWrapper.vue`, `TabbedEditorHost.vue`, `RichCodeEditor.vue`）、交互行为（如标签页管理、面包屑导航）以及具体实现阶段，均已在另一份更为详尽的文档 **[`DesignDocs/architecture/enhanced-editor-panel-design.md`](DesignDocs/architecture/enhanced-editor-panel-design.md)** 中进行了阐述。

本文档将对这些概念进行概述性引用，但强烈建议读者查阅上述增强设计文档以获取最全面和最新的信息。后续描述中，对编辑器面板的称呼将尽量采用“可停靠编辑器面板”或更通用的术语，以反映其位置可配置的特性。

---

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

### 2.2. 可停靠编辑器面板核心架构 (详见增强设计文档)

#### 2.2.1. 定位与职责
此面板提供一个专用的、功能丰富的编辑环境，用于处理代码、Markdown、JSON 等长文本或复杂输入。其位置可配置（当前默认为画布底部），并由画布节点内部的特定触发器激活。详细架构请参考 [`DesignDocs/architecture/enhanced-editor-panel-design.md`](DesignDocs/architecture/enhanced-editor-panel-design.md)。

#### 2.2.2. 核心组件概述 (详见增强设计文档)
该面板的核心架构主要包括：
-   **`DockedEditorWrapper.vue`**: 作为编辑器场景的包装器，管理整个可停靠编辑面板的 UI 状态（如显示/隐藏、尺寸调整、停靠位置），并根据节点输入配置按需加载合适的编辑模式（单页或多标签）。它还负责收集上下文信息（如面包屑导航数据）并与工作流管理器对接以保存更改。
-   **`TabbedEditorHost.vue` (可选，用于多标签模式)**: 管理多个编辑器实例，每个实例对应一个标签页，提供类似 VSCode 的持久化标签页 UI 和交互逻辑。
-   **`RichCodeEditor.vue`**: 核心的单页编辑器组件，基于 CodeMirror 6，提供语法高亮、搜索替换、面包屑导航等丰富的编辑功能。

#### 2.2.3. 触发与交互 (概述)
-   当节点某个输入字段配置为使用此编辑器时 (例如通过 `InputDefinition.config.editorMode`)，节点内部会显示一个触发器（如“编辑”按钮）。
-   点击触发器后，`DockedEditorWrapper.vue` 会根据配置加载 `RichCodeEditor.vue` (轻量单页模式) 或 `TabbedEditorHost.vue` (全功能多标签模式)。
-   编辑器将接收必要的上下文信息（节点ID、输入键、当前值、输入定义等）以正确初始化。
-   提供明确的保存和取消机制，并支持通过 `localStorage` 持久化面板的 UI 状态（如高度、可见性）。

**更详细的功能、特性、接口设计及状态持久化方案，请参阅 [`DesignDocs/architecture/enhanced-editor-panel-design.md`](DesignDocs/architecture/enhanced-editor-panel-design.md)。**

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

### 2.4. 节点内部输入控件 (`BaseNode.vue` / 各输入组件中)

#### 2.4.1. 职责与调整

节点内部输入控件将根据输入的数据类型 (`dataFlowType` 和 `matchCategories`) 以及少量 `InputDefinition.config` (如 `languageHint`, `readOnly`) 进行差异化渲染，旨在平衡节点内的快速查看/编辑与功能完善的外部编辑器体验。

-   **简单单行输入**:
    -   例如：`STRING` (非多行), `NUMBER`, `BOOLEAN`, `SELECT` (COMBO)。
    -   **行为**: 继续在节点内部参数名旁边直接渲染紧凑的内联输入控件，如现状所示。

-   **多行文本 / Markdown (改造 [`TextAreaInput.vue`](../../apps/frontend-vueflow/src/components/graph/inputs/TextAreaInput.vue))**:
    -   **渲染位置**: 在节点内部，位于参数名下方的多行内容区域。
    -   **UI**:
        -   一个**高度受限**的文本区域，用于节点内直接编辑 (例如，默认3-5行，具体高度可硬编码或未来通过用户配置设定)。**不再支持拖拽调整大小**。
        -   文本区域旁边或下方集成两个小图标按钮：
            -   **预览按钮 (👁️)**: 鼠标悬停或点击时，触发 [`Tooltip.vue`](../../apps/frontend-vueflow/src/components/common/Tooltip.vue) 显示内容预览（Markdown应渲染，纯文本直接显示，内容按预设行数截断）。
            -   **编辑按钮 (✏️)**: 点击时，激活“可停靠编辑器面板” ([`DockedEditorWrapper.vue`](../../apps/frontend-vueflow/src/components/graph/editor/DockedEditorWrapper.vue)) 进行完整编辑。
    -   **交互**: 用户可以在节点内进行简单编辑，或选择通过按钮进行预览或跳转到功能更全的编辑器。

-   **代码 (改造 [`CodeInput.vue`](../../apps/frontend-vueflow/src/components/graph/inputs/CodeInput.vue))**:
    -   **渲染位置**: 在节点内部，与参数名在同一行，位于通常放置单行输入控件的区域。
    -   **UI**:
        -   节点内部**不渲染**任何形式的编辑器。
        -   只显示两个水平排列的小图标按钮：
            -   **预览按钮 (👁️)**: 触发 [`Tooltip.vue`](../../apps/frontend-vueflow/src/components/common/Tooltip.vue) 显示代码片段预览（例如前30行，带语法高亮，依赖 `inputDefinition.config.languageHint` 和增强后的Tooltip）。
            -   **编辑按钮 (✏️ 或 </>)**: 点击时，激活“可停靠编辑器面板” ([`DockedEditorWrapper.vue`](../../apps/frontend-vueflow/src/components/graph/editor/DockedEditorWrapper.vue))。
    -   **交互**: 只能通过按钮进行预览或跳转到外部编辑器。

-   **JSON (新建 `JsonInlineViewer.vue`)**:
    -   **渲染位置**: 在节点内部，位于参数名下方的多行内容区域。
    -   **UI**:
        -   一个**高度受限的、只读的** JSON 树状预览或美化后的文本预览。
        -   旁边或下方集成一个**编辑按钮 (✏️)**，点击激活“可停靠编辑器面板” ([`DockedEditorWrapper.vue`](../../apps/frontend-vueflow/src/components/graph/editor/DockedEditorWrapper.vue))，使用 [`RichCodeEditor.vue`](../../apps/frontend-vueflow/src/components/common/RichCodeEditor.vue) 的 JSON 模式进行完整编辑。
        -   (可选) 一个**预览按钮 (👁️)**，如果内联预览信息不足，可使用 [`Tooltip.vue`](../../apps/frontend-vueflow/src/components/common/Tooltip.vue) 显示更多格式化的JSON片段。
    -   **交互**: 节点内主要用于查看，编辑需跳转。

#### 2.4.2. 激活可停靠编辑器
所有类型的“编辑按钮”在点击后，都会负责收集必要的上下文信息（`nodeId`, `inputKey`, `currentValue`, `inputDefinition` 等），并触发相应的事件或调用协调器函数，以激活“可停靠编辑器面板” ([`DockedEditorWrapper.vue`](../../apps/frontend-vueflow/src/components/graph/editor/DockedEditorWrapper.vue))，并将上下文传递给它。

### 2.5. 左侧面板 (现状说明)
根据用户反馈，左侧面板目前主要包含如节点库 ([`NodePanel.vue`](apps/frontend-vueflow/src/components/graph/sidebar/NodePanel.vue))、历史记录 ([`HistoryPanel.vue`](apps/frontend-vueflow/src/components/graph/sidebar/HistoryPanel.vue))、工作流管理 ([`WorkflowPanel.vue`](apps/frontend-vueflow/src/components/graph/sidebar/WorkflowPanel.vue))、组IO编辑 ([`GroupIOEdit.vue`](apps/frontend-vueflow/src/components/graph/sidebar/GroupIOEdit.vue)) 等功能。它**不是**一个统一的节点所有属性的编辑中心。节点属性的编辑主要发生在节点自身内部（对于简单属性）或通过可停靠编辑器面板（对于复杂属性）。

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

### 3.4 预览触发与错误处理

#### 3.4.1 自动触发机制
- **触发条件**:
  - 预览开关处于开启状态
  - 发生能触发历史记录的操作，包括：
    - 节点输入值修改
    - 节点连接变更
    - 节点添加/删除
    - 撤销/重做操作
    - 节点绕过状态切换
- **防抖处理**:
  ```typescript
  const debouncedPreviewRequest = useDebouncedRef((trigger: HistoryTrigger) => {
    if (!previewSettings.value.enabled) return;
    executePreviewRequest({
      workflowId: currentWorkflow.value?.id,
      changedNodeId: trigger.nodeId,
      inputKey: trigger.inputKey,
      newValue: trigger.newValue
    });
  }, 300);
  ```

#### 3.4.2 预览状态持久化
```typescript
interface PreviewSettings {
  enabled: boolean;
  lastActiveWorkflow?: string;
  workflowSettings: Record<string, {
    enabled: boolean;
    target?: { nodeId: string; slotKey: string; } | null;
  }>;
}
```
- 通过 `localStorage` 存储为 `previewSettings`
- 在工作流切换时自动加载对应的设置

#### 3.4.3 错误处理策略
- **静默处理原则**：
  - 不显示错误弹窗
  - 不中断用户操作
  - 在节点上使用视觉提示（淡红色边框）
  - 错误详情可通过节点的 tooltip 或状态栏查看
- **状态恢复**：
  - 出错节点的输出值保持最后一次成功的预览结果
  - 若无历史预览结果，则显示空值占位符

#### 3.4.4 视觉反馈
- **节点状态指示**：
  ```css
  .node-preview-executing {
    animation: preview-pulse 2s infinite;
    border-color: rgba(59, 130, 246, 0.5);
  }
  
  .node-preview-error {
    border-color: rgba(239, 68, 68, 0.5);
  }
  
  .node-preview-success {
    animation: preview-success-flash 0.5s;
  }
  ```
- **预览开关状态**：
  - 工具栏中的预览开关图标反映当前状态
  - 鼠标悬停时显示当前工作流的预览设置
- **状态栏集成**：
  - 显示最后一次预览的时间和状态
  - 如有错误，提供简短的错误描述

## 4. 编辑机制 (基于可停靠编辑器面板)

### 4.1. 核心流程 (概述)
1.  用户在画布节点的某个输入字段上点击对应的“编辑”按钮（该按钮是节点内部UI的一部分，例如在改造后的 `TextAreaInput.vue`, `CodeInput.vue` 或新建的 `JsonInlineViewer.vue` 中）。
2.  `DockedEditorWrapper.vue` 被激活。它会根据传递的上下文（特别是 `inputDefinition` 中的 `dataFlowType`, `config.languageHint` 等）来决定如何配置内部的 `RichCodeEditor.vue` (例如，设置对应的语言模式：Markdown, JavaScript, JSON 等)。
3.  编辑器加载该字段的当前值和相关 `InputDefinition`。如果使用多标签模式且已存在对应标签，则激活该标签。
4.  用户在编辑器中修改内容。编辑器顶部可能包含面包屑导航，指示当前编辑上下文。
5.  用户通过编辑器界面请求保存（例如点击“保存”按钮，或标签页的保存操作）。
6.  `DockedEditorWrapper.vue` 捕获保存请求，调用 `WorkflowManager` 更新节点数据并创建历史记录。
7.  用户可以关闭编辑器标签页或整个可停靠面板。

### 4.2. 状态管理与持久化
-   可停靠编辑面板的 UI 状态（如可见性、尺寸、停靠位置）通过 `localStorage` 持久化。
-   多标签编辑模式下的标签页状态（如打开的标签列表、活动标签）的持久化方案详见增强设计文档。
-   当前编辑的上下文信息（如 `nodeId`, `inputKey`, `inputDefinition`）在编辑会话期间由 `DockedEditorWrapper.vue` 管理并传递给相应的编辑器实例。

### 4.3. 节点/端口删除处理
若正在编辑其输入的节点被删除，相关的编辑会话（如标签页）应被妥善处理（例如关闭），并且可停靠面板本身可能根据情况关闭或清空。

**详细的标签页行为、面包屑导航、按需加载编辑模式以及状态持久化策略，请参阅 [`DesignDocs/architecture/enhanced-editor-panel-design.md`](DesignDocs/architecture/enhanced-editor-panel-design.md)。**

## 5. 数据流与状态同步 (总结)

### 5.1. 预览数据流
用户标记输出插槽 -> 工作流状态 (`previewTarget`) 更新 -> 右侧预览面板获取并显示对应插槽数据。

### 5.2. 编辑数据流 (可停靠编辑器面板)
画布节点内部“编辑”按钮点击 (携带 `nodeId`, `inputKey`, `currentValue`, `inputDefinition`, `editorMode` 等上下文) -> `DockedEditorWrapper.vue` 激活并根据 `editorMode` 加载/配置编辑器 (`RichCodeEditor.vue` 或 `TabbedEditorHost.vue`) -> 用户编辑 -> 编辑器内部触发保存 -> `DockedEditorWrapper.vue` 统一处理保存请求 -> `workflowManager.updateNodeInputValue()` -> 节点数据更新 & 历史记录 -> 编辑器/面板按需关闭或更新状态。

## 6. 内容渲染策略 (汇总)

### 6.1. 右侧专用预览面板 (只读)
Markdown 渲染效果，代码/JSON 高亮格式化（JSON 应支持折叠），图片直接渲染（处理 URL 和 Base64），其他纯文本。

### 6.2. 可停靠编辑器面板 (可编辑, 基于 RichCodeEditor.vue)
内容渲染和编辑功能主要由核心的 `RichCodeEditor.vue` 组件（基于 CodeMirror 6）提供。它支持：
-   Markdown 模式 (可配置实时预览或分栏预览)。
-   特定代码语言模式 (如 JavaScript, Python, JSON)，提供语法高亮、智能提示（若配置）、搜索与替换、自动格式化等。
-   JSON 内容特别支持格式化和基础语法校验。
-   纯文本模式。
详见 [`DesignDocs/architecture/enhanced-editor-panel-design.md`](DesignDocs/architecture/enhanced-editor-panel-design.md) 中关于 `RichCodeEditor.vue` 的描述。

## 7. Tooltip 更新 (保留)
节点插槽 Tooltip 显示 `displayName`, `description`, `DataFlowType`, `Match Categories`。

## 8. 面板状态持久化 (localStorage)
-   右侧预览面板: `rightPreviewPanelLayout: { isVisible: boolean, width: number }`
-   可停靠编辑器面板: `dockedEditorLayout: { isVisible: boolean, height: number, width?: number, position?: 'bottom' | 'top' | 'left' | 'right', isResident?: boolean }` (具体结构参考增强设计文档)

## 9. (可选/未来展望) 进一步的 UI 增强
可停靠面板系统、多预览目标支持等。

## 10. 实现步骤建议 (高级别 - 详见增强设计文档)

以下步骤概述了实现增强型可停靠编辑器面板及其相关功能的建议路径。更详细的迭代计划和组件分解，请参考 **[`DesignDocs/architecture/enhanced-editor-panel-design.md`](DesignDocs/architecture/enhanced-editor-panel-design.md)** 的第 4 节 "实现阶段建议"。

1.  **核心单页编辑器组件 (`RichCodeEditor.vue`)**:
    *   **首要**: 实现基于 CodeMirror 6 的基础编辑功能，包括语法高亮、行号、搜索替换 (集成 `@codemirror/search`)。
    *   实现面包屑导航 UI 及其数据接口。
    *   定义清晰的 Props, Events, Methods 接口。
2.  **标签页宿主组件 (`TabbedEditorHost.vue`) (用于多标签模式)**:
    *   实现标签页 UI 和管理逻辑 (打开、关闭、切换)。
    *   集成 `RichCodeEditor.vue` 作为标签页内容，并传递上下文（如面包屑数据）。
    *   实现“模仿VSCode”的持久化标签行为（初步或完整方案）。
3.  **可停靠编辑器包装器与调度 (`DockedEditorWrapper.vue`)**:
    *   实现面板的停靠、显隐、尺寸调整等 UI 管理。
    *   实现基于节点输入配置 (`config.editorMode`) 的编辑器模式调度逻辑（加载 `RichCodeEditor.vue` 或 `TabbedEditorHost.vue`）。
    *   实现与 `WorkflowManager` 的数据保存对接。
    *   完成面包屑导航数据的收集与传递。
4.  **节点内部输入控件改造 (`BaseNode.vue` / 各输入组件)**:
    *   **改造 `CodeInput.vue`**: 移除编辑器，改为预览和编辑按钮组，放置于参数名同行的右侧。
    *   **改造 `TextAreaInput.vue`**: 限制高度，移除拖拽调整大小，集成预览和编辑按钮，放置于参数名下方的多行内容区。
    *   **新建 `JsonInlineViewer.vue`**: 实现只读JSON预览和编辑按钮，放置于参数名下方的多行内容区。
    *   **更新 `BaseNode.vue`**: 调整模板以正确渲染这些改造后/新建的输入控件，并处理其发出的 `open-docked-editor` 事件。
    *   **更新 `inputs/index.ts`**: 修改 `getInputComponent` 逻辑以根据 `dataFlowType` 和 `matchCategories` 返回正确的输入控件。
5.  **核心类型与状态管理更新 (预览部分)**:
    *   (此部分与预览相关，基本保留原状) 在工作流核心数据结构 ([`packages/types/src/workflow.ts`](packages/types/src/workflow.ts:0), [`packages/types/src/schemas.ts`](packages/types/src/schemas.ts:0)) 中添加 `previewTarget` 字段。
    *   在状态管理模块 ([`workflowStore.ts`](apps/frontend-vueflow/src/stores/workflowStore.ts:0) 或相关 composables) 中实现更新和读取 `previewTarget` 的逻辑，并确保纳入历史记录。
6.  **插槽预览交互实现 (预览部分)**:
    *   (此部分与预览相关，基本保留原状) 右键菜单、快捷键、视觉反馈等。
7.  **实现右侧专用预览面板 (`RightPreviewPanel.vue`) (预览部分)**:
    *   (此部分与预览相关，基本保留原状) 布局、响应 `previewTarget`、内容渲染。
8.  **功能丰富与优化 (编辑器部分)**:
    *   完善 `RichCodeEditor.vue` 的高级功能 (如 JSON/Markdown 特化处理, 更完善的搜索UI, 可配置性)。
    *   细化并实现标签页状态的持久化方案。
    *   更新节点配置 (`InputDefinition.config`) 以支持新的编辑器模式和参数。
9.  **完善预览功能**: 状态持久化（面板UI状态）、边界处理（节点/插槽删除等）。 (此部分与预览相关，基本保留原状)
10. **Tooltip 更新** (保留原状)。
11. **整体测试与细节打磨**。