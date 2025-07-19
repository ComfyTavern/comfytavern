import { api } from '@/utils/api';
import type { ExtensionInfo } from '@comfytavern/types';

/**
 * 获取所有已发现的插件列表。
 * @returns {Promise<ExtensionInfo[]>}
 */
export async function getPlugins(): Promise<ExtensionInfo[]> {
  const response = await api.get<ExtensionInfo[]>('/plugins');
  return response.data;
}

/**
 * 设置插件的启用状态。
 * @param {string} pluginName - 插件的名称。
 * @param {boolean} enabled - true 表示启用, false 表示禁用。
 * @returns {Promise<{ success: boolean; message: string }>}
 */
export async function setPluginState(pluginName: string, enabled: boolean): Promise<{ success: boolean; message: string }> {
  const response = await api.put<{ success: boolean; message: string }>(
    `/plugins/${pluginName}/state`,
    { enabled }
  );
  return response.data;
}

/**
 * 请求后端重新加载所有插件。
 * @returns {Promise<{ success: boolean; message: string; count: number }>}
 */
export async function reloadPlugins(): Promise<{ success: boolean; message: string; count: number }> {
  const response = await api.post<{ success: boolean; message: string; count: number }>(
    '/plugins/reload'
  );
  return response.data;
}