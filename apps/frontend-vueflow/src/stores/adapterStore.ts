import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { ApiAdapter, CreateApiAdapterPayload, UpdateApiAdapterPayload } from '@comfytavern/types';
import { useProjectStore } from './projectStore';
import { adapterApi } from '@/api/adapterApi'; // 导入真实的API

export const useAdapterStore = defineStore('adapter', () => {
  const projectStore = useProjectStore();

  const adapters = ref<ApiAdapter[]>([]);
  const isLoading = ref(false);
  const error = ref<Error | null>(null);

  const currentProjectId = computed(() => projectStore.currentProjectId);

  const adaptersById = computed(() => {
    return adapters.value.reduce((acc, adapter) => {
      acc[adapter.id] = adapter;
      return acc;
    }, {} as Record<string, ApiAdapter>);
  });

  function getAdapter(id: string) {
    return adaptersById.value[id];
  }

  async function fetchAdapters(force = false) {
    if (!currentProjectId.value) {
      adapters.value = [];
      return;
    }
    // 强制刷新或从未加载过
    if (force || adapters.value.length === 0) {
      isLoading.value = true;
      error.value = null;
      try {
        adapters.value = await adapterApi.list(currentProjectId.value);
      } catch (e) {
        error.value = e as Error;
        adapters.value = [];
      } finally {
        isLoading.value = false;
      }
    }
  }

  async function createAdapter(payload: CreateApiAdapterPayload): Promise<ApiAdapter | undefined> {
    if (!currentProjectId.value) throw new Error('没有活动的工程');
    isLoading.value = true;
    try {
      const newAdapter = await adapterApi.create(currentProjectId.value, payload);
      adapters.value.push(newAdapter);
      return newAdapter;
    } catch (e) {
      error.value = e as Error;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateAdapter(id: string, payload: UpdateApiAdapterPayload): Promise<ApiAdapter | undefined> {
    if (!currentProjectId.value) throw new Error('没有活动的工程');
    isLoading.value = true;
    try {
      const updatedAdapter = await adapterApi.update(currentProjectId.value, id, payload);
      const index = adapters.value.findIndex(a => a.id === id);
      if (index !== -1) {
        adapters.value[index] = updatedAdapter;
      } else {
        // 如果本地没有，可能是一个新同步的，直接添加
        adapters.value.push(updatedAdapter);
      }
      return updatedAdapter;
    } catch (e) {
      error.value = e as Error;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }
  
  async function deleteAdapter(id: string) {
    if (!currentProjectId.value) throw new Error('没有活动的工程');
    isLoading.value = true;
    try {
      await adapterApi.remove(currentProjectId.value, id); // 使用正确的 'remove' 方法
      adapters.value = adapters.value.filter(a => a.id !== id);
    } catch (e) {
      error.value = e as Error;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  // 当项目改变时，清空适配器列表
  watch(currentProjectId, (newId, oldId) => {
    if (newId !== oldId) {
      adapters.value = [];
      // 可以选择立即获取新项目的适配器
      if(newId) {
        fetchAdapters(true);
      }
    }
  });

  return {
    adapters,
    isLoading,
    error,
    adaptersById,
    getAdapter,
    fetchAdapters,
    createAdapter,
    updateAdapter,
    deleteAdapter,
  };
});