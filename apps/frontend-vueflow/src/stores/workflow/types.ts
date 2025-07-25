// apps/frontend-vueflow/src/stores/workflow/types.ts
// 定义主 store 与各 action 模块之间的内部协作接口
import type { Ref, ComputedRef } from 'vue';
import type { Node as VueFlowNode, Edge as VueFlowEdge } from '@vue-flow/core';
import type { WorkflowData, WorkflowStateSnapshot } from '@/types/workflowTypes';
import type { HistoryEntry } from '@comfytavern/types';

/**
 * @interface WorkflowStoreContext
 * @description 这是我们从主 store 文件传递给各个 action 工厂函数的“上下文”对象。
 * 它包含了 action 逻辑需要访问的所有 state 和底层方法。
 */
export interface WorkflowStoreContext {
  // 核心 State (以 Ref 的形式)
  elements: Ref<(VueFlowNode | VueFlowEdge)[]>;
  workflowData: Ref<WorkflowData | null>;
  
  // 需要共享的 Getters (以 ComputedRef 的形式)
  currentSnapshot: ComputedRef<WorkflowStateSnapshot | undefined>;

  // 需要共享的底层方法 (函数签名)
  recordHistory: (entry: HistoryEntry, snapshot: WorkflowStateSnapshot) => void;
  setElements: (elements: (VueFlowNode | VueFlowEdge)[]) => Promise<void>;
}