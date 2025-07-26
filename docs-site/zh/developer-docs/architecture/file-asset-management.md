# 文件与资产管理指南

## 1. 概述

ComfyTavern 的文件与资产管理 (File & Asset Management, FAM) 系统提供了一个统一的框架，用于处理项目中的所有文件和用户资产，如项目、工作流、知识库和输出文件。该系统旨在通过标准化的方法确保数据的一致性、安全性和可访问性。

### 核心优势

- **清晰的组织结构**: 为所有用户数据和应用资源提供了一致的文件结构。
- **逻辑路径抽象**: 通过 URI 风格的逻辑路径（如 `user://...`）简化文件访问，屏蔽了底层物理存储的复杂性。
- **严格的用户隔离**: 每个用户的数据都安全地存储在其独立的用户空间内，确保了隐私和数据安全。
- **可扩展性**: 为未来新资产类型或管理功能的集成（如权限控制、版本管理）提供了坚实的基础。

## 2. 核心概念

- **UserId**: 用户的唯一标识符。
- **ProjectId**: 用户项目的唯一标识符。
- **KnowledgeBaseId (KbId)**: 知识库的唯一标识符。
- **逻辑路径 (Logical Path)**: 一种 URI 风格的字符串，用于在应用层面唯一标识一个文件或目录资源，例如 `user://projects/myProject/workflows/main.json`。
- **物理路径 (Physical Path)**: 文件系统上实际的文件或目录路径。FAM 系统的核心职责是将逻辑路径解析为安全的物理路径。

## 3. 逻辑路径方案

FAM 系统采用以下逻辑路径方案来组织文件和资产：

### 3.1. 用户空间 (`user://`)

存储所有特定于单个用户的数据和资产。

- **用户项目**: `user://projects/{projectId}/`
  - 工作流: `user://projects/{projectId}/workflows/{workflowId}.json`
  - 项目输出: `user://projects/{projectId}/outputs/{...filePath}`
  - 项目资产: `user://projects/{projectId}/assets/{...filePath}` (例如 CSV, TXT, 小型媒体文件)
  - 面板数据: `user://projects/{projectId}/panel_data/{panelId}/{...filePath}` (面板运行时读写的数据)
  - 项目元数据: `user://projects/{projectId}/project.json` (包含项目信息及知识库引用)
- **用户个人库**: `user://library/`
  - 个人模板/脚本等: `user://library/templates/{templateName}.json` (示例)
  - 用户个人知识库: `user://library/knowledgebases/{userKbId}/{...filePath}`

### 3.2. 共享空间 (`shared://`)

存储应用级别的、所有用户均可访问（通常为只读）的共享资源。

- **应用共享库**: `shared://library/`
  - 全局模板/示例: `shared://library/workflows/{templateId}.json` (示例)
  - 全局知识库: `shared://library/knowledgebases/{sharedKbId}/{...filePath}`

### 3.3. 系统空间 (`system://`)

存储应用自身的、非用户直接创建和管理的文件。

- **公共静态资源**: `system://public/{...filePath}`
- **应用数据**: `system://data/{...filePath}` (例如数据库文件)
- **日志文件**: `system://logs/{...filePath}`

## 4. 物理存储结构

逻辑路径到物理文件系统的映射结构如下：

```
ComfyTavern/  (项目根目录)
├── data/  (映射到 system://data/)
├── logs/  (映射到 system://logs/)
├── public/  (映射到 system://public/)
├── library/  (映射到 shared://library/)
│   ├── workflows/
│   └── knowledgebases/
│       └── {sharedKbId1}/
├── plugins/  (插件目录, 由 PluginLoader 管理)
│   └── {pluginName1}/
│       ├── plugin.yaml
│       ├── nodes/
│       └── web/
└── userData/  (用户数据根目录)
    └── {userId1}/
        ├── projects/  (映射到 user://projects/ 前缀)
        │   └── {projectId1_1}/
        │       ├── project.json
        │       ├── workflows/
        │       ├── outputs/
        │       ├── assets/
        │       └── panel_data/
        └── library/  (映射到 user://library/ 前缀)
            └── knowledgebases/
                └── {userKbId1_1}/
```

## 5. 知识库管理

### 5.1. 知识库的引用

项目通过在其 `project.json` 文件中声明所引用的知识库来使用它们。

**`project.json` 示例片段:**

```json
{
  "id": "myProject123",
  "name": "My Awesome Project",
  "knowledgeBaseReferences": [
    {
      "id": "userKbPersonalDocs",
      "type": "user",
      "name": "My Personal Documents KB"
    },
    {
      "id": "sharedKbGeneralKnowledge",
      "type": "shared",
      "name": "General Knowledge Base"
    }
  ]
}
```

- `id`: 知识库的 `KbId`。
- `type`: `"user"` 或 `"shared"`，指明知识库的层级。
- `name`: 可选字段，用于在 UI 中显示一个友好的名称。

### 5.2. 知识库文件的访问

应用在处理项目时，会读取 `project.json` 中的 `knowledgeBaseReferences`，然后 FAM 系统可以根据这些引用信息，结合当前用户上下文，解析并提供对相应知识库文件的访问。

## 6. FileManagerService API

`FileManagerService` (或 `famService`) 是后端的统一文件访问接口，位于 `apps/backend/src/services/FileManagerService.ts`。

### 核心 API 概览

```typescript
interface ListItem {
  name: string;
  path: string; // 逻辑路径
  type: "file" | "directory";
  size?: number;
  lastModified?: Date;
}

interface FAMService {
  /** 解析逻辑路径到物理路径 */
  resolvePath(userId: string | null, logicalPath: string): Promise<string>;

  /** 检查文件或目录是否存在 */
  exists(userId: string | null, logicalPath: string): Promise<boolean>;

  /** 读取文件内容 */
  readFile(userId: string | null, logicalPath: string, encoding?: "utf-8" | "binary"): Promise<string | Buffer>;

  /** 写入文件内容 */
  writeFile(userId: string | null, logicalPath: string, data: string | Buffer, options?: { overwrite?: boolean }): Promise<void>;

  /** 列出目录内容 */
  listDir(userId: string | null, logicalPath: string): Promise<ListItem[]>;

  /** 创建目录 (递归创建) */
  createDir(userId: string | null, logicalPath: string): Promise<void>;

  /** 删除文件或目录 */
  delete(userId: string | null, logicalPath: string, options?: { recursive?: boolean }): Promise<void>;

  /** 移动或重命名文件/目录 */
  move(userId: string | null, sourceLogicalPath: string, destinationLogicalPath: string): Promise<void>;
}
```

**关键点**:

- 所有 API 操作都接受 `userId` 作为上下文，用于解析 `user://` 协议的路径。对于 `shared://` 或 `system://` 路径，`userId` 可以是 `null` 或被忽略。
- 服务内部会根据逻辑路径的协议 (`user://`, `shared://`, `system://`) 和 `userId` 来确定正确的物理根路径。
- API 会抛出明确的错误，如 `FileNotFoundError`, `PermissionDeniedError`, `InvalidPathError`。

## 7. 安全性

- **路径遍历防护**: FAM 服务在解析路径时会进行严格的清理和验证，以防止路径遍历攻击。
- **权限控制**: 逻辑路径方案为未来实现更细粒度的读写权限控制提供了基础。`userId` 是权限判断的关键。
- **符号链接**: 系统默认禁止解析和操作符号链接，以避免潜在的安全风险。

## 8. 插件与扩展资产管理

与用户和系统核心资产不同，插件（Plugin）和扩展（Extension）的资产管理遵循一套独立的、由 `PluginLoader` 服务驱动的机制。

### 8.1. 物理存储结构

所有插件都位于项目根目录下的 `plugins/` 目录中。

```
ComfyTavern/
└── plugins/
    └── my-awesome-plugin/  # 一个插件的目录
        ├── plugin.yaml     # (必需) 插件清单文件
        ├── nodes/          # (可选) 后端节点
        ├── web/            # (可选) 前端资源 (JS, CSS, 图片等)
        └── tools/          # (可选) 后端工具
```

### 8.2. 资产处理方式

插件资产不通过 `FileManagerService` 及其逻辑路径（如 `user://`）进行访问，而是按以下方式处理：

- **后端资产 (`nodes/`, `tools/`)**:
  - 在应用启动时，后端的 `PluginLoader` 服务会扫描 `plugins/` 目录。
  - 它会读取每个插件的 `plugin.yaml` 文件，并根据清单中的声明，使用 `NodeLoader` 加载后端节点 (`nodes/`)。
  - 工具 (`tools/`) 则由相应的 `ToolManager` 负责加载。
  - 这些文件由后端服务直接从文件系统读取，不经过 `FileManagerService`。

- **前端资产 (`web/` 或 `dist/`)**:
  - `PluginLoader` 会为每个包含前端资源的插件设置一个静态文件服务。
  - 插件的前端文件被映射到一个公开的 URL 路径下，格式为 `/plugins/{pluginName}/`。例如，`plugins/my-awesome-plugin/web/style.css` 文件可以通过 URL `/plugins/my-awesome-plugin/style.css` 被浏览器访问。
  - 这种机制允许插件的前端脚本和样式被动态加载到主应用中，实现了前端功能的扩展。

### 8.3. 与 FAM 系统的关系

- **独立性**: 插件资产管理是独立于核心 FAM 系统的。开发者在插件内部进行文件操作时，通常使用标准的 Node.js `fs` 模块，并以插件自身的目录作为相对路径的根。
- **无逻辑路径**: 插件文件没有对应的 `plugin://` 逻辑路径方案。访问插件资源是通过后端直接加载或前端 URL 请求，而不是通过 `famService.readFile()` 等 API。