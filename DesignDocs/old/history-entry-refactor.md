# 历史记录条目结构化重构方案

## 问题

当前项目中，用于记录操作历史的 `label` 字符串格式不统一，主要存在以下问题：

1.  **格式不一致**: 使用不同的分隔符（`-`, `()`, `:`）和结构来表示相似的操作。
2.  **信息混合**: 将操作类型、对象、细节、新旧值等信息混合在一个字符串中，不利于程序处理和 UI 展示。
3.  **可读性/可维护性**: 格式不统一导致可读性下降，未来修改格式需要修改多处代码。
4.  **不利于扩展**: 难以基于字符串实现更丰富的 UI 效果（如图标、样式）或 Tooltip 详情，也不方便添加 i18n 支持。

## 解决方案：结构化历史记录对象

提议不再生成单一的 `label` 字符串，而是创建一个结构化的 `HistoryEntry` 对象来记录每次操作。

### 1. `HistoryEntry` 接口定义

建议在 `packages/types/src/history.ts` (如果不存在则创建) 中定义以下接口：

```typescript
// packages/types/src/history.ts

/**
 * 历史记录条目的详细信息
 * 允许存储与特定操作相关的任意键值对
 */
export interface HistoryEntryDetails {
  [key: string]: any; // 允许任意详细参数
  key?: string;        // 例如接口的 key
  propertyName?: string; // 例如修改的属性名 ('width', 'name')
  oldValue?: any;        // 属性旧值
  newValue?: any;        // 属性新值
  nodeId?: string;       // 相关节点 ID
  nodeName?: string;     // 相关节点名称
  nodeType?: string;     // 相关节点类型
  direction?: 'up' | 'down'; // 例如移动方向
  // ... 可根据需要添加其他特定操作的细节字段
}

/**
 * 结构化的历史记录条目对象
 */
export interface HistoryEntry {
  /** 操作类型 (例如: 'modify', 'add', 'delete', 'move', 'adjust', 'sort') */
  actionType: string;
  /** 操作对象类型 (例如: 'node', 'interface', 'canvas', 'component') */
  objectType: string;
  /** 核心描述 (简洁，适合列表展示，未来可用于 i18n Key) */
  summary: string;
  /** 详细信息对象，用于生成 Tooltip 或详细视图 */
  details: HistoryEntryDetails;
  /** 操作发生的时间戳 (Unix timestamp in milliseconds) */
  timestamp: number;
  // /** (未来预留) 指向翻译文件的键 */
  // i18nKey?: string;
  // /** (未来预留) 传递给 i18n 函数的参数 */
  // i18nParams?: Record<string, any>;
}

```

### 2. 辅助函数 `createHistoryEntry`

建议在 `packages/utils/src/historyUtils.ts` (如果不存在则创建) 中创建此辅助函数：

```typescript
// packages/utils/src/historyUtils.ts
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
```

### 3. 使用示例

在原先生成 `label` 字符串的地方，改为调用 `createHistoryEntry`：

```typescript
// 原代码:
// const label = `修改 - 接口 (添加输入 ${newKey})`;
// recordHistory(label); // 假设 recordHistory 接受字符串

// 新代码:
import { createHistoryEntry } from '@comfytavern/utils';
import type { HistoryEntry } from '@comfytavern/types';

const entry: HistoryEntry = createHistoryEntry(
  'modify',          // actionType
  'interface',       // objectType
  '添加输入',        // summary (未来可能是 i18n key)
  { key: newKey }   // details
);
recordHistory(entry); // 假设 recordHistory 现在接受 HistoryEntry 对象
```

### 4. 前端展示

*   历史记录列表可以根据 `actionType` 和 `objectType` 显示不同的图标或背景色。
*   列表中直接显示 `summary`。
*   鼠标悬停在条目上时，利用 `details` 对象动态生成一个包含所有相关信息的 Tooltip。

## 优点

*   **结构化**: 数据清晰，易于程序处理和传递。
*   **UI 灵活**: 可根据类型实现丰富的视觉区分（图标、颜色等）。
*   **信息分离**: 核心摘要 (`summary`) 和详细参数 (`details`) 分离，展示更清晰。
*   **丰富的 Tooltip**: 可以轻松生成包含完整上下文的 Tooltip。
*   **i18n 友好**: 预留了 `i18nKey` 和 `i18nParams` 的位置，方便未来实现国际化。
*   **可维护性**: 统一了历史记录的创建方式，便于维护和扩展。