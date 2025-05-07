# ComfyTavern 前端 VueFlow 应用 API 分析报告 (`src/api`)

## 1. `api` 目录结构概述

`apps/frontend-vueflow/src/api` 目录当前结构非常简单，仅包含一个文件：

*   `workflow.ts`: 该文件集中处理与后端工作流 (Workflow) 资源相关的 CRUD (创建、读取、更新、删除) 操作。

这种结构表明，目前前端 API 的封装是按资源（Workflow）进行组织的。如果未来需要与其他后端资源交互（例如用户管理、项目管理、**项目元数据更新**等），可能会在此目录下创建新的文件（如 `user.ts`, `project.ts`），届时本文档也需要相应更新。

## 2. 主要 API 模块/函数及其对应的后端功能说明

所有 API 函数都定义在 `workflow.ts` 文件中，并利用了 `@/utils/api` 中封装的 `useApi` 工具。

*   **`listWorkflowsApi(projectId: string): Promise<Array<{ id: string; name: string }>>`**
    *   **功能:** 获取指定项目 (`projectId`) 下的所有工作流列表（仅包含 ID 和名称等元数据）。
    *   **HTTP 方法:** `GET`
    *   **后端端点:** `/projects/{projectId}/workflows`

*   **`loadWorkflowApi(projectId: string, workflowId: string): Promise<WorkflowObject | null>`**
    *   **功能:** 加载指定项目 (`projectId`) 下的特定工作流 (`workflowId`) 的完整数据。如果工作流不存在 (404)，则返回 `null`。
    *   **HTTP 方法:** `GET`
    *   **后端端点:** `/projects/{projectId}/workflows/{workflowId}`

*   **`saveWorkflowApi(projectId: string, data: Omit<WorkflowObject, 'id'> | WorkflowObject, workflowId?: string): Promise<WorkflowObject>`**
    *   **功能:** 创建或更新工作流。
        *   如果提供了 `workflowId`，则执行更新操作。
        *   如果没有提供 `workflowId`，则执行创建操作。
    *   **HTTP 方法:** `PUT` (更新) 或 `POST` (创建)
    *   **后端端点:**
        *   创建: `/projects/{projectId}/workflows`
        *   更新: `/projects/{projectId}/workflows/{workflowId}`

*   **`deleteWorkflowApi(projectId: string, workflowId: string): Promise<void>`**
    *   **功能:** 删除指定项目 (`projectId`) 下的特定工作流 (`workflowId`)。如果工作流不存在 (404)，会抛出错误。
    *   **HTTP 方法:** `DELETE`
    *   **后端端点:** `/projects/{projectId}/workflows/{workflowId}`

## 3. HTTP 请求库配置和通用处理逻辑概述

API 请求的底层实现和通用逻辑被封装在 `@/utils/api` 的 `useApi` composable/工具函数中。

*   **HTTP 库:** 虽然 `workflow.ts` 没有直接显示，但 `useApi` 内部很可能使用了像 `axios` 或浏览器原生的 `fetch` API 来执行 HTTP 请求。从错误处理中提及 `error.response` 来看，使用 `axios` 的可能性更大。
*   **封装方法:** `useApi` 提供了 `get`, `post`, `put`, `del` 等方法，简化了不同 HTTP 方法的调用。
*   **Base URL:** `useApi` 内部配置了一个基础 URL (Base URL)，指向后端 API 的根路径。API 函数在调用时只需要提供相对路径（例如 `/projects/...`），因为基础 URL 和可能的前缀（如 `/api`）已在 `useApi` 中处理。
*   **类型安全:** 利用 TypeScript 泛型（如 `get<WorkflowObject>(...)`）来定义期望的响应数据类型，提高了代码的健壮性。
*   **错误处理:**
    *   每个 API 函数都使用 `try...catch` 来捕获请求过程中可能发生的错误。
    *   对特定的 HTTP 状态码（如 404 Not Found）进行了处理。
    *   捕获到的错误会被记录到控制台 (`console.error`)，并重新抛出，允许上层调用代码（如 Vue 组件或 Pinia store）进行进一步的用户界面反馈或状态管理。
*   **日志:** 代码中包含了详细的控制台日志 (`console.log`, `console.debug`, `console.error`)，用于开发和调试，追踪 API 请求的生命周期和结果。
*   **URL 参数编码:** 使用 `encodeURIComponent` 对 URL 中的动态部分（如 `projectId`, `workflowId`）进行编码，确保 URL 的正确性。
*   **共享类型:** 从 `@comfytavern/types` 导入共享类型 (`WorkflowObject`)，确保了前后端数据结构的一致性。