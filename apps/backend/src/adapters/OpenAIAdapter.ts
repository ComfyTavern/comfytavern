import OpenAI from 'openai';
import {
  ApiCredentialConfig,
  CustomMessage,
  ILlmApiAdapter,
  LlmAdapterRequestPayload,
  StandardResponse,
  ChunkPayload,
} from '@comfytavern/types';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * OpenAIAdapter 类，实现了 ILlmApiAdapter 接口，
 * 用于将标准化的 LLM 请求转换为 OpenAI API 格式，并处理其响应。
 */
export class OpenAIAdapter implements ILlmApiAdapter {

  public async listModels(credentials: {
    base_url: string;
    api_key?: string;
  }): Promise<Array<{ id: string;[key: string]: any; }>> {
    const { base_url, api_key } = credentials;
    const client = new OpenAI({
      baseURL: base_url,
      apiKey: api_key,
    });

    try {
      const models = await client.models.list();
      return models.data;
    } catch (error: any) {
      console.error(`[OpenAIAdapter] Failed to list models from ${base_url}:`, error.message);
      // 返回空数组或抛出自定义错误，让调用方处理
      // 返回空数组对前端更友好
      return [];
    }
  }

  /**
   * 执行对 OpenAI API 的聊天补全请求。
   * @param payload - 包含消息、模型配置和渠道配置的标准化负载。
   * @returns 一个解析为标准化响应的 Promise。
   */
  public async execute(payload: LlmAdapterRequestPayload): Promise<StandardResponse> {
    const { messages, modelConfig, channelConfig } = payload;
    const { baseUrl, apiKey } = channelConfig;

    const client = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey,
    });

    try {
      const { model, ...restOfModelConfig } = modelConfig;
      if (!model) {
        throw new Error('Model ID is required in modelConfig.');
      }

      const openAIResponse = await client.chat.completions.create({
        model: model,
        messages: this.transformMessagesToOpenAI(messages),
        stream: false, // 显式设置为非流式
        ...restOfModelConfig,
      });

      return this.transformOpenAIResponseToStandard(openAIResponse);

    } catch (error: any) {
      const errorBody = error.response?.data || { message: error.message };
      const statusCode = error.status || 500;
      return this.createErrorResponse(errorBody, statusCode, modelConfig.model || 'unknown_model');
    }
  }

  /**
   * 执行对 OpenAI API 的流式聊天补全请求。
   * @param payload - 包含消息、模型配置和渠道配置的标准化负载。
   * @returns 一个异步生成器，产生 ChunkPayload 数据块。
   */
  public async* executeStream(payload: LlmAdapterRequestPayload): AsyncGenerator<ChunkPayload, void, unknown> {
    const { messages, modelConfig, channelConfig } = payload;
    const { baseUrl, apiKey } = channelConfig;

    const client = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey,
    });

    try {
      const { model, ...restOfModelConfig } = modelConfig;
      if (!model) {
        throw new Error('Model ID is required in modelConfig.');
      }

      const stream = await client.chat.completions.create({
        model: model,
        messages: this.transformMessagesToOpenAI(messages),
        stream: true, // 启用流式响应
        ...restOfModelConfig,
      });

      let accumulatedText = '';
      
      for await (const part of stream) {
        const chunks = this.transformOpenAIStreamChunk(part);
        for (const chunk of chunks) {
          // 如果是文本块，累积文本内容
          if (chunk.type === 'text_chunk' && typeof chunk.content === 'string') {
            accumulatedText += chunk.content;
          }
          yield chunk;
        }
      }

      // 流结束时发送完成信息
      yield {
        type: 'finish_reason_chunk',
        content: {
          finish_reason: 'stop',
          accumulated_text: accumulatedText,
        },
      } as ChunkPayload;

    } catch (error: any) {
      const errorBody = error.response?.data || { message: error.message };
      const statusCode = error.status || 500;
      
      yield {
        type: 'error_chunk',
        content: {
          message: errorBody?.error?.message || error.message,
          code: errorBody?.error?.code || statusCode,
          type: errorBody?.error?.type || 'stream_error',
        },
      } as ChunkPayload;
    }
  }

  /**
   * 将 OpenAI 流式响应块转换为标准化的 ChunkPayload 格式。
   * @param chunk - OpenAI 流式响应的单个块。
   * @returns 转换后的 ChunkPayload 数组，因为一个块可能包含多种信息。
   */
  private transformOpenAIStreamChunk(chunk: any): ChunkPayload[] {
    const payloads: ChunkPayload[] = [];

    // 即使没有 choices，也可能有用量信息
    if (chunk.usage) {
      payloads.push({
        type: 'usage_chunk',
        content: chunk.usage,
      });
    }

    if (!chunk.choices || chunk.choices.length === 0) {
      return payloads;
    }

    const choice = chunk.choices[0];
    const delta = choice.delta;

    // 处理文本增量
    if (delta && delta.content) {
      payloads.push({
        type: 'text_chunk',
        content: delta.content,
      });
    }

    // 处理完成原因
    if (choice.finish_reason) {
      payloads.push({
        type: 'finish_reason_chunk',
        content: {
          finish_reason: choice.finish_reason,
        },
      });
    }

    return payloads;
  }

  /**
   * 将内部的 CustomMessage 格式转换为 OpenAI API 所需的格式。
   * @param messages - CustomMessage 数组。
   * @returns OpenAI 格式的消息数组。
   */
  private transformMessagesToOpenAI(messages: CustomMessage[]): ChatCompletionMessageParam[] {
    // 由于我们的 CustomMessage 类型现在与 OpenAI 的结构精确匹配，
    // 直接进行类型断言是安全的。
    return messages as ChatCompletionMessageParam[];
  }

  /**
   * 将 OpenAI API 的响应转换为我们的标准化响应格式。
   * @param openAIResponse - 从 OpenAI API 收到的原始响应。
   * @returns 标准化响应对象。
   */
  private transformOpenAIResponseToStandard(openAIResponse: OpenAI.Chat.Completions.ChatCompletion): StandardResponse {
    const firstChoice = openAIResponse.choices?.[0];

    const transformedChoices = openAIResponse.choices?.map(choice => ({
      index: choice.index,
      message: {
        role: choice.message.role,
        content: choice.message.content, // content 可以是 null，符合我们的 schema
      },
      finish_reason: choice.finish_reason,
    }));

    const usageData = openAIResponse.usage
      ? {
          prompt_tokens: openAIResponse.usage.prompt_tokens,
          completion_tokens: openAIResponse.usage.completion_tokens,
          total_tokens: openAIResponse.usage.total_tokens,
        }
      : undefined;

    return {
      text: firstChoice?.message?.content ?? '', // 使用 ?? 确保 null 和 undefined 都被转换为空字符串
      choices: transformedChoices,
      usage: usageData,
      raw_response: openAIResponse,
      model: openAIResponse.model,
      response_id: openAIResponse.id,
    };
  }

  /**
   * 创建一个标准化的错误响应对象。
   * @param errorBody - 错误详情。
   * @param statusCode - HTTP 状态码。
   * @param modelId - 尝试使用的模型 ID。
   * @returns 标准化错误响应对象。
   */
  private createErrorResponse(errorBody: any, statusCode: number, modelId: string): StandardResponse {
    const error = errorBody?.error || errorBody;
    return {
      text: '',
      model: modelId,
      error: {
        message: error.message || 'An unknown error occurred.',
        code: error.code || statusCode,
        type: error.type,
        details: errorBody,
      },
    };
  }
}