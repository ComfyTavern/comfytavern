import type { NodeDefinition, UserContext } from '@comfytavern/types'; // + Import UserContext
import { famService } from '../../services/FileManagerService'; // + Import famService
// import yaml from 'js-yaml'; // 可选：如果需要支持 YAML

class WorldBookLoaderNodeImpl {
  static async execute(inputs: Record<string, any>, context: any): Promise<Record<string, any>> {
    const nodeData = context?.nodeData;
    const worldBookResourcePath = nodeData?.worldBookResource as string | undefined; // worldBookResource is a string (logical path)

    if (!worldBookResourcePath) {
      console.error(`WorldBookLoader (${context?.nodeId}): Missing world book resource path.`);
      throw new Error('World book resource not selected');
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

    // 如果资源路径以 user:// 开头，则 userId 必须存在
    if (worldBookResourcePath.startsWith('user://') && !userId) {
      console.error(`WorldBookLoader (${context?.nodeId}): User ID is required for user-specific resource path: ${worldBookResourcePath}`);
      throw new Error('User context is required to load this user-specific world book.');
    }
    
    console.log(`WorldBookLoader (${context?.nodeId}): Loading world book from logical path: ${worldBookResourcePath} (User: ${userId || 'shared/system'})`);

    try {
      const fileContent = await famService.readFile(userId, worldBookResourcePath, 'utf-8');
      if (typeof fileContent !== 'string') {
        // Should not happen with 'utf-8' encoding, but as a safeguard
        throw new Error('Failed to read world book content as string.');
      }
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