import { CreateWorkflowObject, GroupInterfaceInfo, NodeGroupData, ProjectMetadata, ProjectMetadataSchema, UpdateWorkflowObject, WorkflowNode, WorkflowObject, WorkflowObjectSchema, WorkflowStorageObject, } from "@comfytavern/types";
import path, { basename, extname } from "node:path"; // Removed join from here, it's part of path
import { promises as fs } from "node:fs";
import isEqual from "lodash/isEqual";
import { z } from "zod"; // 导入 zod

import { generateSafeWorkflowFilename, sanitizeProjectId } from "../utils/helpers";
import { getUserDataRoot as getGlobalUserDataRoot } from '../utils/fileUtils'; // + 导入

// --- 用户特定路径常量和辅助函数 ---
// USER_DATA_ROOT 现在从 fileUtils 获取
const PROJECTS_DIR_NAME = "projects";
const LIBRARY_DIR_NAME = "library";
const WORKFLOWS_DIR_NAME = "workflows";
const RECYCLE_BIN_DIR_NAME = ".recycle_bin";

/**
 * 获取用户项目数据的基础目录。
 * @param userId 用户 ID。
 * @returns 用户项目数据的基础目录路径 (e.g., userData/default_user/projects)。
 */
function getUserProjectsRoot(userId: string): string {
  return path.join(getGlobalUserDataRoot(), userId, PROJECTS_DIR_NAME);
}

/**
 * 获取用户库数据的基础目录。
 * @param userId 用户 ID。
 * @returns 用户库数据的基础目录路径 (e.g., userData/default_user/library)。
 */
function getUserLibraryRoot(userId: string): string {
  return path.join(getGlobalUserDataRoot(), userId, LIBRARY_DIR_NAME);
}

/**
 * 获取用户特定项目的根目录。
 * @param userId 用户 ID。
 * @param projectId 项目 ID (应已清理)。
 * @returns 用户特定项目的根目录路径 (e.g., userData/default_user/projects/my_project)。
 */
function getUserSpecificProjectPath(userId: string, projectId: string): string {
  return path.join(getUserProjectsRoot(userId), projectId);
}

/**
 * 获取指定用户项目中工作流目录的绝对路径。
 * @param userId - 用户 ID。
 * @param projectId - 项目 ID (应已清理)。
 * @returns 项目工作流目录的绝对路径。
 */
export const getProjectWorkflowsDir = (userId: string, projectId: string): string => {
  return path.join(getUserSpecificProjectPath(userId, projectId), WORKFLOWS_DIR_NAME);
};

/**
 * 确保用户的库目录存在。
 * @param userId 用户 ID。
 */
export async function ensureUserLibraryDirExists(userId: string): Promise<void> {
  const userLibraryPath = getUserLibraryRoot(userId);
  await _ensureDirectoryExists(
    userLibraryPath,
    ProjectCreationError, // 使用一个相关的错误类型
    `user library directory for user '${userId}'`
  );
  console.log(`[Service:ensureUserLibraryDirExists] Ensured library directory exists for user ${userId} at ${userLibraryPath}`);
}

/**
 * 确保用户的核心根目录结构存在 (userData/userId, userData/userId/projects, userData/userId/library)。
 * @param userId 用户 ID。
 */
export async function ensureUserRootDirs(userId: string): Promise<void> {
  const logPrefix = `[Service:ensureUserRootDirs]`;
  const userBaseDir = path.join(getGlobalUserDataRoot(), userId); // 使用导入的函数
  const userProjectsDir = getUserProjectsRoot(userId); // userData/<userId>/projects
  const userLibraryDir = getUserLibraryRoot(userId);   // userData/<userId>/library

  try {
    await _ensureDirectoryExists(
      userBaseDir,
      ProjectCreationError, // 使用一个通用的错误类型
      `base directory for user '${userId}'`
    );
    await _ensureDirectoryExists(
      userProjectsDir,
      ProjectCreationError,
      `projects directory for user '${userId}'`
    );
    await _ensureDirectoryExists(
      userLibraryDir,
      ProjectCreationError,
      `library directory for user '${userId}'`
    );
    // console.log(`${logPrefix} Ensured root directories for user ${userId}`);
  } catch (error) {
    // 如果 _ensureDirectoryExists 内部抛出错误，这里会捕获
    // _ensureDirectoryExists 内部已经记录了详细错误，这里可以只记录一个概括性错误或重新抛出
    console.error(`${logPrefix} Failed to ensure root directories for user ${userId}. Error: ${error instanceof Error ? error.message : String(error)}`);
    // 根据策略决定是否重新抛出，或者让调用方处理 _ensureDirectoryExists 可能抛出的错误
    if (error instanceof ProjectCreationError) throw error; // 重新抛出已知错误
    throw new ProjectCreationError(`Failed to ensure root directories for user ${userId}.`); // 包装为通用错误
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
  const projectWorkflowsDir = getProjectWorkflowsDir(userId, projectId); // 使用新的函数签名

  try {
    // 在读取目录前确保它存在，如果不存在则意味着没有工作流可同步
    try {
      await fs.access(projectWorkflowsDir);
    } catch (accessError: any) {
      if (accessError.code === "ENOENT") {
        console.log(
          `[Service:syncReferencingNodeGroups] Workflows directory not found for project ${projectId}, user ${userId}. No workflows to sync. Path: ${projectWorkflowsDir}`
        );
        return; // 目录不存在，无需继续
      }
      throw accessError; // 其他错误则抛出
    }
    const files = await fs.readdir(projectWorkflowsDir);
    const workflowFiles = files.filter(
      (file) =>
        extname(file).toLowerCase() === ".json" && basename(file, ".json") !== updatedWorkflowId // 排除自身
    );

    for (const file of workflowFiles) {
      const referencingWorkflowId = basename(file, ".json");
      const filePath = path.join(projectWorkflowsDir, file);
      let workflowData: WorkflowObject | null = null;
      let needsSave = false;

      try {
        const fileContent = await fs.readFile(filePath, "utf-8");
        try {
          workflowData = JSON.parse(fileContent) as WorkflowObject;
        } catch (parseError) {
          console.error(`Error parsing workflow file ${filePath} during sync:`, parseError);
          continue; // 跳到下一个文件
        }

        if (!workflowData || !Array.isArray(workflowData.nodes)) {
          console.warn(`Skipping invalid workflow data in ${filePath} during sync.`);
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
          await fs.writeFile(filePath, JSON.stringify(workflowData, null, 2));
          console.log(
            `Saved updated workflow ${referencingWorkflowId} with synced NodeGroup interface.`
          );
        }
      } catch (readWriteError) {
        console.error(`Error processing workflow file ${filePath} during sync:`, readWriteError);
      }
    }
  } catch (error) {
    // 如果项目工作流目录本身不存在或无法读取，则记录错误
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      console.warn(
        `Project workflow directory not found during sync for project ${projectId}: ${projectWorkflowsDir}`
      );
    } else {
      console.error(`Error listing workflows in project ${projectId} during sync:`, error);
    }
    // 记录错误，但不影响主流程（例如，更新操作本身不应失败）
  }
}

// 内部辅助函数：读取并验证 JSON 文件
interface ReadAndValidateJsonOptions<T> {
  filePath: string;
  schema: z.ZodType<T, z.ZodTypeDef, any>; // 允许输入类型与输出类型 T 不同
  notFoundErrorClass: new (message: string) => Error;
  loadErrorClass: new (message: string) => Error;
  entityName?: string;
  entityId?: string; // 用于更详细的日志/错误消息
}

async function _readAndValidateJsonFile<T>({
  filePath,
  schema,
  notFoundErrorClass,
  loadErrorClass,
  entityName = "data",
  entityId = "",
}: ReadAndValidateJsonOptions<T>): Promise<T> {
  const logPrefix = `[Service:_readAndValidateJsonFile]`;
  // 构造一个更具描述性的实体名称，用于日志和错误消息
  const descriptiveEntityName = entityId ? `${entityName} '${entityId}'` : entityName;
  // 首字母大写，用于错误消息
  const capitalizedEntityName =
    descriptiveEntityName.charAt(0).toUpperCase() + descriptiveEntityName.slice(1);

  let fileContent: string;
  try {
    fileContent = await fs.readFile(filePath, "utf-8");
  } catch (error: any) {
    if (error.code === "ENOENT") {
      const message = `${capitalizedEntityName} file not found. Path: ${filePath}`;
      console.warn(`${logPrefix} ${message}`);
      throw new notFoundErrorClass(message);
    }
    const message = `Failed to read ${descriptiveEntityName} file. Path: ${filePath}. Error: ${error.message}`;
    console.error(`${logPrefix} ${message}`);
    throw new loadErrorClass(message);
  }

  let jsonData: any;
  try {
    jsonData = JSON.parse(fileContent);
  } catch (error: any) {
    const message = `Failed to parse JSON for ${descriptiveEntityName}. Path: ${filePath}. Error: ${error.message}`;
    console.error(`${logPrefix} ${message}`);
    throw new loadErrorClass(message);
  }

  const validationResult = schema.safeParse(jsonData);
  if (!validationResult.success) {
    const errorDetails = validationResult.error.flatten().fieldErrors;
    const message = `${capitalizedEntityName} validation failed. Path: ${filePath}. Details: ${JSON.stringify(
      errorDetails
    )}`;
    console.error(`${logPrefix} ${message}`);
    throw new loadErrorClass(message);
  }
  return validationResult.data;
}

// 内部辅助函数：确保目录存在
async function _ensureDirectoryExists(
  dirPath: string,
  creationErrorClass: new (message: string) => Error, // 例如 ProjectCreationError, WorkflowCreationError
  errorContextMessage: string // 例如 "project directories", "workflows directory for project X"
): Promise<void> {
  const logPrefix = `[Service:_ensureDirectoryExists]`;
  try {
    await fs.mkdir(dirPath, { recursive: true });
    // console.log(`${logPrefix} Successfully ensured directory exists or was created: ${dirPath}`);
  } catch (mkdirError: any) {
    const message = `Failed to create ${errorContextMessage}. Path: ${dirPath}. Error: ${mkdirError.message}`;
    console.error(`${logPrefix} ${message}`);
    throw new creationErrorClass(message);
  }
}

// 内部辅助函数：检查文件是否存在，如果存在则视为冲突 (用于创建或重命名检查)
async function _checkFileConflict(
  filePath: string,
  conflictErrorClass: new (message: string) => Error, // 例如 ProjectConflictError, WorkflowConflictError
  baseErrorClass: new (message: string) => Error, // 例如 ProjectCreationError, WorkflowUpdateError
  conflictContextMessage: string // 例如 "Project with ID X already exists."
): Promise<void> {
  const logPrefix = `[Service:_checkFileConflict]`;
  try {
    await fs.access(filePath);
    // 如果 fs.access 成功，说明文件/目录已存在，这是一个冲突
    console.warn(`${logPrefix} Conflict: ${conflictContextMessage}`);
    throw new conflictErrorClass(conflictContextMessage);
  } catch (accessError: any) {
    if (accessError.code !== "ENOENT") {
      // 如果不是“文件/目录不存在”错误，则是其他访问错误，这通常指示更深层次的问题
      const message = `Error checking file/directory existence at ${filePath}: ${accessError.message}`;
      console.error(`${logPrefix} ${message}`);
      throw new baseErrorClass(message); // 抛出基础错误类型，表明检查过程本身出错了
    }
    // ENOENT (文件/目录不存在) 是期望的场景，意味着没有冲突，可以继续。
  }
}

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
await ensureUserRootDirs(userId); // <--- 新增：确保用户根目录存在
console.log(`Updating metadata for project ${projectId} for user ${userId}`);
const projectPath = getUserSpecificProjectPath(userId, projectId); // 用户特定路径
const metadataPath = path.join(projectPath, "project.json");

try {
  // ensureUserRootDirs 确保了 userData/userId/projects 存在。
  // 对于更新操作，我们期望 projectPath (userData/userId/projects/projectId) 已经存在。
  // 如果 projectPath 不存在，后续的 readFile 会失败。
  // _ensureDirectoryExists(projectPath,...) 在这里是合理的，以防万一。
  await _ensureDirectoryExists(
    projectPath,
    ProjectMetadataError,
    `project directory for ID '${projectId}' for user '${userId}' during metadata update`
  );

  // 1. 读取现有元数据
    let existingMetadata: ProjectMetadata;
    try {
      const fileContent = await fs.readFile(metadataPath, "utf-8");
      existingMetadata = ProjectMetadataSchema.parse(JSON.parse(fileContent));
    } catch (readError: any) {
      if (readError.code === "ENOENT") {
        const message = `Project metadata file not found for ID '${projectId}' for user '${userId}'. Path: ${metadataPath}`;
        console.error(`[Service:updateProjectMetadata] ${message}`);
        throw new ProjectNotFoundError(message);
      }
      const message = `Failed to read or parse existing metadata for project ID '${projectId}' for user '${userId}'. Path: ${metadataPath}. Error: ${readError.message}`;
      console.error(`[Service:updateProjectMetadata] ${message}`);
      throw new ProjectMetadataError(message);
    }

    // 2. 合并更新并设置 updatedAt
    const now = new Date().toISOString();
    const updatedMetadata: ProjectMetadata = {
      ...existingMetadata,
      ...updateData, // 应用传入的更新
      updatedAt: now, // 强制更新 updatedAt 字段
      // 确保 id 和 createdAt 不被覆盖 (虽然 schema 已排除，但再次确认)
      id: existingMetadata.id,
      createdAt: existingMetadata.createdAt,
    };

    // 3. 验证最终的元数据对象 (可选但推荐)
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
      await fs.writeFile(metadataPath, JSON.stringify(finalValidation.data, null, 2));
    } catch (writeError: any) {
      const message = `Failed to write updated metadata for project ID '${projectId}' for user '${userId}'. Path: ${metadataPath}. Error: ${writeError.message}`;
      console.error(`[Service:updateProjectMetadata] ${message}`);
      throw new ProjectMetadataError(message);
    }

    console.log(
      `[Service:updateProjectMetadata] Project metadata for user '${userId}' updated successfully: ${metadataPath}`
    );
    return finalValidation.data;
  } catch (error) {
    // 重新抛出已知的自定义错误，或包装为 ProjectMetadataError
    if (error instanceof ProjectNotFoundError || error instanceof ProjectMetadataError) {
      throw error; // 直接重新抛出已知类型的错误
    }
    // 对于其他未知错误，包装成 ProjectMetadataError
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
  await ensureUserRootDirs(userId); // <--- 新增：确保用户根目录存在
  const userProjectsRoot = getUserProjectsRoot(userId);
  console.log(`[Service:listProjects] Listing all projects for user ${userId} from: ${userProjectsRoot}`);
  try {
    // ensureUserRootDirs 已经确保 userProjectsRoot 存在，所以可以直接读取
    // 原有的 fs.access 和 _ensureDirectoryExists(userProjectsRoot,...) 逻辑可以移除

    const entries = await fs.readdir(userProjectsRoot, { withFileTypes: true });
    const projectDirs = entries.filter(
      (entry) => entry.isDirectory() && entry.name !== RECYCLE_BIN_DIR_NAME // 使用常量
    );

    const projectsPromises = projectDirs.map(async (dir): Promise<ProjectMetadata | null> => {
      const projectIdFromName = dir.name;
      const safeReadProjectId = sanitizeProjectId(projectIdFromName);
      if (!safeReadProjectId) {
        console.warn(
          `[Service:listProjects] Skipping potentially invalid project directory name for user ${userId}: ${projectIdFromName}`
        );
        return null;
      }
      // projectPath 现在是用户特定的
      const projectPath = getUserSpecificProjectPath(userId, safeReadProjectId);
      const metadataPath = path.join(projectPath, "project.json");

      try {
        // 使用辅助函数读取并验证元数据文件
        const validatedMetadata = await _readAndValidateJsonFile<ProjectMetadata>({
          filePath: metadataPath,
          schema: ProjectMetadataSchema,
          // 对于 listProjects，如果单个文件有问题，我们不希望整个操作失败，
          // 而是跳过这个项目。所以这里传入的错误类不会被直接抛出到顶层，
          // 而是在下面的 catch 块中被捕获并处理。
          notFoundErrorClass: ProjectNotFoundError, // 或自定义一个更内部的错误类型
          loadErrorClass: ProjectMetadataError, // 或自定义一个更内部的错误类型
          entityName: "project metadata",
          entityId: `${userId}/${safeReadProjectId}`, // 包含 userId
        });

        // 确保返回的 id 与目录名一致
        if (validatedMetadata.id !== safeReadProjectId) {
          console.warn(
            `[Service:listProjects] Metadata ID '${validatedMetadata.id}' for project in directory '${safeReadProjectId}' for user '${userId}' does not match directory name. Using directory name as ID.`
          );
        }
        // 返回经过验证的元数据，并确保 id 是目录名
        return { ...validatedMetadata, id: safeReadProjectId };
      } catch (error: any) {
        console.warn(
          `[Service:listProjects] Error processing metadata for project ${safeReadProjectId} (user: ${userId}, path: ${metadataPath}): ${error.message}. Skipping this project.`
        );
        return null;
      }
    });

    const resolvedProjects = await Promise.all(projectsPromises);

    const validProjects = resolvedProjects.filter((p) => p !== null) as ProjectMetadata[];
    console.log(`[Service:listProjects] Found ${validProjects.length} valid projects for user ${userId}.`);
    return validProjects;
  } catch (error: any) {
    console.error("[Service:listProjects] Error listing projects:", error);
    throw new Error(`Failed to list projects: ${error.message}`);
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

/**
 * 获取指定用户项目的元数据。
 * @param userId - 用户 ID。
 * @param projectId 清理后的项目 ID。
 * @returns Promise<ProjectMetadata> 项目的元数据。
 * @throws 如果项目目录或元数据文件不存在 (ProjectNotFoundError)，或发生读写/解析错误 (ProjectMetadataError)。
 */
export async function getProjectMetadata(userId: string, projectId: string): Promise<ProjectMetadata> {
  await ensureUserRootDirs(userId); // <--- 新增：确保用户根目录存在
  const logPrefix = `[Service:getProjectMetadata]`;
  console.log(`${logPrefix} Attempting to get metadata for project ID '${projectId}' for user '${userId}'`);
  const projectPath = getUserSpecificProjectPath(userId, projectId); // 用户特定路径
  const metadataPath = path.join(projectPath, "project.json");

  // ensureUserRootDirs 确保了 userData/userId/projects 存在。
  // 但具体的 projectPath (userData/userId/projects/projectId) 可能仍需检查或依赖于创建逻辑。
  // _readAndValidateJsonFile 内部会处理 projectPath 下的 metadataPath 是否存在的 ENOENT。
  // 所以，对 projectPath 的显式 fs.access 检查可以移除，让 _readAndValidateJsonFile 处理。
  // 如果 projectPath 自身不存在，_readAndValidateJsonFile 尝试读取 metadataPath 时会因父目录不存在而失败（ENOENT）。

  // 使用辅助函数读取并验证元数据文件
  const metadata = await _readAndValidateJsonFile<ProjectMetadata>({
    filePath: metadataPath,
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
  const projectPath = getUserSpecificProjectPath(userId, projectId); // 用户特定路径
  const projectWorkflowsDir = getProjectWorkflowsDir(userId, projectId); // 用户特定路径
  const metadataPath = path.join(projectPath, "project.json");

  try {
    // 1. 检查项目是否已存在 (在用户特定路径下)
    await _checkFileConflict(
      projectPath, // 检查的是用户特定路径下的 projectPath
      ProjectConflictError,
      ProjectCreationError,
      `Project with ID '${projectId}' (derived from name '${projectName}') already exists for user '${userId}'.`
    );

    // 2. 创建项目目录和 workflows 子目录 (recursive:true 会创建所有父目录，包括用户根目录和项目根目录)
    await _ensureDirectoryExists(
      projectWorkflowsDir, // 这个路径包含了 userData/userId/projects/projectId/workflows
      ProjectCreationError,
      `project directories for ID '${projectId}' for user '${userId}'`
    );
    console.log(`[Service:createProject] Ensured project directory exists: ${projectPath} for user ${userId}`);
    console.log(`[Service:createProject] Created workflows directory: ${projectWorkflowsDir}`);

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
        await fs.rm(projectPath, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error(
          `[Service:createProject] Failed to cleanup partially created project directory ${projectPath} for user '${userId}' after metadata validation error:`,
          cleanupError
        );
      }
      throw new ProjectCreationError("Internal error: Generated project metadata is invalid.");
    }

    // 4. 写入元数据文件
    try {
      await fs.writeFile(metadataPath, JSON.stringify(metadataValidation.data, null, 2));
      console.log(`[Service:createProject] Created project metadata file for user '${userId}': ${metadataPath}`);
    } catch (writeError: any) {
      console.error(
        `[Service:createProject] Error writing metadata file for ID '${projectId}' for user '${userId}':`,
        writeError
      );
      try {
        await fs.rm(projectPath, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error(
          `[Service:createProject] Failed to cleanup partially created project directory ${projectPath} for user '${userId}' after write error:`,
          cleanupError
        );
      }
      throw new ProjectCreationError(
        `Failed to write project metadata file: ${writeError.message}`
      );
    }

    // 5. 验证文件是否真的创建成功 (可选，但良好实践)
    try {
      await fs.access(metadataPath);
      console.log(
        `[Service:createProject] Successfully verified metadata file existence for user '${userId}': ${metadataPath}`
      );
    } catch (verifyError: any) {
      console.error(
        `[Service:createProject] Failed to verify metadata file existence after write for ID '${projectId}' for user '${userId}':`,
        verifyError
      );
      throw new ProjectCreationError(
        `Failed to verify project metadata file existence after write: ${verifyError.message}`
      );
    }

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
interface ListedWorkflow {
  id: string;
  name: string;
  description?: string;
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
  await ensureUserRootDirs(userId); // <--- 新增：确保用户根目录存在
  console.log(`[Service:listWorkflows] Listing workflows for project ID '${projectId}' for user '${userId}'`);
  const projectWorkflowsDir = getProjectWorkflowsDir(userId, projectId); // 用户特定路径

  try {
    // ensureUserRootDirs 确保了 userData/userId/projects 存在。
    // createProject 会创建 projectWorkflowsDir。
    // 如果是读取一个已创建项目的 workflows，projectWorkflowsDir 应该存在。
    // 如果 projectWorkflowsDir 不存在（例如，项目刚创建但没有工作流，或者目录被意外删除），
    // fs.readdir 会失败。我们需要优雅处理这种情况。
    // 之前的逻辑是如果 ENOENT 则创建并返回 []，这仍然是好的。
    try {
      await fs.access(projectWorkflowsDir);
    } catch (accessError: any) {
      if (accessError.code === "ENOENT") {
        // 即使 ensureUserRootDirs 运行了，特定项目的 workflows 目录也可能不存在
        // 如果是 list 操作，可以认为该项目没有工作流，或者按需创建。
        // 保持创建并返回空列表的行为是合理的。
        await _ensureDirectoryExists(
          projectWorkflowsDir,
          ProjectCreationError,
          `workflows directory for project '${projectId}' for user '${userId}'`
        );
        console.log(
          `[Service:listWorkflows] Workflows directory not found for project ${projectId}, user ${userId}. Created: ${projectWorkflowsDir}. Returning empty list.`
        );
        return [];
      }
      throw new Error(
        `Failed to access workflows directory for project ${projectId}, user ${userId}: ${accessError.message}`
      );
    }

    const files = await fs.readdir(projectWorkflowsDir);
    const workflowFiles = files.filter((file) => extname(file).toLowerCase() === ".json");

    const workflowsPromises = workflowFiles.map(async (file): Promise<ListedWorkflow | null> => {
      const id = basename(file, ".json");
      const filePath = path.join(projectWorkflowsDir, file);
      let name = id;
      let description: string | undefined;
      let creationMethod: string | undefined;
      let referencedWorkflows: string[] | undefined;

      try {
        const fileContent = await fs.readFile(filePath, "utf-8");
        const workflowData: Partial<WorkflowObject> = JSON.parse(fileContent);
        name = workflowData.name || (workflowData as any).label || id;
        description = workflowData.description;
        creationMethod = workflowData.creationMethod;
        referencedWorkflows = workflowData.referencedWorkflows;
      } catch (readError: any) {
        console.error(
          `[Service:listWorkflows] Error reading/parsing workflow file ${filePath} for listing in project ${projectId}, user ${userId}:`,
          readError.message
        );
      }
      return { id, name, description, creationMethod, referencedWorkflows };
    });

    const resolvedWorkflows = (await Promise.all(workflowsPromises)).filter(
      (w) => w !== null
    ) as ListedWorkflow[];
    console.log(
      `[Service:listWorkflows] Found ${resolvedWorkflows.length} workflows for project ID '${projectId}' for user '${userId}'.`
    );
    return resolvedWorkflows;
  } catch (error: any) {
    console.error(
      `[Service:listWorkflows] Error listing workflows for project ID '${projectId}' for user '${userId}':`,
      error
    );
    throw new Error(`Failed to list workflows for project ${projectId}, user ${userId}: ${error.message}`);
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
  const { name, nodes, edges, viewport, interfaceInputs, interfaceOutputs, referencedWorkflows } =
    workflowInputData;
  const workflowId = generateSafeWorkflowFilename(name);

  console.log(
    `[Service:createWorkflow] Attempting to create workflow '${name}' (ID: ${workflowId}) in project '${projectId}' for user '${userId}'`
  );
  const projectWorkflowsDir = getProjectWorkflowsDir(userId, projectId); // 用户特定路径
  const filePath = path.join(projectWorkflowsDir, `${workflowId}.json`);

  try {
    // 1. 确保工作流目录存在 (这也会确保父项目目录和用户目录存在)
    await _ensureDirectoryExists(
      projectWorkflowsDir,
      WorkflowCreationError,
      `workflows directory for project ${projectId}, user ${userId}`
    );

    // 2. 检查工作流文件是否已存在
    await _checkFileConflict(
      filePath,
      WorkflowConflictError,
      WorkflowCreationError,
      `Workflow with name '${name}' (filename: ${workflowId}.json) already exists in project '${projectId}' for user '${userId}'.`
    );

    // 3. 准备要保存的数据
    const now = new Date().toISOString();
    const storageData: WorkflowStorageObject = {
      name,
      nodes: nodes || [], // 确保有默认值
      edges: (edges || []).map((edge) => ({
        // 确保有默认值并转换
        ...edge,
        sourceHandle: edge.sourceHandle ?? "",
        targetHandle: edge.targetHandle ?? "",
        markerEnd: undefined,
      })),
      viewport: viewport || { x: 0, y: 0, zoom: 1 }, // 确保有默认值
      interfaceInputs: interfaceInputs || {},
      interfaceOutputs: interfaceOutputs || {},
      referencedWorkflows: referencedWorkflows || [],
      // creationMethod is not part of CreateWorkflowObject, will be undefined
    };

    const dataToSave: WorkflowObject = {
      id: workflowId, // id 在 WorkflowObject 中是必须的
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
      await fs.writeFile(filePath, JSON.stringify(validationResult.data, null, 2));
      console.log(`[Service:createWorkflow] Workflow file created for user '${userId}': ${filePath}`);
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
export async function getWorkflow(userId: string, projectId: string, workflowId: string): Promise<WorkflowObject> {
  await ensureUserRootDirs(userId); // <--- 新增：确保用户根目录存在
  const logPrefix = `[Service:getWorkflow]`;
  console.log(
    `${logPrefix} Attempting to get workflow ID '${workflowId}' from project '${projectId}' for user '${userId}'`
  );
  const projectWorkflowsDir = getProjectWorkflowsDir(userId, projectId); // 用户特定路径
  const filePath = path.join(projectWorkflowsDir, `${workflowId}.json`);

  // ensureUserRootDirs 确保了 userData/userId/projects 存在。
  // projectWorkflowsDir (userData/userId/projects/projectId/workflows) 的存在性依赖于项目创建。
  // _readAndValidateJsonFile 会处理 filePath 的 ENOENT。
  // 如果 projectWorkflowsDir 不存在，_readAndValidateJsonFile 尝试读取 filePath 时会因父目录不存在而失败。
  // 所以对 projectWorkflowsDir 的显式 fs.access 检查可以移除。

  const validatedData = await _readAndValidateJsonFile<WorkflowObject>({
    filePath,
    schema: WorkflowObjectSchema,
    notFoundErrorClass: WorkflowNotFoundError,
    loadErrorClass: WorkflowLoadError,
    entityName: "workflow",
    entityId: `${userId}/${projectId}/${workflowId}`,
  });

  const workflowWithEnsuredId = { ...validatedData, id: workflowId };

  if (validatedData.id && validatedData.id !== workflowId) {
    console.warn(
      `${logPrefix} Workflow ID in file ('${validatedData.id}') differs from filename-derived ID ('${workflowId}') for project '${projectId}', user '${userId}'. Using filename-derived ID.`
    );
  }

  console.log(
    `${logPrefix} Successfully retrieved and validated workflow '${workflowId}' from project '${projectId}' for user '${userId}'.`
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
  userId: string, // 新增 userId 参数
  projectId: string,
  workflowId: string,
  workflowUpdateData: UpdateWorkflowObject,
  appVersion: string
): Promise<WorkflowObject> {
  await ensureUserRootDirs(userId); // <--- 新增：确保用户根目录存在
  console.log(
    `[Service:updateWorkflow] Attempting to update workflow ID '${workflowId}' in project '${projectId}' for user '${userId}'`
  );
  const projectWorkflowsDir = getProjectWorkflowsDir(userId, projectId); // 用户特定路径
  const currentFilePath = path.join(projectWorkflowsDir, `${workflowId}.json`);

  const newName = workflowUpdateData.name;
  const newSafeWorkflowId = generateSafeWorkflowFilename(newName);
  const newFilePath = path.join(projectWorkflowsDir, `${newSafeWorkflowId}.json`);

  try {
    // ensureUserRootDirs 确保了 userData/userId/projects 存在。
    // 对于更新操作，我们期望 projectWorkflowsDir 存在。
    // 如果 projectWorkflowsDir 不存在，后续的 fs.access(currentFilePath) 会失败。
    // 保持对 projectWorkflowsDir 和 currentFilePath 的检查是合理的。
    try {
      await fs.access(projectWorkflowsDir);
    } catch (accessDirError: any) {
      if (accessDirError.code === "ENOENT") {
        const message = `Workflows directory not found for project '${projectId}', user '${userId}'. Cannot update workflow '${workflowId}'. Path: ${projectWorkflowsDir}`;
        console.warn(`[Service:updateWorkflow] ${message}`);
        throw new WorkflowNotFoundError(message);
      }
      throw new WorkflowUpdateError(`Failed to access workflows directory: ${accessDirError.message}`);
    }

    try {
      await fs.access(currentFilePath);
    } catch (accessFileError: any) {
      if (accessFileError.code === "ENOENT") {
        const message = `Workflow with ID '${workflowId}' not found in project '${projectId}' for user '${userId}' for update. Path: ${currentFilePath}`;
        console.warn(`[Service:updateWorkflow] ${message}`);
        throw new WorkflowNotFoundError(message);
      }
      throw new WorkflowUpdateError(
        `Failed to access existing workflow file: ${accessFileError.message}`
      );
    }

    // 2. 如果文件名需要改变，检查新文件名是否冲突
    if (newSafeWorkflowId !== workflowId) {
      await _checkFileConflict(
        newFilePath,
        WorkflowConflictError,
        WorkflowUpdateError,
        `Cannot rename workflow. A workflow with the name '${newName}' (filename: ${newSafeWorkflowId}.json) already exists in project '${projectId}' for user '${userId}'.`
      );
    }

    // 3. 读取现有数据以保留 createdAt 等元数据
    let existingData: Partial<WorkflowObject> = {};
    try {
      const oldContent = await fs.readFile(currentFilePath, "utf-8");
      existingData = JSON.parse(oldContent);
    } catch (readError: any) {
      // 如果读取失败，这很严重，但我们可能仍想尝试覆盖写入
      console.warn(
        `[Service:updateWorkflow] Could not read existing workflow file ${currentFilePath} for user '${userId}' during update: ${readError.message}. Proceeding with update.`
      );
    }

    // 4. 准备要保存的数据
    const now = new Date().toISOString();
    const { id: idFromBody, ...updatePayload } = workflowUpdateData;

    const dataToSave: WorkflowObject = {
      name: newName,
      nodes: updatePayload.nodes || [],
      edges: (updatePayload.edges || []).map((edge) => ({
        ...edge,
        sourceHandle: edge.sourceHandle ?? "",
        targetHandle: edge.targetHandle ?? "",
        markerEnd: undefined,
      })),
      viewport: updatePayload.viewport || { x: 0, y: 0, zoom: 1 },
      interfaceInputs: updatePayload.interfaceInputs || {},
      interfaceOutputs: updatePayload.interfaceOutputs || {},
      creationMethod: updatePayload.creationMethod ?? (existingData as any).creationMethod,
      referencedWorkflows: updatePayload.referencedWorkflows || [],
      previewTarget:
        updatePayload.previewTarget === undefined
          ? (existingData as any).previewTarget
          : updatePayload.previewTarget,
      id: newSafeWorkflowId,
      createdAt: (existingData as any).createdAt || now,
      updatedAt: now,
      version: appVersion,
      description:
        updatePayload.description === undefined
          ? (existingData as any).description
          : updatePayload.description,
    };

    const validationResult = WorkflowObjectSchema.safeParse(dataToSave);
    if (!validationResult.success) {
      const errorDetails = validationResult.error.flatten().fieldErrors;
      const message = `Internal error: Updated workflow data for '${newName}' (ID: ${newSafeWorkflowId}) for user '${userId}', project '${projectId}' is invalid. Details: ${JSON.stringify(
        errorDetails
      )}`;
      console.error(`[Service:updateWorkflow] ${message}`);
      throw new WorkflowUpdateError(message);
    }
    const validatedDataToSave = validationResult.data;

    const finalFilePath = path.join(projectWorkflowsDir, `${validatedDataToSave.id}.json`);

    try {
      await fs.writeFile(finalFilePath, JSON.stringify(validatedDataToSave, null, 2));
      console.log(`[Service:updateWorkflow] Workflow file saved for user '${userId}': ${finalFilePath}`);

      if (newSafeWorkflowId !== workflowId && currentFilePath !== finalFilePath) {
        try {
          await fs.unlink(currentFilePath);
          console.log(`[Service:updateWorkflow] Old workflow file deleted for user '${userId}': ${currentFilePath}`);
        } catch (unlinkError: any) {
          console.warn(
            `[Service:updateWorkflow] Failed to delete old workflow file ${currentFilePath} for user '${userId}' after rename: ${unlinkError.message}. Continuing.`
          );
        }
      }
    } catch (writeError: any) {
      const message = `Failed to write workflow file for '${newName}' (ID: ${newSafeWorkflowId}) for user '${userId}'. Error: ${writeError.message}`;
      console.error(`[Service:updateWorkflow] ${message}`);
      throw new WorkflowUpdateError(message);
    }

    const newInterface: GroupInterfaceInfo = {
      inputs: validatedDataToSave.interfaceInputs || {},
      outputs: validatedDataToSave.interfaceOutputs || {},
    };

    syncReferencingNodeGroups(userId, projectId, newSafeWorkflowId, newInterface).catch((syncError) => { // Pass userId
      console.error(
        `[Service:updateWorkflow] Error during background NodeGroup sync for ${newSafeWorkflowId} in project ${projectId}, user ${userId}:`,
        syncError
      );
    });

    try {
      await updateProjectMetadata(userId, projectId, {}); // Pass userId
    } catch (metaError) {
      console.warn(
        `[Service:updateWorkflow] Failed to update project metadata for '${projectId}', user '${userId}' after workflow update:`,
        metaError
      );
    }

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
  userId: string, // 新增 userId 参数
  projectId: string,
  workflowId: string
): Promise<void> {
  // ensureUserRootDirs(userId) 可以确保 userData/userId 存在，为回收站的根提供基础
  // 但回收站的具体子目录 (userData/userId/.recycle_bin/projectId/workflows) 由后续逻辑创建
  // 所以在这里调用 ensureUserRootDirs 不是必须的，但无害。
  // 为了保持一致性，可以添加，或者依赖现有逻辑。
  // 暂时不加，因为现有逻辑会创建回收站的深层路径。
  console.log(
    `[Service:deleteWorkflowToRecycleBin] Attempting to move workflow ID '${workflowId}' in project '${projectId}' for user '${userId}' to recycle bin.`
  );
  const projectWorkflowsDir = getProjectWorkflowsDir(userId, projectId); // 用户特定路径
  const filePath = path.join(projectWorkflowsDir, `${workflowId}.json`);

  // 定义用户特定的回收站路径
  const userRecycleBinRoot = path.join(getGlobalUserDataRoot(), userId, RECYCLE_BIN_DIR_NAME); // 使用导入的函数
  const recycleBinProjectDir = path.join(userRecycleBinRoot, projectId);
  const recycleBinWorkflowsDir = path.join(recycleBinProjectDir, WORKFLOWS_DIR_NAME);
  const recycleBinPath = path.join(recycleBinWorkflowsDir, `${workflowId}_${Date.now()}.json`);

  try {
    // 1. 检查原始文件是否存在
    try {
      await fs.access(filePath);
    } catch (accessError: any) {
      if (accessError.code === "ENOENT") {
        const message = `Workflow file not found for ID '${workflowId}' in project '${projectId}' for user '${userId}' for deletion. Path: ${filePath}`;
        console.warn(`[Service:deleteWorkflowToRecycleBin] ${message}`);
        throw new WorkflowNotFoundError(message);
      }
      throw new WorkflowDeletionError(
        `Failed to access workflow file for deletion: ${accessError.message}`
      );
    }

    // 2. 确保回收站目录存在
    await _ensureDirectoryExists(
      recycleBinWorkflowsDir, // This will create userData/userId/.recycle_bin/projectId/workflows
      WorkflowDeletionError,
      `recycle bin directory for project '${projectId}', user '${userId}'`
    );

    // 3. 将文件移动到回收站
    try {
      await fs.rename(filePath, recycleBinPath);
      console.log(
        `[Service:deleteWorkflowToRecycleBin] Workflow for user '${userId}' moved to recycle bin: ${filePath} -> ${recycleBinPath}`
      );

      // 删除工作流成功后，更新项目的 updatedAt 元数据
      try {
        await updateProjectMetadata(userId, projectId, {}); // Pass userId
      } catch (metaError) {
        console.warn(
          `[Service:deleteWorkflowToRecycleBin] Failed to update project metadata for '${projectId}', user '${userId}' after workflow deletion:`,
          metaError
        );
      }
    } catch (renameError: any) {
      const message = `Failed to move workflow '${workflowId}' to recycle bin in project '${projectId}' for user '${userId}'. Error: ${renameError.message}`;
      console.error(`[Service:deleteWorkflowToRecycleBin] ${message}`);
      throw new WorkflowDeletionError(message);
    }
  } catch (error: any) {
    if (error instanceof WorkflowNotFoundError || error instanceof WorkflowDeletionError) {
      throw error;
    }
    const message = `Unexpected error deleting workflow '${workflowId}' in project '${projectId}' for user '${userId}'. Error: ${error.message}`;
    console.error(`[Service:deleteWorkflowToRecycleBin] ${message}`);
    throw new WorkflowDeletionError(message);
  }
}
