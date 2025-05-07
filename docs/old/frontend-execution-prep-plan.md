# 前端对接后端执行引擎准备计划

本文档概述了在 ComfyTavern 前端 (Vue Flow 版本) 对接后端执行引擎之前，需要完成的关键功能开发和完善工作。计划基于对现有代码（特别是 `StatusBar.vue`）和类型定义 (`packages/types/src/node.ts`) 的分析。

## 必要功能 (待办事项)

以下是确保前端能够触发执行、接收状态并展示基本反馈的核心功能：

1.  **完善执行触发**:
    *   **现状**: `StatusBar.vue` 中的 `handleExecuteWorkflow` 已发送 `EXECUTE_WORKFLOW` WebSocket 消息。
    *   **待办**: 在 `handleExecuteWorkflow` 中，发送消息后，应**立即更新 `useExecutionStore`** 中对应标签页的工作流状态（例如，设置为 `PENDING` 或 `RUNNING`），以提供即时反馈。

2.  **完善 WebSocket 消息处理**:
    *   **现状**: `useWebSocket` 存在，`StatusBar` 已监听 `useExecutionStore`。
    *   **待办**: 确保 `useWebSocket` (或其消息处理逻辑) 能够正确解析来自后端的 `NODE_STATUS_UPDATE`, `WORKFLOW_STATUS_UPDATE`, 和 `ERROR` 消息，并将这些信息（节点状态、工作流状态、错误详情、节点输出等）**准确地更新到 `useExecutionStore`** 中。

3.  **节点级状态/结果可视化**:
    *   **现状**: `StatusBar` 显示整体工作流状态。
    *   **待办**: 在 `BaseNode.vue` 组件中实现：
        *   从 `useExecutionStore` 读取**自身节点**的执行状态 (`ExecutionStatus`)。
        *   根据状态更新节点的视觉表现（如边框颜色、状态图标）。
        *   如果状态为 `ERROR`，在节点上（如 Tooltip）显示具体的错误信息。
        *   (可选) 如果状态为 `COMPLETED`，考虑显示节点的输出值。

4.  **按钮节点交互**:
    *   **现状**: 类型定义存在。
    *   **待办**: 在 `ButtonInput.vue` (或相应组件) 中实现点击处理逻辑，调用 `useWebSocket` 发送 `BUTTON_CLICK` 消息。

5.  **(可选) 增强错误通知**:
    *   **现状**: `StatusBar` 显示 "错误" 状态。
    *   **待办**: 考虑增加一个更明显的全局通知机制（例如 Toast 通知）来显示重要的工作流级错误信息，而不仅仅是状态栏的文本变化。

## 开发计划流程图

```mermaid
graph TD
    A[开始] --> B(完善 handleExecuteWorkflow: 发送后立即更新 useExecutionStore);
    B --> C(确保 WebSocket 消息处理能正确更新 useExecutionStore);
    C --> D(实现 BaseNode.vue 读取/显示节点状态/错误/输出);
    D --> E(实现 ButtonInput.vue 点击发送 WebSocket 消息);
    E --> F(可选: 增强全局错误通知);
    F --> G{可选功能};
    G -- 考虑实现 --> H(完善节点配置 UI);
    G -- 考虑实现 --> I(完善动态类型/插槽支持);
    H --> J[前端准备完成];
    I --> J;
    G -- 暂不实现 --> J;