import { z } from 'zod';
import { GroupSlotInfoSchema } from './node';
import type { ChunkPayload } from './common';

// --- Stream & Regex Schemas ---



/**
 * RegexRule 相关的类型和 Schema
 */
export interface RegexRule {
  name: string;
  pattern: string;
  replacement: string;
  flags?: string;
  description?: string;
  enabled?: boolean;
}

export const RegexRuleSchema = z.object({
  name: z.string().min(1, { message: "规则名称不能为空" }),
  pattern: z.string().min(1, { message: "正则表达式不能为空" }),
  replacement: z.string(),
  flags: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional().default(true),
});

export const RegexRuleArraySchema = z.array(RegexRuleSchema);


// --- Node & Action Schemas ---

/**
 * Schema 定义：节点输入操作按钮的配置
 */
export const NodeInputActionSchema = z.object({
  id: z.string(),
  icon: z.string().optional(),
  label: z.string().optional(),
  tooltip: z.string().optional(),
  handlerType: z.enum(['builtin_preview', 'builtin_editor', 'emit_event', 'client_script_hook', 'open_panel']),
  handlerArgs: z.record(z.any()).optional(),
});
export type NodeInputAction = z.infer<typeof NodeInputActionSchema>;

/**
 * Schema 定义：节点组的接口信息，包含输入和输出插槽。
 */
export const GroupInterfaceInfoSchema = z.object({
  inputs: z.record(z.lazy(() => GroupSlotInfoSchema)).optional(),
  outputs: z.record(z.lazy(() => GroupSlotInfoSchema)).optional()
});
export type GroupInterfaceInfo = z.infer<typeof GroupInterfaceInfoSchema>;


// --- Project & Execution Schemas ---

/**
 * Schema 定义：在 project.json 中声明的面板。
 */
export const PanelDeclarationSchema = z.object({
  id: z.string().describe("面板的唯一标识符"),
  path: z.string().describe("指向面板定义文件的逻辑路径 (例如: ui/my_chat_panel/panel.json)"),
});
export type PanelDeclaration = z.infer<typeof PanelDeclarationSchema>;

/**
 /**
  * Schema 定义：完整的面板定义。
  */
/**
 * Schema 定义: 单个面板工作流绑定的具体配置
 */
export const PanelWorkflowBindingSchema = z.object({
  alias: z.string().describe("调用别名，面板通过此别名调用工作流"),
  workflowId: z.string().describe("绑定的工作流ID"),
  description: z.string().optional().describe("此绑定的功能描述"),
  notes: z.string().optional().describe("开发者的备注"),
});
export type PanelWorkflowBinding = z.infer<typeof PanelWorkflowBindingSchema>;

export const PanelDefinitionSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  version: z.string(),
  uiEntryPoint: z.string().describe("面板 UI 的入口文件 (例如: index.html)"),
  workflowBindings: z.array(PanelWorkflowBindingSchema).optional().describe("面板与其可调用的工作流之间的绑定关系"),
  panelDirectory: z.string().optional().describe("面板所在的目录名，由后端动态填充"),
  apiSpec: z.string().optional().describe("指向面板 API 规范文件的路径"),
  requiredWorkflows: z.array(z.string()).optional().describe("【旧版，待废弃】面板运行所需的 workflow ID 列表"),
  icon: z.string().optional(),
  customMetadata: z.record(z.any()).optional(),
});
export type PanelDefinition = z.infer<typeof PanelDefinitionSchema>;

/**
 * Schema 定义：项目元数据。
 */
export const ProjectMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  templateUsed: z.string().optional(),
  preferredView: z.enum(["editor", "custom"]).optional().default("editor"),
  schemaVersion: z.string(),
  panels: z.array(PanelDeclarationSchema).optional().describe("项目包含的应用面板声明列表"),
  customMetadata: z.record(z.any()).optional()
});
export type ProjectMetadata = z.infer<typeof ProjectMetadataSchema>;

/**
 * Schema 定义：用于执行引擎的简化节点结构。
 */
export const ExecutionNodeSchema = z.object({
  id: z.string(),
  fullType: z.string(),
  inputs: z.record(z.any()).optional(),
  configValues: z.record(z.any()).optional(),
  bypassed: z.boolean().optional(),
  inputConnectionOrders: z.record(z.array(z.string())).optional(),
});
export type ExecutionNode = z.infer<typeof ExecutionNodeSchema>;

/**
 * Schema 定义：用于执行引擎的简化边结构。
 */
export const ExecutionEdgeSchema = z.object({
  id: z.string().optional(),
  sourceNodeId: z.string(),
  sourceHandle: z.string(),
  targetNodeId: z.string(),
  targetHandle: z.string(),
});
export type ExecutionEdge = z.infer<typeof ExecutionEdgeSchema>;

/**
 * Schema 定义：发送到后端以启动工作流执行的有效负载 (payload)。
 */
export const WorkflowExecutionPayloadSchema = z.object({
  workflowId: z.string().optional(),
  nodes: z.array(ExecutionNodeSchema),
  edges: z.array(ExecutionEdgeSchema),
  interfaceInputs: z.record(GroupSlotInfoSchema).optional(),
  interfaceOutputs: z.record(GroupSlotInfoSchema).optional(),
  outputInterfaceMappings: z.record(z.object({ sourceNodeId: z.string(), sourceSlotKey: z.string() })).optional(),
});
// 注意: WorkflowExecutionPayload 类型定义在 execution.ts 中，以避免循环依赖。

// --- File Asset Management (FAM) Schemas ---

/**
 * Schema 定义：文件资产管理系统中的单个项目（文件或目录）。
 */
export const FAMItemSchema = z.object({
  id: z.string().min(1, { message: "ID 不能为空" }), // 通常等于 logicalPath
  name: z.string().min(1, { message: "名称不能为空" }),
  logicalPath: z.string().min(1, { message: "逻辑路径不能为空" }),
  itemType: z.enum(['file', 'directory'], { message: "项目类型必须是 'file' 或 'directory'" }),
  size: z.number().nonnegative({ message: "大小不能为负" }).nullable().optional(),
  lastModified: z.number().int({ message: "最后修改时间必须是整数时间戳" }).nullable().optional(), // Unix timestamp in milliseconds
  mimeType: z.string().nullable().optional(),
  isSymlink: z.boolean().nullable().optional().default(false),
  targetLogicalPath: z.string().nullable().optional(),
  isWritable: z.boolean().nullable().optional().default(true),
  childrenCount: z.number().int().nonnegative({ message: "子项目数量不能为负" }).nullable().optional(),
  thumbnailUrl: z.string().url({ message: "缩略图 URL 必须是有效的 URL" }).nullable().optional(),
  error: z.string().nullable().optional(),
});
export type FAMItem = z.infer<typeof FAMItemSchema>;

/**
 * Schema 定义：文件资产管理项目列表。
 */
export const FAMItemsSchema = z.array(FAMItemSchema);
export type FAMItems = z.infer<typeof FAMItemsSchema>;


// --- 用户系统核心类型定义 ---

// --- 外部服务凭证模型 ---

/**
 * 外部服务凭证的元数据信息 (安全展示给用户，不包含完整凭证)
 */
export interface ExternalCredentialMetadata {
  id: string; // 凭证在数据库中的唯一ID
  serviceName: string; // 凭证对应的服务标识符, e.g., "openai", "anthropic_claude"
  displayName?: string; // 用户为该凭证设置的可选显示名称/备注
  displayHint?: {
    // 用于UI安全展示凭证的部分信息
    prefix: string; // 例如 "sk-..."
    suffix: string; // 例如 "...AbCd"
  };
  createdAt: string; // ISO 8601 创建时间戳
}

/**
 * 存储在数据库中的外部服务凭证结构 (内部使用)
 */
export interface StoredExternalCredential extends ExternalCredentialMetadata {
  userId: string; // 关联的用户ID (统一为 uid)
  storageMode: 'plaintext' | 'encrypted';
  credentialValue: string;
}

export const CreateExternalCredentialPayloadSchema = z.object({
  serviceName: z.string().min(1, { message: '服务名称不能为空' }),
  displayName: z.string().optional(),
  credential: z.string().min(1, { message: '凭证内容不能为空' }),
});
export type CreateExternalCredentialPayload = z.infer<typeof CreateExternalCredentialPayloadSchema>;

// --- 服务 API 密钥模型 ---

/**
 * 服务 API 密钥的元数据信息 (安全展示给用户，不包含完整密钥)
 */
export interface ServiceApiKeyMetadata {
  id: string; // 密钥在数据库中的唯一ID
  name?: string; // 用户为密钥设置的可选显示名称/备注
  prefix: string; // 密钥的前几位字符，用于识别，例如 "ctsk-xxxx" (ComfyTavern Service Key)
  scopes?: string[]; // (预留) 权限范围，例如 ["workflow:execute:*", "project:read:project_id_123"]
  createdAt: string; // ISO 8601 创建时间戳
  lastUsedAt?: string; // ISO 8601 最后成功使用时间戳 (可选)
}

/**
 * 存储在数据库中的服务 API 密钥结构 (内部使用)
 */
export interface StoredServiceApiKey extends ServiceApiKeyMetadata {
  userId: string; // 关联的用户ID (统一为 uid)
  hashedKey: string;
}

/**
 * 创建服务 API 密钥时，一次性返回给用户的包含完整密钥的结构
 */
export interface ServiceApiKeyWithSecret extends ServiceApiKeyMetadata {
  secret: string; // 完整、明文的 API 密钥，仅在生成时一次性显示
}

export const CreateServiceApiKeyPayloadSchema = z.object({
  name: z.string().optional(),
  // scopes: z.array(z.string()).optional(), // 预留，与后端保持一致
});
export type CreateServiceApiKeyPayload = z.infer<typeof CreateServiceApiKeyPayloadSchema>;

// --- 统一的用户身份与上下文模型 (v4 核心简化) ---

/**
 * 代表一个可以拥有两种密钥的用户身份的基础接口
 */
export interface UserIdentityBase {
  avatarUrl?: string; // 用户头像 URL (可选)
  serviceApiKeys: ServiceApiKeyMetadata[]; // 用户拥有的服务 API 密钥列表 (仅元数据)
  externalCredentials: ExternalCredentialMetadata[]; // 用户拥有的外部服务凭证列表 (仅元数据)
}

/**
 * 统一的用户身份模型 (v4 新增)
 * 该模型同时适用于单用户模式下的“默认用户”和多用户模式下的注册用户。
 */
export interface UserIdentity extends UserIdentityBase {
  // 统一的用户标识符。
  // - 在单用户模式下，其值为固定的 'default_user'。
  // - 在多用户模式下，其值为用户的 UUID。
  uid: string;
  username: string;
  isAdmin: boolean; // 在单用户模式下，此值无实际意义，可默认为 false。
  createdAt: string;
}

/**
 * 单用户模式上下文 (v4 新增, 统一了有无密码的场景)
 */
export interface SingleUserContext {
  mode: "SingleUser";
  multiUserMode: false;
  accessPasswordRequired: boolean; // 标记是否配置了全局访问密码
  isAuthenticated: boolean; // 标记浏览器会话是否已通过认证。在无密码时，恒为 true。
  currentUser: UserIdentity | null; // 认证成功后为默认用户信息，否则为 null。
  globalPasswordSetupRequired?: boolean; // (可选) 用于首次设置密码的引导
}

/**
 * 多用户共享模式上下文 (v4 调整)
 */
export interface MultiUserContext {
  mode: "MultiUser";
  multiUserMode: true;
  isAuthenticated: boolean; // 标记用户是否已通过账户密码登录
  currentUser: UserIdentity | null; // 登录后为该用户的详细信息
  adminRegistrationRequired?: boolean; // (可选) 用于首次注册管理员的引导
}

/**
 * 应用的统一用户上下文类型 (v4 简化)
 * 由后端在每次请求时动态确定和填充。
 */
export type UserContext =
  | SingleUserContext
  | MultiUserContext;


// --- LLM Adapter Schemas ---

/**
 * LLM 适配器执行请求时所需的标准化负载。
 */
export interface LlmAdapterRequestPayload {
  messages: CustomMessage[];
  modelConfig: Record<string, any>; // e.g., { temperature: 0.7, max_tokens: 1024 }
  channelConfig: ApiCredentialConfig;
  stream?: boolean; // 可选的流式请求标志，默认为 false
}

/**
 * 所有 LLM API 适配器必须实现的接口。
 */
export interface ILlmApiAdapter {
  /**
   * 执行对 LLM 的请求（例如聊天补全）。
   * @param payload - 包含消息、模型配置和渠道配置的标准化负载。
   * @returns 一个解析为标准化响应的 Promise。
   */
  execute(payload: LlmAdapterRequestPayload): Promise<StandardResponse>;

  /**
   * 执行对 LLM 的流式请求（例如聊天补全）。
   * @param payload - 包含消息、模型配置和渠道配置的标准化负载。
   * @returns 一个异步生成器，产生 ChunkPayload 数据块。
   */
  executeStream(payload: LlmAdapterRequestPayload): AsyncGenerator<ChunkPayload, void, unknown>;

  /**
   * 从该适配器对应的外部服务发现可用的模型列表。
   * @param credentials 包含 base_url, api_key 等认证信息。
   * @returns 返回一个只包含模型基础信息的列表。
   */
  listModels(credentials: {
    base_url: string;
    api_key?: string;
    custom_headers?: Record<string, string>;
  }): Promise<Array<{ id: string;[key: string]: any }>>;
}


/**
 * Schema 定义：自定义消息内容块 (文本)。
 */
export const textContentPartSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});
export type TextContentPart = z.infer<typeof textContentPartSchema>;

/**
 * Schema 定义：自定义消息内容块 (图像)。
 */
export const imageContentPartSchema = z.object({
  type: z.literal("image_url"),
  image_url: z.object({
    url: z.string().describe("可以是 data URI 或指向后端可访问资源的 URL"),
  }),
});
export type ImageContentPart = z.infer<typeof imageContentPartSchema>;

/**
 * Schema 定义：自定义消息内容块的联合类型。
 */
export const customContentPartSchema = z.union([
  textContentPartSchema,
  imageContentPartSchema,
]);
export type CustomContentPart = z.infer<typeof customContentPartSchema>;

/**
 * Schema 定义：标准化的消息接口，用于 LLM 请求。
 * 这是一个联合类型，以精确匹配不同角色的内容要求。
 */
export const customSystemMessageSchema = z.object({
  role: z.literal("system"),
  content: z.string(),
});

export const customUserMessageSchema = z.object({
  role: z.literal("user"),
  content: z.union([z.string(), z.array(customContentPartSchema)]),
});

export const customAssistantMessageSchema = z.object({
  role: z.literal("assistant"),
  // Assistant content can be null, e.g., when making tool calls.
  content: z.string().nullable(),
});

export const customMessageSchema = z.union([
  customSystemMessageSchema,
  customUserMessageSchema,
  customAssistantMessageSchema,
]);

export type CustomMessage = z.infer<typeof customMessageSchema>;

/**
 * Schema 定义：LLM 适配器返回的标准化响应结构。
 */
export const standardResponseSchema = z.object({
  text: z.string().describe("LLM 返回的主要文本内容"),
  choices: z.array(z.object({
    index: z.number(),
    message: customMessageSchema,
    finish_reason: z.string(),
  })).optional(),
  usage: z.object({
    prompt_tokens: z.number().optional(),
    completion_tokens: z.number().optional(),
    total_tokens: z.number().optional(),
  }).passthrough().optional(),
  raw_response: z.any().optional().describe("未经修改的原始响应体"),
  error: z.object({
    code: z.union([z.string(), z.number()]).optional(),
    message: z.string(),
    type: z.string().optional(),
    details: z.any().optional(),
  }).optional(),
  model: z.string().describe("实际使用的模型 ID"),
  response_id: z.string().optional(),
});
export type StandardResponse = z.infer<typeof standardResponseSchema>;


/**
 * Schema 定义：单个 API 渠道的凭证配置。
 */
export const apiCredentialConfigSchema = z.object({
  id: z.string().uuid().optional(), // 在数据库层面生成
  userId: z.string(),
  label: z.string().min(1, "渠道名称不能为空"),
  providerId: z.string().optional(),
  adapterType: z.string().optional(),
  baseUrl: z.string().url("必须是有效的 URL"),
  apiKey: z.string().min(1, "API Key 不能为空"),
  storageMode: z.enum(['plaintext', 'encrypted']).default('plaintext'),
  customHeaders: z.record(z.string()).optional(),
  modelListEndpoint: z.string().optional(),
  supportedModels: z.array(z.string()).optional().describe("该渠道支持的模型ID列表"),
  disabled: z.boolean().default(false),
  createdAt: z.string().datetime().optional(),
});
export type ApiCredentialConfig = z.infer<typeof apiCredentialConfigSchema>;

/**
 * Schema 定义：用户激活并可在工作流中使用的模型信息。
 */
export const activatedModelInfoSchema = z.object({
  modelId: z.string().min(1, "模型 ID 不能为空"),
  userId: z.string(),
  displayName: z.string().min(1, "显示名称不能为空"),
  capabilities: z.array(z.string()),
  modelType: z.enum(['llm', 'embedding', 'unknown']).default('unknown'),
  groupName: z.string().optional(),
  icon: z.string().optional(),
  defaultChannelRef: z.string().optional(),
  tags: z.array(z.string()).optional(),
  tokenizerId: z.string().optional(),
});
export type ActivatedModelInfo = z.infer<typeof activatedModelInfoSchema>;

// --- Agent & Scene Schemas (Agent Architecture v3) ---

/**
 * Schema 定义: 场景中 Agent 实例的配置。
 */
export const SceneAgentInstanceSchema = z.object({
  instance_id: z.string().describe("场景中 Agent 实例的唯一 ID"),
  profile_id: z.string().describe("引用的 Agent Profile ID"),
  initial_private_state_override: z.record(z.any()).optional().describe("覆盖 Profile 的 PrivateState 初始值"),
  initial_goals_override_reference: z.array(z.any()).optional().describe("覆盖 Profile 的初始目标"),
});

/**
 * Schema 定义: Agent 的静态蓝图或配置档案。
 */
export const AgentProfileSchema = z.object({
  id: z.string().describe("Agent Profile 的全局唯一标识符"),
  name: z.string().describe("用户可读的 Agent 名称"),
  description: z.string().optional().describe("对该 Agent 类型或角色的详细描述"),
  version: z.string().describe("Agent Profile 的版本号"),
  schema_version: z.string().describe("agent_profile.json 本身 Schema 的版本号"),
  core_deliberation_workflow_id: z.string().describe("指向核心审议循环的工作流ID"),
  initial_private_state_schema: z.record(z.any()).optional().describe("定义 PrivateState 的 JSON Schema"),
  initial_private_state_values: z.record(z.any()).optional().describe("PrivateState 的初始值"),
  knowledge_base_references: z.array(z.any()).optional().describe("可访问的知识库列表"),
  subscribed_event_types: z.array(z.any()).optional().describe("默认订阅的事件类型"),
  skill_workflow_ids_inventory: z.array(z.string()).optional().describe("拥有的“技能工作流”ID列表"),
  tool_ids_inventory: z.array(z.string()).optional().describe("可使用的“原子工具”标识符列表"),
  initial_goals_reference: z.array(z.any()).optional().describe("默认目标列表"),
});
export type AgentProfile = z.infer<typeof AgentProfileSchema>;

/**
 * Schema 定义: 场景定义，作为 Agent 的宿主环境。
 */
export const SceneDefinitionSchema = z.object({
  id: z.string().describe("场景定义的唯一标识符"),
  name: z.string().describe("用户可读的场景名称"),
  description: z.string().optional().describe("场景描述"),
  agent_instances: z.array(SceneAgentInstanceSchema).describe("场景中需要激活的 Agent 实例列表"),
  initial_world_state: z.record(z.any()).optional().describe("场景的初始世界状态"),
  associated_panels: z.array(z.any()).optional().describe("关联的应用面板"),
  scene_lifecycle_workflows: z.record(z.string()).optional().describe("场景生命周期工作流"),
});
export type SceneDefinition = z.infer<typeof SceneDefinitionSchema>;
