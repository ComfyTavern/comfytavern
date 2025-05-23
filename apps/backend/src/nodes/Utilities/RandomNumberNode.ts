import type { NodeDefinition, InputDefinition, OutputDefinition } from '@comfytavern/types'
// Removed: import { nodeManager } from './NodeManager'

// 注意：此节点的执行逻辑已移至前端，通过 clientScriptUrl 加载
// 后端仅负责提供节点定义元数据

// Renamed export to 'definition' for NodeLoader convention
export const definition: NodeDefinition = {
  type: 'RandomNumber', // Base type name
  // namespace will be inferred as 'core' by NodeManager based on path
  category: '实用工具', // Functional category
  displayName: '🎲随机数生成器',
  description: '生成和操作一个32位随机整数 (前端执行)',
  width: 260, // 设置默认宽度
  inputs: {
    mode: {
      dataFlowType: 'STRING', // COMBO options are strings
      displayName: '模式',
      description: '控制数字如何变化',
      matchCategories: ['ComboOption'],
      config: {
        suggestions: ['固定', '增加', '减少', '随机'], // Renamed from options
        default: '固定'
      }
    } as InputDefinition,
    value: {
      dataFlowType: 'INTEGER',
      displayName: '当前值',
      description: '当前内部存储的数值',
      config: {
        // 这个值通常由节点内部管理，但允许显示
        // 可以考虑设为 display_only 或根据需要调整
        default: 0, // 初始值将在 execute 中设置
        min: 0,
        max: 4294967295 // 2^32 - 1
      }
    } as InputDefinition,
    reroll: {
      dataFlowType: 'WILDCARD',
      displayName: '重新随机',
      description: '点击以生成一个新的随机数',
      matchCategories: ['Trigger'],
      config: {
        label: '重新随机'
      }
    } as InputDefinition
  },
  outputs: {
    number: {
      dataFlowType: 'INTEGER',
      displayName: '数值',
      description: '生成的随机数'
    } as OutputDefinition
  },
  // execute 函数已移除，逻辑在前端处理
  clientScriptUrl: 'client-scripts/RandomNumberNode.js' // 指向相对于此定义文件的前端逻辑脚本的 URL
}

// Removed: Node registration is now handled by NodeLoader

// WebSocket 按钮点击处理逻辑不再需要针对此节点，因为点击在前端处理