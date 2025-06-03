import { z } from "zod";
import type { DataFlowTypeName, GroupSlotInfo, NodeInputAction } from "./schemas"; // 导入 GroupSlotInfo 和 NodeInputAction
import { BuiltInSocketMatchCategory, DataFlowType } from "./schemas";

// 基础输入选项
export const zBaseInputOptions = z.object({
  tooltip: z.string().optional(), // 提示信息
  hidden: z.boolean().optional(), // 是否隐藏
  showReceivedValue: z.boolean().optional(), // 连接后是否显示接收到的值
});

// 数值输入选项
export const zNumericInputOptions = zBaseInputOptions.extend({
  min: z.number().optional(), // 最小值
  max: z.number().optional(), // 最大值
  step: z.number().optional(), // 步长
  default: z.number().optional(), // 默认值
  suggestions: z.array(z.number()).optional(), // 提供建议值列表
});

// 字符串输入选项
export const zStringInputOptions = zBaseInputOptions.extend({
  default: z.string().optional(), // 默认值
  multiline: z.boolean().optional(), // 是否支持多行输入
  placeholder: z.string().optional(), // 占位提示符
  display_only: z.boolean().optional(), // 指示是否使用只读的TextDisplay组件
  suggestions: z.array(z.string()).optional(), // 提供建议值列表
});

// 布尔输入选项
export const zBooleanInputOptions = zBaseInputOptions.extend({
  default: z.boolean().optional(), // 默认值
});

// 组合框选项 (下拉选择)
export const zComboInputOptions = zBaseInputOptions.extend({
  suggestions: z.array(z.union([z.string(), z.number()])).optional(), // 建议选项列表
  default: z.union([z.string(), z.number()]).optional(), // 默认值
});

// 代码输入选项 (用于代码编辑器)
export const zCodeInputOptions = zBaseInputOptions.extend({
  default: z.string().optional(), // 默认代码内容
  language: z.string().optional(), // 编程语言 (例如: 'javascript', 'json', 'python')
  placeholder: z.string().optional(), // 占位提示符
});

// 按钮输入选项
export const zButtonInputOptions = zBaseInputOptions.extend({
  label: z.string().optional(), // 按钮上显示的文本
});

// 自定义类型选项 (保持基础，用于未知或特殊类型)
export const zCustomInputOptions = zBaseInputOptions;

// 基础插槽定义接口，包含所有插槽类型共有的属性
export interface SlotDefinitionBase {
  displayName?: string; // UI 显示名称 (优先用于前端展示)
  dataFlowType: DataFlowTypeName; // 数据流类型
  matchCategories?: string[]; // 匹配类别，用于类型检查和连接建议
  allowDynamicType?: boolean; // 标记该插槽是否支持从 'ANY' 动态变为具体类型
  hideHandle?: boolean; // 是否隐藏连接点 (Handle)
}

// 输入定义
export interface InputDefinition extends SlotDefinitionBase {
  description?: string; // 插槽详细描述 (用于tooltip等)
  required?: boolean | ((configValues: Record<string, any>) => boolean); // 是否必需 (可为布尔值或函数，用于条件性必需)
  config?: Record<string, any>; // 输入控件的特定配置 (例如 min, max, step for number)
  multi?: boolean; // 标记是否支持多输入连接
  actions?: NodeInputAction[]; // 定义输入槽旁边的操作按钮
}

// 输出定义
export interface OutputDefinition extends SlotDefinitionBase {
  description?: string; // 插槽详细描述 (用于tooltip等)
}

/**
 * 绕过行为定义，用于指定节点在被绕过时的行为。
 */
export interface BypassBehavior {
  /** 输出键到输入键的映射，用于指定伪输出如何从输入获取值 */
  passThrough?: Record<string, string>;
  /** 输出键到默认值的映射，用于指定无法从输入获取值时的默认值 */
  defaults?: Record<string, any>;
}

// 节点定义
export interface NodeDefinition {
  type: string; // 节点的基本类型名称 (例如: 'MergeNode')
  namespace?: string; // 节点的命名空间/来源 (可选)
  category: string; // 功能分类 (例如: 'Logic', 'IO/Group')
  displayName: string; // 节点显示名称
  description: string; // 节点描述
  inputs: Record<string, InputDefinition>; // 输入插槽定义
  outputs: Record<string, OutputDefinition>; // 输出插槽定义
  execute?: (inputs: Record<string, any>, context?: any) => Promise<Record<string, any>>; // 节点执行函数 (可选)
  clientScriptUrl?: string; // 用于加载客户端逻辑的URL (可选)
  filePath?: string; // 加载此节点定义的文件绝对路径 (可选)
  deprecated?: boolean; // 是否已弃用
  experimental?: boolean; // 是否为实验性功能
  width?: number; // 允许节点定义指定自己的首选宽度

  // 组节点相关属性
  isGroupInternal?: boolean; // 标记节点是否只能在组内部使用
  groupId?: string; // 节点所属的组ID
  groupConfig?: {
    // 组相关配置
    allowExternalUse?: boolean; // 是否允许在组外使用
    dynamicPorts?: boolean; // 是否支持动态端口 (旧，考虑移除或重命名)
  };
  dynamicSlots?: boolean; // 标记节点是否支持动态添加/删除插槽 (例如 GroupInput/Output)
  configSchema?: Record<string, InputDefinition>; // 用于定义节点级别配置项，其结构与输入类似
  configValues?: Record<string, any>; // 用于存储节点配置项的实际值
  isPreviewUnsafe?: boolean; // 标记节点在预览模式下是否不安全 (默认为 false/安全)
  bypassBehavior?: "mute" | BypassBehavior; // 节点在被绕过时的行为 ("mute" 表示静默，或自定义行为)
}

// API设置类型
export interface APISettings {
  use_env_vars: boolean; // 是否使用环境变量
  base_url: string; // API基础URL
  api_key: string; // API密钥
}

// 类型导出 (从Zod Schema推断)
export type BaseInputOptions = z.infer<typeof zBaseInputOptions>;
export type NumericInputOptions = z.infer<typeof zNumericInputOptions>;
export type StringInputOptions = z.infer<typeof zStringInputOptions>;
export type BooleanInputOptions = z.infer<typeof zBooleanInputOptions>;
export type ComboInputOptions = z.infer<typeof zComboInputOptions>;
export type CodeInputOptions = z.infer<typeof zCodeInputOptions>;
export type ButtonInputOptions = z.infer<typeof zButtonInputOptions>;
export type CustomInputOptions = z.infer<typeof zCustomInputOptions>;

// 验证输入选项的函数
export function validateInputOptions(
  dataFlowType: DataFlowTypeName,
  options: any,
  matchCategories?: string[]
): BaseInputOptions | null {
  let schema;
  switch (dataFlowType) {
    case DataFlowType.INTEGER:
    case DataFlowType.FLOAT:
      schema = zNumericInputOptions;
      break;
    case DataFlowType.BOOLEAN:
      schema = zBooleanInputOptions;
      break;
    case DataFlowType.STRING:
      if (matchCategories?.includes(BuiltInSocketMatchCategory.CODE)) {
        schema = zCodeInputOptions;
      } else if (options?.suggestions && Array.isArray(options.suggestions)) {
        // 如果有 suggestions 数组，则认为是 Combo 类型
        schema = zComboInputOptions;
      } else {
        schema = zStringInputOptions;
      }
      break;
    case DataFlowType.WILDCARD: // 通配符类型
      if (matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER)) {
        // 如果是触发器类别，则使用按钮选项
        schema = zButtonInputOptions;
      } else {
        // 否则默认为自定义选项
        schema = zCustomInputOptions;
      }
      break;
    case DataFlowType.OBJECT:
    case DataFlowType.ARRAY:
    case DataFlowType.BINARY:
    case DataFlowType.CONVERTIBLE_ANY:
      // 这些类型目前使用自定义/基础选项
      schema = zCustomInputOptions;
      break;
    default:
      // 未知数据流类型，使用自定义选项作为后备
      schema = zCustomInputOptions;
  }

  const result = schema.safeParse(options);
  if (!result.success) {
    // 使用 result.error.format() 以获得更清晰的错误输出
    console.warn(`数据流类型 ${dataFlowType} 的输入选项无效:`, result.error.format());
    return null;
  }
  return result.data;
}

// --- 执行相关类型 ---

// 节点执行上下文
export interface NodeExecutionContext {
  nodeId: string; // 节点ID
  inputs: Record<string, any>; // 已解析的输入值
  // workflowContext?: WorkflowExecutionContext; // (可选) 工作流级别的上下文
}

// 节点执行结果
// 从共享类型导入 ExecutionStatus 枚举
import { ExecutionStatus } from "./workflowExecution";

export interface NodeExecutionResult {
  nodeId: string; // 节点ID
  status: ExecutionStatus; // 执行状态 (使用导入的 ExecutionStatus 枚举)
  outputs?: Record<string, any>; // 输出值 (如果状态为 COMPLETED)
  error?: string; // 错误信息 (如果状态为 ERROR)
  startTime?: number; // 执行开始时间戳
  endTime?: number; // 执行结束时间戳
}

// 工作流执行状态更新 (表示工作流的整体状态)
export interface WorkflowExecutionStatus {
  workflowId: string; // 工作流ID或执行实例的标识符
  status: ExecutionStatus; // 执行状态 (使用导入的 ExecutionStatus 枚举)
  startTime?: number; // 开始时间戳
  endTime?: number; // 结束时间戳
  error?: string; // 错误信息
  // 可以包含进度百分比等其他信息
}

// --- WebSocket 消息类型 ---

export enum WebSocketMessageType {
  // 客户端 -> 服务端 (根据 workflow-execution-plan.md V3 调整)
  PROMPT_REQUEST = "PROMPT_REQUEST", // 提交完整工作流执行
  EXECUTE_PREVIEW_REQUEST = "EXECUTE_PREVIEW_REQUEST", // 请求预览执行
  BUTTON_CLICK = "button_click", // 通过按钮小部件触发操作
  LOAD_WORKFLOW = "load_workflow", // 请求加载特定工作流
  SAVE_WORKFLOW = "save_workflow", // 请求保存当前工作流
  LIST_WORKFLOWS = "list_workflows", // 请求已保存的工作流列表
  GET_NODE_DEFINITIONS = "get_node_definitions", // 请求可用的节点类型
  RELOAD_BACKEND = "reload_backend", // 请求后端重新加载 (例如，用于新节点)
  INTERRUPT_REQUEST = "INTERRUPT_REQUEST", // 中断执行请求

  // 服务端 -> 客户端 (根据 workflow-execution-plan.md V3 调整)
  PROMPT_ACCEPTED_RESPONSE = "PROMPT_ACCEPTED_RESPONSE", // 确认收到执行请求
  EXECUTION_STATUS_UPDATE = "EXECUTION_STATUS_UPDATE", // 更新工作流整体状态
  NODE_EXECUTING = "NODE_EXECUTING", // 节点开始执行
  NODE_PROGRESS = "NODE_PROGRESS", // (可选) 节点执行进度
  NODE_COMPLETE = "NODE_COMPLETE", // 节点完成 (包含预览和完整执行)
  NODE_ERROR = "NODE_ERROR", // 节点执行出错
  EXECUTION_RESULT = "execution_result", // 节点或工作流的最终执行结果
  WORKFLOW_LOADED = "workflow_loaded", // 对 load_workflow 的响应
  WORKFLOW_SAVED = "workflow_saved", // 对 save_workflow 的确认
  WORKFLOW_LIST = "workflow_list", // 对 list_workflows 的响应
  NODE_DEFINITIONS = "node_definitions", // 对 get_node_definitions 的响应
  BACKEND_RELOADED = "backend_reloaded", // 对 backend_reload 的确认
  ERROR = "error", // 来自后端的通用错误消息
  NODES_RELOADED = "NODES_RELOADED", // 新增: 服务端 -> 客户端, 通知节点已重新加载
}

// 特定的负载类型 (示例)
// 从共享类型导入正确的 WorkflowExecutionPayload
import type { WorkflowExecutionPayload } from "./workflowExecution";

export interface ExecuteWorkflowPayload extends WorkflowExecutionPayload {
  // 启动执行所需的任何附加数据
}

export interface ButtonClickPayload {
  nodeId: string; // 节点的唯一ID
  buttonName: string; // 节点内按钮的标识符 (通常是输入槽的key)
  workflowId?: string; // (可选) 按钮所在工作流的ID
  nodeType?: string; // (可选) 节点的类型 (例如: 'RandomNumber')
  nodeDisplayName?: string; // (可选) 节点的显示名称 (例如: '🎲随机数生成器')
}

export interface NodeStatusUpdatePayload extends NodeExecutionResult {}

export interface WorkflowStatusUpdatePayload extends WorkflowExecutionStatus {}

export interface ErrorPayload {
  message: string; // 错误消息
  details?: any; // 详细信息 (可选)
}

export interface NodesReloadedPayload {
  success: boolean; // 是否成功
  message?: string; // 消息 (可选)
  count?: number; // 重新加载的节点数量 (可选)
}

// 通用 WebSocket 消息结构
export interface WebSocketMessage<T = any> {
  type: WebSocketMessageType; // 消息类型
  payload: T; // 消息负载
  // correlationId?: string; // 关联ID (可选)
  // timestamp?: number; // 时间戳 (可选)
}

// --- 工作流存储和执行结构 ---

/**
 * 表示存储在数据库或文件中的节点。
 * 使用 Nano ID 进行唯一标识。
 */
export interface WorkflowStorageNode {
  id: string; // Nano ID (例如: 10个字符)
  type: string; // 节点类型标识符 (例如: 'RandomNumberNode')
  position: { x: number; y: number }; // 在画布上的位置
  size?: { width: number; height: number }; // (可选) 尺寸覆盖
  displayName?: string; // (可选) 用户为节点定义的标签，覆盖默认显示名称
  customDescription?: string; // (可选) 用户为节点定义的描述，覆盖默认描述
  customSlotDescriptions?: { inputs?: Record<string, string>; outputs?: Record<string, string> }; // (可选) 用户为此节点实例上特定插槽定义的描述
  inputValues?: Record<string, any>; // 输入插槽的存储值 (仅当与有效默认值不同时)
  configValues?: Record<string, any>; // 节点配置项的存储值
  /**
   * 可选属性，用于存储连接到此节点输入句柄的边的有序列表。
   * key 是输入句柄的 ID (inputHandleId)。
   * value 是一个字符串数组，表示连接到该输入句柄的边的 ID (edgeId) 的有序列表。
   */
  inputConnectionOrders?: Record<string, string[]>;
}

/**
 * 表示存储在数据库或文件中的边。
 * 使用 Nano ID 进行唯一标识和引用。
 */
export interface WorkflowStorageEdge {
  id: string; // Nano ID (例如: 10个字符)
  source: string; // 源节点的 Nano ID
  target: string; // 目标节点的 Nano ID
  sourceHandle: string; // 源句柄/插槽的 ID
  targetHandle: string; // 目标句柄/插槽的 ID
  label?: string; // (可选) 边的标签
}

// GroupSlotInfo 接口已从 schemas.ts 导入，此处移除重复定义。
// 原定义从 line 330 到 342。

/**
 * 表示用于存储的完整工作流结构。
 */
export interface WorkflowStorageObject {
  name?: string; // 工作流名称
  viewport?: { x: number; y: number; zoom: number }; // 视口信息 (例如位置和缩放)
  nodes: WorkflowStorageNode[]; // 节点列表
  edges: WorkflowStorageEdge[]; // 边列表
  interfaceInputs?: Record<string, GroupSlotInfo>; // 工作流的输入接口定义
  interfaceOutputs?: Record<string, GroupSlotInfo>; // 工作流的输出接口定义
  referencedWorkflows?: string[]; // 引用的其他工作流ID列表
  // 可根据需要添加其他顶层元数据
}
