<!-- apps/frontend-vueflow/src/components/auth/InitialUsernameSetupModal.vue -->
<template>
  <BaseModal
    :visible="visible"
    width="max-w-md"
    @update:visible="!$event && handleSkip()"
    :showCloseButton="true"
    :closeOnBackdropClick="false"
    @close="handleSkip"
    :bare="true"
    dialogClass="bg-gradient-to-br from-gray-100 to-gray-200 text-text-base dark:from-slate-900 dark:to-gray-800 rounded-xl shadow-2xl overflow-hidden"
    contentClass="!p-0 flex flex-col"
  >
    <div class="flex-grow p-8 space-y-8 overflow-y-auto">
      <div class="text-center">
        <div class="text-center">
          <svg class="mx-auto h-16 w-16 text-primary dark:text-primary mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <h2 class="text-3xl font-bold tracking-tight text-primary dark:text-primary">欢迎使用 ComfyTavern</h2>
          <p class="mt-3 text-sm text-text-muted max-w-xs mx-auto p-3">
            请设置您的初始信息
          </p>
        </div>

        <form @submit.prevent="handleSave" class="space-y-6">
          <div class="relative">
            <label for="nicknameInput" class="sr-only">昵称</label>
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg class="h-5 w-5 text-text-muted" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              id="nicknameInput"
              v-model="nickname"
              placeholder="例如：星尘探险家"
              :class="[
                'w-full !pl-12 !pr-4 !py-3 bg-background-surface text-text-base placeholder-text-muted !rounded-lg !shadow-sm transition-all',
                errorMessage
                  ? '!border-error focus:!ring-error focus:!border-error'
                  : 'border-border-base focus:!ring-primary focus:!border-primary'
              ]"
            />
            <p v-if="errorMessage" class="mt-2 text-xs text-error flex items-center justify-start text-left">
              <svg class="h-4 w-4 mr-1.5 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <span>{{ errorMessage }}</span>
            </p>
          </div>

          <div class="pt-4 space-y-3 sm:space-y-0 sm:flex sm:flex-row-reverse sm:space-x-reverse sm:space-x-3">
            <button
              type="submit"
              :disabled="isLoading || !nickname.trim()"
              class="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 font-semibold text-primary-content bg-primary hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-background-base rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform transition-all hover:scale-105 active:scale-95 duration-150 ease-in-out"
            >
              <svg v-if="isLoading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-primary-content" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ isLoading ? '处理中...' : '确认并启程' }}
            </button>
            <button
              type="button"
              @click="handleSkip"
              class="w-full sm:w-auto px-8 py-3 font-medium text-text-base hover:text-text-base hover:bg-background-surface focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary focus:ring-offset-background-base rounded-lg disabled:opacity-50 transition-colors duration-150 ease-in-out"
            >
              稍后决定
            </button>
          </div>
        </form>
      </div>
    </div>
    <div class="px-8 py-3 text-xs text-center text-text-muted shrink-0">
      您可以稍后在设置中更改昵称。
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import BaseModal from '@/components/common/BaseModal.vue';
import { useAuthStore } from '@/stores/authStore';

const props = defineProps<{
  visible: boolean;
  initialUsername?: string;
}>();

const emit = defineEmits(['close', 'saved']);

const authStore = useAuthStore();

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
  (newVal, oldVal) => {
    if (newVal && !oldVal) {
      if (props.initialUsername) {
        nickname.value = props.initialUsername;
      } else {
        nickname.value = '';
      }
      errorMessage.value = null;
      isLoading.value = false;
    }
  }
);

const handleSave = async () => {
  if (!nickname.value.trim()) {
    errorMessage.value = '昵称不能为空，请输入一个独特的代号。';
    return;
  }
  if (nickname.value.trim().length < 1) {
    errorMessage.value = '昵称至少需要1个字符。';
    return;
  }
  if (nickname.value.trim().length > 30) { // 稍微缩短一些，更符合昵称的定位
    errorMessage.value = '昵称太长啦，最多30个字符就够了。';
    return;
  }
  // 可以添加更复杂的昵称校验规则，例如不允许特殊字符等
  // const nicknameRegex = /^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/;
  // if (!nicknameRegex.test(nickname.value.trim())) {
  //   errorMessage.value = '昵称只能包含中英文、数字、下划线和破折号。';
  //   return;
  // }

  errorMessage.value = null;
  isLoading.value = true;
  try {
    // 模拟网络延迟
    // await new Promise(resolve => setTimeout(resolve, 1500));
    const result = await authStore.updateUsername(nickname.value.trim());
    if (result.success) {
      emit('saved');
      emit('close');
    } else {
      errorMessage.value = result.message || '哎呀，保存昵称时遇到点小麻烦，请重试。';
    }
  } catch (error: any) {
    console.error('保存昵称时出错:', error);
    errorMessage.value = error.message || '网络似乎开小差了，请稍后再试。';
  } finally {
    isLoading.value = false;
  }
};

const handleSkip = () => {
  emit('close');
};
</script>

<style scoped>
/* 移除了 .modal-content-wrapper 和相关的动画，因为 BaseModal 已有过渡效果 */
</style>