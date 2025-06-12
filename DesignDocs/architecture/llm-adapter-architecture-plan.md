# LLM 适配器与模型管理系统设计方案 (V2)

## 1. 目标

设计并实现一个灵活、可扩展的系统，用于在 ComfyTavern 工作流中调用不同提供商（包括官方 API、中转 API、本地模型服务等）的 LLM（及相关模型，如 Embedding），同时允许用户方便地管理模型、渠道（API 端点和凭证）以及模型能力。**Agent 的核心审议工作流是本系统的一个主要“用户”或“消费者”**，因此，核心目标是实现模型、能力、渠道和通信协议（适配器）的解耦，以高效支持 Agent 及其他工作流对 LLM 服务的调用需求。

## 2. 核心组件

系统主要由以下几个核心组件构成：

- **通用 LLM 请求节点 (`GenericLlmRequestNode`)**: 工作流中的统一入口，负责声明所需**能力**和偏好，接收标准化输入/输出。**不再负责选择具体模型或渠道**。当此节点被用于 Agent 的核心审议工作流时，其声明的“能力”反映了 Agent 审议逻辑对 LLM 功能的需求。
- **LLM API 适配器 (`ILlmApiAdapter` & Implementations)**: 封装与特定 API 格式（如 OpenAI, Anthropic, Gemini, Ollama 等）的通信细节。接收**单一、具体的渠道配置和 API Key**。
- **适配器注册表 (`LlmApiAdapterRegistry`)**: 管理可用的适配器实例。
- **API 配置服务 (`ApiConfigService`)**: 管理用户配置的 **API 渠道 (`ApiCredentialConfig`)** 和 **渠道组 (`ApiChannelGroup`)**。
- **模型能力预设库 (`default_models.json`)**: 定义基于模型名称模式匹配的规则，用于预填充模型的能力、图标、分组等。
- **激活模型注册表 (SQLite DB)**: 存储用户明确选择并激活的模型及其最终确认的**能力 (`capabilities`)**。
- **模型注册服务 (`ModelRegistryService`)**: 统一管理模型信息，结合预设库和激活注册表，并支持从渠道动态发现模型。
- **模型/渠道路由服务 (`ModelRouterService`)**: **新增核心组件**。在运行时根据节点的**能力请求**（例如，来自 Agent 核心审议工作流中 `GenericLlmRequestNode` 的能力声明）和用户的**全局偏好/规则**，选择合适的**模型 (`model_id`)** 和**渠道组 (`channel_group_ref`)**。
- **重试与 Key 选择逻辑 (`RetryHandler` & `KeySelector`)**: **新增逻辑** (可内聚在 `ModelRouterService` 或 `ExecutionEngine` 中)。负责根据选定的渠道组执行**故障转移**，并根据渠道配置选择**具体的 API Key**。
- **Tokenization 服务 (`TokenizationService`)**: **新增核心服务**。负责提供全局的 `token` 计算能力。详见 [全局 Tokenization 服务设计方案](./tokenization-service-plan.md)。
- **用户偏好/路由规则存储 (DB/Config)**: **新增配置项**。存储用户定义的模型和渠道组选择规则。
- **执行上下文 (`context`)**: 在工作流执行期间，由 `ExecutionEngine` 注入，包含对上述服务的引用。

## 3. 数据结构定义

### 3.1. `CustomMessage` (节点输入/输出)

```typescript
// 定义内容块的类型 (对应 CustomContentPart)
type TextContentPart = {
  type: "text";
  text: string;
};

type ImageContentPart = {
  type: "image_url";
  image_url: {
    /**
     * 图片的 URL。
     * 可以是 data URI (e.g., "data:image/jpeg;base64,...")
     * 或指向后端可访问的临时文件/资源的 URL (e.g., "/view?filename=temp_image.jpg&type=temp")
     * 适配器需要根据 URL 类型决定是直接传递还是下载并编码。
     */
    url: string;
    // detail 字段在 CustomContentPart 中不存在，已移除
  };
};

// 定义支持的内容块联合类型 (对应 CustomContentPart)
type CustomContentPart = TextContentPart | ImageContentPart;

// 消息接口 (对应 CustomMessage)
export interface CustomMessage {
  /**
   * 消息发送者的角色。
   * 'system': 系统指令，通常在开头。
   * 'user': 用户输入。
   * 'assistant': LLM 的回复。
   * 'tool': (可选，为未来工具使用预留) 工具调用的结果。
   */
  role: "system" | "user" | "assistant" | "tool";
  /**
   * 消息内容。可以是单个文本字符串（为了向后兼容或简单场景），
   * 也可以是包含文本和图像的内容部分数组（用于多模态）。
   * 适配器需要处理这两种情况。
   */
  content: string | CustomContentPart[];

  /**
   * 可选，消息的名称或标识符。 (CustomMessage 中无此字段)
   * 对于 role='tool'，这可能是工具调用的名称。
   * 对于 role='assistant' 且包含工具调用时，也可能用到。
   */
  // name?: string; // CustomMessage 中无此字段

  /**
   * 可选，当 role='tool' 时，关联的工具调用 ID。 (CustomMessage 中无此字段)
   */
  // tool_call_id?: string; // CustomMessage 中无此字段

  /**
   * 可选，当 role='assistant' 时，发起的工具调用请求。 (CustomMessage 中无此字段)
   * (为未来支持 Function Calling / Tool Use 预留)
   */
  // tool_calls?: Array<{ // CustomMessage 中无此字段
  //   id: string;
  //   type: "function"; // 目前只支持 function
    function: {
      name: string;
      arguments: string; // 通常是 JSON 字符串
    };
  // }>;
}
```

*注意: 上述 `CustomMessage` 定义基于 `@comfytavern/types` 中的实际导出，省略了 `name`, `tool_call_id`, `tool_calls` 字段。*

### 3.2. `StandardResponse` (适配器返回/节点输出)

```typescript
export interface StandardResponse {
  /**
   * LLM 返回的主要文本内容。
   * 如果有多个选择 (choices)，这里通常是第一个选择的文本。
   */
  text: string;

  /**
   * 包含所有选择的详细信息（如果 API 提供）。
   * 这对于需要处理多个候选回复或详细停止原因的场景很有用。
   */
  choices?: Array<{
    index: number;
    message: CustomMessage; // 返回的消息使用 CustomMessage 格式
    finish_reason: string; // 例如 'stop', 'length', 'tool_calls', 'content_filter'
    // 可选：logprobs 等其他元数据
  }>;

  /**
   * Token 使用情况或其他计量信息。
   */
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    // 可以添加其他提供商特定的计量单位，如 Anthropic 的 input/output tokens
    [key: string]: any; // 允许其他自定义字段
  };

  /**
   * LLM 提供商返回的原始、未经修改的响应体。
   * 用于调试或访问标准响应未包含的特定信息。
   */
  raw_response?: any;

  /**
   * 如果请求过程中发生错误，包含错误信息。
   */
  error?: {
    code?: string | number;
    message: string;
    type?: string; // 例如 'authentication_error', 'invalid_request_error'
    details?: any; // 其他错误细节
  };

  /**
   * 生成响应所使用的模型名称 (由适配器填充)。
   */
  model: string; // 实际使用的模型 ID

  /**
   * 响应的唯一 ID (如果 API 提供)。
   */
  response_id?: string;
}
```

### 3.3. `ApiCredentialConfig` (单个 API 渠道配置)

```typescript
/**
 * 代表一个具体的 API 访问渠道配置。
 */
export interface ApiCredentialConfig {
  /**
   * 用户定义的引用名称，必须全局唯一。
   * 工作流节点和渠道组将通过此名称引用该配置。
   * 例如: "openai_official_key1", "my_azure_gpt4", "local_ollama"
   */
  ref_name: string;

  /**
   * API 端点地址。
   * 对于 OpenAI 兼容 API，通常是 '/v1' 的基路径。
   * 对于 Ollama，可能是 'http://localhost:11434'。
   */
  base_url: string;

  /**
   * API 密钥。
   * 可以是单个字符串，或包含多个密钥的字符串数组。
   */
  api_key?: string | string[]; // API Key 是可选的，例如本地模型可能不需要

  /**
   * 当 api_key 是数组时，用于选择具体 Key 的策略。
   * 'round-robin': 轮询。
   * 'random': 随机选择。
   * 'latency-based': (未来扩展) 基于延迟选择。
   * @default 'round-robin'
   */
  key_selection_strategy?: "round-robin" | "random" | "latency-based";

  /**
   * 可选，关联的逻辑提供商 ID (例如 "openai", "anthropic", "google", "ollama")。
   * 主要用于 UI 分组或辅助推断适配器类型。
   */
  provider_id?: string;

  /**
   * 可选，显式指定应使用的适配器类型 (例如 "openai", "anthropic", "gemini", "ollama")。
   * 如果未指定，系统将尝试根据 base_url 或 provider_id 推断。
   */
  adapter_type?: string;

  /**
   * 可选，用于向 API 请求添加额外的自定义 HTTP 头。
   * 例如: { "Helicone-Auth": "...", "X-My-Custom-Header": "value" }
   */
  custom_headers?: Record<string, string>;

  /**
   * 可选，用于动态发现此渠道支持的模型列表的端点路径（相对于 base_url）。
   * 例如: "/models" (OpenAI), "/api/tags" (Ollama)
   */
  model_list_endpoint?: string;

  /**
   * 可选，指定哪些 HTTP 状态码会触发尝试下一个渠道（如果此渠道在渠道组中）。
   * 如果未指定，可以使用全局默认值。
   * 例如: [429, 500, 503]
   */
  retry_on_codes?: number[];

  /**
   * 可选，用于 UI 显示的标签或备注。
   */
  label?: string;

  /**
   * 可选，是否禁用此渠道。
   * @default false
   */
  disabled?: boolean;
}
```

### 3.4. `ApiChannelGroup` (渠道组，定义故障转移策略)

```typescript
/**
 * 定义一个渠道组，代表一个有序的故障转移序列。
 */
export interface ApiChannelGroup {
  /**
   * 用户定义的组名，必须全局唯一。
   * 工作流节点将通过此名称引用该故障转移策略。
   * 例如: "default_gpt4_failover", "claude_haiku_fast"
   */
  group_name: string;

  /**
   * 包含的渠道引用名称 (ApiCredentialConfig.ref_name) 的**有序列表**。
   * 列表的顺序严格定义了故障转移的优先级。
   * index 0 是最高优先级，index 1 是次高，以此类推。
   * 必须至少包含一个 channel_ref。
   */
  ordered_channel_refs: string[];

  /**
   * 可选，对此渠道组的描述，方便用户理解其用途。
   */
  description?: string;

  /**
   * 可选，是否禁用此渠道组。
   * @default false
   */
  disabled?: boolean;
}
```

### 3.5. `ModelPresetRule` (能力预设库 `default_models.json`)

```typescript
export interface ModelPresetRule {
  pattern: string; // 用于匹配模型 ID 的 glob 或 regex 模式
  priority?: number; // 匹配优先级 (可选)
  group?: string; // 建议的分组名称
  icon?: string; // 建议的图标标识
  capabilities?: string[]; // 建议的能力标签 (e.g., "llm", "vision", "tool_calling", "embedding")
  type?: "llm" | "embedding" | "image_gen" | "audio"; // 建议的模型类型
  adapter_type_hint?: string; // 建议使用的适配器类型
}
```

### 3.6. `ActivatedModelInfo` (激活模型注册表 SQLite DB)

```typescript
export interface ActivatedModelInfo {
  model_id: string; // 全局唯一模型 ID (主键)
  display_name: string;
  group_name?: string;
  icon?: string;
  /**
   * 模型的核心能力列表 (通常是预设或标准化的)。
   * 这是模型路由服务进行能力匹配的关键依据。
   * 通过专门的 Tag 输入框进行管理，详见 [LLM 适配器 - Tag 输入框方案](./llm-adapter-tag-input-plan.md)。
   * 例如: ["llm", "chat"], ["llm", "vision"], ["embedding"]
   */
  capabilities: string[];
  model_type: "llm" | "embedding" | "image_gen" | "audio" | "unknown";
  /**
   * 可选: 建议或默认使用的渠道组引用名称 (ApiChannelGroup.group_name)。
   * 可被用户全局偏好/规则覆盖。
   */
  default_channel_group_ref?: string;
  /**
   * 可选: 用户定义的自定义标签，用于分组、筛选和偏好匹配。
   * 通过专门的 Tag 输入框进行管理，详见 [LLM 适配器 - Tag 输入框方案](./llm-adapter-tag-input-plan.md)。
   * 例如: ["fast-response", "low-cost", "high-quality", "my-project-x"]
   */
  tags?: string[];
  /**
   * 可选: 指定此模型应使用的分词器标识符。
   * 这通常是 Hugging Face Hub 上的模型/分词器名称 (e.g., "gpt2", "bert-base-uncased")。
   * TokenizationService 将使用此 ID 来加载正确的分词器。
   * 如果未提供，可以尝试根据 model_id 推断。
   */
  tokenizer_id?: string;
  // 可选: 其他用户自定义元数据
}
```

### 3.7. 用户偏好/路由规则 (概念定义)

这部分配置定义了系统如何在运行时根据节点请求选择模型和渠道组。具体实现方式待定，但可能包含：

- **基于能力的默认映射**:

```json
{
  "capability_map": {
    "['llm', 'chat']": { "default_model_id": "gpt-4o", "default_channel_group": "openai_failover" },
    "['llm', 'vision']": {
      "default_model_id": "gpt-4-vision-preview",
      "default_channel_group": "openai_failover"
    },
    "['embedding']": {
      "default_model_id": "text-embedding-ada-002",
      "default_channel_group": "openai_embedding_channel"
    }
  },
  "global_default": { "default_model_id": "...", "default_channel_group": "..." }
}
```

- **更复杂的规则引擎**: (未来扩展) 允许基于节点输入、用户标签、成本、延迟等因素进行更精细的选择。

## 4. 核心流程

### 4.1. 模型管理流程

1.  **启动加载:** `ModelRegistryService` 启动时加载 `default_models.json` 中的预设规则，并连接 SQLite DB 加载用户已激活的模型列表 (`ActivatedModelInfo`)。
2.  **发现模型:** 用户在渠道配置页面选择一个渠道 (`ApiCredentialConfig`)，点击“发现模型”。
3.  **后端处理发现:** `ModelRegistryService` 尝试调用该渠道的 `model_list_endpoint` (如果配置了)。获取到原始模型 ID 列表后，与预设规则匹配，生成带有建议能力、分组、图标的“待添加模型列表”。
4.  **前端展示:** 前端在一个模态框中展示这个“待添加模型列表”。
5.  **用户添加:** 用户点击“+”按钮，选择要激活的模型。
6.  **后端保存激活:** `ModelRegistryService` 将用户选择的模型信息（应用预设或用户微调后）保存到 SQLite DB (`ActivatedModelInfo`)。
7.  **用户编辑:** 用户可以随时编辑已激活模型的信息（名称、分组、能力等），更改直接保存到 SQLite DB。

### 4.2. 工作流执行流程 (运行时)

1.  **节点输入:** 用户在 `GenericLlmRequestNode` 上配置（或者当此节点在 Agent 的核心审议工作流中时，这些配置可能由 Agent Profile 或审议逻辑间接提供）：

- `required_capabilities: string[]`: 必须满足的能力列表 (e.g., `['llm', 'chat']`, `['llm', 'vision', 'planning']`)。通过 Tag 输入框配置，详见 [LLM 适配器 - Tag 输入框方案](./llm-adapter-tag-input-plan.md)。Agent Profile 中对 LLM 的需求也应能映射到这些能力标签上。
- `preferred_model_or_tags?: string[]`: (可选) 倾向于选择的模型 ID 或自定义标签。路由服务会优先匹配此处的模型 ID，其次使用标签进行偏好排序。通过 Tag 输入框配置，详见 [LLM 适配器 - Tag 输入框方案](./llm-adapter-tag-input-plan.md)。
- `performance_preference?: 'latency' | 'cost' | 'quality'`: (可选) 优化目标提示。
- `messages`: 输入的 `CustomMessage[]`。
- `parameters`: JSON 格式的 API 参数。

2.  **引擎调用:** `ExecutionEngine` 调用节点的 `execute` 方法，传入上述输入和包含各服务引用的 `context`。
3.  **路由与执行逻辑 (由 `ModelRouterService` 和 `RetryHandler` 协调):**
    a. **路由选择 (由 `ModelRouterService` 执行):**
    i. 接收节点的请求（能力、偏好、消息、参数）。当调用来自 Agent 的核心审议工作流时，这些请求反映了 Agent 当前决策周期对 LLM 的具体需求。
    ii. 从 `context.ModelRegistryService` 查询满足 `required_capabilities` 的**激活模型**。
    iii. (可选) 根据 `preferred_model_tags` 和 `performance_preference` 筛选/排序候选模型。
    iv. 根据用户的**全局偏好/路由规则** (从 `context` 获取)，从候选模型中确定最终的 `selected_model_id`。
    v. 同样根据用户偏好/规则（或模型的默认设置），确定要使用的 `selected_channel_group_ref`。
    b. **故障转移与 Key 选择 (由 `RetryHandler` 处理):**
    i. `RetryHandler` 从 `context.ApiConfigService` 获取 `selected_channel_group_ref` 对应的 `ApiChannelGroup` 配置 (包含 `ordered_channel_refs`)。
    ii. **按顺序迭代** `ordered_channel_refs` 列表中的每个 `channel_ref`： 1. 从 `context.ApiConfigService` 获取该 `channel_ref` 对应的 `ApiCredentialConfig`。 2. 使用 `KeySelector` (根据 `config.key_selection_strategy`) 从 `config.api_key` (如果是数组) 中选择一个 `selectedKey`。 3. 确定适配器类型 (`adapter_type`)：优先使用 `config.adapter_type`，否则尝试推断。 4. 从 `context.LlmApiAdapterRegistry` 获取适配器实例。 5. **调用适配器:** 调用 `adapter.request()` 方法，传入 `messages`, `parameters`, `selected_model_id` (由 Router 确定) 以及**具体的**认证信息 (`base_url`, `selectedKey`, `custom_headers`)。 6. **处理结果:** - 如果成功，`RetryHandler` 返回 `StandardResponse`，执行结束。 - 如果失败，检查错误码是否在 `config.retry_on_codes` (或全局默认) 中。 - 如果是可重试错误且列表中还有下一个渠道，则继续迭代。 - 如果是不可重试错误或所有渠道都已尝试失败，`RetryHandler` 返回包含 `error` 的 `StandardResponse`。
    c. **节点输出:** `ModelRouterService` (或 `ExecutionEngine`) 将 `RetryHandler` 返回的最终 `StandardResponse` 作为节点的输出。

## 5. 服务接口概要

### 5.1. `IApiConfigService`

```typescript
interface IApiConfigService {
  // 管理 API 渠道凭证
  getAvailableCredentialRefs(providerId?: string): Promise<string[]>;
  getCredentials(refName: string): Promise<ApiCredentialConfig | null>;
  getAllCredentials(): Promise<ApiCredentialConfig[]>;
  saveCredentials(config: ApiCredentialConfig): Promise<void>;
  deleteCredentials(refName: string): Promise<void>;

  // 管理渠道组 (故障转移策略)
  getAvailableChannelGroupRefs(): Promise<string[]>;
  getChannelGroup(groupName: string): Promise<ApiChannelGroup | null>;
  getAllChannelGroups(): Promise<ApiChannelGroup[]>;
  saveChannelGroup(group: ApiChannelGroup): Promise<void>;
  deleteChannelGroup(groupName: string): Promise<void>;
}
```

### 5.2. `IModelRegistryService`

```typescript
interface IModelRegistryService {
  /**
   * 查询激活的模型，支持按能力过滤。
   * 这是 ModelRouterService 选择模型的基础。
   */
  getActivatedModels(filter?: {
    capabilities?: string[]; // 查找包含所有这些能力的模型
    type?: string;
  }): Promise<ActivatedModelInfo[]>;

  getActivatedModel(modelId: string): Promise<ActivatedModelInfo | null>;

  // 管理激活的模型 (增删改)
  addActivatedModel(modelInfo: ActivatedModelInfo): Promise<void>;
  updateActivatedModel(modelInfo: ActivatedModelInfo): Promise<void>;
  deleteActivatedModel(modelId: string): Promise<void>;

  /**
   * 从指定渠道发现可用模型。
   * 返回模型列表及其建议的预设信息和是否已激活状态，供用户在 UI 上选择添加。
   */
  discoverModelsFromChannel(
    channelRef: string
  ): Promise<Array<Partial<ActivatedModelInfo> & { model_id: string; isActivated: boolean }>>;

  // 加载预设规则 (内部或启动时)
  loadPresetRules(): Promise<void>;
}
```

### 5.3. `ILlmApiAdapter`

```typescript
interface ILlmApiAdapter {
  /**
   * 发送请求到具体的 LLM API 端点。
   * @param payload 包含消息、参数、模型 ID 和**已选定的单个**凭证信息。
   * @returns 标准化响应，支持普通或流式。
   */
  request(payload: {
    messages: CustomMessage[];
    parameters: Record<string, any>;
    model_id: string; // 由 ModelRouterService 选定的模型 ID
    credentials: {
      // 由 RetryHandler & KeySelector 选定的具体渠道和 Key
      base_url: string;
      api_key?: string; // 单个 Key，可能是 undefined
      custom_headers?: Record<string, string>;
      // 其他可能需要的凭证字段
    };
    stream?: boolean; // 是否启用流式传输 (可选)
  }): Promise<StandardResponse | AsyncGenerator<StandardResponse>>;
}
```

## 6. 存储方案

- **模型能力预设:** `default_models.json` (随应用分发，Git 管理)。
- **激活模型注册表:** SQLite 数据库文件 (例如 `user_data/models.sqlite`)。
- **API 渠道配置:** 推荐存储在 SQLite 数据库中 (`user_data/credentials.sqlite` 或与模型库合并)，以便用户动态管理。同时支持从环境变量或全局配置文件加载默认/系统级渠道。API Key 在存储时应考虑安全措施（如文件权限，可选加密）。

## 7. 未来的考虑

- **流式响应 (`stream`)**: 需要在适配器和引擎中完整支持 `AsyncGenerator`。
- **Function Calling / Tool Use**: 需要标准化 `tool_calls` 和 `tool` 角色的消息处理流程。
- **模型/渠道选择规则**: 设计和实现用户友好的界面来配置复杂的路由规则。
- **`KeySelector` 策略**: 实现更多 Key 选择策略，如基于延迟 (`latency-based`)，并管理其状态。
- **`RetryHandler` 状态管理**: 实现更复杂的重试逻辑，如指数退避、记录渠道失败状态等。
- **适配器健壮性**: 在适配器层面增加对特定 API 错误码的处理和标准化。
- **参数映射**: 实现一个机制来处理通用参数到提供商特定参数的映射。
- **成本估算与控制**: 结合模型和渠道信息进行成本估算，并允许设置预算限制。
- **UI/UX**: 为模型管理、渠道配置、渠道组管理和路由规则提供清晰易用的用户界面。

## 8. 开发计划

### Phase 0: 最小可行产品 (MVP)

**目标:** 快速上线核心的 LLM 调用能力，支持最常见的 API 类型 (OpenAI 兼容)，允许用户手动配置渠道和激活模型，并通过节点使用基本能力进行调用。**重点在于打通核心流程，牺牲部分灵活性和健壮性。**

**包含组件与功能:**

1.  **`GenericLlmRequestNode` (基础版):**

    - 输入: `messages: CustomMessage[]` (支持 text 和 basic image_url), `required_capabilities: string[]` (例如 `['llm']` 或 `['llm', 'vision']`), `parameters: JSON` (透传基础参数如 `temperature`, `max_tokens`).
    - **简化路由:** 节点内直接指定 `activated_model_id: string` 和 `channel_ref: string` (通过下拉列表选择已配置项)，或者通过 `required_capabilities` 触发一个非常简单的全局默认查找（例如，第一个匹配能力的模型+第一个匹配的渠道）。
    - 输出: `response: StandardResponse` (包含 `text`, `model`, `usage`, `error` 基础字段)。
    - **不支持:** 复杂的路由规则、性能偏好、模型标签。

2.  **`ILlmApiAdapter` 接口 & `OpenAIAdapter` 实现:**

    - 定义标准适配器接口 (`request` 方法)。
    - 实现一个核心适配器，兼容 OpenAI API 格式 (支持 OpenAI, Azure OpenAI, Ollama OpenAI endpoint, LM Studio, LiteLLM 等)。
    - 处理 `CustomMessage` 到 OpenAI 格式的转换 (包括 text 和 base64 编码的 image_url)。
    - 处理 OpenAI 响应到 `StandardResponse` 的转换。
    - **不支持:** 流式响应, Tool Calling 参数。

3.  **`LlmApiAdapterRegistry` (基础版):**

    - 简单的注册表，用于注册和获取 `OpenAIAdapter` 实例。

4.  **`ApiConfigService` (基础版):**

    - 管理 `ApiCredentialConfig` (API 渠道配置)。
    - 提供基础的 CRUD 操作 (通过 API 或简单的 UI 界面)。
    - **仅支持单个 API Key (`api_key: string`)**，不支持 Key 数组或选择策略。
    - **不包含 `ApiChannelGroup` (渠道组)**。每个渠道独立配置和使用。
    - 存储: SQLite 数据库 (`credentials.sqlite`)，API Key 明文存储（强调安全风险，或仅支持从环境变量加载）。

5.  **`ModelRegistryService` (基础版):**

    - 管理 `ActivatedModelInfo` (激活模型信息)。
    - 提供基础的 CRUD 操作 (通过 API 或简单的 UI 界面)。
    - 用户需要 **手动添加模型 ID** 并为其指定 **核心能力** (`capabilities: string[]`, e.g., `['llm']`, `['llm', 'vision']`, `['embedding']`)。
    - **可选 (增强 MVP):** 实现基于 OpenAI 兼容 `/models` 端点的 **基础模型发现** 功能，辅助用户添加模型 ID。
    - **不包含:** `default_models.json` 预设库，复杂元数据 (tags, icons, groups)。
    - 存储: SQLite 数据库 (`models.sqlite`)。

6.  **`ModelRouterService` (极简版):**

    - 如果节点不直接指定模型/渠道，则此服务被调用。
    - 接收 `required_capabilities`。
    - 从 `ModelRegistryService` 查询第一个满足所有能力的 `ActivatedModelInfo`。
    - 从 `ApiConfigService` 查询第一个（或某个硬编码/全局配置的）可用的 `ApiCredentialConfig`。
    - 返回 `selected_model_id` 和 `selected_channel_ref` 给执行逻辑。
    - **不包含:** 复杂的规则匹配、偏好处理、渠道组选择。

7.  **执行逻辑 (基础版):**

    - 获取节点输入。
    - 调用（极简版）`ModelRouterService` 或使用节点直选的模型/渠道。
    - 获取适配器实例。
    - 调用 `adapter.request()` 并传入选定的模型、渠道凭证、消息和参数。
    - **不包含:** `RetryHandler` (无故障转移)，`KeySelector`。请求失败直接返回错误 `StandardResponse`。

8.  **核心数据结构:**
    - `CustomMessage` (支持 text, image_url)
    - `StandardResponse` (基础字段)
    - `ApiCredentialConfig` (简化版，单 Key)
    - `ActivatedModelInfo` (基础字段，手动能力)

**MVP 交付价值:** 用户可以在工作流中通过新节点调用 OpenAI 兼容的 LLM，可以配置不同的 API 端点和 Key，并手动管理希望使用的模型及其基本能力。实现了最基础的解耦。

---

### Phase 1: 核心增强与健壮性

**目标:** 增强系统的健壮性、灵活性和易用性，支持更多 API 类型和核心高级特性。

**包含组件与功能:**

1.  **故障转移与多 Key 支持:**

    - 实现 `ApiChannelGroup` 数据结构和 `ApiConfigService` 对其的 CRUD 管理。
    - 实现 `RetryHandler` 逻辑，处理渠道组内的有序故障转移 (基于 `retry_on_codes`)。
    - 增强 `ApiCredentialConfig` 支持 `api_key: string[]`。
    - 实现 `KeySelector` 逻辑 (至少支持 `round-robin` 策略)，集成到 `RetryHandler` 中。
    - `ModelRouterService` 升级为选择 `channel_group_ref`。
    - 节点 `GenericLlmRequestNode` 移除直选 `channel_ref`，改为依赖路由结果。

2.  **更多适配器:**

    - 实现 `AnthropicAdapter`。
    - 实现 `GoogleGeminiAdapter`。
    - 实现 `OllamaNativeAdapter` (使用 Ollama 的原生 API `/api/generate`, `/api/chat`)。
    - 增强 `LlmApiAdapterRegistry` 以管理多个适配器。
    - `ApiCredentialConfig` 增加 `adapter_type` 字段，允许显式指定或辅助推断。

3.  **模型预设与增强发现:**

    - 引入 `default_models.json` (包含 `ModelPresetRule`)。
    - `ModelRegistryService` 在启动时加载预设，并在模型发现/添加时应用预设（填充能力、类型、分组、图标等建议值）。
    - 增强模型发现能力，支持不同适配器（如果 API 支持）。

4.  **基础路由规则:**

    - 实现基于 `required_capabilities` 的简单映射规则 (如 3.7 示例)，存储在配置或数据库中。
    - `ModelRouterService` 使用这些规则来选择 `default_model_id` (如果节点未指定) 和 `default_channel_group_ref`。
    - `ActivatedModelInfo` 增加 `default_channel_group_ref` 字段作为备选。

5.  **流式响应 (`stream`) 支持:**

    - 修改 `ILlmApiAdapter` 接口，`request` 方法返回 `Promise<StandardResponse | AsyncGenerator<StandardResponse>>`。
    - 在 `OpenAIAdapter` 和其他适配器中实现流式响应逻辑 (返回 `AsyncGenerator`)。
    - `GenericLlmRequestNode` 需要能处理 `AsyncGenerator` 输出（例如，逐步累积文本，或提供流式输出端口）。
    - **明确流式失败行为:** 确认流中断时 `RetryHandler` 会重新发起完整请求到下一个渠道。

6.  **增强错误处理:**
    - 适配器负责将提供商错误映射到 `StandardResponse.error` 中的标准化 `type`。
    - `RetryHandler` 根据 `error.type` 和 `retry_on_codes` 做出更智能的重试决策。

---

### Phase 2: 高级功能与用户体验

**目标:** 提供更精细的控制、更智能的路由、对高级 LLM 特性的支持以及更好的管理界面。

**包含组件与功能:**

1.  **高级路由规则引擎:**

    - 实现更复杂的、基于优先级的条件规则引擎（如 Phase 0 思考中细化的规则示例）。
    - 支持更多条件：`preferred_model_tags`, `performance_preference`, 节点标签等。
    - 提供用户界面来配置和管理这些路由规则。

2.  **Tool Calling / Function Calling 支持:**

    - 标准化 `CustomMessage` 中的 `tool_calls` 和 `tool` 角色 (如果未来在 CustomMessage 中添加支持)。
    - 适配器支持序列化 `tools` 参数和解析 `tool_calls` 响应。
    - `GenericLlmRequestNode` 能够处理 `tool_calls` 响应，暂停执行或输出调用请求。
    - 可能需要引入 `ToolExecutorNode` 或类似机制来执行工具并返回结果。
    - 完善将工具结果注入回 LLM 请求的流程。

3.  **参数标准化与映射:**

    - 定义更广泛的标准参数集 (e.g., `top_p`, `stop_sequences`, `json_mode`)。
    - 适配器实现标准参数到提供商特定参数的映射。
    - 提供 `provider_specific_params: JSON` 透传机制。

4.  **UI/UX 全面改进:**

    - 实现专门的 Tag 输入组件用于管理模型能力和标签，以及配置节点请求。详见 [LLM 适配器 - Tag 输入框方案](./llm-adapter-tag-input-plan.md)。
    - 为模型管理、渠道配置、渠道组管理、路由规则提供专门的管理界面。
    - 更好的可视化、搜索、过滤功能。
    - 在节点上提供更友好的输入/输出预览。

5.  **`KeySelector` 策略扩展:**

    - 实现 `random`, `latency-based` (需要状态管理和探测机制) 等更多 Key 选择策略。

6.  **`RetryHandler` 增强:**

    - 实现指数退避、渠道熔断（临时禁用失败率高的渠道）等高级重试逻辑。

7.  **API Key 安全强化:**
    - 实现数据库内 API Key 加密存储。
    - 加强对环境变量和 Secrets Manager 的支持。

---

### Phase 3: 生态系统集成与优化

**目标:** 进一步提升系统效率、降低成本、融入更广泛的生态。

**包含组件与功能:**

1.  **成本估算与控制:**

    - 结合 `ActivatedModelInfo` (可能需要添加成本信息) 和 `StandardResponse.usage` 进行成本估算。
    - 允许设置基于 Token 或请求次数的预算限制（在渠道组或全局层面）。
    - 路由规则可以考虑成本因素。

2.  **性能优化:**

    - 缓存常用配置和服务实例。
    - 优化数据库查询。
    - 探索异步处理和连接池。

3.  **多模态与扩展模型类型:**

    - 如果 ComfyTavern 需要，正式支持 Image Generation, Audio Input/Output 等模型类型，定义相应能力和适配器。
    - 增强 `CustomMessage` 对复杂多模态内容的支持。

4.  **可观测性:**

    - 集成日志、指标 (Metrics) 和追踪 (Tracing)，方便监控系统状态和调试问题。

5.  **测试与验证:**
    - 建立更完善的单元测试、集成测试和端到端测试框架。
