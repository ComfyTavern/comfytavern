# LLM 适配器与模型管理系统设计方案 (V2)

## 1. 目标

设计并实现一个灵活、可扩展的系统，用于在 ComfyTavern 工作流中调用不同提供商（包括官方 API、中转 API、本地模型服务等）的 LLM（及相关模型，如 Embedding），同时允许用户方便地管理模型、渠道（API 端点和凭证）以及模型能力。**Agent 的核心审议工作流是本系统的一个主要“用户”或“消费者”**，因此，核心目标是实现模型、能力、渠道和通信协议（适配器）的解耦，以高效支持 Agent 及其他工作流对 LLM 服务的调用需求。

## 2. 核心组件

系统主要由以下几个核心组件构成：

- **通用 LLM 请求节点 (`GenericLlmRequestNode`)**: 工作流中的统一入口。它允许用户**直接指定要使用的模型 ID**，这是最高优先级的选择。同时，它也支持通过声明所需**能力**和偏好，让系统自动路由到合适的模型。这种基于能力的路由主要用于**辅助筛选和自动化场景**，但用户始终保留最终控制权。当此节点被用于 Agent 的核心审议工作流时，其声明的“能力”反映了 Agent 审议逻辑对 LLM 功能的需求。
- **LLM API 适配器 (`ILlmApiAdapter` & Implementations)**: 封装与特定 API 格式（如 OpenAI, Anthropic, Gemini, Ollama 等）的通信细节。接收**单一、具体的渠道配置和 API Key**。
- **适配器注册表 (`LlmApiAdapterRegistry`)**: 管理可用的适配器实例。
- **API 配置服务 (`ApiConfigService`)**: 管理用户配置的 **API 渠道 (`ApiCredentialConfig`)** 和 **渠道组 (`ApiChannelGroup`)**。
- **模型能力预设库 (`default_models.json`)**: 定义基于模型名称模式匹配的规则，用于预填充模型的能力、图标、分组等。
- **激活模型注册表 (SQLite DB)**: 存储用户明确选择并激活的模型及其最终确认的**能力 (`capabilities`)**。
- **激活模型服务 (`ActivatedModelService`)**: **新增服务**。专门负责对用户激活的模型列表（`ActivatedModelInfo`）进行数据库 CRUD 操作。
- **模型预设服务 (`ModelPresetService`)**: **新增服务**。负责加载和解析 `default_models.json`，并提供应用预设规则的能力。
- **模型/渠道路由服务 (`ModelRouterService`)**: **新增核心组件**。其核心职责是在运行时，接收一个 `model_id`，并根据系统配置的路由规则，返回最适合执行该模型的渠道组 ID (`channel_group_id`)。它将模型选择的“意图”与执行的“方式”解耦。
- **策略化执行器 (`RetryHandler`)**: **新增核心组件**。其核心职责是接收一个包含工作流载荷和顶层 `channel_group_id` 的请求。它将**解析**这个可能包含嵌套组的、带优先级和权重的路由策略树（建议逻辑上限制嵌套层级，例如仅允许一层），并根据解析结果执行请求、处理多 Key 选择、实现复杂的故障转移和负载均衡。
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
   * 数据库中的唯一 ID (UUID)。
   * 这是在系统内部引用渠道的唯一标识符。
   */
  id: string;

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
   * 当 api_key 是数组时，用于选择具体 Key 的策略。这是实现负载均衡和高可用的核心。
   * 'round-robin': 轮询 (默认)。简单公平。
   * 'random': 随机选择。简单，长期均衡。
   * 'least-used': 选择近期使用次数最少的 Key，实现更精确的负载均衡。
   * 'lowest-latency': (未来扩展) 选择近期平均响应延迟最低的 Key，追求极致性能。
   * 'scoring': (未来扩展) 终极策略，根据一个可配置的评分模型选择 Key。
   * @default 'round-robin'
   */
  key_selection_strategy?: "round-robin" | "random" | "least-used" | "lowest-latency" | "scoring";

  /**
   * 可选，当 `key_selection_strategy` 为 'scoring' 时，定义评分权重。
   * 这允许用户根据自己的偏好（成本、速度、配额）来定制 Key 的选择行为。
   */
  scoring_config?: {
    usage_weight?: number;     // 使用频率权重 (越少越好)
    latency_weight?: number;  // 延迟权重 (越低越好)
    quota_weight?: number;    // 剩余配额权重 (越多越好)
    // 未来可扩展其他成本或优先级相关的权重
  };

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

### 3.4. `ApiChannelGroup` (渠道组，定义可嵌套的路由策略)

```typescript
/**
 * 定义一个渠道组，它是一个“策略容器”。虽然数据结构上支持递归嵌套，但在实践中建议限制嵌套层级（例如，仅允许一层组嵌套或完全不允许），以避免前端展示和用户理解的复杂性。
 */
export interface ApiChannelGroup {
  id: string; // UUID
  group_name: string;
  description?: string;
  /**
   * 组的成员列表，定义了复杂的路由和故障转移逻辑。
   */
  members: ChannelGroupMember[];
  disabled?: boolean;
}

/**
 * 定义渠道组成员的结构和路由规则。
 */
export interface ChannelGroupMember {
  /**
   * 成员的唯一 ID，可以是渠道的 ID 或另一个渠道组的 ID。
   */
  id: string;
  /**
   * 成员的类型。
   */
  type: 'channel' | 'group';
  /**
   * 优先级，用于故障转移。数字越大，优先级越高。
   * 执行器会先尝试高优先级的成员。
   */
  priority: number;
  /**
   * 权重，用于在同一优先级的成员中进行负载均衡。
   * 权重越大的成员被选中的概率越高。
   */
  weight: number;
}
```

### 3.5. `ModelGroup` (用户自定义模型组)

```typescript
/**
 * 定义一个用户自定义的模型组，用于将特定模型聚合在一起，并定义选择策略。
 * 用户可以创建如 "快速响应"、"高智能"、"多模态" 等模型组。
 */
export interface ModelGroup {
  /**
   * 用户定义的组名，必须全局唯一。
   * 例如: "fast-response-group", "smart-group", "multimodal-group"
   */
  group_name: string;

  /**
   * 包含的模型 ID (ActivatedModelInfo.model_id) 的**有序或无序列表**。
   */
  model_ids: string[];

  /**
   * 当从此组中选择模型时的策略。
   * 'priority-order': 严格按照 `model_ids` 列表的顺序选择第一个可用的模型。
   * 'random': 随机选择一个模型。
   * 'round-robin': (未来扩展) 轮询选择。
   * @default 'priority-order'
   */
  selection_strategy?: "priority-order" | "random" | "round-robin";

  /**
   * 可选，对此模型组的描述，方便用户理解其用途。
   */
  description?: string;

  /**
   * 可选，是否禁用此模型组。
   * @default false
   */
  disabled?: boolean;
}
```

### 3.6. `ModelPresetRule` (能力预设库 `default_models.json`)

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

### 3.7. `ActivatedModelInfo` (激活模型注册表 SQLite DB)

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

### 3.8. 用户偏好/路由规则 (概念定义)

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

### 4.1. 模型管理流程 (重构后)

1.  **启动加载:**
    *   `ModelPresetService` 在应用启动时加载并解析 `default_models.json` 中的预设规则。
    *   `ActivatedModelService` 准备好对数据库进行操作。

2.  **模型发现与激活流程**:
    这是一个核心的用户交互流程，旨在将模型从外部渠道引入系统，并由用户确认激活。

    ```mermaid
    sequenceDiagram
        participant U as 用户
        participant FE as 前端 UI (设置页面)
        participant BE as 后端 API
        participant DB as 数据库

        U->>FE: 1. 在“API 渠道”页, 点击渠道 A 的“发现模型”
        FE->>BE: 2. POST /api/llm/channels/{id}/discover-models
        BE->>BE: 3. 调用适配器, 从远程获取模型列表
        BE->>DB: 4. 查询已激活模型, 用于状态标记
        DB-->>BE:
        BE-->>FE: 5. 返回发现的模型列表 (含激活状态)

        FE-->>U: 6. 弹窗展示待添加模型
        U->>FE: 7. 选择模型 'model-x' 并点击“添加”
        FE->>BE: 8. POST /api/llm/models (body: ActivatedModelInfo)
        BE->>DB: 9. INSERT INTO activated_models
        DB-->>BE: 成功
        BE-->>FE: 成功
        FE-->>U: 10. 提示成功, 更新UI
    ```

3.  **流程详解**:
    a. **触发**: 用户在前端的“API 渠道”管理界面，为某个已配置的渠道点击“发现模型”按钮。
    b. **API 调用**: 前端向后端发起 `POST /api/llm/channels/:channelId/discover-models` 请求。
    c. **后端协调处理**:
        i.  **获取配置与适配器**: 根据 `channelId` 获取渠道配置和对应的 `LlmApiAdapter`。
        ii. **远程发现**: 调用 `adapter.listModels()` 从外部服务获取原始模型列表。
        iii. **信息增强与比对**:
            - (可选) 调用 `ModelPresetService` 为发现的模型应用预设规则（填充能力、图标等）。
            - 调用 `ActivatedModelService` 获取所有已激活模型的列表，用于在返回结果中标记每个模型的激活状态。
        iv. **返回结果**: 后端将整合后的模型列表（包含模型ID、预设信息、是否已激活等）返回给前端。
    d. **前端展示与用户激活**:
        i.  前端在一个模态框中展示待添加的模型列表，并清晰地显示其激活状态。
        ii. 用户选择一个或多个未激活的模型，点击“添加”或“激活”按钮。
        iii. 前端发起 `POST /api/llm/models` 请求，请求体中包含要激活的模型的完整 `ActivatedModelInfo`。
    e. **后端保存**: `ActivatedModelService` 接收到请求，将新的模型信息存入 `activated_models` 数据库表中。

4.  **用户编辑/删除模型:**
    *   通过对应的 API Endpoint (`PUT`, `DELETE`) 调用 `ActivatedModelService` 中的方法，直接对数据库中的 `ActivatedModelInfo` 进行操作。

### 4.2. 工作流执行流程 (运行时 - V5 架构)

V5 架构的核心在于通过清晰的逻辑分层，实现从“模型意图”到“渠道策略”再到“可靠执行”的完整解耦。执行流程遵循一个两阶段路由模式：

**阶段 0: 模型确定 (路由前)**

此阶段在调用路由服务之前完成，由工作流的设计者或更上层的应用（如 Agent）负责。

- **职责**: 确定一个明确的、将要被执行的 **`model_id`**。
- **输入**: `GenericLlmRequestNode` 节点的配置，或由 Agent 审议逻辑动态提供。
- **输出**: 一个具体的 `model_id` 字符串，作为下一阶段的输入。

**阶段 1: 策略路由 (`ModelRouterService`)**

- **职责**: 将一个明确的 `model_id` 映射到一套**执行策略**，即一个**渠道组 (`channel_group_id`)**。它回答了“用哪一套方案去执行”的问题，而非“用哪一个渠道”。
- **调用**: `ExecutionEngine` 调用 `modelRouterService.findGroupForModel(model_id)`。
- **输出**: 一个 `channel_group_id`。

- **阶段 2: 策略执行 (`RetryHandler`)**

- **职责**: 接收顶层 `channel_group_id` 和请求负载，并根据该组定义的、可能包含嵌套（建议限制层级）的、带优先级和权重的复杂路由策略，可靠地完成执行。它内置了递归解析、故障转移和负载均衡的完整逻辑。
- **调用**: `ExecutionEngine` 调用 `retryHandler.executeWithStrategy(payload, channel_group_id)`。
- **输出**: 最终的 `StandardResponse`。

---

**详细服务协调流程:**

`ExecutionEngine` 在执行 `GenericLlmRequestNode` 时，会按上述分层协调以下服务：

    ```mermaid
    sequenceDiagram
        participant Engine as ExecutionEngine
        participant Node as GenericLlmRequestNode
        participant Router as ModelRouterService
        participant Retryer as RetryHandler
        participant Config as ApiConfigService
        participant Registry as LlmApiAdapterRegistry
        participant LLM_API as 外部 LLM API

        Engine->>Node: 执行节点 (已确定 model_id)
        
        Node->>Router: 1. [策略路由] findGroupForModel(model_id)
        Router->>Config: 查询路由规则
        Config-->>Router:
        Router-->>Node: 返回 channel_group_id

        Node->>Retryer: 2. [策略执行] executeWithStrategy(payload, channel_group_id)
        Retryer->>Config: 获取渠道组和渠道列表
        Config-->>Retryer:
        
        loop 遍历渠道组中的渠道
            Retryer->>Retryer: 选择 API Key
            Retryer->>Registry: 获取适配器实例
            Registry-->>Retryer:
            Retryer->>LLM_API: adapter.request(...)
            alt 请求成功
                LLM_API-->>Retryer: 成功响应
                Retryer-->>Node: 返回 StandardResponse
                break
            else 请求失败 (可重试)
                LLM_API-->>Retryer: 失败响应
                Note right of Retryer: 记录失败, 继续下一个渠道
            end
        end
        
        Note right of Retryer: 所有渠道失败
        Retryer-->>Node: 9. 返回带 error 的 StandardResponse
    ```

3.  **流程详解:**
    a. **节点执行**: `GenericLlmRequestNode` 被执行，它拿到核心输入 `model_id`。
    b. **路由决策 (`ModelRouterService`)**:
        i. 节点调用 `context.ModelRouterService.findGroupForModel(model_id)`。
        ii. `ModelRouterService` 内部根据预设的路由规则（例如，一个从 `model_id` 到 `channel_group_id` 的映射表），找到最适合执行该模型的渠道组 ID。
        iii. 如果没有找到特定规则，它可能会回退到一个全局默认的渠道组。
        iv. `ModelRouterService` 返回一个 `channel_group_id`。
    c. **执行与故障转移 (`RetryHandler`)**:
        i. 节点拿到 `channel_group_id` 后，调用 `context.RetryHandler.executeWithFailover(payload, channel_group_id)`，其中 `payload` 包含了 `messages`, `parameters`, `model_id` 等所有需要的信息。
        ii. `RetryHandler` 从 `ApiConfigService` 获取该渠道组的详细信息，特别是其**有序的渠道列表**。
        iii. `RetryHandler` 开始**遍历**这个有序列表：
            - 对于列表中的第一个渠道，它获取其凭证配置 (`ApiCredentialConfig`)。
            - **选择 Key (策略化)**: 如果该渠道有多个 API Key，`RetryHandler` 会根据 `key_selection_strategy` 字段，实例化一个对应的 **Key 选择策略** (例如 `RoundRobinStrategy`, `LeastUsedStrategy` 等)。然后调用该策略的 `selectKey()` 方法来获取一个具体的 API Key。这一步将决策逻辑与执行完全解耦。
            - 它获取对应的 `LlmApiAdapter` 实例。
            - 它调用 `adapter.request()`，将所有必要信息（包括选定的模型、Key、URL等）传递给适配器，发起请求。
        iv. **结果处理**:
            - **成功**: 如果请求成功，`RetryHandler` 立刻将成功的 `StandardResponse` 返回，整个流程结束。
            - **失败 (可重试)**: 如果请求失败，且错误码是可重试的（根据渠道配置或全局配置判断），`RetryHandler` 会继续循环，尝试列表中的**下一个渠道**。
            - **失败 (不可重试或所有渠道已试完)**: 如果遇到不可重试的错误，或者所有渠道都尝试失败了，`RetryHandler` 将返回最后一个失败的、包含详细错误信息的 `StandardResponse`。
    d. **节点输出**: `GenericLlmRequestNode` 将从 `RetryHandler` 收到的最终 `StandardResponse` 作为自己的输出。

## 5. 服务接口概要

### 5.1. `IApiConfigService`

```typescript
interface IApiConfigService {
  // 管理 API 渠道凭证
  getCredentialsById(id: string): Promise<ApiCredentialConfig | null>;
  getAllCredentials(userId: string): Promise<ApiCredentialConfig[]>;
  saveCredentials(config: ApiCredentialConfig): Promise<ApiCredentialConfig>;
  deleteCredentials(id: string): Promise<void>;

  // 管理渠道组 (故障转移策略)
  getAvailableChannelGroupRefs(): Promise<string[]>;
  getChannelGroup(groupName: string): Promise<ApiChannelGroup | null>;
  getAllChannelGroups(): Promise<ApiChannelGroup[]>;
  saveChannelGroup(group: ApiChannelGroup): Promise<void>;
  deleteChannelGroup(groupName: string): Promise<void>;
}
```

### 5.2. `IActivatedModelService`

```typescript
interface IActivatedModelService {
  /**
   * 查询激活的模型，支持按能力和用户过滤。
   * 这是 ModelRouterService 选择模型的基础。
   */
  getActivatedModels(filter: {
    userId: string;
    capabilities?: string[]; // 查找包含所有这些能力的模型
    type?: string;
  }): Promise<ActivatedModelInfo[]>;

  getActivatedModel(modelId: string, userId: string): Promise<ActivatedModelInfo | null>;

  // 管理激活的模型 (增删改)，始终需要 userId
  addActivatedModel(modelInfo: ActivatedModelInfo, userId: string): Promise<void>;
  updateActivatedModel(modelInfo: ActivatedModelInfo, userId: string): Promise<void>;
  deleteActivatedModel(modelId: string, userId: string): Promise<void>;
}
```

### 5.3. `IModelPresetService`

```typescript
interface IModelPresetService {
  /**
   * 加载并解析预设规则。
   */
  loadPresetRules(): Promise<void>;

  /**
   * 将预设规则应用于给定的模型ID列表。
   * @param modelIds 从适配器获取的原始模型ID列表。
   * @returns 丰富了预设信息（能力、图标、分组等）的模型信息列表。
   */
  applyPresets(modelIds: string[]): Promise<Array<Partial<ActivatedModelInfo> & { model_id: string }>>;
}
```

### 5.4. `ILlmApiAdapter`

```typescript
interface ILlmApiAdapter {
  /**
   * 从该适配器对应的外部服务发现可用的模型列表。
   * @param credentials 包含 base_url, api_key 等认证信息。
   * @returns 返回一个只包含模型基础信息的列表。
   */
  listModels(credentials: {
    base_url: string;
    api_key?: string;
    custom_headers?: Record<string, string>;
  }): Promise<Array<{ id: string; [key: string]: any }>>;

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
    - **核心调用方式:** 节点内必须支持直接指定 `model_id: string` (通过下拉列表选择已激活模型)。这是 MVP 的主要调用方式。
    - **辅助路由:** 同时，节点可以接受 `required_capabilities: string[]` 输入。如果 `model_id` 未被指定，则触发一个非常简单的全局默认查找（例如，查找第一个满足能力的模型，并使用其关联的默认渠道或一个全局默认渠道）。
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

5.  **`ActivatedModelService` (基础版):**

    - 专门管理 `ActivatedModelInfo` (激活模型信息) 的数据库 CRUD。
    - 提供基础的 `get`, `add`, `update`, `delete` 方法，所有操作都与 `userId` 关联。
    - **不包含:** 模型发现逻辑、预设应用逻辑。

6.  **模型发现流程 (MVP 实现):**

    - **移除** `ModelRegistryService` 中的发现逻辑。
    - 在 `llmConfigRoutes.ts` 中创建一个新的 API Endpoint: `POST /api/llm/channels/:channelRef/discover-models`。
    - 该 Endpoint 的处理器将：
        1.  获取渠道配置 (`ApiConfigService`)。
        2.  获取 `OpenAIAdapter` 实例 (`LlmApiAdapterRegistry`)。
        3.  调用 `adapter.listModels()` 获取模型列表。
        4.  将原始模型列表直接返回给前端。
    - 前端 UI 负责展示列表，用户选择后，调用 `ActivatedModelService` 的 API 来手动添加模型信息（包括手动输入能力）。

7.  **`ModelRouterService` (极简版):**

    - 如果节点不直接指定模型/渠道，则此服务被调用。
    - 接收 `required_capabilities`。
    - 从 `ActivatedModelService` 查询第一个满足所有能力的 `ActivatedModelInfo`。
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

### Phase 1: 核心增强与健壮性 (V5 实施计划)

**目标:** 实现 V5 架构的核心，构建一个高可用、可路由、支持多样化模型的基础服务层，以支撑 Agent 等上层应用的稳定运行。

**包含组件与功能 (按实施步骤):**

1.  **第一步：数据与服务层升级 (为高可用性奠基)**
    - **数据结构**:
        - 在数据库 (`db/schema.ts`) 和类型定义 (`packages/types/src/schemas.ts`) 中，创建 `ApiChannelGroup`。
        - 修改 `ApiCredentialConfig`，使其 `apiKey` 字段支持 `string | string[]`。
    - **服务层 (`ApiConfigService`)**:
        - 实现对 `ApiChannelGroup` 的完整 CRUD 方法。
        - 在 `saveCredentials` 方法中，实现当 `apiKey` 为数组时，自动创建关联的隐式渠道组的逻辑。
    - **UI**: 提供基础的渠道组管理界面。

2.  **第二步：创建 `RetryHandler` (打造“不死心脏”)**
    - **服务层 (`RetryHandler.ts`)**:
        - 创建新的 `RetryHandler.ts` 服务文件。
        - 实现核心方法 `executeWithFailover(payload, channel_group_id)`。
        - 该方法内部逻辑包含：获取渠道组的有序渠道列表 -> 遍历渠道 -> 根据策略选择 Key -> 调用适配器 -> 在失败且可重试时尝试下一个渠道。
    - **集成**: 暂时可以在 `GenericLlmRequestNode` 中直接调用此服务进行测试。

3.  **第三步：逻辑重构与解耦 (连接新组件)**
    - **服务层 (`ModelRouterService.ts`)**:
        - 创建新的 `ModelRouterService.ts` 服务文件。
        - 将当前在 `GenericLlmRequestNode` 中的简单路由逻辑迁移到 `ModelRouterService` 中，并增强其功能，使其能够根据 `model_id` 查找并返回一个 `channel_group_id`。
    - **节点重构 (`GenericLlmRequestNode.ts`)**:
        - 移除节点内部所有关于查找渠道、调用适配器的逻辑。
        - 其新职责简化为：**调用 `ModelRouterService` 获取 `channel_group_id` -> 调用 `RetryHandler` 并传入 `channel_group_id` 来执行请求 -> 处理最终返回结果。**

---

### Phase 2: 高级功能与用户体验

**目标:** 提供更精细的控制、更智能的路由、对高级 LLM 特性的支持以及更好的管理界面。

**包含组件与功能:**

1.  **高级路由规则引擎:**

    - 实现更复杂的、基于优先级的条件规则引擎（如 Phase 0 思考中细化的规则示例）。
    - 支持更多条件：`preferred_model_tags`, `performance_preference`, 节点标签等。
    - 提供用户界面来配置和管理这些路由规则。

- **Tool Calling / Function Calling 支持:**

  - 标准化 `CustomMessage` 中的 `tool_calls` 和 `tool` 角色。
  - 适配器支持序列化 `tools` 参数和解析 `tool_calls` 响应。
  - `GenericLlmRequestNode` 在处理 `tool_calls` 响应时，会将工具调用请求作为结构化数据输出。外部的执行协调器（如 `AgentRuntime`）捕获此输出，执行相应的工具，并将工具执行结果作为上下文，启动新一轮的工作流。
  - 可能需要引入 `ToolExecutorNode` 或类似机制，由外部协调器调用，来执行工具并返回结果。
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

---

## 附录：与 `new-api` 项目渠道管理模块的对比分析

在制定本方案时，我们参考了一份外部项目（`new-api`）的渠道管理模块分析报告。经过详细对比，我们得出以下结论：

本 V2 方案在**核心架构**（如故障转移、模型与渠道解耦、基于能力的智能路由）的深度和广度上，已全面超越 `new-api` 方案。

然而，`new-api` 报告在一些具体的、**面向用户体验的辅助功能和 API 设计**上，提供了非常有价值的参考。我们建议将以下“闪光点”作为对本 V2 方案的补充和增强，并纳入未来的开发计划中：

1.  **明确的渠道测试功能**:
    -   **建议**: 在 `ApiConfigService` 中增加 `testCredential(refName: string)` 方法，并在前端提供专门的“测试连接”按钮，以便用户在配置渠道后能立即获得有效性反馈。

2.  **渠道余额查询功能**:
    -   **建议**: 在 `ApiCredentialConfig` 数据结构中增加 `balance: number` 和 `lastBalanceCheck: Date` 字段。提供一个服务方法 `updateBalance(refName)` 及对应的 API，方便用户直接在平台内监控预付费渠道的余额。

3.  **精细化的批量操作 API**:
    -   **建议**: 参考 `new-api` 的设计，为 `ApiConfigService` 和 `ModelRegistryService` 设计专门的批量操作 API（如批量删除、批量更新标签），以提升后台管理效率。

4.  **前端 UI/UX 增强**:
    -   **建议**: 在开发前端管理界面时，采纳报告中提到的“标签聚合模式”（按 tag 对渠道或模型进行分组展示）和“列自定义”（允许用户自定义表格列并保存偏好）等优秀设计，以优化用户操作体验。

通过吸收这些经过实践检验的优秀功能点，我们可以将一个架构强大、设计先进的系统，打造成一个用户真正爱用、好用的平台。
