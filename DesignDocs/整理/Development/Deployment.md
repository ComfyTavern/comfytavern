# ComfyTavern 部署指南

## 1. 引言

本文档旨在详细阐述将 ComfyTavern 应用从开发环境构建并部署到生产环境（或其他目标环境，如预发布 Staging、测试环境）的过程。部署是将应用程序的稳定版本提供给最终用户或测试人员的关键步骤。

本文档将涵盖以下核心内容：

*   项目推荐的构建生产版本的命令和流程。
*   可选的部署策略和常见的目标环境。
*   生产环境中环境变量的关键配置。
*   前端静态资源服务的 Web 服务器配置建议。
*   后端服务的生产运行与管理方法。
*   关于 CI/CD 流程、部署后检查及回滚策略的考量。

## 2. 构建生产版本

构建生产版本是将源代码转换为优化过的、适合在生产环境中运行的静态文件或可执行包的过程。

### 2.1. 前端构建 (Vue 3 + Vite)

ComfyTavern 的前端使用 Vue 3 和 Vite 构建。

*   **构建命令**:
    根据项目根目录的 [`package.json`](../../../../package.json:16) 文件，前端的生产构建命令是：
    ```bash
    bun run build:frontend
    ```
    这个命令实际上执行了类型检查和实际的构建步骤 (`bun run type-check:frontend ; bun run build-only:frontend`)。具体的构建命令由 [`apps/frontend-vueflow/package.json`](../../../../apps/frontend-vueflow/package.json:1) (如果存在特定于前端的脚本) 和根 [`package.json`](../../../../package.json:15) 中的 `build-only:frontend` (`bun run --cwd apps/frontend-vueflow build-only`) 驱动。

*   **构建产物**:
    构建完成后，优化过的静态资源（HTML, CSS, JavaScript 文件等）通常会输出到 `apps/frontend-vueflow/dist` 目录。

*   **Vite 生产构建优化**:
    Vite 在执行生产构建时会自动进行多项优化，包括但不限于：
    *   **代码分割 (Code Splitting)**: 将代码拆分成更小的块，实现按需加载，提高初始加载速度。
    *   **Tree Shaking**: 移除未被使用的代码，减小打包体积。
    *   **静态资源哈希**: 为文件名添加哈希，利用浏览器缓存，仅在文件内容变更时更新。
    *   **CSS 压缩与提取**: 压缩 CSS 代码，并通常会将其提取到单独的文件中。
    *   **预加载指令生成**: 优化资源加载顺序。

### 2.2. 后端构建 (Elysia + Bun)

ComfyTavern 的后端使用 Elysia 框架，并基于 Bun 运行时。

*   **运行/构建命令**:
    根据 [`apps/backend/package.json`](../../../../apps/backend/package.json:6) 文件，生产环境下的启动命令是：
    ```bash
    NODE_ENV=production bun src/index.ts
    ```
    这表明 Bun 可以直接运行 TypeScript 文件 (`src/index.ts`) 作为生产服务。Bun 内置了 TypeScript 和 JSX 的转译器，以及一个高效的打包器。如果需要一个独立的构建步骤来生成一个更紧凑的包或可执行文件，可以使用 `bun build` 命令，例如：
    ```bash
    bun build ./src/index.ts --outdir ./dist --target bun
    ```
    然后通过 `bun ./dist/index.js` 运行。但从现有脚本来看，项目目前倾向于直接运行源文件。

*   **构建产物 (如果使用 `bun build`)**:
    如果执行了 `bun build`，产物通常会输出到指定的目录（例如 `--outdir ./dist`）。这将是一个或多个 JavaScript 文件，Bun 会处理依赖打包。

*   **Bun 的构建与运行**:
    Bun 的设计目标之一就是高性能和开箱即用的体验。它可以直接执行 TypeScript 文件，并在内部进行即时编译。当使用 `bun build` 时，它会创建一个优化的、独立的 JavaScript 包。

## 3. 部署策略与目标环境

选择合适的部署策略和目标环境对应用的稳定性、可扩展性和可维护性至关重要。

*   **当前策略**:
    根据目前项目文件结构（未发现 `Dockerfile` 或 CI/CD 配置文件），项目可能主要依赖**手动部署**或**自定义脚本部署**。

*   **常见目标部署环境**:
    *   **Docker 容器化部署**: 这是现代应用非常推荐的部署方式，它提供了环境一致性、隔离性和可移植性。
        *   虽然项目中未直接提供 `Dockerfile`，但可以为前端和后端分别创建。
        *   前端 Docker 镜像通常包含一个轻量级 Web 服务器（如 Nginx）来服务静态文件。
        *   后端 Docker 镜像会包含 Bun 运行时和后端代码。
        *   可以使用 `docker-compose.yml` 来编排本地开发或简单的多容器生产部署。
        *   **构建 Docker 镜像示例 (假设有 Dockerfile)**:
            ```bash
            # 前端
            docker build -t comfytavern-frontend -f Dockerfile.frontend .
            # 后端
            docker build -t comfytavern-backend -f Dockerfile.backend .
            ```
        *   **启动 Docker 容器示例**:
            ```bash
            # 前端 (将容器的 80 端口映射到主机的 5573 端口)
            docker run -d -p 5573:80 comfytavern-frontend
            # 后端 (将容器的 3000 端口映射到主机的 3233 端口，并传递环境变量)
            docker run -d -p 3233:3000 -e NODE_ENV=production -e DATABASE_URL="your_prod_db_url" comfytavern-backend
            ```
    *   **虚拟机 (VM) 或裸金属服务器**: 传统的部署方式，需要在服务器上配置好运行环境（Node.js, Bun, Web 服务器等），然后将构建产物复制上去并运行。
    *   **Serverless 平台**: 对于 ComfyTavern 这样可能涉及长连接 (WebSocket) 和有状态计算 (AI 工作流执行) 的应用，Serverless 部署可能不是首选，或者需要更复杂的架构设计（例如，将部分无状态 API Serverless 化，而核心引擎仍部署在长时运行的服务中）。

## 4. 环境变量配置 (生产环境)

在生产环境中正确配置环境变量至关重要，它们用于管理敏感信息、区分环境并控制应用行为。**绝不能将生产环境的敏感配置硬编码到代码中。**

*   **关键环境变量示例**:
    *   `NODE_ENV=production`: 告知应用当前运行在生产模式，这会影响许多库的行为（例如，日志级别、错误处理、性能优化）。
    *   `PORT_FRONTEND` (或类似): 前端服务监听的端口 (例如 `5573`)。
    *   `PORT_BACKEND` (或类似): 后端服务监听的端口 (例如 `3233`)。
    *   `DATABASE_URL`: 生产数据库的连接字符串。
    *   `API_BASE_URL`: 前端可能需要知道的后端 API 的公共访问地址。
    *   `JWT_SECRET` (或 `SESSION_SECRET`): 用于签名和验证 JSON Web Tokens 或会话的密钥，必须是一个强随机字符串。
    *   `LOG_LEVEL`: 控制日志输出的详细程度 (例如 `info`, `warn`, `error`)。
    *   `CORS_ORIGIN`: 配置允许跨域请求的来源。
    *   第三方服务 API 密钥: 例如，如果集成了外部 LLM 服务、存储服务等。

*   **设置环境变量的方法**:
    *   **操作系统环境变量**: 直接在服务器的操作系统级别设置。
    *   **`.env` 文件**: 使用如 `dotenv` (或 Bun 内置支持) 的库从项目根目录的 `.env` 文件加载。**注意：生产环境的 `.env` 文件不应提交到版本控制系统，应通过安全途径分发到服务器。**
    *   **Docker 容器**: 通过 `docker run -e VAR_NAME=value` 或 `docker-compose.yml` 中的 `environment` 字段注入。
    *   **CI/CD 系统**: 大多数 CI/CD 工具提供秘密管理功能，可以在部署时安全地注入环境变量。
    *   **云平台配置服务**: AWS Parameter Store, Azure App Configuration, Google Cloud Secret Manager 等。

## 5. Web 服务器配置 (用于前端静态资源)

构建好的前端静态产物 (HTML, CSS, JS 文件) 需要一个 Web 服务器来提供服务。Nginx 是一个流行的高性能选择。

*   **Nginx SPA 配置示例**:
    以下是一个基本的 Nginx 配置，用于服务 Vue SPA 应用，并处理路由回退：

    ```nginx
    server {
        listen 80; # 或者 443 如果使用 HTTPS
        server_name yourdomain.com; # 替换为你的域名

        # 前端静态文件根目录 (对应 Vite 构建产物的 dist 目录)
        root /path/to/your/apps/frontend-vueflow/dist;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html; # 关键：处理 SPA 路由
        }

        # 开启 Gzip 压缩
        gzip on;
        gzip_vary on;
        gzip_proxied any;
        gzip_comp_level 6;
        gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

        # 缓存策略 (示例，根据需求调整)
        location ~* \.(?:css|js)$ {
            expires 1y;
            add_header Cache-Control "public";
        }

        location ~* \.(?:png|jpg|jpeg|gif|ico|svg)$ {
            expires 1mo;
            add_header Cache-Control "public";
        }

        # (可选) HTTPS 配置
        # ssl_certificate /path/to/your/fullchain.pem;
        # ssl_certificate_key /path/to/your/privkey.pem;
        # include /etc/letsencrypt/options-ssl-nginx.conf;
        # ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    }
    ```
    确保将 `/path/to/your/apps/frontend-vueflow/dist` 和 `yourdomain.com` 替换为实际路径和域名。

## 6. 后端服务运行与管理 (生产环境)

在生产环境中，后端 Bun/Elysia 服务需要可靠地运行，并在发生故障时能够自动恢复。

*   **使用进程管理器**:
    强烈推荐使用进程管理器，如 PM2、systemd 或 supervisord。
    *   **PM2**: 是一个非常流行的 Node.js (也支持 Bun) 进程管理器。
        *   **自动重启**: 服务崩溃后自动重启。
        *   **日志管理**: 集中管理应用日志。
        *   **监控**: 提供基本的性能监控。
        *   **集群模式**: (如果 Bun 和应用支持) 可以利用多核 CPU。
        *   **平滑重启/热重载**: 更新应用时无需停机。

    *   **PM2 启动 Bun 应用示例**:
        假设后端构建产物 (或源文件入口) 在 `apps/backend/src/index.ts`。
        ```bash
        # 直接运行 .ts 文件 (Bun 支持)
        pm2 start bun --name "comfytavern-backend" -- run apps/backend/src/index.ts --interpreter none -- NODE_ENV=production

        # 或者，如果已经用 bun build 构建到 dist/index.js
        # pm2 start dist/index.js --name "comfytavern-backend" --interpreter bun -- NODE_ENV=production
        ```
        **注意**: PM2 对 Bun 的直接支持和最佳启动方式可能随 PM2 和 Bun 版本更新而变化，请查阅最新的 PM2 文档。`--interpreter none` 配合 `bun run` 可能是一种方式，或者直接指定 `bun` 作为解释器。

    *   **systemd**: Linux 系统常用的服务管理器，可以创建 service 文件来管理应用进程。
    *   **supervisord**: 另一个流行的进程控制系统。

## 7. CI/CD (持续集成/持续部署) 流程

虽然项目中目前未发现 CI/CD 配置文件 (如 `.github/workflows/deploy.yml`)，但建立 CI/CD 流程是自动化构建、测试和部署的推荐实践。

*   **典型 CI/CD 流水线阶段**:
    1.  **代码拉取 (Checkout)**: 从版本控制系统 (如 Git) 拉取最新代码。
    2.  **环境设置 (Setup Environment)**: 设置所需的运行时环境 (如特定版本的 Bun)。
    3.  **依赖安装 (Install Dependencies)**: 执行 `bun install`。
    4.  **代码检查与测试 (Lint & Test)**:
        *   运行 ESLint, Prettier 等进行代码风格和质量检查。
        *   运行单元测试、集成测试 (例如 `bun test`)。
        *   类型检查 (例如 `bun run type-check:frontend`)。
    5.  **构建生产版本 (Build)**:
        *   构建前端: `bun run build:frontend`
        *   (如果需要) 构建后端: `bun build apps/backend/src/index.ts --outdir apps/backend/dist`
    6.  **(可选) 构建 Docker 镜像**:
        *   使用 `docker build` 构建前端和后端镜像。
        *   将镜像推送到 Docker 镜像仓库 (如 Docker Hub, AWS ECR, Google GCR)。
    7.  **部署到目标环境 (Deploy)**:
        *   **对于 VM/裸金属**: 将构建产物通过 SCP/rsync 复制到服务器，然后通过 SSH 执行启动/重启命令 (例如，使用 PM2 重启服务)。
        *   **对于 Docker**: 在目标服务器上拉取最新的 Docker 镜像，并重新启动容器。
        *   **对于 Kubernetes/ECS 等编排平台**: 更新部署配置以使用新的镜像版本。
    8.  **(可选) 通知 (Notify)**: 部署完成后发送通知 (例如到 Slack 或邮件)。

*   **配置文件示例位置**:
    *   GitHub Actions: `.github/workflows/main.yml` 或 `.github/workflows/deploy.yml`
    *   GitLab CI: `.gitlab-ci.yml`

## 8. 部署后检查与监控

部署完成后，进行基本检查以确保应用按预期运行。

*   **基本检查**:
    *   访问前端 URL，确保页面能正确加载和交互。
    *   尝试核心功能，如用户登录、工作流加载/执行（如果可以模拟简单场景）。
    *   检查浏览器控制台是否有错误。
    *   访问后端健康检查端点 (如果已实现，例如 `/health`)，确认服务状态。
    *   查看后端服务日志，确保没有启动错误或持续的异常。

*   **监控与日志**:
    为了长期维护和问题排查，应考虑集成：
    *   **日志收集**: 将应用日志（前端和后端）发送到集中的日志管理系统，如 ELK Stack (Elasticsearch, Logstash, Kibana), Grafana Loki, Sentry (也处理错误), 或云服务商提供的日志服务。
    *   **应用性能监控 (APM)**: 工具如 Sentry (性能监控部分), Datadog, New Relic, Dynatrace 可以帮助追踪请求耗时、数据库查询性能、外部服务调用等，并发现性能瓶颈。
    *   **错误追踪**: Sentry 是一个优秀的前后端错误追踪工具。

## 9. 回滚策略

即使经过充分测试，新部署的版本有时也可能出现严重问题。制定回滚策略非常重要。

*   **常见回滚方法**:
    *   **手动回滚**:
        *   重新部署上一个稳定版本的构建产物。
        *   如果使用 Docker，重新部署上一个稳定版本的 Docker 镜像。
    *   **通过 CI/CD 流程回滚**: 许多 CI/CD 工具支持回滚到之前的成功部署。
    *   **蓝绿部署/金丝雀发布**: 更高级的部署策略，允许逐步切换流量到新版本，并在出现问题时快速切回旧版本。这些策略通常需要更复杂的部署基础设施。

*   **准备工作**:
    *   确保旧版本的构建产物或 Docker 镜像仍然可用。
    *   有清晰的流程记录或自动化脚本来执行回滚操作。

---

本文档提供了 ComfyTavern 项目部署的概览和建议。具体的部署方案应根据项目的实际需求、资源和目标环境进行调整和细化。