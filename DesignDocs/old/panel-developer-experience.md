# 面板开发体验 (DX) 增强方案

## 1. 概述

为了构建一个繁荣的开发者生态，必须为应用面板（Application Panel）的创作者提供一流的开发体验（Developer Experience, DX）。当前架构侧重于生产环境下面板的加载和运行，但在开发阶段存在流程繁琐、缺乏热更新（HMR）等痛点。

本方案旨在通过引入一个明确的“开发模式”，无缝对接 Vite 等现代前端构建工具，从而极大地提升面板的开发效率和体验。

## 2. 核心问题

- **开发/生产环境脱节**：开发者在本地使用 Vite 等工具开发，完成后需要手动构建，并将产物移动到 ComfyTavern 的 `userData` 目录才能测试，流程冗长。
- **缺乏热更新 (HMR)**：每次代码修改都需要重复“构建-移动-刷新”的循环，严重影响开发效率。
- **安全限制**：`iframe` 的同源策略和 `postMessage` 的 `targetOrigin` 限制，使得直接在 `iframe` 中加载本地开发服务器（如 `http://localhost:5174`）变得困难。

## 3. 方案设计

核心思想是在系统中引入“生产模式”与“开发模式”的双轨并行机制。

### 3.1. 扩展 `PanelDefinition`

我们在 `panel.json` 的 schema 中增加一个可选的 `devOptions` 字段，专门用于存放开发环境的配置。

**文件**: `packages/types/src/schemas.ts`

```typescript
// ... 其他导入

export const PanelDevOptionsSchema = z.object({
  devServerUrl: z.string().url({ message: "必须是有效的 URL" }).describe("开发服务器的 URL (例如 http://localhost:5174)"),
  // 未来可以扩展更多开发时选项，如 HMR 端口、代理配置等
});
export type PanelDevOptions = z.infer<typeof PanelDevOptionsSchema>;

export const PanelDefinitionSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  version: z.string(),
  uiEntryPoint: z.string().describe("【生产环境】面板 UI 的入口文件 (例如: index.html)"),
  
  // 新增字段
  devOptions: PanelDevOptionsSchema.optional().describe("【开发环境】专用的配置选项"),

  workflowBindings: z.array(PanelWorkflowBindingSchema).optional().describe("面板与其可调用的工作流之间的绑定关系"),
  panelDirectory: z.string().optional().describe("面板所在的目录名，由后端动态填充"),
  // ... 其他字段
});
export type PanelDefinition = z.infer<typeof PanelDefinitionSchema>;
```

### 3.2. UI 集成

在面板的设置界面中，为开发者提供配置开发选项的入口。

**文件**: `apps/frontend-vueflow/src/components/panel/PanelGeneralSettings.vue`

- 在现有表单中，仿照“UI 入口文件”的样式，新增一个 **“开发选项”** 配置区。
- 此区域包含一个输入框，用于填写 **“开发服务器 URL”**，并与 `panelDefinition.devOptions.devServerUrl` 双向绑定。
- 此区域可以设计为默认折叠，或仅在全局开发者模式启用时可见，以保持普通用户界面的简洁性。

### 3.3. 全局开发者模式

系统需要一个全局状态来启用或禁用所有面板的开发模式。

- **状态管理**: 在 `apps/frontend-vueflow/src/stores/settingsStore.ts` 中添加一个持久化的状态，例如 `isPanelDevModeEnabled: boolean`。
- **UI 入口**: 在 ComfyTavern 的主设置界面（例如 `SettingsView.vue`）中，提供一个开关来控制此状态。

### 3.4. 智能加载逻辑

前端加载面板的逻辑需要被修改以支持双轨模式。

**涉及文件**: `apps/frontend-vueflow/src/stores/panelStore.ts` 和/或 `apps/frontend-vueflow/src/components/panel/PanelContainer.vue`

修改获取面板 `iframe` URL 的逻辑：

```typescript
function getPanelIframeUrl(panelDef: PanelDefinition): { src: string; origin: string } {
  const settingsStore = useSettingsStore(); // 假设已引入

  const isDevMode = settingsStore.isPanelDevModeEnabled;
  const devUrl = panelDef.devOptions?.devServerUrl;

  if (isDevMode && devUrl) {
    // 开发模式
    console.log(`[Panel Loader] Loading panel '${panelDef.id}' from dev server: ${devUrl}`);
    return {
      src: devUrl,
      origin: new URL(devUrl).origin
    };
  } else {
    // 生产模式
    const panelStore = usePanelStore(); // 假设已引入
    return {
      src: panelStore.getPanelContentUrl(projectId, panelDef.id, panelDef.uiEntryPoint),
      origin: window.location.origin // 或更精确的后端源
    };
  }
}
```

### 3.5. 通信与安全

**文件**: `apps/frontend-vueflow/src/composables/panel/usePanelApiHost.ts`

- `usePanelApiHost` composable 在初始化时，需要从 `getPanelIframeUrl` 的结果中接收 `panelOrigin`。
- `handleMessage` 函数中的 `event.origin` 校验将使用这个动态传入的 `panelOrigin`，从而允许与 `localhost` 的开发服务器进行安全的 `postMessage` 通信。

### 3.6. (推荐) 开发者工具

为了进一步简化开发流程，可以规划并创建一个 CLI 工具 `@comfytavern/panel-cli`。

- **功能**:
  - **项目脚手架**: `npx @comfytavern/panel-cli create my-panel --template vue`
  - **自动配置**: 自动在 `vite.config.ts` 中配置正确的 CORS 策略和 HMR 选项。
  - **开发命令**: 提供一个包装好的 `dev` 命令，启动已配置好的 Vite 开发服务器。

## 4. 实施步骤

1.  **类型定义**: 在 `packages/types/src/schemas.ts` 中更新 `PanelDefinitionSchema`，添加 `devOptions`。
2.  **全局设置**: 在 `settingsStore` 和相关设置 UI 中添加“启用面板开发者模式”的全局开关。
3.  **UI 修改**: 更新 `PanelGeneralSettings.vue`，添加 `devServerUrl` 的输入框。
4.  **加载逻辑**: 修改 `panelStore` 或 `PanelContainer.vue`，实现智能加载逻辑。
5.  **通信适配**: 修改 `usePanelApiHost.ts` 以接受动态的 `panelOrigin`。
6.  **文档更新**: 撰写新的开发者指南，详细说明如何配置和使用开发模式。
7.  **(可选) CLI 工具**: 启动 `@comfytavern/panel-cli` 项目。