import type { NodeDefinition, CustomMessage, StandardResponse, ApiCredentialConfig } from '@comfytavern/types';
import { LlmApiAdapterRegistry } from '../../services/LlmApiAdapterRegistry';
import { ApiConfigService } from '../../services/ApiConfigService';
import { ActivatedModelService } from '../../services/ActivatedModelService';

// Placeholder validation for messages
function isValidCustomMessageArray(data: any): data is CustomMessage[] {
  if (!Array.isArray(data)) {
    return false;
  }
  return data.every(item => typeof item === 'object' && item !== null && 'role' in item && 'content' in item);
}

class GenericLlmRequestNodeImpl {
  static async execute(inputs: Record<string, any>, context: any): Promise<Record<string, any>> {
    const {
      messages,
      parameters = {},
      activated_model_id,
      channel_ref_name,
    } = inputs;

    const { nodeId, services } = context;
    const { apiConfigService, activatedModelService, llmApiAdapterRegistry } = services;

    // --- 1. Validate Inputs ---
    if (!isValidCustomMessageArray(messages)) {
      throw new Error('Input "messages" is missing or not a valid CustomMessage array.');
    }
    if (typeof activated_model_id !== 'string' || !activated_model_id) {
      throw new Error('Input "activated_model_id" is missing or invalid.');
    }
    if (typeof channel_ref_name !== 'string' || !channel_ref_name) {
      throw new Error('Input "channel_ref_name" is missing or invalid.');
    }

    console.log(`[GenericLlmRequestNode ${nodeId}] Executing... Model: ${activated_model_id}, Channel: ${channel_ref_name}`);

    // --- 2. Get Services and Config ---
    if (!apiConfigService || !activatedModelService || !llmApiAdapterRegistry) {
      throw new Error('One or more required services (ApiConfigService, ActivatedModelService, LlmApiAdapterRegistry) are not available in the context.');
    }

    // For MVP, we assume services are pre-initialized with a db connection and userId is handled by the service layer
    const channelConfig = await apiConfigService.getCredentials(channel_ref_name);
    if (!channelConfig) {
      throw new Error(`Channel configuration for "${channel_ref_name}" not found.`);
    }

    // We don't strictly need model info for the request itself in MVP, but it's good practice to check.
    const modelInfo = await activatedModelService.getActivatedModel(activated_model_id);
    if (!modelInfo) {
      throw new Error(`Activated model "${activated_model_id}" not found.`);
    }

    // --- 3. Get Adapter and Execute Request ---
    const adapterType = channelConfig.adapterType || 'openai'; // Default to openai for MVP
    const adapter = llmApiAdapterRegistry.getAdapter(adapterType);

    if (!adapter) {
      throw new Error(`LLM adapter for type "${adapterType}" not found.`);
    }

    try {
      const response = await adapter.request({
        messages,
        parameters,
        model_id: activated_model_id,
        credentials: {
          base_url: channelConfig.baseUrl,
          api_key: channelConfig.apiKey, // Assuming single string key for MVP
          custom_headers: channelConfig.customHeaders,
        },
        stream: false, // MVP does not support streaming
      }) as StandardResponse; // Cast because request can also return a generator

      if (response.error) {
        throw new Error(`LLM API Error: ${response.error.message}`);
      }

      console.log(`[GenericLlmRequestNode ${nodeId}] Execution successful. Model used: ${response.model}`);

      return {
        response: response,
        responseText: response.text,
      };

    } catch (error: any) {
      console.error(`[GenericLlmRequestNode ${nodeId}] Error during LLM request execution: ${error.message}`);
      throw error; // Re-throw to be caught by the execution engine
    }
  }
}

export const definition: NodeDefinition = {
  type: 'GenericLlmRequest',
  category: 'LLM',
  displayName: '⚡通用 LLM 请求',
  description: '向指定的 LLM 模型和渠道发送请求 (MVP)',
  width: 350,

  inputs: {
    messages: {
      dataFlowType: 'ARRAY',
      displayName: '消息列表',
      description: '要发送给 LLM 的消息数组 (CustomMessage[])',
      matchCategories: ['ChatHistory'],
    },
    parameters: {
      dataFlowType: 'OBJECT',
      displayName: '参数',
      description: '传递给 LLM API 的参数 (e.g., temperature, max_tokens)',
      required: false,
      matchCategories: ['LlmConfig'],
      config: {
        default: {},
      },
    },
    activated_model_id: {
      dataFlowType: 'STRING',
      displayName: '激活的模型 ID',
      description: '要使用的已激活模型的 ID',
      // In a real UI, this would be a dropdown populated by ActivatedModelService
    },
    channel_ref_name: {
      dataFlowType: 'STRING',
      displayName: '渠道引用名称',
      description: '要使用的 API 渠道的引用名称',
      // In a real UI, this would be a dropdown populated by ApiConfigService
    },
  },
  outputs: {
    response: {
      dataFlowType: 'OBJECT',
      displayName: '完整响应',
      description: 'LLM 返回的完整标准化响应对象',
      matchCategories: ['LlmOutput']
    },
    responseText: {
      dataFlowType: 'STRING',
      displayName: '响应文本',
      description: 'LLM 返回的主要文本内容',
      matchCategories: ['LlmOutput']
    }
    // No error output port, throws on error
  },

  // MVP version uses direct inputs, so no config schema is needed for now.
  // The 'required_capabilities' logic will be added in a later phase.
  configSchema: {},

  execute: GenericLlmRequestNodeImpl.execute
};