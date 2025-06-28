<template>
  <div ref="rootRef" class="string-input relative w-full flex items-center min-w-0">
    <input ref="inputRef" type="text" :value="props.modelValue" :placeholder="props.placeholder"
      v-comfy-tooltip="props.placeholder" :disabled="props.disabled" :readonly="props.readonly" @change="handleChange"
      class="flex-1 rounded border transition-colors duration-200 min-w-0 bg-background-base dark:bg-background-surface border-border-base text-text-base placeholder-text-muted focus:ring-1 focus:ring-inset focus:ring-primary/50 focus:border-transparent hover:border-primary"
      :class="[sizeClasses.input, // 修正：使用数组来合并 class
        {
          'border-error': props.hasError,
          'rounded-r-none': hasSuggestions,
          'opacity-75 bg-background-base dark:bg-background-surface/70 cursor-default focus:ring-0 focus:border-border-base':
            props.readonly && !props.disabled,
          'disabled:bg-background-base dark:disabled:bg-background-surface/50 disabled:text-text-muted disabled:cursor-not-allowed':
            props.disabled,
        }]
        " autocomplete="off" />
    <!-- Dropdown Trigger -->
    <button v-if="hasSuggestions" ref="triggerRef" type="button" @click.stop="toggleDropdown"
      :disabled="props.disabled || props.readonly"
      class="flex-shrink-0 border border-l-0 rounded-r border-border-base bg-background-base hover:bg-background-hover focus:outline-none focus:ring-1 focus:ring-inset focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      :class="sizeClasses.button" aria-haspopup="listbox" :aria-expanded="isDropdownVisible">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
        class="w-3 h-3 text-text-muted">
        <path fill-rule="evenodd"
          d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
          clip-rule="evenodd" />
      </svg>
    </button>

    <!-- Suggestion Dropdown Component -->
    <SuggestionDropdown :suggestions="suggestions" :show="isDropdownVisible" :position="dropdownPosition"
      :target-element="rootRef" :trigger-width="dropdownWidth" :canvas-scale="currentCanvasScale"
      @select="handleSuggestionSelect" @close="closeDropdown" />

    <!-- Error Message (Positioned below the input group) -->
    <div v-if="props.hasError" class="absolute top-full left-0 w-full text-xs text-error mt-1">
      {{ props.errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import { useVueFlow } from "@vue-flow/core";
import SuggestionDropdown from "../../common/SuggestionDropdown.vue";

interface Props {
  modelValue: string;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  suggestions?: string[];
  readonly?: boolean;
  preferFloatingEditor?: boolean; // Added for consistency, though not heavily used by StringInput itself
  size?: "small" | "large";
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  placeholder: "",
  disabled: false,
  hasError: false,
  errorMessage: "",
  suggestions: () => [],
  readonly: false,
  preferFloatingEditor: false,
  size: "small",
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const rootRef = ref<HTMLDivElement | null>(null); // Ref for the root element
const inputRef = ref<HTMLInputElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null); // Keep for button logic if needed, but not for positioning
const isDropdownVisible = ref(false);
const dropdownPosition = ref({ x: 0, y: 0 });
const dropdownWidth = ref(0); // Store the width

// Get viewport from VueFlow to access zoom level
const { viewport } = useVueFlow();
const currentCanvasScale = computed(() => viewport.value.zoom ?? 1);

const sizeClasses = computed(() => {
  if (props.size === "large") {
    return {
      input: "h-10 px-3 py-2 text-sm", // 大尺寸输入框
      button: "w-8 px-1 h-10", // 大尺寸按钮 (如果适用)
    };
  }
  // Default 'small'
  return {
    input: "h-6 px-2 py-1 text-xs", // 小尺寸输入框
    button: "w-4 px-0.5 h-6", // 小尺寸按钮
  };
});

const hasSuggestions = computed(() => props.suggestions && props.suggestions.length > 0);

const handleChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit("update:modelValue", target.value);
  // Optionally close dropdown on input, or keep it open for filtering
  // closeDropdown(); // Keep dropdown closed on change for now
  closeDropdown();
};

const toggleDropdown = async () => {
  if (props.disabled) return;
  if (isDropdownVisible.value) {
    closeDropdown();
  } else {
    await nextTick(); // Ensure refs are available
    if (rootRef.value) {
      // Use rootRef for positioning and width
      const rect = rootRef.value.getBoundingClientRect();
      dropdownPosition.value = {
        x: rect.left, // Align left edge
        y: rect.bottom + window.scrollY, // Position below the component
      };
      // Pass the current visual width (offsetWidth) directly
      dropdownWidth.value = rootRef.value.offsetWidth;
      isDropdownVisible.value = true; // <-- Add this line back to show the dropdown
    }
  }
};

const closeDropdown = () => {
  isDropdownVisible.value = false;
};

const handleSuggestionSelect = (selectedValue: { value: string | number }) => {
  // Ensure the selected value is a string for StringInput
  const newValue = String(selectedValue.value);
  if (newValue !== props.modelValue) {
    // 仅当值改变时才触发更新
    emit("update:modelValue", newValue);
  }
  closeDropdown();
  // Optionally focus the input after selection
  // inputRef.value?.focus();
};
</script>

<style scoped>
.string-input {
  /* Container styles */
}

input:disabled {
  cursor: not-allowed;
}

button:disabled {
  cursor: not-allowed;
}
</style>
