<template>
  <div
    class="inline-connection-sorter"
    v-if="draggableConnections.length > 1"
    @mousedown.stop
  >
    <draggable
      v-model="draggableConnections"
      item-key="id" 
      @end="onSortEnd" 
      handle=".drag-handle"
      class="connection-list"
    >
      <template #item="{element, index}">
        <div class="sortable-connection-item">
          <span class="drag-handle" title="拖拽排序">↕️</span>
          <span class="connection-index">{{ index + 1 }}.</span>
          <div class="tooltip-flex-wrapper">
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
        </div>
      </template>
    </draggable>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, type PropType, computed } from 'vue'; // 添加了 computed
import draggable from 'vuedraggable';
import type { Edge, Node } from '@vue-flow/core';
import type { InputDefinition, OutputDefinition } from '@comfytavern/types'; // HistoryEntry 和 createHistoryEntry 将由新的 composable 处理
// import { createHistoryEntry } from '@comfytavern/utils'; // 由新的 composable 处理
// import { useWorkflowInteractionCoordinator } from '@/composables/workflow/useWorkflowInteractionCoordinator'; // 将替换为新的 composable
import { useMultiInputConnectionActions } from '@/composables/node/useMultiInputConnectionActions'; // <-- 新增导入
import { useTabStore } from '@/stores/tabStore';
import Tooltip from '@/components/common/Tooltip.vue';

interface DraggableConnectionItem {
  id: string; // Edge ID
  sourceNodeId: string;
  sourceHandleId: string | null | undefined;
  sourceNodeLabel: string;
  sourceHandleLabel: string;
}

const props = defineProps({
  nodeId: { type: String, required: true },
  inputHandleKey: { type: String, required: true },
  currentOrderedEdgeIds: { type: Array as PropType<string[]>, default: () => [] },
  inputDefinition: { type: Object as PropType<InputDefinition>, required: true },
  // BaseNode 将通过 useVueFlow() 获取 vueFlowInstance 并传递所需部分
  allEdges: { type: Array as PropType<Edge[]>, required: true },
  findNode: { type: Function as PropType<(id: string) => Node | undefined>, required: true },
  getNodeLabel: { type: Function as PropType<(nodeId: string) => string>, required: true },
});

// const interactionCoordinator = useWorkflowInteractionCoordinator(); // 不再需要
const tabStore = useTabStore();
const activeTabIdRef = computed(() => tabStore.activeTabId);
const { reorderMultiInputConnections } = useMultiInputConnectionActions(activeTabIdRef); // <-- 实例化新的 composable

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
        sourceNodeLabel: sourceNode ? props.getNodeLabel(edge.source) : `源节点 ${edge.source.substring(0,6)}... 未找到`,
        sourceHandleLabel: sourceHandleLabel,
      });
    } else {
      // 如果根据 edgeId 在 allEdges 中找不到边，这通常表示数据不一致
      console.warn(`[InlineConnectionSorter] 边 ID ${edgeId} 在 allEdges 中未找到 (数据可能不一致).`);
      items.push({
        id: edgeId,
        sourceNodeId: 'error-edge-not-in-allEdges',
        sourceHandleId: 'error',
        sourceNodeLabel: `边 ${edgeId.substring(0,6)}... (数据错误)`,
        sourceHandleLabel: '!', // 用感叹号表示错误状态
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

  if (!tabStore.activeTabId) {
    console.error("[InlineConnectionSorter] 无法更新顺序：activeTabId 未定义。");
    // 可以考虑将列表重置回 props.currentOrderedEdgeIds 的状态，或者提示用户
    draggableConnections.value = mapEdgeIdsToDraggableItems(); // 恢复原始顺序
    return;
  }

  const nodeDisplayName = props.getNodeLabel(props.nodeId);
  const inputDisplayName = props.inputDefinition.displayName || props.inputHandleKey;

  // HistoryEntry 创建和具体的状态更新逻辑已移至 reorderMultiInputConnections
  try {
    await reorderMultiInputConnections(
      props.nodeId,
      props.inputHandleKey,
      newOrderedEdgeIds,
      [...props.currentOrderedEdgeIds], // 传递原始顺序的副本
      nodeDisplayName,
      inputDisplayName
    );
    // 成功后，props.currentOrderedEdgeIds 应该会通过父组件的响应式更新
    // 这会触发 watch 重新计算 draggableConnections.value
  } catch (error) {
    console.error("[InlineConnectionSorter] 更新连接顺序失败:", error);
    // 失败时，恢复UI到之前的顺序
    draggableConnections.value = mapEdgeIdsToDraggableItems();
  }
};

</script>

<style scoped>
.inline-connection-sorter {
  padding: 4px;
  margin-top: 2px; /* 与 param-header 稍微有点间距 */
  background-color: var(--ct-bg-surface-raised, #f0f0f0); /* 比节点主体稍亮的背景 */
  border-radius: 3px;
  border: 1px solid var(--ct-border-DEFAULT, #e0e0e0);
}
.dark .inline-connection-sorter {
  background-color: var(--ct-bg-surface-raised-dark, #2d2d2d);
  border-color: var(--ct-border-dark, #3a3a3a);
}

.connection-list {
  display: flex;
  flex-direction: column;
  gap: 2px; /* 列表项之间的间距 */
}

.sortable-connection-item {
  display: flex;
  align-items: center;
  padding: 3px 5px;
  background-color: var(--ct-bg-surface, #ffffff);
  border: 1px solid var(--ct-border-input, #cccccc);
  border-radius: 3px;
  font-size: 0.8em; /* 稍小字体以适应紧凑空间 */
  cursor: grab;
  color: var(--ct-text-default, #333333);
}
.dark .sortable-connection-item {
  background-color: var(--ct-bg-input-dark, #374151); /* 与输入框背景类似 */
  border-color: var(--ct-border-input-dark, #555555);
  color: var(--ct-text-default-dark, #f3f4f6);
}

.sortable-connection-item:hover {
  border-color: var(--ct-accent-DEFAULT, #2563eb);
}
.dark .sortable-connection-item:hover {
  border-color: var(--ct-accent-dark, #3b82f6);
}

.drag-handle {
  margin-right: 6px;
  cursor: grab;
  color: var(--ct-text-muted, #6b7280);
}
.dark .drag-handle {
  color: var(--ct-text-muted-dark, #9ca3af);
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
  flex-grow: 1; /* 占据剩余空间 */
  min-width: 0; /* 允许缩小到内容宽度以下，这对于内部的 overflow:hidden 生效至关重要 */
  overflow: hidden; /* 确保此包装器本身不会溢出其父级（.sortable-connection-item） */
}

.connection-label-container {
  display: flex;
  align-items: baseline;
  overflow: hidden;
  flex-grow: 1;
  min-width: 0; /* 允许容器在flex布局中正确收缩 */
}

.source-node-label-part {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 2; /* 节点名称部分优先收缩 (值越大越优先) */
  min-width: 0; /* 确保在空间不足时可以缩小到0，从而触发省略号 */
}

.source-handle-label-part {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 1; /* 插槽名称部分后收缩 */
  margin-left: 4px; /* 与节点名称保持一点间距 */
  min-width: 0; /* 确保在空间不足时可以缩小到0，从而触发省略号 */
}
</style>