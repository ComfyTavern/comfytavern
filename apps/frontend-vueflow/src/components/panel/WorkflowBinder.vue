<template>
  <div class="workflow-binder-container p-4 bg-background-surface/60 rounded-lg">
    <div v-if="isLoading" class="text-center py-12">
      <p>正在加载配置...</p>
    </div>

    <div v-else-if="!panelDef" class="text-center py-12 text-error">
      <p>无法加载面板定义。</p>
    </div>

    <div v-else>
      <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
        <!-- Left Column: Available Workflows -->
        <div class="md:col-span-4">
          <h3 class="text-lg font-semibold mb-3 border-b border-border-base/40 pb-2">可用工作流</h3>
          <div class="max-h-96 overflow-y-auto space-y-2 pr-2">
            <div v-for="wf in availableWorkflows" :key="wf.id"
              class="flex items-center justify-between p-2 bg-background-surface rounded-md">
              <span class="truncate" v-comfy-tooltip="wf.name">{{ wf.name }}</span>
              <button @click="addBinding(wf.id, wf.name)" :disabled="isWorkflowBound(wf.id)"
                class="flex items-center justify-center w-6 h-6 rounded-md transition-colors bg-primary-softest hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-neutral-softest">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                  class="lucide lucide-plus">
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
              </button>
            </div>
            <div v-if="!availableWorkflows.length" class="text-sm text-text-disabled text-center py-4">
              项目中没有找到可用工作流。
            </div>
          </div>
        </div>

        <!-- Middle Column: Bound Workflows -->
        <div class="md:col-span-8">
          <h3 class="text-lg font-semibold mb-3 border-b border-border-base/40 pb-2">已绑定工作流</h3>
          <div class="max-h-96 overflow-y-auto space-y-3 pr-2">
            <div v-if="!bindings.length" class="text-sm text-text-disabled text-center py-4">
              尚未绑定任何工作流。
            </div>
            <div v-for="(binding, index) in bindings" :key="binding.workflowId + index"
              class="p-3 bg-background-surface rounded-lg border border-border-color-soft">
              <div class="flex items-center justify-between mb-3">
                <p class="text-base font-medium text-primary">{{ getWorkflowName(binding.workflowId) }}</p>
                <button @click="removeBinding(binding.workflowId)"
                  class="group flex items-center justify-center w-6 h-6 rounded-md transition-colors hover:bg-error/10">
                  <span
                    class="icon-[fluent--delete-20-regular] w-4 h-4 text-text-muted transition-colors group-hover:text-error"></span>
                </button>
              </div>
              <div class="space-y-2">
                <div>
                  <label class="text-xs text-text-secondary">调用别名 (Alias)</label>
                  <input type="text" v-model="binding.alias" class="input-sm w-full" placeholder="e.g., mainChat" />
                </div>
                <div>
                  <label class="text-xs text-text-secondary">描述</label>
                  <input type="text" v-model="binding.description" class="input-sm w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer with Save button -->
      <div class="mt-6 pt-4 border-t border-border-base/40 flex justify-end">
        <button @click="saveChanges" :disabled="panelStore.isSavingDefinition" class="btn btn-primary">
          <span v-if="panelStore.isSavingDefinition"
            class="icon-[fluent--spinner-ios-20-regular] w-5 h-5 animate-spin"></span>
          <span v-else>保存更改</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useWorkflowStore } from '@/stores/workflowStore';
import { usePanelStore } from '@/stores/panelStore';
import type { PanelDefinition, PanelWorkflowBinding } from '@comfytavern/types';
import { klona } from 'klona';
import { vComfyTooltip } from '@/directives/vComfyTooltip';

const props = defineProps({
  projectId: {
    type: String,
    required: true,
  },
  panelId: {
    type: String,
    required: true,
  },
});

const workflowStore = useWorkflowStore();
const panelStore = usePanelStore();

const panelDef = ref<PanelDefinition | null>(null);
const bindings = ref<PanelWorkflowBinding[]>([]);
const isLoading = ref(true);

const availableWorkflows = computed(() => workflowStore.availableWorkflows);
const isWorkflowBound = (workflowId: string) => {
  return bindings.value.some(b => b.workflowId === workflowId);
};

const getWorkflowName = (workflowId: string) => {
  return availableWorkflows.value.find(w => w.id === workflowId)?.name || workflowId;
}

const addBinding = (workflowId: string, workflowName: string) => {
  if (isWorkflowBound(workflowId)) return;

  // 生成一个默认别名
  const defaultAlias = workflowName.replace(/\s+/g, '_').toLowerCase();

  bindings.value.push({
    workflowId,
    alias: defaultAlias,
    description: ``,
    notes: '',
  });
};

const removeBinding = (workflowId: string) => {
  bindings.value = bindings.value.filter(b => b.workflowId !== workflowId);
};

const saveChanges = async () => {
  if (!panelDef.value) return;

  const updatedPanelDef = klona(panelDef.value);
  updatedPanelDef.workflowBindings = bindings.value;

  await panelStore.savePanelDefinition(props.projectId, updatedPanelDef);
};

onMounted(async () => {
  isLoading.value = true;
  await Promise.all([
    workflowStore.fetchAvailableWorkflows(),
    panelStore.fetchPanelDefinition(props.projectId, props.panelId).then(data => {
      panelDef.value = data;
      if (data?.workflowBindings) {
        bindings.value = klona(data.workflowBindings);
      }
    }),
  ]);
  isLoading.value = false;
});
</script>