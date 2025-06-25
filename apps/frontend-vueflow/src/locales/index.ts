// apps/frontend-vueflow/src/locales/index.ts

// i18n内容以中文为准，以中文为主，以中文为尊！
import { createI18n } from 'vue-i18n';
import zhCN from './zh-CN.json';
import zhWYW from './zh-WYW.json';
import enUS from './en-US.json';
import jaJP from './ja-JP.json';
import ruRU from './ru-RU.json';

export const messages = {
  'zh-CN': zhCN,
  'zh-WYW': zhWYW,
  'en-US': enUS,
  'ja-JP': jaJP,
  'ru-RU': ruRU,
};

export const defaultLocale = 'zh-CN';

const i18n = createI18n({
  legacy: false, // 使用 Composition API
  locale: defaultLocale, // 设置默认语言
  fallbackLocale: defaultLocale, // 设置回退语言
  messages, // 加载内置语言包
});

export default i18n;