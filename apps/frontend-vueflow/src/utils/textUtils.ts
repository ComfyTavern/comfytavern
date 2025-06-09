const canvas = document.createElement("canvas");
const context = canvas.getContext("2d");

// 缓存对象，用于存储已计算的文本宽度
const textWidthCache: { [key: string]: number } = {};
const MAX_CACHE_SIZE = 500; // 简单的大小限制，防止内存无限增长
let cacheKeys: string[] = [];

/**
 * Measures the width of a text string using a canvas context, with caching.
 * @param text The text to measure.
 * @param font The CSS font string (e.g., '500 14px Inter, sans-serif'). Defaults to the node title font.
 * @returns The width of the text in pixels.
 */
export function measureTextWidth(text: string, font: string = NODE_TITLE_FONT): number {
  const cacheKey = `${font}:${text}`;
  if (textWidthCache[cacheKey] !== undefined) {
    return textWidthCache[cacheKey];
  }

  if (!context) {
    // Fallback estimation if canvas context is not available
    console.warn("Canvas context not available for text measurement. Using estimation.");
    // A very rough estimation
    let estimatedWidth = 0;
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      // Basic check for CJK characters
      if (charCode >= 0x4e00 && charCode <= 0x9fff) {
        estimatedWidth += 14; // Assume CJK characters are wider (adjust as needed)
      } else {
        estimatedWidth += 8; // Assume non-CJK characters are narrower (adjust as needed)
      }
    }
    return estimatedWidth * 1.1; // Add some buffer
  }
  context.font = font;
  const metrics = context.measureText(text);
  // Add a small buffer for potential rendering differences
  const width = metrics.width + 2;

  // 添加到缓存
  if (cacheKeys.length >= MAX_CACHE_SIZE) {
    const oldestKey = cacheKeys.shift();
    if (oldestKey) {
      delete textWidthCache[oldestKey];
    }
  }
  textWidthCache[cacheKey] = width;
  cacheKeys.push(cacheKey);

  return width;
}

// Define font styles used in the node based on Tailwind classes
// Ensure these match the actual styles applied in BaseNode.vue and Tailwind config
export const NODE_TITLE_FONT = "500 14px Inter, sans-serif"; // text-sm font-medium
export const NODE_DESC_FONT = "400 14px Inter, sans-serif"; // text-sm
export const NODE_PARAM_FONT = "500 14px Inter, sans-serif"; // text-sm font-medium (for param names)
export const NODE_INPUT_TITLE_FONT = "500 12px Inter, sans-serif"; // text-xs font-medium (for "输入"/"输出" titles)
import sanitize from "sanitize-filename";

/**
 * 从工作流名称生成安全的文件名 ID (前端版本)。
 * 模拟后端 `generateSafeWorkflowFilename` 的核心逻辑。
 * @param name 工作流名称
 * @returns 清理后的安全文件名 ID
 */
export function generateSafeWorkflowFilename(name: string | undefined | null): string {
  let safeFilename = sanitize(name || "untitled", { replacement: "_" });
  // 移除连续的下划线
  safeFilename = safeFilename.replace(/_+/g, "_");
  // 移除开头和结尾的下划线
  safeFilename = safeFilename.replace(/^_+|_+$/g, "");

  if (!safeFilename || safeFilename === "." || safeFilename === "..") {
    // 在前端，我们不方便生成精确的时间戳，
    // 但如果清理后为空或无效，返回一个固定的或基于输入的值，
    // 后端在保存时仍会进行最终检查和可能的时间戳生成。
    // 这里返回一个基于原始名称的清理版本，或一个默认值。
    safeFilename = `invalid_name_${sanitize(name || "untitled", { replacement: "" }).substring(
      0,
      10
    )}`;
    if (!safeFilename || safeFilename === "." || safeFilename === "..") {
      safeFilename = "invalid_workflow_name"; // 最终回退
    }
  }
  // 限制文件名长度
  return safeFilename.substring(0, 200);
}

/**
 * 简单的 Markdown 移除函数 (用于预览等)。
 * 移除常见的 Markdown 标记，如 **, *, _, `, #, [], () 等。
 * 注意：这只是一个基础实现，可能无法处理所有 Markdown 情况。
 * @param markdownText Markdown 文本
 * @returns 清理后的文本
 */
export function stripMarkdown(markdownText: string): string {
  if (!markdownText) return "";

  // 移除加粗、斜体、删除线
  let text = markdownText.replace(/(\*\*|__)(.*?)\1/g, "$2"); // **bold** or __bold__
  text = text.replace(/(\*|_)(.*?)\1/g, "$2"); // *italic* or _italic_
  text = text.replace(/~~(.*?)~~/g, "$1"); // ~~strikethrough~~

  // 移除行内代码
  text = text.replace(/`(.*?)`/g, "$1");

  // 移除标题标记
  text = text.replace(/^#+\s+/gm, "");

  // 移除链接（保留链接文本）
  text = text.replace(/\[(.*?)\]\(.*?\)/g, "$1");

  // 移除图片（保留 alt 文本）
  text = text.replace(/!\[(.*?)\]\(.*?\)/g, "$1");

  // 移除列表标记 (*, -, +) 和数字列表 (1.)
  text = text.replace(/^[\*\-\+]\s+/gm, "");
  text = text.replace(/^\d+\.\s+/gm, "");

  // 移除引用标记 (>)
  text = text.replace(/^>\s+/gm, "");

  // 移除水平线 (---, ***, ___)
  text = text.replace(/^(---|___|\*\*\*)\s*$/gm, "");

  // 移除 HTML 标签 (基础)
  text = text.replace(/<[^>]*>/g, "");

  // 移除多余的换行符合并空格
  text = text.replace(/\n{2,}/g, "\n"); // 多个换行变单个
  text = text.replace(/\s{2,}/g, " "); // 多个空格变单个
  text = text.trim();

  return text;
}
