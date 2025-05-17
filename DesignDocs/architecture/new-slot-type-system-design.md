# 新版节点插槽类型系统设计文档

## 1. 引言与目标

当前 ComfyTavern 的节点插槽类型系统主要依赖于一个单一的 `type` 字符串来同时承载数据的实际格式和连接时的匹配逻辑。为了增强系统的灵活性、可扩展性和表达能力，我们提议对插槽类型系统进行重构。

**目标：**

- **明确区分数据流与匹配逻辑**：将插槽的实际数据传输格式 (`DataFlowType`) 与其在连接时用于兼容性判断的**可选的**语义/用途标签 (`SocketMatchCategory`) 分离开。`SocketMatchCategory` 主要用于表达语义，而 `DataFlowType` 作为基础和保底的匹配条件。这有助于清晰地区分传递的是对资源的引用（例如通过 URL 或文件路径）还是资源本身的实际数据（例如图像对象或二进制流）。
- **增强连接灵活性**：允许一个插槽拥有多个匹配类别，并定义它们之间的兼容规则，从而实现更智能和更灵活的连接行为。
- **提升可扩展性**：使未来添加新的数据类型或匹配规则更加容易，而不需要频繁修改核心类型定义。
- **清晰化 UI 表现**：通过配置项（如 `uiHint`）更明确地指导前端 UI 组件的渲染，使其与数据类型和语义解耦。

## 2. 核心概念

新的类型系统主要围绕以下核心概念构建：

- **`DataFlowType` (数据流类型)**:
  - 定义插槽实际传输和处理的基础数据结构。
  - 保持相对稳定和通用。
- **`SocketMatchCategory` (插槽匹配类别/标签)**:
  - **可选的**一个或多个描述插槽**语义、用途、内容特征或特殊匹配行为**的标签。
  - 主要用于连接时的兼容性判断，**如果提供的话**，作为优先匹配条件。
  - 具有高度的可扩展性。
- **`InputDefinition` / `OutputDefinition` 新结构**:
  - 旧的 `type: string` 字段将被 `dataFlowType: DataFlowTypeName` 替换。
  - 新增**可选的** `matchCategories: SocketMatchCategoryName[]` 字段，用于定义语义或行为标签。
  - 可选的 `acceptTypes: string[]` 字段（如果保留）可以作为用户在节点定义时附加的自定义匹配标签，与 `matchCategories` 合并使用。
  - `config` 对象中可以增加 `uiHint: string` 等字段来指导前端渲染。

## 3. 类型定义

以下类型将在 `packages/types/src/schemas.ts` (或新的专用类型文件) 中定义为常量对象，并导出相应的 TypeScript 类型别名。

### 3.1. `DataFlowType`

```typescript
export const DataFlowType = {
  STRING: "STRING",
  INTEGER: "INTEGER",
  FLOAT: "FLOAT",
  BOOLEAN: "BOOLEAN",
  OBJECT: "OBJECT",
  ARRAY: "ARRAY",
  BINARY: "BINARY",
  WILDCARD: "WILDCARD", // 特殊类型: 通配符，不指定数据格式
  CONVERTIBLE_ANY: "CONVERTIBLE_ANY", // 特殊类型: 连接时动态转换
} as const;
export type DataFlowTypeName = (typeof DataFlowType)[keyof typeof DataFlowType];
```

- **STRING**: 通用文本字符串。
- **INTEGER**: 整数。
- **FLOAT**: 浮点数。
- **BOOLEAN**: 布尔值。
- **OBJECT**: 通用 JavaScript 对象。
- **ARRAY**: 通用 JavaScript 数组。
- **BINARY**: 二进制数据 (例如 `ArrayBuffer`, `Uint8Array`)。
- **WILDCARD**: 特殊类型，表示可连接任何类型，本身不定义数据格式，连接时不强制转换。
- **CONVERTIBLE_ANY**: 特殊类型，连接时动态转换其 `dataFlowType` 和 `matchCategories` 以匹配对方。

### 3.2. `SocketMatchCategory` (V3 精简版)

```typescript
export const SocketMatchCategory = {
  // 语义化/内容特征标签
  CODE: "Code",
  JSON: "Json",
  MARKDOWN: "Markdown",
  URL: "Url",
  FILE_PATH: "FilePath",
  PROMPT: "Prompt",
  CHAT_MESSAGE: "ChatMessage",
  CHAT_HISTORY: "ChatHistory",
  LLM_CONFIG: "LlmConfig",
  LLM_OUTPUT: "LlmOutput",
  VECTOR_EMBEDDING: "VectorEmbedding",
  CHARACTER_PROFILE: "CharacterProfile",
  IMAGE_DATA: "ImageData",         // 实际图像数据 (通常为 OBJECT 或 BINARY DataFlowType)
  AUDIO_DATA: "AudioData",         // 实际音频数据 (通常为 OBJECT 或 BINARY DataFlowType)
  VIDEO_DATA: "VideoData",         // 实际视频数据 (通常为 OBJECT 或 BINARY DataFlowType)
  RESOURCE_ID: "ResourceId",
  TRIGGER: "Trigger",
  STREAM_CHUNK: "StreamChunk",
  COMBO_OPTION: "ComboOption", // 用于标记来源于或适用于COMBO选择的值

  // 行为标签
  BEHAVIOR_WILDCARD: "BehaviorWildcard",
  BEHAVIOR_CONVERTIBLE: "BehaviorConvertible",
} as const;
export type SocketMatchCategoryName =
  (typeof SocketMatchCategory)[keyof typeof SocketMatchCategory];
```

- `SocketMatchCategory` 现在主要包含**语义化标签** (如 `Code`, `Json`, `ChatMessage`, `ImageData` 等) 和**行为标签** (`BehaviorWildcard`, `BehaviorConvertible`)。这些标签是可选的。
- **语义化标签**: 描述插槽期望的内容、用途或特定数据格式。例如，一个期望图像URL的输入插槽，其 `DataFlowType` 通常为 `STRING`，`matchCategories` (可选) 可能包含 `Url`；而 `ImageData` 则通常与 `DataFlowType` 为 `OBJECT` 或 `BINARY` 配合，其 `matchCategories` (可选) 可能包含 `ImageData`，表示传递的是实际的图像数据本身。一个插槽可以有多个语义化标签。
- **行为标签**: 描述插槽特殊的连接行为。

## 4. 插槽定义示例 (在 NodeDefinition 中)

```typescript
 //示例: 代码输入插槽
 inputs: {
   myCodeInput: {
     dataFlowType: 'STRING', // 或 DataFlowType.STRING
     matchCategories: ['Code'], // 或 [SocketMatchCategory.CODE] (String 标签已移除，DataFlowType.STRING 会处理基础类型)
     displayName: 'Python 代码',
     description: '请输入 Python 代码片段',
     config: {
       uiHint: 'code-editor',
       languageHint: 'python',
       default: 'print("Hello, ComfyTavern!")'
     }
   }
 }

 //示例: 聊天历史输出插槽
 outputs: {
   chatHistoryOutput: {
     dataFlowType: 'ARRAY',
     matchCategories: ['ChatHistory'], // Array 标签已移除
     displayName: '聊天记录',
   }
 }

 //示例: 接受图像URL或Base64的输入
 inputs: {
   imageInput: {
     dataFlowType: 'STRING',
     matchCategories: ['Url'], // String 标签已移除，Url 是语义标签，节点内部处理其是否为图像URL
     displayName: '图像来源URL',
     config: {
       placeholder: '输入图像URL或粘贴Base64'
     }
   }
 }
 //示例: 接受实际图像数据的输入 (例如，二进制流)
 inputs: {
   actualImageInput: {
     dataFlowType: 'BINARY', // 或 'OBJECT'，取决于图像数据的具体表示方式
     matchCategories: ['ImageData'], // Binary/Object 标签已移除，ImageData 是语义标签
     displayName: '图像数据',
     description: '输入实际的图像二进制数据或图像对象',
     config: {
       // uiHint: 'file-upload' // 可选的UI提示，用于前端渲染文件上传组件
     }
   }
 }
```

## 5. 连接兼容性规则

连接的有效性判断遵循以下顺序和逻辑：

### 5.1. 基于 `SocketMatchCategory` (语义/行为标签) 的优先匹配
- 此匹配仅在**源插槽和目标插槽都定义了 `matchCategories` (且 `matchCategories` 数组不为空)** 时进行。
- 令源插槽的 `matchCategories` 为 `SourceTags`，目标插槽的为 `TargetTags`。
- **直接匹配**: 如果 `SourceTags` 和 `TargetTags` 存在至少一个相同的标签，则视为兼容。
- **内置兼容规则**: 如果直接匹配失败，则查询一个预定义的规则集，该规则集说明某些 `SocketMatchCategory` 之间存在的单向或双向兼容性。
  - 例如：如果一个插槽期望 `Url` (`SocketMatchCategory`)，它可能也兼容一个更通用的语义标签（如果定义了此类规则，例如 `Code` 可能兼容代表纯文本的语义标签，但这需要具体定义）。
- 如果通过上述方式找到兼容性，则连接被认为是有效的，后续的 `DataFlowType` 匹配可以跳过或作为额外验证。

### 5.2. 基于 `DataFlowType` (数据流类型) 的保底匹配
- 此匹配在以下情况进行：
    - `SocketMatchCategory` 匹配未进行（例如，至少一个插槽没有定义 `matchCategories`，或定义的数组为空）。
    - 或者，`SocketMatchCategory` 匹配已进行但未成功建立兼容性。
- 兼容性基于预定义的 `DataFlowType` 转换规则：
    - 例如：`INTEGER` (`DataFlowType`) 可以连接到 `FLOAT` (`DataFlowType`) (隐式转换)。
    - `INTEGER`, `FLOAT`, `BOOLEAN` (`DataFlowType`) 可以连接到 `STRING` (`DataFlowType`) (隐式转换为字符串)。
    - `WILDCARD` (`DataFlowType`) 可以连接到任何 `DataFlowType`。
    - `CONVERTIBLE_ANY` (`DataFlowType`) 在连接时会将其自身的 `dataFlowType` 更改为与连接对方完全一致。
- 如果通过 `DataFlowType` 规则找到兼容性，则连接被认为是有效的。

### 5.3. 特殊行为标签 (`SocketMatchCategory`) 的影响
- **`BEHAVIOR_WILDCARD`**: 如果一个插槽拥有此 `SocketMatchCategory` 标签 (通常其 `dataFlowType` 为 `WILDCARD`)，它将覆盖上述规则，并可以连接到任何其他插槽。连接后，节点内部逻辑可以感知到对方的 `dataFlowType` 和 `matchCategories`。
- **`BEHAVIOR_CONVERTIBLE`**: 如果一个插槽拥有此 `SocketMatchCategory` 标签 (通常其 `dataFlowType` 为 `CONVERTIBLE_ANY`)，它在连接时，会将其自身的 `dataFlowType` 和所有其他 `matchCategories` (除了 `BEHAVIOR_CONVERTIBLE` 自身) 更改为与连接对方完全一致。此更改是持久化的，并优先于其他匹配逻辑。

**总结连接逻辑优先级：**
1. 特殊行为标签 (`BEHAVIOR_WILDCARD`, `BEHAVIOR_CONVERTIBLE` 在 `SocketMatchCategory` 中定义时) 具有最高优先级，并可能修改连接行为或覆盖其他规则。
2. 如果双方插槽都提供了有效的 `SocketMatchCategory` 列表，则优先尝试基于这些语义/行为标签进行匹配。
3. 如果 `SocketMatchCategory` 未提供或匹配失败，则回退到基于 `DataFlowType` 的匹配作为保底条件。

## 6. 对现有系统的影响与迁移策略

- **核心类型文件**: 主要修改 `packages/types/src/schemas.ts` (定义新类型) 和 `packages/types/src/node.ts` (更新 `InputDefinition`, `OutputDefinition`, `GroupSlotInfo`)。
- **节点定义**: 所有位于 `apps/backend/src/nodes/` 下的节点定义都需要更新其 `inputs` 和 `outputs` 以使用新的 `dataFlowType` 和 `matchCategories`。
- **连接逻辑**: `apps/frontend-vueflow/src/composables/canvas/useCanvasConnections.ts` 中的 `isTypeCompatible`, `isValidConnection`, `handleConnect` 等函数需要重写。
- **默认值工具**: `packages/utils/src/defaultValueUtils.ts` 中的 `getEffectiveDefaultValue` 需要根据新的 `dataFlowType` 更新。
- **文档**: `docs/node-types/node-types.zh.md` 需要完全重写或基于此新设计文档更新。

迁移可以分阶段进行，首先定义新类型，然后逐步更新核心逻辑和节点定义。

## 7. UI 表现建议

- 节点插槽的 `config` 对象中可以增加 `uiHint: string` 字段 (例如 `uiHint: 'code-editor'`, `uiHint: 'combo-select'`, `uiHint: 'slider'`) 来明确建议前端应渲染的 UI 组件。
- `languageHint: string` (例如 `languageHint: 'python'`, `languageHint: 'json'`) 可以配合 `uiHint: 'code-editor'` 使用。
- 前端在渲染插槽时，应优先检查 `uiHint`。如果不存在，则可以根据 `dataFlowType` 和 `matchCategories` 的组合来推断合适的默认 UI 组件。
- Tooltip 可以显示插槽的 `dataFlowType` 和所有 `matchCategories`。

## 8. 候选节点菜单

当用户从一个输出插槽拖出连线时，候选节点菜单的生成逻辑：

1.  获取源输出插槽的 `matchCategories` (记为 `SourceOutputTags`, 可能为空或未定义) 和 `dataFlowType` (记为 `SourceDft`)。
2.  遍历所有可用节点定义。
3.  对每个节点的每个输入插槽：
    a. 获取其 `matchCategories` (记为 `TargetInputTags`, 可能为空或未定义) 和 `dataFlowType` (记为 `TargetDft`)。
    b. **应用连接兼容性规则 (参考第 5 节)** 来判断源输出和目标输入是否兼容：
        i.  首先检查是否存在特殊行为标签 (`BEHAVIOR_WILDCARD`, `BEHAVIOR_CONVERTIBLE`) 并应用其逻辑。
        ii. 如果没有特殊行为标签主导，且 `SourceOutputTags` 和 `TargetInputTags` 都有效且不为空，则尝试基于 `SocketMatchCategory` 进行匹配。
        iii. 如果 `SocketMatchCategory` 不适用或匹配失败，则尝试基于 `DataFlowType` (`SourceDft` 与 `TargetDft`) 进行匹配。
    c.  记录兼容的输入插槽及其所属节点。
4.  根据匹配的优先级（特殊行为标签 > `SocketMatchCategory` 匹配 > `DataFlowType` 匹配）对候选列表进行排序和展示。

