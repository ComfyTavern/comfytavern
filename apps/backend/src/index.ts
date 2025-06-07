import { Elysia } from 'elysia'; // 移除未使用的 t
import { promises as fs } from 'node:fs';
import path, { dirname, join } from 'node:path'; // 移除未使用的 basename, extname
import { fileURLToPath } from 'node:url';

import { cors } from '@elysiajs/cors';

import { CUSTOM_NODE_PATHS, FRONTEND_URL, PORT, WORKFLOWS_DIR } from './config'; // 导入 CUSTOM_NODE_PATHS
import { characterApiRoutes } from './routes/characterRoutes'; // 导入角色卡路由
import { executionApiRoutes } from './routes/executionRoutes';
import { clientScriptRoutes, nodeApiRoutes } from './routes/nodeRoutes';
import { addProjectRoutes } from './routes/projectRoutes';
import { globalWorkflowRoutes } from './routes/workflowRoutes';
import { ConcurrencyScheduler } from './services/ConcurrencyScheduler';
import { NodeLoader } from './services/NodeLoader';
import { createWebsocketHandler, websocketSchema } from './websocket/handler';
import { WebSocketManager } from './websocket/WebSocketManager';

// 加载节点
// 获取当前文件的目录 (ES Module)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename); // This will be apps/backend/src when running src/index.ts

// 保留一些日志以供确认，但可以简化
console.log(`[ComfyTavern Backend] NODE_ENV (for informational purposes): ${process.env.NODE_ENV}`);
console.log(`[ComfyTavern Backend] Running from __dirname: ${__dirname}`);

// 1. 加载内置节点
const builtInNodesPath = join(__dirname, "nodes");
console.log(`[ComfyTavern Backend] Loading built-in nodes from: ${builtInNodesPath}`);
await NodeLoader.loadNodes(builtInNodesPath);

// 2. 加载自定义节点路径 (从 config.json 读取)
if (CUSTOM_NODE_PATHS && CUSTOM_NODE_PATHS.length > 0) {
  console.log(`[ComfyTavern Backend] Loading custom nodes from paths specified in config.json: ${CUSTOM_NODE_PATHS.join(', ')}`);
  const projectRootDir = join(__dirname, "..", "..", ".."); // 项目根目录 (从 apps/backend/src 返回到 comfytavern)
  for (const customPath of CUSTOM_NODE_PATHS) {
    // NodeLoader.loadNodes 期望的路径是相对于项目根目录的字符串，
    // 或者可以由 path.resolve 正确解析的路径。
    // CUSTOM_NODE_PATHS 中的路径 (如 "plugins/nodes") 已经是相对于项目根目录的。
    // 此处将其解析为绝对路径
    const absoluteCustomPath = join(projectRootDir, customPath);
    console.log(`[ComfyTavern Backend] Attempting to load nodes from custom path: ${absoluteCustomPath}`);
    await NodeLoader.loadNodes(absoluteCustomPath);
  }
} else {
  console.log("[ComfyTavern Backend] No custom node paths configured in config.json.");
}
// 工作流和项目目录从 config.ts 导入
// const workflowsDir = WORKFLOWS_DIR; // 使用导入的常量
// const projectsBaseDir = PROJECTS_BASE_DIR; // 使用导入的常量

// Helper function getProjectWorkflowsDir 已移至 services/projectService.ts
// 确保工作流目录存在
try {
  await fs.access(WORKFLOWS_DIR); // 使用导入的常量
  console.log(`Workflow directory found: ${WORKFLOWS_DIR}`);
} catch (error) {
  console.log(`Workflow directory not found, creating: ${WORKFLOWS_DIR}`);
  await fs.mkdir(WORKFLOWS_DIR, { recursive: true });
}

// 读取根目录的 package.json 获取应用版本
let appVersion = "unknown";
try {
  // package.json 在项目根目录，即 workflowsDir 的上两级目录
  const packageJsonPath = path.resolve(WORKFLOWS_DIR, "../../package.json"); // 使用导入的常量
  const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
  const packageJson = JSON.parse(packageJsonContent);
  appVersion = packageJson.version || "unknown";
  console.log(`Application version loaded: ${appVersion}`);
} catch (error) {
  console.error("Failed to read application version from package.json:", error);
}

// 移除旧的 Elysia t 定义的 Schema
// const WorkflowDataSchema = t.Object({ ... })
// const WorkflowUpdateSchema = t.Intersect([ ... ])
// Zod schemas 从 @comfytavern/types 导入

// 函数 syncReferencingNodeGroups 已移至 services/projectService.ts
const app = new Elysia()
  .use(
    cors({
      origin: process.argv.includes("dev") ? "*" : FRONTEND_URL,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // 添加 PUT 和 DELETE 方法支持
      allowedHeaders: ["Content-Type"],
      credentials: true,
      preflight: true, // 启用预检请求支持
    })
  )
  .use(nodeApiRoutes) // 挂载节点 API 路由
  .use(clientScriptRoutes) // 挂载客户端脚本路由
  .use(globalWorkflowRoutes) // 挂载全局工作流路由
  .use(executionApiRoutes) // 新增: 挂载执行 API 路由
  .use(characterApiRoutes) // 挂载角色卡 API 路由

  // --- 项目 API 路由已移至 projectRoutes.ts ---

  // --- 结束 项目 API ---
  // --- 结束 API 路由定义 ---

  // 新增：重启服务器的 API 端点
  .post("/api/server/restart", async ({ set }) => {
    console.log("Received request to restart server...");
    try {
      // 尝试通过修改 index.ts 的时间戳来触发 bun run --watch 重启
      const indexFilePath = join(__dirname, "index.ts");
      const now = new Date();
      // Bun/Node 在 Windows 上可能需要 fs.promises
      const fs = await import("node:fs/promises");
      await fs.utimes(indexFilePath, now, now);
      console.log("Touched index.ts to trigger restart.");

      // 立刻返回响应，告知前端正在重启
      // 注意：实际的重启由 bun run --watch 完成，这个请求处理完后进程会退出
      set.status = 202; // 已接受
      return { success: true, message: "Server is restarting..." };
    } catch (error) {
      console.error("Failed to trigger server restart:", error);
      set.status = 500;
      return { success: false, message: "Failed to trigger restart." };
    }
  });

// --- WebSocket 路由已移至 websocket/handler.ts ---

// --- 挂载项目路由 ---
// 注意：这需要在 app 实例创建之后，并且在 .listen() 之前
addProjectRoutes(app, {
  appVersion,
  // projectsBaseDir is now imported directly in projectRoutes.ts
  // getProjectWorkflowsDir is now imported directly in projectRoutes.ts
  // syncReferencingNodeGroups is now imported directly in projectRoutes.ts
});

// --- 实例化管理器 ---
// WebSocketManager 需要 HTTP 服务器，在 listen 回调中附加
const wsManager = new WebSocketManager(); // 初始时不传入 server
export const scheduler = new ConcurrencyScheduler(wsManager); // 将 wsManager 注入 scheduler 并导出
export { wsManager }; // 导出 wsManager 实例

// --- 挂载 WebSocket 路由 ---
// 使用工厂函数创建 handler，并注入依赖
const handler = createWebsocketHandler(scheduler, wsManager);
app.ws("/ws", {
  ...websocketSchema, // 应用导入的 Schema
  ...handler, // 应用创建的 handler 对象
});

// --- 启动服务器 ---
app.listen(PORT, (server) => {
  // 使用 listen 回调获取 server 实例
  if (server) {
    // 移除对 attachServer 的调用，因为 Elysia 通过 app.ws 处理 WebSocket
    // wsManager.attachServer(server); // <--- 移除此行
    console.log(`\n\x1b[93m🦊[ComfyTavern Backend] Elysia is running at http://${server.hostname}:${server.port}\x1b[0m`);
    console.log(`\n\x1b[96m🦊[ComfyTavern 后端] 服务器已于端口 ${PORT} 启动，访问地址为 http://localhost:${PORT}\x1b[0m\n`);
  } else {
    console.error("Failed to start server.");
    process.exit(1); // 启动失败则退出
  }
});

// 移除旧的 console.log
