import type {
  ServiceApiKeyMetadata,
  ServiceApiKeyWithSecret,
  ExternalCredentialMetadata,
  StoredExternalCredential,
  CreateServiceApiKeyPayload,
  CreateExternalCredentialPayload,
} from '@comfytavern/types';
import { useApi } from '@/utils/api';

const BASE_PATH = '/users/me';

// --- Service API Keys ---

/**
 * 列出当前用户的所有服务 API 密钥元数据。
 * @returns 一个解析为 ServiceApiKeyMetadata 数组的 Promise。
 */
export async function listServiceApiKeys(): Promise<ServiceApiKeyMetadata[]> {
  const { get } = useApi();
  return get<ServiceApiKeyMetadata[]>(`${BASE_PATH}/service-keys`);
}

/**
 * 为当前用户创建一个新的服务 API 密钥。
 * @param payload 创建密钥所需的参数，如名称和范围。
 * @returns 一个解析为包含密钥秘密的 ServiceApiKeyWithSecret 对象的 Promise。
 */
export async function createServiceApiKey(payload: CreateServiceApiKeyPayload): Promise<ServiceApiKeyWithSecret> {
  const { post } = useApi();
  return post<ServiceApiKeyWithSecret>(`${BASE_PATH}/service-keys`, payload);
}

/**
 * 删除当前用户指定的服务 API 密钥。
 * @param keyId 要删除的密钥的 ID。
 * @returns 一个在成功时解析的 Promise。
 */
export async function deleteServiceApiKey(keyId: string): Promise<void> {
  const { del } = useApi();
  await del<void>(`${BASE_PATH}/service-keys/${keyId}`);
}

// --- External Service Credentials ---

/**
 * 列出当前用户的所有外部服务凭证元数据。
 * @returns 一个解析为 ExternalCredentialMetadata 数组的 Promise。
 */
export async function listExternalCredentials(): Promise<ExternalCredentialMetadata[]> {
  const { get } = useApi();
  return get<ExternalCredentialMetadata[]>(`${BASE_PATH}/credentials`);
}

/**
 * 为当前用户添加一个新的外部服务凭证。
 * @param payload 创建凭证所需的参数，如服务名称、凭证内容等。
 * @returns 一个解析为 StoredExternalCredential 对象的 Promise (不含敏感信息)。
 */
export async function createExternalCredential(payload: CreateExternalCredentialPayload): Promise<StoredExternalCredential> {
  const { post } = useApi();
  return post<StoredExternalCredential>(`${BASE_PATH}/credentials`, payload);
}

/**
 * 删除当前用户指定的外部服务凭证。
 * @param credentialId 要删除的凭证的 ID。
 * @returns 一个在成功时解析的 Promise。
 */
export async function deleteExternalCredential(credentialId: string): Promise<void> {
  const { del } = useApi();
  await del<void>(`${BASE_PATH}/credentials/${credentialId}`);
}