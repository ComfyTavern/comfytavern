import { useApi } from '@/utils/api';
import type { ApiCredentialConfig, ActivatedModelInfo } from '@comfytavern/types';

const API_PREFIX = '/llm';
const { get, post, put, del } = useApi();

// =================================================================
// ApiChannel (Credentials)
// =================================================================

export const getProviders = async (): Promise<{ id: string; name: string }[]> => {
  return get(`${API_PREFIX}/providers`);
};

export const getApiChannels = async (): Promise<ApiCredentialConfig[]> => {
  return get(`${API_PREFIX}/channels`);
};

export const getApiChannelById = async (id: string): Promise<ApiCredentialConfig> => {
  return get(`${API_PREFIX}/channels/${id}`);
};

export const saveApiChannel = async (channel: Partial<ApiCredentialConfig>): Promise<ApiCredentialConfig> => {
  // 从 channel 对象中解构出 id 和其他元数据，
  // 剩下的字段作为请求体 (payload)。
  // 这样可以确保我们不会将后端管理的字段（如 id, userId, createdAt）发送到请求体中。
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, userId, createdAt, ...payload } = channel as any;

  // 最终修复：遍历 payload，删除所有值为 null 的字段。
  // 后端验证器对于可选字段期望的是 `undefined` 而不是 `null`。
  // 数据库中 JSON 类型的空字段可能会被读取为 null，必须在这里清理。
  for (const key in payload) {
    if (payload[key] === null) {
      delete payload[key];
    }
  }

  if (id) {
    // 更新操作：使用 PUT 方法，并将净化后的 payload 作为请求体
    return put(`${API_PREFIX}/channels/${id}`, payload);
  } else {
    // 创建操作：使用 POST 方法
    return post(`${API_PREFIX}/channels`, payload);
  }
};

export const deleteApiChannel = async (id: string): Promise<void> => {
  await del(`${API_PREFIX}/channels/${id}`);
};

export const listModelsFromChannel = async (id: string): Promise<string[]> => {
  return get(`${API_PREFIX}/channels/${id}/list-models`);
};


// =================================================================
// Activated Models
// =================================================================

export const getActivatedModels = async (): Promise<ActivatedModelInfo[]> => {
  return get(`${API_PREFIX}/models`);
};

export const getActivatedModelById = async (id: string): Promise<ActivatedModelInfo> => {
  return get(`${API_PREFIX}/models/${encodeURIComponent(id)}`);
};

export const addActivatedModel = async (modelData: Omit<ActivatedModelInfo, 'id' | 'createdAt'>): Promise<ActivatedModelInfo> => {
  return post(`${API_PREFIX}/models`, modelData);
};

export const updateActivatedModel = async (id: string, modelData: Partial<Omit<ActivatedModelInfo, 'id' | 'createdAt'>>): Promise<ActivatedModelInfo> => {
  return put(`${API_PREFIX}/models/${encodeURIComponent(id)}`, modelData);
};

export const deleteActivatedModel = async (id: string): Promise<void> => {
  await del(`${API_PREFIX}/models/${encodeURIComponent(id)}`);
};

// =================================================================
// Model Discovery
// =================================================================

export const discoverModelsFromChannel = async (channelId: string): Promise<any[]> => {
  return post(`${API_PREFIX}/channels/${channelId}/discover-models`, {});
};