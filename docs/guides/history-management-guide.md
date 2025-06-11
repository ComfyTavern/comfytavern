# ComfyTavern 工作流历史记录与状态管理指南

## 一、 引言

在 ComfyTavern 中，一个健壮的历史记录系统（支持撤销/重做）对于提供流畅的用户体验和保证复杂工作流状态的一致性至关重要。本指南详细介绍了用于实现此功能的模式和核心组件。该模式确保了对工作流状态的修改能够被正确地捕获、记录，并且可以可靠地回滚或重放。

核心组件包括：
-   `useWorkflowManager`: 状态的中心管理者。
-   `useWorkflowHistory`: 历史快照的记录和管理。
-   `useWorkflowInteractionCoordinator`: 编排状态更新和历史记录流程。
-   `workflowStore`: Pinia store，作为 UI 和底层逻辑与协调器交互的桥梁。
-   `HistoryEntry` 类型和 `createHistoryEntry` 工具函数：用于结构化地描述历史操作。

## 二、 核心设计原则

ComfyTavern 的历史记录模式遵循以下核心原则：

1.  **状态管理的中心化 (`useWorkflowManager`)**:
    *   所有核心工作流状态，特别是 `elements` 数组（包含节点和边）、`viewport`（视口信息）以及 `workflowData`（工作流元数据，如名称、描述、接口定义等），都由 [`apps/frontend-vueflow/src/composables/workflow/useWorkflowManager.ts`](apps/frontend-vueflow/src/composables/workflow/useWorkflowManager.ts:1) 统一管理。
    *   `useWorkflowManager` 是工作流状态的唯一真实来源。任何对这些核心状态的持久化修改都必须通过它提供的 API 进行。

2.  **交互协调层 (`useWorkflowInteractionCoordinator`)**:
    *   [`apps/frontend-vueflow/src/composables/workflow/useWorkflowInteractionCoordinator.ts`](apps/frontend-vueflow/src/composables/workflow/useWorkflowInteractionCoordinator.ts:1) 扮演着状态更新和历史记录流程的“编排者”角色。
    *   当用户执行一个需要记录的操作时，协调器负责：
        1.  获取当前状态快照。
        2.  准备包含更改的下一个状态快照。
        3.  调用 `useWorkflowManager` 的方法来应用状态更新。
        4.  调用 `useWorkflowHistory` 的方法来记录包含操作描述和新状态快照的历史条目。
    *   这种方式确保了状态更新和历史记录的原子性。

3.  **触发源 (UI层/底层Composable -> `workflowStore`)**:
    *   用户在界面上的交互（例如，在 [`apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue:1) 中修改节点输入值）或底层逻辑（例如，在 [`apps/frontend-vueflow/src/composables/node/useNodeState.ts`](apps/frontend-vueflow/src/composables/node/useNodeState.ts:1) 中处理节点数据变化）是历史记录流程的起点。
    *   这些触发源不直接修改全局状态或记录历史。相反，它们会调用 [`apps/frontend-vueflow/src/stores/workflowStore.ts`](apps/frontend-vueflow/src/stores/workflowStore.ts:1) 中暴露的相应方法。
    *   `workflowStore` 进而调用 `useWorkflowInteractionCoordinator` 中的函数来执行实际的操作和历史记录。

4.  **不可变性与快照 (`klona`)**:
    *   为了确保历史记录的正确性和状态隔离，在记录历史或准备新状态时，会使用深拷贝工具（如 `klona`）创建状态对象的副本。
    *   这意味着历史记录中的每个快照都是其记录时刻状态的一个完整、独立的副本，不受后续状态更改的影响。

## 三、 关键组件及其职责

### 1. `useWorkflowManager`

-   **位置**: [`apps/frontend-vueflow/src/composables/workflow/useWorkflowManager.ts`](apps/frontend-vueflow/src/composables/workflow/useWorkflowManager.ts:1)
-   **职责**:
    *   管理每个活动标签页的完整工作流状态 (`TabWorkflowState`)。这包括：
        *   `elements`: `VueFlowNode[] | VueFlowEdge[]` - 画布上的节点和边。
        *   `viewport`: 画布的视口状态（位置、缩放）。
        *   `workflowData`: 工作流的元数据，如 `id`, `name`, `description`, `interfaceInputs`, `interfaceOutputs` 等。
    *   提供获取和修改这些核心状态的 API。
-   **关键API**:
    *   `getCurrentSnapshot(internalId: string): WorkflowStateSnapshot | undefined`: 返回指定标签页当前完整状态的深拷贝快照。这是进行任何修改前获取当前状态的标准方法。
    *   `applyStateSnapshot(internalId: string, snapshot: WorkflowStateSnapshot): boolean`: 应用一个给定的状态快照来恢复标签页的状态。此方法主要由历史记录系统（撤销/重做）使用，它本身 *不会* 记录新的历史条目，也不会自动标记为“脏”状态。
    *   核心状态更新方法，例如：
        *   `setElements(internalId: string, elements: Array<VueFlowNode | VueFlowEdge>)`: 更新画布元素。
        *   `setElementsAndInterface(internalId: string, elements: Array<VueFlowNode | VueFlowEdge>, inputs: Record<string, GroupSlotInfo>, outputs: Record<string, GroupSlotInfo>)`: 原子性地更新元素和工作流接口定义。
        *   `addNode(internalId: string, nodeToAdd: VueFlowNode)`: 添加单个节点。
        *   `updateNodePositions(internalId: string, updates: { nodeId: string; position: { x: number; y: number } }[])`: 更新节点位置。
        *   `updateWorkflowName(internalId: string, newName: string)`: 更新工作流名称。
        *   `updateWorkflowDescription(internalId: string, newDescription: string)`: 更新工作流描述。
    *   这些更新方法是唯一应该直接修改核心工作流状态的地方，并且它们通常会处理“脏”状态的标记。

### 2. `useWorkflowHistory`

-   **位置**: [`apps/frontend-vueflow/src/composables/workflow/useWorkflowHistory.ts`](apps/frontend-vueflow/src/composables/workflow/useWorkflowHistory.ts:1)
-   **职责**:
    *   为每个工作流标签页（通过 `internalId` 区分）维护一个历史记录栈。
    *   栈中的每一项 (`HistoryItem`) 包含描述操作的 `entry` 和该操作完成后的状态 `payload`。
    *   支持撤销 (undo) 和重做 (redo) 操作。
-   **数据结构**:
    *   `HistoryItem`:
        *   `entry: HistoryEntry`: 描述操作的元数据对象 (详见下文)。
        *   `payload: WorkflowStateSnapshot`: 该操作执行完毕后的完整工作流状态快照。
-   **关键API**:
    *   `recordSnapshot(internalId: string, entry: HistoryEntry, payload: WorkflowStateSnapshot)`: 将一个新的历史条目（包含操作描述 `entry` 和操作后的状态快照 `payload`）添加到对应标签页的历史栈中。此方法会处理历史记录的最大长度限制 (`MAX_HISTORY_LENGTH`)。传入的 `payload` 应该是操作完成 *之后* 的状态。
    *   `undo(internalId: string): WorkflowStateSnapshot | null`: 回退到上一个历史状态，并返回该状态的快照。如果无法撤销，则返回 `null`。
    *   `redo(internalId: string): WorkflowStateSnapshot | null`: 前进到下一个历史状态（如果之前执行过撤销），并返回该状态的快照。如果无法重做，则返回 `null`。
    *   `markAsSaved(internalId: string)`: 将当前的历史记录点标记为“已保存”状态，用于判断是否有未保存的更改。
    *   `clearHistory(internalId: string)`: 清除指定标签页的所有历史记录。
    *   `canUndo(internalId: string): ComputedRef<boolean>`: 计算属性，判断当前是否可以执行撤销操作。
    *   `canRedo(internalId: string): ComputedRef<boolean>`: 计算属性，判断当前是否可以执行重做操作。
    *   `getHistorySummaries(internalId: string): ComputedRef<string[]>`: 获取用于在UI（如历史面板）中显示的简短操作摘要列表。

### 3. `useWorkflowInteractionCoordinator` (模式核心)

-   **位置**: [`apps/frontend-vueflow/src/composables/workflow/useWorkflowInteractionCoordinator.ts`](apps/frontend-vueflow/src/composables/workflow/useWorkflowInteractionCoordinator.ts:1)
-   **职责**:
    *   作为所有涉及状态修改和历史记录的用户交互或系统事件的中心编排者。
    *   确保状态更新与历史记录以原子方式发生，并触发必要的副作用（例如，请求预览执行）。
-   **通用执行流程**:
    以 `updateNodeInputValueAndRecord` 为例，其内部遵循以下模式：
    1.  **获取当前快照**: 调用 `workflowManager.getCurrentSnapshot(internalId)` 获取操作前的完整状态。
    2.  **准备下一状态快照**: 使用 `klona(currentSnapshot)` 创建当前快照的深拷贝，得到 `nextSnapshot`。
    3.  **修改下一快照**: 在 `nextSnapshot` 上应用实际的更改（例如，更新目标节点的输入值）。
    4.  **应用状态更新**: 调用 `await workflowManager.setElements(internalId, nextSnapshot.elements)` (或其他必要的 `workflowManager` 更新函数) 来将 `nextSnapshot` 中的更改应用到实际的工作流状态中。`workflowManager` 内部会处理将此状态标记为“脏”。
    5.  **记录历史快照**: 在状态更新成功 *之后*，调用 `historyManager.recordSnapshot(internalId, entry, nextSnapshot)`，**务必传递已准备好的、包含修改的 `nextSnapshot`**。`entry` 对象是调用协调器函数时传入的，包含了对该操作的描述。
    6.  **(可选) 触发副作用**: 例如，如果预览功能已启用，则调用 `requestPreviewExecution()`。

### 4. `useNodeState` (触发源示例)

-   **位置**: [`apps/frontend-vueflow/src/composables/node/useNodeState.ts`](apps/frontend-vueflow/src/composables/node/useNodeState.ts:1)
-   **职责**:
    *   通常在具体的节点组件 (例如 [`apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue:1)) 内部使用。
    *   响应节点内部 UI 元素的交互，例如用户修改了输入字段的值或配置项。
-   **执行流程**:
    1.  当节点内部状态发生变化时（例如，用户在 `StringInput.vue` 中修改了文本）。
    2.  `useNodeState` 中的更新函数（如 `updateInputValue`）被调用。
    3.  该函数使用 [`@comfytavern/utils/src/historyUtils.ts`](packages/utils/src/historyUtils.ts:1) 中的 `createHistoryEntry()` 工具函数来创建一个结构化的 `HistoryEntry` 对象，该对象详细描述了所发生的操作（例如，哪个节点的哪个输入被修改，旧值是什么，新值是什么）。
    4.  然后，它调用 [`apps/frontend-vueflow/src/stores/workflowStore.ts`](apps/frontend-vueflow/src/stores/workflowStore.ts:1) 中暴露的相应协调器函数（例如 `workflowStore.updateNodeInputValueAndRecord()`），并将 `internalId`、操作参数以及创建的 `HistoryEntry` 对象传递过去。

### 5. `workflowStore` (Pinia Store - 外观/中介)

-   **位置**: [`apps/frontend-vueflow/src/stores/workflowStore.ts`](apps/frontend-vueflow/src/stores/workflowStore.ts:1)
-   **职责**:
    *   作为一个 Pinia Store，它向应用的其余部分（特别是UI组件、底层 Composable 如 `useNodeState`，以及顶层应用逻辑）暴露由 `useWorkflowInteractionCoordinator` 和 `useWorkflowLifecycleCoordinator` 提供的上层交互和生命周期函数。
    *   它简化了从应用其他部分访问这些核心工作流操作的接口。
    *   当处理顶层的撤销/重做命令时（例如，用户点击撤销按钮），`workflowStore` 中的 `undo()` / `redo()` 方法会：
        1.  调用 `useWorkflowHistory` 的 `undo()` / `redo()` 方法来获取目标历史状态快照。
        2.  调用 `useWorkflowManager.applyStateSnapshot()` 来应用快照中的核心数据（如 `workflowData`）。
        3.  直接使用 VueFlow 实例的命令式 API (通过 `useWorkflowViewManagement.getVueFlowInstance()`)，如 `instance.setNodes()`, `instance.setEdges()`, `instance.setViewport()`，来更新画布的显示，使其与恢复的状态快照一致。

### 6. `HistoryEntry` 类型

-   **定义位置**: [`@comfytavern/types/src/history.ts`](packages/types/src/history.ts:1)
-   **职责**: 提供一个标准化的结构来描述历史记录中的每一个操作。
-   **核心字段**:
    *   `actionType: string`: 描述操作的类型，例如：
        *   `'modify'` (修改现有属性)
        *   `'add'` (添加新元素)
        *   `'remove'` (移除元素)
        *   `'connect'` (连接边)
        *   `'disconnect'` (断开边)
        *   `'move'` (移动节点)
        *   `'sync'` (同步操作，如节点组接口同步)
    *   `objectType: string`: 描述被操作对象的类型，例如：
        *   `'nodeInput'` (节点输入值)
        *   `'nodeConfig'` (节点配置值)
        *   `'node'` (整个节点)
        *   `'edge'` (连接边)
        *   `'workflowProperty'` (工作流级别的属性，如名称、描述)
        *   `'workflowInterface'` (工作流的输入/输出接口)
        *   `'nodeGroupInstance'` (特指节点组实例的操作)
    *   `summary: string`: 对操作的简短、人类可读的描述。这通常会显示在历史记录面板中，帮助用户理解每个历史步骤。例如："修改节点 '文本输入_1' 输入 'text'" 或 "添加节点 '图像加载器'"。
    *   `timestamp: number`: 操作发生时的 `Date.now()` 时间戳。
    *   `details?: Record<string, any>`: 一个可选的对象，用于存储与特定操作相关的上下文数据。这些数据对于调试或在撤销/重做时精确恢复状态非常有用。常见内容包括：
        *   `nodeId: string`
        *   `edgeId: string`
        *   `inputKey: string` 或 `configKey: string` (属性名)
        *   `propertyName: string` (通用属性名)
        *   `oldValue: any`
        *   `newValue: any`
        *   `removedEdges: Edge[]` (当操作导致边被移除时)
        *   `path: string` (描述数据在对象中路径，如 `data.inputs.text.value`)

### 7. `createHistoryEntry` 工具函数

-   **位置**: [`@comfytavern/utils/src/historyUtils.ts`](packages/utils/src/historyUtils.ts:1)
-   **职责**: 一个辅助函数，用于方便地创建符合 `HistoryEntry` 结构的对象。它接收 `actionType`, `objectType`, `summary`, 和可选的 `details` 作为参数，并自动填充 `timestamp`。
-   **示例**:
    ```typescript
    import { createHistoryEntry } from "@comfytavern/utils";
    import type { HistoryEntry } from "@comfytavern/types";

    const entry: HistoryEntry = createHistoryEntry(
      'modify',
      'nodeInput',
      `更新节点 ${nodeId} 输入 ${inputKey}`,
      { nodeId, inputKey, oldValue, newValue }
    );
    ```

## 四、 实现一个新的可记录历史的操作步骤

当需要为应用中的某个新操作添加历史记录（撤销/重做）功能时，请遵循以下步骤：

1.  **识别状态修改点**:
    *   明确哪个用户操作或系统事件会导致核心工作流状态的变更，并且这个变更需要被记录下来以便能够撤销。

2.  **在 `useWorkflowInteractionCoordinator.ts` 中创建协调器函数**:
    *   为该操作创建一个新的 `async` 函数。
    *   **命名约定**: 推荐使用 `verbNounAndRecord` 的格式，例如 `updateNodeDisplayNameAndRecord` 或 `addConnectionAndRecord`。
    *   **函数签名**: 通常如下：
        ```typescript
        async function newActionAndRecord(
          internalId: string, // 目标标签页的内部ID
          // ... 操作所需的特定参数 (例如 nodeId, edgeId, newValue) ...
          entry: HistoryEntry // 一个预先创建好的、描述此操作的 HistoryEntry 对象
        ) {
          // ... 实现逻辑 ...
        }
        ```
    *   **严格遵循核心执行流程**:
        1.  获取当前快照: `const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);`
            *   进行必要的错误检查（例如，如果 `currentSnapshot` 为 `undefined`）。
        2.  准备下一快照: `const nextSnapshot = klona(currentSnapshot);`
        3.  修改 `nextSnapshot`: 在这个深拷贝的快照上应用操作所带来的所有状态变更。例如，修改 `nextSnapshot.elements` 中的某个节点，或更新 `nextSnapshot.workflowData`。
        4.  应用状态更新: 调用 `workflowManager` 中最合适的函数来应用 `nextSnapshot` 中的更改。例如：
            *   `await workflowManager.setElements(internalId, nextSnapshot.elements);` (如果只修改了元素)
            *   `await workflowManager.setElementsAndInterface(internalId, nextSnapshot.elements, nextSnapshot.workflowData.interfaceInputs, nextSnapshot.workflowData.interfaceOutputs);` (如果同时修改了元素和工作流接口)
            *   或者其他更具体的 `workflowManager` 方法。
        5.  记录历史: 在状态更新成功 *之后*，调用 `historyManager.recordSnapshot(internalId, entry, nextSnapshot);`。**非常重要**：确保传递的是已经应用了更改的 `nextSnapshot`，这样历史记录中保存的就是操作 *之后* 的状态。

3.  **从 `useWorkflowInteractionCoordinator.ts` 导出新函数**:
    *   在 `useWorkflowInteractionCoordinator` 函数的 `return` 对象中添加你新创建的协调器函数，使其可供外部使用。

4.  **在 `apps/frontend-vueflow/src/stores/workflowStore.ts` 中暴露该函数**:
    *   在 `workflowStore.ts` 中，从 `@/composables/workflow/useWorkflowInteractionCoordinator` 导入你新创建的协调器函数。
    *   在 `defineStore` 返回的对象中，将此函数重新导出，这样应用的其他部分（如 `useNodeState` 或 Vue 组件）就可以通过 `workflowStore` 来调用它。

5.  **从触发位置调用**:
    *   在最初触发该操作的组件或 Composable 中（例如，某个 Vue 组件的事件处理器，或 `useNodeState.ts` 中的某个方法）：
        1.  导入并使用 `useWorkflowStore()`。
        2.  收集执行操作所需的所有参数（例如 `nodeId`, `newValue`）。
        3.  获取操作前的状态值（如果需要在 `HistoryEntry` 的 `details` 中记录 `oldValue`）。
        4.  使用 `createHistoryEntry()` (从 `@comfytavern/utils`) 来构建一个详细描述该操作的 `HistoryEntry` 对象。
        5.  调用 `workflowStore` 上对应的协调器函数，并传递 `internalId` (通常来自 `useTabStore().activeTabId`)、操作参数以及创建的 `HistoryEntry` 对象。

## 五、 代码示例

### 协调器函数示例 (简化版)

```typescript
// In apps/frontend-vueflow/src/composables/workflow/useWorkflowInteractionCoordinator.ts

import { klona } from "klona/full";
import { useWorkflowManager } from "./useWorkflowManager";
import { useWorkflowHistory } from "./useWorkflowHistory";
import type { HistoryEntry } from "@comfytavern/types";
import type { WorkflowStateSnapshot, VueFlowNode } from "@/types/workflowTypes"; // 假设 VueFlowNode 在此定义

// ... (其他导入和 setup) ...
const workflowManager = useWorkflowManager();
const historyManager = useWorkflowHistory();

async function updateNodeDisplayNameAndRecord(
  internalId: string,
  nodeId: string,
  newDisplayName: string,
  entry: HistoryEntry // 接收预先创建的 HistoryEntry
) {
  // 1. 获取当前快照 (修改前)
  const currentSnapshot = workflowManager.getCurrentSnapshot(internalId);
  if (!currentSnapshot) {
    console.error(`[Coordinator] 无法获取标签页 ${internalId} 的当前快照。`);
    return;
  }

  // 2. 准备下一个状态快照 (深拷贝当前快照并应用更改)
  const nextSnapshot = klona(currentSnapshot);
  const nodeIndex = nextSnapshot.elements.findIndex(
    (el) => el.id === nodeId && !("source" in el) // 确保是节点
  );

  if (nodeIndex === -1) {
    console.error(`[Coordinator] 在标签页 ${internalId} 中未找到节点 ${nodeId}。`);
    return;
  }

  // 修改 nextSnapshot 中的目标节点数据
  const targetNode = nextSnapshot.elements[nodeIndex] as VueFlowNode;
  targetNode.data = {
    ...targetNode.data,
    displayName: newDisplayName, // 更新显示名称
  };
  if (targetNode.label !== undefined) { // 如果顶层 label 存在，也更新它
      targetNode.label = newDisplayName;
  }


  // 3. 应用状态更新 (通过 workflowManager)
  // setElements 会处理脏状态标记
  await workflowManager.setElements(internalId, nextSnapshot.elements);

  // 4. 记录历史 (使用准备好的下一个状态快照)
  historyManager.recordSnapshot(internalId, entry, nextSnapshot);

  // 5. (可选) 触发副作用，例如预览执行
  // requestPreviewExecution(internalId, nodeId, ...);
}

// ... (在 return 对象中导出 updateNodeDisplayNameAndRecord) ...
```

### 创建和传递 `HistoryEntry` 示例

```typescript
// In a Vue component or another composable (e.g., useNodeState.ts)

import { useWorkflowStore } from "@/stores/workflowStore";
import { useTabStore } from "@/stores/tabStore";
import { createHistoryEntry } from "@comfytavern/utils";
import type { HistoryEntry } from "@comfytavern/types";

const workflowStore = useWorkflowStore();
const tabStore = useTabStore();

function handleDisplayNameChange(nodeId: string, oldName: string, newName: string) {
  const activeTabId = tabStore.activeTabId;
  if (!activeTabId) return;

  const entry: HistoryEntry = createHistoryEntry(
    'modify',                                  // actionType
    'nodeProperty',                            // objectType (更具体可以是 'nodeDisplayName')
    `更改节点 '${oldName}' 名称为 '${newName}'`, // summary
    {                                          // details
      nodeId: nodeId,
      propertyName: 'displayName',
      oldValue: oldName,
      newValue: newName,
    }
  );

  // 调用 workflowStore 中暴露的协调器函数
  workflowStore.updateNodeDisplayNameAndRecord(activeTabId, nodeId, newName, entry);
}
```

## 六、 最佳实践与注意事项

-   **原子性**: 协调器函数的设计确保了状态更新和历史记录是原子操作。避免在协调器流程之外直接修改由 `workflowManager` 管理的状态或直接调用 `historyManager.recordSnapshot`。
-   **历史条目粒度**: 仔细考虑历史记录的粒度。过于频繁或过于细致的记录可能会让历史列表变得冗长难用。应根据用户期望的撤销/重做行为来决定何时记录一个快照。例如，对于文本框的输入，通常是在用户完成输入（如失焦或按回车）后记录一次，而不是每输入一个字符就记录。
-   **性能**: 虽然 `klona` 是一个高效的深拷贝库，但在处理非常巨大和复杂的工作流状态时，频繁的深拷贝仍可能带来性能开销。应关注性能瓶颈，并在必要时进行优化。
-   **`HistoryEntry` 的清晰度**:
    *   `summary` 应该简洁明了，准确描述用户所做的操作，以便用户在历史面板中能快速识别。
    *   `details` 应包含足够的信息，以便于调试和理解操作的具体上下文。记录 `oldValue` 和 `newValue` 对于验证历史记录的正确性非常有帮助。
-   **调试**: 历史记录系统本身也是一个有用的调试工具。当出现意外状态时，可以检查历史记录中的 `payload` 和 `entry.details` 来追踪状态是如何演变的。
-   **副作用**: 如果一个操作除了修改核心状态外还需要触发其他副作用（如API调用、通知等），这些副作用应该在协调器函数中，在历史记录成功之后，或者通过监听协调器完成的事件来触发。

## 七、 Mermaid 流程图

以下序列图展示了从用户交互到历史记录的典型数据流和函数调用顺序：

```mermaid
sequenceDiagram
    actor User
    participant NodeComponent as "UI/Node Component <br> (e.g., using useNodeState)"
    participant HistoryUtils as "@comfytavern/utils <br> (createHistoryEntry)"
    participant WorkflowStore as "WorkflowStore (Pinia)"
    participant InteractionCoordinator as "useWorkflowInteractionCoordinator"
    participant WorkflowManager as "useWorkflowManager"
    participant HistoryManager as "useWorkflowHistory"

    User->>NodeComponent: Interact (e.g., change input value)
    NodeComponent->>NodeComponent: Prepare action data (oldValue, newValue)
    NodeComponent->>HistoryUtils: createHistoryEntry(actionType, objectType, summary, details)
    HistoryUtils-->>NodeComponent: Returns: historyEntry
    NodeComponent->>WorkflowStore: Call action (e.g., updateNodeInputValueAndRecord(tabId, ..., historyEntry))

    WorkflowStore->>InteractionCoordinator: Forward call (e.g., updateNodeInputValueAndRecord(tabId, ..., historyEntry))
    InteractionCoordinator->>WorkflowManager: getCurrentSnapshot(tabId)
    WorkflowManager-->>InteractionCoordinator: Returns: currentSnapshot
    InteractionCoordinator->>InteractionCoordinator: nextSnapshot = klona(currentSnapshot)
    InteractionCoordinator->>InteractionCoordinator: Modify nextSnapshot with changes
    InteractionCoordinator->>WorkflowManager: Apply changes (e.g., setElements(tabId, nextSnapshot.elements))
    WorkflowManager-->>InteractionCoordinator: (State updated in manager)
    InteractionCoordinator->>HistoryManager: recordSnapshot(tabId, historyEntry, nextSnapshot)
    HistoryManager-->>InteractionCoordinator: (History item added to stack)
    InteractionCoordinator-->>WorkflowStore: (Returns promise)
    WorkflowStore-->>NodeComponent: (Returns promise)