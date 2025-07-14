import { z } from 'zod';
import { GroupSlotInfoSchema } from './node';
import type { NodeExecutionResult } from './node';
import type { NanoId } from './common';

// --- Execution Status & Chunks ---

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


// --- Execution Schemas ---

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
// 实际的 WorkflowExecutionPayload 类型定义在下面，以包含 clientId 等运行时属性
export type WorkflowExecutionPayload = z.infer<typeof WorkflowExecutionPayloadSchema> & {
  clientId?: string;
  metadata?: Record<string, any>;
};


// --- Core Execution Status ---

/**
 * 工作流执行状态更新 (表示工作流的整体状态)
 */
export interface WorkflowExecutionStatus {
  workflowId: string; // 工作流ID或执行实例的标识符
  status: ExecutionStatus; // 执行状态
  startTime?: number; // 开始时间戳
  endTime?: number; // 结束时间戳
  error?: string; // 错误信息
}


// --- WebSocket Message Types ---

export enum WebSocketMessageType {
  // 客户端 -> 服务端
  PROMPT_REQUEST = "PROMPT_REQUEST",
  BUTTON_CLICK = "button_click",
  LOAD_WORKFLOW = "load_workflow",
  SAVE_WORKFLOW = "save_workflow",
  LIST_WORKFLOWS = "list_workflows",
  GET_NODE_DEFINITIONS = "get_node_definitions",
  RELOAD_BACKEND = "reload_backend",
  INTERRUPT_REQUEST = "INTERRUPT_REQUEST",

  // 服务端 -> 客户端
  PROMPT_ACCEPTED_RESPONSE = "PROMPT_ACCEPTED_RESPONSE",
  EXECUTION_STATUS_UPDATE = "EXECUTION_STATUS_UPDATE",
  NODE_EXECUTING = "NODE_EXECUTING",
  NODE_PROGRESS = "NODE_PROGRESS",
  NODE_COMPLETE = "NODE_COMPLETE",
  NODE_ERROR = "NODE_ERROR",
  NODE_YIELD = "NODE_YIELD", // 新增流式输出消息类型
  EXECUTION_RESULT = "execution_result",
  WORKFLOW_LOADED = "workflow_loaded",
  WORKFLOW_SAVED = "workflow_saved",
  WORKFLOW_LIST = "workflow_list",
  NODE_DEFINITIONS = "node_definitions",
  BACKEND_RELOADED = "backend_reloaded",
  ERROR = "error",
  NODES_RELOADED = "NODES_RELOADED",
  WORKFLOW_INTERFACE_YIELD = "WORKFLOW_INTERFACE_YIELD", // 新增工作流接口流式输出消息类型
}

// 通用 WebSocket 消息结构
export interface WebSocketMessage<T = any> {
  type: WebSocketMessageType;
  payload: T;
}


// --- WebSocket Payload Interfaces ---

/**
 * 确认收到执行请求的响应载荷。
 */
export interface PromptAcceptedResponsePayload {
  promptId: NanoId;
}

/**
 * 更新工作流整体状态的载荷。
 */
export interface ExecutionStatusUpdatePayload {
  promptId: NanoId;
  status: ExecutionStatus;
  errorInfo?: any;
}

/**
 * 通知节点开始执行的载荷。
 */
export interface NodeExecutingPayload {
  promptId: NanoId;
  nodeId: NanoId;
}

/**
 * 节点执行进度的载荷 (可选)。
 */
export interface NodeProgressPayload {
  promptId: NanoId;
  nodeId: NanoId;
  value: number;
  max: number;
}

/**
 * 通知节点执行完成的载荷。
 */
export interface NodeCompletePayload {
  promptId: NanoId;
  nodeId: NanoId;
  output: any;
}

/**
 * 通知节点执行出错的载荷。
 */
export interface NodeErrorPayload {
  promptId: NanoId;
  nodeId: NanoId;
  errorDetails: any;
}

/**
 * 通知节点被绕过的载荷。
 */
export interface NodeBypassedPayload {
  promptId: NanoId;
  nodeId: NanoId;
  pseudoOutputs: Record<string, any>;
}

/**
 * 通知节点产出流式数据块的载荷。
 */
export interface NodeYieldPayload {
  promptId: NanoId;
  sourceNodeId: NanoId;
  yieldedContent: ChunkPayload;
  isLastChunk: boolean;
}

/**
 * 当工作流的某个流式接口产出数据块时的载荷。
 */
export interface WorkflowInterfaceYieldPayload {
  promptId: NanoId;
  interfaceOutputKey: string; // 对应于 interfaceOutputs 中的键
  interfaceOutputDisplayName?: string; // 接口输出的显示名称 (可选)
  yieldedContent: ChunkPayload | any; // 数据块 (通常是 ChunkPayload，但允许 any 以兼容旧的或特殊数据)
  isLastChunk: boolean;
}

export interface ButtonClickPayload {
  nodeId: string;
  buttonName: string;
  workflowId?: string;
  nodeType?: string;
  nodeDisplayName?: string;
}

export interface NodeStatusUpdatePayload extends NodeExecutionResult {}

export interface WorkflowStatusUpdatePayload extends WorkflowExecutionStatus {}

export interface ErrorPayload {
  message: string;
  details?: any;
}

export interface NodesReloadedPayload {
  success: boolean;
  message?: string;
  count?: number;
}


// --- HTTP API Related Types ---

/**
 * 用于 `/executions` API 返回的任务信息结构。
 */
export interface PromptInfo {
  promptId: NanoId;
  status: ExecutionStatus | string;
  workflowName?: string;
  submittedAt?: string | number;
}

/**
 * `/executions` API 的响应结构。
 */
export interface ExecutionsListResponse {
  running: PromptInfo[];
  pending: PromptInfo[];
}

/**
 * `/prompt/{promptId}` API 的响应结构 (示例)。
 */
export interface PromptStatusResponse extends PromptInfo {
  nodeStatus?: Record<NanoId, { status: string; output?: any; error?: any }>;
  outputs?: Record<NanoId, any>;
  errorInfo?: any;
}

/**
 * `/history/{promptId}` API 的响应结构 (示例)。
 */
export interface HistoryEntryResponse extends PromptStatusResponse {
  completedAt?: string | number;
  durationMs?: number;
}
