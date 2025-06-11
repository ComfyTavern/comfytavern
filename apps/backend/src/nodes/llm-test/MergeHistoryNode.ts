import type { NodeDefinition, CustomMessage } from '@comfytavern/types'

export class MergeHistoryNodeImpl {
  static async execute(inputs: Record<string, any>): Promise<Record<string, any>> {
    const {
      history1,
      history2,
      history3,
      history4
    } = inputs

    const merged: CustomMessage[] = []

    for (const history of [history1, history2, history3, history4]) {
      if (history) {
        try {
          const messages = JSON.parse(history) as CustomMessage[]
          merged.push(...messages)
        } catch (error) {
          console.warn('警告: 无效的历史记录JSON格式:', history)
        }
      }
    }

    return {
      history: JSON.stringify(merged)
    }
  }
}


export const definition: NodeDefinition = {
  type: 'MergeHistory', // Base type name
  // namespace will be set via index.ts registerer (e.g., 'builtin')
  category: 'TEST-LLM', // Functional category
  displayName: '🦉合并历史记录',
  description: '合并多个聊天历史记录',

  inputs: {
    history1: {
      dataFlowType: 'STRING', // HISTORY input is a JSON string
      displayName: '历史记录 1',
      description: '第一个历史记录 (JSON字符串)',
      required: false,
      matchCategories: ['ChatHistory', 'Json']
    },
    history2: {
      dataFlowType: 'STRING', // HISTORY input is a JSON string
      displayName: '历史记录 2',
      description: '第二个历史记录 (JSON字符串)',
      required: false,
      matchCategories: ['ChatHistory', 'Json']
    },
    history3: {
      dataFlowType: 'STRING', // HISTORY input is a JSON string
      displayName: '历史记录 3',
      description: '第三个历史记录 (JSON字符串)',
      required: false,
      matchCategories: ['ChatHistory', 'Json']
    },
    history4: {
      dataFlowType: 'STRING', // HISTORY input is a JSON string
      displayName: '历史记录 4',
      description: '第四个历史记录 (JSON字符串)',
      required: false,
      matchCategories: ['ChatHistory', 'Json']
    }
  },

  outputs: {
    history: {
      dataFlowType: 'STRING', // HISTORY output is a JSON string
      displayName: '合并历史记录',
      description: '合并后的聊天历史记录 (JSON字符串)',
      matchCategories: ['ChatHistory', 'Json']
    }
  },

  execute: MergeHistoryNodeImpl.execute
}

// Removed: Node registration is now handled by index.ts