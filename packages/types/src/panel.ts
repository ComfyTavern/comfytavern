import { z } from 'zod';

// 面板API的能力调用请求对象 (单一、灵活的模式)
export const InvocationRequestSchema = z.object({
  // 调用模式
  mode: z.enum(['native', 'adapter']),
  // 要执行的工作流ID (mode: 'native')
  workflowId: z.string().optional(),
  // 要调用的适配器ID (mode: 'adapter')
  adapterId: z.string().optional(),
  // 工作流或适配器的输入参数
  inputs: z.record(z.any()),
});
export type InvocationRequest = z.infer<typeof InvocationRequestSchema>;


// 面板API的能力调用响应对象
export const InvocationResponseSchema = z.object({
  executionId: z.string(),
});
export type InvocationResponse = z.infer<typeof InvocationResponseSchema>;