<template>
  <div>
    <h2 class="text-xl font-semibold mb-6">创建新面板</h2>
    <form @submit.prevent="handleSubmit">
      <div class="space-y-4 text-left">
        <div>
          <label for="panel-name" class="block text-sm font-medium text-text-base">面板名称</label>
          <input type="text" v-model="panelName" id="panel-name"
            class="mt-1 block w-full px-3 py-2 bg-background-surface border border-border-base rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
            required placeholder="例如：我的聊天机器人">
        </div>
        <div>
          <label for="panel-id" class="block text-sm font-medium text-text-base">面板 ID</label>
          <input type="text" v-model="panelId" id="panel-id"
            class="mt-1 block w-full px-3 py-2 bg-background-surface border border-border-base rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
            required placeholder="例如：my-chat-bot" pattern="[a-z0-9-]+">
          <p class="mt-1 text-xs text-text-secondary">只允许小写字母、数字和短横线 (-)。</p>
        </div>
      </div>
      <div class="mt-6 flex justify-end space-x-3">
        <button type="button" @click="$emit('close')"
          class="px-4 py-2 text-sm font-medium text-text-base bg-background-surface border border-border-base rounded-md hover:bg-background-hover">
          取消
        </button>
        <button type="submit" :disabled="isCreating"
          class="px-4 py-2 text-sm font-medium text-primary-content bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
          {{ isCreating ? '创建中...' : '创建面板' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { usePanelStore } from '@/stores/panelStore';
import { useDialogService } from '@/services/DialogService';
import { toSlug } from '@/utils/textUtils';

const props = defineProps<{
  projectId: string;
}>();

const emit = defineEmits(['close', 'created']);

const panelStore = usePanelStore();
const dialogService = useDialogService();

const isCreating = ref(false);
const panelName = ref('');
const panelId = ref('');

watch(panelName, (newName: string) => {
  panelId.value = toSlug(newName);
});

const handleSubmit = async () => {
  if (!panelName.value || !panelId.value) {
    return;
  }

  isCreating.value = true;
  try {
    await panelStore.createPanel(props.projectId, {
      panelId: panelId.value,
      displayName: panelName.value,
    });
    dialogService.showSuccess('面板创建成功！');
    emit('created');
  } catch (error: any) {
    dialogService.showError(error.message || '创建面板失败。');
  } finally {
    isCreating.value = false;
  }
};
</script>