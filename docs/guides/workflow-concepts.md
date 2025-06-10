# ComfyTavern 工作流概念详解

## 1. 什么是工作流？

在 ComfyTavern 中，**工作流 (Workflow)** 是定义 AI 交互逻辑、数据处理流程以及节点执行顺序的核心机制。它允许创作者通过可视化编排的方式，将一系列独立的计算单元（称为“节点”）连接起来，构建出复杂的 AI 应用程序。

**核心目的**：

- **可视化编排**：提供直观的图形界面，让创作者可以像搭建流程图一样设计 AI 应用逻辑。
- **模块化与复用**：将复杂任务分解为可管理的节点，并支持通过“节点组”复用已有的工作流。
- **驱动应用面板**：工作流是 ComfyTavern 中 AI 应用面板（迷你应用）背后的主要驱动力，负责处理用户交互、数据流转和 AI 功能调用。

### 1.1. 工作流的开发者视角：异步函数的类比

对于熟悉编程的开发者而言，可以将 ComfyTavern 的工作流理解为一个**低代码的异步函数**：

- **输入 (Inputs)**: 工作流可以定义明确的输入接口（[`interfaceInputs`](docs/guides/workflow-concepts.md:64)），就像函数的参数一样，接收外部传入的数据。
- **输出 (Outputs)**: 工作流同样可以定义输出接口（[`interfaceOutputs`](docs/guides/workflow-concepts.md:67)），在执行完毕后返回结果，如同函数的返回值。
- **异步执行 (Asynchronous Execution)**: 工作流的执行本质上是异步的。节点（特别是那些涉及 I/O 操作或复杂计算的节点，如 LLM 调用）通常异步执行，整个工作流的完成也依赖于其内部所有异步操作的完成。这与现代编程中广泛使用的 `async/await` 模式非常相似。
- **封装与复用 (Encapsulation & Reusability)**: 通过节点组 ([`core:NodeGroup`](docs/guides/workflow-concepts.md:131))，一个工作流可以被封装成一个独立的、可复用的单元，就像一个可被多次调用的函数。其他工作流可以“调用”这个节点组，向其传递输入，并获取其输出。
- **内部逻辑 (Internal Logic)**: 工作流内部的节点和边的连接，定义了数据处理和控制流程，这可以看作是函数体内的具体实现逻辑。

将工作流视为异步函数，不仅能帮助开发者利用已有的编程经验来理解其运作方式，还能更好地将其融入到更广泛的软件开发实践中，例如将其作为后端服务的一个可调用单元，或者在前端应用中与之进行异步交互。

## 2. 工作流的构成元素

一个 ComfyTavern 工作流主要由以下几个核心元素构成：

### 2.1. 节点 (Node)

节点是工作流中的基本计算单元，代表一个特定的操作或功能。

- **基本属性**:
  - `id`: 节点的唯一标识符。
  - `type`: 节点的类型标识符，它引用了一个预定义的“节点定义 (NodeDefinition)”，该定义描述了节点的行为、输入、输出和配置。例如 `core:TextPrompt`, `llm:OpenAIChat`。
  - `position`: 节点在画布上的 X, Y 坐标。
  - `width`, `height`: (可选) 节点的尺寸。
  - `displayName`: 节点在界面上显示的名称，用户可自定义。
  - `customDescription`: (可选) 用户为节点实例添加的自定义描述。
- **数据 (`data`)**: 一个对象，存储了节点的特定信息和状态，主要包括：
  - `configValues`: 节点的配置参数，这些参数通常在节点的侧边栏编辑器中设置，用于调整节点的行为（例如，LLM 节点的模型选择、温度参数等）。
  - `inputValues`: 节点输入端口的预设值。当某个输入端口没有连接边时，节点会使用这里定义的预设值。
  - `inputConnectionOrders`: (可选) 对于支持多个连接到同一输入插槽（多输入插槽）的节点，此字段记录了这些连接的顺序。
  - `customSlotDescriptions`: (可选) 用户可以为特定节点的输入或输出插槽自定义描述信息，以覆盖节点定义中默认的插槽描述。
  - `componentStates`: (可选) 用于存储节点内部 UI 组件的状态，例如文本框的高度等。
  - **NodeGroup 特定数据**:
    - `referencedWorkflowId`: 如果该节点是一个“节点组 (NodeGroup)”，此字段存储其引用的子工作流的 ID。
    - `groupInterface`: 这是被引用子工作流输入输出接口定义的一个副本。它有两个主要作用：首先，在编辑器加载节点组实例时，即使子工作流尚未完全加载，也能基于此信息快速展示节点组的输入输出插槽；其次，它使得节点组实例能够在其自身的 `data.inputs` 中直接存储这些输入接口的值（特别是对于那些支持在节点上直接编辑的输入类型，如文本框、数字输入等）。这样，用户可以直接在节点组节点上配置这些输入值，而无需为每个输入都连接外部边。
- **输入插槽 (Inputs)**: 定义节点期望接收的数据。每个输入插槽都有名称、数据类型 (如 `STRING`, `NUMBER`, `IMAGE`, `STREAM`, `CONVERTIBLE_ANY` 等)、描述以及是否必需等属性。这些定义来源于节点的 `NodeDefinition`。
- **输出插槽 (Outputs)**: 定义节点执行后产生的数据。与输入插槽类似，也包含名称、数据类型和描述等，同样来源于 `NodeDefinition`。

### 2.2. 边 (Edge)

边用于连接不同节点的输入和输出插槽，从而定义了数据在工作流中的流向。

- **属性**:
  - `id`: 边的唯一标识符。
  - `source`: 源节点的 ID。
  - `sourceHandle`: 源节点上输出插槽的 ID (或称句柄)。
  - `target`: 目标节点的 ID。
  - `targetHandle`: 目标节点上输入插槽的 ID (或称句柄)。
  - `label`: (可选) 边的标签，用于显示额外信息。
  - `type`: (可选) 边的类型，可用于自定义边的样式或行为。

### 2.3. 视口 (Viewport)

视口描述了用户在工作流编辑器中看到的画布区域的状态。

- `x`, `y`: 画布当前的平移位置。
- `zoom`: 画布当前的缩放级别。

### 2.4. 工作流接口 (Workflow Interface)

对于可以被其他工作流复用（通常通过节点组）的工作流，它可以定义自己的外部输入和输出接口。

- **`interfaceInputs`: `Record<string, GroupSlotInfo>`**
  - 定义了该工作流作为整体对外暴露的输入参数。当此工作流被一个节点组引用时，这些 `interfaceInputs` 会成为该节点组节点上的输入插槽。
  - `GroupSlotInfo` 描述了每个接口插槽的名称、数据类型、显示名称、描述等。
- **`interfaceOutputs`: `Record<string, GroupSlotInfo>`**
  - 定义了该工作流作为整体对外产生的输出结果。类似地，这些会成为引用它的节点组节点上的输出插槽。
- **`previewTarget`: `{ nodeId: string, slotKey: string } | null`**
  - (可选) 标记工作流中用于实时预览的特定输出节点及其插槽。这对于调试和快速查看中间结果非常有用。

## 3. 工作流的生命周期与数据流

工作流在其生命周期中会经历创建、编辑、存储、加载和执行等阶段，并在不同阶段以不同的数据结构表示。

### 3.1. 创建与编辑 (前端 `apps/frontend-vueflow`)

- **用户交互**: 用户在 VueFlow 提供的可视化画布上通过拖拽、连接等方式创建和修改工作流。
- **状态管理**:
  - 核心状态由 [`workflowStore.ts`](../../apps/frontend-vueflow/src/stores/workflowStore.ts:1) 统一管理，它协调了多个 Composable 函数（位于 [`apps/frontend-vueflow/src/composables/workflow/`](../../apps/frontend-vueflow/src/composables/workflow/:1) 目录下）来处理工作流的各个方面，如数据管理 ([`useWorkflowData.ts`](../../apps/frontend-vueflow/src/composables/workflow/useWorkflowData.ts:1))、视图管理 ([`useWorkflowViewManagement.ts`](../../apps/frontend-vueflow/src/composables/workflow/useWorkflowViewManagement.ts:1))、接口管理 ([`useWorkflowInterfaceManagement.ts`](../../apps/frontend-vueflow/src/composables/workflow/useWorkflowInterfaceManagement.ts:1)) 等。
  - 前端内部使用 VueFlow 库的 `Node` 和 `Edge` 对象来表示画布上的元素。
- **历史记录**:
  - 用户的每一步重要操作（如添加节点、连接边、修改参数等）都会被记录。
  - [`useWorkflowHistory.ts`](../../apps/frontend-vueflow/src/composables/workflow/useWorkflowHistory.ts:1) 和 `workflowStore.ts` 中的 `recordHistorySnapshot`, `undo`, `redo` 方法负责实现撤销和重做功能。

### 3.2. 存储

- **触发保存**: 用户通过 UI 操作保存工作流。
- **数据转换 (前端)**:
  - 调用 [`useWorkflowData.saveWorkflow()`](../../apps/frontend-vueflow/src/composables/workflow/useWorkflowData.ts:66) 函数。
  - 内部使用 [`transformVueFlowToCoreWorkflow()`](../../apps/frontend-vueflow/src/utils/workflowTransformer.ts:386) (位于 [`workflowTransformer.ts`](../../apps/frontend-vueflow/src/utils/workflowTransformer.ts:1)) 将前端 VueFlow 的数据结构（主要是节点和边的列表，以及视口信息）转换为后端友好且用于持久化存储的 `WorkflowStorageObject` 格式。
  - `WorkflowStorageObject` 包含 `WorkflowStorageNode[]` 和 `WorkflowStorageEdge[]`，这些是更精简的节点和边表示，只存储必要信息，如 ID、类型、位置、输入值、配置值、自定义描述等。
- **API 调用**: 前端将转换后的 `WorkflowStorageObject` 发送给后端。
- **后端处理**: 后端接收数据，并将其通常保存为项目内的一个 JSON 文件（例如 `projects/<projectId>/workflows/<workflowId>.json`）。全局工作流目前已不推荐直接通过 API 修改。

### 3.3. 加载

- **触发加载**: 用户打开一个已保存的工作流。
- **API 调用**: 前端请求后端加载指定的工作流。
- **后端处理**: 后端读取对应的 JSON 文件，并将 `WorkflowStorageObject` 返回给前端。
- **数据转换 (前端)**:
  - 调用 [`useWorkflowData.loadWorkflow()`](../../apps/frontend-vueflow/src/composables/workflow/useWorkflowData.ts:245) 函数。
  - 内部使用 [`transformWorkflowToVueFlow()`](../../apps/frontend-vueflow/src/utils/workflowTransformer.ts:454) 将从后端获取的 `WorkflowStorageObject` 转换回前端 VueFlow 库可以直接渲染和操作的 `Node` 和 `Edge` 对象列表。
  - 此过程包括根据节点定义重新构建节点的 `data` 对象，填充输入输出信息，并处理 NodeGroup 的接口加载（如果被引用的子工作流接口发生变化，可能需要同步）。

### 3.4. 执行

- **触发执行 (前端)**: 用户点击执行按钮。
  - 调用 [`useWorkflowExecution.executeWorkflow()`](../../apps/frontend-vueflow/src/composables/workflow/useWorkflowExecution.ts:26) 函数。
  - **客户端脚本**: 首先，会执行当前工作流中节点定义的客户端脚本钩子（如 `onWorkflowExecute`），这些脚本可能会修改节点的输入数据。
  - **扁平化**: 调用 [`flattenWorkflow()`](../../apps/frontend-vueflow/src/utils/workflowFlattener.ts:1) 来处理节点组。如果工作流中包含节点组，此步骤会递归地将节点组展开，将其内部的节点和边合并到主工作流中，形成一个扁平化的、可直接执行的节点和边列表。
  - **数据转换**:
    1.  使用 `transformVueFlowToCoreWorkflow()` 将（可能已扁平化的）前端 VueFlow 数据转换为核心的 `WorkflowStorageNode[]` 和 `WorkflowStorageEdge[]` 格式。
    2.  接着，使用 [`transformVueFlowToExecutionPayload()`](../../apps/frontend-vueflow/src/utils/workflowTransformer.ts:683) 将上述核心数据转换为后端执行引擎所需的 `WorkflowExecutionPayload` 格式。此格式更精简，只包含执行必需的节点 ID、类型、输入、配置和边连接信息。
  - **接口映射**: 构建 `outputInterfaceMappings` 对象，它告诉后端如何将扁平化后工作流内部节点的输出映射到原始工作流（或顶层工作流）的 `interfaceOutputs`。
  - **WebSocket 通信**: 将 `WorkflowExecutionPayload`（包含节点、边、接口输入、输出接口映射和元数据）通过 WebSocket 以 `PROMPT_REQUEST` 消息类型发送给后端。
- **执行处理 (后端 [`apps/backend/src/ExecutionEngine.ts`](../../apps/backend/src/ExecutionEngine.ts:1))**:
  - `ExecutionEngine` 实例被创建来处理该执行请求。
  - **拓扑排序**: 对接收到的节点和边进行拓扑排序，以确定无环的节点执行顺序。
  - **节点逐个执行**:
    1.  **准备输入**: 对于每个待执行节点，引擎调用 `prepareNodeInputs()` 方法。此方法会收集所有连接到该节点输入插槽的上游节点的输出结果，并结合节点自身预设的 `inputValues` 和节点定义中的默认值，来准备最终的输入数据对象。
    2.  **调用执行逻辑**: 引擎调用该节点类型定义（`NodeDefinition`）中的 `execute()` 方法，并将准备好的输入数据和上下文信息（如 `promptId`）传递给它。
    3.  **处理输出**:
        - **普通输出**: 如果节点的 `execute()` 方法返回一个 Promise 解析为普通对象，则该对象的键值对被视为节点的输出。
        - **流式输出**: 如果节点定义了流式输出（`dataFlowType: DataFlowType.STREAM`），其 `execute()` 方法会返回一个异步生成器 (AsyncGenerator)。引擎会特殊处理这种输出，允许数据块 (chunks) 被逐步产生并通过 WebSocket 以 `NODE_YIELD` 消息发送给前端，直到生成器完成。最终的批处理结果（如果有）也会在流结束后确定。
  - **状态广播**: 在节点执行的各个阶段（开始执行、产生数据块、完成、出错），引擎都会通过 WebSocket 向前端广播相应的状态消息（如 `NODE_EXECUTING`, `NODE_YIELD`, `NODE_COMPLETE`, `NODE_ERROR`）。
  - **接口输出处理**: 对于工作流的 `interfaceOutputs`，引擎会根据前端提供的 `outputInterfaceMappings`，将内部节点的实际输出（无论是普通值还是流）正确地路由和广播出去。

## 4. 关键特性与机制

- **节点组 (NodeGroup / `core:NodeGroup`)**:
  - 允许将一个完整的工作流封装成一个单一的节点，以便在其他工作流中复用。
  - 通过 `referencedWorkflowId` 属性引用目标子工作流。
  - 节点组实例会动态加载并显示其引用的子工作流所定义的 `interfaceInputs` 和 `interfaceOutputs` 作为自身的输入输出插槽。
  - `groupInterface` 属性是子工作流接口定义的副本，它允许节点组实例：1) 在加载时快速显示其应有的输入输出插槽；2) 允许用户直接在节点组实例的 `data.inputs` 中为这些接口输入（如果它们支持直接编辑，如文本或数字输入）设置和存储值。
  - 前端使用 [`useGroupIOSlots.ts`](../../apps/frontend-vueflow/src/composables/group/useGroupIOSlots.ts:1) 和相关的 Composable 函数来管理节点组的接口显示和用户交互。
  - 当被引用的子工作流（模板）的接口发生变化时，可以通过 [`workflowStore.synchronizeGroupNodeInterfaceAndValues()`](../../apps/frontend-vueflow/src/stores/workflowStore.ts:472) 方法来同步更新所有使用该模板的 NodeGroup 实例的接口定义和输入值，确保一致性。
- **节点绕过 (Bypass)**:
  - 节点可以被标记为“绕过”。当一个节点被绕过时，它的 `execute()` 方法不会被调用。
  - 数据如何通过被绕过的节点取决于其节点定义中的 `bypassBehavior`：
    - `mute`: 所有输出都为 `undefined` 或类型的空值。
    - `passThrough`: 可以配置将某些输入直接传递到对应的输出。
    - 默认行为：尝试将类型兼容的第一个输入传递给第一个类型兼容的输出，以此类推。
- **流式处理 (Streaming)**:
  - 某些节点（如大型语言模型节点）可以逐步产生输出，而不是一次性返回所有结果。
  - 这些节点的输出插槽 `dataFlowType` 会被标记为 `DataFlowType.STREAM`。
  - 后端 `ExecutionEngine` 会迭代异步生成器，并将每个产生的数据块通过 `NODE_YIELD` WebSocket 消息发送给前端，前端可以实时显示这些数据。
- **数据转换 (`apps/frontend-vueflow/src/utils/workflowTransformer.ts`)**:
  - 这是连接前端视图、后端存储和执行引擎之间数据格式差异的桥梁。
  - 提供了如 `transformVueFlowToCoreWorkflow` (VueFlow -> 存储)、`transformWorkflowToVueFlow` (存储 -> VueFlow)、`transformVueFlowToExecutionPayload` (VueFlow/存储 -> 执行载荷) 等关键转换函数。
- **工作流片段 (Workflow Fragment)**:
  - 允许用户选择工作流的一部分（若干节点和它们之间的边），将其序列化为 JSON 字符串（通常用于复制到剪贴板）。
  - 也支持从这样的 JSON 字符串反序列化，将片段粘贴到当前或其他工作流中。
  - 序列化时会使用简化的 `WorkflowStorageNode` 和 `WorkflowStorageEdge` 格式。
- **默认工作流**:
  - 项目提供了一个静态的默认工作流定义 ([`DefaultWorkflow.json`](../../apps/frontend-vueflow/src/data/DefaultWorkflow.json:1))，作为新标签页或空状态下的基础画布内容。

## 5. 相关核心类型定义 (Zod Schemas in `@comfytavern/types`)

ComfyTavern 使用 Zod 来定义和验证其核心数据结构的 Schema。这些类型定义位于 `packages/types/src/` 目录下。

- **工作流结构**:
  - [`WorkflowObjectSchema`](../../packages/types/src/workflow.ts:164) ([`workflow.ts`](../../packages/types/src/workflow.ts:1)): 定义了工作流的整体结构，包括元数据、节点列表、边列表、视口和接口定义。
  - [`WorkflowNodeSchema`](../../packages/types/src/workflow.ts:74) ([`workflow.ts`](../../packages/types/src/workflow.ts:1)): 定义了单个节点的结构。
  - [`WorkflowEdgeSchema`](../../packages/types/src/workflow.ts:129) ([`workflow.ts`](../../packages/types/src/workflow.ts:1)): 定义了边的结构。
- **存储格式**:
  - `WorkflowStorageObject` (Interface in [`workflow.ts`](../../packages/types/src/workflow.ts:217)): 用于持久化存储的完整工作流结构。
  - `WorkflowStorageNode` (Interface in [`workflow.ts`](../../packages/types/src/workflow.ts:230)): 持久化存储的节点结构。
  - `WorkflowStorageEdge` (Interface in [`workflow.ts`](../../packages/types/src/workflow.ts:247)): 持久化存储的边结构。
- **执行相关**:
  - [`ExecutionNodeSchema`](../../packages/types/src/schemas.ts:79) ([`schemas.ts`](../../packages/types/src/schemas.ts:1)): 后端执行引擎使用的简化节点结构。
  - [`ExecutionEdgeSchema`](../../packages/types/src/schemas.ts:92) ([`schemas.ts`](../../packages/types/src/schemas.ts:1)): 后端执行引擎使用的简化边结构。
  - [`WorkflowExecutionPayloadSchema`](../../packages/types/src/schemas.ts:104) ([`schemas.ts`](../../packages/types/src/schemas.ts:1)): 发送给后端以启动工作流执行的完整载荷定义。
- **节点组与接口**:
  - [`GroupSlotInfoSchema`](../../packages/types/src/node.ts:280) ([`node.ts`](../../packages/types/src/node.ts:1)): 定义了节点组或工作流接口中单个插槽的详细信息。
  - [`GroupInterfaceInfoSchema`](../../packages/types/src/schemas.ts:50) ([`schemas.ts`](../../packages/types/src/schemas.ts:1)): 定义了节点组的完整接口信息（包含输入和输出插槽记录）。
  - [`NodeGroupDataSchema`](../../packages/types/src/workflow.ts:44) ([`workflow.ts`](../../packages/types/src/workflow.ts:1)): NodeGroup 类型节点的特定 `data` 字段结构。

这份文档应该能帮助理解 ComfyTavern 中工作流的核心概念和运作方式。
