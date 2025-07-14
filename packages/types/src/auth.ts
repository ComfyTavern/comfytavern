import { z } from 'zod';

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
  userId: string; // 关联的用户ID (统一为 uid)
  storageMode: 'plaintext' | 'encrypted';
  credentialValue: string;
}

export const CreateExternalCredentialPayloadSchema = z.object({
  serviceName: z.string().min(1, { message: '服务名称不能为空' }),
  displayName: z.string().optional(),
  credential: z.string().min(1, { message: '凭证内容不能为空' }),
});
export type CreateExternalCredentialPayload = z.infer<typeof CreateExternalCredentialPayloadSchema>;

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
  userId: string; // 关联的用户ID (统一为 uid)
  hashedKey: string;
}

/**
 * 创建服务 API 密钥时，一次性返回给用户的包含完整密钥的结构
 */
export interface ServiceApiKeyWithSecret extends ServiceApiKeyMetadata {
  secret: string; // 完整、明文的 API 密钥，仅在生成时一次性显示
}

export const CreateServiceApiKeyPayloadSchema = z.object({
  name: z.string().optional(),
  // scopes: z.array(z.string()).optional(), // 预留，与后端保持一致
});
export type CreateServiceApiKeyPayload = z.infer<typeof CreateServiceApiKeyPayloadSchema>;

// --- 统一的用户身份与上下文模型 (v4 核心简化) ---

/**
 * 代表一个可以拥有两种密钥的用户身份的基础接口
 */
export interface UserIdentityBase {
  avatarUrl?: string; // 用户头像 URL (可选)
  serviceApiKeys: ServiceApiKeyMetadata[]; // 用户拥有的服务 API 密钥列表 (仅元数据)
  externalCredentials: ExternalCredentialMetadata[]; // 用户拥有的外部服务凭证列表 (仅元数据)
}

/**
 * 统一的用户身份模型 (v4 新增)
 * 该模型同时适用于单用户模式下的“默认用户”和多用户模式下的注册用户。
 */
export interface UserIdentity extends UserIdentityBase {
  // 统一的用户标识符。
  // - 在单用户模式下，其值为固定的 'default_user'。
  // - 在多用户模式下，其值为用户的 UUID。
  uid: string;
  username: string;
  isAdmin: boolean; // 在单用户模式下，此值无实际意义，可默认为 false。
  createdAt: string;
}

/**
 * 单用户模式上下文 (v4 新增, 统一了有无密码的场景)
 */
export interface SingleUserContext {
  mode: "SingleUser";
  multiUserMode: false;
  accessPasswordRequired: boolean; // 标记是否配置了全局访问密码
  isAuthenticated: boolean; // 标记浏览器会话是否已通过认证。在无密码时，恒为 true。
  currentUser: UserIdentity | null; // 认证成功后为默认用户信息，否则为 null。
  globalPasswordSetupRequired?: boolean; // (可选) 用于首次设置密码的引导
}

/**
 * 多用户共享模式上下文 (v4 调整)
 */
export interface MultiUserContext {
  mode: "MultiUser";
  multiUserMode: true;
  isAuthenticated: boolean; // 标记用户是否已通过账户密码登录
  currentUser: UserIdentity | null; // 登录后为该用户的详细信息
  adminRegistrationRequired?: boolean; // (可选) 用于首次注册管理员的引导
}

/**
 * 应用的统一用户上下文类型 (v4 简化)
 * 由后端在每次请求时动态确定和填充。
 */
export type UserContext =
  | SingleUserContext
  | MultiUserContext;