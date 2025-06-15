<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useThemeStore } from '../stores/theme';
import { useUiStore } from '@/stores/uiStore'; // + 导入 uiStore
import { computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { storeToRefs } from 'pinia'
import { getBackendBaseUrl } from '@/utils/urlUtils'
// import Tooltip from '@/components/common/Tooltip.vue'; // 移除 Tooltip 组件导入

const themeStore = useThemeStore() // themeStore 仍然需要用于 isDark
const uiStore = useUiStore(); // + 实例化 uiStore
const authStore = useAuthStore()
const { currentUser } = storeToRefs(authStore)

const defaultAvatarPath = '/img/default-avatar.png'; // 确保这个文件在 public/img 目录下

// 在移动端视图下自动折叠侧边栏
onMounted(() => {
  // 调用 uiStore action 来设置移动端视图监听器
  // 这个 action 应该在应用更早的阶段被调用，例如 App.vue onMounted
  // 但如果 uiStore 尚未被其他地方初始化监听器，这里调用一次也无妨，
  // action 内部应该有防止重复添加监听器的逻辑（如果需要的话，但通常 matchMedia().addEventListener 是幂等的）
  // 更好的做法是在 App.vue 中调用 uiStore.setupMobileViewListener()
  // 这里我们假设它已经被调用，或者 uiStore 的 state 初始化中已经处理了监听器
  // 根据我们对 uiStore 的修改，setupMobileViewListener 需要被调用。
  // 我们暂时在这里调用它，但理想位置是在 App.vue。
  if (!uiStore.isMobileView && typeof uiStore.setupMobileViewListener === 'function') {
      // 这是一个临时的处理，确保监听器被设置。
      // 理想情况下，这个 action 应该在 App.vue onMounted 中调用。
      // 或者，如果 setupMobileViewListener 内部能处理多次调用（例如检查是否已监听），则无害。
      // 当前的 setupMobileViewListener 实现每次调用都会尝试 addEventListener。
      // 为避免重复，我们应该只在应用级别调用一次。
      // 暂时注释掉这里的调用，并假设它在 App.vue 中完成。
      // uiStore.setupMobileViewListener(); // 移至 App.vue onMounted 更佳
  }

  if (uiStore.isMobileView) { // + 从 uiStore 读取 isMobileView
    uiStore.setMainSidebarCollapsed(true);
  }
  // 尝试在挂载时获取一次用户上下文，以确保信息是最新的
  // 如果 authStore.fetchUserContext() 已经由其他地方（如 App.vue 或路由守卫）调用，这里可能不是必须的
  // 但为了确保 SideBar 能尽快拿到用户信息，可以考虑在这里调用
  if (!currentUser.value) {
    authStore.fetchUserContext();
  }
})

// 计算文本元素的动态类
const textClasses = computed(() => uiStore.isMainSidebarCollapsed
  ? 'opacity-0 max-w-0' // 收起时：透明度为0，最大宽度为0
  : 'opacity-100 max-w-xs ml-2 delay-150' // 展开时：延迟150ms后，透明度为1，设置最大宽度和左边距
)

const displayedAvatarUrl = computed(() => {
  const userAvatar = currentUser.value?.avatarUrl;
  if (userAvatar) {
    if (userAvatar.startsWith('http://') || userAvatar.startsWith('https://') || userAvatar.startsWith('data:')) {
      return userAvatar;
    }
    // 假设 avatarUrl 是相对路径，需要拼接后端地址
    // 如果 avatarUrl 已经是完整的，或者来自外部服务，则直接使用
    const backendBase = getBackendBaseUrl();
    return `${backendBase}${userAvatar.startsWith('/') ? userAvatar : `/${userAvatar}`}`;
  }
  return defaultAvatarPath;
});

const onAvatarError = (event: Event) => {
  const imgElement = event.target as HTMLImageElement;
  if (imgElement.src !== `${window.location.origin}${defaultAvatarPath}`) {
    imgElement.src = defaultAvatarPath;
  } else {
    console.warn(`前端默认头像 (${defaultAvatarPath}) 也加载失败。`);
    // 可以考虑显示一个占位符SVG或隐藏图片
  }
};

// 用户名，如果折叠则不显示
const displayedUsername = computed(() => {
  if (uiStore.isMainSidebarCollapsed) {
    return '';
  }
  return currentUser.value?.username || '游客';
});
</script>

<template>
  <div class="fixed left-0 top-0 bottom-0 flex flex-col z-10 transition-all duration-300 ease-in-out" :class="[
    uiStore.isMainSidebarCollapsed ? 'w-16' : 'w-64',
    themeStore.isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-800' // isDark 仍由 themeStore 管理
  ]">
    <!-- 用户头像和名称 -->
    <div class="p-2 flex flex-col items-center mt-2 mb-2">
      <img
        :src="displayedAvatarUrl"
        alt="用户头像"
        @error="onAvatarError"
        class="w-12 h-12 rounded-full object-cover border-2"
        :class="themeStore.isDark ? 'border-gray-600' : 'border-gray-300'"
      />
      <div
        v-if="displayedUsername"
        class="mt-2 text-sm font-medium transition-opacity duration-150 ease-in-out overflow-hidden whitespace-nowrap"
        :class="[
          uiStore.isMainSidebarCollapsed ? 'opacity-0 max-h-0' : 'opacity-100 max-h-10 delay-150',
          themeStore.isDark ? 'text-gray-300' : 'text-gray-700'
        ]"
        style="transition-property: opacity, max-height;"
      >
        {{ displayedUsername }}
      </div>
    </div>

    <!-- 导航链接 -->
    <nav class="flex-1 flex flex-col px-2 py-2 space-y-2">
      <RouterLink to="/home" custom v-slot="{ navigate, isExactActive }">
        <div @click="navigate" class="w-full p-2 rounded flex items-center cursor-pointer" :class="[
          uiStore.isMainSidebarCollapsed ? 'justify-center' : 'justify-start',
          themeStore.isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100',
          isExactActive ? (themeStore.isDark ? 'bg-gray-700' : 'bg-gray-200') : ''
        ]">
          <span class="inline text-lg">🏠</span>
          <span class="text-base transition-all duration-150 ease-in-out overflow-hidden whitespace-nowrap"
            :class="textClasses">主页</span>
        </div>
      </RouterLink>

      <RouterLink to="/home/projects" class="w-full p-2 rounded flex items-center" :class="[
        uiStore.isMainSidebarCollapsed ? 'justify-center' : 'justify-start',
        themeStore.isDark ? 'hover:bg-gray-700 active:bg-gray-700' : 'hover:bg-gray-100 active:bg-gray-200'
      ]" :active-class="themeStore.isDark ? 'bg-gray-700' : 'bg-gray-200'">
        <span class="inline text-lg">📁</span>
        <span class="text-base transition-all duration-150 ease-in-out overflow-hidden whitespace-nowrap"
          :class="textClasses">项目</span>
      </RouterLink>
      <RouterLink to="/home/characters" class="w-full p-2 rounded flex items-center" :class="[
        uiStore.isMainSidebarCollapsed ? 'justify-center' : 'justify-start',
        themeStore.isDark ? 'hover:bg-gray-700 active:bg-gray-700' : 'hover:bg-gray-100 active:bg-gray-200'
      ]" :active-class="themeStore.isDark ? 'bg-gray-700' : 'bg-gray-200'">
        <span class="inline text-lg">🎭</span>
        <span class="text-base transition-all duration-150 ease-in-out overflow-hidden whitespace-nowrap"
          :class="textClasses">角色卡</span>
      </RouterLink>

      <RouterLink to="/home/files" class="w-full p-2 rounded flex items-center" :class="[
        uiStore.isMainSidebarCollapsed ? 'justify-center' : 'justify-start',
        themeStore.isDark ? 'hover:bg-gray-700 active:bg-gray-700' : 'hover:bg-gray-100 active:bg-gray-200'
      ]" :active-class="themeStore.isDark ? 'bg-gray-700' : 'bg-gray-200'">
        <span class="inline text-lg">🗂️</span>
        <span class="text-base transition-all duration-150 ease-in-out overflow-hidden whitespace-nowrap"
          :class="textClasses">文件管理</span>
      </RouterLink>

      <RouterLink to="/home/about" class="w-full p-2 rounded flex items-center" :class="[
        uiStore.isMainSidebarCollapsed ? 'justify-center' : 'justify-start',
        themeStore.isDark ? 'hover:bg-gray-700 active:bg-gray-700' : 'hover:bg-gray-100 active:bg-gray-200'
      ]" :active-class="themeStore.isDark ? 'bg-gray-700' : 'bg-gray-200'">
        <span class="inline text-lg">ℹ️</span>
        <span class="text-base transition-all duration-150 ease-in-out overflow-hidden whitespace-nowrap"
          :class="textClasses">关于</span>
      </RouterLink>
    </nav>

    <!-- 底部按钮区域 -->
    <div class="p-2 space-y-2">
      <!-- 主题切换按钮 -->
      <div v-comfy-tooltip="'切换主题'" class="w-full p-2 rounded flex items-center cursor-pointer" :class="[
          uiStore.isMainSidebarCollapsed ? 'justify-center' : 'justify-start',
          themeStore.isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100' // 亮色主题 hover 调整
        ]" @click="themeStore.toggleTheme()">
        <span class="inline text-lg">
          <span v-if="themeStore.theme === 'system'">💻</span>
          <span v-else-if="themeStore.theme === 'light'">☀️</span>
          <span v-else>🌙</span>
        </span>
        <span class="text-base transition-all duration-150 ease-in-out overflow-hidden whitespace-nowrap"
          :class="textClasses">
          {{ themeStore.theme === 'system' ? '跟随系统' : themeStore.theme === 'dark' ? '暗色模式' : '亮色模式' }}
        </span>
      </div>

      <!-- 设置按钮 -->
      <RouterLink to="/home/settings" class="w-full p-2 rounded flex items-center mt-2" :class="[
        uiStore.isMainSidebarCollapsed ? 'justify-center' : 'justify-start',
        themeStore.isDark ? 'hover:bg-gray-700 active:bg-gray-700' : 'hover:bg-gray-100 active:bg-gray-200'
      ]" :active-class="themeStore.isDark ? 'bg-gray-700' : 'bg-gray-200'">
        <span class="inline text-lg">⚙️</span>
        <span class="text-base transition-all duration-150 ease-in-out overflow-hidden whitespace-nowrap"
          :class="textClasses">设置</span>
      </RouterLink>

      <!-- 折叠按钮 -->
      <button v-comfy-tooltip="'折叠/展开侧边栏'" @click="uiStore.toggleMainSidebar()" class="w-full p-2 rounded flex items-center mt-2" :class="[ // + 使用 uiStore action
          uiStore.isMainSidebarCollapsed ? 'justify-center' : 'justify-start',
          themeStore.isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100' // 亮色主题 hover 调整
        ]">
        <span role="img" aria-label="sidebar" class="text-lg p-1" v-if="uiStore.isMainSidebarCollapsed">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em"
            focusable="false" aria-hidden="true">
            <path fill-rule="evenodd" clip-rule="evenodd"
              d="M5 2h14a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Zm1 2a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H6Z"
              fill="currentColor"></path>
          </svg>
        </span>
        <span role="img" aria-label="sidebar" class="text-lg p-1" v-else>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em"
            focusable="false" aria-hidden="true">
            <path fill-rule="evenodd" clip-rule="evenodd"
              d="M5 2h14a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Zm1 2a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H6Z"
              fill="currentColor"></path>
          </svg>
        </span>
        <span class="text-base transition-all duration-150 ease-in-out overflow-hidden whitespace-nowrap"
          :class="textClasses">
          {{ uiStore.isMainSidebarCollapsed ? '展开' : '折叠' }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped></style>