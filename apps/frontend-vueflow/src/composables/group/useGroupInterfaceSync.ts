import { useWorkflowStore } from '@/stores/workflowStore';
import type { GroupSlotInfo } from '@comfytavern/types';

/**
 * 用于同步 GroupInput/Output 节点插槽更改（由于 CONVERTIBLE_ANY 连接）
 * 到 workflowStore 中的中央工作流接口定义的 Composable。
 */
export function useGroupInterfaceSync() {
  const workflowStore = useWorkflowStore();
  // 这里不需要 storeToRefs，我们将使用 getter 函数

  /**
   * 将连接事件中单个插槽的类型更改同步到中央工作流接口。
   *
   * @param tabId - 当前工作流选项卡的 ID。
   * @param nodeId - GroupInput/Output 节点的 ID。（用于日志记录/调试）
   * @param slotKey - 连接到的 CONVERTIBLE_ANY 插槽的键。
   * @param newSlotInfo - 类型转换后的完整插槽信息。
   * @param direction - 指定是更新中央接口中的 'inputs' 还是 'outputs'。
   */
  const syncInterfaceSlotFromConnection = (
    tabId: string,
    nodeId: string, // 保留以备将来使用或详细日志记录
    slotKey: string,
    newSlotInfo: GroupSlotInfo,
    direction: 'inputs' | 'outputs'
  ): { inputs: Record<string, GroupSlotInfo>, outputs: Record<string, GroupSlotInfo> } | null => {
  // // console.debug(`[SyncInterface] syncInterfaceSlotFromConnection called. tabId: ${tabId}, nodeId: ${nodeId}, slotKey: ${slotKey}, direction: ${direction}, newSlotInfo:`, JSON.parse(JSON.stringify(newSlotInfo)));
  console.log(
    `[SyncInterface] Attempting sync for ${direction} slot '${slotKey}' on node '${nodeId}' in tab '${tabId}' with new type: ${newSlotInfo.type}` // 保留为日志以确保清晰
  );

    // 使用 store 的方法获取当前选项卡状态
    const currentTabState = workflowStore.getActiveTabState(); // 使用正确的方法

    // 确保活动选项卡与提供的 tabId 匹配并且具有工作流数据
    if (!currentTabState || !currentTabState.workflowData) {
      // // console.debug('[SyncInterface] Current tab state:', JSON.parse(JSON.stringify(currentTabState)));
      console.error(
        `[SyncInterface] Failed to sync: Active tab state or workflow data not found for tab ID '${tabId}'.`
      );
      return null;
    }
    // 可选：如果需要，检查活动选项卡 ID 是否与传入的 tabId 匹配以增强鲁棒性
    // const activeTabId = useTabStore().activeTabId; // 如果需要，获取 activeTabId
    // if (activeTabId !== tabId) { ... }

    try {
      // 从工作流数据中获取当前的完整接口定义
      const currentInputs = { ...(currentTabState.workflowData.interfaceInputs ?? {}) };
      const currentOutputs = { ...(currentTabState.workflowData.interfaceOutputs ?? {}) };

      // 根据方向更新特定部分（输入或输出）
      let newDynamicSlotKey: string | null = null;
      if (direction === 'inputs') {
        currentInputs[slotKey] = { ...newSlotInfo }; // 更新被转换的插槽
        // // console.debug(`[SyncInterface] Updated central inputs for key '${slotKey}' with type '${newSlotInfo.type}'.`);
        // // console.debug(`[SyncInterface] Before update central inputs for key '${slotKey}':`, JSON.parse(JSON.stringify(currentInputs[slotKey])));

        // // console.debug(`[SyncInterface] After update central inputs for key '${slotKey}':`, JSON.parse(JSON.stringify(currentInputs[slotKey])));
        // 添加新的 CONVERTIBLE_ANY 输入插槽
        let index = 0;
        let nextSlotKey = `input_${index}`;
        while (currentInputs[nextSlotKey]) {
          index++;
          nextSlotKey = `input_${index}`;
        }
        newDynamicSlotKey = nextSlotKey;
        currentInputs[newDynamicSlotKey] = {
          key: newDynamicSlotKey,
          type: 'CONVERTIBLE_ANY',
          displayName: '*',
          customDescription: '这是一个**可转换**的插槽，初始类型为 `CONVERTIBLE_ANY`。\n\n- 连接后，其类型和名称将根据连接自动更新。\n- 会生成一个新的**空心插槽**。\n- 可在**侧边栏**编辑接口属性。',
          allowDynamicType: true, // <-- 添加缺失的属性
        };
        // // console.debug(`[SyncInterface] Added new dynamic input slot '${newDynamicSlotKey}' to central inputs.`);
        // // console.debug(`[SyncInterface] Added new dynamic input slot '${newDynamicSlotKey}'. Current inputs:`, JSON.parse(JSON.stringify(currentInputs)));

      } else { // direction === 'outputs'
        currentOutputs[slotKey] = { ...newSlotInfo }; // 更新被转换的插槽
        // // console.debug(`[SyncInterface] Before update central outputs for key '${slotKey}':`, JSON.parse(JSON.stringify(currentOutputs[slotKey])));
        // // console.debug(`[SyncInterface] Updated central outputs for key '${slotKey}' with type '${newSlotInfo.type}'.`);
        // // console.debug(`[SyncInterface] After update central outputs for key '${slotKey}':`, JSON.parse(JSON.stringify(currentOutputs[slotKey])));

        // 添加新的 CONVERTIBLE_ANY 输出插槽
        let index = 0;
        let nextSlotKey = `output_${index}`;
        while (currentOutputs[nextSlotKey]) {
          index++;
          nextSlotKey = `output_${index}`;
        }
        newDynamicSlotKey = nextSlotKey;
        currentOutputs[newDynamicSlotKey] = {
          key: newDynamicSlotKey,
          type: 'CONVERTIBLE_ANY',
          displayName: '*',
          customDescription: '这是一个**可转换**的插槽，初始类型为 `CONVERTIBLE_ANY`。\n\n- 连接后，其类型和名称将根据连接自动更新。\n- 会生成一个新的**空心插槽**。\n- 可在**侧边栏**编辑接口属性。',
          allowDynamicType: true, // <-- 添加缺失的属性
        };
        // // console.debug(`[SyncInterface] Added new dynamic output slot '${newDynamicSlotKey}' to central outputs.`);
        // // console.debug(`[SyncInterface] Added new dynamic output slot '${newDynamicSlotKey}'. Current outputs:`, JSON.parse(JSON.stringify(currentOutputs)));
      }

      // 不再调用 store action，而是返回计算出的接口
      // // console.debug('[SyncInterface] Returning calculated interfaces instead of calling updateWorkflowInterface.');
      return { inputs: currentInputs, outputs: currentOutputs };

      // console.log(
      //   `[SyncInterface] 成功调用 updateWorkflowInterface，用于选项卡 '${tabId}' 中的 ${direction} 插槽 '${slotKey}'。`
      // );
    } catch (error) {
      console.error(
        `[SyncInterface] Error syncing ${direction} slot '${slotKey}' for tab '${tabId}':`,
        error
      );
      // 考虑在此处添加更健壮的错误处理或用户反馈
    }
    return null; // 如果出错则返回 null
  };

  return {
    syncInterfaceSlotFromConnection,
  };
}
