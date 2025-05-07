<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useThemeStore } from '../stores/theme'
import { computed, onMounted } from 'vue'
import Tooltip from '@/components/common/Tooltip.vue'; // 导入 Tooltip 组件

const themeStore = useThemeStore()

// 在移动端视图下自动折叠侧边栏
onMounted(() => {
  if (themeStore.isMobileView) {
    themeStore.collapsed = true
  }
})

// 计算文本元素的动态类
const textClasses = computed(() => themeStore.collapsed
  ? 'opacity-0 max-w-0' // 收起时：透明度为0，最大宽度为0
  : 'opacity-100 max-w-xs ml-2 delay-150' // 展开时：延迟150ms后，透明度为1，设置最大宽度和左边距
)
</script>

<template>
  <div class="fixed left-0 top-0 bottom-0 bg-gray-800 text-white flex flex-col z-10 transition-all duration-300 ease-in-out"
    :class="themeStore.collapsed ? 'w-16' : 'w-64'">
    <!-- 用户头像 -->
    <div class="p-2 flex justify-center">
      <div class="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center">
        <span class="text-xl">👤</span>
      </div>
    </div>

    <!-- 导航链接 -->
    <nav class="flex-1 flex flex-col px-2 py-4 space-y-2">
      <RouterLink
        to="/"
        class="w-full p-2 rounded hover:bg-gray-700 flex items-center"
        :class="themeStore.collapsed ? 'justify-center' : 'justify-start'"
        active-class="bg-gray-700"
      >
        <span class="inline text-lg">🏠</span> <!-- 主页图标 -->
        <span
          class="text-base transition-all duration-150 ease-in-out overflow-hidden whitespace-nowrap"
          :class="textClasses"
        >主页</span> <!-- 主页文本 -->
      </RouterLink>
      
      <RouterLink
        to="/projects"
        class="w-full p-2 rounded hover:bg-gray-700 flex items-center"
        :class="themeStore.collapsed ? 'justify-center' : 'justify-start'"
        active-class="bg-gray-700"
      >
        <span class="inline text-lg">📁</span> <!-- 项目图标 -->
        <span
          class="text-base transition-all duration-150 ease-in-out overflow-hidden whitespace-nowrap"
          :class="textClasses"
        >项目</span> <!-- 项目文本 -->
      </RouterLink>
      
      <!-- 移除编辑器链接，因为它需要项目上下文 -->
      <!--
      <RouterLink
        to="/editor" // 需要动态 projectId
        class="w-full p-2 rounded hover:bg-gray-700 flex items-center"
        :class="themeStore.collapsed ? 'justify-center' : 'justify-start'"
        active-class="bg-gray-700"
      >
        <span class="inline text-lg">✏️</span>
        <span
          class="text-base transition-all duration-150 ease-in-out overflow-hidden whitespace-nowrap"
          :class="textClasses"
        >编辑器</span>
      </RouterLink>
      -->
      <RouterLink
        to="/characters"
        class="w-full p-2 rounded hover:bg-gray-700 flex items-center"
        :class="themeStore.collapsed ? 'justify-center' : 'justify-start'"
        active-class="bg-gray-700"
      >
        <span class="inline text-lg">🎭</span> <!-- 新增图标 -->
        <span
          class="text-base transition-all duration-150 ease-in-out overflow-hidden whitespace-nowrap"
          :class="textClasses"
        >角色卡</span> <!-- 新增文本 -->
      </RouterLink>
      
      <RouterLink
        to="/about"
        class="w-full p-2 rounded hover:bg-gray-700 flex items-center"
        :class="themeStore.collapsed ? 'justify-center' : 'justify-start'"
        active-class="bg-gray-700"
      >
        <span class="inline text-lg">ℹ️</span>
        <span
          class="text-base transition-all duration-150 ease-in-out overflow-hidden whitespace-nowrap"
          :class="textClasses"
        >关于</span>
      </RouterLink>
    </nav>

    <!-- 底部按钮区域 -->
    <div class="p-2 space-y-2">
      <!-- 主题切换按钮 -->
      <Tooltip content="切换主题">
        <div
          class="w-full p-2 rounded hover:bg-gray-700 flex items-center cursor-pointer"
          :class="themeStore.collapsed ? 'justify-center' : 'justify-start'"
          @click="themeStore.toggleTheme()"
        >
          <span class="inline text-lg">
            <span v-if="themeStore.theme === 'system'">💻</span>
            <span v-else-if="themeStore.theme === 'light'">☀️</span>
            <span v-else>🌙</span>
          </span>
          <span
            class="text-sm transition-all duration-150 ease-in-out overflow-hidden whitespace-nowrap"
            :class="textClasses"
          >
            {{ themeStore.theme === 'system' ? '跟随系统' : themeStore.theme === 'dark' ? '暗色模式' : '亮色模式' }}
          </span>
        </div>
      </Tooltip>
      
      <!-- 设置按钮 -->
      <button
        class="w-full p-2 rounded hover:bg-gray-700 flex items-center mt-2"
        :class="themeStore.collapsed ? 'justify-center' : 'justify-start'"
      >
        <span class="inline text-lg">⚙️</span>
        <span
          class="text-base transition-all duration-150 ease-in-out overflow-hidden whitespace-nowrap"
          :class="textClasses"
        >设置</span>
      </button>
      
      <!-- 折叠按钮 -->
      <Tooltip content="折叠/展开侧边栏">
        <button
          @click="themeStore.toggleCollapsed()"
          class="w-full p-2 rounded hover:bg-gray-700 flex items-center mt-2"
          :class="themeStore.collapsed ? 'justify-center' : 'justify-start'"
        >
          <span role="img" aria-label="sidebar" class="text-lg p-1" v-if="themeStore.collapsed">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" focusable="false" aria-hidden="true">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M5 2h14a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Zm1 2a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H6Z" fill="currentColor"></path>
            </svg>
          </span>
          <span role="img" aria-label="sidebar" class="text-lg p-1" v-else>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" focusable="false" aria-hidden="true">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M5 2h14a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Zm1 2a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H6Z" fill="currentColor"></path>
            </svg>
          </span>
          <span
            class="text-base transition-all duration-150 ease-in-out overflow-hidden whitespace-nowrap"
            :class="textClasses"
          >
            {{ themeStore.collapsed ? '展开' : '折叠' }}
          </span>
        </button>
      </Tooltip>
    </div>
  </div>
</template>

<style scoped>
</style>