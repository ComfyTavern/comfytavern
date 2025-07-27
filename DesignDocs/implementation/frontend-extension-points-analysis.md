# 前端扩展点分析与实现方案

咕咕在此！经过对前端代码的深入“地质勘探”，本报告将详细阐述如何在现有代码结构中，精准、优雅地安插设计文档中规划的 UI 注入点，并提出具体的数据驱动实现方案。

## 1. 核心理念：数据驱动与组件占位

我们的核心策略是避免直接修改核心组件的模板。取而代之，我们将采用两种主要方法：

1.  **数据驱动注入**：对于列表、菜单、标签页等结构，我们将通过 `ExtensionApi` 提供方法，让插件能够向核心组件的数据源（通常是 Pinia Store 中的一个数组）中注册自己的配置项。核心组件则根据这些数据动态渲染出插件的 UI。
2.  **组件占位 (`PluginOutlet`)**：对于需要在特定位置自由渲染任意内容的场景，我们将引入一个通用的 `PluginOutlet` 组件。这个组件接收一个 `locationId` 作为 prop，并负责查找所有注册到该位置的插件 UI（可以是组件、HTML片段等），然后将它们渲染出来。

---

## 2. UI 注入点详解

以下是将设计文档中的注入点与实际代码文件和实现策略的详细对应。

### 2.1. 全局布局 (`ui:layout:*`)

#### **`ui:layout:main-sidebar:nav-top` / `ui:layout:main-sidebar:nav-bottom`**

-   **目标位置**: 主侧边栏 ([`SideBar.vue`](apps/frontend-vueflow/src/views/home/SideBar.vue:1)) 的导航链接区域。
-   **分析**: `SideBar.vue` 的 `<nav>` 部分（L126-L173）通过一系列硬编码的 `<RouterLink>` 构建导航。
-   **实现方案**:
    1.  在 `uiStore` 中创建一个 `mainSidebarNavItems` 响应式数组。
    2.  `SideBar.vue` 将重构为遍历 `mainSidebarNavItems` 来动态生成导航链接。
    3.  提供 `api.ui.addSidebarNavItem({ item, position: 'top' | 'bottom' })` 方法，允许插件将自己的导航项（包含路由、图标、文本、排序权重等）添加到 `mainSidebarNavItems` 数组的开头或结尾。
    4.  `PluginOutlet` 在这里不是最佳选择，因为导航项需要与 Vue Router 紧密集成，数据驱动更合适。

#### **`ui:layout:header:left` / `ui:layout:header:center` / `ui:layout:header:right`**

-   **目标位置**: 项目布局的顶部导航栏 ([`ProjectLayout.vue`](apps/frontend-vueflow/src/views/project/ProjectLayout.vue:1))。
-   **分析**: 该导航栏（L4-L43）目前包含返回按钮、项目内视图切换（总览、编辑器等）的标签。
-   **实现方案**:
    1.  在 `<header>` 内部，现有导航标签的两侧和中间，分别放置三个 `PluginOutlet` 组件。
    2.  `<PluginOutlet locationId="ui:layout:header:left" />`
    3.  `<PluginOutlet locationId="ui:layout:header:center" />`
    4.  `<PluginOutlet locationId="ui:layout:header:right" />`
    5.  插件通过 `api.ui.registerComponent({ locationId: 'ui:layout:header:right', component: MyHeaderButton })` 来注册它们的组件。

### 2.2. 工作流编辑器 (`ui:editor:*`)

这是扩展的核心区域，位于 [`WorkflowEditorView.vue`](apps/frontend-vueflow/src/views/project/WorkflowEditorView.vue:1) 及其子组件中。

#### **`ui:editor:sidebar:tabs`**

-   **目标位置**: 编辑器侧边栏 ([`WorkflowSidebar.vue`](apps/frontend-vueflow/src/components/graph/sidebar/WorkflowSidebar.vue:1))。
-   **分析**: 该组件已经完美地采用了数据驱动模式！它遍历一个名为 `tabs` 的本地 ref (L102) 来渲染所有标签页和对应的面板。
-   **实现方案**:
    1.  将 `tabs` 数据从组件本地状态提升到 `uiStore` 中，变为 `workflowSidebarTabs`。
    2.  提供 `api.ui.addWorkflowSidebarTab({ id, titleKey, icon, component })` 方法。
    3.  插件调用此 API，即可将其工具面板无缝集成到侧边栏中。这是数据驱动方案的最佳实践范例。

#### **`ui:editor:canvas:toolbar`**

-   **目标位置**: 画布 ([`Canvas.vue`](apps/frontend-vueflow/src/components/graph/Canvas.vue:1)) 的某个角落（例如左上角或右下角）。
-   **分析**: `Canvas.vue` 的根 `div` (L2) 是整个画布区域的容器。
-   **实现方案**:
    1.  在 `Canvas.vue` 的根 `div` 内部，放置一个绝对定位的 `PluginOutlet`。
    2.  `<PluginOutlet locationId="ui:editor:canvas:toolbar" class="absolute top-4 left-4 z-10" />`
    3.  插件可以注册一个包含多个按钮的工具栏组件到此位置。

#### **`ui:editor:canvas:context-menu`**

-   **目标位置**: 画布的右键菜单 ([`ContextMenu.vue`](apps/frontend-vueflow/src/components/graph/menus/ContextMenu.vue:1))。
-   **分析**: `Canvas.vue` (L25) 调用了 `ContextMenu` 组件。该菜单目前是静态定义的。
-   **实现方案**:
    1.  采用数据驱动。在 `uiStore` 中创建 `canvasContextMenuItems` 数组。
    2.  `ContextMenu.vue` 将重构为遍历此数组来动态生成菜单项。
    3.  提供 `api.ui.addCanvasContextMenuItem({ label, icon, action, separator?: boolean })` 方法。`action` 回调函数将接收到画布的上下文信息（如点击位置）。

#### **`ui:editor:node:context-menu`**

-   **目标位置**: 节点的右键菜单 ([`NodeContextMenu.vue`](apps/frontend-vueflow/src/components/graph/menus/NodeContextMenu.vue:1))。
-   **分析**: 与画布右键菜单类似，目前是静态的。
-   **实现方案**:
    1.  同样采用数据驱动。在 `uiStore` 中创建 `nodeContextMenuItems` 数组。
    2.  `NodeContextMenu.vue` 重构为动态生成。
    3.  提供 `api.ui.addNodeContextMenuItem({ label, icon, action, filter?: (node) => boolean })`。`filter` 函数允许插件指定该菜单项仅对特定类型的节点显示。`action` 回调将接收到被点击的节点实例。

#### **`ui:editor:statusbar:left` / `ui:editor:statusbar:right`**

-   **目标位置**: 编辑器底部的状态栏 ([`StatusBar.vue`](apps/frontend-vueflow/src/components/graph/StatusBar.vue:1))。
-   **分析**: `WorkflowEditorView.vue` (L52) 中调用了 `StatusBar`。我们需要检查其内部结构。假设它是一个 flex 容器。
-   **实现方案**:
    1.  在 `StatusBar.vue` 的根 flex 容器的开头和结尾，分别放置 `PluginOutlet`。
    2.  `<PluginOutlet locationId="ui:editor:statusbar:left" />`
    3.  `<div class="flex-grow" />` <!-- 弹簧，用于推开左右两侧 -->
    4.  `<PluginOutlet locationId="ui:editor:statusbar:right" />`

### 2.3. 节点内部 (`ui:node:*`)

所有这些注入点都将位于 [`BaseNode.vue`](apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue:1) 中。

#### **`ui:node:header:pre` / `ui:node:header:post`**

-   **目标位置**: 节点标题行的前后。
-   **分析**: 标题行位于 `.custom-node-header` (L785) 中。
-   **实现方案**:
    1.  在 `.custom-node-header` 的 `flex` 容器内部，标题文本 `<span>` 的前后，放置 `PluginOutlet`。
    2.  `<PluginOutlet locationId="ui:node:header:pre" :node="props" />`
    3.  `<span class="node-title ...">...</span>`
    4.  `<PluginOutlet locationId="ui:node:header:post" :node="props" />`
    5.  `PluginOutlet` 会将当前节点 `props` 传递给插件组件，使其能够根据节点状态显示不同内容（例如，一个状态指示灯）。

#### **`ui:node:content:begin` / `ui:node:content:end`**

-   **目标位置**: 节点主体内容的开始和结束处。
-   **分析**: 主体内容位于 `.custom-node-body` (L825) 中。
-   **实现方案**:
    1.  在 `.custom-node-body` `div` 的内部，所有输入/输出渲染之前和之后，放置 `PluginOutlet`。
    2.  `<PluginOutlet locationId="ui:node:content:begin" :node="props" />`
    3.  `<!-- Outputs and Inputs rendering -->`
    4.  `<PluginOutlet locationId="ui:node:content:end" :node="props" />`

### 2.4. 设置页面 (`ui:settings:*`)

#### **`ui:settings:section`**

-   **目标位置**: 设置页面 ([`SettingsLayout.vue`](apps/frontend-vueflow/src/components/settings/SettingsLayout.vue:1))。
-   **分析**: `SettingsLayout.vue` 已经完美实现了数据驱动！它通过 `sections` 计算属性 (L373) 来定义和渲染所有设置分区。
-   **实现方案**:
    1.  将 `sections` 的定义从组件本地提升到 `settingsStore`。
    2.  提供 `api.settings.addSection({ id, label, icon, component, dataConfig })` 方法。
    3.  插件可以调用此 API 来添加一个全新的设置页面，可以是完全自定义的组件，也可以是遵循 `SettingItemConfig` 规范的数据驱动面板。

---

## 3. `PluginOutlet` 组件初步设计

```vue
<!-- PluginOutlet.vue -->
<template>
  <template v-for="registration in registeredUIs" :key="registration.id">
    <component :is="registration.component" v-bind="registration.props" />
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useUiStore } from '@/stores/uiStore';

const props = defineProps<{
  locationId: string;
  // 允许传递额外的上下文给插件组件
  [key: string]: any; 
}>();

const uiStore = useUiStore();

const registeredUIs = computed(() => {
  // uiStore.getRegisteredUI(locationId) 会返回一个包含组件和 props 的数组
  // 它还会智能地将 props 中传递的额外上下文合并到每个插件组件的 props 中
  return uiStore.getRegisteredUI(props.locationId, props);
});
</script>
```

## 4. 总结

通过上述分析，我们已经为所有规划的 UI 注入点找到了精确的实现路径。核心是**最大化地利用数据驱动模式**，并在必要时使用**通用的 `PluginOutlet` 组件**作为补充。这种方式将确保核心代码的稳定性，同时为插件开发者提供极大的灵活性和便利性。

下一步，我们将基于这份报告，开始具体的编码实现工作。咕咕，出发！