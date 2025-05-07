// apps/backend/src/nodes/llm/index.ts
import { createNodeRegisterer } from '../../utils/nodeRegistration';
import { nodeManager } from '../NodeManager';

// 导入 LLM 节点的定义
import { definition as GenericLlmRequestNodeDefinition } from './GenericLlmRequestNode';

// 创建一个注册器实例，设置默认命名空间为 'core'
const registerLlmNodes = createNodeRegisterer('core');

// 使用注册器批量注册导入的节点定义
registerLlmNodes.register(
  nodeManager,
  [
    GenericLlmRequestNodeDefinition,
    // Add other LLM nodes here in the future
  ],
  __filename // 传递当前文件的路径
);

// console.log('LLM nodes registered with default namespace \'core\''); // 保持注释掉