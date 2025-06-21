import { DatabaseService } from './DatabaseService';
import type { ApiCredentialConfig } from '@comfytavern/types';
import { apiChannels } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from '../db/schema';

/**
 * 负责管理 API 渠道配置 (apiChannels 表) 的 CRUD 操作。
 */
export class ApiConfigService {
  private db: BunSQLiteDatabase<typeof schema>;

  constructor() {
    this.db = DatabaseService.getDb();
  }

  async getAllCredentials(userId: string): Promise<ApiCredentialConfig[]> {
    const results = await this.db.select().from(apiChannels).where(eq(apiChannels.userId, userId));
    return results as ApiCredentialConfig[];
  }

  async getCredentialsById(id: string): Promise<ApiCredentialConfig | null> {
    const result = await this.db.select().from(apiChannels).where(eq(apiChannels.id, id)).get();
    return (result as ApiCredentialConfig) ?? null;
  }

  async saveCredentials(config: ApiCredentialConfig): Promise<ApiCredentialConfig> {
    const id = config.id;
    if (!id) {
      throw new Error('[ApiConfigService] An ID must be provided to save credentials.');
    }

    const existingChannel = await this.getCredentialsById(id);

    if (existingChannel) {
      // --- UPDATE LOGIC ---
      console.log(`[ApiConfigService] Updating channel with ID: ${id}`);
      const { id: _, userId: __, createdAt: ___, ...dataToUpdate } = config;

      // 如果 apiKey 为空或未定义，则不更新它
      if (!config.apiKey) {
        delete (dataToUpdate as Partial<typeof dataToUpdate>).apiKey;
      }
      
      try {
        await this.db.update(apiChannels)
          .set(dataToUpdate)
          .where(eq(apiChannels.id, id));
        console.log(`[ApiConfigService] Channel ${id} updated successfully.`);
      } catch (error) {
        console.error(`[ApiConfigService] Database update failed for channel ${id}:`, error);
        // 重新抛出原始错误，以便由路由层处理
        throw error;
      }

    } else {
      // --- INSERT LOGIC ---
      console.log(`[ApiConfigService] Inserting new channel with ID: ${id}`);
      const dataToInsert = {
        ...config,
        id: id, // 明确 id 是 string
        storageMode: config.storageMode ?? 'plaintext',
        disabled: config.disabled ?? false,
        createdAt: config.createdAt || new Date().toISOString(),
      };
      await this.db.insert(apiChannels).values(dataToInsert);
      console.log(`[ApiConfigService] New channel ${id} inserted successfully.`);
    }

    // 返回完整、已保存的对象
    const savedChannel = await this.getCredentialsById(id);
    if (!savedChannel) {
      console.error(`[ApiConfigService] CRITICAL: Failed to retrieve channel ${id} immediately after saving.`);
      throw new Error('Failed to save or retrieve channel after operation.');
    }
    return savedChannel;
  }

  async deleteCredentials(id: string): Promise<void> {
    await this.db.delete(apiChannels).where(eq(apiChannels.id, id));
  }
}