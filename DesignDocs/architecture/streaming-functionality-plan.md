# ComfyTavern 流式功能演进计划

## 1. 引言

流式处理能力对于提升 LLM 应用的实时交互体验至关重要。本计划旨在通过分阶段、迭代的方式，为 ComfyTavern 平台构建健壮、清晰的流式功能。计划将明确区分面向客户端的事件通知流、节点间的数据管道流以及控制协调信号，确保架构的清晰性与可扩展性，并与新的节点类型系统紧密集成。

## 2. 核心原则与架构视图

- **图引擎本质**：核心数据流应尽可能沿着工作流图定义的节点连线 (边) 进行传递。
- **职责分离与解耦**：
  - `ExecutionEngine`：核心职责是管理节点生命周期、执行调度、节点间数据传递（批处理与流式管道）。
  - `EventBus` (事件总线)：核心职责是作为解耦层，发布和订阅与执行过程相关的**事件**（状态、通知、控制信号、用于 UI 展示的数据块事件），而非承载节点间的核心数据管道。
  - `UI/Client`：监听事件总线，实时更新界面。
- **类型系统驱动**：利用 `DataFlowType` 和 `SocketMatchCategory` 定义数据格式和语义，指导连接规则、UI 渲染和引擎处理逻辑。
- **增量演进**：分阶段实现，每一步都构建可复用的基础，尽早交付用户价值，控制风险。避免“大爆炸”式发布 (Big Bang Release)。基操勿 6。

## 3. 节点类型系统集成

新的节点类型系统 (`DataFlowType`, `SocketMatchCategory`) 将按如下方式支持流式计划：

- **批处理数据块 (阶段一)**：
  - LLM 节点提供输出槽：
    - `text`: `{ dataFlowType: 'STRING', matchCategories: ['LlmOutput', 'Prompt'] }` (聚合文本)
    - `raw_chunks`: `{ dataFlowType: 'ARRAY', matchCategories: ['StreamChunkList', 'LlmOutput'] }` (所有块的数组)
  - `ChunkPayload` 对象是 `ARRAY` 的元素类型。
- **流式数据管道 (阶段二)**：
  - **新增 `DataFlowType: 'STREAM'`**：
    - 描述：表示一个可异步迭代的数据块流。
    - 对应 TypeScript 类型：`AsyncGenerator<ChunkPayload>` 或 `AsyncIterable<ChunkPayload>`。
  - LLM 节点新增输出槽：
    - `live_stream`: `{ dataFlowType: 'STREAM', matchCategories: ['LiveStream', 'TextStream', 'StreamChunk'] }`
  - 下游节点 (如 TTS) 定义输入槽：
    - `input_stream`: `{ dataFlowType: 'STREAM', matchCategories: ['TextStream', 'StreamChunk'] }`
  - **连接规则扩展**：
    - `STREAM` 输出槽只能连接到 `STREAM` 输入槽。
    - 连接兼容性判断：优先基于 `matchCategories` 的交集（如 `TextStream` -> `TextStream`），其次是 `STREAM` -> `STREAM` 的类型匹配。
    - `STREAM` 输出槽不能直接连接到 `STRING`、`ARRAY` 等非流式输入槽（批处理数据由引擎通过非 `STREAM` 槽提供）。
- **事件内容 (各阶段)**：
  - `NODE_YIELD` 事件中的 `yieldedContent` 是 `ChunkPayload` 对象。
  - `matchCategories: ['StreamChunk']` 可用于描述 `ChunkPayload` 的性质。

## 4. 总体演进路径概述

### 阶段一：【基线】UI 实时流与块数据的批处理访问

- **目标**：实现 LLM -> EventBus -> UI 的实时更新；节点间仍为批处理，但提供完整块数组访问。
- **核心**：建立事件总线机制，节点 `yield`，引擎捕获并发布事件，同时缓存数据供批处理槽。

### 阶段二：【核心】引擎原生节点间实时流

- **目标**：引擎支持 `STREAM` 类型槽，实现节点间 `AsyncGenerator` 的实时管道连接与多路复用。
- **核心**：引入 `DataFlowType: 'STREAM'`，改造引擎实现数据管道、背压、多路复用（Pipe to Node, Publish to EventBus, Cache for Batch）。

### 阶段三：【高级】基于事件的协调与控制

- **目标**：利用事件总线实现非直接连接节点间的复杂交互（打断、接力）。
- **核心**：协调器节点监听事件总线，通过引擎控制 API 进行干预。

## 5. 阶段一：UI 实时流与批处理访问

- **目标**：
  1.  用户在 UI 上实时看到 LLM 逐字输出。
  2.  下游节点可在 LLM 结束后访问完整文本或 `ChunkPayload` 数组。
  3.  建立并验证事件总线和前后端通信机制。
- **架构流程**：`LLM Node (yield)` -> `Engine (capture, cache, event-ify)` -> `EventBus` -> `Frontend (WS/SSE listener)` -> `UI Update`。
  同时： `Engine (finalize)` -> `LLM Node Batch Slots (STRING, ARRAY)` -> `Downstream Node (batch process)`。
- **关键设计点**：
  - **LLM 节点**：
    - `execute` 方法：改为 `async function*`，`yield chunkPayload;`。
    - 输出槽定义：
      ```typescript
      outputs: {
        text: { dataFlowType: 'STRING', matchCategories: ['LlmOutput', 'Prompt'] },
        raw_chunks: { dataFlowType: 'ARRAY', matchCategories: ['StreamChunkList', 'LlmOutput'] }
        // 阶段二增加 live_stream: STREAM
      }
      ```
  - **执行引擎 (`ExecutionEngine.ts`)**：
    - 迭代 LLM 节点的 `asyncGenerator`。
    - 对每个 `yield` 的 `chunk`：
      1.  发布 `NODE_YIELD` 事件到 `EventBus`。
      2.  缓存 `chunk` 到该节点的临时数组 `cachedChunks`。
      3.  缓存并聚合文本内容到 `aggregatedText`。
    - 当 Generator 结束 (`done: true`)：
      1.  发布最后一个 `NODE_YIELD` (或空 `YIELD`)，设置 `isLastChunk: true`。
      2.  发布 `NODE_EXECUTION_COMPLETE` (或 `FAILED`/`CANCELLED`) 事件。
      3.  将 `aggregatedText` 赋值给 `node.outputs.text`。
      4.  将 `cachedChunks` 赋值给 `node.outputs.raw_chunks`。
      5.  触发等待该节点批处理输出的下游节点执行。
  - **事件总线 (EventBus)**：
    - 事件结构：包含 `type` (`NODE_YIELD`, `NODE_COMPLETE`...), `timestamp`, `workflowRunId`, `sourceNodeId`, `yieldedContent: ChunkPayload`, `isError`, `isLastChunk`。
    - 清晰的生命周期事件管理 (`START`, `YIELD`, `COMPLETE`/`FAILED`/`CANCELLED`)。
  - **`ChunkPayload` 接口**：`{ content: any, type: 'text_chunk' | 'tool_call_chunk' | ... }`。
  - **前端**：建立 WS/SSE 连接，监听 `workflow_event:${workflowRunId}`，根据 `event.type` 和 `event.sourceNodeId` 更新 UI。
- **交付价值**：
  - 快速提供用户可感知的 UI 实时性。
  - 建立并验证了事件总线、事件结构、节点 `yield` 模式、前后端通信，这些都是后续阶段的基础。
  - 风险低，复杂度可控。

## 6. 阶段二：引擎原生节点间实时流

- **目标**：实现 `Node A (STREAM)` -> `Engine (Pipe)` -> `Node B (STREAM)` 的实时数据管道。
- **架构流程**：`LLM Node (yield)` -> `Engine (Multicast)`：
  1.  -> `Pipe` -> `Downstream Node B (for await...of)`
  2.  -> `EventBus` -> `Frontend` (复用阶段一)
  3.  -> `Cache` -> `Batch Slots (STRING, ARRAY)` (复用阶段一)
- **关键设计点**：
  - **类型系统**：
  - 正式引入 `DataFlowType: 'STREAM'`。
  - 更新连接规则，处理 `STREAM` -> `STREAM` 的连接。
  - **节点定义**：
    - LLM 新增输出：`live_stream: { dataFlowType: 'STREAM', matchCategories: ['LiveStream', 'TextStream', 'StreamChunk'] }`
    - TTS 定义输入：`input_stream: { dataFlowType: 'STREAM', matchCategories: ['TextStream', 'StreamChunk'] }`
    - TTS `execute`: `async function* execute(inputs: { input_stream: AsyncGenerator<ChunkPayload> }) { for await (const chunk of inputs.input_stream) { /* process & yield audio chunk */ } }`
  - **执行引擎 (`ExecutionEngine.ts`) - 核心改造**：
    - **调度**：识别 `STREAM` 连接。当 `Node A (STREAM)` 连接到 `Node B (STREAM)` 时，引擎不再等待 A 结束，而是并发启动 A 和 B。
    - **管道 (Piping)**：将 `A.execute()` 返回的 `asyncGenerator` 作为参数传递给 `B.execute()`。
    - **多路复用 (Multicasting)**：**关键难点**。引擎需要一种机制（如基于 Channel, Observable 或自定义流分发器），将 LLM 的单一 `asyncGenerator` 分发给多个消费者：
      1.  连接 `live_stream` 槽的下游节点 B。
      2.  引擎内部监听器（用于发布 `NODE_YIELD` 到 EventBus）。
      3.  引擎内部监听器（用于缓存数据，填充 `text` 和 `raw_chunks` 批处理槽）。
    - **背压 (Backpressure)**：必须实现机制，当下游节点 B 或 EventBus 消费速度慢于 LLM 生产速度时，能暂停或减慢 LLM 的 `yield`，防止内存溢出。
    - **错误与取消传播**：流管道中的任何错误或取消信号，需要能正确地向上传播（取消上游）和向下传播（通知下游流已断开）。
  - **事件总线**：复用阶段一机制，由引擎的多路复用分发器负责发布事件。
- **交付价值**：
  - 实现真正的节点间实时数据流（如 LLM -> TTS 边说边合成）。
  - 数据流向与图结构一致，符合图引擎逻辑。
  - 性能最优。

## 7. 阶段三：基于事件的协调与控制

- **目标**：实现“监测-打断-接力”等复杂、非线性的控制逻辑。
- **架构流程**：
  1.  `LLM_A (yield)` -> `Engine` -> `EventBus (NODE_YIELD)`
  2.  `Coordinator_B (subscribe EventBus)` -> 监听 `LLM_A` 的 `NODE_YIELD` 事件。
  3.  `Coordinator_B` 满足条件 -> 调用 `Engine Control API (e.g., cancelNode(LLM_A))`。
  4.  `Coordinator_B` -> 触发 `LLM_B.execute()` 或自身 `yield` 数据。
- **关键设计点**：
  - **协调器节点 (`CoordinatorNode`)**：
    - 通常没有数据流输入槽，或只有配置输入。
    - `execute` 逻辑：向 `EventBus` 订阅特定 `workflowRunId` 和 `sourceNodeId` 的事件。
    - 内部根据事件内容 (`yieldedContent`) 进行逻辑判断。
    - 通过注入的引擎控制接口，发出指令（如取消、启动）。
    - 可以有 `STREAM` 输出槽，用于“接力”场景。
  - **执行引擎 API**：提供控制接口，如 `cancelNodeExecution(workflowRunId, nodeId)`，供协调器节点调用。
  - **事件总线**：复用阶段一机制，作为控制信号和状态通知的通道。
- **交付价值**：
  - 实现复杂的多 Agent 协调和交互逻辑。
  - 控制逻辑与主数据流分离，保持数据流图的清晰性。

## 8. 风险与挑战

- **阶段二**：
  - `AsyncGenerator` 的多路复用 (Multicasting) 实现复杂度高。
  - 背压 (Backpressure) 机制的设计与实现。
  - 流管道中的错误处理和资源清理。
- **阶段三**：
  - 复杂协调逻辑可能引入竞态条件 (Race Condition) 和死锁。
  - 事件时序的保证。

## 9. 结论

本计划遵循架构解耦和增量演进原则，清晰定义了事件总线与执行引擎在流式处理中的角色。通过“UI 实时化 -> 引擎级节点间数据流 -> 事件级协调控制”的路径，并紧密结合新的节点类型系统，逐步构建 ComfyTavern 的流式能力。每一阶段都建立在坚实、可复用的基础之上，确保了技术路径的合理性与工程实现的可行性。
