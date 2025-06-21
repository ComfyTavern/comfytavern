// 模块顶层日志已移除
// console.log(`[DEBUG AuthService.ts module] File parsed/re-parsed at: ${new Date().toISOString()}`);

import {
  UserContext,
  UserIdentity,
  SingleUserContext,
  MultiUserContext,
  ServiceApiKeyMetadata,
  ExternalCredentialMetadata,
} from '@comfytavern/types'; // 从 packages/types 导入 (v4)
import { DatabaseService, USERS_UID_DEFAULT, USERNAME_DEFAULT } from './DatabaseService';
import { MULTI_USER_MODE, ACCESS_PASSWORD_HASH } from '../config';

type OperationMode = 'SingleUser' | 'MultiUser';

export class AuthService {
  private static currentMode: OperationMode;

  // 模块加载时自动初始化，以确定当前操作模式
  static {
    this.currentMode = MULTI_USER_MODE ? 'MultiUser' : 'SingleUser';
    console.log(`[AuthService] Initialized. Current operation mode: ${this.currentMode}`);
  }

  public static getCurrentOperationMode(): OperationMode {
    return this.currentMode;
  }

  /**
   * 获取当前请求的用户上下文。
   * @param ElysiaContext (可选) Elysia 的上下文对象，用于未来提取 token, cookie, session 等。
   *                     例如: { request: Request, cookie: Record<string, any>, set: any }
   */
  static async getUserContext(
    elysiaContext: any
  ): Promise<UserContext> {
    try {
      const authorizationHeader = elysiaContext?.request?.headers.get('Authorization');
      if (authorizationHeader && authorizationHeader.toLowerCase().startsWith('bearer ')) {
        const apiKeySecret = authorizationHeader.substring(7);
        const authenticatedUser = await this.authenticateViaApiKey(apiKeySecret);

        if (authenticatedUser) {
          // API Key 认证成功，构建一个基于该用户的上下文
          console.log(`[AuthService] Authenticated via API Key. User: ${authenticatedUser.uid}`);
          if (this.currentMode === 'SingleUser') {
            const context: SingleUserContext = {
              mode: 'SingleUser',
              multiUserMode: false,
              accessPasswordRequired: false, // API Key认证绕过密码检查
              isAuthenticated: true,
              currentUser: authenticatedUser,
            };
            return context;
          } else { // MultiUser
            const context: MultiUserContext = {
              mode: 'MultiUser',
              multiUserMode: true,
              isAuthenticated: true, // API Key认证成功
              currentUser: authenticatedUser,
            };
            return context;
          }
        }
        // 如果提供了API Key但认证失败，则抛出错误，阻止进一步操作
        throw new Error('Invalid API Key provided.');
      }

      // 如果没有提供API Key，则继续基于会话/模式的认证流程
      console.log(`[AuthService.getUserContext] No API Key. Proceeding with mode-based auth. Mode: '${this.currentMode}'`);

      if (this.currentMode === 'SingleUser') {
        const accessPasswordRequired = !!(ACCESS_PASSWORD_HASH && ACCESS_PASSWORD_HASH.trim() !== '');
        // TODO: Check session cookie for global password authentication
        const isAuthenticated = !accessPasswordRequired; // Simplified logic for now

        let currentUser: UserIdentity | null = null;
        if (isAuthenticated) {
          const db = DatabaseService.getDb();
          const defaultUserRecord = await db.query.users.findFirst({
            where: (users, { eq }) => eq(users.uid, USERS_UID_DEFAULT),
          });

          if (!defaultUserRecord) {
            throw new Error('Default user not found in database for SingleUser mode.');
          }

          const apiKeys = await db.query.serviceApiKeys.findMany({
            where: (keys, { eq }) => eq(keys.userId, defaultUserRecord.uid),
            columns: { hashedKey: false, userId: false },
          });

          const credentials = await db.query.externalCredentials.findMany({
            where: (creds, { eq }) => eq(creds.userId, defaultUserRecord.uid),
            columns: { encryptedCredential: false, userId: false },
          });

          currentUser = {
            uid: defaultUserRecord.uid,
            username: defaultUserRecord.username || USERNAME_DEFAULT,
            isAdmin: defaultUserRecord.isAdmin,
            createdAt: defaultUserRecord.createdAt,
            avatarUrl: defaultUserRecord.avatarUrl || undefined,
            serviceApiKeys: (apiKeys || []).map(k => ({
              id: k.id, name: k.name ?? undefined, prefix: k.prefix, scopes: k.scopes ? JSON.parse(k.scopes) : [], createdAt: k.createdAt, lastUsedAt: k.lastUsedAt ?? undefined,
            })),
            externalCredentials: (credentials || []).map(c => ({
              id: c.id, serviceName: c.serviceName, displayName: c.displayName ?? undefined, displayHint: c.displayHint ? JSON.parse(c.displayHint) : undefined, createdAt: c.createdAt,
            })),
          };
        }

        const context: SingleUserContext = {
          mode: 'SingleUser',
          multiUserMode: false,
          accessPasswordRequired,
          isAuthenticated,
          currentUser,
        };
        return context;

      } else { // MultiUser
        // TODO: Implement MultiUser mode context construction (checking user login session)
        console.warn('[AuthService] MultiUser mode context construction is not fully implemented.');
        const placeholderContext: MultiUserContext = {
          mode: 'MultiUser',
          multiUserMode: true,
          isAuthenticated: false,
          currentUser: null,
        };
        return placeholderContext;
      }
    } catch (error) {
      console.error(`[AuthService] Error constructing UserContext for mode '${this.currentMode}':`, error);
      // Return a generic error state or rethrow, depending on desired app behavior
      // For now, rethrowing to make issues visible during development.
      if (error instanceof Error && error.message === 'Default user_not_found_critical') {
        // Potentially handle this specific critical error differently, e.g., by trying to re-init default user
      }
      throw new Error(`Failed to construct user context for mode ${this.currentMode}.`);
    }
  }

  // Placeholder for API key authentication logic, to be called by middleware
  public static async authenticateViaApiKey(apiKeySecret: string): Promise<UserIdentity | null> {
    // 1. Hash the provided apiKeySecret
    // 2. Query 'serviceApiKeys' table for the hashedKey
    // 3. If found, retrieve the associated user_id
    // 4. Fetch user details from 'users' table
    // 5. Construct and return UserIdentity
    // This is a simplified placeholder
    console.warn('[AuthService] authenticateViaApiKey not yet implemented.', apiKeySecret.substring(0,5) + "...");
    return null;
  }
}