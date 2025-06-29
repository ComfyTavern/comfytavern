// apps/backend/src/nodes/llm/index.ts
// import { createNodeRegisterer } from '../../utils/nodeRegistration'; // 移除
// import { nodeManager } from '../NodeManager'; // 移除
import type { NodeDefinition } from '@comfytavern/types';

// 导入 LLM 节点的定义
import {
  genericLlmRequestNodeDefinition,
  createMessageNodeDefinition,
  mergeMessagesNodeDefinition,
} from './GenericLlmRequestNode';

// 定义并导出节点定义数组
export const definitions: NodeDefinition[] = [
  { ...genericLlmRequestNodeDefinition, namespace: 'core' },
  { ...createMessageNodeDefinition, namespace: 'core' },
  { ...mergeMessagesNodeDefinition, namespace: 'core' },
  // Add other LLM nodes here in the future
];

// console.log('LLM node definitions prepared for export.');