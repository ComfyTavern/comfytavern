import { WorkflowStorageObject, NanoId } from '@comfytavern/types';
import { famService } from './FileManagerService'; // 引入统一文件服务
import { WorkflowStorageObjectSchema } from '@comfytavern/types';
import { ZodError } from 'zod';

// 定义工作流加载器的接口，以便在需要时可以轻松替换实现
// 注意：这个接口是通用的，不包含 userId 和 projectId
export type WorkflowLoader = (workflowId: NanoId) => Promise<WorkflowStorageObject | null>;

/**
 * 管理工作流的加载和存储。
 * 此服务使用 FileManagerService 来通过逻辑路径访问文件，实现与物理存储的解耦。
 */
export class WorkflowManager {
  // 构造函数现在为空，因为不再需要管理物理路径
  constructor() {
    console.log('[WorkflowManager] Initialized.');
  }

  /**
   * 根据用户 ID、项目 ID 和工作流 ID 从文件系统加载工作流定义。
   * @param userId 用户的唯一 ID。
   * @param projectId 项目的唯一 ID。
   * @param workflowId 要加载的工作流的 ID。
   * @returns 返回一个 WorkflowStorageObject，如果找不到或发生错误则返回 null。
   */
  public async loadWorkflow(userId: NanoId, projectId: NanoId, workflowId: NanoId): Promise<WorkflowStorageObject | null> {
    if (!userId || !projectId || !workflowId) {
      console.error('[WorkflowManager] loadWorkflow called with invalid IDs. userId, projectId, and workflowId are required.');
      return null;
    }

    // 1. 构建逻辑路径，而不是物理路径
    const logicalPath = `user://projects/${projectId}/workflows/${workflowId}.json`;

    try {
      // 2. 使用 famService 读取文件
      const fileContent = await famService.readFile(userId, logicalPath, 'utf-8');
      
      // 因为 readFile 返回 string | Buffer，我们需要断言为 string 来解析
      const content = JSON.parse(fileContent as string);

      // 3. 使用 Zod 进行验证
      const validation = WorkflowStorageObjectSchema.safeParse(content);
      if (!validation.success) {
        console.error(`[WorkflowManager] Invalid workflow file format for ${logicalPath}:`, validation.error);
        return null;
      }
      
      console.log(`[WorkflowManager] Successfully loaded workflow from ${logicalPath}.`);
      return validation.data;

    } catch (error) {
      // 捕获 famService 抛出的错误或 JSON 解析错误
      if (error instanceof Error && error.message.includes('File not found')) {
        console.warn(`[WorkflowManager] Workflow not found at logical path: ${logicalPath}`);
      } else if (error instanceof ZodError) {
        // 已在上面处理，但为了清晰起见再次捕获
        console.error(`[WorkflowManager] Zod validation failed for ${logicalPath}:`, error.errors);
      } else {
        console.error(`[WorkflowManager] Error loading or parsing workflow from ${logicalPath}:`, error);
      }
      return null;
    }
  }

  /**
   * 获取一个绑定了特定用户和项目上下文的 `workflowLoader` 函数。
   * 这个函数符合 WorkflowLoader 接口，可以传递给需要它的通用模块（如 workflow-preparer）。
   * @param userId 用户的唯一 ID。
   * @param projectId 项目的唯一 ID。
   * @returns 一个符合 WorkflowLoader 接口的函数。
   */
  public getScopedWorkflowLoader(userId: NanoId, projectId: NanoId): WorkflowLoader {
    return async (workflowId: NanoId) => {
      return this.loadWorkflow(userId, projectId, workflowId);
    };
  }
}

// 创建单例实例
export const workflowManager = new WorkflowManager();