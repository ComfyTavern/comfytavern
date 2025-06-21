import type { NodeDefinition, CustomMessage, StandardResponse, ApiCredentialConfig } from '@comfytavern/types';
import { LlmApiAdapterRegistry } from '../../services/LlmApiAdapterRegistry';
import { ApiConfigService } from '../../services/ApiConfigService';
import { ActivatedModelService } from '../../services/ActivatedModelService';

// Placeholder validation for a single message
function isValidCustomMessage(item: any): item is CustomMessage {
  return typeof item === 'object' && item !== null && 'role' in item && 'content' in item;
}

// Placeholder validation for an array of messages
function isValidCustomMessageArray(data: any): data is CustomMessage[] {
  if (!Array.isArray(data)) {
    return false;
  }
  return data.every(isValidCustomMessage);
}

class GenericLlmRequestNodeImpl {
  static async execute(inputs: Record<string, any>, context: any): Promise<Record<string, any>> {
    const {
      messages,
      parameters: baseParameters = {},
      activated_model_id,
      temperature,
      max_tokens,
      top_p,
      seed,
    } = inputs;

    const { nodeId, services, userId } = context;
    const { apiConfigService, activatedModelService, llmApiAdapterRegistry } = services;

    // --- 1. Validate Inputs ---
    if (!isValidCustomMessageArray(messages)) {
      throw new Error('Input "messages" is missing or not a valid CustomMessage array.');
    }
    if (typeof activated_model_id !== 'string' || !activated_model_id) {
      throw new Error('Input "activated_model_id" is missing or invalid.');
    }

    // channel_id is removed from inputs. The router service will handle channel selection.
    // For now, we'll fetch the first available channel as a placeholder.
    console.log(`[GenericLlmRequestNode ${nodeId}] Executing... Model: ${activated_model_id}`);

    // --- 2. Get Services and Config ---
    if (!apiConfigService || !activatedModelService || !llmApiAdapterRegistry) {
      throw new Error('One or more required services (ApiConfigService, ActivatedModelService, LlmApiAdapterRegistry) are not available in the context.');
    }

    // For MVP, we assume services are pre-initialized with a db connection and userId is handled by the service layer
    // TODO: Replace this with a call to a ModelRouterService that determines the appropriate channel.
    const allChannels = await apiConfigService.getAllCredentials(userId);
    // Sort by creation time to have a deterministic order
    allChannels.sort((a: ApiCredentialConfig, b: ApiCredentialConfig) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

    const channelConfig = allChannels.find((c: ApiCredentialConfig) =>
      !c.disabled &&
      (!c.supportedModels || c.supportedModels.length === 0 || c.supportedModels.includes(activated_model_id))
    );

    if (!channelConfig) {
      throw new Error(`No active channel found for user that supports model "${activated_model_id}".`);
    }
    console.log(`[GenericLlmRequestNode ${nodeId}] Using channel: ${channelConfig.label} (${channelConfig.id})`);

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

    // --- 4. Prepare Parameters ---
    // Start with individual parameters from the node's UI.
    const individualParameters: Record<string, any> = {};
    if (temperature !== undefined) individualParameters.temperature = temperature;
    if (max_tokens !== undefined) individualParameters.max_tokens = max_tokens;
    if (top_p !== undefined) individualParameters.top_p = top_p;
    // Only add seed if it's a positive integer and not 0, as 0 can sometimes be ignored.
    if (seed !== undefined && seed > 0) individualParameters.seed = seed;

    // Merge with the parameters from the input slot.
    // The input slot (`baseParameters`) will override the individual settings.
    const finalParameters = { ...individualParameters, ...baseParameters };

    try {
      const response = await adapter.request({
        messages,
        parameters: finalParameters,
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

export const genericLlmRequestNodeDefinition: NodeDefinition = {
  type: 'GenericLlmRequest',
  category: 'LLM',
  displayName: '⚡通用 LLM 请求',
  description: '向指定的 LLM 模型发送请求，渠道由后端自动路由',
  width: 350,

  inputs: {
    messages: {
      dataFlowType: 'ARRAY',
      displayName: '消息列表',
      description: '要发送给 LLM 的消息数组 (CustomMessage[])\n\n示例格式:\n```json\n[\n  {\n    "role": "user",\n    "content": "你好，请介绍一下你自己"\n  },\n  {\n    "role": "assistant",\n    "content": "我是ComfyTavern助手，很高兴为你服务"\n  }\n]\n```',
      matchCategories: ['ChatHistory','NoDefaultEdit'],
    },
    parameters: {
      dataFlowType: 'OBJECT',
      displayName: '参数',
      description: '传递给 LLM API 的参数 (e.g., temperature, max_tokens) \n会覆盖本节点 UI 中的单独设置',
      required: false,
      matchCategories: ['LlmConfig','NoDefaultEdit'],
      config: {
        default: {},
      },
    },
    activated_model_id: {
      dataFlowType: 'STRING',
      displayName: '模型 ID',
      description: '要使用的已激活模型的 ID \n比如`claude-opus-4-20250522`、`gemini-2.5-pro`、`deepseek-reasoner`等',
    },
    temperature: {
      dataFlowType: 'FLOAT',
      displayName: '温度',
      description: ' (Temperature) 控制生成文本的随机性。较高的值会使输出更随机。',
      required: false,
      config: {
        default: 0.7,
        min: 0.0,
        max: 2.0,
        step: 0.01,
      }
    },
    max_tokens: {
      dataFlowType: 'INTEGER',
      displayName: '最大令牌数',
      description: ' (Max Tokens) 生成的最大令牌数。',
      required: false,
      config: {
        default: 2048,
        min: 1,
        max: 65536,
        step: 64,
      }
    },
    top_p: {
      dataFlowType: 'FLOAT',
      displayName: 'Top P',
      description: '核心采样。模型会考虑概率质量为 top_p 的令牌。0.1 意味着只考虑构成前 10% 概率质量的令牌。',
      required: false,
      config: {
        default: 1.0,
        min: 0.0,
        max: 1.0,
        step: 0.01,
      }
    },
    seed: {
      dataFlowType: 'INTEGER',
      displayName: '随机种子',
      description: ' (Seed) 用于可复现输出的随机种子。',
      required: false,
      config: {
        default: 0,
        min: 0,
        step: 1,
      }
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

  execute: GenericLlmRequestNodeImpl.execute,
};

// --- 节点2: 创建单条消息 ---
class CreateMessageNodeImpl {
  static async execute(inputs: Record<string, any>): Promise<Record<string, any>> {
    const { role = 'user', content = '' } = inputs;
    if (!content) {
      // 如果内容为空，可以返回一个空消息或抛出错误，这里选择返回空，让合并节点忽略
      return { message: null };
    }
    return {
      message: { role, content },
    };
  }
}

export const createMessageNodeDefinition: NodeDefinition = {
  type: 'CreateMessage',
  category: 'LLM',
  displayName: '💬创建消息',
  description: '创建一条单独的对话消息',
  width: 300,
  inputs: {
    role: {
      dataFlowType: 'STRING',
      displayName: '角色',
      description: '消息发送者的角色',
      required: true,
      matchCategories: ['ComboOption'],
      config: {
        default: 'user',
        suggestions: ['system', 'user', 'assistant'],
      },
    },
    content: {
      dataFlowType: 'STRING',
      displayName: '内容',
      description: '消息的具体内容',
      required: true,
      matchCategories: ['UiBlock', 'CanPreview'],
      config: {
        default: '',
        multiline: true,
        placeholder: '请输入消息内容...',
      },
    },
  },
  outputs: {
    message: {
      dataFlowType: 'OBJECT',
      displayName: '消息',
      description: '创建的单条消息对象',
      matchCategories: ['ChatMessage'],
    },
  },
  execute: CreateMessageNodeImpl.execute,
};


// --- 节点3: 合并多条消息 ---
class MergeMessagesNodeImpl {
  static async execute(inputs: Record<string, any>): Promise<Record<string, any>> {
    const { message_inputs = [] } = inputs;

    const flattenedMessages: CustomMessage[] = [];

    // 确保输入是数组
    const values = Array.isArray(message_inputs) ? message_inputs : [message_inputs];

    for (const item of values) {
      if (!item) continue; // 跳过 null 或 undefined

      if (Array.isArray(item)) {
        // 如果是数组 (来自另一个合并节点或历史记录), 则展开并过滤
        flattenedMessages.push(...item.filter(isValidCustomMessage));
      } else if (isValidCustomMessage(item)) {
        // 如果是单条消息对象
        flattenedMessages.push(item);
      }
    }

    return {
      messages: flattenedMessages,
    };
  }
}

export const mergeMessagesNodeDefinition: NodeDefinition = {
  type: 'MergeMessages',
  category: 'LLM',
  displayName: '🤝合并消息',
  description: '将多条消息或消息列表合并成一个完整的消息历史',
  width: 200,
  inputs: {
    message_inputs: {
      dataFlowType: 'OBJECT', // 接受单条消息
      displayName: '消息输入',
      description: '要合并的消息或消息列表',
      required: true,
      multi: true,
      // 允许连接单条消息或完整的消息历史记录
      matchCategories: ['ChatMessage', 'ChatHistory'],
    },
  },
  outputs: {
    messages: {
      dataFlowType: 'ARRAY',
      displayName: '消息列表',
      description: '合并后的消息列表',
      matchCategories: ['ChatHistory'],
    },
  },
  execute: MergeMessagesNodeImpl.execute,
};