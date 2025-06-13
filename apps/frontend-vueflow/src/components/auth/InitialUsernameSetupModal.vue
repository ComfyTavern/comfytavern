<!-- apps/frontend-vueflow/src/components/auth/InitialUsernameSetupModal.vue -->
<template>
  <BaseModal
    :visible="visible"
    title="欢迎！请设置您的昵称"
    width="400px"
    @update:visible="!$event && emit('close')"
    :closable="false"
    :mask-closable="false"
  >
    <div class="modal-content p-6">
      <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
        为了更好的体验，请输入您希望在应用中使用的昵称。
      </p>
      <form @submit.prevent="handleSave">
        <div class="mb-4">
          <label for="nicknameInput" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            昵称
          </label>
          <StringInput
            id="nicknameInput"
            v-model="nickname"
            placeholder="请输入您的昵称"
            class="w-full"
            size="large"
            :error="!!errorMessage"
          />
          <p v-if="errorMessage" class="mt-1 text-xs text-red-500">{{ errorMessage }}</p>
        </div>
        <div class="flex justify-end space-x-3">
          <!-- <button type="button" @click="emit('close')" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600">稍后设置</button> -->
          <button
            type="submit"
            :disabled="isLoading"
            class="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            @click="handleSave"
          >
            <span v-if="isLoading" class="animate-spin mr-2">⏳</span> <!-- 简单的加载指示器 -->
            保存并开始
          </button>
        </div>
      </form>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import BaseModal from '@/components/common/BaseModal.vue';
import StringInput from '@/components/graph/inputs/StringInput.vue';
// import Button from '@/components/common/Button.vue'; // Button 组件未找到，使用原生 button
import { useAuthStore } from '@/stores/authStore';
// import { useUiStore } from '@/stores/uiStore'; // 用于 Toast 通知

const props = defineProps<{
  visible: boolean;
  initialUsername?: string;
}>();

const emit = defineEmits(['close', 'saved']);

const authStore = useAuthStore();
// const uiStore = useUiStore();

const nickname = ref('');
const isLoading = ref(false);
const errorMessage = ref<string | null>(null);

watch(
  () => props.initialUsername,
  (newVal) => {
    if (newVal) {
      nickname.value = newVal;
    }
  },
  { immediate: true }
);

watch(
  () => props.visible,
  (newVal) => {
    if (newVal && props.initialUsername) {
      nickname.value = props.initialUsername;
      errorMessage.value = null; // 重置错误信息
    }
  }
);


const handleSave = async () => {
  if (!nickname.value.trim()) {
    errorMessage.value = '昵称不能为空。';
    return;
  }
  if (nickname.value.trim().length > 50) {
    errorMessage.value = '昵称不能超过50个字符。';
    return;
  }
  errorMessage.value = null;
  isLoading.value = true;
  try {
    const result = await authStore.updateUsername(nickname.value.trim());
    if (result.success) {
      // uiStore.showToast({ type: 'success', message: '昵称设置成功！' });
      emit('saved');
      emit('close');
    } else {
      errorMessage.value = result.message || '保存昵称失败，请重试。';
      // uiStore.showToast({ type: 'error', message: `保存失败: ${result.message || '未知错误'}` });
    }
  } catch (error: any) {
    errorMessage.value = error.message || '保存昵称时发生未知网络错误。';
    // uiStore.showToast({ type: 'error', message: `保存时出错: ${error.message || '未知网络错误'}` });
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
/* 根据需要添加样式 */
.modal-content {
  /* Tailwind classes are used above, direct styles can be added here if needed */
}
</style>