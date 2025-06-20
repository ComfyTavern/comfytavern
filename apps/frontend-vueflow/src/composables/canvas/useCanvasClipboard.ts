import { type Node, type Edge, useVueFlow } from "@vue-flow/core";
import { useTabStore } from "@/stores/tabStore";
import { v4 as uuidv4 } from "uuid";
import { deepClone } from "@/utils/deepClone";
import { useClipboard } from '../useClipboard';
import { serializeWorkflowFragment, deserializeWorkflowFragment } from '@/utils/workflowTransformer';
import { useDialogService } from '@/services/DialogService';
import type { HistoryEntry } from "@comfytavern/types";
import { nextTick } from "vue";
import { useWorkflowInteractionCoordinator } from "../workflow/useWorkflowInteractionCoordinator";


/**
 * 用于处理画布元素复制和粘贴逻辑的 Composable。
 */
export function useCanvasClipboard() {
  const {
    getNodes,
    getEdges,
    project,
    addSelectedNodes,
    addSelectedEdges,
  } = useVueFlow();

  const tabStore = useTabStore();
  const coordinator = useWorkflowInteractionCoordinator(); // 获取协调器实例
  const { writeText, readText, error: clipboardError, isSupported: clipboardIsSupported } = useClipboard();
  const dialogService = useDialogService();

  // 本地剪贴板，用于存储复制的节点和边 (Ctrl+C / Ctrl+V)
  let clipboardData: { nodes: Node[]; edges: Edge[] } | null = null;

  // --- 本地复制处理函数 ---
  const handleLocalCopy = () => {
    const selectedNodes = getNodes.value.filter((n) => n.selected);

    if (selectedNodes.length === 0) {
      clipboardData = null; // 清空剪贴板
      console.log("No nodes selected for local copying.");
      return;
    }

    const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));
    const internalEdges = getEdges.value.filter(
      (edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
    );

    clipboardData = {
      nodes: deepClone(selectedNodes),
      edges: deepClone(internalEdges),
    };

    console.log(
      `Copied ${clipboardData.nodes.length} nodes and ${clipboardData.edges.length} internal edges to local clipboard.`
    );
    // dialogService.showSuccess(`已复制 ${clipboardData.nodes.length} 个节点和 ${clipboardData.edges.length} 条边到本地剪贴板`); // 可选：如果需要通知
  };

  // --- 辅助函数：将节点和边粘贴到画布上 ---
  const pasteElementsToCanvas = async (nodesToPaste: Node[], edgesToPaste: Edge[], pasteType: 'local' | 'system' = 'local') => {
    const activeTabId = tabStore.activeTabId;
    if (!activeTabId) {
      console.warn("Cannot paste: No active tab ID found.");
      return { pastedNodesCount: 0, pastedEdgesCount: 0 };
    }

    // 1. 清除当前选择
    getNodes.value.forEach((node) => { if (node.selected) node.selected = false; });
    getEdges.value.forEach((edge) => { if (edge.selected) edge.selected = false; });

    // 2. 计算粘贴位置 (视口中心)
    const viewPortCenter = project({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const firstPastedNode = nodesToPaste[0];
    if (!firstPastedNode) {
      console.error("Cannot paste: No node found in data to paste.");
      return { pastedNodesCount: 0, pastedEdgesCount: 0 };
    }
    const nodeWidth = (firstPastedNode as any).dimensions?.width ?? firstPastedNode.width ?? 100;
    const nodeHeight = (firstPastedNode as any).dimensions?.height ?? firstPastedNode.height ?? 50;

    const pastedCenterX = firstPastedNode.position.x + nodeWidth / 2;
    const pastedCenterY = firstPastedNode.position.y + nodeHeight / 2;
    const offsetX = viewPortCenter.x - pastedCenterX;
    const offsetY = viewPortCenter.y - pastedCenterY;

    // 3. 生成新节点和边，并应用偏移和新 ID
    const idMapping: Record<string, string> = {};
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    nodesToPaste.forEach((node) => {
      const oldId = node.id;
      const newId = uuidv4();
      idMapping[oldId] = newId;
      newNodes.push({
        ...deepClone(node),
        id: newId,
        position: { x: node.position.x + offsetX, y: node.position.y + offsetY },
        // selected 属性不在这里设置
      });
    });

    edgesToPaste.forEach((edge) => {
      const sourceId = idMapping[edge.source];
      const targetId = idMapping[edge.target];
      if (sourceId && targetId) {
        newEdges.push({
          ...deepClone(edge),
          id: uuidv4(),
          source: sourceId,
          target: targetId,
          // selected 属性不在这里设置
        });
      }
    });

    // 4. 创建历史记录条目
    const historyEntry: HistoryEntry = {
      actionType: pasteType === 'system' ? 'systemPaste' : 'paste',
      objectType: 'elements',
      summary: `通过${pasteType === 'system' ? '系统' : '本地'}剪贴板粘贴了 ${newNodes.length} 个节点和 ${newEdges.length} 条边`,
      details: {
        pasteSource: pasteType,
        addedNodes: newNodes.map(n => deepClone(n)), // 存储完整节点信息以供撤销
        addedEdges: newEdges.map(e => deepClone(e)),
      },
      timestamp: Date.now()
    };

    // 5. 使用协调器添加元素并记录历史
    await coordinator.addElementsAndRecord(activeTabId, newNodes, newEdges, historyEntry);

    // 6. 选中新添加的元素
    await nextTick();
    const newNodeIds = new Set(newNodes.map((n) => n.id));
    const newEdgeIds = new Set(newEdges.map((e) => e.id));
    const nodesToSelect = getNodes.value.filter((n) => newNodeIds.has(n.id));
    const edgesToSelect = getEdges.value.filter((e) => newEdgeIds.has(e.id));
    if (nodesToSelect.length > 0) addSelectedNodes(nodesToSelect);
    if (edgesToSelect.length > 0) addSelectedEdges(edgesToSelect);


    return { pastedNodesCount: newNodes.length, pastedEdgesCount: newEdges.length };
  };

  // --- 本地粘贴处理函数 ---
  const handleLocalPaste = async () => {
    if (!clipboardData || clipboardData.nodes.length === 0) {
      console.log("Local clipboard is empty.");
      dialogService.showInfo("本地剪贴板为空");
      return;
    }

    const { pastedNodesCount, pastedEdgesCount } = await pasteElementsToCanvas(
      clipboardData.nodes,
      clipboardData.edges,
      'local'
    );

    if (pastedNodesCount > 0 || pastedEdgesCount > 0) {
      console.log(`Pasted ${pastedNodesCount} nodes and ${pastedEdgesCount} edges from local clipboard.`);
      dialogService.showSuccess(`从本地剪贴板粘贴了 ${pastedNodesCount} 个节点和 ${pastedEdgesCount} 条边`);
    }
    // 可选：清空本地剪贴板
    // clipboardData = null;
  };


  // --- 系统剪贴板复制处理函数 ---
  const handleSystemCopy = async () => {
    const selectedNodes = getNodes.value.filter((n) => n.selected);
    if (selectedNodes.length === 0) {
      console.log("No nodes selected for system copying.");
      dialogService.showInfo("没有选中的节点可供复制到系统剪贴板");
      return;
    }

    if (!clipboardIsSupported) {
      console.error("System clipboard API is not supported by this browser.");
      dialogService.showError("系统剪贴板功能不受支持或未授权");
      return;
    }
    const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));
    const internalEdges = getEdges.value.filter(
      (edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
    );

    const jsonString = serializeWorkflowFragment(selectedNodes, internalEdges);

    if (jsonString) {
      try {
        await writeText(jsonString);
        console.log(
          `Copied ${selectedNodes.length} nodes and ${internalEdges.length} internal edges to system clipboard.`
        );
        dialogService.showSuccess(`已复制 ${selectedNodes.length} 个节点和 ${internalEdges.length} 条边到系统剪贴板`);
      } catch (e) {
        console.error("Failed to write to system clipboard:", clipboardError.value || e);
        dialogService.showError("写入系统剪贴板失败");
      }
    } else {
      console.error("Failed to serialize workflow fragment for system copying.");
      dialogService.showError("序列化工作流片段失败");
    }
  };

  // --- 系统剪贴板粘贴处理函数 ---
  const handleSystemPaste = async () => {
    if (!clipboardIsSupported) {
      console.error("System clipboard API is not supported by this browser.");
      dialogService.showError("系统剪贴板功能不受支持或未授权");
      return;
    }

    const jsonString = await readText();
    if (!jsonString) {
      if (clipboardError.value) {
        console.error("Failed to read from system clipboard:", clipboardError.value);
        dialogService.showError(`读取系统剪贴板失败: ${clipboardError.value.message}`);
      } else {
        console.log("System clipboard is empty or contains non-text data.");
        dialogService.showInfo("系统剪贴板为空或内容非文本");
      }
      return;
    }

    const deserializedData = deserializeWorkflowFragment(jsonString);

    if (!deserializedData || deserializedData.nodes.length === 0) {
      console.warn("Could not deserialize valid workflow fragment from system clipboard, or fragment is empty.");
      dialogService.showWarning("系统剪贴板内容不是有效的工作流片段");
      return;
    }

    const { pastedNodesCount, pastedEdgesCount } = await pasteElementsToCanvas(
      deserializedData.nodes,
      deserializedData.edges,
      'system'
    );

    if (pastedNodesCount > 0 || pastedEdgesCount > 0) {
      console.log(`Pasted ${pastedNodesCount} nodes and ${pastedEdgesCount} edges from system clipboard.`);
      dialogService.showSuccess(`从系统剪贴板粘贴了 ${pastedNodesCount} 个节点和 ${pastedEdgesCount} 条边`);
    } else {
      console.log("No elements were pasted from system clipboard (possibly due to empty deserialized data or other issues).");
      // dialogService.showInfo("未能从系统剪贴板粘贴任何元素"); // 这种情况可能由 pasteElementsToCanvas 内部的 console.error 覆盖
    }
  };

  return {
    handleLocalCopy,
    handleLocalPaste,
    handleSystemCopy,
    handleSystemPaste,
  };
}