import { Elysia, t } from 'elysia';
import { promises as fs } from 'node:fs';
import path, { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeManager } from '../services/NodeManager';
import { NodeLoader } from '../services/NodeLoader'; // 导入 NodeLoader
import { wsManager } from '../index'; // 导入 wsManager
import { WebSocketMessageType, type NodesReloadedPayload } from '@comfytavern/types'; // 导入 WebSocket 类型
import { CUSTOM_NODE_PATHS } from '../config'; // <--- 咕咕：导入自定义节点路径配置

// 获取当前文件所在目录的上级目录 (即 src 目录)
const __filename = fileURLToPath(import.meta.url);
const __srcDirname = dirname(dirname(__filename)); // routes -> src
const builtInNodesPath = join(__srcDirname, "nodes"); // <--- 咕咕：重命名为 builtInNodesPath 以示区分
const projectRootDir = join(__srcDirname, "..", ".."); // <--- 咕咕：计算项目根目录

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
      // 2.1 加载内置节点
      console.log(`[API] Reloading built-in nodes from: ${builtInNodesPath}`);
      await NodeLoader.loadNodes(builtInNodesPath);

      // 2.2 加载自定义节点
      if (CUSTOM_NODE_PATHS && CUSTOM_NODE_PATHS.length > 0) {
        console.log(`[API] Reloading custom nodes from paths: ${CUSTOM_NODE_PATHS.join(', ')}`);
        for (const customPath of CUSTOM_NODE_PATHS) {
          const absoluteCustomPath = join(projectRootDir, customPath);
          console.log(`[API] Attempting to reload nodes from custom path: ${absoluteCustomPath}`);
          await NodeLoader.loadNodes(absoluteCustomPath);
        }
      } else {
        console.log("[API] No custom node paths configured for reload.");
      }
      console.log('[API] Finished reloading all nodes from disk.');

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

// 路由组：处理客户端脚本，相对于节点定义文件
// 例如: GET /api/nodes/core/RandomNumber/client-script/client-scripts/RandomNumberNode.js
export const clientScriptRoutes = new Elysia({ prefix: '/api/nodes' })
  .get('/:namespace/:type/client-script/*', async ({ params, set }) => {
    const { namespace, type } = params;
    const scriptRelativePath = params['*']; // 这是 clientScriptUrl 的内容，例如 'client-scripts/RandomNumberNode.js'
    const fullType = `${namespace}:${type}`;

    const nodeDef = nodeManager.getNode(fullType);

    if (!nodeDef) {
      set.status = 404;
      return { error: `Node definition for ${fullType} not found.` };
    }

    // clientScriptUrl 在节点定义中是相对于该定义文件的路径
    // 但这里我们直接使用请求中的 scriptRelativePath，它应该与 nodeDef.clientScriptUrl 匹配或由其派生
    // 为了安全和一致性，我们应该使用 nodeDef.clientScriptUrl 中定义的值，
    // 但如果一个节点有多个脚本，则请求路径中的 '*' 部分必须是那个脚本的相对路径。
    // 当前假设请求的 scriptRelativePath 就是我们想要服务的脚本的相对路径。

    if (!nodeDef.filePath) {
      set.status = 500;
      console.error(`Node ${fullType} is missing filePath in its definition.`);
      return { error: `Internal server error: Node definition for ${fullType} is incomplete (missing filePath).` };
    }
    
    // 安全性检查 scriptRelativePath
    const cleanedScriptRelativePath = path.normalize(scriptRelativePath).replace(/\\/g, '/');
    if (!cleanedScriptRelativePath.endsWith('.js') || cleanedScriptRelativePath.includes('..')) {
      set.status = 400;
      return { error: 'Invalid client script path requested.' };
    }

    const scriptAbsolutePath = path.resolve(dirname(nodeDef.filePath), cleanedScriptRelativePath);
    
    // 额外的安全检查：确保脚本路径仍在项目预期的 'nodes' 子目录内
    const projectNodesBaseDir = path.resolve(__srcDirname, 'nodes');
    if (!scriptAbsolutePath.startsWith(projectNodesBaseDir)) {
        set.status = 403;
        console.warn(`Forbidden attempt to access script outside nodes directory: ${scriptAbsolutePath} (requested for ${fullType})`);
        return { error: 'Access to the requested script path is forbidden.' };
    }

    try {
      await fs.access(scriptAbsolutePath);
      const scriptContent = await fs.readFile(scriptAbsolutePath, 'utf-8');
      set.headers['Content-Type'] = 'application/javascript; charset=utf-8';
      return scriptContent;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        set.status = 404;
        console.warn(`Client script not found at calculated path: ${scriptAbsolutePath} (requested for ${fullType} with relative path ${cleanedScriptRelativePath})`);
        return { error: `Client script for node ${fullType} not found at relative path ${cleanedScriptRelativePath}.` };
      }
      console.error(`Error serving client script for ${fullType} from ${scriptAbsolutePath}:`, error);
      set.status = 500;
      return { error: 'Failed to serve client script.' };
    }
  }, {
    params: t.Object({
      namespace: t.String(),
      type: t.String(),
      '*': t.String(), // 匹配 clientScriptUrl 的内容
    })
  });