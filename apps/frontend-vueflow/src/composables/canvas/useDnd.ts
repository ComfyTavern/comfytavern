import { useVueFlow } from "@vue-flow/core";
import { ref, watch } from "vue";
import type { Node, XYPosition } from "@vue-flow/core";

// 全局状态（在实际项目中应考虑更好的状态管理方式）
const state = {
  draggedNodeData: ref<any>(null),
  isDragOver: ref(false),
  isDragging: ref(false),
};

import { useUniqueNodeId } from "../node/useUniqueNodeId";
import { useTabStore } from "@/stores/tabStore"; // 导入 tab store 以获取 activeTabId
import { useWorkflowStore } from "@/stores/workflowStore"; // <-- 导入 workflow store
// import { useNodeStore } from '@/stores/nodeStore'; // <-- 移除未使用的导入

export default function useDragAndDrop() {
  const { draggedNodeData, isDragOver, isDragging } = state;

  const { screenToFlowCoordinate } = useVueFlow(); // 移除了未使用的 onNodesInitialized, updateNode
  const { generateUniqueNodeId } = useUniqueNodeId();
  const tabStore = useTabStore(); // 获取 tab store 实例
  const workflowStore = useWorkflowStore(); // <-- 获取 workflow store 实例
  // const nodeStore = useNodeStore(); // <-- 移除未使用的实例化

  // 当拖拽状态变化时修改body样式
  watch(isDragging, (dragging) => {
    document.body.style.userSelect = dragging ? "none" : "";
  });

  /**
   * 开始拖拽时的处理
   */
  function onDragStart(event: DragEvent, nodeData: any) {
    try {
      draggedNodeData.value = nodeData;
      isDragging.value = true;

      // 先存储数据到全局状态，作为后备方案
      state.draggedNodeData.value = nodeData;

      if (event.dataTransfer) {
        const nodeDataStr = JSON.stringify(nodeData);

        // 清除之前可能存在的数据
        event.dataTransfer.clearData();

        // 使用一个特定的MIME类型来避免与其他拖拽操作冲突
        const DND_MIME_TYPE = "application/x-comfytavern-node-drag-data";

        try {
          console.debug(`[useDnd] onDragStart: Attempting to set data with DND_MIME_TYPE. nodeDataStr (first 100 chars): "${nodeDataStr.substring(0, 100)}..."`);
          event.dataTransfer.setData(DND_MIME_TYPE, nodeDataStr);
          // 验证是否设置成功 (注意：某些浏览器可能不允许在 dragstart 中立即 getData)
          // console.debug(`[useDnd] onDragStart: Data set for ${DND_MIME_TYPE}. Trying to getData immediately (may not work):`, event.dataTransfer.getData(DND_MIME_TYPE));
          console.debug(`[useDnd] onDragStart: event.dataTransfer.types after setData:`, Array.from(event.dataTransfer.types));
        } catch (e) {
          console.error(`[useDnd] onDragStart: 无法设置 ${DND_MIME_TYPE} 数据类型:`, e);
        }

        // 移除了对 application/vueflow, text/plain, application/json 的设置，以增强隔离性
        // 如果需要，可以保留一个通用类型作为后备，但优先使用特定类型

        event.dataTransfer.effectAllowed = "move";

        // 创建一个自定义的拖拽图标 (SVG + Div)
        try {
          const dragIcon = document.createElement("div");
          // 基本样式
          dragIcon.style.position = "absolute";
          dragIcon.style.top = "-1000px"; // 移出屏幕外，避免闪烁
          dragIcon.style.fontFamily = "sans-serif"; // 保持字体设置
          dragIcon.style.whiteSpace = "nowrap";
          dragIcon.style.pointerEvents = "none"; // 确保不干扰拖放事件
          dragIcon.style.display = "flex"; // 使用 flex 布局对齐图标和文本
          dragIcon.style.alignItems = "center"; // 垂直居中
          dragIcon.style.padding = "8px 12px"; // 调整内边距
          dragIcon.style.borderRadius = "8px"; // 调整圆角，同 context-menu-base
          dragIcon.style.fontSize = "13px"; // 调整字体大小

          // 判断暗色模式
          const isDarkMode = document.documentElement.classList.contains('dark');

          if (isDarkMode) {
            dragIcon.style.backgroundColor = `hsl(var(--ct-background-surface-hsl) / 0.9)`; // 对应语义化的 surface 背景色，稍作透明
            dragIcon.style.color = `hsl(var(--ct-text-base-hsl))`; // 对应主题化的 text-base
            dragIcon.style.border = "1px solid rgba(55, 65, 81, 0.9)"; // 对应 dark:border-gray-700
          } else {
            dragIcon.style.backgroundColor = "rgba(255, 255, 255, 0.9)"; // 对应 bg-white，稍作透明
            dragIcon.style.color = `hsl(var(--ct-text-base-hsl))`; // 对应主题化的 text-base
            dragIcon.style.border = "1px solid rgba(229, 231, 235, 0.9)"; // 对应 border-gray-200
          }
          // 统一的阴影，参考 context-menu-base 但可以略微调整
          dragIcon.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)";


          // 添加 SVG 图标 (示例：一个更通用的拖拽图标或节点图标)
          // 这里使用一个简单的方块加号图标，示意“添加节点”
          const svgIcon = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="${isDarkMode ? 'rgba(209, 213, 229, 1)' : 'rgba(75, 85, 99, 1)'}" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"
                style="margin-right: 8px; vertical-align: middle;">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="12" y1="18" x2="12" y2="12"></line>
              <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
          `;

          // 设置内容，可以包含节点类型或名称
          const nodeLabel = nodeData.displayName || nodeData.type || "节点";
          // dragIcon.textContent = `拖放: ${nodeLabel}`; // 如果只用文本
          dragIcon.innerHTML = `${svgIcon}<span>拖放: ${nodeLabel}</span>`; // 使用 innerHTML 包含 SVG

          // 添加到 body 以便 setDragImage 可以引用
          document.body.appendChild(dragIcon);

          // 设置拖拽图像，偏移量可以调整图标相对于指针的位置
          // (offsetX, offsetY) - 负值使图标向左/上移动
          event.dataTransfer.setDragImage(dragIcon, 15, 15); // 稍微偏右下

          // 异步移除 DOM 元素，避免影响 setDragImage
          setTimeout(() => {
            if (document.body.contains(dragIcon)) {
              document.body.removeChild(dragIcon);
            }
          }, 0);
        } catch (e) {
          console.warn("无法设置自定义拖拽图像:", e);
          // 回退到默认或透明图像，以防自定义图标失败
          try {
            const img = new Image();
            img.src =
              "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            event.dataTransfer.setDragImage(img, 0, 0);
          } catch (fallbackError) {
            console.warn("设置回退拖拽图像也失败:", fallbackError);
          }
        }

        console.debug("开始拖拽节点，已设置多种数据类型");
      } else {
        console.warn("浏览器不支持dataTransfer，将使用全局状态作为备选");
      }

      // 添加事件监听
      document.addEventListener("drop", onDragEnd);
      document.addEventListener("dragend", onDragEnd);
    } catch (error) {
      console.error("拖拽启动失败:", error);
      // 重置状态
      onDragEnd();
    }
  }

  /**
   * 拖拽在目标上方时的处理
   */
  function onDragOver(event: DragEvent) {
    try {
      const DND_MIME_TYPE = "application/x-comfytavern-node-drag-data";
      // 检查是否是有效的节点拖拽操作
      // 如果 dataTransfer 不存在，或者不包含我们期望的特定类型，则不认为是有效的拖放目标
      if (!event.dataTransfer || !event.dataTransfer.types.includes(DND_MIME_TYPE)) {
        // 如果不是从节点面板拖拽过来的（没有设置特定数据类型），
        // 则不阻止默认行为，这样它就不会成为一个有效的放置目标。
        // 这有助于避免与非节点拖拽操作（如面板调整大小）冲突。
        // console.debug(`[useDnd] onDragOver: Not a ComfyTavern node drag operation. Types: ${event.dataTransfer?.types.join(', ')}`);
        return;
      }

      event.preventDefault();
      // console.debug(`[useDnd] onDragOver: Valid ComfyTavern node drag operation detected.`);

      // 只有在确认是有效的节点拖拽时，才设置 dropEffect 和 isDragOver
      // draggedNodeData.value 应该在 onDragStart 中被设置
      if (draggedNodeData.value || state.draggedNodeData.value) { // 保留对全局状态的检查作为后备
        isDragOver.value = true;
        event.dataTransfer.dropEffect = "move";
      } else {
        // 如果到这里 draggedNodeData 还是 null，可能意味着拖拽状态不一致
        // 或者拖拽的不是我们期望的节点数据。
        // 为安全起见，可以不设置 isDragOver 或 dropEffect。
        console.warn("[useDnd] onDragOver: Valid MIME type detected, but draggedNodeData is null.");
        isDragOver.value = false; // 明确设置为 false
      }
    } catch (error) {
      console.warn("[useDnd] 拖拽悬停处理失败:", error);
      isDragOver.value = false; // 出错时也重置状态
    }
  }

  /**
   * 拖拽离开目标区域时的处理
   */
  function onDragLeave() {
    isDragOver.value = false;
  }

  /**
   * 拖拽结束时的处理
   */
  function onDragEnd() {
    isDragging.value = false;
    isDragOver.value = false;
    draggedNodeData.value = null;

    // 清除事件监听
    document.removeEventListener("drop", onDragEnd);
    document.removeEventListener("dragend", onDragEnd);
  }

  /**
   * 放置拖拽元素时的处理
   */
  // 定义拖拽数据的接口
  interface DraggedNodeData {
    type: string;
    name?: string;
    category?: string;
    // 添加其他可能存在的属性
    [key: string]: any;
  }

  async function onDrop(event: DragEvent) {
    const DND_MIME_TYPE = "application/x-comfytavern-node-drag-data";

    // 首先检查此 drop 事件是否针对 useDnd (即是否包含我们特定的 MIME 类型)
    if (!event.dataTransfer || !event.dataTransfer.types.includes(DND_MIME_TYPE)) {
      console.debug(`[useDnd] onDrop: Event ignored. MIME type "${DND_MIME_TYPE}" not found. This drop is likely for another handler or an unintended drop. Types: ${event.dataTransfer ? Array.from(event.dataTransfer.types).join(', ') : 'N/A'}`);
      // 对于非预期的拖放，我们可能仍然需要清理 useDnd 自身的拖拽状态（isDragging, isDragOver）
      // 因为 onDragLeave 可能没有在所有情况下都正确触发（例如，如果拖拽在浏览器窗口外释放然后返回）。
      // onDragEnd() 会处理这些状态的重置。
      // 注意：不应该在这里调用 event.preventDefault() 或 event.stopPropagation()，
      // 因为这个事件不是由 useDnd 发起的拖拽操作对应的。
      // 如果 onDragEnd 依赖于 drop 事件来清理，那么这里调用它可能是合适的。
      // 考虑到 onDragEnd 也监听了 'dragend' 事件，它最终会被调用。
      // 但为了确保 useDnd 的内部状态 (isDragOver) 立即清除，可以调用部分清理逻辑或 onDragEnd。
      // 鉴于 onDragEnd 也会清除 draggedNodeData，这对于非DND操作是安全的。
      onDragEnd(); // 清理 useDnd 相关的拖拽状态
      return;
    }

    // 如果事件是针对 useDnd 的，则阻止默认行为并处理它
    event.preventDefault();
    console.debug(`[useDnd] onDrop: Event accepted. MIME type "${DND_MIME_TYPE}" found. Processing node drop.`);

    let nodeData: DraggedNodeData | null = null; // 使用定义的接口

    try {
      // 首先尝试从dataTransfer获取数据 (此时我们已确认 DND_MIME_TYPE 存在)
      if (event.dataTransfer) {
        // console.debug(`[useDnd] onDrop: event.dataTransfer.types before getData (already checked):`, Array.from(event.dataTransfer.types)); // 日志已在上方添加
        let nodeDataStr: string | null = null;
        try {
          const data = event.dataTransfer.getData(DND_MIME_TYPE);
          if (data && data.length > 0) { // 确保数据不是空字符串
            nodeDataStr = data;
            console.debug(`[useDnd] onDrop: 成功从 ${DND_MIME_TYPE} 获取数据: "${data.substring(0, 100)}..."`);
          } else {
            // 这不应该发生，因为我们已经在开始时检查了 types.includes(DND_MIME_TYPE)
            // 并且如果类型存在，getData 通常应该返回非空字符串（除非 setData 时设置了空字符串）
            console.warn(`[useDnd] onDrop: 从 ${DND_MIME_TYPE} 获取的数据为空字符串或null，尽管类型存在。 Data: "${data}"`);
          }
        } catch (e) {
          // 理论上，如果 types.includes 是 true，getData 不应该抛出“类型未设置”的错误，但可能因其他原因失败
          console.warn(`[useDnd] onDrop: 获取 ${DND_MIME_TYPE} 数据时发生异常:`, e);
        }

        if (nodeDataStr) {
          try {
            nodeData = JSON.parse(nodeDataStr);
            console.debug("[useDnd] onDrop: 成功解析通过特定MIME类型获取的拖拽数据:", nodeData);
          } catch (e: any) {
            console.error(`[useDnd] onDrop: 解析从 ${DND_MIME_TYPE} 获取的JSON数据失败 ("${nodeDataStr.substring(0, 100)}..."):`, e.message);
            nodeData = null;
          }
        } else {
          console.warn(`[useDnd] onDrop: 未能从 ${DND_MIME_TYPE} 获取有效数据字符串，将尝试使用全局状态作为后备。`);
        }
      }

      // 如果从dataTransfer没有获取到数据，尝试使用全局状态中的数据
      // 类型断言，因为我们检查了 null
      if (!nodeData) {
        nodeData = (draggedNodeData.value || state.draggedNodeData.value) as DraggedNodeData | null;
        if (nodeData) {
          console.debug("使用全局状态中的拖拽数据:", nodeData);
        }
      }

      // 如果仍然没有数据，则无法继续
      if (!nodeData) {
        console.error("无法获取拖拽节点数据，拖拽失败");
        return;
      }

      // 转换鼠标坐标到画布坐标
      const position = screenToFlowCoordinate({
        x: event.clientX,
        y: event.clientY,
      }) as XYPosition;

      // 获取当前活动标签页的 ID
      const currentTabId = tabStore.activeTabId;
      if (!currentTabId) {
        console.error("useDnd: Cannot generate node ID, no active tab found.");
        // 可能需要更健壮的错误处理，例如显示消息给用户
        onDragEnd(); // 清理拖拽状态
        return; // 阻止添加节点
      }

      const nodeId = generateUniqueNodeId(currentTabId, nodeData.type || "node");

      // Construct the full type (namespace:type)
      const fullType = `${nodeData.namespace || 'core'}:${nodeData.type}`; // Default to 'core' namespace

      // 创建新节点，position 直接使用鼠标落点坐标
      const newNode: Node = {
        id: nodeId,
        type: fullType, // Use the constructed full type
        label: nodeData.displayName || nodeData.type, // Use displayName for label
        position, // <-- 直接使用 screenToFlowCoordinate 的结果
        // Pass the original definition data, excluding namespace/type which are handled above
        data: { ...nodeData },
        // 移除 style，让 BaseNode 根据 data 决定样式
        // style: { ... }
      };

      // Initialize GroupInput/Output node data with current workflow interface
      if (currentTabId) {
        const workflowData = workflowStore.getWorkflowData(currentTabId);
        if (workflowData) {
          if (fullType === 'core:GroupInput') {
            newNode.data = {
              ...newNode.data,
              outputs: workflowData.interfaceInputs || {}, // Use current interface inputs
            };
            console.debug(`[useDnd] Initialized GroupInput (${newNode.id}) outputs from workflow interface.`);
          } else if (fullType === 'core:GroupOutput') {
            newNode.data = {
              ...newNode.data,
              inputs: workflowData.interfaceOutputs || {}, // Use current interface outputs
            };
            console.debug(`[useDnd] Initialized GroupOutput (${newNode.id}) inputs from workflow interface.`);
          }
        } else {
          console.warn(`[useDnd] Could not get workflow data for tab ${currentTabId} to initialize Group IO node.`);
        }
      }

      // --- 移除添加后尝试居中对齐的逻辑 ---

      // 添加节点到 store 并记录历史
      if (currentTabId) {
        // 确保 currentTabId 存在
        const nodeLabel = nodeData.displayName || nodeData.type || "节点"; // Construct node label part
        // Construct the HistoryEntry object
        const historyEntry = {
          actionType: 'add',
          objectType: 'node',
          summary: `添加节点 (${nodeLabel})`,
          details: { nodeId: newNode.id, nodeType: newNode.type, nodeLabel: nodeLabel },
          timestamp: Date.now()
        };

        // console.debug(`[useDnd] Calling addNodeAndRecord for tab ${currentTabId}, node ID: ${newNode.id}`);
        await workflowStore.addNodeAndRecord(currentTabId, newNode, historyEntry); // Pass the HistoryEntry object
        console.log("通过拖拽添加了节点并记录了历史:", newNode); // 保留为日志 - 重要的用户操作结果

        // 注意：现在需要确保 VueFlow 实例能够反映 store 中的变化。
        // 这通常通过 :model-value 绑定和 workflowStore 的响应性来实现。
      } else {
        console.error("[useDnd] Cannot add node via drop: No active tab ID found.");
      }

      // 重置拖拽状态
      onDragEnd();
    } catch (error) {
      console.error("处理拖拽放置失败:", error);
      // 确保状态被重置
      onDragEnd();
    }
  }

  return {
    draggedNodeData,
    isDragOver,
    isDragging,
    onDragStart,
    onDragLeave,
    onDragOver,
    onDrop,
  };
}
