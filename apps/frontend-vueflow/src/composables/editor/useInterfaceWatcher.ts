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
      // The map function might return slightly different types, but this is intended.
      // The previous @ts-expect-error is no longer needed.
      const updatedElements = currentElementsValue.map((el) => {
        if (isNode(el)) {
          // 更新 GroupInput 节点的输出句柄
          // Check if the fullType ends with ':GroupInput'
          const nodeType = getNodeType(el); // Use getNodeType which should handle fullType
          // Roo: Debugging node type check in watcher
          // console.log(`[DEBUG Watcher Check] Node ID: ${el.id}, Type: ${nodeType}`);
          if (nodeType === 'core:GroupInput') {
            // console.log(`[DEBUG Watcher Check] Matched :GroupInput for ${el.id}`);
            const currentOutputs = el.data?.outputs || {};
            const newOutputs = newInterface.inputs || {}; // 接口输入映射到 GroupInput 输出
            // Use a more robust comparison if needed, but JSON stringify might be okay for now
            if (JSON.stringify(currentOutputs) !== JSON.stringify(newOutputs)) {
              // // console.debug(`[useInterfaceWatcher] 正在更新 GroupInput (${el.id}) 的输出。`);
              elementsChanged = true;
              return {
                ...el,
                data: { ...el.data, outputs: newOutputs },
              };
            }
          }
          // 更新 GroupOutput 节点的输入句柄
          // Check if the fullType ends with ':GroupOutput'
          else if (nodeType === 'core:GroupOutput') {
            // console.log(`[DEBUG Watcher Check] Matched :GroupOutput for ${el.id}`);
            const currentInputs = el.data?.inputs || {};
            const newInputs = newInterface.outputs || {}; // 接口输出映射到 GroupOutput 输入
            // Use a more robust comparison if needed
            if (JSON.stringify(currentInputs) !== JSON.stringify(newInputs)) {
              // // console.debug(`[useInterfaceWatcher] 正在更新 GroupOutput (${el.id}) 的输入。`);
              elementsChanged = true;
              return {
                ...el,
                data: { ...el.data, inputs: newInputs },
              };
            }
          }
        }
        return el; // 未更改的元素
      });

      // 如果元素已更改，状态应已通过触发接口更改的操作（例如 handleConnectionWithInterfaceUpdate）原子地更新。
      // 我们只需要在必要时分派 UI 刷新事件。
      // If elements were changed by the interface update, apply them back to the state via the manager.
      // This ensures the node's visual representation updates.
      if (elementsChanged && activeTabId.value) {
        //  console.debug(
        //    `[useInterfaceWatcher] Interface change detected for tab ${activeTabId.value}. Applying updated elements.`
        //  );
         // Apply the calculated updatedElements back to the workflow manager's state.
         // Note: setElements handles deep cloning and dirty marking internally.
         // We don't record history here because the history should have been recorded
         // by the action that *triggered* the interface change (e.g., connection, sidebar edit).
         workflowManager.setElements(activeTabId.value, updatedElements);

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