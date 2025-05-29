<template>
  <div class="hierarchical-menu">
    <!-- 搜索框 -->
    <div v-if="showSearch" class="menu-search">
      <input
        type="text"
        v-model="searchQuery"
        :placeholder="searchPlaceholder"
        class="menu-search-input"
        @input="onSearch"
        ref="searchInputRef"
        @keydown.enter="onSearchEnter"
      />
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="menu-loading">
      <span>{{ loadingText }}</span>
    </div>

    <!-- 搜索结果 -->
    <div v-else-if="searchQuery && filteredItems.length > 0" class="menu-search-results">
      <div
        v-for="item in filteredItems"
        :key="item.id"
        class="menu-item search-result"
        @click="onItemSelect(item)"
      >
        <span class="icon" v-if="item.icon">{{ item.icon }}</span>
        <span class="flex flex-col">
          <span>{{ item.label }}</span>
          <span v-if="item.category" class="text-xs text-gray-500">{{ item.category }}</span>
        </span>
      </div>
    </div>
    
    <!-- 无搜索结果 -->
    <div v-else-if="searchQuery && filteredItems.length === 0" class="menu-no-results">
      <span>{{ noResultsText }}</span>
    </div>

    <!-- 层级菜单 -->
    <div v-else class="menu-items">
      <template v-for="(section, sectionKey) in sections" :key="sectionKey">
        <!-- 区段标题 -->
        <div 
          class="menu-section-title"
          @click="toggleSection(sectionKey)"
        >
          <span>{{ section.label }}</span>
          <span class="text-lg">{{ collapsedSections[sectionKey] ? "▸" : "▾" }}</span>
        </div>

        <!-- 区段内容 -->
        <div v-show="!collapsedSections[sectionKey]" class="menu-section-content">
          <template v-for="(category, categoryKey) in section.categories" :key="categoryKey">
            <!-- 分类标题 -->
            <div 
              class="menu-category-title"
              @click="toggleCategory(`${sectionKey}:${categoryKey}`)"
            >
              <span>{{ category.label }}</span>
              <span class="text-lg">{{ collapsedCategories[`${sectionKey}:${categoryKey}`] ? "▸" : "▾" }}</span>
            </div>

            <!-- 分类内容 -->
            <div v-show="!collapsedCategories[`${sectionKey}:${categoryKey}`]" class="menu-category-content">
              <div
                v-for="item in category.items"
                :key="item.id"
                class="menu-item"
                @click="onItemSelect(item)"
              >
                <span class="icon" v-if="item.icon">{{ item.icon }}</span>
                <span class="flex flex-col">
                  <span>{{ item.label }}</span>
                  <span v-if="item.description" class="text-xs text-gray-500">{{ item.description }}</span>
                </span>
              </div>
            </div>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';

interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  category?: string;
  description?: string;
  data?: any;
}

interface Category {
  label: string;
  items: MenuItem[];
}

interface Section {
  label: string;
  categories: Record<string, Category>;
}

interface Props {
  sections: Record<string, Section>;
  loading?: boolean;
  showSearch?: boolean;
  searchPlaceholder?: string;
  loadingText?: string;
  noResultsText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  showSearch: true,
  searchPlaceholder: '搜索...',
  loadingText: '加载中...',
  noResultsText: '没有找到匹配项'
});

const emit = defineEmits<{
  (e: 'select', item: MenuItem): void;
  (e: 'search', query: string): void;
  (e: 'search-enter'): void;
}>();

const searchQuery = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);
const collapsedSections = ref<Record<string, boolean>>({});
const collapsedCategories = ref<Record<string, boolean>>({});

// 切换区段展开/折叠状态
const toggleSection = (sectionKey: string) => {
  collapsedSections.value[sectionKey] = !collapsedSections.value[sectionKey];
};

// 切换分类展开/折叠状态
const toggleCategory = (categoryKey: string) => {
  collapsedCategories.value[categoryKey] = !collapsedCategories.value[categoryKey];
};

// 过滤搜索结果
const filteredItems = computed(() => {
  if (!searchQuery.value) return [];
  const query = searchQuery.value.toLowerCase();
  const results: MenuItem[] = [];

  Object.values(props.sections).forEach(section => {
    Object.values(section.categories).forEach(category => {
      category.items.forEach(item => {
        if (
          item.label.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.category?.toLowerCase().includes(query)
        ) {
          results.push(item);
        }
      });
    });
  });

  return results;
});

// 搜索框自动聚焦
watch(() => props.showSearch, (show) => {
  if (show) {
    nextTick(() => {
      searchInputRef.value?.focus();
    });
  } else {
    searchQuery.value = '';
  }
});

const onSearch = () => {
  emit('search', searchQuery.value);
};

const onSearchEnter = () => {
  emit('search-enter');
};

const onItemSelect = (item: MenuItem) => {
  emit('select', item);
};
</script>

<style scoped>
.hierarchical-menu {
  @apply flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-lg;
}

.menu-search {
  @apply sticky top-0 p-2 border-b border-gray-200 dark:border-gray-700 bg-inherit z-10;
}

.menu-search-input {
  @apply w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600
    bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200
    focus:border-blue-500 dark:focus:border-blue-400
    focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none
    placeholder-gray-400 dark:placeholder-gray-500 text-sm;
}

.menu-loading,
.menu-no-results {
  @apply p-4 text-center text-gray-500 dark:text-gray-400 text-sm;
}

.menu-items {
  @apply overflow-y-auto max-h-[calc(400px-3rem)];
}

.menu-section-title {
  @apply flex justify-between items-center px-3 py-1.5
    bg-gray-100 dark:bg-gray-700
    text-gray-800 dark:text-gray-200 font-medium text-sm
    cursor-pointer mb-0.5 hover:bg-gray-200 dark:hover:bg-gray-600
    transition-colors duration-150 ease-in-out;
}

.menu-category-title {
  @apply flex justify-between items-center px-3 py-1.5
    text-gray-600 dark:text-gray-400 font-medium text-sm
    cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700
    transition-colors duration-150 ease-in-out;
}

.menu-section-content {
  @apply mb-1;
}

.menu-category-content {
  @apply pl-3;
}

.menu-item {
  @apply flex items-center px-3 py-1.5
    text-sm text-gray-700 dark:text-gray-300
    hover:bg-gray-50 dark:hover:bg-gray-700
    cursor-pointer transition-colors duration-150 ease-in-out;
}

.menu-item .icon {
  @apply mr-2 text-gray-500 dark:text-gray-400 text-base;
}

.search-result {
  @apply border-b border-gray-100 dark:border-gray-700 last:border-0;
}

.menu-item:hover .icon {
  @apply text-blue-500 dark:text-blue-400;
}
</style>