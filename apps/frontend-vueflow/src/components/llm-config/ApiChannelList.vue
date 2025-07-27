<template>
  <div class="api-channel-list">
    <div class="flex flex-wrap gap-3 mb-4 sm:flex-row sm:justify-between sm:items-center">
      <h2 class="text-2xl font-bold text-text-base">API 渠道管理</h2>
      <button @click="openAddModal"
        class="px-4 py-2 text-sm font-medium text-primary-content bg-primary rounded-md hover:bg-primary/90 whitespace-nowrap self-start">
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

    <div v-else>
      <!-- 表格视图 - 当容器宽度足够时 -->
      <div v-if="containerWidth >= 680" class="overflow-x-auto bg-background-surface rounded-lg shadow">
        <table class="table-fixed w-full text-left min-w-[680px]">
          <thead class="bg-neutral-softest">
            <tr>
              <th class="w-1/4 p-4 font-semibold">渠道名称</th>
              <th class="w-20 p-4 font-semibold">状态</th>
              <th class="w-1/4 p-4 font-semibold">Base URL</th>
              <th class="w-1/3 p-4 font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="channel in channels" :key="channel.id"
              class="border-t border-border-base hover:bg-primary-softest transition-colors">
              <td class="p-4">
                <div class="truncate" v-comfy-tooltip="channel.label">
                  {{ channel.label }}
                </div>
              </td>
              <td class="p-4">
                <span :class="[
                  'px-3 py-1 text-sm font-medium rounded-md whitespace-nowrap',
                  channel.disabled
                    ? 'bg-error-soft text-error'
                    : 'bg-success-soft text-success',
                ]">
                  {{ channel.disabled ? "禁用" : "启用" }}
                </span>
              </td>
              <td class="p-4 text-sm">
                <div class="truncate" v-comfy-tooltip="channel.baseUrl">
                  {{ channel.baseUrl }}
                </div>
              </td>
              <td class="p-4">
                <div class="flex items-center space-x-2 flex-wrap gap-y-1">
                  <BooleanToggle
                    :model-value="!channel.disabled"
                    @update:model-value="toggleChannelStatus(channel, $event)"
                    size="small"
                    v-comfy-tooltip="channel.disabled ? '点击启用' : '点击禁用'"
                  />
                  <button @click="openEditModal(channel)"
                    class="px-3 py-1 text-sm font-medium text-primary bg-primary-soft rounded-md hover:bg-primary-soft/80 whitespace-nowrap flex-shrink-0">
                    编辑
                  </button>
                  <button @click="confirmDelete(channel)"
                    class="px-3 py-1 text-sm font-medium text-error bg-error-soft rounded-md hover:bg-error-soft/80 whitespace-nowrap flex-shrink-0">
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 卡片视图 - 当容器宽度不够时 -->
      <div v-else class="space-y-4">
        <div v-for="channel in channels" :key="channel.id"
          class="bg-background-surface rounded-lg shadow p-4 border border-border-base">
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-text-base truncate" v-comfy-tooltip="channel.label">
                {{ channel.label }}
              </h3>
              <div class="mt-1">
                <span :class="[
                  'inline-flex px-2 py-1 text-xs font-medium rounded-md',
                  channel.disabled
                    ? 'bg-error-soft text-error'
                    : 'bg-success-soft text-success',
                ]">
                  {{ channel.disabled ? "禁用" : "启用" }}
                </span>
              </div>
            </div>
            <BooleanToggle
              :model-value="!channel.disabled"
              @update:model-value="toggleChannelStatus(channel, $event)"
              size="small"
              v-comfy-tooltip="channel.disabled ? '点击启用' : '点击禁用'"
              class="ml-3 flex-shrink-0"
            />
          </div>
          
          <div class="mb-3">
            <label class="text-xs font-medium text-text-secondary uppercase tracking-wide">Base URL</label>
            <div class="mt-1 text-sm text-text-base break-all" v-comfy-tooltip="channel.baseUrl">
              {{ channel.baseUrl }}
            </div>
          </div>
          
          <div class="flex items-center space-x-2">
            <button @click="openEditModal(channel)"
              class="flex-1 px-3 py-2 text-sm font-medium text-primary bg-primary-soft rounded-md hover:bg-primary-soft/80 text-center">
              编辑
            </button>
            <button @click="confirmDelete(channel)"
              class="flex-1 px-3 py-2 text-sm font-medium text-error bg-error-soft rounded-md hover:bg-error-soft/80 text-center">
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <BaseModal :visible="isModalOpen" @close="closeModal" width="680px" height="80vh">
      <template #header>
        <h3 class="text-lg font-medium leading-6 text-text-base">
          {{ editingChannel ? "编辑 API 渠道" : "新建 API 渠道" }}
        </h3>
      </template>

      <template #content>
        <ApiChannelForm
          :initial-data="editingChannel"
          @submit="handleFormSubmit"
          @cancel="closeModal"
          @validity-change="isFormForFooterValid = $event"
          :key="editingChannel ? editingChannel.id : 'new'"
        />
      </template>

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
import { ref, onMounted, onUnmounted } from "vue";
import { useLlmConfigStore } from "@/stores/llmConfigStore";
import { storeToRefs } from "pinia";
import { useDialogService } from "@/services/DialogService";
import type { ApiCredentialConfig } from "@comfytavern/types";
import BaseModal from "@/components/common/BaseModal.vue";
import ApiChannelForm from "./ApiChannelForm.vue";
import type { ApiChannelFormData } from "./ApiChannelForm.vue";
import BooleanToggle from "@/components/graph/inputs/BooleanToggle.vue";

const llmConfigStore = useLlmConfigStore();
const { channels, isLoadingChannels } = storeToRefs(llmConfigStore);
const dialogService = useDialogService();

const isModalOpen = ref(false);
const editingChannel = ref<ApiCredentialConfig | null>(null);
const isFormForFooterValid = ref(false);

const containerRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);

const observer = new ResizeObserver(entries => {
  if (entries[0]) {
    containerWidth.value = entries[0].contentRect.width;
  }
});

onMounted(() => {
  if (containerRef.value) {
    observer.observe(containerRef.value);
    containerWidth.value = containerRef.value.offsetWidth;
  }
});

onUnmounted(() => {
  if (containerRef.value) {
    observer.unobserve(containerRef.value);
  }
});

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

const toggleChannelStatus = async (channel: ApiCredentialConfig, isEnabled: boolean) => {
  try {
    const updatedChannel = { ...channel, disabled: !isEnabled };
    await llmConfigStore.updateChannel(updatedChannel);
    dialogService.showSuccess(`渠道 "${channel.label}" 已${isEnabled ? '启用' : '禁用'}`);
  } catch (error) {
    // The store already shows an error toast
    console.error(`切换渠道状态失败:`, error);
    // Revert the toggle on error
    await llmConfigStore.fetchChannels();
  }
};
</script>
