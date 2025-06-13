import { Elysia, t } from 'elysia';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { and, eq } from 'drizzle-orm'; // 导入 and 和 eq

import type { AuthContext } from '../middleware/authMiddleware';
import { DatabaseService } from '../services/DatabaseService';
import { CryptoService } from '../services/CryptoService';
import * as schema from '../db/schema'; // 导入数据库 schema
import { 
  ServiceApiKeyMetadata,
  ServiceApiKeyWithSecret,
  // StoredServiceApiKey, // StoredServiceApiKey 接口用于类型提示，实际插入时用符合表结构的对象
  AuthenticatedMultiUserIdentity, // 用于类型检查
  DefaultUserIdentity,
  ExternalCredentialMetadata, // 用于类型检查
  // Zod schemas for response validation (optional, can be added later)
  // ServiceApiKeyMetadataZodSchema, 
  // ServiceApiKeyWithSecretZodSchema
} from '@comfytavern/types';

// Zod Schema for creating a service API key request body
const CreateServiceApiKeyBodySchema = z.object({
  name: z.string().trim().min(1, "Key name cannot be empty if provided.").max(100, "Key name too long.").optional(),
  scopes: z.array(z.string()).optional().default([]), // Default to empty array
});

// 服务 API 密钥前缀
const SERVICE_API_KEY_PREFIX = 'ctsk_'; // ComfyTavern Service Key

export const userKeysRoutes = new Elysia({ prefix: '/api/users/me', name: 'user-keys-routes', seed: 'comfy.userkeys.v1' })
  // --- 服务 API 密钥管理 (Service API Keys) ---
  .group('/service-keys', (group) =>
    group
      .get('/',
        async (context) => {
          const { userContext, authError } = context as unknown as AuthContext;
          if (authError || !userContext || !userContext.currentUser) {
            context.set.status = authError ? 500 : 401;
            return { error: authError?.message || 'Unauthorized: No current user in context.' };
          }

          // 正确获取 userId
          const currentUser = userContext.currentUser;
          const userId = 'id' in currentUser ? currentUser.id : (currentUser as AuthenticatedMultiUserIdentity).uid;

          if (!userId) { // 理论上 currentUser 存在时，id 或 uid 也应该存在
            context.set.status = 400; // 或者 500，因为这是上下文构建的问题
            return { error: 'User ID not found in current user context.' };
          }
          
          try {
            const db = DatabaseService.getDb();
            const keysFromDb = await db.query.serviceApiKeys.findMany({
              where: (fields, { eq }) => eq(fields.userId, userId),
              columns: { hashedKey: false, userId: false }, // Exclude sensitive/redundant data
              orderBy: (fields, { desc }) => [desc(fields.createdAt)], // 按创建时间降序
            });

            const metadataList: ServiceApiKeyMetadata[] = keysFromDb.map(k => ({
              id: k.id,
              name: k.name ?? undefined,
              prefix: k.prefix,
              scopes: k.scopes ? JSON.parse(k.scopes) : [],
              createdAt: k.createdAt,
              lastUsedAt: k.lastUsedAt ?? undefined,
            }));
            return { keys: metadataList };
          } catch (error) {
            console.error(`[UserKeysRoutes] Error fetching service API keys for user ${userId}:`, error);
            context.set.status = 500;
            return { error: 'Failed to fetch service API keys due to an internal error.' };
          }
        },
        {
          detail: { summary: 'List all Service API Keys for the current user', tags: ['User Keys Management'] },
          // response: { 200: t.Object({ keys: t.Array(ServiceApiKeyMetadataZodSchema) }) } // TODO: Zod schema for response
        }
      )
      .post('/',
        async (context) => {
          const { userContext, authError, body } = context as unknown as AuthContext & { body: unknown };
          if (authError || !userContext || !userContext.currentUser) {
            context.set.status = authError ? 500 : 401;
            return { error: authError?.message || 'Unauthorized: No current user in context.' };
          }

          const validationResult = CreateServiceApiKeyBodySchema.safeParse(body);
          if (!validationResult.success) {
            context.set.status = 400; // Bad Request
            return { error: 'Invalid request body for creating service API key.', details: validationResult.error.flatten() };
          }
          const { name, scopes } = validationResult.data;

          const currentUser = userContext.currentUser;
          const userId = 'id' in currentUser ? currentUser.id : (currentUser as AuthenticatedMultiUserIdentity).uid;
          if (!userId) {
            context.set.status = 400;
            return { error: 'User ID not found in current user context.' };
          }

          try {
            const db = DatabaseService.getDb();
            const apiKeyId = randomUUID();
            // 生成更安全的密钥: crypto.randomBytes(32).toString('base64url')
            // 但为了可读性和前缀，我们组合一下
            const randomPart = Buffer.from(randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')).toString('base64url').slice(0, 43); // 约32字节的base64url
            const apiKeySecretFull = SERVICE_API_KEY_PREFIX + randomPart; 
            const apiKeyPrefix = apiKeySecretFull.substring(0, SERVICE_API_KEY_PREFIX.length + 8); // e.g., ctsk_AbCdEfGh
            
            const hashedKey = await CryptoService.hash(apiKeySecretFull);
            const createdAt = new Date().toISOString();

            // StoredServiceApiKey 类型用于指导，实际插入的是符合表结构的对象
            const newKeyRecord = {
              id: apiKeyId,
              userId: userId,
              name: name, // Zod schema ensures name is string or undefined
              prefix: apiKeyPrefix,
              hashedKey: hashedKey,
              scopes: JSON.stringify(scopes), // scopes 来自 Zod, 默认为 []
              createdAt: createdAt,
              lastUsedAt: null, // 初始化为 null
            };

            await db.insert(schema.serviceApiKeys).values(newKeyRecord);
            
            const response: ServiceApiKeyWithSecret = {
              id: apiKeyId,
              name: name,
              prefix: apiKeyPrefix,
              scopes: scopes,
              createdAt: createdAt,
              secret: apiKeySecretFull, // 返回完整密钥，仅此一次
            };
            context.set.status = 201; // Created
            return response;

          } catch (error) {
            console.error(`[UserKeysRoutes] Error creating service API key for user ${userId}:`, error);
            context.set.status = 500;
            return { error: 'Failed to create service API key due to an internal error.' };
          }
        },
        {
          // 使用 Elysia 的 t 类型进行基础的请求体验证，Zod 用于更细致的内部验证
          body: t.Object(
            {
              name: t.Optional(t.String({ minLength: 1, maxLength: 100, error: "Key name must be between 1 and 100 characters if provided." })),
              scopes: t.Optional(t.Array(t.String()))
            },
            { additionalProperties: false } // 不允许额外的属性
          ),
          detail: { summary: 'Create a new Service API Key for the current user', tags: ['User Keys Management'] },
          // response: { 201: ServiceApiKeyWithSecretZodSchema } // TODO: Zod schema for response
        }
      )
      .delete('/:keyId',
        async (context) => {
          const { userContext, authError, params } = context as unknown as AuthContext & { params: { keyId: string } };
          if (authError || !userContext || !userContext.currentUser) {
            context.set.status = authError ? 500 : 401;
            return { error: authError?.message || 'Unauthorized: No current user in context.' };
          }

          const { keyId } = params;
          // 基本的 keyId 验证
          if (!keyId || typeof keyId !== 'string' || keyId.trim() === '') {
            context.set.status = 400; // Bad Request
            return { error: 'Invalid or missing keyId parameter.' };
          }

          const currentUser = userContext.currentUser;
          const userId = 'id' in currentUser ? currentUser.id : (currentUser as AuthenticatedMultiUserIdentity).uid;
          if (!userId) {
            context.set.status = 400; // Bad Request or 500 if context is malformed
            return { error: 'User ID not found in current user context.' };
          }

          try {
            const db = DatabaseService.getDb();
            // 首先验证密钥是否存在且属于该用户
            const keyRecord = await db.query.serviceApiKeys.findFirst({
              where: (fields, { eq, and }) => and(eq(fields.id, keyId), eq(fields.userId, userId)),
              columns: { id: true } // 只需要确认存在性
            });

            if (!keyRecord) {
              context.set.status = 404; // Not Found
              return { error: 'Service API Key not found or access denied.' };
            }

            // 执行删除操作
            const deleteResult = await db.delete(schema.serviceApiKeys)
              .where(and(
                eq(schema.serviceApiKeys.id, keyId),
                eq(schema.serviceApiKeys.userId, userId)
              ))
              .returning({ id: schema.serviceApiKeys.id }); // Optional: check if delete actually happened

            if (deleteResult.length === 0) {
                // 这理论上不应该发生，因为我们上面已经用 findFirst 检查过了
                console.warn(`[UserKeysRoutes] Key ${keyId} for user ${userId} was found but delete operation affected 0 rows.`);
                context.set.status = 404; // Or 500, as this indicates an inconsistency
                return { error: 'Service API Key found but could not be deleted.' };
            }
            
            context.set.status = 204; // No Content
            return; // 204 响应不应有主体
          } catch (error) {
            console.error(`[UserKeysRoutes] Error deleting service API key ${keyId} for user ${userId}:`, error);
            context.set.status = 500;
            return { error: 'Failed to delete service API key due to an internal error.' };
          }
        },
        {
          params: t.Object({
            keyId: t.String({
              minLength: 1,
              error: "keyId parameter cannot be empty.",
              // Potentially add format validation if keyId is UUID, e.g., using t.RegExp
            })
          }),
          detail: { summary: 'Delete a specific Service API Key for the current user', tags: ['User Keys Management'] },
          response: {
            204: t.Void(), // No content on success
            400: t.Object({ error: t.String(), details: t.Optional(t.Any()) }),
            401: t.Object({ error: t.String() }),
            404: t.Object({ error: t.String() }),
            500: t.Object({ error: t.String() })
          }
        }
      )
    // TODO: Implement PUT /{keyId} (optional for updating name/scopes)
    // .put('/:keyId', async (context) => { /* ... */ }, { params: t.Object({ keyId: t.String() }), body: ... })
  )
  // --- 外部服务凭证管理 (External Service Credentials) ---
  .group('/credentials', (group) =>
    group
      .get('/',
        async (context) => {
          const { userContext, authError } = context as unknown as AuthContext;
          if (authError || !userContext || !userContext.currentUser) {
            context.set.status = authError ? 500 : 401;
            return { error: authError?.message || 'Unauthorized: No current user in context.' };
          }
          const currentUser = userContext.currentUser;
          const userId = 'id' in currentUser ? currentUser.id : (currentUser as AuthenticatedMultiUserIdentity).uid;

          if (!userId) {
            context.set.status = 400;
            return { error: 'User ID not found in current user context.' };
          }

          try {
            const db = DatabaseService.getDb();
            const credentialsFromDb = await db.query.externalCredentials.findMany({
              where: (fields, { eq }) => eq(fields.userId, userId),
              columns: { encryptedCredential: false, userId: false }, // Exclude sensitive data
              orderBy: (fields, { desc }) => [desc(fields.createdAt)],
            });

            const metadataList: ExternalCredentialMetadata[] = credentialsFromDb.map(c => ({
              id: c.id,
              serviceName: c.serviceName,
              displayName: c.displayName ?? undefined,
              displayHint: c.displayHint ? JSON.parse(c.displayHint) : undefined, // displayHint is stored as JSON string
              createdAt: c.createdAt,
            }));
            return { credentials: metadataList };
          } catch (error) {
            console.error(`[UserKeysRoutes] Error fetching external credentials for user ${userId}:`, error);
            context.set.status = 500;
            return { error: 'Failed to fetch external credentials due to an internal error.' };
          }
        },
        {
          detail: { summary: 'List all External Service Credentials for the current user', tags: ['User Keys Management'] },
          // response: { 200: t.Object({ credentials: t.Array(ExternalCredentialMetadataZodSchema) }) } // TODO: Zod schema
        }
      )
      .post('/',
        async (context) => {
          const { userContext, authError, body } = context as unknown as AuthContext & { body: unknown };
          if (authError || !userContext || !userContext.currentUser) {
            context.set.status = authError ? 500 : 401;
            return { error: authError?.message || 'Unauthorized: No current user in context.' };
          }

          // Zod schema for request body validation
          const CreateExternalCredentialBodySchema = z.object({
            serviceName: z.string().trim().min(1, "Service name cannot be empty."),
            credential: z.string().min(1, "Credential content cannot be empty."),
            displayName: z.string().trim().min(1, "Display name cannot be empty if provided.").max(100).optional(),
          });

          const validationResult = CreateExternalCredentialBodySchema.safeParse(body);
          if (!validationResult.success) {
            context.set.status = 400; // Bad Request
            return { error: 'Invalid request body for creating external credential.', details: validationResult.error.flatten() };
          }
          const { serviceName, credential: plainCredential, displayName } = validationResult.data;

          const currentUser = userContext.currentUser;
          const userId = 'id' in currentUser ? currentUser.id : (currentUser as AuthenticatedMultiUserIdentity).uid;
          if (!userId) {
            context.set.status = 400;
            return { error: 'User ID not found in current user context.' };
          }

          try {
            const encryptedCredential = CryptoService.encryptCredential(plainCredential);
            const credentialId = randomUUID();
            const createdAt = new Date().toISOString();

            let displayHintObject;
            if (plainCredential && plainCredential.length > 8) {
              displayHintObject = {
                prefix: plainCredential.substring(0, 4),
                suffix: plainCredential.substring(plainCredential.length - 4),
              };
            } else if (plainCredential && plainCredential.length > 0) {
              displayHintObject = {
                prefix: plainCredential.substring(0, Math.min(4, plainCredential.length)),
                suffix: '',
              };
            }

            const newCredentialRecord = {
              id: credentialId,
              userId: userId,
              serviceName: serviceName,
              displayName: displayName,
              displayHint: displayHintObject ? JSON.stringify(displayHintObject) : null,
              encryptedCredential: encryptedCredential,
              createdAt: createdAt,
            };

            const db = DatabaseService.getDb();
            await db.insert(schema.externalCredentials).values(newCredentialRecord);

            const responseMetadata: ExternalCredentialMetadata = {
              id: credentialId,
              serviceName: serviceName,
              displayName: displayName,
              displayHint: displayHintObject,
              createdAt: createdAt,
            };
            context.set.status = 201; // Created
            return responseMetadata;

          } catch (error: any) {
            console.error(`[UserKeysRoutes] Error creating external credential for user ${userId}, service ${serviceName}:`, error);
            if (error.message && error.message.includes("Master Encryption Key (MEK) environment variable")) {
                 context.set.status = 503; // Service Unavailable
                 return { error: 'Cannot save credential due to missing server configuration (MEK). Please contact administrator.' };
            }
            context.set.status = 500;
            return { error: 'Failed to create external credential due to an internal error.' };
          }
        },
        {
          body: t.Object({ // Elysia's TypeBox schema for basic validation
            serviceName: t.String({ minLength: 1, error: "Service name cannot be empty."}),
            credential: t.String({ minLength: 1, error: "Credential content cannot be empty."}),
            displayName: t.Optional(t.String({ minLength:1, maxLength: 100, error: "Display name must be between 1 and 100 characters if provided." })),
          }, { additionalProperties: false }),
          detail: { summary: 'Add a new External Service Credential for the current user', tags: ['User Keys Management'] },
          // response: { 201: ExternalCredentialMetadataZodSchema } // TODO: Zod schema
        }
      )
      .delete('/:credentialId',
        async (context) => {
          const { userContext, authError, params } = context as unknown as AuthContext & { params: { credentialId: string } };
          if (authError || !userContext || !userContext.currentUser) {
            context.set.status = authError ? 500 : 401;
            return { error: authError?.message || 'Unauthorized: No current user in context.' };
          }

          const { credentialId } = params;
          if (!credentialId || typeof credentialId !== 'string' || credentialId.trim() === '') {
            context.set.status = 400; // Bad Request
            return { error: 'Invalid or missing credentialId parameter.' };
          }

          const currentUser = userContext.currentUser;
          const userId = 'id' in currentUser ? currentUser.id : (currentUser as AuthenticatedMultiUserIdentity).uid;
          if (!userId) {
            context.set.status = 400;
            return { error: 'User ID not found in current user context.' };
          }

          try {
            const db = DatabaseService.getDb();
            // Verify credential exists and belongs to the user before deleting
            const credentialToDelete = await db.query.externalCredentials.findFirst({
              where: (fields, { eq, and }) => and(eq(fields.id, credentialId), eq(fields.userId, userId)),
              columns: { id: true } // Only need to confirm existence
            });

            if (!credentialToDelete) {
              context.set.status = 404; // Not Found
              return { error: 'External Service Credential not found or access denied.' };
            }

            const deleteResult = await db.delete(schema.externalCredentials)
              .where(and(
                eq(schema.externalCredentials.id, credentialId),
                eq(schema.externalCredentials.userId, userId)
              ))
              .returning({ id: schema.externalCredentials.id });

            if (deleteResult.length === 0) {
              // This case should ideally not be reached if findFirst above succeeded and no race condition
              console.warn(`[UserKeysRoutes] Credential ${credentialId} for user ${userId} was found by findFirst but delete operation affected 0 rows.`);
              context.set.status = 404; // Or 500, as it indicates an inconsistency
              return { error: 'Credential found but could not be deleted (unexpected state).' };
            }
            
            context.set.status = 204; // No Content
            return; // No body for 204 response
          } catch (error) {
            console.error(`[UserKeysRoutes] Error deleting external credential ${credentialId} for user ${userId}:`, error);
            context.set.status = 500;
            return { error: 'Failed to delete external credential due to an internal error.' };
          }
        },
        {
          params: t.Object({
            credentialId: t.String({
              minLength: 1,
              error: "credentialId parameter cannot be empty."
              // Consider adding format validation if credentialId is expected to be a UUID, e.g., using t.RegExp or a custom type
            })
          }),
          detail: { summary: 'Delete a specific External Service Credential for the current user', tags: ['User Keys Management'] },
          response: { // Define expected responses for documentation and potentially for stricter validation
            204: t.Void(),
            400: t.Object({ error: t.String(), details: t.Optional(t.Any()) }), // For validation errors
            401: t.Object({ error: t.String() }), // For authentication errors
            404: t.Object({ error: t.String() }), // For resource not found
            500: t.Object({ error: t.String() })  // For internal server errors
          }
        }
      )
    // TODO: Implement PUT /{credentialId} (optional for updating name/credential content)
    // .put('/:credentialId', async (context) => { /* ... */ }, { params: t.Object({ credentialId: t.String() }), body: ... })
  );