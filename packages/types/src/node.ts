import { z } from "zod";
import type { NodeInputAction } from "./schemas";
import { DataFlowType, type DataFlowTypeName, BuiltInSocketMatchCategory, type ChunkPayload, type ExecutionStatus } from "./common";

// --- Group Slot and Interface Schemas ---

/**
 * Schema 定义：节点组插槽（输入/输出）的详细信息。
 */
export const GroupSlotInfoSchema = z.object({
  /** 插槽的唯一标识符 */
  key: z.string(),
  /** 自定义描述信息 */
  customDescription: z.string().optional(),
  /** 是否为必需插槽 */
  required: z.boolean().optional(),
  /** 插槽的配置选项 */
  config: z.record(z.any()).optional(),
  /** 是否允许多个连接（仅用于输入插槽） */
  multi: z.boolean().optional(),
  /** 数值类型的最小值 */
  min: z.number().optional(),
  /** 数值类型的最大值 */
  max: z.number().optional(),
}).merge(z.object({
  displayName: z.string().optional(),
  dataFlowType: z.enum(Object.values(DataFlowType) as [DataFlowTypeName, ...DataFlowTypeName[]]),
  isStream: z.boolean().optional(),
  matchCategories: z.array(z.string()).optional(),
  allowDynamicType: z.boolean().optional(),
  hideHandle: z.boolean().optional(),
}));
/** 类型推断：节点组插槽的详细信息 */
export type GroupSlotInfo = z.infer<typeof GroupSlotInfoSchema>;


// --- Input Options Schemas ---

// 基础输入选项
export const zBaseInputOptions = z.object({
  tooltip: z.string().optional(),
  hidden: z.boolean().optional(),
  showReceivedValue: z.boolean().optional(),
});

// 数值输入选项
export const zNumericInputOptions = zBaseInputOptions.extend({
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  default: z.number().optional(),
  suggestions: z.array(z.number()).optional(),
});

// 字符串输入选项
export const zStringInputOptions = zBaseInputOptions.extend({
  default: z.string().optional(),
  multiline: z.boolean().optional(),
  placeholder: z.string().optional(),
  display_only: z.boolean().optional(),
  suggestions: z.array(z.string()).optional(),
});

// 布尔输入选项
export const zBooleanInputOptions = zBaseInputOptions.extend({
  default: z.boolean().optional(),
});

// 组合框选项 (下拉选择)
export const zComboInputOptions = zBaseInputOptions.extend({
  suggestions: z.array(z.union([z.string(), z.number()])).optional(),
  default: z.union([z.string(), z.number()]).optional(),
});

// 代码输入选项 (用于代码编辑器)
export const zCodeInputOptions = zBaseInputOptions.extend({
  default: z.string().optional(),
  language: z.string().optional(),
  placeholder: z.string().optional(),
});

// 按钮输入选项
export const zButtonInputOptions = zBaseInputOptions.extend({
  label: z.string().optional(),
});

// 自定义类型选项
export const zCustomInputOptions = zBaseInputOptions;

// 类型导出 (从Zod Schema推断)
export type BaseInputOptions = z.infer<typeof zBaseInputOptions>;
export type NumericInputOptions = z.infer<typeof zNumericInputOptions>;
export type StringInputOptions = z.infer<typeof zStringInputOptions>;
export type BooleanInputOptions = z.infer<typeof zBooleanInputOptions>;
export type ComboInputOptions = z.infer<typeof zComboInputOptions>;
export type CodeInputOptions = z.infer<typeof zCodeInputOptions>;
export type ButtonInputOptions = z.infer<typeof zButtonInputOptions>;
export type CustomInputOptions = z.infer<typeof zCustomInputOptions>;


// --- Node and Slot Interfaces ---

// 基础插槽定义接口
export interface SlotDefinitionBase {
  displayName?: string;
  dataFlowType: DataFlowTypeName;
  isStream?: boolean;
  matchCategories?: string[];
  allowDynamicType?: boolean;
  hideHandle?: boolean;
}

// 输入定义
export interface InputDefinition extends SlotDefinitionBase {
  description?: string;
  required?: boolean | ((configValues: Record<string, any>) => boolean);
  config?: Record<string, any>;
  multi?: boolean;
  actions?: NodeInputAction[];
  allowMoreConnections?: boolean;
  maxConnections?: number;
}

// 输出定义
export interface OutputDefinition extends SlotDefinitionBase {
  description?: string;
}

/**
 * 用于在前端显示插槽的聚合类型，确保 key 总是存在。
 */
export type DisplaySlotInfo = (InputDefinition | OutputDefinition) & { key: string };
export type DisplayInputSlotInfo = InputDefinition & { key: string };
export type DisplayOutputSlotInfo = OutputDefinition & { key: string };

/**
 * 绕过行为定义
 */
export interface BypassBehavior {
  passThrough?: Record<string, string>;
  defaults?: Record<string, any>;
}

/**
 * 节点模式定义，用于支持多模式节点
 */
export interface NodeModeDefinition {
  /** 模式的唯一标识符 */
  id: string;
  /** 模式的显示名称 */
  displayName: string;
  /** 模式的描述 */
  description?: string;
  /** 该模式下的输入插槽定义 */
  inputs: Record<string, InputDefinition>;
  /** 该模式下的输出插槽定义 */
  outputs: Record<string, OutputDefinition>;
  /** 该模式特有的配置模式 */
  configSchema?: Record<string, InputDefinition>;
  /** 该模式的执行函数，如果不提供则使用节点的主执行函数 */
  execute?: (
    inputs: Record<string, any>,
    context?: any
  ) =>
    | Promise<Record<string, any>>
    | AsyncGenerator<ChunkPayload, Record<string, any> | void, undefined>;
}

// 节点定义
export interface NodeDefinition {
  type: string;
  namespace?: string; // 节点的顶层命名空间，用于区别归属于哪个插件或是内部节点库，类似于 minecraft:air 的 minecraft 部分
  category: string;
  displayName: string;
  description: string;
  inputs: Record<string, InputDefinition>;
  outputs: Record<string, OutputDefinition>;
  execute?: (
    inputs: Record<string, any>,
    context?: any
  ) =>
    | Promise<Record<string, any>>
    | AsyncGenerator<ChunkPayload, Record<string, any> | void, undefined>;
  clientScriptUrl?: string;
  filePath?: string;
  deprecated?: boolean;
  experimental?: boolean;
  width?: number;
  isGroupInternal?: boolean;
  groupId?: string;
  groupConfig?: {
    allowExternalUse?: boolean;
    dynamicPorts?: boolean;
  };
  dynamicSlots?: boolean;
  configSchema?: Record<string, InputDefinition>;
  configValues?: Record<string, any>;
  isPreviewUnsafe?: boolean;
  bypassBehavior?: "mute" | BypassBehavior;
  /** 节点的多模式定义，如果提供，则节点支持多种操作模式 */
  modes?: Record<string, NodeModeDefinition>;
  /** 默认的模式ID，如果节点支持多模式，则必须提供 */
  defaultModeId?: string;
  /** 如果节点支持多模式，此字段指定哪个 configSchema 键是模式选择器 */
  modeConfigKey?: string;
}

// 节点执行上下文
export interface NodeExecutionContext {
  nodeId: string;
  inputs: Record<string, any>;
}

// 节点执行结果
export interface NodeExecutionResult {
  nodeId: string;
  status: ExecutionStatus;
  outputs?: Record<string, any>;
  error?: string;
  startTime?: number;
  endTime?: number;
}

// --- Validation ---

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
        schema = zComboInputOptions;
      } else {
        schema = zStringInputOptions;
      }
      break;
    case DataFlowType.WILDCARD:
      if (matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER)) {
        schema = zButtonInputOptions;
      } else {
        schema = zCustomInputOptions;
      }
      break;
    default:
      schema = zCustomInputOptions;
  }

  const result = schema.safeParse(options);
  if (!result.success) {
    console.warn(`数据流类型 ${dataFlowType} 的输入选项无效:`, result.error.format());
    return null;
  }
  return result.data;
}
