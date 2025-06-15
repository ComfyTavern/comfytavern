import { basename, extname } from 'node:path'; // path.join 等不再需要
// import { promises as fs } from 'node:fs'; // 将替换为 FAMService
import { Elysia, t } from 'elysia';

import { sanitizeWorkflowIdFromParam } from '../utils/helpers'; // 导入辅助函数
// import { WORKFLOWS_DIR } from '../config'; // 全局工作流目录将通过 FAMService 逻辑路径处理
import { famService } from '../services/FileManagerService'; // 导入 FAMService
import type { FAMItem } from '@comfytavern/types'; // + FAMItem


// 导入辅助函数

// 全局工作流目录现在从 config.ts 导入
// const workflowsDir = WORKFLOWS_DIR; // 将使用逻辑路径 shared://library/workflows/

export const globalWorkflowRoutes = new Elysia({ prefix: '/api/workflows' })
  // GET /api/workflows - 列出所有全局工作流
  .get('/', async ({ set }) => {
    const logicalWorkflowsDir = 'shared://library/workflows/';
    try {
      const dirItems: FAMItem[] = await famService.listDir(null, logicalWorkflowsDir); // userId is null for shared resources
      const workflowFileItems = dirItems.filter((item: FAMItem) => item.itemType === 'file' && extname(item.name).toLowerCase() === '.json');
      
      const workflows = await Promise.all(workflowFileItems.map(async (item) => {
        const id = basename(item.name, '.json');
        const logicalWorkflowPath = item.logicalPath; // item.path -> item.logicalPath
        let name = id;
        try {
          const fileContentBuffer = await famService.readFile(null, logicalWorkflowPath, 'utf-8');
          if (typeof fileContentBuffer === 'string') {
            const workflowData = JSON.parse(fileContentBuffer);
            name = workflowData.name || id;
          } else {
            console.error(`Error reading global workflow file ${logicalWorkflowPath} as string for listing: content is Buffer.`);
          }
        } catch (readError) {
          console.error(`Error reading/parsing global workflow file ${logicalWorkflowPath} for listing:`, readError);
        }
        return { id, name };
      }));
      return workflows;
    } catch (error) {
      console.error(`Error listing global workflows from ${logicalWorkflowsDir}:`, error);
      set.status = 500;
      return { error: 'Failed to list global workflows' };
    }
  })

  // GET /api/workflows/:id - 加载指定全局工作流 (目前禁用，仅返回提示)
  .get('/:id', async ({ params: { id }, set }) => {
    const safeId = sanitizeWorkflowIdFromParam(id);
    if (!safeId) {
      set.status = 400;
      return { error: 'Invalid workflow ID' };
    }
    // Global workflows are generally read-only or managed via projects now
    set.status = 404; // Or 405 Method Not Allowed if preferred
    return { error: `Workflow with ID '${safeId}' not found (global access disabled). Access via project API if applicable.` }; // 使用 safeId
    /* // Original logic for loading global workflow (using WORKFLOWS_DIR)
    const filePath = path.join(WORKFLOWS_DIR, `${safeId}.json`)
    // ... rest of the original logic ...
    */
  }, {
    params: t.Object({ id: t.String() })
  })

  // POST /api/workflows - 保存新全局工作流 (禁用)
  .post('/', async ({ set }) => {
    set.status = 405; // Method Not Allowed
    return { error: 'Creating global workflows is disabled. Please use the project-specific API.' };
  })

  // PUT /api/workflows/:id - 更新现有全局工作流 (禁用)
  .put('/:id', async ({ params: { id }, set }) => {
    set.status = 405; // Method Not Allowed
    return { error: `Updating global workflow '${id}' is disabled. Please use the project-specific API.` };
  }, {
     params: t.Object({ id: t.String() })
  })

  // DELETE /api/workflows/:id - 删除全局工作流 (禁用)
  .delete('/:id', async ({ params: { id }, set }) => {
    set.status = 405; // Method Not Allowed
    return { error: `Deleting global workflow '${id}' is disabled. Please use the project-specific API.` };
  }, {
     params: t.Object({ id: t.String() })
  });