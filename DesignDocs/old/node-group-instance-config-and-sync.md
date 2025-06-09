# 节点组实例配置与接口同步设计方案

## 1. 引言与目标

### 1.1 问题背景

当前系统中，`core:NodeGroup` 节点作为引用其他工作流（称为“模板工作流”）的实例，其输入接口直接反映了模板工作流的接口定义。用户无法为 NodeGroup 实例的特定输入槽设置覆盖模板默认值的实例特定值。此外，当模板工作流的接口发生变化时，NodeGroup 实例如何优雅地同步这些变化，并处理已有的实例特定配置（如果未来支持）是一个需要解决的问题。

### 1.2 设计目标

- **实例可配置性**：允许用户为 NodeGroup 实例的输入槽设置覆盖模板默认值的特定值。
- **接口同步**：当模板工作流的接口结构（如添加/删除/修改槽）发生变化时，NodeGroup 实例能够同步这些变化。
- **数据一致性**：确保 NodeGroup 实例的接口快照和实例值与其引用的模板保持一致或有明确的转换/处理逻辑。
- **用户体验**：
  - 提供清晰的 UI 来查看和修改 NodeGroup 实例的输入值。
  - 在接口同步导致实例值可能丢失时，提供通过历史记录恢复的机制。
- **系统简洁性**：尽量利用现有机制（如历史记录），避免引入不必要的复杂状态管理。

## 2. 核心概念与数据结构

- **`core:NodeGroup` (节点类型)**: 画布上的节点，代表一个模板工作流的实例。
- **`node.data.referencedWorkflowId: string`**: NodeGroup 实例引用的模板工作流的 ID。
- **`node.data.groupInterface: GroupInterfaceInfo` (Zod Schema: `GroupInterfaceInfoSchema`)**:
  - 存储模板工作流接口定义的**只读快照**。
  - 结构: `{ inputs: Record<string, GroupSlotInfo>, outputs: Record<string, GroupSlotInfo> }`。
  - `GroupSlotInfo` 包含 `key, displayName, dataFlowType, customDescription, config (default, min, max, suggestions), allowDynamicType, matchCategories` 等。
  - **重要 (关于 `CONVERTIBLE_ANY` 的处理)**:
    - `groupInterface` 作为模板工作流接口定义的只读快照，其本身**可能包含**模板中定义的 `DataFlowType.CONVERTIBLE_ANY` (或 `matchCategories` 包含 `BEHAVIOR_CONVERTIBLE`) 类型的槽。
    - 然而，这些 `CONVERTIBLE_ANY` 类型的槽在 `core:NodeGroup` 实例的外部 UI 上**不会显示**，用户也**不能**直接为其配置实例值或进行连接。
    - 这种过滤行为主要发生在前端 UI 处理层面，例如在 `apps/frontend-vueflow/src/composables/group/useGroupIOSlots.ts` 中，当为 `core:NodeGroup` 准备要在界面上显示的输入/输出列表时，会跳过 `CONVERTIBLE_ANY` 类型的槽。
- **`node.data.inputValues: Record<string, any>` (Zod Schema: `z.record(z.string(), z.any()).optional()`)**:
  - 存储 NodeGroup 实例对其 `groupInterface.inputs` 中，那些**非** `CONVERTIBLE_ANY` 类型（即用户可以在 UI 上看到的具体类型）输入槽的默认值的覆盖值。
  - 键是输入槽的 `key` (string)，值是用户设置的实例特定值。只有当实例值与快照中的默认值不同时，才应在此记录。由于 `CONVERTIBLE_ANY` 槽不在 UI 上提供配置入口，因此 `inputValues` 中不应包含与它们直接相关的条目。
- **`WorkflowObject.interfaceInputs / interfaceOutputs: Record<string, GroupSlotInfo>`**:
  - 模板工作流对象中存储的中心化公共接口定义。这些定义是 NodeGroup 实例 `groupInterface` 的源头。它们**可以包含** `CONVERTIBLE_ANY` 类型的槽，这些槽主要用于模板内部的灵活性。

## 3. 主要功能模块与逻辑

### 3.1 NodeGroup 实例输入 UI (`useGroupIOSlots.ts` 调整)

- **目标**: 在 NodeGroup 实例的 UI 上正确显示可配置的输入槽，并处理用户输入。
- **逻辑**:
  1.  `finalInputs` 计算属性（当 `props.type === 'core:NodeGroup'` 时），例如在 `useGroupIOSlots.ts` 中：
      - 遍历 `props.data.groupInterface.inputs` (此处的 `groupInterface.inputs` 是模板接口的快照，可能包含 `CONVERTIBLE_ANY` 槽)。
      - 在遍历过程中，如果遇到 `dataFlowType` 为 `CONVERTIBLE_ANY` 的槽，则**跳过该槽**，不将其包含在最终用于 UI 显示的输入列表中。
      - 对于每个**非** `CONVERTIBLE_ANY` 的输入槽 `slotDef` (来自 `groupInterface.inputs[slotKey]`)：
        - 获取快照中的默认值: `snapshotDefaultValue = getEffectiveDefaultValue(slotDef)`。
        - 获取实例覆盖值: `instanceOverrideValue = props.data.inputValues?.[slotKey]`。
        - 确定最终用于 UI 显示的初始值: `uiInitialValue = instanceOverrideValue ?? snapshotDefaultValue`。
        - 将 `slotKey`, `slotDef` (包含 `displayName`, `dataFlowType`, `config` 等) 和 `uiInitialValue` 传递给相应的输入组件 (e.g., `StringInput`, `NumberInput`)。
  2.  **输入组件回调逻辑** (当用户在 NodeGroup 实例的输入组件中修改值时):
      - 获取用户输入的新值 `newUserValue` 和对应的 `slotKey`。
      - 获取该槽在 `props.data.groupInterface.inputs[slotKey]` 中的快照默认值 `snapshotDefaultValue`。
      - **如果 `newUserValue` 与 `snapshotDefaultValue` 不同**:
        - 调用 `workflowStore.updateNodeInputValueAndRecord(tabId, props.id, slotKey, newUserValue)`。
      - **如果 `newUserValue` 与 `snapshotDefaultValue` 相同** (即用户将值改回了模板定义的默认状态):
        - 调用 `workflowStore.clearNodeInputValueAndRecord(tabId, props.id, slotKey)`。

### 3.2 模板接口到 NodeGroup 实例的同步

- **核心模块**: `useNodeGroupInstanceInterfaceSync.ts` (新的 Composable) 或直接在 `workflowStore.ts` 的相关 action 中实现此逻辑。
- **同步触发时机**:
  1.  **标记**：当一个模板工作流的 `interfaceInputs/Outputs` 通过 `workflowStore` 的 action (如 `updateWorkflowInterfaceAndRecord`) 更新时，`workflowStore` 应在其内部状态中标记此模板工作流 ID 为“已更新”。
  2.  **检查与执行**：在 `EditorView.vue` 中，当活动工作流加载完成或用户切换到一个工作流标签页时：
      - 获取当前活动工作流数据。
      - 遍历其中的所有 `core:NodeGroup` 节点。
      - 对每个 NodeGroup 实例，获取其 `referencedWorkflowId`。
      - 查询 `workflowStore`，看此 `referencedWorkflowId` 是否被标记为“已更新”。
      - 如果是，则调用 `workflowStore.synchronizeGroupNodeInterfaceAndValues(nodeGroupInstanceId, referencedWorkflowId)`。
  3.  **多浏览器窗口/标签页的同步策略 (待进一步细化)**:
      - **当前局限性**: 上述基于 `EditorView.vue` 加载/切换的触发机制主要覆盖单浏览器标签页内的场景。它无法直接感知其他浏览器窗口或标签页中对模板的修改。
      - **未来可能的增强方向**:
        - **`BroadcastChannel` API / `localStorage` 事件**: 对于同源的多浏览器窗口，可以使用 `BroadcastChannel` API 在一个窗口中的模板被修改并保存后，通知其他打开了相关工作流的窗口。或者，通过监听 `localStorage` 中特定标记的变化来触发检查。
        - **画布交互时检查**: 当用户在某个工作流画布上进行操作（如移动节点、连线、执行等）时，可以顺带检查其包含的 NodeGroup 实例所引用的模板是否有更新。这是一种较为自然的触发方式，但可能存在延迟（如果用户长时间不操作）。
        - **服务器推送 (WebSocket)**: 模板更新时，服务器可以通过 WebSocket 主动通知所有相关的客户端 `EditorView` 实例，但这会增加后端复杂度。
        - **组合策略**: 例如，主要依赖窗口加载/标签页切换/画布操作时检查，辅以一个较低频率的后台轮询（如果窗口可见但非活动焦点），或在关键操作（如“执行工作流”）前强制检查。
      - **短期策略**: 若短期内不实现复杂的多窗口实时同步，应明确当前主要依赖用户重新加载工作流、切换标签页或在某些情况下重新聚焦窗口来获取模板的最新状态。
- **同步核心流程 (`synchronizeGroupNodeInterfaceAndValues` action 在 `workflowStore.ts` 中)**:
  1.  获取要同步的 NodeGroup 实例 `nodeToUpdate` 及其当前数据。
  2.  深拷贝 `nodeToUpdate.data.groupInterface` 为 `oldGroupInterface`。
  3.  深拷贝 `nodeToUpdate.data.inputValues` 为 `oldInputValues`。
  4.  从引用的模板工作流 `templateWorkflowData` 获取最新的接口定义。
  5.  **准备新的 `groupInterface`**:
      - 直接深拷贝 `templateWorkflowData.interfaceInputs` 到 `newGroupInterface.inputs`。
      - 直接深拷贝 `templateWorkflowData.interfaceOutputs` 到 `newGroupInterface.outputs`。
      - **注意**: 此处 `newGroupInterface` 将包含模板中所有的槽定义，包括 `CONVERTIBLE_ANY` 类型的槽。实际在 UI 上对用户隐藏这些 `CONVERTIBLE_ANY` 槽的逻辑由前端组件（如 `useGroupIOSlots.ts`）负责。
  6.  初始化 `newInputValues = {}`。
  7.  初始化 `lostInputValues = {}` (用于历史记录)。
  8.  **迁移 `inputValues`**:
      - 遍历 `oldInputValues` 的每个 `[slotKey, oldValue]`：
        - 检查 `slotKey` 是否依然存在于 `newGroupInterface.inputs` 中，并且 `newGroupInterface.inputs[slotKey]` **不是** `CONVERTIBLE_ANY` 类型（因为用户不能为 `CONVERTIBLE_ANY` 槽设置实例值）。
          - **若存在且为具体类型 (`newSlotDef = newGroupInterface.inputs[slotKey]`)**:
            - 获取旧槽定义 `oldSlotDef = oldGroupInterface.inputs[slotKey]`。
            - **类型兼容性与转换**:
              - **将优先复用和依赖系统中现有的、用于处理节点间连线时的数据类型兼容和转换逻辑/服务。** (具体规则参考该现有机制，附录 A 将进行相应调整)。
              - 调用该现有机制判断 `oldValue` 是否能安全转换为 `newSlotDef.dataFlowType`。
              - 如果兼容或可安全转换，则 `newInputValues[slotKey] = (转换后的)oldValue`。
              - 若不兼容且无法安全转换，则不迁移 `oldValue` 到 `newInputValues` (该 `slotKey` 的实例值丢失)，并在 `lostInputValues[slotKey] = { value: oldValue, reason: 'type_incompatible', oldType: oldSlotDef?.dataFlowType, newType: newSlotDef.dataFlowType }` 中记录。
          - **若不存在于 `newGroupInterface.inputs` 中，或者在模板中变为了 `CONVERTIBLE_ANY` 类型**:
            - 不迁移 `oldValue` 到 `newInputValues` (该 `slotKey` 的实例值丢失)，并在 `lostInputValues[slotKey] = { value: oldValue, reason: 'slot_deleted_or_became_convertible_in_template' }` 中记录。
  9.  **记录历史**:
      - 创建 `HistoryEntry`:
        - `actionType: 'sync'`
        - `objectType: 'nodeGroupInstance'`
        - `summary: \`同步节点组 ${nodeToUpdate.data.label || nodeToUpdate.id} 的接口与实例值\``
        - `details: { nodeId: nodeToUpdate.id, tabId, oldGroupInterface, newGroupInterface, oldInputValues, newInputValues, lostInputValues }`
      - 调用 `workflowStore.recordHistorySnapshot(...)` 存储此历史条目和当前工作流快照（同步前的状态）。
  10. **应用变更到 Store**:
      - `nodeToUpdate.data.groupInterface = newGroupInterface`。
      - `nodeToUpdate.data.inputValues = newInputValues`。
      - `workflowStore` 更新节点数据，确保 UI 响应。
      - 从“已变更模板 ID 集合”中移除此模板 ID（或更新时间戳），避免对同一实例的重复同步，直到模板再次变更。

### 3.3 `workflowStore.ts` 增强

- **Action: `updateNodeInputValueAndRecord(tabId: string, nodeId: string, slotKey: string, newValue: any)`**:
  - 此 action 负责更新 NodeGroup 实例特定输入槽的值。
  - 内部逻辑:
    1.  获取节点 `nodeToUpdate = nodes[nodeId]`。
    2.  获取旧值 `oldValue = nodeToUpdate.data.inputValues?.[slotKey]`。
    3.  更新 `nodeToUpdate.data.inputValues[slotKey] = newValue`。
    4.  调用通用的节点数据更新 action (例如 `workflowStore.updateNodeDataAndRecordHistory`) 记录历史，并提供定制化的 `HistoryEntry` 内容:
        - `actionType: 'modify'` (或与通用 action 一致的类型)
        - `objectType: 'nodeData'` (或与通用 action 一致的类型)
        - `summary`: `更新节点组 '${nodeToUpdate.data.label || nodeId}' 输入 '${slotKey}' 的值`
        - `details`: `{ nodeId, path: \`data.inputValues.${slotKey}\`, oldValue, newValue, context: 'nodeGroupInstanceInput' }`
- **Action: `clearNodeInputValueAndRecord(tabId: string, nodeId: string, slotKey: string)`**:
  - 此 action 负责清除 NodeGroup 实例特定输入槽的覆盖值（使其恢复为使用模板默认值）。
  - 内部逻辑:
    1.  获取节点 `nodeToUpdate = nodes[nodeId]`。
    2.  获取旧值 `oldValue = nodeToUpdate.data.inputValues?.[slotKey]`。
    3.  从 `nodeToUpdate.data.inputValues` 中删除 `slotKey`。
    4.  调用通用的节点数据更新 action 记录历史，并提供定制化的 `HistoryEntry` 内容:
        - `actionType: 'modify'` (或与通用 action 一致的类型)
        - `objectType: 'nodeData'` (或与通用 action 一致的类型)
        - `summary`: `清除节点组 '${nodeToUpdate.data.label || nodeId}' 输入 '${slotKey}' 的覆盖值`
        - `details`: `{ nodeId, path: \`data.inputValues.${slotKey}\`, oldValue, context: 'nodeGroupInstanceInputClear' }`
- **Action: `synchronizeGroupNodeInterfaceAndValues(...)`**:
  - 实现 3.2 章节中描述的同步核心流程。
- **内部状态**: 维护一个会话级别的 `Set<string>` 用于存储已发生接口变更的模板工作流 ID。
- **修改 `updateWorkflowInterfaceAndRecord`**: 在成功更新模板工作流的 `interfaceInputs/Outputs` 后，将该模板的 `workflowId` 添加到上述 `Set` 中。

### 3.4 工作流扁平化 (`workflowFlattener.ts` 调整)

- **核心机制变更**: `core:GroupInput` 和 `core:GroupOutput` 节点在扁平化过程中会被移除。对于没有外部连接的 NodeGroup 输入，其值需要直接“预填充”到组内部连接的第一个下游节点的 `data.inputs[targetSlotKey].value` 中。
- **调整后的逻辑**:
  1.  当 `workflowFlattener.ts` 处理 `currentGroupNode` 时：
      a. 加载并递归扁平化其引用的子工作流 `flattenedSubWorkflow`。
      b. 遍历 `currentGroupNode.data.groupInterface.inputs` 中的每一个定义的输入槽 `definedInputSlot` (其 `key` 为 `slotKey`)。
      c. 对于每个 `slotKey`：
      i. 检查是否有外部边连接到 `currentGroupNode.id` 的 `targetHandle === slotKey`。
      ii. **如果该 `slotKey` 没有外部连接**: 1. 计算最终值: `finalValue = currentGroupNode.data.inputValues?.[slotKey] ?? getEffectiveDefaultValue(definedInputSlot)`。 2. 在 `flattenedSubWorkflow.edges` 中，找到从 `internalGroupInput.id` (子工作流中的 GroupInput 节点 ID) 且 `sourceHandle === slotKey` 出发的边 `internalEdgeForSlot`。 3. 如果 `internalEdgeForSlot` 存在：
      _ 获取下游节点 ID `downstreamNodeId` 和句柄 `downstreamNodeHandle`。
      _ 在 `flattenedSubWorkflow.nodes` 中找到下游节点实例 `actualDownstreamNode`。 \* **直接将 `finalValue` 注入到下游节点的 `data.inputs[downstreamNodeHandle].value` 中**。`workflowFlattener` 在写入前需要确保 `actualDownstreamNode.data`, `actualDownstreamNode.data.inputs`, `actualDownstreamNode.data.inputs[downstreamNodeHandle]` 这些对象/属性结构存在，如果不存在则创建它们。
      `typescript
                // pseudo-code for injection
                const downstreamNode = actualDownstreamNode; // from flattenedSubWorkflow
                downstreamNode.data = downstreamNode.data || {};
                downstreamNode.data.inputs = downstreamNode.data.inputs || {};
                downstreamNode.data.inputs[downstreamNodeHandle] = downstreamNode.data.inputs[downstreamNodeHandle] || {}; // Ensure slot object exists
                downstreamNode.data.inputs[downstreamNodeHandle].value = finalValue;
                ` 4. 如果 `internalEdgeForSlot` 不存在，则此 `finalValue` 无处可去，可以记录警告。
      iii. **如果该 `slotKey` 有外部连接**: 按现有逻辑处理边的重定向。
  2.  过滤掉 `core:GroupInput` 和 `core:GroupOutput` 节点后合并节点和边。
- **下游节点的后端执行逻辑**:
  - 获取输入值时，优先级为：连接值 > `this.data.inputs[handleKey].value` (可能包含预填充值) > 节点自身配置的默认值。

### 3.5 useMultiInputConnectionActions.ts 的适用范围与 NodeGroup 实例

- `useMultiInputConnectionActions.ts` 中的 `handleConvertibleAnyTypeChange` 函数：
  - 其核心作用是处理*模板工作流内部* `core:GroupInput` 或 `core:GroupOutput` 节点上 `CONVERTIBLE_ANY` 插槽的连接和类型具体化。
  - **重要**：此函数**不涉及**对 `core:NodeGroup` 实例的 `groupInterface` 的直接修改。NodeGroup 实例的 `groupInterface` 的更新完全依赖于 3.2 节中描述的从模板进行的同步机制。

### 3.6 持久化 NodeGroup 实例的 `inputValues` (`workflowTransformer.ts` 调整)

- **背景**: `core:NodeGroup` 实例允许用户设置覆盖模板默认值的特定输入值，这些值按计划存储在节点前端状态的 `data.inputValues` 字段中 (即 `vueNode.data.inputValues`)。
- **问题**: 当前 [`apps/frontend-vueflow/src/utils/workflowTransformer.ts`](apps/frontend-vueflow/src/utils/workflowTransformer.ts:1) 中的 `transformVueFlowToCoreWorkflow` 函数在将 VueFlow 节点数据转换为 `WorkflowStorageNode` 以便保存时，其提取 `inputValues` 的通用逻辑 ([`apps/frontend-vueflow/src/utils/workflowTransformer.ts:85-162`](apps/frontend-vueflow/src/utils/workflowTransformer.ts:85)) 会显式跳过 `core:NodeGroup` 类型的节点 ([`apps/frontend-vueflow/src/utils/workflowTransformer.ts:92`](apps/frontend-vueflow/src/utils/workflowTransformer.ts:92))。这可能导致 `core:NodeGroup` 实例上设置的特定覆盖值无法被正确保存到 `storageNode.inputValues` 中。
- **调整建议**:
  - 需要修改 [`apps/frontend-vueflow/src/utils/workflowTransformer.ts`](apps/frontend-vueflow/src/utils/workflowTransformer.ts:1) 中的 `transformVueFlowToCoreWorkflow` 函数去除对 `core:NodeGroup` 类型的节点的跳过。

## 4. 用户体验与历史记录

- 用户可以直接在 NodeGroup 实例上看到并修改其具体类型的输入槽的值。这些值是实例特定的。
- 当模板接口更新导致 NodeGroup 实例同步，并可能导致某些实例输入值因类型不兼容或槽被删除而丢失时：
  - 用户可以通过撤销最近的“同步节点组接口与实例值”历史条目来将该 NodeGroup 实例的 `groupInterface` 和 `inputValues` 完整恢复到同步操作之前的状态。
  - 用户也可以查看该历史条目的 `details.lostInputValues` 部分，找到具体丢失的槽的键和原始值，以便在需要时手动在其他地方重新应用或参考。

## 5. 类型转换 (附录 A - 调整说明)

NodeGroup 实例输入值的类型转换将**优先复用和依赖系统中现有的、用于处理节点间连线时的数据类型兼容和转换逻辑/服务**。

因此，本附录不再详细定义一套独立的转换规则。具体的转换行为、支持的转换路径以及错误处理机制，应参考该系统中已存在的类型转换模块。

**同步逻辑中的应用**:
在 `synchronizeGroupNodeInterfaceAndValues` 流程中（具体见 3.2 章节，步骤 8），当需要判断 `oldInputValues` 中的值是否能迁移到新的接口定义时，应调用此现有的类型转换服务来：

1.  检查类型兼容性。
2.  执行必要的安全转换。
3.  处理无法转换的情况（通常是记录到 `lostInputValues`）。

**这样做的好处**:

- **一致性**: 保证了实例输入值与连线输入值在类型处理上的一致性。
- **简化性**: 避免了重复定义和维护类型转换规则。
- **健壮性**: 可以利用系统中已经过测试和优化的类型转换功能。

如果现有系统中尚未有明确的、可复用的类型转换服务，则需要优先设计和实现这样一个通用模块，然后再应用于此处的 NodeGroup 同步逻辑。

## 6. “工作流加载时”同步的具体含义

- 指当一个包含 `core:NodeGroup` 实例的工作流被加载并显示在一个标签页中时（无论是项目首次打开时加载，还是用户从项目文件列表打开一个新的工作流标签页）。
- 此时，需要对该工作流中的所有 NodeGroup 实例，检查其引用的模板工作流是否有“已变更”标记，并执行必要的同步。

---

这份文档应该为接下来的实现工作提供了清晰的指导。
