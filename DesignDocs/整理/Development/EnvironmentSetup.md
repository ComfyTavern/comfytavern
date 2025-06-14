# ComfyTavern 本地开发环境搭建指南

## 1. 概述

本文档旨在指导开发者如何在本地成功搭建 ComfyTavern 项目的开发环境。完成环境搭建后，您将能够进行代码贡献、本地测试以及探索项目功能。

## 2. 先决条件

在开始之前，请确保您的本地环境中已安装以下软件和工具：

*   **Node.js**:
    *   建议安装最新的 [LTS (长期支持) 版本](https://nodejs.org/)。Node.js 是许多前端和后端工具的基础。
*   **Bun**:
    *   Bun 是本项目核心的 JavaScript 运行时、打包器、测试运行器和包管理器。它的高性能对于提升开发效率至关重要。
    *   推荐通过官方脚本安装最新版本：
        ```bash
        curl -fsSL https://bun.sh/install | bash
        ```
    *   更多安装方式请参考 [Bun 官方文档](https://bun.sh/docs/installation)。
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

1.  打开您的终端或命令行工具。
2.  使用 Git 克隆 ComfyTavern 的项目仓库。请将 `<repository_url>` 替换为实际的项目仓库 URL：
    ```bash
    git clone <repository_url>
    ```
    例如，如果仓库在 GitHub 上，通常是 `https://github.com/your-username/ComfyTavern.git`。
3.  进入项目根目录：
    ```bash
    cd ComfyTavern
    ```

## 4. 安装项目依赖

ComfyTavern 使用 Bun 管理项目依赖。在项目根目录下执行以下命令来安装所有必需的依赖项：

```bash
bun install
```

此命令会读取根目录及工作区（`apps/*`, `packages/*`）下的 `package.json` 文件，并安装所有依赖。

## 5. 环境配置

项目使用 `config.json` 文件进行配置。模板文件为 [`config.template.json`](config.template.json:1)。

1.  在项目根目录下，复制 [`config.template.json`](config.template.json:1) 并将其重命名为 `config.json`:
    ```bash
    # 在 Windows PowerShell 中:
    Copy-Item config.template.json config.json

    # 在 Linux/macOS 中:
    # cp config.template.json config.json
    ```
2.  打开 `config.json` 文件，并根据您的本地开发需求调整其中的配置项。对于初次本地开发，通常可以保留大部分默认设置。关键配置项包括：
    *   `server.backend.port`: 后端服务器运行端口 (默认为 `3233`)。
    *   `server.frontend.port`: 前端开发服务器运行端口 (默认为 `5573`)。
    *   `execution.logDir`: 工作流执行日志的存储目录。
    *   `customNodePaths`: 自定义节点的加载路径。
    *   `userManagement.multiUserMode`: 是否启用多用户模式。
    *   `userManagement.singleUserPath`: 单用户模式下的数据存储路径。

    请查阅 [`config.template.json`](config.template.json:1) 以了解所有可配置选项及其默认值。

## 6. 启动开发服务器

ComfyTavern 的前端和后端服务需要分别启动。建议在两个独立的终端窗口中运行它们。

*   **启动后端开发服务器**：
    在项目根目录下运行以下命令：
    ```bash
    bun run dev:backend
    ```
    成功启动后，后端服务将运行在 `http://localhost:3233/` (或您在 `config.json` 中配置的端口)。您可以尝试访问如 `http://localhost:3233/api/health` (如果存在此类健康检查端点) 来验证。

*   **启动前端开发服务器**：
    在项目根目录下运行以下命令：
    ```bash
    bun run --cwd apps/frontend-vueflow dev
    ```
    此命令会使用 Vite 启动前端开发服务器。成功启动后，前端应用将运行在 `http://localhost:5573/` (或您在 `config.json` 中配置的端口)。

    > **注意**: 根据根 [`package.json`](package.json:1) 中的 `dev` 脚本 (`bun run prepare:project ; bun run server.ts`)，也可能存在一个统一的启动方式。但为了更清晰地分离前后端开发，推荐使用上述独立启动命令。

## 7. 数据库设置

项目使用 Drizzle ORM 进行数据库操作，默认可能使用 SQLite。

1.  **生成迁移文件** (当您修改了 [`apps/backend/src/db/schema.ts`](apps/backend/src/db/schema.ts:1) 中的数据库结构后执行)：
    ```bash
    bun run db:generate
    ```
    此命令会根据 schema 定义在 `apps/backend/drizzle/migrations` 目录下生成新的 SQL 迁移文件。

2.  **应用数据库迁移** (初始化数据库或应用新的迁移)：
    ```bash
    bun run db:migrate
    ```
    此命令会将所有待处理的迁移应用到数据库。对于首次设置，这将创建数据库表。

3.  **数据库升级脚本** (如果项目提供了特定的升级逻辑)：
    ```bash
    bun run db:upgrade
    ```
    这个脚本 ([`scripts/upgradeDatabase.ts`](scripts/upgradeDatabase.ts:1)) 可能包含一些自定义的数据库升级或数据处理逻辑。

对于初次搭建环境，通常需要运行 `bun run db:migrate` 来初始化数据库结构。

## 8. 验证环境

完成以上步骤后，您可以进行以下验证：

*   **前端应用**：
    *   在浏览器中打开前端应用的 URL (默认为 `http://localhost:5573/`)。
    *   检查应用是否能正确加载并显示主要界面，例如节点编辑器、侧边栏等。
*   **后端服务**：
    *   尝试通过前端应用执行一些需要后端交互的操作（例如加载或保存工作流，如果已有示例）。
    *   或者，使用 Postman 或类似的 API 测试工具，向后端某个已知 API 端点（例如用户认证、项目列表等）发送请求，检查是否能收到预期的响应。

## 9. 常见问题与故障排除 (可选)

*   **端口冲突**：如果 `5573` 或 `3233` 端口已被其他应用占用，您可以在 `config.json` 中修改端口号，并相应地更新访问 URL。
*   **依赖安装失败**：
    *   确保您的 Bun 和 Node.js 版本符合要求。
    *   尝试删除 `bun.lockb` 文件和 `node_modules` 目录 (在根目录和 `apps/*` 下都检查)，然后重新运行 `bun install`。
    *   检查终端输出的错误信息，可能包含特定依赖安装失败的原因。
*   **Windows 环境下的路径问题**：确保您的终端正确处理路径。PowerShell 通常能很好地工作。
*   **`bun run dev:backend` 报错**：检查后端依赖是否完整，[`apps/backend/src/index.ts`](apps/backend/src/index.ts:1) 是否存在且无明显编译错误。

如果遇到其他问题，请查阅项目文档或向社区寻求帮助。