# ComfyTavern 项目架构规划 (v2 - Agent 整合版)

## 1. 引言与核心目标

本文档旨在规划 ComfyTavern 的核心项目架构。设计的核心目标是实现高度的模块化、卓越的可扩展性、优秀的用户友好性，并为未来的高级 AI 交互功能，特别是 Agent 系统的集成，打下坚实基础。项目作为组织和管理所有相关资源的顶层容器，确保了工作流、Agent 定义、知识库、场景等元素的协同工作。

## 2. 核心概念定义

### 2.1. 工程项目 (Project)

- **定位**: 应用的核心组织与执行单元。一个项目封装了构建特定 AI 应用或体验所需的所有组件和配置。
- **目的**: 统一管理项目相关的所有资源，包括工作流定义、Agent Profile 定义、知识库引用、场景定义、媒体文件等，从而为应用的开发、运行和分发提供一个清晰、自包含的上下文。
- **核心特征**:
  - 每个项目在文件系统中对应一个独立的目录。
  - 包含一个核心的 `project.json` 元数据文件，该文件描述了项目的基本信息、版本、依赖关系（如知识库）以及其包含的关键资产（如 Agent Profile）。
  - **知识库依赖**: 项目在其 `project.json` 中显式声明其运行所依赖的知识库（可以是项目本地的，也可以是全局注册的知识库）。这使得项目内部的工作流和 Agent 能够访问到正确的知识源。
  - **Agent Profile 声明**: 项目在其 `project.json` 中显式声明其包含的所有 Agent Profile 定义文件。这使得项目能够管理其专属的 Agent 类型。

### 2.2. 工作流 (Workflow)

- **定位**: 定义 AI 交互逻辑、数据处理流程、节点执行顺序的核心机制。工作流是 ComfyTavern 实现具体功能的基本单元，可以被场景编排逻辑调用，也可以作为 Agent 的核心审议逻辑或其可执行的技能。
- **核心特征**:
  - 基于可视化节点化设计，用户通过在画布上连接不同功能的节点来构建复杂的执行流程。
  - **无状态性**: 单个工作流的执行实例通常被设计为无状态的，其行为由输入参数决定，不依赖于上一次执行的内部状态。状态管理由外部（如 Agent 的 PrivateState 或场景变量）负责。
  - **知识库使用**: 工作流中的特定节点（例如，知识检索节点）通过读取当前项目的 `project.json` 配置，或通过运行时注入的上下文，来加载和使用项目声明的知识库。
  - **可复用性**: 设计良好的工作流可以在不同场景或被不同 Agent 复用。

### 2.3. Agent Profile (核心概念)

- **定位**: Agent 的静态蓝图或配置档案，它详细描述了一个特定类型 Agent 的所有固有特征、能力、初始设置和核心行为模式。Agent Profile 是创作者定义和设计 Agent 的主要方式。
- **存储**: 作为项目层的重要资产，Agent Profile 定义文件（例如 `agent_profile.json`）存储在项目目录中（建议存放在如 `agent_profiles/` 的专用子目录下），并在项目的 `project.json` 文件中进行声明和引用。
- **内容**: 其 Schema 详细定义在 `agent_architecture_v3_consolidated.md` 中，关键内容包括：
    - `id`, `name`, `description`, `version`: Profile 的基本元数据。
    - `core_deliberation_workflow_id`: 指向承载此 Agent 核心思考与决策逻辑的工作流。
    - `initial_private_state_schema` 和 `initial_private_state_values`: 定义 Agent 实例私有状态的结构和初始值。
    - `knowledge_base_references`: 声明 Agent 可访问的知识库及其权限。
    - `subscribed_event_types`: Agent 默认订阅的事件类型。
    - `skill_workflow_ids_inventory`: Agent 掌握的“技能工作流”列表。
    - `tool_ids_inventory`: Agent 可使用的“原子工具”列表。
    - `initial_goals_reference`: Agent 初始化时的默认目标。
- **引用与实例化**: 场景定义 (`scene.json`) 中的 `agent_instances` 数组会通过 `profile_id` 引用项目中的 Agent Profile，从而在场景运行时创建出具体的 Agent 实例。

### 2.4. 核心节点与资源类型

ComfyTavern 项目由多种资源类型和在工作流中使用的节点构成。

#### 2.4.1. 资源类型 (项目内管理)

- **Agent Profile 定义 (`agent_profile.json`)**: 定义 Agent 类型的静态蓝图，是项目的核心资产之一。
- **场景/剧本 (`scene.json`)**: 定义互动叙事的结构、Agent 实例的配置及其宿主环境。
- **工作流定义 (`workflow.json`)**: 定义可执行的逻辑流程，可用于场景编排、Agent 核心审议或 Agent 技能。
- **知识库 (Knowledge Base)**: 项目可以包含本地知识库（目录和 CAIU 文件），并在 `project.json` 中引用它们或全局知识库。
- **自定义 UI (Custom UI / Panel Definition)**: 用户自定义的前端交互界面的规范或实现。
- **脚本 (Script)**: 用户自定义的逻辑扩展，可能用于节点的客户端逻辑或其他自定义功能。
- **媒体资源 (Assets)**: 项目中直接使用的、非知识库管理的媒体文件（如图片、音频、视频）。

#### 2.4.2. 关键节点概念 (在工作流中使用)

这些节点是构建工作流（包括 Agent 的审议工作流和技能工作流）的基础模块：

- **知识源与检索节点**:
  - `StaticKnowledgeBaseNode`: 加载静态定义的知识库条目。
  - `KeywordMatcherNode`: 基于关键词匹配激活知识条目。
  - `EmbeddingGenerationNode`: 为输入数据（文本、图片等）生成向量嵌入。
  - `VectorSearchNode` / `SemanticRetrieverNode`: 在知识库中执行基于向量相似度的搜索。
  - `HybridSearchNode`: 结合关键词和向量搜索策略。
  - `RAGSourceNode`: 实现检索增强生成流程，可能内部组合了嵌入生成和向量搜索。
- **知识处理与应用节点**:
  - `ContextAssemblerNode`: 汇总来自不同源的知识片段（包括解析动态内容引用）并整理成最终上下文，常用于构建 LLM 的 Prompt。
  - `VariableApplicatorNode`: 将变量应用于文本模板。
  - `DynamicRegexApplicatorNode`: 应用动态生成的正则表达式。
- **Agent 专用工具节点 (通常在 Agent 的工作流中被调用，对应 Agent Profile 中声明的 `tool_ids_inventory`)**:
  - `ReadPrivateStateToolNode`: 读取 Agent 自身的私有状态。
  - `UpdatePrivateStateToolNode`: 更新 Agent 自身的私有状态。
  - `QueryKnowledgeBaseToolNode`: 查询 Agent 可访问的知识库。
  - `WriteToKnowledgeBaseToolNode`: 向知识库贡献新的 CAIU（如学习成果、反思记录）。
  - `PublishEventToolNode`: 向场景的事件总线发布事件。
  - `ReadWorldStateToolNode`: 读取当前场景的共享世界状态。
  - `RequestWorldStateUpdateToolNode`: 请求更新当前场景的共享世界状态。
  - `PanelInteractionToolNode`: 触发与应用面板的交互式执行流，用于获取用户输入或向用户展示信息。
- **逻辑控制与实用节点**:
  - 条件分支节点、循环节点、数据转换节点、数学运算节点、文本处理节点等。

## 3. 统一项目结构与 `project.json` 详解

### 3.1. 项目目录结构 (建议)

一个组织良好的项目目录结构有助于管理复杂性并提高协作效率。

```
/YourProjectName/                  # 项目根目录
├── project.json                   # 项目元数据与核心资产声明文件
│
├── agent_profiles/                # 存放 Agent Profile 定义文件 (.json)
│   ├── npc_herbalist_profile.json
│   └── utility_image_gen_agent_profile.json
│
├── workflows/                     # 存放工作流定义文件 (.json)
│   ├── core_deliberation/         # (可选) 存放 Agent 核心审议工作流
│   │   └── generic_npc_deliberation_v1.json
│   ├── skills/                    # (可选) 存放 Agent 技能工作流
│   │   ├── greet_player_skill.json
│   │   └── generate_image_skill.json
│   └── scene_logic/               # (可选) 存放场景生命周期或编排工作流
│       └── initialize_market_scene.json
│
├── knowledgebases/                # 存放项目本地知识库
│   ├── world_lore_kb/
│   │   ├── entries.json
│   │   └── media/
│   └── character_backstories_kb/
│
├── scenes/                        # 存放场景/剧本定义文件 (.json)
│   └── market_square_scene.json
│
├── ui/                            # (可选) 存放自定义界面定义或资源
│   └── custom_dialog_panel.json
│
├── scripts/                       # (可选) 存放自定义脚本文件
│   └── client_side_validation.js
│
├── assets/                        # (可选) 存放项目直接使用的媒体资源 (非KB管理)
│   └── images/
│       └── market_background.png
│
└── settings/                      # (可选) 存放项目特定设置 (如编辑器配置、主题覆盖等)
```

### 3.2. `project.json` Schema (v2.1 - Agent 整合)

`project.json` 是项目的核心描述文件，它定义了项目的基本属性、版本信息，并声明了项目所依赖和包含的关键资产，如 Agent Profile 和知识库。

```json
{
  "id": "uuid", // 项目的全局唯一标识符
  "name": "My Awesome RPG Project", // 用户可读的项目名称
  "description": "An example project showcasing advanced NPC interactions and dynamic storytelling.", // 项目的简要描述
  "version": "1.0.0", // 项目自身版本，遵循语义化版本规范
  "createdAt": "iso_timestamp", // 项目创建时间戳
  "updatedAt": "iso_timestamp", // 项目最后更新时间戳
  "preferredView": "editor", // 用户打开项目时的默认视图, e.g., "editor", "custom_panel_id"
  "schemaVersion": "2.1", // project.json 文件本身的 Schema 版本号

  "agent_profiles": [ // (新增) 声明项目中定义的所有 Agent Profile
    {
      "id": "comfytavern_npc_herbalist_v1.2", // Agent Profile 的唯一 ID (必须与对应文件内的 id 一致)
      "path": "agent_profiles/npc_herbalist_profile.json", // 相对于项目根目录的 Agent Profile 文件路径
      "name": "Elara the Herbalist - Profile", // (可选) 用户可读的 Profile 名称
      "description": "Defines Elara, a knowledgeable and slightly grumpy herbalist NPC." // (可选) Profile 的简要描述
    },
    {
      "id": "comfytavern_util_image_generator_v1.0",
      "path": "agent_profiles/utility_image_gen_agent_profile.json",
      "name": "Image Generation Utility Agent - Profile"
    }
    // ... 可以声明更多 Agent Profile
  ],

  "knowledgeBaseReferences": [ // 声明项目使用的知识库列表
    {
      "source_id": "local_kb_world_lore_main", // 知识库的唯一ID (对于本地KB，通常是其目录名或自定义ID)
      "name": "Main World Lore KB", // 用户可读的知识库显示名称
      "path": "knowledgebases/world_lore_kb" // (可选, 仅对本地KB) 相对于项目根目录的路径
    },
    {
      "source_id": "global_kb_common_fantasy_tropes_v1", // 指向一个全局注册的知识库的ID
      "name": "Common Fantasy Tropes (Global)"
    }
    // ... 可以引用更多知识库
  ],

  "default_scene_id": "market_square_scene", // (可选) 项目启动时默认加载的场景 ID

  "customMetadata": { // (可选) 开放的 JSON 对象，用于存储项目相关的其他自定义元数据
    "author": "ComfyTavern Team",
    "tags": ["rpg", "storytelling", "npc_interaction"],
    "target_platform_version": "1.2.x"
  }
}
```

**关键字段解释**:

- **`agent_profiles`**: 核心新增字段。这是一个对象数组，每个对象描述一个项目中定义的 Agent Profile，包括其唯一 `id` (用于在场景中被引用) 和指向其定义文件的 `path`。
- **`knowledgeBaseReferences`**: 声明项目所依赖的知识库。每个条目通过 `source_id` 唯一标识一个知识库。对于项目本地的知识库，可以额外提供 `path`。
- **`default_scene_id`**: (可选) 指定当项目启动时，默认应该加载并运行哪个场景。

## 4. 交互模板 (Interaction Template)

交互模板为用户提供了一个快速启动特定类型项目的起点和脚手架，而非运行时的强制性限制。

- **定位**：作为项目创建的预设配置和资源集合，帮助用户快速搭建具有特定功能或结构的应用原型。
- **目的**：
  - 允许用户基于预设场景快速启动一个项目，例如：“基础聊天机器人”、“带 RAG 的知识问答应用”、“角色扮演游戏框架”、“图像生成面板”等。
  - 提供预设的项目目录结构、示例性的工作流（包括可能的 Agent 审议流和技能流）、默认的 Agent Profile 定义、以及必要的资源引用（如示例知识库、场景）。
  - 降低新用户的学习曲线，通过具体示例展示平台功能和最佳实践。
- **核心特征**:
  - **本质**: 一个遵循标准项目目录结构（如 3.1 节所述）的预打包文件集合。这可以是一个目录模板，或者是一个特定格式的压缩包（例如 `.cttemplate`）。
  - **内容包含 (因 Agent 整合而扩展)**:
    - 一个预配置的 `project.json` 文件，其中可能包含对示例 `agent_profiles` 和 `knowledgeBaseReferences` 的声明。
    - 一个或多个示例性的 `agent_profiles/` 目录及内部的 `agent_profile.json` 文件（例如，一个通用的 NPC Agent Profile，一个简单的工具型 Agent Profile）。
    - 示例性的 `workflows/` 目录，其中可能包含 Agent 的核心审议工作流模板、一些基础技能工作流，以及可能的场景逻辑工作流。
    - (可选) 示例性的项目本地 `knowledgebases/` 目录及内容。
    - (可选) 示例性的 `scenes/` 目录及内部的 `scene.json` 文件，这些场景可能已经预设了对模板中 Agent Profile 的实例化。
    - (可选) 示例性的 `ui/` (应用面板定义) 或 `assets/`。
    - (可选) 一个 `README.md` 文件，说明该模板的用途、包含的内容以及如何基于此模板进行后续开发。
  - **使用流程**: 用户在创建新项目时，可以选择“从模板创建”，然后选择一个可用的交互模板。系统会将模板内容复制或解压到用户指定的新项目目录中。
  - **非约束性**: 一旦项目基于模板创建完成，它就成为一个完全独立的、用户可自由修改的项目。用户可以任意修改、删除、添加工作流、Agent Profile、场景和其他资源。模板仅影响项目的初始状态。
  - **与项目的关系**: 模板是创建项目的“配方”或“蓝图副本”，项目是模板的一个具体实例化和后续发展的成果。

## 5. 节点接口模型 (Node Interface Model)

节点接口模型主要定义了节点组（NodeGroup）这种特殊节点的输入输出接口。当一个工作流被封装为节点组并在另一个父工作流中使用时，这些接口会作为节点组节点上的连接插槽显示。其内部的数据流由节点组引用的子工作流中的特定输入/输出节点处理。

- **接口定义**:
  - 节点组可以定义多个输入和输出接口。每个接口通常具有以下属性：
    - `key`: 在节点组内部唯一的标识符，用于映射到子工作流的IO节点。
    - `displayName`: 在节点组节点上向用户显示的名称。
    - `dataFlowType`: 定义该接口接受或产生的数据类型（例如 `STRING`, `NUMBER`, `IMAGE`, `JSON`, `WILDCARD`, `CONVERTIBLE_ANY` 等）。这影响连接兼容性。
    - `customDescription`: (可选) 对接口用途的详细说明，可在UI中提示用户。
  - 这些接口定义通常存储在节点组节点自身的元数据中，或者通过其引用的子工作流的特定IO节点动态推断。
- **接口管理**:
  - 用户通常可以在节点组的配置界面（例如，在VueFlow前端的侧边栏编辑器 `GroupIOEdit` 组件）中动态管理这些接口，包括添加、删除、重命名、排序和修改类型。
  - 相关的组合式API（如 `useGroupIOActions`, `useGroupIOSlots`, `useGroupIOState`）用于处理这些操作的逻辑和状态。
- **动态插槽与数据流**:
  - 节点组节点在画布上动态渲染其输入输出插槽，这些插槽对应于其定义的接口。
  - 当数据通过连接线流入节点组的输入插槽时，这些数据会传递给其内部子工作流中对应的输入节点。
  - 类似地，子工作流中输出节点产生的数据会通过节点组的输出插槽流出。
  - 对于 `CONVERTIBLE_ANY` 类型的插槽，其具体类型会在连接时根据对方插槽的类型动态确定，这为 Agent 的技能工作流封装提供了灵活性。

虽然此模型主要关注节点组，但其设计原则（清晰的接口定义、动态类型处理）对于设计 Agent 的技能工作流（这些技能也可能被视为可复用的“黑盒”功能块）具有借鉴意义。

## 6. ST (SillyTavern) 兼容性策略总结

为了方便用户迁移和利用现有资源，ComfyTavern 考虑提供对 SillyTavern 预设格式的一定程度的兼容性。

- **ST 预设转换**: 主要策略是通过一个外部或内置的转换工具，将 SillyTavern 的角色卡（通常是 `.json` 或 `.yaml` 格式，包含角色描述、对话示例、性格设定等）转换为 ComfyTavern 的项目资产。
- **转换目标**:
    - **知识库条目 (CAIU)**: 角色描述、背景故事、性格特点等可以转换为知识库中的 CAIU 条目，供 Agent 检索和使用。
    - **Agent Profile (部分)**: 角色的核心设定可以作为创建新 Agent Profile 的初始输入，例如填充 `description`，或作为生成 `initial_private_state_values` (如情绪、个性特征) 的参考。
    - **工作流/场景 (初步)**: 对话示例和场景描述可能启发创建初步的对话技能工作流或简单的交互场景。
- **非直接运行**: 通常不追求直接在 ComfyTavern 中运行未经转换的 SillyTavern 预设文件，而是通过转换工具将其适配到 ComfyTavern 的架构体系中。
- **重点**: 兼容性的重点在于数据的迁移和复用，而非运行时行为的完全模拟，因为两者的核心架构和交互模型存在差异。

## 7. 总结

通过在项目层面引入对 **Agent Profile 定义** 的管理，并相应更新 `project.json` Schema 和建议的目录结构，我们为 ComfyTavern 的 Agent 系统提供了坚实的组织基础。项目现在能够清晰地声明其包含的 Agent 类型，这些 Agent 类型随后可以在场景中被实例化和运行。这确保了 Agent 作为一种核心资产在项目内部得到妥善管理，并与工作流、知识库、场景等其他核心概念紧密集成，共同构成了强大且灵活的 AI 应用开发平台。