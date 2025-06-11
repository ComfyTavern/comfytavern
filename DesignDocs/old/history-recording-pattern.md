# 工作流历史记录设置模式

在 ComfyTavern 前端，为了确保工作流状态的修改能够被正确地记录到历史记录中（支持撤销/重做），并保证状态的一致性，我们遵循以下模式：

## 核心原则

1.  **状态管理中心化**: 所有对核心工作流状态（特别是 `elements` 数组，包含节点和边）的修改都应通过 `useWorkflowManager` 进行，主要是通过 `setElements` 方法。
2.  **协调器负责流程**: 负责处理用户交互或生命周期的协调器（如 `useWorkflowInteractionCoordinator`）负责编排整个流程：调用 `workflowManager` 更新状态，然后调用 `useWorkflowHistory` 的 `recordSnapshot` 方法，并传递一个结构化的 `HistoryEntry` 对象来记录快照。
3.  **底层 Composable 触发**: 底层的 Composable（如 `useNodeState`）只负责准备必要的数据，并调用更高层的协调器函数来触发整个流程，它本身不直接修改全局状态或记录历史。

## 实现步骤（以节点输入/配置更新为例）

1.  **识别状态修改操作**:

    - 确定需要记录历史的操作，例如用户在 `BaseNode.vue` 中修改输入值或配置项。

2.  **创建协调器函数**:

    - 在 `apps/frontend-vueflow/src/composables/workflow/useWorkflowInteractionCoordinator.ts` 中为该操作创建 `async` 函数，如 `updateNodeInputValueAndRecord` 和 `updateNodeConfigValueAndRecord`。这些函数现在接受一个 `HistoryEntry` 对象而不是简单的 `label` 字符串。

3.  **实现协调器函数逻辑**:

    - **获取当前快照**: 使用 `workflowManager.getCurrentSnapshot(internalId)` 获取当前完整的状态快照（包括 elements, viewport, workflowData 等）。
    - **准备下一个状态快照**:
      - 使用 `klona(currentSnapshot)` 创建当前快照的深拷贝 `nextSnapshot`。
      - 修改 `nextSnapshot.elements` 中的目标节点/边。
      - 如果需要，修改 `nextSnapshot.workflowData`（例如接口定义）。
    - **应用状态更新**: 调用 `await workflowManager.setElements(internalId, nextSnapshot.elements)` （或其他必要的管理器函数，如 `setElementsAndInterface`）来更新 UI 和核心状态。
    - **记录历史快照**: 在状态更新调用 _之后_，调用 `historyManager.recordSnapshot(internalId, entry, nextSnapshot)`，**显式传递准备好的 `nextSnapshot`**。`entry` 对象包含操作类型、对象类型、摘要和详细信息。
    - **处理副作用 (可选)**: 如果需要，在此处处理或触发其他逻辑（如更新 NodeGroup 接口）。

4.  **导出协调器函数**:

    - 在 `useWorkflowInteractionCoordinator.ts` 的 `return` 语句中导出新函数。

5.  **在 Store 中暴露函数**:

    - 在 `apps/frontend-vueflow/src/stores/workflowStore.ts` 中导入并导出这些新的协调器函数。

6.  **调用 Store 函数**:
    - 在原始触发位置（如 `useNodeState.ts`）移除旧的 `updateNodeData`, `nextTick`, `recordHistorySnapshot`, `markAsDirty` 调用。
    - 替换为对 `workflowStore` 中相应协调器函数的调用，传递所需参数，包括一个使用 `createHistoryEntry` 创建的 `HistoryEntry` 对象。

## 示例代码片段 (协调器函数)

```typescript
// In useWorkflowInteractionCoordinator.ts
import { klona } from "klona/full";
// ... other imports

import { createHistoryEntry } from "@comfytavern/utils"; // 导入创建函数
import type { HistoryEntry } from "@comfytavern/types"; // 导入类型
// ... other imports

async function updateNodeInputValueAndRecord(
  internalId: string,
  nodeId: string,
  inputKey: string,
  value: any,
  entry: HistoryEntry // <-- 接收 HistoryEntry 对象
) {
  // 1. Get current snapshot (before modification)
  const currentSnapshot = _getCurrentSnapshot(internalId);
  if (!currentSnapshot) {
    /* ... error handling ... */ return;
  }

  // 2. Prepare next state snapshot (deep copy)
  const nextSnapshot = klona(currentSnapshot);
  const nodeIndex = nextSnapshot.elements.findIndex((el) => el.id === nodeId && !("source" in el));

  if (nodeIndex === -1) {
    /* ... error handling ... */ return;
  }

  // Modify the elements within the nextSnapshot
  const targetNode = nextSnapshot.elements[nodeIndex] as VueFlowNode;
  const currentInput = targetNode.data.inputs?.[inputKey] || {};
  // const oldValue = currentInput.value; // Get old value if needed for history entry details
  targetNode.data = {
    ...targetNode.data,
    inputs: {
      ...(targetNode.data.inputs || {}),
      [inputKey]: { ...currentInput, value: value },
    },
  };
  // Note: If other parts of the snapshot need updating (e.g., workflowData), modify nextSnapshot accordingly.

  // 3. Apply state update via manager (using elements from nextSnapshot)
  await workflowManager.setElements(internalId, nextSnapshot.elements);

  // 4. Record history snapshot using the prepared nextSnapshot
  // Note: entry should be created before calling this function, e.g.:
  // const entry = createHistoryEntry(
  //   'modify',
  //   'nodeInput',
  //   `修改节点 ${targetNode.data.label || nodeId} 输入 ${inputKey}`,
  //   { nodeId, nodeName: targetNode.data.label, inputKey, /* oldValue, */ newValue: value } // Add relevant details
  // );
  // Pass the prepared snapshot explicitly to _recordHistory or historyManager.recordSnapshot
  _recordHistory(internalId, entry, nextSnapshot);
}

// updateNodeConfigValueAndRecord 和其他协调器函数也遵循类似结构，接收 HistoryEntry
```

## 优点

- **状态一致性**: 确保状态更新和历史记录同步。
- **关注点分离**: 底层逻辑不关心历史记录，高层协调器负责流程。
- **可维护性**: 修改历史记录逻辑时，只需关注协调器和历史管理器。
- **正确性**: 通过显式传递准备好的快照，保证记录的是预期的、修改 _后_ 的状态。
