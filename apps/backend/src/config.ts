import config from '../../../config.json';
import path from 'node:path'; // 导入 path 模块

const isDev = process.argv.includes('dev');
const { backend, frontend } = config.server;
const executionConfig = config.execution || {}; // 添加默认值以防 config.json 中缺少 execution

export const PORT = backend.port;
export const FRONTEND_URL = `http://localhost:${frontend.port}`;
export const MAX_CONCURRENT_WORKFLOWS = executionConfig.max_concurrent_workflows ?? 5; // 从配置读取，提供默认值

// 定义并导出路径常量
// 使用 path.resolve 确保得到绝对路径
// process.cwd() 在这里指向 apps/backend 目录
export const WORKFLOWS_DIR = path.resolve(process.cwd(), '../../library/workflows'); // 全局库工作流目录
export const PROJECTS_BASE_DIR = path.resolve(process.cwd(), '../../projects'); // 所有项目的基础目录