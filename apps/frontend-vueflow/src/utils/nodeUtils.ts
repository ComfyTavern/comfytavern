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

/**
 * 解析句柄 ID，区分普通句柄和子句柄 (例如 'key__0')。
 * @param handleId 待解析的句柄 ID。
 * @returns 返回一个对象，包含原始键名、可选的索引和是否为子句柄的布尔值。
 */
export function parseSubHandleId(handleId: string | null | undefined): { originalKey: string; index?: number; isSubHandle: boolean } {
  if (!handleId) { // Covers null, undefined, and empty string ""
    return { originalKey: '', index: undefined, isSubHandle: false };
  }
  const parts = handleId.split('__');
  
  if (parts.length === 2) {
    const keyPart = parts[0];
    const indexStrPart = parts[1];
    // 显式检查以帮助 TypeScript 缩小类型，即使逻辑上已知它们是字符串
    if (typeof keyPart === 'string' && typeof indexStrPart === 'string') {
      const potentialIndex = parseInt(indexStrPart, 10);
      if (!isNaN(potentialIndex)) {
        return { originalKey: keyPart, index: potentialIndex, isSubHandle: true };
      }
    }
  }
  // 如果不符合 "key__index" 格式，或 index 不是数字，或类型检查未通过，
  // 则原始的 handleId 作为 key。
  return { originalKey: handleId, index: undefined, isSubHandle: false };
}

// 未来可以添加更多节点相关的工具函数到这里...