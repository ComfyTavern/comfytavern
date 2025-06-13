// apps/backend/src/services/DatabaseService.ts
import { drizzle, BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
// import { migrate } from 'drizzle-orm/bun-sqlite/migrator'; // 迁移功能后续添加
import { Database } from 'bun:sqlite';
import path from 'node:path';
import fs from 'node:fs/promises';

import * as schema from '../db/schema';
import { PROJECTS_BASE_DIR } from '../config'; // 仍然需要它来定位项目根目录

// 常量可以后续移到专门的文件，例如 src/constants/userConstants.ts
export const USERS_UID_DEFAULT = 'default_user';
export const USERNAME_DEFAULT = '本地用户'; // 或从配置读取

// 数据库文件路径配置
// PROJECTS_BASE_DIR 指向 e:/rc20/ComfyTavern/projects
// 我们希望数据库在 e:/rc20/ComfyTavern/data/app.sqlite
const DATA_DIR = path.resolve(PROJECTS_BASE_DIR, '..', 'data'); // 从 projects 目录回退一级到根，然后进入 data
const DB_FILE_PATH = path.join(DATA_DIR, 'app.sqlite');

let dbInstance: BunSQLiteDatabase<typeof schema>;

async function ensureDbDirectoryExists(): Promise<void> {
  try {
    await fs.access(DATA_DIR);
  } catch (error) {
    // 类型守卫，确保 error 是一个有 code属性的对象 (例如 NodeJS.ErrnoException)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      console.log(`[DatabaseService] Data directory not found (${DATA_DIR}), creating...`);
      await fs.mkdir(DATA_DIR, { recursive: true });
    } else {
      console.error(`[DatabaseService] Error accessing data directory ${DATA_DIR}:`, error);
      throw error; // 如果不是 ENOENT，则重新抛出错误
    }
  }
}

export class DatabaseService {
  static async initialize(
    currentUserMode: 'LocalNoPassword' | 'LocalWithPassword' | 'MultiUserShared'
  ): Promise<void> {
    if (dbInstance) {
      console.warn('[DatabaseService] Database already initialized.');
      return;
    }

    await ensureDbDirectoryExists();

    const sqlite = new Database(DB_FILE_PATH);
    // Bun.gc(false); // 尝试禁用GC，看是否解决Bun SQLite的某些问题，如果不需要可以移除

    dbInstance = drizzle(sqlite, { schema, logger: process.env.NODE_ENV === 'development' }); // 开发模式下启用日志

    // TODO: 运行 Drizzle migrations
    // const migrationsFolder = path.resolve(PROJECTS_BASE_DIR, '../drizzle/migrations'); // 假设迁移文件在项目根目录的 drizzle/migrations 文件夹
    // console.log(`[DatabaseService] Running migrations from: ${migrationsFolder}`);
    // try {
    //   await migrate(dbInstance, { migrationsFolder });
    //   console.log('[DatabaseService] Migrations applied successfully.');
    // } catch (err) {
    //   console.error('[DatabaseService] Error applying migrations:', err);
    // }
    console.log('[DatabaseService] Migrations step skipped for now.');


    if (currentUserMode === 'LocalNoPassword' || currentUserMode === 'LocalWithPassword') {
      await this.ensureDefaultUserExists();
    }

    console.log(`[DatabaseService] Initialized successfully for mode: ${currentUserMode}. DB Path: ${DB_FILE_PATH}`);
  }

  private static async ensureDefaultUserExists(): Promise<void> {
    if (!dbInstance) {
      // 这个检查理论上是多余的，因为 initialize 会先赋值 dbInstance
      // 但作为防御性措施保留
      console.error("[DatabaseService] ensureDefaultUserExists called before DB initialization.");
      throw new Error("Database not initialized. Call DatabaseService.initialize() first.");
    }
    try {
      const existingUser = await dbInstance.query.users.findFirst({
        where: (usersTable, { eq }) => eq(usersTable.uid, USERS_UID_DEFAULT),
      });

      if (!existingUser) {
        console.log(`[DatabaseService] Default user ('${USERS_UID_DEFAULT}') not found, creating...`);
        await dbInstance.insert(schema.users).values({
          uid: USERS_UID_DEFAULT,
          username: USERNAME_DEFAULT,
          passwordHash: null, // 在单用户模式下，密码哈希可以为NULL
          isAdmin: false, // 单用户模式下，isAdmin 无实际意义
          createdAt: new Date().toISOString(),
        });
        console.log(`[DatabaseService] Default user ('${USERS_UID_DEFAULT}') created.`);
      } else {
        console.log(`[DatabaseService] Default user ('${USERS_UID_DEFAULT}') already exists.`);
      }
    } catch (error) {
      console.error('[DatabaseService] Error ensuring default user exists:', error);
      // 根据具体需求决定是否抛出错误。如果默认用户创建失败可能导致应用无法正常运行，则应抛出。
      // throw error;
    }
  }

  public static getDb(): BunSQLiteDatabase<typeof schema> {
    if (!dbInstance) {
      console.error('[DatabaseService] Database not initialized when getDb() was called. This should not happen if initialize() was called at startup.');
      throw new Error('Database not initialized. Call DatabaseService.initialize() first.');
    }
    return dbInstance;
  }

  // 可选：添加一个关闭数据库连接的方法
  // static async close(): Promise<void> {
  //   const db = dbInstance?.session?.client; // BunSQLiteDatabase 可能没有 session 属性，直接用 client
  //   if (db && typeof db.close === 'function') {
  //     db.close();
  //     console.log('[DatabaseService] Database connection closed.');
  //   }
  // }
}