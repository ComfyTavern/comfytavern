# 统一改造计划：精简工作流存储与执行载荷 (v3.1 - 聚焦存取, 默认值策略明确)

**1. 目标**

*   **精简存储**: 大幅减少工作流 `.json` 文件的体积和冗余，只存储节点实例状态（位置、大小等视觉信息）和用户显式覆盖的输入/配置值。Schema 定义和默认值依赖于节点定义本身及类型规则。
*   **纯净执行 (准备)**: 准备好生成发送给后端执行引擎的纯逻辑 API 载荷（通过 WebSocket 或 HTTP），只包含执行所需的纯逻辑信息（节点类型、ID、输入值/连接、配置值），完全去除视觉信息。（执行引擎的完全适配暂缓）
*   **健壮 ID**: 使用短唯一 ID (**Nano ID, 10 字符**) 作为节点和边的标识符，确保唯一性、解耦和简洁性。
*   **关注点分离**: 清晰地分离前端 UI 展示、工作流文件存储和后端逻辑执行的数据需求。
*   **提升健壮性与可维护性**: 减少数据冗余带来的不一致风险，简化后端处理逻辑，明确 API 契约。

**2. 核心变更**

*   **A. 工作流文件结构 (`*.json`) - 存储格式 (WorkflowStorageObject)**
    *   **`nodes` 数组 (`WorkflowStorageNode`)**: 每个节点对象将包含：
        *   `id: string` (必需, **Nano ID, 10 字符**)
        *   `type: string` (必需)
        *   `position: { x: number, y: number }` (必需，用于画布恢复)
        *   `size?: { width: number, height: number }` (可选，用于画布恢复)
        *   `customLabel?: string` (可选，用户自定义的节点标题，覆盖默认标题)
        *   `customDescription?: string` (可选，用户自定义的节点描述，覆盖默认描述)
        *   `customSlotDescriptions?: { inputs?: Record<string, string>, outputs?: Record<string, string> }` (可选，存储用户自定义的输入/输出插槽描述)
        *   `inputValues?: Record<string, any>` (可选): **只存储**那些值**不等于**其对应**有效默认值** (见 C 部分) 的输入值。如果一个输入的值等于其有效默认值，则**不**在此对象中存储。
        *   `configValues?: Record<string, any>` (可选): 存储节点级别的配置值（如果节点定义了 `configSchema`）。
        *   **移除**: 不再存储 `label` (旧的 UI 显示字段), `data.inputs`, `data.outputs`, `data.configSchema` 等完整的 Schema 定义。
    *   **`edges` 数组 (`WorkflowStorageEdge`)**: 每个边对象只包含逻辑连接信息：
        *   `id: string` (必需, **Nano ID, 10 字符**)
        *   `source: string` (必需，源节点 ID - Nano ID)
        *   `target: string` (必需，目标节点 ID - Nano ID)
        *   `sourceHandle: string` (必需，源输出 key)
        *   `targetHandle: string` (必需，目标输入 key)
        *   **移除**: 不再存储 `type`, `markerEnd`, `data.sourceType`, `data.targetType` 等视觉或冗余信息。
    *   **顶层字段**: 保留 `name`, `viewport` 等元数据。
    *   **移除**: 不再存储顶层的 `description` (节点描述由 `NodeDefinition` 或 `customDescription` 提供)。

*   **B. 纯逻辑执行类型 (定义于 `packages/types`)**
    *   **`ExecutionNode`**:
        ```typescript
        interface ExecutionNode {
          id: string; // Nano ID (10 chars)
          type: string;
          // 注意：inputValues 只包含不等于有效默认值的字面量输入
          inputValues?: Record<string, any>;
          configValues?: Record<string, any>; // 节点配置值
        }
        ```
    *   **`ExecutionEdge`**:
        ```typescript
        interface ExecutionEdge {
          id: string; // Nano ID (10 chars)
          source: string;       // Source Node ID (Nano ID)
          target: string;       // Target Node ID (Nano ID)
          sourceHandle: string; // Source Output Key
          targetHandle: string; // Target Input Key
        }
        ```
    *   **`WorkflowExecutionPayload`**:
        ```typescript
        interface WorkflowExecutionPayload {
          workflowId?: string; // Optional ID for the workflow instance
          nodes: ExecutionNode[];
          edges: ExecutionEdge[];
        }
        ```

*   **C. 节点定义 (`NodeDefinition` in `packages/types`)**
    *   保持作为 Schema 的**唯一权威来源**。
    *   `InputDefinition` 中的 `config.default` 字段（如果存在）用于显式定义默认值，它是**可选**的。同时，`InputDefinition` 统一使用 `config.suggestions` 字段提供可选列表（用于 `COMBO` 或带建议的输入）。
    *   **引入有效默认值 (Effective Default Value) 概念**:
        *   获取某输入的有效默认值时，逻辑如下：
            1.  检查 `InputDefinition.config` 是否显式定义了 `default` 属性，如果定义了，则使用它。
            2.  如果未定义 `config.default`，则根据输入的 `type` 应用**预定义的隐式默认值**：
                *   `STRING`: `''`
                *   `INT`: `0`
                *   `FLOAT`: `0.0`
                *   `BOOLEAN`: `false`
                *   `CODE`: `''`
                *   `COMBO`: `config.suggestions` 列表中的第一个值，若列表为空或不存在则为 `''`。 (需要访问 `InputDefinition.config` 的 `suggestions` 字段)
                *   `ANY` (`WILDCARD`, `*`) (及其他连接驱动类型): `null`
        *   这套获取有效默认值的逻辑 (`getEffectiveDefaultValue(inputDef: InputDefinition)`) 需要在共享库 `packages/utils` 中实现，确保前后端一致。

*   **D. ID 生成库**:
    *   引入 `nanoid` 库用于生成短唯一 ID (**10 字符**)。

**3. 改造步骤 (聚焦存取，暂缓执行引擎)**

1.  **依赖添加**: 在 `apps/frontend-vueflow` 的 `package.json` 中添加 `nanoid` 依赖。 (`bun add nanoid -w apps/frontend-vueflow`)
2.  **类型定义 (`packages/types`)**:
    *   修改 `InputDefinition` (`node.ts`)，使 `defaultValue` 变为可选 (`defaultValue?: any`)。
    *   定义新的存储格式类型 (`WorkflowStorageNode` - 添加 `customLabel`, `customDescription`, `customSlotDescriptions`, 移除 `label`; `WorkflowStorageEdge`; `WorkflowStorageObject` - 移除顶层 `description`) 在 `schemas.ts` 或 `node.ts`。
    *   修改 `GroupSlotInfo` (在 `schemas.ts` 或 `node.ts`) 添加 `customDescription?: string`。
    *   定义 `ExecutionNode`, `ExecutionEdge`, `WorkflowExecutionPayload` 接口 (`node.ts` 或 `schemas.ts`)。
    *   导出所有新类型 (`index.ts`)。
3.  **实现 `getEffectiveDefaultValue` 逻辑**:
    *   在 `packages/utils` 中创建 `defaultValueUtils.ts` (或类似名称)。
    *   实现 `getEffectiveDefaultValue(inputDef: InputDefinition): any` 辅助函数，包含所有明确的默认值规则。
    *   添加单元测试。
    *   导出该函数 (`index.ts`)。
4.  **前端 ID 生成 (`apps/frontend-vueflow`)**:
    *   修改创建新节点/边的逻辑 (如 `useCanvasInteraction.ts`, `useCanvasConnections.ts`)，使用 `nanoid(10)` 生成 ID。
5.  **前端加载逻辑 (`apps/frontend-vueflow`)**:
    *   修改 `useWorkflowData.ts` / `workflowTransformer.ts` 中的加载/转换逻辑 (`loadWorkflow`, `transformWorkflowToVueFlow`)。
    *   加载工作流 `.json` (符合 `WorkflowStorageObject` 格式) 时：
        *   获取 `NodeDefinition`。
        *   创建 VueFlow 节点/边实例 (使用 Nano ID)。
        *   应用 `position`, `size`。
        *   确定节点标签和描述：
            *   读取 `storageNode.customLabel` 和 `storageNode.customDescription`。
            *   读取 `nodeDef.displayName` (或 `type`) 和 `nodeDef.description` (默认标签和描述)。
            *   设置 Vue Flow 节点的显示标签/描述 (优先使用自定义值) 和默认标签/描述 (用于 tooltip 或备用)。
        *   确定插槽描述：
            *   读取 `storageNode.customSlotDescriptions`。
            *   读取 `InputDefinition.description` / `OutputDefinition.description` (默认描述)。
            *   设置 Vue Flow 节点内部状态中各插槽的显示描述 (优先自定义) 和默认描述。
        *   遍历 `NodeDefinition` 的 `inputs`：
            *   调用 `getEffectiveDefaultValue` 获取有效默认值。
            *   检查文件中的 `inputValues` 是否包含该 key。
            *   如果包含，使用 `inputValues` 中的值；否则，使用有效默认值填充节点内部状态。
        *   应用 `configValues`。
6.  **前端保存逻辑 (`apps/frontend-vueflow`)**:
    *   修改 `useWorkflowData.ts` / `workflowTransformer.ts` 中的保存/转换逻辑 (`saveWorkflow`, `transformVueFlowToCoreWorkflow`)。
    *   保存工作流 `.json` 文件时：
        *   获取 `NodeDefinition`。
        *   创建一个空的 `inputValues` 对象。
        *   遍历节点实例的当前输入值：
            *   获取该输入的有效默认值 (`getEffectiveDefaultValue`)。
            *   进行**深比较**：如果当前值**不等于**有效默认值，则将其添加到 `inputValues`。
        *   获取 UI 上的当前节点标题/描述和节点定义中的默认标题/描述。
        *   如果 UI 标题/描述存在且**不等于**默认值，则将其写入 `customLabel` / `customDescription`。
        *   获取 UI 上各插槽的当前描述和定义中的默认描述。
        *   如果插槽的 UI 描述存在且**不等于**默认值，则将其添加到 `customSlotDescriptions` 对象中。
        *   写入 `id` (Nano ID), `type`, `position`, `size?`, `customLabel?`, `customDescription?`, `customSlotDescriptions?`, `inputValues?`, `configValues?` 到节点对象。
        *   写入只包含逻辑字段和 Nano ID 的 `edges`。
        *   写入顶层元数据 (不含 `description`)，生成符合 `WorkflowStorageObject` 结构的对象。
7.  **前端执行请求转换 (`apps/frontend-vueflow`) - 准备工作**:
    *   修改 `useWebSocket.ts` 或 `workflowTransformer.ts` 中生成执行载荷的逻辑。
    *   确保能根据当前画布状态和有效默认值规则，生成符合 `WorkflowExecutionPayload` 结构的数据。
    *   **注意**: 实际发送给后端的逻辑可能暂时不变或发送占位符，等待后端执行引擎适配。
8.  **后端 API (`apps/backend`) - 存取调整**:
    *   修改工作流**保存** API 端点 (`workflowRoutes.ts`?)，使其能接收并存储新的 `WorkflowStorageObject` 格式。更新验证逻辑。
    *   修改工作流**加载** API 端点，确保能读取并返回新的存储格式。
9.  **后端执行引擎 (`apps/backend`) - 暂缓**:
    *   `ExecutionEngine.ts` 和处理执行请求的 WebSocket 处理器 (`handler.ts`) 的深入改造**暂缓**。
10. **数据迁移**: (由于应用未发布，此步骤当前不需要)
    *   ~~编写一次性脚本...~~

**4. Mermaid 流程图 (反映暂缓部分)**

```mermaid
graph TD
    subgraph Frontend (apps/frontend-vueflow)
        F_Load[Load Workflow (.json - 精简格式, Nano ID)] --> F_Parse{Parse & Apply Effective Defaults};
        F_Parse -- NodeDefinition, getEffectiveDefaultValue --> F_State[Internal State (VueFlowNode/Edge + Visual, Nano ID)];
        F_State --> F_Edit[User Edits Canvas];
        F_Edit --> F_State;

        F_State -- Compare w/ Effective Defaults --> F_Save[Save Workflow (.json - 精简格式, Nano ID)];
        F_Save -- Send Request --> B_API_SaveLoad{Backend API (Save/Load)};

        F_State -- Transform (Extract Logic) --> F_PayloadGen[Generate Execution Payload (ExecutionNode/Edge - 纯逻辑, Nano ID)];
        %% F_PayloadGen -- Send Request --> B_API_Exec{Backend API (Execute - Placeholder)}; %% Execution part is deferred
    end

    subgraph Backend (apps/backend)
        B_API_SaveLoad -- Read/Write Storage --> B_Storage[(Workflow Storage)];
        %% B_API_Exec -- Validate Payload --> B_ParseExec{Parse Execution Payload (Deferred)}; %% Deferred
        %% B_ParseExec -- NodeDefinition --> B_Engine[Execution Engine (Deferred)]; %% Deferred
        %% B_Engine -- Apply Effective Defaults & Execute --> B_Result[Execution Result (Deferred)]; %% Deferred
    end

    subgraph Shared (`packages/types`, `packages/utils`)
        TypeDefs[NodeDefinition (Schema, Optional Default)];
        EffectiveDefaultLogic[getEffectiveDefaultValue Logic in utils];
        StorageFormat[Workflow Storage Schema (精简, Nano ID)];
        PayloadFormat[Execution Payload Schema (纯逻辑, Nano ID)];
        NanoIDDep[NanoID Dependency in frontend];
    end

    F_Parse --> TypeDefs;
    F_Parse --> EffectiveDefaultLogic;
    F_Save --> TypeDefs;
    F_Save --> EffectiveDefaultLogic;
    F_PayloadGen --> TypeDefs;
    F_PayloadGen --> EffectiveDefaultLogic;
    %% B_ParseExec --> TypeDefs; %% Deferred
    %% B_Engine --> TypeDefs; %% Deferred
    %% B_Engine --> EffectiveDefaultLogic; %% Deferred

    F_Load --> StorageFormat;
    F_Save --> StorageFormat;
    B_API_SaveLoad --> StorageFormat;

    F_PayloadGen --> PayloadFormat;
    %% B_API_Exec --> PayloadFormat; %% Deferred

    F_Load --> NanoIDDep;
    F_Save --> NanoIDDep;
    F_State --> NanoIDDep;


    style F_Load fill:#ccf,stroke:#333,stroke-width:1px
    style F_Save fill:#ccf,stroke:#333,stroke-width:1px
    style B_API_SaveLoad fill:#ccf,stroke:#333,stroke-width:1px
    style StorageFormat fill:#ccf,stroke:#333,stroke-width:1px,stroke-dasharray: 5 5
    style F_PayloadGen fill:#f9f,stroke:#333,stroke-width:1px
    style PayloadFormat fill:#f9f,stroke:#333,stroke-width:1px,stroke-dasharray: 5 5
    %% style B_API_Exec fill:#f9f,stroke:#333,stroke-width:1px,stroke-dasharray: 2 2 %% Deferred style
    %% style B_Engine fill:#eee,stroke:#999,stroke-width:1px,stroke-dasharray: 2 2 %% Deferred style
```

## 5. 相关文件列表 (预计需要修改 - 优先级调整)

**高优先级 (本次改造核心)**

*   **共享库 (`packages`)**
    *   `packages/types/src/node.ts`: 修改 `InputDefinition` (及其 `config` 结构)，统一使用 `suggestions` 并明确 `default` 在 `config` 内, 添加/更新存储和执行类型。
    *   `packages/types/src/schemas.ts`: 定义/更新 Zod Schema (如果使用)。
    *   `packages/types/src/index.ts`: 导出新类型。
    *   `packages/utils/src/defaultValueUtils.ts` (新建): 实现 `getEffectiveDefaultValue`，从 `inputDef.config` 读取 `default` 和 `suggestions`。
    *   `packages/utils/src/index.ts`: 导出新工具函数。
*   **前端 (`apps/frontend-vueflow`)**
    *   `package.json`: 添加 `nanoid`。
    *   `src/composables/workflow/useWorkflowData.ts` (或 `src/utils/workflowTransformer.ts`): **核心修改**，实现新的加载/保存/转换逻辑。
    *   `src/composables/canvas/useCanvasInteraction.ts`, `src/composables/canvas/useCanvasConnections.ts` (或相关): 更新 ID 生成逻辑。
    *   `src/composables/useWebSocket.ts`: 调整执行载荷生成部分 (准备工作)。
*   **后端 (`apps/backend`)**
    *   `src/routes/workflowRoutes.ts`: 调整保存/加载 API 以适配新存储格式。
    *   更新现有节点定义 (如 `TestWidgetsNode.ts`)，将 `COMBO` 类型的 `config.options` 重命名为 `config.suggestions`。

**低优先级 (暂缓或后续处理)**

*   **后端 (`apps/backend`)**
    *   `src/websocket/handler.ts`: 执行消息处理逻辑暂缓。
    *   `src/ExecutionEngine.ts`: 核心执行逻辑暂缓。
    *   `src/index.ts` / API Schema: 执行相关的 Schema 验证暂缓。
*   **前端 (`apps/frontend-vueflow`)**
    *   `src/stores/workflowStore.ts`: 可能需要微调以适应新的数据流，但核心逻辑在 `useWorkflowData`。
    *   `src/composables/workflow/useWorkflowManager.ts`: 可能需要检查 `applyStateSnapshot` 等函数是否兼容。

**注意**: 这不是一个详尽无遗的列表，实际修改过程中可能涉及其他辅助函数或组件。