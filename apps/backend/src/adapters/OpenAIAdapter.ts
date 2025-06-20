import OpenAI from 'openai';
import {
  ApiCredentialConfig,
  CustomMessage,
  ILlmApiAdapter,
  LlmAdapterRequestPayload,
  StandardResponse,
} from '@comfytavern/types';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * OpenAIAdapter 类，实现了 ILlmApiAdapter 接口，
 * 用于将标准化的 LLM 请求转换为 OpenAI API 格式，并处理其响应。
 */
export class OpenAIAdapter implements ILlmApiAdapter {
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