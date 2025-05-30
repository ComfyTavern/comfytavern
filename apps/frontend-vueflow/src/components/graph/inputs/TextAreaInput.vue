<template>
  <div class="textarea-input-wrapper">
    <textarea
      ref="textareaRef"
      :value="props.modelValue"
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      :readonly="props.readonly"
      :rows="props.rows"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
      class="custom-textarea w-full p-1 text-sm rounded border transition-colors duration-200 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 focus:border-transparent hover:border-gray-400 dark:hover:border-gray-500"
      :class="{
        'border-red-500 dark:border-red-700': props.hasError,
        'opacity-75 bg-gray-100 dark:bg-gray-800 cursor-default focus:ring-0 focus:border-gray-300 dark:focus:border-gray-600':
          props.readonly && !props.disabled,
        'disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed':
          props.disabled,
      }"
    />
    <div v-if="props.hasError" class="text-xs text-red-500 dark:text-red-400 mt-1">
      {{ props.errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue";

// 移除了 isDraggingResize 和 initialHeightOnMouseDown
const initialValueOnFocus = ref<string | null>(null); // Store initial text value on focus

interface Props {
  modelValue: string;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  rows?: number;
  readonly?: boolean;
  // preferFloatingEditor?: boolean // 移除
  // nodeId: string // 移除
  // inputKey: string // 移除
  // inputDefinition: InputDefinition // 移除
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  placeholder: "",
  disabled: false,
  hasError: false,
  errorMessage: "",
  rows: 5,
  readonly: false,
});

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const emit = defineEmits<{
  "update:modelValue": [value: string];
  blur: [value: string];

}>();

const handleInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  emit("update:modelValue", target.value);
};

// 移除了 handleGlobalMouseUp 和 handleMouseDown

const stopWheelPropagation = (event: WheelEvent) => {
  event.stopPropagation();
};

onMounted(() => {
  const el = textareaRef.value;
  if (el) {
    el.addEventListener("wheel", stopWheelPropagation, { passive: true });
  }
});

onUnmounted(() => {
  const el = textareaRef.value;
  if (el) {
    el.removeEventListener("wheel", stopWheelPropagation);
  }
});

const handleFocus = async () => {
  initialValueOnFocus.value = props.modelValue;
  await nextTick();
};

const handleBlur = () => {
  if (textareaRef.value) {
    const currentValue = textareaRef.value.value;
    if (initialValueOnFocus.value !== null && currentValue !== initialValueOnFocus.value) {
      emit("blur", currentValue);
    }
    initialValueOnFocus.value = null;
  } else {
    initialValueOnFocus.value = null;
  }
};

// 移除了 handlePreview 和 handleEdit 方法
</script>

<style scoped>
.textarea-input-wrapper {
  width: 100%;
  /* height: 100%; 移除，让内容决定高度，但 textarea 有 max-height */
  display: flex;
  flex-direction: column;
}

/* .textarea-container 样式已移除 */

.custom-textarea {
  /* flex-grow: 1; */ /* 在简单包裹器中不再需要 */
  /* max-height: 100px; */ /* 移除，由 rows 控制 */
  /* min-height: 60px; */ /* 移除，由 rows 控制 */
  overflow-y: auto; /* 内容超出时显示滚动条 */
  resize: none; /* 移除拖拽调整大小功能 */
}

/* .textarea-buttons 样式已移除 */
/* .action-button 样式已移除 */

/* 确保文本框在禁用状态下的鼠标样式正确 */
textarea:disabled {
  cursor: not-allowed;
}
</style>
