<template>
  <div class="button-input">
    <button type="button" :disabled="disabled" @click.stop="handleClick"
      class="w-full px-3 py-1.5 text-sm font-medium rounded border transition-colors duration-200
            bg-primary hover:brightness-95 dark:hover:brightness-95
            text-primary-content
            border-transparent
            disabled:bg-background-base disabled:bg-opacity-[var(--ct-disabled-opacity)]
            disabled:text-muted disabled:text-opacity-[var(--ct-disabled-opacity)]
            disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-[var(--ct-focus-ring-opacity)] focus:ring-offset-1 focus:ring-offset-background-surface">
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