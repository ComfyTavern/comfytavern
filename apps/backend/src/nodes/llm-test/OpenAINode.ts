import OpenAI from 'openai'
import type { NodeDefinition, APISettings } from '@comfytavern/types'
import { ImageProcessor } from '../../utils/ImageProcessor'
// Removed: import { nodeManager } from '../NodeManager'

export class OpenAINodeImpl {
  static async execute(inputs: Record<string, any>): Promise<Record<string, any>> {
    const {
      api_settings,
      model,
      prompt,
      temperature,
      max_tokens,
      system_prompt,
      history,
      image
    } = inputs

    const settings = api_settings as APISettings
    const client = new OpenAI({
      baseURL: settings.base_url,
      apiKey: settings.api_key
    })

    const messages: Array<any> = []

    // 添加系统提示
    if (system_prompt) {
      messages.push({ role: 'system', content: system_prompt })
    }

    // 添加历史记录
    if (history) {
      try {
        const historyMessages = JSON.parse(history)
        messages.push(...historyMessages)
      } catch (error) {
        console.warn('解析历史记录失败:', error)
      }
    }

    // 处理图片和提示信息
    if (image) {
      try {
        const imageContent = await ImageProcessor.encodeImage(image)
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageContent}` }
            }
          ]
        })
      } catch (error) {
        return {
          response: `Error: 图像处理失败 - ${error instanceof Error ? error.message : String(error)}`
        }
      }
    } else {
      messages.push({ role: 'user', content: prompt })
    }

    try {
      const response = await client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens
      })

      return {
        response: response.choices[0]?.message?.content || ''
      }
    } catch (error) {
      return {
        response: `Error: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
}

// Renamed export to 'definition'
export const definition: NodeDefinition = {
  type: 'OpenAI', // Base type name
  // namespace will be set via index.ts registerer (e.g., 'builtin')
  category: 'TEST-LLM', // Functional category
  displayName: '🦉OpenAI聊天',
  description: 'Generate text using OpenAI chat models',

  inputs: {
    api_settings: {
      type: 'API_SETTINGS',
      displayName: 'API 设置',
      description: '来自 APISettings 节点的 API 设置',
      required: true
    },
    model: {
      type: 'STRING',
      displayName: '模型',
      description: '要使用的 OpenAI 模型',
      required: true,
      config: {
        default: 'gpt-4o',
        multiline: false,
        placeholder: '输入模型名称，如 gpt-4o, gemini-2.0-flash-exp 等'
      }
    },
    temperature: {
      type: 'FLOAT',
      displayName: '温度',
      description: '采样温度',
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
      description: '要生成的最大令牌数',
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
      description: '系统提示',
      required: true,
      config: {
        multiline: true
      }
    },
    prompt: {
      type: 'STRING',
      displayName: '用户提示',
      description: '用户提示',
      required: true,
      config: {
        multiline: true
      }
    },
    history: {
      type: 'HISTORY',
      displayName: '聊天记录',
      description: '聊天记录',
      required: false
    },
    image: {
      type: 'IMAGE',
      displayName: '图像',
      description: '视觉模型的图像',
      required: false
    }
  },

  outputs: {
    response: {
      type: 'STRING',
      displayName: '生成回复',
      description: '生成的回复'
    }
  },

  execute: OpenAINodeImpl.execute
}

// Removed: Node registration is now handled by index.ts