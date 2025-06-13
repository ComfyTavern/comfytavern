import { Elysia, t } from 'elysia';
import { AuthService } from '../services/AuthService';
import type { AuthContext } from '../middleware/authMiddleware'; // 导入注入到上下文的类型
import type { UserContext } from '@comfytavern/types'; // 导入 UserContext 类型用于响应

export const authRoutes = new Elysia({ prefix: '/api/auth', name: 'auth-routes', seed: 'comfytavern.auth.routes' })
  .get('/current',
    async (context) => {
      const { userContext, authError } = context as unknown as AuthContext; // 类型断言访问中间件注入的属性

      if (authError) {
        console.error('[AuthRoutes] Error relayed from authMiddleware for /api/auth/current:', authError);
        context.set.status = 500;
        return { error: 'Failed to determine user context due to an internal error.', details: authError.message };
      }

      if (!userContext) {
        console.error('[AuthRoutes] User context is unexpectedly null in /api/auth/current route after authMiddleware.');
        context.set.status = 500;
        return { error: 'User context not available or not determined.' };
      }

      // 直接返回由 AuthService 构建并由中间件注入的 UserContext
      context.set.status = 200;
      return userContext as UserContext; // 明确返回类型
    },
    {
      detail: {
        summary: 'Get Current User Context',
        description: 'Retrieves the current user authentication status and context, determined by the application mode and session/token. This is crucial for the frontend to adapt its UI and behavior.',
        tags: ['Authentication'],
      },
      // response: { // Zod/TypeBox schema for UserContext can be very complex due to the union type.
      //   // Elysia typically infers response types. If strict validation is needed, define a Zod schema.
      //   // For now, relying on TypeScript types and Elysia's inference.
      //   200: t.Object({}, { additionalProperties: true }), // Placeholder for a generic object, ideally UserContext schema
      //   500: t.Object({ error: t.String(), details: t.Optional(t.String()) })
      // }
    }
  );

// 未来可以添加其他认证相关的路由:
// .post('/login', async ({ body, cookie, store }) => { /* ... */ }, {
//   body: t.Object({ username: t.String(), password: t.String() }),
//   detail: { tags: ['Authentication'], summary: 'User Login (Multi-User Mode)' }
// })
// .post('/register', async ({ body }) => { /* ... */ }, {
//   body: t.Object({ username: t.String(), password: t.String() }),
//   detail: { tags: ['Authentication'], summary: 'User Registration (Multi-User Mode)' }
// })
// .post('/logout', async ({ cookie, store }) => { /* ... */ }, {
//   detail: { tags: ['Authentication'], summary: 'User Logout (Multi-User Mode)' }
// })
// .post('/verify-global-password', async ({ body, cookie }) => { /* ... */ }, {
//   body: t.Object({ password: t.String() }),
//   detail: { tags: ['Authentication'], summary: 'Verify Global Access Password (LocalWithPassword Mode)' }
// })
// .post('/setup-global-password', async ({ body }) => { /* ... */ }, {
//   body: t.Object({ password: t.String() }),
//   detail: { tags: ['Authentication'], summary: 'Setup Initial Global Access Password (LocalWithPassword Mode)' }
// });