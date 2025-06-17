<script setup lang="ts">
import { RouterView } from 'vue-router'
import { onMounted, onUnmounted, watch, ref, watchEffect } from 'vue' // + Import ref, watchEffect
import { useThemeStore } from './stores/theme'
import { useWorkflowStore } from './stores/workflowStore' // 导入工作流状态管理
import { useTabStore } from './stores/tabStore' // 导入标签页状态管理
import { useProjectStore } from './stores/projectStore'; // 导入项目状态管理
import { useUiStore } from './stores/uiStore'; // 导入 UI Store
import { useAuthStore } from './stores/authStore'; // + 导入 authStore
import InitialUsernameSetupModal from './components/auth/InitialUsernameSetupModal.vue'; // + Import modal
import { storeToRefs } from 'pinia'
import { initializeWebSocket, closeWebSocket } from './composables/useWebSocket'; // <-- ADDED: Import WebSocket functions
import DialogContainer from './components/common/DialogContainer.vue'; // 导入对话框容器组件
import BaseModal from './components/common/BaseModal.vue'; // 导入模态框组件
import SettingsLayout from './components/settings/SettingsLayout.vue'; // 导入设置布局组件
import TooltipRenderer from './components/common/TooltipRenderer.vue'; // + 导入全局 Tooltip 渲染器

// 初始化主题状态管理
const themeStore = useThemeStore()
const workflowStore = useWorkflowStore()
const tabStore = useTabStore()
const uiStore = useUiStore(); // 初始化 UI Store
const projectStore = useProjectStore();
const authStore = useAuthStore(); // + 初始化 authStore

const { currentAppliedMode } = storeToRefs(themeStore); // 从 isDark 更改为 currentAppliedMode
const { activeTabId } = storeToRefs(tabStore);
const { currentProjectId } = storeToRefs(projectStore); // 获取当前项目 ID 的响应式引用
const { isSettingsModalVisible, settingsModalProps } = storeToRefs(uiStore); // 获取设置模态框的显示状态和属性
const { userContext, currentUser, isLoadingContext } = storeToRefs(authStore); // + Add currentUser, isLoadingContext
 
const showInitialUsernameModal = ref(false); // + Ref for modal visibility
// const initialSetupDoneKey = 'comfytavern_initial_setup_processed'; // 将在 watchEffect 中动态生成
 
onMounted(async () => {
  themeStore.initTheme();
  initializeWebSocket(); // <-- ADDED: Initialize WebSocket connection
  await authStore.fetchUserContext(); // + 获取用户上下文
  uiStore.setupMobileViewListener(); // + 设置移动端视图监听器

  // 应用主题类名到 body 的逻辑已由 themeStore.applyCurrentTheme() 在 <html> 上处理
  // document.body.classList.toggle('light-theme', themeStore.currentAppliedMode === 'light');
  // document.body.classList.toggle('dark-theme', themeStore.currentAppliedMode === 'dark');

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

// 监听主题变化（实际是亮/暗模式应用的变化），更新当前活动标签页的边样式
watch(currentAppliedMode, (newModeValue) => {
  console.debug(`App.vue: currentAppliedMode changed to ${newModeValue}. Updating edge styles.`);
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

// + Watch for conditions to show initial username setup modal
watchEffect(() => {
  if (isLoadingContext.value || !userContext.value) {
    // 如果还在加载或用户上下文不可用，则不执行
    return;
  }

  // 首先处理非 LocalNoPassword 模式，这些模式下不应显示此弹窗
  if (userContext.value.mode !== 'LocalNoPassword') {
    showInitialUsernameModal.value = false;
    return;
  }

  // 此处，userContext.value.mode 必定是 'LocalNoPassword'
  // currentUser.value 的类型应为 DefaultUserIdentity
  const currentUserVal = currentUser.value as import('@comfytavern/types').DefaultUserIdentity | null;

  if (!currentUserVal) { // 理论上在 LocalNoPassword 模式下，currentUser 不应为 null
    showInitialUsernameModal.value = false;
    return;
  }

  // 此时 currentUserVal.id 是 'default_user'
  const userSpecificSetupKey = `comfytavern_initial_setup_processed_${currentUserVal.id}`;
  const setupProcessed = localStorage.getItem(userSpecificSetupKey) === 'true';

  if (setupProcessed) {
    showInitialUsernameModal.value = false;
    return;
  }

  if (currentUserVal.username === '本地用户') {
    showInitialUsernameModal.value = true;
  } else {
    // 用户名不是 "本地用户"，说明已经设置过了（即使 localStorage 没有标记）
    // 此时应该标记 localStorage 并关闭弹窗
    localStorage.setItem(userSpecificSetupKey, 'true');
    showInitialUsernameModal.value = false;
  }
});

const handleModalInteraction = () => {
  if (userContext.value && userContext.value.mode === 'LocalNoPassword' && currentUser.value) {
    // 明确知道是 LocalNoPassword 模式，currentUser 类型是 DefaultUserIdentity
    const user = currentUser.value as import('@comfytavern/types').DefaultUserIdentity;
    const userSpecificSetupKey = `comfytavern_initial_setup_processed_${user.id}`;
    localStorage.setItem(userSpecificSetupKey, 'true');
  }
  showInitialUsernameModal.value = false;
};
</script>
 
<template>
  <div class="h-full w-full basic-flow bg-background-base">
    <RouterView />
    <!-- 全局对话框和通知容器 -->
    <DialogContainer />
    <!-- 全局 Tooltip 渲染器 -->
    <TooltipRenderer />

    <!-- 全局设置模态框 -->
    <BaseModal
      :visible="isSettingsModalVisible"
      title="设置"
      :width="settingsModalProps.width"
      :height="settingsModalProps.height"
      @update:visible="!$event && uiStore.closeSettingsModal()"
    >
      <SettingsLayout />
    </BaseModal>

    <!-- + Initial Username Setup Modal -->
    <InitialUsernameSetupModal
      :visible="showInitialUsernameModal"
      :initial-username="currentUser?.username"
      @close="handleModalInteraction"
      @saved="handleModalInteraction"
    />
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
  /* background-color: aquamarine; */ /* 由 CSS 变量控制 */
  background-color: var(--ct-background-base); /* 使用主题变量 */
}

#app {
  height: 100%;
  width: 100vw;
}

/* @media (prefers-color-scheme: dark) { */
  /* 暗色模式的 body 背景也由 html.dark 和 --ct-background-base 控制 */
/*
  html,
  body {
    background-color: darkslategray;
  }
}
*/
</style>
