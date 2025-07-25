# ComfyTavern 本地开发环境搭建指南

## 1. 概述

本文档旨在指导开发者如何在本地成功搭建 ComfyTavern 项目的开发环境。完成环境搭建后，您将能够进行代码贡献、本地测试以及探索项目功能。

## 2. 先决条件

在开始之前，请确保您的本地环境中已安装以下软件和工具：

*   **Node.js**:
    *   建议安装最新的 [LTS (长期支持) 版本](https://nodejs.org/)。Node.js 主要用于部分开发工具的兼容性，例如某些全局 `node_modules` 缓存。
*   **Bun**:
    *   Bun 是本项目核心的 JavaScript 运行时、打包器、测试运行器和包管理器。它的高性能对于提升开发效率至关重要。
    *   推荐通过 [Bun 官方文档](https://bun.sh/docs/installation) 查看最新安装方法。
*   **Git**:
    *   用于版本控制和代码获取。您可以从 [Git 官网](https://git-scm.com/downloads) 下载并安装。
*   **代码编辑器**:
    *   推荐使用 [Visual Studio Code (VSCode)](https://code.visualstudio.com/)。
    *   为了提升开发体验，建议安装以下 VSCode 插件：
        *   [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint): 用于代码规范和错误检查。
        *   [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode): 用于代码格式化。
        *   [Vue Language Features (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.volar): 提供 Vue 3 的语法高亮、智能提示等支持。
        *   [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss): 提供 Tailwind CSS 的智能提示。

## 3. 获取项目代码

1.  **Fork 项目** (可选，推荐):
    *   如果您计划为 ComfyTavern 贡献代码或希望拥有一个独立的版本，建议先在 GitHub 上将 ComfyTavern 仓库 `fork` 到您自己的账户下。
    *   访问 [ComfyTavern GitHub 仓库](https://github.com/ComfyTavern/comfytavern)，点击右上角的 "Fork" 按钮。
2.  **克隆项目到本地**:
    *   打开您的终端或命令行工具。
    *   使用 Git 克隆 **您 fork 后的仓库** (如果您执行了 fork 步骤) 或**原始仓库**：
        ```bash
        git clone https://github.com/ComfyTavern/comfytavern.git
        ```
        如果您 fork 了项目，请将上述 URL 替换为您自己仓库的 URL。
3.  **进入项目根目录**:
    ```bash
    cd comfytavern
    ```

## 4. 安装项目依赖

ComfyTavern 使用 Bun 管理项目依赖。在项目根目录下执行以下命令来安装所有必需的依赖项：

```bash
bun install
```

此命令会读取根目录及工作区（`apps/*`, `packages/*`）下的 `package.json` 文件，并安装所有依赖。

## 5. 环境配置 (`config.json`)

ComfyTavern 项目的配置通过根目录下的 `config.json` 文件管理。项目启动脚本会自动检查并根据 [`config.template.json`](config.template.json:1) 文件来创建或合并 `config.json`。

*   **推荐做法**:
    通常情况下，您**无需手动创建或复制** `config.json`。首次通过启动脚本运行项目时，如果 `config.json` 不存在，它将自动生成并使用默认配置，或与现有模板进行合并。
*   **自定义配置**:
    如果您需要修改默认配置，例如更改端口、自定义节点路径或启用多用户模式，您可以手动创建 `config.json` 文件（或修改已自动生成的文件），并根据您的本地开发需求调整其中的配置项。
    
    **`config.json` 示例:**
    ```json
    {
      "server": {
        "frontend": {
          "port": 5573
        },
        "backend": {
          "port": 3233
        }
      },
      "execution": {
        "logDir": "./logs/execution"
      },
      "customNodePaths": [],
      "userManagement": {
        "multiUserMode": false,
        "accessPasswordHash": null
      }
    }
    ```
    请查阅 [`config.template.json`](config.template.json:1) 以了解所有可配置选项及其默认值。

## 6. 启动开发服务器

ComfyTavern 项目提供了推荐的统一启动方式，它会自动处理环境准备（包括配置和数据库设置）并同时启动前端和后端服务。

*   **统一启动 (推荐)**：
    在项目根目录下运行以下命令，启动脚本会负责：
    1.  检查并安装项目依赖（如果尚未安装）。
    2.  准备项目环境，包括检查或初始化 `config.json` 文件。
    3.  **自动初始化或迁移数据库** (详见下一节)。
    4.  同时启动前端开发服务器和后端 API 服务。

    ```bash
    bun run dev
    ```
    此命令（基于 `package.json` 中的 `dev` 脚本 `bun run prepare:project ; bun run server.ts dev`）会利用 `server.ts` 脚本来协调前后端的启动。成功启动后，前端应用将运行在 `http://localhost:5573/`，后端服务将运行在 `http://localhost:3233/`（或您在 `config.json` 中配置的端口）。

*   **独立启动前端/后端 (可选，适用于高级调试)**：
    如果您需要独立控制前端或后端，可以在两个独立的终端窗口中分别运行以下命令：

    *   **启动后端开发服务器**：
        在项目根目录下运行：
        ```bash
        bun run dev:backend
        ```
        成功启动后，后端服务将运行在 `http://localhost:3233/` (或您在 `config.json` 中配置的端口)。您可以尝试访问如 `http://localhost:3233/api/health` (如果存在此类健康检查端点) 来验证。

    *   **启动前端开发服务器**：
        在项目根目录下运行：
        ```bash
        bun run --cwd apps/frontend-vueflow dev
        ```
        此命令会使用 Vite 启动前端开发服务器。成功启动后，前端应用将运行在 `http://localhost:5573/` (或您在 `config.json` 中配置的端口)。

## 7. 数据库设置

ComfyTavern 使用 Drizzle ORM 进行数据库操作，默认使用 SQLite 数据库文件（`data/app.sqlite`）。项目启动脚本会自动处理数据库的初始化和迁移，极大地简化了开发环境的搭建。

1.  **自动化数据库初始化与迁移**:
    *   **当您执行 `bun run dev` 或 `bun run prepare:project` 命令时，系统会自动进行以下检查和处理：**
        *   检查 `data/app.sqlite` 数据库文件是否存在且有效。
        *   如果数据库不存在或为空，则会自动执行必要的数据库迁移。这意味着您通常**无需手动运行** `bunx drizzle-kit generate` 或 `bun run db:migrate`。
    *   此自动化逻辑由 `scripts/ensureProjectReady.ts` 脚本负责，它确保您的数据库始终与项目代码的最新架构保持同步。

2.  **手动数据库操作 (进阶或调试用途)**：
    在某些特定场景下（例如，开发新的数据库 Schema、调试迁移问题或进行高级数据库管理），您可能需要手动执行以下命令：
    *   **生成迁移文件**：
        ```bash
        bunx drizzle-kit generate
        ```
        此命令会根据 [`apps/backend/src/db/schema.ts`](apps/backend/src/db/schema.ts:1) 中的数据库结构定义，在 `apps/backend/drizzle/migrations` 目录下生成新的 SQL 迁移文件。
    *   **应用数据库迁移**:
        ```bash
        bun run db:migrate
        ```
        此命令会将所有待处理的迁移应用到 `data/app.sqlite` 数据库中。

3.  **数据库升级脚本** (用于特定版本升级或数据处理)：
    ```bash
    bun run db:upgrade
    ```
    这个脚本 ([`scripts/upgradeDatabase.ts`](scripts/upgradeDatabase.ts:1)) 可能包含一些自定义的数据库升级或数据处理逻辑，通常在手动升级项目版本时使用。

**对于初次搭建环境，强烈推荐直接运行 `bun run dev`，它会自动处理包括数据库初始化在内的所有环境准备。**

## 8. 验证环境

完成以上步骤后，您可以进行以下验证，确保开发环境已成功搭建：

*   **前端应用**：
    *   在浏览器中打开前端应用的 URL (默认为 `http://localhost:5573/`)。
    *   检查应用是否能正确加载并显示主要界面，例如节点编辑器、侧边栏等。
*   **后端服务**：
    *   尝试通过前端应用执行一些需要后端交互的操作（例如创建新项目、加载或保存工作流）。
    *   或者，使用 Postman 或类似的 API 测试工具，向后端某个已知 API 端点（例如 `http://localhost:3233/api/health` 或用户认证、项目列表等）发送请求，检查是否能收到预期的响应。

## 9. 常见问题与故障排除

*   **端口冲突**：如果 `5573` 或 `3233` 端口已被其他应用占用，您可以在 `config.json` 中修改端口号，并相应地更新访问 URL。
*   **依赖安装失败**：
    *   确保您的 Bun 和 Node.js 版本符合要求。
    *   尝试删除 `bun.lockb` 文件和 `node_modules` 目录 (在根目录和 `apps/*` 下都检查)，然后重新运行 `bun install`。
    *   检查终端输出的错误信息，可能包含特定依赖安装失败的原因。
*   **Windows 环境下的路径问题**：确保您的终端正确处理路径。PowerShell 通常能很好地工作。
*   **`bun run dev` 或 `bun run dev:backend` 报错**：检查后端依赖是否完整，[`apps/backend/src/index.ts`](apps/backend/src/index.ts:1) 是否存在且无明显编译错误。

如果遇到其他问题，请查阅项目文档或向社区寻求帮助。