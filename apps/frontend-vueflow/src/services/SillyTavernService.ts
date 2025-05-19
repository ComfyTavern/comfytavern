import type { CharacterCardUI, ApiCharacterEntry } from '../../../../packages/types/SillyTavern';

// 本地 BackendCharacterData 接口已移除，使用共享的 ApiCharacterEntry

// Buffer, extract, PNGtext 不再需要前端导入

// 后端API的基础URL，可以考虑放到环境变量或配置文件中
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3233';


/**
 * SillyTavern服务 - 处理SillyTavern相关内容的加载和管理
 */
export class SillyTavernService {
  private static instance: SillyTavernService;

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
   * 将从后端获取的角色卡数据映射为UI显示所需的格式
   * 后端返回的结构已经比较接近 CharacterCardUI，但仍需处理图片路径和确保字段完整性
   */
  private mapBackendCharToUI(backendChar: ApiCharacterEntry): CharacterCardUI {
    // 后端返回的 card 结构 (ApiCharacterEntry) 示例:
    // {
    //   id: string,
    //   name: string,
    //   description: string,
    //   imageName: string | null, // 图片文件名，用于构造URL
    //   tags: string[],
    //   creator?: string,
    //   creatorComment?: string,
    //   createDate?: string,
    //   characterVersion?: string,
    //   talkativeness?: string,
    //   favorite?: boolean,
    //   avatar?: string,
    //   chat?: string,
    // }
    // 注意：后端返回的字段名可能与 CharacterCardUI 不完全一致，需要适配

    const imageUrl = backendChar.imageName ? `${API_BASE_URL}/api/characters/image/${backendChar.imageName}` : '';
    
    // 确保返回的字段符合 CharacterCardUI 接口
    return {
      id: backendChar.id,
      name: backendChar.name || '未知角色',
      description: backendChar.description || '',
      image: imageUrl,
      // CharacterCardUI 需要 creatorcomment (小写) 和 create_date (下划线) 作为原始字段
      // 同时需要驼峰式的 creatorComment 和 createDate 作为UI组件使用的字段
      // 后端 ApiCharacterEntry 返回的是驼峰式的 creatorComment 和 createDate
      creatorcomment: backendChar.creatorComment, // 使用后端返回的驼峰 creatorComment 填充小写c版本
      avatar: backendChar.avatar,
      chat: backendChar.chat,
      talkativeness: backendChar.talkativeness,
      fav: backendChar.favorite ?? false,
      tags: backendChar.tags || [],
      create_date: backendChar.createDate,   // 使用后端返回的驼峰 createDate 填充下划线版本
      // data: backendChar.data, // 如果 CharacterCardUI 需要 data 字段，并且后端 ApiCharacterEntry 也提供了

      // 驼峰式命名的处理后字段（用于 UI 组件）
      // 这些直接从 backendChar (ApiCharacterEntry) 获取，因为后端已处理为驼峰
      creatorComment: backendChar.creatorComment,
      characterVersion: backendChar.characterVersion,
      createDate: backendChar.createDate,
      creator: backendChar.creator,
      favorite: backendChar.favorite ?? false,
    };
  }


  public async loadCharacterCards(): Promise<CharacterCardUI[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/characters`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`获取角色卡失败: ${response.status} ${errorData.message || response.statusText}`);
      }
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        return result.data.map((charData: ApiCharacterEntry) => this.mapBackendCharToUI(charData));
      } else {
        console.error('从后端获取的角色卡数据格式不正确:', result);
        return [];
      }
    } catch (error) {
      console.error('加载角色卡失败:', error);
      return []; // 出错时返回空数组，或者可以调用 getDefaultCharacters
    }
  }

  /**
   * 如果没有角色卡或加载失败，返回默认示例
   */
  public getDefaultCharacters(): CharacterCardUI[] {
    // 这个方法可以保留，用于API调用失败时的备选方案
    return [
      {
        id: 'default-1',
        name: '冒险家 (默认)',
        description: '勇敢的冒险家，喜欢探索未知的世界',
        image: '', // 默认图片可以是一个本地 public 路径或base64
        creatorComment: '基础角色', // 使用驼峰
        tags: ['冒险', 'RPG'],
        talkativeness: '0.7',
        favorite: false, // 使用驼峰
        createDate: '2024-01-01', // 使用驼峰
        characterVersion: 'v1.0', // 使用驼峰
        creator: 'System', // 使用驼峰
        // 下面是 CharacterCardUI 中原始SillyTavern风格的字段，如果需要也应填充
        creatorcomment: '基础角色',
        fav: false,
        create_date: '2024-01-01',
      },
      {
        id: 'default-2',
        name: '魔法师 (默认)',
        description: '精通各种元素魔法的强大施法者',
        image: '',
        creatorComment: '掌握火、水、风、土四大元素魔法',
        tags: ['魔法', '元素'],
        talkativeness: '0.5',
        favorite: true,
        createDate: '2024-01-01',
        characterVersion: 'v1.0',
        creator: 'System',
        // 下面是 CharacterCardUI 中原始SillyTavern风格的字段
        creatorcomment: '掌握火、水、风、土四大元素魔法',
        fav: true,
        create_date: '2024-01-01',
      }
    ];
  }

  /**
   * 加载角色卡的方法 - 如果没有角色卡或加载失败，返回默认示例
   */
  public async getCharacterCards(): Promise<CharacterCardUI[]> {
    try {
      const characters = await this.loadCharacterCards();
      // 如果API调用成功但返回空数组，也可能需要显示默认角色或提示
      if (characters.length === 0) {
         console.warn('后端未返回角色卡数据，将使用默认角色卡。');
        return this.getDefaultCharacters();
      }
      return characters;
    } catch (error) {
      // loadCharacterCards 内部已经 catch 并返回 [] 了，这里理论上不会再捕获到 loadCharacterCards 的错误
      // 但为了保险，如果 loadCharacterCards 抛出未被捕获的异常
      console.error('获取角色卡时发生意外错误:', error);
      return this.getDefaultCharacters();
    }
  }

  // 可以添加以下方法
  // - loadPresets() - 加载预设
  // - loadWorldInfo() - 加载世界信息
  // - saveCharacterCard() - 保存角色卡 (需要后端API支持)
  // - deleteCharacterCard() - 删除角色卡 (需要后端API支持)
  // - exportCharacterCard() - 导出角色卡 (可能仍是前端逻辑，或后端辅助)
  // - importCharacterCard() - 导入角色卡 (可能仍是前端逻辑，或后端辅助)
}

// 导出单例实例
export const sillyTavernService = SillyTavernService.getInstance();