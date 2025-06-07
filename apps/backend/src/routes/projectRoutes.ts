import { CreateWorkflowObjectSchema, GroupInterfaceInfo, ProjectMetadata, ProjectMetadataSchema, UpdateWorkflowObjectSchema, WorkflowObject, WorkflowObjectSchema, WorkflowStorageObject } from '@comfytavern/types';
import path, { basename, extname, join } from 'node:path';
import { promises as fs } from 'node:fs';
import { Elysia, t } from 'elysia';
import { z } from 'zod'; // 导入 z 以使用 Zod

import { createProject, createWorkflow, deleteWorkflowToRecycleBin, getProjectMetadata, getProjectWorkflowsDir, getWorkflow, listProjects, listWorkflows, ProjectConflictError, ProjectCreationError, ProjectMetadataError, ProjectNotFoundError, syncReferencingNodeGroups, updateProjectMetadata, updateWorkflow, WorkflowConflictError, WorkflowCreationError, WorkflowDeletionError, WorkflowLoadError, WorkflowNotFoundError, WorkflowUpdateError } from '../services/projectService'; // 从服务层导入相关函数和错误类型
import { generateSafeWorkflowFilename, sanitizeProjectId, sanitizeWorkflowIdFromParam } from '../utils/helpers';
import { PROJECTS_BASE_DIR } from '../config'; // 导入项目基础目录


// 移除了错误的 SetElysia 导入

/**
 * 解码并清理 projectId。如果失败，则设置响应状态并返回错误对象。
 * @param rawProjectId 原始 projectId
 * @param set Elysia 的 set 对象
 * @param operationName 操作名称，用于日志记录
 * @returns 清理后的 projectId 或错误响应对象
 */
function getSafeProjectIdOrErrorResponse(
  rawProjectId: string,
  set: { status?: number | string },
  operationName: string
): string | { error: string } {
  let decodedProjectId = "";
  try {
    decodedProjectId = decodeURIComponent(rawProjectId);
  } catch (e) {
    console.error(`[${operationName}] Error decoding project ID '${rawProjectId}':`, e);
    set.status = 400;
    return { error: "Invalid project ID encoding" };
  }

  const safeProjectId = sanitizeProjectId(decodedProjectId);
  if (!safeProjectId) {
    console.error(
      `[${operationName}] Invalid project ID after sanitization: '${decodedProjectId}' (from '${rawProjectId}')`
    );
    set.status = 400;
    return { error: "Invalid project ID after sanitization" };
  }
  return safeProjectId;
}

/**
 * 清理 workflowId。如果失败，则设置响应状态并返回错误对象。
 * @param rawWorkflowId 原始 workflowId
 * @param set Elysia 的 set 对象
 * @param operationName 操作名称，用于日志记录
 * @returns 清理后的 workflowId 或错误响应对象
 */
function getSafeWorkflowIdOrErrorResponse(
  rawWorkflowId: string,
  set: { status?: number | string },
  operationName: string
): string | { error: string } {
  // 注意：sanitizeWorkflowIdFromParam 内部已经处理了 decodeURIComponent
  const safeWorkflowId = sanitizeWorkflowIdFromParam(rawWorkflowId);
  if (!safeWorkflowId) {
    console.error(`[${operationName}] Invalid workflow ID after sanitization: '${rawWorkflowId}'`);
    set.status = 400;
    return { error: "Invalid workflow ID" };
  }
  return safeWorkflowId;
}

// 定义依赖项的类型
// 更新依赖接口，移除 projectsBaseDir，因为它现在从 config 导入
// 更新依赖接口，移除服务函数，因为它们现在直接从 service 导入
interface ProjectRoutesDependencies {
  appVersion: string;
  // getProjectWorkflowsDir 不再需要传递
  // syncReferencingNodeGroups 不再需要传递
}

// 定义更新项目元数据的 Schema (部分，不包含 id 和 createdAt)
const ProjectMetadataUpdateSchema = ProjectMetadataSchema.partial().omit({
  id: true,
  createdAt: true,
});

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
  return app.group(
    "/api/projects",
    (group) =>
      group
        // GET /api/projects - 列出所有项目
        .get("/", async ({ set }) => {
          console.log(`[GET /api/projects] 尝试通过服务列出所有项目。`);
          try {
            const projects = await listProjects();
            console.log(`[GET /api/projects] 成功列出 ${projects.length} 个项目。`);
            return projects;
          } catch (error: any) {
            console.error("[GET /api/projects] 通过服务列出项目时出错:", error.message);
            set.status = 500; // 内部服务器错误
            // 返回一个标准的错误响应结构
            return { error: "由于内部错误，列出项目失败。" };
          }
        })
        // POST /api/projects - 创建新项目
        .post("/", async ({ body, set }) => {
          // 使用 Zod Schema 验证请求体
          const validationResult = CreateProjectBodySchema.safeParse(body);
          if (!validationResult.success) {
            set.status = 400; // Bad Request，因为请求体不符合预期
            // Elysia 的 t.Object 验证失败时，status 可能是 422 Unprocessable Entity
            // 但由于我们现在手动用 Zod 验证，400 更合适表示请求格式错误
            const errors = validationResult.error.flatten().fieldErrors;
            console.error("[POST /api/projects] 项目创建请求体验证失败:", errors);
            return { error: "无效的项目创建数据", details: errors };
          }

          const { name: projectName } = validationResult.data; // data 来自 Zod 的 safeParse
          const projectId = sanitizeProjectId(projectName); // 使用 projectName 生成 ID
          if (!projectId) {
            set.status = 400;
            console.error(
              `[POST /api/projects] 清理后项目名称无效: ${projectName}`
            );
            return { error: "项目名称无效，清理后 ID 为空。" };
          }

          // projectId 和 projectName 已在前面从 body 中获取并验证/清理
          // appVersion 从依赖注入中获取

          try {
            // 调用服务层函数来创建项目
            const newProjectMetadata = await createProject(projectId, projectName, appVersion);

            set.status = 201; // 已创建
            console.log(
              `[POST /api/projects] 项目 '${projectName}' (ID: ${projectId}) 通过服务成功创建。`
            );
            return newProjectMetadata; // 返回创建的项目元数据
          } catch (error: any) {
            if (error instanceof ProjectConflictError) {
              set.status = 409; // 冲突
              console.warn(
                `[POST /api/projects] 项目冲突 '${projectName}' (ID: ${projectId}): ${error.message}`
              );
              return { error: error.message };
            } else if (error instanceof ProjectCreationError) {
              // ProjectCreationError 可能源于多种内部问题，通常应返回 500
              // 例如，目录创建失败、元数据内部验证失败、文件写入失败等
              set.status = 500;
              console.error(
                `[POST /api/projects] 通过服务创建项目 '${projectName}' (ID: ${projectId}) 时出错: ${error.message}`
              );
              return { error: `创建项目失败: ${error.message}` };
            } else {
              // 其他未预料到的错误
              set.status = 500;
              console.error(
                `[POST /api/projects] 创建项目 '${projectName}' (ID: ${projectId}) 时发生意外错误:`,
                error
              );
              return { error: "创建项目时发生意外错误。" };
            }
          }
        }) // End of POST /api/projects

        // GET /api/projects/:projectId/metadata - 获取项目元数据
        .get(
          "/:projectId/metadata",
          async ({ params: { projectId: rawProjectId }, set }) => {
            const operationName = `GET /${rawProjectId}/metadata`;
            const safeIdResult = getSafeProjectIdOrErrorResponse(rawProjectId, set, operationName);
            if (typeof safeIdResult !== "string") {
              return safeIdResult; // 返回错误响应对象
            }
            const safeProjectId = safeIdResult;

            console.log(
              `[${operationName}] 尝试通过服务获取项目 ID '${safeProjectId}' 的元数据。`
            );
            try {
              const metadata = await getProjectMetadata(safeProjectId);
              console.log(
                `[${operationName}] 成功获取项目 ID '${safeProjectId}' 的元数据。`
              );
              return metadata;
            } catch (error: any) {
              if (error instanceof ProjectNotFoundError) {
                set.status = 404;
                console.warn(
                  `[${operationName}] 未找到项目 ID '${safeProjectId}': ${error.message}`
                );
                return { error: error.message };
              } else if (error instanceof ProjectMetadataError) {
                // 这通常表示服务器端问题，如文件损坏或内部验证失败
                set.status = 500;
                console.error(
                  `[${operationName}] 项目 ID '${safeProjectId}' 的元数据错误: ${error.message}`
                );
                return { error: `加载项目元数据失败: ${error.message}` };
              } else {
                set.status = 500;
                console.error(
                  `[${operationName}] 项目 ID '${safeProjectId}' 发生意外错误:`,
                  error
                );
                return { error: "获取项目元数据时发生意外错误。" };
              }
            }
          },
          {
            params: t.Object({ projectId: t.String() }),
          }
        ) // End of GET /:projectId/metadata

        // PUT /api/projects/:projectId/metadata - 更新项目元数据
        .put(
          "/:projectId/metadata",
          async ({ params: { projectId: rawProjectId }, body, set }) => {
            const operationName = `PUT /${rawProjectId}/metadata`;
            const safeIdResult = getSafeProjectIdOrErrorResponse(rawProjectId, set, operationName);
            if (typeof safeIdResult !== "string") {
              return safeIdResult; // 返回错误响应对象
            }
            const safeProjectId = safeIdResult;

            // 在处理函数内部手动验证请求体
            const validationResult = ProjectMetadataUpdateSchema.safeParse(body);
            if (!validationResult.success) {
              set.status = 400;
              const errors = validationResult.error.flatten().fieldErrors;
              console.error(
                `[${operationName}] 项目 ID '${safeProjectId}' 的元数据验证失败:`,
                errors
              );
              return { error: "无效的项目元数据更新数据", details: errors };
            }
            const validatedData = validationResult.data;

            console.log(
              `[${operationName}] 尝试通过服务更新项目 ID '${safeProjectId}' 的元数据。`
            );
            try {
              const updatedMetadata = await updateProjectMetadata(safeProjectId, validatedData);
              console.log(
                `[${operationName}] 成功更新项目 ID '${safeProjectId}' 的元数据。`
              );
              return updatedMetadata;
            } catch (error: any) {
              if (error instanceof ProjectNotFoundError) {
                set.status = 404;
                console.warn(
                  `[${operationName}] 未找到项目 ID '${safeProjectId}': ${error.message}`
                );
                return { error: error.message };
              } else if (error instanceof ProjectMetadataError) {
                // 通常表示服务器端问题，如文件损坏、内部验证失败或写入失败
                set.status = 500;
                console.error(
                  `[${operationName}] 项目 ID '${safeProjectId}' 的元数据错误: ${error.message}`
                );
                return { error: `更新项目元数据失败: ${error.message}` };
              } else {
                set.status = 500;
                console.error(
                  `[${operationName}] 项目 ID '${safeProjectId}' 发生意外错误:`,
                  error
                );
                return { error: "更新项目元数据时发生意外错误。" };
              }
            }
          },
          {
            params: t.Object({ projectId: t.String() }),
            // 在处理函数内部进行请求体验证，此处移除 Schema 定义。
          }
        ) // End of PUT /:projectId/metadata

        // GET /api/projects/:projectId/workflows - 列出项目内的工作流
        .get(
          "/:projectId/workflows",
          async ({ params: { projectId: rawProjectId }, set }) => {
            const operationName = `GET /${rawProjectId}/workflows`;
            const safeIdResult = getSafeProjectIdOrErrorResponse(rawProjectId, set, operationName);
            if (typeof safeIdResult !== "string") {
              return safeIdResult; // 返回错误响应对象
            }
            const safeProjectId = safeIdResult;

            console.log(
              `[${operationName}] 尝试通过服务列出项目 ID '${safeProjectId}' 的工作流。`
            );
            try {
              const workflows = await listWorkflows(safeProjectId);
              console.log(
                `[${operationName}] 成功列出项目 ID '${safeProjectId}' 的 ${workflows.length} 个工作流。`
              );
              return workflows; // 服务层在目录不存在时会返回空数组
            } catch (error: any) {
              // 服务层的 listWorkflows 在其他文件系统错误时会抛出 Error
              set.status = 500;
              console.error(
                `[${operationName}] 列出项目 ID '${safeProjectId}' 的工作流时出错: ${error.message}`
              );
              return { error: `列出项目工作流失败: ${error.message}` };
            }
          },
          {
            params: t.Object({ projectId: t.String() }),
          }
        ) // End of GET /:projectId/workflows

        // POST /api/projects/:projectId/workflows - 创建项目内的新工作流
        .post(
          "/:projectId/workflows",
          async ({ params: { projectId: rawProjectId }, body, set }) => {
            const operationName = `POST /${rawProjectId}/workflows`;
            const safeIdResult = getSafeProjectIdOrErrorResponse(rawProjectId, set, operationName);
            if (typeof safeIdResult !== "string") {
              return safeIdResult; // 返回错误响应对象
            }
            const safeProjectId = safeIdResult;

            // 使用正确的 CreateWorkflowObjectSchema 进行验证
            const validationResult = CreateWorkflowObjectSchema.safeParse(body);
            if (!validationResult.success) {
              set.status = 400;
              const errors = validationResult.error.flatten().fieldErrors;
              console.error(
                `[${operationName}] 项目 '${safeProjectId}' 的工作流数据验证失败:`,
                errors
              );
              return { error: "无效的工作流创建数据", details: errors };
            }
            const validatedWorkflowData = validationResult.data; // 类型为 CreateWorkflowObject

            console.log(
              `[${operationName}] 尝试通过服务在项目 '${safeProjectId}' 中创建工作流 '${validatedWorkflowData.name}'。`
            );
            try {
              // appVersion 可从闭包中获取
              const newWorkflow = await createWorkflow(
                safeProjectId,
                validatedWorkflowData,
                appVersion
              );

              set.status = 201; // 已创建
              console.log(
                `[${operationName}] 工作流 '${newWorkflow.name}' (ID: ${newWorkflow.id}) 在项目 '${safeProjectId}' 中成功创建。`
              );
              return newWorkflow; // 返回包含 id 和元数据的完整工作流对象
            } catch (error: any) {
              if (error instanceof WorkflowConflictError) {
                set.status = 409; // 冲突
                console.warn(
                  `[${operationName}] 项目 '${safeProjectId}' 中的工作流冲突: ${error.message}`
                );
                return { error: error.message };
              } else if (error instanceof WorkflowCreationError) {
                // WorkflowCreationError 可能源于多种内部问题
                set.status = 500; // 或者 400 如果是服务内部的验证问题，但服务层会处理。
                console.error(
                  `[${operationName}] 在项目 '${safeProjectId}' 中创建工作流时出错: ${error.message}`
                );
                return { error: `创建工作流失败: ${error.message}` };
              } else {
                set.status = 500;
                console.error(
                  `[${operationName}] 在项目 '${safeProjectId}' 中创建工作流时发生意外错误:`,
                  error
                );
                return { error: "创建工作流时发生意外错误。" };
              }
            }
          },
          {
            params: t.Object({ projectId: t.String() }),
            // 使用 Zod 在处理函数内部进行请求体验证
          }
        ) // End of POST /:projectId/workflows

        // GET /api/projects/:projectId/workflows/:workflowId - 加载项目内指定工作流
        .get(
          "/:projectId/workflows/:workflowId",
          async ({ params: { projectId: rawProjectId, workflowId: rawWorkflowIdParam }, set }) => {
            const operationName = `GET /${rawProjectId}/workflows/${rawWorkflowIdParam}`;

            const safeProjectIdResult = getSafeProjectIdOrErrorResponse(
              rawProjectId,
              set,
              operationName
            );
            if (typeof safeProjectIdResult !== "string") {
              return safeProjectIdResult;
            }
            const safeProjectId = safeProjectIdResult;

            const safeWorkflowIdResult = getSafeWorkflowIdOrErrorResponse(
              rawWorkflowIdParam,
              set,
              operationName
            );
            if (typeof safeWorkflowIdResult !== "string") {
              return safeWorkflowIdResult;
            }
            const safeWorkflowId = safeWorkflowIdResult;

            console.log(
              `[${operationName}] 尝试通过服务获取项目 '${safeProjectId}' 中的工作流 '${safeWorkflowId}'。`
            );
            try {
              const workflow = await getWorkflow(safeProjectId, safeWorkflowId);
              console.log(
                `[${operationName}] 成功获取项目 '${safeProjectId}' 中的工作流 '${safeWorkflowId}'。`
              );
              return workflow;
            } catch (error: any) {
              if (error instanceof WorkflowNotFoundError) {
                set.status = 404;
                console.warn(`[${operationName}] 未找到工作流: ${error.message}`);
                return { error: error.message };
              } else if (error instanceof WorkflowLoadError) {
                set.status = 500; // 或者 422 如果是已存在文件的验证/解析错误
                console.error(`[${operationName}] 加载工作流时出错: ${error.message}`);
                return { error: `加载工作流失败: ${error.message}` };
              } else {
                set.status = 500;
                console.error(`[${operationName}] 加载工作流时发生意外错误:`, error);
                return { error: "加载工作流时发生意外错误。" };
              }
            }
          },
          {
            params: t.Object({ projectId: t.String(), workflowId: t.String() }),
          }
        ) // End of GET /:projectId/workflows/:workflowId

        // PUT /api/projects/:projectId/workflows/:workflowId - 更新项目内的工作流
        .put(
          "/:projectId/workflows/:workflowId",
          async ({
            params: { projectId: rawProjectId, workflowId: rawWorkflowIdParam },
            body,
            set,
          }) => {
            const operationName = `PUT /${rawProjectId}/workflows/${rawWorkflowIdParam}`;

            const safeProjectIdResult = getSafeProjectIdOrErrorResponse(
              rawProjectId,
              set,
              operationName
            );
            if (typeof safeProjectIdResult !== "string") return safeProjectIdResult;
            const safeProjectId = safeProjectIdResult;

            const safeWorkflowIdResult = getSafeWorkflowIdOrErrorResponse(
              rawWorkflowIdParam,
              set,
              operationName
            );
            if (typeof safeWorkflowIdResult !== "string") return safeWorkflowIdResult;
            const safeWorkflowId = safeWorkflowIdResult;

            // 验证请求体
            const validationResult = UpdateWorkflowObjectSchema.safeParse(body);
            if (!validationResult.success) {
              set.status = 400;
              const errors = validationResult.error.flatten().fieldErrors;
              console.error(
                `[${operationName}] 项目 '${safeProjectId}' 中的工作流 '${safeWorkflowId}' 数据验证失败:`,
                errors
              );
              return { error: "无效的工作流更新数据", details: errors };
            }
            const validatedUpdateData = validationResult.data; // 类型为 UpdateWorkflowObject

            // 检查请求体中的 ID 是否与 URL 中的 ID 匹配 (如果 body.id 存在)
            if (validatedUpdateData.id && validatedUpdateData.id !== safeWorkflowId) {
              set.status = 400;
              const message = `Workflow ID in body ('${validatedUpdateData.id}') does not match URL parameter ('${safeWorkflowId}')`;
              console.warn(`[${operationName}] ${message}`);
              return { error: message };
            }

            console.log(
              `[${operationName}] 尝试通过服务更新项目 '${safeProjectId}' 中的工作流 '${safeWorkflowId}'。`
            );
            try {
              // appVersion 可从闭包中获取
              const updatedWorkflow = await updateWorkflow(
                safeProjectId,
                safeWorkflowId,
                validatedUpdateData,
                appVersion
              );

              console.log(
                `[${operationName}] 工作流 '${updatedWorkflow.id}' (原 ID: '${safeWorkflowId}') 在项目 '${safeProjectId}' 中成功更新。`
              );
              return updatedWorkflow; // 返回完整的工作流对象
            } catch (error: any) {
              if (error instanceof WorkflowNotFoundError) {
                set.status = 404;
                console.warn(`[${operationName}] 未找到工作流: ${error.message}`);
                return { error: error.message };
              } else if (error instanceof WorkflowConflictError) {
                set.status = 409;
                console.warn(`[${operationName}] 工作流名称/ID 冲突: ${error.message}`);
                return { error: error.message };
              } else if (error instanceof WorkflowUpdateError) {
                set.status = 500; // 或者特定错误 (例如，服务内部验证失败返回 400，尽管现在不太可能)
                console.error(`[${operationName}] 更新工作流时出错: ${error.message}`);
                return { error: `更新工作流失败: ${error.message}` };
              } else {
                set.status = 500;
                console.error(`[${operationName}] 更新工作流时发生意外错误:`, error);
                return { error: "更新工作流时发生意外错误。" };
              }
            }
          },
          {
            params: t.Object({ projectId: t.String(), workflowId: t.String() }),
            // 在处理函数内部进行请求体验证
          }
        ) // End of PUT /:projectId/workflows/:workflowId

        // DELETE /api/projects/:projectId/workflows/:workflowId - 删除项目内的工作流
        .delete(
          "/:projectId/workflows/:workflowId",
          async ({ params: { projectId: rawProjectId, workflowId: rawWorkflowIdParam }, set }) => {
            const operationName = `DELETE /${rawProjectId}/workflows/${rawWorkflowIdParam}`;

            const safeProjectIdResult = getSafeProjectIdOrErrorResponse(
              rawProjectId,
              set,
              operationName
            );
            if (typeof safeProjectIdResult !== "string") return safeProjectIdResult;
            const safeProjectId = safeProjectIdResult;

            const safeWorkflowIdResult = getSafeWorkflowIdOrErrorResponse(
              rawWorkflowIdParam,
              set,
              operationName
            );
            if (typeof safeWorkflowIdResult !== "string") return safeWorkflowIdResult;
            const safeWorkflowId = safeWorkflowIdResult;

            console.log(
              `[${operationName}] 尝试通过服务删除项目 '${safeProjectId}' 中的工作流 '${safeWorkflowId}'。`
            );
            try {
              await deleteWorkflowToRecycleBin(safeProjectId, safeWorkflowId);

              set.status = 204; // 无内容
              console.log(
                `[${operationName}] 工作流 '${safeWorkflowId}' 在项目 '${safeProjectId}' 中成功删除。`
              );
              return; // 204 状态码不需要响应体
            } catch (error: any) {
              if (error instanceof WorkflowNotFoundError) {
                set.status = 404;
                console.warn(
                  `[${operationName}] 未找到要删除的工作流: ${error.message}`
                );
                return { error: error.message };
              } else if (error instanceof WorkflowDeletionError) {
                set.status = 500;
                console.error(`[${operationName}] 删除工作流时出错: ${error.message}`);
                return { error: `删除工作流失败: ${error.message}` };
              } else {
                set.status = 500;
                console.error(`[${operationName}] 删除工作流时发生意外错误:`, error);
                return { error: "删除工作流时发生意外错误。" };
              }
            }
          },
          {
            params: t.Object({ projectId: t.String(), workflowId: t.String() }),
          }
        ) // End of DELETE /:projectId/workflows/:workflowId
  ); // End of group
};
