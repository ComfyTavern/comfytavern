<template>
  <div class="min-h-[60vh] flex flex-col">
    <!-- 模板列表视图 -->
    <div v-if="!selectedTemplate" class="flex flex-col h-full">
      <h2 class="text-xl font-semibold mb-6">从模板创建面板</h2>
      <div v-if="isLoading" class="text-center py-10">正在加载模板...</div>
      <div v-else-if="loadError" class="text-center text-red-500 py-10">{{ loadError }}</div>
      <div v-else-if="templates.length === 0" class="text-center text-text-secondary p-12 border border-dashed rounded-md">
        当前没有可用的面板模板。
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto flex-grow p-1">
        <PanelCard
          v-for="template in templates"
          :key="template.id"
          :item="template"
          @select="selectTemplate(template)"
        />
      </div>
    </div>

    <!-- 模板详情视图 -->
    <div v-else class="flex flex-col h-full">
      <div class="flex items-center mb-4">
        <button @click="goBackToList" class="p-1 rounded-full hover:bg-background-hover mr-3">
          <ArrowLeftIcon class="w-5 h-5" />
        </button>
        <h2 class="text-xl font-semibold">创建自: {{ selectedTemplate.displayName }}</h2>
      </div>

      <form @submit.prevent="handleSubmit" class="flex-grow flex flex-col">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow">
          <!-- Left side: Screenshot -->
          <div class="flex flex-col items-center justify-center bg-muted rounded-lg p-4">
            <PhotoIcon class="w-24 h-24 text-muted-foreground/50" />
            <p class="mt-2 text-sm text-muted-foreground">模板截图预览</p>
          </div>

          <!-- Right side: Info and Form -->
          <div class="space-y-4 text-left">
            <div>
              <h3 class="font-semibold text-lg">{{ selectedTemplate.displayName }}</h3>
              <p class="text-sm text-text-secondary mt-1">{{ selectedTemplate.description }}</p>
            </div>
            <div class="border-t border-border-base pt-4">
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
        </div>

        <div class="mt-6 flex justify-end space-x-3 pt-4 border-t border-border-base">
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { usePanelStore } from '@/stores/panelStore';
import type { PanelDefinition } from '@comfytavern/types';
import { useDialogService } from '@/services/DialogService';
import { toSlug } from '@/utils/textUtils';
import PanelCard from './PanelCard.vue';
import { ArrowLeftIcon, PhotoIcon } from '@heroicons/vue/24/outline';

const props = defineProps<{
  projectId: string;
}>();

const emit = defineEmits(['close', 'created']);

const panelStore = usePanelStore();
const dialogService = useDialogService();

const templates = ref<PanelDefinition[]>([]);
const isLoading = ref(true);
const loadError = ref<string | null>(null);
const isCreating = ref(false);

const panelName = ref('');
const panelId = ref('');
const selectedTemplate = ref<PanelDefinition | null>(null);

watch(panelName, (newName: string) => {
  panelId.value = toSlug(newName);
});

const selectTemplate = (template: PanelDefinition) => {
  selectedTemplate.value = template;
  panelName.value = template.displayName; // 自动填充名称
};

const goBackToList = () => {
  selectedTemplate.value = null;
};

const handleSubmit = async () => {
  if (!panelName.value || !panelId.value || !selectedTemplate.value) {
    return;
  }

  isCreating.value = true;
  try {
    await panelStore.createPanel(props.projectId, {
      templateId: selectedTemplate.value.id,
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

onMounted(async () => {
  try {
    templates.value = await panelStore.fetchPanelTemplates();
  } catch (error: any) {
    loadError.value = error.message || '无法加载面板模板。';
  } finally {
    isLoading.value = false;
  }
});
</script>