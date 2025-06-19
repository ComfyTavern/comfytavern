# ComfyTavern 前端 UI 国际化 (i18n) 实施计划

**目标**: 根据 `DesignDocs/architecture/i18n.md` 中 2.5 节的规划，为 `apps/frontend-vueflow` 实现一个完整的前端国际化方案。

**核心技术**: `vue-i18n`

## 阶段一：基础架构搭建

1.  **安装 `vue-i18n`**:
    *   在 `apps/frontend-vueflow` 项目中添加 `vue-i18n` 作为依赖。
    *   命令: `cd apps/frontend-vueflow; bun add vue-i18n`

2.  **创建内置翻译文件与目录结构**:
    *   在 `apps/frontend-vueflow/src/` 下创建 `locales` 目录。
    *   在 `apps/frontend-vueflow/src/locales/` 目录下创建初始语言文件：
        *   `zh-CN.json` (简体中文 - 默认)
        *   `en-US.json` (英文 - 美国)
        *   可以先填充文档中提供的示例内容 (`DesignDocs/architecture/i18n.md:256`)。
    *   创建 `apps/frontend-vueflow/src/locales/index.ts` 用于导出和初步配置内置语言资源。
        ```typescript
        // apps/frontend-vueflow/src/locales/index.ts
        import zhCN from './zh-CN.json';
        import enUS from './en-US.json';

        export const messages = {
          'zh-CN': zhCN,
          'en-US': enUS,
        };

        export const defaultLocale = 'zh-CN';
        ```

3.  **初始化 `vue-i18n` 实例**:
    *   修改 `apps/frontend-vueflow/src/main.ts` 来创建和配置 `vue-i18n` 实例。
        ```typescript
        // apps/frontend-vueflow/src/main.ts
        import { createApp } from 'vue';
        import { createI18n } from 'vue-i18n';
        import App from './App.vue';
        import router from './router';
        import { messages, defaultLocale } from './locales';
        // ...其他 imports

        const i18n = createI18n({
          legacy: false, // 使用 Composition API
          locale: defaultLocale, // 设置默认语言
          fallbackLocale: defaultLocale, // 设置回退语言
          messages, // 加载内置语言包
        });

        const app = createApp(App);
        app.use(router);
        app.use(i18n); // 注册 i18n 插件
        // ...其他 app.use()
        app.mount('#app');
        ```

## 阶段二：核心服务与状态管理

4.  **实现 `LanguagePackManager`**:
    *   创建 `apps/frontend-vueflow/src/composables/useLanguagePackManager.ts` (或 `apps/frontend-vueflow/src/services/i18nService.ts`)。
    *   **定义接口**: 参考文档中的 `LanguagePackManager` 和 `AvailableLanguage` 接口 (`DesignDocs/architecture/i18n.md:312`)。
    *   **`discoverLanguagePacks()`**:
        *   **内置语言**: 直接从 `src/locales` 读取。
        *   **外部语言包 (全局和用户级)**:
            *   **关键问题**: 前端无法直接访问文件系统路径如 `ComfyTavern/userData/...`。
            *   **解决方案**: 需要后端提供 API 接口 (例如 `/api/language-packs`) 来列出可用的外部语言包及其 `manifest.json` 内容和翻译文件。前端通过此 API 获取信息。
            *   此方法应调用该 API，并结合内置语言信息，构建 `AvailableLanguage[]` 列表。
    *   **`loadLanguage(languageCode: string)`**:
        *   根据 `languageCode` 加载翻译消息。
        *   **内置**: 直接从 `src/locales` 获取。
        *   **外部**: 通过后端 API (例如 `/api/language-packs/{pack_identifier}/{lang_code}.json`) 获取指定语言的 JSON 内容。
        *   **合并逻辑**: 实现用户级 > 全局级 > 内置的翻译消息深合并。
    *   **`getSupportedLanguages()`**: 返回 `discoverLanguagePacks()` 的结果或其缓存。
    *   **缓存**: 对发现的语言包信息和加载的语言文件内容进行缓存。

5.  **集成 `settingsStore`**:
    *   在 `apps/frontend-vueflow/src/stores/settingsStore.ts` 中定义 `I18nSettings` 接口并添加相应状态：
        ```typescript
        // apps/frontend-vueflow/src/stores/settingsStore.ts
        export interface I18nSettings {
          currentLanguage: string;
          fallbackLanguage: string;
          autoDetect: boolean;
        }

        export const useSettingsStore = defineStore('settings', () => {
          // ... 其他设置
          const i18nSettings = reactive<I18nSettings>({
            currentLanguage: defaultLocale, // 从 locales/index.ts 或 localStorage 初始化
            fallbackLanguage: defaultLocale,
            autoDetect: true, // 默认开启浏览器语言检测
          });

          // watch i18nSettings.currentLanguage 并持久化到 localStorage
          // 提供 action 更新语言设置
          function setLanguage(langCode: string) {
            i18nSettings.currentLanguage = langCode;
            // 触发 vue-i18n 实例更新语言
          }

          return { /* ...其他状态和 actions */ i18nSettings, setLanguage };
        });
        ```
    *   在应用启动时，从 `localStorage` 加载用户语言偏好，或根据 `autoDetect` 设置尝试检测浏览器语言。
    *   `setLanguage` action 中需要调用 `vue-i18n` 实例的 `locale.value = langCode` 来切换语言。

## 阶段三：UI 集成与功能实现

6.  **语言切换功能**:
    *   在 `apps/frontend-vueflow/src/main.ts` 或 `App.vue` 中，监听 `settingsStore.i18nSettings.currentLanguage` 的变化，并相应更新 `vue-i18n` 实例的 `locale`。
        ```typescript
        // 在 App.vue setup 或 main.ts 中
        const settingsStore = useSettingsStore();
        const { locale } = useI18n(); // 获取 vue-i18n 的 locale

        watch(() => settingsStore.i18nSettings.currentLanguage, (newLang) => {
          if (newLang) {
            // 动态加载新语言包 (如果尚未加载)
            // languagePackManager.loadLanguage(newLang).then(messages => {
            //   i18n.global.setLocaleMessage(newLang, messages);
            //   locale.value = newLang;
            // });
            // 简化版：假设所有语言已在初始化时通过 messages 提供，或通过 LanguagePackManager 统一管理
            locale.value = newLang;
          }
        }, { immediate: true });
        ```
    *   **动态加载与合并**: 当切换到一个新的语言时，如果该语言的翻译（特别是外部包）尚未完全加载和合并到 `vue-i18n` 实例中，需要通过 `LanguagePackManager` 的 `loadLanguage` 获取完整的合并后消息，并使用 `i18n.global.setLocaleMessage(newLang, messages)` 更新 `vue-i18n` 实例，然后再设置 `locale.value = newLang`。

7.  **设置界面语言选择**:
    *   在 `apps/frontend-vueflow/src/views/SettingsView.vue` (或相关设置组件) 中：
        *   使用 `LanguagePackManager.getSupportedLanguages()` 获取可用语言列表。
        *   渲染一个下拉选择器，显示语言的 `nativeName` 或 `name`。
        *   选项值使用 `language.code`。
        *   当用户选择新语言时，调用 `settingsStore.setLanguage(selectedLangCode)`。

8.  **在组件中使用翻译**:
    *   在 Vue 组件中，使用 `vue-i18n` 提供的 `$t()` (Options API) 或 `useI18n().t` (Composition API) 方法。
        ```vue
        <template>
          <div>
            <h1>{{ $t('nav.home') }}</h1>
            <button>{{ t('common.save') }}</button>
          </div>
        </template>

        <script setup lang="ts">
        import { useI18n } from 'vue-i18n';
        const { t } = useI18n();
        </script>
        ```
    *   逐步将现有 UI 中的硬编码文本替换为翻译 Key。

## 阶段四：高级功能与优化

9.  **与后端节点翻译的交互**:
    *   修改前端 API 请求逻辑 (例如在 `apps/frontend-vueflow/src/utils/api.ts` 或各个 API service 中)，使其在请求头中包含 `Accept-Language: settingsStore.i18nSettings.currentLanguage`。
    *   当语言切换时，触发相关节点数据的重新获取，以获得新语言版本的节点定义。

10. **错误处理与回退**:
    *   配置 `vue-i18n` 的 `missing`处理器，当翻译 key 缺失时，可以回退到 `fallbackLocale` 的翻译，或直接显示 key。
        ```typescript
        // main.ts, i18n instance creation
        const i18n = createI18n({
          // ...
          missingWarn: process.env.NODE_ENV === 'development',
          fallbackWarn: process.env.NODE_ENV === 'development',
          missing: (locale, key) => {
            console.warn(`Missing translation: locale='${locale}', key='${key}'`);
            return key; // 或返回 fallbackLocale 的翻译
          },
        });
        ```
    *   处理 `LanguagePackManager` 中 API 请求失败的情况，优雅降级（例如只使用内置翻译）。

11. **开发便利性 (可选，根据优先级)**:
    *   **TypeScript 支持**: 考虑使用工具（如 `vite-plugin-vue-i18n` 的某些功能或自定义脚本）从 `.json` 文件生成类型安全的翻译 key 定义。
    *   **I18nDevTools**: 根据文档 `DesignDocs/architecture/i18n.md:385` 规划，可以逐步实现一些开发辅助功能，例如查找缺失 key。

## 阶段五：测试与部署

12. **测试**:
    *   测试语言切换功能。
    *   测试不同层级翻译（内置、全局、用户）的覆盖优先级。
    *   测试翻译 key 缺失的回退。
    *   测试与后端节点翻译的协同工作。
13. **文档**:
    *   更新开发者文档，说明如何添加新的 UI 翻译和语言包。

## Mermaid 流程图

```mermaid
graph TD
    subgraph App Initialization & Language Loading
        AppStart[应用启动] --> LoadSettings[加载用户设置 (localStorage)];
        LoadSettings --> DetectLang{自动检测浏览器语言?};
        DetectLang -- Yes --> BrowserLang[获取浏览器语言];
        DetectLang -- No --> UserPrefLang[使用用户偏好语言];
        BrowserLang --> TargetLang[确定目标语言];
        UserPrefLang --> TargetLang;
        TargetLang --> LPM_Discover[LanguagePackManager: discoverLanguagePacks()];
        LPM_Discover -- 可用语言列表 --> SettingsUI_Populate[填充设置界面语言选项];
        TargetLang --> LPM_Load[LanguagePackManager: loadLanguage(targetLang)];
        LPM_Load -- API: /api/language-packs --> Backend_LangPacks[后端: 提供外部语言包];
        LPM_Load -- 合并翻译 (用户>全局>内置) --> MergedMessages;
        MergedMessages --> VueI18n_Init[初始化/更新 vue-i18n 实例];
        VueI18n_Init --> RenderUI[渲染UI (使用翻译)];
    end

    subgraph User Language Change
        SettingsUI_Select[用户在设置界面选择新语言] --> Store_SetLang[settingsStore.setLanguage(newLang)];
        Store_SetLang --> Watch_LangChange[监听 currentLanguage 变化];
        Watch_LangChange --> LPM_LoadNew[LanguagePackManager: loadLanguage(newLang)];
        LPM_LoadNew --> MergedNewMessages;
        MergedNewMessages --> VueI18n_Update[vue-i18n: setLocaleMessage & locale.value = newLang];
        VueI18n_Update --> RenderUI;
        VueI18n_Update --> FetchNodeDefs[重新获取后端节点定义 (带新 Accept-Language)];
    end
