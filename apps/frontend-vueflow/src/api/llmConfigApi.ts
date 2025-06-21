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
  if (channel.id) {
    return put(`${API_PREFIX}/channels/${channel.id}`, channel);
  } else {
    return post(`${API_PREFIX}/channels`, channel);
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