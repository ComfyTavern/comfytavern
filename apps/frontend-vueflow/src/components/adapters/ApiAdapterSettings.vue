<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAdapterStore } from '@/stores/adapterStore';
import { storeToRefs } from 'pinia';
import { useDialogService } from '@/services/DialogService';
import ApiAdapterEditor from './ApiAdapterEditor.vue';
import type { ApiAdapter, CreateApiAdapterPayload, UpdateApiAdapterPayload } from '@comfytavern/types';

const adapterStore = useAdapterStore();
const { adapters, isLoading, error } = storeToRefs(adapterStore);
const dialogService = useDialogService();

const isEditorVisible = ref(false);
const editingAdapter = ref<ApiAdapter | null>(null);

onMounted(() => {
  adapterStore.fetchAdapters(true); // 强制获取最新数据
});

const handleAddAdapter = () => {
  editingAdapter.value = null; // 清空以表示创建模式
  isEditorVisible.value = true;
};

const handleEditAdapter = (adapter: ApiAdapter) => {
  editingAdapter.value = adapter;
  isEditorVisible.value = true;
};

const handleSaveAdapter = async (formData: CreateApiAdapterPayload | UpdateApiAdapterPayload) => {
  try {
    if (editingAdapter.value) {
      // 更新模式
      await adapterStore.updateAdapter(editingAdapter.value.id, formData as UpdateApiAdapterPayload);
      dialogService.showSuccess('适配器已更新');
    } else {
      // 创建模式
      await adapterStore.createAdapter(formData as CreateApiAdapterPayload);
      dialogService.showSuccess('适配器已创建');
    }
  } catch (e: any) {
    dialogService.showError(`保存失败: ${e.message}`);
  }
  isEditorVisible.value = false;
};

const handleDeleteAdapter = async (adapterId: string, adapterName: string) => {
  const confirmed = await dialogService.showConfirm({
    title: '确认删除',
    message: `您确定要删除适配器 "${adapterName}" 吗？此操作不可撤销。`,
    dangerConfirm: true,
    confirmText: '删除',
  });

  if (confirmed) {
    try {
      await adapterStore.deleteAdapter(adapterId);
      dialogService.showSuccess(`适配器 "${adapterName}" 已删除。`);
    } catch (e: any) {
      dialogService.showError(`删除失败: ${e.message}`);
    }
  }
};
</script>

<template>
  <div class="p-4 space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold">API 适配器管理</h2>
      <button
        @click="handleAddAdapter"
        class="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
      >
        新增适配器
      </button>
    </div>

    <div v-if="isLoading" class="text-center">正在加载...</div>
    <div v-if="error" class="p-4 text-red-700 bg-red-100 rounded-md">
      加载适配器失败: {{ error.message }}
    </div>

    <div v-if="!isLoading && adapters.length > 0" class="space-y-2">
      <div 
        v-for="adapter in adapters" 
        :key="adapter.id"
        class="flex items-center p-3 transition bg-white rounded-lg shadow-sm dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <div class="flex-grow">
          <p class="font-bold">{{ adapter.name }}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            ID: {{ adapter.id }} | 类型: {{ adapter.adapterType }}
          </p>
           <p class="text-sm text-gray-500 dark:text-gray-400">
            目标工作流: {{ adapter.targetWorkflowId }}
          </p>
        </div>
        <div class="space-x-2">
          <button @click="handleEditAdapter(adapter)" class="text-blue-600 hover:text-blue-800">编辑</button>
          <button @click="handleDeleteAdapter(adapter.id, adapter.name)" class="text-red-600 hover:text-red-800">删除</button>
        </div>
      </div>
    </div>
    <div v-if="!isLoading && adapters.length === 0 && !error" class="text-center text-gray-500">
      暂无适配器，请点击“新增适配器”来创建一个。
    </div>

    <!-- 适配器编辑器模态框 -->
    <ApiAdapterEditor
      v-model="isEditorVisible"
      :adapter="editingAdapter"
      @save="handleSaveAdapter"
    />
  </div>
</template>