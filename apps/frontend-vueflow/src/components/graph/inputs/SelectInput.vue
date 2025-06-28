<template>
  <div ref="rootRef" class="select-input relative w-full">
    <!-- Display Area / Trigger -->
    <button
      type="button"
      :disabled="props.disabled || props.readonly"
      @click.stop="toggleDropdown"
      class="w-full rounded border transition-colors duration-200 flex items-center justify-between text-left
             bg-background-base dark:bg-background-surface
             border-border-base
             text-text-base
             focus:ring-1 focus:ring-inset focus:ring-primary/50 focus:border-transparent
             hover:border-primary"
      :class="[
        sizeClasses.button,
        {
          'border-error': props.hasError,
          'opacity-75 bg-background-base dark:bg-background-surface/70 cursor-default focus:ring-0 focus:border-border-base': props.readonly && !props.disabled,
          'disabled:bg-background-base dark:disabled:bg-background-surface/50 disabled:text-text-muted disabled:cursor-not-allowed': props.disabled
        }
      ]"
      aria-haspopup="listbox"
      :aria-expanded="isDropdownVisible"
    >
      <span :class="{ 'text-text-muted': !selectedOptionLabel }">
        {{ selectedOptionLabel || props.placeholder || '请选择' }}
      </span>
      <!-- Dropdown Arrow -->
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
        class="w-3 h-3 text-text-muted ml-1 flex-shrink-0">
        <path fill-rule="evenodd"
          d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
          clip-rule="evenodd" />
      </svg>
    </button>

    <!-- Suggestion Dropdown -->
    <SuggestionDropdown
      :suggestions="normalizedSuggestions"
      :show="isDropdownVisible"
      :position="dropdownPosition"
      :target-element="rootRef"
      :trigger-width="dropdownWidth"
      :canvas-scale="currentCanvasScale"
      :size="props.size"
      :searchable="props.searchable"
      @select="handleSuggestionSelect"
      @close="closeDropdown"
    />

    <!-- Error Message -->
    <div v-if="props.hasError" class="absolute top-full left-0 w-full text-xs text-error mt-1">
      {{ props.errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useVueFlow } from '@vue-flow/core' // Import useVueFlow
import SuggestionDropdown from '../../common/SuggestionDropdown.vue' // Import SuggestionDropdown

// 保留与 BaseSelect 相同的 Props 定义，以便接收来自父组件的数据
interface Option {
  value: string | number
  label: string
}
interface Props {
  modelValue: string | number
  suggestions: (string | number | Option)[]
  placeholder?: string
  disabled?: boolean
  hasError?: boolean
  errorMessage?: string
  readonly?: boolean
  size?: 'small' | 'large'
  applyCanvasScale?: boolean // 新增 prop，用于控制是否应用画布缩放
  searchable?: boolean // 控制是否启用搜索
}

// 定义 Props 默认值
const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  suggestions: () => [],
  placeholder: '',
  disabled: false,
  hasError: false,
  errorMessage: '',
  readonly: false,
  size: 'small',
  applyCanvasScale: true, // 默认应用画布缩放
  searchable: false, // 默认不启用搜索
})

const sizeClasses = computed(() => {
  if (props.size === 'large') {
    return {
      button: 'h-10 px-3 py-2 text-sm',
    };
  }
  // small
  return {
    button: 'h-6 px-2 py-1 text-xs',
  };
});

// Define emits
const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const rootRef = ref<HTMLDivElement | null>(null)
const isDropdownVisible = ref(false)
const dropdownPosition = ref({ x: 0, y: 0 })
const dropdownWidth = ref(0)

// Get viewport from VueFlow to access zoom level
const { viewport } = useVueFlow()
const currentCanvasScale = computed(() => {
  if (!props.applyCanvasScale) {
    return 1; // 如果 prop 指示不应用缩放，则强制为 1
  }
  return viewport.value.zoom ?? 1; // 否则，使用画布的 zoom 或默认为 1
})

// 统一处理建议选项
const normalizedSuggestions = computed<Option[]>(() =>
  props.suggestions.map(suggestion => {
    let item = suggestion;
    console.debug(item);
    // 步骤1: 如果是字符串，尝试解析为JSON。
    if (typeof item === 'string') {
      try {
        const parsed = JSON.parse(item);
        // 解析成功，则用解析后的对象进行后续处理。
        item = parsed;
      } catch (e) {
        // 不是JSON字符串，'item'保持为原始字符串。
      }
    }

    // 步骤2: 检查'item'现在是否为有效的Option对象。
    // 确保返回的value是string | number
    if (typeof item === 'object' && item !== null && 'value' in item && 'label' in item) {
      // 明确提取value和label，确保value的类型正确
      return { value: (item as Option).value, label: String((item as Option).label) };
    }
    
    // 步骤3 (默认): 如果到这里仍不是有效Option对象，则将原始suggestion视为简单值。
    // 确保返回的value是string | number
    return { value: String(suggestion), label: String(suggestion) };
  })
);

// 不再需要只提取标签，直接传递整个选项对象
// const suggestionLabels = computed(() => normalizedSuggestions.value.map(o => o.label))

// 当前选中值的标签
const selectedOptionLabel = computed(() =>
  normalizedSuggestions.value.find(o => o.value === props.modelValue)?.label ?? props.modelValue ?? null
)

const toggleDropdown = async () => {
  if (props.disabled) return

  // 如果已经显示，则关闭
  if (isDropdownVisible.value) {
    closeDropdown()
    return
  }

  // 否则打开下拉菜单
  await nextTick() // 确保 rootRef 可用
  if (!rootRef.value) return

  // 计算下拉菜单位置
  const rect = rootRef.value.getBoundingClientRect()
  dropdownPosition.value = {
    x: rect.left,
    y: rect.bottom + window.scrollY
  }

  // 设置下拉菜单宽度
  dropdownWidth.value = rootRef.value.offsetWidth
  isDropdownVisible.value = true
}

const closeDropdown = () => {
  isDropdownVisible.value = false
}

const handleSuggestionSelect = (selectedOption: Option) => {
  // 只有当值发生变化时才更新
  if (selectedOption && selectedOption.value !== props.modelValue) {
    emit('update:modelValue', selectedOption.value)
  }
  closeDropdown()
}
</script>

<style scoped>
button:disabled {
  cursor: not-allowed;
}
</style>