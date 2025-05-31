import { computed } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import type { Node, Edge } from '@vue-flow/core';
import type { NodeDefinition, GroupInterfaceInfo, GroupSlotInfo, DataFlowTypeName } from '@comfytavern/types';
// 注意: isTypeCompatible 函数已替代旧的 areTypesCompatible 函数
import { isTypeCompatible } from '../group/useWorkflowGrouping';

// 定义 Composable 函数的选项接口
interface UseNodeGroupConnectionValidationOptions {
  nodes: Ref<Node[]> | ComputedRef<Node[]>;
  edges: Ref<Edge[]> | ComputedRef<Edge[]>;
  nodeDefinitions: Ref<NodeDefinition[]> | ComputedRef<NodeDefinition[]>;
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
  nodeDefinitions,
  // areTypesCompatible, // 移除参数
}: UseNodeGroupConnectionValidationOptions): ComputedRef<string[]> {

  const invalidEdgeIds = computed(() => {
    const currentNodes = nodes.value;
    const currentEdges = edges.value;
    // 使用 n.type 和带命名空间的类型
    const nodeGroups = currentNodes.filter(n => n.type === 'core:NodeGroup');
    const edgesToRemove: string[] = [];

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
              const sourceHandleId = edge.sourceHandle || 'default'; // 假设默认句柄 ID
              // 使用命名空间和基础类型正确查找 sourceNodeDef ---
              let sourceNodeDef: NodeDefinition | undefined;
              const fullSourceNodeType = sourceNode?.data?.nodeType || sourceNode?.type;
              if (fullSourceNodeType) {
                const typeParts = fullSourceNodeType.split(':');
                const baseType = typeParts.length > 1 ? typeParts[1] : typeParts[0];
                const namespace = typeParts.length > 1 ? typeParts[0] : 'core'; // 默认为 'core' 或根据需要处理
                sourceNodeDef = nodeDefinitions.value.find(
                  (def) => def.type === baseType && def.namespace === namespace
                );
              }
              const sourceOutputDef = sourceNodeDef?.outputs?.[sourceHandleId];
              if (!sourceOutputDef) {
                isCompatible = false;
                // 原因 = `在节点 ${sourceNode?.id} 上未找到源输出定义 '${sourceHandleId}'`;
              } else {
                const sourceSlotInfo: GroupSlotInfo = {
                  key: sourceHandleId,
                  displayName: sourceOutputDef.displayName || sourceHandleId,
                  dataFlowType: sourceOutputDef.dataFlowType as DataFlowTypeName, // 类型断言，因为它来自 NodeDefinition
                  matchCategories: sourceOutputDef.matchCategories,
                  // GroupSlotInfo 中的其他字段可以是 undefined 或默认值
                };
                const compatibleResultInput = isTypeCompatible(sourceSlotInfo, inputSlot);
                if (!compatibleResultInput) {
                  isCompatible = false;
                  // 原因 = `类型不匹配：源 (${sourceSlotInfo.dataFlowType}) -> 节点组输入 '${slotKey}' (${inputSlot.dataFlowType})`;
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
              const targetHandleId = edge.targetHandle || 'default'; // 假设默认句柄 ID
              // 使用命名空间和基础类型正确查找 targetNodeDef ---
              let targetInputDef: GroupSlotInfo | undefined; // 类型改为 GroupSlotInfo | undefined
              const fullTargetNodeType = targetNode?.data?.nodeType || targetNode?.type;

              if (targetNode?.type === 'core:GroupOutput' && targetNode.data?.inputs?.[targetHandleId]) {
                targetInputDef = targetNode.data.inputs[targetHandleId] as GroupSlotInfo;
              } else if (fullTargetNodeType) {
                const typeParts = fullTargetNodeType.split(':');
                const baseType = typeParts.length > 1 ? typeParts[1] : typeParts[0];
                const namespace = typeParts.length > 1 ? typeParts[0] : 'core';
                const staticTargetNodeDef = nodeDefinitions.value.find(
                  (def) => def.type === baseType && def.namespace === namespace
                );
                targetInputDef = staticTargetNodeDef?.inputs?.[targetHandleId] as GroupSlotInfo | undefined; // 从静态定义获取
              }

              if (!targetInputDef) {
                isCompatible = false;
                // 原因 = `在节点 ${targetNode?.id} 上未找到目标输入定义 '${targetHandleId}'`;
              } else {
                const targetSlotInfo: GroupSlotInfo = {
                  key: targetHandleId,
                  displayName: targetInputDef.displayName || targetHandleId,
                  dataFlowType: targetInputDef.dataFlowType as DataFlowTypeName, // 类型断言，因为它来自 NodeDefinition
                  matchCategories: targetInputDef.matchCategories,
                  // GroupSlotInfo 中的其他字段可以是 undefined 或默认值
                };
                const compatibleResultOutput = isTypeCompatible(outputSlot, targetSlotInfo);
                if (!compatibleResultOutput) {
                  isCompatible = false;
                  // 原因 = `类型不匹配：节点组输出 '${slotKey}' (${outputSlot.dataFlowType}) -> 目标 (${targetSlotInfo.dataFlowType})`;
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