import fs from 'fs/promises';
import path from 'path';

/**
 * 确保指定的目录存在。如果目录不存在，则会递归创建它。
 * @param dirPath 要确保存在的目录的路径。
 */
export async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(dirPath, { recursive: true });
      console.log(`[FileUtils] Directory created: ${dirPath}`);
    } else {
      console.error(`[FileUtils] Error checking directory ${dirPath}:`, error);
      throw error;
    }
  }
}

/**
 * 获取项目根目录。
 * 此文件位于 apps/backend/src/utils/fileUtils.ts
 * @returns 项目根目录的绝对路径。
 */
export function getProjectRootDir(): string {
  // 从当前文件 (__filename) 获取目录 (apps/backend/src/utils)
  // 然后向上导航四层到达项目根目录 (ComfyTavern)
  const currentFileDir = path.dirname(new URL(import.meta.url).pathname);
  if (process.platform === "win32" && currentFileDir.startsWith("/")) {
    // 在 Windows 上，URL.pathname 会以 / 开头，例如 /E:/path，需要移除开头的 /
    return path.resolve(currentFileDir.substring(1), "../../../..");
  }
  return path.resolve(currentFileDir, "../../../..");
}

/**
 * 获取项目根目录下 public 目录的路径。
 * @returns public 目录的绝对路径。
 */
export function getPublicDir(): string {
  return path.join(getProjectRootDir(), 'public');
}

/**
 * 获取项目根目录下 public/avatars 目录的路径。
 * @returns public/avatars 目录的绝对路径。
 */
export function getAvatarsDir(): string {
  return path.join(getPublicDir(), 'avatars');
}

/**
 * 获取项目根目录下 logs/executions 目录的路径。
 * @returns logs/executions 目录的绝对路径。
 */
export function getLogDir(): string {
  return path.join(getProjectRootDir(), 'logs', 'executions');
}

/**
 * 获取项目根目录下 library 目录的路径。
 * @returns library 目录的绝对路径。
 */
export function getLibraryBaseDir(): string {
  return path.join(getProjectRootDir(), 'library');
}

/**
 * 获取项目根目录下 library/workflows 目录的路径。
 * @returns library/workflows 目录的绝对路径。
 */
export function getWorkflowsDir(): string {
  return path.join(getLibraryBaseDir(), 'workflows');
}

/**
 * 获取项目根目录下 library/SillyTavern 目录的路径。
 * @returns library/SillyTavern 目录的绝对路径。
 */
export function getSillyTavernDir(): string {
  return path.join(getLibraryBaseDir(), 'SillyTavern');
}

/**
 * 获取项目根目录下 projects 目录的路径 (所有项目的基础目录)。
 * @returns projects 目录的绝对路径。
 */
export function getProjectsBaseDir(): string {
  return path.join(getProjectRootDir(), 'projects');
}

/**
 * 获取项目根目录下 userData 目录的路径。
 * @returns userData 目录的绝对路径。
 */
export function getUserDataRoot(): string {
  return path.join(getProjectRootDir(), 'userData');
}

/**
 * 获取特定用户的项目数据目录路径。
 * @param userPath 通常是用户的唯一标识符或 'default_user_data'
 * @returns 特定用户的项目数据目录的绝对路径。
 */
export function getUserSpecificDataDir(userPath: string): string {
  return path.join(getUserDataRoot(), userPath);
}

/**
 * 获取项目根目录下 data 目录的路径 (用于存放数据库等)。
 * @returns data 目录的绝对路径。
 */
export function getDataDir(): string {
  return path.join(getProjectRootDir(), 'data');
}