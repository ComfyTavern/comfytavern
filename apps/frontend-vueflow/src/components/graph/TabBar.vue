<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue' // 导入 ref, onMounted, onUnmounted
import { useTabStore, type Tab } from '@/stores/tabStore'
import { XMarkIcon, PlusIcon } from '@heroicons/vue/24/solid'
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-vue'
import type { OverlayScrollbars } from 'overlayscrollbars' // 导入核心类型
import 'overlayscrollbars/overlayscrollbars.css'

const scrollbarRef = ref<InstanceType<typeof OverlayScrollbarsComponent> | null>(null) // 创建模板引用
const tabStore = useTabStore()
const themeStore = useThemeStore()
const { isDark } = storeToRefs(themeStore)

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

let osInstance: OverlayScrollbars | null = null;
const handleWheel = (event: WheelEvent) => {
  if (osInstance) {
    const viewport = osInstance.elements().viewport;
    if (event.deltaY !== 0 && viewport.scrollWidth > viewport.clientWidth) {
      event.preventDefault(); // 恢复 preventDefault
      viewport.scrollLeft += event.deltaY;
    }
  }
};

onMounted(() => {
  if (scrollbarRef.value) {
    const instance = scrollbarRef.value?.osInstance?.();
    if (instance) {
      osInstance = instance;
      const viewport = osInstance.elements().viewport;
      viewport.addEventListener('wheel', handleWheel, { passive: false });
    } else {
      // 保留一个警告，以防未来 osInstance 获取方式改变或出现问题
      console.warn('[TabBar] Failed to get OverlayScrollbars instance on mount. Horizontal wheel scroll might not work.');
    }
  }
});

onUnmounted(() => {
  if (osInstance) {
    const viewport = osInstance.elements().viewport;
    viewport.removeEventListener('wheel', handleWheel);
    osInstance = null;
  }
});

</script>

<template>
  <div
    class="tab-bar-container flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-hidden">
    <OverlayScrollbarsComponent ref="scrollbarRef" :options="{
      scrollbars: {
        autoHide: 'scroll',
        theme: isDark ? 'os-theme-light' : 'os-theme-dark'
      },
      overflow: { x: 'scroll', y: 'hidden' },
    }" class="min-w-0">
      <nav class="-mb-px flex space-x-1" aria-label="Tabs">
        <a v-for="tab in tabs" :key="tab.internalId" href="#" :class="getTabClasses(tab)"
          @click.prevent="selectTab(tab.internalId)">
          <span>{{ tab.label }}</span>
          <span v-if="tab.isDirty" class="ml-1 text-red-500">*</span>
          <button :class="getCloseButtonClasses(tab)" @click.prevent="closeTab($event, tab.internalId)"
            aria-label="Close tab">
            <XMarkIcon class="h-4 w-4" />
          </button>
        </a>
      </nav>
    </OverlayScrollbarsComponent>
    <button @click="addNewTab"
      class="ml-2 px-2 py-1.5 border-b-2 border-transparent text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150 flex-shrink-0"
      aria-label="New tab">
      <PlusIcon class="h-5 w-5" />
    </button>
  </div>
</template>

<style scoped>
/* 自定义滚动条样式已移除，因为现在使用 OverlayScrollbarsComponent。 */
</style>