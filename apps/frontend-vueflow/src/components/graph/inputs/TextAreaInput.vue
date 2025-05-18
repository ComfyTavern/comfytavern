<template>
  <div class="textarea-input">
    <template v-if="!props.preferFloatingEditor">
      <textarea
        ref="textareaRef"
        :value="props.modelValue"
        :placeholder="props.placeholder"
        :disabled="props.disabled"
        :readonly="props.readonly"
        :rows="props.rows"
        @input="handleInput"
        @mousedown="handleMouseDown"
        @focus="handleFocus"
        @blur="handleBlur"
        class="w-full p-1 text-sm rounded border transition-colors duration-200
               bg-white dark:bg-gray-700
               border-gray-300 dark:border-gray-600
               text-gray-900 dark:text-gray-100
               placeholder-gray-500 dark:placeholder-gray-400
               focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 focus:border-transparent
               hover:border-gray-400 dark:hover:border-gray-500
               resize-y min-h-[60px]"
        :style="textareaStyle"
        :class="{
          'border-red-500 dark:border-red-700': props.hasError,
          'opacity-75 bg-gray-100 dark:bg-gray-800 cursor-default focus:ring-0 focus:border-gray-300 dark:focus:border-gray-600': props.readonly && !props.disabled,
          'disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed': props.disabled
        }"
      />
    </template>
    <template v-else>
      <button
        type="button"
        @click="triggerFloatingEditor"
        :disabled="props.disabled"
        class="w-full p-2 text-left border rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 min-h-[60px] flex flex-col justify-center"
      >
        <span class="block font-medium text-gray-700 dark:text-gray-200">编辑文本</span>
        <span class="block text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{{ props.modelValue || props.placeholder }}</span>
      </button>
    </template>
    <div v-if="props.hasError && !props.preferFloatingEditor" class="text-xs text-red-500 dark:text-red-400 mt-1">
      {{ props.errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'; // Roo: Import computed and nextTick

// Roo: Add state to track resize dragging
const isDraggingResize = ref(false);
const initialHeightOnMouseDown = ref<number | null>(null); // Store initial height
const initialValueOnFocus = ref<string | null>(null); // Store initial text value on focus

interface Props {
  modelValue: string
  placeholder?: string
  disabled?: boolean
  hasError?: boolean
  errorMessage?: string
  rows?: number
  height?: number
  readonly?: boolean
  preferFloatingEditor?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  disabled: false,
  hasError: false,
  errorMessage: '',
  rows: 3,
  height: undefined,
  readonly: false,
  preferFloatingEditor: false,
})

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'resize-interaction-end': [payload: { newHeight: number }]
  'blur': [value: string]
  'request-floating-editor': [payload: { value: string }]
}>()

const triggerFloatingEditor = () => {
  emit('request-floating-editor', { value: props.modelValue });
};

const handleInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}

// Roo: Define the global mouseup handler at the top level
const handleGlobalMouseUp = () => {
  // console.log('Global mouseup triggered');
  if (isDraggingResize.value) { // Only act if we *thought* we were dragging
    isDraggingResize.value = false; // Reset dragging state
    if (textareaRef.value && initialHeightOnMouseDown.value !== null) {
      const currentHeight = textareaRef.value.offsetHeight; // Get current height
      // Only emit if the height actually changed since mousedown
      if (currentHeight !== initialHeightOnMouseDown.value) {
        // console.log(`Textarea resize interaction ended via global mouseup, height changed from ${initialHeightOnMouseDown.value} to ${currentHeight}. Emitting.`);
        emit('resize-interaction-end', { newHeight: currentHeight }); // Emit height in payload
      } else {
        // console.log(`Textarea resize interaction ended via global mouseup, height (${currentHeight}) did not change from initial (${initialHeightOnMouseDown.value}). Not emitting.`);
      }
    }
    initialHeightOnMouseDown.value = null; // Reset initial height
  }
  // Remove the global listener regardless
  document.removeEventListener('mouseup', handleGlobalMouseUp);
  // console.log('Removed global mouseup listener');
};

// Roo: Add mousedown handler
const handleMouseDown = () => {
  // Record the initial height when mouse button is pressed down on the textarea
  if (textareaRef.value) {
    initialHeightOnMouseDown.value = textareaRef.value.offsetHeight;
    // console.log(`Mousedown detected, initial height: ${initialHeightOnMouseDown.value}`);
  } else {
    initialHeightOnMouseDown.value = null;
  }
  // Assume dragging might start
  isDraggingResize.value = true;
  // Roo: Attach global listener in mousedown
  document.addEventListener('mouseup', handleGlobalMouseUp);
  // console.log('Added global mouseup listener');
};

// Roo: Removed old handleMouseUp function

const stopWheelPropagation = (event: WheelEvent) => {
  event.stopPropagation();
};

onMounted(() => {
  const el = textareaRef.value;
  if (el) {
    // We need passive: false because we call stopPropagation.
    el.addEventListener('wheel', stopWheelPropagation, { passive: false });
    // Roo: 也可以在这里添加 mouseup 监听器，但模板方式更 Vue 化
    // el.addEventListener('mouseup', handleMouseUp);
  }
});

onUnmounted(() => {
  const el = textareaRef.value;
  if (el) {
    el.removeEventListener('wheel', stopWheelPropagation);
  }
  // Roo: Ensure global listener is removed on unmount
  document.removeEventListener('mouseup', handleGlobalMouseUp);
  // Roo: Removed extra closing brace here
});

const handleFocus = async () => {
  // console.log('Textarea focused');
  // 1. Record initial value for change detection on blur
  initialValueOnFocus.value = props.modelValue; // Use modelValue as the source of truth on focus
  // console.log(`Textarea focused, initial value recorded: "${initialValueOnFocus.value?.substring(0,20)}..."`);

  // 2. Always attempt to apply the correct height on focus after DOM updates.
  //    This ensures the height from props is respected when focus occurs, overriding potential browser inconsistencies.
  await nextTick(); // Wait for potential DOM updates
  if (textareaRef.value && props.height) {
    // console.log(`Applying height on focus: ${props.height}px`);
    // Directly set style height to ensure it's applied correctly on focus.
    textareaRef.value.style.height = `${props.height}px`;
  }
};

const handleBlur = () => {
  // console.log('Textarea blurred');
  if (textareaRef.value) {
    // 1. 高度事件处理:
    //    - 如果在拖拽中失焦 (isDraggingResize is true)，mouseup 会处理高度，这里只需重置状态。
    //    - 如果非拖拽状态失焦，检查高度是否与 mousedown 时记录的高度不同，如果不同则发送事件。
    //      这可以防止仅聚焦/失焦就发送不必要的高度更新。
    if (isDraggingResize.value) {
      // console.log(`Textarea blurred while dragging, height handled by mouseup. Resetting drag state.`);
      isDraggingResize.value = false; // Reset drag state if blur happens during drag
      initialHeightOnMouseDown.value = null; // Also reset initial height tracking
    } else if (initialHeightOnMouseDown.value !== null) {
      // Only check/emit if we have an initial height recorded (meaning mousedown happened)
      const currentHeight = textareaRef.value.offsetHeight;
      if (currentHeight !== initialHeightOnMouseDown.value) {
        // console.log(`Textarea blurred while not dragging, height changed from ${initialHeightOnMouseDown.value} to ${currentHeight}. Emitting resize.`);
        emit('resize-interaction-end', { newHeight: currentHeight });
      } else {
        // console.log(`Textarea blurred while not dragging, height (${currentHeight}) same as initial (${initialHeightOnMouseDown.value}). Not emitting resize.`);
      }
      initialHeightOnMouseDown.value = null; // Reset after check
    } else {
      // console.log(`Textarea blurred while not dragging, no initial height recorded. Not emitting resize.`);
    }

    // 2. 文本值事件处理:
    //    - 比较当前值和聚焦时记录的初始值。
    //    - 只有当值发生变化时才发送 blur 事件。
    const currentValue = textareaRef.value.value;
    if (initialValueOnFocus.value !== null && currentValue !== initialValueOnFocus.value) {
      // console.log(`Textarea blurred, value changed from "${initialValueOnFocus.value?.substring(0,20)}..." to "${currentValue.substring(0, 20)}...". Emitting blur.`);
      emit('blur', currentValue);
    } else {
      // console.log(`Textarea blurred, value ("${currentValue.substring(0, 20)}...") has not changed since focus ("${initialValueOnFocus.value?.substring(0,20)}..."). Not emitting blur.`);
    }
    initialValueOnFocus.value = null; // Reset initial value tracking after check
  } else {
    // console.log('Textarea blurred but ref is null');
    initialValueOnFocus.value = null; // Also reset if ref is null
    initialHeightOnMouseDown.value = null; // Also reset if ref is null
  }
};

// Roo: Computed style for textarea
const textareaStyle = computed(() => {
  // Always apply height from props if available.
  // Manual resize is handled by browser + event emission.
  // Focus height correction is handled by handleFocus.
  if (props.height) {
    // console.log(`textareaStyle applying height: ${props.height}px`);
    return { height: `${props.height}px` };
  }
  // console.log(`textareaStyle returning {}, props.height: ${props.height}`);
  return {}; // No height prop, let CSS/browser control.
});
</script>

<style scoped>
.textarea-input {
  width: 100%;
  height: 100%;
}

/* 确保文本框在禁用状态下的鼠标样式正确 */
textarea:disabled {
  cursor: not-allowed;
}
</style>