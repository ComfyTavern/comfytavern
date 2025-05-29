<template>
  <div v-if="visible" class="context-menu context-menu-base" :style="{ left: `${position.x}px`, top: `${position.y}px` }" @click.stop @mousedown.stop>
    <!-- 搜索框 -->
    <div class="context-menu-search">
      <input
        type="text"
        v-model="searchQuery"
        placeholder="搜索节点..."
        class="context-menu-search-input"
        @input="onSearch"
        ref="searchInputRef"
        @keydown.enter="onAddNodeFromSearch"
      />
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="context-menu-loading">
      <span>正在加载节点类型...</span>
    </div>

    <!-- 搜索结果 -->
    <div v-else-if="searchQuery && filteredNodeTypes.length > 0" class="context-menu-search-results">
      <div
        v-for="nodeType in filteredNodeTypes"
        :key="nodeType.type"
        class="context-menu-item search-result"
        @click="onAddNodeWithType(nodeType.type)"
      >
        <span class="icon">{{nodeType.icon}}</span>
        <span class="flex flex-col">
          <span>{{nodeType.label}}</span>
          <span v-if="nodeType.category" class="text-xs text-gray-500">{{nodeType.category}}</span>
        </span>
      </div>
    </div>
    
    <!-- 无搜索结果 -->
    <div v-else-if="searchQuery && filteredNodeTypes.length === 0" class="context-menu-no-results">
      <span>没有找到匹配的节点类型</span>
    </div>

    <!-- 菜单选项 -->
    <div class="context-menu-items" v-else>
      <div class="context-menu-item" @click="onAddNode">
        <span class="icon">+</span> 添加节点
      </div>
      <!-- 添加节点组创建视觉分组框 -->
      <div class="context-menu-item" @click="onAddGroup">
        <span class="icon">⊞</span> 添加分组框
      </div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" @click="onCopy" :class="{ disabled: !hasSelectedNodes }">
        <span class="icon">⎘</span> 复制
      </div>
      <div class="context-menu-item" @click="onPaste" :class="{ disabled: !hasCopiedNodes }">
        <span class="icon">📋</span> 粘贴
      </div>
      <div class="context-menu-item" @click="onDelete" :class="{ disabled: !hasSelectedNodes }">
        <span class="icon">🗑</span> 删除
      </div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" @click="onSelectAll">
        <span class="icon">☑</span> 全选
      </div>
      <div class="context-menu-item" @click="onResetView">
        <span class="icon">⟲</span> 重置视图
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue';
import type { XYPosition } from '@vue-flow/core';
import { useNodeStore } from '../../../stores/nodeStore';
import { storeToRefs } from 'pinia'; // 导入 storeToRefs

// 使用节点存储
const nodeStore = useNodeStore();
const { nodeDefinitions } = storeToRefs(nodeStore); // 从 nodeStore 获取响应式引用
const loading = ref(false);

// 节点类型列表，从后端获取
const nodeTypes = computed(() => {
  // 使用从 storeToRefs 获取的响应式 nodeDefinitions
  if (!nodeDefinitions.value) return [];

  // 过滤掉 isGroupInternal 为 true 的节点定义
  return nodeDefinitions.value
    .filter((nodeDef: any) => !nodeDef.isGroupInternal) // 添加过滤条件
    .map((node: any) => ({ // 使用 any 避免复杂的类型定义，或者需要从 types 包导入 NodeDefinition
      type: node.type,
      label: node.displayName || node.type, // 确认使用 displayName
      icon: node.icon || '🔌', // 保留默认图标
      category: node.category
    }));
});

// 组件挂载时加载节点定义
onMounted(async () => {
  loading.value = true;
  await nodeStore.fetchAllNodeDefinitions();
  loading.value = false;
});

const props = defineProps<{
  visible: boolean;
  position: XYPosition;
  hasSelectedNodes: boolean;
  hasCopiedNodes: boolean;
}>();

const emit = defineEmits<{
  (e: 'add-node', nodeType?: string): void;
  (e: 'add-group'): void;
  (e: 'copy'): void;
  (e: 'paste'): void;
  (e: 'delete'): void;
  (e: 'select-all'): void;
  (e: 'reset-view'): void;
  (e: 'close'): void;
}>();

const searchQuery = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);

// 过滤节点类型
const filteredNodeTypes = computed(() => {
  if (!searchQuery.value) return [];
  const query = searchQuery.value.toLowerCase();
  
  return nodeTypes.value.filter((type: {
    label: string;
    type: string;
    category?: string;
  }) =>
    type.label.toLowerCase().includes(query) ||
    type.type.toLowerCase().includes(query) ||
    (type.category && type.category.toLowerCase().includes(query))
  );
});

// 搜索框自动聚焦
watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    nextTick(() => {
      searchInputRef.value?.focus();
    });
  } else {
    searchQuery.value = '';
  }
});

const onSearch = () => {
  // 搜索逻辑已通过 computed 属性实现
};

const onAddNode = () => {
  emit('add-node');
  emit('close');
};

const onAddNodeWithType = (nodeType: string) => {
  emit('add-node', nodeType);
  emit('close');
};

const onAddNodeFromSearch = () => {
  if (filteredNodeTypes.value.length > 0) {
    const nodeType = filteredNodeTypes.value[0];
    if (nodeType && nodeType.type) {
      onAddNodeWithType(nodeType.type);
    } else {
      onAddNode();
    }
  } else {
    onAddNode();
  }
};

// onAddGroup 函数
const onAddGroup = () => {
  emit('add-group');
  emit('close');
};

const onCopy = () => {
  if (!props.hasSelectedNodes) return;
  emit('copy');
  emit('close');
};

const onPaste = () => {
  if (!props.hasCopiedNodes) return;
  emit('paste');
  emit('close');
};

const onDelete = () => {
  if (!props.hasSelectedNodes) return;
  emit('delete');
  emit('close');
};

const onSelectAll = () => {
  emit('select-all');
  emit('close');
};

const onResetView = () => {
  emit('reset-view');
  emit('close');
};
</script>

<style scoped>
.context-menu-loading,
.context-menu-no-results {
  @apply p-3 text-center text-gray-500 dark:text-gray-400 text-sm;
}

.context-menu {
  position: fixed; /* 改为 fixed 定位，避免影响画布布局 */
  min-width: 200px;
  max-height: 400px; /* 与定位逻辑中的 MENU_MAX_HEIGHT 保持一致 */
  overflow-y: auto; /* 内容超出时显示滚动条 */
  z-index: 1000; /* 确保菜单显示在最上层 */
  /* 移除重复的样式定义，保留 shared.css 中的基础样式 */
}

.context-menu-search {
  @apply sticky top-0 p-2 border-b border-gray-200 dark:border-gray-700 bg-inherit;
}

.context-menu-search-input {
  @apply w-full px-3 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none placeholder-gray-400 dark:placeholder-gray-500;
}

.context-menu-items {
  @apply max-h-[calc(400px-3rem)] overflow-y-auto;
}

</style>