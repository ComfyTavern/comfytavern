import type { NodeDefinition, GroupSlotInfo } from '@comfytavern/types' // 导入 GroupSlotInfo
// Removed: import { nodeManager } from '../NodeManager'

export class GroupInputNodeImpl {
  static async execute(
    _inputs: Record<string, any>, // GroupInputNode 通常没有自己的输入，值来自工作流接口
    context: { // 为 context 添加更具体的类型提示
      promptId: string;
      workflowInterfaceInputs?: Record<string, GroupSlotInfo>;
      workflowInterfaceOutputs?: Record<string, GroupSlotInfo>; // 虽然 GroupInput 用不到这个
    }
  ): Promise<Record<string, any>> {
    const outputs: Record<string, any> = {};

    if (context.workflowInterfaceInputs) {
      for (const key in context.workflowInterfaceInputs) {
        const slotInfo = context.workflowInterfaceInputs[key];
        // GroupInputNode 的输出值应该直接取自 interfaceInputs 的配置值 (通常是 default)
        // 因为这些值代表了工作流执行时顶层输入的值
        if (slotInfo && slotInfo.config && slotInfo.config.default !== undefined) {
          outputs[key] = slotInfo.config.default;
        } else if (slotInfo) {
          // 如果 slotInfo 存在但没有 config.default，则该接口输入可能没有提供值
          // 根据设计，GroupInputNode 的输出应该反映 interfaceInputs 的状态
          // 如果 interfaceInput 没有值，则对应输出也应该是 undefined
          outputs[key] = undefined;
        }
        // 如果 slotInfo 不存在 (理论上不应该，因为 key 来自 workflowInterfaceInputs)，
        // 则 outputs[key] 不会被设置，保持 undefined
      }
    }
    // console.log(`[GroupInputNode DEBUG] Executing node. Received context:`, JSON.stringify(context, null, 2));
    // console.log(`[GroupInputNode DEBUG] workflowInterfaceInputs from context:`, JSON.stringify(context.workflowInterfaceInputs, null, 2));
    // console.log(`[GroupInputNode DEBUG] Produced outputs:`, JSON.stringify(outputs, null, 2));
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