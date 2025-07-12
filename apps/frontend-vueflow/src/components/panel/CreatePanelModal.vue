<template>
  <BaseModal :visible="visible" @update:visible="!$event && closeModal()" title="新建面板">
    <div class="p-8 text-center">
      <div v-if="selection === null">
        <h2 class="text-xl font-semibold mb-6">请选择创建方式</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            @click="selection = 'new'"
            class="p-8 border-2 border-border-base rounded-xl cursor-pointer hover:border-primary hover:bg-primary/10 transition-all duration-200 flex flex-col items-center justify-center aspect-square"
          >
            <i class="bi bi-plus-square-dotted text-5xl mb-4 text-primary"></i>
            <h3 class="font-semibold text-lg">全新创建</h3>
            <p class="text-sm text-text-secondary mt-1">创建一个空白面板</p>
          </div>
          <div
            @click="selection = 'template'"
            class="p-8 border-2 border-border-base rounded-xl cursor-pointer hover:border-primary hover:bg-primary/10 transition-all duration-200 flex flex-col items-center justify-center aspect-square"
          >
            <i class="bi bi-grid-1x2 text-5xl mb-4 text-primary"></i>
            <h3 class="font-semibold text-lg">从模板创建</h3>
            <p class="text-sm text-text-secondary mt-1">从预设模板开始</p>
          </div>
        </div>
      </div>

      <div v-else>
        <button @click="selection = null" class="absolute top-4 left-4 text-text-secondary hover:text-text-base">
          <i class="bi bi-arrow-left"></i> 返回
        </button>
        <CreateNewPanelModal v-if="selection === 'new'" :project-id="projectId" @close="closeModal" @created="panelCreated" />
        <CreatePanelFromTemplateModal v-if="selection === 'template'" :project-id="projectId" @close="closeModal" @created="panelCreated" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import BaseModal from '@/components/common/BaseModal.vue';
import CreateNewPanelModal from '@/components/panel/CreateNewPanelModal.vue';
import CreatePanelFromTemplateModal from '@/components/panel/CreatePanelFromTemplateModal.vue';

defineProps<{
  visible: boolean;
  projectId: string;
}>();

const emit = defineEmits(['update:visible', 'created']);

const selection = ref<'new' | 'template' | null>(null);

const closeModal = () => {
  selection.value = null;
  emit('update:visible', false);
};

const panelCreated = () => {
  emit('created');
  closeModal();
};
</script>