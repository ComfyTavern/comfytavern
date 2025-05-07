import type { NodeDefinition } from '@comfytavern/types';
import { promises as fs } from 'fs'; // Node.js file system module
import path from 'path'; // Node.js path module

// 假设 context 中会包含项目根目录等信息用于解析相对路径
// 或者 RESOURCE_SELECTOR 返回的是可以直接访问的绝对路径或标识符

class PresetLoaderNodeImpl {
  static async execute(inputs: Record<string, any>, context: any): Promise<Record<string, any>> {
    const nodeData = context?.nodeData;
    const presetResourcePath = nodeData?.presetResource; // 从配置中获取选择的资源路径/ID

    if (!presetResourcePath) {
      console.error(`PresetLoader (${context?.nodeId}): Missing preset resource path in configuration.`);
      // Throw error instead of returning
      throw new Error('Preset resource not selected');
    }

    console.log(`PresetLoader (${context?.nodeId}): Attempting to load preset from: ${presetResourcePath}`);

    try {
      // TODO: 实际的文件加载逻辑需要根据 presetResourcePath 的具体格式来确定
      // 假设它是一个相对于项目根目录的路径，并且 context 提供了 projectRoot
      // const projectRoot = context?.projectRoot || process.cwd(); // 获取项目根目录，需要确认 context 提供
      // const absolutePath = path.resolve(projectRoot, presetResourcePath);

      // 暂时假设 presetResourcePath 是可以直接访问的文件路径
      // 注意：直接访问文件系统可能存在安全风险，实际应用中应通过受控的服务进行
      const fileContent = await fs.readFile(presetResourcePath, 'utf-8');
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
      type: 'object', // 输出解析后的对象
      displayName: '预设数据',
      description: '解析后的预设配置对象'
    }
    // Removed error output port
  },

  configSchema: {
    presetResource: {
      type: 'RESOURCE_SELECTOR', // 使用资源选择器
      displayName: '预设文件',
      description: '选择一个预设配置文件 (JSON)',
      required: true,
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