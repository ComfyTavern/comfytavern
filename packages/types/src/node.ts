import { z } from 'zod'
// Removed unused import: import type { WorkflowNode, WorkflowEdge } from '.'
import type { DataFlowTypeName } from './schemas';
import { BuiltInSocketMatchCategory, DataFlowType } from './schemas';

// 基础输入选项
export const zBaseInputOptions = z.object({
  tooltip: z.string().optional(),
  hidden: z.boolean().optional(),
  showReceivedValue: z.boolean().optional(), // 连接后是否显示接收到的值
  // required is part of InputDefinition now
  // description is part of InputDefinition/OutputDefinition now
})

// 数值输入选项
export const zNumericInputOptions = zBaseInputOptions.extend({
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  default: z.number().optional(),
  suggestions: z.array(z.number()).optional(), // 提供建议值列表
})

// 字符串输入选项
export const zStringInputOptions = zBaseInputOptions.extend({
  default: z.string().optional(),
  multiline: z.boolean().optional(),
  placeholder: z.string().optional(),
  display_only: z.boolean().optional(), // 指示是否使用只读的TextDisplay组件
  suggestions: z.array(z.string()).optional(), // 提供建议值列表
})

// 布尔输入选项
export const zBooleanInputOptions = zBaseInputOptions.extend({
  default: z.boolean().optional(),
})

// 组合框选项
export const zComboInputOptions = zBaseInputOptions.extend({
  suggestions: z.array(z.union([z.string(), z.number()])).optional(), // Renamed from options
  default: z.union([z.string(), z.number()]).optional(),
})

// Code 输入选项 (用于代码编辑器)
export const zCodeInputOptions = zBaseInputOptions.extend({
  default: z.string().optional(),
  language: z.string().optional(), // e.g., 'javascript', 'json', 'python'
  placeholder: z.string().optional(),
})

// 按钮输入选项
export const zButtonInputOptions = zBaseInputOptions.extend({
  label: z.string().optional(), // 按钮上显示的文本
})

// 自定义类型选项 (保持基础，用于未知或特殊类型)
export const zCustomInputOptions = zBaseInputOptions
// 输入定义
export interface InputDefinition {
  // name?: string // 内部标识符 - 使用 key 代替
  displayName?: string // UI 显示名称 (优先用于前端展示)
  description?: string // 插槽详细描述 (用于tooltip等)
  required?: boolean | ((configValues: Record<string, any>) => boolean); // Allow boolean or function for conditional requirement
  config?: Record<string, any>
  multi?: boolean // 标记是否支持多输入
  allowDynamicType?: boolean // 标记该插槽是否支持从 'ANY' 动态变为具体类型
  dataFlowType: DataFlowTypeName;
  matchCategories?: string[];
} // Removed redundant defaultValue, min, max here. They are handled by config via Zod schemas.

// 输出定义
export interface OutputDefinition {
  // name?: string // 内部标识符 - 使用 key 代替
  displayName?: string // UI 显示名称 (优先用于前端展示)
  description?: string // 插槽详细描述 (用于tooltip等)
  allowDynamicType?: boolean // 标记该插槽是否支持从 'ANY' 动态变为具体类型
  dataFlowType: DataFlowTypeName;
  matchCategories?: string[];
}

/**
 * 绕过行为定义，用于指定节点在被绕过时的行为。
 */
export interface BypassBehavior {
  /** 输出键到输入键的映射，用于指定伪输出如何从输入获取 */
  passThrough?: Record<string, string>;
  /** 输出键到默认值的映射，用于指定无法从输入获取值时的默认值 */
  defaults?: Record<string, any>;
}

// 节点定义
export interface NodeDefinition {
  type: string // 节点的基本名称 (e.g., 'MergeNode')
  namespace?: string; // 节点的命名空间/来源 (可选)
  category: string // 功能分类 (e.g., 'Logic', 'IO/Group')
  displayName: string
  description: string
  inputs: Record<string, InputDefinition>
  outputs: Record<string, OutputDefinition>
  execute?: (inputs: Record<string, any>, context?: any) => Promise<Record<string, any>>; // Made optional
  clientScriptUrl?: string; // Optional URL for loading client-side logic
  filePath?: string; // Optional: The absolute path to the file from which this node definition was loaded
  deprecated?: boolean
  experimental?: boolean
  width?: number // 允许节点定义指定自己的首选宽度

  // 组节点相关属性
  isGroupInternal?: boolean                       // 标记节点是否只能在组内部使用
  groupId?: string                                // 节点所属的组ID
  groupConfig?: {                                 // 组相关配置
    allowExternalUse?: boolean                    // 是否允许在组外使用
    dynamicPorts?: boolean                        // 是否支持动态端口 (旧，考虑移除或重命名)
  }
  dynamicSlots?: boolean                          // 标记节点是否支持动态添加/删除插槽 (例如 GroupInput/Output)
  configSchema?: Record<string, InputDefinition>; // 用于定义节点级别的配置项，其结构与输入类似
  configValues?: Record<string, any>;             // 用于存储节点配置项的实际值
  isPreviewUnsafe?: boolean;                      // 标记节点在预览模式下是否不安全 (默认为 false/安全)
  bypassBehavior?: 'mute' | BypassBehavior;       // 节点在被绕过时的行为
}

// API设置类型
export interface APISettings {
  use_env_vars: boolean
  base_url: string
  api_key: string
}

// 类型导出
export type BaseInputOptions = z.infer<typeof zBaseInputOptions>
export type NumericInputOptions = z.infer<typeof zNumericInputOptions>
export type StringInputOptions = z.infer<typeof zStringInputOptions>
export type BooleanInputOptions = z.infer<typeof zBooleanInputOptions>
export type ComboInputOptions = z.infer<typeof zComboInputOptions>
export type CodeInputOptions = z.infer<typeof zCodeInputOptions> // 新增
export type ButtonInputOptions = z.infer<typeof zButtonInputOptions> // 新增
export type CustomInputOptions = z.infer<typeof zCustomInputOptions>

// 验证函数
export function validateInputOptions(
  dataFlowType: DataFlowTypeName,
  options: any,
  matchCategories?: string[]
): BaseInputOptions | null {
  let schema
  switch (dataFlowType) {
    case DataFlowType.INTEGER:
    case DataFlowType.FLOAT:
      schema = zNumericInputOptions
      break
    case DataFlowType.BOOLEAN:
      schema = zBooleanInputOptions
      break
    case DataFlowType.STRING:
      if (matchCategories?.includes(BuiltInSocketMatchCategory.CODE)) {
        schema = zCodeInputOptions;
      } else if (options?.suggestions && Array.isArray(options.suggestions)) {
        schema = zComboInputOptions;
      } else {
        schema = zStringInputOptions;
      }
      break;
    case DataFlowType.WILDCARD:
      if (matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER)) {
        schema = zButtonInputOptions;
      } else {
        schema = zCustomInputOptions; // Default for WILDCARD if not a TRIGGER
      }
      break;
    case DataFlowType.OBJECT:
    case DataFlowType.ARRAY:
    case DataFlowType.BINARY:
    case DataFlowType.CONVERTIBLE_ANY:
      schema = zCustomInputOptions; // These types currently use custom/base options
      break;
    default:
      // console.warn(`Unknown dataFlowType "${dataFlowType}" in validateInputOptions, using zCustomInputOptions.`);
      schema = zCustomInputOptions
  }

  const result = schema.safeParse(options)
  if (!result.success) {
    // 使用 result.error.format() 以获得更清晰的错误输出
    console.warn(`Invalid input options for dataFlowType ${dataFlowType}:`, result.error.format())
    return null
  }
  return result.data
}

// --- Execution Related Types ---

// Removed NodeInternalStatus enum, use ExecutionStatus from workflowExecution.ts
// export enum NodeInternalStatus { ... }

// Node Execution Context
export interface NodeExecutionContext {
  nodeId: string;
  inputs: Record<string, any>; // Resolved input values
  // Potentially add workflow-level context if needed
  // workflowContext?: WorkflowExecutionContext;
}

// Node Execution Result
// Import ExecutionStatus enum from the shared types
import { ExecutionStatus } from './workflowExecution';

export interface NodeExecutionResult {
  nodeId: string;
  status: ExecutionStatus; // Use imported ExecutionStatus enum
  outputs?: Record<string, any>; // Output values if COMPLETED
  error?: string; // Error message if ERROR
  startTime?: number; // Execution start timestamp
  endTime?: number; // Execution end timestamp
}

// Workflow Execution Context (Data needed to start execution)
// Removed the first definition of WorkflowExecutionPayload (lines 196-215)
// as it was redundant and potentially caused type conflicts (TS2717).
// The definition at line 348 uses the correct ExecutionNode/ExecutionEdge types.

// Workflow Execution Status Update (Represents overall workflow state)
export interface WorkflowExecutionStatus {
  workflowId: string; // Or some identifier for the execution instance
  status: ExecutionStatus; // Use imported ExecutionStatus enum
  startTime?: number;
  endTime?: number;
  error?: string;
  // Could include progress percentage, etc.
}

// --- WebSocket Message Types ---

export enum WebSocketMessageType {
  // Client -> Server (根据 workflow-execution-plan.md V3 调整)
  PROMPT_REQUEST = 'PROMPT_REQUEST', // 提交完整工作流执行
  EXECUTE_PREVIEW_REQUEST = 'EXECUTE_PREVIEW_REQUEST', // 请求预览执行
  // EXECUTE_WORKFLOW = 'execute_workflow', // 旧的执行请求，保留或移除？暂时注释掉
  BUTTON_CLICK = 'button_click', // For triggering actions via button widgets
  LOAD_WORKFLOW = 'load_workflow', // Request to load a specific workflow
  SAVE_WORKFLOW = 'save_workflow', // Request to save the current workflow
  LIST_WORKFLOWS = 'list_workflows', // Request list of saved workflows
  GET_NODE_DEFINITIONS = 'get_node_definitions', // Request available node types
  RELOAD_BACKEND = 'reload_backend', // Request backend reload (e.g., for new nodes)
  // 添加中断请求 (虽然设计文档放在 HTTP API，但 WebSocket 也可能需要)
  INTERRUPT_REQUEST = 'INTERRUPT_REQUEST',

  // Server -> Client (根据 workflow-execution-plan.md V3 调整)
  PROMPT_ACCEPTED_RESPONSE = 'PROMPT_ACCEPTED_RESPONSE', // 确认收到请求
  EXECUTION_STATUS_UPDATE = 'EXECUTION_STATUS_UPDATE', // 更新工作流整体状态
  NODE_EXECUTING = 'NODE_EXECUTING', // 节点开始执行
  NODE_PROGRESS = 'NODE_PROGRESS', // (可选) 节点进度
  NODE_COMPLETE = 'NODE_COMPLETE', // 节点完成 (包含预览和完整执行)
  NODE_ERROR = 'NODE_ERROR', // 节点出错
  // NODE_STATUS_UPDATE = 'node_status_update', // 旧的状态更新，保留或移除？暂时注释掉
  // WORKFLOW_STATUS_UPDATE = 'workflow_status_update', // 旧的状态更新，保留或移除？暂时注释掉
  EXECUTION_RESULT = 'execution_result', // Final result of a node or workflow
  WORKFLOW_LOADED = 'workflow_loaded', // Response to load_workflow
  WORKFLOW_SAVED = 'workflow_saved', // Confirmation of save_workflow
  WORKFLOW_LIST = 'workflow_list', // Response to list_workflows
  NODE_DEFINITIONS = 'node_definitions', // Response to get_node_definitions
  BACKEND_RELOADED = 'backend_reloaded', // Confirmation of backend reload
  ERROR = 'error', // General error message from backend
  NODES_RELOADED = 'NODES_RELOADED', // New: Server -> Client, nodes have been reloaded
}

// Specific Payload Types (Examples)
// Import the correct WorkflowExecutionPayload from the shared types
import type { WorkflowExecutionPayload } from './workflowExecution';

export interface ExecuteWorkflowPayload extends WorkflowExecutionPayload {
  // Any additional data needed to start execution
}

export interface ButtonClickPayload {
  nodeId: string; // 节点的唯一ID
  buttonName: string; // 节点内按钮的标识符 (通常是输入槽的key)
  workflowId?: string; // (可选) 按钮所在工作流的ID
  nodeType?: string; // (可选) 节点的类型 (e.g., 'RandomNumber')
  nodeDisplayName?: string; // (可选) 节点的显示名称 (e.g., '🎲随机数生成器')
}

export interface NodeStatusUpdatePayload extends NodeExecutionResult { }

export interface WorkflowStatusUpdatePayload extends WorkflowExecutionStatus { }

export interface ErrorPayload {
  message: string;
  details?: any;
}

export interface NodesReloadedPayload {
  success: boolean;
  message?: string;
  count?: number; // Optional: number of nodes reloaded
}

// Generic WebSocket Message Structure
export interface WebSocketMessage<T = any> {
  type: WebSocketMessageType;
  payload: T;
  // Optional: correlationId, timestamp, etc.
}

// --- Workflow Storage and Execution Structures ---

/**
 * Represents a node as stored in the database or file.
 * Uses Nano ID for unique identification.
 */
export interface WorkflowStorageNode {
  id: string; // Nano ID (e.g., 10 chars)
  type: string; // Node type identifier (e.g., 'RandomNumberNode')
  position: { x: number; y: number }; // Position on the canvas
  size?: { width: number; height: number }; // Optional size override
  customLabel?: string; // Optional user-defined label for the node, overrides default display name
  customDescription?: string; // Optional user-defined description for the node, overrides default description
  customSlotDescriptions?: { inputs?: Record<string, string>, outputs?: Record<string, string> }; // Optional user-defined descriptions for specific slots on this node instance
  inputValues?: Record<string, any>; // Stored values for input slots (only if different from effective default)
  configValues?: Record<string, any>; // Stored values for node configuration
  // label?: string; // REMOVED: Replaced by customLabel for clarity
}

/**
 * Represents an edge as stored in the database or file.
 * Uses Nano ID for unique identification and references.
 */
export interface WorkflowStorageEdge {
  id: string; // Nano ID (e.g., 10 chars)
  source: string; // Nano ID of the source node
  target: string; // Nano ID of the target node
  sourceHandle: string; // ID of the source handle/slot
  targetHandle: string; // ID of the target handle/slot
  label?: string; // Optional label for the edge (added to fix TS2339)
}

// Define GroupSlotInfo based on the Zod schema in schemas.ts
export interface GroupSlotInfo {
  key: string;
  displayName: string;
  dataFlowType: DataFlowTypeName; // Specifies the data flow type (e.g., 'DATA_FLOW_STRING', 'DATA_FLOW_IMAGE')
  // description?: string; // REMOVED: Default description should be derived from the internal node's slot definition
  customDescription?: string; // Optional user-defined description for this specific group interface slot
  required?: boolean;
  config?: Record<string, any>;
  matchCategories?: string[]; // Optional. For input slots, specifies compatible categories of data types. For outputs, declares its categories.
  multi?: boolean;
  allowDynamicType?: boolean;
  min?: number;
  max?: number;
}

/**
 * Represents the complete workflow structure for storage.
 */
export interface WorkflowStorageObject {
  // Existing fields like name, description, viewport should be preserved if they exist elsewhere
  // For now, focusing on the core structure based on the new types
  name?: string; // Workflow name remains
  // description?: string; // REMOVED: Node description handled by NodeDefinition or WorkflowStorageNode.customDescription
  viewport?: { x: number; y: number; zoom: number }; // Example viewport structure
  nodes: WorkflowStorageNode[];
  edges: WorkflowStorageEdge[];
  interfaceInputs?: Record<string, GroupSlotInfo>; // Added to fix TS2339
  interfaceOutputs?: Record<string, GroupSlotInfo>; // Added to fix TS2339
  referencedWorkflows?: string[]; // Add missing referencedWorkflows property
  // Add other top-level metadata as needed
}

// Removed ExecutionNode, ExecutionEdge, and WorkflowExecutionPayload interfaces
// as they are now defined in workflowExecution.ts and exported via index.ts
// /**
//  * Represents a node specifically for the execution payload.
//  * Contains only the necessary information for the backend execution engine.
//  */
// export interface ExecutionNode { ... }

// /**
//  * Represents an edge specifically for the execution payload.
//  */
// export interface ExecutionEdge { ... }

// /**
//  * Payload sent to the backend to initiate workflow execution.
//  * Contains the minimal graph structure needed for execution.
//  */
// export interface WorkflowExecutionPayload { ... }
