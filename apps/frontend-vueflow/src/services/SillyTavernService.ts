import type { CharacterCard, CharacterCardUI } from '../types/SillyTavern';
import extract from 'png-chunks-extract';
import PNGtext from 'png-chunk-text';
import { Buffer } from 'buffer';

/**
 * SillyTavern服务 - 处理SillyTavern相关内容的加载和管理
 */
export class SillyTavernService {
  private static instance: SillyTavernService;

  // 无需存储路径常量，因为import.meta.glob需要静态字符串

  private constructor() {
    // 私有构造函数，防止直接实例化
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): SillyTavernService {
    if (!SillyTavernService.instance) {
      SillyTavernService.instance = new SillyTavernService();
    }
    return SillyTavernService.instance;
  }

  /**
   * 加载所有角色卡
   */
  /**
   * 将角色卡数据映射为UI显示所需的格式
   */
  private mapCharacterToUI(character: CharacterCard, imageUrl: string, id: number): CharacterCardUI {
    return {
      id,
      name: character.name,
      description: character.description?.replace(/{{char}}/g, character.name).replace(/{{user}}/g, '用户'),
      image: imageUrl,
      creatorcomment: character.creatorcomment,
      avatar: character.avatar,
      chat: character.chat,
      talkativeness: character.talkativeness || character.data?.extensions?.talkativeness,
      fav: character.fav ?? character.data?.extensions?.fav,
      tags: character.tags,
      create_date: character.create_date,
      data: character.data,
      creatorComment: character.creatorcomment || character.data?.creator_notes,
      characterVersion: character.data?.character_version,
      createDate: character.create_date,
      creator: character.data?.creator,
      favorite: character.fav ?? character.data?.extensions?.fav
    };
  }

  /**
   * 从PNG图片中提取角色卡数据
   */
  private async readFromPng(image: ArrayBuffer): Promise<CharacterCard | null> {
    try {
      const chunks = extract(new Uint8Array(image));
      const textChunks = chunks.filter(chunk => chunk.name === 'tEXt').map(chunk => PNGtext.decode(chunk.data));

      if (textChunks.length === 0) {
        return null;
      }

      const ccv3Chunk = textChunks.find(chunk => chunk.keyword === 'ccv3');
      if (ccv3Chunk) {
        const jsonStr = Buffer.from(ccv3Chunk.text, 'base64').toString('utf8');
        return JSON.parse(jsonStr);
      }

      const charaChunk = textChunks.find(chunk => chunk.keyword === 'chara');
      if (charaChunk) {
        const jsonStr = Buffer.from(charaChunk.text, 'base64').toString('utf8');
        return JSON.parse(jsonStr);
      }

      return null;
    } catch (error) {
      console.error('从PNG提取角色数据失败:', error);
      return null;
    }
  }

  public async loadCharacterCards(): Promise<CharacterCardUI[]> {
    try {
      // 加载所有PNG文件
      const imageModules = import.meta.glob('@library/SillyTavern/CharacterCard/*.png', { eager: true });
      // 加载所有JSON文件
      const jsonModules = import.meta.glob('@library/SillyTavern/CharacterCard/*.json', { eager: true });
      
      const loadedCharacters: CharacterCardUI[] = [];
      const processedFileNames = new Set<string>();
      
      // 处理每个PNG文件
      for (const [imgPath, imgModule] of Object.entries(imageModules)) {
        const imageUrl = (imgModule as any).default;
        const fileName = imgPath.split('/').pop()?.split('.')[0];
        if (!fileName) continue;
        
        // 尝试从PNG中提取数据
        const response = await fetch(imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        const pngCharacter = await this.readFromPng(arrayBuffer);

        let character: CharacterCard | null = pngCharacter;

        // 如果PNG中没有数据，尝试从JSON文件加载
        if (!character) {
          const jsonKey = Object.keys(jsonModules).find(key => key.includes(fileName));
          if (jsonKey) {
            character = jsonModules[jsonKey] as unknown as CharacterCard;
          }
        }

        if (!character) {
          continue;
        }

        const processedCharacter = this.mapCharacterToUI(character, imageUrl, loadedCharacters.length + 1);
        
        loadedCharacters.push(processedCharacter);
        processedFileNames.add(fileName);
      }

      // 处理纯JSON文件（没有对应PNG的角色卡）
      for (const [jsonPath, jsonModule] of Object.entries(jsonModules)) {
        const fileName = jsonPath.split('/').pop()?.split('.')[0];
        if (!fileName || processedFileNames.has(fileName)) continue;

        const character = jsonModule as unknown as CharacterCard;
        if (!character) continue;

        // 添加到角色列表
        const processedCharacter = this.mapCharacterToUI(character, '', loadedCharacters.length + 1);
        loadedCharacters.push(processedCharacter);
      }

      return loadedCharacters;
    } catch (error) {
      console.error('加载角色卡失败:', error);
      return [];
    }
  }

  /**
   * 如果没有角色卡或加载失败，返回默认示例
   */
  public getDefaultCharacters(): CharacterCardUI[] {
    return [
      {
        id: 1,
        name: '冒险家',
        description: '勇敢的冒险家，喜欢探索未知的世界',
        image: '',
        creatorcomment: '基础角色',
        tags: ['冒险', 'RPG'],
        talkativeness: '0.7',
        fav: false,
        create_date: '2024-5-10',
        data: {
          character_version: 'v 1.0.0',
          creator: 'System',
        },
        // UI 组件字段
        creatorComment: '基础角色',
        characterVersion: 'v 1.0.0',
        createDate: '2024-5-10',
        creator: 'System',
        favorite: false
      },
      {
        id: 2,
        name: '魔法师',
        description: '精通各种元素魔法的强大施法者',
        image: '',
        creatorcomment: '掌握火、水、风、土四大元素魔法',
        tags: ['魔法', '元素'],
        talkativeness: '0.5',
        fav: true,
        create_date: '2024-5-10',
        data: {
          character_version: 'v 1.0.0',
          creator: 'System',
        },
        // UI 组件字段
        creatorComment: '掌握火、水、风、土四大元素魔法',
        characterVersion: 'v 1.0.0',
        createDate: '2024-5-10',
        creator: 'System',
        favorite: true
      }
    ];
  }

  /**
   * 加载角色卡的方法 - 如果没有角色卡则返回默认示例
   */
  public async getCharacterCards(): Promise<CharacterCardUI[]> {
    try {
      const characters = await this.loadCharacterCards();
      if (characters.length === 0) {
        return this.getDefaultCharacters();
      }
      return characters;
    } catch (error) {
      console.error('获取角色卡失败:', error);
      return this.getDefaultCharacters();
    }
  }

  // 可以添加以下方法
  // - loadPresets() - 加载预设
  // - loadWorldInfo() - 加载世界信息
  // - saveCharacterCard() - 保存角色卡
  // - deleteCharacterCard() - 删除角色卡
  // - exportCharacterCard() - 导出角色卡
  // - importCharacterCard() - 导入角色卡
}

// 导出单例实例
export const sillyTavernService = SillyTavernService.getInstance();