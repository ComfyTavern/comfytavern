# ComfyTavern 项目架构规划

## 1. 引言与核心目标

本文档旨在规划 ComfyTavern 的核心项目架构。设计的核心目标是实现高度的模块化、卓越的可扩展性、优秀的用户友好性，并为未来的高级 AI 交互功能打下坚实基础。

## 2. 核心概念定义

### 2.1. 工程项目 (Project)

- **定位**: 应用的核心组织与执行单元。
- **目的**: 统一管理项目相关的所有资源（工作流、角色、知识库引用、场景、媒体等），提供清晰的上下文。
- **核心特征**:
  - 每个项目对应一个文件系统中的目录。
  - 包含一个 `project.json` 元数据文件，用于描述项目信息及其依赖。
  - **知识库依赖**: 项目在其 `project.json` 中显式声明其使用的知识库（本地或全局）。

### 2.2. 工作流 (Workflow)

- **定位**: 定义 AI 交互逻辑、数据处理流程和节点执行顺序的核心机制。
- **核心特征**:
  - 基于节点化设计，用户通过连接不同功能的节点来构建流程。
  - **知识库使用**: 工作流中的特定节点（如“知识源节点”）通过读取当前项目的 `project.json` 配置来加载和使用声明的知识库。

### 2.3. 核心节点与资源类型

#### 2.3.1. 资源类型

- **场景/剧本 (Scene)**: 定义互动叙事的结构。
- **自定义 UI (Custom UI)**: 用户自定义的前端界面。
- **脚本 (Script)**: 用户自定义的逻辑扩展。
- **媒体资源 (Assets)**: 项目中直接使用的、非知识库管理的媒体文件。
- (更多类型待定义)

#### 2.3.2. 关键节点概念 (示例)

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
  "preferredView": "editor", // "editor" or "custom"
  "schemaVersion": "2.0", // project.json schema version
  "knowledgeBaseReferences": [
    // 项目使用的知识库列表
    {
      "source_id": "unique_kb_identifier_for_local_kb_001", // 知识库的唯一ID
      "name": "Character Specific Backstory" // 用户可读的显示名称
    },
    {
      "source_id": "global_kb_registry_id_001", // 指向全局知识库的标识
      "name": "Generic Fantasy World Setting"
    }
  ],
  "customMetadata": {
    // ...
  }
}
```

## 4. 交互模板 (Interaction Template)

- **定位**：项目创建的起点和脚手架，而非运行时的限制。
- **目的**：
  - 允许用户快速启动一个具有特定用途的项目（例如："基础聊天"、"带 RAG 的知识问答"、"角色扮演"、"图像生成"）
  - 提供预设的项目结构、示例工作流、默认配置和必要的资源引用
  - 降低新用户的学习曲线，展示最佳实践
- **核心特征**:
  - **本质**: 一个遵循标准项目目录结构（见 3.1）的预打包文件集合（可以是一个目录模板或 .zip/.cttemplate 压缩包）
  - **内容包含**:
    - 一个预配置的 project.json (包含描述、默认设置、对基础/全局知识库的引用声明)
    - 一个或多个示例性的 workflows/ (例如，一个实现基础 RAG 流程的 workflow.json)
    - (可选) 示例性的项目本地 knowledgebases/
    - (可选) 示例性的 scenes/, ui/, assets/
    - (可选) 一个 README.md 说明模板用途和使用方法
  - **使用流程**: 用户选择 "新建项目" -> "从模板创建" -> 选择一个模板 -> 系统将模板内容解压/复制到一个新的项目目录中
  - **非约束性**: 一旦项目基于模板创建完成，它就成为一个完全独立的、可自由修改的项目，与原始模板脱钩。用户可以任意修改、删除、添加工作流和资源。模板只影响初始化状态
  - **与项目的关系**: 模板是创建项目的"配方"或"蓝图副本"，项目是模板的实例化

## 5. 节点接口模型 (Node Interface Model)

节点接口模型定义了节点组（NodeGroup）的输入输出接口，这些接口在节点组节点上显示为插槽，但实际的数据流由引用的工作流内部节点处理。

- **接口定义**:
  - 节点组可以定义多个输入和输出接口，每个接口具有以下属性：
    - `key`: 唯一标识符（如 `useGroupIOSlots()`)
    - `displayName`: 显示名称
    - `dataFlowType`: 数据流类型（如 STRING, INTEGER, WILDCARD, CONVERTIBLE_ANY 等）
    - `customDescription`: 自定义描述（可选）
  - 接口定义存储在节点组的 `groupInterface` 属性中（输入在 `inputs`，输出在 `outputs`）

- **接口管理**:
  - 用户可以在节点组的侧边栏（GroupIOEdit 组件）中动态管理接口：
    - 添加/删除接口（`useGroupIOActions.addInput()`）
    - 排序接口（`useGroupIOActions.sortInputs()`）
    - 编辑接口属性（`useGroupIOState.editingDisplayName`）
  - 状态管理使用组合函数 `useGroupIOState()`

- **动态插槽**:
  - 节点组节点会动态从引用工作流中获取IO插槽（`useGroupIOSlots()`)
  - 这些插槽不会被保存到工作流文件中，只保存引用信息
  - 在加载时动态获取接口定义（`useGroupIOSlots.finalInputs`）

## 6. ST 兼容性策略总结

- **ST 预设**: 通过转换工具转换为 ComfyTavern 工作流文件 (.json)。