import { z } from 'zod';

// 面板API的能力调用请求对象 (native 模式)
export const NativeInvocationRequestSchema = z.object({
  mode: z.literal('native'),
  workflowId: z.string(),
  inputs: z.record(z.any()),
});

// 面板API的能力调用请求对象 (adapter 模式)
export const AdapterInvocationRequestSchema = z.object({
  mode: z.literal('adapter'),
  adapterId: z.string(),
  inputs: z.record(z.any()),
});

// 面板API的能力调用请求对象 (联合类型)
export const InvocationRequestSchema = z.union([
  NativeInvocationRequestSchema,
  AdapterInvocationRequestSchema,
]);
export type InvocationRequest = z.infer<typeof InvocationRequestSchema>;


// 面板API的能力调用响应对象
export const InvocationResponseSchema = z.object({
  executionId: z.string(),
});
export type InvocationResponse = z.infer<typeof InvocationResponseSchema>;