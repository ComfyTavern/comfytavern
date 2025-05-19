import { Elysia, t } from 'elysia';
import { z } from 'zod'; // 导入 z 以使用 Zod
import { promises as fs } from 'node:fs';
import path, { join, basename, extname } from 'node:path';
import {
  // Use the correct schema names exported from @comfytavern/types
  WorkflowObjectSchema, // Base schema for validation (might be used if needed)
  CreateWorkflowObjectSchema, // Schema for creating workflows
  UpdateWorkflowObjectSchema, // Schema for updating workflows
  type WorkflowStorageObject, // Type for storage format
  type WorkflowObject, // Type including metadata
  type GroupInterfaceInfo,
  ProjectMetadataSchema, // Import ProjectMetadataSchema
  type ProjectMetadata, // 导入 Zod 推断的类型
} from '@comfytavern/types';
import {
  sanitizeProjectId,
  sanitizeWorkflowIdFromParam,
  generateSafeWorkflowFilename
} from '../utils/helpers';
import { PROJECTS_BASE_DIR } from '../config'; // 导入项目基础目录
import { getProjectWorkflowsDir, syncReferencingNodeGroups, updateProjectMetadata } from '../services/projectService'; // 导入服务函数

// 定义依赖项的类型
// 更新依赖接口，移除 projectsBaseDir，因为它现在从 config 导入
// 更新依赖接口，移除服务函数，因为它们现在直接从 service 导入
interface ProjectRoutesDependencies {
  appVersion: string;
  // getProjectWorkflowsDir 不再需要传递
  // syncReferencingNodeGroups 不再需要传递
}

// Define the schema for updating project metadata (partial, excluding id and createdAt)
const ProjectMetadataUpdateSchema = ProjectMetadataSchema.partial().omit({ id: true, createdAt: true });

// 定义创建项目的请求体 Zod Schema
const CreateProjectBodySchema = z.object({
  name: z.string().min(1, { message: "Project name cannot be empty." }),
});

// 导出挂载项目路由的函数
export const addProjectRoutes = (
  app: Elysia,
  // 从依赖中移除 projectsBaseDir
  // 从依赖中移除服务函数
  { appVersion }: ProjectRoutesDependencies
): Elysia => {
  return app.group('/api/projects', (group) => group
    // GET /api/projects - 列出所有项目
    .get('/', async ({ set }) => { // 注意：这里使用的是导入的 PROJECTS_BASE_DIR
      console.log(`[GET /api/projects] Listing all projects from: ${PROJECTS_BASE_DIR}`);
      try {
        // 确保基础项目目录存在
        try {
          await fs.access(PROJECTS_BASE_DIR);
        } catch (accessError: any) {
          if (accessError.code === 'ENOENT') {
            console.log(`Projects base directory not found: ${PROJECTS_BASE_DIR}, returning empty list.`);
            return []; // 如果根目录不存在，返回空列表
          }
          throw accessError; // 其他错误则抛出
        }

        const entries = await fs.readdir(PROJECTS_BASE_DIR, { withFileTypes: true });
        const projectDirs = entries.filter(entry => entry.isDirectory() && entry.name !== '.recycle_bin');

        const projects = await Promise.all(projectDirs.map(async (dir) => {
          const projectId = dir.name;
          // 对读出的目录名也进行一次清理，以防万一
          const safeReadProjectId = sanitizeProjectId(projectId);
          if (!safeReadProjectId) {
              console.warn(`Skipping potentially invalid project directory name: ${projectId}`);
              console.warn(`Skipping potentially invalid project directory name during list: ${projectId}`);
              return null; // 跳过无效的目录名
          }
          const projectPath = path.join(PROJECTS_BASE_DIR, safeReadProjectId);
          const metadataPath = path.join(projectPath, 'project.json');
          let projectName = safeReadProjectId; // 默认使用清理后的目录名

          try {
            const metadataContent = await fs.readFile(metadataPath, 'utf-8');
            const metadata = JSON.parse(metadataContent);
            projectName = metadata.name || safeReadProjectId; // 优先使用 metadata 中的 name
          } catch (readError: any) {
            if (readError.code !== 'ENOENT') {
              console.warn(`Error reading metadata for project ${safeReadProjectId}:`, readError);
            }
            // 如果 metadata 文件不存在或读取失败，则使用 safeReadProjectId 作为 name
          }
          return { id: safeReadProjectId, name: projectName };
        }));

        // 过滤掉 map 中可能产生的 null 值
        const validProjects = projects.filter(p => p !== null);
        console.log(`[GET /api/projects] Found ${validProjects.length} valid projects.`);
        return validProjects;

      } catch (error) {
        console.error('Error listing projects:', error);
        set.status = 500;
        return { error: 'Failed to list projects' };
      } // End of GET /
    })

    // POST /api/projects - 创建新项目
    .post('/', async ({ body, set }) => {
      // 使用 Zod Schema 验证请求体
      const validationResult = CreateProjectBodySchema.safeParse(body);
      if (!validationResult.success) {
        set.status = 400; // Bad Request，因为请求体不符合预期
        // Elysia 的 t.Object 验证失败时，status 可能是 422 Unprocessable Entity
        // 但由于我们现在手动用 Zod 验证，400 更合适表示请求格式错误
        const errors = validationResult.error.flatten().fieldErrors;
        console.error('[POST /api/projects] Project creation body validation failed:', errors);
        return { error: 'Invalid project creation data', details: errors };
      }

      const { name: projectName } = validationResult.data; // data 来自 Zod 的 safeParse
      const projectId = sanitizeProjectId(projectName); // 使用 projectName 生成 ID
      if (!projectId) {
        set.status = 400;
        console.error(`[POST /api/projects] Invalid project name after sanitization: ${projectName}`);
        return { error: 'Invalid project name, results in empty ID after sanitization.' };
      }

      const projectPath = path.join(PROJECTS_BASE_DIR, projectId);
      const projectWorkflowsDir = getProjectWorkflowsDir(projectId); // 使用已有的服务函数
      const metadataPath = path.join(projectPath, 'project.json');

      try {
        // 检查项目是否已存在
        try {
          await fs.access(projectPath);
          set.status = 409; // Conflict
          console.warn(`[POST /api/projects] Project with ID '${projectId}' (name: '${projectName}') already exists.`);
          return { error: `Project with ID '${projectId}' (derived from name '${projectName}') already exists.` };
        } catch (accessError: any) {
          if (accessError.code !== 'ENOENT') throw accessError; // 如果不是“文件不存在”错误，则抛出
          // ENOENT 意味着项目不存在，可以继续创建
        }

        // 创建项目目录和 workflows 子目录
        await fs.mkdir(projectWorkflowsDir, { recursive: true }); // recursive 会同时创建 projectPath
        console.log(`[POST /api/projects] Created project directory: ${projectPath}`);
        console.log(`[POST /api/projects] Created workflows directory: ${projectWorkflowsDir}`);

        // 创建 project.json 元数据文件
        const now = new Date().toISOString();
        // 使用 z.infer 从 Zod Schema 推断类型
        const projectMetadata: ProjectMetadata = {
          id: projectId,
          name: projectName,
          createdAt: now,
          updatedAt: now,
          version: appVersion, // 使用依赖注入的 appVersion
          description: `Project created on ${now}`, // 可选的描述
          preferredView: 'editor', // 添加默认 preferredView
          schemaVersion: appVersion, // 这个后续不会被更新，所以直接使用 appVersion 即可
          // 其他元数据字段可以根据需要添加
        };

        // 验证元数据是否符合 Schema
        const metadataValidation = ProjectMetadataSchema.safeParse(projectMetadata);
        if (!metadataValidation.success) {
            set.status = 500; // 内部服务器错误，因为这是我们自己生成的数据
            console.error('[POST /api/projects] Generated project metadata validation failed:', metadataValidation.error.flatten().fieldErrors);
            // 尝试清理创建的目录
            try {
                await fs.rm(projectPath, { recursive: true, force: true });
            } catch (cleanupError) {
                console.error(`[POST /api/projects] Failed to cleanup partially created project directory ${projectPath}:`, cleanupError);
            }
            return { error: 'Failed to create project due to internal metadata validation error.' };
        }

        await fs.writeFile(metadataPath, JSON.stringify(metadataValidation.data, null, 2));
        console.log(`[POST /api/projects] Attempted to create project metadata file: ${metadataPath}`);

        // 验证文件是否真的创建成功
        try {
          await fs.access(metadataPath);
          console.log(`[POST /api/projects] Successfully verified metadata file existence: ${metadataPath}`);
        } catch (accessErr: any) {
          console.error(`[POST /api/projects] Failed to verify metadata file existence after write: ${metadataPath}`, accessErr);
          // 如果文件未创建，这本身就是一个大问题，可能需要更复杂的错误处理
          // 但为了让前端能收到创建的项目对象（即使后续加载可能失败），我们暂时不在这里抛出错误并回滚
          // 理想情况下，这里应该回滚目录创建等操作
          set.status = 500; // 指示服务器内部错误，因为文件操作未按预期执行
          return { error: 'Failed to create project metadata file on server despite no initial error.' };
        }

        set.status = 201; // Created
        return metadataValidation.data; // 返回创建的项目元数据

      } catch (error) {
        console.error(`[POST /api/projects] Error creating project '${projectName}' (ID: ${projectId}):`, error);
        set.status = 500;
        // 尝试清理可能已创建的目录
        try {
            await fs.rm(projectPath, { recursive: true, force: true });
        } catch (cleanupError) {
            console.error(`[POST /api/projects] Failed to cleanup partially created project directory ${projectPath} after error:`, cleanupError);
        }
        return { error: 'Failed to create project' };
      }
    }, {
      // 注意：由于我们在 handler 内部使用 Zod 进行了验证，
      // 这里的 body schema 定义 (使用 Elysia 的 t) 实际上是可选的。
      // 如果保留，Elysia 会先进行一次验证，如果失败会返回 422。
      // 如果移除，则完全依赖 Zod 的验证。
      // 为了保持一致性和明确性，可以移除这里的 t.Object 定义，
      // 或者确保它与 Zod schema 兼容（但 Zod 提供了更丰富的错误信息）。
      // 暂时移除，依赖 Zod 的验证。
      // body: t.Object({
      //   name: t.String({
      //     minLength: 1,
      //     error: "Project name cannot be empty."
      //   })
      // })
    }) // End of POST /api/projects

    // GET /api/projects/:projectId/metadata - 获取项目元数据
    .get('/:projectId/metadata', async ({ params: { projectId: rawProjectId }, set }) => { // 重命名 projectId 为 rawProjectId
      let decodedProjectId = '';
      try {
        decodedProjectId = decodeURIComponent(rawProjectId);
      } catch (e) {
        console.error(`[GET /${rawProjectId}/metadata] Error decoding project ID:`, e);
        set.status = 400;
        return { error: 'Invalid project ID encoding' };
      }

      const safeProjectId = sanitizeProjectId(decodedProjectId); // 使用解码后的 ID
      if (!safeProjectId) {
        set.status = 400;
        return { error: 'Invalid project ID after sanitization' };
      }

      // 构建项目元数据文件路径 (使用导入的 PROJECTS_BASE_DIR)
      const projectDir = path.join(PROJECTS_BASE_DIR, safeProjectId); // 定义 projectDir
      const projectMetadataPath = path.join(projectDir, 'project.json'); // 使用 projectDir
      console.log(`[GET /${rawProjectId} (decoded: ${safeProjectId})/metadata] Project directory: ${projectDir}`);
      console.log(`[GET /${rawProjectId} (decoded: ${safeProjectId})/metadata] Attempting to read metadata file: ${projectMetadataPath}`);

      try {
        // 调试：列出项目目录中的文件
        try {
          const filesInDir = await fs.readdir(projectDir);
          console.log(`[GET /${rawProjectId} (decoded: ${safeProjectId})/metadata] Files in project directory '${projectDir}':`, filesInDir);
        } catch (readdirError: any) {
          console.error(`[GET /${rawProjectId} (decoded: ${safeProjectId})/metadata] Error reading project directory '${projectDir}':`, readdirError);
          // 如果连目录都读不了，那问题更严重
          if (readdirError.code === 'ENOENT') {
            set.status = 404;
            return { error: `Project directory for ID '${safeProjectId}' (from '${rawProjectId}') not found.` };
          }
          set.status = 500;
          return { error: `Failed to access project directory for ID '${safeProjectId}' (from '${rawProjectId}').` };
        }

        const fileContent = await fs.readFile(projectMetadataPath, 'utf-8');
        const metadata = JSON.parse(fileContent);
        // TODO: Add Zod validation for metadata if a schema exists
        return metadata;
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          set.status = 404;
          console.warn(`Project metadata not found: ${projectMetadataPath}`);
          return { error: `Project metadata for ID '${safeProjectId}' (from '${rawProjectId}') not found.` };
        }
        console.error(`Error loading project metadata for ${safeProjectId} (from '${rawProjectId}'):`, error);
        set.status = 500;
        return { error: 'Failed to load project metadata.' };
      }
    }, {
      params: t.Object({ projectId: t.String() })
    }) // End of GET /:projectId/metadata

    // PUT /api/projects/:projectId/metadata - 更新项目元数据
    .put('/:projectId/metadata', async ({ params: { projectId: rawProjectId }, body, set }) => { // 重命名 projectId 为 rawProjectId
      let decodedProjectId = '';
      try {
        decodedProjectId = decodeURIComponent(rawProjectId);
      } catch (e) {
        console.error(`[PUT /${rawProjectId}/metadata] Error decoding project ID:`, e);
        set.status = 400;
        return { error: 'Invalid project ID encoding' };
      }
      const safeProjectId = sanitizeProjectId(decodedProjectId); // 使用解码后的 ID
      if (!safeProjectId) {
        set.status = 400;
        return { error: 'Invalid project ID after sanitization' };
      }

      // Manually validate the request body inside the handler
      const validationResult = ProjectMetadataUpdateSchema.safeParse(body);
      if (!validationResult.success) {
        set.status = 400;
        const errors = validationResult.error.flatten().fieldErrors;
        console.error(`Project metadata validation failed (PUT /${safeProjectId}/metadata):`, errors);
        return { error: 'Invalid project metadata for update', details: errors };
      }
      const validatedData = validationResult.data;

      try {
        // Call the service function to update metadata
        const updatedMetadata = await updateProjectMetadata(safeProjectId, validatedData);
        console.log(`[PUT /api/projects/${safeProjectId}/metadata] Metadata updated successfully.`);
        return updatedMetadata; // Return the updated metadata

      } catch (error: any) {
        // Handle specific errors from the service or general errors
        if (error instanceof Error && error.message.includes('not found')) {
          set.status = 404;
          console.warn(`[PUT /api/projects/${safeProjectId}/metadata] Project or metadata file not found.`);
          return { error: error.message }; // Return the specific error message
        }
        console.error(`Error updating project metadata for ${safeProjectId}:`, error);
        set.status = 500;
        // Avoid exposing detailed internal errors unless necessary
        return { error: 'Failed to update project metadata.' };
      }
    }, {
      params: t.Object({ projectId: t.String() })
      // Removed body schema definition here; validation is done inside the handler.
    }) // End of PUT /:projectId/metadata

    // GET /api/projects/:projectId/workflows - 列出项目内的工作流
    .get('/:projectId/workflows', async ({ params: { projectId: rawProjectId }, set }) => { // 重命名 projectId 为 rawProjectId
      let decodedProjectId = '';
      try {
        decodedProjectId = decodeURIComponent(rawProjectId);
      } catch (e) {
        console.error(`[GET /${rawProjectId}/workflows] Error decoding project ID:`, e);
        set.status = 400;
        return { error: 'Invalid project ID encoding' };
      }
      const safeProjectId = sanitizeProjectId(decodedProjectId); // 使用解码后的 ID
      if (!safeProjectId) {
        set.status = 400;
        return { error: 'Invalid project ID after sanitization' };
      }
      const projectWorkflowsDir = getProjectWorkflowsDir(safeProjectId);

      try {
        try {
          await fs.access(projectWorkflowsDir);
        } catch (accessError: any) {
          if (accessError.code === 'ENOENT') {
            console.log(`Workflows directory not found for project ${safeProjectId} (from '${rawProjectId}'), returning empty list.`);
            return [];
          }
          throw accessError;
        }

        const files = await fs.readdir(projectWorkflowsDir);
        const workflowFiles = files.filter(file => extname(file).toLowerCase() === '.json');

        const workflows = await Promise.all(workflowFiles.map(async (file) => {
          const id = basename(file, '.json');
          const filePath = path.join(projectWorkflowsDir, file);
          let name = id;
          let description: string | undefined;
          let creationMethod: string | undefined; // Roo: 添加 creationMethod 变量
          let referencedWorkflows: string[] | undefined; // Roo: 添加 referencedWorkflows 变量
          try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            // Roo: 尝试解析为 WorkflowObject 类型，以便访问新字段
            const workflowData: Partial<WorkflowObject> = JSON.parse(fileContent);
            name = workflowData.name || (workflowData as any).label || id; // 保留 label 作为备选
            description = workflowData.description;
            creationMethod = workflowData.creationMethod; // Roo: 读取 creationMethod
            referencedWorkflows = workflowData.referencedWorkflows; // Roo: 读取 referencedWorkflows
          } catch (readError) {
            console.error(`Error reading workflow file ${file} in project ${safeProjectId} (from '${rawProjectId}') for listing:`, readError);
          }
          // Roo: 返回包含所有需要字段的对象
          return { id, name, description, creationMethod, referencedWorkflows };
        }));
        return workflows;
      } catch (error) {
        console.error(`Error listing workflows for project ${safeProjectId} (from '${rawProjectId}'):`, error);
        set.status = 500;
        return { error: 'Failed to list project workflows' };
      }
    }, {
      params: t.Object({ projectId: t.String() })
    }) // End of GET /:projectId/workflows

    // POST /api/projects/:projectId/workflows - 创建项目内的新工作流
    .post('/:projectId/workflows', async ({ params: { projectId: rawProjectId }, body, set }) => { // 重命名 projectId 为 rawProjectId
        let decodedProjectId = '';
        try {
          decodedProjectId = decodeURIComponent(rawProjectId);
        } catch (e) {
          console.error(`[POST /${rawProjectId}/workflows] Error decoding project ID:`, e);
          set.status = 400;
          return { error: 'Invalid project ID encoding' };
        }
        const safeProjectId = sanitizeProjectId(decodedProjectId); // 使用解码后的 ID
        if (!safeProjectId) {
          set.status = 400;
          return { error: 'Invalid project ID after sanitization' };
        }

        // Use the correct CreateWorkflowObjectSchema for validation
        const validationResult = CreateWorkflowObjectSchema.safeParse(body);
        if (!validationResult.success) {
          set.status = 400;
          const errors = validationResult.error.flatten().fieldErrors;
          console.error(`Project workflow validation failed (POST /${safeProjectId}):`, errors);
          return { error: 'Invalid workflow data for creation', details: errors };
        }

        const validatedData = validationResult.data;
        const { name } = validatedData;
        const id = generateSafeWorkflowFilename(name);
        const projectWorkflowsDir = getProjectWorkflowsDir(safeProjectId);
        const filePath = path.join(projectWorkflowsDir, `${id}.json`);

        try {
          await fs.mkdir(projectWorkflowsDir, { recursive: true });

          try {
            await fs.access(filePath);
            set.status = 409;
            return { error: `Workflow with name '${name}' (filename: ${id}.json) already exists in project '${safeProjectId}'.` };
          } catch (accessError: any) {
            if (accessError.code !== 'ENOENT') throw accessError;
          }

          const now = new Date().toISOString();
          // 类型修正：确保 dataToSave 匹配 Omit<WorkflowObject, 'id'>
          // 使用 WorkflowStorageObject 类型，并添加必要的元数据
          // 注意：StorageObject 本身不包含 id, createdAt, updatedAt, version
          // 这些元数据通常由服务层管理或在写入时添加
          const storageData: WorkflowStorageObject = {
            name: validatedData.name,
            // description: validatedData.description, // REMOVED: Top-level description is no longer stored
            nodes: validatedData.nodes, // Assuming validatedData.nodes matches WorkflowStorageNode[]
            // Map edges to ensure handles are strings, matching WorkflowStorageEdge[]
            edges: validatedData.edges.map(edge => ({
              ...edge,
              sourceHandle: edge.sourceHandle ?? '',
              targetHandle: edge.targetHandle ?? '',
              // Remove markerEnd if it exists in WorkflowEdge but not WorkflowStorageEdge
              markerEnd: undefined, // Or handle appropriately if needed in storage
            })),
            viewport: validatedData.viewport,
            interfaceInputs: validatedData.interfaceInputs || {},
            interfaceOutputs: validatedData.interfaceOutputs || {},
            // creationMethod should not be present in validatedData for new workflows
            // creationMethod: validatedData.creationMethod,
            referencedWorkflows: validatedData.referencedWorkflows, // 从验证数据获取
          };

          // 实际写入文件的数据可能需要包含额外的元数据，但这取决于存储策略
          // 这里我们假设直接存储 WorkflowStorageObject 加上必要的元数据
          const dataToSave = {
            ...storageData,
            // 添加创建/更新时间戳和版本信息
            createdAt: now,
            updatedAt: now,
            version: appVersion,
          };

          await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2));
          console.log(`Project workflow created: ${filePath}`);

          set.status = 201;
          // 返回包含 id 的完整对象
          return { ...dataToSave, id };

        } catch (error) {
          console.error(`Error creating project workflow '${name}' (filename: ${id}.json) in project ${safeProjectId}:`, error);
          set.status = 500;
          return { error: 'Failed to create project workflow' };
        }
      }, {
        params: t.Object({ projectId: t.String() }),
        // Body validation is done inside the handler using Zod
      }) // End of POST /:projectId/workflows


    // GET /api/projects/:projectId/workflows/:workflowId - 加载项目内指定工作流
    .get('/:projectId/workflows/:workflowId', async ({ params: { projectId: rawProjectId, workflowId }, set }) => { // 重命名 projectId
      let decodedProjectId = '';
      try {
        decodedProjectId = decodeURIComponent(rawProjectId);
      } catch (e) {
        console.error(`[GET /${rawProjectId}/workflows/${workflowId}] Error decoding project ID:`, e);
        set.status = 400;
        return { error: 'Invalid project ID encoding' };
      }
      const safeProjectId = sanitizeProjectId(decodedProjectId); // 使用解码后的 ID
      if (!safeProjectId) {
        set.status = 400; return { error: 'Invalid project ID after sanitization' };
      }
      const safeWorkflowId = sanitizeWorkflowIdFromParam(workflowId);
      if (!safeWorkflowId) {
        set.status = 400; return { error: 'Invalid workflow ID' };
      }

      const projectWorkflowsDir = getProjectWorkflowsDir(safeProjectId); // 获取项目工作流目录
      const filePath = path.join(projectWorkflowsDir, `${safeWorkflowId}.json`); // 使用 join

      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        // 直接解析为 WorkflowStorageObject (或其超集，包含元数据)
        const workflowData: WorkflowStorageObject & { createdAt?: string, updatedAt?: string, version?: string } = JSON.parse(fileContent);

        // Use WorkflowObjectSchema for validation, as storage might contain extra metadata
        const validationResult = WorkflowObjectSchema.safeParse(workflowData);
        if (!validationResult.success) {
            // 如果验证失败，可能需要处理旧格式或记录错误
            console.warn(`Loaded workflow data validation failed for ${filePath} against WorkflowStorageObjectSchema:`, validationResult.error.flatten());
            // 根据策略决定是返回原始数据、尝试转换还是报错
            // 这里暂时返回原始数据，但添加 id
             return { ...workflowData, id: safeWorkflowId };
        }
        const validatedData = validationResult.data;

        // 直接返回符合 WorkflowStorageObject 格式的数据，并附加 ID
        return {
          ...validatedData,
          id: safeWorkflowId,
          // 如果需要，可以添加回 createdAt, updatedAt, version 等元数据
          // createdAt: workflowData.createdAt,
          // updatedAt: workflowData.updatedAt,
          // version: workflowData.version,
        };
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          set.status = 404;
          return { error: `Workflow with ID '${safeWorkflowId}' not found in project '${safeProjectId}' (from '${rawProjectId}').` };
        }
        console.error(`Error loading workflow ${safeWorkflowId} from project ${safeProjectId} (from '${rawProjectId}'):`, error);
        set.status = 500;
        return { error: 'Failed to load project workflow.' };
      }
    }, {
      params: t.Object({ projectId: t.String(), workflowId: t.String() })
    }) // End of GET /:projectId/workflows/:workflowId

    // PUT /api/projects/:projectId/workflows/:workflowId - 更新项目内的工作流
    .put('/:projectId/workflows/:workflowId', async ({ params: { projectId: rawProjectId, workflowId }, body, set }) => { // 重命名 projectId
      let decodedProjectId = '';
      try {
        decodedProjectId = decodeURIComponent(rawProjectId);
      } catch (e) {
        console.error(`[PUT /${rawProjectId}/workflows/${workflowId}] Error decoding project ID:`, e);
        set.status = 400;
        return { error: 'Invalid project ID encoding' };
      }
      const safeProjectId = sanitizeProjectId(decodedProjectId); // 使用解码后的 ID
      if (!safeProjectId) {
        set.status = 400; return { error: 'Invalid project ID after sanitization' };
      }
      const safeWorkflowId = sanitizeWorkflowIdFromParam(workflowId);
      if (!safeWorkflowId) {
        set.status = 400; return { error: 'Invalid workflow ID' };
      }

      const projectWorkflowsDir = getProjectWorkflowsDir(safeProjectId);
      const filePath = path.join(projectWorkflowsDir, `${safeWorkflowId}.json`);

      // Use the correct UpdateWorkflowObjectSchema for validation
      const validationResult = UpdateWorkflowObjectSchema.safeParse(body);
      if (!validationResult.success) {
        set.status = 400;
        const errors = validationResult.error.flatten().fieldErrors;
        console.error(`Project workflow validation failed (PUT /${safeProjectId}/${safeWorkflowId}):`, errors);
        return { error: 'Invalid workflow data for update', details: errors };
      }

      if (validationResult.data.id && validationResult.data.id !== safeWorkflowId) {
        set.status = 400;
        return { error: `Workflow ID in body ('${validationResult.data.id}') does not match URL parameter ('${safeWorkflowId}')` };
      }

      // 确保 body 中包含的 id (如果有) 与 URL 参数匹配
      // 注意：UpdateWorkflowStorageObjectSchema 本身不包含 id
      if ((body as any).id && (body as any).id !== safeWorkflowId) {
        set.status = 400;
        return { error: `Workflow ID in body ('${(body as any).id}') does not match URL parameter ('${safeWorkflowId}')` };
      }

      const validatedData = validationResult.data; // validatedData 现在是 WorkflowStorageObject 类型
      const newName = validatedData.name; // Roo: 获取新名称
      const newSafeWorkflowId = generateSafeWorkflowFilename(newName); // Roo: 生成新的安全文件名
      const newFilePath = path.join(projectWorkflowsDir, `${newSafeWorkflowId}.json`); // Roo: 计算新文件路径

      try {
        await fs.mkdir(projectWorkflowsDir, { recursive: true });
        await fs.access(filePath); // Check if file exists

        // Roo: 如果文件名需要改变，检查新文件名是否冲突
        if (newSafeWorkflowId !== safeWorkflowId) {
          try {
            await fs.access(newFilePath);
            // 如果新文件已存在，返回冲突
            set.status = 409;
            console.warn(`[PUT /api/projects/${safeProjectId}/workflows/${safeWorkflowId}] Rename conflict: New filename '${newSafeWorkflowId}.json' already exists.`);
            return { error: `Cannot rename workflow. A workflow with the name '${newName}' (filename: ${newSafeWorkflowId}.json) already exists.` };
          } catch (accessError: any) {
            if (accessError.code !== 'ENOENT') throw accessError; // 其他错误则抛出
            // ENOENT 意味着新文件名不冲突，可以继续
          }
        }


        let existingData: Partial<WorkflowObject> = {};
        try {
          const oldContent = await fs.readFile(filePath, 'utf-8');
          existingData = JSON.parse(oldContent);
        } catch (readError) {
          console.warn(`Could not read existing project workflow file ${filePath} during update:`, readError);
        }

        const now = new Date().toISOString();

        // validatedData 已经是 WorkflowStorageObject 类型
        // referencedWorkflows 应该直接来自 validatedData (如果 Schema 包含它)
        // 如果 Schema 不包含，则需要像之前一样计算
        let referencedWorkflowsArray = validatedData.referencedWorkflows;
        if (!referencedWorkflowsArray && Array.isArray(validatedData.nodes)) {
            const referencedIds = new Set<string>();
            for (const node of validatedData.nodes) {
                // 检查 NodeGroup 并提取 referencedWorkflowId (假设存储在 configValues 中)
                if (node.type === 'NodeGroup' && node.configValues?.referencedWorkflowId) {
                    const refId = node.configValues.referencedWorkflowId;
                    if (refId && typeof refId === 'string') {
                        referencedIds.add(refId);
                    }
                }
            }
            referencedWorkflowsArray = Array.from(referencedIds);
        }


        // 准备要保存的数据，基于 WorkflowStorageObject 并添加元数据
        const dataToSave = {
          name: validatedData.name,
          // description: validatedData.description, // REMOVED: Top-level description is no longer stored
          nodes: validatedData.nodes, // 假设符合 StorageNode 格式
          edges: validatedData.edges, // 假设符合 StorageEdge 格式
          viewport: validatedData.viewport,
          interfaceInputs: validatedData.interfaceInputs || {},
          interfaceOutputs: validatedData.interfaceOutputs || {},
          creationMethod: validatedData.creationMethod ?? (existingData as any).creationMethod, // 保留旧的或用新的
          referencedWorkflows: referencedWorkflowsArray, // 使用来自请求或计算的值
          // 添加或更新元数据
          createdAt: (existingData as any).createdAt || now, // 保留原始创建时间
          updatedAt: now,
          version: appVersion,
        };

        // Roo: 根据文件名是否改变，决定写入哪个文件并是否删除旧文件
        let finalWorkflowId = safeWorkflowId;
        if (newSafeWorkflowId !== safeWorkflowId) {
          // 文件名改变：写入新文件，删除旧文件
          await fs.writeFile(newFilePath, JSON.stringify(dataToSave, null, 2));
          console.log(`Project workflow updated and renamed: ${filePath} -> ${newFilePath}`);
          try {
            await fs.unlink(filePath); // 删除旧文件
            console.log(`Old project workflow file deleted: ${filePath}`);
          } catch (unlinkError) {
            // 如果删除旧文件失败，记录警告，但不阻止操作完成
            console.warn(`Failed to delete old workflow file ${filePath} after rename:`, unlinkError);
          }
          finalWorkflowId = newSafeWorkflowId; // 更新最终使用的 ID
        } else {
          // 文件名未改变：覆盖原文件
          await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2));
          console.log(`Project workflow updated: ${filePath}`);
        }


        const newInterface: GroupInterfaceInfo = {
          inputs: dataToSave.interfaceInputs || {},
          outputs: dataToSave.interfaceOutputs || {}
        };
        // Run sync in background using the final workflow ID
        syncReferencingNodeGroups(safeProjectId, finalWorkflowId, newInterface)
          .catch(syncError => {
            console.error(`Error during background NodeGroup sync for ${finalWorkflowId} in project ${safeProjectId}:`, syncError);
          });

        // Roo: 返回包含最终 ID 的数据
        // 返回更新后的 StorageObject 数据，并附加最终 ID
        // 从 dataToSave 中提取 StorageObject 部分
        const { createdAt, updatedAt, version, ...storageResult } = dataToSave;
        return { ...storageResult, id: finalWorkflowId };

      } catch (error: any) {
        if (error.code === 'ENOENT') {
          set.status = 404;
          return { error: `Workflow with ID '${safeWorkflowId}' not found in project '${safeProjectId}' for update.` };
        }
        console.error(`Error updating project workflow ${safeWorkflowId} in project ${safeProjectId}:`, error);
        set.status = 500;
        return { error: 'Failed to update project workflow' };
      }
    }, {
      params: t.Object({ projectId: t.String(), workflowId: t.String() }),
      // Body validation inside handler
    }) // End of PUT /:projectId/workflows/:workflowId


    // DELETE /api/projects/:projectId/workflows/:workflowId - 删除项目内的工作流
    .delete('/:projectId/workflows/:workflowId', async ({ params: { projectId: rawProjectId, workflowId }, set }) => { // 重命名 projectId
      let decodedProjectId = '';
      try {
        decodedProjectId = decodeURIComponent(rawProjectId);
      } catch (e) {
        console.error(`[DELETE /${rawProjectId}/workflows/${workflowId}] Error decoding project ID:`, e);
        set.status = 400;
        return { error: 'Invalid project ID encoding' };
      }
      const safeProjectId = sanitizeProjectId(decodedProjectId); // 使用解码后的 ID
      if (!safeProjectId) {
        set.status = 400; return { error: 'Invalid project ID after sanitization' };
      }
      const safeWorkflowId = sanitizeWorkflowIdFromParam(workflowId);
      if (!safeWorkflowId) {
        set.status = 400; return { error: 'Invalid workflow ID' };
      }

      const projectWorkflowsDir = getProjectWorkflowsDir(safeProjectId);
      const filePath = path.join(projectWorkflowsDir, `${safeWorkflowId}.json`);

      // Roo: 定义回收站路径
      const recycleBinDir = path.join(PROJECTS_BASE_DIR, '.recycle_bin', safeProjectId, 'workflows');
      const recycleBinPath = path.join(recycleBinDir, `${safeWorkflowId}_${Date.now()}.json`); // 添加时间戳防止重名

      try {
        await fs.access(filePath); // 检查文件是否存在

        // Roo: 确保回收站目录存在
        await fs.mkdir(recycleBinDir, { recursive: true });

        // Roo: 将文件移动到回收站，而不是删除
        await fs.rename(filePath, recycleBinPath);
        console.log(`Project workflow moved to recycle bin: ${filePath} -> ${recycleBinPath}`);

        set.status = 204; // No Content
        return; // No body needed for 204
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          set.status = 404;
          console.warn(`Attempted to move non-existent workflow to recycle bin: ${filePath}`);
          return { error: `Workflow with ID '${safeWorkflowId}' not found in project '${safeProjectId}' for deletion.` };
        }
        console.error(`Error moving project workflow ${safeWorkflowId} to recycle bin in project ${safeProjectId}:`, error);
        set.status = 500;
        return { error: 'Failed to move project workflow to recycle bin' }; // 更新错误消息
      }
    }, {
      params: t.Object({ projectId: t.String(), workflowId: t.String() })
    }) // End of DELETE /:projectId/workflows/:workflowId

  ); // End of group
};
