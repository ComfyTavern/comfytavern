<template>
  <div class="workflow-binder-container p-6 bg-background-surface rounded-lg shadow-sm border border-border-base/20">
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
          <h3 class="text-lg font-semibold mb-4 border-b border-border-base pb-2 text-text-base">可用工作流</h3>
          <div class="max-h-96 overflow-y-auto space-y-2 pr-2">
            <div v-for="wf in availableWorkflows" :key="wf.id"
              class="flex items-center justify-between p-3 bg-background-surface rounded-md border border-border-base/30 hover:border-primary/30 transition-colors">
              <span class="truncate text-text-base" v-comfy-tooltip="wf.name">{{ wf.name }}</span>
              <button @click="addBinding(wf.id, wf.name)" :disabled="isWorkflowBound(wf.id)"
                class="flex items-center justify-center w-7 h-7 rounded-md transition-colors bg-primary-soft text-primary hover:bg-primary-soft/80 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-neutral-softest disabled:text-text-disabled">
                <IconAdd class="w-4 h-4" />
              </button>
            </div>
            <div v-if="!availableWorkflows.length" class="text-sm text-text-disabled text-center py-4">
              项目中没有找到可用工作流。
            </div>
          </div>
        </div>

        <!-- Middle Column: Bound Workflows -->
        <div class="md:col-span-8">
          <h3 class="text-lg font-semibold mb-4 border-b border-border-base pb-2 text-text-base">已绑定工作流</h3>
          <div class="max-h-96 overflow-y-auto space-y-3 pr-2">
            <div v-if="!bindings.length" class="text-sm text-text-disabled text-center py-4">
              尚未绑定任何工作流。
            </div>
            <div v-for="(binding, index) in bindings" :key="binding.workflowId + index"
              class="p-4 bg-background-surface rounded-lg border border-border-base/40 hover:border-primary/30 transition-colors">
              <div class="flex items-center justify-between mb-3">
                <p class="text-base font-medium text-primary">{{ getWorkflowName(binding.workflowId) }}</p>
                <button @click="removeBinding(binding.workflowId)"
                  class="group flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:bg-error-soft">
                  <IconDelete class="w-4 h-4 text-text-muted transition-colors group-hover:text-error" />
                </button>
              </div>
              <div class="space-y-2">
                <div>
                  <label class="text-xs font-medium text-text-secondary uppercase tracking-wide">调用别名 (Alias)</label>
                  <input type="text" v-model="binding.alias"
                    class="mt-1 block w-full px-3 py-2 bg-background-base border border-border-base rounded-md text-text-base focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm"
                    placeholder="e.g., mainChat" />
                </div>
                <div>
                  <label class="text-xs font-medium text-text-secondary uppercase tracking-wide">描述</label>
                  <input type="text" v-model="binding.description"
                    class="mt-1 block w-full px-3 py-2 bg-background-base border border-border-base rounded-md text-text-base focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer with Save button -->
      <div class="mt-6 pt-4 border-t border-border-base flex justify-end">
        <button @click="saveChanges" :disabled="panelStore.isSavingDefinition"
          class="px-4 py-2 font-medium text-primary-content bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
          <IconSpinner v-if="panelStore.isSavingDefinition" class="w-5 h-5 animate-spin" />
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
import IconAdd from '@/components/icons/IconAdd.vue';
import IconDelete from '@/components/icons/IconDelete.vue';
import IconSpinner from '@/components/icons/IconSpinner.vue';

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