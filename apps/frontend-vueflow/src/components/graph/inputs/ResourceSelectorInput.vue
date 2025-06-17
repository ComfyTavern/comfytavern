<script setup lang="ts">
import { ref, computed, watch } from 'vue' // Removed nextTick, Removed shallowRef
// import { useElementBounding } from '@vueuse/core' // Removed useElementBounding
// import Tooltip from '../../common/Tooltip.vue'; // Tooltip 组件不再直接使用
import SuggestionDropdown from '../../common/SuggestionDropdown.vue' // Import SuggestionDropdown
// import { useWorkflowGrouping } from '@/composables/useWorkflowGrouping'; // No longer needed here
import { listWorkflowsApi } from '@/api/workflow' // Corrected API function name
// Removed WorkflowListItem import, will use inline type
import { useVueFlow } from '@vue-flow/core' // Import useVueFlow for scale

interface ResourceType {
  value: string
  label: string
  icon?: string // 添加可选的图标名称或 SVG 字符串
}

const props = defineProps<{
  modelValue: any // 当前选中的资源标识符 (例如路径或 ID)
  acceptedTypes?: ResourceType[] // 节点定义的可接受类型 [{ value: 'workflow', label: '工作流' }, ...]
  editable?: boolean // 中间文本框是否可编辑
  disabled?: boolean // 整个组件是否禁用
  readonly?: boolean // 整个组件是否只读 (优先级高于 editable)
  placeholder?: string
  projectId: string | undefined // ** NEW: Current project ID is required **
  nodeId: string // ** NEW: Needed for unique ID generation or context **
}>()

// Get canvas scale for dropdown positioning
const { viewport } = useVueFlow()
const canvasScale = computed(() => viewport.value.zoom)

const emit = defineEmits(['update:modelValue']) // 使用驼峰命名
// Removed: selectedType, showTypeDropdown, typeDropdownRef, searchFilter - Type is determined by props
const internalValue = ref(props.modelValue) // 内部维护的值

// --- State for Resource Suggestions ---
const showSuggestions = ref(false)
const suggestions = ref<(string | number)[]>([])
const suggestionPosition = ref({ x: 0, y: 0 })
// const suggestionTargetElement = shallowRef<HTMLElement | null>(null) // No longer needed, use rootRef
const suggestionTriggerWidth = ref(0)
const resourceList = ref<{ id: string; name: string }[]>([]) // Use inline type
const isLoadingResources = ref(false)
const resourceError = ref<string | null>(null)
const inputRef = ref<HTMLInputElement | HTMLSpanElement | null>(null) // Ref for the input/span element (still needed for focus maybe)
const rootRef = ref<HTMLDivElement | null>(null); // Ref for the root element
// Removed useElementBounding

// 图标映射 (Heroicons Outline, w-4 h-4)
const iconMap: Record<string, string> = {
  workflow: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" /></svg>`, // Code bracket slant for workflow/nodegroup
  nodegroup: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" /></svg>`, // Same icon for now
  image: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>`, // photo
  preset: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" /></svg>`, // adjustments-horizontal
  worldbook: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6-2.292m0 0V3.75m0 12.15V21" /></svg>`, // book-open
  character: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>`, // user
  string: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>`, // document-text
  any: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" /></svg>`, // question-mark-circle
  default: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>` // code-bracket - fallback
}

// 获取图标 SVG
const getTypeIcon = (typeValue: string | null): string => {
  if (!typeValue) return iconMap.default!; // 使用非空断言
  // 尝试直接匹配，然后匹配小写，最后回退到默认
  return iconMap[typeValue] || iconMap[typeValue.toLowerCase()] || iconMap.default!; // 使用非空断言
}

// 如果外部 modelValue 变化，更新内部值
watch(() => props.modelValue, (newValue) => {
  internalValue.value = newValue
})

// 如果内部值变化，通知外部
watch(internalValue, (newValue) => {
  emit('update:modelValue', newValue)
})

// 默认接受类型
const defaultAcceptedTypes: ResourceType[] = [
  { value: 'workflow', label: '工作流', icon: getTypeIcon('workflow') },
  // { value: 'any', label: '任何资源', icon: getTypeIcon('any') }, // Keep 'any' if needed, or make workflow default
]

// Determine the primary accepted type (usually the first one)
// Determine the primary accepted type (usually the first one)
// Ensure the getter always returns ResourceType | null for computed type safety
const primaryAcceptedType = computed<ResourceType | null>((): ResourceType | null => {
  const types = props.acceptedTypes && props.acceptedTypes.length > 0
    ? props.acceptedTypes
    : defaultAcceptedTypes;
  // Ensure it returns null if types[0] is undefined or types is empty
  return types.length > 0 ? (types[0] ?? null) : null;
})


// 获取当前选中类型的标签，用于 Tooltip
// Get the label for the primary type
const primaryTypeLabel = computed(() => {
  return primaryAcceptedType.value?.label || '未知类型';
})

// 获取当前选中类型的图标
// Get the icon for the primary type
const primaryTypeIcon = computed(() => {
  return getTypeIcon(primaryAcceptedType.value?.value || null);
})

// Removed: filteredTypes, selectType - Type is fixed by props
// Removed: toggleTypeDropdown, onClickOutside for type dropdown

// --- Resource Loading and Suggestion Logic ---

// Load resources based on the primary accepted type
const loadResources = async () => {
  const typeToLoad = primaryAcceptedType.value?.value;
  if (!props.projectId || !typeToLoad || isLoadingResources.value) {
    suggestions.value = [];
    resourceError.value = !props.projectId ? '缺少项目ID' : (!typeToLoad ? '未指定资源类型' : null);
    return;
  }

  // Currently only supports 'workflow' and 'nodegroup' types for API loading
  if (typeToLoad !== 'workflow' && typeToLoad !== 'nodegroup') {
      console.warn(`Resource type "${typeToLoad}" not yet supported for library selection via API.`);
      suggestions.value = [`类型 ${typeToLoad} 不支持库选择`];
      resourceError.value = `类型 ${typeToLoad} 暂不支持库选择`;
      return;
  }

  isLoadingResources.value = true;
  resourceError.value = null;
  resourceList.value = []; // Clear previous list

  try {
    console.log(`ResourceSelector (${props.nodeId}): Fetching workflows for project ${props.projectId}`);
    const workflows = await listWorkflowsApi(props.projectId);
    resourceList.value = workflows; // Store the full list objects
    // Format for suggestions dropdown (name and id)
    suggestions.value = workflows.map((w: { id: string; name: string }) => `${w.name} (${w.id})`);
    console.log(`ResourceSelector (${props.nodeId}): Loaded ${workflows.length} workflows.`);
    // Clear error if loading succeeds
    resourceError.value = null;
  } catch (err) {
    console.error(`ResourceSelector (${props.nodeId}): Failed to load workflows:`, err);
    resourceError.value = '加载工作流失败';
    suggestions.value = []; // Clear suggestions on error
  } finally {
    isLoadingResources.value = false;
  }
};

// Function to open the suggestion dropdown
const openSuggestions = async () => {
    if (isEffectivelyDisabled.value) return;
// Calculate position based on the root element, similar to StringInput
if (!rootRef.value) return;
const rect = rootRef.value.getBoundingClientRect();
suggestionPosition.value = {
    x: rect.left,
    y: rect.bottom + 2 // Position below the root element + small offset
};
suggestionTriggerWidth.value = rootRef.value.offsetWidth; // Match the width of the root element
    suggestionTriggerWidth.value = rootRef.value.offsetWidth; // Match the width of the root element

    // Load resources if needed (e.g., if list is empty or type changed)
    // For simplicity now, always reload when opening, could optimize later
    await loadResources(); // Load resources before showing

    // Only show if there are suggestions or an error message to display
    if (suggestions.value.length > 0 || resourceError.value) {
        showSuggestions.value = true;
    }
};

// Handle selection from SuggestionDropdown
const handleSuggestionSelect = (selectedValueString: string | number) => {
  // Ensure selectedValueString is treated as a string for matching
  const selectedString = String(selectedValueString);
  console.log(`ResourceSelector (${props.nodeId}): Suggestion selected: ${selectedString}`);
  // Extract the ID from the suggestion string "Name (id)"
  const match = selectedString.match(/\(([^)]+)\)$/);
  if (match && match[1]) {
    const selectedId = match[1];
    internalValue.value = selectedId; // Update the internal value (which emits update:modelValue)

    // updateNodeGroupWorkflowReference is no longer called here.
    // It will be triggered by a watcher in BaseNode watching the config value change.
    console.log(`ResourceSelector (${props.nodeId}): Emitting update:modelValue with ${selectedId}`);

  } else {
    // Fallback or handle cases where format might differ (e.g., simple string suggestions)
    console.warn(`ResourceSelector (${props.nodeId}): Could not extract ID from suggestion: ${selectedString}. Using raw value.`);
    internalValue.value = selectedString; // Use the original selected string if ID extraction fails
  }
  showSuggestions.value = false; // Close dropdown
};

const closeSuggestions = () => {
  showSuggestions.value = false;
};

// --- End Resource Loading ---

// This button now triggers the suggestion dropdown for the primary type
const handlePrimaryTypeSelect = () => {
  if (isEffectivelyDisabled.value) return;
  openSuggestions(); // openSuggestions already uses primaryAcceptedType
}

// Watch for focus on the input element to potentially open suggestions
// (Optional: could be annoying, maybe only button click is better)
/*
watch(inputRef, (el) => {
  if (el && props.editable && !props.readonly) {
    el.addEventListener('focus', openSuggestions);
  }
  // Remember to remove listener on unmount or when el changes
});
*/

const handleSystemFileSelect = () => {
  if (isEffectivelyDisabled.value) return;
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.onchange = (event) => {
    const target = event.target as HTMLInputElement
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      // 检查 file 是否存在
      if (file) {
        internalValue.value = file.name;
        console.log('Selected file:', file.name);
      }
    }
  }
  fileInput.click()
}

const isEffectivelyDisabled = computed(() => props.disabled || props.readonly)
// 决定中间部分是否为可编辑的 input
const isEditableInput = computed(() => props.editable && !props.readonly && !props.disabled)

// 清除资源选择
const handleClearResource = () => {
  if (isEffectivelyDisabled.value) return;
  internalValue.value = null; // 或者 ''，取决于期望的空值
  console.log(`ResourceSelector (${props.nodeId}): Resource cleared.`);
}

</script>

<template>
  <div ref="rootRef" class="resource-selector-input flex items-center w-full nodrag"
    :class="{ 'opacity-50 cursor-not-allowed': isEffectivelyDisabled }">
    <!-- 1. 类型选择器 (Button as a simple button) -->
    <!-- 1. 类型图标按钮 (触发资源列表) -->
    <div class="relative flex-shrink-0">
      <!-- Click triggers openSuggestions for the primary type -->
      <button :disabled="isEffectivelyDisabled" @click="handlePrimaryTypeSelect"
        v-comfy-tooltip="{ content: `选择 ${primaryTypeLabel}`, placement: 'top' }"
        class="type-selector-button flex items-center justify-between px-1 py-1 text-xs w-[40px] border border-border-base rounded bg-background-surface hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed">
        <!-- Display icon for the primary accepted type -->
        <span v-html="primaryTypeIcon" class="flex-shrink-0 w-4 h-4 text-gray-700 dark:text-gray-300"></span>
        <!-- Chevron Down Icon -->
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3 text-gray-500 dark:text-gray-400 flex-shrink-0">
          <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      <!-- Removed Type Selection Dropdown -->
    </div>

    <!-- 2. 内容显示/编辑框 (Input or Span) -->
    <!-- Use ref on the container div -->
    <div class="flex-grow min-w-0 relative" ref="inputRef">
      <input v-if="isEditableInput" type="text" :value="internalValue"
        @input="internalValue = ($event.target as HTMLInputElement).value"
        :placeholder="placeholder || '输入资源名称或选择'"
        class="value-input-editable w-full px-2 py-1 text-xs border border-border-base bg-background-surface focus:outline-none focus:ring-1 focus:ring-primary" />
      <!-- Removed duplicate input block -->
      <template v-else>
        <!-- Span for displaying value when not editable, no longer triggers suggestions -->
        <span
          class="value-display block w-full px-2 py-1 text-xs border border-border-base bg-background-base text-text-muted truncate"
          :class="{ 'cursor-pointer hover:bg-neutral-softest': !isEffectivelyDisabled, 'cursor-not-allowed': isEffectivelyDisabled }">
          {{ internalValue || placeholder || '选择资源' }}
        </span>
      </template>
      <!-- Suggestion Dropdown -->
      <SuggestionDropdown
        :suggestions="suggestions"
        :show="showSuggestions"
        :position="suggestionPosition"
        :target-element="rootRef"
        :trigger-width="suggestionTriggerWidth"
        :canvas-scale="canvasScale"
        @select="handleSuggestionSelect"
        @close="closeSuggestions"
      />
        <p v-if="resourceError" class="absolute -bottom-4 left-0 text-xs text-red-500">{{ resourceError }}</p>
        <p v-if="isLoadingResources" class="absolute -bottom-4 left-0 text-xs text-gray-500">加载中...</p>
    </div>

    <!-- 3. 操作按钮 (文件选择 & 清除) -->
    <div class="flex-shrink-0 flex items-center">
      <!-- 文件系统选择按钮 -->
      <button @click="handleSystemFileSelect" :disabled="isEffectivelyDisabled"
        v-comfy-tooltip="{ content: '从文件系统选择', placement: 'top' }"
        class="action-button p-1 rounded text-text-muted hover:bg-neutral-softest focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed">
        <!-- Heroicon: document-add -->
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </button>
      <!-- 清除按钮 (仅在有值且未禁用时显示) -->
       <button v-if="internalValue && !isEffectivelyDisabled" @click="handleClearResource"
         v-comfy-tooltip="{ content: '清除选择', placement: 'top' }"
         class="action-button p-1 rounded text-error hover:bg-error-softest focus:outline-none focus:ring-1 focus:ring-error disabled:opacity-50 disabled:cursor-not-allowed">
         <!-- Heroicon: x -->
         <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
         </svg>
       </button>
    </div>
  </div>
</template>

<style scoped>
.resource-selector-input {
  /* 整体容器高度与内联输入框保持一致 */
  height: 24px;
}

.type-selector-button {
  /* 尺寸已在 class 中定义 (w-[30px] h-[24px]) */
  /* line-height: 1; */ /* flex items-center 应该足够 */
}

.value-input-editable,
.value-display {
  height: 24px;
  line-height: calc(24px - 2px);
  /* (height - border*2) for span alignment */
  box-sizing: border-box;
  /* 确保 padding 和 border 包含在高度内 */
}

.value-input-editable {
  padding-top: 0;
  /* 调整 input 内边距 */
  padding-bottom: 0;
}

.value-display {
  padding-top: 1px;
  /* 微调 span 内边距以垂直居中 */
  padding-bottom: 1px;
}


.action-button {
  height: 22px;
  /* 按钮稍小一点 */
  width: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Fade transition for dropdown */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.1s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>