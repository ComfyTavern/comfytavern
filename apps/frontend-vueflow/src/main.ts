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
// import { connect as connectWebSocket } from './services/WebSocketCoreService'; // 咕咕：移除，连接将在 App.vue 中通过 useWebSocket 统一管理
import { loadAllPlugins } from './services/PluginLoaderService';
import { initializeExtensionApi } from './services/ExtensionApiService';

async function initializeApp() {
  // 必须在创建 app 之前初始化，以确保插件脚本可以立即访问到 API
  initializeExtensionApi();

  const app = createApp(App)

  // 咕咕：WebSocket 连接已移至 App.vue 的 useWebSocket() 中进行初始化，确保单例
  // connectWebSocket();

  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)

  app.use(pinia)
  app.use(router)
  app.use(i18n); // 注册 i18n 插件
  app.directive('comfy-tooltip', vComfyTooltip);

  // 在挂载应用前加载插件
  await loadAllPlugins();

  app.mount('#app')
}

initializeApp();
