# ComfyTavern Panel SDK Development Guide

Welcome to the world of ComfyTavern panel development! This guide will help you create feature-rich interactive application panels using the Panel SDK and seamlessly integrate them into the ComfyTavern platform.

## 1. Overview

### 1.1 What is a Panel?

A panel is a Web application (usually `index.html`) embedded within ComfyTavern, loaded via an `iframe`. It allows you to create user-friendly interfaces for complex Workflows, enabling end-users to directly interact with AI functionalities without needing to understand the underlying node logic.

### 1.2 What is the Panel SDK?

The Panel SDK (`@comfytavern/panel-sdk`) is a JavaScript library that acts as a bridge between your panel and the ComfyTavern main application. It provides a comprehensive set of APIs that allow your panel to:

- Invoke workflows defined in ComfyTavern.
- Receive real-time execution progress and results of workflows (supports streaming output).
- Interact with the project's file system (read, write, list files, etc.).
- Forward panel log messages to the main application's console.
- Automatically synchronize ComfyTavern's theme (light/dark mode and color variables).
- Enjoy a first-class development experience, supporting hot module replacement (HMR) with modern build tools like Vite.

## 2. Quick Start

This section will guide you through creating a hot-reloaded panel project from scratch.

### Step 1: Create Project File Structure

Inside your ComfyTavern project's `ui` directory, create a new folder to store your panel, for example, `my-chat-panel`.

```
/userData/{Your User}/projects/{Your Project}/
└── ui/
    └── my-chat-panel/
        ├── panel.json         # Panel definition file
        ├── index.html         # UI Entry Point (can point to different files for dev and prod)
        ├── vite.config.js     # Development server configuration
        └── package.json       # Node.js project dependencies
```

### Step 2: Initialize Node.js Project

In the `my-chat-panel` directory, run the following commands:

```bash
# Initialize package.json
bun init 
# Install vite
bun add -d vite
```

### Step 3: Write `panel.json`

This is the core definition file for your panel. Note that `uiEntryPoint` and `devOptions` coexist, corresponding to production mode and development mode, respectively.

```json
// my-chat-panel/panel.json
{
  "id": "my-chat-panel",
  "displayName": "My Chat Panel",
  "description": "A chat bot panel developed using the SDK.",
  "version": "1.0.0",
  "uiEntryPoint": "dist/index.html",
  "devOptions": {
    "devServerUrl": "http://localhost:5678"
  },
  "workflowBindings": [
    {
      "workflowId": "YOUR_WORKFLOW_ID",
      "alias": "chat"
    }
  ]
}
```

- **`uiEntryPoint`**: The entry file for the **production environment**. Points to the HTML file generated after your build. This file is loaded when the user clicks the "Open" button.
- **`devOptions.devServerUrl`**: The entry address for the **development environment**. It tells ComfyTavern from which address to load your panel in development mode. This address is loaded when the user clicks the "Develop" button.

### Step 4: Configure `vite.config.js`

This configuration file lets Vite know how to run the development server and communicate correctly with the ComfyTavern backend.

```javascript
// my-chat-panel/vite.config.js
import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

// --- Dynamic Configuration ---

// 1. Read backend port from main application's config.json
const DEFAULT_BACKEND_PORT = 3233;
let backendPort = DEFAULT_BACKEND_PORT;
try {
  // Path relative to vite.config.js, lookup until project root
  const configJsonPath = path.resolve(__dirname, '../../../../../config.json');
  if (fs.existsSync(configJsonPath)) {
    const configJsonContent = fs.readFileSync(configJsonPath, 'utf-8');
    const mainConfig = JSON.parse(configJsonContent);
    if (mainConfig.server?.backend?.port) {
      backendPort = parseInt(mainConfig.server.backend.port, 10);
      console.log(`[Vite] Successfully loaded backend port from config.json: ${backendPort}`);
    }
  }
} catch (error) {
  console.warn(`[Vite] Failed to read main app config.json, will use default backend port ${DEFAULT_BACKEND_PORT}. Error:`, error);
}
const backendUrl = `http://localhost:${backendPort}`;


// 2. Read development server port from panel's panel.json
const DEFAULT_DEV_PORT = 5678; // Ensure this port matches panel.json
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
        console.log(`[Vite] Successfully loaded dev server port from panel.json: ${devPort}`);
      }
    }
  }
} catch (error) {
  console.warn(`[Vite] Failed to read panel.json configuration, will use default dev server port ${DEFAULT_DEV_PORT}. Error:`, error);
}

// --- Vite Configuration ---
export default defineConfig({
  // Development server will serve index.html from project root
  root: './', 
  build: {
    // Build output to dist directory
    outDir: 'dist',
  },
  server: {
    port: devPort,
    cors: true, // Allow cross-origin
  },
  // Inject backend URL into HTML so SDK knows where to load from
  define: {
    '__BACKEND_URL__': JSON.stringify(backendUrl),
  }
});
```

### Step 5: Write `index.html` and Load SDK

This is your application UI. The Vite development server will directly serve this file.

```html
<!-- my-chat-panel/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>My Panel</title>
    <style>
      /* Theme variables automatically injected by SDK */
      body {
        background-color: hsl(var(--ct-background-base-hsl));
        color: hsl(var(--ct-text-base-hsl));
      }
    </style>
</head>
<body>
    <h1>Panel SDK Test</h1>
    <div id="api-status">Connecting to ComfyTavern...</div>
    <button id="test-invoke" disabled>Invoke Workflow</button>
    <pre id="output"></pre>

    <script type="module">
      let panelApi = null;

      // Dynamically load and initialize SDK
      async function loadAndInitSdk() {
        try {
          // Vite will replace __BACKEND_URL__ with the string defined in vite.config.js
          const sdkUrl = `${__BACKEND_URL__}/api/fam/sdk/panel.js`;
          console.log(`[Panel] Attempting to load SDK from: ${sdkUrl}`);

          // Use dynamic import() to load SDK
          const sdkModule = await import(sdkUrl);
          
          if (sdkModule && sdkModule.panelApi) {
            panelApi = sdkModule.panelApi;
            console.log("[Panel] SDK loaded successfully, panelApi available.");
            initializePanel();
          } else {
            throw new Error("SDK module loaded, but panelApi not found.");
          }
        } catch (error) {
          console.error("[Panel] Fatal error: Failed to load Panel SDK.", error);
          document.getElementById("api-status").textContent = "❌ SDK loading failed, check console.";
        }
      }

      function initializePanel() {
        document.getElementById("api-status").textContent = "✅ Connected!";
        const testButton = document.getElementById("test-invoke");
        testButton.disabled = false;
        testButton.addEventListener('click', handleInvoke);
      }

      async function handleInvoke() {
        if (!panelApi) return;
        const outputEl = document.getElementById("output");
        outputEl.textContent = 'Invoking workflow...';
        
        try {
          const { executionId } = await panelApi.invoke({
            workflowId: "chat", // Use alias defined in panel.json
            inputs: { "input_0": "Hello, world!" }, // Your workflow inputs
          });

          outputEl.textContent = `Execution started: ${executionId}\nWaiting for events...\n`;

          const unsubscribe = panelApi.subscribeToExecutionEvents(executionId, {
            onProgress: (payload) => {
              outputEl.textContent += `\nProgress: ${JSON.stringify(payload)}`;
            },
            onResult: (payload) => {
              outputEl.textContent += `\n\nFinal Result: ${JSON.stringify(payload.outputs, null, 2)}`;
              unsubscribe(); // Unsubscribe after receiving final result
            },
            onError: (payload) => {
              outputEl.textContent += `\n\nError: ${JSON.stringify(payload.error)}`;
              unsubscribe(); // Unsubscribe on error
            }
          });

        } catch (e) {
          outputEl.textContent = `Invocation Error: ${e.message}`;
        }
      }

      // Start
      loadAndInitSdk();
    </script>
</body>
</html>
```

### Step 6: Start Development Process

1.  **Start Vite Development Server**: Run `bun run dev` in the `my-chat-panel` directory.
2.  **Enable Development Mode in ComfyTavern**:
    *   Go to ComfyTavern's main settings interface.
    *   Find "Developer Options" or similar area, and toggle "Enable Panel Development Mode" on.
3.  **Open Panel**:
    *   Navigate to your project's panel list.
    *   You will see "Open" and "Develop" buttons on your panel card.
    *   Click the "Develop" button, and ComfyTavern will load your panel from `http://localhost:5678`.
4.  **Start Coding**: Now, whenever you modify and save `index.html` or other related files, Vite will automatically reload the content in the `iframe`, enabling hot-reloading!

## 3. SDK API Details

The `panelApi` object is the core of the SDK, communicating asynchronously with the ComfyTavern host environment via a Proxy. All methods returning a `Promise` are asynchronous.

### 3.1 Workflow Execution

#### `invoke(request: InvocationRequest): Promise<InvocationResponse>`

Asynchronously invokes a workflow.

- **`request`** (`InvocationRequest`):
    - `workflowId` (string): The ID of the workflow to invoke, or an alias defined in `panel.json`.
    - `inputs` (object): A key-value object where keys are the IDs of workflow input nodes (e.g., `input_0`, `input_1`), and values are the data you want to pass.
    - `mode?` (string): Execution mode, typically `native`.
- **Returns**: `Promise<InvocationResponse>`, resolves to an object containing `executionId`.

#### `subscribeToExecutionEvents(executionId: string, callbacks: PanelExecutionCallbacks): () => void`

Subscribes to the event stream of a specified execution ID. This is crucial for streaming output and real-time feedback.

- **`executionId`** (string): The execution ID obtained from the `invoke()` call.
- **`callbacks`** (`PanelExecutionCallbacks`):
    - `onProgress?(data)`: Called when intermediate output is generated during workflow execution.
    - `onResult?(data)`: Called when workflow execution successfully completes. `data.outputs` contains the final results of all output nodes.
    - `onError?(data)`: Called when an error occurs during workflow execution.
- **Returns**: An `unsubscribe` function. Calling this function stops listening to events for that execution, avoiding memory leaks.

```javascript
const unsubscribe = panelApi.subscribeToExecutionEvents(execId, { ... });

// When no longer needed
unsubscribe();
```

### 3.2 File System

All file system operations' paths are relative to the **panel's directory**. For example, calling `readFile('config.txt')` in `my-chat-panel` actually reads `.../ui/my-chat-panel/config.txt`.

- **`listFiles(path: string): Promise<PanelFile[]>`**: Lists files and directories under the specified path.
- **`readFile(path: string, encoding?: 'utf-8' | 'binary'): Promise<string | ArrayBuffer>`**: Reads file content. Defaults to `'utf-8'` string; `ArrayBuffer` when `'binary'`.
- **`writeFile(path: string, content: string | Blob | ArrayBuffer): Promise<void>`**: Writes to a file. Automatically creates file or directory if they don't exist.
- **`deleteFile(path: string, options?: { recursive?: boolean }): Promise<void>`**: Deletes a file or directory. Set `recursive: true` to delete non-empty directories.
- **`createDirectory(path: string): Promise<void>`**: Creates a new directory.

### 3.3 Other Utilities

#### `log(level: 'log' | 'warn' | 'error' | 'debug', ...args: any[]): void`

Forwards log messages from the panel to ComfyTavern's main logging system. This is a "fire-and-forget" operation with no return value.

**Best Practice**: Override `console.log` and other methods to automatically forward all logs.

```javascript
const originalConsole = { log: console.log, warn: console.warn, error: console.error };

console.log = (...args) => {
  originalConsole.log(...args);
  if (panelApi) panelApi.log('log', ...args);
};
// Do the same for warn and error
```

## 4. Theme Synchronization

The SDK automatically listens for ComfyTavern's theme changes and injects relevant CSS variables into your panel document's `:root` element. You just need to use these variables in your CSS.

**Example of available CSS variables**:

- `--ct-background-base-hsl`
- `--ct-text-base-hsl`
- `--ct-primary-hsl`
- `--ct-primary-content-hsl`
- `--ct-border-base-hsl`
- ...etc.

## 5. Production Build and Deployment

When you have finished developing your panel and need to deploy it as a production version:

1.  **Run Build Command**: Run `bun run build` in the `my-chat-panel` directory. This will generate production static files in the `dist` directory according to the `vite.config.js` configuration.
2.  **Confirm `panel.json` Configuration**: Ensure that the `uiEntryPoint` field correctly points to the built entry file, e.g., `dist/index.html`.
3.  **Deploy**: Done! Now, when a user clicks the "Open" button for your panel in ComfyTavern, these built, optimized static files will be loaded. Development and deployment configurations coexist, and you can switch back to hot-reloading mode at any time via the "Develop" button to continue iterating.