# ComfyTavern (Beta)

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/ComfyTavern/comfytavern)
[![Status](https://img.shields.io/badge/status-Beta-orange)](https://github.com/ComfyTavern/comfytavern)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](./LICENSE)
[![Stars](https://img.shields.io/github/stars/ComfyTavern/comfytavern?style=social)](https://github.com/ComfyTavern/comfytavern)

<p align="center">
  <a href="./README.md">简体中文</a>
  &nbsp;•&nbsp;
  <a href="./README.en.md"><b>English</b></a>
  &nbsp;•&nbsp;
  <a href="./README.ja.md">日本語</a>
  &nbsp;•&nbsp;
  <a href="./README.ru.md">Русский</a>
  &nbsp;•&nbsp;
  <a href="./README.wyw.md">文言</a>
</p>

### 🌉 Connecting AI Creation with End-User Experience

ComfyTavern is an AI creation and application platform for creators and end-users. It is dedicated to transforming complex AI workflows into intuitive, user-friendly, and interactive **mini-applications**.

We provide **creators** with a powerful, fluid visual node editor to orchestrate AI logic; simultaneously, we enable **end-users** to experience rich AI functionalities like AI chat, visual novels, and intelligent agents (Agent) "out-of-the-box" through independent **application panels**, without needing to understand the underlying technology.

We believe that the power of AI lies not only in the sophistication of the creation process but also in the convenience of the final experience.

**➡️ Current Core: PC-based VueFlow Node Editor + Plugin Extensions + Unified File Asset Management.**

## [👉 Quick Start](#-installation-and-startup)

---

## 📸 Interface Preview

<p align="center">
  <img alt="Home" src="docs/images/首页-主页-中文-暗色-暖阳余晖主题.png" width="49%">
  <img alt="Workflow Editor" src="docs/images/项目-工作流编辑器-LLM适配器演示工作流-节点库-节点预览-执行输出预览.png" width="49%">
</p>
<p align="center">
  <img alt="File Manager" src="docs/images/首页-文件管理-中文-暗色.png" width="32%">
  <img alt="Settings - Dark" src="docs/images/首页-设置-显示-中文-暗色-樱花烂漫主题.png" width="32%">
  <img alt="Settings - Light" src="docs/images/首页-设置-显示-英语-亮色-默认主题.png" width="32%">
</p>

---

### ✨ Core Features

ComfyTavern's design revolves around three main pillars: **professional orchestration tools → open application ecosystem → unique intelligent agent architecture.**

#### 1. 🚀 Capability: High-Performance Engine and Professional Editor

-   **Full-link Streaming Engine**: The backend is specifically designed for real-time interaction. From input and node transmission to API response, it fully supports streaming and asynchronous concurrency, providing real-time feedback on execution status via WebSocket, ensuring performance for AI conversations, dynamic content generation, and other applications.
-   **Professional Visual Editor**:
    -   **Modular Node Groups**: Create node groups with one click, encapsulating complex logic into reusable modules.
    -   **Smooth Experience**: Streamlined UI, rich right-click menus, multi-level operations, dual clipboards, history, etc.
    -   **Powerful Node System**: Supports various data types, custom schemas, embedded interactive components, and client-side script extensions.

#### 2. ⭐ Ecosystem: Open, Compatible, and Developer-Friendly

-   **Plugin Architecture**: Both frontend and backend support plugin extensions. Developers can easily create custom nodes, UI components, and even integrate new services, dynamically loading them via the plugin manager.
-   **Unified File Asset Management (FAM)**: Provides a visual file manager that supports project-level and user-level file operations, providing a reliable data and asset management foundation for AI applications.
-   **Application Panel SDK**: Provides a dedicated `@comfytavern/panel-sdk` to enable developers to easily build interactive application panels that securely communicate with the main application, encapsulating workflows into final products.
-   **API Driven**: Core functionalities are exposed via API (HTTP/WebSocket), laying the foundation for third-party integrations and future evolution into an **Engine as a Service**.

#### 3. 🎯 Vision: Agent-centric Application Architecture

This is not just a feature, but the architectural cornerstone that distinguishes ComfyTavern from other platforms. We are not simply replicating or combining existing tools; instead, we offer a new paradigm:

-   **Different focus from ComfyUI**: ComfyUI excels at image generation. ComfyTavern aims broader, as a general-purpose AI application building and execution platform, covering logic, text, LLM interaction, and Agent construction, and can be used in combination with ComfyUI.
-   **Different architecture from SillyTavern**: SillyTavern is an excellent chat frontend. ComfyTavern's core advantage stems from its **unified autonomous agent (Agent) architecture**. We build a runtime environment where Agents "come alive," centered around "Scenes":
    -   **Agents are the execution core with "brains" and "memory"**: Each Agent is designed as an entity with an internal "deliberation loop," long-term memory (knowledge base), and callable skills (workflows).
    -   **Application Panels are the "face" of Agent-user interaction**: They are no longer fixed UIs, but dynamic frontends that communicate asynchronously with Agents and respond to their states in real-time, building truly vibrant interactive experiences.

This architecture enables creators to build AI applications with dynamic behavior and learning potential that far exceed traditional presets.

---

### 📄 Documentation

-   **[Project Overview](DesignDocs/整理/ProjectOverview.md)**: In-depth understanding of project architecture, technology selection, and core modules.
-   **[Custom Node Development Guide](docs/guides/custom-node-development.zh.md)**: Steps to extend ComfyTavern's functionality.
-   **[Plugin and Tool Architecture](DesignDocs/architecture/unified-plugin-and-tool-architecture.md)**: Understanding how the plugin system works.
-   **[File Asset Management Guide](docs/guides/file-asset-management-guide.md)**: Understanding the design and use of the file system.
-   **[Application Panel SDK Development Guide](docs/guides/panel-sdk-guide.md)**: Learning how to create interactive application panels.

---

### 🚦 Roadmap

The project is actively progressing:

-   **Phase 1: Core Engine and Extensibility (Ready)**
    -   ✅ Visual Editor Core (VueFlow)
    -   ✅ Backend Node Dynamic Loading and Execution Engine (Asynchronous, Streaming)
    -   ✅ Frontend and Backend Plugin Architecture
    -   ✅ Unified File Asset Management (FAM)
    -   ✅ Application Panel SDK (Panel SDK)

-   **Phase 2: Application and Servitization (Recent Core)**
    -   ⏳ **Agent Runtime**: Implement Agent loading and core "deliberation-action" loop.
    -   ⏳ **Scene-based Infrastructure**: Build isolated event bus and shared world state.
    -   ⏳ **Interactive Application MVP**: Establish the first end-to-end asynchronous communication between application panels and Agents.
    -   ⏳ **API Standardization**: Continuously encapsulate and optimize workflow APIs.

-   **Phase 3: Intelligent Core: Memory and Learning (Mid-term Plan)**
    -   ⏳ **Structured Knowledge Base**: Improve Agent's reliable long-term memory mechanism.
    -   ⏳ **Agent Self-Evolution**: Empower Agents to contribute experience to the knowledge base through reflection.
    -   ⏳ **LLM Service Orchestration**: Introduce more flexible LLM service adapters.

-   **Phase 4: Ecosystem Building: Multi-Agent Collaboration (Long-term Vision)**
    -   🔭 **Multi-Agent Collaboration**: Explore and support collaborative modes for multiple Agents in the same scene.
    -   🔭 **Developer Ecosystem**: Provide standardized Agent and panel templates, building a creator community.

---

### 🏗️ Project Structure

```
apps/
  ├── backend/            # Backend Service (Elysia + Bun)
  └── frontend-vueflow/   # Frontend (Vue 3 + Vite + VueFlow)
packages/
  ├── types/              # Shared TypeScript Types
  ├── utils/              # Shared Utility Functions
  └── panel-sdk/          # Application Panel SDK
plugins/                  # User Custom Plugins
userData/                 # User Data Root Directory (includes projects, configurations, etc.)
...
```

---

### 🚀 Installation and Startup

**Environment Requirements:**

-   [Bun](https://bun.sh) v1.2.5+ (Main Runtime)
-   Node.js v20+ (for development tools)
-   Windows / Linux / macOS

**1. Get the Code:**

```bash
git clone https://github.com/ComfyTavern/comfytavern.git
cd comfytavern
```
> Or download the ZIP and extract from [GitHub Repository Archive](https://github.com/ComfyTavern/comfytavern/archive/refs/heads/main.zip).

**2. Install Dependencies:**

```bash
bun install
```
> If you encounter network issues, try Taobao mirror: `bun install --registry https://registry.npmmirror.com`

**3. Start the Application:**

The project provides a one-click startup script that automatically handles environment checks, dependency installation, database initialization, etc.

| Platform        | Production Mode      | Development Mode          |
| :---------- | :------------ | :---------------- |
| Windows     | `.\start.bat` | `.\start.bat dev` |
| Linux/macOS | `./start.sh`  | `./start.sh dev`  |

-   **For daily development**, if you confirm no configuration changes, you can use **Fast Startup** to skip checks for faster speed:

| Platform        | Production Mode               | Development Mode               |
| :---------- | :--------------------- | :--------------------- |
| Windows     | `.\start_fast.bat`     | `.\start_fast.bat dev` |
| Linux/macOS | `./start_fast.sh`      | `./start_fast.sh dev`  |

**Default Addresses:**

-   Frontend: `http://localhost:5573/`
-   Backend: `http://localhost:3233/`

**Forcing a Frontend Rebuild**

The startup script will skip existing frontend builds by default. If you have modified the frontend code, please run `bun run build` to force a rebuild.

---

### 🛠️ Getting Started

#### Step One: Create a Project

1.  After successful startup, visit `http://localhost:5573/` (default port).
2.  Navigate to the **Project List** page from the left sidebar.
3.  Click the **Create New Project** button, enter a project name, and confirm. You will then enter the project's **Overview Page**.

#### Step Two: Connect AI Services

Before starting creation, it is recommended to configure AI services for use in workflows.

1.  Go to the **Settings** -> **Model Configuration** page in the left navigation bar on the homepage.
2.  Click **New Channel**, select your AI service provider, and fill in the `Base URL` and `API Key`.
3.  Add the model IDs supported by this channel (e.g., `gpt-4o`) and save.

#### Step Three: Create and Edit Workflow

1.  On the project overview page, click to enter the **Workflow Editor**.
2.  **Add Nodes**: From the `LLM` category in the left node library, add `💬Create Message` and `⚡Generic LLM Request` nodes to the canvas.
3.  **Fill Content**: Enter your question in the `💬Create Message` node, and fill in the model ID configured in the previous step in the `⚡Generic LLM Request` node.
4.  **Connect Data Flow**: Connect the `Message` output of `💬Create Message` to the `Message List` input of `⚡Generic LLM Request`.

#### Step Four: Execute and View Results

1.  Click the **Execute** button above the canvas.
2.  All node outputs will be sent in real-time to the **Preview Panel** on the right. Click the **Preview** (🔍 icon) button in the bottom right corner of the editor to expand or collapse the panel.
3.  **Recommended Usage**:
    -   In "**Group Overview**" mode, you can clearly see all final results connected to the `Group Output` node.
    -   You can also right-click any node's output handle and select "**Set as Preview**" to observe the intermediate data of that node individually.

---

### ⚙️ Advanced Management

#### Database

This project uses SQLite, which will be automatically created and migrated on first startup. If you update the version and it involves database structure changes, please run `bun run db:upgrade`.

#### Production Environment (PM2)

The project provides scripts for production environment deployment and management via PM2.

-   **Start all services**: `bun run manage:pm2 start`
-   **View all service statuses**: `bun run manage:pm2 list`
-   **View logs**: `bun run manage:pm2 logs comfytavern-backend`
-   **Stop all services**: `bun run manage:pm2 stop`

---

### 🤝 Contribution and Feedback

The project is in its early Beta and rapid iteration phase, and functionalities and APIs may change. Feedback and contributions are welcome!

-   **Bugs and Suggestions**: [GitHub Issues](https://github.com/ComfyTavern/comfytavern/issues)
-   **Participate in Development**: (Contribution guide in progress, discussions via Issues welcome)
-   **Community**:
    -   **Discord**: [ComfyTavern](https://discord.gg/VE8AM7t4n6) (under construction)

---

### 💻 Tech Stack

-   **Frontend**: Vue 3 + TypeScript + Vite + [Vue Flow](https://vueflow.dev/) + Pinia + Tailwind CSS
-   **Backend**: [Bun](https://bun.sh/) + [Elysia](https://elysiajs.com/) + Drizzle ORM (SQLite)
-   **Real-time Communication**: WebSocket

---

### 📜 License (License)

This project adopts a **Dual-Licensing** model, aiming to balance open sharing in the community with the project's sustainable development.

#### 1. Open Source License: GNU AGPLv3

For individual developers, academic research, non-profit organizations, and any non-commercial projects, ComfyTavern is available under the **GNU Affero General Public License v3.0 (AGPLv3)**.

**Core Requirement**: If you modify ComfyTavern's source code, or provide it as a backend service to users over a network, you must release your complete project's source code under the same AGPLv3 license.

We encourage learning, innovation, and non-commercial sharing based on ComfyTavern.

#### 2. Commercial License

For organizations and individuals who wish to use ComfyTavern in a commercial environment, we offer a commercial license.

**A commercial license must be purchased for the following situations:**

*   Using ComfyTavern in any **closed-source** commercial product or service.
*   Using ComfyTavern internally within a company to support business operations (e.g., as part of an internal toolchain).
*   Providing hosted services (SaaS) based on ComfyTavern to paying users.
*   Any commercial scenario where you do not wish to be bound by the open-source obligations of AGPLv3.

A commercial license will exempt you from the open-source requirements of AGPLv3 and provide corresponding technical support and legal protection according to the agreement.

---

We believe this model will allow ComfyTavern to serve the community while obtaining the necessary financial support to go further and more steadily.

**➡️ For inquiries or to purchase a commercial license, please contact us: comfytavern@yeah.net**