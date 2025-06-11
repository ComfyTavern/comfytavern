# 全局 Tooltip 服务优化计划

## 1. 背景与痛点

当前项目中，尤其是在 `apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue` 以及各处按钮提示等场景，存在大量独立挂载的 `<Tooltip>` 组件实例。这导致了以下主要问题：

*   **性能开销**：在包含大量节点或频繁使用提示的界面（如画布），创建和管理众多独立的 Tooltip DOM 实例会显著增加渲染时间和内存消耗。
*   **样式与行为不统一的风险**：虽然目前使用的是同一个 `<Tooltip.vue>` 组件，但分散使用增加了未来维护和确保行为一致性的难度。

## 2. 核心策略

为解决上述问题，我们将采取以下核心策略：

*   **优先解决性能瓶颈**：通过引入全局 Tooltip 服务来优化 `BaseNode.vue` 以及项目中其他大量使用静态提示的场景。
*   **渐进式迁移**：首先迁移内容简单、静态或易于作为字符串处理的 Tooltip。对于内容结构复杂、高度依赖当前组件上下文的 Tooltip（如 Handle 提示），暂时保留其现有的独立 `<Tooltip>` 组件实现。
*   **Pinia Store 作为核心管理器**：Tooltip 的核心状态管理和逻辑控制将通过一个 Pinia Store (`tooltipStore.ts`) 来实现，符合项目现有技术栈。

## 3. 分阶段实施计划

### 阶段一：实现基础全局 Tooltip 服务 (使用 Pinia Store) 与 `v-comfy-tooltip` 指令 (高优先级)

1.  **开发 `tooltipStore.ts` (Pinia Store)**：
    *   **State**: `isVisible` (boolean), `content` (string), `targetElement` (HTMLElement | null), `options` (object: `placement`, `delayShow`, `delayHide`, `interactive`, `showCopyButton`, `maxWidth`, `triggerType` 等配置)。
    *   **Actions**:
        *   `show(payload: { targetElement: HTMLElement, content: string, options: Partial<typeof state.options> })`
        *   `hide()`
    *   内部将集成 `@floating-ui/vue` 进行定位计算。
2.  **设计并实现全局 `TooltipRenderer.vue` 组件**：
    *   通过 `<Teleport to="body">` 挂载。
    *   从 `tooltipStore` 获取状态并渲染。
    *   支持渲染 Markdown 字符串内容。
    *   包含核心显示功能：复制按钮（当内容为简单文本时）、基本的交互模式处理、内容溢出时的滚动条、平滑的进入/离开过渡动画。
    *   实现 `DesignDocs/todos/tooltip-enhancement.md` 中的基础增强：
        *   根据 `tooltipStore.state.options.triggerType` 处理不同的触发逻辑（hover, click, focus）。
        *   添加必要的 ARIA 属性以提升无障碍性。
3.  **开发 `v-comfy-tooltip` Vue 指令**：
    *   用于在模板中方便地应用全局 Tooltip。
    *   指令值可以是：
        *   一个字符串：`v-comfy-tooltip="'提示内容'"` (作为 `content`，使用默认 `options`)。
        *   一个对象：`v-comfy-tooltip="{ content: '提示内容', placement: 'top', delayShow: 500 }"`。
    *   指令内部逻辑：
        *   在 `mounted` 时，根据 `options.triggerType` (或默认触发方式) 为绑定元素添加相应的事件监听器。
        *   事件触发时，调用 `tooltipStore.show()` action。
        *   在适当的事件中调用 `tooltipStore.hide()` action。
        *   在 `beforeUnmount` 时移除事件监听器。

### 阶段二：在项目中选择性应用新的全局 Tooltip 服务 (高优先级)

1.  **迁移 `BaseNode.vue` 中的简单 Tooltip**：
    *   替换以下场景中的 `<Tooltip>` 组件为 `v-comfy-tooltip` 指令：
        *   节点标题的描述信息。
        *   节点组跳转按钮的提示。
        *   输出参数名称的提示。
        *   输入参数名称的提示。
    *   **暂时不迁移**：节点标题的错误提示（除非其特殊性可以简单通过 `options` 处理）、所有 Handle 上的 Tooltip。
2.  **迁移项目其他地方的静态/简单 Tooltip**：
    *   识别并替换项目中其他广泛使用的、内容简单的 Tooltip 实例（特别是各种按钮提示）。
3.  **验证**：确保替换后的功能与原先一致，并对相关页面的性能进行评估。

### 阶段三：评估效果，迭代并按需扩展 (中低优先级)

1.  **评估**：综合评估性能提升、开发体验以及用户反馈。
2.  **完善与推广**：
    *   如果效果显著且满足当前主要需求，则继续完善 `tooltipStore` 和 `TooltipRenderer.vue` 的基础功能（例如，完全覆盖 `DesignDocs/todos/tooltip-enhancement.md` 中的所有特性）。
    *   在项目中更广泛地推广使用 `v-comfy-tooltip` 指令处理简单提示场景。
3.  **未来展望 (按需)**：
    *   如果未来确实需要将 Handle Tooltip 等复杂场景也统一到全局服务，届时再投入设计更高级的内容传递机制（例如，`tooltipStore` 支持接收结构化数据对象，`TooltipRenderer.vue` 增加针对这些特定数据结构的渲染逻辑）。

## 4. Mermaid 计划图

```mermaid
graph TD
    subgraph "背景与痛点"
        A[BaseNode.vue 及各处按钮提示等场景存在大量独立 Tooltip]
        A1[导致性能开销和样式不统一]
        B[现有 Tooltip.vue 组件]
        C[tooltip-enhancement.md 增强计划]
    end

    subgraph "核心优化方案 (渐进式)"
        D["阶段一：实现基础全局 Tooltip 服务 (Pinia + 指令)"]
        D_TASK1["开发 tooltipStore.ts (Pinia)"]
        D_TASK2["设计全局 TooltipRenderer.vue (Teleport, Markdown, 基础增强)"]
        D_TASK3["开发 v-comfy-tooltip 指令 (处理字符串内容和基础配置)"]
        D --> D_TASK1 --> D_TASK2 --> D_TASK3

        E["阶段二：选择性应用与验证 (高优先级)"]
        E_TASK1["迁移 BaseNode.vue 中内容简单的 Tooltip"]
        E_TASK2["迁移项目中其他静态/简单 Tooltip (如按钮提示)"]
        E_TASK3["保留 BaseNode.vue 中复杂 Tooltip (如Handle提示) 使用原独立组件"]
        E_TASK4["功能验证与性能初步评估"]
        E --> E_TASK1 & E_TASK2 & E_TASK3 --> E_TASK4

        F["阶段三：评估、迭代与按需扩展"]
        F_TASK1["评估整体效果 (性能, 开发体验)"]
        F_TASK2["若满意：完善全局服务基础功能, 推广简单场景"]
        F_TASK3["未来按需：再考虑复杂内容迁移方案 (结构化数据等)"]
        F --> F_TASK1 --> F_TASK2 & F_TASK3
    end

    A & A1 -- 驱动 --> D & E
    B -- 功能参考 --> D_TASK2
    C -- 需求指导 --> D_TASK2
    D -- 应用于 --> E
    E -- 结果反馈 --> F

    G[最终目标: 高效、统一、易用的 Tooltip 系统]
    F --> G