<template>
  <div ref="rootRef" class="number-input relative w-full">
    <!-- Standard number input with steppers/drag -->
    <template v-if="isEditing">
      <input
        ref="inputRef"
        type="number"
        :value="editingValue"
        :min="props.min"
        :max="props.max"
        :step="props.step"
        :placeholder="props.placeholder"
        :disabled="props.disabled"
        :readonly="props.readonly"
        @input="handleInput"
        @blur="endEdit"
        @keydown.enter="endEdit"
        @keydown.esc="cancelEdit"
        class="w-full rounded border transition-colors duration-200 bg-background-base dark:bg-background-surface border-border-base text-text-base placeholder-text-muted focus:ring-1 focus:ring-primary/50 focus:border-transparent hover:border-primary text-left"
        :class="[
          sizeClasses.editingInput,
          {
            'border-error': hasError,
            'opacity-75 bg-background-base dark:bg-background-surface/70 cursor-default focus:ring-0 focus:border-border-base': // Simplified readonly bg
              props.readonly && !props.disabled,
            'disabled:bg-background-base dark:disabled:bg-background-surface/50 disabled:text-text-muted disabled:cursor-not-allowed': // Simplified disabled bg
              props.disabled,
          }
        ]"
        autocomplete="off"
      />
    </template>
    <template v-else>
      <div
        v-comfy-tooltip="{ content: tooltipContent, placement: 'top', delayShow: 500 }"
        class="flex items-stretch rounded overflow-hidden border border-border-base group focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-transparent w-full"
        :class="[
          sizeClasses.displayWrapper,
          {
            'opacity-75 bg-background-base dark:bg-background-surface/70 cursor-default': // Simplified readonly bg
              props.readonly && !props.disabled,
            'opacity-50 cursor-not-allowed': props.disabled,
          }
        ]"
      >
        <!-- 减少按钮 -->
        <button
          class="flex items-center justify-center text-text-muted bg-background-base hover:bg-background-hover active:bg-primary/20 transition-colors duration-200 focus:outline-none border-r border-border-base"
          :class="sizeClasses.stepperButton"
          @click.stop="stepValue(-1)"
          :disabled="props.disabled || props.readonly"
        >
          <svg
            class="w-2.5 h-2.5 transform rotate-90"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6 9L12 15L18 9"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <!-- 数值显示 -->
        <div
          ref="valueDisplayRef"
          class="flex flex-1 items-center select-none text-text-base text-right transition-colors duration-200 bg-background-base dark:bg-background-surface"
          :class="[
            sizeClasses.valueDisplay,
            {
              'opacity-50 cursor-not-allowed': props.disabled, // Highest precedence for disabled
              'opacity-75 cursor-default': props.readonly && !props.disabled, // Readonly takes precedence over interactive if not disabled
              'cursor-ew-resize': !props.disabled && !props.readonly, // Draggable only if not disabled or readonly
              'border-error': hasError,
              'cursor-pointer hover:bg-background-hover':
                hasSuggestions && !props.disabled && !props.readonly && !isDragging, // Click to open suggestions
            }
          ]"
          @mousedown.stop="handleMouseDown"
        >
          {{ formatDisplayValue(displayValue) }}
        </div>

        <!-- 增加按钮 -->
        <button
          class="flex items-center justify-center text-text-muted bg-background-base hover:bg-background-hover active:bg-primary/20 transition-colors duration-200 focus:outline-none border-l border-border-base"
          :class="sizeClasses.stepperButton"
          @click.stop="stepValue(1)"
          :disabled="props.disabled || props.readonly"
        >
          <svg
            class="w-2.5 h-2.5 transform -rotate-90"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6 9L12 15L18 9"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    </template>

    <!-- Suggestion Dropdown Component (Rendered outside the main input structure) -->
    <SuggestionDropdown
      v-if="hasSuggestions"
      :suggestions="suggestions"
      :show="isDropdownVisible"
      :position="dropdownPosition"
      :target-element="rootRef"
      :trigger-width="dropdownWidth"
      :canvas-scale="currentCanvasScale"
      @select="handleSuggestionSelect"
      @close="closeDropdown"
    />

    <!-- Error Message -->
    <div
      v-if="hasError"
      class="absolute top-full left-0 w-full text-xs text-error mt-1"
    >
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick, computed } from "vue";
import { useVueFlow } from "@vue-flow/core";
import SuggestionDropdown from "../../common/SuggestionDropdown.vue";
// import Tooltip from "../../common/Tooltip.vue"; // Tooltip 组件不再直接使用

interface Props {
  modelValue: number;
  type?: "INTEGER" | "FLOAT"; // 将整数类型从旧的INT改为INTEGER
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  suggestions?: number[];
  readonly?: boolean;
  size?: 'small' | 'large';
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: 0,
  type: "FLOAT",
  min: undefined,
  max: undefined,
  step: undefined,
  placeholder: "",
  disabled: false,
  suggestions: () => [],
  readonly: false,
  size: 'small',
});

const emit = defineEmits<{
  "update:modelValue": [value: number];
}>();

const isEditing = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const rootRef = ref<HTMLDivElement | null>(null);
const valueDisplayRef = ref<HTMLDivElement | null>(null);
const startValue = ref(0);
const startX = ref(0);
const isDragging = ref(false);
const hasError = ref(false);
const errorMessage = ref("");
const draggedValue = ref<number | null>(null);
const editingValue = ref<string>("");

// Dropdown state
const isDropdownVisible = ref(false);
const dropdownPosition = ref({ x: 0, y: 0 });
const dropdownWidth = ref(0);

// Get viewport from VueFlow to access zoom level
const { viewport } = useVueFlow();
const currentCanvasScale = computed(() => viewport.value.zoom ?? 1);

const sizeClasses = computed(() => {
  if (props.size === 'large') {
    return {
      editingInput: 'h-10 px-3 py-2 text-sm',
      displayWrapper: 'h-10',
      stepperButton: 'w-8 px-2',
      valueDisplay: 'px-3 text-sm',
    };
  }
  // Default 'small'
  return {
    editingInput: 'h-6 px-2 py-1 text-xs',
    displayWrapper: 'h-6',
    stepperButton: 'w-4 px-0.5',
    valueDisplay: 'px-2 text-xs',
  };
});


const hasSuggestions = computed(() => props.suggestions && props.suggestions.length > 0);

const displayValue = computed(() => {
  if (isDragging.value && draggedValue.value !== null) {
    return draggedValue.value;
  }
  return props.modelValue;
});

const tooltipContent = computed(() => {
  const parts: string[] = [];
  if (props.min !== undefined) parts.push(`- **Min:** ${props.min}`);
  if (props.max !== undefined) parts.push(`- **Max:** ${props.max}`);
  if (props.step !== undefined) parts.push(`- **Step:** ${props.step}`);
  return parts.length > 0 ? parts.join("\n") : undefined;
});

const closeDropdown = () => {
  isDropdownVisible.value = false;
};

const handleSuggestionSelect = (selectedValue: { value: string | number }) => {
  const numericValue = Number(selectedValue.value);
  if (!isNaN(numericValue) && validateValue(numericValue)) {
    if (numericValue !== props.modelValue) {
      emit("update:modelValue", numericValue);
    }
    hasError.value = false;
    errorMessage.value = "";
    isEditing.value = false;
  } else {
    hasError.value = true;
    errorMessage.value = "选择的值无效";
    isEditing.value = false;
  }
  closeDropdown();
};

const formatDisplayValue = (value: number): string => {
  if (props.type === "INTEGER") {
    const intResult = Math.round(value).toString();
    return intResult;
  }
  const numValue = Number(value);
  if (isNaN(numValue)) {
    return "NaN";
  }
  const stepStr = String(props.step ?? 0.01);
  const parts = stepStr.split(".");
  const decimalPlaces = parts.length > 1 && parts[1] ? parts[1].length : 0;

  const floatResult = numValue.toFixed(Math.max(props.type === "FLOAT" ? 2 : 0, decimalPlaces)); // 如果是FLOAT，至少2位，否则根据decimalPlaces（INT时这里不执行）
  return floatResult;
};

const startEdit = async () => {
  if (props.disabled || props.readonly) return;

  let calculatedPosition: { x: number; y: number } | null = null;
  let calculatedWidth = 0;
  if (hasSuggestions.value && rootRef.value) {
    const rect = rootRef.value.getBoundingClientRect();
    calculatedPosition = {
      x: rect.left,
      y: rect.bottom + window.scrollY,
    };
    calculatedWidth = rootRef.value.offsetWidth;
  }

  editingValue.value = String(props.modelValue);
  isEditing.value = true;

  await nextTick();

  inputRef.value?.focus();
  inputRef.value?.select();

  if (hasSuggestions.value && calculatedPosition && calculatedWidth > 0) {
    dropdownPosition.value = calculatedPosition;
    dropdownWidth.value = calculatedWidth;
    isDropdownVisible.value = true;
  } else {
    closeDropdown();
  }
};

const endEdit = () => {
  if (!isEditing.value) {
    closeDropdown();
    return;
  }

  const finalInputValue = editingValue.value;
  let numericValue = finalInputValue === "" ? 0 : Number(finalInputValue);
  let correctedValue = numericValue;

  if (!validateValue(numericValue)) {
    hasError.value = true;
    if (props.min !== undefined && numericValue < props.min) correctedValue = props.min;
    else if (props.max !== undefined && numericValue > props.max) correctedValue = props.max;
    else if (isNaN(numericValue)) correctedValue = props.min !== undefined ? props.min : 0;
    else correctedValue = numericValue;

    if (props.type === "INTEGER") {
      correctedValue = Math.round(correctedValue);
    }
  } else {
    hasError.value = false;
    errorMessage.value = "";
    if (props.type === "INTEGER") {
      correctedValue = Math.round(numericValue);
    } else {
      correctedValue = numericValue;
    }
  }

  if (correctedValue !== props.modelValue) {
    emit("update:modelValue", correctedValue);
  }

  isEditing.value = false;
  editingValue.value = "";
  closeDropdown();
};

const cancelEdit = () => {
  isEditing.value = false;
  editingValue.value = "";
  hasError.value = false;
  errorMessage.value = "";
  closeDropdown();
};

const stepValue = (direction: number) => {
  if (props.disabled || props.readonly) return; // Added readonly check
  closeDropdown();

  const step = props.step ?? (props.type === "INTEGER" ? 1 : 0.1);
  let newValue = props.modelValue + step * direction;

  if (props.min !== undefined) newValue = Math.max(props.min, newValue);
  if (props.max !== undefined) newValue = Math.min(props.max, newValue);
  if (props.type === "INTEGER") newValue = Math.round(newValue);

  if (validateValue(newValue)) {
    hasError.value = false;
    errorMessage.value = "";
    emit("update:modelValue", newValue);
  } else {
    hasError.value = true;
  }
};

const handleMouseDown = (event: MouseEvent) => {
  if (props.disabled || props.readonly || isEditing.value) return;
  closeDropdown();

  const startTime = Date.now();
  const initialX = event.clientX;

  const handleMouseMove = (moveEvent: MouseEvent) => {
    if (Math.abs(moveEvent.clientX - initialX) > 3) {
      startDrag(event);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }
  };

  const handleMouseUp = (upEvent: MouseEvent) => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);

    const clickDuration = Date.now() - startTime;
    const isClick =
      !isDragging.value && clickDuration < 200 && Math.abs(upEvent.clientX - initialX) <= 3;

    if (isClick) {
      startEdit();
    }
  };

  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
};

const startDrag = (event: MouseEvent) => {
  if (props.disabled || props.readonly || isEditing.value) return;

  event.preventDefault();
  isDragging.value = true;
  startValue.value = props.modelValue;
  draggedValue.value = props.modelValue;
  startX.value = event.clientX;
  document.body.style.cursor = "ew-resize";
  window.addEventListener("mousemove", handleDrag);
  window.addEventListener("mouseup", stopDrag);
};

const handleDrag = (event: MouseEvent) => {
  if (!isDragging.value) return;

  const delta = event.clientX - startX.value;
  const isShiftPressed = event.shiftKey;
  let sensitivity = props.type === "INTEGER" ? 0.25 : 0.01; // 降低整数拖拽的默认灵敏度
  if (isShiftPressed) sensitivity = props.type === "INTEGER" ? 0.1 : 0.001; // 进一步降低Shift按下时的灵敏度

  let newValue = startValue.value + delta * sensitivity;
  if (props.min !== undefined) newValue = Math.max(props.min, newValue);
  if (props.max !== undefined) newValue = Math.min(props.max, newValue);
  if (props.type === "INTEGER") newValue = Math.round(newValue);

  if (validateValue(newValue)) {
    draggedValue.value = newValue;
  }
};

const stopDrag = () => {
  if (!isDragging.value) return;

  const finalValue = draggedValue.value;

  isDragging.value = false;
  document.body.style.cursor = "";
  window.removeEventListener("mousemove", handleDrag);
  window.removeEventListener("mouseup", stopDrag);
  draggedValue.value = null;

  if (finalValue !== null && finalValue !== startValue.value) {
    if (validateValue(finalValue)) {
      hasError.value = false;
      errorMessage.value = "";
      emit("update:modelValue", finalValue);
    } else {
      hasError.value = true;
    }
  } else {
    if (!validateValue(startValue.value)) {
      hasError.value = true;
    } else {
      hasError.value = false;
      errorMessage.value = "";
    }
  }
};

onUnmounted(() => {
  if (isDragging.value) {
    stopDrag();
  }
});

const validateValue = (value: number): boolean => {
  if (isNaN(value)) {
    errorMessage.value = "请输入有效的数字";
    return false;
  }
  if (props.min !== undefined && value < props.min) {
    errorMessage.value = `值不能小于 ${props.min}`;
    return false;
  }
  if (props.max !== undefined && value > props.max) {
    errorMessage.value = `值不能大于 ${props.max}`;
    return false;
  }
  return true;
};

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const currentInputValue = target.value;

  editingValue.value = currentInputValue;

  const numericValue = currentInputValue === "" ? 0 : Number(currentInputValue);

  hasError.value = false;
  errorMessage.value = "";

  if (currentInputValue !== "" && !validateValue(numericValue)) {
    hasError.value = true;
  }
};

watch(
  () => props.modelValue,
  (newValue) => {
    if (!validateValue(newValue)) {
      hasError.value = true;
    } else {
      hasError.value = false;
      errorMessage.value = "";
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.number-input {
}

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  -moz-appearance: textfield;
}

input:disabled,
button:disabled {
  cursor: not-allowed;
}
</style>
