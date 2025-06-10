# ComfyTavern 场景 (Scene) 概念详解 (更新版)

## 1. 引言与核心定位

在 ComfyTavern 架构中，**场景 (Scene)** 是定义**应用流程、交互结构、状态管理、任务编排与事件调度**的核心机制。它提供了一个声明式的框架，用于管理跨多个交互回合或时间周期的会话状态，定义目标与转换逻辑，并协调不同工作流 (Workflow) 的执行。

**核心定位**:

- **结构与编排层 (Structure & Orchestration Layer)**: 如果说知识库 (KB) 是数据层，工作流 (Workflow) 是执行层，AI 是智能层，那么场景就是将它们组织、编排起来的结构层。它定义了“何时 (When)”以及在何种条件下，执行“何事 (What - 调用哪个工作流)”。
- **通用状态机编排引擎 (General State Machine Orchestration Engine)**: 本质上，场景定义了一个状态机，描述了应用可能处于的各种状态，以及基于用户输入、AI 决策、工作流返回值、时间、外部事件等条件，状态之间如何转换，并触发相应的动作（如调用工作流）。
- **AI 与流程的脚手架 (Scaffolding for AI & Process)**: 它不仅是叙事结构，更是通用的流程定义，为 AI 提供目标、边界和上下文切换的框架，也为多步骤任务、定时任务、事件驱动任务提供执行蓝图。
- **关注点分离**: 将宏观的流程结构、状态管理、编排调度逻辑，与微观的数据处理和 AI 调用逻辑（工作流）分离开来。

场景文件本身是静态的、声明式的数据定义，由外层的**会话管理器 (Session Manager / Scene Orchestrator)** 负责加载、解释、维护其实例状态，并根据定义进行编排和调度。

## 2. 为什么需要场景？

引入独立的 `Scene` 层有以下关键优势：

- **关注点分离 (Separation of Concerns)**:
  - `Scene`: 定义“是什么结构/流程”、“何时转换”、“编排哪个工作流”。
  - `Workflow`: 定义“如何做” (作为无状态异步函数，专注于执行)。
  - `KB`: 定义“数据是什么”。
  - 避免将复杂状态逻辑和编排逻辑硬编码，保持工作流小巧、专注、可复用。
- **工作流编排与调度 (Workflow Orchestration & Scheduling)**:
  - **解耦**: 将工作流的具体逻辑 (How) 与编排逻辑 (When/Which) 分离。
  - **统一视图**: 在一个统一的声明式框架下，管理用户交互、AI 逻辑、基于时间 (Time-based) 和基于事件 (Event-based) 的触发器。
  - **清晰定义**: 声明式地定义复杂的序列、分支、循环、定时和事件驱动流程，避免硬编码。
- **作者体验与可维护性 (Authoring Experience & Maintainability)**:
  - 提供更直观、更接近流程思维的声明式编写方式 (文本/图形/面板混合)。
  - 比起庞大的节点图或代码，更易于阅读、版本控制 (Git Diff) 和维护。
- **管理复杂性**:
  - **状态管理**: 通过变量管理长期记忆、关键事件和任务进度。
  - **目标导向**: 通过状态定义明确的目标，防止 AI "跑飞" 或任务失焦。
  - **上下文控制**: 根据状态切换，精确控制 AI 上下文和知识库过滤范围。

## 3. 场景的核心构成元素

### 3.1. 状态 / 节点 (States / Nodes)

- **定位**: 流程中的一个稳定点或阶段。
- **包含信息**:
  - `id`, `displayName`。
  - `goal / description`: 定义此状态下的核心目标或任务描述。
  - `associated_workflow`: **【编排核心】** 指定进入或处于此状态时，应由 `Session Manager` 调用的工作流 ID。一个状态可关联一个特定的工作流函数。
  - `context_injection`: 上下文注入规则，可含 KB 引用 `{{{...}}}`。
  - `active_tags`: KB 检索过滤标签。
  - `on_enter / on_exit actions`: 动作列表。

### 3.2. 转换 (Transitions)

- **定位**: 状态转移的路径和条件。
- **包含信息**:
  - `from_state`, `to_state`。
  - `condition`: 触发转换的条件，扩展支持：
    - AI 意图: `intent == "..."`。
    - 变量检查: `variables.score > 50`。
    - **工作流返回值**: `workflow_return.status == "SUCCESS"` (基于工作流函数返回的 `stateUpdateInfo`)。**【编排核心】**
    - **时间延迟**: `type: TIME_DELAY, duration: "5s"` (进入状态后延迟 X 时间)。**【调度核心】**
    - **外部事件**: `type: EXTERNAL_EVENT, name: "webhook_received"`。**【调度核心】**
    - 复合逻辑 (AND/OR)。
  - `on_transition_actions`: 动作列表。

### 3.3. 变量与标志位 (Variables & Flags)

- **定位**: 由 `Session Manager` 持久化存储的跨回合、跨状态信息（进度、计数、标志、数据缓存等）。
- **交互**: 由 `Actions` 设置，由 `Conditions` 读取，由工作流返回的 `variableUpdates` 更新，影响 KB 激活。

### 3.4. 动作 (Actions)

- **定位**: 状态切换或定时触发时执行的操作。
- **类型**:
  - `SET_VARIABLE`: 设置变量。
  - **`CALL_WORKFLOW`**: 显式调用指定工作流。**【编排/调度核心】**
  - `CALL_AGENT_TOOL`: 调用 Agent 工具 (如写入 KB)。
  - `TRANSITION_TO`: 强制跳转到某状态。

### 3.5. 调度定义 (Scheduling Definitions - 可选顶层)

- **定位**: 定义不完全依赖于状态转换的周期性或定时任务。
- **包含信息**:
  ```yaml
   scheduled_tasks:
     - name: "check_news_hourly"
       trigger: { type: CRON, schedule: "0 0 * * * *" } # 每小时触发
       action: { type: CALL_WORKFLOW, workflow_id: "workflows/fetch_news.json" }
     - name: "delay_start"
        trigger: { type: DELAY, duration: "10s" } # 场景启动后10秒
        action: { type: SET_VARIABLE, variable: ready, value: true }
  ```
- **机制**: 由 `Session Manager` 内置的调度器管理和触发。**【调度核心】**

## 4. 场景在架构中的位置与交互模型

场景文件由外层的 `Session Manager` 管理，遵循 "外层编排，内层执行" 模型。

```
  [ UI / Timer / Events ]
           |
           v
  [ Session Manager / Scene Orchestrator ] <--> [ KB System ]
    - 持有 Scene Definition & State (持久化)
    - 规则引擎 (Transitions / Conditions)
    - 调度器 (Scheduler) & 事件监听器
    - 状态更新
    - 选择并调用 Workflow
           |
  (Input: {State, Input/Event, ...}) | (Output: {AI Resp, StateUpdateInfo})
           |                         |
           v                         ^
  [ Workflow Engine.run(workflow_id, inputContext) ]  <--> [ AI Service ]
    - Workflow as Stateless Async Function
    - 读取 State, 查询 KB, 调用 AI, 返回结果
```

- **会话管理器 (Session Manager)**:
  - 加载 `Scene` 定义。
  - 持久化 `Current Scene State`。
  - **集成调度器和事件监听器**，响应时间、外部事件。
  - 接收用户输入、定时/事件信号、工作流返回的 `StateUpdateInfo`。
  - 内置规则引擎，评估 `Transitions` 和 `scheduled_tasks`，执行状态转换和动作。
  - **【编排】** 根据 `currentState.associated_workflow` 或 `Action.CALL_WORKFLOW`，选择工作流 ID。
  - 准备 `inputContext` (包含状态、变量、触发事件信息等)。
  - 调用 `WorkflowEngine.run(workflow_id, inputContext)`。
- **工作流 (Workflow as Async Function)**:
  - 接收 `inputContext`，读取状态、目标、变量、事件数据。
  - 执行具体任务 (查询 KB, 调用 AI, 数据处理)。
  - 返回 `aiResponse` 和 `stateUpdateInfo` (包含可驱动状态转换的变量/意图)。
  - 保持无状态。

## 5. 存储、格式与创作体验 (Authoring Experience)

- **位置**: 项目目录 `/scenes/`。
- **创作模式：混合模式 (Hybrid Approach)**
  - **核心原则**: **文本 (YAML/Code) 作为事实来源 (Source of Truth)，图形和面板作为可视化和编辑辅助工具。** 平衡表达力、可视化、易用性和可维护性（版本控制）。
  - **组成部分**:
    1.  **核心：文本编辑器 (Text Editor)**:
        - **格式**: 推荐 YAML，或 JSON。
        - **功能**: 语法高亮、自动完成 (Schema-based)、实时校验。
        - **优势**: 表达力强、信息密度高、版本控制友好 (Git Diff 清晰)、灵活高效。
    2.  **辅助视图 1：同步可视化图 (Synchronized Visual Graph Viewer)**:
        - **形式**: 只读或有限编辑的节点图 (节点=State, 边=Transition)。
        - **功能**: 根据文本实时生成流程图；文本与图形元素双向同步高亮与导航 (点击图定位文本，光标在文本高亮图)。
        - **优势**: 提供全局流程概览，可视化理解状态流转和编排逻辑。
    3.  **辅助视图 2：上下文属性面板 (Contextual Property Panel)**:
        - **形式**: 侧边栏/浮动面板。
        - **功能**: 当文本光标位于某个元素 (State, Condition, Action, Schedule) 时，显示结构化表单；面板编辑实时更新文本。
        - **优势**: 引导式编辑，减少语法错误，提供选项选择 (如选择 Workflow ID, KB Tag)。
- **文件结构 (概念性 YAML)**: (参考上一版，增加编排和调度元素)

  ```yaml
  id: scene_orchestrator
  start_state: state_research
  variables: { topic: "", search_complete: false, summary: "" }

  scheduled_tasks:
    - name: "daily_report"
      trigger: { type: CRON, schedule: "0 0 8 * * *" } # 每天8点
      action: { type: CALL_WORKFLOW, workflow_id: "generate_report.json" }

  states:
    state_research:
      goal: "Research the topic"
      associated_workflow: "web_search.json"
      transitions:
        - to_state: state_summarize
          # 条件: 基于 web_search.json 返回的 stateUpdateInfo { variableUpdates: {search_complete: true} }
          condition:
            { type: variable_check, variable: "search_complete", operator: "==", value: true }

    state_summarize:
      goal: "Summarize the findings"
      associated_workflow: "summarize_kb.json"
      transitions:
        - to_state: state_waiting
          condition: { type: TIME_DELAY, duration: "10s" } # 总结后等待10秒

    state_waiting:
      # ...
  ```

## 6. 应用场景示例 (扩展)

- **叙事与交互**: 角色扮演、引导流程、TRPG 模组、视觉小说。
- **工作流编排 (Orchestration)**:
  - **多步 Agent**: 研究 (Workflow A) -> 总结 (Workflow B) -> 写作 (Workflow C)。
  - **业务流程自动化**: 订单接收 (State) -> 支付确认 (State/Workflow) -> 发货处理 (State/Workflow)。
  - **条件分支处理**: 根据工作流返回值，进入不同状态，调用不同后续工作流。
- **任务调度 (Scheduling)**:
  - **定时任务**: 定时抓取数据、更新知识库、生成报告、清理缓存、发送通知。
  - **延迟处理**: AI 后台思考、延迟回复、冷却时间。
  - **事件驱动**: 响应 Webhook、消息队列、文件系统变化，触发相应工作流。

## 7. 总结

场景 `Scene` 是 ComfyTavern 的通用状态机编排引擎。它作为声明式的“流程蓝图”，由 `Session Manager` 负责状态维护、规则解释、调度和事件监听，指导和编排无状态的 `Workflow` 函数执行具体操作。通过集成编排与调度能力，并采用混合创作模式，`Scene` 为构建和维护从简单交互到复杂自动化流程的各类 AI 应用，提供了清晰、可控、高效和统一的框架。
