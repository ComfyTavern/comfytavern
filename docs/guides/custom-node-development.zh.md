# ComfyTavern 自定义节点开发指南

## 1. 引言

欢迎来到 ComfyTavern 自定义节点开发指南！自定义节点是扩展 ComfyTavern 功能、实现特定业务逻辑的核心方式。通过创建自定义节点，你可以将复杂的操作封装成可重用的模块，并在可视化工作流编辑器中灵活编排。

本指南将详细介绍开发一个自定义节点的完整流程，包括：

*   **后端定义**: 如何使用 TypeScript 定义节点的属性、输入、输出和配置。
*   **执行逻辑**: 如何实现节点的后端处理逻辑，以及如何集成前端客户端脚本以实现更丰富的交互。
*   **前端渲染**: 节点定义如何影响其在前端编辑器中的视觉表现和用户交互（主要通过通用的 [`BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue) 组件）。

理解并遵循本指南中的规范，将帮助你创建出功能强大、易于维护且与 ComfyTavern 系统良好集成的自定义节点。

## 2. 准备工作

### 2.1 开发环境配置

确保你的开发环境已配置好以下工具：

*   **Bun**: ComfyTavern 项目使用 Bun 作为 JavaScript 运行时和包管理器。
*   **TypeScript**: 节点定义和后端逻辑主要使用 TypeScript 编写，以确保类型安全和代码质量。

### 2.2 项目结构中节点相关目录

自定义节点的主要代码通常位于以下目录：

*   **后端节点定义和逻辑**: `apps/backend/src/nodes/`
    *   你可以根据节点的类别创建子目录，例如 `apps/backend/src/nodes/MyCustomNodes/`。
    *   每个节点通常对应一个 `.ts` 文件，例如 `MyCustomNode.ts`。
*   **客户端脚本 (如果需要)**: 通常放置在节点定义文件所在目录下的 `client-scripts/` 子目录中，例如 `apps/backend/src/nodes/MyCustomNodes/client-scripts/MyCustomNode.js`。
*   **前端基础节点组件**: 所有节点的前端渲染和基础交互逻辑由位于 `apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue` 的组件统一处理。通常情况下，你不需要修改此文件，但理解其工作原理有助于你更好地设计节点的 `config` 对象以控制前端UI。
*   **节点类型定义**: 核心的节点相关类型接口（如 `NodeDefinition`, `InputDefinition`, `OutputDefinition`）位于共享包 `packages/types/src/node.ts`。
*   **节点导出索引**: 在你创建的节点目录下（例如 `apps/backend/src/nodes/MyCustomNodes/`），通常会有一个 `index.ts` 文件，用于收集并导出该目录下所有节点的定义，以便被节点加载器发现。

## 3. 节点定义 (`NodeDefinition`)

每个自定义节点的核心是一个遵循 `NodeDefinition` 接口 (定义于 [`packages/types/src/node.ts`](packages/types/src/node.ts:88)) 的 TypeScript 对象。这个对象详细描述了节点的元数据、输入输出端口、配置项以及行为。

```typescript
// 示例：MyCustomNode.ts
import type { NodeDefinition, InputDefinition, OutputDefinition, NodeExecutionContext } from '@comfytavern/types';
import { DataFlowType, BuiltInSocketMatchCategory } from '@comfytavern/types'; // 引入必要的枚举

export const definition: NodeDefinition = {
  // ... 核心属性 ...
  // ... 输入定义 ...
  // ... 输出定义 ...
  // ... 节点级配置 ...
  // ... 执行逻辑等 ...
};
```

### 3.1 核心属性

*   `type: string`: **必需。** 节点的唯一类型标识符。在整个系统中必须是唯一的。例如：`'MyCustomNode'`。
*   `namespace?: string`: 可选。节点的命名空间。通常由节点加载器根据文件路径自动推断（例如，`apps/backend/src/nodes/core/` 下的节点可能是 `'core'` 命名空间）。如果在节点目录的 `index.ts` 中统一指定，则此处可以省略。
*   `category: string`: **必需。** 节点在前端UI节点面板中所属的分类。例如：`'数据处理'`, `'逻辑运算'`。
*   `displayName: string`: **必需。** 节点在UI中显示的名称。应简洁明了。例如：`'✨我的自定义节点'`。
*   `description: string`: **必需。** 对节点的详细描述，通常在前端UI的Tooltip中显示，可以包含Markdown换行符 `\n`。例如：`'这是一个执行特定功能的自定义节点。\n支持多种配置选项。'`。
*   `width?: number`: 可选。节点在画布上渲染时的首选宽度（像素）。用户仍然可以手动调整。
*   `filePath?: string`: 可选。此字段通常由节点加载器在加载时自动填充，指向节点定义文件的绝对路径。

### 3.2 输入 (`inputs: Record<string, InputDefinition>`)

`inputs` 对象定义了节点的所有输入端口。对象的键是输入端口的唯一标识符（在节点内部唯一），值是遵循 `InputDefinition` 接口的对象。

参考：[`InputDefinition` 接口定义](packages/types/src/node.ts:65)

```typescript
// InputDefinition 结构示例
interface InputDefinition extends SlotDefinitionBase {
  description?: string;
  required?: boolean | ((configValues: Record<string, any>) => boolean);
  config?: Record<string, any>; // 关键：UI控件配置
  multi?: boolean; // 是否支持多连接
}

interface SlotDefinitionBase {
  displayName?: string;
  dataFlowType: DataFlowTypeName; // 例如 DataFlowType.STRING
  matchCategories?: string[];    // 例如 [BuiltInSocketMatchCategory.CODE]
  allowDynamicType?: boolean;
}
```

*   `dataFlowType: DataFlowTypeName`: **必需。** 输入端口的核心数据类型。例如 `DataFlowType.STRING`, `DataFlowType.INTEGER`, `DataFlowType.OBJECT`。详细类型请参考 `docs/node-types` 文档。
*   `matchCategories?: string[]`: 可选。用于更精确描述端口语义或行为的标签数组。例如 `[BuiltInSocketMatchCategory.CODE]`, `['MyCustomDataFormat']`。这些标签会影响连接兼容性判断和前端UI的某些行为，包括默认操作按钮的显示（如通过 `CanPreview` 提示可预览，通过 `NoDefaultEdit` 禁止默认编辑）。详细请参考 `docs/node-types` 文档。
*   `displayName?: string`: 可选。输入端口在UI中显示的名称。如果未提供，前端可能会使用端口的键名或 `description`。
*   `description?: string`: 可选。输入端口的详细描述，用于Tooltip。
*   `required?: boolean | ((configValues: Record<string, any>) => boolean)`: 可选。指示此输入是否为必需。可以是一个布尔值，或一个接收节点当前配置值并返回布尔值的函数，以实现条件性必需。默认为 `false`。
*   `multi?: boolean`: 可选。如果为 `true`，此输入端口可以接受多个连接。后端 `execute` 方法中对应的输入值将是一个数组。默认为 `false`。示例参考 [`apps/backend/src/nodes/Utilities/MergeNode.ts`](apps/backend/src/nodes/Utilities/MergeNode.ts:1) 中的 `text_inputs`。
*   `config?: Record<string, any>`: **核心配置对象**。此对象中的属性直接影响前端未连接时该输入端口对应的UI控件的类型和行为。这些属性应与 [`packages/types/src/node.ts`](packages/types/src/node.ts:1) 中定义的各种输入选项Zod Schema（如 [`zNumericInputOptions`](packages/types/src/node.ts:13), [`zStringInputOptions`](packages/types/src/node.ts:22) 等）兼容。
*   `actions?: NodeInputAction[]`: 可选。定义一组显示在输入槽旁边的操作按钮。每个按钮由 `NodeInputAction` 对象定义，包含 `id`, `icon`, `label`, `tooltip`, `handlerType` (如 `'builtin_preview'`, `'builtin_editor'`), `handlerArgs` 和 `showConditionKey` 等属性。这些按钮由前端的 `NodeInputActionsBar.vue` 组件渲染和管理，允许实现预览、编辑、自定义事件等交互。详细定义请参考 `docs/node-types` 文档中关于 `NodeInputAction` 的部分。

    *   **常用 `config` 属性 (参考 [`TestWidgetsNode.ts`](apps/backend/src/nodes/Utilities/TestWidgetsNode.ts:1) 和 [`BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue:1) 的渲染逻辑):**
        *   `default: any`: 输入控件的默认值。
        *   `multiline?: boolean`: (用于 `STRING` 类型) `true` 时渲染为多行文本框 (TextAreaInput)，否则为单行 (StringInput)。
        *   `placeholder?: string`: 输入框的占位提示文本。
        *   `min?: number`, `max?: number`, `step?: number`: (用于 `INTEGER`, `FLOAT` 类型) 数值范围和步长。
        *   `suggestions?: any[]`: (用于 `STRING`, `INTEGER`, `FLOAT` 类型) 提供一个建议值列表，前端通常渲染为下拉选择框 (SelectInput/Combo)。
        *   `languageHint?: string`: (用于 `STRING` 类型，特别是 `matchCategories` 包含 `CODE` 或 `MARKDOWN` 时) 指定代码编辑器的语言 (如 `'javascript'`, `'json'`, `'markdown'`)，或辅助Markdown预览。
        *   `label?: string`: (主要用于 `WILDCARD` 类型且 `matchCategories` 包含 `TRIGGER` 时) 作为按钮上显示的文本 (ButtonInput)。
        *   `display_only?: boolean`: (用于 `STRING` 等类型) `true` 时，即使未连接也只显示文本内容，不可编辑 (TextDisplay)。
        *   `bottomEditorMode?: string`: (用于需要复杂编辑的类型如代码、JSON、Markdown) 配置底部停靠编辑器的模式，可选 `'lightweightSingle'` (轻量级单页) 或 `'fullMultiTab'` (全功能多标签页，默认)。当用户点击输入控件旁的编辑按钮时触发。

**输入定义示例 (摘自 [`TestWidgetsNode.ts`](apps/backend/src/nodes/Utilities/TestWidgetsNode.ts:1)):**
```typescript
inputs: {
  string_input: {
    dataFlowType: DataFlowType.STRING,
    displayName: '单行文本',
    config: { default: '默认值', multiline: false, placeholder: '请输入...' }
  },
  markdown_input: {
    dataFlowType: DataFlowType.STRING,
    displayName: 'Markdown文本',
    matchCategories: [BuiltInSocketMatchCategory.MARKDOWN],
    config: { default: '# 标题', multiline: true, languageHint: 'markdown' }
  },
  int_input: {
    dataFlowType: DataFlowType.INTEGER,
    displayName: '整数',
    config: { default: 10, min: 0, max: 100, step: 1 }
  },
  combo_select: {
    dataFlowType: DataFlowType.STRING,
    displayName: '下拉选择',
    matchCategories: [BuiltInSocketMatchCategory.COMBO_OPTION],
    config: { default: '选项A', suggestions: ['选项A', '选项B'] }
  },
  button_trigger: {
    dataFlowType: DataFlowType.WILDCARD, // 按钮通常不传输特定数据类型
    displayName: '触发按钮',
    matchCategories: [BuiltInSocketMatchCategory.TRIGGER],
    config: { label: '点我执行' }
  }
}
```

### 3.3 输出 (`outputs: Record<string, OutputDefinition>`)

`outputs` 对象定义了节点的所有输出端口。结构与 `inputs` 类似，但 `OutputDefinition` 更简单。

参考：[`OutputDefinition` 接口定义](packages/types/src/node.ts:73)

```typescript
// OutputDefinition 结构示例
interface OutputDefinition extends SlotDefinitionBase {
  description?: string;
}
```
*   `dataFlowType: DataFlowTypeName`: **必需。** 输出端口的核心数据类型。
*   `matchCategories?: string[]`: 可选。语义或行为标签。
*   `displayName?: string`: 可选。输出端口在UI中显示的名称。
*   `description?: string`: 可选。输出端口的详细描述。

**输出定义示例:**
```typescript
outputs: {
  result_text: {
    dataFlowType: DataFlowType.STRING,
    displayName: '结果文本',
    description: '处理后的文本结果'
  },
  processed_data: {
    dataFlowType: DataFlowType.OBJECT,
    displayName: '处理数据',
    matchCategories: ['MyCustomDataFormat']
  }
}
```

### 3.4 节点级配置 (`configSchema` 和 `configValues`)

除了通过输入端口接收数据，节点还可以拥有自身的配置项，这些配置项独立于输入输出流，通常用于控制节点的内部行为或设置。

*   `configSchema?: Record<string, InputDefinition>`: 可选。用于定义节点自身的配置项。其结构与 `inputs` 对象完全相同，每个键值对代表一个配置项，使用 `InputDefinition` 来描述其类型、UI显示（例如，在节点主体的一个特殊区域渲染对应的输入控件）和默认值。
*   `configValues?: Record<string, any>`: 可选。用于存储 `configSchema` 中定义的配置项的实际值。这些值通常在工作流保存时被持久化。

**节点级配置示例:**
```typescript
// NodeDefinition 中
configSchema: {
  processingMode: {
    dataFlowType: DataFlowType.STRING,
    displayName: '处理模式',
    config: {
      default: 'fast',
      suggestions: ['fast', 'accurate']
    }
  },
  retryAttempts: {
    dataFlowType: DataFlowType.INTEGER,
    displayName: '重试次数',
    config: {
      default: 3,
      min: 0,
      max: 5
    }
  }
},
// configValues 会在工作流中存储用户选择的值，例如：
// { processingMode: 'accurate', retryAttempts: 2 }
```
在前端 `BaseNode.vue` 中，这些配置项会使用与输入端口类似的逻辑渲染在节点的一个专门区域。

### 3.5 绕过行为 (`bypassBehavior`)

*   `bypassBehavior?: "mute" | BypassBehavior`: 可选。定义当节点在工作流中被设置为“绕过”(Bypass/Mute)状态时的行为。
    *   `"mute"`: 节点不执行，也不产生任何输出。
    *   `BypassBehavior` 对象: `{ passThrough?: Record<string, string>, defaults?: Record<string, any> }`
        *   `passThrough`: 定义输出端口如何从输入端口直接获取值 (例如 `{'output_A': 'input_X'}` 表示 output_A 的值直接取自 input_X)。
        *   `defaults`: 为某些输出端口提供在绕过时使用的固定默认值。

## 4. 节点执行逻辑

节点的执行逻辑定义了当工作流运行到该节点时，它应该如何处理输入数据、执行计算，并产生输出。执行逻辑可以完全在后端实现，也可以部分或完全依赖前端的客户端脚本。

### 4.1 后端执行 (`execute` 方法)

如果节点需要在服务器端处理数据，你需要在 `NodeDefinition` 中提供一个异步的 `execute` 方法。

```typescript
// NodeDefinition 中
async execute(
  inputs: Record<string, any>, // 一个对象，键是输入端口ID，值是解析后的输入数据
  context?: NodeExecutionContext // 可选的执行上下文对象
): Promise<Record<string, any>> { // 返回一个对象，键是输出端口ID，值是对应的输出数据
  // ... 你的逻辑 ...
  const inputValue = inputs['myInputKey'];
  const nodeConfigValue = context?.configValues?.['myConfigKey']; // 假设配置值通过context传递

  // 处理多输入 (示例来自 MergeNode.ts)
  const textInputsArray = Array.isArray(inputs.text_inputs) ? inputs.text_inputs : [inputs.text_inputs];

  // ... 执行计算 ...
  const result = processData(inputValue, nodeConfigValue);

  return {
    myOutputKey: result
  };
}
```

*   **参数**:
    *   `inputs: Record<string, any>`: 一个对象，包含了所有已连接并解析好的输入值。键是你在 `NodeDefinition.inputs` 中定义的输入端口ID。如果输入端口是 `multi: true`，则对应的值会是一个数组。
    *   `context?: NodeExecutionContext`: 可选的执行上下文对象 ([`NodeExecutionContext`](packages/types/src/node.ts:193))。它可能包含 `nodeId`，以及访问节点自身 `configValues` 的方式（具体实现可能依赖执行引擎如何传递上下文，请查阅相关文档或 `ExecutionEngine.ts` 的实现）。
*   **返回值**: 一个 `Promise`，解析为一个对象，键是你在 `NodeDefinition.outputs` 中定义的输出端口ID，值是对应的输出数据。
*   **错误处理**: 如果执行过程中发生错误，可以抛出异常。执行引擎会捕获此异常并相应地更新节点状态。
*   **前端驱动节点的后端角色**: 对于主要逻辑在前端通过客户端脚本执行的节点 (如 [`RandomNumberNode.ts`](apps/backend/src/nodes/Utilities/RandomNumberNode.ts:1))，后端的 `execute` 方法可能非常简单，例如仅作为数据透传通道，或者处理一些无法在前端完成的简单验证或准备工作。

### 4.2 前端执行 (客户端脚本)

对于需要复杂前端交互（如响应按钮点击、利用浏览器API）或希望减轻服务器负载的节点，可以使用客户端脚本。

*   `clientScriptUrl?: string`: 在 `NodeDefinition` 中设置此属性，指向一个JavaScript文件的URL。这个URL通常是相对于节点定义文件自身的相对路径，例如 `'client-scripts/MyCustomNode.js'`。
    *   后端会在特定API端点 (如 `/client-scripts/:namespace/:nodeType.js`) 提供这些脚本文件。
*   **使用场景**:
    *   响应节点内部UI元素（如按钮）的点击事件。
    *   在前端进行数据预处理或验证。
    *   直接操作DOM或使用浏览器特有的API。
    *   实现无需后端参与的即时反馈。
*   **编写客户端脚本**:
    *   客户端脚本在前端 [`BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue:1) 组件中通过 `useNodeClientScript` composable 加载和执行。
    *   脚本通常会导出一个对象或函数，包含特定的钩子或方法供 `BaseNode.vue` 调用。例如，处理按钮点击的函数。
    *   **与节点实例交互**: 客户端脚本可以访问其所属节点实例的某些状态或方法，例如：
        *   获取输入值。
        *   通过 `updateInputValue` (由 `BaseNode.vue` 传递给脚本上下文) 更新节点的输入值（这通常用于模拟节点内部状态的变化）。
        *   触发向后端发送消息 (例如，通过 `handleButtonClick` 构造并发送 [`ButtonClickPayload`](packages/types/src/node.ts:261) 类型的WebSocket消息)。
    *   **示例**: 参考 [`apps/backend/src/nodes/Utilities/RandomNumberNode.ts`](apps/backend/src/nodes/Utilities/RandomNumberNode.ts:1) 和其对应的 `apps/backend/src/nodes/Utilities/client-scripts/RandomNumberNode.js`。
        *   `RandomNumberNode.js` 可能会导出一个包含如 `onRerollButtonClick` 之类方法的对象。当用户点击“重新随机”按钮时，`BaseNode.vue` 会调用此方法，该方法内部可能会生成随机数并通过 `updateInputValue` 更新节点的 `value` 输入，并可能触发一个 `number` 输出的更新（具体机制需查阅 `useNodeClientScript` 和 `BaseNode.vue` 的实现细节）。

## 5. 前端渲染与交互 (`BaseNode.vue`)

所有自定义节点（除非有特殊机制）都由前端的 [`apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue:1) 组件统一渲染。因此，理解你的节点定义如何影响 `BaseNode.vue` 的行为非常重要。

*   **统一渲染器**: `BaseNode.vue` 接收节点的 `props` (包含从后端获取的节点定义的大部分内容)，并负责渲染节点的头部（标题、分类、ID）、主体、输入输出端口（Handles）以及未连接输入对应的UI控件。
*   **输入控件的动态选择**:
    *   `BaseNode.vue` 内部有一个逻辑 (大致通过 `getInputComponent` 函数实现)，它会根据输入端口的 `dataFlowType`、`matchCategories` 和 `config` 对象来决定为该端口渲染哪个具体的Vue组件 (例如 `StringInput.vue`, `NumberInput.vue`, `ButtonInput.vue`, `JsonInlineViewer.vue` 等)。
    *   因此，正确配置 `InputDefinition` 中的这些属性对于前端UI的正确显示至关重要。
*   **Handle (连接点) 样式**: Handle的颜色和样式会根据其 `dataFlowType` 动态改变，以提供视觉提示。
*   **多输入渲染**: `multi: true` 的输入端口在前端会有特殊的“跑道式”渲染效果，允许连接多条线。
*   **操作按钮和复杂输入的联动**:
    *   输入槽旁边的操作按钮（如预览、编辑、自定义按钮）现在由 [`apps/frontend-vueflow/src/components/graph/nodes/NodeInputActionsBar.vue`](apps/frontend-vueflow/src/components/graph/nodes/NodeInputActionsBar.vue:1) 组件根据 `InputDefinition` 中的 `actions` 数组和 `matchCategories` (如 `CanPreview`) 动态生成和管理。
    *   例如，一个标记了 `CanPreview` 的输入或在 `actions` 中定义了 `'builtin_preview'` 操作的输入，会显示一个预览按钮。点击此按钮会触发内置的 Tooltip 预览逻辑。
    *   类似地，可编辑的输入（未被 `NoDefaultEdit` 标记，或在 `actions` 中定义了 `'builtin_editor'` 操作）会显示编辑按钮。点击后，`BaseNode.vue` (通过 `NodeInputActionsBar.vue` 触发的事件) 会调用 `interactionCoordinator.openDockedEditorForNodeInput` 方法，在底部的停靠编辑器中打开对应内容的编辑器。`handlerArgs` 中可以指定编辑器类型等参数。
    *   `WILDCARD` 类型且 `matchCategories` 包含 `TRIGGER` 的输入仍然会渲染成按钮 (ButtonInput)，其点击事件通常由客户端脚本处理，或者通过 `actions` 定义更具体的行为。
*   **Tooltip 和执行状态**: `BaseNode.vue` 负责显示节点和端口的 `description` 作为Tooltip，并根据从 `executionStore` 获取的执行状态（`RUNNING`, `COMPLETED`, `ERROR` 等）为节点添加高亮等视觉反馈。

## 6. 节点注册与加载

为了让 ComfyTavern 系统能够识别和使用你的自定义节点，你需要确保它们被正确地组织和导出。

*   **后端节点组织和导出模式**: (参考 [`apps/backend/src/nodes/Utilities/index.ts`](apps/backend/src/nodes/Utilities/index.ts:1))
    1.  **单个节点文件**: 每个自定义节点通常定义在一个独立的 `.ts` 文件中 (例如 `MyCustomNode.ts`)。
    2.  **导出 `definition`**: 在该文件中，你需要导出一个名为 `definition` 的常量，其值为遵循 `NodeDefinition` 接口的对象。
        ```typescript
        // MyCustomNode.ts
        import type { NodeDefinition } from '@comfytavern/types';
        // ...
        export const definition: NodeDefinition = { /* ... */ };
        ```
    3.  **目录 `index.ts`**: 在包含多个节点定义文件的目录中 (例如 `apps/backend/src/nodes/MyCustomNodes/`)，创建一个 `index.ts` 文件。
    4.  **聚合与导出 `definitions`**: 在这个 `index.ts` 文件中，从该目录下的所有节点文件中导入各自的 `definition` 对象，并将它们收集到一个名为 `definitions` 的数组中导出。在聚合时，通常会为这些节点统一指定或覆盖 `namespace` 属性。
        ```typescript
        // apps/backend/src/nodes/MyCustomNodes/index.ts
        import type { NodeDefinition } from '@comfytavern/types';
        import { definition as MyCustomNodeOneDefinition } from './MyCustomNodeOne';
        import { definition as MyCustomNodeTwoDefinition } from './MyCustomNodeTwo';

        export const definitions: NodeDefinition[] = [
          { ...MyCustomNodeOneDefinition, namespace: 'myCustomNamespace' },
          { ...MyCustomNodeTwoDefinition, namespace: 'myCustomNamespace' },
        ];
        ```
*   **节点加载器 (`NodeLoader.ts`)**: 项目的后端包含一个节点加载器 (大致路径 `apps/backend/src/nodes/NodeLoader.ts`)，它会扫描指定的节点目录（例如 `apps/backend/src/nodes/` 下的各个子目录），查找这些导出了 `definitions` 数组的 `index.ts` 文件，从而加载所有自定义节点。`NodeManager.ts` 则负责管理这些加载到的节点定义。

## 7. 一个完整的示例

让我们构思一个简单的“字符串反转”节点作为示例。

**`apps/backend/src/nodes/MyCustomNodes/StringReverseNode.ts`**:
```typescript
import type { NodeDefinition, InputDefinition, OutputDefinition, NodeExecutionContext } from '@comfytavern/types';
import { DataFlowType } from '@comfytavern/types';

class StringReverseNodeImpl {
  static async execute(inputs: Record<string, any>, context?: NodeExecutionContext): Promise<Record<string, any>> {
    const inputText = inputs.text_to_reverse as string || '';
    const reversedText = inputText.split('').reverse().join('');
    return {
      reversed_text: reversedText,
    };
  }
}

export const definition: NodeDefinition = {
  type: 'StringReverse',
  category: '文本处理',
  displayName: '🔄 字符串反转',
  description: '将输入的字符串进行反转处理。',
  inputs: {
    text_to_reverse: {
      dataFlowType: DataFlowType.STRING,
      displayName: '输入文本',
      description: '需要被反转的字符串。',
      required: true,
      config: {
        default: 'Hello World',
        multiline: false,
        placeholder: '输入待反转的文本',
      },
    } as InputDefinition, // 类型断言确保符合接口
  },
  outputs: {
    reversed_text: {
      dataFlowType: DataFlowType.STRING,
      displayName: '反转后文本',
      description: '经过反转处理后的字符串。',
    } as OutputDefinition, // 类型断言
  },
  execute: StringReverseNodeImpl.execute,
};
```

**`apps/backend/src/nodes/MyCustomNodes/index.ts`**:
```typescript
import type { NodeDefinition } from '@comfytavern/types';
import { definition as StringReverseNodeDefinition } from './StringReverseNode';
// 如果有其他节点，也在这里导入

export const definitions: NodeDefinition[] = [
  { ...StringReverseNodeDefinition, namespace: 'myCustomNodes' }, // 指定命名空间
  // ... 其他节点定义
];
```
将 `MyCustomNodes` 目录添加到 `NodeLoader.ts` 的扫描路径中（如果需要），系统重启后，这个“字符串反转”节点就应该会出现在前端节点面板的“文本处理”分类下了。

## 8. 最佳实践

*   **命名规范**:
    *   节点 `type`: 使用帕斯卡命名法 (PascalCase)，例如 `MyImageProcessor`。
    *   文件名: 通常与节点 `type` 一致，例如 `MyImageProcessor.ts`。
    *   输入/输出端口ID (键名): 使用蛇形命名法 (snake_case)，例如 `input_image`, `processed_output`。
    *   `displayName`: 使用用户友好的自然语言，可包含Emoji。
*   **注释和文档**:
    *   为 `NodeDefinition` 的 `description` 属性以及输入输出端口的 `description` 属性提供清晰、详细的说明。这些会直接显示给用户。
    *   在代码中使用 JSDoc 或 TSDoc 注释关键逻辑。
*   **性能考虑**:
    *   避免在 `execute` 方法中执行非常耗时或阻塞的操作。如果需要长时间处理，考虑将其设计为异步的，并思考如何向前端反馈进度（如果项目支持）。
*   **类型安全**:
    *   充分利用 TypeScript 的类型系统，为所有变量、参数和返回值提供明确的类型。
    *   使用从 `@comfytavern/types` 包中导入的类型。
*   **职责单一**:
    *   尽量让每个节点专注于一个明确的功能。如果一个节点逻辑过于复杂，考虑将其拆分为多个更小的、可组合的节点。
*   **考虑前端交互**:
    *   在设计节点的 `inputs` 和 `configSchema` 时，思考它们将如何在前端 [`BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue:1) 中渲染，以及用户将如何与之交互。选择合适的 `dataFlowType`, `matchCategories` 和 `config` 属性来优化用户体验。

## 9. 调试技巧

*   **后端日志**: 在你的 `execute` 方法或节点加载相关的逻辑中添加 `console.log` 或使用更专业的日志库进行调试。Bun 运行时的输出会显示在启动后端的终端中。
*   **前端浏览器控制台**:
    *   打开浏览器的开发者工具 (通常是 F12)。
    *   检查 `Console` 选项卡，查看 [`BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue:1) 或其他前端组件可能输出的错误或调试信息。
    *   对于客户端脚本，可以直接在脚本中使用 `console.log`，输出会显示在浏览器控制台。也可以使用浏览器的 `Debugger` 工具设置断点进行调试。
*   **使用 [`TestWidgetsNode.ts`](apps/backend/src/nodes/Utilities/TestWidgetsNode.ts:1)**: 这个节点包含了各种输入类型的示例。如果你在实现某种特定输入的UI或行为时遇到问题，可以参考此节点是如何定义的，以及它在前端是如何表现的，以帮助排查问题。
*   **检查网络请求**: 使用开发者工具的 `Network` 选项卡检查前后端之间的 API 请求 (例如加载节点定义) 和 WebSocket 消息，确保数据按预期传输。

## 10. 附录 (可选)

*   **常用 `DataFlowType` 和 `SocketMatchCategory` 列表**: 请参考项目中的 [`docs/node-types/node-types.zh.md`](docs/node-types/node-types.zh.md) (中文) 或 [`docs/node-types/node-types.en.md`](docs/node-types/node-types.en.md) (英文) 文档获取最详细和最新的列表及解释。
*   **Zod Schema 简介**: Zod 是一个 TypeScript优先的 schema 声明和验证库。在 ComfyTavern 中，它主要用于：
    *   定义和验证 WebSocket 消息的负载结构。
    *   定义和验证后端 API 的请求体和响应体。
    *   在 [`packages/types/src/node.ts`](packages/types/src/node.ts:1) 中，各种输入配置选项 (如 [`zNumericInputOptions`](packages/types/src/node.ts:13)) 是使用 Zod Schema 定义的，这有助于确保节点定义中 `config` 对象的正确性，并能从中推断出 TypeScript 类型。在编写自定义节点时，你需要确保你的 `config` 对象属性与这些 Zod Schema 兼容。

希望这份指南能帮助你顺利开发出强大的自定义节点！