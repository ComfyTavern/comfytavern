# 工作流集成应用架构计划

## 1. 概述

### 1.1 问题背景

当前系统过度依赖“面板”框架，导致核心功能（如聊天应用）难以快速实现和原生集成。用户需要手动配置工作流、对接 API，这违背了“即开即用”的目标。同时，工作流文件缺乏组织（扁平目录），且没有保护机制，容易被误删。

### 1.2 方案目标

- 建立“工作流集成应用”体系，以支持项目路线图 Phase 2 的交互式应用 MVP。
- 集成应用使用原生 Vue 组件渲染（固定在 `apps/frontend-vueflow/src/components/built-in-apps/`），无沙盒，提供最佳性能和开发体验，并集成 @comfytavern/panel-sdk 以复用工作流调用逻辑。
- 集成应用启用时自动创建专属工作流子目录，支持多级结构，确保后端逻辑（如 LLM 调用和复杂交互）通过工作流封装。
- 支持按需恢复：如果工作流文件丢失，从系统模板自动复制。
- 所有模板文件（仅工作流 JSON）随主代码库 Git 版本化，便于维护和更新。

### 1.3 关键原则

- **解耦**: 集成应用和工作流的关联由应用组件自身声明和管理，不依赖项目配置（如 project.json），避免职责拉扯。
- **鲁棒性**: 系统通过 UI 驱动的按需检查，确保文件完整性。
- **用户友好**: 用户只需访问集成应用，系统自动处理依赖，无需手动配置。
- **可扩展**: 未来可添加更多集成应用（如聊天树图查看器 `chat-history-branching-design.md` 、Agent 管理器）。

### 1.4 高层设计

- **系统模板库**: 存放在 `apps/backend/src/built-in-app-templates/`，包含每个集成应用的专属工作流 JSON 等，随主代码库 Git 版本化。
- **启用流程**: 用户首次访问集成应用时，组件内部检查并复制模板到项目专属目录（如 `workflows/_app_chat/`），通过 FAM 服务确保文件完整性。
- **渲染**: 前端动态显示入口，加载固定在 src 中的原生组件，支持与 Panel SDK 的集成以实现异步通信和实时交互。
- **工作流加载**: 升级 WorkflowManager，支持路径如 `_app_chat/main.json`，封装后端执行逻辑。
- **按需恢复 (UI 驱动)**: 集成应用页面加载时（onMounted），组件内部检查所需工作流是否存在。如果缺失，显示提示并提供一键恢复功能，调用后端服务从模板重新复制。工作流是集成应用专属的，仅供其内部使用，因此检查仅在应用激活时触发。这支持交互式应用的动态执行，而非传统聊天式的简单对话框。
- **依赖声明**: 每个应用组件（如 ChatView.vue）硬编码其所需的工作流路径和模板源，便于随时修改而不影响项目配置。

## 2. 实施顺序

计划分为 4 个阶段，每个阶段有具体任务、依赖和输出。

### 阶段 1: 基础改造（类型与后端核心）

**目标**: 升级类型定义和工作流管理，支持目录和路径加载。
**依赖**: 无。
**任务**:

1. 更新 `packages/types/src/workflow.ts`:
   - 在 `WorkflowMetadataSchema` 添加 `path: string` (支持子目录，如 `_app_chat/main`)。
   - 添加 `templateSource: string` (可选，用于恢复，指向系统模板路径)。
2. 改造 `apps/backend/src/services/WorkflowManager.ts`:
   - 更新 `loadWorkflow` 支持路径参数（e.g., workflowId = '\_app_chat/main'），调整逻辑路径构建以处理斜杠。
   - 职责聚焦于：成功加载文件或在文件不存在时返回错误。
3. 更新 `apps/backend/src/routes/workflowRoutes.ts` (和任何相关路由):
   - 支持路径在 API 参数中。

**输出**: 类型安全的工作流加载，支持目录路径。
**风险**: API 变更可能影响前端，需同步更新。

### 阶段 2: 模板系统与恢复服务

**目标**: 创建模板库并扩展现有服务以支持恢复逻辑。
**依赖**: 阶段 1 完成。
**任务**:

1. 创建目录 `apps/backend/src/built-in-app-templates/chat/`:
   - 添加示例工作流文件 (e.g., main.json, sub1.json)。
2. 扩展 `apps/backend/src/services/projectService.ts`:
   - 新增方法: `restoreWorkflow(projectId, workflowPath, templateSource)`: 检查指定路径的工作流是否存在，如果缺失，则从模板库复制。
3. 添加路由 `apps/backend/src/routes/builtInAppRoutes.ts` (或集成到现有路由):
   - POST /api/projects/:projectId/restore-workflow: 调用 restoreWorkflow，用于组件内部的一键恢复。

**输出**: 后端能处理工作流恢复。
**风险**: 文件复制需处理权限和冲突，通过 FAM 服务缓解。

### 阶段 3: 前端集成与 UI

**目标**: 前端支持显示和渲染集成应用。
**依赖**: 阶段 2 完成。
**任务**:

1. 创建子模块 Store `apps/frontend-vueflow/src/stores/builtInAppStore.ts` (或类似):
   - 管理集成应用的状态（如已启用列表），使用本地存储持久化。
   - 新增方法: `checkAndRestoreDependencies(appId)`: 检查应用所需工作流路径，如果缺失，调用后端恢复 API。
2. 创建原生组件 `apps/frontend-vueflow/src/components/built-in-apps/ChatView.vue`:
   - 硬编码所需工作流路径 (e.g., const requiredWorkflows = [{ path: '_app_chat/main', template: 'chat/main.json' }])。
   - 在组件挂载时 (onMounted)，调用子模块 Store 的 checkAndRestoreDependencies 检查并恢复依赖。
   - 如果缺失，显示覆盖层或提示，包含“一键恢复”按钮。
   - 恢复成功后，加载并执行工作流 (e.g., executeWorkflow('\_app_chat/main'))，封装复杂后端逻辑。
3. 更新路由 `apps/frontend-vueflow/src/router/index.ts`:
   - 添加动态路由 for 集成应用 (e.g., /project/:projectId/app/:appId)。
4. 在项目视图 (e.g., ProjectDashboardView.vue) 添加集成应用入口:
   - 根据子模块 Store 的状态动态显示入口（无需启用按钮，访问即检查）。

**输出**: 用户能使用集成应用，支持开箱即用的交互式体验。
**风险**: 动态路由需处理安全性，与 Panel SDK 集成以支持自定义扩展。

### 阶段 4: 测试与优化

**目标**: 确保系统稳定，处理边缘情况。
**依赖**: 阶段 3 完成。
**任务**:

1. 定义手动测试场景 (e.g., 访问集成应用、删除文件后恢复、入口显示、交互式执行与 Agent 集成)。
2. 处理停用: 在子模块 Store 中添加 disableApp 方法，删除子目录（但警告用户可能影响应用）。
3. 优化 UI: 添加确认对话框、进度指示等。
4. 文档: 更新 ProjectOverview.md，添加本架构描述。

**输出**: 完整、可生产的系统。
**风险**: 测试覆盖不足导致 bug，通过增量手动测试缓解。

## 3. 潜在风险与缓解

- **兼容性**: 所有变更需测试不影响现有面板系统。缓解: 增量开发，每阶段测试。
- **性能**: 目录扫描可能慢。缓解: 缓存列表，仅在必要时刷新。
- **安全**: 复制模板需验证路径。缓解: 使用 FAM 服务 的内置安全检查。
- **版本更新**: 未来模板更新如何同步到用户项目。缓解: 通过组件内部的 restore 调用，比较版本并覆盖。

## 4. 资源需求

- 工具: VSCode, Bun, Git。
- 测试环境: 本地开发服务器。
- 后续: 集成到 CI/CD。

这个计划文档是我们的“锚点”，不会丢失。如果有任何修改，请告诉我。
