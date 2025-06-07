import path, { basename, extname } from 'node:path'; // 移除未使用的 join
import { promises as fs } from 'node:fs';
import { Elysia, t } from 'elysia';

import { sanitizeWorkflowIdFromParam } from '../utils/helpers'; // 导入辅助函数
import { WORKFLOWS_DIR } from '../config'; // 从配置导入全局工作流目录


// 导入辅助函数

// 全局工作流目录现在从 config.ts 导入
// const workflowsDir = WORKFLOWS_DIR;

export const globalWorkflowRoutes = new Elysia({ prefix: '/api/workflows' })
  // GET /api/workflows - 列出所有全局工作流
  .get('/', async ({ set }) => { // 注意：这里使用的是导入的 WORKFLOWS_DIR
    try {
      const files = await fs.readdir(WORKFLOWS_DIR);
      const workflowFiles = files.filter(file => extname(file).toLowerCase() === '.json');
      const workflows = await Promise.all(workflowFiles.map(async (file) => {
        const id = basename(file, '.json');
        const filePath = path.join(WORKFLOWS_DIR, file);
        let name = id;
        try {
          const fileContent = await fs.readFile(filePath, 'utf-8');
          const workflowData = JSON.parse(fileContent);
          name = workflowData.name || id;
        } catch (readError) {
          console.error(`Error reading global workflow file ${file} for listing:`, readError);
        }
        return { id, name };
      }));
      return workflows;
    } catch (error) {
      console.error('Error listing global workflows from:', WORKFLOWS_DIR, error);
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