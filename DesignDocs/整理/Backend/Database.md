# 后端数据库交互与设计

本文档详细描述了 ComfyTavern 后端应用中与数据库交互相关的设计、表结构、服务以及迁移机制。

## 1. 数据库交互 (`apps/backend/src/db/`) 概览

后端应用的数据库交互逻辑主要集中在 [`apps/backend/src/db/`](apps/backend/src/db/) 目录及其相关服务中。

### 目录与文件职责

*   **`apps/backend/src/db/`**: 此目录是数据库模式定义的核心。
    *   **[`schema.ts`](apps/backend/src/db/schema.ts:1)**: 这是至关重要的文件，它使用 Drizzle ORM 的语法定义了所有数据库表的结构、字段属性、数据类型以及表之间的关系。它是数据库结构的“单一事实来源”。

### 技术选型

*   **ORM 工具**: 项目选用 [Drizzle ORM](https://orm.drizzle.team/) 作为主要的数据库对象关系映射工具。Drizzle ORM 以其类型安全、性能和灵活性著称。
*   **数据库类型**: 当前后端主要使用 **SQLite** 数据库。通过 [`bun:sqlite`](https://bun.sh/docs/api/sqlite) 和 Drizzle ORM 的 `drizzle-orm/bun-sqlite` 适配器进行交互，具体体现在 [`apps/backend/src/services/DatabaseService.ts`](apps/backend/src/services/DatabaseService.ts:1) 中。

## 2. 主要数据表结构 (`schema.ts`) 详解

以下是对 [`apps/backend/src/db/schema.ts`](apps/backend/src/db/schema.ts:1) 文件中定义的主要数据表的详细说明。

### 2.1. `users` 表

*   **实体描述**: 存储用户信息。在单用户模式下，通常包含一条 `uid='default_user'` 的占位记录以维护外键约束。在多用户共享模式下，则存储各个独立用户的信息。
*   **关键字段**:
    *   `uid`: `text` (主键) - 用户唯一标识符。多用户模式下为 UUID，单用户模式下固定为 `'default_user'`。
    *   `username`: `text` (非空, 唯一) - 用户名。
    *   `passwordHash`: `text` - 用户密码的哈希值。多用户模式下非空，单用户模式下可为空。
    *   `avatarUrl`: `text` (可选) - 用户头像的 URL。
    *   `isAdmin`: `integer` (布尔型, 非空, 默认 `false`) - 标记用户是否为管理员，主要在多用户模式下使用。
    *   `createdAt`: `text` (非空) - 用户记录创建时间 (ISO 8601 格式)。
    *   `updatedAt`: `text` (可选) - 用户记录最后更新时间 (ISO 8601 格式)。
*   **表间关系** (通过 `relations` 定义):
    *   与 `serviceApiKeys` 表存在一对多关系 (一个用户可以拥有多个服务 API 密钥)。
        ```typescript
        // import { relations } from 'drizzle-orm';
        // import { users, serviceApiKeys, externalCredentials } from './schema';

        export const usersRelations = relations(users, ({ many }) => ({
          serviceApiKeys: many(serviceApiKeys),
          externalCredentials: many(externalCredentials),
        }));
        ```
    *   与 `externalCredentials` 表存在一对多关系 (一个用户可以拥有多个外部服务凭证)。

### 2.2. `serviceApiKeys` 表

*   **实体描述**: 存储用户为本应用生成的服务 API 密钥，用于程序化访问。
*   **关键字段**:
    *   `id`: `text` (主键) - 密钥的唯一 ID (例如 UUID)。
    *   `userId`: `text` (非空, 外键) - 关联的用户 ID，引用 [`users.uid`](apps/backend/src/db/schema.ts:7)。删除用户时会级联删除其 API 密钥。
    *   `name`: `text` (可选) - 用户为密钥设置的可选名称或备注。
    *   `prefix`: `text` (非空) - 密钥的前几位字符，用于 UI 展示和快速识别。
    *   `hashedKey`: `text` (非空, 唯一) - 完整 API 密钥的强哈希值，用于验证，原始密钥不存储。
    *   `scopes`: `text` (可选, 预留) - 权限范围，存储为 JSON 字符串数组，用于未来可能的细粒度权限控制。
    *   `createdAt`: `text` (非空) - 密钥创建时间 (ISO 8601 格式)。
    *   `lastUsedAt`: `text` (可选) - 密钥最后成功使用的时间 (ISO 8601 格式)。
*   **表间关系** (通过 `relations` 定义):
    *   与 `users` 表存在多对一关系 (一个 API 密钥属于一个用户)。
        ```typescript
        // import { relations } from 'drizzle-orm';
        // import { users, serviceApiKeys } from './schema';

        export const serviceApiKeysRelations = relations(serviceApiKeys, ({ one }) => ({
          user: one(users, {
            fields: [serviceApiKeys.userId],
            references: [users.uid],
          }),
        }));
        ```

### 2.3. `externalCredentials` 表

*   **实体描述**: 存储用户配置的用于访问第三方外部服务（如 OpenAI, Anthropic 等）的凭证信息。凭证本身会进行加密存储。
*   **关键字段**:
    *   `id`: `text` (主键) - 凭证的唯一 ID (例如 UUID)。
    *   `userId`: `text` (非空, 外键) - 关联的用户 ID，引用 [`users.uid`](apps/backend/src/db/schema.ts:7)。删除用户时会级联删除其凭证。
    *   `serviceName`: `text` (非空) - 凭证对应的外部服务标识符 (例如 `"openai"`, `"anthropic_claude"`)。
    *   `displayName`: `text` (可选) - 用户为凭证设置的可选显示名称或备注。
    *   `displayHint`: `text` (可选) - 用于在 UI 安全展示凭证的部分信息，通常存储为 JSON 对象 (例如 `{"prefix": "sk-...", "suffix": "...AbCd"}`)。
    *   `encryptedCredential`: `text` (非空) - 使用应用主加密密钥加密后的完整凭证内容。
    *   `createdAt`: `text` (非空) - 凭证记录创建时间 (ISO 8601 格式)。
*   **表间关系** (通过 `relations` 定义):
    *   与 `users` 表存在多对一关系 (一个外部服务凭证属于一个用户)。
        ```typescript
        // import { relations } from 'drizzle-orm';
        // import { users, externalCredentials } from './schema';

        export const externalCredentialsRelations = relations(externalCredentials, ({ one }) => ({
          user: one(users, {
            fields: [externalCredentials.userId],
            references: [users.uid],
          }),
        }));
        ```

## 3. 数据库服务 (`DatabaseService.ts`)

[`apps/backend/src/services/DatabaseService.ts`](apps/backend/src/services/DatabaseService.ts:1) 是后端与数据库交互的核心服务。

### 核心职责

*   **封装数据库连接**: 负责建立和管理与 SQLite 数据库的连接。它确保数据库文件目录存在，并初始化 `BunSQLiteDatabase` 实例。
*   **提供 Drizzle 实例**: 通过 `getDb()`静态方法，向应用的其他服务模块（如 `AuthService`, `projectService` 等）提供一个统一的、配置好 schema 的 Drizzle ORM 实例。这使得其他服务可以使用类型安全的方式执行数据库的 CRUD (创建、读取、更新、删除) 操作。
*   **默认用户管理**: 在单用户模式下，`DatabaseService` 会确保存在一个默认用户记录 (`uid='default_user'`)。
*   **日志记录**: 在开发模式下，Drizzle ORM 的查询日志会被启用，方便调试。

### 其他服务如何使用

其他后端服务通常通过依赖注入（如果使用依赖注入容器）或直接调用 `DatabaseService.getDb()` 来获取 Drizzle 实例，然后使用该实例执行数据库操作。

例如，在 `AuthService` 中可能会这样使用：

```typescript
// 伪代码示例
import { DatabaseService } from './DatabaseService';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

class AuthService {
  private db = DatabaseService.getDb();

  async findUserByUsername(username: string) {
    return await this.db.query.users.findFirst({
      where: eq(users.username, username),
    });
  }
}
```

## 4. 数据库迁移 (Migrations)

数据库模式（schema）的演进和变更通过数据库迁移来管理。

*   **工具**: 项目使用 **Drizzle Kit**，这是 Drizzle ORM 官方提供的 CLI 工具，用于根据 [`schema.ts`](apps/backend/src/db/schema.ts:1) 中的定义生成 SQL 迁移脚本。
*   **迁移脚本**: 生成的迁移脚本（通常是 `.sql` 文件）包含了将数据库从一个模式版本更新到另一个版本所需的 SQL 指令。
*   **存放目录**: 这些迁移脚本通常存放在 [`apps/backend/drizzle/migrations/`](apps/backend/drizzle/migrations/) 目录下。
*   **应用迁移**: 虽然在 [`DatabaseService.ts`](apps/backend/src/services/DatabaseService.ts:1) 的初始化代码中包含了运行迁移的注释掉的逻辑 (`migrate` 函数)，但目前被标记为“skipped for now”。在生产部署或需要更新数据库结构时，应启用并执行这些迁移脚本，以确保数据库模式与代码定义一致。

```typescript
// Drizzle Kit 命令示例 (通常在 package.json 脚本中定义)
// "db:generate-migration": "drizzle-kit generate:sqlite --schema=./src/db/schema.ts --out=./drizzle/migrations"
// "db:migrate": "bun run src/scripts/migrate.ts" (假设有一个执行迁移的脚本)
```

通过这种方式，可以确保数据库结构的变更得到版本控制和系统化管理。