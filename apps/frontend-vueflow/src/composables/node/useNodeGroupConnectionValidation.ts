import { computed } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import type { Node, Edge } from '@vue-flow/core';
import type { NodeDefinition, GroupInterfaceInfo, GroupSlotInfo, DataFlowTypeName } from '@comfytavern/types'; // Removed unused InputDefinition, OutputDefinition
import { isTypeCompatible } from '../group/useWorkflowGrouping'; // Changed areTypesCompatible to isTypeCompatible

// 定义 Composable 函数的选项接口
interface UseNodeGroupConnectionValidationOptions {
  nodes: Ref<Node[]> | ComputedRef<Node[]>;
  edges: Ref<Edge[]> | ComputedRef<Edge[]>;
  nodeDefinitions: Ref<NodeDefinition[]> | ComputedRef<NodeDefinition[]>;
  // areTypesCompatible 不再作为参数传递
}

/**
 * Composable 用于验证 NodeGroup 节点的连接是否与其接口快照兼容。
 * @param options - 包含节点、边、节点定义和类型兼容性检查函数的选项对象。
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
    // Roo: 使用 n.type 和带命名空间的类型
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
        let reason = '';

        if (edge.target === nodeGroup.id) { // 输入边
          const slotKey = edge.targetHandle;
          if (typeof slotKey !== 'string' || !slotKey) {
            isCompatible = false;
            reason = `Invalid target handle on edge ${edge.id}`;
          } else {
            const inputSlot = groupInterface.inputs?.[slotKey];
            if (!inputSlot) {
              isCompatible = false;
              reason = `Input slot '${slotKey}' not found in NodeGroup ${nodeGroup.id}`;
            } else {
              // 检查类型
              const sourceNode = currentNodes.find(n => n.id === edge.source);
              const sourceHandleId = edge.sourceHandle || 'default'; // 假设默认句柄 ID
              const sourceNodeDef = nodeDefinitions.value.find(def => def.type === sourceNode?.data?.nodeType);
              // 处理源节点或定义不存在的情况，以及句柄不存在的情况
              const sourceOutputDef = sourceNodeDef?.outputs?.[sourceHandleId];
              if (!sourceOutputDef) {
                isCompatible = false;
                reason = `Source output definition '${sourceHandleId}' not found on node ${sourceNode?.id}`;
              } else {
                const sourceSlotInfo: GroupSlotInfo = {
                  key: sourceHandleId,
                  displayName: sourceOutputDef.displayName || sourceHandleId,
                  dataFlowType: sourceOutputDef.dataFlowType as DataFlowTypeName, // Cast as it comes from NodeDefinition
                  matchCategories: sourceOutputDef.matchCategories,
                  // other fields from GroupSlotInfo can be undefined or default
                };
                if (!isTypeCompatible(sourceSlotInfo, inputSlot)) {
                  isCompatible = false;
                  reason = `Type mismatch: Source (${sourceSlotInfo.dataFlowType}) -> NodeGroup Input '${slotKey}' (${inputSlot.dataFlowType})`;
                }
              }
            }
          }
        } else { // 输出边 (edge.source === nodeGroup.id)
          const slotKey = edge.sourceHandle;
          if (typeof slotKey !== 'string' || !slotKey) {
            isCompatible = false;
            reason = `Invalid source handle on edge ${edge.id}`;
          } else {
            const outputSlot = groupInterface.outputs?.[slotKey];
            if (!outputSlot) {
              isCompatible = false;
              reason = `Output slot '${slotKey}' not found in NodeGroup ${nodeGroup.id}`;
            } else {
              // 检查类型
              const targetNode = currentNodes.find(n => n.id === edge.target);
              const targetHandleId = edge.targetHandle || 'default'; // 假设默认句柄 ID
              const targetNodeDef = nodeDefinitions.value.find(def => def.type === targetNode?.data?.nodeType);
              const targetInputDef = targetNodeDef?.inputs?.[targetHandleId];

              if (!targetInputDef) {
                isCompatible = false;
                reason = `Target input definition '${targetHandleId}' not found on node ${targetNode?.id}`;
              } else {
                const targetSlotInfo: GroupSlotInfo = {
                  key: targetHandleId,
                  displayName: targetInputDef.displayName || targetHandleId,
                  dataFlowType: targetInputDef.dataFlowType as DataFlowTypeName, // Cast as it comes from NodeDefinition
                  matchCategories: targetInputDef.matchCategories,
                  // other fields from GroupSlotInfo can be undefined or default
                };
                if (!isTypeCompatible(outputSlot, targetSlotInfo)) {
                  isCompatible = false;
                  reason = `Type mismatch: NodeGroup Output '${slotKey}' (${outputSlot.dataFlowType}) -> Target (${targetSlotInfo.dataFlowType})`;
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