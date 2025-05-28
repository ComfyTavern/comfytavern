<template>
  <div class="inline-connection-sorter" v-if="draggableConnections.length > 1" @mousedown.stop>
    <draggable v-model="draggableConnections" item-key="id" @end="onSortEnd" class="connection-list" :animation="200">
      <template #item="{ element, index }">
        <div class="sortable-connection-item" :title="getSourceTooltip(element)">
          <span class="connection-index">{{ index + 1 }}.</span>
          <div class="tooltip-flex-wrapper">
            <!-- Tooltip now wraps the button or the text, let's keep it on text for now -->
            <Tooltip :content="getSourceTooltip(element)" placement="top" :show-delay="300">
              <span class="connection-label-container">
                <span class="source-node-label-part" :title="element.sourceNodeLabel">
                  {{ element.sourceNodeLabel }}
                </span>
                <span class="source-handle-label-part" v-if="element.sourceHandleId" :title="element.sourceHandleLabel">
                  ({{ element.sourceHandleLabel }})
                </span>
              </span>
            </Tooltip>
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
import { ref, watch, type PropType, computed } from 'vue';
import draggable from 'vuedraggable';
import type { Edge, Node as VueFlowNode } from '@vue-flow/core'; // Renamed Node to VueFlowNode to avoid conflict
import type { InputDefinition, OutputDefinition, HistoryEntry } from '@comfytavern/types';
import { createHistoryEntry } from '@comfytavern/utils';
import { klona } from 'klona/full';
import { useMultiInputConnectionActions } from '@/composables/node/useMultiInputConnectionActions';
import { useTabStore } from '@/stores/tabStore';
import { useWorkflowManager } from '@/composables/workflow/useWorkflowManager'; // 导入 useWorkflowManager
import { useWorkflowHistory } from '@/composables/workflow/useWorkflowHistory'; // 导入 useWorkflowHistory
import Tooltip from '@/components/common/Tooltip.vue';

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
  // BaseNode 将通过 useVueFlow() 获取 vueFlowInstance 并传递所需部分
  allEdges: { type: Array as PropType<Edge[]>, required: true },
  findNode: { type: Function as PropType<(id: string) => VueFlowNode | undefined>, required: true },
  getNodeLabel: { type: Function as PropType<(nodeId: string) => string>, required: true },
});

const tabStore = useTabStore();
const activeTabIdRef = computed(() => tabStore.activeTabId);
const workflowManager = useWorkflowManager(); // 获取 workflowManager 实例
const workflowHistory = useWorkflowHistory(); // 获取 workflowHistory 实例
const { reorderMultiInputConnections, disconnectEdgeFromMultiInput } = useMultiInputConnectionActions(activeTabIdRef);

const draggableConnections = ref<DraggableConnectionItem[]>([]);

const mapEdgeIdsToDraggableItems = () => {
  const items: DraggableConnectionItem[] = [];
  if (!props.currentOrderedEdgeIds || !props.findNode || !props.allEdges || !props.getNodeLabel) {
    return items;
  }

  for (const edgeId of props.currentOrderedEdgeIds) {
    const edge = props.allEdges.find(e => e.id === edgeId); // 简化查找：只通过 edgeId
    if (edge) {
      const sourceNode = props.findNode(edge.source);
      let sourceHandleLabel = edge.sourceHandle || '默认输出'; // 如果句柄ID为空，则使用默认文本

      // 尝试获取源节点上输出槽的 displayName
      if (sourceNode?.data?.outputs && edge.sourceHandle) {
        const outputDef: OutputDefinition | undefined = sourceNode.data.outputs[edge.sourceHandle];
        if (outputDef?.displayName) {
          sourceHandleLabel = outputDef.displayName;
        }
      }

      items.push({
        id: edge.id,
        sourceNodeId: edge.source,
        sourceHandleId: edge.sourceHandle,
        // 如果源节点存在，则使用 getNodeLabel 获取其标签，否则显示源节点ID和“未找到”
        sourceNodeLabel: sourceNode ? props.getNodeLabel(edge.source) : `源节点 ${edge.source.substring(0, 6)}... 未找到`,
        sourceHandleLabel: sourceHandleLabel,
        targetNodeId: edge.target, // Added for disconnect
        targetHandleId: edge.targetHandle, // Added for disconnect
      });
    } else {
      // 如果根据 edgeId 在 allEdges 中找不到边，这通常表示数据不一致
      console.warn(`[InlineConnectionSorter] 边 ID ${edgeId} 在 allEdges 中未找到 (数据可能不一致).`);
      items.push({
        id: edgeId,
        sourceNodeId: 'error-edge-not-in-allEdges',
        sourceHandleId: 'error',
        sourceNodeLabel: `边 ${edgeId.substring(0, 6)}... (数据错误)`,
        sourceHandleLabel: '!', // 用感叹号表示错误状态
        targetNodeId: 'error', // Added for disconnect
        targetHandleId: 'error', // Added for disconnect
      });
    }
  }
  return items;
};

watch(() => [props.currentOrderedEdgeIds, props.allEdges, props.findNode], () => {
  draggableConnections.value = mapEdgeIdsToDraggableItems();
}, { deep: true, immediate: true });

// getSourceLabel 函数已不再需要，因为标签已在模板中直接组合

const getSourceTooltip = (item: DraggableConnectionItem): string => {
  return `来源: ${item.sourceNodeLabel} (ID: ${item.sourceNodeId})\n插槽: ${item.sourceHandleLabel} (ID: ${item.sourceHandleId || 'N/A'})\n边 ID: ${item.id}`;
};

const onSortEnd = async () => {
  const newOrderedEdgeIds = draggableConnections.value.map(conn => conn.id);

  if (JSON.stringify(newOrderedEdgeIds) === JSON.stringify(props.currentOrderedEdgeIds)) {
    return; // 顺序未改变
  }

  const activeTabId = tabStore.activeTabId; // 从 tabStore 获取
  if (!activeTabId) {
    console.error("[InlineConnectionSorter] 无法更新顺序：activeTabId 未定义。");
    draggableConnections.value = mapEdgeIdsToDraggableItems(); // 恢复原始顺序
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
    const mutableSnapshot = klona(currentSnapshot); // 克隆快照以进行修改

    // 调用已重构的函数，它现在修改快照
    await reorderMultiInputConnections(
      mutableSnapshot, // 传递可变快照
      props.nodeId,
      props.inputHandleKey,
      newOrderedEdgeIds
      // originalOrderedEdgeIds, nodeDisplayName, inputDisplayName 不再直接传递给此函数
    );

    // 创建历史记录条目
    const summary = `重排序节点 "${nodeDisplayName}" 上的输入 "${inputDisplayName}" 的连接`;
    const historyPayload = {
      nodeId: props.nodeId,
      inputKey: props.inputHandleKey,
      newOrder: newOrderedEdgeIds,
      originalOrder: [...props.currentOrderedEdgeIds], // 原始顺序
    };
    const entry: HistoryEntry = createHistoryEntry(
      "multiInputReorder", // 新的历史类型
      "workflow", // 影响工作流元素
      summary,
      historyPayload
    );

    // 1. 应用对 elements 数组的更改 (包括节点数据和边句柄)
    // 这会触发 VueFlow 的重新渲染
    await workflowManager.setElements(activeTabId, mutableSnapshot.elements);

    // 2. 应用对 workflowData (如名称、描述、接口等) 的更改
    // applyStateSnapshot 会更新 workflowData 的顶层属性和接口，并确保动态插槽。
    // 节点内部数据 (node.data) 已通过 setElements 更新，因为 elements 包含节点。
    workflowManager.applyStateSnapshot(activeTabId, mutableSnapshot);

    // 3. 记录历史 (使用修改后的快照)
    workflowHistory.recordSnapshot(activeTabId, entry, mutableSnapshot);

    // 成功后，props.currentOrderedEdgeIds 应该会通过父组件的响应式更新
    // 这会触发 watch 重新计算 draggableConnections.value
  } catch (error) {
    console.error("[InlineConnectionSorter] 更新连接顺序失败:", error);
    // 失败时，恢复UI到之前的顺序
    draggableConnections.value = mapEdgeIdsToDraggableItems();
  }
};

const handleDisconnectEdge = async (item: DraggableConnectionItem) => {
  const activeTabId = activeTabIdRef.value; // 从 ref 获取 activeTabId 的当前值
  if (!activeTabId) { // 检查获取到的 activeTabId 值
    console.error("[InlineConnectionSorter] 无法断开连接：activeTabId 未定义。");
    return;
  }
  if (!item.targetHandleId) {
    console.error(`[InlineConnectionSorter] 边 ${item.id} 的 targetHandleId 未定义，无法断开。`);
    return;
  }

  const edgeToDisconnect = props.allEdges.find(e => e.id === item.id);
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
    originalTargetHandleId: item.targetHandleId, // 使用 item 上的 targetHandleId
    contextNodeId: props.nodeId,
    contextInputKey: props.inputHandleKey,
    originalEdgeData: klona(edgeToDisconnect), // 添加原始边数据以便撤销
  };

  const entry: HistoryEntry = createHistoryEntry(
    "edgeRemove",
    "workflow", // entityType for edge removal is typically 'workflow' as it affects elements list
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
      mutableSnapshot, // 传递快照
      item.id,
      props.nodeId, // originalTargetNodeId for the function
      item.targetHandleId // originalTargetHandleId for the function
      // entry 不再直接传递给此函数
    );

    // 1. 应用对 elements 数组的更改 (包括节点数据和边句柄)
    // 这会触发 VueFlow 的重新渲染
    await workflowManager.setElements(activeTabId, mutableSnapshot.elements);

    // 2. 应用对 workflowData (如名称、描述、接口等) 的更改
    workflowManager.applyStateSnapshot(activeTabId, mutableSnapshot);

    // 3. 记录历史 (使用修改后的快照)
    workflowHistory.recordSnapshot(activeTabId, entry, mutableSnapshot);

    // draggableConnections will update reactively due to props.allEdges changing
  } catch (error) {
    console.error(`[InlineConnectionSorter] 断开边 ${item.id} 失败:`, error);
    // Optionally, re-fetch or revert UI if needed, though reactive updates should handle it
  }
};

</script>

<style scoped>
.inline-connection-sorter {
  padding: 8px;
  margin-top: 2px;
  background-color: var(--ct-bg-surface, #f9fafb);
  border-radius: 4px;
  border: 1px solid var(--ct-border-DEFAULT, #d1d5db);
}

.dark .inline-connection-sorter {
  background-color: var(--ct-bg-surface-dark, #1f2937);
  border-color: var(--ct-border-dark, #4b5563);
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
  /* Add gap for items including the new button */
  padding: 4px 6px;
  background-color: var(--ct-bg-input, #ffffff);
  border: 1px solid var(--ct-border-input, #cbd5e1);
  border-radius: 3px;
  font-size: 0.9em;
  cursor: grab;
  /* 整行可拖拽 */
  color: var(--ct-text-default, #1f2937);
}

.dark .sortable-connection-item {
  background-color: var(--ct-bg-input-dark, #374151);
  border-color: var(--ct-border-input-dark, #6b7280);
  color: var(--ct-text-default-dark, #f3f4f6);
}

.sortable-connection-item:hover {
  border-color: var(--ct-accent-DEFAULT, #2563eb);
  box-shadow: 0 0 0 1px var(--ct-accent-DEFAULT, #2563eb);
}

.dark .sortable-connection-item:hover {
  border-color: var(--ct-accent-dark, #3b82f6);
  box-shadow: 0 0 0 1px var(--ct-accent-dark, #3b82f6);
}

.connection-index {
  margin-right: 4px;
  color: var(--ct-text-muted, #6b7280);
  font-variant-numeric: tabular-nums;
}

.dark .connection-index {
  color: var(--ct-text-muted-dark, #9ca3af);
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
  /* Smaller padding */
  margin-left: auto;
  /* Push to the right */
  background-color: transparent;
  border: 1px solid transparent;
  /* Keep layout consistent */
  color: var(--ct-text-danger, #dc2626);
  cursor: pointer;
  font-size: 0.9em;
  /* Slightly smaller or same as item text */
  line-height: 1;
  border-radius: 3px;
  font-weight: bold;
}

.disconnect-button:hover {
  background-color: var(--ct-bg-danger-hover, #fee2e2);
  border-color: var(--ct-text-danger-hover, #ef4444);
  color: var(--ct-text-danger-hover, #ef4444);
}

.dark .disconnect-button {
  color: var(--ct-text-danger-dark, #f87171);
}

.dark .disconnect-button:hover {
  background-color: var(--ct-bg-danger-hover-dark, #450a0a);
  border-color: var(--ct-text-danger-hover-dark, #ff7272);
  color: var(--ct-text-danger-hover-dark, #ff7272);
}
</style>