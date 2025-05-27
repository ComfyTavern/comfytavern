<script setup lang="ts">
import { computed } from 'vue' // 移除了 CSSProperties
import { getBezierPath, type EdgeProps, type GraphNode } from '@vue-flow/core' // 导入 GraphNode
import {
  HANDLE_LINE_HEIGHT,
  HANDLE_LINE_GAP,
  HANDLE_VERTICAL_PADDING,
  // MIN_MULTI_HANDLE_HEIGHT_FACTOR, // SortedMultiTargetEdge 不需要此常量
  // HANDLE_WIDTH, // SortedMultiTargetEdge 不需要此常量
} from '../../../constants/handleConstants'; // 导入共享常量

// 定义 Props，扩展 EdgeProps 并明确 targetNode 和 targetHandleId
interface SortedMultiTargetEdgeProps extends EdgeProps {
  // EdgeProps 已包含 id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, style 等
  // 我们只需要覆盖或添加特定类型
  targetNode: GraphNode // 确保 targetNode 是 GraphNode 类型
  targetHandleId?: string // targetHandleId 是可选的
}

const props = defineProps<SortedMultiTargetEdgeProps>()


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
      const N = orderedEdgeIds.length // 总连接数
      const k = currentIndex // 当前边的索引 (0-based)

      // --- 已修正的计算逻辑 ---
      // HLH_const (4), HLG_const (6), HVP_const (8)

      // 每个子 Handle 项的实际高度 (BaseNode.vue 中 .child-handle-item 的高度)
      const childItemHeight = HANDLE_LINE_HEIGHT + HANDLE_VERTICAL_PADDING; // 4 + 8 = 12px

      // 子 Handle 项之间的间隙
      const childItemGap = HANDLE_LINE_GAP; // 6px

      // 跑道容器（即主Handle）的单边垂直CSS padding
      const containerVerticalPaddingHalf = HANDLE_VERTICAL_PADDING / 2; // 8 / 2 = 4px

      // 计算主 Handle (跑道容器) 的总高度
      // N * (子项高度) + (N-1) * (项间隙) + 容器总垂直CSSpadding
      const H_handle =
        N * childItemHeight +
        Math.max(0, N - 1) * childItemGap +
        HANDLE_VERTICAL_PADDING; // N * 12 + max(0,N-1)*6 + 8

      // 计算当前边连接点 (第k个子Handle的中心) 相对于主Handle顶部的Y距离
      const Y_k_relative_to_handle_top =
        containerVerticalPaddingHalf + // 容器顶部padding
        k * (childItemHeight + childItemGap) + // 前k个 (子项+间隙) 的总高度
        (childItemHeight / 2); // 当前子项的中心

      // Vue Flow 的 targetY 是主 Handle 的中心点 Y 坐标
      // 我们需要计算 Y_k 相对于主 Handle 中心的偏移
      verticalOffset = Y_k_relative_to_handle_top - (H_handle / 2)
    }
  }

  // 使用 getBezierPath 计算路径
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