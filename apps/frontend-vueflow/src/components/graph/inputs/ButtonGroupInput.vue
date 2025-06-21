<template>
  <div class="button-group-input" role="group">
    <button
      v-for="option in props.options"
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
            : 'text-text-muted opacity-70 cursor-not-allowed' // Disabled state
        // 移除手动间距，使用 CSS gap 属性处理间距
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
  display: flex; /* 改为 flex 以获得更好的响应性 */
  justify-content: flex-end; /* 让内部按钮组右对齐 */
  border-radius: 0.375rem; /* rounded-md */
  padding: 2px; /* Adjust as needed, creates a slight inset for buttons */
  background-color: var(--ct-background-surface); /* Match DisplayModeSwitcher's container */
  gap: 2px; /* 添加按钮之间的间距 */
  width: 100%; /* 确保容器占满可用宽度 */
  /* 在小宽度时允许换行 */
  flex-wrap: wrap;
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
  /* 让按钮能够适应可用空间 */
  flex: 1;
  min-width: fit-content; /* 确保按钮文本不会被截断 */
  /* Base text color is handled by Tailwind 'text-text-base' in inactive state */
}

/* 当容器宽度不足时的响应式处理 */
@media (max-width: 480px) {
  .button-group-input {
    flex-direction: column; /* 在很小的屏幕上垂直排列 */
    align-items: stretch;
  }
  
  .btn-segment {
    flex: none; /* 在垂直布局时取消 flex 拉伸 */
    width: 100%;
  }
}
</style>