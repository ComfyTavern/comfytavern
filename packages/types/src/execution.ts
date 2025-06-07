/**
 * @fileoverview 定义工作流执行、WebSocket 通信相关的共享 TypeScript 类型。
 */
import type { ExecutionNode, ExecutionEdge } from './schemas';
import type { GroupSlotInfo } from './node';
import { ExecutionStatus, type NanoId, type ChunkPayload, type CustomMessage } from './common';
import type { NodeExecutionResult } from './node';

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
 * 提交工作流执行的载荷。
 */
export interface WorkflowExecutionPayload {
  nodes: ExecutionNode[];
  edges: ExecutionEdge[];
  clientId?: string;
  metadata?: Record<string, any>;
  outputInterfaceMappings?: Record<string, { sourceNodeId: NanoId, sourceSlotKey: string }>;
  interfaceInputs?: Record<string, GroupSlotInfo>;
  interfaceOutputs?: Record<string, GroupSlotInfo>;
}

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

/**
 * 标准化的 LLM 服务响应结构。
 * 基于 llm-adapter-architecture-plan.md
 */
export interface StandardResponse {
  text: string; // 主要文本内容
  choices?: Array<{
    index: number;
    message: CustomMessage; // 使用导入的 CustomMessage 类型
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    [key: string]: any;
  };
  raw_response?: any; // 原始的、未经处理的 LLM API 响应
  error?: {
    code?: string | number;
    message: string;
    type?: string;
    details?: any;
  };
  model: string; // 实际使用的模型
  response_id?: string; // 响应的唯一标识符
}