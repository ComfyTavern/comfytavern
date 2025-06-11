import './assets/main.css'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import './assets/styles/shared.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { vComfyTooltip } from './directives/vComfyTooltip';

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.directive('comfy-tooltip', vComfyTooltip);

app.mount('#app')
