# 工作流组功能增强计划

本计划旨在增强 ComfyTavern 工作流组的功能，实现以下目标：

1.  **识别创建方式**: 能够区分工作流是否由“创建组”动作产生。
2.  **识别孤儿组**: 能够识别出没有被任何其他工作流引用的组工作流。
3.  **显示引用计数**: 能够显示一个组工作流被其他工作流引用了多少次。

## 最终计划

### 目标 1: 识别创建方式

1.  **修改类型定义 (`@comfytavern/types`)**:
    *   在 `WorkflowObjectSchema` 和 `CreateWorkflowObjectSchema` (以及对应的 TypeScript 类型 `WorkflowObject`) 中添加一个可选字段 `creationMethod?: string;`。
    *   约定值: `'group'` 表示由创建组动作产生。
2.  **修改前端逻辑**:
    *   在前端执行“从选中节点创建组”或类似功能，并调用创建新工作流的 API (`POST /api/projects/:projectId/workflows`) 时，在请求的 `body` 中添加 `{ "creationMethod": "group" }`。
3.  **修改后端 API (`apps/backend/src/routes/projectRoutes.ts`)**:
    *   调整 `POST /api/projects/:projectId/workflows` 路由：
        *   确保 Zod 验证 (`CreateWorkflowObjectSchema`) 允许可选的 `creationMethod` 字段。
        *   在构造写入文件的 `dataToSave` 对象时，包含从请求体 `body` 中获取的 `creationMethod` 值（如果存在）。
4.  **修改后端 API (`apps/backend/src/routes/projectRoutes.ts`)**:
    *   调整 `GET /api/projects/:projectId/workflows` 路由：
        *   在读取每个工作流文件内容时，也读取顶层的 `creationMethod` 字段。
        *   将 `creationMethod` 添加到返回的每个工作流对象中。

### 目标 2 & 3: 存储引用列表 & 识别/计数

采用在保存工作流时预计算并存储其内部引用的工作流列表，然后在前端计算最终引用计数的方式。

1.  **修改类型定义 (`@comfytavern/types`)**:
    *   在 `WorkflowObjectSchema` 中添加一个新的可选字段 `referencedWorkflows?: string[];`。此字段存储该工作流内部所有 `NodeGroup` 引用的工作流 ID 的唯一列表。
2.  **修改后端 API (`apps/backend/src/routes/projectRoutes.ts`)**:
    *   调整 `PUT /api/projects/:projectId/workflows/:workflowId` 路由：
        *   在 `writeFile` 保存 `dataToSave` **之前**:
            *   创建一个空的 `Set<string>` 用于收集引用的 ID。
            *   遍历准备保存的 `validatedData.nodes`。
            *   对于每个 `NodeGroup` 节点，获取其 `data.referencedWorkflowId` (需要健壮地处理 `data.configValues.referencedWorkflowId` 和 `data.referencedWorkflowId`)。
            *   将有效的 `referencedWorkflowId` 添加到 Set 中。
            *   将 Set 转换为数组，并赋值给 `dataToSave.referencedWorkflows`。
3.  **修改后端 API (`apps/backend/src/routes/projectRoutes.ts`)**:
    *   调整 `GET /api/projects/:projectId/workflows` 路由：
        *   在读取每个工作流文件时，读取顶层的 `referencedWorkflows` 数组（如果存在）。
        *   将 `referencedWorkflows` 包含在返回给前端的每个工作流对象中。
4.  **修改前端逻辑**:
    *   调用 `GET /api/projects/:projectId/workflows` 获取包含 `id`, `name`, `creationMethod`, `referencedWorkflows` 的完整列表。
    *   在前端代码中：
        *   初始化一个 `referenceCounts = new Map<string, number>();`
        *   遍历获取的工作流列表 (`allWorkflows`)，初始化每个 `workflow.id` 的计数为 0。
        *   再次遍历 `allWorkflows`。对于每个 `referencingWorkflow`，遍历其 `referencedWorkflows` 数组，并根据 `referencedId` 在 `referenceCounts` Map 中增加对应工作流的计数值。
    *   **显示信息**: 使用前端计算出的 `referenceCounts` Map 和从 API 获取的 `creationMethod` 来判断和显示状态（例如，“孤儿组”，“被引用 X 次”）。

## 计划概览 (Mermaid 图)

```mermaid
graph TD
    A[开始: 用户请求功能] --> B{信息收集};
    B --> C[分析代码: JSON, Routes, Service];
    C --> D{制定详细计划 (最终版)};

    subgraph 目标1: 识别创建方式
        D1[改类型 @comfytavern/types] --> D2[改前端: 发送 creationMethod];
        D2 --> D3[改后端 POST: 保存 creationMethod];
        D3 --> D4[改后端 GET: 返回 creationMethod];
    end

    subgraph 目标2&3: 存储引用列表 & 识别/计数
        E1[改类型 @comfytavern/types: 加 referencedWorkflows] --> E2[改后端 PUT: 保存时计算并存储 referencedWorkflows];
        E2 --> E3[改后端 GET: 返回 referencedWorkflows];
        E3 --> E4[改前端: 获取列表, 在前端计算引用计数];
        E4 --> E5[改前端: 根据计数和 creationMethod 显示];
    end

    D --> D1;
    D --> E1;

    D4 & E5 --> F[完成];