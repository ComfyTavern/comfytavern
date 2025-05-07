import { onMounted, onUnmounted } from "vue";
import { useVueFlow, type Node, type Edge } from "@vue-flow/core"; // 保留 useVueFlow，添加类型
import { useWorkflowStore } from "@/stores/workflowStore"; // <-- 导入 WorkflowStore
import { useTabStore } from "@/stores/tabStore"; // <-- 导入 TabStore
import { v4 as uuidv4 } from "uuid"; // 导入 uuid
import { deepClone } from "@/utils/deepClone"; // 用于深拷贝的辅助函数
import { useWorkflowGrouping } from "../group/useWorkflowGrouping"; // <-- 导入分组 composable
// import { useWorkflowManager } from "./useWorkflowManager"; // <-- 移除工作流管理器导入
/**
 * 用于处理 VueFlow 画布上键盘快捷键的 Composable。
 */
export function useCanvasKeyboardShortcuts() {
  // 仅从 useVueFlow 解构使用的方法和属性
  // 仅从 useVueFlow 解构使用的方法
  // 仅导入使用的函数和响应式引用
  const {
    getNodes,
    getEdges,
    removeNodes,
    removeEdges,
    addSelectedNodes,
    addSelectedEdges,
    addNodes: vueFlowAddNodes,
    addEdges: vueFlowAddEdges,
    project,
  } = useVueFlow(); // 移除了 getViewport，因为它没有被直接使用
  const tabStore = useTabStore(); // <-- 获取 TabStore 实例
  const workflowStore = useWorkflowStore(); // <-- 获取 WorkflowStore 实例
  const { groupSelectedNodes: performGrouping } = useWorkflowGrouping(); // <-- 获取分组函数
  // const workflowManager = useWorkflowManager(); // <-- 移除工作流管理器实例

  // 本地剪贴板，用于存储复制的节点和边
  let clipboardData: { nodes: Node[]; edges: Edge[] } | null = null;

  // 处理键盘按下事件
  const handleKeyDown = (event: KeyboardEvent) => {
    const activeElement = document.activeElement;
    const isInputFocused =
      activeElement?.tagName === "INPUT" ||
      activeElement?.tagName === "TEXTAREA" ||
      activeElement?.getAttribute("contenteditable") === "true";

    // --- Ctrl/Cmd + G: 创建节点组 ---
    if ((event.ctrlKey || event.metaKey) && event.key === "g") {
      if (isInputFocused) return; // 如果焦点在输入框，则不处理
      event.preventDefault();
      console.log("Ctrl+G pressed - initiating grouping...");
      groupSelectedNodes();
    }

    // --- Ctrl/Cmd + A: 全选 ---
    else if ((event.ctrlKey || event.metaKey) && event.key === "a") {
      if (isInputFocused) return; // 如果焦点在输入框，则不处理 (允许文本全选)
      event.preventDefault();
      selectAllElements(); // 调用我们的实现
      console.log("Ctrl+A pressed - selecting all elements");
    }

    // --- Delete / Backspace: 删除选中元素 ---
    else if (event.key === "Delete" || event.key === "Backspace") {
      if (isInputFocused) return; // 如果焦点在输入框，则不处理
      event.preventDefault();
      console.log("Delete/Backspace pressed - deleting selected elements...");
      deleteSelectedElements();
    }

    // --- Ctrl/Cmd + C: 复制选中元素 ---
    else if ((event.ctrlKey || event.metaKey) && event.key === "c") {
      if (isInputFocused) return; // 允许在输入框中复制文本
      event.preventDefault();
      console.log("Ctrl+C pressed - copying selected elements...");
      handleCopy();
    }

    // --- Ctrl/Cmd + V: 粘贴元素 ---
    else if ((event.ctrlKey || event.metaKey) && event.key === "v") {
      if (isInputFocused) return; // 允许在输入框中粘贴文本
      event.preventDefault();
      console.log("Ctrl+V pressed - pasting elements...");
      handlePaste();
    }

    // --- Ctrl/Cmd + Shift + Z: 重做 ---
    // 检查 'z' 或 'Z' 以处理 Shift 键可能改变大小写的情况
    else if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'z' || event.key === 'Z')) {
      if (isInputFocused) return; // 如果焦点在输入框，则不处理
      event.preventDefault();
      console.log("Ctrl+Shift+Z pressed - redoing last undone action...");
      handleRedo();
    }
    // --- Ctrl/Cmd + Z: 撤销 ---
    // 检查 'z' 或 'Z' 以保持一致性，尽管此处不应按下 Shift 键
    else if ((event.ctrlKey || event.metaKey) && (event.key === 'z' || event.key === 'Z')) {
      if (isInputFocused) return; // 如果焦点在输入框，则不处理
      event.preventDefault();
      console.log("Ctrl+Z pressed - undoing last action...");
      handleUndo();
    }
  };

  // 创建节点组的处理函数
  const groupSelectedNodes = () => {
    const selectedNodes = getNodes.value.filter((node) => node.selected);

    if (selectedNodes.length <= 1) {
      console.log("Need to select more than one node to create a group.");
      // TODO: 可以添加用户提示，例如使用 Toast 通知
      return;
    }

    console.debug( // 改为 debug，因为这是详细信息
      "Selected Nodes for Grouping:",
      selectedNodes.map((n) => n.id)
    );

    const activeTabId = tabStore.activeTabId;
    if (!activeTabId) {
      console.error("Cannot group nodes: No active tab found.");
      // TODO: 添加用户反馈（例如 Toast 通知）
      return;
    }

    try {
      // 从 composable 调用分组函数
      performGrouping(
        selectedNodes.map((n) => n.id),
        activeTabId
      );
      console.log("Grouping action dispatched.");
    } catch (error) {
      console.error("Error during grouping:", error);
      // TODO: 添加用户反馈（例如 Toast 通知）
    }
  };

  // 删除选中元素的处理函数
  const deleteSelectedElements = () => {
    const selectedNodes = getNodes.value.filter((n) => n.selected);
    const selectedEdges = getEdges.value.filter((e) => e.selected);

    if (selectedNodes.length === 0 && selectedEdges.length === 0) {
      console.log("No elements selected for deletion.");
      return;
    }

    const nodeIdsToRemove = selectedNodes.map((n) => n.id);
    const edgeIdsToRemove = selectedEdges.map((e) => e.id);

    // 优先删除边，再删除节点
    if (edgeIdsToRemove.length > 0) {
      removeEdges(edgeIdsToRemove);
    }
    if (nodeIdsToRemove.length > 0) {
      // removeNodes 会自动处理连接到这些节点的边，但先删除选中的边更清晰
      removeNodes(nodeIdsToRemove);
    }

    console.log(`Deleted ${nodeIdsToRemove.length} nodes and ${edgeIdsToRemove.length} edges.`);
    const activeTabId = tabStore.activeTabId;
    if (activeTabId) {
      workflowStore.markAsDirty(activeTabId); // 标记为已修改，传递 ID
    } else {
      console.warn("Cannot mark workflow as dirty: No active tab ID found.");
    }
  };

  // 复制选中元素的处理函数
  const handleCopy = () => {
    const selectedNodes = getNodes.value.filter((n) => n.selected);
    // 下面未使用 selectedEdges，剪贴板只需要 internalEdges

    if (selectedNodes.length === 0) {
      clipboardData = null; // 清空剪贴板
      console.log("No nodes selected for copying.");
      return;
    }

    // 获取选中节点内部的边 + 连接选中节点的边
    const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));
    const internalEdges = getEdges.value.filter(
      (edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
    );

    // 深拷贝选中的节点和相关边
    clipboardData = {
      nodes: deepClone(selectedNodes),
      edges: deepClone(internalEdges), // 只复制内部边
    };

    console.log(
      `Copied ${clipboardData.nodes.length} nodes and ${clipboardData.edges.length} internal edges to clipboard.`
    );
  };

  // 粘贴元素的处理函数
  const handlePaste = () => {
    if (!clipboardData || clipboardData.nodes.length === 0) {
      console.log("Clipboard is empty.");
      return;
    }

    const activeTabId = tabStore.activeTabId;
    if (!activeTabId) {
      console.warn("Cannot paste: No active tab ID found.");
      return;
    }

    // 1. 清除当前选择（手动设置 selected = false）
    getNodes.value.forEach((node) => {
      if (node.selected) {
        node.selected = false;
      }
    });
    getEdges.value.forEach((edge) => {
      if (edge.selected) {
        edge.selected = false;
      }
    });

    // 2. 计算粘贴位置 (视口中心)
    // getViewport 是一个函数，不是 ref。调用它以获取当前视口。
    // const currentViewport = getViewport(); // 我们实际上不需要这里的视口对象本身
    const viewPortCenter = project({
      // project 内部使用当前视口
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    // 3. 计算复制节点的中心点 (以第一个节点为参考)
    const firstCopiedNode = clipboardData.nodes[0];

    // 在访问属性之前检查 firstCopiedNode 是否存在
    if (!firstCopiedNode) {
      console.error("Cannot paste: No node found in clipboard data.");
      return;
    }

    // 使用可选链和空值合并运算符以确保安全。
    // 节点尺寸可能在基本类型定义中不可用，
    // 但通常在渲染后的运行时存在。使用类型断言作为解决方法。
    const nodeWidth = (firstCopiedNode as any).dimensions?.width ?? 100;
    const nodeHeight = (firstCopiedNode as any).dimensions?.height ?? 50;
    const copiedCenterX = firstCopiedNode.position.x + nodeWidth / 2;
    const copiedCenterY = firstCopiedNode.position.y + nodeHeight / 2;

    // 4. 计算偏移量
    const offsetX = viewPortCenter.x - copiedCenterX;
    const offsetY = viewPortCenter.y - copiedCenterY;

    // 5. 生成新节点和边，并应用偏移和新 ID
    const idMapping: Record<string, string> = {}; // 旧 ID -> 新 ID
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    clipboardData.nodes.forEach((node) => {
      const oldId = node.id;
      const newId = uuidv4();
      idMapping[oldId] = newId;

      newNodes.push({
        ...deepClone(node), // 深拷贝确保数据隔离
        id: newId,
        position: {
          x: node.position.x + offsetX,
          y: node.position.y + offsetY,
        },
        // 不要在此处设置 selected，稍后使用 addSelectedNodes
        // dragging 是内部状态，不要在此处设置
        // 可以考虑重置其他状态，如 zIndex
      });
    });

    clipboardData.edges.forEach((edge) => {
      const sourceId = idMapping[edge.source];
      const targetId = idMapping[edge.target];

      // 仅添加两个端点都在新粘贴节点中的边
      if (sourceId && targetId) {
        newEdges.push({
          ...deepClone(edge),
          id: uuidv4(),
          source: sourceId,
          target: targetId,
          // 不要在此处设置 selected，稍后使用 addSelectedEdges
        });
      }
    });

    // 6. 添加到画布
    if (newNodes.length > 0) {
      vueFlowAddNodes(newNodes);
    }
    if (newEdges.length > 0) {
      vueFlowAddEdges(newEdges);
    }

    // 6.1. 选中新添加的元素
    // 添加后，我们需要找到相应的 GraphNode/GraphEdge 实例
    const newNodeIds = new Set(newNodes.map((n) => n.id));
    const newEdgeIds = new Set(newEdges.map((e) => e.id));

    // 查找 VueFlow 添加的实际 GraphNode/GraphEdge 实例
    const nodesToSelect = getNodes.value.filter((n) => newNodeIds.has(n.id));
    const edgesToSelect = getEdges.value.filter((e) => newEdgeIds.has(e.id));

    if (nodesToSelect.length > 0) {
      addSelectedNodes(nodesToSelect);
    }
    if (edgesToSelect.length > 0) {
      addSelectedEdges(edgesToSelect);
    }

    // 7. 标记为已修改
    workflowStore.markAsDirty(activeTabId);

    // 8. 记录历史
    workflowStore.recordHistorySnapshot({
      actionType: 'paste',
      objectType: 'elements',
      summary: `粘贴了 ${newNodes.length} 个节点和 ${newEdges.length} 条边`,
      details: { nodeCount: newNodes.length, edgeCount: newEdges.length, newNodeIds: newNodes.map(n => n.id), newEdgeIds: newEdges.map(e => e.id) },
      timestamp: Date.now()
    });

    console.log(`Pasted ${newNodes.length} nodes and ${newEdges.length} edges.`);

    // 可选：清空剪贴板，防止重复粘贴相同内容（如果需要）
    // clipboardData = null;
  };

  // 全选元素的实现
  const selectAllElements = () => {
    addSelectedNodes(getNodes.value); // 使用 addSelectedNodes
    addSelectedEdges(getEdges.value); // 使用 addSelectedEdges
  };

  // 撤销处理函数
  const handleUndo = () => {
    const activeTabId = tabStore.activeTabId;
    if (!activeTabId) {
      console.warn("Cannot undo: No active tab ID found.");
      return;
    }

    // 从中央工作流存储调用活动选项卡的撤销操作（1 步）
    workflowStore.undo(1, activeTabId); // 传递 steps=1 和 activeTabId
    // 日志记录和状态应用在存储的撤销操作中处理
    // 此处无需检查返回值或标记为脏
  };

  // 重做处理函数
  const handleRedo = () => {
    const activeTabId = tabStore.activeTabId;
    if (!activeTabId) {
      console.warn("Cannot redo: No active tab ID found.");
      return;
    }

    // 从中央工作流存储调用活动选项卡的重做操作（1 步）
    workflowStore.redo(1, activeTabId); // 传递 steps=1 和 activeTabId
    // 日志记录和状态应用在存储的重做操作中处理
    // 此处无需检查返回值或标记为脏
  };

  // 在组件挂载时添加监听器
  onMounted(() => {
    // 将监听器添加到 document 上，确保全局捕获
    document.addEventListener("keydown", handleKeyDown);
  });

  // 在组件卸载时移除监听器
  onUnmounted(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });

  // 返回需要在组件中使用的方法
  return {
    deleteSelectedElements,
    selectAllElements,
    handleRedo, // 暴露重做函数
    handleCopy, // 暴露复制粘贴函数，虽然它们主要由快捷键触发
    handlePaste,
    groupSelectedNodes, // 暴露分组函数
    handleUndo, // 暴露撤销函数
  };
}
