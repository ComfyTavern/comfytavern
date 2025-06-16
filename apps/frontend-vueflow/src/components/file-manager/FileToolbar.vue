<template>
  <div
    class="file-toolbar flex flex-wrap items-center justify-between gap-2 p-2 bg-background-surface border-b border-border-base shadow-sm">
    <!-- 左侧操作按钮 -->
    <div class="flex items-center gap-1 flex-wrap">
      <button @click="handleUploadClick" class="toolbar-action-btn" v-comfy-tooltip="'上传文件'"
        data-testid="fm-upload-btn">
        <ArrowUpTrayIcon class="h-5 w-5" />
        <span class="ml-1 hidden sm:inline">上传</span>
      </button>
      <input type="file" ref="fileInputRef" @change="handleFileSelected" multiple class="hidden" />

      <button @click="createNewFolder" class="toolbar-action-btn" v-comfy-tooltip="'新建文件夹'"
        data-testid="fm-create-folder-btn">
        <FolderPlusIcon class="h-5 w-5" />
        <span class="ml-1 hidden sm:inline">新建文件夹</span>
      </button>

      <button @click="refreshList" class="toolbar-action-btn" :disabled="isLoading" v-comfy-tooltip="'刷新'"
        data-testid="fm-refresh-btn">
        <ArrowPathIcon class="h-5 w-5" :class="{ 'animate-spin': isLoading }" />
        <span class="ml-1 hidden sm:inline">刷新</span>
      </button>

      <button v-if="canPaste" @click="pasteItems" class="toolbar-action-btn" v-comfy-tooltip="'粘贴'"
        data-testid="fm-paste-btn">
        <ClipboardDocumentIcon class="h-5 w-5" />
        <span class="ml-1 hidden sm:inline">粘贴</span>
      </button>
    </div>

    <!-- 中部搜索框 -->
    <div class="flex-grow min-w-[200px] sm:flex-grow-0 sm:w-64 md:w-80">
      <!-- 假设 StringInput 是一个已有的通用组件 -->
      <!-- <StringInput
        v-model="searchQuery"
        placeholder="搜索文件和文件夹..."
        :clearable="true"
        @update:modelValue="onSearchInput"
        input-class="input-sm"
      /> -->
      <div class="relative">
        <input type="text" v-model="searchQuery" placeholder="搜索..." @input="onSearchInputDebounced"
          @keydown.enter="triggerSearch"
          class="input input-sm input-bordered w-full pr-10 bg-background-base text-text-base border-border-base placeholder-text-muted" />
        <MagnifyingGlassIcon
          class="h-4 w-4 absolute top-1/2 right-3 transform -translate-y-1/2 text-text-muted" />
      </div>
    </div>

    <!-- 右侧视图控制和筛选 -->
    <div class="flex items-center gap-1 flex-wrap">
      <button @click="toggleViewMode" class="toolbar-action-btn"
        v-comfy-tooltip="viewSettings.mode === 'list' ? '切换到网格视图' : '切换到列表视图'" data-testid="fm-toggle-view-btn">
        <Squares2X2Icon v-if="viewSettings.mode === 'list'" class="h-5 w-5" />
        <QueueListIcon v-else class="h-5 w-5" />
      </button>

      <!-- 排序方式选择 -->
      <div class="dropdown dropdown-end">
        <label tabindex="0" class="toolbar-action-btn" v-comfy-tooltip="'排序方式'">
          <AdjustmentsHorizontalIcon class="h-5 w-5" />
          <!-- <span class="ml-1 hidden md:inline">{{ currentSortLabel }}</span> -->
          <ChevronDownIcon class="h-4 w-4 ml-1 hidden md:inline" />
        </label>
        <ul tabindex="0" class="dropdown-content menu p-2 shadow bg-background-surface rounded-box w-60 z-[1]">
          <li>
            <div class="flex items-center justify-between px-1 py-1 text-sm">
              <span class="text-text-muted">网格视图尺寸</span>
              <NumberInput v-model="gridItemSizeProxy" size="small" type="INTEGER" :min="16" :max="256" :step="1"
                class="w-24" />
            </div>
            <label class="label cursor-pointer px-1 py-1 justify-start gap-2 items-center">
              <span class="label-text text-sm text-text-base">反向排序</span>
              <BooleanToggle :model-value="viewSettings.sortDirection === 'desc'"
                @update:model-value="handleSortDirectionToggle" size="small" />
            </label>
          </li>
          <li class="menu-title px-1 py-1">
            <span class="text-xs text-text-muted">排序依据</span>
          </li>
          <li v-for="option in sortOptions" :key="option.field">
            <a @click="changeSort(option.field)" :class="{
              'bg-primary/20 text-primary':
                viewSettings.sortField === option.field,
              'text-text-base': viewSettings.sortField !== option.field,
            }" class="text-sm py-1.5 px-2">
              {{ option.label }}
              <span v-if="viewSettings.sortField === option.field" class="ml-auto">
                <!-- 图标现在由反向排序复选框控制，这里可以显示一个选中标记，或不显示 -->
                <CheckIcon v-if="viewSettings.sortField === option.field"
                  class="h-4 w-4 text-primary" />
              </span>
            </a>
          </li>
        </ul>
      </div>

      <button @click="openFilterModal" class="toolbar-action-btn relative" v-comfy-tooltip="'高级筛选'"
        data-testid="fm-filter-btn">
        <FunnelIcon class="h-5 w-5" />
        <span v-if="activeFiltersCount > 0"
          class="absolute -top-1 -right-1 bg-error text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
          {{ activeFiltersCount }}
        </span>
      </button>

      <!-- 切换详情面板按钮 -->
      <button @click="uiStore.toggleFileManagerDetailPanel()" class="toolbar-action-btn"
        :class="{ 'btn-active bg-background-base': isDetailPanelOpen }"
        v-comfy-tooltip="isDetailPanelOpen ? '隐藏详情面板' : '显示详情面板'" data-testid="fm-toggle-detail-panel-btn">
        <ChevronDoubleRightIcon v-if="isDetailPanelOpen" class="h-5 w-5" />
        <!-- Icon to "push panel away" / collapse -->
        <ChevronDoubleLeftIcon v-else class="h-5 w-5" />
        <!-- Icon to "pull panel in" / expand -->
      </button>

      <button @click="openViewSettingsModal" class="toolbar-action-btn" v-comfy-tooltip="'显示设置'"
        data-testid="fm-view-settings-btn">
        <Cog6ToothIcon class="h-5 w-5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import NumberInput from "@/components/graph/inputs/NumberInput.vue";
import BooleanToggle from "@/components/graph/inputs/BooleanToggle.vue";
import { useFileManagerStore, type ViewSettings } from "@/stores/fileManagerStore";
import { useUiStore } from "@/stores/uiStore"; // + 导入 uiStore
import { useDialogService } from "@/services/DialogService"; // 如果需要打开自定义模态框
import {
  ArrowUpTrayIcon,
  FolderPlusIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  QueueListIcon,
  AdjustmentsHorizontalIcon,
  FunnelIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
  ClipboardDocumentIcon,
  CheckIcon, //移除了 ArrowUpIcon, ArrowDownIcon
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon, // + 导入切换详情面板的图标
} from "@heroicons/vue/24/outline";
// 假设 StringInput 和 SelectInput 是全局注册或可以这样导入的通用组件
// import StringInput from '@/components/common/inputs/StringInput.vue'; // 示例路径
// import SelectInput from '@/components/common/inputs/SelectInput.vue'; // 示例路径

const fileManagerStore = useFileManagerStore();
const uiStore = useUiStore(); // + 初始化 uiStore
const dialogService = useDialogService(); // 仅当需要用它打开 FilterModal 等时

const fileInputRef = ref<HTMLInputElement | null>(null);
const searchQuery = ref(fileManagerStore.filterOptions.namePattern); // 与 store 同步

const isLoading = computed(() => fileManagerStore.isLoading);
const viewSettings = computed(() => fileManagerStore.viewSettings);
const activeFiltersCount = computed(() => fileManagerStore.activeFiltersCount);
const canPaste = computed(
  () => !!fileManagerStore.clipboard && fileManagerStore.clipboard.sourcePaths.length > 0
);
const isDetailPanelOpen = computed(() => uiStore.isFileManagerDetailPanelOpen); // + 获取详情面板状态

const sortOptions: { label: string; field: ViewSettings["sortField"] }[] = [
  { label: "名称", field: "name" },
  { label: "扩展名", field: "extension" },
  { label: "修改日期", field: "lastModified" },
  { label: "大小", field: "size" }, // 图片中的 "尺寸" 对应这里的 "大小" (文件size)
];

let gridItemSizeDebounceTimer: number | undefined;
const gridItemSizeProxy = computed({
  get: () => viewSettings.value.gridItemSize || 96,
  set: (value) => {
    clearTimeout(gridItemSizeDebounceTimer);
    gridItemSizeDebounceTimer = window.setTimeout(() => {
      const numValue = Number(value);
      if (!isNaN(numValue) && numValue >= 16 && numValue <= 256) {
        // 假设合理范围 16-256
        fileManagerStore.updateViewSettings({ gridItemSize: numValue });
      }
    }, 500);
  },
});

// currentSortLabel 不再使用，因为按钮文本是固定的图标或通用文本
// const currentSortLabel = computed(() => {
//   const option = sortOptions.find(opt => opt.field === viewSettings.value.sortField);
//   return option ? option.label : '排序';
// });

const handleUploadClick = () => {
  fileInputRef.value?.click();
};

const handleFileSelected = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    fileManagerStore.uploadFiles(input.files);
  }
  // 重置 input 以便可以再次选择相同文件
  if (input) input.value = "";
};

const createNewFolder = () => {
  fileManagerStore.createDirectory(); // store action 内部会调用 DialogService.showInput
};

const refreshList = () => {
  fileManagerStore.fetchItems();
};

const pasteItems = () => {
  fileManagerStore.pasteFromClipboard();
};

let searchDebounceTimer: number | undefined;
const onSearchInputDebounced = () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = window.setTimeout(() => {
    fileManagerStore.searchFiles(searchQuery.value);
  }, 300); // 300ms 延迟
};
const triggerSearch = () => {
  clearTimeout(searchDebounceTimer);
  fileManagerStore.searchFiles(searchQuery.value);
};

// 监听 store 中的 namePattern 变化，以防外部修改
watch(
  () => fileManagerStore.filterOptions.namePattern,
  (newNamePattern) => {
    if (searchQuery.value !== newNamePattern) {
      searchQuery.value = newNamePattern;
    }
  }
);

const toggleViewMode = () => {
  const newMode = viewSettings.value.mode === "list" ? "grid" : "list";
  fileManagerStore.updateViewSettings({ mode: newMode });
};

const changeSort = (field: ViewSettings["sortField"]) => {
  const currentSortField = viewSettings.value.sortField;
  let newDirection = viewSettings.value.sortDirection;

  if (currentSortField !== field) {
    newDirection = "asc"; // 切换字段时，默认升序
  }
  // 方向由 toggleSortDirection 控制，这里只设置字段和可能的方向重置
  fileManagerStore.updateViewSettings({ sortField: field, sortDirection: newDirection });
};

const handleSortDirectionToggle = (isChecked: boolean) => {
  const newDirection = isChecked ? "desc" : "asc";
  fileManagerStore.updateViewSettings({ sortDirection: newDirection });
};

const openFilterModal = () => {
  // 这里将打开 FilterModal.vue
  // 假设 FilterModal 是通过 DialogService 或一个全局状态管理的
  // dialogService.showCustomModal('FilterModal', { /* props */ });
  console.log("TODO: Open FilterModal");
  // 临时的:
  if (fileManagerStore.isFilterActive) {
    fileManagerStore.clearFilters();
    dialogService.showToast({ message: "筛选已清除", type: "info" });
  } else {
    dialogService.showToast({ message: "打开高级筛选（占位）", type: "info" });
  }
};

const openViewSettingsModal = () => {
  // 这里将打开 ViewSettingsModal.vue
  // dialogService.showCustomModal('ViewSettingsModal', { /* props */ });
  console.log("TODO: Open ViewSettingsModal");
  dialogService.showToast({ message: "打开显示设置（占位）", type: "info" });
};
</script>

<style scoped>
/* DaisyUI 提供了 btn, input, dropdown 等组件的样式，这里不再重复定义。 */
/* 如果需要对 DaisyUI 的组件进行微调，可以在 shared.css 或 tailwind.config.js 中进行。 */

.toolbar-action-btn {
  @apply btn btn-sm btn-ghost hover:bg-primary/10;
}
</style>
