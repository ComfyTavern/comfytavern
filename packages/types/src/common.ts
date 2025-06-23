import { z } from 'zod';

/**
 * Nano ID 的类型别名，通常是字符串。
 */
export type NanoId = string;

/**
 * 工作流执行状态的枚举。
 * 注意：统一前端和后端使用的状态值。
 */
export enum ExecutionStatus {
  QUEUED = 'queued',         // 工作流在队列中等待执行
  RUNNING = 'running',       // 工作流或节点正在执行
  COMPLETE = 'complete',     // 工作流或节点成功完成
  ERROR = 'error',           // 工作流或节点执行出错
  INTERRUPTED = 'interrupted', // 工作流被中断
  IDLE = 'idle',             // 节点或工作流处于空闲/未执行状态 (前端常用)
  SKIPPED = 'skipped',       // 节点被跳过执行 (前端常用)
}

/**
 * 定义流式数据块的内容。
 */
export const ChunkPayloadSchema = z.object({
  type: z.enum([
    "text_chunk",
    "tool_call_chunk",
    "finish_reason_chunk",
    "usage_chunk",
    "error_chunk",
    "custom"
  ]),
  content: z.any(),
}).passthrough(); // 允许附加元数据

export type ChunkPayload = z.infer<typeof ChunkPayloadSchema>;

/**
 * 表示一个接口输出的实际值或占位符。
 * 特别用于当输出是一个流时，在初始的接口输出聚合消息中可能发送一个占位符。
 * 实际的流数据将通过 WORKFLOW_INTERFACE_YIELD 消息单独发送。
 */
export type InterfaceOutputValue =
  | any // 代表实际的非流数据，或流对象的引用（尽管通常不直接发送流对象）
  | { type: 'stream_placeholder'; message: string; interfaceOutputKey: string }; // 流的占位符

/**
 * 数据流类型的常量定义。
 */
export const DataFlowType = {
  STRING: "STRING",
  INTEGER: "INTEGER",
  FLOAT: "FLOAT",
  BOOLEAN: "BOOLEAN",
  OBJECT: "OBJECT",
  ARRAY: "ARRAY",
  BINARY: "BINARY",
  WILDCARD: "WILDCARD",
  CONVERTIBLE_ANY: "CONVERTIBLE_ANY",
} as const;

export type DataFlowTypeName = (typeof DataFlowType)[keyof typeof DataFlowType];

/**
 * 内置的插槽匹配类别。
 * 用于类型检查、连接建议和 UI 渲染提示。
 */
export const BuiltInSocketMatchCategory = {
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
  IMAGE_DATA: "ImageData",
  AUDIO_DATA: "AudioData",
  VIDEO_DATA: "VideoData",
  RESOURCE_ID: "ResourceId",
  TRIGGER: "Trigger",
  STREAM_CHUNK: "StreamChunk",
  COMBO_OPTION: "ComboOption",
  REGEX_RULE_ARRAY: "RegexRuleArray",
  
  // UI 渲染提示
  /** 标记此输入组件应作为“大块”或“块级”元素渲染 */
  UI_BLOCK: "UiBlock",
  /** 标记此输入支持标准的内联预览操作按钮 */
  CanPreview: "CanPreview",
  /** 标记此输入不应显示其类型的默认编辑操作按钮 */
  NoDefaultEdit: "NoDefaultEdit",

  // 行为标签
  BEHAVIOR_WILDCARD: "BehaviorWildcard",
  BEHAVIOR_CONVERTIBLE: "BehaviorConvertible",
} as const;

export type BuiltInSocketMatchCategoryName = (typeof BuiltInSocketMatchCategory)[keyof typeof BuiltInSocketMatchCategory];
