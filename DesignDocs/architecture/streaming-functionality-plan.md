# ComfyTavern 流式功能演进计划

## 1. 引言

流式处理能力对于提升用户与AI交互的实时性和体验至关重要，尤其是在涉及大型语言模型（LLM）等生成式AI的场景中。本计划旨在通过一个迭代演进的策略，逐步为ComfyTavern平台引入和增强流式功能。我们将从基础的UI实时更新开始，逐步构建更高级的异步流式交互能力，并最终探索引擎层面对节点间原生实时流的支持。

## 2. 总体演进路径概述

我们计划通过以下三个主要阶段来推进流式功能的实现：

### 阶段一：基础流式能力与UI实时更新 (当前焦点)
-   **目标**：实现平台流式功能的基石，让用户能够实时看到LLM等节点的输出过程，并为下游节点提供访问完整原始流数据的能力。
-   **核心**：LLM节点通过 `yield` 产出数据块，通过事件总线驱动UI实时更新；节点执行完毕后返回所有原始数据块的集合，供新增的 `StreamReplayerNode` 封装为可多次回放的 `LiveStreamHandle`。
-   **状态**：**当前正在详细设计和计划实现此阶段。**

### 阶段二：基于事件总线的高级异步流式交互
-   **目标**：在阶段一构建的事件总线基础上，探索和实现更复杂的、跨不同执行上下文（可能是不同节点、不同工作流实例，或外部服务）的异步流式交互。
-   **核心**：增强事件总线的功能和事件类型。设计“协调器”模式或特定节点，使其能够订阅其他节点的流式事件，并根据这些事件触发自身的流式处理或控制逻辑（例如，实现用户描述的“角色A输出中，角色B监测并接力”的场景）。
-   **优点**：有望在不进行大规模引擎底层改造的前提下，快速实现许多高级的、动态的流式应用效果，提高平台的灵活性和交互性。

### 阶段三：引擎原生支持节点间实时流 (长远目标)
-   **目标**：实现执行引擎 ([`ExecutionEngine.ts`](apps/backend/src/ExecutionEngine.ts:1)) 对单个工作流内部节点之间直接传递实时数据流的底层支持。
-   **核心**：对 `ExecutionEngine.ts` 进行较大幅度的改造，引入流式输入/输出槽类型，设计节点间数据推送、反压、流控制等机制。LLM节点可以直接将其 `yield` 的数据块pipe给下游连接的节点进行实时处理。
-   **优点**：对于需要在单个工作流内进行紧密耦合、高性能的节点间实时流处理的场景，这是最理想和最高效的解决方案。

## 3. 阶段一详细设计与实现 (当前焦点)

### 3.1. 目标与核心特性 (阶段一)

-   **LLM节点流式产出 (Yield)**：LLM类型的节点（如OpenAI节点）能够在其执行过程中，通过 `yield` 逐块地产出数据。
-   **UI实时更新**：节点 `yield` 出的数据块能够通过WebSocket或SSE实时推送到前端UI并展示，例如在聊天界面中逐字显示LLM的响应。
-   **事件总线机制**：建立一个后端的事件总线，用于发布和订阅与工作流执行相关的事件，特别是节点 `yield` 的数据块。
-   **原始流数据可访问**：LLM节点在流式输出（`yield`）完成后，会 `return` 一个包含所有原始数据块的集合（例如一个数组 `raw_chunks_list`）。
-   **流回放节点 (`StreamReplayerNode`)**：
    -   新增一个 `StreamReplayerNode`。
    -   该节点接收上游节点（如LLM节点）返回的 `raw_chunks_list`。
    -   该节点输出一个 `LiveStreamHandle` 对象。
-   **`LiveStreamHandle` 对象**：
    -   `LiveStreamHandle` 对象封装了完整的原始数据块集合。
    -   它提供标准的异步迭代器接口 (`async *[Symbol.asyncIterator]()`)，允许下游节点按需、逐块地“回放”或消费这些原始数据块。
    -   支持多次独立的消费（每次迭代都从头开始）。

### 3.2. 关键设计点 (阶段一基线)

#### 3.2.1. 事件总线 (Event Bus)

-   **事件名称 (`eventName`) 模式**:
    -   采用通用事件名称 + `eventData.type` 区分具体事件。
    -   推荐模式: `workflow_event:${workflowRunId}` (例如: `workflow_event:run-xyz123`)
-   **事件数据 (`eventData`) 结构 (以 `NODE_YIELD` 类型为例)**:
    ```json
    {
      "type": "NODE_YIELD", // 事件的具体类型
      "timestamp": 1678886400000, // 事件发生的时间戳 (Unix milliseconds)
      "workflowRunId": "run-xyz123", // 当前工作流执行的唯一ID
      "sourceNodeId": "llm-node-abc456", // 产生此 `yield` 事件的节点ID
      "yieldedContent": { /* ... */ },  // 节点 `yield` 的实际内容 (ChunkPayload 结构)
      "isError": false, // 布尔值，标记这个 yieldedContent 是否表示一个错误信息
      "isLastChunk": false // 布尔值，标记这是否是此节点 yield 流的最后一个数据块
    }
    ```
    -   `isLastChunk` 将由执行引擎在检测到节点的异步生成器执行完毕后，在最后一个相关的 `NODE_YIELD` 事件中设置为 `true`。
    -   其他必要的 `eventData.type`（在 `eventData` 中）还包括：
        -   `NODE_EXECUTION_START`: 节点开始执行。
        -   `NODE_EXECUTION_COMPLETE`: 节点成功执行完毕。`eventData` 可能包含最终结果的摘要。
        -   `NODE_EXECUTION_FAILED`: 节点执行因未捕获的内部错误而失败。`eventData` 包含错误详情。此事件意味着该节点所有流（若有）均已异常终止。
        -   `NODE_EXECUTION_CANCELLED`: 节点执行因用户（或外部）请求而被取消。`eventData` 可能包含取消原因。此事件意味着该节点所有流（若有）均已终止。
        -   `WORKFLOW_EXECUTION_START`: 整个工作流开始执行。
        -   `WORKFLOW_EXECUTION_COMPLETE`: 整个工作流执行完毕。`eventData` 应包含最终状态（如 `success`, `failed`, `cancelled`）和可能的输出。

#### 3.2.2. `ChunkPayload` 接口 (初步)

-   这是LLM节点 `yield` 的单个数据块的结构，也是 `raw_chunks_list` 的元素类型。
-   至少包含:
    -   `content: any` (具体内容，例如文本块、工具调用信息等)
    -   `type: string` (块的类型，例如 `'text_chunk'`, `'tool_call_chunk'`, `'error_chunk'`, `'control_signal'`)
-   具体字段将在后续节点改造过程中根据实际需求进一步细化。

#### 3.2.3. `LiveStreamHandle` 实现 (`LiveStreamHandleImpl`)

-   由 `StreamReplayerNode` 创建并输出。
-   **实现方式**: 通过一个类实现。
    ```typescript
    class LiveStreamHandleImpl {
      private readonly originalChunks: ReadonlyArray<ChunkPayload>;

      constructor(chunks: ReadonlyArray<ChunkPayload>) {
        // 存储原始块的不可变副本，确保数据一致性和多次迭代的可靠性
        this.originalChunks = Object.freeze([...chunks]);
      }

      // 实现异步迭代器协议
      async *[Symbol.asyncIterator](): AsyncGenerator<ChunkPayload, void, undefined> {
        for (const chunk of this.originalChunks) {
          yield chunk;
        }
      }

      // 辅助方法：获取所有块的数组（如果下游需要一次性访问）
      public getAllChunks(): ReadonlyArray<ChunkPayload> {
        return this.originalChunks;
      }

      // 辅助方法：获取块的总数
      public get chunkCount(): number {
        return this.originalChunks.length;
      }
    }
    ```

#### 3.2.4. LLM节点改造 (以 [`OpenAINode.ts`](apps/backend/src/nodes/llm-test/OpenAINode.ts:1) 为例)

-   **`execute` 方法**: 改为异步生成器 `async function* execute(...)`。
-   **流式数据产出**: 在方法内部，通过 `yield chunkPayload;` 产出从LLM服务获取并适配后的每个数据块。
-   **错误处理**: 如果与LLM服务的SSE流中断或发生错误，节点应 `yield` 一个表示错误的 `ChunkPayload`。
-   **最终返回**: 当所有数据块 `yield` 完毕（或发生错误后 `yield` 了错误块），方法 `return` 一个对象，包含：
    -   `aggregated_text: string` (可选，所有文本块的聚合结果)
    -   `raw_chunks_list: ChunkPayload[]` (所有 `yield` 出的原始 `ChunkPayload` 对象的数组)

#### 3.2.5. `StreamReplayerNode` 设计

-   **节点定义**:
    -   **输入槽**:
        -   `raw_chunks: ARRAY` (期望接收 `ChunkPayload[]` 类型的数据)
    -   **输出槽**:
        -   `stream_handle: OBJECT` (其 `matchCategories` 将包含 `LiveStreamHandle`，以允许类型系统识别和连接)
-   **执行逻辑 (`execute` 方法)**:
    -   接收输入槽的 `raw_chunks` 数组。
    -   使用该数组实例化 `LiveStreamHandleImpl`。
    -   `return { stream_handle: new LiveStreamHandleImpl(raw_chunks) }`。

#### 3.2.6. 节点执行终止与流状态处理

节点的执行和其可能产生的 `yield` 流有以下几种主要的终止情况，执行引擎需要明确处理并发出相应的事件信号：

1.  **正常结束 / 空流结束 (Successfully Completed Stream / Empty Stream)**
    *   **场景**: 节点（如LLM节点）的 `async function* execute()` 方法正常执行完毕，所有数据块均已 `yield`，或者该方法从头到尾没有 `yield` 任何数据块（空流）。
    *   **引擎行为**:
        *   当节点的异步生成器迭代完成 (`done: true`)：
            *   如果至少 `yield` 了一个块：为最后一个实际 `yield` 的 `ChunkPayload`（可能是数据块或节点主动 `yield` 的错误块）发布的 `NODE_YIELD` 事件，其 `eventData.isLastChunk` 设为 `true`。
            *   如果未 `yield` 任何块（空流）：引擎发布一个 `NODE_YIELD` 事件，其 `eventData` 为 `{ yieldedContent: null, isError: false, isLastChunk: true, ... }`。
        *   随后，引擎发布 `NODE_EXECUTION_COMPLETE` 事件，`eventData` 中可指明执行成功。
    *   **流状态**: 清晰、正常结束。

2.  **因节点内部错误导致执行失败 (Execution Failed due to Unhandled Node Error)**
    *   **场景**: 节点的 `execute` 方法（或其调用的适配器）抛出一个未被节点自身 `try...catch` 处理的异常，导致执行引擎捕获此异常。这包括之前描述的“SSE流意外中断”且未被LLM节点优雅处理的情况。
    *   **LLM节点内建议的错误处理**: LLM节点应尽量 `try...catch` 来自适配器的错误，并 `yield` 一个 `type: 'error_chunk'` 的 `ChunkPayload`，然后其生成器正常结束。这种错误属于上述“正常结束”场景（最后一个块是错误块）。
    *   **引擎对未捕获异常的行为**:
        *   如果引擎捕获到从节点 `execute` 方法（或其生成器）中逃逸出来的未捕获异常：
            *   立即停止对该节点生成器的进一步处理。
            *   向事件总线发布 `NODE_EXECUTION_FAILED` 事件。`eventData` 包含 `sourceNodeId` 和详细错误信息。
    *   **流状态**: `NODE_EXECUTION_FAILED` 事件本身即宣告该节点所有相关的 `yield` 流均已强行、非正常终止。订阅方收到此事件后，应清理所有等待状态。

3.  **因用户/外部请求导致执行取消 (Execution Cancelled by User/External Request)**
    *   **场景**: 执行引擎收到针对某个正在执行（可能正在流式输出）的节点的取消请求。
    *   **引擎行为**:
        *   通知目标节点取消（例如，通过执行上下文中的取消令牌/状态）。
    *   **节点响应**:
        *   节点的 `execute` 方法应设计为可响应取消请求。检测到取消后，它应尽快停止工作（例如，中止对LLM适配器的调用），可以选择性地 `yield` 一个表示“已取消”的 `info_chunk`，然后其生成器结束，并 `return` 一个表示执行状态为“已取消”的 `NodeResult`。
    *   **引擎事件发布**:
        *   当引擎确认节点因取消请求而结束执行时（基于节点返回的“已取消”状态或引擎的强行终止），向事件总线发布 `NODE_EXECUTION_CANCELLED` 事件。`eventData` 包含 `sourceNodeId` 和可能的取消原因（如 `'USER_REQUEST'`)。
    *   **流状态**: `NODE_EXECUTION_CANCELLED` 事件宣告该节点所有相关的 `yield` 流均已因取消而终止。订阅方应清理等待状态。

通过这三种明确的节点执行终止事件 (`NODE_EXECUTION_COMPLETE`, `NODE_EXECUTION_FAILED`, `NODE_EXECUTION_CANCELLED`)，以及 `NODE_YIELD` 事件中的 `isLastChunk` 标记，可以为流的生命周期提供清晰、可靠的管理。

## 4. 后续阶段（阶段二与阶段三）的初步思考

### 4.1. 阶段二：基于事件总线的高级异步流式交互

-   **核心思路**：利用阶段一建立的事件总线，允许节点（或外部服务）订阅其他节点的流式输出事件 (`NODE_YIELD`)。
-   **关键组件/模式**：
    -   **增强的事件总线**：可能需要更细致的事件过滤、订阅管理。
    -   **“观察者/协调器”节点**：这类节点可以订阅特定节点的 `NODE_YIELD` 事件流，在内部进行逻辑处理（如缓冲、模式匹配、条件判断），然后触发自身的行为（如调用其他服务、`yield` 自己的数据流、或向其他节点发送控制信号）。
    -   **控制信号**：可能需要定义一些标准的控制信号（通过事件总线传递），例如请求某个正在流式输出的节点提前终止。
-   **示例场景（“监测与接力”）**：
    -   节点A (LLM) `yield` 数据块，通过事件总线发布。
    -   节点B (另一个LLM或逻辑节点) 订阅节点A的事件。
    -   节点B在接收到一定数量的块或特定内容后，决定“接力”或“打断”。
    -   节点B开始 `yield` 自己的数据块，也通过事件总线发布。
    -   如果需要“打断”，节点B可能向节点A发送一个“停止”信号。
-   **挑战**：状态同步、复杂协调逻辑的设计、UI对多并发流的优雅呈现。

### 4.2. 阶段三：引擎原生支持节点间实时流

-   **核心思路**：修改 [`ExecutionEngine.ts`](apps/backend/src/ExecutionEngine.ts:1) 的核心逻辑，使其能够理解和处理节点间的“流式连接”。
-   **关键组件/模式**：
    -   **流式槽类型**：在节点定义中引入新的输入/输出槽类型，明确标识用于实时流传递。
    -   **引擎调度改造**：引擎不再仅仅是 `await node.execute()`，而是能够建立从上游节点的流式输出到下游节点流式输入的管道。
    -   **背压 (Backpressure) 机制**：当下游节点处理速度跟不上上游节点的产生速度时，需要有机制防止数据丢失或内存溢出。
    -   **流控制API**：节点可能需要API来控制流的开始、暂停、恢复、终止。
-   **优点**：对于需要高性能、低延迟、紧密耦合的节点间流处理，这是最根本的解决方案。
-   **挑战**：设计和实现的复杂度非常高，对现有引擎是颠覆性改动。

此演进计划旨在平衡快速交付核心价值与应对未来复杂需求的能力，通过迭代的方式逐步完善平台的流式处理功能。