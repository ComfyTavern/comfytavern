import type { NodeDefinition } from '@comfytavern/types'
// Removed: import { nodeManager } from '../NodeManager'

export class GroupInputNodeImpl {
  static async execute(inputs: Record<string, any>, context: any): Promise<Record<string, any>> {
    // 执行逻辑：从执行上下文 (context) 中获取整个节点组 (NodeGroup) 的输入值。
    // 这些输入值是由外部连接到 NodeGroup 节点的输入端口提供的。
    const outputs: Record<string, any> = {};
    return outputs;
  }
}

// Renamed export to 'definition'
export const definition: NodeDefinition = {
  type: 'GroupInput', // Base type name
  // namespace will be set to 'core' (or similar) via index.ts registerer
  category: 'Group', // Functional category
  displayName: '🧬组输入',
  description: '定义节点组的输入接口。\n\n- 当一个**空心插槽**被连接时，它的类型和名称会根据连接自动更新。\n- 会生成一个新的**空心插槽**以供后续连接。\n- 可在**侧边栏**编辑接口属性。',
  dynamicSlots: true, // 标记此节点支持动态插槽

  // GroupInput 没有固定的输入，值来自外部
  inputs: {},

  // 初始包含一个动态类型的输出插槽
  outputs: {
    output_0: { // 使用带索引的 key
      dataFlowType: 'CONVERTIBLE_ANY', // 初始类型为 'CONVERTIBLE_ANY'
      displayName: '*',
      description: '这是一个**可转换**的插槽，初始类型为 `CONVERTIBLE_ANY`。\n\n- 连接后，其类型和名称将根据连接自动更新。\n- 会生成一个新的**空心插槽**。\n- 可在**侧边栏**编辑接口属性。',
      matchCategories: ['BehaviorConvertible'],
      allowDynamicType: true // 允许类型动态改变
    }
  },
  execute: GroupInputNodeImpl.execute
}

// Removed: Node registration is now handled by index.ts