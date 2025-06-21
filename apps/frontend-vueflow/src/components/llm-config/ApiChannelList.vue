<template>
  <div class="api-channel-list">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-2xl font-bold text-text-base">API 渠道管理</h2>
      <button @click="openAddModal"
        class="px-4 py-2 text-sm font-medium text-primary-content bg-primary rounded-md hover:bg-primary/90">
        &#43; 新建渠道
      </button>
    </div>

    <div v-if="isLoadingChannels" class="text-center p-8">
      <p>正在加载渠道列表...</p>
    </div>

    <div v-else-if="channels.length === 0" class="text-center p-8 border-2 border-dashed border-border-base rounded-lg">
      <p class="text-text-secondary">还没有配置任何 API 渠道。</p>
      <button @click="openAddModal" class="btn btn-primary mt-4">立即创建第一个</button>
    </div>

    <div v-else class="overflow-x-auto bg-background-surface rounded-lg shadow">
      <table class="table-auto w-full text-left">
        <thead class="bg-neutral-softest">
          <tr>
            <th class="p-4 font-semibold">渠道名称</th>
            <th class="p-4 font-semibold">状态</th>
            <th class="p-4 font-semibold">Base URL</th>
            <th class="p-4 font-semibold text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="channel in channels" :key="channel.id"
            class="border-t border-border-base hover:bg-primary-softest transition-colors">
            <td class="p-4">{{ channel.label }}</td>
            <td class="p-4">
              <span :class="[
                'px-2 py-1 text-xs font-semibold rounded-full',
                channel.disabled
                  ? 'bg-error-soft text-error'
                  : 'bg-success-soft text-success',
              ]">
                {{ channel.disabled ? "禁用" : "启用" }}
              </span>
            </td>
            <td class="p-4 text-sm">{{ channel.baseUrl }}</td>
            <td class="p-4 text-center">
              <button @click="openEditModal(channel)"
                class="px-3 py-1 text-sm font-medium text-primary bg-primary-soft rounded-md hover:bg-primary-soft/80 mr-2">
                编辑
              </button>
              <button @click="confirmDelete(channel)"
                class="px-3 py-1 text-sm font-medium text-error bg-error-soft rounded-md hover:bg-error-soft/80">
                删除
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit Modal -->
    <BaseModal :visible="isModalOpen" @close="closeModal" width="680px" height="80vh">
      <template #header>
        <h3 class="text-lg font-medium leading-6 text-text-base">
          {{ editingChannel ? "编辑 API 渠道" : "新建 API 渠道" }}
        </h3>
      </template>

      <ApiChannelForm
        :initial-data="editingChannel"
        @submit="handleFormSubmit"
        @cancel="closeModal"
        @validity-change="isFormForFooterValid = $event"
        :key="editingChannel ? editingChannel.id : 'new'"
      />

      <template #footer>
        <div class="flex justify-end space-x-3 w-full">
          <button
            type="button"
            @click="closeModal"
            class="px-4 py-2 text-sm font-medium text-text-secondary bg-background-surface border border-border-base rounded-md hover:bg-neutral-softest transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            form="api-channel-form"
            :disabled="!isFormForFooterValid"
            class="px-4 py-2 text-sm font-medium text-primary-content bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            保存
          </button>
        </div>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useLlmConfigStore } from "@/stores/llmConfigStore";
import { storeToRefs } from "pinia";
import { useDialogService } from "@/services/DialogService";
import type { ApiCredentialConfig } from "@comfytavern/types";
import BaseModal from "@/components/common/BaseModal.vue";
import ApiChannelForm from "./ApiChannelForm.vue";
import type { ApiChannelFormData } from "./ApiChannelForm.vue";

const llmConfigStore = useLlmConfigStore();
const { channels, isLoadingChannels } = storeToRefs(llmConfigStore);
const dialogService = useDialogService();

const isModalOpen = ref(false);
const editingChannel = ref<ApiCredentialConfig | null>(null);
const isFormForFooterValid = ref(false);

const openAddModal = () => {
  editingChannel.value = null;
  isModalOpen.value = true;
};

const openEditModal = (channel: ApiCredentialConfig) => {
  editingChannel.value = { ...channel };
  isModalOpen.value = true;
};

const confirmDelete = async (channel: ApiCredentialConfig) => {
  if (!channel.id) return;
  const confirmed = await dialogService.showConfirm({
    title: "确认删除",
    message: `您确定要删除渠道 "${channel.label}" 吗？此操作不可撤销。`,
    dangerConfirm: true,
    confirmText: "删除",
  });

  if (confirmed) {
    try {
      await llmConfigStore.deleteChannel(channel.id);
      dialogService.showSuccess("渠道已成功删除。");
    } catch (error) {
      // The store already shows an error toast
      console.error("删除渠道失败:", error);
    }
  }
};

const closeModal = () => {
  isModalOpen.value = false;
  editingChannel.value = null;
};

const handleFormSubmit = async (formData: ApiChannelFormData) => {
  try {
    if (editingChannel.value && editingChannel.value.id) {
      // Editing existing channel
      const dataToUpdate = { ...formData, id: editingChannel.value.id };
      await llmConfigStore.updateChannel(dataToUpdate as ApiCredentialConfig);
      dialogService.showSuccess("API 渠道已成功更新！");
    } else {
      // Adding new channel
      await llmConfigStore.addChannel(formData);
      dialogService.showSuccess("API 渠道已成功创建！");
    }
    closeModal();
  } catch (error) {
    // The store already shows an error toast, so we just log it here
    console.error("保存 API 渠道失败:", error);
  }
};
</script>
