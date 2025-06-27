# ComfyTavern 前端内容与风格指南

## 1. 引言

本指南为 ComfyTavern 前端开发提供了一套统一的内容创建、UI 设计和代码风格规范。遵循此规范旨在提升代码质量、加强品牌一致性、改善用户体验，并降低长期维护成本。所有开发者都应熟悉并遵循本指南。

---

## 2. 主题、颜色与样式

UI 建立在由 Pinia 驱动的动态主题系统之上，该系统与 Tailwind CSS 和 DaisyUI 深度集成，通过动态加载主题配置并应用 CSS 变量，提供了极大的灵活性和一致性。

- **核心逻辑**: [`theme.ts`](../../apps/frontend-vueflow/src/stores/theme.ts) 中的 `useThemeStore` 负责管理所有主题功能。
- **核心原则**: **始终通过预定义的 Tailwind 功能类或 CSS 变量来使用颜色，尽量不在样式或模板中硬编码颜色值。**

### 2.1 颜色使用

- **基础颜色**: 使用语义化的 Tailwind 类，如 `bg-primary`, `text-base`, `border-base`。
- **透明度变体**: 对大多数主题颜色（如 `primary`, `secondary`, `accent`, `info`, `success`, `text-muted` 等），我们提供了 `-soft` (较浓) 和 `-softest` (较淡) 两种预设的半透明版本，例如 `bg-primary-soft` 或 `border-base-softest`。这有助于在整个应用中保持一致的视觉层次。
- **自定义透明度**: 如需更精确的控制，可以使用 Tailwind 的不透明度修饰符，例如 `bg-primary/75`。

### 2.2 主题扩展

扩展或创建新主题的最佳实践是在 [`src/assets/themes/`](../../apps/frontend-vueflow/src/assets/themes/) 目录下**创建新的主题预设 JSON 文件**。`useThemeStore` 会自动发现并加载它。

---

## 3. 样式与组件使用策略

### 3.1 样式层级：原子类 vs. 组件类

我们同时使用 Tailwind CSS 的原子类和 DaisyUI 的组件类，它们有不同的适用场景：

- **原子类 (Atomic Classes)**: 用于构建独特的、非标准化的或微调布局的场景。例如 `flex`, `p-4`, `rounded-lg`。
- **组件类 (Component Classes)**: 用于构建标准的 UI 元素（按钮、输入框、卡片等）。例如 `btn`, `input`, `card`。

**核心原则：优先使用 DaisyUI 组件的基础类（如 `btn`, `card`）来获取结构和行为，但在应用品牌颜色时，使用我们自定义的品牌组件类。**

### 3.2 DaisyUI 基础类与自定义品牌颜色

#### 为什么要自定义？

直接覆盖 DaisyUI 的主题颜色（如 `primary`）之所以困难，是因为 DaisyUI 会基于这个颜色**预先生成大量派生工具类**（如 `hover:bg-primary-focus`, `focus:ring-primary` 等）。我们的动态主题系统通过 CSS 变量在运行时改变颜色，很难在不引入大量复杂配置或覆盖所有派生类的情况下，可靠地影响 DaisyUI 的所有状态，因此我们选择解耦。

#### 使用规范

1.  **继承骨架**: 使用 DaisyUI 的基础类来获得组件的结构、尺寸、动画和行为。
    - **示例**: `class="btn"`

2.  **应用品牌颜色**: 使用我们自己在 [`main.css`](../../apps/frontend-vueflow/src/assets/main.css) 中通过 `@layer components` 定义的品牌颜色类来上色。
    - **示例**: `class="btn-brand-primary"`

3.  **最终组合与交互状态处理**:
    - **正确做法 (静态)**: `<button class="btn btn-brand-primary">...</button>`
    - **错误做法**: `<button class="btn btn-primary">...</button>` (禁止直接使用 DaisyUI 的颜色类)
    - **手动组合用法 (Atomic Class Usage)**: `<div class="bg-primary text-primary-content p-2 rounded">...</div>` (在非组件元素上，可直接使用原子工具类手动组合样式)

---

## 4. 组件设计与复用

组件库遵循分层设计，分为**通用基础组件**和**领域特定组件**。

### 4.1 通用基础组件 (`/components/common`)

存放构成应用 UI 骨架、与业务领域无关的基础组件。

- **设计模式**:
  - **服务化**: 对话框、通知等全局 UI 采用服务化模式（如 `DialogService.ts`），由单例服务统一管理，调用者无需关心组件的渲染和状态。
  - **原子化**: 组件功能高度封装且单一（如 `BaseModal.vue` 只负责模态框外壳，内容由插槽决定）。
  - **渲染器**: 封装复杂的渲染逻辑（如 `MarkdownRenderer.vue`）。
- **开发原则**:
  - 优先使用已有的服务（如 `DialogService`）。
  - 将重复出现的 UI 模式抽象为通用组件。
  - `common` 组件不应包含任何特定业务逻辑。

### 4.2 领域特定组件 (`/components/graph`, `/components/settings` 等)

与核心业务（如图谱编辑器、设置页面）紧密相关的组件。

- **设计模式**:
  - **数据驱动**: 组件的渲染和行为由其输入数据（props, `v-model`）和配置决定。例如，图谱中的输入控件会根据节点属性的类型动态渲染。
  - **上下文感知**: 组件可能深度依赖于其所处的上下文（如 VueFlow 实例、Pinia stores）。
- **开发原则**:
  - **职责明确**: 输入组件的主要职责是提供一个 UI 来编辑特定类型的值，避免混入过多业务逻辑。
  - **复用基础**: 尽可能复用 `common` 目录下的基础组件。
  - **支持多尺寸**: 为实现跨上下文复用（如节点内部和设置页面），推荐为输入组件增加 `size` 属性（如 `'small' | 'large'`），通过不同的 CSS 类来控制显式。[`BooleanToggle.vue`](../../apps/frontend-vueflow/src/components/graph/inputs/BooleanToggle.vue) 是一个很好的范例。

### 4.3 数据驱动的视图构建 (设置页面)

设置页面 (`/components/settings`) 是数据驱动视图的典范。开发者不应手动编写布局，而是通过**定义配置对象数组**来动态生成。

- **核心架构**:
  - [`SettingsLayout.vue`](../../apps/frontend-vueflow/src/components/settings/SettingsLayout.vue) 作为控制器，读取配置数组，动态渲染分区和导航。
  - 它支持 `data-driven`（通过配置生成标准列表）和 `component`（直接嵌入自定义组件）两种模式，兼具效率与灵活性。
- **开发原则**:
  - **定义优于编码**: 你的主要工作是定义 `SettingItemConfig` 对象，而不是编写 HTML。
  - **逻辑分离**: 业务逻辑（如API调用）应封装在配置项的 `onSave` 回调中，保持 UI 组件纯粹。
- **该模式的优势**:
  - **易于维护**: 增删改查设置项，只需修改作为“单一事实来源”的配置对象，无需触碰 Vue 模板。
  - **权限控制**: 可以轻易地根据用户角色动态过滤配置数组，从而实现视图级别的权限控制。
  - **一致性**: 保证所有设置项的外观和行为高度统一。
 
---

## 5. 布局与移动端优化

我们推崇**组件级响应式设计**，让组件能根据自身容器尺寸自适应，而非仅依赖全局视口断点。

### 4.1 核心模式：基于容器查询的布局切换

我们推荐使用 `ResizeObserver` 监听组件根元素的尺寸变化，从而动态切换其内部布局，而不是传统的 `@media` 查询。

- **典范案例**: [`ApiChannelList.vue`](../../apps/frontend-vueflow/src/components/llm-config/ApiChannelList.vue) 在宽容器下渲染为 `<table>`，在窄容器下则切换为垂直堆叠的卡片列表。
- **开发原则**: 优先使用此模式，为复杂组件设计至少两种布局（宽屏/窄屏）。

### 4.2 通用移动端优化

- **触摸目标**: 保证所有可点击元素有足够大的触摸区域（不小于 44x44px）。
- **性能**: 优化图片、减少不必要的动画、注意计算性能。
- **应用面板 (Panels)**: 作为移动端体验的核心，必须以移动端用户为第一视角进行设计，但也要考虑桌面端的可用性。

---

## 6. 本地化 (i18n)

所有面向用户的文本都必须进行本地化。

- **核心规则**:
  - **使用 `$t` 函数**: 所有面向用户的字符串必须通过 `vue-i18n` 的 `$t('key.path')` 函数包裹。
  - **以中文为基准**: **所有新的 i18n key 必须首先在 [`zh-CN.json`](../../apps/frontend-vueflow/src/locales/zh-CN.json) 文件中定义**，再同步至其他语言。
  - **Key 命名**: 采用点分隔的结构化命名，如 `common.buttons.confirm`。

---

## 7. 代码风格与最佳实践

- **Vue 单文件组件 (SFC)**: 项目统一采用 Vue 3 的组合式 API (Composition API) 以及 `<script setup>` 语法糖。这种模式能让我们在标准的 `.vue` 文件结构 (`<template>`, `<script>`, `<style>`) 中编写更简洁、组织更清晰的组件逻辑。
- **Pinia**: 状态管理通过 Pinia Stores 进行。保持 Store 职责单一，合理使用 `actions` 和 `getters`。
- **Composables**: 可复用的响应式相关逻辑应抽离到 `/composables` 目录的 `useCamelCase.ts` 函数中。
- **命名**:
    - **文件**: Vue 组件使用 `PascalCase.vue`，Composables 使用 `useCamelCase.ts`。
    - **目录**: 使用 `kebab-case`。
- **自定义指令**: 对于需要直接、重复地操作 DOM 的通用功能，优先创建自定义指令，如 `vComfyTooltip`。
---

## 8. 实践范例：UI 组件测试面板

为了提供一个将上述所有原则付诸实践的鲜活示例，我们创建了 **UI 组件测试面板**。这个视图是探索、测试和理解我们核心 UI 组件、服务和设计模式的最佳场所。

- **源码位置**: [`apps/frontend-vueflow/src/views/settings/TestPanelView.vue`](../../apps/frontend-vueflow/src/views/settings/TestPanelView.vue)
- **访问方式**: 在应用的设置页面中，通常会有一个“测试面板”或类似的入口。

**你可以在这个文件中找到以下实践的应用：**

- **服务化组件**: `DialogService` 的完整用法，包括不同类型的对话框和通知。
- **Store 驱动的 UI**: `UiStore` 如何管理全局模态框（如设置、编辑器）。
- **数据驱动视图**: `SettingsPanel` 如何通过一个配置对象数组动态生成复杂的设置表单。
- **组件复用**: `PanelContainer` 等领域组件的嵌入使用。
- **样式指南**: 大量 `btn-brand-*` 自定义品牌按钮类、`alert-brand-*` 警告框以及其他 DaisyUI 组件的实际应用，完全遵循本指南的样式规范。
- **本地化**: 所有文本都通过 `$t()` 函数实现。

我们强烈建议开发者在实现新功能或组件前，先查阅此文件，以确保与项目整体风格和最佳实践保持一致。