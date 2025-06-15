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
  
  // isMobileView 及其监听器已迁移到 uiStore

  // 暴露状态和方法
  return {
    theme,
    isDark,
    // collapsed, // 已移除
    // isMobileView, // 已移除，迁移到 uiStore
    // toggleCollapsed, // 已移除
    toggleTheme,
    setTheme,
    initTheme
  }
})