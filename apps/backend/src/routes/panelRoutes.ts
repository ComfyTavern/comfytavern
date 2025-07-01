import { Elysia, t, type Context as ElysiaBaseContext } from 'elysia';
import {
  getPanels,
  getPanelById,
  PanelNotFoundError,
  PanelLoadError,
  ProjectNotFoundError,
  ProjectMetadataError,
} from '../services/projectService';
import { sanitizeProjectId } from '../utils/helpers';
import type { FAMItem, UserContext } from '@comfytavern/types';
import { famService } from '../services/FileManagerService'; // 导入 famService
import path from 'node:path'; // 导入 path 用于路径操作

// 辅助函数：从 UserContext 中安全地提取 userId
function getUserIdFromContext(userContext: UserContext | null): string | null {
  return userContext?.currentUser?.uid ?? null;
}

// 定义一个辅助类型，用于路由处理函数的上下文，确保 userContext 被识别
// 这是一个更准确的类型，它扩展了基础上下文并添加了 userContext
interface AuthenticatedContext extends ElysiaBaseContext {
  userContext: UserContext | null;
}

// 辅助函数：安全地处理来自路由的文件路径
function getSafeRelativePath(routePath: string | undefined): string {
  if (!routePath) {
    return '';
  }
  // 1. 解码
  const decodedPath = decodeURIComponent(routePath);
  // 2. 标准化并移除开头的斜杠
  const normalized = path.normalize(decodedPath).replace(/^[/\\]+/, '');
  // 3. 再次检查，防止 '..' 遍历
  if (normalized.includes('..')) {
    throw new Error('Invalid path: directory traversal is not allowed.');
  }
  return normalized;
}

export const panelRoutes = new Elysia({ prefix: '/api/projects/:projectId/panels', name: 'panel-routes' })
  .get('/', async (ctx) => {
    // 使用正确的类型断言方式
    const { params, set, userContext } = ctx as AuthenticatedContext & { params: { projectId: string } };
    const userId = getUserIdFromContext(userContext);
    if (!userId) {
      set.status = 401;
      return { error: 'Unauthorized: User ID could not be determined.' };
    }

    const safeProjectId = sanitizeProjectId(decodeURIComponent(params.projectId));
    if (!safeProjectId) {
      set.status = 400;
      return { error: 'Invalid project ID.' };
    }

    try {
      const panels = await getPanels(userId, safeProjectId);
      return panels;
    } catch (error: any) {
      if (error instanceof ProjectNotFoundError) {
        set.status = 404;
        return { error: error.message };
      }
      if (error instanceof ProjectMetadataError) {
        set.status = 500;
        return { error: `Failed to load project metadata: ${error.message}` };
      }
      console.error(`[GET /panels] Error listing panels for project '${safeProjectId}':`, error);
      set.status = 500;
      return { error: 'An unexpected error occurred while listing panels.' };
    }
  })
  .get('/:panelId', async (ctx) => {
    const { params, set, userContext } = ctx as AuthenticatedContext & { params: { projectId: string; panelId: string } };
    const userId = getUserIdFromContext(userContext);
    if (!userId) {
      set.status = 401;
      return { error: 'Unauthorized: User ID could not be determined.' };
    }

    const safeProjectId = sanitizeProjectId(decodeURIComponent(params.projectId));
    if (!safeProjectId) {
      set.status = 400;
      return { error: 'Invalid project ID.' };
    }
    
    const panelId = params.panelId; // panelId 不需要清理，因为它应该是安全的标识符

    try {
      const panel = await getPanelById(userId, safeProjectId, panelId);
      return panel;
    } catch (error: any) {
      if (error instanceof ProjectNotFoundError || error instanceof PanelNotFoundError) {
        set.status = 404;
        return { error: error.message };
      }
      if (error instanceof ProjectMetadataError || error instanceof PanelLoadError) {
        set.status = 500;
        return { error: `Failed to load panel definition: ${error.message}` };
      }
      console.error(`[GET /panels/:panelId] Error getting panel '${panelId}' for project '${safeProjectId}':`, error);
      set.status = 500;
      return { error: 'An unexpected error occurred while getting the panel.' };
    }
  }, {
    params: t.Object({
        projectId: t.String(),
        panelId: t.String(),
    })
  })
  // --- 面板文件系统 API ---

  // GET /api/projects/:projectId/panels/:panelId/fs/*
  // 用于列出目录或读取文件
  .get('/:panelId/fs/*', async (ctx) => {
    const { params, set, userContext } = ctx as AuthenticatedContext & { params: { projectId: string; panelId: string; '*': string } };
    const userId = getUserIdFromContext(userContext);
    if (!userId) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }
    const { projectId, panelId } = params;
    const safeProjectId = sanitizeProjectId(decodeURIComponent(projectId));
    
    try {
      const relativePath = getSafeRelativePath(params['*']);
      const logicalPath = `user://projects/${safeProjectId}/panel_data/${panelId}/${relativePath}`;

      const stats = await famService.stat(userId, logicalPath);
      
      if (!stats) {
        set.status = 404;
        return { error: 'Path not found' };
      }

      if (stats.itemType === 'directory') {
        const files = await famService.listDir(userId, logicalPath);
        // 转换 FAMItem 为 PanelFile
        const panelFiles = files.map(f => ({
          name: f.name,
          // 从完整的逻辑路径中，计算出相对于面板数据根目录的相对路径
          path: path.relative(`projects/${safeProjectId}/panel_data/${panelId}`, f.logicalPath.substring('user://'.length)).replace(/\\/g, '/'),
          type: f.itemType,
          size: f.size,
          lastModified: f.lastModified
        }));
        return panelFiles;
      } else {
        const fileContent = await famService.readFile(userId, logicalPath, 'binary');
        // 根据请求头决定返回类型，或直接返回 Buffer
        return new Response(fileContent as BodyInit);
      }
    } catch (error: any) {
      console.error(`[Panel FS GET] Error accessing ${params['*']} for panel ${panelId}:`, error);
      set.status = 500;
      return { error: error.message };
    }
  })

  // POST /api/projects/:projectId/panels/:panelId/fs/*
  // 用于写入文件或创建目录
  .post('/:panelId/fs/*', async (ctx) => {
    const { params, body, set, userContext, request } = ctx as AuthenticatedContext & { params: { projectId: string; panelId: string; '*': string } };
    const userId = getUserIdFromContext(userContext);
    if (!userId) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }
    const { projectId, panelId } = params;
    const safeProjectId = sanitizeProjectId(decodeURIComponent(projectId));

    try {
      const relativePath = getSafeRelativePath(params['*']);
      if (!relativePath) {
        set.status = 400;
        return { error: 'File path cannot be empty for writing.' };
      }
      const logicalPath = `user://projects/${safeProjectId}/panel_data/${panelId}/${relativePath}`;

      // 检查请求是创建目录还是写文件
      const contentType = request.headers.get('content-type');
      
      if (contentType === 'application/vnd.comfy.create-directory') {
        await famService.createDir(userId, logicalPath);
        set.status = 201; // Created
        return { success: true, message: 'Directory created' };
      } else {
        const content = await request.arrayBuffer();
        await famService.writeFile(userId, logicalPath, Buffer.from(content));
        set.status = 201; // Created or updated
        return { success: true, message: 'File written successfully' };
      }
    } catch (error: any) {
      console.error(`[Panel FS POST] Error writing to ${params['*']} for panel ${panelId}:`, error);
      set.status = 500;
      return { error: error.message };
    }
  })

  // DELETE /api/projects/:projectId/panels/:panelId/fs/*
  // 用于删除文件或目录
  .delete('/:panelId/fs/*', async (ctx) => {
    const { params, set, userContext, query } = ctx as AuthenticatedContext & { params: { projectId: string; panelId: string; '*': string }, query: { recursive?: string } };
    const userId = getUserIdFromContext(userContext);
    if (!userId) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }
    const { projectId, panelId } = params;
    const safeProjectId = sanitizeProjectId(decodeURIComponent(projectId));
    const recursive = query.recursive === 'true';

    try {
      const relativePath = getSafeRelativePath(params['*']);
      if (!relativePath) {
        set.status = 400;
        return { error: 'File path cannot be empty for deletion.' };
      }
      const logicalPath = `user://projects/${safeProjectId}/panel_data/${panelId}/${relativePath}`;

      await famService.delete(userId, logicalPath, { recursive });
      set.status = 204; // No Content
    } catch (error: any) {
      console.error(`[Panel FS DELETE] Error deleting ${params['*']} for panel ${panelId}:`, error);
      set.status = 500;
      return { error: error.message };
    }
  });