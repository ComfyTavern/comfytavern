<!-- apps/frontend-vueflow/src/components/auth/InitialUsernameSetupModal.vue -->
<template>
  <div
    class="bg-gradient-to-br from-gray-100 to-gray-200 text-text-base dark:from-slate-900 dark:to-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
  >
    <div class="flex-grow p-8 space-y-8 overflow-y-auto">
      <div class="text-center">
        <div class="text-center">
          <svg class="mx-auto h-16 w-16 text-primary dark:text-primary mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <h2 class="text-3xl font-bold tracking-tight text-primary dark:text-primary">{{ t('auth.initialUsernameSetup.title') }}</h2>
          <p class="mt-3 text-sm text-text-muted max-w-xs mx-auto p-3">
            {{ t('auth.initialUsernameSetup.subtitle') }}
          </p>
        </div>

        <form @submit.prevent="handleSave" class="space-y-6">
          <div class="relative">
            <label for="nicknameInput" class="sr-only">{{ t('auth.initialUsernameSetup.nicknameLabel') }}</label>
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg class="h-5 w-5 text-text-muted" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              id="nicknameInput"
              v-model="nickname"
              :placeholder="t('auth.initialUsernameSetup.nicknamePlaceholder')"
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
              {{ isLoading ? t('auth.initialUsernameSetup.processing') : t('auth.initialUsernameSetup.confirmAndEmbark') }}
            </button>
            <button
              type="button"
              @click="handleSkip"
              class="w-full sm:w-auto px-8 py-3 font-medium text-text-base hover:text-text-base hover:bg-background-surface focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary focus:ring-offset-background-base rounded-lg disabled:opacity-50 transition-colors duration-150 ease-in-out"
            >
              {{ t('auth.initialUsernameSetup.decideLater') }}
            </button>
          </div>
        </form>
      </div>
    </div>
    <div class="px-8 py-3 text-xs text-center text-text-muted shrink-0">
      {{ t('auth.initialUsernameSetup.changeLaterHint') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authStore';

const props = defineProps<{
  initialUsername?: string;
  // The 'onSaved' and 'onClose' props are functions passed from the service
  onSaved?: () => void;
  onClose?: () => void;
}>();

const emit = defineEmits(['close-modal']);

const { t } = useI18n();
const authStore = useAuthStore();

const nickname = ref('');
const isLoading = ref(false);
const errorMessage = ref<string | null>(null);

onMounted(() => {
  if (props.initialUsername) {
    nickname.value = props.initialUsername;
  }
});

const handleSave = async () => {
  if (!nickname.value.trim()) {
    errorMessage.value = t('auth.initialUsernameSetup.errors.nicknameRequired');
    return;
  }
  if (nickname.value.trim().length < 1) {
    errorMessage.value = t('auth.initialUsernameSetup.errors.nicknameTooShort', { count: 1 });
    return;
  }
  if (nickname.value.trim().length > 30) { // 稍微缩短一些，更符合昵称的定位
    errorMessage.value = t('auth.initialUsernameSetup.errors.nicknameTooLong', { count: 30 });
    return;
  }

  errorMessage.value = null;
  isLoading.value = true;
  try {
    const result = await authStore.updateUsername(nickname.value.trim());
    if (result.success) {
      props.onSaved?.();
      emit('close-modal');
    } else {
      errorMessage.value = result.message || t('auth.initialUsernameSetup.errors.saveFailed');
    }
  } catch (error: any) {
    console.error('保存昵称时出错:', error);
    errorMessage.value = error.message || t('auth.initialUsernameSetup.errors.networkError');
  } finally {
    isLoading.value = false;
  }
};

const handleSkip = () => {
  props.onClose?.();
  emit('close-modal');
};
</script>

<style scoped>
/* No specific styles needed as it's a content component now */
</style>