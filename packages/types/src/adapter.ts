import { z } from 'zod';

// 映射规则中的转换器定义
export const TransformerSchema = z.object({
  type: z.enum(['template', 'function', 'jsonata']),
  expression: z.string(),
});
export type Transformer = z.infer<typeof TransformerSchema>;

// 单个映射规则定义
export const MappingRuleSchema = z.object({
  sourcePath: z.string().min(1, '源路径不能为空'),
  transformer: TransformerSchema.optional(),
  defaultValue: z.any().optional(),
});
export type MappingRule = z.infer<typeof MappingRuleSchema>;

// API适配器健康状态
export const ApiAdapterValidationStatusSchema = z.enum([
  'OK',
  'OUTDATED',
  'WORKFLOW_NOT_FOUND',
  'UNKNOWN',
]);
export type ApiAdapterValidationStatus = z.infer<typeof ApiAdapterValidationStatusSchema>;

// API适配器核心定义
export const ApiAdapterSchema = z.object({
  id: z.string().cuid2(),
  name: z.string().min(1, '适配器名称不能为空'),
  description: z.string().optional(),
  // 适配器类型标识符。推荐使用 "namespace:name" 格式，例如 "openai:chat_v1"。
  // 设计为字符串以支持未来扩展，允许开发者注册和使用自定义的适配器类型。
  adapterType: z.string(),
  targetWorkflowId: z.string().cuid2('目标工作流ID无效'),
  
  // modelIdentifier 主要用于后端OpenAI兼容层，根据外部请求的`model`字段路由到此适配器
  modelIdentifier: z.string().optional(),

  // 请求映射规则 (Key: 工作流的输入插槽ID)
  requestMapping: z.record(z.string(), MappingRuleSchema),

  // 响应映射规则 (可选，用于适配器测试或未来扩展)
  responseMapping: z.record(z.string(), MappingRuleSchema).optional(),

  // -- 元数据 --
  validationStatus: ApiAdapterValidationStatusSchema.default('UNKNOWN'),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type ApiAdapter = z.infer<typeof ApiAdapterSchema>;

// 用于创建适配器的载荷，ID由后端生成
export const CreateApiAdapterPayloadSchema = ApiAdapterSchema.omit({ 
  id: true, 
  validationStatus: true,
  createdAt: true, 
  updatedAt: true 
});
export type CreateApiAdapterPayload = z.infer<typeof CreateApiAdapterPayloadSchema>;

// 用于更新适配器的载荷
export const UpdateApiAdapterPayloadSchema = CreateApiAdapterPayloadSchema.partial();
export type UpdateApiAdapterPayload = z.infer<typeof UpdateApiAdapterPayloadSchema>;