import { ref, onUnmounted, onMounted } from "vue";
// Import Node and Edge types
import { useVueFlow, type Node as VueFlowNode, type Edge } from "@vue-flow/core";
import { measureTextWidth, NODE_TITLE_FONT, NODE_PARAM_FONT } from "../../utils/textUtils"; // Removed NODE_DESC_FONT
import type { UseNodeStateProps as BaseNodeStateProps } from "./useNodeState";

// 为 useNodeResize 定义更具体的 props 类型，包含顶层 type
interface UseNodeResizeProps extends BaseNodeStateProps {
  type?: string; // 节点在画布上的注册类型，例如 'core:GroupInput' 或 'custom:MyNode'
}
import { useNodeStore } from "@/stores/nodeStore";
// Remove unused workflowStore import
// import { useWorkflowStore } from '@/stores/workflowStore';
import { useTabStore } from "@/stores/tabStore";
import { useWorkflowInteractionCoordinator } from "../workflow/useWorkflowInteractionCoordinator";
// Import useWorkflowManager
import { useWorkflowManager } from "../workflow/useWorkflowManager";
import type { HistoryEntry, InputDefinition, DataFlowTypeName } from "@comfytavern/types"; // <-- Import HistoryEntry
import { DataFlowType, BuiltInSocketMatchCategory } from "@comfytavern/types"; // Import new types
import { createHistoryEntry } from "@comfytavern/utils"; // <-- Import createHistoryEntry

// --- 常量定义 ---

/** 节点允许的最小宽度 */
export const MIN_NODE_WIDTH = 160;
/** 用户手动调整节点大小时允许的最大宽度 */
export const MAX_NODE_WIDTH = 1200;
/** 自动计算节点宽度时的上限，防止过宽 */
export const AUTO_CALC_MAX_WIDTH = 420;
/** 自动计算节点宽度时的下限，保证基本可读性 */
export const AUTO_CALC_MIN_WIDTH = 200;

// --- 布局相关常量 (基于 BaseNode.vue 的 Tailwind 类) ---
// 这些值需要与 BaseNode.vue 中的样式保持同步

/**
 * 参数行左侧空间 = 左侧 Handle 宽度 (12px) + Handle 与参数名间距 (ml-2.5 -> 10px)
 * 注意：BaseNode.vue 中 ml-2.5 用于 grid 容器，实际 Handle 位于 grid 外部，
 * 但视觉上参数名距离左边缘约为 Handle 宽度 + 间距。
 * 这里简化为 Handle 宽度 + 视觉间距估算值。
 */
const PARAM_LEFT_HANDLE_SPACE = 12 + 10; // 22px

/**
 * 参数行右侧空间 = 右侧 Handle 宽度 (12px) + 参数名与 Handle 间距 (mr-2 -> 8px)
 * 注意：BaseNode.vue 中 mr-2 用于 flex 容器。
 */
const PARAM_RIGHT_HANDLE_SPACE = 12 + 8; // 20px

/** 参数名称与内联输入组件之间的间距 (gap-2 -> 8px in grid) */
const PARAM_NAME_INLINE_INPUT_GAP = 8;

/** 估算的内联输入组件（如数字、布尔值、下拉框）的最小宽度 */
const INLINE_INPUT_MIN_WIDTH = 120;

/** "输入"/"输出" 区域标题的水平内边距 (px-2 -> 8px * 2 = 16px) */

/**
 * Composable 函数，用于管理节点的宽度，包括手动调整大小和自动计算初始宽度。
 * @param props - 包含节点 ID 和其他节点状态信息的响应式 props 对象。
 */
export function useNodeResize(props: Readonly<UseNodeResizeProps>) {
  const nodeId = props.id; // 从 props 中获取节点 ID
  const { updateNode, viewport } = useVueFlow();
  const nodeStore = useNodeStore();
  // Remove unused workflowStore instance
  // const workflowStore = useWorkflowStore();
  const tabStore = useTabStore();
  const interactionCoordinator = useWorkflowInteractionCoordinator();
  // Get workflowManager instance
  const workflowManager = useWorkflowManager();

  /** 节点的当前宽度，响应式引用 */
  const width = ref(MIN_NODE_WIDTH); // 初始化为允许的最小宽度，将在 onMounted 中重新计算
  /** 标记当前是否正在调整节点大小 */
  const isResizing = ref(false);

  // --- 内部状态变量，用于拖拽计算 ---
  let startX = 0; // 拖拽开始时的鼠标 X 坐标
  let startWidth = 0; // 拖拽开始时的节点宽度
  let currentResizeHandler: ((e: MouseEvent) => void) | null = null; // 当前激活的 mousemove 事件处理器

  /**
   * 开始调整节点大小的操作。
   * 在鼠标按下 resize handle 时触发。
   * @param e - 鼠标事件对象
   */
  const startResize = (e: MouseEvent) => {
    isResizing.value = true;
    startX = e.pageX; // 记录起始鼠标位置
    startWidth = width.value; // 记录起始宽度

    // 定义 mousemove 事件处理器
    currentResizeHandler = (e: MouseEvent) => {
      if (!isResizing.value) return; // 如果已停止调整，则退出

      const diff = e.pageX - startX; // 计算鼠标水平移动距离
      const scaledDiff = diff / viewport.value.zoom; // 根据画布缩放比例调整移动距离

      // 计算新宽度：基于起始宽度加上缩放后的移动距离
      // 注意：当前实现仅支持拖动右侧 handle 调整大小。
      // 如果需要支持左侧 handle，需要修改此逻辑（例如，scaledDiff 需要取反，并同时更新节点位置）。
      const newWidth = Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, startWidth + scaledDiff));
      width.value = newWidth; // 更新响应式宽度，实时预览效果

      // 拖动过程中实时更新 VueFlow 样式，但不更新 store 或记录历史
      // 移除无效的第三个参数 { emit: false }
      // 暂时注释掉拖动过程中的更新，以隔离问题
      // updateNode(nodeId, { style: { width: `${newWidth}px` } });
    };

    // 添加全局鼠标事件监听器
    document.addEventListener("mousemove", currentResizeHandler, { passive: true }); // 使用被动监听器提高性能
    document.addEventListener("mouseup", stopResize);

    // 阻止事件冒泡，防止触发画布拖拽等其他行为
    e.stopPropagation();
  };

  /**
   * 停止调整节点大小的操作。
   * 在鼠标松开时触发。
   */
  const stopResize = () => {
    // 移除全局鼠标事件监听器
    if (currentResizeHandler) {
      document.removeEventListener("mousemove", currentResizeHandler);
      document.removeEventListener("mouseup", stopResize);
    }

    // 如果确实进行了调整大小操作
    if (isResizing.value) {
      // 移除此处的 updateNode 调用，协调器将处理最终状态更新
      // updateNode(nodeId, { style: { width: `${width.value}px` } })

      // --- 修改 - 使用协调器更新宽度并记录历史 ---
      const activeId = tabStore.activeTabId;
      if (activeId) {
        // 创建历史记录条目
        const nodeDisplayName = props.data.displayName || props.data.label || props.id;
        const newWidthValue = Math.round(width.value);
        const oldWidth = startWidth; // <-- Use startWidth captured at the beginning of resize

        const entry: HistoryEntry = createHistoryEntry(
          "adjust", // actionType
          "nodeSize", // objectType
          `调整宽度 ${nodeDisplayName}`, // summary
          {
            // details
            nodeId: nodeId,
            nodeName: nodeDisplayName,
            propertyName: "width",
            oldValue: Math.round(oldWidth), // <-- Add rounded oldWidth
            newValue: newWidthValue,
          }
        );

        // 调用协调器函数，传递 entry 对象
        interactionCoordinator.updateNodeDimensionsAndRecord(
          activeId,
          nodeId,
          { width: width.value }, // 只更新宽度
          entry
        );
        // console.log(`[useNodeResize:stopResize] Called coordinator to update node ${nodeId} width to ${width.value}`);
      } else {
        console.warn(
          "[useNodeResize:stopResize] No active tab ID found, cannot update node width via coordinator."
        );
      }
      // --- 结束修改 ---
    }

    // 重置状态
    isResizing.value = false;
    currentResizeHandler = null;
  };

  /**
   * 计算节点根据其内容（标题、分类标签、输入、输出）所需的最小宽度。
   * 这是自动计算初始宽度的核心逻辑。
   * @param title - 节点标题 (label 或 displayName)
   * @param inputs - 节点的输入定义对象
   * @param outputs - 节点的输出定义对象
   * @returns 计算出的最小所需宽度 (px)
   */
  const calculateMinWidth = (
    title: string,
    inputs: Record<string, InputDefinition>, // Updated type to InputDefinition
    outputs: Record<string, any> // 待办: 使用更精确的类型 OutputDefinition
  ): number => {
    // 从允许的自动计算最小宽度开始
    let requiredWidth = AUTO_CALC_MIN_WIDTH;
    // 跟踪最宽的插槽名称（输入或输出）的宽度，用于后续比例计算
    let maxSlotNameWidth = 0;

    // --- 1. 计算标题宽度 ---
    // 节点头部区域 (custom-node-header)
    let headerContentWidth = measureTextWidth(title, NODE_TITLE_FONT);
    const categoryText = props.data.category as string | undefined;
    if (categoryText) {
      const categoryWidthValue = measureTextWidth(categoryText, NODE_PARAM_FONT); // 分类标签通常字体较小，用 NODE_PARAM_FONT (text-xs)
      headerContentWidth += categoryWidthValue + 4; // 加上分类宽度和它们之间的 gap-1 (4px)
    }
    // 考虑头部左侧的图标/ID徽章空间 (估算16px) + 左右内边距 (px-2 -> 8px * 2 = 16px)
    const totalHeaderWidth = headerContentWidth + 16 + 16; // 16 for left icons/badge, 16 for L/R padding of header
    requiredWidth = Math.max(requiredWidth, totalHeaderWidth);

    // --- 2. 计算输入部分宽度 ---
    // 节点主体区域 (node-inputs)
    if (inputs && Object.keys(inputs).length > 0) {
      for (const key in inputs) {
        const input = inputs[key];
        if (!input) continue; // Add check for undefined input

        const paramName = input.displayName || input.description || key; // 获取参数显示名称
        const paramNameWidth = measureTextWidth(paramName, NODE_PARAM_FONT);
        maxSlotNameWidth = Math.max(maxSlotNameWidth, paramNameWidth); // 更新最宽插槽名称宽度

        // --- 计算当前输入行所需的宽度 ---
        let inputLineWidth = 0;
        // 判断是否为多行输入类型
        // Updated isMultiline logic
        const isMultiline =
          input.config?.multiline === true ||
          (input.dataFlowType === DataFlowType.STRING &&
            input.matchCategories?.includes(BuiltInSocketMatchCategory.CODE)) ||
          (input.dataFlowType === DataFlowType.ARRAY &&
            input.matchCategories?.includes(BuiltInSocketMatchCategory.CHAT_HISTORY));
        // 判断是否为按钮类型
        // Updated isButton logic
        const isButton =
          input.dataFlowType === DataFlowType.WILDCARD &&
          input.matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER);
        // 判断是否有内联输入组件 (排除多行、按钮、CONVERTIBLE_ANY、WILDCARD类型、动态类型，且类型为基础可内联类型)
        // Updated hasInlineInput logic
        const isConvertible =
          input.dataFlowType === DataFlowType.CONVERTIBLE_ANY ||
          input.matchCategories?.includes(BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);
        const isWildcardType = input.dataFlowType === DataFlowType.WILDCARD;
        const basicInlineDataFlowTypes: DataFlowTypeName[] = [
          DataFlowType.INTEGER,
          DataFlowType.FLOAT,
          DataFlowType.BOOLEAN,
          DataFlowType.STRING,
        ];
        const hasInlineInput =
          !isMultiline &&
          !isButton &&
          !isConvertible &&
          !isWildcardType &&
          !input.allowDynamicType &&
          basicInlineDataFlowTypes.includes(input.dataFlowType as DataFlowTypeName);

        if (hasInlineInput) {
          // 内联布局 (grid grid-cols-5):
          // | Handle | 参数名 (col-span-2) | 间隙 (gap-2) | 内联输入 (col-span-3) |
          // 估算宽度：
          // 1. 基于参数名宽度 (假设参数名占 grid 宽度的 2/5):
          const _widthFromParamName =
            paramNameWidth / (2 / 5) + PARAM_LEFT_HANDLE_SPACE + PARAM_NAME_INLINE_INPUT_GAP;
          // 2. 基于内联输入最小宽度 (假设输入占 grid 宽度的 3/5):
          const _widthFromInlineInput =
            INLINE_INPUT_MIN_WIDTH / (3 / 5) +
            PARAM_LEFT_HANDLE_SPACE +
            PARAM_NAME_INLINE_INPUT_GAP;
          // console.log(`[NodeResize S${step}-Input-${key} ${nodeDisplayNameForLog}] widthFromParamName (calc): ${_widthFromParamName}, widthFromInlineInput (calc): ${_widthFromInlineInput}`); // Log removed
          inputLineWidth = Math.max(_widthFromParamName, _widthFromInlineInput); // 取两者中较大的估算值
        } else if (isMultiline) {
          // 多行布局：
          // | Handle | 参数名 (col-span-2 / 全宽) |
          // 多行输入组件在下方单独占一行 (param-content)
          // 宽度主要由参数名和左侧空间决定
          inputLineWidth = paramNameWidth + PARAM_LEFT_HANDLE_SPACE;
        } else if (isButton) {
          // 按钮布局：
          // | 按钮 (col-span-5) |
          // 宽度主要由按钮本身决定，这里用参数名估算一个最小值
          inputLineWidth = paramNameWidth + PARAM_LEFT_HANDLE_SPACE; // 估算按钮文本宽度 + 左侧空间
        } else {
          inputLineWidth = paramNameWidth + PARAM_LEFT_HANDLE_SPACE;
        }
        requiredWidth = Math.max(requiredWidth, inputLineWidth + 8);
      }
    }

    // --- 3. 计算输出部分宽度 ---
    // 节点主体区域 (node-outputs)
    if (outputs && Object.keys(outputs).length > 0) {
      for (const key in outputs) {
        const output = outputs[key];
        const paramName = output.displayName || output.description || key; // 获取参数显示名称
        const paramNameWidth = measureTextWidth(paramName, NODE_PARAM_FONT);
        maxSlotNameWidth = Math.max(maxSlotNameWidth, paramNameWidth); // 更新最宽插槽名称宽度

        // 输出布局：| 参数名 (flex-grow) | 间隙 (gap-2) | Handle (flex-shrink-0) |
        // 宽度由参数名和右侧空间决定
        const outputLineWidth = paramNameWidth + PARAM_RIGHT_HANDLE_SPACE;
        // 更新所需宽度，考虑主体左右内边距 (px-1 -> 4*2=8)
        requiredWidth = Math.max(requiredWidth, outputLineWidth + 8);
      }
    }

    // --- 4. 应用基于最宽插槽名称的比例宽度调整 ---
    // 如果存在输入或输出插槽，则进行此调整
    if (maxSlotNameWidth > 0) {
      // 根据最宽的插槽名称估算总宽度。
      // 假设：对于内联布局，参数名大约占可用宽度的 40% (2/5)。
      // 增加 10% 的缓冲区，以提供一些额外的空间。
      const _slotBasedWidth = (maxSlotNameWidth * 1.1) / 0.4; // 估算基于最宽插槽名称的宽度
      // 加上主体左右内边距 (px-1 -> 4*2=8)
      const _calculatedTotalWidth = _slotBasedWidth + 8;
      // console.log(`[NodeResize S${step} ${nodeDisplayNameForLog}] maxSlotNameWidth: ${maxSlotNameWidth}, slotBasedWidth (calc): ${_slotBasedWidth}, calculatedTotalWidth (calc): ${_calculatedTotalWidth}`); // Log removed
      // const oldRequiredWidthForSlotBased = requiredWidth; // Log removed
      requiredWidth = Math.max(requiredWidth, _calculatedTotalWidth);
      // console.log(`[NodeResize S${step} ${nodeDisplayNameForLog}] oldRequiredWidth: ${oldRequiredWidthForSlotBased}, newRequiredWidth after slot based: ${requiredWidth}`); // Log removed
    }

    // --- 5. 应用最终限制 ---
    // 确保最终计算出的宽度在自动计算的最小和最大宽度之间。
    // 手动调整大小的限制 (MAX_NODE_WIDTH) 在拖动逻辑中单独处理。
    const finalCalculatedWidth = Math.ceil(requiredWidth);
    const finalWidth = Math.min(
      AUTO_CALC_MAX_WIDTH,
      Math.max(AUTO_CALC_MIN_WIDTH, finalCalculatedWidth)
    );
    return finalWidth; // 返回向上取整后的宽度
  };

  // --- 在 onMounted 钩子中计算并设置初始宽度 ---
  onMounted(() => {
    // --- 读取 workflowStore 中已保存的宽度 ---
    const activeId = tabStore.activeTabId;
    let storedWidth: number | undefined = undefined;
    if (activeId) {
      // 修改 - 通过 workflowManager 获取元素列表并查找节点
      const elements = workflowManager.getElements(activeId); // 使用 workflowManager
      // 添加类型注解
      const node = elements.find(
        (el: VueFlowNode | Edge) => el.id === nodeId && !("source" in el)
      ) as VueFlowNode | undefined;
      // 处理 node.width 的多种类型
      const rawWidth = node?.width;
      if (typeof rawWidth === "number") {
        storedWidth = rawWidth;
      } else if (typeof rawWidth === "string") {
        const parsedWidth = parseFloat(rawWidth); // 尝试解析 "200px" -> 200
        if (!isNaN(parsedWidth)) {
          storedWidth = parsedWidth;
        }
      }
      // 其他类型 (WidthFunc, undefined, NaN) 会导致 storedWidth 保持 undefined
    }
    // --- 结束读取 ---

    try {
      // 从 nodeStore 中查找当前节点的定义
      // 恢复使用 props.data.type 来查找定义
      const nodeDefinition = nodeStore.nodeDefinitions.find((def) => def.type === props.data?.type);

      // 检查是否为 GroupInput 或 GroupOutput 节点 (这些是特殊的内部节点)
      // 恢复使用 props.data?.type 和带命名空间的类型进行判断
      // 使用顶层的 props.type 进行判断
      const actualType = props.type;
      const isGroupIONode = actualType === "core:GroupInput" || actualType === "core:GroupOutput";
      const isNodeGroupNode = actualType === "core:NodeGroup";

      // 移除调试日志

      let initialNodeWidth = MIN_NODE_WIDTH; // 默认值

      // --- 调整优先级 ---
      if (isGroupIONode) {
        // 0. 最高优先级：IO 节点强制使用 AUTO_CALC_MIN_WIDTH
        initialNodeWidth = AUTO_CALC_MIN_WIDTH;
      } else if (storedWidth !== undefined && storedWidth >= MIN_NODE_WIDTH) {
        // 1. 次高优先级：使用 workflowStore 中存储的有效宽度 (非 IO 节点)
        initialNodeWidth = storedWidth;
      } else if (nodeDefinition?.width) {
        // 2. 再次优先级：节点定义中指定了首选宽度 (非 IO 节点)
        initialNodeWidth = Math.min(
          AUTO_CALC_MAX_WIDTH,
          Math.max(MIN_NODE_WIDTH, nodeDefinition.width)
        );
      } else if (isNodeGroupNode) {
        // NodeGroup 检查移到这里
        // 3. 再次优先级：NodeGroup 节点 (如果前面条件不满足)
        initialNodeWidth = AUTO_CALC_MIN_WIDTH; // 或者也可以考虑动态计算？目前设为固定值
      } else {
        // 4. 最低优先级：动态计算 (非 IO, 非 Group, 无存储/定义宽度)
        const nodeLabel = props.data.displayName || props.data.label || "";
        // const nodeDesc = props.data.description || undefined // Removed nodeDesc
        const nodeInputs = props.data.inputs || {};
        const nodeOutputs = props.data.outputs || {};
        const minWidth = calculateMinWidth(nodeLabel, /* nodeDesc, */ nodeInputs, nodeOutputs); // Removed nodeDesc argument
        initialNodeWidth = Math.max(MIN_NODE_WIDTH, minWidth);
      }
      // --- 结束调整优先级 ---

      // 设置最终的初始宽度
      width.value = initialNodeWidth;
      // 同时更新 VueFlow 样式，确保初始渲染正确
      updateNode(nodeId, { style: { width: `${initialNodeWidth}px` } });
    } catch (error) {
      console.error(`Error calculating initial node width for ${props.id}:`, error);
      width.value = MIN_NODE_WIDTH;
      updateNode(nodeId, { style: { width: `${MIN_NODE_WIDTH}px` } });
    }
  });

  // --- 在组件卸载时清理事件监听器 ---
  onUnmounted(() => {
    // 调用 stopResize 以确保移除可能存在的 mousemove 和 mouseup 监听器，防止内存泄漏
    stopResize();
  });

  // --- 返回 Composable 的公共接口 ---
  return {
    /** 节点的当前宽度 (响应式) */
    width,
    /** 是否正在调整大小 (响应式) */
    isResizing,
    /** 开始调整大小的函数 */
    startResize,
    // calculateMinWidth 是内部函数，不导出
  };
}
