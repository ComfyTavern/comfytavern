import { basename } from 'node:path';
import sanitize from 'sanitize-filename';

/**
 * 清理项目 ID，防止路径遍历和非法字符。
 * 使用 sanitize-filename 库，并将非法字符替换为下划线。
 * @param projectId 原始项目 ID
 * @returns 清理后的安全项目 ID，如果原始 ID 无效则返回 null
 */
export function sanitizeProjectId(projectId: string | undefined | null): string | null {
  if (!projectId) {
    return null;
  }
  const sanitized = sanitize(projectId, { replacement: '_' });
  // 额外检查，防止返回 "." 或 ".."
  if (sanitized === '.' || sanitized === '..') {
    return null;
  }
  return sanitized;
}

/**
 * 从 URL 参数中清理工作流 ID。
 * 首先进行 URL 解码，然后使用 path.basename 移除任何路径信息，
 * 最后进行基本的安全检查。
 * @param workflowIdParam 从 URL 参数获取的原始工作流 ID
 * @returns 清理后的安全工作流 ID (文件名)，如果原始 ID 无效则返回 null
 */
export function sanitizeWorkflowIdFromParam(workflowIdParam: string | undefined | null): string | null {
  if (!workflowIdParam) {
    return null;
  }
  try {
    const decodedId = decodeURIComponent(workflowIdParam);
    // 使用 basename 获取文件名部分，防止路径遍历
    const safeId = basename(decodedId);
    // 基础检查
    if (!safeId || safeId === '.' || safeId === '..') {
      return null;
    }
    // 可选：进一步使用 sanitize-filename 清理文件名中的非法字符
    // const finalSafeId = sanitize(safeId, { replacement: '_' });
    // if (finalSafeId === '.' || finalSafeId === '..') return null;
    // return finalSafeId;
    return safeId; // 暂时只用 basename
  } catch (e) {
    console.error(`Error decoding workflow ID param: ${workflowIdParam}`, e);
    return null; // 解码失败也视为无效
  }
}

/**
 * 从工作流名称生成安全的文件名 ID。
 * @param name 工作流名称
 * @returns 清理后的安全文件名 ID
 */
export function generateSafeWorkflowFilename(name: string | undefined | null): string {
    let safeFilename = sanitize(name || 'untitled', { replacement: '_' });
    // 移除连续的下划线
    safeFilename = safeFilename.replace(/_+/g, '_');
    // 移除开头和结尾的下划线
    safeFilename = safeFilename.replace(/^_+|_+$/g, '');

    if (!safeFilename || safeFilename === '.' || safeFilename === '..') {
      const now = new Date();
      const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
      safeFilename = `CT_workflow_${timestamp}`;
    }
    // 限制文件名长度，以防万一
    return safeFilename.substring(0, 200);
}

export interface ParsedHandleId {
  originalKey: string;
  index?: number;
  isSubHandle: boolean;
}

/**
 * 解析句柄 ID，区分普通句柄和子句柄 (例如 'key__0')。
 * @param handleId 原始句柄 ID
 * @returns 解析后的句柄信息对象
 */
export function parseSubHandleId(handleId: string | null | undefined): ParsedHandleId {
  if (!handleId) {
    return { originalKey: '', isSubHandle: false };
  }

  const parts = handleId.split('__');
  if (parts.length === 2) {
    const originalKey = parts[0];
    const indexStr = parts[1];
    const index = parseInt(indexStr, 10);

    if (!isNaN(index) && String(index) === indexStr) { // 确保索引是纯数字且转换后一致
      return { originalKey, index, isSubHandle: true };
    }
  }
  // 如果不符合 'key__index' 格式，则视为普通句柄 ID
  return { originalKey: handleId, isSubHandle: false };
}