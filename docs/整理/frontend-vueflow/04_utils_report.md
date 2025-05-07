# ComfyTavern 前端 (`frontend-vueflow`) `src/utils` 目录分析报告

## 目录结构概述

`apps/frontend-vueflow/src/utils` 目录存在，且结构扁平，不包含任何子目录。

该目录下包含以下 TypeScript 工具文件：

*   `api.ts`
*   `deepClone.ts`
*   `nodeUtils.ts`
*   `textUtils.ts`
*   `urlUtils.ts`
*   `workflowTransformer.ts`

## 主要工具函数/模块及其用途

### 1. `api.ts`
*   **功能**: 提供了一个 `useApi` composable 函数，封装了 `axios`，用于简化与后端 API 的 HTTP 通信。
*   **主要特性**:
    *   包含 `get`, `post`, `put`, `del` 等常用 HTTP 方法。
    *   自动从 `urlUtils.ts` 获取并配置 API 的基础 URL。
    *   设置了默认的请求头 (`Content-Type: application/json`) 和超时时间。

### 2. `deepClone.ts`
*   **功能**: 提供了一个 `deepClone` 函数，用于创建对象的深拷贝。
*   **实现方式**: 使用 `JSON.parse(JSON.stringify(obj))`。
*   **注意**: 这种方法对于简单的、符合 JSON 规范的数据结构有效，但无法正确处理函数、Date、RegExp、Map、Set 或循环引用。

### 3. `nodeUtils.ts`
*   **功能**: 包含与 Vue Flow 节点相关的工具函数。
*   **主要函数**:
    *   `getNodeType(node)`: 获取 Vue Flow 节点的类型字符串，优先读取节点的顶层 `type` 属性。

### 4. `textUtils.ts`
*   **功能**: 提供文本处理相关的工具。
*   **主要函数**:
    *   `measureTextWidth(text, font)`: 使用 Canvas API 精确测量给定文本在指定字体下的像素宽度。这对于 UI 布局（如动态调整节点宽度）很有用。提供了 Canvas 不可用时的粗略估算回退。
*   **其他**: 定义了多个常量，表示节点内部不同文本元素（标题、描述等）的 CSS 字体样式字符串，以确保测量与渲染一致。

### 5. `urlUtils.ts`
*   **功能**: 动态生成与后端服务通信所需的各种 URL。
*   **主要函数**:
    *   `getApiBaseUrl()`: 生成 API 请求的基础 URL (例如 `http://localhost:3233/api`)。
    *   `getBackendBaseUrl()`: 生成后端的根 URL (例如 `http://localhost:3233`)，用于加载非 API 资源。
    *   `getWebSocketUrl()`: 生成 WebSocket 连接的 URL (例如 `ws://localhost:3233/ws`)。
*   **特性**:
    *   根据当前页面的协议 (`http`/`https`)、主机名和环境变量 (`VITE_API_PORT`) 动态构建。
    *   自动处理默认端口 (80/443)。

### 6. `workflowTransformer.ts`
*   **功能**: 负责在前端 Vue Flow 使用的数据格式 (`FlowExportObject`) 和后端及共享类型库 (`@comfytavern/types`) 定义的 `WorkflowObject` 格式之间进行转换。
*   **主要函数**:
    *   `transformVueFlowToCoreWorkflow(flow)`: 将 Vue Flow 导出的数据转换为后端所需的核心工作流结构（节点、边、视口）。
    *   `transformWorkflowToVueFlow(workflow, isDark, getEdgeStylePropsFunc)`: 将从后端加载的 `WorkflowObject` 转换为 Vue Flow 可以渲染的格式，包括应用边样式。
    *   `extractGroupInterface(groupData)`: 从一个代表组的工作流对象中提取其输入和输出接口定义 (`GroupInterfaceInfo`)。
*   **重要性**: 这是前端画布数据与后端存储/共享数据格式之间转换的关键桥梁。