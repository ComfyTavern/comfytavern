import OpenAI from 'openai';

// Removed: import { nodeManager } from '../NodeManager'
import { ImageProcessor } from '../../utils/ImageProcessor';

import type { NodeDefinition } from '@comfytavern/types'
// 本地类型定义
interface APISettings {
  use_env_vars: boolean;
  base_url: string;
  api_key: string;
}

interface CustomContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

interface CustomMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | CustomContentPart[];
}

function convertToApiMessage(msg: CustomMessage): OpenAI.Chat.ChatCompletionMessageParam {
  const content = typeof msg.content === 'string'
    ? msg.content
    : msg.content.map(part => {
        if (part.type === 'text') {
          return { type: 'text' as const, text: part.text || '' };
        }
        return { type: 'image_url' as const, image_url: part.image_url! };
      });

  switch (msg.role) {
    case 'system':
      return { role: 'system', content: msg.content as string }; // System message content must be a string
    case 'user':
      return { role: 'user', content };
    case 'assistant':
      // Assistant message content can be string or null, but here we assume string from our logic
      return { role: 'assistant', content: msg.content as string | null };
    default:
      // Fallback for safety, though should not be reached with CustomMessage type
      return { role: 'user', content };
  }
}

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
      dataFlowType: 'OBJECT', // API_SETTINGS maps to OBJECT
      displayName: 'API配置',
      description: 'OpenAI API 的相关配置',
      required: true,
      matchCategories: ['LlmConfig']
    },
    model: {
      dataFlowType: 'STRING',
      displayName: '模型名称',
      description: '用于生成对话的模型名称',
      required: true,
      config: {
        default: 'gpt-4o',
        placeholder: '输入模型名称，如 gpt-4o, gemini-1.5-flash-exp-0827 等'
      }
    },
    temperature: {
      dataFlowType: 'FLOAT',
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
      dataFlowType: 'INTEGER',
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
      dataFlowType: 'STRING',
      displayName: '系统提示',
      description: '用于指导模型行为的初始提示',
      required: true,
      matchCategories: ['Prompt'],
      config: {
        multiline: true
      }
    },
    clear_history: {
      dataFlowType: 'BOOLEAN',
      displayName: '清除历史记录',
      description: '是否在每次运行时清除对话历史',
      required: true,
      config: {
        default: false
      }
    },
    user_input: {
      dataFlowType: 'STRING',
      displayName: '用户输入',
      description: '用户发送给模型的文本',
      required: true,
      matchCategories: ['Prompt'],
      config: {
        multiline: true
      }
    },
    external_history: {
      dataFlowType: 'STRING', // HISTORY input is a JSON string
      displayName: '外部历史记录',
      description: '从外部传入的历史对话记录 (JSON字符串)',
      required: false,
      matchCategories: ['ChatHistory', 'Json']
    },
    image: {
      dataFlowType: 'STRING', // IMAGE input is URL/Base64 string
      displayName: '图像输入',
      description: '用户上传的图像 (URL/Base64)',
      required: false,
      matchCategories: ['ImageData', 'Url']
    }
  },

  outputs: {
    full_conversation: {
      dataFlowType: 'STRING',
      displayName: '完整对话历史',
      description: '包含系统提示、用户输入和模型回复的完整对话记录',
      matchCategories: ['ChatHistory']
    },
    current_output: {
      dataFlowType: 'STRING',
      displayName: '当前输出',
      description: '模型生成的当前回复',
      matchCategories: ['LlmOutput']
    },
    history: {
      dataFlowType: 'STRING', // HISTORY output is a JSON string
      displayName: '更新后的历史记录',
      description: '包含所有对话轮次的历史记录，用于后续对话 (JSON字符串)',
      matchCategories: ['ChatHistory', 'Json']
    }
  },

  execute: OpenAIChatNodeImpl.execute
}

// Removed: Node registration is now handled by index.ts