<template>
  <div class="boolean-toggle">
    <button
      type="button"
      :disabled="props.disabled || props.readonly"
      @click="toggle"
      class="relative inline-flex h-4 w-8 items-center rounded-full transition-colors duration-200
             focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400
             dark:focus:ring-blue-600 focus:ring-offset-2"
      :class="{
        'bg-blue-500 dark:bg-blue-600': props.modelValue,
        'bg-gray-200 dark:bg-gray-700': !props.modelValue,
        'opacity-50 cursor-not-allowed': props.disabled || props.readonly,
        'cursor-pointer': !props.disabled && !props.readonly
      }"
      role="switch"
      :aria-checked="props.modelValue"
    >
      <span
        class="inline-block h-3 w-3 transform rounded-full bg-white shadow
               transition-transform duration-200 ease-in-out"
        :class="{
          'translate-x-4': props.modelValue,
          'translate-x-0.5': !props.modelValue
        }"
      />
    </button>
    <div v-if="props.hasError" class="text-xs text-red-500 dark:text-red-400 mt-1">
      {{ props.errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  disabled?: boolean
  hasError?: boolean
  errorMessage?: string
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  disabled: false,
  hasError: false,
  errorMessage: '',
  readonly: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const toggle = () => {
  if (!props.disabled && !props.readonly) {
    emit('update:modelValue', !props.modelValue)
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