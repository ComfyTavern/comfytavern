import type { Node as VueFlowNode } from '@vue-flow/core';

/**
 * 获取 Vue Flow 节点的类型。
 * 优先使用顶层的 `type` 属性。
 * @param node - Vue Flow 节点对象。
 * @returns 节点的类型字符串，如果无法确定则返回 'unknown'。
 */
export function getNodeType(node: VueFlowNode | undefined | null): string {
  // 优先检查顶层 type 属性
  if (node?.type) {
    return node.type;
  }

  // 可以选择性地添加对旧结构 node.data.nodeType 的回退检查，但根据当前情况，
  // 最好是强制使用新的结构。如果需要兼容旧数据，可以在这里添加：
  // if (node?.data?.nodeType) {
  //   console.warn(`Node ${node.id} is using deprecated node.data.nodeType. Please update to node.type.`);
  //   return node.data.nodeType;
  // }

  console.warn(`Could not determine type for node:`, node);
  return 'unknown'; // 或者返回 undefined，取决于调用处的处理方式
}

// 未来可以添加更多节点相关的工具函数到这里...