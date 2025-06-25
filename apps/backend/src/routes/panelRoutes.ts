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
import type { UserContext } from '@comfytavern/types';

// 辅助函数：从 UserContext 中安全地提取 userId
function getUserIdFromContext(userContext: UserContext | null): string | null {
  return userContext?.currentUser?.uid ?? null;
}

// 定义一个辅助类型，用于路由处理函数的上下文，确保 userContext 被识别
// 这是一个更准确的类型，它扩展了基础上下文并添加了 userContext
interface AuthenticatedContext extends ElysiaBaseContext {
  userContext: UserContext | null;
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
  });