# 行动计划：项目架构重构与节点组实现 (聚焦工作流 MVP)

**目标:** 实现基于“工程项目”的资源管理（最小化），并重构节点组功能为“项目内工作流引用”，采用中心化接口定义和快照机制，优先确保**工作流编辑和引用功能**的稳定性和正确性。

**阶段一：奠定基础 - 数据结构与核心 Schema 定义**

*   **任务 1.1:** 定义 `GroupSlotInfoSchema`
    *   描述：定义单个工作流接口槽位（输入或输出）的 Zod Schema。
    *   包含字段：`key` (唯一标识符), `name` (显示名称), `type` , `description` (可选描述), `required` (可选，用于输入), `defaultValue` (可选), `config` (可选，用于特定类型配置)。
*   **任务 1.2:** 定义 `GroupInterfaceInfoSchema`
    *   描述：定义工作流完整接口的 Zod Schema。
    *   包含字段：`inputs: z.record(GroupSlotInfoSchema).optional()`, `outputs: z.record(GroupSlotInfoSchema).optional()` (使用 record 以 key 作为索引)。
*   **任务 1.3:** 重构 `WorkflowObjectSchema` (`packages/types/src/schemas.ts`)
    *   移除 `embeddedWorkflows` 字段。
    *   添加 `interfaceInputs: z.record(GroupSlotInfoSchema).optional()` 字段。
    *   添加 `interfaceOutputs: z.record(GroupSlotInfoSchema).optional()` 字段。
*   **任务 1.4:** 定义 `NodeGroupDataSchema`
    *   描述：为 `NodeGroup` 类型的节点定义 `data` 字段的 Zod Schema。
    *   包含字段：`nodeType: z.literal('NodeGroup')`, `referencedWorkflowId: z.string()`, `groupInterface: GroupInterfaceInfoSchema.optional()` (接口快照), `configValues: z.record(z.any()).optional()`, `label: z.string().optional()` 等通用字段。
*   **任务 1.5:** 定义 `ProjectMetadataSchema` (`project.json`)
    *   描述：定义 `project.json` 文件结构的 Zod Schema。
    *   包含字段：`id`, `name`, `description`, `version`, `createdAt`, `updatedAt`, `templateUsed`, `preferredView` (`"editor"` | `"custom"`), `schemaVersion`, `customMetadata`。
*   **任务 1.6:** (可选) 定义其他核心资源的基础 Schema
    *   描述：为 `Character`, `WorldInfoEntry`, `ChatGraphObject` 等定义初步的 Schema 结构，明确关键字段。

**阶段二：前端实现 - 工作流核心逻辑**

*   **任务 2.1 (简化):** 实现**最小化**的项目上下文管理。
    *   可能只需要一个简单的方式来指定当前工作的项目目录/ID，并能加载该项目的 `project.json`。暂时不需要完整的项目列表、创建、删除 UI。
*   **任务 2.2 (核心):** 适配核心 Store 至项目上下文。
    *   重构 `workflowStore`，使其操作（加载、保存、管理状态）限定在当前活动项目内。
    *   重构 `tabStore`，使其标签页关联到特定项目中的特定工作流。
*   **任务 2.3 (核心):** 实现工作流接口编辑 UI (侧边面板)。
    *   **强调:** 侧边栏是管理（增、删、改、排）工作流接口 (`interfaceInputs`/`Outputs`) 的**唯一**入口。
    *   实现读取/写入当前工作流 `WorkflowObject` 的 `interfaceInputs`/`Outputs`。
    *   确保接口定义变化时，画布上对应的 `GroupInput`/`Output` 节点的插槽（Handles）能动态更新以反映中心定义。连接行为（见任务 2.7）只负责在特定条件下 *触发* 对中心接口的更新。
*   **任务 2.4 (核心):** 重构节点组创建逻辑 (`useWorkflowGrouping`)。
    *   实现将选区保存为**新工作流文件**到当前项目。
    *   **子任务 2.4.1:** 确保在新工作流内部正确创建 `GroupInput`/`Output` 节点，其初始动态插槽类型为 `CONVERTIBLE_ANY`，并重连内部边。
    *   实现替换选区为 `NodeGroup` 节点，设置 `referencedWorkflowId` 和生成 `groupInterface` 快照。
*   **任务 2.5 (核心):** 实现 `NodeGroup` 配置与引用变更处理。
    *   实现 `RESOURCE_SELECTOR` 列出**当前项目**内可引用的工作流。
    *   实现选择后更新 `referencedWorkflowId` 和 `groupInterface` 快照，并处理连接。
*   **任务 2.6 (核心):** 实现接口同步逻辑 (保存时触发)。
    *   实现后端 API 在保存工作流时，查找并更新**当前项目内**引用该工作流的 `NodeGroup` 的接口快照。
    *   实现前端在加载工作流时，检查并移除与 `NodeGroup` 快照不兼容的连接。
*   **任务 2.7 (核心):** 适配前端节点渲染与动态插槽交互逻辑。
    *   **子任务 2.7.1:** 更新类型系统，移除 `ANY`，引入 `WILDCARD` 和 `CONVERTIBLE_ANY`。
    *   **子任务 2.7.2:** 修改 `BaseNode.vue` 以正确渲染 `WILDCARD` 和 `CONVERTIBLE_ANY` 类型的插槽。
    *   **子任务 2.7.3:** 重构连接逻辑 (`useCanvasConnections.ts` 中的 `onConnect`)：
        *   检查被连接的目标插槽类型。
        *   **如果类型是 `WILDCARD`:** 允许连接，不修改节点数据或中心接口。
        *   **如果类型是 `CONVERTIBLE_ANY`:**
            *   确定连接后的新类型 (`ConnectedType`)。
            *   准备节点数据更新：将该插槽的 `type` 修改为 `ConnectedType`。
            *   **检查节点类型:** 如果该插槽属于 `GroupInput` 或 `GroupOutput` 节点：
                *   在节点数据更新中，额外添加一个新的插槽，其 `key` 唯一，`type` 为 `CONVERTIBLE_ANY`。
                *   调用 `workflowStore.updateWorkflowInterface`，使用被转换插槽的信息（Key, `ConnectedType`, name等）来更新中心接口定义。
            *   调用 `updateNodeData` 应用更改。
    *   **子任务 2.7.4:** 更新连接验证逻辑 (`isValidConnection`) 以正确处理 `WILDCARD` 和 `CONVERTIBLE_ANY` 类型。(`WILDCARD` 可与任何类型互连；`CONVERTIBLE_ANY` 作为目标时可接受任何源)。
    *   **子任务 2.7.5:** 确保 `GroupInput`/`Output` 节点能正确响应由侧边栏（任务 2.3）修改中心接口定义而引起的变化（例如，插槽被删除或重命名）。

**阶段 2.5：前端核心功能验证**

*   **任务 2.5.1:** 手动测试节点组创建流程。
    *   验证：选择节点 -> 创建组 -> 新工作流文件生成 -> 选区被替换为 `NodeGroup` 节点 -> 外部连接正确重连到 `NodeGroup`。
    *   验证：打开新生成的工作流文件 -> 确认包含原选区节点、`GroupInput`/`Output` 幻影节点，且内部连接正确。
*   **任务 2.5.2:** 手动测试工作流接口编辑。
    *   验证：打开接口编辑器 -> 添加/修改/删除输入/输出 -> 确认画布上的 `GroupInput`/`Output` 节点 Handles 动态更新。
    *   验证：保存工作流 -> 重新加载 -> 确认接口更改已持久化。
*   **任务 2.5.3:** 手动测试 `NodeGroup` 引用变更。
    *   验证：在 `NodeGroup` 配置中选择不同的引用工作流 -> 确认节点 Handles 更新 -> 确认不兼容连接被移除并提示。
*   **任务 2.5.4:** 手动测试接口同步。
    *   验证：创建一个工作流 A，再创建一个工作流 B 并引用 A。修改工作流 A 的接口并保存。重新加载工作流 B -> 确认 B 中的 `NodeGroup` 节点 Handles 已更新 -> 确认不兼容连接被移除并提示。
*   **任务 2.5.5:** 代码审查与清理。
    *   审查阶段二实现的代码，移除调试日志，优化重复代码（如 `Canvas.vue` 中的验证逻辑）。

**阶段三：后端实现 - 执行引擎 (待阶段 2.5 验证通过后)**

*   **任务 3.1:** 实现后端项目与工作流加载 API (部分可能已在 2.x 完成)。
*   **任务 3.2:** 设计并实现嵌套执行机制。
*   **任务 3.3:** 实现 `NodeGroupNode.execute`。
*   **任务 3.4:** 实现递归检测。

**阶段四：完善与扩展 (后续)**

*   **任务 4.1:** 完善项目管理 UI (列表、创建、删除等)。
*   **任务 4.2:** 实现对话图 (`ChatGraph`) 编辑器及相关功能。
*   **任务 4.3:** 实现其他资源类型（角色、世界信息等）的编辑器和管理功能。
*   **任务 4.4:** 实现自定义 UI (`/ui/`) 的加载和渲染机制。
*   **任务 4.5:** 实现项目导入/导出（分享）功能。
*   **任务 4.6:** 全面的测试、性能优化和 Bug 修复。
*   


