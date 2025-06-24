import { z } from 'zod';
import type { GroupSlotInfo } from './node';
import { GroupSlotInfoSchema } from './node';

// --- VueFlow & Workflow Structure Schemas ---

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
 */
const ComponentStateSchema = z.object({
  /** 组件的高度 */
  height: z.number().optional(),
}).optional();

/**
 * Schema 定义：节点内所有组件状态的集合。
 */
const ComponentStatesSchema = z.record(ComponentStateSchema).optional();

/**
 * Schema 定义：工作流节点的数据 (data) 字段。
 */
export const WorkflowNodeDataSchema = z.intersection(
  z.record(z.any()),
  z.object({
    /** 存储节点内部组件的状态 */
    componentStates: ComponentStatesSchema,
    /** 标记此节点定义是否缺失 */
    isMissing: z.boolean().optional(),
    /** 当节点缺失时，存储原始节点数据 */
    originalNodeData: z.record(z.any()).optional(),
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
  groupInterface: z.object({
    inputs: z.record(GroupSlotInfoSchema).optional(),
    outputs: z.record(GroupSlotInfoSchema).optional()
  }).optional(),
  /** 节点组本身的配置值 */
  configValues: z.record(z.any()).optional()
});
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
  /** 节点的类型标识符 */
  type: z.string(),
  /** 节点在画布上的位置 */
  position: PositionSchema,
  /** 节点的数据负载 */
  data: WorkflowNodeDataSchema,
  /** 节点的宽度 */
  width: z.number().optional(),
  /** 节点的高度 */
  height: z.number().optional(),
  /** 节点的层叠顺序 */
  zIndex: z.number().optional(),
  /** 节点在界面上显示的名称 */
  displayName: z.string().optional(),
  /** 节点的配置值 */
  configValues: z.record(z.any()).optional(),
  /** 节点的输入值 */
  inputValues: z.record(z.any()).optional(),
  /** 存储多输入插槽的连接顺序 */
  inputConnectionOrders: z.record(z.array(z.string())).optional().describe('多输入插槽的连接顺序'),
  /** 节点的自定义描述 */
  customDescription: z.string().optional(),
  /** 节点插槽的自定义描述 */
  customSlotDescriptions: CustomSlotDescriptionsSchema,
});
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;


/**
 * Schema 定义：VueFlow 边的末端标记 (MarkerEnd)。
 */
export const MarkerEndSchema = z.union([
  z.string(),
  z.object({
    type: z.string().optional(),
    color: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    markerUnits: z.string().optional(),
    orient: z.string().optional(),
    strokeWidth: z.number().optional(),
  })
]).optional();

/**
 * Schema 定义：工作流边的附加数据 (data) 字段。
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
  /** 源节点的句柄（插槽）ID */
  sourceHandle: z.string().optional().nullable(),
  /** 目标节点的句柄（插槽）ID */
  targetHandle: z.string().optional().nullable(),
  /** 边的类型 */
  type: z.string().optional(),
  /** 边的标签 */
  label: z.string().optional(),
  /** 边的末端标记 */
  markerEnd: MarkerEndSchema,
  /** 边的附加数据 */
  data: WorkflowEdgeDataSchema,
});
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;

/**
 * Schema 定义：工作流画布的视口信息（位置和缩放）。
 */
export const WorkflowViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});
export type WorkflowViewport = z.infer<typeof WorkflowViewportSchema>;

/**
 * Schema 定义：基础工作流对象结构。
 */
export const WorkflowObjectSchema = z.object({
  /** 工作流的唯一 ID */
  id: z.string().optional(),
  /** 工作流的名称 */
  name: z.string({ required_error: "工作流名称是必需的" }).min(1, "工作流名称不能为空"),
  /** 工作流的描述信息 */
  description: z.string().optional(),
  /** 工作流包含的节点列表 */
  nodes: z.array(WorkflowNodeSchema),
  /** 工作流包含的边列表 */
  edges: z.array(WorkflowEdgeSchema),
  /** 工作流画布的视口状态 */
  viewport: WorkflowViewportSchema,
  /** 工作流创建时间 */
  createdAt: z.string().datetime().optional(),
  /** 工作流最后更新时间 */
  updatedAt: z.string().datetime().optional(),
  /** 工作流的版本号 */
  version: z.string().optional(),
  /** 工作流的外部输入接口定义 */
  interfaceInputs: z.record(GroupSlotInfoSchema).optional(),
  /** 工作流的外部输出接口定义 */
  interfaceOutputs: z.record(GroupSlotInfoSchema).optional(),
  /** 工作流的创建方式 */
  creationMethod: z.string().optional(),
  /** 存储此工作流内部引用的其他工作流 ID 列表 */
  referencedWorkflows: z.array(z.string()).optional(),
  /** 标记用于预览的输出插槽 */
  previewTarget: z.object({
    nodeId: z.string(),
    slotKey: z.string(),
  }).nullable().optional(),
});
export type WorkflowObject = z.infer<typeof WorkflowObjectSchema>;


/**
 * Schema 定义：用于创建新工作流 (POST 请求) 的数据结构。
 */
export const CreateWorkflowObjectSchema = WorkflowObjectSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type CreateWorkflowObject = z.infer<typeof CreateWorkflowObjectSchema>;

/**
 * Schema 定义：用于更新现有工作流 (PUT 请求) 的数据结构。
 */
export const UpdateWorkflowObjectSchema = WorkflowObjectSchema.omit({ createdAt: true });
export type UpdateWorkflowObject = z.infer<typeof UpdateWorkflowObjectSchema>;


/**
 * 定义了用于持久化存储的节点数据结构。
 * 这是 `WorkflowNodeSchema` 的一个简化版本，只包含需要保存到数据库或文件中的核心字段。
 */
export const WorkflowStorageNodeSchema = WorkflowNodeSchema.pick({
  id: true,
  type: true,
  position: true,
  width: true,
  height: true,
  displayName: true,
  customDescription: true,
  customSlotDescriptions: true,
  inputValues: true,
  configValues: true,
  inputConnectionOrders: true,
});
export type WorkflowStorageNode = z.infer<typeof WorkflowStorageNodeSchema>;

/**
 * 定义了用于持久化存储的边数据结构。
 * 这是 `WorkflowEdgeSchema` 的一个简化版本。
 */
export const WorkflowStorageEdgeSchema = WorkflowEdgeSchema.pick({
  id: true,
  source: true,
  target: true,
  sourceHandle: true,
  targetHandle: true,
  label: true,
});
export type WorkflowStorageEdge = z.infer<typeof WorkflowStorageEdgeSchema>;


/**
 * 表示用于存储的完整工作流结构。
 * 这个结构旨在成为前端画布状态与后端执行/存储之间的标准中间表示。
 */
export const WorkflowStorageObjectSchema = z.object({
  name: z.string().optional(),
  viewport: WorkflowViewportSchema.optional(),
  nodes: z.array(WorkflowStorageNodeSchema),
  edges: z.array(WorkflowStorageEdgeSchema),
  interfaceInputs: z.record(GroupSlotInfoSchema).optional(),
  interfaceOutputs: z.record(GroupSlotInfoSchema).optional(),
  referencedWorkflows: z.array(z.string()).optional(),
});
export type WorkflowStorageObject = z.infer<typeof WorkflowStorageObjectSchema>;