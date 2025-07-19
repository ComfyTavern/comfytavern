// apps/backend/src/services/PluginLoader.ts
import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import yaml from 'js-yaml';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NodeLoader } from './NodeLoader';
import { nodeManager } from './NodeManager';
import type { PluginManifest, ExtensionInfo, FrontendInfo } from '@comfytavern/types';

export class PluginLoader {
  public static extensions: ExtensionInfo[] = [];
  private static appInstance: Elysia | null = null;
  private static pluginPaths: string[] = [];
  private static projectRootDir: string = '';

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
          const pluginPath = path.join(pluginsDir, pluginName);
          const manifestPath = path.join(pluginPath, 'plugin.yaml');

          try {
            const manifestContent = await fs.readFile(manifestPath, 'utf-8');
            const manifest = yaml.load(manifestContent) as PluginManifest;

            const extensionInfo: ExtensionInfo = {
              name: manifest.name,
              displayName: manifest.displayName,
              version: manifest.version,
              description: manifest.description,
              configOptions: manifest.configOptions,
            };

            if (manifest.frontend) {
              const publicPath = path.posix.join('/plugins', manifest.name);
              let entryFile: string;
              let styleFiles: string[] = [];
              let assetSubDir = ''; // 用于存储前端资源的相对子目录, e.g., 'web' or 'dist'

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
                continue;
              }
              // 移除有问题的 staticPlugin 调用，后续将由专门的路由处理


              const frontendInfo: FrontendInfo = {
                // 修正 URL，现在它包含了 assetSubDir
                entryUrl: path.posix.join(publicPath, assetSubDir, entryFile.replace(/^\.\//, '')),
                styleUrls: styleFiles.map(s => path.posix.join(publicPath, assetSubDir, s.replace(/^\.\//, ''))),
                // 修正 webRootDir，它应该指向插件的根目录，以便与路由的通配符 '*' 配合
                webRootDir: pluginPath,
              };
              extensionInfo.frontend = frontendInfo;
            }

            this.extensions.push(extensionInfo);

            if (manifest.nodes) {
              const nodesPath = path.join(pluginPath, manifest.nodes.entry);
              await NodeLoader.loadNodes(nodesPath, manifest.name);
            }
            console.log(`[PluginLoader] Successfully loaded plugin: ${manifest.displayName} (v${manifest.version})`);

          } catch (error) {
            console.error(`[PluginLoader] Failed to load plugin '${pluginName}' from '${pluginPath}':`, error);
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

    return {
      success: true,
      message,
      count: reloadedPluginCount,
    };
  }
}
