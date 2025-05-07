# 后端架构与开发计划 (基于 VueFlow 前端)

## 1. 整体架构

反映当前采用 `ExecutionEngine` 处理工作流的模式。

```mermaid
graph TB
    subgraph Frontend (VueFlow)
        direction LR
        UI[用户界面]
        WebSocketClient[WebSocket 客户端]
        HTTPClient[HTTP 客户端]
    end

    subgraph Backend (Bun + Elysia)
        direction LR
        Server[Elysia 服务器]
        NodeMgr[节点管理器]
        ExecEngine[执行引擎]
        LLMMgr[(LLM 管理器)]
        Persistence[(持久化层)]

        Server -- HTTP/WS --> NodeMgr[获取节点定义]
        Server -- WS --> ExecEngine[执行工作流请求]
        ExecEngine --> NodeMgr[获取节点执行逻辑]
        ExecEngine --> LLMMgr[调用LLM服务]
        ExecEngine --> Persistence[读/写状态]
        Server -- HTTP --> Persistence[保存/加载工作流]
    end

    UI -- 操作 --> HTTPClient
    UI -- 操作 --> WebSocketClient

    HTTPClient -- HTTP (REST API) --> Server[如: 保存/加载工作流, 获取节点列表]
    WebSocketClient -- WebSocket --> Server[如: 执行工作流, 实时状态更新, 按钮点击]

    Server -- WebSocket --> WebSocketClient[发送执行状态/结果]

```

*   **核心变化**: 引入 `ExecutionEngine` 作为工作流执行的核心，取代了旧计划中简单的单节点任务队列。明确了 HTTP 和 WebSocket 的职责。添加了（待实现的）持久化层和 LLM 管理器。

## 2. 技术栈

基本保持不变，但更明确各组件用途。

*   **运行时**: Bun
*   **Web框架**: Elysia (处理 HTTP API 和 WebSocket 连接)
*   **WebSocket**: Elysia 内置 WebSocket 支持 (`@elysiajs/ws` 已集成)
*   **类型系统**: TypeScript
*   **核心执行**: 自定义 `ExecutionEngine` (基于拓扑排序)
*   **节点管理**: 自定义 `NodeManager`
*   **LLM集成**: (待实现) 通过专用管理器对接 OpenAI, Claude 等 API
*   **持久化**: (待实现) 文件系统 (JSON) 或数据库
*   **构建/包管理**: Bun

## 3. 服务结构 (建议)

根据现有组件调整。

```
apps/backend/
├── src/
│   ├── index.ts         # 服务器入口与配置
│   ├── api/             # API 路由与 WebSocket 处理
│   │   ├── http.ts      # HTTP 路由 (工作流保存/加载, 节点列表等)
│   │   └── ws.ts        # WebSocket 消息处理 (执行请求, 状态广播等)
│   ├── nodes/           # 节点实现与管理
│   │   ├── index.ts     # 导出所有节点定义
│   │   ├── NodeManager.ts # 节点管理器
│   │   ├── definitions/ # 各个节点的具体定义 (如 RandomNumberNode.ts)
│   │   └── ...          # 其他节点定义文件
│   ├── core/            # 核心功能模块
│   │   ├── ExecutionEngine.ts # 工作流执行引擎
│   │   ├── types.ts       # 后端核心类型 (可考虑与 packages/types 复用或关联)
│   │   └── ...          # (未来可能加入 LLMManager, PersistenceService 等)
│   ├── utils/           # 通用工具函数
│   └── ...
└── tsconfig.json        # TypeScript 配置
```

*   **调整**: 将 `ExecutionEngine` 放入 `core/`。节点实现放在 `nodes/definitions/` 下，`NodeManager` 在 `nodes/` 根目录。明确 `api/` 下 HTTP 和 WS 的职责。

## 4. 核心功能实现 (当前与目标)

### 4.1 服务器设置 (Elysia)

基本同旧计划，使用 Elysia 实例，集成 WebSocket，并注册核心服务实例（如 `NodeManager`, `ExecutionEngine`）。

```typescript
// src/index.ts (示例)
import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
// import { ws } from '@elysiajs/ws' // Elysia 0.3+ 已内置
import { NodeManager } from './nodes/NodeManager'
import { ExecutionEngine } from './core/ExecutionEngine'
import { setupHttpRoutes } from './api/http'
import { setupWebSocket } from './api/ws'
// import { LLMManager } from './core/LLMManager' // 未来
// import { PersistenceService } from './core/PersistenceService' // 未来

const nodeManager = new NodeManager()
// 加载所有节点定义
// await nodeManager.loadNodesFromDirectory('./src/nodes/definitions'); // 假设有此方法

const executionEngine = new ExecutionEngine(nodeManager) // 注入依赖
// const llmManager = new LLMManager() // 未来
// const persistenceService = new PersistenceService() // 未来

const app = new Elysia()
  .use(cors())
  // .use(ws()) // 0.3+ 不需要显式 use(ws())
  .decorate('nodeManager', nodeManager)
  .decorate('executionEngine', executionEngine)
  // .decorate('llmManager', llmManager) // 未来
  // .decorate('persistenceService', persistenceService) // 未来
  .group('/api', (group) => setupHttpRoutes(group)) // 设置 HTTP 路由
  .ws('/ws', (ws) => setupWebSocket(ws)) // 设置 WebSocket 处理器
  .listen(3233)

console.log(`Backend running at http://${app.server?.hostname}:${app.server?.port}`)
```

### 4.2 节点系统

基于 `NodeDefinition` 对象，而非 `BaseNode` 类。

1.  **节点定义 (`NodeDefinition`)** (来自 `@comfytavern/types`)
    ```typescript
    // packages/types/src/node.ts (回顾)
    export interface NodeDefinition {
      type: string;
      category: string;
      displayName: string;
      description?: string;
      inputs: Record<string, InputDefinition>;
      outputs: Record<string, OutputDefinition>;
      execute: (inputs: Record<string, any>, context: NodeExecutionContext) => Promise<Record<string, any>>;
      // 可能还有其他元数据...
    }
    // InputDefinition, OutputDefinition, NodeExecutionContext 也是关键类型
    ```

2.  **节点管理器 (`NodeManager`)**
    *   职责：加载、注册、存储和提供 `NodeDefinition` 对象。
    *   实现：维护一个 `Map<string, NodeDefinition>`。提供 `registerNode`, `getDefinition(type)`, `getAllDefinitions()` 等方法。

3.  **节点实现示例 (`RandomNumberNode.ts`)**
    *   导出一个符合 `NodeDefinition` 接口的对象。
    *   实现 `execute` 方法，处理输入、执行逻辑、返回输出。

### 4.3 执行引擎 (`ExecutionEngine`)

*   **核心职责**: 接收工作流图谱 (`WorkflowExecutionPayload`)，执行拓扑排序，按顺序调用节点 `execute` 方法，管理节点状态和结果，处理依赖和输入准备，支持跳过节点，处理错误。
*   **输入准备**: 实现 `prepareNodeInputs` 逻辑，处理连接值、节点数据值、默认值，支持多对一输入。
*   **状态更新**: 通过回调函数 (`onStatusUpdate`) 向调用者（通常是 WebSocket 处理器）发送节点和工作流的实时状态 (`RUNNING`, `COMPLETED`, `ERROR`, `SKIPPED`)。
*   **上下文 (`context`)**: `executeNode` 时传递 `context` 对象给节点，可包含 `nodeId` 等信息，未来可扩展用于按钮点击等交互。

### 4.4 WebSocket 通信 (`api/ws.ts`)

*   **主要消息类型**:
    *   **Client -> Server**:
        *   `execute_workflow`: 客户端发送包含节点和边的工作流 payload 请求执行。
        *   `button_click`: (待实现) 客户端发送按钮点击事件，包含 `nodeId` 和 `inputKey`。
        *   (其他可能的交互事件)
    *   **Server -> Client**:
        *   `workflow_status_update`: 发送整个工作流的状态（开始、完成、错误）。
        *   `node_status_update`: 发送单个节点的状态和结果（开始、完成、错误、跳过）。
        *   `button_click_ack`: (待实现) 确认按钮点击已处理。
        *   (其他需要广播或响应的消息)
*   **处理逻辑**:
    *   收到 `execute_workflow` 时，调用 `executionEngine.executeWorkflow`，并将 WebSocket 的 `send` 方法包装成 `onStatusUpdate` 回调传递进去，以便实时反馈状态。
    *   收到 `button_click` 时，需要找到对应的 `ExecutionEngine` 实例（如果支持并发执行多个工作流）或直接调用相关节点的 `execute` 方法，并提供包含触发信息的 `context`。

### 4.5 HTTP API (`api/http.ts`)

*   **主要路由**:
    *   `GET /api/nodes`: 返回所有可用节点的定义列表 (`nodeManager.getAllDefinitions()`)。
    *   `POST /api/workflows`: 保存工作流 JSON 文件。
    *   `GET /api/workflows`: 列出已保存的工作流。
    *   `GET /api/workflows/:name`: 加载指定名称的工作流 JSON。
    *   `DELETE /api/workflows/:name`: 删除工作流。
    *   (其他可能的管理 API)

## 5. 实施计划 (修订)

假设基础服务器和 `ExecutionEngine` 的核心（拓扑排序、顺序执行）已初步实现。

### 5.1 第一阶段：完善核心与基础节点 (当前 -> 1周)

1.  **稳定 `ExecutionEngine`**:
    *   完善错误处理和状态报告。
    *   确保输入准备逻辑 (`prepareNodeInputs`) 健壮。
    *   实现节点跳过 (`bypassed`) 功能。
2.  **完善 `NodeManager`**:
    *   实现从目录动态加载节点定义。
    *   提供清晰的注册和获取接口。
3.  **WebSocket 通信**:
    *   实现完整的 `execute_workflow` 请求处理和 `node/workflow_status_update` 状态反馈。
    *   确保前后端状态同步基础可用。
4.  **HTTP API**:
    *   实现节点列表获取 (`GET /api/nodes`)。
    *   实现工作流保存/加载 (`POST /api/workflows`, `GET /api/workflows/:name`)。
5.  **基础节点**:
    *   确保 `GroupInput`, `GroupOutput` 正常工作。
    *   完善 `TestWidgetsNode` 以覆盖所有输入类型。
    *   修复 `RandomNumberNode` 的按钮点击后端处理逻辑（WebSocket 部分）。

### 5.2 第二阶段：核心功能节点与交互 (2周)

1.  **LLM 集成**:
    *   设计并实现 `LLMManager`。
    *   实现基础的 OpenAI/Claude 调用节点 (如 `SimpleCompletionNode`, `ChatNode`)。
    *   处理 API Key 管理。
2.  **交互功能**:
    *   完全实现按钮 (`BUTTON`) 类型输入的后端 WebSocket 处理和 `execute` 触发。
    *   考虑其他可能的交互式节点。
3.  **状态持久化 (初步)**:
    *   实现将 `RandomNumberNode` 等有状态节点的内部状态与工作流一起保存和加载。
4.  **核心工具节点**:
    *   文本处理 (模板、拼接、分割)。
    *   数据转换 (JSON 操作、类型转换)。
    *   简单的流程控制 (如果需要，如条件分支)。

### 5.3 第三阶段：优化、健壮性与测试 (2周)

1.  **并行执行策略研究与实现**:
    *   根据我们之前的讨论，选择并实施一种并行策略（很可能是基于连通分量的引擎实例并行）。
    *   建立相应的并行基础设施（进程/Worker管理、任务分发）。
2.  **错误处理与恢复**:
    *   更细致的错误分类和报告。
    *   考虑简单的错误重试或恢复机制。
3.  **测试**:
    *   为核心模块 (`ExecutionEngine`, `NodeManager`) 编写单元测试。
    *   为关键节点编写测试。
    *   进行集成测试（前后端交互、工作流执行）。
4.  **文档**:
    *   完善后端 API 文档。
    *   更新此计划文档。

## 6. 后续优化方向

基本与旧计划一致，但侧重点根据新架构调整。

1.  **性能与可伸缩性**: 深入优化并行执行效率，任务调度，内存管理，考虑使用更专业的任务队列（如 BullMQ）如果需要管理大量并发工作流请求。
2.  **功能扩展**: 更多 LLM 支持，高级节点（图像处理？代码执行？），节点版本控制，工作流版本控制。
3.  **系统稳定性**: 状态持久化方案（数据库？），监控告警，日志系统。
4.  **开发体验**: 更好的调试工具，热重载，类型系统增强。

这个修订后的计划应该更贴近当前项目的实际情况和发展方向。