/**
 * 历史记录条目的详细信息
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
 * 结构化的历史记录条目对象
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