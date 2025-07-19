// apps/backend/src/routes/pluginRoutes.ts
import { Elysia } from 'elysia';
import { PluginLoader } from '../services/PluginLoader';

export const pluginRoutes = new Elysia({ prefix: '/api/plugins' })
  .get('/', () => {
    // 直接返回已加载并格式化好的插件信息
    return PluginLoader.extensions;
  })
  .post('/reload', async ({ set }) => {
    console.log('[API] Received request to reload plugins...');
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
  });