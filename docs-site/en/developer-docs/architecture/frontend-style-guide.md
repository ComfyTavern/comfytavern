# ComfyTavern Frontend Content and Style Guide

## 1. Introduction

This guide provides a unified set of content creation, UI design, and code style guidelines for ComfyTavern frontend development. Adhering to this specification aims to improve code quality, strengthen brand consistency, enhance user experience, and reduce long-term maintenance costs. All developers should be familiar with and follow this guide.

---

## 2. Themes, Colors, and Styles

The UI is built on a dynamic theming system driven by Pinia, deeply integrated with Tailwind CSS. This provides great flexibility and consistency by dynamically loading theme configurations and applying CSS variables.

- **Core Logic**: `useThemeStore` in [`theme.ts`](../../apps/frontend-vueflow/src/stores/theme.ts) is responsible for managing all theme functionalities.
- **Core Principle**: **Always use colors via predefined Tailwind utility classes or CSS variables; avoid hardcoding color values in styles or templates.**

### 2.1 Color Usage

- **Base Colors**: Use semantic Tailwind classes such as `bg-primary`, `text-base`, `border-base`.
- **Transparency Variants**: For most theme colors (e.g., `primary`, `secondary`, `accent`, `info`, `success`, `text-muted`), we provide two preset translucent versions: `-soft` (denser) and `-softest` (lighter), e.g., `bg-primary-soft` or `border-base-softest`. This helps maintain consistent visual hierarchy throughout the application.
- **Custom Transparency**: For more precise control, use Tailwind's opacity modifiers, e.g., `bg-primary/75`.

### 2.2 Theme Extension

The best practice for extending or creating new themes is to **create new theme preset JSON files** in the [`src/assets/themes/`](../../apps/frontend-vueflow/src/assets/themes/) directory. `useThemeStore` will automatically discover and load them.

---

## 3. Style and Component Usage Strategy

### 3.1 Styling Strategy: Atomic First

The project fully adopts an **atomic Tailwind CSS first** strategy. This means all styles should be built directly by combining Tailwind's utility classes, such as `flex`, `p-4`, `rounded-lg`, `bg-primary`, `hover:bg-primary/90`.

- **Core Principle**: Prohibit new usage of DaisyUI. All UI elements, whether buttons, cards, or input fields, must be composed directly from atomic classes because DaisyUI's style encapsulation is difficult to coordinate with our theme and has caused conflicts.
- **History and Migration**: The project previously used some DaisyUI component classes, but is actively replacing them all with atomic classes. Any new code is strictly forbidden from using DaisyUI. If any remaining DaisyUI classes (e.g., `.btn`, `.card`) are found, they should be treated as technical debt and replaced.

- **Purpose**:

  - **Full Control**: Ensures developers have 100% direct control over the final style of elements, avoiding style overrides, priority conflicts, and black-box behavior introduced by third-party libraries.
  - **Consistency**: All style definitions follow a unified Tailwind CSS syntax and design philosophy.
  - **Maintainability**: Styles are tightly coupled with templates, making them easy to understand and modify without jumping between multiple files (e.g., global CSS, configuration files).
  - **Performance**: Avoids loading unused CSS, resulting in smaller final build size.

- **Practical Examples**:
  - **Button**: `<button class="px-4 py-2 bg-primary text-primary-content rounded-lg hover:bg-primary/90">Click Me</button>`
  - **Card**: `<div class="bg-background-surface rounded-lg shadow p-6">...</div>`
  ### 3.2 Icon System: Heroicons
  To ensure unified icon style, maintainability, and optimized performance across the application, the project stipulates:
  - **Sole Icon Source**: **All icons must come from the [`@heroicons/vue`](https://github.com/tailwindlabs/heroicons) library**. We primarily use its `24/outline` style set.
  - **Prohibition of Local Icons**: **Strictly forbidden** to encapsulate independent SVG files as `.vue` components and store them locally (e.g., the old `/components/icons` directory). Such icons have been completely removed and replaced.

  - **Usage**:

    ```vue
    <script setup lang="ts">
    // Import the required icons directly from the library in <script setup>
    import { Cog6ToothIcon, ArrowPathIcon } from "@heroicons/vue/24/outline";
    </script>

    <template>
      <!-- Use icons like ordinary components, and control styles via class -->
      <Cog6ToothIcon class="w-5 h-5 text-text-secondary" />
      <button>
        <ArrowPathIcon class="w-4 h-4 animate-spin" />
        Refresh
      </button>
    </template>
    ```

  - **Advantages**:
    - **Consistency**: Ensures all icons share a unified visual language.
    - **Maintainability**: No need to manage a constantly growing local icon folder.
    - **Performance**: Utilizes build tool's Tree-shaking, only actually imported icons are bundled into the final product, reducing size.

---

## 4. Component Design and Reuse

The component library follows a layered design, divided into **general base components** and **domain-specific components**.

### 4.1 General Base Components (`/components/common`)

Stores basic components that form the UI skeleton of the application, unrelated to business domains.

- **Design Patterns**:
  - **Service-oriented**: Global UIs like dialogs and notifications adopt a service-oriented model (e.g., `DialogService.ts`), managed by a singleton service. Callers do not need to care about component rendering and state.
  - **Atomic**: Component functionality is highly encapsulated and singular (e.g., `BaseModal.vue` only handles the modal shell, content is determined by slots).
  - **Renderer**: Encapsulates complex rendering logic (e.g., `MarkdownRenderer.vue`).
- **Development Principles**:
  - Prioritize using existing services (e.g., `DialogService`).
  - Abstract repetitive UI patterns into general components.
  - `common` components should not contain any specific business logic.

### 4.2 Domain-Specific Components (`/components/graph`, `/components/settings`, etc.)

Components closely related to core business (e.g., graph editor, settings page).

- **Design Patterns**:
  - **Data-driven**: Component rendering and behavior are determined by their input data (props, `v-model`) and configurations. For example, input controls in the graph dynamically render based on the type of node attributes.
  - **Context-aware**: Components may deeply depend on their context (e.g., VueFlow instance, Pinia stores).
- **Development Principles**:
  - **Clear Responsibility**: The main responsibility of input components is to provide a UI to edit specific types of values, avoiding mixing in too much business logic.
  - **Reuse Base**: Reuse base components from the `common` directory as much as possible.
  - **Support Multiple Sizes**: To enable cross-context reuse (e.g., inside nodes and on settings pages), it is recommended to add a `size` property (e.g., `'small' | 'large'`) to input components, controlling display via different CSS classes. [`BooleanToggle.vue`](../../apps/frontend-vueflow/src/components/graph/inputs/BooleanToggle.vue) is a good example.

### 4.3 Data-Driven View Construction (Settings Page)

The settings page (`/components/settings`) is a classic example of data-driven views. Developers should not manually write layouts, but rather dynamically generate them by **defining arrays of configuration objects**.

- **Core Architecture**:
  - [`SettingsLayout.vue`](../../apps/frontend-vueflow/src/components/settings/SettingsLayout.vue) acts as a controller, reading the configuration array and dynamically rendering sections and navigation.
  - It supports both `data-driven` (generating standard lists from configuration) and `component` (embedding custom components directly) modes, balancing efficiency and flexibility.
- **Development Principles**:
  - **Definition over Coding**: Your primary job is to define `SettingItemConfig` objects, not to write HTML.
  - **Logic Separation**: Business logic (e.g., API calls) should be encapsulated in the `onSave` callback of configuration items, keeping UI components pure.
- **Advantages of this pattern**:
  - **Easy to Maintain**: Adding, deleting, or modifying settings only requires modifying the configuration object, which serves as the "single source of truth," without touching Vue templates.
  - **Permission Control**: The configuration array can be easily filtered dynamically based on user roles, enabling view-level permission control.
  - **Consistency**: Ensures a high degree of uniformity in the appearance and behavior of all settings.

---

## 5. Layout and Mobile Optimization

We advocate for **component-level responsive design**, allowing components to adapt to their container size rather than relying solely on global viewport breakpoints.

### 4.1 Core Pattern: Container Query-Based Layout Switching

We recommend using `ResizeObserver` to listen for changes in the component's root element size, thereby dynamically switching its internal layout, rather than traditional `@media` queries.

- **Exemplary Case**: [`ApiChannelList.vue`](../../apps/frontend-vueflow/src/components/llm-config/ApiChannelList.vue) renders as a `<table>` in a wide container, and switches to a vertically stacked card list in a narrow container.
- **Development Principle**: Prioritize this pattern, designing at least two layouts (wide screen/narrow screen) for complex components.

### 4.2 General Mobile Optimization

- **Touch Target**: Ensure all clickable elements have sufficiently large touch areas (not less than 44x44px).
- **Performance**: Optimize images, reduce unnecessary animations, and pay attention to computational performance.
- **Application Panels (Panels)**: As the core of the mobile experience, they must be designed with mobile users as the primary perspective, but also consider desktop usability.

---

## 6. Localization (i18n)

All user-facing text must be localized.

- **Core Rules**:
  - **Use `$t` function**: All user-facing strings must be wrapped by `vue-i18n`'s `$t('key.path')` function.
  - **Chinese as Baseline**: **All new i18n keys must first be defined in the [`zh-CN.json`](../../apps/frontend-vueflow/src/locales/zh-CN.json) file**, and then synchronized to other languages.
  - **Key Naming**: Use dot-separated structured naming, e.g., `common.buttons.confirm`.

---

## 7. Code Style and Best Practices

- **Vue Single-File Components (SFC)**: The project uniformly adopts Vue 3's Composition API and `<script setup>` syntax sugar. This pattern allows us to write cleaner, more organized component logic within the standard `.vue` file structure (`<template>`, `<script>`, `<style>`).
- **Pinia**: State management is done via Pinia Stores. Maintain single responsibility for Stores, and make proper use of `actions` and `getters`.
- **Composables**: Reusable reactive-related logic should be extracted into `useCamelCase.ts` functions in the `/composables` directory.
- **Naming**:
  - **Files**: Vue components use `PascalCase.vue`, Composables use `useCamelCase.ts`.
  - **Directories**: Use `kebab-case`.
- **Custom Directives**: For general functionalities that require direct, repetitive DOM manipulation, prioritize creating custom directives, such as `vComfyTooltip`.

---

## 8. Practical Example: UI Component Test Panel

To provide a vivid example that puts all the above principles into practice, we have created the **UI Component Test Panel**. This view is the best place to explore, test, and understand our core UI components, services, and design patterns.

- **Source Location**: [`apps/frontend-vueflow/src/views/settings/TestPanelView.vue`](../../apps/frontend-vueflow/src/views/settings/TestPanelView.vue)
- **Access Method**: In the application's settings page, there will typically be a "Test Panel" or similar entry point.

**You can find the application of the following practices in this file:**

- **Service-oriented Components**: Full usage of `DialogService`, including different types of dialogs and notifications.
- **Store-driven UI**: How `UiStore` manages global modals (e.g., settings, editor).
- **Data-driven Views**: How `SettingsPanel` dynamically generates complex setting forms via an array of configuration objects.
- **Component Reuse**: Embedded usage of domain components like `PanelContainer`.
- **Style Guide**: All components are built directly using Tailwind CSS atomic classes, adhering to the "atomic first" principle of this guide.
- **Localization**: All text is implemented via the `$t()` function.

We strongly encourage developers to consult this file before implementing new features or components to ensure consistency with the overall project style and best practices.