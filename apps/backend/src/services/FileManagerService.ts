import fs from 'fs/promises';
import path from 'path';
import {
  getProjectRootDir,
  getPublicDir,
  getLogDir,
  getLibraryBaseDir,
  getUserDataRoot,
  getDataDir,
  ensureDirExists, // 稍后可能会用到
} from '../utils/fileUtils'; // 路径相对于 apps/backend/src/services/

// 类型定义 (根据文档第 6 节)
// ListItem interface is now replaced by FAMItem from @comfytavern/types
import type { FAMItem } from '@comfytavern/types';

export interface WriteOptions {
  encoding?: 'utf-8' | 'binary'; // 保持与 readFile 一致
  overwrite?: boolean; // 默认 true，如果 false且文件已存在则抛错
  append?: boolean; // 新增：是否追加到文件末尾，默认为 false
}

export interface DeleteOptions {
  recursive?: boolean;
  force?: boolean;
}

export interface MoveOptions {
  overwrite?: boolean;
}

// FAMService 接口定义 (根据文档第 6 节)
export interface FAMService {
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
  listDir(userId: string | null, logicalPath: string): Promise<FAMItem[]>;

  /** 创建目录 (递归创建) */
  createDir(userId: string | null, logicalPath: string): Promise<void>;

  /** 删除文件或目录 */
  delete(
    userId: string | null,
    logicalPath: string,
    options?: DeleteOptions
  ): Promise<void>;

  /** 移动或重命名文件/目录 */
  move(
    userId: string | null,
    sourceLogicalPath: string,
    destinationLogicalPath: string,
    options?: MoveOptions
  ): Promise<void>;

  /** 复制文件/目录 (可选) */
  // copy(userId: string | null, sourceLogicalPath: string, destinationLogicalPath: string): Promise<void>;

  /** 获取文件元数据 (可选) */
  // getMetadata(userId: string | null, logicalPath: string): Promise<FileMetadata>;
}

// FileManagerService 类实现
export class FileManagerService implements FAMService {
  private projectRootDir: string;
  private publicDir: string;
  private logDir: string;
  private libraryBaseDir: string;
  private userDataRoot: string;
  private dataDir: string;

  constructor() {
    this.projectRootDir = getProjectRootDir();
    this.publicDir = getPublicDir();
    this.logDir = getLogDir();
    this.libraryBaseDir = getLibraryBaseDir();
    this.userDataRoot = getUserDataRoot();
    this.dataDir = getDataDir();

    console.log('[FileManagerService] Initialized with paths:');
    console.log(`  Project Root: ${this.projectRootDir}`);
    console.log(`  User Data Root: ${this.userDataRoot}`);
    console.log(`  Shared Library: ${this.libraryBaseDir}`);
    console.log(`  System Data: ${this.dataDir}`);
    console.log(`  System Public: ${this.publicDir}`);
    console.log(`  System Logs: ${this.logDir}`);
  }

  // --- 核心路径解析逻辑 (任务 1.2) ---
  async resolvePath(userId: string | null, logicalPath: string): Promise<string> {
    if (!logicalPath || typeof logicalPath !== 'string') {
      throw new Error('Invalid logical path provided.');
    }

    const parts = logicalPath.split('://');
    if (parts.length !== 2) {
      throw new Error(`Invalid logical path format: ${logicalPath}. Expected scheme://path`);
    }

    const scheme = parts[0];
    let relativePath = parts[1];

    // 清理路径，防止遍历攻击
    // 1. 规范化路径 (处理 '..' 和 '.')
    // 2. 移除开头的斜杠，因为我们将使用 path.join
    // 3. 分割成组件，过滤掉空组件 (例如 '///' 会产生空组件)
    relativePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, ''); // 防止向上遍历到根以上
    
    // 进一步清理，确保不会以 '..' 开头或包含 '..' 试图跳出根目录
    const pathSegments = relativePath.split(/[/\\]+/).filter(segment => segment && segment !== '.');
    if (pathSegments.some(segment => segment === '..')) {
        throw new Error(`Path traversal attempt detected in logical path: ${logicalPath}`);
    }
    const cleanRelativePath = path.join(...pathSegments);


    let basePhysicalPath: string;

    switch (scheme) {
      case 'user':
        if (!userId) {
          throw new Error('UserId is required for user:// paths.');
        }
        // 用户特定路径的基础是 this.userDataRoot / userId
        // 例如: user://projects/myProject/file.txt -> /userDataRoot/userId1/projects/myProject/file.txt
        basePhysicalPath = path.join(this.userDataRoot, userId);
        break;
      case 'shared':
        // 共享路径的基础是 this.libraryBaseDir
        // 例如: shared://library/workflows/template.json -> /libraryBaseDir/workflows/template.json
        // 注意：设计文档中 shared://library/ -> 物理 /library/
        // 所以如果 logicalPath 是 shared://library/workflows/abc.json, cleanRelativePath 会是 library/workflows/abc.json
        // 我们需要移除 "library/" 前缀，如果它存在于 cleanRelativePath 的开头
        if (cleanRelativePath.startsWith('library')) {
          basePhysicalPath = this.libraryBaseDir;
          // path.relative 会给出从 libraryBaseDir 到 cleanRelativePath 的相对路径
          // 但这里更直接的是，如果 cleanRelativePath 是 'library/workflows/a.json'
          // 而 basePhysicalPath 是 this.libraryBaseDir (它映射到 'ComfyTavern/library')
          // 那么我们只需要 cleanRelativePath 中 'library/' 之后的部分
          const sharedPathParts = cleanRelativePath.split(path.sep); // path.sep 兼容不同系统
          if (sharedPathParts[0] === 'library') {
            // 移除 'library' 部分
            // path.join(...['workflows', 'abc.json'])
            const finalSharedPath = path.join(...sharedPathParts.slice(1));
            const resolvedPath = path.join(basePhysicalPath, finalSharedPath);
            // 安全检查：确保解析后的路径仍在 basePhysicalPath 之下
            if (!resolvedPath.startsWith(basePhysicalPath)) {
              throw new Error(`Path traversal attempt detected in shared path: ${logicalPath}`);
            }
            return resolvedPath;
          } else {
            // 如果 shared:// 路径不以 library/ 开头，这可能是一个错误或未定义的行为
            throw new Error(`Invalid shared path: ${logicalPath}. Must start with shared://library/`);
          }
        } else {
           throw new Error(`Invalid shared path: ${logicalPath}. Must start with shared://library/`);
        }
      case 'system':
        // 系统路径需要根据 cleanRelativePath 的第一部分来确定映射
        // system://public/... -> this.publicDir/...
        // system://data/... -> this.dataDir/...
        // system://logs/... -> this.logDir/...
        const systemPathParts = cleanRelativePath.split(path.sep);
        const systemArea = systemPathParts[0];
        const systemRelativePath = path.join(...systemPathParts.slice(1));

        switch (systemArea) {
          case 'public':
            basePhysicalPath = this.publicDir;
            break;
          case 'data':
            basePhysicalPath = this.dataDir;
            break;
          case 'logs':
            basePhysicalPath = this.logDir;
            break;
          default:
            throw new Error(`Unknown system area in logical path: ${logicalPath}`);
        }
        const resolvedSystemPath = path.join(basePhysicalPath, systemRelativePath);
        // 安全检查
        if (!resolvedSystemPath.startsWith(basePhysicalPath)) {
          throw new Error(`Path traversal attempt detected in system path: ${logicalPath}`);
        }
        return resolvedSystemPath;
      default:
        throw new Error(`Unknown scheme in logicalPath: ${scheme}`);
    }

    const finalPhysicalPath = path.join(basePhysicalPath, cleanRelativePath);

    // 最终安全检查：确保解析后的路径仍在预期的 basePhysicalPath 之下
    // 对于 user://, basePhysicalPath 是 this.userDataRoot/userId
    // 对于其他 scheme, 已经在 switch case 中处理了
    if (scheme === 'user' && !finalPhysicalPath.startsWith(basePhysicalPath)) {
        throw new Error(`Path traversal attempt detected in user path: ${logicalPath}`);
    }
    
    return finalPhysicalPath;
  }

  // --- 基本文件/目录操作 (任务 1.4) ---
  async exists(userId: string | null, logicalPath: string): Promise<boolean> {
    try {
      const physicalPath = await this.resolvePath(userId, logicalPath);
      await fs.access(physicalPath);
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return false;
      }
      // 对于 "Invalid logical path" 或 "UserId is required" 等由 resolvePath 抛出的错误，也应视为不存在或不可访问
      if (error.message.startsWith('Invalid logical path') || error.message.startsWith('UserId is required') || error.message.startsWith('Unknown scheme') || error.message.startsWith('Path traversal attempt detected') || error.message.startsWith('Unknown system area')) {
        return false;
      }
      console.error(`[FileManagerService] Error checking existence of ${logicalPath} (userId: ${userId}):`, error);
      throw error; // 其他类型的错误则向上抛出
    }
  }

  async readFile(
    userId: string | null,
    logicalPath: string,
    encoding: "utf-8" | "binary" = "utf-8"
  ): Promise<string | Buffer> {
    try {
      const physicalPath = await this.resolvePath(userId, logicalPath);
      // 确保文件存在才读取
      if (!await this.exists(userId, logicalPath)) { // 复用 exists 方法的逻辑
        throw new Error(`File not found at logical path: ${logicalPath}`);
      }
      return await fs.readFile(physicalPath, encoding === "binary" ? null : encoding);
    } catch (error: any) {
      // 如果是 resolvePath 或 exists 内部抛出的已知错误类型，直接重新抛出
      if (error.message.startsWith('File not found') || error.message.startsWith('Invalid logical path') || error.message.startsWith('UserId is required') || error.message.startsWith('Unknown scheme') || error.message.startsWith('Path traversal attempt detected') || error.message.startsWith('Unknown system area')) {
        throw error;
      }
      // 其他 fs 操作错误
      console.error(`[FileManagerService] Error reading file ${logicalPath} (userId: ${userId}):`, error);
      if (error.code === 'ENOENT') {
        throw new Error(`File not found at logical path: ${logicalPath}`);
      }
      throw error; // 其他类型的错误则向上抛出
    }
  }

  async writeFile(
    userId: string | null,
    logicalPath: string,
    data: string | Buffer,
    options?: WriteOptions
  ): Promise<void> {
    const writeOptions: Required<Omit<WriteOptions, 'append'>> & Pick<WriteOptions, 'append'> = {
      overwrite: options?.overwrite ?? true,
      encoding: options?.encoding ?? 'utf-8',
      append: options?.append ?? false,
    };

    try {
      const physicalPath = await this.resolvePath(userId, logicalPath);

      // 确保目标文件的父目录存在 (对于追加和覆盖写入都需要)
      await this._ensurePhysicalDirExists(physicalPath);

      if (writeOptions.append) {
        // 追加模式
        await fs.appendFile(physicalPath, data, writeOptions.encoding === "binary" ? undefined : writeOptions.encoding);
      } else {
        // 覆盖或创建模式
        if (!writeOptions.overwrite) {
          const fileExists = await this.exists(userId, logicalPath); // this.exists 内部会调用 resolvePath
          if (fileExists) {
            throw new Error(`File already exists at logical path: ${logicalPath} and overwrite is false.`);
          }
        }
        await fs.writeFile(physicalPath, data, writeOptions.encoding === "binary" ? null : writeOptions.encoding);
      }
    } catch (error: any) {
      // 如果是 resolvePath 或 exists 内部抛出的已知错误类型，直接重新抛出
      if (error.message.startsWith('File already exists') || error.message.startsWith('Invalid logical path') || error.message.startsWith('UserId is required') || error.message.startsWith('Unknown scheme') || error.message.startsWith('Path traversal attempt detected') || error.message.startsWith('Unknown system area')) {
        throw error;
      }
      console.error(`[FileManagerService] Error writing file ${logicalPath} (userId: ${userId}):`, error);
      throw error; // 其他类型的错误则向上抛出
    }
  }

  async listDir(userId: string | null, logicalPath: string): Promise<FAMItem[]> {
    try {
      const physicalPath = await this.resolvePath(userId, logicalPath);

      // 检查路径是否存在且为目录
      let stats;
      try {
        stats = await fs.stat(physicalPath);
      } catch (statError: any) {
        if (statError.code === 'ENOENT') {
          throw new Error(`Directory not found at logical path: ${logicalPath}`);
        }
        throw statError;
      }

      if (!stats.isDirectory()) {
        throw new Error(`Not a directory at logical path: ${logicalPath}`);
      }

      const dirents = await fs.readdir(physicalPath, { withFileTypes: true });
      const listItems: FAMItem[] = [];

      for (const dirent of dirents) {
        const itemName = dirent.name;
        // 构造子条目的逻辑路径
        // 确保 logicalPath 以 / 结尾，以便正确拼接
        const parentLogicalPath = logicalPath.endsWith('/') ? logicalPath : `${logicalPath}/`;
        const itemLogicalPath = `${parentLogicalPath}${itemName}`;
        
        let itemSize: number | undefined = undefined;
        let itemLastModified: Date | undefined = undefined;

        if (dirent.isFile()) {
          try {
            const itemPhysicalPath = path.join(physicalPath, itemName);
            const itemStats = await fs.stat(itemPhysicalPath);
            itemSize = itemStats.size;
            itemLastModified = itemStats.mtime;
          } catch (itemStatError) {
            // 如果获取文件元数据失败，可以忽略或记录日志，但仍包含条目
            console.warn(`[FileManagerService] Could not get stats for ${itemLogicalPath}:`, itemStatError);
          }
        }
 
        const itemTypeFromDirent = dirent.isDirectory() ? 'directory' : 'file';
        console.log(`[FileManagerService.listDir] Processing dirent: name='${itemName}', isDirectory=${dirent.isDirectory()}, determinedType='${itemTypeFromDirent}' for logicalPath='${itemLogicalPath}'`);
 
        listItems.push({
          id: itemLogicalPath, // Use logicalPath as ID
          name: itemName,
          logicalPath: itemLogicalPath,
          itemType: itemTypeFromDirent,
          size: itemSize,
          lastModified: itemLastModified ? itemLastModified.getTime() : undefined,
          isSymlink: dirent.isSymbolicLink(),
          isWritable: true, // Default, can be refined
          // mimeType, childrenCount, thumbnailUrl, error can be added later if needed
        });
      }
      console.log(`[FileManagerService.listDir] For logicalPath='${logicalPath}', returning items:`, JSON.stringify(listItems.map(it => ({ name: it.name, itemType: it.itemType, logicalPath: it.logicalPath, id: it.id }))));
      return listItems;
    } catch (error: any) {
      if (error.message.startsWith('Directory not found') || error.message.startsWith('Not a directory') || error.message.startsWith('Invalid logical path') || error.message.startsWith('UserId is required') || error.message.startsWith('Unknown scheme') || error.message.startsWith('Path traversal attempt detected') || error.message.startsWith('Unknown system area')) {
        throw error;
      }
      console.error(`[FileManagerService] Error listing directory ${logicalPath} (userId: ${userId}):`, error);
      throw error;
    }
  }

  async createDir(userId: string | null, logicalPath: string): Promise<void> {
    try {
      const physicalPath = await this.resolvePath(userId, logicalPath);
      
      // 检查是否已存在，如果存在且不是目录，则抛错
      try {
        const stats = await fs.stat(physicalPath);
        if (!stats.isDirectory()) {
          throw new Error(`Cannot create directory: A file already exists at logical path ${logicalPath}`);
        }
        // 如果目录已存在，则无需操作
        return;
      } catch (statError: any) {
        if (statError.code !== 'ENOENT') { // 如果不是 "不存在" 错误，则抛出
          throw statError;
        }
        // 不存在，可以继续创建
      }

      await fs.mkdir(physicalPath, { recursive: true });
    } catch (error: any) {
      if (error.message.startsWith('Cannot create directory') || error.message.startsWith('Invalid logical path') || error.message.startsWith('UserId is required') || error.message.startsWith('Unknown scheme') || error.message.startsWith('Path traversal attempt detected') || error.message.startsWith('Unknown system area')) {
        throw error;
      }
      console.error(`[FileManagerService] Error creating directory ${logicalPath} (userId: ${userId}):`, error);
      throw error;
    }
  }

  async delete(
    userId: string | null,
    logicalPath: string,
    options?: DeleteOptions // Use DeleteOptions
  ): Promise<void> {
    const deleteOptions = {
      recursive: options?.recursive ?? false,
      force: options?.force ?? false, // Default force to false
    };

    try {
      const physicalPath = await this.resolvePath(userId, logicalPath);

      // Check existence first.
      let stats;
      try {
        stats = await fs.stat(physicalPath);
      } catch (statError: any) {
        if (statError.code === 'ENOENT') {
          if (deleteOptions.force) {
            return; // If force is true, non-existence is okay for delete.
          }
          throw new Error(`Path not found at logical path: ${logicalPath}`);
        }
        throw statError; // Other stat errors (e.g., permission issues)
      }

      // At this point, the path exists. Proceed with deletion.
      if (stats.isDirectory()) {
        // For directories, fs.rm with recursive option handles both empty and non-empty.
        // If not recursive, it will fail on non-empty directories unless force is also true.
        await fs.rm(physicalPath, { recursive: deleteOptions.recursive, force: deleteOptions.force });
      } else { // For files or other types that fs.rm can handle (e.g. symlinks)
        // For a single file, recursive should ideally be false, but fs.rm handles it.
        // fs.rm on a file with recursive:true might not error but is unnecessary.
        // Explicitly setting recursive:false for non-directories is safer.
        await fs.rm(physicalPath, { force: deleteOptions.force, recursive: false });
      }
    } catch (error: any) {
      // Consolidate error handling.
      // Known errors from resolvePath or our explicit "Path not found".
      if (error.message.startsWith('Path not found') ||
          error.message.startsWith('Invalid logical path') ||
          error.message.startsWith('UserId is required') ||
          error.message.startsWith('Unknown scheme') ||
          error.message.startsWith('Path traversal attempt detected') ||
          error.message.startsWith('Unknown system area')) {
        throw error;
      }
      // Log other unexpected errors from fs.rm (e.g., EPERM, EACCES)
      console.error(`[FileManagerService] Error deleting ${logicalPath} (userId: ${userId}, options: ${JSON.stringify(deleteOptions)}):`, error);
      throw error; // Re-throw other errors
    }
  }

  async move(
    userId: string | null, // userId 应用于源和目标路径的解析
    sourceLogicalPath: string,
    destinationLogicalPath: string,
    options?: MoveOptions
  ): Promise<void> {
    const moveOptions = {
      overwrite: options?.overwrite ?? false, // Default overwrite to false
    };

    try {
      const sourcePhysicalPath = await this.resolvePath(userId, sourceLogicalPath);
      const destinationPhysicalPath = await this.resolvePath(userId, destinationLogicalPath);

      // --- 开始：添加受保护路径检查 ---
      const normalizedSourcePath = sourceLogicalPath.endsWith('/') ? sourceLogicalPath.slice(0, -1) : sourceLogicalPath;
      const normalizedDestPath = destinationLogicalPath.endsWith('/') ? destinationLogicalPath.slice(0, -1) : destinationLogicalPath;

      let isProtected = false;
      let protectionMessage = '';

      // 检查1: 是否尝试重命名 system:// 下的任何路径
      if (normalizedSourcePath.startsWith('system://')) {
        isProtected = true;
        protectionMessage = `Renaming of system path '${normalizedSourcePath}' is not allowed.`;
      } else {
        // 检查2: 固定的顶级路径和其下的固定子目录
        const fixedPathsToProtect = [
          // Top level
          'user://projects',
          'user://library',
          'shared://library',
          // Shared library subdirectories
          'shared://library/workflows',
          'shared://library/knowledgebases',
          'shared://library/SillyTavern', // 根据文档，历史遗留，作为固定资产保护
          // User library subdirectories
          'user://library/templates',
          'user://library/knowledgebases',
        ];

        if (fixedPathsToProtect.includes(normalizedSourcePath)) {
          isProtected = true;
          protectionMessage = `Renaming of protected path '${normalizedSourcePath}' is not allowed.`;
        } else {
          // 检查3: user://projects/{projectId}/<fixed_subdir>
          // 匹配 user://projects/ANY_PROJECT_ID/workflows or /outputs or /assets
          const projectSubDirPattern = /^user:\/\/projects\/([^/]+)\/(workflows|outputs|assets)$/;
          const match = normalizedSourcePath.match(projectSubDirPattern);
          if (match) {
            isProtected = true;
            protectionMessage = `Renaming of project structural directory '${normalizedSourcePath}' is not allowed.`;
          }
        }
      }

      if (isProtected && normalizedSourcePath.toLowerCase() !== normalizedDestPath.toLowerCase()) {
        // 只有当确定是受保护路径，并且源路径和目标路径确实不同（不仅仅是大小写或尾部斜杠）时，才抛出错误
        throw new Error(protectionMessage);
      }
      // --- 结束：添加受保护路径检查 ---

      // 1. 检查源是否存在
      if (!await this.exists(userId, sourceLogicalPath)) {
        throw new Error(`Source path does not exist: ${sourceLogicalPath}`);
      }

      // 2. 检查目标是否存在
      const destinationExists = await this.exists(userId, destinationLogicalPath);

      if (destinationExists) {
        if (sourcePhysicalPath === destinationPhysicalPath) {
          // 源和目标相同，无需操作
          return;
        }
        if (!moveOptions.overwrite) {
          throw new Error(`Destination path already exists: ${destinationLogicalPath} and overwrite is false.`);
        }
        // If overwrite is true, proceed. fs.rename will handle overwriting file or empty dir.
        // For non-empty dir, fs.rename might fail on some platforms if destination is an existing non-empty dir.
        // Node.js fs.rename behavior:
        // - If destination is an existing file, it will be replaced.
        // - If destination is an existing empty directory, it will be replaced.
        // - If destination is an existing non-empty directory, behavior is platform-dependent (often fails on POSIX, may succeed on Windows by moving source into dest).
        // For simplicity, we rely on fs.rename's behavior. A more robust solution for directories might involve deleting destination first if overwrite is true.
        // However, the current test case is for a file, where overwrite is generally well-supported.
      }
      
      // 3. 确保目标路径的父目录存在
      await this._ensurePhysicalDirExists(destinationPhysicalPath);

      // 4. 执行移动
      // 注意: fs.rename 在跨设备或分区时可能会失败。
      // 一个更健壮的实现可能需要检查这一点，并回退到复制+删除。
      // 但对于初期实现，我们依赖 fs.rename。
      await fs.rename(sourcePhysicalPath, destinationPhysicalPath);

    } catch (error: any) {
      if (error.message.startsWith('Source path does not exist') ||
          error.message.includes('Destination path already exists') || // includes to catch "and overwrite is false"
          error.message.startsWith('Invalid logical path') ||
          error.message.startsWith('UserId is required') ||
          error.message.startsWith('Unknown scheme') ||
          error.message.startsWith('Path traversal attempt detected') ||
          error.message.startsWith('Unknown system area')) {
        throw error;
      }
      console.error(`[FileManagerService] Error moving from ${sourceLogicalPath} to ${destinationLogicalPath} (userId: ${userId}, options: ${JSON.stringify(moveOptions)}):`, error);
      // fs.rename 可能会抛出 EXDEV (跨设备链接) 等错误
      if (error.code === 'EXDEV') {
        throw new Error(`Cannot move across different file systems/devices: from ${sourceLogicalPath} to ${destinationLogicalPath}. This operation may require copy + delete.`);
      }
      throw error;
    }
  }

  // --- 私有辅助函数 (任务 1.3) ---
  private async _ensurePhysicalDirExists(physicalPath: string): Promise<void> {
    // 确保物理路径的目录存在
    // 注意：如果 physicalPath 本身是文件路径，则需要获取其目录部分
    const dir = path.dirname(physicalPath);
    await ensureDirExists(dir);
  }

  // _validateLogicalPath 可以在各个操作前调用，但 resolvePath 已包含大部分校验逻辑
  // private _validateLogicalPath(logicalPath: string, resolvedPhysicalPath: string, expectedBase: string): void {
  //   if (!resolvedPhysicalPath.startsWith(expectedBase)) {
  //     throw new Error(`Security Error: Path ${logicalPath} resolved to ${resolvedPhysicalPath} which is outside of expected base ${expectedBase}`);
  //   }
  // }
}

// 可以考虑导出一个单例实例
export const famService = new FileManagerService();