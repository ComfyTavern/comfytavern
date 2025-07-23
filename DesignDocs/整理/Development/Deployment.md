# ComfyTavern 部署与运行指南

## 1. 引言

ComfyTavern 设计目标之一就是提供简化的部署和运行体验。无论您是开发者还是最终用户，都可以通过项目提供的一键启动脚本快速运行应用。本文档将详细介绍 ComfyTavern 的推荐运行方式，并概述一些进阶部署选项。

## 2. 快速启动 ComfyTavern

### 2.1. 环境要求

在启动 ComfyTavern 之前，请确保您的系统满足以下环境要求：

*   **Bun**: `v1.2.5+` (主要运行时环境)
*   **Node.js**: `v20+` (用于开发工具，如 `bun install` 可能会依赖其全局 `node_modules` 缓存)
*   **操作系统**: Windows / Linux / macOS

### 2.2. 获取代码

如果您尚未获取 ComfyTavern 的代码，请通过以下方式之一：

```bash
git clone https://github.com/ComfyTavern/comfytavern.git
cd comfytavern
```
或直接从 [GitHub 仓库打包](https://github.com/ComfyTavern/comfytavern/archive/refs/heads/main.zip) 下载 ZIP 并解压。

### 2.3. 安装依赖

进入项目根目录后，执行以下命令安装所有必要的依赖：

```bash
bun install
```
> 如果遇到网络问题，可尝试淘宝镜像: `bun install --registry https://registry.npmmirror.com`

### 2.4. 启动应用

ComfyTavern 提供了一键启动脚本，它会自动处理环境检查、依赖安装（如果未安装）、项目环境准备（例如数据库初始化）以及前端和后端服务的启动。

您可以选择 **完整启动** 或 **快速启动**，以及 **开发模式** 或 **生产模式**。

*   **完整启动**: **首次启动或更新版本后推荐使用**。它会检查并准备所有必要的配置（如数据库），确保环境最新。
*   **快速启动**: **日常开发中推荐使用**。如果确认配置无变化，可跳过环境准备步骤以提升启动速度。

| 平台        | 模式选择 | 启动命令          | 说明                                             |
| :---------- | :------- | :---------------- | :----------------------------------------------- |
| Windows     | 生产模式 | `.\start.bat`     | 启动生产环境的 ComfyTavern 服务                  |
| Windows     | 开发模式 | `.\start.bat dev` | 启动开发环境的 ComfyTavern 服务 (带热重载)       |
| Linux/macOS | 生产模式 | `./start.sh`      | 启动生产环境的 ComfyTavern 服务                  |
| Linux/macOS | 开发模式 | `./start.sh dev`  | 启动开发环境的 ComfyTavern 服务 (带热重载)       |

**默认访问地址:**

*   **前端**: `http://localhost:5573/`
*   **后端 API**: `http://localhost:3233/`

### 2.5. 强制重新构建前端

为了提升启动速度，`start.bat` 和 `start.sh` 在检测到前端构建产物 (`apps/frontend-vueflow/dist` 目录) 已存在时，会默认跳过前端构建步骤。

如果您修改了前端代码，或者怀疑前端显示不正确，可以强制重新构建：

```bash
bun run build
```
该命令会删除旧的构建产物并生成全新的文件，确保您看到的是最新版本。

## 3. 端口配置

ComfyTavern 的前端和后端服务默认监听端口分别为 `5573` 和 `3233`。您可以通过修改项目根目录下的 `config.json` 文件来配置这些端口。

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
  }
}
```
如果您没有 `config.json` 文件，系统将使用默认端口。

## 4. 进阶部署选项

对于更复杂的生产环境需求，您可以考虑以下高级部署策略。这些选项通常需要更深入的系统配置知识。

### 4.1. 环境变量配置

在生产环境中，正确配置环境变量至关重要，它们用于管理敏感信息、区分环境并控制应用行为。**绝不能将生产环境的敏感配置硬编码到代码中。**

*   **关键环境变量示例**:
    *   `NODE_ENV=production`: 告知应用当前运行在生产模式。
    *   `DATABASE_URL`: 生产数据库的连接字符串。
    *   `JWT_SECRET` (或 `SESSION_SECRET`): 用于签名和验证 JSON Web Tokens 或会话的密钥。
    *   第三方服务 API 密钥等。
*   **设置方法**: 可以通过操作系统环境变量、`.env` 文件 (不提交到版本控制)、Docker 容器注入、CI/CD 系统或云平台配置服务来设置。

### 4.2. 进程管理 (PM2)

对于传统的 VPS 或裸金属服务器部署，`PM2` (Process Manager 2) 是管理 Bun/Node.js 应用的推荐工具。它提供了自动重启、日志管理、监控、集群模式和热重载等功能。

ComfyTavern 项目提供了通过 `bun run manage:pm2` 脚本进行生产环境部署和管理的封装。

*   **启动所有服务**:
    ```bash
    bun run manage:pm2 start
    ```
*   **查看所有服务状态**:
    ```bash
    bun run manage:pm2 list
    ```
*   **查看日志**:
    ```bash
    bun run manage:pm2 logs comfytavern-backend # 或 comfytavern-frontend
    ```
*   **停止所有服务**:
    ```bash
    bun run manage:pm2 stop
    ```
> 更多命令请查看 `ecosystem.config.cjs` 或 PM2 文档。

### 4.3. 容器化部署 (Docker)

Docker 容器化是现代应用非常推荐的部署方式，它提供了环境一致性、隔离性和可移植性。

虽然项目中未直接提供 `Dockerfile`，但可以为前端和后端分别创建：
*   前端 Docker 镜像通常包含一个轻量级 Web 服务器（如 Nginx）来服务静态文件。
*   后端 Docker 镜像会包含 Bun 运行时和后端代码。
*   可以使用 `docker-compose.yml` 来编排本地开发或简单的多容器生产部署。

## 5. 部署后检查与监控

部署完成后，进行基本检查以确保应用按预期运行。

*   **基本检查**:
    *   访问前端 URL，确保页面能正确加载和交互。
    *   尝试核心功能，检查浏览器控制台是否有错误。
    *   查看后端服务日志，确保没有启动错误。
*   **监控与日志**: 
    为了长期维护和问题排查，应考虑集成集中的日志收集系统和应用性能监控 (APM) 工具。

## 6. 回滚策略

即使经过充分测试，新部署的版本有时也可能出现严重问题。制定回滚策略非常重要。

*   **常见回滚方法**: 重新部署上一个稳定版本的构建产物或 Docker 镜像。
*   **准备工作**: 确保旧版本的构建产物或 Docker 镜像仍然可用，并有清晰的流程记录或自动化脚本来执行回滚操作。

---

本文档旨在提供 ComfyTavern 项目简化的部署指南。具体的部署方案应根据项目的实际需求、资源和目标环境进行调整和细化。