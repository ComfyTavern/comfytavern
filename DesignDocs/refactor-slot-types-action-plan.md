# 重构计划：节点插槽类型系统升级

**核心目标：** 将节点插槽的 `type: string` 字段替换为 `dataFlowType: DataFlowTypeName` 和可选的 `matchCategories: string[]`，并更新所有依赖旧 `type` 字段的逻辑，遵循 [`DesignDocs/architecture/new-slot-type-system-design.md`](DesignDocs/architecture/new-slot-type-system-design.md) 中的设计。

---

## 阶段一：核心类型定义

*   **任务 1.1**: 在 [`packages/types/src/schemas.ts`](packages/types/src/schemas.ts) 中：
    *   定义 `DataFlowType` 常量对象 (包含 `STRING`, `INTEGER`, `FLOAT`, `BOOLEAN`, `OBJECT`, `ARRAY`, `BINARY`, `WILDCARD`, `CONVERTIBLE_ANY`)。
    *   导出 `DataFlowTypeName` 类型别名。
    *   定义 `BuiltInSocketMatchCategory` 常量对象 (使用V3精简命名，如 `String`, `Code`, `ChatHistory`, `BehaviorWildcard` 等，具体列表参考 `new-slot-type-system-design.md`)。
    *   导出 `BuiltInSocketMatchCategoryName` 类型别名。
*   **任务 1.2**: 在 [`packages/types/src/node.ts`](packages/types/src/node.ts) 中：
    *   修改 `InputDefinition` 接口：
        *   移除 `type: string`。
        *   添加 `dataFlowType: DataFlowTypeName`。
        *   添加 `matchCategories?: string[]` (允许包含 `BuiltInSocketMatchCategoryName` 和自定义字符串)。
        *   (回顾并确认 `acceptTypes?: string[]` 是否保留，如果保留，明确其与 `matchCategories` 的关系，例如合并或作为纯自定义标签的输入源)。
    *   修改 `OutputDefinition` 接口：
        *   移除 `type: string`。
        *   添加 `dataFlowType: DataFlowTypeName`。
        *   添加 `matchCategories?: string[]`。
*   **任务 1.3**: 在 [`packages/types/src/node.ts`](packages/types/src/node.ts) 中更新 `GroupSlotInfo` 接口，使其与 `InputDefinition`/`OutputDefinition` 的新结构保持一致。
*   **任务 1.4**: 在 [`packages/types/src/schemas.ts`](packages/types/src/schemas.ts) 中更新 `GroupSlotInfoSchema` Zod schema：
    *   将 `type` 字段的 Zod 定义更新为 `dataFlowType: z.nativeEnum(DataFlowType)` (或等效的 `z.enum` 定义，确保能正确引用已定义的 `DataFlowType` 常量对象)。
    *   新增 `matchCategories: z.array(z.string()).optional()` 的 Zod 定义。

---

## 阶段二：核心工具函数与后端节点定义更新

*   **任务 2.1**: 修改 [`packages/utils/src/defaultValueUtils.ts`](packages/utils/src/defaultValueUtils.ts) 中的 `getEffectiveDefaultValue` 函数：
    *   使其 `switch` 语句基于新的 `inputDef.dataFlowType`。
    *   调整 `case` 逻辑以正确处理所有 `DataFlowTypeName`。
*   **任务 2.2**: 修改 [`packages/types/src/node.ts`](packages/types/src/node.ts) 中的 `validateInputOptions` 函数：
    *   使其 `switch` 语句基于传入参数代表的 `dataFlowType`。
*   **任务 2.3**: 修改 [`apps/frontend-vueflow/src/utils/workflowTransformer.ts`](apps/frontend-vueflow/src/utils/workflowTransformer.ts) 中依赖旧 `inputDef.type` 的逻辑（如对 `INT`, `FLOAT` 的特定处理）。
*   **任务 2.4 (重点与工作量大)**: 遍历并更新所有 `apps/backend/src/nodes/**/*.ts` 文件中的节点定义：
    *   对于每个 `inputs` 和 `outputs` 中的插槽定义：
        *   将旧的 `type` 字段替换为 `dataFlowType`。
        *   根据插槽的语义和预期用途，为其分配合适的 `matchCategories` 数组 (可以包含 `BuiltInSocketMatchCategoryName` 和必要的自定义标签)。
        *   检查并更新 `config` 对象，确保UI表现相关的配置（如 `multiline`, `languageHint`, `suggestions` 等）与新的类型系统协调工作，并符合 `new-slot-type-system-design.md` 中关于不使用顶层 `uiHint` 的共识。

---

## 阶段三：前端核心逻辑更新 (连接、状态、辅助函数)

*   **任务 3.1 (重点与复杂)**: 重写 [`apps/frontend-vueflow/src/composables/canvas/useCanvasConnections.ts`](apps/frontend-vueflow/src/composables/canvas/useCanvasConnections.ts) 中的：
    *   `isTypeCompatible` 函数：实现基于 `SocketMatchCategory` (优先) 和 `DataFlowType` (保底) 的兼容性判断逻辑，包括处理内置兼容规则和特殊行为标签 (`BehaviorWildcard`, `BehaviorConvertible`)，遵循 `new-slot-type-system-design.md` 中定义的匹配优先级。
    *   `isValidConnection` 函数：确保其调用新的 `isTypeCompatible`。
    *   `createEdge` 函数：确保边的 `data` 属性中存储的类型信息反映新的类型系统。
    *   `handleConnect` 函数：在处理连接建立，特别是 `CONVERTIBLE_ANY` 类型转换时，正确更新节点的 `dataFlowType` 和 `matchCategories`，并确保这些变更正确同步到 `workflowStore` 和历史记录。
*   **任务 3.2**: 更新 [`apps/frontend-vueflow/src/composables/group/useWorkflowGrouping.ts`](apps/frontend-vueflow/src/composables/group/useWorkflowGrouping.ts) 中的类型兼容性判断逻辑，使其与 `useCanvasConnections.ts` 的新逻辑保持一致或复用。
*   **任务 3.3**: 检查并更新 [`apps/frontend-vueflow/src/stores/workflowStore.ts`](apps/frontend-vueflow/src/stores/workflowStore.ts) 中：
    *   处理 `CONVERTIBLE_ANY` 类型变化的逻辑。
    *   与节点组接口 (`interfaceInputs`, `interfaceOutputs`) 同步相关的逻辑。
    *   任何其他直接依赖旧 `type` 字段进行判断或操作的地方。
*   **任务 3.4**: 更新 [`apps/frontend-vueflow/src/composables/node/useNodeProps.ts`](apps/frontend-vueflow/src/composables/node/useNodeProps.ts) 中处理原 `RESOURCE_SELECTOR` (现通过 `matchCategories` 判断) 的逻辑。
*   **任务 3.5**: 更新 [`apps/frontend-vueflow/src/composables/node/useNodeResize.ts`](apps/frontend-vueflow/src/composables/node/useNodeResize.ts) 中判断 `isMultiline` 和 `isButton` 的逻辑，使其基于 `config` 和/或 `matchCategories`。
*   **任务 3.6**: 检查并更新 [`apps/frontend-vueflow/src/composables/canvas/useEdgeStyles.ts`](apps/frontend-vueflow/src/composables/canvas/useEdgeStyles.ts) 中边样式的确定逻辑，可能需要基于 `dataFlowType` 或关键的 `matchCategories`。

---

## 阶段四：前端UI组件渲染逻辑更新

*   **任务 4.1 (重点)**: 修改 [`apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue)：
    *   更新决定内联/块状显示输入组件的逻辑。不再硬编码旧 `type`，而是综合考虑 `dataFlowType`, `matchCategories` (可选) 和 `config` 中的配置 (如 `multiline`, `languageHint`, 以及未来可能的 `config.preferFloatingEditor` 或类似机制)。
    *   更新按钮的渲染逻辑，基于 `matchCategories` (如 `Trigger`)。
    *   更新Tooltip中关于插槽类型信息的显示，应展示 `dataFlowType` 和 `matchCategories`。
*   **任务 4.2**: 修改 [`apps/frontend-vueflow/src/components/graph/inputs/NumberInput.vue`](apps/frontend-vueflow/src/components/graph/inputs/NumberInput.vue) 中基于旧 `props.type === 'INT'` 的判断，改为 `props.dataFlowType === DataFlowType.INTEGER`。
*   **任务 4.3**: 检查并更新 [`apps/frontend-vueflow/src/components/graph/inputs/index.ts`](apps/frontend-vueflow/src/components/graph/inputs/index.ts) (或 `BaseNode.vue` 中的 `getInputComponent` 函数) 的动态组件选择逻辑，使其适应新的类型系统和 `config` 驱动的UI表现。
*   **任务 4.4**: 更新候选节点菜单的生成逻辑 (如 `new-slot-type-system-design.md` 第8节所述)，使其基于新的兼容性规则。

---

## 阶段五：文档与测试

*   **任务 5.1**: 基于最终的 [`DesignDocs/architecture/new-slot-type-system-design.md`](DesignDocs/architecture/new-slot-type-system-design.md) 更新或重写用户和开发者文档 [`docs/node-types/node-types.zh.md`](docs/node-types/node-types.zh.md)。
*   **任务 5.2**: 编写和更新所有相关的单元测试和集成测试，确保新类型系统和连接逻辑的正确性。

---