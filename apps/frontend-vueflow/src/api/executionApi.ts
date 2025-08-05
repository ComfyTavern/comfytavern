import { useApi } from '@/utils/api';
import type { ExecutionsListResponse, SystemStatsResponse, NanoId } from '@comfytavern/types';

/**
 * 获取系统执行统计信息。
 * @returns 包含运行中和等待中任务数量的对象。
 */
export async function getSystemStats(): Promise<SystemStatsResponse> {
  const { get } = useApi();
  const response = await get<SystemStatsResponse>('/system_stats');
  return response;
}

/**
 * 获取详细的运行中和等待中的任务列表。
 * @returns 包含运行中和等待中任务数组的对象。
 */
export async function getExecutions(): Promise<ExecutionsListResponse> {
  const { get } = useApi();
  const response = await get<ExecutionsListResponse>('/executions');
  return response;
}

/**
 * 发送中断指定执行的请求。
 * @param promptId 要中断的执行的 promptId。
 * @returns 后端返回的成功或失败信息。
 */
export async function interruptExecution(promptId: NanoId): Promise<{ success: boolean; message: string }> {
  const { post } = useApi();
  // post 请求通常需要一个 body，即使为空
  const response = await post<{ success: boolean; message: string }>(`/interrupt/${promptId}`, {});
  return response;
}