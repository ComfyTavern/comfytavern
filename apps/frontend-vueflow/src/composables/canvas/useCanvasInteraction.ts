import { computed, nextTick, type Ref } from 'vue';
import { useVueFlow, type Node, type Edge, type Connection, isNode } from '@vue-flow/core';
import type { NodeDragEventData } from "@/types/workflowTypes";
import { useNodeStore } from '@/stores/nodeStore';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useTabStore } from '@/stores/tabStore';
// import { useUniqueNodeId } from '../node/useUniqueNodeId'; // 不再需要
// import { storeToRefs } from 'pinia'; // Removed unused import
import type Canvas from '@/components/graph/Canvas.vue';
// --- Added missing type imports ---
import type { HistoryEntry } from '@comfytavern/types';
import { nanoid } from 'nanoid'; // <-- 导入 nanoid
import type { XYPosition } from '@vue-flow/core'; // +++ 导入 XYPosition
// --- Added missing function import ---
import { createHistoryEntry, getEffectiveDefaultValue } from '@comfytavern/utils';

/**
 * 用于处理与 Vue Flow 画布元素直接交互的 Composable。
 * @param canvasRef - 指向 Canvas 组件实例的 Ref。
 * @param currentInstance - 持有活动标签页的当前 VueFlow 实例的 Ref。
 */
export function useCanvasInteraction(
  canvasRef: Ref<InstanceType<typeof Canvas> | null>
  // currentInstance: Ref<any | null> // 不再需要
) {
  const { screenToFlowCoordinate } = useVueFlow();
  const nodeStore = useNodeStore();
  const workflowStore = useWorkflowStore();
  const tabStore = useTabStore();
  // const { generateUniqueNodeId } = useUniqueNodeId(); // 不再需要
  // const { nodeDefinitions } = storeToRefs(nodeStore); // 不再需要，直接使用 store 方法

  const activeTabId = computed(() => tabStore.activeTabId);

  // 从面板添加节点 (nodeType is now fullType, e.g., "core:MergeNode")
  const handleAddNodeFromPanel = async (fullNodeType: string, position?: XYPosition) => { // +++ 添加可选的 position 参数
    // // console.log(`[useCanvasInteraction] handleAddNodeFromPanel called for type: ${fullNodeType}, position: ${JSON.stringify(position)}`);
    // Use the store function to get definition by full type
    const nodeDef = nodeStore.getNodeDefinitionByFullType(fullNodeType);

    if (!nodeDef) {
      console.error(`[useCanvasInteraction] 找不到类型为 ${fullNodeType} 的节点定义`);
      return;
    }

    // --- 正确初始化 nodeData ---
    const nodeData: Record<string, any> = {
      // 复制 NodeDefinition 中的非 inputs/outputs 属性
      ...Object.fromEntries(Object.entries(nodeDef).filter(([key]) => key !== 'inputs' && key !== 'outputs')),
      inputs: {},
      outputs: {},
      configValues: nodeDef.configSchema ? {} : undefined, // 初始化 configValues 如果有 schema
      defaultLabel: nodeDef.displayName || nodeDef.type, // 存储默认标签
      defaultDescription: nodeDef.description || "", // 存储默认描述
      description: nodeDef.description || "", // 初始显示描述
    };

    // 初始化 inputs
    if (nodeDef.inputs) {
      Object.entries(nodeDef.inputs).forEach(([inputName, inputDef]) => {
        const effectiveDefault = getEffectiveDefaultValue(inputDef); // Ensure getEffectiveDefaultValue is imported
        const defaultDesc = inputDef.description || "";
        nodeData.inputs[inputName] = {
          value: effectiveDefault, // 使用有效默认值
          description: defaultDesc, // 使用默认描述
          defaultDescription: defaultDesc, // 存储默认描述
          ...inputDef, // 包含原始定义属性
        };
      });
    } else if (!nodeDef.outputs) { // 如果没有输入和输出，添加默认的
        // Removed unnecessary spread operator
        nodeData.inputs = { input: { type: "any", displayName: "输入", value: null, description: "", defaultDescription: "" } };
    }


    // 初始化 outputs
    if (nodeDef.outputs) {
      Object.entries(nodeDef.outputs).forEach(([outputName, outputDef]) => {
        const defaultDesc = outputDef.description || "";
        nodeData.outputs[outputName] = {
          description: defaultDesc, // 使用默认描述
          defaultDescription: defaultDesc, // 存储默认描述
          ...outputDef, // 包含原始定义属性
        };
      });
    } else if (!nodeDef.inputs) { // 如果没有输入和输出，添加默认的
        // Removed unnecessary spread operator
        nodeData.outputs = { output: { type: "any", displayName: "输出", description: "", defaultDescription: "" } };
    }

    // 初始化 configValues 的默认值
    if (nodeDef.configSchema && nodeData.configValues) {
        Object.entries(nodeDef.configSchema).forEach(([configName, configDef]) => {
            nodeData.configValues[configName] = getEffectiveDefaultValue(configDef); // Ensure getEffectiveDefaultValue is imported
        });
    }
    // --- 初始化结束 ---


    let x = 256;
    let y = 160;
    let positionCalculated = false;

    // +++ 如果提供了 position 参数，则使用它，否则执行旧的计算逻辑
    if (position) {
      x = position.x;
      y = position.y;
      positionCalculated = true;
      // // console.debug(`[useCanvasInteraction] Position provided: (${x}, ${y})`);
    } else {
      try {
        const canvasComponentInstance = canvasRef.value;
        const canvasElement = canvasComponentInstance?.$el as HTMLElement | undefined;

        if (canvasElement && typeof canvasElement.getBoundingClientRect === 'function') {
          const canvasRect = canvasElement.getBoundingClientRect();
          if (canvasRect.width > 0 && canvasRect.height > 0) {
            const screenCenterX = canvasRect.left + canvasRect.width / 2;
            const screenCenterY = canvasRect.top + canvasRect.height / 2;
            const flowCenter = screenToFlowCoordinate({ x: screenCenterX, y: screenCenterY });
            const targetX = flowCenter.x - 100; // 默认偏移量
            const targetY = flowCenter.y - 100; // 默认偏移量
            x = Math.round(targetX / 8) * 8;
            y = Math.round(targetY / 8) * 8;
            positionCalculated = true;
            // // console.debug(`[useCanvasInteraction] Position calculated via ref/screenToFlow: Snapped(${x}, ${y})`);
          } else {
            // // console.debug("[useCanvasInteraction] canvasRect dimensions are zero, skipping ref method.");
          }
        } else {
          // // console.debug("[useCanvasInteraction] canvasElement or getBoundingClientRect not available via ref.");
        }
      } catch (e) {
        console.error("[useCanvasInteraction] Error calculating node position using ref/screenToFlowCoordinate:", e);
        positionCalculated = false;
      }

      if (!positionCalculated) {
        // // console.debug("[useCanvasInteraction] Position calculation failed, using hardcoded defaults.");
        // x, y 保留初始的 256, 160
      }
    }

    const newNode: Node = {
      id: nanoid(10), // <-- 使用 nanoid 生成 ID
      type: fullNodeType, // Use the full type received
      label: nodeDef.displayName || nodeDef.type, // Use base type for default label if no displayName
      position: { x, y }, // 使用最终计算或提供的 x, y
      data: nodeData, // nodeData is derived from nodeDef
    };

    // Initialize GroupInput/Output node data with current workflow interface
    const currentTabForInit = activeTabId.value; // Use a separate variable for clarity
    if (currentTabForInit) {
      const workflowData = workflowStore.getWorkflowData(currentTabForInit);
      if (workflowData) {
        if (newNode.type === 'core:GroupInput') {
          newNode.data = {
            ...newNode.data,
            outputs: workflowData.interfaceInputs || {}, // Use current interface inputs
          };
          // console.debug(`[useCanvasInteraction] Initialized GroupInput (${newNode.id}) outputs from workflow interface.`);
        } else if (newNode.type === 'core:GroupOutput') {
          newNode.data = {
            ...newNode.data,
            inputs: workflowData.interfaceOutputs || {}, // Use current interface outputs
          };
           // console.debug(`[useCanvasInteraction] Initialized GroupOutput (${newNode.id}) inputs from workflow interface.`);
        }
      } else {
        console.warn(`[useCanvasInteraction] Could not get workflow data for tab ${currentTabForInit} to initialize Group IO node.`);
      }
    }

    const currentTab = activeTabId.value;
    if (currentTab) {
      // const label = `添加 - 节点 (${nodeDef?.displayName || fullNodeType})`; // Removed label creation
      const nodeName = nodeDef?.displayName || fullNodeType; // Use fullNodeType here
      const entry: HistoryEntry = createHistoryEntry(
        'add', // actionType
        'node', // objectType
        `添加节点 ${nodeName}`, // summary
        { // details
          nodeId: newNode.id,
          nodeName: nodeName,
          nodeType: fullNodeType, // Log the full type
        }
      );
      // // console.debug(`[useCanvasInteraction] Calling addNodeAndRecord for tab ${currentTab}, node ID: ${newNode.id}`);
      await workflowStore.addNodeAndRecord(currentTab, newNode, entry); // Pass entry object
    } else {
      console.error("[useCanvasInteraction] Cannot add node via click: No active tab selected.");
    }
  };

  // 连接建立事件处理 - 由 Canvas 内部的 onConnect -> useCanvasConnections 处理
  // EditorView 监听 @connect 只是为了知道连接发生了，但不需要在这里重复处理。
  const handleConnect = (params: Connection) => {
     console.debug("[useCanvasInteraction] Received @connect event from Canvas:", params);
     // 不需要做任何事情，实际的添加和历史记录已在 useCanvasConnections 中完成。
  };

  // 处理节点拖拽停止事件
  const handleNodesDragStop = (event: NodeDragEventData) => {
    const currentTab = activeTabId.value;
    if (!currentTab) {
      console.warn("[useCanvasInteraction] handleNodesDragStop: No active tab ID found.");
      return;
    }

    // 场景1：父节点发生了变化
    if (event.parentChanged && event.parentingInfo) {
      const { updates, oldStates } = event.parentingInfo;
      // 从 workflowStore 获取最新的、完整的节点信息，而不是依赖 event.nodes
      const allElements = workflowStore.getElements(currentTab);
      const allNodesMap = new Map(allElements.filter(isNode).map((n: Node) => [n.id, n]));

      const changedNodeNames = updates.map(u => {
        const node = allNodesMap.get(u.nodeId);
        // 优先使用用户自定义的 data.label，然后是节点本身的 label（通常来自 displayName），最后是 ID
        return node?.data?.label || (node as Node | undefined)?.label || (node as Node | undefined)?.id || u.nodeId;
      }).join(', ');
      
      const summary = `变更 ${changedNodeNames} 的父级`;
      
      const entry = createHistoryEntry(
        'update',
        'nodeParent',
        summary,
        {
          updates: updates,
          oldStates: oldStates
        }
      );
      
      workflowStore.updateNodeParentAndRecord(currentTab, updates, entry);

    // 场景2：仅仅是节点移动，没有父节点变化
    } else if (!event.parentChanged && event.nodes.length > 0) {
      nextTick(async () => {
        try {
          const nodeUpdates = event.nodes.map((node) => ({
            nodeId: node.id,
            position: { ...node.position },
          }));

          if (nodeUpdates.length === 0) {
            return;
          }

          // 从 workflowStore 获取最新的、完整的节点信息
          const allElements = workflowStore.getElements(currentTab);
          const allNodesMap = new Map(allElements.filter(isNode).map((n: Node) => [n.id, n]));

          const movedNodeIds = event.nodes.map(n => n.id);
          const firstMovedNodeId = movedNodeIds[0];
          const firstMovedNode = firstMovedNodeId ? allNodesMap.get(firstMovedNodeId) : undefined;

          const summary = movedNodeIds.length > 1
            ? `移动 ${movedNodeIds.length} 个节点`
            // 优先使用用户自定义的 data.label，然后是节点本身的 label（通常来自 displayName），最后是 ID
            : `移动节点 ${firstMovedNode?.data?.label || (firstMovedNode as Node | undefined)?.label || firstMovedNode?.id || '未知节点'}`;

          const entry: HistoryEntry = createHistoryEntry(
            'move',
            'node',
            summary,
            {
              movedNodes: event.nodes.map(node => ({
                nodeId: node.id,
                nodeName: node.data?.label || node.data?.defaultLabel || node.id,
                nodeType: node.type,
                // oldPosition and newPosition could be added here if needed
                newPosition: node.position,
              })),
            }
          );
          
          await workflowStore.updateNodePositionAndRecord(currentTab, nodeUpdates, entry);
        } catch (error) {
          console.error("[useCanvasInteraction] Error inside handleNodesDragStop nextTick:", error);
        }
      });
    }
  };

  // 处理元素删除事件
  const handleElementsRemove = (removedElements: (Node | Edge)[]) => {
    // // console.debug("[useCanvasInteraction] Elements remove event triggered with elements:", removedElements);
    const currentTab = activeTabId.value;
    if (currentTab && removedElements.length > 0) {
      const removedNodes = removedElements.filter(isNode);
      const removedEdges = removedElements.filter((el): el is Edge => !isNode(el));
      const nodeCount = removedNodes.length;
      const edgeCount = removedEdges.length;
 
      let summary = "删除元素";
      const details: Record<string, any> = {};
      if (nodeCount > 0) {
        details.nodeIds = removedNodes.map(n => n.id);
        summary = edgeCount > 0 ? `删除 ${nodeCount} 节点, ${edgeCount} 边` : `删除 ${nodeCount} 节点`;
      } else if (edgeCount > 0) {
        details.edgeIds = removedEdges.map(e => e.id);
        summary = `删除 ${edgeCount} 边`;
      }
 
      const entry: HistoryEntry = createHistoryEntry(
        'delete', // actionType
        'canvasElement', // objectType
        summary, // summary
        details // details
      );
 
      // 调用协调器的函数
      workflowStore.removeElementsAndRecord(currentTab, removedElements, entry); // Pass entry object
      // // console.debug(`[useCanvasInteraction] Called removeElementsAndRecord for element removal in tab ${currentTab}: ${summary}`);
    } else if (!currentTab) {
      console.warn("[useCanvasInteraction] handleElementsRemove: No active tab ID found.");
    } else {
      // // console.debug("[useCanvasInteraction] handleElementsRemove: No elements were removed.");
    }
  };

  return {
    handleAddNodeFromPanel,
    handleConnect,
    handleNodesDragStop,
    handleElementsRemove,
  };
}