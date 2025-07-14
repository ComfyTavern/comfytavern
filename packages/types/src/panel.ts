import { z } from 'zod';

// --- Panel Schemas ---

/**
 * Schema 定义：在 project.json 中声明的面板。
 */
export const PanelDeclarationSchema = z.object({
  id: z.string().describe("面板的唯一标识符"),
  path: z.string().describe("指向面板定义文件的逻辑路径 (例如: ui/my_chat_panel/panel.json)"),
});
export type PanelDeclaration = z.infer<typeof PanelDeclarationSchema>;

/**
 * Schema 定义: 单个面板工作流绑定的具体配置
 */
export const PanelWorkflowBindingSchema = z.object({
  workflowId: z.string().describe("绑定的工作流ID"),
});
export type PanelWorkflowBinding = z.infer<typeof PanelWorkflowBindingSchema>;

export const PanelDevOptionsSchema = z.object({
  devServerUrl: z.string().url({ message: "必须是有效的 URL" }).describe("开发服务器的 URL (例如 http://localhost:5174)"),
});
export type PanelDevOptions = z.infer<typeof PanelDevOptionsSchema>;

export const PanelDefinitionSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  version: z.string(),
  uiEntryPoint: z.string().describe("【生产环境】面板 UI 的入口文件 (例如: index.html)"),
  devOptions: PanelDevOptionsSchema.optional().describe("【开发环境】专用的配置选项"),
  workflowBindings: z.array(PanelWorkflowBindingSchema).optional().describe("面板与其可调用的工作流之间的绑定关系"),
  panelDirectory: z.string().optional().describe("面板所在的目录名，由后端动态填充"),
  apiSpec: z.string().optional().describe("指向面板 API 规范文件的路径"),
  requiredWorkflows: z.array(z.string()).optional().describe("【旧版，待废弃】面板运行所需的 workflow ID 列表"),
  icon: z.string().optional(),
  source: z.enum(['user', 'shared']).optional().describe("面板来源，由后端动态填充"),
  customMetadata: z.record(z.any()).optional(),
});
export type PanelDefinition = z.infer<typeof PanelDefinitionSchema>;


// --- Panel API Schemas ---

// 面板API的能力调用请求对象 (单一、灵活的模式)
export const InvocationRequestSchema = z.object({
  // 调用模式
  mode: z.enum(['native', 'adapter']),
  // 要执行的工作流ID (mode: 'native')
  workflowId: z.string().optional(),
  // 要调用的适配器ID (mode: 'adapter')
  adapterId: z.string().optional(),
  // 工作流或适配器的输入参数
  inputs: z.record(z.any()),
});
export type InvocationRequest = z.infer<typeof InvocationRequestSchema>;


// 面板API的能力调用响应对象
export const InvocationResponseSchema = z.object({
  executionId: z.string(),
});
export type InvocationResponse = z.infer<typeof InvocationResponseSchema>;

/**
 * PanelFile
 * 描述面板文件系统中的一个文件或目录。
 */
export const PanelFileSchema = z.object({
  name: z.string(),
  path: z.string(), // 相对于面板根目录的路径
  type: z.enum(['file', 'directory']),
  size: z.number().optional(),
  lastModified: z.number().optional(), // 使用时间戳 (ms)
});
export type PanelFile = z.infer<typeof PanelFileSchema>;


/**
 * PanelApiHost
 * 定义宿主环境提供给面板 iframe 的一组稳定的 API。
 */
export interface PanelApiHost {
  /**
   * @deprecated 将在未来版本移除，请使用 invoke 方法。
   */
  executeWorkflow?: (request: { workflowId: string; inputs: Record<string, any> }) => Promise<any>;

  /**
   * @deprecated 主题和语言现在通过 dedicated message types 推送
   */
  getSettings?: () => Promise<{ theme: string; language: string; variables: Record<string, string> }>;
  
  // --- 核心调用 API ---
  invoke(request: InvocationRequest): Promise<InvocationResponse>;
  subscribeToExecutionEvents(executionId: string): boolean;

  // --- 文件系统 API ---
  /**
   * 列出指定目录下的文件和子目录。
   * @param path - 相对于面板根目录的路径。如果为空或'/'，则列出根目录。
   * @returns 返回一个文件/目录描述对象的数组。
   */
  listFiles(path: string): Promise<PanelFile[]>;

  /**
   * 读取文件的内容。
   * @param path - 相对于面板根目录的文件路径。
   * @param encoding - 'utf-8' (默认) 或 'binary'。
   * @returns 如果是 utf-8，返回字符串；如果是 binary，应由调用方处理 ArrayBuffer 或类似格式。
   */
  readFile(path: string, encoding?: 'utf-8' | 'binary'): Promise<string | ArrayBuffer>;

  /**
   * 将内容写入文件。如果文件或目录不存在，会自动创建。
   * @param path - 相对于面板根目录的文件路径。
   * @param content - 要写入的字符串或二进制数据。
   */
  writeFile(path: string, content: string | Blob): Promise<void>;

  /**
   * 删除文件或目录。
   * @param path - 相对于面板根目录的文件或目录路径。
   * @param options - 删除选项，例如 { recursive: true } 用于删除非空目录。
   */
  deleteFile(path: string, options?: { recursive?: boolean }): Promise<void>;
  
  /**
   * 创建一个新目录。
   * @param path - 要创建的目录的相对路径。
   */
  createDirectory(path: string): Promise<void>;
}