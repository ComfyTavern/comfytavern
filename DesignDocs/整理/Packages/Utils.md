# @comfytavern/utils 包文档

## 1. 包的概述

`@comfytavern/utils` 包是 ComfyTavern 项目中的一个核心共享模块，其源代码位于 [`packages/utils/src/`](packages/utils/src/)。该包的主要职责是提供一系列通用的工具函数，旨在被项目中的前端（`apps/frontend-vueflow/`）和后端（`apps/backend/`）共同使用，以减少代码重复，提高开发效率和代码一致性。

这些工具函数涵盖了数据处理、字符串操作、历史记录管理等多个方面。

## 2. 工具函数详解

所有工具函数都通过 [`packages/utils/src/index.ts`](packages/utils/src/index.ts:1) 文件统一导出。

### 2.1. 默认值工具 (defaultValueUtils.ts)

#### `getEffectiveDefaultValue(inputDef: InputDefinition): any`

*   **功能**：根据节点的输入定义 (`InputDefinition`) 计算并返回一个有效的默认值。这对于确保节点在创建或某些输入未连接时具有合理的初始状态至关重要。
*   **输入参数**：
    *   `inputDef: InputDefinition`：一个描述节点输入插槽详细配置的对象，类型定义于 `@comfytavern/types`。
*   **返回值**：`any`，表示根据输入定义解析出的默认值。
*   **核心逻辑**：
    1.  **优先使用 `inputDef.config.default`**：如果输入定义中明确指定了 `default` 值，则直接返回该值。
    2.  **处理旧 `COMBO` 逻辑**：如果 `inputDef.config.suggestions` 是一个非空数组，则返回数组的第一个元素。这主要用于兼容旧版节点配置中类似下拉选择框的默认行为。
    3.  **基于 `dataFlowType` 的类型特定默认值**：
        *   `'STRING'`: 返回空字符串 `''`。
        *   `'INTEGER'`: 返回 `0`。
        *   `'FLOAT'`: 返回 `0.0`。
        *   `'BOOLEAN'`: 返回 `false`。
        *   `'OBJECT'`: 返回空对象 `{}`。
        *   `'ARRAY'`: 返回空数组 `[]`。
        *   `'BINARY'`, `'WILDCARD'`, `'CONVERTIBLE_ANY'`, `'STREAM'`: 返回 `null`。
    4.  **未知类型**：如果 `dataFlowType` 未被识别，则在控制台打印警告并返回 `null`。
*   **典型使用场景**：
    *   在前端画布中创建新节点时，用于初始化该节点各个输入字段的默认显示值。
    *   在后端执行工作流时，如果某个输入未连接且需要一个值，此函数可提供一个基础默认值。

### 2.2. 历史记录工具 (historyUtils.ts)

#### `createHistoryEntry(actionType: string, objectType: string, summary: string, details: HistoryEntryDetails): HistoryEntry`

*   **功能**：创建一个标准结构的历史记录条目对象 (`HistoryEntry`)。这有助于在应用中统一历史记录的格式，便于后续的追踪、撤销/重做等操作。
*   **输入参数**：
    *   `actionType: string`：描述操作的类型，例如 "NODE_ADD", "CONNECTION_CREATE"。
    *   `objectType: string`：描述操作对象的类型，例如 "node", "edge"。
    *   `summary: string`：对操作的简短描述，未来可能用于国际化。
    *   `details: HistoryEntryDetails`：一个包含操作详细信息的对象，其具体结构取决于操作类型。
*   **返回值**：`HistoryEntry`，一个包含上述信息以及自动生成的当前时间戳 (`timestamp`) 的历史记录对象。
*   **典型使用场景**：
    *   当用户在前端画布上执行操作（如添加/删除节点、修改节点属性、连接/断开插槽）时，调用此函数生成历史条目，并存入历史记录栈。
    *   后端在执行某些关键操作后，也可能使用此函数记录事件。

### 2.3. 字符串工具 (stringUtils.ts)

#### `parseEscapedCharacters(rawInput: string, customMap?: Record<string, string>): string`

*   **功能**：解析用户输入的原始字符串，将其中的常见转义序列（如 `\n`, `\t`, `\"`, `\\`）转换成它们实际代表的字符。
*   **输入参数**：
    *   `rawInput: string`：用户输入的原始字符串。
    *   `customMap?: Record<string, string>` (可选)：一个对象，用于提供自定义的转义字符映射或覆盖默认的映射关系。
*   **返回值**：`string`，处理转义字符后的字符串。
*   **核心逻辑**：
    1.  **保护双反斜杠**：首先将所有 `\\` (代表一个字面反斜杠) 替换为一个内部占位符，以避免它们干扰后续单反斜杠转义符的处理。
    2.  **处理标准转义**：遍历一个预定义的 `ESCAPE_MAP` (包含如 `n` -> `\n`, `t` -> `\t`, `"` -> `"` 等映射)，将 `\n`, `\t`, `\"` 等替换为实际的换行符、制表符、双引号等。
    3.  **还原占位符**：将之前用于保护 `\\` 的占位符还原为单个字面反斜杠 `\`。
*   **典型使用场景**：
    *   在需要用户输入多行文本或包含特殊字符的字符串时（例如，在节点的文本配置区域、代码输入框、聊天消息输入框），使用此函数处理用户的输入，确保字符串在存储和显示时能正确反映用户的意图。
    *   例如，用户输入 `Hello\\nWorld`，经过此函数处理后会变成 `Hello\nWorld` (其中 `\n` 是一个实际的换行符)。

## 3. 使用场景举例

*   **前端节点初始化**：当用户从节点面板拖拽一个新节点到 VueFlow 画布上时，前端会遍历该节点的输入定义。对于每个输入定义，调用 [`getEffectiveDefaultValue()`](packages/utils/src/defaultValueUtils.ts:16) 来获取其初始值，并将其绑定到节点的响应式数据上，从而在界面上显示出预设的默认内容。
*   **前端操作记录与撤销/重做**：用户在画布上连接两个节点时，会调用 [`createHistoryEntry()`](packages/utils/src/historyUtils.ts:11) 生成一个如 `{ actionType: 'CONNECTION_CREATE', objectType: 'edge', summary: '连接节点A到节点B', details: { fromNode: 'A', fromSlot: 'out1', toNode: 'B', toSlot: 'in1' } }` 的历史条目，并推入历史记录栈。后续用户可以通过撤销操作回退此连接。
*   **后端处理用户输入**：如果一个节点接受用户输入的字符串参数，并且该字符串可能包含换行符或制表符（例如，一个用于生成文本的 LLM 节点，其提示词模板由用户输入）。在后端接收到这个参数后，可以先通过 [`parseEscapedCharacters()`](packages/utils/src/stringUtils.ts:46) 处理，确保字符串中的 `\n` 被正确解析为换行，然后再传递给后续的逻辑单元。

## 4. 维护和扩展

*   **通用性优先**：在向 `@comfytavern/utils` 包添加新的工具函数时，应优先考虑其通用性。避免将特定于某个模块或高度业务相关的逻辑放入此共享包中。
*   **模块化**：根据功能将新的工具函数添加到对应的文件中（例如，新的字符串处理函数应加入 [`stringUtils.ts`](packages/utils/src/stringUtils.ts:1)）。如果功能自成一类，可以创建新的 `.ts` 文件。
*   **导出**：确保所有新的公共工具函数都在 [`packages/utils/src/index.ts`](packages/utils/src/index.ts:1) 中被导出，以便项目其他部分可以方便地导入和使用。
*   **类型安全**：为所有函数参数和返回值提供明确的 TypeScript 类型定义。
*   **文档注释**：为新的工具函数编写清晰的 JSDoc/TSDoc 注释，说明其功能、参数、返回值和使用示例。
*   **单元测试**：强烈建议为新的工具函数编写单元测试，以确保其正确性和稳定性。