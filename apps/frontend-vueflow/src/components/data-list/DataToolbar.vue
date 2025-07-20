<template>
  <div class="data-toolbar flex flex-wrap items-center justify-between gap-2 py-2">
    <!-- 左侧区域: 操作插槽 + 搜索框 -->
    <div class="flex items-center gap-2 flex-wrap">
      <transition name="fade">
        <div v-if="selectedCount > 0" class="flex items-center gap-4">
          <p class="text-sm font-medium text-text-base px-3 py-1.5 bg-primary/10 rounded-md">
            {{ t('dataList.toolbar.selected', { count: selectedCount }) }}
          </p>
          <div class="h-6 w-px bg-border-base"></div>
          <slot name="actions"></slot>
        </div>
      </transition>

      <!-- 搜索框 -->
      <transition name="fade">
        <div v-if="selectedCount === 0" class="flex-grow min-w-[200px] sm:flex-grow-0 sm:w-64">
          <div class="relative">
            <input type="text" :value="searchTerm" :placeholder="t('common.searchEllipsis')" @input="onSearchInput"
              class="w-full h-8 px-2 pr-10 text-sm rounded-md bg-background-base border border-border-base text-text-base placeholder-text-muted focus:ring-2 focus:ring-primary focus:outline-none" />
            <MagnifyingGlassIcon class="h-4 w-4 absolute top-1/2 right-3 transform -translate-y-1/2 text-text-muted" />
          </div>
        </div>
      </transition>
    </div>

    <!-- 右侧控制区域 -->
    <div class="flex items-center gap-2 flex-wrap">
      <!-- 排序方式选择 -->
      <div v-if="sortOptions.length > 0" class="relative" ref="sortMenuRef">
        <button @click="isSortMenuOpen = !isSortMenuOpen" v-comfy-tooltip="t('dataList.toolbar.sortBy')"
          class="flex items-center justify-center h-8 px-2 rounded-md hover:bg-background-modifier-hover transition-colors">
          <AdjustmentsHorizontalIcon class="h-5 w-5 text-text-secondary" />
          <span class="ml-1 hidden md:inline text-sm text-text-base">{{ currentSortLabel }}</span>
          <ChevronDownIcon class="h-4 w-4 ml-1 text-text-secondary" />
        </button>
        <transition enter-active-class="transition ease-out duration-100"
          enter-from-class="transform opacity-0 scale-95" enter-to-class="transform opacity-100 scale-100"
          leave-active-class="transition ease-in duration-75" leave-from-class="transform opacity-100 scale-100"
          leave-to-class="transform opacity-0 scale-95">
          <div v-if="isSortMenuOpen"
            class="absolute right-0 mt-2 w-56 origin-top-right bg-background-surface rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
            <div class="py-1">
              <a v-for="option in sortOptions" :key="option.field.toString()" @click="changeSort(option.field)"
                :class="[sortConfig.field === option.field ? 'bg-primary/10 text-primary' : 'text-text-base', 'block px-4 py-2 text-sm cursor-pointer hover:bg-background-modifier-hover']">
                {{ option.label }}
              </a>
              <div class="border-t border-border-base my-1"></div>
              <a @click="toggleSortDirection"
                class="text-text-base px-4 py-2 text-sm cursor-pointer hover:bg-background-modifier-hover flex items-center">
                <ArrowUpIcon class="h-4 w-4 mr-2" v-if="sortConfig.direction === 'asc'" />
                <ArrowDownIcon class="h-4 w-4 mr-2" v-else />
                {{ sortConfig.direction === 'asc' ? t('dataList.toolbar.ascending') : t('dataList.toolbar.descending')
                }}
              </a>
            </div>
          </div>
        </transition>
      </div>

      <!-- 视图模式切换 -->
      <button @click="$emit('update:displayMode', displayMode === 'list' ? 'grid' : 'list')"
        v-comfy-tooltip="t(displayMode === 'list' ? 'dataList.toolbar.switchToGrid' : 'dataList.toolbar.switchToList')"
        class="flex items-center justify-center h-8 w-8 rounded-md hover:bg-background-modifier-hover transition-colors">
        <Squares2X2Icon v-if="displayMode === 'list'" class="h-5 w-5 text-text-secondary" />
        <QueueListIcon v-else class="h-5 w-5 text-text-secondary" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { onClickOutside } from '@vueuse/core';
import type { SortConfig, DisplayMode } from '@comfytavern/types';
import {
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  Squares2X2Icon,
  QueueListIcon,
} from '@heroicons/vue/24/outline';

const props = withDefaults(defineProps<{
  searchTerm: string;
  sortConfig: SortConfig<T>;
  displayMode: DisplayMode;
  sortOptions: { label: string; field: keyof T | string }[];
  selectedCount?: number;
}>(), {
  selectedCount: 0,
});

const emit = defineEmits<{
  (e: 'update:searchTerm', value: string): void;
  (e: 'update:sortConfig', value: SortConfig<T>): void;
  (e: 'update:displayMode', value: DisplayMode): void;
}>();

const { t } = useI18n();

const isSortMenuOpen = ref(false);
const sortMenuRef = ref(null);

onClickOutside(sortMenuRef, () => (isSortMenuOpen.value = false));

const onSearchInput = (event: Event) => {
  emit('update:searchTerm', (event.target as HTMLInputElement).value);
};

const changeSort = (field: keyof T | string) => {
  emit('update:sortConfig', { ...props.sortConfig, field });
  isSortMenuOpen.value = false;
};

const toggleSortDirection = () => {
  const newDirection = props.sortConfig.direction === 'asc' ? 'desc' : 'asc';
  emit('update:sortConfig', { ...props.sortConfig, direction: newDirection });
  isSortMenuOpen.value = false;
};

const currentSortLabel = computed(() => {
  const option = props.sortOptions.find(opt => opt.field === props.sortConfig.field);
  return option ? option.label : t('dataList.toolbar.sortBy');
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>