# ComfyTavern 流式功能详细设计与执行方案 (v2.0)

## 1. 摘要 (Executive Summary)

本文档为 ComfyTavern 平台流式处理功能的最终设计与实施方案。基于对前期探索的反思，本方案采用**“核心基石优先 (Foundation First)”**策略，旨在通过一次性的核心架构改造，构建一个完整、健壮且可扩展的流式处理引擎。方案详细阐述了从类型系统、引擎核心机制到关键节点实现的全链路设计，并提供了一份清晰的、可分步执行的实施路线图，以确保项目成功落地。

## 2. 背景与动机

将流式功能拆分为“UI 实时化”和“节点间数据流”的增量计划已被证实存在实践上的根本困难，会导致架构不一致与高昂的技术债。因此，本方案将所有流式处理的底层核心机制——包括类型、调度、多路复用、背压、事件——视为一个不可分割的整体，进行统一设计与实现。

## 3. 核心设计原则

- **图引擎本质**: 数据流严格遵循工作流图的显式连接。
- **职责分离**: 引擎负责数据管道，事件总线负责状态广播，节点负责业务计算。
- **显式优于隐式**: 关键的数据转换（如流转批）必须由用户在图中明确放置的节点完成。
- **类型系统驱动**: `DataFlowType` 指导连接、验证与执行，保证工作流的健壮性。

## 4. 核心架构详解

#### 4.1. 类型系统: `DataFlowType: 'STREAM'`

- **定义**: `STREAM` 类型代表一个可异步迭代的数据块流 (`AsyncGenerator<ChunkPayload>`)。
- **连接规则**:
  - `STREAM` 输出槽**只能**连接到 `STREAM` 输入槽。
  - 引擎的图验证逻辑必须在执行前强制执行此规则。
  - `STREAM` 与 `STRING`, `ARRAY`, `OBJECT` 等批处理类型之间**不可**直接连接。
- **语义匹配**: `matchCategories` (如 `['TextStream', 'LiveStream']`) 依然用于提供更精细的连接建议和兼容性判断。

#### 4.2. 节点执行契约: `async function*`

节点通过将 `execute` 方法实现为 `async function*` 来声明其流式能力。引擎与节点之间遵循以下严格契约：

- **`yield`**:
  - 用于产出流式数据块 (`ChunkPayload`)。
  - 每次 `yield`，引擎的多路分发器会捕获数据块，并将其推送给所有下游消费者。
  - `yield` 是流式数据的**唯一**出口。
- **`return`**:
  - 用于在**批处理模式**下，当生成器执行完毕后，返回一个包含所有批处理输出槽结果的对象。
  - 引擎在捕获到生成器的 `done: true` 状态后，会检查其 `value` (即 `return` 的值)，并用它来填充对应的批处理输出槽。
  - 在流式模式下，`return` 语句应返回 `void` 或不返回，其值将被引擎忽略。

#### 4.3. 执行引擎: 多路复用与核心流处理机制

这是整个架构的心脏。其核心是 **“全速生产 + 有限缓冲 + 缓冲后全程背压 + 溢出熔断”** 策略。

##### 4.3.1. 核心流程

```mermaid
graph LR
    subgraph 节点内部 (e.g., OpenAINode)
        A[LLM API Stream] -- 1. 全速拉取 --> P(Puller Task);
    end

    subgraph 引擎核心
        P -- 2. 推入数据 --> BB[BoundedBuffer (有限蓄水池)];
        BB -- 3. 按需读取 (受背压影响) --> MC[Multicaster (Node.js Streams)];
    end

    subgraph 消费者
        MC -- a. pipe --> C1[下游节点 (TTS)];
        MC -- b. pipe --> C2[事件总线 -> UI];
        MC -- c. pipe --> C3[下游节点 (Logger)];
    end

    style BB fill:#f9f,stroke:#333,stroke-width:2px;
    linkStyle 0 stroke-width:2px,stroke:red,color:red;
    linkStyle 2 stroke-width:2px,stroke:blue,color:blue;
```

##### 4.3.2. 实现技术选型与伪代码

- **技术栈**: 采用 Node.js 内置的 `stream` 模块，因其成熟、稳定，并原生支持背压。
- **`BoundedBuffer`**: 一个自定义的、带容量限制的异步队列，作为生产者和消费者之间的解耦层。
- **多路分发器 (`Multicaster`)**: 使用 `stream.Readable.from(buffer)` 将 `BoundedBuffer` 转换为可读流，然后通过 `.pipe()` 连接多个 `stream.PassThrough` 实例来实现多路分发。所有流必须工作在 `objectMode: true`。

**概念性实现 (`Engine.ts`):**

```typescript
// 伪代码，展示在引擎中如何处理一个流式节点的执行
async function handleStreamNodeExecution(node, context) {
  const nodeGenerator = node.execute(node.inputs, context); // 获取节点的 async generator
  const buffer = new BoundedBuffer<ChunkPayload>({ limit: 1000 });
  const sourceStream = stream.Readable.from(buffer, { objectMode: true });

  // 1. Puller Task: 全速从节点 generator 拉取数据并推入 buffer
  const pullerTask = (async () => {
    try {
      for await (const chunk of nodeGenerator) {
        if (buffer.isFull()) {
          throw new BufferOverflowError(`Node ${node.id} stream buffer overflow.`);
        }
        await buffer.push(chunk);
      }
      buffer.signalEnd(); // 正常结束
    } catch (error) {
      buffer.signalError(error); // 传递错误
    }
  })();

  // 错误处理：如果 puller 任务或 buffer 出错，立即熔断
  pullerTask.catch(error => {
    if (error instanceof BufferOverflowError) {
      context.cancelWorkflow(error.message);
    }
    // ... 其他错误处理
  });

  // 2. Multicaster Setup: 创建多个 PassThrough 流用于分发
  // 分支 A: 事件总线
  const eventBusStream = new stream.PassThrough({ objectMode: true });
  sourceStream.pipe(eventBusStream);
  consumeForEventBus(eventBusStream, node.id, context);

  // 分支 B: 连接下游节点
  const downstreamConnections = context.getDownstreamStreamConnections(node.id);
  downstreamConnections.forEach(conn => {
    const downstreamStream = new stream.PassThrough({ objectMode: true });
    sourceStream.pipe(downstreamStream);
    // 将这个 stream 作为输入传递给下游节点的 execute 方法
    context.startDownstreamNode(conn.targetNodeId, { [conn.targetSocketName]: downstreamStream });
  });

  // 等待所有流处理完成
  await Promise.all([
    pullerTask,
    stream.promises.finished(eventBusStream).catch(logError),
    ...downstreamConnections.map(conn => /* 等待下游流完成的 Promise */)
  ]);
}
```

#### 4.4. 事件总线与事件模式

事件总线是解耦的广播系统。其事件结构必须标准化。

- **`NODE_YIELD` 事件模式**:
  ```json
  {
    "type": "NODE_YIELD",
    "timestamp": "2025-01-01T12:00:00.123Z",
    "promptId": "run-xyz-123",
    "sourceNodeId": "node-abc-456",
    "yieldedContent": {
      "type": "text_chunk",
      "content": "some text"
    },
    "isLastChunk": false // 引擎在流结束时会发送一个带 isLastChunk:true 的最终事件
  }
  ```
- 其他关键事件: `WORKFLOW_START`, `NODE_EXECUTION_START`, `NODE_EXECUTION_COMPLETE`, `NODE_EXECUTION_ERROR`, `WORKFLOW_FINISH`。

#### 4.5. `StreamAggregatorNode` 详细定义

这是连接流式世界与批处理世界的关键桥梁。

- **类型**: `StreamAggregator`
- **输入槽**:
  - `input_stream`: `{ dataFlowType: 'STREAM', matchCategories: ['Any'] }`
- **输出槽**:
  - `aggregated_text`: `{ dataFlowType: 'STRING' }` (将所有 `text_chunk` 拼接)
  - `chunk_list`: `{ dataFlowType: 'ARRAY' }` (包含所有 `ChunkPayload` 对象的数组)
- **配置参数 (`config`)**:
  - `aggregation_mode`: `'concatenate_text' | 'collect_chunks_array'` (未来可扩展)
  - `timeout_ms`: `number` (超时强制结束聚合)
  - `max_chunks_count`: `number` (最大块数量限制)
- **`execute` 逻辑**: 它是一个标准的 `async function` (非 `async function*`)，因为它只在流结束后才输出。
  ```typescript
  async function execute(inputs: { input_stream: AsyncGenerator<ChunkPayload> }, config: any) {
    const chunks: ChunkPayload[] = [];
    let text = "";
    for await (const chunk of inputs.input_stream) {
      chunks.push(chunk);
      if (chunk.type === "text_chunk" && typeof chunk.content === "string") {
        text += chunk.content;
      }
      // ... 此处可加超时和数量限制的检查
    }
    return { aggregated_text: text, chunk_list: chunks };
  }
  ```

## 5. 实施路线图: 阶段一【核心基石】任务清单

此阶段的目标是交付一个功能完整、可独立测试的流处理引擎。

1.  **[环境] 定义核心接口**:
    - 在 `@comfytavern/types` 中定义 `ChunkPayload` 接口。
2.  **[引擎] 实现 `BoundedBuffer`**:
    - 创建并单元测试 `BoundedBuffer` 类，包含 `push`, `asyncIterator`, `isFull`, `signalEnd`, `signalError` 方法。
3.  **[引擎] 实现多路分发器**:
    - 在引擎中创建 `handleStreamNodeExecution` 核心逻辑，使用 Node.js Streams 实现多路分发，并编写单元测试。
4.  **[引擎] 改造调度器**:
    - 更新图执行调度器，使其能识别 `STREAM` 连接并并发启动上下游节点。
    - 实现 `async function*` 的 `yield`/`return` 契约。
5.  **[事件] 集成事件总线**:
    - 实现 `EventBus`，并将其作为多路分发器的一个消费者，按标准模式发布事件。
6.  **[前端] 实现客户端监听**:
    - 前端建立 WebSocket/SSE 连接，订阅并处理 `NODE_YIELD` 事件以实时更新 UI。
7.  **[节点] 实现 `StreamAggregatorNode`**:
    - 根据 4.5 节的定义，完整实现该节点。
8.  **[节点] 改造 PoC 节点**:
    - 将 `OpenAINode` 按照[附录 A.3](#附录)的模板进行改造，使其同时支持流式与批处理模式。
9.  **[测试] 端到端集成测试**:
    - **Case 1 (UI)**: `OpenAINode (stream=true)` -> 确认前端 UI 逐字显示。
    - **Case 2 (流管道)**: `OpenAINode (stream=true)` -> `StreamLoggerNode` (一个简单的 `for await...of` 打印节点) -> 确认日志实时打印。
    - **Case 3 (流批转换)**: `OpenAINode (stream=true)` -> `StreamAggregatorNode` -> `SaveToFileNode` -> 确认文件内容是完整的文本。
    - **Case 4 (背压与熔断)**: `OpenAINode (stream=true)` -> `SlowConsumerNode` (带 `await delay()` 的节点) -> 确认内存占用稳定，并在 `BoundedBuffer` 满时工作流被正确取消。
    - **Case 5 (批处理兼容)**: `OpenAINode (stream=false)` -> `SaveToFileNode` -> 确认批处理模式工作正常。

## 6. 后续阶段展望

- **阶段二: 【生态扩展】**: 在坚实的地基上，丰富流式节点（TTS, 图像生成等）与通用转换工具 (`StreamFilterNode`等)。
- **阶段三: 【高级协调】**: 实现基于事件的 `CoordinatorNode` 和引擎控制 API，支持复杂的多 Agent 协作。

## 7. 附录

#### A.1: `ChunkPayload` 接口定义

```typescript
interface ChunkPayload {
  type:
    | "text_chunk"
    | "tool_call_chunk"
    | "finish_reason_chunk"
    | "usage_chunk"
    | "error_chunk"
    | "custom";
  content: any;
  [key: string]: any; // 允许附加元数据
}
```

#### A.2: 节点改造模板代码

```typescript
// 适用于任何需要支持流式/批处理双模式的节点
export class MyHybridNodeImpl {
  static async *execute(
    inputs: Record<string, any>
  ): AsyncGenerator<ChunkPayload, Record<string, any> | void, undefined> {
    const { stream, ...otherInputs } = inputs;

    if (stream) {
      // --- 流式处理逻辑 ---
      const serviceStream = await getMyStreamingService(otherInputs);
      for await (const data of serviceStream) {
        const chunk: ChunkPayload = { type: "text_chunk", content: data };
        yield chunk; // yield 数据块
      }
      return; // 流式模式下返回 void
    } else {
      // --- 批处理逻辑 ---
      const result = await getMyBatchService(otherInputs);
      // return 一个对象，key 对应批处理输出槽的名称
      return {
        output_text: result.fullText,
        output_data: result.fullObject,
      };
    }
  }
}
```
