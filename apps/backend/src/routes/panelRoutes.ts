import { Elysia, t, type Context as ElysiaBaseContext } from 'elysia';
import {
  getPanels,
  getPanelById,
  getPanelTemplates,
  createPanel,
  PanelNotFoundError,
  PanelLoadError,
  ProjectNotFoundError,
  ProjectMetadataError,
  PanelConflictError,
} from '../services/projectService';
import { sanitizeProjectId } from '../utils/helpers';
import type { UserContext } from '@comfytavern/types';
import { famService } from '../services/FileManagerService';
import path from 'node:path';

function getUserIdFromContext(userContext: UserContext | null): string | null {
  return userContext?.currentUser?.uid ?? null;
}

interface AuthenticatedContext extends ElysiaBaseContext {
  userContext: UserContext | null;
}

function getSafeRelativePath(routePath: string | undefined): string {
  if (!routePath) {
    return '';
  }
  const decodedPath = decodeURIComponent(routePath);
  const normalized = path.normalize(decodedPath).replace(/^[/\\]+/, '');
  if (normalized.includes('..')) {
    throw new Error('Invalid path: directory traversal is not allowed.');
  }
  return normalized;
}

const app = new Elysia({ prefix: '/api', name: 'panel-routes' });

// 获取所有可用的面板模板
app.get('/panels/templates', async ({ set }) => {
  try {
    const templates = await getPanelTemplates();
    return templates;
  } catch (error: any) {
    console.error(`[GET /panels/templates] Error fetching panel templates:`, error);
    set.status = 500;
    return { error: 'An unexpected error occurred while fetching panel templates.' };
  }
});

// 获取项目下的所有面板
app.get('/projects/:projectId/panels', async (ctx) => {
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
});

// 获取特定面板
app.get('/projects/:projectId/panels/:panelId', async (ctx) => {
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
  const panelId = params.panelId;
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

// 创建新面板（从模板或全新）
app.post('/projects/:projectId/panels', async (ctx) => {
  const { params, body, set, userContext } = ctx as AuthenticatedContext & {
    params: { projectId: string },
    body: { templateId?: string | null, panelId: string, displayName: string }
  };
  const userId = getUserIdFromContext(userContext);
  if (!userId) {
    set.status = 401;
    return { error: 'Unauthorized' };
  }
  const safeProjectId = sanitizeProjectId(decodeURIComponent(params.projectId));
  if (!safeProjectId) {
      set.status = 400;
      return { error: 'Invalid project ID.' };
  }
  const { templateId, panelId, displayName } = body;
  if (!panelId || !displayName) {
    set.status = 400;
    return { error: 'panelId and displayName are required.' };
  }
  try {
    const newPanel = await createPanel(userId, safeProjectId, { templateId, panelId, displayName });
    set.status = 201;
    return newPanel;
  } catch (error: any) {
    console.error(`[POST /panels] Error creating panel '${panelId}' for project '${safeProjectId}':`, error);
    if (error.name === 'ProjectNotFoundError' || error.name === 'PanelNotFoundError') {
      set.status = 404;
    } else if (error.name === 'PanelConflictError') {
      set.status = 409;
    } else {
      set.status = 500;
    }
    return { error: error.message };
  }
}, {
  body: t.Object({
    templateId: t.Optional(t.Union([t.String(), t.Null()])),
    panelId: t.String(),
    displayName: t.String(),
  })
});

// --- 面板文件系统 API ---
app.get('/projects/:projectId/panels/:panelId/fs/*', async (ctx) => {
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
      const panelFiles = files.map(f => ({
        name: f.name,
        path: path.relative(`projects/${safeProjectId}/panel_data/${panelId}`, f.logicalPath.substring('user://'.length)).replace(/\\/g, '/'),
        type: f.itemType,
        size: f.size,
        lastModified: f.lastModified
      }));
      return panelFiles;
    } else {
      const fileContent = await famService.readFile(userId, logicalPath, 'binary');
      return new Response(fileContent as BodyInit);
    }
  } catch (error: any) {
    console.error(`[Panel FS GET] Error accessing ${params['*']} for panel ${panelId}:`, error);
    set.status = 500;
    return { error: error.message };
  }
});

app.post('/projects/:projectId/panels/:panelId/fs/*', async (ctx) => {
  const { params, set, userContext, request } = ctx as AuthenticatedContext & { params: { projectId: string; panelId: string; '*': string } };
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
    const contentType = request.headers.get('content-type');
    if (contentType === 'application/vnd.comfy.create-directory') {
      await famService.createDir(userId, logicalPath);
      set.status = 201;
      return { success: true, message: 'Directory created' };
    } else {
      const content = await request.arrayBuffer();
      await famService.writeFile(userId, logicalPath, Buffer.from(content));
      set.status = 201;
      return { success: true, message: 'File written successfully' };
    }
  } catch (error: any) {
    console.error(`[Panel FS POST] Error writing to ${params['*']} for panel ${panelId}:`, error);
    set.status = 500;
    return { error: error.message };
  }
});

app.delete('/projects/:projectId/panels/:panelId/fs/*', async (ctx) => {
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
    set.status = 204;
  } catch (error: any) {
    console.error(`[Panel FS DELETE] Error deleting ${params['*']} for panel ${panelId}:`, error);
    set.status = 500;
    return { error: error.message };
  }
});

export const panelRoutes = app;