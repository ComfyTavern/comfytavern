import { z } from 'zod';

// --- 流式处理核心类型 ---

/**
 * 定义流式数据块的内容。
 * 参考: DesignDocs/architecture/streaming-functionality-plan.md
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

// New type definitions as per task SLOT_TYPE_REFACTOR_1_1
// Inserted after 'import { z } from "zod";'

export const DataFlowType = {
  STRING: "STRING",
  INTEGER: "INTEGER",
  FLOAT: "FLOAT",
  BOOLEAN: "BOOLEAN",
  OBJECT: "OBJECT",
  ARRAY: "ARRAY",
  BINARY: "BINARY",
  /** 新增：代表一个数据流 */
  STREAM: "STREAM",
  WILDCARD: "WILDCARD",
  CONVERTIBLE_ANY: "CONVERTIBLE_ANY",
} as const;

export type DataFlowTypeName = (typeof DataFlowType)[keyof typeof DataFlowType];

// 来自: memory-bank/schema-design-notes.md
export const BuiltInSocketMatchCategory = {
  // 语义化/内容特征标签 (V3 精简命名)
  CODE: "Code",
  JSON: "Json",
  MARKDOWN: "Markdown",
  URL: "Url",
  FILE_PATH: "FilePath",
  PROMPT: "Prompt",
  CHAT_MESSAGE: "ChatMessage",
  CHAT_HISTORY: "ChatHistory",
  LLM_CONFIG: "LlmConfig",
  LLM_OUTPUT: "LlmOutput",
  VECTOR_EMBEDDING: "VectorEmbedding",
  CHARACTER_PROFILE: "CharacterProfile",
  IMAGE_DATA: "ImageData",
  AUDIO_DATA: "AudioData",
  VIDEO_DATA: "VideoData",
  RESOURCE_ID: "ResourceId",
  TRIGGER: "Trigger",
  STREAM_CHUNK: "StreamChunk",
  COMBO_OPTION: "ComboOption",
  REGEX_RULE_ARRAY: "RegexRuleArray", // ++ 新增，用于标记 RegexRule[] 类型
  /** 标记此输入组件应作为“大块”或“块级”元素渲染，而不是行内紧凑型 */
  UI_BLOCK: "UiBlock",

  // 新增用于操作提示的类别
  /** 标记此输入支持标准的内联预览操作按钮 */
  CanPreview: "CanPreview",
  /** 标记此输入不应显示其类型的默认编辑操作按钮 (如果其类型通常有默认编辑按钮) */
  NoDefaultEdit: "NoDefaultEdit",

  // 行为标签
  BEHAVIOR_WILDCARD: "BehaviorWildcard",
  BEHAVIOR_CONVERTIBLE: "BehaviorConvertible",
} as const;

export type BuiltInSocketMatchCategoryName = (typeof BuiltInSocketMatchCategory)[keyof typeof BuiltInSocketMatchCategory];

// RegexRule 相关的类型和 Schema
export interface RegexRule {
  name: string; // 规则名称，用于显示、排序和去重
  pattern: string; // 正则表达式字符串
  replacement: string; // 替换字符串
  flags?: string; // 正则标志 (e.g., 'g', 'i', 'm')
  description?: string; // 规则描述 (可选)
  enabled?: boolean; // 规则是否启用
}

export const RegexRuleSchema = z.object({
  name: z.string().min(1, { message: "规则名称不能为空" }),
  pattern: z.string().min(1, { message: "正则表达式不能为空" }),
  replacement: z.string(), // 替换字符串允许为空
  flags: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional().default(true), // 默认为 true
});

export const RegexRuleArraySchema = z.array(RegexRuleSchema);


// ... (其他不变的导入和类型定义)

/**
 * Schema 定义：节点输入操作按钮的配置
 */
export const NodeInputActionSchema = z.object({
  /**
   * 唯一ID，用于标识操作。
   * 也用于覆盖标准操作，例如，如果此ID为 'standard_preview'，则此定义将覆盖默认的预览按钮。
   */
  id: z.string(),
  /**
   * 图标名称 (推荐使用 Heroicons v2 outline 样式的图标名称，小驼峰格式, e.g., 'eye', 'pencilSquare', 'codeBracket')。
   * 可选。如果未提供，新组件 NodeInputActionsBar.vue 会尝试根据 handlerType 或 id 提供一个默认图标。
   */
  icon: z.string().optional(),
  /** 按钮上显示的文本标签，与 icon 二选一或共存 */
  label: z.string().optional(),
  /** 按钮的 Tooltip 提示文本 */
  tooltip: z.string().optional(),
  /**
   * 操作的处理方式:
   * - 'builtin_preview': 使用 BaseNode 内置的 Tooltip 预览逻辑。
   * - 'builtin_editor': 使用 BaseNode 内置的 openEditorForInput 方法打开编辑器。
   * - 'emit_event': BaseNode 会发出一个自定义事件，由外部处理。
   * - 'client_script_hook': 调用节点客户端脚本中定义的特定钩子函数。
   * - 'open_panel': 触发打开一个指定的侧边栏面板或弹窗。
   */
  handlerType: z.enum(['builtin_preview', 'builtin_editor', 'emit_event', 'client_script_hook', 'open_panel']),
  /**
   * 传递给处理程序的参数，具体结构取决于 handlerType。例如：
   * - for 'builtin_editor': { editorType?: 'default' | 'json' | 'markdown' | 'code' | string (custom_id), languageHint?: string, preferFloatingEditor?: boolean }
   * - for 'open_panel': { panelId: string, panelTitle?: string, initialValue?: any, context?: any }
   * - for 'emit_event': { eventName: string, eventPayload?: any }
   * - for 'client_script_hook': { hookName: string, hookPayload?: any }
   */
  handlerArgs: z.record(z.any()).optional(),
});
export type NodeInputAction = z.infer<typeof NodeInputActionSchema>;

/**
 * 定义节点插槽（Socket）的类型。
 * 使用常量对象模拟枚举，以便在 Zod Schema 中使用。
 */
// Removed SocketType as per task SLOT_TYPE_REFACTOR_1_1.
// The old SocketType definition was from line 7 to 26.

/**
 * Schema 定义：节点组插槽（输入/输出）的详细信息。
 * 继承 SlotDefinitionBase 的属性。
 */
export const GroupSlotInfoSchema = z.object({
  /** 插槽的唯一标识符 */
  key: z.string(),
  /** 自定义描述信息 */
  customDescription: z.string().optional(),
  /** 是否为必需插槽 */
  required: z.boolean().optional(),
  /** 插槽的配置选项（例如，下拉框的选项列表） */
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
  matchCategories: z.array(z.string()).optional(),
  allowDynamicType: z.boolean().optional(),
  hideHandle: z.boolean().optional(), // 是否隐藏连接点 (Handle)
}));
/** 类型推断：节点组插槽的详细信息 */
export type GroupSlotInfo = z.infer<typeof GroupSlotInfoSchema>;

/**
 * Schema 定义：节点组的接口信息，包含输入和输出插槽。
 */
export const GroupInterfaceInfoSchema = z.object({
  /** 输入插槽定义，键为插槽 key */
  inputs: z.record(GroupSlotInfoSchema).optional(),
  /** 输出插槽定义，键为插槽 key */
  outputs: z.record(GroupSlotInfoSchema).optional()
});
/** 类型推断：节点组接口信息 */
export type GroupInterfaceInfo = z.infer<typeof GroupInterfaceInfoSchema>;


/**
 * Schema 定义：VueFlow 节点的位置坐标。
 */
export const PositionSchema = z.object({
  /** X 坐标 */
  x: z.number(),
  /** Y 坐标 */
  y: z.number(),
});

/**
 * Schema 定义：单个组件的状态（例如，节点内部某个 UI 组件的高度）。
 * 这是可选的，允许组件没有状态记录。
 */
const ComponentStateSchema = z.object({
  /** 组件的高度 */
  height: z.number().optional(),
  // 可以添加其他组件特定的状态
}).optional();

/**
 * Schema 定义：节点内所有组件状态的集合。
 * 整个 componentStates 也是可选的。
 */
const ComponentStatesSchema = z.record(ComponentStateSchema).optional();

/**
 * Schema 定义：工作流节点的数据 (data) 字段。
 * 使用 z.intersection 结合 z.record(z.any()) 和 componentStates，
 * 以保持灵活性，适应不同节点类型的数据结构，并允许存储组件状态。
 * 未来可考虑使用可辨识联合类型 (discriminated union) 基于节点 'type' 来提供更严格的类型检查。
 * 整个 data 对象仍然是可选的。
 */
export const WorkflowNodeDataSchema = z.intersection(
  /** 保留原始的灵活性以适应各种节点数据 */
  z.record(z.any()),
  z.object({
    /** 存储节点内部组件的状态 */
    componentStates: ComponentStatesSchema
  })
).optional();

/**
 * Schema 定义：NodeGroup 类型节点的特定数据。
 */
export const NodeGroupDataSchema = z.object({
  /** 节点类型，固定为 'NodeGroup' */
  nodeType: z.literal('NodeGroup'),
  /** 节点标签 */
  label: z.string().optional(),
  /** 引用的子工作流的 ID */
  referencedWorkflowId: z.string(),
  /** 节点组的接口信息快照 */
  groupInterface: GroupInterfaceInfoSchema.optional(),
  /** 节点组本身的配置值 */
  configValues: z.record(z.any()).optional()
});
/** 类型推断：NodeGroup 节点数据 */
export type NodeGroupData = z.infer<typeof NodeGroupDataSchema>;


/**
 * Schema 定义：自定义插槽描述。
 */
export const CustomSlotDescriptionsSchema = z.object({
  inputs: z.record(z.string()).optional(),
  outputs: z.record(z.string()).optional(),
}).optional();
export type CustomSlotDescriptions = z.infer<typeof CustomSlotDescriptionsSchema>;

/**
 * Schema 定义：工作流中的节点。
 */
export const WorkflowNodeSchema = z.object({
  /** 节点的唯一 ID */
  id: z.string(),
  /** 节点的类型标识符（例如 'core/RandomNumberNode' 或 'NodeGroup'） */
  type: z.string(),
  /** 节点在画布上的位置 */
  position: PositionSchema,
  /**
   * 节点的数据负载。
   * 使用 WorkflowNodeDataSchema，当前允许任意数据与组件状态。
   * 对于 NodeGroup 类型，其 data 字段应符合 NodeGroupDataSchema。
   * 未来可改进为基于 'type' 的可辨识联合类型。
   */
  data: WorkflowNodeDataSchema,
  /** 节点的宽度 */
  width: z.number().optional(),
  /** 节点的高度 */
  height: z.number().optional(),
  /** 节点的层叠顺序 */
  zIndex: z.number().optional(),
  /**
   * 节点的标签。
   * 可能在前端根据节点类型或数据派生，但也允许直接存储。
   */
  label: z.string().optional(), // 旧的标签，可能仍用于某些向后兼容或特定场景
  /** 节点在界面上显示的名称，优先于 label */
  displayName: z.string().optional(),
  /** 节点的配置值 */
  configValues: z.record(z.any()).optional(),
  /** 节点的输入值（通常由连接或用户输入提供） */
  inputValues: z.record(z.any()).optional(),
  /** 存储多输入插槽的连接顺序，键为插槽的 key，值为连接到该插槽的边 ID 数组 */
  inputConnectionOrders: z.record(z.array(z.string())).optional().describe('多输入插槽的连接顺序'),
  /** 节点的自定义描述，会覆盖节点定义中的默认描述 */
  customDescription: z.string().optional(),
  /** 节点插槽的自定义描述，键为插槽名，值为描述文本 */
  customSlotDescriptions: CustomSlotDescriptionsSchema, // 使用上面定义的 schema
});
/** 类型推断：工作流节点 */
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;


/**
 * Schema 定义：VueFlow 边的末端标记 (MarkerEnd)。
 * 可以是简单的字符串类型（如 MarkerType.ArrowClosed），也可以是包含详细配置的对象。
 */
export const MarkerEndSchema = z.union([
  /** 简单的标记类型字符串，例如 MarkerType.ArrowClosed */
  z.string(),
  /** 包含详细配置的标记对象 */
  z.object({
    /** 标记类型字符串，例如 MarkerType.Arrow */
    type: z.string().optional(),
    /** 标记颜色 */
    color: z.string().optional(),
    /** 标记宽度 */
    width: z.number().optional(),
    /** 标记高度 */
    height: z.number().optional(),
    /** 标记单位 */
    markerUnits: z.string().optional(),
    /** 标记方向 */
    orient: z.string().optional(),
    /** 标记描边宽度 */
    strokeWidth: z.number().optional(),
  })
]).optional();


/**
 * Schema 定义：工作流边的附加数据 (data) 字段。
 * 当前使用 z.record(z.any()) 作为占位符，允许存储任意与边相关的附加数据。
 * 未来可根据需要进行细化。
 */
export const WorkflowEdgeDataSchema = z.record(z.any()).optional();

/**
 * Schema 定义：工作流中的边（连接）。
 */
export const WorkflowEdgeSchema = z.object({
  /** 边的唯一 ID */
  id: z.string(),
  /** 源节点的 ID */
  source: z.string(),
  /** 目标节点的 ID */
  target: z.string(),
  /** 源节点的句柄（插槽）ID，可以是可选或 null */
  sourceHandle: z.string().optional().nullable(),
  /** 目标节点的句柄（插槽）ID，可以是可选或 null */
  targetHandle: z.string().optional().nullable(),
  /** 边的类型（例如 'default', 'smoothstep'） */
  type: z.string().optional(),
  /** 边的标签 */
  label: z.string().optional(),
  /** 边的末端标记 */
  markerEnd: MarkerEndSchema,
  /** 边的附加数据 */
  data: WorkflowEdgeDataSchema,
});
/** 类型推断：工作流边 */
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;

/**
 * Schema 定义：工作流画布的视口信息（位置和缩放）。
 */
export const WorkflowViewportSchema = z.object({
  /** 视口的 X 坐标 */
  x: z.number(),
  /** 视口的 Y 坐标 */
  y: z.number(),
  /** 视口的缩放级别 */
  zoom: z.number(),
});
/** 类型推断：工作流视口 */
export type WorkflowViewport = z.infer<typeof WorkflowViewportSchema>;

/**
 * Schema 定义：基础工作流对象结构（不包含递归引用）。
 */
const BaseWorkflowObjectSchema = z.object({
  /**
   * 工作流的唯一 ID。
   * 可选，因为在创建时尚未分配 ID。
   */
  id: z.string().optional(),
  /** 工作流的名称，必需字段 */
  name: z.string({ required_error: "工作流名称是必需的", invalid_type_error: "工作流名称必须是字符串" }).min(1, "工作流名称不能为空"),
  /** 工作流的描述信息 */
  description: z.string().optional(),
  /** 工作流包含的节点列表 */
  nodes: z.array(WorkflowNodeSchema),
  /** 工作流包含的边列表 */
  edges: z.array(WorkflowEdgeSchema),
  /** 工作流画布的视口状态 */
  viewport: WorkflowViewportSchema,
  /**
   * 工作流创建时间。
   * 以 ISO 8601 字符串格式存储。
   */
  createdAt: z.string().datetime({ message: "无效的 createdAt 日期时间字符串" }).optional(),
  /**
   * 工作流最后更新时间。
   * 以 ISO 8601 字符串格式存储。
   */
  updatedAt: z.string().datetime({ message: "无效的 updatedAt 日期时间字符串" }).optional(),
  /** 工作流的版本号 */
  version: z.string().optional(),
  /** 工作流的外部输入接口定义 */
  interfaceInputs: z.record(GroupSlotInfoSchema).optional(),
  /** 工作流的外部输出接口定义 */
  interfaceOutputs: z.record(GroupSlotInfoSchema).optional(),
  /**
   * 工作流的创建方式。
   * 用于标识工作流是否由“创建组”等特殊操作产生。
   */
  creationMethod: z.string().optional(),
  /**
   * 存储此工作流内部引用的其他工作流 ID 列表。
   * 用于处理 NodeGroup 类型的节点。
   */
  referencedWorkflows: z.array(z.string()).optional(),
  /**
   * 标记用于预览的输出插槽。
   * 对象包含 nodeId 和 slotKey，或者为 null 表示没有预览目标。
   */
  previewTarget: z.object({
    nodeId: z.string(),
    slotKey: z.string(),
  }).nullable().optional(), // nullable() 允许值为 null, optional() 允许字段不存在
});

/**
 * 类型推断：工作流对象。
 * 注意：由于 embeddedWorkflows 已移除，此类型不再需要递归定义。
 */
export type WorkflowObject = z.infer<typeof BaseWorkflowObjectSchema>;

/**
 * Schema 定义：完整的工作流对象。
 * 注意：由于不再有递归引用 (embeddedWorkflows)，此 Schema 等同于 BaseWorkflowObjectSchema。
 * 保留此导出以保持一致性，并以防未来结构变化。
 */
export const WorkflowObjectSchema = BaseWorkflowObjectSchema;


/**
 * Schema 定义：用于创建新工作流 (POST 请求) 的数据结构。
 * 基于 WorkflowObjectSchema，但省略了服务器生成的字段（id, createdAt, updatedAt）。
 */
export const CreateWorkflowObjectSchema = BaseWorkflowObjectSchema.omit({ id: true, createdAt: true, updatedAt: true });
/** 类型推断：创建工作流对象 */
export type CreateWorkflowObject = z.infer<typeof CreateWorkflowObjectSchema>;

/**
 * Schema 定义：用于更新现有工作流 (PUT 请求) 的数据结构。
 * 基于 WorkflowObjectSchema，省略了 `createdAt` 字段，因为创建时间不可变。
 * `id` 通常通过 URL 参数传递，但请求体中也可以包含 `id` 用于验证。
 * `updatedAt` 由服务器在更新时自动设置。
 * 请求体代表了更新后工作流的主要内容（除服务器管理的元数据外）。
 */
export const UpdateWorkflowObjectSchema = BaseWorkflowObjectSchema.omit({ createdAt: true });
/** 类型推断：更新工作流对象 */
export type UpdateWorkflowObject = z.infer<typeof UpdateWorkflowObjectSchema>;

/**
 * Schema 定义：项目元数据。
 */
export const ProjectMetadataSchema = z.object({
  /** 项目的唯一 ID */
  id: z.string(),
  /** 项目名称 */
  name: z.string(),
  /** 项目描述 */
  description: z.string().optional(),
  /** 项目版本 */
  version: z.string(),
  /** 项目创建时间 (ISO 8601 字符串) */
  createdAt: z.string().datetime({ message: "无效的 createdAt 日期时间字符串" }),
  /** 项目最后更新时间 (ISO 8601 字符串) */
  updatedAt: z.string().datetime({ message: "无效的 updatedAt 日期时间字符串" }),
  /** 创建项目时使用的模板名称 */
  templateUsed: z.string().optional(),
  /** 项目的首选视图 ("editor" 或 "custom") */
  preferredView: z.enum(["editor", "custom"]).optional().default("editor"),
  /** 元数据结构本身的 Schema 版本 */
  schemaVersion: z.string(),
  /** 用于存储任意自定义数据的记录 */
  customMetadata: z.record(z.any()).optional()
});
/** 类型推断：项目元数据 */
export type ProjectMetadata = z.infer<typeof ProjectMetadataSchema>;

// --- 执行相关的 Schema ---

/**
 * Schema 定义：用于执行引擎的简化节点结构。
 */
export const ExecutionNodeSchema = z.object({
  /** 节点的唯一 ID (NanoId) */
  id: z.string(),
  /** 节点的完整类型标识符 (例如 'core/RandomNumberNode') */
  fullType: z.string(),
  /**
   * 在执行请求中提供的输入值。
   * 这些通常是未连接且非默认值的输入。
   */
  inputs: z.record(z.any()).optional(),
  /** 节点的配置值 */
  configValues: z.record(z.any()).optional(),
  /** 节点是否被绕过 */
  bypassed: z.boolean().optional(),
  /** 节点的多输入连接顺序 (可选) */
  inputConnectionOrders: z.record(z.array(z.string())).optional(),
});
/** 类型推断：执行节点 */
export type ExecutionNode = z.infer<typeof ExecutionNodeSchema>;

/**
 * Schema 定义：用于执行引擎的简化边结构。
 */
export const ExecutionEdgeSchema = z.object({
  /** 边的唯一 ID (NanoId) */
  /** 边的唯一 ID (NanoId)，在执行前可能没有 */
  id: z.string().optional(),
  /** 源节点的 ID (NanoId) */
  sourceNodeId: z.string(),
  /** 源节点句柄（插槽）的 ID */
  sourceHandle: z.string(),
  /** 目标节点的 ID (NanoId) */
  targetNodeId: z.string(),
  /** 目标节点句柄（插槽）的 ID */
  targetHandle: z.string(),
});
/** 类型推断：执行边 */
export type ExecutionEdge = z.infer<typeof ExecutionEdgeSchema>;

/**
 * Schema 定义：发送到后端以启动工作流执行的有效负载 (payload)。
 */
export const WorkflowExecutionPayloadSchema = z.object({
  /** 可选的工作流标识符 */
  workflowId: z.string().optional(),
  /** 用于执行的节点列表 */
  nodes: z.array(ExecutionNodeSchema),
  /** 用于执行的边列表 */
  edges: z.array(ExecutionEdgeSchema),
  /** 工作流的外部输入接口定义 (来自 WorkflowObjectSchema) */
  interfaceInputs: z.record(GroupSlotInfoSchema).optional(),
  /** 工作流的外部输出接口定义 (来自 WorkflowObjectSchema) */
  interfaceOutputs: z.record(GroupSlotInfoSchema).optional(),
  /**
   * 工作流的输出接口到内部节点输出的映射。
   * key: interfaceOutput 的 key (例如 "output_0", "summary_text")
   * value: { sourceNodeId: string, sourceSlotKey: string }
   * 这个字段之前在 workflowExecution.ts 的接口中有，现在统一到这里。
   */
  outputInterfaceMappings: z.record(z.object({ sourceNodeId: z.string(), sourceSlotKey: z.string() })).optional(),
  // metadata: z.record(z.any()).optional(), // 可选的元数据（例如客户端 ID、用户信息）
});
// 类型 WorkflowExecutionPayload 在 workflowExecution.ts 中定义，此处不导出推断类型。
