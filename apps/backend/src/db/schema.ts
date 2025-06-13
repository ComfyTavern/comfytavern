import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// 用户表 (主要在多用户共享模式下活跃使用)
// 在单用户模式下，会包含一条 uid='default_user' 的占位记录以维护外键约束。
export const users = sqliteTable('users', {
  uid: text('uid').primaryKey(), // 用户唯一标识符 (多用户模式下为 UUID，单用户模式下为 'default_user')
  username: text('username').notNull().unique(), // 用户名 (单用户模式下可为 'default_user' 或可配置名称)
  passwordHash: text('password_hash'), // 用户密码的哈希值 (多用户模式下 NOT NULL，单用户模式下可为 NULL)
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false), // 是否为管理员 (仅多用户模式有意义)
  createdAt: text('created_at').notNull(), // 用户记录创建时间 (ISO 8601)
});

// 服务 API 密钥表
export const serviceApiKeys = sqliteTable('service_api_keys', {
  id: text('id').primaryKey(), // 密钥的唯一ID (例如 UUID)
  userId: text('user_id').notNull().references(() => users.uid, { onDelete: 'cascade' }), // 关联的用户ID (users.uid)
  name: text('name'), // 用户为密钥设置的可选名称/备注
  prefix: text('prefix').notNull(), // 密钥的前几位字符，用于UI展示和识别
  hashedKey: text('hashed_key').notNull().unique(), // 完整密钥的强哈希值
  scopes: text('scopes'), // (预留) 权限范围 (存储为 JSON 字符串数组)
  createdAt: text('created_at').notNull(), // 密钥创建时间 (ISO 8601)
  lastUsedAt: text('last_used_at'), // 密钥最后成功使用时间 (ISO 8601, 可选)
});

// 外部服务凭证表
export const externalCredentials = sqliteTable('external_credentials', {
  id: text('id').primaryKey(), // 凭证的唯一ID (例如 UUID)
  userId: text('user_id').notNull().references(() => users.uid, { onDelete: 'cascade' }), // 关联的用户ID (users.uid)
  serviceName: text('service_name').notNull(), // 凭证对应的服务标识符 (e.g., "openai", "anthropic_claude")
  displayName: text('display_name'), // 用户为凭证设置的可选显示名称/备注
  displayHint: text('display_hint'), // 用于UI安全展示凭证的部分信息 (存储为 JSON 对象, e.g., {"prefix": "sk-...", "suffix": "...AbCd"})
  encryptedCredential: text('encrypted_credential').notNull(), // 使用主加密密钥加密后的完整凭证内容
  createdAt: text('created_at').notNull(), // 凭证创建时间 (ISO 8601)
}, (table) => {
  return {
    // 确保同一用户对于同一服务，凭证的显示名称是唯一的 (如果display_name允许为空，则可能需要调整此约束)
    // Drizzle ORM/SQLite 对于 NULLABLE 字段的 UNIQUE 约束通常意味着 NULL 值不冲突
    // 此处我们假设 (user_id, service_name, display_name) 组合必须唯一，如果 display_name 为空，则 (user_id, service_name) 必须唯一
    // SQLite 通常将 NULL 视为不同值，所以 (uid, service, NULL) 和 (uid, service, NULL) 不会冲突。
    // 如果需要更严格的控制（例如，一个用户对一个服务只能有一个未命名凭证），可能需要在应用层面处理或使用更复杂的 SQL 约束。
    // 为简单起见，这里先不添加复合唯一约束，或依赖应用层逻辑。
    // 如果要添加，类似：
    // import { uniqueIndex } from 'drizzle-orm/sqlite-core';
    // uniqueUserServiceDisplayName: uniqueIndex('unique_user_service_display_name_idx').on(table.userId, table.serviceName, table.displayName),
  };
});

// 定义关系 (可选，但推荐用于类型安全查询和 ORM 功能)
export const usersRelations = relations(users, ({ many }) => ({
  serviceApiKeys: many(serviceApiKeys),
  externalCredentials: many(externalCredentials),
}));

export const serviceApiKeysRelations = relations(serviceApiKeys, ({ one }) => ({
  user: one(users, {
    fields: [serviceApiKeys.userId],
    references: [users.uid],
  }),
}));

export const externalCredentialsRelations = relations(externalCredentials, ({ one }) => ({
  user: one(users, {
    fields: [externalCredentials.userId],
    references: [users.uid],
  }),
}));