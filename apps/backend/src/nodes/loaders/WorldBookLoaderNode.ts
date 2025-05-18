import type { NodeDefinition } from '@comfytavern/types';
import { promises as fs } from 'fs';
import path from 'path';
// import yaml from 'js-yaml'; // 可选：如果需要支持 YAML

class WorldBookLoaderNodeImpl {
  static async execute(inputs: Record<string, any>, context: any): Promise<Record<string, any>> {
    const nodeData = context?.nodeData;
    const worldBookResourcePath = nodeData?.worldBookResource;

    if (!worldBookResourcePath) {
      console.error(`WorldBookLoader (${context?.nodeId}): Missing world book resource path.`);
      // Throw error instead of returning
      throw new Error('World book resource not selected');
    }

    console.log(`WorldBookLoader (${context?.nodeId}): Loading world book from: ${worldBookResourcePath}`);

    try {
      // TODO: 确认资源路径格式和加载方式
      const fileContent = await fs.readFile(worldBookResourcePath, 'utf-8');
      let worldBookData;
      // TODO: 添加对不同文件格式的判断和解析 (e.g., YAML)
      // if (worldBookResourcePath.endsWith('.yaml') || worldBookResourcePath.endsWith('.yml')) {
      //   worldBookData = yaml.load(fileContent);
      // } else {
      worldBookData = JSON.parse(fileContent); // 默认按 JSON 解析
      // }

      console.log(`WorldBookLoader (${context?.nodeId}): World book loaded successfully.`);
      return { worldBookData: worldBookData };

    } catch (error: any) {
      console.error(`WorldBookLoader (${context?.nodeId}): Failed to load/parse world book "${worldBookResourcePath}" - ${error.message}`);
      // Re-throw the error or throw a new one
      throw new Error(`Failed to load world book: ${error.message}`);
    }
  }
}

export const definition: NodeDefinition = {
  type: 'WorldBookLoader',
  category: 'Loaders',
  displayName: '📚加载世界书',
  description: '从文件加载世界书配置',
  width: 300,

  inputs: {},
  outputs: {
    worldBookData: {
      dataFlowType: 'OBJECT',
      displayName: '世界书数据',
      description: '解析后的世界书配置对象'
    }
    // Removed error output port
  },

  configSchema: {
    worldBookResource: {
      dataFlowType: 'STRING', // RESOURCE_SELECTOR value is a string (path/ID)
      displayName: '世界书文件',
      description: '选择一个世界书配置文件 (JSON/YAML)',
      required: true,
      matchCategories: ['ResourceId', 'FilePath'],
      config: {
        // 需要确认系统中实际的资源类型标识
        acceptedTypes: [
          { value: 'json', label: '世界书 (JSON)' },
          { value: 'yaml', label: '世界书 (YAML)' },
          // { value: 'worldbook', label: '世界书文件' } // 或者可能是这样
        ],
        placeholder: '选择一个世界书文件...',
      }
    }
  },

  execute: WorldBookLoaderNodeImpl.execute
};