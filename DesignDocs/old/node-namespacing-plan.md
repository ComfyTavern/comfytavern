# 节点命名空间实施计划 (Node Namespacing Implementation Plan)

## 目标

为 ComfyTavern 的节点系统引入命名空间机制，以更好地区分节点来源（核心、内置、插件、用户）、避免命名冲突，并改善节点在前端的组织和查找。

## 核心设计

1.  **命名空间 (`namespace`)**:
    *   表示节点的来源或顶级域 (e.g., `core`, `builtin`, `plugin_xyz`, `user`)。
    *   在 `NodeDefinition` 类型中定义为可选字段 `namespace?: string;`。
2.  **分类 (`category`)**:
    *   表示节点的功能分类 (e.g., `Logic`, `IO`, `Math`, `LLM/OpenAI`)。
    *   保留现有的 `category: string;` 字段，支持 `/` 分隔的多级分类。
3.  **节点类型 (`type`)**:
    *   在 `NodeDefinition` 定义时，`type` 字段只包含节点的基本名称 (e.g., `'MergeNode'`)。
4.  **完整类型 (`fullType`)**:
    *   节点的唯一标识符，用于内部存储、传输和查找。
    *   格式为 `namespace:type` (e.g., `'core:MergeNode'`)。
    *   由 `NodeManager` 在注册时根据命名空间确定逻辑生成。

## 命名空间确定优先级

1.  **最高:** 节点定义 (`NodeDefinition`) 中显式提供的 `namespace` 字段。
2.  **次高:** 通过批量注册机制 (`createNodeRegisterer`) 为一组节点设置的 `defaultNamespace`。
3.  **最低 (回退):** 如果以上都没有提供，则根据节点文件的路径推断 `namespace`。

## 实施步骤

```mermaid
graph TD
    A[开始: 设计节点命名空间] --> B(1. 修改类型定义);
    B --> B1[packages/types: NodeDefinition 添加 namespace?];

    B --> C(2. 创建注册辅助工具);
    C --> C1[utils/nodeRegistration: createNodeRegisterer(defaultNamespace)];

    B --> D(3. 修改后端);
    D --> D1[NodeManager: registerNode(确定namespace, 组合fullType, 存储)];
    D --> D2[NodeLoader: 可能需传递 filePath];
    D --> D3[更新节点注册方式: index.ts 使用 createNodeRegisterer];
    D --> D4[API/服务: 确保使用正确格式];

    B --> E(4. 修改前端);
    E --> E1[类型定义: 添加 namespace?];
    E --> E2[API/WebSocket: 处理含 namespace 的定义];
    E --> E3[状态管理: 存储含 namespace 定义, 工作流节点 type 为 fullType];
    E --> E4[NodePanel: 按 namespace/category 分组/搜索, 添加时组合 fullType];
    E --> E5[画布渲染: 使用 fullType 查找定义];

    D & E --> F(完成);
```

### 1. 修改类型定义 (`packages/types/src/node.ts`)

*   在 `NodeDefinition` 接口中添加可选字段 `namespace?: string;`。

### 2. 创建注册辅助工具 (`apps/backend/src/utils/nodeRegistration.ts` 或类似位置)

*   实现 `createNodeRegisterer(defaultNamespace: string)` 函数。
*   该函数返回一个 `register(manager: NodeManager, definitionOrArray: NodeDefinition | NodeDefinition[])` 函数。
*   `register` 函数负责为没有显式 `namespace` 的定义设置 `defaultNamespace`，然后调用 `nodeManager.registerNode`。

### 3. 修改后端 (`apps/backend`)

*   **`NodeManager.ts`**:
    *   修改 `registerNode(node: NodeDefinition, filePath?: string)`:
        *   实现命名空间确定逻辑 (显式 > 批量默认 > 路径推断)。
        *   将最终确定的 `namespace` 存回 `node.namespace`。
        *   组合 `fullType = `${finalNamespace}:${node.type}`;`。
        *   使用 `fullType` 作为 Map 的键存储节点定义。
    *   修改 `getNode(type: string)`: 确保参数 `type` 是 `fullType` 格式，并以此为键查找。
    *   修改 `getDefinitions()`: 返回的节点定义数组中，每个对象都包含最终确定的 `namespace` 和原始 `type`。
*   **`NodeLoader.ts`**:
    *   调整加载逻辑，可能需要在调用 `nodeManager.registerNode` 时传递 `filePath` 以支持路径推断。
*   **节点注册**:
    *   更新 `apps/backend/src/nodes/` 下的 `index.ts` 文件 (e.g., `io/index.ts`, `llm-test/index.ts`)，使用 `createNodeRegisterer` 批量注册并设置默认 `namespace` (e.g., `'core'`, `'builtin'`)。
*   **API/服务**:
    *   确保 `nodeRoutes.ts` 返回的节点定义包含 `namespace`。
    *   确保 `projectService.ts` 在保存/加载工作流时，`WorkflowStorageNode` 和 `ExecutionNode` 中的 `type` 字段使用 `fullType` 格式。

### 4. 修改前端 (`apps/frontend-vueflow`)

*   **类型定义**: 在前端使用的 `NodeDefinition` 类型中添加 `namespace?: string;`。
*   **API/WebSocket**: 修改处理 `NODE_DEFINITIONS` 消息的逻辑，以接收和存储包含 `namespace` 的节点定义。
*   **状态管理 (`nodeStore.ts`, `workflowStore.ts`)**:
    *   存储完整的节点定义（包含 `namespace`, `type`, `category`）。
    *   确保工作流数据（如 `WorkflowStorageObject`）中的节点 `type` 字段使用 `fullType` (`namespace:type`) 格式。
*   **节点面板 (`NodePanel.vue`)**:
    *   **关键 UI 修改**: 使用 `namespace` 作为主要的、可折叠的分组依据。在 `namespace` 分组内，可以进一步按 `category` (解析 `/`) 进行次级分组或直接列出节点。
    *   修改搜索逻辑以包含 `namespace`。
    *   当从面板添加节点到画布时，创建的节点数据 (`WorkflowStorageNode`) 中的 `type` 字段需要设置为 `fullType`。
*   **画布渲染/交互**:
    *   当需要查找节点定义时（例如渲染节点、获取属性），使用工作流中存储的 `fullType` 从 `nodeStore` 中查找。

## 注意

*   由于应用尚未发布，省略了数据迁移步骤。