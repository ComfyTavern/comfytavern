# 本地用户系统设计方案 - v3 (统一密钥管理)

## 1. 目标与核心场景

本设计旨在为应用提供灵活的本地用户管理机制，并统一管理两种核心类型的密钥：用于程序化访问本应用的 **“服务 API 密钥 (Service API Keys)”** 和用于本应用访问第三方服务的 **“外部服务凭证 (External Service Credentials)”**。目标是适应不同的部署、使用场景和未来的扩展需求，同时确保系统的安全性、便捷性和可维护性。

### 1.1. 核心用户操作模式

应用支持以下三种核心用户操作模式，以满足不同用户的需求：

1.  **纯本地自用模式 (默认)**:

    - **场景**: 用户在单台设备上本地运行和使用应用，无需网络共享，追求极致的便捷性。这是应用的开箱即用体验。
    - **特点**: 无需任何用户创建、登录或密码输入，应用启动即用。所有数据（包括工作流、项目、配置以及两种类型的密钥）均归属于一个预定义的、全局共享的“默认用户”上下文。
    - **配置**: 通过 `config.json` 设置 `userManagement.multiUserMode: false` 且不设置 `userManagement.accessPasswordHash`。

2.  **个人远程访问模式 (自用模式 + 全局访问密码)**:

    - **场景**: 用户将部署在本地的应用通过网络（例如内网穿透、端口转发）暴露，以便个人从外部设备访问。此时需要在便捷性的基础上增加一层基础的安全防护。
    - **特点**: 应用的数据上下文仍为单用户（默认用户），但所有通过浏览器进行的访问都需要输入一个预设的全局访问密码。通过服务 API 密钥的程序化访问不受此浏览器会话锁的直接影响。
    - **配置**: 通过 `config.json` 设置 `userManagement.multiUserMode: false` 并配置 `userManagement.accessPasswordHash`。

3.  **多用户共享模式 (独立账户认证)**:
    - **场景**: 应用部署在一台主机上（例如局域网服务器或小型团队服务器），允许多个用户通过各自的设备独立访问和使用。每个用户拥有自己的账户、密码、配置、数据以及独立的密钥管理。
    - **特点**: 强制用户注册和登录。提供用户级别的数据隔离。系统会包含初步的管理员角色，用于用户管理等。
    - **配置**: 通过 `config.json` 设置 `userManagement.multiUserMode: true`。

### 1.2. 统一密钥管理目标

本项目需要管理和使用两种不同性质的密钥，v3 方案的核心目标之一就是对它们进行统一且安全的管理：

1.  **服务 API 密钥 (Service API Keys)**:

    - **方向**: 入站 (Inbound)，即 `外部程序 -> 本应用`。
    - **目的**: 为非浏览器客户端（如自动化脚本、第三方应用集成、其他 AI 代理等）提供安全的**身份认证 (Authentication)** 机制，使其能够代表特定用户（默认用户或多用户模式下的注册用户）与本应用进行交互。
    - **安全策略**: 密钥本身由本应用生成。在存储时，采用**不可逆哈希存储 (Hashed Storage)**，确保即使数据库泄露，原始密钥也无法被轻易还原。
    - **权限控制**: （预留）未来可通过 `scopes` 字段实现细粒度的权限控制 (Authorization)。

2.  **外部服务凭证 (External Service Credentials)**:
    - **方向**: 出站 (Outbound)，即 `本应用 -> 外部第三方服务 (如 OpenAI, Anthropic, Stability AI 等)`。
    - **目的**: 安全地存储用户提供的、用于访问这些第三方服务的认证信息（如 API Key、Token 等）。本应用在执行工作流或特定功能时，会使用这些凭证**代表用户**去调用外部服务。
    - **安全策略**: 凭证由用户提供。在存储时，采用**可逆加密存储 (Encrypted Storage)**，使用由环境变量配置的主加密密钥进行对称加密。确保凭证在静止状态下的安全，同时应用在需要时能够解密并使用它们。

### 1.3. 扩展性考量

- 为未来可能扩展到更复杂的在线多用户系统、团队协作功能奠定基础。
- 支持细粒度的权限控制，特别是针对服务 API 密钥的 `scopes`。
- 为可能的插件系统或开发者生态提供安全的认证和授权接口。

## 2. 核心机制与数据模型

### 2.1. 运行模式与配置

应用启动时，会根据全局配置文件 `config.json` 来确定当前的运行模式。

- **配置文件**: 应用的全局配置（包括用户管理模式相关的设置）存储于项目根目录下的 `config.json` 文件中。
- **模式判断逻辑**:

  1.  应用启动时读取 `config.json`。
  2.  检查 `userManagement.multiUserMode` 字段：
      - 如果 `multiUserMode` 为 `true`，则激活 **“多用户共享模式”**。
      - 如果 `multiUserMode` 为 `false` (或配置文件/该字段缺失，均视为 `false`)，则进一步检查：
        - `userManagement.accessPasswordHash` 字段是否已配置且非空。
        - 如果 `accessPasswordHash` 已配置，则激活 **“个人远程访问模式”**。
        - 如果 `accessPasswordHash` 未配置或为空，则激活 **“纯本地自用模式”** (此为应用的最终默认行为)。

- **`config.json` 示例**:
  ```json
  // config.json 中关于用户管理的配置示例
  {
    "userManagement": {
      "multiUserMode": false, // true: 多用户共享模式; false: 自用模式 (纯本地或带全局密码)
      "accessPasswordHash": null // 自用模式下的可选全局访问密码哈希。如果为 null 或空字符串，则自用模式无需密码。
      // "singleUserPath" 配置已移除。单用户模式的文件数据存储路径基于固定的 'default_user' ID。
    }
    // ... 其他全局配置
  }
  ```
  **注意**: 在 v3 方案中，单用户模式下的文件数据存储路径是基于固定的用户身份 ID `'default_user'` (通常在 `userData/default_user/` 下)，不再通过 `singleUserPath` 配置。代表该单用户的身份 ID 在数据库层面固定为 `'default_user'`。

### 2.2. 用户上下文与身份 (`UserContext`)

为了在不同模式下统一处理用户信息、认证状态以及两种密钥的元数据，我们定义了以下核心 TypeScript 类型结构（通常位于 `packages/types/src/schemas.ts` 或类似共享模块中）。

```typescript
// --- 外部服务凭证模型 ---

/**
 * 外部服务凭证的元数据信息 (安全展示给用户，不包含完整凭证)
 */
export interface ExternalCredentialMetadata {
  id: string; // 凭证在数据库中的唯一ID
  serviceName: string; // 凭证对应的服务标识符, e.g., "openai", "anthropic_claude"
  displayName?: string; // 用户为该凭证设置的可选显示名称/备注
  displayHint?: {
    // 用于UI安全展示凭证的部分信息
    prefix: string; // 例如 "sk-..."
    suffix: string; // 例如 "...AbCd"
  };
  createdAt: string; // ISO 8601 创建时间戳
}

/**
 * 存储在数据库中的外部服务凭证结构 (内部使用)
 */
export interface StoredExternalCredential extends ExternalCredentialMetadata {
  userId: string; // 关联的用户ID ('default_user' 或多用户的 uid)
  encryptedCredential: string; // 使用主加密密钥加密后的完整凭证内容
}

// --- 服务 API 密钥模型 ---

/**
 * 服务 API 密钥的元数据信息 (安全展示给用户，不包含完整密钥)
 */
export interface ServiceApiKeyMetadata {
  id: string; // 密钥在数据库中的唯一ID
  name?: string; // 用户为密钥设置的可选显示名称/备注
  prefix: string; // 密钥的前几位字符，用于识别，例如 "ctsk-xxxx" (ComfyTavern Service Key)
  scopes?: string[]; // (预留) 权限范围，例如 ["workflow:execute:*", "project:read:project_id_123"]
  createdAt: string; // ISO 8601 创建时间戳
  lastUsedAt?: string; // ISO 8601 最后成功使用时间戳 (可选)
}

/**
 * 存储在数据库中的服务 API 密钥结构 (内部使用)
 */
export interface StoredServiceApiKey extends ServiceApiKeyMetadata {
  userId: string; // 关联的用户ID ('default_user' 或多用户的 uid)
  hashedKey: string; // 使用强哈希算法处理后的完整密钥
}

/**
 * 创建服务 API 密钥时，一次性返回给用户的包含完整密钥的结构
 */
export interface ServiceApiKeyWithSecret extends ServiceApiKeyMetadata {
  secret: string; // 完整、明文的 API 密钥，仅在生成时一次性显示
}

// --- 用户身份模型 ---

/**
 * 代表一个可以拥有两种密钥的用户身份的基础接口
 */
export interface UserIdentityBase {
  serviceApiKeys: ServiceApiKeyMetadata[]; // 用户拥有的服务 API 密钥列表 (仅元数据)
  externalCredentials: ExternalCredentialMetadata[]; // 用户拥有的外部服务凭证列表 (仅元数据)
}

/**
 * 单用户模式下的默认用户身份信息
 */
export interface DefaultUserIdentity extends UserIdentityBase {
  id: "default_user"; // 固定ID，用于在数据库中标识默认用户
  username: string; // 例如 "本地用户" 或从配置中读取的名称
}

/**
 * 多用户模式下已认证的用户身份信息
 */
export interface AuthenticatedMultiUserIdentity extends UserIdentityBase {
  uid: string; // 用户的唯一ID (通常为 UUID)
  username: string; // 用户名
  isAdmin: boolean; // 是否为管理员
  createdAt: string; // ISO 8601 创建时间戳
}

// --- 用户上下文模型 ---

/**
 * 纯本地自用模式上下文 (无全局密码)
 */
export interface LocalNoPasswordUserContext {
  mode: "LocalNoPassword";
  multiUserMode: false;
  accessPasswordRequired: false;
  isAuthenticated: true; // 在此模式下，应用始终可用
  currentUser: DefaultUserIdentity; // 当前用户为默认用户
}

/**
 * 个人远程访问模式上下文 (有全局密码)
 */
export interface LocalWithPasswordUserContext {
  mode: "LocalWithPassword";
  multiUserMode: false;
  accessPasswordRequired: true;
  isAuthenticatedWithGlobalPassword: boolean; // 标记浏览器会话是否已通过全局密码验证
  currentUser: DefaultUserIdentity | null; // 浏览器会话验证成功后为 DefaultUserIdentity。若通过服务 API Key 认证，则 currentUser 始终为 DefaultUserIdentity。
}

/**
 * 多用户共享模式上下文
 */
export interface MultiUserSharedContext {
  mode: "MultiUserShared";
  multiUserMode: true;
  isAuthenticated: boolean; // 标记用户是否已通过账户密码登录
  currentUser: AuthenticatedMultiUserIdentity | null; // 登录后为该用户的详细信息
}

/**
 * 应用的统一用户上下文类型，由后端在每次请求时动态确定和填充
 */
export type UserContext =
  | LocalNoPasswordUserContext
  | LocalWithPasswordUserContext
  | MultiUserSharedContext;
```

**关于 `DefaultUserIdentity` 的说明**:
在“纯本地自用模式”和“个人远程访问模式”下，`DefaultUserIdentity` 代表同一个逻辑上的“默认用户”实体。这个默认用户拥有其专属的服务 API 密钥和外部服务凭证，这些信息将存储在数据库中，并与固定的用户标识符 `'default_user'` 相关联。“个人远程访问模式”仅仅是在“纯本地自用模式”的基础上，为**浏览器会话**增加了一道全局访问密码的门槛。通过服务 API 密钥进行的程序化访问，其认证逻辑独立于此浏览器会话锁（详见 2.8 节认证中间件逻辑）。

### 2.3. 数据存储 (SQLite)

为了可靠地管理用户账户（多用户模式）、两种类型的密钥及其与用户的关联关系，本方案**强制使用嵌入式数据库 SQLite**。这取代了 v2 版本中基于 JSON 文件的存储方式，以解决并发访问、数据一致性和可扩展性问题。

推荐使用类型安全的 ORM 工具（如 **Drizzle ORM**）与 `bun:sqlite` (Bun 内置的 SQLite 驱动) 结合，来定义和操作数据库表。

**核心数据库表结构 (SQLite 示例):**

```sql
-- 用户表 (主要在多用户共享模式下活跃使用)
-- 在单用户模式下，会包含一条 uid='default_user' 的占位记录以维护外键约束。
CREATE TABLE users (
    uid TEXT PRIMARY KEY,             -- 用户唯一标识符 (多用户模式下为 UUID，单用户模式下为 'default_user')
    username TEXT NOT NULL UNIQUE,    -- 用户名 (单用户模式下可为 'default_user' 或可配置名称)
    password_hash TEXT,               -- 用户密码的哈希值 (多用户模式下 NOT NULL，单用户模式下可为 NULL)
    is_admin BOOLEAN NOT NULL DEFAULT 0, -- 是否为管理员 (仅多用户模式有意义)
    created_at TEXT NOT NULL          -- 用户记录创建时间 (ISO 8601)
);

-- 服务 API 密钥表
CREATE TABLE service_api_keys (
    id TEXT PRIMARY KEY,                 -- 密钥的唯一ID (例如 UUID)
    user_id TEXT NOT NULL,               -- 关联的用户ID (users.uid, 即 'default_user' 或多用户的 uid)
    name TEXT,                           -- 用户为密钥设置的可选名称/备注
    prefix TEXT NOT NULL,                -- 密钥的前几位字符，用于UI展示和识别
    hashed_key TEXT NOT NULL UNIQUE,     -- 完整密钥的强哈希值
    scopes TEXT,                         -- (预留) 权限范围 (存储为 JSON 字符串数组)
    created_at TEXT NOT NULL,            -- 密钥创建时间 (ISO 8601)
    last_used_at TEXT,                   -- 密钥最后成功使用时间 (ISO 8601, 可选)
    FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE -- 级联删除，当用户被删除时，其所有服务API密钥也一并删除
);

-- 外部服务凭证表
CREATE TABLE external_credentials (
    id TEXT PRIMARY KEY,                 -- 凭证的唯一ID (例如 UUID)
    user_id TEXT NOT NULL,               -- 关联的用户ID (users.uid, 即 'default_user' 或多用户的 uid)
    service_name TEXT NOT NULL,          -- 凭证对应的服务标识符 (e.g., "openai", "anthropic_claude")
    display_name TEXT,                   -- 用户为凭证设置的可选显示名称/备注
    display_hint TEXT,                   -- 用于UI安全展示凭证的部分信息 (存储为 JSON 对象, e.g., {"prefix": "sk-...", "suffix": "...AbCd"})
    encrypted_credential TEXT NOT NULL,  -- 使用主加密密钥加密后的完整凭证内容
    created_at TEXT NOT NULL,            -- 凭证创建时间 (ISO 8601)
    UNIQUE(user_id, service_name, display_name), -- 确保同一用户对于同一服务，凭证的显示名称是唯一的 (如果display_name允许为空，则可能需要调整此约束)
    FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE -- 级联删除，当用户被删除时，其所有外部服务凭证也一并删除
);
```

**数据存储说明**:

- **单用户模式下的 `users` 表记录**:
  - 为了维护 `service_api_keys` 和 `external_credentials` 表中 `user_id` 字段的外键约束，即使在单用户模式下，也应在应用首次初始化时，在 `users` 表中创建一条记录，其 `uid` 为 `'default_user'`。
  - 这条记录的 `username` 可以是 "本地用户" 或从 `config.json` 中读取（例如，可以默认为 `'default_user'`），`password_hash` 可以为 `NULL` 或一个明确的不可登录标记（因为单用户模式不通过此表进行密码认证），`is_admin` 在此模式下无实际意义，可设为 `false`，`created_at` 设为当前时间。
- **数据目录**: 用户相关的文件型数据（如工作流定义、项目文件等）在单用户模式下存储于基于固定用户ID `'default_user'` 的路径下 (例如 `userData/default_user/`)；在多用户模式下存储于 `userData/<user_uuid>/`。数据库文件 (如 `app.sqlite`) 通常建议存放在 `data/` 目录或项目根目录下的一个专门的 `database` 子目录下。
- **事务与并发**: 使用 SQLite 和 ORM 可以有效处理事务和并发控制，确保数据操作的原子性和一致性，这是相比 JSON 文件存储的巨大优势。

### 2.4. 安全核心：密钥与凭证处理

#### 2.4.1. 用户密码与服务 API 密钥的哈希存储

对于用户在多用户模式下设置的账户密码，以及所有模式下为本应用生成的服务 API 密钥，都必须进行哈希处理后才能存入数据库。

- **算法**: 推荐使用强密码哈希算法，例如 Bun 内置的 `Bun.password` API (其底层通常是 bcrypt)。如果需要更强的抗 GPU 破解能力，可以考虑 Argon2 (需要额外库支持)。
  - `Bun.password.hash(plaintext: string | Buffer, options?: Bun.Password.Options): Promise<string>`
  - `Bun.password.verify(plaintext: string | Buffer, hash: string): Promise<boolean>`
- **流程**:
  1.  **接收明文**: 从用户输入或系统生成获得明文密码或服务 API 密钥的 `secret`。
  2.  **生成哈希**: 调用 `Bun.password.hash()` (或选定的哈希函数) 处理明文，生成哈希字符串。此过程通常会自动处理加盐。
  3.  **存储哈希**: 将生成的哈希字符串存入数据库对应表的 `password_hash` (用于用户密码) 或 `hashed_key` (用于服务 API 密钥) 字段。**绝不存储明文密码或明文服务 API 密钥 `secret`。**
  4.  **验证**:
      - 对于用户登录：接收用户输入的明文密码，从数据库根据用户名取出存储的 `password_hash`，然后调用 `Bun.password.verify()` 进行比对。
      - 对于服务 API 密钥认证：接收客户端提供的明文 API 密钥 `secret`，对其进行哈希运算，然后在 `service_api_keys` 表的 `hashed_key` 字段中进行查找匹配的记录。

#### 2.4.2. 外部服务凭证的加密存储

对于用户提供给本应用、用于访问第三方服务的凭证（如 OpenAI API Key），必须进行可逆加密后存储，因为应用在后台需要解密它们以供使用。

- **主加密密钥 (Master Encryption Key - MEK)**:
  - 这是进行对称加密和解密的根密钥。
  - **来源**: 必须通过**环境变量** (例如 `COMFYTAVERN_MASTER_ENCRYPTION_KEY`) 提供给应用进程。
  - **安全性**: 此 MEK **绝对不能**硬编码到代码中，也**绝对不能**存入数据库或任何版本控制系统。其安全性至关重要，一旦泄露，所有加密的外部服务凭证都将面临风险。
  - **生成与管理**: 应指导用户生成一个高强度的随机字符串（例如，至少 32 字节的随机数据，然后进行 Base64 编码）作为 MEK，并在部署应用时配置好该环境变量。
- **加密算法**: 推荐使用经过认证的强对称加密算法，如 `AES-256-GCM` (Galois/Counter Mode)。AES-GCM 不仅提供机密性，还能提供真实性（防篡改）和完整性。
  - Bun 的 `Bun.CryptoHasher` 目前主要用于哈希，对于对称加密，可以使用 Node.js 的 `crypto` 模块（Bun 兼容大部分 Node.js API）或专门的、经过审计的第三方加密库。
  - 例如，使用 Node.js `crypto` 模块的 `crypto.createCipheriv()` 和 `crypto.createDecipheriv()`。
- **加密流程**:
  1.  **接收明文凭证**: 从用户输入获取第三方服务的明文凭证。
  2.  **生成初始化向量 (IV)**: 对于每次加密操作，都应生成一个唯一的、密码学安全的随机 IV (例如，AES-GCM 通常使用 12 字节或 16 字节的 IV)。IV 无需保密，但必须唯一且不可预测。
  3.  **执行加密**: 使用从环境变量获取的 MEK、生成的 IV 以及选定的加密算法（如 AES-256-GCM）对明文凭证进行加密。
  4.  **存储密文**: 将 IV 和加密后生成的密文（以及 GCM 模式下的认证标签 Authentication Tag）组合成一个字符串（例如，`iv_hex:ciphertext_hex:auth_tag_hex` 的格式，或使用 Base64 编码），存入数据库 `external_credentials` 表的 `encrypted_credential` 字段。
- **解密流程**:
  1.  **读取密文**: 当应用需要使用某个外部服务凭证时，从数据库中读取存储的组合字符串。
  2.  **解析 IV、密文和认证标签**: 从组合字符串中分离出 IV、密文和认证标签。
  3.  **执行解密**: 使用从环境变量获取的 MEK、解析出的 IV、认证标签以及选定的解密算法，对密文进行解密，得到原始的明文凭证。
  4.  **使用凭证**: 将解密后的明文凭证用于调用相应的第三方服务。**注意：明文凭证应仅在内存中使用，并尽可能缩短其在内存中的生命周期，避免写入日志或持久化到其他地方。**

### 2.5. 服务 API 密钥系统详解

服务 API 密钥 (Service API Keys) 是为了支持第三方应用集成和程序化调用本应用而设计的。

- **核心目的**:

  - **身份认证**: 为非浏览器客户端提供一种基于令牌的身份验证机制，以确认请求来源的合法性。
  - **用户关联**: 每个服务 API 密钥都关联到一个特定的用户实体（单用户模式下的默认用户，或多用户模式下的注册用户）。通过密钥认证的请求将被视为由该关联用户发起。
  - **多密钥管理**: 允许每个用户实体生成和管理多个服务 API 密钥，方便用户为不同的应用或脚本分配独立的密钥。
  - **调用跟踪与审计 (通过元数据)**: 通过密钥的元数据（如 `id`, `name`, `lastUsedAt`）可以辅助追踪 API 调用，便于审计和分析使用情况。
  - **来源区分**: 用户可以为密钥设置名称/备注，以帮助区分和管理来自不同应用或脚本的调用。
  - **权限控制 (Scopes - 预留)**: `scopes` 字段为未来实现细粒度的权限控制（授权 Authorization）预留了设计空间。授权检查应在身份认证成功之后进行，用于确定该身份被允许执行哪些具体操作。

- **服务 API 密钥数据结构 (回顾)**:

  - `ServiceApiKeyMetadata`: 用于安全展示给用户和在 API 响应中返回的元数据，不包含敏感信息。
  - `ServiceApiKeyWithSecret`: 仅在密钥生成时一次性返回给用户的结构，包含完整的明文密钥 (`secret`)。
  - `StoredServiceApiKey`: 存储在数据库中的结构，包含密钥的哈希值 (`hashedKey`) 而非明文。

- **服务 API 密钥生命周期与管理**:
  1.  **生成 (Creation)**:
      - 用户通过特定的 API 端点（见 4.2 节）请求创建新的服务 API 密钥。
      - 用户可以为密钥指定一个可选的名称/备注，以及（未来）权限范围 (`scopes`)。
      - 后端系统生成一个具有足够高熵值（长且随机）的唯一密钥字符串 (`secret`)。建议使用密码学安全的随机字节生成器（如 `crypto.randomBytes(32)`），然后进行 Base64 URL Safe 或 Hex 编码。可以考虑加入可识别的前缀（如 `ctsk_`，代表 ComfyTavern Service Key）。
      - 同时生成该密钥的元数据，如 `id` (UUID), `prefix` (密钥 `secret` 的前几位，例如前 8 位，用于 UI 展示和快速识别), `createdAt`。
      - 对完整的 `secret` 进行哈希处理，得到 `hashedKey`。
      - 将 `StoredServiceApiKey`（包含 `id`, `userId`, `name`, `prefix`, `hashedKey`, `scopes`, `createdAt`）存入数据库 `service_api_keys` 表。
      - 将包含明文 `secret` 的 `ServiceApiKeyWithSecret` 结构一次性返回给用户。**必须明确告知用户，这是唯一一次看到完整密钥的机会，应立即妥善保存。**
  2.  **存储 (Storage)**:
      - 后端数据库中**仅存储**密钥的哈希值 (`hashedKey`)，绝不存储明文 `secret`。
      - 元数据（如 `id`, `name`, `prefix`, `scopes`, `createdAt`, `lastUsedAt`）与哈希值一同存储。
  3.  **认证 (Authentication)**:
      - 客户端在发起 API 请求时，通常在 HTTP 请求的 `Authorization` 头中提供服务 API 密钥的明文 `secret`，格式为 `Bearer <ApiKeySecret>`。
      - 后端认证中间件提取 `<ApiKeySecret>`。
      - 对提取到的 `<ApiKeySecret>` 进行哈希运算。
      - 使用这个哈希结果在数据库 `service_api_keys` 表的 `hashed_key` 字段中进行查找。
      - 如果找到匹配的记录，则进一步检查该密钥是否有效（例如，是否未被标记为吊销——虽然当前设计未显式包含“吊销”状态字段，但删除即为吊销；未来可增加 `revokedAt` 或 `isActive` 字段）。
      - 如果密钥合法有效，则认证成功。根据记录中的 `userId` 确定当前请求的用户身份。可以更新该密钥的 `lastUsedAt` 时间戳。
      - （未来）如果实现了 `scopes`，则在认证成功后，还需要检查请求的操作是否在该密钥的权限范围之内。
  4.  **展示 (Display)**:
      - 在用户界面管理服务 API 密钥时，仅显示其元数据 (`ServiceApiKeyMetadata`)，如名称、前缀、创建时间、最后使用时间、Scopes 等。**绝不显示完整的密钥 `secret` 或其哈希值。**
  5.  **吊销/删除 (Revocation/Deletion)**:
      - 用户可以通过 API 端点（见 4.2 节）请求删除（即吊销）不再需要的服务 API 密钥。
      - 后端从数据库 `service_api_keys` 表中删除对应的记录即可。一旦删除，该密钥立即失效。

### 2.6. 外部服务凭证系统详解

外部服务凭证 (External Service Credentials) 是指用户提供给本应用的、用于访问第三方服务的认证信息。

- **核心目的**:

  - **安全存储**: 为用户提供一个安全的地方来存储他们访问各种外部 AI 服务（如 OpenAI, Anthropic, Google Gemini 等）或其他第三方 API 所需的敏感凭证。
  - **代理调用**: 使本应用能够在其后端逻辑中（例如在执行复杂工作流时）代表用户，使用这些存储的凭证去调用相应的外部服务。
  - **便捷管理**: 用户可以在一个统一的界面管理他们用于不同外部服务的凭证，无需在多个工作流或配置中重复输入。
  - **避免前端暴露**: 凭证存储在后端并由后端使用，避免了在前端代码或用户配置中直接暴露这些敏感信息。

- **外部服务凭证数据结构 (回顾)**:

  - `ExternalCredentialMetadata`: 用于安全展示给用户和在 API 响应中返回的元数据，不包含加密的凭证本身。包含 `displayHint` 以便在 UI 上安全地提示用户是哪个凭证。
  - `StoredExternalCredential`: 存储在数据库中的结构，包含加密后的凭证 (`encryptedCredential`)。

- **外部服务凭证生命周期与管理**:
  1.  **添加 (Creation/Addition)**:
      - 用户通过特定的 API 端点（见 4.3 节）提交要添加的外部服务凭证。
      - 请求中通常需要包含：
        - `serviceName`: 标识凭证对应的外部服务 (例如 "openai_gpt4", "anthropic_claude3_opus")。这个标识符应预定义或有规范，方便后端逻辑查找和使用。
        - `credential`: 用户提供的明文凭证字符串。
        - `displayName` (可选): 用户为此凭证设置的易于识别的名称/备注。
      - 后端接收到明文凭证后，按照 2.4.2 节描述的加密流程，使用主加密密钥 (MEK) 和唯一的 IV 对其进行加密。
      - 生成凭证的元数据，如 `id` (UUID), `userId`, `createdAt`。根据明文凭证生成 `displayHint` (例如，取明文的前 4 位和后 4 位，如果凭证长度不足则做相应处理)。
      - 将 `StoredExternalCredential`（包含 `id`, `userId`, `serviceName`, `displayName`, `displayHint`, `encryptedCredential`, `createdAt`）存入数据库 `external_credentials` 表。
      - 向用户返回该凭证的元数据 (`ExternalCredentialMetadata`)。
  2.  **存储 (Storage)**:
      - 后端数据库中存储的是**加密后的凭证** (`encryptedCredential`)。
      - 相关的元数据与加密凭证一同存储。
  3.  **使用 (Usage)**:
      - 当后端应用逻辑（如某个工作流节点）需要调用某个外部服务时：
        - 根据当前用户 (`userId`) 和所需服务 (`serviceName`，可能还有 `displayName` 或 `id` 作为筛选条件) 从数据库 `external_credentials` 表中查询对应的 `StoredExternalCredential` 记录。
        - 如果找到记录，则提取 `encryptedCredential`。
        - 按照 2.4.2 节描述的解密流程，使用主加密密钥 (MEK) 和存储时使用的 IV（需要从 `encryptedCredential` 字符串中解析出来）对其进行解密，得到明文凭证。
        - 使用解密后的明文凭证向目标外部服务发起请求。
        - **注意安全**: 明文凭证应仅在需要时解密，并在内存中短暂停留，用后即弃，避免写入日志。
  4.  **展示 (Display)**:
      - 在用户界面管理外部服务凭证时，仅显示其元数据 (`ExternalCredentialMetadata`)，如服务名称、用户自定义的显示名称、创建时间以及 `displayHint`（例如 "sk-xxxx...xxxx"）。**绝不显示完整的明文凭证或加密后的凭证字符串。**
  5.  **删除 (Deletion)**:
      - 用户可以通过 API 端点（见 4.3 节）请求删除不再需要的外部服务凭证。
      - 后端从数据库 `external_credentials` 表中删除对应的记录即可。
  6.  **更新 (Updation - 可选)**:
      - 可以提供 API 允许用户更新某个已存储凭证的明文内容（例如，当用户轮换了其 OpenAI Key 时）或其显示名称。
      - 更新流程类似于添加：接收新的明文凭证，加密后替换数据库中旧的 `encryptedCredential`，并更新相关元数据（如 `displayHint`）。

### 2.7. 用户模式详解 (基于 SQLite)

#### 2.7.1. 纯本地自用模式 (Mode 1)

- **激活条件**: `config.json` 中 `userManagement.multiUserMode: false` 且 `userManagement.accessPasswordHash` 未设置或为空。
- **用户上下文**: `LocalNoPasswordUserContext`。
- **核心行为**:
  - **无浏览器认证**: 应用启动时不显示任何登录或密码输入界面。
  - **默认用户身份**: 所有操作都在一个预定义的“默认用户”上下文中执行。其身份信息为 `DefaultUserIdentity` (id: `'default_user'`)。
    - 应用初始化时，应确保数据库 `users` 表中存在 `uid='default_user'` 的记录。
  - **数据存储**:
    - 用户账户信息（占位记录）、服务 API 密钥、外部服务凭证均存储在 SQLite 数据库中，并关联到 `user_id='default_user'`。
    - 用户的文件型数据（工作流、项目等）存储在基于 `user_id='default_user'` 的文件系统路径下 (例如 `userData/default_user/`)。
  - **API 影响**:
    - 用户账户管理相关的 API (如用户注册 `/api/auth/register`、登录 `/api/auth/login`) 在此模式下通常被禁用或返回特定状态，因为不存在多账户概念。
    - `/api/auth/current` 将始终返回 `LocalNoPasswordUserContext`，其 `currentUser` 属性为 `DefaultUserIdentity`，并包含该默认用户的所有服务 API 密钥元数据和外部服务凭证元数据。
  - **密钥管理**: 默认用户可以通过相应的 API (见 4.2, 4.3 节) 管理其名下的服务 API 密钥和外部服务凭证。
  - **管理员角色**: 不适用。

#### 2.7.2. 个人远程访问模式 (Mode 2: 自用模式 + 全局访问密码)

- **激活条件**: `config.json` 中 `userManagement.multiUserMode: false` 且 `userManagement.accessPasswordHash` 已设置。
- **用户上下文**: `LocalWithPasswordUserContext`。
- **核心行为**:
  - **全局密码认证 (浏览器会话)**:
    - 应用启动或用户首次通过浏览器访问时，必须输入预设的全局访问密码。
    - 后端通过 `POST /api/auth/verify-global-password` 接口验证密码哈希。
    - 验证成功后，可建立一个简单的会话（例如，通过设置一个特定的 `HttpOnly` Cookie，标记该浏览器会话已通过全局密码验证）。
  - **默认用户身份**: 全局密码验证成功后，所有操作仍在“默认用户” (`DefaultUserIdentity`, id: `'default_user'`) 上下文中执行。
  - **数据存储**: 与纯本地自用模式类似，用户账户（占位）、密钥信息存数据库，文件数据存文件系统。
  - **API 影响**:
    - `/api/auth/current`:
      - 若全局密码未验证，返回 `LocalWithPasswordUserContext` 且 `isAuthenticatedWithGlobalPassword: false`, `currentUser: null`。
      - 若全局密码已验证，返回 `LocalWithPasswordUserContext` 且 `isAuthenticatedWithGlobalPassword: true`, `currentUser` 为 `DefaultUserIdentity` (包含密钥元数据)。
      - 若 `accessPasswordHash` 在 `config.json` 中未设置但模式判断逻辑错误地进入此分支（理论上不应发生，但作为防御性设计），应引导用户设置全局密码（参考 3.1.3.d 节）。
    - 其他用户账户管理 API (注册、登录) 禁用。
  - **密钥管理**: 默认用户在通过全局密码验证后，可以通过 API 管理其密钥。通过服务 API 密钥的程序化访问，则直接进行密钥认证，无需全局密码。
  - **管理员角色**: 不适用。

#### 2.7.3. 多用户共享模式 (Mode 3: 独立账户认证)

- **激活条件**: `config.json` 中 `userManagement.multiUserMode: true`。
- **用户上下文**: `MultiUserSharedContext`。
- **核心行为**:
  - **强制用户账户认证**: 用户必须通过用户名和密码进行注册和登录。
  - **独立用户数据与密钥**: 每个注册用户在数据库 `users` 表中有唯一记录 (`uid`)。其服务 API 密钥和外部服务凭证在相应表中也通过此 `uid` 进行关联和隔离。用户的文件型数据存储在其专属目录 `userData/<user_uuid>/`。
  - **会话管理**:
    - 推荐使用成熟的库如 `Lucia Auth` (配合 `@lucia-auth/adapter-drizzle` 等) 或 `@elysiajs/jwt` 来管理用户会话。
    - 登录成功后，后端生成安全的会话凭证 (如 Session ID 或 JWT)，通过 `HttpOnly` Cookie 传递给客户端。
  - **管理员角色**:
    - **识别**: 第一个通过系统注册的用户默认为管理员（在 `users` 表中标记 `isAdmin: true`）。后续可由管理员通过特定 API 指定其他用户为管理员。
    - **权限**: 管理员拥有额外权限，如查看所有用户列表、创建/修改/删除用户账户、访问和修改全局应用配置等（详见 4.4 节）。
  - **API 影响**:
    - 用户账户管理 API (`/api/auth/register`, `/api/auth/login`, `/api/auth/logout`) 正常工作。
    - `/api/auth/current`:
      - 若用户未登录，返回 `MultiUserSharedContext` 且 `isAuthenticated: false`, `currentUser: null`。
      - 若用户已登录，返回 `MultiUserSharedContext` 且 `isAuthenticated: true`, `currentUser` 为该用户的 `AuthenticatedMultiUserIdentity` (包含其密钥元数据)。
      - 若数据库中无任何用户（首次启动多用户模式），应引导注册首个管理员账户（参考 3.1.4.b.i 节）。
  - **密钥管理**: 每个注册用户在登录后，可以通过 API 管理其自身名下的服务 API 密钥和外部服务凭证。

### 2.8. 认证中间件逻辑与优先级

为确保不同认证方式（服务 API 密钥、会话 Cookie）能够清晰、无冲突地协同工作，后端认证中间件（或 Elysia 的路由守卫/钩子）应遵循以下检查顺序和优先级：

1.  **首先检查服务 API 密钥 (最高优先级)**:

    - 检查 HTTP 请求头中是否存在 `Authorization` 字段，其值是否以 `Bearer ` (注意末尾空格) 开头。
    - 如果存在，提取 `Bearer ` 之后的 `<ApiKeySecret>` 部分。
    - 对 `<ApiKeySecret>` 进行哈希运算。
    - 使用此哈希值在数据库 `service_api_keys` 表中查找 `hashed_key` 字段匹配的记录。
    - 如果找到匹配记录：
      - 验证该密钥是否有效（例如，没有被标记为吊销，如果未来增加此状态）。
      - 如果密钥合法有效：
        - 根据记录中的 `user_id` (可能是 `'default_user'` 或某个用户的 `uid`)，从 `users` 表中获取对应的用户身份信息，构建 `DefaultUserIdentity` 或 `AuthenticatedMultiUserIdentity`。
        - 认证成功。在请求上下文中填充 `UserContext`，并将 `currentUser` 设置为刚构建的用户身份。标记请求是通过服务 API 密钥认证的。
        - **跳过所有后续的会话 Cookie 认证检查。** 服务 API 密钥被视为一种独立的、直接的身份凭证。
        - 更新该密钥的 `last_used_at` 时间戳。
    - 如果未找到匹配记录或密钥无效，则认为 API Key 认证失败，继续后续检查。

2.  **若无有效服务 API 密钥，则检查会话凭证 (Session Cookie)**:

    - 根据 `config.json` 中的 `userManagement.multiUserMode` 判断当前运行模式：
      - **纯本地自用模式 (Mode 1)**:
        - 无需任何 Cookie 验证。
        - 直接从数据库加载 `user_id='default_user'` 的信息构建 `DefaultUserIdentity`。
        - 认证（或视为自动认证）成功。在请求上下文中填充 `LocalNoPasswordUserContext`。
      - **个人远程访问模式 (Mode 2 - 全局密码)**:
        - 检查是否存在标记“全局密码已验证通过”的有效会话 Cookie。
        - 如果 Cookie 有效：
          - 从数据库加载 `user_id='default_user'` 的信息构建 `DefaultUserIdentity`。
          - 认证成功。在请求上下文中填充 `LocalWithPasswordUserContext`，并设置 `isAuthenticatedWithGlobalPassword: true`。
        - 如果 Cookie 无效或缺失，认证失败。通常对于需要认证的路由，应返回 401 未授权或重定向到全局密码输入页。对于 `/api/auth/current` 这类接口，则填充 `LocalWithPasswordUserContext` 并设置 `isAuthenticatedWithGlobalPassword: false`, `currentUser: null`。
      - **多用户共享模式 (Mode 3 - 用户登录)**:
        - 检查是否存在有效的用户登录会话 Cookie (例如由 Lucia Auth 管理的 Session ID，或包含 JWT 的 Cookie)。
        - 如果会话 Cookie 有效，并通过会话管理器（如 Lucia Auth）成功解析出用户身份（通常是 `uid`）：
          - 根据 `uid` 从数据库 `users` 表加载用户信息，构建 `AuthenticatedMultiUserIdentity`。
          - 认证成功。在请求上下文中填充 `MultiUserSharedContext`，并设置 `isAuthenticated: true`。
        - 如果会话 Cookie 无效、缺失或无法解析出有效用户身份，认证失败。对于需要认证的路由，返回 401 或重定向到登录页。对于 `/api/auth/current`，则填充 `MultiUserSharedContext` 并设置 `isAuthenticated: false`, `currentUser: null`。

3.  **认证失败**: 如果以上所有检查均未成功认证用户，则对于需要认证的受保护路由，应返回 `401 Unauthorized`。

**核心原则**: 服务 API 密钥主要用于程序化访问，认证的是「请求来源的程序/脚本」；而会话 Cookie 主要用于浏览器会话，认证的是「用户的浏览器会话」。一旦服务 API 密钥认证成功，即代表该密钥所属的用户发起了操作，应绕过针对浏览器会话设置的门槛（如全局密码验证或用户登录状态检查）。

## 3. 用户交互流程

本节描述在不同运行模式下，用户与应用的主要交互流程。

### 3.1. 应用首次启动 / 无用户数据或配置

当应用首次启动，或者相关的用户数据（如 SQLite 数据库中的用户表为空）或配置文件（如 `config.json` 中 `accessPasswordHash` 未设置）处于初始状态时：

1.  **确定运行模式**: 应用首先读取 `config.json` (如果存在) 来确定 `userManagement.multiUserMode` 的设置。

    - 如果 `config.json` 或相关字段缺失，默认为“纯本地自用模式”。

2.  **纯本地自用模式 (Mode 1)**:
    a. **数据库初始化**: 检查 SQLite 数据库。如果 `users` 表不存在或没有 `uid='default_user'` 的记录，则创建该表并插入 `default_user` 的占位记录。其 `username` 可默认为 "本地用户"，`password_hash` 为 NULL，`is_admin` 为 `false`。
    b. **数据路径**: 默认用户的文件数据存储路径基于固定的用户ID `'default_user'` (例如 `userData/default_user/`)，系统应确保此路径存在。
    c. **进入应用**: 直接进入应用主界面，无需任何认证。用户上下文为 `LocalNoPasswordUserContext`。

3.  **个人远程访问模式 (Mode 2 - 带全局密码)**:
    a. **检测密码状态**: 应用检测到 `config.json` 中 `userManagement.multiUserMode: false` 但 `userManagement.accessPasswordHash` **已配置且非空**。
    _ **数据库初始化**: 同纯本地自用模式，确保 `default_user` 记录存在。
    b. **提示输入全局密码**: 应用前端应显示一个界面，提示用户输入预设的全局访问密码。
    c. **验证密码**: 用户提交密码后，通过 `POST /api/auth/verify-global-password` API 进行验证。
    _ **成功**: 后端设置会话 Cookie，前端导航至应用主界面。用户上下文为 `LocalWithPasswordUserContext` (已认证)。
    _ **失败**: 停留在密码输入界面，并提示错误。
    d. **首次设置全局密码 (重要)**: 如果应用检测到 `userManagement.multiUserMode: false` 但 `userManagement.accessPasswordHash` **为空或未设置** (通常在首次配置为远程访问时发生)：
    _ 当应用首次被浏览器访问时，**不应直接进入主界面或要求输入密码**。
    _ 应显示一个**“设置全局访问密码”的专属页面/模态框**。
    _ 用户输入并确认新密码后，前端将密码提交给后端特定 API (例如 `POST /api/auth/setup-global-password`)。
    _ 后端接收密码，计算其哈希值，并将该哈希值安全地写回到 `config.json` 文件的 `userManagement.accessPasswordHash` 字段。
    _ 成功设置后，可以引导用户使用新设置的密码进行首次验证 (回到上述 b, c 点流程)，或者直接建立会话并进入主界面。 \* 后续启动时，由于 `accessPasswordHash` 已存在，将遵循正常的全局密码验证流程。

4.  **多用户共享模式 (Mode 3)**:
    a. **检测用户状态**: 应用检测到 `config.json` 中 `userManagement.multiUserMode: true`。
    b. **检查数据库**: 查询 SQLite 数据库的 `users` 表。
    _ 如果 `users` 表为空 (即没有任何用户记录)：
    i. **提示注册首个管理员账户**: 应用前端应显示一个特殊的注册页面，明确提示用户正在注册第一个账户，该账户将自动成为系统管理员。
    ii. 用户输入用户名和密码。
    iii.通过 `POST /api/auth/register` API (后端逻辑会特殊处理首次注册，将其标记为管理员) 创建用户记录（哈希密码，生成 UID，`isAdmin: true`），并创建该用户的专属数据目录 (如 `userData/<user_uuid>/`)。
    iv. 注册成功后，建议自动为该管理员建立会话并登录，然后导航至应用主界面。用户上下文为 `MultiUserSharedContext` (已认证，管理员)。
    _ 如果 `users` 表已存在用户记录：
    i. 显示标准的登录页面（可包含“注册新账户”的入口）。用户上下文为 `MultiUserSharedContext` (未认证)。

### 3.2. 应用启动 (已存在用户数据与配置)

当应用启动时，相关的用户数据和配置已存在：

1.  **确定运行模式**: 同 3.1.1。

2.  **纯本地自用模式 (Mode 1)**:
    a. **加载默认用户数据**: 系统识别到 `default_user` 上下文。数据库中已存在 `default_user` 记录及其关联的密钥信息。
    b. **进入应用**: 直接进入应用主界面。用户上下文为 `LocalNoPasswordUserContext`。

3.  **个人远程访问模式 (Mode 2 - 带全局密码)**:
    a. **提示输入全局密码**: 同 3.1.3.b。
    b. **验证密码**: 同 3.1.3.c。验证通过后，加载与 `default_user` 关联的密钥等数据。
    c. **进入应用**: 成功后进入应用主界面。用户上下文为 `LocalWithPasswordUserContext` (已认证)。

4.  **多用户共享模式 (Mode 3)**:
    a. **显示登录页面**: 应用前端显示登录页面，可包含“注册新账户”的入口。
    b. **用户登录**: 用户输入用户名和密码，通过 `POST /api/auth/login` API 进行登录。
    c. **验证与加载**: 后端验证凭证。
    _ **成功**: 建立会话，加载该用户的配置、数据（包括其服务 API 密钥和外部服务凭证的元数据）。导航至应用主界面。用户上下文为 `MultiUserSharedContext` (已认证)。
    _ **失败**: 停留在登录页面，提示错误。
    d. **管理员特权**: 如果登录成功的用户是管理员 (`isAdmin: true`)，前端应根据此信息动态显示相应的管理功能入口或面板。

### 3.3. 用户注册 (仅限多用户共享模式)

- **入口**: 通常在登录页面的“注册”链接或按钮。
- **流程**:
  1.  用户提供一个希望使用的用户名和密码。
  2.  前端进行基本的输入校验（如非空、密码复杂度等，可选）。
  3.  通过 `POST /api/auth/register` API 提交注册信息。
  4.  后端处理：
      - 验证用户名是否已存在。
      - 对密码进行哈希处理。
      - 生成新的用户 UID。
      - 在 `users` 表中创建新用户记录 (`isAdmin` 默认为 `false`，除非是首次注册流程)。
      - 创建该用户的专属数据目录。
      - （可选）注册成功后自动为用户建立会话并登录。
  5.  前端根据 API 响应（成功或失败信息）进行相应处理。

### 3.4. 用户注销 / 切换用户 (仅限多用户共享模式)

- **注销 (Logout)**:
  - 用户通过界面上的“注销”按钮发起。
  - 前端调用 `POST /api/auth/logout` API。
  - 后端清除当前用户的会话凭证 (例如，使 Session ID 失效或使 JWT 进入黑名单/等待过期)。
  - 前端清除本地存储的会话相关信息，并导航回登录页面。
- **切换用户 (Switch User)**:
  - 本质上是当前用户注销后，另一个用户重新登录的过程。没有直接的“切换用户”API，而是通过“注销”->“登录”实现。

### 3.5. 密钥管理界面交互 (所有模式，用户认证后)

用户在通过认证后（单用户模式下自动认证或通过全局密码认证；多用户模式下通过账户登录），应能在应用的设置区域或专门的密钥管理页面访问以下功能。前端需要根据 v3 设计，将“服务 API 密钥”和“外部服务凭证”的管理区分在两个独立的界面区域/标签页。

#### 3.5.1. 服务 API 密钥管理

- **查看列表**:
  - 界面通过 `GET /api/users/me/service-keys` 获取当前用户的所有服务 API 密钥元数据列表。
  - 列表应清晰展示每个密钥的：名称 (若有)、前缀 (Prefix)、创建日期 (`createdAt`)、最后使用日期 (`lastUsedAt`，若有)、权限范围 (`scopes`，若已实现并赋值)。
- **创建新密钥**:
  - 用户点击“创建新密钥”或类似按钮。
  - 可弹出表单，允许用户输入可选的密钥名称 (`name`) 和（未来）选择权限范围 (`scopes`)。
  - 提交后，前端调用 `POST /api/users/me/service-keys`。
  - 后端成功创建密钥后，会返回 `ServiceApiKeyWithSecret` 对象，其中包含完整的明文密钥 (`secret`)。
  - 前端必须在一个显眼的、一次性的提示框/模态框中完整显示此 `secret`，并**强烈警告用户这是唯一一次看到此密钥的机会，应立即复制并安全保存，应用不会再次显示它。**
  - 提示框关闭后，新创建密钥的元数据应出现在列表末尾。
- **吊销/删除密钥**:
  - 列表中每个密钥旁应有“删除”或“吊销”按钮。
  - 用户点击后，可有二次确认提示。
  - 确认后，前端调用 `DELETE /api/users/me/service-keys/{keyId}`。
  - 成功后，该密钥应从列表中移除。
- **编辑密钥 (可选扩展)**:
  - 允许用户编辑已存在密钥的名称或（未来）权限范围。
  - 调用 `PUT /api/users/me/service-keys/{keyId}`。

#### 3.5.2. 外部服务凭证管理

- **查看列表**:
  - 界面通过 `GET /api/users/me/credentials` 获取当前用户的所有外部服务凭证元数据列表。
  - 列表应清晰展示每个凭证的：服务名称 (`serviceName`，可考虑显示服务 Logo)、用户自定义的显示名称 (`displayName`，若有)、创建日期 (`createdAt`)、以及用于安全提示的 `displayHint` (例如 "sk-xxxx...xxxx")。
  - **绝不显示完整凭证或加密后的凭证。**
- **添加新凭证**:
  - 用户点击“添加新凭证”或类似按钮。
  - 弹出表单，要求用户：
    - 选择或输入服务名称 (`serviceName`) (可以是一个下拉列表，包含预定义的服务，或允许用户输入自定义服务标识)。
    - 输入凭证的明文内容 (`credential`) (应使用 `<input type="password">` 类型的输入框)。
    - 输入可选的显示名称 (`displayName`)。
  - 提交后，前端调用 `POST /api/users/me/credentials`。
  - 后端成功添加并加密存储凭证后，返回该凭证的元数据。
  - 新凭证的元数据应出现在列表末尾。
- **删除凭证**:
  - 列表中每个凭证旁应有“删除”按钮。
  - 用户点击后，可有二次确认提示。
  - 确认后，前端调用 `DELETE /api/users/me/credentials/{credentialId}`。
  - 成功后，该凭证应从列表中移除。
- **编辑/替换凭证 (可选扩展)**:
  - 允许用户更新已存储凭证的明文内容（例如，当用户轮换了其第三方服务的 API Key 时）或其显示名称。
  - 调用 `PUT /api/users/me/credentials/{credentialId}`。请求体中包含新的 `credential` (明文) 和/或 `displayName`。后端会重新加密新的凭证内容。

## 4. 后端 API 设计

所有 `/api/users/me/*` (密钥管理相关) 和 `/api/admin/*` (管理员相关) 接口，以及其他需要用户身份的业务接口，都必须先通过认证中间件（见 2.8 节）的验证。

### 4.1. 认证与会话 API

这些 API 负责处理用户的身份验证、会话建立与清除，以及获取当前用户状态。

- **`POST /api/auth/register`** (仅多用户模式)
  - **目的**: 注册新用户。
  - **请求体**: `{ "username": "...", "password": "..." }`
  - **响应**:
    - `201 Created`: 成功创建用户。响应体可包含用户信息（不含密码哈希）或空。可选：注册成功后自动登录，并返回会话 Cookie 及 `UserContext`。
    - `400 Bad Request`: 用户名已存在、密码不符合要求等。
    - `403 Forbidden`: 如果不允许注册（例如，已达到最大用户数，或非管理员尝试在特定配置下注册）。
- **`POST /api/auth/login`** (仅多用户模式)
  - **目的**: 用户登录。
  - **请求体**: `{ "username": "...", "password": "..." }`
  - **响应**:
    - `200 OK`: 登录成功。后端应设置 `HttpOnly` 会话 Cookie (例如由 Lucia Auth 管理的 Session ID 或 JWT)。响应体应包含完整的 `MultiUserSharedContext` (包含当前用户信息及两种密钥的元数据列表)。
    - `401 Unauthorized`: 用户名或密码错误。
    - `429 Too Many Requests`: 达到登录尝试次数限制。
- **`POST /api/auth/logout`** (仅多用户模式)
  - **目的**: 用户注销。
  - **请求体**: (空)
  - **响应**:
    - `204 No Content`: 注销成功。后端应清除或作废会话 Cookie。
- **`POST /api/auth/verify-global-password`** (仅个人远程访问模式)
  - **目的**: 验证全局访问密码。
  - **请求体**: `{ "password": "用户输入的全局密码" }`
  - **响应**:
    - `200 OK`: 密码验证成功。后端应设置一个简单的 `HttpOnly` 会话 Cookie，标记该浏览器会话已通过全局密码验证。响应体应包含完整的 `LocalWithPasswordUserContext` (其中 `isAuthenticatedWithGlobalPassword: true`, `currentUser` 为 `DefaultUserIdentity` 并包含密钥元数据)。
    - `401 Unauthorized`: 密码错误。
    - `429 Too Many Requests`: 达到尝试次数限制。
- **`POST /api/auth/setup-global-password`** (仅首次配置个人远程访问模式时)
  - **目的**: 设置初始的全局访问密码。
  - **请求体**: `{ "password": "用户设置的新全局密码" }`
  - **响应**:
    - `200 OK`: 密码设置成功并已保存到 `config.json`。响应体可包含 `LocalWithPasswordUserContext` (已认证状态)。
    - `400 Bad Request`: 密码不符合要求，或 `config.json` 写入失败。
    - `403 Forbidden`: 如果全局密码已设置，则不允许再次调用此接口。
- **`GET /api/auth/current`** (所有模式)
  - **目的**: 获取当前应用的用户上下文状态。此接口对于前端根据不同模式和认证状态动态调整 UI 至关重要。
  - **请求体**: (空)
  - **响应**: `200 OK` - 响应体为一个准确描述当前应用状态和用户认证情况的 `UserContext` 结构。
    - **纯本地自用模式**: 返回 `LocalNoPasswordUserContext`，其中 `isAuthenticated: true`，`currentUser` 为 `DefaultUserIdentity` (包含其名下的服务 API 密钥元数据和外部服务凭证元数据)。
    - **个人远程访问模式 (需要设置全局密码)**: 如果 `config.json` 中 `accessPasswordHash` 未设置，应返回一个特殊的 `LocalWithPasswordUserContext` 变体，例如：
      ```json
      {
        "mode": "LocalWithPassword",
        "multiUserMode": false,
        "accessPasswordRequired": true,
        "isAuthenticatedWithGlobalPassword": false,
        "currentUser": null,
        "globalPasswordSetupRequired": true // 特殊标志，指示前端引导用户设置全局密码
      }
      ```
    - **个人远程访问模式 (需要输入全局密码)**: 如果 `accessPasswordHash` 已设置但当前浏览器会话未通过验证（无有效会话 Cookie），返回 `LocalWithPasswordUserContext`，其中 `isAuthenticatedWithGlobalPassword: false`, `currentUser: null`。
    - **个人远程访问模式 (已通过全局密码验证)**: 返回 `LocalWithPasswordUserContext`，其中 `isAuthenticatedWithGlobalPassword: true`, `currentUser` 为 `DefaultUserIdentity` (包含密钥元数据)。
    - **多用户共享模式 (需要注册首个管理员)**: 如果 `multiUserMode: true` 但数据库 `users` 表为空，应返回一个特殊的 `MultiUserSharedContext` 变体，例如：
      ```json
      {
        "mode": "MultiUserShared",
        "multiUserMode": true,
        "isAuthenticated": false,
        "currentUser": null,
        "adminRegistrationRequired": true // 特殊标志，指示前端引导用户注册首个管理员账户
      }
      ```
    - **多用户共享模式 (需要登录)**: 如果用户未登录（无有效会话 Cookie），返回 `MultiUserSharedContext`，其中 `isAuthenticated: false`, `currentUser: null`。
    - **多用户共享模式 (已登录)**: 返回 `MultiUserSharedContext`，其中 `isAuthenticated: true`, `currentUser` 为当前登录用户的 `AuthenticatedMultiUserIdentity` (包含其名下的服务 API 密钥元数据和外部服务凭证元数据)。

### 4.2. 服务 API 密钥管理 API (`/api/users/me/service-keys`)

这些 API 操作的是当前认证用户自身的服务 API 密钥。

- **`GET /`**:
  - **目的**: 获取当前认证用户的所有服务 API 密钥元数据列表。
  - **响应**: `200 OK` - `{ "keys": ServiceApiKeyMetadata[] }`
- **`POST /`**:
  - **目的**: 为当前认证用户创建一个新的服务 API 密钥。
  - **请求体**: `{ "name"?: string; "scopes"?: string[] }` (`scopes` 初期可忽略或赋予默认值，例如完全权限)。
  - **响应**: `201 Created` - `ServiceApiKeyWithSecret` (包含一次性显示的完整 `secret`)。
- **`DELETE /{keyId}`**:
  - **目的**: 删除（吊销）当前认证用户指定的某个服务 API 密钥。
  - **路径参数**: `keyId` - 要删除的服务 API 密钥的 ID。
  - **响应**:
    - `204 No Content`: 成功删除。
    - `403 Forbidden`: 如果尝试删除不属于自己的密钥（理论上通过路径设计已避免，但可作为额外检查）。
    - `404 Not Found`: 指定的 `keyId` 不存在。
- **`PUT /{keyId}`** (可选扩展)
  - **目的**: 更新服务 API 密钥的信息（如名称、`scopes`）。
  - **请求体**: `{ "name"?: string; "scopes"?: string[] }` (只提供需要更新的字段)。
  - **响应**: `200 OK` - `ServiceApiKeyMetadata` (返回更新后的元数据)。

### 4.3. 外部服务凭证管理 API (`/api/users/me/credentials`)

这些 API 操作的是当前认证用户自身的外部服务凭证。

- **`GET /`**:
  - **目的**: 获取当前认证用户的所有外部服务凭证元数据列表。
  - **响应**: `200 OK` - `{ "credentials": ExternalCredentialMetadata[] }`
- **`POST /`**:
  - **目的**: 为当前认证用户添加一个新的外部服务凭证。
  - **请求体**: `{ "serviceName": string; "credential": "明文凭证内容"; "displayName"?: string; }`
  - **响应**: `201 Created` - `ExternalCredentialMetadata` (返回新创建凭证的元数据，不含敏感信息)。
- **`DELETE /{credentialId}`**:
  - **目的**: 删除当前认证用户指定的某个外部服务凭证。
  - **路径参数**: `credentialId` - 要删除的外部服务凭证的 ID。
  - **响应**:
    - `204 No Content`: 成功删除。
    - `403 Forbidden`: 如上。
    - `404 Not Found`: 指定的 `credentialId` 不存在。
- **`PUT /{credentialId}`** (可选扩展)
  - **目的**: 更新一个已存在的外部服务凭证（例如，替换密钥内容或修改显示名称）。
  - **请求体**: `{ "credential"?: "新的明文凭证内容"; "displayName"?: string; }` (只提供需要更新的字段)。
  - **响应**: `200 OK` - `ExternalCredentialMetadata` (返回更新后的元数据)。

### 4.4. 管理员 API (`/api/admin/*`)

这些 API 仅在**多用户共享模式**下，且当前认证用户具有**管理员权限 (`isAdmin: true`)** 时才可用。访问控制应通过专门的管理员认证中间件或在各 API 内部进行检查。

- **`GET /api/admin/users`**:
  - **目的**: 获取所有用户账户列表的详细信息（可包含 `uid`, `username`, `isAdmin`, `createdAt`，但不应包含密码哈希）。
  - **响应**: `200 OK` - `{ "users": Omit<AuthenticatedMultiUserIdentity, 'serviceApiKeys' | 'externalCredentials' | 'passwordHash'>[] }` (或其他合适的管理员视角的用户列表结构)。
- **`POST /api/admin/users`**:
  - **目的**: (管理员) 创建新的用户账户。
  - **请求体**: `{ "username": string; "password": string; "isAdmin"?: boolean }`
  - **响应**: `201 Created` - 新创建用户的元数据。
- **`PUT /api/admin/users/{userId}`**:
  - **目的**: (管理员) 修改指定用户信息（例如，重置密码（需要特殊流程）、更改用户名（需注意唯一性）、设置/取消管理员权限）。
  - **路径参数**: `userId` - 目标用户的 `uid`。
  - **请求体**: 包含要更新的字段，如 `{ "username"?: string; "newPassword"?: string; "isAdmin"?: boolean }`。
  - **响应**: `200 OK` - 更新后的用户元数据。
- **`DELETE /api/admin/users/{userId}`**:
  - **目的**: (管理员) 删除指定用户账户。这将级联删除该用户的所有服务 API 密钥和外部服务凭证（通过数据库外键约束）。
  - **路径参数**: `userId` - 目标用户的 `uid`。
  - **响应**: `204 No Content`。
- **`GET /api/admin/settings`**: (可选，如果存在管理员可配置的全局应用设置)
  - **目的**: 获取全局应用配置信息（可能部分来自 `config.json`，部分来自数据库）。
  - **响应**: `200 OK` - 配置对象。
- **`POST /api/admin/settings`**: (可选)
  - **目的**: 更新全局应用配置。
  - **请求体**: 包含要更新的配置项。
  - **响应**: `200 OK`。
- **扩展考虑**:
  - 管理员可能需要 API 来查看所有用户的服务 API 密钥元数据（出于审计目的）或强制吊销某个用户的某个服务 API 密钥。
  - 管理员可能需要 API 来查看外部服务凭证的使用统计（如果记录的话），但绝不能访问加密的凭证内容。

### 4.5. 会话管理 (Cookie)

- **通用原则**:
  - 使用 `HttpOnly` Cookie 存储会话标识符（无论是 Session ID 还是 JWT 的一部分），以防止客户端 JavaScript 访问，增强对 XSS 攻击的防护。
  - 在生产环境中，如果应用通过 HTTPS 提供服务，所有会话 Cookie 都应标记为 `Secure`，确保它们仅通过加密连接传输。
  - 设置 `Path=/`，使 Cookie 对整个应用有效。
  - `SameSite` 属性：
    - 对于会话 Cookie，通常推荐 `SameSite=Lax` 作为默认值，可以在多数情况下防止 CSRF 攻击，同时允许顶级导航时发送 Cookie。
    - 如果需要更严格的 CSRF 防护，且不涉及跨站请求的特定场景，可以考虑 `SameSite=Strict`。
- **个人远程访问模式 (Mode 2)**:
  - 在全局密码验证成功后，后端设置一个简单的、短生命周期的会址 Cookie。此 Cookie 的值可以是一个随机生成的、与服务器端某个简单状态（例如，内存中的一个已验证 IP 列表及时间戳，或一个极简的会话存储条目）相关联的令牌。其目的仅是标记该浏览器在一段时间内已通过全局密码验证。
- **多用户共享模式 (Mode 3)**:
  - **使用 Lucia Auth**: Lucia Auth 会自动处理会话 Cookie 的创建、验证、续期和清除。它通常会在数据库的会话表中存储会话信息，Cookie 中只包含一个不透明的 Session ID。
  - **使用 JWT**: 如果选择 JWT 方案 (例如通过 `@elysiajs/jwt`)：
    - 登录成功后，后端生成一个包含用户 `uid`、过期时间 (`exp`) 以及其他必要声明 (claims) 的 JWT。
    - 可以将 JWT 直接存储在 `HttpOnly` Cookie 中。
    - 后续请求中，后端从 Cookie 中提取 JWT 并验证其签名和有效期。
    - 注销时，需要使 Cookie 失效（例如，设置一个同名但已过期的 Cookie，或清除它）。如果 JWT 是无状态的，则无法在服务器端强制使其立即失效，除非维护一个 JWT 黑名单（增加了复杂性）。因此，对于需要可靠注销的场景，基于 Session ID 的方案（如 Lucia Auth 提供的）通常更优。

## 5. 前端实现要点

前端 UI/UX 需要根据后端提供的 `UserContext`（尤其是 `mode` 字段和认证状态）动态调整其行为和显示内容。

- **模式识别与状态驱动**:

  - 应用加载时，前端应首先调用 `GET /api/auth/current` 接口。
  - 根据响应中的 `mode` (`LocalNoPassword`, `LocalWithPassword`, `MultiUserShared`) 以及 `isAuthenticated*`, `currentUser`, `globalPasswordSetupRequired`, `adminRegistrationRequired` 等字段，来决定渲染哪个主界面或引导流程。
  - 使用状态管理库 (如 Pinia, Zustand, Redux Toolkit 等) 存储当前的用户上下文、认证状态、用户信息、以及从 `currentUser` 中获取的服务 API 密钥元数据列表和外部服务凭证元数据列表。这些状态将驱动整个应用的 UI 变化。

- **UI 动态调整**:

  - **纯本地自用模式 (Mode 1)**:
    - 无任何登录/密码输入界面。
    - 直接展示应用核心功能。
    - 在用户设置区域（或专门的“开发者设置”、“连接设置”页面）提供“服务 API 密钥管理”和“外部服务凭证管理”的入口。
  - **个人远程访问模式 (Mode 2)**:
    - 如果 `globalPasswordSetupRequired: true`，显示设置全局密码的界面。
    - 如果需要输入全局密码（`accessPasswordRequired: true` 且 `isAuthenticatedWithGlobalPassword: false`），显示全局密码输入界面。
    - 全局密码认证成功后，界面行为类似纯本地自用模式，用户设置区域提供两种密钥管理入口。
    - 此模式下不应显示用户列表、用户管理、注册等与多用户相关的功能。
  - **多用户共享模式 (Mode 3)**:
    - 如果 `adminRegistrationRequired: true`，显示注册首个管理员账户的界面。
    - 如果未登录 (`isAuthenticated: false`)，显示标准的登录/注册界面。
    - 用户登录后，在用户设置区域提供两种密钥管理入口。
    - 根据当前登录用户的 `currentUser.isAdmin` 状态，动态显示或隐藏管理员专属的管理面板入口和相关功能（如用户列表管理）。
    - 此模式下不应有利全局密码相关的设置或输入。

- **密钥管理界面 (分离且明确)**:

  - **服务 API 密钥管理界面**:
    - 清晰標題，如“服务 API 密钥”或“开发者访问”。
    - 功能：查看列表（名称、前缀、创建/最后使用日期、Scopes）、创建新密钥（强调 `secret` 仅显示一次）、删除/吊销密钥。
  - **外部服务凭证管理界面**:
    - 清晰標題，如“外部服务凭证”或“第三方服务连接”。
    - 功能：查看列表（服务名/Logo、显示名称、创建日期、安全提示如 `sk-xx...xx`）、添加新凭证（选择服务、输入明文凭证、设置显示名称）、删除凭证。
    - **严格禁止**显示完整的明文凭证或加密后的凭证字符串。编辑时也是要求重新输入完整凭证。

- **API 调用封装**: 建议将所有与后端 API 的交互封装在专门的服务模块或函数中，方便管理和复用。这些函数应能处理认证令牌（如从 Cookie 中自动处理，或在需要时附加服务 API 密钥）。

- **错误处理与用户反馈**: 对 API 调用失败（如认证失败、验证错误、服务器错误）进行妥善处理，并向用户提供清晰、友好的错误提示。

## 6. 安全性与后续考虑

### 6.1. 密码与密钥安全

- **强哈希存储 (用户密码 & 服务 API 密钥)**:
  - 所有用户账户密码（多用户模式）和本应用生成的服务 API 密钥的 `secret`，在存储到数据库前，必须使用强哈希算法（如 `Bun.password` API 提供的 bcrypt）并自动加盐。
  - **严禁以任何形式（包括可逆加密）在数据库中存储明文密码或明文服务 API 密钥 `secret`。**
- **强加密存储 (外部服务凭证)**:
  - 用户提供的第三方服务凭证，必须使用强对称加密算法（如 AES-256-GCM）进行加密后存储。
  - 主加密密钥 (MEK) 必须通过环境变量提供，绝不能硬编码或存入数据库。确保 MEK 的安全是此机制的核心。
- **服务 API 密钥 `secret` 仅生成时显示**: 完整的服务 API 密钥 `secret` 仅在创建成功时一次性显示给用户，之后无法再次获取。必须明确提示用户妥善保管。
- **高熵随机性 (服务 API 密钥)**: 确保生成的服务 API 密钥 `secret` 具有足够高的熵值（即足够长且字符集足够随机，例如使用 `crypto.randomBytes()` 生成后编码），使其难以被猜测或暴力破解。
- **前缀标识 (服务 API 密钥)**: 为生成的服务 API 密钥 `secret` 加入可识别的前缀 (如 `ctsk_`)，有助于在日志、监控和用户界面中识别密钥类型，并减少与其他类型令牌混淆的风险。

### 6.2. 会话安全

- **HttpOnly Cookies**: 用于存储会话标识符的 Cookie 必须设置为 `HttpOnly`，防止客户端脚本访问。
- **Secure Cookies**: 在生产环境中，若应用通过 HTTPS 提供服务，会话 Cookie 必须标记为 `Secure`。
- **SameSite Cookies**: 合理配置 `SameSite` 属性 (`Lax` 或 `Strict`) 以提供 CSRF 防护。
- **会话过期**:
  - 为会话设置合理的过期时间（例如，通过 Lucia Auth 配置或 JWT 的 `exp` 声明）。
  - 考虑实现会话刷新机制（如果使用 JWT，可能需要刷新令牌；如果使用 Session ID，Lucia Auth 通常会自动处理滑动窗口过期）。
- **安全注销**: 确保注销操作能可靠地使服务器端会话失效，并清除客户端的会话 Cookie。

### 6.3. 传输安全

- **HTTPS**: 在生产环境中，所有客户端与服务器之间的通信（包括 API 请求、网页访问）都必须强制使用 HTTPS，以保护传输中的数据（包括密码、密钥、凭证、会话令牌和业务数据）不被窃听或篡改。

### 6.4. 访问控制与授权

- **最小权限原则 (服务 API 密钥 Scopes)**:
  - 虽然初期 `scopes` 可以是可选或默认完全权限，但应尽快规划和实现基于 `scopes` 的细粒度权限控制。
  - 确保每个服务 API 密钥仅能访问其被明确授权的资源和操作，避免过度授权。
  - 授权检查（基于 `scopes`）应在身份认证（基于密钥本身）成功之后，由具体的 API 路由守卫或业务逻辑执行。
- **管理员权限控制**: 严格控制管理员权限的分配和使用。管理员操作应有清晰的审计日志（如果实现）。

### 6.5. 输入验证与输出编码

- 对所有用户输入（包括 API 请求体、URL 参数）进行严格的合法性验证和净化，以防止注入攻击（如 SQL 注入、XSS 等，尽管使用 ORM 和现代前端框架能缓解一部分，但仍需注意）。
- 对所有输出到前端的内容进行适当的编码（如 HTML 编码），以防止 XSS 攻击。

### 6.6. 接口限流 (Rate Limiting)

为了防止暴力破解攻击（如密码尝试、API 密钥尝试）和 API 滥用，应对关键的认证接口和所有通过服务 API 密钥进行认证的请求实施速率限制：

- **目标接口**:
  - `POST /api/auth/login` (多用户模式下的用户登录)
  - `POST /api/auth/verify-global-password` (个人远程访问模式下的全局密码验证)
  - 所有通过服务 API 密钥进行认证的请求路径。
- **策略**:
  - 可以基于 IP 地址、用户 ID (如果已认证)、或服务 API 密钥 ID (如果认证成功) 进行限流。
  - 例如，限制在特定时间窗口内（如每分钟、每小时）的尝试次数或请求次数。
  - 对于认证失败的尝试，应采用更严格的限流策略。
- **反馈**: 当达到限制时，API 应返回 `429 Too Many Requests` HTTP 状态码，并可附加 `Retry-After` 响应头，告知客户端何时可以重试。

### 6.7. 定期审计与安全更新

- **依赖库安全**: 定期检查并更新项目的所有依赖库（包括后端框架、ORM、加密库、前端库等），以修复已知的安全漏洞。
- **安全审计**: （理想情况下）定期对系统进行安全审计或渗透测试。
- **日志监控**: 监控应用日志和认证日志，及时发现异常活动或潜在攻击。
- **用户教育**: 指导用户设置强密码、安全保管服务 API 密钥和主加密密钥 (MEK)。鼓励用户定期轮换其服务 API 密钥和第三方服务凭证。

### 6.8. 后续扩展考虑

- **用户数据导入/导出**: 允许用户（在自用模式或多用户模式下导出自己的数据）以某种标准格式（如 JSON）导入/导出其在本应用中的数据（包括工作流、项目，以及可能的密钥元数据——但不含密钥本身）。
- **“访客”模式 (多用户)**: 为多用户模式增加一个临时的、不保存数据的匿名用户会话，允许用户体验部分功能。
- **与未来联网系统的兼容性**: 当前设计为后续扩展到更复杂的认证机制（如 OAuth2/OIDC 服务端或客户端集成）和更精细的权限体系（如 RBAC - Role-Based Access Control）奠定基础。
- **细化的服务 API 密钥 Scopes**: 实现完整的权限范围 (`scopes`) 定义、分配和检查机制。
- **团队/组织账户**: 在多用户基础上，未来可能支持更复杂的组织结构、团队共享和权限委派。
- **服务 API 密钥与外部服务凭证的用量与限制**: 跟踪密钥/凭证的使用频率和次数，为未来实现速率限制、配额管理或审计功能提供数据支持。
- **双因素认证 (2FA)**: 为多用户模式下的账户登录增加 2FA 支持，提升账户安全性。
- **审计日志**: 为关键操作（如用户登录、密码修改、密钥创建/删除、管理员操作等）记录详细的审计日志。

## 7. 技术选型与依赖 (建议)

- **数据库**: `SQLite` (通过 `bun:sqlite` 使用)。
- **ORM**: `Drizzle ORM` (类型安全，与 Bun/SQLite 配合良好)。
- **后端框架**: `ElysiaJS` (基于 Bun，高性能，插件化)。
- **密码哈希**: `Bun.password` API (内置 bcrypt 实现)。
- **外部服务凭证加密**: Node.js `crypto` 模块 (Bun 兼容) 实现 `AES-256-GCM`，或选用成熟的第三方加密库。主加密密钥通过环境变量管理。
- **UID 生成**: `crypto.randomUUID()` (Node.js 内置，Bun 兼容) 或 `bun:uuid`。
- **服务 API 密钥生成**: `crypto.randomBytes()` 生成随机字节后进行编码（如 Base64 URL Safe）。
- **会话管理 (多用户模式)**:
  - **推荐**: `Lucia Auth` (配合 `@lucia-auth/adapter-drizzle`)，提供完整的会 шения 管理和安全特性。
  - **备选**: `@elysiajs/jwt` (如果需要更轻量级的 JWT 方案，但需自行处理更多会话逻辑，如刷新、吊销等)。
- **Cookie 处理 (后端)**: ElysiaJS 框架内置支持。
- **前端状态管理**: Pinia, Zustand, Redux Toolkit 或其他 Vue 生态兼容的状态库。
- **前端 UI 框架**: Vue 3 (项目已有基础)。
- **CSS 工具**: Tailwind CSS (项目已有基础)。

## 8. Mermaid 图 (概念架构)

```mermaid
classDiagram
    direction LR

    package "Config & Environment" {
        class ConfigJson {
            +userManagement: object
            +accessPasswordHash: string?
            // singleUserPath removed
        }
        class EnvVariables {
            +COMFYTAVERN_MASTER_ENCRYPTION_KEY: string
        }
    }

    package "User Identity & Context" {
        class UserIdentityBase {
            +ServiceApiKeyMetadata[] serviceApiKeys
            +ExternalCredentialMetadata[] externalCredentials
        }
        class DefaultUserIdentity {
            +id: "default_user"
            +username: string
        }
        UserIdentityBase <|-- DefaultUserIdentity
        class AuthenticatedMultiUserIdentity {
            +uid: string
            +username: string
            +isAdmin: boolean
            +createdAt: string
        }
        UserIdentityBase <|-- AuthenticatedMultiUserIdentity

        class UserContext {
            <<Union>>
            +mode: string
            +multiUserMode: boolean
        }
        class LocalNoPasswordUserContext {
            +currentUser: DefaultUserIdentity
        }
        UserContext <|-- LocalNoPasswordUserContext
        class LocalWithPasswordUserContext {
            +isAuthenticatedWithGlobalPassword: boolean
            +currentUser: DefaultUserIdentity | null
        }
        UserContext <|-- LocalWithPasswordUserContext
        class MultiUserSharedContext {
            +isAuthenticated: boolean
            +currentUser: AuthenticatedMultiUserIdentity | null
        }
        UserContext <|-- MultiUserSharedContext

        LocalNoPasswordUserContext o-- DefaultUserIdentity
        LocalWithPasswordUserContext o-- DefaultUserIdentity
        MultiUserSharedContext o-- AuthenticatedMultiUserIdentity
    }

    package "Data Storage (SQLite via Drizzle ORM)" {
        class UsersTable {
            <<Table>>
            +uid (PK)
            +username
            +password_hash
            +is_admin
            +created_at
        }
        class ServiceApiKeysTable {
            <<Table>>
            +id (PK)
            +user_id (FK to UsersTable)
            +name
            +prefix
            +hashed_key
            +scopes
            +created_at
            +last_used_at
        }
        class ExternalCredentialsTable {
            <<Table>>
            +id (PK)
            +user_id (FK to UsersTable)
            +service_name
            +display_name
            +display_hint
            +encrypted_credential
            +created_at
        }
        UsersTable "1" -- "0..*" ServiceApiKeysTable : manages
        UsersTable "1" -- "0..*" ExternalCredentialsTable : manages
    }

    package "Security Services" {
        class PasswordHasher {
            <<Service>>
            +hash(plain): string
            +verify(plain, hash): boolean
        }
        PasswordHasher ..> EnvVariables : (implicitly uses strong algo like bcrypt)
        class CredentialEncrypter {
            <<Service>>
            +encrypt(plain): string
            +decrypt(cipher): string
        }
        CredentialEncrypter ..> EnvVariables : uses MEK
    }

    package "Backend API (ElysiaJS)" {
        class AuthController {
            <<Controller>>
            +POST_register()
            +POST_login()
            +POST_logout()
            +POST_verifyGlobalPassword()
            +POST_setupGlobalPassword()
            +GET_current(): UserContext
        }
        AuthController --> UsersTable
        AuthController --> PasswordHasher
        AuthController ..> UserContext : constructs

        class ServiceKeyController {
            <<Controller>>
            +GET_list(): ServiceApiKeyMetadata[]
            +POST_create(): ServiceApiKeyWithSecret
            +DELETE_remove(keyId)
        }
        ServiceKeyController --> ServiceApiKeysTable
        ServiceKeyController --> PasswordHasher : for hashing new key
        ServiceKeyController ..> UserContext : uses for auth

        class ExternalCredentialController {
            <<Controller>>
            +GET_list(): ExternalCredentialMetadata[]
            +POST_create(): ExternalCredentialMetadata
            +DELETE_remove(credentialId)
        }
        ExternalCredentialController --> ExternalCredentialsTable
        ExternalCredentialController --> CredentialEncrypter
        ExternalCredentialController ..> UserContext : uses for auth

        class AdminController {
            <<Controller>>
            +GET_users()
            +POST_createUser()
            +PUT_updateUser(userId)
            +DELETE_deleteUser(userId)
        }
        AdminController --> UsersTable
        AdminController ..> UserContext : uses for auth (isAdmin check)
    }
    PasswordHasher --> UsersTable : (stores/reads password_hash)
    PasswordHasher --> ServiceApiKeysTable : (stores/reads hashed_key)
    CredentialEncrypter --> ExternalCredentialsTable : (stores/reads encrypted_credential)


    package "Frontend (Vue 3)" {
        class SettingsPage {
            +renderServiceKeyManagementUI()
            +renderExternalCredentialManagementUI()
        }
        SettingsPage ..> ServiceKeyController : interacts via API
        SettingsPage ..> ExternalCredentialController : interacts via API
        class AppVue {
            +displays based on UserContext
        }
        AppVue ..> AuthController : calls GET_current
    }
```

## 9. 分阶段实施与 MVP 考量

为了确保项目能够平稳启动并逐步完善，建议采用分阶段的实施策略：

1.  **阶段一 (核心功能 & 单用户基础)**:

    - **用户模式**: 实现**纯本地自用模式 (Mode 1)** 和 **个人远程访问模式 (Mode 2)**。
    - **数据存储**: 搭建 SQLite 数据库基础结构（`users`, `external_credentials`, `service_api_keys` 表）。在应用初始化时，为单用户模式创建 `'default_user'` 的占位记录在 `users` 表。
    - **核心密钥类型**: 优先实现**外部服务凭证 (External Service Credentials)** 的加密存储、解密使用、以及相应的管理 API (`/api/users/me/credentials`) 和前端 UI。这是因为应用的核心工作流很可能依赖于调用第三方服务。
    - **认证**: 实现全局密码的设置 (`POST /api/auth/setup-global-password`) 和验证 (`POST /api/auth/verify-global-password`) 流程，以及相应的会话 Cookie 管理（可使用 Elysia 内置机制或简单 JWT）。
    - **`GET /api/auth/current`**: 实现此接口，使其能正确返回 `LocalNoPasswordUserContext` 和 `LocalWithPasswordUserContext` (包括 `globalPasswordSetupRequired` 状态)。
    - **安全**: 确保主加密密钥 (MEK) 通过环境变量配置，外部服务凭证的加解密逻辑正确实现。
    - **暂时不实现**: 服务 API 密钥功能、多用户模式。

2.  **阶段二 (程序化访问支持 - 单用户)**:

    - **密钥类型**: 在单用户模式（默认用户 `'default_user'`）下，实现**服务 API 密钥 (Service API Keys)** 的哈希存储、以及相应的管理 API (`/api/users/me/service-keys`) 和前端 UI。
    - **认证**: 完善认证中间件，使其能够处理通过 `Authorization: Bearer <ApiKeySecret>` 传递的服务 API 密钥，并能正确识别出关联的 `'default_user'`。
    - **`GET /api/auth/current`**: 确保此接口在通过服务 API 密钥认证时，也能正确返回相应的 `UserContext` (例如，`LocalNoPasswordUserContext`，因为 API Key 认证绕过全局密码)。
    - **安全**: 确保服务 API 密钥的生成（高熵、前缀）、哈希存储、认证比对逻辑正确且安全。

3.  **阶段三 (多用户支持与高级会话管理)**:

    - **用户模式**: 实现**多用户共享模式 (Mode 3)**。
    - **认证与会话**:
      - 引入 `Lucia Auth` (配合 `@lucia-auth/adapter-drizzle`) 来处理用户注册 (`/api/auth/register`)、登录 (`/api/auth/login`)、注销 (`/api/auth/logout`) 以及基于数据库的会话管理。
      - 替换或增强阶段一中为个人远程访问模式实现的简单会话机制。
    - **数据隔离**: 确保所有服务 API 密钥和外部服务凭证都与各自用户的 `uid` 正确关联。确保用户的文件数据也按 `uid` 隔离。
    - **管理员角色**: 实现管理员的识别（首次注册用户默认为管理员）和基础的管理员 API (如用户列表查看)。
    - **`GET /api/auth/current`**: 适配多用户模式，能正确返回 `MultiUserSharedContext` (包括 `adminRegistrationRequired` 状态)。

4.  **阶段四 (功能完善与安全强化)**:

    - **管理员功能**: 完善管理员 API，例如创建/修改/删除用户账户。
    - **服务 API 密钥 Scopes**: 设计并实现服务 API 密钥的 `scopes` 机制，提供细粒度的权限控制。
    - **接口限流 (Rate Limiting)**: 对关键认证接口和 API 调用实施速率限制。
    - **前端完善**: 优化所有模式下的用户体验，完善错误处理和用户反馈。
    - **安全审计与测试**: 进行全面的安全测试和代码审计。
    - **文档**: 完善用户文档和开发者文档。

5.  **阶段五 (高级扩展功能 - 根据需求)**:
    - 考虑实现 6.8 节中提到的其他扩展点，如用户数据导入/导出、2FA、审计日志、团队账户等。

这个分阶段的实施路线图旨在优先交付核心价值，逐步迭代，降低风险，并确保每个阶段都有可测试和可用的功能。
