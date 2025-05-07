<template>
  <div class="button-input">
    <button type="button" :disabled="disabled" @click.stop="handleClick"
      class="w-full px-3 py-1.5 text-sm font-medium rounded border transition-colors duration-200
             bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700
             text-white
             border-transparent
             disabled:bg-gray-300 dark:disabled:bg-gray-600
             disabled:text-gray-500 dark:disabled:text-gray-400
             disabled:cursor-not-allowed
             focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 focus:ring-offset-1 dark:focus:ring-offset-gray-800">
      {{ label || 'Trigger' }} <!-- Provide a default label -->
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  label?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  disabled: false,
})

const emit = defineEmits<{
  click: [] // No arguments needed for a simple click event
}>()

const handleClick = () => {
  if (!props.disabled) {
    emit('click')
  }
}
</script>

<style scoped>
.button-input {
  width: 100%;
  display: flex;
  /* Use flex to potentially align if needed later */
  justify-content: center;
  /* Center the button if container is wider */
}

button {
  /* Add any specific button styles if needed */
}
</style>