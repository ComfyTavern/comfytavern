<template>
  <div class="flex flex-col h-full p-6">
    <!-- Header -->
    <div class="flex justify-between items-center mb-4 pb-4 border-b border-border-base/50">
      <h1 class="text-2xl font-bold text-text-base">项目设置</h1>
      <button
        form="project-settings-form"
        type="submit"
        :disabled="!isChanged || isSaving"
        class="px-4 py-2 bg-primary text-primary-content rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span v-if="isSaving">保存中...</span>
        <span v-else>保存更改</span>
      </button>
    </div>

    <!-- Scrollable content -->
    <div class="overflow-y-auto flex-1 pr-2 custom-scrollbar">
      <form v-if="editableMetadata" id="project-settings-form" @submit.prevent="saveProject" class="max-w-4xl">
        <div class="divide-y divide-border-base/50">
          <!-- 项目名称 -->
          <div class="py-5 flex flex-col md:flex-row md:items-start gap-4 md:gap-8">
            <div class="md:w-1/3">
              <h4 class="font-medium text-text-base">项目名称</h4>
              <p class="text-sm text-text-secondary">项目在项目列表中显示的名称。</p>
            </div>
            <div class="flex-1">
              <input
                id="projectName"
                v-model="editableMetadata.name"
                type="text"
                class="block w-full px-3 py-2 bg-background-surface border border-border-base rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                required
              />
            </div>
          </div>

          <!-- 项目描述 -->
          <div class="py-5 flex flex-col md:flex-row md:items-start gap-4 md:gap-8">
            <div class="md:w-1/3">
              <h4 class="font-medium text-text-base">项目描述</h4>
              <p class="text-sm text-text-secondary">简要介绍这个项目是做什么的。</p>
            </div>
            <div class="flex-1">
              <textarea
                id="projectDescription"
                v-model="editableMetadata.description"
                rows="4"
                class="block w-full px-3 py-2 bg-background-surface border border-border-base rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              ></textarea>
            </div>
          </div>
        </div>
      </form>
      <div v-else class="text-text-muted">
        正在加载项目信息...
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { useProjectStore } from '@/stores/projectStore';
import { useDialogService } from '@/services/DialogService';
import type { ProjectMetadata } from '@comfytavern/types';
import { deepClone } from '@/utils/deepClone';

const projectStore = useProjectStore();
const dialogService = useDialogService();

const editableMetadata = ref<Partial<ProjectMetadata>>({});
const originalMetadata = ref<Partial<ProjectMetadata>>({});
const isSaving = ref(false);

onMounted(() => {
  if (projectStore.currentProjectMetadata) {
    editableMetadata.value = deepClone(projectStore.currentProjectMetadata);
    originalMetadata.value = deepClone(projectStore.currentProjectMetadata);
  }
});

watch(() => projectStore.currentProjectMetadata, (newProject) => {
  if (newProject) {
    editableMetadata.value = deepClone(newProject);
    originalMetadata.value = deepClone(newProject);
  }
}, { deep: true, immediate: true });

const isChanged = computed(() => {
  return JSON.stringify(editableMetadata.value) !== JSON.stringify(originalMetadata.value);
});

const saveProject = async () => {
  if (!isChanged.value || !editableMetadata.value.id) return;

  isSaving.value = true;
  try {
    // 假设 projectStore 中有 updateProject 方法
    await projectStore.updateProject(editableMetadata.value.id, {
      name: editableMetadata.value.name,
      description: editableMetadata.value.description,
    });
    dialogService.showSuccess('项目信息已更新');
    // 更新原始数据以反映更改
    originalMetadata.value = deepClone(editableMetadata.value);
  } catch (error: any) {
    dialogService.showError(error.message || '更新项目失败');
  } finally {
    isSaving.value = false;
  }
};
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background-color: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: hsl(var(--border));
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: hsl(var(--border) / 0.8);
}

/* For Firefox */
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border)) transparent;
}
</style>