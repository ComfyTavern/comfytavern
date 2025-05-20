// apps/backend/src/nodes/processors/index.ts
// import { createNodeRegisterer } from '../../utils/nodeRegistration'; // 移除
// import { nodeManager } from '../NodeManager'; // 移除
import type { NodeDefinition } from '@comfytavern/types';

// 导入处理器节点的定义
import { definition as ApplyRegexNodeDefinition } from './ApplyRegexNode';
import { definition as ContextBuilderNodeDefinition } from './ContextBuilderNode';

// 定义并导出节点定义数组
export const definitions: NodeDefinition[] = [
  { ...ApplyRegexNodeDefinition, namespace: 'core' },
  { ...ContextBuilderNodeDefinition, namespace: 'core' },
];

// console.log('Processor node definitions prepared for export.');