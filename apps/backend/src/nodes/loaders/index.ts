// apps/backend/src/nodes/loaders/index.ts
import { createNodeRegisterer } from '../../utils/nodeRegistration';
import { nodeManager } from '../NodeManager';

// 导入各个加载器节点的定义
import { definition as PresetLoaderNodeDefinition } from './PresetLoaderNode';
import { definition as WorldBookLoaderNodeDefinition } from './WorldBookLoaderNode';
import { definition as CharacterCardLoaderNodeDefinition } from './CharacterCardLoaderNode';
import { definition as HistoryLoaderNodeDefinition } from './HistoryLoaderNode';
import { definition as RegexRuleLoaderNodeDefinition } from './RegexRuleLoaderNode';

// 创建一个注册器实例，设置默认命名空间为 'core'
const registerLoaderNodes = createNodeRegisterer('core');

// 使用注册器批量注册导入的节点定义
registerLoaderNodes.register(
  nodeManager,
  [
    PresetLoaderNodeDefinition,
    WorldBookLoaderNodeDefinition,
    CharacterCardLoaderNodeDefinition,
    HistoryLoaderNodeDefinition,
    RegexRuleLoaderNodeDefinition,
  ],
  __filename // 传递当前文件的路径
);

// console.log('Loader nodes registered with default namespace \'core\'');