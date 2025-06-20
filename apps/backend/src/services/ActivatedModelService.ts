import { DatabaseService } from './DatabaseService';
import type { ActivatedModelInfo } from '@comfytavern/types';
import { activatedModels } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from '../db/schema';

/**
 * 负责管理用户激活的模型列表 (activatedModels 表) 的 CRUD 操作。
 * 此服务不处理模型发现逻辑。
 */
export class ActivatedModelService {
  private db: BunSQLiteDatabase<typeof schema>;

  constructor() {
    this.db = DatabaseService.getDb();
  }

  /**
   * 向用户的激活列表添加一个新模型。
   * @param userId - 操作用户的 ID。
   * @param modelInfo - 要添加的模型信息。
   * @returns 添加后的模型信息。
   */
  async addModel(userId: string, modelInfo: Omit<ActivatedModelInfo, 'userId'>): Promise<ActivatedModelInfo> {
    // TODO: 实现具体的数据库插入逻辑
    console.log(`[ActivatedModelService] Adding model ${modelInfo.modelId} for user ${userId}`);
    // 占位实现
    const newModel: ActivatedModelInfo = {
      ...modelInfo,
      userId,
    };
    return newModel;
  }

  /**
   * 根据模型 ID 获取单个激活的模型信息。
   * @param userId - 操作用户的 ID。
   * @param modelId - 模型的 ID。
   * @returns 找到的模型信息，如果不存在则返回 null。
   */
  async getModel(userId: string, modelId: string): Promise<ActivatedModelInfo | null> {
    // TODO: 实现具体的数据库查询逻辑
    console.log(`[ActivatedModelService] Getting model ${modelId} for user ${userId}`);
    // 占位实现
    return null;
  }

  /**
   * 列出指定用户的所有激活模型。
   * @param userId - 操作用户的 ID。
   * @returns 该用户的所有激活模型列表。
   */
  async listModels(userId: string): Promise<ActivatedModelInfo[]> {
    // TODO: 实现具体的数据库查询逻辑
    console.log(`[ActivatedModelService] Listing models for user ${userId}`);
    // 占位实现
    return [];
  }

  /**
   * 更新一个已存在的激活模型信息。
   * @param userId - 操作用户的 ID。
   * @param modelId - 要更新的模型的 ID。
   * @param updates - 要更新的字段。
   * @returns 更新后的模型信息。
   */
  async updateModel(userId: string, modelId: string, updates: Partial<Omit<ActivatedModelInfo, 'modelId' | 'userId'>>): Promise<ActivatedModelInfo | null> {
    // TODO: 实现具体的数据库更新逻辑
    console.log(`[ActivatedModelService] Updating model ${modelId} for user ${userId}`);
    // 占位实现
    return null;
  }

  /**
   * 从用户的激活列表删除一个模型。
   * @param userId - 操作用户的 ID。
   * @param modelId - 要删除的模型的 ID。
   * @returns 如果删除成功则返回 true，否则返回 false。
   */
  async deleteModel(userId: string, modelId: string): Promise<boolean> {
    // TODO: 实现具体的数据库删除逻辑
    console.log(`[ActivatedModelService] Deleting model ${modelId} for user ${userId}`);
    // 占位实现
    return true;
  }
}