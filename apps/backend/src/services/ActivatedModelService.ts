import { DatabaseService } from './DatabaseService';
import type { ActivatedModelInfo } from '@comfytavern/types';
import { activatedModels } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from '../db/schema';

/**
 * 负责管理用户激活的模型列表 (activatedModels 表) 的 CRUD 操作。
 */
export class ActivatedModelService {
  private db: BunSQLiteDatabase<typeof schema>;

  constructor() {
    this.db = DatabaseService.getDb();
  }

  async getActivatedModels({ userId }: { userId: string }): Promise<ActivatedModelInfo[]> {
    const results = await this.db.select()
      .from(activatedModels)
      .where(eq(activatedModels.userId, userId))
      .orderBy(desc(activatedModels.createdAt)); // 按创建时间降序排序
    return results as ActivatedModelInfo[];
  }

  async getActivatedModel(modelId: string): Promise<ActivatedModelInfo | null> {
    const result = await this.db.select().from(activatedModels).where(eq(activatedModels.modelId, modelId)).get();
    return (result as ActivatedModelInfo) ?? null;
  }

  async addActivatedModel(modelInfo: ActivatedModelInfo): Promise<void> {
    const valuesToSave = {
      ...modelInfo,
      createdAt: new Date().toISOString(),
    };
    await this.db.insert(activatedModels).values(valuesToSave).onConflictDoUpdate({
      target: activatedModels.modelId,
      set: valuesToSave,
    });
  }

  async updateActivatedModel(modelInfo: ActivatedModelInfo): Promise<void> {
    await this.db.update(activatedModels)
      .set(modelInfo)
      .where(eq(activatedModels.modelId, modelInfo.modelId));
  }

  async deleteActivatedModel(modelId: string): Promise<void> {
    await this.db.delete(activatedModels).where(eq(activatedModels.modelId, modelId));
  }
}