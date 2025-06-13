import type { Config } from 'drizzle-kit';

export default {
  dialect: "sqlite", // 指定 SQL 方言
  schema: './apps/backend/src/db/schema.ts', // 指向您的数据库 schema 文件
  out: './apps/backend/drizzle/migrations',    // 迁移文件的输出目录
  dbCredentials: {
    url: 'file:./data/app.sqlite',             // 数据库文件的路径 (使用 file: 协议)
  },
  verbose: true,                               // 启用详细日志输出
  strict: true,                                // 启用严格模式
} satisfies Config;