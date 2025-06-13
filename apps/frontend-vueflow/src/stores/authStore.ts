import { defineStore } from 'pinia';
import type {
  UserContext,
  ServiceApiKeyMetadata,
  ExternalCredentialMetadata,
  CreateServiceApiKeyPayload,
  ServiceApiKeyWithSecret, // 用于创建密钥后的临时展示
  CreateExternalCredentialPayload,
  StoredExternalCredential, // 用于创建凭证后的返回
} from '@comfytavern/types';
import { getCurrentUserContext } from '@/api/authApi';
import {
  // listServiceApiKeys, // UserContext 已包含，如果需要独立刷新可以取消注释
  createServiceApiKey,
  deleteServiceApiKey,
  // listExternalCredentials, // UserContext 已包含
  createExternalCredential,
  deleteExternalCredential,
} from '@/api/userKeysApi';
import { updateDefaultUsername } from '@/api/userProfileApi'; // + 导入更新用户名的 API 调用

interface AuthState {
  userContext: UserContext | null;
  isLoadingContext: boolean;
  contextError: unknown | null; // 更具体的错误类型可以后续定义
  // 临时存储新创建的 API key secret，方便UI展示后清除
  newlyCreatedApiKeySecret: string | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    userContext: null,
    isLoadingContext: false,
    contextError: null,
    newlyCreatedApiKeySecret: null,
  }),

  getters: {
    isAuthenticated(state): boolean {
      if (!state.userContext) return false;
      // 根据不同模式判断认证状态
      switch (state.userContext.mode) {
        case 'LocalNoPassword':
          return state.userContext.isAuthenticated; // 总是 true
        case 'LocalWithPassword':
          return state.userContext.isAuthenticatedWithGlobalPassword;
        case 'MultiUserShared':
          return state.userContext.isAuthenticated;
        default:
          // 此处理论上不可达，因为 UserContext 的所有已知模式都已处理。
          // 如果 UserContext 联合类型未来添加新成员而未在此处更新，
          // TypeScript 会在 state.userContext.mode 上给出类型错误。
          return false;
      }
    },
    currentUser(state) {
      return state.userContext?.currentUser || null;
    },
    currentMode(state) {
      return state.userContext?.mode || null;
    },
    serviceApiKeys(state): ServiceApiKeyMetadata[] {
      return state.userContext?.currentUser?.serviceApiKeys || [];
    },
    externalCredentials(state): ExternalCredentialMetadata[] {
      return state.userContext?.currentUser?.externalCredentials || [];
    },
  },

  actions: {
    async fetchUserContext() {
      this.isLoadingContext = true;
      this.contextError = null;
      this.newlyCreatedApiKeySecret = null; // 清除旧的密钥
      try {
        const context = await getCurrentUserContext();
        this.userContext = context;
      } catch (error) {
        console.error('获取用户上下文失败:', error);
        this.contextError = error;
        this.userContext = null; // 或者设置为一个表示错误的上下文对象
      } finally {
        this.isLoadingContext = false;
      }
    },

    async createNewApiKey(payload: CreateServiceApiKeyPayload): Promise<ServiceApiKeyWithSecret | null> {
      // this.isLoadingContext = true; // 可以用更细粒度的 loading 状态
      try {
        const newKey = await createServiceApiKey(payload);
        this.newlyCreatedApiKeySecret = newKey.secret; // 存储密钥供UI显示
        await this.fetchUserContext(); // 刷新整个上下文以获取更新后的列表
        return newKey;
      } catch (error) {
        console.error('创建 API 密钥失败:', error);
        // this.contextError = error; // 可以用更细粒度的 error 状态
        throw error; // 让调用者处理
      } finally {
        // this.isLoadingContext = false;
      }
    },

    async removeApiKey(keyId: string) {
      try {
        await deleteServiceApiKey(keyId);
        await this.fetchUserContext(); // 刷新上下文
      } catch (error) {
        console.error('删除 API 密钥失败:', error);
        throw error;
      }
    },

    async addNewCredential(payload: CreateExternalCredentialPayload): Promise<StoredExternalCredential | null> {
      try {
        const newCredential = await createExternalCredential(payload);
        await this.fetchUserContext(); // 刷新上下文
        return newCredential; // 返回创建的凭证元数据
      } catch (error) {
        console.error('创建外部凭证失败:', error);
        throw error;
      }
    },

    async removeCredential(credentialId: string) {
      try {
        await deleteExternalCredential(credentialId);
        await this.fetchUserContext(); // 刷新上下文
      } catch (error) {
        console.error('删除外部凭证失败:', error);
        throw error;
      }
    },

    // 用于UI显示后清除密钥
    clearNewlyCreatedApiKeySecret() {
      this.newlyCreatedApiKeySecret = null;
    },

    async updateUsername(newUsername: string): Promise<{ success: boolean; message: string; username?: string }> {
      if (!this.userContext || !this.currentUser || (this.currentMode !== 'LocalNoPassword' && this.currentMode !== 'LocalWithPassword')) {
        console.warn('[AuthStore] updateUsername called in invalid state or mode.');
        return { success: false, message: '无法更新用户名：无效的状态或模式。' };
      }
      // 理论上，在这些模式下，currentUser.id 总是 'default_user'
      // 后端 API 会做最终校验

      try {
        const response = await updateDefaultUsername({ username: newUsername });
        if (response.success) {
          await this.fetchUserContext(); // 成功后刷新整个用户上下文
        }
        return response; // 返回 API 的原始响应
      } catch (error: any) {
        console.error('更新用户名失败 (store action):', error);
        // error 可能已经是 { success: false, message: string } 的结构
        return error && typeof error.message === 'string'
          ? { success: false, message: error.message, ...(error.details && { details: error.details }) }
          : { success: false, message: '更新用户名时发生未知错误。' };
      }
    },
  },
});