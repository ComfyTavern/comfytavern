# ComfyTavern 前端应用 (`frontend-vueflow`) `src/services` 目录分析报告

## 1. `services` 目录结构概述

`apps/frontend-vueflow/src/services` 目录当前结构非常简单，仅包含一个核心服务文件：

-   `SillyTavernService.ts`: 负责处理与 SillyTavern 相关的本地数据加载和管理，特别是角色卡（Character Cards）。

这种结构表明该目录旨在封装与外部服务或特定数据源（在此案例中是本地 SillyTavern 角色库）交互的逻辑。

## 2. 主要 Service 及其功能说明

### `SillyTavernService`

这是一个单例服务类 (`SillyTavernService.getInstance()`)，提供了与 SillyTavern 角色卡数据交互的集中管理。

**主要功能：**

1.  **加载角色卡 (`loadCharacterCards`, `getCharacterCards`)**:
    *   这是该 Service 的核心职责。它负责从本地文件系统加载 SillyTavern 角色卡。
    *   **与外部服务（SillyTavern 本地文件）的交互方式**:
        *   **非实时 API 调用**: 该服务**不直接**通过网络 API 与运行中的 SillyTavern 实例交互。
        *   **本地文件读取**: 它使用 Vite 的 `import.meta.glob` 功能动态扫描并加载位于 `@library/SillyTavern/CharacterCard/` 目录下的 `.png` 和 `.json` 文件。这是一种**本地文件系统交互**。
        *   **PNG 元数据提取**: 能够解析 PNG 图片文件，并使用 `png-chunks-extract` 和 `png-chunk-text` 库从 `tEXt` chunk 中提取嵌入的角色卡数据（支持 `ccv3` 和 `chara` 格式）。这是 SillyTavern 保存角色卡的一种标准方式。
        *   **JSON 文件加载**: 如果 PNG 文件中未嵌入数据，或者角色卡仅以 JSON 格式存在，它会加载相应的 `.json` 文件。
        *   **组合处理**: 它能正确处理同时存在 PNG 和 JSON 的情况，以及只有 JSON 文件的情况，确保不重复加载。
    *   **数据映射 (`mapCharacterToUI`)**: 将从文件加载的原始 `CharacterCard` 数据结构转换为前端 UI 组件更容易使用的 `CharacterCardUI` 格式，并进行一些简单的文本替换（例如 `{{char}}` -> 角色名）。
    *   **默认数据 (`getDefaultCharacters`)**: 提供了一组硬编码的默认角色卡，用于在无法从本地文件加载任何角色卡时（例如，目录为空或加载失败）提供基础示例。
    *   **公共接口 (`getCharacterCards`)**: 这是外部模块（如 Vue 组件或 Store）应调用的主要方法，它封装了加载逻辑和回退到默认数据的机制。

2.  **潜在扩展功能 (注释中提及)**:
    *   加载预设 (`loadPresets`)
    *   加载世界信息 (`loadWorldInfo`)
    *   保存/删除/导入/导出角色卡 (`save/delete/export/importCharacterCard`)

**总结**: `SillyTavernService` 目前专注于从本地文件系统加载和处理 SillyTavern 角色卡数据，为前端应用提供统一的数据接口。它通过读取特定目录下的 PNG 和 JSON 文件与 SillyTavern 的数据进行交互，而不是通过实时 API。

## 3. 其他后端交互逻辑

需要注意的是，`src/services` 目录当前仅包含与本地 SillyTavern 数据交互的服务。其他与后端服务器的交互逻辑位于项目的不同部分：

*   **RESTful API 请求**: 主要封装在 `src/api/` 目录下的模块中，使用 Axios 库与后端进行通信，用于加载/保存工作流、获取节点定义、管理项目等。
*   **WebSocket 通信**: 由 `src/composables/workflow/useWebSocket.ts` 这个 Composable 函数负责处理。它管理与后端 `/ws` 端点的连接，用于接收实时的执行状态更新等信息。**近期，WebSocket 连接管理已被重构为全局单例模式，该 Composable 已更新以适配，解决了先前存在的一些连接问题。**
*   **节点事件处理解耦**: 节点按钮点击等事件的处理逻辑已从 WebSocket 通信中解耦。