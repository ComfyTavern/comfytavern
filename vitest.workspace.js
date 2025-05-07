// vitest.workspace.js
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'apps/frontend-vueflow/vitest.config.ts', // 直接指向配置文件
  // 如果还有其他需要测试的项目，可以在这里添加
])