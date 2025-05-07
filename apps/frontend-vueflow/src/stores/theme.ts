import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ThemeType = 'dark' | 'light' | 'system'

export const useThemeStore = defineStore('theme', () => {
  // 从本地存储中获取主题设置，如果不存在，则使用系统设置
  const savedTheme = localStorage.getItem('theme') as ThemeType | null
  const systemDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
  
  // 主题状态
  const theme = ref<ThemeType>(savedTheme || 'system')
  
  // 是否为暗色模式
  const isDark = ref(
    theme.value === 'dark' || 
    (theme.value === 'system' && systemDarkMode)
  )

  // 监听系统主题变化
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', (e) => {
    if (theme.value === 'system') {
      isDark.value = e.matches
      updateThemeClass()
    }
  })

  // 切换主题：light -> dark -> system -> light ...
  function toggleTheme() {
    switch (theme.value) {
      case 'light':
        theme.value = 'dark'
        break
      case 'dark':
        theme.value = 'system'
        break
      case 'system':
        theme.value = 'light' // 从 system 切换回 light
        break
      default:
        // 如果出现意外情况，默认切换到 system
        theme.value = 'system'
        break
    }

    // 更新暗色模式状态
    updateDarkMode()
    // 保存到本地存储
    saveTheme()
    // 更新HTML类
    updateThemeClass()
  }
  
  // 设置特定主题
  function setTheme(newTheme: ThemeType) {
    theme.value = newTheme
    
    // 更新暗色模式状态
    updateDarkMode()
    // 保存到本地存储
    saveTheme()
    // 更新HTML类
    updateThemeClass()
  }
  
  // 更新isDark状态
  function updateDarkMode() {
    if (theme.value === 'system') {
      isDark.value = mediaQuery.matches
    } else {
      isDark.value = theme.value === 'dark'
    }
  }
  
  // 保存主题到本地存储
  function saveTheme() {
    localStorage.setItem('theme', theme.value)
  }
  
  // 更新HTML文档类
  function updateThemeClass() {
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }
  
  // 初始化主题
  function initTheme() {
    updateThemeClass()
  }
  
  // 侧边栏状态管理
  const collapsed = ref(false)
  // 记住桌面端的展开状态
  const desktopCollapsedState = ref(false)
  // 是否为移动端视图
  const isMobileView = ref(window.matchMedia('(max-width: 1024px)').matches)

  // 监听窗口大小变化
  window.matchMedia('(max-width: 1024px)').addEventListener('change', (e) => {
    isMobileView.value = e.matches
    // 在移动端自动折叠，在桌面端恢复之前的状态
    collapsed.value = e.matches ? true : desktopCollapsedState.value
  })

  // 切换折叠状态
  function toggleCollapsed() {
    collapsed.value = !collapsed.value
    // 在桌面端时保存状态
    if (!isMobileView.value) {
      desktopCollapsedState.value = collapsed.value
    }
  }

  // 暴露状态和方法
  return {
    theme,
    isDark,
    collapsed,
    isMobileView,
    toggleCollapsed,
    toggleTheme,
    setTheme,
    initTheme
  }
})