<script setup lang="ts">
// 第 1 部分：导入
// Vue 和 VueFlow 核心
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from "vue"; // 添加 onMounted, onUnmounted
import { useI18n } from "vue-i18n";
import { useVueFlow, Handle, Position, type NodeProps } from "@vue-flow/core";

// Pinia 和状态存储
import { storeToRefs } from "pinia";
// import { useThemeStore } from "../../../stores/theme"; // 不再需要
import { useTabStore } from "../../../stores/tabStore";
import { useExecutionStore } from "../../../stores/executionStore";
import { useProjectStore } from '@/stores/projectStore'; // 新增 (useTabManagement 移除)
import { useUiStore } from "../../../stores/uiStore"; // +++ 导入 UI Store
// import { usePerformanceStatsStore } from '@/stores/performanceStatsStore'; // 已移除：不再在此处统计组件

// 项目类型和工具函数
import {
  DataFlowType,
  type HistoryEntry,
  type InputDefinition,
  BuiltInSocketMatchCategory,
  ExecutionStatus,
  type NodeInputAction, // + 导入 NodeInputAction
  type RegexRule, // +++ 导入 RegexRule 类型
} from "@comfytavern/types";
import { createHistoryEntry } from "@comfytavern/utils";

// 可组合函数
import { useNodeResize } from "../../../composables/node/useNodeResize";
import { useGroupIOSlots } from "../../../composables/group/useGroupIOSlots";
import { useNodeState } from "../../../composables/node/useNodeState";
import { useNodeProps as useNodePropsComposable } from "../../../composables/node/useNodeProps";
import { useNodeActions } from "../../../composables/node/useNodeActions";
import { useWorkflowInteractionCoordinator } from "../../../composables/workflow/useWorkflowInteractionCoordinator";
import { useNodeClientScript } from "../../../composables/node/useNodeClientScript";
import { useWorkflowManager } from "../../../composables/workflow/useWorkflowManager";

import { useWorkflowPreview } from "../../../composables/workflow/useWorkflowPreview"; // 清理：保留一个导入，移除 type NodePreviewStatus

// 组件
import { getInputComponent } from "../inputs";
import Tooltip from "../../common/Tooltip.vue";
// import MarkdownRenderer from "../../common/MarkdownRenderer.vue"; // - 移除未使用的导入
import InlineConnectionSorter from '../inputs/InlineConnectionSorter.vue';
import NodeInputActionsBar from "./NodeInputActionsBar.vue"; // + 导入新组件
// 常量和样式
import {
  HANDLE_LINE_HEIGHT,
  HANDLE_VERTICAL_PADDING,
  MIN_MULTI_HANDLE_HEIGHT_FACTOR,
  HANDLE_WIDTH,
} from "../../../constants/handleConstants";
import styles from "./handleStyles.module.css";

// 第 2 部分：Props
const props = defineProps<NodeProps>();
// 调试日志：打印接收到的节点定义内容 (深拷贝以展开)
// console.log(`[BaseNode Debug] Received node definition for ${props.id}:`, JSON.parse(JSON.stringify(props.data)));

// 第 3 部分：本地 Refs
const nodeRootRef = ref<HTMLDivElement | null>(null); // 节点根元素引用

// 第 4 部分：Composables、Store 实例和 Store Refs
const { t } = useI18n();
// Store
// const themeStore = useThemeStore(); // 不再需要，因为 isDark 已移除
// const isDark = computed(() => themeStore.currentAppliedMode === 'dark'); // 不再需要，由 Tailwind dark: 前缀自动处理
const executionStore = useExecutionStore(); // 获取执行状态 Store 实例
const tabStore = useTabStore();
const { activeTabId } = storeToRefs(tabStore);
const projectStore = useProjectStore();
const { currentProjectId } = storeToRefs(projectStore); // 只解构 currentProjectId
// const performanceStatsStore = usePerformanceStatsStore(); // 已移除：不再在此处统计组件

// VueFlow 和工作流管理器
const vueFlowInstance = useVueFlow(); // 确保 vueFlowInstance 在此作用域
const interactionCoordinator = useWorkflowInteractionCoordinator(); // 获取工作流交互协调器实例
const workflowManager = useWorkflowManager(); // 获取工作流管理器实例
const uiStore = useUiStore(); // +++ 获取 UI Store 实例

// 节点特定的 Composables
const { width, isResizing, startResize } = useNodeResize(props); // 使用节点宽度调整 Composable
const {
  isInputConnected,
  // getInputConnectionCount, // 原始代码中已注释
  isMultiInput,
  getInputValue,
  updateInputValue,
  getConfigValue,
  updateConfigValue,
} = useNodeState(props);
// 重命名导入的函数以避免与计算属性映射冲突
const { getInputProps: calculateInputProps, getConfigProps: calculateConfigProps } =
  useNodePropsComposable(props);
const { isNodeGroup } = useNodeActions(props); // 使用节点操作 Composable (移除了未使用的 editNodeGroup)
// 使用重构后的 useGroupIOSlots，它现在接收完整 props 并返回 finalInputs/finalOutputs
const { finalInputs, finalOutputs } = useGroupIOSlots(props);
const { clientScriptError, handleButtonClick, executeClientHook } = useNodeClientScript({ // 使用客户端脚本 Composable
  ...props,
  updateInputValue,
  getInputValue,
}); // 添加 executeClientHook，并传入 props 和需要的函数
const { updateNodeInternals } = vueFlowInstance; // 从 useVueFlow 获取更新函数

const { nodePreviewStates, isPreviewEnabled } = useWorkflowPreview(); // 清理：保留一个调用

// 第 5 部分：计算属性

// 节点信息和元数据
const nodeIdNumber = computed(() => {
  const match = props.id.match(/_(\d+)$/);
  return match ? match[1] : null; // 如果匹配到数字则返回，否则返回 null
});

// 执行状态
const nodeExecutionStatus = computed(() => {
  if (!activeTabId.value) {
    // 如果没有活动标签页，返回 IDLE 状态
    return ExecutionStatus.IDLE;
  }
  // 使用新的 getter 获取状态，传入 internalId 和 nodeId
  return executionStore.getNodeState(activeTabId.value, props.id) || ExecutionStatus.IDLE;
});

const nodeExecutionError = computed(() => {
  if (!activeTabId.value) {
    return null;
  }
  // 使用新的 getter 获取错误信息
  return executionStore.getNodeError(activeTabId.value, props.id);
});

// 节点组信息
const nodeGroupInfo = computed(() => {
  if (!isNodeGroup.value || !props.data.groupInfo) {
    return null;
  }
  // 假设 props.data.groupInfo 中提供了所需信息
  return {
    nodeCount: props.data.groupInfo.nodeCount ?? "?",
    inputCount: props.data.groupInfo.inputCount ?? "?",
    outputCount: props.data.groupInfo.outputCount ?? "?",
  };
});

const referencedWorkflowId = computed(() => {
  if (isNodeGroup.value) { // 使用现有的 isNodeGroup 计算属性
    const refId = getConfigValue('referencedWorkflowId') as string | undefined;
    // 确保返回的是真值字符串
    if (refId && typeof refId === 'string' && refId.trim() !== '') {
      return refId;
    }
  }
  return undefined;
});

// 动态组件的 Props 映射
const inputPropsMap = computed(() => {
  const map: Record<string, Record<string, any>> = {};
  // 确保在 computed 内部访问 finalInputs.value
  const inputs = finalInputs.value; // 使用 finalInputs
  if (inputs) {
    for (const input of inputs) {
      const inputKey = String(input.key);
      // 调用原始的计算逻辑
      map[inputKey] = calculateInputProps(input, inputKey);
    }
  }
  return map;
});

const configPropsMap = computed(() => {
  const map: Record<string, Record<string, any>> = {};
  if (props.data.configSchema) {
    for (const [key, configDef] of Object.entries(props.data.configSchema)) {
      // 调用原始的计算逻辑
      map[key] = calculateConfigProps(configDef as InputDefinition, key);
    }
  }
  return map;
});

// 用于 Watcher 的 IO 顺序键
const inputOrderKey = computed(() => finalInputs.value.map((i) => String(i.key)).join(","));
const outputOrderKey = computed(() => finalOutputs.value.map((o) => String(o.key)).join(","));

// Tooltip 内容
const tooltipContentForNodeTitle = computed(() => {
  let content = "";
  if (props.data.description) {
    // formatDescription 仅处理 \n，Markdown 渲染器处理 Markdown 语法
    content += formatDescription(props.data.description);
  }
  if (props.data.defaultLabel && props.data.defaultLabel !== props.label) {
    if (content) {
      // 添加 Markdown 分隔符
      content += "\n\n---\n\n";
    }
    content += t('graph.nodes.baseNode.tooltipDefaultName', { name: props.data.defaultLabel });
  }
  // 如果没有内容，确保返回 undefined 或空字符串，以便 Tooltip 正确处理
  return content || undefined;
});

// Handle 和布局样式
const multiInputSlotContainerStyle = computed(() => {
  const stylesMap: Record<string, any> = {};
  if (finalInputs.value) {
    for (const input of finalInputs.value) {
      if (input.multi) {
        const currentInputKey = String(input.key);
        const actualInteractiveSlots = getNumChildHandles(currentInputKey); // 获取实际要渲染的交互式子句柄数量
        const visualSlotsForHeightCalc = Math.max(actualInteractiveSlots, MIN_MULTI_HANDLE_HEIGHT_FACTOR);
        const totalVerticalPaddingForContainer = HANDLE_VERTICAL_PADDING;
        const minContainerHeight =
          visualSlotsForHeightCalc * (HANDLE_LINE_HEIGHT + HANDLE_VERTICAL_PADDING) + // 基于视觉槽位数计算高度
          totalVerticalPaddingForContainer; // 容器自身的上下内边距

        stylesMap[currentInputKey] = {
          display: 'flex',
          flexDirection: 'column' as 'column',
          padding: `${HANDLE_VERTICAL_PADDING / 2}px 4px`, // 容器的内边距
          gap: `0px`, // 子 Handle 项之间无间隙
          minHeight: `${minContainerHeight}px`,
          position: 'absolute',   // 改为绝对定位
          top: '0px',             // 从顶部开始定位
          zIndex: 15,             // 设置合适的 z-index
          boxSizing: 'border-box',
          left: `-${HANDLE_WIDTH / 2}px`, // 向左偏移
        };
      }
    }
  }
  return stylesMap;
});

const previewStatusClass = computed(() => { // 清理：保留一个定义
  if (!isPreviewEnabled.value || !activeTabId.value) {
    return null;
  }
  const status = nodePreviewStates.value[props.id];
  // 仅当状态有效且不是 'unknown' 时应用特定类
  if (status && status !== 'unknown') {
    // 将下划线替换为短横线以匹配 CSS 类命名约定
    return `preview-${status.replace(/_/g, '-')}`;
  }
  return null;
});

// 第 6 部分：辅助函数

// UI 条件判断和信息提取器
const getNodeLabelForSorter = (nodeId: string): string => {
  const node = vueFlowInstance.getNode.value(nodeId); // 更正：getNode 是一个 ComputedRef，其 .value 是函数
  return node?.label || node?.data?.displayName || node?.type || nodeId;
};

const shouldShowSorter = (input: (typeof finalInputs.value)[0]): boolean => {
  return !!input.multi && // 确保 input.multi 是 true
    !(input.dataFlowType === DataFlowType.WILDCARD &&
      input.matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER));
};

const isSimpleInlineInput = (input: InputDefinition): boolean => {
  // 如果后端指定了特定的内联组件，则它不是“简单”内联输入
  if (input.config?.component) return false;

  if (input.dataFlowType === DataFlowType.WILDCARD && input.matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER)) return false;
  if (input.dataFlowType === DataFlowType.STRING && input.matchCategories?.includes(BuiltInSocketMatchCategory.CODE)) return false;
  if (input.dataFlowType === DataFlowType.STRING && input.config?.multiline) return false;
  if (input.dataFlowType === DataFlowType.STRING && input.matchCategories?.includes(BuiltInSocketMatchCategory.MARKDOWN)) return false;
  if (input.dataFlowType === DataFlowType.OBJECT && input.matchCategories?.includes(BuiltInSocketMatchCategory.JSON)) return false;
  if (input.dataFlowType === DataFlowType.OBJECT && input.matchCategories?.includes(BuiltInSocketMatchCategory.CHAT_HISTORY)) return false;

  return (
    input.dataFlowType === DataFlowType.INTEGER ||
    input.dataFlowType === DataFlowType.FLOAT ||
    input.dataFlowType === DataFlowType.BOOLEAN ||
    (input.dataFlowType === DataFlowType.STRING && !!input.config?.suggestions) || // COMBO
    (input.dataFlowType === DataFlowType.STRING && !input.config?.multiline && !input.matchCategories?.some(cat => (cat === BuiltInSocketMatchCategory.CODE || cat === BuiltInSocketMatchCategory.MARKDOWN)))
  );
};

// showActionButtonsForInput 函数已移除，其逻辑由 NodeInputActionsBar 处理

const getLanguageHintForInput = (input: InputDefinition): string | undefined => {
  if (input.config?.languageHint) return input.config.languageHint;
  if (input.matchCategories?.includes(BuiltInSocketMatchCategory.JSON)) return 'json';
  if (input.matchCategories?.includes(BuiltInSocketMatchCategory.MARKDOWN)) return 'markdown';
  if (input.dataFlowType === DataFlowType.STRING && input.matchCategories?.includes(BuiltInSocketMatchCategory.CODE)) {
    if (input.matchCategories?.find(cat => cat.toLowerCase() === 'code:javascript')) return 'javascript';
    if (input.matchCategories?.find(cat => cat.toLowerCase() === 'code:python')) return 'python';
    return 'plaintext'; // 对于通用的 CODE 类型，默认为纯文本
  }
  return undefined;
};

// 数据格式化器
const formatDescription = (desc: string | undefined): string | undefined => {
  if (!desc) return undefined;
  return desc.replace(/\\n/g, "\n"); // 全局替换字面量 '\\n' 为实际换行符 '\n'
};

const formatOutputValueForTooltip = (value: any): string => {
  if (value === undefined || value === null) {
    return t('graph.nodes.baseNode.tooltipNoValue');
  }
  if (typeof value === "string") {
    return value.length > 100 ? value.substring(0, 97) + "..." : value;
  }
  if (typeof value === "object") {
    try {
      const jsonString = JSON.stringify(value);
      return jsonString.length > 100 ? jsonString.substring(0, 97) + "..." : jsonString;
    } catch (e) {
      return t('graph.nodes.baseNode.tooltipUnserializableObject');
    }
  }
  return String(value);
};

// - 移除未使用的 getFormattedPreviewString 函数

// Handle 样式和布局计算器
const getHandleTypeClass = (type: string | undefined): string | null => {
  if (!type) return null;
  const upperType = type.toUpperCase(); // 将类型转换为大写以匹配 CSS 类名
  const className = `handleType${upperType}`;
  return styles[className] ? styles[className] : null; // 确保 CSS 模块中有这个类
};

const isAnyType = (type: string | undefined): boolean => {
  return type === DataFlowType.WILDCARD || type === DataFlowType.CONVERTIBLE_ANY;
};

const getStandardHandleStyles = (isChild: boolean = false) => {
  const styleObj: Record<string, string> = {};
  if (isChild) {
    styleObj.width = '100%';
    styleObj.height = '100%';
    styleObj.borderRadius = '0';
    styleObj.border = 'none';
    styleObj.backgroundColor = 'transparent';
    styleObj.boxShadow = 'none';
    styleObj.margin = '0';
    styleObj.padding = '0';
  } else {
    styleObj.width = `${HANDLE_WIDTH}px`;
    styleObj.height = `${HANDLE_LINE_HEIGHT + HANDLE_VERTICAL_PADDING}px`;
    styleObj.borderRadius = '50%';
  }
  return styleObj;
};

const getNumChildHandles = (inputKey: string): number => {
  const inputDefinition = finalInputs.value.find(i => String(i.key) === inputKey);
  if (!inputDefinition || !inputDefinition.multi) {
    return 0;
  }
  const connectionsArray = props.data?.inputConnectionOrders?.[inputKey];
  const numConnections = connectionsArray ? connectionsArray.length : 0;

  if (inputDefinition?.allowMoreConnections === false && numConnections >= (inputDefinition.maxConnections ?? Infinity)) {
    return numConnections;
  }
  return numConnections + 1;
};

const getDynamicParamHeaderStyle = (inputDef: (typeof finalInputs.value)[number]) => {
  const styleObj: Record<string, string> = {};
  if (inputDef.multi) {
    const runwayContainerStyle = multiInputSlotContainerStyle.value[String(inputDef.key)];
    if (runwayContainerStyle && runwayContainerStyle.minHeight) {
      const runwayMinHeightPx = parseFloat(runwayContainerStyle.minHeight);
      const defaultParamHeaderMinHeight = 24; // .param-header 在 CSS 中有 min-height: 24px;
      const requiredMinHeight = Math.max(defaultParamHeaderMinHeight, runwayMinHeightPx);
      styleObj.minHeight = `${requiredMinHeight}px`;
    }
  }
  return styleObj;
};

// 事件处理器和交互协调器
const handleComponentBlur = (inputKey: string, currentValue: string) => {
  if (!activeTabId.value) {
    console.warn(t('graph.nodes.baseNode.consoleWarnCannotRecordBlurNoActiveTab', { nodeId: props.id }));
    return;
  }
  const inputDefinition = finalInputs.value.find((i) => String(i.key) === inputKey);
  const inputDisplayName = inputDefinition?.displayName || inputKey;
  const truncatedValue =
    currentValue.length > 30 ? currentValue.substring(0, 27) + "..." : currentValue;
  const nodeName = props.data.displayName || props.data.label || t('graph.nodes.baseNode.unnamedNode');
  const summary = t('graph.nodes.baseNode.historyEditSummary', { nodeName, inputDisplayName, value: truncatedValue });
  const entry: HistoryEntry = createHistoryEntry(
    "update",
    "nodeInputValue",
    summary,
    { inputKey: inputKey, value: truncatedValue }
  );
  interactionCoordinator.updateNodeInputValueAndRecord(
    activeTabId.value,
    props.id,
    inputKey,
    currentValue,
    entry
  );
};

const handleComponentResizeEnd = (inputKey: string, payload: { newHeight: number }) => {
  if (!activeTabId.value) {
    console.warn(t('graph.nodes.baseNode.consoleWarnCannotRecordResizeNoActiveTab', { nodeId: props.id }));
    return;
  }
  const { newHeight } = payload;
  const inputDefinition = finalInputs.value.find((i) => String(i.key) === inputKey);
  const inputDisplayName = inputDefinition?.displayName || inputKey;
  const nodeName = props.data.displayName || props.data.label || t('graph.nodes.baseNode.unnamedNode');
  const summary = t('graph.nodes.baseNode.historyResizeSummary', { nodeName, inputDisplayName, height: newHeight });
  const stateUpdate = { height: newHeight };
  const entry: HistoryEntry = createHistoryEntry(
    "update",
    "nodeComponentState",
    summary,
    { inputKey: inputKey, state: stateUpdate }
  );
  interactionCoordinator.updateNodeComponentStateAndRecord(
    activeTabId.value,
    props.id,
    inputKey,
    stateUpdate,
    entry
  );
};

const handleOutputAltClick = (outputSlot: any, event: MouseEvent) => { // outputSlot 类型应为 DisplaySlotInfo
  if (!event.altKey) return; // 只处理 Alt+Click
  event.preventDefault();
  event.stopPropagation(); // 阻止事件冒泡到 onNodeClick

  const internalId = activeTabId.value;
  if (!internalId) {
    console.warn(t('graph.nodes.baseNode.consoleWarnCannotHandleAltClickNoActiveTab'));
    return;
  }

  if (outputSlot.dataFlowType === DataFlowType.WILDCARD || outputSlot.dataFlowType === DataFlowType.CONVERTIBLE_ANY) {
    console.warn(t('graph.nodes.baseNode.consoleWarnCannotSetPreviewForType', { type: outputSlot.dataFlowType, nodeId: props.id, slotKey: outputSlot.key }));
    return;
  }

  const currentPreviewTarget = workflowManager.activePreviewTarget.value;
  let newTarget: { nodeId: string; slotKey: string } | null = null;
  let historySummary = "";
  const slotKeyStr = String(outputSlot.key);
  const nodeIdentifier = props.label || props.id;
  const slotIdentifier = outputSlot.displayName || slotKeyStr;

  if (
    currentPreviewTarget &&
    currentPreviewTarget.nodeId === props.id &&
    currentPreviewTarget.slotKey === slotKeyStr
  ) {
    newTarget = null; // 清除预览
    historySummary = t('graph.nodes.baseNode.historyClearPreviewSummary', { nodeIdentifier, slotIdentifier });
  } else {
    newTarget = { nodeId: props.id, slotKey: slotKeyStr }; // 设置新预览
    historySummary = t('graph.nodes.baseNode.historySetPreviewSummary', { nodeIdentifier, slotIdentifier });
  }

  const entry: HistoryEntry = createHistoryEntry(
    newTarget ? 'set' : 'clear',
    'previewTarget',
    historySummary,
    {
      previousTarget: currentPreviewTarget ? { ...currentPreviewTarget } : null,
      newTarget: newTarget ? { ...newTarget } : null,
      nodeId: props.id,
      slotKey: slotKeyStr,
    }
  );
  interactionCoordinator.setPreviewTargetAndRecord(internalId, newTarget, entry);
};

const openEditorForInput = (input: InputDefinition) => {
  if (!activeTabId.value) {
    console.warn(t('graph.nodes.baseNode.consoleWarnCannotOpenEditorNoActiveTab', { nodeId: props.id }));
    return;
  }
  if (!interactionCoordinator.openDockedEditorForNodeInput) {
    console.warn(t('graph.nodes.baseNode.consoleWarnOpenDockedEditorNotFound', { nodeId: props.id }));
    return;
  }

  const nodeDisplayName = typeof props.data.label === 'string' ? props.data.label : (typeof props.data.displayName === 'string' ? props.data.displayName : props.id);
  const inputKeyString = String((input as any).key);
  const editorTitle = `${nodeDisplayName} > ${input.displayName || inputKeyString}`;
  let currentValue = getInputValue(inputKeyString);

  const langHint = getLanguageHintForInput(input);
  if (currentValue !== undefined && currentValue !== null) {
    if (langHint === 'json') {
      if (typeof currentValue === 'string') {
        try {
          const parsed = JSON.parse(currentValue);
          if (typeof parsed === 'object' && parsed !== null) {
            currentValue = JSON.stringify(parsed, null, 2);
          }
        } catch (e) { /* 解析失败，保留原始字符串 */ }
      } else if (typeof currentValue === 'object') {
        currentValue = JSON.stringify(currentValue, null, 2);
      }
    }
  }

  interactionCoordinator.openDockedEditorForNodeInput(
    activeTabId.value,
    props.id,
    inputKeyString,
    currentValue,
    input,
    editorTitle
  );
};

const openReferencedWorkflow = () => {
  const id = referencedWorkflowId.value;
  if (id) {
    const projId = currentProjectId.value;
    if (!projId) {
      console.error(t('graph.nodes.baseNode.consoleErrorCannotOpenReferencedWorkflowNoProjectId'));
      return;
    }
    // 调用 tabStore 的 action 来打开或激活对应的 groupEditor 标签页
    // openGroupEditorTab 内部会处理标签页的创建、命名和激活逻辑
    tabStore.openGroupEditorTab(id, projId);
  }
};

// 第 7 部分：Watchers (侦听器)
watch(
  [inputOrderKey, outputOrderKey],
  () => {
    // GroupInput 输出变化的日志 (原始注释)
    // if (props.type === 'core:GroupInput' && finalInputs.value.length === 0) { }
    nextTick(() => {
      // if (props.type === 'core:GroupInput' && finalInputs.value.length === 0) { }
      updateNodeInternals([props.id]);
      // if (props.type === 'core:GroupInput' && finalInputs.value.length === 0) { }
    });
  },
  { flush: "post" } // 使用 'post' flush 在 DOM 更新后运行
);

// 第 8 部分：生命周期钩子
onMounted(() => {
  if (executeClientHook) {
    // 将节点的客户端钩子执行器注册到 store
    // 类型断言为 any 是为了简化，理想情况下 ClientScriptHookExecutor 类型应该从 store 或 types 包导入
    executionStore.registerNodeClientScriptExecutor(props.id, executeClientHook as any);
  }

  // 组件实例计数：增加 (已移除，由 PerformancePanel 统一处理)
  // if (activeTabId.value && props.type) {
  //   performanceStatsStore.incrementComponentCount(activeTabId.value, props.type as string);
  // }
});

onUnmounted(() => {
  // 当节点卸载时，从 store 中注销其执行器
  executionStore.unregisterNodeClientScriptExecutor(props.id);

  // 组件实例计数：减少 (已移除，由 PerformancePanel 统一处理)
  // if (activeTabId.value && props.type) {
  //   performanceStatsStore.decrementComponentCount(activeTabId.value, props.type as string);
  // }
});

// 新增：处理来自 NodeInputActionsBar 的事件
const handleActionTriggered = (payload: {
  handlerType: NodeInputAction['handlerType']; // 使用 NodeInputAction['handlerType']
  handlerArgs?: any;
  inputKey: string;
  actionId?: string;
}) => {
  const inputDefinition = finalInputs.value.find(i => String(i.key) === payload.inputKey);
  if (!inputDefinition) {
    console.warn(t('graph.nodes.baseNode.consoleWarnActionTriggeredUnknownInput', { nodeId: props.id, inputKey: payload.inputKey }));
    return;
  }

  // console.log(`[BaseNode ${props.id}] Action triggered:`, payload); // 初始日志

  switch (payload.handlerType) {
    case 'builtin_editor':
      openEditorForInput(inputDefinition);
      break;
    case 'builtin_preview':
      // TODO: 实现 BaseNode 级别的预览逻辑，可能涉及动态 Tooltip 或面板
      console.log(t('graph.nodes.baseNode.consoleLogPreviewActionTriggered', { nodeId: props.id, inputKey: payload.inputKey, value: getInputValue(payload.inputKey) }));
      // 暂时让 NodeInputActionsBar 内部的 Tooltip (如果有) 处理简单预览
      break;
    case 'emit_event':
      if (payload.handlerArgs?.eventName && nodeRootRef.value) {
        const eventDetail = {
          ...(payload.handlerArgs.eventPayload || {}),
          nodeId: props.id,
          inputKey: payload.inputKey,
          actionId: payload.actionId,
        };
        const customEvent = new CustomEvent(payload.handlerArgs.eventName, {
          detail: eventDetail,
          bubbles: true,
          composed: true,
        });
        nodeRootRef.value.dispatchEvent(customEvent);
        // console.log(`[BaseNode ${props.id}] Emitted event '${payload.handlerArgs.eventName}'`, eventDetail);
      } else {
        console.warn(t('graph.nodes.baseNode.consoleWarnEmitEventMissingArgs', { nodeId: props.id }), payload.handlerArgs);
      }
      break;
    case 'client_script_hook':
      if (payload.handlerArgs?.hookName) {
        const inputValue = getInputValue(payload.inputKey);
        // 确保 executeClientHook 存在 (已在 setup 中解构)
        executeClientHook(payload.handlerArgs.hookName, inputDefinition, inputValue, payload.handlerArgs.hookPayload);
      } else {
        console.warn(t('graph.nodes.baseNode.consoleWarnClientScriptHookMissingHookName', { nodeId: props.id }), payload.handlerArgs);
      }
      break;
    case 'open_panel':
      if (payload.handlerArgs?.panelId === 'RegexEditorModal') {
        if (!activeTabId.value) {
          console.warn(t('graph.nodes.baseNode.consoleWarnCannotOpenRegexEditorNoActiveTab', { nodeId: props.id }));
          return;
        }
        const currentRules = (getInputValue(payload.inputKey) as RegexRule[] | undefined) || [];
        const nodeDisplayName = props.data.displayName || props.label || t('graph.nodes.baseNode.unnamedNode');
        const inputDisplayName = inputDefinition.displayName || payload.inputKey;

        const onSaveCallback = (updatedRules: RegexRule[]) => {
          if (!activeTabId.value) {
            console.warn(t('graph.nodes.baseNode.consoleWarnCannotSaveRegexRulesNoActiveTab', { nodeId: props.id }));
            return;
          }
          // 1. 更新节点内部值
          // updateInputValue 会自动处理深拷贝和响应式更新
          updateInputValue(payload.inputKey, updatedRules);

          // 2. 记录历史
          // 创建一个更简洁的摘要，例如规则数量的变化
          let rulesSummary = t('graph.nodes.baseNode.historyRegexUpdatedRulesCount', { count: updatedRules.length });
          if (updatedRules.length > 0 && updatedRules.length <= 3) {
            rulesSummary = t('graph.nodes.baseNode.historyRegexUpdatedSpecificRules', { rules: updatedRules.map(r => `"${r.name}"`).join(', ') });
          } else if (updatedRules.length > 3) {
            rulesSummary = t('graph.nodes.baseNode.historyRegexUpdatedMultipleRules', {
              rules: updatedRules.slice(0, 2).map(r => `"${r.name}"`).join(', '),
              count: updatedRules.length
            });
          }

          const summary = t('graph.nodes.baseNode.historyEditSummary', { nodeName: nodeDisplayName, inputDisplayName, value: rulesSummary });
          const entry: HistoryEntry = createHistoryEntry(
            "update",
            "nodeInputValue", // 或者一个更特定的 "nodeRegexRules"
            summary,
            // 存储整个规则数组的副本以用于撤销/重做
            { inputKey: payload.inputKey, value: JSON.parse(JSON.stringify(updatedRules)) }
          );
          interactionCoordinator.updateNodeInputValueAndRecord(
            activeTabId.value,
            props.id,
            payload.inputKey,
            updatedRules, // 传递更新后的规则 (updateInputValue 内部已处理响应式)
            entry
          );
        };

        uiStore.openRegexEditorModal({
          nodeId: props.id,
          inputKey: payload.inputKey,
          rules: JSON.parse(JSON.stringify(currentRules)), // 传递深拷贝的规则给模态框
          onSave: onSaveCallback,
        });

      } else {
        console.warn(t('graph.nodes.baseNode.consoleWarnOpenPanelUnhandledPanelId', { nodeId: props.id, panelId: payload.handlerArgs?.panelId }), payload);
      }
      break;
    default:
      console.warn(t('graph.nodes.baseNode.consoleWarnUnknownActionHandlerType', { nodeId: props.id, handlerType: payload.handlerType }));
  }
};
</script>

<template>
  <div ref="nodeRootRef" class="custom-node" :class="[
    {
      selected,
      'pointer-events-none': isResizing,
      'cursor-move': !isResizing,
      // dark: isDark, // 暗色模式类 - 移除，由 Tailwind dark: 前缀自动处理
      // 执行状态相关的类
      'node-running': nodeExecutionStatus === ExecutionStatus.RUNNING,
      'node-completed': nodeExecutionStatus === ExecutionStatus.COMPLETE, // Use COMPLETE
      'node-error': nodeExecutionStatus === ExecutionStatus.ERROR,
      'node-skipped': nodeExecutionStatus === ExecutionStatus.SKIPPED, // SKIPPED should be correct now
      'has-client-script-error': !!clientScriptError, // 保留错误状态类
    },
    previewStatusClass // 修复：直接将计算属性放入数组，Vue 会处理 null/undefined
  ]" :style="{ width: `${width}px` }">
    <!-- 节点宽度拖拽调整区域 -->
    <!-- 拖拽响应区域 (父元素，透明，宽度比手柄大) -->
    <div class="resize-area resize-area-left" @mousedown="startResize">
      <!-- 拖拽手柄视觉元素 (子元素，可见，固定宽度) -->
      <div class="resize-handle resize-handle-left" />
    </div>
    <div class="resize-area resize-area-right" @mousedown="startResize">
      <div class="resize-handle resize-handle-right" />
    </div>
    <!-- 节点头部区域 -->
    <div class="custom-node-header">
      <!-- 头部左侧：节点 ID、错误图标和标题 -->
      <div class="flex items-center flex-grow min-w-0">
        <span v-if="nodeIdNumber" class="node-id-badge mr-0.5">{{ nodeIdNumber }}</span>
        <!-- 节点 ID 徽章 -->
        <!-- 客户端脚本错误图标 -->
        <svg v-if="clientScriptError" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
          stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-error mr-1 flex-shrink-0"
          v-comfy-tooltip="t('graph.nodes.baseNode.clientScriptErrorTitle', { error: clientScriptError })">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        <!-- 优先显示错误 Tooltip -->
        <span v-if="nodeExecutionStatus === ExecutionStatus.ERROR && nodeExecutionError"
          class="node-title truncate text-error"
          v-comfy-tooltip="{
            content: t('graph.nodes.baseNode.executionErrorTooltip', { error: nodeExecutionError }),
            placement: 'top',
            maxWidth: 400,
            copyButton: true,
            interactive: true
          }">
          {{ label || t('graph.nodes.baseNode.unnamedNode') }}
        </span>
        <!-- 其次，如果需要显示 Tooltip (有描述 或 自定义标签与默认不同)，使用 v-comfy-tooltip -->
        <span v-else-if="tooltipContentForNodeTitle" class="node-title truncate" v-comfy-tooltip="{
          content: tooltipContentForNodeTitle,
          placement: 'top',
          maxWidth: 400,
          delayShow: 300,
          showCopyButton: true,
          interactive: true
        }">
          {{ label || t('graph.nodes.baseNode.unnamedNode') }}
        </span>
        <!-- 最后，如果不需要 Tooltip，直接显示普通标题 -->
        <span v-else class="node-title truncate">{{ label || t('graph.nodes.baseNode.unnamedNode') }}</span>
      </div>
      <!-- 头部右侧：跳转按钮和分类 -->
      <div class="flex items-center gap-1 flex-shrink-0">
        <!-- 跳转到引用的工作流按钮 -->
        <button v-if="referencedWorkflowId" v-comfy-tooltip="{ content: t('graph.nodes.baseNode.jumpToReferencedWorkflowTooltip'), placement: 'top', maxWidth: 400 }"
          @click.stop="openReferencedWorkflow"
          class="p-0.5 rounded text-text-muted hover:bg-neutral-softest focus:outline-none focus:ring-1 focus:ring-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </button>
        <span v-if="data.category" class="node-category whitespace-nowrap">{{ data.category }}</span>
      </div>
    </div>

    <!-- 节点配置项区域 -->
    <div v-if="data.configSchema && Object.keys(data.configSchema).length > 0" class="node-configs">
      <div v-for="configKeyName in Object.keys(data.configSchema)" :key="`config-${configKeyName}`"
        class="node-config-item">
        <div v-if="configPropsMap[String(configKeyName)]?.component" class="config-content" @mousedown.stop>
          <!-- 阻止 mousedown 冒泡 -->
          <component :is="configPropsMap[String(configKeyName)]?.component"
            :model-value="getConfigValue(String(configKeyName))" v-bind="configPropsMap[String(configKeyName)]?.props"
            @update:modelValue="updateConfigValue(String(configKeyName), $event)" />
        </div>
      </div>
    </div>

    <div class="custom-node-body">
      <!-- 节点描述现在通过标题的 Tooltip 显示 -->

      <!-- 节点输出区域 -->
      <div class="node-outputs" :key="`outputs-${finalOutputs.map((o) => o.key).join(',')}`">
        <!-- 直接迭代 finalOutputs -->
        <div v-for="output in finalOutputs" :key="`output-${output.key}`" class="node-param">
          <!-- 输出参数行 -->
          <div class="param-header">
            <div class="flex items-center justify-end gap-2 mr-2 flex-grow min-w-0">
              <!-- 使用 formatDescription 处理 Tooltip 内容 -->
              <div class="param-name truncate text-right" v-comfy-tooltip="{
                content: formatDescription(output.description) || output.displayName || String(output.key),
                placement: 'top',
                maxWidth: 400,
                delayShow: 300
              }">
                <!-- 显示时也优先显示格式化后的 description -->
                {{
                  output.displayName || // Use final description from output object
                  formatDescription(output.description) ||
                  String(output.key)
                }}
              </div>
            </div>
            <!-- 使用 Tooltip 包裹 Handle 以显示类型、输出值，并添加右键菜单事件 (Handle Tooltip 暂时保留旧组件) -->
            <div class="relative flex-shrink-0 flex items-center"
              @contextmenu.prevent.stop="emitSlotContextMenu($event, String(output.key), 'source')">
              <!-- Handle 的容器 -->
              <Tooltip placement="right" :maxWidth="400" :showDelay="300">
                <template #content>
                  <div>{{ t('graph.nodes.baseNode.tooltipType', { type: output.dataFlowType || t('graph.nodes.baseNode.unknownType') }) }}</div>
                  <!-- 直接调用 store getter 获取当前缓存的输出 -->
                  <div v-if="executionStore.getNodeOutput(activeTabId!, props.id, String(output.key)) !== undefined"
                    class="mt-1">
                    {{ t('graph.nodes.baseNode.tooltipCurrentCachedResult') }}
                    {{
                      formatOutputValueForTooltip(
                        executionStore.getNodeOutput(activeTabId!, props.id, String(output.key))
                      )
                    }}
                  </div>
                  <!-- 直接调用 store getter 获取预览输出 -->
                  <div
                    v-else-if="executionStore.getNodePreviewOutput(activeTabId!, props.id, String(output.key)) !== undefined"
                    class="mt-1 text-warning">
                    {{ t('graph.nodes.baseNode.tooltipPreview') }}
                    {{
                      formatOutputValueForTooltip(
                        executionStore.getNodePreviewOutput(
                          activeTabId!,
                          props.id,
                          String(output.key)
                        )
                      )
                    }}
                  </div>
                </template>
                <!-- Tooltip 的触发器是 Handle -->
                <Handle v-if="output.hideHandle !== true" :id="String(output.key)" type="source"
                  :position="Position.Right" :class="[
                    styles.handle,
                    styles.handleRight,
                    getHandleTypeClass(output.dataFlowType),
                    isAnyType(output.dataFlowType) && styles.handleAny, // 条件性添加类名
                    (
                      workflowManager.activePreviewTarget.value?.nodeId === props.id &&
                      workflowManager.activePreviewTarget.value?.slotKey === String(output.key) &&
                      output.dataFlowType !== DataFlowType.WILDCARD && // 新增条件：非 WILDCARD
                      output.dataFlowType !== DataFlowType.CONVERTIBLE_ANY // 新增条件：非 CONVERTIBLE_ANY
                    )
                      ? styles.handleAsPreviewIcon // 应用眼睛图标样式
                      : {}
                  ]" @click="handleOutputAltClick(output, $event)" />
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- 节点组信息区域 (仅节点组显示) -->
    <div v-if="isNodeGroup && nodeGroupInfo" class="node-group-info">
      <!-- 添加 v-if="nodeGroupInfo" 来确保在访问属性前 nodeGroupInfo 不是 null -->
      <template v-if="nodeGroupInfo">
        <span class="info-item">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
            stroke="currentColor" class="w-3 h-3 inline-block mr-0.5">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z" />
            </svg>
            {{ t('graph.nodes.baseNode.nodeGroupInfoNodes', { count: nodeGroupInfo.nodeCount }) }}
          </span>
          <span class="info-item">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
              stroke="currentColor" class="w-3 h-3 inline-block mr-0.5 transform rotate-180">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672Zm-7.518-.267A8.25 8.25 0 1 1 20.25 10.5M8.288 14.212A5.25 5.25 0 1 1 17.25 10.5" />
            </svg>
            {{ t('graph.nodes.baseNode.nodeGroupInfoInputs', { count: nodeGroupInfo.inputCount }) }}
          </span>
          <span class="info-item">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
              stroke="currentColor" class="w-3 h-3 inline-block mr-0.5">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672Zm-7.518-.267A8.25 8.25 0 1 1 20.25 10.5M8.288 14.212A5.25 5.25 0 1 1 17.25 10.5" />
            </svg>
            {{ t('graph.nodes.baseNode.nodeGroupInfoOutputs', { count: nodeGroupInfo.outputCount }) }}
          </span>
        </template>
      </div>

    <!-- 节点输入区域 -->
    <div class="node-inputs" :key="`inputs-${finalInputs.map((i) => i.key).join(',')}`">
      <!-- 直接迭代 finalInputs -->
      <div v-for="input in finalInputs" :key="`input-${input.key}`" class="node-param">
        <!-- 输入参数行布局：连接点、名称、内联输入组件 -->
        <div class="param-header" :style="getDynamicParamHeaderStyle(input)">
          <!-- 输入连接点 Handle -->
          <!-- 输入连接点 Handle，并添加右键菜单事件 -->
          <!-- 条件：如果不是按钮类型，则显示 Handle -->
          <div v-if="
            input.hideHandle !== true && // 新增：如果 hideHandle 不为 true
            !( // 且不是触发器类型
              input.dataFlowType === DataFlowType.WILDCARD &&
              input.matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER)
            )
          " :class="['relative flex-shrink-0', input.multi ? styles.multiInputRunway : '']"
            :style="input.multi ? multiInputSlotContainerStyle[String(input.key)] : {}">
            <!-- 单输入 Handle -->
            <template v-if="!input.multi">
              <Handle :id="String(input.key)" type="target" :position="Position.Left" :class="[
                styles.handle,
                styles.handleLeft,
                getHandleTypeClass(input.dataFlowType),
                isAnyType(input.dataFlowType) && styles.handleAny,
              ]" :style="getStandardHandleStyles(false)"
                @contextmenu.prevent.stop="emitSlotContextMenu($event, String(input.key), 'target')"
                v-comfy-tooltip="input.dataFlowType ? { content: input.dataFlowType, placement: 'left', maxWidth: 400 } : undefined" />
            </template>
            <!-- 多输入 - 渲染多个子 Handle 和一个主 Handle -->
            <template v-else>
              <!-- 父级 Handle 已被移除，以防止连接吸附问题 -->
              <!-- 子 Handle (可见的连接点) -->
              <div v-for="index in getNumChildHandles(String(input.key))" :key="`${String(input.key)}__${index - 1}`"
                :class="[styles.runwaySlice, 'child-handle-item']" :style="{
                  height: `${HANDLE_LINE_HEIGHT + HANDLE_VERTICAL_PADDING}px`, // e.g., 12px
                  display: 'flex',
                  alignItems: 'center',
                  position: 'relative',
                  zIndex: 1 // 确保子Handle在主Handle之上，以便交互
                }"
                @contextmenu.prevent.stop="emitSlotContextMenu($event, `${String(input.key)}__${index - 1}`, 'target')">
                <Handle :id="`${String(input.key)}__${index - 1}`" type="target" :position="Position.Left" :class="[
                  styles.handle,
                  styles.handleLeft,
                  styles.childHandle, // 这个类将在 CSS 中定义背景色等
                  getHandleTypeClass(input.dataFlowType),
                  isAnyType(input.dataFlowType) && styles.handleAny,
                ]" :style="getStandardHandleStyles(true)"
                  v-comfy-tooltip="{ content: t('graph.nodes.baseNode.multiInputChildHandleTooltip', { type: input.dataFlowType, index }), placement: 'left', maxWidth: 400 }" />
              </div>
            </template>
          </div>

          <!-- 参数名称和内联输入组件容器 (固定比例布局) -->
          <div class="grid grid-cols-5 gap-2 ml-2.5 w-full items-center">
            <!-- 参数名称容器 -->
            <div v-if="
              !(
                input.dataFlowType === DataFlowType.WILDCARD &&
                input.matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER)
              ) && // 非按钮类型
              !(
                input.dataFlowType === DataFlowType.STRING &&
                input.matchCategories?.includes(BuiltInSocketMatchCategory.CODE)
              ) // 非 CodeInput 类型
            " class="col-span-2 text-left flex items-center h-4">
              <div class="param-name truncate text-left" v-comfy-tooltip="{
                content: formatDescription(input.description) || input.displayName || String((input as any).key),
                placement: 'top',
                maxWidth: 400
              }">
                {{
                  input.displayName || formatDescription(input.description) || String((input as any).key)
                }}
              </div>
            </div>
            <!-- CodeInput 参数名称特殊处理，可能需要更多空间 -->
            <div v-else-if="
              input.dataFlowType === DataFlowType.STRING &&
              input.matchCategories?.includes(BuiltInSocketMatchCategory.CODE)
            " class="col-span-2 text-left flex items-center h-4">
              <div class="param-name truncate text-left" v-comfy-tooltip="{
                content: formatDescription(input.description) || input.displayName || String((input as any).key),
                placement: 'top',
                maxWidth: 400
              }">
                {{
                  input.displayName || formatDescription(input.description) || String((input as any).key)
                }}
              </div>
            </div>

            <!-- 内联输入组件 或 动作按钮容器 -->
            <div v-if="
              props.type !== 'core:GroupInput' &&
              props.type !== 'core:GroupOutput' &&
              !(input.dataFlowType === DataFlowType.WILDCARD && input.matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER)) && // 不是按钮类型
              (!isInputConnected(String(input.key)) || isMultiInput(input)) // 未连接或允许多重连接
            " class="flex items-center h-full col-span-3 pr-2 justify-end"
              :class="{ 'h-auto py-0.5': !isSimpleInlineInput(input) }" @mousedown.stop>
              <!-- 情况1: 简单内联输入 -->
              <template
                v-if="isSimpleInlineInput(input) && getInputComponent(input.dataFlowType, input.config, input.matchCategories) && !shouldShowSorter(input)">
                <component :is="getInputComponent(input.dataFlowType, input.config, input.matchCategories)"
                  :model-value="getInputValue(String((input as any).key))"
                  v-bind="inputPropsMap[String((input as any).key)]?.props" :node-id="props.id"
                  :input-key="String((input as any).key)" :input-definition="input"
                  @update:modelValue="updateInputValue(String((input as any).key), $event)"
                  @blur="($event: any) => handleComponentBlur(String((input as any).key), String($event))"
                  class="w-full max-w-full" />
              </template>
              <!-- 情况2: 显示 NodeInputActionsBar (如果不是简单内联输入且不显示 Sorter) -->
              <template v-else-if="!isSimpleInlineInput(input) && !shouldShowSorter(input)">
                <NodeInputActionsBar :node-id="props.id" :input-key="String(input.key)" :input-definition="input"
                  :input-value="getInputValue(String(input.key))" @action-triggered="handleActionTriggered" />
              </template>
              <!-- 其他情况，例如已连接且非多输入，则不显示控件 -->
              <div v-else class="h-4"></div>
            </div>
            <!-- 按钮组件容器 (占满整行) -->
            <div v-else-if="
              input.dataFlowType === DataFlowType.WILDCARD &&
              input.matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER)
            " class="col-span-5 w-full py-1 pr-2 flex justify-center items-center" @mousedown.stop>
              <component :is="getInputComponent(input.dataFlowType, input.config, input.matchCategories)"
                :model-value="getInputValue(String((input as any).key))"
                v-bind="inputPropsMap[String((input as any).key)]?.props" :node-id="props.id"
                :input-key="String((input as any).key)" :input-definition="input"
                @click="() => handleButtonClick(String((input as any).key))" />
            </div>
          </div>
        </div>

        <!-- 内联连接排序器 -->
        <div v-if="shouldShowSorter(input)" class="param-content !p-0 !bg-transparent">
          <!-- 使用 !p-0 和 !bg-transparent 移除默认的 param-content 样式，让 Sorter 自己控制 -->
          <InlineConnectionSorter :node-id="props.id" :input-handle-key="String(input.key)"
            :current-ordered-edge-ids="props.data.inputConnectionOrders?.[String(input.key)] || []"
            :input-definition="input" :all-edges="vueFlowInstance.edges.value" :find-node="vueFlowInstance.findNode"
            :get-node-label="getNodeLabelForSorter" />
        </div>

        <!-- 多行文本/JSON查看器等特殊输入组件 (根据条件显示) -->
        <!-- 注意：CodeInput 不会在这里渲染，它只在 param-header 中显示按钮 -->
        <div v-if="
          !shouldShowSorter(input) &&
          props.type !== 'core:GroupInput' &&
          props.type !== 'core:GroupOutput' &&
          getInputComponent(input.dataFlowType, input.config, input.matchCategories) && // 确保有组件可渲染
          // 新的条件：检查 UI_BLOCK 分类，并保留原有的连接状态和显示策略判断
          (
            input.matchCategories?.includes(BuiltInSocketMatchCategory.UI_BLOCK) &&
            ( // 保留的连接状态和显示策略判断
              (input.dataFlowType === DataFlowType.STRING && input.config?.display_only) ||
              !isInputConnected(String(input.key)) ||
              (isInputConnected(String(input.key)) && input.config?.showReceivedValue)
            )
          )
        " class="param-content" @mousedown.stop>
          <component :is="getInputComponent(input.dataFlowType, input.config, input.matchCategories)"
            :model-value="getInputValue(String((input as any).key))"
            v-bind="inputPropsMap[String((input as any).key)]?.props" :node-id="props.id"
            :input-key="String((input as any).key)" :input-definition="input"
            :height="props.data.componentStates?.[String((input as any).key)]?.height"
            @blur="($event: any) => handleComponentBlur(String((input as any).key), String($event))"
            @resize-interaction-end="handleComponentResizeEnd(String((input as any).key), $event)"
            @open-docked-editor="openEditorForInput(input)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
// 在 <script setup> 之外定义 emitSlotContextMenu，因为它需要访问 props 和 instance
export default {
  methods: {
    emitSlotContextMenu(event: MouseEvent, handleId: string, handleType: "source" | "target") {
      const detail = {
        nodeId: this.$props.id, // 从 props 获取 nodeId
        handleId: handleId,
        handleType: handleType,
        originalEvent: event, // 传递原始事件对象
      };
      // 使用 this.$el 触发事件，使其能够冒泡到 Canvas
      this.$el.dispatchEvent(
        new CustomEvent("slot-contextmenu", { detail, bubbles: true, composed: true })
      );
    },
  },
};
</script>

<style scoped>
/* 客户端脚本错误提示样式 - 图标已移至标题旁，移除 overlay 样式 */
.custom-node.has-client-script-error {
  @apply border-red-500 dark:border-red-400;
  /* 错误时添加红色边框 */
}

.custom-node {
  @apply rounded-lg shadow-md border overflow-visible bg-background-surface border-border-base;
  position: relative;
}

/* 拖拽响应区域样式 */
.resize-area {
  /* 绝对定位，覆盖节点边缘，宽度 w-2 (8px)，设置光标和层级 */
  @apply absolute top-0 bottom-0 w-2 cursor-col-resize z-10;
  /* 默认透明，悬停时显示内部手柄 */
  @apply opacity-0 hover:opacity-100;
  /* 用于垂直居中内部手柄 */
  @apply flex items-center;
}

/* 拖拽手柄视觉元素样式 */
.resize-handle {
  /* 高度撑满父元素，宽度 w-0.5 (2px)，设置背景色 */
  @apply h-full w-0.5 bg-primary;
}

/* 左侧响应区域定位 */
.resize-area-left {
  /* 定位在节点左边缘外侧 */
  left: -4px;
  /* 水平居中内部手柄 */
  justify-content: center;
}

/* 左侧手柄样式 */
.resize-handle-left {
  border-radius: 6px 0 0 6px;
}

/* 右侧响应区域定位 */
.resize-area-right {
  /* 定位在节点右边缘外侧 */
  right: -4px;
  /* 水平居中内部手柄 */
  justify-content: center;
}

/* 右侧手柄样式 */
.resize-handle-right {
  border-radius: 0 6px 6px 0;
}

.custom-node.selected {
  @apply ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-2 dark:ring-offset-gray-800 z-10;
}

.custom-node-header {
  @apply bg-background-surface px-2 py-1 font-medium text-text-base border-b border-border-base flex items-center justify-between;
  /* 调整内边距 */
  border-radius: 6px 6px 0 0;
}

.node-title {
  @apply text-sm font-medium text-text-base; /* text-text-node-title -> text-text-base */
}

/* 节点 ID 徽章样式 */
.node-id-badge {
  @apply inline-block bg-neutral/20 text-neutral text-xs font-mono px-1.5 py-0.5 rounded align-middle; /* bg-background-badge text-text-badge -> bg-neutral/20 text-neutral */
  /* 节点 ID 徽章样式 */
}

.node-category {
  @apply text-xs px-2 py-0.5 rounded bg-primary/20 text-primary; /* bg-primary-soft text-primary-strong -> bg-primary/20 text-primary */
}

.custom-node-body {
  /* 调整内边距 */
  @apply py-1 px-1;
}

.node-description {
  @apply text-sm text-text-muted mb-3;
}

.node-inputs,
.node-outputs {
  /* 添加负水平外边距以扩展宽度 */
  @apply mt-0.5 -mx-1;
  /* 调整顶部外边距 */
}

/* 配置项区域样式 */
.node-configs {
  @apply mt-1 px-1;
  /* 与 body 内边距对齐 */
}

.node-config-item {
  @apply mb-1;
  /* 配置项间距 */
}

/* 配置项内容容器样式 */
.config-content {
  @apply bg-background-base rounded;
  /* 移除内边距，由内部组件控制 */
  min-height: 24px;
  /* 保持最小高度 */
}

.input-title,
.output-title {
  @apply text-xs font-medium text-text-secondary mb-1 px-2; /* text-text-label -> text-text-secondary */
}

.node-param {
  @apply rounded text-sm relative;
}

.node-inputs .node-param {
  @apply mb-0.5;
  /* 调整底部外边距 */
}

.node-outputs .node-param {
  @apply mb-0;
}

.param-header {
  @apply flex items-center justify-between relative;
  min-height: 24px;
  /* 调整最小高度 */
}

/* 抵消 .node-inputs 的负外边距，使输入行宽度与 body 对齐 */
.node-inputs .param-header {
  @apply mx-1;
}

/* 多行输入组件容器样式 */
.param-content {
  @apply ml-3 mr-3 bg-background-base rounded;
  /* 调整左外边距以对齐 */
  /* 统一内边距 */
  min-height: 32px;
}

/* 参数名称样式调整 */
.param-name {
  @apply text-text-base font-medium leading-tight; /* text-text-default -> text-text-base */
  /* 调整行高 */
}

/* 内联输入组件容器样式 */
.inline-input {
  @apply ml-1;
  /* 保留左边距 */
}

/* 内联组件样式调整 */
.inline-input :deep(> *) {
  @apply w-full max-w-full;
  /* 确保组件占满容器宽度 */
}

/* 类型现在通过 Tooltip 显示，移除 param-type 样式 */

/* 内联组件样式微调 */
.inline-input :deep(.input-number),
.inline-input :deep(.input-text),
.inline-input :deep(.input-select select) {
  @apply w-full py-0 px-1 text-xs rounded border-border-base bg-background-base focus:ring-blue-500 focus:border-blue-500; /* border-border-input -> border-border-base, bg-background-input -> bg-background-base */
  /* 调整内边距和高度 */
  height: 16px;
  /* 调整高度 */
}

.inline-input :deep(.input-select .absolute) {
  right: 0.25rem;
  /* 微调下拉箭头位置 */
}

.inline-input :deep(.toggle-container) {
  @apply scale-[0.75] transform-gpu origin-right relative;
  /* 调整缩放和定位 */
}

/* --- Handle 样式已移至 handleStyles.module.css --- */

/* --- 执行状态样式 --- */
.node-running {
  @apply ring-2 ring-yellow-500 dark:ring-yellow-400 ring-offset-2 dark:ring-offset-gray-800 z-10;
}

.node-completed {
  @apply ring-2 ring-green-500 dark:ring-green-400 ring-offset-2 dark:ring-offset-gray-800 z-10;
}

.node-error {
  @apply ring-2 ring-red-500 dark:ring-red-400 ring-offset-2 dark:ring-offset-gray-800 z-10;
}

.node-skipped {
  opacity: var(--ct-node-skipped-opacity, 0.6); /* 使用 CSS 变量，并提供一个备用值 */
  @apply border-dashed border-border-base;
  position: relative; /* 确保伪元素定位正确 */
}

.custom-node.node-skipped::before { /* 增加 .custom-node 提高特异性 */
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: inherit; /* 继承父节点的圆角, .custom-node 有 rounded-lg */
  background-color: var(--ct-node-skipped-overlay-color, rgba(128, 128, 128, 0.3)); /* 使用 CSS 变量 */
  z-index: 1; /* 在内容之上，但在 Handle 等交互元素之下 */
  pointer-events: none; /* 不阻挡鼠标事件 */
}

/* --- 预览状态样式 --- */
.custom-node.preview-newly-computed {
  /* 青色环，与 node-completed (绿色) 区分 */
  @apply ring-2 ring-teal-500 dark:ring-teal-400 ring-offset-2 dark:ring-offset-gray-800 z-10;
}

.custom-node.preview-clean-reused {
  @apply opacity-75;
  /* 降低透明度表示复用 */
}

/* 如果 clean_reused 也被选中，确保选中效果依然明显 */
.custom-node.selected.preview-clean-reused {
  @apply opacity-100 ring-2 ring-blue-500 dark:ring-blue-400;
}

.custom-node.preview-stale-unsafe-reused {
  /* 橙色环 */
  @apply ring-2 ring-orange-500 dark:ring-orange-400 ring-offset-2 dark:ring-offset-gray-800 z-10;
}

.custom-node.preview-error {
  /* 粉色/品红色环，与 node-error (红色) 区分 */
  @apply ring-2 ring-pink-600 dark:ring-pink-500 ring-offset-2 dark:ring-offset-gray-800 z-10;
}


/* 优先显示选中状态 */
.custom-node.selected {
  @apply ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-2 dark:ring-offset-gray-800 z-10;
}

/* 插槽名称输入框样式 */
.param-name-input {
  @apply w-full p-0.5 text-xs rounded border border-border-base bg-background-base focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-text-base; /* border-border-input -> border-border-base, bg-background-input -> bg-background-base, text-text-input -> text-text-base */
  /* 调整样式使其融入 */
  line-height: normal;
  /* 确保行高正常 */
  box-sizing: border-box;
  /* 包含边框和内边距 */
  text-align: inherit;
  /* 继承父级的文本对齐方式 */
}

.param-name-input:focus {
  outline: none;
}

/* 确保输入框不会意外触发节点拖拽 */
.nodrag {
  pointer-events: all;
  /* 允许输入框交互 */
}

.custom-node .nodrag {
  /* 提高特异性 */
  cursor: text !important;
}

/* 节点组信息区域样式 */
.node-group-info {
  @apply text-xs text-text-muted px-2 py-1 border-t border-border-base flex items-center gap-2; /* border-border-divider -> border-border-base */
}

.info-item {
  @apply flex items-center;
}

/* 编辑组按钮样式 */
.edit-group-button {
  /* 尺寸和内边距已在 class 中定义 */
}
</style>
