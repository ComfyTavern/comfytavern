<template>
  <div class="file-manager-page h-full w-full flex flex-col bg-background-base">
    <FileManagerViewLayout v-if="storeInitialized" />
    <div v-else class="flex items-center justify-center h-full">
      <!-- 可以放置一个加载指示器 -->
      <p>正在初始化文件管理器...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import FileManagerViewLayout from '@/components/file-manager/FileManagerViewLayout.vue';
import { useFileManagerStore } from '@/stores/fileManagerStore';
import { useAuthStore } from '@/stores/authStore'; // 假设 authStore 用于获取 userId

const route = useRoute();
const fileManagerStore = useFileManagerStore();
const authStore = useAuthStore(); // 假设 authStore 已初始化并包含 currentUser

const storeInitialized = ref(false);

onMounted(async () => {
  // 确保 authStore 已加载完毕，可以获取到 userId
  // 在实际应用中，路由守卫可能已经处理了 authStore 的初始化
  // 这里我们假设 authStore.currentUser 已经是响应式的，或者有一个加载状态
  if (authStore.currentUser || authStore.userContext?.mode === 'LocalNoPassword') { // 简单判断用户已加载
    initializeFileManager();
  } else {
    // 如果 authStore 还在加载，可以监听其变化
    const unwatch = watch(() => authStore.currentUser, (newUser) => {
      if (newUser || authStore.userContext?.mode === 'LocalNoPassword') {
        initializeFileManager();
        unwatch(); // 初始化后停止监听
      }
    }, { immediate: true }); // immediate true 确保如果已有值也会立即执行
  }
});

function initializeFileManager() {
  const initialPathFromRoute = route.query.path as string | undefined;
  let userId: string | null = null;

  if (authStore.userContext) {
    const context = authStore.userContext;
    switch (context.mode) {
      case 'LocalNoPassword':
        // currentUser is DefaultUserIdentity, id is 'default_user'
        userId = context.currentUser.id;
        break;
      case 'LocalWithPassword':
        // In LocalWithPassword mode, if authenticated, currentUser is DefaultUserIdentity
        if (context.isAuthenticatedWithGlobalPassword && context.currentUser) {
          userId = context.currentUser.id; // DefaultUserIdentity, id is 'default_user'
        }
        break;
      case 'MultiUserShared':
        // In MultiUserShared mode, if authenticated, currentUser is AuthenticatedMultiUserIdentity
        if (context.isAuthenticated && context.currentUser) {
          userId = context.currentUser.uid; // AuthenticatedMultiUserIdentity has uid
        }
        break;
      default:
        // Exhaustiveness check, or handle unexpected modes
        console.warn('Unknown auth context mode in FileManagerPage:', (context as any).mode);
        break;
    }
  }

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