import type { Node as VueFlowNode, Edge as VueFlowEdge, EdgeMarkerType } from '@vue-flow/core';
import type { WorkflowObject, WorkflowViewport as SharedViewport, GroupInterfaceInfo } from '@comfytavern/types'; // 移除未使用的 GroupSlotInfo
// 移除未使用的 SocketType 导入

import type { XYPosition, NodeDragEvent } from '@vue-flow/core';

// 为拖拽事件定义一个统一的、可扩展的载荷类型
export interface NodeDragEventData extends NodeDragEvent {
  parentChanged: boolean;
  parentingInfo: {
    updates: { nodeId: string; parentNodeId: string | null; position: XYPosition }[];
    oldStates: { nodeId: string; parentNodeId: string | null; oldPosition: XYPosition }[];
  } | null;
}
// 从 workflowStore.ts 移动
export type Viewport = SharedViewport;

export interface WorkflowData extends WorkflowObject {
  id: string; // 工作流在 Store 中必须有 ID
  name: string;
  description?: string; // 添加工作流描述字段
  viewport: Viewport; // 确保 viewport 是类型的一部分
  createdAt?: string;
  updatedAt?: string;
  version?: string;
}

export type ManagedVueFlowInstance = any; // 暂时使用 any 绕过类型问题

export interface TabWorkflowState {
  workflowData: WorkflowData | null; // 存储工作流数据（可以表示工作流或组定义）
  isDirty: boolean;
  isPersisted: boolean; // 新增：标记工作流是否已在后端持久化
  vueFlowInstance: ManagedVueFlowInstance;
  elements: Array<VueFlowNode | VueFlowEdge>;
  viewport: Viewport;
  groupInterfaceInfo: GroupInterfaceInfo | null; // <-- Add state for group editor interface
  isLoaded: boolean; // 新增：标记工作流是否已从存储加载
  // 历史状态将单独管理
}

// 从 useWorkflowHistory.ts 移动
export interface WorkflowStateSnapshot {
  elements: Array<VueFlowNode | VueFlowEdge>;
  viewport: Viewport; // 视口现在是必需的
  workflowData: WorkflowData | null; // 添加工作流元数据
}

export interface HistoryState {
  history: WorkflowStateSnapshot[];
  historyIndex: number;
}

// 从 useEdgeStyles.ts 移动
export interface EdgeStyleProps {
  animated: boolean;
  style: Record<string, any>;
  markerEnd: EdgeMarkerType;
}