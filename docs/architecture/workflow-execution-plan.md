# 工作流执行系统设计方案 (V3)

## 目标

设计并实现一个支持并发执行的工作流系统，该系统能够通过 WebSocket 和 HTTP API 进行交互，允许 ComfyTavern 前端和外部应用提交工作流、监控执行状态并获取结果。设计参考 ComfyUI，但根据 ComfyTavern 的特性进行调整，优先考虑并发执行。

## 核心设计原则

1.  **并发优先**: 系统应能同时处理多个工作流执行请求，直到达到预设的并发上限。
2.  **按需排队**: 只有当并发执行数量达到上限时，新的请求才进入等待队列。
3.  **双 API 接口**:
    *   **WebSocket API**: 主要供 ComfyTavern 前端使用，提供实时的状态推送和交互。
    *   **HTTP API**: 主要供外部应用使用，提供请求/响应模式的交互，包括提交任务、查询状态和获取结果。
4.  **状态清晰**: 通过 WebSocket 实时反馈工作流和节点的执行状态（排队、运行、完成、错误、中断等）。
5.  **NodeGroup 支持**: **前端**负责在发送执行请求前，将包含 `NodeGroup` 的工作流**扁平化**为简单的节点和边列表。后端执行引擎仅处理扁平化的指令。

## API 设计

### WebSocket API (主要供 ComfyTavern 前端)

*   **客户端 -> 服务端:**
    *   `PROMPT_REQUEST`: 提交工作流执行。
        *   Payload: `WorkflowExecutionPayload` (包含 `nodes: ExecutionNode[]`, `edges: ExecutionEdge[]`, 使用 Nano ID)
    *   `EXECUTE_PREVIEW_REQUEST`: 请求执行下游节点的预览（当用户修改输入且预览开启时）。
        *   Payload: `{ previewRequestId?: string, workflowId?: string, changedNodeId: string, inputKey: string, newValue: any }` (需要定义 `ExecutePreviewRequestPayload`, `changedNodeId` 是 Nano ID)
*   **服务端 -> 客户端:**
    *   `PROMPT_ACCEPTED_RESPONSE`: 确认收到请求。
        *   Payload: `{ promptId: string }`
    *   `EXECUTION_STATUS_UPDATE`: 更新工作流整体状态。
        *   Payload: `{ promptId: string, status: 'queued' | 'running' | 'complete' | 'error' | 'interrupted', errorInfo?: any }`
    *   `NODE_EXECUTING`: 通知节点开始执行。
        *   Payload: `{ promptId: string, nodeId: string }` (nodeId 是 Nano ID)
    *   `NODE_PROGRESS`: (可选) 节点执行进度。
        *   Payload: `{ promptId: string, nodeId: string, value: number, max: number }` (nodeId 是 Nano ID)
    *   `NODE_COMPLETE`: 通知节点执行完成。
        *   Payload: `{ promptId: string, nodeId: string, output: any, executionType: 'full' | 'preview' }` (nodeId 是 Nano ID, output 包含节点输出数据, executionType 区分是完整执行还是实时预览)
    *   `NODE_ERROR`: 通知节点执行出错。
        *   Payload: `{ promptId: string, nodeId: string, errorDetails: any }` (nodeId 是 Nano ID)

### HTTP API (主要供外部应用)

*   **`POST /prompt`**: 提交工作流执行。
    *   Request Body: `WorkflowExecutionPayload` (包含 `nodes: ExecutionNode[]`, `edges: ExecutionEdge[]`, 使用 Nano ID)
    *   Response (200 OK): `{ promptId: string }`
*   **`GET /prompt/{promptId}`**: 查询指定执行的状态和结果（如果已完成）。
    *   Response: `{ promptId: string, status: string, outputs?: any, errorInfo?: any, ... }`
*   **`GET /executions`**: 查看当前正在运行和等待队列中的任务列表。
    *   Response: `{ running: PromptInfo[], pending: PromptInfo[] }`
*   **`GET /history`**: 获取已完成的执行历史列表（支持分页）。
*   **`GET /history/{promptId}`**: 获取特定已完成执行的详细信息。
*   **`GET /view?filename=...&subfolder=...&type=...`**: 获取执行产生的输出文件。
*   **`POST /interrupt/{promptId}`**: 中断指定的执行（如果还在运行或排队）。
*   **`GET /object_info`**: 获取所有可用节点的定义信息。
*   **`GET /system_stats`**: 获取系统状态信息。

## 后端执行机制

1.  **并发调度器 (Concurrency Scheduler)**:
    *   维护一个可配置的最大并发数 `max_concurrent_workflows`。
    *   维护正在运行的工作流列表 (`runningExecutions`) 和等待队列 (`waitingQueue`)。
    *   接收来自 WebSocket 和 HTTP 的执行请求。
    *   分配唯一的 `promptId`。
    *   根据当前并发数决定是立即执行还是放入等待队列。
    *   在工作流完成或出错后，从运行列表移除，并尝试从等待队列启动新任务。
    *   通过 WebSocket 发送 `PROMPT_ACCEPTED_RESPONSE` 和 `EXECUTION_STATUS_UPDATE`。
2.  **执行引擎 (Execution Engine)**:
    *   由调度器启动，负责单个工作流的执行（包括完整执行和预览执行）。
    *   **处理完整执行 (`PROMPT_REQUEST`)**:
        *   接收由前端**预处理（扁平化）**后的 `WorkflowExecutionPayload` (包含扁平化的 `nodes` 和 `edges` 列表，使用 Nano ID)。
        *   基于扁平化的节点和边列表构建执行图（拓扑排序）。
        *   按拓扑顺序执行所有节点逻辑。
        *   **注意**: 由于执行基于拓扑排序的有向无环图 (DAG)，当前版本不支持节点的输出直接连接到其自身的输入（即不允许自环）。
        *   **NodeGroup 已由前端处理**，后端引擎不再需要处理嵌套逻辑。
        *   通过 WebSocket 发送节点级别的状态更新 (`NODE_*` 事件)，`NODE_COMPLETE` 中 `executionType` 为 `'full'`。
        *   处理中断请求。
        *   管理执行产生的输出（与 `Output Manager` 协作）。
    *   **处理实时预览 (`EXECUTE_PREVIEW_REQUEST`)**:
        *   接收 `ExecutePreviewRequestPayload`。
        *   根据 `workflowId` 或上下文加载工作流结构。
        *   从 `changedNodeId` 开始，分析下游依赖（拓扑排序）。
        *   遍历下游节点。
        *   检查节点定义中是否标记为预览不安全（例如，`isPreviewUnsafe: true`）。
        *   **如果未标记为不安全 (默认安全)**: 使用上游（可能是预览）输出作为输入，执行节点的（预览）逻辑，存储“预览输出”。
        *   **如果标记为不安全**: 停止沿该路径的预览。
        *   对于每个成功计算出预览输出的节点，通过 WebSocket 发送 `NODE_COMPLETE` 消息，其中 `executionType` 为 `'preview'`。
        *   预览执行是临时的，不产生持久化输出或历史记录。
3.  **输出管理器 (Output Manager)**:
    *   负责存储执行产生的输出文件。
    *   提供 `/view` API 的文件访问能力。
4.  **历史记录 (History DB)**:
    *   存储已完成或出错的工作流执行记录。
    *   提供 `/history` API 的数据查询能力。

## 前端集成 (ComfyTavern UI)

1.  **触发**: UI 上的 "运行" 按钮通过 `useWorkflowInteractionCoordinator` 调用。
2.  **转换与扁平化**: 在发送请求前，前端需要执行以下步骤：
    *   将当前的画布状态（VueFlow 节点/边）转换为内部逻辑表示。
    *   **处理 NodeGroup**: 递归地展开所有 `NodeGroup` 节点，将其引用的子工作流内容（节点和边）合并到主流程中，并正确映射输入/输出连接。生成一个**扁平化**的节点和边列表。
    *   将扁平化后的列表转换为最终的 `WorkflowExecutionPayload` 格式，确保使用 Nano ID 并只包含必要的逻辑信息和非默认输入值。
3.  **发送**:
    *   **完整执行**: 通过 WebSocket 发送 `PROMPT_REQUEST` 消息，载荷为转换后的 `WorkflowExecutionPayload`。
    *   **实时预览**: 当用户修改输入且预览开启时（建议防抖/节流），通过 WebSocket 发送 `EXECUTE_PREVIEW_REQUEST` 消息，包含变更的节点 ID、输入键和新值。
4.  **状态管理**: `useWorkflowExecutionState` 或类似机制：
    *   连接 WebSocket 并监听执行相关的事件 (使用 `promptId` 和 Nano ID 关联状态)。
    *   维护当前活动工作流的执行状态（全局状态、各节点状态、输出、错误等）。
    *   **区分预览与完整执行**: 监听统一的 `NODE_COMPLETE` 消息，根据 `executionType` 字段区分是预览结果还是完整执行结果，并存储到不同的状态属性中（例如 `node.data.outputs` vs `node.data.previewOutputs`）。
    *   提供响应式的数据供 UI 组件使用。
    *   **注意**: 完整执行状态和预览状态都是临时的，不记录到撤销/重做历史。预览状态的生命周期更短，通常在下次输入变更或完整执行后被清除。
5.  **UI 反馈**:
    *   `BaseNode.vue` 等节点组件根据 `useWorkflowExecutionState` 的数据更新视觉样式（如边框高亮、成功/错误图标）。
    *   在节点上或专门区域显示执行输出（区分预览和最终结果）或错误信息。
    *   全局状态指示器（如工具栏）显示整体执行状态（排队中、运行中、进度条等）。
    *   执行完成后，可能需要通过 `/view` API 获取并展示图像等输出。
    *   UI 需要提供全局的“实时预览”开关。

## 实时预览机制详解

实时预览是一个可选的、由后端驱动的机制，旨在提供编辑工作流时的快速反馈。其核心特点如下：

*   **触发**: 用户修改节点输入值，且全局预览开关开启。
*   **范围**: 从被修改的节点开始，仅向下游执行被标记为 `isPreviewSafe: true` 的节点。
*   **安全性**: 节点默认被视为预览安全。节点开发者需要明确标记哪些节点的操作在预览模式下是**不安全**的（例如，产生副作用、计算成本高昂、调用外部服务）。
*   **通信**: 通过 `EXECUTE_PREVIEW_REQUEST` (前端到后端) 和 `NODE_COMPLETE` (后端到前端, `executionType: 'preview'`) 进行。
*   **状态**: 预览结果是临时的，应与完整执行结果分开存储和展示，且不影响撤销/重做历史。
*   **与撤销/重做集成**:
    *   预览状态不记录历史。
    *   撤销/重做操作恢复核心状态后，如果输入值发生变化且预览开启，需要重新触发预览请求 (`EXECUTE_PREVIEW_REQUEST`) 以更新预览。

## Mermaid 流程图

```mermaid
graph TD
    subgraph Frontend (ComfyTavern UI)
        UI_Button[Run Button] --> Coord[Coordinator]
        Coord --> Flatten{Flatten Workflow (Expand NodeGroups)}
        Flatten -- Flat PROMPT_REQUEST (nodes, edges, client_id) --> WS_Client[WebSocket Client]
        WS_Client -- PROMPT_ACCEPTED_RESPONSE (promptId) --> ExecState[Execution State Mgmt]
        WS_Client -- EXECUTION_STATUS_UPDATE (promptId, status) --> ExecState
        WS_Client -- NODE_* (promptId, ...) --> ExecState
        ExecState --> UI_Nodes[Node UI Feedback]
        ExecState --> UI_Global[Global Status UI]
    end

    subgraph Backend
        WS_Server[WebSocket Server] <--> WS_Client
        HTTP_Server[HTTP Server]

        WS_Server -- Workflow Request --> Scheduler[Concurrency Scheduler]
        HTTP_Server -- POST /prompt --> Scheduler

        Scheduler -- Check Running Count < Max Concurrency? --> CanRun{Can Run Immediately?}
        CanRun -- Yes --> StartExec[Start Async Execution]
        CanRun -- No --> WaitQueue[(Waiting Queue)]
        StartExec -- Add to Running --> RunningExecs{Running Executions}
        StartExec -- Send status: running --> WS_Server
        StartExec --> Executor[Execution Engine]

        Executor -- Node Status Updates --> WS_Server
        Executor -- Execution Complete/Error --> Scheduler

        Scheduler -- Remove from Running --> RunningExecs
        Scheduler -- Send final status --> WS_Server
        Scheduler -- Check Waiting Queue & Concurrency --> Dequeue{Dequeue Waiting?}
        Dequeue -- Yes --> StartExec
        Dequeue -- No --> Idle

        HTTP_Server -- GET /executions --> Scheduler
        HTTP_Server -- GET /prompt/{id} --> Scheduler/History[History DB]
        HTTP_Server -- GET /history --> History
        HTTP_Server -- GET /view --> Executor/OutputMgr[Output Manager]
        HTTP_Server -- POST /interrupt/{id} --> Executor
    end

    subgraph External App
        Ext_App[External Application] -- POST /prompt --> HTTP_Server
        Ext_App -- GET /executions --> HTTP_Server
        Ext_App -- GET /prompt/{id} --> HTTP_Server
        Ext_App -- GET /history --> HTTP_Server
        Ext_App -- GET /view --> HTTP_Server
    end
```

## 待讨论/细化

*   `WorkflowExecutionPayload` 中是否需要包含 `workflowData` 或其他元数据。
*   错误处理细节（节点错误是否中断整个工作流？预览执行失败如何处理？）。
*   并发执行时的资源管理策略。
*   历史记录存储的具体内容和格式。
*   身份验证/授权机制（如果需要限制 API 访问）。
*   未来迭代/循环场景的支持方式（例如，通过控制流节点、增强 NodeGroup 功能，或节点内部实现迭代逻辑）。
*   预览不安全标记（如 `isPreviewUnsafe`）的具体标准和默认值（默认为 `false`，即安全）。
*   预览请求的防抖/节流策略。
*   前端如何精确存储、区分和展示预览值与完整执行值。