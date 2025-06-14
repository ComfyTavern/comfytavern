import type { NodeDefinition, UserContext } from '@comfytavern/types'; // + Import UserContext
import { famService } from '../../services/FileManagerService'; // + Import famService

// 假设 context 中会包含项目根目录等信息用于解析相对路径
// 或者 RESOURCE_SELECTOR 返回的是可以直接访问的绝对路径或标识符

class PresetLoaderNodeImpl {
  static async execute(inputs: Record<string, any>, context: any): Promise<Record<string, any>> {
    const nodeData = context?.nodeData;
    const presetResourcePath = nodeData?.presetResource as string | undefined; // 从配置中获取选择的资源路径/ID

    if (!presetResourcePath) {
      console.error(`PresetLoader (${context?.nodeId}): Missing preset resource path in configuration.`);
      throw new Error('Preset resource not selected');
    }

    const userContext = context?.userContext as UserContext | undefined;
    let userId: string | null = null;
    if (userContext?.currentUser) {
      if ('id' in userContext.currentUser) {
        userId = userContext.currentUser.id;
      } else if ('uid' in userContext.currentUser) {
        userId = userContext.currentUser.uid;
      }
    }

    if (presetResourcePath.startsWith('user://') && !userId) {
      console.error(`PresetLoader (${context?.nodeId}): User ID is required for user-specific resource path: ${presetResourcePath}`);
      throw new Error('User context is required to load this user-specific preset.');
    }

    console.log(`PresetLoader (${context?.nodeId}): Attempting to load preset from logical path: ${presetResourcePath} (User: ${userId || 'shared/system'})`);

    try {
      const fileContent = await famService.readFile(userId, presetResourcePath, 'utf-8');
      if (typeof fileContent !== 'string') {
        throw new Error('Failed to read preset file content as string.');
      }
      const presetData = JSON.parse(fileContent);

      console.log(`PresetLoader (${context?.nodeId}): Preset loaded successfully.`);
      return { presetData: presetData }; // 将解析后的数据放入输出

    } catch (error: any) {
      console.error(`PresetLoader (${context?.nodeId}): Failed to load or parse preset file "${presetResourcePath}" - ${error.message}`);
      // Re-throw the error or throw a new one
      throw new Error(`Failed to load preset: ${error.message}`);
    }
  }
}

export const definition: NodeDefinition = {
  type: 'PresetLoader', // 内部类型名
  category: 'Loaders', // 功能分类
  displayName: '💾加载预设',
  description: '从文件加载 LLM 提示词预设配置',
  width: 300, // 初始宽度

  inputs: {
    // 通常加载器没有逻辑输入，配置来自 configSchema
  },
  outputs: {
    presetData: {
      dataFlowType: 'OBJECT', // 输出解析后的对象
      displayName: '预设数据',
      description: '解析后的预设配置对象'
    }
    // Removed error output port
  },

  configSchema: {
    presetResource: {
      dataFlowType: 'STRING', // RESOURCE_SELECTOR value is a string (path/ID)
      displayName: '预设文件',
      description: '选择一个预设配置文件 (JSON)',
      required: true,
      matchCategories: ['ResourceId', 'FilePath'],
      config: {
        // 假设预设文件以 .json 结尾，或者有特定的 'preset' 资源类型
        // 需要确认系统中实际的资源类型标识
        acceptedTypes: [
          { value: 'json', label: '预设 (JSON)' },
          // { value: 'preset', label: '预设文件' } // 或者可能是这样
        ],
        placeholder: '选择一个预设文件...',
      }
    }
  },

  execute: PresetLoaderNodeImpl.execute
};