# 后端开发规范

## 1. 节点系统设计规范

### 1.1 节点定义
- 使用声明式对象 (`NodeDefinition` 接口，来自 `@comfytavern/types`) 定义节点，而不是类。
- 节点定义需包含完整的类型信息 (输入、输出、配置等)。
- 使用 TypeScript 接口进行类型定义。

```typescript
// ✅ 推荐的方式 (符合 @comfytavern/types)
import type { NodeDefinition, NodeExecutionContext } from '@comfytavern/types';

export const ExampleNode: NodeDefinition = {
  type: 'Example',
  category: 'Utils',
  displayName: '示例节点',
  description: '这是一个示例节点',

  inputs: {
    // 输入定义 (InputDefinition)
  },
  outputs: {
    // 输出定义 (OutputDefinition)
  },

  // 直接在定义中包含 execute 函数
  execute: async (inputs: Record<string, any>, context: NodeExecutionContext): Promise<Record<string, any>> => {
    // 执行逻辑
    return { /* outputs */ };
  }
}

// ❌ 避免使用类来定义节点结构
// export class ExampleNode extends BaseNode { ... }
```

### 1.2 执行逻辑 (`execute` 函数)
- `execute` 函数应尽可能设计为**无副作用的纯函数**，或者其副作用应易于管理。
- **避免在 `execute` 函数内部维护可变的状态**。如果节点需要状态（如计数器、随机种子），应通过外部机制管理，并通过 `context` 参数访问（见 3.1）。
- 可以将复杂逻辑抽离到单独的辅助函数或模块中，以保持 `NodeDefinition` 的简洁性。
- 统一的错误处理方式（见 1.3）。

```typescript
// ✅ 推荐的方式：无状态或通过 context 管理状态
async function execute(inputs: Record<string, any>, context: NodeExecutionContext): Promise<Record<string, any>> {
  const nodeId = context.nodeId; // 使用 context 获取节点 ID
  // const nodeState = getStateForNode(nodeId); // 从外部获取/更新状态
  try {
    // 执行逻辑
    const result = performCalculation(inputs);
    // updateStateForNode(nodeId, newState); // 更新外部状态
    return { outputValue: result };
  } catch (error) {
    console.error(`Error in node ${nodeId}:`, error);
    // 可以选择返回错误对象 (见 1.3)
    return { error: `执行失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// ❌ 避免在 execute 内部直接修改实例状态 (因为我们不使用类)
// let internalCounter = 0; // 避免模块级可变状态被多个执行共享
// async function execute(...) { internalCounter++; ... }
```

### 1.3 错误处理
- **推荐**: 在 `execute` 函数内部捕获预期的错误，并返回一个包含 `error` 字段的对象。这允许更细粒度的控制流。
- **备选**: `execute` 函数也可以直接抛出异常。`ExecutionEngine` 会捕获这些异常，并将节点状态标记为 `ERROR`，记录错误信息。
- 无论哪种方式，都应提供清晰、有意义的错误消息。

```typescript
// ✅ 推荐的方式：返回错误对象
async function execute(...) {
  try {
    // ... 可能出错的操作
  } catch (error) {
    return {
      error: `处理图像失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

// △ 可接受的方式：抛出异常 (会被 ExecutionEngine 捕获)
async function execute(...) {
  if (/* 严重错误条件 */) {
    throw new Error('无法连接到必要的服务');
  }
  // ...
}
```

## 2. 类型系统使用

### 2.1 接口定义
- 优先使用接口 (`interface`) 而非类型别名 (`type`) 来定义对象结构，除非需要联合类型、交叉类型等 `type` 的特性。
- 为所有关键数据结构（如节点定义、输入/输出、配置、上下文、API Payload）定义清晰的接口。
- 使用精确的类型而非 `any`。利用 TypeScript 的类型推断和检查。

```typescript
// ✅ 推荐的方式
import type { InputDefinition, InputType, InputConfig } from '@comfytavern/types';

interface MyCustomInputConfig extends InputConfig {
  specificOption: boolean;
}

interface MyNodeInput extends InputDefinition {
  type: InputType; // 使用导入的精确类型
  config?: MyCustomInputConfig; // 使用扩展的配置接口
}

// ❌ 避免使用 any
// type NodeInput = any;
```

### 2.2 常量枚举
- 使用 `const` 断言的对象 (`as const`) 来创建字符串或数值常量集合，以替代 TypeScript 的 `enum`。这提供了更好的 Tree-shaking 和类型安全。
- 可以从 `const` 对象派生出联合类型。

```typescript
// ✅ 推荐的方式
export const NodeCategory = {
  LLM: 'LLM', // 使用更易读的大写或特定命名
  UTILS: 'Utilities',
  CONTROL: 'Flow Control',
  GROUP: 'Group' // 添加分组类型
} as const;

// 派生出类型
export type NodeCategory = typeof NodeCategory[keyof typeof NodeCategory];

// 使用示例
const category: NodeCategory = NodeCategory.LLM;

// ❌ 避免使用 TypeScript 的 enum
// enum NodeCategory { LLM = 'llm', ... }
```

## 3. 状态管理

### 3.1 避免节点执行中的共享状态
- **核心原则**: 单次 `execute` 调用应该是相对隔离和可预测的。
- **节点内部状态**: 如果节点逻辑需要跨次执行保持状态（如 `RandomNumberNode` 的当前值），该状态应存储在**节点执行上下文之外**（例如，由 `ExecutionEngine` 或专门的状态服务管理），并通过传递给 `execute` 的 `context` 对象（包含 `nodeId` 等标识符）来访问和更新。
- **输入/输出**: 节点的状态变化应主要通过其输出反映，传递给下游节点。
- **不可变性**: 处理输入数据（尤其是对象和数组）时，尽量使用不可变操作（如扩展运算符 `...`、`map`, `filter` 等）创建新对象/数组，而不是直接修改传入的引用。

```typescript
// ✅ 推荐的方式：通过 context 访问外部管理的 node-specific 状态
async function execute(inputs: { history: Message[] }, context: NodeExecutionContext): Promise<{ updatedHistory: Message[] }> {
  const nodeId = context.nodeId;
  // const previousState = await context.getNodeState(nodeId); // 假设 context 提供状态访问
  const newMessage = createNewMessage(inputs);
  const updatedHistory = [...inputs.history, newMessage]; // 使用扩展运算符创建新数组
  // await context.setNodeState(nodeId, newState); // 更新外部状态
  return { updatedHistory };
}

// ❌ 避免在 execute 函数作用域内或模块级维护可变状态用于跨执行共享
// let sharedHistory = []; function execute(...) { sharedHistory.push(...); }
```

### 3.2 配置管理
- 使用环境变量 (`process.env`) 或配置文件（如 `config.json`）来管理敏感信息（API Keys）和环境特定设置（基础 URL、端口）。
- 提供配置加载、验证和类型检查机制。
- 为配置项提供合理的默认值。

```typescript
// ✅ 推荐的方式
interface APIConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
}

function loadAndValidateConfig(env: NodeJS.ProcessEnv): APIConfig {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OPENAI_API_KEY environment variable not set.');
  }
  return {
    baseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    apiKey: apiKey ?? '', // 提供空字符串作为默认值或根据需要抛出错误
    timeout: parseInt(env.API_TIMEOUT ?? '30000', 10) // 提供默认超时并解析
  };
}

const config = loadAndValidateConfig(process.env);
```

## 4. 性能优化

### 4.1 异步处理
- 大量使用 `async/await` 来处理 I/O 密集型操作（如 LLM 调用、文件读写）。
- 避免在 `execute` 函数中执行长时间同步阻塞操作。
- 对可能耗时过长的外部调用（如 API 请求）实现合理的超时处理 (`Promise.race` 或库提供的超时选项)。

```typescript
// ✅ 推荐的方式：使用 Promise.race 实现超时
async function executeWithTimeout(operationPromise: Promise<any>, timeoutMs: number): Promise<any> {
  let timeoutHandle: NodeJS.Timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([operationPromise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle!); // 清理定时器
  }
}
```

### 4.2 资源管理
- 对于需要管理连接或资源的节点（如数据库连接、文件句柄），确保在使用后正确释放。
- 使用 `try...finally` 块确保即使在发生错误时也能执行清理逻辑。
- 考虑为昂贵的资源（如 LLM 客户端实例）实现简单的缓存或共享机制（如果适用且线程安全）。

## 5. 测试规范

### 5.1 单元测试
- 重点测试单个节点的 `execute` 函数的逻辑。
- 覆盖不同的输入组合、边界条件和预期的输出。
- **模拟 (Mock)** 外部依赖（如 LLM API 调用、文件系统访问）以隔离测试单元。
- 测试错误处理逻辑（节点如何处理无效输入或模拟的外部错误）。

```typescript
// ✅ 推荐的测试方式 (使用 Vitest 或 Jest)
import { describe, it, expect, vi } from 'vitest';
import { MyNode } from './MyNode'; // 导入节点定义
import * as LlmApi from '../services/llmApi'; // 假设这是外部依赖

// 模拟外部 API
vi.mock('../services/llmApi');

describe('MyNode execution logic', () => {
  it('should process input correctly under normal conditions', async () => {
    const mockLlmCall = vi.spyOn(LlmApi, 'call').mockResolvedValue('Mocked LLM Response');
    const inputs = { text: 'input text' };
    const context = { nodeId: 'test-node-1' }; // 提供模拟上下文

    const result = await MyNode.execute(inputs, context);

    expect(mockLlmCall).toHaveBeenCalledWith('input text');
    expect(result).toEqual({ processedText: 'Mocked LLM Response' });
    expect(result.error).toBeUndefined();
  });

  it('should return an error object when LLM call fails', async () => {
    const mockLlmCall = vi.spyOn(LlmApi, 'call').mockRejectedValue(new Error('API Error'));
    const inputs = { text: 'input text' };
    const context = { nodeId: 'test-node-2' };

    const result = await MyNode.execute(inputs, context);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('API Error');
  });
});
```

### 5.2 集成测试
- 测试节点之间的交互和数据流转。
- 构建小型、有代表性的工作流图谱，通过 `ExecutionEngine` 执行，并验证最终输出。
- 测试包含不同类型节点（工具、LLM、流程控制）的组合。
- （可选）进行简单的性能基准测试。

## 6. 文档规范

### 6.1 代码注释
- 为 `NodeDefinition` 对象本身添加 JSDoc 注释，说明节点的用途、分类等。
- 为 `execute` 函数添加 JSDoc 注释，详细说明其参数 (`inputs`, `context`)、返回值（包括可能的 `error` 属性）和主要逻辑。
- 对复杂的内部逻辑或算法添加行内注释。

```typescript
/**
 * @description Processes user input using an LLM and updates conversation history.
 * @category LLM
 * @displayName Chat Processor
 */
export const ChatProcessorNode: NodeDefinition = {
  type: 'ChatProcessor',
  category: NodeCategory.LLM, // 使用定义的常量
  displayName: '聊天处理器',
  description: '调用LLM处理用户输入并管理对话历史',
  inputs: { /* ... */ },
  outputs: { /* ... */ },

  /**
   * Executes the chat processing logic.
   * @param inputs Contains 'userInput' (string) and 'history' (Message[]).
   * @param context Provides execution context like nodeId.
   * @returns An object containing 'llmResponse' (string) and 'updatedHistory' (Message[]), or an 'error' property if failed.
   */
  execute: async (inputs, context) => {
    // ... 实现 ...
  }
};
```

### 6.2 API 文档 (面向前端或其他服务)
- 维护清晰的 WebSocket 消息协议文档，说明每种消息类型、方向和数据结构。
- 维护 HTTP API 端点文档（可以使用 Swagger/OpenAPI 自动生成）。
- 提供所有可用节点的列表及其详细定义（输入/输出/配置/描述），可以通过 API 端点 (`GET /api/nodes`) 提供。

## 7. 开发工具配置

### 7.1 ESLint & Prettier
- 配置 ESLint 强制执行代码风格、最佳实践和潜在错误检查（如 `@typescript-eslint` 规则）。
- 配置 Prettier 自动格式化代码，确保风格统一。
- 集成到 Git Hooks (如 husky + lint-staged) 中，在提交前自动检查和格式化。

### 7.2 编辑器配置
- 使用 `.editorconfig` 文件统一基本编辑设置（缩进、换行符等）。
- 配置 VS Code 等编辑器以使用项目中的 TypeScript 版本和 ESLint/Prettier 配置。
- （可选）添加推荐的 VS Code 扩展（如 ESLint, Prettier）。

## 8. 节点导入与组织规范

### 8.1 自动加载 (推荐机制)
- `NodeManager` 应支持从指定目录（如 `apps/backend/src/nodes/definitions/`）递归加载所有 `.ts` 文件中导出的 `NodeDefinition` 对象。
- 加载器应忽略非节点定义文件（如 `index.ts`, `types.ts` 等）。
- 考虑在开发模式下实现热重载，以便在添加或修改节点定义后无需重启后端服务。

### 8.2 目录结构
- 将节点定义文件按类别或功能组织在 `definitions/` 子目录下。
- 每个节点定义通常放在自己的文件中（如 `RandomNumberNode.ts`）。
- 可以使用子目录的 `index.ts` 来重新导出该目录下的所有节点定义，但这对于自动加载机制来说通常不是必需的。

```
apps/backend/src/nodes/
  ├── NodeManager.ts      # 节点管理器实现
  ├── definitions/        # 存放所有节点定义文件
  │   ├── llm/            # LLM 相关节点目录
  │   │   ├── ChatNode.ts
  │   │   └── CompletionNode.ts
  │   ├── utils/          # 工具节点目录
  │   │   ├── MergeNode.ts
  │   │   └── TextTemplateNode.ts
  │   ├── GroupInputNode.ts # 根目录下的节点
  │   └── GroupOutputNode.ts
  └── index.ts            # (可选) 导出 NodeManager 或相关类型
```

### 8.3 避免循环依赖
- 设计节点和模块时，注意避免 TypeScript 模块间的循环导入依赖，这可能导致运行时错误或 `undefined` 值。
- 如果遇到循环依赖，尝试重构代码，例如将共享的类型或函数提取到独立的模块中。
