import { onMounted, onUnmounted } from "vue";
import { useVueFlow, type NodeMouseEvent } from "@vue-flow/core"; // 保留 useVueFlow，添加类型
import { useWorkflowStore } from "@/stores/workflowStore"; // <-- 导入 WorkflowStore
import { useTabStore } from "@/stores/tabStore"; // <-- 导入 TabStore
import { useWorkflowGrouping } from "../group/useWorkflowGrouping"; // <-- 导入分组 composable
import { createHistoryEntry } from "@comfytavern/utils"; // <-- 导入 createHistoryEntry
import { type DataFlowTypeName, type HistoryEntry, type OutputDefinition as OriginalOutputDefinition, DataFlowType, type GroupSlotInfo } from "@comfytavern/types"; // <-- 从 types 导入 HistoryEntry, OutputDefinition, DataFlowType 和 GroupSlotInfo
import { useWorkflowManager } from "../workflow/useWorkflowManager";
import { useWorkflowInteractionCoordinator } from "../workflow/useWorkflowInteractionCoordinator";
import { useNodeStore } from "@/stores/nodeStore";
import { useCanvasClipboard } from "./useCanvasClipboard"; // <-- 新增导入

/**
 * 用于处理 VueFlow 画布上键盘快捷键的 Composable。
 */
export function useCanvasKeyboardShortcuts() {
  const {
    getNodes,
    getEdges,
    addSelectedNodes,
    addSelectedEdges,
    onNodeClick, // 添加 onNodeClick
  } = useVueFlow();
  const tabStore = useTabStore(); // <-- 获取 TabStore 实例
  const workflowStore = useWorkflowStore(); // <-- 获取 WorkflowStore 实例
  const { groupSelectedNodes: performGrouping } = useWorkflowGrouping(); // <-- 获取分组函数
  const workflowManager = useWorkflowManager();
  const interactionCoordinator = useWorkflowInteractionCoordinator();
  const nodeStore = useNodeStore();
  const { handleLocalCopy, handleLocalPaste, handleSystemCopy, handleSystemPaste } = useCanvasClipboard(); // <-- 使用新的 composable


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
      handleLocalCopy(); // <-- 修改调用
    }

    // --- Ctrl/Cmd + V: 粘贴元素 ---
    else if ((event.ctrlKey || event.metaKey) && event.key === "v") {
      if (isInputFocused) return; // 允许在输入框中粘贴文本
      event.preventDefault();
      console.log("Ctrl+V pressed - pasting elements...");
      handleLocalPaste(); // <-- 修改调用
    }

    // --- Ctrl/Cmd + Shift + C: 系统复制 ---
    else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'c') {
      if (isInputFocused) return; // 允许在输入框中复制文本，但不处理画布复制
      event.preventDefault();
      console.log("Ctrl+Shift+C pressed - copying selected elements to system clipboard...");
      handleSystemCopy(); // <-- 修改调用
    }

    // --- Ctrl/Cmd + Shift + V: 系统粘贴 ---
    else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'v') {
      if (isInputFocused) return; // 允许在输入框中粘贴文本，但不处理画布粘贴
      event.preventDefault();
      console.log("Ctrl+Shift+V pressed - pasting elements from system clipboard...");
      handleSystemPaste(); // <-- 修改调用
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

    if (selectedNodes.length < 1) { // 修改：允许单个节点创建组
      console.log("Need to select at least one node to create a group."); // 修改：更新提示信息
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
  const deleteSelectedElements = async () => { // 标记为 async
    const selectedNodes = getNodes.value.filter((n) => n.selected);
    const selectedEdges = getEdges.value.filter((e) => e.selected);

    if (selectedNodes.length === 0 && selectedEdges.length === 0) {
      console.log("No elements selected for deletion.");
      return;
    }

    const elementsToRemove = [...selectedNodes, ...selectedEdges];
    const activeTabId = tabStore.activeTabId;

    if (!activeTabId) {
      console.warn("Cannot delete elements: No active tab ID found.");
      return;
    }

    // 创建历史记录条目
    let summary = "";
    if (selectedNodes.length > 0 && selectedEdges.length > 0) {
      summary = `删除 ${selectedNodes.length} 个节点和 ${selectedEdges.length} 条边`;
    } else if (selectedNodes.length > 0) {
      summary = `删除 ${selectedNodes.length} 个节点`;
    } else if (selectedEdges.length > 0) {
      summary = `删除 ${selectedEdges.length} 条边`;
    } else {
      summary = "删除元素"; // Fallback, should not happen if checks above are correct
    }

    const entry = createHistoryEntry(
      'delete',
      'elements', // or 'groupDelete' if it's a common pattern for multiple elements
      summary,
      {
        deletedNodes: selectedNodes.map(n => ({
          nodeId: n.id,
          nodeName: n.data?.label || n.data?.defaultLabel || n.id,
          nodeType: n.type, // type is already namespace:type
        })),
        deletedEdges: selectedEdges.map(e => ({
          edgeId: e.id,
          sourceNodeId: e.source,
          sourceHandle: e.sourceHandle,
          targetNodeId: e.target,
          targetHandle: e.targetHandle,
        })),
      }
    );

    // 调用协调器函数
    await workflowStore.removeElementsAndRecord(activeTabId, elementsToRemove, entry);

    console.log(`Dispatched deletion of ${selectedNodes.length} nodes and ${selectedEdges.length} edges.`);
    // markAsDirty 和其他副作用应该由 removeElementsAndRecord 内部处理
    // markAsDirty 和其他副作用应该由 removeElementsAndRecord 内部处理
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

  // 处理 Alt + 点击节点或插槽的逻辑
  const handleNodeAltClick = async ({ event, node }: NodeMouseEvent) => {
    if (!event.altKey) return;

    event.preventDefault();
    event.stopPropagation();

    const internalId = tabStore.activeTabId;
    if (!internalId) {
      console.warn("无法处理 Alt+点击：没有活动的标签页。");
      return;
    }

    const currentPreviewTarget = workflowManager.activePreviewTarget.value;
    let newTarget: { nodeId: string; slotKey: string } | null = null;
    let historySummary = "";

    // 假设 BaseNode.vue 中的 handleOutputAltClick 已经处理了精确的 Handle 点击并停止了事件传播。
    // 因此，如果事件到达这里且 event.altKey 为真，我们执行节点级别的循环预览逻辑。
    // console.log(`[CanvasKeyboardShortcuts] handleNodeAltClick for node ${node.id}. BaseNode should have handled precise alt-clicks on handles.`);

    const nodeDef = nodeStore.getNodeDefinitionByFullType(node.type as string);

    // 检查节点类型是否为 GroupOutput，如果是，则不进行循环预览，因为 GroupOutput 通常没有可直接点击预览的“输出”Handle
    // 它们的“输出”是通过连接到其输入Handle (target handle) 来定义的。
    if (node.type === 'core:GroupOutput') {
      console.log(`[CanvasKeyboardShortcuts] Alt+Click on GroupOutput node ${node.id}. No cycle preview for GroupOutput.`);
      return;
    }

    // 确保 nodeDef 和 outputs 存在 (对于 GroupInput，其 "outputs" 来自 interfaceInputs)
    let rawOutputSlots: Record<string, OriginalOutputDefinition | GroupSlotInfo> | undefined;
    if (node.type === 'core:GroupInput') {
      const workflowData = workflowManager.getWorkflowData(internalId);
      rawOutputSlots = workflowData?.interfaceInputs;
    } else {
      rawOutputSlots = nodeDef?.outputs;
    }

    if (!nodeDef || !rawOutputSlots || Object.keys(rawOutputSlots).length === 0) {
      console.log(`[CanvasKeyboardShortcuts] 节点 ${node.label || node.id} (${node.type}) 没有有效的输出插槽定义，无法循环设置预览。`);
      return;
    }

    interface ProcessedOutputDefinition extends OriginalOutputDefinition {
      key: string;
      dataFlowType: DataFlowTypeName; // 确保 dataFlowType 存在且为正确类型
    }

    const outputSlots: ProcessedOutputDefinition[] = Object.entries(
      rawOutputSlots
    )
      .map(([key, def]) => ({
        ...def,
        key,
        // 确保 dataFlowType 存在，对于 GroupSlotInfo 它直接存在，对于 OriginalOutputDefinition 它也应该存在
        // 假设 def.dataFlowType 总是根据类型定义存在
        dataFlowType: def.dataFlowType
      } as ProcessedOutputDefinition))
      .filter(slot => slot.dataFlowType && slot.dataFlowType !== DataFlowType.WILDCARD && slot.dataFlowType !== DataFlowType.CONVERTIBLE_ANY); // 确保 slot.dataFlowType 存在再比较


    if (outputSlots.length === 0) {
      console.log(`[CanvasKeyboardShortcuts] 节点 ${node.label || node.id} (${node.type}) 处理后没有可供循环预览的输出插槽。`);
      return;
    }

    if (currentPreviewTarget && currentPreviewTarget.nodeId === node.id) {
      const currentIndex = outputSlots.findIndex(
        (slot) => slot.key === currentPreviewTarget.slotKey
      );
      if (currentIndex === -1) {
        newTarget = { nodeId: node.id, slotKey: outputSlots[0]!.key };
        historySummary = `设置节点 ${node.label || node.id} 插槽 ${outputSlots[0]!.displayName || outputSlots[0]!.key} 为预览目标 (前目标无效或不可预览)`;
      } else if (currentIndex < outputSlots.length - 1) {
        newTarget = { nodeId: node.id, slotKey: outputSlots[currentIndex + 1]!.key };
        historySummary = `切换预览到节点 ${node.label || node.id} 插槽 ${outputSlots[currentIndex + 1]!.displayName || outputSlots[currentIndex + 1]!.key}`;
      } else {
        newTarget = null;
        historySummary = `清除了节点 ${node.label || node.id} 的预览 (已到末尾)`;
      }
    } else {
      newTarget = { nodeId: node.id, slotKey: outputSlots[0]!.key };
      historySummary = `设置节点 ${node.label || node.id} 插槽 ${outputSlots[0]!.displayName || outputSlots[0]!.key} 为预览目标`;
    }

    const entry: HistoryEntry = createHistoryEntry(
      newTarget ? 'set' : 'clear',
      'previewTarget',
      historySummary,
      {
        previousTarget: currentPreviewTarget ? { ...currentPreviewTarget } : null,
        newTarget: newTarget ? { ...newTarget } : null,
        nodeId: node.id,
        ...(newTarget && { slotKey: newTarget.slotKey }),
      }
    );
    await interactionCoordinator.setPreviewTargetAndRecord(internalId, newTarget, entry);
    console.log(`Alt+Click (Node Cycle on ${node.label || node.id}): ${historySummary}`);
  };


  // 在组件挂载时添加监听器
  onMounted(() => {
    // 将监听器添加到 document 上，确保全局捕获
    document.addEventListener("keydown", handleKeyDown);
    // 监听节点点击事件以处理 Alt+Click
    onNodeClick(handleNodeAltClick);
  });

  // 在组件卸载时移除监听器
  onUnmounted(() => {
    document.removeEventListener("keydown", handleKeyDown);
    // 注意：VueFlow 的 onNodeClick 返回的函数用于取消监听，但这里我们没有存储它。
    // 如果需要精确移除，应该存储 onNodeClick 的返回值并在 unmounted 时调用。
    // 但通常 VueFlow 实例销毁时会自动清理。
  });

  // 返回需要在组件中使用的方法
  return {
    deleteSelectedElements,
    selectAllElements,
    handleRedo, // 暴露重做函数
    // handleLocalCopy, // 由快捷键内部调用，不直接暴露
    // handleLocalPaste, // 由快捷键内部调用，不直接暴露
    // handleSystemCopy, // 由快捷键内部调用，不直接暴露
    // handleSystemPaste, // 由快捷键内部调用，不直接暴露
    groupSelectedNodes, // 暴露分组函数
    handleUndo, // 暴露撤销函数
  };
}
