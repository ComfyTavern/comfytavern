// import { createNodeRegisterer } from '../../utils/nodeRegistration'; // 移除
// import { nodeManager } from '../NodeManager'; // 移除

// 导入各个节点的定义
import { definition as GroupInputNodeDefinition } from './GroupInputNode';
import { definition as GroupOutputNodeDefinition } from './GroupOutputNode';
import { definition as NodeGroupNodeDefinition } from './NodeGroupNode';

import type { NodeDefinition } from '@comfytavern/types';

// 定义并导出节点定义数组
// 我们将 IO 和 Group 相关节点视为核心功能，并显式设置 namespace
export const definitions: NodeDefinition[] = [
  { ...GroupInputNodeDefinition, namespace: 'core' },
  { ...GroupOutputNodeDefinition, namespace: 'core' },
  { ...NodeGroupNodeDefinition, namespace: 'core' },
];

// console.log('IO node definitions prepared for export.');