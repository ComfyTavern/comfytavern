<template>
  <div
    class="workflow-binder-container h-full flex flex-col p-6 bg-background-surface rounded-lg shadow-sm border border-border-base/20">
    <div v-if="isLoading" class="text-center py-12">
      <p>正在加载配置...</p>
    </div>

    <div v-else-if="!panelDef" class="text-center py-12 text-error">
      <p>无法加载面板定义。</p>
    </div>

    <div v-else class="h-full flex flex-col">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-6 flex-grow min-h-0">
        <!-- Left Column: Available Workflows -->
        <div class="md:col-span-4 flex flex-col min-h-0">
          <h3 class="text-lg font-semibold mb-4 border-b border-border-base pb-2 text-text-base">可用工作流</h3>
          <div class="flex-grow overflow-y-auto space-y-2 pr-2">
            <div v-for="wf in availableWorkflows" :key="wf.id"
              class="flex items-center justify-between p-3 bg-background-surface rounded-md border border-border-base/30 hover:border-primary/30 transition-colors">
              <span class="truncate text-text-base" v-comfy-tooltip="wf.name">{{ wf.name }}</span>
              <button @click="addBinding(wf.id)" :disabled="isWorkflowBound(wf.id)"
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
        <div class="md:col-span-8 flex flex-col min-h-0">
          <h3 class="text-lg font-semibold mb-4 border-b border-border-base pb-2 text-text-base">已绑定工作流</h3>
          <div class="flex-grow overflow-y-auto space-y-3 pr-2">
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
                <!-- Workflow Info -->
                <div class="text-sm">
                  <p class="text-text-muted line-clamp-2">{{ getWorkflowDescription(binding.workflowId) || '无可用描述。' }}
                  </p>
                  <p class="text-xs text-text-disabled mt-1 font-mono">ID: {{ binding.workflowId }}</p>
                </div>

                <!-- Details sections -->
                <div class="space-y-2">
                  <!-- Workflow IO Display -->
                  <CollapsibleSection>
                    <template #title>接口详情 (I/O)</template>
                    <template #content>
                      <div v-if="boundWorkflowsDetails[binding.workflowId]" class="grid grid-cols-2 gap-x-4">
                        <!-- Inputs -->
                        <div>
                          <h4 class="text-xs font-semibold uppercase text-text-secondary mb-2">输入</h4>
                          <div v-if="Object.keys(boundWorkflowsDetails[binding.workflowId]!.inputs).length > 0"
                            class="space-y-1.5">
                            <div v-for="(input, key) in boundWorkflowsDetails[binding.workflowId]!.inputs" :key="key"
                              class="flex items-center justify-between text-xs text-text-base">
                              <span class="truncate" v-comfy-tooltip="`${input.displayName || key}`">{{
                                input.displayName || key }}</span>
                              <div class="flex items-center space-x-1.5 flex-shrink-0">
                                <span class="text-text-muted">{{ input.dataFlowType }}</span>
                                <span :class="getHandleClasses(input, true)"
                                  style="width: 8px !important; height: 8px !important; position: static !important; transform: none !important; border-width: 1px !important; display: inline-block !important;"></span>
                              </div>
                            </div>
                          </div>
                          <div v-else class="text-xs text-text-disabled italic">无输入接口</div>
                        </div>
                        <!-- Outputs -->
                        <div>
                          <h4 class="text-xs font-semibold uppercase text-text-secondary mb-2">输出</h4>
                          <div v-if="Object.keys(boundWorkflowsDetails[binding.workflowId]!.outputs).length > 0"
                            class="space-y-1.5">
                            <div v-for="(output, key) in boundWorkflowsDetails[binding.workflowId]!.outputs" :key="key"
                              class="flex items-center justify-between text-xs text-text-base">
                              <span class="truncate" v-comfy-tooltip="`${output.displayName || key}`">{{
                                output.displayName || key }}</span>
                              <div class="flex items-center space-x-1.5 flex-shrink-0">
                                <span class="text-text-muted">{{ output.dataFlowType }}</span>
                                <span :class="getHandleClasses(output, false)"
                                  style="width: 8px !important; height: 8px !important; position: static !important; transform: none !important; border-width: 1px !important; display: inline-block !important;"></span>
                              </div>
                            </div>
                          </div>
                          <div v-else class="text-xs text-text-disabled italic">无输出接口</div>
                        </div>
                      </div>
                      <div v-else class="text-xs text-text-disabled italic">正在加载...</div>
                    </template>
                  </CollapsibleSection>

                  <!-- Generated API Code -->
                  <CollapsibleSection>
                    <template #title>API 调用示例</template>
                    <template #content>
                      <div v-if="boundWorkflowsDetails[binding.workflowId]">
                        <div class="bg-background-base rounded-md text-sm font-mono overflow-x-auto relative group">
                          <pre
                            class="p-3 leading-relaxed"><code class="language-javascript">{{ generateCodeForBinding(binding) }}</code></pre>
                          <button @click="copyCode(generateCodeForBinding(binding))" v-comfy-tooltip="'复制代码'"
                            class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md bg-background-surface hover:bg-background-modifier-hover text-text-muted hover:text-text-base">
                            <IconCopy class="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div v-else class="text-xs text-text-disabled italic">等待接口详情加载完毕...</div>
                    </template>
                  </CollapsibleSection>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer with actions -->
      <div class="mt-6 pt-4 border-t border-border-base flex justify-end gap-x-3">
        <button @click="goBack"
          class="px-4 py-2 font-medium border border-border-base/50 text-text-base bg-background-surface rounded-md hover:bg-background-modifier-hover transition-colors">
          返回
        </button>
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
import { useRouter } from 'vue-router';
import { useDialogService } from '@/services/DialogService';
import { useWorkflowStore } from '@/stores/workflowStore';
import { usePanelStore } from '@/stores/panelStore';
import { DataFlowType, type DataFlowTypeName, type PanelDefinition, type PanelWorkflowBinding, type GroupSlotInfo, BuiltInSocketMatchCategory } from '@comfytavern/types';
import { klona } from 'klona';
import { vComfyTooltip } from '@/directives/vComfyTooltip';
import styles from '@/components/graph/nodes/handleStyles.module.css';
import IconAdd from '@/components/icons/IconAdd.vue';
import IconDelete from '@/components/icons/IconDelete.vue';
import IconCopy from '@/components/icons/IconCopy.vue';
import IconSpinner from '@/components/icons/IconSpinner.vue';
import CollapsibleSection from '@/components/common/CollapsibleSection.vue';

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

const router = useRouter();
const workflowStore = useWorkflowStore();
const panelStore = usePanelStore();
const dialogService = useDialogService();

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

const getWorkflowDescription = (workflowId: string) => {
  return availableWorkflows.value.find(w => w.id === workflowId)?.description || '';
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

const dataFlowTypeToJsType = (type: DataFlowTypeName, categories: string[] = []): string => {
  if (categories.includes(BuiltInSocketMatchCategory.JSON)) return 'object';
  if (categories.includes(BuiltInSocketMatchCategory.IMAGE_DATA)) return 'object'; // Typically a file or data URL

  switch (type) {
    case DataFlowType.STRING: return 'string';
    case DataFlowType.INTEGER:
    case DataFlowType.FLOAT: return 'number';
    case DataFlowType.BOOLEAN: return 'boolean';
    case DataFlowType.OBJECT: return 'object';
    case DataFlowType.ARRAY: return 'any[]';
    default: return 'any';
  }
};

const generateCodeForBinding = (binding: PanelWorkflowBinding): string => {
  const details = boundWorkflowsDetails.value[binding.workflowId];
  if (!details) {
    return '// 正在加载工作流详情...';
  }

  // 安全地处理 inputs 和 outputs
  const inputs = details.inputs ?? {};
  const outputs = details.outputs ?? {};

  // 使用工作流ID作为调用标识符,并清理成有效的JS变量名
  const workflowName = getWorkflowName(binding.workflowId);
  const workflowDescription = getWorkflowDescription(binding.workflowId);
  const functionName = workflowName.replace(/[^a-zA-Z0-9_$]/g, '_');


  const inputsDoc = Object.entries(inputs)
    .map(([key, inputInfo]) => ` * @param {${dataFlowTypeToJsType(inputInfo.dataFlowType, inputInfo.matchCategories)}} inputs.${key} - ${inputInfo.displayName || key}`)
    .join('\n');

  const outputsDoc = Object.entries(outputs)
    .map(([key, outputInfo]) => ` *   - ${key} (${outputInfo.dataFlowType}): ${outputInfo.displayName || key}`)
    .join('\n');

  const exampleInputs = Object.keys(inputs)
    .map(key => `  ${key}: /* 你的值 */`)
    .join(',\n');

  const exampleOutputs = Object.entries(outputs)
    .map(([key, outputInfo]) => `    //   ${key}: ... (${outputInfo.dataFlowType})`)
    .join('\n');

  return `/**
 * 调用工作流: ${workflowName}
 * ID: ${binding.workflowId}
 * 描述: ${workflowDescription || '无'}
 *
 * @param {object} inputs - 输入参数对象.
 * ${inputsDoc || ' * (此工作流无输入)'}
 * @returns {Promise<string>} - 返回一个 executionId 用于追踪.
 *
 * @example
 * // 在 onResult 回调中，data.outputs 可能包含:
 * ${outputsDoc || ' *   (无明确输出)'}
 */
async function ${functionName}(inputs) {
  const { executionId } = await window.comfyTavern.panelApi.invoke({
    mode: 'native',
    workflowId: '${binding.workflowId}',
    inputs,
  });
  return executionId;
}

/*
// --- 调用示例 ---
const executionId = await ${functionName}({
${exampleInputs || '  /* 此工作流无输入 */'}
});

// --- 订阅事件以获取结果 ---
window.comfyTavern.panelApi.subscribeToExecutionEvents(executionId, {
  onProgress: (data) => { console.log('进度:', data); },
  onResult: (data) => {
    console.log('结果:', data.outputs);
    // data.outputs 的结构示例:
    // {
${exampleOutputs || '    //   (此工作流无输出)'}
    // }
  },
  onError: (error) => { console.error('执行错误:', error); },
});
*/`;
};

const copyCode = async (code: string) => {
  try {
    await navigator.clipboard.writeText(code);
    dialogService.showSuccess('代码已复制到剪贴板');
  } catch (err) {
    console.error('无法复制文本: ', err);
    dialogService.showError('复制失败');
  }
};
const goBack = () => {
  router.back();
};

const addBinding = (workflowId: string) => {
  if (isWorkflowBound(workflowId)) return;

  bindings.value.push({
    workflowId,
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