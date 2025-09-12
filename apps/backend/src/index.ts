import { Elysia } from "elysia"; // 移除未使用的 t
import { promises as fs } from "node:fs";
import path, { dirname, join } from "node:path"; // 移除未使用的 basename, extname
import { fileURLToPath } from "node:url";
import { staticPlugin } from "@elysiajs/static";

import { cors } from "@elysiajs/cors";
import { getPublicDir, getProjectRootDir } from "./utils/fileUtils";
import { famService } from "./services/FileManagerService"; // Import famService

// 从 config.ts 导入的 WORKFLOWS_DIR, PROJECTS_BASE_DIR 等已经是绝对路径了
import {
  CUSTOM_PLUGINS_PATHS,
  FRONTEND_URL,
  PORT,
  MULTI_USER_MODE,
  CORS_ALLOWED_ORIGINS, // 导入 CORS 白名单
  PANEL_DEV_ORIGINS, // 导入面板开发源
} from "./config";
import { characterApiRoutes } from "./routes/characterRoutes";
import { executionApiRoutes } from "./routes/executionRoutes";
import { clientScriptRoutes, nodeApiRoutes } from "./routes/nodeRoutes";
import { projectRoutesPlugin } from "./routes/projectRoutes"; // 修改导入名称
import { panelRoutes } from "./routes/panelRoutes"; // 导入面板路由
import { indexRoutes } from "./routes/indexRoutes"; // 导入主页路由
import { chatRoutes } from "./routes/chatRoutes"; // 导入聊天路由
import { DatabaseService } from "./services/DatabaseService";
import { applyAuthMiddleware } from "./middleware/authMiddleware"; // Changed to import the function
import { authRoutes } from "./routes/authRoutes";
import { userKeysRoutes } from "./routes/userKeysRoutes"; // 导入 userKeysRoutes
import { userProfileRoutes } from "./routes/userProfileRoutes"; // 导入 userProfileRoutes
import { fileManagerRoutes } from "./routes/fileManagerRoutes"; // 导入文件管理路由
import { globalWorkflowRoutes } from "./routes/workflowRoutes";
import { llmConfigRoutes } from "./routes/llmConfigRoutes"; // 导入 LLM 配置路由
import { pluginRoutes } from "./routes/pluginRoutes"; // 导入插件路由
import { pluginAssetRoutes } from "./routes/pluginAssetRoutes"; // 导入插件静态资源路由
import { ApiConfigService } from "./services/ApiConfigService";
import { ActivatedModelService } from "./services/ActivatedModelService";
import { LlmApiAdapterRegistry } from "./services/LlmApiAdapterRegistry";
import { ConcurrencyScheduler } from "./services/ConcurrencyScheduler";
import { NodeLoader } from "./services/NodeLoader";
import { PluginLoader } from "./services/PluginLoader"; // 导入插件加载器
import { nodeManager } from "./services/NodeManager"; // 导入 NodeManager
import { createWebsocketHandler, websocketSchema } from "./websocket/handler";
import { WebSocketManager } from "./websocket/WebSocketManager";

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

// 2. 加载自定义节点路径的逻辑已移至插件加载部分
// 这里不再需要单独处理 CUSTOM_PLUGINS_PATHS

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

// --- 确定用户操作模式 (v4 简化) ---
const currentUserMode = MULTI_USER_MODE ? "MultiUser" : "SingleUser";
console.log(`[ComfyTavern Backend] Determined user operation mode: ${currentUserMode}`);
// SINGLE_USER_PATH 已移除，相关日志也移除

// --- 初始化数据库服务 ---
try {
  await DatabaseService.initialize(currentUserMode);
  console.log("[ComfyTavern Backend] DatabaseService initialized successfully.");
} catch (error) {
  console.error("[ComfyTavern Backend] Failed to initialize DatabaseService:", error);
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
  { name: "System Public", logicalPath: "system://public/" },
  // FileManagerService maps system://logs/ to the physical logs/executions directory
  { name: "System Logs", logicalPath: "system://logs/" },
  { name: "System Data", logicalPath: "system://data/" },
  { name: "Shared Library Workflows", logicalPath: "shared://library/workflows/" },
  // User-specific directories (like user://projects/) are created on-demand by famService
  // when accessed with a userId. The root userData directory's existence is handled by famService's setup.
];

for (const dir of logicalDirsToEnsure) {
  try {
    await famService.createDir(null, dir.logicalPath); // userId is null for system/shared paths
    console.log(
      `[ComfyTavern Backend] ${dir.name} directory ensured via FAMService: ${dir.logicalPath}`
    );
  } catch (error) {
    console.error(
      `[ComfyTavern Backend] Failed to ensure ${dir.name} directory ${dir.logicalPath} via FAMService:`,
      error
    );
    process.exit(1); // 如果无法创建关键目录，则退出
  }
}

const app = new Elysia();

// 3. 加载插件
// 必须在实例化 app 之后，挂载路由之前调用，以便插件可以注册自己的静态资源
console.log(`[ComfyTavern Backend] Loading plugins...`);
const projectRootDir = getProjectRootDir();
const defaultPluginsPath = path.join(projectRootDir, "plugins");
const allPluginPaths = [
  defaultPluginsPath,
  ...CUSTOM_PLUGINS_PATHS.map((p) => path.resolve(projectRootDir, p)),
];
await PluginLoader.loadPlugins(app, allPluginPaths, projectRootDir); // 将 app 实例、所有插件路径和项目根目录传入

// 在所有节点加载完成后，统一打印注册节点列表
const definitions = nodeManager.getDefinitions();
const groupedNodes: Record<string, string[]> = {};
for (const node of definitions) {
  const namespace = node.namespace || "_unknown"; // 如果 namespace 未定义，则使用 _core
  if (!groupedNodes[namespace]) {
    groupedNodes[namespace] = [];
  }
  groupedNodes[namespace].push(node.type);
}
console.log(
  "[ComfyTavern Backend] All nodes loaded. Registered nodes (grouped by namespace):",
  groupedNodes
);

app
  .use(
    cors(
      (() => {
        // 构建实际的白名单
        // 确保 FRONTEND_URL 存在且有效才加入，并对整个列表去重和过滤无效条目
        const uniqueOrigins = new Set<string>();
        if (FRONTEND_URL && typeof FRONTEND_URL === "string" && FRONTEND_URL.trim() !== "") {
          uniqueOrigins.add(FRONTEND_URL);
        }
        if (Array.isArray(CORS_ALLOWED_ORIGINS)) {
          CORS_ALLOWED_ORIGINS.forEach((origin) => {
            if (origin && typeof origin === "string" && origin.trim() !== "") {
              uniqueOrigins.add(origin);
            }
          });
        }

        // 在开发模式下，动态添加在 config.json 中配置的面板开发服务器地址
        if (process.env.NODE_ENV === "development") {
          if (PANEL_DEV_ORIGINS.length > 0) {
            console.log(
              "[ComfyTavern Backend] Development mode: Adding panel dev server origins to CORS allowlist:",
              PANEL_DEV_ORIGINS
            );
            PANEL_DEV_ORIGINS.forEach((origin) => {
              if (origin && typeof origin === "string" && origin.trim() !== "") {
                uniqueOrigins.add(origin);
              }
            });
          }
        }

        const effectiveAllowedOrigins = Array.from(uniqueOrigins);

        console.log(
          "[ComfyTavern Backend] Effective CORS Allowed Origins:",
          effectiveAllowedOrigins
        );

        return {
          origin: effectiveAllowedOrigins.length > 0 ? effectiveAllowedOrigins : false, // 如果列表为空，则明确禁止所有跨域
          methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
          allowedHeaders: ["Content-Type", "Authorization"],
          credentials: true,
          preflight: true,
        };
      })()
    )
  )
  .use(
    staticPlugin({
      assets: getPublicDir(), // 使用确保存在的 publicDir
      prefix: "", // URL 直接从 public 目录的根开始，例如 /avatars/file.png
      alwaysStatic: false, // 仅当找不到API路由时才提供静态文件
      // noCache: process.env.NODE_ENV === 'development', // 开发模式下可以考虑禁用缓存
    })
  )
  .use(indexRoutes({ appVersion })) // 挂载主页路由
  .use(applyAuthMiddleware) // Apply the middleware functionally via .use()
  .use(authRoutes) // 挂载认证路由
  .use(userKeysRoutes) // 挂载用户密钥管理路由
  .use(pluginRoutes) // 挂载插件路由
  .use(pluginAssetRoutes) // 挂载插件静态资源路由
  .use(userProfileRoutes) // 挂载用户配置路由
  .use(fileManagerRoutes) // 挂载文件管理路由
  .use(nodeApiRoutes) // 挂载节点 API 路由
  .use(clientScriptRoutes) // 挂载客户端脚本路由
  .use(globalWorkflowRoutes) // 挂载全局工作流路由
  .use(executionApiRoutes) // 新增: 挂载执行 API 路由
  .use(characterApiRoutes) // 挂载角色卡 API 路由
  .use(
    llmConfigRoutes(
      new ApiConfigService(),
      new ActivatedModelService(),
      new LlmApiAdapterRegistry()
    )
  ) // 挂载 LLM 配置路由

  // --- 项目 API 路由已移至 projectRoutes.ts ---

  // 新增：重启服务器的 API 端点
  .post("/api/server/restart", async (context: import("elysia").Context) => {
    // 为 context 添加类型
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
app.use(projectRoutesPlugin({ appVersion }));
app.use(panelRoutes); // 挂载面板路由
app.use(chatRoutes); // 挂载聊天路由

// --- 实例化管理器 ---
// 将服务实例化提升到这里，以便注入到调度器
const apiConfigService = new ApiConfigService();
const activatedModelService = new ActivatedModelService();
const llmApiAdapterRegistry = new LlmApiAdapterRegistry();

// 将所有需要传递的服务打包
const services = {
  apiConfigService,
  activatedModelService,
  llmApiAdapterRegistry,
  // 如果其他服务也需要，在这里添加
};

// WebSocketManager 需要 HTTP 服务器，在 listen 回调中附加
const wsManager = new WebSocketManager(); // 初始时不传入 server
PluginLoader.setWebSocketManager(wsManager); // 咕咕：将 wsManager 实例注入到 PluginLoader
export const scheduler = new ConcurrencyScheduler(wsManager, services, MULTI_USER_MODE); // 将 wsManager, services 和 multiUserMode 注入 scheduler 并导出
export { wsManager }; // 导出 wsManager 实例

// --- 挂载 WebSocket 路由 ---
// 使用工厂函数创建 handler，并注入依赖
const handler = createWebsocketHandler(scheduler, wsManager);
app.ws("/ws", {
  ...websocketSchema, // 应用导入的 Schema
  ...handler, // 应用创建的 handler 对象
  drain: (ws) => {
    // 使用新的、更清晰的 handleDrain 方法
    wsManager.handleDrain(ws as any);
  },
});

// --- 启动服务器 ---
app.listen(PORT, (server) => {
  // 使用 listen 回调获取 server 实例
  if (server) {
    // 移除对 attachServer 的调用，因为 Elysia 通过 app.ws 处理 WebSocket
    // wsManager.attachServer(server); // <--- 移除此行
    // 检查是否以集成模式启动 (通过命令行参数)
    const isIntegratedLaunch = process.argv.includes("--integrated-launch");
    if (!isIntegratedLaunch) {
      console.log(
        `\n\x1b[93m🦊[ComfyTavern Backend] Elysia is running at http://${server.hostname}:${server.port}\x1b[0m`
      );
      console.log(
        `\n\x1b[96m🦊[ComfyTavern 后端] 服务器已于端口 ${PORT} 启动，访问地址为 http://localhost:${PORT}\x1b[0m\n`
      );
    }
  } else {
    console.error("Failed to start server.");
    process.exit(1); // 启动失败则退出
  }
});
