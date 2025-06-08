<script setup lang="ts">
import { RouterView } from 'vue-router'
import { onMounted, onUnmounted, watch } from 'vue' // <-- ADDED: onUnmounted
import { useThemeStore } from './stores/theme'
import { useWorkflowStore } from './stores/workflowStore' // 导入工作流状态管理
import { useTabStore } from './stores/tabStore' // 导入标签页状态管理
import { useProjectStore } from './stores/projectStore'; // 导入项目状态管理
import { useUiStore } from './stores/uiStore'; // 导入 UI Store
import { storeToRefs } from 'pinia'
import { initializeWebSocket, closeWebSocket } from './composables/useWebSocket'; // <-- ADDED: Import WebSocket functions
import DialogContainer from './components/common/DialogContainer.vue'; // 导入对话框容器组件
import BaseModal from './components/common/BaseModal.vue'; // 导入模态框组件
import SettingsLayout from './components/settings/SettingsLayout.vue'; // 导入设置布局组件

// 初始化主题状态管理
const themeStore = useThemeStore()
const workflowStore = useWorkflowStore()
const tabStore = useTabStore()
const uiStore = useUiStore(); // 初始化 UI Store

const projectStore = useProjectStore();
const { isDark } = storeToRefs(themeStore)
const { activeTabId } = storeToRefs(tabStore);
const { currentProjectId } = storeToRefs(projectStore); // 获取当前项目 ID 的响应式引用
const { isSettingsModalVisible } = storeToRefs(uiStore); // 获取设置模态框的显示状态

onMounted(async () => {
  themeStore.initTheme();
  initializeWebSocket(); // <-- ADDED: Initialize WebSocket connection


  // 应用主题类名到 body，确保初始背景一致
  document.body.classList.toggle('light-theme', !themeStore.isDark);
  document.body.classList.toggle('dark-theme', themeStore.isDark); // 可选：如果需要为暗色主题设置特定的 body 样式

  // 项目加载逻辑已移至路由守卫 (router/index.ts)
  // 初始化标签页和工作流的逻辑将通过 watch(currentProjectId) 触发

  // 应用挂载并尝试加载初始数据后隐藏启动画面
  const splashElement = document.getElementById('splash');
  if (splashElement) {
    // 添加类名以触发在 index.html 中定义的淡出动画
    document.body.classList.add('app-ready');

    // 可选：过渡动画结束后从 DOM 中移除启动画面元素
    splashElement.addEventListener('transitionend', () => {
      splashElement.remove();
    }, { once: true }); // 确保监听器触发一次后即被移除

    // 备用方案：如果 transitionend 事件未触发，则在短暂延迟后移除
    setTimeout(() => {
      if (document.getElementById('splash')) { // 检查元素是否已被移除
        splashElement.remove();
      }
    }, 500); // 根据需要调整延迟时间（应长于 CSS 过渡时间）
  }
});

// 监听主题变化，更新当前活动标签页的边样式
watch(isDark, (newIsDarkValue) => {
  console.debug(`App.vue: isDark changed to ${newIsDarkValue}. Updating edge styles.`);
  if (activeTabId.value) {
    workflowStore.updateEdgeStylesForTab(activeTabId.value);
  } else {
    console.debug('App.vue: 未找到活动标签页，跳过边样式更新。');
  }
});

// 监听当前项目 ID 的变化
watch(currentProjectId, async (newProjectId, oldProjectId) => {
  // 在初始化新项目 *之前* 清除上一个项目的标签页
  if (oldProjectId) {
    tabStore.clearTabsForProject(oldProjectId);
    // 同时清除旧项目的工作流状态
    workflowStore.clearWorkflowStatesForProject(oldProjectId);
  }

  if (newProjectId && newProjectId !== oldProjectId) {
    console.info(`App.vue: Project ID changed to ${newProjectId}. Initializing tabs and fetching workflows.`); // 改为 info
    // 确保在项目 ID 有效后才初始化标签页和获取工作流
    // 注意：此时 projectStore.loadProject 应该已经在路由守卫中成功执行
    tabStore.initializeDefaultTab(); // 初始化或加载该项目的标签页
    await workflowStore.fetchAvailableWorkflows(); // 获取新项目的工作流列表
  } else if (!newProjectId && oldProjectId) {
    console.info(`App.vue: Project ID cleared from ${oldProjectId}. Project-specific state cleared.`); // 改为 info
    // 清除标签页和工作流状态的操作已在上面的 `if (oldProjectId)` 代码块中处理。
  }
}, { immediate: false }); // 不需要立即执行，等待路由守卫先加载项目

// 组件卸载时关闭 WebSocket 连接
onUnmounted(() => {
  closeWebSocket(); // <-- ADDED: Close WebSocket connection
});
</script>

<template>
  <div class="h-full w-full basic-flow bg-gray-100 dark:bg-gray-900">
    <RouterView />
    <!-- 全局对话框和通知容器 -->
    <DialogContainer />

    <!-- 全局设置模态框 -->
    <BaseModal
      :visible="isSettingsModalVisible"
      title="设置"
      width="max-w-3xl"
      @update:visible="!$event && uiStore.closeSettingsModal()"
    >
      <SettingsLayout />
    </BaseModal>
  </div>
</template>

<style>
/* 全局样式 */
html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  background-color: aquamarine;
}

#app {
  height: 100%;
  width: 100vw;
}

@media (prefers-color-scheme: dark) {

  html,
  body {
    background-color: darkslategray;
  }
}
</style>
