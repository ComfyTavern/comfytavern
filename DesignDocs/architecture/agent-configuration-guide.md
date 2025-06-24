# **ComfyTavern Agent 配置与运行时交互指南**

## 1. 引言

本指南详细说明了在 ComfyTavern 平台中配置和定义一个 Agent 所需的全部步骤和文件格式，并深入阐述了 Agent 在运行时如何协同工作，特别是以 GM Agent 为核心的交互模型。

Agent 的配置体系被设计为两个清晰的层次：

1.  **静态定义 (Agent Profile)**：这是 Agent 的“蓝图”或“模板”，以 `agent_profile.json` 文件的形式存在。它定义了一个特定类型 Agent 的所有固有特征、核心逻辑、能力和初始设置。这些定义是项目（Project）的核心资产。
2.  **运行时实例化 (Scene Instantiation)**：这是将 Agent 的“蓝图”变为一个“活的”实例的过程。在场景定义（`scene.json`）中，您可以引用一个或多个 Agent Profile，并为它们在特定场景中的实例提供独特的初始状态或目标，从而将它们激活到运行环境中。

理解这两个层次的分离，以及它们在运行时如何动态交互，是高效创建和管理 ComfyTavern 中复杂 AI 行为的关键。

---

## 2. Agent Profile (`agent_profile.json`) - 静态蓝图

Agent Profile 是 Agent 的核心静态定义文件。它不包含 Agent 运行时的易变状态，而是描述了一个特定类型 Agent 的所有固有特征、能力、初始设置和行为模式。

### 2.1. `agent_profile.json` 概念性 Schema

```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "version": "string",
  "schema_version": "string",

  "core_deliberation_workflow_id": "string",

  "initial_private_state_schema": {
    "type": "object",
    "properties": {}
  },
  "initial_private_state_values": {},

  "knowledge_base_references": [
    {
      "source_id": "string",
      "alias": "string",
      "access_permissions": ["read", "write_suggestions"]
    }
  ],

  "subscribed_event_types": [
    "string"
  ],

  "skill_workflow_ids_inventory": [
    "string"
  ],

  "tool_ids_inventory": [
    "string"
  ],

  "initial_goals_reference": [
    {
      "caiu_id": "string",
      "kb_alias_or_id": "string",
      "activation_priority": "number"
    }
  ],

  "custom_metadata": {}
}
```

### 2.2. 字段详解

-   **`id`** (string, 必需): Agent Profile 的全局唯一标识符 (例如, `"comfytavern_gm_elara_v1"`)。用于在项目中或跨项目引用。
-   **`name`** (string, 必需): 用户可读的 Agent 名称 (例如, `"GM Elara - Storyteller"`)。
-   **`description`** (string, 可选): 对该 Agent 类型或角色的详细描述。
-   **`version`** (string, 必需): Agent Profile 的版本号 (例如, `"1.0.0"`), 遵循语义化版本规范。
-   **`schema_version`** (string, 必需): `agent_profile.json` 本身 Schema 的版本号 (例如, `"1.0"`)。
-   **`core_deliberation_workflow_id`** (string, 必需): **核心字段**。指向承载此 Agent 核心“审议循环”（思考与决策）的 ComfyTavern 工作流定义文件的 ID 或相对路径。
-   **`initial_private_state_schema`** (object, 可选): 定义此 Agent 私有状态 (`PrivateState`) 的 JSON Schema。用于校验和编辑器辅助。
-   **`initial_private_state_values`** (object, 可选): Agent 实例初始化时的私有状态默认值。
-   **`knowledge_base_references`** (array, 可选): Agent 可访问的知识库列表。
    -   `source_id`: 知识库的唯一 ID。
    -   `alias`: (可选) Agent 内部用于引用此知识库的别名。
    -   `access_permissions`: (可选) Agent 对此知识库的权限 (例如, `"read"`, `"write_caiu"`)，默认只读。
-   **`subscribed_event_types`** (array, 可选): Agent 默认订阅的事件总线事件类型。这些事件会作为输入送入其审议循环。
-   **`skill_workflow_ids_inventory`** (array, 可选): 此 Agent 类型拥有的“技能工作流”的 ID 或相对路径列表。这些是 Agent 在其审议循环中可以决策调用的能力。
-   **`tool_ids_inventory`** (array, 可选): 此 Agent 类型可使用的“原子工具”的标识符列表。这些是更底层的、通常由后端提供的功能。
-   **`initial_goals_reference`** (array, 可选): Agent 初始化时的默认目标列表。
    -   `caiu_id`: 指向知识库中一个定义了具体目标的 CAIU 条目的 ID。
    -   `kb_alias_or_id`: (可选) 目标 CAIU 所在的知识库别名或 ID。
    -   `activation_priority`: (可选) 此初始目标的激活优先级。
-   **`custom_metadata`** (object, 可选): 用于存储其他用户自定义的、与此 Agent Profile 相关的元数据。

---

## 3. 项目级配置 (`project.json`)

每个 Agent Profile 都必须在项目的核心配置文件 `project.json` 中进行声明，以便项目能够识别和管理它们。

### 3.1. `project.json` 中的 `agent_profiles` 声明

在 `project.json` 中，通过 `agent_profiles` 数组来声明项目中定义的所有 Agent Profile。

```json
{
  "id": "uuid",
  "name": "My Awesome RPG Project",
  "version": "1.0.0",
  "schemaVersion": "2.1",

  "agent_profiles": [
    {
      "id": "comfytavern_advanced_npc_v1.2",
      "path": "agent_profiles/npc_herbalist_profile.json",
      "name": "Elara the Herbalist - Profile",
      "description": "Defines Elara, a knowledgeable and slightly grumpy herbalist NPC."
    },
    {
      "id": "comfytavern_gm_storyteller_v1.0",
      "path": "agent_profiles/gm_storyteller_profile.json",
      "name": "Main Storyteller GM - Profile"
    }
  ],

  "knowledgeBaseReferences": [
    // ... 其他知识库引用
  ]
}
```

-   **`agent_profiles`** (array): 每个对象描述一个 Agent Profile。
    -   `id`: Agent Profile 的唯一 ID，必须与对应文件内的 `id` 一致。
    -   `path`: 相对于项目根目录的 Agent Profile 文件路径。
    -   `name`: (可选) 用户可读的 Profile 名称。
    -   `description`: (可选) Profile 的简要描述。

---

## 4. 场景级配置 (`scene.json`)

场景定义（`scene.json`）负责将静态的 Agent Profile 实例化为在特定环境中运行的动态 Agent 实例。

### 4.1. `scene.json` 中的 `agent_instances` 声明

在 `scene.json` 中，通过 `agent_instances` 数组来声明此场景需要激活的 Agent 实例。

```json
{
  "id": "scene_forest_outskirts_encounter_v1",
  "name": "Forest Outskirts Encounter",

  "agent_instances": [
    {
      "instance_id": "elara_the_herbalist_instance_1",
      "profile_id": "comfytavern_advanced_npc_v1.2",
      "initial_private_state_override": {
        "mood": "curious"
      },
      "initial_goals_override_reference": [
        {
          "caiu_id": "goal_elara_warn_player_about_woods",
          "activation_priority": 0.9
        }
      ]
    },
    {
      "instance_id": "main_storyteller_gm",
      "profile_id": "comfytavern_gm_storyteller_v1.0"
    }
  ],

  "initial_world_state": {
    // ... 场景的初始世界状态
  },

  "scene_lifecycle_workflows": {
    "on_scene_start": "workflows/scene_init/forest_outskirts_setup.json"
  }
}
```

-   **`agent_instances`** (array, 必需): 每个对象描述一个要在此场景中激活的 Agent 实例。
    -   `instance_id`: 在此场景实例中该 Agent 实例的唯一 ID (例如, `"gm_main_storyteller"`)。
    -   `profile_id`: (必需) 引用项目中的 Agent Profile 定义的 ID (`agent_profile.json` 中的 `id`)。
    -   `initial_private_state_override`: (可选) 覆盖 Agent Profile 中定义的 `initial_private_state_values`。允许同一 Agent Profile 在不同场景下有不同的初始状态。
    -   `initial_goals_override_reference`: (可选) 覆盖或添加 Agent Profile 中定义的 `initial_goals_reference`。
    -   `custom_runtime_config`: (可选) 针对此 Agent 实例的特定运行时配置（例如，资源限制、审议频率等）。

---

## 5. 完整配置示例

### 5.1. 示例 `agent_profile.json`

这是一个高级 NPC Agent 的完整 Profile 示例。

```json
{
  "id": "comfytavern_advanced_npc_v1.2",
  "name": "Advanced NPC - Elara the Herbalist",
  "description": "An advanced NPC Agent profile for Elara, a knowledgeable and somewhat grumpy herbalist. She can provide information, trade goods, and offer quests based on her knowledge and the world state.",
  "version": "1.2.0",
  "schema_version": "1.0",

  "core_deliberation_workflow_id": "workflows/core_npc_deliberation_v1.json",

  "initial_private_state_schema": {
    "type": "object",
    "properties": {
      "mood": {
        "type": "string",
        "enum": ["neutral", "friendly", "annoyed", "curious"],
        "description": "Current emotional state, influences dialogue and willingness to help."
      },
      "player_reputation": {
        "type": "integer",
        "default": 0,
        "description": "Reputation spécifique avec le joueur actuel."
      },
      "active_personal_quests": {
        "type": "array",
        "items": { "type": "string" }
      }
    },
    "required": ["mood", "player_reputation"]
  },
  "initial_private_state_values": {
    "mood": "neutral",
    "player_reputation": 10,
    "active_personal_quests": ["elara_find_rare_herb_quest"]
  },

  "knowledge_base_references": [
    {
      "source_id": "kb_world_flora_fauna_v2",
      "alias": "naturalWorld",
      "access_permissions": ["read"]
    },
    {
      "source_id": "kb_elara_personal_journal_v1",
      "alias": "myJournal",
      "access_permissions": ["read", "write_caiu"]
    }
  ],

  "subscribed_event_types": [
    "player.action.speak_to_elara",
    "world.time.day_night_changed"
  ],

  "skill_workflow_ids_inventory": [
    "workflows/skills/npc_greet_player_skill.json",
    "workflows/skills/npc_offer_trade_skill.json",
    "workflows/skills/npc_reflect_on_day_skill.json"
  ],

  "tool_ids_inventory": [
    "ReadPrivateStateTool",
    "UpdatePrivateStateTool",
    "QueryKnowledgeBaseTool",
    "WriteToKnowledgeBaseTool",
    "PublishEventTool",
    "ReadWorldStateTool",
    "RequestUserInteractionTool"
  ],

  "initial_goals_reference": [
    {
      "caiu_id": "goal_elara_maintain_herb_shop",
      "kb_alias_or_id": "myJournal",
      "activation_priority": 0.8
    }
  ],

  "custom_metadata": {
    "author": "ComfyTavern World Smiths",
    "tags": ["npc", "herbalist", "quest_giver", "trader"]
  }
}
```

### 5.2. 示例 `scene.json`

这是一个场景定义的示例，它实例化了上面定义的 Elara Agent 和一个 GM Agent。

```json
{
  "id": "scene_forest_outskirts_encounter_v1",
  "name": "Forest Outskirts Encounter",
  "description": "A dynamic encounter scene at the edge of the Whispering Woods, featuring Elara the Herbalist.",
  "version": "1.0.0",
  "schema_version": "1.0",

  "agent_instances": [
    {
      "instance_id": "elara_the_herbalist_instance_1",
      "profile_id": "comfytavern_advanced_npc_v1.2",
      "initial_private_state_override": {
        "mood": "curious",
        "player_reputation": 5
      },
      "initial_goals_override_reference": [
        {
          "caiu_id": "goal_elara_warn_player_about_woods",
          "kb_alias_or_id": "myJournal",
          "activation_priority": 0.9
        }
      ],
      "custom_runtime_config": {
        "deliberation_frequency_hz": 0.5
      }
    },
    {
      "instance_id": "main_storyteller_gm",
      "profile_id": "comfytavern_gm_storyteller_v1.0",
      "custom_runtime_config": {
        "deliberation_frequency_hz": 1.0
      }
    }
  ],

  "initial_world_state": {
    "time_of_day": "afternoon",
    "weather": "clear_sky",
    "scene_flags": {
      "player_has_entered_woods": false,
      "elara_has_given_warning": false
    }
  },

  "scene_lifecycle_workflows": {
    "on_scene_start": "workflows/scene_init/forest_outskirts_setup.json"
  }
}
```

---

## 6. 运行时交互模型与流程图

理解了如何静态配置 Agent 后，理解它们在运行时如何交互至关重要。本节将介绍基于“动态地下城主 (Dynamic Dungeon Master)”模型的推荐交互流程。

在此模型中，**GM Agent (说书人)** 不再是仅在关键时刻介入的宏观导演，而是作为玩家在世界中的**主要感官和交互界面**，负责处理玩家的绝大多数行动，并动态生成场景描述和叙事。

### 6.1. 核心交互流程

1.  **玩家行动触发通用事件**: 玩家的任何行动（如“检查一本书”、“与 NPC 对话”、“尝试打开一扇门”）都会向事件总线发布一个通用的、信息丰富的事件，例如 `player.action.interact`。
2.  **GM Agent 作为主要响应者**: GM Agent 会订阅这些通用的玩家行动事件。它会捕获事件，收集完整的上下文（世界状态、玩家状态、任务进度等），然后通过其核心审议工作流（通常涉及 LLM 调用）来决定如何响应。
3.  **流式输出作为核心体验**: GM 的响应通常是**流式的文本描述**，实时地呈现在玩家面前。这使得玩家的等待时间变成了沉浸式的阅读体验，是游戏玩法本身的一部分。
4.  **NPC 的双重激活模式**:
    *   **GM 指导**: 在大多数情况下，与 NPC 的交互由 GM 发起。GM 在描述完场景后，可以决定“轮到 NPC 说话了”，然后发布一个更具体的指令事件（如 `npc.elara.respond_to_player`）来激活 NPC Agent。
    *   **直接激活**: 对于某些特定、无需 GM 叙事介入的快速操作（如在对话中点击“重试”按钮），可以设计一个特定的事件（如 `npc.elara.retry_dialogue`），该事件将**直接**被 NPC Agent 订阅和处理，从而绕过 GM，实现更快的响应。
5.  **异步“杂活”工作流**: 对于需要创造力且耗时的后台任务（如生成一件独特的魔法物品、设计一个新技能），GM 不会等待其完成。它会发布一个“任务请求”事件（如 `world_building.request.generate_item`），由一个独立的、异步的**场景工作流**在后台处理。任务完成后，该工作流会通过另一个事件将结果（如物品数据）写回世界状态，整个过程不阻塞玩家的交互。

### 6.2. 交互模型流程图

下图直观地展示了上述的运行时交互模型：

```mermaid
graph TD
    subgraph "用户端 (Client)"
        A["玩家行动 Player Action
(e.g., '与老巴里对话')"]
        B["特定行动 Specific Action
(e.g., '重试对话')"]
        UI["游戏界面 / UI
流式输出 Streaming Output"]
    end

    subgraph "后端 (Backend) / ComfyTavern 平台"
        EB(("事件总线
Event Bus"))
        GM["GM Agent '说书人'
主要响应者"]
        NPC["NPC Agent '老巴里'
专业配角"]
        AWF["异步'杂活'工作流
后台内容生成"]
      
        subgraph "数据存储 (Data Stores)"
            WS[世界状态 WorldState]
            PS[私有状态 PrivateState]
        end
    end

    %% 流程路径
    A -->|"发布通用事件
e.g., player.action.interact"| EB
    B -->|"发布特定事件
e.g., npc.retry_dialogue"| EB

    EB -->|"通用事件"| GM
    EB -->|"特定事件 (绕过GM)"| NPC
  
    GM -->|"1. 审议 (LLM调用)"| GM
    GM -->|"2. 读取"| WS
    GM -->|"2. 读取"| PS
    GM -->|"3. 流式输出"| UI
    GM -->|"4. (可选)发布指令/任务"| EB

    EB -->|"GM指令事件"| NPC
    EB -->|"后台任务请求"| AWF

    NPC -->|"1. 审议 (LLM调用)"| NPC
    NPC -->|"2. 读取"| WS
    NPC -->|"2. 读取"| PS
    NPC -->|"3. 输出"| UI

    AWF -->|"1. 异步处理 (耗时)"| AWF
    AWF -->|"2. 完成后更新"| WS

    %% 样式 (仅描边)
    classDef agent stroke:#4a90e2,stroke-width:2px;
    classDef workflow stroke:#50e3c2,stroke-width:2px;
    classDef user stroke:#f5a623,stroke-width:2px;
    classDef bus stroke:#9013fe,stroke-width:2px;
    classDef storage stroke:#778ca3,stroke-width:2px;
    class A,B,UI user;
    class GM,NPC agent;
    class AWF workflow;
    class EB bus;
    class WS,PS storage;