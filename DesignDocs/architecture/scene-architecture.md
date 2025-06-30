# ComfyTavern 场景 (Scene) 架构规划 (v3 - Agent 架构对齐版)

> **[实施策略说明]** 根据项目推进的务实考量，虽然本架构将场景的最终形态定位为 **Agent 的宿主环境**，但在 MVP (最小可行产品) 阶段，将**优先实现并强化其作为“流程编排器”的能力**。这旨在快速支持现有生态（如 SillyTavern 角色卡转换后的工作流容器），提供一个能快速上手并交付价值的版本，避免过长的开发周期。本篇文档描述的是最终的、统一的架构目标。

## 1. 引言与核心定位

**根据 `agent_architecture_v3_consolidated.md` 的统一规划，本 `scene-architecture.md` 文档已进行重大修订，以确保与 Agent v3 架构完全对齐。**

在 ComfyTavern 的 v3 架构中，**场景 (Scene)** 的核心定位被进一步聚焦和强化。它首先是 **Agent 运行时实例的宿主环境和生命周期管理者**，其次才是可选的宏观流程编排器。

**核心定位**:

1.  **Agent 宿主与生命周期管理者 (Agent Host & Lifecycle Manager)**: **这是场景的首要核心职责**。场景实例负责根据其定义孵化、激活、运行、暂停、恢复和终止其内部声明的 Agent 实例。
2.  **Agent 运行时上下文提供者 (Agent Runtime Context Provider)**: 场景为其内部的 Agent 实例提供运行所必需的隔离环境，包括：
    *   专属的**世界状态 (`WorldState`)** 实例的访问接口。
    *   专属的**事件总线 (`EventBus`)** 通道的访问接口。
    *   与其他场景内组件（如其他 Agent、应用面板）的交互协调机制。
3.  **可选的宏观流程编排器 (Optional Macro-Orchestrator)**: 场景**可以**扮演一个更高层级的流程“导演”。通过其内置的状态机功能（`states`, `transitions`）和生命周期工作流，场景能够实现对应用宏观流程的引导，但这应与内部 Agent 的自主决策协同工作，而非取代它。

场景定义文件（`scene.json`）是静态的、声明式的数据定义，由后端的 **`SceneManager` 服务** 负责加载、解释、维护其实例状态，并根据定义进行编排、调度以及管理其内部 Agent 的生命周期。

## 2. 为什么需要场景？

在 Agent 架构下，引入独立的 `Scene` 层具有以下关键优势：

- **关注点分离 (Separation of Concerns)**:
  - `Scene`: **定义 Agent 的运行环境和生命周期**，并可选地编排宏观流程。
  - `Agent Profile`: 定义 Agent 的静态蓝图（核心审议逻辑、技能、知识等）。
  - `AgentRuntime`: 驱动单个 Agent 实例的动态行为。
  - `Workflow`: 定义具体“如何做”的可执行单元，可被场景或 Agent 调用。
- **Agent 的环境与管理 (Agent Environment & Management)**:
  - 提供一个隔离的、包含必要上下文（世界状态、事件通道）的环境供 Agent 实例运行。
  - 统一管理场景内多个 Agent 实例的创建、销毁等生命周期。
  - 允许场景对 Agent 的初始状态和高阶目标进行特定配置。
- **协同与解耦 (Coordination & Decoupling)**:
  - 通过共享 `WorldState` 和场景级 `EventBus`，实现 Agent 之间以及 Agent 与环境之间的间接、解耦交互。
  - Agent 的自主决策与场景的宏观流程控制可以有效协同。
- **提升创作体验 (Authoring Experience)**:
  - 提供一个清晰的结构来组织和配置一个包含多个 Agent 的复杂、动态的应用。

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
      "panel_id": "string", // (必需) 引用在 project.json 中声明的面板的唯一 ID
      "instance_name": "string", // (可选) 如果同一面板在此场景中有多个实例，用于区分
      "default_bindings": {} // (可选) 为此面板实例提供特定的配置或与场景内元素（如Agent）的初始绑定关系
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
  "start_state": "string", // (可选) 当场景扮演宏观编排角色时，其状态机的初始状态 ID
  "variables": {}, // (可选) 场景级的变量，用于场景自身的状态机逻辑
  "states": [], // (可选) 场景的状态定义列表，用于实现宏观流程控制
  "scheduled_tasks": [], // (可选) 场景级的定时任务

  "custom_metadata": {} // (可选) 其他用户自定义元数据
}

**核心字段解释 (新增或重点调整的):**

- **`agent_instances`**: **核心字段**。声明了场景启动时需要实例化的所有 Agent。
    - `instance_id`: Agent 在场景内的唯一 ID，用于事件路由、状态访问等。
    - `profile_id`: 指向 `agent_profile.json`。
    - `initial_private_state_override`: 允许场景为 Agent 实例定制初始内部状态。
    - `initial_goals_override_reference`: 允许场景为 Agent 设定特定的初始高阶目标。
- **`initial_world_state`**: 定义 Agent 共享的初始环境信息。
- **`event_bus_config`**: 配置 Agent 之间以及与环境进行异步通信的事件通道。
- **`scene_lifecycle_workflows`**: 允许场景在启动、结束等关键节点执行宏观逻辑，如初始化环境、清理资源等，这些逻辑不适合由单个 Agent 完成。
- **可选的状态机元素 (`start_state`, `states`, etc.)**: 这些字段维持了场景作为宏观流程编排器的能力。其逻辑应与 Agent 的自主行为协同，而非替代它。例如，场景状态的转换可由 Agent 发布的事件触发。

## 4. 场景在架构中的位置与交互模型

场景实例 (`SceneInstance`) 是 Agent 实例 (`AgentRuntime`) 的直接容器和管理者。交互模型遵循 `agent_architecture_v3_consolidated.md` 中定义的架构图。

**核心交互流程**:

1.  **场景实例化**: 后端的 **`SceneManager`** 服务根据 `scene.json` 定义创建一个 `SceneInstance`。
2.  **Agent 实例化**: `SceneInstance` 遍历其 `agent_instances` 定义，为每个条目创建一个对应的 `AgentRuntime` 实例。
    *   `AgentRuntime` 加载 `agent_profile.json`，并根据场景的覆盖配置初始化 Agent 的 `PrivateState` 和目标。
3.  **运行支撑与上下文提供**:
    *   `SceneInstance` 为其托管的所有 `AgentRuntime` 提供对共享的 `WorldState` 实例和 `EventBus` 通道的访问权。
    *   `AgentRuntime` 驱动 Agent 的核心审议工作流（通过 `ExecutionEngine` 执行），并为其提供必要的运行时上下文（`PrivateState`, `WorldState`, `IncomingEvents` 等）。
    *   `AgentRuntime` 负责解析 Agent 的决策，并执行相应的动作（如调用技能、使用工具、发布事件、更新状态）。
4.  **协同工作**:
    *   **Agent 自主行为**: Agent 的核心行为由其自身的审议循环驱动。
    *   **场景宏观编排 (可选)**: 场景可以通过其生命周期工作流或状态机逻辑，发布全局事件来影响 Agent，或根据 Agent 的行为来转换场景的宏观状态。**场景的编排应与 Agent 的自主性协同，而非取代它。**
5.  **生命周期管理**: `SceneInstance` 全权负责控制其内部所有 `AgentRuntime` 的暂停、恢复和终止。

## 5. 存储、格式与创作体验

- **位置**: 推荐存放在项目级的 `/scenes/` 目录下。
- **格式**: 统一使用 **JSON** 格式，以匹配平台其他核心定义文件（如工作流、Agent Profile），便于机器读写、校验和工具链整合。
- **创作模式**:
    - **基础**: 通过结构化文本编辑器（如 VSCode）编辑 `scene.json`，并由平台提供 Schema 以支持校验和智能提示。
    - **未来**: 开发一个可视化的场景编辑器，作为 `scene.json` 的图形化前端。该编辑器将允许创作者通过拖拽和配置来添加 Agent 实例、设置世界状态、构建场景状态机等。

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

- **RPG 游戏场景**:
    - 场景定义了 GM Agent、多个 NPC Agent、以及代表玩家的 Player Proxy Agent。
    - `initial_world_state` 设置地图的初始状态、时间、关键物品等。
    - Agent 之间主要通过场景的事件总线进行交互（如对话、战斗行动宣告），并通过修改共享的 `WorldState` 来影响游戏环境。
    - 场景的生命周期工作流可用于触发全局剧情事件或管理游戏章节的推进。
- **多 Agent 协作研究任务**:
    - 场景定义一个“研究员 Agent”（负责信息收集）、一个“分析师 Agent”（负责数据处理）和一个“报告员 Agent”（负责总结呈现）。
    - 场景通过其 `WorldState` 维护一个共享的“任务板”，并通过事件总线在 Agent 之间传递任务状态更新。

## 7. 总结

在对齐 v3 Agent 架构后，场景 (`Scene`) 的核心职责得到了进一步的明确和强化。它**首先是 Agent 运行时实例的宿主环境和生命周期管理者**，其次才是可选的宏观流程编排器。场景通过其定义文件 (`scene.json`) 声明需要激活的 Agent 实例及其初始配置，并为其提供运行所需的、隔离的上下文（世界状态、事件通道）。`SceneManager` 服务在加载场景时，会负责创建和管理这些 Agent 实例的完整生命周期，同时场景自身仍可扮演宏观“导演”的角色，与内部 Agent 的自主行为协同工作，共同实现复杂、动态的 AI 应用。
