# ComfyTavern Agent 架构规划 (草案)

## 1. 目标

设计并实现一个强大且灵活的架构，以便在 ComfyTavern 中构建 Agent。这些 Agent 应能进行动态决策、使用工具（封装为工作流或节点），并能基于反馈和观察进行迭代操作。Agent 的全部逻辑应尽可能在画布上可视化和配置。

## 1.1 核心概念区分：LLM 可调用工具 (Tool) vs. 工作流节点 (Node)

在深入 Agent 架构之前，必须明确区分两个核心概念：

*   **LLM 可调用工具 (Tool)**：
    *   这些是 LLM Agent 在其决策和行动循环中可以调用的外部能力、函数或服务。
    *   每个 Tool 具有明确的名称、功能描述以及输入参数的 Schema (例如 JSON Schema)。LLM 根据这些信息来决定何时以及如何调用它们。
    *   Tool 的实现主体通常是在后端代码中定义的函数、对外部 API 的封装，或对其他服务的调用。它们被注册到一个统一的“工具注册表 (Tool Registry)”中，供 Agent 发现和使用。
    *   LLM Agent 的工具使用机制旨在赋予 LLM 自主行动的能力，例如查询信息、执行操作、与其他系统交互等。

*   **工作流节点 (Node)**：
    *   这些是 ComfyTavern 画布上的基本图形化构建块。
    *   节点负责处理工作流内部的数据流转、逻辑控制、用户界面交互、以及对特定数据（如文本、图像）的原子操作或复杂处理。
    *   节点之间通过连线定义数据依赖和执行顺序，共同构成一个可视化的工作流。
    *   虽然一个工作流节点 *可以被设计为触发或实现一个 LLM Tool* (例如，一个复杂的子工作流可以被注册为一个 Tool)，但 Node 本身的主要职责是服务于工作流的内部逻辑和数据编排。

本架构的核心目标之一，就是清晰地分离这两种概念，让 LLM Agent 能够有效地使用外部注册的 Tools 来执行任务，同时利用工作流节点来灵活编排 Agent 的思考链、数据处理和与用户的交互流程。

## 2.核心 Agent 运作模式

Agent 基于一个涉及大型语言模型 (LLM) 进行决策和工具执行的循环进行运作：

1.  **感知/输入**：Agent 接收用户输入、对话历史以及先前工具执行的观察结果。
2.  **决策制定**：一个 LLM（在专用节点内）处理这些输入，并结合可用工具列表，来决定下一步行动：
    *   直接回应用户。
    *   选择一个或多个工具来执行。
3.  **行动/工具执行**：如果选择了工具，一个专用节点将执行该工具（通常是一个子工作流）。
4.  **观察与反馈**：工具执行的结果（或其摘要）将反馈给 Agent 的感知/输入机制，用于循环的下一次迭代。

需要强调的是，Agent 的具体行为模式（例如，是更偏向于无内部循环的“对话型 Agent”，还是利用 `LoopZoneNode` 进行复杂迭代的“自主任务型 Agent”，亦或是两者的混合）并非预设的固定分类，而是用户通过原子化地组合这些核心节点和机制，在画布上自由构建工作流的自然结果。`LoopZoneNode` 是实现复杂迭代和内部状态管理的强大工具，但并非所有 Agent 形态都必须强制使用它。例如，一个简单的问答或聊天 Agent，可能通过持久化存储聊天记录，并在每次用户交互时完整运行一次工作流（不含 `LoopZoneNode`）来更新状态和生成回应。

## 3. 关键节点类型

Agent 工作流将使用几种关键节点类型构建：

*   **`AvailableToolsNode` (可用 LLM 工具配置节点)**：
    *   **核心职责**：作为工作流与后端“工具注册表 (Tool Registry)”之间的接口。
    *   它负责从后端获取所有已注册的 **LLM Tools** 的列表。
    *   提供用户界面 (UI)，允许用户在当前工作流（或 Agent 配置）中选择或指定哪些已注册的 LLM Tools 对当前 Agent 可用。
    *   输出一个结构化的列表，其中包含所选 LLM Tools 的完整描述（名称、功能描述、输入参数 Schema），供给后续的 LLM 请求节点（如 `LlmApiRequestNode` 或包含它的 `LLMDecisionWithToolsNode` 组合模式）。
*   **`LLMDecisionWithToolsNode` (LLM决策与工具协调节点/节点组)**：
    *   **新定位**：此节点不再是单一的、直接执行 LLM 调用和决策解析的核心单元。它被重新定位为一个**推荐的组合模式、高级节点组或复合节点**，用于封装和协调一个典型的 Agent 决策与工具调用流程。
    *   **内部编排**：它通常会内部编排（或引导用户连接）以下原子化节点：
        1.  `AvailableToolsNode`：提供可用工具列表。
        2.  (可选) 上下文构建/提示词准备节点：用于整合用户查询、聊天记录、工具列表等信息，形成最终的 LLM 请求。
        3.  `LlmApiRequestNode` (或其演进)：负责实际的 LLM API 调用。
        4.  `ParseLlmDecisionNode`：负责解析 `LlmApiRequestNode` 的输出，分离文本回复和工具调用请求。
    *   **输入/输出**：其宏观输入可以视为用户查询、聊天记录等初始上下文；宏观输出则对应 `ParseLlmDecisionNode` 的输出，即 LLM 的文本回复和结构化的工具调用请求。
    *   **目标**：提供一个更高层次的抽象，简化用户搭建 Agent 决策核心的复杂度，同时保持底层逻辑的模块化和灵活性。它本身主要负责流程的协调，具体的 LLM 交互和解析由其内部包含或引用的原子节点完成。此协调节点（或其内部的 `ParseLlmDecisionNode`）应能发出执行轨迹事件，如“Agent思考中”、“已选择工具”等。
*   **`ParseLlmDecisionNode` (解析 LLM 决策节点)**：
    *   *(在 "3.1 LLM 工具集成方案" 中已详细定义，此处为简要回顾占位，确保节点列表完整性)*
    *   **核心职责**：接收来自 `LlmApiRequestNode` 的 `StandardResponse`，优先从文本中解析纯文本工具调用指令，并以结构化 `tool_calls` (若有)作为补充，并发输出 LLM 的完整文本内容和结构化的工具调用请求列表。
*   **`ExecuteToolNode` (LLM 工具执行器节点)**：
    *   **核心职责**：接收来自 **`ParseLlmDecisionNode`** 的一个或多个结构化“工具调用请求”（`ToolCallRequest`，包含要调用的 Tool 名称和具体参数）。
    *   根据请求中的 Tool 名称，通过一个通用的调度机制，在后端查找并执行对应的、已在“工具注册表 (Tool Registry)”中注册的 **LLM Tool**，并向其传递参数。
    *   它作为工作流与后端 LLM Tool 执行之间的桥梁。
    *   输出：被调用 LLM Tool 的执行结果（可以是流式或单个数据对象）和执行状态。**此节点应能发出执行轨迹事件，如“LLM 工具开始执行”、“LLM 工具输出片段”、“LLM 工具执行完毕（含结果摘要）”等。**
*   **数据处理与摘要节点**：
    *   一套实用节点（例如 `StreamToStringNode` (流转字符串节点)、`TextSummarizerNode` (文本摘要节点，可能由LLM驱动)、`JsonSelectorNode` (JSON选择器节点)、`FormatPromptNode` (格式化提示节点)），用户可以将它们串联起来处理 `ExecuteToolNode` 的原始输出，然后再反馈给 `LLMDecisionWithToolsNode` 或用户。
*   **`LoopZoneNode` (循环区域节点)**：
    *   **实现迭代式 Agent 循环的关键。**
    *   可视化为一个容器节点，包裹核心 Agent 逻辑（例如 `LLMDecisionWithToolsNode`、`ExecuteToolNode` 及相关的处理节点）。
    *   **特性**：
        *   **循环初始化输入**：从外部进入循环的数据。
        *   **循环最终输出**：循环结束后从外部流出的数据。
        *   **迭代状态变量 (循环携带依赖)**：在 LoopZone 边界定义的变量（例如聊天记录、累积的观察结果），每次迭代都会更新，并反馈到下一次迭代的开始。
        *   **循环控制参数**：例如迭代次数、条件终止、最大迭代次数。

### 3.1 LLM 工具集成方案 (已采纳核心方案)

根据深入讨论和对信息流的分析，我们明确采纳 **方案二：LLM 工具即插件 (外部注册与调用)** 作为 ComfyTavern Agent 工具集成的核心机制。此方案旨在清晰区分“LLM 可调用工具 (Tool)”（用于 Agent 自主行动和与外部世界交互）和“工作流节点 (Node)”（用于流程编排、数据处理和 Agent 内部逻辑构建）。

**核心组件与流程：**

1.  **后端工具注册表 (Tool Registry)**：
    *   所有供 LLM Agent 使用的“LLM 工具”都在后端进行统一注册和管理。
    *   每个注册的 Tool 必须提供标准化的元数据，包括：
        *   唯一的工具名称 (Tool Name)。
        *   清晰的功能描述 (Description)，供 LLM 理解其用途。
        *   详细的输入参数 Schema (例如 JSON Schema)，供 LLM 构建调用参数并由系统进行验证。
    *   Tool 的实现可以是多样的：简单的 Python 函数、对外部 API 的封装、数据库查询逻辑，甚至可以复杂到触发执行一个预定义的 ComfyTavern 工作流。

2.  **`AvailableToolsNode` (可用 LLM 工具配置节点)**：
    *   此工作流节点负责从后端的“工具注册表”中获取所有已注册的 LLM Tools。
    *   它提供用户界面 (UI)，允许用户在工作流级别选择或配置当前 Agent 实例具体可使用哪些已注册的 Tools。
    *   其输出是一个结构化的列表，包含所选 Tools 的完整描述 (名称、描述、参数 Schema)，供给后续的 LLM 请求节点。

3.  **LLM 工具调用格式与响应解析**：
    *   **LLM 工具调用格式**：
        *   **纯文本指令解析 (优先)**：LLM 的主要输出是自然语言文本。我们优先采用从 LLM 生成的文本中解析特定格式的指令（例如，使用 XML 标签如 `<tool_call name="tool_name"><param name="param_name">value</param></tool_call>` 或特定前缀+JSON对象）来识别工具调用意图。这种方式通用性强，不依赖特定模型的 API。需要制定详细的纯文本工具调用格式规范，并更新 LLM 提示词以引导其按规范输出。
        *   **Function Calling (FC) 作为补充/回退**：如果 LLM API 直接支持并返回了结构化的 Function Calling 信息 (例如 OpenAI API 的 `tool_calls` 字段)，系统也应能处理这些信息作为工具调用的来源。
    *   **LLM 响应的并发性**：LLM 的响应可以同时包含给用户的文本内容（如思考过程、阶段性回复）和工具调用指令/意图。解析逻辑需要能分离这两部分。

4.  **核心节点职责调整与新增**：
    *   **`LlmApiRequestNode` (或 `GenericLlmRequestNode` 的演进)**：
        *   **职责**：负责与 LLM API 进行底层交互，发送请求并接收原始响应。
        *   **输出 `StandardResponse` 扩展**：其输出的 `StandardResponse` 接口（或类似结构）中应**新增一个可选的 `tool_calls?: ToolCall[]` 字段**。此字段用于承载从 LLM API 直接获取的结构化 Function Calling 信息（如果 API 支持并返回）。`ToolCall` 结构应包含工具名称、参数等。
    *   **新增 `ParseLlmDecisionNode` (解析 LLM 决策节点)**：
        *   **职责**：接收来自 `LlmApiRequestNode` 的 `StandardResponse`，并从中解析出 LLM 的文本输出和工具调用请求。
        *   **输入**：`StandardResponse` 对象。
        *   **核心解析逻辑**：
            1.  **优先**从 `StandardResponse.text` 字段中，根据预定义的纯文本工具调用格式规范，解析工具调用指令。
            2.  如果纯文本解析未找到工具调用，或者作为补充，检查 `StandardResponse.tool_calls` 字段（如果存在且有内容），将其作为工具调用的来源。
        *   **输出**：**并发输出**以下两项：
            *   `llm_text_output: string`：LLM 的完整原始文本内容，可用于直接展示给用户、存入聊天记录或进行后续处理。
            *   `tool_call_requests?: ToolCallRequest[]`：一个可选的、包含一个或多个结构化工具调用请求的列表。每个 `ToolCallRequest` 应包含工具名称和参数，供 `ExecuteToolNode` 使用。如果未解析到工具调用，则此输出为空。
    *   **`LLMDecisionWithToolsNode` 的重新定位**：
        *   此节点不再直接负责 LLM API 调用或工具调用解析。
        *   它将被重新定位为一个**推荐的组合模式、节点组或高级复合节点**。
        *   其内部将编排一个典型的 Agent 决策流程，例如：`AvailableToolsNode` -> (可选的提示词准备/上下文组装节点) -> `LlmApiRequestNode` -> `ParseLlmDecisionNode`。
        *   它提供了一个更高层次的抽象，方便用户快速搭建 Agent 的决策核心，但底层的具体步骤由上述更原子化的节点完成。

5.  **`ExecuteToolNode` (LLM 工具执行器节点)**：
    *   **职责**：接收来自 `ParseLlmDecisionNode` 的一个或多个 `ToolCallRequest`。
    *   根据请求中的 Tool 名称，通过一个通用的调度机制，在后端查找并执行对应的、已在“工具注册表 (Tool Registry)”中注册的 LLM Tool，并向其传递参数。
    *   此节点的核心职责是作为工作流与后端 Tool 执行之间的桥梁。
    *   输出被调用 Tool 的执行结果（可以是流式或单个数据对象）和执行状态。

**方案优势：**
*   **概念清晰与模块化**：明确分离了 LLM API 交互 (`LlmApiRequestNode`)、决策解析 (`ParseLlmDecisionNode`)、工具配置 (`AvailableToolsNode`) 和工具执行 (`ExecuteToolNode`)。
*   **灵活性与可扩展性**：后端可以方便地注册新的 Tools。纯文本工具调用格式提供了对不同 LLM 的良好兼容性，同时保留了对原生 FC 的支持。
*   **强大的表达能力**：允许 LLM 同时输出文本和工具调用，更符合自然交互和复杂思考链的表达。
*   **信息流合理**：工具调用请求被明确解析和结构化，便于后续处理和执行。
*   **符合业界实践**：结合了纯文本指令的通用性和结构化 FC 的便利性。

**关于“工具即节点”的补充说明：**
虽然不作为核心的 LLM 工具调用机制，但“将一个复杂工作流封装并注册为一个后端 LLM Tool”是完全可行的，并且是本方案支持的一种高级 Tool 实现方式。这种情况下，画布上的节点编排定义了一个复杂 Tool 的具体实现逻辑，然后这个整体被注册到 Tool Registry 中供 LLM 通过 `ExecuteToolNode` 调用。
## 4. 核心机制与优先级

### P0: 核心流式支持 (引擎与用户界面) - 最高优先级

*   **引擎能力**：执行引擎必须支持捕获和传播节点的流式输出，特别是 `ExecuteToolNode`（当执行流式工具/子工作流时）和 `LLMDecisionWithToolsNode`（用于流式直接回复），以及核心Agent节点产生的执行轨迹事件。
*   **用户界面实时显示**：流式数据、进度更新以及执行轨迹事件应通过 WebSocket 推送到前端用户界面，以改善用户体验并实时展示Agent执行过程。

### P1: Agent 核心循环与信息反馈 - 次高优先级

*   **用户可见的 Agent 执行轨迹 (UX 特性)**：
    *   核心 Agent 节点 (`LLMDecisionWithToolsNode`, `ExecuteToolNode`) 应发出标准化的事件，代表其执行步骤（例如：“Agent 思考中”、“已选择工具”、“工具执行中”、“工具结果摘要”）。
    *   这些事件通过 WebSocket 实时推送到 UI，以构建用户友好的、时间轴式的 Agent 执行过程视图，这与详细的开发者日志不同。
*   **`LoopZoneNode` 实现**：这是 Agent 迭代性质的基石。
    *   **后端**：引擎支持解析、执行和管理 `LoopZoneNode` 及其内部子图在多次迭代中的状态。
    *   **前端**：用户界面/用户体验设计，用于创建、配置和与 `LoopZoneNode` 交互（定义其边界、迭代变量、控制参数和内部节点连接）。这是一个重要的设计挑战。
*   **核心 Agent 节点的适配**：`LLMDecisionWithToolsNode`、`ExecuteToolNode` 等将在 `LoopZoneNode` 内部运行，与其迭代状态变量交互，并产生执行轨迹事件。
*   **工具输出处理**：
    *   来自 `ExecuteToolNode` 的原始工具输出由用户定义的、在 `LoopZoneNode` 内部或反馈到其迭代变量之前的数据处理/摘要节点链进行处理。
    *   决策 LLM 从工具接收经过提炼的、非流式的、摘要性的信息，而不是原始数据流。
*   **基础数据处理节点的开发**：用于文本操作、JSON 处理、状态检查等的基本实用节点。
*   **持久化聊天记录的读写节点**：实现从数据库/文件加载和保存用户聊天记录的基础节点。
*   **短期工作记忆的开发者日志记录**：为 `LoopZoneNode` 的迭代过程提供基础的日志记录，便于调试和溯源。


## 5. 架构草图 (概念性)

```mermaid
graph TD
    UserInput[用户输入] --> AgentLoopZone[循环区域节点: Agent迭代区]
    
    subgraph AgentLoopZone [Agent迭代区]
        direction LR
        
        LoopIn_History[循环迭代输入: 聊天记录]
        LoopIn_Observation[循环迭代输入: 上次观察结果]
        LoopIn_UserQuery[循环迭代输入: 当前用户查询]

        AvailableTools[可用工具节点]
        
        CoreLLM[LLM决策与工具节点]
        CoreLLM -- 用户查询 --> LoopIn_UserQuery
        CoreLLM -- 聊天记录 --> LoopIn_History
        CoreLLM -- 上次观察结果 --> LoopIn_Observation
        CoreLLM -- 可用工具 --> AvailableTools
        
        CoreLLM -- 工具调用请求 --> ExecuteToolChain[执行工具并处理输出]
        CoreLLM -- 直接回复 --> LoopOut_FinalReply[循环迭代输出: 最终回复]
        
        subgraph ExecuteToolChain [执行工具链]
            direction TB
            ToolExecutor[执行工具节点] -- 原始工具输出 (流式/非流式) --> ProcessingNodes[数据处理/摘要节点]
            ProcessingNodes -- 精炼后的观察结果 --> ObservationOut[用于下次迭代的观察结果]
        end
        
        ObservationOut --> LoopOut_Observation[循环迭代输出: 新的观察结果]
        CoreLLM -- 更新后的聊天记录 --> LoopOut_History[循环迭代输出: 更新后的聊天记录]
        %% 核心Agent节点也会产生执行轨迹事件 (未在图中显式标出连线，但会通过WebSocket推给UI)
    end

    AgentLoopZone -- 最终回复 (可能流式输出到UI) --> UserOutput[输出给用户]
    AgentLoopZone -- 循环迭代输出: 新的观察结果 --> AgentLoopZone % 反馈到 LoopIn_Observation
    AgentLoopZone -- 循环迭代输出: 更新后的聊天记录 --> AgentLoopZone % 反馈到 LoopIn_History
    AgentLoopZone -- 循环迭代输出: 最终回复 -.-> AgentLoopZone % 也可能是循环终止的条件
```
此概念图显示 `LoopZoneNode` (循环区域节点) 封装了主要的 Agent 逻辑。迭代变量（如聊天记录和上次观察结果）在循环内部反馈。工具执行结果在成为 LLM 的观察结果之前被处理。核心Agent节点会产生执行轨迹事件，通过WebSocket推送给UI进行实时展示。

*(注意：上述 Mermaid 图是简化表示。LoopZoneNode 内迭代变量的实际数据流需要在UI和后端进行详细设计。)*