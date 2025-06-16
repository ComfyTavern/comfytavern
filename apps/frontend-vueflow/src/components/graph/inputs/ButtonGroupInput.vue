<template>
  <div class="button-group-input" role="group">
    <button
      v-for="(option, index) in props.options"
      :key="String(option.value)"
      type="button"
      @click="onClick(option.value)"
      :disabled="props.disabled"
      :class="[
        'btn-segment', // Base class from scoped style
        sizeClasses,   // Tailwind classes for size (e.g., 'px-3 py-2 text-sm')
        // Conditional Tailwind classes for active/inactive/disabled states
        props.modelValue === option.value && !props.disabled
          ? 'bg-primary text-primary-content shadow-sm' // Active state
          : !props.disabled
            ? 'text-text-base hover:bg-primary-softest focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50' // Inactive state
            : 'text-text-muted opacity-70 cursor-not-allowed', // Disabled state
        // Add spacing between buttons if not the last one, alternative to gap on parent
        // For a true segmented control, they might touch or have minimal border.
        // Using gap on parent is cleaner if supported, or add margin here:
        { 'mr-1': index < props.options.length - 1 } // Example spacing, adjust if .button-group-input uses gap
      ]"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'; // Removed PropType

interface ButtonOption {
  label: string;
  value: string | number | boolean;
}

interface Props {
  modelValue: string | number | boolean | undefined;
  options: ButtonOption[];
  id?: string;
  size?: "small" | "large";
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  id: '',
  size: 'small', // Default to small for node usage
  disabled: false,
  options: () => [],
});

const emit = defineEmits(['update:modelValue']);

const onClick = (value: string | number | boolean) => {
  if (props.disabled) return;
  emit('update:modelValue', value);
};

const sizeClasses = computed(() => {
  // Returns Tailwind classes for padding and font size
  if (props.size === "large") {
    return "px-3 py-2 text-sm";
  }
  // Default 'small'
  return "px-2 py-1 text-xs";
});

</script>

<style scoped>
.button-group-input {
  display: inline-flex;
  justify-content: flex-end; /* 让内部按钮组右对齐 */
  border-radius: 0.375rem; /* rounded-md */
  padding: 2px; /* Adjust as needed, creates a slight inset for buttons */
  background-color: var(--ct-background-surface); /* Match DisplayModeSwitcher's container */
  /* gap: 2px; Let Tailwind manage spacing or if buttons are directly adjacent*/
}

/* Base styles for individual segments, Tailwind will handle most active/hover states */
.btn-segment {
  font-weight: 500; /* font-medium */
  border-radius: 0.375rem; /* rounded-md to match DisplayModeSwitcher buttons */
  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
  border: none; /* Buttons themselves don't have borders unless active/focused with ring */
  line-height: normal;
  white-space: nowrap;
  /* Base text color is handled by Tailwind 'text-text-base' in inactive state */
}
</style>