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
import type { useTabStore } from '@/stores/tabStore';
import type { useWorkflowManager } from '@/composables/workflow/useWorkflowManager';
import type { useWorkflowHistory } from '@/composables/workflow/useWorkflowHistory';
import type { useWorkflowViewManagement } from '@/composables/workflow/useWorkflowViewManagement';
import type { useDialogService } from '@/services/DialogService';
import type { useWorkflowLifecycleCoordinator } from '@/composables/workflow/useWorkflowLifecycleCoordinator';
import type { useWorkflowGrouping } from '@/composables/group/useWorkflowGrouping';
import type { useMultiInputConnectionActions } from '@/composables/node/useMultiInputConnectionActions';
import type { useWorkflowPreview } from '@/composables/workflow/useWorkflowPreview';

export interface WorkflowStoreContext {
  // 核心 State (以 Ref 的形式)
  elements: Ref<(VueFlowNode | VueFlowEdge)[]>;
  workflowData: Ref<WorkflowData | null>;
  
  // 依赖的 Stores 和 Managers
  tabStore: ReturnType<typeof useTabStore>;
  workflowManager: ReturnType<typeof useWorkflowManager>;
  historyManager: ReturnType<typeof useWorkflowHistory>;
  workflowViewManagement: ReturnType<typeof useWorkflowViewManagement>;
  dialogService: ReturnType<typeof useDialogService>;
  workflowLifecycleCoordinator: ReturnType<typeof useWorkflowLifecycleCoordinator>;
  workflowGrouping: ReturnType<typeof useWorkflowGrouping>;
  multiInputActions: ReturnType<typeof useMultiInputConnectionActions>;
  workflowPreview: ReturnType<typeof useWorkflowPreview>;

  // 需要共享的 Getters (以 ComputedRef 的形式)
  currentSnapshot: ComputedRef<WorkflowStateSnapshot | undefined>;

  // 需要共享的底层方法 (函数签名)
  recordHistory: (internalId: string, entry: HistoryEntry, snapshot: WorkflowStateSnapshot) => void;
  setElements: (internalId: string, elements: (VueFlowNode | VueFlowEdge)[]) => Promise<void>;
}