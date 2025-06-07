import type { NodeDefinition, CustomMessage, StandardResponse } from '@comfytavern/types';


// Placeholder validation for messages
function isValidCustomMessageArray(data: any): data is CustomMessage[] {
  if (!Array.isArray(data)) {
    return false;
  }
  return data.every(item => typeof item === 'object' && item !== null && 'role' in item && 'content' in item);
}

class GenericLlmRequestNodeImpl {
  static async execute(inputs: Record<string, any>, context: any): Promise<Record<string, any>> {
    const messagesInput = inputs?.messages;
    const parametersInput = inputs?.parameters || {}; // Default to empty object if not provided
    const nodeData = context?.nodeData; // Node instance configuration
    // Parse capabilities from comma-separated string in config
    const capabilitiesString = nodeData?.required_capabilities || 'llm,chat';
    const requiredCapabilities = capabilitiesString.split(',').map((s: string) => s.trim()).filter(Boolean);


    // --- 1. Validate Inputs ---
    if (!isValidCustomMessageArray(messagesInput)) {
      throw new Error('Input messages are missing or not a valid CustomMessage array.');
    }
    if (typeof parametersInput !== 'object' || parametersInput === null) {
      throw new Error('Input parameters must be an object.');
    }
    if (requiredCapabilities.length === 0) {
      throw new Error('Required capabilities cannot be empty.');
    }

    console.log(`GenericLlmRequest (${context?.nodeId}): Received ${messagesInput.length} messages. Required capabilities: ${requiredCapabilities.join(', ')}`);

    // --- 2. Access Backend Services (Placeholder) ---
    // These services are expected to be injected via the context by the ExecutionEngine
    const modelRouterService = context?.modelRouterService;
    const retryHandler = context?.retryHandler; // Or maybe the router handles retries internally? Plan suggests RetryHandler is separate.

    // Check if services are available
    // TODO: Refine this check based on the actual context structure provided by ExecutionEngine
    if (!retryHandler) { // Assuming RetryHandler is the main entry point for execution logic
      console.error(`GenericLlmRequest (${context?.nodeId}): Required LLM services (e.g., RetryHandler) not found in context.`);
      throw new Error('LLM execution services are not available.');
    }

    // --- 3. Delegate Execution to Services (Placeholder) ---
    try {
      console.log(`GenericLlmRequest (${context?.nodeId}): Delegating request execution...`);

      // This is a conceptual call based on the architecture plan.
      // The actual method signature and parameters might differ based on implementation.
      // It assumes the retryHandler (or a similar service) takes the requirements
      // and orchestrates routing, adapter selection, key selection, and execution.
      const response: StandardResponse = await retryHandler.executeRequest({
        requiredCapabilities: requiredCapabilities,
        messages: messagesInput,
        parameters: parametersInput,
        // Pass other preferences from config if available (e.g., preferred_model_tags)
        // preferredModelTags: nodeData?.preferred_model_tags,
        // performancePreference: nodeData?.performance_preference,
      });

      console.log(`GenericLlmRequest (${context?.nodeId}): Execution successful. Model used: ${response.model}`);

      // --- 4. Return StandardResponse and convenience text output ---
      // Check if the response itself indicates an error from the LLM API or services
      if (response.error) {
        console.error(`GenericLlmRequest (${context?.nodeId}): Received error in StandardResponse: ${response.error.message}`);
        // Decide whether to throw or return the error structure. Throwing is consistent.
        throw new Error(`LLM request failed: ${response.error.message}`);
      }


      return {
        response: response, // The full StandardResponse object
        responseText: response.text // The primary text output
      };

    } catch (error: any) {
      console.error(`GenericLlmRequest (${context?.nodeId}): Error during LLM request execution - ${error.message}`);
      // Re-throw the error to be caught by the execution engine
      throw new Error(`LLM request execution failed: ${error.message}`);
    }
  }
}

export const definition: NodeDefinition = {
  type: 'GenericLlmRequest',
  category: 'LLM', // Functional category
  displayName: '⚡通用 LLM 请求',
  description: '根据所需能力向配置的 LLM 发送请求',
  width: 350,

  inputs: {
    messages: {
      dataFlowType: 'ARRAY',
      displayName: '消息列表',
      description: '要发送给 LLM 的消息数组 (CustomMessage[])',
      matchCategories: ['ChatHistory']
    },
    parameters: {
      dataFlowType: 'OBJECT',
      displayName: '参数',
      description: '传递给 LLM API 的参数 (e.g., temperature, max_tokens)',
      required: false,
      matchCategories: ['LlmConfig'],
      config: {
        default: {}
      }
    }
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

  configSchema: {
    required_capabilities: {
      // TODO: Use a more appropriate widget if available (e.g., multi-select tags)
      dataFlowType: 'STRING', // TEXTAREA value is a string
      displayName: '所需能力',
      description: '模型必须具备的能力列表 (逗号分隔, e.g., llm,chat or llm,vision)',
      required: true,
      config: {
        default: 'llm,chat',
        rows: 2,
        placeholder: 'e.g., llm,chat'
      }
      // Example using a hypothetical 'TAG_INPUT' widget:
      // type: 'TAG_INPUT',
      // config: {
      //   placeholder: 'Add capability...',
      //   suggestions: ['llm', 'chat', 'vision', 'embedding', 'tool_calling']
      // }
    }
    // TODO: Add preferred_model_tags, performance_preference later
  },

  execute: GenericLlmRequestNodeImpl.execute
};