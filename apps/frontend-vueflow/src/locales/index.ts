// apps/frontend-vueflow/src/locales/index.ts
import { createI18n } from 'vue-i18n';
import zhCN from './zh-CN.json';
import zhWYW from './zh-WYW.json';
import enUS from './en-US.json';
import jaJP from './ja-JP.json';

export const messages = {
  'zh-CN': zhCN,
  'zh-WYW': zhWYW,
  'en-US': enUS,
  'ja-JP': jaJP,
};

export const defaultLocale = 'zh-CN';

const i18n = createI18n({
  legacy: false, // 使用 Composition API
  locale: defaultLocale, // 设置默认语言
  fallbackLocale: defaultLocale, // 设置回退语言
  messages, // 加载内置语言包
});

export default i18n;