<template>
  <div class="code-input-trigger flex items-center space-x-1">
    <button
      type="button"
      v-comfy-tooltip="'预览代码'"
      aria-label="预览代码"
      class="p-1 rounded hover:bg-background-hover focus:outline-none focus:ring-1 focus:ring-primary/50"
      @click="handlePreview"
    >
      <!-- 👁️ -->
      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5M12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5s5 2.24 5 5s-2.24 5-5 5m0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3s3-1.34 3-3s-1.34-3-3-3"/></svg>
    </button>
    <button
      type="button"
      v-comfy-tooltip="'编辑代码'"
      aria-label="编辑代码"
      class="p-1 rounded hover:bg-background-hover focus:outline-none focus:ring-1 focus:ring-primary/50"
      @click="handleEdit"
    >
      <!-- ✏️ / </> -->
      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83l3.75 3.75M3 17.25V21h3.75L17.81 9.94l-3.75-3.75"/></svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';
import type { InputDefinition } from '@comfytavern/types';

const props = defineProps({
  nodeId: { type: String, required: true },
  inputKey: { type: String, required: true },
  currentValue: { type: String, default: '' },
  inputDefinition: { type: Object as PropType<InputDefinition>, required: true }
});

const emit = defineEmits(['open-docked-editor']);

const handlePreview = () => {
  const languageHint = props.inputDefinition.config?.languageHint || 'text';
  console.log(
    `CodeInput: Preview triggered for input: ${props.inputKey}, value: ${props.currentValue.substring(0, 50)}${props.currentValue.length > 50 ? '...' : ''}, languageHint: ${languageHint}`
  );
  // 后续任务将在此处集成 Tooltip 和代码高亮
};

const handleEdit = () => {
  const editorTitle = props.inputDefinition.displayName || props.inputKey;
  const payload = {
    nodeId: props.nodeId,
    inputKey: props.inputKey,
    currentValue: props.currentValue,
    inputDefinition: props.inputDefinition,
    editorTitle: `编辑: ${editorTitle}`
  };
  emit('open-docked-editor', payload);
};
</script>

<style scoped>
.code-input-trigger button svg {
  width: 16px; /* 控制图标大小 */
  height: 16px; /* 控制图标大小 */
  display: block; /* 确保SVG正确对齐 */
}
/* 可以根据需要添加更多样式来微调按钮的外观和间距 */
</style>