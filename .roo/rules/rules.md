## 开发要求

**AI 需要说中文** **AI 需要说中文** **AI 需要说中文** **AI 需要说中文** **AI 需要说中文** **AI 需要说中文** **AI 需要说中文** **AI 需要说中文**
**注释也要用中文** **注释也要用中文** **注释也要用中文** **注释也要用中文** **注释也要用中文** **注释也要用中文** **注释也要用中文** **注释也要用中文**

**中文相当重要**

**注意，如果你不确定文件是否存在，你应该先列出对应目录下的具体文件再读取，而不是直接读取假设存在的文件。改动任何文件前，先确认文件是否存在，如果存在，先读取内容，再进行修改。**

**需要用户提供信息时，需要使用一些工具来暂停 roo，如果什么工具都不使用，roo 会认为 AI 没有正确使用工具而重试，这会导致额外的 API 调用消耗**

## **禁止假设** **禁止假设** **禁止假设** **禁止假设** **禁止假设** **禁止假设** **禁止假设** **禁止假设** **禁止假设** **禁止假设**

- 禁止假设未经证实的文件内容或类型构造。

### **文档重构与修订内容完整性规范**

**核心原则：** **交付最终态，而非变更日志。** 输出的文档必须是完整的、自包含的、可直接使用的最终版本。

**行为约束规则：**

1.  **禁止在最终文档中使用摘要性、指代性或过程性描述。**

    - 在生成的目标文档中，严禁出现任何形式的、用于替代实际内容的描述性短语。
    - **黑名单（包括但不限于）：**
      - “保持不变”
      - “和旧版一致”
      - “内容不变，故省略”
      - “此部分无改动”
      - “其余部分同上”
    - **理由：** LLM 的职责是生成最终产物，而非撰写描述变更过程的元信息。最终用户需要的是一个可以直接复制、保存、发布的完整文件，而不是一份需要结合上下文手动还原的“补丁说明”。

2.  **强制输出完整内容。**
    - 当被要求根据旧版内容进行修改或重构时，对于所有未作变更的章节、段落或句子，必须将其**原文完整地**包含在最终输出的文档中。
    - 输出的每一部分都必须是实际内容，而不是对内容的引用或描述。

**示例场景：**

- **输入上下文：**

  - **旧版文档：**
    ```
    # 项目A文档
    ## 第一章：引言
    这是项目的引言部分。
    ## 第二章：核心功能
    这是核心功能的旧版描述。
    ## 第三章：附加功能
    这是附加功能的描述部分。
    ```
  - **用户指令：** “请更新项目 A 的文档，将第二章核心功能的描述修改为‘这是核心功能的全新升级版描述’。”

- **错误输出（需要被此规则禁止的行为）：**

  ```
  # 项目A文档
  ## 第一章：引言
  （内容保持不变）
  ## 第二章：核心功能
  这是核心功能的全新升级版描述。
    ## 第三章：附加功能
  （内容保持不变）
  ```

- **正确输出（此规则要求的目标行为）：**
  ```
  # 项目A文档
  ## 第一章：引言
  这是项目的引言部分。
  ## 第二章：核心功能
  这是核心功能的全新升级版描述。
  ## 第三章：附加功能
  这是附加功能的描述部分。
  ```

## 项目说明

**定位**：一个面向创作者和最终用户的 AI 创作与应用平台。它不仅提供强大的可视化节点编辑器（VueFlow），让创作者能够灵活编排复杂的 AI 工作流，更核心的是，它致力于将这些工作流封装成易于使用、面向特定场景的**交互式应用面板（或称“迷你应用”）**。这些应用面板（例如：AI 聊天机器人、互动故事生成器、自动化数据处理工具、创意内容辅助等）使得最终用户无需理解底层节点逻辑，即可直接体验和使用 AI 功能。平台兼具开发者友好的扩展性，支持自定义节点和未来可能的应用面板开发。

技术栈：

- **前端**： Vue 3 + Vite + TypeScript + VueFlow
  - VueFlow 提供可视化节点画布，用于直观的逻辑编排。
  - Vite 确保快速开发和构建体验。
  - TypeScript 提升代码可靠性。
- **后端**： Elysia (基于 Bun)
  - 高性能服务端框架，优化节点执行效率和前后端通信的响应速度。
- **核心依赖**： Bun（运行时）+ 自定义节点集成

### 核心特性与用户体验

ComfyTavern 的核心价值主张体现在以下两个层面：

1.  **面向创作者的强大工作流编排**：

    - 提供基于 VueFlow 的可视化节点编辑器，支持灵活创建、修改和管理 AI 工作流。
    - 丰富的内置节点和易于扩展的自定义节点能力，满足多样化的创作需求。

2.  **面向最终用户的即用型 AI 应用面板**：
    - **这才是 ComfyTavern 的主要用户体验方向，尤其是在移动端。**
    - 创作者可以将复杂的工作流封装成独立的、具有特定用户界面的“应用面板”（类似于小程序或插件化应用）。
    - 这些应用面板为最终用户提供直接、友好的交互界面，隐藏了底层工作流的复杂性。
    - **示例场景（不限于此，鼓励用户自定义）**：
      - **AI 聊天机器人**：提供丰富的角色扮演和对话体验（可参考 SillyTavern 等应用的交互模式）。
      - **互动叙事/视觉小说**：根据用户选择或输入，动态生成故事内容和分支。
      - **创意辅助工具**：如图像风格迁移、文本摘要、代码片段生成等。
      - **轻量级游戏或模拟器**：由 AI 工作流驱动核心逻辑。
      - **自动化任务助手**：例如数据抓取与处理、内容聚合等。
    - 目标是让用户能够“即开即用”地享受 AI 功能，而不仅仅是编辑节点。

## 开发说明

- 开发服务器通常运行在：
  - 前端: `http://localhost:5573/`
  - 后端: `http://localhost:3233/`
  - 我通常会保持开发服务器的运行，并在浏览器中打开对应的地址，以便实时查看效果。
- **开发环境**: Windows, VSCode。
- **终端**: VSCode 启动的终端是 PowerShell。
  - 使用 PowerShell 命令。
  - 不支持 `&&` 连接命令，请使用分号 `;` 或分多次执行。
  - 启动 `.bat` 文件需要添加 `.\` 前缀，例如 `.\start.bat`。
- **后端入口**: `apps/backend/src/index.ts` (已重构，具体路由见 `apps/backend/src/routes/`)
- **核心类型定义**: `packages/types/src/schemas.ts` (使用 Zod 定义和验证)
- **节点或插槽的显示**：优先使用`displayName`,其次再是 id。

## 参考资料

- `docs` 目录：包含计划、笔记、想法等 Markdown 文件。
- `z参考`：参考资料目录，就在当前项目根目录中，z 并不是盘符，而是为了在文件列表中排序到底部。
- `z参考/SillyTavern`：SillyTavern 克隆，参考提示词结构。
- `z参考/ComfyUI_frontend`：ComfyUI 前端项目，参考风格。
- `z参考/ComfyUI`：ComfyUI 主项目，参考 API。
- `z参考/VueFlow`：VueFlow 官方文档。
- `z参考/a目录.md`：参考资料的目录结构。
- `z参考/elysia`：Elysia 项目，基于 Bun 的高性能服务端框架。

## 代码规范

### 1. TypeScript 使用规范

- 优先使用接口（`interface`）而非类型别名（`type`），除非确实需要 `type` 的特性（如联合类型、交叉类型等）。
- 避免使用 `enum`，推荐使用 `as const` 对象或 `Map` 代替，以获得更好的类型安全性和灵活性。
- 为所有组件的 props 和 emits 添加完整的类型定义。
- 节点类必须实现完整的类型定义，包括输入、输出、配置选项，并提供 Zod Schema 进行验证。
- 充分利用 TypeScript 的类型推断和检查功能，保证类型安全。

### 2. Vue 3 开发规范

- 统一使用 Composition API 的 `<script setup>` 语法。
- 使用 `ref` 和 `reactive` 管理响应式状态，注意区分场景。
- 使用 `computed` 处理派生状态，保持模板逻辑简洁。
- 使用 `watch` 和 `watchEffect` 处理副作用，注意清理副作用。
- 使用 `onMounted`, `onUpdated` 等生命周期钩子管理组件生命周期。
- 合理使用 `provide`/`inject` 进行跨层级组件通信或依赖注入。
- 积极使用 [VueUse](https://vueuse.org/) 提供的工具函数，简化开发，提升性能。
- 实现适当的错误边界（Error Boundaries）处理用户界面错误。
- 遵循 Vue 3 官方推荐的命名约定和样式指南。
- 在需要将内容渲染到 DOM 不同位置时，使用 `Teleport` 组件。
- 使用 `Suspense` 组件优雅地处理异步组件加载。

### 3. 性能优化规范

- 对大型、深度嵌套或不常变更的对象使用 `shallowRef` 或 `shallowReactive` 减少响应式开销。
- 对不需要响应式的对象使用 `markRaw` 标记，避免不必要的 Proxy 转换。
- 利用 `Suspense` 进行代码分割和异步组件加载优化。
- 实现非关键组件的动态导入（`defineAsyncComponent`）。
- 优化图片资源：使用现代格式（如 WebP, AVIF）、提供 `width`/`height` 属性、实现懒加载。
- 优化 Vite 构建配置：合理分包（chunk splitting）、Tree Shaking。
- 画布渲染优化：虚拟滚动、按需渲染、帧率控制（`requestAnimationFrame`）。

### 4. 文件组织规范

- 目录名使用短横线分隔的小写单词（kebab-case），例如：`node-types`, `utility-functions`。
- 文件名使用帕斯卡命名法（PascalCase）或小驼峰命名法（camelCase），根据文件类型（如组件用 PascalCase，工具函数用 camelCase）保持一致。
- 遵循单一职责原则，每个文件只包含高度相关的内容。
- 优先使用命名导出（`export const ...`）而非默认导出（`export default ...`），以提高导入时的清晰度和可重构性。
- 推荐的项目结构（可根据实际情况调整）：

```
src/
  ├── App.vue           # 应用根组件
  ├── main.ts           # 应用入口文件
  ├── assets/           # 静态资源 (图片, 字体等)
  ├── components/       # 通用 Vue 组件
  │   └── common/       # 基础通用组件
  │   └── layout/       # 布局组件
  ├── composables/      # Vue Composition API 函数 (Hooks)
  ├── constants/        # 常量定义
  ├── router/           # 路由配置 (vue-router)
  │   └── index.ts
  ├── services/         # API 服务层 (数据请求)
  ├── stores/           # 状态管理 (Pinia)
  ├── styles/           # 全局样式和 CSS 变量
  ├── types/            # TypeScript 类型定义 (共享类型)
  ├── utils/            # 通用工具函数
  └── views/            # 页面级组件 (路由视图)
```

### 5. 状态管理规范 (Pinia)

- 使用 Pinia 进行集中式状态管理。
- 保持 Store 的职责单一，每个 Store 管理应用的一个特定领域或功能的状态。
- 合理使用 Getters (`computed` 属性) 处理派生状态，避免在组件中重复计算。
- 按需实现状态持久化（例如使用 `pinia-plugin-persistedstate`）。
- 优化 Store 性能：避免在 Store 中存储大量非必要响应式数据，考虑使用 `shallowRef` 或 `markRaw`。

### 6. 节点开发规范

- 为节点定义清晰、完整的输入、输出和配置项。
- 使用 Zod Schema (`packages/types/src/schemas.ts`) 对节点数据结构进行严格验证。
- 设计节点时考虑向后兼容性，避免破坏性更新。
- 优化节点执行逻辑的性能，特别是在后端。
- 为自定义节点提供清晰的文档说明和使用示例。
- 实现客户端逻辑脚本 (`clientScriptUrl`) 时，确保脚本轻量且安全。

### 7. WebSocket 通信规范

- 后端使用 `@elysiajs/websocket`（已集成到 Elysia 核心）。
- 实现健壮的连接管理：心跳检测、自动重连、错误处理。
- 根据需要实现消息队列和重试机制，确保消息传递的可靠性。
- 优化消息格式（如使用 MessagePack 或 Protobuf）和传输效率，减少网络负载。
- 设计清晰的状态同步协议，确保前后端状态一致。

### 8. 样式规范 (Tailwind CSS)

- 项目统一使用 Tailwind CSS 进行样式开发。
- 利用 Tailwind 的功能类（Utility Classes）快速构建界面。
- 使用 Tailwind 的响应式修饰符（如 `md:`, `lg:`）实现响应式设计。
- 对于可复用的样式组合，考虑使用 `@apply` 指令抽取到 CSS 文件中，或创建 Vue 组件封装样式，但避免过度使用 `@apply` 导致样式难以维护。
- 配置 `tailwind.config.js` 定制主题（颜色、字体、间距等）。

### 9. 其他工具与实践

- **构建工具**: 使用 Vite 进行开发和构建，利用其快速冷启动和 HMR 优势。
- **实用工具库**: 可以使用 Lodash 或 Ramda 等库提供常用的工具函数，但优先考虑原生 JavaScript 或 VueUse 是否能满足需求。
- **错误处理**: 实现全局和局部的错误处理机制，提供友好的用户反馈。
- **代码格式化与检查**: 使用 Prettier 和 ESLint/Hint 强制执行代码风格和规范。
- **代码检查**: `bunx vue-tsc --build apps/frontend-vueflow/tsconfig.json`,`bun tsc -p apps/backend/tsconfig.json --noEmit`
- **通用类型导入**：`@comfytavern/types`是通用类型的导入路径，通过`index.ts`统一注册了所有通用类型定义。
- **工作流数据转换**：我们以画布数据为单一事实来源的，这个`workflowTransformer.ts`转换仅保存/加载和创建执行负载才会用。

### 10. Tooltip 使用规范 (v-comfy-tooltip)

为了优化性能并统一管理 Tooltip，项目引入了全局 Tooltip 服务。对于简单的静态文本提示，推荐使用 `v-comfy-tooltip` Vue 指令。

- **核心组件与状态管理**:

  - 全局状态由 [`apps/frontend-vueflow/src/stores/tooltipStore.ts`](apps/frontend-vueflow/src/stores/tooltipStore.ts:1) 管理。
  - Tooltip 的渲染由全局唯一的 [`apps/frontend-vueflow/src/components/common/TooltipRenderer.vue`](apps/frontend-vueflow/src/components/common/TooltipRenderer.vue:1) 组件负责。
  - 指令逻辑位于 [`apps/frontend-vueflow/src/directives/vComfyTooltip.ts`](apps/frontend-vueflow/src/directives/vComfyTooltip.ts:1)。
  - 指令已在 [`apps/frontend-vueflow/src/main.ts`](apps/frontend-vueflow/src/main.ts:1) 中全局注册为 `comfy-tooltip`。

- **基本用法**:

  1.  **简单文本提示**:

      ```html
      <button v-comfy-tooltip="'这是一个简单的提示'">按钮</button>
      ```

  2.  **带配置的提示**:
      ```html
      <div
        v-comfy-tooltip="{
        content: '这是一个更复杂的提示',
        placement: 'top-start',
        delayShow: 500,
        interactive: true,
        showCopyButton: true,
        maxWidth: '400px'
      }"
      >
        Hover Me
      </div>
      ```

- **配置选项**:
  主要的配置选项可以在 [`apps/frontend-vueflow/src/stores/tooltipStore.ts`](apps/frontend-vueflow/src/stores/tooltipStore.ts:1) 中的 `DEFAULT_TOOLTIP_OPTIONS` 和 `TooltipOptions` 接口查看，例如：

  - `content: string` (必需，除非指令值直接是字符串)
  - `placement: Placement` (可选, e.g., 'top', 'bottom', 'left', 'right', 'top-start', etc.)
  - `delayShow: number` (可选, 毫秒)
  - `delayHide: number` (可选, 毫秒)
  - `interactive: boolean` (可选, Tooltip 是否可交互)
  - `showCopyButton: boolean` (可选, 是否显示复制按钮)
  - `triggerType: 'hover' | 'click' | 'focus' | Array<'hover' | 'click' | 'focus'>` (可选, 触发方式)
  - `maxWidth: string | number` (可选, 最大宽度)
  - `offsetValue: number` (可选, 偏移量)

- **适用场景**:
  - 主要用于替换原先大量独立使用的 `<Tooltip>` 组件实例，特别是内容简单、静态或易于作为字符串处理的场景。
  - 对于内容结构复杂、高度依赖当前组件上下文的 Tooltip（如 Handle 提示），可能仍需评估是否适用或需要特殊处理。

## CONVERTIBLE_ANY 类型详细说明

本部分详细解释 `CONVERTIBLE_ANY` 类型的行为特性，主要供 AI 系统理解及开发者参考。

### `CONVERTIBLE_ANY` (`BEHAVIOR_CONVERTIBLE`) 的特性与应用

`CONVERTIBLE_ANY` 类型（通常带有 `BEHAVIOR_CONVERTIBLE` 标签，并在 UI 上显示为 `*`）是为提升连接便利性而设计的特殊类型。其核心行为和规则如下：

- **彻底的类型转换**：

  - 当一个 `CONVERTIBLE_ANY` 输入插槽连接到一个具有具体类型的输出插槽时，该 `CONVERTIBLE_ANY` 输入插槽会**彻底转变为**所连接输出插槽的类型（包括其 `dataFlowType` 和 `matchCategories`，但不包括 `BEHAVIOR_CONVERTIBLE` 标签本身）。
  - 类似地，当一个 `CONVERTIBLE_ANY` 输出插槽连接到一个具有具体类型的输入插槽时，该 `CONVERTIBLE_ANY` 输出插槽也会**彻底转变为**所连接输入插槽的类型。
  - 这种转换是**完全的、无痕迹的**。一旦转换完成，该插槽就表现得如同它从一开始就是那个新的具体类型，不再保留任何 `CONVERTIBLE_ANY` 的特性或状态。

- **禁止 `CONVERTIBLE_ANY` 互连**：

  - 两个 `CONVERTIBLE_ANY` 类型的插槽（例如，一个 `CONVERTIBLE_ANY` 输出连接到另一个 `CONVERTIBLE_ANY` 输入）**不能直接相互连接**。这是因为双方都需要从对方获取一个具体的类型来完成自身的转换，如果双方都是 `CONVERTIBLE_ANY`，则无法确定转换的目标类型，连接无法成立。

- **动态占位符再生机制（特定场景）**：

  - 在某些特定节点或内部机制下，例如组 IO 节点（`core:GroupInput` / `core:GroupOutput`）在其所属节点组的内部接口定义（`groupInterface`）中，当一个 `CONVERTIBLE_ANY` 插槽被连接并（如上所述）彻底转换类型后，系统会**动态生成一个新的 `CONVERTIBLE_ANY` 占位符插槽添加到插槽末尾**。
  - 这个新生成的占位符是为了保持连接的便利性，确保总有一个可用的“万能连接点”供下一次灵活连接，而用户无需手动创建。重要的是，这个新生成的占位符与那个已被彻底转换的插槽是两个不同的实体。

- **针对节点组（`core:NodeGroup`）的外部接口行为**：
  - **外部接口的类型确定性**：节点组节点（`core:NodeGroup`）在父工作流中向外部暴露的连接插槽，其类型来源于其内部引用的子工作流中的 `GroupInput` 和 `GroupOutput` 节点。
  - **`CONVERTIBLE_ANY` 在外部的“不可见性”**：`NodeGroup` 节点在显示插槽时会过滤掉 `CONVERTIBLE_ANY`（即 `*`）插槽。`CONVERTIBLE_ANY` 作为一个可操作的、等待连接的类型，在 `NodeGroup` 节点的外部接口上是“不可见”且“无持久值”的。其“彻底转换”和“动态占位符再生”机制主要服务于节点组内部接口定义的灵活性和连接便利性。

## `apply_diff` 工具报错排查：`marker '=======' found`

当 `apply_diff` 工具报告如下错误时：

```
ERROR: Diff block is malformed: marker '=======' found in your diff content at line X.
```

这通常意味着在 `REPLACE` 代码块内部错误地包含了 `=======` 标记。`REPLACE` 块应当只包含目标代码行，不应含有任何 `diff` 分隔符。

**特殊情况与排查：**

如果经过检查，你确认 `REPLACE` 块的内容是纯净的（即，确实没有多余的 `=======` 标记在**内部**），那么此报错**可能指示了更深层次的 `diff` 块结构问题，特别是块未正确闭合**。

**可能的原因：**

- 模型生成 `diff` 输出时发生截断。
- 模型未能正确输出 `diff` 块的起始或结束标记（例如，`<<<<<<<`、`=======`、`>>>>>>>` 未正确配对，或者 `START_REPLACE` / `END_REPLACE` 等自定义标记缺失或错位）。

**处理建议：**

1.  **首要检查 `REPLACE` 内部**：确保 `REPLACE` 块内绝对没有 `=======`。
2.  **检查 `diff` 块完整性**：如果 `REPLACE` 内部无误，请仔细核对整个 `diff` 块的结构。确认所有的 `diff` 标记（如 `<<<<<<< HEAD`，`=======`，`>>>>>>> BRANCH_NAME`，或工具特定的 `START_BLOCK`/`END_BLOCK` 标记）都已正确、完整地闭合。不完整的 `diff` 块会导致解析器误判，即使 `REPLACE` 内部是干净的，也可能因为外部结构错误而报类似的错误。
