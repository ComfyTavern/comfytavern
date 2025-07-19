/**
 * @fileoverview 定义插件系统的核心类型，如插件清单 (Manifest) 和扩展信息 (ExtensionInfo)。
 */

// @ts-ignore - 暂时忽略，因为 settings.ts 可能还不存在或尚未导出此类型
import type { SettingItemConfig } from './settings';

/**
 * 定义了 `plugin.yaml` 清单文件的结构。
 */
export interface PluginManifest {
  name: string;
  displayName: string;
  version: string;
  description?: string;
  nodes?: {
    entry: string;
  };
  frontend?: {
    type?: 'vite' | 'vanilla';
    dev?: {
      entry: string;
    };
    build?: {
      entry: string;
      styles?: string[];
      outputDir: string;
    };
    vanilla?: {
      entry: string;
      styles?: string[];
      rootDir?: string;
    }
  };
  configOptions?: SettingItemConfig[];
}

/**
 * 定义了通过 API 向前端暴露的插件信息结构。
 */
export interface FrontendInfo {
  entryUrl: string;
  styleUrls: string[];
  webRootDir?: string; // 插件前端资源的物理根目录
}

export interface ExtensionInfo {
  name: string;
  displayName: string;
  version: string;
  description?: string;
  frontend?: FrontendInfo;
  configOptions?: SettingItemConfig[];
  isEnabled?: boolean; // 插件是否启用
}