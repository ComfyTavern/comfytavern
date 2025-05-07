import type { WorkflowObject } from '@comfytavern/types' // 使用共享类型
import { useApi } from '@/utils/api' // 导入封装好的 API 工具

// 获取 API 调用函数
const { get, post, put, del } = useApi()

/**
 * 获取所有工作流列表（仅元数据）
 * @returns 工作流元数据列表 Promise<Array<{ id: string; name: string }>>
 */
export const listWorkflowsApi = async (projectId: string): Promise<Array<{ id: string; name: string }>> => {
  console.log(`API: Listing workflows for project ${projectId}...`)
  try {
    // 使用封装的 get 方法
    // 移除开头的 /api，因为 baseURL 已经包含了它
    const data = await get<Array<{ id: string; name: string }>>(`/projects/${encodeURIComponent(projectId)}/workflows`)
    console.debug('API: Workflows list received:', data) // Changed to debug - less critical than start/end/error
    return data
  } catch (error) {
    console.error(`API Error listing workflows for project ${projectId}:`, error)
    throw error // 重新抛出错误，让调用者处理
  }
}

/**
 * 从后端加载工作流
 * @param projectId 项目 ID
 * @param workflowId 工作流 ID (相对于项目)
 * @returns 工作流数据 Promise<WorkflowObject | null>
 */
export const loadWorkflowApi = async (projectId: string, workflowId: string): Promise<WorkflowObject | null> => {
  console.log(`API: Loading workflow ${workflowId} from project ${projectId}...`)
  try {
    // 使用封装的 get 方法
    // 移除开头的 /api
    const data = await get<WorkflowObject>(`/projects/${encodeURIComponent(projectId)}/workflows/${encodeURIComponent(workflowId)}`)
    console.log('API: Workflow loaded:', data) // Keep as log - important result
    return data
  } catch (error: any) {
    // Axios 错误通常包含 response 对象
    if (error.response && error.response.status === 404) {
      console.log(`API: Workflow ${workflowId} not found in project ${projectId}.`) // Keep as log - important error case
      return null // 未找到时返回 null
    }
    console.error(`API Error loading workflow ${workflowId} from project ${projectId}:`, error)
    throw error
  }
}

/**
 * 保存工作流到后端
 * @param projectId 项目 ID
 * @param data 工作流数据 (不含 ID，如果是新建)
 * @param workflowId 可选，如果提供 ID 则为更新 (PUT)
 * @returns 保存后的工作流数据 Promise<WorkflowObject>
 */
export const saveWorkflowApi = async (projectId: string, data: Omit<WorkflowObject, 'id'> | WorkflowObject, workflowId?: string): Promise<WorkflowObject> => {
  const url = workflowId
    // 移除开头的 /api
    ? `/projects/${encodeURIComponent(projectId)}/workflows/${encodeURIComponent(workflowId)}`
    : `/projects/${encodeURIComponent(projectId)}/workflows`
  const method = workflowId ? 'PUT' : 'POST'
  console.log(`API: ${method} workflow to project ${projectId}...`, url, data) // Keep as log - important action start

  try {
    let responseData: WorkflowObject
    if (workflowId) {
      // 使用封装的 put 方法
      responseData = await put<WorkflowObject>(url, data)
    } else {
      // 使用封装的 post 方法
      responseData = await post<WorkflowObject>(url, data)
    }
    console.log(`API: Workflow ${workflowId ? 'updated' : 'created'} in project ${projectId}:`, responseData) // Keep as log - important action result
    return responseData
  } catch (error) {
    console.error(`API Error ${method} workflow in project ${projectId}:`, error)
    // 可以尝试从 error.response.data 获取更详细的错误信息
    throw error
  }
}


/**
 * 删除后端的工作流
 * @param projectId 项目 ID
 * @param workflowId 工作流 ID (相对于项目)
 * @returns Promise<void> - Axios 的 delete 通常返回响应数据，但我们这里不需要
 */
export const deleteWorkflowApi = async (projectId: string, workflowId: string): Promise<void> => {
  console.log(`API: Deleting workflow ${workflowId} from project ${projectId}...`) // Keep as log - important action start
  try {
    // 使用封装的 del 方法
    // 注意：useApi 中的 del 返回 Promise<T>，但 DELETE 成功通常是 204 No Content
    // 我们这里不关心返回值类型，所以用 any 或 void
    // 移除开头的 /api
    await del<any>(`/projects/${encodeURIComponent(projectId)}/workflows/${encodeURIComponent(workflowId)}`)
    console.log(`API: Workflow ${workflowId} deleted successfully from project ${projectId}.`) // Keep as log - important action result
  } catch (error: any) {
    // Axios 错误通常包含 response 对象
    if (error.response && error.response.status === 404) {
      console.error(`API Error deleting workflow: Workflow with ID '${workflowId}' not found in project ${projectId}.`)
      // 可以选择抛出特定错误或静默处理
      throw new Error(`Workflow with ID '${workflowId}' not found in project ${projectId}.`)
    }
    console.error(`API Error deleting workflow ${workflowId} from project ${projectId}:`, error)
    throw error
  }
}