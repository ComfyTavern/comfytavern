# 决策日志：节点插槽类型系统重构

本日志记录在节点插槽类型系统重构项目中的关键设计决策及其理由。

---

**决策日期:** 2025/05/17

**决策点:** 关于UI Hint字段 (`uiHint`) 的引入

**背景:**
在初步的类型系统设计中，曾考虑引入一个顶层的 `uiHint: string` 字段到 `InputDefinition.config` 中，用于明确建议前端应渲染的UI组件。

**讨论与考虑:**
- 用户反馈现有系统已通过 `type` 结合 `config` 中的特定属性（如 `multiline: true`）来间接影响UI。
- 对于 `CODE` 等类型的UI表现，用户倾向于继续使用 `config` 内的配置（如 `languageHint`）来触发特定渲染。
- 考虑到 [`DesignDocs/architecture/floating-text-preview-plan.md`](../DesignDocs/architecture/floating-text-preview-plan.md) 的计划（可能将多行编辑统一到浮动窗口），对节点本身UI组件的“暗示”需求降低。

**最终决策:**
**不引入顶层的 `uiHint` 字段。**
前端UI组件的选择和渲染方式，将主要依据 `DataFlowType`、`SocketMatchCategory` (可选) 以及 `InputDefinition.config` 对象内部的具体配置项（如 `multiline`, `languageHint`, `suggestions`, 以及未来可能新增的 `preferFloatingEditor` 等）。

**理由:**
- 保持与现有设计思路的延续性。
- 避免引入过多的新顶层概念，保持 `InputDefinition` 结构的相对简洁。
- 更好地与“统一多行/复杂内容浮动编辑窗口”的未来规划相契合。
- 允许通过 `config` 进行更细粒度的UI行为控制。

**参考文档:**
- [`DesignDocs/architecture/new-slot-type-system-design.md`](../DesignDocs/architecture/new-slot-type-system-design.md) (已更新以反映此决策)

---