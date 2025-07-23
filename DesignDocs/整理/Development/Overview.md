# Development Overview

## 1. 引言

本 `Development` 文档模块旨在为 ComfyTavern 项目的开发者提供一个全面的、集中的开发生命周期指南。它涵盖了从最初的环境设置到最终的代码部署的各个方面，旨在帮助开发者高效、规范地参与项目开发。

遵循这些文档中的指南对于保持项目的高质量标准、促进团队成员之间的有效协作，以及确保项目能够顺利迭代和成功交付至关重要。我们鼓励每一位开发者熟悉并遵守这些规范，共同打造一个健壮、可维护的 ComfyTavern 应用。

## 2. 开发生命周期概览

参与 ComfyTavern 项目的开发通常遵循以下典型的生命周期阶段：

1.  **环境准备**:
    *   搭建符合项目要求的本地开发环境。项目提供了简化的启动脚本，通过统一的命令自动处理环境配置、依赖安装和数据库初始化等，极大简化了搭建过程。
    *   *详细指南请参考：[`EnvironmentSetup.md`](./EnvironmentSetup.md)*

2.  **编码与实现**:
    *   根据需求进行新功能开发或现有缺陷的修复。在此过程中，务必遵循项目既定的编码规范、代码风格和最佳实践，以保证代码的一致性和可读性。项目对 TypeScript、Vue 3 开发、命名约定和中文注释有明确规范。
    *   *详细规范请参考：[`CodingStandards.md`](./CodingStandards.md)*

3.  **质量保证**:
    *   编写和执行单元测试、组件测试以及必要的集成测试，以验证代码的正确性、功能的完整性和系统的健壮性。确保测试覆盖率达到项目要求。Vitest 是主要的测试框架，支持前端和后端代码测试。
    *   *详细策略与实践请参考：[`Testing.md`](./Testing.md)*

4.  **构建与部署**:
    *   在开发完成并通过测试后，构建生产版本的应用程序。了解项目推荐的简易部署方式，即使用提供的启动脚本快速部署。对于更复杂的生产环境，也提供了进阶部署选项。
    *   *详细流程与指南请参考：[`Deployment.md`](./Deployment.md)*

5.  **版本控制与协作**:
    *   使用 Git 进行代码的版本控制。遵循项目定义的分支策略（如功能分支、修复分支等）和代码提交规范。
    *   积极参与代码审查（Code Review）过程，提出有建设性的反馈，并根据审查意见修改代码，以提升整体代码质量。

## 3. 核心开发文档摘要与导航

本 `Development` 模块包含以下核心文档，为开发过程中的关键环节提供详细指导：

*   **环境搭建 ([`DesignDocs/整理/Development/EnvironmentSetup.md`](./EnvironmentSetup.md))**
    *   **摘要**: 此文档详细指导开发者如何从零开始配置 ComfyTavern 项目的本地开发环境。内容涵盖所需的先决条件（如 Bun、Node.js、Git）、项目代码的获取（包括推荐 fork 的方式）、依赖项的安装、统一启动开发服务器的步骤，并着重强调了启动脚本如何自动处理 `config.json` 的创建与合并，以及数据库的初始化与迁移。

*   **编码规范 ([`DesignDocs/整理/Development/CodingStandards.md`](./CodingStandards.md))**
    *   **摘要**: 本文档全面概述了 ComfyTavern 项目的编码标准和约定。它包括 Prettier 的自动格式化配置、ESLint 和 WebHint 的代码风格检查、TypeScript（强调 `interface` 和 `as const` 而非 `enum`）和 Vue 3 (`<script setup>`, Composition API) 的具体使用规范、文件及代码内元素的命名约定，以及强制使用中文注释的要求。文档还强调了类型检查命令的使用。

*   **测试策略与实践 ([`DesignDocs/整理/Development/Testing.md`](./Testing.md))**
    *   **摘要**: 此文档详细介绍了 ComfyTavern 项目所采用的测试策略、测试框架 (Vitest) 及相关工具（如 `@vue/test-utils`）的配置和使用。内容包括单元测试、组件测试、集成测试、端到端测试的定义和目标、如何编写和组织测试用例、运行各类测试脚本的命令和流程、生成代码覆盖率报告的方法，以及编写高质量、可维护测试用例的最佳实践和常用的 Mocking/Stubbing 技术（包括对后端测试的适用性）。

*   **部署流程与指南 ([`DesignDocs/整理/Development/Deployment.md`](./Deployment.md))**
    *   **摘要**: 本文档阐述了 ComfyTavern 应用推荐的简化部署方式，即通过一键启动脚本快速运行。同时，也涵盖了针对复杂生产环境的进阶部署选项，例如环境变量配置、PM2 进程管理和容器化部署等考量。

## 4. 关键开发工具与技术栈回顾

在 ComfyTavern 项目的整个开发生命周期中，开发者会频繁接触和使用以下关键工具及核心技术栈：

*   **版本控制**: Git (配合 GitLab/GitHub 等平台)
*   **运行时 & 包管理器**: Bun (核心运行时，用于开发、构建和生产)
*   **构建工具**:
    *   前端: Vite
    *   后端: Bun (利用其内置的构建和打包能力)
*   **主要编程语言**: TypeScript
*   **核心框架**:
    *   前端: Vue 3 (重点使用 Composition API 和 `<script setup>` 语法)
    *   后端: Elysia (基于 Bun 的高性能框架)
*   **代码质量工具**:
    *   Linting: ESLint
    *   格式化: Prettier
    *   类型检查: `vue-tsc` (前端), `tsc` (后端)
*   **测试框架**: Vitest (配合 Vue Test Utils 等，支持前端和后端)
*   **进程管理**: PM2 (用于生产环境的服务管理)
*   **集成开发环境 (IDE)**: 强烈推荐 Visual Studio Code (VSCode)，并建议安装项目推荐的相关插件以提升开发效率和体验。

## 5. 开发者贡献与协作指南

为了确保项目开发的有序进行和代码质量的持续提升，我们鼓励所有贡献者遵循以下协作指南：

*   **代码贡献流程**:
    *   通常采用标准的 Fork & Pull Request (或 Merge Request) 工作流。
    *   在开始开发新功能或修复缺陷前，请确保从最新的主开发分支（如 `main` 或 `develop`）创建新的特性分支或修复分支。
*   **分支命名约定**:
    *   建议遵循统一的分支命名约定，例如：
        *   新功能: `feat/descriptive-name` (例如: `feat/user-authentication`)
        *   缺陷修复: `fix/issue-id-or-description` (例如: `fix/login-button-bug`)
        *   文档: `docs/topic-name` (例如: `docs/update-readme`)
        *   重构: `refactor/area-of-refactor` (例如: `refactor/api-service-layer`)
*   **代码审查**:
    *   所有提交的代码都应经过至少一位其他团队成员的审查。
    *   审查者应关注代码的正确性、可读性、性能、安全性以及是否符合项目规范。
    *   提交者应积极响应审查意见，并进行必要的修改。
*   **沟通与协作**:
    *   鼓励开放和及时的沟通。遇到问题或有疑问时，请及时与团队成员讨论。
    *   使用项目管理工具（如 Jira, Trello, GitHub Issues）跟踪任务和缺陷。

更详细的贡献指南（如果存在）可能会在项目的根目录下的 `CONTRIBUTING.md` 文件中提供。如果该文件不存在或需要更具体的指导，请与项目维护者联系。