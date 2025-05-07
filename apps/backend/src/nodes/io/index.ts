import { createNodeRegisterer } from '../../utils/nodeRegistration';
import { nodeManager } from '../NodeManager';

// 导入各个节点的定义
import { definition as GroupInputNodeDefinition } from './GroupInputNode';
import { definition as GroupOutputNodeDefinition } from './GroupOutputNode';
import { definition as NodeGroupNodeDefinition } from './NodeGroupNode';

// 创建一个注册器实例，设置默认命名空间为 'core'
// 我们将 IO 和 Group 相关节点视为核心功能
const registerCoreIONodes = createNodeRegisterer('core');

// 使用注册器批量注册导入的节点定义
// 注意：传递 __filename 给 register 方法，以便 NodeManager 可以获取路径信息
// （虽然在此场景下，由于设置了 defaultNamespace，路径推断可能不会被触发）
registerCoreIONodes.register(
  nodeManager,
  [
    GroupInputNodeDefinition,
    GroupOutputNodeDefinition,
    NodeGroupNodeDefinition,
  ],
  __filename // 传递当前文件的路径
);

// 不再需要单独导出每个节点，因为它们已经通过 index.ts 被加载和注册
// export * from './GroupInputNode'
// export * from './GroupOutputNode'
// export * from './NodeGroupNode'

// console.log('IO nodes registered with default namespace \'core\'');