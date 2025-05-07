import OpenAI from 'openai'
import type { NodeDefinition, APISettings, CustomMessage, CustomContentPart } from '@comfytavern/types'
// Removed: import { nodeManager } from '../NodeManager'
import { ImageProcessor } from '../../utils/ImageProcessor'
import { convertToApiMessage } from '@comfytavern/types'

export class OpenAIChatNodeImpl {
  private static formatConversation(messages: CustomMessage[]): string {
    let formatted = `=== 完整对话历史 ===\n\n`
    
    for (const msg of messages) {
      const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1)
      let content = ''

      if (Array.isArray(msg.content)) {
        const textContent = msg.content.find((part: CustomContentPart) => 
          part.type === 'text' && part.text !== undefined
        )
        content = textContent?.text ? `${textContent.text} [包含图像]` : '[包含图像]'
      } else {
        content = msg.content
      }
      
      formatted += `${role}: ${content}\n`
      formatted += '-'.repeat(40) + '\n'
    }
    
    return formatted
  }

  static async execute(inputs: Record<string, any>): Promise<Record<string, any>> {
    const {
      api_settings,
      model,
      temperature,
      max_tokens,
      system_prompt,
      clear_history,
      user_input,
      external_history,
      image
    } = inputs

    const client = new OpenAI({
      baseURL: api_settings.base_url,
      apiKey: api_settings.api_key
    })

    // 处理外部历史
    let external_messages: CustomMessage[] = []
    if (external_history) {
      try {
        external_messages = JSON.parse(external_history)
      } catch (error) {
        return {
          full_conversation: 'Error: Invalid external history format.',
          current_output: 'Error: Invalid external history format.',
          history: JSON.stringify([])
        }
      }
    }

    // 内部历史（简化处理，移除缓存）
    let internal_history: CustomMessage[] = clear_history ? [] : []

    // 构建消息列表
    const messages: CustomMessage[] = []
    if (system_prompt) {
      messages.push({ role: 'system', content: system_prompt })
    }
    messages.push(...external_messages)
    messages.push(...internal_history)

    // 添加用户输入
    let new_message: CustomMessage
    if (image) {
      try {
        const image_content = await ImageProcessor.encodeImage(image)
        new_message = {
          role: 'user',
          content: [
            { type: 'text', text: user_input },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${image_content}` }
            }
          ]
        }
      } catch (error) {
        const error_message = `Error encoding image: ${error instanceof Error ? error.message : String(error)}`
        return {
          full_conversation: this.formatConversation(messages),
          current_output: error_message,
          history: JSON.stringify(messages)
        }
      }
    } else {
      new_message = { role: 'user', content: user_input }
    }

    messages.push(new_message)
    internal_history.push(new_message)

    try {
      const completion = await client.chat.completions.create({
        model,
        messages: messages.map(msg => convertToApiMessage(msg)),
        temperature,
        max_tokens
      })

      const assistant_response = completion.choices[0]?.message?.content?.trim() || ''

      if (!assistant_response) {
        return {
          full_conversation: this.formatConversation(messages),
          current_output: 'API返回了空回复，未写入历史记录。',
          history: JSON.stringify(external_messages.concat(internal_history))
        }
      }

      const assistant_message: CustomMessage = {
        role: 'assistant',
        content: assistant_response
      }
      internal_history.push(assistant_message)

      return {
        full_conversation: this.formatConversation(messages.concat([assistant_message])),
        current_output: assistant_response,
        history: JSON.stringify(external_messages.concat(internal_history))
      }
    } catch (error) {
      const error_message = `API Error: ${error instanceof Error ? error.message : String(error)}`
      return {
        full_conversation: this.formatConversation(messages),
        current_output: error_message,
        history: JSON.stringify(external_messages.concat(internal_history))
      }
    }
  }
}

// Renamed export to 'definition'
export const definition: NodeDefinition = {
  type: 'OpenAIChat', // Base type name
  // namespace will be set via index.ts registerer (e.g., 'builtin')
  category: 'TEST-LLM', // Functional category
  displayName: '🦉OpenAI连续聊天',
  description: '与OpenAI模型进行交互，支持历史记录和图像输入',

  inputs: {
    api_settings: {
      type: 'API_SETTINGS',
      displayName: 'API配置',
      description: 'OpenAI API 的相关配置',
      required: true
    },
    model: {
      type: 'STRING',
      displayName: '模型名称',
      description: '用于生成对话的模型名称',
      required: true,
      config: {
        default: 'gpt-4o',
        placeholder: '输入模型名称，如 gpt-4o, gemini-1.5-flash-exp-0827 等'
      }
    },
    temperature: {
      type: 'FLOAT',
      displayName: '温度参数',
      description: '控制生成文本的随机性，值越高越随机',
      required: true,
      config: {
        default: 0.7,
        min: 0,
        max: 2,
        step: 0.1
      }
    },
    max_tokens: {
      type: 'INT',
      displayName: '最大令牌数',
      description: '限制模型生成文本的最大长度',
      required: true,
      config: {
        default: 512,
        min: 1,
        max: 16384
      }
    },
    system_prompt: {
      type: 'STRING',
      displayName: '系统提示',
      description: '用于指导模型行为的初始提示',
      required: true,
      config: {
        multiline: true
      }
    },
    clear_history: {
      type: 'BOOLEAN',
      displayName: '清除历史记录',
      description: '是否在每次运行时清除对话历史',
      required: true,
      config: {
        default: false
      }
    },
    user_input: {
      type: 'STRING',
      displayName: '用户输入',
      description: '用户发送给模型的文本',
      required: true,
      config: {
        multiline: true
      }
    },
    external_history: {
      type: 'HISTORY',
      displayName: '外部历史记录',
      description: '从外部传入的历史对话记录',
      required: false
    },
    image: {
      type: 'IMAGE',
      displayName: '图像输入',
      description: '用户上传的图像',
      required: false
    }
  },

  outputs: {
    full_conversation: {
      type: 'STRING',
      displayName: '完整对话历史',
      description: '包含系统提示、用户输入和模型回复的完整对话记录'
    },
    current_output: {
      type: 'STRING',
      displayName: '当前输出',
      description: '模型生成的当前回复'
    },
    history: {
      type: 'HISTORY',
      displayName: '更新后的历史记录',
      description: '包含所有对话轮次的历史记录，用于后续对话'
    }
  },

  execute: OpenAIChatNodeImpl.execute
}

// Removed: Node registration is now handled by index.ts