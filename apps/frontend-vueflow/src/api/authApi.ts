import type { UserContext } from '@comfytavern/types';
import { useApi } from '@/utils/api';

/**
 * 从后端获取当前用户上下文。
 * 这包括有关当前认证模式、用户身份（如果已认证）以及关联的密钥/凭证元数据的信息。
 * @returns 一个解析为 UserContext 对象的 Promise。
 */
export async function getCurrentUserContext(): Promise<UserContext> {
  const { get } = useApi(); // 在函数内部调用 useApi
  try {
    // 注意：useApi 返回的 get 等方法已经处理了 response.data
    const userContext = await get<UserContext>('/auth/current');
    return userContext;
  } catch (error) {
    console.error('获取当前用户上下文时出错:', error);
    // 根据错误处理策略，重新抛出或返回默认/错误上下文
    // 目前重新抛出以使问题可见。
    throw error;
  }
}

// 未来可以添加登录、注销、密码验证等函数
// export async function loginUser(credentials: LoginPayload): Promise<UserContext> {
//   const { post } = useApi();
//   return post<UserContext>('/auth/login', credentials);
// }
// export async function logoutUser(): Promise<void> {
//   const { post } = useApi();
//   await post<void>('/auth/logout', {});
// }