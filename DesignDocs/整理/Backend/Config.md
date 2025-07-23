# 后端配置 (`apps/backend/src/config.ts`) 详解

## 1. 文件职责

[`apps/backend/src/config.ts`](../../../../apps/backend/src/config.ts:1) 文件是 ComfyTavern 后端应用的配置管理中心。它的核心职责是统一管理和提供应用运行所需的各种可配置参数。这些参数影响着服务器的行为、功能启用、资源路径以及与其他服务的交互方式。通过集中管理配置，可以方便地根据不同的部署环境（开发、生产等）或用户需求调整应用行为，而无需修改核心代码。

## 2. 配置加载机制

后端配置主要依赖于项目根目录下的 `config.json` 文件。

- **主要配置源**: 应用启动时，会从项目根目录读取 [`config.json`](../../../../config.json:1) 文件。这个 JSON 文件包含了大部分基础配置信息，如服务器端口、执行参数、用户管理设置和安全选项等。
- **环境变量与默认值**:
  - 目前的代码实现中，配置加载**不直接**依赖于系统环境变量（例如通过 `.env` 文件和 `dotenv` 库）。配置项的值主要从 `config.json` 中读取。
  - 对于某些配置项，如果 `config.json` 中未提供，代码中会提供默认值。例如，`MAX_CONCURRENT_WORKFLOWS` 默认为 `5`。
- **动态路径生成**: 许多路径相关的配置（如日志目录、库目录）会结合 [`apps/backend/src/utils/fileUtils.ts`](../../../../apps/backend/src/utils/fileUtils.ts:1) 中的工具函数来生成。这些函数通常会提供标准的默认路径，但某些配置（如 `LOG_DIR`）允许通过 `config.json` 进行覆盖。
- **开发模式检测**: 通过 `process.argv.includes('dev')` 检测当前是否处于开发模式，但这目前未直接用于修改配置加载逻辑，主要用于条件性执行某些开发相关的代码。

## 3. 主要配置项

以下是 [`config.ts`](../../../../apps/backend/src/config.ts:1) 中定义或导出的主要配置项：

- **`LOG_DIR: string`**

  - **用途**: 指定后端应用的日志文件存储目录。
  - **来源**: 优先从 `config.json` 中的 `execution.logDir` 读取。如果未配置，则通过 [`getLogDir()`](../../../../apps/backend/src/utils/fileUtils.ts:3) 函数获取默认日志目录路径。
  - **影响**: 决定了应用日志（如错误日志、运行日志）的存放位置。

- **`PORT: number`**

  - **用途**: 指定后端 HTTP 服务器监听的端口号。
  - **来源**: 从 `config.json` 中的 `server.backend.port` 读取。
  - **影响**: 决定了后端 API 服务的访问入口。

- **`FRONTEND_URL: string`**

  - **用途**: 指定前端应用的访问 URL。
  - **来源**: 基于 `config.json` 中的 `server.frontend.port` 构建，格式为 `http://localhost:{frontend.port}`。
  - **影响**: 主要用于后端需要引用或重定向到前端的场景，例如 CORS 配置或身份验证流程。

- **`MAX_CONCURRENT_WORKFLOWS: number`**

  - **用途**: 限制同时执行的工作流的最大数量。
  - **来源**: 从 `config.json` 中的 `execution.max_concurrent_workflows` 读取。如果未配置，默认为 `5`。
  - **影响**: 控制系统资源消耗，防止因过多并发工作流导致性能问题。

- **`pluginPaths: string[]`** (替代了旧的 `customNodePaths`)

  - **用途**: 定义插件的加载目录列表。这些路径应相对于项目根目录。
  - **来源**: 从 `config.json` 中的 `pluginPaths` 读取。
  - **影响**: `PluginLoader` 服务会扫描这些目录来发现和加载插件，从而扩展应用功能。

- **`MULTI_USER_MODE: boolean`**

  - **用途**: 启用或禁用多用户模式。
  - **来源**: 从 `config.json` 中的 `userManagement.multiUserMode` 读取。明确转换为布尔值，如果未配置或配置非 `true`，则默认为 `false`。
  - **影响**: 决定了应用是作为单用户实例运行还是支持多用户账户和数据隔离。

- **`ACCESS_PASSWORD_HASH: string | null`**

  - **用途**: 在单用户模式下，用于访问控制的密码哈希值。
  - **来源**: 从 `config.json` 中的 `userManagement.accessPasswordHash` 读取。如果未配置，默认为 `null`。
  - **影响**: 如果设置了此值，单用户模式下访问应用可能需要密码验证。
  - (注意: `singleUserPath` 配置项已移除。在单用户模式下，用户数据存储路径是基于固定的用户 ID `'default_user'` 与 `USER_DATA_ROOT` 结合构建的，不再通过 `config.json` 中的特定路径标识符配置。)

- **`ENABLE_CREDENTIAL_ENCRYPTION: boolean`**

  - **用途**: 启用或禁用敏感凭据（如 API 密钥）的加密功能。
  - **来源**: 从 `config.json` 中的 `security.enableCredentialEncryption` 读取。明确转换为布尔值，如果未配置或配置非 `true`，则默认为 `false`。
  - **影响**: 若启用，系统将对存储的敏感凭据进行加密，增强安全性。

- **`MASTER_ENCRYPTION_KEY: string | undefined`**

  - **用途**: 用于加密和解密凭据的主加密密钥。
  - **来源**: 从 `config.json` 中的 `security.masterEncryptionKeyValue` 读取。如果未配置，则为 `undefined`。
  - **注意**: **直接在 `config.json` 中存储主密钥存在安全风险，更推荐的做法是通过环境变量或其他安全的密钥管理机制提供此密钥。** 当前实现允许直接从 `config.json` 读取，可能是为了简化开发或特定部署场景。
  - **影响**: 加密功能的核心，如果未提供或提供不当，将影响凭据加密的安全性。

- **`LIBRARY_BASE_DIR: string`**

  - **用途**: 全局节点/资源库的基础目录路径。
  - **来源**: 通过 [`getLibraryBaseDir()`](../../../../apps/backend/src/utils/fileUtils.ts:4) 函数获取。
  - **影响**: 定义了存放共享节点、预设等资源的根位置。

- **`WORKFLOWS_DIR: string`**

  - **用途**: 全局库中存储工作流文件的目录路径。
  - **来源**: 通过 [`getGlobalWorkflowsDir()`](../../../../apps/backend/src/utils/fileUtils.ts:5) 函数获取。
  - **影响**: 全局共享工作流的默认存放位置。

- **`SILLYTAVERN_DIR: string`**

  - **用途**: 全局库中存储 SillyTavern 相关资源（如角色卡）的目录路径。
  - **来源**: 通过 [`getGlobalSillyTavernDir()`](../../../../apps/backend/src/utils/fileUtils.ts:6) 函数获取。
  - **影响**: SillyTavern 角色卡等资源的默认存放位置。

- **`PROJECTS_BASE_DIR: string`**
  - **用途**: 所有项目（包含用户特定的工作流、数据等）的基础存储目录。
  - **来源**: 通过 [`getProjectsBaseDir()`](../../../../apps/backend/src/utils/fileUtils.ts:7) 函数获取。
  - **影响**: 用户项目数据的根目录，内部会根据用户（多用户模式下）或默认用户（单用户模式下）进行组织。

## 4. 类型与验证

- **TypeScript 类型**: [`config.ts`](../../../../apps/backend/src/config.ts:1) 文件本身使用 TypeScript 编写，导出的配置项都具有明确的类型（如 `string`, `number`, `boolean`, `string[]`）。这有助于在开发阶段捕获类型错误。
- **隐式类型**: `config.json` 的结构被隐式地期望符合 [`config.ts`](../../../../apps/backend/src/config.ts:1) 中读取逻辑的结构。例如，期望 `config.server.backend.port` 存在且为数字。
- **运行时转换/默认值**: 代码中对从 `config.json` 读取的值进行了一些运行时处理：
  - 对于布尔类型的配置（如 `MULTI_USER_MODE`, `ENABLE_CREDENTIAL_ENCRYPTION`），会明确检查是否 `=== true`，以确保严格的布尔转换，避免将非 `true` 的真值（如字符串 "false"）误判为 `true`。
  - 对于可选配置（如 `MAX_CONCURRENT_WORKFLOWS`, `ACCESS_PASSWORD_HASH`），如果 `config.json` 中未提供，会使用 `??` 操作符或逻辑或 `||` 来赋予默认值。
- **无显式验证库**: 当前代码没有使用像 Zod 这样的库来对从 `config.json` 加载的配置对象进行严格的模式验证和解析。配置的正确性主要依赖于 `config.json` 文件遵循预期的结构和数据类型。

## 5. 在应用中使用配置

后端应用的其他模块通过标准的 ES 模块导入机制来使用这些配置项。

**示例**:

```typescript
// 在某个服务模块中 (e.g., apps/backend/src/services/DatabaseService.ts)
import { PORT, LOG_DIR, MULTI_USER_MODE } from "../config"; // 路径根据实际位置调整

class MyService {
  constructor() {
    console.log(`后端服务运行在端口: ${PORT}`);
    console.log(`日志将写入到: ${LOG_DIR}`);
    if (MULTI_USER_MODE) {
      console.log("应用当前运行在多用户模式。");
    } else {
      console.log("应用当前运行在单用户模式。");
    }
  }

  // ... 其他服务逻辑
}
```

通过这种方式，配置值可以在整个后端应用的任何需要的地方被方便地访问和使用，确保了配置的一致性和集中管理。
