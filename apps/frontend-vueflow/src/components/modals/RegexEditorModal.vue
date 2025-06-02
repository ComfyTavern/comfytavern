<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { klona } from 'klona/lite'; // 用于深拷贝
import type { RegexRule } from '@comfytavern/types';
import draggable from 'vuedraggable';

// 内部使用的、带有临时拖拽 ID 的规则类型
type InternalRegexRule = RegexRule & { _internal_id_for_drag: symbol };

// 临时的 RegexRule 定义，后续应从 @comfytavern/types 导入
// interface RegexRule {
//   name: string;
//   pattern: string;
//   replacement: string;
//   flags?: string;
//   description?: string;
//   enabled?: boolean;
// }

const props = defineProps<{
  modelValue: RegexRule[]; // 外部传入的规则数组
  visible: boolean; // 控制模态框显示/隐藏
  nodeId?: string; // 可选，用于标识节点
  inputKey?: string; // 可选，用于标识输入槽
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', rules: RegexRule[]): void;
  (e: 'update:visible', visible: boolean): void;
  (e: 'save', rules: RegexRule[]): void; // 保存时触发
}>();
const internalRules = ref<InternalRegexRule[]>([]); // 使用 InternalRegexRule
const selectedRuleIndex = ref<number | null>(null);

// 当外部 modelValue 变化时，深拷贝到内部状态并添加拖拽 ID
watch(() => props.modelValue, (newVal) => {
  if (props.visible) { // 仅在模态框可见时同步
    internalRules.value = klona(newVal || []).map(rule => ({ ...rule, _internal_id_for_drag: Symbol() }));
    if (internalRules.value.length > 0 && selectedRuleIndex.value === null) {
      selectedRuleIndex.value = 0; // 默认选中第一个
    } else if (internalRules.value.length === 0) {
      selectedRuleIndex.value = null;
    } else if (selectedRuleIndex.value !== null && selectedRuleIndex.value >= internalRules.value.length) {
      // 如果之前的选中索引超出了新数组范围，则重置
      selectedRuleIndex.value = internalRules.value.length > 0 ? internalRules.value.length - 1 : null;
    }
  }
}, { deep: true, immediate: true });

// 当模态框可见性变化时，如果变为可见且 modelValue 有值，则同步并添加拖拽 ID
watch(() => props.visible, (newValVisible) => {
  if (newValVisible) {
    // 从 props.modelValue 初始化 internalRules，并为每个规则添加唯一的拖拽 ID
    internalRules.value = klona(props.modelValue || []).map(rule => ({ ...rule, _internal_id_for_drag: Symbol() }));
    if (internalRules.value.length > 0 && selectedRuleIndex.value === null) {
      selectedRuleIndex.value = 0;
    } else if (internalRules.value.length === 0) {
      selectedRuleIndex.value = null;
    } else if (selectedRuleIndex.value !== null && selectedRuleIndex.value >= internalRules.value.length) {
      selectedRuleIndex.value = internalRules.value.length > 0 ? internalRules.value.length - 1 : null;
    }
  } else {
    selectedRuleIndex.value = null;
  }
});

const currentRule = computed(() => {
  if (selectedRuleIndex.value !== null && internalRules.value[selectedRuleIndex.value]) {
    return internalRules.value[selectedRuleIndex.value];
  }
  return null;
});

const closeModal = () => {
  emit('update:visible', false);
};

const saveChanges = () => {
  // 在保存前，移除临时的 _internal_id_for_drag 属性
  const rulesToSave = klona(internalRules.value).map(({ _internal_id_for_drag, ...rest }: InternalRegexRule) => rest as RegexRule);
  emit('update:modelValue', rulesToSave);
  emit('save', rulesToSave);
  closeModal();
};

const addNewRule = () => {
  const newRule: InternalRegexRule = {
    _internal_id_for_drag: Symbol(), // 添加拖拽 ID
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
    const rule = internalRules.value[selectedRuleIndex.value]; // rule is InternalRegexRule | undefined
    if (rule) { // 明确检查 rule 是否存在 (不是 undefined)
      selectedRuleForDrag.value = rule; // rule 被窄化为 InternalRegexRule
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
    const newIndex = internalRules.value.findIndex((rule: InternalRegexRule) => rule._internal_id_for_drag === draggedId);
    if (newIndex !== -1) {
      selectedRuleIndex.value = newIndex;
    } else {
      // 如果找不到（理论上不应该发生，除非规则在拖拽中被外部修改）
      // 尝试保持当前选择或选择第一个
      if (internalRules.value.length > 0) {
        const currentSelectedStillExists = selectedRuleIndex.value !== null && selectedRuleIndex.value < internalRules.value.length;
        if (!currentSelectedStillExists) {
          selectedRuleIndex.value = 0;
        }
        // 如果 currentSelectedStillExists 为 true，则 selectedRuleIndex.value 保持不变
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
  // 如果没有规则，或者没有输入文本但有规则（此时结果也是空或取决于规则如何处理空输入）
  // 为简化，如果无规则，输出即输入；如果有规则但无输入，则按规则处理空字符串
  if (internalRules.value.filter(r => r.enabled).length === 0) {
    testOutputText.value = testInputText.value;
    return;
  }

  let tempText = testInputText.value;
  try {
    for (const rule of internalRules.value) {
      if (rule.enabled && typeof rule.pattern === 'string' && rule.pattern) {
        const regex = new RegExp(rule.pattern, rule.flags || '');
        // 确保 replacement 是字符串，如果它是 undefined，则视为空字符串
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

// 当测试输入或规则列表（包括内部属性）变化时，清除测试输出
watch(
  [testInputText, internalRules],
  () => {
    testOutputText.value = '';
  },
  { deep: true } // deep: true 用于侦听 internalRules 数组内部对象属性的变化
);

</script>

<template>
  <div v-if="visible" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    @mousedown.self="closeModal">
    <div
      class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
      @mousedown.stop>
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200">
          编辑内联正则规则 {{ nodeId ? `(节点: ${nodeId})` : '' }}
        </h3>
        <button @click="closeModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
            stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="flex-grow flex overflow-hidden p-4 space-x-4">
        <!-- 左侧: 规则列表 -->
        <div class="w-1/3 flex flex-col border border-gray-200 dark:border-gray-700 rounded-md">
          <div class="p-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">规则列表</span>
            <button @click="addNewRule"
              class="p-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300" title="添加新规则">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
          <div class="flex-grow overflow-y-auto">
            <draggable v-if="internalRules.length > 0" v-model="internalRules" item-key="_internal_id_for_drag" tag="ul"
              ghost-class="opacity-50 bg-blue-100 dark:bg-blue-800 !border !border-blue-500" handle=".drag-handle"
              @start="handleDragStart" @end="handleDragEnd" class="divide-y divide-gray-200 dark:divide-gray-600">
              <template #item="{ element: rule, index }"> <!-- rule is InternalRegexRule here -->
                <li @click="selectedRuleIndex = index"
                  class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center group relative"
                  :class="{ 'bg-blue-100 dark:bg-blue-700 text-blue-700 dark:text-blue-200': selectedRuleIndex === index }">
                  <span
                    class="drag-handle cursor-move text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 mr-2 flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                      stroke="currentColor" class="w-5 h-5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                    </svg>
                  </span>
                  <input type="checkbox" v-model="rule.enabled" @click.stop
                    class="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700 mr-2 flex-shrink-0"
                    :title="rule.enabled ? '禁用此规则' : '启用此规则'" />
                  <span class="truncate flex-grow" :title="rule.name">{{ rule.name }}</span>
                  <button @click.stop="deleteRule(index)"
                    class="p-0.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 opacity-0 group-hover:opacity-100 ml-2 flex-shrink-0"
                    title="删除规则">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2"
                      stroke="currentColor" class="w-4 h-4">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              </template>
            </draggable>
            <p v-else class="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">暂无规则。</p>
          </div>
        </div>

        <!-- 右侧: 规则详情 & 测试 -->
        <div class="w-2/3 flex flex-col space-y-4 overflow-y-auto pr-1">
          <!-- 规则编辑表单 -->
          <div v-if="currentRule"
            class="p-4 border border-gray-200 dark:border-gray-700 rounded-md space-y-3 bg-gray-50 dark:bg-gray-750">
            <h4 class="text-md font-semibold text-gray-800 dark:text-gray-200 mb-2">编辑规则: {{ currentRule.name }}</h4>
            <div>
              <label for="ruleName" class="block text-sm font-medium text-gray-700 dark:text-gray-300">名称</label>
              <input type="text" id="ruleName" v-model="currentRule.name"
                class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-2" />
            </div>
            <div>
              <label for="rulePattern" class="block text-sm font-medium text-gray-700 dark:text-gray-300">正则表达式</label>
              <input type="text" id="rulePattern" v-model="currentRule.pattern"
                class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-2 font-mono" />
            </div>
            <div>
              <label for="ruleReplacement"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300">替换为</label>
              <input type="text" id="ruleReplacement" v-model="currentRule.replacement"
                class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-2" />
            </div>
            <div>
              <label for="ruleFlags" class="block text-sm font-medium text-gray-700 dark:text-gray-300">标志 (例如: gi,
                m)</label>
              <input type="text" id="ruleFlags" v-model="currentRule.flags"
                class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-2" />
            </div>
            <div>
              <label for="ruleDescription" class="block text-sm font-medium text-gray-700 dark:text-gray-300">描述
                (可选)</label>
              <textarea id="ruleDescription" v-model="currentRule.description" rows="2"
                class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-2"></textarea>
            </div>
            <div class="flex items-center">
              <input id="ruleEnabled" type="checkbox" v-model="currentRule.enabled"
                class="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700" />
              <label for="ruleEnabled" class="ml-2 block text-sm text-gray-900 dark:text-gray-300">启用此规则</label>
            </div>
          </div>
          <div v-else
            class="p-4 border border-gray-200 dark:border-gray-700 rounded-md text-center text-gray-500 dark:text-gray-400">
            请在左侧选择一个规则进行编辑，或添加一个新规则。
          </div>

          <!-- 测试区域 -->
          <div class="p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-750">
            <h4 class="text-md font-semibold text-gray-800 dark:text-gray-200 mb-2">测试规则</h4>
            <div class="space-y-2">
              <div>
                <label for="testInput" class="block text-sm font-medium text-gray-700 dark:text-gray-300">输入文本</label>
                <textarea id="testInput" rows="3" v-model="testInputText"
                  class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-2"
                  placeholder="在此输入示例文本..."></textarea>
              </div>
              <div>
                <label for="testOutput" class="block text-sm font-medium text-gray-700 dark:text-gray-300">输出结果
                  (只读)</label>
                <textarea id="testOutput" rows="3" readonly v-model="testOutputText"
                  class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm sm:text-sm bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 p-2 cursor-not-allowed"></textarea>
              </div>
              <button @click="applyTestRules"
                class="px-3 py-1.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800">
                应用规则测试
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end p-4 border-t border-gray-200 dark:border-gray-700 space-x-2">
        <button @click="closeModal"
          class="px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800">
          取消
        </button>
        <button @click="saveChanges"
          class="px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800">
          保存更改
        </button>
      </div>
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