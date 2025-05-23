# 文件管理器系统设计方案

## 1. 目标与原则

设计一个统一的基础文件管理器系统，服务于 ComfyTavern 应用内部的资源管理需求，特别是为节点资源选择（如 `ResourceSelectorInput` 组件）提供支持，并允许用户管理项目文件和共享库资源。

*   **统一视图**：提供一个逻辑上的统一文件系统视图，整合项目 (`/projects/`)、共享库 (`/library/`) 以及未来可能的插件资源区。
*   **用户可操作性**：在定义的逻辑路径范围内，支持常见的目录和文件操作（浏览、上传、创建目录、删除、重命名、移动）。
*   **安全性**：
    *   默认情况下，所有操作严格限制在后端配置的物理根路径之内。
    *   通过 `advanced_file_access_enabled` 配置项，允许后端节点在执行时处理用户通过特定文本输入框提供的任意绝对路径（主要用于加载器节点等高级场景）。文件管理器UI本身不提供浏览任意绝对路径的功能。
*   **后端驱动**：物理路径的定义、映射和安全控制完全由后端负责。前端通过API与逻辑路径交互。
*   **可扩展性**：设计应能方便未来添加新的逻辑根路径类型（如插件资源）。

## 2. 核心概念

### 2.1. 逻辑路径 (Logical Path)

*   前端和API层面使用的路径表示，例如 `/projects/MyProjectID/assets/image.png` 或 `/library/character_templates/template.json`。
*   由一个已知的“逻辑根前缀”（如 `/projects/`, `/library/`）和其后的相对路径组成。

### 2.2. 逻辑根 (Logical Roots / Mount Points)

*   由后端定义和管理的顶层入口点，映射到服务器上的物理存储位置。
*   前端通过API (`/api/files/browse-roots`) 获取可用的逻辑根列表，作为文件管理器UI的起始浏览点。
*   示例：
    *   `/projects/` -> 映射到物理的 `projects_root_path`。
    *   `/library/` -> 映射到物理的 `library_root_path`。

### 2.3. 项目 (`/projects/`)

*   每个项目 (`{projectId}`) 在 `/projects/` 逻辑根下表现为一个子目录。
*   项目内部结构（如 `assets/`, `workflows/`, `outputs/`）在其项目逻辑路径下进一步组织。
*   用户对自己的项目目录通常拥有完整的读写权限。

### 2.4. 共享库 (`/library/`)

*   一个应用级别的共享资源区域，用于存放所有项目可能共享的模板、预设、角色卡等。
*   用户通常对此目录拥有读写权限，以便上传和管理共享资源。

### 2.5. 高级文件访问模式

*   通过全局配置项 `advanced_file_access_enabled` 控制。
*   当启用时，后端节点（如加载器）可以直接请求读取服务器文件系统上的绝对路径。
*   **注意**：此模式不意味着文件管理器UI会提供浏览任意绝对路径的功能。当节点需要绝对路径时，其前端配置应使用标准的文本输入框，高级用户在此手动输入绝对路径。文件管理器UI（如 `ResourceSelectorInput` 组件）的浏览范围严格限于已定义的逻辑根（如 `/projects/`, `/library/`）。

## 3. 后端配置项

定义在 `apps/backend/src/config.ts` (允许 `config.json` 覆盖):

*   **`projects_root_path: string`**
    *   描述：存储所有 ComfyTavern 项目的物理根目录路径。
    *   默认值：`./workspace/projects/` (相对于应用主程序运行的根目录)。
*   **`library_root_path: string`**
    *   描述：存储共享库资源的物理根目录路径。
    *   默认值：`./workspace/library/` (相对于应用主程序运行的根目录)。
*   **`advanced_file_access_enabled: boolean`**
    *   描述：是否允许后端服务（通常是节点）直接访问文件系统绝对路径。
    *   默认值：`false`。

## 4. `FileManagerService` 详细设计

核心后端服务，处理所有基于逻辑路径的文件和目录操作。

### 4.1. 内部路径解析

服务内部需要一个核心的路径解析和安全检查机制：

1.  接收逻辑路径 (如 `/library/some/file.txt` 或 `/projects/proj1/assets/img.png`)。
2.  提取逻辑根前缀 ( `/library/`, `/projects/`)。
3.  根据前缀，查找配置中对应的物理根路径 (`library_root_path`, `projects_root_path`)。
4.  安全地将逻辑路径的剩余部分与物理根路径拼接，形成最终的物理路径。
    *   在此过程中，必须进行路径规范化（处理 `.` `..`，统一分隔符）和严格的边界检查，确保最终物理路径不会越出其声明的物理根目录范围（例如，`/projects/proj1/../../some_other_place` 是非法的）。
5.  对于 `/projects/{projectId}/...` 路径，还需要从路径中提取 `projectId`。

### 4.2. 服务接口定义

```typescript
interface FileSystemEntry {
  name: string; // 文件或目录名
  logicalPath: string; // 完整的逻辑路径，可直接用于后续API调用
  physicalPath?: string; // (仅供后端调试或特定内部使用，不暴露给API)
  type: 'file' | 'directory';
  size?: number; // 文件大小 (字节)
  lastModified?: Date;
  // 未来可添加：mimeType, permissions, etc.
}

interface UploadResult {
  success: boolean;
  logicalPath?: string; // 上传成功后文件的逻辑路径
  message?: string;
}

interface FileManagerService {
  /**
   * 获取已配置的可浏览逻辑根路径列表。
   */
  getBrowseRoots(): Promise<Array<{ name: string, logicalPath: string }>>;

  /**
   * 列出指定逻辑路径下的文件和目录。
   */
  listDirectory(logicalPath: string, options?: { recursive?: boolean }): Promise<FileSystemEntry[]>;

  /**
   * 获取指定逻辑路径的文件或目录的元数据。
   */
  getMetadata(logicalPath: string): Promise<FileSystemEntry | null>;

  /**
   * 在指定的逻辑路径下创建新目录。
   * logicalPath 应指向期望创建的新目录本身。
   * e.g., createDirectory("/projects/myProj/new_folder")
   */
  createDirectory(logicalPath: string): Promise<FileSystemEntry | null>;

  /**
   * 上传文件到指定的逻辑目录路径。
   */
  uploadFile(
    fileData: ReadableStream, // 文件数据流
    destinationDirectoryLogicalPath: string, // 目标目录的逻辑路径
    filename: string, // 要保存的文件名
    options?: { overwrite?: boolean }
  ): Promise<UploadResult>;

  /**
   * 删除指定逻辑路径的文件或目录。
   */
  deletePath(logicalPath: string, options?: { recursive?: boolean }): Promise<{ success: boolean, message?: string }>;

  /**
   * 重命名指定逻辑路径的文件或目录（在同一父目录下）。
   */
  renamePath(logicalPath: string, newName: string): Promise<FileSystemEntry | null>;

  /**
   * 移动文件或目录到新的父目录下。
   */
  movePath(sourceLogicalPath: string, destinationParentLogicalPath: string): Promise<FileSystemEntry | null>;

}
// 注意：处理绝对路径文件读取的逻辑将由节点后端自行实现（例如，使用 Node.js 'fs' 模块），
// 并受全局 'advanced_file_access_enabled' 配置项的约束。
// FileManagerService 本身不直接提供操作绝对路径的接口。
```

### 4.3. 核心方法逻辑要点

*   所有接收 `logicalPath` 的方法，第一步都是调用内部路径解析和安全检查逻辑。
*   **`listDirectory`**: 解析路径，读取物理目录内容，转换为 `FileSystemEntry` 列表。
*   **`uploadFile`**: 解析 `destinationDirectoryLogicalPath`，确保目标物理目录可写，处理文件名冲突（基于 `overwrite`），保存文件流。
*   **`createDirectory`**: 解析 `logicalPath`，创建物理目录。
*   **`deletePath`**: 解析 `logicalPath`，执行物理删除（文件或递归删除目录）。
*   **`renamePath`**: 解析 `logicalPath`，在同一物理父目录下执行重命名。
*   **`movePath`**: 解析源和目标父逻辑路径，执行物理移动，注意跨物理根移动（如从 `/library/` 移到 `/projects/`) 通常应禁止或特殊处理。

## 5. 后端 API 端点设计

所有路径参数均指逻辑路径。

*   **`GET /api/files/browse-roots`**
    *   响应: `Array<{ name: string, logicalPath: string }>`
    *   调用: `FileManagerService.getBrowseRoots()`

*   **`GET /api/files/list?path={logicalPath}&recursive={boolean}`**
    *   响应: `FileSystemEntry[]`
    *   调用: `FileManagerService.listDirectory(path, {recursive})`

*   **`GET /api/files/meta?path={logicalPath}`**
    *   响应: `FileSystemEntry | { error: string }`
    *   调用: `FileManagerService.getMetadata(path)`

*   **`POST /api/files/directory?path={logicalPath}`** (创建目录)
    *   响应: `FileSystemEntry | { error: string }`
    *   调用: `FileManagerService.createDirectory(path)`

*   **`POST /api/files/upload?path={destinationDirLogicalPath}&filename={fname}&overwrite={boolean}`** (上传文件)
    *   请求体: 文件数据 (multipart/form-data)
    *   响应: `UploadResult`
    *   调用: `FileManagerService.uploadFile(stream, path, filename, {overwrite})`

*   **`DELETE /api/files?path={logicalPath}&recursive={boolean}`**
    *   响应: `{ success: boolean, message?: string }`
    *   调用: `FileManagerService.deletePath(path, {recursive})`

*   **`PUT /api/files/rename?path={logicalPath}&newName={string}`**
    *   响应: `FileSystemEntry | { error: string }`
    *   调用: `FileManagerService.renamePath(path, newName)`

*   **`PUT /api/files/move?sourcePath={logicalPath}&destinationDir={logicalPath}`**
    *   响应: `FileSystemEntry | { error: string }`
    *   调用: `FileManagerService.movePath(sourcePath, destinationDir)`

## 6. 前端交互 (`ResourceSelectorInput` 及文件管理器UI)

*   启动时，或在文件管理器UI加载时，调用 `/api/files/browse-roots` 获取顶层入口点。
*   用户在UI中导航时，前端根据当前浏览的逻辑路径调用 `/api/files/list` 获取内容。
*   文件上传操作：
    *   用户点击上传按钮，触发 `<input type="file">`。
    *   选择文件后，前端获取当前文件管理器UI显示的目录的 `logicalPath`。
    *   将文件数据和目标目录逻辑路径 POST 到 `/api/files/upload`。
*   其他操作（创建目录、删除、重命名、移动）类似地调用相应API。
*   节点定义通过将其输入配置为使用现有的 `'RESOURCE_SELECTOR'` `InputType` (见 `apps/frontend-vueflow/src/components/graph/inputs/index.ts`) 来指定使用 `ResourceSelectorInput.vue` 组件。
*   `ResourceSelectorInput.vue` 组件调用 `/api/files/list` 等接口，提供对逻辑路径（如 `/projects/`, `/library/`）的浏览和选择功能。选择后，它返回一个代表所选资源的逻辑路径字符串。
*   对于需要接收绝对路径的节点输入，节点定义应使其渲染为标准的 `'STRING'` `InputType` (即 `StringInput.vue`)，用户在此手动输入绝对路径字符串。

## 7. 与 `FileOutputService` 的关系

*   `FileOutputService` 专注于工作流**执行时输出文件**的保存，特别是到项目 `outputs/` 目录或高级模式下的绝对路径。其 `saveFile` 方法是核心。
*   `FileManagerService` 提供更通用的文件/目录浏览和管理操作，其范围包括项目所有子目录（含 `outputs/`）、共享库等。
*   当 `FileManagerService` 需要列出或操作项目 `outputs/` 目录时，它可以：
    *   直接使用其通用的路径解析和文件系统操作逻辑。
    *   或者，如果 `FileOutputService` 内部有针对 `outputs/` 的特殊优化或元数据处理，`FileManagerService` 可以在操作 `/projects/{id}/outputs/` 路径时，内部委托给 `FileOutputService` 的部分功能。但更倾向于 `FileManagerService` 拥有完整的通用能力。
*   `/view/{projectId}/{...projectOutputPath}` API 仍由 `FileOutputService` (或其底层逻辑) 提供，用于直接访问输出文件。`FileManagerService` 返回的 `FileSystemEntry` 中，对于 `outputs/` 内的文件，其 `logicalPath` 可以被前端用于构建这样的 `/view` URL。

## 8. 安全性

*   **核心**：后端对所有传入的 `logicalPath` 进行严格解析，确保映射到的物理路径在其声明的根目录（`projects_root_path`, `library_root_path`）之内，防止路径遍历。
*   对 `library/` 等共享区域的写入操作（如上传、创建目录）应被允许，但仍受限于其根目录边界。
*   删除、重命名、移动操作需要谨慎处理，确保用户有权限，并考虑操作的原子性或回滚（较复杂，初期可能不实现事务性）。
*   绝对路径访问（非文件管理器UI触发，而是由节点配置中的文本输入驱动）：节点后端逻辑在尝试访问这些绝对路径时，必须检查全局的 `advanced_file_access_enabled` 配置。`FileManagerService` 不直接参与绝对路径的访问。

## 9. 未来扩展

*   支持插件注册其资源目录作为新的逻辑根。
*   更细致的权限控制（例如，某些逻辑根或子目录只读）。
*   文件搜索功能。
*   版本控制或回收站。