import { Elysia, t } from 'elysia';
import { applyAuthMiddleware, type AuthContext } from '../middleware/authMiddleware';
import { ApiConfigService } from '../services/ApiConfigService';
import { ActivatedModelService } from '../services/ActivatedModelService';
import { LlmApiAdapterRegistry } from '../services/LlmApiAdapterRegistry';
import type { UserContext } from '@comfytavern/types';

// 这是一个临时的辅助函数，实际项目中应该有更健壮的 ID 生成策略
const generateId = () => `ch_${Date.now()}${Math.random().toString(36).substring(2, 9)}`;

// 从 fileManagerRoutes.ts 借鉴的辅助函数
function getUserIdFromContext(userContext: UserContext | null): string | null {
  if (!userContext || !userContext.currentUser) {
    return null;
  }
  const currentUser = userContext.currentUser;
  // 优先检查 'uid' (用于 MultiUser)
  if ("uid" in currentUser && typeof currentUser.uid === "string") {
    return currentUser.uid;
  }
  // 然后检查 'id' (用于 LocalUser, 包括 "default_user")
  if ("id" in currentUser && typeof currentUser.id === "string") {
    return currentUser.id;
  }
  return null;
}

export const llmConfigRoutes = (
  apiConfigService: ApiConfigService,
  activatedModelService: ActivatedModelService,
  llmApiAdapterRegistry: LlmApiAdapterRegistry
) => {
  const app = new Elysia();
  applyAuthMiddleware(app); // Apply the auth middleware to a generic instance

  // Now, group the routes with the prefix
  return new Elysia({ prefix: '/api/llm' })
    .use(app) // Use the instance that has the auth middleware
    .get('/providers', () => {
      return llmApiAdapterRegistry.getAvailableProviders();
    })
    // API Channels Endpoints
    .group('/channels', (app) => app
      .get('/', async (context) => {
        const { userContext } = context as unknown as AuthContext;
        const userId = getUserIdFromContext(userContext);
        if (!userId) throw new Error('Authentication required.');
        return await apiConfigService.getAllCredentials(userId);
      })
      .post('/', async (context) => {
        const { body, userContext } = context as unknown as AuthContext & { body: any };
        const userId = getUserIdFromContext(userContext);
        if (!userId) throw new Error('Authentication required.');
        const newChannel = {
          ...body,
          id: generateId(),
          userId: userId,
          createdAt: new Date().toISOString(),
        };
        const savedChannel = await apiConfigService.saveCredentials(newChannel);
        return savedChannel;
      }, {
        body: t.Object({
          label: t.String(),
          providerId: t.Optional(t.String()),
          adapterType: t.Optional(t.String()),
          baseUrl: t.String(),
          apiKey: t.String(),
          supportedModels: t.Optional(t.Array(t.String())),
          storageMode: t.Optional(t.Enum({ plaintext: 'plaintext', encrypted: 'encrypted' })),
          customHeaders: t.Optional(t.Record(t.String(), t.String())),
          modelListEndpoint: t.Optional(t.String()),
          disabled: t.Optional(t.Boolean()),
        })
      })
      .put('/:id', async (context) => {
        const { params, body, userContext } = context as unknown as AuthContext & { params: { id: string }, body: any };
        const userId = getUserIdFromContext(userContext);
        if (!userId) throw new Error('Authentication required.');
        const existingChannel = await apiConfigService.getCredentialsById(params.id);
        if (!existingChannel || existingChannel.userId !== userId) {
          throw new Error('Channel not found or access denied.');
        }
        const updatedChannel = { ...existingChannel, ...body, id: params.id };
        const savedChannel = await apiConfigService.saveCredentials(updatedChannel);
        return savedChannel;
      }, {
        body: t.Object({
          label: t.Optional(t.String()),
          providerId: t.Optional(t.String()),
          adapterType: t.Optional(t.String()),
          baseUrl: t.Optional(t.String()),
          apiKey: t.Optional(t.String()),
          supportedModels: t.Optional(t.Array(t.String())),
          storageMode: t.Optional(t.Enum({ plaintext: 'plaintext', encrypted: 'encrypted' })),
          customHeaders: t.Optional(t.Record(t.String(), t.String())),
          modelListEndpoint: t.Optional(t.String()),
          disabled: t.Optional(t.Boolean()),
        })
      })
      .delete('/:id', async (context) => {
        const { params, userContext } = context as unknown as AuthContext & { params: { id: string } };
        const userId = getUserIdFromContext(userContext);
        if (!userId) throw new Error('Authentication required.');
        // We need a way to get channel by ID to verify ownership before deleting
        const existingChannel = await apiConfigService.getCredentialsById(params.id);
         if (!existingChannel || existingChannel.userId !== userId) {
          throw new Error('Channel not found or access denied.');
        }
        await apiConfigService.deleteCredentials(params.id); // deleteCredentials now uses id
        return { success: true, id: params.id };
      })
      .post('/:channelId/discover-models', async (context) => {
          const { params, userContext } = context as unknown as AuthContext & { params: { channelId: string } };
          const userId = getUserIdFromContext(userContext);
          if (!userId) throw new Error('Authentication required.');
          const { channelId } = params;
          const channelConfig = await apiConfigService.getCredentialsById(channelId);

          if (!channelConfig || channelConfig.userId !== userId) {
              throw new Error('Channel not found or access denied.');
          }

          const adapterType = channelConfig.adapterType || 'openai';
          const adapter = llmApiAdapterRegistry.getAdapter(adapterType);

          if (!adapter) {
              throw new Error(`Adapter of type "${adapterType}" not found.`);
          }

          const models = await adapter.listModels({
              base_url: channelConfig.baseUrl,
              api_key: channelConfig.apiKey,
              custom_headers: channelConfig.customHeaders,
          });

          return models;
      })
    )
    // Activated Models Endpoints
    .group('/models', (app) => app
      .get('/', async (context) => {
          const { userContext } = context as unknown as AuthContext;
          const userId = getUserIdFromContext(userContext);
          if (!userId) throw new Error('Authentication required.');
          return await activatedModelService.getActivatedModels({ userId: userId });
      })
      .post('/', async (context) => {
          const { body, userContext } = context as unknown as AuthContext & { body: any };
          const userId = getUserIdFromContext(userContext);
          if (!userId) throw new Error('Authentication required.');
          const newModel = { ...body, userId: userId };
          await activatedModelService.addActivatedModel(newModel);
          return newModel;
      }, {
          body: t.Object({
              modelId: t.String(),
              displayName: t.String(),
              capabilities: t.Array(t.String()),
              modelType: t.Optional(t.Enum({ llm: 'llm', embedding: 'embedding', unknown: 'unknown' })),
              // Add other fields from ActivatedModelInfo
          })
      })
      .put('/:modelId', async (context) => {
          const { params, body, userContext } = context as unknown as AuthContext & { params: { modelId: string }, body: any };
          const userId = getUserIdFromContext(userContext);
          if (!userId) throw new Error('Authentication required.');
          const modelId = decodeURIComponent(params.modelId);
          const existingModel = await activatedModelService.getActivatedModel(modelId);
          if (!existingModel || existingModel.userId !== userId) {
              throw new Error('Model not found or access denied.');
          }
          const updatedModel = { ...existingModel, ...body, modelId };
          await activatedModelService.updateActivatedModel(updatedModel);
          return updatedModel;
      }, {
           body: t.Object({
              displayName: t.Optional(t.String()),
              capabilities: t.Optional(t.Array(t.String())),
              // Add other updatable fields
          })
      })
      .delete('/:modelId', async (context) => {
          const { params, userContext } = context as unknown as AuthContext & { params: { modelId: string } };
          const userId = getUserIdFromContext(userContext);
          if (!userId) throw new Error('Authentication required.');
          const modelId = decodeURIComponent(params.modelId);
          // Optional: check ownership before deleting
          await activatedModelService.deleteActivatedModel(modelId);
          return { success: true, modelId };
      })
    );
}