<template>
  <DataListView
    view-id="api-channels"
    :fetcher="fetchChannels"
    :columns="columns"
    item-key="id"
    :initial-display-mode="'list'"
    :selectable="true"
    :show-refresh-button="true"
    :is-refreshing="isRefreshing"
    @refresh="handleRefresh"
    @selection-change="handleSelectionChange"
  >
    <template #header>
      <div class="flex flex-wrap gap-3 mb-4 sm:flex-row sm:justify-between sm:items-center">
        <h2 class="text-2xl font-bold text-text-base">API 渠道管理</h2>
        <button
          @click="$emit('create-channel')"
          class="px-4 py-2 font-medium text-primary-content bg-primary rounded-md hover:bg-primary/90 whitespace-nowrap"
        >
          新建渠道
        </button>
      </div>
    </template>

    <template #toolbar-actions="{ selectedItems }">
      <button
        v-if="selectedItems.length === 1"
        @click="handleTestConnection(selectedItems[0]!)"
        class="px-3 py-2 text-sm font-medium text-info bg-info-soft rounded-md hover:bg-info-soft/80 whitespace-nowrap"
        :disabled="isTestingConnection"
      >
        {{ isTestingConnection ? "测试中..." : "测试连接" }}
      </button>
      <button
        v-if="selectedItems.length > 0"
        @click="handleBatchDelete(selectedItems)"
        class="px-3 py-2 text-sm font-medium text-error bg-error-soft rounded-md hover:bg-error-soft/80 whitespace-nowrap"
      >
        批量删除 ({{ selectedItems.length }})
      </button>
    </template>

    <template #list-item="{ item }">
      <td class="px-3 py-2.5" :class="props.isDetailOpen ? 'w-[40%]' : 'w-[25%]'">
        <div class="flex items-center space-x-2">
          <div class="truncate" v-comfy-tooltip="item.label">
            {{ item.label }}
          </div>
          <span
            v-if="item.providerId && !props.isDetailOpen"
            class="inline-flex px-2 py-1 text-xs bg-primary-soft text-primary rounded-md"
          >
            {{ getProviderName(item.providerId) }}
          </span>
        </div>
      </td>
      <td class="px-3 py-2.5" :class="props.isDetailOpen ? 'w-[15%]' : 'w-[10%]'">
        <span
          :class="[
            'px-3 py-1 text-sm font-medium rounded-md whitespace-nowrap',
            item.disabled ? 'bg-error-soft text-error' : 'bg-success-soft text-success',
          ]"
        >
          {{ item.disabled ? "禁用" : "启用" }}
        </span>
      </td>
      <td v-if="!props.isDetailOpen" class="px-3 py-2.5 w-[25%] text-sm">
        <div class="truncate" v-comfy-tooltip="item.baseUrl">
          {{ item.baseUrl }}
        </div>
      </td>
      <td class="px-3 py-2.5" :class="props.isDetailOpen ? 'w-[45%]' : 'w-[40%]'">
        <div class="flex items-center space-x-2 flex-wrap gap-y-1">
          <BooleanToggle
            :model-value="!item.disabled"
            @update:model-value="handleToggleStatus(item, $event)"
            size="small"
            v-comfy-tooltip="item.disabled ? '点击启用' : '点击禁用'"
          />
          <button
            @click.stop="item.id && $emit('show-detail', item.id)"
            class="p-2 text-info hover:bg-info-soft rounded-md transition-colors"
            :disabled="!item.id"
            v-comfy-tooltip="'编辑/查看详情'"
          >
            <PencilIcon class="h-4 w-4" />
          </button>
          <button
            @click.stop="handleDelete(item)"
            class="p-2 text-error hover:bg-error-soft rounded-md transition-colors"
            v-comfy-tooltip="'删除'"
          >
            <TrashIcon class="h-4 w-4" />
          </button>
        </div>
      </td>
    </template>

    <template #grid-item="{ item }">
      <div
        class="bg-background-surface border border-border-base rounded-lg p-4 hover:border-primary transition-colors"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1 min-w-0">
            <h3 class="font-medium text-text-base truncate" v-comfy-tooltip="item.label">
              {{ item.label }}
            </h3>
            <p
              v-if="item.baseUrl"
              class="text-sm text-text-secondary truncate mt-1"
              v-comfy-tooltip="item.baseUrl"
            >
              {{ item.baseUrl }}
            </p>
          </div>
          <span
            :class="[
              'ml-2 px-2 py-1 text-xs font-medium rounded-md whitespace-nowrap',
              item.disabled ? 'bg-error-soft text-error' : 'bg-success-soft text-success',
            ]"
          >
            {{ item.disabled ? "禁用" : "启用" }}
          </span>
        </div>

        <div v-if="item.providerId" class="mb-3">
          <span class="inline-flex px-2 py-1 text-xs bg-primary-soft text-primary rounded-md">
            {{ getProviderName(item.providerId) }}
          </span>
        </div>

        <div class="flex items-center justify-between">
          <BooleanToggle
            :model-value="!item.disabled"
            @update:model-value="handleToggleStatus(item, $event)"
            size="small"
            v-comfy-tooltip="item.disabled ? '点击启用' : '点击禁用'"
          />
          <div class="flex items-center space-x-2">
            <button
              @click.stop="item.id && $emit('show-detail', item.id)"
              class="p-2 text-info hover:bg-info-soft rounded-md transition-colors"
              :disabled="!item.id"
              v-comfy-tooltip="'编辑/查看详情'"
            >
              <PencilIcon class="h-4 w-4" />
            </button>
            <button
              @click.stop="handleDelete(item)"
              class="p-2 text-error hover:bg-error-soft rounded-md transition-colors"
              v-comfy-tooltip="'删除'"
            >
              <TrashIcon class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </template>

    <template #empty>
      <div class="text-center p-8 border-2 border-dashed border-border-base rounded-lg">
        <p class="text-text-secondary mb-4">还没有配置任何 API 渠道。</p>
        <button
          @click="$emit('create-channel')"
          class="px-4 py-2 text-sm font-medium text-primary-content bg-primary rounded-md hover:bg-primary/90"
        >
          立即创建第一个
        </button>
      </div>
    </template>
  </DataListView>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { storeToRefs } from "pinia";
import { PencilIcon, TrashIcon } from "@heroicons/vue/24/outline";
import type { ApiCredentialConfig } from "@comfytavern/types";
import type { ColumnDefinition } from "@comfytavern/types";
import { useLlmConfigStore } from "@/stores/llmConfigStore";
import { useDialogService } from "@/services/DialogService";
import DataListView from "@/components/data-list/DataListView.vue";
import BooleanToggle from "@/components/graph/inputs/BooleanToggle.vue";

// Props & Emits
const props = defineProps<{
  isDetailOpen: boolean;
}>();

const emit = defineEmits<{
  "create-channel": [];
  "edit-channel": [channel: ApiCredentialConfig];
  "show-detail": [channelId: string];
  "selection-change": [selectedChannels: ApiCredentialConfig[]];
}>();

// Store & Services
const llmConfigStore = useLlmConfigStore();
const { channels, providers } = storeToRefs(llmConfigStore);
const dialogService = useDialogService();

// Local State
const isRefreshing = ref(false);
const isTestingConnection = ref(false);

// 列定义
const columns = computed<ColumnDefinition<ApiCredentialConfig>[]>(() => {
  if (props.isDetailOpen) {
    // 详情面板展开时的简化布局
    return [
      {
        key: "label",
        label: "渠道名称",
        sortable: true,
        width: "40%",
      },
      {
        key: "disabled",
        label: "状态",
        sortable: true,
        width: "15%",
      },
      {
        key: "actions",
        label: "操作",
        sortable: false,
        width: "45%",
      },
    ];
  }

  // 详情面板关闭时的完整布局
  return [
    {
      key: "label",
      label: "渠道名称",
      sortable: true,
      width: "25%",
    },
    {
      key: "disabled",
      label: "状态",
      sortable: true,
      width: "10%",
    },
    {
      key: "baseUrl",
      label: "Base URL",
      sortable: true,
      width: "25%",
    },
    {
      key: "actions",
      label: "操作",
      sortable: false,
      width: "40%",
    },
  ];
});

// 获取提供商名称
const getProviderName = (providerId: string) => {
  const provider = providers.value.find((p) => p.id === providerId);
  return provider?.name || providerId;
};

// 数据获取器，用于 DataListView
const fetchChannels = async () => {
  await llmConfigStore.fetchChannels();
  return channels.value;
};

// 事件处理器
const handleRefresh = async () => {
  isRefreshing.value = true;
  try {
    await llmConfigStore.fetchChannels();
  } finally {
    isRefreshing.value = false;
  }
};

const handleSelectionChange = (selectedChannels: ApiCredentialConfig[]) => {
  emit("selection-change", selectedChannels);
};

const handleDelete = async (channel: ApiCredentialConfig) => {
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
    } catch (error) {
      console.error("删除渠道失败:", error);
    }
  }
};

const handleBatchDelete = async (selectedChannels: ApiCredentialConfig[]) => {
  const confirmed = await dialogService.showConfirm({
    title: "批量删除确认",
    message: `您确定要删除选中的 ${selectedChannels.length} 个渠道吗？此操作不可撤销。`,
    dangerConfirm: true,
    confirmText: "删除",
  });

  if (confirmed) {
    try {
      for (const channel of selectedChannels) {
        if (channel.id) {
          await llmConfigStore.deleteChannel(channel.id);
        }
      }
      dialogService.showSuccess(`已成功删除 ${selectedChannels.length} 个渠道`);
    } catch (error) {
      console.error("批量删除失败:", error);
    }
  }
};

const handleToggleStatus = async (channel: ApiCredentialConfig, isEnabled: boolean) => {
  try {
    const updatedChannel = { ...channel, disabled: !isEnabled };
    await llmConfigStore.updateChannel(updatedChannel);
    dialogService.showSuccess(`渠道 "${channel.label}" 已${isEnabled ? "启用" : "禁用"}`);
  } catch (error) {
    console.error("切换渠道状态失败:", error);
    // 重新获取数据以恢复状态
    await llmConfigStore.fetchChannels();
  }
};

const handleTestConnection = async (channel: ApiCredentialConfig) => {
  if (!channel.id) return;

  isTestingConnection.value = true;
  try {
    // TODO: 实现连接测试 API
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 临时模拟
    dialogService.showSuccess(`渠道 "${channel.label}" 连接测试成功`);
  } catch (error) {
    dialogService.showError(`渠道 "${channel.label}" 连接测试失败`);
  } finally {
    isTestingConnection.value = false;
  }
};
</script>
