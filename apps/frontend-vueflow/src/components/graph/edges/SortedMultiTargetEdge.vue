<script setup lang="ts">
import { computed } from 'vue' // 移除了 CSSProperties
import { getBezierPath, type EdgeProps, type GraphNode } from '@vue-flow/core' // 导入 GraphNode

// 定义 Props，扩展 EdgeProps 并明确 targetNode 和 targetHandleId
interface SortedMultiTargetEdgeProps extends EdgeProps {
  // EdgeProps 已包含 id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, style 等
  // 我们只需要覆盖或添加特定类型
  targetNode: GraphNode // 确保 targetNode 是 GraphNode 类型
  targetHandleId?: string // targetHandleId 是可选的
}

const props = defineProps<SortedMultiTargetEdgeProps>()

// 从 BaseNode.vue 引入的常量
const singleLineHeight = 20 // 单条连接线的高度 (px)
const lineGap = 4 // 连接线之间的间隙 (px)

const path = computed(() => {
  let verticalOffset = 0

  if (
    props.targetNode &&
    props.targetNode.data &&
    props.targetNode.data.inputConnectionOrders &&
    props.targetHandleId &&
    props.targetNode.data.inputConnectionOrders[props.targetHandleId]
  ) {
    const orderedEdgeIds: string[] = props.targetNode.data.inputConnectionOrders[props.targetHandleId]
    const currentIndex = orderedEdgeIds.indexOf(props.id)

    if (currentIndex !== -1) {
      const N = orderedEdgeIds.length
      const k = currentIndex

      const H_total_slots = N * singleLineHeight + (N > 1 ? (N - 1) * lineGap : 0)
      const Y_k_relative_to_top = k * (singleLineHeight + lineGap) + singleLineHeight / 2
      verticalOffset = Y_k_relative_to_top - H_total_slots / 2
    }
  }

  // 使用 getBezierPath 计算路径，可以根据需要替换为 getSmoothStepPath 等
  const [pathValue, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY + verticalOffset, // 应用垂直偏移
    targetPosition: props.targetPosition,
  })

  return {
    pathValue,
    labelX,
    labelY,
  }
})
</script>

<template>
  <path
    :id="props.id"
    class="vue-flow__edge-path"
    :d="path.pathValue"
    :marker-end="props.markerEnd"
    :style="props.style"
  />
  <!-- 如果需要标签，可以在这里添加 EdgeLabel -->
  <!--
  <EdgeLabel
    :transform="`translate(${path.labelX} ${path.labelY})`"
    :label="props.label"
    :label-style="props.labelStyle"
    :label-show-bg="props.labelShowBg"
    :label-bg-style="props.labelBgStyle"
    :label-bg-padding="props.labelBgPadding"
    :label-bg-border-radius="props.labelBgBorderRadius"
  />
  -->
</template>