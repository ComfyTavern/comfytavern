# 多输入插槽交互精炼与原子化历史记录计划 (Rev.3 - 视觉融合跑道式多子Handle实现)

## I. 引言

本计划旨在解决当前多输入插槽在视觉呈现和交互精确性方面的局限性，并优化相关操作的历史记录机制。核心目标是通过在 `apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue` 中为 `multi: true` 的输入**动态渲染多个逻辑上独立、但在视觉上融合成一个整体（类似Blender跑道式插槽）的Handle交互区域（内部对应子Handle）**，来实现类似 Blender 的清晰、流畅、直观的多输入插槽交互体验。

这种多子Handle的实现方式，将取代原先尝试拉伸单个Handle并在其内部模拟多条连接线的交互的思路。

核心改进点包括：

1.  **Blender式融合插槽视觉呈现**：为 `multi: true` 的输入渲染一个视觉上统一的、跑道式的插槽区域。该区域内部逻辑上由多个垂直排列的、可独立交互的“子Handle点”构成，每个点对应一条或一个潜在的连接。这些逻辑子Handle点在视觉上无缝融合进整体跑道外观，而非呈现为多个分离的Handle组件。
2.  **精确的子Handle交互**：
    *   拖拽连接线时，连接线精确地连接到目标子Handle。
    *   支持在这些子Handle之间进行连接线的“移动”（视觉上的排序），通过重新映射边到子Handle的连接来实现。
    *   鼠标悬停在某个子Handle或其附近时，能清晰指示交互目标。
3.  **优化的连接线操作**：支持高亮选中连接到特定子Handle的连接线，并改进从已连接子Handle“拔出”连接的行为。
4.  **原子化且智能的历史记录**：确保所有相关操作（如连接到特定子Handle、更新子Handle间的连接顺序等）在历史记录中表现为单一、清晰的条目，并遵循“无实际状态变更则不记录历史”的原则。

本文档将详细阐述为达成上述目标所需的核心渲染机制变更、交互逻辑增强、关键组件的调整、新的协调器函数设计以及实施步骤。

## II. 核心交互逻辑增强 (基于多子Handle)

### 1. 从已连接的输入子Handle拖拽 (拔出连接)
*   **触发**：当用户从一个已经有连接的**子Handle** (属于一个 `multi: true` 的输入插槽，例如 `originalKey__index`) 或一个普通的单输入Handle开始拖拽时。
*   **行为**：
    *   阻止 VueFlow 默认创建一条全新边的行为。
    *   当前被拖拽的连接线进入“拔出”(unplugged) 或“预备重连”(disconnect & reconnect) 状态。
    *   视觉上，这条被“拔出”的连接线应有特殊指示（例如，使用 [`apps/frontend-vueflow/src/components/graph/edges/UnplugConnectionLine.vue`](apps/frontend-vueflow/src/components/graph/edges/UnplugConnectionLine.vue) 的样式或类似效果）。
*   **后续交互**：
    *   用户可以将这条“拔出”的边连接到任何其他兼容的插槽（其他节点的子Handle、单输入Handle，或源Handle）。
    *   如果释放到画布空白处，则该连接被彻底断开。
    *   如果拖拽后释放回原始的**子Handle**（对于多输入插槽，意味着连接回原来的那个小Handle，并且其在 `inputConnectionOrders` 中的逻辑顺序未变），则不应产生新的历史记录。

### 2. 拖拽连接线至多输入插槽 (连接到特定子Handle)
*   **触发**：当用户拖拽一条新的连接线或一条“拔出”的连接线，其末端悬停在一个 `multi: true` 的输入插槽区域时。此区域在视觉上由多个垂直排列的子Handle构成。
*   **行为**：
    *   **高亮目标子Handle**：当鼠标悬停在某个具体的子Handle上时，该子Handle应高亮。
    *   **确定目标子Handle**：根据鼠标指针在多输入插槽垂直区域内的位置，动态计算出连接线将要连接到的目标**子Handle**的ID (例如 `originalKey__index`)。
    *   如果该多输入插槽当前没有连接，则至少会有一个或多个预备的子Handle可见，鼠标悬停时高亮其中一个。
    *   （可选特性）如果鼠标悬停在两个现有子Handle之间的间隙，可以视觉上指示一个新的子Handle将被创建（如果允许动态增减子Handle数量）或连接将被插入到该顺序位置，但这会增加复杂性。初期可以先实现连接到固定数量或预渲染的子Handle上。
*   **释放连接**：
    *   如果在某个子Handle的有效交互区域内释放鼠标，连接线将精确地连接到该**子Handle**。
    *   目标节点的 `inputConnectionOrders` 数组（或类似结构）将相应更新，记录连接到哪个子Handle ID以及这些连接的逻辑顺序。
    *   此操作（添加新连接并确定其目标子Handle和顺序）应记录为一次原子的历史。

### 3. 多输入插槽内连接线的“排序”（重映射到不同的子Handle）
*   **交互方式**：不再是在一个拉长的“胶囊区域”内拖拽连接线本身进行排序。而是通过“拔出”一条连接线，然后将其重新连接到同一多输入插槽下的另一个**子Handle**上来改变其逻辑顺序。
*   **阶段 A: 选中并拔出连接线**
    *   **触发**：用户在连接到某个子Handle的连接线上方（或直接在该子Handle上）进行操作，意图“拔出”该连接。
    *   **视觉反馈**：被选中的连接线进入“拔出”状态，高亮显示。
*   **阶段 B: 重新连接到同一多输入插槽的不同子Handle**
    *   用户将“拔出”的连接线拖拽到同一节点、同一原始输入逻辑名下的另一个**子Handle**上。
    *   **视觉反馈**：目标子Handle高亮。
    *   **释放操作**：释放鼠标后，如果连接成功，则更新该节点对应输入插槽的 `inputConnectionOrders`，反映连接线已从原子Handle A 移动到子Handle B。此操作应记录为一次原子的“更新连接顺序”或“移动连接”历史。如果释放后逻辑顺序未变（例如又插回了原来的子Handle），则不记录历史。
*   **拖出多输入插槽区域 (拔出)**：
    *   一旦选中的连接线被拖出其原属多输入插槽的子Handle区域，其状态转为标准的“拔出连接”状态，后续交互同“II.1.”。

## III. 关键组件的必要调整/增强

### 1. `apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue`
*   **核心变更：渲染多个子Handle**
    *   对于 `input.multi: true` 的输入定义，组件**必须为 `multi: true` 的输入渲染一个视觉上统一的父容器（跑道形状）。在此容器内部，逻辑上存在多个可交互的区域，对应于独立的、标准尺寸的 `<Handle>` 实例（子Handle）的预期位置。这些子Handle本身可能被父容器的样式覆盖或隐藏，交互通过父容器代理到这些逻辑点。**
    *   跑道区域的高度（以及内部逻辑子Handle的数量/密度）可以基于当前连接数加上一个额外的空位，或者基于一个预设的最小/最大高度，以维持一致的视觉外观。即使没有连接，也应显示一个最小尺寸的跑道区域。
    *   每个子Handle需要一个唯一的ID，格式如 `originalInputKey__index` (例如 `text_input__0`, `text_input__1`)。这个ID将用于边的 `targetHandle` 属性。
    *   这些逻辑子Handle点在父容器（跑道）内部垂直均匀分布。父容器负责整体的跑道视觉样式，其高度由内部逻辑子Handle的数量和期望的视觉密度决定。子Handle之间的视觉间隙被跑道外观所融合。
*   **子Handle交互**：
    *   每个子Handle需要能独立响应 `mousedown`, `mousemove`, `mouseup`, `mouseenter`, `mouseleave` 等鼠标事件，以支持连接、断开、高亮等操作。
    *   这些事件处理需与 [`useCanvasConnections.ts`](apps/frontend-vueflow/src/composables/canvas/useCanvasConnections.ts) 紧密协作，传递被交互的子Handle的唯一ID。
*   **视觉指示**：
    *   当拖拽连接线悬停在跑道区域时，需要根据鼠标的垂直位置高亮跑道区域内对应的逻辑子Handle区域（例如，通过改变跑道特定部分的背景或边框）。
    *   跑道式的整体外观取代了原先在单个拉伸Handle内模拟视觉间隙的需求。连接点在逻辑上对应内部子Handle的位置。
    *   **特定多输入插槽的UI简化**: 对于主要通过连接接收数据、且其连接顺序由专门的内联组件（如 `InlineConnectionSorter.vue`）管理的多输入插槽（例如“文本合并”节点的“文本输入”插槽），应避免渲染常规用于可直接编辑内容的输入控件的预览（眼睛图标）和编辑（铅笔图标）按钮。这些按钮在此类场景下是多余的，因为插槽内容本身不直接编辑，连接顺序由排序组件处理。这将需要调整 `BaseNode.vue` 中 `showActionButtonsForInput` 函数的逻辑或模板中的条件渲染。
*   **移除或重构相关逻辑**：
    *   `getDynamicHandleStyles` (或类似函数) 将主要负责计算和应用跑道式父容器的样式（包括其动态高度和跑道形状），并可能辅助定位内部逻辑子Handle的交互区域。
    *   原有的针对单个Handle的跑道形样式逻辑将演变为应用于这个新的、包含多个逻辑子Handle的父容器。单个逻辑子Handle在概念上仍是标准交互单元，但其视觉表现融入父容器。

### 2. `apps/frontend-vueflow/src/components/graph/edges/SortedMultiTargetEdge.vue`
*   **现状**：此组件已存在，设计初衷是为连接到单个拉伸Handle的多条边计算垂直偏移。
*   **计划变更**：鉴于现在将为多输入插槽渲染多个独立的子Handle，每个子Handle都有自己的精确位置，**此自定义边组件很可能不再需要**。标准的Vue Flow边组件（如 `BezierEdge` 或 `SmoothStepEdge`）应该能够直接连接到这些子Handle，并由Vue Flow自动处理路径渲染。
    *   **建议：尝试移除此组件，并使用Vue Flow的默认边或一个通用的自定义边（如果需要统一的样式或标记）。**
    *   如果因特殊原因（如仍需对一组连接到同一逻辑输入的边进行整体视觉处理）需要保留类似组件，其内部逻辑也需完全重写，以适应连接到不同子Handle的新结构。

### 3. `apps/frontend-vueflow/src/composables/canvas/useCanvasConnections.ts`
*   **计划重构/增强**：
    *   **`onConnectStart`**：当从已连接的**子Handle**开始拖拽时，应阻止默认行为，并设置一个表示“拔出”的状态。需要传递被拔出子Handle的唯一ID。
    *   **`onConnectEnd` / `onEdgeUpdateEnd`**：
        *   需要能识别拖拽操作的目标是否为某个节点的**子Handle**。
        *   在处理连接到子Handle、或从子Handle拔出等操作时，收集所有必要的参数，包括目标子Handle的唯一ID (例如 `originalKey__index`)。
        *   创建描述该原子操作的 `HistoryEntry` 对象。
        *   调用在 `useWorkflowInteractionCoordinator.ts` 中定义的、新的或增强的协调器函数来完成整个状态更新和历史记录流程。
    *   可能需要新增或修改内部状态来管理拖拽过程中的特定信息，如当前悬停的目标子Handle ID。

### 4. `apps/frontend-vueflow/src/components/graph/edges/UnplugConnectionLine.vue`
*   **现状**：此组件已存在。
*   **计划整合**：其现有样式和逻辑可以被复用或作为基础，用于实现连接线处于“拔出并重连”状态时的视觉反馈，以及高亮选中连接到特定子Handle的连接线。

### 5. 内联连接排序组件 (`InlineConnectionSorter.vue`)

为了解决画布内直接拖拽排序可能不够精确或在连接线较多时操作不便的问题，特别对于顺序敏感的多输入插槽（例如文本合并），引入一个内联的连接排序组件。

*   **目的**: 在 `BaseNode.vue` 内部，为 `multi: true` 的输入插槽提供一个用户友好的、紧凑的UI，用于重新排列已连接的边的顺序。
*   **集成方式**:
*   直接在 `BaseNode.vue` 的节点主体内，与对应的多输入插槽关联渲染。
*   通常显示在该插槽的参数头部 (`param-header`)下方。
*   **显示条件**: 仅当 `input.multi === true` 且该插槽的连接数大于1时显示。
*   **UI与交互**:
*   呈现为一个紧凑的可拖拽列表，每一项代表一条进入该插槽的连接。
*   列表项应清晰显示连接的来源信息（例如：源节点名称、源插槽名称）。
*   用户通过拖拽列表中的条目来改变连接的顺序。
*   **状态管理与历史记录**:
*   当用户完成拖拽操作并且连接顺序实际发生改变后：
    1.  组件根据新的列表顺序生成 `orderedEdgeIds` 数组。
    2.  创建一个 `HistoryEntry` 对象，记录操作类型（例如 `'reorder'`）、对象类型（`'nodeInputConnectionOrder'`）、操作摘要以及新旧顺序等详细信息。
    3.  调用工作流交互协调器中的相应函数（例如 `interactionCoordinator.updateNodeInputConnectionOrderAndRecord(...)`），传递节点ID、插槽key、新的 `orderedEdgeIds` 以及创建的 `HistoryEntry` 对象。
    4.  协调器函数负责更新 `workflowStore` 中对应节点的 `inputConnectionOrders` 并记录此次原子操作。
*   **核心 Props**:
*   `nodeId: string`
*   `inputHandleKey: string`
*   `currentOrderedEdgeIds: string[]` (从 `BaseNode` 传入的当前连接顺序)
*   `inputDefinition: InputDefinition` (相关的输入定义)
*   `allEdges: Edge[]` (当前工作流的所有边，用于查找连接详情)
*   `findNode: (id: string) => Node | undefined` (VueFlow 实例的 `findNode` 函数)
*   `getNodeLabel: (nodeId: string) => string` (获取节点可读标签的辅助函数)
*   **设计参考**: 其内联呈现方式参考了节点内部其他输入控件（如 `JsonInlineViewer.vue`）的集成模式，但功能上专注于连接排序。其状态更新和历史记录模式参考了项目中其他对工作流进行修改的组件（如 `GroupIOEdit.vue`）的实践。

## IV. 原子化历史记录与协调器

遵循 [`DesignDocs/architecture/history-recording-pattern.md`](DesignDocs/architecture/history-recording-pattern.md) 的核心原则。

### 1. 核心协调器函数 (在 `apps/frontend-vueflow/src/composables/workflow/useWorkflowInteractionCoordinator.ts` 中)
*   **通用原则**：保持不变。
*   **建议的协调器函数 (调整)**：
    *   **`moveAndReconnectEdgeAndRecord(...)`**:
        *   **参数**：`originalTargetHandleId` 和 `newTargetHandleId` 现在需要能表示子Handle的唯一ID (例如 `originalKey__index`)。`newTargetIndexInOrder?` 可能不再直接是数字索引，而是通过 `newTargetHandleId` 间接确定顺序。
        *   **职责**：处理连接在不同Handle（包括子Handle）之间的移动。
        *   **原子操作**：更新边的 `targetHandle` 为新的子Handle ID，并更新 `inputConnectionOrders`。
    *   **`updateNodeInputConnectionOrderAndRecord(...)`**:
        *   **参数**：`handleKey` 指的是原始的多输入插槽逻辑名。`newOrderedEdgeIds` 可能需要调整为 `newOrderedTargetHandleIds` 或一个更复杂的结构，以表示边与子Handle的映射关系和顺序。
        *   **职责**：当用户通过交互（例如，将边从子Handle A 移到子Handle B）改变了连接到同一逻辑输入下的不同子Handle的顺序时调用。
    *   **`disconnectEdgeFromInputAndRecord(...)`**:
        *   **参数**：`originalTargetHandleId` 现在是子Handle的唯一ID。
        *   **职责**: 处理边从特定**子Handle**断开的操作，并更新 `inputConnectionOrders`。
    *   **`connectEdgeToInputAndRecord(...)`**:
        *   **参数**：`newEdgeParams` 中的 `targetHandle` 应为目标**子Handle**的唯一ID。`targetIndexInOrder?` 的作用可能由目标子Handle的ID隐式包含。
        *   **职责**: 处理边连接到特定**子Handle**的操作，并更新 `inputConnectionOrders`。

### 2. 调用流程
*   基本保持不变，但传递给协调器函数的 `handleId` 参数现在必须是精确的子Handle ID。

## V. 交互流程示意图 (修订)

```mermaid
graph TD
    subgraph "拖拽连接线到多输入插槽 (多子Handle)"
        A1[开始: 拖拽连接线] --> B1{进入多输入插槽区域?};
        B1 -- 是 --> C1[根据Y坐标计算目标子Handle ID (key__index)];
        C1 --> C2[高亮目标子Handle];
        C2 --> D1{在目标子Handle区域释放?};
        D1 -- 是 --> E1(创建 HistoryEntry: '连接到子Handle');
        E1 --> F1(调用协调器: connectEdgeToInputAndRecord with targetHandleId=key__index);
        F1 -- 状态有变更? --> G1[状态更新: 添加边, 更新inputConnectionOrders, 记录历史];
        F1 -- 状态无变更 --> G1_NO[不记录历史, 状态不变];
        D1 -- 否 (释放到其他地方) --> H1[标准连接/取消];
        B1 -- 否 --> H1;
    end

    subgraph "从已连接子Handle拖拽 (拔出)"
        A2[开始: 从已连接子Handle (key__index) 拖拽] --> B2(阻止默认行为, 进入'拔出'状态);
        B2 --> C2_RECONNECT{释放到兼容插槽 (含其他子Handle)?};
        C2_RECONNECT -- 是 --> D2(创建 HistoryEntry: '移动连接');
        D2 --> E2(调用协调器: moveAndReconnectEdgeAndRecord with newTargetHandleId);
        E2 -- 状态有变更? --> F2[状态更新: 更新边, 更新orders, 记录历史];
        E2 -- 状态无变更 (插回原子Handle且顺序不变) --> F2_NO[不记录历史, 状态不变];
        C2_RECONNECT -- 否 (释放到空白) --> D3(创建 HistoryEntry: '断开连接');
        D3 --> E3(调用协调器: disconnectEdgeFromInputAndRecord with originalTargetHandleId=key__index);
        E3 --> F3[状态更新: 移除边, 更新orders, 记录历史];
    end

    subgraph "在多输入插槽内“排序”(边重连接到不同子Handle)"
        A3[开始: 从子Handle A (key__idxA) 拔出连接线] --> B3_DRAG[拖拽连接线];
        B3_DRAG --> C3_TARGET{悬停到同一逻辑输入下的子Handle B (key__idxB)?};
        C3_TARGET -- 是 --> D4_HIGHLIGHT[高亮子Handle B];
        D4_HIGHLIGHT --> E4_RELEASE{在子Handle B 区域释放?};
        E4_RELEASE -- 是 --> F4_ENTRY(创建 HistoryEntry: '更新连接顺序/移动连接');
        F4_ENTRY --> G4_COORD(调用协调器: moveAndReconnectEdgeAndRecord with targetHandleId=key__idxB);
        G4_COORD -- 顺序有变更? --> H4_UPDATE[状态更新: 更新边targetHandle, 更新orders, 记录历史];
        G4_COORD -- 顺序无变更 --> H4_NO[不记录历史, 状态不变];
        C3_TARGET -- 否 (拖出至其他区域) --> A2; // 转为标准拔出或连接逻辑
    end
```

## VI. 实施步骤建议

1.  **`BaseNode.vue` 核心重构 (渲染多个子Handle)** (对应计划 III.1)
    *   修改模板，为 `multi: true` 的输入使用 `v-for` 动态渲染多个独立的 `<Handle>` 实例（子Handle）。
    *   确保每个子Handle有唯一的ID (如 `originalKey__index`)。
    *   实现子Handle的垂直布局和间距。
    *   移除或重构 `getDynamicHandleStyles` 和相关的单Handle拉伸逻辑。
    *   确保每个子Handle能正确响应鼠标事件并传递其唯一ID。
2.  **`useCanvasConnections.ts` 调整** (对应计划 III.3)
    *   修改其核心事件处理器 (`onConnectStart`, `onConnectEnd`, `onEdgeUpdateEnd` 等)，使其能够处理和传递子Handle的唯一ID。
    *   确保调用协调器函数时传递正确的子Handle ID。
3.  **协调器函数 (`useWorkflowInteractionCoordinator.ts`) 增强** (对应计划 IV.1)
    *   更新相关协调器函数的参数和内部逻辑，以正确处理基于子Handle ID的连接、断开和顺序更新。
    *   确保 `inputConnectionOrders` (或类似结构) 能正确反映边与子Handle的映射和逻辑顺序。
4.  **移除或替代 `SortedMultiTargetEdge.vue`** (对应计划 III.2)
    *   尝试使用Vue Flow的默认边组件。如果需要自定义样式，可以创建一个通用的自定义边组件。
5.  **视觉反馈组件整合/增强** (对应计划 III.4)
    *   确保 [`UnplugConnectionLine.vue`](apps/frontend-vueflow/src/components/graph/edges/UnplugConnectionLine.vue) 能够配合新的子Handle结构工作。
6.  **全面测试** (对应计划 VII)

## VII. 测试重点

*   **视觉呈现**：
    *   多输入插槽是否在视觉上呈现为一个统一的、跑道式的区域，符合Blender风格？
    *   即使没有连接，该跑道区域是否也按预期显示了最小尺寸/外观？当有连接时，其外观是否能容纳并暗示这些连接点？
*   **交互精确性**：
    *   连接线能否精确地连接到目标子Handle？
    *   从子Handle“拔出”连接的行为是否符合预期？
    *   能否将一条边从一个子Handle移动到同一逻辑输入下的另一个子Handle，并正确更新其逻辑顺序？
    *   高亮选中连接到特定子Handle的连接线或子Handle本身是否可靠？
*   **历史记录原子性与准确性**：
    *   所有涉及子Handle的交互操作是否都只产生一条历史记录？
    *   “无实际状态变更则不记录历史”的原则是否有效？
    *   撤销/重做操作是否能正确恢复状态？
*   **边界条件**：没有连接的多输入插槽、只有一个连接的多输入插槽、多个连接的多输入插槽。
*   **兼容性**：确保不影响单输入/单输出插槽的现有行为。