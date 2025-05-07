# 工程项目架构规划 (初步)

## 核心概念

### 1. 工程项目 (Project)

- **定位:** 作为应用的核心组织单元，取代简单的“工作空间”。
- **目的:** 统一管理项目相关的所有资源，提供清晰的上下文，便于组织、复用和共享。
- **包含内容:** 一个项目可以包含多种资源类型，如工作流、角色卡、世界信息、对话图、场景/剧本、自定义脚本、自定义界面、媒体资源和项目设置等。
- **存储:** 建议采用基于目录的存储方式。每个项目对应一个文件夹，内部包含 `project.json` 元数据文件和用于存放各类资源的子目录。

### 2. 交互模板 (Interaction Template)

- **定位:** 项目创建时的**非限制性起点/预设**。
- **目的:** 为用户提供快速开始特定类型项目（如 AI Chat, Workflow, Visual Novel）的便利，自动生成推荐的初始目录结构和可能的默认文件。
- **非限制性:** 模板**不**限制项目未来的发展方向，也不引入冲突的数据结构。用户可以在任何模板创建的项目中添加或移除任何类型的资源。
- **`project.json` 提示:** 模板可以设置一个 `preferredView` 字段，提示项目打开时默认显示哪个界面，但这不应是强制性的。

### 3. 统一项目结构

- 需要设计一个**统一的、能够容纳所有潜在资源类型**的项目目录结构。模板仅决定初始时创建哪些目录和文件。

### 4. 中心化接口定义 + 幻影 I/O 节点模型

- **设计灵感:** 此模型借鉴了 Blender 几何节点的设计思路，旨在将接口定义与画布上的视觉表示解耦。
- **灵活性:** 用户可以随意在画布上添加或删除 `GroupInput` / `GroupOutput` 幻影节点，这不会影响工作流实际定义的接口。它们仅仅是视觉连接点。
- **动态添加接口:** 可以通过连接到幻影节点上的特殊“空心”插槽（代表 `ANY` 类型）来快速创建新的输入或输出接口。连接后，接口会自动添加到中心化定义中，并出现在侧边面板供进一步配置。
- **接口管理:** 接口的重命名、类型修改、排序和删除等配置操作，统一在侧边面板中进行管理，而不是直接在幻影节点上操作。

- **接口定义:** 工作流的外部接口（输入 `interfaceInputs` / 输出 `interfaceOutputs`）统一定义并存储在工作流对象 (`WorkflowObject`) 本身。
- **幻影节点:** 画布上的 `GroupInput` / `GroupOutput` 节点仅作为视觉上的连接点（提供 Handles），其 Handle ID 对应中心化接口定义中的 Key。这些节点本身不存储接口定义。
- **接口编辑:** 采用侧边面板 (Side Panel) 作为编辑工作流中心化接口的统一 UI 方案。用户在此面板中添加、删除、修改、排序输入/输出项。
- **接口快照:** `NodeGroup` 节点在其 `data` 对象中存储一个 `groupInterface` 字段，作为被引用工作流接口的**快照（副本）**。**此快照随父工作流一同保存**，以确保加载时的鲁棒性和避免循环加载依赖。
- **接口同步:** 当被引用的工作流保存时，同步机制负责更新所有引用它的 `NodeGroup` 节点的 `data.groupInterface` 快照。

## 资源类型列表 (初步)

| 资源类型                   | 描述                                                                                 | 建议格式                                             | 建议存储位置 (项目内)          |
| :------------------------- | :----------------------------------------------------------------------------------- | :--------------------------------------------------- | :----------------------------- |
| **工作流 (Workflow)**      | 定义节点、连接和执行逻辑。                                                           | `.json` (遵循 `WorkflowObjectSchema`)                | `/workflows/`                  |
| **角色卡 (Character)**     | 定义 AI 角色的名称、描述、个性、问候语、头像等。                                     | `.json` / `.yaml` (遵循 `CharacterSchema`)           | `/characters/`                 |
| **世界信息 (World Info)**  | 存储背景设定、关键词触发的知识条目等。                                               | `.json` / `.yaml` 集合 (遵循 `WorldInfoEntrySchema`) | `/worldinfo/`                  |
| **对话图 (Chat Graph)**    | **节点图结构**，可视化展示和操作对话流程、分支、编辑历史。包含消息节点、分支节点等。 | `.json` (遵循 `ChatGraphObjectSchema`)               | `/chats/` 或 `/chatgraphs/`    |
| **场景/剧本 (Scene)**      | 定义视觉/互动小说场景、对话、分支等。                                                | 格式待定 (JSON/YAML/Markdown?)                       | `/scenes/`                     |
| **自定义脚本 (Script)**    | 用户编写的扩展逻辑脚本。                                                             | `.js` / `.ts`                                        | `/scripts/`                    |
| **自定义界面 (Custom UI)** | 用户自定义的前端界面、组件或视图。                                                   | HTML, CSS, JS (可能包括框架组件)                     | `/ui/`                         |
| **媒体资源 (Assets)**      | 图像、音频等。                                                                       | 标准媒体格式                                         | `/assets/` (可分子目录)        |
| **项目设置 (Settings)**    | 项目级别的特定配置。                                                                 | `.json`                                              | `/settings/` 或 `project.json` |

## 统一项目结构 (草案)

```
/YourProjectName/
├── project.json          # 项目元数据文件
│
├── workflows/            # 工作流定义 (.json)
├── characters/           # 角色卡 (.json / .yaml)
├── worldinfo/            # 世界信息/知识库条目 (.json / .yaml)
├── chats/                # 对话图 (.json) 或 对话历史 (格式待定)
├── scenes/               # 场景/剧本 (格式待定)
├── scripts/              # 自定义逻辑脚本 (.js / .ts)
├── ui/                   # 自定义界面文件 (HTML, CSS, JS, Vue, etc.)
├── assets/               # 媒体资源 (可分子目录)
└── settings/             # 项目特定设置 (.json)
```

## `project.json` 元数据格式 (草案)

```json
{
  "id": "unique-project-identifier-uuid", // 项目唯一ID (创建时生成)
  "name": "My Awesome Project", // 项目名称 (用户可修改)
  "description": "A project demonstrating AI chat and workflow integration.", // 项目描述 (用户可修改)
  "version": "1.0.0", // 项目自身内容的版本 (手动或自动管理)
  "createdAt": "2025-04-05T14:00:00Z", // 创建时间 (ISO 8601)
  "updatedAt": "2025-04-05T14:05:00Z", // 最后修改时间 (ISO 8601)
  "templateUsed": "aichat", // 创建时使用的模板类型 (仅供参考，非限制性)
  "preferredView": "editor", // 项目打开时默认显示的视图类型: "editor" (内置编辑器) 或 "custom" (加载 /ui/ 下的用户界面)。默认为 "editor"。
  "schemaVersion": "1", // project.json 本身的 schema 版本
  "customMetadata": {
    // 可选的、供用户或插件使用的自定义元数据
    "author": "User Name",
    "tags": ["fantasy", "tavern"]
  }
}
```

## 后续步骤

1.  ~~详细设计统一的项目目录结构。~~ (已完成草案)
2.  ~~详细设计 `project.json` 元数据格式。~~ (已完成草案)
3.  为核心资源类型 (Workflow, Character, WorldInfo, ChatGraph, CustomUI 等) 定义 Zod Schema 或加载/处理机制。
    - 需要为 `WorkflowObject` 添加 `interfaceInputs` 和 `interfaceOutputs` 字段及其 Schema。
    - 需要为 `NodeGroup` 节点的 `data` 定义 Schema，**包含 `referencedWorkflowId` 和 `groupInterface` (快照) 字段**。
4.  设计后端核心项目管理 API (包括获取项目列表 `GET /api/projects` 和获取项目元数据 `GET /api/projects/:projectId/metadata`)。
5.  规划前端项目上下文管理和状态管理重构。

    - **目标:** 将项目上下文提升为应用的一等公民，通过 URL 进行管理，使状态管理和组件都围绕选定的项目进行操作。
    - **路由改造:**
      - 修改 `router/index.ts`，引入动态路由参数包含项目 ID，例如将 `/editor` 改为 `/projects/:projectId/editor`。
      - 考虑添加项目选择/管理页面路由，例如 `/projects`。
    - **项目加载逻辑:**
      - 在应用启动时（如 `App.vue` 的 `onMounted`）或使用路由守卫 (Navigation Guards)：
        - 检查 URL 是否包含 `projectId`。
        - 若包含，则调用 `projectStore.loadProject(projectId)` 加载项目。
        - 若不包含，则重定向到项目选择页面或加载默认/上次使用的项目。
        - 处理项目加载失败的情况（如显示错误信息）。
    - **状态管理 (Pinia Stores) 调整:**
      - `projectStore`:
        - 可能需要添加 `availableProjects` 状态来存储项目列表（如果需要前端选择）。
        - 确保 `currentProjectId` 和 `currentProjectMetadata` 与当前路由的 `projectId` 同步。
      - `tabStore`:
        - 所有标签页操作（`addTab`, `initializeDefaultTab` 等）需要与 `projectStore.currentProjectId` 关联。
        - 加载/切换项目时，可能需要清除或加载对应项目的标签页状态。
      - `workflowStore`:
        - 所有工作流相关操作（`fetchAvailableWorkflows`, `loadWorkflow`, `applyDefaultWorkflowToTab` 等）需要明确使用 `projectStore.currentProjectId` 作为参数或上下文。
    - **组件调整:**
      - `EditorView` 和其他依赖项目上下文的组件需要能够响应 `projectId` 的变化（通过路由参数 `useRoute().params.projectId` 或 `projectStore` 的状态）。
    - **可视化流程:**

      ```mermaid
      graph TD
          A[用户访问应用] --> B{检查 URL 是否包含 projectId};
          B -- 是 --> C[从 URL 获取 projectId];
          B -- 否 --> D[重定向到项目选择页 / 加载默认项目];
          D --> C;
          C --> E[调用 projectStore.loadProject(projectId)];
          E --> F{项目加载成功?};
          F -- 是 --> G[加载项目相关数据 (Tabs, Workflows)];
          F -- 否 --> H[显示错误信息];
          G --> I[导航到项目编辑器视图 (/projects/:projectId/editor)];
          I --> J[用户在编辑器中操作];

          subgraph Project Selection
              K[用户选择项目] --> C;
          end

          subgraph Editor View (/projects/:projectId/editor)
              L[视图组件] --> M(监听 projectId 变化);
              M --> N(依赖 projectStore/tabStore/workflowStore 获取数据);
          end

          subgraph Stores
              O[projectStore] --> P(管理 currentProjectId/Metadata);
              Q[tabStore] --> R(管理 projectId 下的 Tabs);
              S[workflowStore] --> T(管理 projectId 下的 Workflows);
          end

          I -.-> L;
          E -.-> O;
          G -.-> Q;
          G -.-> S;
      ```

    - 需要实现接口编辑侧边面板 UI。
    - 需要实现加载时使用 `groupInterface` 快照，并在引用变更或同步时更新快照。

6.  基于新架构重新设计节点组（项目内工作流引用）功能，包括接口提取、同步（更新快照）和执行逻辑。
