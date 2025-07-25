import { ILlmApiAdapter } from '@comfytavern/types';
import { OpenAIAdapter } from '../adapters/OpenAIAdapter';

/**
 * 一个简单的服务，用于在内存中注册和检索 LLM API 适配器的单例。
 */
export class LlmApiAdapterRegistry {
  private adapters: Map<string, ILlmApiAdapter> = new Map();

  constructor() {
    this.registerDefaultAdapters();
    console.log('[LlmApiAdapterRegistry] Initialized and default adapters registered.');
  }

  private registerDefaultAdapters(): void {
    this.registerAdapter('openai', new OpenAIAdapter());
    // 未来可以在这里注册其他适配器，例如 new OllamaAdapter()
  }

  /**
   * 注册一个 LLM 适配器实例。
   * @param adapterType - 适配器的类型标识符 (e.g., 'openai', 'ollama')。
   * @param adapterInstance - 适配器的实例。
   */
  public registerAdapter(adapterType: string, adapterInstance: ILlmApiAdapter): void {
    if (this.adapters.has(adapterType)) {
      console.warn(`[LlmApiAdapterRegistry] Adapter type "${adapterType}" is already registered. Overwriting.`);
    }
    this.adapters.set(adapterType, adapterInstance);
    console.log(`[LlmApiAdapterRegistry] Adapter "${adapterType}" registered.`);
  }

  /**
   * 根据类型获取一个已注册的 LLM 适配器实例。
   * @param adapterType - 适配器的类型标识符。
   * @returns 适配器实例，如果未找到则返回 undefined。
   */
  public getAdapter(adapterType: string): ILlmApiAdapter | undefined {
    return this.adapters.get(adapterType);
  }

  /**
   * 获取所有可用的提供商及其基本信息。
   * @returns 一个包含提供商信息的数组。
   */
  public getAvailableProviders(): { id: string; name: string }[] {
    // 在未来，这个 name 应该从适配器本身的一个属性中获取
    const providerDisplayNames: Record<string, string> = {
      openai: 'OpenAI',
      anthropic: 'Anthropic (Claude)',
      google: 'Google (Gemini)',
      cohere: 'Cohere',
      ollama: 'Ollama',
      custom: '自定义',
    };

    return Array.from(this.adapters.keys()).map(id => ({
      id,
      name: providerDisplayNames[id] || id,
    }));
  }
}