import { famService } from './FileManagerService';

// 定义插件状态配置文件的逻辑路径
const CONFIG_FILE_PATH = 'system://config/plugin_states.json';

/**
 * 定义插件状态的接口。
 * 键是插件的名称 (例如 "hello-world-plugin")，
 * 值是包含启用状态的对象。
 */
export interface PluginStates {
  [pluginName: string]: {
    enabled: boolean;
  };
}

/**
 * 负责管理插件启用/禁用状态的全局配置。
 * 配置存储在 userData/config/plugin_states.json 中。
 */
class PluginConfigService {
  private pluginStates: PluginStates | null = null;
  private isInitialized = false;

  constructor() {
    // 初始化时加载一次配置
    this.loadConfig().catch(error => {
      console.error('[PluginConfigService] Initial config load failed:', error);
    });
  }

  /**
   * 从文件加载插件状态配置。
   * 如果文件不存在，则初始化为空对象。
   */
  private async loadConfig(): Promise<void> {
    try {
      const fileExists = await famService.exists(null, CONFIG_FILE_PATH);
      if (fileExists) {
        const content = await famService.readFile(null, CONFIG_FILE_PATH);
        this.pluginStates = JSON.parse(content.toString('utf-8'));
      } else {
        // 文件不存在，初始化为空状态
        this.pluginStates = {};
        // 立即创建一个空的配置文件，避免后续操作失败
        await this.saveConfig();
      }
    } catch (error) {
      console.error('[PluginConfigService] Error loading plugin states config:', error);
      // 如果加载失败，设置为一个空对象以保证服务的可用性
      this.pluginStates = {};
    }
    this.isInitialized = true;
  }

  /**
   * 将当前的插件状态保存到文件。
   */
  private async saveConfig(): Promise<void> {
    if (this.pluginStates === null) {
      // 如果状态从未被加载，则不执行保存操作，防止覆盖
      console.warn('[PluginConfigService] Attempted to save config before it was loaded. Operation skipped.');
      return;
    }
    try {
      const content = JSON.stringify(this.pluginStates, null, 2);
      await famService.writeFile(null, CONFIG_FILE_PATH, Buffer.from(content, 'utf-8'));
    } catch (error) {
      console.error('[PluginConfigService] Error saving plugin states config:', error);
      throw error; // 重新抛出错误，让调用者知道保存失败
    }
  }

  /**
   * 确保配置已初始化。
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.loadConfig();
    }
  }

  /**
   * 获取所有插件的状态。
   * @returns {Promise<PluginStates>} 包含所有插件状态的对象。
   */
  public async getAllPluginStates(): Promise<PluginStates> {
    await this.ensureInitialized();
    return this.pluginStates ?? {};
  }

  /**
   * 获取特定插件的启用状态。
   * @param {string} pluginName - 插件的名称。
   * @returns {Promise<boolean>} 如果插件启用或未定义（默认为启用），则返回 true；否则返回 false。
   */
  public async isPluginEnabled(pluginName: string): Promise<boolean> {
    await this.ensureInitialized();
    // 默认情况下，如果一个插件没有在配置文件中明确禁用，我们视其为启用。
    return this.pluginStates?.[pluginName]?.enabled ?? true;
  }

  /**
   * 设置特定插件的启用状态。
   * @param {string} pluginName - 插件的名称。
   * @param {boolean} enabled - true 表示启用, false 表示禁用。
   */
  public async setPluginState(pluginName: string, enabled: boolean): Promise<void> {
    await this.ensureInitialized();
    if (this.pluginStates) {
      this.pluginStates[pluginName] = { enabled };
      await this.saveConfig();
    }
  }
}

// 导出单例
export const pluginConfigService = new PluginConfigService();