import { createNodeRegisterer } from '../../utils/nodeRegistration';
import { nodeManager } from '../NodeManager';

// 导入各个节点的定义
import { definition as APISettingsNodeDefinition } from './APISettingsNode';
import { definition as HistoryNodeDefinition } from './HistoryNode';
import { definition as MergeHistoryNodeDefinition } from './MergeHistoryNode';
import { definition as OpenAIChatNodeDefinition } from './OpenAIChatNode';
import { definition as OpenAINodeDefinition } from './OpenAINode';

// 创建一个注册器实例，设置默认命名空间为 'core'
// 将这些 LLM 测试节点视为核心功能的一部分
const registerCoreLLMNodes = createNodeRegisterer('core'); // Change 'builtin' to 'core'

// 使用注册器批量注册导入的节点定义
registerCoreLLMNodes.register( // Use the renamed registerer
  nodeManager,
  [
    APISettingsNodeDefinition,
    HistoryNodeDefinition,
    MergeHistoryNodeDefinition,
    OpenAIChatNodeDefinition,
    OpenAINodeDefinition,
  ],
  __filename // 传递当前文件的路径
);

// console.log('LLM test nodes registered with default namespace \'core\''); // Update log message