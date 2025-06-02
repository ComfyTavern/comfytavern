<script setup lang="ts">
import { computed, ref, toRefs } from "vue";
import type { InputDefinition, NodeInputAction } from "@comfytavern/types";
import { BuiltInSocketMatchCategory, DataFlowType } from "@comfytavern/types"; // 确保路径正确, 添加 DataFlowType
import Tooltip from "../../common/Tooltip.vue"; // + 导入 Tooltip
// - 移除 MarkdownRenderer 的直接导入，因为 Tooltip 内部会处理
// import { useNodeState } from "@/composables/useNodeState"; // 稍后用于 showConditionKey

// 图标 (可以后续替换为更合适的图标库或SVG组件)
const IconEye = "👁️";
const IconEdit = "✏️";
// const IconMore = "..."; // 未使用
const IconChevronDown = "🔽";
const IconChevronUp = "🔼";

interface Props {
  nodeId: string;
  inputKey: string;
  inputDefinition: InputDefinition;
  inputValue?: any; // 可选的当前输入值，某些操作可能需要
}

const props = defineProps<Props>();
const { inputKey, inputDefinition, inputValue /*, nodeId */ } = toRefs(props); // inputValue 现在会用到

// const { getNodeStateValue } = useNodeState(nodeId.value); // 稍后用于 showConditionKey

// + 添加辅助函数
const getLanguageHintForInput = (inputDef: InputDefinition): string | undefined => {
  if (!inputDef) return undefined;
  if (inputDef.config?.languageHint) return inputDef.config.languageHint as string;
  if (inputDef.matchCategories?.includes(BuiltInSocketMatchCategory.JSON)) return 'json';
  if (inputDef.matchCategories?.includes(BuiltInSocketMatchCategory.MARKDOWN)) return 'markdown';
  if (inputDef.dataFlowType === DataFlowType.STRING && inputDef.matchCategories?.includes(BuiltInSocketMatchCategory.CODE)) {
    const codeLangCategory = inputDef.matchCategories.find(cat => cat.toLowerCase().startsWith('code:'));
    if (codeLangCategory) {
      return codeLangCategory.split(':')[1]?.toLowerCase() || 'plaintext';
    }
    return 'plaintext';
  }
  return undefined;
};

const getFormattedPreviewString = (currentValue: any, inputDef: InputDefinition): string => {
  if (!inputDef) return "无定义信息";
  const langHint = getLanguageHintForInput(inputDef);

  if (currentValue === undefined || currentValue === null) return "无内容";

  let strValue = "";
  let processedValue = currentValue;

  if (langHint === 'json' && typeof currentValue === 'string') {
    try {
      const parsed = JSON.parse(currentValue);
      if (typeof parsed === 'object' && parsed !== null) {
        processedValue = parsed;
      }
    } catch (e) { /* Parsing failed, use original string value */ }
  }

  if (typeof processedValue === 'object' && processedValue !== null) {
    try {
      strValue = JSON.stringify(processedValue, null, 2); // Beautify JSON
    } catch {
      strValue = "[无法序列化的对象]";
    }
  } else {
    strValue = String(processedValue);
  }

  if (strValue.trim() === "") {
    if (langHint === 'json') return "空JSON内容";
    if (langHint === 'markdown') return "空Markdown内容";
    if (langHint) return `空 ${langHint} 内容`;
    return "无内容";
  }
  return strValue;
};

const previewContentForTooltip = computed(() => {
  const displayName = inputDefinition.value.displayName;
  const header = `**${displayName}**\n`; // 加粗的 displayName 作为头部

  const langHint = getLanguageHintForInput(inputDefinition.value);
  const rawPreviewString = getFormattedPreviewString(inputValue.value, inputDefinition.value);
  let formattedContent = "";

  if (langHint === 'markdown') {
    // Tooltip.vue 会用 MarkdownRenderer 处理 content prop
    formattedContent = rawPreviewString;
  } else if (langHint === 'json' || (inputDefinition.value.dataFlowType === DataFlowType.STRING && inputDefinition.value.matchCategories?.includes(BuiltInSocketMatchCategory.CODE))) {
    // 对于 JSON 和代码，包装成 Markdown 代码块，Tooltip.vue 会正确渲染
    formattedContent = '```' + (langHint || 'text') + '\n' + rawPreviewString + '\n' + '```';
  } else {
    // 对于普通文本，Tooltip.vue 的 MarkdownRenderer 应该会原样输出
    // 加粗的 displayName 已经是 Markdown 格式，所以普通文本可以直接拼接
    formattedContent = rawPreviewString;
  }
  return header + formattedContent; // 将头部和格式化后的内容拼接
});

const emit = defineEmits<{
  (
    event: "action-triggered",
    payload: {
      handlerType: NodeInputAction['handlerType']; // 使用推断的类型
      handlerArgs?: any;
      inputKey: string;
      actionId?: string; // 用于区分自定义操作
    }
  ): void;
}>();

const isExpanded = ref(false); // 控制“更多”按钮的展开状态
const maxVisibleActions = 2; // 未展开时最多显示的按钮数量 (不包括“更多”按钮)

// 标准操作按钮的定义
const standardActions = computed<NodeInputAction[]>(() => {
  const actions: NodeInputAction[] = [];
  const categories = inputDefinition.value.matchCategories || [];

  // 预览按钮
  if (categories.includes(BuiltInSocketMatchCategory.CanPreview)) {
    actions.push({
      id: "builtin_preview",
      icon: IconEye,
      tooltip: "预览",
      handlerType: "builtin_preview",
      showConditionKey: "always", // 显式提供，符合 schema default
    });
  }

  // 编辑按钮 (如果允许默认编辑)
  if (!categories.includes(BuiltInSocketMatchCategory.NoDefaultEdit)) {
    // 假设所有可连接的输入都可编辑，除非明确禁止
    // 或者可以根据 dataFlowType 进一步判断
    actions.push({
      id: "builtin_editor",
      icon: IconEdit,
      tooltip: "编辑",
      handlerType: "builtin_editor",
      showConditionKey: "always", // 显式提供，符合 schema default
    });
  }
  return actions;
});

// 合并标准操作和自定义操作
const allAvailableActions = computed<NodeInputAction[]>(() => {
  const customActions = inputDefinition.value.actions || [];
  // 简单合并，后续可以考虑去重或更复杂的合并逻辑
  return [...standardActions.value, ...customActions];
});

// 根据 showConditionKey 过滤操作
const visibleActions = computed<NodeInputAction[]>(() => {
  return allAvailableActions.value.filter((action) => {
    if (action.showConditionKey) {
      // const conditionMet = getNodeStateValue(action.showConditionKey, false);
      // return !!conditionMet;
      return true; // 暂时总是显示，待实现 useNodeState
    }
    return true;
  });
});

const displayedActions = computed(() => {
  if (isExpanded.value || visibleActions.value.length <= maxVisibleActions) {
    return visibleActions.value;
  }
  return visibleActions.value.slice(0, maxVisibleActions);
});

const hasMoreActions = computed(() => {
  return visibleActions.value.length > maxVisibleActions;
});

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value;
};

const handleActionClick = (action: NodeInputAction) => {
  emit("action-triggered", {
    handlerType: action.handlerType,
    handlerArgs: action.handlerArgs,
    inputKey: inputKey.value,
    actionId: action.id,
  });
};
</script>

<template>
  <div v-if="visibleActions.length > 0" class="node-input-actions-bar">
    <template v-for="action in displayedActions" :key="action.id">
      <!-- 标准预览按钮，使用 Tooltip -->
      <Tooltip
        v-if="action.id === 'builtin_preview'"
        placement="top"
        :maxWidth="600"
        :showDelay="300"
        :interactive="true"
        :content="previewContentForTooltip"
        :allowHtml="true"
      >
        <!-- 内容现在由 previewContentForTooltip 提供，并由 Tooltip.vue 内部渲染 -->
        <button
          class="action-button"
          :title="action.tooltip"
          @click="handleActionClick(action)"
        >
          <span v-if="action.icon" class="icon">{{ action.icon }}</span>
          <span v-else-if="action.label" class="label">{{ action.label }}</span>
        </button>
      </Tooltip>
      <!-- 其他操作按钮 -->
      <button
        v-else
        class="action-button"
        :title="action.tooltip"
        @click="handleActionClick(action)"
      >
        <span v-if="action.icon" class="icon">{{ action.icon }}</span>
        <span v-else-if="action.label" class="label">{{ action.label }}</span>
      </button>
    </template>
    <button
      v-if="hasMoreActions"
      class="action-button more-button"
      :title="isExpanded ? '收起' : '更多操作'"
      @click="toggleExpand"
    >
      <span class="icon">{{ isExpanded ? IconChevronUp : IconChevronDown }}</span>
    </button>
  </div>
</template>

<style scoped>
.node-input-actions-bar {
  display: flex;
  align-items: center;
  gap: 4px; /* 按钮之间的间隙 */
  /* flex-wrap: wrap; */ /* 暂时不换行，通过“更多”按钮控制 */
}
.action-button {
  padding: 1px 2px; /* 减小内边距 */
  border: none; /* 移除边框 */
  background-color: transparent; /* 透明背景 */
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 20px; /* 减小最小宽度 */
  min-height: 20px; /* 减小最小高度 */
  color: inherit; /* 继承父组件的文字颜色，确保在不同主题下可见性 */
}

.action-button:hover {
  background-color: rgba(128, 128, 128, 0.15); /* 使用半透明灰色作为悬停背景 */
}

.icon {
  font-size: 0.9em; /* 稍微缩小图标 */
}


.label {
  font-size: 0.8em;
}

/* 可以为特定类型的按钮添加样式 */
.more-button {
  /* 特殊样式 */
}
</style>