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

        // 设置多种数据类型，增加兼容性
        try {
          event.dataTransfer.setData("application/vueflow", nodeDataStr);
        } catch (e) {
          console.warn("无法设置application/vueflow数据类型:", e);
        }

        try {
          event.dataTransfer.setData("text/plain", nodeDataStr);
        } catch (e) {
          console.warn("无法设置text/plain数据类型:", e);
        }

        // 尝试使用JSON格式
        try {
          event.dataTransfer.setData("application/json", nodeDataStr);
        } catch (e) {
          console.warn("无法设置application/json数据类型:", e);
        }

        event.dataTransfer.effectAllowed = "move";

        // 创建一个自定义的拖拽图标 (SVG + Div)
        try {
          const dragIcon = document.createElement("div");
          // 基本样式
          dragIcon.style.position = "absolute";
          dragIcon.style.top = "-1000px"; // 移出屏幕外，避免闪烁
          dragIcon.style.padding = "5px 10px";
          dragIcon.style.backgroundColor = "rgba(100, 100, 255, 0.8)"; // 半透明蓝色背景
          dragIcon.style.color = "white";
          dragIcon.style.borderRadius = "4px";
          dragIcon.style.fontSize = "12px";
          dragIcon.style.fontFamily = "sans-serif";
          dragIcon.style.whiteSpace = "nowrap";
          dragIcon.style.pointerEvents = "none"; // 确保不干扰拖放事件

          // 添加 SVG 图标 (示例：一个简单的矩形代表节点)
          // 你可以在这里根据 nodeData.type 或 category 选择不同的 SVG
          const svgIcon = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 5px;">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            </svg>
          `;

          // 设置内容，可以包含节点类型或名称
          const nodeLabel = nodeData.displayName || nodeData.type || "节点";
          dragIcon.innerHTML = `${svgIcon} 正在拖放: ${nodeLabel}`;

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
      event.preventDefault();

      // 即使没有从dataTransfer获取到数据，也检查全局状态中是否有拖拽的节点
      if (draggedNodeData.value || state.draggedNodeData.value) {
        isDragOver.value = true;

        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "move";
        }
      }
    } catch (error) {
      console.warn("拖拽悬停处理失败:", error);
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
    // 标记为异步函数
    event.preventDefault();
    let nodeData: DraggedNodeData | null = null; // 使用定义的接口

    try {
      // 首先尝试从dataTransfer获取数据
      if (event.dataTransfer) {
        // 尝试从多种数据类型获取拖拽数据
        let nodeDataStr: string | null = null;

        // 定义我们要尝试的所有数据类型
        const dataTypes = ["application/vueflow", "text/plain", "application/json"];

        // 尝试所有数据类型
        for (const type of dataTypes) {
          try {
            const data = event.dataTransfer.getData(type);
            if (data) {
              nodeDataStr = data;
              console.debug(`成功从${type}获取数据`);
              break;
            }
          } catch (e) {
            console.warn(`获取${type}数据失败:`, e);
          }
        }

        // 如果从dataTransfer获取到了数据，解析它
        if (nodeDataStr) {
          try {
            nodeData = JSON.parse(nodeDataStr);
            console.debug("成功解析拖拽数据:", nodeData);
          } catch (e) {
            console.warn("解析JSON失败，将尝试使用全局状态", e);
          }
        } else {
          console.warn("未能从dataTransfer获取数据，将尝试使用全局状态");
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

      // Roo: Initialize GroupInput/Output node data with current workflow interface
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
