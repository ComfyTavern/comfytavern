import { computed } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import type { Node, Edge } from '@vue-flow/core';
import type { NodeDefinition, GroupInterfaceInfo, GroupSlotInfo } from '@comfytavern/types';
// 注意: isTypeCompatible 函数已替代旧的 areTypesCompatible 函数
import { isTypeCompatible } from '../group/useWorkflowGrouping';
// import { getNodeType } from '@/utils/nodeUtils'; // 新增导入
import { useSlotDefinitionHelper } from './useSlotDefinitionHelper';
import { useWorkflowStore } from '@/stores/workflowStore'; // 新增导入，用于获取完整的 workflowData

// 定义 Composable 函数的选项接口
interface UseNodeGroupConnectionValidationOptions {
  nodes: Ref<Node[]> | ComputedRef<Node[]>;
  edges: Ref<Edge[]> | ComputedRef<Edge[]>;
  nodeDefinitions: Ref<NodeDefinition[]> | ComputedRef<NodeDefinition[]>;
  // 移除 currentWorkflowInterface 参数，因为我们将从 store 中获取完整的 workflowData
  // areTypesCompatible 不再作为参数传递
}

/**
 * Composable 用于验证 NodeGroup 节点的连接是否与其接口快照兼容。
 * @param options - 包含节点、边和节点定义的选项对象。
 * @returns 一个计算属性，包含所有无效连接边的 ID 数组。
 */
export function useNodeGroupConnectionValidation({
  nodes,
  edges,
  // nodeDefinitions,
  // areTypesCompatible, // 移除参数
}: UseNodeGroupConnectionValidationOptions): ComputedRef<string[]> {
  const workflowStore = useWorkflowStore(); // 获取 workflow store

  const invalidEdgeIds = computed(() => {
    const currentNodes = nodes.value;
    const currentEdges = edges.value;
    // 使用 n.type 和带命名空间的类型
    const nodeGroups = currentNodes.filter(n => n.type === 'core:NodeGroup');
    const edgesToRemove: string[] = [];

    // 从 store 中获取完整的 workflowData
    const workflowData = workflowStore.getActiveTabState()?.workflowData;

    for (const nodeGroup of nodeGroups) {
      const groupInterface = nodeGroup.data?.groupInterface as GroupInterfaceInfo | undefined;
      if (!groupInterface) {
        continue;
      }

      const connectedEdges = currentEdges.filter(e => e.source === nodeGroup.id || e.target === nodeGroup.id);

      for (const edge of connectedEdges) {
        let isCompatible = true;
        if (edge.target === nodeGroup.id) { // 输入边
          const slotKey = edge.targetHandle;
          if (typeof slotKey !== 'string' || !slotKey) {
            isCompatible = false;
            // 原因 = `边 ${edge.id} 上的目标句柄无效`;
          } else {
            const inputSlot = groupInterface.inputs?.[slotKey];
            if (!inputSlot) {
              isCompatible = false;
              // 原因 = `在节点组 ${nodeGroup.id} 中未找到输入插槽 '${slotKey}'`;
            } else {
              // 检查类型
              const sourceNode = currentNodes.find(n => n.id === edge.source);
              const sourceHandleId = edge.sourceHandle;

              // 使用统一的辅助函数获取源插槽定义
              const { getSlotDefinition } = useSlotDefinitionHelper();
              // 传递完整的 workflowData 作为第四个参数
              const sourceSlotToCompare = sourceNode ? getSlotDefinition(sourceNode, sourceHandleId, 'source', workflowData) as GroupSlotInfo | undefined : undefined;

              if (!sourceSlotToCompare) {
                isCompatible = false;
                // 原因 = `在节点 ${sourceNode?.id} 上未找到源输出定义 '${sourceHandleId}'`;
              } else {
                const compatibleResultInput = isTypeCompatible(sourceSlotToCompare, inputSlot);
                if (!compatibleResultInput) {
                  isCompatible = false;
                  // 原因 = `类型不匹配：源 (${sourceSlotToCompare.dataFlowType}) -> 节点组输入 '${slotKey}' (${inputSlot.dataFlowType})`;
                }
              }
            }
          }
        } else { // 输出边 (edge.source === nodeGroup.id)
          const slotKey = edge.sourceHandle;
          if (typeof slotKey !== 'string' || !slotKey) {
            isCompatible = false;
            // 原因 = `边 ${edge.id} 上的源句柄无效`;
          } else {
            const outputSlot = groupInterface.outputs?.[slotKey];
            if (!outputSlot) {
              isCompatible = false;
              // 原因 = `在节点组 ${nodeGroup.id} 中未找到输出插槽 '${slotKey}'`;
            } else {
              // 检查类型
              const targetNode = currentNodes.find(n => n.id === edge.target);
              const targetHandleId = edge.targetHandle;

              // 使用统一的辅助函数获取目标插槽定义
              const { getSlotDefinition } = useSlotDefinitionHelper();
              // 传递完整的 workflowData 作为第四个参数
              const targetSlotToCompare = targetNode ? getSlotDefinition(targetNode, targetHandleId, 'target', workflowData) as GroupSlotInfo | undefined : undefined;

              if (!targetSlotToCompare) {
                isCompatible = false;
                // 原因 = `在节点 ${targetNode?.id} 上未找到目标输入定义 '${targetHandleId}'`;
              } else {
                const compatibleResultOutput = isTypeCompatible(outputSlot, targetSlotToCompare);
                if (!compatibleResultOutput) {
                  isCompatible = false;
                  // 原因 = `类型不匹配：节点组输出 '${slotKey}' (${outputSlot.dataFlowType}) -> 目标 (${targetSlotToCompare.dataFlowType})`;
                }
              }
            }
          }
        }

        if (!isCompatible) {
          edgesToRemove.push(edge.id);
        }
      }
    }
    // 返回去重后的 ID 列表
    return [...new Set(edgesToRemove)];
  });

  return invalidEdgeIds;
}