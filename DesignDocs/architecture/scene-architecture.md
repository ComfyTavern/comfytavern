# ComfyTavern 场景 (Scene) 架构规划 (v2 - Agent 整合版)

## 1. 引言与核心定位

在 ComfyTavern 架构中，**场景 (Scene)** 是定义**应用流程、交互结构、状态管理、任务编排、事件调度，以及作为 Agent 运行时实例的宿主环境和生命周期管理者**的核心机制。它提供了一个声明式的框架，用于管理跨多个交互回合或时间周期的会话状态，定义目标与转换逻辑，协调不同工作流 (Workflow) 的执行，并为 Agent 提供运行所需的上下文。

**核心定位**:

- **Agent 宿主与生命周期管理者 (Agent Host & Lifecycle Manager)**: 这是场景在整合 Agent 架构后的首要新增角色。场景实例负责根据其定义孵化、激活、运行、暂停、恢复和终止其内部声明的 Agent 实例。
- **Agent 运行时上下文提供者 (Agent Runtime Context Provider)**: 场景为其内部的 Agent 实例提供必要的运行时环境，包括：
    - 专属的**世界状态 (`WorldState`)** 实例的访问接口。
    - 专属的**事件总线 (`EventBus`)** 通道的访问接口。
    - 与场景内其他 Agent 实例或应用面板实例的交互协调机制。
- **结构与编排层 (Structure & Orchestration Layer)**: 场景定义了“何时 (When)”以及在何种条件下，执行“何事 (What - 调用哪个工作流或影响哪个 Agent)”。它将宏观的流程结构、状态管理、编排调度逻辑，与微观的数据处理和 AI 调用逻辑（工作流）以及 Agent 的自主审议逻辑分离开来。
- **通用状态机编排引擎 (General State Machine Orchestration Engine)**: 本质上，场景可以定义一个状态机，描述了应用可能处于的各种状态，以及基于用户输入、AI 决策、工作流返回值、Agent 行为、时间、外部事件等条件，状态之间如何转换，并触发相应的场景级动作。
- **AI 与流程的脚手架 (Scaffolding for AI & Process)**: 它为 AI Agent 提供目标设定的初始框架、行为边界和上下文切换的机制，也为多步骤任务、定时任务、事件驱动任务提供执行蓝图。

场景文件本身是静态的、声明式的数据定义，由外层的**会话管理器 (Session Manager / Scene Orchestrator)** 负责加载、解释、维护其实例状态，并根据定义进行编排、调度以及管理其内部 Agent 的生命周期。

## 2. 为什么需要场景？

引入独立的 `Scene` 层，并在其上承载 Agent 实例，具有以下关键优势：

- **关注点分离 (Separation of Concerns)**:
  - `Scene`: 定义“是什么结构/流程”、“何时转换”、“编排哪个工作流”、“托管哪些 Agent 及其初始配置”。
  - `Agent Profile`: 定义 Agent 的静态蓝图（核心审议逻辑、技能、知识等）。
  - `AgentRuntime`: 驱动单个 Agent 实例的动态行为。
  - `Workflow`: 定义“如何做” (作为无状态异步函数，专注于执行，可被场景或 Agent 调用)。
  - `KB`: 定义“数据是什么”。
- **Agent 运行环境与管理 (Agent Hosting & Management)**:
  - 提供一个隔离的、包含必要上下文（世界状态、事件通道）的环境供 Agent 实例运行。
  - 统一管理场景内多个 Agent 实例的生命周期。
  - 允许场景对 Agent 的初始状态和目标进行特定配置。
- **工作流与 Agent 行为的协同编排 (Workflow & Agent Behavior Orchestration)**:
  - **解耦**: 将 Agent 的自主决策与场景级的宏观流程控制分离，又使它们能有效协同。
  - **统一视图**: 在一个声明式框架下，管理用户交互、Agent 行为触发、场景级工作流调用、基于时间的任务和基于事件的触发器。
- **作者体验与可维护性 (Authoring Experience & Maintainability)**:
  - 提供更直观的方式来定义包含多个 Agent 的复杂交互场景。
- **管理复杂性**:
  - **共享状态管理**: 通过 `WorldState` 管理 Agent 间共享的环境信息。
  - **事件驱动交互**: 通过场景级 `EventBus` 实现 Agent 间以及 Agent 与场景其他部分的解耦通信。
  - **目标导向**: 场景可以为其内部 Agent 设定初始或高阶目标。

## 3. 场景的核心构成元素 (`scene.json` Schema)

场景定义文件（例如 `scene.json`）存储在项目层，描述了场景的静态配置。

```json
{
  "id": "string", // (必需) 场景定义的唯一标识符
  "name": "string", // (必需) 用户可读的场景名称
  "description": "string", // (可选) 场景描述
  "version": "string", // (必需) 场景定义的版本号
  "schema_version": "string", // (必需) scene.json 本身 Schema 的版本号

  "agent_instances": [ // (必需) 声明此场景在实例化时需要激活的 Agent 实例列表
    {
      "instance_id": "string", // (必需) 在此场景实例中该 Agent 实例的唯一 ID
      "profile_id": "string", // (必需) 引用项目中的 Agent Profile 定义的 ID
      "initial_private_state_override": {}, // (可选) 覆盖 Agent Profile 中的默认私有状态
      "initial_goals_override_reference": [ // (可选) 覆盖 Agent Profile 中的默认目标
        {
          "caiu_id": "string",
          "kb_alias_or_id": "string",
          "activation_priority": "number"
        }
      ],
      "custom_runtime_config": {} // (可选) 针对此 Agent 实例的特定运行时配置
    }
  ],

  "initial_world_state": {}, // (可选) 定义此场景实例启动时的初始世界状态

  "event_bus_config": { // (可选) 配置此场景实例的事件总线通道特性
    "namespace_prefix": "string",
    "default_event_ttl_seconds": "number"
  },

  "associated_panels": [ // (可选) 声明与此场景关联的应用面板
    {
      "panel_id": "string",
      "instance_name": "string",
      "default_bindings": {}
    }
  ],

  "scene_lifecycle_workflows": { // (可选) 定义在场景生命周期特定阶段自动触发的工作流
    "on_scene_start": "string", // 工作流 ID 或路径
    "on_scene_end": "string",
    "on_scene_pause": "string",
    "on_scene_resume": "string"
    // 也可以是更复杂的事件驱动的场景逻辑工作流 e.g., "on_custom_event_type": "workflow_path.json"
  },

  // 以下为场景自身状态机编排相关的可选字段 (如果场景扮演宏观编排角色)
  "start_state": "string", // (可选) 场景状态机的初始状态 ID
  "variables": {}, // (可选) 场景级的变量，用于场景自身的状态机逻辑
  "states": [ // (可选) 场景的状态定义列表
    {
      "id": "string",
      "displayName": "string",
      "goal": "string", // 此场景状态的目标描述
      "associated_workflow": "string", // (可选) 进入此场景状态时，场景自身调用的工作流 ID
      "context_injection": {},
      "active_tags": [],
      "on_enter_actions": [],
      "on_exit_actions": [],
      "transitions": [
        {
          "to_state": "string",
          "condition": {}, // 条件可以基于场景变量、工作流返回值、Agent 事件等
          "on_transition_actions": []
        }
      ]
    }
  ],
  "scheduled_tasks": [ // (可选) 场景级的定时任务
    {
      "name": "string",
      "trigger": { "type": "CRON", "schedule": "string" }, // or { "type": "DELAY", "duration": "string" }
      "action": { "type": "CALL_WORKFLOW", "workflow_id": "string" } // 或其他场景级动作
    }
  ],

  "custom_metadata": {} // (可选) 其他用户自定义元数据
}
```

**核心字段解释 (新增或重点调整的):**

- **`agent_instances`**: 核心新增。列表中的每个对象定义了一个将在场景启动时被实例化的 Agent。
    - `instance_id`: 场景内 Agent 的唯一标识，用于事件路由、状态访问等。
    - `profile_id`: 链接到项目层定义的 `agent_profile.json`。
    - `initial_private_state_override`: 允许同一 Agent Profile 在不同场景或实例下有不同的初始内部状态。
    - `initial_goals_override_reference`: 允许场景为 Agent 设定特定的初始目标。
    - `custom_runtime_config`: 可用于配置 Agent 的审议频率、资源分配等。
- **`initial_world_state`**: 场景启动时共享环境的初始样貌。Agent 通过 `WorldStateService` 感知。
- **`event_bus_config`**: 配置场景专属的事件通道，Agent 通过此通道进行异步通信和感知环境事件。
- **`associated_panels`**: 声明此场景使用的应用面板，Agent 可以通过这些面板与用户交互。
- **`scene_lifecycle_workflows`**: 场景自身可以在其生命周期的关键节点（如启动、结束）执行工作流，用于初始化环境、清理资源或执行不适合由单个 Agent 完成的宏观逻辑。
- **场景状态机元素 (`start_state`, `variables`, `states`, `scheduled_tasks`)**: 这些元素保持了场景作为可选的宏观流程编排器的能力。其编排逻辑可以与内部 Agent 的自主行为协同工作，例如：
    - 场景状态的转换可以基于 Agent 产生的特定事件。
    - 场景动作可以向 Agent 发布高级指令或更新其目标。
    - 场景定时任务可以触发全局事件，影响所有相关 Agent。

## 4. 场景在架构中的位置与交互模型

场景实例 (`SceneInstance`) 是 Agent 实例 (`AgentRuntime`) 的直接容器和管理者。

```mermaid
graph TD
    UserInterface["用户界面 / 应用面板 (AppPanel Instance)"]
    SessionManager["会话管理器 / 场景编排器 (SessionManager)"]
    SceneInst["场景实例 (SceneInstance)"]
    ProjectLayer["项目层资产 (Project Layer Assets)"]
    AgentProfileDef["Agent Profile 定义 (agent_profile.json)"]
    SceneDef["场景定义 (scene.json)"]
    WorkflowDef["工作流定义 (.json)"]
    PlatformServices["平台核心服务"]
    ExecutionEngine["工作流引擎 (ExecutionEngine)"]
    WorldStateService["世界状态服务 (WorldStateService Core)"]
    EventBusService["事件总线服务 (IntelligentEventBus Core)"]
    KB_Service["知识库服务 (KnowledgeBase Service)"]

    subgraph SceneInstanceLayer["场景实例层 (Runtime)"]
        direction LR
        SceneInst
        subgraph ActiveAgentRuntimes["活跃的 Agent 运行时"]
            direction TB
            AgentRuntime1["AgentRuntime 1 (驱动 Agent 1)"]
            AgentPState1["Agent 1 PrivateState"]
            AgentRuntime1 --> AgentPState1
            AgentRuntimeN["..."]
        end
        CurrentWorldState["当前世界状态 (WorldState Instance)"]
        EventBusChannel["事件总线通道 (EventBus Channel)"]
    end

    UserInterface -- "用户交互" --> SessionManager
    SessionManager -- "加载/管理" --> SceneInst
    SceneInst -- "加载" --> SceneDef
    SceneInst -- "创建/管理" --> ActiveAgentRuntimes
    AgentRuntime1 -- "加载" --> AgentProfileDef
    ProjectLayer --> AgentProfileDef
    ProjectLayer --> SceneDef
    ProjectLayer --> WorkflowDef

    SceneInst -- "提供/管理" --> CurrentWorldState
    CurrentWorldState -- "由...支持" --> WorldStateService
    SceneInst -- "提供/管理" --> EventBusChannel
    EventBusChannel -- "由...支持" --> EventBusService

    AgentRuntime1 -- "执行核心/技能工作流" --> ExecutionEngine
    SceneInst -- "可选:调用场景编排工作流" --> ExecutionEngine
    ExecutionEngine -- "执行" --> WorkflowDef
    ExecutionEngine -- "访问" --> KB_Service
    ExecutionEngine -- "访问" --> CurrentWorldState
    ExecutionEngine -- "发布/订阅" --> EventBusChannel


    AgentRuntime1 -- "感知/请求更新" --> CurrentWorldState
    AgentRuntime1 -- "感知/发布事件" --> EventBusChannel
    AgentRuntime1 -- "查询/贡献知识" --> KB_Service
    AgentRuntime1 -- "请求用户交互 (通过事件)" --> EventBusChannel
    EventBusChannel -- "传递交互请求给前端" --> UserInterface
end
```

**交互流程要点**:

1.  **场景实例化**: `SessionManager` 根据项目中的 `scene.json` (SceneDef) 创建一个 `SceneInstance`。
2.  **Agent 实例化**: `SceneInstance` 遍历其定义中的 `agent_instances`：
    *   为每个声明的 Agent 创建一个 `AgentRuntime` 实例。
    *   `AgentRuntime` 加载对应的 `agent_profile.json` (AgentProfileDef)。
    *   初始化 Agent 的 `PrivateState` (可被 `scene.json` 中的覆盖配置影响)。
3.  **运行支撑**:
    *   `SceneInstance` 为其内部所有 `AgentRuntime` 提供对共享 `WorldStateInstance` 和 `EventBusChannel` 的访问。
    *   `AgentRuntime` 负责驱动其 Agent 的核心审议工作流（通过 `ExecutionEngine` 执行），收集必要的上下文（`PrivateState`, `WorldState`, `IncomingEvents` 等）。
    *   Agent 的决策（调用技能工作流、使用工具、发布事件、更新状态）由 `AgentRuntime` 解析并执行。
4.  **场景级编排 (可选)**:
    *   `SceneInstance` 自身可以拥有状态机逻辑和生命周期工作流。
    *   这些场景级逻辑可以发布事件影响 Agent，或根据 Agent 的行为转换场景状态。
    *   场景的编排应与 Agent 的自主性协同，而非完全取代。
5.  **生命周期管理**: `SceneInstance` 控制其内部所有 `AgentRuntime` 的暂停、恢复和终止。

## 5. 存储、格式与创作体验

- **位置**: 项目目录 `/scenes/`。
- **格式**: 推荐 JSON (与平台其他定义文件一致，便于机器读写和校验)，或 YAML (可读性稍好，但需转换)。**v3 报告的附录 B 使用 JSON，建议统一。**
- **创作模式**:
    - **核心**: 结构化文本编辑器 (JSON/YAML) 配合 Schema 校验和智能提示。
    - **辅助**: 未来可开发可视化场景编辑器，允许用户通过图形界面配置场景（包括添加和配置 Agent 实例、设置初始世界状态、连接场景状态机等），最终生成或修改底层的 `scene.json` 文件。

**YAML 示例 (概念性，对应上述 JSON Schema 核心部分)**:

```yaml
id: scene_forest_outskirts_encounter_v1
name: Forest Outskirts Encounter
description: A dynamic encounter scene at the edge of the Whispering Woods...
version: 1.0.0
schema_version: "2.0" # 指 scene.json 的 schema 版本

agent_instances:
  - instance_id: elara_the_herbalist_instance_1
    profile_id: comfytavern_advanced_npc_v1.2
    initial_private_state_override:
      mood: curious
      player_reputation: 5
    initial_goals_override_reference:
      - caiu_id: goal_elara_warn_player_about_woods
        kb_alias_or_id: myJournal
        activation_priority: 0.9
    custom_runtime_config:
      deliberation_frequency_hz: 0.5
  - instance_id: player_character_proxy
    profile_id: comfytavern_player_proxy_agent_v1.0
    initial_private_state_override:
      current_location_tag: forest_outskirts

initial_world_state:
  time_of_day: afternoon
  weather: clear_sky
  scene_flags:
    player_has_entered_woods: false
    elara_has_given_warning: false

event_bus_config:
  namespace_prefix: scene_forest_outskirts
  default_event_ttl_seconds: 3600

associated_panels:
  - panel_id: panel_main_dialogue_ui_v1
    instance_name: main_dialogue_interface

scene_lifecycle_workflows:
  on_scene_start: "workflows/scene_init/forest_outskirts_setup.json"
  on_scene_end: "workflows/scene_cleanup/generic_encounter_wrapup.json"

# ... (可选的场景自身状态机定义: start_state, variables, states, scheduled_tasks)
```

## 6. 应用场景示例 (扩展)

- **RPG 场景**:
    - 场景定义 GM Agent、多个 NPC Agent、以及代表玩家的 Player Proxy Agent。
    - `initial_world_state` 设置地图、时间、关键物品。
    - Agent 通过事件总线交互（对话、战斗），通过修改 `WorldState` 影响环境。
    - 场景生命周期工作流可用于触发全局剧情事件或管理游戏章节。
- **多 Agent 协作任务**:
    - 一个“研究员 Agent”负责收集信息，一个“分析师 Agent”负责处理数据，一个“报告员 Agent”负责总结呈现。
    - 场景定义这些 Agent 实例，并通过事件或共享状态（例如，任务队列在 `WorldState` 中）协调它们的任务流。
- **自动化助手集群**:
    - 场景可以托管一组专门处理不同类型用户请求的助手 Agent（如日程管理 Agent、邮件处理 Agent）。
    - 场景通过事件总线将用户请求路由到合适的 Agent。

## 7. 总结

在新架构下，场景 (`Scene`) 的核心职责得到了扩展和强化。它不仅是通用的状态机编排引擎和流程蓝图，更关键的是，它成为了 **Agent 运行时实例的宿主环境和生命周期管理者**。场景通过其定义文件 (`scene.json`) 声明需要激活的 Agent 实例及其初始配置，并为其提供必要的运行时上下文（如隔离的世界状态和事件通道）。`SessionManager` 在加载场景时，会负责创建和管理这些 Agent 实例的生命周期，同时场景自身仍可扮演宏观编排者的角色，与内部 Agent 的自主行为协同工作，共同实现复杂、动态的 AI 应用。
