# 节点输入操作按钮动态化方案

## 1. 目标与原则

**目标**: 将 `apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue` 中硬编码的预览、编辑等操作按钮的显示逻辑，改为由节点其输入定义（`InputDefinition`）通过 `matchCategories` 语义标签和可选的 `actions` 数组来共同驱动。同时，优化当一个输入槽拥有多个操作按钮时的用户体验和界面布局。

**核心原则**:
*   **语义驱动默认行为**: 利用 `InputDefinition` 的 `matchCategories` 属性来表达输入槽的内在特性，从而让前端可以据此推断出是否应显示标准的、预设的按钮（如预览、编辑）。
*   **显式操作优先与覆盖**: 节点定义者可以通过在 `InputDefinition` 中提供一个 `actions` 数组来精确定义所需的操作按钮，包括添加自定义按钮或覆盖由语义标签推断出的标准按钮。
*   **UI组件化与关注点分离**: 将按钮的复杂显示逻辑（包括动态计算、渲染、“更多”操作的收起/展开等）封装到独立的子组件中，以保持 `BaseNode.vue` 的整洁和可维护性。

## 2. 类型定义变更 (`packages/types/`)

### 2.1. `packages/types/src/schemas.ts`

#### 2.1.1. 新增 `NodeInputActionSchema` 和 `NodeInputAction` 类型

```typescript
export const NodeInputActionSchema = z.object({
  /** 
   * 唯一ID，用于标识操作。
   * 也用于覆盖标准操作，例如，如果此ID为 'standard_preview'，则此定义将覆盖默认的预览按钮。
   */
  id: z.string(),
  /** 
   * 图标名称 (推荐使用 Heroicons v2 outline 样式的图标名称，小驼峰格式, e.g., 'eye', 'pencilSquare', 'codeBracket')。
   * 可选。如果未提供，新组件 NodeInputActionsBar.vue 会尝试根据 handlerType 或 id 提供一个默认图标。
   */
  icon: z.string().optional(),
  /** 按钮的 Tooltip 提示文本 */
  tooltip: z.string().optional(),
  /** 
   * 操作的处理方式:
   * - 'builtin_preview': 使用 BaseNode 内置的 Tooltip 预览逻辑。
   * - 'builtin_editor': 使用 BaseNode 内置的 openEditorForInput 方法打开编辑器。
   * - 'emit_event': BaseNode 会发出一个自定义事件，由外部处理。
   * - 'client_script_hook': 调用节点客户端脚本中定义的特定钩子函数。
   * - 'open_panel': 触发打开一个指定的侧边栏面板或弹窗。
   */
  handlerType: z.enum(['builtin_preview', 'builtin_editor', 'emit_event', 'client_script_hook', 'open_panel']),
  /** 
   * 传递给处理程序的参数，具体结构取决于 handlerType。例如：
   * - for 'builtin_editor': { editorType?: 'default' | 'json' | 'markdown' | 'code' | string (custom_id), languageHint?: string, preferFloatingEditor?: boolean }
   * - for 'open_panel': { panelId: string, panelTitle?: string, initialValue?: any, context?: any }
   * - for 'emit_event': { eventName: string, eventPayload?: any }
   * - for 'client_script_hook': { hookName: string, hookPayload?: any }
   */
  handlerArgs: z.record(z.any()).optional()
});
export type NodeInputAction = z.infer<typeof NodeInputActionSchema>;
```

#### 2.1.2. 更新 `BuiltInSocketMatchCategory` 常量对象

添加用于控制标准按钮行为的语义标签。

```typescript
export const BuiltInSocketMatchCategory = {
  // ... (保留所有现有类别) ...
  CODE: "Code",
  JSON: "Json",
  MARKDOWN: "Markdown",

  // 新增用于操作提示的类别
  /** 标记此输入支持标准的内联预览操作按钮 */
  CanPreview: "CanPreview", // 替代原 ACTION_HINT_PREVIEWABLE
  /** 标记此输入不应显示其类型的默认编辑操作按钮 (如果其类型通常有默认编辑按钮) */
  NoDefaultEdit: "NoDefaultEdit", // 替代原 ACTION_HINT_NO_DEFAULT_EDIT
  
  // ... (其他类别) ...
} as const;
// BuiltInSocketMatchCategoryName 类型会自动更新
```

### 2.2. `packages/types/src/node.ts`

#### 2.2.1. 导入 `NodeInputAction` 类型

在文件顶部导入部分：
```typescript
import type { /*...,*/ NodeInputAction } from "./schemas"; 
```

#### 2.2.2. 修改 `InputDefinition` 接口

添加可选的 `actions` 属性。
```typescript
export interface InputDefinition extends SlotDefinitionBase {
  description?: string;
  required?: boolean | ((configValues: Record<string, any>) => boolean);
  config?: Record<string, any>;
  multi?: boolean;
  /** 可选的操作按钮定义数组，用于此输入槽 */
  actions?: NodeInputAction[]; // <--- 新增此行
}
```

## 3. 新前端组件: `NodeInputActionsBar.vue`

创建一个新的Vue组件，专门负责单个输入槽旁边所有操作按钮的显示、布局和基本交互。

*   **Props**:
    *   `inputDefinition: Object` (必需, 前端处理后的输入定义对象)
    *   `nodeId: String` (必需, 当前节点ID)
    *   `isInputConnected: Boolean` (必需, 当前输入是否已连接)
    *   `inputValue: any` (必需, 当前输入的值)
    *   `maxVisibleInline: { type: Number, default: 2 }` (可选, 行内最多显示的按钮数，超出则显示“更多”按钮)

*   **内部核心逻辑**:
    1.  **计算最终按钮列表 (`finalActionsToDisplay`)**:
        *   这是一个计算属性或响应式函数。
        *   初始化一个 `actionsToRender = new Map<string, NodeInputAction>()`。
        *   **标准编辑按钮**:
            *   通过内部辅助函数 `isInputTypeNativelyEditable(inputDefinition)` 判断（基于 `dataFlowType`, `matchCategories`, `config.multiline`）。
            *   如果可编辑且 `inputDefinition.matchCategories` 中不包含 `BuiltInSocketMatchCategory.NoDefaultEdit`，则构造一个标准编辑 `NodeInputAction` (固定 `id: 'standard_edit'`, 预设 `icon`, `tooltip`, `handlerType: 'builtin_editor'`, `handlerArgs`)，并将其 `actionsToRender.set('standard_edit', ...)`.
        *   **标准预览按钮**:
            *   如果 `inputDefinition.matchCategories` 中包含 `BuiltInSocketMatchCategory.CanPreview`，则构造一个标准预览 `NodeInputAction` (固定 `id: 'standard_preview'`, 预设 `icon`, `tooltip`, `handlerType: 'builtin_preview'`)，并将其 `actionsToRender.set('standard_preview', ...)`.
        *   **处理 `inputDefinition.actions` (显式操作)**:
            *   如果 `inputDefinition.actions` 存在，遍历它。
            *   对于每个 `action`，执行 `actionsToRender.set(action.id, action)`，实现添加或覆盖。
        *   最终列表为 `Array.from(actionsToRender.values())`，可按需排序。
    2.  **“更多”按钮逻辑**:
        *   比较 `finalActionsToDisplay.length` 和 `maxVisibleInline`。
        *   如果超出，则只渲染前 `maxVisibleInline - 1` (或 `maxVisibleInline`) 个按钮，并额外渲染一个“更多”(...)按钮。
        *   “更多”按钮点击后，通过 Popover、Dropdown 或其他方式显示剩余的按钮。
    3.  **图标渲染**:
        *   根据 `action.icon` (Heroicon 名称字符串) 动态渲染 SVG 图标。
        *   如果 `action.icon` 未提供，根据 `action.handlerType` 或 `action.id` (如 `'standard_preview'`) 提供默认图标。
    4.  **Tooltip**: 显示 `action.tooltip`。
    5.  **条件显示**: 内部使用 `evaluateShowCondition(action.showConditionKey, inputValue, isInputConnected, inputDefinition)` 过滤按钮。

*   **Emits**:
    *   `action-click`: 当任何按钮（包括“更多”菜单中的）被点击时触发，参数为 `{ action: NodeInputAction, inputDefinition: Object }` (传递回完整的输入定义，方便父组件处理)。

## 4. `BaseNode.vue` 的调整

*   **模板**:
    *   在每个输入参数行的适当位置，使用 `<NodeInputActionsBar />` 组件。
        ```vue
        <NodeInputActionsBar
          :input-definition="input" 
          :node-id="props.id"
          :is-input-connected="isInputConnected(String(input.key))"
          :input-value="getInputValue(String(input.key))"
          @action-click="handleActionTriggered" 
        />
        ```
*   **脚本**:
    *   实现 `handleActionTriggered({ action: NodeInputAction, inputDefinition: Object })` 方法。
    *   此方法根据 `action.handlerType` 和 `action.handlerArgs` 执行具体操作：
        *   `builtin_preview`: 调用现有的预览逻辑 (可能需要调整以适应 Tooltip 的内容)。
        *   `builtin_editor`: 调用 `openEditorForInput(inputDefinition, action.handlerArgs)` (需修改 `openEditorForInput` 以接受 `handlerArgs`)。
        *   `emit_event`: `vueFlowInstance.emit(action.handlerArgs.eventName, ...)`。
        *   `client_script_hook`: 调用 `executeClientHook(action.handlerArgs.hookName, ...)`。
        *   `open_panel`: 通过 `interactionCoordinator` 或类似服务打开指定面板。
    *   移除所有旧的、与按钮直接渲染和条件判断相关的逻辑。这些职责已移交 `NodeInputActionsBar.vue`。

## 5. 按钮显示与覆盖逻辑总结

1.  **默认标准按钮**:
    *   **编辑按钮**: 对特定可编辑类型（JSON, Code, Markdown, 多行String等）默认显示，除非其 `matchCategories` 包含 `NoDefaultEdit`。ID 为 `'standard_edit'`。
    *   **预览按钮**: 当输入的 `matchCategories` 包含 `CanPreview` 时显示。ID 为 `'standard_preview'`。
2.  **自定义/覆盖**:
    *   `InputDefinition` 中的 `actions` 数组用于定义额外的按钮或覆盖标准按钮。
    *   覆盖通过 `id` 匹配实现：如果 `actions` 数组中存在与标准按钮 `id` 相同的项，则使用 `actions` 中的定义。

## 6. UI/UX 考虑

*   **按钮堆叠**: `NodeInputActionsBar.vue` 内部的按钮容器应使用 `flex-wrap: wrap;` 样式，允许按钮在空间不足时自动换行。
*   **按钮过多**: 通过 `maxVisibleInline` prop 和“更多”按钮（及其下拉/Popover菜单）来优雅处理，避免输入行过度增高，保持节点紧凑性。
*   **空间分配**: 输入参数名称在空间不足时优先被截断并显示 `...`。

## 7. 标准按钮默认配置的管理

标准按钮（`standard_edit`, `standard_preview`）的默认 `icon` (Heroicon 名称) 和 `tooltip` (国际化文本键) 将在 `NodeInputActionsBar.vue` 组件内部作为常量或在辅助函数中定义和管理。