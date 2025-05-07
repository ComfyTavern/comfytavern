import type { HistoryEntry, HistoryEntryDetails } from '@comfytavern/types';

/**
 * 创建一个结构化的历史记录条目
 * @param actionType 操作类型
 * @param objectType 对象类型
 * @param summary 核心描述 (未来可能改为 i18n Key)
 * @param details 详细信息对象
 * @returns HistoryEntry 对象
 */
export function createHistoryEntry(
    actionType: string,
    objectType: string,
    summary: string,
    details: HistoryEntryDetails
): HistoryEntry {
  return {
    actionType,
    objectType,
    summary,
    details,
    timestamp: Date.now(), // 自动添加当前时间戳
  };
}