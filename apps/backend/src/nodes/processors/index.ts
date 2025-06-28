import type { NodeDefinition } from '@comfytavern/types';

// 导入处理器节点的定义
import { definition as ApplyRegexNodeDefinition } from './ApplyRegexNode';
import { definition as ContextBuilderNodeDefinition } from './ContextBuilderNode';
import { definition as MathOperationNodeDefinition } from './MathOperationNode';

// 定义并导出节点定义数组
export const definitions: NodeDefinition[] = [
  { ...ApplyRegexNodeDefinition, namespace: 'core' },
  { ...ContextBuilderNodeDefinition, namespace: 'core' },
  { ...MathOperationNodeDefinition, namespace: 'core' },
];
