# 统一文件与资产管理系统设计文档 (草案)

## 1. 引言

### 1.1. 背景与目标

随着 ComfyTavern 项目功能的扩展，对文件和各类用户资产（如项目、工作流、知识库、输出文件等）的管理需求日益复杂。当前的文件操作散布在不同的服务和工具函数中，缺乏统一的抽象和管理机制。

本设计旨在提出一个统一的文件与资产管理系统（以下简称 FAM 系统），目标是：

- 提供一个清晰、一致的文件组织结构。
- 通过逻辑路径抽象，简化对不同类型和层级文件的访问。
- 确保用户数据的严格隔离与安全。
- 为未来功能的扩展（如更细致的权限控制、版本管理等）打下基础。
- 整合现有系统中关于项目文件、用户数据、共享资源的管理逻辑。

### 1.2. 设计原则

- **用户隔离优先**: 每个用户的数据严格存储在其独立的用户空间内。
- **逻辑路径抽象**: 应用层面通过统一的逻辑路径 URI 方案访问文件，屏蔽底层物理存储细节。
- **分层存储**: 区分用户个人资源、应用全局共享资源和系统级资源。
- **配置驱动**: 物理路径的根目录等应尽可能通过配置管理，而非硬编码。
- **可扩展性**: 设计应考虑到未来可能增加的新资产类型或管理需求。

### 1.3. 范围

本系统将主要管理以下类型的文件和资产：

- 用户项目及其内部文件（工作流、输出、项目特定资产）。
- 用户个人库资源（个人模板、脚本、个人知识库）。
- 应用共享库资源（全局模板、示例、全局知识库）。
- 系统级资源（如公共静态文件、日志、应用数据）。

## 2. 核心概念

- **UserId**: 用户的唯一标识符。
- **ProjectId**: 用户项目的唯一标识符。
- **KnowledgeBaseId (KbId)**: 知识库的唯一标识符，区分用户级和共享级。
- **逻辑路径 (Logical Path)**: 一种 URI 风格的字符串，用于在应用层面唯一标识一个文件或目录资源，例如 `user://projects/myProject/workflows/main.json`。
- **物理路径 (Physical Path)**: 文件系统上实际的文件或目录路径。FAM 系统的核心职责之一是将逻辑路径解析为物理路径。

## 3. 文件与资产的逻辑组织

FAM 系统将采用以下逻辑路径方案：

### 3.1. 用户空间 (`user://`)

所有特定于单个用户的数据和资产。

- **用户项目**: `user://projects/{projectId}/`
  - 工作流: `user://projects/{projectId}/workflows/{workflowId}.json`
  - 项目输出: `user://projects/{projectId}/outputs/{...filePath}`
  - 项目资产: `user://projects/{projectId}/assets/{...filePath}` (例如 CSV, TXT, 小型媒体文件)
  - 项目元数据: `user://projects/{projectId}/project.json` (包含项目信息及知识库引用)
- **用户个人库**: `user://library/`
  - 个人模板/脚本等: `user://library/templates/{templateName}.json` (示例)
  - 用户个人知识库: `user://library/knowledgebases/{userKbId}/{...filePath}`

### 3.2. 共享空间 (`shared://`)

应用级别的、所有用户均可访问（通常为只读）的共享资源。

- **应用共享库**: `shared://library/`
  - 全局模板/示例: `shared://library/workflows/{templateId}.json` (示例)
  - 全局知识库: `shared://library/knowledgebases/{sharedKbId}/{...filePath}`

### 3.3. 系统空间 (`system://`)

应用自身的、非用户直接创建和管理的文件。

- **公共静态资源**: `system://public/{...filePath}`
- **应用数据**: `system://data/{...filePath}` (例如数据库文件)
- **日志文件**: `system://logs/{...filePath}`

## 4. 物理存储结构

基于现有 `fileUtils.ts` 和 `projectService.ts` 的实践，并结合新的需求，建议的物理文件系统结构如下：

```
ComfyTavern/  (项目根目录, 由 getProjectRootDir() 确定)
├── data/  (映射到 system://data/)
├── logs/  (映射到 system://logs/)
│   └── executions/
├── public/  (映射到 system://public/)
│   └── avatars/
├── templates/  (新增, 映射到 shared://templates/)
│   └── project-templates/  (映射到 shared://templates/project-templates/)
│       ├── {templateId1}/
│       │   ├── project.json
│       │   ├── workflows/
│       │   └── ... (完整的项目结构)
│       └── {templateId2}/
│           └── ...
├── library/  (映射到 shared://library/)
│   ├── workflows/  (示例: shared://library/workflows/)
│   ├── SillyTavern/  (历史遗留, 可按需保留或移除，暂且保留作为资源解析测试)
│   └── knowledgebases/  (映射到 shared://library/knowledgebases/)
│       ├── {sharedKbId1}/
│       │   └── ...
│       └── {sharedKbId2}/
│           └── ...
├── userData/  (用户数据根目录, 由 getGlobalUserDataRoot() 确定)
│   ├── {userId1}/
│   │   ├── projects/  (映射到 user://projects/ 前缀)
│   │   │   └── {projectId1_1}/
│   │   │       ├── project.json
│   │   │       ├── workflows/
│   │   │       ├── outputs/
│   │   │       └── assets/
│   │   ├── library/  (映射到 user://library/ 前缀)
│   │   │   ├── ... (用户个人模板、脚本等)
│   │   │   └── knowledgebases/  (映射到 user://library/knowledgebases/)
│   │   │       ├── {userKbId1_1}/
│   │   │       │   └── ...
│   │   │       └── {userKbId1_2}/
│   │   │           └── ...
│   │   └── .recycle_bin/  (项目和工作流的回收站)
│   └── {userId2}/
│       └── ...
└── ... (其他应用文件和目录)
```

## 5. 知识库管理

### 5.1. 知识库的创建与元数据

- 知识库（无论是用户级还是共享级）本身也需要元数据管理（例如名称、描述、创建时间等）。这可以考虑通过在每个知识库目录下放置一个 `kb.json` 文件来实现，或者未来通过数据库管理。本期设计优先关注文件结构和引用。
- 物理文件存储在各自 `knowledgebases` 目录下，以 `KbId` 作为子目录名。

### 5.2. 项目对知识库的引用机制

项目通过在其 `project.json` 文件中声明所引用的知识库。

**`project.json` 示例片段:**

```json
{
  "id": "myProject123",
  "name": "My Awesome Project",
  "createdAt": "2025-06-14T10:00:00Z",
  "updatedAt": "2025-06-14T11:00:00Z",
  "version": "1.0.0",
  "description": "An example project.",
  "knowledgeBaseReferences": [
    {
      "id": "userKbPersonalDocs",
      "type": "user",
      "name": "My Personal Documents KB" // 可选的显示名称
    },
    {
      "id": "sharedKbGeneralKnowledge",
      "type": "shared",
      "name": "General Knowledge Base" // 可选的显示名称
    }
  ]
  // ...其他项目元数据
}
```

- `id`: 知识库的 `KbId`。
- `type`: `"user"` 或 `"shared"`，指明知识库的层级。
- `name`: 可选字段，用于在 UI 中显示一个友好的名称，实际解析时以 `id` 和 `type` 为准。

### 5.3. 知识库文件的访问

应用在处理项目时，会读取 `project.json` 中的 `knowledgeBaseReferences`，然后 FAM 系统可以根据这些引用信息，结合当前用户上下文，解析并提供对相应知识库文件的访问。

## 6. FileManagerService API 设计 (草案)

`FileManagerService` (或简写为 `famService`) 将是后端的核心服务，提供对文件系统的统一访问接口。

```typescript
interface ListItem {
  name: string;
  path: string; // 逻辑路径
  type: "file" | "directory";
  size?: number;
  lastModified?: Date;
}

interface WriteOptions {
  encoding?: string;
  overwrite?: boolean; // 默认 true，如果 false且文件已存在则抛错
}

interface FAMService {
  /**
   * 解析逻辑路径到物理路径。
   * 需要当前用户上下文 (userId) 来解析 user:// 路径。
   */
  resolvePath(userId: string | null, logicalPath: string): Promise<string>;

  /** 检查文件或目录是否存在 */
  exists(userId: string | null, logicalPath: string): Promise<boolean>;

  /** 读取文件内容 */
  readFile(
    userId: string | null,
    logicalPath: string,
    encoding?: "utf-8" | "binary"
  ): Promise<string | Buffer>;

  /** 写入文件内容 */
  writeFile(
    userId: string | null,
    logicalPath: string,
    data: string | Buffer,
    options?: WriteOptions
  ): Promise<void>;

  /** 列出目录内容 */
  listDir(userId: string | null, logicalPath: string): Promise<ListItem[]>;

  /** 创建目录 (递归创建) */
  createDir(userId: string | null, logicalPath: string): Promise<void>;

  /** 删除文件或目录 */
  delete(
    userId: string | null,
    logicalPath: string,
    options?: { recursive?: boolean }
  ): Promise<void>;

  /** 移动或重命名文件/目录 */
  move(
    userId: string | null,
    sourceLogicalPath: string,
    destinationLogicalPath: string
  ): Promise<void>;

  /** 复制文件/目录 (可选) */
  // copy(userId: string | null, sourceLogicalPath: string, destinationLogicalPath: string): Promise<void>;

  /** 获取文件元数据 (可选) */
  // getMetadata(userId: string | null, logicalPath: string): Promise<FileMetadata>;
}
```

**关键点**:

- API 操作均接受 `userId` (对于非用户特定路径如 `shared://` 或 `system://`，`userId` 可能为 `null` 或被忽略)。服务内部根据逻辑路径的 scheme (`user://`, `shared://`, `system://`) 和 `userId` 来确定正确的物理根路径。
- 错误处理：API 应定义清晰的错误类型（如 `FileNotFoundError`, `PermissionDeniedError`, `InvalidPathError`）。

## 7. 与现有系统的集成与迁移

- **`projectService.ts`**:
  - 大部分直接的文件系统操作 (如 `fs.readFile`, `fs.writeFile`, `fs.mkdir`, `path.join` 来构建完整路径) 将被替换为对 `FAMService` 的调用。
  - 路径构建逻辑（如 `getUserSpecificProjectPath`, `getProjectWorkflowsDir`）将被 `FAMService.resolvePath` 替代。
  - 错误类型（如 `ProjectNotFoundError`, `WorkflowNotFoundError`）可以继续使用，或者由 `FAMService` 抛出更通用的文件操作错误。
- **`fileUtils.ts`**:
  - `ensureDirExists` 可能会被 `FAMService.createDir` 内部逻辑取代或复用。
  - 获取各种根目录的函数（如 `getGlobalUserDataRoot`, `getLibraryBaseDir`）将成为 `FAMService` 内部配置或实现的一部分，不再直接暴露给其他服务。

迁移过程应逐步进行，可以先实现 `FAMService` 的核心功能，然后在 `projectService.ts` 中逐步替换调用。

## 8. 安全性考虑 (初步)

- **路径遍历防护**: `FAMService` 在解析逻辑路径到物理路径时，必须严格校验路径，防止路径遍历攻击 (e.g., `user://projects/../../../etc/passwd`)。所有路径组件都应被清理和验证。
- **权限控制**: 虽然本期设计未详细展开，但逻辑路径方案为未来基于路径前缀或元数据实现更细致的读写权限控制提供了基础。`userId` 是权限判断的关键上下文。
- **符号链接**: 默认应禁止或严格限制对符号链接的解析和操作，以避免安全风险。

## 9. 未来展望

- **版本控制**: 对项目文件、工作流甚至知识库内容实现版本管理。
- **文件锁定**: 防止并发修改冲突。
- **配额管理**: 对用户存储空间进行限制。
- **更丰富的元数据**: 为文件和目录提供更丰富的元数据支持（标签、描述等）。
- **异步操作与事件通知**: 文件变更时发出事件，供其他系统订阅。

---

此草案文档概述了统一文件与资产管理系统的核心设计。欢迎提出修改意见和建议。

## 10. 实施计划 (草案)

### 10.1. 阶段一：FileManagerService (FAMService) 核心实现

- **任务 1.1**: 创建 `apps/backend/src/services/FileManagerService.ts`。
  - 定义 `FAMService` 接口（基于文档第 6 节的 API 设计）。
  - 实现构造函数，初始化必要的配置（如根路径获取逻辑，可参考 `fileUtils.ts`）。
- **任务 1.2**: 实现核心路径解析逻辑。
  - `resolvePath(userId: string | null, logicalPath: string): Promise<string>`
  - 支持 `user://`, `shared://`, `system://` 协议。
  - 包含严格的路径清理和安全校验，防止路径遍历。
- **任务 1.3**: 实现基本的文件/目录操作的私有辅助函数。
  - 例如：`_ensurePhysicalDirExists(physicalPath: string)`。
  - 例如：`_validateLogicalPath(logicalPath: string, expectedType?: 'file' | 'directory')`。
- **任务 1.4**: 实现 FAMService 的核心 API：
  - `exists(...)`
  - `readFile(...)`
  - `writeFile(...)` (注意处理 `overwrite` 选项)
  - `createDir(...)`
  - `listDir(...)`
  - `delete(...)` (注意处理 `recursive` 选项)
  - `move(...)`
- **任务 1.5**: 编写 FAMService 的单元测试。
  - 覆盖各种逻辑路径的解析。
  - 测试文件和目录的 CRUD 操作。
  - 测试边界条件和错误处理。

### 10.2. 阶段二：重构 `projectService.ts`

- **任务 2.1**: 在 `projectService.ts` 中引入 `FAMService` 作为依赖。
- **任务 2.2**: 逐步替换 `projectService.ts` 中的直接 `fs` 调用和手动路径拼接。
  - **优先替换读取操作**: 例如 `getProjectMetadata`, `getWorkflow`, `listProjects`, `listWorkflows` 中的文件读取和路径判断。
    - 示例：`fs.readFile(metadataPath)` -> `famService.readFile(userId, 'user://projects/{projectId}/project.json')`
  - **然后替换写入和修改操作**: 例如 `createProject`, `updateProjectMetadata`, `createWorkflow`, `updateWorkflow`, `deleteWorkflowToRecycleBin`。
    - 示例：`fs.writeFile(metadataPath, ...)` -> `famService.writeFile(userId, 'user://projects/{projectId}/project.json', ...)`
    - 示例：`fs.mkdir(projectWorkflowsDir, ...)` -> `famService.createDir(userId, 'user://projects/{projectId}/workflows/')`
- **任务 2.3**: 调整 `projectService.ts` 中的错误处理，使其与 FAMService 可能抛出的错误（如 `FileNotFoundError`）协同工作。
- **任务 2.4**: 更新 `projectService.ts` 的相关单元测试，或为其编写新的集成测试（与 FAMService 交互）。

### 10.3. 阶段三：知识库与项目内资产支持

- **任务 3.1**: 在 FAMService 中确保对以下逻辑路径的完整支持：
  - `user://library/knowledgebases/{userKbId}/{...filePath}`
  - `shared://library/knowledgebases/{sharedKbId}/{...filePath}`
  - `user://projects/{projectId}/outputs/{...filePath}`
  - `user://projects/{projectId}/assets/{...filePath}`
- **任务 3.2**: 更新 `projectService.ts` (或未来可能的 `KnowledgeBaseService`) 以使用 FAMService 管理知识库的物理文件和目录。
- **任务 3.3**: 实现 `project.json` 中 `knowledgeBaseReferences` 字段的读写逻辑。
  - `getProjectMetadata` 时需能返回此字段。
  - `updateProjectMetadata` 时需能更新此字段。

### 10.4. 阶段四：清理与文档更新

- **任务 4.1**: 审视并重构/清理 `apps/backend/src/utils/fileUtils.ts`。
  - 移除已被 FAMService 功能覆盖的函数。
  - 保留必要的、通用的文件工具。
- **任务 4.2**: 更新所有相关的开发者文档、API 文档（如果 FAMService 的某些部分会暴露给前端或其他服务）。
- **任务 4.3**: 进行全面的集成测试和回归测试。

### 10.5. 考虑因素

- **事务性/原子性**: 对于涉及多个文件操作的逻辑（例如重命名工作流并更新引用），需要考虑操作的原子性。初期 FAMService 的 API 可能不直接提供事务，依赖调用方服务层面保证。
- **性能**: 对于频繁的文件操作，需关注性能影响。
- **错误日志**: FAMService 内部应有良好的错误记录机制。

---
