// apps/frontend-vueflow/src/composables/useLanguagePackManager.ts
import { ref, reactive } from 'vue';
import { merge, omit } from 'lodash-es';
import { fileManagerApiClient } from '@/api/fileManagerApi';
import { messages as builtInMessages } from '@/locales';

export interface AvailableLanguage {
  code: string; // e.g., 'zh-CN'
  name: string; // e.g., 'Chinese (Simplified)'
  nativeName: string; // e.g., '简体中文'
  source: 'built-in' | 'shared' | 'user';
}

// 语言文件内部元数据的结构约定
interface LanguageFileMeta {
  _meta: {
    name: string;
    nativeName: string;
  };
}

const availableLanguages = ref<AvailableLanguage[]>([]);
const loadedMessagesCache = reactive(new Map<string, any>());

export function useLanguagePackManager() {
  /**
   * 发现所有可用的语言包，包括内置和外部的
   */
  async function discoverLanguagePacks() {
    const discovered = new Map<string, AvailableLanguage>();

    // 1. 添加内置语言 (从导入的 JSON 对象中读取元数据)
    for (const code in builtInMessages) {
      const messages = (builtInMessages as any)[code];
      if (messages._meta) {
        const meta = messages._meta;
        discovered.set(code, {
          code,
          name: meta.name,
          nativeName: meta.nativeName,
          source: 'built-in',
        });
      }
    }

    // 2. 发现共享和用户提供的语言包
    const locations: { prefix: string; source: 'shared' | 'user' }[] = [
      { prefix: 'shared://library/locales/ui/@ComfyTavern-ui/', source: 'shared' },
      { prefix: 'user://library/locales/ui/@ComfyTavern-ui/', source: 'user' },
    ];

    for (const location of locations) {
      try {
        // 要求后端确保目录存在，如果不存在则创建
        const langFiles = await fileManagerApiClient.listDir(location.prefix, { ensureExists: true });
        for (const langFile of langFiles) {
          if (langFile.itemType === 'file' && langFile.name.endsWith('.json')) {
            try {
              const langCode = langFile.name.replace('.json', '');
              const content: LanguageFileMeta | null = await fileManagerApiClient.readFile(langFile.logicalPath);

              if (content && content._meta) {
                // 优先级规则: user > shared > built-in
                if (!discovered.has(langCode) || discovered.get(langCode)!.source !== 'user') {
                  discovered.set(langCode, {
                    code: langCode,
                    name: content._meta.name,
                    nativeName: content._meta.nativeName,
                    source: location.source,
                  });
                }
              }
            } catch (e) {
              console.error(`咕: 解析语言文件元数据失败 ${langFile.logicalPath}`, e);
            }
          }
        }
      } catch (error: any) {
        // 由于后端现在会处理不存在的目录，这里的错误捕获主要用于处理其他非预期的 API 错误
        console.warn(`咕: 无法发现或处理语言包于 ${location.prefix}`, error);
      }
    }
    
    availableLanguages.value = Array.from(discovered.values());
    return availableLanguages.value;
  }

  /**
   * 加载并合并指定语言的翻译内容
   * @param languageCode - 语言代码 (e.g., 'zh-CN')
   */
  async function loadLanguage(languageCode: string) {
    if (loadedMessagesCache.has(languageCode)) {
      return loadedMessagesCache.get(languageCode);
    }

    let finalMessages = {};

    // 1. 加载内置语言 (作为基础)，并移除 _meta 字段
    const builtIn = (builtInMessages as any)[languageCode] || {};
    finalMessages = merge({}, omit(builtIn, '_meta'));

    // 辅助函数，用于加载并合并外部语言文件
    const loadAndMerge = async (path: string) => {
      try {
        const messages = await fileManagerApiClient.readFile(path);
        if (messages) {
          // 合并时同样移除 _meta 字段
          finalMessages = merge(finalMessages, omit(messages, '_meta'));
        }
      } catch (error: any) {
        if (!(error.isAxiosError && error.response?.status === 404)) {
          console.error(`咕: 加载语言文件失败 ${path}`, error);
        }
      }
    };

    // 2. 加载共享语言包并合并
    await loadAndMerge(`shared://library/locales/ui/@ComfyTavern-ui/${languageCode}.json`);

    // 3. 加载用户语言包并合并 (最高优先级)
    await loadAndMerge(`user://library/locales/ui/@ComfyTavern-ui/${languageCode}.json`);

    loadedMessagesCache.set(languageCode, finalMessages);
    return finalMessages;
  }

  function getSupportedLanguages() {
    return availableLanguages.value;
  }

  return {
    discoverLanguagePacks,
    loadLanguage,
    getSupportedLanguages,
    availableLanguages,
  };
}