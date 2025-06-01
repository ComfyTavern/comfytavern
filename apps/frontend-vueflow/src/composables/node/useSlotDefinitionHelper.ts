import type { Node as VueFlowNode } from '@vue-flow/core';
import type {
  GroupSlotInfo,
  InputDefinition as ComfyInputDefinition,
  OutputDefinition,
  WorkflowObject,
} from '@comfytavern/types';
import { getNodeType, parseSubHandleId } from '@/utils/nodeUtils';
import { useNodeStore } from '@/stores/nodeStore';

/**
 * Composable 提供一个统一的函数来获取给定节点和句柄的插槽定义。
 * 它会根据节点类型（普通节点、NodeGroup、GroupInput、GroupOutput）
 * 和句柄类型（source/target），从正确的数据源（静态定义、节点数据、
 * NodeGroup 接口、工作流接口）查找插槽定义。
 */
export function useSlotDefinitionHelper() {
  const nodeStore = useNodeStore();

  /**
   * 获取给定节点和句柄的插槽定义。
   * @param node - VueFlow 节点对象。
   * @param handleId - 句柄的完整 ID (可能包含 __index 后缀)。
   * @param handleType - 句柄类型 ('source' 或 'target')。
   * @param currentWorkflowData - 可选，当前工作流的完整数据对象 (用于 GroupInput/Output)。
   * @returns 对应的插槽定义 (GroupSlotInfo, InputDefinition, 或 OutputDefinition)，如果找不到则为 undefined。
   */
  function getSlotDefinition(
    node: VueFlowNode,
    handleId: string | null | undefined,
    handleType: 'source' | 'target',
    currentWorkflowData?: (WorkflowObject & { id: string }) | null
  ): GroupSlotInfo | ComfyInputDefinition | OutputDefinition | undefined {
    if (!node || !handleId) return undefined;

    const { originalKey: slotKey } = parseSubHandleId(handleId);
    if (!slotKey) return undefined;

    const nodeType = getNodeType(node);
    const nodeData = node.data as any; // 使用 any 简化访问，或定义更精确的 NodeInstanceData

    // 1. 检查 NodeGroup 的接口
    if (nodeType === 'core:NodeGroup' && nodeData?.groupInterface) {
      if (handleType === 'source' && nodeData.groupInterface.outputs) {
        return nodeData.groupInterface.outputs[slotKey] as GroupSlotInfo | undefined;
      }
      if (handleType === 'target' && nodeData.groupInterface.inputs) {
        return nodeData.groupInterface.inputs[slotKey] as GroupSlotInfo | undefined;
      }
    }

    // 2. 检查 GroupInput/Output 的工作流接口
    if (currentWorkflowData) {
      if (nodeType === 'core:GroupInput' && handleType === 'source' && currentWorkflowData.interfaceInputs) {
        return currentWorkflowData.interfaceInputs[slotKey] as GroupSlotInfo | undefined;
      }
      if (nodeType === 'core:GroupOutput' && handleType === 'target' && currentWorkflowData.interfaceOutputs) {
        return currentWorkflowData.interfaceOutputs[slotKey] as GroupSlotInfo | undefined;
      }
    }

    // 3. 检查普通节点的 data.inputs/outputs (可能包含动态插槽)
    if (nodeData) {
      if (handleType === 'source' && nodeData.outputs) {
        return nodeData.outputs[slotKey] as OutputDefinition | GroupSlotInfo | undefined;
      }
      if (handleType === 'target' && nodeData.inputs) {
        return nodeData.inputs[slotKey] as ComfyInputDefinition | GroupSlotInfo | undefined;
      }
    }

    // 4. 回退到静态节点定义
    const nodeDefinition = nodeStore.getNodeDefinitionByFullType(nodeType);
    if (nodeDefinition) {
      if (handleType === 'source' && nodeDefinition.outputs) {
        return nodeDefinition.outputs[slotKey] as OutputDefinition | undefined;
      }
      if (handleType === 'target' && nodeDefinition.inputs) {
        return nodeDefinition.inputs[slotKey] as ComfyInputDefinition | undefined;
      }
    }

    // 如果所有地方都找不到
    console.warn(`[useSlotDefinitionHelper] 未找到节点 ${node.id} 句柄 ${handleId} (${handleType}) 的插槽定义。`);
    return undefined;
  }

  return {
    getSlotDefinition,
  };
}