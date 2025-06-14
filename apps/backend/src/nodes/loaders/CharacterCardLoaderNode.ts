import type { NodeDefinition, UserContext } from '@comfytavern/types'; // + Import UserContext
import { famService } from '../../services/FileManagerService'; // + Import famService

// import { extract } from 'png-chunks-extract'; // 可选：如果需要支持 PNG 元数据提取
// import { decode } from 'png-chunk-text';     // 可选：解码 PNG 文本块

class CharacterCardLoaderNodeImpl {
  static async execute(inputs: Record<string, any>, context: any): Promise<Record<string, any>> {
    const nodeData = context?.nodeData;
    const cardResourcePath = nodeData?.cardResource as string | undefined;

    if (!cardResourcePath) {
      console.error(`CharacterCardLoader (${context?.nodeId}): Missing character card resource path.`);
      throw new Error('Character card resource not selected');
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

    if (cardResourcePath.startsWith('user://') && !userId) {
      console.error(`CharacterCardLoader (${context?.nodeId}): User ID is required for user-specific resource path: ${cardResourcePath}`);
      throw new Error('User context is required to load this user-specific character card.');
    }

    console.log(`CharacterCardLoader (${context?.nodeId}): Loading character card from logical path: ${cardResourcePath} (User: ${userId || 'shared/system'})`);

    try {
      // TODO: 确认资源路径格式和加载方式
      // TODO: 添加对 PNG 格式角色卡元数据的提取和解析逻辑
      // (PNG logic would also use famService.readFile(userId, cardResourcePath, "binary"))
      // if (cardResourcePath.toLowerCase().endsWith('.png')) {
      //   const buffer = await famService.readFile(userId, cardResourcePath, "binary");
      //   if (!(buffer instanceof Buffer)) {
      //      throw new Error('Failed to read PNG card as Buffer.');
      //   }
      //   const chunks = await extract(new Uint8Array(buffer));
      //   const textChunks = chunks.filter(chunk => chunk.name === 'tEXt').map(decode);
      //   const characterDataChunk = textChunks.find(chunk => chunk.keyword === 'chara'); // or ccv3
      //   if (characterDataChunk) {
      //     const jsonData = JSON.parse(Buffer.from(characterDataChunk.text, 'base64').toString('utf8'));
      //     console.log(`CharacterCardLoader (${context?.nodeId}): Character card (PNG metadata) loaded successfully.`);
      //     return { characterData: jsonData };
      //   } else {
      //     throw new Error('PNG file does not contain character data.');
      //   }
      // } else { // 默认按 JSON 处理
        const fileContent = await famService.readFile(userId, cardResourcePath, 'utf-8');
        if (typeof fileContent !== 'string') {
          throw new Error('Failed to read character card content as string.');
        }
        const characterData = JSON.parse(fileContent);
        console.log(`CharacterCardLoader (${context?.nodeId}): Character card (JSON) loaded successfully.`);
        return { characterData: characterData };
      // }

    } catch (error: any) {
      console.error(`CharacterCardLoader (${context?.nodeId}): Failed to load/parse character card "${cardResourcePath}" - ${error.message}`);
      // Re-throw the error or throw a new one
      throw new Error(`Failed to load character card: ${error.message}`);
    }
  }
}

export const definition: NodeDefinition = {
  type: 'CharacterCardLoader',
  category: 'Loaders',
  displayName: '👤加载角色卡',
  description: '从文件加载角色卡数据 (JSON/PNG)',
  width: 300,

  inputs: {},
  outputs: {
    characterData: {
      dataFlowType: 'OBJECT',
      displayName: '角色数据',
      description: '解析后的角色卡数据对象',
      matchCategories: ['CharacterProfile']
    }
    // Removed error output port
  },

  configSchema: {
    cardResource: {
      dataFlowType: 'STRING', // RESOURCE_SELECTOR value is a string (path/ID)
      displayName: '角色卡文件',
      description: '选择一个角色卡文件 (JSON 或 PNG)',
      required: true,
      matchCategories: ['ResourceId', 'FilePath'],
      config: {
        // 需要确认系统中实际的资源类型标识
        acceptedTypes: [
          { value: 'json', label: '角色卡 (JSON)' },
          { value: 'png', label: '角色卡 (PNG)' },
          // { value: 'charactercard', label: '角色卡文件' } // 或者可能是这样
        ],
        placeholder: '选择一个角色卡文件...',
      }
    }
  },

  execute: CharacterCardLoaderNodeImpl.execute
};