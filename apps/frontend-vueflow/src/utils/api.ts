import axios from 'axios';
import { getApiBaseUrl } from './urlUtils'; // 导入新的工具函数
import type { WorkflowStorageObject } from '@comfytavern/types';

// 使用工具函数获取 API 基础 URL
const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});


export const useApi = () => {
  const get = async <T>(url: string, config?: import('axios').AxiosRequestConfig): Promise<T> => {
    const response = await api.get<T>(url, config);
    return response.data;
  };

  const post = async <T>(url: string, data: any, config?: import('axios').AxiosRequestConfig): Promise<T> => {
    const response = await api.post<T>(url, data, config);
    return response.data;
  };

  const put = async <T>(url: string, data: any, config?: import('axios').AxiosRequestConfig): Promise<T> => {
    const response = await api.put<T>(url, data, config);
    return response.data;
  };

  const del = async <T>(url: string, config?: import('axios').AxiosRequestConfig): Promise<T> => { // delete 通常没有 body，但可以有 config
    const response = await api.delete<T>(url, config);
    return response.data;
  };

  return {
    get,
    post,
    put,
    del,
  };
};

// 新增的独立 API 函数
export const getWorkflow = async (projectId: string, workflowId: string): Promise<WorkflowStorageObject> => {
  const response = await api.get<WorkflowStorageObject>(`/projects/${projectId}/workflows/${workflowId}`);
  return response.data;
};