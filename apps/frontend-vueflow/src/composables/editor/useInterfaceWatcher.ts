import { watch, type Ref } from 'vue';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useWorkflowManager } from '@/composables/workflow/useWorkflowManager'; // Import manager
import { isNode } from '@vue-flow/core';
import { getNodeType } from '@/utils/nodeUtils';

/**
 * 用于监视工作流接口更改并相应更新 GroupInput/Output 节点的 Composable。
 * @param activeTabId - 活动选项卡 ID 的计算属性引用。
 * @param currentElements - 活动选项卡元素的计算属性引用。
 */
export function useInterfaceWatcher(
  activeTabId: Ref<string | null>,
  currentElements: Ref<any[]> // 暂时使用 any[]，或使用 Elements 类型
) {
  const workflowStore = useWorkflowStore();
  const workflowManager = useWorkflowManager(); // Get the manager instance

  // 监视工作流接口更改并更新 GroupInput/Output 节点
  watch(
    () => {
      if (!activeTabId.value) return null;
      const data = workflowStore.getWorkflowData(activeTabId.value);
      // 返回包含输入和输出的对象以进行深度监视
      return data ? { inputs: data.interfaceInputs, outputs: data.interfaceOutputs } : null;
    },
    (newInterface, _oldInterface) => {
      if (!activeTabId.value || !newInterface) return;
      // // console.debug("[useInterfaceWatcher] 工作流接口已更改:", newInterface);

      const currentElementsValue = currentElements.value;
      let elementsChanged = false;

      // Roo: 重构 elementsChanged 的计算逻辑，避免创建未使用的 updatedElements 数组
      for (const el of currentElementsValue) {
        if (elementsChanged) break; // 如果已经检测到更改，则无需继续检查

        if (isNode(el)) {
          const nodeType = getNodeType(el);
          if (nodeType === 'core:GroupInput') {
            const currentOutputs = el.data?.outputs || {};
            const newOutputs = newInterface.inputs || {};
            if (JSON.stringify(currentOutputs) !== JSON.stringify(newOutputs)) {
              elementsChanged = true;
            }
          } else if (nodeType === 'core:GroupOutput') {
            const currentInputs = el.data?.inputs || {};
            const newInputs = newInterface.outputs || {};
            if (JSON.stringify(currentInputs) !== JSON.stringify(newInputs)) {
              elementsChanged = true;
            }
          }
        }
      }

      // 如果元素已更改，状态应已通过触发接口更改的操作（例如 handleConnectionWithInterfaceUpdate）原子地更新。
      // 我们只需要在必要时分派 UI 刷新事件。
      // If elements were changed by the interface update, apply them back to the state via the manager.
      // This ensures the node's visual representation updates.
      if (elementsChanged && activeTabId.value) {
        const internalId = activeTabId.value;
        // console.debug(
        //   `[useInterfaceWatcher] Interface change detected for tab ${internalId}. elementsChanged: ${elementsChanged}. Updating GroupIO nodes directly.`
        // );

        // Roo: 诊断日志 - 检查 watch 回调执行时 workflowManager 内部的原始状态和快照状态
        // const directAccessState = workflowManager.getAllTabStates.value.get(internalId);
        // const directAccessElements = directAccessState?.elements;
        // console.log(`[DEBUG useInterfaceWatcher] Watch triggered for tab ${internalId}.`);
        // console.log(`  Directly accessed elements BEFORE snapshot (count ${directAccessElements?.length}):`, JSON.stringify(directAccessElements?.map(e => e.id)));

        const snapshot = workflowManager.getCurrentSnapshot(internalId);
        const latestElementsSnapshot = snapshot?.elements; // 使用快照作为更新的权威来源
        // console.log(`  Snapshot elements (count ${latestElementsSnapshot?.length}):`, JSON.stringify(latestElementsSnapshot?.map(e => e.id)));

        if (!latestElementsSnapshot) {
          // console.error(`[useInterfaceWatcher] Could not get latest elements snapshot from manager for tab ${internalId}. Aborting GroupIO node update.`);
          // if (directAccessElements) {
          // console.error(`[useInterfaceWatcher] Direct access elements were (count ${directAccessElements.length}):`, JSON.stringify(directAccessElements.map(e => e.id)));
          // }
          return;
        }

        // Roo: 遍历最新的元素快照，并使用 updateNodeInternalData 更新 GroupInput/Output 节点的 data
        // newInterface 包含最新的顶层接口定义
        latestElementsSnapshot.forEach(el => {
          if (isNode(el)) {
            const nodeType = getNodeType(el);
            if (nodeType === 'core:GroupInput') {
              const newOutputsForGroupInput = newInterface.inputs || {};
              // 只有在实际需要更新时才调用 updateNodeInternalData
              if (JSON.stringify(el.data?.outputs || {}) !== JSON.stringify(newOutputsForGroupInput)) {
                // console.debug(`[useInterfaceWatcher] Updating GroupInput ${el.id} outputs for tab ${internalId}`);
                workflowManager.updateNodeInternalData(internalId, el.id, { outputs: newOutputsForGroupInput });
              }
            } else if (nodeType === 'core:GroupOutput') {
              const newInputsForGroupOutput = newInterface.outputs || {};
              if (JSON.stringify(el.data?.inputs || {}) !== JSON.stringify(newInputsForGroupOutput)) {
                // console.debug(`[useInterfaceWatcher] Updating GroupOutput ${el.id} inputs for tab ${internalId}`);
                workflowManager.updateNodeInternalData(internalId, el.id, { inputs: newInputsForGroupOutput });
              }
            }
          }
        });
        // 原有的 setElements 调用已被移除

        // Also dispatch the event for the sidebar UI refresh
        setTimeout(() => {
          if (activeTabId.value) { // Re-check activeTabId as it might change during timeout
            const event = new CustomEvent("refresh-groupio-edit", {
              detail: { tabId: activeTabId.value },
            });
            document.dispatchEvent(event);
            //  console.debug(
            //    `[useInterfaceWatcher] Dispatched refresh-groupio-edit event for tab ${activeTabId.value} after applying element updates.`
            //  );
          }
        }, 0); // Keep timeout for potential UI decoupling
      }
    },
    { deep: true } // 使用深度监视来检测接口对象内部的更改
  );

  // 如果它只设置监视器，则无需返回特定函数
}