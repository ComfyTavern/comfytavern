import './assets/main.css'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import './assets/styles/shared.css'
import './assets/styles/theme-variables.css' // 导入主题 CSS 变量

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import i18n from './locales'; // 直接导入 i18n 实例

import App from './App.vue'
import router from './router'
import { vComfyTooltip } from './directives/vComfyTooltip';
import { connect as connectWebSocket } from './services/WebSocketCoreService';
import { loadPlugins } from './services/PluginLoaderService';
import { initializeExtensionApi } from './services/ExtensionApiService';

async function initializeApp() {
  // 必须在创建 app 之前初始化，以确保插件脚本可以立即访问到 API
  initializeExtensionApi();

  const app = createApp(App)

  // 启动 WebSocket 连接
  connectWebSocket();

  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)

  app.use(pinia)
  app.use(router)
  app.use(i18n); // 注册 i18n 插件
  app.directive('comfy-tooltip', vComfyTooltip);

  // 在挂载应用前加载插件
  await loadPlugins();

  app.mount('#app')
}

initializeApp();
