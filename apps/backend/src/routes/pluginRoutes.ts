// apps/backend/src/routes/pluginRoutes.ts
import { Elysia, t } from 'elysia';
import { PluginLoader } from '../services/PluginLoader';
import { pluginConfigService } from '../services/PluginConfigService';
import type { AuthContext } from '../middleware/authMiddleware';
import type { Context as ElysiaContext } from 'elysia';

// 定义路由处理函数期望的完整上下文类型
type PluginRouteContext = ElysiaContext & AuthContext & {
  store: any;
};

export const pluginRoutes = new Elysia({ prefix: '/api/plugins' })
  .get('/', async () => {
    // 返回所有已发现的插件（包括已禁用的）
    return await PluginLoader.discoverAllPlugins();
  })
  .put('/:pluginName/state', async (context) => {
    const { params, body, set, userContext } = context as PluginRouteContext & {
      params: { pluginName: string },
      body: { enabled: boolean }
    };
    const { pluginName } = params;
    const { enabled } = body;
    
    // 权限检查：只有管理员可以修改插件状态
    if (!userContext?.currentUser?.isAdmin) {
      set.status = 403;
      return {
        success: false,
        message: '只有管理员可以修改插件状态'
      };
    }

    try {
      // 1. 更新持久化配置
      await pluginConfigService.setPluginState(pluginName, enabled);

      // 2. 触发实时加载/卸载
      if (enabled) {
        const loadedPlugin = await PluginLoader.enablePlugin(pluginName);
        if (!loadedPlugin) {
          throw new Error(`Failed to dynamically enable plugin: ${pluginName}`);
        }
      } else {
        const success = await PluginLoader.disablePlugin(pluginName);
        if (!success) {
          throw new Error(`Failed to dynamically disable plugin: ${pluginName}`);
        }
      }

      // 3. 返回成功响应
      return {
        success: true,
        message: `插件 "${pluginName}" 已成功 ${enabled ? '启用' : '禁用'}.`
      };
    } catch (error) {
      console.error(`[API] Error setting plugin state for ${pluginName}:`, error);
      set.status = 500;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `修改插件状态失败: ${errorMessage}`
      };
    }
  }, {
    params: t.Object({
      pluginName: t.String()
    }),
    body: t.Object({
      enabled: t.Boolean()
    }),
    detail: {
      summary: '设置插件的启用状态',
      tags: ['Plugins'],
    }
  })
  .post('/reload', async (context) => {
    const { set, userContext } = context as PluginRouteContext;
    console.log('[API] Received request to reload plugins...');
    
    // 权限检查：只有管理员可以重载插件
    if (!userContext?.currentUser?.isAdmin) {
      set.status = 403;
      return {
        success: false,
        message: '只有管理员可以重载插件'
      };
    }
    
    try {
      const result = await PluginLoader.reloadPlugins();
      
      // 重新加载后，需要通知客户端节点列表已更新
      // 可以在这里添加 WebSocket 通知逻辑，或者依赖 PluginLoader 内部实现
      
      set.status = 200;
      return result;
    } catch (error) {
      console.error('[API] Error reloading plugins:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during plugin reload';
      set.status = 500;
      return { success: false, message: 'Failed to reload plugins.', error: errorMessage };
    }
  }, {
    detail: {
      summary: '重新加载所有插件',
      tags: ['Plugins'],
    }
  })
  .get('/:pluginName/settings', async (context) => {
    const { params, userContext, set } = context as PluginRouteContext & {
      params: { pluginName: string }
    };
    const { pluginName } = params;
    const userId = userContext?.currentUser?.uid ?? null;

    try {
      const settings = await pluginConfigService.getPluginSettings(pluginName, userId);
      return settings;
    } catch (error) {
      console.error(`[API] Error getting settings for plugin ${pluginName}:`, error);
      set.status = 500;
      return { error: 'Failed to retrieve plugin settings.' };
    }
  }, {
    params: t.Object({
      pluginName: t.String()
    }),
    detail: {
      summary: '获取指定插件的合并后配置',
      tags: ['Plugins'],
    }
  })
  .post('/:pluginName/settings', async (context) => {
    const { params, body, userContext, set } = context as PluginRouteContext & {
      params: { pluginName: string },
      body: Record<string, any>
    };
    const { pluginName } = params;
    const userId = userContext?.currentUser?.uid;

    if (!userId) {
      set.status = 401;
      return { error: 'User not authenticated.' };
    }

    try {
      await pluginConfigService.savePluginSettings(pluginName, userId, body);
      return { success: true, message: 'Settings saved successfully.' };
    } catch (error) {
      console.error(`[API] Error saving settings for plugin ${pluginName}:`, error);
      set.status = 500;
      return { error: 'Failed to save plugin settings.' };
    }
  }, {
    params: t.Object({
      pluginName: t.String()
    }),
    body: t.Object({}, { additionalProperties: true }),
    detail: {
      summary: '保存当前用户的插件配置',
      tags: ['Plugins'],
    }
  });