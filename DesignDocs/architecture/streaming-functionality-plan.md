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
- **显式流聚合节点 (`StreamAggregatorNode`) 与通用转换节点理念**：

  - **核心思想**：为了解决流式数据 (`STREAM`) 与需要完整数据的批处理节点 (`STRING`, `ARRAY`) 之间的适配问题，并提升工作流的清晰度和可组合性，引入显式的 `StreamAggregatorNode`。这遵循“显式优于隐式”和“万物皆节点”的原则。
  - **`StreamAggregatorNode` 定义**:
    - **目的**: 消费一个完整的输入流，将其聚合成批处理数据（如完整文本或块数组），然后一次性输出。
    - **输入槽**:
      ```typescript
      inputs: {
        input_stream: { dataFlowType: 'STREAM', matchCategories: ['LiveStream', 'TextStream', 'StreamChunk', 'Any'] }
      }
      ```
    - **输出槽**:
      ```typescript
      outputs: {
        aggregated_text: { dataFlowType: 'STRING', matchCategories: ['LlmOutput', 'Prompt', 'AggregatedText'] },
        chunk_list: { dataFlowType: 'ARRAY', matchCategories: ['StreamChunkList', 'LlmOutput', 'AggregatedChunks'] }
        // 未来可扩展: joined_string_with_delimiter, etc.
      }
      ```
    - **`execute` 逻辑 (概念性)**:
      ```typescript
      // 非 async function*
      async function execute(inputs: {
        input_stream: AsyncGenerator<ChunkPayload>;
      }): Promise<Outputs> {
        const cachedChunks: ChunkPayload[] = [];
        let aggregatedText = "";
        for await (const chunk of inputs.input_stream) {
          cachedChunks.push(chunk);
          if (chunk.type === "text_chunk" && typeof chunk.content === "string") {
            aggregatedText += chunk.content;
          }
          // 可选: 发布聚合进度事件
        }
        return {
          aggregated_text: aggregatedText,
          chunk_list: cachedChunks,
        };
      }
      ```
  - **可配置性**:
    - `aggregation_mode`: (例如: 'concatenate_text', 'collect_chunks_array', 'collect_text_array_by_delimiter')
    - `delimiter_char_for_text_array`: (用于 `collect_text_array_by_delimiter` 模式)
    - `timeout_ms`: (超时强制结束聚合)
    - `max_chunks_count`: (最大块数量限制)
    - `max_buffer_size_kb`: (最大缓冲大小限制)
  - **价值与影响**:
    - **架构清晰性**: 工作流明确表达数据转换意图。
    - **灵活性与可组合性**: 用户精确控制聚合点，并可组合多种流转换/处理节点。例如：
      ```mermaid
      graph LR
          A[LLM 节点 (STREAM)] --> F1[StreamFilter (STREAM)];
          F1 --> TTS[TTS 节点 (STREAM)];
          F1 --> AGG[StreamAggregator (BATCH)];
          AGG --> BData{聚合后的批数据};
          BData --> REX[Regex 节点 (BATCH)];
          REX --> DEDUP[BatchDeduplicator (BATCH)];
          DEDUP --> SAVE[保存节点 (BATCH)];
          BData --> SUM[摘要节点 (BATCH)];
      ```
    - **前后端职责划分**: 后端图定义权威处理逻辑，简化前端状态管理，保证数据一致性。
    - **引擎简化**: 聚合逻辑下沉到节点，引擎更纯粹。
  - **通用转换节点理念**: `StreamAggregatorNode` 是此类显式转换节点的代表。未来可设计更多原子转换节点 (如 `StreamFilterNode`, `SentenceSplitterNode`, `BatchToStreamNode`)，形成强大的数据处理管道能力。

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

### 6.1. 核心流处理机制：多路复用、背压与 LLM 解耦策略

在阶段二中，实现高效、健壮的多路复用（Multicasting）与背压（Backpressure）是核心技术挑战，尤其需要考虑 LLM 作为流源的特殊性。

#### 6.1.1. 多路复用与背压策略选择

经过分析，对于 Bun/Node.js 环境，我们考虑了以下主要策略：

1.  **手动分发器循环 + 队列 (Manual Distributor Loop + Queues)**：控制粒度细，但实现复杂度高，易出错。
2.  **Web Streams API - `ReadableStream.tee()`**: Web 标准，原生处理背压、错误和取消。对于 N>2 个消费者需要链式 `tee()`。是一个强有力的备选方案。
3.  **Node.js Streams - `.pipe()` + `PassThrough` (首选推荐)**：Node.js 生态成熟稳定，`.pipe()` 机制原生处理背压，多路分发结构清晰。`stream.Readable.from(asyncGenerator)` 提供了良好的 AsyncGenerator 集成。
4.  **反应式编程库 (e.g., RxJS)**：功能强大但背压模型（Push-based）与 AsyncGenerator（Pull-based）存在阻抗失配风险，引入额外复杂度和依赖。
5.  **Channel / CSP 模型**：并发模型优秀，但 JavaScript 无原生实现，需引入库或自建，成本高。

**推荐方案**：综合考虑成熟度、背压处理的可靠性、与 AsyncGenerator 的集成以及在 Bun/Node.js 环境下的自然度，**Node.js Streams (`stream.Readable.from` + `.pipe()` + `stream.PassThrough`)** 是当前阶段的首选。

#### 6.1.2. 针对 LLM 的解耦与缓冲策略

直接将背压传递给远程 LLM API 不可行或不经济。因此，我们采用 **“全速生产 + 有限缓冲 + 缓冲后全程背压 + 溢出熔断”** 策略：

1.  **解耦点 - 有限蓄水池 (`BoundedBuffer`)**:
    - 引擎（或 LLM 节点内部）为每个 LLM 流实例创建一个具有容量上限的内部缓冲区（`BoundedBuffer`）。
    - 这个 `BoundedBuffer` 负责存储从 LLM API 拉取的数据块。
2.  **汲水泵 (`Puller` Task)**:
    - 一个独立的异步任务（“汲水泵”）以最快速度从 LLM API 的原始流 (`asyncGenerator`) 中拉取所有数据块，并推入 `BoundedBuffer`。
    - 此任务的目标是让 LLM API 尽快完成生成并释放远端资源。
3.  **背压边界**:
    - 引擎的多路分发器（使用 Node.js Streams 实现）从 `BoundedBuffer` 中读取数据并分发给下游各个分支（如 TTS 节点、EventBus、内部缓存）。
    - 下游消费者的处理慢速所产生的背压，将通过 Node.js Streams 的 `.pipe()` 机制，反向传递到分发器，使其暂停从 `BoundedBuffer` 拉取数据。
    - **关键**：背压信号最多只传递到 `BoundedBuffer`，不会影响“汲水泵”任务从 LLM API 拉取数据的速度，除非 `BoundedBuffer` 已满。
4.  **溢出熔断 (Overflow Circuit Breaker)**:
    - `BoundedBuffer` 必须有明确的容量上限（例如，最大块数量、最大内存占用）。
    - 当“汲水泵”尝试向已满的 `BoundedBuffer` 推送数据时，`BoundedBuffer` 应抛出特定错误（如 `BufferOverflowError`）。
    - 引擎捕获此错误后，应立即采取熔断措施：取消整个工作流的执行，并清理所有相关资源（包括断开 LLM 连接、关闭所有流等）。这是防止系统因消费者过慢而耗尽内存导致 OOM 的核心保护机制。

#### 6.1.3. Node.js Streams 实现概念

以下是使用 Node.js Streams 和 `BoundedBuffer` 实现上述策略的简化概念代码：

```typescript
import * as stream from "stream";
import { promises as streamPromises } from "stream";

class BufferOverflowError extends Error {
  constructor(message = "Buffer overflow") {
    super(message);
    this.name = "BufferOverflowError";
  }
}

// 概念性的有限蓄水池
class BoundedBuffer<T> {
  // Escaped <T> just in case, though unlikely to be the issue
  private queue: T[] = [];
  private limit: number;
  private ended: boolean = false;
  private error: Error | null = null;
  private waitingPuller: ((value: void | PromiseLike<void>) => void) | null = null; // Escaped
  private waitingPusher: ((value: void | PromiseLike<void>) => void) | null = null; // Escaped

  constructor({ limit }: { limit: number }) {
    this.limit = limit;
  }

  async push(item: T): Promise<void> {
    // Escaped
    if (this.ended || this.error) throw new Error("Cannot push to ended or errored buffer");
    while (this.queue.length >= this.limit) {
      // Escaped >=
      if (this.ended || this.error)
        throw new Error("Buffer limit reached, push aborted by end/error");
      await new Promise<void>((resolve) => {
        this.waitingPusher = resolve;
      }); // Escaped
      this.waitingPusher = null;
    }
    this.queue.push(item);
    if (this.waitingPuller) this.waitingPuller();
  }

  signalEnd(): void {
    this.ended = true;
    if (this.waitingPuller) this.waitingPuller();
    if (this.waitingPusher) this.waitingPusher();
  }

  signalError(err: Error): void {
    this.error = err;
    this.ended = true;
    if (this.waitingPuller) this.waitingPuller();
    if (this.waitingPusher) this.waitingPusher();
  }

  isFull(): boolean {
    return this.queue.length >= this.limit; // Escaped >=
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, undefined> {
    // Escaped
    try {
      while (true) {
        if (this.error) throw this.error;
        if (this.queue.length > 0) {
          // Escaped >
          const item = this.queue.shift()!;
          if (this.waitingPusher) this.waitingPusher();
          yield item;
        } else if (this.ended) {
          return;
        } else {
          await new Promise<void>((resolve) => {
            this.waitingPuller = resolve;
          }); // Escaped
          this.waitingPuller = null;
        }
      }
    } finally {
      this.ended = true;
      if (this.waitingPuller) this.waitingPuller();
      if (this.waitingPusher) this.waitingPusher();
    }
  }
}

// 引擎执行 LLM 节点时的概念代码
async function executeLLMNodeInEngine(
  llmNode: any,
  llmRawGenerator: AsyncGenerator<any>, // Escaped
  engineContext: any
) {
  const buffer = new BoundedBuffer<any>({
    limit: engineContext.config.llmStreamBufferLimit || 1000,
  }); // Escaped
  let sourceStream: stream.Readable | null = null;
  const passThroughStreams: stream.PassThrough[] = [];

  const pullerTask = (async () => {
    try {
      for await (const chunk of llmRawGenerator) {
        if (buffer.isFull()) {
          throw new BufferOverflowError("LLM stream buffer overflow before push.");
        }
        await buffer.push(chunk);
      }
      buffer.signalEnd();
    } catch (error: any) {
      buffer.signalError(error);
      if (error instanceof BufferOverflowError) {
        engineContext.cancelWorkflow(
          engineContext.runId,
          `LLM stream buffer overflow: ${error.message}`
        );
      } else {
        engineContext.cancelWorkflow(
          engineContext.runId,
          `Error pulling from LLM: ${error.message}`
        );
      }
    }
  })();

  try {
    sourceStream = stream.Readable.from(buffer, { objectMode: true });
    sourceStream.on("error", (err) => {
      console.error(`SourceStream error for node ${llmNode.id}:`, err);
      passThroughStreams.forEach((pt) => pt.destroy(err));
    });

    const eventBusStream = new stream.PassThrough({ objectMode: true });
    passThroughStreams.push(eventBusStream);
    sourceStream.pipe(eventBusStream);
    const eventBusConsumer = (async () => {
      for await (const chunk of eventBusStream) {
        engineContext.eventBus.publish({
          type: "NODE_YIELD",
          nodeId: llmNode.id,
          chunk,
          runId: engineContext.runId,
        });
      }
    })();

    const cacheStream = new stream.PassThrough({ objectMode: true });
    passThroughStreams.push(cacheStream);
    sourceStream.pipe(cacheStream);
    const cachedChunks: any[] = [];
    let aggregatedText = "";
    const cacheConsumer = (async () => {
      for await (const chunk of cacheStream) {
        cachedChunks.push(chunk);
        if (chunk && typeof chunk.content === "string") {
          aggregatedText += chunk.content;
        }
      }
      llmNode.outputs.text.value = aggregatedText;
      llmNode.outputs.raw_chunks.value = cachedChunks;
      engineContext.markNodeBatchReady(llmNode.id);
    })();

    await Promise.all([
      pullerTask,
      streamPromises.finished(eventBusStream).catch((err) => {
        /* log consumer error */
      }),
      streamPromises.finished(cacheStream).catch((err) => {
        /* log consumer error */
      }),
    ]);
  } catch (error: any) {
    console.error(`Error in executeLLMNodeInEngine for ${llmNode.id}:`, error);
    if (!buffer.ended) buffer.signalError(error);
    passThroughStreams.forEach((pt) => pt.destroy(error));
    sourceStream?.destroy(error);
  } finally {
    passThroughStreams.forEach((pt) => {
      if (!pt.destroyed) pt.destroy();
    });
    sourceStream?.destroy();
  }
}
```

**关键实现注意点**：

- **`objectMode: true`**：所有 `stream.Readable.from` 和 `stream.PassThrough` 必须设置，因为我们传递的是 `ChunkPayload` 对象。
- **错误处理与资源清理**：这是流处理中最复杂的部分。必须在 `pullerTask`、`BoundedBuffer`、`sourceStream` 及所有 `PassThrough` 分支上严密处理错误和取消信号（如通过 `AbortSignal`），确保所有资源（特别是 `llmRawGenerator` 的 `return()` 或 `throw()`）被正确调用和清理，防止泄露。`streamPromises.finished` 有助于等待流结束或出错。
- **生命周期管理**：确保所有异步任务和流的生命周期得到妥善管理，例如，当工作流被取消时，所有相关的流和任务都能被正确终止。

这种结合了 `BoundedBuffer` 解耦和 Node.js Streams 成熟能力的方案，能在保证 LLM API 调用效率的同时，为下游提供可靠的、带背压的多路流分发。

- **交付价值**：
  - 实现真正的节点间实时数据流（如 LLM -> TTS 边说边合成）。
  - 数据流向与图结构一致，符合图引擎逻辑。
  - 性能最优（在上述解耦策略下）。

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

本计划遵循架构解耦和增量演进原则，清晰定义了事件总线与执行引擎在流式处理中的角色。通过“UI 实时化 -> 引擎级节点间数据流（辅以如 `StreamAggregatorNode` 等显式转换节点） -> 事件级协调控制”的路径，并紧密结合新的节点类型系统，逐步构建 ComfyTavern 的流式能力。

特别是，在阶段二引入显式的 `StreamAggregatorNode` 以及推广“通用转换节点”的设计理念，将极大地增强工作流的清晰度、可组合性和灵活性。这使得流式数据与批处理操作之间的转换更加透明和可控，完美契合了“图引擎本质”和“职责分离”的核心原则。

每一阶段都建立在坚实、可复用的基础之上，确保了技术路径的合理性与工程实现的可行性，最终将为用户提供一个强大、直观且易于扩展的 AI 工作流平台。
