<template>
  <div class="inline-connection-sorter" v-if="draggableConnections.length > 1" @mousedown.stop>
    <draggable v-model="draggableConnections" item-key="id" @end="onSortEnd" class="connection-list" :animation="200">
      <template #item="{ element, index }">
        <div class="sortable-connection-item" :title="getSourceTooltip(element)">
          <span class="connection-index">{{ index + 1 }}.</span>
          <div class="tooltip-flex-wrapper">
            <span class="connection-label-container" v-comfy-tooltip="{
              content: getSourceTooltip(element),
              placement: 'top',
              delayShow: 300,
            }">
              <span class="source-handle-label-part" v-if="element.sourceHandleId" :title="element.sourceHandleLabel">
                ({{ element.sourceHandleLabel }})
              </span>
              <span class="source-node-label-part" :title="element.sourceNodeLabel">
                {{ element.sourceNodeLabel }}
              </span>
            </span>
          </div>
          <button @click.stop="handleDisconnectEdge(element)" class="disconnect-button" title="断开此连接">
            &times;
          </button>
        </div>
      </template>
    </draggable>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, type PropType, computed } from "vue";
import draggable from "vuedraggable";
import type { Edge, Node as VueFlowNode } from "@vue-flow/core";
import type { InputDefinition, HistoryEntry } from "@comfytavern/types";
import { createHistoryEntry } from "@comfytavern/utils";
import { klona } from "klona/full";
import { useMultiInputConnectionActions } from "@/composables/node/useMultiInputConnectionActions";
import { useTabStore } from "@/stores/tabStore";
import { useWorkflowManager } from "@/composables/workflow/useWorkflowManager";
import { useWorkflowHistory } from "@/composables/workflow/useWorkflowHistory";
import { useSlotDefinitionHelper } from "@/composables/node/useSlotDefinitionHelper";
import { useWorkflowStore } from "@/stores/workflowStore";

interface DraggableConnectionItem {
  id: string; // Edge ID
  sourceNodeId: string;
  sourceHandleId: string | null | undefined;
  sourceNodeLabel: string;
  sourceHandleLabel: string;
  targetNodeId: string; // Added for disconnect context
  targetHandleId: string | null | undefined; // Added for disconnect context
}

const props = defineProps({
  nodeId: { type: String, required: true },
  inputHandleKey: { type: String, required: true },
  currentOrderedEdgeIds: { type: Array as PropType<string[]>, default: () => [] },
  inputDefinition: { type: Object as PropType<InputDefinition>, required: true },
  allEdges: { type: Array as PropType<Edge[]>, required: true },
  findNode: { type: Function as PropType<(id: string) => VueFlowNode | undefined>, required: true },
  getNodeLabel: { type: Function as PropType<(nodeId: string) => string>, required: true },
});

const tabStore = useTabStore();
const activeTabIdRef = computed(() => tabStore.activeTabId);
const workflowManager = useWorkflowManager();
const workflowHistory = useWorkflowHistory();
const { reorderMultiInputConnections, disconnectEdgeFromMultiInput } =
  useMultiInputConnectionActions(activeTabIdRef);
const { getSlotDefinition } = useSlotDefinitionHelper();
const workflowStore = useWorkflowStore();

const draggableConnections = ref<DraggableConnectionItem[]>([]);

const mapEdgeIdsToDraggableItems = () => {
  const items: DraggableConnectionItem[] = [];
  if (!props.currentOrderedEdgeIds || !props.findNode || !props.allEdges || !props.getNodeLabel) {
    return items;
  }
  const currentWorkflowData = workflowStore.getActiveTabState()?.workflowData;

  for (const edgeId of props.currentOrderedEdgeIds) {
    const edge = props.allEdges.find((e) => e.id === edgeId);
    if (edge) {
      const targetNode = props.findNode(edge.target);
      if (!targetNode) {
      } else {
        if (edge.targetHandle) {
          const targetSlotDef = getSlotDefinition(
            targetNode,
            edge.targetHandle,
            "target",
            currentWorkflowData
          );
          if (!targetSlotDef) {
          } else {
          }
        }
      }

      const sourceNode = props.findNode(edge.source);
      let sourceHandleLabel = edge.sourceHandle || "默认输出";

      if (sourceNode && edge.sourceHandle) {
        const slotDef = getSlotDefinition(
          sourceNode,
          edge.sourceHandle,
          "source",
          currentWorkflowData
        );
        if (slotDef?.displayName) {
          sourceHandleLabel = slotDef.displayName;
        }
      }

      items.push({
        id: edge.id,
        sourceNodeId: edge.source,
        sourceHandleId: edge.sourceHandle,
        sourceNodeLabel: sourceNode
          ? props.getNodeLabel(edge.source)
          : `源节点 ${edge.source.substring(0, 6)}... 未找到`,
        sourceHandleLabel: sourceHandleLabel,
        targetNodeId: edge.target,
        targetHandleId: edge.targetHandle,
      });
    } else {
      items.push({
        id: edgeId,
        sourceNodeId: "error-edge-not-in-allEdges",
        sourceHandleId: "error",
        sourceNodeLabel: `边 ${edgeId.substring(0, 6)}... (数据错误)`,
        sourceHandleLabel: "!",
        targetNodeId: "error",
        targetHandleId: "error",
      });
    }
  }
  return items;
};

watch(
  () => [props.currentOrderedEdgeIds, props.allEdges, props.findNode],
  () => {
    draggableConnections.value = mapEdgeIdsToDraggableItems();
  },
  { deep: true, immediate: true }
);

const getSourceTooltip = (item: DraggableConnectionItem): string => {
  return `插槽: ${item.sourceHandleLabel} (ID: ${item.sourceHandleId || "N/A"})\n来源: ${item.sourceNodeLabel
    } (ID: ${item.sourceNodeId})\n边 ID: ${item.id}`;
};

const onSortEnd = async () => {
  const newOrderedEdgeIds = draggableConnections.value.map((conn) => conn.id);

  if (JSON.stringify(newOrderedEdgeIds) === JSON.stringify(props.currentOrderedEdgeIds)) {
    return;
  }

  const activeTabId = tabStore.activeTabId;
  if (!activeTabId) {
    console.error("[InlineConnectionSorter] 无法更新顺序：activeTabId 未定义。");
    draggableConnections.value = mapEdgeIdsToDraggableItems();
    return;
  }

  const nodeDisplayName = props.getNodeLabel(props.nodeId);
  const inputDisplayName = props.inputDefinition.displayName || props.inputHandleKey;

  try {
    const currentSnapshot = workflowManager.getCurrentSnapshot(activeTabId);
    if (!currentSnapshot) {
      console.error("[InlineConnectionSorter] 无法获取当前工作流快照。");
      draggableConnections.value = mapEdgeIdsToDraggableItems();
      return;
    }
    const mutableSnapshot = klona(currentSnapshot);

    await reorderMultiInputConnections(
      mutableSnapshot,
      props.nodeId,
      props.inputHandleKey,
      newOrderedEdgeIds
    );

    const summary = `重排序节点 "${nodeDisplayName}" 上的输入 "${inputDisplayName}" 的连接`;
    const historyPayload = {
      nodeId: props.nodeId,
      inputKey: props.inputHandleKey,
      newOrder: newOrderedEdgeIds,
      originalOrder: [...props.currentOrderedEdgeIds],
    };
    const entry: HistoryEntry = createHistoryEntry(
      "multiInputReorder",
      "workflow",
      summary,
      historyPayload
    );

    await workflowManager.setElements(activeTabId, mutableSnapshot.elements);

    workflowManager.applyStateSnapshot(activeTabId, mutableSnapshot);

    workflowHistory.recordSnapshot(activeTabId, entry, mutableSnapshot);
  } catch (error) {
    console.error("[InlineConnectionSorter] 更新连接顺序失败:", error);
    draggableConnections.value = mapEdgeIdsToDraggableItems();
  }
};

const handleDisconnectEdge = async (item: DraggableConnectionItem) => {
  const activeTabId = activeTabIdRef.value;
  if (!activeTabId) {
    console.error("[InlineConnectionSorter] 无法断开连接：activeTabId 未定义。");
    return;
  }
  if (!item.targetHandleId) {
    console.error(`[InlineConnectionSorter] 边 ${item.id} 的 targetHandleId 未定义，无法断开。`);
    return;
  }

  const edgeToDisconnect = props.allEdges.find((e) => e.id === item.id);
  if (!edgeToDisconnect) {
    console.error(`[InlineConnectionSorter] 未在 allEdges 中找到要断开的边 ${item.id}。`);
    return;
  }

  const targetNodeLabel = props.getNodeLabel(props.nodeId);
  const inputDisplayName = props.inputDefinition.displayName || props.inputHandleKey;

  const summary = `断开连接: ${item.sourceNodeLabel}(${item.sourceHandleLabel}) -> ${targetNodeLabel}(${inputDisplayName})`;

  const historyPayload = {
    removedEdge: klona(edgeToDisconnect),
    originalTargetNodeId: props.nodeId,
    originalTargetHandleId: item.targetHandleId,
    contextNodeId: props.nodeId,
    contextInputKey: props.inputHandleKey,
    originalEdgeData: klona(edgeToDisconnect),
  };

  const entry: HistoryEntry = createHistoryEntry(
    "edgeRemove",
    "workflow",
    summary,
    historyPayload
  );

  try {
    const currentSnapshot = workflowManager.getCurrentSnapshot(activeTabId);
    if (!currentSnapshot) {
      console.error("[InlineConnectionSorter:handleDisconnectEdge] 无法获取当前工作流快照。");
      return;
    }
    const mutableSnapshot = klona(currentSnapshot);

    await disconnectEdgeFromMultiInput(
      mutableSnapshot,
      item.id,
      props.nodeId,
      item.targetHandleId
    );

    await workflowManager.setElements(activeTabId, mutableSnapshot.elements);

    workflowManager.applyStateSnapshot(activeTabId, mutableSnapshot);

    workflowHistory.recordSnapshot(activeTabId, entry, mutableSnapshot);

  } catch (error) {
    console.error(`[InlineConnectionSorter] 断开边 ${item.id} 失败:`, error);
  }
};
</script>

<style scoped>
.inline-connection-sorter {
  padding: 8px;
  margin-top: 2px;
  background-color: hsl(var(--ct-background-surface-hsl) / 1);
  border-radius: 4px;
  border: 1px solid hsl(var(--ct-border-base-hsl) / 1);
}

.connection-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sortable-connection-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  background-color: hsl(var(--ct-background-base-hsl) / var(--ct-background-base-opacity));
  border: 1px solid hsl(var(--ct-border-base-hsl) / 1);
  border-radius: 3px;
  font-size: 0.9em;
  cursor: grab;
  color: hsl(var(--ct-text-base-hsl) / 1);
}

.sortable-connection-item:hover {
  border-color: hsl(var(--ct-accent-hsl) / 1);
  box-shadow: 0 0 0 1px hsl(var(--ct-accent-hsl) / 1);
}

.connection-index {
  margin-right: 4px;
  color: hsl(var(--ct-text-muted-hsl) / 1);
  font-variant-numeric: tabular-nums;
}

.tooltip-flex-wrapper {
  flex-grow: 1;
  min-width: 0;
  overflow: hidden;
}

.connection-label-container {
  display: flex;
  align-items: baseline;
  overflow: hidden;
  flex-grow: 1;
  min-width: 0;
}

.source-node-label-part {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 2;
  min-width: 0;
}

.source-handle-label-part {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 1;
  margin-left: 4px;
  min-width: 0;
}

.disconnect-button {
  flex-shrink: 0;
  padding: 1px 4px;
  margin-left: auto;
  background-color: transparent;
  border: 1px solid transparent;
  color: hsl(var(--ct-error-hsl) / 1);
  cursor: pointer;
  font-size: 0.9em;
  line-height: 1;
  border-radius: 3px;
  font-weight: bold;
}

.disconnect-button:hover {
  background-color: hsl(var(--ct-error-hsl) / 0.15);
  border-color: hsl(var(--ct-error-hsl) / 1);
  color: hsl(var(--ct-error-hsl) / 1);
}
</style>
