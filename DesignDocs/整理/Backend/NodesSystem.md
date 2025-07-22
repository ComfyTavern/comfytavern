# 后端节点系统 (Nodes System)

## 1. 节点系统 (`apps/backend/src/nodes/`) 概览

`apps/backend/src/nodes/` 目录是 ComfyTavern 后端所有**内置**可执行节点类型定义的核心位置。节点是工作流执行引擎的基本构建块和功能单元，封装了各种原子操作。它们可以由系统内置提供，也可以通过**插件系统**动态加载。

### 目录职责

`apps/backend/src/nodes/` 及其子目录负责组织和存放**内置节点**的定义文件。而插件提供的节点则位于各自插件的目录中。每个节点定义文件（通常是 `.ts` 文件）或其导出的 `definition` 对象描述了一个特定节点的功能、输入、输出和执行逻辑。

### 节点在系统中的作用

节点作为 ComfyTavern 工作流执行引擎的基本构建块，承担以下核心作用：

*   **功能单元**：每个节点封装一个特定的功能，如加载数据、调用大语言模型、处理文本、合并数据流等。
*   **数据流转**：节点通过其定义的输入和输出插槽（Slots/Sockets）接收和传递数据，构成工作流的数据流图。
*   **可组合性**：节点可以被灵活地连接和组合，以构建复杂的工作流来完成各种 AI 任务。
*   **可执行性**：每个节点定义了其核心的执行逻辑，由 [`ExecutionEngine.ts`](../../../../apps/backend/src/ExecutionEngine.ts:1) 在工作流执行时调用。

### 设计目标

后端节点系统的主要设计目标包括：

*   **模块化**：将复杂功能拆分为独立的、可复用的节点单元。
*   **可扩展性**：方便开发者添加新的自定义节点类型以扩展平台功能。
*   **类型安全**：利用 TypeScript 和 Zod ([`packages/types/src/schemas.ts`](../../../../packages/types/src/schemas.ts:1)) 定义节点的输入、输出和配置，确保数据类型的正确性和一致性。
*   **前后端一致性**：节点定义不仅服务于后端执行，其元数据（如 `displayName`, `description`, `category` 等）也用于前端 UI 的展示和交互。
*   **动态性与灵活性**：支持动态插槽（如 [`GroupInputNode.ts`](../../../../apps/backend/src/nodes/io/GroupInputNode.ts:1)）和可配置行为，以适应更广泛的应用场景。

相关的核心服务包括：

*   [`NodeManager.ts`](../../../../apps/backend/src/services/NodeManager.ts:1)：负责注册、存储和检索所有已加载的节点定义。
*   [`NodeLoader.ts`](../../../../apps/backend/src/services/NodeLoader.ts:1)：负责从文件系统中发现并加载节点定义模块。

## 2. 节点核心概念与基类/接口

一个“节点”在 ComfyTavern 后端是通过一个遵循特定结构（[`NodeDefinition`](../../../../packages/types/src/node.ts:134) 接口）的对象来定义的。

### 节点定义 (`NodeDefinition`)

每个节点定义通常包含以下核心部分：

*   **`type: string`**：节点的唯一类型标识符（例如 `"TextMerge"`, `"GenericLlmRequest"`）。
*   **`namespace?: string`**：节点的命名空间（例如 `"core"`, `"my-plugin"`）。由 [`NodeManager.ts`](../../../../apps/backend/src/services/NodeManager.ts:26) 在注册时确定，优先级为：节点显式定义 > **插件加载器提供的插件名称** > [`nodeRegistration.ts`](../../../../apps/backend/src/utils/nodeRegistration.ts:9) 提供的默认命名空间 > 从文件路径推断。最终的完整类型为 `namespace:type`。
*   **`category: string`**：节点所属的功能分类（例如 `"实用工具"`, `"LLM"`, `"Loaders"`），用于前端组织和展示。
*   **`displayName: string`**：用户友好的显示名称，在前端 UI 上显示。
*   **`description: string`**：对节点功能的详细描述。
*   **`inputs: Record<string, InputDefinition>`**：定义节点的输入插槽。
*   **`outputs: Record<string, OutputDefinition>`**：定义节点的输出插槽。
*   **`execute?: (...) => Promise<Record<string, any>> | AsyncGenerator<ChunkPayload, Record<string, any> | void, undefined>`**：节点的核心执行逻辑。
*   **`configSchema?: Record<string, InputDefinition>`**：定义节点的可配置参数（Widgets/Properties），允许用户在前端调整节点行为。这些配置项在前端通常显示为节点内部的控件。
*   **`clientScriptUrl?: string`**：可选，指向一个在前端执行的客户端脚本的 URL，用于实现节点的部分或全部前端交互逻辑（例如 [`RandomNumberNode.ts`](../../../../apps/backend/src/nodes/Utilities/RandomNumberNode.ts:66)）。
*   **`filePath?: string`**：节点定义文件的路径，由 [`NodeLoader.ts`](../../../../apps/backend/src/services/NodeLoader.ts:1) 在加载时添加。
*   **`dynamicSlots?: boolean`**：标记节点是否支持动态添加或修改插槽（例如 [`GroupInputNode.ts`](../../../../apps/backend/src/nodes/io/GroupInputNode.ts:46)）。
*   **`bypassBehavior?: "mute" | BypassBehavior`**: 定义节点被禁用（bypass）时的行为。

### 输入与输出 (Slots/Sockets)

节点的输入和输出通过 `inputs` 和 `outputs` 字段定义，每个插槽遵循 [`InputDefinition`](../../../../packages/types/src/node.ts:112) 或 [`OutputDefinition`](../../../../packages/types/src/node.ts:121) 接口。

关键属性包括：

*   **`displayName?: string`**: 插槽在 UI 上的显示名称。
*   **`dataFlowType: DataFlowTypeName`**: 插槽的数据类型，例如 `STRING`, `INTEGER`, `OBJECT`, `STREAM`, `CONVERTIBLE_ANY`。定义在 [`DataFlowType`](../../../../packages/types/src/common.ts:3) 中。
*   **`matchCategories?: string[]`**: 用于连接校验和 UI 行为的类别标签，例如 `ChatHistory`, `LlmConfig`, `BehaviorConvertible`。定义在 [`BuiltInSocketMatchCategory`](../../../../packages/types/src/common.ts:20) 中。
*   **`required?: boolean | ((configValues: Record<string, any>) => boolean)`**: (仅输入) 指示该输入是否为必需。
*   **`multi?: boolean`**: (仅输入) 指示该输入是否允许多个连接。
*   **`config?: Record<string, any>`**: (仅输入) 用于定义与输入关联的内联控件的配置，如默认值、最小值、最大值、建议列表等。
*   **`actions?: NodeInputAction[]`**: (仅输入) 定义与输入关联的操作按钮。

### 配置项 (Widgets/Properties)

节点的可配置参数通过 `configSchema` 字段定义。每个配置项也遵循 [`InputDefinition`](../../../../packages/types/src/node.ts:112) 接口，其结构与输入插槽的定义类似，允许为节点设置持久化的配置值。这些配置通常在前端节点 UI 的特定区域显示为可交互的控件。

### 执行逻辑 (`execute` 方法)

`execute` 方法是节点的核心，它定义了节点被调用时执行的操作。

*   **参数**：
    *   `inputs: Record<string, any>`: 一个包含所有输入插槽当前值的对象。
    *   `context?: any`: 执行上下文，可能包含 `promptId`, `nodeId`, `workflowInterfaceInputs` 等信息，由 [`ExecutionEngine.ts`](../../../../apps/backend/src/ExecutionEngine.ts:660) 提供。
*   **返回值**：
    *   对于批处理节点：`Promise<Record<string, any>>`，其中键是输出插槽的名称，值是对应的输出数据。
    *   对于流式节点：`AsyncGenerator<ChunkPayload, Record<string, any> | void, undefined>`。它会 `yield` [`ChunkPayload`](../../../../packages/types/src/common.ts:49) 对象，并在最后 `return` 一个包含所有非流式输出的对象（或 `void` 如果没有非流式输出）。

### 基类/接口

所有节点定义都必须实现 [`NodeDefinition`](../../../../packages/types/src/node.ts:134) 接口（定义在 `@comfytavern/types` 包中）。这个接口确保了所有节点都有一致的结构，便于系统的加载、管理和执行。

## 3. 节点分类与详解

节点根据其功能被组织在 `apps/backend/src/nodes/` 下的各个子目录中。每个子目录通常对应一个节点类别。

### IO (`apps/backend/src/nodes/io/`)

**类别概述**：IO (Input/Output) 相关的节点主要负责处理工作流或节点组的输入输出接口。它们是构建可复用和嵌套工作流的关键。

**代表性节点**：

*   **[`GroupInputNode.ts`](../../../../apps/backend/src/nodes/io/GroupInputNode.ts:1)** (`core:GroupInput`)
    *   **功能**：定义节点组的输入接口。当在节点组内部使用时，它从该节点组的外部输入接收数据，并将其作为输出传递给组内的其他节点。
    *   **输入/输出**：没有固定的输入。其输出是动态的，根据节点组的接口定义而定。初始时有一个 `CONVERTIBLE_ANY` 类型的输出插槽，连接后会自动适应类型并生成新的 `CONVERTIBLE_ANY` 插槽。
    *   **配置**：动态插槽的属性（名称、类型等）可在前端侧边栏编辑。
*   **[`GroupOutputNode.ts`](../../../../apps/backend/src/nodes/io/GroupOutputNode.ts:1)** (`core:GroupOutput`)
    *   **功能**：定义节点组的输出接口。当在节点组内部使用时，它接收来自组内其他节点的输入，并将其作为该节点组的外部输出暴露出去。
    *   **输入/输出**：其输入是动态的。没有固定的输出。初始时有一个 `CONVERTIBLE_ANY` 类型的输入插槽，连接后会自动适应类型并生成新的 `CONVERTIBLE_ANY` 插槽。
    *   **配置**：动态插槽的属性可在前端侧边栏编辑。
*   **[`NodeGroupNode.ts`](../../../../apps/backend/src/nodes/io/NodeGroupNode.ts:1)** (`core:NodeGroup`)
    *   **功能**：实例化并执行一个预定义的工作流（节点组）。它允许将一个完整的工作流封装成一个可复用的节点。
    *   **输入/输出**：其输入和输出插槽是动态的，完全取决于它所引用的工作流的 `GroupInput` 和 `GroupOutput` 节点所定义的接口。
    *   **配置**：核心配置是 `referencedWorkflowId`，用于选择要引用的工作流。

### LLM (`apps/backend/src/nodes/llm/` 和 `apps/backend/src/nodes/llm-test/`)

**类别概述**：LLM (Large Language Model) 相关的节点负责与大语言模型进行交互，包括发送请求、处理响应等。`llm-test/` 目录包含一些早期的或特定于测试的 LLM 节点。

**代表性节点**：

*   **[`GenericLlmRequestNode.ts`](../../../../apps/backend/src/nodes/llm/GenericLlmRequestNode.ts:1)** (`core:GenericLlmRequest`)
    *   **功能**：一个通用的 LLM 请求节点，设计为根据所需能力（如 `llm,chat` 或 `llm,vision`）通过后端服务（如模型路由服务）向合适的 LLM 发送请求。
    *   **输入**：`messages` (CustomMessage[]), `parameters` (对象，如 temperature, max_tokens)。
    *   **输出**：`response` (完整的标准化响应对象), `responseText` (主要的文本内容)。
    *   **配置**：`required_capabilities` (逗号分隔的能力列表)。
*   **[`OpenAIChatNode.ts`](../../../../apps/backend/src/nodes/llm-test/OpenAIChatNode.ts:1)** (`core:OpenAIChat`) (来自 `llm-test`)
    *   **功能**：与 OpenAI 兼容的聊天模型进行交互，支持历史记录和图像输入。
    *   **输入**：`api_settings`, `model`, `temperature`, `max_tokens`, `system_prompt`, `user_input`, `external_history`, `image`。
    *   **输出**：`full_conversation` (完整对话文本), `current_output` (当前模型回复), `history` (更新后的 JSON 历史)。
*   **[`OpenAINode.ts`](../../../../apps/backend/src/nodes/llm-test/OpenAINode.ts:1)** (`core:OpenAI`) (来自 `llm-test`)
    *   **功能**：使用 OpenAI 兼容的 API 进行聊天补全，支持流式和批处理输出。
    *   **输入**：`api_settings`, `model`, `prompt`, `temperature`, `max_tokens`, `system_prompt`, `history`, `image`, `stream` (布尔值，控制是否流式输出)。
    *   **输出**：`response` (批处理或完整流的文本), `stream_output` (流式文本块)。
*   **[`APISettingsNode.ts`](../../../../apps/backend/src/nodes/llm-test/APISettingsNode.ts:1)** (`core:APISettings`) (来自 `llm-test`)
    *   **功能**：配置 OpenAI API 或其他兼容 API 的连接信息（如 Base URL, API Key）。
    *   **输入**：`use_env_vars`, `base_url`, `api_key`。
    *   **输出**：`api_settings` (包含处理后的 URL 和 Key 的对象)。

### Loaders (`apps/backend/src/nodes/loaders/`)

**类别概述**：Loaders 类别下的节点主要负责从外部来源（如文件系统）加载数据，并将其转换为工作流中其他节点可以使用的格式。

**代表性节点**：

*   **[`CharacterCardLoaderNode.ts`](../../../../apps/backend/src/nodes/loaders/CharacterCardLoaderNode.ts:1)** (`core:CharacterCardLoader`)
    *   **功能**：从文件加载角色卡数据（支持 JSON 或 PNG 格式，PNG 格式通过元数据提取）。
    *   **输入**：无直接输入，通过 `configSchema` 中的 `cardResource` 选择文件。
    *   **输出**：`characterData` (解析后的角色卡对象)。
*   **[`HistoryLoaderNode.ts`](../../../../apps/backend/src/nodes/loaders/HistoryLoaderNode.ts:1)** (`core:HistoryLoader`)
    *   **功能**：从 JSON 文件加载对话历史，并验证其格式为 `CustomMessage[]`。
    *   **输入**：无直接输入，通过 `configSchema` 中的 `historyResource` 选择文件。
    *   **输出**：`historyMessages` (加载并验证后的 `CustomMessage` 数组)。
*   **[`PresetLoaderNode.ts`](../../../../apps/backend/src/nodes/loaders/PresetLoaderNode.ts:1)** (`core:PresetLoader`)
    *   **功能**：从 JSON 文件加载 LLM 提示词预设配置。
    *   **输入**：无直接输入，通过 `configSchema` 中的 `presetResource` 选择文件。
    *   **输出**：`presetData` (解析后的预设配置对象)。
*   **[`RegexRuleLoaderNode.ts`](../../../../apps/backend/src/nodes/loaders/RegexRuleLoaderNode.ts:1)** (`core:RegexRuleLoader`)
    *   **功能**：从 JSON 或 YAML 文件加载正则表达式规则列表。
    *   **输入**：无直接输入，通过 `configSchema` 中的 `ruleResource` 选择文件。
    *   **输出**：`regexRules` (加载并验证后的 `RegexRule` 数组)。
*   **[`WorldBookLoaderNode.ts`](../../../../apps/backend/src/nodes/loaders/WorldBookLoaderNode.ts:1)** (`core:WorldBookLoader`)
    *   **功能**：从 JSON 或 YAML 文件加载世界书（World Book）配置。
    *   **输入**：无直接输入，通过 `configSchema` 中的 `worldBookResource` 选择文件。
    *   **输出**：`worldBookData` (解析后的世界书对象)。

### Processors (`apps/backend/src/nodes/processors/`)

**类别概述**：Processors 类别下的节点负责对数据进行处理和转换，例如文本操作、数据结构构建等。

**代表性节点**：

*   **[`ApplyRegexNode.ts`](../../../../apps/backend/src/nodes/processors/ApplyRegexNode.ts:1)** (`core:ApplyRegex`)
    *   **功能**：将一组正则表达式规则应用于输入文本。支持从输入槽加载规则和内联定义的规则，内联规则优先。
    *   **输入**：`inputText` (字符串), `inlineRegexRules` (RegexRule[]), `regexRules` (RegexRule[])。
    *   **输出**：`outputText` (应用正则后的字符串)。
*   **[`ContextBuilderNode.ts`](../../../../apps/backend/src/nodes/processors/ContextBuilderNode.ts:1)** (`core:ContextBuilder`)
    *   **功能**：将来自预设、世界书、角色卡和历史记录的各种数据组合成最终的 LLM 输入消息列表 (`CustomMessage[]`)。
    *   **输入**：`presetData`, `worldBookData`, `characterData`, `historyMessages`。
    *   **输出**：`finalMessages` (组合后的 `CustomMessage` 数组)。

### Utilities (`apps/backend/src/nodes/Utilities/`)

**类别概述**：Utilities 类别包含各种通用的辅助节点，提供文本操作、数据合并、调试等功能。

**代表性节点**：

*   **[`MergeNode.ts`](../../../../apps/backend/src/nodes/Utilities/MergeNode.ts:1)** (`core:TextMerge`)
    *   **功能**：将多个文本输入使用指定的分隔符合并成一个单一的文本字符串。
    *   **输入**：`text_inputs` (字符串数组，通过 `multi: true` 实现), `separator` (分隔符字符串)。
    *   **输出**：`merged_text` (合并后的字符串)。
*   **[`StreamLoggerNode.ts`](../../../../apps/backend/src/nodes/Utilities/StreamLoggerNode.ts:1)** (`core:StreamLogger`)
    *   **功能**：接收一个流作为输入，将流中的每个数据块（Chunk）记录到控制台，然后将原始数据块透传到输出流。主要用于调试流式数据。
    *   **输入**：`inputStream` (流)。
    *   **输出**：`outputStream` (与输入流内容相同的流)。
*   **[`StreamSuffixRelayNode.ts`](../../../../apps/backend/src/nodes/Utilities/StreamSuffixRelayNode.ts:1)** (`core:StreamSuffixRelay`)
    *   **功能**：接收一个文本流，为流中的每个文本块添加指定的后缀，然后将修改后的流接力输出。
    *   **输入**：`inputStream` (流), `suffix` (字符串)。
    *   **输出**：`outputStream` (添加后缀后的文本流)。
*   **[`RandomNumberNode.ts`](../../../../apps/backend/src/nodes/Utilities/RandomNumberNode.ts:1)** (`core:RandomNumber`)
    *   **功能**：生成和操作一个32位随机整数。其核心逻辑主要在前端通过 [`clientScriptUrl`](../../../../apps/backend/src/nodes/Utilities/RandomNumberNode.ts:66) ([`client-scripts/RandomNumberNode.js`](../../../../apps/backend/src/nodes/Utilities/client-scripts/RandomNumberNode.js:1)) 执行。后端 `execute` 仅作为数据通道或处理简单逻辑。
    *   **输入**：`mode` (固定, 增加, 减少, 随机), `value` (当前值), `reroll` (触发器)。
    *   **输出**：`number` (生成的数值)。
*   **[`TestWidgetsNode.ts`](../../../../apps/backend/src/nodes/Utilities/TestWidgetsNode.ts:1)** (`core:TestWidgets`)
    *   **功能**：一个用于测试各种前端输入组件（Widgets）的节点。它定义了多种类型的输入，并简单地将这些输入值传递到对应的输出。
    *   **输入/输出**：包含多种数据类型，如 `STRING`, `INTEGER`, `FLOAT`, `BOOLEAN`, `OBJECT` (JSON), `CODE` (Markdown, JS) 等。

## 4. 节点加载、注册与管理

节点定义在系统启动时被发现、加载、验证并注册到 [`NodeManager`](../../../../apps/backend/src/services/NodeManager.ts:1) 中，以便后续在工作流执行等场景中使用。

### 节点加载 ([`NodeLoader.ts`](../../../../apps/backend/src/services/NodeLoader.ts:1) 和 [`PluginLoader.ts`](../../../../apps/backend/src/services/PluginLoader.ts:1))

节点的加载分为两部分：内置节点和插件节点。

*   **内置节点加载**:
    *   在应用启动时，会调用 `NodeLoader.loadNodes(dirPath)` 方法扫描内置节点目录（`apps/backend/src/nodes/`）。
    *   `NodeLoader` 会遍历目录中的 `.ts` 文件，动态 `import()` 模块，并查找导出的 `definition` 或 `definitions`。
*   **插件节点加载**:
    *   当一个插件被加载时（通过 [`PluginLoader.ts`](../../../../apps/backend/src/services/PluginLoader.ts:1)），如果其 `plugin.yaml` 清单文件中定义了 `nodes` 入口，`PluginLoader` 会调用 `NodeLoader.loadNodes(pluginNodesPath, pluginName)`。
    *   `NodeLoader` 会加载指定路径下的插件节点，并将插件的名称（如 `"my-plugin"`）作为默认的命名空间传递给 `NodeManager`。

### 节点注册 ([`NodeManager.ts`](../../../../apps/backend/src/services/NodeManager.ts:1) 和 [`nodeRegistration.ts`](../../../../apps/backend/src/utils/nodeRegistration.ts:1))

*   加载到的每个 `NodeDefinition` 对象都会被传递给 `nodeManager.registerNode(node: NodeDefinition, filePath?: string)` 方法。
*   **命名空间确定**：
    *   `NodeManager` 会为每个节点确定一个最终的命名空间 (`node.namespace`)。
    *   优先级如下：
        1.  节点定义中显式设置的 `namespace` 字段。
        2.  如果节点由插件加载，则使用插件的名称作为命名空间。
        3.  如果节点定义中没有 `namespace`，并且是通过 `createNodeRegisterer` (来自 [`nodeRegistration.ts`](../../../../apps/backend/src/utils/nodeRegistration.ts:9)) 注册的，则使用注册器提供的默认命名空间。
        4.  如果以上都没有，`NodeManager` 会尝试根据节点文件的路径相对于 `apps/backend/src/nodes/` 的位置来推断命名空间（当前简化为所有子目录都推断为 `"core"`，未知结构为 `"unknown"`）。
*   **存储**：`NodeManager` 内部使用一个 `Map` (`this.nodes`) 来存储节点定义，键是节点的完整类型（`fullType = "namespace:type"`），值是 `NodeDefinition` 对象。
*   `nodeManager` 是一个单例实例，全局可用。

### 节点管理 ([`NodeManager.ts`](../../../../apps/backend/src/services/NodeManager.ts:1))

*   `getDefinitions(): NodeDefinition[]`：返回所有已注册节点定义的数组。
*   `getNode(fullType: string): NodeDefinition | undefined`：根据完整的类型字符串（"namespace:type"）获取特定的节点定义。
*   `clearNodes()`：清空所有已注册的节点，主要用于测试或热重载场景。

## 5. 节点执行流程（高级概述）

当一个工作流被执行时，[`ExecutionEngine.ts`](../../../../apps/backend/src/ExecutionEngine.ts:1) 负责协调各个节点的执行。

1.  **拓扑排序**：引擎首先对工作流中的节点进行拓扑排序，以确定正确的执行顺序。
2.  **输入准备**：对于将要执行的每个节点，引擎会调用 `prepareNodeInputs(nodeId)` 方法。此方法会：
    *   从上游已执行节点的输出 (`this.nodeResults`) 中收集当前节点所需的输入数据。
    *   处理多输入连接的顺序。
    *   合并来自节点预设配置 (`node.inputs`) 的值。
    *   应用节点定义中指定的默认值 (`definition.inputs[key].config.default`)。
    *   检查必需输入是否都已提供，否则抛出错误。
3.  **节点执行**：引擎调用 `executeNode(nodeId, inputs)` 方法。
    *   设置节点状态为 `RUNNING` 并通过 WebSocket 发送 `NODE_EXECUTING` 消息。
    *   记录节点开始执行的日志。
    *   获取节点的 `definition`，并调用其 `execute` 方法，传入准备好的 `inputs` 和 `context` 对象。
    *   **处理 `bypassBehavior`**：如果节点被标记为 `bypassed: true`，则会调用 `handleBypassedNode` 方法，根据定义的 `bypassBehavior`（如 `"mute"` 或传递特定输入到输出）来生成伪输出，而不会实际执行节点的 `execute` 方法。
    *   **流式节点**：如果节点定义了流式输出 (`DataFlowType.STREAM`) 并且其 `execute` 方法返回一个 `AsyncGenerator`，引擎会通过 `startStreamNodeExecution` 方法特殊处理。
        *   创建一个 `BoundedBuffer` 来管理生成器产生的数据块。
        *   将生成器的数据通过 `Stream.Readable` 实例暴露给下游节点和事件总线（用于发送 `NODE_YIELD` 消息）。
        *   节点的最终批处理结果（如果生成器 `return` 了值）会通过一个 Promise (`batchDataPromise`) 提供。
        *   整个流的生命周期（包括数据拉取、消费者处理）会被封装在一个 `streamLifecyclePromise` 中，并添加到引擎的 `backgroundTasks` 数组中，以便在工作流结束前等待其完成。
    *   **批处理节点**：如果 `execute` 方法返回一个 `Promise`，引擎会 `await` 其结果。
4.  **结果处理与状态更新**：
    *   执行成功后，节点的结果存储在 `this.nodeResults[nodeId]` 中，状态更新为 `COMPLETE`。
    *   通过 WebSocket 发送 `NODE_COMPLETE` 消息，并记录节点完成日志。
    *   如果执行出错，状态更新为 `ERROR` (或 `INTERRUPTED` 如果是用户中断)，发送 `NODE_ERROR` 消息，并记录错误日志。下游节点通常会被标记为 `SKIPPED`。
5.  **接口输出处理**：工作流执行完所有节点后，`_processAndBroadcastFinalOutputs` 方法会处理定义在 `payload.outputInterfaceMappings` 中的工作流最终输出。
    *   对于流式接口输出，会启动 `_handleStreamInterfaceOutput` 来消费内部节点的流，并通过 WebSocket 发送 `WORKFLOW_INTERFACE_YIELD` 消息。
    *   对于批处理接口输出，会等待其 Promise 解析，然后将所有最终输出（包括流的占位符和批处理结果）通过 `NODE_COMPLETE` 消息（使用特殊节点 ID `__WORKFLOW_INTERFACE_OUTPUTS__`）发送。
6.  **等待后台任务**：引擎会等待所有后台任务（包括节点内部流和接口流的生命周期 Promise）全部完成后，才最终确定工作流的完成状态。

整个执行过程是事件驱动的，并通过 WebSocket 与前端通信，实时更新节点状态和数据。中断信号 (`interrupt()`) 可以终止正在进行的执行。