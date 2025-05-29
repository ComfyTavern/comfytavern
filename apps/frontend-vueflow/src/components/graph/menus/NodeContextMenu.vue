<template>
  <div
    v-if="visible"
    class="node-context-menu context-menu-base"
    :style="{ left: `${position.x}px`, top: `${position.y}px` }"
    @click.stop
  >
    <!-- 单节点菜单选项 (selectedNodeCount <= 1) -->
    <div v-if="selectedNodeCount <= 1" class="context-menu-items">
      <div class="context-menu-item" @click="onEdit"><span class="icon">✏️</span> 编辑节点</div>
      <div class="context-menu-item" @click="onDuplicate">
        <span class="icon">🔄</span> 复制节点
      </div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" @click="onConnect"><span class="icon">🔗</span> 连接到...</div>
      <div class="context-menu-item" @click="onDisconnect">
        <span class="icon">✂️</span> 断开所有连接
      </div>
      <div v-if="isGroupOutputNode" class="context-menu-separator"></div>
      <div v-if="isGroupOutputNode" class="context-menu-item" @click="onViewGroupOutput">
        <span class="icon">📊</span> 查看组输出
      </div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" @click="onDelete"><span class="icon">🗑</span> 删除节点</div>
    </div>

    <!-- 多选菜单选项 (selectedNodeCount > 1) -->
    <div v-else class="context-menu-items">
      <div class="context-menu-item" @click="onCopySelection">
        <span class="icon">⎘</span> 复制选中项 ({{ selectedNodeCount }})
      </div>
      <div class="context-menu-item" @click="onCreateGroup">
        <span class="icon">🧱</span> 创建节点组 (Ctrl+G)
      </div>
      <div class="context-menu-item" @click="onCreateFrame">
        <span class="icon">🖼️</span> 创建分组框
      </div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" @click="onDeleteSelection">
        <span class="icon">🗑</span> 删除选中项 ({{ selectedNodeCount }})
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { XYPosition } from "@vue-flow/core";
import { computed } from 'vue';
import { useWorkflowManager } from '@/composables/workflow/useWorkflowManager';
// import { useVueFlow } from '@vue-flow/core'; // Alternative if nodeType is not passed as prop

const props = defineProps<{
  visible: boolean;
  position: XYPosition;
  nodeId: string; // 仍然需要 nodeId 用于单选操作
  nodeType?: string; // 新增：被右键点击的节点类型
  selectedNodeCount: number; // 新增：选中的节点数量
}>();

const emit = defineEmits<{
  // 单选事件
  (e: "edit", nodeId: string): void;
  (e: "duplicate", nodeId: string): void;
  (e: "connect", nodeId: string): void;
  (e: "disconnect", nodeId: string): void;
  (e: "delete", nodeId: string): void;
  // 多选事件
  (e: "copy-selection"): void;
  (e: "create-group-from-selection"): void;
  (e: "create-frame-for-selection"): void;
  (e: "delete-selection"): void;
  // 关闭事件
  (e: "close"): void;
}>();

const workflowManager = useWorkflowManager();
// const { getNode } = useVueFlow(); // Alternative: const node = computed(() => getNode.value(props.nodeId));

const isGroupOutputNode = computed(() => {
  // If nodeType is passed as a prop:
  return props.nodeType === 'core:GroupOutput';
  // Alternative if using useVueFlow():
  // const nodeInstance = getNode.value(props.nodeId);
  // return nodeInstance?.type === 'core:GroupOutput';
});

const onViewGroupOutput = () => {
  if (isGroupOutputNode.value) {
    workflowManager.switchToGroupOutputPreviewMode();
    emit("close");
  }
};

// --- 单选操作处理 ---
const onEdit = () => {
  emit("edit", props.nodeId);
  emit("close");
};

const onDuplicate = () => {
  emit("duplicate", props.nodeId);
  emit("close");
};

const onConnect = () => {
  emit("connect", props.nodeId);
  emit("close");
};

const onDisconnect = () => {
  emit("disconnect", props.nodeId);
  emit("close");
};

const onDelete = () => {
  emit("delete", props.nodeId);
  emit("close");
};

// --- 多选操作处理 ---
const onCopySelection = () => {
  emit("copy-selection");
  emit("close");
};

const onCreateGroup = () => {
  emit("create-group-from-selection");
  emit("close");
};

const onCreateFrame = () => {
  emit("create-frame-for-selection");
  emit("close");
};

const onDeleteSelection = () => {
  emit("delete-selection");
  emit("close");
};
</script>

<style scoped>
.node-context-menu {
  /* Base styles are now applied directly via class="context-menu-base" */
  min-width: 180px; /* 保持最小宽度 */
}

/* 可以为多选菜单项添加特定样式 */
.context-menu-item .icon {
  margin-right: 8px; /* 图标和文字间距 */
  display: inline-block;
  width: 1.2em; /* 确保图标对齐 */
  text-align: center;
}
</style>
