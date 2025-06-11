import type { NodeDefinition } from '@comfytavern/types'
// Removed: import { nodeManager } from '../NodeManager'

export class GroupOutputNodeImpl {
  static async execute(inputs: Record<string, any>, context: any): Promise<Record<string, any>> {
    return {} // GroupOutput 节点本身不产生输出
  }
}


export const definition: NodeDefinition = {
  type: 'GroupOutput', // Base type name
  // namespace will be set to 'core' (or similar) via index.ts registerer
  category: 'Group', // Functional category
  displayName: '🧬组输出',
  description: '定义节点组的输出接口。\n\n- 当一个**空心插槽**被连接时，它的类型和名称会根据连接自动更新。\n- 会生成一个新的**空心插槽**以供后续连接。\n- 可在**侧边栏**编辑接口属性。',
  dynamicSlots: true, // 标记此节点支持动态插槽

  // 初始包含一个动态类型的输入插槽
  inputs: {
    input_0: { // 使用带索引的 key
      dataFlowType: 'CONVERTIBLE_ANY', // 初始类型为 'CONVERTIBLE_ANY'
      displayName: '*',
      description: '这是一个**可转换**的插槽，初始类型为 `CONVERTIBLE_ANY`。\n\n- 连接后，其类型和名称将根据连接自动更新。\n- 会生成一个新的**空心插槽**。\n- 可在**侧边栏**编辑接口属性。',
      matchCategories: ['BehaviorConvertible'],
      allowDynamicType: true // 允许类型动态改变
    }
    // 不再需要 add_input，命名在前端处理
  },

  // 输出端口通常是空的，因为这是组的终点
  outputs: {},
  execute: GroupOutputNodeImpl.execute
}

// Removed: Node registration is now handled by index.ts