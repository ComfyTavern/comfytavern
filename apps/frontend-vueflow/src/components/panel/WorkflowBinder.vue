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
              <div class="space-y-3">
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

                <!-- Workflow IO Display -->
                <div class="mt-3 pt-3 border-t border-border-base/50">
                  <div class="grid grid-cols-2 gap-x-4">
                    <!-- Inputs -->
                    <div>
                      <h4 class="text-xs font-semibold uppercase text-text-secondary mb-2">输入</h4>
                      <template v-for="details in [boundWorkflowsDetails[binding.workflowId]]" :key="binding.workflowId + '-inputs'">
                        <div v-if="details">
                          <div v-if="Object.keys(details.inputs).length > 0" class="space-y-1.5">
                            <div v-for="(input, key) in details.inputs" :key="key" class="flex items-center justify-between text-xs text-text-base">
                              <span class="truncate" v-comfy-tooltip="`${input.displayName || key}`">{{ input.displayName || key }}</span>
                              <div class="flex items-center space-x-1.5 flex-shrink-0">
                                <span class="text-text-muted">{{ input.dataFlowType }}</span>
                                <span :class="getHandleClasses(input, true)" style="width: 8px !important; height: 8px !important; position: static !important; transform: none !important; border-width: 1px !important; display: inline-block !important;"></span>
                              </div>
                            </div>
                          </div>
                          <div v-else class="text-xs text-text-disabled italic">
                            无输入接口
                          </div>
                        </div>
                        <div v-else class="text-xs text-text-disabled italic">
                          正在加载...
                        </div>
                      </template>
                    </div>
                    <!-- Outputs -->
                    <div>
                      <h4 class="text-xs font-semibold uppercase text-text-secondary mb-2">输出</h4>
                      <template v-for="details in [boundWorkflowsDetails[binding.workflowId]]" :key="binding.workflowId + '-outputs'">
                        <div v-if="details">
                          <div v-if="Object.keys(details.outputs).length > 0" class="space-y-1.5">
                            <div v-for="(output, key) in details.outputs" :key="key" class="flex items-center justify-between text-xs text-text-base">
                              <span class="truncate" v-comfy-tooltip="`${output.displayName || key}`">{{ output.displayName || key }}</span>
                              <div class="flex items-center space-x-1.5 flex-shrink-0">
                                <span class="text-text-muted">{{ output.dataFlowType }}</span>
                                <span :class="getHandleClasses(output, false)" style="width: 8px !important; height: 8px !important; position: static !important; transform: none !important; border-width: 1px !important; display: inline-block !important;"></span>
                              </div>
                            </div>
                          </div>
                          <div v-else class="text-xs text-text-disabled italic">
                            无输出接口
                          </div>
                        </div>
                        <div v-else class="text-xs text-text-disabled italic">
                          正在加载...
                        </div>
                      </template>
                    </div>
                  </div>
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
import { DataFlowType, type PanelDefinition, type PanelWorkflowBinding, type GroupSlotInfo } from '@comfytavern/types';
import { klona } from 'klona';
import { vComfyTooltip } from '@/directives/vComfyTooltip';
import styles from '@/components/graph/nodes/handleStyles.module.css';
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
const boundWorkflowsDetails = ref<Record<string, { inputs: Record<string, GroupSlotInfo>, outputs: Record<string, GroupSlotInfo> }>>({});

const availableWorkflows = computed(() => workflowStore.availableWorkflows);
const isWorkflowBound = (workflowId: string) => {
  return bindings.value.some(b => b.workflowId === workflowId);
};

const getWorkflowName = (workflowId: string) => {
  return availableWorkflows.value.find(w => w.id === workflowId)?.name || workflowId;
}

const filterSlots = (slots: Record<string, GroupSlotInfo> | undefined) => {
  if (!slots) return {};
  return Object.fromEntries(
    Object.entries(slots).filter(
      ([, slotInfo]) => slotInfo && slotInfo.dataFlowType !== DataFlowType.CONVERTIBLE_ANY
    )
  );
};

const fetchAndStoreWorkflowDetails = async (workflowId: string) => {
  if (!props.projectId || boundWorkflowsDetails.value[workflowId]) return;
  try {
    const wfData = await workflowStore.fetchWorkflow(props.projectId, workflowId);
    if (wfData) {
      boundWorkflowsDetails.value[workflowId] = {
        inputs: filterSlots(wfData.interfaceInputs),
        outputs: filterSlots(wfData.interfaceOutputs),
      };
    }
  } catch (error) {
    console.error(`获取工作流 ${workflowId} 的详细信息失败:`, error);
  }
};

function getHandleClasses(slot: GroupSlotInfo, isInput: boolean): string[] {
  const classes: string[] = [];
  if (styles.handle) classes.push(styles.handle);

  const typeClassKey = `handleType${slot.dataFlowType}` as keyof typeof styles;
  const typeClass = styles[typeClassKey];
  if (typeClass) {
    classes.push(typeClass);
  } else if (styles.handleAny) {
    classes.push(styles.handleAny);
  }

  if (slot.dataFlowType === DataFlowType.CONVERTIBLE_ANY && styles.handleAny && !classes.includes(styles.handleAny)) {
    classes.push(styles.handleAny);
  }

  // GroupSlotInfo may not have 'multi', using assertion as a safe fallback.
  if (isInput && (slot as any).multi && styles.handleMulti && !classes.includes(styles.handleMulti)) {
    classes.push(styles.handleMulti);
  }

  return classes;
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

  fetchAndStoreWorkflowDetails(workflowId);
};

const removeBinding = (workflowId: string) => {
  bindings.value = bindings.value.filter(b => b.workflowId !== workflowId);
  delete boundWorkflowsDetails.value[workflowId];
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
        bindings.value.forEach(b => fetchAndStoreWorkflowDetails(b.workflowId));
      }
    }),
  ]);
  isLoading.value = false;
});
</script>