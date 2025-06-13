import { z } from 'zod';
import { GroupSlotInfoSchema } from './node';

// --- Stream & Regex Schemas ---



/**
 * RegexRule 相关的类型和 Schema
 */
export interface RegexRule {
  name: string;
  pattern: string;
  replacement: string;
  flags?: string;
  description?: string;
  enabled?: boolean;
}

export const RegexRuleSchema = z.object({
  name: z.string().min(1, { message: "规则名称不能为空" }),
  pattern: z.string().min(1, { message: "正则表达式不能为空" }),
  replacement: z.string(),
  flags: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional().default(true),
});

export const RegexRuleArraySchema = z.array(RegexRuleSchema);


// --- Node & Action Schemas ---

/**
 * Schema 定义：节点输入操作按钮的配置
 */
export const NodeInputActionSchema = z.object({
  id: z.string(),
  icon: z.string().optional(),
  label: z.string().optional(),
  tooltip: z.string().optional(),
  handlerType: z.enum(['builtin_preview', 'builtin_editor', 'emit_event', 'client_script_hook', 'open_panel']),
  handlerArgs: z.record(z.any()).optional(),
});
export type NodeInputAction = z.infer<typeof NodeInputActionSchema>;

/**
 * Schema 定义：节点组的接口信息，包含输入和输出插槽。
 */
export const GroupInterfaceInfoSchema = z.object({
  inputs: z.record(z.lazy(() => GroupSlotInfoSchema)).optional(),
  outputs: z.record(z.lazy(() => GroupSlotInfoSchema)).optional()
});
export type GroupInterfaceInfo = z.infer<typeof GroupInterfaceInfoSchema>;


// --- Project & Execution Schemas ---

/**
 * Schema 定义：项目元数据。
 */
export const ProjectMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  templateUsed: z.string().optional(),
  preferredView: z.enum(["editor", "custom"]).optional().default("editor"),
  schemaVersion: z.string(),
  customMetadata: z.record(z.any()).optional()
});
export type ProjectMetadata = z.infer<typeof ProjectMetadataSchema>;

/**
 * Schema 定义：用于执行引擎的简化节点结构。
 */
export const ExecutionNodeSchema = z.object({
  id: z.string(),
  fullType: z.string(),
  inputs: z.record(z.any()).optional(),
  configValues: z.record(z.any()).optional(),
  bypassed: z.boolean().optional(),
  inputConnectionOrders: z.record(z.array(z.string())).optional(),
});
export type ExecutionNode = z.infer<typeof ExecutionNodeSchema>;

/**
 * Schema 定义：用于执行引擎的简化边结构。
 */
export const ExecutionEdgeSchema = z.object({
  id: z.string().optional(),
  sourceNodeId: z.string(),
  sourceHandle: z.string(),
  targetNodeId: z.string(),
  targetHandle: z.string(),
});
export type ExecutionEdge = z.infer<typeof ExecutionEdgeSchema>;

/**
 * Schema 定义：发送到后端以启动工作流执行的有效负载 (payload)。
 */
export const WorkflowExecutionPayloadSchema = z.object({
  workflowId: z.string().optional(),
  nodes: z.array(ExecutionNodeSchema),
  edges: z.array(ExecutionEdgeSchema),
  interfaceInputs: z.record(GroupSlotInfoSchema).optional(),
  interfaceOutputs: z.record(GroupSlotInfoSchema).optional(),
  outputInterfaceMappings: z.record(z.object({ sourceNodeId: z.string(), sourceSlotKey: z.string() })).optional(),
});
// 注意: WorkflowExecutionPayload 类型定义在 execution.ts 中，以避免循环依赖。

// --- 用户系统核心类型定义 ---

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
