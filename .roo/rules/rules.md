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

### 11. 对话框与通知服务规范 (DialogService)

`DialogService` ([`apps/frontend-vueflow/src/services/DialogService.ts`](apps/frontend-vueflow/src/services/DialogService.ts:1)) 是一个全局服务，用于在前端应用中显示模态对话框和非模态通知。它通过 Pinia store (`useDialogService`) 提供。

#### 11.1 服务引入与使用

首先，在你的 Vue 组件或 Composable 中引入服务：

```typescript
import { useDialogService } from '@/services/DialogService'; // 路径根据实际项目结构调整

const dialogService = useDialogService();
```

#### 11.2 对话框 (Dialogs)

对话框是模态的，会覆盖在页面内容之上，需要用户交互后才能关闭。服务管理一个对话框队列，一次只显示一个。

##### 11.2.1 `showMessage(options: UniversalDialogOptions): Promise<void>`

显示一个简单的消息对话框，通常只有一个“确定”按钮。

-   **`options`**: [`UniversalDialogOptions`](apps/frontend-vueflow/src/services/DialogService.ts:14)
    -   `title?: string` (默认: '消息')
    -   `message?: string` (必需)
    -   `confirmText?: string` (默认: '确定')
    -   `showCloseIcon?: boolean` (默认: `true`)
    -   `closeOnBackdrop?: boolean` (默认: `true` for message)
    -   `autoClose?: number` (毫秒, 0 表示不自动关闭, 默认: 0)
-   **返回**: `Promise<void>`，当对话框关闭时 resolve。

**示例**:

```typescript
async function showInfoMessage() {
  try {
    await dialogService.showMessage({
      title: '提示',
      message: '操作已成功完成。'
    });
    console.log('消息框已关闭');
  } catch (error) {
    // 通常 showMessage 不会 reject，除非内部导入组件失败
    console.error('显示消息框失败:', error);
  }
}
```

##### 11.2.2 `showConfirm(options: UniversalDialogOptions): Promise<boolean>`

显示一个确认对话框，通常有“确定”和“取消”按钮。

-   **`options`**: [`UniversalDialogOptions`](apps/frontend-vueflow/src/services/DialogService.ts:14)
    -   `title?: string` (默认: '确认')
    -   `message?: string` (必需)
    -   `confirmText?: string` (默认: '确定')
    -   `cancelText?: string` (默认: '取消')
    -   `showCancelButton?: boolean` (默认由 Dialog.vue 内部根据 type='confirm' 控制显示)
    -   `showCloseIcon?: boolean` (默认: `true`)
    -   `closeOnBackdrop?: boolean` (默认: `false` for confirm)
    -   `dangerConfirm?: boolean` (默认: `false`, 确认按钮是否为危险操作样式)
-   **返回**: `Promise<boolean>`，用户点击“确定”时 resolve `true`，点击“取消”或关闭时 resolve `false`。

**示例**:

```typescript
async function confirmDeletion() {
  const confirmed = await dialogService.showConfirm({
    title: '确认删除',
    message: '您确定要删除这条记录吗？此操作不可撤销。',
    dangerConfirm: true,
    confirmText: '删除',
  });

  if (confirmed) {
    console.log('用户确认删除');
    // 执行删除操作
  } else {
    console.log('用户取消删除');
  }
}
```

##### 11.2.3 `showInput(options: UniversalDialogOptions): Promise<string | null>`

显示一个带输入框的对话框。

-   **`options`**: [`UniversalDialogOptions`](apps/frontend-vueflow/src/services/DialogService.ts:14)
    -   `title?: string` (默认: '请输入')
    -   `message?: string` (可选，输入框上方的提示信息)
    -   `confirmText?: string` (默认: '确定')
    -   `cancelText?: string` (默认: '取消')
    -   `initialValue?: string` (默认: `''`)
    -   `inputPlaceholder?: string` (默认: '请输入内容...')
    -   `inputType?: 'text' | 'password' | 'number' | 'textarea'` (默认: `'text'`)
    -   `inputRows?: number` (当 `inputType` 为 `'textarea'` 时生效, 默认: 3)
-   **返回**: `Promise<string | null>`，用户点击“确定”时 resolve 输入的字符串，点击“取消”或关闭时 resolve `null`。

**示例**:

```typescript
async function requestUsername() {
  const username = await dialogService.showInput({
    title: '设置用户名',
    message: '请输入您的新用户名：',
    initialValue: '默认用户',
    inputPlaceholder: '至少3个字符',
  });

  if (username !== null) {
    console.log('用户输入:', username);
    // 处理用户名
  } else {
    console.log('用户取消输入');
  }
}
```

#### 11.3 通知 (Toasts)

通知（也称 Toasts）是短暂的、非模态的消息，通常用于显示操作结果或系统状态。它们会出现在屏幕的指定位置，并在一段时间后自动消失。

##### 11.3.1 `showToast(options: ToastOptions): string`

显示一个通用的通知。

-   **`options`**: [`ToastOptions`](apps/frontend-vueflow/src/services/DialogService.ts:36)
    -   `title?: string`
    -   `message: string` (必需)
    -   `type?: 'info' | 'success' | 'warning' | 'error'` (默认: `'info'`)
    -   `duration?: number` (毫秒, 默认: 3000)
    -   `position?: ToastPosition` (默认: `'top-right'`)
        -   `ToastPosition`: `'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'` ([`apps/frontend-vueflow/src/services/DialogService.ts:11`](apps/frontend-vueflow/src/services/DialogService.ts:11))
-   **返回**: `string`，通知的唯一 ID。

**示例**:

```typescript
dialogService.showToast({
  title: '更新成功',
  message: '您的个人资料已保存。',
  type: 'success',
  position: 'top-center',
  duration: 5000,
});
```

##### 11.3.2 便捷方法

为常见的通知类型提供了便捷方法：

-   `showSuccess(message: string, title?: string, duration?: number): string`
-   `showError(message: string, title?: string, duration?: number): string`
-   `showWarning(message: string, title?: string, duration?: number): string`
-   `showInfo(message: string, title?: string, duration?: number): string`

**示例**:

```typescript
dialogService.showSuccess('用户登录成功！');
dialogService.showError('网络连接失败，请稍后再试。', '错误');
```

#### 11.4 状态与组件

-   **状态管理**: 服务通过 Pinia store 管理对话框队列 (`dialogQueue`) 和当前活动对话框 (`activeDialog`)，以及通知列表 (`toasts`)。这些状态通常由服务内部管理，开发者无需直接操作。
-   **对话框组件**: 实际的对话框 UI 由 [`apps/frontend-vueflow/src/components/common/Dialog.vue`](apps/frontend-vueflow/src/components/common/Dialog.vue:1) 组件渲染，该组件由服务动态导入。
-   **通知组件**: 通知 UI 由 [`apps/frontend-vueflow/src/components/common/ToastNotification.vue`](apps/frontend-vueflow/src/components/common/ToastNotification.vue:1) 渲染，并通过 [`apps/frontend-vueflow/src/components/common/DialogContainer.vue`](apps/frontend-vueflow/src/components/common/DialogContainer.vue:1) 在应用顶层管理和显示。

#### 11.5 注意事项

-   **动态导入**: 对话框组件 (`Dialog.vue`) 是按需动态导入的，这意味着第一次调用相关 `show` 方法时可能会有轻微延迟。
-   **Promise 处理**: 所有 `showConfirm` 和 `showInput` 方法都返回 Promise，请确保正确处理其 `resolve` 和 `reject`（尽管 `reject` 场景较少，主要为组件加载失败）。`showMessage` 的 Promise 主要用于知道何时关闭。
-   **上下文**: 由于是全局服务，确保在合适的 Vue 上下文中使用（例如在 `setup` 函数或组件方法中）。

## Elysia.js 使用注意事项

### 插件中 `derive` 方法不执行的问题

- **现象**: 当一个 Elysia 插件被定义为一个独立的 Elysia 实例（例如 `const myPlugin = new Elysia().decorate(...).derive(...)`），并通过主应用的 `.use(myPlugin)` 来注册时，该插件内部的 `.derive()` 方法可能不会被执行。
- **排查**:
  - 确认插件已在主应用中正确 `.use()`。
  - 在插件的 `.derive()` 方法内部以及插件模块的顶层添加日志，确认模块是否加载、`derive` 是否进入。
  - 在主应用实例上直接使用 `.derive()` 添加一个简单的派生属性，以确认主实例的 `derive` 功能是否正常。
- **解决方案/推荐模式**:

  - 将插件的实现方式从一个独立的 Elysia 实例改为一个“函数式插件”。即，导出一个函数，该函数接收主 `app` Elysia 实例作为参数，并直接在该实例上调用 `.decorate()` 和 `.derive()` 等方法。
  - 示例：

    ```typescript
    // my-plugin.ts
    import { Elysia } from "elysia";
    // ... other imports

    export function applyMyPlugin(app: Elysia): Elysia {
      app.decorate("myService" /* ... */).derive(async (context) => {
        console.log("Functional plugin derive executed!");
        // ... 派生逻辑 ...
        return { derivedProperty: "value" };
      });
      return app;
    }

    // main-app.ts
    import { Elysia } from "elysia";
    import { applyMyPlugin } from "./my-plugin";

    const app = new Elysia();
    app.use(applyMyPlugin); // 或者 applyMyPlugin(app); 如果函数不返回 app
    // ...
    ```

  - 这种函数式应用插件的方式，在我们遇到的场景中，能够确保 `.derive()` 方法被正确执行。

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
