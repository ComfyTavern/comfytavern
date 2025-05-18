<template>
  <div ref="codeInputRef" class="code-input" :class="{ 'has-error': props.hasError }">
    <template v-if="!props.preferFloatingEditor">
      <Codemirror
        v-model="code"
        :placeholder="props.placeholder"
        :style="{ height: 'auto', minHeight: '100px', maxHeight: '400px' }"
        :autofocus="false"
        :indent-with-tab="true"
        :tab-size="2"
        :extensions="extensions"
        :disabled="props.disabled"
        @update:modelValue="handleInput"
        @blur="handleBlur"
        class="w-full text-sm rounded border transition-colors duration-200
               bg-white dark:bg-gray-700
               border-gray-300 dark:border-gray-600
               text-gray-900 dark:text-gray-100
               focus-within:ring-2 focus-within:ring-blue-300 dark:focus-within:ring-blue-700 focus-within:border-transparent
               hover:border-gray-400 dark:hover:border-gray-500"
        :class="{
          'border-red-500 dark:border-red-700': props.hasError,
          'cursor-not-allowed opacity-70': props.disabled || props.readonly, // Updated class for readonly
          'opacity-70': props.readonly && !props.disabled // Slightly different style for readonly if not fully disabled
        }"
      />
    </template>
    <template v-else>
      <button
        type="button"
        @click="triggerFloatingEditor"
        :disabled="props.disabled"
        class="w-full p-2 text-left border rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700"
      >
        <span class="block font-medium text-gray-700 dark:text-gray-200">编辑 {{ props.languageHint !== 'text' ? props.languageHint : '代码' }}</span>
        <span class="block text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{{ code || props.placeholder }}</span>
      </button>
    </template>
    <div v-if="props.hasError && !props.preferFloatingEditor" class="text-xs text-red-500 dark:text-red-400 mt-1">
      {{ props.errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { python } from '@codemirror/lang-python'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, ViewUpdate } from '@codemirror/view'
import { useThemeStore } from '@/stores/theme'

interface Props {
  modelValue: string
  placeholder?: string
  disabled?: boolean
  hasError?: boolean
  errorMessage?: string
  languageHint?: string // Replaces 'language', e.g., 'javascript', 'python', 'json', 'html', 'css', 'markdown', 'text'
  readonly?: boolean
  preferFloatingEditor?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Enter code here...',
  disabled: false,
  hasError: false,
  errorMessage: '',
  languageHint: 'text',
  readonly: false,
  preferFloatingEditor: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'blur': [value: string]
  'request-floating-editor': [payload: { value: string; languageHint?: string }]
}>()

const themeStore = useThemeStore()
const code = ref(props.modelValue)
const codeInputRef = ref<HTMLDivElement | null>(null);
const initialValueOnFocus = ref<string | null>(null); // Store initial value on focus


// Watch for external changes to modelValue
watch(() => props.modelValue, (newValue) => {
  if (newValue !== code.value) {
    code.value = newValue
  }
})

const handleInput = (value: string) => {
  code.value = value
  emit('update:modelValue', value)
}

// Roo: Handle blur event directly from Codemirror component
const handleBlur = () => {
  // Compare current value with the value recorded on focus
  if (initialValueOnFocus.value !== null && code.value !== initialValueOnFocus.value) {
    // console.log(`CodeInput handleBlur: Value changed from "${initialValueOnFocus.value?.substring(0,20)}..." to "${code.value.substring(0, 20)}...". Emitting blur.`);
    emit('blur', code.value); // Emit blur only if value changed
  } else {
    // console.log(`CodeInput handleBlur: Value ("${code.value.substring(0, 20)}...") has not changed since focus ("${initialValueOnFocus.value?.substring(0,20)}..."). Not emitting blur.`);
  }
  // Reset initial value tracking after blur check
  initialValueOnFocus.value = null;
};

const triggerFloatingEditor = () => {
  // Emitting an event that a parent component (likely via getInputProps in BaseNode)
  // will handle to open a modal or a dedicated floating editor view.
  emit('request-floating-editor', { value: code.value, languageHint: props.languageHint });
  // console.log('Request floating editor for:', code.value, 'Language:', props.languageHint);
};

const languageExtension = computed(() => {
  switch (props.languageHint?.toLowerCase()) {
    case 'javascript':
      return javascript()
    case 'json':
      return json()
    case 'python':
      return python()
    case 'html':
      return html()
    case 'css':
      return css()
    case 'markdown':
      return markdown({ base: markdownLanguage, codeLanguages: languages })
    default:
      return [] // Plain text
  }
})

const themeExtension = computed(() =>
  themeStore.isDark ? oneDark : EditorView.theme({})
)

const extensions = computed(() => {
  const baseExtensions = [
    EditorView.lineWrapping,
    themeExtension.value,
    EditorView.editable.of(!props.readonly), // props.disabled handled by :disabled on Codemirror
    EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.focusChanged) {
        if (update.view.hasFocus) {
          initialValueOnFocus.value = props.modelValue;
        }
      }
    })
  ];
  const langExt = languageExtension.value;
  return Array.isArray(langExt) ? [...baseExtensions, ...langExt] : [...baseExtensions, langExt];
})

const stopWheelPropagation = (event: WheelEvent) => {
  event.stopPropagation();
};

onMounted(() => {
  const el = codeInputRef.value;
  if (el) {
    // We need passive: false because we call stopPropagation.
    el.addEventListener('wheel', stopWheelPropagation, { passive: false });
  }
});

onUnmounted(() => {
  const el = codeInputRef.value;
  if (el) {
    el.removeEventListener('wheel', stopWheelPropagation);
  }
  // Roo: No specific cleanup needed for blur logic
});

</script>

<style scoped>
.code-input {
  width: 100%;
  position: relative;
  /* Needed for absolute positioning of potential error messages or icons */
}

/* Style adjustments for Codemirror */
:deep(.cm-editor) {
  border-radius: inherit;
  /* Inherit border-radius from parent */
  outline: none !important;
  /* Remove default outline */
  height: 100%;
  /* Ensure editor fills the container height */
  font-family: 'Fira Code', 'Consolas', monospace;
  /* Use a monospace font */
}

:deep(.cm-scroller) {
  overflow: auto;
  /* Ensure scrollbars appear when needed */
  border-radius: inherit;
  /* Inherit global scrollbar styles */
}

/* Adjust padding for better visual alignment */
:deep(.cm-content) {
  padding-top: 4px;
  padding-bottom: 4px;
}

/* Ensure disabled state looks correct */
.code-input :deep(.cm-editor.cm-disabled) {
  background-color: theme('colors.gray.100');
  color: theme('colors.gray.500');
}

.dark .code-input :deep(.cm-editor.cm-disabled) {
  background-color: theme('colors.gray.800');
  color: theme('colors.gray.400');
}

/* Error state border */
.code-input.has-error :deep(.cm-editor) {
  border-color: theme('colors.red.500') !important;
}

.dark .code-input.has-error :deep(.cm-editor) {
  border-color: theme('colors.red.700') !important;
}

/* Override focus ring to use focus-within on the parent */
:deep(.cm-editor.cm-focused) {
  outline: none !important;
  box-shadow: none !important;
  /* Remove Codemirror's default focus shadow */
}

/* Force left alignment for code lines */
:deep(.cm-line) {
  text-align: left !important;
}
</style>