import { Elysia, t } from 'elysia';
import { promises as fs } from 'node:fs';
import path, { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeManager } from '../nodes/NodeManager'; // 调整路径到 NodeManager

// 获取当前文件所在目录的上级目录 (即 src 目录)
const __filename = fileURLToPath(import.meta.url);
const __srcDirname = dirname(dirname(__filename)); // routes -> src

// 路由组：处理 /api/nodes
export const nodeApiRoutes = new Elysia({ prefix: '/api' })
  // GET /api/nodes - 获取所有可用节点定义
  .get('/nodes', () => nodeManager.getDefinitions());

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