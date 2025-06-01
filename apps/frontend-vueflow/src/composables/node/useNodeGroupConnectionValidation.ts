import { computed } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import type { Node, Edge } from '@vue-flow/core';
import type { NodeDefinition, GroupInterfaceInfo, GroupSlotInfo, DataFlowTypeName } from '@comfytavern/types';
// 注意: isTypeCompatible 函数已替代旧的 areTypesCompatible 函数
import { isTypeCompatible } from '../group/useWorkflowGrouping';
import { getNodeType } from '@/utils/nodeUtils'; // 新增导入

// 定义 Composable 函数的选项接口
interface UseNodeGroupConnectionValidationOptions {
  nodes: Ref<Node[]> | ComputedRef<Node[]>;
  edges: Ref<Edge[]> | ComputedRef<Edge[]>;
  nodeDefinitions: Ref<NodeDefinition[]> | ComputedRef<NodeDefinition[]>;
  currentWorkflowInterface: Ref<{ inputs: Record<string, GroupSlotInfo>, outputs: Record<string, GroupSlotInfo> } | undefined>;
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
  currentWorkflowInterface,
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
              // 使用命名空间和基础类型正确查找 sourceNodeDef ---
              const sourceHandleId = edge.sourceHandle || 'default'; // 移到这里，因为下面会用到
              let sourceSlotToCompare: GroupSlotInfo | undefined;

            if (sourceNode?.type === 'core:GroupInput') {
              // console.debug(`[useNodeGroupConnectionValidation] Source is GroupInput (${sourceNode.id}). Handle: ${sourceHandleId}. Current WF Interface:`, currentWorkflowInterface.value);
              const interfaceInputDef = currentWorkflowInterface.value?.inputs?.[sourceHandleId];
              if (interfaceInputDef) {
                sourceSlotToCompare = interfaceInputDef;
                // console.debug(`[useNodeGroupConnectionValidation] Found source slot in current WF interface inputs:`, sourceSlotToCompare);
              } else {
                console.warn(`[useNodeGroupConnectionValidation] GroupInput source slot '${sourceHandleId}' not found in current workflow interface inputs.`);
              }
            } else if (sourceNode?.data?.outputs?.[sourceHandleId]) {
              // 优先使用节点实例上可能已动态更新的插槽定义
              const dynamicSlot = sourceNode.data.outputs[sourceHandleId];
              // 假设 dynamicSlot 结构兼容 GroupSlotInfo (至少包含 dataFlowType, matchCategories)
              sourceSlotToCompare = {
                  key: sourceHandleId, // key 必须是句柄 ID
                  displayName: dynamicSlot.displayName || sourceHandleId,
                  dataFlowType: dynamicSlot.dataFlowType,
                  matchCategories: dynamicSlot.matchCategories,
                  // 其他 GroupSlotInfo 字段可以从 dynamicSlot 获取或设为默认
              };
              // console.debug(`[useNodeGroupConnectionValidation] Found source slot in dynamic node data outputs:`, sourceSlotToCompare);
            } else {
              const fullSourceNodeType = getNodeType(sourceNode);
              if (fullSourceNodeType && fullSourceNodeType !== 'unknown') {
                const typeParts = fullSourceNodeType.split(':');
                const baseType = typeParts.length > 1 ? typeParts[1] : typeParts[0];
                const namespace = typeParts.length > 1 ? typeParts[0] : 'core';
                const staticSourceNodeDef = nodeDefinitions.value.find(
                  (def) => def.type === baseType && def.namespace === namespace
                );
                const staticOutputDef = staticSourceNodeDef?.outputs?.[sourceHandleId];
                if (staticOutputDef) {
                  sourceSlotToCompare = {
                    key: sourceHandleId,
                    displayName: staticOutputDef.displayName || sourceHandleId,
                    dataFlowType: staticOutputDef.dataFlowType as DataFlowTypeName,
                    matchCategories: staticOutputDef.matchCategories,
                  };
                  // console.debug(`[useNodeGroupConnectionValidation] Found source slot in static node definition:`, sourceSlotToCompare);
                } else {
                  console.warn(`[useNodeGroupConnectionValidation] Source slot '${sourceHandleId}' not found in static definition for node ${sourceNode?.id} (${fullSourceNodeType}).`);
                }
              } else {
                console.warn(`[useNodeGroupConnectionValidation] Could not determine fullSourceNodeType for source node ${sourceNode?.id}.`);
              }
            }

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
              const targetHandleId = edge.targetHandle || 'default';
              let targetSlotToCompare: GroupSlotInfo | undefined;

            if (targetNode?.type === 'core:GroupOutput') {
              // console.debug(`[useNodeGroupConnectionValidation] Target is GroupOutput (${targetNode.id}). Handle: ${targetHandleId}. Current WF Interface:`, currentWorkflowInterface.value);
              const interfaceOutputDef = currentWorkflowInterface.value?.outputs?.[targetHandleId];
              if (interfaceOutputDef) {
                targetSlotToCompare = interfaceOutputDef;
                // console.debug(`[useNodeGroupConnectionValidation] Found target slot in current WF interface outputs:`, targetSlotToCompare);
              } else {
                console.warn(`[useNodeGroupConnectionValidation] GroupOutput target slot '${targetHandleId}' not found in current workflow interface outputs.`);
              }
            } else if (targetNode?.data?.inputs?.[targetHandleId]) {
              // 优先使用节点实例上可能已动态更新的插槽定义
              const dynamicSlot = targetNode.data.inputs[targetHandleId];
              targetSlotToCompare = {
                  key: targetHandleId,
                  displayName: dynamicSlot.displayName || targetHandleId,
                  dataFlowType: dynamicSlot.dataFlowType,
                  matchCategories: dynamicSlot.matchCategories,
              };
              // console.debug(`[useNodeGroupConnectionValidation] Found target slot in dynamic node data inputs:`, targetSlotToCompare);
            } else {
              const fullTargetNodeType = getNodeType(targetNode);
              if (fullTargetNodeType && fullTargetNodeType !== 'unknown') {
                  const typeParts = fullTargetNodeType.split(':');
                  const baseType = typeParts.length > 1 ? typeParts[1] : typeParts[0];
                  const namespace = typeParts.length > 1 ? typeParts[0] : 'core';
                  const staticTargetNodeDef = nodeDefinitions.value.find(
                      (def) => def.type === baseType && def.namespace === namespace
                  );
                  const staticInputDef = staticTargetNodeDef?.inputs?.[targetHandleId];
                  if (staticInputDef) {
                      targetSlotToCompare = {
                          key: targetHandleId,
                          displayName: staticInputDef.displayName || targetHandleId,
                          dataFlowType: staticInputDef.dataFlowType as DataFlowTypeName,
                          matchCategories: staticInputDef.matchCategories,
                      };
                      // console.debug(`[useNodeGroupConnectionValidation] Found target slot in static node definition:`, targetSlotToCompare);
                  } else {
                    console.warn(`[useNodeGroupConnectionValidation] Target slot '${targetHandleId}' not found in static definition for node ${targetNode?.id} (${fullTargetNodeType}).`);
                  }
              } else {
                console.warn(`[useNodeGroupConnectionValidation] Could not determine fullTargetNodeType for target node ${targetNode?.id}.`);
              }
            }

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