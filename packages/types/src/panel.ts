import { z } from 'zod';

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