# 活动上下文：节点插槽类型系统重构 - UI 实现

本文件用于记录当前正在进行的 UI 实现任务的详细工作过程、思考、遇到的问题和解决方案。

**背景:**
UI 设计方案已由 Architect 模式完成，并记录在 [`DesignDocs/architecture/floating-preview-editor-design.md`](./DesignDocs/architecture/floating-preview-editor-design.md) 和 [`DesignDocs/architecture/enhanced-editor-panel-design.md`](./DesignDocs/architecture/enhanced-editor-panel-design.md)。这些方案分别定义了“右侧专用预览面板”和“可停靠编辑器面板”。

**当前阶段:** 阶段四：前端UI组件渲染逻辑更新与UI/UX增强 - UI 实现

**当前子任务:**

将根据相关设计文档中的实现步骤建议，逐一委派和执行子任务。

---
*子任务 4.3.1 (代码编辑器组件增强) 已完成。详细日志已归档到 [`memory-bank/progress-log.md`](./memory-bank/progress-log.md)。关于代码编辑器实现策略的调整已记录在 [`memory-bank/decision-log.md`](./memory-bank/decision-log.md)。*
*子任务 4.3.2 (核心类型与状态管理更新 - 添加 `previewTarget`) 已完成。详细日志已归档到 [`memory-bank/progress-log.md`](./memory-bank/progress-log.md)。*
*子任务 4.3.3 (插槽预览交互实现 - 右键菜单) 已完成。用户确认通过新任务修复。详细日志已归档到 [`memory-bank/progress-log.md`](./memory-bank/progress-log.md)。*
*子任务 4.3.4 (插槽预览交互实现 - 快捷键交互) 已完成。详细日志已归档到 [`memory-bank/progress-log.md`](./memory-bank/progress-log.md)。*
*子任务 4.3.5 (插槽预览交互实现 - 视觉反馈) 已完成。用户确认通过新任务修复。详细日志已归档到 [`memory-bank/progress-log.md`](./memory-bank/progress-log.md)。*
*子任务 4.3.6 (实现右侧专用预览面板 `RightPreviewPanel.vue`) 已完成。详细日志已归档到 [`memory-bank/progress-log.md`](./memory-bank/progress-log.md)。*
---

## 阶段 4.4: 实现可停靠编辑器面板 (基于 enhanced-editor-panel-design.md)

本阶段的目标是根据 [`DesignDocs/architecture/enhanced-editor-panel-design.md`](./DesignDocs/architecture/enhanced-editor-panel-design.md) 的详细设计，实现可停靠的编辑器面板及其核心组件。用户已确认该面板将非永久常驻，通过底栏 ([`apps/frontend-vueflow/src/components/graph/StatusBar.vue`](../apps/frontend-vueflow/src/components/graph/StatusBar.vue:0)) 中的按钮控制显隐，并与画布同级受左侧边栏挤压。相关决策已记录在 [`memory-bank/decision-log.md`](./memory-bank/decision-log.md)。

*   **子任务 4.4.1 (实现核心单页编辑器组件 `RichCodeEditor.vue`) 已完成。** Code 模式已完成此组件的基础功能实现。详细工作日志已从 Code 模式的 `activeContext.md` 归档到 [`memory-bank/progress-log.md`](./memory-bank/progress-log.md)。
*   **子任务 4.4.2 (实现标签页宿主组件 `TabbedEditorHost.vue`) 已完成。** Code 模式已完成此组件的实现，用于管理多个 `RichCodeEditor.vue` 实例。详细工作日志已从 Code 模式的 `activeContext.md` 归档到 [`memory-bank/progress-log.md`](./memory-bank/progress-log.md)。

### 子任务 4.4.3 (来自增强设计文档阶段三): 实现编辑器场景包装器 (`DockedEditorWrapper.vue`)

**状态:** 准备委派

**目标:**
根据设计文档 [`DesignDocs/architecture/enhanced-editor-panel-design.md`](./DesignDocs/architecture/enhanced-editor-panel-design.md) (特别是第 2.3 节关于 `DockedEditorWrapper.vue` 和第 4 节的阶段三实现建议)，创建新的 Vue 组件 `DockedEditorWrapper.vue`。此组件将作为整个可停靠编辑器面板的 UI 管理器和调度器。

**核心需求:**
1.  **创建新组件**:
    *   在 [`apps/frontend-vueflow/src/components/graph/editor/DockedEditorWrapper.vue`](../apps/frontend-vueflow/src/components/graph/editor/DockedEditorWrapper.vue) 创建新文件 (如果目录 `editor` 不存在，则一并创建)。
2.  **面板 UI 管理**:
    *   实现可停靠面板的显示/隐藏逻辑。其可见性应能通过外部触发（例如，来自状态栏按钮的事件或全局状态）。
    *   实现面板的高度调整功能（例如，通过拖拽顶部边缘）。
    *   面板的 UI 状态（如 `isVisible: boolean`, `height: number`, `isResident: boolean` (根据用户决策，默认为 `false`)）应通过 `localStorage` 持久化 (例如，使用键 `bottomDockedEditorLayout`)。可以使用 VueUse 的 `useLocalStorage`。
3.  **编辑器模式调度**:
    *   能够接收打开编辑器的请求，该请求应包含上下文信息，特别是 `nodeId`, `inputKey`, `currentValue`, `inputDefinition` (其中包含 `config.bottomEditorMode: 'lightweightSingle' | 'fullMultiTab'`)。
    *   根据 `inputDefinition.config.bottomEditorMode` (如果未提供，可默认为 `'fullMultiTab'`)：
        *   若为 `'lightweightSingle'`，则动态加载并显示一个 [`RichCodeEditor.vue`](../apps/frontend-vueflow/src/components/common/RichCodeEditor.vue) 实例。
        *   若为 `'fullMultiTab'`，则动态加载并显示一个 [`TabbedEditorHost.vue`](../apps/frontend-vueflow/src/components/common/TabbedEditorHost.vue) 实例。如果 `TabbedEditorHost` 已存在，则应复用它并调用其 `openEditorTab` 方法。
4.  **上下文信息收集与传递**:
    *   负责从全局状态 (如 `useTabStore()` 获取当前工作流标签页名称，`useNodeStore()` 获取节点名称) 和传入的 `inputDefinition` (获取输入项名称) 收集合适的信息，以构建 `breadcrumbData`。
    *   将构建好的 `breadcrumbData` 和其他必要 props (如 `editorId`, `initialContent`, `languageHint`, `config`) 传递给被加载的 [`RichCodeEditor.vue`](../apps/frontend-vueflow/src/components/common/RichCodeEditor.vue) (单页模式) 或 [`TabbedEditorHost.vue`](../apps/frontend-vueflow/src/components/common/TabbedEditorHost.vue) (多标签模式，由其再分发给内部的编辑器实例)。
5.  **数据保存对接**:
    *   统一处理来自被加载编辑器（[`RichCodeEditor.vue`](../apps/frontend-vueflow/src/components/common/RichCodeEditor.vue) 的 `saveRequested` 事件或 [`TabbedEditorHost.vue`](../apps/frontend-vueflow/src/components/common/TabbedEditorHost.vue) 的 `tabSaved` 事件）的保存请求。
    *   调用 `useWorkflowManager()` (或其协调器如 `useWorkflowInteractionCoordinator()`) 中的相应方法 (例如 `updateNodeInputValueAndRecord`) 来更新节点数据并创建历史记录。
6.  **定义接口 (初步)**:
    *   **Props**: (可能不需要直接的 props，主要通过方法调用和事件总线/全局状态触发)
    *   **Events**: (可能向外触发的事件，如 `editorPanelVisibilityChanged`)
    *   **Methods (可通过 `defineExpose` 或通过事件总线/全局服务调用)**:
        *   `openEditor(context: EditorOpeningContext): void`，其中 `EditorOpeningContext` 包含 `nodeId`, `inputKey`, `currentValue`, `inputDefinition`。
        *   `show(): void`
        *   `hide(): void`
        *   `toggle(): void`
7.  **集成到主视图**:
    *   此组件最终需要被集成到主编辑器视图 (可能是 [`apps/frontend-vueflow/src/views/EditorView.vue`](../apps/frontend-vueflow/src/views/EditorView.vue:0))，并确保其布局符合用户确认的“与画布同级受侧边栏挤压”的要求。**此步骤的实际文件修改将作为后续集成任务的一部分，本子任务重点是 `DockedEditorWrapper.vue` 自身逻辑的实现。**

**详细日志 (由受委派的模式记录):**
*(待 Code 模式完成任务后填写)*
