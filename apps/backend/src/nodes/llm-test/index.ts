// import { createNodeRegisterer } from '../../utils/nodeRegistration'; // 移除
// import { nodeManager } from '../NodeManager'; // 移除
import type { NodeDefinition } from '@comfytavern/types';

// 导入各个节点的定义
import { definition as APISettingsNodeDefinition } from './APISettingsNode';
import { definition as HistoryNodeDefinition } from './HistoryNode';
import { definition as MergeHistoryNodeDefinition } from './MergeHistoryNode';
import { definition as OpenAIChatNodeDefinition } from './OpenAIChatNode';
import { definition as OpenAINodeDefinition } from './OpenAINode';

// 定义并导出节点定义数组
// 将这些 LLM 测试节点视为核心功能的一部分，并显式设置 namespace
export const definitions: NodeDefinition[] = [
  { ...APISettingsNodeDefinition, namespace: 'core' },
  { ...HistoryNodeDefinition, namespace: 'core' },
  { ...MergeHistoryNodeDefinition, namespace: 'core' },
  { ...OpenAIChatNodeDefinition, namespace: 'core' },
  { ...OpenAINodeDefinition, namespace: 'core' },
];

// console.log('LLM test node definitions prepared for export.');