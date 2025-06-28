import { fileURLToPath, URL } from 'node:url';
import path from 'node:path';
import { defineConfig, ViteDevServer, PreviewServer, Logger } from 'vite';
import vue from '@vitejs/plugin-vue';
import VueDevTools from 'vite-plugin-vue-devtools';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import fs from 'node:fs';

// 获取配置文件的路径并读取前端端口
const configPath = fileURLToPath(new URL('../../config.json', import.meta.url));
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const frontendPort = config.server.frontend.port;
const backendPort = config.server.backend.port; // 从配置中读取后端端口
const backendApiTarget = `http://localhost:${backendPort}`;
const backendWsTarget = `ws://localhost:${backendPort}`;

// 读取根目录的 package.json 文件以获取应用版本
const rootPackageJsonPath = fileURLToPath(new URL('../../package.json', import.meta.url));
const packageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf-8'));
// 使用 'version' (小写 v) 获取版本号，如果不存在则默认为 'unknown'
const appVersion = packageJson.version || 'unknown';

// 自定义启动日志相关
const customLogPrintedKey = Symbol('customLogPrintedKeyForComfyTavern');

function printCustomDevLog(logger: Logger) {
  logger.info('\n  ✨ ComfyTavern 开发模式启动 ✨');
  logger.info(`  前端开发服务器已就绪，请访问 http://localhost:${frontendPort}/ 开始你的创作之旅！`);
  logger.info('  提示：Vue DevTools 已启用，按 Alt(⌥)+Shift(⇧)+D 切换。');
  logger.info('  如果遇到问题，可以先查看项目文档或向社区求助哦。\n');
}

// printCustomPreviewLog 函数不再需要，已移除

// Vite 配置文档：https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(), // Vue 3 插件
    VueDevTools(), // Vue 开发者工具插件
    nodePolyfills({
      // 是否为特定的全局变量提供 polyfill
      globals: {
        Buffer: true,
      },
      // 是否为 `node:` 协议导入提供 polyfill
      protocolImports: true,
    }),
    {
      name: 'custom-startup-log-comfytavern',
      configureServer(server: ViteDevServer) {
        const originalPrintUrls = server.printUrls;
        server.printUrls = () => {
          originalPrintUrls();
          printCustomDevLog(server.config.logger);
        };
      },
      // configurePreviewServer 钩子已移除，因为我们不再依赖它来输出日志
    },
  ],
  resolve: {
    alias: {
      // 配置路径别名，方便导入模块
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@comfytavern': fileURLToPath(new URL('../../packages', import.meta.url)),
      '@comfytavern/types': fileURLToPath(new URL('../../packages/types/src', import.meta.url)),
      '@library': fileURLToPath(new URL('../../library', import.meta.url))
    }
  },
  server: {
    port: frontendPort, // 前端开发服务器端口
    proxy: {
      // 配置 API 请求代理
      '/api': {
        target: backendApiTarget, // 后端 API 地址
        changeOrigin: true // 改变源，以支持跨域
      },
      // 配置 WebSocket 代理
      '/ws': {
        target: backendWsTarget, // 后端 WebSocket 地址
        ws: true // 启用 WebSocket 代理
      }
    },
    fs: {
      // 允许从工作区根目录提供文件，包括 'packages' 目录
      allow: [
        fileURLToPath(new URL('../../', import.meta.url))
      ]
    },
    // 监听配置，位于现有的 server 块内
    watch: {
      // 忽略的文件/目录，这些路径是相对于 Vite 的根目录 (apps/frontend-vueflow)
      ignored: [
        // 确保 node_modules 被忽略 (Vite 默认行为，但明确指定更好)
        '**/node_modules/**',
        '**/.git/**',
        // 否定模式以 *包含* types 包。
        // 计算相对于 vite.config.ts 目录 (即 Vite 根目录) 的路径
        `!${path.relative(fileURLToPath(new URL('.', import.meta.url)), fileURLToPath(new URL('../../packages/types/src', import.meta.url)))}/**`,
        // 如果其他包也需要监听，可以在这里添加
        // `!${path.relative(fileURLToPath(new URL('.', import.meta.url)), fileURLToPath(new URL('../../packages/utils/src', import.meta.url)))}/**`
      ],
      // 可选：根据操作系统/设置，可能需要调整深度或轮询
      // depth: 99, // 监听深度
      usePolling: true, // 启用文件轮询，解决某些文件系统下监听不生效的问题
    }
  },
  preview: {
    port: frontendPort, // 预览服务器端口
    proxy: {
      // 确保预览服务器也有代理配置
      '/api': {
        target: backendApiTarget,
        changeOrigin: true
      },
      '/ws': {
        target: backendWsTarget,
        ws: true
      }
    }
  },
  // 定义全局常量，这些常量将在构建时被替换
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion) // 将应用版本注入到环境变量中
  }
});