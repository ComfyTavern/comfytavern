import Elysia, { t } from 'elysia'; // <--- 确保导入 t
import { z } from 'zod';
import path from 'node:path';
import { promises as fs } from 'node:fs'; // + 重新导入 fs
import { fileURLToPath } from 'node:url';
import { DatabaseService, USERS_UID_DEFAULT } from '../services/DatabaseService';
import { ensureDirExists, getAvatarsDir } from '../utils/fileUtils';
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

// Elysia t schema for avatar upload
const UploadAvatarPayloadElysiaSchema = t.Object({
  avatar: t.File({
    maxSize: '5m', // 5MB
    types: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    error: '头像文件必须是图片格式 (jpg, png, gif, webp)，且大小不超过 5MB。'
  })
});

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
  ) // 注意：这里结束了 .put('/username', ...) 的调用，下一个路由从这里开始链式调用
  .post(
    '/avatar',
    async (context) => {
      // Schema 验证已恢复，Elysia 会确保 body.avatar 是 File 类型 (如果验证通过)
      // 因此，在函数开始处进行一次解构
      const { body, DatabaseService, userContext, set } = context as UserProfileRouteContext & { body: { avatar: File } };

      // 之前的 if (body && body.avatar) 检查现在由 Elysia 的 schema 验证处理。
      // 如果 schema 验证失败，此处理器函数不会执行。
      // 如果 schema 通过，body.avatar 必然存在且符合类型。

      // 调试日志已移除
      // console.log('[后端] 头像上传处理器执行。接收到的文件 (经 schema 验证):', {
      //   name: body.avatar.name,
      //   type: body.avatar.type,
      //   size: body.avatar.size,
      // });

      if (!userContext) {
        set.status = 401; // Unauthorized
        return { error: '用户未认证' };
      }

      const typedUserContext = userContext as UserContext;
      let userUid: string | undefined;
      const currentUser = typedUserContext.currentUser;
      if (currentUser) {
        if ('uid' in currentUser && typeof currentUser.uid === 'string') {
          userUid = currentUser.uid;
        } else if ('id' in currentUser && typeof currentUser.id === 'string') {
          userUid = currentUser.id;
        }
      }

      if (!userUid) {
        set.status = 403;
        return { error: '无法确定用户身份' };
      }
      
      const avatarFile = body.avatar as File; // 经过手动验证，可以安全断言

      // 注意：原有的 avatarFile.name 和 avatarFile.size 检查已包含在手动验证逻辑中
      // if (!avatarFile || typeof avatarFile.name !== 'string' || avatarFile.size === 0) { ... }

      // 1. 确定并确保头像目录存在
      const avatarsDir = getAvatarsDir();
      try {
        await ensureDirExists(avatarsDir);
      } catch (dirError: any) {
        console.error(`[UserProfileRoutes:AvatarUpload] 确保头像目录失败: ${avatarsDir}`, dirError.message);
        set.status = 500;
        return { error: '处理头像目录失败' };
      }

      // 2. 生成文件名和路径
      const fileExtension = path.extname(avatarFile.name) || '.png'; // Default to .png if no extension
      // Using userUid ensures that each user has at most one avatar, overwriting the old one.
      const filename = `${userUid}${fileExtension}`;
      const filePath = path.join(avatarsDir, filename);

      // 4. 保存文件
      try {
        // Elysia's File object has arrayBuffer() method
        await fs.writeFile(filePath, Buffer.from(await avatarFile.arrayBuffer()));
      } catch (saveError: any) {
        console.error(`[UserProfileRoutes:AvatarUpload] 保存头像文件失败: ${filePath}`, saveError.message);
        set.status = 500;
        return { error: '保存头像文件失败' };
      }

      // 5. 更新数据库
      const avatarUrl = `/avatars/${filename}`; // URL path for client access
      const db = DatabaseService.getDb();
      try {
        const result = await db
          .update(schema.users)
          .set({ avatarUrl: avatarUrl, updatedAt: new Date().toISOString() })
          .where(eq(schema.users.uid, userUid))
          .returning({ updatedId: schema.users.uid, newAvatarUrl: schema.users.avatarUrl });

        if (result.length === 0) {
          set.status = 404;
          // If user was authenticated, they should exist. This might indicate a deeper issue.
          // Attempt to delete the uploaded file if DB update fails for a non-existent user.
          try { await fs.unlink(filePath); } catch (e) { /* ignore cleanup error */ }
          return { error: '用户未找到，无法更新头像URL' };
        }
        
        console.log(`[UserProfileRoutes:AvatarUpload] User ${userUid} avatar updated to: ${result[0].newAvatarUrl}`);
        return { success: true, message: '头像上传成功', avatarUrl: result[0].newAvatarUrl };

      } catch (dbError: any) {
        console.error(`[UserProfileRoutes:AvatarUpload] 更新数据库头像URL失败 for user ${userUid}`, dbError.message);
        set.status = 500;
        // Attempt to delete the orphaned file if DB update fails
        try { await fs.unlink(filePath); } catch (e) { /* ignore cleanup error */ }
        return { error: '更新头像信息时发生数据库错误' };
      }
    },
    {
      body: UploadAvatarPayloadElysiaSchema, // <--- 恢复 Schema 验证
      // async parse(context, contentType) { // 调试代码，可以注释或移除
      //   console.log('[后端 Parse Hook] 收到的 Content-Type:', contentType);
      //   if (contentType && contentType.startsWith('multipart/form-data')) {
      //     console.log('[后端 Parse Hook] 这是一个 multipart/form-data 请求。');
      //     const headers: Record<string, string> = {};
      //     context.request.headers.forEach((value, key) => {
      //       headers[key] = value;
      //     });
      //     console.log('[后端 Parse Hook] 请求头:', JSON.stringify(headers, null, 2));
      //   }
      //   return undefined;
      // },
      detail: {
        summary: '上传或更新当前用户的头像', // 恢复原始摘要
        tags: ['User Profile'],
      },
    }
  );