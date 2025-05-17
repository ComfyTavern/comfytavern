# 插槽类型系统核心设计笔记

本文档是 [`DesignDocs/architecture/new-slot-type-system-design.md`](../DesignDocs/architecture/new-slot-type-system-design.md) 的核心摘要，用于在执行具体编码任务时快速参考新类型系统的关键定义。

## 1. 核心变更

- 旧的插槽 `type: string` 字段被移除。
- 引入两个新字段到 `InputDefinition` 和 `OutputDefinition`:
    - `dataFlowType: DataFlowTypeName` (必需): 定义基础数据结构。
    - `matchCategories?: string[]` (可选): 定义语义/用途/行为标签，可以是内置标签或自定义字符串。

## 2. `DataFlowType` 定义

```typescript
// 来自: packages/types/src/schemas.ts
export const DataFlowType = {
  STRING: "STRING",
  INTEGER: "INTEGER",
  FLOAT: "FLOAT",
  BOOLEAN: "BOOLEAN",
  OBJECT: "OBJECT",
  ARRAY: "ARRAY",
  BINARY: "BINARY",
  WILDCARD: "WILDCARD",
  CONVERTIBLE_ANY: "CONVERTIBLE_ANY",
} as const;
export type DataFlowTypeName = (typeof DataFlowType)[keyof typeof DataFlowType];
```

## 3. `BuiltInSocketMatchCategory` 定义 (推荐使用的内置标签)

```typescript
// 来自: packages/types/src/schemas.ts
export const BuiltInSocketMatchCategory = {
  // 语义化/内容特征标签 (V3 精简命名)
  CODE: "Code",
  JSON: "Json",
  MARKDOWN: "Markdown",
  URL: "Url",
  FILE_PATH: "FilePath",
  PROMPT: "Prompt",
  CHAT_MESSAGE: "ChatMessage",
  CHAT_HISTORY: "ChatHistory",
  LLM_CONFIG: "LlmConfig",
  LLM_OUTPUT: "LlmOutput",
  VECTOR_EMBEDDING: "VectorEmbedding",
  CHARACTER_PROFILE: "CharacterProfile",
  IMAGE_DATA: "ImageData", // 实际图像数据 (通常配合 OBJECT/BINARY DataFlowType)
  AUDIO_DATA: "AudioData", // 实际音频数据
  VIDEO_DATA: "VideoData", // 实际视频数据
  RESOURCE_ID: "ResourceId",
  TRIGGER: "Trigger",
  STREAM_CHUNK: "StreamChunk",
  COMBO_OPTION: "ComboOption",

  // 行为标签
  BEHAVIOR_WILDCARD: "BehaviorWildcard",
  BEHAVIOR_CONVERTIBLE: "BehaviorConvertible",
} as const;
export type BuiltInSocketMatchCategoryName = (typeof BuiltInSocketMatchCategory)[keyof typeof BuiltInSocketMatchCategory];
```
**注意:** `matchCategories` 数组中可以包含 `BuiltInSocketMatchCategoryName` 的值，也可以包含开发者自定义的字符串标签。

## 4. 连接兼容性逻辑概要

1.  **特殊行为标签优先**: `BEHAVIOR_WILDCARD` 和 `BEHAVIOR_CONVERTIBLE` 具有最高优先级。
2.  **`SocketMatchCategory` 匹配**: 如果源和目标插槽都定义了 `matchCategories` (且不为空)，则优先基于这些标签进行匹配 (直接标签相同或通过预定义的内置标签兼容规则)。
3.  **`DataFlowType` 保底匹配**: 如果 `SocketMatchCategory` 未提供或匹配失败，则回退到基于 `DataFlowType` 的预定义转换规则进行匹配。

## 5. UI 表现

- **不使用顶层 `uiHint` 字段。**
- UI 组件的选择和渲染方式主要依据 `DataFlowType`、`SocketMatchCategory` (可选) 以及 `InputDefinition.config` 对象内部的具体配置项 (如 `multiline`, `languageHint`, `suggestions`, `preferFloatingEditor` 等)。

---
*请始终参考主设计文档 [`DesignDocs/architecture/new-slot-type-system-design.md`](../DesignDocs/architecture/new-slot-type-system-design.md) 获取最完整和最新的信息。*