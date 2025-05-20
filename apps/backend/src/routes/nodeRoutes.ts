import { Elysia, t } from 'elysia';
import { promises as fs } from 'node:fs';
import path, { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeManager } from '../nodes/NodeManager';
import { NodeLoader } from '../nodes/NodeLoader'; // 导入 NodeLoader
import { wsManager } from '../index'; // 导入 wsManager
import { WebSocketMessageType, type NodesReloadedPayload } from '@comfytavern/types'; // 导入 WebSocket 类型

// 获取当前文件所在目录的上级目录 (即 src 目录)
const __filename = fileURLToPath(import.meta.url);
const __srcDirname = dirname(dirname(__filename)); // routes -> src
const nodesPath = join(__srcDirname, "nodes"); // 计算 nodes 目录路径

// 路由组：处理 /api/nodes
export const nodeApiRoutes = new Elysia({ prefix: '/api' })
  // GET /api/nodes - 获取所有可用节点定义
  .get('/nodes', () => nodeManager.getDefinitions())
  // POST /api/nodes/reload - 重载所有节点定义
  .post('/nodes/reload', async ({ set }) => {
    console.log('[API] Received request to reload nodes...');
    try {
      // 1. 清空现有节点
      nodeManager.clearNodes();
      console.log('[API] Cleared existing nodes.');

      // 2. 重新加载节点
      await NodeLoader.loadNodes(nodesPath);
      console.log('[API] Finished reloading nodes from disk.');

      const reloadedNodeCount = nodeManager.getDefinitions().length;
      console.log(`[API] ${reloadedNodeCount} nodes reloaded.`);

      // 3. 通过 WebSocket 通知所有客户端
      const payload: NodesReloadedPayload = {
        success: true,
        message: `Successfully reloaded ${reloadedNodeCount} nodes.`,
        count: reloadedNodeCount,
      };
      console.log('[API] Preparing to broadcast NODES_RELOADED. Payload:', payload, 'Number of clients in wsManager:', wsManager.getAllClientIds().length); // 新增日志
      wsManager.broadcast(WebSocketMessageType.NODES_RELOADED, payload);
      console.log('[API] Broadcasted NODES_RELOADED notification to clients.');

      set.status = 200;
      return {
        success: true,
        message: `Successfully reloaded ${reloadedNodeCount} nodes.`,
        count: reloadedNodeCount,
      };
    } catch (error) {
      console.error('[API] Error reloading nodes:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during node reload';
      
      // 尝试通知客户端错误
      try {
        const errorPayload: NodesReloadedPayload = {
          success: false,
          message: `Failed to reload nodes: ${errorMessage}`,
        };
        wsManager.broadcast(WebSocketMessageType.NODES_RELOADED, errorPayload);
      } catch (wsError) {
        console.error('[API] Failed to broadcast NODES_RELOADED error notification:', wsError);
      }

      set.status = 500;
      return { success: false, message: 'Failed to reload nodes.', error: errorMessage };
    }
  });

// 路由组：处理 /client-scripts/*
export const clientScriptRoutes = new Elysia()
  // GET /client-scripts/* - 提供客户端节点脚本 (支持嵌套路径)
  .get('/client-scripts/*', async ({ params, set }) => {
    const relativeScriptPath = params['*']; // 获取通配符匹配的路径

    // 安全性检查
    const cleanedRelativePath = path.normalize(relativeScriptPath).replace(/\\/g, '/');
    if (!cleanedRelativePath.endsWith('.js') || cleanedRelativePath.includes('..')) {
      set.status = 400;
      return { error: 'Invalid script path requested.' };
    }

    // 提取目录和文件名
    const scriptFilename = basename(cleanedRelativePath);
    const nodeRelativeDir = dirname(cleanedRelativePath); // 可能为 '.'

    // 构建实际文件路径 (相对于 src 目录)
    const filePath = path.join(__srcDirname, 'nodes', nodeRelativeDir, 'client-scripts', scriptFilename);

    try {
      // 检查文件是否存在
      await fs.access(filePath);

      // 读取文件内容
      const scriptContent = await fs.readFile(filePath, 'utf-8');

      // 设置正确的 Content-Type 并返回脚本
      set.headers['Content-Type'] = 'application/javascript; charset=utf-8';
      return scriptContent;

    } catch (error: any) {
      if (error.code === 'ENOENT') {
        set.status = 404;
        console.warn(`Client script not found: ${filePath}`);
        return { error: `Client script '${cleanedRelativePath}' not found.` };
      }
      console.error(`Error serving client script ${cleanedRelativePath}:`, error);
      set.status = 500;
      return { error: 'Failed to serve client script.' };
    }
  }, {
    // 验证通配符参数
    params: t.Object({ '*': t.String() })
  });