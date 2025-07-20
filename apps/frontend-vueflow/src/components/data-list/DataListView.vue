<template>
  <div class="data-list-view flex flex-col h-full">
    <slot name="header"></slot>
    <DataToolbar :search-term="filter.searchTerm" @update:search-term="setSearchTerm" :sort-config="sort"
      @update:sort-config="setSort" :display-mode="displayMode" @update:display-mode="newMode => displayMode = newMode"
      :sort-options="sortOptions">
      <template #actions>
        <slot name="toolbar-actions"></slot>
      </template>
    </DataToolbar>

    <div class="flex-1 overflow-auto relative">
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
      <table v-else-if="displayMode === 'list'" class="min-w-full divide-y divide-border-base text-sm">
        <thead class="bg-background-surface sticky top-0 z-[5]">
          <tr>
            <th v-for="column in columns" :key="column.key.toString()" scope="col"
              @click="column.sortable && changeSort(column.key)"
              class="px-3 py-2.5 text-left font-semibold text-text-base"
              :class="{ 'cursor-pointer hover:bg-background-base': column.sortable }" :style="{ width: column.width }">
              <div class="flex items-center">
                {{ column.label }}
                <span v-if="sort.field === column.key" class="ml-1">
                  <ArrowUpIcon v-if="sort.direction === 'asc'" class="h-3 w-3" />
                  <ArrowDownIcon v-else class="h-3 w-3" />
                </span>
              </div>
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
            <slot v-if="slots['list-item']" name="list-item" :item="item" :is-selected="isSelected(item)"></slot>
            <template v-else>
              <!-- Fallback list item rendering -->
              <td v-for="column in columns" :key="column.key.toString()" class="px-3 py-2.5 whitespace-nowrap">
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
          class="rounded-lg border border-border-base hover:border-primary transition-colors cursor-pointer"
          :class="{ 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-background-base': isSelected(item) }">
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

<script setup lang="ts" generic="T extends { id?: any, logicalPath?: any }">
import { ref, type PropType, watch, useSlots } from 'vue';
import { useI18n } from 'vue-i18n';
import DataToolbar from './DataToolbar.vue';
import type { ColumnDefinition, DisplayMode, SortConfig } from '@comfytavern/types';
import { useDataList, type UseDataListOptions } from '@/composables/useDataList';
import {
  ArrowPathIcon,
  InformationCircleIcon,
  ExclamationCircleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/vue/24/outline';

const props = defineProps({
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

const handleItemClick = (event: MouseEvent, item: T, index: number) => {
  if (event.ctrlKey || event.metaKey) {
    const newSelection = [...selectedItems.value];
    const existingIndex = newSelection.findIndex(i => getItemKey(i, -1) === getItemKey(item, -1));
    if (existingIndex > -1) {
      newSelection.splice(existingIndex, 1);
    } else {
      newSelection.push(item);
    }
    setSelection(newSelection);
  } else if (event.shiftKey && lastSelectedIndex.value !== null) {
    const start = Math.min(lastSelectedIndex.value, index);
    const end = Math.max(lastSelectedIndex.value, index);
    const rangeSelection = items.value.slice(start, end + 1);
    setSelection(Array.from(new Set([...selectedItems.value, ...rangeSelection])));
  } else {
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
  clearSelection: () => setSelection([]),
});

</script>

<style scoped>
/* Scoped styles here */
</style>