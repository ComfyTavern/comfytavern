/**
 * 画布操作历史记录条目的详细信息
 * 允许存储与特定操作相关的任意键值对
 */
export interface HistoryEntryDetails {
  [key: string]: any; // 允许任意详细参数
  key?: string;        // 例如接口的 key
  propertyName?: string; // 例如修改的属性名 ('width', 'name')
  oldValue?: any;        // 属性旧值
  newValue?: any;        // 属性新值
  nodeId?: string;       // 相关节点 ID
  nodeName?: string;     // 相关节点名称
  nodeType?: string;     // 相关节点类型
  direction?: 'up' | 'down'; // 例如移动方向
  // ... 可根据需要添加其他特定操作的细节字段
}

/**
 * 结构化的画布操作历史记录条目对象
 */
export interface HistoryEntry {
  /** 操作类型 (例如: 'modify', 'add', 'delete', 'move', 'adjust', 'sort') */
  actionType: string;
  /** 操作对象类型 (例如: 'node', 'interface', 'canvas', 'component') */
  objectType: string;
  /** 核心描述 (简洁，适合列表展示，未来可用于 i18n Key) */
  summary: string;
  /** 详细信息对象，用于生成 Tooltip 或详细视图 */
  details: HistoryEntryDetails;
  /** 操作发生的时间戳 (Unix timestamp in milliseconds) */
  timestamp: number;
  // /** (未来预留) 指向翻译文件的键 */
  // i18nKey?: string;
  // /** (未来预留) 传递给 i18n 函数的参数 */
  // i18nParams?: Record<string, any>;
}

// ============ 聊天历史相关类型定义 ============

/**
 * 聊天消息节点 - 聊天历史树的基本单元
 */
export interface ChatMessageNode {
  /** 节点唯一标识符 */
  id: string;
  /** 父节点ID，null表示根节点 */
  parentId: string | null;
  /** 消息角色 */
  role: 'user' | 'assistant' | 'system';
  /** 消息内容 */
  content: string;
  /** 节点状态 */
  status?: 'generating' | 'complete' | 'error';
  /** 是否启用此节点 */
  isEnabled: boolean;
  /** 创建时间 ISO 8601 */
  createdAt: string;
  /** 更新时间 ISO 8601 */
  updatedAt?: string;
  /** 节点元数据 */
  metadata?: Record<string, any>;
  /** 子节点ID列表 */
  children: string[];
}

/**
 * 聊天历史树 - 非线性对话历史结构
 */
export interface ChatHistoryTree {
  /** 会话ID */
  sessionId: string;
  /** 版本号，用于乐观锁控制 */
  version: number;
  /** 所有节点的映射 */
  nodes: Record<string, ChatMessageNode>;
  /** 根节点ID列表 */
  rootNodeIds: string[];
  /** 当前活动的叶节点ID */
  activeLeafId: string | null;
  /** 树元数据 */
  metadata: {
    /** 会话标题 */
    title?: string;
    /** 会话描述 */
    description?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新时间 */
    updatedAt: string;
    /** Token计数 */
    tokenCount?: number;
    /** 标签 */
    tags?: string[];
    /** 自定义设置 */
    settings?: Record<string, any>;
  };
  /** 媒体资源列表 */
  assets?: Array<{
    id: string;
    type: 'image' | 'audio' | 'video' | 'document';
    url: string;
    metadata?: Record<string, any>;
  }>;
}

/**
 * 聊天会话元数据 - 用于会话列表展示
 */
export interface ChatSession {
  /** 会话ID */
  id: string;
  /** 所属项目ID */
  projectId: string;
  /** 会话标题 */
  title: string;
  /** 会话描述 */
  description?: string;
  /** 最后一条消息预览 */
  lastMessage?: string;
  /** 最后活动时间 */
  lastActivity: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 消息数量 */
  messageCount: number;
  /** 分支数量 */
  branchCount: number;
  /** Token计数 */
  tokenCount: number;
  /** 标签 */
  tags?: string[];
  /** 会话类型 */
  type: 'chat' | 'roleplay' | 'task' | 'other';
  /** 自定义设置 */
  settings?: Record<string, any>;
}

/**
 * 导出格式
 */
export type ExportFormat = 'json' | 'markdown' | 'text';

/**
 * 树编辑操作 - 用于批量修改聊天历史树结构
 */
export interface TreeEditOperation {
  /** 操作类型 */
  type: 'prune' | 'graft' | 'enable' | 'disable' | 'delete';
  /** 源节点ID (用于 prune, graft) */
  sourceNodeId?: string;
  /** 目标节点ID (用于 graft) */
  targetNodeId?: string;
  /** 节点ID列表 (用于 enable, disable, delete) */
  nodeIds?: string[];
}