import type { NodeDefinition } from '@comfytavern/types';
import { promises as fs } from 'fs';
import path from 'path';
// import { extract } from 'png-chunks-extract'; // 可选：如果需要支持 PNG 元数据提取
// import { decode } from 'png-chunk-text';     // 可选：解码 PNG 文本块

class CharacterCardLoaderNodeImpl {
  static async execute(inputs: Record<string, any>, context: any): Promise<Record<string, any>> {
    const nodeData = context?.nodeData;
    const cardResourcePath = nodeData?.cardResource;

    if (!cardResourcePath) {
      console.error(`CharacterCardLoader (${context?.nodeId}): Missing character card resource path.`);
      // Throw error instead of returning
      throw new Error('Character card resource not selected');
    }

    console.log(`CharacterCardLoader (${context?.nodeId}): Loading character card from: ${cardResourcePath}`);

    try {
      // TODO: 确认资源路径格式和加载方式
      // TODO: 添加对 PNG 格式角色卡元数据的提取和解析逻辑
      // if (cardResourcePath.toLowerCase().endsWith('.png')) {
      //   const buffer = await fs.readFile(cardResourcePath);
      //   const chunks = await extract(buffer);
      //   const textChunks = chunks.filter(chunk => chunk.name === 'tEXt').map(decode);
      //   const characterDataChunk = textChunks.find(chunk => chunk.keyword === 'chara');
      //   if (characterDataChunk) {
      //     characterData = JSON.parse(Buffer.from(characterDataChunk.text, 'base64').toString('utf8'));
      //     console.log(`CharacterCardLoader (${context?.nodeId}): Character card (PNG metadata) loaded successfully.`);
      //     return { characterData: characterData };
      //   } else {
      //     throw new Error('PNG file does not contain character data (tEXt chunk with keyword "chara").');
      //   }
      // } else { // 默认按 JSON 处理
        const fileContent = await fs.readFile(cardResourcePath, 'utf-8');
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