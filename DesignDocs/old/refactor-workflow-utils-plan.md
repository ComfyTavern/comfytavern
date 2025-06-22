# 工作流工具同构化重构方案

## 1. 背景与问题

ComfyTavern 的后端 Agent（智能体）负责准备并执行工作流，这要求它具备独立处理工作流定义的能力，特别是将包含 `NodeGroup` 的复杂工作流“扁平化”为可执行格式。

然而，实现此功能的核心工具，如工作流扁平化 (`workflowFlattener.ts`) 和转换 (`workflowTransformer.ts`)，目前仅存在于前端模块 (`apps/frontend-vueflow/src/utils`) 中。

这种架构上的分离，导致后端无法访问必要的工具，阻碍了 Agent 功能的实现。

## 2. 现有实现分析

`apps/frontend-vueflow/src/utils/` 目录下的关键工具与前端框架存在深度耦合，无法直接迁移至后端或共享包：

-   **`workflowFlattener.ts`**:
    -   核心函数 `flattenWorkflow` 直接操作 VueFlow 的节点类型 (`VueFlowNode`)。
    -   依赖多个前端特有的 composables 和 stores (`useWorkflowData`, `useProjectStore`, `useWorkflowManager`) 来加载子工作流和获取节点数据，这些在后端环境中不可用。
-   **`workflowTransformer.ts`**:
    -   部分数据转换逻辑依赖于通过 Pinia 状态管理器 (`useNodeStore`) 获取的节点定义 (`NodeDefinition`)。
    -   其函数直接处理或返回 `VueFlowNode` 和 `VueFlowEdge` 等视图层类型。

## 3. 重构方案

核心思路是将所有与框架无关的工作流处理逻辑抽离、整合到 `@comfytavern/utils` 包中，实现前后端复用。

-   **目标包**: `@comfytavern/utils`
-   **目标文件**: `packages/utils/src/workflow-preparer.ts`

**优势**:
-   保持项目结构简洁，避免创建不必要的新包。
-   复用现有包的配置与依赖管理。
-   提供纯粹的数据处理功能，不依赖任何前端框架（Vue, Pinia）或后端框架（Elysia）。

### 3.1. 核心 API 设计

`workflow-preparer.ts` 将提供以下核心函数：

-   **`flattenStorageWorkflow(workflow, workflowLoader, nodeDefinitions)`**:
    -   **职责**: 递归地将包含 `NodeGroup` 的工作流扁平化。
    -   **输入**:
        -   `workflow: WorkflowStorageObject`: 待处理的工作流对象。
        -   `workflowLoader: WorkflowLoader`: 一个由调用方实现的异步函数 `(workflowId: string) => Promise<WorkflowStorageObject | null>`，用于根据 ID 加载子工作流，从而解耦数据源。
        -   `nodeDefinitions: Map<string, NodeDefinition>`: 节点定义的映射表，由调用方提供。
    -   **输出**: 包含扁平化后 `WorkflowStorageNode[]` 和 `WorkflowStorageEdge[]` 的对象。
    -   **说明**: 此函数基于存储层的数据结构 (`WorkflowStorage...`) 进行操作，不涉及任何视图层类型。

-   **`transformStorageToExecutionPayload(workflow)`**:
    -   **职责**: 将扁平化的工作流存储对象转换为可供后端执行的格式。
    -   **输入**:
        -   `workflow`: 包含 `WorkflowStorageNode[]` 和 `WorkflowStorageEdge[]` 的对象。
    -   **输出**: `WorkflowExecutionPayload`。

### 3.2. 依赖解耦策略

-   **依赖注入**:
    -   **节点定义**: 所有需要节点定义的函数，都通过参数接收一个 `Map<string, NodeDefinition>`，消除对 Pinia `useNodeStore` 的隐式依赖。
    -   **工作流加载**: 通过 `workflowLoader` 回调函数，将数据加载的责任交给调用方（前端通过 API 加载，后端通过数据库加载），实现逻辑与数据源的解耦。

## 4. 实施计划与路线图

### 第一阶段：核心工具实现与导出

1.  **实现核心逻辑 (已完成 ✅)**:
    -   在 `packages/utils/src/workflow-preparer.ts` 中实现 `flattenStorageWorkflow` 和 `transformStorageToExecutionPayload`。
    -   定义 `WorkflowLoader` 类型接口。
2.  **更新包导出 (待办 ⏳)**:
    -   在 `packages/utils/src/index.ts` 中导出新实现的工具函数和类型。

### 第二阶段：前端适配与重构

1.  **改造 `workflowTransformer` (已完成 ✅)**:
    -   重构 `apps/frontend-vueflow/src/utils/workflowTransformer.ts`，使其调用 `@comfytavern/utils` 中的 `transformStorageToExecutionPayload`。
2.  **改造 `workflowFlattener` (待办 ⏳)**:
    -   重构 `apps/frontend-vueflow/src/utils/workflowFlattener.ts`，使其成为新工具的适配层。主要职责包括：
        -   将 VueFlow 节点 (`VueFlowNode`) 转换为存储层节点 (`WorkflowStorageNode`)。
        -   提供一个基于前端 API 的 `workflowLoader` 实现。
        -   调用 `@comfytavern/utils` 的 `flattenStorageWorkflow`。
        -   将返回的扁平化 `WorkflowStorageNode` 转换回 `VueFlowNode` 以供视图使用。

### 第三阶段：后端集成 (待办 ⏳)

1.  **实现 `workflowLoader`**:
    -   在后端服务（如 `AgentRuntime`）中，实现一个能够从数据库或缓存加载工作流的 `workflowLoader` 函数。
2.  **加载节点定义**:
    -   实现节点定义的加载逻辑，构建 `Map<string, NodeDefinition>`。
3.  **调用核心工具**:
    -   在需要准备工作流执行负载的地方，调用 `@comfytavern/utils` 中的 `flattenStorageWorkflow` 和 `transformStorageToExecutionPayload`。

### 第四阶段：测试与验证 (待办 ⏳)

1.  **端到端测试**:
    -   编写测试用例，确保前端和后端的工作流准备与执行流程均能正常工作。
    -   重点验证包含 `NodeGroup` 的复杂工作流的展开和执行是否符合预期。