import { DatabaseService } from './DatabaseService';
import type { ApiCredentialConfig } from '@comfytavern/types';
import { apiChannels } from '../db/schema';
import { eq, and } from 'drizzle-orm';
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

  async getCredentials(refName: string): Promise<ApiCredentialConfig | null> {
    const result = await this.db.select().from(apiChannels).where(eq(apiChannels.refName, refName)).get();
    return (result as ApiCredentialConfig) ?? null;
  }
  
  async getCredentialsById(id: string): Promise<ApiCredentialConfig | null> {
    const result = await this.db.select().from(apiChannels).where(eq(apiChannels.id, id)).get();
    return (result as ApiCredentialConfig) ?? null;
  }

  async saveCredentials(config: ApiCredentialConfig): Promise<void> {
    const valuesToSave = {
      ...config,
      id: config.id || crypto.randomUUID(),
      createdAt: config.createdAt || new Date().toISOString(),
    };

    await this.db.insert(apiChannels).values(valuesToSave).onConflictDoUpdate({
      target: apiChannels.id,
      set: valuesToSave,
    });
  }

  async deleteCredentials(refName: string): Promise<void> {
    await this.db.delete(apiChannels).where(eq(apiChannels.refName, refName));
  }
}