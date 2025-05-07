# Composable 函数功能详解 (`apps/frontend-vueflow/src/composables`)

本文件详细描述了 `apps/frontend-vueflow/src/composables` 目录下的各个 Vue Composable 函数的功能和主要职责。

---

## `useCanvasConnections.ts`

**核心职责:** 管理 VueFlow 画布上的节点连接逻辑。

**详细功能:**

- **类型兼容性检查 (`isTypeCompatible`, `isValidConnection`):**
  - 定义并检查源插槽类型和目标插槽类型之间的兼容性规则（例如，`INT` -> `FLOAT`, `STRING` -> `CODE`, `WILDCARD` 兼容所有，`CONVERTIBLE_ANY` 的特殊处理逻辑）。
  - 验证连接的有效性，确保源/目标节点和句柄存在，并调用类型兼容性检查。
- **边的创建 (`createEdge`):**
  - 基于有效的连接参数创建新的边对象。
  - 调用 `getEdgeStyleProps` 获取边的动态样式（颜色、动画、标记）。
  - 在边的 `data` 属性中存储源和目标类型信息。
- **连接处理 (`handleConnect`):**
  - 处理用户尝试建立连接的事件。
  - **单输入/多输入逻辑:** 检查目标输入是否标记为 `multi: true`。如果不是，则在建立新连接前移除指向该目标句柄的现有连接。
  - **`CONVERTIBLE_ANY` 处理:**
    - 如果源或目标是 `CONVERTIBLE_ANY` 类型，则将其类型转换为连接的另一端类型。
    - 更新对应插槽的 `displayName`。
    - 如果涉及 `GroupInput` 或 `GroupOutput` 节点，调用 `useGroupInterfaceSync` 中的 `syncInterfaceSlotFromConnection` 来更新中央工作流接口定义，并触发添加新的动态 `CONVERTIBLE_ANY` 插槽。
  - **原子性更新:** 如果连接涉及接口更新，则调用 `workflowStore.handleConnectionWithInterfaceUpdate` 来原子性地添加边和更新接口状态，确保历史记录的准确性。否则，直接调用 `addEdges` 添加边。
- **边的移除 (`removeNodeConnections`, `removeTargetConnections`):**
  - 提供移除连接到特定节点的所有边的方法。
  - 提供移除连接到特定目标句柄的所有边的方法（例如，在手动设置输入值时）。

---

## `useCanvasKeyboardShortcuts.ts`

**核心职责:** 实现画布区域的键盘快捷键功能。

**详细功能:**

- **事件监听:** 在组件挂载时添加 `keydown` 事件监听器到 `document`，并在卸载时移除。
- **焦点检查:** 在处理快捷键前检查当前焦点是否在输入框或可编辑元素内，以避免干扰文本编辑。
- **快捷键处理 (`handleKeyDown`):**
  - **Ctrl/Cmd + G:** 调用 `useWorkflowGrouping` 中的 `groupSelectedNodes` 创建节点组。
  - **Ctrl/Cmd + A:** 调用 `selectAllElements` 全选画布上的节点和边。
  - **Delete / Backspace:** 调用 `deleteSelectedElements` 删除当前选中的节点和边。
  - **Ctrl/Cmd + C:** 调用 `handleCopy` 复制选中的节点及它们之间的内部连接到内部剪贴板。
  - **Ctrl/Cmd + V:** 调用 `handlePaste` 将剪贴板中的节点和边粘贴到画布视口中心，并自动生成新的 ID 和处理连接关系。
- **具体操作实现:**
  - `deleteSelectedElements`: 获取选中元素，调用 VueFlow 的 `removeNodes` 和 `removeEdges`，并标记工作流为 `dirty`。
  - `handleCopy`: 获取选中节点和内部边，深拷贝后存入 `clipboardData`。
  - `handlePaste`: 计算粘贴位置，生成新 ID，深拷贝并调整节点位置，重新连接内部边，调用 VueFlow 的 `addNodes` 和 `addEdges`，选中新元素，并标记为 `dirty`。
  - `selectAllElements`: 调用 VueFlow 的 `addSelectedNodes` 和 `addSelectedEdges`。
  - *注意: `groupSelectedNodes` 的具体实现现在位于 `useWorkflowGrouping.ts` 中。*

---

## `useContextMenuPositioning.ts`

**核心职责:** 计算右键菜单相对于指定容器（通常是画布）的显示位置。

**详细功能:**

- **事件坐标获取 (`getEventClientPosition`):** 兼容鼠标事件 (`clientX`, `clientY`) 和触摸事件 (`touches[0].clientX`, `touches[0].clientY`)，返回事件发生的客户端坐标。
- **位置计算 (`calculateContextMenuPosition`):**
  - 接收触发菜单的事件对象和画布容器的 `Ref`。
  - 获取事件的客户端坐标。
  - 获取画布容器的边界矩形 (`getBoundingClientRect`)。
  - 计算事件坐标相对于画布容器左上角的相对位置。
  - 将计算出的相对位置存储在 `contextMenuPosition` ref 中并返回。
  - 如果无法获取画布容器，则返回 `null`。

---

## `useDnd.ts`

**核心职责:** 实现从外部元素（如侧边栏的节点列表）拖拽到 VueFlow 画布上创建新节点的功能。

**详细功能:**

- **状态管理:** 使用共享的 `ref` (通过 `state` 对象) 维护拖拽状态 (`isDragging`, `isDragOver`) 和被拖拽节点的数据 (`draggedNodeData`)。
- **拖拽开始 (`onDragStart`):**
  - 存储被拖拽节点的数据到 `draggedNodeData` 和 `event.dataTransfer` (尝试多种格式 `application/vueflow`, `text/plain`, `application/json` 以提高兼容性)。
  - 设置 `isDragging` 为 `true`。
  - 设置拖拽效果 (`effectAllowed = 'move'`) 和可选的拖拽图像。
- **拖拽悬停 (`onDragOver`):**
  - 阻止默认行为 (`event.preventDefault()`) 以允许放置。
  - 设置 `isDragOver` 为 `true`。
  - 设置放置效果 (`dropEffect = 'move'`)。
- **拖拽离开 (`onDragLeave`):**
  - 设置 `isDragOver` 为 `false`。
- **拖拽结束 (`onDragEnd`):**
  - 重置所有拖拽状态 (`isDragging`, `isDragOver`, `draggedNodeData`)。
  - 移除 `drop` 和 `dragend` 的事件监听器。
- **放置处理 (`onDrop`):**
  - 阻止默认行为。
  - 尝试从 `event.dataTransfer` (多种格式) 或全局 `draggedNodeData` 获取拖拽的节点数据。
  - 使用 VueFlow 的 `screenToFlowCoordinate` 将鼠标事件的屏幕坐标转换为画布坐标。
  - 使用 `useUniqueNodeId` 为新节点生成唯一 ID。
  - 构建新的节点对象 (`Node`)，包含 ID、类型、标签、计算出的位置和从拖拽数据中提取的 `data`。
  - 调用 VueFlow 的 `addNodes` 将新节点添加到画布。
  - 调用 `onDragEnd` 清理状态。

---

## `useEdgeStyles.ts`

**核心职责:** 提供计算 VueFlow 边（Edge）动态样式的函数。

**详细功能:**

- **颜色定义:** 定义不同插槽类型 (`SocketType`) 在亮色和暗色模式下的颜色映射 (`typeColors`) 和默认颜色 (`defaultColors`)。
- **样式计算 (`getEdgeStyleProps`):**
  - 接收源类型、目标类型和 `isDark` 标志。
  - 根据类型确定边的基础颜色（优先使用源类型，除非是 `WILDCARD` 或 `CONVERTIBLE_ANY`）。
  - 特殊处理 `STRING` 类型，使其变为蓝色虚线并带有动画。
  - 返回一个包含 `animated` (布尔值)、`style` (包含 `stroke`, `strokeWidth`, `strokeDasharray` 的对象) 和 `markerEnd` (箭头样式，颜色与线条一致) 的对象。
- **Composable 接口:** 导出 `getEdgeStyleProps` 函数供其他 Composable (如 `useCanvasConnections`, `useWorkflowData`) 使用。

---

## `useGroupInterfaceSync.ts`

**核心职责:** 将 GroupInput/Output 节点因连接 `CONVERTIBLE_ANY` 插槽而发生的类型和名称变化，同步到 `workflowStore` 中存储的中央工作流接口定义。

**详细功能:**

- **同步接口插槽 (`syncInterfaceSlotFromConnection`):**
  - 接收标签页 ID、节点 ID、被转换的插槽键 (`slotKey`)、转换后的新插槽信息 (`newSlotInfo`) 以及方向 (`inputs` 或 `outputs`)。
  - 从 `workflowStore` 获取当前活动标签页的工作流数据 (`workflowData`)。
  - 根据 `direction`，更新 `workflowData.interfaceInputs` 或 `workflowData.interfaceOutputs` 中对应 `slotKey` 的插槽信息为 `newSlotInfo`。
  - 在更新后的接口定义中，添加一个新的、唯一的 `CONVERTIBLE_ANY` 类型的插槽（例如 `input_1`, `output_2`），以允许后续的动态连接。
  - **重要:** 此函数不再直接调用 `workflowStore.updateWorkflowInterface`，而是**返回计算出的、更新后的 `inputs` 和 `outputs` 对象**。调用者（如 `useCanvasConnections`）负责将这些更新后的接口与边的添加操作一起原子性地提交给 `workflowStore`（通过 `handleConnectionWithInterfaceUpdate` action）。

---

## `useGroupIOSlots.ts`

**核心职责:** 根据节点的类型和上下文（普通节点、GroupInput、GroupOutput、NodeGroup），计算并提供该节点最终应该显示的输入和输出插槽列表。这是实现节点组接口显示的关键。

**详细功能:**

- **依赖:** 依赖 `workflowStore` 来获取当前活动的工作流/组定义。
- **计算最终输入 (`finalInputs` computed property):**
  - **`GroupOutput` 节点:** 其显示的输入句柄（左侧）对应于中央工作流定义的 `interfaceOutputs`。返回 `workflow.interfaceOutputs` 的值数组。
  - **`NodeGroup` 节点:** 其显示的输入句柄（左侧）由存储在节点 `data.groupInterface.inputs` 中的快照决定。返回 `groupInterface.inputs` 的值数组。
  - **普通节点:** 返回节点 `data.inputs` 的值数组。
  - **`GroupInput` 节点:** 没有标准的输入句柄。返回空数组。
- **计算最终输出 (`finalOutputs` computed property):**
  - **`GroupInput` 节点:** 其显示的输出句柄（右侧）对应于中央工作流定义的 `interfaceInputs`。返回 `workflow.interfaceInputs` 的值数组。
  - **`NodeGroup` 节点:** 其显示的输出句柄（右侧）由存储在节点 `data.groupInterface.outputs` 中的快照决定。返回 `groupInterface.outputs` 的值数组。
  - **普通节点:** 返回节点 `data.outputs` 的值数组。
  - **`GroupOutput` 节点:** 没有标准的输出句柄。返回空数组。
- **响应式:** `finalInputs` 和 `finalOutputs` 是计算属性，当依赖的 `workflowStore` 状态或节点 `props.data` 变化时会自动更新，从而驱动 `BaseNode` 组件重新渲染插槽。

---

## `useNodeActions.ts`

**核心职责:** 封装节点上可触发的特定动作，主要是按钮点击和编辑节点组。

**详细功能:**

- **按钮点击处理 (`handleButtonClick`):**
  - 接收被点击按钮对应的输入键 (`inputKey`)。
  - 获取当前活动标签页 ID (`activeTabId`)。
  - 使用 `useWebSocket` 的 `sendMessage` 发送一个 `BUTTON_CLICK` 类型的 WebSocket 消息到后端，消息负载包含 `nodeId`, `inputKey` 和 `internalId` (标签页 ID)。
- **编辑节点组 (`editNodeGroup`):**
  - 检查当前节点是否为 `NodeGroup` 类型且具有 `configValues`。
  - 根据 `configValues.groupMode` (默认为 `referenced`) 执行操作：
    - **`referenced` 模式:**
      - 获取引用的工作流 ID (`referencedWorkflowId`)。
      - 检查该工作流是否已在其他标签页打开，如果是则切换到该标签页。
      - 如果未打开，调用 `tabStore.addTab` 打开一个新的工作流标签页来编辑引用的工作流。
- **状态计算:** 提供一个计算属性 `isNodeGroup` 判断当前节点是否为 NodeGroup。

---

## `useNodeClientScript.ts`

**核心职责:** 管理节点定义中指定的客户端脚本 (`clientScriptUrl`) 的加载和执行。

**详细功能:**

- **依赖:** 依赖 `nodeStore` 获取节点定义，依赖 `useNodeState` 提供的 `updateInputValue` 和 `getInputValue` 函数。
- **状态管理:** 使用 `ref` 跟踪脚本加载状态 (`clientScriptLoaded`)、错误信息 (`clientScriptError`) 和脚本暴露的 API (`clientScriptApi`)。
- **脚本加载 (`loadClientScript`):**
  - 从 `nodeStore` 获取当前节点类型的定义，检查是否有 `clientScriptUrl`。
  - 构建完整的脚本 URL (基于后端基础 URL)。
  - 使用动态 `import()` 加载脚本模块。
  - 检查模块是否导出了 `setupClientNode` 函数。
  - **调用 `setupClientNode`:** 传递节点 `props` 和一个包含 `updateInputValue`, `getNodeInputValue`, `setNodeOutputValue` (目前是警告), `ref`, `watch` 的 `context` 对象。
  - 存储 `setupClientNode` 返回的 API 到 `clientScriptApi`。
  - 更新加载状态和错误状态。
- **自动加载与监听:**
  - 监听 `nodeStore` 的 `definitionsLoaded` 状态，加载完成后自动检查并加载脚本。
  - 监听节点 `props.data.type` 的变化，如果类型改变，则重置状态并重新检查加载。
  - 在组件挂载时 (`onMounted`) 检查加载。
- **按钮点击代理 (`handleButtonClick`):**
  - 如果 `clientScriptApi` 存在且包含 `onButtonClick` 方法，则调用该方法，将按钮点击事件委托给客户端脚本处理。

---

## `useNodeGroupConnectionValidation.ts`

**核心职责:** 验证 `NodeGroup` 类型节点的外部连接是否与其内部接口快照 (`data.groupInterface`) 兼容。

**详细功能:**

- **依赖:** 接收节点列表、边列表、节点定义列表作为响应式引用。直接导入 `useWorkflowGrouping` 中的 `areTypesCompatible` 函数进行类型检查。
- **计算无效边 (`invalidEdgeIds` computed property):**
  - 遍历所有 `NodeGroup` 节点。
  - 获取每个 `NodeGroup` 的 `groupInterface` 快照。
  - 查找连接到该 `NodeGroup` 的所有边。
  - 对每条连接边：
    - **输入边 (外部 -> NodeGroup):** 检查 `groupInterface.inputs` 中是否存在对应的 `targetHandle` (插槽 key)，并使用 `areTypesCompatible` 检查外部源类型与接口输入类型是否兼容。
    - **输出边 (NodeGroup -> 外部):** 检查 `groupInterface.outputs` 中是否存在对应的 `sourceHandle` (插槽 key)，并使用 `areTypesCompatible` 检查接口输出类型与外部目标类型是否兼容。
  - 如果插槽不存在或类型不兼容，则将该边的 ID 添加到 `edgesToRemove` 列表中。
  - 返回去重后的无效边 ID 数组。
- **用途:** 这个 Composable 的结果可以用来在 UI 上高亮显示无效连接，或者在加载工作流后自动移除这些连接。

---

## `useNodeProps.ts`

**核心职责:** 根据节点的输入/配置定义、连接状态和当前值，计算并提供传递给具体输入/配置 UI 组件（如 `NumberInput`, `ComboInput`, `CodeInput`, `ResourceSelector` 等）的 props。

**详细功能:**

- **依赖:** 依赖 `useNodeState` 获取输入连接状态 (`isInputConnected`) 和配置值 (`getConfigValue`)。依赖 `tabStore` 获取 `activeTabId`，依赖 `projectStore` 获取 `currentProjectId`。
- **计算输入组件 Props (`getInputProps`):**
  - 接收输入定义对象 (`input`) 和输入键 (`inputKey`)。
  - 检查输入是否连接 (`isInputConnected`)。
  - 根据 `input.config.showReceivedValue` 和连接状态确定 `isDisabled` 和 `isReadOnly` 状态。
  - 构建基础 props 对象，包含 `placeholder`, `disabled`, `readonly`, `suggestions`。
  - 根据 `input.type` (INT, FLOAT, COMBO, CODE, BUTTON 等) 添加特定类型的 props (如 `min`, `max`, `step`, `options`, `language`, `label`)。
  - 为特定组件（如 `EmbeddedGroupSelector`）传递上下文 props (`nodeId`, `workflowId`)。
- **计算配置组件 Props (`getConfigProps`):**
  - 接收配置定义对象 (`configDef`) 和配置键 (`configKey`)。
  - 从 `configDef.config` 中提取基础 props。
  - 从节点 `data.configValues._disabled` 和 `_readonly` 获取禁用/只读状态。
  - 合并来自定义和来自值的禁用/只读状态。
  - 添加通用 props 如 `placeholder`。
  - 为特定组件（如 `WorkflowSelector`, `ResourceSelector`）传递上下文 props (`nodeId`, `workflowId`, `projectId`, `groupMode`, `acceptedTypes`)。

---

## `useNodeResize.ts`

**核心职责:** 管理节点的可视宽度，包括用户手动拖拽调整大小和基于节点内容自动计算初始宽度。

**详细功能:**

- **状态管理:** 使用 `ref` 维护当前宽度 (`width`) 和是否正在调整大小 (`isResizing`)。定义最小/最大宽度常量。
- **手动调整大小:**
  - `startResize`: 在 resize handle 上 `mousedown` 时触发，记录起始位置和宽度，添加 `mousemove` 和 `mouseup` 监听器。
  - `mousemove` 处理器: 计算鼠标移动距离（考虑缩放），更新 `width` ref (实时预览)，限制在最小/最大宽度内。
  - `stopResize`: 在 `mouseup` 时触发，移除监听器，调用 VueFlow 的 `updateNode` 将最终宽度持久化到节点 `style` 中，重置 `isResizing` 状态。
- **自动计算初始宽度 (`calculateMinWidth`):**
  - 接收节点标题、描述、输入和输出定义。
  - 基于文本测量 (`measureTextWidth`) 和预定义的布局常量（如 Handle 宽度、间距）估算标题、描述、每个输入行、每个输出行所需的宽度。
  - 考虑不同输入类型（内联、多行、按钮）的布局差异。
  - 根据最宽的插槽名称按比例估算整体宽度。
  - 将计算出的宽度限制在自动计算的最小/最大值 (`AUTO_CALC_MIN_WIDTH`, `AUTO_CALC_MAX_WIDTH`) 之间。
- **初始宽度设置 (`onMounted`):**
  - 获取节点定义。
  - **优先级:**
    1.  使用节点定义中指定的 `width` (如果在允许范围内)。
    2.  如果是 `GroupInput`, `GroupOutput`, `NodeGroup`，使用 `AUTO_CALC_MIN_WIDTH`。
    3.  否则，调用 `calculateMinWidth` 计算宽度。
  - 设置 `width` ref 的初始值。
- **清理:** 在 `onUnmounted` 中调用 `stopResize` 确保移除事件监听器。

---

## `useNodeState.ts`

**核心职责:** 提供访问和修改节点内部状态（主要是输入值和配置值）以及检查输入连接状态的功能。

**详细功能:**

- **输入连接状态:**
  - `isInputConnected`: 检查指定输入句柄 (`handleId`) 是否有任何连接的边。
  - `getInputConnectionCount`: 返回连接到指定输入句柄的边的数量。
  - `isMultiInput`: 检查输入定义中 `multi` 属性是否为 `true`。
- **输入值管理:**
  - `getInputValue`: 获取指定输入键 (`inputKey`) 的当前值，如果值不存在则返回其默认值 (`config.default`)。
  - `updateInputValue`: 更新指定输入键的值，通过调用 VueFlow 的 `updateNodeData` 来修改节点的 `data.inputs[inputKey].value`。
- **配置值管理:**
  - `getConfigValue`: 获取指定配置键 (`configKey`) 的当前值 (`data.configValues[configKey]`)，如果值不存在则返回其默认值 (`configSchema[configKey].config.default`)。
  - `updateConfigValue`: 更新指定配置键的值，通过调用 VueFlow 的 `updateNodeData` 来修改节点的 `data.configValues[configKey]`。
  - **特殊处理:** 如果更新的是 `NodeGroup` 的 `referencedWorkflowId`，则异步调用 `useWorkflowGrouping` 中的 `updateNodeGroupWorkflowReference` 来更新该 NodeGroup 的接口快照并处理不兼容的连接。如果 ID 被清空，则清空节点的 `groupInterface`, `inputs`, `outputs` 并重置标签。

---

## `useProjectManagement.ts`

**核心职责:** 处理与项目相关的操作，如加载项目列表、创建新项目、打开项目。

**详细功能:**

- **依赖:** 依赖 `projectStore` 进行 API 调用和状态管理，依赖 `vue-router` 进行页面导航。
- **状态管理:** 使用 `ref` 维护项目列表 (`projects`)、加载状态 (`isLoading`) 和错误信息 (`error`)。
- **加载项目列表 (`fetchProjects`):**
  - 调用 `projectStore.fetchAvailableProjects` 从后端获取项目列表。
  - 更新 `projects` ref。
  - 在 `onMounted` 时自动调用。
- **创建新项目 (`createNewProject`):**
  - 调用 `projectStore.createProject` 在后端创建新项目。
  - 如果成功，使用 `router.push` 导航到新项目的编辑器页面 (`/editor/:projectId`)。
  - 处理错误并提供提示。
- **打开项目 (`openProject`):**
  - 接收 `projectId`。
  - 使用 `router.push` 导航到指定项目的编辑器页面。

---

## `useUniqueNodeId.ts`

**核心职责:** 在指定的工作流（由 `internalId` 标识的标签页）内生成唯一的元素（节点或边）ID。

**详细功能:**

- **依赖:** 依赖 `workflowStore` 的 `getAllTabStates` getter 来访问指定标签页的当前元素列表。
- **ID 生成 (`generateUniqueNodeId`):**
  - 接收目标工作流的 `internalId` 和可选的 `baseType` (如 'node', 'edge', 'NodeGroup')。
  - 从 `workflowStore` 获取指定 `internalId` 的状态 (`TabWorkflowState`)。
  - 遍历该状态下的所有元素 (`elements`)。
  - 查找具有相同 `baseType` 前缀的现有 ID，并解析出最大的数字后缀。
  - 基于找到的最大后缀 + 1 生成新的 ID (例如，如果存在 `node_5`，则下一个生成的 ID 是 `node_6`)。
  - 确保 `internalId` 存在，否则返回一个基于时间戳和随机数的可能冲突的 ID。

---

## `useWebSocket.ts`

**核心职责:** 管理与后端服务的 WebSocket 连接，处理消息的发送、接收和分发。

**详细功能:**

- **连接管理 (`connect`, `disconnect`):**
  - 使用 `getWebSocketUrl` 获取 WebSocket URL。
  - 建立 WebSocket 连接，并设置 `onopen`, `onmessage`, `onerror`, `onclose` 事件处理器。
  - 维护连接状态 (`isConnected` ref)。
  - 提供断开连接的方法。
  - 在 `onMounted` 时自动连接，`onUnmounted` 时断开。
  - 包含简单的重连尝试逻辑（注释掉了）。
- **消息队列:** 维护一个消息队列 (`messageQueue`)，用于在连接建立前缓存待发送的消息，连接成功后自动发送。
- **消息发送 (`sendMessage`):**
  - 检查连接是否处于 `OPEN` 状态。
  - 如果已连接，发送 JSON 序列化后的消息。
  - 如果未连接，将消息加入队列并尝试连接。
- **消息接收 (`onmessage`):**
  - 解析收到的 JSON 消息。
  - **标签页过滤:** 检查消息 `payload` 中是否包含 `internalId`。如果存在且与当前活动标签页 ID (`activeTabId`) 不匹配，则忽略该消息。
  - **消息分发:** 根据消息类型 (`WebSocketMessageType`)：
    - `NODE_STATUS_UPDATE`: 调用 `executionStore.updateNodeStatus`，传递 `activeTabId` 和 `payload`。
    - `WORKFLOW_STATUS_UPDATE`: 调用 `executionStore.updateWorkflowStatus`，传递 `activeTabId` 和 `payload`。如果状态是 `RUNNING`，先调用 `executionStore.resetExecutionState`。
    - 处理其他消息类型（TODO）。

---

## `useWorkflowData.ts`

**核心职责:** 处理工作流数据的持久化（加载、保存、删除）和格式转换。

**详细功能:**

- **依赖:** 依赖 `projectStore`, `workflowStore`, `themeStore`, `useEdgeStyles`。使用 `@/api/workflow` 中的 API 函数。使用 `@/utils/workflowTransformer` 中的转换函数。
- **工作流保存 (`saveWorkflow`):**
  - 接收 `internalId`, `elements`, `viewport`, 和可选的 `newName`。
  - 获取 `projectId`。
  - 使用 `transformVueFlowToCoreWorkflow` 将 VueFlow 格式的 `elements` 和 `viewport` 转换为核心工作流格式。
  - 判断是新建保存还是更新现有。
  - 构建 `WorkflowObject` (包含核心数据和从 `workflowStore` 获取的元数据如 `interfaceInputs/Outputs`)。
  - 调用 `saveWorkflowApi` (传递 `projectId` 和可选的 `workflowId`)。
  - **返回**保存后的 `WorkflowData` 或 `null` 表示失败。**不再直接修改 store 状态或 tab 信息**。
- **工作流加载 (`loadWorkflow`):**
  - 接收 `internalId`, `projectId`, `workflowId`。
  - 调用 `loadWorkflowApi` (传递 `projectId` 和 `workflowId`)。
  - 如果成功加载 `WorkflowObject`：
    - 使用 `transformWorkflowToVueFlow` 将其转换为 VueFlow 格式 (`FlowExportObject`)，并应用当前主题的边样式。
    - **返回** `{ success: true, loadedData, flowToLoad }`。
  - 如果加载失败，返回 `{ success: false }`。
- **获取可用工作流列表 (`fetchAvailableWorkflows`):**
  - 获取 `projectId`。
  - 调用 `listWorkflowsApi` (传递 `projectId`)。
  - 返回工作流元数据列表 (`{ id, name }[]`) 或空数组。
- **删除工作流 (`deleteWorkflow`):**
  - 接收 `workflowId`。
  - 获取 `projectId`。
  - 调用 `deleteWorkflowApi` (传递 `projectId` 和 `workflowId`)。
  - 返回 `true` 或 `false` 表示 API 调用是否成功。
- **另存为新工作流 (`saveWorkflowAsNew`):**
  - 接收 `projectId` 和不包含 `id` 的 `WorkflowObject`。
  - 调用 `saveWorkflowApi` (只传递 `projectId` 和 `workflowObject`) 来创建全新的工作流文件。
  - 返回保存后的 `WorkflowData` (包含新 ID) 或 `null`。
- **加载默认工作流 (`loadDefaultWorkflow`):**
  - 不再加载模板文件，直接返回一个包含空 `elements` 数组、默认 `viewport` 和包含初始动态 `CONVERTIBLE_ANY` 插槽的空 `interfaceInputs`/`interfaceOutputs` 的结构。
- **接口提取 (`extractGroupInterface`):**
  - 导出从 `workflowTransformer` 导入的 `extractGroupInterfaceUtil` 函数，用于从 `WorkflowData` 中提取 `GroupInterfaceInfo`。

---

## `useWorkflowGrouping.ts`

**核心职责:** 实现将选定节点创建为可引用的节点组（NodeGroup）的核心逻辑。

**详细功能:**

- **依赖:** 依赖 `workflowStore`, `tabStore`, `nodeStore`, `themeStore`, `useUniqueNodeId`, `useWorkflowData`, `useEdgeStyles`, `useVueFlow`。
- **类型兼容性检查 (`areTypesCompatible`):** (已移至顶层并导出) 定义基本的插槽类型兼容规则。
- **更新 NodeGroup 引用 (`updateNodeGroupWorkflowReference`):**
  - 当 NodeGroup 的 `referencedWorkflowId` 配置改变时调用。
  - 加载新的引用工作流数据 (`useWorkflowData.loadWorkflow`)。
  - 提取新工作流的接口 (`useWorkflowData.extractGroupInterface`)。
  - 使用 `updateNodeData` 更新 NodeGroup 节点的 `data.groupInterface` 快照和 `label`。
  - 检查并移除连接到该 NodeGroup 的、与新接口不兼容的外部边。
  - 标记父工作流为 `dirty`。
- **创建组核心逻辑 (`createGroupFromSelectionLogic`):**
  - 接收选中的节点 ID、标签页 ID 和当前状态。
  - **分析边界:** 遍历所有边，区分内部边和边界边。根据边界边推断新组的输入和输出接口 (`groupInputsMap`, `groupOutputsMap`)，并记录外部节点如何连接到这些接口 (`externalToGroupNodeConnections`)。
  - **构建新工作流:**
    - 创建 `GroupInput` 和 `GroupOutput` 幻影节点。
    - 将被选中的节点（调整位置）和内部边添加到新工作流的 `nodes` 和 `edges` 列表。
    - 创建连接 `GroupInput`/`Output` 幻影节点到原内部节点的新边。
    - 定义新工作流的 `interfaceInputs` 和 `interfaceOutputs` (基于 `groupInputsMap`, `groupOutputsMap`)。
  - **保存新工作流:** 使用 `useWorkflowData.saveWorkflowAsNew` 将构建的新工作流对象保存为一个独立的文件，获取其 `workflowId`。
  - **创建 NodeGroup 实例:**
    - 在父工作流中生成一个 `NodeGroup` 类型的节点实例。
    - 将其 `position` 设置在原选区的中心。
    - 设置 `data.referencedWorkflowId` 为新保存的工作流 ID。
    - 设置 `data.groupInterface` 为提取到的接口快照。
    - 设置 `data.configValues.groupMode` 为 `referenced`。
  - **修改父画布:**
    - 从父工作流状态中移除被选中的节点和所有相关边（内部和边界）。
    - 添加新的 `NodeGroup` 实例。
    - 根据 `externalToGroupNodeConnections` 记录，创建连接外部节点到新 `NodeGroup` 实例对应接口句柄的新边，并应用样式。
  - **更新状态:** 调用 `workflowStore.setElements` 更新父工作流状态，并标记为 `dirty`。
  - **打开新标签页:** 调用 `tabStore.openGroupEditorTab` 打开新创建的工作流进行编辑。
- **公共触发函数 (`groupSelectedNodes`):**
  - **(原 `useWorkflowActions.createGroupFromSelection` 的逻辑已整合于此)**
  - 接收节点 ID 列表和标签页 ID。
  - 获取或确保状态存在。
  - 调用 `createGroupFromSelectionLogic` 执行分组。

---

## `useWorkflowInterfaceManagement.ts`

**核心职责:** 管理工作流或节点组编辑器中的接口定义（输入/输出插槽）。

**详细功能:**

- **依赖:** 依赖 `tabStore`, `useWorkflowManager`, `useWorkflowViewManagement`。
- **更新组接口信息 (`updateGroupInterfaceInfo`):**
  - 仅用于 `groupEditor` 类型的标签页。
  - 更新 `workflowManager` 中对应标签页状态的 `groupInterfaceInfo` 属性。这个属性用于驱动 `BaseNode` 中 `GroupInput`/`Output` 节点的插槽显示。
- **移除句柄连接 (`removeEdgesForHandle`):**
  - 接收标签页 ID、节点 ID、句柄 ID (插槽 key) 和句柄类型 ('source' 或 'target')。
  - 查找并过滤出连接到指定节点和句柄的所有边。
  - 从 `workflowManager` 管理的状态中移除这些边。
  - 调用 `workflowManager.markAsDirty` 和 `workflowManager.setElements` (以记录历史)。
  - 如果 VueFlow 实例存在，调用实例的 `removeEdges` 更新视图。
- **更新工作流接口 (`updateWorkflowInterface`):**
  - 接收标签页 ID、新的 `inputs` 和 `outputs` 定义 (Record<string, GroupSlotInfo>)。
  - 更新 `workflowManager` 中对应标签页状态的 `workflowData.interfaceInputs` 和 `workflowData.interfaceOutputs`。
  - 调用 `workflowManager.markAsDirty`。
  - 如果当前是 `groupEditor` 标签页，则同时调用 `updateGroupInterfaceInfo` 来更新用于驱动视图的 `groupInterfaceInfo`。
- **获取活动组接口 (`getActiveGroupInterfaceInfo` computed property):**
  - 返回当前活动标签页（如果是 `groupEditor` 类型）的 `groupInterfaceInfo`，供 `InterfacePanel` 等 UI 组件使用。

---

## `useWorkflowManager.ts`

**核心职责:** 作为中央状态管理器，维护所有打开标签页的工作流状态 (`TabWorkflowState`) 和操作历史 (`HistoryState`)。提供原子性的状态访问和修改方法。

**详细功能:**

- **核心状态:** 使用 `reactive(new Map())` 存储 `tabStates` 和 `tabHistories`。
- **依赖:** 依赖 `tabStore`, `themeStore`, `useEdgeStyles`, `useWorkflowData`。
- **内部历史管理:**
  - `ensureHistoryState`: 确保指定标签页的历史记录对象存在。
  - `recordHistory`: 创建当前状态（`elements`, `viewport`）的快照，添加到历史记录数组，处理撤销/重做指针和历史记录大小限制。跳过未改变状态的记录。
  - `clearHistory`: 清空指定标签页的历史记录。
  - `removeHistory`: 删除指定标签页的历史记录（通常在关闭标签页时调用）。
  - `_applyStateSnapshot`: **内部函数**，用于将历史快照应用回状态，**不**记录新的历史或标记为 dirty（供 undo/redo 使用）。
- **核心逻辑函数 (内部):**
  - `_applyWorkflowToTab`: 将加载的 `WorkflowData` 应用到指定标签页的状态，包括更新 `workflowData`, `viewport`, `elements` (并计算样式), `groupInterfaceInfo`，重置 `isDirty`, 设置 `isLoaded`，清空并记录初始历史，更新 `tabStore`。确保添加默认的动态插槽。
  - `applyDefaultWorkflowToTab`: 创建一个临时的空白 `WorkflowData` 对象，并调用 `_applyWorkflowToTab` 将其应用到指定标签页，用于初始化新工作流。
- **公共状态管理 API:**
  - `getActiveTabState`: 获取当前活动标签页的状态。
  - `ensureTabState`: 获取或创建指定标签页的状态。如果状态是新创建且标签页是新工作流，则自动调用 `applyDefaultWorkflowToTab`。
  - `getWorkflowData`: 获取指定标签页的 `workflowData`。
  - `isWorkflowDirty`: 检查指定标签页是否 `isDirty`。
  - `getElements`: 获取指定标签页 `elements` 的深拷贝。
  - `setElements`: 更新指定标签页的 `elements`，进行深拷贝和变更检查，如果改变则标记 `dirty` 并记录历史。
  - `markAsDirty`: 标记指定标签页为 `dirty` 并同步到 `tabStore`。
  - `removeWorkflowData`: 删除指定标签页的状态和历史记录。
  - `clearWorkflowStatesForProject`: 清除属于特定项目的所有标签页的状态和历史。
  - `isTabLoaded`: 检查指定标签页的状态是否已加载 (`isLoaded`)。
  - `setElementsAndInterface`: **原子性**地更新 `elements` 和 `interfaceInputs`/`interfaceOutputs`，进行变更检查，如果改变则标记 `dirty` 并记录**单次**历史。
- **公共历史 API:**
  - `getHistoryState`: 获取指定标签页的 `HistoryState` 对象（包含 `history` 数组和 `historyIndex`）。
  - `undo`: 回退到上一个历史快照，调用 `_applyStateSnapshot` 应用状态，更新 `historyIndex`，返回应用的快照。
  - `redo`: 前进到下一个历史快照，调用 `_applyStateSnapshot` 应用状态，更新 `historyIndex`，返回应用的快照。
- **工作流操作:**
  - **`createNewWorkflow`:** (原 `useWorkflowActions.createNewWorkflow` 的逻辑已整合于此)
    - 接收目标标签页的 `internalId`。
    - 使用 `ensureTabState` 获取状态。
    - 检查 `isDirty` 状态并进行确认提示。
    - 调用 `applyDefaultWorkflowToTab` 来应用空白工作流模板、重置状态和历史记录。
    - 更新 `tabStore` 中的标签页元数据（清除 `associatedId`，设置 `isDirty: false`）。

---

## `useWorkflowViewManagement.ts`

**核心职责:** 管理与 VueFlow 视图相关的状态和操作，主要是 VueFlow 实例本身的引用和视口（Viewport）状态。

**详细功能:**

- **依赖:** 依赖 `workflowManager`, `useEdgeStyles`, `themeStore`。
- **实例管理:**
  - `setVueFlowInstance`: 将 VueFlow 组件实例 (`ManagedVueFlowInstance`) 或 `null` 存储到 `workflowManager` 中对应标签页状态的 `vueFlowInstance` 属性。**不再**在此处主动同步状态到实例。
  - `getVueFlowInstance`: 从 `workflowManager` 获取指定标签页的 `vueFlowInstance`。
- **视口管理 (`setViewport`):**
  - 更新 `workflowManager` 中对应标签页状态的 `viewport` 属性。视口变化通常不标记为 `dirty` 或记录历史。
- **边样式更新 (`updateEdgeStylesForTab`):**
  - 在需要时（如主题切换）调用。
  - 获取指定标签页状态中的 `elements`。
  - 使用 `useEdgeStyles.getEdgeStyleProps` 重新计算所有边的样式。
  - 直接更新 `workflowManager` 中该标签页状态的 `elements` 数组（包含新样式的边）。**不**通过 `setElements` 以避免触发历史记录。
  - 如果 VueFlow 实例存在，调用实例的 `setEdges` 更新视图中的边样式。
