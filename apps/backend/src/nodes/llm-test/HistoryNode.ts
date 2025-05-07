import type { NodeDefinition, CustomMessage } from '@comfytavern/types'
// Removed: import { nodeManager } from '../NodeManager'

export class HistoryNodeImpl {
  static async execute(inputs: Record<string, any>): Promise<Record<string, any>> {
    const {
      role1,
      content1,
      role2,
      content2,
      role3,
      content3,
      role4,
      content4
    } = inputs

    const history: CustomMessage[] = []
    const pairs: [CustomMessage['role'] | undefined, string | undefined][] = [
      [role1, content1],
      [role2, content2],
      [role3, content3],
      [role4, content4]
    ]

    for (const [role, content] of pairs) {
      if (role && content?.trim()) {
        history.push({ role, content: content.trim() })
      }
    }

    return {
      history: JSON.stringify(history)
    }
  }
}

// Renamed export to 'definition'
export const definition: NodeDefinition = {
  type: 'History', // Base type name
  // namespace will be set via index.ts registerer (e.g., 'builtin')
  category: 'TEST-LLM', // Functional category
  displayName: '🦉历史记录',
  description: '创建聊天历史记录',

  inputs: {
    role1: {
      type: 'STRING',
      displayName: '角色 1',
      description: '第一个消息的角色',
      required: false,
      config: {
        options: ['user', 'assistant', 'system']
      }
    },
    content1: {
      type: 'STRING',
      displayName: '内容 1',
      description: '第一个消息的内容',
      required: false,
      config: {
        multiline: true
      }
    },
    role2: {
      type: 'STRING',
      displayName: '角色 2',
      description: '第二个消息的角色',
      required: false,
      config: {
        options: ['user', 'assistant', 'system']
      }
    },
    content2: {
      type: 'STRING',
      displayName: '内容 2',
      description: '第二个消息的内容',
      required: false,
      config: {
        multiline: true
      }
    },
    role3: {
      type: 'STRING',
      displayName: '角色 3',
      description: '第三个消息的角色',
      required: false,
      config: {
        options: ['user', 'assistant', 'system']
      }
    },
    content3: {
      type: 'STRING',
      displayName: '内容 3',
      description: '第三个消息的内容',
      required: false,
      config: {
        multiline: true
      }
    },
    role4: {
      type: 'STRING',
      displayName: '角色 4',
      description: '第四个消息的角色',
      required: false,
      config: {
        options: ['user', 'assistant', 'system']
      }
    },
    content4: {
      type: 'STRING',
      displayName: '内容 4',
      description: '第四个消息的内容',
      required: false,
      config: {
        multiline: true
      }
    }
  },

  outputs: {
    history: {
      type: 'HISTORY',
      displayName: '历史记录',
      description: '生成的聊天历史记录'
    }
  },

  execute: HistoryNodeImpl.execute
}

// Removed: Node registration is now handled by index.ts