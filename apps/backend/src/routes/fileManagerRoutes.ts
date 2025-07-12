import { Elysia, t } from "elysia";
import { famService } from "../services/FileManagerService";
import type { UserContext } from "@comfytavern/types";
import type { AuthContext } from "../middleware/authMiddleware";
import type { Context as ElysiaContext } from "elysia";

// 辅助函数：从 UserContext 中安全地提取 userId
// 这个版本更通用，能处理 LocalUser (包括 default_user) 和 MultiUser 的情况
function getUserIdFromContext(userContext: UserContext | null): string | null {
  if (!userContext || !userContext.currentUser) {
    return null;
  }
  const currentUser = userContext.currentUser;
  // 优先检查 'uid' (用于 MultiUser)
  if ("uid" in currentUser && typeof currentUser.uid === "string") {
    return currentUser.uid;
  }
  // 然后检查 'id' (用于 LocalUser, 包括 "default_user")
  if ("id" in currentUser && typeof currentUser.id === "string") {
    return currentUser.id;
  }
  return null;
}

interface FamRequestContext extends ElysiaContext, AuthContext {
  // params, query, body 等由 Elysia 根据路由定义推断
}

export const fileManagerRoutes = new Elysia({
  prefix: "/api/fam",
  name: "file-manager-routes",
  seed: "comfy.fam.routes",
})
  // + 咕咕：为面板SDK添加专用端点
  .get(
    "/sdk/panel.js",
    async ({ set }) => {
      try {
        const sdkScript = await famService.getPanelSdkScript();
        set.headers['Content-Type'] = 'application/javascript; charset=utf-8';
        set.status = 200;
        return sdkScript;
      } catch (error: any) {
        console.error(`[FileManagerRoutes] Error serving panel SDK script:`, error);
        set.status = 500;
        // 在响应中返回一个有效的、可执行的JS错误，以便在浏览器控制台中清晰地显示
        set.headers['Content-Type'] = 'application/javascript; charset=utf-8';
        return `console.error("ComfyTavern Panel SDK could not be loaded. Please check server logs.");`;
      }
    },
    {
      detail: {
        summary: "Get the Panel SDK script.",
        description: "Provides a stable, clean endpoint to download the panel SDK for development purposes.",
        tags: ["File Manager", "SDK"],
      },
    }
  )
  .get(
    "/list/*",
    async (ctx) => {
      const { params, set, userContext } = ctx as FamRequestContext & { params: { "*": string } };
      let rawLogicalPath = params["*"]; // 获取通配符匹配的路径部分
      let logicalPath: string;

      if (typeof rawLogicalPath === "string") {
        try {
          // 首先尝试解码，因为路径参数可能是 URL 编码的
          logicalPath = decodeURIComponent(rawLogicalPath);
        } catch (e) {
          // 如果解码失败，可能路径本身就包含 % 但不是合法的编码序列
          console.error(`[FileManagerRoutes] Failed to decode logicalPath: '${rawLogicalPath}'`, e);
          set.status = 400;
          return { error: "Invalid logical path encoding." };
        }
        logicalPath = logicalPath.trim(); // 然后 trim
      } else {
        // 如果 rawLogicalPath 不是字符串 (理论上 Elysia 会确保它是，但作为防御)
        set.status = 400;
        return { error: "Logical path parameter is missing or not a string." };
      }

      const userId = getUserIdFromContext(userContext);
      console.log(
        `[FileManagerRoutes] Processing decoded & trimmed logicalPath: '${logicalPath}' (raw: '${rawLogicalPath}') for userId: ${userId}`
      );

      if (!logicalPath) {
        // 检查解码和 trim 后的 logicalPath
        set.status = 400;
        return { error: "Logical path is required and cannot be empty after trimming." };
      }

      // 从查询参数中获取 ensureExists
      const ensureExists = ctx.query.ensureExists === 'true';

      try {
        // 将 ensureExists 选项传递给 famService
        const items = await famService.listDir(userId, logicalPath, { ensureExists });
        console.log(
          `[FileManagerRoutes] Successfully listed ${items.length} items for '${logicalPath}' (userId: ${userId}, ensureExists: ${ensureExists})`
        );
        return items;
      } catch (error: any) {
        console.error(
          `[FileManagerRoutes] Error listing directory '${logicalPath}' (userId: ${userId}):`,
          error.message,
          error.stack
        );
        // 现在 FileManagerService 会处理 "not found" 的情况，所以我们主要捕获其他错误
        if (error.message.includes("Not a directory")) {
          // 这是一个客户端错误，因为他们试图列出一个文件
          set.status = 400;
        } else if (
          error.message.includes("Invalid logical path") ||
          error.message.includes("Unknown scheme") ||
          error.message.includes("Path traversal attempt detected") ||
          error.message.includes("Unknown system area")
        ) {
          set.status = 400;
        } else if (error.message.includes("UserId is required")) {
          set.status = 401;
        } else {
          // 其他未预料到的错误
          set.status = 500;
        }
        return { error: error.message };
      }
    },
    {
      detail: {
        summary: "List directory contents for a given logical path.",
        description:
          "The logical path is appended to /api/fam/list/. For example, /api/fam/list/user://documents/ will list contents of user://documents/. The user ID is derived from the authentication context. Accepts an 'ensureExists=true' query parameter to create the directory if it does not exist.",
        tags: ["File Manager"],
      },
      query: t.Object({
        ensureExists: t.Optional(t.String()), // 'true' or undefined
      }),
    }
  )
  // POST /api/fam/create-dir - 创建新目录
  .post(
    "/create-dir",
    async (ctx) => {
      const { body, set, userContext } = ctx as FamRequestContext & {
        body: { parentLogicalPath: string; dirName: string };
      };
      const { parentLogicalPath, dirName } = body;

      if (!parentLogicalPath || !dirName) {
        set.status = 400;
        return { error: "parentLogicalPath and dirName are required." };
      }
      if (dirName.includes("/") || dirName.includes("\\") || dirName === "." || dirName === "..") {
        set.status = 400;
        return { error: "Invalid directory name." };
      }

      const userId = getUserIdFromContext(userContext);
      // userId 可能为 null，famService.createDir 会根据 scheme 判断是否需要

      // 构造完整的逻辑路径
      // 确保 parentLogicalPath 以单个 / 结尾
      const normalizedParentPath = parentLogicalPath.endsWith("//")
        ? parentLogicalPath
        : parentLogicalPath.replace(/\/?$/, "/");
      const fullLogicalPath = `${normalizedParentPath}${dirName}`;

      console.log(
        `[FileManagerRoutes] Attempting to create directory: '${fullLogicalPath}' for userId: ${userId}`
      );

      try {
        await famService.createDir(userId, fullLogicalPath);
        set.status = 201; // Created
        // famService.createDir 返回 void。前端期望 FAMListItem。
        // 为了满足前端，我们可以构造一个基本的 FAMListItem。
        // 或者，前端在成功后应自行刷新列表。
        // 这里返回一个简化版，实际应用中可能需要更完整的元数据。
        console.log(
          `[FileManagerRoutes] Successfully created directory '${fullLogicalPath}' for userId: ${userId}`
        );
        return {
          name: dirName,
          logicalPath: fullLogicalPath, // 通常创建后路径会带上末尾的 /
          itemType: "directory",
        };
      } catch (error: any) {
        console.error(
          `[FileManagerRoutes] Error creating directory '${fullLogicalPath}' (userId: ${userId}):`,
          error.message,
          error.stack
        );
        if (error.message.includes("already exists")) {
          set.status = 409; // Conflict
        } else if (
          error.message.includes("Invalid logical path") ||
          error.message.includes("UserId is required")
        ) {
          set.status = 400; // 或 401 for UserId is required
        } else {
          set.status = 500;
        }
        return { error: error.message };
      }
    },
    {
      body: t.Object({
        parentLogicalPath: t.String({
          minLength: 1,
          error: "Parent logical path cannot be empty.",
        }),
        dirName: t.String({ minLength: 1, error: "Directory name cannot be empty." }),
      }),
      detail: {
        summary: "Create a new directory.",
        tags: ["File Manager"],
      },
    }
  )
  // DELETE /api/fam/delete - 删除文件或目录
  .delete(
    "/delete",
    async (ctx) => {
      const { body, set, userContext } = ctx as FamRequestContext & {
        body: { logicalPaths: string[] };
      };
      const { logicalPaths } = body;

      if (!logicalPaths || !Array.isArray(logicalPaths) || logicalPaths.length === 0) {
        set.status = 400;
        return { error: "logicalPaths array is required and cannot be empty." };
      }

      const userId = getUserIdFromContext(userContext);
      const errors: { path: string; message: string }[] = [];
      let successCount = 0;

      console.log(
        `[FileManagerRoutes] Attempting to delete paths: '${logicalPaths.join(
          ", "
        )}' for userId: ${userId}`
      );

      for (const rawPath of logicalPaths) {
        let pathToDelete = rawPath;
        if (typeof pathToDelete === "string") {
          try {
            pathToDelete = decodeURIComponent(pathToDelete); // 解码每个路径
          } catch (e) {
            errors.push({ path: rawPath, message: "Invalid path encoding." });
            continue;
          }
          pathToDelete = pathToDelete.trim();
        } else {
          errors.push({ path: String(rawPath), message: "Invalid path entry, not a string." });
          continue;
        }

        if (!pathToDelete) {
          errors.push({ path: rawPath, message: "Path cannot be empty after decoding/trimming." });
          continue;
        }

        try {
          // 默认使用 recursive: true, force: false (famService 内部的 delete 默认 force 为 false)
          // 如果需要更细致的控制，可以从请求体接收 options
          await famService.delete(userId, pathToDelete, { recursive: true });
          successCount++;
        } catch (error: any) {
          console.error(
            `[FileManagerRoutes] Error deleting path '${pathToDelete}' (userId: ${userId}):`,
            error.message
          );
          errors.push({ path: pathToDelete, message: error.message });
        }
      }

      if (errors.length > 0) {
        // 如果有部分成功，部分失败，可以返回 207 Multi-Status 或根据策略决定
        // 为简单起见，如果任何一个失败，我们可能返回一个聚合错误
        // 或者，如果所有都失败，返回一个合适的错误码
        if (successCount === 0) {
          set.status = errors.some((e) => e.message.includes("not found")) ? 404 : 500; // 简化错误码判断
        } else {
          // 部分成功
          set.status = 207; // Multi-Status
        }
        return {
          message: `Processed ${logicalPaths.length} paths. ${successCount} succeeded, ${errors.length} failed.`,
          errors,
        };
      }

      set.status = 204; // No Content, 表示成功删除所有请求的资源
      console.log(
        `[FileManagerRoutes] Successfully deleted paths: '${logicalPaths.join(
          ", "
        )}' for userId: ${userId}`
      );
      // 204 不需要响应体
    },
    {
      body: t.Object({
        logicalPaths: t.Array(t.String({ minLength: 1 }), {
          minItems: 1,
          error: "logicalPaths must be a non-empty array of non-empty strings.",
        }),
      }),
      detail: {
        summary: "Delete one or more files/directories.",
        tags: ["File Manager"],
      },
    }
  )
  // PUT /api/fam/rename - 重命名文件或目录
  .put(
    "/rename",
    async (ctx) => {
      const { body, set, userContext } = ctx as FamRequestContext & {
        body: { logicalPath: string; newName: string };
      };
      let { logicalPath: rawSourceLogicalPath, newName } = body;

      if (!rawSourceLogicalPath || !newName) {
        set.status = 400;
        return { error: "logicalPath and newName are required." };
      }
      if (newName.includes("/") || newName.includes("\\") || newName === "." || newName === "..") {
        set.status = 400;
        return {
          error: 'Invalid new name. Name cannot contain path separators or be "." or "..".',
        };
      }

      let sourceLogicalPath: string;
      try {
        sourceLogicalPath = decodeURIComponent(rawSourceLogicalPath).trim();
        if (!sourceLogicalPath) throw new Error("Source path is empty after decode/trim.");
      } catch (e) {
        console.error(
          `[FileManagerRoutes] Failed to decode sourceLogicalPath for rename: '${rawSourceLogicalPath}'`,
          e
        );
        set.status = 400;
        return { error: "Invalid source logicalPath encoding." };
      }

      const userId = getUserIdFromContext(userContext);

      // 从源路径构造目标路径
      const lastSlashIndex = sourceLogicalPath.replace(/\/$/, "").lastIndexOf("/");
      let parentDirectoryPath = "";
      if (lastSlashIndex === -1) {
        const schemeEndIndex = sourceLogicalPath.indexOf("://");
        if (
          schemeEndIndex === -1 ||
          sourceLogicalPath.substring(schemeEndIndex + 3).includes("/")
        ) {
          // 确保 scheme 后没有路径，或者格式无效
          set.status = 400;
          return {
            error:
              "Invalid source logicalPath format for determining parent directory (root or malformed).",
          };
        }
        parentDirectoryPath = sourceLogicalPath.substring(0, schemeEndIndex + 3); // e.g., "user://"
      } else {
        parentDirectoryPath = sourceLogicalPath.substring(0, lastSlashIndex + 1);
      }

      const destinationLogicalPath = `${parentDirectoryPath}${newName}`;

      console.log(
        `[FileManagerRoutes] Attempting to rename '${sourceLogicalPath}' to '${destinationLogicalPath}' for userId: ${userId}`
      );

      try {
        await famService.move(userId, sourceLogicalPath, destinationLogicalPath);

        // 确定重命名后是文件还是目录。famService.exists 和 famService.listDir (对父目录) 可以用来获取类型。
        // 为简化，我们先假设类型不变，但实际中这可能不准确，特别是如果 newName 改变了扩展名。
        // 一个更健壮的方法是让 famService.move 返回更新后的 ListItem，或者前端在成功后刷新。
        // 这里我们尝试从 sourceLogicalPath 推断类型。
        let itemType: "file" | "directory" = "file"; // 默认是文件
        if (sourceLogicalPath.endsWith("/")) {
          // 如果源路径以 / 结尾，通常是目录
          itemType = "directory";
        } else {
          // 尝试通过 famService.exists 和 stat (如果可以访问) 来确定类型，但这会增加复杂性。
          // 暂时基于有无扩展名来猜测，这不完全可靠。
          // const hasExtension = newName.includes('.') && !newName.endsWith('.');
          // itemType = hasExtension ? 'file' : 'directory'; // 这是一个非常粗略的猜测
        }
        // 最好的方式是前端在操作成功后，通过 listDir 刷新当前目录以获取最新状态。
        // 因此，后端可以只返回成功状态，或者一个非常基本的对象。

        console.log(
          `[FileManagerRoutes] Successfully renamed '${sourceLogicalPath}' to '${destinationLogicalPath}' for userId: ${userId}`
        );
        return {
          // 返回一个符合前端期望的基本结构
          name: newName,
          logicalPath: destinationLogicalPath,
          itemType: itemType, // 注意：这个 itemType 是基于源的猜测
          // size 和 lastModified 等字段在此处无法轻易获得，除非再次查询
        };
      } catch (error: any) {
        console.error(
          `[FileManagerRoutes] Error renaming '${sourceLogicalPath}' (userId: ${userId}):`,
          error.message,
          error.stack
        );
        if (error.message.includes("Source path does not exist")) {
          set.status = 404;
        } else if (error.message.includes("Destination path already exists")) {
          set.status = 409; // Conflict
        } else if (
          error.message.includes("Invalid logical path") ||
          error.message.includes("UserId is required")
        ) {
          set.status = 400;
        } else {
          set.status = 500;
        }
        return { error: error.message };
      }
    },
    {
      body: t.Object({
        logicalPath: t.String({ minLength: 1, error: "Source logicalPath cannot be empty." }),
        newName: t.String({ minLength: 1, error: "New name cannot be empty." }),
      }),
      detail: {
        summary: "Rename a file or directory.",
        tags: ["File Manager"],
      },
    }
  )
  // PUT /api/fam/move - 移动文件或目录
  .put(
    "/move",
    async (ctx) => {
      const { body, set, userContext } = ctx as FamRequestContext & {
        body: { sourcePaths: string[]; targetParentPath: string };
      };
      let { sourcePaths: rawSourcePaths, targetParentPath: rawTargetParentPath } = body;

      if (
        !rawSourcePaths ||
        !Array.isArray(rawSourcePaths) ||
        rawSourcePaths.length === 0 ||
        !rawTargetParentPath
      ) {
        set.status = 400;
        return { error: "sourcePaths array and targetParentPath are required." };
      }

      let targetParentPath: string;
      try {
        targetParentPath = decodeURIComponent(rawTargetParentPath).trim();
        if (!targetParentPath) throw new Error("Target parent path is empty after decode/trim.");
      } catch (e) {
        set.status = 400;
        return { error: "Invalid targetParentPath encoding." };
      }

      const userId = getUserIdFromContext(userContext);
      const errors: { path: string; message: string }[] = [];
      const results: any[] = []; // 可以收集成功移动的项的信息

      console.log(
        `[FileManagerRoutes] Attempting to move paths: '${rawSourcePaths.join(
          ", "
        )}' to '${targetParentPath}' for userId: ${userId}`
      );

      for (const rawSourcePath of rawSourcePaths) {
        let sourcePath: string;
        try {
          sourcePath = decodeURIComponent(rawSourcePath).trim();
          if (!sourcePath) throw new Error("Source path is empty after decode/trim.");
        } catch (e) {
          errors.push({ path: rawSourcePath, message: "Invalid sourcePath encoding." });
          continue;
        }

        // 提取源文件名/目录名
        const sourceBaseName = sourcePath
          .replace(/\/$/, "")
          .substring(sourcePath.replace(/\/$/, "").lastIndexOf("/") + 1);
        if (!sourceBaseName) {
          errors.push({
            path: sourcePath,
            message: "Could not determine basename of source path.",
          });
          continue;
        }

        // 确保目标父路径以 / 结尾
        const normalizedTargetParentPath = targetParentPath.endsWith("//")
          ? targetParentPath
          : targetParentPath.replace(/\/?$/, "/");
        const destinationLogicalPath = `${normalizedTargetParentPath}${sourceBaseName}`;

        try {
          await famService.move(userId, sourcePath, destinationLogicalPath);
          results.push({ sourcePath, destinationLogicalPath, status: "moved" });
        } catch (error: any) {
          console.error(
            `[FileManagerRoutes] Error moving '${sourcePath}' to '${destinationLogicalPath}' (userId: ${userId}):`,
            error.message
          );
          errors.push({ path: sourcePath, message: error.message });
        }
      }

      if (errors.length > 0) {
        if (results.length === 0) {
          // 全部失败
          set.status = errors.some((e) => e.message.includes("Source path does not exist"))
            ? 404
            : 500;
        } else {
          // 部分成功
          set.status = 207; // Multi-Status
        }
        return {
          message: `Processed ${rawSourcePaths.length} paths. ${results.length} succeeded, ${errors.length} failed.`,
          results,
          errors,
        };
      }
      // 前端期望 FAMListItem[]，这里返回移动后的基本信息
      // 实际应用中，可能需要重新查询目标路径的元数据
      console.log(
        `[FileManagerRoutes] Successfully moved paths to '${targetParentPath}' for userId: ${userId}`
      );
      return results.map((r) => ({
        name: r.destinationLogicalPath.split("/").pop(),
        logicalPath: r.destinationLogicalPath,
        itemType: "unknown",
      })); // itemType 需要改进
    },
    {
      body: t.Object({
        sourcePaths: t.Array(t.String({ minLength: 1 }), {
          minItems: 1,
          error: "sourcePaths must be a non-empty array.",
        }),
        targetParentPath: t.String({ minLength: 1, error: "targetParentPath cannot be empty." }),
      }),
      detail: {
        summary: "Move files or directories to a new parent path.",
        tags: ["File Manager"],
      },
    }
  )
  // POST /api/fam/upload/* - 上传文件 (writeFile)
  .post(
    "/upload/*",
    async (ctx) => {
      const { params, body, set, userContext } = ctx as FamRequestContext & {
        params: { "*": string };
        body: { files?: File | File[] };
      }; // files 字段名取决于前端 FormData

      let rawTargetDirPath = params["*"];
      let targetDirPath: string;

      if (typeof rawTargetDirPath === "string") {
        try {
          targetDirPath = decodeURIComponent(rawTargetDirPath).trim();
          if (!targetDirPath) throw new Error("Target directory path is empty after decode/trim.");
        } catch (e) {
          set.status = 400;
          return { error: "Invalid target directory path encoding." };
        }
      } else {
        set.status = 400;
        return { error: "Target directory path parameter is missing or not a string." };
      }

      // 确保目标路径是目录格式 (以 / 结尾)
      const normalizedTargetDirPath = targetDirPath.endsWith("//")
        ? targetDirPath
        : targetDirPath.replace(/\/?$/, "/");

      const filesToUpload = body.files
        ? Array.isArray(body.files)
          ? body.files
          : [body.files]
        : [];

      if (!filesToUpload || filesToUpload.length === 0) {
        set.status = 400;
        return { error: "No files provided for upload." };
      }

      const userId = getUserIdFromContext(userContext);
      const results: any[] = [];
      const errors: { name: string; message: string }[] = [];

      console.log(
        `[FileManagerRoutes] Attempting to upload ${filesToUpload.length} files to '${normalizedTargetDirPath}' for userId: ${userId}`
      );

      for (const file of filesToUpload) {
        if (!file || typeof file.name !== "string" || file.size === 0) {
          errors.push({
            name: file?.name || "unknown file",
            message: "Invalid file object received.",
          });
          continue;
        }
        const fileName = file.name; // Elysia 的 File 对象有 name 属性
        const fileLogicalPath = `${normalizedTargetDirPath}${fileName}`;
        try {
          const buffer = await file.arrayBuffer(); // 获取文件内容
          await famService.writeFile(userId, fileLogicalPath, Buffer.from(buffer), {
            encoding: "binary",
          });
          results.push({
            name: fileName,
            logicalPath: fileLogicalPath,
            size: file.size,
            itemType: "file",
          });
        } catch (error: any) {
          console.error(
            `[FileManagerRoutes] Error uploading file '${fileName}' to '${fileLogicalPath}' (userId: ${userId}):`,
            error.message
          );
          errors.push({ name: fileName, message: error.message });
        }
      }

      if (errors.length > 0) {
        if (results.length === 0) {
          set.status = 500; // Or more specific based on errors
        } else {
          set.status = 207; // Multi-Status
        }
        return {
          message: `Processed ${filesToUpload.length} files. ${results.length} uploaded, ${errors.length} failed.`,
          results,
          errors,
        };
      }
      console.log(
        `[FileManagerRoutes] Successfully uploaded ${results.length} files to '${normalizedTargetDirPath}' for userId: ${userId}`
      );
      return results; // 返回上传成功的文件信息列表
    },
    {
      // Elysia 的 t.Files() 用于期望 FormData 中多个同名文件字段
      // 如果前端用一个字段名如 'files[]' 或多个 'file1', 'file2'，则 schema 需要对应调整
      // 简单起见，假设前端发送一个名为 'files' 的字段，可以是单个文件或文件数组
      // 注意：Elysia 的 t.File() 默认处理单个文件。对于多个文件，通常在 body 中定义一个数组类型。
      // 如果 FormData 中有多个名为 'files' 的条目，Elysia 的默认解析可能只取第一个或最后一个。
      // 更稳妥的方式是让前端将所有文件放在一个名为 'files' 的数组中，或者分别命名。
      // 这里我们用 t.Any() 简化，然后在处理器中检查 body.files
      body: t.Object({
        // 咕: 此接口的 multipart/form-data 解析在某些情况下可能不稳定。
        // 对于写入 JSON 内容，请优先使用新增的 /write-json 接口。
        files: t.Any(),
      }),
      detail: {
        summary: "Upload one or more files to a target directory.",
        tags: ["File Manager"],
      },
    }
  )
  // POST /api/fam/write-json - 直接写入JSON内容
  .post(
    "/write-json",
    async (ctx) => {
      const { body, set, userContext } = ctx as FamRequestContext & { body: { logicalPath: string, content: any } };
      const { logicalPath, content } = body;
      const userId = getUserIdFromContext(userContext);

      try {
        console.log(`[FileManagerRoutes] Attempting to write JSON to '${logicalPath}' for userId: ${userId}`);
        const jsonString = JSON.stringify(content, null, 2);
        await famService.writeFile(userId, logicalPath, jsonString, { encoding: 'utf-8' });
        set.status = 204; // No Content, 成功
      } catch (error: any) {
        console.error(`[FileManagerRoutes] Error writing JSON to '${logicalPath}' (userId: ${userId}):`, error);
        if (error.message.includes("Invalid logical path") || error.message.includes("UserId is required")) {
          set.status = 400;
        } else {
          set.status = 500;
        }
        return { error: error.message };
      }
    },
    {
      body: t.Object({
        logicalPath: t.String({ minLength: 1 }),
        content: t.Any(), // 接受任何可序列化为JSON的对象
      }),
      detail: {
        summary: "Write content to a file as JSON.",
        description: "Accepts a logical path and a JSON object, writes it to the specified location.",
        tags: ["File Manager"],
      },
    }
  )
  // GET /api/fam/download/* - 下载文件
  .get(
    "/download/*",
    async (ctx) => {
      const { params, set, userContext } = ctx as FamRequestContext & { params: { "*": string } };
      let rawLogicalPath = params["*"];
      let logicalPath: string;

      if (typeof rawLogicalPath === "string") {
        try {
          logicalPath = decodeURIComponent(rawLogicalPath).trim();
          if (!logicalPath) throw new Error("File path is empty after decode/trim.");
        } catch (e) {
          set.status = 400;
          return { error: "Invalid file path encoding." };
        }
      } else {
        set.status = 400;
        return { error: "File path parameter is missing or not a string." };
      }

      const userId = getUserIdFromContext(userContext);
      console.log(
        `[FileManagerRoutes] Attempting to download file: '${logicalPath}' for userId: ${userId}`
      );

      try {
        // 检查文件是否存在以及是否是文件 (famService.readFile 内部应该会处理)
        // 但为了更明确的错误，可以先用 famService.exists 和可能的 getMetadata
        if (!(await famService.exists(userId, logicalPath))) {
          set.status = 404;
          return { error: "File not found." };
        }
        // 假设 famService.readFile 能正确处理二进制并返回 Buffer
        const fileBuffer = await famService.readFile(userId, logicalPath, "binary");

        const fileName = logicalPath.substring(logicalPath.lastIndexOf("/") + 1);

        // 推断 Content-Type，可以使用 'mime-types' 包或简单推断
        let contentType = "application/octet-stream"; // 默认
        const ext = fileName.substring(fileName.lastIndexOf(".") + 1).toLowerCase();
        if (ext === "html" || ext === "htm") contentType = "text/html";
        else if (ext === "txt") contentType = "text/plain";
        else if (ext === "json") contentType = "application/json";
        else if (ext === "png") contentType = "image/png";
        else if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
        else if (ext === "pdf") contentType = "application/pdf";
        else if (ext === "svg") contentType = "image/svg+xml";
        else if (ext === "js") contentType = "application/javascript";
        else if (ext === "css") contentType = "text/css";
        // ... 更多类型

        // 根据内容类型决定是内联显示还是作为附件下载
        const isInlineDisplay = [
          "text/html",
          "text/plain",
          "application/json",
          "image/png",
          "image/jpeg",
          "image/svg+xml",
          "application/pdf",
        ].includes(contentType);
        const disposition = isInlineDisplay ? "inline" : "attachment";

        set.headers['Content-Type'] = contentType;
        set.headers['Content-Disposition'] = `${disposition}; filename="${encodeURIComponent(fileName)}"`;
        set.headers['Content-Length'] = String(fileBuffer.length);
        set.status = 200;
        console.log(
          `[FileManagerRoutes] Successfully prepared file '${logicalPath}' for download for userId: ${userId}`
        );
        return fileBuffer; // Elysia 会自动处理 Buffer 响应
      } catch (error: any) {
        console.error(
          `[FileManagerRoutes] Error downloading file '${logicalPath}' (userId: ${userId}):`,
          error.message,
          error.stack
        );
        if (error.message.includes("not found")) {
          set.status = 404;
        } else if (
          error.message.includes("Invalid logical path") ||
          error.message.includes("UserId is required")
        ) {
          set.status = 400;
        } else {
          set.status = 500;
        }
        return { error: error.message };
      }
    },
    {
      detail: {
        summary: "Download a file.",
        tags: ["File Manager"],
      },
    }
  )
  // GET /api/fam/read/* - 读取文件内容 (用于预览，非下载)
  .get(
    "/read/*",
    async (ctx) => {
      const { params, set, userContext } = ctx as FamRequestContext & { params: { "*": string } };
      let rawLogicalPath = params["*"];
      let logicalPath: string;

      if (typeof rawLogicalPath === "string") {
        try {
          logicalPath = decodeURIComponent(rawLogicalPath).trim();
          if (!logicalPath) throw new Error("File path is empty after decode/trim.");
        } catch (e) {
          set.status = 400;
          return { error: "Invalid file path encoding." };
        }
      } else {
        set.status = 400;
        return { error: "File path parameter is missing or not a string." };
      }

      const userId = getUserIdFromContext(userContext);
      console.log(
        `[FileManagerRoutes] Attempting to read file content: '${logicalPath}' for userId: ${userId}`
      );

      try {
        // 默认以 utf-8 读取，因为这通常用于 JSON 或文本预览
        const content = await famService.readFile(userId, logicalPath, "utf-8");
        
        // 如果是 Buffer，尝试转为 string (虽然我们请求了 utf-8)
        // 如果是 JSON 字符串，直接返回。Elysia 会自动设置 Content-Type: application/json
        // 如果是普通文本，也直接返回。
        if (Buffer.isBuffer(content)) {
            return content.toString('utf-8');
        }
        // 尝试解析JSON，如果失败则作为纯文本返回
        try {
          return JSON.parse(content as string);
        } catch (e) {
          return content;
        }

      } catch (error: any) {
        // 咕: 对于 readFile，如果文件不存在，前端期望得到 null 而不是 404 错误。
        // 这同样是为了避免在加载可选配置文件（如语言包）时产生控制台错误。
        if (error.message.includes("not found")) {
          // set.status = 404; // 旧行为
          return null; // 新行为：返回 null，状态码默认为 200
        }
        
        console.error(
          `[FileManagerRoutes] Error reading file content '${logicalPath}' (userId: ${userId}):`,
          error.message
        );

        if (
          error.message.includes("Invalid logical path") ||
          error.message.includes("UserId is required")
        ) {
          set.status = 400;
        } else {
          set.status = 500;
        }
        return { error: error.message };
      }
    },
    {
      detail: {
        summary: "Read file content for preview.",
        description: "Returns the content of a file, typically as JSON or text. Returns null if not found.",
        tags: ["File Manager"],
      },
    }
  );
