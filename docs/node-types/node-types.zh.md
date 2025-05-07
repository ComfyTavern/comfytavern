# 节点类型系统文档 (中文版)

本文档概述了 ComfyTavern 项目中用于节点输入和输出的数据类型、配置选项以及它们之间的连接规则。

## 核心数据类型

以下类型用于定义节点的输入或输出插槽处理的数据种类。配置选项通常定义在节点定义 (`NodeDefinition`) 中对应插槽的 `config` 对象内。通用 UI 选项 (`tooltip`, `hidden`, `showReceivedValue`) 也定义在 `config` 对象内。`required` 属性是 `InputDefinition` 的顶级属性。

| 类型                | 描述           | UI 组件 (示例)                                                                                                               | 传输的数据类型        | 配置选项 (`config` 对象内, 除非另有说明) & 说明                                                                                                                                                                                                                      |
| :------------------ | :------------- | :--------------------------------------------------------------------------------------------------------------------------- | :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INT`               | 整数           | `NumberInput` (内联)                                                                                                         | `number`              | `config`: `default`, `min`, `max`, `step`, `suggestions` (数字列表)。通用: `tooltip`, `hidden`, `showReceivedValue`。顶级: `required` (布尔或函数), `defaultValue`, `min`, `max` (注意: 顶级属性与 config 内可能重复，需根据具体节点实现确认优先级)。                |
| `FLOAT`             | 浮点数         | `NumberInput` (内联)                                                                                                         | `number`              | `config`: `default`, `min`, `max`, `step`, `suggestions` (数字列表)。通用: `tooltip`, `hidden`, `showReceivedValue`。顶级: `required` (布尔或函数), `defaultValue`, `min`, `max` (注意: 顶级属性与 config 内可能重复，需根据具体节点实现确认优先级)。                |
| `STRING`            | 文本字符串     | `StringInput` (内联, `multiline:false`), `TextAreaInput` (块状, `multiline:true`), `TextDisplay` (块状, `display_only:true`) | `string`              | `config`: `default`, `multiline` (布尔), `placeholder`, `display_only` (布尔), `suggestions` (字符串列表)。通用: `tooltip`, `hidden`, `showReceivedValue`。顶级: `required` (布尔或函数), `defaultValue`。                                                           |
| `BOOLEAN`           | 布尔值         | `BooleanToggle` (内联)                                                                                                       | `boolean`             | `config`: `default`。通用: `tooltip`, `hidden`, `showReceivedValue`。顶级: `required` (布尔或函数), `defaultValue`。                                                                                                                                                 |
| `COMBO`             | 预定义列表选择 | `SelectInput` (内联)                                                                                                         | `string` 或 `number`  | `config`: `options` (字符串/数字数组), `default`。传输的是选项的 _值_。通用: `tooltip`, `hidden`, `showReceivedValue`。顶级: `required` (布尔或函数), `defaultValue`。                                                                                               |
| `CODE`              | 代码片段       | `CodeInput` (块状)                                                                                                           | `string`              | `config`: `default`, `language` (字符串, 如 'javascript'), `placeholder`。UI 带语法高亮。通用: `tooltip`, `hidden`, `showReceivedValue`。顶级: `required` (布尔或函数), `defaultValue`。                                                                             |
| `BUTTON`            | 动作触发器     | `ButtonInput` (块状)                                                                                                         | (事件触发)            | `config`: `label` (按钮文本)。不传输持久数据，点击时触发后端动作 (通过 WebSocket 的 `button_click` 事件) 或客户端脚本 (`clientScriptUrl`)。通用: `tooltip`, `hidden`。顶级: 通常 `required` 为 false。                                                               |
| `WILDCARD` (`*`)    | 任意类型兼容   | (取决于连接)                                                                                                                 | `any`                 | 纯粹的兼容性通配符，连接时不改变自身类型。通用: `tooltip`, `hidden`, `showReceivedValue`。参见类型兼容性规则。                                                                                                                                                       |
| `CONVERTIBLE_ANY`   | 动态可变类型   | (取决于连接，连接后行为像具体类型)                                                                                           | `any` (初始)          | 连接时会实际改变自身类型以匹配对方，变化会持久化并可能同步组接口。通用: `tooltip`, `hidden`, `showReceivedValue`。顶级: `required` (布尔或函数), `defaultValue`。参见类型兼容性规则。                                                                                |
| `HISTORY`           | 历史记录       | `TextAreaInput` (块状)                                                                                                       | `any` / `object[]`    | 通常用于聊天历史等。通用: `tooltip`, `hidden`, `showReceivedValue`。顶级: `required` (布尔或函数), `defaultValue`。                                                                                                                                                  |
| `RESOURCE_SELECTOR` | 资源选择器     | `ResourceSelectorInput` (块状)                                                                                               | `string` (资源标识符) | `config`: `acceptedTypes` (数组, 定义可选资源类型, 如 `[{ value: 'workflow', label: '工作流' }]`), `editable` (布尔), `placeholder`。通用: `tooltip`, `hidden`, `showReceivedValue`。顶级: `required` (布尔或函数), `defaultValue`。                                 |
| `IMAGE`             | 图像数据       | `ImageInput` (块状, 上传/指定), 可选 `ImagePreview` (块状, 显示)                                                             | `object` / `string`   | `config`: `default` (路径/URL/Base64), `showPreview` (布尔), `maxWidth`, `maxHeight` (预览限制)。传输的数据可能是包含元数据和图像数据（如 Base64）的对象，或仅为标识符（如 URL）。通用: `tooltip`, `hidden`, `showReceivedValue`。顶级: `required`, `defaultValue`。 |

**注意：**

- **UI 组件**: 上表中的 UI 组件是前端 (`apps/frontend-vueflow/src/components/graph/inputs/index.ts`) 中定义的示例。实际渲染的组件由 `getInputComponent` 函数根据类型和 `config` (如 `multiline`, `display_only`, `showPreview`) 决定。
  - **内联组件**: 通常在输入未连接时显示在插槽旁边 (如 `NumberInput`, `StringInput`, `BooleanToggle`, `SelectInput`)。
  - **块状组件**: 通常显示在节点主体区域 (如 `TextAreaInput`, `CodeInput`, `ButtonInput`, `TextDisplay`, `ResourceSelectorInput`, `ImageInput`, 以及可选的 `ImagePreview`)。
- **配置选项**:
  - 节点的 `InputDefinition` 中的 `config` 对象可以包含对应类型的特定选项 (如 `StringInputOptions`, `NumericInputOptions` 等) 以及通用 UI 选项 (`tooltip`, `hidden`, `showReceivedValue`)。
  - `required` 是 `InputDefinition` 的顶级属性，可以是布尔值或一个返回布尔值的函数，以实现条件性必填。
  - `InputDefinition` 接口本身也定义了 `defaultValue`, `min`, `max` 顶级属性，可能与 `config` 内的同名字段功能重叠，具体行为和优先级取决于节点实现。
- **`suggestions`**: 对于 `INT`, `FLOAT`, `STRING` 类型，提供推荐值列表，用户仍可输入该类型的其他有效值。
- **`showReceivedValue`**: 若输入已连接且此选项为 `true`，块状输入组件可能保持可见以显示接收到的值（具体行为取决于前端实现）。
- **`display_only`**: 对于 `STRING` 类型，若此选项为 `true`，前端使用只读的 `TextDisplay` 组件显示文本（块状）。
- **插槽名称显示**: 前端 (`apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue`) 显示插槽名称的优先级:
  - **Tooltip**: 优先 `description` (格式化 `\\n` 为换行)，其次 `displayName` 或 `key`。
  - **直接显示**: 优先 `displayName`，其次 `description` (格式化后)，最后 `key`。

## 类型兼容性规则

输出插槽和输入插槽之间的连接基于以下规则，主要由前端 (`apps/frontend-vueflow/src/composables/canvas/useCanvasConnections.ts`) 在创建连接时强制执行：

1.  **精确匹配：** 任何类型都可以连接到相同的类型 (例如 `STRING` -> `STRING`, `INT` -> `INT`)。

2.  **通配符与动态类型：**

    - **`WILDCARD` (`*`)**:
      - 纯粹的兼容性通配符。
      - 任何类型都可连接到 `WILDCARD` 输入 (`*` -> `WILDCARD`)。
      - `WILDCARD` 输出可连接到任何类型 (`WILDCARD` -> `*`)。
      - 连接时，`WILDCARD` 插槽的类型**不会**改变。
    - **`CONVERTIBLE_ANY`**:
      - 动态类型，连接时会**实际改变自身类型**以匹配连接的另一端。
      - `CONVERTIBLE_ANY` 输出连接到具体类型输入时，输出插槽类型变为该具体类型，并获取对方的当前值、名称、描述等信息。
      - 具体类型输出连接到 `CONVERTIBLE_ANY` 输入时，输入插槽类型变为该具体类型。
      - 类型改变是**持久化**的，并可能触发组接口同步。
      - **不能**直接连接到 `WILDCARD` 或另一个 `CONVERTIBLE_ANY`。

3.  **数值转换：**

    - `INT` 可以连接到 `FLOAT` (`INT` -> `FLOAT`) (隐式转换)。

4.  **转换为字符串：**

    - `INT` 可以连接到 `STRING` (`INT` -> `STRING`)。
    - `FLOAT` 可以连接到 `STRING` (`FLOAT` -> `STRING`)。
    - `BOOLEAN` 可以连接到 `STRING` (`BOOLEAN` -> `STRING`)。

5.  **特殊文本兼容性：**

    - `STRING` 可以连接到 `CODE` (`STRING` -> `CODE`) (将纯文本视为代码)。
    - `STRING` 可以连接到 `COMBO` (`STRING` -> `COMBO`) (字符串值**必须**精确匹配目标 `COMBO` 的 `config.options` 中的某个值)。
    - **注意:** 不再支持 `INT`/`FLOAT` 直接连接到 `COMBO`。

6.  **多输入插槽 (`multi: true`)：**
    - 若输入插槽定义了 `multi: true` (顶级属性)，可接受多个连接。
    - **类型检查**:
      - 若定义了 `acceptTypes` (类型字符串数组，顶级属性)，每个连接的输出类型必须**精确匹配** `acceptTypes` 中的*至少一个*类型 (不应用其他转换规则)。
      - 若未定义 `acceptTypes`，每个连接必须与该输入插槽自身的 `type` 兼容 (遵循规则 1-5)。
    - 节点的 `execute` 函数通常收到输入值的数组。

**重要提示：** 这些规则主要由前端强制执行以提供即时反馈。后端执行时可能进行额外验证或转换。

## 节点级配置

节点定义 (`NodeDefinition`) 可包含独立于插槽的配置：

- **`configSchema`**: 定义节点级配置项 (结构类似 `inputs`)，显示在节点主体独立区域 (`apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue` 的 `.node-configs`)。
- **`configValues`**: 存储 `configSchema` 定义的配置项的实际值。
- **`clientScriptUrl`**: (可选) 指向节点特定前端 JS 文件的 URL，用于处理自定义逻辑 (如 `BUTTON` 点击)。
- **`width`**: (可选) 节点渲染时的首选宽度 (像素)，用户可调整。
- **组相关属性**:
  - `isGroupInternal`: (布尔) 若为 `true`，此节点类型只能在组内使用。
  - `groupId`: (字符串) 节点所属的组 ID。
  - `groupConfig`: (对象) 组特定配置 (如 `allowExternalUse`)。
  - `dynamicSlots`: (布尔) 标记节点是否支持动态添加/删除插槽 (如 `GroupInput`/`GroupOutput`)。
- **`data.groupInfo`**: (前端) 若节点是 `NodeGroup`，其 `data` 可能包含 `groupInfo`，用于前端显示组内统计信息。

这允许节点拥有独立于其输入/输出数据的可配置参数。

## 执行状态

节点在工作流执行期间的状态由 `ExecutionStatus` 枚举定义 (`packages/types/src/node.ts`)：

- `IDLE`: 空闲/未执行
- `PENDING`: 等待执行 (依赖未就绪)
- `RUNNING`: 正在执行
- `COMPLETED`: 执行成功
- `ERROR`: 执行出错
- `SKIPPED`: 被跳过 (节点禁用或条件不满足)

前端 (`apps/frontend-vueflow/src/components/graph/nodes/BaseNode.vue`) 根据后端状态更新 (通过 WebSocket 的 `NODE_STATUS_UPDATE` 消息) 改变节点视觉样式：

- **外框颜色**: 运行中 (`RUNNING`) - 黄色，成功 (`COMPLETED`) - 绿色，错误 (`ERROR`) - 红色，选中 (`selected`) - 蓝色。
- **透明度/边框**: 跳过 (`SKIPPED`) - 降低透明度，边框变虚线。
- **错误提示**: 错误状态下，节点标题变红，Tooltip 显示错误信息。

## WebSocket 通信

节点系统依赖 WebSocket (`packages/types/src/node.ts` 中的 `WebSocketMessageType`) 进行前后端通信：

- 工作流操作: `LOAD_WORKFLOW`, `SAVE_WORKFLOW`, `LIST_WORKFLOWS`
- 节点定义: `GET_NODE_DEFINITIONS`
- 执行控制: `EXECUTE_WORKFLOW`, `BUTTON_CLICK`
- 状态更新: `NODE_STATUS_UPDATE`, `WORKFLOW_STATUS_UPDATE`
- 结果/错误: `EXECUTION_RESULT`, `ERROR`
- 后端控制: `RELOAD_BACKEND`
- 操作确认: `WORKFLOW_LOADED`, `WORKFLOW_SAVED`, `WORKFLOW_LIST`, `NODE_DEFINITIONS`, `BACKEND_RELOADED`
