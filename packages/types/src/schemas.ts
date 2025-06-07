import { z } from 'zod';
import { GroupSlotInfoSchema } from './node';

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
