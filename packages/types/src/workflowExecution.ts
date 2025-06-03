/**
 * @fileoverview 定义工作流执行相关的共享 TypeScript 类型。
 * 参考设计文档: docs/architecture/workflow-execution-plan.md
 */
import type { GroupSlotInfo } from './schemas'; // 导入 GroupSlotInfo 类型

/**
 * Nano ID 的类型别名，通常是字符串。
 */
export type NanoId = string;

// --- 核心执行数据结构 ---

/**
 * 用于执行的节点表示。
 * 参考: workflow-execution-plan.md 第 23 行
 */
export interface ExecutionNode {
  /** 节点唯一标识符 (Nano ID) */
  id: NanoId;
  /** 节点的完整类型 (namespace:type) */
  fullType: string;
  /** 节点的输入值 (仅包含非默认值或连接值) */
  inputs?: Record<string, any>; // 或者更具体的类型
  /** 节点的配置值 */
  configValues?: Record<string, any>; // 或者更具体的类型
  /** 节点是否被绕过 */
  bypassed?: boolean;
  /** 节点的多输入连接顺序 (可选) */
  inputConnectionOrders?: Record<string, string[]>;
}

/**
 * 用于执行的边表示。
 * 参考: workflow-execution-plan.md 第 23 行
 */
export interface ExecutionEdge {
  /** 边的唯一标识符 (可选, 但建议有) */
  id?: NanoId;
  /** 源节点 ID (Nano ID) */
  sourceNodeId: NanoId;
  /** 源节点的输出句柄 ID */
  sourceHandle: string;
  /** 目标节点 ID (Nano ID) */
  targetNodeId: NanoId;
  /** 目标节点的输入句柄 ID */
  targetHandle: string;
}

/**
 * 提交工作流执行的载荷。
 * 参考: workflow-execution-plan.md 第 23, 43 行
 */
export interface WorkflowExecutionPayload {
  /** 执行图中的节点列表 */
  nodes: ExecutionNode[];
  /** 执行图中的边列表 */
  edges: ExecutionEdge[];
  /** (可选) 客户端 ID，用于追踪来源 */
  clientId?: string;
  /** (可选) 附加的元数据 */
  metadata?: Record<string, any>;
  /**
   * (可选) 工作流的输出接口到内部节点输出的映射。
   * key: interfaceOutput 的 key (例如 "output_0", "summary_text")
   * value: { sourceNodeId: NanoId, sourceSlotKey: string }
   */
 outputInterfaceMappings?: Record<string, { sourceNodeId: NanoId, sourceSlotKey: string }>;
 /** (可选) 工作流的输入接口定义 */
 interfaceInputs?: Record<string, GroupSlotInfo>;
 /** (可选) 工作流的输出接口定义 (主要供参考，实际输出通过 mappings 处理) */
 interfaceOutputs?: Record<string, GroupSlotInfo>;
}

// --- WebSocket 消息 Payload ---

/**
 * 确认收到执行请求的响应载荷。
 * 参考: workflow-execution-plan.md 第 28 行
 */
export interface PromptAcceptedResponsePayload {
  /** 分配给此次执行的唯一 ID (Nano ID) */
  promptId: NanoId;
}

/**
 * 工作流执行状态的枚举。
 * 参考: workflow-execution-plan.md 第 30 行
 * 注意：统一前端和后端使用的状态值。
 */
export enum ExecutionStatus {
  QUEUED = 'queued',         // 工作流在队列中等待执行 (对应旧 PENDING)
  RUNNING = 'running',       // 工作流或节点正在执行
  COMPLETE = 'complete',     // 工作流或节点成功完成 (对应旧 COMPLETED)
  ERROR = 'error',           // 工作流或节点执行出错
  INTERRUPTED = 'interrupted', // 工作流被中断
  IDLE = 'idle',             // 节点或工作流处于空闲/未执行状态 (前端常用)
  SKIPPED = 'skipped',       // 节点被跳过执行 (前端常用)
  // PENDING = 'pending' // 保留 PENDING 以防万一，但优先使用 QUEUED
}

/**
 * 更新工作流整体状态的载荷。
 * 参考: workflow-execution-plan.md 第 30 行
 */
export interface ExecutionStatusUpdatePayload {
  /** 执行 ID (Nano ID) */
  promptId: NanoId;
  /** 当前状态 */
  status: ExecutionStatus; // 现在引用枚举
  /** 错误信息 (仅在 status 为 'error' 时) */
  errorInfo?: any;
}

/**
 * 通知节点开始执行的载荷。
 * 参考: workflow-execution-plan.md 第 32 行
 */
export interface NodeExecutingPayload {
  /** 执行 ID (Nano ID) */
  promptId: NanoId;
  /** 正在执行的节点 ID (Nano ID) */
  nodeId: NanoId;
}

/**
 * 节点执行进度的载荷 (可选)。
 * 参考: workflow-execution-plan.md 第 34 行
 */
export interface NodeProgressPayload {
  /** 执行 ID (Nano ID) */
  promptId: NanoId;
  /** 正在执行的节点 ID (Nano ID) */
  nodeId: NanoId;
  /** 当前进度值 */
  value: number;
  /** 最大进度值 */
  max: number;
}

/**
 * 节点执行类型：完整执行或预览执行。
 * 参考: workflow-execution-plan.md 第 36 行
 */
/**
 * 通知节点执行完成的载荷。
 * 参考: workflow-execution-plan.md 第 36 行
 */
export interface NodeCompletePayload {
  /** 执行 ID (Nano ID) */
  promptId: NanoId;
  /** 完成执行的节点 ID (Nano ID) */
  nodeId: NanoId;
  /** 节点的输出数据 */
  output: any; // 或者更具体的类型，取决于节点输出
}

/**
 * 通知节点执行出错的载荷。
 * 参考: workflow-execution-plan.md 第 38 行
 */
export interface NodeErrorPayload {
  /** 执行 ID (Nano ID) */
  promptId: NanoId;
  /** 出错的节点 ID (Nano ID) */
  nodeId: NanoId;
  /** 错误详情 */
  errorDetails: any;
}

/**
 * 通知节点被绕过的载荷。
 */
export interface NodeBypassedPayload {
  /** 执行 ID (Nano ID) */
  promptId: NanoId;
  /** 被绕过的节点 ID (Nano ID) */
  nodeId: NanoId;
  /** 绕过时产生的伪输出 */
  pseudoOutputs: Record<string, any>;
}



// --- HTTP API 相关类型 ---

/**
 * 用于 `/executions` API 返回的任务信息结构。
 * 参考: workflow-execution-plan.md 第 48 行
 * 注意: 文档中未详细定义，这里定义基础字段。
 */
export interface PromptInfo {
  /** 执行 ID (Nano ID) */
  promptId: NanoId;
  /** 当前状态 */
  status: ExecutionStatus | string; // 引用枚举，但也允许其他字符串状态
  /** (可选) 工作流名称或标识 */
  workflowName?: string;
  /** (可选) 提交时间 */
  submittedAt?: string | number;
  // 可以根据需要添加更多字段，如 clientId, metadata 等
}

/**
 * `/executions` API 的响应结构。
 * 参考: workflow-execution-plan.md 第 48 行
 */
export interface ExecutionsListResponse {
  /** 正在运行的任务列表 */
  running: PromptInfo[];
  /** 等待队列中的任务列表 */
  pending: PromptInfo[];
}

/**
 * `/prompt/{promptId}` API 的响应结构 (示例)。
 * 参考: workflow-execution-plan.md 第 46 行
 */
export interface PromptStatusResponse extends PromptInfo {
  /** 节点执行状态 (如果需要) */
  nodeStatus?: Record<NanoId, { status: string; output?: any; error?: any }>;
  /** 最终输出 (如果已完成) */
  outputs?: Record<NanoId, any>; // 结构可能更复杂
  /** 错误信息 (如果出错) */
  errorInfo?: any;
}

/**
 * `/history/{promptId}` API 的响应结构 (示例)。
 * 参考: workflow-execution-plan.md 第 50 行
 * 可能与 PromptStatusResponse 类似，但包含更持久化的信息。
 */
export interface HistoryEntryResponse extends PromptStatusResponse {
  /** 完成时间 */
  completedAt?: string | number;
  /** 执行耗时 (ms) */
  durationMs?: number;
}


// History DB砍掉了，这是AI趁我不注意擅自添加的过度设计方案。
/**
 * `/history` API 的响应结构 (示例)。
 * 参考: workflow-execution-plan.md 第 49 行
 */
// export interface HistoryListResponse {
//   /** 历史记录条目列表 */
//   items: HistoryEntryResponse[];
//   /** 总条目数 */
//   total: number;
//   /** 当前页码 */
//   page: number;
//   /** 每页数量 */
//   pageSize: number;
// }