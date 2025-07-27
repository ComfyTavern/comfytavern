import { famService } from './FileManagerService';

// 定义插件状态配置文件的逻辑路径
const STATE_CONFIG_PATH = 'system://config/plugin_states.json';
const INSTANCE_SETTINGS_DIR = 'system://config/extensions/';
const USER_SETTINGS_DIR_TPL = 'user://settings/extensions/';

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
 * 定义插件详细设置的接口。
 */
export type PluginSettings = Record<string, any>;


/**
 * 负责管理插件配置，包括启用/禁用状态和详细的分层设置。
 * 状态配置存储在: userData/config/plugin_states.json
 * 实例级设置存储在: userData/config/extensions/{pluginName}.json
 * 用户级设置存储在: userData/{userId}/settings/extensions/{pluginName}.json
 */
class PluginConfigService {
  private pluginStates: PluginStates | null = null;
  private isInitialized = false;
  private settingsCache = new Map<string, PluginSettings>();

  constructor() {
    // 初始化时加载一次配置
    this.loadStateConfig().catch(error => {
      console.error('[PluginConfigService] Initial state config load failed:', error);
    });
  }

  /**
   * 从文件加载插件状态配置。
   * 如果文件不存在，则初始化为空对象。
   */
  private async loadStateConfig(): Promise<void> {
    try {
      const fileExists = await famService.exists(null, STATE_CONFIG_PATH);
      if (fileExists) {
        const content = await famService.readFile(null, STATE_CONFIG_PATH);
        this.pluginStates = JSON.parse(content.toString('utf-8'));
      } else {
        // 文件不存在，初始化为空状态
        this.pluginStates = {};
        // 立即创建一个空的配置文件，避免后续操作失败
        await this.saveStateConfig();
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
  private async saveStateConfig(): Promise<void> {
    if (this.pluginStates === null) {
      // 如果状态从未被加载，则不执行保存操作，防止覆盖
      console.warn('[PluginConfigService] Attempted to save state config before it was loaded. Operation skipped.');
      return;
    }
    try {
      const content = JSON.stringify(this.pluginStates, null, 2);
      await famService.writeFile(null, STATE_CONFIG_PATH, Buffer.from(content, 'utf-8'));
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
      await this.loadStateConfig();
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
      await this.saveStateConfig();
      // 状态变更可能影响配置，清除相关缓存
      this.clearCache(pluginName);
    }
  }

  /**
   * 安全地读取和解析一个设置文件。
   * @param userId - 用户ID，如果为 null，则表示是系统级操作。
   * @param logicalPath - 文件的逻辑路径。
   * @returns 返回解析后的设置对象，如果文件不存在或解析失败则返回空对象。
   */
  private async _readSettingsFile(userId: string | null, logicalPath: string): Promise<PluginSettings> {
    try {
      if (await famService.exists(userId, logicalPath)) {
        const content = await famService.readFile(userId, logicalPath);
        return JSON.parse(content.toString('utf-8'));
      }
    } catch (error) {
      console.error(`[PluginConfigService] Failed to read or parse settings file at ${logicalPath} for user ${userId}:`, error);
    }
    return {};
  }

  /**
   * 获取指定插件的合并后配置。
   * 会先读取实例级配置，再用用户级配置覆盖。
   * @param pluginName - 插件名称。
   * @param userId - 当前用户的ID。如果为 null，则只返回实例级配置。
   * @returns 合并后的配置对象。
   */
  public async getPluginSettings(pluginName: string, userId: string | null): Promise<PluginSettings> {
    const cacheKey = `${userId || 'instance'}:${pluginName}`;
    if (this.settingsCache.has(cacheKey)) {
      return this.settingsCache.get(cacheKey)!;
    }

    // 1. 读取实例级配置
    const instanceSettingsPath = `${INSTANCE_SETTINGS_DIR}${pluginName}.json`;
    const instanceSettings = await this._readSettingsFile(null, instanceSettingsPath);

    let finalSettings = instanceSettings;

    // 2. 如果有用户，读取并合并用户级配置
    if (userId) {
      const userSettingsPath = `${USER_SETTINGS_DIR_TPL.replace('user://', '')}${pluginName}.json`;
      const userSettings = await this._readSettingsFile(userId, userSettingsPath);
      finalSettings = { ...instanceSettings, ...userSettings };
    }

    this.settingsCache.set(cacheKey, finalSettings);
    return finalSettings;
  }

  /**
   * 保存指定用户的插件配置。
   * @param pluginName - 插件名称。
   * @param userId - 当前用户的ID。
   * @param settings - 要保存的配置对象。
   */
  public async savePluginSettings(pluginName: string, userId: string, settings: PluginSettings): Promise<void> {
    const userSettingsPath = `${USER_SETTINGS_DIR_TPL.replace('user://', '')}${pluginName}.json`;
    try {
      const content = JSON.stringify(settings, null, 2);
      await famService.writeFile(userId, userSettingsPath, Buffer.from(content, 'utf-8'));
      
      // 更新缓存
      const cacheKey = `${userId}:${pluginName}`;
      this.settingsCache.delete(cacheKey); // 删除旧的，下次 get 时会重新加载合并
    } catch (error) {
      console.error(`[PluginConfigService] Failed to save settings for plugin ${pluginName} for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * 清除设置缓存。
   * @param pluginName - (可选) 要清除缓存的特定插件。
   * @param userId - (可选) 要清除缓存的特定用户。
   */
  public clearCache(pluginName?: string, userId?: string) {
    if (pluginName && userId) {
      this.settingsCache.delete(`${userId}:${pluginName}`);
      this.settingsCache.delete(`instance:${pluginName}`);
    } else if (pluginName) {
      // 清除所有与该插件相关的缓存
      const keysToDelete = Array.from(this.settingsCache.keys()).filter(key => key.endsWith(`:${pluginName}`));
      keysToDelete.forEach(key => this.settingsCache.delete(key));
    } else {
      this.settingsCache.clear();
    }
  }
}

// 导出单例
export const pluginConfigService = new PluginConfigService();