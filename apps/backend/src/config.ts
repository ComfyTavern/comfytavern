import config from '../../../config.json';
import {
  getLogDir,
  getLibraryBaseDir,
  getWorkflowsDir as getGlobalWorkflowsDir, // 全局库的工作流
  getSillyTavernDir as getGlobalSillyTavernDir, // 全局库的SillyTavern
  getProjectsBaseDir,
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
export const FRONTEND_URL = `http://localhost:${frontend.port}`;
export const MAX_CONCURRENT_WORKFLOWS = executionConfig.max_concurrent_workflows ?? 5; // 从配置读取，提供默认值

// 从 config.json 读取自定义节点路径，如果不存在则默认为空数组
// 这些路径应该是相对于项目根目录的
export const CUSTOM_NODE_PATHS: string[] = (config as any).customNodePaths || [];

// 新增用户管理配置
// 确保在访问嵌套属性前检查 userManagement 是否存在
const userManagementConfig = (config as any).userManagement || {};
export const MULTI_USER_MODE: boolean = userManagementConfig.multiUserMode === true; // 明确转换为布尔值，默认为 false
export const ACCESS_PASSWORD_HASH: string | null = userManagementConfig.accessPasswordHash || null;
// 根据设计文档 (line 73, 79), singleUserPath 用于文件数据，用户身份ID固定为 'default_user'
export const SINGLE_USER_PATH: string = userManagementConfig.singleUserPath || "default_user_data";

// 新增安全配置的读取
const securityConfig = (config as any).security || {};
export const ENABLE_CREDENTIAL_ENCRYPTION: boolean = securityConfig.enableCredentialEncryption === true; // 明确转为布尔值，默认为 false 如果未配置或配置非 true
// export const MEK_ENV_VAR_NAME: string = securityConfig.masterEncryptionKeyEnvVar || 'COMFYTAVERN_MASTER_ENCRYPTION_KEY'; // 从配置中读取环境变量名，提供默认值
export const MASTER_ENCRYPTION_KEY: string | undefined = securityConfig.masterEncryptionKeyValue || undefined;

// 使用 fileUtils 获取标准目录路径
export const LIBRARY_BASE_DIR = getLibraryBaseDir(); // 全局库根目录
export const WORKFLOWS_DIR = getGlobalWorkflowsDir(); // 全局库的工作流目录
export const SILLYTAVERN_DIR = getGlobalSillyTavernDir(); // 全局库的 SillyTavern 目录
export const PROJECTS_BASE_DIR = getProjectsBaseDir(); // 所有项目的基础目录 (内部会按用户组织)

// USER_DATA_ROOT 和 SINGLE_USER_SPECIFIC_DATA_DIR 的定义保持不变，因为它们依赖 MULTI_USER_MODE
// 并且 SINGLE_USER_PATH 是一个标识符，而不是一个完整的路径片段。
// 实际的用户数据路径构建逻辑在 DatabaseService 和 ProjectService 中处理，
// 它们会结合 USER_DATA_ROOT 和用户标识 (如 SINGLE_USER_PATH 或 uid)。
// 我们会在 index.ts 中确保 USER_DATA_ROOT 本身存在。