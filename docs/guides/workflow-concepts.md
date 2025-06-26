# ComfyTavern 工作流概念详解

## 1. 什么是工作流？

在 ComfyTavern 中，**工作流 (Workflow)** 是定义 AI 交互逻辑、数据处理流程以及节点执行顺序的核心机制。它允许创作者通过可视化编排的方式，将一系列独立的计算单元（称为"节点"）连接起来，构建出复杂的 AI 应用程序。

**核心目的**：

- **可视化编排**：提供直观的图形界面，让创作者可以像搭建流程图一样设计 AI 应用逻辑。
- **模块化与复用**：将复杂任务分解为可管理的节点，并支持通过"节点组"复用已有的工作流。
- **驱动应用面板**：工作流是 ComfyTavern 中 AI 应用面板（迷你应用）背后的主要驱动力，负责处理用户交互、数据流转和 AI 功能调用。
- **承载 Agent 核心逻辑**: 工作流现在也是 Agent 核心逻辑（包括自主审议、技能执行、学习反思）的关键承载机制，是 Agent 实例行为的直接执行者。

### 1.1. 工作流的开发者视角：异步函数的类比

对于熟悉编程的开发者而言，可以将 ComfyTavern 的工作流理解为一个**低代码的异步函数**：

- **输入 (Inputs)**: 工作流可以定义明确的输入接口（[`interfaceInputs`](docs/guides/workflow-concepts.md:64)），就像函数的参数一样，接收外部传入的数据。
- **输出 (Outputs)**: 工作流同样可以定义输出接口（[`interfaceOutputs`](docs/guides/workflow-concepts.md:67)），在执行完毕后返回结果，如同函数的返回值。
- **异步执行 (Asynchronous Execution)**: 工作流的执行本质上是异步的。节点（特别是那些涉及 I/O 操作或复杂计算的节点，如 LLM 调用）通常异步执行，整个工作流的完成也依赖于其内部所有异步操作的完成。这与现代编程中广泛使用的 `async/await` 模式非常相似。
- **封装与复用 (Encapsulation & Reusability)**: 通过节点组 ([`core:NodeGroup`](docs/guides/workflow-concepts.md:131))，一个工作流可以被封装成一个独立的、可复用的单元，就像一个可被多次调用的函数。其他工作流可以"调用"这个节点组，向其传递输入，并获取其输出。
- **内部逻辑 (Internal Logic)**: 工作流内部的节点和边的连接，定义了数据处理和控制流程，这可以看作是函数体内的具体实现逻辑。

将工作流视为异步函数，不仅能帮助开发者利用已有的编程经验来理解其运作方式，还能更好地将其融入到更广泛的软件开发实践中。例如，可以将其作为后端服务的一个可调用单元，或者在前端应用中与之进行异步交互。在 Agent 架构中，这种类比尤为贴切：Agent 的核心审议循环可以被视为一个由 `AgentRuntime` 持续调用的、高度复杂的"主异步函数"，而 Agent 的技能工作流则类似于这个主函数内部按需调用的、封装了特定功能的"子异步函数"。

## 2. 工作流的构成元素

一个 ComfyTavern 工作流主要由以下几个核心元素构成：

### 2.1. 节点 (Node)

节点是工作流中的基本计算单元，代表一个特定的操作或功能。

- **基本属性**:
  - `id`: 节点的唯一标识符。
  - `type`: 节点的类型标识符，它引用了一个预定义的"节点定义 (NodeDefinition)"，该定义描述了节点的行为、输入、输出和配置。例如 `core:TextPrompt`, `llm:OpenAIChat`。
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
    - `referencedWorkflowId`: 如果该节点是一个"节点组 (NodeGroup)"，此字段存储其引用的子工作流的 ID。
    - `groupInterface`: 这是被引用子工作流输入输出接口定义的一个副本。它有两个主要作用：首先，在编辑器加载节点组实例时，即使子工作流尚未完全加载，也能基于此信息快速展示节点组的输入输出插槽；其次，它使得节点组实例能够在其自身的 `data.inputs` 中直接存储这些输入接口的值（特别是对于那些支持在节点上直接编辑的输入类型，如文本框、数字输入等）。这样，用户可以直接在节点组节点上配置这些输入值，而无需为每个输入都连接外部边。
- **输入插槽 (Inputs)**: 定义节点期望接收的数据。每个输入插槽都有名称、数据类型 (`dataFlowType`)、是否为流 (`isStream`)、描述以及是否必需等属性。这些定义来源于节点的 `NodeDefinition`。
- **输出插槽 (Outputs)**: 定义节点执行后产生的数据。与输入插槽类似，也包含名称、数据类型、是否为流和描述等，同样来源于 `NodeDefinition`。

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

### 2.5. 工作流在 Agent 系统中的核心应用

随着 Agent 系统的引入，工作流在 ComfyTavern 中扮演了更加核心和多样化的角色，成为实现 Agent 自主行为的关键组件。Agent 的设计与工作流紧密集成，主要体现在以下几个方面：

#### 2.5.1. 核心审议工作流 (Core Deliberation Workflow)

- **定义与角色**: 这是 Agent 的"大脑"或中央处理单元。它负责接收来自环境的感知信息（如世界状态变化、其他 Agent 的事件）、处理 Agent 自身的内部状态（PrivateState）、结合当前的目标和动机，进行复杂的推理和规划，并最终输出 Agent 的下一步行动决策。
- **驱动方式**: 该工作流由 Agent 的运行时实例管理器 (`AgentRuntime`) 持续驱动。驱动模式通常是混合的：响应外部事件或内部状态变化（事件驱动），并辅以一个可配置的较低频率的周期性执行（定时驱动），以确保 Agent 即使在没有外部刺激时也能进行状态评估和目标推进。
- **典型输入**: 其输入通常非常丰富，整合了 Agent 决策所需的各种上下文信息，例如：
  - 当前场景的共享**世界状态 (`WorldState`)**。
  - Agent 自身的**私有状态 (`PrivateState`)**，包含其短期记忆、情绪、任务进度等。
  - Agent 当前激活的**目标与动机 (`ActiveGoals/Motivations`)**。
  - 从事件总线接收到的**感知事件 (`IncomingEvents`)**。
  - Agent Profile 中声明的**可用能力 (`AvailableCapabilities`)**，包括技能工作流和原子工具列表。
  - 从知识库检索到的相关信息。
  (更详细的输入上下文可参考 [`DesignDocs/architecture/agent_architecture_v3_consolidated.md`](../../DesignDocs/architecture/agent_architecture_v3_consolidated.md:94) 中的 2.1.1 节)
- **典型输出**: Agent 的决策指令，这通常表现为对 `AgentRuntime` 的一组请求，例如：
  - 需要调用的**技能工作流 ID** 及其输入参数。
  - 需要执行的**原子工具**及其参数。
  - 需要向事件总线发布的**事件内容**。
  - 需要更新的**私有状态 (`PrivateState`)** 内容。
  - 一个明确的"进入反思/学习阶段"的信号。
- **与 Agent Profile 的关系**: 每个 Agent Profile (`agent_profile.json`) 都会通过 `core_deliberation_workflow_id` 字段明确指定其核心审议工作流的定义文件。

#### 2.5.2. 技能工作流 (Skill Workflows)

- **定义与角色**: 技能工作流封装了 Agent 可执行的多步骤、可复用的复杂操作序列。它们是 Agent 将决策转化为具体行动、与环境进行复杂交互或执行特定任务的主要方式。
- **调用方式**: 由 Agent 的核心审议工作流在其决策逻辑中，根据当前目标和规划决定调用哪个技能工作流，并为其提供必要的输入参数。
- **示例**: 例如，一个 NPC Agent 可能拥有"与玩家对话"、"提供任务"、"进行交易"、"在区域内巡逻"等技能，每个技能都由一个专门的工作流实现。
- **与 Agent Profile 的关系**: Agent Profile 的 `skill_workflow_ids_inventory` 字段会列出该 Agent 类型所掌握的所有技能工作流的 ID。

#### 2.5.3. 反思/学习工作流 (Reflection/Learning Workflow)

- **定义与角色**: 这是一种特殊类型的技能工作流，专用于 Agent 的学习与反思机制。当 Agent 完成一个重要任务、经历一次显著成功或失败，或被外部请求进行反思时，会调用此工作流。
- **核心逻辑**: 反思工作流通常会分析 Agent 近期的行动序列、结果、相关上下文信息，试图从中提取经验教训、评估策略有效性、识别新知识或模式，并可能将这些反思成果（如新的最佳实践、失败原因分析、对目标的修正建议）结构化地贡献回知识库。

#### 2.5.4. (附带提及) 场景生命周期工作流

- 虽然不直接属于 Agent 自身的能力，但场景 (`Scene`) 也可以在其生命周期的特定阶段（如 `on_scene_start`, `on_scene_end`）调用工作流。这些场景级工作流可以用于初始化 Agent 的运行环境、设置全局事件、或执行不适合由单个 Agent 完成的宏观编排逻辑，从而与场景内的 Agent 行为形成协同。

理解工作流在 Agent 系统中的这些多样化应用，对于设计和实现强大、灵活的自主 Agent至关重要。

## 3. 核心架构概念

为了完整地理解工作流的行为，有必要阐明系统中的两项关键架构设计：**中心化接口与幻影节点**，以及**节点组的引用与展平机制**。

### 3.1. 中心化接口与幻影节点 (Centralized Interface & Phantom Nodes)

本系统借鉴了现代节点编辑器（如 Blender 几何节点）的设计思想，将工作流的"接口"与其在画布上的"视觉表示"进行了解耦。

-   **中心化接口定义**:
    工作流的输入 (`interfaceInputs`) 和输出 (`interfaceOutputs`) 是定义在工作流对象本身的核心属性。它们是工作流与外部世界（无论是用户界面、API 调用，还是其他工作流）交互的唯一、正式的契约，包含了接口的键、类型、默认值等所有元数据。

-   **画布上的"幻影"节点**:
    您在画布上看到的 `core:GroupInput` 和 `core:GroupOutput` 节点，其本质是上述中心化接口的**视觉代理**或"幻影"。它们本身**不存储**任何接口定义。其唯一的作用就是提供视觉上的连接点（Handles），让用户可以将工作流的内部逻辑节点连接到这些预定义的、中心化的接口上。节点上的 `Handle ID` 与中心化接口定义中的 `key` 一一对应。

这个设计使得接口的管理（增、删、改、排序）可以集中在侧边栏等 UI 中进行，而画布上的节点仅作为纯粹的连接工具，并且使插槽同步，保持了画布的整洁和逻辑的清晰。

### 3.2. 节点组的引用与展平 (Node Group Referencing & Flattening)

-   **节点组作为引用**:
    当您在一个工作流中使用 `core:NodeGroup` 节点时，您实际上只是创建了一个对另一个独立工作流的**引用**。系统中的所有工作流，无论其用途是作为顶级图还是被嵌套的组，都遵循完全一致的数据结构。

-   **执行前展平**:
    在工作流执行之前，执行引擎会进行一个关键的"展平"（Flattening）操作。此过程会递归地遍历整个节点图，将每一个 `core:NodeGroup` 节点替换为它所引用的那个工作流内部的实际节点和边。

这个机制确保了无论工作流的嵌套有多深，执行引擎最终面对的永远是一个不包含任何 `core:NodeGroup` 的、完全平坦的、可直接执行的节点图。这极大地简化了执行逻辑，无需为"组"的概念设计一套额外的、复杂的执行规则。

## 4. 工作流的生命周期与数据流

工作流在其生命周期中会经历创建、编辑、存储、加载和执行等阶段，并在不同阶段以不同的数据结构表示。

### 4.1. 创建与编辑 (前端 `apps/frontend-vueflow`)

- **用户交互**: 用户在 VueFlow 提供的可视化画布上通过拖拽、连接等方式创建和修改工作流。
- **状态管理**:
  - 核心状态由 [`workflowStore.ts`](../../apps/frontend-vueflow/src/stores/workflowStore.ts:1) 统一管理，它协调了多个 Composable 函数（位于 [`apps/frontend-vueflow/src/composables/workflow/`](../../apps/frontend-vueflow/src/composables/workflow/:1) 目录下）来处理工作流的各个方面，如数据管理 ([`useWorkflowData.ts`](../../apps/frontend-vueflow/src/composables/workflow/useWorkflowData.ts:1))、视图管理 ([`useWorkflowViewManagement.ts`](../../apps/frontend-vueflow/src/composables/workflow/useWorkflowViewManagement.ts:1))、接口管理 ([`useWorkflowInterfaceManagement.ts`](../../apps/frontend-vueflow/src/composables/workflow/useWorkflowInterfaceManagement.ts:1)) 等。
  - 前端内部使用 VueFlow 库的 `Node` 和 `Edge` 对象来表示画布上的元素。
- **历史记录**:
  - 用户的每一步重要操作（如添加节点、连接边、修改参数等）都会被记录。
  - [`useWorkflowHistory.ts`](../../apps/frontend-vueflow/src/composables/workflow/useWorkflowHistory.ts:1) 和 `workflowStore.ts` 中的 `recordHistorySnapshot`, `undo`, `redo` 方法负责实现撤销和重做功能。

### 4.2. 存储

- **触发保存**: 用户通过 UI 操作保存工作流。
- **数据转换 (前端)**:
  - 调用 [`useWorkflowData.saveWorkflow()`](../../apps/frontend-vueflow/src/composables/workflow/useWorkflowData.ts:66) 函数。
  - 内部使用 [`transformVueFlowToCoreWorkflow()`](../../apps/frontend-vueflow/src/utils/workflowTransformer.ts:386) (位于 [`workflowTransformer.ts`](../../apps/frontend-vueflow/src/utils/workflowTransformer.ts:1)) 将前端 VueFlow 的数据结构（主要是节点和边的列表，以及视口信息）转换为后端友好且用于持久化存储的 `WorkflowStorageObject` 格式。
  - `WorkflowStorageObject` 包含 `WorkflowStorageNode[]` 和 `WorkflowStorageEdge[]`，这些是更精简的节点和边表示，只存储必要信息，如 ID、类型、位置、输入值、配置值、自定义描述等。
- **API 调用**: 前端将转换后的 `WorkflowStorageObject` 发送给后端。
- **后端处理**: 后端接收数据，并将其通常保存为项目内的一个 JSON 文件（例如 `projects/<projectId>/workflows/<workflowId>.json`）。全局工作流目前已不推荐直接通过 API 修改。

### 4.3. 加载

- **触发加载**: 用户打开一个已保存的工作流。
- **API 调用**: 前端请求后端加载指定的工作流。
- **后端处理**: 后端读取对应的 JSON 文件，并将 `WorkflowStorageObject` 返回给前端。
- **数据转换 (前端)**:
  - 调用 [`useWorkflowData.loadWorkflow()`](../../apps/frontend-vueflow/src/composables/workflow/useWorkflowData.ts:245) 函数。
  - 内部使用 [`transformWorkflowToVueFlow()`](../../apps/frontend-vueflow/src/utils/workflowTransformer.ts:454) 将从后端获取的 `WorkflowStorageObject` 转换回前端 VueFlow 库可以直接渲染和操作的 `Node` 和 `Edge` 对象列表。
  - 此过程包括根据节点定义重新构建节点的 `data` 对象，填充输入输出信息，并处理 NodeGroup 的接口加载（如果被引用的子工作流接口发生变化，可能需要同步）。

### 4.4. 执行

- **触发执行 (前端)**: 用户点击执行按钮。
  - 调用 [`useWorkflowExecution.executeWorkflow()`](../../apps/frontend-vueflow/src/composables/workflow/useWorkflowExecution.ts:26) 函数。
  - **客户端脚本**: 首先，会执行当前工作流中节点定义的客户端脚本钩子（如 `onWorkflowExecute`），这些脚本可能会修改节点的输入数据。
  - **扁平化**: 调用 [`flattenWorkflow()`](../../apps/frontend-vueflow/src/utils/workflowFlattener.ts:1) 来处理节点组。如果工作流中包含节点组，此步骤会递归地将节点组展开，将其内部的节点和边合并到主工作流中，形成一个扁平化的、可直接执行的节点和边列表。
  - **数据转换**:
    1.  使用 `transformVueFlowToCoreWorkflow()` 将（可能已扁平化的）前端 VueFlow 数据转换为核心的 `WorkflowStorageNode[]` 和 `WorkflowStorageEdge[]` 格式。
    2.  接着，使用 [`transformVueFlowToExecutionPayload()`](../../apps/frontend-vueflow/src/utils/workflowTransformer.ts:683) 将上述核心数据转换为后端执行引擎所需的 `WorkflowExecutionPayload` 格式。此格式更精简，只包含执行必需的节点 ID、类型、输入、配置和边连接信息。
  - **接口映射**: 构建 `outputInterfaceMappings` 对象，它告诉后端如何将扁平化后工作流内部节点的输出映射到原始工作流（或顶层工作流）的 `interfaceOutputs`。
  - **WebSocket 通信**: 将 `WorkflowExecutionPayload`（包含节点、边、接口输入、输出接口映射和元数据）通过 WebSocket 以 `PROMPT_REQUEST` 消息类型发送给后端。

- **由 AgentRuntime 触发执行 (后端)**:
  - `AgentRuntime` 是驱动 Agent 相关工作流（特别是核心审议工作流和技能工作流）的主要调用者。
  - 当 `AgentRuntime` 需要执行一个工作流时（例如，驱动一次审议循环，或执行一个 Agent 决策调用的技能），它会：
    1. 准备特定于 Agent 当前状态和环境的上下文作为工作流的输入。这可能包括 Agent 的 `PrivateState` 快照、从 `WorldStateService` 获取的相关世界信息、当前激活的目标、触发审议的事件等。
    2. 将工作流定义（或其 ID）以及准备好的输入上下文，提交给平台统一的 `ExecutionEngine`。
  - `ExecutionEngine` 负责实际执行工作流的 DAG 逻辑，并将执行结果（或错误）返回给 `AgentRuntime`。
  - `AgentRuntime` 再根据工作流的执行结果进行后续处理，例如更新 Agent 的 `PrivateState`、向事件总线发布事件，或将审议结果作为下一次审议的输入等。
  - 核心审议工作流可能会被 `AgentRuntime` 以事件驱动或周期性的方式持续执行。技能工作流则通常在审议核心做出决策后按需调用。

- **执行处理 (后端 [`apps/backend/src/ExecutionEngine.ts`](../../apps/backend/src/ExecutionEngine.ts:1))**:
  - `ExecutionEngine` 实例被创建来处理该执行请求。
  - **拓扑排序**: 对接收到的节点和边进行拓扑排序，以确定无环的节点执行顺序。
  - **节点逐个执行**:
    1.  **准备输入**: 对于每个待执行节点，引擎调用 `prepareNodeInputs()` 方法。此方法会收集所有连接到该节点输入插槽的上游节点的输出结果，并结合节点自身预设的 `inputValues` 和节点定义中的默认值，来准备最终的输入数据对象。
    2.  **调用执行逻辑**: 引擎调用该节点类型定义（`NodeDefinition`）中的 `execute()` 方法，并将准备好的输入数据和上下文信息（如 `promptId`）传递给它。
    3.  **处理输出**:
        - **普通输出**: 如果节点的 `execute()` 方法返回一个 Promise 解析为普通对象，则该对象的键值对被视为节点的输出。
        - **流式输出**: 如果节点定义了流式输出（`isStream: true`），其 `execute()` 方法会返回一个异步生成器 (AsyncGenerator)。引擎会特殊处理这种输出，允许数据块 (chunks) 被逐步产生并通过 WebSocket 以 `NODE_YIELD` 消息发送给前端，直到生成器完成。最终的批处理结果（如果有）也会在流结束后确定。
  - **状态广播**: 在节点执行的各个阶段（开始执行、产生数据块、完成、出错），引擎都会通过 WebSocket 向前端广播相应的状态消息（如 `NODE_EXECUTING`, `NODE_YIELD`, `NODE_COMPLETE`, `NODE_ERROR`）。
  - **接口输出处理**: 对于工作流的 `interfaceOutputs`，引擎会根据前端提供的 `outputInterfaceMappings`，将内部节点的实际输出（无论是普通值还是流）正确地路由和广播出去。

## 5. 关键特性与机制

- **节点组 (NodeGroup / `core:NodeGroup`)**:
  - 允许将一个完整的工作流封装成一个单一的节点，以便在其他工作流中复用。
  - 通过 `referencedWorkflowId` 属性引用目标子工作流。
  - 节点组实例会动态加载并显示其引用的子工作流所定义的 `interfaceInputs` 和 `interfaceOutputs` 作为自身的输入输出插槽。
  - `groupInterface` 属性是子工作流接口定义的副本，它允许节点组实例：1) 在加载时快速显示其应有的输入输出插槽；2) 允许用户直接在节点组实例的 `data.inputs` 中为这些接口输入（如果它们支持直接编辑，如文本或数字输入）设置和存储值。
  - 前端使用 [`useGroupIOSlots.ts`](../../apps/frontend-vueflow/src/composables/group/useGroupIOSlots.ts:1) 和相关的 Composable 函数来管理节点组的接口显示和用户交互。
  - 当被引用的子工作流（模板）的接口发生变化时，可以通过 [`workflowStore.synchronizeGroupNodeInterfaceAndValues()`](../../apps/frontend-vueflow/src/stores/workflowStore.ts:472) 方法来同步更新所有使用该模板的 NodeGroup 实例的接口定义和输入值，确保一致性。
  - 在 Agent 架构中，Agent 的复杂技能（Skill Workflows）也非常适合通过节点组进行封装。这不仅提高了技能的模块化程度，也使得这些技能更容易在不同的 Agent Profile 之间共享和复用。例如，一个通用的"文本摘要技能"或"图像生成技能"可以被封装为节点组，供多个不同类型的 Agent 调用。
- **节点绕过 (Bypass)**:
  - 节点可以被标记为"绕过"。当一个节点被绕过时，它的 `execute()` 方法不会被调用。
  - 数据如何通过被绕过的节点取决于其节点定义中的 `bypassBehavior`：
    - `mute`: 所有输出都为 `undefined` 或类型的空值。
    - `passThrough`: 可以配置将某些输入直接传递到对应的输出。
    - 默认行为：尝试将类型兼容的第一个输入传递给第一个类型兼容的输出，以此类推。
- **流式处理 (Streaming)**:
  - 某些节点（如大型语言模型节点）可以逐步产生输出，而不是一次性返回所有结果。
  - 这些节点的输出插槽 `isStream` 属性会被标记为 `true`。
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

## 6. 相关核心类型定义 (Zod Schemas in `@comfytavern/types`)

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
