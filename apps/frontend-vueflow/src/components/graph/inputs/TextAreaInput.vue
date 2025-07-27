<template>
  <div class="textarea-input-wrapper">
    <label v-if="props.label" :for="id" class="sr-only">{{ props.label }}</label>
    <textarea
      :id="id"
      ref="textareaRef"
      :value="props.modelValue"
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      :readonly="props.readonly"
      :rows="props.rows"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
      class="node-input custom-textarea w-full rounded border transition-colors duration-200 bg-background-base dark:bg-background-surface border-border-base text-text-base placeholder-text-muted focus:ring-1 focus:ring-primary/50 focus:border-transparent hover:border-primary"
      :class="[sizeClasses.textarea, { // 应用 sizeClasses 并移除静态 p-1 text-sm
        'border-error': props.hasError,
        'opacity-75 bg-background-base dark:bg-background-surface/70 cursor-default focus:ring-0 focus:border-border-base':
          props.readonly && !props.disabled,
        'disabled:bg-background-base dark:disabled:bg-background-surface/50 disabled:text-text-muted disabled:cursor-not-allowed':
          props.disabled,
      }]"
    />
    <div v-if="props.hasError" class="text-xs text-error mt-1">
      {{ props.errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, useId } from "vue"; // 导入 computed

// 移除了 isDraggingResize 和 initialHeightOnMouseDown
const initialValueOnFocus = ref<string | null>(null); // Store initial text value on focus

interface Props {
  modelValue: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  rows?: number;
  readonly?: boolean;
  size?: "small" | "large"; // 添加 size prop
  // preferFloatingEditor?: boolean // 移除
  // nodeId: string // 移除
  // inputKey: string // 移除
  // inputDefinition: InputDefinition // 移除
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  label: '',
  placeholder: "",
  disabled: false,
  hasError: false,
  errorMessage: "",
  rows: 5,
  readonly: false,
  size: "small", // 设置 size 默认值
});

const id = useId();

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

const sizeClasses = computed(() => {
  if (props.size === "large") {
    return {
      textarea: "px-3 py-2 text-sm", // 大尺寸样式
    };
  }
  // Default 'small'
  return {
    textarea: "px-2 py-1 text-xs", // 小尺寸样式
  };
});
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
