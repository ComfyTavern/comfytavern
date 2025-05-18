<template>
  <div class="json-inline-viewer">
    <div class="preview-area-wrapper">
      <pre class="json-preview" :style="{ maxHeight: previewMaxHeight }">{{ formattedJson }}</pre>
      <div class="actions">
        <button class="action-button" title="在可停靠编辑器中编辑" @click="openDockedEditor">
          ✏️
        </button>
        <button v-if="showPreviewButton" class="action-button" title="预览完整内容 (控制台)" @click="triggerPreview">
          👁️
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue';
import type { InputDefinition } from '@comfytavern/types';

const props = defineProps({
  modelValue: {
    type: [Object, String] as PropType<Record<string, any> | any[] | string>,
    required: true,
  },
  nodeId: { type: String, required: true },
  inputKey: { type: String, required: true },
  inputDefinition: { type: Object as PropType<InputDefinition>, required: true },
  previewMaxHeight: { type: String, default: '150px' },
  // 可选的预览按钮，根据需要启用
  showPreviewButton: { type: Boolean, default: true },
});

const emit = defineEmits(['open-docked-editor']);

const parsedValue = computed(() => {
  if (typeof props.modelValue === 'string') {
    try {
      return JSON.parse(props.modelValue);
    }
    catch (error) {
      console.warn(`[JsonInlineViewer] 无法解析 modelValue 字符串: ${props.modelValue}`, error);
      return { error: '无效的 JSON 字符串', originalValue: props.modelValue };
    }
  }
  return props.modelValue;
});

const formattedJson = computed(() => {
  try {
    return JSON.stringify(parsedValue.value, null, 2);
  }
  catch (error) {
    console.error('[JsonInlineViewer] 格式化 JSON 失败:', error);
    // 对于无法序列化的对象（例如包含循环引用），提供一个回退显示
    if (typeof parsedValue.value === 'object' && parsedValue.value !== null) {
      return `[无法序列化对象: ${parsedValue.value.toString()}]`;
    }
    return String(parsedValue.value); // 最后尝试转换为字符串
  }
});

const openDockedEditor = () => {
  const currentValueString = typeof props.modelValue === 'string'
    ? props.modelValue // 如果已经是字符串，直接使用
    : JSON.stringify(props.modelValue, null, 2); // 否则序列化

  const payload = {
    nodeId: props.nodeId,
    inputKey: props.inputKey,
    currentValue: currentValueString,
    inputDefinition: props.inputDefinition,
    editorTitle: props.inputDefinition.displayName || props.inputKey || 'JSON 编辑器',
  };
  emit('open-docked-editor', payload);
};

const triggerPreview = () => {
  const previewContent = formattedJson.value.length > 200
    ? `${formattedJson.value.substring(0, 200)}...`
    : formattedJson.value;
  console.log(
    `[JsonInlineViewer] 预览触发: inputKey='${props.inputKey}', nodeId='${props.nodeId}', value (前200字符):`,
    previewContent,
  );
  // 实际的 Tooltip/Modal 预览逻辑可以后续添加
};
</script>

<style scoped>
.json-inline-viewer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  position: relative; /* 用于按钮的绝对定位（如果需要） */
}

.preview-area-wrapper {
  display: flex;
  align-items: flex-start; /* 按钮与预览区域顶部对齐 */
  gap: 6px;
  width: 100%;
}

.json-preview {
  flex-grow: 1;
  padding: 8px;
  border: 1px solid var(--color-border-input, #ccc);
  border-radius: 4px;
  background-color: var(--color-bg-input, #f9f9f9);
  color: var(--color-text-input, #333);
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  font-size: 0.8em; /* 稍微小一点的字体以容纳更多内容 */
  line-height: 1.4;
  overflow-y: auto; /* 垂直滚动条 */
  white-space: pre-wrap; /* 保留换行和空格，并允许自动换行 */
  word-break: break-all; /* 对于长字符串，允许在任意字符处换行 */
  min-height: 40px; /* 最小高度，避免空内容时塌陷 */
}

.actions {
  display: flex;
  flex-direction: column; /* 按钮垂直排列 */
  gap: 4px;
  padding-top: 2px; /* 微调与预览区域的对齐 */
}

.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  background-color: var(--color-bg-button, #eee);
  border: 1px solid var(--color-border-button, #ccc);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em; /* 按钮图标大小 */
  color: var(--color-text-button, #333);
  transition: background-color 0.2s;
}

.action-button:hover {
  background-color: var(--color-bg-button-hover, #ddd);
}

.action-button:active {
  background-color: var(--color-bg-button-active, #ccc);
}

/* 暗色模式下的变量（如果项目中有定义） */
.dark .json-preview {
  border-color: var(--color-border-input-dark, #555);
  background-color: var(--color-bg-input-dark, #2a2a2a);
  color: var(--color-text-input-dark, #eee);
}

.dark .action-button {
  background-color: var(--color-bg-button-dark, #444);
  border-color: var(--color-border-button-dark, #666);
  color: var(--color-text-button-dark, #eee);
}

.dark .action-button:hover {
  background-color: var(--color-bg-button-hover-dark, #555);
}

.dark .action-button:active {
  background-color: var(--color-bg-button-active-dark, #666);
}
</style>