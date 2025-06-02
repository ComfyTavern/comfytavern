<template>
  <div class="inline-regex-rule-display" v-if="draggableRules.length > 0" @mousedown.stop>
    <draggable v-model="draggableRules" item-key="name" @end="onSortEnd" class="rule-list" :animation="200">
      <template #item="{ element: rule, index }">
        <div class="rule-item">
          <span class="rule-index">{{ index + 1 }}.</span>
          <Tooltip :content="getRuleTooltip(rule)" placement="top" :show-delay="300">
            <span class="rule-name">{{ rule.name }}</span>
          </Tooltip>
          <input
            type="checkbox"
            :checked="rule.enabled !== false"
            @change="toggleRuleEnabled(index)"
            class="rule-enabled-toggle"
            title="启用/禁用此规则"
          />
          <!-- 未来可以添加删除按钮 -->
        </div>
      </template>
    </draggable>
  </div>
  <div v-else class="empty-rules-placeholder" @mousedown.stop>
    没有内联规则。点击上方编辑按钮添加。
  </div>
  <!-- 未来可以添加 "添加新规则" 按钮 -->
</template>

<script setup lang="ts">
import { ref, watch, type PropType } from 'vue';
import draggable from 'vuedraggable';
import { klona } from 'klona/full';
import Tooltip from '../../common/Tooltip.vue'; // 假设 Tooltip 组件路径
import type { RegexRule } from '@comfytavern/types'; // 从共享类型导入

const props = defineProps({
  modelValue: {
    type: Array as PropType<RegexRule[]>,
    default: () => [],
  },
  // nodeId: { type: String, required: true }, // 暂时不用，但保留
  // inputKey: { type: String, required: true }, // 暂时不用，但保留
});

const emit = defineEmits(['update:modelValue']);

const draggableRules = ref<RegexRule[]>([]);

watch(
  () => props.modelValue,
  (newValue) => {
    // 只有当深比较不相等时才更新，避免不必要的 klona 和可能的循环更新
    if (JSON.stringify(draggableRules.value) !== JSON.stringify(newValue)) {
      draggableRules.value = klona(newValue);
    }
  },
  { deep: true, immediate: true }
);

const onSortEnd = () => {
  emit('update:modelValue', klona(draggableRules.value));
};

const toggleRuleEnabled = (index: number) => {
  if (draggableRules.value[index]) {
    // 确保 enabled 属性存在且是布尔值
    const currentEnabledState = draggableRules.value[index].enabled !== false; // true if undefined or true
    draggableRules.value[index].enabled = !currentEnabledState;
    emit('update:modelValue', klona(draggableRules.value));
  }
};

const getRuleTooltip = (rule: RegexRule): string => {
  let tooltipContent = `规则名: ${rule.name}\n`;
  tooltipContent += `启用状态: ${rule.enabled !== false ? '已启用' : '已禁用'}\n`;
  tooltipContent += `表达式: ${rule.pattern}\n`;
  if (rule.flags) {
    tooltipContent += `标志: ${rule.flags}\n`;
  }
  tooltipContent += `替换为: "${rule.replacement}"\n`;
  if (rule.description) {
    tooltipContent += `描述: ${rule.description}`;
  }
  return tooltipContent.trim();
};

</script>

<style scoped>
.inline-regex-rule-display {
  padding: 8px;
  margin-top: 4px;
  background-color: var(--ct-bg-surface, #f9fafb);
  border-radius: 4px;
  border: 1px solid var(--ct-border-DEFAULT, #d1d5db);
  min-height: 30px; /* 避免空列表时高度塌陷 */
}

.dark .inline-regex-rule-display {
  background-color: var(--ct-bg-surface-dark, #1f2937);
  border-color: var(--ct-border-dark, #4b5563);
}

.rule-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rule-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  background-color: var(--ct-bg-input, #ffffff);
  border: 1px solid var(--ct-border-input, #cbd5e1);
  border-radius: 3px;
  font-size: 0.9em;
  cursor: grab;
  color: var(--ct-text-default, #1f2937);
}

.dark .rule-item {
  background-color: var(--ct-bg-input-dark, #374151);
  border-color: var(--ct-border-input-dark, #6b7280);
  color: var(--ct-text-default-dark, #f3f4f6);
}

.rule-item:hover {
  border-color: var(--ct-accent-DEFAULT, #2563eb);
  /* box-shadow: 0 0 0 1px var(--ct-accent-DEFAULT, #2563eb); */ /* 暂时移除，避免过于抢眼 */
}

.dark .rule-item:hover {
  border-color: var(--ct-accent-dark, #3b82f6);
  /* box-shadow: 0 0 0 1px var(--ct-accent-dark, #3b82f6); */
}

.rule-index {
  color: var(--ct-text-muted, #6b7280);
  font-variant-numeric: tabular-nums;
  user-select: none; /* 不可选中 */
}

.dark .rule-index {
  color: var(--ct-text-muted-dark, #9ca3af);
}

.rule-name {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none; /* 不可选中 */
}

.rule-enabled-toggle {
  flex-shrink: 0;
  margin-left: auto; /* 将开关推到右侧 */
  cursor: pointer;
  /* 基础样式，可以后续替换为 BooleanToggle 或自定义样式 */
  width: 16px;
  height: 16px;
}

.empty-rules-placeholder {
  padding: 8px;
  margin-top: 4px;
  font-size: 0.9em;
  color: var(--ct-text-muted, #6b7280);
  text-align: center;
  border: 1px dashed var(--ct-border-DEFAULT, #d1d5db);
  border-radius: 4px;
  background-color: var(--ct-bg-surface-subtle, #f3f4f6);
}
.dark .empty-rules-placeholder {
  color: var(--ct-text-muted-dark, #9ca3af);
  border-color: var(--ct-border-dark, #4b5563);
  background-color: var(--ct-bg-surface-subtle-dark, #111827);
}
</style>
