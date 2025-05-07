<template>
  <div ref="rootRef" class="number-input relative w-full"> <!-- Added ref -->
    <!-- Standard number input with steppers/drag -->
    <template v-if="isEditing">
      <input ref="inputRef" type="number" :value="editingValue" :min="min" :max="max" :step="step"
        :placeholder="placeholder" :disabled="disabled" @input="handleInput" @blur="endEdit" @keydown.enter="endEdit"
        @keydown.esc="cancelEdit" class="w-full px-2 py-1 text-xs rounded border transition-colors duration-200 h-6
                bg-white dark:bg-gray-700
                border-gray-300 dark:border-gray-600
                text-gray-900 dark:text-gray-100
                placeholder-gray-500 dark:placeholder-gray-400
                disabled:bg-gray-100 dark:disabled:bg-gray-800
                disabled:text-gray-500 dark:disabled:text-gray-400
                focus:ring-1 focus:ring-blue-300 dark:focus:ring-blue-700 focus:border-transparent
                hover:border-gray-400 dark:hover:border-gray-500
                text-left" :class="{
                  'border-red-500 dark:border-red-700': hasError
                }" autocomplete="off" />
    </template>
    <template v-else>
      <Tooltip :content="tooltipContent" placement="top" :show-delay="500" trigger-class="w-full">
        <div
          class="flex items-stretch rounded overflow-hidden border border-gray-300 dark:border-gray-600 group focus-within:ring-1 focus-within:ring-blue-300 dark:focus-within:ring-blue-700 focus-within:border-transparent h-6">
          <!-- 减少按钮 -->
          <button class="flex items-center justify-center w-4 px-0.5 text-gray-500 dark:text-gray-400
                    bg-gray-50 dark:bg-gray-700
                    hover:bg-gray-100 dark:hover:bg-gray-600
                    active:bg-gray-200 dark:active:bg-gray-500
                    transition-colors duration-200 focus:outline-none border-r border-gray-300 dark:border-gray-600"
            @click.stop="stepValue(-1)" :disabled="disabled">
            <svg class="w-2.5 h-2.5 transform rotate-90" viewBox="0 0 24 24" fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
          </button>

          <!-- 数值显示 (Click triggers dropdown if suggestions exist) -->
          <div ref="valueDisplayRef" class="flex flex-1 items-center px-2 py-1 text-xs cursor-ew-resize select-none
                    text-gray-900 dark:text-gray-100 text-right
                    transition-colors duration-200
                    bg-white dark:bg-gray-700" :class="{
                      'opacity-50 cursor-not-allowed': disabled,
                      'border-red-500 dark:border-red-700': hasError,
                      'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600': hasSuggestions && !disabled && !isDragging
                    }" @mousedown.stop="handleMouseDown">
            {{ formatDisplayValue(displayValue) }} <!-- Roo: Use computed displayValue -->
          </div>

          <!-- 增加按钮 -->
          <button class="flex items-center justify-center w-4 px-0.5 text-gray-500 dark:text-gray-400
                    bg-gray-50 dark:bg-gray-700
                    hover:bg-gray-100 dark:hover:bg-gray-600
                    active:bg-gray-200 dark:active:bg-gray-500
                    transition-colors duration-200 focus:outline-none border-l border-gray-300 dark:border-gray-600"
            @click.stop="stepValue(1)" :disabled="disabled">
            <svg class="w-2.5 h-2.5 transform -rotate-90" viewBox="0 0 24 24" fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
          </button>
        </div>
      </Tooltip>
    </template>

    <!-- Suggestion Dropdown Component (Rendered outside the main input structure) -->
    <SuggestionDropdown v-if="hasSuggestions" :suggestions="suggestions" :show="isDropdownVisible"
      :position="dropdownPosition" :target-element="rootRef" :trigger-width="dropdownWidth"
      :canvas-scale="currentCanvasScale" @select="handleSuggestionSelect" @close="closeDropdown" />

    <!-- Error Message -->
    <div v-if="hasError" class="absolute top-full left-0 w-full text-xs text-red-500 dark:text-red-400 mt-1">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick, computed } from 'vue' // Added computed
import { useVueFlow } from '@vue-flow/core' // Import useVueFlow
import SuggestionDropdown from '../../common/SuggestionDropdown.vue' // Import SuggestionDropdown
import Tooltip from '../../common/Tooltip.vue'; // 导入 Tooltip 组件

interface Props {
  modelValue: number
  type?: 'INT' | 'FLOAT'
  min?: number
  max?: number
  step?: number
  placeholder?: string
  disabled?: boolean
  suggestions?: number[] // Suggestions prop remains
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: 0,
  type: 'FLOAT',
  min: undefined,
  max: undefined,
  step: undefined,
  placeholder: '',
  disabled: false,
  suggestions: () => []
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const isEditing = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const rootRef = ref<HTMLDivElement | null>(null) // Ref for the root element
const valueDisplayRef = ref<HTMLDivElement | null>(null) // Ref for value display div
const startValue = ref(0)
const startX = ref(0)
const isDragging = ref(false)
const hasError = ref(false)
const errorMessage = ref('')
const draggedValue = ref<number | null>(null); // Roo: Store value during drag
const editingValue = ref<string>(''); // Roo: Store input value during edit mode

// Dropdown state
const isDropdownVisible = ref(false)
const dropdownPosition = ref({ x: 0, y: 0 })
const dropdownWidth = ref(0) // Store the width

// Get viewport from VueFlow to access zoom level
const { viewport } = useVueFlow()
const currentCanvasScale = computed(() => viewport.value.zoom ?? 1)

const hasSuggestions = computed(() => props.suggestions && props.suggestions.length > 0)

// Roo: Computed value for display, updates during drag
const displayValue = computed(() => {
  if (isDragging.value && draggedValue.value !== null) {
    return draggedValue.value;
  }
  return props.modelValue;
});


// Roo: 计算 Tooltip 内容 (Markdown 格式)
const tooltipContent = computed(() => {
  const parts: string[] = [];
  if (props.min !== undefined) parts.push(`- **Min:** ${props.min}`);
  if (props.max !== undefined) parts.push(`- **Max:** ${props.max}`);
  if (props.step !== undefined) parts.push(`- **Step:** ${props.step}`);
  // 可以考虑添加 type
  // if (props.type) parts.push(`- **Type:** ${props.type}`);
  return parts.length > 0 ? parts.join('\n') : undefined; // 使用换行符分隔列表项
});

// --- Dropdown Logic ---

// const openDropdown = async () => {
//   if (props.disabled || !hasSuggestions.value || isEditing.value || isDragging.value) return
//   await nextTick()
//   if (valueDisplayRef.value) {
//     const rect = valueDisplayRef.value.getBoundingClientRect()
//     dropdownPosition.value = {
//       x: rect.left,
//       y: rect.bottom + window.scrollY
//     }
//     isDropdownVisible.value = true
//   }
// }

const closeDropdown = () => {
  isDropdownVisible.value = false
}

const handleSuggestionSelect = (selectedValue: string | number) => {
  // Ensure the selected value is a number
  const numericValue = Number(selectedValue)
  if (!isNaN(numericValue) && validateValue(numericValue)) {
    if (numericValue !== props.modelValue) { // 仅当值改变时才触发更新
      emit('update:modelValue', numericValue)
    }
    hasError.value = false; // Clear error on valid selection
    errorMessage.value = '';
    // Exit edit mode after selecting a suggestion
    isEditing.value = false;
  } else {
    // Handle invalid selection if necessary (e.g., show error)
    hasError.value = true;
    errorMessage.value = '选择的值无效'; // Or a more specific error
    // Do not exit edit mode if selection was invalid? Or should we? Let's exit for now.
    isEditing.value = false;
  }
  closeDropdown() // Close dropdown regardless of validity
}



// --- Existing Logic (Modified where needed) ---

const formatDisplayValue = (value: number): string => {
  if (props.type === 'INT') {
    return Math.round(value).toString()
  }
  const numValue = Number(value);
  if (isNaN(numValue)) {
    return 'NaN';
  }
  // Adjust precision based on step if available, otherwise default to 2
  const stepStr = String(props.step ?? 0.01);
  const parts = stepStr.split('.');
  const decimalPlaces = parts.length > 1 && parts[1] ? parts[1].length : 0;
  return numValue.toFixed(Math.max(2, decimalPlaces)); // Show at least 2 decimal places
}

const startEdit = async () => { // Make async for nextTick
  if (props.disabled) return

  // Store position and width before entering edit mode if suggestions exist
  let calculatedPosition: { x: number; y: number } | null = null;
  let calculatedWidth = 0;
  if (hasSuggestions.value && rootRef.value) { // Use rootRef
    const rect = rootRef.value.getBoundingClientRect()
    calculatedPosition = {
      x: rect.left, // Align left edge
      y: rect.bottom + window.scrollY // Position below the component
    }
    // Pass the current visual width (offsetWidth) directly
    calculatedWidth = rootRef.value.offsetWidth;
  }

  // Roo: Initialize editingValue with the current modelValue when starting edit
  editingValue.value = String(props.modelValue);
  isEditing.value = true

  await nextTick() // Wait for input to render

  inputRef.value?.focus()
  inputRef.value?.select()

  // Now open dropdown if needed, using the stored position
  if (hasSuggestions.value && calculatedPosition && calculatedWidth > 0) {
    dropdownPosition.value = calculatedPosition;
    dropdownWidth.value = calculatedWidth; // Set the width (already calculated using offsetWidth)
    isDropdownVisible.value = true;
  } else {
    // Ensure dropdown is closed if suggestions disappeared or position couldn't be calculated
    closeDropdown();
  }
}

const endEdit = () => { // Roo: Removed unused event parameter
  // Check if still in edit mode before proceeding (might have been exited by suggestion select)
  if (!isEditing.value) {
    closeDropdown(); // Ensure dropdown is closed if somehow still open
    return;
  }

    // Roo: Get the final value from the editing state
    const finalInputValue = editingValue.value;
    let numericValue = finalInputValue === '' ? 0 : Number(finalInputValue); // Convert the final string input to number
    let correctedValue = numericValue; // Value after validation and clamping
  
    // Validate and correct the final numeric value
    if (!validateValue(numericValue)) {
      hasError.value = true; // Keep error state if invalid
      // Apply clamping based on min/max
      if (props.min !== undefined && numericValue < props.min) correctedValue = props.min;
      else if (props.max !== undefined && numericValue > props.max) correctedValue = props.max;
      else if (isNaN(numericValue)) correctedValue = props.min !== undefined ? props.min : 0; // Default to min or 0 if NaN
      else correctedValue = numericValue; // Keep the invalid value if within bounds but failing other validation? Or clamp? Let's clamp.
  
      // Ensure integer type if needed after clamping
      if (props.type === 'INT') {
        correctedValue = Math.round(correctedValue);
      }
      // Update the editing value display to the corrected one before exiting edit mode
      // editingValue.value = String(correctedValue); // This might cause flicker, maybe skip?
    } else {
      hasError.value = false;
      errorMessage.value = '';
      // Ensure integer type is integer after successful validation
      if (props.type === 'INT') {
        correctedValue = Math.round(numericValue);
      } else {
        correctedValue = numericValue;
      }
    }
  
    // Only emit if the corrected value is different from the original modelValue
    if (correctedValue !== props.modelValue) {
      emit('update:modelValue', correctedValue);
    }
  
    // Reset editing state and close dropdown regardless
    isEditing.value = false;
    editingValue.value = ''; // Clear editing value
    closeDropdown(); // Close dropdown when ending edit
  }
  
  const cancelEdit = () => {
    isEditing.value = false
    editingValue.value = ''; // Clear editing value on cancel
    hasError.value = false;
    errorMessage.value = '';
    closeDropdown() // Also close dropdown on cancel
  // Roo: Removed duplicated cancelEdit function definition that was here (lines 291-296 in previous state).
  // The correct definition is above (lines 281-286).
}

const stepValue = (direction: number) => {
  if (props.disabled) return
  closeDropdown() // Close dropdown when stepping

  const step = props.step ?? (props.type === 'INT' ? 1 : 0.1)
  let newValue = props.modelValue + (step * direction)

  if (props.min !== undefined) newValue = Math.max(props.min, newValue)
  if (props.max !== undefined) newValue = Math.min(props.max, newValue)
  if (props.type === 'INT') newValue = Math.round(newValue)

  if (validateValue(newValue)) {
    hasError.value = false;
    errorMessage.value = '';
    emit('update:modelValue', newValue)
  } else {
    hasError.value = true;
  }
}

const handleMouseDown = (event: MouseEvent) => {
  if (props.disabled || isEditing.value) return
  closeDropdown() // Close dropdown on mouse down (start of potential drag)

  const startTime = Date.now()
  const initialX = event.clientX

  const handleMouseMove = (moveEvent: MouseEvent) => {
    if (Math.abs(moveEvent.clientX - initialX) > 3) {
      startDrag(event) // Pass original event
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }

  const handleMouseUp = (upEvent: MouseEvent) => {
    // Note: handleMouseMove and handleMouseUp are defined inside handleMouseDown
    // So they have access to startTime and initialX from handleMouseDown's scope.
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp); // Use the correct handler reference

    // Check if it was a click (not a drag)
    // Access startTime and initialX from the closure of handleMouseDown
    const clickDuration = Date.now() - startTime; // startTime is from handleMouseDown scope
    const isClick = !isDragging.value && clickDuration < 200 && Math.abs(upEvent.clientX - initialX) <= 3; // initialX is from handleMouseDown scope

    if (isClick) {
      // Always start editing on click
      startEdit();
    }
    // No need to reset isDragging here, stopDrag should handle it.
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}


const startDrag = (event: MouseEvent) => {
  if (props.disabled || isEditing.value) return
  // No need to close dropdown here, already closed in mousedown

  event.preventDefault()
  isDragging.value = true
  startValue.value = props.modelValue // Keep track of the value *before* drag
  draggedValue.value = props.modelValue // Initialize draggedValue with the starting value
  startX.value = event.clientX
  document.body.style.cursor = 'ew-resize'
  window.addEventListener('mousemove', handleDrag)
  window.addEventListener('mouseup', stopDrag)
}

const handleDrag = (event: MouseEvent) => {
  if (!isDragging.value) return

  const delta = event.clientX - startX.value
  const isShiftPressed = event.shiftKey
  let sensitivity = props.type === 'INT' ? 1 : 0.01
  if (isShiftPressed) sensitivity = props.type === 'INT' ? 0.33 : 0.001

  let newValue = startValue.value + delta * sensitivity
  if (props.min !== undefined) newValue = Math.max(props.min, newValue)
  if (props.max !== undefined) newValue = Math.min(props.max, newValue)
  if (props.type === 'INT') newValue = Math.round(newValue)

  // Validate the calculated value during drag
  if (validateValue(newValue)) {
    // Store the valid intermediate value, but don't emit yet
    draggedValue.value = newValue;
    // Optionally clear error if value becomes valid during drag
    // hasError.value = false;
    // errorMessage.value = '';
  } else {
    // Optionally show error during drag if value becomes invalid
    // hasError.value = true;
  }
  // Roo: Removed emit during drag
}

const stopDrag = () => {
  if (!isDragging.value) return // Prevent multiple calls if already stopped

  const finalValue = draggedValue.value; // Get the final value calculated during drag

  // Reset state *before* emitting, in case emit causes re-render issues
  isDragging.value = false
  document.body.style.cursor = ''
  window.removeEventListener('mousemove', handleDrag)
  window.removeEventListener('mouseup', stopDrag)
  draggedValue.value = null; // Reset dragged value

  // Emit the final value only if it's valid and different from the start value
  if (finalValue !== null && finalValue !== startValue.value) {
    if (validateValue(finalValue)) {
      hasError.value = false;
      errorMessage.value = '';
      emit('update:modelValue', finalValue);
    } else {
      // If the final dragged value is invalid, show error but don't emit
      // The value will remain what it was before the drag started (startValue)
      hasError.value = true;
      // errorMessage is already set by validateValue
    }
  } else {
    // If value didn't change or drag didn't produce a valid value,
    // ensure error state reflects the original value (startValue)
    if (!validateValue(startValue.value)) {
       hasError.value = true;
    } else {
       hasError.value = false;
       errorMessage.value = '';
    }
  }
}

onUnmounted(() => {
  if (isDragging.value) {
    stopDrag() // Ensure listeners are removed if component unmounts during drag
  }
})

const validateValue = (value: number): boolean => {
  if (isNaN(value)) {
    errorMessage.value = '请输入有效的数字'
    return false
  }
  if (props.min !== undefined && value < props.min) {
    errorMessage.value = `值不能小于 ${props.min}`
    return false
  }
  if (props.max !== undefined && value > props.max) {
    errorMessage.value = `值不能大于 ${props.max}`
    return false
  }
  // Integer check is implicitly handled by rounding where needed
  return true
}

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const currentInputValue = target.value;

  // Roo: Update the temporary editing state directly
  editingValue.value = currentInputValue;

  // Perform validation based on the current input string
  const numericValue = currentInputValue === '' ? 0 : Number(currentInputValue); // Treat empty as 0 for validation purposes? Or allow empty? Let's allow empty for now.

  // Reset error state before validation
  hasError.value = false;
  errorMessage.value = '';

  // Validate the numeric interpretation of the input
  // Allow empty string or valid numbers
  if (currentInputValue !== '' && !validateValue(numericValue)) {
      hasError.value = true;
      // errorMessage is set by validateValue
  }
  // No emit here, only update editingValue and error state
}

watch(() => props.modelValue, (newValue) => {
  if (!validateValue(newValue)) {
    hasError.value = true
  } else {
    hasError.value = false
    errorMessage.value = ''
  }
}, { immediate: true })

</script>

<style scoped>
.number-input {
  /* width: 100%; */
  /* Already handled by w-full */
}

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  -moz-appearance: textfield;
}

input:disabled,
button:disabled {
  cursor: not-allowed;
}
</style>