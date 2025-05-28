<template>
  <g v-if="isUnplugging && sourceScreenPosInternal">
    <path class="vue-flow__connection-path" :d="customPathDefinition" :style="{ stroke: '#ff0000', strokeWidth: 3 }" />
  </g>
  <g v-else-if="!isUnplugging">
    <!-- 默认 VueFlow 连线渲染 (当不拔出时) -->
    <path class="vue-flow__connection-path" :d="defaultPathDefinition" :style="{ stroke: '#555', strokeWidth: 2 }" />
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'; // 移除了未使用的 CSSProperties 和 watch
import { useVueFlow, type ConnectionLineProps, type HandleElement, type Styles } from '@vue-flow/core'; // 移除了 GraphNode
import { draggingState } from '../../../composables/canvas/useCanvasConnections';
import { getBezierPath } from '@vue-flow/core';

const props = defineProps<ConnectionLineProps>();
const { findNode, viewport } = useVueFlow();

const isUnplugging = computed(() => {
  return draggingState.value?.type === 'disconnect_reconnect' && !!draggingState.value?.originalEdge;
});

const sourceScreenPosInternal = computed(() => {
  if (!isUnplugging.value || !draggingState.value?.originalEdge) {
    return null;
  }
  const edge = draggingState.value.originalEdge;
  const sourceNode = findNode(edge.source);
  if (!sourceNode) {
    return null;
  }

  let handle: HandleElement | undefined;
  if (sourceNode.handleBounds && sourceNode.handleBounds.source) {
    handle = sourceNode.handleBounds.source.find(h => h.id === edge.sourceHandle);
  }

  if (!handle) {
    let nodeWidth = sourceNode.dimensions?.width;
    if (nodeWidth == null) {
      const style = sourceNode.style as Styles; // 类型断言为 Styles 对象
      if (typeof style === 'object' && style && style.width) {
        if (typeof style.width === 'string') {
          const parsed = parseFloat(style.width);
          if (!isNaN(parsed)) nodeWidth = parsed;
        } else if (typeof style.width === 'number') {
          nodeWidth = style.width;
        }
      }
    }
    if (nodeWidth == null) nodeWidth = 150; // 默认宽度

    let nodeHeight = sourceNode.dimensions?.height;
    if (nodeHeight == null) {
      const style = sourceNode.style as Styles; // 类型断言为 Styles 对象
      if (typeof style === 'object' && style && style.height) {
        if (typeof style.height === 'string') {
          const parsed = parseFloat(style.height);
          if (!isNaN(parsed)) nodeHeight = parsed;
        } else if (typeof style.height === 'number') {
          nodeHeight = style.height;
        }
      }
    }
    if (nodeHeight == null) nodeHeight = 50; // 默认高度

    const x = sourceNode.position.x + nodeWidth;
    const y = sourceNode.position.y + nodeHeight / 2;
    return {
      x: (x * viewport.value.zoom) + viewport.value.x,
      y: (y * viewport.value.zoom) + viewport.value.y,
    };
  }

  const sourceHandleX = sourceNode.position.x + handle.x + (handle.width / 2);
  const sourceHandleY = sourceNode.position.y + handle.y + (handle.height / 2);

  return {
    x: (sourceHandleX * viewport.value.zoom) + viewport.value.x,
    y: (sourceHandleY * viewport.value.zoom) + viewport.value.y,
  };
});

const customPathDefinition = computed(() => {
  if (!sourceScreenPosInternal.value) return '';
  const [path] = getBezierPath({
    sourceX: sourceScreenPosInternal.value.x,
    sourceY: sourceScreenPosInternal.value.y,
    targetX: props.targetX,
    targetY: props.targetY,
  });
  return path;
});

const defaultPathDefinition = computed(() => {
  const [path] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
  });
  return path;
});

</script>

<style scoped>
/* 可以在这里添加特定样式，如果需要 */
</style>