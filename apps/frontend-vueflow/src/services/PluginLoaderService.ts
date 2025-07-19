import { api } from '@/utils/api';
import type { ExtensionInfo } from '@comfytavern/types';

export async function loadPlugins() {
  try {
    const extensions = await api.get<ExtensionInfo[]>('/plugins');
    
    for (const ext of extensions.data) {
      if (ext.frontend) {
        // 加载 CSS
        ext.frontend.styleUrls.forEach(url => {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = url;
          document.head.appendChild(link);
        });

        // 加载 JS
        const script = document.createElement('script');
        script.type = 'module';
        script.src = ext.frontend.entryUrl;
        document.body.appendChild(script);
        
        console.log(`[PluginLoader] Loaded plugin: ${ext.displayName}`);
      }
    }
  } catch (error) {
    console.error('[PluginLoader] Failed to load plugins:', error);
  }
}