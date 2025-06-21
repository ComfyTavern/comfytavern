import { Elysia } from 'elysia'; // 移除未使用的 t
import { promises as fs } from 'node:fs';
import path, { dirname, join } from 'node:path'; // 移除未使用的 basename, extname
import { fileURLToPath } from 'node:url';
import { staticPlugin } from '@elysiajs/static';

import { cors } from '@elysiajs/cors';
// ensureDirExists, getLogDir, getUserDataRoot, getDataDir will be replaced by famService for directory creation
// getPublicDir is still needed for staticPlugin
// getProjectRootDir is needed for package.json path
import { getPublicDir, getProjectRootDir } from './utils/fileUtils';
import { famService } from './services/FileManagerService'; // + Import famService

// 从 config.ts 导入的 WORKFLOWS_DIR, PROJECTS_BASE_DIR 等已经是绝对路径了
import {
  CUSTOM_NODE_PATHS,
  FRONTEND_URL,
  PORT,
  // WORKFLOWS_DIR, // 移除导入
  // PROJECTS_BASE_DIR, // 移除导入
  LOG_DIR as APP_LOG_DIR, // 从 config.ts 导入，可能已被覆盖
  MULTI_USER_MODE,
  ACCESS_PASSWORD_HASH,
  CORS_ALLOWED_ORIGINS, // + 导入 CORS 白名单
} from './config';
import { characterApiRoutes } from './routes/characterRoutes';
import { executionApiRoutes } from './routes/executionRoutes';
import { clientScriptRoutes, nodeApiRoutes } from './routes/nodeRoutes';
import { projectRoutesPlugin } from './routes/projectRoutes'; // 修改导入名称
import { DatabaseService } from './services/DatabaseService';
import { applyAuthMiddleware } from './middleware/authMiddleware'; // Changed to import the function
import { authRoutes } from './routes/authRoutes';
import { userKeysRoutes } from './routes/userKeysRoutes'; // 导入 userKeysRoutes
import { userProfileRoutes } from './routes/userProfileRoutes'; // + 导入 userProfileRoutes
import { fileManagerRoutes } from './routes/fileManagerRoutes'; // ++ 导入文件管理路由
import { globalWorkflowRoutes } from './routes/workflowRoutes';
import { llmConfigRoutes } from './routes/llmConfigRoutes'; // + 导入 LLM 配置路由
import { ApiConfigService } from './services/ApiConfigService'; // +
import { ActivatedModelService } from './services/ActivatedModelService'; // +
import { LlmApiAdapterRegistry } from './services/LlmApiAdapterRegistry'; // +
import { ConcurrencyScheduler } from './services/ConcurrencyScheduler';
import { NodeLoader } from './services/NodeLoader';
import { nodeManager } from './services/NodeManager'; // + 导入 NodeManager
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

// 在所有节点加载完成后，统一打印注册节点列表
const definitions = nodeManager.getDefinitions();
const groupedNodes: Record<string, string[]> = {};
for (const node of definitions) {
  const namespace = node.namespace || '_unknown'; // 如果 namespace 未定义，则使用 _core
  if (!groupedNodes[namespace]) {
    groupedNodes[namespace] = [];
  }
  groupedNodes[namespace].push(node.type);
}
console.log(
  '[ComfyTavern Backend] All nodes loaded. Registered nodes (grouped by namespace):',
  groupedNodes
);


// 读取根目录的 package.json 获取应用版本
let appVersion = "unknown";
try {
  // package.json 在项目根目录
  const packageJsonPath = path.join(getProjectRootDir(), "package.json"); // 使用 getProjectRootDir
  const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
  const packageJson = JSON.parse(packageJsonContent);
  appVersion = packageJson.version || "unknown";
  console.log(`Application version loaded: ${appVersion}`);
} catch (error) {
  console.error("Failed to read application version from package.json:", error);
}

// --- 确定用户操作模式 ---
let currentUserMode: 'LocalNoPassword' | 'LocalWithPassword' | 'MultiUserShared';

if (MULTI_USER_MODE) {
  currentUserMode = 'MultiUserShared';
} else {
  if (ACCESS_PASSWORD_HASH && ACCESS_PASSWORD_HASH.trim() !== '') {
    currentUserMode = 'LocalWithPassword';
  } else {
    currentUserMode = 'LocalNoPassword';
  }
}
console.log(`[ComfyTavern Backend] Determined user operation mode: ${currentUserMode}`);
// SINGLE_USER_PATH 已移除，相关日志也移除

// --- 初始化数据库服务 ---
try {
  await DatabaseService.initialize(currentUserMode);
  console.log('[ComfyTavern Backend] DatabaseService initialized successfully.');
} catch (error) {
  console.error('[ComfyTavern Backend] Failed to initialize DatabaseService:', error);
  process.exit(1); // 如果数据库初始化失败，则退出应用
}

// AuthService 会在其静态块中自行初始化，无需显式调用
// console.log('[ComfyTavern Backend] AuthService is self-initializing via static block.');


// 移除旧的 Elysia t 定义的 Schema
// const WorkflowDataSchema = t.Object({ ... })
// const WorkflowUpdateSchema = t.Intersect([ ... ])
// Zod schemas 从 @comfytavern/types 导入

// 函数 syncReferencingNodeGroups 已移至 services/projectService.ts

// 在启动 Elysia 应用前确保所有必要的应用目录存在
// 旧的 essentialDirs 物理路径检查将被替换为 FAMService 逻辑路径创建
const logicalDirsToEnsure = [
  { name: "System Public", logicalPath: 'system://public/' },
  // FileManagerService maps system://logs/ to the physical logs/executions directory
  { name: "System Logs", logicalPath: 'system://logs/' },
  { name: "System Data", logicalPath: 'system://data/' },
  { name: "Shared Library Workflows", logicalPath: 'shared://library/workflows/' },
  // User-specific directories (like user://projects/) are created on-demand by famService
  // when accessed with a userId. The root userData directory's existence is handled by famService's setup.
];

for (const dir of logicalDirsToEnsure) {
  try {
    await famService.createDir(null, dir.logicalPath); // userId is null for system/shared paths
    console.log(`[ComfyTavern Backend] ${dir.name} directory ensured via FAMService: ${dir.logicalPath}`);
  } catch (error) {
    console.error(`[ComfyTavern Backend] Failed to ensure ${dir.name} directory ${dir.logicalPath} via FAMService:`, error);
    process.exit(1); // 如果无法创建关键目录，则退出
  }
}

const app = new Elysia()
app.use(
  cors((() => {
    // 构建实际的白名单
    // 确保 FRONTEND_URL 存在且有效才加入，并对整个列表去重和过滤无效条目
    const uniqueOrigins = new Set<string>();
    if (FRONTEND_URL && typeof FRONTEND_URL === 'string' && FRONTEND_URL.trim() !== '') {
      uniqueOrigins.add(FRONTEND_URL);
    }
    if (Array.isArray(CORS_ALLOWED_ORIGINS)) {
      CORS_ALLOWED_ORIGINS.forEach(origin => {
        if (origin && typeof origin === 'string' && origin.trim() !== '') {
          uniqueOrigins.add(origin);
        }
      });
    }
    const effectiveAllowedOrigins = Array.from(uniqueOrigins);

    console.log('[ComfyTavern Backend] Effective CORS Allowed Origins:', effectiveAllowedOrigins);

    return {
      origin: effectiveAllowedOrigins.length > 0 ? effectiveAllowedOrigins : false, // 如果列表为空，则明确禁止所有跨域
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
      preflight: true,
    };
  })())
)
  .use(staticPlugin({
    assets: getPublicDir(), // 使用确保存在的 publicDir
    prefix: '', // URL 直接从 public 目录的根开始，例如 /avatars/file.png
    alwaysStatic: false, // 仅当找不到API路由时才提供静态文件
    // noCache: process.env.NODE_ENV === 'development', // 开发模式下可以考虑禁用缓存
  }))
  .use(applyAuthMiddleware) // Apply the middleware functionally via .use()
  .use(authRoutes) // 挂载认证路由
  .use(userKeysRoutes) // 挂载用户密钥管理路由
  .use(userProfileRoutes) // + 挂载用户配置路由
  .use(fileManagerRoutes) // ++ 挂载文件管理路由
  .use(nodeApiRoutes) // 挂载节点 API 路由
  .use(clientScriptRoutes) // 挂载客户端脚本路由
  .use(globalWorkflowRoutes) // 挂载全局工作流路由
  .use(executionApiRoutes) // 新增: 挂载执行 API 路由
  .use(characterApiRoutes) // 挂载角色卡 API 路由
  .use(llmConfigRoutes(
    new ApiConfigService(),
    new ActivatedModelService(),
    new LlmApiAdapterRegistry()
  )) // 挂载 LLM 配置路由

  // --- 项目 API 路由已移至 projectRoutes.ts ---

  // --- 结束 项目 API ---
  // --- 结束 API 路由定义 ---

  // 新增：重启服务器的 API 端点
  .post("/api/server/restart", async (context: import('elysia').Context) => { // 为 context 添加类型
    const { set } = context; // 从 context 解构 set
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
// addProjectRoutes(app, { // 旧的调用方式
//   appVersion,
// });
// 使用新的插件方式
app.use(projectRoutesPlugin({ appVersion }));;

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
