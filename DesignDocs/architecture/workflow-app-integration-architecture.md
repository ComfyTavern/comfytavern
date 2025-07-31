# 集成应用架构设计

## 1. 核心思想

本架构旨在定义一种原生、高性能的“集成应用”体系。其核心思想是 **前端主导、后端执行**。集成应用及其所有配套资产（UI 组件、工作流定义等）均作为前端的一部分进行开发和分发。后端在此架构中扮演纯粹的服务角色，根据前端的指令管理用户项目中的文件并执行工作流。

## 2. 系统组件与职责

### 2.1 集成应用包 (Frontend)

- **位置**: `apps/frontend-vueflow/src/integrated-apps/`
- **结构**: 每个集成应用是一个独立的目录，包含所有必需的资产。
  ```
  integrated-apps/
  └── chat/
      ├── ChatView.vue          # 应用的 UI 组件
      ├── workflow.json         # 配套的默认工作流定义
      ├── manifest.json         # 应用元数据 (名称, 描述)
      └── icon.svg              # 应用图标
  ```
- **职责**:
  1.  **作为资产源**: 持有应用的 UI 和配套工作流的“出厂版本”。
  2.  **应用发现**: 在前端启动时，扫描 `integrated-apps` 目录，动态注册所有可用的应用。
  3.  **生命周期管理**: 负责在用户项目中“释出”和“恢复”配套工作流。

### 2.2 文件管理服务 (Backend)

- **职责**: 提供一组 CRUD API，用于操作指定项目空间内的工作流文件。
- **核心 API**: 使用通用的文件管理服务 (`/api/fam`)，通过“逻辑路径”进行操作。
  - **写入/创建**: `POST /api/fam/write-json`
    - **请求体**: `{ "logicalPath": "user://projects/{projectId}/workflows/_apps/chat/main.json", "content": { ... } }`
  - **读取**: `GET /api/fam/read/user://projects/{projectId}/workflows/_apps/chat/main.json`
    - **注意**: 当文件不存在时，此接口返回 `null` 而非 `404` 错误，便于前端处理。
  - **删除**: `DELETE /api/fam/delete`
    - **请求体**: `{ "logicalPaths": ["user://projects/{projectId}/workflows/_apps/chat/main.json"] }`
- **特性**: 后端不包含任何“模板”或“应用”的概念。它只处理逻辑路径和文件内容，是一个被动的、受调遣的文件存储服务。

### 2.3 工作流执行引擎 (Backend)

- **职责**: 接收一个有效的工作流路径，加载文件并执行。其职责与普通工作流的执行完全一致。

## 3. 核心流程

### 3.1 首次“释出”流程

1.  **用户操作**: 用户在项目中首次访问“聊天”集成应用。
2.  **前端检查**: `ChatView.vue` 组件在 `onMounted` 时，调用 `GET /api/fam/read/user://projects/{projectId}/workflows/_apps/chat/main.json` 尝试读取其所需的工作流文件。
3.  **发现缺失**: 后端返回 `200 OK` 且响应体为 `null`，表示文件不存在。
4.  **前端读取**: 前端逻辑判断响应为 `null`，从自身包内（`integrated-apps/chat/workflow.json`）读取默认工作流的内容。
5.  **前端请求写入**: 前端调用 `POST /api/fam/write-json`，将默认工作流的 JSON 内容和目标逻辑路径 `user://projects/{projectId}/workflows/_apps/chat/main.json` 发送给后端。
6.  **后端写入**: 后端的 `FileManagerService` 解析逻辑路径，在 `userData/{userId}/projects/{projectId}/workflows/_apps/chat/` 目录下创建 `main.json` 文件并写入内容。
7.  **流程完成**: 前端再次请求工作流，成功获取并渲染应用。

### 3.2 文件恢复流程

此流程与“首次释出流程”完全相同。当应用组件发现其依赖的工作流文件在后端不存在时（无论是因为首次使用还是被用户删除），它都会自动执行一次“释出”操作来恢复文件。

### 3.3 工作流调用流程

当集成应用（如 `ChatView.vue`）需要执行其配套的工作流时，它将复用平台现有的工作流调用服务，其流程如下：

1.  **获取服务**: 应用组件通过 `useWorkflowInvocation()` Composable 获取工作流调用服务。
2.  **用户触发**: 用户在 `ChatView.vue` 中输入消息并点击发送。
3.  **前端调用**:
    *   `ChatView.vue` 调用 `invoke` 方法，并提供以下参数：
      ```typescript
      const { executionId } = await invoke({
        mode: 'saved', // 明确使用已保存的工作流
        targetId: 'user://projects/{projectId}/workflows/_apps/chat/main.json', // 目标工作流的逻辑路径
        inputs: {
          "user_input": "你好，世界！" // 需要覆盖的输入，键名需与工作流的接口输入ID匹配
        },
        source: 'panel' // 将自身标识为 'panel'，以复用现有逻辑
      });
      ```
    *   `invoke` 方法返回一个唯一的 `executionId`，用于追踪本次执行。
4.  **后端执行**: 后端接收到请求，加载指定路径的工作流，使用 `inputs` 覆盖默认输入，然后开始执行。
5.  **前端监听与 UI 更新**:
    *   `ChatView.vue` 使用 `watch` 监听 `executionStore` 中与 `executionId` 相关的状态。
    *   **监听流式输出**:
      ```typescript
      watch(
        () => executionStore.getAccumulatedInterfaceStreamedText(executionId, 'response_stream'),
        (newText) => {
          // 将收到的流式文本实时更新到聊天界面上
          chatHistory.value[chatHistory.value.length - 1].text = newText;
        }
      );
      ```
    *   **监听执行状态**:
      ```typescript
      watch(
        () => executionStore.getWorkflowStatus(executionId),
        (status) => {
          if (status === 'COMPLETE' || status === 'ERROR') {
            // 处理执行完成或失败的逻辑
          }
        }
      );
      ```
6.  **流程结束**: 工作流执行完毕，前端监听到 `COMPLETE` 状态，完成本次交互。

### 3.4 配套工作流 IO 定义

为了让聊天应用能正常工作，其配套的 `workflow.json` 需要提供以下输入和输出接口。

#### 输入 (Inputs)

| 接口ID (Key) | 显示名称 (DisplayName) | 数据类型 (DataType) | 描述 |
| :--- | :--- | :--- | :--- |
| `user_input` | 用户输入 | `STRING` | 从聊天界面接收到的用户发送的文本消息。 |
| `llm_config` | LLM 配置 | `OBJECT` | (可选) 用于覆盖默认的 LLM 参数，例如 `temperature`, `max_tokens` 等。 |

#### 输出 (Outputs)

| 接口ID (Key) | 显示名称 (DisplayName) | 数据类型 (DataType) | 是否流式 (isStream) | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `response_stream` | 响应流 | `STRING` | `true` | 从 LLM 返回的流式文本响应，用于在界面上逐字显示。 |
| `full_text` | 完整文本 | `STRING` | `false` | 流结束后，累积的完整回复文本。 |
| `usage` | Token 用量 | `OBJECT` | `false` | 本次调用的 token 使用情况统计。 |


## 4. 实施计划

### 阶段 1: 后端 API 确认 (已完成)

- **结论**: 经过调查，现有的通用文件管理服务 (`FileManagerService`) 及其对应的 `/api/fam` 路由**完全满足**本架构的需求。
- **实施要点**:
  1.  **无需开发新 API**: 所有操作（读、写、删）均可通过 `/api/fam` 端点完成。
  2.  **使用逻辑路径**: 前端需使用 `user://projects/{projectId}/...` 格式的逻辑路径与后端交互。
- **状态**: 此阶段已完成，可直接进入前端开发。

### 阶段 2: 前端集成应用框架

- **任务**:
  1.  在前端创建 `src/integrated-apps/` 目录结构。
  2.  实现一个 `IntegratedAppService`，负责在前端启动时扫描、发现并注册所有应用。
  3.  创建 `useIntegratedApp` composable，封装检查、释出/恢复工作流的逻辑。
- **输出**: 前端具备动态加载集成应用及其配套资产的能力。

### 阶段 3: 实现首个集成应用 (聊天)

- **任务**:
  1.  创建 `apps/frontend-vueflow/src/integrated-apps/chat/` 目录和所有配套文件 (`ChatView.vue`, `workflow.json` 等)。
  2.  在 `ChatView.vue` 中使用 `useIntegratedApp` 来管理其工作流依赖。
  3.  在 UI 中添加入口，允许用户访问聊天应用。
- **输出**: 一个功能完整的、遵循新架构的聊天应用。

### 阶段 4: 测试与文档

- **任务**:
  1.  测试首次使用、文件删除后恢复、应用切换等场景。
  2.  为开发者撰写如何在前端添加新的集成应用的指南。
- **输出**: 稳定可靠的系统和清晰的开发者文档。
