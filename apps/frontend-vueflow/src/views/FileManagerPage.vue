<template>
  <div class="file-manager-page h-full w-full flex flex-col bg-background-base">
    <FileManagerViewLayout v-if="storeInitialized" />
    <div v-else class="flex items-center justify-center h-full">
      <!-- 可以放置一个加载指示器 -->
      <p>{{ t('fileManager.initializing') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import FileManagerViewLayout from '@/components/file-manager/FileManagerViewLayout.vue';
import { useFileManagerStore } from '@/stores/fileManagerStore';
import { useAuthStore } from '@/stores/authStore'; // 假设 authStore 用于获取 userId

const { t } = useI18n();
const route = useRoute();
const fileManagerStore = useFileManagerStore();
const authStore = useAuthStore(); // 假设 authStore 已初始化并包含 currentUser

const storeInitialized = ref(false);

onMounted(async () => {
  // 确保 authStore 已加载完毕，可以获取到 userId
  // 在实际应用中，路由守卫可能已经处理了 authStore 的初始化
  // 使用 isAuthenticated getter 来判断是否可以初始化
  if (authStore.isAuthenticated) {
    initializeFileManager();
  } else {
    // 如果 authStore 还在加载或用户未认证，监听其变化
    const unwatch = watch(() => authStore.isAuthenticated, (isAuth) => {
      if (isAuth) {
        initializeFileManager();
        unwatch(); // 初始化后停止监听
      }
    }, { immediate: true });
  }
});

function initializeFileManager() {
  const initialPathFromRoute = route.query.path as string | undefined;
  // v4 简化：直接从 currentUser 获取 uid
  const userId = authStore.currentUser?.uid ?? null;

  // console.log('Initializing FileManagerPage with userId:', userId, 'and initialPath:', initialPathFromRoute);
  fileManagerStore.initialize(userId, initialPathFromRoute);
  storeInitialized.value = true;
}

// 当路由的 query.path 变化时，重新导航 (如果需要深度链接到特定路径)
watch(() => route.query.path, (newPath) => {
  if (storeInitialized.value && typeof newPath === 'string' && newPath !== fileManagerStore.currentLogicalPath) {
    // console.log('Route path changed, navigating to:', newPath);
    fileManagerStore.navigateTo(newPath);
  }
});

</script>

<style scoped>
.file-manager-page {
  /* 可以添加一些页面级别的特定样式 */
}
</style>