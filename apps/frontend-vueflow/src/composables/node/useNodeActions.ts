import { computed, nextTick } from 'vue'; // <-- Import nextTick
// import { useWebSocket } from '@/composables/useWebSocket'; // REMOVED
import { useTabStore } from '@/stores/tabStore';
// import { WebSocketMessageType } from '@comfytavern/types'; // REMOVED
import type { UseNodeStateProps } from './useNodeState'; // 重用 props 类型
import { useWorkflowStore } from '@/stores/workflowStore'; // <-- 新增：导入工作流 store

export function useNodeActions(props: Readonly<UseNodeStateProps>) {
  // const { sendMessage } = useWebSocket(); // REMOVED
  const tabStore = useTabStore();
  const workflowStore = useWorkflowStore(); // <-- 新增：获取工作流 store 实例

  // 计算属性：判断当前节点是否为 NodeGroup (editNodeGroup 需要)
  // Roo: 使用带命名空间的类型
  const isNodeGroup = computed(() => props.data?.type === 'core:NodeGroup');

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

  // 处理编辑节点组的点击事件
  const editNodeGroup = async () => { // <-- Make function async
    // 等待下一个 tick，确保 props 可能的更新已完成
    await nextTick();

    if (!isNodeGroup.value || !props.data.configValues) {
      console.error(`useNodeActions (${props.id}): Cannot edit group - not a NodeGroup or missing configValues.`);
      return;
    }

    // 添加默认值 'referenced' 以处理旧数据或 groupMode 缺失的情况
    const groupMode = props.data.configValues.groupMode || 'referenced';
    const groupName = props.data.label || props.data.displayName; // 使用实例标签或显示名称

    if (groupMode === 'referenced') {
      const referencedWorkflowId = props.data.configValues.referencedWorkflowId;
      if (!referencedWorkflowId) {
        // referencedWorkflowId 缺失，不执行任何操作。
        // 可选：在此处向用户显示通知
        return;
      }
      const tabLabel = `编辑组: ${groupName || referencedWorkflowId.substring(0, 8)}...`;
      console.debug(`useNodeActions (${props.id}): Requesting to open workflow tab for referenced group ${referencedWorkflowId} (Label: ${tabLabel})`);
      // 检查是否已存在与该工作流ID关联的标签页
      const existingTab = tabStore.tabs.find(t => t.associatedId === referencedWorkflowId);
      if (existingTab) {
        console.debug(`useNodeActions (${props.id}): 找到已存在的标签页 ${existingTab.internalId} 与 ${referencedWorkflowId} 关联，应当聚焦该标签页而不是新建`);
        tabStore.setActiveTab(existingTab.internalId);
        return;
      } else {
        console.debug(`useNodeActions (${props.id}): 未找到与 ${referencedWorkflowId} 关联的标签页，将新建标签页`);
      }
      tabStore.addTab('workflow', tabLabel, referencedWorkflowId, true); // 打开引用的工作流

    } else {
      console.error(`useNodeActions (${props.id}): Unknown groupMode "${groupMode}".`);
    }
  };

  return {
    handleButtonClick,
    editNodeGroup,
    isNodeGroup, // 也导出 isNodeGroup，因为 BaseNode 模板中可能还需要它
  };
}