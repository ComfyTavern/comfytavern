
import { Elysia, t, type Context as ElysiaBaseContext } from 'elysia';
import { 
  UserContext,
  ChatHistoryTree,
  ChatMessageNode,
  ChatSession,
  ExportFormat,
  TreeEditOperation
} from '@comfytavern/types';
import { 
  chatHistoryService,
  ChatHistoryNotFoundError,
  ChatHistoryLoadError,
  ChatHistoryVersionConflictError,
  ChatSessionConflictError
} from '../services/ChatHistoryService';
import crypto from 'node:crypto';

// 辅助函数：从 UserContext 中安全地提取 userId
function getUserIdFromContext(userContext: UserContext | null): string | null {
  return userContext?.currentUser?.uid ?? null;
}

// 定义认证上下文接口
interface AuthenticatedContext extends ElysiaBaseContext {
  userContext: UserContext | null;
}

// 导出聊天路由插件
export const chatRoutes = new Elysia({ 
  prefix: '/api/chat', 
  name: 'chat-routes', 
  seed: 'comfy.chat.routes' 
})
  // ============ 会话管理接口 ============
  
  // GET /api/chat/sessions - 获取会话列表
  .get('/sessions', async (ctx) => {
    const { set, userContext, query } = ctx as AuthenticatedContext & { 
      query: { projectId?: string } 
    };
    
    const userId = getUserIdFromContext(userContext);
    if (!userId) {
      set.status = 401;
      return { error: '未经授权的访问：无法确定 userId' };
    }

    const projectId = query.projectId;
    if (!projectId) {
      set.status = 400;
      return { error: '缺少必需的参数: projectId' };
    }

    try {
      const sessions = await chatHistoryService.listChatSessions(userId, projectId);
      return sessions;
    } catch (error: any) {
      console.error('[GET /api/chat/sessions] 列出会话失败:', error);
      set.status = 500;
      return { error: '列出会话失败', details: error.message };
    }
  })

  // POST /api/chat/sessions - 创建新会话
  .post('/sessions', async (ctx) => {
    const { body, set, userContext } = ctx as AuthenticatedContext & {
      body: {
        projectId: string;
        title?: string;
        description?: string;
        type?: 'chat' | 'roleplay' | 'task' | 'other';
        tags?: string[];
        settings?: Record<string, any>;
      }
    };

    const userId = getUserIdFromContext(userContext);
    if (!userId) {
      set.status = 401;
      return { error: '未经授权的访问：无法确定 userId' };
    }

    const { projectId, ...metadata } = body;
    if (!projectId) {
      set.status = 400;
      return { error: '缺少必需的参数: projectId' };
    }

    try {
      const session = await chatHistoryService.createSession(
        userId,
        projectId,
        metadata
      );
      set.status = 201;
      return session;
    } catch (error: any) {
      console.error('[POST /api/chat/sessions] 创建会话失败:', error);
      if (error instanceof ChatSessionConflictError) {
        set.status = 409;
        return { error: error.message };
      }
      set.status = 500;
      return { error: '创建会话失败', details: error.message };
    }
  })

  // DELETE /api/chat/sessions/:sessionId - 删除会话
  .delete('/sessions/:sessionId', async (ctx) => {
    const { params: { sessionId }, query, set, userContext } = ctx as AuthenticatedContext & {
      params: { sessionId: string };
      query: { projectId?: string };
    };

    const userId = getUserIdFromContext(userContext);
    if (!userId) {
      set.status = 401;
      return { error: '未经授权的访问：无法确定 userId' };
    }

    const projectId = query.projectId;
    if (!projectId) {
      set.status = 400;
      return { error: '缺少必需的参数: projectId' };
    }

    try {
      await chatHistoryService.deleteChatHistory(userId, projectId, sessionId);
      set.status = 204;
      return;
    } catch (error: any) {
      console.error(`[DELETE /api/chat/sessions/${sessionId}] 删除会话失败:`, error);
      if (error instanceof ChatHistoryNotFoundError) {
        set.status = 404;
        return { error: error.message };
      }
      set.status = 500;
      return { error: '删除会话失败', details: error.message };
    }
  })

  // PUT /api/chat/sessions/:sessionId/metadata - 更新会话元数据
  .put('/sessions/:sessionId/metadata', async (ctx) => {
    const { params: { sessionId }, query, body, set, userContext } = ctx as AuthenticatedContext & {
      params: { sessionId: string };
      query: { projectId?: string };
      body: {
        title?: string;
        description?: string;
        tags?: string[];
        settings?: Record<string, any>;
      };
    };

    const userId = getUserIdFromContext(userContext);
    if (!userId) {
      set.status = 401;
      return { error: '未经授权的访问：无法确定 userId' };
    }

    const projectId = query.projectId;
    if (!projectId) {
      set.status = 400;
      return { error: '缺少必需的参数: projectId' };
    }

    try {
      await chatHistoryService.updateSessionMetadata(
        userId,
        projectId,
        sessionId,
        body
      );
      return { success: true };
    } catch (error: any) {
      console.error(`[PUT /api/chat/sessions/${sessionId}/metadata] 更新元数据失败:`, error);
      if (error instanceof ChatHistoryNotFoundError) {
        set.status = 404;
        return { error: error.message };
      }
      set.status = 500;
      return { error: '更新会话元数据失败', details: error.message };
    }
  })

  // POST /api/chat/sessions/:sessionId/export - 导出会话
  .post('/sessions/:sessionId/export', async (ctx) => {
    const { params: { sessionId }, query, body, set, userContext } = ctx as AuthenticatedContext & {
      params: { sessionId: string };
      query: { projectId?: string };
      body: {
        format: 'json' | 'markdown' | 'text';
      };
    };

    const userId = getUserIdFromContext(userContext);
    if (!userId) {
      set.status = 401;
      return { error: '未经授权的访问：无法确定 userId' };
    }

    const projectId = query.projectId;
    if (!projectId) {
      set.status = 400;
      return { error: '缺少必需的参数: projectId' };
    }

    const format = body?.format || 'json';

    try {
      const exportData = await chatHistoryService.exportSession(
        userId,
        projectId,
        sessionId,
        format as ExportFormat
      );
      
      // 设置响应头
      const contentType = format === 'json' ? 'application/json' : 'text/plain';
      const fileName = `chat-${sessionId}.${format === 'markdown' ? 'md' : format}`;
      
      set.headers = {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`
      };
      
      return exportData;
    } catch (error: any) {
      console.error(`[POST /api/chat/sessions/${sessionId}/export] 导出会话失败:`, error);
      if (error instanceof ChatHistoryNotFoundError) {
        set.status = 404;
        return { error: error.message };
      }
      set.status = 500;
      return { error: '导出会话失败', details: error.message };
    }
  })

  // POST /api/chat/sessions/import - 导入会话
  .post('/sessions/import', async (ctx) => {
    const { body, set, userContext } = ctx as AuthenticatedContext & {
      body: {
        projectId: string;
        data: string;
        format?: 'json' | 'sillytavern';
      };
    };

    const userId = getUserIdFromContext(userContext);
    if (!userId) {
      set.status = 401;
      return { error: '未经授权的访问：无法确定 userId' };
    }

    const { projectId, data, format = 'json' } = body;
    if (!projectId || !data) {
      set.status = 400;
      return { error: '缺少必需的参数: projectId 或 data' };
    }

    try {
      const session = await chatHistoryService.importSession(
        userId,
        projectId,
        data,
        format
      );
      set.status = 201;
      return session;
    } catch (error: any) {
      console.error('[POST /api/chat/sessions/import] 导入会话失败:', error);
      set.status = 500;
      return { error: '导入会话失败', details: error.message };
    }
  })

  // ============ 会话内容接口 ============

  // GET /api/chat/:sessionId/tree - 获取聊天历史树
  .get('/:sessionId/tree', async (ctx) => {
    const { params: { sessionId }, query, set, userContext } = ctx as AuthenticatedContext & {
      params: { sessionId: string };
      query: { projectId?: string };
    };

    const userId = getUserIdFromContext(userContext);
    if (!userId) {
      set.status = 401;
      return { error: '未经授权的访问：无法确定 userId' };
    }

    const projectId = query.projectId;
    if (!projectId) {
      set.status = 400;
      return { error: '缺少必需的参数: projectId' };
    }

    try {
      const historyTree = await chatHistoryService.loadChatHistory(
        userId,
        projectId,
        sessionId
      );
      return historyTree;
    } catch (error: any) {
      console.error(`[GET /api/chat/${sessionId}/tree] 获取聊天历史失败:`, error);
      if (error instanceof ChatHistoryNotFoundError) {
        set.status = 404;
        return { error: error.message };
      }
      if (error instanceof ChatHistoryLoadError) {
        set.status = 500;
        return { error: error.message };
      }
      set.status = 500;
      return { error: '获取聊天历史失败', details: error.message };
    }
  })

  // POST /api/chat/:sessionId/message - 发送新消息
  .post('/:sessionId/message', async (ctx) => {
    const { params: { sessionId }, query, body, set, userContext } = ctx as AuthenticatedContext & {
      params: { sessionId: string };
      query: { projectId?: string };
      body: {
        parentId: string | null;
        role: 'user' | 'assistant' | 'system';
        content: string;
        metadata?: Record<string, any>;
      };
    };

    const userId = getUserIdFromContext(userContext);
    if (!userId) {
      set.status = 401;
      return { error: '未经授权的访问：无法确定 userId' };
    }

    const projectId = query.projectId;
    if (!projectId) {
      set.status = 400;
      return { error: '缺少必需的参数: projectId' };
    }

    const { parentId, role, content, metadata } = body;
    if (!role || !content) {
      set.status = 400;
      return { error: '缺少必需的参数: role 或 content' };
    }

    try {
      const updatedTree = await chatHistoryService.updateChatHistory(
        userId,
        projectId,
        sessionId,
        (tree) => {
          const nodeId = crypto.randomUUID();
          const now = new Date().toISOString();
          
          const newNode: ChatMessageNode = {
            id: nodeId,
            parentId,
            role,
            content,
            status: role === 'assistant' ? 'generating' : 'complete',
            isEnabled: true,
            createdAt: now,
            metadata,
            children: []
          };

          // 添加节点到树
          tree.nodes[nodeId] = newNode;
          
          // 更新父节点的children
          if (parentId && tree.nodes[parentId]) {
            tree.nodes[parentId].children.push(nodeId);
          } else if (!parentId) {
            // 如果没有父节点，添加到根节点列表
            tree.rootNodeIds.push(nodeId);
          }
          
          // 更新活动叶节点
          tree.activeLeafId = nodeId;
          
          return tree;
        }
      );

      set.status = 201;
      return {
        nodeId: updatedTree.activeLeafId,
        tree: updatedTree
      };
    } catch (error: any) {
      console.error(`[POST /api/chat/${sessionId}/message] 发送消息失败:`, error);
      if (error instanceof ChatHistoryNotFoundError) {
        set.status = 404;
        return { error: error.message };
      }
      if (error instanceof ChatHistoryVersionConflictError) {
        set.status = 409;
        return { error: error.message };
      }
      set.status = 500;
      return { error: '发送消息失败', details: error.message };
    }
  })

  // PUT /api/chat/:sessionId/tree/edit - 处理结构性编辑
  .put('/:sessionId/tree/edit', async (ctx) => {
    const { params: { sessionId }, query, body, set, userContext } = ctx as AuthenticatedContext & {
      params: { sessionId: string };
      query: { projectId?: string };
      body: {
        operations: TreeEditOperation[];
      };
    };

    const userId = getUserIdFromContext(userContext);
    if (!userId) {
      set.status = 401;
      return { error: '未经授权的访问：无法确定 userId' };
    }

    const projectId = query.projectId;
    if (!projectId) {
      set.status = 400;
      return { error: '缺少必需的参数: projectId' };
    }

    const { operations } = body;
    if (!operations || !Array.isArray(operations)) {
      set.status = 400;
      return { error: '缺少必需的参数: operations' };
    }

    try {
      const updatedTree = await chatHistoryService.updateChatHistory(
        userId,
        projectId,
        sessionId,
        (tree) => {
          for (const op of operations) {
            switch (op.type) {
              case 'prune':
                // 剪枝操作：从指定节点断开其所有后续对话
                if (op.sourceNodeId && tree.nodes[op.sourceNodeId]) {
                  tree.nodes[op.sourceNodeId].children = [];
                }
                break;
                
              case 'graft':
                // 嫁接操作：将一个分支连接到目标节点
                if (op.sourceNodeId && op.targetNodeId && 
                    tree.nodes[op.sourceNodeId] && tree.nodes[op.targetNodeId]) {
                  tree.nodes[op.sourceNodeId].parentId = op.targetNodeId;
                  tree.nodes[op.targetNodeId].children.push(op.sourceNodeId);
                }
                break;
                
              case 'enable':
              case 'disable':
                // 启用/禁用节点
                if (op.nodeIds) {
                  for (const nodeId of op.nodeIds) {
                    if (tree.nodes[nodeId]) {
                      tree.nodes[nodeId].isEnabled = op.type === 'enable';
                    }
                  }
                }
                break;
                
              case 'delete':
                // 删除节点
                if (op.nodeIds) {
                  for (const nodeId of op.nodeIds) {
                    delete tree.nodes[nodeId];
                    // 同时从父节点的children中移除
                    for (const node of Object.values(tree.nodes)) {
                      if (node && typeof node === 'object' && 'children' in node && Array.isArray(node.children)) {
                        const idx = node.children.indexOf(nodeId);
                        if (idx !== -1) {
                          node.children.splice(idx, 1);
                        }
                      }
                    }
                    // 从根节点列表中移除
                    const rootIdx = tree.rootNodeIds.indexOf(nodeId);
                    if (rootIdx !== -1) {
                      tree.rootNodeIds.splice(rootIdx, 1);
                    }
                  }
                }
                break;
            }
          }
          
          return tree;
        }
      );

      return updatedTree;
    } catch (error: any) {
      console.error(`[PUT /api/chat/${sessionId}/tree/edit] 编辑树结构失败:`, error);
      if (error instanceof ChatHistoryNotFoundError) {
        set.status = 404;
        return { error: error.message };
      }
      set.status = 500;
      return { error: '编辑树结构失败', details: error.message };
    }
  })

  // PUT /api/chat/:sessionId/node/:nodeId/state - 更新节点状态
  .put('/:sessionId/node/:nodeId/state', async (ctx) => {
    const { params: { sessionId, nodeId }, query, body, set, userContext } = ctx as AuthenticatedContext & {
      params: { sessionId: string; nodeId: string };
      query: { projectId?: string };
      body: {
        isEnabled?: boolean;
        status?: 'generating' | 'complete' | 'error';
        content?: string;
        metadata?: Record<string, any>;
      };
    };

    const userId = getUserIdFromContext(userContext);
    if (!userId) {
      set.status = 401;
      return { error: '未经授权的访问：无法确定 userId' };
    }

    const projectId = query.projectId;
    if (!projectId) {
      set.status = 400;
      return { error: '缺少必需的参数: projectId' };
    }

    try {
      const updatedTree = await chatHistoryService.updateChatHistory(
        userId,
        projectId,
        sessionId,
        (tree) => {
          if (!tree.nodes[nodeId]) {
            throw new Error(`节点 ${nodeId} 不存在`);
          }

          const node = tree.nodes[nodeId];
          
          if (body.isEnabled !== undefined) {
            node.isEnabled = body.isEnabled;
          }
          if (body.status !== undefined) {
            node.status = body.status;
          }
          if (body.content !== undefined) {
            node.content = body.content;
            node.updatedAt = new Date().toISOString();
          }
          if (body.metadata !== undefined) {
            node.metadata = { ...node.metadata, ...body.metadata };
          }
          
          return tree;
        }
      );

      return { success: true, tree: updatedTree };
    } catch (error: any) {
      console.error(`[PUT /api/chat/${sessionId}/node/${nodeId}/state] 更新节点状态失败:`, error);
      if (error instanceof ChatHistoryNotFoundError) {
        set.status = 404;
        return { error: error.message };
      }
      if (error.message?.includes('不存在')) {
        set.status = 404;
        return { error: error.message };
      }
      set.status = 500;
      return { error: '更新节点状态失败', details: error.message };
    }
  })

  // PUT /api/chat/:sessionId/active_leaf - 设置活动叶节点
  .put('/:sessionId/active_leaf', async (ctx) => {
    const { params: { sessionId }, query, body, set, userContext } = ctx as AuthenticatedContext & {
      params: { sessionId: string };
      query: { projectId?: string };
      body: {
        leafNodeId: string | null;
      };
    };

    const userId = getUserIdFromContext(userContext);
    if (!userId) {
      set.status = 401;
      return { error: '未经授权的访问：无法确定 userId' };
    }

    const projectId = query.projectId;
    if (!projectId) {
      set.status = 400;
      return { error: '缺少必需的参数: projectId' };
    }

    const { leafNodeId } = body;

    try {
      const updatedTree = await chatHistoryService.updateChatHistory(
        userId,
        projectId,
        sessionId,
        (tree) => {
          if (leafNodeId && !tree.nodes[leafNodeId]) {
            throw new Error(`节点 ${leafNodeId} 不存在`);
          }
          
          tree.activeLeafId = leafNodeId;
          return tree;
        }
      );

      return { success: true, activeLeafId: updatedTree.activeLeafId };
    } catch (error: any) {
      console.error(`[PUT /api/chat/${sessionId}/active_leaf] 设置活动叶节点失败:`, error);
      if (error instanceof ChatHistoryNotFoundError) {
        set.status = 404;
        return { error: error.message };
      }
      if (error.message?.includes('不存在')) {
        set.status = 404;
        return { error: error.message };
      }
      set.status = 500;
      return { error: '设置活动叶节点失败', details: error.message };
    }
  })

  // ============ 资源管理接口 ============

  // POST /api/chat/:sessionId/assets - 上传资源文件
  .post('/:sessionId/assets', async (ctx) => {
    const { params: { sessionId }, query, body, set, userContext } = ctx as AuthenticatedContext & {
      params: { sessionId: string };
      query: { projectId?: string };
      body: {
        file: Blob;
        filename: string;
        type?: string;
      };
    };

    const userId = getUserIdFromContext(userContext);
    if (!userId) {
      set.status = 401;
      return { error: '未经授权的访问：无法确定 userId' };
    }

    const projectId = query.projectId;
    if (!projectId) {
      set.status = 400;
      return { error: '缺少必需的参数: projectId' };
    }

    const { file, filename, type } = body;
    if (!file || !filename) {
      set.status = 400;
      return { error: '缺少必需的参数: file 或 filename' };
    }

    try {
      // 将 Blob 转换为 Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const assetPath = await chatHistoryService.uploadAsset(
        userId,
        projectId,
        sessionId,
        buffer,
        filename,
        type || 'application/octet-stream'
      );
      
      set.status = 201;
      return {
        success: true,
        assetPath,
        url: `/api/chat/${sessionId}/assets/${encodeURIComponent(filename)}`
      };
    } catch (error: any) {
      console.error(`[POST /api/chat/${sessionId}/assets] 上传资源失败:`, error);
      set.status = 500;
      return { error: '上传资源失败', details: error.message };
    }
  })

  // GET /api/chat/:sessionId/assets - 获取会话资源列表
  .get('/:sessionId/assets', async (ctx) => {
    const { params: { sessionId }, query, set, userContext } = ctx as AuthenticatedContext & {
      params: { sessionId: string };
      query: { projectId?: string };
    };

    const userId = getUserIdFromContext(userContext);
    if (!userId) {
      set.status = 401;
      return { error: '未经授权的访问：无法确定 userId' };
    }

    const projectId = query.projectId;
    if (!projectId) {
      set.status = 400;
      return { error: '缺少必需的参数: projectId' };
    }

    try {
      const assets = await chatHistoryService.getSessionAssets(
        userId,
        projectId,
        sessionId
      );
      
      return assets;
    } catch (error: any) {
      console.error(`[GET /api/chat/${sessionId}/assets] 获取资源列表失败:`, error);
      set.status = 500;
      return { error: '获取资源列表失败', details: error.message };
    }
  });

