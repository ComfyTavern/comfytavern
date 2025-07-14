import { z } from 'zod';
import type { ChunkPayload } from './execution';

// --- LLM Adapter Schemas ---

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