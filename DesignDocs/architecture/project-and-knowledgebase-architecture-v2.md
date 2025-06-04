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
            - 项目级别也可以有默认的嵌入模型配置，但知识库自身的记录优先。详细的优先级和回退机制如下：
            -   1.  **知识库级别**: 首先使用知识库元数据中定义的 `embedding_model_id`。
            -   2.  **项目级别**: 若知识库未指定，则查找并使用当前项目 `project.json` 中定义的项目级默认 `embedding_model_id` (如果项目已配置此项)。
            -   3.  **系统/用户默认**: 若项目也未指定，则回退到用户在 ComfyTavern 全局设置中配置的默认嵌入模型。
            -   4.  **无可用模型**: 若上述均未配置或无法找到指定的模型，则与该知识库相关的向量化操作（如生成新嵌入、执行语义搜索）将无法进行，系统应向用户提供明确的提示或错误信息。
- **内容支持**:
    - **多模态**: 设计上支持文本、图像、音频、视频等。实现上采用 JSON 存储元数据和外部媒体文件引用，配合打包导出/导入机制。

#### 2.2.1. CAIU JSON Schema (概念性)

一个知识库文件（例如 `knowledge.json`）的核心内容将是一个包含多个 CAIU 对象的数组。以下是单个 CAIU 的概念性 JSON Schema：

**编辑器集成说明**: 此 Schema 不仅定义了数据的存储结构，也应作为知识库编辑器实现实时校验和智能提示的基础。编辑器在用户创建或修改 CAIU 条目时，应依据此 Schema 对各字段的类型、格式和约束条件进行验证，提供即时反馈，帮助用户创建符合规范的知识条目。

```json
{
  "id": "caiu_unique_identifier_uuid", // 知识库内唯一ID
  "version": 1, // CAIU自身版本，便于未来升级结构
  "entry_type": "lore_detail", // 条目类型: e.g., "fact", "dialogue_snippet", "character_profile_element", "character_trait", "lore_detail", "image_description", "audio_cue", "instruction"
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
    "tags": ["fantasy", "creature", "world_building", "character_data:Elara", "aspect:personality", "@ref"], // 标签，用于组织、过滤，并可结合工作流上下文实现动态知识筛选（如不同视角、角色认知差异等）。其中 "@ref" 等特殊前缀的标签可用于标记此条目为可供动态引用的内容片段。
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

**关于组 CAIU 的 `content` 子字段**：由于组 CAIU 的核心内容由其子条目聚合而成，其 `content` 对象下的 `mime_type`、`alt_text`、`caption`、`metadata` 等子字段通常**不具有直接的运行时注入意义**。如果这些字段存在值，它们更多是作为编辑时的辅助信息或历史数据残留，而不应被内容注入逻辑所依赖。例如，一个组的 `content.mime_type` 可能没有实际用途，因为其最终输出内容的类型是由子条目和包裹方式决定的。

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

#### 2.2.4. CAIU 的动态内容引用

为了增强知识的复用性和灵活性，CAIU 条目支持被动态引用。这意味着一个 CAIU 条目的核心内容可以被嵌入到其他地方，例如另一个 CAIU 的 `content.value`、工作流节点的配置文本、甚至是用户与 AI 交互的输入/输出文本中。

- **目的**:
    - 创建可高度复用的知识片段（例如，一个标准的地点描述、一个常见的角色反应、一段版权声明等）。
    - 构建复杂的、由多个知识片段动态组合而成的文本模板。
    - 允许用户或 Agent 在运行时通过简单的引用标记来调用和填充知识内容，而无需每次都依赖复杂的检索逻辑。

- **机制**:
    - **引用键 (Reference Key)**:
        - 主要使用 CAIU 的 `displayName` ([`DesignDocs/architecture/project-and-knowledgebase-architecture-v2.md:38`](./DesignDocs/architecture/project-and-knowledgebase-architecture-v2.md:38)) 作为动态引用时的键，因其便于人类阅读和编写。
        - **处理同名 `displayName`**:
            - 系统不强制禁止在同一知识库中存在同名 `displayName` 的 CAIU 条目，尽管为了引用的清晰和可预测性，通常建议用户尽量避免或通过命名约定加以区分。
            - 当通过 `displayName` 引用且匹配到多个同名条目时，系统可采取以下策略之一（具体实现和用户可选性待详细设计）：
                1.  **合并加载 (Merge Load)**: 将所有匹配到的同名条目的核心内容进行合并（例如，可以按照它们在知识库中的顺序、优先级元数据或时间戳排序后，用换行符或其他指定分隔符连接）并替换引用标记。
                2.  **情境激活加载 (Contextual Activation Load)**: (此为更高级的选项) 根据这些同名条目各自的 `activation_criteria` ([`DesignDocs/architecture/project-and-knowledgebase-architecture-v2.md:50`](./DesignDocs/architecture/project-and-knowledgebase-architecture-v2.md:50)) 以及当前的上下文（例如，当前对话中的关键词、已激活的其他知识、工作流变量等），动态地、智能地决定加载哪一个或哪些特定条目的内容。这允许同名引用在不同情境下展现出最合适或最相关的信息。
            - **默认行为与配置**: 默认情况下，系统可能会优先尝试“情境激活加载”（如果条目包含有效的 `activation_criteria` 且当前上下文满足其一）。若无明确激活条件、多个条件同时满足且无法区分优先级，或情境激活加载未产生结果，则系统可能回退到“合并加载”。“合并加载”的默认顺序可以是：首先按 CAIU 的 `usage_metadata.priority` 字段（如果已定义且有效），其次按条目在知识库文件中的自然出现顺序。用户配置方面，虽然初期可能仅依赖系统默认行为，但未来可考虑在项目级别或通过扩展引用语法（例如 `{{{DisplayNameKey?strategy=merge&order=priority}}}`）提供更细致的控制选项，但这会增加实现复杂性，需在详细设计阶段权衡。
            - 用户可以通过良好的命名约定或利用知识库编辑器的辅助功能（如重名提示）来管理 `displayName`，以期获得更可控的引用行为。
        - **通过 `id` 精确引用**: 为了实现绝对的稳定性和在任何情况下都能唯一指定条目（尤其是在 `displayName` 可能发生变化、存在难以通过上述策略有效处理的同名情况、或由程序生成引用时），系统始终支持通过 CAIU 的全局唯一 `id` ([`DesignDocs/architecture/project-and-knowledgebase-architecture-v2.md:35`](./DesignDocs/architecture/project-and-knowledgebase-architecture-v2.md:35)) 进行精确引用。
    - **引用格式 (Placeholder Syntax)**: 在需要嵌入内容的地方，使用特定的占位符语法。为了支持清晰、灵活的引用，并允许引用组内条目，定义以下格式。我们使用 `/` 作为路径分隔符，因此建议 CAIU 条目的 `displayName` 不包含未转义的 `/` 字符。

        **核心原则**:
        *   不带知识库ID前缀的引用，**默认且仅在当前知识库（即包含此引用标记的CAIU所在的知识库）中查找**。
        *   只有当明确提供了 `KnowledgeBaseID:` 前缀时，才进行跨知识库的查找。

        - **1. 知识库内引用 (默认行为)**:
            - `{{{DisplayNameKey}}}`: 在当前知识库中查找 `displayName` 为 `DisplayNameKey` 的顶层条目。若匹配多个同名条目，则根据预设的同名处理策略（如合并加载或情境激活加载）获取内容。
            - `{{{id=EntryID}}}`: 在当前知识库中通过 `id` 查找 `EntryID` 的顶层条目。
            - **路径式引用 (组内条目)**:
                - `{{{ParentGroupDisplayName/ChildDisplayName}}}`: 在当前知识库中，查找名为 `ParentGroupDisplayName` 的组条目下的名为 `ChildDisplayName` 的子条目。路径可以为多级，例如 `{{{L1Group/L2Group/Item}}}`。
                - `{{{id=ParentGroupID/id=ChildID}}}`: 通过 ID 路径引用当前知识库中的组内条目。
                - `{{{id=ParentGroupID/ChildDisplayName}}}`: 混合 ID 和 displayName 引用当前知识库中的组内条目。
                - `{{{ParentGroupDisplayName/id=ChildID}}}`: 混合 displayName 和 ID 引用当前知识库中的组内条目。

        - **2. 跨知识库引用 (需明确指定知识库标识)**:
            为了引用其他知识库中的条目，需要明确指定目标知识库。这可以通过知识库的 `kb_id` (全局唯一ID) 或其 `kb_displayName` (用户可读名称) 来实现。
            - **优先推荐使用 `kb_id` 进行精确引用，以避免 `kb_displayName` 可能存在的歧义。** 当使用 `kb_displayName` 且系统中存在多个同名知识库时，解析行为可能依赖于项目配置（如 `project.json` 中定义的知识库别名优先级）或系统策略，可能导致非预期结果。

            - `{{{KnowledgeBaseID_OR_DisplayName:DisplayNameKey}}}`: 引用指定知识库中 `displayName` 为 `DisplayNameKey` 的顶层条目。`KnowledgeBaseID_OR_DisplayName` 可以是目标知识库的 `kb_id` 或 `kb_displayName`。
            - `{{{KnowledgeBaseID_OR_DisplayName:id=EntryID}}}`: 引用指定知识库中 `id` 为 `EntryID` 的顶层条目。

            - **路径式引用 (组内条目)**:
                - `{{{KnowledgeBaseID_OR_DisplayName:ParentGroupDisplayName/ChildDisplayName}}}`
                - `{{{KnowledgeBaseID_OR_DisplayName:id=ParentGroupID/id=ChildID}}}`
                - `{{{KnowledgeBaseID_OR_DisplayName:id=ParentGroupID/ChildDisplayName}}}`
                - `{{{KnowledgeBaseID_OR_DisplayName:ParentGroupDisplayName/id=ChildID}}}`

            **解析说明**:
            *   当使用 `KnowledgeBaseDisplayName` 进行引用时，系统会尝试解析它。
                *   **查找顺序**: 首先，在当前项目 `project.json` 的 `knowledgeBaseReferences` 中查找 `name` 字段与 `KnowledgeBaseDisplayName` 匹配的知识库引用。
                *   如果项目中未找到匹配，或者需要解析的 `KnowledgeBaseDisplayName` 并非项目内定义的别名，系统将尝试在已注册的全局知识库中查找 `kb_displayName` 与之匹配的知识库。
            *   **同名处理**: 如果通过 `KnowledgeBaseDisplayName` 查找到多个知识库（例如，多个全局知识库具有相同的 `kb_displayName`，或者项目内引用与全局知识库重名且都被视为匹配时），系统将尝试从所有匹配到的知识库中查找目标 CAIU 条目。
                *   如果目标 CAIU 条目在这些同名知识库中也存在同名 `DisplayNameKey` 的情况，则会应用 CAIU 级别的同名处理策略（如前文所述的合并加载或情境激活加载）。
                *   创作者需要意识到，当依赖可能产生歧义的 `KnowledgeBaseDisplayName` 时，如果多个知识库被同时查找到，可能会导致非预期的内容合并或激活。建议在对引用行为有精确要求时，使用 `KnowledgeBaseID` 或在项目中为知识库定义清晰、唯一的引用名称/别名。

        - **3. 按标签引用 (作用域和具体语法待进一步细化)**:
            - `{{{tag:some_tag_value}}}`: 引用符合特定标签条件的条目。其默认作用域（当前知识库 vs. 项目全局）及如何精确控制作用域（例如，是否需要 `KB_ID:tag:` 或其他形式）待后续详细设计。

        - **对 `displayName` 和特殊字符的说明**:
            - 为确保 `/` 作为路径分隔符的可靠性，CAIU 的 `displayName` **不应包含未转义的 `/` 字符**。编辑器应辅助进行此约束。
            - `displayName` 也不应包含引用标记的特殊序列如 `{{{`, `}}}`, `this:`, `id=` 等，以避免解析冲突。

    - **解析与替换**: 系统在特定的处理阶段（例如，在 `Context Assembler Node` ([`DesignDocs/architecture/project-and-knowledgebase-architecture-v2.md:279`](./DesignDocs/architecture/project-and-knowledgebase-architecture-v2.md:279)) 中，或在最终文本生成前）会扫描文本中的这些引用标记。
        - 当检测到引用标记时，系统会尝试从指定的（或默认的）知识库中查找对应的 CAIU 条目(或条目集)。
        - **编辑器辅助校验**: 为了提升用户体验并减少运行时错误，知识库编辑器应在用户输入引用标记（如 `{{{DisplayNameKey}}}`）时，提供辅助校验功能。这可以包括：
            - **实时/异步查找**: 编辑器可以尝试实时或在用户暂停输入后异步查找被引用的 `displayName` 或 `id`。
            - **有效性提示**: 根据查找结果，编辑器可以给出即时反馈，例如：
                - 引用目标存在且唯一：绿色标记或无特殊提示。
                - 引用目标不存在：红色标记或警告信息。
                - 引用目标存在多个同名 displayName（无论是 CAIU 的 DisplayNameKey 还是跨知识库引用时的 KnowledgeBaseDisplayName）：黄色标记或提示，明确告知匹配到的数量，并可能建议用户使用 id（或 KnowledgeBaseID）进行精确引用，或检查/区分同名条目/知识库。
            - **初步循环预警**: 编辑器可以进行基础的静态分析，例如，如果用户在一个条目 A 中引用了条目 B，然后在编辑条目 B 时又尝试直接引用条目 A，编辑器可以给出循环引用的预警。
        - 如果通过 `displayName` 查找到多个匹配条目，则根据预设的同名处理策略（如合并加载或情境激活加载）来获取最终替换内容。
        - 如果成功获取到一个或多个条目的内容，这些内容（`content.value`，或经过适当格式化的多模态内容描述）将替换掉引用标记。
        - 需要定义处理引用失败的策略（例如，按 `id` 查找不到条目，或按 `displayName` 查找无匹配且无合适的同名处理策略导致最终无内容输出时），例如可以选择留空、插入特定的错误提示文本（如 "[引用未找到: KeyName]"）、或使用一个预设的默认值。
        - **默认行为**：在引用失败时，系统将插入一个标准的错误提示文本，例如 `"[引用错误: KeyName 未找到或无法解析]"`。未来可以考虑在项目设置或知识库设置中提供用户配置选项，允许用户选择失败处理方式（如：留空、标准错误提示、自定义错误提示、使用指定ID的默认CAIU内容）。
        - 考虑支持递归引用（一个被引用的条目内容中可能包含其他引用），并需要设计机制来检测和处理潜在的引用循环，以避免无限递归。**具体策略**：系统在解析引用时会维护一个当前引用的路径栈（记录已访问的 CAIU ID）和当前的递归深度。
            - **循环检测**: 如果在解析过程中，尝试引用的 CAIU ID 已经存在于当前引用路径栈中，则视为检测到循环。
            - **深度限制**: 同时，系统会设定一个最大递归深度（例如，默认为 5 或 10 层，可配置）。如果引用深度超过此限制，也视为异常。
            - **处理方式**: 一旦检测到循环或超出深度限制，系统将中止对当前特定引用标记的进一步解析，并可以选择插入一个明确的错误/警告标记到最终内容中（例如 `"[引用循环: KeyName]"` 或 `"[引用深度超限: KeyName]"`），而不是导致无限递归或程序崩溃。

- **应用场景**:
    - **角色构建**: 一个角色的完整描述可以由多个可引用的 CAIU（如背景、性格、口头禅）动态组合而成。
    - **世界观设定**: 常见的地点、组织、事件等可以作为可引用条目，在多处被一致地调用。
    - **动态对话生成**: AI 可以生成包含引用标记的回复，由系统填充具体细节。
    - **用户自定义模板**: 用户可以创建包含知识库引用的文本模板。

- **与 `variable_handling` 的关系**:
    - `variable_handling` ([`DesignDocs/architecture/project-and-knowledgebase-architecture-v2.md:92`](./DesignDocs/architecture/project-and-knowledgebase-architecture-v2.md:92)) 更侧重于传统意义上的变量定义（如键值对）和在 CAIU 内容中使用这些变量。
    - 动态内容引用则更侧重于将一个完整的 CAIU 条目的“内容本身”作为一种可被调用的“宏”或“片段”嵌入到其他文本中。两者可以互补使用。

此动态引用机制为知识的组织和应用提供了强大的灵活性，使得知识库不仅仅是被动检索的存储，更成为动态内容生成的重要组成部分。

- **可发现性与前端集成 (Discoverability & Frontend Integration)**:
    - 为了方便前端应用（如角色编辑器、文本输入框的自动完成/建议功能、或其他用户界面）动态地发现和列出可供引用的知识片段，可以采用**约定的标签 (Tags)** 机制。
    - CAIU 条目如果希望被明确标识为“可供动态引用”或“可作为变量导出”，可以在其 `management_metadata.tags` ([`DesignDocs/architecture/project-and-knowledgebase-architecture-v2.md:81`](./DesignDocs/architecture/project-and-knowledgebase-architecture-v2.md:81)) 数组中包含一个或多个预定义的特殊标签。例如：
        - `"@ref"`: 标记为一个通用的可引用内容片段。
        - `"@ref:character_trait"`: 标记为一个特定类型的可引用片段（如角色特质）。
        - `"@exportable_value"`: 标记为一个可作为“变量值”导出的条目。
        - (具体约定的标签体系待进一步定义)
    - 前端系统或其他工具可以通过查询包含这些特定约定标签的 CAIU 条目，来获取一个可用的“引用变量”或“动态内容片段”的列表（通常是其 `displayName` 或 `id`），从而提升用户在配置角色、编写模板或进行其他内容创作时的体验和效率。编辑器可以利用这些标签实现自动完成、下拉选择等功能，引导用户选择有效的引用，减少手动输入错误，并间接实现了一种形式的“编辑时校验”。

### 2.3. 工作流 (Workflow)
- **定位**: 定义AI交互逻辑、数据处理流程和节点执行顺序的核心机制。
- **核心特征**:
    - 基于节点化设计，用户通过连接不同功能的节点来构建流程。
    - **知识库使用**: 工作流中的特定节点（如“知识源节点”）通过读取当前项目的 `project.json` 配置来加载和使用声明的知识库。

### 2.4. 核心节点与资源类型

#### 2.4.1. 资源类型
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
  - `Context Assembler Node`: 汇总来自不同源的知识片段（包括解析动态内容引用）并整理成最终上下文。
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
- **ST角色卡**: 提取核心信息，转换为 ComfyTavern 知识库中一组专门的、结构化的 CAIU 条目（例如，使用特定标签如 "character_definition" 或特定 `entry_type`），用于完整描述角色。这些 CAIU 条目可以被项目中的工作流和 Agent 动态检索和使用。

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