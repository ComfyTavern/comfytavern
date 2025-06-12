# ComfyTavern 动态世界模拟引擎 & 知识交互规划 (v2 - 理念整合版)

**核心哲学**: 构建一个以**目标驱动、具备学习与反思能力的自主 Agent**为核心，通过**分层架构**实现高效协作与动态涌现的模拟世界。工作流是 Agent 执行任务的“技能”，知识库是“集体大脑”，应用面板是“交互与讨论空间”。

## 1. 核心架构：智能体、环境与交互

### 1.1. 自主 Agent (Autonomous Agent) - 世界的核心驱动力

Agent 不再是简单响应事件的脚本执行器，而是拥有内在“心智模型”的实体。

*   **1.1.1. Agent 核心审议循环 (Deliberation Loop)**
    *   **定位**: 每个 Agent 的“大脑”，负责感知、思考、规划、决策和学习。
    *   **实现**: 通常由一个核心的、高度灵活的 LLM 工作流（或直接的 LLM 调用逻辑）承载。
    *   **输入 (Context for Deliberation)**:
        1.  **世界状态 (`WorldState`)**: 全局共享的、易变的运行时数据。
        2.  **私有状态 (`PrivateState`)**: Agent 自身的记忆、情绪、短期目标、任务追踪等。
        3.  **激活的目标/动机 (`ActiveGoals/Motivations`)**: Agent 当前需要关注和推进的内在目标（可从知识库加载）。
        4.  **知识库 (`KnowledgeBase - CAIU`)**: 相关的结构化知识、世界设定、角色信息、过去的经验总结、其他 Agent 分享的最佳实践。
        5.  **交互历史 (`InteractionHistory` from App Panel)**: 当前应用面板（如群聊）的最新对话/事件流，作为短期工作记忆和直接上下文。
        6.  **感知事件 (`IncomingEvents` from Event Bus)**: 结构化的外部刺激或请求。
        7.  **可用能力 (`AvailableCapabilities`)**: Agent 可调用的工具列表、技能工作流列表。
    *   **处理 (LLM-driven Reasoning & Planning)**:
        1.  **评估现状 (Assess)**: 理解当前情境，识别机会与威胁。
        2.  **目标校准 (Align Goals)**: 根据现状，确认或调整当前最高优先级目标。
        3.  **规划行动 (Plan Actions)**: 生成一个或多个行动步骤以达成目标。这可能包括：
            *   直接生成回应文本。
            *   调用一个或多个原子工具 (Tool)。
            *   执行一个或多个预定义的技能工作流 (Skill Workflow)。
            *   向其他 Agent 发布请求/查询事件。
            *   更新自身私有状态或世界状态。
            *   决定进入反思/学习阶段。
        4.  **输出决策 (Output Decision)**: 将规划好的行动序列或具体指令输出给 Agent Runtime。
    *   **Agent Runtime 执行**: 解析决策，调度工具调用、工作流执行、事件发布等。

*   **1.1.2. 目标与动机管理 (Goal & Motivation Management)**
    *   Agent 的核心驱动力。
    *   目标可以作为特殊的 CAIU 条目（`entry_type: "goal"`）存储在私有或共享知识库中，包含描述、优先级、前置条件、完成状态等元数据。
    *   Agent 的审议循环会动态加载和评估其目标。

*   **1.1.3. 学习与反思机制 (Learning & Reflection Mechanism)**
    *   Agent 在行动后或特定触发条件下，进入反思阶段。
    *   **反思内容**: 评估行动结果、分析成功/失败原因、识别新知识、总结经验教训。
    *   **知识贡献**: 将有价值的反思结果（如新的 `best_practice` CAIU，更新的 `goal` 状态，对某个 `lore` CAIU 的修正建议）通过工具写入知识库，实现个体学习和群体知识共享（VCP 的“集体大脑”）。

### 1.2. 世界环境 (World Environment)

*   **1.2.1. 世界状态 (`WorldStateService`)**: 作为全局共享状态中心，但其更新更多由 Agent 审议决策后发起。
*   **1.2.2. 知识库 (Knowledge Base - CAIU)**:
    *   **定位**: Agent 的“长期记忆”和“集体大脑”。存储结构化知识、世界设定、角色信息、Agent 贡献的经验、目标定义等。
    *   **CAIU 设计**: [`DesignDocs/architecture/knowledgebase-architecture.md`](DesignDocs/architecture/knowledgebase-architecture.md:1) 中定义的 CAIU 结构非常适合，特别是其元数据和动态引用 `{{{ }}}` 机制。
    *   **增强方向**:
        *   明确支持 `entry_type` 如 `goal`, `best_practice`, `reflection_note`, `failed_lesson`，以促进 Agent 学习和经验共享。
        *   细化 Agent 对 KB 的写入/更新/评论权限和流程。
*   **1.2.3. 智能事件总线 (`IntelligentEventBus`)**: 用于 Agent 间的结构化消息传递（请求、结果、状态变更通知）。

### 1.3. 交互层 (Interaction Layer)

*   **1.3.1. 应用面板 (App Panel)**:
    *   **定位**: ComfyTavern 的核心用户体验，也是 Agent 间进行高带宽、非结构化通信（类似 VCP“聊天室”）和用户直接交互的场所。
    *   **会话历史**: App Panel 的交互历史（如聊天记录）成为 Agent 审议时的重要短期上下文（工作记忆）。
    *   **多 Agent 协作**: 多个 Agent 可以在同一个 App Panel 中“现身”，通过发布消息到面板来进行讨论、协商和任务分配。
*   **1.3.2. 开放 API**: 为开发者提供调用工作流和与 Agent 交互的接口。

## 2. 工作流的角色：被调用的“技能”与“工具”

*   **工作流 (Workflow)** 不再是 Agent 行为的唯一或主要定义者。
*   **定位**:
    *   **技能 (Skill)**: 预定义的多步骤、可复用的复杂操作序列（例如，`Generate_Image.json`, `Summarize_Text.json`）。由 Agent 的审议层决定调用。
    *   **原子能力/工具 (Atomic Capability/Tool)**: 简单的、单一功能的节点或后端函数（例如，`ReadWorldStateNode`, `PublishEventNode`, `SkillCalculatorTool`）。
    *   **审议核心承载体**: Agent 的核心审议循环本身，也可能由一个非常灵活的、以 LLM 节点为核心的“元工作流”来承载。
*   **调用方式**: Agent 的审议层输出决策，Agent Runtime 解析并执行相应的技能工作流或工具。

## 3. 知识库 (KB/CAIU) 的深度整合

*   CAIU 的设计（如 [`DesignDocs/architecture/knowledgebase-architecture.md`](DesignDocs/architecture/knowledgebase-architecture.md:1) 所述）是坚实的基础。
*   **核心交互模式**:
    1.  **检索供审议 (Retrieve for Deliberation)**: Agent 审议层在做决策前，从 KB 中检索相关知识（世界设定、角色信息、目标、过往经验）作为上下文。
    2.  **动态内容填充 (Dynamic Content via `{{{}}}` )**: Agent 的输出（如对话、描述）或工作流配置可以包含 `{{{ref_key}}}`，由系统从 KB 动态填充，保证信息一致性和复用性。
    3.  **学习与贡献 (Learn & Contribute)**: Agent 通过反思，将新知识、经验总结、更新的目标等，通过专用工具写入 KB，丰富“集体大脑”。
    4.  **目标驱动 (Goal Storage & Retrieval)**: Agent 的长期目标和动机可以作为 CAIU 存储和管理。

## 4. 关键流程示例：RPG 场景再推演 (理念升级版)

与姐姐之前描述的 RPG 场景一致，但现在各组件职责更清晰：

1.  **GM Agent 审议**: 感知到切换场景需求 -> 核心审议循环启动 -> 收集上下文（世界状态、当前目标、知识库中的场景设定、可用技能如“场景描述生成”、“图像生成请求”） -> LLM 规划行动（生成描述、委托 ImageAgent 生成图像、更新状态、记录任务）。
2.  **GM Agent 行动**: Runtime 执行 LLM 决策 -> 调用“场景描述生成”技能（一个工作流） -> 发布“图像生成请求”事件给 ImageAgent -> 更新世界状态。
3.  **ImageAgent 响应**: 收到请求事件 -> 核心审议循环启动 -> 收集上下文（请求参数、自身能力、知识库中的图像风格偏好）-> LLM 规划 -> 调用“图像生成”技能工作流（内部可能有 SD 节点）-> 生成图像 -> 发布“图像生成完成”事件（含任务 ID 和图像链接）。
4.  **GM Agent 感知结果**: 收到“图像生成完成”事件 -> 核心审议循环再次被触发（或从挂起中恢复） -> 更新私有状态中的任务进度 -> LLM 决定下一步（如向玩家展示场景和图像）。
5.  **学习沉淀 (可选)**: GM 或 ImageAgent 在此过程中，如果发现某种 Prompt 组合效果特别好，可以通过反思机制，将其作为 `best_practice` CAIU 贡献到共享知识库。

## 5. 对 ComfyTavern Roadmap 的映射

*   **Phase 1 & 2 (引擎、面板/API)**: 为 Agent 的执行、交互和技能实现提供了基础。
*   **Phase 3 (知识引擎、LLM编排)**: 对应 KB/CAIU 的深度实现和 Agent 审议核心的构建。
*   **Phase 4 (Agent 生态)**: 在此基础上，实现拥有自主学习、目标驱动和复杂协作能力的 Agent 群体。

这个规划试图将 ComfyTavern 的平台能力与姐姐期望的 Agent 核心理念更紧密地结合起来，强调 Agent 的“大脑”和“学习能力”，同时明确工作流、知识库和应用面板在其中的角色。