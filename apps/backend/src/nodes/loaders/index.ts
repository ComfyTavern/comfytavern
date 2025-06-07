// apps/backend/src/nodes/loaders/index.ts
// import { createNodeRegisterer } from '../../utils/nodeRegistration'; // 移除
// import { nodeManager } from '../NodeManager'; // 移除
import type { NodeDefinition } from '@comfytavern/types';

import { definition as CharacterCardLoaderNodeDefinition } from './CharacterCardLoaderNode';
import { definition as HistoryLoaderNodeDefinition } from './HistoryLoaderNode';
// 导入各个加载器节点的定义
import { definition as PresetLoaderNodeDefinition } from './PresetLoaderNode';
import { definition as RegexRuleLoaderNodeDefinition } from './RegexRuleLoaderNode';
import { definition as WorldBookLoaderNodeDefinition } from './WorldBookLoaderNode';

// 定义并导出节点定义数组
export const definitions: NodeDefinition[] = [
  { ...PresetLoaderNodeDefinition, namespace: 'core' },
  { ...WorldBookLoaderNodeDefinition, namespace: 'core' },
  { ...CharacterCardLoaderNodeDefinition, namespace: 'core' },
  { ...HistoryLoaderNodeDefinition, namespace: 'core' },
  { ...RegexRuleLoaderNodeDefinition, namespace: 'core' },
];

// console.log('Loader node definitions prepared for export.');