# 多输入插槽增强功能实施计划

## I. 引言

本计划旨在为支持多路连接的输入插槽（即 `multi: true` 的插槽）设计并实现一套增强的视觉表现和交互功能。主要目标包括：

1.  **动态高度**：插槽的视觉高度能根据连接到它的线的数量自动调整。
2.  **连线间隙**：多条线连接到同一个插槽时，它们之间能有预设的视觉间隙（例如 4px）。
3.  **连线排序**：用户可以通过一个专门的组件来查看和重新排列连接到该插槽的线的顺序。
4.  **持久化存储**：连线的顺序能够被保存并在加载工作流时恢复。

本计划将探讨并对比两种主要的实现方案：
*   **方案1：伪多Handle (Visual Multi-Handles)**
*   **方案2：单Handle内排序 + 自定义Edge渲染 (Sorted Connections via Custom Edge Rendering)**

## II. 数据结构定义 (通用部分)

1.  **目标**：定义用于存储连线顺序的数据结构。
2.  **修改点**：
    *   **`packages/types/src/node.ts`**:
        *   在 `WorkflowStorageNode` 接口中添加新属性：
          ```typescript
          export interface WorkflowStorageNode {
            // ... existing properties
            inputConnectionOrders?: Record<string, string[]>; // key: inputHandleId, value: ordered list of edgeIds
          }
          ```
    *   **`apps/frontend-vueflow/src/types/` (例如在一个新的 `nodeDataTypes.ts` 或现有的相关文件中)**:
        *   定义或更新前端节点数据类型 (例如 `ComfyTavernNodeData`)，使其包含：
          ```typescript
          export interface ComfyTavernNodeData {
            // ... other properties
            inputConnectionOrders?: Record<string, string[]>;
          }
          ```
        *   确保 VueFlow 的节点类型 `AppNode = VueFlowCoreNode<ComfyTavernNodeData>` 使用此更新后的数据类型。

## III. 连线排序组件 (`MultiHandleSortControl.vue`) (大部分通用)

1.  **目标**：创建一个 Vue 组件，允许用户查看和重新排列连接到特定多输入插槽的连线。
2.  **Props**：
    *   `nodeId: string`
    *   `handleKey: string`
    *   `inputDefinition: InputDefinition` (或 `GroupSlotInfo`)
3.  **核心功能**：
    *   获取连接到 `nodeId` 和 `handleKey` 的所有 `Edge` 对象。
    *   从对应节点的 `data.inputConnectionOrders[handleKey]` 获取当前连线顺序。
    *   若顺序不存在，则按当前获取的 `Edge` 对象的顺序作为初始顺序。
    *   列表形式展示连线，显示源节点和源插槽信息。
    *   允许用户通过拖拽排序。
    *   排序后，更新对应节点的 `data.inputConnectionOrders[handleKey]`。
    *   触发状态变更通知，以便记录历史和持久化。
4.  **用户交互细节**：
    *   **触发**：通过插槽右键菜单“排序连线”或插槽旁的小图标按钮。
    *   **界面**：模态框或紧凑型浮动面板。
    *   **显示**：清晰标识每条连线的来源。
    *   **操作**：拖放手柄，提供“确定”和“取消”。
5.  **方案差异**：核心逻辑对两种方案通用。

## IV. `BaseNode.vue` 的修改

1.  **目标**：根据连接数量和顺序调整多输入插槽的视觉表现。
2.  **通用修改**：
    *   能访问 `props.data.inputConnectionOrders`。
    *   提供触发“连线排序组件”的入口。
3.  **动态高度调整 (通用逻辑)**：
    *   计算 `connectionCount`。
    *   定义 `singleLineHeight` 和 `lineGap`。
    *   估算 `totalHeight = connectionCount * singleLineHeight + (connectionCount > 0 ? (connectionCount - 1) * lineGap : 0) + padding`。
    *   `totalHeight` 应用于包裹 Handle(s) 的父容器的 `min-height` 或 `height`。
4.  **方案1：“伪多Handle” 的实现**：
    *   **Handle 渲染**：
        *   对 `multi: true` 的输入，内部再循环（基于 `inputConnectionOrders` 或连接的边）。
        *   为每条边/顺序槽位渲染独立的 `<Handle>` 或模拟 Handle 的 `<div>`。
        *   “伪 Handle” ID 需唯一且能关联回原始 `input.key` 和顺序索引 (如 `String(input.key) + '_' + index`)。
        *   通过 CSS 定位和变换实现“伪 Handle”的垂直偏移和间隙。
    *   **连线目标**：`Edge` 对象的 `targetHandle` 需更新为这些“伪 Handle”的 ID。
5.  **方案2：“单Handle内排序 + 自定义Edge” 的实现**：
    *   **Handle 渲染**：
        *   对 `multi: true` 插槽，仍渲染单个标准 `<Handle>`。
        *   此 Handle 的父容器根据 `totalHeight` 动态调整高度，为自定义 Edge 的偏移提供空间。
    *   不修改 Handle ID 或 Edge 的 `targetHandle`。

## V. 自定义 Edge 组件 (仅方案2需要)

1.  **目标**：创建新 Vue 组件 (如 `SortedMultiTargetEdge.vue`) 替换默认边渲染。
2.  **Props**：接收标准 Edge props 及 VueFlow 实例。
3.  **核心逻辑**：
    *   获取目标节点及目标插槽的 `multi: true` 状态。
    *   若目标是 `multi: true`：
        *   从 `targetNode.data.inputConnectionOrders[props.targetHandle]` 获取当前边的顺序索引 (`edgeIndexInOrder`) 和总连接数 (`totalConnectionsInOrder`)。
        *   若无 `inputConnectionOrders`，则根据当前连接到该 Handle 的所有边确定顺序和总数。
        *   计算垂直偏移量 `verticalOffset`，基于 `edgeIndexInOrder`, `totalConnectionsInOrder`, `singleLineHeight`, `lineGap`。
        *   将 `verticalOffset` 应用到 `props.targetY` 得到 `finalTargetY`。
        *   使用 `finalTargetY` 和 `props.targetX` 计算 SVG 路径。
4.  **注册**：在 VueFlow 实例中注册此自定义 Edge 组件。

## VI. `useCanvasConnections.ts` 的修改

1.  **目标**：在创建和删除连接时，维护 `inputConnectionOrders`。
2.  **通用修改**：
    *   `handleConnect`：新边连接到 `multi: true` 插槽时，获取目标节点的 `data.inputConnectionOrders`，若无则初始化，然后将新 `newEdge.id` 添加到 `inputConnectionOrders[targetHandle]` 数组末尾。通过 store action 更新。
    *   删除边时：从 `inputConnectionOrders[targetHandle]` 数组中移除被删除边的 ID。通过 store action 更新。
3.  **方案1 (“伪多Handle”) 的特定修改**：
    *   `isValidConnection`, `createEdge`/`handleConnect` 需处理复合 `targetHandle` ID。
    *   `onConnectStart`/`onConnectEnd` 可能需特殊处理以确定连接到哪个“伪 Handle”。

## VII. 工作流加载/保存逻辑的修改 (通用)

1.  **目标**：确保 `inputConnectionOrders` 在持久化存储和前端运行时状态间正确转换。
2.  **修改点** (可能在 `apps/frontend-vueflow/src/utils/workflowTransformer.ts` 或 `apps/frontend-vueflow/src/composables/workflow/useWorkflowManager.ts` 等处)：
    *   **加载时**：`WorkflowStorageNode.inputConnectionOrders` 复制到 `VueFlowNode.data.inputConnectionOrders`。
    *   **保存时**：`VueFlowNode.data.inputConnectionOrders` 复制回 `WorkflowStorageNode.inputConnectionOrders`。

## VIII. 状态管理 (`workflowStore`) (通用)

1.  **目标**：提供 actions 原子性更新节点数据（含 `inputConnectionOrders`）并处理历史记录。
2.  **新的 Actions (示例)**：
    *   `updateNodeInputConnectionOrder(tabId: string, nodeId: string, handleKey: string, orderedEdgeIds: string[], historyEntry: HistoryEntry)`
    *   在现有 `addEdgeAndRecord`, `removeEdgeAndRecord` 中集成对 `inputConnectionOrders` 的更新。

## IX. 实施步骤建议

1.  **数据结构先行** (第 II 部分)。
2.  **加载/保存逻辑** (第 VII 部分)。
3.  **`useCanvasConnections` 修改** (第 VI 部分通用修改)。
4.  **连线排序组件基础** (第 III 部分)。
5.  **选择并实施视觉方案**：
    *   **方案2 (单Handle内排序 + 自定义Edge)**：实现第 V 部分 (自定义Edge) 和 第 IV 部分方案2的 `BaseNode.vue` 修改。
    *   **方案1 (伪多Handle)**：实现第 IV 部分方案1的 `BaseNode.vue` 修改和第 VI 部分方案1的 `useCanvasConnections.ts` 修改。
6.  **完善交互和细节**。
7.  **全面测试**。