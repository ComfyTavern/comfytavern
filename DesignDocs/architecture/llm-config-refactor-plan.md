# LLM 提供商配置页面重构计划 (V2)

## 1. 目标

重构 LLM 提供商配置页面，以解决当前 UI 在模型与渠道关联性上不直观、交互逻辑不清晰的问题。新设计将采用 Master-Detail 动态布局，整合渠道管理与模型管理，并提升用户体验和可维护性。

## 2. 核心设计理念

我们将废弃现有的标签页布局，转而采用一个统一的、响应式的 Master-Detail 视图。详情面板的展开/折叠将由用户通过一个专门的按钮显式控制，从而分离“选中”和“查看详情”这两个操作。

- **状态管理**: `LlmConfigManager.vue` 作为主容器，将维护两个核心状态：
    1.  `selectedChannelId: string | null`：记录当前选中的渠道，用于在详情面板中加载数据。
    2.  `isDetailPanelOpen: boolean`：记录详情面板是否展开，用于控制整体布局。

- **交互流程**:
    1.  用户在列表中单击某一项，该项被**选中**（`selectedChannelId` 更新），但详情页**不会**自动打开。
    2.  用户点击该行项目中的“详情”按钮（例如一个 `>` 图标按钮），`isDetailPanelOpen` 状态变为 `true`，详情面板从侧边滑出或展开。
    3.  用户在详情面板中可以进行编辑、管理模型等操作。
    4.  用户可以点击详情面板上的“关闭”或“折叠”按钮（例如一个 `<` 图标按钮），`isDetailPanelOpen` 状态变为 `false`，详情面板收起。

## 3. 架构与组件职责规划

```mermaid
graph TD
    subgraph LlmConfigManager (主容器)
        direction LR
        state1[("selectedChannelId: string | null")]
        state2[("isDetailPanelOpen: boolean")]

        subgraph ChannelListWrapper (渠道列表容器)
            direction TB
            A[DataListView] -->|通过 #list-item 插槽| B{行内操作按钮}
            B -- "详情 >" --> |@click| C(更新 selectedChannelId & isDetailPanelOpen)
        end

        subgraph ApiChannelDetailView (渠道详情)
            direction TB
            D[ApiChannelForm]
            E[ModelListForChannel]
            F[折叠按钮 <] -->|@click| G(更新 isDetailPanelOpen)
        end

        state1 & state2 -- 控制布局 --> ChannelListWrapper
        state1 & state2 -- 控制显隐与数据 --> ApiChannelDetailView

        ChannelListWrapper -- 发出事件 --> LlmConfigManager
        ApiChannelDetailView -- 发出事件 --> LlmConfigManager
    end
```

### 组件职责:

1.  **`LlmConfigManager.vue` (主容器)**:
    - **职责**: 管理 `selectedChannelId` 和 `isDetailPanelOpen` 状态，并根据 `isDetailPanelOpen` 的值切换整体布局（全宽列表 vs. 列表+详情分栏）。

2.  **`ChannelListWrapper.vue` (新组件)**:
    - **职责**: 封装和配置 `DataListView.vue`。它将定义列表的列、数据获取逻辑 (`fetcher`)，并通过插槽自定义列表行的操作按钮（如“详情”、“测试连接”等）。

3.  **`ApiChannelDetailView.vue` (新组件)**:
    - **职责**: 接收 `channelId`，展示渠道的编辑表单和关联的模型管理列表。包含一个用于关闭自身的折叠按钮。

4.  **`ApiChannelList.vue` (将被替换)**:
    - 此组件将被新建的 `ChannelListWrapper.vue` 替代，其原有逻辑将被分解并整合到新架构中。

## 4. 实施步骤

1.  **创建 `ChannelListWrapper.vue`**:
    - 创建新文件。
    - 在模板中使用 `<DataListView>` 组件。
    - 配置 `viewId`, `fetcher`, `columns`, `itemKey` 等核心 props。
    - 使用 `#list-item` 插槽来自定义每一行的渲染，特别是添加一个“详情”按钮。
    - 使用 `#toolbar-actions` 插槽添加“新建渠道”按钮。
    - 处理按钮点击事件，并 emit 到父组件以更新状态。

2.  **重构 `LlmConfigManager.vue`**:
    - 移除旧的 `ApiChannelList`，替换为新的 `ChannelListWrapper`。
    - 添加 `isDetailPanelOpen` 状态。
    - 实现事件监听器来控制 `selectedChannelId` 和 `isDetailPanelOpen`。
    - 更新布局逻辑，根据 `isDetailPanelOpen` 来显示/隐藏 `ApiChannelDetailView` 并调整 `ChannelListWrapper` 的宽度。

3.  **创建 `ApiChannelDetailView.vue`**:
    - 创建新文件。
    - 接收 `channelId` prop，并使用 `watch` 来监听其变化，以便在切换渠道时重新加载数据。
    - 在组件内部集成 `ApiChannelForm`。
    - 实现新的“模型管理”区域，包括调用 `discover-models` API 和管理模型激活状态的逻辑。
    - 添加一个关闭/折叠按钮。

4.  **删除旧的 `ApiChannelList.vue`**:
    - 在确认新组件工作正常后，移除旧的列表组件以完成重构。