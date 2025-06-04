import type { MarkerType } from '@vue-flow/core' // 导入 MarkerType
// 导出节点相关类型
export * from './node'

// API设置类型
export interface APISettings {
  use_env_vars: boolean
  base_url: string
  api_key: string
}

// 自定义消息内容部分
export interface CustomContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

// 自定义消息
export interface CustomMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | CustomContentPart[]
}

// 将CustomMessage转换为API消息格式
export function convertToApiMessage(msg: CustomMessage): any {
  if (Array.isArray(msg.content)) {
    return {
      role: msg.role,
      content: msg.content.map(part => ({
        type: part.type,
        [part.type === 'text' ? 'text' : 'image_url']: part.type === 'text' ? part.text : part.image_url
      }))
    }
  }
  return {
    role: msg.role,
    content: msg.content
  }
}

// WebSocket 消息类型定义已移至 node.ts 并通过 export * 导出

// --- 工作流对象类型 ---
import type { GroupInterfaceInfo } from './schemas'; // 导入 Zod 推断的类型
// --- Node Group Specific Data ---
export interface NodeGroupData {
  groupMode: 'embedded' | 'referenced'; // How the group content is stored
  referencedWorkflowId?: string | null; // ID of the external workflow (if mode is 'referenced')
  embeddedWorkflowId?: string | null;   // ID referencing a key in the main workflow's 'embeddedWorkflows' (if mode is 'embedded')
  // We also expect the dynamically added 'groupInterface' here during save/load
  groupInterface?: GroupInterfaceInfo; // 现在引用导入的类型
  // Include other standard node data properties if needed, or rely on merging
  type: 'NodeGroup'; // Ensure the type is correctly set
  label?: string; // Node instance label
  displayName?: string; // Node type display name
  configValues?: Record<string, any>; // Configuration values like groupDefinitionId (which might become redundant)
  // Add other relevant fields from NodeDefinition if they are stored per-instance
  inputs?: Record<string, any>; // Placeholder for potential instance-specific input state
  outputs?: Record<string, any>; // Placeholder for potential instance-specific output state
}

// 定义节点基本结构 (Interface removed, use type from schemas.ts)
// export interface WorkflowNode { ... }

// 定义边基本结构 (Interface removed, use type from schemas.ts)
// export interface WorkflowEdge { ... }

// 定义视口结构 (Interface removed, use type from schemas.ts)
// export interface WorkflowViewport { ... }

// 定义完整的工作流对象结构 (Interface removed, use type from schemas.ts)
// export interface WorkflowObject { ... }


// --- 节点组相关类型 ---

// 定义节点组的输入/输出插槽信息 (用于 GroupInterfaceInfo) - 已移除，使用 schemas.ts 中的 Zod 推断类型
// export interface GroupSlotInfo {
//   key: string; // 插槽的唯一键
//   displayName: string; // 显示名称
//   type: string; // 数据类型 (考虑使用更具体的类型，如 NodeInputType | NodeOutputType)
//   description?: string; // 插槽描述
// }

// 定义节点组的外部接口信息 (类型从 schemas.ts 导出)
// export interface GroupInterfaceInfo {
//   inputs: GroupSlotInfo[];
//   outputs: GroupSlotInfo[];
// }
// GroupDefinition is removed. Use WorkflowObject to represent group definitions.
// The distinction between a workflow and a group definition is contextual (e.g., based on editingType in the store).


// 定义边标记的基础结构 (匹配 VueFlow 的 EdgeMarkerType 的对象形式)
export interface EdgeMarkerDefinition { // 定义边标记的基础结构
  type: MarkerType; // 使用导入的 MarkerType 枚举
  color?: string;
  width?: number;
  height?: number;
  markerUnits?: string;
  orient?: string;
  strokeWidth?: number;
  // 可以根据需要添加其他标记属性
}

// 导出 Zod schemas 和相关类型 (保留通配符以导出其他 schema)
export * from './schemas';
// 显式导出需要的 Schema 以确保可用性并提高清晰度
export { WorkflowExecutionPayloadSchema, ExecutionNodeSchema, ExecutionEdgeSchema } from './schemas'; // 显式导出 Schema

// 导出历史记录相关类型
export * from './history';

// --- 显式导出工作流执行相关类型以解决命名冲突 ---
// 导入接口和枚举，使用 'type' 关键字
import type {
    PromptInfo,
    PromptAcceptedResponsePayload,
    ExecutionStatusUpdatePayload,
    NodeExecutingPayload,
    NodeProgressPayload,
    NodeCompletePayload,
    NodeErrorPayload,
    // ExecutePreviewRequestPayload, // 根据设计文档移除
    // 导入接口类型
    ExecutionNode,
    ExecutionEdge,
    WorkflowExecutionPayload,
    NanoId,
    ExecutionsListResponse,
    PromptStatusResponse,
    // ExecutionType, // 根据设计文档移除
} from './workflowExecution';
// 导入枚举值
import { ExecutionStatus } from './workflowExecution';

// 重新导出类型和枚举
export type {
    PromptInfo,
    PromptAcceptedResponsePayload,
    ExecutionStatusUpdatePayload,
    NodeExecutingPayload,
    NodeProgressPayload,
    NodeCompletePayload,
    NodeErrorPayload,
    // ExecutePreviewRequestPayload, // 根据设计文档移除
    // 导出接口类型（使用原始名称）
    ExecutionNode,
    ExecutionEdge,
    WorkflowExecutionPayload,
    NanoId,
    ExecutionsListResponse,
    PromptStatusResponse,
    // ExecutionType, // 根据设计文档移除
};
export { ExecutionStatus }; // 导出值（枚举）
// --- 结束显式导出 ---