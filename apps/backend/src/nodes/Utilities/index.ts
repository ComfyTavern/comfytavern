import type { NodeDefinition } from '@comfytavern/types';

// 导入实用工具节点的定义
import { definition as TextMergeNodeDefinition } from './MergeNode';
import { definition as RandomNumberNodeDefinition } from './RandomNumberNode';
import { definition as TestWidgetsNodeDefinition } from './TestWidgetsNode';

// 定义并导出节点定义数组
export const definitions: NodeDefinition[] = [
  { ...TextMergeNodeDefinition, namespace: 'core' },
  { ...RandomNumberNodeDefinition, namespace: 'core' },
  { ...TestWidgetsNodeDefinition, namespace: 'core' },
];