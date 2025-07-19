import type { FrontendNodeDefinition } from '@/stores/nodeStore';

/**
 * The definition for the FrameNode.
 * This is a UI-only node and does not have a corresponding backend implementation.
 * It's added to the node definitions on the frontend in the nodeStore.
 */
export const FrameNodeDefinition: FrontendNodeDefinition = {
  namespace: 'core',
  type: 'frame',
  displayName: '分组框',
  category: 'layout',
  description: '一个用于在画布上组织节点的视觉分组框。',
  inputs: {},
  outputs: {},
  isUiNode: true, // 标识这是一个纯UI节点
};