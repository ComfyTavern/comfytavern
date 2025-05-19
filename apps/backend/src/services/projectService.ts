import { promises as fs } from "node:fs";
import path, { join, basename, extname } from "node:path";
import isEqual from "lodash/isEqual";
import {
  type WorkflowObject, // 这个已经导入了
  type GroupInterfaceInfo,
  type WorkflowNode,
  type NodeGroupData,
  type WorkflowStorageObject, // <-- 需要这个
  WorkflowObjectSchema, // <-- 需要这个
  // CreateWorkflowObject 已经在下面单独导入了
} from "@comfytavern/types";
import { PROJECTS_BASE_DIR } from "../config"; // 导入项目基础目录
import { sanitizeProjectId, generateSafeWorkflowFilename } from "../utils/helpers"; // <-- 添加 generateSafeWorkflowFilename

/**
 * 获取指定项目的工作流目录的绝对路径。
 * @param projectId - 项目 ID (应已清理)。
 * @returns 项目工作流目录的绝对路径。
 */
export const getProjectWorkflowsDir = (projectId: string): string => {
  // Note: projectId should already be sanitized before calling this function
  return path.join(PROJECTS_BASE_DIR, projectId, "workflows");
};

/**
 * 同步更新引用了特定工作流（作为 NodeGroup）的其他工作流中的接口快照。
 * 当一个工作流的接口（interfaceInputs/interfaceOutputs）发生变化时调用此函数。
 * @param projectId - 包含被更新工作流的项目 ID。
 * @param updatedWorkflowId - 接口被更新的工作流的 ID。
 * @param newInterface - 被更新工作流的新接口信息。
 */
export async function syncReferencingNodeGroups(
  projectId: string,
  updatedWorkflowId: string,
  newInterface: GroupInterfaceInfo
): Promise<void> {
  console.log(
    `Syncing NodeGroups referencing workflow ${updatedWorkflowId} in project ${projectId}`
  );
  // 注意：这里不再需要 resolve，因为 getProjectWorkflowsDir 返回绝对路径
  const projectWorkflowsDir = getProjectWorkflowsDir(projectId);

  try {
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

import { ProjectMetadataSchema, type ProjectMetadata } from "@comfytavern/types"; // 导入 ProjectMetadata 类型和 Schema
import { z } from "zod"; // 导入 zod

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
  projectId: string,
  updateData: ProjectMetadataUpdate
): Promise<ProjectMetadata> {
  console.log(`Updating metadata for project ${projectId}`);
  const projectPath = path.join(PROJECTS_BASE_DIR, projectId);
  const metadataPath = path.join(projectPath, "project.json");

  try {
    // 1. 读取现有元数据
    let existingMetadata: ProjectMetadata;
    try {
      const fileContent = await fs.readFile(metadataPath, "utf-8");
      existingMetadata = ProjectMetadataSchema.parse(JSON.parse(fileContent));
    } catch (readError: any) {
      if (readError.code === "ENOENT") {
        const message = `Project metadata file not found for ID '${projectId}'. Path: ${metadataPath}`;
        console.error(`[Service:updateProjectMetadata] ${message}`);
        throw new ProjectNotFoundError(message);
      }
      const message = `Failed to read or parse existing metadata for project ID '${projectId}'. Path: ${metadataPath}. Error: ${readError.message}`;
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
      const message = `Internal error: Updated metadata for project ID '${projectId}' failed validation. Details: ${JSON.stringify(
        errorDetails
      )}`;
      console.error(`[Service:updateProjectMetadata] ${message}`);
      throw new ProjectMetadataError(message); // <-- 使用 ProjectMetadataError
    }

    // 4. 写回文件
    try {
      await fs.writeFile(metadataPath, JSON.stringify(finalValidation.data, null, 2));
    } catch (writeError: any) {
      const message = `Failed to write updated metadata for project ID '${projectId}'. Path: ${metadataPath}. Error: ${writeError.message}`;
      console.error(`[Service:updateProjectMetadata] ${message}`);
      throw new ProjectMetadataError(message); // <-- 使用 ProjectMetadataError
    }

    console.log(
      `[Service:updateProjectMetadata] Project metadata updated successfully: ${metadataPath}`
    );
    return finalValidation.data;
  } catch (error) {
    // 重新抛出已知的自定义错误，或包装为 ProjectMetadataError
    if (error instanceof ProjectNotFoundError || error instanceof ProjectMetadataError) {
      throw error; // 直接重新抛出已知类型的错误
    }
    // 对于其他未知错误，包装成 ProjectMetadataError
    const message = `Unexpected error updating project metadata for ID '${projectId}'. Error: ${error instanceof Error ? error.message : String(error)
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
 * 列出所有项目。
 * @returns Promise<ProjectMetadata[]> 项目元数据列表。
 * @throws 如果发生严重的文件系统错误。
 */
export async function listProjects(): Promise<ProjectMetadata[]> {
  console.log(`[Service:listProjects] Listing all projects from: ${PROJECTS_BASE_DIR}`);
  try {
    // 确保基础项目目录存在
    try {
      await fs.access(PROJECTS_BASE_DIR);
    } catch (accessError: any) {
      if (accessError.code === "ENOENT") {
        console.log(
          `[Service:listProjects] Projects base directory not found: ${PROJECTS_BASE_DIR}, returning empty list.`
        );
        return []; // 如果根目录不存在，返回空列表
      }
      console.error(
        `[Service:listProjects] Error accessing projects base directory ${PROJECTS_BASE_DIR}:`,
        accessError
      );
      throw new Error(`Failed to access projects base directory: ${accessError.message}`);
    }

    const entries = await fs.readdir(PROJECTS_BASE_DIR, { withFileTypes: true });
    const projectDirs = entries.filter(
      (entry) => entry.isDirectory() && entry.name !== ".recycle_bin"
    );

    const projectsPromises = projectDirs.map(async (dir): Promise<ProjectMetadata | null> => {
      const projectIdFromName = dir.name;
      const safeReadProjectId = sanitizeProjectId(projectIdFromName);
      if (!safeReadProjectId) {
        console.warn(
          `[Service:listProjects] Skipping potentially invalid project directory name: ${projectIdFromName}`
        );
        return null;
      }
      const projectPath = path.join(PROJECTS_BASE_DIR, safeReadProjectId);
      const metadataPath = path.join(projectPath, "project.json");

      try {
        const metadataContent = await fs.readFile(metadataPath, "utf-8");
        const metadata = JSON.parse(metadataContent);
        // 使用 Zod Schema 验证元数据结构
        const validationResult = ProjectMetadataSchema.safeParse(metadata);
        if (!validationResult.success) {
          const errorDetails = validationResult.error.flatten().fieldErrors;
          console.warn(
            `[Service:listProjects] Invalid metadata for project ${safeReadProjectId} (path: ${metadataPath}). Details: ${JSON.stringify(errorDetails)}. Skipping this project.`
          );
          return null; // 如果元数据无效，则跳过此项目
        }
        // 确保返回的 id 与目录名一致
        if (validationResult.data.id !== safeReadProjectId) {
          console.warn(
            `[Service:listProjects] Metadata ID '${validationResult.data.id}' for project in directory '${safeReadProjectId}' does not match directory name. Using directory name as ID.`
          );
          // 可以选择覆盖 ID 或跳过，这里选择覆盖以保持一致性
          // validationResult.data.id = safeReadProjectId; // Zod 返回的是不可变对象，需要创建新对象或确保 schema 允许
        }
        // 返回经过验证的元数据，并确保 id 是目录名
        return { ...validationResult.data, id: safeReadProjectId };
      } catch (readError: any) {
        console.warn(
          `[Service:listProjects] Error reading or parsing metadata for project ${safeReadProjectId} (path: ${metadataPath}): ${readError.message}. Skipping this project.`
        );
        return null;
      }
    });

    const resolvedProjects = await Promise.all(projectsPromises);

    const validProjects = resolvedProjects.filter((p) => p !== null) as ProjectMetadata[];
    console.log(`[Service:listProjects] Found ${validProjects.length} valid projects.`);
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
 * 获取指定项目的元数据。
 * @param projectId 清理后的项目 ID。
 * @returns Promise<ProjectMetadata> 项目的元数据。
 * @throws 如果项目目录或元数据文件不存在 (ProjectNotFoundError)，或发生读写/解析错误 (ProjectMetadataError)。
 */
export async function getProjectMetadata(projectId: string): Promise<ProjectMetadata> {
  console.log(
    `[Service:getProjectMetadata] Attempting to get metadata for project ID '${projectId}'`
  );
  const projectPath = path.join(PROJECTS_BASE_DIR, projectId);
  const metadataPath = path.join(projectPath, "project.json");

  // 首先检查项目目录是否存在
  try {
    await fs.access(projectPath);
  } catch (accessError: any) {
    if (accessError.code === "ENOENT") {
      const message = `Project directory not found for ID '${projectId}'. Path: ${projectPath}`;
      console.warn(`[Service:getProjectMetadata] ${message}`);
      throw new ProjectNotFoundError(message);
    }
    // 其他访问目录的错误
    const message = `Failed to access project directory for ID '${projectId}'. Path: ${projectPath}. Error: ${accessError.message}`;
    console.error(`[Service:getProjectMetadata] ${message}`);
    throw new ProjectMetadataError(message);
  }

  // 读取并解析元数据文件
  try {
    const fileContent = await fs.readFile(metadataPath, "utf-8");
    const metadata = JSON.parse(fileContent);

    // 使用 Zod Schema 验证元数据结构
    const validationResult = ProjectMetadataSchema.safeParse(metadata);
    if (!validationResult.success) {
      const errorDetails = validationResult.error.flatten().fieldErrors;
      const message = `Project metadata for ID '${projectId}' is invalid. Path: ${metadataPath}. Details: ${JSON.stringify(
        errorDetails
      )}`;
      console.error(`[Service:getProjectMetadata] ${message}`);
      throw new ProjectMetadataError(message);
    }

    console.log(
      `[Service:getProjectMetadata] Successfully retrieved and validated metadata for project ID '${projectId}'.`
    );
    return validationResult.data;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      const message = `Project metadata file not found for ID '${projectId}'. Path: ${metadataPath}`;
      console.warn(`[Service:getProjectMetadata] ${message}`);
      throw new ProjectNotFoundError(message);
    }
    // 包括 JSON 解析错误等
    const message = `Failed to read or parse project metadata for ID '${projectId}'. Path: ${metadataPath}. Error: ${error.message}`;
    console.error(`[Service:getProjectMetadata] ${message}`);
    throw new ProjectMetadataError(message);
  }
}

/**
 * 创建一个新项目。
 * @param projectId 清理后的项目 ID。
 * @param projectName 原始项目名称。
 * @param appVersion 当前应用版本。
 * @returns Promise<ProjectMetadata> 创建的项目元数据。
 * @throws 如果项目已存在 (ProjectConflictError)，或发生其他创建错误 (ProjectCreationError)。
 */
export async function createProject(
  projectId: string,
  projectName: string,
  appVersion: string
): Promise<ProjectMetadata> {
  console.log(
    `[Service:createProject] Attempting to create project '${projectName}' with ID '${projectId}'`
  );
  const projectPath = path.join(PROJECTS_BASE_DIR, projectId);
  const projectWorkflowsDir = getProjectWorkflowsDir(projectId); // 复用现有函数
  const metadataPath = path.join(projectPath, "project.json");

  try {
    // 1. 检查项目是否已存在
    try {
      await fs.access(projectPath);
      // 如果 access 成功，说明项目已存在
      const errorMessage = `Project with ID '${projectId}' (derived from name '${projectName}') already exists.`;
      console.warn(`[Service:createProject] ${errorMessage}`);
      throw new ProjectConflictError(errorMessage);
    } catch (accessError: any) {
      if (accessError.code !== "ENOENT") {
        // 如果不是“文件不存在”错误，则是其他访问错误
        console.error(
          `[Service:createProject] Error checking project existence for ID '${projectId}':`,
          accessError
        );
        throw new ProjectCreationError(`Failed to check project existence: ${accessError.message}`);
      }
      // ENOENT 意味着项目不存在，可以继续创建
    }

    // 2. 创建项目目录和 workflows 子目录
    try {
      await fs.mkdir(projectWorkflowsDir, { recursive: true });
      console.log(`[Service:createProject] Created project directory: ${projectPath}`);
      console.log(`[Service:createProject] Created workflows directory: ${projectWorkflowsDir}`);
    } catch (mkdirError: any) {
      console.error(
        `[Service:createProject] Error creating project directories for ID '${projectId}':`,
        mkdirError
      );
      throw new ProjectCreationError(`Failed to create project directories: ${mkdirError.message}`);
    }

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
        "[Service:createProject] Generated project metadata validation failed:",
        errorDetails
      );
      // 尝试清理创建的目录
      try {
        await fs.rm(projectPath, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error(
          `[Service:createProject] Failed to cleanup partially created project directory ${projectPath} after metadata validation error:`,
          cleanupError
        );
      }
      throw new ProjectCreationError("Internal error: Generated project metadata is invalid.");
    }

    // 4. 写入元数据文件
    try {
      await fs.writeFile(metadataPath, JSON.stringify(metadataValidation.data, null, 2));
      console.log(`[Service:createProject] Created project metadata file: ${metadataPath}`);
    } catch (writeError: any) {
      console.error(
        `[Service:createProject] Error writing metadata file for ID '${projectId}':`,
        writeError
      );
      // 尝试清理创建的目录
      try {
        await fs.rm(projectPath, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error(
          `[Service:createProject] Failed to cleanup partially created project directory ${projectPath} after write error:`,
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
        `[Service:createProject] Successfully verified metadata file existence: ${metadataPath}`
      );
    } catch (verifyError: any) {
      console.error(
        `[Service:createProject] Failed to verify metadata file existence after write for ID '${projectId}':`,
        verifyError
      );
      // 这是一个严重问题，但元数据可能已写入。根据策略，这里可以选择抛出错误或仅记录。
      // 为了保持一致性，如果验证失败，也视为创建失败。
      // 注意：此时目录和文件可能已创建，清理逻辑在写入失败时已执行。
      // 如果希望在这里也清理，需要更复杂的逻辑。
      throw new ProjectCreationError(
        `Failed to verify project metadata file existence after write: ${verifyError.message}`
      );
    }

    return metadataValidation.data;
  } catch (error: any) {
    // 重新抛出已知的自定义错误，或包装未知错误
    if (error instanceof ProjectConflictError || error instanceof ProjectCreationError) {
      throw error;
    }
    console.error(
      `[Service:createProject] Unexpected error creating project '${projectName}' (ID: ${projectId}):`,
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
 * 列出指定项目内的所有工作流。
 * @param projectId 清理后的项目 ID。
 * @returns Promise<ListedWorkflow[]> 工作流列表。
 * @throws 如果发生无法处理的文件系统错误。
 */
export async function listWorkflows(projectId: string): Promise<ListedWorkflow[]> {
  console.log(`[Service:listWorkflows] Listing workflows for project ID '${projectId}'`);
  const projectWorkflowsDir = getProjectWorkflowsDir(projectId); // 复用现有函数

  try {
    // 检查工作流目录是否存在
    try {
      await fs.access(projectWorkflowsDir);
    } catch (accessError: any) {
      if (accessError.code === "ENOENT") {
        console.log(
          `[Service:listWorkflows] Workflows directory not found for project ${projectId}, returning empty list. Path: ${projectWorkflowsDir}`
        );
        return []; // 如果目录不存在，返回空列表，与路由层当前行为一致
      }
      // 其他访问目录的错误
      throw new Error(
        `Failed to access workflows directory for project ${projectId}: ${accessError.message}`
      );
    }

    const files = await fs.readdir(projectWorkflowsDir);
    const workflowFiles = files.filter((file) => extname(file).toLowerCase() === ".json");

    const workflowsPromises = workflowFiles.map(async (file): Promise<ListedWorkflow | null> => {
      const id = basename(file, ".json");
      const filePath = path.join(projectWorkflowsDir, file);
      let name = id; // 默认名称为 ID
      let description: string | undefined;
      let creationMethod: string | undefined;
      let referencedWorkflows: string[] | undefined;

      try {
        const fileContent = await fs.readFile(filePath, "utf-8");
        // 尝试解析为 WorkflowObject 以便访问元数据
        // 注意：这里不进行严格的 WorkflowObjectSchema 验证，因为我们只关心列表所需的基本信息
        // 完整的验证在 getWorkflow 时进行
        const workflowData: Partial<WorkflowObject> = JSON.parse(fileContent);

        name = workflowData.name || (workflowData as any).label || id; // 保留 label 作为备选
        description = workflowData.description;
        creationMethod = workflowData.creationMethod;
        referencedWorkflows = workflowData.referencedWorkflows;
      } catch (readError: any) {
        // 如果读取或解析单个文件失败，记录错误，但继续处理其他文件
        // 使用 ID 作为名称，其他字段为 undefined
        console.error(
          `[Service:listWorkflows] Error reading/parsing workflow file ${filePath} for listing in project ${projectId}:`,
          readError.message
        );
      }
      return { id, name, description, creationMethod, referencedWorkflows };
    });

    const resolvedWorkflows = (await Promise.all(workflowsPromises)).filter(
      (w) => w !== null
    ) as ListedWorkflow[];
    console.log(
      `[Service:listWorkflows] Found ${resolvedWorkflows.length} workflows for project ID '${projectId}'.`
    );
    return resolvedWorkflows;
  } catch (error: any) {
    // 捕获访问或读取目录时的其他错误
    console.error(
      `[Service:listWorkflows] Error listing workflows for project ID '${projectId}':`,
      error
    );
    throw new Error(`Failed to list workflows for project ${projectId}: ${error.message}`);
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

// 从 @comfytavern/types 导入 CreateWorkflowObjectSchema 推断出的类型
import { type CreateWorkflowObject } from "@comfytavern/types";

/**
 * 在指定项目中创建新的工作流文件。
 * @param projectId 清理后的项目 ID。
 * @param workflowInputData 经过 Zod 验证的创建工作流所需的数据 (来自 CreateWorkflowObjectSchema)。
 * @param appVersion 当前应用版本。
 * @returns Promise<WorkflowObject> 创建的完整工作流对象 (包含 id 和元数据)。
 * @throws 如果工作流已存在 (WorkflowConflictError)，或发生其他创建错误 (WorkflowCreationError)。
 */
export async function createWorkflow(
  projectId: string,
  workflowInputData: CreateWorkflowObject, // 使用从 Zod schema 推断的类型
  appVersion: string
): Promise<WorkflowObject> {
  const { name, nodes, edges, viewport, interfaceInputs, interfaceOutputs, referencedWorkflows } =
    workflowInputData;
  const workflowId = generateSafeWorkflowFilename(name); // 复用 helpers 中的函数

  console.log(
    `[Service:createWorkflow] Attempting to create workflow '${name}' (ID: ${workflowId}) in project '${projectId}'`
  );
  const projectWorkflowsDir = getProjectWorkflowsDir(projectId);
  const filePath = path.join(projectWorkflowsDir, `${workflowId}.json`);

  try {
    // 1. 确保工作流目录存在
    try {
      await fs.mkdir(projectWorkflowsDir, { recursive: true });
    } catch (mkdirError: any) {
      const message = `Failed to create workflows directory for project ${projectId}. Path: ${projectWorkflowsDir}. Error: ${mkdirError.message}`;
      console.error(`[Service:createWorkflow] ${message}`);
      throw new WorkflowCreationError(message);
    }

    // 2. 检查工作流文件是否已存在
    try {
      await fs.access(filePath);
      // 如果 access 成功，说明文件已存在
      const message = `Workflow with name '${name}' (filename: ${workflowId}.json) already exists in project '${projectId}'.`;
      console.warn(`[Service:createWorkflow] ${message}`);
      throw new WorkflowConflictError(message);
    } catch (accessError: any) {
      if (accessError.code !== "ENOENT") {
        // 如果不是“文件不存在”错误，则是其他访问错误
        const message = `Error checking workflow existence for '${name}' (ID: ${workflowId}) in project '${projectId}'. Error: ${accessError.message}`;
        console.error(`[Service:createWorkflow] ${message}`);
        throw new WorkflowCreationError(message);
      }
      // ENOENT 意味着文件不存在，可以继续创建
    }

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
      const message = `Internal error: Generated workflow data for '${name}' (ID: ${workflowId}) is invalid. Details: ${JSON.stringify(
        errorDetails
      )}`;
      console.error(`[Service:createWorkflow] ${message}`);
      // 此处不尝试清理，因为文件还未创建
      throw new WorkflowCreationError(message);
    }

    // 4. 写入工作流文件
    try {
      await fs.writeFile(filePath, JSON.stringify(validationResult.data, null, 2)); // 保存验证后的数据
      console.log(`[Service:createWorkflow] Workflow file created: ${filePath}`);
    } catch (writeError: any) {
      const message = `Failed to write workflow file for '${name}' (ID: ${workflowId}) in project '${projectId}'. Error: ${writeError.message}`;
      console.error(`[Service:createWorkflow] ${message}`);
      // 此处不尝试清理，因为文件创建失败
      throw new WorkflowCreationError(message);
    }

    // 创建工作流成功后，更新项目的 updatedAt 元数据
    try {
      await updateProjectMetadata(projectId, {}); // 传递空对象，仅更新 updatedAt
      // console.log(`[Service:createWorkflow] Successfully updated project '${projectId}' metadata after workflow creation.`);
    } catch (metaError) {
      console.warn(`[Service:createWorkflow] Failed to update project metadata for '${projectId}' after workflow creation:`, metaError);
      // 工作流本身已创建成功，元数据更新失败通常不应阻塞主流程，但需要记录
    }

    return validationResult.data; // 返回包含 id 和元数据的完整对象
  } catch (error: any) {
    if (error instanceof WorkflowConflictError || error instanceof WorkflowCreationError) {
      throw error;
    }
    const message = `Unexpected error creating workflow '${name}' (ID: ${workflowId}) in project '${projectId}'. Error: ${error.message}`;
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
 * 获取指定项目中的特定工作流。
 * @param projectId 清理后的项目 ID。
 * @param workflowId 清理后的工作流 ID (文件名，不含扩展名)。
 * @returns Promise<WorkflowObject> 工作流对象。
 * @throws 如果工作流文件不存在 (WorkflowNotFoundError)，或读取/解析/验证失败 (WorkflowLoadError)。
 */
export async function getWorkflow(projectId: string, workflowId: string): Promise<WorkflowObject> {
  console.log(
    `[Service:getWorkflow] Attempting to get workflow ID '${workflowId}' from project '${projectId}'`
  );
  const projectWorkflowsDir = getProjectWorkflowsDir(projectId);
  const filePath = path.join(projectWorkflowsDir, `${workflowId}.json`);

  try {
    const fileContent = await fs.readFile(filePath, "utf-8");
    const jsonData = JSON.parse(fileContent); // 首先尝试解析 JSON

    // 使用 WorkflowObjectSchema 进行严格验证
    // 注意：WorkflowObjectSchema 中的 id 是可选的，但服务层返回时应确保 id 存在且与请求的 workflowId 一致
    // 或者，我们可以修改 WorkflowObjectSchema 使 id 成为必需，并在加载时填充它。
    // 当前 WorkflowObjectSchema (BaseWorkflowObjectSchema) 的 id 是 z.string().optional()
    // 但通常我们期望加载后对象有 id。

    // 为了确保返回的对象包含与文件名一致的 id，我们先解析，然后合并 id
    const parsedData = WorkflowObjectSchema.safeParse(jsonData);

    if (!parsedData.success) {
      const errorDetails = parsedData.error.flatten().fieldErrors;
      const message = `Workflow data validation failed for '${workflowId}' in project '${projectId}'. Path: ${filePath}. Details: ${JSON.stringify(
        errorDetails
      )}`;
      console.error(`[Service:getWorkflow] ${message}`);
      throw new WorkflowLoadError(message);
    }

    // 确保返回的 workflow 对象包含正确的 id (与文件名一致)
    // 如果 schema 中的 id 是可选的，而 jsonData 中没有 id，则需要手动添加
    // 如果 schema 中的 id 是必须的，则 jsonData 中必须有 id，且应与 workflowId 匹配 (或我们覆盖它)
    const validatedData = parsedData.data;

    // 如果 validatedData.id 存在且与 workflowId 不符，这是一个潜在问题，但通常我们信任文件名作为权威 ID
    // 如果 validatedData.id 不存在 (因为 schema 中 id 是可选的)，我们必须设置它
    if (!validatedData.id || validatedData.id !== workflowId) {
      // console.warn(`[Service:getWorkflow] Workflow ID in file ('${validatedData.id}') differs from filename ID ('${workflowId}'). Using filename ID.`);
      // (validatedData as any).id = workflowId; // 不推荐直接修改，最好在返回时构造新对象或确保 schema 强制 id
    }

    console.log(
      `[Service:getWorkflow] Successfully retrieved and validated workflow '${workflowId}' from project '${projectId}'.`
    );
    // 返回时确保 id 字段是 workflowId (来自文件名)
    // WorkflowObject 类型定义中 id 是 string | undefined
    // 但我们作为服务，应该返回一个带有确定 id 的对象
    return { ...validatedData, id: workflowId };
  } catch (error: any) {
    if (error.code === "ENOENT") {
      const message = `Workflow file not found for ID '${workflowId}' in project '${projectId}'. Path: ${filePath}`;
      console.warn(`[Service:getWorkflow] ${message}`);
      throw new WorkflowNotFoundError(message);
    }
    if (error instanceof SyntaxError) {
      // JSON 解析错误
      const message = `Failed to parse JSON for workflow '${workflowId}' in project '${projectId}'. Path: ${filePath}. Error: ${error.message}`;
      console.error(`[Service:getWorkflow] ${message}`);
      throw new WorkflowLoadError(message);
    }
    if (error instanceof WorkflowLoadError || error instanceof WorkflowNotFoundError) {
      // 重抛已知错误
      throw error;
    }
    // 其他未知错误
    const message = `Failed to load workflow '${workflowId}' from project '${projectId}'. Path: ${filePath}. Error: ${error.message}`;
    console.error(`[Service:getWorkflow] ${message}`);
    throw new WorkflowLoadError(message);
  }
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

// 从 @comfytavern/types 导入 UpdateWorkflowObject 类型
import { type UpdateWorkflowObject } from "@comfytavern/types";

/**
 * 更新指定项目中的特定工作流。
 * @param projectId 清理后的项目 ID。
 * @param workflowId 当前工作流的 ID (文件名，不含扩展名)。
 * @param workflowUpdateData 经过 Zod 验证的更新工作流所需的数据。
 * @param appVersion 当前应用版本。
 * @returns Promise<WorkflowObject> 更新后的完整工作流对象。
 * @throws 如果工作流不存在 (WorkflowNotFoundError)，新名称冲突 (WorkflowConflictError)，或更新失败 (WorkflowUpdateError)。
 */
export async function updateWorkflow(
  projectId: string,
  workflowId: string,
  workflowUpdateData: UpdateWorkflowObject, // 使用从 Zod schema 推断的类型
  appVersion: string
): Promise<WorkflowObject> {
  console.log(
    `[Service:updateWorkflow] Attempting to update workflow ID '${workflowId}' in project '${projectId}'`
  );
  const projectWorkflowsDir = getProjectWorkflowsDir(projectId);
  const currentFilePath = path.join(projectWorkflowsDir, `${workflowId}.json`);

  const newName = workflowUpdateData.name; // name 属性在 UpdateWorkflowObjectSchema 中是必需的
  const newSafeWorkflowId = generateSafeWorkflowFilename(newName);
  const newFilePath = path.join(projectWorkflowsDir, `${newSafeWorkflowId}.json`);

  try {
    // 1. 确保工作流目录存在 (虽然 getProjectWorkflowsDir 不会创建，但后续操作会)
    //    并检查当前工作流文件是否存在
    try {
      await fs.access(currentFilePath);
    } catch (accessError: any) {
      if (accessError.code === "ENOENT") {
        const message = `Workflow with ID '${workflowId}' not found in project '${projectId}' for update. Path: ${currentFilePath}`;
        console.warn(`[Service:updateWorkflow] ${message}`);
        throw new WorkflowNotFoundError(message);
      }
      throw new WorkflowUpdateError(
        `Failed to access existing workflow file: ${accessError.message}`
      );
    }

    // 2. 如果文件名需要改变 (因为 name 改变了)，检查新文件名是否冲突
    if (newSafeWorkflowId !== workflowId) {
      try {
        await fs.access(newFilePath);
        // 如果新文件已存在，并且不是自身 (理论上 newSafeWorkflowId !== workflowId 已经保证了这点)
        const message = `Cannot rename workflow. A workflow with the name '${newName}' (filename: ${newSafeWorkflowId}.json) already exists in project '${projectId}'.`;
        console.warn(`[Service:updateWorkflow] ${message}`);
        throw new WorkflowConflictError(message);
      } catch (accessError: any) {
        if (accessError.code !== "ENOENT") {
          // 其他访问错误
          throw new WorkflowUpdateError(
            `Error checking for new workflow file conflict: ${accessError.message}`
          );
        }
        // ENOENT 意味着新文件名不冲突，可以继续
      }
    }

    // 3. 读取现有数据以保留 createdAt 等元数据
    let existingData: Partial<WorkflowObject> = {};
    try {
      const oldContent = await fs.readFile(currentFilePath, "utf-8");
      existingData = JSON.parse(oldContent);
    } catch (readError: any) {
      // 如果读取失败，这很严重，但我们可能仍想尝试覆盖写入
      console.warn(
        `[Service:updateWorkflow] Could not read existing workflow file ${currentFilePath} during update: ${readError.message}. Proceeding with update.`
      );
      // 不在此处抛出，允许覆盖创建，但 createdAt 会是新的
    }

    // 4. 准备要保存的数据
    const now = new Date().toISOString();
    // workflowUpdateData 是 UpdateWorkflowObject 类型，它可能包含 id
    // 我们需要确保最终保存的数据符合 WorkflowObject 结构，并且 id 是正确的
    const { id: idFromBody, ...updatePayload } = workflowUpdateData;

    const dataToSave: WorkflowObject = {
      // 基本属性来自 updatePayload (已经是 WorkflowStorageObject 的大部分)
      name: newName, // 确保使用新的 name
      nodes: updatePayload.nodes || [],
      edges: (updatePayload.edges || []).map((edge) => ({
        ...edge,
        sourceHandle: edge.sourceHandle ?? "",
        targetHandle: edge.targetHandle ?? "",
        markerEnd: undefined,
      })),
      viewport: updatePayload.viewport || { x: 0, y: 0, zoom: 1 }, // 确保 viewport 存在
      interfaceInputs: updatePayload.interfaceInputs || {},
      interfaceOutputs: updatePayload.interfaceOutputs || {},
      creationMethod: updatePayload.creationMethod ?? (existingData as any).creationMethod,
      referencedWorkflows: updatePayload.referencedWorkflows || [],
      previewTarget:
        updatePayload.previewTarget === undefined
          ? (existingData as any).previewTarget
          : updatePayload.previewTarget, // 保留旧的或用新的，处理 null
      // 元数据
      id: newSafeWorkflowId, // 最终的 ID 是基于新名称的
      createdAt: (existingData as any).createdAt || now, // 保留原始创建时间，如果读取失败则用当前时间
      updatedAt: now,
      version: appVersion,
      description:
        updatePayload.description === undefined
          ? (existingData as any).description
          : updatePayload.description, // 保留旧的或用新的
    };

    // 验证最终数据
    const validationResult = WorkflowObjectSchema.safeParse(dataToSave);
    if (!validationResult.success) {
      const errorDetails = validationResult.error.flatten().fieldErrors;
      const message = `Internal error: Updated workflow data for '${newName}' (ID: ${newSafeWorkflowId}) is invalid. Details: ${JSON.stringify(
        errorDetails
      )}`;
      console.error(`[Service:updateWorkflow] ${message}`);
      throw new WorkflowUpdateError(message);
    }
    const validatedDataToSave = validationResult.data;

    // 5. 写入文件并处理重命名
    const finalFilePath = path.join(projectWorkflowsDir, `${validatedDataToSave.id}.json`); // 使用验证后数据中的 id

    try {
      await fs.writeFile(finalFilePath, JSON.stringify(validatedDataToSave, null, 2));
      console.log(`[Service:updateWorkflow] Workflow file saved: ${finalFilePath}`);

      // 如果文件名改变了，删除旧文件
      if (newSafeWorkflowId !== workflowId && currentFilePath !== finalFilePath) {
        // 确保旧文件确实不同
        try {
          await fs.unlink(currentFilePath);
          console.log(`[Service:updateWorkflow] Old workflow file deleted: ${currentFilePath}`);
        } catch (unlinkError: any) {
          console.warn(
            `[Service:updateWorkflow] Failed to delete old workflow file ${currentFilePath} after rename: ${unlinkError.message}. Continuing.`
          );
        }
      }
    } catch (writeError: any) {
      const message = `Failed to write workflow file for '${newName}' (ID: ${newSafeWorkflowId}). Error: ${writeError.message}`;
      console.error(`[Service:updateWorkflow] ${message}`);
      throw new WorkflowUpdateError(message);
    }

    // 6. 后台同步引用此工作流的 NodeGroup (如果接口有变)
    // syncReferencingNodeGroups 需要 GroupInterfaceInfo
    const newInterface: GroupInterfaceInfo = {
      inputs: validatedDataToSave.interfaceInputs || {},
      outputs: validatedDataToSave.interfaceOutputs || {},
    };
    // 比较新旧接口是否真的改变，避免不必要的同步 (可选优化)
    // const oldInterfaceForSync = (existingData as WorkflowObject)?.interfaceInputs || (existingData as WorkflowObject)?.interfaceOutputs ? {
    //   inputs: (existingData as WorkflowObject).interfaceInputs || {},
    //   outputs: (existingData as WorkflowObject).interfaceOutputs || {}
    // } : undefined;
    // if (!oldInterfaceForSync || !isEqual(oldInterfaceForSync, newInterface)) { ... }

    // 使用 newSafeWorkflowId，因为它是我们在此上下文中确定的、且保证为 string 的最终 ID。
    // validatedDataToSave.id 的类型签名是 string | undefined，尽管在此处它应有值。
    syncReferencingNodeGroups(projectId, newSafeWorkflowId, newInterface).catch((syncError) => {
      console.error(
        `[Service:updateWorkflow] Error during background NodeGroup sync for ${newSafeWorkflowId} in project ${projectId}:`,
        syncError
      );
    });

    // 更新工作流成功后，更新项目的 updatedAt 元数据
    try {
      await updateProjectMetadata(projectId, {}); // 传递空对象，仅更新 updatedAt
      // console.log(`[Service:updateWorkflow] Successfully updated project '${projectId}' metadata after workflow update.`);
    } catch (metaError) {
      console.warn(`[Service:updateWorkflow] Failed to update project metadata for '${projectId}' after workflow update:`, metaError);
      // 工作流本身已更新成功，元数据更新失败通常不应阻塞主流程，但需要记录
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
    const message = `Unexpected error updating workflow '${workflowId}' in project '${projectId}'. Error: ${error.message}`;
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
 * 将指定项目中的特定工作流移动到回收站。
 * @param projectId 清理后的项目 ID。
 * @param workflowId 清理后的工作流 ID (文件名，不含扩展名)。
 * @returns Promise<void> 操作成功则无返回。
 * @throws 如果工作流文件不存在 (WorkflowNotFoundError)，或移动操作失败 (WorkflowDeletionError)。
 */
export async function deleteWorkflowToRecycleBin(
  projectId: string,
  workflowId: string
): Promise<void> {
  console.log(
    `[Service:deleteWorkflowToRecycleBin] Attempting to move workflow ID '${workflowId}' in project '${projectId}' to recycle bin.`
  );
  const projectWorkflowsDir = getProjectWorkflowsDir(projectId);
  const filePath = path.join(projectWorkflowsDir, `${workflowId}.json`);

  // 定义回收站路径
  const recycleBinProjectDir = path.join(PROJECTS_BASE_DIR, ".recycle_bin", projectId);
  const recycleBinWorkflowsDir = path.join(recycleBinProjectDir, "workflows");
  const recycleBinPath = path.join(recycleBinWorkflowsDir, `${workflowId}_${Date.now()}.json`); // 添加时间戳防止重名

  try {
    // 1. 检查原始文件是否存在
    try {
      await fs.access(filePath);
    } catch (accessError: any) {
      if (accessError.code === "ENOENT") {
        const message = `Workflow file not found for ID '${workflowId}' in project '${projectId}' for deletion. Path: ${filePath}`;
        console.warn(`[Service:deleteWorkflowToRecycleBin] ${message}`);
        throw new WorkflowNotFoundError(message);
      }
      throw new WorkflowDeletionError(
        `Failed to access workflow file for deletion: ${accessError.message}`
      );
    }

    // 2. 确保回收站目录存在
    try {
      await fs.mkdir(recycleBinWorkflowsDir, { recursive: true });
    } catch (mkdirError: any) {
      const message = `Failed to create recycle bin directory for project '${projectId}'. Path: ${recycleBinWorkflowsDir}. Error: ${mkdirError.message}`;
      console.error(`[Service:deleteWorkflowToRecycleBin] ${message}`);
      throw new WorkflowDeletionError(message);
    }

    // 3. 将文件移动到回收站
    try {
      await fs.rename(filePath, recycleBinPath);
      console.log(
        `[Service:deleteWorkflowToRecycleBin] Workflow moved to recycle bin: ${filePath} -> ${recycleBinPath}`
      );

      // 删除工作流成功后，更新项目的 updatedAt 元数据
      try {
        await updateProjectMetadata(projectId, {}); // 传递空对象，仅更新 updatedAt
        // console.log(`[Service:deleteWorkflowToRecycleBin] Successfully updated project '${projectId}' metadata after workflow deletion.`);
      } catch (metaError) {
        console.warn(`[Service:deleteWorkflowToRecycleBin] Failed to update project metadata for '${projectId}' after workflow deletion:`, metaError);
        // 工作流本身已删除成功，元数据更新失败通常不应阻塞主流程，但需要记录
      }

    } catch (renameError: any) {
      const message = `Failed to move workflow '${workflowId}' to recycle bin in project '${projectId}'. Error: ${renameError.message}`;
      console.error(`[Service:deleteWorkflowToRecycleBin] ${message}`);
      throw new WorkflowDeletionError(message);
    }
  } catch (error: any) {
    if (error instanceof WorkflowNotFoundError || error instanceof WorkflowDeletionError) {
      throw error;
    }
    const message = `Unexpected error deleting workflow '${workflowId}' in project '${projectId}'. Error: ${error.message}`;
    console.error(`[Service:deleteWorkflowToRecycleBin] ${message}`);
    throw new WorkflowDeletionError(message);
  }
}
