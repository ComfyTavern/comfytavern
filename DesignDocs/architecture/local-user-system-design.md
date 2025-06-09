# 本地用户系统设计方案 (Local User System Design) - v2 (包含 API Key 扩展)

## 1. 目标与核心场景

本设计旨在为应用提供灵活的本地用户管理机制和程序化访问能力，以适应不同的部署、使用场景和未来的扩展需求。核心目标包括：

1.  **纯本地自用模式 (默认)**:

    - **场景**: 用户在单台设备上本地运行和使用应用，无需网络共享，追求极致的便捷性。
    - **特点**: 无需任何用户创建、登录或密码输入，应用启动即用。所有数据归属于一个默认的本地上下文。
    - **配置**: 通过 `config.json` 设置 `userManagement.multiUserMode: false` 且不设置 `userManagement.accessPasswordHash`。

2.  **个人远程访问模式 (自用模式 + 全局访问密码)**:

    - **场景**: 用户将部署在本地的应用通过网络（如内网穿透、端口转发）暴露，以便个人从外部设备访问。此时需要在便捷性的基础上增加一层基础的安全防护。
    - **特点**: 应用仍为单用户数据上下文，但访问时需要输入一个预设的全局访问密码。
    - **配置**: 通过 `config.json` 设置 `userManagement.multiUserMode: false` 并配置 `userManagement.accessPasswordHash`。

3.  **多用户共享模式 (独立账户认证)**:
    - **场景**: 应用部署在一台主机上（例如局域网服务器），允许多个用户通过各自的设备独立访问和使用。每个用户拥有自己的账户、密码、配置和数据。
    - **特点**: 强制用户注册和登录，提供用户级别的数据隔离和初步的管理员角色。
    - **配置**: 通过 `config.json` 设置 `userManagement.multiUserMode: true`。

- **扩展性**:
  - 为未来可能扩展到更复杂的在线多用户系统奠定基础。
  - **支持程序化访问**: 允许通过 API Key 进行第三方应用集成和自动化脚本调用，适用于所有用户模式。
  - **灵活的权限控制**: 为 API Key 预留权限范围 (Scopes) 设计，以便未来实现细粒度访问控制。

## 2. 核心机制

### 2.1. 运行模式与配置

- **配置文件**: 应用的全局配置及用户管理模式存储于 `config.json` 文件中。
- **模式判断逻辑**:

  1. 读取 `config.json` 中的 `userManagement.multiUserMode`。
  2. 如果 `multiUserMode` 为 `true`，则激活 **“多用户共享模式”**。
  3. 如果 `multiUserMode` 为 `false` (或配置文件缺失/该字段缺失，均视为 `false`)：
     a. 检查 `userManagement.accessPasswordHash` 是否已配置且非空。
     b. 如果 `accessPasswordHash` 已配置，则激活 **“个人远程访问模式”**。
     c. 如果 `accessPasswordHash` 未配置或为空，则激活 **“纯本地自用模式”** (此为应用的最终默认行为)。

- **`config.json` 示例**:
  ```json
  // config.json 中关于用户管理的配置示例
  {
    "userManagement": {
      "multiUserMode": false, // true: 多用户共享模式; false: 自用模式 (纯本地或带全局密码)
      "singleUserPath": "default_user", // 自用模式下，相对于 userData 的路径名 (也作为默认用户的 ID)
      "accessPasswordHash": null // 自用模式下的可选全局访问密码哈希。如果为 null 或空字符串，则自用模式无需密码。
      // "defaultUserApiKeysPath": "apikeys.json" // (建议) 单用户模式下 API Keys 存储文件名，位于 userData/<singleUserPath>/
    }
    // ... 其他全局配置
  }
  ```

### 2.2. 用户上下文与身份 (`UserContext`)

为了在不同模式下统一处理用户信息和认证状态，并支持 API Key，我们定义了以下核心类型结构：

```typescript
// (示意) 核心类型定义，具体应在 packages/types/src/schemas.ts 中实现

/**
 * API Key 的元数据信息 (安全展示给用户，不包含完整 Key)
 */
export interface ApiKeyMetadata {
  id: string; // Key 的唯一内部 ID
  name?: string; // 用户为 Key 设置的可选名称/备注
  prefix: string; // Key 的前几位，用于识别，例如 "sk-xxxx"
  createdAt: string; // ISO 8601 创建时间戳
  lastUsedAt?: string; // ISO 8601 最后使用时间戳 (可选)
  scopes?: string[]; // (预留) 权限范围，例如 ["workflow:execute:*", "project:read:project_id_123"]
}

/**
 * 代表一个可以拥有 API Keys 的用户身份的基础接口
 */
export interface UserIdentityBase {
  apiKeys: ApiKeyMetadata[]; // 用户拥有的 API Key 列表 (仅元数据)
}

/**
 * 单用户模式下的默认用户身份信息
 */
export interface DefaultUserIdentity extends UserIdentityBase {
  id: string; // 通常是 'default_user' 或从 config.singleUserPath 派生
  username: string; // 例如 "本地用户" 或可配置的名称
}

/**
 * 多用户模式下已认证的用户身份信息
 */
export interface AuthenticatedMultiUserIdentity extends UserIdentityBase {
  uid: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
}

/**
 * 纯本地自用模式上下文 (无全局密码)
 */
export interface LocalNoPasswordUserContext {
  mode: "LocalNoPassword";
  multiUserMode: false;
  accessPasswordRequired: false;
  isAuthenticated: true; // 应用可用
  currentUser: DefaultUserIdentity;
}

/**
 * 个人远程访问模式上下文 (有全局密码)
 */
export interface LocalWithPasswordUserContext {
  mode: "LocalWithPassword";
  multiUserMode: false;
  accessPasswordRequired: true;
  isAuthenticatedWithGlobalPassword: boolean;
  currentUser: DefaultUserIdentity | null; // 浏览器会话验证成功后为 DefaultUserIdentity。若通过 API Key 认证，则 currentUser 始终为 DefaultUserIdentity。
}

/**
 * 多用户共享模式上下文
 */
export interface MultiUserSharedContext {
  mode: "MultiUserShared";
  multiUserMode: true;
  isAuthenticated: boolean; // 用户是否已登录
  currentUser: AuthenticatedMultiUserIdentity | null; // 登录后为用户详情
}

/**
 * 应用的统一用户上下文类型
 */
export type UserContext =
  | LocalNoPasswordUserContext
  | LocalWithPasswordUserContext
  | MultiUserSharedContext;
```

**关于 `DefaultUserIdentity` 的说明**:
在“纯本地自用模式 (Mode 1)”和“个人远程访问模式 (Mode 2)”下，`DefaultUserIdentity` 本质上代表同一个用户实体。它们共享相同的数据路径 (`config.userManagement.singleUserPath`) 和 API Key 列表。Mode 2 仅仅是在 Mode 1 的基础上，为**浏览器会话**增加了一道全局访问密码的门槛，而通过 API Key 的访问则不受此浏览器会话锁的直接影响（详见 2.7 节认证逻辑）。

### 2.3. API Key 系统详解

为了支持第三方应用集成和程序化调用，引入 API Key 机制。

- **核心目的**:

  - **身份认证**: 为非浏览器客户端提供安全的访问凭证。
  - **多 Key 管理**: 允许每个用户实体（包括单用户模式下的默认用户）生成和管理多个 API Key。
  - **调用跟踪**: 通过 Key ID 关联 API 调用，便于审计和分析。
  - **来源区分**: 用户可为 Key 命名，以区分不同应用或脚本的调用。
  - **权限控制 (Scopes - 用于授权)**: 通过 `scopes` 字段实现细粒度权限控制（授权 Authorization）。这明确了 API Key 不仅用于认证（Authentication - 确认身份），还用于确定该身份被允许执行的操作。授权检查发生在认证成功之后。

- **API Key 数据结构**:

  - `ApiKeyMetadata`: 用于安全展示和列表，包含 `id`, `name`, `prefix`, `createdAt`, `lastUsedAt`, `scopes?`。
  - `ApiKeyWithSecret`: 继承 `ApiKeyMetadata`，额外包含 `secret` (完整 Key)，仅在生成时一次性返回。
  - `StoredApiKey`: 继承 `ApiKeyMetadata`，额外包含 `hashedKey` (哈希后的 Key) 和 `userId` (关联的用户标识)，用于后端存储。

- **API Key 生命周期与管理**:

  - **生成**: 用户通过特定 API 创建 Key，可指定名称和（未来）权限范围。系统生成唯一 Key，返回完整 Key (`secret`) 一次。
  - **存储**: 后端存储 Key 的哈希值 (`hashedKey`)，绝不存储明文 Key。
  - **认证**: 客户端在请求头中（如 `Authorization: Bearer <ApiKeySecret>`）提供 Key。后端验证 Key 的有效性、未吊销、以及（未来）权限范围。
  - **展示**: 用户界面仅显示 Key 的元数据（如前缀、名称、创建时间）。
  - **吊销**: 用户可以随时吊销不再需要的 Key。

- **API Key 存储位置**:
  - **多用户模式**: `StoredApiKey` 信息与各自的用户记录关联（例如，在 `users.json` 中用户的条目内，或用户专属的 `apikeys.json` 文件中）。`userId` 字段存储用户的 `uid`。
  - **单用户模式**: `StoredApiKey` 信息存储在默认用户的数据目录下，例如 `userData/<singleUserPath>/apikeys.json`。`userId` 字段存储默认用户的 ID (例如 `config.userManagement.singleUserPath` 的值)。

### 2.4. 自用模式 (Single-User Mode) - 包含纯本地与个人远程访问

此模式由 `userManagement.multiUserMode: false` 控制。用户身份为 `DefaultUserIdentity`。

#### 2.4.1. 纯本地自用模式

- **激活条件**: `multiUserMode: false` 且 `accessPasswordHash` 未设置或为空。
- **用户上下文**: `LocalNoPasswordUserContext`。
- **目的**: 提供最简化的个人使用体验。
- **行为**:
  - **无认证**: 应用启动时不显示任何登录或密码输入界面。
  - **默认用户上下文**: 所有操作都在一个预定义的“默认用户”上下文中执行。其身份信息为 `DefaultUserIdentity`。
  - **数据存储**: 根据 `userManagement.singleUserPath` (默认为 "default_user")，数据存储在 `userData/<singleUserPath>/`。
  - `users.json` 文件不被使用。
  - **API 影响**: 用户管理及认证相关的 API (如用户注册、登录、全局密码验证) 在此模式下被禁用或返回特定状态。`/api/auth/current` 将始终返回 `LocalNoPasswordUserContext` 类型的默认用户信息，包含其 API Key 列表元数据。
  - **API Key 管理**: 默认用户可以通过 API 管理自己的 API Keys。
  - **管理员角色**: 不适用。

#### 2.4.2. 个人远程访问模式 (自用模式 + 全局访问密码)

- **激活条件**: `multiUserMode: false` 且 `accessPasswordHash` 已设置。
- **用户上下文**: `LocalWithPasswordUserContext`。
- **目的**: 为个人远程访问提供基础安全防护，同时保持单用户数据的简洁性。
- **行为**:
  - **全局密码认证**:
    - 应用启动或用户首次访问时，必须输入预设的全局访问密码。
    - 后端验证密码哈希。成功后，可建立一个简单的会话（例如，通过设置一个特定的 `HttpOnly` Cookie，标记该浏览器会话已通过全局密码验证）。
  - **默认用户上下文**: 认证成功后，所有操作仍在“默认用户”上下文中执行。其身份信息为 `DefaultUserIdentity`。
  - **数据存储**: 与纯本地自用模式相同，使用 `singleUserPath`。
  - `users.json` 文件不被使用。
  - **API 影响**:
    - 需要一个 API (例如 `POST /api/auth/verify-global-password`) 用于前端提交全局密码进行验证。
    - `/api/auth/current` 在验证成功后返回 `LocalWithPasswordUserContext` 类型的默认用户信息（包含 API Key 元数据），并可附加一个已认证状态。
    - 其他用户管理 API (如用户注册、登录) 禁用。
  - **API Key 管理**: 默认用户可以通过 API 管理自己的 API Keys。
  - **管理员角色**: 不适用。

### 2.5. 多用户共享模式 (Multi-User Shared Mode) - 独立账户认证

此模式由 `userManagement.multiUserMode: true` 激活。用户身份为 `AuthenticatedMultiUserIdentity`。

- **用户上下文**: `MultiUserSharedContext`。
- **目的**: 支持多用户在局域网等共享环境下独立使用应用，提供用户级别的数据隔离和配置。
- **核心特性**:

  - **强制用户认证**: 必须通过用户名和密码进行注册和登录。
  - **独立用户数据**: 每个用户的数据存储在其专属目录 `userData/<user_uuid>/`。
  - **会话管理**: 登录成功后，后端生成安全的会话凭证 (推荐 JWT)，通过 `HttpOnly` Cookie 传递给客户端。
  - **管理员角色**: 第一个成功注册的用户默认为管理员，拥有用户管理等特权。
  - **API Key 管理**: 每个注册用户可以通过 API 管理自己的 API Keys。
  - `/api/auth/current` 在用户登录后返回 `MultiUserSharedContext` 类型的当前用户信息（包含 API Key 元数据）。

- **用户账户与认证**:
  - **用户注册**:
    - 用户提供唯一的用户名和密码。
    - 后端对密码进行哈希处理 (例如使用 bcrypt 或 Argon2 并加盐) 后存储。
    - 系统为每个用户生成唯一的内部 UID (例如 UUID)。
  - **用户登录**:
    - 用户提供用户名和密码。
    - 后端验证凭证。
- **数据存储结构 (示例)**:
  ```
  userData/
  ├── <user_alpha_uuid>/
  │   ├── workflows/
  │   ├── projects/
  │   ├── settings.json   // 用户特定设置
  │   └── apikeys.json      // (建议) 用户 Alpha 的 API Keys
  ├── <user_beta_uuid>/
  │   └── ...
  └── users.json          // 存储用户列表 (username, uid, passwordHash, isAdmin, createdAt 等)
  ```
- **`users.json`**:
  - 在 `userData/` 根目录下维护，用于存储用户账户信息。
  - 示例：
    ```json
    [
      {
        "username": "Alice",
        "uid": "uuid-alice-123",
        "passwordHash": "...",
        "isAdmin": true,
        "createdAt": "timestamp"
      },
      {
        "username": "Bob",
        "uid": "uuid-bob-456",
        "passwordHash": "...",
        "isAdmin": false,
        "createdAt": "timestamp"
      }
    ]
    ```

**注意**: 对于本地或小范围局域网应用，使用单个 JSON 文件 (`users.json`) 存储用户信息是 MVP 阶段简单可行的方案。但需注意，频繁的并发读写操作可能导致文件损坏或数据不一致。若预期用户数或并发量可能显著增加，未来应考虑迁移到更可靠的嵌入式数据库（如 SQLite）以更好地处理事务和并发控制，确保数据完整性。

### 2.6. 管理员角色 (Admin Role) - 多用户模式

- **识别**:
  - **首次注册**: 第一个通过系统注册的用户默认为管理员 (在 `users.json` 中标记 `isAdmin: true`)。
  - 后续可通过管理员操作指定其他管理员（如果需要）。
- **权限 (初步)**:
  - **用户管理**: 查看所有用户列表、创建新用户账户、(可选)修改/删除用户账户。
  - **全局应用配置**: 访问和修改应用级别的全局设置 (存储于 `config.json` 或独立的全局配置文件中)。
- **访问控制**: 管理员拥有访问特定管理面板的权限。
- **扩展考虑**: 管理员可能需要管理系统级 API Key（如果存在此类概念）或查看所有用户的 API Key 元数据，甚至吊销任意用户的 API Key。这些属于高级功能，可后续迭代。

### 2.7. 认证中间件逻辑与优先级 (Authentication Middleware Logic & Priority)

为确保不同认证方式（全局密码、用户登录、API Key）能够清晰、无冲突地协同工作，后端认证中间件（或路由守卫）应遵循以下检查顺序和优先级：

1.  **首先检查 API Key (最高优先级)**:

    - 检查 HTTP 请求头中是否存在 `Authorization: Bearer <ApiKeySecret>`。
    - 如果存在：
      - 提取 `<ApiKeySecret>`。
      - 验证该 Key 的有效性（是否存在、是否被哈希匹配、是否未被吊销、是否在有效期内等）。
      - 如果 Key 合法有效：
        - 根据 Key 关联的 `userId` 确定当前用户身份 (`DefaultUserIdentity` 或 `AuthenticatedMultiUserIdentity`)。
        - 认证成功，填充 `UserContext` 中的 `currentUser`。
        - **跳过所有后续的认证检查** (即无需再检查全局密码 Cookie 或用户登录 Session Cookie)。API Key 被视为一种独立的、直接的身份凭证。

2.  **若无有效 API Key，则检查会话凭证 (Session Cookie)**:
    - 根据 `config.json` 中的 `userManagement.multiUserMode` 判断当前运行模式：
      - **纯本地自用模式 (Mode 1)**:
        - 无需任何 Cookie 验证。
        - 直接视为 `DefaultUserIdentity` 已认证，填充 `UserContext`。
      - **个人远程访问模式 (Mode 2 - 全局密码)**:
        - 检查是否存在标记“全局密码已验证通过”的有效会话 Cookie。
        - 如果 Cookie 有效，视为 `DefaultUserIdentity` 已认证，填充 `UserContext`。
        - 如果 Cookie 无效或缺失，认证失败 (通常返回 401 未授权或重定向到密码输入页)。
      - **多用户共享模式 (Mode 3 - 用户登录)**:
        - 检查是否存在有效的用户登录会话 Cookie (例如包含 JWT)。
        - 如果 Cookie 有效且可解析出用户身份，则视为对应的 `AuthenticatedMultiUserIdentity` 已认证，填充 `UserContext`。
        - 如果 Cookie 无效或缺失，认证失败 (通常返回 401 未授权或重定向到登录页)。

**核心原则**: API Key 主要用于程序化访问，认证的是「请求来源的程序/脚本」；而 Session Cookie 主要用于浏览器会话，认证的是「用户的浏览器会话」。一旦 API Key 认证成功，即代表该 Key 所属的用户发起了操作，应绕过针对浏览器会话设置的门槛（如全局密码验证或用户登录状态检查）。

## 3. 用户交互流程

### 3.1. 应用首次启动 / 无用户数据

1.  应用检查 `config.json` 确定运行模式。
2.  **纯本地自用模式**:
    a. 系统根据 `singleUserPath` 确定/创建默认用户数据路径。
    b. 直接进入应用主界面。
3.  **个人远程访问模式 (带全局密码)**:
    a. 系统检测到 `accessPasswordHash` 已配置。
    b. 提示用户输入全局访问密码。
    c. 验证密码。成功后进入应用主界面；失败则停留在密码输入界面。
    d. **首次设置全局密码**: 如果系统检测到 `accessPasswordHash` 为空或未设置，当应用首次被浏览器访问时，不应直接进入主界面。应显示一个“设置访问密码”的专属页面。用户输入并提交密码后，后端计算其哈希值，并安全地写回到 `config.json` 文件（或专门的配置文件）中。后续启动时，若检测到 `accessPasswordHash` 已存在，则遵循正常的全局密码验证流程 (如上 c 点)。
4.  **多用户共享模式**:
    a. 应用检测到 `users.json` 不存在或为空。
    b. 提示用户注册第一个账户，此账户将成为管理员。用户需输入用户名和密码。
    c. 系统创建用户记录，哈希密码，生成 UID，创建用户数据目录。
    d. 自动登录该管理员账户，进入应用主界面。

### 3.2. 应用启动 (已存在数据)

1.  应用检查 `config.json` 确定运行模式。
2.  **纯本地自用模式**:
    a. 加载默认用户数据。
    b. 直接进入应用主界面。
3.  **个人远程访问模式 (带全局密码)**:
    a. 提示用户输入全局访问密码。
    b. 验证通过后加载默认用户数据，进入应用主界面。
4.  **多用户共享模式**:
    a. 显示登录页面（可包含注册入口）。
    b. 用户输入用户名和密码进行登录。
    c. 验证成功后，加载该用户的配置和数据，进入应用主界面。
    d. 如果登录用户是管理员，则相关管理功能可用。

### 3.3. 用户注册 (多用户共享模式下)

- 用户通过登录页面的注册入口发起。
- 提供用户名、密码。系统进行验证和创建流程。

### 3.4. 用户注销 / 切换用户 (多用户共享模式下)

- 提供“注销”功能，清除当前用户的会话，返回登录页面。
- “切换用户”即注销后，另一用户重新登录。

### 3.5. API Key 管理界面交互 (所有模式)

- 用户在登录后（或在单用户模式下直接访问特定设置区域），应能访问 API Key 管理界面。
- 该界面允许用户：
  - 查看其拥有的 API Key 列表（显示名称、前缀、创建日期、最后使用日期、Scopes 等元数据）。
  - 创建新的 API Key（可指定名称，未来可指定 Scopes）。创建成功后，完整 Key 仅显示一次。
  - 吊销（删除）不再需要的 API Key。
  - （可选）编辑 API Key 的名称或 Scopes。

## 4. 后端 API

### 4.1. 认证与会话 API

- **个人远程访问模式 (自用模式 + 全局密码)**:
  - `POST /api/auth/verify-global-password`:
    - 请求体: `{ "password": "用户的输入" }`
    - 响应: 成功则设置会话 Cookie，失败则返回错误。
- **多用户共享模式**:
  - `POST /api/auth/register`:
    - 请求体: `{ "username": "...", "password": "..." }`
    - 响应: 成功则创建用户，(可选)自动登录并返回会话 Cookie。
  - `POST /api/auth/login`:
    - 请求体: `{ "username": "...", "password": "..." }`
    - 响应: 成功则设置会话 Cookie (JWT)。
  - `POST /api/auth/logout`:
    - 清除会话 Cookie。

### 4.2. 当前用户信息 API

- `GET /api/auth/current` (或 `/api/users/me`):
  - **响应**: 返回一个准确描述当前应用状态和用户认证情况的 `UserContext` 结构。此接口对于前端至关重要，用于决定应渲染哪个界面或执行何种操作。
  - **响应应能明确区分以下状态**:
    - **纯本地自用模式**: 返回 `LocalNoPasswordUserContext`，`isAuthenticated: true`。
    - **个人远程访问模式 (需要设置全局密码)**: 如果 `accessPasswordHash` 未设置，应返回特定状态或 `LocalWithPasswordUserContext` 的变体，指示前端需要引导用户设置全局密码。例如，`isAuthenticatedWithGlobalPassword: false`, `currentUser: null`, 并附加一个标志如 `globalPasswordSetupRequired: true`。
    - **个人远程访问模式 (需要输入全局密码)**: 如果 `accessPasswordHash` 已设置但用户未验证，返回 `LocalWithPasswordUserContext`，`isAuthenticatedWithGlobalPassword: false`, `currentUser: null`。
    - **个人远程访问模式 (已通过全局密码验证)**: 返回 `LocalWithPasswordUserContext`，`isAuthenticatedWithGlobalPassword: true`, `currentUser` 为 `DefaultUserIdentity`。
    - **多用户共享模式 (需要注册首个管理员)**: 如果 `users.json` 为空，应返回特定状态或 `MultiUserSharedContext` 的变体，指示前端需要引导用户注册首个管理员账户。例如，`isAuthenticated: false`, `currentUser: null`, 并附加标志如 `adminRegistrationRequired: true`。
    - **多用户共享模式 (需要登录)**: 如果用户未登录，返回 `MultiUserSharedContext`，`isAuthenticated: false`, `currentUser: null`。
    - **多用户共享模式 (已登录)**: 返回 `MultiUserSharedContext`，`isAuthenticated: true`, `currentUser` 为 `AuthenticatedMultiUserIdentity`。
  - 响应体将包含当前用户的详细信息（如 `DefaultUserIdentity` 或 `AuthenticatedMultiUserIdentity`，若已认证），包括其 `apiKeys` 列表的元数据。

### 4.3. 管理员 API (仅在多用户共享模式下，且当前用户为管理员时可用)

- `GET /api/admin/users`: 获取所有用户列表的详细信息。
- `POST /api/admin/users`: (管理员) 创建新用户账户。
- `PUT /api/admin/users/{userId}`: (管理员) 修改指定用户信息。
- `DELETE /api/admin/users/{userId}`: (管理员) 删除指定用户。
- `GET /api/admin/settings`: 获取全局应用配置。
- `POST /api/admin/settings`: 更新全局应用配置。
- **扩展考虑**: 管理员可能需要 API 来查看所有用户的 API Key 元数据（出于审计目的）或强制吊销某个用户的某个 API Key。

### 4.4. 会话管理 (Cookie)

- **通用原则**:
  - 使用 `HttpOnly` Cookie 存储会话标识，增强安全性。
  - 在 HTTPS 环境下，Cookie 应标记为 `Secure`。
  - `Path=/`，`SameSite=Lax` (或 `Strict`)。
- **个人远程访问模式**: Cookie 可以是一个简单的会话 ID，标记已通过全局密码验证。
- **多用户共享模式**: Cookie 存储 JWT 或其他安全的会话令牌，包含用户 UID 等信息。

### 4.5. API Key 管理 API (新增)

这些 API 通常需要用户已通过会话认证（无论是单用户模式下的默认用户，还是多用户模式下的登录用户）才能调用，操作的是调用者自身的 API Key。

- **`GET /api/users/me/apikeys`**:
  - **目的**: 获取当前认证用户的所有 API Key 元数据。
  - **响应**: `200 OK` - `{ keys: ApiKeyMetadata[] }`
- **`POST /api/users/me/apikeys`**:
  - **目的**: 为当前认证用户创建一个新的 API Key。
  - **请求体**: `{ name?: string; scopes?: string[] }` (scopes 初期可忽略或赋予默认值)
  - **响应**: `201 Created` - `ApiKeyWithSecret` (包含一次性显示的完整 Key)
- **`DELETE /api/users/me/apikeys/{keyId}`**:
  - **目的**: 删除当前认证用户指定的 API Key。
  - **路径参数**: `keyId` - 要删除的 API Key 的 ID。
  - **响应**: `204 No Content` (成功) 或 `404 Not Found` / `403 Forbidden`。
- **`PUT /api/users/me/apikeys/{keyId}`**: (可选扩展)
  - **目的**: 更新 API Key 的信息（如名称、scopes）。
  - **请求体**: `{ name?: string; scopes?: string[] }`
  - **响应**: `200 OK` - `ApiKeyMetadata`

## 5. 前端实现要点

- **模式识别**: 前端需要能够从后端（例如通过 `/api/auth/current` 接口的响应，其中包含 `mode` 字段）获取当前应用的准确运行模式（纯本地自用、个人远程带密码、多用户共享）和用户认证状态。
- **UI 动态调整**:
  - **纯本地自用**: 无任何登录/密码界面，直接展示应用核心功能。用户设置区域提供 API Key 管理入口。
  - **个人远程访问 (带全局密码)**:
    - 若需要认证，显示全局密码输入界面。
    - 认证成功后，用户设置区域提供 API Key 管理入口。
    - 无用户列表、用户管理等功能。
  - **多用户共享**:
    - 显示登录/注册界面。
    - 登录后，用户设置区域提供 API Key 管理入口。
    - 根据用户是否为管理员，动态显示/隐藏管理面板和相关功能。
    - 无用户选择列表（用户通过登录识别）。
- **状态管理 (Pinia 等)**: 存储当前用户认证状态、用户信息 (`UserContext`)、应用模式等。
- **API 调用**: 根据不同模式调用相应的认证和数据 API。
- **API Key 管理界面**: 提供用户界面让用户创建、查看（元数据）、命名和吊销自己的 API Key。创建时应有明确提示，完整 Key 仅显示一次。

## 6. 安全性与后续考虑

### 6.1. 密码安全

- **哈希存储**: 所有密码（全局访问密码、用户账户密码）在存储前必须使用强哈希算法（如 bcrypt, Argon2）并加盐。**严禁明文存储密码。**
- **传输安全**: 在生产环境中，所有涉及密码传输的通信必须使用 HTTPS。

### 6.2. 会话安全

- 遵循 Cookie 安全最佳实践 (`HttpOnly`, `Secure`, `SameSite`)。
- JWT (如果用于多用户模式) 应有合理的过期时间，并考虑刷新机制。

### 6.3. API Key 安全 (新增)

- **严禁明文存储**: API Key 的 `secret` 绝不能在后端明文存储，必须存储其强哈希值。
- **仅生成时显示**: 完整的 API Key `secret` 仅在创建成功时一次性显示给用户，之后无法再次获取。
- **HTTPS 传输**: 所有涉及 API Key 创建、认证的通信必须通过 HTTPS。
- **最小权限原则 (Scopes - 用于授权)**: 通过 `scopes` 机制限制 API Key 的权限范围，确保 Key 仅能访问其被授权的资源和操作，避免过度授权。这是实现授权 (Authorization) 的关键部分，在 API Key 通过认证 (Authentication) 后，具体 API 路由守卫会检查请求操作是否在 Key 的 `scopes` 允许范围内。
- **定期审计与轮换**: 鼓励用户定期审查和轮换 API Key。
- **安全存储客户端 Key**: 指导用户在客户端或第三方应用中安全存储 API Key。
- **前缀标识**: 使用 Key 前缀 (如 `sk-`) 帮助识别和日志审计。
- **高熵随机性**: 确保生成的 API Key 具有足够高的熵值（即足够长且字符集足够随机），使其难以被猜测或暴力破解。

### 6.4. 扩展点

- **用户数据导入/导出**: 允许用户（在自用模式或多用户模式下导出自己的数据）导出其数据。
- **“访客”模式 (多用户)**: 一个临时的、不保存数据的用户会话。
- **与未来联网系统的兼容性**: 当前设计为后续扩展到更复杂的认证机制（如 OAuth2）和权限体系奠定基础。
- **细化的 API Key Scopes**: 实现完整的权限范围定义、分配和检查机制。
- **团队/组织账户**: 在多用户基础上支持更复杂的组织结构。
- **API Key 用量与限制**: 跟踪 Key 的使用频率，实现速率限制或配额。
- **细化的权限管理 (多用户)**: 超越简单的“管理员/普通用户”二分法，引入更灵活的角色和权限系统。

### 6.5. 接口限流 (Rate Limiting)

为了防止暴力破解攻击和滥用，应对关键认证接口和 API Key 调用实施速率限制：

- **目标接口**:
  - `POST /api/auth/verify-global-password` (个人远程访问模式下的全局密码验证)
  - `POST /api/auth/login` (多用户模式下的用户登录)
  - 所有通过 API Key 进行认证的请求。
- **策略**: 可以基于 IP 地址、用户 ID (如果已认证) 或 API Key ID 进行限流。例如，限制在特定时间窗口内（如每分钟、每小时）的尝试次数。
- **反馈**: 当达到限制时，应返回适当的 HTTP 状态码（如 `429 Too Many Requests`）并提示用户稍后再试。

## 7. 技术选型与依赖

- **UID 生成**: `uuid` 库 (例如 `bun:uuid`)。
- **密码哈希**: `bcrypt` 或 Bun 内置的密码工具 (如 `Bun.password.hash`)。
- **API Key 哈希**: 推荐使用与密码哈希同等级别的强哈希算法，如 Argon2, bcrypt。或者，由于 API Key 通常熵较高，也可以使用加盐的 SHA-256/SHA-512。Bun 内置的 `Bun.password.hash` (基于 bcrypt) 也可用于哈希 API Key。
- **Cookie 处理 (后端)**: Elysia 框架内置支持。
- **JWT 处理 (如果使用)**: 例如 `jose` 或 `@elysiajs/jwt`。

## 8. Mermaid 类图 (用户上下文与 API Key)

```mermaid
classDiagram
    direction LR

    class UserIdentityBase {
        +ApiKeyMetadata[] apiKeys
    }

    class DefaultUserIdentity {
        +string id
        +string username
    }
    UserIdentityBase <|-- DefaultUserIdentity

    class AuthenticatedMultiUserIdentity {
        +string uid
        +string username
        +boolean isAdmin
        +string createdAt
    }
    UserIdentityBase <|-- AuthenticatedMultiUserIdentity

    class UserContext {
        <<Union>>
        +string mode
        +boolean multiUserMode
    }

    class LocalNoPasswordUserContext {
        +mode: "LocalNoPassword"
        +multiUserMode: false
        +accessPasswordRequired: false
        +isAuthenticated: true
        +DefaultUserIdentity currentUser
    }
    UserContext <|-- LocalNoPasswordUserContext
    LocalNoPasswordUserContext o-- DefaultUserIdentity

    class LocalWithPasswordUserContext {
        +mode: "LocalWithPassword"
        +multiUserMode: false
        +accessPasswordRequired: true
        +boolean isAuthenticatedWithGlobalPassword
        +DefaultUserIdentity | null currentUser
    }
    UserContext <|-- LocalWithPasswordUserContext
    LocalWithPasswordUserContext o-- DefaultUserIdentity

    class MultiUserSharedContext {
        +mode: "MultiUserShared"
        +multiUserMode: true
        +boolean isAuthenticated
        +AuthenticatedMultiUserIdentity | null currentUser
    }
    UserContext <|-- MultiUserSharedContext
    MultiUserSharedContext o-- AuthenticatedMultiUserIdentity

    class ApiKeyMetadata {
        +string id
        +string name?
        +string prefix
        +string createdAt
        +string lastUsedAt?
        +string[] scopes?
    }
    UserIdentityBase o-- "0..*" ApiKeyMetadata

    class ApiKeyWithSecret {
        +string secret
    }
    ApiKeyMetadata <|-- ApiKeyWithSecret

    class StoredApiKey {
        +string hashedKey
        +string userId
    }
    ApiKeyMetadata <|-- StoredApiKey

    package "API Endpoints" {
        class AuthCurrentApi {
            "<<GET /api/auth/current>>"
            +UserContext response
        }
        AuthCurrentApi ..> UserContext

        class ManageApiKeysApi {
            "<<CRUD /api/users/me/apikeys>>"
            # "Request: { name?: string; scopes?: string[] }"
            +ApiKeyMetadata[] getResponse
            +ApiKeyWithSecret postResponse
        }
        ManageApiKeysApi ..> ApiKeyMetadata
        ManageApiKeysApi ..> ApiKeyWithSecret
    }
```

## 9. 分阶段实施与 MVP 考量 (新增)

此完整方案描述了一个功能相对全面的本地用户系统。在实际开发中，可根据优先级分阶段实施：

- **MVP (Minimum Viable Product) 可能的范围**:

  - **核心用户模式**:
    1.  **阶段 1a (最简)**: 实现 `LocalNoPasswordUserContext`。应用启动即用，无任何认证。此时 `UserContext` 类型可极大简化。
    2.  **阶段 1b (基础远程)**: 在 1a 基础上增加 `LocalWithPasswordUserContext`，支持全局密码访问。
  - **API Key**: MVP 阶段可不包含 API Key 功能。若考虑最简支持，可在单用户模式下通过配置文件硬编码一个全局 API Key，无管理界面。

- **后续迭代路径**:
  1.  **多用户模式**: 实现 `MultiUserSharedContext`，包括用户注册、登录、数据隔离、管理员角色。
  2.  **基础 API Key 管理**: 为所有用户实体（默认用户和注册用户）引入 API Key 生成与认证机制。Key 默认拥有其所属用户的完全权限。提供基础的 API Key 管理接口（创建、列表、吊销）。
  3.  **增强 API Key 功能**: 完善 API Key 管理界面，支持命名、查看使用情况。
  4.  **API Key Scopes**: 逐步引入并实现 `scopes` 机制，提供细粒度的权限控制。
  5.  **高级功能**: 如团队账户、OAuth2 集成、更复杂的权限模型等。

这个方案通过明确区分三种核心使用场景及引入 API Key 机制，力求在不同场景下平衡应用的便捷性、安全性和功能需求，并为未来的扩展打下良好基础。
