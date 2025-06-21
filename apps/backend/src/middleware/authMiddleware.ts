import { Elysia, type Context as ElysiaContext } from 'elysia';
import { AuthService } from '../services/AuthService';
import type { UserContext } from '@comfytavern/types';

export interface AuthContext {
  userContext: UserContext | null;
  authError: { message: string; name?: string; stack?: string } | null;
}

export function applyAuthMiddleware(app: Elysia): Elysia {
  app
    .decorate('AuthService', AuthService)
    .derive(async (elysiaCtx: ElysiaContext & { store: any; AuthService: typeof AuthService }) => {
      const { request, AuthService: AuthServiceFromCtx } = elysiaCtx;
      
      try {
        // 将认证逻辑完全委托给 AuthService
        const userContext = await AuthServiceFromCtx.getUserContext(elysiaCtx);
        return { userContext, authError: null };
      } catch (error) {
        const authError = error instanceof Error ? error : new Error(String(error));
        const authErrorInfo = {
          message: authError.message,
          name: authError.name,
          stack: authError.stack
        };
        // 如果获取上下文失败，userContext 为 null，并提供错误信息
        return { userContext: null, authError: authErrorInfo };
      }
    });
  return app;
}