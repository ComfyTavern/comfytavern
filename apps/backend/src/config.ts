import config from '../../../config.json';
import {
  getLogDir,
  getLibraryBaseDir,
  // getWorkflowsDir as getGlobalWorkflowsDir, // 全局库的工作流 - 移除
  // getSillyTavernDir as getGlobalSillyTavernDir, // 全局库的SillyTavern - 移除
  // getProjectsBaseDir, // 移除
  // getUserDataRoot, // USER_DATA_ROOT 将在下面根据模式定义
  // getUserSpecificDataDir // 这个主要在 service层面使用
} from './utils/fileUtils';

const isDev = process.argv.includes('dev');
const { backend, frontend } = config.server;
const executionConfig = config.execution || {};
// 使用 fileUtils 获取日志目录，如果 config.json 中有特定配置，则优先使用，否则用默认的
export const LOG_DIR = executionConfig.logDir
  ? executionConfig.logDir // 假设 config.json 中的 logDir 已经是期望的完整路径或相对于根的路径
  : getLogDir();

export const PORT = backend.port;

// 优先从环境变量 FRONTEND_URL 获取前端 URL
// 如果环境变量未设置，则尝试从 config.json 的 server.frontend.baseUrl 获取 (如果存在)
// 如果两者都未设置，则回退到基于 localhost 和 config.json 中定义的端口进行本地开发
const configFrontendPort = frontend.port;
const configFrontendBaseUrl = (frontend as any).baseUrl; // 假设 config.json 中可能有 server.frontend.baseUrl
export const FRONTEND_URL = process.env.FRONTEND_URL ||
                            configFrontendBaseUrl ||
                            `http://localhost:${configFrontendPort}`;

export const MAX_CONCURRENT_WORKFLOWS = executionConfig.max_concurrent_workflows ?? 5; // 从配置读取，提供默认值

// 从 config.json 读取自定义插件路径，如果不存在则默认为空数组
// 这些路径应该是相对于项目根目录的
export const CUSTOM_PLUGINS_PATHS: string[] = (config as any).customPluginsPaths || [];

// 新增用户管理配置
// 确保在访问嵌套属性前检查 userManagement 是否存在
const userManagementConfig = (config as any).userManagement || {};
export const MULTI_USER_MODE: boolean = userManagementConfig.multiUserMode === true; // 明确转换为布尔值，默认为 false
export const ACCESS_PASSWORD_HASH: string | null = userManagementConfig.accessPasswordHash || null;
// SINGLE_USER_PATH 已移除，单用户模式下的用户标识固定为 'default_user' (见 DatabaseService.ts)

// 新增安全配置的读取
const securityConfig = (config as any).security || {};
export const ENABLE_CREDENTIAL_ENCRYPTION: boolean = securityConfig.enableCredentialEncryption === true; // 明确转为布尔值，默认为 false 如果未配置或配置非 true
// export const MEK_ENV_VAR_NAME: string = securityConfig.masterEncryptionKeyEnvVar || 'COMFYTAVERN_MASTER_ENCRYPTION_KEY'; // 从配置中读取环境变量名，提供默认值
export const MASTER_ENCRYPTION_KEY: string | undefined = securityConfig.masterEncryptionKeyValue || undefined;
// 新增：读取 CORS 允许的源白名单，默认为空数组
export const CORS_ALLOWED_ORIGINS: string[] = Array.isArray(securityConfig.corsAllowedOrigins) ? securityConfig.corsAllowedOrigins : [];

// 新增：读取面板开发模式下允许的源，仅用于开发环境，默认为空数组
export const PANEL_DEV_ORIGINS: string[] = Array.isArray(securityConfig.panelDevOrigins) ? securityConfig.panelDevOrigins : [];


// 使用 fileUtils 获取标准目录路径
export const LIBRARY_BASE_DIR = getLibraryBaseDir(); // 全局库根目录
// export const WORKFLOWS_DIR = getGlobalWorkflowsDir(); // 全局库的工作流目录 - 移除
// export const SILLYTAVERN_DIR = getGlobalSillyTavernDir(); // 全局库的 SillyTavern 目录 - 移除
// export const PROJECTS_BASE_DIR = getProjectsBaseDir(); // 所有项目的基础目录 (内部会按用户组织) - 移除

// USER_DATA_ROOT 的定义保持不变。
// 实际的用户数据路径构建逻辑在 DatabaseService 和 ProjectService 中处理，
// 它们会结合 USER_DATA_ROOT 和用户标识 (单用户模式为 'default_user', 多用户模式为 uid)。
// 我们会在 index.ts 中确保 USER_DATA_ROOT 本身存在。