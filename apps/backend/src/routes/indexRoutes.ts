import { Elysia } from 'elysia';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { formatBytes, formatUptime } from '../utils/formatters';

// 缓存 HTML 内容
let cachedIndexHtml: string | null = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 注意：我们的 routes 文件在 src/routes/ 下，而 views 在 src/views/ 下
// 所以需要回退一级目录
const htmlFilePath = path.join(__dirname, '../views/index.html');

const getIndexHtml = async (): Promise<string> => {
  if (process.env.NODE_ENV !== 'development' && cachedIndexHtml) {
    return cachedIndexHtml;
  }

  try {
    const html = await fs.readFile(htmlFilePath, 'utf-8');
    cachedIndexHtml = html;
    return html;
  } catch (error) {
    console.error('Failed to read index.html:', error);
    return '<h1>Welcome to ComfyTavern Backend</h1><p>Error: Could not load navigation page.</p>';
  }
};

export const indexRoutes = (options: { appVersion: string }) => new Elysia({ name: 'index-routes' })
  // 根路径，提供状态页面
  .get("/", async ({ set }) => {
    set.headers['Content-Type'] = 'text/html; charset=utf-8';
    return await getIndexHtml();
  })
  // API 路由，提供状态数据
  .get("/api/status", () => {
    const memoryUsage = process.memoryUsage();
    const cpus = os.cpus();
    const totalmem = os.totalmem();
    const freemem = os.freemem();

    return {
      version: options.appVersion,
      uptime: formatUptime(process.uptime()),
      platform: os.platform(),
      arch: os.arch(),
      cpu: {
        model: cpus[0].model,
        cores: cpus.length,
        load: os.loadavg().map(l => l.toFixed(2)).join(', '),
      },
      memory: {
        total: formatBytes(totalmem),
        free: formatBytes(freemem),
        processUsage: formatBytes(memoryUsage.rss), // Resident Set Size
      },
      timestamp: new Date().toISOString(),
    };
  });