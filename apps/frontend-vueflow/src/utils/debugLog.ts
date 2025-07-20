const isDebugMode = import.meta.env.DEV; // 只在开发模式下开启

/**
 * 打印调试日志
 * @param message 日志消息
 * @param data 相关数据
 */
export function debugLog(message: string, data?: any) {
  if (isDebugMode) {
    console.log(`[ComfyTavern Debug] ${message}`, data);
  }
}