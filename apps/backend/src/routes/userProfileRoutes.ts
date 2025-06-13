import Elysia, { t } from 'elysia'; // <--- 确保导入 t
import { z } from 'zod';
import { DatabaseService, USERS_UID_DEFAULT } from '../services/DatabaseService';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import type { UserContext, DefaultUserIdentity } from '@comfytavern/types';
import type { AuthContext } from '../middleware/authMiddleware';
import type { Context as ElysiaContext } from 'elysia';

// Zod schema for detailed validation inside handler
const UpdateUsernamePayloadZodSchema = z.object({
  username: z.string().min(1, { message: '用户名不能为空' }).max(50, { message: '用户名不能超过50个字符' }),
});

// Elysia's TypeBox schema for route definition (matches Zod structure for consistency)
const UpdateUsernamePayloadElysiaSchema = t.Object({
  username: t.String({ minLength: 1, maxLength: 50, error: '用户名长度必须在 1 到 50 个字符之间' }),
});

// 定义路由处理函数期望的完整上下文类型
// 注意：如果 body 由 Elysia 的 t schema 验证，其类型会是 Static<typeof UpdateUsernamePayloadElysiaSchema>
// 但如果我们在内部用 Zod 解析，body 初始可能是 unknown 或基于 t 的类型
type UserProfileRouteContext = ElysiaContext & AuthContext & {
  store: any;
  DatabaseService: typeof DatabaseService;
  // body: unknown; // 或者更具体的基于 Elysia t 的类型，但我们会在内部用 Zod
};

export const userProfileRoutes = new Elysia({ prefix: '/api/users/me' })
  .decorate('DatabaseService', DatabaseService)
  .put(
    '/username',
    async (context) => { // 移除参数解构，直接用 context
      const { body, DatabaseService, userContext, set } = context as UserProfileRouteContext & { body: unknown }; // 断言 body 为 unknown

      if (!userContext) {
        set.status = 401; // Unauthorized
        return { error: '用户未认证' };
      }

      const validationResult = UpdateUsernamePayloadZodSchema.safeParse(body);
      if (!validationResult.success) {
        set.status = 400;
        return { error: '无效的请求体', details: validationResult.error.flatten() };
      }
      const { username: newUsername } = validationResult.data;

      const typedUserContext = userContext as UserContext;

      if (typedUserContext.mode !== 'LocalNoPassword' && typedUserContext.mode !== 'LocalWithPassword') {
        set.status = 403; // Forbidden
        return { error: '此操作仅在本地单用户模式下可用' };
      }
      
      const currentUser = typedUserContext.currentUser as DefaultUserIdentity | null;

      if (!currentUser || currentUser.id !== USERS_UID_DEFAULT) {
        set.status = 403; // Forbidden
        return { error: '无法修改非默认用户的用户名或用户身份不正确' };
      }

      const db = DatabaseService.getDb();

      try {
        const result = await db
          .update(schema.users)
          .set({ username: newUsername, updatedAt: new Date().toISOString() })
          .where(eq(schema.users.uid, USERS_UID_DEFAULT))
          .returning({ updatedId: schema.users.uid, updatedUsername: schema.users.username });

        if (result.length === 0) {
          set.status = 404;
          return { error: '默认用户未找到，无法更新用户名' };
        }
        
        console.log(`[UserProfileRoutes] Default user's username updated to: ${result[0].updatedUsername}`);
        return { success: true, message: '用户名更新成功', username: result[0].updatedUsername };
      } catch (error) {
        console.error('[UserProfileRoutes] Error updating username:', error);
        set.status = 500;
        return { error: '更新用户名时发生内部错误' };
      }
    },
    {
      body: UpdateUsernamePayloadElysiaSchema, // <--- 使用 Elysia t schema
      detail: {
        summary: '更新当前默认用户的用户名 (仅限本地模式)',
        tags: ['User Profile'],
      },
    }
  );