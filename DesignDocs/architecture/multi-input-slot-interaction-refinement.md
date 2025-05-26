# 多输入插槽交互精炼与原子化历史记录计划

## I. 引言

本计划旨在解决当前多输入插槽在交互精确性（尤其是在连接线排序和插入方面）的局限性，并优化相关操作的历史记录机制，确保其原子性和有效性。目标是实现类似 Blender 的流畅、直观的多输入插槽交互体验。

核心改进点包括：

1.  **精确的“伪多插槽”交互**：实现拖拽连接时的精确插入点预览、实际插入，以及在插槽内部直接拖拽排序。
2.  **优化的连接线操作**：支持高亮选中特定连接线，并改进从已连接输入端“拔出”连接的行为。
3.  **原子化且智能的历史记录**：确保所有相关操作在历史记录中表现为单一、清晰的条目，并遵循“无实际状态变更则不记录历史”的原则。

本文档将详细阐述为达成上述目标所需的核心交互逻辑增强、关键组件的调整、新的协调器函数设计以及实施步骤。

## II. 核心交互逻辑增强 (Blender 式)

### 1. 从已连接的输入插槽拖拽 (拔出连接)
*   **触发**：当用户从一个已经有连接的输入类型 Handle (target handle) 开始拖拽时。
*   **行为**：
    *   阻止 VueFlow 默认创建一条全新边的行为。
    *   当前被拖拽的连接线进入“拔出”(unplugged) 或“预备重连”(disconnect & reconnect) 状态。
    *   视觉上，这条被“拔出”的连接线应有特殊指示（例如，使用 [`apps/frontend-vueflow/src/components/graph/edges/UnplugConnectionLine.vue`](apps/frontend-vueflow/src/components/graph/edges/UnplugConnectionLine.vue) 的样式或类似效果）。
*   **后续交互**：
    *   用户可以将这条“拔出”的边连接到任何其他兼容的插槽（源或目标）。
    *   如果释放到画布空白处，则该连接被彻底断开。
    *   如果拖拽后释放回原始插槽的原始位置（且对于多输入插槽，其顺序未变），则不应产生新的历史记录。

### 2. 拖拽连接线至多输入插槽 (精确插入)
*   **触发**：当用户拖拽一条新的连接线或一条“拔出”的连接线，其末端进入一个 `multi: true` 的输入插槽的交互区域（“胶囊区域”）时。
*   **行为**：
    *   **高亮目标插槽**：整个多输入插槽的 Handle 区域高亮，表明其可作为连接目标。
    *   **插入点预览**：
        *   根据鼠标指针在胶囊区域内的垂直位置，动态计算并显示一个清晰的“预插入”视觉指示。
        *   此指示可以是在现有连接线之间撑开一个适当的间隙（例如 4px），或者显示一个半透明的占位线条/标记。
        *   如果该多输入插槽当前没有连接，则预插入指示显示在插槽的中间位置。
        *   当鼠标在胶囊区域内垂直移动时，预插入指示的位置也应随之实时更新。
*   **释放连接**：
    *   如果在胶囊区域内释放鼠标，连接线将精确地连接到预插入指示所标明的位置。
    *   目标节点的 `inputConnectionOrders` 数组将相应更新，以反映新连接线插入后的顺序。
    *   此操作（添加新连接并确定其顺序）应记录为一次原子的历史。

### 3. 多输入插槽内直接拖拽排序与选中高亮
*   **交互区域**：定义多输入插槽的 Handle 及其紧邻的垂直区域为“胶囊交互区域”。
*   **阶段 A: 选中目标连接线 (高亮)**
    *   **触发方式 1 (悬停/接近)**：当鼠标指针在胶囊交互区域内，靠近或悬停在某条已连接的线上方时。
    *   **触发方式 2 (轻微拖拽意图)**：当鼠标在某条已连接的线上按下左键，并有轻微的垂直拖拽意图（未大幅移出该连接线范围）时。
    *   **视觉反馈**：被选中的那条连接线应显著高亮（可利用或扩展 [`UnplugConnectionLine.vue`](apps/frontend-vueflow/src/components/graph/edges/UnplugConnectionLine.vue) 的样式）。其他未被选中的连接线可以略微降低透明度或饱和度，以突出显示选中的连接。
*   **阶段 B: 拖拽已选中的连接线进行排序或拔出**
    *   **在胶囊区域内垂直拖拽 (排序)**：
        *   **视觉反馈**：当选中的连接线在胶囊区域内被垂直拖拽时，实时显示它将被插入的新排序位置（例如，在其他连接线之间撑开一个动态的间隙作为预览）。
        *   **释放操作**：释放鼠标后，如果其排序位置相较于拖拽前发生了实际变化，则更新该节点对应输入插槽的 `inputConnectionOrders` 数组。此操作应记录为一次原子的“更新连接顺序”历史。如果释放后顺序未变，则不记录历史。
    *   **拖出胶囊区域 (拔出)**：
        *   一旦选中的连接线被拖出胶囊交互区域，其状态立即转为“拔出连接”状态，后续交互同上述“II.1. 从已连接的输入插槽拖拽 (拔出连接)”逻辑。

## III. 关键组件的必要调整/增强

### 1. `apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue`
*   **Handle 交互增强**：
    *   输入类型的 `<Handle>` 组件（特别是 `multi: true` 的）或其父容器，需要更精细地捕获和处理 `mousedown`, `mousemove`, `mouseup`, `mouseenter`, `mouseleave` 等鼠标事件。
    *   这些事件处理需用于实现上述的选中高亮、插入点预览、以及触发插槽内拖拽排序的起始和结束逻辑。
    *   需要与 [`useCanvasConnections.ts`](apps/frontend-vueflow/src/composables/canvas/useCanvasConnections.ts) 进行紧密协作，可能通过触发自定义事件或调用其暴露的函数来传递更丰富的交互状态和参数（例如，鼠标在 Handle 内的精确 Y 坐标、当前悬停/选中的连接线 ID 等）。
*   **预插入点视觉指示渲染**：
    *   当拖拽连接线悬停在多输入插槽上时，`BaseNode.vue` 需要根据从交互逻辑中获取的预插入位置信息，动态地在其 Handle 区域渲染出视觉间隙或占位符。这可能通过计算样式或添加临时 DOM 元素实现。
*   **动态样式与拉伸**：原有的 Handle 动态高度和跑道形样式逻辑（IV.3）依然适用，并可能需要微调以适应新的交互细节。

### 2. `apps/frontend-vueflow/src/components/graph/edges/SortedMultiTargetEdge.vue`
*   **现状**：此组件已存在。
*   **计划增强**：
    *   确保其能完美配合新的、更精确的 `inputConnectionOrders` 数据进行边的垂直偏移计算和渲染。
    *   当插槽内发生拖拽排序并实时预览时，此组件可能需要更频繁或更平滑地响应排序变化以重绘受影响的边。

### 3. `apps/frontend-vueflow/src/composables/canvas/useCanvasConnections.ts`
*   **现状**：这是处理所有画布连接、边更新等交互的核心。
*   **计划重构/增强**：
    *   **`onConnectStart`**：当从已连接的输入 Handle 开始拖拽时，应阻止默认行为，并设置一个表示“拔出”的状态。
    *   **`onConnectEnd` / `onEdgeUpdateEnd`**：
        *   需要能识别拖拽操作的目标是否为多输入插槽，并根据鼠标精确位置计算目标索引。
        *   在处理连接到多输入插槽、从多输入插槽拔出、或在多输入插槽内排序等复杂操作时，不再直接调用底层的 `addEdges/removeEdges` 或直接修改 `workflowManager` 的状态。
        *   而是，收集所有必要的参数（如原始连接信息、新连接信息、目标节点ID、Handle Key、目标顺序索引等）。
        *   创建描述该原子操作的 `HistoryEntry` 对象。
        *   调用在 `useWorkflowInteractionCoordinator.ts` 中定义的、新的或增强的协调器函数来完成整个状态更新和历史记录流程。
    *   可能需要新增或修改内部状态来管理拖拽过程中的特定信息，如当前是否在多输入插槽内进行排序预览，或预期的插入索引。

### 4. `apps/frontend-vueflow/src/components/graph/edges/UnplugConnectionLine.vue`
*   **现状**：此组件已存在，并包含用于高亮显示“拔出”状态连接线的样式。
*   **计划整合**：其现有样式和逻辑可以被复用或作为基础，用于实现：
    *   “阶段 A: 选中目标连接线 (高亮)”的视觉效果。
    *   连接线处于“拔出并重连”状态时的视觉反馈。

## IV. 原子化历史记录与协调器

遵循 [`DesignDocs/architecture/history-recording-pattern.md`](DesignDocs/architecture/history-recording-pattern.md) 的核心原则，所有涉及连接线修改的交互最终都应通过 `useWorkflowInteractionCoordinator.ts` 中的协调器函数来完成状态更新和历史记录。

### 1. 核心协调器函数 (在 `apps/frontend-vueflow/src/composables/workflow/useWorkflowInteractionCoordinator.ts` 中)
*   **通用原则**：
    *   每个函数负责一个原子的用户操作。
    *   在执行任何状态修改前，获取当前状态快照以确定原始状态。
    *   在准备好 `nextSnapshot` 后，与原始状态进行比较。**只有当检测到实际状态变更时**，才调用 `workflowManager.setElements` (或相关方法) 并通过 `historyManager.recordSnapshot` 记录历史。
*   **建议的协调器函数 (可能需要根据实际情况调整或新增)**：
    *   **`moveAndReconnectEdgeAndRecord(...)`**:
        *   **参数**：`internalId`, `edgeToMoveId`, `originalSourceNodeId`, `originalSourceHandleId`, `originalTargetNodeId`, `originalTargetHandleId` (及原始顺序信息), `newSourceNodeId`, `newSourceHandleId`, `newTargetNodeId`, `newTargetHandleId`, `newTargetIndexInOrder?` (如果目标是多输入)。
        *   **职责**：处理将一条现有连接从其旧的连接点移动到新的连接点。包括处理从单输入到多输入、多输入到单输入、多输入到多输入（可能涉及顺序改变）等情况。
        *   **原子操作**：内部逻辑可能涉及移除旧边、添加新边、更新一个或两个节点的 `inputConnectionOrders`。
        *   **变更检测**：比较所有最终连接参数（包括顺序）与原始参数。
        *   **`HistoryEntry`**：类型 `'move'`, 对象 `'edge'`。
    *   **`updateNodeInputConnectionOrderAndRecord(...)`**:
        *   **参数**：`internalId`, `nodeId`, `handleKey`, `newOrderedEdgeIds`。
        *   **职责**：专门用于更新单个多输入插槽的连接顺序（通常由插槽内拖拽排序触发）。
        *   **变更检测**：比较 `newOrderedEdgeIds` 与当前 `inputConnectionOrders[handleKey]`。
        *   **`HistoryEntry`**：类型 `'reorder'`, 对象 `'nodeInputConnectionOrder'`。
    *   **`disconnectEdgeFromInputAndRecord(...)`**:
        *   **参数**：`internalId`, `edgeId`, `originalTargetNodeId`, `originalTargetHandleId`。
        *   **职责**: 处理边从输入端断开的操作，并更新原目标节点的 `inputConnectionOrders` (如果它是多输入插槽)。
        *   **`HistoryEntry`**：类型 `'delete'`, 对象 `'edge'`。
    *   **`connectEdgeToInputAndRecord(...)`**:
        *   **参数**：`internalId`, `newEdgeParams` (包含 source/target node/handle), `targetIndexInOrder?`。
        *   **职责**: 处理边连接到输入端的操作，并更新目标节点的 `inputConnectionOrders` (如果它是多输入插槽，通过 `targetIndexInOrder` 指定插入位置)。
        *   **`HistoryEntry`**：类型 `'create'`, 对象 `'edge'`。

### 2. 调用流程
*   [`apps/frontend-vueflow/src/composables/canvas/useCanvasConnections.ts`](apps/frontend-vueflow/src/composables/canvas/useCanvasConnections.ts) 中的相关事件处理器（如 `onConnectEnd`, `onEdgeUpdateEnd`）在完成用户交互的意图判断后，将不再直接修改状态或调用 `workflowManager` 的底层方法。
*   它们将负责：
    1.  收集完成一个原子操作所需的所有参数。
    2.  使用 `@comfytavern/utils` 中的 `createHistoryEntry` 函数，创建一个描述该原子操作的 `HistoryEntry` 对象（包含操作类型、对象类型、摘要和详细信息）。
    3.  调用 `workflowStore` 中暴露的、对应上述新的或增强的协调器函数，将参数和 `HistoryEntry` 对象传递过去。

## V. 交互流程示意图 (修订)

```mermaid
graph TD
    subgraph "拖拽连接线到多输入插槽"
        A1[开始: 拖拽连接线] --> B1{进入多输入插槽胶囊区?};
        B1 -- 是 --> C1[高亮插槽, 根据Y坐标显示预插入位置];
        C1 --> D1{在胶囊区内释放?};
        D1 -- 是 --> E1(创建 HistoryEntry: '连接新边并排序');
        E1 --> F1(调用协调器: connectEdgeToInputAndRecord);
        F1 -- 状态有变更? --> G1[状态更新: 添加边, 更新inputConnectionOrders, 记录历史];
        F1 -- 状态无变更 --> G1_NO[不记录历史, 状态不变];
        D1 -- 否 (释放到其他地方) --> H1[标准连接/取消];
        B1 -- 否 --> H1;
    end

    subgraph "从已连接输入端拖拽 (拔出)"
        A2[开始: 从已连接输入端拖拽] --> B2(阻止默认行为, 进入'拔出'状态);
        B2 --> C2{释放到兼容插槽?};
        C2 -- 是 --> D2(创建 HistoryEntry: '移动连接');
        D2 --> E2(调用协调器: moveAndReconnectEdgeAndRecord);
        E2 -- 状态有变更? --> F2[状态更新: 移除旧边, 添加新边, 更新orders, 记录历史];
        E2 -- 状态无变更 (插回原位且顺序不变) --> F2_NO[不记录历史, 状态不变];
        C2 -- 否 (释放到空白) --> D3(创建 HistoryEntry: '断开连接');
        D3 --> E3(调用协调器: disconnectEdgeFromInputAndRecord);
        E3 --> F3[状态更新: 移除边, 更新orders, 记录历史];
    end

    subgraph "在多输入插槽内拖拽排序"
        A3[开始: 在胶囊区选中一条线并拖拽] --> B3[实时预览新排序位置];
        B3 --> C3{在胶囊区内释放?};
        C3 -- 是 --> D4(创建 HistoryEntry: '更新连接顺序');
        D4 --> E4(调用协调器: updateNodeInputConnectionOrderAndRecord);
        E4 -- 顺序有变更? --> F4[状态更新: 更新inputConnectionOrders, 记录历史];
        E4 -- 顺序无变更 --> F4_NO[不记录历史, 状态不变];
        C3 -- 否 (拖出胶囊区) --> A2; // 转为拔出逻辑
    end
```

## VI. 实施步骤建议

1.  **协调器函数实现与增强** (对应计划 IV)
    *   在 [`apps/frontend-vueflow/src/composables/workflow/useWorkflowInteractionCoordinator.ts`](apps/frontend-vueflow/src/composables/workflow/useWorkflowInteractionCoordinator.ts) 中实现或增强上述协调器函数。
    *   **核心**：确保每个函数都包含变更检测逻辑，并且只有在实际状态改变时才记录历史。
    *   在 [`apps/frontend-vueflow/src/stores/workflowStore.ts`](apps/frontend-vueflow/src/stores/workflowStore.ts) 中正确导出这些函数。
2.  **`useCanvasConnections.ts` 重构** (对应计划 III.3)
    *   修改其核心事件处理器 (`onConnectStart`, `onConnectEnd`, `onEdgeUpdateEnd` 等)，使其调用新的协调器函数，而不是直接操作状态。
    *   实现对从已连接输入端拖拽行为的阻止和“拔出”状态的设置。
3.  **`BaseNode.vue` 交互增强** (对应计划 III.1)
    *   实现多输入插槽 Handle 区域的精细鼠标事件处理。
    *   实现插入点预览的动态渲染逻辑。
    *   确保与 `useCanvasConnections.ts` 的正确通信。
4.  **视觉反馈组件整合/增强**
    *   增强 [`SortedMultiTargetEdge.vue`](apps/frontend-vueflow/src/components/graph/edges/SortedMultiTargetEdge.vue) (对应计划 III.2)。
    *   整合 [`UnplugConnectionLine.vue`](apps/frontend-vueflow/src/components/graph/edges/UnplugConnectionLine.vue) 的功能 (对应计划 III.4)。
5.  **可选辅助组件 (`MultiHandleSortControl.vue`)**
    *   如果决定实现，确保其调用新的协调器函数。 (路径：`apps/frontend-vueflow/src/components/graph/controls/MultiHandleSortControl.vue` (新建))
6.  **全面测试** (对应计划 VII)

## VII. 测试重点

*   **交互精确性**：
    *   连接线能否精确插入到多输入插槽的预览位置？
    *   插槽内拖拽排序是否准确，预览是否清晰？
    *   高亮选中连接线是否可靠？
    *   从输入端“拔出”连接的行为是否符合预期？
*   **历史记录原子性与准确性**：
    *   所有新的交互操作（移动、排序、精确插入/断开）是否都只产生一条历史记录？
    *   “无实际状态变更则不记录历史”的原则是否在所有相关场景下都有效（例如，拔出连接线又插回原位且顺序不变）？
    *   撤销/重做这些原子操作是否能正确恢复到操作前/后的状态？
*   **边界条件**：空插槽、单连接插槽、多连接插槽、大量连接的插槽。
*   **兼容性**：确保不影响单输入/单输出插槽的现有行为，以及节点组等其他功能的交互。