import {
  CreateWorkflowObject,
  GroupInterfaceInfo,
  NodeGroupData,
  ProjectMetadata,
  ProjectMetadataSchema,
  FAMItem,
  WorkflowStorageObjectSchema,
  PanelDeclaration,
  PanelDefinition,
  PanelDefinitionSchema,
  UpdateWorkflowObject,
  WorkflowNode,
  WorkflowObject,
  WorkflowObjectSchema,
  WorkflowStorageObject,
} from "@comfytavern/types"; // + FAMItem, WorkflowStorageObjectSchema
import { basename, extname } from "node:path"; // path.join 等不再需要，由 FAMService 处理
// import { promises as fs } from "node:fs"; // FAMService 将处理文件操作
import isEqual from "lodash/isEqual";
import { z } from "zod"; // 导入 zod

import { generateSafeWorkflowFilename, sanitizeProjectId } from "../utils/helpers";
import crypto from "node:crypto";
// import { getUserDataRoot as getGlobalUserDataRoot } from '../utils/fileUtils'; // 不再直接使用
import { famService } from "./FileManagerService"; // + 导入 FAMService

// --- 用户特定路径常量和辅助函数 ---
const RECYCLE_BIN_DIR_NAME = ".recycle_bin"; // 用于构建逻辑回收站路径

// 旧的路径辅助函数已移除或将被完全替代

/**
 * 确保用户的库目录存在。
 * @param userId 用户 ID。
  export async function ensureUserLibraryDirExists(userId: string): Promise<void> {
    const logicalUserLibraryPath = `user://library/`;
    try {
      await famService.createDir(userId, logicalUserLibraryPath);
      console.log(`[Service:ensureUserLibraryDirExists] Ensured library directory exists for user ${userId} at ${logicalUserLibraryPath}`);
    } catch (error) {
      console.error(`[Service:ensureUserLibraryDirExists] Failed to ensure library directory for user ${userId} at ${logicalUserLibraryPath}. Error: ${error instanceof Error ? error.message : String(error)}`);
      throw new ProjectCreationError(`Failed to ensure user library directory for user '${userId}'.`);
    }
  }
*/

/**
 * 确保用户的核心根目录结构存在 (userData/userId, userData/userId/projects, userData/userId/library)。
 * @param userId 用户 ID。
 */
export async function ensureUserRootDirs(userId: string): Promise<void> {
  const logPrefix = `[Service:ensureUserRootDirs]`;
  // const userBaseDir = path.join(getGlobalUserDataRoot(), userId); // 使用导入的函数
  // const userProjectsDir = getUserProjectsRoot(userId); // userData/<userId>/projects
  // const userLibraryDir = getUserLibraryRoot(userId);   // userData/<userId>/library

  const userBaseLogicalPath = `user://`;
  const userProjectsLogicalPath = `user://projects/`;
  const userLibraryLogicalPath = `user://library/`;

  try {
    // FAMService.createDir 会递归创建，所以只需要确保最深层的目录
    // 但为了明确性，可以分别创建。
    // FAMService.resolvePath('user://') 应该解析到 userData/userId
    // FAMService.createDir(userId, 'user://') 应该创建 userData/userId
    await famService.createDir(userId, userBaseLogicalPath);
    await famService.createDir(userId, userProjectsLogicalPath);
    await famService.createDir(userId, userLibraryLogicalPath);

    // console.log(`${logPrefix} Ensured root directories for user ${userId} using FAMService.`);
  } catch (error) {
    console.error(
      `${logPrefix} Failed to ensure root directories for user ${userId} using FAMService. Error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    // FAMService 的 createDir 应该会抛出可识别的错误，或者我们可以包装它
    // 暂时保持与之前类似的错误抛出逻辑
    if (error instanceof ProjectCreationError) throw error; // 如果 FAMService 抛出这个，或者我们在这里包装
    throw new ProjectCreationError(
      `Failed to ensure root directories for user ${userId} via FAMService.`
    );
  }
}
// --- 结束：新增部分 ---

/**
 * 同步更新引用了特定工作流（作为 NodeGroup）的其他工作流中的接口快照。
 * 当一个工作流的接口（interfaceInputs/interfaceOutputs）发生变化时调用此函数。
 * @param userId - 用户 ID。
 * @param projectId - 包含被更新工作流的项目 ID。
 * @param updatedWorkflowId - 接口被更新的工作流的 ID。
 * @param newInterface - 被更新工作流的新接口信息。
 */
export async function syncReferencingNodeGroups(
  userId: string, // 新增 userId 参数
  projectId: string,
  updatedWorkflowId: string,
  newInterface: GroupInterfaceInfo
): Promise<void> {
  console.log(
    `Syncing NodeGroups referencing workflow ${updatedWorkflowId} in project ${projectId} for user ${userId}`
  );
  // const projectWorkflowsDir = getProjectWorkflowsDir(userId, projectId); // 使用新的函数签名
  const logicalWorkflowsDir = `user://projects/${projectId}/workflows/`;

  try {
    // 在读取目录前确保它存在，如果不存在则意味着没有工作流可同步
    const workflowsDirExists = await famService.exists(userId, logicalWorkflowsDir);
    if (!workflowsDirExists) {
      console.log(
        `[Service:syncReferencingNodeGroups] Workflows directory not found for project ${projectId}, user ${userId}. No workflows to sync. Path: ${logicalWorkflowsDir}`
      );
      return; // 目录不存在，无需继续
    }

    const dirItems: FAMItem[] = await famService.listDir(userId, logicalWorkflowsDir);
    const workflowFiles = dirItems.filter(
      (
        item: FAMItem // Explicitly type item
      ) =>
        item.itemType === "file" && // Changed from item.type
        extname(item.name).toLowerCase() === ".json" &&
        basename(item.name, ".json") !== updatedWorkflowId // 排除自身
    );

    for (const workflowItem of workflowFiles) {
      const referencingWorkflowId = basename(workflowItem.name, ".json");
      // workflowItem.path 是完整的逻辑路径，例如 user://projects/projId/workflows/wfId.json
      const logicalWorkflowPath = workflowItem.logicalPath; // Changed from workflowItem.path
      let workflowData: WorkflowObject | null = null;
      let needsSave = false;

      try {
        const fileContent = await famService.readFile(userId, logicalWorkflowPath, "utf-8");
        if (typeof fileContent !== "string") {
          console.error(
            `Error reading workflow file ${logicalWorkflowPath} as string during sync: content is Buffer.`
          );
          continue;
        }
        try {
          workflowData = JSON.parse(fileContent) as WorkflowObject;
        } catch (parseError) {
          console.error(
            `Error parsing workflow file ${logicalWorkflowPath} during sync:`,
            parseError
          );
          continue; // 跳到下一个文件
        }

        if (!workflowData || !Array.isArray(workflowData.nodes)) {
          console.warn(`Skipping invalid workflow data in ${logicalWorkflowPath} during sync.`);
          continue;
        }

        // Define the expected full type for NodeGroupNode
        const nodeGroupFullType = "core:NodeGroup";

        for (const node of workflowData.nodes as WorkflowNode[]) {
          // Use the full type string for comparison
          if (node.type === nodeGroupFullType && node.data && typeof node.data === "object") {
            const nodeGroupData = node.data as NodeGroupData;
            if (nodeGroupData.referencedWorkflowId === updatedWorkflowId) {
              const currentInterface = nodeGroupData.groupInterface || { inputs: {}, outputs: {} };
              const currentInputs = currentInterface.inputs || {};
              const currentOutputs = currentInterface.outputs || {};
              const newInputs = newInterface.inputs || {};
              const newOutputs = newInterface.outputs || {};

              if (!isEqual(currentInputs, newInputs) || !isEqual(currentOutputs, newOutputs)) {
                console.log(
                  `Updating interface snapshot for NodeGroup ${node.id} in workflow ${referencingWorkflowId}`
                );
                nodeGroupData.groupInterface = { inputs: newInputs, outputs: newOutputs };
                needsSave = true;
              }
            }
          }
        }

        if (needsSave && workflowData) {
          workflowData.updatedAt = new Date().toISOString();
          await famService.writeFile(
            userId,
            logicalWorkflowPath,
            JSON.stringify(workflowData, null, 2)
          );
          console.log(
            `Saved updated workflow ${referencingWorkflowId} with synced NodeGroup interface.`
          );
        }
      } catch (readWriteError) {
        console.error(
          `Error processing workflow file ${logicalWorkflowPath} during sync:`,
          readWriteError
        );
      }
    }
  } catch (error) {
    // FAMService 操作的错误应该由其自身处理或抛出特定错误
    // 此处的 ENOENT 检查可能不再直接适用，取决于 FAMService 的错误类型
    console.error(
      `Error listing/processing workflows in project ${projectId} during sync using FAMService:`,
      error
    );
    // 记录错误，但不影响主流程（例如，更新操作本身不应失败）
  }
}

// 内部辅助函数：读取并验证 JSON 文件
interface ReadAndValidateJsonOptions<T> {
  // filePath: string; // 确保此行被注释掉或删除
  schema: z.ZodType<T, z.ZodTypeDef, any>; // 允许输入类型与输出类型 T 不同
  notFoundErrorClass: new (message: string) => Error;
  loadErrorClass: new (message: string) => Error;
  entityName?: string;
  entityId?: string; // 用于更详细的日志/错误消息
}

async function _readAndValidateJsonFile<T>({
  userId,
  logicalPath,
  schema,
  notFoundErrorClass,
  loadErrorClass,
  entityName = "data",
  entityId = "",
}: ReadAndValidateJsonOptions<T> & { userId: string | null; logicalPath: string }): Promise<T> {
  const logPrefix = `[Service:_readAndValidateJsonFile]`;
  const descriptiveEntityName = entityId ? `${entityName} '${entityId}'` : entityName;
  const capitalizedEntityName =
    descriptiveEntityName.charAt(0).toUpperCase() + descriptiveEntityName.slice(1);

  let fileContentBuffer: string | Buffer;
  try {
    fileContentBuffer = await famService.readFile(userId, logicalPath, "utf-8");
    if (typeof fileContentBuffer !== "string") {
      const message = `Failed to read ${descriptiveEntityName} file as string. Path: ${logicalPath}. Content was a Buffer.`;
      console.error(`${logPrefix} ${message}`);
      throw new loadErrorClass(message);
    }
  } catch (error: any) {
    // FAMService.readFile 应该会抛出类似 ENOENT 的错误，或者我们可以根据其错误类型调整
    // 假设 FAMService.readFile 在文件不存在时会抛出错误，其 message 包含 "not found"
    if (error.message && error.message.toLowerCase().includes("not found")) {
      const message = `${capitalizedEntityName} file not found. Logical Path: ${logicalPath}`;
      console.warn(`${logPrefix} ${message}`);
      throw new notFoundErrorClass(message);
    }
    const message = `Failed to read ${descriptiveEntityName} file. Logical Path: ${logicalPath}. Error: ${error.message}`;
    console.error(`${logPrefix} ${message}`);
    throw new loadErrorClass(message);
  }
  const fileContent = fileContentBuffer as string; // 已在上一步检查

  let jsonData: any;
  try {
    jsonData = JSON.parse(fileContent);
  } catch (error: any) {
    const message = `Failed to parse JSON for ${descriptiveEntityName}. Logical Path: ${logicalPath}. Error: ${error.message}`;
    console.error(`${logPrefix} ${message}`);
    throw new loadErrorClass(message);
  }

  const validationResult = schema.safeParse(jsonData);
  if (!validationResult.success) {
    const errorDetails = validationResult.error.flatten().fieldErrors;
    const message = `${capitalizedEntityName} validation failed. Logical Path: ${logicalPath}. Details: ${JSON.stringify(
      errorDetails
    )}`;
    console.error(`${logPrefix} ${message}`);
    throw new loadErrorClass(message);
  }
  return validationResult.data;
}

// _ensureDirectoryExists 和 _checkFileConflict 已被移除，其功能由 FAMService 提供

// 定义可更新的元数据字段的 Schema
// 允许部分更新，但排除 id 和 createdAt
const ProjectMetadataUpdateSchema = ProjectMetadataSchema.partial().omit({
  id: true,
  createdAt: true,
});
type ProjectMetadataUpdate = z.infer<typeof ProjectMetadataUpdateSchema>;

/**
 * 更新指定项目的元数据文件 (project.json)。
 * @param projectId - 项目 ID (应已清理)。
 * @param updateData - 要更新的元数据字段 (应符合 ProjectMetadataUpdateSchema)。
 * @returns 更新后的完整项目元数据。
 * @throws 如果项目或元数据文件不存在，或发生读写/解析错误。
 */
export async function updateProjectMetadata(
  userId: string, // 新增 userId 参数
  projectId: string,
  updateData: ProjectMetadataUpdate
): Promise<ProjectMetadata> {
  await ensureUserRootDirs(userId); // 确保用户根目录存在
  console.log(`Updating metadata for project ${projectId} for user ${userId}`);
  const logicalMetadataPath = `user://projects/${projectId}/project.json`;

  try {
    // 1. 读取现有元数据
    let existingMetadata: ProjectMetadata;
    try {
      // 使用 _readAndValidateJsonFile (调整后)
      existingMetadata = await _readAndValidateJsonFile<ProjectMetadata>({
        userId,
        logicalPath: logicalMetadataPath,
        schema: ProjectMetadataSchema,
        notFoundErrorClass: ProjectNotFoundError,
        loadErrorClass: ProjectMetadataError,
        entityName: "project metadata",
        entityId: `${userId}/${projectId}`,
      });
    } catch (readError: any) {
      // _readAndValidateJsonFile 内部会处理 ENOENT 并抛出 ProjectNotFoundError
      // 其他读取或解析错误会抛出 ProjectMetadataError
      // 所以这里可以直接重新抛出，或者根据需要进一步包装
      console.error(
        `[Service:updateProjectMetadata] Error reading existing metadata for project '${projectId}', user '${userId}': ${readError.message}`
      );
      throw readError; // 重新抛出由 _readAndValidateJsonFile 抛出的错误
    }

    // 2. 合并更新并设置 updatedAt
    const now = new Date().toISOString();
    const updatedMetadata: ProjectMetadata = {
      ...existingMetadata,
      ...updateData, // 应用传入的更新
      updatedAt: now, // 强制更新 updatedAt 字段
      id: existingMetadata.id, // 确保 id 和 createdAt 不被覆盖
      createdAt: existingMetadata.createdAt,
    };

    // 3. 验证最终的元数据对象
    const finalValidation = ProjectMetadataSchema.safeParse(updatedMetadata);
    if (!finalValidation.success) {
      const errorDetails = finalValidation.error.flatten().fieldErrors;
      const message = `Internal error: Updated metadata for project ID '${projectId}' for user '${userId}' failed validation. Details: ${JSON.stringify(
        errorDetails
      )}`;
      console.error(`[Service:updateProjectMetadata] ${message}`);
      throw new ProjectMetadataError(message);
    }

    // 4. 写回文件
    try {
      await famService.writeFile(
        userId,
        logicalMetadataPath,
        JSON.stringify(finalValidation.data, null, 2)
      );
    } catch (writeError: any) {
      const message = `Failed to write updated metadata for project ID '${projectId}' for user '${userId}'. Logical Path: ${logicalMetadataPath}. Error: ${writeError.message}`;
      console.error(`[Service:updateProjectMetadata] ${message}`);
      throw new ProjectMetadataError(message);
    }

    console.log(
      `[Service:updateProjectMetadata] Project metadata for user '${userId}' updated successfully: ${logicalMetadataPath}`
    );
    return finalValidation.data;
  } catch (error) {
    if (error instanceof ProjectNotFoundError || error instanceof ProjectMetadataError) {
      throw error;
    }
    const message = `Unexpected error updating project metadata for ID '${projectId}' for user '${userId}'. Error: ${
      error instanceof Error ? error.message : String(error)
    }`;
    console.error(`[Service:updateProjectMetadata] ${message}`);
    throw new ProjectMetadataError(message);
  }
}

// 定义 listProjects 返回的单个项目类型
// interface ListedProject { // 不再使用此接口，直接返回 ProjectMetadata[]
//   id: string;
//   name: string;
// }

/**
 * 列出指定用户的所有项目。
 * @param userId - 用户 ID。
 * @returns Promise<ProjectMetadata[]> 项目元数据列表。
 * @throws 如果发生严重的文件系统错误。
 */
export async function listProjects(userId: string): Promise<ProjectMetadata[]> {
  await ensureUserRootDirs(userId); // 确保用户根目录存在
  const logicalUserProjectsRoot = `user://projects/`; // 正确的逻辑路径，列出此目录下的项目
  console.log(
    `[Service:listProjects] Listing all projects for user ${userId} from: ${logicalUserProjectsRoot}`
  );
  try {
    // 确保 user://projects/ 目录本身存在，如果不存在，则表示没有项目
    const projectsRootDirExists = await famService.exists(userId, logicalUserProjectsRoot);
    if (!projectsRootDirExists) {
      console.log(
        `[Service:listProjects] User projects root directory ${logicalUserProjectsRoot} does not exist for user ${userId}. Returning empty list.`
      );
      return [];
    }

    const dirItems: FAMItem[] = await famService.listDir(userId, logicalUserProjectsRoot);
    const projectDirs = dirItems.filter(
      (item: FAMItem) => item.itemType === "directory" && item.name !== RECYCLE_BIN_DIR_NAME // Changed from item.type
    );

    const projectsPromises = projectDirs.map(async (dirItem): Promise<ProjectMetadata | null> => {
      const projectIdFromName = dirItem.name;
      const safeReadProjectId = sanitizeProjectId(projectIdFromName);
      if (!safeReadProjectId) {
        console.warn(
          `[Service:listProjects] Skipping potentially invalid project directory name for user ${userId}: ${projectIdFromName}`
        );
        return null;
      }
      const logicalMetadataPath = `user://projects/${safeReadProjectId}/project.json`;

      try {
        const validatedMetadata = await _readAndValidateJsonFile<ProjectMetadata>({
          userId,
          logicalPath: logicalMetadataPath,
          schema: ProjectMetadataSchema,
          notFoundErrorClass: ProjectNotFoundError,
          loadErrorClass: ProjectMetadataError,
          entityName: "project metadata",
          entityId: `${userId}/${safeReadProjectId}`,
        });

        if (validatedMetadata.id !== safeReadProjectId) {
          console.warn(
            `[Service:listProjects] Metadata ID '${validatedMetadata.id}' for project in directory '${safeReadProjectId}' for user '${userId}' does not match directory name. Using directory name as ID.`
          );
        }
        return { ...validatedMetadata, id: safeReadProjectId };
      } catch (error: any) {
        console.warn(
          `[Service:listProjects] Error processing metadata for project ${safeReadProjectId} (user: ${userId}, logicalPath: ${logicalMetadataPath}): ${error.message}. Skipping this project.`
        );
        return null;
      }
    });

    const resolvedProjects = await Promise.all(projectsPromises);
    const validProjects = resolvedProjects.filter((p): p is ProjectMetadata => p !== null);
    console.log(
      `[Service:listProjects] Found ${validProjects.length} valid projects for user ${userId}.`
    );
    return validProjects;
  } catch (error: any) {
    console.error(`[Service:listProjects] Error listing projects for user ${userId}:`, error);
    throw new Error(`Failed to list projects for user ${userId}: ${error.message}`);
  }
}

/**
 * 定义创建项目时服务层函数可能抛出的特定错误类型
 */
export class ProjectConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectConflictError";
  }
}

export class ProjectCreationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectCreationError";
  }
}

/**
 * 定义项目未找到的特定错误类型
 */
export class ProjectNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectNotFoundError";
  }
}

/**
 * 定义项目元数据处理相关的特定错误类型
 */
export class ProjectMetadataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectMetadataError";
  }
}

export class PanelNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PanelNotFoundError";
  }
}

export class PanelLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PanelLoadError";
  }
}

export class PanelConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PanelConflictError";
  }
}

export class PanelCreationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PanelCreationError";
  }
}

/**
 * 获取指定用户项目的元数据。
 * @param userId - 用户 ID。
 * @param projectId 清理后的项目 ID。
 * @returns Promise<ProjectMetadata> 项目的元数据。
 * @throws 如果项目目录或元数据文件不存在 (ProjectNotFoundError)，或发生读写/解析错误 (ProjectMetadataError)。
 */
export async function getProjectMetadata(
  userId: string,
  projectId: string
): Promise<ProjectMetadata> {
  await ensureUserRootDirs(userId); // 确保用户根目录存在
  const logPrefix = `[Service:getProjectMetadata]`;
  console.log(
    `${logPrefix} Attempting to get metadata for project ID '${projectId}' for user '${userId}'`
  );
  const logicalMetadataPath = `user://projects/${projectId}/project.json`;

  const metadata = await _readAndValidateJsonFile<ProjectMetadata>({
    userId,
    logicalPath: logicalMetadataPath,
    schema: ProjectMetadataSchema,
    notFoundErrorClass: ProjectNotFoundError,
    loadErrorClass: ProjectMetadataError,
    entityName: "project metadata",
    entityId: `${userId}/${projectId}`,
  });

  console.log(
    `${logPrefix} Successfully retrieved and validated metadata for project ID '${projectId}' for user '${userId}'.`
  );
  return metadata;
}

/**
 * 为指定用户创建一个新项目。
 * @param userId - 用户 ID。
 * @param projectId 清理后的项目 ID。
 * @param projectName 原始项目名称。
 * @param appVersion 当前应用版本。
 * @returns Promise<ProjectMetadata> 创建的项目元数据。
 * @throws 如果项目已存在 (ProjectConflictError)，或发生其他创建错误 (ProjectCreationError)。
 */
export async function createProject(
  userId: string, // 新增 userId 参数
  projectId: string,
  projectName: string,
  appVersion: string
): Promise<ProjectMetadata> {
  console.log(
    `[Service:createProject] Attempting to create project '${projectName}' (ID: '${projectId}') for user '${userId}'`
  );
  const logicalProjectPath = `user://projects/${projectId}/`;
  const logicalProjectWorkflowsDir = `user://projects/${projectId}/workflows/`;
  const logicalMetadataPath = `user://projects/${projectId}/project.json`;

  try {
    // 1. 检查项目是否已存在
    const projectExists = await famService.exists(userId, logicalProjectPath);
    if (projectExists) {
      throw new ProjectConflictError(
        `Project with ID '${projectId}' (derived from name '${projectName}') already exists for user '${userId}'.`
      );
    }

    // 2. 创建项目目录和 workflows 子目录
    // FAMService.createDir 会递归创建，所以创建最深的 workflows 目录即可
    await famService.createDir(userId, logicalProjectWorkflowsDir);
    console.log(
      `[Service:createProject] Ensured project workflows directory exists: ${logicalProjectWorkflowsDir} for user ${userId}`
    );

    // 3. 创建 project.json 元数据文件
    const now = new Date().toISOString();
    const projectMetadata: ProjectMetadata = {
      id: projectId,
      name: projectName,
      createdAt: now,
      updatedAt: now,
      version: appVersion,
      description: `Project created on ${now}`,
      preferredView: "editor",
      schemaVersion: appVersion, // schemaVersion 通常在创建时固定
    };

    // 验证元数据
    const metadataValidation = ProjectMetadataSchema.safeParse(projectMetadata);
    if (!metadataValidation.success) {
      const errorDetails = metadataValidation.error.flatten().fieldErrors;
      console.error(
        `[Service:createProject] Generated project metadata validation failed for user '${userId}', project '${projectId}':`,
        errorDetails
      );
      try {
        await famService.delete(userId, logicalProjectPath, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error(
          `[Service:createProject] Failed to cleanup partially created project directory ${logicalProjectPath} for user '${userId}' after metadata validation error:`,
          cleanupError
        );
      }
      throw new ProjectCreationError("Internal error: Generated project metadata is invalid.");
    }

    // 4. 写入元数据文件
    try {
      await famService.writeFile(
        userId,
        logicalMetadataPath,
        JSON.stringify(metadataValidation.data, null, 2)
      );
      console.log(
        `[Service:createProject] Created project metadata file for user '${userId}': ${logicalMetadataPath}`
      );
    } catch (writeError: any) {
      console.error(
        `[Service:createProject] Error writing metadata file for ID '${projectId}' for user '${userId}':`,
        writeError
      );
      try {
        await famService.delete(userId, logicalProjectPath, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error(
          `[Service:createProject] Failed to cleanup partially created project directory ${logicalProjectPath} for user '${userId}' after write error:`,
          cleanupError
        );
      }
      throw new ProjectCreationError(
        `Failed to write project metadata file: ${writeError.message}`
      );
    }

    // 5. 验证文件是否真的创建成功 (可选，但良好实践)
    const metadataFileExists = await famService.exists(userId, logicalMetadataPath);
    if (!metadataFileExists) {
      const verifyErrorMsg = `Failed to verify project metadata file existence after write for ID '${projectId}' for user '${userId}'. Path: ${logicalMetadataPath}`;
      console.error(`[Service:createProject] ${verifyErrorMsg}`);
      throw new ProjectCreationError(verifyErrorMsg);
    }
    console.log(
      `[Service:createProject] Successfully verified metadata file existence for user '${userId}': ${logicalMetadataPath}`
    );
    return metadataValidation.data;
  } catch (error: any) {
    if (error instanceof ProjectConflictError || error instanceof ProjectCreationError) {
      throw error;
    }
    console.error(
      `[Service:createProject] Unexpected error creating project '${projectName}' (ID: ${projectId}) for user '${userId}':`,
      error
    );
    throw new ProjectCreationError(
      `Unexpected error occurred during project creation: ${error.message}`
    );
  }
}

// 定义 listWorkflows 返回的单个工作流项目类型
// 定义 listWorkflows 返回的单个工作流项目类型
interface ListedWorkflow {
  id: string;
  name: string;
  description?: string;
  updatedAt?: string; // 添加 updatedAt
  creationMethod?: string;
  referencedWorkflows?: string[];
}

/**
 * 列出指定用户项目内的所有工作流。
 * @param userId - 用户 ID。
 * @param projectId 清理后的项目 ID。
 * @returns Promise<ListedWorkflow[]> 工作流列表。
 * @throws 如果发生无法处理的文件系统错误。
 */
export async function listWorkflows(userId: string, projectId: string): Promise<ListedWorkflow[]> {
  await ensureUserRootDirs(userId);
  console.log(
    `[Service:listWorkflows] Listing workflows for project ID '${projectId}' for user '${userId}'`
  );
  const logicalProjectWorkflowsDir = `user://projects/${projectId}/workflows/`;

  try {
    const dirExists = await famService.exists(userId, logicalProjectWorkflowsDir);
    if (!dirExists) {
      await famService.createDir(userId, logicalProjectWorkflowsDir);
      return [];
    }

    const dirItems = await famService.listDir(userId, logicalProjectWorkflowsDir);
    const workflowFileItems = dirItems.filter(
      (item) => item.itemType === "file" && extname(item.name).toLowerCase() === ".json"
    );

    const workflowsPromises = workflowFileItems.map(
      async (item): Promise<ListedWorkflow | null> => {
        const logicalWorkflowPath = item.logicalPath;
        try {
          const fileContent = await famService.readFile(userId, logicalWorkflowPath, "utf-8");
          if (typeof fileContent !== "string") {
            console.error(
              `[Service:listWorkflows] Failed to read workflow file ${logicalWorkflowPath} as string for user ${userId}.`
            );
            return null;
          }
          const workflowData: Partial<WorkflowObject> = JSON.parse(fileContent);

          // **核心**: ID 来自文件内容，而不是文件名
          const id = workflowData.id;
          const name = workflowData.name;

          if (!id || !name) {
            console.warn(
              `[Service:listWorkflows] Skipping file ${item.name} because it lacks a valid 'id' or 'name' property.`
            );
            return null;
          }

          return {
            id,
            name,
            description: workflowData.description,
            updatedAt: workflowData.updatedAt, // 添加 updatedAt
            creationMethod: workflowData.creationMethod,
            referencedWorkflows: workflowData.referencedWorkflows,
          };
        } catch (readError: any) {
          console.error(
            `[Service:listWorkflows] Error reading/parsing workflow file ${logicalWorkflowPath} for listing:`,
            readError.message
          );
          return null;
        }
      }
    );

    const resolvedWorkflows = (await Promise.all(workflowsPromises)).filter(
      (w): w is ListedWorkflow => w !== null
    );
    console.log(
      `[Service:listWorkflows] Found ${resolvedWorkflows.length} valid workflows for project ID '${projectId}'.`
    );
    return resolvedWorkflows;
  } catch (error: any) {
    console.error(
      `[Service:listWorkflows] Error listing workflows for project ID '${projectId}' for user '${userId}':`,
      error
    );
    throw new Error(
      `Failed to list workflows for project ${projectId}, user ${userId}: ${error.message}`
    );
  }
}
/**
 * 定义工作流已存在的特定错误类型
 */
export class WorkflowConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowConflictError";
  }
}

/**
 * 定义工作流创建失败的特定错误类型
 */
export class WorkflowCreationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowCreationError";
  }
}

/**
 * 在指定用户项目中创建新的工作流文件。
 * @param userId - 用户 ID。
 * @param projectId 清理后的项目 ID。
 * @param workflowInputData 经过 Zod 验证的创建工作流所需的数据 (来自 CreateWorkflowObjectSchema)。
 * @param appVersion 当前应用版本。
 * @returns Promise<WorkflowObject> 创建的完整工作流对象 (包含 id 和元数据)。
 * @throws 如果工作流已存在 (WorkflowConflictError)，或发生其他创建错误 (WorkflowCreationError)。
 */
export async function createWorkflow(
  userId: string, // 新增 userId 参数
  projectId: string,
  workflowInputData: CreateWorkflowObject,
  appVersion: string
): Promise<WorkflowObject> {
  const {
    id: frontendId,
    name,
    nodes,
    edges,
    viewport,
    interfaceInputs,
    interfaceOutputs,
    referencedWorkflows,
  } = workflowInputData;

  // 优先使用前端传入的 ID，否则生成一个新的 UUID。这确保了 ID 的唯一性和持久性。
  const workflowId = frontendId || crypto.randomUUID();
  // 文件名仍然基于用户提供的名称，以保证可读性。
  const workflowFilename = generateSafeWorkflowFilename(name);

  console.log(
    `[Service:createWorkflow] Attempting to create workflow '${name}' (ID: ${workflowId}, Filename: ${workflowFilename}) in project '${projectId}' for user '${userId}'`
  );
  const logicalProjectWorkflowsDir = `user://projects/${projectId}/workflows/`;
  // 文件路径基于可读的文件名
  const logicalFilePath = `user://projects/${projectId}/workflows/${workflowFilename}.json`;

  try {
    // 1. 确保工作流目录存在
    await famService.createDir(userId, logicalProjectWorkflowsDir);

    // 2. 检查工作流文件是否已存在
    const workflowExists = await famService.exists(userId, logicalFilePath);
    if (workflowExists) {
      throw new WorkflowConflictError(
        `Workflow with name '${name}' (filename: ${workflowId}.json) already exists in project '${projectId}' for user '${userId}'.`
      );
    }

    // 3. 准备要保存的数据
    const now = new Date().toISOString();

    // 首先创建一个符合 WorkflowStorageObjectSchema 的对象
    const storageData = WorkflowStorageObjectSchema.parse({
      name,
      nodes: nodes || [],
      edges: edges || [], // Zod schema 会处理 null/undefined handles，无需手动 map
      viewport: viewport || { x: 0, y: 0, zoom: 1 },
      interfaceInputs: interfaceInputs || {},
      interfaceOutputs: interfaceOutputs || {},
      referencedWorkflows: referencedWorkflows || [],
    });

    const dataToSave: WorkflowObject = {
      id: workflowId, // **核心**: 内部 ID 使用持久化的 UUID
      ...storageData,
      name: name, // 显式使用来自 workflowInputData 的 name，确保类型为 string
      // workflowInputData.viewport 是 WorkflowViewport 类型 (来自 CreateWorkflowObjectSchema -> BaseWorkflowObjectSchema)
      // storageData.viewport 也被赋予了 workflowInputData.viewport || 默认值，所以它也是 WorkflowViewport 类型
      // 直接使用 workflowInputData.viewport 可以更明确地保证类型正确性
      viewport: workflowInputData.viewport, // 使用来自输入数据的 viewport
      createdAt: now,
      updatedAt: now,
      version: appVersion,
      // description is not part of CreateWorkflowObject for new workflows
    };

    // 验证最终数据是否符合 WorkflowObjectSchema (可选，但良好实践)
    // 注意：WorkflowObjectSchema 可能比 CreateWorkflowObjectSchema 更严格或包含更多字段
    const validationResult = WorkflowObjectSchema.safeParse(dataToSave);
    if (!validationResult.success) {
      const errorDetails = validationResult.error.flatten().fieldErrors;
      const message = `Internal error: Generated workflow data for '${name}' (ID: ${workflowId}) for user '${userId}', project '${projectId}' is invalid. Details: ${JSON.stringify(
        errorDetails
      )}`;
      console.error(`[Service:createWorkflow] ${message}`);
      throw new WorkflowCreationError(message);
    }

    // 4. 写入工作流文件
    try {
      await famService.writeFile(
        userId,
        logicalFilePath,
        JSON.stringify(validationResult.data, null, 2)
      );
      console.log(
        `[Service:createWorkflow] Workflow file created for user '${userId}': ${logicalFilePath}`
      );
    } catch (writeError: any) {
      const message = `Failed to write workflow file for '${name}' (ID: ${workflowId}) in project '${projectId}' for user '${userId}'. Error: ${writeError.message}`;
      console.error(`[Service:createWorkflow] ${message}`);
      throw new WorkflowCreationError(message);
    }

    // 创建工作流成功后，更新项目的 updatedAt 元数据
    try {
      await updateProjectMetadata(userId, projectId, {}); // 传递 userId
    } catch (metaError) {
      console.warn(
        `[Service:createWorkflow] Failed to update project metadata for '${projectId}', user '${userId}' after workflow creation:`,
        metaError
      );
    }

    return validationResult.data;
  } catch (error: any) {
    if (error instanceof WorkflowConflictError || error instanceof WorkflowCreationError) {
      throw error;
    }
    const message = `Unexpected error creating workflow '${name}' (ID: ${workflowId}) in project '${projectId}' for user '${userId}'. Error: ${error.message}`;
    console.error(`[Service:createWorkflow] ${message}`);
    throw new WorkflowCreationError(message);
  }
}

/**
 * 定义工作流未找到的特定错误类型
 */
export class WorkflowNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowNotFoundError";
  }
}

/**
 * 定义工作流加载或解析失败的特定错误类型
 */
export class WorkflowLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowLoadError";
  }
}

/**
 * 获取指定用户项目中的特定工作流。
 * @param userId - 用户 ID。
 * @param projectId 清理后的项目 ID。
 * @param workflowId 清理后的工作流 ID (文件名，不含扩展名)。
 * @returns Promise<WorkflowObject> 工作流对象。
 * @throws 如果工作流文件不存在 (WorkflowNotFoundError)，或读取/解析/验证失败 (WorkflowLoadError)。
 */
/**
 * [NEW] 内部辅助函数：通过其持久化的 UUID 在项目中查找工作流文件。
 * @param userId - 用户 ID。
 * @param projectId - 项目 ID。
 * @param workflowId - 要查找的工作流的持久化 UUID。
 * @returns Promise<FAMItem> 找到的工作流文件的 FAMItem。
 * @throws 如果找不到工作流 (WorkflowNotFoundError) 或发生文件系统错误。
 */
async function _findWorkflowFileById(
  userId: string,
  projectId: string,
  workflowId: string
): Promise<FAMItem> {
  const logPrefix = `[Service:_findWorkflowFileById]`;
  const logicalWorkflowsDir = `user://projects/${projectId}/workflows/`;

  const dirExists = await famService.exists(userId, logicalWorkflowsDir);
  if (!dirExists) {
    throw new WorkflowNotFoundError(`Workflow directory for project '${projectId}' not found.`);
  }

  const dirItems = await famService.listDir(userId, logicalWorkflowsDir);
  const workflowFiles = dirItems.filter(
    (item) => item.itemType === "file" && extname(item.name).toLowerCase() === ".json"
  );

  for (const fileItem of workflowFiles) {
    try {
      const content = await famService.readFile(userId, fileItem.logicalPath, "utf-8");
      if (typeof content === "string") {
        const data = JSON.parse(content);
        if (data.id === workflowId) {
          console.log(
            `${logPrefix} Found workflow with ID '${workflowId}' in file '${fileItem.name}'.`
          );
          return fileItem;
        }
      }
    } catch (e) {
      console.warn(
        `${logPrefix} Skipping file '${fileItem.name}' in project '${projectId}' due to read/parse error:`,
        e
      );
    }
  }

  throw new WorkflowNotFoundError(
    `Workflow with ID '${workflowId}' not found in project '${projectId}'.`
  );
}

export async function getWorkflow(
  userId: string,
  projectId: string,
  workflowId: string
): Promise<WorkflowObject> {
  await ensureUserRootDirs(userId);
  const logPrefix = `[Service:getWorkflow]`;
  console.log(
    `${logPrefix} Attempting to get workflow ID '${workflowId}' from project '${projectId}' for user '${userId}'`
  );

  // 使用新的查找函数通过 UUID 找到文件
  const workflowFileItem = await _findWorkflowFileById(userId, projectId, workflowId);
  const logicalFilePath = workflowFileItem.logicalPath;

  const validatedData = await _readAndValidateJsonFile<WorkflowObject>({
    userId,
    logicalPath: logicalFilePath,
    schema: WorkflowObjectSchema,
    notFoundErrorClass: WorkflowNotFoundError, // 虽然 _findWorkflowFileById 已处理，但作为双重保险
    loadErrorClass: WorkflowLoadError,
    entityName: "workflow",
    entityId: `${userId}/${projectId}/${workflowId}`,
  });

  // 确保返回的 ID 是持久化的 UUID，而不是可能与文件名不同的内部 ID。
  const workflowWithEnsuredId = { ...validatedData, id: workflowId };

  if (validatedData.id && validatedData.id !== workflowId) {
    console.warn(
      `${logPrefix} Workflow ID in file ('${validatedData.id}') differs from requested ID ('${workflowId}') for project '${projectId}', user '${userId}'. Using requested ID.`
    );
  }

  console.log(
    `${logPrefix} Successfully retrieved and validated workflow '${workflowId}' from project '${projectId}'.`
  );
  return workflowWithEnsuredId;
}

/**
 * 定义工作流更新失败的特定错误类型
 */
export class WorkflowUpdateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowUpdateError";
  }
}

/**
 * 更新指定用户项目中的特定工作流。
 * @param userId - 用户 ID。
 * @param projectId 清理后的项目 ID。
 * @param workflowId 当前工作流的 ID (文件名，不含扩展名)。
 * @param workflowUpdateData 经过 Zod 验证的更新工作流所需的数据。
 * @param appVersion 当前应用版本。
 * @returns Promise<WorkflowObject> 更新后的完整工作流对象。
 * @throws 如果工作流不存在 (WorkflowNotFoundError)，新名称冲突 (WorkflowConflictError)，或更新失败 (WorkflowUpdateError)。
 */
export async function updateWorkflow(
  userId: string,
  projectId: string,
  workflowId: string, // 这是持久化的 UUID
  workflowUpdateData: UpdateWorkflowObject,
  appVersion: string
): Promise<WorkflowObject> {
  await ensureUserRootDirs(userId);
  console.log(
    `[Service:updateWorkflow] Attempting to update workflow ID '${workflowId}' in project '${projectId}' for user '${userId}'`
  );

  // 1. 通过持久化 ID 找到当前文件
  const currentFileItem = await _findWorkflowFileById(userId, projectId, workflowId);
  const logicalCurrentFilePath = currentFileItem.logicalPath;
  const currentFilename = currentFileItem.name;

  // 2. 准备新数据
  const newName = workflowUpdateData.name;
  const newFilename = `${generateSafeWorkflowFilename(newName)}.json`;
  const logicalNewFilePath = `user://projects/${projectId}/workflows/${newFilename}`;
  const isRenaming = newFilename !== currentFilename;

  try {
    // 3. 如果需要重命名，检查新文件名是否冲突
    if (isRenaming) {
      const newPathExists = await famService.exists(userId, logicalNewFilePath);
      if (newPathExists) {
        throw new WorkflowConflictError(
          `Cannot rename workflow. A workflow with the name '${newName}' (filename: ${newFilename}) already exists in project '${projectId}'.`
        );
      }
    }

    // 4. 读取现有数据以保留 createdAt 等元数据
    const existingData: Partial<WorkflowObject> = JSON.parse(
      (await famService.readFile(userId, logicalCurrentFilePath, "utf-8")) as string
    );

    // 5. 准备要保存的完整数据对象
    const now = new Date().toISOString();
    const dataToSave: WorkflowObject = {
      ...existingData, // 保留已有字段
      ...workflowUpdateData, // 应用更新
      id: workflowId, // **核心**: 确保 ID 始终是持久化的 UUID
      name: newName,
      updatedAt: now,
      version: appVersion,
      createdAt: existingData.createdAt || now, // 保留原始创建时间
    };

    const validationResult = WorkflowObjectSchema.safeParse(dataToSave);
    if (!validationResult.success) {
      const errorDetails = validationResult.error.flatten().fieldErrors;
      const message = `Internal error: Updated workflow data for '${newName}' (ID: ${workflowId}) is invalid. Details: ${JSON.stringify(
        errorDetails
      )}`;
      throw new WorkflowUpdateError(message);
    }
    const validatedDataToSave = validationResult.data;

    // 6. 写入文件（如果是重命名，则写入新路径）
    await famService.writeFile(
      userId,
      logicalNewFilePath, // 总是写入新路径（如果未重命名，则与旧路径相同）
      JSON.stringify(validatedDataToSave, null, 2)
    );
    console.log(
      `[Service:updateWorkflow] Workflow file saved for user '${userId}': ${logicalNewFilePath}`
    );

    // 7. 如果是重命名，删除旧文件
    if (isRenaming) {
      await famService.delete(userId, logicalCurrentFilePath);
      console.log(
        `[Service:updateWorkflow] Old workflow file deleted for user '${userId}': ${logicalCurrentFilePath}`
      );
    }

    // 8. 后续操作
    const newInterface: GroupInterfaceInfo = {
      inputs: validatedDataToSave.interfaceInputs || {},
      outputs: validatedDataToSave.interfaceOutputs || {},
    };

    // 注意：syncReferencingNodeGroups 应该使用持久化 ID
    syncReferencingNodeGroups(userId, projectId, workflowId, newInterface).catch((syncError) => {
      console.error(
        `[Service:updateWorkflow] Error during background NodeGroup sync for ${workflowId} in project ${projectId}:`,
        syncError
      );
    });

    await updateProjectMetadata(userId, projectId, {});

    return validatedDataToSave;
  } catch (error: any) {
    if (
      error instanceof WorkflowNotFoundError ||
      error instanceof WorkflowConflictError ||
      error instanceof WorkflowUpdateError
    ) {
      throw error;
    }
    const message = `Unexpected error updating workflow '${workflowId}' in project '${projectId}' for user '${userId}'. Error: ${error.message}`;
    console.error(`[Service:updateWorkflow] ${message}`);
    throw new WorkflowUpdateError(message);
  }
}

/**
 * 定义工作流删除失败的特定错误类型
 */
export class WorkflowDeletionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowDeletionError";
  }
}

/**
 * 将指定用户项目中的特定工作流移动到回收站。
 * @param userId - 用户 ID。
 * @param projectId 清理后的项目 ID。
 * @param workflowId 清理后的工作流 ID (文件名，不含扩展名)。
 * @returns Promise<void> 操作成功则无返回。
 * @throws 如果工作流文件不存在 (WorkflowNotFoundError)，或移动操作失败 (WorkflowDeletionError)。
 */
export async function deleteWorkflowToRecycleBin(
  userId: string,
  projectId: string,
  workflowId: string // 这是持久化的 UUID
): Promise<void> {
  console.log(
    `[Service:deleteWorkflowToRecycleBin] Attempting to delete workflow ID '${workflowId}' in project '${projectId}' for user '${userId}'.`
  );

  try {
    // 1. 通过持久化 ID 找到文件
    const fileToDelete = await _findWorkflowFileById(userId, projectId, workflowId);
    const logicalFilePath = fileToDelete.logicalPath;
    const originalFilenameBase = basename(fileToDelete.name, ".json");

    // 2. 定义回收站路径
    const logicalRecycleBinWorkflowsDir = `user://.recycle_bin/${projectId}/workflows/`;
    // 使用原始文件名（不含扩展名）加上时间戳来创建回收站中的文件名，更具可读性
    const logicalRecycleBinPath = `${logicalRecycleBinWorkflowsDir}${originalFilenameBase}_${Date.now()}.json`;

    // 3. 确保回收站目录存在
    await famService.createDir(userId, logicalRecycleBinWorkflowsDir);

    // 4. 移动文件到回收站
    await famService.move(userId, logicalFilePath, logicalRecycleBinPath);
    console.log(
      `[Service:deleteWorkflowToRecycleBin] Workflow for user '${userId}' moved to recycle bin: ${logicalFilePath} -> ${logicalRecycleBinPath}`
    );

    // 5. 更新项目元数据
    await updateProjectMetadata(userId, projectId, {});
  } catch (error: any) {
    if (error instanceof WorkflowNotFoundError || error instanceof WorkflowDeletionError) {
      throw error;
    }
    const message = `Unexpected error deleting workflow '${workflowId}' in project '${projectId}' for user '${userId}'. Error: ${error.message}`;
    console.error(`[Service:deleteWorkflowToRecycleBin] ${message}`);
    throw new WorkflowDeletionError(message);
  }
}

/**
 * 通过扫描项目 `ui` 目录自动发现所有可用的应用面板。
 /**
  * 在指定的逻辑路径下扫描并发现应用面板。
  * @param userId - 用户 ID，对于共享路径可以为 null。
  * @param discoveryPath - 要扫描的逻辑路径 (例如 `user://...` 或 `shared://...`)。
  * @param context - 用于日志记录的上下文信息。
  * @returns Promise<PanelDefinition[]> 发现的面板定义对象数组。
  */
async function _discoverPanelsInPath(
  userId: string | null,
  discoveryPath: string,
  context: { projectId?: string; type: "user" | "shared" }
): Promise<PanelDefinition[]> {
  const logPrefix = `[Service:_discoverPanelsInPath]`;
  const contextId = context.projectId ? `project '${context.projectId}'` : "shared templates";
  console.log(
    `${logPrefix} Discovering ${context.type} panels in '${discoveryPath}' for ${contextId}.`
  );

  try {
    const dirExists = await famService.exists(userId, discoveryPath);
    if (!dirExists) {
      console.log(`${logPrefix} Directory not found at '${discoveryPath}'. No panels to discover.`);
      return [];
    }

    const dirItems = await famService.listDir(userId, discoveryPath);
    const panelDirs = dirItems.filter((item) => item.itemType === "directory");

    const panelPromises = panelDirs.map(async (panelDir): Promise<PanelDefinition | null> => {
      const panelJsonLogicalPath = `${
        panelDir.logicalPath.endsWith("/") ? panelDir.logicalPath : panelDir.logicalPath + "/"
      }panel.json`;
      try {
        const panelDef = await _readAndValidateJsonFile<PanelDefinition>({
          userId,
          logicalPath: panelJsonLogicalPath,
          schema: PanelDefinitionSchema,
          notFoundErrorClass: Error,
          loadErrorClass: Error,
          entityName: `panel definition for '${panelDir.name}'`,
          entityId: userId ? `${userId}/${context.projectId}` : "shared",
        });

        panelDef.panelDirectory = panelDir.name;
        // 区分面板来源
        panelDef.source = context.type;

        return panelDef;
      } catch (error) {
        console.warn(
          `${logPrefix} Skipping panel in directory '${panelDir.name}' due to error: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return null;
      }
    });

    const results = await Promise.all(panelPromises);
    return results.filter((p): p is PanelDefinition => p !== null);
  } catch (error) {
    console.error(
      `${logPrefix} Failed to discover panels in '${discoveryPath}' for ${contextId}:`,
      error
    );
    // 在这个辅助函数中不向上抛出致命错误，而是返回空数组，让调用方决定如何处理
    return [];
  }
}

/**
 * 获取项目和系统内置的所有可用应用面板。
 * @param userId - 用户 ID。
 * @param projectId - 清理后的项目 ID。
 * @returns Promise<PanelDefinition[]> 发现的面板定义对象数组。
 */
export async function getPanels(userId: string, projectId: string): Promise<PanelDefinition[]> {
  const logPrefix = `[Service:getPanels]`;

  const userPanelsPath = `user://projects/${projectId}/ui/`;

  try {
    // 只发现和返回用户项目下的面板
    const userPanels = await _discoverPanelsInPath(userId, userPanelsPath, {
      projectId,
      type: "user",
    });

    console.log(`${logPrefix} Found ${userPanels.length} user panels for project '${projectId}'.`);
    return userPanels;
  } catch (error) {
    console.error(
      `${logPrefix} Unexpected error while listing panels for project '${projectId}':`,
      error
    );
    throw new PanelLoadError(`Failed to discover panels for project '${projectId}'.`);
  }
}

/**
 * 根据 ID 获取特定面板的完整定义（通过自动发现）。
 * @param userId - 用户 ID。
 * @param projectId - 清理后的项目 ID。
 * @param panelId - 面板 ID。
 * @returns Promise<PanelDefinition> 完整的面板定义对象。
 * @throws 如果面板未找到 (PanelNotFoundError) 或加载失败 (PanelLoadError)。
 */
export async function getPanelById(
  userId: string,
  projectId: string,
  panelId: string
): Promise<PanelDefinition> {
  const logPrefix = `[Service:getPanelById]`;
  console.log(
    `${logPrefix} Getting panel '${panelId}' for project '${projectId}', user '${userId}'.`
  );

  try {
    // 1. 获取所有面板（包括用户和共享的）
    // getPanels 内部已经处理了去重
    const allPanels = await getPanels(userId, projectId);

    // 2. 在合并后的列表中查找匹配的面板
    const panelDefinition = allPanels.find((p) => p.id === panelId);

    if (!panelDefinition) {
      throw new PanelNotFoundError(
        `Panel with ID '${panelId}' not found in project '${projectId}' or in shared templates.`
      );
    }

    console.log(
      `${logPrefix} Successfully found panel definition for '${panelId}'. Source: ${panelDefinition.source}`
    );
    return panelDefinition;
  } catch (error) {
    // 如果是已知的错误类型，直接重新抛出
    if (error instanceof PanelNotFoundError || error instanceof PanelLoadError) {
      throw error;
    }
    // 对于其他未知错误，包装成 PanelLoadError
    console.error(`${logPrefix} Unexpected error getting panel '${panelId}':`, error);
    throw new PanelLoadError(
      `An unexpected error occurred while trying to get panel '${panelId}'.`
    );
  }
}

/**
 * 获取所有可用的面板模板。
 * @returns Promise<PanelDefinition[]> 发现的模板定义对象数组。
 */
export async function getPanelTemplates(): Promise<PanelDefinition[]> {
  const logPrefix = `[Service:getPanelTemplates]`;
  const sharedPanelsPath = `shared://templates/panels/`;

  try {
    const templates = await _discoverPanelsInPath(null, sharedPanelsPath, { type: "shared" });
    console.log(`${logPrefix} Found ${templates.length} panel templates.`);
    return templates;
  } catch (error) {
    console.error(`${logPrefix} Unexpected error while fetching panel templates:`, error);
    throw new PanelLoadError(`Failed to discover panel templates.`);
  }
}

/**
 /**
  * 创建新的应用面板，可以从模板创建或全新创建。
  * @param userId - 用户 ID。
  * @param projectId - 项目 ID。
  * @param options - 创建选项。
  * @returns Promise<PanelDefinition> 新创建的面板定义。
  */
 export async function createPanel(
   userId: string,
   projectId: string,
   options: { templateId?: string | null; panelId: string; displayName: string }
 ): Promise<PanelDefinition> {
   const { templateId, panelId, displayName } = options;
   const logPrefix = `[Service:createPanel]`;
 
   // 1. 验证新面板 ID
   const safePanelId = sanitizeProjectId(panelId);
   if (!safePanelId || safePanelId !== panelId) {
     throw new PanelCreationError(
       `Invalid panel ID '${panelId}'. Only alphanumeric characters and hyphens are allowed.`
     );
   }
 
   // 2. 检查目标路径是否已存在
   const targetPanelDirPath = `user://projects/${projectId}/ui/${safePanelId}/`;
   const exists = await famService.exists(userId, targetPanelDirPath);
   if (exists) {
     throw new PanelConflictError(
       `Panel with ID '${safePanelId}' already exists in project '${projectId}'.`
     );
   }
 
   // 确保项目 UI 目录存在
   await famService.createDir(userId, `user://projects/${projectId}/ui/`);
 
   let newPanelDef: PanelDefinition;
 
   if (templateId) {
     // --- 从模板创建 ---
     console.log(`${logPrefix} Creating panel from template '${templateId}'.`);
     const templates = await getPanelTemplates();
     const template = templates.find((t) => t.id === templateId);
     if (!template || !template.panelDirectory) {
       throw new PanelNotFoundError(`Template with ID '${templateId}' not found.`);
     }
 
     const sourcePath = `shared://templates/panels/${template.panelDirectory}/`;
     await famService.copy(userId, sourcePath, targetPanelDirPath);
 
     const newPanelJsonPath = `${targetPanelDirPath}panel.json`;
     const panelData = await _readAndValidateJsonFile<PanelDefinition>({
       userId,
       logicalPath: newPanelJsonPath,
       schema: PanelDefinitionSchema,
       notFoundErrorClass: PanelCreationError,
       loadErrorClass: PanelCreationError,
     });
 
     panelData.id = safePanelId;
     panelData.displayName = displayName;
     panelData.source = "user";
 
     await famService.writeFile(userId, newPanelJsonPath, JSON.stringify(panelData, null, 2));
     newPanelDef = panelData;
   } else {
     // --- 全新创建 ---
     console.log(`${logPrefix} Creating new blank panel.`);
     await famService.createDir(userId, targetPanelDirPath);
 
     // 创建 panel.json
     const panelJsonContent: PanelDefinition = {
       id: safePanelId,
       displayName: displayName,
       version: "1.0.0",
       description: "A new panel created from scratch.",
       uiEntryPoint: "index.html",
       source: "user",
     };
     const panelJsonPath = `${targetPanelDirPath}panel.json`;
     await famService.writeFile(userId, panelJsonPath, JSON.stringify(panelJsonContent, null, 2));
 
     // 创建 index.html
     const indexPath = `${targetPanelDirPath}index.html`;
     const indexHtmlContent = `<!DOCTYPE html>
 <html lang="en">
 <head>
   <meta charset="UTF-8">
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   <title>${displayName}</title>
   <style>
     body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #1a1a1a; color: #e0e0e0; text-align: center; }
     .container { max-width: 600px; padding: 2rem; }
     h1 { font-weight: 300; font-size: 2.5rem; margin-bottom: 0.5rem; }
     p { color: #9e9e9e; font-size: 1.1rem; }
   </style>
 </head>
 <body>
   <div class="container">
     <h1>Welcome to '${displayName}'!</h1>
     <p>Edit this index.html file to get started.</p>
   </div>
 </body>
 </html>`;
     await famService.writeFile(userId, indexPath, indexHtmlContent);
 
     newPanelDef = panelJsonContent;
   }
 
   console.log(
     `${logPrefix} Successfully created panel '${safePanelId}' in project '${projectId}'.`
   );
   return newPanelDef;
 }
