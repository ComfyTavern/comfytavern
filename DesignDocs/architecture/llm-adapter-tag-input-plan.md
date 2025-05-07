# LLM 适配器 - Tag 输入框方案

## 1. 目标

设计并实现一个灵活、用户友好的方式来管理和指定 LLM 的能力 (Capabilities) 和自定义标签 (Tags)，并允许工作流节点通过这些标签来请求和偏好特定的模型。核心是引入一个可复用的 Tag 输入组件。

## 2. 核心思路

开发一个通用的 `TagInput.vue` 组件，该组件具备标签输入、预设建议、自动规范化等功能。在不同的用户界面（模型管理、节点配置）中，根据具体需求实例化该组件多次，并绑定到不同的数据字段，通过明确的标签区分其用途。

## 3. 数据结构变更

1.  **`ActivatedModelInfo` (`packages/types/src/node.ts` 或相关文件):**
    *   添加 `tags?: string[]` 字段，用于存储用户为模型添加的自定义标签（例如用于分组、标记特性等）。
    *   `capabilities: string[]` 字段保持不变，主要存储模型的核心、标准能力（如 "llm", "vision", "embedding"）。

2.  **`GenericLlmRequestNode` (节点输入参数定义):**
    *   使用 `required_capabilities: string[]` 字段，指定运行此节点必须满足的模型能力。
    *   使用 `preferred_model_or_tags?: string[]` 字段，允许用户指定偏好选择的模型 ID 或自定义标签。路由服务将优先尝试匹配此字段中的模型 ID，其次将此字段中的标签作为筛选或排序依据。

## 4. 前端组件实现

我们将采用组合方案，利用现有的 UI 库和自定义组件：

### 4.1. 预设能力选择组件

*   **技术选型:** 基于 **Semi UI Vue `Tag`** 组件进行自定义开发。
*   **实现:** 遍历可用的标准能力，为每个能力渲染一个 `Tag` 组件。通过自定义的 Vue 逻辑（例如 `v-for`, `@click` 事件处理，`:class` 或 `:type` 绑定）来管理选中状态数组，并切换标签的视觉样式（如颜色、边框）以表示选中/未选中。
*   **应用场景:** 模型管理界面的“模型能力 (Capabilities)”和节点配置界面的“必需能力 (Required Capabilities)”。

### 4.2. 自定义标签输入组件

*   **技术选型:** 使用 **Semi UI Vue `TagInput`** 组件。
*   **核心功能利用:**
    *   输入框用于自由文本输入。
    *   按回车或配置的分隔符（如逗号）自动创建标签。
    *   `separator` 属性支持批量输入。
    *   `allowDuplicates` 控制是否允许重复。
    *   `renderTagItem` 用于自定义标签的显示样式。
    *   `maxTagCount` 限制显示数量。
    *   `deletable` 属性（或通过 `renderTagItem` 实现删除按钮）。
*   **建议功能实现:**
    *   结合项目已有的 **`@/apps/frontend-vueflow/src/components/common/SuggestionDropdown.vue`** 组件。
    *   监听 `TagInput` 的 `onInputChange` 事件。
    *   在事件回调中触发后端请求，获取建议数据。
    *   将建议数据传递给 `SuggestionDropdown` 并显示。
    *   处理 `SuggestionDropdown` 的选中事件，将选中值填入 `TagInput`。
*   **规范化:** `TagInput` 本身可能不直接提供小写转换等，需要在 `onChange` 或添加标签的回调中处理。
*   **应用场景:** 模型管理界面的“自定义标签 (Tags)”和节点配置界面的“偏好模型/标签 (Preferred Model/Tags)”。


## 5. UI 实现 (组件应用)

根据第 4 节的技术选型，在界面中应用相应的组件：

1.  **模型管理界面 (编辑 `ActivatedModelInfo`):**
    *   **模型能力 (Capabilities):** 使用基于 Semi UI `Tag` 的自定义组件，绑定到 `activatedModelInfo.capabilities`。
    *   **自定义标签 (Tags):** 使用 `Semi UI Vue TagInput` 组件，结合 `SuggestionDropdown.vue` 实现建议，绑定到 `activatedModelInfo.tags`。建议列表来源：所有已激活模型 `tags` 的集合。

2.  **节点配置界面 (编辑 `GenericLlmRequestNode` 参数):**
    *   **必需能力 (Required Capabilities):** 使用基于 Semi UI `Tag` 的自定义组件，绑定到节点参数 `required_capabilities`。
    *   **偏好模型/标签 (Preferred Model/Tags):** 使用 `Semi UI Vue TagInput` 组件，结合 `SuggestionDropdown.vue` 实现建议，绑定到节点参数 `preferred_model_or_tags`。建议列表来源：所有已激活模型的 `model_id` 集合 + 所有已激活模型 `tags` 的集合。

## 6. 后端服务调整

1.  **`ModelRegistryService`:**
    *   修改 `ActivatedModelInfo` 的存储和读取逻辑，包含 `tags` 字段。
    *   提供接口，用于获取前端 `TagInput` 组件所需的建议列表数据（如所有标准能力、所有自定义标签、所有模型 ID）。

2.  **`ModelRouterService`:**
    *   实现增强的路由匹配逻辑：
        1.  **精确模型 ID 匹配:** 检查节点 `preferred_model_or_tags` 中是否存在有效的、已激活的 `model_id`。如果存在且该模型满足 `required_capabilities`，则优先选择该模型。
        2.  **能力筛选:** 根据节点的 `required_capabilities` 筛选所有满足条件的已激活模型。
        3.  **标签偏好匹配:** 如果上一步有多个候选模型，使用节点 `preferred_model_or_tags` 中的非 ID 标签，与候选模型的 `tags` 进行匹配，用于进一步筛选或排序。
        4.  **全局规则:** 应用用户配置的全局路由规则（如果存在）来最终确定 `selected_model_id` 和 `selected_channel_group_ref`。

## 7. 开发阶段安排

1.  **Phase 1: 核心增强与健壮性**
    *   在模型管理界面集成基于 Semi UI `Tag` 的自定义组件 (用于 Capabilities) 和 `Semi UI TagInput` + `SuggestionDropdown` (用于 Tags)。
    *   更新 `ModelRegistryService` 以支持 `tags` 字段的存储和读取。
    *   实现 `ModelRouterService` 中基于 `required_capabilities` 的基础路由逻辑。
    *   后端提供基础的建议列表数据接口 (`SuggestionDropdown` 使用)。

2.  **Phase 2: 高级功能与用户体验**
    *   在节点配置界面集成基于 Semi UI `Tag` 的自定义组件 (用于 Required Capabilities) 和 `Semi UI TagInput` + `SuggestionDropdown` (用于 Preferred Model/Tags)。
    *   实现 `ModelRouterService` 中完整的路由逻辑（包括精确 ID 匹配和标签偏好）。
    *   完善建议列表的数据接口和前端展示。
    *   利用 `renderTagItem` 等实现必要的样式定制。

## 8. Mermaid 图 (路由逻辑示意)

```mermaid
graph TD
    A[节点请求: required_capabilities, preferred_model_or_tags] --> B{ModelRouterService};

    subgraph "路由匹配步骤"
        direction LR
        C{检查 preferred... 是否含模型 ID?} -- 是 --> D{尝试匹配精确模型 ID};
        D -- 成功且满足能力 --> E[候选: 精确匹配的模型];
        C -- 否 --> F{根据 required_capabilities 筛选};
        F --> G{根据 preferred... (标签部分) 匹配模型 tags};
        G --> H[候选: 满足能力和标签偏好的模型];
        E --> H;
    end

    subgraph "数据源"
        K[ActivatedModelInfo (capabilities, tags, model_id)]
        L[用户全局路由规则]
    end

    B -- 查询 --> K;
    B -- 查询 --> L;

    H --> I{应用全局路由规则};
    I --> J[确定 selected_model_id 和 channel_group_ref];
    J --> Z[返回路由结果];