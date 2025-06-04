# ComfyTavern 项目与知识库架构规划 v2

## 1. 引言与核心目标

本文档旨在规划 ComfyTavern 的核心项目架构以及全新的情境知识引擎。设计的核心目标是实现高度的模块化、卓越的可扩展性、优秀的用户友好性、清晰的知识管理机制，并为未来的多模态内容和高级AI交互功能打下坚实基础。本文档将取代旧的架构规划，并整合近期讨论的关键设计决策。

## 2. 核心概念定义

### 2.1. 工程项目 (Project)
- **定位**: 应用的核心组织与执行单元。
- **目的**: 统一管理项目相关的所有资源（工作流、角色、知识库引用、场景、媒体等），提供清晰的上下文。
- **核心特征**:
    - 每个项目对应一个文件系统中的目录。
    - 包含一个 `project.json` 元数据文件，用于描述项目信息及其依赖。
    - **知识库依赖**: 项目在其 `project.json` 中显式声明其使用的知识库（本地或全局）。

### 2.2. 知识库 (Knowledge Base - KB)
- **定位**: 结构化和情境化知识的存储与管理单元。
- **核心理念**: 基于“精心策划的原子信息单元 (Curated Atomic Info Units - CAIU)”。
    - **CAIU**: 由作者定义的、逻辑完整的知识片段，包含内容和丰富的元数据（标签、类型、关系、触发条件等），力求信息完整不裁切。
        - **向量化支持**: CAIU 可以被向量化以支持语义检索。知识库需要存储或能够关联这些 CAIU 的向量嵌入。
        - **嵌入模型配置与依赖**:
            - 用户应能在其 ComfyTavern 环境中配置可用的嵌入模型。
            - 每个知识库（在其元数据中）应明确记录其向量化所使用的嵌入模型标识（如模型名称、版本或唯一ID）。这对于确保兼容性和可复现性至关重要。
            - 项目级别也可以有默认的嵌入模型配置，但知识库自身的记录优先。
- **内容支持**:
    - **多模态**: 设计上支持文本、图像、音频、视频等。实现上采用 JSON 存储元数据和外部媒体文件引用，配合打包导出/导入机制。

#### 2.2.1. CAIU JSON Schema (概念性)

一个知识库文件（例如 `knowledge.json`）的核心内容将是一个包含多个 CAIU 对象的数组。以下是单个 CAIU 的概念性 JSON Schema：

```json
{
  "id": "caiu_unique_identifier_uuid", // 知识库内唯一ID
  "version": 1, // CAIU自身版本，便于未来升级结构
  "entry_type": "lore_detail", // 条目类型: e.g., "fact", "dialogue_snippet", "character_trait", "lore_detail", "image_description", "audio_cue", "instruction"
  "displayName": "Optional User-Friendly Name", // 用户可读的显示名称

  "content": { // 核心内容单元
    "mime_type": "text/plain", // 内容的MIME类型, e.g., "text/plain", "text/markdown", "image/png", "audio/mpeg", "application/json+comfytavern-variable-definition"
    "value": "The actual textual content. For non-text, this might be a description or title.", // 文本内容，或对非文本内容的描述
    "path": null, // (可选) 指向外部媒体文件的相对路径 (e.g., "media/image_of_dragon.png")
    "url": null, // (可选) 指向外部媒体文件的URL (如果允许远程资源)
    "alt_text": null, // (可选) 图像的替代文本
    "caption": null, // (可选) 媒体的标题
    "metadata": {} // (可选) 特定于此内容块的额外元数据, e.g., for image: { "width": 1024, "height": 768 }
  },

  "activation_criteria": { // 条目激活条件
    "keywords": ["dragon", "red scales"], // 关键词列表
    "key_groups": [ // 更复杂的关键词组合逻辑 (可选)
      { "group_id": "dragon_appearance", "keys": ["dragon", "scales"], "logic": "AND" },
      { "group_id": "dragon_location", "keys": ["cave", "mountain"], "logic": "OR" }
    ],
    "use_semantic_search": true, // 是否对该条目启用向量/语义搜索 (如果KB已向量化)
    "semantic_threshold": 0.75, // (可选) 语义搜索的相似度阈值
    "trigger_conditions": [ // (可选) 更复杂的脚本化或规则化触发条件
      // e.g., { "type": "variable_check", "variable": "is_night", "operator": "equals", "value": true }
    ],
    "trigger_probability": 1.0 // (0.0 to 1.0) 激活概率
  },

  "usage_metadata": { // 条目使用时的元数据
    "priority": 100, // 插入优先级 (数字越大/越小越优先，需统一约定)
    "placement": "before_prompt", // 插入位置: "before_prompt", "after_prompt", "system_context", "scratchpad_notes"
    "token_budget_impact": null, // (可选) 预估或实际的token消耗，或标记为"critical" (必须包含)
    "once_per_session": false, // 是否仅在会话中激活一次
    "exclude_from_history": false, // 是否在注入后从后续的聊天历史中排除此条目内容（用于一次性指令等）
    "prefix": { // (可选) 内容前缀设置
      "text": "", // 前缀文本
      "is_enabled": false // 是否启用此前缀
    },
    "suffix": { // (可选) 内容后缀设置
      "text": "", // 后缀文本
      "is_enabled": false // 是否启用此后缀
    }
  },

  "management_metadata": { // 管理性元数据
    "tags": ["fantasy", "creature", "world_building"], // 标签，用于组织、过滤，并可结合工作流上下文实现动态知识筛选（如不同视角、角色认知差异等）。
    "source": "manual_entry", // 来源: "manual_entry", "agent_generated", "st_import_v1", "rag_chunk_id_xyz" (agent_generated: 由AI Agent在运行过程中自主创建或更新)
    "created_at": "iso_timestamp",
    "updated_at": "iso_timestamp",
    "author_notes": "This entry describes the ancient red dragon of Mount Cinder.", // 作者备注
    "editor_description": "", // (可选) 仅在编辑器中显示的简短描述，不参与注入
    "is_enabled": true, // 是否启用此条目
    "child_ids": [], // (可选) 指向子CAIU的ID列表，用于实现层级结构或分组
    "related_ids": ["caiu_id_abc", "caiu_id_def"] // (可选) 指向相关CAIU的ID列表 (非层级关系)
  },

  "variable_handling": { // (可选) 与变量相关的定义
    "defines_variables": { // 此条目定义了哪些变量
      // "dragon_name": "Ignis",
      // "dragon_age": 1200
    },
    "uses_variables_in_content": ["location_name", "current_year"] // 内容中使用了哪些变量占位符
  },

  "extensions": { // (可选) 用于未来扩展或特定插件的数据
    // "my_plugin_data": { ... }
  }
}
```

**关于“组CAIU”的 `content` 字段处理说明：**

对于主要功能是作为“组容器”的 CAIU 条目（例如，其 `entry_type` 可能被定义为 `"group_container"`，或者它通过 `child_ids` 组织子条目并使用自身的 `prefix` / `suffix` 进行包裹），其 `content` 字段（特指 `content.value` 或 `content.path`）通常**不用于**直接注入到最终的AI上下文中。

这类“组CAIU”条目应依赖其 `prefix`、`suffix` 以及其包含的子条目（`child_ids`）的聚合内容来构成注入信息。其自身的 `content` 字段在数据层面可以保持为空（`null` 或空字符串）。

对于此类组条目在编辑器中所需的任何描述性文本，应优先使用 `displayName` 字段或新增的 `editor_description` 字段（见 `management_metadata`）。强烈建议用户界面（UI）在编辑“组CAIU”时，将通常用于 `content` 编辑的区域重新利用，以更直观地显示和管理其子条目列表。

#### 2.2.2. 知识库文件结构 (概念性)

上一节定义了知识库中单个“原子信息单元”（CAIU）的详细结构。一个完整的知识库文件（例如，以 `.json` 或未来可能的 `.ckb` 为后缀）则会将这些 CAIU 条目组织起来，并包含整个知识库级别的元数据。

以下是一个知识库文件的顶层结构概念性示例：

```json
{
  "kb_id": "kb_unique_identifier_uuid", // 知识库的全局唯一ID
  "kb_version": "1.0.0", // 知识库内容的版本 (例如 "1.0.0", "1.1.0")
  "schema_version": "1.0", // 此知识库文件结构本身的模式版本
  "kb_displayName": "My Awesome World Lore", // 用户可读的知识库名称
  "kb_description": "A comprehensive collection of lore for the vibrant world of Eldoria.", // (可选) 知识库的描述
  "embedding_model_id": "text-embedding-ada-002", // (可选) 用于此知识库中条目向量化的嵌入模型标识
  "created_at": "iso_timestamp", // 创建时间
  "updated_at": "iso_timestamp", // 最后更新时间
  "tags": ["lore", "fantasy", "world_building", "Eldoria"], // (可选) 知识库本身的标签
  "author": "Optional: Author of the KB", // (可选) 知识库作者信息
  "entries": [
    // 此处为 CAIU 对象的数组，每个对象遵循 2.2.1 节中定义的 Schema
    // {
    //   "id": "caiu_001",
    //   "entry_type": "character_bio",
    //   ... // 其他 CAIU 字段
    // },
    // {
    //   "id": "caiu_002",
    //   "entry_type": "location_description",
    //   ... // 其他 CAIU 字段
    // }
  ],
  "kb_extensions": {
    // (可选) 知识库级别的扩展数据
  }
}
```

**主要顶层字段说明:**

*   `kb_id`: 知识库的唯一标识。
*   `kb_version`: 知识库内容的版本号，方便跟踪修订。
*   `schema_version`: 知识库文件格式的版本号，用于未来可能的格式升级。
*   `kb_displayName`, `kb_description`: 用户友好的名称和描述。
*   `embedding_model_id`: 若知识库包含向量化内容，则指明所使用的嵌入模型。
*   `entries`: 包含所有 CAIU 对象的数组。
*   `tags`, `author`, `created_at`, `updated_at`, `kb_extensions`: 其他管理性和扩展性元数据。

通过这种方式，我们可以清晰地区分知识库的整体描述信息和其包含的各个具体知识条目的详细信息。

#### 2.2.3. Agent 与知识库的动态交互

除了用户通过编辑器手动管理知识库内容以及通过工具导入外部知识源外，ComfyTavern 的一个核心设计理念是使 AI Agent 能够动态地与其知识库进行交互，不仅作为知识的消费者，也作为知识的创造者和维护者。

- **Agent 作为知识贡献者**: AI Agent 在运行过程中，可以根据新的信息、交互结果或内部推理，自主决定创建新的 CAIU 条目、更新现有条目或标记过时条目。
- **标准化的工具接口**: 为了实现这一点，Agent 将通过一套标准化的工具接口（可称为“Agent 能力接口”或“Agent 工具集”）来操作知识库。这些工具封装了与知识库文件（本地或全局）的交互逻辑。
- **结构化与一致性**: 这些工具将确保 Agent 提交的数据符合 CAIU 的 JSON Schema，并能自动处理部分元数据（例如，将 `source` 标记为 `"agent_generated"`，自动记录时间戳、管理版本等），从而维护知识库的结构化和一致性。
- **主动交互**: 这种交互通常由 Agent 在其“思考”或决策逻辑中主动发起，是对工作流驱动的知识检索和应用的补充与扩展，赋予了 Agent 更高的自主性和适应性。
- **后续设计**: 具体的工具定义（如用于 CAIU 创建、读取、更新、删除的工具）、调用协议以及相关的权限管理机制，将在后续的专门设计文档中进行详细规划。

- **类型**:
    - **全局/共享知识库**: 独立于任何特定项目，可被多个项目引用。有统一的发现和管理机制。
    - **项目本地知识库**: 存储在特定项目目录下，仅供该项目使用。
- **存储格式**:
    - 核心数据结构为 JSON。
    - 文件后缀建议初期使用 `.json` (内部通过 schema 识别)，或未来可选自定义后缀如 `.ckb` (Comfy Knowledge Base)。
    - 包含媒体文件时，知识库由一个元数据文件 (如 `knowledge.json`) 和一个 `media/` 子目录组成，可打包为 `.zip` 或 `.ctkbz` 分享。
    - 向量化知识库可能还需要包含或引用向量索引文件。
- **分享与导入策略 (针对向量化数据)**:
    - **分享时**: 创作者在分享知识库时，可以选择：
        - **包含预计算的向量数据**: 适用于接收方拥有兼容嵌入模型的情况。
        - **仅分享原文和元数据 (不含向量)**: 接收方导入后，需要使用其本地配置的嵌入模型重新生成向量。
    - **导入时**: 系统应检查导入的知识库是否包含向量数据及其关联的嵌入模型标识。
        - 如果模型兼容，可直接使用。
        - 如果模型不兼容或缺失向量数据，系统应提示用户选择一个本地配置的嵌入模型进行重新向量化。

### 2.3. 工作流 (Workflow)
- **定位**: 定义AI交互逻辑、数据处理流程和节点执行顺序的核心机制。
- **核心特征**:
    - 基于节点化设计，用户通过连接不同功能的节点来构建流程。
    - **知识库使用**: 工作流中的特定节点（如“知识源节点”）通过读取当前项目的 `project.json` 配置来加载和使用声明的知识库。

### 2.4. 核心节点与资源类型

#### 2.4.1. 资源类型
- **角色卡 (Character)**: 定义AI角色的配置。
- **场景/剧本 (Scene)**: 定义互动叙事的结构。
- **自定义UI (Custom UI)**: 用户自定义的前端界面。
- **脚本 (Script)**: 用户自定义的逻辑扩展。
- **媒体资源 (Assets)**: 项目中直接使用的、非知识库管理的媒体文件。
- (更多类型待定义)

#### 2.4.2. 关键节点概念 (示例)
- **知识源与检索节点**:
  - `Static Knowledge Base Node`: 加载静态定义的知识库条目。
  - `Keyword Matcher Node`: 基于关键词匹配激活知识条目。
  - `Embedding Generation Node`: 为输入数据（文本、图片等）生成向量嵌入。
  - `Vector Search Node` / `Semantic Retriever Node`: 在知识库中执行基于向量相似度的搜索。
  - `Hybrid Search Node`: 结合关键词和向量搜索策略。
  - `RAG Source Node`: 实现检索增强生成流程，可能内部组合了嵌入生成和向量搜索。
- **知识处理与应用节点**:
  - `Context Assembler Node`: 汇总来自不同源的知识片段并整理成最终上下文。
  - `Variable Applicator Node`: 将变量应用于文本模板。
  - `Dynamic Regex Applicator Node`: 应用动态生成的正则表达式。
- (更多节点待定义，例如过滤、排序、转换、条件逻辑等)

## 3. 统一项目结构与 `project.json` 详解

### 3.1. 项目目录结构 (建议)
```
/YourProjectName/
├── project.json                # 项目元数据与依赖声明
│
├── workflows/                  # 工作流定义 (.json)
├── characters/                 # 角色卡配置
├── knowledgebases/             # 项目本地知识库 (每个KB一个子目录，内含 .json 和 media/)
├── scenes/                     # 场景/剧本文件
├── ui/                         # 自定义界面文件
├── scripts/                    # 自定义脚本
├── assets/                     # 项目直接使用的媒体资源
└── settings/                   # 项目特定设置 (可选)
```

### 3.2. `project.json` Schema (初步)
```json
{
  "id": "uuid",
  "name": "My Project",
  "description": "Project description.",
  "version": "1.0.0",
  "createdAt": "iso_timestamp",
  "updatedAt": "iso_timestamp",
  "templateUsed": "optional_template_id",
  "preferredView": "editor", // "editor" or "custom"
  "schemaVersion": "2.0", // project.json schema version
  "knowledgeBaseReferences": [ // 项目使用的知识库列表
    {
      "id": "kb_local_char_backstory", // 在项目中唯一的引用ID
      "type": "local", // "local" 或 "global"
      "path": "knowledgebases/character_specific_lore/", // 相对于项目根目录的路径 (仅 type="local" 时)
      "name": "Character Specific Backstory", // 用户可读的名称
      "source_id": null // 若 type="global", 此处为全局KB的唯一ID或路径
    },
    {
      "id": "kb_global_fantasy_world",
      "type": "global",
      "path": null,
      "name": "Generic Fantasy World Setting",
      "source_id": "global_kb_registry_id_001" // 指向全局知识库的标识
    }
  ],
  "customMetadata": {
    // ...
  }
}
```

## 4. 知识库管理与引用机制

### 4.1. 全局/共享知识库
- 需要设计一套机制来注册、发现和管理全局知识库 (例如，用户可以配置一个或多个全局知识库的存储路径)。
- 每个全局知识库应有唯一的标识符。
- 知识库的元数据应包含其向量化状态、**明确的嵌入模型标识（如果已向量化，此为强制性元数据）**，以及其他相关配置信息（如向量维度、索引类型等）。这有助于用户在选择全局知识库时判断其与当前项目或所选嵌入模型的兼容性。

### 4.2. 项目本地知识库
- 直接存储在项目内部的 `knowledgebases/` 目录下。
- 通过相对路径在 `project.json` 中引用。

### 4.3. 工作流中知识库的加载与使用
- **知识源节点 (例如 "Static Knowledge Base Node", "RAG Source Node")**:
    - **配置**: 节点配置时，其知识库选择器UI会首先列出当前项目 `project.json` 中 `knowledgeBaseReferences` 定义的知识库。
    - **浏览全局**: UI提供选项允许用户浏览所有可用的全局知识库。
    - **自动更新项目配置**: 如果用户选择了一个尚未在项目中声明的全局知识库，系统会提示或自动将其添加到 `project.json` 的 `knowledgeBaseReferences` 列表中。
    - 节点内部存储的是 `knowledgeBaseReferences` 中对应条目的 `id`。运行时，通过此 `id` 从项目配置中获取实际的路径或全局标识来加载KB。

## 5. 交互模板 (Interaction Template)
- (概念同旧文档，用于项目初始化，不限制后续发展)

## 6. 节点接口模型 (Node Interface Model)
- (概念同旧文档，关于中心化接口定义与幻影I/O节点，适用于工作流节点设计)

## 7. ST兼容性策略总结
- **ST世界书**: 通过转换工具导入为 ComfyTavern KB 格式 (CAIU结构)。
- **ST预设**: 通过转换工具转换为 ComfyTavern 工作流文件 (.json)。
- **ST角色卡**: 提取核心信息，转换为 ComfyTavern 角色数据结构，由特定节点加载。

## 8. 后续步骤与开放问题
- 详细设计 CAIU 的 JSON Schema (包括多模态引用字段)。
- 详细设计全局知识库的注册与发现机制。
- 详细设计知识库选择器 UI/UX 流程。
- 细化各类资源类型 (Character, Scene等) 的 Schema。
- 详细设计 AI Agent 与知识库交互的工具集（例如 CAIU 创建/更新/删除工具）的接口规范、调用协议以及相应的权限管理机制。
- **向量化与检索相关**:
  - 详细设计 CAIU 向量嵌入的存储和管理方案。
  - **嵌入模型管理**:
      - 规划用户配置嵌入模型（本地、API）的界面与流程。
      - 设计知识库元数据中嵌入模型标识的规范。
      - 详细规划知识库分享时，关于向量数据（是否包含、如何处理不兼容模型）的选项和流程。
      - 设计导入知识库时，处理向量数据（检查兼容性、提示重新生成）的逻辑。
  - 研究并确定向量索引策略 (例如，使用本地库如 Faiss，或集成外部向量数据库服务)。
  - 详细设计 `Vector Search Node` 和 `Hybrid Search Node` 的功能和配置项。
  - 考虑批量嵌入生成与更新流程，以及当知识库内容或嵌入模型变更时的向量数据更新策略。
  - ...