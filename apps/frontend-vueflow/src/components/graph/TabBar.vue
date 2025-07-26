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
const { currentAppliedMode } = storeToRefs(themeStore)
const isDark = computed(() => currentAppliedMode.value === 'dark');

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
    'whitespace-nowrap', 'group', 'max-w-xs', // 添加 group 用于控制关闭按钮的显示,并设置最大宽度
  ]
  if (tab.internalId === activeTabId.value) {
    classes.push(
      'border-primary', 'text-primary', // 使用语义化颜色
      'bg-primary-softest' // 活动标签背景使用 primary-softest
    )
  } else {
    classes.push(
      'border-transparent', 'text-text-muted', // 非活动标签文本使用 text-muted
      'hover:text-primary', // hover 时文本变 primary
      'hover:bg-neutral-softest', // hover 时背景变 neutral-softest
      'hover:border-border-base' // hover 时边框变 border-base
    )
  }
  return classes
}

function getCloseButtonClasses(tab: Tab): string[] {
  const classes = [
    'ml-2', 'p-0.5', 'rounded', 'text-text-muted', // 关闭按钮文本使用 text-muted
    'hover:bg-neutral-softest', // hover 时背景变 neutral-softest
    'hover:text-primary', // hover 时文本变 primary
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
      // 只有在可以取消且确实需要横向滚动时才阻止默认行为
      if (event.cancelable) {
        event.preventDefault();
      }
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
      // 移除 passive: false, 让浏览器自行处理, 在需要时于 handleWheel 内调用 preventDefault
      viewport.addEventListener('wheel', handleWheel);
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
    class="tab-bar-container flex border-b border-border-base bg-background-surface overflow-y-hidden">
    <OverlayScrollbarsComponent ref="scrollbarRef" :options="{
      scrollbars: {
        autoHide: 'scroll',
        theme: isDark ? 'os-theme-light' : 'os-theme-dark' // 保留 isDark 用于 OverlayScrollbars 主题
      },
      overflow: { x: 'scroll', y: 'hidden' },
    }" class="min-w-0">
      <nav class="-mb-px flex space-x-1" aria-label="Tabs">
        <a v-for="tab in tabs" :key="tab.internalId" href="#" :class="getTabClasses(tab)"
           @click.prevent="selectTab(tab.internalId)">
           <span class="truncate">{{ tab.label }}</span>
          <span v-if="tab.isDirty" class="ml-1 text-error">*</span>
          <button :class="getCloseButtonClasses(tab)" @click.prevent="closeTab($event, tab.internalId)"
            aria-label="Close tab">
            <XMarkIcon class="h-4 w-4" />
          </button>
        </a>
      </nav>
    </OverlayScrollbarsComponent>
    <button @click="addNewTab"
      class="ml-2 px-2 py-1.5 border-b-2 border-transparent text-text-muted hover:text-primary hover:bg-neutral-softest transition-colors duration-150 flex-shrink-0"
      aria-label="New tab">
      <PlusIcon class="h-5 w-5" />
    </button>
  </div>
</template>

<style scoped>
/* 自定义滚动条样式已移除，因为现在使用 OverlayScrollbarsComponent。 */
</style>