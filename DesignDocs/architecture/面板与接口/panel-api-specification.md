# 设计文档：应用面板 API (`panelApi`) 规范

## 1. 引言与目标

本文档旨在为 ComfyTavern 平台的 **应用面板 API (`panelApi`)** 提供一个统一、明确且权威的设计规范。

随着平台架构的演进，`panelApi` 的概念已在多个设计文档中被提及，但其具体接口、命名空间和通信机制尚未被集中定义。本规范的目标是：

*   **统一命名空间**：确定 `panelApi` 在 `window` 对象下的唯一路径。
*   **固化接口定义**：使用 TypeScript 接口清晰地定义 `panelApi` 的所有方法、参数和返回值。
*   **明确通信机制**：阐明面板与宿主环境之间安全通信的底层机制。
*   **确立安全边界**：强调在 API 设计和实现中必须遵守的安全原则。
*   **作为单一事实来源**：本文档将作为未来前端实现、面板开发者文档以及 `.d.ts` 类型定义文件的基础。

## 2. 核心设计原则

*   **安全优先 (Security-First)**：所有 API 设计都必须将沙盒环境和安全通信作为首要考量。
*   **接口稳定 (Stable Interface)**：向后兼容，谨慎引入破坏性变更，为面板开发者提供稳定的开发体验。
*   **简单易用 (Developer-Friendly)**：API 设计应直观、易于理解，并提供清晰的错误处理机制。
*   **可扩展性 (Extensible)**：为未来可能增加的宿主服务和交互模式留出扩展空间。

## 3. 命名空间

为保持一致性和良好的组织结构，`panelApi` 将统一使用以下命名空间：

`window.comfyTavern.panelApi`

## 4. API 接口定义 (TypeScript)

`panelApi` 的核心功能将通过以下 TypeScript 接口进行定义。

```typescript
// @comfytavern/panel-sdk/types.d.ts

// --- 核心 API 接口 ---

/**
 * 应用面板与宿主环境通信的核心 API。
 * 此对象将通过 window.comfyTavern.panelApi 暴露给沙盒化的应用面板。
 */
export interface ComfyTavernPanelApi {
  // == 核心工作流交互 ==

  /**
   * 异步执行一个工作流。
   * 这是面板与后端核心功能交互最主要的方法。
   * @param request 包含工作流ID和输入数据的请求对象。
   * @returns 返回一个包含 promptId 的 Promise，可用于后续追踪。
   */
  executeWorkflow(request: WorkflowExecutionRequest): Promise<{ promptId: string }>;

  /**
   * 获取指定工作流的公共接口定义（输入和输出）。
   * @param workflowId 目标工作流的 ID。
   * @returns 返回工作流的接口描述对象。
   */
  getWorkflowInterface(workflowId: string): Promise<WorkflowInterface>;

  // == 事件与状态订阅 ==

  /**
   * 订阅来自后端的执行事件。
   * @param promptId 要监听的执行任务ID。
   * @param callbacks 包含各种事件回调函数的对象。
   * @returns 返回一个取消订阅的函数。
   */
  subscribeToExecutionEvents(promptId: string, callbacks: PanelExecutionCallbacks): () => void;
  
  /**
   * 订阅来自后端 Agent 或场景的、需要前端 UI 响应的交互请求。
   * 这是实现人机协作（如 Agent 请求用户输入）的关键。
   * @param uiProvider 一个对象，其方法实现了特定交互类型的 UI 渲染逻辑。
   * @returns 返回一个取消订阅的函数。
   */
  subscribeToInteractionRequests(uiProvider: PanelInteractionProvider): () => void;

  /**
   * 向后端发布一个事件。
   * 主要用于用户在面板上的操作需要通知 Agent 或其他后端服务的场景。
   * @param eventType 事件类型（需符合预定义的事件格式）。
   * @param payload 事件的载荷（需符合事件类型的 schema）。
   */
  publishEvent(eventType: string, payload: any): Promise<void>;

  // == 与宿主环境交互 ==

  /**
   * 获取当前宿主环境的主题信息。
   * @returns 返回包含主题颜色、字体等信息的对象。
   */
  getCurrentTheme(): Promise<ThemeInfo>;

  /**
   * 请求宿主环境提供一项服务。
   * 出于安全考虑，所有可用的服务都由宿主环境通过白名单机制提供。
   * @param serviceName 服务的名称 (e.g., 'showNotification', 'requestResize')。
   * @param args 传递给服务的参数。
   * @returns 返回服务执行的结果。
   */
  requestHostService<T = any>(serviceName: string, args?: any): Promise<T>;
}

// --- 辅助类型定义 ---

/**
 * 工作流执行请求对象
 */
export interface WorkflowExecutionRequest {
  /** 要执行的工作流ID */
  workflowId: string;
  /** 工作流的输入参数 */
  inputs: Record<string, any>;
  /** 
   * 执行模式：
   * - 'native': 直接执行原生工作流
   * - 'adapter': 通过 ApiAdapterManager 转换后执行 
   */
  mode?: 'native' | 'adapter';
}

/**
 * 工作流接口描述
 */
export interface WorkflowInterface {
  /** 工作流ID */
  id: string;
  /** 工作流名称 */
  name: string;
  /** 工作流的详细描述 */
  description?: string;
  /** 输入参数定义 */
  inputs: SlotDefinition[];
  /** 输出结果定义 */
  outputs: SlotDefinition[];
}

/**
 * 插槽定义
 */
export interface SlotDefinition {
  /** 插槽ID */
  id: string;
  /** 显示名称 */
  displayName: string;
  /** 自定义描述 */
  customDescription?: string;
  /** 数据类型 */
  dataType: string;
  /** 是否必需 */
  required?: boolean;
}

/**
 * 面板执行事件回调
 */
export interface PanelExecutionCallbacks {
  /** 执行开始回调 */
  onStart?: (data: { promptId: string }) => void;
  /** 执行进度更新回调 */
  onProgress?: (data: { progress: number; message?: string }) => void;
  /** 执行结果回调 */
  onResult?: (data: { outputs: Record<string, any> }) => void;
  /** 执行错误回调 */
  onError?: (data: { error: string; details?: any }) => void;
}

/**
 * 面板交互提供者接口
 */
export interface PanelInteractionProvider {
  /** 处理文本输入请求 */
  handleTextInputRequest?: (request: TextInputRequest) => Promise<string>;
  /** 处理选项选择请求 */
  handleOptionSelectionRequest?: (request: OptionSelectionRequest) => Promise<string>;
}

/**
 * 文本输入请求
 */
export interface TextInputRequest {
  /** 请求ID */
  requestId: string;
  /** 提示文本 */
  prompt: string;
  /** 默认值 */
  defaultValue?: string;
}

/**
 * 选项选择请求
 */
export interface OptionSelectionRequest {
  /** 请求ID */
  requestId: string;
  /** 提示文本 */
  prompt: string;
  /** 可选项列表 */
  options: { value: string; label: string }[];
}

/**
 * 主题信息
 */
export interface ThemeInfo {
  /** 主题ID */
  id: string;
  /** 主题名称 */
  name: string;
  /** 主色 */
  primaryColor: string;
  /** 文字色 */
  textColor: string;
  /** 背景色 */
  backgroundColor: string;
  /** 字体 */
  fontFamily: string;
}
```

## 5. 通信机制

*   **`window.postMessage`**: 面板与其宿主 `<iframe>` 容器之间的所有通信，都必须通过 `window.postMessage` API 进行，确保跨域安全。
*   **来源验证**: 宿主环境和面板脚本都必须在接收消息时，严格验证 `event.origin`，确保消息来自预期的、受信任的来源。
*   **消息格式**: 将定义一套标准的消息请求/响应格式，包含 `type`, `id` (用于关联请求和响应), `payload` 等字段。`panelApi` 对象本身是一个代理 (Proxy)，它将方法调用转换为标准消息并发送给宿主。

## 6. 安全注意事项

*   **沙盒继承**: `panelApi` 的安全性建立在其运行的 `<iframe>` 沙盒环境之上。`sandbox` 属性和 `allow` 属性 (Feature Policy) 是第一道防线。
*   **服务白名单**: `requestHostService` 方法调用的服务必须在宿主侧进行严格的白名单校验，防止面板调用未授权的宿主功能。
*   **参数校验**: 所有由面板传递给 `panelApi` 方法的参数，在宿主环境接收后，都必须进行严格的类型和内容校验，防止注入攻击。
*   **事件过滤**: `publishEvent` 方法应限制可发布的事件类型，防止恶意事件干扰系统。
*   **来源限制**: 宿主环境应只响应来自已知可信面板源的消息。

## 7. 类型定义 (`.d.ts`)

本规范中定义的 `ComfyTavernPanelApi` TypeScript 接口，将直接作为向面板开发者提供的 `@comfytavern/panel-sdk` 包中 `.d.ts` 文件的核心内容，以提供强大的类型检查和编辑器智能提示支持。

## 8. 参考实现

宿主环境中的 `PanelContainer.vue` 组件负责：
1. 创建沙盒化的 `<iframe>` 环境
2. 注入 `window.comfyTavern.panelApi` 代理对象
3. 处理 `postMessage` 通信
4. 实现宿主服务白名单机制

```typescript
// PanelContainer.vue 伪代码实现
const panelApi = {
  executeWorkflow: (request) => sendToHost('executeWorkflow', request),
  getWorkflowInterface: (id) => sendToHost('getWorkflowInterface', { id }),
  // ... 其他方法实现
};

window.comfyTavern = { panelApi };

window.addEventListener('message', (event) => {
  if (event.origin !== trustedOrigin) return;
  // 处理来自宿主的事件和响应
});
```

## 9. 开发者指南

面板开发者可以通过以下方式使用 API：
```javascript
// 执行工作流
const { promptId } = await window.comfyTavern.panelApi.executeWorkflow({
  workflowId: 'story-generator',
  inputs: { theme: '科幻', length: 1000 }
});

// 订阅执行事件
const unsubscribe = window.comfyTavern.panelApi.subscribeToExecutionEvents(promptId, {
  onProgress: ({ progress }) => updateProgressBar(progress),
  onResult: ({ outputs }) => displayStory(outputs.story)
});

// 请求宿主服务
await window.comfyTavern.panelApi.requestHostService('showNotification', {
  title: '故事生成完成',
  message: '点击查看完整故事'
});