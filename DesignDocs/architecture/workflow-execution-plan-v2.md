# 工作流执行系统设计方案 (V2)

## 目标

设计并实现一个支持并发执行的工作流系统，该系统能够通过 WebSocket 和 HTTP API 进行交互，允许 ComfyTavern 前端和外部应用提交工作流、监控执行状态并获取结果。设计参考 ComfyUI 和 Blender，根据 ComfyTavern 的特性进行调整，优先考虑并发执行和良好的用户交互体验，特别是在节点绕过（Bypass）时的行为。

## 核心设计原则

1.  **并发优先**: 系统应能同时处理多个工作流执行请求，直到达到预设的并发上限。
2.  **按需排队**: 只有当并发执行数量达到上限时，新的请求才进入等待队列。
3.  **双 API 接口**:
    *   **WebSocket API**: 主要供 ComfyTavern 前端使用，提供实时的状态推送和交互。
    *   **HTTP API**: 主要供外部应用使用，提供请求/响应模式的交互，包括提交任务、查询状态和获取结果。
4.  **状态清晰**: 通过 WebSocket 实时反馈工作流和节点的执行状态（排队、运行、完成、错误、中断、绕过等）。
5.  **NodeGroup 支持**: **前端**负责在发送执行请求前，将包含 `NodeGroup` 的工作流**扁平化**为简单的节点和边列表。后端执行引擎仅处理扁平化的指令。
6.  **Bypass 行为明确**: 被绕过的节点应尽可能保持数据流的连续性，其行为由节点定义或引擎的智能默认规则决定，并清晰地在前端可视化。

## API 设计

### WebSocket API (主要供 ComfyTavern 前端)

*   **客户端 -> 服务端:**
    *   `PROMPT_REQUEST`: 提交工作流执行。
        *   Payload: `WorkflowExecutionPayload` (包含 `nodes: ExecutionNode[]`, `edges: ExecutionEdge[]`)
            *   `ExecutionNode`: `{ id: NanoId, fullType: string, inputs?: Record<string, any>, configValues?: Record<string, any>, bypassed?: boolean }`
    *   `EXECUTE_PREVIEW_REQUEST`: 请求执行下游节点的预览（当用户修改输入且预览开启时）。
        *   Payload: `{ previewRequestId?: string, workflowId?: string, changedNodeId: NanoId, inputKey: string, newValue: any /* 该值应与 changedNodeId 和 inputKey 对应的输入插槽的 dataFlowType 兼容 */ }` (需要定义 `ExecutePreviewRequestPayload`)
*   **服务端 -> 客户端:**
    *   `PROMPT_ACCEPTED_RESPONSE`: 确认收到请求。
        *   Payload: `{ promptId: string }`
    *   `EXECUTION_STATUS_UPDATE`: 更新工作流整体状态。
        *   Payload: `{ promptId: string, status: 'queued' | 'running' | 'complete' | 'error' | 'interrupted', errorInfo?: any }`
    *   `NODE_EXECUTING`: 通知节点开始执行。
        *   Payload: `{ promptId: string, nodeId: NanoId }`
    *   `NODE_PROGRESS`: (可选, 未来功能) 节点执行进度。
        *   Payload: `{ promptId: string, nodeId: NanoId, value: number, max: number }`
    *   `NODE_COMPLETE`: 通知节点执行完成。
        *   Payload: `{ promptId: string, nodeId: NanoId, output: any, executionType: 'full' | 'preview' }`
    *   `NODE_ERROR`: 通知节点执行出错。
        *   Payload: `{ promptId: string, nodeId: NanoId, errorDetails: any }`
    *   `NODE_BYPASSED`: (新增) 通知节点被绕过执行。
        *   Payload: `{ promptId: string, nodeId: NanoId, pseudoOutputs: any /* 绕过时产生的伪输出 */ }`

### HTTP API (主要供外部应用)

*   **`POST /prompt`**: 提交工作流执行。
    *   Request Body: `WorkflowExecutionPayload` (同 WebSocket)
    *   Response (200 OK): `{ promptId: string }`
*   **`GET /prompt/{promptId}`**: 查询指定执行的状态和结果（如果已完成）。
    *   Response: `{ promptId: string, status: string, outputs?: any, errorInfo?: any, nodeStates?: Record<NanoId, { status: string, outputs?: any, bypassedPseudoOutputs?: any, error?: any }> ... }`
*   **`GET /executions`**: 查看当前正在运行和等待队列中的任务列表。
    *   Response: `{ running: PromptInfo[], pending: PromptInfo[] }`
*   **`GET /history`**: 获取已完成的执行历史列表（支持分页）。 (待实现 History DB)
*   **`GET /history/{promptId}`**: 获取特定已完成执行的详细信息。 (待实现 History DB)
*   **`GET /view?filename=...&subfolder=...&type=...`**: 获取执行产生的输出文件。 (待实现 Output Manager)
*   **`POST /interrupt/{promptId}`**: 中断指定的执行（如果还在运行或排队）。
*   **`GET /object_info`**: 获取所有可用节点的定义信息。
*   **`GET /system_stats`**: 获取系统状态信息。

## 后端执行机制

1.  **并发调度器 (Concurrency Scheduler)**:
    *   (基本不变) 维护最大并发数、运行列表、等待队列，分配 `promptId`，处理执行与排队，发送全局状态更新。

2.  **执行引擎 (Execution Engine)**:
    *   由调度器启动，负责单个工作流的执行。
    *   **节点 `execute` 方法签名变更**: 节点的 `execute` 方法签名将更新为 `(inputs: Record<string, any>, configValues: Record<string, any>, context?: any) => Promise<Record<string, any>>` 以接收节点配置。
    *   **处理完整执行 (`PROMPT_REQUEST`)**:
        *   接收前端预处理（扁平化）后的 `WorkflowExecutionPayload`。`ExecutionNode` 中包含 `id`, `fullType`, `inputs` (非默认或连接值), `configValues` (节点实例配置), 和 `bypassed` (布尔标记)。
        *   基于扁平化的节点和边列表构建执行图（拓扑排序）。
        *   按拓扑顺序处理所有节点：
            *   获取当前节点的 `ExecutionNode` 数据和 `NodeDefinition`。
            *   **如果 `executionNode.bypassed === true`**:
                *   **调用 `handleBypassedNode(nodeDefinition, executionNode, currentInputs)` 处理绕过逻辑 (详见下方新章节)。**
                *   将产生的“伪输出”存入 `this.nodeResults[nodeId]`。
                *   通过 WebSocket 发送 `NODE_BYPASSED` 事件，包含伪输出。
                *   跳过此节点的 `execute` 方法调用。
            *   **如果 `executionNode.bypassed === false` (或未定义):**
                *   准备节点的实际输入 `preparedInputs` (来自上游 `nodeResults` 和 `executionNode.inputs` 及默认值)。
                *   **执行前验证**: 严格检查 `preparedInputs`，确保所有在 `nodeDefinition.inputs` 中标记为 `required: true` 的输入都具有有效值（非 `undefined`）。如果必需输入缺失，则节点执行失败，发送 `NODE_ERROR`，工作流中止。
                *   调用 `nodeDefinition.execute(preparedInputs, executionNode.configValues || {}, context)`。
                *   通过 WebSocket 发送 `NODE_EXECUTING`, `NODE_COMPLETE` / `NODE_ERROR` 事件。
        *   (其余逻辑如处理中断、与 Output Manager/History DB 协作基本不变，但 Output Manager 和 History DB 尚待实现)。
    *   **处理实时预览 (`EXECUTE_PREVIEW_REQUEST`)**:
        *   (基本逻辑不变) 接收 `ExecutePreviewRequestPayload`，加载工作流，分析下游依赖。
        *   遍历下游节点，检查 `isPreviewUnsafe`。
        *   安全节点执行预览逻辑，使用上游（可能是预览）输出。
        *   发送 `NODE_COMPLETE` (`executionType: 'preview'`)。
        *   **注意**: 预览执行时，如果遇到被 `bypassed` 的节点，也应遵循 `handleBypassedNode` 的逻辑来获取其伪输出，以确保预览数据流的连续性。

3.  **绕过节点处理 (`handleBypassedNode`) 新机制 (核心方案 V2)**:
    *   此函数在执行引擎内部，当遇到 `bypassed: true` 的节点时调用。
    *   输入参数: `nodeDefinition: NodeDefinition`, `executionNode: ExecutionNode`, `currentInputsOfBypassedNode: Record<string, any>` (该被绕过节点从其上游接收到的实际输入值)。
    *   输出: `pseudoOutputs: Record<string, any>` (该被绕过节点应产生的“伪输出”)。
    *   **逻辑步骤**:
        1.  **检查 `nodeDefinition.bypassBehavior`**:
            *   **如果 `bypassBehavior === 'mute'`**:
                *   所有输出槽的伪输出值设为 `undefined`。
            *   **如果 `bypassBehavior` 是一个对象 `{ passThrough?: ..., defaults?: ... }`**:
                *   遍历 `passThrough` 规则：对于每个 `outputKey: inputKey` 映射，伪输出 `pseudoOutputs[outputKey]` 的值设为 `currentInputsOfBypassedNode[inputKey]`。
                *   遍历 `defaults` 规则：对于每个 `outputKey: defaultValue` 映射，如果 `pseudoOutputs[outputKey]` 尚未通过 `passThrough` 设置，则设为 `defaultValue`。
                *   **类型验证**: 在此步骤中，应验证通过 `passThrough` 或 `defaults` 得到的值是否与其对应输出槽的 `OutputDefinition` (特别是 `dataFlowType` 和 `matchCategories`) 兼容。若不兼容，该特定伪输出应被视为 `undefined` 或记录一个内部错误标记，以避免污染下游。
            *   **如果 `nodeDefinition.bypassBehavior` 未定义 (执行引擎的默认回退策略):**
                *   初始化一个空的 `pseudoOutputs` 对象。
                *   获取该节点的所有输入槽定义 (`inputSlotDefs`) 和输出槽定义 (`outputSlotDefs`)。
                *   创建一个可用输入槽键的列表 `availableInputKeys = Object.keys(currentInputsOfBypassedNode)`。
                *   **遍历输出槽 (按其在 `NodeDefinition` 中的定义顺序):**
                    *   对于当前输出槽 `outputDef`:
                        *   **尝试智能穿透匹配:** 遍历 `availableInputKeys`。对于每个 `inputKey`：
                            *   获取对应的输入槽定义 `inputDef = nodeDefinition.inputs[inputKey]`。
                            *   如果 `isTypeCompatible(outputDef, inputDef)` 为 `true` (此函数需考虑 `DataFlowType` 和 `matchCategories` 的兼容性规则):
                                *   `pseudoOutputs[outputDef.key] = currentInputsOfBypassedNode[inputKey]`。
                                *   从 `availableInputKeys` 中移除 `inputKey` (一个输入只能被穿透一次)。
                                *   跳出内部循环，处理下一个输出槽。
                        *   **如果未能匹配到穿透输入:**
                            *   `pseudoOutputs[outputDef.key] = getGenericEmptyValueForType(outputDef.dataFlowType)`。
                                *   `STRING` -> `""`
                                *   `NUMBER` (INTEGER/FLOAT) -> `0`
                                *   `BOOLEAN` -> `false`
                                *   `ARRAY` -> `[]`
                                *   `OBJECT` -> `{}`
                                *   特定资源类型 (如 `IMAGE_DATA`): `null` 或其标准空表示。
                                *   `WILDCARD`/`CONVERTIBLE_ANY`: `undefined`。
        2.  返回计算得到的 `pseudoOutputs`。

4.  **输出管理器 (Output Manager)**: (待实现)
    *   负责存储执行产生的实际输出文件（非伪输出）。
    *   提供 `/view` API 的文件访问能力。

5.  **历史记录 (History DB)**: (待实现)
    *   存储已完成或出错的工作流执行记录。
    *   提供 `/history` API 的数据查询能力。

## 前端集成 (ComfyTavern UI)

1.  **触发**: (不变)
2.  **转换与扁平化**: (不变)
    *   在转换为 `WorkflowExecutionPayload` 时，确保 `ExecutionNode` 包含正确的 `bypassed` 状态和 `configValues`。
3.  **发送**: (不变)
4.  **状态管理**: (`useWorkflowExecutionState` 或类似机制)
    *   (基本不变) 监听执行事件。
    *   **新增**: 监听并处理 `NODE_BYPASSED` 事件，更新节点状态以反映其被绕过，并存储/显示其 `pseudoOutputs`。
    *   区分预览、完整执行结果和绕过伪输出。
5.  **UI 反馈**:
    *   `BaseNode.vue` 等节点组件根据执行状态（包括是否被绕过）更新视觉样式。
        *   被绕过的节点应有特殊视觉提示（例如，半透明）。
        *   **可视化内部穿透路径**: 当节点被绕过时，前端应根据 `nodeDefinition.bypassBehavior` 或（若无此定义则）运行与后端一致的默认智能穿透推断逻辑，来确定数据是如何在节点内部“流动”的。在节点UI上绘制半透明的内部连线来可视化这些穿透路径。对于没有形成穿透的输出（例如，来自`'mute'`行为、`defaults` 或通用空值），则不显示内部连线。
    *   显示执行输出、预览输出或绕过伪输出。

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
*   **补充**: 当预览执行遇到被 `bypassed` 的节点时，也应遵循上述 `handleBypassedNode` 的逻辑来获取其伪输出，以确保预览数据流的连续性。

## Mermaid 流程图

```mermaid
graph TD
    subgraph Frontend (ComfyTavern UI)
        UI_Button[Run Button] --> Coord[Coordinator]
        Coord --> Flatten{Flatten Workflow (incl. bypassed, configValues)}
        Flatten -- Flat PROMPT_REQUEST --> WS_Client[WebSocket Client]
        WS_Client -- PROMPT_ACCEPTED_RESPONSE --> ExecState[Execution State Mgmt]
        WS_Client -- EXECUTION_STATUS_UPDATE --> ExecState
        WS_Client -- NODE_EXECUTING --> ExecState
        WS_Client -- NODE_COMPLETE --> ExecState
        WS_Client -- NODE_ERROR --> ExecState
        WS_Client -- NODE_BYPASSED --> ExecState
        ExecState -- Update Node UI/Style --> UI_Nodes[Node UI Feedback]
        ExecState -- Show Internal Bypass Paths --> UI_Nodes
        ExecState -- Update Global Status --> UI_Global[Global Status UI]
    end

    subgraph Backend
        WS_Server[WebSocket Server] <--> WS_Client
        HTTP_Server[HTTP Server]

        WS_Server -- Workflow Request --> Scheduler[Concurrency Scheduler]
        HTTP_Server -- POST /prompt --> Scheduler

        Scheduler -- Can Run? --> StartExec[Start Async Execution]
        StartExec --> Executor[Execution Engine]

        Executor -- For Each Node --> CheckBypassed{Bypassed?}
        CheckBypassed -- Yes --> HandleBypass[Handle Bypassed Node]
        HandleBypass -- Get PseudoOutputs --> StoreResults[Store Node Results]
        HandleBypass -- Send NODE_BYPASSED --> WS_Server
        CheckBypassed -- No --> PrepareInputs[Prepare Inputs & Validate Required]
        PrepareInputs -- Valid --> ExecuteNodeLogic[Execute Node Logic (call .execute)]
        PrepareInputs -- Invalid (Missing Required) --> NodeError[Node Error]
        ExecuteNodeLogic -- Success --> StoreResults
        ExecuteNodeLogic -- Send NODE_EXECUTING/COMPLETE --> WS_Server
        ExecuteNodeLogic -- Error --> NodeError
        NodeError -- Send NODE_ERROR --> WS_Server
        
        StoreResults -- (used by downstream)

        Executor -- Workflow Complete/Error --> Scheduler
        Scheduler -- Final Status --> WS_Server
        Scheduler -- Manage Queue & Concurrency --> StartExec
        
        %% Placeholder for future services
        Executor --> OutputMgr[(Output Manager - TBD)]
        Executor --> HistoryDB[(History DB - TBD)]
    end
```

## 待讨论/细化 (更新)

*   `WorkflowExecutionPayload` 中是否需要包含 `workflowData` 或其他元数据 (如 `clientId`, `userId`)。 (保持讨论)
*   错误处理细节：节点错误是否总是中断整个工作流？预览执行失败如何更优雅处理？ (保持讨论)
*   并发执行时的资源管理策略。 (保持讨论)
*   历史记录存储的具体内容和格式 (待 Output Manager / History DB 实现时细化)。
*   身份验证/授权机制。 (未来功能)
*   未来迭代/循环场景的支持方式。 (未来功能)
*   预览不安全标记 (`isPreviewUnsafe`) 的具体标准和默认值。 (保持现有设计)
*   预览请求的防抖/节流策略。 (前端实现细节)
*   前端如何精确存储、区分和展示预览值、完整执行值和绕过伪输出。 (前端状态管理细节)
*   **新增**: `isTypeCompatible(outputSlotDef, inputSlotDef)` 函数的具体实现逻辑，需要同时考虑 `DataFlowType` 和 `matchCategories`。
*   **新增**: 各种核心 `DataFlowType` 的标准“通用空值”的具体定义列表。