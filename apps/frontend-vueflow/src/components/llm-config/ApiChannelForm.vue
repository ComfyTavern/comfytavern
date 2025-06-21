<template>
  <form id="api-channel-form" @submit.prevent="handleSubmit" class="space-y-6">
    <!-- 提供商类型 -->
    <div>
      <label class="block text-sm font-medium text-text-base mb-2">
        提供商类型 <span class="text-error">*</span>
      </label>
      <SelectInput v-model="formData.providerId" :suggestions="providerOptions"
        :placeholder="isLoadingProviders ? '正在加载...' : '选择提供商'" :disabled="isLoadingProviders"
        :apply-canvas-scale="false" size="large" required />
    </div>

    <!-- 渠道名称 -->
    <div>
      <label class="block text-sm font-medium text-text-base mb-2">
        渠道名称 <span class="text-error">*</span>
      </label>
      <input v-model="formData.label" type="text" required placeholder="例如: 从谷大善人那免费拿到的Gemini key"
        class="w-full p-3 border border-border-base rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-background-surface text-text-base"
        autocomplete="channelname" />
      <p class="text-sm text-text-secondary mt-1">在UI中显示的名称，建议保持唯一</p>
    </div>

    <!-- Base URL -->
    <div>
      <label class="block text-sm font-medium text-text-base mb-2">
        Base URL <span class="text-error">*</span>
      </label>
      <input v-model="formData.baseUrl" type="url" required placeholder="https://api.openai.com/v1"
        class="w-full p-3 border border-border-base rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-background-surface text-text-base" />
      <p class="text-sm text-text-secondary mt-1">API的基础URL地址</p>
    </div>

    <!-- API Key -->
    <div>
      <label class="block text-sm font-medium text-text-base mb-2">
        API Key <span class="text-error">*</span>
      </label>
      <input v-model="formData.apiKey" type="password" autocomplete="new-password" :required="!isEditMode"
        :placeholder="isEditMode ? '如需更改，请输入新的 API Key' : 'sk-...'"
        class="w-full p-3 border border-border-base rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-background-surface text-text-base" />
    </div>

    <!-- 支持的模型 -->
    <div>
      <label class="block text-sm font-medium text-text-base mb-2">
        支持的模型 <span class="text-error">*</span>
      </label>

      <!-- 预设模型快捷按钮 -->
      <div class="mb-3">
        <div class="flex flex-wrap gap-2 mb-2">
          <button v-for="preset in getPresetModels()" :key="preset.value" type="button"
            @click="togglePresetModel(preset.value)" :class="[
              'px-3 py-1 text-xs rounded-full border transition-colors',
              formData.supportedModels?.includes(preset.value)
                ? 'bg-primary text-primary-content border-primary'
                : 'bg-background-surface text-text-secondary border-border-base hover:bg-background-surface/80',
            ]">
            {{ preset.label }}
          </button>
        </div>
        <button type="button" @click="fillAllPresetModels"
          class="px-3 py-1 text-xs bg-primary-soft text-primary rounded-md hover:bg-primary-soft/80">
          添加全部预设模型
        </button>
      </div>

      <!-- 已选模型列表 -->
      <div v-if="formData.supportedModels && formData.supportedModels.length > 0" class="mb-3">
        <div class="flex flex-wrap gap-2">
          <span v-for="model in formData.supportedModels" :key="model"
            class="inline-flex items-center px-2 py-1 bg-primary-soft text-primary rounded-md text-sm">
            {{ model }}
            <button type="button" @click="removeModel(model)" class="ml-2 text-error hover:text-error/80">
              ×
            </button>
          </span>
        </div>
      </div>

      <!-- 自定义模型输入 -->
      <div class="flex gap-2">
        <input v-model="newModelName" type="text" placeholder="输入自定义模型名称，例如: gpt-4-turbo"
          class="flex-1 p-2 border border-border-base rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-background-surface text-text-base text-sm"
          autocomplete="on" @keypress.enter.prevent="addCustomModel" />
        <button type="button" @click="addCustomModel" :disabled="!newModelName.trim()"
          class="px-4 py-2 bg-primary text-primary-content rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
          添加
        </button>
      </div>

      <p class="text-sm text-text-secondary mt-1">选择或输入该渠道支持的模型。至少选择一个模型。</p>

      <!-- 验证错误 -->
      <p v-if="!isModelsValid" class="text-sm text-error mt-1">请至少选择一个模型</p>
    </div>

    <!-- 是否禁用 -->
    <div class="flex items-center justify-between rounded-md border border-border-base p-3 bg-background-surface">
      <div class="flex-1 pr-4">
        <span class="font-medium text-text-base">禁用此渠道</span>
        <p class="text-sm text-text-secondary mt-1">禁用后,此渠道将无法在任何工作流中使用。</p>
      </div>
      <div class="flex-shrink-2">
        <BooleanToggle v-model="formData.disabled" size="large" />
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { storeToRefs } from "pinia";
import type { ApiCredentialConfig } from "@comfytavern/types";
import { useLlmConfigStore } from "@/stores/llmConfigStore";
import SelectInput from "@/components/graph/inputs/SelectInput.vue";
import BooleanToggle from "@/components/graph/inputs/BooleanToggle.vue";

// 定义组件的 Props
interface Props {
  initialData?: ApiCredentialConfig | null;
}
const props = defineProps<Props>();

// 定义组件的 Emits
interface ApiChannelFormData {
  label: string;
  providerId: string;
  adapterType?: string;
  baseUrl: string;
  apiKey?: string;
  supportedModels?: string[];
  disabled: boolean;
}

const emit = defineEmits<{
  submit: [data: ApiChannelFormData];
  cancel: [];
  "validity-change": [isValid: boolean];
}>();

// Store
const llmConfigStore = useLlmConfigStore();
const { providers, isLoadingProviders } = storeToRefs(llmConfigStore);

// 预设模型配置
const modelPresets = {
  openai: [
    { label: "GPT-4o", value: "gpt-4o" },
    { label: "GPT-4o Mini", value: "gpt-4o-mini" },
    { label: "GPT-4.1", value: "gpt-4.1" },
    { label: "GPT-4.1 Mini", value: "gpt-4.1-mini" },
    { label: "O1", value: "o1" },
    { label: "O1 Pro", value: "o1-pro" },
    { label: "O1 Mini", value: "o1-mini" },
    { label: "O3", value: "o3" },
    { label: "O3 Pro", value: "o3-pro" },
    { label: "O3 Mini", value: "o3-mini" },
    { label: "O4 Mini", value: "o4-mini" },
  ],
  anthropic: [
    { label: "Claude 4 Opus", value: "claude-4-opus-20250522" },
    { label: "Claude 4 Sonnet", value: "claude-4-sonnet-20250522" },
    { label: "Claude 3.7 Sonnet", value: "claude-3.7-sonnet-20250224" },
    { label: "Claude 3.5 Sonnet", value: "claude-3-5-sonnet-20241022" },
    { label: "Claude 3.5 Haiku", value: "claude-3-5-haiku-20241022" },
    { label: "Claude 3 Opus", value: "claude-3-opus-20240229" },
  ],
  google: [
    { label: "Gemini 2.5 Pro", value: "gemini-2.5-pro" },
    { label: "Gemini 2.5 Flash", value: "gemini-2.5-flash" },
    { label: "Gemini 2.5 Flash-Lite", value: "gemini-2.5-flash-lite" },
    { label: "Gemini 1.5 Pro", value: "gemini-1.5-pro" },
    { label: "Gemini 1.5 Flash", value: "gemini-1.5-flash" },
  ],
  deepseek: [
    { label: "DeepSeek V3", value: "deepseek-chat" },
    { label: "DeepSeek R1", value: "deepseek-reasoner" },
  ],
  cohere: [
    { label: "Command A", value: "command-a" },
    { label: "Command R+", value: "command-r-plus" },
    { label: "Command R", value: "command-r" },
    { label: "Command Light", value: "command-light" },
    { label: "Aya", value: "aya" },
  ],
  ollama: [
    { label: "Llama 3.2", value: "llama3.2" },
    { label: "Mistral Nemo", value: "mistral-nemo" },
    { label: "Phi-4", value: "phi-4" },
    { label: "Qwen2", value: "qwen2" },
    { label: "DeepSeek V3", value: "deepseek-v3" },
  ],
  custom: [],
};

// 响应式数据
const formData = ref<ApiChannelFormData>({
  label: "",
  providerId: "",
  adapterType: "",
  baseUrl: "",
  apiKey: "",
  supportedModels: [],
  disabled: false,
});

const newModelName = ref("");

// 计算属性
const providerOptions = computed(() => {
  return providers.value.map((p) => ({ value: p.id, label: p.name }));
});

const isEditMode = computed(() => !!props.initialData?.id);

const isModelsValid = computed(
  () => formData.value.supportedModels && formData.value.supportedModels.length > 0
);

const isFormValid = computed(() => {
  const isApiKeyValid =
    isEditMode.value || (!!formData.value.apiKey && formData.value.apiKey.trim() !== "");
  return (
    formData.value.label.trim() !== "" &&
    formData.value.baseUrl.trim() !== "" &&
    isApiKeyValid &&
    isModelsValid.value
  );
});

// 根据选择的提供商返回预设模型
const getPresetModels = () => {
  const providerId = formData.value.providerId;
  if (!providerId || !modelPresets[providerId as keyof typeof modelPresets]) {
    return [];
  }
  return modelPresets[providerId as keyof typeof modelPresets];
};

// 切换预设模型的选择状态
const togglePresetModel = (modelId: string) => {
  if (!formData.value.supportedModels) {
    formData.value.supportedModels = [];
  }

  const index = formData.value.supportedModels.indexOf(modelId);
  if (index > -1) {
    formData.value.supportedModels.splice(index, 1);
  } else {
    formData.value.supportedModels.push(modelId);
  }
};

// 添加所有预设模型
const fillAllPresetModels = () => {
  const presets = getPresetModels();
  if (!formData.value.supportedModels) {
    formData.value.supportedModels = [];
  }

  presets.forEach((preset) => {
    if (!formData.value.supportedModels!.includes(preset.value)) {
      formData.value.supportedModels!.push(preset.value);
    }
  });
};

// 添加自定义模型
const addCustomModel = () => {
  const modelName = newModelName.value.trim();
  if (modelName && !formData.value.supportedModels?.includes(modelName)) {
    if (!formData.value.supportedModels) {
      formData.value.supportedModels = [];
    }
    formData.value.supportedModels.push(modelName);
    newModelName.value = "";
  }
};

// 移除模型
const removeModel = (modelId: string) => {
  if (formData.value.supportedModels) {
    const index = formData.value.supportedModels.indexOf(modelId);
    if (index > -1) {
      formData.value.supportedModels.splice(index, 1);
    }
  }
};

// 当提供商变化时，更新适配器类型和默认URL
watch(
  () => formData.value.providerId,
  (newProviderId) => {
    formData.value.adapterType = newProviderId;

    // 根据提供商设置默认URL
    const defaultUrls: Record<string, string> = {
      openai: "https://api.openai.com/v1",
      anthropic: "https://api.anthropic.com",
      google: "https://generativelanguage.googleapis.com/v1beta",
      cohere: "https://api.cohere.ai/v1",
      ollama: "http://localhost:11434",
    };

    if (newProviderId && defaultUrls[newProviderId]) {
      formData.value.baseUrl = defaultUrls[newProviderId];
    }
  }
);

// 表单提交
const handleSubmit = () => {
  if (isFormValid.value) {
    const dataToSubmit = { ...formData.value };
    if (isEditMode.value && !dataToSubmit.apiKey) {
      delete dataToSubmit.apiKey;
    }
    emit("submit", dataToSubmit);
  }
};

// 初始化表单数据
const initForm = (data: ApiCredentialConfig | null | undefined) => {
  if (data) {
    formData.value = {
      label: data.label || "",
      providerId: data.providerId || "",
      adapterType: data.adapterType || "",
      baseUrl: data.baseUrl || "",
      apiKey: "", // Don't pre-fill API key for security
      supportedModels: data.supportedModels || [],
      disabled: data.disabled || false,
    };
  } else {
    // Reset to default state for new channel
    formData.value = {
      label: "",
      providerId: "",
      adapterType: "",
      baseUrl: "",
      apiKey: "",
      supportedModels: [],
      disabled: false,
    };
  }
};

onMounted(() => {
  initForm(props.initialData);
  if (providers.value.length === 0) {
    llmConfigStore.fetchProviders();
  }
});

watch(
  () => props.initialData,
  (newData) => {
    initForm(newData);
  }
);

watch(
  isFormValid,
  (value) => {
    emit("validity-change", !!value);
  },
  { immediate: true }
);

// 导出类型供父组件使用
export type { ApiChannelFormData };
</script>
