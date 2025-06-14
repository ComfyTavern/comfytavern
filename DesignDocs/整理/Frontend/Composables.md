# 前端 Composables (`apps/frontend-vueflow/src/composables/`) 概览

`apps/frontend-vueflow/src/composables/` 目录是 ComfyTavern 前端应用中所有 Vue 3 Composition API 函数（即可组合函数或 Hooks）的核心存放位置。这些函数通常以 `use` 开头，例如 `useClipboard`、`useWebSocket` 等。

**核心价值**：

Composable 函数在项目中的核心价值在于封装和复用有状态的、响应式的逻辑。通过将相关的状态和操作逻辑提取到可组合函数中，可以使得：

*   **组件代码更简洁**：组件可以将复杂的逻辑委托给 Composable 函数，自身专注于模板和视图相关的职责。
*   **逻辑更易于维护**：相关的逻辑集中在一个地方，便于理解、修改和测试。
*   **提高代码复用性**：多个组件可以共享同一个 Composable 函数提供的功能。
*   **更好的关注点分离**：将不同维度的逻辑（如画布交互、编辑器状态、节点行为等）分离到不同的 Composable 中。

**组织方式**：

Composable 函数根据其功能领域或关联的 UI 部分进行子目录组织，以便于管理和查找：

*   **根目录下的 Composables** (如 [`apps/frontend-vueflow/src/composables/useClipboard.ts`](apps/frontend-vueflow/src/composables/useClipboard.ts:1), [`apps/frontend-vueflow/src/composables/useWebSocket.ts`](apps/frontend-vueflow/src/composables/useWebSocket.ts:1))：存放一些更通用的、跨领域的功能，例如剪贴板操作、WebSocket 通信等。
*   **`canvas/`** ([`apps/frontend-vueflow/src/composables/canvas/`](apps/frontend-vueflow/src/composables/canvas/)): 存放与 VueFlow 画布交互、元素操作（节点、边）、拖拽、键盘快捷键、上下文菜单等相关的逻辑。
*   **`editor/`** ([`apps/frontend-vueflow/src/composables/editor/`](apps/frontend-vueflow/src/composables/editor/)): 存放与整体编辑器状态、标签页管理、项目管理、全局键盘快捷键、路由处理等相关的逻辑。
*   **`group/`** ([`apps/frontend-vueflow/src/composables/group/`](apps/frontend-vueflow/src/composables/group/)): 存放与节点组（NodeGroup）功能相关的逻辑，如接口同步、IO 操作、状态管理等。
*   **`node/`** ([`apps/frontend-vueflow/src/composables/node/`](apps/frontend-vueflow/src/composables/node/)): 存放与单个节点行为、属性、状态管理、客户端脚本、插槽定义辅助等相关的逻辑。
*   **`workflow/`** ([`apps/frontend-vueflow/src/composables/workflow/`](apps/frontend-vueflow/src/composables/workflow/)): 存放与工作流数据管理、执行、历史记录、预览、视图管理等相关的逻辑。

## 主要 Composable 子目录/类别详解

### 1. 根目录 Composables

这些 Composable 函数提供了应用级别的通用功能。

#### [`apps/frontend-vueflow/src/composables/useClipboard.ts`](apps/frontend-vueflow/src/composables/useClipboard.ts:1)

*   **核心功能**：封装了与系统剪贴板交互的功能，包括读取和写入文本。
*   **暴露的接口**：
    *   `isSupported` (ref): 布尔值，指示浏览器是否支持剪贴板 API。
    *   `text` (ref): 最近写入或读取的文本内容。
    *   `error` (ref): 最近一次操作的错误信息。
    *   `permissionRead` (ref): 剪贴板读取权限状态。
    *   `permissionWrite` (ref): 剪贴板写入权限状态。
    *   `writeText(value: string): Promise<void>`: 异步将文本写入剪贴板。
    *   `readText(): Promise<string | null>`: 异步从剪贴板读取文本。
*   **典型使用场景**：在需要复制文本内容（如节点 ID、错误信息）或从剪贴板粘贴文本（如导入配置）的场景中使用。

#### [`apps/frontend-vueflow/src/composables/useWebSocket.ts`](apps/frontend-vueflow/src/composables/useWebSocket.ts:1)

*   **核心功能**：管理与后端 WebSocket 服务的连接、消息发送和接收。它处理连接状态、错误、消息队列、自动重连，并根据消息类型分发到相应的 store 或处理逻辑。
*   **暴露的接口**：
    *   `isConnected` (readonly ref): 布尔值，指示 WebSocket 是否已连接。
    *   `error` (readonly ref): WebSocket 连接或通信错误信息。
    *   `sendMessage(message: WebSocketMessage): void`: 发送 WebSocket 消息到后端。
    *   `setInitiatingTabForNextPrompt(tabId: string): void`: 设置下一个 `PROMPT_ACCEPTED_RESPONSE` 期望关联的标签页 ID，应在发送 `PROMPT_REQUEST` 前调用。
    *   `initializeWebSocket(): void`: 初始化 WebSocket 连接（通常在应用启动时调用）。
    *   `closeWebSocket(): void`: 关闭 WebSocket 连接。
*   **典型使用场景**：整个应用中需要与后端进行实时双向通信的场景，如工作流执行状态更新、节点状态更新、错误通知等。

### 2. `canvas/` - 画布交互逻辑

该目录下的 Composable 函数主要负责处理 VueFlow 画布上的用户交互和元素操作。

#### [`apps/frontend-vueflow/src/composables/canvas/useCanvasInteraction.ts`](apps/frontend-vueflow/src/composables/canvas/useCanvasInteraction.ts:1)

*   **核心功能**：处理与 Vue Flow 画布元素的直接交互，如从面板添加节点、处理节点拖拽停止、删除画布元素等。
*   **暴露的接口**：
    *   `handleAddNodeFromPanel(fullNodeType: string, position?: XYPosition): Promise<void>`: 从节点面板向画布添加新节点，可指定位置。
    *   `handleConnect(params: Connection): void`: 处理连接建立事件（主要由 `useCanvasConnections` 内部处理，此处仅为事件监听）。
    *   `handleNodesDragStop(event: NodeDragEvent): void`: 处理节点拖拽停止事件，更新节点位置并记录历史。
    *   `handleElementsRemove(removedElements: (Node | Edge)[]): void`: 处理画布元素（节点或边）被删除的事件，并记录历史。
*   **典型使用场景**：在画布组件 (`Canvas.vue`) 中监听和响应用户的直接操作，如拖放节点、删除元素等。

#### [`apps/frontend-vueflow/src/composables/canvas/useCanvasConnections.ts`](apps/frontend-vueflow/src/composables/canvas/useCanvasConnections.ts:1)

*   **核心功能**：管理画布上节点之间的连接（边）的创建、验证和更新。它处理连接的有效性检查（类型兼容性、是否已占用等）、边的样式、多输入插槽的连接逻辑以及 `CONVERTIBLE_ANY` 类型的转换。
*   **暴露的接口**：
    *   `createEdge(params: Connection): Edge | null`: 根据连接参数创建一条新的边对象，如果连接无效则返回 `null`。
    *   `isValidConnection(connection: Connection, updatingEdgeId?: string): boolean`: 验证给定的连接是否有效。
    *   `removeNodeConnections(nodeId: string): void`: 移除与指定节点相关的所有连接。
    *   `removeTargetConnections(nodeId: string, handleId: string): void`: 移除连接到指定节点特定目标句柄的所有连接。
    *   `draggingState` (ref): 存储当前拖拽连接的状态信息。
    *   `reorderPreviewIndex` (ref): 在拖拽连接到多输入插槽时，预览插入位置的索引。
*   **典型使用场景**：在画布组件中处理用户拖拽创建连接、更新连接以及验证连接有效性的逻辑。

#### [`apps/frontend-vueflow/src/composables/canvas/useCanvasKeyboardShortcuts.ts`](apps/frontend-vueflow/src/composables/canvas/useCanvasKeyboardShortcuts.ts:1)

*   **核心功能**：处理在 VueFlow 画布上触发的键盘快捷键，如创建节点组 (Ctrl/Cmd+G)、全选 (Ctrl/Cmd+A)、删除选中元素 (Delete/Backspace)、复制/粘贴 (Ctrl/Cmd+C/V)、系统复制/粘贴 (Ctrl/Cmd+Shift+C/V)、撤销/重做 (Ctrl/Cmd+Z/Shift+Z) 以及 Alt+点击节点循环预览输出。
*   **暴露的接口**：
    *   `deleteSelectedElements(): Promise<void>`: 删除当前选中的节点和边。
    *   `selectAllElements(): void`: 选中画布上所有的节点和边。
    *   `handleRedo(): void`: 执行重做操作。
    *   `groupSelectedNodes(): void`: 将选中的节点创建为一个新的节点组。
    *   `handleUndo(): void`: 执行撤销操作。
*   **典型使用场景**：在画布组件挂载时注册全局键盘事件监听器，以响应用户的快捷键操作。

#### [`apps/frontend-vueflow/src/composables/canvas/useDnd.ts`](apps/frontend-vueflow/src/composables/canvas/useDnd.ts:1)

*   **核心功能**：实现从节点面板拖拽节点定义到画布上创建新节点的功能。它处理拖拽开始、拖拽悬停、拖拽离开和放置等事件，并在放置时根据拖拽数据和鼠标位置创建新节点。
*   **暴露的接口**：
    *   `draggedNodeData` (ref): 当前正在拖拽的节点数据。
    *   `isDragOver` (ref): 布尔值，指示是否有元素正在画布上方拖拽。
    *   `isDragging` (ref): 布尔值，指示当前是否正在进行拖拽操作。
    *   `onDragStart(event: DragEvent, nodeData: any): void`: 处理拖拽开始事件。
    *   `onDragLeave(): void`: 处理拖拽离开事件。
    *   `onDragOver(event: DragEvent): void`: 处理拖拽悬停事件。
    *   `onDrop(event: DragEvent): Promise<void>`: 处理放置事件，创建新节点。
*   **典型使用场景**：在节点面板的节点项上绑定 `onDragStart`，在画布组件上绑定 `onDragOver`、`onDragLeave` 和 `onDrop`，以实现拖放添加节点的功能。

### 3. `editor/` - 编辑器状态与管理

该目录下的 Composable 函数负责管理整个编辑器的全局状态、标签页、项目、快捷键等。

#### [`apps/frontend-vueflow/src/composables/editor/useEditorState.ts`](apps/frontend-vueflow/src/composables/editor/useEditorState.ts:1)

*   **核心功能**：管理编辑器级别的杂项状态，包括加载状态、节点预览选择、侧边栏管理器引用，以及可停靠编辑器的状态（可见性、标签页数据、活动标签页）。
*   **暴露的接口**：
    *   `loading` (ref): 初始节点定义获取的加载状态。
    *   `selectedNodeForPreview` (ref): 当前在节点面板中选择用于预览的节点定义。
    *   `sidebarManagerRef` (shallowRef): 对侧边栏管理器组件实例的引用。
    *   `isDockedEditorVisible` (ref): 控制可停靠编辑器的可见性。
    *   `editorTabs` (ref): 存储当前打开的可停靠编辑器标签页数组。
    *   `activeEditorTabId` (ref): 当前激活的可停靠编辑器标签页 ID。
    *   `activeEditorTab` (computed): 当前激活的标签页数据对象。
    *   `requestedContextToOpen` (ref): 存储请求打开可停靠编辑器的上下文信息。
    *   `handleNodeSelected(node: FrontendNodeDefinition): void`: 处理节点面板中的节点选择事件。
    *   `handleError(error: any, context: string): void`: 通用错误处理。
    *   `toggleDockedEditor(): void`: 切换可停靠编辑器的可见性。
    *   `openOrFocusEditorTab(context: EditorOpeningContext): void`: 打开或聚焦一个可停靠编辑器标签页。
    *   `closeEditorTab(tabIdToClose: string): void`: 关闭指定的可停靠编辑器标签页。
    *   `setActiveEditorTab(tabId: string): void`: 设置活动的可停靠编辑器标签页。
    *   `markTabAsDirty(tabId: string, dirtyState?: boolean): void`: 标记或清除可停靠编辑器标签页的“脏”状态。
    *   `clearRequestedContext(): void`: 清除请求打开编辑器的上下文。
*   **典型使用场景**：在应用顶层或主要布局组件中使用，以管理和响应编辑器级别的状态变化。

#### [`apps/frontend-vueflow/src/composables/editor/useTabManagement.ts`](apps/frontend-vueflow/src/composables/editor/useTabManagement.ts:1)

*   **核心功能**：管理活动画布标签页更改相关的副作用。当活动标签页切换时，它负责清除节点预览、确保新标签页状态存在、关联/解除关联 VueFlow 实例、加载工作流数据（如果需要）以及触发界面更新。
*   **暴露的接口**：此 Composable 主要通过 `watch` 监听 `activeTabId` 的变化来执行副作用，不直接暴露方法给外部调用。
*   **典型使用场景**：在主编辑器视图 (`EditorView.vue`) 中使用，传入活动标签页 ID、当前 VueFlow 实例引用和节点预览引用，以响应标签页切换。

#### [`apps/frontend-vueflow/src/composables/editor/useKeyboardShortcuts.ts`](apps/frontend-vueflow/src/composables/editor/useKeyboardShortcuts.ts:1)

*   **核心功能**：处理全局编辑器级别的键盘快捷键，特别是保存操作 (Ctrl+S/Cmd+S)。当检测到保存快捷键时，它会根据当前活动标签页的状态（是否为新工作流、是否已修改）触发相应的工作流保存逻辑（可能提示用户输入名称或直接保存）。
*   **暴露的接口**：此 Composable 主要通过在挂载时添加全局键盘事件监听器来工作，不直接暴露方法。
*   **典型使用场景**：在应用的主布局或编辑器视图中初始化，以启用全局保存快捷键。

#### [`apps/frontend-vueflow/src/composables/editor/useProjectManagement.ts`](apps/frontend-vueflow/src/composables/editor/useProjectManagement.ts:1)

*   **核心功能**：管理项目的加载、创建和导航。它负责从后端获取可用项目列表，处理新项目的创建（包括与后端交互和用户输入），以及在用户选择项目后导航到相应的编辑器视图。
*   **暴露的接口**：
    *   `projects` (ref): 当前加载的项目元数据列表。
    *   `isLoading` (ref): 布尔值，指示项目操作是否正在加载中。
    *   `error` (ref): 项目操作相关的错误信息。
    *   `fetchProjects(): Promise<void>`: 异步加载可用项目列表。
    *   `createNewProject(projectName: string): Promise<void>`: 创建一个新项目并导航到其编辑器。
    *   `openProject(projectId: string): void`: 打开一个现有项目，导航到其编辑器。
*   **典型使用场景**：在项目列表视图 (`ProjectListView.vue`) 或任何需要展示、创建或打开项目的地方使用。

### 4. `group/` - 节点组逻辑

该目录下的 Composable 函数专注于节点组（NodeGroup）的特定功能。

#### [`apps/frontend-vueflow/src/composables/group/useWorkflowGrouping.ts`](apps/frontend-vueflow/src/composables/group/useWorkflowGrouping.ts:1)

*   **核心功能**：提供将画布上选定的一组节点及其内部连接转换为一个新的、独立的子工作流，并在主工作流中用一个 `NodeGroup` 节点实例替换它们的功能。它还处理 `NodeGroup` 节点引用的工作流的更新。
*   **暴露的接口**：
    *   `groupSelectedNodes(selectedNodeIds: string[], currentTabId: string): Promise<void>`: 将当前标签页中选定的节点创建一个新的节点组。
    *   `updateNodeGroupWorkflowReference(nodeId: string, newWorkflowId: string, tabId?: string): Promise<{ success: boolean; updatedNodeData?: any; edgeIdsToRemove?: string[] }>`: 更新指定 `NodeGroup` 节点引用的子工作流，并处理接口兼容性及连接更新。
*   **典型使用场景**：当用户通过快捷键或上下文菜单触发“创建节点组”操作时，或在 `NodeGroup` 节点的配置面板中更改其引用的工作流时使用。

#### [`apps/frontend-vueflow/src/composables/group/useGroupInterfaceSync.ts`](apps/frontend-vueflow/src/composables/group/useGroupInterfaceSync.ts:1)

*   **核心功能**：当 `GroupInput` 或 `GroupOutput` 节点的 `CONVERTIBLE_ANY` 类型插槽因连接而发生类型转换时，此 Composable 负责将这些更改同步到中央工作流的接口定义 (`workflowData.interfaceInputs` 或 `workflowData.interfaceOutputs`)。它还会自动在接口定义中添加一个新的 `CONVERTIBLE_ANY` 占位符插槽。
*   **暴露的接口**：
    *   `syncInterfaceSlotFromConnection(tabId: string, nodeId: string, slotKey: string, newSlotInfo: GroupSlotInfo, direction: 'inputs' | 'outputs'): { inputs: Record<string, GroupSlotInfo>, outputs: Record<string, GroupSlotInfo> } | null`: 同步单个插槽的类型更改到中央工作流接口，并返回更新后的接口定义（如果成功）。
*   **典型使用场景**：主要由 [`apps/frontend-vueflow/src/composables/canvas/useCanvasConnections.ts`](apps/frontend-vueflow/src/composables/canvas/useCanvasConnections.ts:1) 在处理涉及 `GroupInput`/`GroupOutput` 节点的 `CONVERTIBLE_ANY` 插槽的连接时内部调用。

### 5. `node/` - 单个节点逻辑

此目录包含与单个节点行为、状态和配置相关的 Composable 函数。

#### [`apps/frontend-vueflow/src/composables/node/useNodeActions.ts`](apps/frontend-vueflow/src/composables/node/useNodeActions.ts:1)

*   **核心功能**：处理节点上的用户操作，例如按钮点击。它还提供了一个计算属性来判断当前节点是否为 `NodeGroup`。
*   **暴露的接口**：
    *   `handleButtonClick(inputKey: string): void`: 处理节点上按钮输入（类型为 `button` 的输入）的点击事件，通常会触发工作流存储中的相应操作。
    *   `isNodeGroup` (computed): 布尔值，指示当前 Composable 实例关联的节点是否为 `NodeGroup` 类型。
*   **典型使用场景**：在基础节点组件 (`BaseNode.vue`) 或特定节点类型的组件中使用，以响应节点内部 UI 元素的交互。

#### [`apps/frontend-vueflow/src/composables/node/useNodeState.ts`](apps/frontend-vueflow/src/composables/node/useNodeState.ts:1)

*   **核心功能**：管理单个节点实例的状态，包括其输入值的获取与更新、配置值的获取与更新，以及检查输入是否已连接等。所有状态更新操作都会通过工作流存储 (`workflowStore`) 的协调器函数进行，以确保历史记录和状态一致性。
*   **暴露的接口**：
    *   `isInputConnected(handleId: string): boolean`: 检查指定的输入句柄是否已连接。
    *   `getInputConnectionCount(handleId: string): number`: 获取指定输入句柄的连接数量。
    *   `isMultiInput(input: any): boolean`: 判断给定的输入定义是否为多输入类型。
    *   `getInputValue(inputKey: string): any`: 获取指定输入键的当前值。
    *   `updateInputValue(inputKey: string, value: any): void`: 更新指定输入键的值，并记录历史。
    *   `getConfigValue(configKey: string): any`: 获取指定配置键的当前值。
    *   `updateConfigValue(configKey: string, value: any): void`: 更新指定配置键的值，并记录历史。
*   **典型使用场景**：在基础节点组件 (`BaseNode.vue`) 或特定节点类型的组件中使用，以管理和响应节点数据和配置的变化。

#### [`apps/frontend-vueflow/src/composables/node/useNodeClientScript.ts`](apps/frontend-vueflow/src/composables/node/useNodeClientScript.ts:1)

*   **核心功能**：负责加载和执行与特定节点类型关联的客户端脚本。这些脚本可以为节点提供额外的交互逻辑或动态行为。它处理脚本的加载、错误处理，并提供一个 API 来调用脚本中定义的钩子函数和处理按钮点击。
*   **暴露的接口**：
    *   `clientScriptLoaded` (ref): 布尔值，指示客户端脚本是否已成功加载。
    *   `clientScriptError` (ref): 客户端脚本加载或执行过程中的错误信息。
    *   `clientScriptApi` (ref): 存储由客户端脚本的 `setupClientNode` 函数返回的 API 对象。
    *   `handleButtonClick(inputKey: string): Promise<void>`: 处理节点上按钮的点击事件，会先尝试调用客户端脚本的 `onButtonClick` 钩子，然后向后端发送 WebSocket 消息。
    *   `executeClientHook(hookName: string, ...args: any[]): Promise<any>`: 执行客户端脚本 API 上指定的钩子函数。
*   **典型使用场景**：在基础节点组件 (`BaseNode.vue`) 中使用，以便节点可以根据其定义加载并运行自定义的客户端逻辑。

#### [`apps/frontend-vueflow/src/composables/node/useSlotDefinitionHelper.ts`](apps/frontend-vueflow/src/composables/node/useSlotDefinitionHelper.ts:1)

*   **核心功能**：提供一个统一的函数 `getSlotDefinition`，用于根据给定的节点、句柄 ID 和句柄类型（输入/输出）从正确的数据源（静态节点定义、节点实例数据、`NodeGroup` 接口、工作流接口）查找并返回插槽（输入或输出）的完整定义。
*   **暴露的接口**：
    *   `getSlotDefinition(node: VueFlowNode, handleId: string | null | undefined, handleType: 'source' | 'target', currentWorkflowData?: WorkflowObject | null): GroupSlotInfo | ComfyInputDefinition | OutputDefinition | undefined`: 获取插槽定义。
*   **典型使用场景**：在需要获取插槽详细信息（如类型、名称、描述等）的任何地方使用，例如在验证连接、渲染节点 UI、或处理插槽相关逻辑时。

### 6. `workflow/` - 工作流管理与执行

该目录下的 Composable 函数负责工作流的整体数据管理、执行流程、历史记录等。

#### [`apps/frontend-vueflow/src/composables/workflow/useWorkflowData.ts`](apps/frontend-vueflow/src/composables/workflow/useWorkflowData.ts:1)

*   **核心功能**：处理工作流数据的加载、保存、删除以及与后端 API 的交互。它封装了工作流数据格式的转换逻辑（例如，从存储格式到 VueFlow 格式），并提供了加载默认工作流的功能。
*   **暴露的接口**：
    *   `extractGroupInterface(workflow: WorkflowData): GroupInterfaceInfo`: 从工作流数据中提取其作为节点组时的接口信息。
    *   `saveWorkflow(internalId: string, elements: Array<VueFlowNode | VueFlowEdge>, viewport: SharedViewport, newName?: string): Promise<WorkflowData | null>`: 保存当前活动标签页的工作流到后端。
    *   `loadWorkflow(internalId: string, projectId: string, workflowId: string): Promise<{ success: boolean; loadedData?: WorkflowStorageObject; flowToLoad?: FlowExportObject }>`: 从后端加载指定的工作流数据。
    *   `fetchAvailableWorkflows(): Promise<Array<{ id: string; name: string; description?: string }>>`: 获取当前项目下所有可用的工作流列表。
    *   `deleteWorkflow(workflowId: string): Promise<boolean>`: 从后端删除指定的工作流。
    *   `loadDefaultWorkflow(internalId: string): Promise<{ elements: Array<Node | Edge>; viewport: SharedViewport; interfaceInputs: Record<string, GroupSlotInfo>; interfaceOutputs: Record<string, GroupSlotInfo> }>`: 为指定标签页加载默认的工作流模板。
    *   `saveWorkflowAsNew(projectId: string, workflowObject: Omit<WorkflowObject, "id">): Promise<WorkflowData | null>`: 将给定的工作流对象另存为一个新的工作流文件。
*   **典型使用场景**：在需要与后端进行工作流数据交互的地方，如打开项目、保存工作流、新建工作流、加载节点组引用的子工作流等。

#### [`apps/frontend-vueflow/src/composables/workflow/useWorkflowExecution.ts`](apps/frontend-vueflow/src/composables/workflow/useWorkflowExecution.ts:1)

*   **核心功能**：处理工作流的执行逻辑。它负责在执行前运行节点定义的客户端脚本钩子 (`onWorkflowExecute`)，然后将当前工作流状态（可能已被客户端脚本修改）扁平化（处理节点组），转换为后端可执行的格式，并通过 WebSocket 发送执行请求。
*   **暴露的接口**：
    *   `executeWorkflow(): Promise<void>`: 触发当前活动标签页中工作流的执行。
*   **典型使用场景**：当用户点击“执行”按钮或通过其他方式触发工作流运行时调用。

#### [`apps/frontend-vueflow/src/composables/workflow/useWorkflowHistory.ts`](apps/frontend-vueflow/src/composables/workflow/useWorkflowHistory.ts:1)

*   **核心功能**：为每个工作流标签页实例管理一个独立的状态历史记录栈，支持撤销 (undo) 和重做 (redo) 操作。它记录工作流状态的快照，并维护当前在历史记录中的指针。
*   **暴露的接口**：
    *   `getHistoryState(internalId: string): HistoryState | undefined`: 获取指定标签页的历史状态对象。
    *   `ensureHistoryState(internalId: string): HistoryState`: 确保指定标签页的历史状态对象存在，如果不存在则创建。
    *   `recordSnapshot(internalId: string, entry: HistoryEntry, payload: WorkflowStateSnapshot): void`: 记录一个新的历史快照。
    *   `undo(internalId: string): WorkflowStateSnapshot | null`: 撤销操作，返回上一个状态的快照。
    *   `redo(internalId: string): WorkflowStateSnapshot | null`: 重做操作，返回下一个状态的快照。
    *   `markAsSaved(internalId: string): void`: 标记当前状态为已保存状态。
    *   `clearHistory(internalId: string): void`: 清除指定工作流的历史记录。
    *   `canUndo(internalId: string): ComputedRef<boolean>`: 计算属性，指示是否可以执行撤销。
    *   `canRedo(internalId: string): ComputedRef<boolean>`: 计算属性，指示是否可以执行重做。
    *   `hasUnsavedChanges(internalId: string): ComputedRef<boolean>`: 计算属性，指示当前状态是否有未保存的更改。
    *   `getHistorySummaries(internalId: string): ComputedRef<string[]>`: 计算属性，获取用于 UI 显示的历史记录摘要列表。
    *   `getCurrentIndex(internalId: string): ComputedRef<number>`: 计算属性，获取当前活动的历史记录索引。
*   **典型使用场景**：由工作流状态管理器 (`workflowStore` 或 `useWorkflowManager`) 内部调用，以在各种操作（如添加节点、移动节点、更改输入值等）后记录状态，并在用户触发撤销/重做时恢复状态。

#### [`apps/frontend-vueflow/src/composables/workflow/useWorkflowManager.ts`](apps/frontend-vueflow/src/composables/workflow/useWorkflowManager.ts:1)

*   **核心功能**：作为前端工作流状态的核心管理器（单例）。它维护所有打开的标签页的工作流状态（包括 `workflowData` 元数据、VueFlow `elements`、`viewport` 等）。提供了确保标签页状态、获取和设置元素、标记为脏状态、加载默认工作流、更新节点数据（位置、尺寸、内部数据）、管理预览目标等一系列方法。**此 Composable 是前端状态管理的核心，取代了旧的 `workflowStore.ts` 的大部分职责。**
*   **暴露的接口**：
    *   `activeTabId` (computed): 当前活动标签页的 ID。
    *   `getActiveTabState(): TabWorkflowState | undefined`: 获取当前活动标签页的完整状态。
    *   `getWorkflowData(internalId: string): WorkflowData | null`: 获取指定标签页的工作流元数据。
    *   `isWorkflowDirty(internalId: string): boolean`: 检查指定标签页是否有未保存的更改。
    *   `getElements(internalId: string): Array<VueFlowNode | VueFlowEdge>`: 获取指定标签页的 VueFlow 元素（深拷贝）。
    *   `isTabLoaded(internalId: string): boolean`: 检查指定标签页的工作流是否已加载。
    *   `ensureTabState(internalId: string, applyDefaultIfNeeded?: boolean): Promise<TabWorkflowState>`: 确保标签页状态存在，如果需要则应用默认工作流。
    *   `setElements(internalId: string, elements: Array<VueFlowNode | VueFlowEdge>): Promise<void>`: 设置指定标签页的 VueFlow 元素。
    *   `markAsDirty(internalId: string): void`: 将指定标签页标记为已修改。
    *   `removeWorkflowData(internalId: string): void`: 移除指定标签页的工作流状态。
    *   `clearWorkflowStatesForProject(projectIdToClear: string): void`: 清除指定项目下所有标签页的工作流状态。
    *   `applyStateSnapshot(internalId: string, snapshot: WorkflowStateSnapshot): boolean`: 应用一个工作流状态快照到指定标签页（不记录历史）。
    *   `setElementsAndInterface(internalId: string, elements: Array<VueFlowNode | VueFlowEdge>, inputs: Record<string, GroupSlotInfo>, outputs: Record<string, GroupSlotInfo>): Promise<void>`: 原子性地更新元素和工作流接口定义。
    *   `createNewWorkflow(internalId: string): Promise<WorkflowStateSnapshot | null>`: 在指定标签页创建一个新的空工作流。
    *   `applyDefaultWorkflowToTab(internalId: string): Promise<WorkflowStateSnapshot | null>`: 将默认工作流模板应用到指定标签页。
    *   `updateNodePositions(internalId: string, updates: { nodeId: string; position: { x: number; y: number } }[]): Promise<void>`: 更新一个或多个节点的位置。
    *   `addNode(internalId: string, nodeToAdd: VueFlowNode): Promise<void>`: 向指定标签页添加一个新节点。
    *   `updateWorkflowName(internalId: string, newName: string): Promise<void>`: 更新工作流名称。
    *   `updateWorkflowDescription(internalId: string, newDescription: string): Promise<void>`: 更新工作流描述。
    *   `updateNodeDimensions(internalId: string, nodeId: string, dimensions: { width?: number; height?: number }): Promise<void>`: 更新节点尺寸。
    *   `setPreviewTarget(internalId: string, target: { nodeId: string; slotKey: string } | null): Promise<void>`: 设置或清除预览目标。
    *   `clearPreviewTarget(internalId: string): Promise<void>`: 清除预览目标。
    *   `updateNodeInternalData(internalId: string, nodeId: string, dataPayload: Partial<VueFlowNode["data"]>): Promise<void>`: 更新节点内部数据。
*   **典型使用场景**：被项目中的许多其他 store 和 Composable 广泛依赖，作为获取和修改前端工作流状态的主要入口。例如，画布交互、节点操作、历史记录、标签页管理等都会通过它来间接或直接地操作状态。

## Composable 设计与使用原则

项目中 Composable 函数的设计遵循了一些通用原则：

1.  **单一职责**：每个 Composable 函数应专注于一个特定的功能领域或一组相关的逻辑（例如，`useClipboard` 只处理剪贴板，`useCanvasInteraction` 只处理画布交互）。
2.  **状态封装**：有状态逻辑（如 `isDragging` in `useDnd`）被封装在 Composable 内部，并通过 ref 或 reactive 暴露。
3.  **明确的接口**：Composable 函数通过返回值暴露其状态和方法，使得组件或其他 Composable 可以清晰地使用它们。
4.  **依赖注入/参数化**：一些 Composable 可能接受参数（如 `props` in `useNodeState`）或依赖其他 Composable/Store（通过在函数内部调用 `useStore()` 或其他 `useXXX()`）。
5.  **副作用管理**：对于需要设置事件监听器或执行其他副作用的 Composable（如 `useCanvasKeyboardShortcuts`），通常会使用 Vue 的生命周期钩子（`onMounted`, `onUnmounted`）来正确设置和清理这些副作用。
6.  **命名约定**：遵循 Vue 社区的普遍约定，以 `use` 开头。

通过这些原则，Composable 函数有效地帮助实现了逻辑复用和关注点分离，提升了代码的可维护性和可测试性。