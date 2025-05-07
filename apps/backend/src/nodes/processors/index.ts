// apps/backend/src/nodes/processors/index.ts
import { createNodeRegisterer } from '../../utils/nodeRegistration';
import { nodeManager } from '../NodeManager';

// 导入处理器节点的定义
import { definition as ApplyRegexNodeDefinition } from './ApplyRegexNode';
import { definition as ContextBuilderNodeDefinition } from './ContextBuilderNode';

// 创建一个注册器实例，设置默认命名空间为 'core'
const registerProcessorNodes = createNodeRegisterer('core');

// 使用注册器批量注册导入的节点定义
registerProcessorNodes.register(
  nodeManager,
  [
    ApplyRegexNodeDefinition,
    ContextBuilderNodeDefinition,
  ],
  __filename // 传递当前文件的路径
);

// console.log('Processor nodes registered with default namespace \'core\'');