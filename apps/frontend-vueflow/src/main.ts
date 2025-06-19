import './assets/main.css'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import './assets/styles/shared.css'
import './assets/styles/theme-variables.css' // 导入主题 CSS 变量

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import i18n from './locales'; // 直接导入 i18n 实例

import App from './App.vue'
import router from './router'
import { vComfyTooltip } from './directives/vComfyTooltip';

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n); // 注册 i18n 插件
app.directive('comfy-tooltip', vComfyTooltip);

app.mount('#app')
