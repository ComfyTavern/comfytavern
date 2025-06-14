# ComfyTavern 编码规范

## 1. 引言

编码规范对于 ComfyTavern 项目的成功至关重要。它有助于确保代码的质量、一致性、可读性和可维护性，从而促进团队成员之间的高效协作和项目的长期健康发展。

本文档旨在作为 ComfyTavern 项目编码规范的主要参考，所有参与项目的开发者都应遵循本文档中定义的规则和建议。

## 2. 代码格式化 (Prettier)

项目统一使用 **Prettier** 进行代码的自动格式化，以保证代码风格的一致性。

- **配置文件**: Prettier 的配置文件通常位于项目根目录下，文件名可能是 `.prettierrc.js`, `prettier.config.js`, `.prettierrc.json` 等，或者配置在 `package.json` 文件中。请在项目中查找具体的配置文件以了解详细规则。
- **关键配置项 (示例)**:
    - `printWidth`: 120 (通常建议，具体以项目配置为准)
    - `tabWidth`: 2
    - `semi`: true
    - `singleQuote`: true
    - `trailingComma`: 'es5'
- **IDE 集成**: 强烈建议开发者在各自的 IDE (如 VSCode) 中安装 Prettier 插件，并配置为**保存时自动格式化 (Format On Save)**。这能确保所有提交到代码库的代码都符合统一的格式标准。

## 3. 代码风格与 Linting (ESLint 与 WebHint)

项目统一使用 **ESLint** 结合 **WebHint** (`.hintrc`) 进行代码风格检查和潜在错误检测，以提高代码质量和可维护性。

- **配置文件**:
    - ESLint 的配置文件通常位于项目根目录下，文件名可能是 `.eslintrc.js`, `.eslintrc.json`, `eslint.config.js` 等，或者配置在 `package.json` 文件中。
    - WebHint 的配置文件为项目根目录下的 [`.hintrc`](.hintrc:1)。
    请在项目中查找具体的配置文件以了解详细规则。
- **关键规则集/插件 (示例)**: ESLint 配置中可能包含如 `eslint:recommended`, `plugin:vue/vue3-recommended`, `@typescript-eslint/recommended` 等规则集和插件，具体请参考项目内的 ESLint 配置文件。
- **IDE 集成**: 建议开发者在 IDE 中安装 ESLint 插件（以及对应的 WebHint 插件，如果可用），以便在编码过程中实时获得 linting 错误和警告。
- **Lint 命令**:
    - 虽然 `package.json` 未直接提供 `lint` 或 `lint:fix` 脚本，但项目强调代码检查。开发者应确保其代码通过了配置的 ESLint 和 WebHint 检查。
    - 类型检查命令 (来自 [`.roo/rules/rules.md`](./.roo/rules/rules.md:238)):
        - `bunx vue-tsc --build apps/frontend-vueflow/tsconfig.json`
        - `bun tsc -p apps/backend/tsconfig.json --noEmit`
    - 建议配置 IDE 插件进行实时 linting 和自动修复（如果 ESLint 规则支持）。

## 4. TypeScript 使用规范

本节内容主要参考自项目内部规则文档：[`.roo/rules/rules.md #TypeScript 使用规范`](./.roo/rules/rules.md:139)。

- **接口 (`interface`) vs 类型别名 (`type`)**:
    - 优先使用接口（`interface`）定义对象的结构和类的契约。
    - 当需要使用联合类型、交叉类型、元组类型或映射类型等 `type` 独有的特性时，使用类型别名 (`type`)。
- **避免 `enum`**:
    - 推荐使用 `as const` 对象或 `Map` 代替 `enum`，以获得更好的类型安全性和灵活性，并避免 `enum` 可能带来的额外运行时代码和潜在问题。
    - 示例 (`as const`):
      ```typescript
      const LogLevel = {
        Info: 'INFO',
        Warning: 'WARN',
        Error: 'ERROR',
      } as const;
      type LogLevelValue = typeof LogLevel[keyof typeof LogLevel];
      ```
- **组件类型定义**:
    - 必须为所有 Vue 组件的 `props` 和 `emits` 添加完整的、准确的 TypeScript 类型定义。
- **节点类类型定义**:
    - 所有节点类（Node classes）必须实现完整的类型定义，这包括其输入（inputs）、输出（outputs）以及所有配置选项（configuration options）。
    - 必须为节点数据提供相应的 Zod Schema ([`packages/types/src/schemas.ts`](packages/types/src/schemas.ts:1)) 进行运行时验证。
- **充分利用类型系统**:
    - 积极利用 TypeScript 的类型推断、类型检查、泛型、条件类型等高级特性，以编写出更健壮、更易于维护的代码。

## 5. Vue 3 开发规范

本节内容主要参考自项目内部规则文档：[`.roo/rules/rules.md #Vue 3 开发规范`](./.roo/rules/rules.md:147)。

- **`<script setup>` 语法**:
    - 项目统一使用 Composition API 的 `<script setup>` 语法糖进行组件开发，以获得更简洁、更高效的开发体验。
- **响应式状态管理 (`ref` 和 `reactive`)**:
    - 使用 `ref` 管理基本类型值和单个对象的响应式状态。
    - 使用 `reactive` 管理复杂对象（具有多个属性）的响应式状态。
    - 注意区分两者的使用场景，并理解其背后的响应式原理。
- **派生状态与副作用**:
    - 使用 `computed` 计算派生状态，保持模板逻辑的简洁性，并利用其缓存特性。
    - 使用 `watch` 或 `watchEffect` 处理副作用。`watch` 用于侦听特定数据源并在其变化时执行回调，`watchEffect` 用于自动追踪其回调函数中依赖的响应式数据并在其变化时重新执行。
    - **重要**: 在使用 `watch` 和 `watchEffect` 时，务必注意在组件卸载前（如在 `onUnmounted` 钩子中）清理由它们创建的副作用（例如定时器、事件监听器等），以避免内存泄漏。
- **生命周期钩子**:
    - 合理使用 `onMounted`, `onUpdated`, `onUnmounted` 等生命周期钩子来管理组件的生命周期行为。
- **依赖注入 (`provide`/`inject`)**:
    - 在合适的场景下（如跨多层级组件通信或插件开发）合理使用 `provide` 和 `inject`。
- **VueUse**:
    - 积极推荐并使用 [VueUse](https://vueuse.org/) 库提供的工具函数。VueUse 包含大量高质量、可组合的实用函数，可以极大地简化开发、提升开发效率和代码质量。
- **其他重要实践**:
    - **错误边界 (Error Boundaries)**: 实现适当的错误边界来优雅地处理用户界面中可能发生的渲染错误或运行时异常。
    - **命名约定**: 遵循 Vue 3 官方推荐的组件命名约定（PascalCase）和事件命名约定（kebab-case）。
    - **`Teleport` 组件**: 在需要将组件内容渲染到 DOM 结构中当前组件之外的其他位置时（例如全局模态框、通知），使用 `Teleport` 组件。
    - **`Suspense` 组件**: 使用 `Suspense` 组件优雅地处理异步组件的加载状态，提供更好的用户体验。

## 6. 命名约定

统一的命名约定有助于提高代码的可读性和可维护性。

### 6.1 文件与目录命名

参考自项目内部规则文档：[`.roo/rules/rules.md #文件组织规范`](./.roo/rules/rules.md:171)。

- **目录名**: 使用短横线分隔的小写单词 (kebab-case)。
    - 示例: `node-types`, `utility-functions`, `user-profile`
- **文件名**:
    - Vue 组件: 使用帕斯卡命名法 (PascalCase)。示例: `UserProfile.vue`, `NodeEditor.vue`。
    - TypeScript/JavaScript 文件 (如工具函数、服务、配置文件等): 通常使用小驼峰命名法 (camelCase) 或帕斯卡命名法 (PascalCase)，具体根据文件内容和上下文约定，保持一致性。示例: `userService.ts`, `stringUtils.ts`, `AppConfig.ts`。

### 6.2 代码内命名

- **变量和函数名**: 使用小驼峰命名法 (camelCase)。
    - 示例: `userName`, `calculateTotal`, `isActive`
- **类名和接口名**: 使用大驼峰命名法 (PascalCase)。
    - 示例: `class UserAccount {}`, `interface NodeConfig {}`
- **常量名**: 使用全大写蛇形命名法 (SCREAMING_SNAKE_CASE)。
    - 示例: `const MAX_USERS = 100;`, `const API_ENDPOINT = '...';`
- **TypeScript 类型参数**: 使用单个大写字母，通常从 `T` 开始，然后是 `K`, `V`, `E` 等。
    - 示例: `function identity<T>(arg: T): T { return arg; }`, `type Dictionary<K extends string | number, V> = { [key in K]: V; };`

## 7. 注释规范

清晰、准确的注释是代码可理解性和可维护性的关键。

- **重要性**: 强调在复杂逻辑、公共 API、非直观算法或可能引起混淆的代码部分添加注释。
- **语言**: **所有代码注释必须使用中文** (参考 [`.roo/rules/rules.md`](./.roo/rules/rules.md:4))。
- **风格**:
    - 推荐对函数、类、方法、接口和重要的变量声明使用 JSDoc 风格的注释。这不仅能提高代码的可读性，还能被 IDE 和文档生成工具利用，提供更好的智能提示和文档支持。
    - 示例 (JSDoc):
      ```typescript
      /**
       * 计算两个数字的和。
       * @param a 第一个加数
       * @param b 第二个加数
       * @returns 两个数字的和
       */
      function sum(a: number, b: number): number {
        return a + b;
      }
      ```
- **简洁明了**: 注释应简洁、准确，解释代码的“为什么”和“做什么”，而不是简单重复代码“怎么做”。

## 8. Git 提交信息规范

项目推荐遵循 **Conventional Commits** 规范来格式化 Git 提交信息。这有助于生成清晰的提交历史，便于自动化工具（如版本发布、变更日志生成）处理。

- **格式**:
  ```
  <type>[optional scope]: <description>

  [optional body]

  [optional footer(s)]
  ```
- **提交类型 (`<type>`)**:
    - `feat`: 新功能 (feature)
    - `fix`: Bug 修复
    - `docs`: 文档变更
    - `style`: 代码风格调整（不影响代码逻辑，如格式化、缺少分号等）
    - `refactor`: 代码重构（既不是新增功能，也不是修复 bug）
    - `perf`: 性能优化
    - `test`: 增加或修改测试
    - `build`: 影响构建系统或外部依赖的更改（例如：gulp, broccoli, npm）
    - `ci`: CI 配置文件和脚本的更改（例如 Travis, Circle, BrowserStack, SauceLabs）
    - `chore`: 其他不修改 `src` 或测试文件的更改（如更新构建任务、包管理器配置等）
    - `revert`: 撤销之前的提交
- **示例**:
  ```
  feat(auth): 实现用户邮箱验证功能

  用户现在可以在注册后通过邮箱链接验证其账户。
  这增强了账户安全性。

  Closes #123
  ```
  ```
  fix: 修复节点连接时偶尔发生的类型不匹配错误

  详细描述修复的上下文和原因。
  ```

## 9. 其他重要规范

[`.roo/rules/rules.md`](./.roo/rules/rules.md:1) 文件中包含了更多针对特定技术和场景的详细编码规范。为了保持本编码规范文档的集中性和易导航性，以下列出这些重要规范的入口，并建议开发者查阅源文件以获取完整信息：

- **性能优化规范**: [`.roo/rules/rules.md #3. 性能优化规范`](./.roo/rules/rules.md:161)
- **状态管理规范 (Pinia)**: [`.roo/rules/rules.md #5. 状态管理规范 (Pinia)`](./.roo/rules/rules.md:199)
- **节点开发规范**: [`.roo/rules/rules.md #6. 节点开发规范`](./.roo/rules/rules.md:207)
- **WebSocket 通信规范**: [`.roo/rules/rules.md #7. WebSocket 通信规范`](./.roo/rules/rules.md:216)
- **样式规范 (Tailwind CSS)**: [`.roo/rules/rules.md #8. 样式规范 (Tailwind CSS)`](./.roo/rules/rules.md:224)
- **Tooltip 使用规范 (`v-comfy-tooltip`)**: [`.roo/rules/rules.md #10. Tooltip 使用规范 (v-comfy-tooltip)`](./.roo/rules/rules.md:242)
- **对话框与通知服务规范 (`DialogService`)**: [`.roo/rules/rules.md #11. 对话框与通知服务规范 (DialogService)`](./.roo/rules/rules.md:294)
- **Elysia.js 使用注意事项**: [`.roo/rules/rules.md #Elysia.js 使用注意事项`](./.roo/rules/rules.md:469)
- **`CONVERTIBLE_ANY` 类型详细说明**: [`.roo/rules/rules.md #CONVERTIBLE_ANY 类型详细说明`](./.roo/rules/rules.md:508)

请务必熟悉并遵循这些特定领域的规范，以确保项目整体的质量和一致性。