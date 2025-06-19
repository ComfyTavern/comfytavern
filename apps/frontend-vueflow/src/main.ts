import './assets/main.css'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import './assets/styles/shared.css'
import './assets/styles/theme-variables.css' // 导入主题 CSS 变量

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { messages, defaultLocale } from './locales';

import App from './App.vue'
import router from './router'
import { vComfyTooltip } from './directives/vComfyTooltip';

const i18n = createI18n({
  legacy: false, // 使用 Composition API
  locale: defaultLocale, // 设置默认语言
  fallbackLocale: defaultLocale, // 设置回退语言
  messages, // 加载内置语言包
});

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n); // 注册 i18n 插件
app.directive('comfy-tooltip', vComfyTooltip);

app.mount('#app')
