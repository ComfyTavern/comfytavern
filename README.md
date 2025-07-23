# ComfyTavern (Beta)

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/ComfyTavern/comfytavern)
[![Status](https://img.shields.io/badge/status-Beta-orange)](https://github.com/ComfyTavern/comfytavern)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](./LICENSE)
[![Stars](https://img.shields.io/github/stars/ComfyTavern/comfytavern?style=social)](https://github.com/ComfyTavern/comfytavern)

<p align="center">
  <img alt="ComfyTavern Banner" src="docs/images/ComfyTavern(Beta)_Banner.png">
</p>

<p align="center">
  <a href="./README.md"><b>简体中文</b></a>
  &nbsp;•&nbsp;
  <a href="./README.en.md">English</a>
  &nbsp;•&nbsp;
  <a href="./README.ja.md">日本語</a>
  &nbsp;•&nbsp;
  <a href="./README.ru.md">Русский</a>
  &nbsp;•&nbsp;
  <a href="./README.wyw.md">文言</a>
</p>

### 🌉 连接 AI 创作与终端体验

ComfyTavern 是一个面向创作者和最终用户的 AI 创作与应用平台。它致力于将复杂的 AI 工作流，转化为直观、好用、可交互的**迷你应用**。

我们为**创作者**提供强大、流畅的可视化节点编辑器来编排 AI 逻辑；同时，让**最终用户**无需关心底层技术，通过独立的**应用面板**，就能“开箱即用”地体验 AI 聊天、视觉小说、智能代理 (Agent) 等丰富功能。

我们相信，AI 的力量不仅在于创造过程的精妙，更在于最终体验的便捷。

**➡️ 当前核心：PC 端 VueFlow 节点编辑器 + 插件化扩展 + 统一文件资产管理。**

## [👉 快速上手](#-安装与启动)

---

## 📸 界面一览

<p align="center">
  <img alt="主页" src="docs/images/首页-主页-中文-暗色-暖阳余晖主题.png" width="49%">
  <img alt="工作流编辑器" src="docs/images/项目-工作流编辑器-LLM适配器演示工作流-节点库-节点预览-执行输出预览.png" width="49%">
</p>
<p align="center">
  <img alt="文件管理" src="docs/images/首页-文件管理-中文-暗色.png" width="32%">
  <img alt="设置-暗色" src="docs/images/首页-设置-显示-中文-暗色-樱花烂漫主题.png" width="32%">
  <img alt="设置-亮色" src="docs/images/首页-设置-显示-英语-亮色-默认主题.png" width="32%">
</p>

---

### ✨ 核心特性

ComfyTavern 的设计围绕三大支柱：**专业的编排工具 → 开放的应用生态 → 独特的智能体架构**。

#### 1. 🚀 能力：高性能引擎与专业级编辑器

- **全链路流式引擎**: 后端专为实时交互设计。从输入、节点传递到接口响应，全程支持流式处理和异步并发，通过 WebSocket 实时反馈执行状态，为 AI 对话、动态内容生成等应用提供性能保障。
- **专业可视化编辑器**:
  - **模块化节点组**：一键创建节点组，将复杂逻辑封装为可复用模块。
  - **流畅体验**：精简 UI、丰富右键菜单、多级操作、双剪贴板、历史记录等。
  - **强大节点系统**：支持多种数据类型、自定义 Schema、内嵌交互组件、客户端脚本扩展。

#### 2. ⭐ 生态：开放、兼容与开发者友好

- **插件化架构**: 前后端均支持插件化扩展。开发者可以轻松创建自定义节点、UI组件，甚至集成新的服务，并通过插件管理器动态加载。
- **统一文件资产管理 (FAM)**: 提供可视化的文件管理器，支持项目级和用户级的文件操作，为 AI 应用提供可靠的数据和资产管理基础。
- **应用面板 SDK**: 提供专用的 `@comfytavern/panel-sdk`，使开发者能轻松构建与主应用安全通信的交互式应用面板，将工作流封装为最终产品。
- **API 驱动**: 核心功能均通过 API (HTTP/WebSocket) 暴露，为第三方集成和未来发展为**独立后端服务 (Engine as a Service)** 奠定基础。

#### 3. 🎯 愿景：以自主智能体 (Agent) 为核心的应用架构

这不只是一个功能，而是 ComfyTavern 区别于其他平台的架构基石。我们并非简单地复制或组合现有工具，而是提供一个全新的范式：

- **与 ComfyUI 的侧重点不同**: ComfyUI 精于图像生成。ComfyTavern 目标更广，是一个通用的 AI 应用构建与执行平台，覆盖逻辑、文本、LLM 交互与 Agent 构建，可以和 ComfyUI 组合使用。
- **与 SillyTavern 的架构不同**: SillyTavern 是一个优秀的聊天前端。ComfyTavern 的核心优势则源于其**统一的自主智能体 (Agent) 架构**。我们以“场景 (Scene)”为核心，构建了一个能让 Agent “活起来”的运行环境：
  - **Agent 是拥有“大脑”和“记忆”的执行核心**: 每个 Agent 都被设计为拥有内在“审议循环”、长期记忆（知识库）和可调用技能（工作流）的实体。
  - **应用面板 (App Panel) 是 Agent 与用户交互的“面孔”**: 它不再是固定的 UI，而是与 Agent 异步通信、实时响应其状态的动态前端，构建真正有生命力的交互体验。

这种架构使创作者能构建出远超传统预设的、真正具备动态行为和学习潜力的 AI 应用。

---

### 📄 文档

- **[项目概览](DesignDocs/整理/ProjectOverview.md)**：深入了解项目架构、技术选型和核心模块。
- **[自定义节点开发指南](docs/guides/custom-node-development.zh.md)**：扩展 ComfyTavern 功能的步骤。
- **[插件与工具架构](DesignDocs/architecture/unified-plugin-and-tool-architecture.md)**：了解插件系统的工作原理。
- **[文件资产管理指南](docs/guides/file-asset-management-guide.md)**：了解文件系统的设计和使用。
- **[应用面板 SDK 开发指南](docs/guides/panel-sdk-guide.md)**：学习如何创建交互式应用面板。

---

### 🚦 路线图 (Roadmap)

项目正积极推进中：

- **Phase 1: 核心引擎与扩展性 (已就绪)**
  - ✅ 可视化编辑器核心 (VueFlow)
  - ✅ 后端节点动态加载与执行引擎 (异步、流式)
  - ✅ 前后端插件化架构
  - ✅ 统一文件资产管理 (FAM)
  - ✅ 应用面板 SDK (Panel SDK)

- **Phase 2: 应用与服务化 (近期核心)**
  - ⏳ **Agent 运行时**: 实现 Agent 加载与核心“审议-行动”循环。
  - ⏳ **场景化基础设施**: 搭建隔离的事件总线与共享世界状态。
  - ⏳ **交互式应用 MVP**: 打通应用面板与 Agent 的首次端到端异步通信。
  - ⏳ **API 标准化**: 持续封装和优化工作流 API。

- **Phase 3: 智能核心：记忆与学习 (中期规划)**
  - ⏳ **结构化知识库**: 完善 Agent 的可靠长期记忆机制。
  - ⏳ **Agent 自我进化**: 赋予 Agent 通过反思向知识库贡献经验的能力。
  - ⏳ **LLM 服务编排**: 引入更灵活的 LLM 服务适配器。

- **Phase 4: 生态构建：多智能体协作 (远期愿景)**
  - 🔭 **多智能体协作**: 探索和支持多 Agent 在同一场景下的协作模式。
  - 🔭 **开发者生态**: 提供标准化的 Agent 与面板模板，构建创作者社区。

---

### 🏗️ 项目结构

```
apps/
  ├── backend/            # 后端服务 (Elysia + Bun)
  └── frontend-vueflow/   # 前端 (Vue 3 + Vite + VueFlow)
packages/
  ├── types/              # 共享 TypeScript 类型
  ├── utils/              # 共享工具函数
  └── panel-sdk/          # 应用面板 SDK
plugins/                  # 用户自定义插件
userData/                 # 用户数据根目录 (包含项目、配置等)
...
```

---

### 🚀 安装与启动

**环境要求:**

- [Bun](https://bun.sh) v1.2.5+ (主要运行时)
- Node.js v20+ (用于开发工具)
- Windows / Linux / macOS

**1. 获取代码:**

```bash
git clone https://github.com/ComfyTavern/comfytavern.git
cd comfytavern
```

> 或从 [GitHub 仓库打包](https://github.com/ComfyTavern/comfytavern/archive/refs/heads/main.zip) 下载 ZIP 并解压。

**2. 安装依赖:**

```bash
bun install
```

> 如果遇到网络问题，可尝试淘宝镜像: `bun install --registry https://registry.npmmirror.com`

**3. 启动应用:**

项目提供了一键启动脚本，会自动处理环境检查、依赖安装、数据库初始化等。

| 平台        | 生产模式      | 开发模式          |
| :---------- | :------------ | :---------------- |
| Windows     | `.\start.bat` | `.\start.bat dev` |
| Linux/macOS | `./start.sh`  | `./start.sh dev`  |

- **日常开发中**，若确认配置无变化，可使用 **快速启动** 跳过检查以提升速度：

| 平台        | 生产模式           | 开发模式               |
| :---------- | :----------------- | :--------------------- |
| Windows     | `.\start_fast.bat` | `.\start_fast.bat dev` |
| Linux/macOS | `./start_fast.sh`  | `./start_fast.sh dev`  |

**默认地址:**

- 前端: `http://localhost:5573/`
- 后端: `http://localhost:3233/`

**强制重新构建前端**

启动脚本默认会跳过已存在的前端构建。如果修改了前端代码，请运行 `bun run build` 强制重新构建。

---

### 🛠️ 开始使用

#### 第一步：创建项目

1.  启动成功后，访问 `http://localhost:5573/`（默认端口）。
2.  从左侧导航栏进入 **项目列表** 页面。
3.  点击 **创建新项目** 按钮，输入项目名称并确认，您将进入该项目的 **总览页面**。

#### 第二步：连接 AI 服务

在开始创作前，建议先配置 AI 服务，以便在工作流中调用。

1.  前往主页左侧导航栏的 **设置** -> **模型配置** 页面。
2.  点击 **新建渠道**，选择您的 AI 服务商，并填入 `Base URL` 和 `API Key`。
3.  添加该渠道支持的模型 ID (例如 `gpt-4o`) 并保存。

#### 第三步：创建并编辑工作流

1.  在项目总览页面，点击进入 **工作流编辑器**。
2.  **添加节点**: 从左侧节点库的 `LLM` 分类下添加 `💬创建消息` 和 `⚡通用 LLM 请求` 节点。
3.  **填写内容**: 在 `💬创建消息` 节点输入问题，在 `⚡通用 LLM 请求` 节点填入上一步配置好的模型 ID。
4.  **连接数据流**: 将 `💬创建消息` 的 `消息` 输出，连接到 `⚡通用 LLM 请求` 的 `消息列表` 输入。

#### 第四步：执行并查看结果

1.  点击画布上方的 **执行** 按钮。
2.  所有节点的输出会实时发送到右侧的 **预览面板**。点击编辑器右下角的 **预览** (🔍 图标) 按钮可展开或收起面板。
3.  **推荐用法**:
    - 在“**组总览**”模式下，可以清晰地看到所有连接到 `组输出` 节点的最终结果。
    - 也可右键单击任一节点的输出桩，选择“**设为预览**”来单独观察该节点的中间数据。

---

### ⚙️ 进阶管理

#### 数据库

本项目使用 SQLite，首次启动时会自动创建和迁移。当您更新版本后，如果涉及数据库结构变更，请执行 `bun run db:upgrade`。

#### 生产环境 (PM2)

项目提供了通过 PM2 进行生产环境部署和管理的脚本。

- **启动所有服务**: `bun run manage:pm2 start`
- **查看所有服务状态**: `bun run manage:pm2 list`
- **查看日志**: `bun run manage:pm2 logs comfytavern-backend`
- **停止所有服务**: `bun run manage:pm2 stop`

---

### 🤝 贡献与反馈

项目处于早期 Beta 和高速迭代阶段，功能和 API 可能变动。欢迎反馈与贡献！

- **Bug 与建议**: [GitHub Issues](https://github.com/ComfyTavern/comfytavern/issues)
- **参与开发**: (贡献指南完善中，可通过 Issue 讨论)
- **社区**:
  - **Discord**: [ComfyTavern](https://discord.gg/VE8AM7t4n6) (施工中)

---

### 💻 技术栈

- **前端**: Vue 3 + TypeScript + Vite + [Vue Flow](https://vueflow.dev/) + Pinia + Tailwind CSS
- **后端**: [Bun](https://bun.sh/) + [Elysia](https://elysiajs.com/) + Drizzle ORM (SQLite)
- **实时通信**: WebSocket

---

### 📜 许可证 (License)

本项目采用**双重授权 (Dual-Licensing)**模式，旨在平衡社区的开放共享与项目的可持续发展。

#### 1. 开源许可证：GNU AGPLv3

对于个人开发者、学术研究、非营利组织以及任何非商业性项目，ComfyTavern 在 **GNU Affero General Public License v3.0 (AGPLv3)** 许可下提供。

**核心要求**：如果您修改 ComfyTavern 的源代码，或将其作为后端通过网络向用户提供服务，您必须以同样的 AGPLv3 许可证开放您的完整项目源代码。

我们鼓励基于 ComfyTavern 的学习、创新和非商业性分享。

#### 2. 商业许可证 (Commercial License)

对于希望在商业环境中使用 ComfyTavern 的组织和个人，我们提供商业许可证。

**以下情况必须购买商业许可证：**

*   将 ComfyTavern 用于任何**闭源**的商业产品或服务中。
*   在公司内部使用 ComfyTavern 以支持商业运营（例如，作为内部工具链的一部分）。
*   向付费用户提供基于 ComfyTavern 的托管服务 (SaaS)。
*   任何不希望受 AGPLv3 开源义务约束的商业场景。

商业许可证将为您免除 AGPLv3 的开源要求，并根据协议提供相应的技术支持和法律保障。

---

我们相信，这种模式能够让 ComfyTavern 在服务社区的同时，获得必要的资金支持，从而走得更远、更稳。

**➡️ 如需咨询或购买商业许可证，请联系我们：comfytavern@yeah.net**
