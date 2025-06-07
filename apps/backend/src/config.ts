import path from 'node:path'; // 导入 path 模块

import config from '../../../config.json';

const isDev = process.argv.includes('dev');
const { backend, frontend } = config.server;
const executionConfig = config.execution || {}; // 添加默认值以防 config.json 中缺少 execution

export const PORT = backend.port;
export const FRONTEND_URL = `http://localhost:${frontend.port}`;
export const MAX_CONCURRENT_WORKFLOWS = executionConfig.max_concurrent_workflows ?? 5; // 从配置读取，提供默认值

// 从 config.json 读取自定义节点路径，如果不存在则默认为空数组
// 这些路径应该是相对于项目根目录的
export const CUSTOM_NODE_PATHS: string[] = (config as any).customNodePaths || [];

// 定义并导出路径常量
// 使用 path.resolve 确保得到绝对路径
// process.cwd() 在这里指向 apps/backend 目录
export const LIBRARY_BASE_DIR = path.resolve(process.cwd(), '../../library'); // 指向项目根目录下的 library
export const WORKFLOWS_DIR = path.join(LIBRARY_BASE_DIR, 'workflows'); // 全局库工作流目录
export const SILLYTAVERN_DIR = path.join(LIBRARY_BASE_DIR,'SillyTavern'); // 全局库 SillyTavern 目录
export const PROJECTS_BASE_DIR = path.resolve(process.cwd(), '../../projects'); // 所有项目的基础目录