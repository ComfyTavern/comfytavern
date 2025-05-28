<script setup lang="ts">
import { Handle, Position, type NodeProps } from "@vue-flow/core";
import { getInputComponent } from "../inputs";
import { computed, ref, watch, nextTick } from "vue";
import { useVueFlow } from "@vue-flow/core";
import { useThemeStore } from "../../../stores/theme";
import { useTabStore } from "../../../stores/tabStore";
import { storeToRefs } from "pinia";
import {
  DataFlowType,
  type HistoryEntry,
  type InputDefinition,
  BuiltInSocketMatchCategory,
} from "@comfytavern/types"; // <-- Import HistoryEntry
// 导入 EditorOpeningContext 代替 OpenDockedEditorPayload
// import type { EditorOpeningContext } from '../../../types/editorTypes'; // EditorOpeningContext 不再直接在此文件使用
import { ExecutionStatus } from "@comfytavern/types";
import { createHistoryEntry } from "@comfytavern/utils"; // <-- Import createHistoryEntry
import { useExecutionStore } from "../../../stores/executionStore"; // 导入执行状态 Store
import { useNodeResize } from "../../../composables/node/useNodeResize";
import { useGroupIOSlots } from "../../../composables/group/useGroupIOSlots"; // 导入 Group IO 插槽 Composable
import { useNodeState } from "../../../composables/node/useNodeState"; // 导入节点状态 Composable
import { useNodeProps as useNodePropsComposable } from "../../../composables/node/useNodeProps"; // 导入节点 Props Composable 并重命名
import { useNodeActions } from "../../../composables/node/useNodeActions"; // 导入节点操作 Composable
import { useWorkflowInteractionCoordinator } from "../../../composables/workflow/useWorkflowInteractionCoordinator"; // 导入工作流交互协调器
import { useNodeClientScript } from "../../../composables/node/useNodeClientScript"; // 导入客户端脚本 Composable
import Tooltip from "../../common/Tooltip.vue"; // 导入提示框组件
import MarkdownRenderer from "../../common/MarkdownRenderer.vue"; // 导入 Markdown 渲染器
import InlineConnectionSorter from '../inputs/InlineConnectionSorter.vue'; // 导入连接排序组件
import { useWorkflowManager } from "../../../composables/workflow/useWorkflowManager"; // 导入工作流管理器
import styles from "./handleStyles.module.css";
// 移除重复导入: import type { InputDefinition } from "@comfytavern/types"; // InputDefinition 已在第12行导入
import {
  HANDLE_LINE_HEIGHT,
  HANDLE_VERTICAL_PADDING,
  MIN_MULTI_HANDLE_HEIGHT_FACTOR,
  HANDLE_WIDTH,
} from "../../../constants/handleConstants"; // 导入共享常量

const props = defineProps<NodeProps>();

const nodeRootRef = ref<HTMLDivElement | null>(null); // 节点根元素引用

// 原有的多输入插槽动态高度相关常量 (用于Handle的父容器div) - 这些已不再使用
// const singleLineHeight = 20; // px, 单条连接线的高度 (父容器概念)
// const lineGap = 4; // px, 连接线之间的间隙 (父容器概念)
// const padding = 10; // px, 上下留白 (父容器概念)

// 常量已移至 handleConstants.ts


const { width, isResizing, startResize } = useNodeResize(props); // 使用节点宽度调整 Composable
const themeStore = useThemeStore();
const { isDark } = storeToRefs(themeStore);
const executionStore = useExecutionStore(); // 获取执行状态 Store 实例
const tabStore = useTabStore();
const { activeTabId } = storeToRefs(tabStore);
const interactionCoordinator = useWorkflowInteractionCoordinator(); // 获取工作流交互协调器实例
const workflowManager = useWorkflowManager(); // 获取工作流管理器实例

const vueFlowInstance = useVueFlow(); // 确保 vueFlowInstance 在此作用域，因为它在 getNodeLabelForSorter 中使用

// 辅助函数：为 Sorter 获取节点标签
const getNodeLabelForSorter = (nodeId: string): string => {
  const node = vueFlowInstance.getNode.value(nodeId); // 更正：getNode 是一个 ComputedRef，其 .value 是函数
  return node?.label || node?.data?.displayName || node?.type || nodeId;
};

// 辅助函数：判断是否应显示连接排序器
const shouldShowSorter = (input: (typeof finalInputs.value)[0]): boolean => {
  return !!input.multi && // 确保 input.multi 是 true
         !(input.dataFlowType === DataFlowType.WILDCARD &&
           input.matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER));
};

// 使用节点状态、属性和操作相关的 Composables
const {
  isInputConnected,
  // getInputConnectionCount,
  isMultiInput,
  getInputValue,
  updateInputValue,
  getConfigValue,
  updateConfigValue,
} = useNodeState(props);
// 重命名导入的函数以避免与计算属性映射冲突
const { getInputProps: calculateInputProps, getConfigProps: calculateConfigProps } =
  useNodePropsComposable(props);
const { editNodeGroup, isNodeGroup } = useNodeActions(props); // 使用节点操作 Composable
// 使用 Group IO 插槽 Composable
// 使用重构后的 useGroupIOSlots，它现在接收完整 props 并返回 finalInputs/finalOutputs
const { finalInputs, finalOutputs } = useGroupIOSlots(props);

// 使用客户端脚本 Composable
const { clientScriptError, handleButtonClick } = useNodeClientScript({
  ...props,
  updateInputValue,
  getInputValue,
}); // 传入 props 和需要的函数

// 计算属性：从节点 ID 中提取数字部分
const nodeIdNumber = computed(() => {
  const match = props.id.match(/_(\d+)$/);
  return match ? match[1] : null; // 如果匹配到数字则返回，否则返回 null
});

// 计算属性：获取当前节点的执行状态 (需要 activeTabId)
const nodeExecutionStatus = computed(() => {
  if (!activeTabId.value) {
    // 如果没有活动标签页，返回 IDLE 状态
    return ExecutionStatus.IDLE;
  }
  // 使用新的 getter 获取状态，传入 internalId 和 nodeId
  return executionStore.getNodeState(activeTabId.value, props.id) || ExecutionStatus.IDLE;
});

// 计算属性：获取当前节点的执行错误信息
const nodeExecutionError = computed(() => {
  if (!activeTabId.value) {
    return null;
  }
  // 使用新的 getter 获取错误信息
  return executionStore.getNodeError(activeTabId.value, props.id);
});

// --- 不再需要内部计算属性，直接使用 finalInputs/finalOutputs ---
// (移除 nodeFinalOutputValues 和 nodePreviewOutputValues)

// 计算属性：获取节点组信息（依赖 props.data.groupInfo）
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

// --- 客户端脚本逻辑已移至 useNodeClientScript ---

// --- Memoized Props Calculation ---
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

// Watch 已被移除，逻辑移至 useNodeState.ts 的 updateConfigValue 中
// inputKeySuffix 和 outputKeySuffix 已移除，使用更稳定的 key

// --- Handle 样式辅助函数 ---
const getHandleTypeClass = (type: string | undefined): string | null => {
  if (!type) return null;
  // 将类型转换为大写以匹配 CSS 类名 (确保 SocketType 中的值是大写的)
  const upperType = type.toUpperCase();
  // 检查是否存在对应的类名
  const className = `handleType${upperType}`;
  // 确保 CSS 模块中有这个类
  return styles[className] ? styles[className] : null;
};

const isAnyType = (type: string | undefined): boolean => {
  return type === DataFlowType.WILDCARD || type === DataFlowType.CONVERTIBLE_ANY;
};
// --- End Handle 样式辅助函数 ---

// 辅助函数：将描述中的字面量 \\n 替换为实际换行符 \n
const formatDescription = (desc: string | undefined): string | undefined => {
  if (!desc) return undefined;
  // 全局替换字面量 '\\n' 为实际换行符 '\n'
  return desc.replace(/\\n/g, "\n");
};

// 辅助函数：格式化输出值以在 Tooltip 中显示
const formatOutputValueForTooltip = (value: any): string => {
  if (value === undefined || value === null) {
    return "无";
  }
  if (typeof value === "string") {
    return value.length > 100 ? value.substring(0, 97) + "..." : value;
  }
  if (typeof value === "object") {
    try {
      const jsonString = JSON.stringify(value);
      return jsonString.length > 100 ? jsonString.substring(0, 97) + "..." : jsonString;
    } catch (e) {
      return "[无法序列化的对象]";
    }
  }
  return String(value);
};

// 处理组件失焦事件 (例如 CodeInput)
const handleComponentBlur = (inputKey: string, currentValue: string) => {
  if (!activeTabId.value) {
    console.warn(`[BaseNode ${props.id}] 无法记录组件失焦：无活动标签页 ID。`);
    return;
  }

  // 使用正确的协调器函数记录值更改
  const inputDefinition = finalInputs.value.find((i) => String(i.key) === inputKey);
  const inputDisplayName = inputDefinition?.displayName || inputKey;
  // 截断长值以用于标签
  const truncatedValue =
    currentValue.length > 30 ? currentValue.substring(0, 27) + "..." : currentValue;
  // 更清晰地展示节点名、输入项名和新值
  const nodeName = props.data.displayName || props.data.label || "未命名节点";
  const summary = `编辑 ${nodeName} - ${inputDisplayName}: "${truncatedValue}"`;

  // 创建 HistoryEntry 对象
  const entry: HistoryEntry = createHistoryEntry(
    "update", // actionType (假设是更新操作)
    "nodeInputValue", // objectType
    summary, // summary
    { inputKey: inputKey, value: truncatedValue } // details
  );
  interactionCoordinator.updateNodeInputValueAndRecord(
    activeTabId.value,
    props.id,
    inputKey,
    currentValue, // 传递从失焦事件接收到的值
    entry // 传递 HistoryEntry 对象
  );
};

// 处理组件调整大小结束事件 (例如 TextAreaInput)
const handleComponentResizeEnd = (inputKey: string, payload: { newHeight: number }) => {
  if (!activeTabId.value) {
    console.warn(`[BaseNode ${props.id}] 无法记录组件调整大小：无活动标签页 ID。`);
    return;
  }

  const { newHeight } = payload;

  // 查找输入定义以获取显示名称
  const inputDefinition = finalInputs.value.find((i) => String(i.key) === inputKey);
  const inputDisplayName = inputDefinition?.displayName || inputKey;
  // 调整摘要格式以保持一致性
  const nodeName = props.data.displayName || props.data.label || "未命名节点";
  const summary = `调整 ${nodeName} - ${inputDisplayName} 高度: ${newHeight}px`;

  // 准备组件的状态更新对象
  const stateUpdate = { height: newHeight };

  // 使用正确的协调器函数更新组件状态并记录交互
  // 创建 HistoryEntry 对象
  const entry: HistoryEntry = createHistoryEntry(
    "update", // actionType (假设是更新操作)
    "nodeComponentState", // objectType
    summary, // summary
    { inputKey: inputKey, state: stateUpdate } // details
  );
  interactionCoordinator.updateNodeComponentStateAndRecord(
    activeTabId.value,
    props.id,
    inputKey,
    stateUpdate, // 传递状态更新对象 { height: newHeight }
    entry // 传递 HistoryEntry 对象
  );
};

// --- IO 顺序更改时强制更新 ---
const { updateNodeInternals } = useVueFlow(); // 获取更新函数

// 计算顺序键
const inputOrderKey = computed(() => finalInputs.value.map((i) => String(i.key)).join(","));
const outputOrderKey = computed(() => finalOutputs.value.map((o) => String(o.key)).join(","));

// 新增：监听 outputOrderKey 变化并记录 GroupInput 的 finalOutputs
// watch(outputOrderKey, (_newVal, _oldVal) => {
//   if (props.type === 'core:GroupInput') {
//   }
// });

// 监听顺序更改并触发更新
watch(
  [inputOrderKey, outputOrderKey],
  () => {
    // Log for GroupInput output changes
    if (props.type === 'core:GroupInput' && finalInputs.value.length === 0) { // GroupInput has no finalInputs
    }
    nextTick(() => {
      if (props.type === 'core:GroupInput' && finalInputs.value.length === 0) {
      }
      updateNodeInternals([props.id]);
      if (props.type === 'core:GroupInput' && finalInputs.value.length === 0) {
      }
    });
  },
  { flush: "post" } // 使用 'post' flush 在 DOM 更新后运行
);
// --- 结束强制更新 ---

// --- Tooltip 内容计算 ---
// 计算节点标题 Tooltip 的内容，组合描述和默认标签
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
    content += `默认名称: ${props.data.defaultLabel}`;
  }
  // 如果没有内容，确保返回 undefined 或空字符串，以便 Tooltip 正确处理
  return content || undefined;
});
// --- 结束 Tooltip 内容计算 ---

// --- 新增：处理输出 Handle 的 Alt+Click 事件 ---
const handleOutputAltClick = (outputSlot: any, event: MouseEvent) => { // outputSlot 类型应为 DisplaySlotInfo，但 DisplaySlotInfo 未导出
  if (!event.altKey) return; // 只处理 Alt+Click

  event.preventDefault();
  event.stopPropagation(); // 阻止事件冒泡到 onNodeClick

  const internalId = activeTabId.value;
  if (!internalId) {
    console.warn("[BaseNode] 无法处理输出 Alt+Click：没有活动的标签页。");
    return;
  }

  // 检查插槽类型，如果是 WILDCARD 或 CONVERTIBLE_ANY，则不允许设置为预览目标
  if (outputSlot.dataFlowType === DataFlowType.WILDCARD || outputSlot.dataFlowType === DataFlowType.CONVERTIBLE_ANY) {
    console.warn(`[BaseNode] Alt+Click: 类型为 ${outputSlot.dataFlowType} 的插槽 ${props.id}::${outputSlot.key} 不可被设置为预览目标。`);
    return;
  }

  const currentPreviewTarget = workflowManager.activePreviewTarget.value;
  let newTarget: { nodeId: string; slotKey: string } | null = null;
  let historySummary = "";
  const slotKeyStr = String(outputSlot.key);

  if (
    currentPreviewTarget &&
    currentPreviewTarget.nodeId === props.id &&
    currentPreviewTarget.slotKey === slotKeyStr
  ) {
    newTarget = null; // 清除预览
    historySummary = `清除了节点 ${props.label || props.id} 插槽 ${outputSlot.displayName || slotKeyStr} 的预览`;
  } else {
    newTarget = { nodeId: props.id, slotKey: slotKeyStr }; // 设置新预览
    historySummary = `设置节点 ${props.label || props.id} 插槽 ${outputSlot.displayName || slotKeyStr} 为预览目标`;
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
// --- 结束新增处理函数 ---

// --- 辅助函数：判断输入类型以便在模板中使用 ---
const isSimpleInlineInput = (input: InputDefinition): boolean => {
  // 简单单行输入: Number, Boolean, Select(Combo), 普通单行String
  // 排除多行文本、Markdown、JSON、Code、Button、History
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

const showActionButtonsForInput = (input: InputDefinition): boolean => {
  // 需要显示预览/编辑按钮的类型: 多行文本, Markdown, JSON, Code
  return (
    (input.dataFlowType === DataFlowType.STRING && input.config?.multiline) ||
    (input.dataFlowType === DataFlowType.STRING && input.matchCategories?.includes(BuiltInSocketMatchCategory.MARKDOWN)) ||
    (input.dataFlowType === DataFlowType.OBJECT && input.matchCategories?.includes(BuiltInSocketMatchCategory.JSON)) ||
    (input.dataFlowType === DataFlowType.STRING && input.matchCategories?.includes(BuiltInSocketMatchCategory.CODE))
  );
};

const getLanguageHintForInput = (input: InputDefinition): string | undefined => {
  if (input.config?.languageHint) return input.config.languageHint;
  if (input.matchCategories?.includes(BuiltInSocketMatchCategory.JSON)) return 'json';
  if (input.matchCategories?.includes(BuiltInSocketMatchCategory.MARKDOWN)) return 'markdown';
  if (input.dataFlowType === DataFlowType.STRING && input.matchCategories?.includes(BuiltInSocketMatchCategory.CODE)) {
    // 检查更具体的代码语言分类，例如 "Code:javascript" (注意大小写可能需要灵活处理)
    if (input.matchCategories?.find(cat => cat.toLowerCase() === 'code:javascript')) return 'javascript';
    if (input.matchCategories?.find(cat => cat.toLowerCase() === 'code:python')) return 'python';
    // 可以根据需要添加更多语言的判断
    return 'plaintext'; // 对于通用的 CODE 类型，默认为纯文本
  }
  return undefined;
};

// 辅助函数，用于生成 Tooltip 内容的字符串版本 (不含 Markdown 代码块包装，不截断)
const getFormattedPreviewString = (value: any, inputDef: InputDefinition): string => {
  const langHint = getLanguageHintForInput(inputDef);

  if (value === undefined || value === null) return "无内容";

  let strValue = "";
  let processedValue = value;

  // 尝试解析和格式化 JSON (如果值是字符串且提示是json)
  if (langHint === 'json' && typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null) {
        processedValue = parsed;
      }
    } catch (e) { /* 解析失败，使用原始字符串 */ }
  }

  // 将处理后的值转为字符串
  if (typeof processedValue === 'object' && processedValue !== null) {
    try {
      strValue = JSON.stringify(processedValue, null, 2); // JSON 美化
    } catch {
      strValue = "[无法序列化的对象]";
    }
  } else {
    strValue = String(processedValue);
  }

  // 处理完全空的内容
  if (strValue.trim() === "") {
    if (langHint === 'json') return "空JSON内容";
    if (langHint === 'markdown') return "空Markdown内容";
    if (langHint) return `空 ${langHint} 内容`; // 例如 "空 javascript 内容"
    return "无内容";
  }
  return strValue; // 返回原始或格式化后的字符串，不截断，不加额外前缀
};


const openEditorForInput = (input: InputDefinition) => {
  if (!activeTabId.value) {
    console.warn(`[BaseNode ${props.id}] 无法打开编辑器：无活动标签页 ID。`);
    return;
  }
  if (!interactionCoordinator.openDockedEditorForNodeInput) {
    console.warn(`[BaseNode ${props.id}] openDockedEditorForNodeInput 方法未找到。`);
    return;
  }

  const nodeDisplayName = typeof props.data.label === 'string' ? props.data.label : (typeof props.data.displayName === 'string' ? props.data.displayName : props.id);
  // 使用 (input as any).key 来临时解决 TypeScript 可能的类型推断问题
  const inputKeyString = String((input as any).key);
  const editorTitle = `${nodeDisplayName} > ${input.displayName || inputKeyString}`;
  let currentValue = getInputValue(inputKeyString); // 获取原始值

  // 对 currentValue 进行格式化，确保传递给编辑器的是美化后的 JSON 字符串
  const langHint = getLanguageHintForInput(input);
  if (currentValue !== undefined && currentValue !== null) {
    if (langHint === 'json') {
      if (typeof currentValue === 'string') {
        try {
          const parsed = JSON.parse(currentValue);
          if (typeof parsed === 'object' && parsed !== null) {
            currentValue = JSON.stringify(parsed, null, 2); // 字符串转对象再转格式化字符串
          } else {
            // 如果解析出来不是对象（比如数字、布尔值），或者解析失败，
            // 并且原始字符串不像一个已格式化的JSON (没有换行或只有一行)
            // 尝试将其视为一个简单的值，不需要特别的JSON格式化。
            // 如果原始字符串包含换行，则可能已经是格式化好的，保留原样。
            if (!currentValue.includes('\n') && currentValue.split('\n').length <=1) {
                 // no-op, currentValue is already a simple string or unformattable
            }
          }
        } catch (e) {
          // 解析失败，如果原始字符串不像一个已格式化的JSON，则保留原样
          // 如果原始字符串包含换行，则可能已经是格式化好的，保留原样。
           if (!currentValue.includes('\n') && currentValue.split('\n').length <=1) {
                // no-op, currentValue is already a simple string or unformattable
           }
        }
      } else if (typeof currentValue === 'object') {
        currentValue = JSON.stringify(currentValue, null, 2); // 对象直接转格式化字符串
      }
    }
    // 对于其他类型 (如 code, markdown, plain text)，currentValue 通常已经是字符串，
    // 或者 DockedEditorWrapper/RichCodeEditor 会处理其显示。
    // 这里主要确保 JSON 是格式化好的。
  }


  interactionCoordinator.openDockedEditorForNodeInput(
    activeTabId.value,
    props.id,
    inputKeyString,
    currentValue,
    input, // input 本身就是 InputDefinition (或 DisplaySlotInfo)
    editorTitle
  );
}; // 正确结束 openEditorForInput 函数
// --- 结束辅助函数 ---

// 新增：计算 Handle 动态样式的函数
// (确保此函数定义在所有依赖它的计算属性如 multiInputSlotDynamicStyle 之前，
// 并且在所有它依赖的常量如 handleLineHeight 等之后)
// getDynamicHandleStyles 函数不再用于拉伸单个 Handle 的高度。
// 对于多输入，Handle 本身是标准尺寸，其父容器负责排列。
// 此函数现在主要用于应用基础样式或特定于单个标准尺寸Handle的样式（如果需要）。
const getStandardHandleStyles = (isChild: boolean = false) => {
  const styles: Record<string, string> = {};
  if (isChild) {
    // 子 Handle 样式 (使其成为透明的交互层，充满其父 div.child-handle-item)
    styles.width = '100%';
    styles.height = '100%';
    styles.borderRadius = '0'; // 父 div.child-handle-item 或最外层跑道容器负责圆角
    styles.border = 'none';
    styles.backgroundColor = 'transparent'; // 确保背景透明
    styles.boxShadow = 'none';
    styles.margin = '0'; // 无外边距
    styles.padding = '0'; // 无内边距
    // position, top, transform 等由 .handle 类或 Vue Flow 默认处理
  } else {
    // 标准 Handle 样式 (圆形)
    styles.width = `${HANDLE_WIDTH}px`; // 宽度通常由常量或 CSS 控制 (例如 12px)
    styles.height = `${HANDLE_LINE_HEIGHT + HANDLE_VERTICAL_PADDING}px`; // 高度计算保持不变
    styles.borderRadius = '50%'; // 确保对于其实际渲染尺寸，这是一个圆形
    // 标准 Handle 的背景色等由其 CSS 类控制
  }
  return styles;
};

// 计算多输入插槽的父容器的动态样式
const multiInputSlotContainerStyle = computed(() => {
  const stylesMap: Record<string, any> = {};
  if (finalInputs.value) {
    for (const input of finalInputs.value) {
      if (input.multi) {
        const currentInputKey = String(input.key);
        // const numConnections = getInputConnectionCount(currentInputKey); // 不再直接在这里使用 numConnections
        const actualInteractiveSlots = getNumChildHandles(currentInputKey); // 获取实际要渲染的交互式子句柄数量

        // 确定用于高度计算的视觉槽位数
        const visualSlotsForHeightCalc = Math.max(actualInteractiveSlots, MIN_MULTI_HANDLE_HEIGHT_FACTOR);
        
        // 容器的总垂直内边距 (上下各 HANDLE_VERTICAL_PADDING / 2)
        const totalVerticalPaddingForContainer = HANDLE_VERTICAL_PADDING;
        const minContainerHeight =
          visualSlotsForHeightCalc * (HANDLE_LINE_HEIGHT + HANDLE_VERTICAL_PADDING) + // 基于视觉槽位数计算高度
          // Math.max(0, visualSlotsForHeightCalc - 1) * HANDLE_LINE_GAP + // 子Handle之间的间隙 - GAP IS NOW 0
          totalVerticalPaddingForContainer; // 容器自身的上下内边距

        stylesMap[currentInputKey] = {
          display: 'flex',
          flexDirection: 'column' as 'column',
          // 容器的内边距：垂直方向由 HANDLE_VERTICAL_PADDING 控制，水平方向固定为4px
          padding: `${HANDLE_VERTICAL_PADDING / 2}px 4px`,
          gap: `0px`, // 子 Handle 项之间无间隙，以融合
          minHeight: `${minContainerHeight}px`,
          // borderRadius 将在模板中通过 Tailwind 类应用，以匹配视觉
          position: 'absolute',   // 改为绝对定位，使其行为类似单个Handle
          top: '0px',             // 从顶部开始定位
          zIndex: 15,             // 设置合适的 z-index 以确保可交互和正确层叠
          boxSizing: 'border-box', // 保留 boxSizing
          left: `-${HANDLE_WIDTH / 2}px`, // 保留向左偏移
        };
      }
    }
  }
  return stylesMap;
});

// 辅助函数：计算为多输入插槽渲染的子Handle数量
const getNumChildHandles = (inputKey: string): number => {
  const inputDefinition = finalInputs.value.find(i => String(i.key) === inputKey);

  if (!inputDefinition) {
    return 0;
  }
  if (!inputDefinition.multi) {
    return 0;
  }

  // 直接从 props.data 获取连接数
  const connectionsArray = props.data?.inputConnectionOrders?.[inputKey];
  const numConnections = connectionsArray ? connectionsArray.length : 0;

  let handlesToRender: number;

  if (inputDefinition?.allowMoreConnections === false && numConnections >= (inputDefinition.maxConnections ?? Infinity)) {
    // 如果不允许更多连接，并且已达到或超过最大连接数，则精确渲染 numConnections 个句柄
    handlesToRender = numConnections;
  } else {
    // 否则，渲染 numConnections + 1 个句柄，为下一个潜在连接提供空位
    handlesToRender = numConnections + 1;
  }

  // MIN_MULTI_HANDLE_HEIGHT_FACTOR 不应影响实际渲染的句柄数量，仅影响容器视觉高度。
  // handlesToRender 已经是计算好的实际应渲染的子句柄数。
  return handlesToRender;
};

// 计算输入参数头部的动态样式，以适应多输入跑道的高度
const getDynamicParamHeaderStyle = (inputDef: (typeof finalInputs.value)[number]) => {
  const styles: Record<string, string> = {};
  if (inputDef.multi) {
    const runwayContainerStyle = multiInputSlotContainerStyle.value[String(inputDef.key)];
    if (runwayContainerStyle && runwayContainerStyle.minHeight) {
      const runwayMinHeightPx = parseFloat(runwayContainerStyle.minHeight);
      // .param-header 在 CSS 中有 min-height: 24px;
      const defaultParamHeaderMinHeight = 24;
      const requiredMinHeight = Math.max(defaultParamHeaderMinHeight, runwayMinHeightPx);
      styles.minHeight = `${requiredMinHeight}px`;
    }
  }
  return styles;
};
</script>
<template>
  <div
    ref="nodeRootRef"
    class="custom-node"
    :class="{
      selected,
      'pointer-events-none': isResizing,
      'cursor-move': !isResizing,
      dark: isDark, // 暗色模式类
      // 执行状态相关的类
      'node-running': nodeExecutionStatus === ExecutionStatus.RUNNING,
      'node-completed': nodeExecutionStatus === ExecutionStatus.COMPLETE, // Use COMPLETE
      'node-error': nodeExecutionStatus === ExecutionStatus.ERROR,
      'node-skipped': nodeExecutionStatus === ExecutionStatus.SKIPPED, // SKIPPED should be correct now
      'has-client-script-error': !!clientScriptError, // 保留错误状态类
    }"
    :style="{ width: `${width}px` }"
  >
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
        <svg
          v-if="clientScriptError"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-4 h-4 text-red-500 mr-1 flex-shrink-0"
          :title="`客户端脚本错误: ${clientScriptError}`"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
        <!-- 优先显示错误 Tooltip -->
        <Tooltip
          v-if="nodeExecutionStatus === ExecutionStatus.ERROR && nodeExecutionError"
          :content="`执行错误: ${nodeExecutionError}`"
          placement="top"
          :maxWidth="400"
          type="error"
          :showCopyButton="true"
          :interactive="true"
        >
          <!-- 错误时标题也显示红色 -->
          <span class="node-title truncate text-red-600 dark:text-red-400">{{
            label || "未命名节点"
          }}</span>
        </Tooltip>
        <!-- 其次，如果需要显示 Tooltip (有描述 或 自定义标签与默认不同)，使用 content prop -->
        <Tooltip
          v-else-if="tooltipContentForNodeTitle"
          :content="tooltipContentForNodeTitle"
          placement="top"
          :maxWidth="400"
          :showDelay="300"
          :showCopyButton="true"
          :interactive="true"
        >
          <!-- Tooltip 触发器：节点标题 -->
          <span class="node-title truncate">{{ label || "未命名节点" }}</span>
        </Tooltip>
        <!-- 最后，如果不需要 Tooltip，直接显示普通标题 -->
        <span v-else class="node-title truncate">{{ label || "未命名节点" }}</span>
      </div>
      <!-- 头部右侧：节点组编辑按钮和分类 -->
      <div class="flex items-center gap-1">
        <Tooltip v-if="isNodeGroup" content="编辑节点组定义" placement="top" :maxWidth="400">
          <!-- 编辑节点组按钮 -->
          <button
            @click.stop="editNodeGroup"
            class="edit-group-button p-0.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-3.5 h-3.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
              />
            </svg>
          </button>
        </Tooltip>
        <span v-if="data.category" class="node-category">{{ data.category }}</span>
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
              <Tooltip
                :content="
                  // Use final description from output object
                  formatDescription(output.description) || output.displayName || String(output.key)
                "
                placement="top"
                :maxWidth="400"
                :showDelay="300"
              >
                <div class="param-name truncate text-right">
                  <!-- 显示时也优先显示格式化后的 description -->
                  {{
                    output.displayName || // Use final description from output object
                    formatDescription(output.description) ||
                    String(output.key)
                  }}
                </div>
              </Tooltip>
            </div>
            <!-- 使用 Tooltip 包裹 Handle 以显示类型、输出值，并添加右键菜单事件 -->
            <div
              class="relative flex-shrink-0 flex items-center"
              @contextmenu.prevent.stop="emitSlotContextMenu($event, String(output.key), 'source')"
            >
              <!-- Handle 的容器 -->
              <Tooltip placement="right" :maxWidth="400" :showDelay="300">
                <template #content>
                  <div>类型: {{ output.dataFlowType || "未知" }}</div>
                  <!-- 直接调用 store getter 获取最终输出 -->
                  <div
                    v-if="executionStore.getNodeOutput(activeTabId!, props.id, String(output.key)) !== undefined"
                    class="mt-1"
                  >
                    最终:
                    {{
                      formatOutputValueForTooltip(
                        executionStore.getNodeOutput(activeTabId!, props.id, String(output.key))
                      )
                    }}
                  </div>
                  <!-- 直接调用 store getter 获取预览输出 -->
                  <div
                    v-else-if="executionStore.getNodePreviewOutput(activeTabId!, props.id, String(output.key)) !== undefined"
                    class="mt-1 text-yellow-400"
                  >
                    预览:
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
                <Handle
                  :id="String(output.key)"
                  type="source"
                  :position="Position.Right"
                  :class="[
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
                  ]"
                  @click="handleOutputAltClick(output, $event)"
                />
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      <!-- 节点配置项区域 -->
      <div
        v-if="data.configSchema && Object.keys(data.configSchema).length > 0"
        class="node-configs"
      >
        <div
          v-for="configKeyName in Object.keys(data.configSchema)"
          :key="`config-${configKeyName}`"
          class="node-config-item"
        >
          <div
            v-if="configPropsMap[String(configKeyName)]?.component"
            class="config-content"
            @mousedown.stop
          >
            <!-- 阻止 mousedown 冒泡 -->
            <component
              :is="configPropsMap[String(configKeyName)]?.component"
              :model-value="getConfigValue(String(configKeyName))"
              v-bind="configPropsMap[String(configKeyName)]?.props"
              @update:modelValue="updateConfigValue(String(configKeyName), $event)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 节点组信息区域 (仅节点组显示) -->
    <div v-if="isNodeGroup && nodeGroupInfo" class="node-group-info">
      <!-- 添加 v-if="nodeGroupInfo" 来确保在访问属性前 nodeGroupInfo 不是 null -->
      <template v-if="nodeGroupInfo">
        <span class="info-item">
          <svg
            xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-3 h-3 inline-block mr-0.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z"
          />
        </svg>
          {{ nodeGroupInfo.nodeCount }} 节点
        </span>
        <span class="info-item">
          <svg
            xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-3 h-3 inline-block mr-0.5 transform rotate-180"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672Zm-7.518-.267A8.25 8.25 0 1 1 20.25 10.5M8.288 14.212A5.25 5.25 0 1 1 17.25 10.5"
          />
        </svg>
          {{ nodeGroupInfo.inputCount }} 输入
        </span>
        <span class="info-item">
          <svg
            xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-3 h-3 inline-block mr-0.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672Zm-7.518-.267A8.25 8.25 0 1 1 20.25 10.5M8.288 14.212A5.25 5.25 0 1 1 17.25 10.5"
          />
        </svg>
          {{ nodeGroupInfo.outputCount }} 输出
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
          <div
            v-if="
              !(
                input.dataFlowType === DataFlowType.WILDCARD &&
                input.matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER)
              )
            "
            :class="['relative flex-shrink-0', input.multi ? styles.multiInputRunway : '']"
            :style="input.multi ? multiInputSlotContainerStyle[String(input.key)] : {}"
          >
            <!-- 单输入 Handle -->
            <template v-if="!input.multi">
              <Tooltip v-if="input.dataFlowType" placement="left" :maxWidth="400">
                <template #content>
                  <span>{{ input.dataFlowType }}</span>
                </template>
                <Handle
                  :id="String(input.key)"
                  type="target"
                  :position="Position.Left"
                  :class="[
                    styles.handle,
                    styles.handleLeft,
                    getHandleTypeClass(input.dataFlowType),
                    isAnyType(input.dataFlowType) && styles.handleAny,
                  ]"
                  :style="getStandardHandleStyles(false)"
                  @contextmenu.prevent.stop="emitSlotContextMenu($event, String(input.key), 'target')"
                />
              </Tooltip>
              <Handle
                v-else
                :id="String(input.key)"
                type="target"
                :position="Position.Left"
                :class="[
                  styles.handle,
                  styles.handleLeft,
                  getHandleTypeClass(input.dataFlowType),
                  isAnyType(input.dataFlowType) && styles.handleAny,
                ]"
                :style="getStandardHandleStyles(false)"
                @contextmenu.prevent.stop="emitSlotContextMenu($event, String(input.key), 'target')"
              />
            </template>
            <!-- 多输入 - 渲染多个子 Handle 和一个主 Handle -->
            <template v-else>
              <!-- 父级 Handle 已被移除，以防止连接吸附问题 -->
              <!-- 子 Handle (可见的连接点) -->
              <div
                v-for="index in getNumChildHandles(String(input.key))"
                :key="`${String(input.key)}__${index - 1}`"
                :class="[styles.runwaySlice, 'child-handle-item']"
                :style="{
                  height: `${HANDLE_LINE_HEIGHT + HANDLE_VERTICAL_PADDING}px`, // e.g., 12px
                  display: 'flex',
                  alignItems: 'center',
                  /* justifyContent: 'center', // 移除，让 .runwaySlice 的背景色填充，或让内部 Handle 自然填充 */
                  position: 'relative',
                  zIndex: 1 // 确保子Handle在主Handle之上，以便交互
                }"
                @contextmenu.prevent.stop="emitSlotContextMenu($event, `${String(input.key)}__${index - 1}`, 'target')"
              >
                <Tooltip placement="left" :maxWidth="400">
                  <template #content>
                    <span>{{ input.dataFlowType }} (插槽 {{ index }})</span>
                  </template>
                  <Handle
                    :id="`${String(input.key)}__${index - 1}`"
                    type="target"
                    :position="Position.Left"
                    :class="[
                      styles.handle,
                      styles.handleLeft,
                      styles.childHandle, // 这个类将在 CSS 中定义背景色等
                      getHandleTypeClass(input.dataFlowType),
                      isAnyType(input.dataFlowType) && styles.handleAny,
                    ]"
                    :style="getStandardHandleStyles(true)"
                  />
                </Tooltip>
              </div>
            </template>
          </div>

          <!-- 参数名称和内联输入组件容器 (固定比例布局) -->
          <div class="grid grid-cols-5 gap-2 ml-2.5 w-full items-center">
            <!-- 参数名称容器 -->
            <div
              v-if="
                !(
                  input.dataFlowType === DataFlowType.WILDCARD &&
                  input.matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER)
                ) && // 非按钮类型
                !(
                  input.dataFlowType === DataFlowType.STRING &&
                  input.matchCategories?.includes(BuiltInSocketMatchCategory.CODE)
                ) // 非 CodeInput 类型
              "
              class="col-span-2 text-left flex items-center h-4"
            >
              <Tooltip
                :content="
                  formatDescription(input.description) || input.displayName || String((input as any).key)
                "
                placement="top"
                :maxWidth="400"
              >
                <div class="param-name truncate text-left">
                  {{
                    input.displayName || formatDescription(input.description) || String((input as any).key)
                  }}
                </div>
              </Tooltip>
            </div>
            <!-- CodeInput 参数名称特殊处理，可能需要更多空间 -->
            <div
              v-else-if="
                input.dataFlowType === DataFlowType.STRING &&
                input.matchCategories?.includes(BuiltInSocketMatchCategory.CODE)
              "
              class="col-span-2 text-left flex items-center h-4"
            >
              <Tooltip
                :content="
                  formatDescription(input.description) || input.displayName || String((input as any).key)
                "
                placement="top"
                :maxWidth="400"
              >
                <div class="param-name truncate text-left">
                  {{
                    input.displayName || formatDescription(input.description) || String((input as any).key)
                  }}
                </div>
              </Tooltip>
            </div>

            <!-- 内联输入组件 或 动作按钮容器 -->
            <div
              v-if="
                props.type !== 'core:GroupInput' &&
                props.type !== 'core:GroupOutput' &&
                !(input.dataFlowType === DataFlowType.WILDCARD && input.matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER)) && // 不是按钮类型
                (!isInputConnected(String(input.key)) || isMultiInput(input)) // 未连接或允许多重连接
              "
              class="flex items-center h-full col-span-3 pr-2 justify-end"
              :class="{ 'h-auto py-0.5': showActionButtonsForInput(input) }"
              @mousedown.stop
            >
              <!-- 情况1: 简单内联输入 -->
              <template v-if="isSimpleInlineInput(input) && getInputComponent(input.dataFlowType, input.config, input.matchCategories) && !shouldShowSorter(input)">
                <component
                  :is="getInputComponent(input.dataFlowType, input.config, input.matchCategories)"
                  :model-value="getInputValue(String((input as any).key))"
                  v-bind="inputPropsMap[String((input as any).key)]?.props"
                  :node-id="props.id"
                  :input-key="String((input as any).key)"
                  :input-definition="input"
                  @update:modelValue="updateInputValue(String((input as any).key), $event)"
                  @blur="($event: any) => handleComponentBlur(String((input as any).key), String($event))"
                  class="w-full max-w-full"
                />
              </template>
              <!-- 情况2: 显示动作按钮 (预览/编辑) - 仅当不显示 Sorter 时 -->
              <template v-else-if="showActionButtonsForInput(input) && !shouldShowSorter(input)">
                <div class="flex items-center space-x-1">
                  <!-- 预览按钮 (Tooltip) -->
                  <Tooltip
                    v-if="!(input.dataFlowType === DataFlowType.OBJECT && input.matchCategories?.includes(BuiltInSocketMatchCategory.JSON) && input.config?.preferFloatingEditor)"
                    placement="top"
                    :maxWidth="600"
                    :showDelay="300"
                    :interactive="true"
                    :allowHtml="getLanguageHintForInput(input) === 'markdown'"
                  >
                    <template #content>
                      <div class="max-h-96 overflow-auto text-sm text-gray-100">
                        <template v-if="getLanguageHintForInput(input) === 'markdown'">
                          <MarkdownRenderer :markdownContent="getFormattedPreviewString(getInputValue(String(input.key)), input)" />
                        </template>
                        <template v-else-if="getLanguageHintForInput(input) === 'json' || (input.dataFlowType === DataFlowType.STRING && input.matchCategories?.includes(BuiltInSocketMatchCategory.CODE))">
                          <MarkdownRenderer :markdownContent="'**' + input.displayName + '**' + '\n' + '```' + (getLanguageHintForInput(input) || 'text') + '\n' + getFormattedPreviewString(getInputValue(String(input.key)), input) + '\n' + '```'" />
                        </template>
                        <pre v-else class="whitespace-pre-wrap break-all">{{ getFormattedPreviewString(getInputValue(String(input.key)), input) }}</pre>
                      </div>
                    </template>
                    <button class="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-gray-500 dark:text-gray-400">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    </button>
                  </Tooltip>
                  <!-- 编辑按钮 -->
                  <button @click="openEditorForInput(input)" class="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-gray-500 dark:text-gray-400">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                  </button>
                </div>
              </template>
              <!-- 其他情况，例如已连接且非多输入，则不显示控件 -->
              <div v-else class="h-4"></div>
            </div>
            <!-- 按钮组件容器 (占满整行) -->
            <div
              v-else-if="
                input.dataFlowType === DataFlowType.WILDCARD &&
                input.matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER)
              "
              class="col-span-5 w-full py-1 pr-2 flex justify-center items-center"
              @mousedown.stop
            >
              <component
                :is="getInputComponent(input.dataFlowType, input.config, input.matchCategories)"
                :model-value="getInputValue(String((input as any).key))"
                v-bind="inputPropsMap[String((input as any).key)]?.props"
                :node-id="props.id"
                :input-key="String((input as any).key)"
                :input-definition="input"
                @click="() => handleButtonClick(String((input as any).key))"
              />
            </div>
          </div>
        </div>

        <!-- 内联连接排序器 -->
        <div v-if="shouldShowSorter(input)" class="param-content !p-0 !bg-transparent"> <!-- 使用 !p-0 和 !bg-transparent 移除默认的 param-content 样式，让 Sorter 自己控制 -->
          <InlineConnectionSorter
            :node-id="props.id"
            :input-handle-key="String(input.key)"
            :current-ordered-edge-ids="props.data.inputConnectionOrders?.[String(input.key)] || []"
            :input-definition="input"
            :all-edges="vueFlowInstance.edges.value"
            :find-node="vueFlowInstance.findNode"
            :get-node-label="getNodeLabelForSorter"
          />
        </div>

        <!-- 多行文本/JSON查看器等特殊输入组件 (根据条件显示) -->
        <!-- 注意：CodeInput 不会在这里渲染，它只在 param-header 中显示按钮 -->
        <div
          v-if="
            (
            props.type !== 'core:GroupInput' &&
            props.type !== 'core:GroupOutput' &&
            getInputComponent(input.dataFlowType, input.config, input.matchCategories) &&
            // 条件1: 类型是 HISTORY, 多行 STRING/MARKDOWN, 或 JSON
            (
              (input.dataFlowType === DataFlowType.OBJECT && input.matchCategories?.includes(BuiltInSocketMatchCategory.CHAT_HISTORY)) || // HISTORY
              (input.dataFlowType === DataFlowType.STRING && input.config?.multiline) || // 多行 STRING (TextAreaInput)
              (input.dataFlowType === DataFlowType.STRING && input.matchCategories?.includes(BuiltInSocketMatchCategory.MARKDOWN)) || // MARKDOWN (TextAreaInput)
              (input.dataFlowType === DataFlowType.OBJECT && input.matchCategories?.includes(BuiltInSocketMatchCategory.JSON)) // JSON (JsonInlineViewer)
            ) &&
            // 条件2: 连接状态判断
            (
              (input.dataFlowType === DataFlowType.STRING && input.config?.display_only) ||
              !isInputConnected(String(input.key)) ||
              (isInputConnected(String(input.key)) && input.config?.showReceivedValue)
            )
            ) && !shouldShowSorter(input)
          "
          class="param-content"
          @mousedown.stop
        >
          <component
            :is="getInputComponent(input.dataFlowType, input.config, input.matchCategories)"
            :model-value="getInputValue(String((input as any).key))"
            v-bind="inputPropsMap[String((input as any).key)]?.props"
            :node-id="props.id"
            :input-key="String((input as any).key)"
            :input-definition="input"
            :height="props.data.componentStates?.[String((input as any).key)]?.height"
            @blur="($event: any) => handleComponentBlur(String((input as any).key), String($event))"
            @resize-interaction-end="handleComponentResizeEnd(String((input as any).key), $event)"
            @open-docked-editor="openEditorForInput(input)"
          />
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
  @apply rounded-lg shadow-md border overflow-visible bg-gray-50 border-gray-300 dark:bg-gray-800 dark:border-gray-600;
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
  @apply h-full w-0.5 bg-[#1890ff] dark:bg-blue-400;
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
  @apply bg-gray-50 dark:bg-gray-700 px-2 py-1 font-medium text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between;
  /* 调整内边距 */
  border-radius: 6px 6px 0 0;
}

.node-title {
  @apply text-sm font-medium text-gray-800 dark:text-gray-200;
}

/* 节点 ID 徽章样式 */
.node-id-badge {
  @apply inline-block bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs font-mono px-1.5 py-0.5 rounded align-middle;
  /* 节点 ID 徽章样式 */
}

.node-category {
  @apply text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300;
}

.custom-node-body {
  /* 调整内边距 */
  @apply py-1 px-1;
}

.node-description {
  @apply text-sm text-gray-600 dark:text-gray-400 mb-3;
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
  @apply bg-gray-50 dark:bg-gray-700 rounded;
  /* 移除内边距，由内部组件控制 */
  min-height: 24px;
  /* 保持最小高度 */
}

.input-title,
.output-title {
  @apply text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 px-2;
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
  @apply ml-3 mr-3 bg-gray-50 dark:bg-gray-700 rounded;
  /* 调整左外边距以对齐 */
  /* 统一内边距 */
  min-height: 32px;
}

/* 参数名称样式调整 */
.param-name {
  @apply text-gray-700 dark:text-gray-200 font-medium leading-tight;
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
  @apply w-full py-0 px-1 text-xs rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500;
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
  @apply opacity-60 border-dashed border-gray-400 dark:border-gray-500;
}

/* 优先显示选中状态 */
.custom-node.selected {
  @apply ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-2 dark:ring-offset-gray-800 z-10;
}

/* 插槽名称输入框样式 */
.param-name-input {
  @apply w-full p-0.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200;
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
  @apply text-xs text-gray-500 dark:text-gray-400 px-2 py-1 border-t border-gray-200 dark:border-gray-600 flex items-center gap-2;
}

.info-item {
  @apply flex items-center;
}

/* 编辑组按钮样式 */
.edit-group-button {
  /* 尺寸和内边距已在 class 中定义 */
}
</style>
