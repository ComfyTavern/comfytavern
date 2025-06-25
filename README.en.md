# ComfyTavern (Beta)

[![Status](https://img.shields.io/badge/status-Beta-orange)](https://github.com/ComfyTavern/comfytavern)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
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

ComfyTavern is dedicated to transforming complex AI workflows into intuitive, user-friendly, and interactive **mini-applications**.

We provide **creators** with a powerful, fluid visual node editor to orchestrate AI logic; simultaneously, we enable **end-users** to experience rich AI functionalities like AI chat, visual novels, and intelligent agents (Agent) "out-of-the-box" through independent **application panels**, without needing to understand the underlying technology.

We believe that the power of AI lies not only in the sophistication of the creation process but also in the convenience of the final experience.

**➡️ Current Core: PC-based VueFlow Node Editor + Basic Workflow Execution.**

## [👉 Quick Start](#-installation-and-startup)

---

### ✨ Core Features

ComfyTavern's design revolves around three main pillars: **unique agent architecture → professional orchestration tools → open application ecosystem.**

#### 1. 🎯 Vision: Agent-centric Application Architecture

This is not just a feature, but the architectural cornerstone that distinguishes ComfyTavern from other platforms. We are not simply replicating or combining existing tools; instead, we offer a new paradigm:

-   **Different focus from ComfyUI**: ComfyUI excels at image generation. ComfyTavern aims broader, as a general-purpose AI application building and execution platform, covering logic, text, LLM interaction, and Agent construction, and can be used in combination with ComfyUI.
-   **Different architecture from SillyTavern**: SillyTavern is an excellent chat frontend. ComfyTavern's core advantage stems from its **unified autonomous agent (Agent) architecture**. We build a runtime environment where Agents "come alive," centered around "Scenes":
    -   **Agents are the execution core with "brains" and "memory"**: Each Agent is designed as an entity with an internal "deliberation loop," long-term memory (knowledge base), and callable skills (workflows).
    -   **Application Panels are the "face" of Agent-user interaction**: They are no longer fixed UIs, but dynamic frontends that communicate asynchronously with Agents and respond to their states in real-time, building truly vibrant interactive experiences.

This architecture enables creators to build AI applications with dynamic behavior and learning potential that far exceed traditional presets.

#### 2. 🚀 Capability: High-Performance Engine and Professional Editor

-   **Full-link Streaming Engine**: The backend is specifically designed for real-time interaction. From input and node transmission to API response, it fully supports streaming and asynchronous concurrency, providing real-time feedback on execution status via WebSocket, ensuring performance for AI conversations, dynamic content generation, and other applications.
-   **Professional Visual Editor**:
    -   **Modular Node Groups**: Create node groups with one click, encapsulating complex logic into reusable modules.
    -   **Smooth Experience**: Streamlined UI, rich right-click menus, multi-level operations, dual clipboards, history, etc.
    -   **Powerful Node System**: Supports various data types, custom schemas, embedded interactive components, and client-side script extensions.

#### 3. ⭐ Ecosystem: Open, Compatible, and Developer-Friendly

-   **API Driven**: Core functionalities are exposed via API (HTTP/WebSocket), laying the foundation for the platform's evolution into an **Engine as a Service** and third-party integrations.
-   **Easy to Extend**: Provides clear TypeScript interfaces and robust type definitions, facilitating the creation of custom nodes and encouraging community contributions.
-   **Open Compatibility**: Plans to provide tools to assist in migrating assets from platforms like SillyTavern (e.g., character cards) to integrate into a broader ecosystem.

---

### 📄 Documentation

-   **[Node Type System](docs/node-types/node-types.en.md)**: Understanding the basics of node data interaction.
-   **[Custom Node Development Guide](docs/guides/custom-node-development.en.md)**: Steps to extend ComfyTavern's functionality.
-   **[Customizing UI Language Pack](docs/guides/customizing-ui-language.md)**: Adding or updating interface languages.

---

### 🚦 Roadmap

The project is actively progressing:

-   **Phase 1: Core Engine (Ready)**
    -   ✅ Visual Editor Core (VueFlow)
    -   ✅ Backend Node Dynamic Loading
    -   ✅ Workflow Execution Engine (Asynchronous, Streaming)

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

-   **Other Plans**:
    -   ⏳ Mobile adaptation (e.g., Tauri)
    -   ⏳ Built-in Agent creation assistant

---

### 🏗️ Project Structure

```
apps/
  ├── backend/            # Backend Service (Elysia + Bun)
  └── frontend-vueflow/   # Frontend (Vue 3 + Vite + VueFlow)
data/                     # Application Data (databases, etc.), mapped to system://data/
docs/                     # Project Documentation
library/                  # Global Shared Asset Library (templates, examples), mapped to shared://library/
logs/                     # Log Files
packages/
  ├── types/              # Shared TypeScript Types
  └── utils/              # Shared Utility Functions
plugins/
  └── nodes/              # User Custom Nodes
public/                   # Public Static Resources
userData/                 # User Data Root Directory (includes independent projects, libraries, etc. for each user)
```

---

### 🚀 Installation and Startup

**Environment Requirements:**

-   [Bun](https://bun.sh) v1.2.5+ (Main Runtime)
-   Node.js v20+ (for development tools)
-   Windows / Linux / macOS
-   (Docker support planned)

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

- **For first-time startup or after updates**, it is recommended to use **Full Startup**, which checks and prepares all necessary configurations (e.g., database):

| Platform        | Production Mode           | Development Mode           |
| :---------- | :----------------- | :----------------- |
| Windows     | `.\start.bat`      | `.\start.bat dev`  |
| Linux/macOS | `./start.sh`       | `./start.sh dev`   |

- **For daily development**, if you confirm no configuration changes, you can use **Fast Startup** to skip checks for faster speed:

| Platform        | Production Mode               | Development Mode               |
| :---------- | :--------------------- | :--------------------- |
| Windows     | `.\start_fast.bat`     | `.\start_fast.bat dev` |
| Linux/macOS | `./start_fast.sh`      | `./start_fast.sh dev`  |

**Default Addresses:**

-   Frontend: `http://localhost:5573/`
-   Backend: `http://localhost:3233/`

---

### 🛠️ Getting Started

#### Step One: Create a Project

After successful startup, visit the frontend at `http://localhost:5573/`.

1.  Click **Projects** in the left navigation bar.
2.  Click the **Create New Project** button.
3.  Enter a project name and confirm to enter the visual node editor.

#### Step Two: Connect AI Services

For security and convenience, API keys are managed centrally within the application and are not saved in workflow files.

1.  Go to **Settings** -> **Model Configuration** page.
2.  Click **New Channel**, select your AI service provider (e.g., OpenAI, Anthropic, etc.), and fill in the `Base URL` and `API Key`.
3.  Add the model IDs supported by this channel (e.g., `gpt-4o`).
4.  Save the channel.

#### Step Three: Use AI in Workflow

1.  **Add Nodes**: From the left node library panel, add `💬Create Message` and `⚡Generic LLM Request` nodes from the `LLM` category to the canvas.
2.  **Fill Content**: Select the `💬Create Message` node and enter your question. Select the `⚡Generic LLM Request` node and fill in your configured model ID (e.g., `gpt-4o`).
3.  **Connect Data Flow**:
    *   Connect the `Message` output of `💬Create Message` to the `Message List` input of `⚡Generic LLM Request`.
    *   Connect the `Response Text` output of `⚡Generic LLM Request` to the `Group Output` node.
4.  **Execute and View**: Click execute to see the AI's response in the right preview panel.

#### Step Four: View Results

-   Click the **Preview Panel** (🔍 icon) on the right side of the editor.
-   It is recommended to view all final results connected to the `Group Output` node in "**Group Overview**" mode.
-   You can also right-click any node's output handle and select "Set as Preview" to view intermediate data.

---

### ⚙️ Advanced Management

#### Database

This project uses SQLite, which will be automatically created on first startup (not fast startup). If you update the version and it involves database schema changes, please run the following command to upgrade:

```bash
bun run db:upgrade
```

#### Production Environment (PM2)

The project provides scripts for production environment deployment and management via PM2.

-   **Start all services**:
    ```bash
    bun run manage:pm2 start
    ```
-   **View all service statuses**:
    ```bash
    bun run manage:pm2 list
    ```
-   **View logs**:
    ```bash
    bun run manage:pm2 logs comfytavern-backend
    ```
-   **Stop all services**:
    ```bash
    bun run manage:pm2 stop
    ```
> For more commands, please refer to `ecosystem.config.cjs` or PM2 documentation.

---

### 🤝 Contribution and Feedback

The project is in its early Beta and rapid iteration phase, and functionalities and APIs may change. Feedback and contributions are welcome!

-   **Bugs and Suggestions**: [GitHub Issues](https://github.com/ComfyTavern/comfytavern/issues)
-   **Participate in Development**: (Contribution guide in progress, discussions via Issues welcome)
-   **Community**:
    -   **Discord**: [ComfyTavern](https://discord.gg/VE8AM7t4n6) (under construction)

---

### 💻 Tech Stack

-   **Frontend**: Vue 3 + TypeScript + Vite + [Vue Flow](https://vueflow.dev/)
-   **Backend**: [Bun](https://bun.sh/) + [Elysia](https://elysiajs.com/)
-   **Real-time Communication**: WebSocket

---

### 📜 License

This project is open-sourced under the [MIT License](./LICENSE).