// 模块顶层日志已移除
// console.log(`[DEBUG AuthService.ts module] File parsed/re-parsed at: ${new Date().toISOString()}`);

import {
  LocalNoPasswordUserContext,
  DefaultUserIdentity,
  ServiceApiKeyMetadata,
  ExternalCredentialMetadata,
  UserContext,
  LocalWithPasswordUserContext,
  MultiUserSharedContext,
  AuthenticatedMultiUserIdentity,
} from '@comfytavern/types'; // 从 packages/types 导入
import { DatabaseService, USERS_UID_DEFAULT, USERNAME_DEFAULT } from './DatabaseService';
import { MULTI_USER_MODE, ACCESS_PASSWORD_HASH, SINGLE_USER_PATH } from '../config'; // 用于确定模式

export class AuthService {
  private static currentMode: 'LocalNoPassword' | 'LocalWithPassword' | 'MultiUserShared';

  // 模块加载时自动初始化，以确定当前操作模式
  static {
    if (MULTI_USER_MODE) {
      this.currentMode = 'MultiUserShared';
    } else {
      if (ACCESS_PASSWORD_HASH && ACCESS_PASSWORD_HASH.trim() !== '') {
        this.currentMode = 'LocalWithPassword';
      } else {
        this.currentMode = 'LocalNoPassword';
      }
    }
    console.log(`[AuthService] Initialized. Current operation mode: ${this.currentMode}`);
  }

  public static getCurrentOperationMode(): 'LocalNoPassword' | 'LocalWithPassword' | 'MultiUserShared' {
    return this.currentMode;
  }

  /**
   * 获取当前请求的用户上下文。
   * @param ElysiaContext (可选) Elysia 的上下文对象，用于未来提取 token, cookie, session 等。
   *                     例如: { request: Request, cookie: Record<string, any>, set: any }
   */
  static async getUserContext(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    elysiaContext?: any
  ): Promise<UserContext> {
    // 新增日志：方法执行的绝对入口点
    console.log(`[AuthService.getUserContext] Method execution started (absolute entry) at: ${new Date().toISOString()}`);
    const mode = this.currentMode;
    // 日志，打印 getUserContext 方法开始时获取到的 mode 值
    console.log(`[AuthService.getUserContext] Method invoked. Current mode determined as: '${mode}'`);

    try {
      if (mode === 'LocalNoPassword') {
        const db = DatabaseService.getDb();
        const defaultUserRecord = await db.query.users.findFirst({
          where: (users, { eq }) => eq(users.uid, USERS_UID_DEFAULT),
          with: {
            serviceApiKeys: {
              // Exclude sensitive/redundant fields from metadata
              columns: { hashedKey: false, userId: false },
            },
            externalCredentials: {
              // Exclude sensitive/redundant fields from metadata
              columns: { encryptedCredential: false, userId: false },
            },
          },
        });

        // 新增日志，检查从数据库查询到的原始记录
        // console.log('[AuthService.getUserContext] Raw defaultUserRecord from DB:', JSON.stringify(defaultUserRecord, null, 2));

        if (!defaultUserRecord) {
          console.error('[AuthService] CRITICAL: Default user not found in database for LocalNoPassword mode. DatabaseService might not have initialized correctly.');
          throw new Error('Default user_not_found_critical'); // Specific error code
        }

        const defaultUserIdentity: DefaultUserIdentity = {
          id: USERS_UID_DEFAULT,
          username: defaultUserRecord.username || USERNAME_DEFAULT,
          avatarUrl: defaultUserRecord.avatarUrl || undefined, // 从数据库记录中获取 avatarUrl
          serviceApiKeys: (defaultUserRecord.serviceApiKeys || []).map(k => ({
            id: k.id,
            name: k.name ?? undefined,
            prefix: k.prefix,
            scopes: k.scopes ? JSON.parse(k.scopes) : [], // Default to empty array if null/undefined
            createdAt: k.createdAt,
            lastUsedAt: k.lastUsedAt ?? undefined,
          }) as ServiceApiKeyMetadata),
          externalCredentials: (defaultUserRecord.externalCredentials || []).map(c => ({
            id: c.id,
            serviceName: c.serviceName,
            displayName: c.displayName ?? undefined,
            displayHint: c.displayHint ? JSON.parse(c.displayHint) : undefined,
            createdAt: c.createdAt,
          }) as ExternalCredentialMetadata),
        };

        const context: LocalNoPasswordUserContext = {
          mode: 'LocalNoPassword',
          multiUserMode: false,
          accessPasswordRequired: false,
          isAuthenticated: true, // Always authenticated in this mode
          currentUser: defaultUserIdentity,
        };
        return context;
      } else if (mode === 'LocalWithPassword') {
        // TODO: Implement LocalWithPassword mode context construction
        // This will involve checking a session cookie for global password authentication.
        // For now, return a basic unauthenticated state or a placeholder.
        console.warn('[AuthService] LocalWithPassword mode context construction is not fully implemented.');
        const placeholderContext: LocalWithPasswordUserContext = {
            mode: 'LocalWithPassword',
            multiUserMode: false,
            accessPasswordRequired: true,
            isAuthenticatedWithGlobalPassword: false, // Placeholder: assume not authenticated
            currentUser: null, // Placeholder
        };
        // Potentially, if an API key is used, it could bypass global password for programmatic access.
        // That logic would be here or in a middleware.
        return placeholderContext; // Fallback for now
      } else { // MultiUserShared
        // TODO: Implement MultiUserShared mode context construction
        // This will involve checking user login session (e.g., Lucia Auth).
        console.warn('[AuthService] MultiUserShared mode context construction is not fully implemented.');
         const placeholderContext: MultiUserSharedContext = {
            mode: 'MultiUserShared',
            multiUserMode: true,
            isAuthenticated: false, // Placeholder
            currentUser: null, // Placeholder
        };
        return placeholderContext; // Fallback for now
      }
    } catch (error) {
      console.error(`[AuthService] Error constructing UserContext for mode '${mode}':`, error);
      // Return a generic error state or rethrow, depending on desired app behavior
      // For now, rethrowing to make issues visible during development.
      if (error instanceof Error && error.message === 'Default user_not_found_critical') {
        // Potentially handle this specific critical error differently, e.g., by trying to re-init default user
      }
      throw new Error(`Failed to construct user context for mode ${mode}.`);
    }
  }

  // Placeholder for API key authentication logic, to be called by middleware
  public static async authenticateViaApiKey(apiKeySecret: string): Promise<DefaultUserIdentity | AuthenticatedMultiUserIdentity | null> {
    // 1. Hash the provided apiKeySecret
    // 2. Query 'serviceApiKeys' table for the hashedKey
    // 3. If found, retrieve the associated user_id
    // 4. Fetch user details from 'users' table
    // 5. Construct and return DefaultUserIdentity or AuthenticatedMultiUserIdentity
    // This is a simplified placeholder
    console.warn('[AuthService] authenticateViaApiKey not yet implemented.', apiKeySecret.substring(0,5) + "...");
    return null;
  }
}