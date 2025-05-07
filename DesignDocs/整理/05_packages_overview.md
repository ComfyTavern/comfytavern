# ComfyTavern Packages 目录概览

本文档总结了 `ComfyTavern` 项目 `packages` 目录下的共享库/工具包信息。

## 目录结构

`packages` 目录包含以下子包：

```
packages/
├── types/
│   ├── package.json
│   └── src/
│       ├── index.ts
│       ├── node.ts
│       └── schemas.ts
└── utils/
    └── package.json
```

## 子包说明

### 1. `@comfytavern/types`

*   **路径:** `packages/types`
*   **用途:** 定义项目共享的 TypeScript 类型和 Zod 数据验证模式，包括从 `frontend-vueflow` 移动过来的核心工作流相关类型，并特别关注与工作流、节点、边、执行、**结构化历史记录**、WebSocket 通信以及**增强的节点组功能**相关的结构。
*   **核心内容:**
    *   **`src/index.ts`:** 包的主入口，导出所有类型和模式。
    *   **`src/node.ts`:** 定义节点相关的详细类型，包括输入/输出定义 (`InputDefinition`, `OutputDefinition`)、节点定义 (`NodeDefinition`)、各种输入类型的 Zod 模式 (`zNumericInputOptions`, `zStringInputOptions` 等)、执行状态和上下文 (`ExecutionStatus`, `NodeExecutionContext`)、WebSocket 消息类型 (`WebSocketMessageType`) 以及 **结构化历史记录条目类型 (`WorkflowHistoryEntry` 或类似名称)**。
    *   **`src/schemas.ts`:** 使用 Zod 定义数据验证模式，包括节点插槽 (`GroupSlotInfoSchema`)、节点接口 (`GroupInterfaceInfoSchema`)、Vue Flow 节点/边 (`WorkflowNodeSchema`, `WorkflowEdgeSchema`)、节点组数据 (`NodeGroupDataSchema`)、完整工作流对象 (`WorkflowObjectSchema` - **可能已包含增强的组功能字段如 `creationMethod`, `referencedWorkflows`**) 及其创建/更新变体，以及项目元数据 (`ProjectMetadataSchema`)。定义了 `SocketType` 枚举常量。
*   **依赖:** `zod`, `@vue-flow/core` (开发依赖)

### 2. `@comfytavern/utils`

*   **路径:** `packages/utils`
*   **用途:** 提供项目共享的工具函数。
*   **核心内容:** 目前该包为空，仅包含 `package.json` 文件，尚未实现任何工具函数。
*   **依赖:** 无

## 依赖关系简述

*   `@comfytavern/types` 包被设计为项目内其他部分（如 `apps/backend` 和 `apps/frontend-vueflow`）共享的基础类型定义和验证模式。
*   `@comfytavern/utils` 包未来可能被项目内其他部分使用，提供通用的辅助功能。