<template>
  <div class="data-list-view flex flex-col h-full">
    <slot name="header"></slot>
    <DataToolbar
      :search-term="filter.searchTerm"
      @update:search-term="setSearchTerm"
      :sort-config="sort"
      @update:sort-config="setSort"
      :display-mode="displayMode"
      @update:display-mode="newMode => displayMode = newMode"
      :sort-options="sortOptions"
      :selected-count="selectedItems.length"
      @select-all="toggleSelectAll"
      @clear-selection="clearSelection"
    >
      <template #actions>
        <slot name="toolbar-actions" :selected-items="selectedItems"></slot>
      </template>
    </DataToolbar>

    <div class="flex-1 overflow-auto relative px-2">
      <div v-if="isLoading"
        class="loading-overlay absolute inset-0 flex items-center justify-center bg-background-base/75 z-10">
        <slot name="loading">
          <div class="text-center">
            <ArrowPathIcon class="h-8 w-8 animate-spin text-primary mx-auto" />
            <p v-if="loadingMessage" class="mt-2 text-text-muted">{{ loadingMessage }}</p>
          </div>
        </slot>
      </div>

      <div v-else-if="error" class="empty-placeholder p-8 text-center text-error">
        <slot name="error" :error="error">
          <ExclamationCircleIcon class="h-12 w-12 mx-auto mb-2" />
          <p>{{ errorMessage || t('dataList.view.error') }}</p>
          <pre class="text-xs text-left mt-2 bg-background-surface p-2 rounded">{{ error.message }}</pre>
        </slot>
      </div>

      <div v-else-if="items.length === 0" class="empty-placeholder p-8 text-center text-text-muted">
        <slot name="empty">
          <InformationCircleIcon class="h-12 w-12 mx-auto mb-2" />
          <p>{{ emptyMessage || t('dataList.view.empty') }}</p>
        </slot>
      </div>

      <!-- 列表视图 -->
      <table v-else-if="displayMode === 'list'" class="min-w-full text-base border-separate border-spacing-0 fixed-layout-table">
        <thead class="bg-background-surface sticky top-0 z-[5]">
          <tr>
            <th v-if="selectable" scope="col"
              class="px-3 py-2.5 border-b border-border-base rounded-tl-lg" :style="{ width: '40px' }">
              <input type="checkbox" :checked="isAllSelected" :indeterminate="isIndeterminate" @change="toggleSelectAll"
                class="h-4 w-4 rounded border-border-base text-primary focus:ring-primary" />
            </th>
            <th v-for="(column, index) in finalColumns" :key="column.key.toString()" scope="col"
              @click="column.sortable && changeSort(column.key)"
              class="px-3 py-2.5 text-left font-semibold text-text-base relative border-b border-border-base"
              :class="{
                'cursor-pointer hover:bg-background-base': column.sortable,
                'rounded-tl-lg': !selectable && index === 0,
                'rounded-tr-lg': index === finalColumns.length - 1
              }"
              :style="{ width: column.width }"
              :data-column-key="column.key.toString()"
            >
              <div class="flex items-center">
                {{ column.label }}
                <span v-if="sort.field === column.key" class="ml-1">
                  <ArrowUpIcon v-if="sort.direction === 'asc'" class="h-3 w-3" />
                  <ArrowDownIcon v-else class="h-3 w-3" />
                </span>
              </div>
              <div
                v-if="index < finalColumns.length - 1"
                class="resizer absolute top-0 right-0 h-full w-1 cursor-col-resize bg-border-base opacity-0 hover:opacity-100 transition-opacity"
                @mousedown.stop="startResize($event, column.key.toString())"
              ></div>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border-base bg-background-base">
          <tr v-for="(item, index) in items" :key="getItemKey(item, index)"
            @click="handleItemClick($event, item, index)" @dblclick="$emit('item-dblclick', item)"
            class="transition-colors" :class="[
              isSelected(item) ? 'bg-primary/20' : 'hover:bg-primary/10',
              rowClass ? (typeof rowClass === 'function' ? rowClass(item) : rowClass) : ''
            ]">
            <td v-if="selectable" class="px-3 py-2.5" @click.stop :style="{ width: '40px' }">
              <input type="checkbox" :checked="isSelected(item)" @change="toggleItemSelection(item)"
                class="h-4 w-4 rounded border-border-base text-primary focus:ring-primary" />
            </td>
            <slot v-if="slots['list-item']" name="list-item" :item="item" :is-selected="isSelected(item)"></slot>
            <template v-else>
              <!-- Fallback list item rendering -->
              <td v-for="column in finalColumns" :key="column.key.toString()" class="px-3 py-2.5 whitespace-nowrap" :style="{ width: column.width }">
                {{ getProperty(item, column.key) }}
              </td>
            </template>
          </tr>
        </tbody>
      </table>

      <!-- 网格视图 -->
      <div v-else-if="displayMode === 'grid'" class="grid gap-4 pt-4" :class="gridClass">
        <div v-for="(item, index) in items" :key="getItemKey(item, index)" @click="handleItemClick($event, item, index)"
          @dblclick="$emit('item-dblclick', item)"
          class="relative rounded-lg border border-border-base hover:border-primary transition-colors cursor-pointer"
          :class="{ 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-background-base': isSelected(item) }">
          <input v-if="showGridCheckboxes" type="checkbox" :checked="isSelected(item)" @change="toggleItemSelection(item)"
            @click.stop
            class="absolute top-3 right-3 h-4 w-4 rounded border-border-base text-primary focus:ring-primary z-10" />
          <slot v-if="slots['grid-item']" name="grid-item" :item="item" :is-selected="isSelected(item)"></slot>
          <!-- Fallback grid item rendering -->
          <div v-else class="p-4 bg-background-surface rounded-lg h-full">
            <h4 class="font-bold text-sm text-text-muted mb-2">Fallback View</h4>
            <pre class="text-xs bg-background-base p-2 rounded overflow-auto max-h-48">{{ item }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends { [key: string]: any }">
import { ref, type PropType, watch, useSlots, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import DataToolbar from './DataToolbar.vue';
import type { ColumnDefinition, DisplayMode, SortConfig } from '@comfytavern/types';
import { useDataList, type UseDataListOptions } from '@/composables/useDataList';
import { useUiStore } from '@/stores/uiStore';
import {
  ArrowPathIcon,
  InformationCircleIcon,
  ExclamationCircleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/vue/24/outline';

const props = defineProps({
  // --- View Identifier ---
  viewId: {
    type: String,
    required: true,
  },

  // --- Data ---
  fetcher: {
    type: Function as PropType<UseDataListOptions<T>['fetcher']>,
    required: true,
  },
  itemKey: {
    type: [String, Function] as PropType<keyof T | ((item: T) => string | number)>,
    default: 'id',
  },

  // --- Display ---
  initialDisplayMode: {
    type: String as PropType<DisplayMode>,
    default: 'grid',
  },
  columns: {
    type: Array as PropType<ColumnDefinition<T>[]>,
    default: () => [],
  },
  gridClass: {
    type: String,
    default: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  },
  rowClass: [String, Function] as PropType<string | ((item: T) => string)>,

  // --- Selection ---
  selectable: {
    type: Boolean,
    default: false,
  },
  hideCheckboxesUntilSelect: {
    type: Boolean,
    default: false,
  },

  // --- Custom Messages ---
  loadingMessage: String,
  emptyMessage: String,
  errorMessage: String,

  // --- Sorting & Filtering ---
  initialSort: Object as PropType<SortConfig<T>>,
  sortOptions: {
    type: Array as PropType<{ label: string; field: keyof T | string }[]>,
    default: () => [],
  },
  serverSide: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits<{
  (e: 'selection-change', selectedItems: T[]): void;
  (e: 'item-dblclick', item: T): void;
}>();

const { t } = useI18n();
const slots = useSlots();
const uiStore = useUiStore();

const displayMode = ref<DisplayMode>(props.initialDisplayMode);

const {
  items,
  isLoading,
  error,
  sort,
  filter,
  selectedItems,
  fetchData,
  setSort,
  setSearchTerm,
  setSelection,
} = useDataList<T>({
  fetcher: props.fetcher,
  initialSort: props.initialSort,
  serverSide: props.serverSide,
});
// --- Column Resizing Logic ---
const columnWidths = ref<{ [key: string]: string }>({});
const resizingState = ref<{
  currentKey: string;
  nextKey: string;
  startX: number;
  currentWidth: number;
  nextWidth: number;
} | null>(null);

const finalColumns = computed(() => {
  return props.columns.map(col => ({
    ...col,
    width: columnWidths.value[col.key.toString()] || col.width || 'auto',
  }));
});

onMounted(() => {
  const storedWidths = uiStore.getListViewColumnWidths(props.viewId);
  const initialWidths: { [key: string]: string } = {};
  for (const col of props.columns) {
    const key = col.key.toString();
    const stored = storedWidths[key];
    if (stored) {
      initialWidths[key] = `${stored}px`;
    } else if (col.width) {
      initialWidths[key] = col.width;
    }
  }
  columnWidths.value = initialWidths;
});

const startResize = (event: MouseEvent, columnKey: string) => {
  const th = (event.target as HTMLElement).closest('th');
  if (!th) return;

  const currentIndex = finalColumns.value.findIndex(c => c.key.toString() === columnKey);
  if (currentIndex === -1 || currentIndex >= finalColumns.value.length - 1) {
    return; // Cannot resize the last column's right edge
  }

  const nextTh = th.nextElementSibling as HTMLElement;
  if (!nextTh) return;

  const nextColumnKey = nextTh.dataset.columnKey;
  if (!nextColumnKey) return;

  resizingState.value = {
    currentKey: columnKey,
    nextKey: nextColumnKey,
    startX: event.clientX,
    currentWidth: th.offsetWidth,
    nextWidth: nextTh.offsetWidth,
  };

  document.addEventListener('mousemove', doResize);
  document.addEventListener('mouseup', stopResize);
};

const doResize = (event: MouseEvent) => {
  if (!resizingState.value) return;
  event.preventDefault();

  const diffX = event.clientX - resizingState.value.startX;
  const minWidth = 50; // 最小列宽

  const newCurrentWidth = resizingState.value.currentWidth + diffX;
  const newNextWidth = resizingState.value.nextWidth - diffX;

  if (newCurrentWidth < minWidth || newNextWidth < minWidth) {
    return; // Don't resize if it makes any column too small
  }

  columnWidths.value[resizingState.value.currentKey] = `${newCurrentWidth}px`;
  columnWidths.value[resizingState.value.nextKey] = `${newNextWidth}px`;
};

const stopResize = () => {
  if (!resizingState.value) return;

  const { currentKey, nextKey } = resizingState.value;
  const currentWidthPx = columnWidths.value[currentKey];
  const nextWidthPx = columnWidths.value[nextKey];

  if (currentWidthPx) {
    const widthNum = parseInt(currentWidthPx, 10);
    if (!isNaN(widthNum)) {
      uiStore.setListViewColumnWidth(props.viewId, currentKey, widthNum);
    }
  }
  if (nextWidthPx) {
    const widthNum = parseInt(nextWidthPx, 10);
    if (!isNaN(widthNum)) {
      uiStore.setListViewColumnWidth(props.viewId, nextKey, widthNum);
    }
  }

  resizingState.value = null;
  document.removeEventListener('mousemove', doResize);
  document.removeEventListener('mouseup', stopResize);
};


const getItemKey = (item: T, index: number): string | number => {
  if (typeof props.itemKey === 'function') {
    return props.itemKey(item);
  }
  // 使用类型断言并转换为字符串，以确保返回类型正确
  const key = item[props.itemKey as keyof T];
  return key != null ? String(key) : index;
};

const isSelected = (item: T) => {
  return selectedItems.value.some(selected => getItemKey(selected, -1) === getItemKey(item, -1));
};

const lastSelectedIndex = ref<number | null>(null);

const isAllSelected = computed(() => {
  if (!items.value.length) return false;
  return selectedItems.value.length === items.value.length;
});

const isIndeterminate = computed(() => {
  return selectedItems.value.length > 0 && !isAllSelected.value;
});

const showGridCheckboxes = computed(() => {
  if (!props.selectable) {
    return false;
  }
  // If the prop is enabled, only show checkboxes if items are selected.
  if (props.hideCheckboxesUntilSelect) {
    return selectedItems.value.length > 0;
  }
  // Otherwise, show them if selectable is true.
  return true;
});

const clearSelection = () => {
  setSelection([]);
};

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    clearSelection();
  } else {
    setSelection([...items.value]);
  }
};

const toggleItemSelection = (item: T) => {
  const newSelection = [...selectedItems.value];
  const key = getItemKey(item, -1);
  const existingIndex = newSelection.findIndex(i => getItemKey(i, -1) === key);

  if (existingIndex > -1) {
    newSelection.splice(existingIndex, 1);
  } else {
    newSelection.push(item);
  }
  setSelection(newSelection);
};

const handleItemClick = (event: MouseEvent, item: T, index: number) => {
  // 如果未开启 selectable，普通单击选中单个
  if (!props.selectable) {
    setSelection([item]);
    lastSelectedIndex.value = index;
    return;
  }

  // --- Selectable 模式下的逻辑 ---
  // 如果是 Checkbox 触发的，我们已经在 @change 处理过了，这里可以忽略
  // 但为了行点击也能触发，我们保留这里的逻辑，并确保它正确
  if (event.ctrlKey || event.metaKey) {
    // Ctrl/Meta + Click: 切换单个选中
    toggleItemSelection(item);
  } else if (event.shiftKey && lastSelectedIndex.value !== null) {
    // Shift + Click: 范围选择
    const start = Math.min(lastSelectedIndex.value, index);
    const end = Math.max(lastSelectedIndex.value, index);
    const rangeSelection = items.value.slice(start, end + 1);
    setSelection(Array.from(new Set([...selectedItems.value, ...rangeSelection])));
  } else {
    // 普通单击: 仅选中当前项
    setSelection([item]);
  }
  lastSelectedIndex.value = index;
};

const changeSort = (field: keyof T | string) => {
  const currentField = sort.value.field;
  const currentDirection = sort.value.direction;
  let newDirection: 'asc' | 'desc' = 'asc';
  if (currentField === field) {
    newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
  }
  setSort({ field, direction: newDirection });
};

watch(selectedItems, (newSelection) => {
  emit('selection-change', newSelection);
});

/**
 * Safely gets a property from an object using a string key, supporting dot notation.
 * @param obj The object to retrieve the property from.
 * @param key The key of the property to retrieve.
 * @returns The property value, or undefined if not found.
 */
const getProperty = (obj: any, key: string | keyof T): any => {
  if (typeof key === 'string' && key.includes('.')) {
    return key.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
  }
  return obj[key as any];
};

// Expose a refresh method to the parent
defineExpose({
  refresh: fetchData,
  clearSelection,
  selectAll: () => setSelection([...items.value]),
  toggleSelectAll,
});

</script>

<style scoped>
.fixed-layout-table {
  table-layout: fixed;
}
</style>