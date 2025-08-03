<template>
  <div class="api-channel-detail-view h-full flex flex-col bg-background-surface">
    <!-- Header with close button -->
    <div class="flex items-center justify-between p-4 border-b border-border-base">
      <h3 class="text-lg font-semibold text-text-base">
        {{ isNewChannel ? "新建渠道" : `编辑渠道: ${channelData?.label || ""}` }}
      </h3>
      <button
        @click="$emit('close')"
        class="p-2 text-text-secondary hover:text-text-base hover:bg-background-base rounded-md transition-colors"
        v-comfy-tooltip="'关闭详情面板'"
      >
        <ChevronLeftIcon class="h-5 w-5" />
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-auto p-4 space-y-6">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <div class="text-center">
          <ArrowPathIcon class="h-8 w-8 animate-spin text-primary mx-auto" />
          <p class="mt-2 text-text-muted">正在加载...</p>
        </div>
      </div>

      <!-- Channel Form Section -->
      <div v-else-if="channelData || isNewChannel" class="space-y-6">
        <section>
          <h4 class="text-md font-medium text-text-base mb-4">基本信息</h4>
          <ApiChannelForm
            :initial-data="channelData"
            @submit="handleChannelSubmit"
            @cancel="$emit('close')"
          />
        </section>

        <!-- Model Management Section (only for existing channels) -->
        <section v-if="!isNewChannel && channelData?.id">
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-md font-medium text-text-base">模型管理</h4>
            <button
              @click="handleDiscoverModels"
              :disabled="isDiscoveringModels"
              class="px-4 py-2 text-sm font-medium text-primary-content bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ isDiscoveringModels ? "发现中..." : "🔍 发现模型" }}
            </button>
          </div>

          <!-- Discovered Models List -->
          <div v-if="discoveredModels.length > 0" class="space-y-3">
            <p class="text-sm text-text-secondary">
              在此渠道上发现了 {{ discoveredModels.length }} 个模型。点击开关来激活或禁用模型。
            </p>

            <div class="bg-background-base rounded-lg border border-border-base">
              <div class="max-h-96 overflow-auto">
                <div
                  v-for="model in discoveredModels"
                  :key="model.id"
                  class="flex items-center justify-between p-3 border-b border-border-base last:border-b-0 hover:bg-background-surface/50"
                >
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center space-x-2">
                      <h5 class="font-medium text-text-base truncate">
                        {{ model.displayName || model.name }}
                      </h5>
                      <span
                        v-if="isModelActivated(model.id)"
                        class="inline-flex px-2 py-1 text-xs bg-success-soft text-success rounded-md"
                      >
                        已激活
                      </span>
                    </div>
                    <p v-if="model.description" class="text-sm text-text-secondary mt-1 truncate">
                      {{ model.description }}
                    </p>
                    <div
                      v-if="model.capabilities && model.capabilities.length > 0"
                      class="flex flex-wrap gap-1 mt-2"
                    >
                      <span
                        v-for="capability in model.capabilities"
                        :key="capability"
                        class="inline-flex px-2 py-1 text-xs bg-primary-softest text-primary rounded-md"
                      >
                        {{ capability }}
                      </span>
                    </div>
                  </div>

                  <div class="flex items-center space-x-2 ml-4">
                    <BooleanToggle
                      :model-value="isModelActivated(model.id)"
                      @update:model-value="handleToggleModel(model, $event)"
                      size="small"
                      :disabled="isTogglingModel"
                    />
                    <button
                      v-if="isModelActivated(model.id)"
                      @click="handleEditModel(model)"
                      class="px-2 py-1 text-xs font-medium text-info bg-info-soft rounded-md hover:bg-info-soft/80"
                    >
                      编辑
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- No Models Found -->
          <div v-else-if="hasDiscovered" class="text-center py-8 text-text-secondary">
            <p>在此渠道上未发现任何模型。</p>
            <p class="text-sm mt-1">请检查渠道配置是否正确，或稍后重试。</p>
          </div>

          <!-- Discover Prompt -->
          <div
            v-else
            class="text-center py-8 text-text-secondary border-2 border-dashed border-border-base rounded-lg"
          >
            <p>点击上方的"发现模型"按钮来获取此渠道支持的模型列表。</p>
          </div>
        </section>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-8 text-error">
        <ExclamationCircleIcon class="h-12 w-12 mx-auto mb-2" />
        <p>{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { storeToRefs } from "pinia";
import type { ApiCredentialConfig } from "@comfytavern/types";
import type { ApiChannelFormData } from "@/components/llm-config/ApiChannelForm.vue";
import { useLlmConfigStore } from "@/stores/llmConfigStore";
import { useDialogService } from "@/services/DialogService";
import ApiChannelForm from "./ApiChannelForm.vue";
import BooleanToggle from "@/components/graph/inputs/BooleanToggle.vue";
import { ChevronLeftIcon, ArrowPathIcon, ExclamationCircleIcon } from "@heroicons/vue/24/outline";

// Props & Emits
interface Props {
  channelId?: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  channelSaved: [channel: ApiCredentialConfig];
}>();

// Store & Services
const llmConfigStore = useLlmConfigStore();
const { activatedModels } = storeToRefs(llmConfigStore);
const dialogService = useDialogService();

// Local State
const channelData = ref<ApiCredentialConfig | null>(null);
const discoveredModels = ref<any[]>([]);
const isLoading = ref(false);
const isDiscoveringModels = ref(false);
const isTogglingModel = ref(false);
const hasDiscovered = ref(false);
const error = ref<string | null>(null);

// Computed
const isNewChannel = computed(() => !props.channelId);

// 检查模型是否已激活
const isModelActivated = (modelId: string): boolean => {
  return activatedModels.value.some((model) => model.modelId === modelId);
};

// 加载渠道数据
const loadChannelData = async () => {
  if (!props.channelId) {
    channelData.value = null;
    return;
  }

  isLoading.value = true;
  error.value = null;

  try {
    // 从现有的 channels 列表中查找，避免额外的 API 调用
    const existingChannel = llmConfigStore.channels.find((c) => c.id === props.channelId);
    if (existingChannel) {
      channelData.value = existingChannel;
    } else {
      // 如果在列表中找不到，尝试重新获取列表
      await llmConfigStore.fetchChannels();
      const foundChannel = llmConfigStore.channels.find((c) => c.id === props.channelId);
      channelData.value = foundChannel || null;
      if (!foundChannel) {
        throw new Error("渠道不存在");
      }
    }
  } catch (e: any) {
    error.value = e.message || "加载渠道数据失败";
  } finally {
    isLoading.value = false;
  }
};

// 发现模型
const handleDiscoverModels = async () => {
  if (!props.channelId) return;

  isDiscoveringModels.value = true;
  try {
    discoveredModels.value = await llmConfigStore.discoverModels(props.channelId);
    hasDiscovered.value = true;
    if (discoveredModels.value.length > 0) {
      dialogService.showSuccess(`发现了 ${discoveredModels.value.length} 个模型`);
    }
  } catch (error: any) {
    dialogService.showError(error.message || "模型发现失败");
  } finally {
    isDiscoveringModels.value = false;
  }
};

// 切换模型激活状态
const handleToggleModel = async (model: any, isActivated: boolean) => {
  isTogglingModel.value = true;
  try {
    if (isActivated) {
      // 激活模型
      const modelData = {
        modelId: model.id,
        userId: "", // 这将由后端根据 session 自动填充
        displayName: model.displayName || model.name,
        modelType: "llm" as const,
        capabilities: model.capabilities || ["llm"],
        groupName: channelData.value?.providerId || "unknown",
        defaultChannelRef: props.channelId || undefined,
      };
      await llmConfigStore.addModel(modelData);
      dialogService.showSuccess(`模型 "${model.displayName || model.name}" 已激活`);
    } else {
      // 查找并禁用模型
      const activatedModel = activatedModels.value.find((m) => m.modelId === model.id);
      if (activatedModel && activatedModel.modelId) {
        await llmConfigStore.deleteModel(activatedModel.modelId);
        dialogService.showSuccess(`模型 "${model.displayName || model.name}" 已禁用`);
      }
    }
  } catch (error: any) {
    dialogService.showError(error.message || "模型状态切换失败");
  } finally {
    isTogglingModel.value = false;
  }
};

// 编辑模型
const handleEditModel = (_model: any) => {
  // TODO: 实现模型编辑功能
  dialogService.showInfo("模型编辑功能正在开发中");
};

// 处理渠道表单提交
const handleChannelSubmit = async (formData: ApiChannelFormData) => {
  try {
    if (isNewChannel.value) {
      const savedChannel = await llmConfigStore.addChannel(formData);
      dialogService.showSuccess("API 渠道已成功创建！");
      channelData.value = savedChannel;
      emit("channelSaved", savedChannel);
    } else if (channelData.value?.id) {
      const updateData = { ...formData, id: channelData.value.id };
      const updatedChannel = await llmConfigStore.updateChannel(updateData as ApiCredentialConfig);
      dialogService.showSuccess("API 渠道已成功更新！");
      channelData.value = updatedChannel;
      emit("channelSaved", updatedChannel);
    } else {
      throw new Error("无效的渠道数据");
    }

    // 如果是新渠道，自动切换到编辑模式
    if (isNewChannel.value) {
      // 这里可以通过 emit 通知父组件更新 channelId
    }
  } catch (error: any) {
    // 错误已经在 store 中处理，这里只需要记录
    console.error("保存渠道失败:", error);
  }
};

// 监听 channelId 变化
watch(
  () => props.channelId,
  () => {
    discoveredModels.value = [];
    hasDiscovered.value = false;
    loadChannelData();
  },
  { immediate: true }
);

// 组件挂载时加载激活的模型列表
onMounted(() => {
  llmConfigStore.fetchModels();
});
</script>
