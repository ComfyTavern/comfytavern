import { api } from '@/utils/api';
import type { ExtensionInfo } from '@comfytavern/types';

/**
 * 为插件的 DOM 元素（script, link）生成一个唯一的属性选择器。
 * @param pluginName - 插件的名称。
 * @returns 返回一个可用于 querySelectorAll 的属性选择器字符串。
 */
const getPluginAssetSelector = (pluginName: string) => `[data-plugin-name="${pluginName}"]`;

/**
 * 加载单个插件的前端资源 (JS 和 CSS)。
 * @param ext - 要加载的插件的 ExtensionInfo 对象。
 */
export function loadPluginAssets(ext: ExtensionInfo) {
  if (!ext.frontend) return;

  console.log(`[PluginLoader] Loading assets for plugin: ${ext.displayName}`);

  // 加载 CSS
  ext.frontend.styleUrls.forEach(url => {
    if (document.querySelector(`link[href="${url}"]`)) return; // 避免重复加载
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute('data-plugin-name', ext.name); // 添加标识符
    document.head.appendChild(link);
  });

  // 加载 JS
  if (document.querySelector(`script[src="${ext.frontend.entryUrl}"]`)) return; // 避免重复加载
  const script = document.createElement('script');
  script.type = 'module';
  script.src = ext.frontend.entryUrl;
  script.setAttribute('data-plugin-name', ext.name); // 添加标识符
  document.body.appendChild(script);
}

/**
 * 卸载单个插件的前端资源。
 * @param pluginName - 要卸载的插件的名称。
 */
export function unloadPluginAssets(pluginName: string) {
  console.log(`[PluginLoader] Unloading assets for plugin: ${pluginName}`);
  const selector = getPluginAssetSelector(pluginName);
  const elements = document.querySelectorAll(selector);
  elements.forEach(el => el.remove());
}

/**
 * 在应用启动时加载所有已启用的插件。
 */
export async function loadAllPlugins() {
  try {
    // API 端点返回的是所有已发现的插件，我们需要在前端过滤出启用的
    const extensions = await api.get<ExtensionInfo[]>('/plugins');
    
    for (const ext of extensions.data) {
      if (ext.isEnabled) {
        loadPluginAssets(ext);
      }
    }
  } catch (error) {
    console.error('[PluginLoader] Failed to load initial plugins:', error);
  }
}