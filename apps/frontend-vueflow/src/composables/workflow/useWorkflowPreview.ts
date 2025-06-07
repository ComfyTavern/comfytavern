import { useWebSocket } from "@/composables/useWebSocket";
import { useWorkflowData } from "@/composables/workflow/useWorkflowData";
import { useWorkflowManager } from "@/composables/workflow/useWorkflowManager";
import { useExecutionStore } from "@/stores/executionStore";
import { useNodeStore, type FrontendNodeDefinition } from "@/stores/nodeStore"; // Import FrontendNodeDefinition from nodeStore
import { useProjectStore } from "@/stores/projectStore";
import { useTabStore } from "@/stores/tabStore";
import { flattenWorkflow } from "@/utils/workflowFlattener";
import {
  WebSocketMessageType,
  type ExecutionEdge,
  type ExecutionNode,
  type InputDefinition,
  type NanoId,
  type NodeCompletePayload,
  type NodeErrorPayload,
  type WebSocketMessage,
  type WorkflowExecutionPayload,
} from "@comfytavern/types";
import { useVueFlow, type Edge as VueFlowEdge } from "@vue-flow/core";
import { debounce } from "lodash-es";
import { nanoid } from "nanoid";
import { storeToRefs } from "pinia";
import { readonly, ref } from "vue";

// 定义节点预览状态类型
export type NodePreviewStatus =
  | "newly_computed"
  | "clean_reused"
  | "stale_unsafe_reused"
  | "error"
  | "unknown";

/**
 * Composable for handling the new frontend-driven workflow preview execution logic.
 */
export function useWorkflowPreview() {
  const executionStore = useExecutionStore();
  const nodeStore = useNodeStore();
  const tabStore = useTabStore(); // Initialize tabStore
  const projectStore = useProjectStore(); // Initialize projectStore
  const workflowDataHandler = useWorkflowData(); // Initialize workflowDataHandler
  const workflowManager = useWorkflowManager(); // Initialize workflowManager

  const { sendMessage, isConnected } = useWebSocket(); // clientId removed, will be handled as TODO
  const { getNodes, getEdges, findNode } = useVueFlow();

  // currentOutputsSnapshot is no longer directly from storeToRefs
  const { isPreviewEnabled: isPreviewEnabledFromStore } = storeToRefs(executionStore);
  const nodePreviewStates = ref<Record<NanoId, NodePreviewStatus>>({});

  // watch for currentOutputsSnapshot was removed as it's now locally constructed

  const getFullNodeDefinition = (nodeId: NanoId): FrontendNodeDefinition | undefined => {
    const node = findNode(nodeId);
    if (!node || !node.type) return undefined; // Ensure node.type exists
    return nodeStore.getNodeDefinitionByFullType(node.type); // Use correct method
  };

  /**
   * 核心预览逻辑：构建并发送迷你预览工作流。
   * @param changedNodeId 发生变更的节点 ID。
   * @param _changeDetails 变更详情 (可选, 例如具体哪个输入变化了)。
   */
  const triggerPreview = debounce(async (changedNodeId: NanoId, _changeDetails?: any) => {
    const activeInternalId = tabStore.activeTabId;
    if (!isPreviewEnabledFromStore.value || !isConnected.value || !activeInternalId) {
      console.debug(
        "[WorkflowPreview:triggerPreview] Preview disabled, WebSocket not connected, or no active tab."
      );
      return;
    }

    console.debug(
      `[WorkflowPreview:triggerPreview] Triggering preview for changedNodeId: ${changedNodeId} in tab ${activeInternalId}`
    );

    const allNodesRaw = getNodes.value;
    const allEdgesRaw = getEdges.value;

    // 1. 获取当前工作流所有节点输出值的最新快照
    const snapshot: Record<NanoId, Record<string, any>> = {};
    allNodesRaw.forEach((node) => {
      const outputs = executionStore.getAllNodeOutputs(activeInternalId, node.id);
      if (outputs && Object.keys(outputs).length > 0) {
        snapshot[node.id] = outputs;
      }
    });
    console.debug("[WorkflowPreview:triggerPreview] Constructed snapshot:", snapshot);

    // 2. 获取完整扁平化视图 G_flat
    const flatWorkflow = await flattenWorkflow(
      activeInternalId,
      [...allNodesRaw, ...allEdgesRaw],
      workflowDataHandler,
      projectStore,
      workflowManager
    );

    if (!flatWorkflow) {
      console.error("[WorkflowPreview:triggerPreview] Failed to flatten workflow.");
      return;
    }
    const { nodes: flatNodes, edges: flatEdges } = flatWorkflow;
    console.debug("[WorkflowPreview:triggerPreview] Flattened workflow:", { flatNodes, flatEdges });

    // 3. 从 changedNodeId 开始，进行下游依赖分析，找出受影响节点路径
    const affectedNodeIds = new Set<NanoId>();
    const processingQueue: NanoId[] = [];

    // Initial population of processingQueue:
    // If changedNodeId itself is safe, it's a starting point.
    const changedNodeDef = getFullNodeDefinition(changedNodeId);
    if (changedNodeDef && !changedNodeDef.isPreviewUnsafe) {
      processingQueue.push(changedNodeId);
      affectedNodeIds.add(changedNodeId); // Mark as affected early if it's a starting point
    }

    // Add direct children of changedNodeId to the queue, regardless of changedNodeId's safety.
    // This ensures propagation starts even if changedNodeId is unsafe.
    flatEdges.forEach((edge: VueFlowEdge) => {
      if (edge.source === changedNodeId) {
        if (!affectedNodeIds.has(edge.target)) {
          // Avoid adding if already added (e.g. if changedNodeId was safe)
          processingQueue.push(edge.target);
          // Don't add to affectedNodeIds here yet, let the main loop do it to ensure consistent handling
        }
      }
    });

    // Deduplicate initial queue (though the main loop's check `!affectedNodeIds.has(currentId)` handles actual processing duplication)
    const uniqueInitialProcessingQueue = [...new Set(processingQueue)];

    while (uniqueInitialProcessingQueue.length > 0) {
      const currentId = uniqueInitialProcessingQueue.shift()!;

      // Only add to affectedNodeIds and process children if not already processed.
      if (
        affectedNodeIds.has(currentId) &&
        !(changedNodeDef && !changedNodeDef.isPreviewUnsafe && currentId === changedNodeId)
      ) {
        // If already affected, and it's not the initial safe changedNodeId, skip.
        // The initial safe changedNodeId is added to affectedNodeIds before this loop.
        // This condition ensures we process the initial safe changedNodeId once.
        // For other nodes, if they are already in affectedNodeIds, they've been queued and processed.
        // This logic might be slightly off, the main guard is `if (!affectedNodeIds.has(currentId))` inside the loop.
        // Let's simplify: the `affectedNodeIds.add(currentId)` inside the loop is the primary guard.
      }

      if (!affectedNodeIds.has(currentId)) {
        affectedNodeIds.add(currentId);
      }

      flatEdges.forEach((edge: VueFlowEdge) => {
        if (edge.source === currentId && !affectedNodeIds.has(edge.target)) {
          // Add to queue if not already processed (i.e., not in affectedNodeIds)
          // The check `!affectedNodeIds.has(edge.target)` ensures we don't re-queue nodes already processed or about to be.
          uniqueInitialProcessingQueue.push(edge.target);
        }
      });
    }
    console.debug(
      "[WorkflowPreview:triggerPreview] Affected node IDs (downstream analysis):",
      affectedNodeIds
    );

    // 4. 筛选节点: isPreviewUnsafe 为 false (或未定义) 的节点构成 G'
    const gPrimeNodeIds = new Set<NanoId>();
    affectedNodeIds.forEach((id) => {
      const nodeDef = getFullNodeDefinition(id);
      if (nodeDef && !nodeDef.isPreviewUnsafe) {
        // Check if nodeDef exists
        gPrimeNodeIds.add(id);
      }
    });
    // Ensure the initially changed node is included in G' if it's safe.
    // This is important if the downstream analysis didn't pick it up (e.g., an isolated safe node).
    // The previous logic for populating affectedNodeIds should generally include it if it's safe.
    // This is a safeguard.
    const initiallyChangedNodeDef = getFullNodeDefinition(changedNodeId);
    if (initiallyChangedNodeDef && !initiallyChangedNodeDef.isPreviewUnsafe) {
      gPrimeNodeIds.add(changedNodeId);
    }
    console.debug(
      "[WorkflowPreview:triggerPreview] G' node IDs (isPreviewUnsafe=false filter):",
      gPrimeNodeIds
    );

    const gPrimeExecutionNodes: ExecutionNode[] = [];
    const gPrimeExecutionEdges: ExecutionEdge[] = [];

    // 5. 处理 G' 的边界输入 和 Bypass 节点
    for (const nodeId of gPrimeNodeIds) {
      const originalNode = findNode(nodeId);
      if (!originalNode || !originalNode.type) {
        console.warn(
          `[WorkflowPreview:triggerPreview] Original node ${nodeId} not found or has no type. Skipping.`
        );
        continue;
      }
      const nodeDef = getFullNodeDefinition(nodeId);
      if (!nodeDef) {
        console.warn(
          `[WorkflowPreview:triggerPreview] Node definition for ${nodeId} (type: ${originalNode.type}) not found. Skipping.`
        );
        continue;
      }

      const execNode: ExecutionNode = {
        id: originalNode.id,
        fullType: originalNode.type,
        inputs: { ...(originalNode.data?.inputs || {}) },
        configValues: { ...(originalNode.data?.configValues || {}) },
        bypassed: originalNode.data?.bypassed === true && !nodeDef.isPreviewUnsafe,
      };

      Object.entries(nodeDef.inputs).forEach(([inputKey, inputDefUntyped]) => {
        const inputDef = inputDefUntyped as InputDefinition; // Add type assertion
        const incomingEdges = flatEdges.filter(
          (e: VueFlowEdge) => e.target === nodeId && e.targetHandle === inputKey
        );

        if (incomingEdges.length > 0) {
          const edge = incomingEdges[0];
          if (edge) {
            // Check if edge is defined
            const sourceNodeId = edge.source;
            if (!gPrimeNodeIds.has(sourceNodeId)) {
              // Source node is outside G'
              const sourceOutputValue = snapshot[sourceNodeId]?.[edge.sourceHandle!];
              if (sourceOutputValue !== undefined) {
                execNode.inputs = execNode.inputs || {};
                execNode.inputs[inputKey] = sourceOutputValue;
              } else {
                console.warn(
                  `[WorkflowPreview:triggerPreview] Snapshot value for ${sourceNodeId}.${edge.sourceHandle!} is undefined, required by ${nodeId}.${inputKey}`
                );
              }
            }
          }
        } else if (execNode.inputs?.[inputKey] === undefined && inputDef.required) {
          console.warn(
            `[WorkflowPreview:triggerPreview] Required input ${nodeId}.${inputKey} is undefined and has no incoming G' edge or preset value.`
          );
        }
      });
      gPrimeExecutionNodes.push(execNode);
    }
    console.debug("[WorkflowPreview:triggerPreview] G' execution nodes:", gPrimeExecutionNodes);

    // 6. 构造 G' 内部的边
    flatEdges.forEach((edge: VueFlowEdge) => {
      // Add type for edge
      if (gPrimeNodeIds.has(edge.source) && gPrimeNodeIds.has(edge.target)) {
        gPrimeExecutionEdges.push({
          sourceNodeId: edge.source,
          sourceHandle: edge.sourceHandle!,
          targetNodeId: edge.target,
          targetHandle: edge.targetHandle!,
          id: edge.id, // Keep original edge ID if possible
        });
      }
    });
    console.debug("[WorkflowPreview:triggerPreview] G' execution edges:", gPrimeExecutionEdges);

    // 7. 构造 WorkflowExecutionPayload
    // TODO: Resolve clientId. For now, using a placeholder.
    // This should ideally come from useWebSocket() or be handled by sendMessage.
    const tempClientId = "temp-preview-client-id"; // Placeholder
    if (!tempClientId) {
      // Changed from !clientId to !tempClientId for placeholder logic
      console.error(
        "[WorkflowPreview:triggerPreview] ClientID is not available. Cannot send preview request."
      );
      return;
    }
    const previewPromptId = nanoid(10);
    const payload: WorkflowExecutionPayload = {
      nodes: gPrimeExecutionNodes,
      edges: gPrimeExecutionEdges,
      clientId: tempClientId, // Using placeholder
      metadata: {
        promptId: previewPromptId,
        isPreviewRun: true,
        internalId: activeInternalId,
      },
    };

    // 8. 发送请求
    const message: WebSocketMessage<WorkflowExecutionPayload> = {
      type: WebSocketMessageType.PROMPT_REQUEST,
      payload: payload,
    };

    sendMessage(message);
    console.debug(
      "[WorkflowPreview:triggerPreview] PROMPT_REQUEST for preview sent with promptId:",
      previewPromptId,
      message
    );

    gPrimeNodeIds.forEach((id) => (nodePreviewStates.value[id] = "unknown")); // Or 'computing'
  }, 500);

  /**
   * 处理后端返回的 NODE_COMPLETE 消息，更新预览状态。
   * @param internalId The tab ID.
   * @param completedPromptId The promptId from the NODE_COMPLETE message.
   * @param nodeId 完成的节点 ID.
   * @param output 节点输出.
   * @param errorDetails 错误信息 (如果有).
   */
  const handlePreviewNodeUpdate = (
    // This function is called by WebSocket message handlers
    internalId: string, // This should be part of the WebSocket message or context
    completedPromptId: NanoId, // This is the promptId from the incoming message
    nodeId: NanoId,
    output?: any,
    errorDetails?: any
  ) => {
    // The executionStore logic (updateNodeExecutionResult, updateNodeError)
    // already differentiates between main workflow and other (preview) workflows
    // based on the promptId in the payload compared to the tab's main promptId.

    if (errorDetails) {
      nodePreviewStates.value[nodeId] = "error";
      const errorPayload: NodeErrorPayload = {
        promptId: completedPromptId, // Use the promptId from the message
        nodeId,
        errorDetails,
      };
      executionStore.updateNodeError(internalId, errorPayload);
    } else {
      nodePreviewStates.value[nodeId] = "newly_computed";
      const completePayload: NodeCompletePayload = {
        promptId: completedPromptId, // Use the promptId from the message
        nodeId,
        output,
      };
      executionStore.updateNodeExecutionResult(internalId, completePayload);
    }
    // Consider calling assignFinalPreviewStates() here or debouncing it
    // assignFinalPreviewStates();
  };

  const assignFinalPreviewStates = () => {
    const activeInternalId = tabStore.activeTabId;
    if (!activeInternalId) return;

    const allCurrentNodes = getNodes.value;
    const finalStates: Record<NanoId, NodePreviewStatus> = {};

    allCurrentNodes.forEach((node) => {
      const nodeId = node.id;
      // Check if this node was part of the G' computation (newly_computed or error)
      if (
        nodePreviewStates.value[nodeId] === "newly_computed" ||
        nodePreviewStates.value[nodeId] === "error"
      ) {
        finalStates[nodeId] = nodePreviewStates.value[nodeId];
      } else {
        // Node was not in G', so its value is from snapshot
        const nodeDef = getFullNodeDefinition(nodeId);
        // A more robust check for "stale_unsafe_reused" would involve checking if the node
        // or its upstream dependencies were affected by the initial change AND it's unsafe.
        // For now, a simpler check: if it's unsafe and its value is from snapshot, mark as stale_unsafe_reused.
        // This doesn't fully capture "affected by initial change" yet.
        if (nodeDef?.isPreviewUnsafe) {
          finalStates[nodeId] = "stale_unsafe_reused";
        } else {
          finalStates[nodeId] = "clean_reused";
        }
      }
    });
    nodePreviewStates.value = finalStates;
    console.debug(
      "[WorkflowPreview:assignFinalPreviewStates] Updated preview states:",
      finalStates
    );
  };

  return {
    triggerPreview,
    // handlePreviewNodeComplete, // Renamed or to be replaced by a more generic update handler
    handlePreviewNodeUpdate, // New handler
    assignFinalPreviewStates,
    nodePreviewStates: readonly(nodePreviewStates),
    isPreviewEnabled: readonly(isPreviewEnabledFromStore),
  };
}
