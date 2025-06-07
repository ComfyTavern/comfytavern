import OpenAI from 'openai';

import { ImageProcessor } from '../../utils/ImageProcessor';

import type { NodeDefinition, ChunkPayload } from '@comfytavern/types'; // 导入 ChunkPayload

// 本地类型定义
interface APISettings {
  use_env_vars: boolean;
  base_url: string;
  api_key: string;
}
// Removed: import { nodeManager } from '../NodeManager'

export class OpenAINodeImpl {
  static async *execute(
    inputs: Record<string, any>
  ): AsyncGenerator<ChunkPayload, Record<string, any> | void, undefined> {
    const {
      api_settings,
      model,
      prompt,
      temperature,
      max_tokens,
      system_prompt,
      history,
      image,
      stream // 新增 stream 输入
    } = inputs;

    const settings = api_settings as APISettings;
    const client = new OpenAI({
      baseURL: settings.base_url,
      apiKey: settings.api_key
    });

    const messages: Array<any> = [];

    // 添加系统提示
    if (system_prompt) {
      messages.push({ role: 'system', content: system_prompt });
    }

    // 添加历史记录
    if (history) {
      try {
        const historyMessages = JSON.parse(history);
        messages.push(...historyMessages);
      } catch (error) {
        const errorMsg = `解析历史记录失败: ${error instanceof Error ? error.message : String(error)}`;
        console.warn(errorMsg);
        if (stream) {
          yield { type: 'error_chunk', content: errorMsg };
          return;
        } else {
          return { response: `Error: ${errorMsg}` };
        }
      }
    }
    
    // 处理图片和提示信息
    if (image) {
      try {
        const imageContent = await ImageProcessor.encodeImage(image);
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: prompt }, // 即使有图片，文本提示也可能需要
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageContent}` }
            }
          ]
        });
      } catch (error) {
        const errorMsg = `图像处理失败 - ${error instanceof Error ? error.message : String(error)}`;
        if (stream) {
          yield { type: 'error_chunk', content: errorMsg };
          return;
        } else {
          return { response: `Error: ${errorMsg}` };
        }
      }
    } else {
      // 如果没有图片，则必须有 prompt
      if (prompt) {
         messages.push({ role: 'user', content: prompt });
      } else if (messages.length === (system_prompt ? 1:0) ) {
        // 如果 messages 数组在添加用户消息前，长度等于 (system_prompt ? 1:0)
        // 这意味着没有图片，也没有用户文本提示，并且 messages 只包含可能的系统提示或为空
        const errorMsg = "用户提示 (prompt) 或图像 (image) 必须提供至少一个";
        if (stream) {
          yield { type: 'error_chunk', content: errorMsg };
          return;
        } else {
          return { response: `Error: ${errorMsg}` };
        }
      }
    }

    if (stream) {
      // --- 流式处理逻辑 ---
      try {
        const streamResponse = await client.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens,
          stream: true, // 启用流式输出
        });

        for await (const part of streamResponse) {
          const content = part.choices[0]?.delta?.content || '';
          if (content) {
            const chunk: ChunkPayload = { type: 'text_chunk', content };
            yield chunk;
          }
          if (part.choices[0]?.finish_reason) {
             yield { type: 'finish_reason_chunk', content: part.choices[0]?.finish_reason };
          }
        }
        return; // 流式模式下返回 void
      } catch (error) {
        const errorMsg = `OpenAI API 流式请求错误: ${error instanceof Error ? error.message : String(error)}`;
        yield { type: 'error_chunk', content: errorMsg };
        return;
      }
    } else {
      // --- 批处理逻辑 ---
      try {
        const responseData = await client.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens,
          stream: false,
        });
        return {
          response: responseData.choices[0]?.message?.content || ''
        };
      } catch (error) {
        return {
          response: `Error: OpenAI API 批处理请求错误 - ${error instanceof Error ? error.message : String(error)}`
        };
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
      dataFlowType: 'OBJECT', // API_SETTINGS maps to OBJECT
      displayName: 'API 设置',
      description: '来自 APISettings 节点的 API 设置',
      required: true,
      matchCategories: ['LlmConfig']
    },
    model: {
      dataFlowType: 'STRING',
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
      dataFlowType: 'FLOAT',
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
      dataFlowType: 'INTEGER',
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
      dataFlowType: 'STRING',
      displayName: '系统提示',
      description: '系统提示',
      required: true,
      matchCategories: ['Prompt'],
      config: {
        multiline: true
      }
    },
    prompt: {
      dataFlowType: 'STRING',
      displayName: '用户提示',
      description: '用户提示',
      required: true,
      matchCategories: ['Prompt'],
      config: {
        multiline: true
      }
    },
    history: {
      dataFlowType: 'STRING', // HISTORY input is a JSON string
      displayName: '聊天记录',
      description: '聊天记录 (JSON字符串)',
      required: false,
      matchCategories: ['ChatHistory', 'Json']
    },
    image: {
      dataFlowType: 'STRING', // IMAGE input is URL/Base64 string
      displayName: '图像',
      description: '视觉模型的图像 (URL/Base64)',
      required: false,
      matchCategories: ['ImageData', 'Url']
    },
    stream: { // 新增 stream 输入槽
      dataFlowType: 'BOOLEAN',
      displayName: '启用流式输出',
      description: '如果为 true，则启用流式输出，逐块返回结果。否则，进行批处理并一次性返回完整结果。',
      required: false,
      config: {
        default: false, // 明确默认值为 false
      },
    },
  },

  outputs: {
    response: {
      dataFlowType: 'STRING',
      displayName: '生成回复',
      description: '生成的回复',
      matchCategories: ['LlmOutput']
    }
  },

  execute: OpenAINodeImpl.execute
}

// Removed: Node registration is now handled by index.ts