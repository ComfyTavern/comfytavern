import { existsSync, readFileSync } from 'fs';
import path from 'path';

// --- 配置 ---
const CWD = process.cwd(); // 应该是项目根目录
const FRONTEND_DIST_PATH = path.resolve(CWD, 'apps/frontend-vueflow/dist');
const CONFIG_PATH = path.resolve(CWD, 'config.json');

// --- 从配置中读取端口 ---
let frontendPort = 5573; // 默认端口
try {
  if (existsSync(CONFIG_PATH)) {
    const configFile = readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(configFile);
    frontendPort = config.server.frontend.port || 5573;
    console.log(`[FrontendServer] 成功从 config.json 读取端口: ${frontendPort}`);
  } else {
    console.log(`[FrontendServer] 警告: 在 ${CONFIG_PATH} 未找到 config.json。使用默认端口 ${frontendPort}。`);
  }
} catch (error: any) {
  console.error(`[FrontendServer] 读取或解析 config.json 时出错: ${error.message}。使用默认端口 ${frontendPort}。`);
}

// --- 检查 dist 目录是否存在 ---
if (!existsSync(FRONTEND_DIST_PATH)) {    
    console.error(`\n[FrontendServer] 错误: 在 ${FRONTEND_DIST_PATH} 未找到前端构建目录`);
    console.error('[FrontendServer] 请先运行 "bun run build:frontend" 来构建应用。\n');
    process.exit(1);
}

// --- 启动 Bun 服务器 ---
console.log(`[FrontendServer] 开始为位于 ${FRONTEND_DIST_PATH} 的静态文件启动服务器`);

const server = Bun.serve({
  port: frontendPort,
  async fetch(req) {
    const url = new URL(req.url);
    let filePath = path.join(FRONTEND_DIST_PATH, url.pathname);

    // 如果路径是目录，则提供 index.html
    if (existsSync(filePath) && path.extname(filePath) === '') {
      filePath = path.join(filePath, 'index.html');
    }

    const file = Bun.file(filePath);

    if (await file.exists()) {
      // 提供静态文件
      return new Response(file);
    }
    
    // SPA 回退：如果文件未找到，则提供 index.html
    const indexFile = Bun.file(path.join(FRONTEND_DIST_PATH, 'index.html'));
    if (await indexFile.exists()) {
        return new Response(indexFile);
    }

    // 如果 index.html 也未找到
    return new Response("Not Found", { status: 404 });
  },
  error() {
    return new Response("Internal Server Error", { status: 500 });
  },
});

// --- 根据参数决定是否显示用户友好的启动日志 ---
const showLog = !process.argv.includes('--silent');

if (showLog) {
  console.log('\n  ✨ ComfyTavern 构建部署模式 ✨');
  console.log(`  前端服务器已就绪，请访问 http://localhost:${server.port}/ 进行体验！`);
  console.log('  如果遇到问题，请复制这个控制台信息并提交到社区。\n');
}

console.log(`[FrontendServer] 正在监听 http://${server.hostname}:${server.port}`);