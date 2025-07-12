# ComfyTavern 面板 SDK 开发指南

欢迎来到 ComfyTavern 面板开发的世界！本指南将帮助你使用 Panel SDK 创建功能丰富的交互式应用面板，并将其无缝集成到 ComfyTavern 平台中。

## 1. 概述

### 1.1 什么是面板 (Panel)？

面板是一个内嵌在 ComfyTavern 中的 Web 应用（通常是 `index.html`），它通过 `iframe` 加载。它允许你为复杂的工作流（Workflow）创建友好的用户界面，使得最终用户无需关心底层的节点逻辑，即可直接与 AI 功能交互。

### 1.2 什么是 Panel SDK？

Panel SDK (`@comfytavern/panel-sdk`) 是一个 JavaScript 库，它充当你的面板与 ComfyTavern 主应用之间的桥梁。它提供了一套完整的 API，让你的面板可以：

- 调用在 ComfyTavern 中定义的工作流。
- 实时接收工作流的执行进度和结果（支持流式输出）。
- 与项目内的文件系统进行交互（读、写、列出文件等）。
- 将面板的日志信息转发到主应用的控制台。
- 自动同步 ComfyTavern 的主题（明/暗模式和颜色变量）。
- 享受一流的开发体验，支持使用 Vite 等现代构建工具进行热更新（HMR）。

## 2. 快速上手

本节将指导你从零开始创建一个支持热更新的面板项目。

### 步骤 1: 创建项目文件结构

在你的 ComfyTavern 项目的 `ui` 目录下，创建一个新的文件夹来存放你的面板，例如 `my-chat-panel`。

```
/userData/{你的用户}/projects/{你的项目}/
└── ui/
    └── my-chat-panel/
        ├── panel.json         # 面板定义文件
        ├── index.html         # UI 入口 (开发和生产可指向不同文件)
        ├── vite.config.js     # 开发服务器配置
        └── package.json       # Node.js 项目依赖
```

### 步骤 2: 初始化 Node.js 项目

在 `my-chat-panel` 目录下，运行以下命令：

```bash
# 初始化 package.json
bun init 
# 安装 vite
bun add -d vite
```

### 步骤 3: 编写 `panel.json`

这是面板的核心定义文件。注意，`uiEntryPoint` 和 `devOptions` 是共存的，分别对应生产模式和开发模式。

```json
// my-chat-panel/panel.json
{
  "id": "my-chat-panel",
  "displayName": "我的聊天面板",
  "description": "一个使用 SDK 开发的聊天机器人面板。",
  "version": "1.0.0",
  "uiEntryPoint": "dist/index.html",
  "devOptions": {
    "devServerUrl": "http://localhost:5678"
  },
  "workflowBindings": [
    {
      "workflowId": "你的工作流ID",
      "alias": "chat"
    }
  ]
}
```

- **`uiEntryPoint`**: **生产环境**的入口文件。指向你运行构建后生成的 HTML 文件。用户点击“打开”按钮时加载此文件。
- **`devOptions.devServerUrl`**: **开发环境**的入口地址。它告诉 ComfyTavern 在开发模式下应该从哪个地址加载你的面板。用户点击“开发”按钮时加载此地址。

### 步骤 4: 配置 `vite.config.js`

这个配置文件让 Vite 知道如何运行开发服务器，并能正确地与 ComfyTavern 后端通信。

```javascript
// my-chat-panel/vite.config.js
import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

// --- 动态配置 ---

// 1. 读取主应用的 config.json 获取后端端口
const DEFAULT_BACKEND_PORT = 3233;
let backendPort = DEFAULT_BACKEND_PORT;
try {
  // 路径相对于 vite.config.js 所在位置，向上查找直到项目根目录
  const configJsonPath = path.resolve(__dirname, '../../../../../config.json');
  if (fs.existsSync(configJsonPath)) {
    const configJsonContent = fs.readFileSync(configJsonPath, 'utf-8');
    const mainConfig = JSON.parse(configJsonContent);
    if (mainConfig.server?.backend?.port) {
      backendPort = parseInt(mainConfig.server.backend.port, 10);
      console.log(`[Vite] 成功从 config.json 加载后端端口: ${backendPort}`);
    }
  }
} catch (error) {
  console.warn(`[Vite] 读取主应用 config.json 失败，将使用默认后端端口 ${DEFAULT_BACKEND_PORT}。错误:`, error);
}
const backendUrl = `http://localhost:${backendPort}`;


// 2. 读取面板自己的 panel.json 获取开发服务器端口
const DEFAULT_DEV_PORT = 5678; // 确保这个端口与 panel.json 中一致
let devPort = DEFAULT_DEV_PORT;
try {
  const panelJsonPath = path.resolve(__dirname, 'panel.json');
  if (fs.existsSync(panelJsonPath)) {
    const panelJsonContent = fs.readFileSync(panelJsonPath, 'utf-8');
    const panelConfig = JSON.parse(panelJsonContent);
    if (panelConfig.devOptions?.devServerUrl) {
      const url = new URL(panelConfig.devOptions.devServerUrl);
      const portFromConfig = parseInt(url.port, 10);
      if (!isNaN(portFromConfig)) {
        devPort = portFromConfig;
        console.log(`[Vite] 成功从 panel.json 加载开发服务器端口: ${devPort}`);
      }
    }
  }
} catch (error) {
  console.warn(`[Vite] 读取 panel.json 配置失败，将使用默认开发服务器端口 ${DEFAULT_DEV_PORT}。错误:`, error);
}

// --- Vite 配置 ---
export default defineConfig({
  // 开发服务器将服务于项目根目录的 index.html
  root: './', 
  build: {
    // 构建输出到 dist 目录
    outDir: 'dist',
  },
  server: {
    port: devPort,
    cors: true, // 允许跨域
  },
  // 在 HTML 中注入后端 URL，以便 SDK 知道从哪里加载
  define: {
    '__BACKEND_URL__': JSON.stringify(backendUrl),
  }
});
```

### 步骤 5: 编写 `index.html` 并加载 SDK

这是你的应用 UI。Vite 开发服务器会直接服务于这个文件。

```html
<!-- my-chat-panel/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8" />
    <title>我的面板</title>
    <style>
      /* 由 SDK 自动注入主题变量 */
      body {
        background-color: hsl(var(--ct-background-base-hsl));
        color: hsl(var(--ct-text-base-hsl));
      }
    </style>
</head>
<body>
    <h1>面板 SDK 测试</h1>
    <div id="api-status">正在连接到 ComfyTavern...</div>
    <button id="test-invoke" disabled>调用工作流</button>
    <pre id="output"></pre>

    <script type="module">
      let panelApi = null;

      // 动态加载并初始化 SDK
      async function loadAndInitSdk() {
        try {
          // Vite 会将 __BACKEND_URL__ 替换为 vite.config.js 中定义的字符串
          const sdkUrl = `${__BACKEND_URL__}/api/fam/sdk/panel.js`;
          console.log(`[Panel] 尝试从以下地址加载 SDK: ${sdkUrl}`);

          // 使用动态 import() 加载 SDK
          const sdkModule = await import(sdkUrl);
          
          if (sdkModule && sdkModule.panelApi) {
            panelApi = sdkModule.panelApi;
            console.log("[Panel] SDK 加载成功，panelApi 可用。");
            initializePanel();
          } else {
            throw new Error("SDK 模块已加载，但未找到 panelApi。");
          }
        } catch (error) {
          console.error("[Panel] 致命错误：加载 Panel SDK 失败。", error);
          document.getElementById("api-status").textContent = "❌ SDK 加载失败，请检查控制台。";
        }
      }

      function initializePanel() {
        document.getElementById("api-status").textContent = "✅ 连接成功！";
        const testButton = document.getElementById("test-invoke");
        testButton.disabled = false;
        testButton.addEventListener('click', handleInvoke);
      }

      async function handleInvoke() {
        if (!panelApi) return;
        const outputEl = document.getElementById("output");
        outputEl.textContent = '正在调用工作流...';
        
        try {
          const { executionId } = await panelApi.invoke({
            workflowId: "chat", // 使用 panel.json 中定义的别名
            inputs: { "input_0": "你好，世界！" }, // 你的工作流输入
          });

          outputEl.textContent = `执行已启动: ${executionId}\n等待事件...\n`;

          const unsubscribe = panelApi.subscribeToExecutionEvents(executionId, {
            onProgress: (payload) => {
              outputEl.textContent += `\n进度: ${JSON.stringify(payload)}`;
            },
            onResult: (payload) => {
              outputEl.textContent += `\n\n最终结果: ${JSON.stringify(payload.outputs, null, 2)}`;
              unsubscribe(); // 收到最终结果后，取消订阅
            },
            onError: (payload) => {
              outputEl.textContent += `\n\n错误: ${JSON.stringify(payload.error)}`;
              unsubscribe(); // 发生错误后，取消订阅
            }
          });

        } catch (e) {
          outputEl.textContent = `调用错误: ${e.message}`;
        }
      }

      // 启动
      loadAndInitSdk();
    </script>
</body>
</html>
```

### 步骤 6: 启动开发流程

1.  **启动 Vite 开发服务器**: 在 `my-chat-panel` 目录下运行 `bun run dev`。
2.  **在 ComfyTavern 中启用开发模式**:
    *   进入 ComfyTavern 的主设置界面。
    *   找到“开发者选项”或类似区域，打开“启用面板开发模式”的开关。
3.  **打开面板**:
    *   导航到你的项目面板列表。
    *   你会看到你的面板卡片上出现了“打开”和“开发”两个按钮。
    *   点击“开发”按钮，ComfyTavern 将会从 `http://localhost:5678` 加载你的面板。
4.  **开始编码**：现在，每当你修改并保存 `index.html` 或其他相关文件时，Vite 都会自动重新加载 `iframe` 中的内容，实现热更新！

## 3. SDK API 详解

`panelApi` 对象是 SDK 的核心，它通过一个代理（Proxy）与 ComfyTavern 主机环境进行异步通信。所有返回 `Promise` 的方法都是异步的。

### 3.1 工作流执行

#### `invoke(request: InvocationRequest): Promise<InvocationResponse>`

异步调用一个工作流。

- **`request`** (`InvocationRequest`):
    - `workflowId` (string): 要调用的工作流的 ID 或在 `panel.json` 中定义的别名。
    - `inputs` (object): 一个键值对对象，其中键是工作流输入节点的 ID (例如 `input_0`, `input_1`)，值是你要传递的数据。
    - `mode?` (string): 执行模式，通常为 `native`。
- **返回**: `Promise<InvocationResponse>`，resolve 一个包含 `executionId` 的对象。

#### `subscribeToExecutionEvents(executionId: string, callbacks: PanelExecutionCallbacks): () => void`

订阅指定执行 ID 的事件流。这是实现流式输出和实时反馈的关键。

- **`executionId`** (string): 从 `invoke()` 调用中获取的执行 ID。
- **`callbacks`** (`PanelExecutionCallbacks`):
    - `onProgress?(data)`: 当工作流执行过程中产生中间输出时调用。
    - `onResult?(data)`: 当工作流执行成功完成时调用。`data.outputs` 包含了所有输出节点的最终结果。
    - `onError?(data)`: 当工作流执行过程中发生错误时调用。
- **返回**: 一个 `unsubscribe` 函数。调用此函数可以停止监听该执行的事件，以避免内存泄漏。

```javascript
const unsubscribe = panelApi.subscribeToExecutionEvents(execId, { ... });

// 当不再需要监听时
unsubscribe();
```

### 3.2 文件系统

所有文件系统操作的路径都是相对于**面板所在的目录**。例如，在 `my-chat-panel` 中调用 `readFile('config.txt')`，实际读取的是 `.../ui/my-chat-panel/config.txt`。

- **`listFiles(path: string): Promise<PanelFile[]>`**: 列出指定路径下的文件和目录。
- **`readFile(path: string, encoding?: 'utf-8' | 'binary'): Promise<string | ArrayBuffer>`**: 读取文件内容。默认为 `'utf-8'` 字符串，`'binary'` 时返回 `ArrayBuffer`。
- **`writeFile(path: string, content: string | Blob | ArrayBuffer): Promise<void>`**: 写入文件。如果文件或目录不存在，会自动创建。
- **`deleteFile(path: string, options?: { recursive?: boolean }): Promise<void>`**: 删除文件或目录。设置 `recursive: true` 可删除非空目录。
- **`createDirectory(path: string): Promise<void>`**: 创建一个新目录。

### 3.3 其他工具

#### `log(level: 'log' | 'warn' | 'error' | 'debug', ...args: any[]): void`

将日志消息从面板转发到 ComfyTavern 的主日志系统。这是一个“即发即忘”的操作，没有返回值。

**最佳实践**: 覆盖 `console.log` 等方法，自动转发所有日志。

```javascript
const originalConsole = { log: console.log, warn: console.warn, error: console.error };

console.log = (...args) => {
  originalConsole.log(...args);
  if (panelApi) panelApi.log('log', ...args);
};
// 对 warn 和 error 做同样的操作
```

## 4. 主题同步

SDK 会自动监听 ComfyTavern 的主题变化，并将相关的 CSS 变量注入到你的面板文档的 `:root` 元素上。你只需在你的 CSS 中使用这些变量即可。

**可用的 CSS 变量示例**:

- `--ct-background-base-hsl`
- `--ct-text-base-hsl`
- `--ct-primary-hsl`
- `--ct-primary-content-hsl`
- `--ct-border-base-hsl`
- ...等等

## 5. 生产构建与部署

当你完成了面板开发，需要将其部署为生产版本时：

1.  **运行构建命令**: 在 `my-chat-panel` 目录下运行 `bun run build`。这会根据 `vite.config.js` 的配置，在 `dist` 目录下生成生产环境的静态文件。
2.  **确认 `panel.json` 配置**: 确保 `uiEntryPoint` 字段正确指向构建后的入口文件，例如 `dist/index.html`。
3.  **部署**: 完成！现在，当用户在 ComfyTavern 中点击你面板的“打开”按钮时，就会加载这些构建好的、最优化的静态文件。开发和部署的配置是共存的，你可以随时通过“开发”按钮切换回热更新模式继续迭代。