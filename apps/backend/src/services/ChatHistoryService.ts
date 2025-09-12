import {
  ChatHistoryTree,
  ChatMessageNode,
  ChatSession,
  ExportFormat
} from '@comfytavern/types';
import { famService } from './FileManagerService';
import { z } from 'zod';
import crypto from 'node:crypto';

// LRU缓存实现
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // 将访问的项移到最后（最近使用）
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // 如果已存在，先删除
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // 如果缓存已满，删除最老的项（第一个）
    else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    // 添加到末尾
    this.cache.set(key, value);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }
}

// 定义异步写入队列项
interface WriteQueueItem {
  userId: string;
  sessionId: string;
  data: ChatHistoryTree;
  resolve: () => void;
  reject: (error: Error) => void;
}

// 定义错误类
export class ChatHistoryNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatHistoryNotFoundError';
  }
}

export class ChatHistoryLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatHistoryLoadError';
  }
}

export class ChatHistoryVersionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatHistoryVersionConflictError';
  }
}

export class ChatSessionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatSessionConflictError';
  }
}

// ChatHistoryTree的Zod Schema
const ChatMessageNodeSchema: z.ZodType<ChatMessageNode> = z.lazy(() => z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  status: z.enum(['generating', 'complete', 'error']).optional(),
  isEnabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  children: z.array(z.string())
}));

const ChatHistoryTreeSchema: z.ZodType<ChatHistoryTree> = z.object({
  sessionId: z.string(),
  version: z.number(),
  nodes: z.record(ChatMessageNodeSchema),
  rootNodeIds: z.array(z.string()),
  activeLeafId: z.string().nullable(),
  metadata: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    tokenCount: z.number().optional(),
    tags: z.array(z.string()).optional(),
    settings: z.record(z.any()).optional()
  }),
  assets: z.array(z.object({
    id: z.string(),
    type: z.enum(['image', 'audio', 'video', 'document']),
    url: z.string(),
    metadata: z.record(z.any()).optional()
  })).optional()
});

const ChatSessionSchema: z.ZodType<ChatSession> = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  lastMessage: z.string().optional(),
  lastActivity: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messageCount: z.number(),
  branchCount: z.number(),
  tokenCount: z.number(),
  tags: z.array(z.string()).optional(),
  type: z.enum(['chat', 'roleplay', 'task', 'other']),
  settings: z.record(z.any()).optional()
});

export class ChatHistoryService {
  private static instance: ChatHistoryService;
  
  // LRU缓存，缓存最近访问的聊天历史
  private historyCache: LRUCache<string, ChatHistoryTree>;
  
  // 异步写入队列
  private writeQueue: WriteQueueItem[] = [];
  private isProcessingQueue = false;
  private writeDebounceTimer: NodeJS.Timeout | null = null;
  private readonly WRITE_DEBOUNCE_MS = 1000; // 1秒防抖
  private readonly CACHE_SIZE = 20; // 缓存最多20个会话

  private constructor() {
    this.historyCache = new LRUCache<string, ChatHistoryTree>(this.CACHE_SIZE);
  }

  public static getInstance(): ChatHistoryService {
    if (!ChatHistoryService.instance) {
      ChatHistoryService.instance = new ChatHistoryService();
    }
    return ChatHistoryService.instance;
  }

  // 生成缓存键
  private getCacheKey(userId: string, sessionId: string): string {
    return `${userId}:${sessionId}`;
  }

  // 获取会话文件的逻辑路径
  private getSessionPath(userId: string, projectId: string, sessionId: string): string {
    return `user://projects/${projectId}/chats/${sessionId}.json`;
  }

  // 获取会话列表目录的逻辑路径
  private getSessionsDir(userId: string, projectId: string): string {
    return `user://projects/${projectId}/chats/`;
  }

  // 获取媒体资源目录的逻辑路径  
  private getAssetsDir(userId: string, projectId: string, sessionId: string): string {
    return `user://projects/${projectId}/assets/chats/${sessionId}/`;
  }

  /**
   * 创建新的聊天会话
   */
  async createSession(
    userId: string,
    projectId: string,
    metadata?: Partial<ChatSession>
  ): Promise<ChatSession> {
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // 创建会话元数据
    const session: ChatSession = {
      id: sessionId,
      projectId,
      title: metadata?.title || `会话 ${new Date().toLocaleDateString()}`,
      description: metadata?.description,
      lastActivity: now,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      branchCount: 0,
      tokenCount: 0,
      type: metadata?.type || 'chat',
      tags: metadata?.tags,
      settings: metadata?.settings
    };

    // 创建初始聊天历史树
    const historyTree: ChatHistoryTree = {
      sessionId,
      version: 1,
      nodes: {},
      rootNodeIds: [],
      activeLeafId: null,
      metadata: {
        title: session.title,
        description: session.description,
        createdAt: now,
        updatedAt: now,
        tokenCount: 0,
        tags: session.tags,
        settings: session.settings
      }
    };

    // 保存会话文件
    const sessionPath = this.getSessionPath(userId, projectId, sessionId);
    await famService.writeFile(
      userId,
      sessionPath,
      JSON.stringify(historyTree, null, 2)
    );

    // 添加到缓存
    const cacheKey = this.getCacheKey(userId, sessionId);
    this.historyCache.set(cacheKey, historyTree);

    console.log(`[ChatHistoryService] Created new session ${sessionId} for project ${projectId}`);
    return session;
  }

  /**
   * 列出项目下所有聊天会话
   */
  async listChatSessions(userId: string, projectId: string): Promise<ChatSession[]> {
    const sessionsDir = this.getSessionsDir(userId, projectId);
    
    try {
      const dirItems = await famService.listDir(userId, sessionsDir);
      const sessionFiles = dirItems.filter(
        item => item.itemType === 'file' && item.name.endsWith('.json')
      );

      const sessions: ChatSession[] = [];
      for (const file of sessionFiles) {
        try {
          const content = await famService.readFile(userId, file.logicalPath, 'utf-8');
          if (typeof content !== 'string') continue;
          
          const historyTree = ChatHistoryTreeSchema.parse(JSON.parse(content));
          const sessionId = file.name.replace('.json', '');
          
          // 计算统计信息
          const nodeCount = Object.keys(historyTree.nodes).length;
          const leafNodes = Object.values(historyTree.nodes).filter(
            (node) => {
              if (!node || typeof node !== 'object' || !('children' in node)) {
                return false;
              }
              const typedNode = node as ChatMessageNode;
              return Array.isArray(typedNode.children) && typedNode.children.length === 0;
            }
          );
          
          // 获取最后一条消息
          let lastMessage = '';
          if (historyTree.activeLeafId && historyTree.nodes[historyTree.activeLeafId]) {
            lastMessage = historyTree.nodes[historyTree.activeLeafId].content.substring(0, 100);
          }

          const session: ChatSession = {
            id: sessionId,
            projectId,
            title: historyTree.metadata.title || '未命名会话',
            description: historyTree.metadata.description,
            lastMessage,
            lastActivity: historyTree.metadata.updatedAt,
            createdAt: historyTree.metadata.createdAt,
            updatedAt: historyTree.metadata.updatedAt,
            messageCount: nodeCount,
            branchCount: leafNodes.length,
            tokenCount: historyTree.metadata.tokenCount || 0,
            tags: historyTree.metadata.tags,
            type: 'chat',
            settings: historyTree.metadata.settings
          };
          
          sessions.push(session);
        } catch (error) {
          console.error(`[ChatHistoryService] Error parsing session file ${file.name}:`, error);
        }
      }

      // 按最后活动时间排序
      sessions.sort((a, b) => 
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );

      return sessions;
    } catch (error) {
      console.error(`[ChatHistoryService] Error listing sessions:`, error);
      return [];
    }
  }

  /**
   * 搜索会话
   */
  async searchSessions(
    userId: string, 
    projectId: string, 
    query: string
  ): Promise<ChatSession[]> {
    const allSessions = await this.listChatSessions(userId, projectId);
    const lowerQuery = query.toLowerCase();
    
    return allSessions.filter(session =>
      session.title.toLowerCase().includes(lowerQuery) ||
      session.description?.toLowerCase().includes(lowerQuery) ||
      session.lastMessage?.toLowerCase().includes(lowerQuery) ||
      session.tags?.some((tag: string) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * 加载聊天历史
   */
  async loadChatHistory(
    userId: string, 
    projectId: string, 
    sessionId: string
  ): Promise<ChatHistoryTree> {
    const cacheKey = this.getCacheKey(userId, sessionId);
    
    // 先检查缓存
    const cached = this.historyCache.get(cacheKey);
    if (cached) {
      console.log(`[ChatHistoryService] Loaded session ${sessionId} from cache`);
      return cached;
    }

    // 从文件读取
    const sessionPath = this.getSessionPath(userId, projectId, sessionId);
    
    try {
      const content = await famService.readFile(userId, sessionPath, 'utf-8');
      if (typeof content !== 'string') {
        throw new ChatHistoryLoadError(`Failed to read session file as string: ${sessionPath}`);
      }

      const historyTree = ChatHistoryTreeSchema.parse(JSON.parse(content));
      
      // 添加到缓存
      this.historyCache.set(cacheKey, historyTree);
      
      console.log(`[ChatHistoryService] Loaded session ${sessionId} from file`);
      return historyTree;
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        throw new ChatHistoryNotFoundError(`Session ${sessionId} not found`);
      }
      throw new ChatHistoryLoadError(`Failed to load session ${sessionId}: ${error.message}`);
    }
  }

  /**
   * 保存聊天历史（异步写入）
   */
  async saveChatHistory(
    userId: string, 
    projectId: string, 
    sessionId: string,
    historyTree: ChatHistoryTree,
    immediate = false
  ): Promise<void> {
    // 更新缓存
    const cacheKey = this.getCacheKey(userId, sessionId);
    this.historyCache.set(cacheKey, historyTree);

    // 更新时间戳
    historyTree.metadata.updatedAt = new Date().toISOString();

    if (immediate) {
      // 立即写入
      const sessionPath = this.getSessionPath(userId, projectId, sessionId);
      await famService.writeFile(
        userId,
        sessionPath,
        JSON.stringify(historyTree, null, 2)
      );
      console.log(`[ChatHistoryService] Immediately saved session ${sessionId}`);
    } else {
      // 添加到异步写入队列
      return new Promise((resolve, reject) => {
        this.writeQueue.push({
          userId,
          sessionId: `${projectId}/${sessionId}`,
          data: historyTree,
          resolve,
          reject
        });
        
        // 设置防抖定时器
        if (this.writeDebounceTimer) {
          clearTimeout(this.writeDebounceTimer);
        }
        this.writeDebounceTimer = setTimeout(() => {
          this.processWriteQueue();
        }, this.WRITE_DEBOUNCE_MS);
      });
    }
  }

  /**
   * 处理异步写入队列
   */
  private async processWriteQueue(): Promise<void> {
    if (this.isProcessingQueue || this.writeQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    const itemsToWrite = [...this.writeQueue];
    this.writeQueue = [];

    console.log(`[ChatHistoryService] Processing write queue with ${itemsToWrite.length} items`);

    for (const item of itemsToWrite) {
      try {
        const [projectId, sessionId] = item.sessionId.split('/');
        const sessionPath = this.getSessionPath(item.userId, projectId, sessionId);
        await famService.writeFile(
          item.userId,
          sessionPath,
          JSON.stringify(item.data, null, 2)
        );
        item.resolve();
      } catch (error: any) {
        console.error(`[ChatHistoryService] Error writing session ${item.sessionId}:`, error);
        item.reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * 更新聊天历史（带版本控制）
   */
  async updateChatHistory(
    userId: string,
    projectId: string,
    sessionId: string,
    updateFn: (tree: ChatHistoryTree) => ChatHistoryTree
  ): Promise<ChatHistoryTree> {
    // 加载当前版本
    const currentTree = await this.loadChatHistory(userId, projectId, sessionId);
    const originalVersion = currentTree.version;

    // 应用更新
    const updatedTree = updateFn(currentTree);
    
    // 递增版本号
    updatedTree.version = originalVersion + 1;
    
    // 立即保存以避免版本冲突
    await this.saveChatHistory(userId, projectId, sessionId, updatedTree, true);
    
    console.log(`[ChatHistoryService] Updated session ${sessionId} from version ${originalVersion} to ${updatedTree.version}`);
    return updatedTree;
  }

  /**
   * 删除聊天历史
   */
  async deleteChatHistory(
    userId: string, 
    projectId: string, 
    sessionId: string
  ): Promise<void> {
    // 从缓存中删除
    const cacheKey = this.getCacheKey(userId, sessionId);
    this.historyCache.delete(cacheKey);

    // 删除会话文件
    const sessionPath = this.getSessionPath(userId, projectId, sessionId);
    await famService.delete(userId, sessionPath);

    // 删除相关的媒体资源目录
    const assetsDir = this.getAssetsDir(userId, projectId, sessionId);
    try {
      await famService.delete(userId, assetsDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`[ChatHistoryService] Failed to delete assets for session ${sessionId}:`, error);
    }

    console.log(`[ChatHistoryService] Deleted session ${sessionId}`);
  }

  /**
   * 更新会话元数据
   */
  async updateSessionMetadata(
    userId: string,
    projectId: string,
    sessionId: string,
    metadata: Partial<{
      title: string;
      description: string;
      tags: string[];
      settings: Record<string, any>;
    }>
  ): Promise<void> {
    await this.updateChatHistory(userId, projectId, sessionId, (tree) => {
      if (metadata.title !== undefined) tree.metadata.title = metadata.title;
      if (metadata.description !== undefined) tree.metadata.description = metadata.description;
      if (metadata.tags !== undefined) tree.metadata.tags = metadata.tags;
      if (metadata.settings !== undefined) tree.metadata.settings = metadata.settings;
      return tree;
    });
  }

  /**
   * 导出会话
   */
  async exportSession(
    userId: string,
    projectId: string,
    sessionId: string,
    format: ExportFormat
  ): Promise<string | Buffer> {
    const historyTree = await this.loadChatHistory(userId, projectId, sessionId);

    switch (format) {
      case 'json':
        return JSON.stringify(historyTree, null, 2);
      
      case 'markdown':
        return this.exportToMarkdown(historyTree);
      
      case 'text':
        return this.exportToPlainText(historyTree);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * 导入会话
   */
  async importSession(
    userId: string,
    projectId: string,
    data: string | Buffer,
    format: 'json' | 'sillytavern' = 'json'
  ): Promise<ChatSession> {
    let historyTree: ChatHistoryTree;

    if (format === 'json') {
      const jsonStr = typeof data === 'string' ? data : data.toString('utf-8');
      historyTree = ChatHistoryTreeSchema.parse(JSON.parse(jsonStr));
      
      // 生成新的会话ID避免冲突
      historyTree.sessionId = crypto.randomUUID();
    } else {
      // 可以扩展支持其他格式
      throw new Error(`Unsupported import format: ${format}`);
    }

    // 保存导入的会话
    const sessionPath = this.getSessionPath(userId, projectId, historyTree.sessionId);
    await famService.writeFile(
      userId,
      sessionPath,
      JSON.stringify(historyTree, null, 2)
    );

    // 创建会话元数据
    const session: ChatSession = {
      id: historyTree.sessionId,
      projectId,
      title: historyTree.metadata.title || '导入的会话',
      lastActivity: new Date().toISOString(),
      createdAt: historyTree.metadata.createdAt,
      updatedAt: new Date().toISOString(),
      messageCount: Object.keys(historyTree.nodes).length,
      branchCount: Object.values(historyTree.nodes).filter((n) => {
        if (!n || typeof n !== 'object' || !('children' in n)) {
          return false;
        }
        const typedNode = n as ChatMessageNode;
        return Array.isArray(typedNode.children) && typedNode.children.length === 0;
      }).length,
      tokenCount: historyTree.metadata.tokenCount || 0,
      type: 'chat'
    };

    console.log(`[ChatHistoryService] Imported session ${historyTree.sessionId}`);
    return session;
  }

  /**
   * 导出为Markdown格式
   */
  private exportToMarkdown(tree: ChatHistoryTree): string {
    let markdown = `# ${tree.metadata.title || '聊天记录'}\n\n`;
    markdown += `**创建时间**: ${tree.metadata.createdAt}\n`;
    markdown += `**更新时间**: ${tree.metadata.updatedAt}\n\n`;
    markdown += '---\n\n';

    // 获取线性对话路径
    const linearPath = this.getLinearPath(tree);
    
    for (const nodeId of linearPath) {
      const node = tree.nodes[nodeId];
      if (!node.isEnabled) continue;
      
      const roleLabels: Record<string, string> = {
        'user': '👤 用户',
        'assistant': '🤖 助手',
        'system': '⚙️ 系统'
      };
      const roleLabel = roleLabels[node.role] || node.role;
      
      markdown += `## ${roleLabel}\n\n`;
      markdown += `${node.content}\n\n`;
      markdown += `_${node.createdAt}_\n\n`;
      markdown += '---\n\n';
    }

    return markdown;
  }

  /**
   * 导出为纯文本格式
   */
  private exportToPlainText(tree: ChatHistoryTree): string {
    let text = `${tree.metadata.title || '聊天记录'}\n`;
    text += `${'='.repeat(50)}\n\n`;

    const linearPath = this.getLinearPath(tree);
    
    for (const nodeId of linearPath) {
      const node = tree.nodes[nodeId];
      if (!node.isEnabled) continue;
      
      text += `[${node.role.toUpperCase()}]\n`;
      text += `${node.content}\n`;
      text += `${'-'.repeat(30)}\n\n`;
    }

    return text;
  }

  /**
   * 获取线性对话路径
   */
  private getLinearPath(tree: ChatHistoryTree): string[] {
    const path: string[] = [];
    
    if (!tree.activeLeafId || !tree.nodes[tree.activeLeafId]) {
      return path;
    }

    // 从活动叶节点回溯到根
    let currentId: string | null = tree.activeLeafId;
    while (currentId) {
      path.unshift(currentId);
      currentId = tree.nodes[currentId].parentId;
    }

    return path;
  }

  /**
   * 上传媒体文件
   */
  async uploadAsset(
    userId: string,
    projectId: string,
    sessionId: string,
    fileData: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<{ id: string; url: string }> {
    const fileId = crypto.randomUUID();
    const ext = fileName.split('.').pop() || 'bin';
    const assetPath = `${this.getAssetsDir(userId, projectId, sessionId)}${fileId}.${ext}`;
    
    // 保存文件
    await famService.writeFile(userId, assetPath, fileData, { encoding: 'binary' });
    
    // 返回文件信息
    return {
      id: fileId,
      url: assetPath
    };
  }

  /**
   * 获取会话的媒体资源列表
   */
  async getSessionAssets(
    userId: string,
    projectId: string,
    sessionId: string
  ): Promise<Array<{ id: string; name: string; size?: number; lastModified?: number }>> {
    const assetsDir = this.getAssetsDir(userId, projectId, sessionId);
    
    try {
      const dirItems = await famService.listDir(userId, assetsDir);
      return dirItems
        .filter(item => item.itemType === 'file')
        .map(item => ({
          id: item.name.split('.')[0],
          name: item.name,
          size: item.size ?? undefined,
          lastModified: item.lastModified ?? undefined
        }));
    } catch (error) {
      console.warn(`[ChatHistoryService] Failed to list assets for session ${sessionId}:`, error);
      return [];
    }
  }
}

// 导出单例实例
export const chatHistoryService = ChatHistoryService.getInstance();