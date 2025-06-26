import { z } from 'zod';

// 面板API的能力调用请求对象 (单一、灵活的模式)
export const InvocationRequestSchema = z.object({
  // 调用模式，如果提供了 alias，此字段可以省略，将默认为 'native'
  mode: z.enum(['native', 'adapter']).optional(),
  // 要执行的工作流ID，如果提供了 alias，此字段将被忽略
  workflowId: z.string().optional(),
  // 要调用的适配器ID
  adapterId: z.string().optional(),
  // 【推荐】调用别名，定义在面板的 workflowBindings 中
  alias: z.string().optional(),
  // 工作流或适配器的输入参数
  inputs: z.record(z.any()),
});
export type InvocationRequest = z.infer<typeof InvocationRequestSchema>;


// 面板API的能力调用响应对象
export const InvocationResponseSchema = z.object({
  executionId: z.string(),
});
export type InvocationResponse = z.infer<typeof InvocationResponseSchema>;