## 开发要求

**AI 需要说中文** **AI 需要说中文** **AI 需要说中文** **AI 需要说中文** **AI 需要说中文** **AI 需要说中文** **AI 需要说中文** **AI 需要说中文**
**注释也要用中文** **注释也要用中文** **注释也要用中文** **注释也要用中文** **注释也要用中文** **注释也要用中文** **注释也要用中文** **注释也要用中文**
**中文相当重要**
**注意，如果你不确定文件是否存在，你应该先列出对应目录下的具体文件再读取，而不是直接读取假设存在的文件。改动任何文件前，先确认文件是否存在，如果存在，先读取内容，再进行修改。**
**需要用户提供信息时，需要使用一些工具来暂停 roo，如果什么工具都不使用，roo 会认为 AI 没有正确使用工具而重试，这会导致额外的 API 调用消耗**

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
- **代码检查**: `bun tsc -p apps/frontend-vueflow/tsconfig.json --noEmit`,`bun tsc -p apps/backend/tsconfig.json --noEmit`
- **自动化总结提交**：按照 @/.clinerules 中的风格在其中追加精简版记录。然后再创建正式的提交信息。 @git-changes

## 项目进度 - 每次提交前在此追加精简版记录

- **前端 VueFlow 分支**:
  - 完成了项目初始化、配置和基础结构搭建。
  - 更新了启动脚本，支持多种前端启动方式。
  - 添加了基础页面布局、角色卡（支持 PNG 提取）、主题切换、右键菜单、节点库侧边栏（支持搜索、预览、拖拽添加）、后端节点加载等功能。
  - 添加了后端测试节点和前端基础输入组件（包括 CodeInput），并集成到画布，支持动态渲染、输入管理和布局优化。
  - 重构了节点组件 (`BaseNode`)，优化了状态管理、拖拽体验、暗色模式、插槽显示（悬停提示、对齐、多行文本框交互修复）。
  - 拆分了画布连线逻辑 (`useCanvasConnections`)，修复了连线移除和类型检查问题。
  - 优化了节点标题显示、自动宽度计算、滚动条样式和插槽间距。
  - 添加了节点输入插槽的类型兼容规则。
  - 实现了多对一输入插槽功能。
  - 添加了文本显示组件、后端节点重载功能，修复了节点名称/描述显示，优化了节点预览面板和侧边栏管理。
  - 添加了工作流保存/加载/导入导出功能，解决了文件名和节点 ID 问题，添加了启动画面。
  - 引入了按钮输入类型和示例节点。
  - 添加了节点引擎部分实现（未完成）。
  - 引入了标签页系统和初步的节点组功能（内嵌/引用模式），更新了状态管理、快捷键和构建配置。
  - 重构了 `workflowStore` 和 `BaseNode` 组件，拆分逻辑到 Composables。
  - 后端改用 Zod 进行数据验证。
  - 实现了节点的客户端逻辑执行功能。
  - 优化了前端状态管理 (`nodeStore` 重构为 Pinia 标准写法)。
  - 允许节点定义指定首选宽度，添加了插槽右键菜单删除连线，优化了 Tooltip 样式。
- **项目结构与核心功能重构**:

  - 引入“工程”（Project）概念重构项目结构，按工程管理资源。
  - 修复了因子组件 Props 不稳定导致的递归更新错误。
  - 添加了强制保存节点组接口更改的事件机制，确保状态同步。

- **核心重构：节点组与工作流接口** - 借鉴 Blender 几何节点，重构了节点组功能。引入中心化的工作流接口定义（存储在 `WorkflowObject` 的 `interfaceInputs`/`Outputs` 中），侧边栏 (`GroupIOEdit.vue`) 成为接口管理的唯一入口。`GroupInput`/`Output` 节点现在是视觉“幻影”节点，其插槽动态反映中心接口。更新了类型系统，引入 `WILDCARD` 和 `CONVERTIBLE_ANY` 处理动态插槽。重构了连接逻辑 (`useCanvasConnections.ts`) 和插槽计算 (`useGroupIOSlots.ts`)，修复了相关 bug (详见 `docs/fix-groupio-initial-slot-disappearance.md`)。添加了接口同步机制 (`useGroupInterfaceSync.ts` 和相关事件如 `force-save-interface-changes`) 以确保状态一致性。

- **多项目管理与视图重构**: 引入了多项目管理功能，允许用户创建、加载和管理多个工作流项目。新增了项目列表视图 (`ProjectListView`) 和角色卡视图 (`CharacterCardView`)。主页 (`HomeView`) 被重构为概览页面，展示项目和角色卡预览。更新了相关状态管理 (`projectStore`, `tabStore`, `workflowStore`) 和路由以支持新架构。调整了侧边栏导航，移除了旧的工具栏。

- **后端 index.ts 重构**：将节点 API、全局工作流 API、项目 API 和 WebSocket 处理逻辑分别拆分到了 routes/nodeRoutes.ts、routes/workflowRoutes.ts、routes/projectRoutes.ts 和 websocket/handler.ts 模块中。将工作流和项目目录的路径配置集中到了 config.ts 文件。将项目相关的辅助函数提取到了 services/projectService.ts 文件。index.ts 文件现在更加简洁，主要负责初始化、中间件应用和模块挂载。整体代码结构更加清晰，易于维护。
- **URL 加载与状态重构**: 通过 URL 加载工作流，重构核心状态管理 (`workflowStore`)，添加项目元数据更新接口，优化前端视图 (`HomeView`, `EditorView`) 和路由。
- **workflowStore 重构**: 将庞大的 `workflowStore` 拆分为多个职责单一的 Composables (`useWorkflowState`, `useWorkflowCoreLogic`, `useWorkflowViewManagement`, `useWorkflowInterfaceManagement` 等)，将共享类型移至 `types/workflowTypes.ts`，更新了相关 Composables。
- **核心状态管理重构与插件系统规划**: 再次重构 `workflowStore`，引入 `useWorkflowManager` 集中管理核心状态、历史记录和应用逻辑，解决先前拆分导致的同步问题；新增插件系统设计文档，规划了基于 `plugin.json` 的扩展架构；优化了部分 UI 组件（如 `BooleanToggle`）并支持动态输入组件注册；更新和整理了相关文档。

- 修复了历史记录和状态管理相关 bug，修复了快捷键。增加了历史记录侧边面板，允许跳转记录、撤销/重做操作。
- 通过重构 WebSocket 连接管理，将其改为全局单例模式，并解耦节点按钮点击事件的处理，修复了在撤销/重做操作时因节点重建导致大量 WebSocket 连接断开和重连的问题。现在点击历史记录项不再触发异常的 WebSocket 活动。
- 重构了节点操作（添加、移动）与历史记录逻辑，将其集中到 `workflowStore` 中，并优化了节点添加时的定位逻辑；增强了画布和核心状态管理的调试日志。
- 将 `apps/frontend-vueflow/src/views/EditorView.vue` 中的逻辑重构到多个独立的 composable 文件中：`useRouteHandler.ts`, `useCanvasInteraction.ts`, `useTabManagement.ts`, `useInterfaceWatcher.ts`, `useKeyboardShortcuts.ts`, 和 `useEditorState.ts`。这使得 `EditorView.vue` 组件更加简洁，专注于视图渲染和协调，提高了代码的可维护性和可读性。
- 对 apps/frontend-vueflow/src/composables 目录下的模块进行了分组（Canvas、Node、Group、Workflow、Editor），提高可读性。
- **状态与历史重构**: 引入交互与生命周期协调器 (`WorkflowInteractionCoordinator`, `WorkflowLifecycleCoordinator`) 重构 `workflowStore`，统一处理画布交互、生命周期和历史记录；添加 Markdown 支持 (`MarkdownRenderer`) 和相关依赖；改进组 IO 管理 (`useGroupIOActions`, `useGroupIOState`)；优化保存流程 (`promptAndSaveWorkflow`) 和侧边栏交互 (`Tooltip`)。
- 增强工作流组功能(creationMethod, referencedWorkflows), 重构历史记录为结构化对象, 添加节点组件状态存储。
- **状态与历史重构 - 其二**: 引入交互与生命周期协调器，重构历史记录为结构化对象，优化输入组件交互与历史记录触发，添加节点组件状态存储。
- **前端执行准备**: 完善了前端触发工作流执行、处理后端状态/错误消息、可视化节点状态/错误以及处理按钮点击交互的核心功能，为对接后端执行引擎奠定基础。
- **节点交互与样式优化**: 强制更新节点以响应 IO 顺序变化；重构 Handle 样式，支持主题和多类型；增强输入定义（默认值、范围）；修复历史记录中移除保存点时的索引 Bug；新增后端驱动预览方案文档。
- **历史记录重构**: 将历史记录从字符串标签重构为结构化的 `HistoryEntry` 对象，更新相关类型、工具和前端模块。
- **节点配置与组引用重构**: 重构了节点配置更新 (`useWorkflowInteractionCoordinator`) 和节点组引用更新 (`useWorkflowGrouping`) 的逻辑，确保与结构化历史记录 (`HistoryEntry`) 和状态管理 (`setElements`) 正确集成，修复了接口同步、边移除及输入组件更新触发等相关问题。
- **工作流重命名与 NodeGroup 修复**: 实现工作流重命名功能（前后端）；修复 NodeGroup 加载 `referencedWorkflowId` 和过滤 `CONVERTIBLE_ANY` 插槽的 Bug；更新历史记录文档，新增执行计划文档。
- 更新了节点类型文档。
- 更新了浮动文本预览窗口计划并优化后端驱动预览功能文档。添加了节点自环检查，防止节点输出连接到自身的输入上。
- **工作流数据重构:** 重构工作流数据结构，引入 WorkflowStorage* 和 Execution* 类型，优化存储（仅存差异值、Nano ID），统一默认值处理 (getEffectiveDefaultValue)，分离存储与执行关注点，更新相关类型、工具库、前后端适配（执行逻辑暂缓）。版本升至 0.0.5。
- 删除老旧的`apps\frontend`目录，并更新了启动脚本。
- 修复一些遗漏的类型定义和文档。
- **节点命名空间**: 引入节点命名空间 (`namespace`) 机制，重构后端节点加载/注册逻辑 (`NodeLoader`, `NodeManager`)，更新核心类型 (`NodeDefinition`)，并适配前端 (`nodeStore`, `EditorView`) 以支持完整的 `namespace:type` 节点标识。
- **工作流执行引擎**: 实现后端执行引擎核心逻辑（API、WebSocket、并发控制），并适配前端以支持执行状态显示与交互。
- **UI 组件增强**: 优化 Tooltip (添加复制按钮、滚动条) 和 SuggestionDropdown (添加搜索、滚动条)，并应用于节点标题和历史记录面板。
- **调试与优化**: 清理前端调试日志；修复 NodeGroup 类型判断（使用命名空间）；优化 Tooltip 组件。
- **节点扩展与优化**: 新增 LLM、加载器（角色卡、历史、预设等）和处理器（正则、上下文构建）后端节点；优化前端加载动画；更新 LLM 适配器文档。
