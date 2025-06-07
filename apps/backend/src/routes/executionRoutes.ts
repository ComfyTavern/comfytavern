import { Elysia, t } from 'elysia';

import {
    ExecutionsListResponse, NanoId, PromptStatusResponse, WorkflowExecutionPayload,
    WorkflowExecutionPayloadSchema
} from '@comfytavern/types';

import { MAX_CONCURRENT_WORKFLOWS } from '../config'; // 导入配置
import { scheduler } from '../index'; // 导入共享的 scheduler 实例

// 移除占位符
// const WorkflowExecutionPayloadSchemaPlaceholder = t.Any();

export const executionApiRoutes = new Elysia({ prefix: '/api' }) // 添加 /api 前缀

  // POST /api/prompt: 提交工作流执行
  .post('/prompt', async ({ body, set }) => {
    try {
      // body 类型现在由 schema 推断，但我们仍需确保它是正确的接口类型
      const payload = body as WorkflowExecutionPayload;
      const result = scheduler.submitExecution(payload, 'http');
      set.status = 200; // OK
      return { promptId: result.promptId };
    } catch (error: any) {
      console.error('[API /prompt] Error submitting execution:', error);
      set.status = 500;
      return { error: 'Failed to submit execution', details: error.message };
    }
  }, {
    // @ts-ignore // 临时忽略 Elysia 和 Zod schema 的类型兼容性问题
    body: WorkflowExecutionPayloadSchema, // 应用导入的 Schema
    detail: {
      summary: 'Submit a workflow for execution',
      description: 'Receives a workflow payload and submits it to the concurrency scheduler for execution. Returns the assigned prompt ID.',
      tags: ['Execution'],
    }
  })

  // GET /api/executions: 查看当前运行和等待的任务
  .get('/executions', ({ set }) => {
    try {
      const running = scheduler.getRunningExecutions();
      const pending = scheduler.getWaitingQueue();
      const response: ExecutionsListResponse = { running, pending };
      set.status = 200;
      return response;
    } catch (error: any) {
      console.error('[API /executions] Error fetching execution list:', error);
      set.status = 500;
      return { error: 'Failed to fetch execution list', details: error.message };
    }
  }, {
    detail: {
      summary: 'Get current running and pending executions',
      description: 'Returns a list of workflows currently being executed and those waiting in the queue.',
      tags: ['Execution'],
    }
  })

  // GET /api/prompt/{promptId}: 查询指定执行的状态
  .get('/prompt/:promptId', ({ params, set }) => {
    const { promptId } = params;
    try {
      const statusInfo = scheduler.getExecutionStatus(promptId as NanoId);
      if (statusInfo) {
        // TODO: 扩展以包含来自 HistoryService 的更详细信息
        const response: PromptStatusResponse = {
            ...statusInfo,
            // outputs: ... // 从历史记录获取
            // nodeStatus: ... // 从历史记录获取
        };
        set.status = 200;
        return response;
      } else {
        // TODO: 查询 HistoryService
        console.warn(`[API /prompt/:promptId] Prompt ${promptId} not found in scheduler, history check needed.`);
        set.status = 404;
        return { error: `Execution with promptId ${promptId} not found.` };
      }
    } catch (error: any) {
      console.error(`[API /prompt/:promptId] Error fetching status for ${promptId}:`, error);
      set.status = 500;
      return { error: 'Failed to fetch execution status', details: error.message };
    }
  }, {
    params: t.Object({ promptId: t.String() }),
    detail: {
      summary: 'Get the status of a specific execution',
      description: 'Retrieves the current status of a workflow execution identified by its prompt ID. Checks running/pending queue first, then potentially history.',
      tags: ['Execution'],
    }
  })

  // POST /api/interrupt/{promptId}: 中断指定的执行
  .post('/interrupt/:promptId', ({ params, set }) => {
    const { promptId } = params;
    try {
      const success = scheduler.interruptExecution(promptId as NanoId);
      if (success) {
        set.status = 200;
        return { success: true, message: `Interrupt signal sent for execution ${promptId}.` };
      } else {
        set.status = 404; // Not found or already completed/interrupted
        return { success: false, message: `Execution ${promptId} not found in running or waiting queue, or already finished/interrupted.` };
      }
    } catch (error: any) {
      console.error(`[API /interrupt/:promptId] Error interrupting execution ${promptId}:`, error);
      set.status = 500;
      return { success: false, message: 'Failed to interrupt execution', details: error.message };
    }
  }, {
    params: t.Object({ promptId: t.String() }),
    detail: {
      summary: 'Interrupt a running or queued execution',
      description: 'Sends an interrupt signal to the specified workflow execution if it is currently running or waiting in the queue.',
      tags: ['Execution'],
    }
  })

  // GET /api/system_stats: 获取系统状态信息
  .get('/system_stats', ({ set }) => {
    try {
        const runningCount = scheduler.getRunningExecutions().length;
        const pendingCount = scheduler.getWaitingQueue().length;
        // TODO: 添加更多系统信息，如 CPU/内存使用率 (需要额外库如 systeminformation)
        set.status = 200;
        return {
            maxConcurrentWorkflows: MAX_CONCURRENT_WORKFLOWS,
            runningExecutions: runningCount,
            pendingExecutions: pendingCount,
            // cpuUsage: ...,
            // memoryUsage: ...,
        };
    } catch (error: any) {
        console.error('[API /system_stats] Error fetching system stats:', error);
        set.status = 500;
        return { error: 'Failed to fetch system stats', details: error.message };
    }
  }, {
      detail: {
          summary: 'Get system execution statistics',
          description: 'Returns statistics about the workflow execution system, such as concurrency limits, running tasks, and queued tasks.',
          tags: ['System'],
      }
  });

// 注意：/history, /history/{promptId}, /view, /object_info 等路由需要与其他服务 (HistoryService, OutputManager, NodeManager) 集成，
// 将在后续步骤中实现或确认。