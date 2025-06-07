import type { NodeDefinition, CustomMessage } from '@comfytavern/types';
import { promises as fs } from 'fs';
import path from 'path';

// Placeholder for validation function (can be more sophisticated)
function isValidCustomMessageArray(data: any): data is CustomMessage[] {
  if (!Array.isArray(data)) {
    return false;
  }
  // Basic check: does each item have a 'role' and 'content'?
  return data.every(item => typeof item === 'object' && item !== null && 'role' in item && 'content' in item);
}


class HistoryLoaderNodeImpl {
  static async execute(inputs: Record<string, any>, context: any): Promise<Record<string, any>> {
    const nodeData = context?.nodeData;
    const historyResourcePath = nodeData?.historyResource;

    if (!historyResourcePath) {
      console.error(`HistoryLoader (${context?.nodeId}): Missing history resource path.`);
      // Throw error instead of returning
      throw new Error('History resource not selected');
    }

    console.log(`HistoryLoader (${context?.nodeId}): Loading history from: ${historyResourcePath}`);

    try {
      // TODO: 确认资源路径格式和加载方式
      const fileContent = await fs.readFile(historyResourcePath, 'utf-8');
      const historyData = JSON.parse(fileContent);

      // Validate if the loaded data conforms to CustomMessage[]
      if (!isValidCustomMessageArray(historyData)) {
         throw new Error('Loaded data is not a valid CustomMessage array.');
      }

      console.log(`HistoryLoader (${context?.nodeId}): History loaded and validated successfully.`);
      // Explicitly type the output for clarity, though validation already checked
      return { historyMessages: historyData as CustomMessage[] };

    } catch (error: any) {
      console.error(`HistoryLoader (${context?.nodeId}): Failed to load/parse/validate history "${historyResourcePath}" - ${error.message}`);
      // Re-throw the error or throw a new one
      throw new Error(`Failed to load history: ${error.message}`);
    }
  }
}

export const definition: NodeDefinition = {
  type: 'HistoryLoader',
  category: 'Loaders',
  displayName: '📜加载历史',
  description: '从文件加载对话历史 (CustomMessage[] 格式)',
  width: 300,

  inputs: {},
  outputs: {
    historyMessages: {
      // Ideally, the type system would support 'CustomMessage[]' or similar
      // Using 'array' or 'object' as a fallback
      dataFlowType: 'ARRAY',
      displayName: '历史消息',
      description: '加载的对话历史消息数组 (CustomMessage[])',
      matchCategories: ['ChatHistory']
    }
    // Removed error output port
  },

  configSchema: {
    historyResource: {
      dataFlowType: 'STRING', // RESOURCE_SELECTOR value is a string (path/ID)
      displayName: '历史文件',
      description: '选择一个对话历史文件 (JSON)',
      required: true,
      matchCategories: ['ResourceId', 'FilePath'],
      config: {
        // 需要确认系统中实际的资源类型标识
        acceptedTypes: [
          { value: 'json', label: '历史 (JSON)' },
          // { value: 'history', label: '历史文件' } // 或者可能是这样
        ],
        placeholder: '选择一个历史文件...',
      }
    }
  },

  execute: HistoryLoaderNodeImpl.execute
};