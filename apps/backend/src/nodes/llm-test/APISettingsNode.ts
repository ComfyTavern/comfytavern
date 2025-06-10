import type { NodeDefinition } from '@comfytavern/types'

// 本地类型定义，仅此节点使用
interface APISettings {
  use_env_vars: boolean;
  base_url: string;
  api_key: string;
}
// Removed: import { nodeManager } from '../NodeManager'

export class APISettingsNodeImpl {
  static async execute(inputs: Record<string, any>): Promise<Record<string, any>> {
    const { use_env_vars, base_url, api_key } = inputs

    let finalBaseUrl = base_url
    let finalApiKey = api_key

    if (use_env_vars) {
      finalBaseUrl = process.env.OPENAI_API_BASE || base_url
      finalApiKey = process.env.OPENAI_API_KEY || api_key
    }

    // 根据用户建议，智能处理 base_url：
    // - 如果路径中已包含版本信息 (如 /v1, /v1beta)，则不处理。
    // - 如果是裸域名或仅有根路径，则追加 /v1。
    // - 如果是其他自定义路径且无版本信息，则不处理。
    // - 如果不是已知格式的URL，则警告并保持原样。
    try {
      const url = new URL(finalBaseUrl);
      const currentPath = url.pathname;
      // 构造域名+协议部分，例如 "https://api.example.com"
      const hostAndProtocol = `${url.protocol}//${url.host}`;

      // 正则表达式用于检测常见的API版本模式，例如 /v1, /v1beta, /v2.0
      const versionPattern = /\/v\d+([a-zA-Z0-9.-]*)/;

      if (versionPattern.test(currentPath)) {
        // 路径已包含版本字符串 (例如 /v1, /v1beta)，不执行任何操作。
      } else {
        // 路径不包含 /v... 模式。
        if (currentPath === '/') {
          // 裸域名或根路径 (例如 https://api.example.com 或 https://api.example.com/)。
          // 追加 /v1。
          finalBaseUrl = hostAndProtocol + '/v1';
        } else {
          // 自定义路径且不匹配 /v... 模式 (例如 /myapi, /custom/path)。
          // 假设用户已提供特定路径，不执行任何操作。
        }
      }
    } catch (e: any) {
      // finalBaseUrl 不是一个的已知格式的 URL。记录警告并继续，不修改 finalBaseUrl。
      // 下游节点或 API 调用将处理无效的 URL。
      console.warn(
        `APISettingsNode: base_url "${finalBaseUrl}" 不是一个已知格式的 URL。它将按原样使用。错误: ${e.message}`
      );
    }

    return {
      api_settings: {
        use_env_vars,
        base_url: finalBaseUrl,
        api_key: finalApiKey,
      } as APISettings
    }
  }
}

// Renamed export to 'definition'
export const definition: NodeDefinition = {
  type: 'APISettings', // Base type name
  // namespace will be set via index.ts registerer (e.g., 'builtin')
  category: 'TEST-LLM', // Functional category
  displayName: '🦉API设置',
  description: '配置 OpenAI API 或其他兼容 API 的连接信息',

  inputs: {
    use_env_vars: {
      dataFlowType: 'BOOLEAN',
      displayName: '使用环境变量',
      description: '是否使用环境变量获取 API 密钥和基础 URL',
      required: true,
      config: {
        default: false
      }
    },
    base_url: {
      dataFlowType: 'STRING',
      displayName: 'API 基础 URL',
      description: 'OpenAI API 的基础 URL',
      required: true,
      matchCategories: ['Url'],
      config: {
        default: 'https://api.openai.com/v1',
        multiline: false
      }
    },
    api_key: {
      dataFlowType: 'STRING',
      displayName: 'API 密钥',
      description: '用于身份验证的 OpenAI API 密钥',
      required: true,
      config: {
        default: '',
        multiline: false
      }
    }
  },

  outputs: {
    api_settings: {
      dataFlowType: 'OBJECT', // API_SETTINGS maps to OBJECT
      displayName: 'API 配置',
      description: '包含 API 密钥和基础 URL 的配置信息',
      matchCategories: ['LlmConfig']
    }
  },

  execute: APISettingsNodeImpl.execute
}

// Removed: Node registration is now handled by index.ts