<script setup lang="ts">
import { Handle, Position, type NodeProps } from "@vue-flow/core";
import { getInputComponent } from "../inputs";
import { computed, ref, watch, nextTick } from "vue";
import { useVueFlow } from "@vue-flow/core";
import { useThemeStore } from "../../../stores/theme";
import { useTabStore } from "@/stores/tabStore";
import { storeToRefs } from "pinia";
import {
  DataFlowType,
  type HistoryEntry,
  type InputDefinition,
  BuiltInSocketMatchCategory,
} from "@comfytavern/types"; // <-- Import HistoryEntry
import { ExecutionStatus } from "@comfytavern/types";
import { createHistoryEntry } from "@comfytavern/utils"; // <-- Import createHistoryEntry
import { useExecutionStore } from "@/stores/executionStore"; // 导入执行状态 Store
import { useNodeResize } from "../../../composables/node/useNodeResize";
import { useGroupIOSlots } from "@/composables/group/useGroupIOSlots"; // 导入 Group IO 插槽 Composable
import { useNodeState } from "@/composables/node/useNodeState"; // 导入节点状态 Composable
import { useNodeProps as useNodePropsComposable } from "@/composables/node/useNodeProps"; // 导入节点 Props Composable 并重命名
import { useNodeActions } from "@/composables/node/useNodeActions"; // 导入节点操作 Composable
import { useWorkflowInteractionCoordinator } from "@/composables/workflow/useWorkflowInteractionCoordinator"; // 导入工作流交互协调器
import { useNodeClientScript } from "@/composables/node/useNodeClientScript"; // 导入客户端脚本 Composable
import Tooltip from "../../common/Tooltip.vue"; // 导入提示框组件
import styles from "./handleStyles.module.css";

const props = defineProps<NodeProps>();

const nodeRootRef = ref<HTMLDivElement | null>(null); // 节点根元素引用

const { width, isResizing, startResize } = useNodeResize(props); // 使用节点宽度调整 Composable
const themeStore = useThemeStore();
const { isDark } = storeToRefs(themeStore);
const executionStore = useExecutionStore(); // 获取执行状态 Store 实例
const tabStore = useTabStore();
const { activeTabId } = storeToRefs(tabStore);
const interactionCoordinator = useWorkflowInteractionCoordinator(); // 获取工作流交互协调器实例

// 使用节点状态、属性和操作相关的 Composables
const {
  isInputConnected,
  getInputConnectionCount,
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

// 监听顺序更改并触发更新
watch(
  [inputOrderKey, outputOrderKey],
  () => {
    nextTick(() => {
      updateNodeInternals([props.id]);
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
              class="relative flex-shrink-0"
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
                  ]"
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
    </div>

    <!-- 节点输入区域 -->
    <div class="node-inputs" :key="`inputs-${finalInputs.map((i) => i.key).join(',')}`">
      <!-- 直接迭代 finalInputs -->
      <div v-for="input in finalInputs" :key="`input-${input.key}`" class="node-param">
        <!-- 输入参数行布局：连接点、名称、内联输入组件 -->
        <div class="param-header">
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
            class="relative flex-shrink-0"
            @contextmenu.prevent.stop="emitSlotContextMenu($event, String(input.key), 'target')"
          >
            <!-- Handle 的容器 -->
            <!-- 使用 Tooltip 包裹 Handle 以显示类型和连接数 -->
            <Tooltip v-if="input.dataFlowType" placement="left" :maxWidth="400">
              <template #content>
                <span>{{ input.dataFlowType }}</span>
                <span
                  v-if="isMultiInput(input) && getInputConnectionCount(String(input.key)) > 0"
                  class="ml-1"
                >
                  ({{ getInputConnectionCount(String(input.key)) }})
                </span>
              </template>
              <Handle
                :id="String(input.key)"
                type="target"
                :position="Position.Left"
                :class="[
                  styles.handle,
                  styles.handleLeft,
                  getHandleTypeClass(input.dataFlowType),
                  isAnyType(input.dataFlowType) && styles.handleAny, // 条件性添加类名
                  input.multi && styles.handleMulti, // 如果支持多连接，添加方形样式
                ]"
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
                getHandleTypeClass(input.dataFlowType), // 即使没有类型也尝试应用，可能为 null
                isAnyType(input.dataFlowType) && styles.handleAny, // 条件性添加类名
                input.multi && styles.handleMulti, // 如果支持多连接，添加方形样式
              ]"
            />
          </div>

          <!-- 参数名称和内联输入组件容器 (固定比例布局) -->
          <div class="grid grid-cols-5 gap-2 ml-2.5 w-full items-center">
            <!-- 改为 Grid 布局，5列，保持垂直居中 -->
            <!-- 参数名称容器 (占 40% 宽度) -->
            <!-- 条件：如果不是按钮类型，则显示参数名称 -->
            <div
              v-if="
                !(
                  input.dataFlowType === DataFlowType.WILDCARD &&
                  input.matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER)
                )
              "
              class="col-span-2 text-left flex items-center h-4"
            >
              <!-- 占据 2 列 -->
              <!-- 使用 formatDescription 处理 Tooltip 内容 -->
              <Tooltip
                :content="
                  // Use final description from input object
                  formatDescription(input.description) || input.displayName || String(input.key)
                "
                placement="top"
                :maxWidth="400"
              >
                <div class="param-name truncate text-left">
                  <!-- 确保文本左对齐 -->
                  <!-- 显示时也优先显示格式化后的 description -->
                  {{
                    // Use final description from input object
                    input.displayName || formatDescription(input.description) || String(input.key)
                  }}
                </div>
              </Tooltip>
            </div>

            <!-- 内联输入组件容器 -->
            <!-- 修改 v-if 条件以包含按钮，并调整 col-span -->
            <div
              v-if="
                // 条件：非按钮类型的内联输入
                props.type !== 'core:GroupInput' &&
                props.type !== 'core:GroupOutput' &&
                !(
                  input.dataFlowType === DataFlowType.WILDCARD &&
                  input.matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER)
                ) && // 排除按钮
                (!isInputConnected(String(input.key)) || isMultiInput(input)) &&
                getInputComponent(input.dataFlowType, input.config, input.matchCategories) &&
                (input.dataFlowType === DataFlowType.INTEGER ||
                  input.dataFlowType === DataFlowType.FLOAT ||
                  input.dataFlowType === DataFlowType.BOOLEAN ||
                  (input.dataFlowType === DataFlowType.STRING && !!input.config?.suggestions) || // Logic for COMBO
                  (input.dataFlowType === DataFlowType.STRING && !input.config?.multiline))
              "
              class="inline-input flex items-center h-4 col-span-3 pr-2 justify-end"
              @mousedown.stop
            >
              <!-- 阻止 mousedown 冒泡 -->
              <component
                :is="getInputComponent(input.dataFlowType, input.config, input.matchCategories)"
                :model-value="getInputValue(String(input.key))"
                v-bind="inputPropsMap[String(input.key)]?.props"
                @update:modelValue="updateInputValue(String(input.key), $event)"
              />
            </div>
            <!-- 如果没有内联组件（且不是按钮），保留空间以对齐 -->
            <div
              v-else-if="
                !(
                  input.dataFlowType === DataFlowType.WILDCARD &&
                  input.matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER)
                )
              "
              class="col-span-3 h-4"
            ></div>
            <!-- 占据 3 列 -->
            <!-- 按钮组件容器 (占满整行) -->
            <div
              v-if="
                input.dataFlowType === DataFlowType.WILDCARD &&
                input.matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER)
              "
              class="col-span-5 w-full py-1 pr-2 flex justify-center items-center"
              @mousedown.stop
            >
              <component
                :is="getInputComponent(input.dataFlowType, input.config, input.matchCategories)"
                :model-value="getInputValue(String(input.key))"
                v-bind="inputPropsMap[String(input.key)]?.props"
                @click="() => handleButtonClick(String(input.key))"
              />
            </div>

            <!-- 按钮组件容器 (占满整行) - 此部分将被合并到上面的内联输入组件逻辑中，故移除 -->
            <!--
            <div v-if="input.dataFlowType === DataFlowType.WILDCARD && input.matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER)" class="col-span-5 w-full py-1 pr-2" @mousedown.stop>
              <component :is="getInputComponent(input.dataFlowType, input.config, input.matchCategories)"
                :model-value="getInputValue(String(input.key))" v-bind="inputPropsMap[String(input.key)]" @change="
                  updateInputValue(String(input.key), ($event.target as HTMLInputElement).value)
                  " @click="() => handleButtonClick(String(input.key))" />
            </div>
            -->
          </div>
        </div>

        <!-- 多行文本/代码/历史记录等特殊输入组件 (根据条件显示) -->
        <div
          v-if="
            props.type !== 'core:GroupInput' && // Roo: 使用带命名空间的类型
            props.type !== 'core:GroupOutput' && // Roo: 使用带命名空间的类型
            getInputComponent(input.dataFlowType, input.config, input.matchCategories) && // 传递 matchCategories
            // 条件1: 类型是 HISTORY, CODE, 多行 STRING, 或 display_only STRING
            // 移除 BUTTON 类型，因为它已在 param-header 中处理
            ((input.dataFlowType === DataFlowType.OBJECT &&
              input.matchCategories?.includes(BuiltInSocketMatchCategory.CHAT_HISTORY)) || // Logic for HISTORY
              (input.dataFlowType === DataFlowType.STRING &&
                input.matchCategories?.includes(BuiltInSocketMatchCategory.CODE)) || // Logic for CODE
              (input.dataFlowType === DataFlowType.STRING &&
                (input.config?.multiline || input.config?.display_only))) &&
            // 条件2: 连接状态判断 (display_only 始终显示，其他类型根据连接和 showReceivedValue 判断)
            ((input.dataFlowType === DataFlowType.STRING && input.config?.display_only) || // display_only 始终显示
              !isInputConnected(String(input.key)) || // 或者未连接
              (isInputConnected(String(input.key)) && input.config?.showReceivedValue)) // 或者已连接且配置了 showReceivedValue
          "
          class="param-content"
          @mousedown.stop
        >
          <!-- 阻止 mousedown 冒泡 -->
          <component
            :is="getInputComponent(input.dataFlowType, input.config, input.matchCategories)"
            :model-value="getInputValue(String(input.key))"
            v-bind="inputPropsMap[String(input.key)]"
            :height="props.data.componentStates?.[String(input.key)]?.height"
            @blur="handleComponentBlur(String(input.key), $event)"
            @resize-interaction-end="handleComponentResizeEnd(String(input.key), $event)"
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
      console.log("BaseNode emitting slot-contextmenu:", detail);
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
