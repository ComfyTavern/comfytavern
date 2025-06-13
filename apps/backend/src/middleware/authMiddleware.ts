import { Elysia, type Context as ElysiaContext } from 'elysia';
import { AuthService } from '../services/AuthService';
import type { UserContext, DefaultUserIdentity, AuthenticatedMultiUserIdentity } from '@comfytavern/types';

// 定义将通过中间件添加到 Elysia 上下文的属性类型
export interface AuthContext {
  userContext: UserContext | null;
  authError: Error | null;
}

// Elysia 插件风格的中间件定义
export const authMiddleware = new Elysia({ name: 'authMiddleware', seed: 'comfytavern.auth' })
    .decorate('AuthService', AuthService) // AuthService 类本身被装饰到上下文中
    .derive(async (
        // 修正 elysiaCtx 类型：AuthService 应该直接在上下文的第一级
        elysiaCtx: ElysiaContext & { store: any; AuthService: typeof AuthService }
      ) => {
      // 从上下文中解构 request 和 AuthService (它现在是类，因为我们装饰的是类)
      const { request, AuthService: AuthServiceFromCtx } = elysiaCtx;
      let derivedUserContext: UserContext | null = null;
      let derivedAuthError: Error | null = null;

      try {
        const authorizationHeader = request.headers.get('Authorization');

        if (authorizationHeader && authorizationHeader.toLowerCase().startsWith('bearer ')) {
          const apiKeySecret = authorizationHeader.substring(7);
          
          // AuthServiceFromCtx 是 AuthService 类，其方法是静态的
          const authenticatedUserIdentity = await AuthServiceFromCtx.authenticateViaApiKey(apiKeySecret);
          
          if (authenticatedUserIdentity) {
            const userId = 'id' in authenticatedUserIdentity
              ? (authenticatedUserIdentity as DefaultUserIdentity).id
              : (authenticatedUserIdentity as AuthenticatedMultiUserIdentity).uid;
            console.log(`[AuthMiddleware] User authenticated via API Key (user ID: ${userId}). Context construction for API key auth needs full implementation.`);
            // TODO: 真正基于 API Key 认证的用户身份去构建 UserContext
            derivedUserContext = await AuthServiceFromCtx.getUserContext(elysiaCtx);
          } else {
            console.log('[AuthMiddleware] API Key provided but authentication failed or not implemented.');
          }
        }

        if (!derivedUserContext) {
          // 如果没有通过 API Key 认证，则正常获取用户上下文
          derivedUserContext = await AuthServiceFromCtx.getUserContext(elysiaCtx);
        }

      } catch (error) {
        console.error('[AuthMiddleware] Error during user context derivation:', error);
        derivedAuthError = error instanceof Error ? error : new Error(String(error));
      }
      
      return {
        userContext: derivedUserContext,
        authError: derivedAuthError,
      }; // Elysia 会自动推断返回类型并合并到上下文中
    });

/*
  // 可选的 onBeforeHandle 钩子示例 (已注释掉)
  // .onBeforeHandle((context) => {
  //   const { userContext, authError, set, path, request } = context as ElysiaContext & AuthContext & { store: any; decorator: { AuthService: typeof AuthService }};
  //   // ... (检查逻辑)
  // });
*/

// 使用方法 (在 apps/backend/src/index.ts 中):
// import { authMiddleware } from './middleware/authMiddleware';
// const app = new Elysia()
//   .use(authMiddleware)
// ;