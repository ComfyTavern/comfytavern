import { computed } from 'vue'; // <-- Import nextTick (移除了未使用的 nextTick)
import { useTabStore } from '@/stores/tabStore';
import type { UseNodeStateProps } from './useNodeState'; // 重用 props 类型
import { useWorkflowStore } from '@/stores/workflowStore'; // <-- 新增：导入工作流 store

export function useNodeActions(props: Readonly<UseNodeStateProps>) {
  // const { sendMessage } = useWebSocket(); // REMOVED
  const tabStore = useTabStore();
  const workflowStore = useWorkflowStore(); // <-- 新增：获取工作流 store 实例

  // 计算属性：判断当前节点是否为 NodeGroup (editNodeGroup 需要)
  // 使用带命名空间的类型
  const isNodeGroup = computed(() => props.data?.type === 'NodeGroup');

  // 处理按钮点击事件 - 改为调用 store action
  const handleButtonClick = (inputKey: string) => {
    const activeTabId = tabStore.activeTabId; // 获取当前激活的标签页 ID
    if (!activeTabId) {
      console.error(`useNodeActions (${props.id}): Cannot handle button click, no active tab ID found.`);
      return;
    }
    console.debug(`Button clicked: Node ${props.id}, Input ${inputKey}, Tab ${activeTabId}. Triggering store action.`);
    // 调用 workflowStore 的 action 来处理按钮点击事件
    workflowStore.handleNodeButtonClick(activeTabId, props.id, inputKey); // <-- 更改：调用 store action
  };


  return {
    handleButtonClick,
    isNodeGroup, // 也导出 isNodeGroup，因为 BaseNode 模板中可能还需要它
  };
}