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

    // 确保base_url以/v1结尾
    if (!finalBaseUrl.endsWith('/v1')) {
      finalBaseUrl = finalBaseUrl.replace(/\/$/, '') + '/v1'
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