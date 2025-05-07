<template>
  <div class="boolean-toggle">
    <button type="button" :disabled="disabled" @click="toggle" class="relative inline-flex h-4 w-8
      items-center rounded-full transition-colors duration-200
      focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400
      dark:focus:ring-blue-600 focus:ring-offset-2" :class="{
        'bg-blue-500 dark:bg-blue-600': modelValue,
        'bg-gray-200 dark:bg-gray-700': !modelValue,
        'opacity-50 cursor-not-allowed': disabled,
        'cursor-pointer': !disabled
      }" role="switch" :aria-checked="modelValue">
      <span class="inline-block h-3 w-3 transform rounded-full bg-white shadow
        transition-transform duration-200 ease-in-out" :class="{
          'translate-x-4': modelValue, /* Adjusted travel distance for w-8 button */
          'translate-x-0.5': !modelValue /* Adjusted for better left alignment */
        }" />
    </button>
    <div v-if="hasError" class="text-xs text-red-500 dark:text-red-400 mt-1">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  disabled?: boolean
  hasError?: boolean
  errorMessage?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  disabled: false,
  hasError: false,
  errorMessage: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const toggle = () => {
  if (!props.disabled) {
    emit('update:modelValue', !props.modelValue)
  }
}
</script>

<style scoped>
.boolean-toggle {
  @apply flex justify-end w-full;
}

/* 确保按钮在禁用状态下的鼠标样式正确 */
button:disabled {
  cursor: not-allowed;
}
</style>