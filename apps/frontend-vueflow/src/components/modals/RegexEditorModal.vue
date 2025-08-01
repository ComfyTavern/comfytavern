<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { klona } from 'klona/lite'; // 用于深拷贝
import type { RegexRule } from '@comfytavern/types';
import draggable from 'vuedraggable';
import { nanoid } from 'nanoid';

// 内部使用的、带有临时拖拽 ID 的规则类型
type InternalRegexRule = RegexRule & { _internal_id_for_drag: string };

const props = defineProps<{
  rules: RegexRule[]; // 外部传入的规则数组
  nodeId?: string; // 可选，用于标识节点
  inputKey?: string; // 可选，用于标识输入槽
  onSave: (rules: RegexRule[]) => void;
  onClose?: () => void;
}>();

const emit = defineEmits(['close-modal']);
const internalRules = ref<InternalRegexRule[]>([]); // 使用 InternalRegexRule
const selectedRuleIndex = ref<number | null>(null);

onMounted(() => {
  // 从 props.rules 初始化 internalRules，并为每个规则添加唯一的拖拽 ID
  internalRules.value = klona(props.rules || []).map(rule => ({ ...rule, _internal_id_for_drag: nanoid() }));
  if (internalRules.value.length > 0) {
    selectedRuleIndex.value = 0;
  }
});

const currentRule = computed(() => {
  if (selectedRuleIndex.value !== null && internalRules.value[selectedRuleIndex.value]) {
    return internalRules.value[selectedRuleIndex.value];
  }
  return null;
});

const closeModal = () => {
  props.onClose?.();
  emit('close-modal');
};

const saveChanges = () => {
  // 在保存前，移除临时的 _internal_id_for_drag 属性
  const rulesToSave = klona(internalRules.value).map(({ _internal_id_for_drag, ...rest }) => rest as RegexRule);
  props.onSave(rulesToSave);
  closeModal();
};

const addNewRule = () => {
  const newRule: InternalRegexRule = {
    _internal_id_for_drag: nanoid(), // 添加拖拽 ID
    name: `新规则 ${internalRules.value.length + 1}`,
    pattern: '',
    replacement: '',
    enabled: true,
  };
  internalRules.value.push(newRule);
  selectedRuleIndex.value = internalRules.value.length - 1;
};

const deleteRule = (index: number) => {
  if (index >= 0 && index < internalRules.value.length) {
    internalRules.value.splice(index, 1);
    if (selectedRuleIndex.value === index) {
      selectedRuleIndex.value = internalRules.value.length > 0 ? Math.max(0, index - 1) : null;
    } else if (selectedRuleIndex.value !== null && selectedRuleIndex.value > index) {
      selectedRuleIndex.value--;
    }
  }
};

const selectedRuleForDrag = ref<InternalRegexRule | null>(null); // 使用 InternalRegexRule

const handleDragStart = () => {
  if (selectedRuleIndex.value !== null) {
    const rule = internalRules.value[selectedRuleIndex.value];
    if (rule) {
      selectedRuleForDrag.value = rule;
    } else {
      selectedRuleForDrag.value = null;
    }
  } else {
    selectedRuleForDrag.value = null;
  }
};

const handleDragEnd = () => {
  if (selectedRuleForDrag.value) {
    const draggedId = selectedRuleForDrag.value._internal_id_for_drag; // 使用拖拽 ID
    const newIndex = internalRules.value.findIndex(rule => rule._internal_id_for_drag === draggedId);
    if (newIndex !== -1) {
      selectedRuleIndex.value = newIndex;
    } else {
      if (internalRules.value.length > 0) {
        const currentSelectedStillExists = selectedRuleIndex.value !== null && selectedRuleIndex.value < internalRules.value.length;
        if (!currentSelectedStillExists) {
          selectedRuleIndex.value = 0;
        }
      } else {
        selectedRuleIndex.value = null;
      }
    }
  }
  selectedRuleForDrag.value = null; // 清理
};

const testInputText = ref<string>('');
const testOutputText = ref<string>('');

const applyTestRules = () => {
  if (!testInputText.value && internalRules.value.length === 0) {
    testOutputText.value = '';
    return;
  }
  if (internalRules.value.filter(r => r.enabled).length === 0) {
    testOutputText.value = testInputText.value;
    return;
  }

  let tempText = testInputText.value;
  try {
    for (const rule of internalRules.value) {
      if (rule.enabled && typeof rule.pattern === 'string' && rule.pattern) {
        const regex = new RegExp(rule.pattern, rule.flags || '');
        const replacementString = typeof rule.replacement === 'string' ? rule.replacement : '';
        tempText = tempText.replace(regex, replacementString);
      }
    }
    testOutputText.value = tempText;
  } catch (error: any) {
    testOutputText.value = `错误: ${error.message}`;
    console.error("测试正则时出错:", error);
  }
};

watch(
  [testInputText, internalRules],
  () => {
    testOutputText.value = '';
  },
  { deep: true }
);
</script>

<template>
  <div class="w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden bg-background-surface">
    <!-- Body -->
    <div class="flex-grow flex overflow-hidden p-4 space-x-4">
      <!-- 左侧: 规则列表 -->
      <div class="w-1/3 flex flex-col border border-border-base rounded-md">
        <div class="p-2 border-b border-border-base flex justify-between items-center">
          <span class="text-sm font-medium text-text-base">规则列表</span>
          <button @click="addNewRule" class="p-1 text-primary hover:text-primary-focus" v-comfy-tooltip="'添加新规则'">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
              stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
        <div class="flex-grow overflow-y-auto">
          <draggable v-if="internalRules.length > 0" v-model="internalRules" item-key="_internal_id_for_drag" tag="ul"
            ghost-class="opacity-50 bg-primary/10 dark:bg-primary/20 !border !border-primary" handle=".drag-handle"
            @start="handleDragStart" @end="handleDragEnd" class="divide-y divide-border-base">
            <template #item="{ element: rule, index }">
              <li @click="selectedRuleIndex = index"
                class="p-2 hover:bg-background-hover flex items-center group relative"
                :class="{ 'bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-focus': selectedRuleIndex === index }">
                <span
                  class="drag-handle cursor-move text-text-muted group-hover:text-text-base mr-2 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                    stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                  </svg>
                </span>
                <input type="checkbox" v-model="rule.enabled" @click.stop
                  class="h-4 w-4 rounded border-border-base text-primary focus:ring-primary bg-background-base dark:bg-background-surface mr-2 flex-shrink-0"
                  v-comfy-tooltip="rule.enabled ? '禁用此规则' : '启用此规则'" />
                <span class="truncate flex-grow" v-comfy-tooltip="rule.name">{{ rule.name }}</span>
                <button @click.stop="deleteRule(index)"
                  class="p-0.5 text-error hover:text-error-focus opacity-0 group-hover:opacity-100 ml-2 flex-shrink-0"
                  v-comfy-tooltip="'删除规则'">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2"
                    stroke="currentColor" class="w-4 h-4">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            </template>
          </draggable>
          <p v-else class="p-4 text-sm text-text-muted text-center">暂无规则。</p>
        </div>
      </div>

      <!-- 右侧: 规则详情 & 测试 -->
      <div class="w-2/3 flex flex-col space-y-4 overflow-y-auto pr-1">
        <!-- 规则编辑表单 -->
        <div v-if="currentRule"
          class="p-4 border border-border-base rounded-md space-y-3 bg-background-base dark:bg-background-surface">
          <h4 class="text-md font-semibold text-text-base mb-2">编辑规则: {{ currentRule.name }}</h4>
          <div>
            <label for="ruleName" class="block text-sm font-medium text-text-base">名称</label>
            <input type="text" id="ruleName" v-model="currentRule.name"
              class="mt-1 block w-full rounded-md border-border-base shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-background-base dark:bg-background-surface text-text-base p-2" />
          </div>
          <div>
            <label for="rulePattern" class="block text-sm font-medium text-text-base">正则表达式</label>
            <input type="text" id="rulePattern" v-model="currentRule.pattern"
              class="mt-1 block w-full rounded-md border-border-base shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-background-base dark:bg-background-surface text-text-base p-2 font-mono" />
          </div>
          <div>
            <label for="ruleReplacement"
              class="block text-sm font-medium text-text-base">替换为</label>
            <input type="text" id="ruleReplacement" v-model="currentRule.replacement"
              class="mt-1 block w-full rounded-md border-border-base shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-background-base dark:bg-background-surface text-text-base p-2" />
          </div>
          <div>
            <label for="ruleFlags" class="block text-sm font-medium text-text-base">标志 (例如: gi,
              m)</label>
            <input type="text" id="ruleFlags" v-model="currentRule.flags"
              class="mt-1 block w-full rounded-md border-border-base shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-background-base dark:bg-background-surface text-text-base p-2" />
          </div>
          <div>
            <label for="ruleDescription" class="block text-sm font-medium text-text-base">描述
              (可选)</label>
            <textarea id="ruleDescription" v-model="currentRule.description" rows="2"
              class="mt-1 block w-full rounded-md border-border-base shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-background-base dark:bg-background-surface text-text-base p-2"></textarea>
          </div>
          <div class="flex items-center">
            <input id="ruleEnabled" type="checkbox" v-model="currentRule.enabled"
              class="h-4 w-4 rounded border-border-base text-primary focus:ring-primary bg-background-base dark:bg-background-surface" />
            <label for="ruleEnabled" class="ml-2 block text-sm text-text-base">启用此规则</label>
          </div>
        </div>
        <div v-else
          class="p-4 border border-border-base rounded-md text-center text-text-muted">
          请在左侧选择一个规则进行编辑，或添加一个新规则。
        </div>

        <!-- 测试区域 -->
        <div class="p-4 border border-border-base rounded-md bg-background-base dark:bg-background-surface">
          <h4 class="text-md font-semibold text-text-base mb-2">测试规则</h4>
          <div class="space-y-2">
            <div>
              <label for="testInput" class="block text-sm font-medium text-text-base">输入文本</label>
              <textarea id="testInput" rows="3" v-model="testInputText"
                class="mt-1 block w-full rounded-md border-border-base shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-background-base dark:bg-background-surface text-text-base p-2"
                placeholder="在此输入示例文本..."></textarea>
            </div>
            <div>
              <label for="testOutput" class="block text-sm font-medium text-text-base">输出结果
                (只读)</label>
              <textarea id="testOutput" rows="3" readonly v-model="testOutputText"
                class="mt-1 block w-full rounded-md border-border-base shadow-sm sm:text-sm bg-background-base-muted dark:bg-background-surface-muted text-text-muted p-2 cursor-not-allowed"></textarea>
            </div>
            <button @click="applyTestRules"
              class="btn btn-primary btn-sm">
              应用规则测试
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-end p-4 border-t border-border-base space-x-2">
      <button @click="closeModal"
        class="btn btn-ghost">
        取消
      </button>
      <button @click="saveChanges"
        class="btn btn-primary">
        保存更改
      </button>
    </div>
  </div>
</template>

<style scoped>
/* 可以在这里添加一些特定的样式，如果 Tailwind 不够用的话 */
/* 例如，自定义滚动条 */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.dark .overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
}
</style>