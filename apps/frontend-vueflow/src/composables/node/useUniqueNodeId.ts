import { useWorkflowStore } from '@/stores/workflowStore'; // 导入 workflow store
import type { TabWorkflowState } from '@/types/workflowTypes'; // 导入类型
import type { Node, Edge } from '@vue-flow/core'; // 导入正确的类型 Node 和 Edge
import { storeToRefs } from 'pinia'; // 导入 storeToRefs

// 移除全局计数器
// let globalIdCounter = 0;

export function useUniqueNodeId() {
  const workflowStore = useWorkflowStore();
  const { getAllTabStates } = storeToRefs(workflowStore); // 使用 storeToRefs 解构 getter

  /**
   * 生成在指定工作流（标签页）内唯一的元素 ID (节点或边)
   * @param internalId 目标工作流（标签页）的内部 ID
   * @param baseType 可选的基础类型字符串，用于生成更有意义的ID前缀，默认为 'element'
   * @returns 一个在该工作流内唯一的元素 ID 字符串，格式如 'node_0', 'edge_1' 等
   */
  const generateUniqueNodeId = (internalId: string, baseType: string = 'element'): string => {
    if (!internalId) {
      console.error("generateUniqueNodeId: internalId is required.");
      // 返回一个可能冲突的 ID，或者抛出错误，取决于你的错误处理策略
      return `${baseType}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }
    // console.log(`[useUniqueNodeId] Generating ID for tab: ${internalId}, baseType: ${baseType}`); // 添加日志
    // console.debug(`[useUniqueNodeId] Checking getAllTabStates:`, getAllTabStates); // 这条日志可能过于详细

    // 现在 getAllTabStates 是一个 Ref<Map<string, TabWorkflowState>>
    let allTabStatesMap;
    if (getAllTabStates) {
      try {
        allTabStatesMap = getAllTabStates.value; // 通过 .value 访问 Map
      } catch (e) {
        console.error(`[useUniqueNodeId] Failed to access getAllTabStates.value:`, e);
        return `${baseType}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      }
    } else {
      console.error(`[useUniqueNodeId] getAllTabStates is not defined.`);
      return `${baseType}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }
    const state: TabWorkflowState | undefined = allTabStatesMap.get(internalId);
    const existingElements = state ? state.elements : []; // 获取指定标签页的所有元素
    // const existingElementIds = new Set(existingElements.map((el: Node | Edge) => el.id)); // 不再需要此 Set
    // console.log(`[useUniqueNodeId] Existing IDs for tab ${internalId} (from store):`, existingElements.map(el => el.id)); // 添加日志

    let counter = 1;
    // 查找当前 baseType 的最大后缀数字
    existingElements.forEach((el: Node | Edge) => {
      // 检查 ID 是否以 baseType_ 开头
      if (el.id.startsWith(`${baseType}_`)) {
        const parts = el.id.split('_');
        // 确保分割后至少有两部分
        if (parts.length >= 2) {
          const numPart = parts[parts.length - 1]; // 获取最后一部分
          // 确保 numPart 是一个有效的字符串
          if (typeof numPart === 'string') {
            const num = parseInt(numPart, 10);
            // 如果是有效的数字，并且大于当前 counter，则更新 counter
            if (!isNaN(num) && num >= counter) {
              counter = num + 1; // 下一个可用的 counter 是最大值 + 1
            }
          }
        }
      }
    }); // <-- 正确的 forEach 结束位置

    // 生成最终 ID，此时 counter 已经是下一个可用的数字
    const newId = `${baseType}_${counter}`;
    // console.log(`[useUniqueNodeId] Generated new ID for tab ${internalId}: ${newId}`); // 添加日志
    // 确保生成的 ID 确实是唯一的 (虽然理论上上面的逻辑已经保证了，但可以加一层保险)
    // 如果需要更强的保证，可以在这里再加一个 while 循环检查，但通常不需要
    // let finalCounter = counter;
    // let finalId = `${baseType}_${finalCounter}`;
    // while (existingElementIds.has(finalId)) {
    //   finalCounter++;
    //   finalId = `${baseType}_${finalCounter}`;
    // }
    // console.debug(`[useUniqueNodeId] Final unique ID for tab ${internalId}: ${finalId}`);
    return newId;
  };

  return {
    generateUniqueNodeId,
  };
}