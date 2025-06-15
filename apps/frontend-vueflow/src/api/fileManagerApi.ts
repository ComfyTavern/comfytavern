// apps/frontend-vueflow/src/api/fileManagerApi.ts
import { useApi } from '@/utils/api';
import { getApiBaseUrl } from '@/utils/urlUtils';
import type { FAMItem } from '@comfytavern/types'; // 导入统一的 FAMItem 类型

// 后端 FileManagerService 的 API 前缀，需要与后端实际路由匹配
// 假设后端 FAMService 统一挂载在 /api/fam 路径下
const API_PREFIX = '/fam';

// 本地 FAMListItem 和 BackendFAMListItem 定义已移除，使用 @comfytavern/types 中的 FAMItem


/**
 * 列出指定逻辑路径下的文件和目录。
 * @param logicalPath 要列出内容的逻辑路径 (例如 "user://", "user://some/folder/")
 * @returns Promise<FAMItem[]> 文件和目录列表
 */
export async function listDir(logicalPath: string): Promise<FAMItem[]> {
  const normalizedPath = logicalPath.endsWith('//') ? logicalPath : logicalPath.replace(/\/?$/, '/');
  try {
    // 后端现在直接返回 FAMItem[] 结构
    const items = await useApi().get<FAMItem[]>(`${API_PREFIX}/list/${encodeURIComponent(normalizedPath)}`);
    return items || []; // 如果 API 返回 null/undefined (虽然不应该)，则返回空数组
  } catch (err) {
    console.error(`[fileManagerApi] Failed to list directory "${normalizedPath}":`, err);
    throw err; // 由调用方处理用户反馈
  }
}

/**
 * 在指定的父逻辑路径下创建新目录。
 * @param parentLogicalPath 父目录的逻辑路径
 * @param dirName 新目录的名称
 * @returns Promise<FAMItem> 创建成功后的目录信息
 */
export async function createDir(parentLogicalPath: string, dirName: string): Promise<FAMItem> {
  try {
    const newDir = await useApi().post<FAMItem>(`${API_PREFIX}/create-dir`, {
      parentLogicalPath,
      dirName,
    });
    if (!newDir) {
      // 根据项目规范，API 成功时应始终返回数据
      throw new Error('[fileManagerApi] No data returned after creating directory, though request was successful.');
    }
    return newDir;
  } catch (err) {
    console.error(`[fileManagerApi] Failed to create directory "${dirName}" in "${parentLogicalPath}":`, err);
    throw err;
  }
}

/**
 * 上传一个或多个文件到指定的逻辑路径。
 * @param targetLogicalPath 文件上传的目标目录逻辑路径
 * @param formData 包含待上传文件的 FormData 对象
 * @returns Promise<FAMItem[]> 上传成功后的文件信息列表
 */
export async function writeFile(targetLogicalPath: string, formData: FormData): Promise<FAMItem[]> {
  try {
    // useApi hook 或底层 fetch/axios 通常会自动处理 FormData 的 Content-Type
    const uploadedFiles = await useApi().post<FAMItem[]>(`${API_PREFIX}/upload/${encodeURIComponent(targetLogicalPath)}`, formData);
    return uploadedFiles || [];
  } catch (err) {
    console.error(`[fileManagerApi] Failed to upload files to "${targetLogicalPath}":`, err);
    throw err;
  }
}

/**
 * 重命名文件或目录。
 * @param logicalPath 要重命名的文件或目录的当前逻辑路径
 * @param newName 新的名称
 * @returns Promise<FAMItem> 重命名后的文件或目录信息
 */
export async function renameFileOrDir(logicalPath: string, newName: string): Promise<FAMItem> {
  try {
    const renamedItem = await useApi().put<FAMItem>(`${API_PREFIX}/rename`, {
      logicalPath,
      newName,
    });
    if (!renamedItem) {
      throw new Error('[fileManagerApi] No data returned after renaming, though request was successful.');
    }
    return renamedItem;
  } catch (err) {
    console.error(`[fileManagerApi] Failed to rename "${logicalPath}" to "${newName}":`, err);
    throw err;
  }
}

/**
 * 移动一个或多个文件/目录到新的目标父路径。
 * @param sourcePaths 要移动的文件/目录的逻辑路径数组
 * @param targetParentPath 目标父目录的逻辑路径
 * @returns Promise<FAMItem[]> 移动成功后的文件/目录信息列表 (通常是移动后的新路径项)
 */
export async function moveFilesOrDirs(sourcePaths: string[], targetParentPath: string): Promise<FAMItem[]> {
  try {
    const movedItems = await useApi().put<FAMItem[]>(`${API_PREFIX}/move`, {
      sourcePaths,
      targetParentPath,
    });
    return movedItems || [];
  } catch (err) {
    console.error(`[fileManagerApi] Failed to move items to "${targetParentPath}":`, err);
    throw err;
  }
}

/**
 * 删除一个或多个文件/目录。
 * @param logicalPaths 要删除的文件/目录的逻辑路径数组
 * @returns Promise<void>
 */
export async function deleteFilesOrDirs(logicalPaths: string[]): Promise<void> {
  try {
    // useApi().del 的第二个参数是 AxiosRequestConfig，请求体通过 config.data 传递
    await useApi().del<void>(`${API_PREFIX}/delete`, { data: { logicalPaths } });
  } catch (err) {
    console.error(`[fileManagerApi] Failed to delete items:`, err);
    throw err;
  }
}

/**
 * 获取文件下载的完整 URL。
 * @param logicalPath 要下载的文件的逻辑路径
 * @returns Promise<string> 文件的可直接访问下载链接
 */
export async function getDownloadFileLink(logicalPath: string): Promise<string> {
  try {
    const baseUrl = getApiBaseUrl(); // 获取 API 基础 URL
    // 确保 baseUrl 和 API_PREFIX 组合正确，避免双斜杠等问题
    const fullUrl = `${baseUrl.replace(/\/$/, '')}${API_PREFIX}/download/${encodeURIComponent(logicalPath)}`;
    return Promise.resolve(fullUrl); // 简单返回拼接的 URL
  } catch (err) {
    // getApiBaseUrl 理论上不应失败，但以防万一
    console.error(`[fileManagerApi] Failed to construct download link for "${logicalPath}":`, err);
    throw err;
  }
}


// 其他可能需要的 API (根据文档和后端 FAMService 的实际能力添加):
// - copyFileOrDir(sourcePath: string, targetParentPath: string, newName?: string): Promise<FAMListItem>
// - searchFiles(logicalPath: string, query: string, options?: any): Promise<FAMListItem[]>
// - getFilePreview(logicalPath: string, fileType: string): Promise<any> // 获取预览数据，如文本内容、图片 base64 等

// 占位导出，确保文件在没有其他具体导出时仍被视为模块
export const fileManagerApiClient = {
  listDir,
  createDir,
  writeFile,
  renameFileOrDir,
  moveFilesOrDirs,
  deleteFilesOrDirs,
  getDownloadFileLink,
};