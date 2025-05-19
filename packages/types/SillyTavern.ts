/**
 * SillyTavern 角色卡类型定义
 */

// 角色卡基本结构
export interface CharacterCard {
  // 基本属性
  name: string;
  description: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  creatorcomment?: string;
  avatar?: string;
  chat?: string;
  talkativeness?: string;
  fav?: boolean;
  tags?: string[];
  spec?: string;
  spec_version?: string;
  create_date?: string;
  
  // 详细数据
  data?: CharacterData;
}

// 角色数据详情
export interface CharacterData {
  name?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  tags?: string[];
  creator?: string;
  character_version?: string;
  alternate_greetings?: string[];
  extensions?: CharacterExtensions;
  group_only_greetings?: string[];
}

// 角色扩展属性
export interface CharacterExtensions {
  talkativeness?: string;
  fav?: boolean;
  world?: string;
  depth_prompt?: {
    prompt?: string;
    depth?: number;
    role?: string;
  };
  [key: string]: any;
}

// UI组件使用的角色数据（处理后）
export interface CharacterCardUI {
  id?: number | string;
  name: string;
  description: string;
  image?: string;
  // 原始 SillyTavern 字段
  creatorcomment?: string;
  avatar?: string;
  chat?: string;
  talkativeness?: string;
  fav?: boolean;
  tags?: string[];
  create_date?: string;
  data?: CharacterData;
  // 驼峰式命名的处理后字段（用于 UI 组件）
  creatorComment?: string;
  characterVersion?: string;
  createDate?: string;
  creator?: string;
  favorite?: boolean;
}

// 后端 /api/characters 返回的列表中，每个角色对象的结构
export interface ApiCharacterEntry {
  id: string;
  name: string;
  description?: string;
  imageName: string | null; // 用于前端构造图片URL
  tags: string[];
  creator?: string;
  creatorComment?: string; // 驼峰式
  createDate?: string;     // 驼峰式
  characterVersion?: string;
  talkativeness?: string;
  favorite?: boolean;
  avatar?: string;         // 通常是文件名或 'none'
  chat?: string;           // 通常是聊天记录文件名
  // 如果后端还返回其他处理过的字段，也应在此定义
}