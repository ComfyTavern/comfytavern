import { fileManagerApiClient } from './fileManagerApi';
import type { ApiAdapter, CreateApiAdapterPayload, UpdateApiAdapterPayload, FAMItem } from '@comfytavern/types';
import { v4 as uuidv4 } from 'uuid';

const ADAPTERS_DIR_BASE = 'user://projects';

function getAdaptersDir(projectId: string): string {
  // 确保目录路径以斜杠结尾
  return `${ADAPTERS_DIR_BASE}/${projectId}/adapters/`;
}

/**
 * 列出指定项目的所有API适配器
 */
async function list(projectId: string): Promise<ApiAdapter[]> {
  const adaptersDir = getAdaptersDir(projectId);
  try {
    const items: FAMItem[] = await fileManagerApiClient.listDir(adaptersDir, { ensureExists: true });
    const adapterFiles = items.filter(item => item.itemType === 'file' && item.name.endsWith('.json'));

    const adapters = await Promise.all(
      adapterFiles.map(async (file) => {
        const content = await fileManagerApiClient.readFile(file.logicalPath);
        // 后端返回的内容可能已经是JSON对象，也可能是字符串
        const adapterData = typeof content === 'string' ? JSON.parse(content) : content;
        // 将文件名（不含扩展名）作为ID
        const id = file.name.replace('.json', '');
        return { ...adapterData, id } as ApiAdapter;
      })
    );
    return adapters;
  } catch (error) {
    console.error(`[adapterApi] 列出适配器失败 (项目ID: ${projectId}):`, error);
    // 如果目录不存在或发生其他错误，返回空数组
    return [];
  }
}

/**
 * 获取单个API适配器
 */
async function get(projectId: string, adapterId: string): Promise<ApiAdapter | null> {
    const adapterPath = `${getAdaptersDir(projectId)}${adapterId}.json`;
    try {
        const content = await fileManagerApiClient.readFile(adapterPath);
        if (!content) return null;
        const adapterData = typeof content === 'string' ? JSON.parse(content) : content;
        return { ...adapterData, id: adapterId } as ApiAdapter;
    } catch (error) {
        console.error(`[adapterApi] 获取适配器失败 (ID: ${adapterId}):`, error);
        return null;
    }
}

/**
 * 创建一个新的API适配器
 */
async function create(projectId: string, payload: CreateApiAdapterPayload): Promise<ApiAdapter> {
  const adaptersDir = getAdaptersDir(projectId);
  // 为新适配器生成一个唯一ID
  const newAdapterId = payload.name.replace(/\s+/g, '_').toLowerCase() + '_' + uuidv4().substring(0, 8);
  const newAdapterPath = `${adaptersDir}${newAdapterId}.json`;

  const newAdapter: Omit<ApiAdapter, 'id'> = {
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      validationStatus: 'UNKNOWN', // 新创建的适配器状态未知
  };
  
  const blob = new Blob([JSON.stringify(newAdapter, null, 2)], { type: 'application/json' });
  const formData = new FormData();
  formData.append('files', blob, `${newAdapterId}.json`);

  try {
    await fileManagerApiClient.writeFile(adaptersDir, formData);
    return { ...newAdapter, id: newAdapterId } as ApiAdapter;
  } catch (error) {
    console.error(`[adapterApi] 创建适配器失败 (项目ID: ${projectId}, 名称: ${payload.name}):`, error);
    throw error;
  }
}

/**
 * 更新一个现有的API适配器
 */
async function update(projectId: string, adapterId: string, payload: UpdateApiAdapterPayload): Promise<ApiAdapter> {
  const adapterPath = `${getAdaptersDir(projectId)}${adapterId}.json`;
  const existingAdapter = await get(projectId, adapterId);

  if (!existingAdapter) {
    throw new Error(`适配器 ${adapterId} 未找到，无法更新。`);
  }

  const updatedAdapter: ApiAdapter = {
    ...existingAdapter,
    ...payload,
    id: adapterId, // 确保ID不变
    updatedAt: new Date().toISOString(),
    // validationStatus 可以在更新时重新评估，这里暂时保持不变或根据后端逻辑更新
  };

  const blob = new Blob([JSON.stringify(updatedAdapter, null, 2)], { type: 'application/json' });
  const formData = new FormData();
  formData.append('files', blob, `${adapterId}.json`);

  try {
    await fileManagerApiClient.writeFile(getAdaptersDir(projectId), formData);
    return updatedAdapter;
  } catch (error) {
    console.error(`[adapterApi] 更新适配器失败 (ID: ${adapterId}):`, error);
    throw error;
  }
}

/**
 * 删除一个API适配器
 */
async function remove(projectId: string, adapterId: string): Promise<void> {
  const adapterPath = `${getAdaptersDir(projectId)}${adapterId}.json`;
  try {
    await fileManagerApiClient.deleteFilesOrDirs([adapterPath]);
  } catch (error) {
    console.error(`[adapterApi] 删除适配器失败 (ID: ${adapterId}):`, error);
    throw error;
  }
}

export const adapterApi = {
  list,
  get,
  create,
  update,
  remove, // 使用 remove 避免与 JS 内置的 delete 关键字冲突
};