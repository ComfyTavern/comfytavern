import { fileURLToPath, URL } from 'node:url';
import path from 'node:path'; // <-- Import path
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueDevTools from 'vite-plugin-vue-devtools'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import fs from 'node:fs';

const configPath = fileURLToPath(new URL('../../config.json', import.meta.url));
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const frontendPort = config.server.frontend.port;

// Read root package.json to get version
const rootPackageJsonPath = fileURLToPath(new URL('../../package.json', import.meta.url));
const packageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf-8'));
const appVersion = packageJson.Version || 'unknown'; // Use 'Version' (capital V) as in your package.json


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VueDevTools(),
    nodePolyfills({
      // Whether to polyfill specific globals.
      globals: {
        Buffer: true,
      },
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@comfytavern': fileURLToPath(new URL('../../packages', import.meta.url)),
      '@comfytavern/types': fileURLToPath(new URL('../../packages/types/src', import.meta.url)),
      '@library': fileURLToPath(new URL('../../library', import.meta.url))
    }
  },
  server: {
    port: frontendPort,
    proxy: {
      '/api': {
        target: 'http://localhost:3233',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:3233',
        ws: true
      }
    },
    fs: {
      // Allow serving files from the workspace root, which includes the 'packages' directory.
      allow: [
        fileURLToPath(new URL('../../', import.meta.url))
      ]
    },
    // Roo: Add watch configuration here, inside the existing server block
    watch: {
      // Watch all files in the packages/types directory
      ignored: [
        // Ensure node_modules is ignored (Vite default, but good to be explicit)
        '**/node_modules/**',
        '**/.git/**',
        // Negated pattern to *include* the types package
        `!${fileURLToPath(new URL('../../packages/types/src', import.meta.url))}/**`
        // You might need to add other packages here if they also need watching
        // `!${fileURLToPath(new URL('../../packages/utils/src', import.meta.url))}/**`
      ],
      // Optional: You might need to adjust depth or polling depending on your OS/setup
      // depth: 99,
      // usePolling: true,
    }
  },
  preview: { // 为预览服务器配置端口
    port: frontendPort,
    proxy: { // 确保预览服务器也有代理配置
      '/api': {
        target: 'http://localhost:3233',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:3233',
        ws: true
      }
    }
  },
  // Define global constants that will be replaced during build
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion)
  }
})