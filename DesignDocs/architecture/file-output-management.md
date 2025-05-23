# 文件输出管理系统设计方案

## 1. 目标与原则

本方案旨在设计一个灵活且安全的文件输出管理系统，用于 ComfyTavern 工作流执行过程中产生的文件。系统需满足以下目标和原则：

*   **项目隔离**：默认情况下，工作流输出应与所属项目关联，存储在项目专属的沙盒目录中。
*   **灵活性**：为高级用户提供输出到任意指定绝对路径的能力，以满足批处理和外部应用对接的需求。
*   **安全性**：严格控制文件写入权限，防止路径遍历等安全风险，并在启用高级功能时给予用户明确警告。
*   **可访问性**：提供 API 以便前端能够浏览和预览沙盒内的输出文件。
*   **可配置性**：关键路径和行为应可通过配置文件进行调整。

## 2. 核心概念

### 2.1. 项目专属沙盒输出

*   每个项目在其自身的目录结构内拥有一个标准的 `outputs/` 子目录。
*   此目录是该项目工作流在“沙盒模式”（默认模式）下输出文件的默认根路径。
*   路径结构：`{projects_root_path}/{projectId}/outputs/`。

### 2.2. 高级文件访问模式

*   通过全局配置项 `advanced_file_access_enabled` (默认为 `false`) 控制。
*   当启用时 (值为 `true`)，并伴有明确的用户风险认知，系统允许节点将文件输出到用户指定的任意绝对文件系统路径。
*   可能在输出时伴随警告信息log，以提醒用户注意安全风险。

### 2.3. 绝对路径输出

*   仅在“高级文件访问模式”启用时生效。
*   节点可以指定一个完整的文件系统绝对路径作为输出目标。
*   系统将尝试写入此路径，成功与否取决于操作系统级别的文件权限。
*   通过此方式输出的文件通常不由应用的 `/view` API 提供预览服务。

### 2.4. 项目根路径

*   所有项目文件（包括其沙盒输出）都存储在一个可配置的“项目根路径” (`projects_root_path`) 之下。

## 3. 配置项

以下配置项应在后端配置文件中定义 (例如 `apps/backend/src/config.ts`)，并允许通过用户 `config.json` 文件覆盖。

*   **`projects_root_path: string`**
    *   描述：存储所有 ComfyTavern 项目的根目录路径。
    *   默认值：`./workspace/projects/` (相对于应用主程序运行的根目录)。
    *   示例：如果应用在 `/opt/comfytavern/` 下运行，则项目默认存储在 `/opt/comfytavern/workspace/projects/`。
*   **`advanced_file_access_enabled: boolean`**
    *   描述：是否启用高级文件访问模式，允许输出到沙盒外的绝对路径。
    *   默认值：`false`。
    *   **安全警告**：启用此选项会带来潜在安全风险，用户需明确了解并承担。应用启动时若此项为 `true`，应在日志中打印强烈警告。

## 4. `FileOutputService` 详细设计

`FileOutputService` 是后端负责处理所有文件输出操作的核心服务。

### 4.1. 服务接口定义

```typescript
interface FileSaveResult {
  // 最终成功写入文件的绝对路径
  absolutePath: string; 

  // 如果是沙盒输出，则为所属的项目ID；否则为 null
  projectId: string | null; 

  // 如果文件成功保存在项目沙盒内，此值为相对于该项目 outputs/ 目录的路径，
  // 可用于构建 /view API 的 URL。
  // 如果是绝对路径输出或保存失败，则为 null。
  viewableSandboxRelativePath: string | null; 
}

interface SandboxFileEntry {
  name: string; // 文件或目录名
  type: 'file' | 'directory'; // 条目类型
  size?: number; // 文件大小 (字节)，目录则无此项
  lastModified?: Date; // 最后修改时间
  // 相对于项目 outputs/ 目录的路径。
  // 用于构建 /view URL (如果是文件) 或进一步列出子目录内容的请求路径 (如果是目录)。
  sandboxRelativePath: string; 
}

interface FileOutputService {
  /**
   * 保存文件数据到指定路径。
   * 根据配置和选项决定是保存到项目沙盒还是外部绝对路径。
   */
  saveFile(
    data: Buffer | ReadableStream, 
    requestedPath: string, // 节点提供的原始路径意图 (可以是相对沙盒的，也可以是绝对的)
    options: {
      projectId?: string; // 当前执行的项目ID。沙盒输出时必需。
      isAbsoluteIntent?: boolean; // 节点是否明确希望将 requestedPath 视为绝对路径。
                                 // 如果为 false 或未提供，且 requestedPath 看起来不像绝对路径，则视为沙盒相对路径。
      overwrite?: boolean; // 是否覆盖同名文件，默认为 false。
      ensureUniqueName?: boolean; // 如果文件名冲突且 overwrite 为 false，是否自动生成唯一名称 (如 file_1.txt)，默认为 true。
    }
  ): Promise<FileSaveResult>;

  /**
   * 读取项目沙盒中的文件，主要供 /view API 使用。
   */
  readFileFromProjectSandbox(
    projectId: string, 
    sandboxRelativePath: string // 相对于项目 outputs/ 目录的文件路径
  ): Promise<{ stream: ReadableStream, mimeType: string, filename: string }>;
  
  /**
   * 列出指定项目沙盒输出目录（或其子目录）的内容。
   */
  listProjectSandboxContents(
    projectId: string, 
    subPath?: string // 要列出的子目录路径 (可选，相对于项目 outputs/ 目录)。默认为 outputs/ 根。
  ): Promise<SandboxFileEntry[]>;
}
```

### 4.2. `saveFile` 方法核心逻辑

1.  **确定目标路径类型和最终绝对路径**：
    *   获取全局配置 `advanced_file_access_enabled` 和 `projects_root_path`。
    *   检查 `options.isAbsoluteIntent` 以及 `requestedPath` 是否为绝对路径格式 (如以 `/`, `C:\` 开头)。
    *   **如果** (`advanced_file_access_enabled === true` 且 ( `options.isAbsoluteIntent === true` 或 `requestedPath` 是绝对路径格式)):
        *   `targetAbsolutePath = normalize(requestedPath)` (进行路径规范化，如解析 `.` `..`，统一分隔符)。
        *   `result.projectId = null`。
        *   `result.viewableSandboxRelativePath = null`。
        *   **日志**：记录一条警告信息，表明正在尝试向应用沙盒外部写入文件。
    *   **否则** (视为沙盒输出):
        *   **校验**：`options.projectId` 必须提供，否则抛出错误。
        *   `sandboxBasePath = normalize(join(projects_root_path, options.projectId, "outputs"))`。
        *   `targetAbsolutePath = normalize(join(sandboxBasePath, requestedPath))`。
        *   **安全检查**：严格确保 `targetAbsolutePath` 始终在 `sandboxBasePath` 之下，防止路径遍历攻击。若检查失败，则抛出错误。
        *   `result.projectId = options.projectId`。
        *   `result.viewableSandboxRelativePath = normalize(requestedPath)` (相对于项目 outputs 的路径)。

2.  **处理文件名和路径**：
    *   从 `targetAbsolutePath` 中分离出目录路径和基本文件名。
    *   确保目标目录存在，如果不存在则尝试创建 (对于沙盒路径，应有权限；对于绝对路径，取决于系统权限)。

3.  **处理文件名冲突** (基于 `options.overwrite` 和 `options.ensureUniqueName`)：
    *   如果目标文件已存在：
        *   若 `options.overwrite === true`，则允许覆盖。
        *   若 `options.overwrite === false` (或未定义)：
            *   若 `options.ensureUniqueName === true` (或未定义)，则在原基本文件名后添加数字后缀 (如 `_1`, `_2`) 直到找到一个不冲突的名称，并更新 `targetAbsolutePath`。
            *   若 `options.ensureUniqueName === false`，则抛出文件已存在错误。

4.  **写入文件**：将 `data` (Buffer 或 Stream) 写入最终确定的 `targetAbsolutePath`。

5.  **返回结果**：`Promise<FileSaveResult>` 包含 `absolutePath`, `projectId`, `viewableSandboxRelativePath`。

### 4.3. `readFileFromProjectSandbox` 方法核心逻辑

1.  获取全局配置 `projects_root_path`。
2.  校验 `projectId` 和 `sandboxRelativePath` 的有效性。
3.  构造目标文件的绝对路径：`targetAbsolutePath = normalize(join(projects_root_path, projectId, "outputs", sandboxRelativePath))`。
4.  **安全检查**：严格确保 `targetAbsolutePath` 在 `{projects_root_path}/{projectId}/outputs/` 之内。
5.  检查文件是否存在，若不存在则抛出错误。
6.  创建可读流，推断 MIME 类型 (可基于文件扩展名)，提取文件名。
7.  返回 `{ stream, mimeType, filename }`。

### 4.4. `listProjectSandboxContents` 方法核心逻辑

1.  获取全局配置 `projects_root_path`。
2.  校验 `projectId`。
3.  构造目标目录的绝对路径：`targetDirAbsolutePath = normalize(join(projects_root_path, projectId, "outputs", subPath || ""))`。
4.  **安全检查**：严格确保 `targetDirAbsolutePath` 在 `{projects_root_path}/{projectId}/outputs/` 之内或就是它本身。
5.  读取目录内容，遍历每个条目：
    *   获取名称、类型 (文件/目录)。
    *   对于文件，获取大小、最后修改时间。
    *   计算 `sandboxRelativePath` (相对于项目 `outputs/` 目录的路径)。
6.  返回 `SandboxFileEntry[]`。

## 5. API 端点设计

### 5.1. `GET /view/{projectId}/{...projectRelativePath}`

*   **用途**：预览或下载项目沙盒内指定的文件。
*   **参数**：
    *   `projectId`: 项目的唯一标识符。
    *   `projectRelativePath`: 文件相对于该项目 `outputs/` 目录的路径 (URL编码)。
*   **处理流程**：
    1.  调用 `FileOutputService.readFileFromProjectSandbox(projectId, projectRelativePath)`。
    2.  根据返回结果设置正确的 HTTP 响应头 (如 `Content-Type`, `Content-Disposition` 用于下载)。
    3.  将文件流发送给客户端。

### 5.2. `GET /api/projects/{projectId}/outputs`

*   **用途**：列出指定项目沙盒输出目录的内容。
*   **参数**：
    *   `projectId`: 项目的唯一标识符。
*   **查询参数 (可选)**：
    *   `path`: String. 要列出的子目录路径，相对于项目的 `outputs/` 目录 (URL编码)。如果未提供，则列出 `outputs/` 根目录。
*   **处理流程**：
    1.  调用 `FileOutputService.listProjectSandboxContents(projectId, query.path)`。
    2.  将返回的 `SandboxFileEntry[]` 序列化为 JSON 响应。

## 6. 执行引擎集成

*   当工作流执行到一个产生文件输出的节点时，执行引擎需要：
    1.  从节点获取输出数据 (Buffer/Stream) 和期望的输出路径信息 (`requestedPath`, `isAbsoluteIntent` 等配置)。
    2.  获取当前执行的 `projectId`。
    3.  调用 `FileOutputService.saveFile(...)` 并传递所需参数。
    4.  将 `FileSaveResult` 中的信息（特别是 `absolutePath` 和 `viewableSandboxRelativePath`）作为节点的输出数据的一部分，传递给下游节点或通过 WebSocket 发送给前端。

## 7. 节点输出约定

*   需要输出文件的节点 (如 "Save Image", "Save Text") 应提供配置项供用户指定：
    *   `target_path: string`: 用户期望的输出路径。这可以是相对于沙盒的路径，也可以是绝对路径。
    *   `path_type: 'sandbox' | 'absolute'` (可选): 明确指示 `target_path` 的类型。如果未提供，`FileOutputService` 或执行引擎可以根据 `target_path` 的格式和全局高级模式开关来推断。
    *   其他特定于节点的选项，如 `overwrite_behavior`, `filename_pattern` 等。
*   节点文档应清楚说明这些配置项的含义及其在不同模式下的行为。

## 8. 前端交互

*   **输出展示**：
    *   当节点输出包含文件信息时，前端根据 `viewableSandboxRelativePath` 是否为 `null` 来决定如何展示：
        *   若不为 `null` (沙盒文件)：可以显示一个可点击的链接或直接嵌入预览 (如图片)，链接指向 `/view/{projectId}/{viewableSandboxRelativePath}`。
        *   若为 `null` (外部绝对路径文件)：仅显示文件的绝对路径文本。
*   **输出浏览器 (建议功能)**：
    *   前端可以实现一个界面，允许用户浏览项目的沙盒输出。
    *   通过调用 `GET /api/projects/{projectId}/outputs` (及带 `path` 参数的后续调用) 来获取目录和文件列表。
    *   提供文件预览、下载等功能。

## 9. 安全考量

*   **路径遍历防护**：在所有处理沙盒相对路径的地方 (拼接、读取、列出)，必须进行严格的路径规范化和边界检查，确保操作始终限制在预期的沙盒目录内。
*   **高级模式风险提示**：当 `advanced_file_access_enabled` 为 `true` 时，应用启动时必须在控制台/日志中打印清晰、强烈的安全风险警告。任何尝试写入沙盒外部的操作也应有相应的日志记录。
*   **输入验证**：所有来自用户或节点配置的路径字符串，在用于文件系统操作前，都应进行基本的验证和清理。
*   **权限**：应用运行的用户需要对 `projects_root_path` 及其子目录有读写权限。对于绝对路径输出，则依赖于运行用户对目标路径的权限。

## 10. 未来展望

*   **存储后端抽象**：未来可以将 `FileOutputService` 的实现抽象化，以支持不同的存储后端 (如云存储 S3, MinIO 等)，而不仅仅是本地文件系统。
*   **细粒度权限控制**：对于多用户场景，可能需要更细致的权限管理，控制哪些用户/项目可以访问或写入特定路径。