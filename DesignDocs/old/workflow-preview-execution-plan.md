# 工作流预览执行方案 (前端主导)

## 1. 引言与目标

本文档阐述了一种新的工作流预览执行方案，该方案将主要的智能决策和子图构建逻辑置于前端，而后端则执行标准的工作流。此方案旨在实现高效、准确的预览，同时简化后端逻辑。它取代了先前讨论的后端主导的预览方案。

目标：

- 利用前端强大的图处理能力，在前端构建一个仅包含必要节点的“迷你预览工作流”。
- 后端使用其标准的完整执行引擎处理这个迷你工作流，无需特殊的预览逻辑。
- 前端负责合并预览结果与现有状态快照，并为 UI 提供准确的状态标记。

## 2. 核心流程：前端主导的预览

当用户操作触发预览时（如修改节点输入）：

1.  **前端：感知变更与状态准备**

    - 确定变更的起始节点 (`changedNodeId`) 和变更内容。
    - 获取或维护当前工作流所有节点输出值的最新快照 (`currentOutputsSnapshot`)。
    - 获取所有节点的元数据，特别是 `isPreviewUnsafe` 标记 (若为 `true` 则不安全，默认为 `false`/安全) 和 `bypassBehavior`。

2.  **前端：图分析与“待计算预览子图 (G')”构建**

    - 使用 `flattenWorkflow` (参考 [`apps/frontend-vueflow/src/utils/workflowFlattener.ts`](../../apps/frontend-vueflow/src/utils/workflowFlattener.ts:1)) 获取当前工作流的完整扁平化视图 (G_flat)。
    - 从 `changedNodeId` 开始，在 G_flat 上进行下游依赖分析，找出所有直接或间接受到变更影响的节点路径。
    - **筛选节点**：从这些受影响路径上的节点中，只选择那些 `isPreviewUnsafe` 为 `false` (或未定义，因而安全) 的节点。这些选中的节点构成“待计算预览子图 (G')”的候选节点。
      - 如果一个 `isPreviewUnsafe` 节点位于受影响路径上，它本身不加入 G'。其输出（如果被 G' 中的节点需要）将从 `currentOutputsSnapshot` 中获取。

3.  **前端：处理 G' 的边界输入**

    - 遍历 G' 中的每一个节点 `N_prime`。
    - 对于 `N_prime` 的每一个输入槽 `input_slot`：
      - 确定其在完整图 G_flat 中的上游源节点 `P` 和源输出槽 `output_slot_P`。
      - **If `P` 不在 G' 中 (即 `P` 是边界外的节点)**:
        - 从 `currentOutputsSnapshot[P.id]` 中获取 `output_slot_P` 的值。
        - 将此值作为常量，直接设置到 `N_prime` 对应 `input_slot` 的预设输入值中 (即构造 `ExecutionNode` 时填入 `inputs` 字段)。
      - **If `P` 也在 G' 中**: 则此连接是 G' 内部连接，正常保留。

4.  **前端：准备 G' 中 `isPreviewSafe` 的 Bypass 节点数据**

    - 如果在构建 G' 的过程中，一个被选入 G' 的节点 `B` (因为它 `isPreviewUnsafe` 为 `false` 或未定义，因而安全) 在原始图中被用户设置为 `bypassed: true`:
      - 在构造发送给后端的 `ExecutionNode` for `B` 时，其 `bypassed` 标记应明确设置为 `true`。
      - 前端的核心职责是为节点 `B`（以及 G' 中的所有其他节点）准备正确的输入数据：
        - 如果 `B` 的某个输入槽连接到 G' **外部**的节点 `P_ext`（无论 `P_ext` 节点的 `isPreviewUnsafe` 状态如何），则从 `currentOutputsSnapshot[P_ext.id]` 获取对应输出值，并将其作为常量设置到 `B` 对应输入槽的预设输入值中。
        - 如果 `B` 的某个输入槽连接到 G' **内部**的另一个 `isPreviewUnsafe` 为 `false` (或未定义，因而安全) 的节点 `P_int`，则此连接在 G' 的边列表中正常保留。
    - 后端在执行时，会接收到这个带有 `bypassed: true` 标记且其 `isPreviewUnsafe` 为 `false` (或未定义，因而安全) 的节点 `B`。后端将使用其**标准的、通用的 Bypass 处理逻辑**（基于 `B.definition.bypassBehavior` 和前端提供的输入）来确定其输出。
    - **注意**: 如果一个在原始图中被设置为 `bypassed: true` 的节点 `B_unsafe` 本身是 `isPreviewUnsafe`，那么它**不会被加入 G'**。其输出（如果被 G' 中的节点需要）将按边界输入逻辑从 `currentOutputsSnapshot` 获取。这种情况下，`B_unsafe` 节点的 Bypass 状态对于预览的执行流程是无效的，因为它不参与预览执行。

5.  **前端：构造预览 `WorkflowExecutionPayload`**

    - `nodes`: 一个 `ExecutionNode[]` 数组，只包含最终确定的 G' 中的节点。
      - 每个 `ExecutionNode` 的 `inputs` 字段应包含在步骤 3 和 4 中预设的常量边界值或 Bypass 伪输出值。对于 G' 内部连接提供的输入，`inputs` 字段中不包含这些项。
      - `configValues` 和 `id`, `fullType` 正常填写。
      - `bypassed` 标记：对于发送到后端的 G' 中的节点，其 `bypassed` 标记应如实反映其在 G' 中（源自原始完整图，并经过 `isPreviewUnsafe` 为 `false` 的筛选后）的 Bypass 状态。即，如果一个 `isPreviewUnsafe` 为 `false` (或未定义，因而安全) 的节点在 G' 中且在原图中被设为 Bypass，则其标记为 `true`。
    - `edges`: 一个 `ExecutionEdge[]` 数组，只包含 G' 内部节点之间的连接。

6.  **前端：发送请求到后端**

    - 将构造好的“迷你预览工作流” `WorkflowExecutionPayload` 通过标准的 `PROMPT_REQUEST` WebSocket 消息发送给后端。
    - (或者，可使用独立的 `EXECUTE_MINI_WORKFLOW_REQUEST` 类型，但后端处理逻辑可复用)。

7.  **后端：标准执行**

    - 接收 `WorkflowExecutionPayload`。
    - 使用其现有的并发调度器和执行引擎，按拓扑顺序执行 Payload 中提供的节点和边。
    - 返回执行结果（例如，通过 `NODE_COMPLETE` 消息或一个包含所有结果的最终消息）。

8.  **前端：结果合并与状态赋予**
    - 接收后端对 G' 中节点的执行结果。
    - 创建一个最终的完整预览视图，合并 G' 中节点的新计算结果和不在 G' 中的节点从 `currentOutputsSnapshot` 获取的值。
    - 为画布上的每个节点赋予状态标记，用于 UI 展示：
      - **`newly_computed`**: G' 中成功执行并获得新输出的节点。
      - **`clean_reused`**: 不在 G' 中，其值从 `currentOutputsSnapshot` 获取，且该节点及其上游在完整图中均未受最初用户变更影响。
      - **`stale_unsafe_reused`**: 不在 G' 中，其值从 `currentOutputsSnapshot` 获取，但该节点是 `isPreviewUnsafe` 且它或其上游在完整图中受到了最初用户变更的影响（或它本身是 `isPreviewUnsafe` 且其值仅来自快照）。
      - **`error`**: G' 中执行出错的节点。

## 3. API 定义调整

### 3.1. WebSocket API: 客户端 -> 服务端

- **`PROMPT_REQUEST`**: (保持不变，或新增 `EXECUTE_MINI_WORKFLOW_REQUEST` 类型)

  - Payload: `WorkflowExecutionPayload` (参考 [`DesignDocs/old/workflow-execution-plan-v2.md#L30`](../../DesignDocs/old/workflow-execution-plan-v2.md:30))
    - `ExecutionNode.inputs` 可能包含前端预设的常量值。
    - `ExecutionNode.bypassed` 应为 `false`。

- ~~`EXECUTE_PREVIEW_REQUEST`~~: (根据新方案，此特定消息不再需要，或其 payload 与 `PROMPT_REQUEST` 一致)。

### 3.2. WebSocket API: 服务端 -> 客户端

- **`NODE_COMPLETE`**: (保持不变, 参考 [`DesignDocs/old/workflow-execution-plan-v2.md#L43`](../../DesignDocs/old/workflow-execution-plan-v2.md:43))
  - Payload: `{ promptId: string, nodeId: NanoId, output: any, executionType: 'full' | 'preview' }`
    - `executionType` 可为 `'preview'` 或 `'mini_workflow_preview'`。
- (可能需要一个消息来表示整个“迷你工作流”的完成或失败，例如扩展 `EXECUTION_STATUS_UPDATE` 来携带迷你工作流的 ID)。

## 4. 前端实现要点与依赖

- **强大的图处理能力**：扁平化、依赖分析、子图提取等。参考 [`apps/frontend-vueflow/src/utils/workflowFlattener.ts`](../../apps/frontend-vueflow/src/utils/workflowFlattener.ts:1)。
- **状态管理 (`currentOutputsSnapshot`)**：需要一个可靠的机制来获取和管理所有节点的当前输出值。
- **节点元数据访问**: 前端必须能获取每个节点的 `isPreviewUnsafe` 标记 (其值为 `true` 表示不安全，默认为 `false`/安全) 和 `bypassBehavior` 定义。
- **Bypass 状态标注**: 前端负责如实标注并传递 G' 中 `isPreviewUnsafe` 为 `false` (或未定义，因而安全) 的节点的 `bypassed: true` 状态。这些节点的输入，与 G' 中其他节点一样，由前端统一根据其来源（快照或 G' 内部连接）进行准备。后端将依据此状态和准备好的输入，使用其通用 Bypass 逻辑执行这些节点。
- **UI 反馈机制**: 根据合并后的结果和赋予的状态标记，清晰地向用户展示预览状态。

## 5. 后端职责

- 保持其执行引擎的纯粹性和通用性，能够正确处理包含预设 `inputs` 的 `ExecutionNode`。
- 高效执行收到的（可能是小型的）工作流。

## 6. 优势总结

- **后端极简**：核心执行逻辑统一，无需为预览添加特殊分支。
- **前端掌控力强**：预览的智能决策完全由前端控制，更灵活。
- **复用现有能力**：充分利用前端的图处理能力和后端的标准执行引擎。
- **潜在网络优化**：发送到后端的 payload 通常更小。

## 7. Mermaid 流程图 (新方案)

```mermaid
graph TD
    subgraph UserAction
        A[用户修改节点X的输入] --> B{前端感知变更 changedNodeId=X}
    end

    subgraph Frontend
        B --> C[获取 currentOutputsSnapshot]
        C --> D[获取完整扁平图 G_flat]
        D --> E{图分析: 从X下游找到受影响节点}
        E --> F{筛选受影响节点中 isPreviewUnsafe=false 的节点 => G' 候选}
        F --> G{边界输入处理: G'外节点P的输出 (来自快照) 作为常量注入G'内节点N的inputs}
        G --> H{Bypass处理: 模拟Bypass逻辑, 伪输出注入或调整连接}
        H --> I[构造迷你 WorkflowExecutionPayload (只含G'节点和边, inputs含预设值)]
        I --> J[通过 PROMPT_REQUEST 发送Payload到后端]
        K[接收后端对G'的执行结果] --> L{合并G'结果与快照中未计算的值}
        L --> M[为所有节点赋予状态标记 (newly_computed, clean_reused, stale_unsafe_reused)]
        M --> N[更新UI展示]
    end

    subgraph Backend
        O[接收 WorkflowExecutionPayload] <--> J
        O --> P[标准执行引擎处理Payload]
        P --> Q[返回G'中各节点执行结果] --> K
    end
```


## 8. 修改计划

**新预览方案核心回顾**

新方案将预览的智能决策和子图构建完全移至前端。前端负责：

1.  获取当前节点输出快照。
2.  使用 [`apps/frontend-vueflow/src/utils/workflowFlattener.ts`](apps/frontend-vueflow/src/utils/workflowFlattener.ts:1) 得到扁平化工作流。
3.  分析依赖，筛选 `isPreviewUnsafe` 为 `false` (或未定义，因而安全) 的节点构建“迷你预览工作流 (G')”。
4.  处理 G' 的边界输入（从快照获取常量值）。
5.  处理 `isPreviewUnsafe` 为 `false` (或未定义，因而安全) 的节点的 Bypass 状态：如实传递 `bypassed: true` 标记给后端，并为其准备正确的输入数据。实际的 Bypass 执行逻辑由后端通用能力负责。
6.  构造仅含 G' 的 `WorkflowExecutionPayload`（节点 `bypassed` 为 `false`，`inputs` 含预设值）。
7.  通过标准 `PROMPT_REQUEST` 发送给后端。
8.  接收后端对 G' 的执行结果，合并快照，并更新 UI 状态标记。

后端则简化为仅使用标准执行引擎处理前端发来的（可能是迷你的）`WorkflowExecutionPayload`。

**对现有项目的影响及修改计划**

**I. 类型定义 (`packages/types`)**

- **`packages/types/src/workflowExecution.ts`**:

  - **删除 `ExecutePreviewRequestPayload` 接口** ([`packages/types/src/workflowExecution.ts:191`](packages/types/src/workflowExecution.ts:191))。这是旧后端驱动预览的残留。
  - **关于 `NodeCompletePayload.executionType`** ([`packages/types/src/workflowExecution.ts:159`](packages/types/src/workflowExecution.ts:159)):
    - **采纳你的反馈，建议移除此字段**。前端可以通过 `promptId` 或其他上下文关联机制来识别响应是否对应其发起的预览请求。
    - 如果决定移除，则 `ExecutionType` 类型别名 ([`packages/types/src/workflowExecution.ts:145`](packages/types/src/workflowExecution.ts:145)) 也一并移除。
    - 如果因其他原因（如日志、调试便利性）仍希望保留某种标记，可以考虑让前端在 `WorkflowExecutionPayload.metadata` 中传递一个意图标记，后端据此设置 `executionType`，但这将作为辅助手段。**首选是移除。**
  - `ExecutionNode` ([`packages/types/src/workflowExecution.ts:18`](packages/types/src/workflowExecution.ts:18)) 和 `WorkflowExecutionPayload` ([`packages/types/src/workflowExecution.ts:54`](packages/types/src/workflowExecution.ts:54)) 结构保持，但前端构建时需注意内容（如 `inputs` 包含常量，`bypassed` 为 `false`）。

- **`packages/types/src/node.ts`**:
  - **删除 `WebSocketMessageType.EXECUTE_PREVIEW_REQUEST` 枚举成员** ([`packages/types/src/node.ts:227`](packages/types/src/node.ts:227))。
  - `NodeDefinition.isPreviewUnsafe` ([`packages/types/src/node.ts:114`](packages/types/src/node.ts:114)) 和 `NodeDefinition.bypassBehavior` ([`packages/types/src/node.ts:115`](packages/types/src/node.ts:115)) 已存在且满足新方案需求，无需修改。

**II. 前端 (`apps/frontend-vueflow`)**

前端将承担大部分新逻辑的实现。

- **`apps/frontend-vueflow/src/composables/workflow/useWorkflowPreview.ts`** ([`apps/frontend-vueflow/src/composables/workflow/useWorkflowPreview.ts:1`](apps/frontend-vueflow/src/composables/workflow/useWorkflowPreview.ts:1)):

  - **彻底重写此 composable**。移除发送旧 `EXECUTE_PREVIEW_REQUEST` 的逻辑。
  - **新增实现**：
    1.  **感知变更与状态准备**: 获取 `currentOutputsSnapshot` 和节点元数据 (`isPreviewUnsafe` (若为 `true` 则不安全，默认为 `false`/安全), `bypassBehavior`)。
    2.  **图分析与子图构建 (G')**: 使用 [`workflowFlattener.ts`](apps/frontend-vueflow/src/utils/workflowFlattener.ts:1) 获取 G_flat，然后进行依赖分析和节点筛选。
    3.  **处理 G' 边界输入**: 从快照获取值作为常量注入 `ExecutionNode.inputs`。
    4.  处理 G' 中的 `isPreviewUnsafe` 为 `false` (或未定义，因而安全) 的 Bypass 节点**: 确保在发送给后端的 `ExecutionNode` 中正确设置其 `bypassed: true` 标记，并为其准备和注入正确的输入数据（源自快照或 G' 内部连接）。后端将使用其通用 Bypass 逻辑处理该节点。
    5.  **构造 `WorkflowExecutionPayload`**: 包含 G' 的节点和边，正确设置 `inputs` 和 `bypassed` 标记。
    6.  **发送请求**: 通过 `PROMPT_REQUEST` (或类似消息) 发送 payload。
    7.  **结果合并与状态赋予**: 接收 `NODE_COMPLETE`，结合快照，更新节点 UI 状态标记 (`newly_computed`, `clean_reused`, `stale_unsafe_reused`, `error`)。

- **状态管理 (e.g., `executionStore`, `nodeStore`)**:

  - 增强以支持存储和访问 `currentOutputsSnapshot` 和新的节点预览状态。

- **UI 组件 (e.g., [`apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue:1))**:
  - 更新以反映新的节点预览状态标记。

**III. 后端 (`apps/backend`)**

后端逻辑将得到简化。

- **`apps/backend/src/websocket/handler.ts`**:

  - **删除处理 `WebSocketMessageType.EXECUTE_PREVIEW_REQUEST` 的 `case` 块** ([`apps/backend/src/websocket/handler.ts:85-96`](apps/backend/src/websocket/handler.ts:85-96))。
  - 移除 `ExecutePreviewRequestPayload` 的导入 ([`apps/backend/src/websocket/handler.ts:6`](apps/backend/src/websocket/handler.ts:6))。
  - 现有的 `PROMPT_REQUEST` 处理器 ([`apps/backend/src/websocket/handler.ts:70-82`](apps/backend/src/websocket/handler.ts:70-82)) 将用于接收前端构建的迷你预览工作流。

- **`apps/backend/src/ExecutionEngine.ts`**:
  - **删除 `public async runPreview(...)` 方法** ([`apps/backend/src/ExecutionEngine.ts:176-211`](apps/backend/src/ExecutionEngine.ts:176-211))。
  - **删除 `ExecutePreviewRequestPayload` 的导入** ([`apps/backend/src/ExecutionEngine.ts:13`](apps/backend/src/ExecutionEngine.ts:13))。
  - 如果 `private getDownstreamNodes(...)` 方法 ([`apps/backend/src/ExecutionEngine.ts:601`](apps/backend/src/ExecutionEngine.ts:601)) 仅被 `runPreview` 使用，则一并删除。
  - `ExecutionEngine.run()` ([`apps/backend/src/ExecutionEngine.ts:74`](apps/backend/src/ExecutionEngine.ts:74)) 将执行前端发来的迷你预览工作流。
  - 关于 `sendNodeComplete` ([`apps/backend/src/ExecutionEngine.ts:645`](apps/backend/src/ExecutionEngine.ts:645))：如果 `NodeCompletePayload.executionType` 被移除，则后端发送时无需再关心此字段。如果保留并由前端通过 `metadata` 控制，则后端需读取 `payload.metadata` 来设置。
