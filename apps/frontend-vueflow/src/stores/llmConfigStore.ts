import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ApiCredentialConfig, ActivatedModelInfo } from '@comfytavern/types';
import type { ApiChannelFormData } from '@/components/llm-config/ApiChannelForm.vue';
import * as llmConfigApi from '@/api/llmConfigApi';
import { useDialogService } from '@/services/DialogService';

export const useLlmConfigStore = defineStore('llmConfig', () => {
  const dialogService = useDialogService();

  // --- State ---
  const channels = ref<ApiCredentialConfig[]>([]);
  const activatedModels = ref<ActivatedModelInfo[]>([]);
  const providers = ref<{ id: string; name: string }[]>([]);
  const isLoadingChannels = ref(false);
  const isLoadingModels = ref(false);
  const isLoadingProviders = ref(false);
  const error = ref<string | null>(null);

  // --- Getters ---
  const channelOptions = computed(() =>
    channels.value.map(c => ({ label: c.label, value: c.id }))
  );

  // --- Actions ---

  // Channel Actions
  const fetchChannels = async () => {
    isLoadingChannels.value = true;
    error.value = null;
    try {
      channels.value = await llmConfigApi.getApiChannels();
    } catch (e: any) {
      const errorMessage = e.message || 'Failed to fetch API channels.';
      error.value = errorMessage;
      dialogService.showError(errorMessage, '加载失败');
    } finally {
      isLoadingChannels.value = false;
    }
  };

  const saveChannel = async (channelData: Partial<ApiCredentialConfig>) => {
    try {
      await llmConfigApi.saveApiChannel(channelData);
      dialogService.showSuccess('API 渠道已保存');
      await fetchChannels(); // Refresh list
    } catch (e: any) {
      const errorMessage = e.message || 'Failed to save API channel.';
      dialogService.showError(errorMessage, '保存失败');
      throw new Error(errorMessage);
    }
  };

  const addChannel = async (channelData: ApiChannelFormData) => {
    try {
      // The user ID will be injected by the backend based on the session/token
      const newChannel = await llmConfigApi.saveApiChannel(channelData);
      channels.value.unshift(newChannel); // Add to the beginning of the list for immediate visibility
    } catch (e: any) {
      const errorMessage = e.message || 'Failed to add API channel.';
      dialogService.showError(errorMessage, '添加失败');
      throw new Error(errorMessage); // Re-throw to be caught by the component
    }
  };

  const updateChannel = async (channelData: ApiCredentialConfig) => {
    try {
      const updatedChannel = await llmConfigApi.saveApiChannel(channelData);
      const index = channels.value.findIndex(c => c.id === updatedChannel.id);
      if (index !== -1) {
        channels.value[index] = updatedChannel;
      }
    } catch (e: any) {
      const errorMessage = e.message || 'Failed to update API channel.';
      dialogService.showError(errorMessage, '更新失败');
      throw new Error(errorMessage);
    }
  };

  const deleteChannel = async (id: string) => {
    try {
      await llmConfigApi.deleteApiChannel(id);
      dialogService.showSuccess('API 渠道已删除');
      await fetchChannels(); // Refresh list
    } catch (e: any) {
      const errorMessage = e.message || 'Failed to delete API channel.';
      dialogService.showError(errorMessage, '删除失败');
      throw new Error(errorMessage);
    }
  };

  const fetchProviders = async () => {
    isLoadingProviders.value = true;
    error.value = null;
    try {
      providers.value = await llmConfigApi.getProviders();
    } catch (e: any) {
      const errorMessage = e.message || 'Failed to fetch providers.';
      error.value = errorMessage;
      dialogService.showError(errorMessage, '加载提供商列表失败');
    } finally {
      isLoadingProviders.value = false;
    }
  };

  // Model Actions
  const fetchModels = async () => {
    isLoadingModels.value = true;
    error.value = null;
    try {
      activatedModels.value = await llmConfigApi.getActivatedModels();
    } catch (e: any) {
      const errorMessage = e.message || 'Failed to fetch activated models.';
      error.value = errorMessage;
      dialogService.showError(errorMessage, '加载失败');
    } finally {
      isLoadingModels.value = false;
    }
  };

  const addModel = async (modelData: Omit<ActivatedModelInfo, 'id' | 'createdAt'>) => {
    try {
      await llmConfigApi.addActivatedModel(modelData);
      dialogService.showSuccess('模型已添加');
      await fetchModels(); // Refresh list
    } catch (e: any) {
      const errorMessage = e.message || 'Failed to add model.';
      dialogService.showError(errorMessage, '添加失败');
      throw new Error(errorMessage);
    }
  };

  const updateModel = async (id: string, modelData: Partial<Omit<ActivatedModelInfo, 'id' | 'createdAt'>>) => {
    try {
      await llmConfigApi.updateActivatedModel(id, modelData);
      dialogService.showSuccess('模型已更新');
      await fetchModels(); // Refresh list
    } catch (e: any) {
      const errorMessage = e.message || 'Failed to update model.';
      dialogService.showError(errorMessage, '更新失败');
      throw new Error(errorMessage);
    }
  };

  const deleteModel = async (id: string) => {
    try {
      await llmConfigApi.deleteActivatedModel(id);
      dialogService.showSuccess('模型已删除');
      await fetchModels(); // Refresh list
    } catch (e: any) {
      const errorMessage = e.message || 'Failed to delete model.';
      dialogService.showError(errorMessage, '删除失败');
      throw new Error(errorMessage);
    }
  };

  const discoverModels = async (channelId: string) => {
    try {
      const models = await llmConfigApi.discoverModelsFromChannel(channelId);
      return models.map(model => ({
        id: model.id,
        name: model.id, // Usually model.id is the name
        displayName: model.name || model.id,
        description: model.description || '',
        capabilities: model.capabilities || []
      }));
    } catch (e: any) {
      const errorMessage = e.message || 'Failed to discover models.';
      dialogService.showError(errorMessage, '模型发现失败');
      throw new Error(errorMessage);
    }
  };

  return {
    // State
    channels,
    activatedModels,
    providers,
    isLoadingChannels,
    isLoadingModels,
    isLoadingProviders,
    error,
    // Getters
    channelOptions,
    // Actions
    fetchChannels,
    saveChannel,
    addChannel,
    updateChannel,
    deleteChannel,
    fetchModels,
    addModel,
    updateModel,
    deleteModel,
    discoverModels,
    fetchProviders,
  };
});