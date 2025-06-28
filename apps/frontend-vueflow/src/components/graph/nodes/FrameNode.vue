<template>
  <div
    class="frame-node vue-flow__node-group"
    :style="nodeStyles"
    @dblclick="startEditingTitle"
  >
    <NodeResizer :min-width="180" :min-height="120" @resize-start="handleResizeStart" @resize-end="handleResizeEnd" />
    <div class="frame-header">
      <input
        v-if="isEditing"
        ref="titleInputRef"
        v-model="editableTitle"
        class="title-input"
        @blur="finishEditingTitle"
        @keydown.enter="finishEditingTitle"
        @mousedown.stop
      />
      <span v-else>{{ displayLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, type CSSProperties } from 'vue';
import { NodeResizer } from '@vue-flow/node-resizer';
import '@vue-flow/node-resizer/dist/style.css';
import { type NodeProps } from '@vue-flow/core';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useTabStore } from '@/stores/tabStore';
import { createHistoryEntry } from '@comfytavern/utils';
import type { HistoryEntry } from '@comfytavern/types';

// 定义更具体的 props 类型，使其更健壮
interface FrameNodeData {
  label?: string;
  displayName?: string;
}

// 遵循 Vue Flow 的标准，style 是可选的
interface FrameNodeProps extends NodeProps<FrameNodeData> {
  data: FrameNodeData;
  style?: CSSProperties;
}

const props = defineProps<FrameNodeProps>();

const workflowStore = useWorkflowStore();
const tabStore = useTabStore();

const isEditing = ref(false);
const titleInputRef = ref<HTMLInputElement | null>(null);

// 遵循 label > displayName > fallback 的标准显示逻辑
const displayLabel = computed(() => {
  return props.data.label || props.data.displayName || '分组框';
});

const editableTitle = ref(displayLabel.value);

const nodeStyles = computed(() => {
  // 节点的尺寸 (width, height) 由 Vue Flow 的父级 div (`.vue-flow__node`) 控制
  // 当 NodeResizer 改变大小时，它会更新核心状态，这个状态会应用到父级 div
  // 我们的自定义节点组件只需要撑满这个父级 div (width: 100%, height: 100%) 即可
  // 所以这里我们只应用 cosmetic (装饰性) 样式
  return {
    backgroundColor: props.style?.backgroundColor || 'var(--ct-frame-bg, rgba(220, 220, 240, 0.4))',
    border: props.style?.border || '2px dotted var(--ct-frame-border-color, #9CA3AF)',
    borderRadius: props.style?.borderRadius || '12px',
  };
});

const startEditingTitle = () => {
  isEditing.value = true;
  // 开始编辑时，使用当前的显示名称
  editableTitle.value = displayLabel.value;
  nextTick(() => {
    titleInputRef.value?.focus();
    titleInputRef.value?.select();
  });
};

const finishEditingTitle = () => {
  if (isEditing.value) {
    const newLabel = editableTitle.value;
    const oldLabel = displayLabel.value;

    if (newLabel === oldLabel) {
      isEditing.value = false;
      return;
    }

    const activeTabId = tabStore.activeTabId;
    if (!activeTabId) {
      console.error("无法完成标题编辑：没有活动的标签页。");
      isEditing.value = false;
      return;
    }

    const entry: HistoryEntry = createHistoryEntry(
      'modify',
      'nodeProperty',
      `重命名节点 '${oldLabel}' 为 '${newLabel}'`,
      {
        nodeId: props.id,
        propertyName: 'label',
        oldValue: oldLabel,
        newValue: newLabel,
      }
    );

    workflowStore.updateNodeLabelAndRecord(activeTabId, props.id, newLabel, entry);

    isEditing.value = false;
  }
};

const initialDimensionsOnResize = ref<{ width: number, height: number } | null>(null);

const handleResizeStart = () => {
  // 在调整大小开始时捕获当前尺寸
  initialDimensionsOnResize.value = {
    width: props.dimensions.width,
    height: props.dimensions.height,
  };
};

const handleResizeEnd = (event: { params: { width: number, height: number } }) => {
  const activeTabId = tabStore.activeTabId;
  if (!activeTabId) {
    console.error("无法记录尺寸变更：没有活动的标签页。");
    return;
  }
  
  const oldDimensions = initialDimensionsOnResize.value;
  if (!oldDimensions) {
    console.warn("无法记录尺寸变更：未捕获到初始尺寸。");
    return;
  }

  const newDimensions = {
      width: event.params.width,
      height: event.params.height
  };
  
  // 重置以备下次使用
  initialDimensionsOnResize.value = null;

  if (oldDimensions.width === newDimensions.width && oldDimensions.height === newDimensions.height) {
    return; // 尺寸未变，不记录历史
  }

  const entry: HistoryEntry = createHistoryEntry(
    'modify',
    'nodeProperty',
    `调整节点 '${displayLabel.value}' 尺寸`,
    {
      nodeId: props.id,
      propertyName: 'dimensions',
      oldValue: oldDimensions,
      newValue: newDimensions,
    }
  );

  workflowStore.updateNodeDimensionsAndRecord(activeTabId, props.id, newDimensions, entry);
};

</script>

<style scoped>
.frame-node {
  @apply relative overflow-hidden;
  width: 100%;
  height: 100%;
  /* Resizer handles will be placed inside */
}

.frame-header {
  @apply bg-background-surface p-2 text-sm font-bold text-text-muted rounded-t-lg cursor-grab;
  /* Ensure header is on top of any content */
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  box-sizing: border-box;
}

.title-input {
  @apply w-full bg-transparent border-none p-0 m-0 text-inherit font-bold outline-none;
}
</style>