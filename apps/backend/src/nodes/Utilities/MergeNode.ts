import type { NodeDefinition } from '@comfytavern/types'
import { parseEscapedCharacters } from '@comfytavern/utils';

export class TextMergeNodeImpl {
  static async execute(inputs: Record<string, any>): Promise<Record<string, any>> {
    const { text_inputs = [], separator = '\n' } = inputs
    console.log(`[TextMergeNode] Inputs received: ${JSON.stringify(inputs)}`);
    console.log(`[TextMergeNode] text_inputs: ${JSON.stringify(text_inputs)}, type: ${typeof text_inputs}, isArray: ${Array.isArray(text_inputs)}`);
    console.log(`[TextMergeNode] separator: ${JSON.stringify(separator)}`);

    // 处理分隔符中的转义字符
    const processedSeparator = parseEscapedCharacters(separator);
    console.log(`[TextMergeNode] Processed separator: ${JSON.stringify(processedSeparator)}`);

    // 确保所有输入都是字符串类型，不需要转换因为已经限制了只接受STRING类型
    const values = Array.isArray(text_inputs) ? text_inputs : [text_inputs]
    console.log(`[TextMergeNode] Values to join: ${JSON.stringify(values)}`);
    const result = values.join(processedSeparator)

    return {
      merged_text: result
    }
  }
}

// Renamed export to 'definition' for NodeLoader convention
export const definition: NodeDefinition = {
  type: 'TextMerge', // Base type name
  category: '实用工具', // Functional category
  displayName: '📝文本合并',
  description: '将多个文本输入合并成一个完整的文本',

  inputs: {
    separator: {
      dataFlowType: 'STRING',
      displayName: '分隔符',
      description: '用于分隔文本的字符串',
      required: false,
      // acceptTypes is handled by dataFlowType and matchCategories
      config: {
        default: '\\n',
        multiline: false,
        placeholder: '输入分隔符',
        label: '分隔符'
      }
    },
    text_inputs: {
      dataFlowType: 'STRING',
      displayName: '文本输入',
      description: '要合并的文本输入',
      required: true,
      multi: true,
      matchCategories: ['UiBlock'], // 添加 UiBlock
    }
  },

  outputs: {
    merged_text: {
      dataFlowType: 'STRING',
      displayName: '合并文本',
      description: '合并后的文本输出'
    }
  },

  execute: TextMergeNodeImpl.execute
}

// Removed: Node registration is now handled by NodeLoader