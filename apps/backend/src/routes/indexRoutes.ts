import { Elysia } from 'elysia';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import si from 'systeminformation';
import { formatBytes, formatUptime } from '../utils/formatters';
import { randomBytes } from 'crypto';
import {
  BACKEND_PANEL_AUTH_ENABLED,
  BACKEND_PANEL_USERNAME,
  BACKEND_PANEL_PASSWORD
} from '../config';

// 缓存 HTML 内容
let cachedIndexHtml: string | null = null;

// Session token 存储（内存存储，重启后失效）
const activeSessions = new Map<string, { createdAt: number }>();
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 小时

// 生成 session token
function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

// 验证 session token
function verifySessionToken(token: string): boolean {
  const session = activeSessions.get(token);
  if (!session) return false;
  
  // 检查是否过期
  if (Date.now() - session.createdAt > SESSION_TIMEOUT) {
    activeSessions.delete(token);
    return false;
  }
  
  return true;
}

// 清理过期的 session
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (now - session.createdAt > SESSION_TIMEOUT) {
      activeSessions.delete(token);
    }
  }
}, 60 * 60 * 1000); // 每小时清理一次

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
  
  // 检查是否需要认证
  .get("/api/status/auth-required", async () => {
    return { authRequired: BACKEND_PANEL_AUTH_ENABLED };
  })
  
  // 登录端点
  .post("/api/status/login", async ({ body, set }) => {
    if (!BACKEND_PANEL_AUTH_ENABLED) {
      set.status = 400;
      return { success: false, message: '认证未启用' };
    }

    const { username, password } = body as { username?: string; password?: string };

    if (!username || !password) {
      set.status = 400;
      return { success: false, message: '用户名和密码不能为空' };
    }

    // 验证用户名和密码
    if (username === BACKEND_PANEL_USERNAME && password === BACKEND_PANEL_PASSWORD) {
      const token = generateSessionToken();
      activeSessions.set(token, { createdAt: Date.now() });
      return { success: true, token, username };
    } else {
      set.status = 401;
      return { success: false, message: '用户名或密码错误' };
    }
  })
  
  // API 路由，提供状态数据
  .get("/api/status", async ({ headers, set }) => {
    // 如果启用了认证，检查 token
    if (BACKEND_PANEL_AUTH_ENABLED) {
      const authHeader = headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        set.status = 401;
        return { error: '未提供认证信息' };
      }

      const token = authHeader.substring(7); // 移除 'Bearer ' 前缀
      if (!verifySessionToken(token)) {
        set.status = 401;
        return { error: '认证失败或已过期' };
      }
    }
    
    // 返回状态数据
    const memoryUsage = process.memoryUsage();
    const cpus = os.cpus();
    const totalmem = os.totalmem();
    const freemem = os.freemem();
    
    // 并行获取所有异步数据
    const [currentLoad, fsSize, osInfo, networkInterfaces] = await Promise.all([
      si.currentLoad(),
      si.fsSize(),
      si.osInfo(),
      si.networkInterfaces(),
    ]);

    return {
      version: options.appVersion,
      uptime: formatUptime(process.uptime()),
      os: {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        kernel: osInfo.kernel,
        arch: osInfo.arch,
      },
      cpu: {
        model: cpus[0].model,
        cores: cpus.length,
        load: currentLoad.currentLoad.toFixed(2) + '%',
      },
      memory: {
        total: formatBytes(totalmem),
        free: formatBytes(freemem),
        processUsage: formatBytes(memoryUsage.rss), // Resident Set Size
      },
      disks: fsSize.map(d => ({
        fs: d.fs,
        size: formatBytes(d.size),
        used: formatBytes(d.used),
        use: d.use.toFixed(2) + '%',
        mount: d.mount,
      })),
      network: networkInterfaces
        .filter(iface => iface.ip4)
        .map(iface => ({
          iface: iface.iface,
          ip4: iface.ip4,
          mac: iface.mac,
          speed: iface.speed ? `${iface.speed} Mbps` : 'N/A',
        })),
      timestamp: new Date().toISOString(),
    };
  });