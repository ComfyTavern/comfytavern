<template>
  <div class="text-display">
    <div class="w-full p-1 text-sm rounded border
              bg-background-surface
              border-gray-300 dark:border-gray-600
              text-text-base
              disabled:bg-neutral-softest
              disabled:text-text-muted
              min-h-[60px] max-h-[200px] overflow-y-auto whitespace-pre-wrap" 
         :class="{
           'border-red-500 dark:border-red-700': hasError
         }">
      {{ modelValue }}
    </div>
    <div v-if="hasError" class="text-xs text-error mt-1">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue: string
  hasError?: boolean
  errorMessage?: string
}

withDefaults(defineProps<Props>(), {
  modelValue: '',
  hasError: false,
  errorMessage: ''
})
</script>

<style scoped>
.text-display {
  width: 100%;
}

.text-display > div:first-child {
  /* 添加自定义滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
}

.text-display > div:first-child::-webkit-scrollbar {
  width: 6px;
}

.text-display > div:first-child::-webkit-scrollbar-track {
  background: transparent;
}

.text-display > div:first-child::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 3px;
}

/* 深色模式下的滚动条 */
:root.dark .text-display > div:first-child {
  scrollbar-color: rgba(75, 85, 99, 0.5) transparent;
}

:root.dark .text-display > div:first-child::-webkit-scrollbar-thumb {
  background-color: rgba(75, 85, 99, 0.5);
}
</style>