import { useApi } from '@/utils/api';

interface UpdateUsernamePayload {
  username: string;
}

interface UpdateUsernameResponse {
  success: boolean;
  message: string;
  username?: string; // 返回更新后的用户名
}

/**
 * 更新当前默认用户的用户名。
 * @param payload 包含新用户名的对象。
 * @returns 解析为包含成功状态和消息的对象的 Promise。
 */
export async function updateDefaultUsername(payload: UpdateUsernamePayload): Promise<UpdateUsernameResponse> {
  const { put } = useApi();
  try {
    // put<UpdateUsernameResponse> 指定了期望的响应体类型
    const responseData = await put<UpdateUsernameResponse>('/users/me/username', payload);
    return responseData; // useApi 的 put 已经处理了 response.data
  } catch (error: any) {
    console.error('更新用户名失败:', error);
    // 尝试从 error 对象中提取后端返回的错误信息
    if (error && error.data && typeof error.data.error === 'string') {
      throw { success: false, message: error.data.error, ...(error.data.details && { details: error.data.details }) };
    }
    if (error && typeof error.message === 'string' && !error.data) { // AxiosError without data but with message
        throw { success: false, message: error.message };
    }
    throw { success: false, message: '更新用户名时发生未知网络错误' };
  }
}