# Tooltip 组件增强计划 (待办)

**目标：** 增强 `apps/frontend-vueflow/src/components/common/Tooltip.vue` 组件，增加配置触发方式的功能，并提升无障碍性，参考 Semi UI Tooltip 的优点。

**计划步骤：**

1.  **添加触发方式配置 (`trigger` Prop):**
    *   在 `Props` 接口中增加一个新的属性 `trigger`。
    *   `trigger` 的类型可以是 `'hover'`, `'click'`, `'focus'` 中的一个或多个组成的数组 (例如 `['hover', 'focus']`)。
    *   默认值设为 `'hover'`，保持现有行为。
    *   **实现细节:**
        *   移除或调整现有的基于 `@vueuse/core` 的 `useElementHover` 的逻辑。
        *   根据 `trigger` prop 的值，动态地为 `referenceRef` (触发器元素) 添加相应的事件监听器 (`mouseenter`/`mouseleave`, `focus`/`blur`, `click`)。
        *   重构 `isTooltipVisible` 的状态管理逻辑，使其能够响应多种事件类型，并正确处理显示/隐藏延迟 (`showDelay`, `hideDelay`)。

2.  **实现点击外部关闭 (`onClickOutside`):**
    *   当 `trigger` 包含 `'click'` 时，需要实现点击 Tooltip 内容 (`floatingRef`) 之外的区域时自动关闭 Tooltip 的功能。
    *   **实现细节:** 可以使用 `@vueuse/core` 提供的 `onClickOutside` 组合式函数来实现这个逻辑，监听 `floatingRef` 外部的点击事件。

3.  **增强无障碍性 (ARIA Attributes):**
    *   遵循 WAI-ARIA 规范，为 Tooltip 添加必要的 ARIA 属性。
    *   **实现细节:**
        *   为 Tooltip 的内容容器 (`floatingRef` 对应的 `div`) 添加 `role="tooltip"`。
        *   为内容容器生成一个唯一的 `id` (可以使用 Vue 3 的 `useId` 或其他唯一 ID 生成方法)。
        *   为触发器元素 (`referenceRef` 或其内部的实际触发节点) 添加 `aria-describedby` 属性，其值设置为内容容器的 `id`，将触发器与 Tooltip 内容关联起来。
        *   在组件的文档注释 (JSDoc) 中建议：如果触发器元素本身没有可见文本（如图标按钮），使用者应该为其添加 `aria-label` 来提供描述。

4.  **代码重构与测试：**
    *   对修改后的代码进行整理和优化。
    *   添加或更新测试用例（如果项目中有单元测试或端到端测试），确保新功能正常工作且没有破坏原有功能。

5.  **文档更新：**
    *   更新 `Tooltip.vue` 文件头部的 JSDoc 注释，详细说明新的 `trigger` prop 的用法、各种触发方式的行为以及无障碍相关的建议。

**计划概览 (Mermaid):**

```mermaid
graph TD
    A[开始] --> B(添加 trigger Prop);
    B --> C{判断 trigger 类型};
    C -- hover --> D(监听 mouseenter/leave);
    C -- click --> E(监听 click);
    C -- focus --> F(监听 focus/blur);
    E --> G(实现 onClickOutside 关闭);
    D & E & F --> H(重构 isTooltipVisible 状态管理);
    H --> I(添加 ARIA 属性 role=tooltip, id);
    I --> J(添加 aria-describedby 到触发器);
    J --> K(代码重构与测试);
    K --> L(更新 JSDoc 文档);
    L --> M[完成];