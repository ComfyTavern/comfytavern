<script setup lang="ts">
import { computed } from 'vue'
import { useTabStore, type Tab } from '@/stores/tabStore'
import { XMarkIcon, PlusIcon } from '@heroicons/vue/24/solid'

const tabStore = useTabStore()

const tabs = computed(() => tabStore.tabs)
const activeTabId = computed(() => tabStore.activeTabId)

function selectTab(tabId: string) {
  tabStore.setActiveTab(tabId)
}

function closeTab(event: MouseEvent, tabId: string) {
  event.stopPropagation() // 防止触发 selectTab
  tabStore.removeTab(tabId)
}

function addNewTab() {
  // 暂时只支持添加工作流标签页
  tabStore.addTab('workflow', `未命名工作流_${tabs.value.length + 1}`, null, true)
}

function getTabClasses(tab: Tab): string[] {
  const classes = [
    'flex', 'items-center', 'px-3', 'py-1.5', 'text-sm', 'font-medium',
    'border-b-2', 'cursor-pointer', 'transition-colors', 'duration-150',
    'whitespace-nowrap', 'group', // 添加 group 用于控制关闭按钮的显示
  ]
  if (tab.internalId === activeTabId.value) {
    classes.push(
      'border-primary-500', 'text-primary-600', 'dark:text-primary-400',
      'bg-gray-100', 'dark:bg-gray-700'
    )
  } else {
    classes.push(
      'border-transparent', 'text-gray-500', 'dark:text-gray-400',
      'hover:text-gray-700', 'dark:hover:text-gray-200',
      'hover:bg-gray-50', 'dark:hover:bg-gray-800',
      'hover:border-gray-300', 'dark:hover:border-gray-600'
    )
  }
  return classes
}

function getCloseButtonClasses(tab: Tab): string[] {
    const classes = [
        'ml-2', 'p-0.5', 'rounded', 'text-gray-400', 'dark:text-gray-500',
        'hover:bg-gray-200', 'dark:hover:bg-gray-600',
        'hover:text-gray-600', 'dark:hover:text-gray-300',
        'opacity-0', 'group-hover:opacity-100', // 默认隐藏，悬停时显示
        'transition-opacity', 'duration-150'
    ];
    // 活动标签页的关闭按钮始终可见
    if (tab.internalId === activeTabId.value) {
        classes.push('opacity-100');
    }
    return classes;
}
</script>

<template>
  <div class="tab-bar-container flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto overflow-y-hidden">
    <nav class="-mb-px flex space-x-1" aria-label="Tabs">
      <a
        v-for="tab in tabs"
        :key="tab.internalId"
        href="#"
        :class="getTabClasses(tab)"
        @click.prevent="selectTab(tab.internalId)"
      >
        <span>{{ tab.label }}</span>
        <span v-if="tab.isDirty" class="ml-1 text-red-500">*</span>
        <button
          :class="getCloseButtonClasses(tab)"
          @click.prevent="closeTab($event, tab.internalId)"
          aria-label="Close tab"
        >
          <XMarkIcon class="h-4 w-4" />
        </button>
      </a>
    </nav>
    <button
      @click="addNewTab"
      class="ml-2 px-2 py-1.5 border-b-2 border-transparent text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
      aria-label="New tab"
    >
      <PlusIcon class="h-5 w-5" />
    </button>
  </div>
</template>

<style scoped>
/* 自定义细滚动条样式 */
.tab-bar-container::-webkit-scrollbar {
  height: 4px; /* 滚动条高度 */
}

.tab-bar-container::-webkit-scrollbar-track {
  background: transparent; /* 轨道背景透明 */
}

.tab-bar-container::-webkit-scrollbar-thumb {
  background-color: #ccc; /* 滚动条滑块颜色 (亮色模式) */
  border-radius: 2px; /* 滑块圆角 */
}
.dark .tab-bar-container::-webkit-scrollbar-thumb {
  background-color: #555; /* 滚动条滑块颜色 (暗色模式) */
}

.tab-bar-container::-webkit-scrollbar-thumb:hover {
  background-color: #aaa; /* 悬停时滑块颜色 (亮色模式) */
}
.dark .tab-bar-container::-webkit-scrollbar-thumb:hover {
  background-color: #777; /* 悬停时滑块颜色 (暗色模式) */
}
</style>