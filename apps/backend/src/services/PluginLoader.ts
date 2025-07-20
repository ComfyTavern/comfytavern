// apps/backend/src/services/PluginLoader.ts
import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import yaml from 'js-yaml';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NodeLoader } from './NodeLoader';
import { nodeManager } from './NodeManager';
import { pluginConfigService } from './PluginConfigService';
import { webSocketManager } from '../websocket/WebSocketManager';
import type { PluginManifest, ExtensionInfo, FrontendInfo } from '@comfytavern/types';

export class PluginLoader {
  public static extensions: ExtensionInfo[] = [];
  private static appInstance: Elysia | null = null;
  private static pluginPaths: string[] = [];
  private static projectRootDir: string = '';

  /**
   * 发现所有插件并返回它们的清单信息及启用状态。
   * 这个方法不加载插件，只用于信息展示。
   */
  public static async discoverAllPlugins(): Promise<ExtensionInfo[]> {
    const allDiscoveredPlugins: ExtensionInfo[] = [];

    for (const pluginsDir of this.pluginPaths) {
      try {
        const pluginDirs = await fs.readdir(pluginsDir, { withFileTypes: true });

        for (const dirent of pluginDirs) {
          if (!dirent.isDirectory()) continue;

          const pluginName = dirent.name;
          const pluginPath = path.join(pluginsDir, pluginName);
          const manifestPath = path.join(pluginPath, 'plugin.yaml');

          try {
            const manifestContent = await fs.readFile(manifestPath, 'utf-8');
            const manifest = yaml.load(manifestContent) as PluginManifest;
            const isEnabled = await pluginConfigService.isPluginEnabled(pluginName);

            allDiscoveredPlugins.push({
              name: manifest.name,
              displayName: manifest.displayName,
              version: manifest.version,
              description: manifest.description,
              configOptions: manifest.configOptions,
              isEnabled: isEnabled,
            });
          } catch (error) {
            console.error(`[PluginLoader] Failed to read manifest for plugin '${pluginName}':`, error);
          }
        }
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          console.error(`[PluginLoader] Error reading plugins directory ${pluginsDir}:`, error);
        }
      }
    }
    return allDiscoveredPlugins;
  }

  public static async loadPlugins(app: Elysia, pluginBasePaths: string[], projectRootDir: string): Promise<void> {
    this.appInstance = app;
    this.pluginPaths = pluginBasePaths;
    this.projectRootDir = projectRootDir;

    for (const pluginsDir of pluginBasePaths) {
      try {
        const pluginDirs = await fs.readdir(pluginsDir, { withFileTypes: true });

        for (const dirent of pluginDirs) {
          if (!dirent.isDirectory()) continue;

          const pluginName = dirent.name;
          const isEnabled = await pluginConfigService.isPluginEnabled(pluginName);

          if (isEnabled) {
            const pluginPath = path.join(pluginsDir, pluginName);
            await this._loadPluginByPath(pluginPath);
          } else {
            console.log(`[PluginLoader] Plugin '${pluginName}' is disabled, skipping.`);
          }
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          console.log(`[PluginLoader] Plugin directory not found, skipping: ${pluginsDir}`);
        } else {
          console.error(`[PluginLoader] Error reading plugins directory ${pluginsDir}:`, error);
        }
      }
    }
  }

  public static async reloadPlugins(): Promise<{ success: boolean; message: string; count: number }> {
    if (!this.appInstance || !this.projectRootDir) {
      throw new Error("PluginLoader has not been initialized with an Elysia app instance or projectRootDir. Cannot reload.");
    }
    console.log('[PluginLoader] Reloading all plugins...');

    this.extensions = [];
    nodeManager.clearNodes();
    console.log('[PluginLoader] Cleared existing extensions and node definitions.');

    const builtInNodesPath = path.join(this.projectRootDir, 'apps', 'backend', 'src', 'nodes');
    console.log(`[PluginLoader] Reloading built-in nodes from: ${builtInNodesPath}`);
    await NodeLoader.loadNodes(builtInNodesPath);

    await this.loadPlugins(this.appInstance, this.pluginPaths, this.projectRootDir);

    const reloadedPluginCount = this.extensions.length;
    const reloadedNodeCount = nodeManager.getDefinitions().length;

    const message = `Successfully reloaded ${reloadedPluginCount} plugins and a total of ${reloadedNodeCount} nodes.`;
    console.log(`[PluginLoader] ${message}`);

    webSocketManager.broadcast('plugins-reloaded', {
      message,
      reloadedPluginCount,
    });

    return {
      success: true,
      message,
      count: reloadedPluginCount,
    };
  }

  public static async enablePlugin(pluginName: string): Promise<ExtensionInfo | null> {
    if (this.extensions.some(p => p.name === pluginName)) {
      console.log(`[PluginLoader] Plugin '${pluginName}' is already enabled.`);
      return this.extensions.find(p => p.name === pluginName) || null;
    }

    for (const pluginsDir of this.pluginPaths) {
      const pluginPath = path.join(pluginsDir, pluginName);
      try {
        // Check if manifest exists to confirm plugin presence
        await fs.access(path.join(pluginPath, 'plugin.yaml'));
        const extensionInfo = await this._loadPluginByPath(pluginPath);
        if (extensionInfo) {
          webSocketManager.broadcast('plugin-enabled', { plugin: extensionInfo });
          return extensionInfo;
        }
      } catch (error) {
        // Not in this directory, continue searching
      }
    }

    console.error(`[PluginLoader] Could not find plugin '${pluginName}' to enable.`);
    return null;
  }

  public static async disablePlugin(pluginName: string): Promise<boolean> {
    const pluginIndex = this.extensions.findIndex(p => p.name === pluginName);
    if (pluginIndex === -1) {
      console.log(`[PluginLoader] Plugin '${pluginName}' is not currently enabled.`);
      return false;
    }

    // 1. Unregister nodes
    const unregisteredCount = nodeManager.unregisterNodesByNamespace(pluginName);
    console.log(`[PluginLoader] Unregistered ${unregisteredCount} nodes for plugin '${pluginName}'.`);

    // 2. Remove from active extensions
    const [disabledPlugin] = this.extensions.splice(pluginIndex, 1);
    console.log(`[PluginLoader] Disabled plugin: ${disabledPlugin.displayName}`);

    // 3. Notify frontend
    webSocketManager.broadcast('plugin-disabled', { pluginName });

    return true;
  }

  private static async _loadPluginByPath(pluginPath: string): Promise<ExtensionInfo | null> {
    const pluginName = path.basename(pluginPath);
    const manifestPath = path.join(pluginPath, 'plugin.yaml');

    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = yaml.load(manifestContent) as PluginManifest;

      // Avoid re-adding if already present (e.g., during initial load vs. enable)
      if (this.extensions.some(p => p.name === manifest.name)) {
        return this.extensions.find(p => p.name === manifest.name) || null;
      }

      const extensionInfo: ExtensionInfo = {
        name: manifest.name,
        displayName: manifest.displayName,
        version: manifest.version,
        description: manifest.description,
        configOptions: manifest.configOptions,
        isEnabled: true,
      };

      if (manifest.frontend) {
        const publicPath = path.posix.join('/plugins', manifest.name);
        let entryFile: string | undefined;
        let styleFiles: string[] = [];
        let assetSubDir: string | undefined;

        if (manifest.frontend.type === 'vanilla' && manifest.frontend.vanilla) {
          assetSubDir = manifest.frontend.vanilla.rootDir || 'web';
          entryFile = manifest.frontend.vanilla.entry;
          styleFiles = manifest.frontend.vanilla.styles || [];
        } else if (manifest.frontend.build) {
          assetSubDir = manifest.frontend.build.outputDir;
          entryFile = manifest.frontend.build.entry;
          styleFiles = manifest.frontend.build.styles || [];
        } else {
          console.warn(`[PluginLoader] Plugin '${pluginName}' has a frontend section but is missing 'build' or 'vanilla' configuration. Skipping frontend part.`);
        }

        if (assetSubDir && entryFile) {
          extensionInfo.frontend = {
            entryUrl: path.posix.join(publicPath, assetSubDir, entryFile.replace(/^\.\//, '')),
            styleUrls: styleFiles.map(s => path.posix.join(publicPath, assetSubDir, s.replace(/^\.\//, ''))),
            webRootDir: pluginPath,
          };
        }
      }

      if (manifest.nodes) {
        const nodesPath = path.join(pluginPath, manifest.nodes.entry);
        await NodeLoader.loadNodes(nodesPath, manifest.name);
      }

      this.extensions.push(extensionInfo);
      console.log(`[PluginLoader] Successfully loaded plugin: ${manifest.displayName} (v${manifest.version})`);
      return extensionInfo;

    } catch (error) {
      console.error(`[PluginLoader] Failed to load plugin '${pluginName}' from '${pluginPath}':`, error);
      return null;
    }
  }
}
