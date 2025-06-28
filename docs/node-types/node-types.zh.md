# 节点类型系统文档 (中文版)

本文档概述了 ComfyTavern 项目中节点输入和输出插槽的新版类型系统，包括数据流类型 (`DataFlowType`)、插槽匹配类别 (`SocketMatchCategory`)、配置选项以及它们之间的连接规则。

## 1. 核心概念

新的类型系统旨在明确区分数据流的实际格式与连接时的匹配逻辑，增强灵活性和可扩展性。

### 1.1. `DataFlowType` (数据流类型)

`DataFlowType` 定义了插槽实际传输和处理的基础数据结构。它们相对稳定和通用。

| `DataFlowType` 名称 | 描述                                                                                                  | 对应 TypeScript 类型 (示例) |
| :------------------ | :---------------------------------------------------------------------------------------------------- | :-------------------------- |
| `STRING`            | 通用文本字符串                                                                                        | `string`                    |
| `INTEGER`           | 整数                                                                                                  | `number`                    |
| `FLOAT`             | 浮点数                                                                                                | `number`                    |
| `BOOLEAN`           | 布尔值                                                                                                | `boolean`                   |
| `OBJECT`            | 通用 JavaScript 对象                                                                                  | `object`                    |
| `ARRAY`             | 通用 JavaScript 数组                                                                                  | `any[]`                     |
| `BINARY`            | 二进制数据                                                                                            | `ArrayBuffer`, `Uint8Array` |
| `WILDCARD`          | 特殊类型：通配符，不指定数据格式，可连接任何类型，连接时不强制转换。                                  | `any`                       |
| `CONVERTIBLE_ANY`   | 特殊类型：连接时动态转换，会将其自身的 `dataFlowType` 和 `matchCategories` 更改为与连接对方完全一致。 | `any` (初始)                |

### 1.2. `SocketMatchCategory` (插槽匹配类别/标签)

`SocketMatchCategory` 是一组**可选的字符串标签**，用于描述插槽的语义、用途、内容特征或特殊匹配行为。它主要用于连接时的兼容性判断，如果提供，则作为优先匹配条件。开发者可以自由定义和使用自定义标签。

#### 1.2.1. 内置的、推荐的 `SocketMatchCategory` 标签

以下是一些内置的推荐标签：

**语义化/内容特征标签:**

*   `Code`: 代码
*   `Json`: JSON 格式数据
*   `Markdown`: Markdown 格式文本
*   `Url`: URL 字符串
*   `FilePath`: 文件路径字符串
*   `Prompt`: 提示词文本
*   `ChatMessage`: 单条聊天消息对象
*   `ChatHistory`: 聊天历史记录数组
*   `LlmConfig`: LLM 配置对象
*   `LlmOutput`: LLM 输出结果
*   `VectorEmbedding`: 向量嵌入数据
*   `Matrix`: 矩阵数据，通常是二维数组
*   `CharacterProfile`: 角色配置文件/对象
*   `Image`: 图像数据 (可用于 `OBJECT`/`BINARY` 数据，或 `STRING` 类型的路径/URL 引用)
*   `Audio`: 音频数据 (可用于 `OBJECT`/`BINARY` 数据，或 `STRING` 类型的路径/URL 引用)
*   `Video`: 视频数据 (可用于 `OBJECT`/`BINARY` 数据，或 `STRING` 类型的路径/URL 引用)
*   `ResourceId`: 资源标识符
*   `Trigger`: 触发信号 (常用于按钮类交互)
*   `StreamChunk`: 数据流块，通常作为 `DataFlowType.STREAM` 类型输出的流中的数据单元。
*   `ComboOption`: 用于标记仅 COMBO (下拉建议) 选择而不支持自定义输入的值（不添加这个标记默认会有输入框）。
*   `UiBlock`: (UI渲染提示) 标记此输入组件应作为“大块”或“块级”元素渲染，而不是行内紧凑型。
*   `CanPreview`: (操作提示) 标记此输入支持标准的内联预览操作按钮。
*   `NoDefaultEdit`: (操作提示) 标记此输入不应显示其类型的默认编辑操作按钮 (如果其类型通常有默认编辑按钮)。

**行为标签:**

*   `BehaviorWildcard`: 行为标签：通配符，覆盖其他规则，可连接到任何其他插槽。
*   `BehaviorConvertible`: 行为标签：可转换，连接时会将其自身的 `dataFlowType` 和 `matchCategories` 更改为与连接对方完全一致。

#### 1.2.2. 自定义标签

开发者可以根据应用场景创建新的标签，例如 `"MySpecificDataFormat"`, `"GameEntityReference"` 等。建议为自定义标签设定命名规范和长度限制。

## 2. 节点插槽定义

在节点的 `InputDefinition` 和 `OutputDefinition` 中：

*   插槽定义中的旧 `type: string` 字段已被 `dataFlowType: DataFlowTypeName` 替换。
*   新增**可选的** `isStream?: boolean` 字段。如果为 `true`，表示该插槽传输的是数据流，而非单个值。
*   新增**可选的** `matchCategories: string[]` 字段，用于定义语义或行为标签。
*   `config` 对象包含用于指导前端 UI 渲染和交互行为的具体配置项。

### 2.1. `config` 对象常用配置项

以下是一些在 `InputDefinition` 的 `config` 对象中常用的配置项，它们指导着前端 UI 的渲染和行为：

| 配置项                     | 类型      | 描述与用途                                                                                                                                                              | 适用 `DataFlowType` (示例)         |
| :------------------------- | :-------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------- |
| `default`                  | `any`     | 插槽的默认值。                                                                                                                                                          | 所有                               |
| `multiline`                | `boolean` | 是否为多行输入。`true` 通常渲染为文本区域，`false` 为单行输入框。                                                                                                       | `STRING`                           |
| `placeholder`              | `string`  | 输入框的占位提示文本。                                                                                                                                                  | `STRING`, `INTEGER`, `FLOAT`       |
| `languageHint`             | `string`  | 指定代码编辑器应使用的语言（如 `'javascript'`, `'python'`, `'json'`, `'markdown'`）。当 `dataFlowType` 为 `STRING` 时，此配置用于指定前端使用的代码编辑器及其语言高亮。 | `STRING`                           |
| `suggestions`              | `any[]`   | 提供一个建议值列表。如果插槽的 `matchCategories` 中包含 `ComboOption`，则渲染为纯下拉选择框。否则，对于 `STRING`, `INTEGER`, `FLOAT` 类型，会渲染为允许自由输入并提供建议的输入框。 | `STRING`, `INTEGER`, `FLOAT`       |
| `min`, `max`, `step`       | `number`  | 用于数字类型的最小值、最大值和步长。可用于渲染滑块等 UI。                                                                                                               | `INTEGER`, `FLOAT`                 |
| `label`                    | `string`  | 主要用于按钮 (`Trigger` 类型) 的显示文本。                                                                                                                              | `WILDCARD` (配合 `Trigger`)        |
| `readOnly` / `displayOnly` | `boolean` | 指示输入为只读，前端应渲染为不可编辑的文本展示。                                                                                                                        | `STRING`, 等                       |
| `displayAs`                | `string`  | (可选新增) 更明确地指定非默认的 UI 表现，例如 `'slider'`, `'color-picker'`。                                                                                            | 特定类型                           |
| `bottomEditorMode`         | `string`  | (可选) 配置底部停靠编辑器的模式：`'lightweightSingle'` (轻量级单页编辑) 或 `'fullMultiTab'` (全功能多标签页编辑，默认)。用于复杂内容（如代码、JSON）的编辑。            | `STRING`, `OBJECT`, `ARRAY`        |
| `showPreview`              | `boolean` | (特定于图像等) 是否显示预览。                                                                                                                                           | `OBJECT`, `BINARY`, `STRING` (URL) |
| `maxWidth`, `maxHeight`    | `number`  | (特定于图像等) 预览图像的最大宽度/高度。                                                                                                                                | `OBJECT`, `BINARY`, `STRING` (URL) |

**其他顶级属性**:

*   `displayName: string`: 在 UI 中显示的名称。
*   `description: string`: 对插槽的详细描述，常用于 Tooltip。
*   `required: boolean | ((inputs: Record<string, any>, configValues: Record<string, any>) => boolean)`: (仅输入) 定义该输入是否为必需。
*   `multi: boolean`: (仅输入) 如果为 `true`，该输入插槽可以接受多个连接。
    *   `acceptTypes: string[]`: (仅当 `multi: true` 时) 定义此多输入插槽接受的 `DataFlowType` 或 `SocketMatchCategory` 列表。连接时进行精确匹配。
*   `hideHandle: boolean`: (可选) 如果为 `true`，则在前端 UI 中隐藏该插槽的连接点 (Handle)。
*   `actions: NodeInputAction[]`: (可选) 定义一个操作按钮数组，显示在输入槽旁边，用于提供如预览、编辑等快捷操作。详见下文“输入操作按钮 (`actions`)”章节。

### 2.2. Tooltip 信息

插槽的 Tooltip 通常会显示其 `displayName`、`description`，并可补充显示其 `dataFlowType` 和所有 `matchCategories` (包括内置和自定义的)，以帮助用户理解插槽的性质。

### 2.3. UI 组件选择逻辑

前端 UI 组件的选择和渲染方式，将主要依据 `DataFlowType`、`SocketMatchCategory` (可选，用于理解语义) 以及 `InputDefinition.config` 对象内部的具体配置项。

例如：

*   `dataFlowType: 'STRING'`, `config: { multiline: true }` -> 多行文本输入框。
*   `dataFlowType: 'STRING'`, `matchCategories: ['Code']`, `config: { languageHint: 'javascript' }` -> JavaScript 代码编辑器 (在底部停靠编辑器中)。
*   `dataFlowType: 'INTEGER'`, `config: { suggestions: [{value: 1, label: '1'}, {value: 2, label: '2'}, {value: 3, label: '3'}], default: 1 }` -> 带建议的整数输入框 (允许自由输入，同时显示建议)。
*   `dataFlowType: 'STRING'`, `matchCategories: ['ComboOption']`, `config: { suggestions: [{value: '选项A', label: '选项A'}, {value: '选项B', label: '选项B'}], default: '选项A' }` -> 纯下拉选择框。
*   `dataFlowType: 'WILDCARD'`, `matchCategories: ['Trigger']`, `config: { label: '执行' }` -> 一个显示为 "执行" 的按钮。

### 2.4. 输入操作按钮 (`actions`)

`InputDefinition` 中的 `actions` 属性允许为输入槽定义一组自定义操作按钮。每个操作按钮由一个 `NodeInputAction` 对象定义，其结构如下：

| 属性名             | 类型                                                                                             | 描述                                                                                                                                                                                             |
| :----------------- | :----------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`               | `string`                                                                                         | 唯一ID，用于标识操作。也用于覆盖标准操作，例如，如果此ID为 `'builtin_preview'`，则此定义将覆盖默认的预览按钮。                                                                                   |
| `icon`             | `string` (可选)                                                                                  | 图标名称 (推荐使用 Heroicons v2 outline 样式的图标名称，小驼峰格式, e.g., `'eye'`, `'pencilSquare'`)。如果未提供，`NodeInputActionsBar.vue` 组件会尝试根据 `handlerType` 或 `id` 提供一个默认图标。 |
| `label`            | `string` (可选)                                                                                  | 按钮上显示的文本标签，与 `icon` 二选一或共存。                                                                                                                                                     |
| `tooltip`          | `string` (可选)                                                                                  | 按钮的 Tooltip 提示文本。                                                                                                                                                                        |
| `handlerType`      | `'builtin_preview'`, `'builtin_editor'`, `'emit_event'`, `'client_script_hook'`, `'open_panel'` | 操作的处理方式：<br> - `'builtin_preview'`: 使用内置的 Tooltip 预览逻辑。<br> - `'builtin_editor'`: 使用内置方法打开编辑器。<br> - `'emit_event'`: 发出一个自定义事件。<br> - `'client_script_hook'`: 调用节点客户端脚本中定义的钩子函数。<br> - `'open_panel'`: 触发打开指定的侧边栏面板或弹窗。 |
| `handlerArgs`      | `Record<string, any>` (可选)                                                                     | 传递给处理程序的参数，具体结构取决于 `handlerType`。例如：<br> - for `'builtin_editor'`: `{ editorType?: string, languageHint?: string, preferFloatingEditor?: boolean }`<br> - for `'open_panel'`: `{ panelId: string, panelTitle?: string, ... }`<br> - for `'emit_event'`: `{ eventName: string, eventPayload?: any }`<br> - for `'client_script_hook'`: `{ hookName: string, hookPayload?: any }` |
| `showConditionKey` | `string` (可选, 默认 `'always'`)                                                                 | 控制按钮显示条件的预定义键 (e.g., `'always'`, `'ifNotConnected'`, `'ifHasValue'`, `'never'`)。前端组件将实现这些条件的判断逻辑。                                                                 |

这些操作按钮由前端组件 `NodeInputActionsBar.vue` 负责渲染和管理。语义标签 `CanPreview` 和 `NoDefaultEdit` 可以影响默认预览和编辑按钮的显示，而 `actions` 数组则提供了更细致的控制能力。

### 2.5. 示例插槽定义 (参考 `TestWidgetsNode.ts`)

```typescript
// 示例: Markdown 输入插槽
inputs: {
  markdown_input: {
    dataFlowType: 'STRING',
    displayName: 'Markdown文本',
    description: 'Markdown 内容输入测试',
    required: false,
    matchCategories: ['Markdown'], // 明确是 Markdown
    config: {
      default: '# 标题...',
      multiline: true,
      languageHint: 'markdown' // 辅助前端编辑器
    }
  }
}

// 示例: JSON 对象输入
inputs: {
  json_input: {
    dataFlowType: 'OBJECT', // 或 'STRING' 如果期望字符串形式的JSON
    displayName: 'JSON对象',
    matchCategories: ['Json'], // 语义标签
    config: {
      default: { "key": "value" },
      languageHint: 'json' // 如果 dataFlowType 是 STRING，这个有用
    }
  }
}

// 示例: 下拉选择 (Combo)
inputs: {
  combo_select: {
    dataFlowType: 'STRING', // 假设选项值为字符串
    displayName: '下拉选择',
    matchCategories: ['ComboOption'], // 标记为COMBO选项来源
    config: {
      default: '选项A',
      suggestions: [{value: '选项A', label: '选项A'}, {value: '选项B', label: '选项B'}, {value: '选项C', label: '选项C'}]
    }
  }
}
```

## 3. 连接兼容性规则

连接的有效性判断遵循以下顺序和逻辑：

### 3.1. 特殊行为标签 (`SocketMatchCategory`) 的影响 (最高优先级)

*   **`BEHAVIOR_WILDCARD`**: 如果一个插槽拥有此标签 (通常其 `dataFlowType` 为 `WILDCARD`)，它将覆盖其他规则，并可以连接到任何其他插槽。连接后，节点内部逻辑可以感知到对方的 `dataFlowType` 和 `matchCategories`。
*   **`BEHAVIOR_CONVERTIBLE`**: 如果一个插槽拥有此标签 (通常其 `dataFlowType` 为 `CONVERTIBLE_ANY`)，它在连接时，会将其自身的 `dataFlowType` 和所有其他 `matchCategories` (除了 `BEHAVIOR_CONVERTIBLE` 自身) 更改为与连接对方完全一致。此更改是持久化的，并优先于其他匹配逻辑。

### 3.2. 基于 `SocketMatchCategory` (语义/行为标签) 的优先匹配

*   此匹配仅在**源插槽和目标插槽都定义了 `matchCategories` (且 `matchCategories` 数组不为空)** 时进行。
*   令源插槽的 `matchCategories` 为 `SourceTags`，目标插槽的为 `TargetTags`。
*   **直接匹配**: 如果 `SourceTags` 和 `TargetTags` 存在至少一个相同的标签，则视为兼容。
*   **内置兼容规则**: (如果未来定义) 如果直接匹配失败，则查询一个预定义的规则集，该规则集说明某些 `SocketMatchCategory` 之间存在的单向或双向兼容性。
*   如果通过上述方式找到兼容性，则连接被认为是有效的。

### 3.3. 基于 `DataFlowType` (数据流类型) 的保底匹配

*   此匹配在以下情况进行：
    *   `SocketMatchCategory` 匹配未进行（例如，至少一个插槽没有定义 `matchCategories`，或定义的数组为空）。
    *   或者，`SocketMatchCategory` 匹配已进行但未成功建立兼容性。
*   兼容性基于预定义的 `DataFlowType` 转换规则：
    *   `INTEGER` 可以连接到 `FLOAT` (隐式转换)。
    *   `INTEGER`, `FLOAT`, `BOOLEAN` 可以连接到 `STRING` (隐式转换为字符串)。
    *   `WILDCARD` 可以连接到任何 `DataFlowType`。任何 `DataFlowType` 也可以连接到 `WILDCARD`。
    *   `CONVERTIBLE_ANY` 在连接时会将其自身的 `dataFlowType` 更改为与连接对方完全一致。
    *   **流式插槽 (`isStream: true`)**：
        *   流式插槽只能连接到流式插槽 (`output.isStream === input.isStream`)。
        *   连接时，还会进一步检查其 `dataFlowType` 是否兼容（遵循上述规则）。例如，一个 `isStream: true, dataFlowType: 'STRING'` 的输出可以连接到 `isStream: true, dataFlowType: 'WILDCARD'` 的输入。
        *   流与非流插槽之间不能直接连接。
*   如果通过 `DataFlowType` 规则找到兼容性，则连接被认为是有效的。

**总结连接逻辑优先级：**

1.  特殊行为标签 (`BEHAVIOR_WILDCARD`, `BEHAVIOR_CONVERTIBLE`) 具有最高优先级。
2.  如果双方插槽都提供了有效的 `SocketMatchCategory` 列表，则优先尝试基于这些标签进行匹配。
3.  如果 `SocketMatchCategory` 未提供或匹配失败，则回退到基于 `DataFlowType` 的匹配。

**多输入插槽 (`multi: true`) 的额外规则：**

*   若输入插槽定义了 `multi: true`，可接受多个连接。
*   **类型检查**:
    *   若定义了 `acceptTypes` (类型字符串数组，可以是 `DataFlowType` 名称或 `SocketMatchCategory` 标签)，每个连接的输出类型必须**精确匹配** `acceptTypes` 中的*至少一个*条目。
    *   若未定义 `acceptTypes`，每个连接必须与该输入插槽自身的类型定义 (其 `dataFlowType` 和 `matchCategories`) 兼容 (遵循上述连接逻辑)。

**重要提示：** 这些规则主要由前端强制执行以提供即时反馈。后端执行时可能进行额外验证或转换。

## 4. 节点级配置

节点定义 (`NodeDefinition`) 可包含独立于插槽的配置：

*   **`configSchema`**: 定义节点级配置项 (结构类似 `inputs`)，显示在节点主体独立区域。
*   **`configValues`**: 存储 `configSchema` 定义的配置项的实际值。
*   **`clientScriptUrl`**: (可选) 指向节点特定前端 JS 文件的 URL，用于处理自定义客户端逻辑 (例如 `RandomNumberNode.ts` 中的按钮交互)。
*   **`width`**: (可选) 节点渲染时的首选宽度 (像素)，用户可调整。
*   **组相关属性**: `isGroupInternal`, `groupId`, `groupConfig`, `dynamicSlots`。
*   **`data.groupInfo`**: (前端) 若节点是 `NodeGroup`，其 `data` 可能包含 `groupInfo`。

## 4.x 节点执行与流式输出

节点的 `execute` 方法负责其核心逻辑。除了返回一个包含所有输出值的对象 (通常包装在 `Promise` 中) 外，`execute` 方法还可以返回一个异步生成器 (`AsyncGenerator<ChunkPayload, Record<string, any> | void, undefined>`) 来实现流式输出。

当 `execute` 方法返回异步生成器时：
*   该节点应至少有一个输出槽的 `isStream` 被设置为 `true`。
*   生成器通过 `yield` 关键字产生的值都应该是一个 `ChunkPayload` 对象。这些数据块将通过 `NODE_YIELD` WebSocket 消息实时发送到前端，并被传递给连接到相应流式输出槽的下游节点的输入槽。
*   生成器最终通过 `return` 语句返回的值 (如果存在，通常是一个包含批处理结果的对象) 会在流处理完全结束后，作为节点的最终输出结果的一部分。这个批处理结果与流式输出槽是分开的（流式输出槽在执行期间的值是一个可读流实例）。

对于声明了 `isStream: true` 的输出插槽，其在工作流执行时传递给下游节点的值是一个 Node.js `Stream.Readable` 实例。下游节点负责消费这个流。

## 5. 执行状态

节点在工作流执行期间的状态由 `ExecutionStatus` 枚举定义：

*   `IDLE`: 空闲/未执行
*   `PENDING`: 等待执行 (依赖未就绪)
*   `RUNNING`: 正在执行
*   `COMPLETED`: 执行成功
*   `ERROR`: 执行出错
*   `SKIPPED`: 被跳过 (节点禁用或条件不满足)

前端根据后端状态更新改变节点视觉样式。

## 6. WebSocket 通信

节点系统依赖 WebSocket 进行前后端通信，消息类型定义在 `packages/types/src/node.ts` 中的 `WebSocketMessageType`。这包括工作流操作、节点定义获取、执行控制、状态更新等。其中与流式数据处理相关的关键消息类型有：
*   `NODE_YIELD`: 当节点通过其异步生成器 `yield` 一个 `ChunkPayload` 时，此消息类型用于将该数据块实时发送到前端。这表示流数据正在从源节点产生并向下游传递。
*   `WORKFLOW_INTERFACE_YIELD`: 类似于 `NODE_YIELD`，但用于工作流的输出接口产生的流式数据块，当工作流的某个输出被定义为流式时，通过此消息将数据块发送到前端。
