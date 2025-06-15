# ComfyTavern 统一主题系统设计方案

## 1. 引言与目标

本文档旨在规划 ComfyTavern 应用的全新统一主题系统。该系统旨在提供高度可定制的视觉体验，支持多种主题预设、用户自定义颜色，并能良好地集成现有技术栈（Vue3, TypeScript, Tailwind CSS, DaisyUI）。

**核心目标：**

*   **统一视觉风格**：确保应用各处 UI 元素在不同主题下表现一致。
*   **用户个性化**：允许用户根据个人喜好选择预设主题或深度自定义颜色。
*   **亮暗模式自动适配**：即使用户选择了自定义的彩色主题，在“跟随系统”显示模式下，该主题也能自动适配系统的亮/暗色调。
*   **可扩展性**：方便未来添加更多主题预设和自定义选项。
*   **可维护性**：通过 CSS 变量和清晰的结构，降低主题维护成本。
*   **开发者友好**：方便开发者在开发新组件时遵循主题规范。

## 2. 核心概念

### 2.1 CSS 变量驱动

新主题系统的核心是 CSS 自定义属性（CSS 变量）。我们将定义一套全局的、语义化的 CSS 变量来控制应用的主要颜色、部分间距和字体等。

**初步核心颜色变量列表 (阶段一，5-8个):**

*   `--ct-primary`: 主色调，用于关键操作、高亮元素。
*   `--ct-secondary`: 次要色调，用于辅助元素、次级按钮。
*   `--ct-accent`: 强调色，用于特别需要突出的元素或状态。
*   `--ct-background-base`: 最底层的背景色。
*   `--ct-background-surface`: 卡片、面板等表层元素的背景色。
*   `--ct-text-base`: 主要文本颜色。
*   `--ct-text-muted`: 次要或辅助性文本颜色。
*   `--ct-border-base`: 主要边框颜色。

后续可根据需求扩展，例如 `--ct-success`, `--ct-warning`, `--ct-error` 等状态颜色。

### 2.2 主题预设 (JSON 定义)

每个主题预设将通过一个 JSON 对象或文件来定义。该对象包含主题的元数据以及其在亮色和暗色模式下的 CSS 变量具体值。

**TypeScript 接口定义:**

```typescript
interface CssVariableMap {
  [key: string]: string; // 例如: "--ct-primary": "#ff0000"
}

interface ThemeVariant {
  variables: CssVariableMap;
  // 未来可扩展其他特定于变体的配置，如字体等
}

interface ThemePreset {
  id: string; // 唯一标识符, e.g., "ocean-blue"
  name: string; // 用户可见的名称, e.g., "海洋之蓝"
  isSystemTheme?: boolean; // 标记是否为不可删除的系统基础主题 (如默认亮/暗)
  variants: {
    light: ThemeVariant;
    dark: ThemeVariant;
  };
  metadata?: {
    author?: string;
    description?: string;
    version?: string;
  };
}
```

**示例 JSON (`ocean-blue.json`):**

```json
{
  "id": "ocean-blue",
  "name": "海洋之蓝",
  "variants": {
    "light": {
      "variables": {
        "--ct-primary": "#007bff",
        "--ct-secondary": "#6cb2eb",
        "--ct-accent": "#00e1ff",
        "--ct-background-base": "#f0f8ff",
        "--ct-background-surface": "#ffffff",
        "--ct-text-base": "#122a40",
        "--ct-text-muted": "#506a80",
        "--ct-border-base": "#c0d8f0"
      }
    },
    "dark": {
      "variables": {
        "--ct-primary": "#3395ff",
        "--ct-secondary": "#559bd4",
        "--ct-accent": "#50f1ff",
        "--ct-background-base": "#0a1828",
        "--ct-background-surface": "#102338",
        "--ct-text-base": "#d8e8f8",
        "--ct-text-muted": "#a0b8d0",
        "--ct-border-base": "#2a4868"
      }
    }
  },
  "metadata": {
    "author": "ComfyTavern Team",
    "description": "深邃而宁静的蓝色主题"
  }
}
```
对于纯粹的亮色或暗色基础主题，`variants` 中可以只包含对应模式的定义。

### 2.3 `themeStore` 扩展

现有的 [`apps/frontend-vueflow/src/stores/theme.ts`](apps/frontend-vueflow/src/stores/theme.ts:1) (`useThemeStore`) 将进行扩展，以支持新的主题系统。

**主要职责变更与新增：**

*   **状态 (State):**
    *   `availableThemes: Ref<ThemePreset[]>`: 存储所有已加载的可用主题预设。
    *   `selectedThemeId: Ref<string>`: 当前选中的主题预设 ID。
    *   `displayMode: Ref<'light' | 'dark' | 'system'>`: 用户选择的显示模式 (对应旧 `theme` 状态)。
    *   `currentAppliedMode: Readonly<Ref<'light' | 'dark'>>`: 根据 `displayMode` 和系统偏好计算出的当前实际应用的模式。
    *   `userCustomThemes: Ref<ThemePreset[]>`: (阶段二) 存储用户自定义并保存的主题。
*   **行为 (Actions):**
    *   `loadAvailableThemes()`: 从预定义位置（如 `public/themes/` 目录下的 JSON 文件，用于加载系统预设主题）和用户个人主题库（通过 `FAMService` 访问 `user://library/themes/`，用于加载用户自定义主题）或配置中加载主题预设。
    *   `selectThemePreset(themeId: string)`: 选择一个主题预设。
    *   `setDisplayMode(mode: 'light' | 'dark' | 'system')`: 设置显示模式。
    *   `applyCurrentTheme()`: 核心方法。根据 `selectedThemeId` 和 `currentAppliedMode`，获取对应主题预设的正确变体 (`light` 或 `dark`) 中的 `variables`，并将这些 CSS 变量动态应用到 `document.documentElement.style` 上。同时，确保 `<html>` 标签上正确添加/移除 `dark` 类。
    *   `initTheme()`: 初始化时加载主题、应用用户偏好。
    *   (阶段二) `saveUserTheme(theme: ThemePreset)`: 保存用户自定义主题。
    *   (阶段三) `importTheme(file: File)` / `exportTheme(themeId: string)`。
    *   (阶段三) `applyCustomCss(cssString: string)`。

### 2.4 Tailwind CSS 与 DaisyUI 协同

*   **Tailwind CSS**:
    *   在 [`tailwind.config.js`](apps/frontend-vueflow/tailwind.config.js:1) 的 `theme.extend.colors` 部分，将颜色定义指向我们的 CSS 变量。
        ```javascript
        // tailwind.config.js
        module.exports = {
          // ...
          darkMode: 'class',
          theme: {
            extend: {
              colors: {
                primary: 'var(--ct-primary)',
                secondary: 'var(--ct-secondary)',
                accent: 'var(--ct-accent)',
                'background-base': 'var(--ct-background-base)',
                'background-surface': 'var(--ct-background-surface)',
                'text-base': 'var(--ct-text-base)',
                'text-muted': 'var(--ct-text-muted)',
                'border-base': 'var(--ct-border-base)',
                // ... 更多语义化颜色名称
              },
            },
          },
          plugins: [require('daisyui')],
          daisyui: {
            themes: [
              {
                // 定义一个或多个“透明”的 DaisyUI 主题，使其颜色继承自我们的 CSS 变量
                mytheme_light: { // 对应我们的亮色模式
                  "primary": "var(--ct-primary)",
                  "secondary": "var(--ct-secondary)",
                  "accent": "var(--ct-accent)",
                  "neutral": "var(--ct-text-base)", // DaisyUI 中 neutral 常用于文本或中性背景
                  "base-100": "var(--ct-background-base)", // DaisyUI 的基础背景
                  "base-200": "var(--ct-background-surface)", // DaisyUI 的次级背景
                  "info": "var(--ct-info, var(--ct-primary))", // 如果我们定义了 --ct-info，就用它
                  "success": "var(--ct-success, #00ff00)", // 可以有默认值
                  "warning": "var(--ct-warning, #ffff00)",
                  "error": "var(--ct-error, #ff0000)",
                  // ... 映射 DaisyUI 需要的其他颜色变量
                  // 对于 DaisyUI 的颜色亮度变体 (e.g., primary-focus, primary-content),
                  // 如果我们的CSS变量系统不直接提供，可以考虑：
                  // 1. 也用CSS变量定义它们。
                  // 2. 依赖 DaisyUI 基于主色自动生成（可能效果不完全符合预期）。
                  // 3. 在我们的主题JSON中也定义这些 DaisyUI 特定的变量。
                },
                mytheme_dark: { // 对应我们的暗色模式
                  "primary": "var(--ct-primary)",
                  "secondary": "var(--ct-secondary)",
                  // ... 其他暗色模式下的 DaisyUI 颜色映射
                  "base-100": "var(--ct-background-base)",
                  "base-200": "var(--ct-background-surface)",
                  // ...
                }
              }
            ],
            darkTheme: "mytheme_dark", // 指定 DaisyUI 的暗色主题名称
            logs: true,
          },
        };
        ```
    *   当 `themeStore` 切换 `<html>` 上的 `dark` 类时，Tailwind 的暗色变体 (`dark:...`) 会自动生效。DaisyUI 也会根据 `data-theme` 属性或 `darkTheme` 配置切换其主题。
*   **DaisyUI**:
    *   我们将配置 DaisyUI 使用一个或两个“桥接”主题（如上述 `mytheme_light`, `mytheme_dark`），这些主题的颜色值直接引用我们定义的 `--ct-*` CSS 变量。
    *   `themeStore` 在应用主题时，除了设置 CSS 变量和 `dark` 类，还需要确保 `document.documentElement` 的 `data-theme` 属性被设置为对应的 DaisyUI 桥接主题名称（例如，如果当前是亮色，则为 `mytheme_light`）。

## 3. 详细实施计划

### 阶段一：基础框架与核心预设

**目标：** 搭建基本的主题切换框架，支持至少3个预设，并能在亮/暗/系统模式间切换。

1.  **数据结构定义 (TypeScript):**
    *   在 `packages/types/src/theme.ts` (如果尚不存在则创建) 或 [`apps/frontend-vueflow/src/types/themeTypes.ts`](apps/frontend-vueflow/src/types/themeTypes.ts:1) 中定义 `CssVariableMap`, `ThemeVariant`, `ThemePreset` 接口。

2.  **`themeStore` ([`apps/frontend-vueflow/src/stores/theme.ts`](apps/frontend-vueflow/src/stores/theme.ts:1)) 重构与扩展:**
    *   引入新的状态属性：`availableThemes`, `selectedThemeId`, `displayMode`, `currentAppliedMode`。
    *   实现 `loadAvailableThemes()`: 初期加载系统预设主题可以从 `public/themes/` 加载本地 JSON 文件。同时，需要实现从用户个人主题库（逻辑路径 `user://library/themes/`，通过 `FAMService` 访问，物理路径大致为 `ComfyTavern/userData/{userId}/library/themes/`）加载用户自定义主题的逻辑。
    *   实现 `selectThemePreset(themeId: string)`。
    *   实现 `setDisplayMode(mode: 'light' | 'dark' | 'system')`。
    *   实现 `applyCurrentTheme()`:
        *   根据 `selectedThemeId` 获取 `ThemePreset`。
        *   根据 `displayMode` 和 `window.matchMedia('(prefers-color-scheme: dark)').matches` 计算出 `currentAppliedMode` ('light' 或 'dark')。
        *   获取选中主题的对应 `variant` (`preset.variants[currentAppliedMode]`)。
        *   遍历 `variant.variables`，通过 `document.documentElement.style.setProperty(key, value)` 应用 CSS 变量。
        *   根据 `currentAppliedMode` 添加/移除 `<html>` 上的 `dark` 类。
        *   设置 `document.documentElement.dataset.theme` 为对应的 DaisyUI 桥接主题名 (e.g., `mytheme_light` 或 `mytheme_dark`)。
    *   修改 `initTheme()` 以调用新的加载和应用逻辑。
    *   确保系统颜色方案变化时 (`mediaQuery.addEventListener('change', ...)`)，如果 `displayMode` 是 `system`，能正确触发 `applyCurrentTheme()`。

3.  **CSS 变量与全局样式:**
    *   创建 [`apps/frontend-vueflow/src/assets/styles/theme-variables.css`](apps/frontend-vueflow/src/assets/styles/theme-variables.css:1) (或类似名称)。
    *   在该文件中定义 `:root { ... }` 和 `html.dark { ... }` 的基础 CSS 变量（包含默认亮色和暗色主题的变量值）。
    *   在 [`apps/frontend-vueflow/src/main.ts`](apps/frontend-vueflow/src/main.ts:1) 中导入此 CSS 文件。
    *   确保这些变量被 Tailwind 和 DaisyUI 使用（见 2.4）。

4.  **预设主题文件:**
    *   在 `public/themes/` 目录下（此为存放系统内置预设主题的位置，由前端直接加载）创建至少3个 JSON 文件：
        *   `default-light.json`: 只包含 `variants.light`。
        *   `default-dark.json`: 只包含 `variants.dark`。
        *   一个自定义彩色主题 (如 `ocean-blue.json`): 包含 `variants.light` 和 `variants.dark`。

5.  **UI 组件:**
    *   **主题预设选择器**: 一个下拉菜单或列表，显示 `themeStore.availableThemes` 中的主题名称，选择后调用 `themeStore.selectThemePreset(id)`。
    *   **显示模式切换器**: 一个按钮或一组按钮，用于在 '浅色模式', '深色模式', '跟随系统' 之间切换，调用 `themeStore.setDisplayMode(mode)`。

6.  **代码梳理 (初步):**
    *   目标：将项目中的硬编码颜色或旧的 Tailwind 特定颜色类替换为使用新主题系统中定义的语义化颜色类。
    *   **已迁移/部分迁移的组件 (截至 `2a3c9ab` 及后续工作):**
        *   [`apps/frontend-vueflow/src/components/common/BaseModal.vue`](apps/frontend-vueflow/src/components/common/BaseModal.vue:1) (完成)
        *   [`apps/frontend-vueflow/src/components/graph/inputs/ButtonInput.vue`](apps/frontend-vueflow/src/components/graph/inputs/ButtonInput.vue:1) (完成)
        *   [`apps/frontend-vueflow/src/components/graph/sidebar/SidebarManager.vue`](apps/frontend-vueflow/src/components/graph/sidebar/SidebarManager.vue:1) (完成)
        *   [`apps/frontend-vueflow/src/views/HomeLayout.vue`](apps/frontend-vueflow/src/views/HomeLayout.vue:1) (完成)
        *   [`apps/frontend-vueflow/src/components/common/CascadingMenu.vue`](apps/frontend-vueflow/src/components/common/CascadingMenu.vue:1) (完成)
        *   [`apps/frontend-vueflow/src/components/common/EditorContextMenu.vue`](apps/frontend-vueflow/src/components/common/EditorContextMenu.vue:1) (完成)
        *   [`apps/frontend-vueflow/src/components/common/MarkdownRenderer.vue`](apps/frontend-vueflow/src/components/common/MarkdownRenderer.vue:1) (通过 [`apps/frontend-vueflow/src/assets/styles/shared.css`](apps/frontend-vueflow/src/assets/styles/shared.css:1) 实现基础元素主题化，完成)
        *   [`apps/frontend-vueflow/src/components/common/Tooltip.vue`](apps/frontend-vueflow/src/components/common/Tooltip.vue:1) (完成)
        *   [`apps/frontend-vueflow/src/components/common/RichCodeEditor.vue`](apps/frontend-vueflow/src/components/common/RichCodeEditor.vue:1) (完成)
    *   **待处理组件范围 (下一步):**
        *   所有在 commit `2a3c9ab` 中初步迁移的组件均已复查并完成迁移。
        *   需要进一步梳理项目，识别其他需要迁移到新主题系统的组件。
        *   ... (后续根据实际情况添加更多组件)

### 阶段二：颜色自定义与用户主题

**目标：** 允许用户通过颜色拾取器修改当前主题的核心颜色，并将自定义结果保存为用户主题。

1.  **UI 组件 - 颜色拾取器:**
    *   在设置界面中，为阶段一定义的核心 CSS 变量（`--ct-primary` 等）提供颜色拾取器。
    *   颜色拾取器的值改变时，实时调用 `document.documentElement.style.setProperty(variableName, newValue)` 更新 CSS 变量，并更新 `themeStore` 中当前活动主题（可能是个临时状态）的对应变量值。
2.  **`themeStore` 扩展:**
    *   增加 `currentUserCustomization: Ref<CssVariableMap | null>` 状态，用于暂存用户通过拾取器做的修改。
    *   `applyCurrentTheme()` 需要考虑 `currentUserCustomization` 并优先应用它。
    *   实现 `saveUserTheme(name: string)`:
        *   基于当前应用的主题预设和 `currentUserCustomization` 创建一个新的 `ThemePreset` 对象。
        *   **通过 `FAMService` (文件与资产管理服务) 将其保存到用户的个人主题库中。对应的逻辑路径为 `user://library/themes/{themeId}.json`，物理路径大致为 `ComfyTavern/userData/{userId}/library/themes/{themeId}.json` (具体由 `FAMService` 解析)。**
        *   将其元数据（或完整内容，取决于加载策略）存入 `userCustomThemes` 状态。
        *   更新 `availableThemes` 以包含用户主题（通常在下次从文件系统加载时刷新，或保存成功后立即添加）。
    *   实现 `deleteUserTheme(themeId: string)`: **需要通过 `FAMService` 删除对应的 `user://library/themes/{themeId}.json` 文件，并更新 `userCustomThemes` 和 `availableThemes` 状态。**
    *   实现 `updateUserTheme(themeId: string, updatedVariables: CssVariableMap)`: **需要通过 `FAMService` 更新对应的 `user://library/themes/{themeId}.json` 文件，并更新 `userCustomThemes` 和 `availableThemes` 状态中该主题的数据。**

### 阶段三：高级功能与打磨

**目标：** 实现主题导入/导出、自定义 CSS 覆盖、智能辅助色彩生成，并增加更多可配置项。

1.  **主题导入/导出:**
    *   **导入**: 提供文件选择框，读取用户上传的 JSON 主题文件，校验格式后，**通过 `FAMService` 保存到用户的个人主题库 (`user://library/themes/`)**，然后添加到 `userCustomThemes` 状态（或触发重新加载）并应用。
    *   **导出**: 允许用户选择一个主题（预设或自定义），将其 `ThemePreset` 对象序列化为 JSON 并提供下载。
2.  **自定义 CSS 覆盖:**
    *   提供一个文本输入区域供用户输入自定义 CSS。
    *   将用户输入的 CSS 字符串通过创建一个 `<style>` 标签并将其附加到 `<head>` 的方式动态应用。
    *   考虑作用域和基本的安全性（例如，是否需要清理或限制某些 CSS 规则）。
    *   自定义 CSS 应能覆盖主题变量和其他样式。
    *   保存用户输入的自定义 CSS (localStorage)。
3.  **智能辅助色彩生成:**
    *   当用户在颜色自定义界面设置了核心颜色（如主色 `--ct-primary`，可选辅色 `--ct-secondary`）后，提供“一键生成其余配色”功能。
    *   此功能将基于用户选择的核心颜色，利用色彩算法（届时需研究并可能集成如 Material Color Utilities 或类似原理的库）自动计算并填充主题中其他相关的 CSS 变量（如背景、文本、表面、边框等）。
    *   生成后，用户仍可对这些自动生成的颜色进行微调。
4.  **扩展可自定义项:**
    *   增加更多颜色变量的拾取器。
    *   根据参考截图，逐步添加对字体、边框圆角、间距、模糊效果等非颜色属性的自定义选项（这些也需要通过 CSS 变量控制）。
5.  **代码梳理 (全面):**
    *   系统性地检查整个项目，将所有可主题化的样式替换为使用 CSS 变量。
6.  **性能与体验优化:**
    *   确保主题切换流畅。
    *   优化大量 CSS 变量更新时的性能。

## 4. "跟随系统自动适配亮暗"的特别说明

正如之前讨论的，`ThemePreset` 结构中的 `variants: { light: ThemeVariant, dark: ThemeVariant }` 是实现此功能的关键。`themeStore` 的 `applyCurrentTheme()` 逻辑会负责根据用户选择的 `displayMode` ('system') 和实际的系统颜色偏好，来决定应用所选主题预设的 `light` 还是 `dark` 变体。

这意味着：
*   对于希望同时支持亮暗模式的自定义彩色主题，其 JSON 定义必须提供 `light` 和 `dark` 两套完整的 `variables`。
*   基础的“纯亮”或“纯暗”主题，其 JSON 中可以只包含对应模式的 `variables`。当在不匹配的系统模式下（例如系统暗色但选择了纯亮主题且显示模式为“跟随系统”）被选中时，应用可能需要一个回退机制，或者提示用户该主题不完全支持当前系统模式下的自动切换（或者直接应用其定义的单一模式）。更优的做法是，即使是“纯亮”主题，也为其 `dark` 变体提供一套合理的暗色化版本变量。

## 5. 未来展望

*   **主题市场/分享**：如果用户自定义主题功能受欢迎，可以考虑建立一个简单的平台供用户分享他们创建的主题。
*   **更细致的组件级主题定制**：允许对特定组件的样式进行更细微的调整。
*   **动态主题生成**：例如，根据用户上传的图片提取主色调来生成主题。

---