<template>
  <div class="boolean-toggle">
    <label class="relative inline-flex items-center" :class="sizeClasses.cursor">
      <input type="checkbox" :checked="modelValue" @change="toggle" class="sr-only peer"
        :disabled="props.disabled || props.readonly">
      <div
        class="rounded-full peer peer-focus:ring-4 peer-focus:ring-primary-soft bg-neutral-soft peer-checked:after:border-transparent after:content-[''] after:absolute after:bg-background-base after:border-border-base after:border after:rounded-full after:transition-all peer-checked:bg-primary peer-disabled:border peer-disabled:border-border-base"
        :class="sizeClasses.wrapper">
      </div>
    </label>
    <div v-if="props.hasError" class="text-xs text-error mt-1">
      {{ props.errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
interface Props {
  modelValue: boolean
  disabled?: boolean
  hasError?: boolean
  errorMessage?: string
  readonly?: boolean
  size?: 'small' | 'large'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  disabled: false,
  hasError: false,
  errorMessage: '',
  readonly: false,
  size: 'small',
})

const sizeClasses = computed(() => {
  const base = {
    cursor: !props.disabled && !props.readonly ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
  };
  if (props.size === 'large') {
    return {
      ...base,
      wrapper: "w-11 h-6 after:top-0.5 after:left-[2px] after:h-5 after:w-5 peer-checked:after:translate-x-full",
    };
  }
  // small
  return {
    ...base,
    wrapper: "w-8 h-4 after:top-[1px] after:left-[1px] after:h-3.5 after:w-3.5 peer-checked:after:translate-x-4",
  };
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const toggle = (event?: Event) => {
  if (props.disabled || props.readonly) return;

  if (event && event.target instanceof HTMLInputElement) {
    emit('update:modelValue', event.target.checked);
  } else {
    emit('update:modelValue', !props.modelValue);
  }
}
</script>

<style scoped>
.boolean-toggle {
  @apply flex justify-end w-full;
}

button:disabled {
  cursor: not-allowed;
}
</style>