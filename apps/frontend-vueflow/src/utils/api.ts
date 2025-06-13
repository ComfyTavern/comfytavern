import axios from 'axios';
import { getApiBaseUrl } from './urlUtils'; // 导入新的工具函数

// 使用工具函数获取 API 基础 URL
const API_BASE_URL = getApiBaseUrl();

export const useApi = () => {
  const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const get = async <T>(url: string): Promise<T> => {
    const response = await api.get<T>(url);
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