# ComfyTavern 插件系统设计计划

## 1. 目标

*   **可扩展性**: 允许第三方开发者轻松创建和集成新的节点、UI 组件（插槽小部件、预制 UI）和客户端逻辑。
*   **易用性**:
    *   **开发者**: 提供清晰的结构、声明式配置和辅助工具，简化插件开发。
    *   **用户**: 实现简单的“拖放式”安装体验。
*   **灵活性**: 支持多种前端技术（Vue, Web Components, 原生 JS/HTML/CSS）用于创建自定义 UI。
*   **可复用性**: 促进 UI 组件在不同插件或核心功能间的共享。
*   **关注点分离**: 保持后端逻辑、前端 UI 和节点定义的清晰分离。
*   **兼容性**: 与现有项目结构（`apps/backend`, `apps/frontend-vueflow`）良好集成。

## 2. 核心架构

采用基于**标准化插件结构**和**声明式清单文件 (`plugin.json`)** 的方案。

### 2.1. 插件目录结构 (推荐)

```
ComfyTavern/
├── plugins/                 # 插件根目录
│   └── my-cool-plugin/      # 单个插件目录
│       ├── nodes/           # 后端节点定义 (.ts)
│       ├── widgets/         # 前端插槽 UI 组件 (Vue 或 Web Components)
│       ├── prefabs/         # 前端预制 UI 组件 (供“玩家”UI 使用)
│       ├── client-scripts/  # 节点引用的客户端脚本 (.js)
│       ├── assets/          # 静态资源 (图片, CSS)
│       ├── plugin.json      # 插件清单文件 (核心)
│       └── README.md        # 说明文档
└── ... (其他项目文件)
```

### 2.2. 插件清单文件 (`plugin.json`)

用于声明插件内容和元数据，驱动加载过程。

```json
{
  "name": "my-cool-plugin", // 插件唯一标识符
  "version": "1.0.0",
  "displayName": "我的酷炫插件",
  "description": "提供酷炫的节点和 UI。",
  "author": "开发者名称",
  "tavernVersion": ">=1.0.0", // 兼容的 ComfyTavern 版本

  "paths": { // 各类资源的相对路径 (相对于插件根目录)
    "nodes": "nodes/",
    "widgets": "widgets/",
    "prefabs": "prefabs/",
    "clientScripts": "client-scripts/",
    "assets": "assets/"
  },

  // 声明式注册前端组件
  "components": {
    "widgets": { // 插槽小部件 (类型 -> 组件映射)
      "MY_COLOR_TYPE": {
        "component": "./widgets/ColorPickerInput.vue" // Vue 组件路径
      },
      "MY_IMAGE_PREVIEW": {
        "component": "./widgets/ImagePreviewWidget.wc.js", // Web Component JS 路径
        "tag": "image-preview-widget" // Web Component 标签名
      }
    },
    "prefabs": { // 预制 UI 组件 (ID -> 组件映射)
      "CharacterSheet": {
        "component": "./prefabs/CharacterSheet.vue"
      },
      "InventoryPanel": {
        "component": "./prefabs/InventoryPanel.wc.js",
        "tag": "inventory-panel"
      }
    }
  },

  "dependencies": { // (可选) 插件依赖
    "core-ui-components": ">=1.2.0"
  }
}
```

### 2.3. 加载机制

*   **后端 (`apps/backend`)**:
    *   扩展 `NodeLoader` (或新建 `PluginManager`) 扫描 `plugins/` 目录。
    *   读取每个插件的 `plugin.json`。
    *   根据 `paths.nodes` 加载节点定义。
    *   收集所有插件的清单信息，通过 API 或 WebSocket 提供给前端。
*   **前端 (`apps/frontend-vueflow`)**:
    *   实现 `PluginLoaderService` (或类似机制)。
    *   从后端获取所有插件的清单信息。
    *   遍历 `components` 部分：
        *   使用**动态导入** (`import()`) 加载 `component` 指定的前端资源文件（路径需正确解析为相对于 Web 服务器根目录或通过别名）。
        *   **Widgets**: 调用 `registerInputComponent` (需要先实现该函数) 注册 Vue 或 Web Component 小部件。
        *   **Prefabs**: 注册 Vue 组件（全局或局部）或加载 Web Component 定义脚本。
    *   确保 `useNodeClientScript` 能加载插件 `client-scripts/` 目录下的脚本。

### 2.4. 资源服务

*   需要配置 Web 服务器（开发或生产）以正确提供对 `plugins/` 目录下前端静态资源（JS, Vue, CSS, assets）的访问。
*   或者，调整构建流程，将插件的前端资源复制或打包到 `apps/frontend-vueflow` 的可访问目录下。

## 3. 实现步骤

### 3.1. 后端 (`apps/backend`)

1.  [ ] 实现扫描 `plugins/` 目录并解析 `plugin.json` 的逻辑。
2.  [ ] 修改 `NodeLoader` 以加载插件 `nodes/` 目录下的节点。
3.  [ ] 创建 API 端点或 WebSocket 消息，用于向前端发送已加载插件的清单信息。

### 3.2. 前端 (`apps/frontend-vueflow`)

1.  [ ] **实现 `registerInputComponent`**: (已完成部分，需要确认最终实现) 允许动态注册插槽类型到 Vue 组件或 Web Component 的映射。
2.  [ ] **实现 `PluginLoaderService`**:
    *   [ ] 从后端获取插件清单数据。
    *   [ ] 实现动态导入插件组件文件的逻辑（处理路径解析）。
    *   [ ] 调用 `registerInputComponent` 注册 Widgets。
    *   [ ] 实现 Prefabs 组件的注册/加载逻辑。
3.  [ ] **扩展 `getInputComponent`**: (已完成部分) 确保它能使用 `registerInputComponent` 注册的组件。
4.  [ ] **扩展 Web Component 支持**:
    *   [ ] 确保框架能在渲染时创建指定的自定义元素标签。
    *   [ ] 实现与自定义元素的数据绑定（属性传递、事件监听）。
5.  [ ] **扩展 `useNodeClientScript`**: 确保能加载插件目录中的脚本。
6.  [ ] **配置 Vite/Web 服务器**: 确保能访问 `plugins/` 目录下的资源。

### 3.3. 共享类型 (`packages/types`)

1.  [ ] (可选) 考虑是否需要在 `NodeDefinition`, `InputDefinition` 等接口中添加与插件系统相关的字段（如果采用在定义中声明组件而非完全依赖 `plugin.json` 的方式）。

### 3.4. 开发者体验

1.  [ ] 编写 `plugin.json` 的详细规范文档。
2.  [ ] 提供插件目录结构的示例。
3.  [ ] (推荐) 开发一个简单的 CLI 工具 (`comfytavern-plugin-cli`)：
    *   [ ] `init`: 创建插件项目骨架。
    *   [ ] `validate`: 校验 `plugin.json`。
    *   [ ] `package`: 打包插件为 `.zip`。

## 4. 待讨论/挑战

*   **依赖管理**: 如何处理插件之间的依赖关系？（初步想法：在 `plugin.json` 中声明，加载器按顺序加载）。
*   **组件冲突**: 如何处理不同插件注册同名组件（Widgets/Prefabs）或 Web Component 标签？（初步想法：警告，使用第一个加载的，或按版本选择）。
*   **版本控制**: 如何处理插件与 ComfyTavern 核心版本以及插件之间的版本兼容性？(`tavernVersion` 和 `dependencies` 字段)。
*   **安全性**: 加载和执行第三方代码（尤其是客户端脚本）的安全风险评估和缓解措施。
*   **构建/部署**: 如何在生产环境中最好地处理插件前端资源的打包和部署？