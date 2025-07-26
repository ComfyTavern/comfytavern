# File and Asset Management Guide

## 1. Overview

ComfyTavern's File & Asset Management (FAM) system provides a unified framework for handling all files and user assets within a project, such as projects, workflows, knowledge bases, and output files. This system aims to ensure data consistency, security, and accessibility through a standardized approach.

### Core Advantages

- **Clear Organizational Structure**: Provides a consistent file structure for all user data and application resources.
- **Logical Path Abstraction**: Simplifies file access through URI-style logical paths (e.g., `user://...`), abstracting away the complexity of underlying physical storage.
- **Strict User Isolation**: Each user's data is securely stored within their independent user space, ensuring privacy and data security.
- **Extensibility**: Provides a solid foundation for the future integration of new asset types or management functions (e.g., permission control, version management).

## 2. Core Concepts

- **UserId**: Unique identifier for a user.
- **ProjectId**: Unique identifier for a user project.
- **KnowledgeBaseId (KbId)**: Unique identifier for a knowledge base.
- **Logical Path**: A URI-style string used to uniquely identify a file or directory resource at the application level, for example `user://projects/myProject/workflows/main.json`.
- **Physical Path**: The actual file or directory path on the file system. The core responsibility of the FAM system is to resolve logical paths into secure physical paths.

## 3. Logical Path Scheme

The FAM system uses the following logical path scheme to organize files and assets:

### 3.1. User Space (`user://`)

Stores all data and assets specific to a single user.

- **User Projects**: `user://projects/{projectId}/`
  - Workflows: `user://projects/{projectId}/workflows/{workflowId}.json`
  - Project Outputs: `user://projects/{projectId}/outputs/{...filePath}`
  - Project Assets: `user://projects/{projectId}/assets/{...filePath}` (e.g., CSV, TXT, small media files)
  - Panel Data: `user://projects/{projectId}/panel_data/{panelId}/{...filePath}` (data read/written by panels at runtime)
  - Project Metadata: `user://projects/{projectId}/project.json` (contains project information and knowledge base references)
- **User Personal Library**: `user://library/`
  - Personal Templates/Scripts: `user://library/templates/{templateName}.json` (example)
  - User Personal Knowledge Bases: `user://library/knowledgebases/{userKbId}/{...filePath}`

### 3.2. Shared Space (`shared://`)

Stores application-level shared resources accessible (usually read-only) by all users.

- **Application Shared Library**: `shared://library/`
  - Global Templates/Examples: `shared://library/workflows/{templateId}.json` (example)
  - Global Knowledge Bases: `shared://library/knowledgebases/{sharedKbId}/{...filePath}`

### 3.3. System Space (`system://`)

Stores application-specific files not directly created and managed by users.

- **Public Static Resources**: `system://public/{...filePath}`
- **Application Data**: `system://data/{...filePath}` (e.g., database files)
- **Log Files**: `system://logs/{...filePath}`

## 4. Physical Storage Structure

The mapping structure from logical paths to the physical file system is as follows:

```
ComfyTavern/ (Project Root Directory)
├── data/ (Maps to system://data/)
├── logs/ (Maps to system://logs/)
├── public/ (Maps to system://public/)
├── library/ (Maps to shared://library/)
│ ├── workflows/
│ └── knowledgebases/
│     └── {sharedKbId1}/
├── plugins/ (Plugin Directory, managed by PluginLoader)
│ └── {pluginName1}/
│     ├── plugin.yaml
│     ├── nodes/
│     └── web/
└── userData/ (User Data Root Directory)
    └── {userId1}/
        ├── projects/ (Maps to user://projects/ prefix)
        │ └── {projectId1_1}/
        │     ├── project.json
        │     ├── workflows/
        │     ├── outputs/
        │     ├── assets/
        │     └── panel_data/
        └── library/ (Maps to user://library/ prefix)
            └── knowledgebases/
                └── {userKbId1_1}/
```

## 5. Knowledge Base Management

### 5.1. Knowledge Base References

Projects use knowledge bases by declaring them in their `project.json` file.

**`project.json` Example Snippet:**

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

- `id`: The `KbId` of the knowledge base.
- `type`: `"user"` or `"shared"`, indicating the knowledge base's level.
- `name`: Optional field, used to display a friendly name in the UI.

### 5.2. Accessing Knowledge Base Files

When processing a project, the application reads `knowledgeBaseReferences` from `project.json`. The FAM system then uses these reference details, combined with the current user context, to resolve and provide access to the corresponding knowledge base files.

## 6. FileManagerService API

`FileManagerService` (or `famService`) is the backend's unified file access interface, located at `apps/backend/src/services/FileManagerService.ts`.

### Core API Overview

```typescript
interface ListItem {
  name: string;
  path: string; // Logical Path
  type: "file" | "directory";
  size?: number;
  lastModified?: Date;
}

interface FAMService {
  /** Resolves a logical path to a physical path */
  resolvePath(userId: string | null, logicalPath: string): Promise<string>;

  /** Checks if a file or directory exists */
  exists(userId: string | null, logicalPath: string): Promise<boolean>;

  /** Reads file content */
  readFile(userId: string | null, logicalPath: string, encoding?: "utf-8" | "binary"): Promise<string | Buffer>;

  /** Writes file content */
  writeFile(userId: string | null, logicalPath: string, data: string | Buffer, options?: { overwrite?: boolean }): Promise<void>;

  /** Lists directory content */
  listDir(userId: string | null, logicalPath: string): Promise<ListItem[]>;

  /** Creates a directory (recursively) */
  createDir(userId: string | null, logicalPath: string): Promise<void>;

  /** Deletes a file or directory */
  delete(userId: string | null, logicalPath: string, options?: { recursive?: boolean }): Promise<void>;

  /** Moves or renames a file/directory */
  move(userId: string | null, sourceLogicalPath: string, destinationLogicalPath: string): Promise<void>;
}
```

**Key Points**:

- All API operations accept `userId` as context, used for resolving `user://` protocol paths. For `shared://` or `system://` paths, `userId` can be `null` or ignored.
- The service internally determines the correct physical root path based on the logical path's protocol (`user://`, `shared://`, `system://`) and `userId`.
- The API throws specific errors, such as `FileNotFoundError`, `PermissionDeniedError`, `InvalidPathError`.

## 7. Security

- **Path Traversal Protection**: The FAM service performs strict cleaning and validation when resolving paths to prevent path traversal attacks.
- **Permission Control**: The logical path scheme provides a foundation for implementing more granular read/write permission control in the future. `userId` is key to permission judgment.
- **Symbolic Links**: The system prohibits resolving and operating on symbolic links by default to avoid potential security risks.

## 8. Plugin and Extension Asset Management

Unlike user and system core assets, the asset management for Plugins and Extensions follows an independent mechanism driven by the `PluginLoader` service.

### 8.1. Physical Storage Structure

All plugins are located in the `plugins/` directory at the project root.

```
ComfyTavern/
└── plugins/
    └── my-awesome-plugin/ # Directory for one plugin
        ├── plugin.yaml    # (Required) Plugin manifest file
        ├── nodes/         # (Optional) Backend nodes
        ├── web/           # (Optional) Frontend resources (JS, CSS, images, etc.)
        └── tools/         # (Optional) Backend tools
```

### 8.2. Asset Handling

Plugin assets are not accessed via `FileManagerService` and its logical paths (e.g., `user://`). Instead, they are handled as follows:

- **Backend Assets (`nodes/`, `tools/`)**:
  - When the application starts, the backend's `PluginLoader` service scans the `plugins/` directory.
  - It reads each plugin's `plugin.yaml` file and, based on the declarations in the manifest, uses `NodeLoader` to load backend nodes (`nodes/`).
  - Tools (`tools/`) are loaded by the corresponding `ToolManager`.
  - These files are read directly from the file system by the backend service, bypassing `FileManagerService`.

- **Frontend Assets (`web/` or `dist/`)**:
  - The `PluginLoader` sets up a static file service for each plugin containing frontend resources.
  - Plugin frontend files are mapped to a public URL path in the format `/plugins/{pluginName}/`. For example, the file `plugins/my-awesome-plugin/web/style.css` can be accessed by the browser via the URL `/plugins/my-awesome-plugin/style.css`.
  - This mechanism allows plugin frontend scripts and styles to be dynamically loaded into the main application, enabling the extension of frontend functionality.

### 8.3. Relationship with FAM System

- **Independence**: Plugin asset management is independent of the core FAM system. When developers perform file operations within a plugin, they typically use the standard Node.js `fs` module, with the plugin's own directory as the root for relative paths.
- **No Logical Paths**: Plugin files do not have a corresponding `plugin://` logical path scheme. Access to plugin resources is via direct backend loading or frontend URL requests, not through `famService.readFile()` APIs.