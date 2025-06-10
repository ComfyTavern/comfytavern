# 全局 Tokenization 服务设计方案 (V1)

## 1. 目标

设计并实现一个独立的、全局可用的 `TokenizationService`，为 ComfyTavern 的所有组件提供统一、高效、可扩展的 `token` 计算能力。该服务旨在解耦 `token` 计算逻辑，使其成为一个可被任何部分（包括后端服务、工作流节点、前端 UI 等）复用的核心基础设施。

核心目标：

- **中心化与可复用**: 提供一个单一的服务来处理所有 `token` 计算需求。
- **多模型支持**: 支持来自不同厂商和社区的多种分词器模型 (Tokenizer)，特别是通过 Hugging Face Hub 上的模型。
- **性能高效**: 通过缓存机制减少重复加载分词器模型的开销。
- **接口简洁**: 提供简单明了的 API，方便计算文本或标准消息结构的 `token` 数量。
- **请求预验证**: 在将请求发送到 LLM API 之前，能够判断是否超出模型的上下文窗口限制。
- **成本估算**: 为成本控制和预算管理提供基础数据。
- **数据填充**: 为不返回 `usage` 信息的 API 响应补充 `token` 数量。
- **离线支持与可靠性**: 内置常用分词器模型到发行版中，确保在无法访问 Hugging Face Hub 的情况下，核心功能依然可用。

## 2. 核心组件与技术选型

### 2.1. 技术选型

- **核心库**: **`@xenova/transformers` (Transformers.js)**
  - **理由与主流模型支持分析**:
    - **统一性与可扩展性**: `Transformers.js` 提供了统一的 `AutoTokenizer.from_pretrained()` API 来加载和使用所有不同的分词器。这使我们无需为每个厂商（如 OpenAI, Anthropic, Google）分别引入和维护一个专用的 `tokenizer` 库（如 `tiktoken`, `sentencepiece` 等），极大地简化了 `TokenizationService` 的内部实现和依赖管理。当未来出现新的主流模型时，只要其分词器被社区接纳并上传到 Hugging Face Hub，我们就能以极低的成本快速支持。
    - **对核心模型的具体支持**:
      - **OpenAI (GPT 系列)**: 支持加载与官方 `tiktoken` 兼容的 BPE 分词器。
      - **Anthropic (Claude 系列)**: 支持加载社区提供的 Claude 分词器。
      - **Google (Gemini 系列)**: 支持加载其使用的 `SentencePiece` 分词器。
      - **国内主流模型 (如 DeepSeek, Qwen, Doubao)**: 这些模型的分词器同样在 Hugging Face Hub 上有相应的实现或兼容版本可供加载。
    - **环境支持**: `Transformers.js` 可在 Node.js (Bun) 和浏览器环境中运行，这使得我们的 `TokenizationService` 能够成为一个真正的通用工具，无缝地在后端 (Bun) 和前端（浏览器）环境中运行，无需任何代码转换。
    - **社区与维护**: 作为 Hugging Face 的官方 JS 库，其质量、维护性和社区支持都有可靠保障。

### 2.2. 包结构 (Package Structure)

为了最大化其可复用性并明确其通用工具的定位，`TokenizationService` 将被实现为一个独立的、有作用域的 npm 包，例如：

- **`@comfytavern/tokenization`**

该包将被 `apps/backend` 和 `apps/frontend-vueflow` 同时作为依赖项引入。这种结构从根本上保证了代码的单一来源和跨环境的一致性。

### 2.3. 核心组件

- **`TokenizationService` (`ITokenizationService`)**:
  - 对外暴露的核心服务，实现了 `ITokenizationService` 接口。
  - 负责接收 `token` 计算请求，协调其他内部组件完成任务。

- **`TokenizerCache`**:
  - 一个内部缓存管理器，用于存储已加载和初始化的分词器实例 (`PreTrainedTokenizer`)。
  - **键 (Key)**: 分词器标识符 (e.g., "gpt2", "Xenova/bert-base-chinese")。
  - **值 (Value)**: `Promise<PreTrainedTokenizer>`，确保并发请求同一个分词器时，只进行一次加载。
  - 可实现简单的内存缓存（In-Memory Cache）或更复杂的 LRU (Least Recently Used) 策略。

- **`TokenizerLoader`**:
  - 负责与 `Transformers.js` 库交互，根据给定的分词器标识符异步加载分词器模型和配置。

### 2.3. 模型打包与离线支持 (Model Bundling & Offline Support)

为了保证在离线或网络不佳的环境下服务的可靠性，系统将支持把常用的分词器模型打包到最终的发行版中。

- **打包策略**: 在构建应用时，一个脚本会自动从 Hugging Face Hub 下载一组预定义的核心分词器（如 GPT, Claude, Llama 系列），并将其存放在发行版的特定目录中（例如 `dist/models/tokenizers`）。
- **加载机制**: `TokenizerLoader` 将采用“本地优先”的策略。它会首先检查请求的分词器是否存在于本地打包目录中。如果存在，则直接从本地加载；如果不存在，则回退到从 Hugging Face Hub 在线下载。

## 3. 服务接口定义 (`ITokenizationService`)

```typescript
import { CustomMessage } from "@comfytavern/types";

/**
 * 全局 Tokenization 服务接口
 */
export interface ITokenizationService {
  /**
   * 根据分词器标识符计算给定消息列表的 token 数量。
   * 该方法会处理消息的角色和内容（包括多模态部分），并根据特定分词器的模板格式化后进行计算。
   * @param tokenizerId 用于加载分词器的标识符 (e.g., "gpt-4o", "Xenova/claude-3-haiku-20240307")。
   * @param messages 要计算的 CustomMessage 数组。
   * @returns 返回包含 token 数量的对象。
   * @throws 如果分词器加载失败或输入无效，则抛出错误。
   */
  calculateTokens(
    tokenizerId: string,
    messages: CustomMessage[]
  ): Promise<{ count: number }>;

  /**
   * 根据分词器标识符计算给定文本字符串的 token 数量。
   * @param tokenizerId 用于加载分词器的标识符。
   * @param text 要计算的字符串。
   * @returns 返回包含 token 数量的对象。
   * @throws 如果分词器加载失败，则抛出错误。
   */
  calculateTokensForText(
    tokenizerId: string,
    text: string
  ): Promise<{ count: number }>;
}
```

## 4. 工作流程

1.  **服务请求**: 外部组件（如 `ModelRouterService`）调用 `TokenizationService.calculateTokens("gpt-4o", messages)`。
2.  **缓存检查**: `TokenizationService` 向 `TokenizerCache` 查询 "gpt-4o" 对应的分词器实例。
3.  **缓存命中/未命中**:
    - **命中**: `TokenizerCache` 直接返回缓存的 `Promise<PreTrainedTokenizer>`。
    - **未命中**:
      - `TokenizationService` 调用 `TokenizerLoader` 开始加载分词器。
      - `TokenizerLoader` 采用“本地优先”策略：
        - **检查本地**: 尝试从预打包的目录 (例如 `dist/models/tokenizers/gpt-4o`) 加载模型。
        - **本地加载成功**: 加载操作的 `Promise` 被存入 `TokenizerCache` 并返回。
        - **本地加载失败**: 回退到在线模式，使用 `Transformers.js` 的 `AutoTokenizer.from_pretrained("gpt-4o")` 方法从 Hugging Face Hub 下载。
      - 加载操作的 `Promise` 被存入 `TokenizerCache` 并返回。
4.  **获取分词器**: `TokenizationService` `await` 返回的 `Promise`，获得分词器实例。
5.  **执行计算**:
    - `calculateTokens`: 服务可能需要一个内部的 `MessageFormatter`，根据分词器类型将 `CustomMessage[]` 转换为特定格式的字符串（例如，OpenAI 的聊天模板），然后再调用分词器的 `encode` 方法。
    - `calculateTokensForText`: 直接调用分词器的 `encode(text)` 方法。
6.  **返回结果**: 返回计算出的 `token` 数量。

## 5. 集成点

`TokenizationService` 将作为核心工具，被各模块直接导入和使用：

- **`ModelRouterService` / `ExecutionEngine`**:
  - 在执行 LLM 请求前，调用此服务进行 `token` 预估。
  - 用于**上下文窗口验证**和**成本估算**。
- **`LLM API Adapters`**:
  - 当调用的 API 不返回 `usage` 信息时，可使用此服务**填充 `StandardResponse.usage` 字段**。
- **前端 UI**:
  - 在用户与输入框交互时（例如，在节点配置中输入提示词），可直接调用此服务，**实时计算并显示 `token` 数量**，提供即时反馈和更好的交互体验。
- **数据分析与监控**:
  - 记录 `token` 使用情况，用于分析和监控平台资源消耗。

## 6. 开发计划

### Phase 1: 核心功能实现

- **目标**: 实现一个功能完备的 `TokenizationService` MVP。
- **任务**:
  1.  **创建独立的包**: 初始化 `@comfytavern/tokenization` 包结构。
  2.  **实现接口与核心逻辑**:
      - 实现 `ITokenizationService` 接口。
      - 集成 `@xenova/transformers` 库。
      - 实现基于内存的 `TokenizerCache`。
      - 实现 `TokenizerLoader`，支持从 Hugging Face Hub 加载分词器。
  3.  **实现计算方法**:
      - 为 `calculateTokensForText` 提供基础实现。
      - 为 `calculateTokens` 提供对 OpenAI 聊天模板的初步支持。
  4.  **测试**: 编写单元测试，覆盖常见分词器（如 GPT-2, BERT）。

### Phase 2: 增强与优化

- **目标**: 提升服务的健壮性和智能化。
- **任务**:
  1.  **高级缓存**: 实现 LRU 缓存策略，自动卸载不常用的分词器，控制内存占用。
  2.  **模板扩展**: 增加对更多模型聊天模板的支持（如 Llama, ChatML）。
  3.  **错误处理**: 细化错误处理逻辑，例如分词器加载失败、网络问题等。
  4.  **错误处理**: 细化错误处理逻辑，例如分词器加载失败、网络问题等。

### Phase 3: 打包与发行

- **目标**: 实现模型的本地化打包与离线加载能力，提升应用的可靠性。
- **任务**:
 1.  **确定核心分词器列表**: 根据调研和用户常用模型，确定需要内置的核心分词器。以下是经过验证的 `Transformers.js` 兼容标识符（主要由 `Xenova` 移植）：
     - **OpenAI (GPT-4o, GPT-4.1, etc.)**: `Xenova/gpt-4o`
     - **Anthropic (Claude 3, 4, etc.)**: `Xenova/claude-tokenizer`
     - **Google (Gemini 2.x, etc.)**: `Xenova/gemini-nano` (作为系列代表)
     - **DeepSeek (V2, R1, etc.)**: `Xenova/deepseek-coder-1.3b-instruct` (作为系列代表)
     - **Grok (Grok-1, 3, etc.)**: `Xenova/grok-1-tokenizer`
     - **Cohere (Command R, etc.)**: (待定，预计为 `Xenova/cohere-...`，开发时确认)
 2.  **创建打包脚本**: 编写脚本，集成到 `bun run build` 流程中，用于自动下载并整理上述分词器文件到发行目录。
 3.  **更新加载逻辑**: 修改 `TokenizerLoader` 以实现“本地优先，在线回退”的加载策略。
 4.  **添加相关配置**: 在全局配置中增加对本地模型路径和加载模式的设置。