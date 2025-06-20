# ComfyTavern (Beta)

[![Status](https://img.shields.io/badge/status-Beta-orange)](https://github.com/ComfyTavern/comfytavern)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Stars](https://img.shields.io/github/stars/ComfyTavern/comfytavern?style=social)](https://github.com/ComfyTavern/comfytavern)

### 🌉 连接 AI 创作与终端体验

ComfyTavern 旨在搭建一座桥梁：将复杂的 AI 工作流，转化为简洁易用的交互式应用。
我们既为**创作者**提供强大、直观、可扩展的可视化节点编辑器来编排 AI 逻辑，也让**最终用户**无需理解底层节点，通过独立的**交互式应用面板（迷你应用）**，即可“开箱即用”地体验 AI 聊天、视觉小说、RPG、Agent 等功能。
同时，所有工作流能力也将通过 **开放 API** 提供给开发者。

平台兼顾了创作深度与使用便捷性——创作者专注于构建复杂的底层逻辑，而用户只需面对简洁、直达功能的成品应用界面。

**➡️ 当前核心体验：PC 端 VueFlow 节点编辑器 + 基础工作流执行。**

## [👉 快速开始](#-部署与运行)

---

### ✨ 核心特性 & ❓ 为何选择

ComfyTavern 的设计围绕：**高性能引擎 → 专业化编排 → 多渠道输出 (应用面板 & API)**

1.  **🚀 高性能、全链路流式引擎**

    - **特点**: 后端引擎专为实时交互设计。从数据输入、节点传递、异步处理到接口响应，全程支持流式处理和异步并发，确保数据低延迟流转，高效处理复杂任务。
    - **优势**: 为 AI 对话、动态内容生成等实时应用提供性能保障，通过 WebSocket 实时反馈执行状态。

2.  **🎨 专业可视化工作流编辑器**

    - **模块化节点组**：允许选中多个节点一键创建节点组，轻松将节点封装为可复用模块，提升构建效率。
    - **流畅体验**：提供精简 UI、丰富右键菜单、多级操作、拖拽、搜索、历史记录 (撤销/重做)、双剪贴板等。
    - **节点系统**：支持多种数据类型、自定义 Schema、内嵌交互组件（代码/JSON/Markdown）、客户端脚本扩展前端逻辑。
    - **易于扩展**：提供清晰的 TypeScript 接口，方便创建自定义节点。

3.  **🎯 平台定位：通用编排与应用构建**

    - **定位与范围**:
      - **与 ComfyUI 的侧重点不同**: ComfyUI 精于图像生成领域的工作流。ComfyTavern 的设计目标更广泛，覆盖通用逻辑、文本处理、LLM 交互、Agent 构建及最终应用层的封装，定位于一个通用的 AI 应用构建与执行平台，可以和 comfyui 组合使用。
      - **与 SillyTavern 的架构不同**: SillyTavern 作为一个优秀的前端界面，其核心优势在于为聊天场景提供了成熟且高度集成的上下文构建与管理功能。 ComfyTavern 的核心优势源于其**高度灵活和可编程的节点式工作流系统**。用户可以通过可视化方式自由组合节点，构建出远比传统预设更为精细、动态和强大的上下文生成逻辑、RAG (检索增强生成) 流程、多步推理链、乃至复杂的 Agent 行为。
    - **API 驱动架构**: 核心功能均通过内部 API（HTTP/WebSocket）暴露，前端本身即是 API 的使用者。这为平台未来发展为**独立后端服务 (Engine as a Service)** 和开放平台奠定了基础。

4.  **📱 灵活的输出方式：应用面板 & 开放 API (架构目标，建设中)**
    这是 ComfyTavern 的核心目标：

    - **面向最终用户：交互式应用面板 (App Panel)**
      - 将复杂工作流封装成带独立 UI 的“应用面板”（如聊天窗口、游戏界面）。
      - 用户面对简洁界面，而非节点连线，极大降低使用门槛。
      - 支持 AI 聊天、互动叙事、视觉小说、创意辅助、Agent 等场景。
    - **面向开发者：开放 API**
    - 后端已具备完善的 API 接口（Elysia + WebSocket）。
    - 未来将构建更稳定、文档化、易于集成的“服务化 API”和前端封装 API，简化外部应用和应用面板的调用。

5.  **⭐ 开发者友好 & 架构开放**
    - 支持 TypeScript 定义节点，鼓励社区贡献。
    - 清晰的前后端分离架构。
    - 计划提供工具，辅助迁移 SillyTavern 等平台资产 (如角色卡)。
    - （未来展望）规划构建统一知识库与 Agent 自更新架构，改进上下文理解和知识运用。

---

### 📄 文档

- **[节点类型系统](docs/node-types/node-types.zh.md)**：理解节点数据交互的基础。
- **[自定义节点开发指南](docs/guides/custom-node-development.zh.md)**：扩展 ComfyTavern 功能的步骤。

---

### 🚦 Roadmap / 路线图

项目正积极推进：

- **Phase 1: 核心基础 (已基本就绪)**

  - ✅ 可视化编辑器核心 (VueFlow, 拖拽、连接、参数、NodeGroup、预览等)
  - ✅ 后端节点定义与动态加载
  - ✅ 工作流执行引擎核心 (异步并发、全流程流式、任务管理)

- **Phase 2: 应用/服务输出 (近期核心)**

  - ⏳ 工作流 API 服务化封装、文档化与标准化
  - ⏳ 交互式应用面板 (App Panel) MVP (定义、封装、运行机制)

  * ⏳ 完善外部应用调用接口规范与认证

- **Phase 3: 智能增强 (中期规划)**

  - ⏳ 智能 LLM 服务编排与管理 (灵活适配器、智能路由、多渠道 API 管理、负载均衡)
  - ⏳ 深度情境知识引擎 (结构化知识管理、精细检索、动态上下文注入、Agent 交互)

- **Phase 4: Agent 生态 (远期愿景)**

  - 🔭 多智能体 (Multi-Agent) 协作基础 (基于知识引擎与 LLM 编排，支持复杂交互与动态工具调用)

- **其他规划**:
  - ⏳ 移动端适配 (如 Tauri)
  - ⏳ 内置 Agent 创作助手

---

### 🏗️ 项目结构

```
apps/
  ├── backend/            # 后端服务 (Elysia + Bun)
  └── frontend-vueflow/   # 前端 (Vue 3 + Vite + VueFlow)
docs/                     # 文档
packages/
  ├── types/              # 共享 TypeScript 类型定义 (Zod schemas)
  └── utils/              # 共享工具函数
plugins/
  └── nodes/              # 放置第三方/用户自定义节点
projects/                 # 用户项目数据，包含工作流等资源
library/                  # 全局共享资产库
```

---

### 🚀 部署与运行

**环境要求:**

- [Bun](https://bun.sh) v1.2.5+ (主要运行时)
- Node.js v18+ (用于开发工具)
- Windows / Linux / macOS
- (Docker 支持规划中)

**获取代码:**

- **Git 克隆 (推荐):**

```bash
git clone https://github.com/ComfyTavern/comfytavern.git
cd comfytavern
```

- **下载 ZIP:**
  - 下载 [GitHub 仓库打包](https://github.com/ComfyTavern/comfytavern/archive/refs/heads/main.zip)
  - 将其解压后，进入解压好的 comfytavern 文件夹。

**安装:**

```bash
bun install
```

如果遇到网络问题，可以尝试使用镜像源安装：

```bash
bun install --registry https://registry.npmmirror.com
```

**启动应用:**
| 平台        | 命令               | 描述                              |
| :---------- | :----------------- | :-------------------------------- |
| Windows     | `.\start.bat`      | 完整启动 (包含依赖检查和项目准备) |
| Linux/macOS | `./start.sh`       | 完整启动 (包含依赖检查和项目准备) |
| Windows     | `.\start_fast.bat` | 快速启动 (跳过依赖检查和项目准备) |
| Linux/macOS | `./start_fast.sh`  | 快速启动 (跳过依赖检查和项目准备) |

**启动开发模式:**
| 平台        | 命令                   | 描述             |
| :---------- | :--------------------- | :--------------- |
| Windows     | `.\start.bat dev`      | 完整启动开发模式 |
| Linux/macOS | `./start.sh dev`       | 完整启动开发模式 |
| Windows     | `.\start_fast.bat dev` | 快速启动开发模式 |
| Linux/macOS | `./start_fast.sh dev`  | 快速启动开发模式 |

**默认地址:**

- 前端: `http://localhost:5573/`
- 后端: `http://localhost:3233/`

---

### 🚀 开始使用：创建您的第一个工作流

首次启动并成功访问前端地址 (`http://localhost:5573/`) 后，您会看到应用的主页。此时，最近项目列表可能是空的。请按照以下步骤创建并进入您的第一个工作流编辑器：

1.  在页面左侧的导航边栏中，找到并点击“项目”。
2.  在项目列表页面，点击“创建新项目”按钮。
3.  在弹出的对话框中，输入您的项目名称，然后点击“确定”。
4.  项目创建成功后，系统会自动带您进入该项目的可视化节点编辑器界面。

现在，您可以开始搭建您的 AI 工作流了！

---

### 🛠️ 连接 AI 服务 (临时配置方法)

2.  **【重要：临时 API Key 配置】**:
    - 项目处于 Beta 阶段，统一的 AI 服务管理系统正在规划中。**当前**，您需要通过工作流内的特定节点临时配置 API Key 进行测试。
    - **⚠️ 安全注意**: 此方式会将 API Key 明文保存在工作流 `.json` 文件中。请妥善保管，切勿分享或提交包含密钥的文件！
    - **配置步骤**:
      1.  在编辑器中，从左侧 `TEST-LLM` 分类添加 `🦉API设置` (`APISettings`) 节点。
      2.  选中该节点，在参数中**直接填写** OpenAI (或兼容接口) 的 `API 基础 URL` 和 `API 密钥`。
      3.  从 `TEST-LLM` 分类添加 `🦉OpenAI聊天` (`OpenAINode`) 节点。
      4.  将 `🦉API设置` 的 `API 配置` 输出，连接到 `🦉OpenAI聊天` 的 `API 设置` 输入。
      5.  配置 `🦉OpenAI聊天` 的 `模型`、`用户提示` 等参数。
      6.  将 `🦉OpenAI聊天` 的输出 `回复流 (流式)`连接到工作流的 `组输出` 节点的 `*` 插槽（会自动转换类型）。
      7.  执行工作流。
    - **查看结果**:
      - 点击编辑器右侧的**预览面板切换按钮**（🔍 图标）展开面板。
      - **推荐**：在“**组总览**”模式下，直接查看连接到 `组输出` 节点的所有最终结果。
      - **可选**：右键点击某个节点的输出桩（小圆点），选择“设为预览”，面板将切换到“单一”模式显示该节点的中间数据。

**关于 `config.json`**:
首次启动应用时，系统会自动根据 [`config.template.json`](./config.template.json) 在项目根目录创建 `config.json` 文件。此文件包含了应用运行的一些基础设置，比如应用端口。

**数据库**:

本项目使用 SQLite 数据库存储数据。

- **首次启动与初始化**:
  当您首次运行项目（例如通过 `.\start.bat` 或 `./start.sh`）时，系统会自动检测数据库文件是否存在。如果不存在，它将自动创建数据库并应用最新的表结构。这个过程由 [`scripts/ensureProjectReady.ts`](scripts/ensureProjectReady.ts:1) 脚本处理，通常您无需手动干预。

- **数据库升级 (版本更新后)**:
  如果您更新了项目版本，并且该更新包含了对数据库表结构的更改（例如，添加了新的表或修改了现有表的字段），您可能需要手动应用这些数据库迁移。
  我们提供了一个专门的脚本来处理这种情况。您可以通过以下命令来升级数据库：

  ```bash
  bun run db:upgrade
  ```

  这个命令会生成新的迁移文件（如果需要）并应用所有待处理的迁移，确保您的数据库结构与最新代码保持一致。

---

### 🏭 使用 PM2 进行生产环境管理

对于生产环境部署，项目提供了通过 PM2 管理应用进程的脚本。PM2 是一个强大的进程管理器，可以帮助您保持应用在线、管理日志、监控性能等。

**基本用法:**

所有 PM2 相关操作都通过 `bun run manage:pm2` 命令执行，后跟具体的操作指令。

```bash
bun run manage:pm2 <action> [arguments]
```

**可用操作 (`<action>`):**

| 命令                  | 描述                                                                             |
| :-------------------- | :------------------------------------------------------------------------------- |
| `prepare`             | 准备生产环境，包括安装依赖、执行项目准备脚本和构建前端。                         |
| `start`               | （先执行 `prepare`）然后通过 PM2 启动所有在 `ecosystem.config.js` 中定义的服务。 |
| `stop`                | 通过 PM2 停止所有服务。                                                          |
| `restart`             | 通过 PM2 重启所有服务。                                                          |
| `delete`              | 通过 PM2 停止并删除所有服务。                                                    |
| `logs [service_name]` | 显示 PM2 日志。如果提供了 `service_name`，则只显示该服务的日志。                 |
| `list`                | 列出 PM2 管理的所有服务及其状态。                                                |
| `flush`               | 清空所有 PM2 日志。                                                              |

**示例:**

- 启动所有服务:
  ```bash
  bun run manage:pm2 start
  ```
- 查看所有服务状态:
  ```bash
  bun run manage:pm2 list
  ```
- 查看特定服务 (例如 `comfytavern-backend`) 的日志:
  ```bash
  bun run manage:pm2 logs comfytavern-backend
  ```
- 停止所有服务:
  ```bash
  bun run manage:pm2 stop
  ```

**注意:**

- 确保您已经在系统中全局安装了 PM2，或者通过 `bunx pm2` (脚本内部已使用 `bunx pm2`)。
- 服务的具体配置（如名称、启动脚本等）定义在项目根目录的 `ecosystem.config.js` 文件中。

---

### 🤝 贡献与反馈

项目处于早期 Beta 和高速迭代阶段，功能和 API 可能变动。欢迎反馈与贡献！

- **Bug 与建议**: [GitHub Issues](https://github.com/ComfyTavern/comfytavern/issues)
- **参与开发**: (贡献指南完善中，可通过 Issue 讨论)
- **社区**:
  - **Discord**: [ComfyTavern](https://discord.gg/VE8AM7t4n6) (施工中)

---

### 💻 技术栈

- **前端**: Vue 3 + TypeScript + Vite + [Vue Flow](https://vueflow.dev/)
- **后端**: [Bun](https://bun.sh/) + [Elysia](https://elysiajs.com/)
- **实时通信**: WebSocket

---

### 📜 许可证

本项目采用 [MIT License](./LICENSE) 开源。
