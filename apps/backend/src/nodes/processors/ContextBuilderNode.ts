import type { NodeDefinition, CustomMessage } from '@comfytavern/types';

// Helper function to ensure input is a valid CustomMessage array or empty array
function ensureCustomMessageArray(data: any): CustomMessage[] {
  if (Array.isArray(data) && data.every(item => typeof item === 'object' && item !== null && 'role' in item && 'content' in item)) {
    return data as CustomMessage[];
  }
  return []; // Return empty array if invalid or not an array
}

class ContextBuilderNodeImpl {
  static async execute(inputs: Record<string, any>, context: any): Promise<Record<string, any>> {
    // --- 1. Get Inputs ---
    const presetData = inputs?.presetData; // Expecting object, structure TBD
    const worldBookData = inputs?.worldBookData; // Expecting object, structure TBD
    const characterData = inputs?.characterData; // Expecting object, structure TBD
    const historyMessagesInput = inputs?.historyMessages; // Expecting CustomMessage[]

    console.log(`ContextBuilder (${context?.nodeId}): Received inputs - Preset: ${!!presetData}, WorldBook: ${!!worldBookData}, Character: ${!!characterData}, History: ${!!historyMessagesInput}`);

    // --- 2. Basic Validation & Preparation ---
    const historyMessages = ensureCustomMessageArray(historyMessagesInput);

    // --- 3. Core Combination Logic (Initial Basic Implementation) ---
    // This is where the complex logic will reside.
    // For now, let's do a very simple combination:
    // - System prompt from character (if available)
    // - History messages
    // - User prompt from preset (if available)

    const finalMessages: CustomMessage[] = [];

    try {
      // Example: Extract system prompt from character data
      // IMPORTANT: The actual structure of characterData needs to be known.
      // Assuming characterData might have a 'system_prompt' field.
      if (characterData && typeof characterData.system_prompt === 'string') {
        finalMessages.push({ role: 'system', content: characterData.system_prompt });
        console.log(`ContextBuilder (${context?.nodeId}): Added system prompt from character.`);
      } else if (characterData && characterData.description && typeof characterData.description === 'string') {
        // Fallback: use description as system prompt? Needs clarification.
        finalMessages.push({ role: 'system', content: characterData.description });
        console.log(`ContextBuilder (${context?.nodeId}): Added description from character as system prompt.`);
      }

      // TODO: Add logic for World Book entries (insertion points, activation)

      // Add history
      finalMessages.push(...historyMessages);
      console.log(`ContextBuilder (${context?.nodeId}): Added ${historyMessages.length} history messages.`);

      // Example: Extract user prompt from preset data
      // IMPORTANT: The actual structure of presetData needs to be known.
      // Assuming presetData might have a 'user_prompt' field.
      if (presetData && typeof presetData.user_prompt === 'string') {
        finalMessages.push({ role: 'user', content: presetData.user_prompt });
        console.log(`ContextBuilder (${context?.nodeId}): Added user prompt from preset.`);
      }
      // TODO: Add logic for other preset message types (assistant, multi-turn)

      // TODO: Add logic for applying Regex rules if ApplyRegexNode output is connected or rules are passed differently.

      console.log(`ContextBuilder (${context?.nodeId}): Final message count: ${finalMessages.length}`);

      // --- 4. Return Output ---
      return { finalMessages: finalMessages };

    } catch (error: any) {
      console.error(`ContextBuilder (${context?.nodeId}): Error during context building - ${error.message}`);
      throw new Error(`Context building failed: ${error.message}`);
    }
  }
}

export const definition: NodeDefinition = {
  type: 'ContextBuilder',
  category: 'Processors',
  displayName: '🧱上下文构建器',
  description: '将预设、世界书、角色卡和历史组合成最终的 LLM 输入消息',
  width: 350,

  inputs: {
    presetData: {
      dataFlowType: 'OBJECT',
      displayName: '预设数据',
      description: '来自 PresetLoader 的数据',
      required: false
    },
    worldBookData: {
      dataFlowType: 'OBJECT',
      displayName: '世界书数据',
      description: '来自 WorldBookLoader 的数据',
      required: false
    },
    characterData: {
      dataFlowType: 'OBJECT',
      displayName: '角色数据',
      description: '来自 CharacterCardLoader 的数据',
      required: false,
      matchCategories: ['CharacterProfile']
    },
    historyMessages: {
      dataFlowType: 'ARRAY',
      displayName: '历史消息',
      description: '来自 HistoryLoader 的数据',
      required: false,
      matchCategories: ['ChatHistory']
    }
    // Add other potential inputs like processed text if needed
  },
  outputs: {
    finalMessages: {
      dataFlowType: 'ARRAY',
      displayName: '最终消息',
      description: '组合后的最终消息列表 (CustomMessage[])',
      matchCategories: ['ChatHistory']
    }
    // No error output port, throws on error
  },

  // configSchema: {}, // Might need config later for combination rules

  execute: ContextBuilderNodeImpl.execute
};